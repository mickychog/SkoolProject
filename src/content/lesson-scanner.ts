/**
 * Lesson Scanner: DOM and Media extractor for the active Skool lesson page.
 * Follows: docs/specs/02_ARCHITECTURE_SPEC.md
 */

import { CourseLesson, MediaAsset } from '@/types/course';
import { providerRegistry } from '@/providers';

export class LessonScanner {
  /**
   * Scans the active document for lesson details, media, and attachments
   */
  static async scan(): Promise<CourseLesson | null> {
    const currentUrl = window.location.href;
    if (!currentUrl.includes('/classroom/')) {
      return null;
    }

    const lessonTitle = this.extractLessonTitle();
    const lessonId = this.extractLessonId(currentUrl);
    const media = await this.extractMedia();
    const attachments = this.extractAttachments();

    return {
      lessonId,
      lessonIndex: 1,
      lessonTitle,
      url: currentUrl,
      media: media || undefined,
      attachments,
    };
  }

  static extractLessonTitle(): string {
    // Check main headings or data-testid
    const heading = document.querySelector<HTMLElement>(
      '[data-testid="lesson-title"], h1, h2, [class*="LessonTitle"], [class*="title"]'
    );
    if (heading && heading.textContent?.trim()) {
      return heading.textContent.trim();
    }
    return document.title.replace('· Skool', '').trim() || 'Untitled Lesson';
  }

  static extractLessonId(url: string): string {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    const mdParam = urlObj.searchParams.get('md');
    if (mdParam) {
      return mdParam;
    }
    return pathParts[pathParts.length - 1] || `lesson_${Date.now()}`;
  }

  /**
   * Detects embedded video players (Native HLS, Loom, Vimeo, YouTube, Wistia)
   */
  static async extractMedia(): Promise<MediaAsset | null> {
    // 1. Check for native <video> elements
    const videoEl = document.querySelector<HTMLVideoElement>('video');
    if (videoEl && (videoEl.src || videoEl.querySelector('source'))) {
      const src = videoEl.src || videoEl.querySelector('source')?.src;
      if (src) {
        const resolved = await providerRegistry.resolveMedia(src);
        return {
          provider: resolved.provider,
          sourceUrl: src,
          posterUrl: videoEl.poster || undefined,
          qualities: resolved.qualities,
        };
      }
    }

    // 2. Check for <iframe> embeds (Loom, Vimeo, YouTube)
    const iframes = Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe'));
    for (const iframe of iframes) {
      const src = iframe.src || iframe.dataset.src;
      if (src) {
        const adapter = providerRegistry.findAdapter(src);
        if (adapter) {
          const resolved = await adapter.resolveStream(src);
          return {
            provider: resolved.provider,
            sourceUrl: src,
            qualities: resolved.qualities,
          };
        }
      }
    }

    // 3. Check for Next.js internal data (__NEXT_DATA__) if available
    try {
      const nextDataEl = document.getElementById('__NEXT_DATA__');
      if (nextDataEl && nextDataEl.textContent) {
        const jsonData = JSON.parse(nextDataEl.textContent);
        const videoLink = this.searchKeyRecursively(jsonData, 'videoLink') || this.searchKeyRecursively(jsonData, 'videoUrl');
        if (typeof videoLink === 'string' && videoLink.startsWith('http')) {
          const resolved = await providerRegistry.resolveMedia(videoLink);
          return {
            provider: resolved.provider,
            sourceUrl: videoLink,
            qualities: resolved.qualities,
          };
        }
      }
    } catch {
      // Safe fallback
    }

    return null;
  }

  /**
   * Extracts downloadable attachments from the lesson view
   */
  static extractAttachments() {
    const attachmentLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(
        'a[download], a[href*="download"], a[href*="s3.amazonaws.com"], a[href*="cloudfront.net"], [class*="attachment"] a, [class*="file"] a'
      )
    );

    const attachments = attachmentLinks
      .map((a, idx) => {
        const href = a.href;
        if (!href || href.startsWith('javascript:')) return null;

        const text = a.textContent?.trim() || `attachment_${idx + 1}`;
        const cleanHref = href.split('?')[0];
        const extMatch = cleanHref.match(/\.([a-zA-Z0-9]{2,5})$/);
        const fileExtension = extMatch ? extMatch[1] : 'bin';

        return {
          id: `att_${idx}_${Date.now()}`,
          fileName: text.includes('.') ? text : `${text}.${fileExtension}`,
          downloadUrl: href,
          fileExtension,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return attachments;
  }

  private static searchKeyRecursively(obj: any, targetKey: string): any {
    if (!obj || typeof obj !== 'object') return null;
    if (obj[targetKey]) return obj[targetKey];

    for (const key of Object.keys(obj)) {
      const res = this.searchKeyRecursively(obj[key], targetKey);
      if (res) return res;
    }
    return null;
  }
}
