/**
 * Offscreen Document Worker for Processing HLS/DASH Streaming Chunks and Direct File Blobs
 * Follows: docs/specs/02_ARCHITECTURE_SPEC.md & 03_DATA_MODELS_AND_CONTRACTS.md
 */

import { ExtensionMessage } from '@/types/messages';
import { HlsProcessor } from './hls-processor';

console.log('[Skool Downloader] Offscreen media worker initialized.');

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    // 1. Process HLS Stream (.m3u8)
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

    // 2. Process Direct File / Video Stream (MP4, S3, CloudFront, PDF, Attachments)
    if (message.type === 'OFFSCREEN_START_DIRECT_DOWNLOAD') {
      const { taskId, url } = message.payload;
      console.log(`[Offscreen] Processing direct file Task ${taskId} from ${url}`);

      const fetchDirect = async () => {
        let res = await fetch(url).catch(() => null);

        // If 403 or network failure, try relay fetch through authenticated Skool tab
        if (!res || !res.ok || res.status === 403) {
          try {
            const tabRes: any = await chrome.runtime.sendMessage({
              type: 'RELAY_TAB_FETCH_BLOB',
              payload: { url },
            });
            if (tabRes?.success && tabRes.dataUrl) {
              const response = await fetch(tabRes.dataUrl);
              const blob = await response.blob();
              return URL.createObjectURL(blob);
            }
          } catch {
            // Ignore
          }
          if (res) {
            throw new Error(`Error en servidor: HTTP ${res.status} (${res.statusText})`);
          }
          throw new Error('No se pudo descargar el archivo.');
        }

        let blob = await res.blob();

        // Check if server returned an XML error page instead of video/file
        if (blob.type.includes('xml') || (blob.type.includes('html') && blob.size < 5000)) {
          const sampleText = await blob.slice(0, 300).text();
          if (
            sampleText.includes('<?xml') ||
            sampleText.includes('<Error>') ||
            sampleText.includes('AccessDenied') ||
            sampleText.includes('NoSuchKey')
          ) {
            // Retry via relay tab
            const tabRes: any = await chrome.runtime.sendMessage({
              type: 'RELAY_TAB_FETCH_BLOB',
              payload: { url },
            });
            if (tabRes?.success && tabRes.dataUrl) {
              const response = await fetch(tabRes.dataUrl);
              blob = await response.blob();
            } else {
              throw new Error('El servidor denegó el acceso (Token expirado o AccessDenied).');
            }
          }
        }

        return URL.createObjectURL(blob);
      };

      fetchDirect()
        .then((blobUrl) => {
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
              error: err instanceof Error ? err.message : 'Error al descargar archivo',
            },
          });
        });

      sendResponse({ status: 'processing_started' });
      return true;
    }
  }
);
