/**
 * Offscreen Document Worker for Processing HLS/DASH Streaming Chunks
 * Follows: docs/specs/02_ARCHITECTURE_SPEC.md
 */

import { ExtensionMessage } from '@/types/messages';

console.log('[Skool Downloader] Offscreen media worker initialized.');

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    if (message.type === 'OFFSCREEN_START_HLS_DOWNLOAD') {
      const { taskId, manifestUrl } = message.payload;
      console.log(`[Offscreen] Starting HLS task ${taskId} from ${manifestUrl}`);
      // Stub for HLS segment processing
      sendResponse({ status: 'processing_started' });
      return true;
    }
  }
);
