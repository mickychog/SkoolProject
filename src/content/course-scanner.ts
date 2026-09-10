/**
 * Course Scanner: Hierarchical parser for Skool Classroom sidebar and course trees.
 * Follows: docs/specs/02_ARCHITECTURE_SPEC.md
 */

import { CourseHierarchy, CourseModule, CourseLesson } from '@/types/course';

export class CourseScanner {
  /**
   * Scans the Classroom navigation DOM for all modules and lessons
   */
  static scanHierarchy(): CourseHierarchy | null {
    const courseTitle = this.extractCourseTitle();
    const communityName = this.extractCommunityName();
    const modules = this.extractModules();

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
      '[data-testid="course-title"], header h1, [class*="CourseTitle"], h1'
    );
    return titleEl?.textContent?.trim() || document.title.replace('· Skool', '').trim() || 'Skool Course';
  }

  static extractCommunityName(): string {
    const commEl = document.querySelector<HTMLElement>(
      '[data-testid="community-name"], nav a[href^="/"], [class*="community"]'
    );
    return commEl?.textContent?.trim() || 'Skool Community';
  }

  /**
   * Extracts modules and lessons from accordion / list DOM containers
   */
  static extractModules(): CourseModule[] {
    const modules: CourseModule[] = [];

    // Look for module containers or accordion sections
    const moduleContainers = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-testid="module-item"], [class*="ModuleItem"], [class*="module-container"], [class*="accordion"]'
      )
    );

    if (moduleContainers.length > 0) {
      moduleContainers.forEach((modEl, modIdx) => {
        const modTitleEl = modEl.querySelector<HTMLElement>('h3, [class*="title"], [class*="header"]');
        const moduleTitle = modTitleEl?.textContent?.trim() || `Module ${modIdx + 1}`;

        // Find lesson links within this module
        const lessonLinks = Array.from(modEl.querySelectorAll<HTMLAnchorElement>('a[href*="/classroom/"]'));
        const lessons: CourseLesson[] = lessonLinks.map((a, lIdx) => {
          const title = a.textContent?.trim() || `Lesson ${lIdx + 1}`;
          return {
            lessonId: a.href.split('/').pop() || `lesson_${modIdx + 1}_${lIdx + 1}`,
            lessonIndex: lIdx + 1,
            lessonTitle: title,
            url: a.href,
            attachments: [],
          };
        });

        modules.push({
          moduleId: `mod_${modIdx + 1}`,
          moduleIndex: modIdx + 1,
          moduleTitle,
          lessons,
        });
      });
    } else {
      // Fallback: collect all lesson links in the sidebar
      const allLessonLinks = Array.from(
        document.querySelectorAll<HTMLAnchorElement>('a[href*="/classroom/"]')
      );

      if (allLessonLinks.length > 0) {
        const defaultLessons: CourseLesson[] = allLessonLinks.map((a, idx) => ({
          lessonId: a.href.split('/').pop() || `lesson_${idx + 1}`,
          lessonIndex: idx + 1,
          lessonTitle: a.textContent?.trim() || `Lesson ${idx + 1}`,
          url: a.href,
          attachments: [],
        }));

        modules.push({
          moduleId: 'mod_1',
          moduleIndex: 1,
          moduleTitle: 'General Lessons',
          lessons: defaultLessons,
        });
      }
    }

    return modules;
  }
}
