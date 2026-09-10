/**
 * Utility functions for sanitizing file and directory names across OS platforms (Windows, Linux, macOS)
 * Following Spec: docs/specs/04_TEST_VERIFICATION_SPEC.md
 */

/**
 * Sanitizes a single filename or folder name by removing illegal characters.
 * Windows forbidden: \ / : * ? " < > | and control characters.
 */
export function sanitizeName(name: string, maxLength: number = 100): string {
  if (!name || typeof name !== 'string') {
    return 'unnamed';
  }

  // Replace forbidden chars with underscore
  let cleaned = name
    .replace(/[\\/:*?"<>|\r\n\t]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove leading/trailing dots and spaces (problematic on Windows)
  cleaned = cleaned.replace(/^[.\s]+|[.\s]+$/g, '');

  if (!cleaned) {
    return 'unnamed';
  }

  // Truncate to maximum length while avoiding splitting in middle of word if possible
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength).trim();
  }

  return cleaned;
}

/**
 * Formats a sequential prefix with zero-padding (e.g. index 1 -> "01", index 12 -> "12")
 */
export function formatIndex(index: number, padLength: number = 2): string {
  return String(Math.max(1, index)).padStart(padLength, '0');
}

/**
 * Builds a clean, organized relative path for Chrome downloads:
 * e.g. "Skool/Community_Name - Course_Title/01_Module_Title/01_02_Lesson_Title.mp4"
 */
export function buildDownloadPath(params: {
  communityName: string;
  courseTitle: string;
  moduleIndex: number;
  moduleTitle: string;
  lessonIndex: number;
  lessonTitle: string;
  assetTitle?: string;
  extension: string;
}): string {
  const rootFolder = 'Skool';
  const courseFolder = sanitizeName(
    `${params.communityName || 'General'} - ${params.courseTitle || 'Course'}`
  );
  const moduleFolder = `${formatIndex(params.moduleIndex)}_${sanitizeName(params.moduleTitle || 'Module')}`;

  const cleanExt = params.extension.startsWith('.')
    ? params.extension
    : `.${params.extension}`;

  const prefix = `${formatIndex(params.moduleIndex)}_${formatIndex(params.lessonIndex)}`;
  const titlePart = sanitizeName(params.assetTitle || params.lessonTitle || 'Resource');
  const fileName = `${prefix}_${titlePart}${cleanExt}`;

  return `${rootFolder}/${courseFolder}/${moduleFolder}/${fileName}`;
}
