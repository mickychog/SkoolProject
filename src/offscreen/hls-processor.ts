/**
 * HLS Segment Fetcher and Stream Processor for Offscreen Document.
 * Follows: docs/specs/02_ARCHITECTURE_SPEC.md & 03_DATA_MODELS_AND_CONTRACTS.md
 */

export interface HlsSegment {
  url: string;
  duration: number;
}

export class HlsProcessor {
  /**
   * Parses a media playlist (single quality) and extracts segment URIs
   */
  static parseMediaPlaylist(content: string, playlistBaseUrl: string): HlsSegment[] {
    const lines = content.split('\n');
    const segments: HlsSegment[] = [];
    let currentDuration = 0;

    let baseSearch = '';
    try {
      const baseObj = new URL(playlistBaseUrl);
      baseSearch = baseObj.search;
    } catch {}

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('#EXTINF:')) {
        const durMatch = line.match(/#EXTINF:([\d.]+)/);
        if (durMatch) {
          currentDuration = parseFloat(durMatch[1]);
        }
      } else if (line && !line.startsWith('#')) {
        let segmentUrl = line;
        try {
          if (!segmentUrl.startsWith('http')) {
            const urlObj = new URL(line, playlistBaseUrl);
            if (!urlObj.search && baseSearch) {
              urlObj.search = baseSearch;
            }
            segmentUrl = urlObj.toString();
          } else {
            const urlObj = new URL(segmentUrl);
            if (!urlObj.search && baseSearch) {
              urlObj.search = baseSearch;
              segmentUrl = urlObj.toString();
            }
          }
        } catch {
          // Fallback to raw line
        }

        segments.push({
          url: segmentUrl,
          duration: currentDuration,
        });

        currentDuration = 0;
      }
    }

    return segments;
  }

  /**
   * Parses master playlist and selects best quality media playlist URI
   */
  static parseBestQualityFromMaster(masterContent: string, baseUrl: string): string | null {
    const lines = masterContent.split('\n');
    let bestUri: string | null = null;
    let maxBandwidth = 0;

    let baseSearch = '';
    try {
      const baseObj = new URL(baseUrl);
      baseSearch = baseObj.search;
    } catch {}

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
        const bandwidth = bwMatch ? parseInt(bwMatch[1]) : 0;

        // Find the next line with URI
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          if (nextLine && !nextLine.startsWith('#')) {
            if (bandwidth >= maxBandwidth || !bestUri) {
              maxBandwidth = bandwidth;
              try {
                let resolved = nextLine.startsWith('http') ? nextLine : new URL(nextLine, baseUrl).toString();
                const resolvedObj = new URL(resolved);
                if (!resolvedObj.search && baseSearch) {
                  resolvedObj.search = baseSearch;
                  resolved = resolvedObj.toString();
                }
                bestUri = resolved;
              } catch {
                bestUri = nextLine;
              }
            }
            break;
          }
        }
      }
    }

    return bestUri;
  }

  /**
   * Helper to fetch text with fallback
   */
  static async fetchText(url: string): Promise<string> {
    const res = await fetch(url).catch(() => null);
    if (res && res.ok) {
      return res.text();
    }
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      const tabRes: any = await chrome.runtime.sendMessage({
        type: 'RELAY_TAB_FETCH_BLOB',
        payload: { url },
      }).catch(() => null);
      if (tabRes?.success && tabRes.dataUrl) {
        const response = await fetch(tabRes.dataUrl);
        return response.text();
      }
    }
    throw new Error(`Failed to fetch media playlist: HTTP ${res?.status || 'Error'}`);
  }

  /**
   * Downloads all segments sequentially with retry logic and reports progress
   */
  static async downloadAndAssemble(
    manifestUrl: string,
    onProgress?: (percent: number, current: number, total: number) => void
  ): Promise<Blob> {
    // 1. Fetch playlist
    let manifestText = await this.fetchText(manifestUrl);
    let targetPlaylistUrl = manifestUrl;

    // If it's a master playlist, fetch the highest quality variant
    if (manifestText.includes('#EXT-X-STREAM-INF')) {
      const bestVariantUrl = this.parseBestQualityFromMaster(manifestText, manifestUrl);
      if (bestVariantUrl) {
        targetPlaylistUrl = bestVariantUrl;
        try {
          manifestText = await this.fetchText(bestVariantUrl);
        } catch {
          // Keep master text if variant fails
        }
      }
    }

    const segments = this.parseMediaPlaylist(manifestText, targetPlaylistUrl);

    if (segments.length === 0) {
      throw new Error('No media segments found in HLS playlist.');
    }

    const chunks: ArrayBuffer[] = [];

    // 2. Fetch segments
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      let chunk: ArrayBuffer | null = null;
      let attempts = 0;

      while (!chunk && attempts < 3) {
        try {
          attempts++;
          const segRes = await fetch(seg.url);
          if (!segRes.ok) throw new Error(`HTTP ${segRes.status}`);
          chunk = await segRes.arrayBuffer();
        } catch {
          if (attempts >= 3) {
            // Last attempt via tab relay
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
              const tabRes: any = await chrome.runtime.sendMessage({
                type: 'RELAY_TAB_FETCH_BLOB',
                payload: { url: seg.url },
              }).catch(() => null);
              if (tabRes?.success && tabRes.dataUrl) {
                const response = await fetch(tabRes.dataUrl);
                chunk = await response.arrayBuffer();
                break;
              }
            }
            throw new Error(`Failed to download segment ${i + 1}/${segments.length} after 3 attempts.`);
          }
          // Exponential backoff
          await new Promise((r) => setTimeout(r, 400 * attempts));
        }
      }

      if (chunk) {
        chunks.push(chunk);
      }

      const percent = Math.round(((i + 1) / segments.length) * 100);
      onProgress?.(percent, i + 1, segments.length);
    }

    // 3. Assemble into a single Blob
    return new Blob(chunks, { type: 'video/mp4' });
  }
}
