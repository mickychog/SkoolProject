/**
 * Deep Lesson Scanner: Multi-strategy extractor for active Skool lesson pages.
 * Runs in Content Script context (Zero-CORS, synchronous DOM & Next.js extraction).
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
    if (!currentUrl.includes('skool.com')) {
      return null;
    }

    const lessonTitle = this.extractLessonTitle();
    const lessonId = this.extractLessonId(currentUrl);
    const media = this.extractMedia();
    const attachments = this.extractAttachments();
    const descriptionText = this.extractLessonDescription();

    // If no title was found and no media or attachments exist, verify if page is classroom
    if (lessonTitle === 'Untitled Lesson' && !media && attachments.length === 0) {
      if (!currentUrl.includes('/classroom') && !currentUrl.includes('?md=')) {
        return null;
      }
    }

    return {
      lessonId,
      lessonIndex: 1,
      lessonTitle,
      url: currentUrl,
      descriptionHtml: descriptionText || undefined,
      media: media || undefined,
      attachments,
    };
  }

  static extractLessonTitle(): string {
    const heading = document.querySelector<HTMLElement>(
      '[data-testid="lesson-title"], [class*="LessonTitle"], h1, h2, [class*="title"]'
    );
    if (heading && heading.textContent?.trim()) {
      return heading.textContent.trim();
    }
    return document.title.replace('· Skool', '').trim() || 'Untitled Lesson';
  }

  static extractLessonId(url: string): string {
    try {
      const urlObj = new URL(url);
      const mdParam = urlObj.searchParams.get('md');
      if (mdParam) return mdParam;
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      return pathParts[pathParts.length - 1] || `lesson_${Date.now()}`;
    } catch {
      return `lesson_${Date.now()}`;
    }
  }

  static extractLessonDescription(): string {
    const descEl = document.querySelector<HTMLElement>(
      '[data-testid="lesson-content"], [class*="LessonContent"], [class*="description"], [class*="post-body"], article'
    );
    return descEl?.textContent?.trim() || '';
  }

  /**
   * Multi-strategy media detector (Content-Script Safe: No blocking cross-origin fetch)
   */
  static extractMedia(): MediaAsset | null {
    const candidates: string[] = [];

    // Strategy 1: Next.js Payload (__NEXT_DATA__)
    try {
      let nextData: any = null;
      const scriptEl = document.getElementById('__NEXT_DATA__');
      if (scriptEl && scriptEl.textContent) {
        nextData = JSON.parse(scriptEl.textContent);
      } else if (typeof window !== 'undefined' && (window as any).__NEXT_DATA__) {
        nextData = (window as any).__NEXT_DATA__;
      }

      if (nextData?.props?.pageProps) {
        const pageProps = nextData.props.pageProps;
        const currentLesson = pageProps.currentLesson || pageProps.lesson;
        if (currentLesson) {
          if (typeof currentLesson.video === 'string') {
            candidates.push(currentLesson.video);
          } else if (currentLesson.video) {
            const v = currentLesson.video;
            if (v.hls_url) candidates.push(v.hls_url);
            if (v.m3u8) candidates.push(v.m3u8);
            if (v.url) candidates.push(v.url);
            if (v.stream_url) candidates.push(v.stream_url);
            if (v.playback_url) candidates.push(v.playback_url);
            if (v.raw_url) candidates.push(v.raw_url);
            if (v.loom_url) candidates.push(v.loom_url);
            if (v.vimeo_id) candidates.push(`https://player.vimeo.com/video/${v.vimeo_id}`);
            if (v.youtube_id) candidates.push(`https://www.youtube.com/watch?v=${v.youtube_id}`);
            if (v.mux_playback_id) candidates.push(`https://stream.mux.com/${v.mux_playback_id}.m3u8`);
          }
        }
      }
    } catch {
      // Ignore Next.js parse error
    }

    // Strategy 2: Network Resource Timing (performance.getEntriesByType)
    try {
      if (typeof performance !== 'undefined' && performance.getEntriesByType) {
        const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        for (const entry of entries) {
          const name = entry.name || '';
          if (
            name.includes('.m3u8') ||
            name.includes('cdn.loom.com/sessions') ||
            name.includes('loom.com/share') ||
            name.includes('loom.com/embed') ||
            name.includes('player.vimeo.com/video') ||
            name.includes('fast.wistia.net/embed') ||
            name.includes('stream.mux.com') ||
            (name.includes('.mp4') && !name.includes('thumb') && !name.includes('avatar'))
          ) {
            candidates.push(name);
          }
        }
      }
    } catch {
      // Ignore performance API errors
    }

    // Strategy 3: Native <video> and <source> elements
    const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
    for (const v of videos) {
      if (v.currentSrc && !v.currentSrc.startsWith('blob:')) candidates.push(v.currentSrc);
      if (v.src && !v.src.startsWith('blob:')) candidates.push(v.src);
      const sources = Array.from(v.querySelectorAll<HTMLSourceElement>('source'));
      for (const s of sources) {
        if (s.src) candidates.push(s.src);
      }
    }

    // Strategy 4: iFrames (Loom, Vimeo, Wistia, YouTube)
    const iframes = Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe'));
    for (const iframe of iframes) {
      const src = iframe.src || iframe.dataset.src || iframe.getAttribute('src');
      if (src && !src.startsWith('about:') && !src.startsWith('javascript:')) {
        candidates.push(src);
      }
    }

    // Strategy 5: DOM Dataset attributes & Links
    const videoContainers = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-video-url], [data-hls-url], [data-stream-url], [data-playback-url], a[href*="loom.com"], a[href*="vimeo.com"], a[href*="youtu"]'
      )
    );
    for (const el of videoContainers) {
      const dataUrl =
        el.getAttribute('data-video-url') ||
        el.getAttribute('data-hls-url') ||
        el.getAttribute('data-stream-url') ||
        el.getAttribute('data-playback-url') ||
        (el as HTMLAnchorElement).href;
      if (dataUrl) candidates.push(dataUrl);
    }

    // Strategy 6: Script Tags (Regex for .m3u8, Loom, Vimeo, Wistia, Mux, YouTube)
    try {
      const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script'));
      for (const script of scripts) {
        const text = script.textContent || '';
        if (text.length > 20 && text.length < 500000) {
          const m3u8Matches = text.match(/https?:\/\/[^"'\\s>]+\.m3u8[^"'\\s>]*/gi);
          if (m3u8Matches) {
            m3u8Matches.forEach((m) => candidates.push(m.replace(/\\u0026/g, '&')));
          }

          const loomMatches = text.match(/https?:\/\/(?:www\.)?loom\.com\/(?:share|embed)\/[a-zA-Z0-9_-]+/gi);
          if (loomMatches) {
            loomMatches.forEach((m) => candidates.push(m));
          }

          const vimeoMatches = text.match(/https?:\/\/(?:player\.)?vimeo\.com\/(?:video\/)?[0-9]+/gi);
          if (vimeoMatches) {
            vimeoMatches.forEach((m) => candidates.push(m));
          }

          const wistiaMatches = text.match(/https?:\/\/(?:fast\.)?wistia\.(?:net|com)\/embed\/iframe\/[a-zA-Z0-9]+/gi);
          if (wistiaMatches) {
            wistiaMatches.forEach((m) => candidates.push(m));
          }
        }
      }
    } catch {
      // Ignore
    }

    // Deduplicate candidates
    const uniqueCandidates = Array.from(new Set(candidates)).filter(Boolean);

    // Prioritize: HLS .m3u8 > Loom > Vimeo > Wistia > YouTube > MP4
    const prioritized = uniqueCandidates.sort((a, b) => {
      const score = (url: string) => {
        if (url.includes('.m3u8')) return 100;
        if (url.includes('loom.com')) return 90;
        if (url.includes('vimeo.com')) return 80;
        if (url.includes('wistia.')) return 70;
        if (url.includes('youtu')) return 60;
        if (url.includes('.mp4')) return 50;
        return 0;
      };
      return score(b) - score(a);
    });

    if (prioritized.length > 0) {
      const bestUrl = prioritized[0];
      const adapter = providerRegistry.findAdapter(bestUrl);
      const provider = adapter ? adapter.providerType : 'skool_native';

      return {
        provider,
        sourceUrl: bestUrl,
        qualities: [
          {
            qualityLabel: 'Original',
            streamUrl: bestUrl,
            isHLS: bestUrl.includes('.m3u8'),
          },
        ],
      };
    }

    return null;
  }

  /**
   * Extracts downloadable attachments from the lesson view
   */
  static extractAttachments() {
    const attachmentsMap = new Map<string, { id: string; fileName: string; downloadUrl: string; fileExtension: string }>();

    // 1. Next.js attachments
    try {
      const scriptEl = document.getElementById('__NEXT_DATA__');
      if (scriptEl && scriptEl.textContent) {
        const nextData = JSON.parse(scriptEl.textContent);
        const currentLesson = nextData.props?.pageProps?.currentLesson || nextData.props?.pageProps?.lesson;
        const rawAtts = currentLesson?.attachments || currentLesson?.files || [];
        rawAtts.forEach((att: any, idx: number) => {
          if (att.url || att.download_url) {
            const fileName = att.name || att.fileName || att.title || `archivo_${idx + 1}.pdf`;
            const ext = fileName.includes('.') ? fileName.split('.').pop() || 'pdf' : 'pdf';
            const url = att.url || att.download_url;
            attachmentsMap.set(url, {
              id: att.id || `att_next_${idx}`,
              fileName,
              downloadUrl: url,
              fileExtension: ext,
            });
          }
        });
      }
    } catch {
      // Ignore
    }

    // 2. DOM attachment links
    const attachmentLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(
        'a[download], a[href*="download"], a[href*="s3.amazonaws.com"], a[href*="cloudfront.net"], [class*="attachment"] a, [class*="file"] a, a[href*="drive.google.com"], a[href*="dropbox.com"]'
      )
    );

    attachmentLinks.forEach((a, idx) => {
      const href = a.href;
      if (!href || href.startsWith('javascript:')) return;
      if (attachmentsMap.has(href)) return;

      const text = a.textContent?.trim() || `attachment_${idx + 1}`;
      const cleanHref = href.split('?')[0];
      const extMatch = cleanHref.match(/\.([a-zA-Z0-9]{2,5})$/);
      const fileExtension = extMatch ? extMatch[1] : 'pdf';

      attachmentsMap.set(href, {
        id: `att_dom_${idx}_${Date.now()}`,
        fileName: text.includes('.') ? text : `${text}.${fileExtension}`,
        downloadUrl: href,
        fileExtension,
      });
    });

    return Array.from(attachmentsMap.values());
  }
}
