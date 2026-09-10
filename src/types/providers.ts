/**
 * Media Provider Adapter Specification and Types.
 * Strategy pattern interface for video extractors.
 */

import { MediaProviderType, VideoQualityOption } from './course';
export type { MediaProviderType, VideoQualityOption };

export interface ResolveOptions {
  headers?: Record<string, string>;
  referer?: string;
  cookies?: string;
}

export interface StreamResolutionResult {
  provider: MediaProviderType;
  title?: string;
  posterUrl?: string;
  durationSeconds?: number;
  qualities: VideoQualityOption[];
}

export interface MediaProviderAdapter {
  readonly providerType: MediaProviderType;
  readonly providerName: string;

  /**
   * Evaluates if this adapter can process the given URL or DOM element metadata.
   */
  canHandle(sourceUrl: string, elementMeta?: Record<string, unknown>): boolean;

  /**
   * Resolves the available video streams and qualities for the media.
   */
  resolveStream(
    sourceUrl: string,
    elementMeta?: Record<string, unknown>,
    options?: ResolveOptions
  ): Promise<StreamResolutionResult>;
}
