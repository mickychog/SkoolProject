/**
 * Loom Media Provider Adapter
 * Resolves Loom videos (both direct MP4 and HLS streams)
 */

import { BaseMediaProviderAdapter } from './base';
import { MediaProviderType, StreamResolutionResult, ResolveOptions } from '@/types/providers';
import { VideoQualityOption } from '@/types/course';

export class LoomAdapter extends BaseMediaProviderAdapter {
  readonly providerType: MediaProviderType = 'loom';
  readonly providerName = 'Loom Video';

  canHandle(sourceUrl: string): boolean {
    if (!sourceUrl) return false;
    return /loom\.com\/(share|embed)/i.test(sourceUrl);
  }

  extractLoomId(url: string): string | null {
    const match = url.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9_-]+)/i);
    return match ? match[1] : null;
  }

  async resolveStream(
    sourceUrl: string,
    _elementMeta?: Record<string, unknown>,
    _options?: ResolveOptions
  ): Promise<StreamResolutionResult> {
    const videoId = this.extractLoomId(sourceUrl);
    if (!videoId) {
      throw new Error(`Invalid Loom video URL: ${sourceUrl}`);
    }

    const qualities: VideoQualityOption[] = [];

    try {
      // 1. Try Loom public session endpoint
      const apiUrl = `https://www.loom.com/api/campaigns/sessions/${videoId}/transcoded-url`;
      const res = await this.fetchSafe(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (data.url) {
        qualities.push({
          qualityLabel: 'Original (1080p)',
          streamUrl: data.url,
          isHLS: data.url.includes('.m3u8'),
          mimeType: data.url.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4',
        });
      }
    } catch {
      // 2. Fallback to direct CDN patterns if API is protected
      const fallbackUrl = `https://cdn.loom.com/sessions/transcoded/${videoId}.mp4`;
      qualities.push({
        qualityLabel: 'HD (Direct Stream)',
        streamUrl: fallbackUrl,
        isHLS: false,
        mimeType: 'video/mp4',
      });
    }

    return {
      provider: this.providerType,
      title: `Loom Video (${videoId})`,
      qualities,
    };
  }
}
