/**
 * Provider Registry and Resolver Factory (Strategy Pattern)
 * Follows: docs/specs/02_ARCHITECTURE_SPEC.md
 */

import { MediaProviderAdapter, StreamResolutionResult, ResolveOptions } from '@/types/providers';
import { LoomAdapter } from './loom';
import { SkoolNativeAdapter } from './skool-native';
import { VimeoAdapter } from './vimeo';
import { YouTubeAdapter } from './youtube';

export class ProviderRegistry {
  private adapters: MediaProviderAdapter[] = [];

  constructor() {
    this.register(new SkoolNativeAdapter());
    this.register(new LoomAdapter());
    this.register(new VimeoAdapter());
    this.register(new YouTubeAdapter());
  }

  register(adapter: MediaProviderAdapter): void {
    this.adapters.push(adapter);
  }

  findAdapter(sourceUrl: string, elementMeta?: Record<string, unknown>): MediaProviderAdapter | null {
    for (const adapter of this.adapters) {
      if (adapter.canHandle(sourceUrl, elementMeta)) {
        return adapter;
      }
    }
    return null;
  }

  async resolveMedia(
    sourceUrl: string,
    elementMeta?: Record<string, unknown>,
    options?: ResolveOptions
  ): Promise<StreamResolutionResult> {
    const adapter = this.findAdapter(sourceUrl, elementMeta);
    if (!adapter) {
      // Default fallback
      return {
        provider: 'unknown',
        title: 'Unknown Media',
        qualities: [
          {
            qualityLabel: 'Original',
            streamUrl: sourceUrl,
            isHLS: sourceUrl.includes('.m3u8'),
          },
        ],
      };
    }
    return adapter.resolveStream(sourceUrl, elementMeta, options);
  }
}

export const providerRegistry = new ProviderRegistry();
export * from './base';
export * from './loom';
export * from './skool-native';
export * from './vimeo';
export * from './youtube';
