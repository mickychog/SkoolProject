/**
 * Background Service Worker for Skool Downloader
 * Follows: docs/specs/02_ARCHITECTURE_SPEC.md & 03_DATA_MODELS_AND_CONTRACTS.md
 */

import { ExtensionMessage } from '@/types/messages';
import { QueueManager } from './queue-manager';

console.log('[Skool Downloader] Background Service Worker started.');

const queueManager = new QueueManager();

// Configure declarativeNetRequest dynamic rules to bypass 403 Forbidden on CDNs/S3
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
            {
              header: 'Origin',
              operation: chrome.declarativeNetRequest.HeaderOperation.SET,
              value: 'https://www.skool.com',
            },
          ],
        },
        condition: {
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
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            let tab = tabs[0];
            if (!tab?.url?.includes('skool.com')) {
              const skoolTabs = await chrome.tabs.query({ url: '*://*.skool.com/*' });
              if (skoolTabs.length > 0) tab = skoolTabs[0];
            }
            if (tab?.id) {
              const res = await chrome.tabs.sendMessage(tab.id, {
                type: 'TAB_FETCH_BLOB',
                payload: message.payload,
              });
              sendResponse(res);
            } else {
              sendResponse({ success: false, error: 'No active Skool tab found' });
            }
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
