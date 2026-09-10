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

    const nextDataLesson = this.extractLessonFromNextData(currentUrl);

    const lessonTitle = nextDataLesson?.lessonTitle || this.extractLessonTitle();
    const lessonId = nextDataLesson?.lessonId || this.extractLessonId(currentUrl);
    const media = nextDataLesson?.media || this.extractMedia();
    const attachments = nextDataLesson?.attachments?.length ? nextDataLesson.attachments : this.extractAttachments();
    const descriptionText = nextDataLesson?.descriptionHtml || this.extractLessonDescription();

    return {
      lessonId,
      lessonIndex: nextDataLesson?.lessonIndex || 1,
      lessonTitle,
      url: currentUrl,
      moduleTitle: nextDataLesson?.moduleTitle || this.extractModuleTitleFromDom(),
      moduleIndex: nextDataLesson?.moduleIndex || 1,
      courseTitle: nextDataLesson?.courseTitle || this.extractCourseTitleFromDom(),
      communityName: nextDataLesson?.communityName || this.extractCommunityNameFromDom(),
      descriptionHtml: descriptionText || undefined,
      media: media || undefined,
      attachments,
    };
  }

  static extractLessonTitle(): string {
    const heading = document.querySelector<HTMLElement>(
      '[data-testid="lesson-title"], [class*="LessonTitle"], [class*="lesson-title"], [class*="styled__Title"], h1, h2'
    );
    if (heading && heading.textContent?.trim()) {
      return heading.textContent.trim();
    }
    return document.title.replace('· Skool', '').trim() || 'Lección de Skool';
  }

  static extractModuleTitleFromDom(): string {
    const activeModuleEl = document.querySelector<HTMLElement>(
      '[class*="styled__Set"][class*="active"], [class*="SetItem"][class*="active"], [class*="accordion"][class*="open"], [class*="Section"] [class*="Header"]'
    );
    if (activeModuleEl?.textContent?.trim()) {
      return activeModuleEl.textContent.replace(/(\d+\s*lecciones|\d+\s*lessons)/i, '').trim();
    }
    return 'Módulo 01';
  }

  static extractCourseTitleFromDom(): string {
    const titleEl = document.querySelector<HTMLElement>(
      '[data-testid="course-title"], header h1, [class*="CourseTitle"], h1'
    );
    return titleEl?.textContent?.trim() || document.title.replace('· Skool', '').trim() || 'Curso';
  }

  static extractCommunityNameFromDom(): string {
    const commEl = document.querySelector<HTMLElement>(
      '[data-testid="community-name"], nav a[href^="/"], [class*="community-name"]'
    );
    return commEl?.textContent?.trim() || 'Skool';
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
   * Deep search in Next.js props for active lesson
   */
  static extractLessonFromNextData(currentUrl: string): Partial<CourseLesson> | null {
    try {
      let nextData: any = null;
      const scriptEl = document.getElementById('__NEXT_DATA__');
      if (scriptEl && scriptEl.textContent) {
        nextData = JSON.parse(scriptEl.textContent);
      } else if (typeof window !== 'undefined' && (window as any).__NEXT_DATA__) {
        nextData = (window as any).__NEXT_DATA__;
      }

      if (!nextData?.props?.pageProps) return null;
      const pp = nextData.props.pageProps;

      const course = pp.currentCourse || pp.course || pp.group?.course || pp.courseData;
      const courseTitle = course?.name || course?.title || course?.metadata?.name || pp.group?.name;
      const communityName = pp.group?.name || pp.community?.name;

      // 1. Direct active lesson props
      let rawLesson = pp.currentLesson || pp.lesson || pp.activeLesson;
      let parentModuleTitle: string | undefined;
      let parentModuleIndex = 1;
      let lessonIndex = 1;

      // 2. Search in course / modules / sets if not direct
      const modules = course?.sets || course?.modules || course?.children || course?.sections || pp.sets || pp.modules || [];
      const lessonId = this.extractLessonId(currentUrl);

      for (let mIdx = 0; mIdx < modules.length; mIdx++) {
        const mod = modules[mIdx];
        const lessons = mod.modules || mod.lessons || mod.children || mod.items || mod.nodes || [];
        for (let lIdx = 0; lIdx < lessons.length; lIdx++) {
          const l = lessons[lIdx];
          if (l.id === lessonId || currentUrl.includes(l.id)) {
            rawLesson = l;
            parentModuleTitle = mod.name || mod.title || mod.label || mod.metadata?.name || mod.metadata?.title || mod.header;
            parentModuleIndex = mIdx + 1;
            lessonIndex = lIdx + 1;
            break;
          }
        }
        if (rawLesson && parentModuleTitle) break;
      }

      if (!rawLesson) return null;

      const title = rawLesson.name || rawLesson.title || rawLesson.label || rawLesson.metadata?.name;
      const id = rawLesson.id || this.extractLessonId(currentUrl);

      // Extract media
      let mediaUrl: string | undefined;
      if (typeof rawLesson.video === 'string') {
        mediaUrl = rawLesson.video;
      } else if (rawLesson.video) {
        const v = rawLesson.video;
        const rawToken = v.token || v.mux_token || v.jwt || v.playback_token || v.muxToken || '';
        const muxToken = rawToken ? `?token=${rawToken}` : '';
        const playbackId = v.mux_playback_id || v.playback_id || v.playbackId || v.muxPlaybackId || v.id || v.videoId;
        mediaUrl =
          v.signed_url ||
          v.hls_url ||
          v.m3u8 ||
          v.url ||
          v.stream_url ||
          v.playback_url ||
          v.raw_url ||
          v.loom_url ||
          (v.vimeo_id ? `https://player.vimeo.com/video/${v.vimeo_id}` : undefined) ||
          (v.youtube_id ? `https://www.youtube.com/watch?v=${v.youtube_id}` : undefined) ||
          (playbackId && !String(playbackId).includes('/') ? `https://stream.mux.com/${playbackId}.m3u8${muxToken}` : undefined);

        if (mediaUrl && rawToken && !mediaUrl.includes('token=') && !mediaUrl.includes('jwt=')) {
          mediaUrl += (mediaUrl.includes('?') ? '&' : '?') + `token=${rawToken}`;
        }
      } else if (rawLesson.media_url || rawLesson.stream_url || rawLesson.playback_url) {
        mediaUrl = rawLesson.media_url || rawLesson.stream_url || rawLesson.playback_url;
      } else if (rawLesson.mux_playback_id || rawLesson.playback_id) {
        const pid = rawLesson.mux_playback_id || rawLesson.playback_id;
        const tok = rawLesson.token || rawLesson.mux_token || '';
        mediaUrl = `https://stream.mux.com/${pid}.m3u8${tok ? `?token=${tok}` : ''}`;
      }

      let media: MediaAsset | undefined;
      if (mediaUrl) {
        const adapter = providerRegistry.findAdapter(mediaUrl);
        media = {
          provider: adapter ? adapter.providerType : 'skool_native',
          sourceUrl: mediaUrl,
          qualities: [
            {
              qualityLabel: 'Original',
              streamUrl: mediaUrl,
              isHLS: mediaUrl.includes('.m3u8'),
            },
          ],
        };
      }

      // Extract attachments
      const rawAtts = rawLesson.attachments || rawLesson.files || rawLesson.resources || [];
      const attachments = rawAtts.map((att: any, idx: number) => {
        const fileName = att.name || att.fileName || att.title || `archivo_${idx + 1}.pdf`;
        const ext = fileName.includes('.') ? fileName.split('.').pop() || 'pdf' : 'pdf';
        return {
          id: att.id || `att_next_${idx}`,
          fileName,
          downloadUrl: att.url || att.download_url || att.link || '',
          fileExtension: ext,
        };
      }).filter((a: any) => Boolean(a.downloadUrl));

      return {
        lessonId: id,
        lessonIndex,
        lessonTitle: title,
        moduleTitle: parentModuleTitle,
        moduleIndex: parentModuleIndex,
        courseTitle,
        communityName,
        media,
        attachments,
        descriptionHtml: rawLesson.description || rawLesson.content,
      };
    } catch {
      return null;
    }
  }

  /**
   * Multi-strategy media detector (Content-Script Safe)
   */
  static extractMedia(): MediaAsset | null {
    const candidates: string[] = [];

    // Strategy 0: Mux Player & Video Web Components
    try {
      const muxEls = Array.from(document.querySelectorAll('mux-player, mux-video, [playback-id], [data-playback-id], [data-mux-playback-id]'));
      for (const el of muxEls) {
        const pid = el.getAttribute('playback-id') || el.getAttribute('data-playback-id') || el.getAttribute('data-mux-playback-id') || (el as any).playbackId;
        const tok = el.getAttribute('playback-token') || el.getAttribute('data-playback-token') || el.getAttribute('token') || (el as any).playbackToken;
        if (pid) {
          candidates.push(`https://stream.mux.com/${pid}.m3u8${tok ? `?token=${tok}` : ''}`);
        }
      }
    } catch {}

    // Strategy 1: Network Resource Timing (performance.getEntriesByType)
    try {
      if (typeof performance !== 'undefined' && performance.getEntriesByType) {
        const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        for (const entry of entries) {
          const name = entry.name || '';
          if (
            name.includes('.xml') ||
            name.includes('.svg') ||
            name.includes('.png') ||
            name.includes('.jpg') ||
            name.includes('.jpeg') ||
            name.includes('.gif') ||
            name.includes('.webp') ||
            name.includes('avatar') ||
            name.includes('thumb')
          ) {
            continue;
          }
          if (
            name.includes('.m3u8') ||
            name.includes('stream.mux.com') ||
            name.includes('stream.video.skool.com') ||
            name.includes('video.skool.com') ||
            name.includes('cdn.loom.com/sessions') ||
            name.includes('loom.com/share') ||
            name.includes('loom.com/embed') ||
            name.includes('player.vimeo.com/video') ||
            name.includes('fast.wistia.net/embed')
          ) {
            candidates.push(name);
          }
        }
      }
    } catch {
      // Ignore performance API errors
    }

    // Strategy 2: Native <video> and <source> elements
    const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
    for (const v of videos) {
      if (v.currentSrc && !v.currentSrc.startsWith('blob:')) candidates.push(v.currentSrc);
      if (v.src && !v.src.startsWith('blob:')) candidates.push(v.src);
      const sources = Array.from(v.querySelectorAll<HTMLSourceElement>('source'));
      for (const s of sources) {
        if (s.src) candidates.push(s.src);
      }
    }

    // Strategy 3: iFrames (Loom, Vimeo, Wistia, YouTube)
    const iframes = Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe'));
    for (const iframe of iframes) {
      const src = iframe.src || iframe.dataset.src || iframe.getAttribute('src');
      if (src && !src.startsWith('about:') && !src.startsWith('javascript:')) {
        candidates.push(src);
      }
    }

    // Strategy 4: DOM Dataset attributes & Links
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

    // Strategy 5: Script Tags (Regex for .m3u8, Loom, Vimeo, Wistia, Mux, YouTube)
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

    // DOM attachment links
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
