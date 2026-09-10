/**
 * Content Script Entrypoint for Skool Downloader
 * Follows: docs/specs/02_ARCHITECTURE_SPEC.md
 */

import { ExtensionMessage } from '@/types/messages';
import { LessonScanner } from './lesson-scanner';
import { CourseScanner } from './course-scanner';
import { InPageWidget } from './inpage-widget';

console.log('[Skool Downloader] Content script loaded on Skool.com');

// Mount in-page floating quick download action
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => InPageWidget.mount());
} else {
  InPageWidget.mount();
}

// Observe URL changes in SPA and notify extension popup/background
let lastUrl = window.location.href;
const handleUrlChange = () => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    InPageWidget.mount();
    try {
      chrome.runtime.sendMessage({
        type: 'TAB_URL_CHANGED',
        payload: { url: window.location.href },
      }).catch(() => {});
    } catch {
      // Ignore context invalidated errors
    }
  }
};

window.addEventListener('popstate', handleUrlChange);

// Hook into history API for instant SPA detection
const originalPushState = history.pushState;
history.pushState = function (...args) {
  const ret = originalPushState.apply(this, args);
  handleUrlChange();
  return ret;
};

const originalReplaceState = history.replaceState;
history.replaceState = function (...args) {
  const ret = originalReplaceState.apply(this, args);
  handleUrlChange();
  return ret;
};

const observer = new MutationObserver(() => {
  handleUrlChange();
});
observer.observe(document, { subtree: true, childList: true });

// Periodic check for fast React SPA router transitions
setInterval(handleUrlChange, 350);

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

      case 'TAB_FETCH_BLOB': {
        const { url } = message.payload;
        const isSameOrigin = url.startsWith(window.location.origin) || url.includes('skool.com');
        fetch(url, isSameOrigin ? { credentials: 'include' } : { mode: 'cors' })
          .then(async (res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const reader = new FileReader();
            reader.onloadend = () => {
              sendResponse({ success: true, dataUrl: reader.result });
            };
            reader.readAsDataURL(blob);
          })
          .catch((err) => {
            sendResponse({ success: false, error: err instanceof Error ? err.message : 'Fetch failed' });
          });
        return true;
      }
    }
  }
);
