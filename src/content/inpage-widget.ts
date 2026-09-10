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
    if (!window.location.href.includes('/classroom/')) return;

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
      container.innerHTML = `<span>⏳ Escaneando...</span>`;
      try {
        const lesson = await LessonScanner.scan();
        if (!lesson) {
          container.innerHTML = `<span>❌ No se detectó lección</span>`;
          setTimeout(() => InPageWidget.resetButton(container), 2500);
          return;
        }

        const tasks: any[] = [];
        if (lesson.media) {
          const path = buildDownloadPath({
            communityName: 'Skool',
            courseTitle: document.title.replace('· Skool', '').trim(),
            moduleIndex: 1,
            moduleTitle: 'Module 01',
            lessonIndex: lesson.lessonIndex,
            lessonTitle: lesson.lessonTitle,
            extension: '.mp4',
          });
          const parts = path.split('/');
          const fileName = parts.pop()!;
          tasks.push({
            courseTitle: document.title.replace('· Skool', '').trim(),
            moduleTitle: 'Module 01',
            moduleIndex: 1,
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
            communityName: 'Skool',
            courseTitle: document.title.replace('· Skool', '').trim(),
            moduleIndex: 1,
            moduleTitle: 'Module 01',
            lessonIndex: lesson.lessonIndex,
            lessonTitle: lesson.lessonTitle,
            assetTitle: att.fileName.replace(/\.[^/.]+$/, ''),
            extension: att.fileExtension,
          });
          const parts = path.split('/');
          const fileName = parts.pop()!;
          tasks.push({
            courseTitle: document.title.replace('· Skool', '').trim(),
            moduleTitle: 'Module 01',
            moduleIndex: 1,
            lessonTitle: lesson.lessonTitle,
            lessonIndex: lesson.lessonIndex,
            assetType: 'attachment',
            title: att.fileName,
            sourceUrl: att.downloadUrl,
            suggestedFileName: fileName,
            targetFolder: parts.join('/') + '/',
          });
        });

        chrome.runtime.sendMessage({
          type: 'QUEUE_ADD_TASKS',
          payload: { tasks },
        });

        container.innerHTML = `<span style="color:#34d399;">✓ ¡${tasks.length} elementos encolados!</span>`;
        setTimeout(() => InPageWidget.resetButton(container), 3000);
      } catch (err) {
        container.innerHTML = `<span style="color:#f87171;">❌ Error</span>`;
        setTimeout(() => InPageWidget.resetButton(container), 2500);
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
