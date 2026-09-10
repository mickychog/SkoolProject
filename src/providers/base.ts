/**
 * Base classes and common helpers for Media Provider Adapters.
 * Following Spec: docs/specs/02_ARCHITECTURE_SPEC.md
 */

import { MediaProviderAdapter, MediaProviderType, StreamResolutionResult, ResolveOptions } from '@/types/providers';

export abstract class BaseMediaProviderAdapter implements MediaProviderAdapter {
  abstract readonly providerType: MediaProviderType;
  abstract readonly providerName: string;

  abstract canHandle(sourceUrl: string, elementMeta?: Record<string, unknown>): boolean;

  abstract resolveStream(
    sourceUrl: string,
    elementMeta?: Record<string, unknown>,
    options?: ResolveOptions
  ): Promise<StreamResolutionResult>;

  /**
   * Helper to perform safe fetch requests with error handling
   */
  protected async fetchSafe(url: string, init?: RequestInit): Promise<Response> {
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return res;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to fetch from ${this.providerName} (${url}): ${msg}`);
    }
  }
}
