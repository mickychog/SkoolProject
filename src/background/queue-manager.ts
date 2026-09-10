/**
 * Download Queue Manager: State orchestration, concurrency control, and task lifecycle.
 * Follows: docs/specs/02_ARCHITECTURE_SPEC.md & 03_DATA_MODELS_AND_CONTRACTS.md
 */

import { QueueState, DownloadTask } from '@/types/queue';
import { ExtensionMessage } from '@/types/messages';
import { OffscreenManager } from './offscreen-manager';
import { providerRegistry } from '@/providers';

export class QueueManager {
  private state: QueueState = {
    tasks: {},
    activeTaskIds: [],
    isPaused: false,
    maxConcurrent: 2,
    defaultQuality: '1080p',
  };

  private storageKey = 'skool_queue_state';

  constructor() {
    this.initFromStorage();
  }

  async initFromStorage(): Promise<void> {
    const result = await chrome.storage.local.get([this.storageKey]);
    if (result[this.storageKey]) {
      this.state = { ...this.state, ...result[this.storageKey] };
      // Reset any active tasks that were interrupted to queued
      this.state.activeTaskIds.forEach((id) => {
        if (this.state.tasks[id] && this.state.tasks[id].status === 'downloading') {
          this.state.tasks[id].status = 'queued';
        }
      });
      this.state.activeTaskIds = [];
      this.saveState();
    }
  }

  getState(): QueueState {
    return this.state;
  }

  addTasks(
    tasksData: Array<
      Omit<
        DownloadTask,
        'id' | 'status' | 'progressPercent' | 'bytesDownloaded' | 'retryCount' | 'createdAt'
      >
    >
  ): number {
    const now = Date.now();
    tasksData.forEach((data, idx) => {
      const id = `task_${now}_${idx}_${Math.random().toString(36).substring(2, 7)}`;
      const task: DownloadTask = {
        ...data,
        id,
        status: 'queued',
        progressPercent: 0,
        bytesDownloaded: 0,
        retryCount: 0,
        createdAt: now + idx,
      };
      this.state.tasks[id] = task;
    });

    this.saveState();
    this.processNext();
    return tasksData.length;
  }

  pauseQueue(): void {
    this.state.isPaused = true;
    this.saveState();
  }

  resumeQueue(): void {
    this.state.isPaused = false;
    this.saveState();
    this.processNext();
  }

  cancelTask(taskId: string): void {
    const task = this.state.tasks[taskId];
    if (task) {
      task.status = 'failed';
      task.error = 'Cancelado por el usuario';
      this.state.activeTaskIds = this.state.activeTaskIds.filter((id) => id !== taskId);

      if (task.chromeDownloadId) {
        chrome.downloads.cancel(task.chromeDownloadId).catch(() => {});
      }

      this.saveState();
      this.processNext();
    }
  }

  clearCompleted(): void {
    Object.keys(this.state.tasks).forEach((id) => {
      if (this.state.tasks[id].status === 'completed') {
        delete this.state.tasks[id];
      }
    });
    this.saveState();
  }

  retryFailed(): void {
    Object.values(this.state.tasks).forEach((task) => {
      if (task.status === 'failed') {
        task.status = 'queued';
        task.error = undefined;
        task.progressPercent = 0;
        task.retryCount++;
      }
    });
    this.saveState();
    this.processNext();
  }

  updateTaskProgress(taskId: string, progressPercent: number): void {
    const task = this.state.tasks[taskId];
    if (task) {
      task.progressPercent = progressPercent;
      this.broadcast({
        type: 'TASK_PROGRESS_UPDATE',
        payload: {
          taskId,
          progressPercent,
          bytesDownloaded: task.bytesDownloaded,
          totalBytes: task.totalBytes,
          status: task.status,
        },
      });
      this.saveState();
    }
  }

  async handleHlsCompleted(taskId: string, blobUrl: string): Promise<void> {
    const task = this.state.tasks[taskId];
    if (!task) return;

    try {
      const downloadId = await chrome.downloads.download({
        url: blobUrl,
        filename: `${task.targetFolder}${task.suggestedFileName}`,
        conflictAction: 'uniquify',
        saveAs: false,
      });

      task.chromeDownloadId = downloadId;
      task.status = 'completed';
      task.progressPercent = 100;
      task.completedAt = Date.now();
    } catch (err: unknown) {
      task.status = 'failed';
      task.error = err instanceof Error ? err.message : 'Error al guardar video HLS';
    } finally {
      this.state.activeTaskIds = this.state.activeTaskIds.filter((id) => id !== taskId);
      this.saveState();
      this.checkOffscreenCleanup();
      this.processNext();
    }
  }

  handleHlsFailed(taskId: string, error: string): void {
    const task = this.state.tasks[taskId];
    if (task) {
      task.status = 'failed';
      task.error = error;
      this.state.activeTaskIds = this.state.activeTaskIds.filter((id) => id !== taskId);
      this.saveState();
      this.checkOffscreenCleanup();
      this.processNext();
    }
  }

  handleChromeDownloadChange(delta: chrome.downloads.DownloadDelta): void {
    const matchingTask = Object.values(this.state.tasks).find(
      (t) => t.chromeDownloadId === delta.id
    );

    if (!matchingTask) return;

    if (delta.state) {
      if (delta.state.current === 'complete') {
        matchingTask.status = 'completed';
        matchingTask.progressPercent = 100;
        matchingTask.completedAt = Date.now();
        this.state.activeTaskIds = this.state.activeTaskIds.filter((id) => id !== matchingTask.id);
        this.saveState();
        this.notifyIfAllCompleted();
        this.processNext();
      } else if (delta.state.current === 'interrupted') {
        matchingTask.status = 'failed';
        matchingTask.error = delta.error?.current || 'Descarga interrumpida';
        this.state.activeTaskIds = this.state.activeTaskIds.filter((id) => id !== matchingTask.id);
        this.saveState();
        this.processNext();
      }
    }
  }

  /**
   * Dispatches the next queued tasks up to maxConcurrent limit
   */
  async processNext(): Promise<void> {
    if (this.state.isPaused) return;

    const availableSlots = this.state.maxConcurrent - this.state.activeTaskIds.length;
    if (availableSlots <= 0) return;

    const queuedTasks = Object.values(this.state.tasks)
      .filter((t) => t.status === 'queued')
      .sort((a, b) => a.createdAt - b.createdAt);

    const tasksToStart = queuedTasks.slice(0, availableSlots);

    for (const task of tasksToStart) {
      this.state.activeTaskIds.push(task.id);

      // 1. If task is a Skool lesson page URL, resolve stream first
      if (task.assetType === 'video' && task.sourceUrl.includes('/classroom/')) {
        task.status = 'processing';
        this.saveState();

        try {
          const resolvedStream = await this.resolveLessonPageStream(task.sourceUrl);
          if (resolvedStream && !resolvedStream.includes('/classroom/')) {
            task.sourceUrl = resolvedStream;
          } else {
            // Check if there is an active tab on Skool that can scan it directly
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];
            let activeLessonMediaUrl: string | null = null;
            if (tab?.id && tab.url?.includes('/classroom/')) {
              try {
                const response = await chrome.tabs.sendMessage(tab.id, { type: 'SCAN_ACTIVE_LESSON' });
                if (response?.type === 'LESSON_SCANNED_SUCCESS' && response.payload?.media?.sourceUrl) {
                  activeLessonMediaUrl = response.payload.media.sourceUrl;
                }
              } catch {
                // Ignore
              }
            }

            if (activeLessonMediaUrl) {
              task.sourceUrl = activeLessonMediaUrl;
            } else {
              // Mark cleanly as failed or completed text-only lesson (NEVER call chrome.downloads on a webpage)
              task.status = 'failed';
              task.error = 'No se encontró stream de video reproducible en esta lección.';
              this.state.activeTaskIds = this.state.activeTaskIds.filter((id) => id !== task.id);
              this.saveState();
              this.processNext();
              continue;
            }
          }
        } catch {
          task.status = 'failed';
          task.error = 'No se pudo resolver el reproductor de video de la lección.';
          this.state.activeTaskIds = this.state.activeTaskIds.filter((id) => id !== task.id);
          this.saveState();
          this.processNext();
          continue;
        }
      }

      // 2. Guard: NEVER pass a Skool webpage URL directly to chrome.downloads
      if (task.sourceUrl.includes('skool.com') && task.sourceUrl.includes('/classroom/')) {
        task.status = 'failed';
        task.error = 'URL de página no descargable directamente.';
        this.state.activeTaskIds = this.state.activeTaskIds.filter((id) => id !== task.id);
        this.saveState();
        this.processNext();
        continue;
      }

      // 3. Check if it is an HLS stream (.m3u8)
      if (task.sourceUrl.includes('.m3u8')) {
        task.status = 'processing';
        this.saveState();

        try {
          await OffscreenManager.ensureDocument();
          chrome.runtime.sendMessage({
            type: 'OFFSCREEN_START_HLS_DOWNLOAD',
            payload: {
              taskId: task.id,
              manifestUrl: task.sourceUrl,
              targetFileName: task.suggestedFileName,
            },
          });
        } catch (err: unknown) {
          task.status = 'failed';
          task.error = err instanceof Error ? err.message : 'Error al iniciar Offscreen HLS';
          this.state.activeTaskIds = this.state.activeTaskIds.filter((id) => id !== task.id);
          this.saveState();
        }
      } else {
        // 4. Direct download (PDFs, normal MP4 links, direct CDN streams)
        task.status = 'downloading';
        this.saveState();

        try {
          const downloadId = await chrome.downloads.download({
            url: task.sourceUrl,
            filename: `${task.targetFolder}${task.suggestedFileName}`,
            conflictAction: 'uniquify',
            saveAs: false,
          });

          task.chromeDownloadId = downloadId;
          this.saveState();
        } catch (err: unknown) {
          task.status = 'failed';
          task.error = err instanceof Error ? err.message : 'Error al iniciar descarga';
          this.state.activeTaskIds = this.state.activeTaskIds.filter((id) => id !== task.id);
          this.saveState();
        }
      }
    }
  }

  private async resolveLessonPageStream(lessonUrl: string): Promise<string | null> {
    try {
      const res = await fetch(lessonUrl);
      if (!res.ok) return null;
      const html = await res.text();

      // Look for HLS .m3u8, Loom, Vimeo, or YouTube URLs in page source or Next data
      const m3u8Match = html.match(/https?:\/\/[^"'\\s>]+\.m3u8[^"'\\s>]*/i);
      if (m3u8Match) return m3u8Match[0].replace(/\\u0026/g, '&');

      const loomMatch = html.match(/https?:\/\/(?:www\.)?loom\.com\/(?:share|embed)\/[a-zA-Z0-9_-]+/i);
      if (loomMatch) {
        const resolved = await providerRegistry.resolveMedia(loomMatch[0]);
        if (resolved.qualities[0]?.streamUrl) return resolved.qualities[0].streamUrl;
      }

      const vimeoMatch = html.match(/https?:\/\/(?:player\.)?vimeo\.com\/(?:video\/)?[0-9]+/i);
      if (vimeoMatch) {
        const resolved = await providerRegistry.resolveMedia(vimeoMatch[0]);
        if (resolved.qualities[0]?.streamUrl) return resolved.qualities[0].streamUrl;
      }

      const mp4Match = html.match(/https?:\/\/[^"'\\s>]+\.mp4[^"'\\s>]*/i);
      if (mp4Match) return mp4Match[0].replace(/\\u0026/g, '&');
    } catch {
      // Fallback
    }
    return null;
  }

  private async checkOffscreenCleanup(): Promise<void> {
    const hasActiveHls = this.state.activeTaskIds.some(
      (id) => this.state.tasks[id]?.status === 'processing'
    );
    if (!hasActiveHls) {
      await OffscreenManager.closeDocument().catch(() => {});
    }
  }

  private notifyIfAllCompleted(): void {
    const total = Object.keys(this.state.tasks).length;
    const remaining = Object.values(this.state.tasks).filter(
      (t) => t.status === 'queued' || t.status === 'downloading' || t.status === 'processing'
    ).length;

    if (total > 0 && remaining === 0) {
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: 'assets/icon.png',
        title: '🎉 Descarga Completada',
        message: `Todas las ${total} descargas de Skool han finalizado con éxito.`,
        priority: 2,
      });
    }
  }

  private saveState(): void {
    chrome.storage.local.set({ [this.storageKey]: this.state });
    this.broadcast({ type: 'QUEUE_STATE_CHANGED', payload: this.state });
  }

  private broadcast(msg: ExtensionMessage): void {
    chrome.runtime.sendMessage(msg).catch(() => {});
  }
}
