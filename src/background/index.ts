/**
 * Background Service Worker for Skool Downloader
 * Follows: docs/specs/02_ARCHITECTURE_SPEC.md & 03_DATA_MODELS_AND_CONTRACTS.md
 */

import { ExtensionMessage } from '@/types/messages';
import { QueueManager } from './queue-manager';

console.log('[Skool Downloader] Background Service Worker started.');

const queueManager = new QueueManager();

// Configure declarativeNetRequest dynamic rules for skool.com media
if (chrome.declarativeNetRequest) {
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1001],
    addRules: [
      {
        id: 1001,
        priority: 1,
        action: {
          type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
          requestHeaders: [
            {
              header: 'Referer',
              operation: chrome.declarativeNetRequest.HeaderOperation.SET,
              value: 'https://www.skool.com/',
            },
          ],
        },
        condition: {
          urlFilter: '||skool.com',
          resourceTypes: [
            chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
            chrome.declarativeNetRequest.ResourceType.MEDIA,
            chrome.declarativeNetRequest.ResourceType.OTHER,
          ],
        },
      },
    ],
  }).catch((err) => console.error('[DNR] Rule update error:', err));
}

// Listen for messages from Popup, Content Script, or Offscreen Document
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'RELAY_TAB_FETCH_BLOB': {
        (async () => {
          try {
            const { url } = message.payload;
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            let tab = tabs[0];
            if (!tab?.url?.includes('skool.com')) {
              const skoolTabs = await chrome.tabs.query({ url: '*://*.skool.com/*' });
              if (skoolTabs.length > 0) tab = skoolTabs[0];
            }

            // Attempt 1: Fetch via content script in active Skool tab
            if (tab?.id) {
              try {
                const res: any = await chrome.tabs.sendMessage(tab.id, {
                  type: 'TAB_FETCH_BLOB',
                  payload: { url },
                });
                if (res?.success && res.dataUrl) {
                  sendResponse(res);
                  return;
                }
              } catch {
                // Content script unavailable, try background fetch
              }
            }

            // Attempt 2: Background privileged fetch
            const fetchRes = await fetch(url, { credentials: 'include' });
            if (fetchRes.ok) {
              const buffer = await fetchRes.arrayBuffer();
              const bytes = new Uint8Array(buffer);
              let binary = '';
              for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              const base64 = btoa(binary);
              const mimeType = fetchRes.headers.get('content-type') || 'application/octet-stream';
              sendResponse({ success: true, dataUrl: `data:${mimeType};base64,${base64}` });
              return;
            }

            sendResponse({ success: false, error: `Error en servidor: HTTP ${fetchRes.status}` });
          } catch (err: unknown) {
            sendResponse({ success: false, error: err instanceof Error ? err.message : 'Relay failed' });
          }
        })();
        return true;
      }

      case 'QUEUE_GET_STATE': {
        sendResponse({ type: 'QUEUE_STATE_CHANGED', payload: queueManager.getState() });
        return true;
      }

      case 'QUEUE_PAUSE': {
        queueManager.pauseQueue();
        sendResponse({ success: true });
        return true;
      }

      case 'QUEUE_RESUME': {
        queueManager.resumeQueue();
        sendResponse({ success: true });
        return true;
      }

      case 'QUEUE_ADD_TASKS': {
        const count = queueManager.addTasks(message.payload.tasks);
        sendResponse({ success: true, count });
        return true;
      }

      case 'QUEUE_CANCEL_TASK': {
        queueManager.cancelTask(message.payload.taskId);
        sendResponse({ success: true });
        return true;
      }

      case 'QUEUE_REMOVE_TASK': {
        queueManager.removeTask(message.payload.taskId);
        sendResponse({ success: true });
        return true;
      }

      case 'QUEUE_CLEAR_COMPLETED': {
        queueManager.clearCompleted();
        sendResponse({ success: true });
        return true;
      }

      case 'QUEUE_CLEAR_ALL': {
        queueManager.clearAll();
        sendResponse({ success: true });
        return true;
      }

      case 'QUEUE_RETRY_FAILED': {
        queueManager.retryFailed();
        sendResponse({ success: true });
        return true;
      }

      // Handle Offscreen Events
      case 'OFFSCREEN_HLS_PROGRESS': {
        queueManager.updateTaskProgress(message.payload.taskId, message.payload.percent);
        return false;
      }

      case 'OFFSCREEN_HLS_COMPLETED': {
        queueManager.handleHlsCompleted(message.payload.taskId, message.payload.blobUrl);
        return false;
      }

      case 'OFFSCREEN_HLS_FAILED': {
        queueManager.handleHlsFailed(message.payload.taskId, message.payload.error);
        return false;
      }
    }
  }
);

// Listen for download completion or errors from Chrome Downloads API
chrome.downloads.onChanged.addListener((delta) => {
  queueManager.handleChromeDownloadChange(delta);
});
