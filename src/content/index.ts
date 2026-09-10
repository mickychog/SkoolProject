/**
 * Content Script Entrypoint for Skool Downloader
 * Follows: docs/specs/02_ARCHITECTURE_SPEC.md
 */

import { ExtensionMessage } from '@/types/messages';
import { CourseLesson, CourseHierarchy } from '@/types/course';

console.log('[Skool Downloader] Content script loaded on Skool.com');

// Listen for messages from Popup or Background
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'SCAN_ACTIVE_LESSON': {
        const lesson = scanCurrentLesson();
        if (lesson) {
          sendResponse({ type: 'LESSON_SCANNED_SUCCESS', payload: lesson });
        } else {
          sendResponse({
            type: 'SCAN_ERROR',
            payload: { message: 'No active lesson detected on current page.' },
          });
        }
        return true;
      }

      case 'SCAN_FULL_COURSE': {
        const course = scanFullCourseHierarchy();
        if (course) {
          sendResponse({ type: 'COURSE_SCANNED_SUCCESS', payload: course });
        } else {
          sendResponse({
            type: 'SCAN_ERROR',
            payload: { message: 'Failed to scan course structure.' },
          });
        }
        return true;
      }
    }
  }
);

/**
 * Scans the current active lesson container
 */
export function scanCurrentLesson(): CourseLesson | null {
  const currentUrl = window.location.href;
  if (!currentUrl.includes('/classroom/')) {
    return null;
  }

  // Extract lesson title
  const lessonTitleEl = document.querySelector('h2, [class*="lesson-title"], [data-testid="lesson-title"]');
  const lessonTitle = lessonTitleEl?.textContent?.trim() || document.title.replace('· Skool', '').trim();

  // Extract attachments
  const attachmentLinks = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('a[href*="download"], a[download], a[href*="s3"], a[href*="cloudfront"]')
  );

  const attachments = attachmentLinks.map((a, idx) => {
    const href = a.href;
    const text = a.textContent?.trim() || `attachment_${idx + 1}`;
    const extMatch = href.match(/\.([a-zA-Z0-9]+)(\?|$)/);
    const fileExtension = extMatch ? extMatch[1] : 'bin';

    return {
      id: `att_${idx}_${Date.now()}`,
      fileName: text.includes('.') ? text : `${text}.${fileExtension}`,
      downloadUrl: href,
      fileExtension,
    };
  });

  return {
    lessonId: window.location.pathname.split('/').pop() || 'lesson_current',
    lessonIndex: 1,
    lessonTitle,
    url: currentUrl,
    attachments,
  };
}

/**
 * Scans the sidebar/DOM for the full course hierarchy
 */
export function scanFullCourseHierarchy(): CourseHierarchy | null {
  const courseTitle = document.title.replace('· Skool', '').trim() || 'Skool Course';

  // Return base hierarchy model
  return {
    courseId: 'course_' + Date.now(),
    courseTitle,
    communityName: 'Skool Community',
    modules: [],
    scannedAt: Date.now(),
    totalLessons: 0,
    totalVideos: 0,
    totalAttachments: 0,
  };
}
