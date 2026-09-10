/**
 * YouTube Media Provider Adapter
 * Resolves YouTube video embeds and links
 */

import { BaseMediaProviderAdapter } from './base';
import { MediaProviderType, StreamResolutionResult, ResolveOptions } from '@/types/providers';
import { VideoQualityOption } from '@/types/course';

export class YouTubeAdapter extends BaseMediaProviderAdapter {
  readonly providerType: MediaProviderType = 'youtube';
  readonly providerName = 'YouTube Video';

  canHandle(sourceUrl: string): boolean {
    if (!sourceUrl) return false;
    return /youtube\.com|youtu\.be/i.test(sourceUrl);
  }

  extractYouTubeId(url: string): string | null {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i);
    return match ? match[1] : null;
  }

  async resolveStream(
    sourceUrl: string,
    _elementMeta?: Record<string, unknown>,
    _options?: ResolveOptions
  ): Promise<StreamResolutionResult> {
    const videoId = this.extractYouTubeId(sourceUrl);
    const qualities: VideoQualityOption[] = [];

    // YouTube requires external processing or embed link presentation
    qualities.push({
      qualityLabel: 'Web Stream',
      streamUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : sourceUrl,
      isHLS: false,
    });

    return {
      provider: this.providerType,
      title: `YouTube Video (${videoId || 'unknown'})`,
      qualities,
    };
  }
}
