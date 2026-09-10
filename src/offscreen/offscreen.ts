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

      const headers: Record<string, string> = {
        Referer: 'https://www.skool.com/',
        Origin: 'https://www.skool.com',
      };

      fetch(url, { headers })
        .then(async (res) => {
          if (res.status === 403 || !res.ok) {
            // Fallback: Query active tab with user's session cookies
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];
            if (tab?.id) {
              const tabRes = await chrome.tabs.sendMessage(tab.id, {
                type: 'TAB_FETCH_BLOB',
                payload: { url },
              });
              if (tabRes?.success && tabRes.dataUrl) {
                const response = await fetch(tabRes.dataUrl);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                chrome.runtime.sendMessage({
                  type: 'OFFSCREEN_HLS_COMPLETED',
                  payload: { taskId, blobUrl },
                });
                return;
              }
            }
            throw new Error(`Error en servidor: HTTP ${res.status} (${res.statusText})`);
          }

          const blob = await res.blob();

          // Check if server returned an XML error page instead of video/file
          if (blob.type.includes('xml') || blob.type.includes('html') || blob.size < 800) {
            const sampleText = await blob.slice(0, 300).text();
            if (
              sampleText.includes('<?xml') ||
              sampleText.includes('<Error>') ||
              sampleText.includes('AccessDenied') ||
              sampleText.includes('NoSuchKey')
            ) {
              throw new Error('El servidor denegó el acceso (Token expirado o AccessDenied).');
            }
          }

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
              error: err instanceof Error ? err.message : 'Error al descargar archivo',
            },
          });
        });

      sendResponse({ status: 'processing_started' });
      return true;
    }
  }
);
