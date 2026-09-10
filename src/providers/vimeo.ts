/**
 * Vimeo Media Provider Adapter
 * Resolves Vimeo video embeds
 */

import { BaseMediaProviderAdapter } from './base';
import { MediaProviderType, StreamResolutionResult, ResolveOptions } from '@/types/providers';
import { VideoQualityOption } from '@/types/course';

export class VimeoAdapter extends BaseMediaProviderAdapter {
  readonly providerType: MediaProviderType = 'vimeo';
  readonly providerName = 'Vimeo Video';

  canHandle(sourceUrl: string): boolean {
    if (!sourceUrl) return false;
    return /vimeo\.com/i.test(sourceUrl);
  }

  extractVimeoId(url: string): string | null {
    const match = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/i);
    return match ? match[1] : null;
  }

  async resolveStream(
    sourceUrl: string,
    _elementMeta?: Record<string, unknown>,
    _options?: ResolveOptions
  ): Promise<StreamResolutionResult> {
    const videoId = this.extractVimeoId(sourceUrl);
    const qualities: VideoQualityOption[] = [];

    try {
      if (videoId) {
        const configUrl = `https://player.vimeo.com/video/${videoId}/config`;
        const res = await this.fetchSafe(configUrl);
        const data = await res.json();

        // Progressive MP4 files
        const progressiveFiles = data.request?.files?.progressive || [];
        for (const file of progressiveFiles) {
          qualities.push({
            qualityLabel: file.quality || `${file.height}p`,
            resolution: file.height && file.width ? { width: file.width, height: file.height } : undefined,
            streamUrl: file.url,
            isHLS: false,
            mimeType: file.mime || 'video/mp4',
          });
        }

        // HLS Stream fallback
        const hlsUrl = data.request?.files?.hls?.default_cdn?.url || data.request?.files?.hls?.cdns?.[0]?.url;
        if (hlsUrl && qualities.length === 0) {
          qualities.push({
            qualityLabel: 'Auto (HLS)',
            streamUrl: hlsUrl,
            isHLS: true,
            mimeType: 'application/x-mpegURL',
          });
        }
      }
    } catch {
      // Fallback
      qualities.push({
        qualityLabel: 'Original',
        streamUrl: sourceUrl,
        isHLS: sourceUrl.includes('.m3u8'),
      });
    }

    return {
      provider: this.providerType,
      title: `Vimeo Video (${videoId || 'unknown'})`,
      qualities,
    };
  }
}
