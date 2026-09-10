/**
 * Content Script Entrypoint for Skool Downloader
 * Follows: docs/specs/02_ARCHITECTURE_SPEC.md
 */

import { ExtensionMessage } from '@/types/messages';
import { LessonScanner } from './lesson-scanner';
import { CourseScanner } from './course-scanner';

console.log('[Skool Downloader] Content script loaded on Skool.com');

// Listen for messages from Popup or Background
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'SCAN_ACTIVE_LESSON': {
        LessonScanner.scan()
          .then((lesson) => {
            if (lesson) {
              sendResponse({ type: 'LESSON_SCANNED_SUCCESS', payload: lesson });
            } else {
              sendResponse({
                type: 'SCAN_ERROR',
                payload: { message: 'No se detectó una lección activa de Skool en la página actual.' },
              });
            }
          })
          .catch((err) => {
            sendResponse({
              type: 'SCAN_ERROR',
              payload: { message: err instanceof Error ? err.message : 'Error al escanear lección.' },
            });
          });
        return true;
      }

      case 'SCAN_FULL_COURSE': {
        try {
          const course = CourseScanner.scanHierarchy();
          if (course) {
            sendResponse({ type: 'COURSE_SCANNED_SUCCESS', payload: course });
          } else {
            sendResponse({
              type: 'SCAN_ERROR',
              payload: { message: 'No se pudo escanear la estructura del curso.' },
            });
          }
        } catch (err) {
          sendResponse({
            type: 'SCAN_ERROR',
            payload: { message: err instanceof Error ? err.message : 'Error al escanear curso.' },
          });
        }
        return true;
      }
    }
  }
);
