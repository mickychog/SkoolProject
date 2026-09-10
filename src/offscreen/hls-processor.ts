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

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('#EXTINF:')) {
        const durMatch = line.match(/#EXTINF:([\d.]+)/);
        if (durMatch) {
          currentDuration = parseFloat(durMatch[1]);
        }
      } else if (line && !line.startsWith('#')) {
        let segmentUrl = line;
        if (!segmentUrl.startsWith('http')) {
          const urlObj = new URL(line, playlistBaseUrl);
          segmentUrl = urlObj.toString();
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
              bestUri = nextLine.startsWith('http') ? nextLine : new URL(nextLine, baseUrl).toString();
            }
            break;
          }
        }
      }
    }

    return bestUri;
  }

  /**
   * Downloads all segments sequentially with retry logic and reports progress
   */
  static async downloadAndAssemble(
    manifestUrl: string,
    onProgress?: (percent: number, current: number, total: number) => void
  ): Promise<Blob> {
    // 1. Fetch playlist
    const res = await fetch(manifestUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch media playlist: HTTP ${res.status}`);
    }
    let manifestText = await res.text();
    let targetPlaylistUrl = manifestUrl;

    // If it's a master playlist, fetch the highest quality variant
    if (manifestText.includes('#EXT-X-STREAM-INF')) {
      const bestVariantUrl = this.parseBestQualityFromMaster(manifestText, manifestUrl);
      if (bestVariantUrl) {
        targetPlaylistUrl = bestVariantUrl;
        const variantRes = await fetch(bestVariantUrl);
        if (variantRes.ok) {
          manifestText = await variantRes.text();
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
            throw new Error(`Failed to download segment ${i + 1}/${segments.length} after 3 attempts.`);
          }
          // Exponential backoff
          await new Promise((r) => setTimeout(r, 500 * attempts));
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
