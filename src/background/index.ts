/**
 * Background Service Worker for Skool Downloader
 * Follows: docs/specs/02_ARCHITECTURE_SPEC.md & 03_DATA_MODELS_AND_CONTRACTS.md
 */

import { ExtensionMessage } from '@/types/messages';
import { QueueManager } from './queue-manager';

console.log('[Skool Downloader] Background Service Worker started.');

const queueManager = new QueueManager();

// Listen for messages from Popup, Content Script, or Offscreen Document
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    switch (message.type) {
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

      case 'QUEUE_CLEAR_COMPLETED': {
        queueManager.clearCompleted();
        sendResponse({ success: true });
        return true;
      }

      case 'QUEUE_RETRY_FAILED': {
        queueManager.retryFailed();
        sendResponse({ success: true });
        return true;
      }

      // Handle Offscreen HLS Events
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
