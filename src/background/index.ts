/**
 * Background Service Worker for Skool Downloader
 * Follows: docs/specs/02_ARCHITECTURE_SPEC.md & docs/specs/03_DATA_MODELS_AND_CONTRACTS.md
 */

import { ExtensionMessage } from '@/types/messages';
import { QueueState, DownloadTask } from '@/types/queue';

let queueState: QueueState = {
  tasks: {},
  activeTaskIds: [],
  isPaused: false,
  maxConcurrent: 2,
  defaultQuality: '1080p',
};

// Initialize from storage on worker startup
chrome.storage.local.get(['skool_queue_state'], (result) => {
  if (result.skool_queue_state) {
    queueState = { ...queueState, ...result.skool_queue_state };
  }
});

function saveState() {
  chrome.storage.local.set({ skool_queue_state: queueState });
  broadcastMessage({ type: 'QUEUE_STATE_CHANGED', payload: queueState });
}

function broadcastMessage(msg: ExtensionMessage) {
  chrome.runtime.sendMessage(msg).catch(() => {
    // Popup might not be open, safe to ignore
  });
}

// Listen for messages from Popup, Content Script, or Offscreen
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'QUEUE_GET_STATE': {
        sendResponse({ type: 'QUEUE_STATE_CHANGED', payload: queueState });
        return true;
      }

      case 'QUEUE_PAUSE': {
        queueState.isPaused = true;
        saveState();
        sendResponse({ success: true });
        return true;
      }

      case 'QUEUE_RESUME': {
        queueState.isPaused = false;
        saveState();
        processQueue();
        sendResponse({ success: true });
        return true;
      }

      case 'QUEUE_ADD_TASKS': {
        const now = Date.now();
        message.payload.tasks.forEach((taskData, idx) => {
          const id = `task_${now}_${idx}_${Math.random().toString(36).substring(2, 7)}`;
          const newTask: DownloadTask = {
            ...taskData,
            id,
            status: 'queued',
            progressPercent: 0,
            bytesDownloaded: 0,
            retryCount: 0,
            createdAt: now + idx,
          };
          queueState.tasks[id] = newTask;
        });
        saveState();
        processQueue();
        sendResponse({ success: true, count: message.payload.tasks.length });
        return true;
      }

      case 'QUEUE_CANCEL_TASK': {
        const { taskId } = message.payload;
        if (queueState.tasks[taskId]) {
          queueState.tasks[taskId].status = 'failed';
          queueState.tasks[taskId].error = 'Cancelled by user';
          queueState.activeTaskIds = queueState.activeTaskIds.filter((id) => id !== taskId);
          saveState();
          processQueue();
        }
        sendResponse({ success: true });
        return true;
      }

      case 'QUEUE_CLEAR_COMPLETED': {
        Object.keys(queueState.tasks).forEach((id) => {
          if (queueState.tasks[id].status === 'completed') {
            delete queueState.tasks[id];
          }
        });
        saveState();
        sendResponse({ success: true });
        return true;
      }
    }
  }
);

/**
 * Downloads direct assets (PDFs, direct MP4s) via chrome.downloads API
 */
async function processQueue() {
  if (queueState.isPaused) return;

  const activeCount = queueState.activeTaskIds.length;
  const availableSlots = queueState.maxConcurrent - activeCount;

  if (availableSlots <= 0) return;

  const queuedTasks = Object.values(queueState.tasks)
    .filter((t) => t.status === 'queued')
    .sort((a, b) => a.createdAt - b.createdAt);

  const tasksToStart = queuedTasks.slice(0, availableSlots);

  for (const task of tasksToStart) {
    queueState.activeTaskIds.push(task.id);
    task.status = 'downloading';
    saveState();

    try {
      const downloadId = await chrome.downloads.download({
        url: task.sourceUrl,
        filename: `${task.targetFolder}${task.suggestedFileName}`,
        conflictAction: 'uniquify',
        saveAs: false,
      });

      task.chromeDownloadId = downloadId;
      saveState();
    } catch (err: unknown) {
      task.status = 'failed';
      task.error = err instanceof Error ? err.message : 'Download error';
      queueState.activeTaskIds = queueState.activeTaskIds.filter((id) => id !== task.id);
      saveState();
    }
  }
}

// Track download progress from chrome.downloads API
chrome.downloads.onChanged.addListener((delta) => {
  const matchingTask = Object.values(queueState.tasks).find(
    (t) => t.chromeDownloadId === delta.id
  );

  if (!matchingTask) return;

  if (delta.state) {
    if (delta.state.current === 'complete') {
      matchingTask.status = 'completed';
      matchingTask.progressPercent = 100;
      matchingTask.completedAt = Date.now();
      queueState.activeTaskIds = queueState.activeTaskIds.filter((id) => id !== matchingTask.id);
      saveState();
      processQueue();
    } else if (delta.state.current === 'interrupted') {
      matchingTask.status = 'failed';
      matchingTask.error = delta.error?.current || 'Interrupted';
      queueState.activeTaskIds = queueState.activeTaskIds.filter((id) => id !== matchingTask.id);
      saveState();
      processQueue();
    }
  }
});
