/**
 * Offscreen Document Worker for Processing HLS/DASH Streaming Chunks
 * Follows: docs/specs/02_ARCHITECTURE_SPEC.md & 03_DATA_MODELS_AND_CONTRACTS.md
 */

import { ExtensionMessage } from '@/types/messages';
import { HlsProcessor } from './hls-processor';

console.log('[Skool Downloader] Offscreen media worker initialized.');

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    if (message.type === 'OFFSCREEN_START_HLS_DOWNLOAD') {
      const { taskId, manifestUrl } = message.payload;
      console.log(`[Offscreen] Processing HLS Task ${taskId} from ${manifestUrl}`);

      HlsProcessor.downloadAndAssemble(manifestUrl, (percent, current, total) => {
        chrome.runtime.sendMessage({
          type: 'OFFSCREEN_HLS_PROGRESS',
          payload: {
            taskId,
            percent,
            chunksProcessed: current,
            totalChunks: total,
          },
        }).catch(() => {});
      })
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          chrome.runtime.sendMessage({
            type: 'OFFSCREEN_HLS_COMPLETED',
            payload: {
              taskId,
              blobUrl,
            },
          });
        })
        .catch((err) => {
          chrome.runtime.sendMessage({
            type: 'OFFSCREEN_HLS_FAILED',
            payload: {
              taskId,
              error: err instanceof Error ? err.message : 'HLS stream processing failed',
            },
          });
        });

      sendResponse({ status: 'processing_started' });
      return true;
    }
  }
);
