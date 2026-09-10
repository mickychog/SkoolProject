/**
 * In-Page Floating Quick Download Widget for Skool Lessons.
 * Follows: docs/specs/01_PRD_REQUIREMENTS_SPEC.md
 */

import { LessonScanner } from './lesson-scanner';
import { buildDownloadPath } from '@/utils/filename';

export class InPageWidget {
  private static WIDGET_ID = 'skool-downloader-floating-widget';

  static mount(): void {
    if (document.getElementById(this.WIDGET_ID)) return;
    if (!window.location.hostname.includes('skool.com')) return;

    const container = document.createElement('div');
    container.id = this.WIDGET_ID;
    container.style.position = 'fixed';
    container.style.bottom = '24px';
    container.style.right = '24px';
    container.style.zIndex = '999999';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '8px';
    container.style.padding = '8px 14px';
    container.style.backgroundColor = '#090d16';
    container.style.color = '#f8fafc';
    container.style.border = '1px solid #3b82f6';
    container.style.borderRadius = '9999px';
    container.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.3)';
    container.style.cursor = 'pointer';
    container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    container.style.fontSize = '12px';
    container.style.fontWeight = '600';
    container.style.transition = 'all 0.2s ease';
    container.style.userSelect = 'none';

    container.innerHTML = `
      <span style="display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:#2563eb;color:#fff;">⬇</span>
      <span>Descargar Lección</span>
    `;

    container.onmouseenter = () => {
      container.style.transform = 'translateY(-2px) scale(1.02)';
      container.style.boxShadow = '0 12px 28px rgba(59, 130, 246, 0.45)';
    };

    container.onmouseleave = () => {
      container.style.transform = 'translateY(0) scale(1)';
      container.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.3)';
    };

    container.onclick = async () => {
      // Check if extension context is still active
      if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
        container.innerHTML = `<span style="color:#fbbf24;">🔄 Recarga la página (F5)</span>`;
        setTimeout(() => InPageWidget.resetButton(container), 3500);
        return;
      }

      container.innerHTML = `<span>⏳ Escaneando...</span>`;
      try {
        const lesson = await LessonScanner.scan();
        if (!lesson) {
          container.innerHTML = `<span>❌ No se detectó lección</span>`;
          setTimeout(() => InPageWidget.resetButton(container), 2500);
          return;
        }

        const tasks: any[] = [];
        const communityName = lesson.communityName || 'Skool';
        const courseTitle = lesson.courseTitle || 'Curso';
        const moduleTitle = lesson.moduleTitle || 'Módulo 01';
        const moduleIndex = lesson.moduleIndex || 1;

        if (lesson.media?.sourceUrl) {
          const path = buildDownloadPath({
            communityName,
            courseTitle,
            moduleIndex,
            moduleTitle,
            lessonIndex: lesson.lessonIndex,
            lessonTitle: lesson.lessonTitle,
            extension: '.mp4',
          });
          const parts = path.split('/');
          const fileName = parts.pop()!;
          tasks.push({
            courseTitle,
            moduleTitle,
            moduleIndex,
            lessonTitle: lesson.lessonTitle,
            lessonIndex: lesson.lessonIndex,
            assetType: 'video',
            title: `${lesson.lessonTitle} (Video)`,
            sourceUrl: lesson.media.sourceUrl,
            suggestedFileName: fileName,
            targetFolder: parts.join('/') + '/',
          });
        }

        lesson.attachments.forEach((att) => {
          const path = buildDownloadPath({
            communityName,
            courseTitle,
            moduleIndex,
            moduleTitle,
            lessonIndex: lesson.lessonIndex,
            lessonTitle: lesson.lessonTitle,
            assetTitle: att.fileName.replace(/\.[^/.]+$/, ''),
            extension: att.fileExtension,
          });
          const parts = path.split('/');
          const fileName = parts.pop()!;
          tasks.push({
            courseTitle,
            moduleTitle,
            moduleIndex,
            lessonTitle: lesson.lessonTitle,
            lessonIndex: lesson.lessonIndex,
            assetType: 'attachment',
            title: att.fileName,
            sourceUrl: att.downloadUrl,
            suggestedFileName: fileName,
            targetFolder: parts.join('/') + '/',
          });
        });

        if (tasks.length === 0) {
          container.innerHTML = `<span>⚠️ Sin video ni adjuntos</span>`;
          setTimeout(() => InPageWidget.resetButton(container), 2500);
          return;
        }

        await chrome.runtime.sendMessage({
          type: 'QUEUE_ADD_TASKS',
          payload: { tasks },
        });

        container.innerHTML = `<span style="color:#34d399;">✓ ¡${tasks.length} en cola!</span>`;
        setTimeout(() => InPageWidget.resetButton(container), 3000);
      } catch (err: unknown) {
        const isContextInvalid =
          (err instanceof Error &&
            (err.message.includes('Extension context invalidated') ||
              err.message.includes('context invalidated'))) ||
          !chrome.runtime?.id;

        if (isContextInvalid) {
          container.innerHTML = `<span style="color:#fbbf24;">🔄 Recarga la página (F5)</span>`;
        } else {
          console.warn('[Skool Downloader] InPageWidget error:', err);
          container.innerHTML = `<span style="color:#f87171;">❌ Error al encolar</span>`;
        }
        setTimeout(() => InPageWidget.resetButton(container), 3500);
      }
    };

    document.body.appendChild(container);
  }

  private static resetButton(container: HTMLElement): void {
    container.innerHTML = `
      <span style="display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:#2563eb;color:#fff;">⬇</span>
      <span>Descargar Lección</span>
    `;
  }
}
