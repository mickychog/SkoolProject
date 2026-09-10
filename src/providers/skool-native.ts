/**
 * Skool Native Video Provider Adapter
 * Resolves Skool HLS Master Playlists (.m3u8) and individual quality streams.
 */

import { BaseMediaProviderAdapter } from './base';
import { MediaProviderType, StreamResolutionResult, ResolveOptions } from '@/types/providers';
import { VideoQualityOption } from '@/types/course';

export class SkoolNativeAdapter extends BaseMediaProviderAdapter {
  readonly providerType: MediaProviderType = 'skool_native';
  readonly providerName = 'Skool Native Video';

  canHandle(sourceUrl: string): boolean {
    if (!sourceUrl) return false;
    return (
      sourceUrl.includes('.m3u8') ||
      sourceUrl.includes('stream.video.skool.com') ||
      sourceUrl.includes('video.skool.com') ||
      sourceUrl.includes('skool.com/api/video')
    );
  }

  /**
   * Parses an HLS Master Playlist content string and extracts stream options with resolutions
   */
  parseHlsMasterPlaylist(masterContent: string, baseUrl: string): VideoQualityOption[] {
    const lines = masterContent.split('\n');
    const qualities: VideoQualityOption[] = [];

    let currentRes: { width: number; height: number } | undefined;
    let currentBitrate: number | undefined;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        // Parse resolution (e.g. RESOLUTION=1920x1080)
        const resMatch = line.match(/RESOLUTION=(\d+)x(\d+)/i);
        if (resMatch) {
          currentRes = { width: parseInt(resMatch[1]), height: parseInt(resMatch[2]) };
        }

        // Parse bandwidth/bitrate (e.g. BANDWIDTH=5000000)
        const bwMatch = line.match(/BANDWIDTH=(\d+)/i);
        if (bwMatch) {
          currentBitrate = parseInt(bwMatch[1]);
        }
      } else if (line && !line.startsWith('#')) {
        // This line is the stream URI
        let streamUrl = line;
        try {
          const baseObj = new URL(baseUrl);
          if (!streamUrl.startsWith('http')) {
            const urlObj = new URL(line, baseUrl);
            if (!urlObj.search && baseObj.search) {
              urlObj.search = baseObj.search;
            }
            streamUrl = urlObj.toString();
          } else {
            const urlObj = new URL(streamUrl);
            if (!urlObj.search && baseObj.search) {
              urlObj.search = baseObj.search;
              streamUrl = urlObj.toString();
            }
          }
        } catch {
          // Fallback to raw line
        }

        const height = currentRes?.height || (currentBitrate ? Math.round(currentBitrate / 1000) : 720);
        const qualityLabel = currentRes ? `${currentRes.height}p` : `${height}p`;

        qualities.push({
          qualityLabel,
          resolution: currentRes,
          bitrate: currentBitrate,
          streamUrl,
          isHLS: true,
          mimeType: 'application/x-mpegURL',
        });

        currentRes = undefined;
        currentBitrate = undefined;
      }
    }

    // Sort qualities descending by resolution/bitrate
    qualities.sort((a, b) => (b.resolution?.height || 0) - (a.resolution?.height || 0));

    return qualities;
  }

  async resolveStream(
    sourceUrl: string,
    _elementMeta?: Record<string, unknown>,
    _options?: ResolveOptions
  ): Promise<StreamResolutionResult> {
    const qualities: VideoQualityOption[] = [];

    try {
      if (sourceUrl.includes('.m3u8')) {
        const res = await this.fetchSafe(sourceUrl);
        const manifestText = await res.text();

        // Check if it's a master playlist or media playlist
        if (manifestText.includes('#EXT-X-STREAM-INF')) {
          const parsed = this.parseHlsMasterPlaylist(manifestText, sourceUrl);
          qualities.push(...parsed);
        } else {
          // Direct media playlist
          qualities.push({
            qualityLabel: 'Original (HLS)',
            streamUrl: sourceUrl,
            isHLS: true,
            mimeType: 'application/x-mpegURL',
          });
        }
      }
    } catch {
      // If fetching manifest fails, provide raw stream
      qualities.push({
        qualityLabel: 'Auto (HLS Stream)',
        streamUrl: sourceUrl,
        isHLS: true,
        mimeType: 'application/x-mpegURL',
      });
    }

    if (qualities.length === 0) {
      qualities.push({
        qualityLabel: 'Auto',
        streamUrl: sourceUrl,
        isHLS: true,
        mimeType: 'application/x-mpegURL',
      });
    }

    return {
      provider: this.providerType,
      title: 'Skool Native Video',
      qualities,
    };
  }
}
