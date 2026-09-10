/**
 * Course Scanner: Hierarchical parser for Skool Classroom sidebar and Next.js course trees.
 * Extracts real module and lesson names exactly as displayed on the page.
 * Follows: docs/specs/02_ARCHITECTURE_SPEC.md
 */

import { CourseHierarchy, CourseModule, CourseLesson } from '@/types/course';
import { providerRegistry } from '@/providers';

export class CourseScanner {
  /**
   * Scans the Classroom navigation and Next.js payload for all modules, lessons, videos, and attachments
   */
  static scanHierarchy(): CourseHierarchy | null {
    // 1. First attempt: Next.js state payload (contains full structured data with exact names)
    const nextHierarchy = this.extractFromNextData();
    if (nextHierarchy && nextHierarchy.modules.length > 0) {
      return nextHierarchy;
    }

    // 2. Fallback attempt: Deep DOM elements
    const courseTitle = this.extractCourseTitle();
    const communityName = this.extractCommunityName();
    const modules = this.extractModulesFromDom();

    let totalLessons = 0;
    let totalVideos = 0;
    let totalAttachments = 0;

    modules.forEach((mod) => {
      totalLessons += mod.lessons.length;
      mod.lessons.forEach((l) => {
        if (l.media) totalVideos++;
        totalAttachments += l.attachments.length;
      });
    });

    return {
      courseId: `course_${Date.now()}`,
      courseTitle,
      communityName,
      modules,
      scannedAt: Date.now(),
      totalLessons,
      totalVideos,
      totalAttachments,
    };
  }

  static extractCourseTitle(): string {
    const titleEl = document.querySelector<HTMLElement>(
      '[data-testid="course-title"], header h1, [class*="CourseTitle"], h1, [class*="course-header"] h1, [class*="course-title"]'
    );
    if (titleEl?.textContent?.trim()) {
      return titleEl.textContent.trim();
    }
    return document.title.replace('· Skool', '').trim() || 'Curso de Skool';
  }

  static extractCommunityName(): string {
    const commEl = document.querySelector<HTMLElement>(
      '[data-testid="community-name"], nav a[href^="/"], [class*="community-name"], [class*="CommunityName"]'
    );
    return commEl?.textContent?.trim() || 'Comunidad Skool';
  }

  /**
   * Deep extractor from Next.js payload (__NEXT_DATA__)
   */
  static extractFromNextData(): CourseHierarchy | null {
    try {
      let data: any = null;
      const scriptEl = document.getElementById('__NEXT_DATA__');
      if (scriptEl && scriptEl.textContent) {
        data = JSON.parse(scriptEl.textContent);
      } else if (typeof window !== 'undefined' && (window as any).__NEXT_DATA__) {
        data = (window as any).__NEXT_DATA__;
      }

      if (!data || !data.props?.pageProps) return null;

      const pageProps = data.props.pageProps;

      const findCourseObject = (root: any): any => {
        if (!root || typeof root !== 'object') return null;
        if (root.sets && Array.isArray(root.sets) && root.sets.length > 0) return root;
        if (root.modules && Array.isArray(root.modules) && root.modules.length > 0 && root.name) return root;
        if (root.currentCourse) {
          const c = findCourseObject(root.currentCourse);
          if (c) return c;
        }
        if (root.course) {
          const c = findCourseObject(root.course);
          if (c) return c;
        }
        if (root.courseData) {
          const c = findCourseObject(root.courseData);
          if (c) return c;
        }
        if (root.group?.course) {
          const c = findCourseObject(root.group.course);
          if (c) return c;
        }

        // Check React Query dehydrated state
        if (root.dehydratedState?.queries && Array.isArray(root.dehydratedState.queries)) {
          for (const q of root.dehydratedState.queries) {
            const found = findCourseObject(q?.state?.data);
            if (found) return found;
          }
        }

        // Check child keys
        for (const key of Object.keys(root)) {
          if (key === 'course' || key === 'currentCourse' || key === 'classroom' || key === 'group') {
            const found = findCourseObject(root[key]);
            if (found) return found;
          }
        }
        return null;
      };

      const course = findCourseObject(pageProps) || pageProps.currentCourse || pageProps.course || pageProps.group?.course || pageProps.courseData;
      if (!course) return null;

      const courseTitle = course.name || course.title || course.metadata?.name || course.metadata?.title || this.extractCourseTitle();
      const communityName = pageProps.group?.name || pageProps.community?.name || this.extractCommunityName();

      // Find all module/set containers in the course object
      const rawModules =
        course.sets ||
        course.modules ||
        course.sections ||
        course.children ||
        course.groups ||
        pageProps.sets ||
        pageProps.modules ||
        [];

      const modules: CourseModule[] = [];
      let totalLessons = 0;
      let totalVideos = 0;
      let totalAttachments = 0;

      rawModules.forEach((m: any, mIdx: number) => {
        const modTitle =
          m.name ||
          m.title ||
          m.label ||
          m.heading ||
          m.metadata?.name ||
          m.metadata?.title ||
          m.metadata?.label ||
          m.header ||
          `Módulo ${mIdx + 1}`;

        const rawLessons =
          m.modules ||
          m.lessons ||
          m.children ||
          m.items ||
          m.nodes ||
          m.elements ||
          [];

        const lessons: CourseLesson[] = [];

        rawLessons.forEach((l: any, lIdx: number) => {
          const lessonTitle =
            l.name ||
            l.title ||
            l.label ||
            l.heading ||
            l.metadata?.name ||
            l.metadata?.title ||
            l.metadata?.heading ||
            `Lección ${lIdx + 1}`;

          const lessonId = l.id || `lesson_${mIdx + 1}_${lIdx + 1}`;
          const lessonUrl =
            l.url ||
            (l.id ? `${window.location.origin}/classroom/${course.id || 'c'}?md=${l.id}` : window.location.href);

          // Extract media from lesson payload
          let mediaUrl: string | undefined;
          if (typeof l.video === 'string') {
            mediaUrl = l.video;
          } else if (l.video) {
            const v = l.video;
            const muxToken = v.token || v.mux_token || v.jwt ? `?token=${v.token || v.mux_token || v.jwt}` : '';
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
              (v.mux_playback_id ? `https://stream.mux.com/${v.mux_playback_id}.m3u8${muxToken}` : undefined);
          } else if (l.media_url || l.stream_url || l.playback_url) {
            mediaUrl = l.media_url || l.stream_url || l.playback_url;
          }

          // Extract attachments
          const rawAttachments = l.attachments || l.files || l.resources || [];
          const attachments = rawAttachments
            .map((att: any, attIdx: number) => {
              const fileName = att.name || att.fileName || att.title || `recurso_${attIdx + 1}.pdf`;
              const ext = fileName.includes('.') ? fileName.split('.').pop() || 'pdf' : 'pdf';
              return {
                id: att.id || `att_${mIdx}_${lIdx}_${attIdx}`,
                fileName,
                downloadUrl: att.url || att.download_url || att.link || '',
                fileExtension: ext,
                fileSizeBytes: att.size || att.file_size,
              };
            })
            .filter((att: any) => Boolean(att.downloadUrl));

          const lessonObj: CourseLesson = {
            lessonId,
            lessonIndex: lIdx + 1,
            lessonTitle,
            url: lessonUrl,
            moduleTitle: modTitle,
            moduleIndex: mIdx + 1,
            courseTitle,
            communityName,
            descriptionHtml: l.description || l.content,
            attachments,
          };

          if (mediaUrl) {
            const adapter = providerRegistry.findAdapter(mediaUrl);
            const providerType = adapter ? adapter.providerType : 'skool_native';
            lessonObj.media = {
              provider: providerType,
              sourceUrl: mediaUrl,
              qualities: [
                {
                  qualityLabel: 'Original',
                  streamUrl: mediaUrl,
                  isHLS: mediaUrl.includes('.m3u8'),
                },
              ],
            };
            totalVideos++;
          }

          totalAttachments += attachments.length;
          totalLessons++;
          lessons.push(lessonObj);
        });

        modules.push({
          moduleId: m.id || `mod_${mIdx + 1}`,
          moduleIndex: mIdx + 1,
          moduleTitle: modTitle,
          lessons,
        });
      });

      if (modules.length > 0) {
        return {
          courseId: course.id || `course_${Date.now()}`,
          courseTitle,
          communityName,
          modules,
          scannedAt: Date.now(),
          totalLessons,
          totalVideos,
          totalAttachments,
        };
      }
    } catch {
      // Fallback to DOM
    }
    return null;
  }

  /**
   * Extracts modules and lessons from accordion / list DOM containers with real text titles
   */
  static extractModulesFromDom(): CourseModule[] {
    const modules: CourseModule[] = [];

    // Search for set/module container elements in the classroom sidebar
    const setContainers = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid="module-item"], [data-testid*="module"], [data-testid*="set"], [class*="styled__Set"], [class*="SetContainer"], [class*="SetItem"], [class*="set-item"], [class*="ModuleItem"], [class*="module-item"], [class*="module-container"], [class*="Accordion"], [class*="Section"]'
      )
    );

    if (setContainers.length > 0) {
      setContainers.forEach((setEl, sIdx) => {
        // Find title element within the set container
        const headerEl = setEl.querySelector<HTMLElement>(
          '[class*="SetTitle"], [class*="setTitle"], [class*="Header"], [class*="header"], [class*="title"], h2, h3, h4, button'
        );

        let moduleTitle = headerEl?.textContent?.trim() || '';
        // Clean out extra lesson count badges like "(4)" or "4 lessons"
        moduleTitle = moduleTitle.replace(/\s+/g, ' ').replace(/\(\s*\d+\s*\)/g, '').replace(/(\d+\s*lecciones|\d+\s*lessons)/i, '').trim();
        if (!moduleTitle) moduleTitle = `Módulo ${sIdx + 1}`;

        // Find lesson links within this set
        const lessonLinks = Array.from(
          setEl.querySelectorAll<HTMLAnchorElement>('a[href*="/classroom/"], a[href*="?md="]')
        );

        const lessons: CourseLesson[] = lessonLinks.map((a, lIdx) => {
          let title = '';
          const titleSpan = a.querySelector<HTMLElement>('span, p, div, [class*="title"]');
          if (titleSpan?.textContent?.trim()) {
            title = titleSpan.textContent.trim();
          } else {
            title = a.textContent?.trim() || '';
          }
          title = title.replace(/\b\d{1,2}:\d{2}\b/g, '').replace(/\s+/g, ' ').trim();
          if (!title) title = `Lección ${lIdx + 1}`;

          const lessonId = a.href.split('?md=')[1] || a.href.split('/').pop() || `lesson_${sIdx + 1}_${lIdx + 1}`;

          return {
            lessonId,
            lessonIndex: lIdx + 1,
            lessonTitle: title,
            url: a.href,
            moduleTitle,
            moduleIndex: sIdx + 1,
            courseTitle: this.extractCourseTitle(),
            communityName: this.extractCommunityName(),
            attachments: [],
          };
        });

        if (lessons.length > 0) {
          modules.push({
            moduleId: `mod_${sIdx + 1}`,
            moduleIndex: sIdx + 1,
            moduleTitle,
            lessons,
          });
        }
      });
    }

    // Fallback: if no set containers matched, collect all lesson links and group them
    if (modules.length === 0) {
      const allLessonLinks = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[href*="/classroom/"], a[href*="?md="]')
      );

      if (allLessonLinks.length > 0) {
        const lessons: CourseLesson[] = allLessonLinks.map((a, idx) => {
          let title = a.textContent?.trim() || '';
          title = title.replace(/\b\d{1,2}:\d{2}\b/g, '').replace(/\s+/g, ' ').trim();
          if (!title) title = `Lección ${idx + 1}`;

          return {
            lessonId: a.href.split('?md=')[1] || a.href.split('/').pop() || `lesson_${idx + 1}`,
            lessonIndex: idx + 1,
            lessonTitle: title,
            url: a.href,
            moduleTitle: this.extractCourseTitle(),
            moduleIndex: 1,
            courseTitle: this.extractCourseTitle(),
            communityName: this.extractCommunityName(),
            attachments: [],
          };
        });

        modules.push({
          moduleId: 'mod_1',
          moduleIndex: 1,
          moduleTitle: this.extractCourseTitle(),
          lessons,
        });
      }
    }

    return modules;
  }
}
