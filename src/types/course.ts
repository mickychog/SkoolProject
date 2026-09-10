/**
 * Core Domain Types for Skool Courses, Modules, Lessons, and Media Assets.
 * Following Spec: docs/specs/03_DATA_MODELS_AND_CONTRACTS.md
 */

export type MediaProviderType =
  | 'skool_native'
  | 'loom'
  | 'vimeo'
  | 'wistia'
  | 'youtube'
  | 'direct_mp4'
  | 'unknown';

export interface VideoQualityOption {
  qualityLabel: string; // e.g. "1080p", "720p", "480p", "Auto"
  resolution?: { width: number; height: number };
  bitrate?: number;
  streamUrl: string;
  isHLS: boolean;
  mimeType?: string;
}

export interface MediaAsset {
  provider: MediaProviderType;
  sourceUrl: string;
  posterUrl?: string;
  durationSeconds?: number;
  qualities: VideoQualityOption[];
}

export interface ResourceAttachment {
  id: string;
  fileName: string;
  downloadUrl: string;
  fileExtension: string;
  fileSizeBytes?: number;
}

export interface CourseLesson {
  lessonId: string;
  lessonIndex: number;
  lessonTitle: string;
  url: string;
  moduleTitle?: string;
  moduleIndex?: number;
  courseTitle?: string;
  communityName?: string;
  descriptionHtml?: string;
  media?: MediaAsset;
  attachments: ResourceAttachment[];
  isCompleted?: boolean;
}

export interface CourseModule {
  moduleId: string;
  moduleIndex: number;
  moduleTitle: string;
  lessons: CourseLesson[];
}

export interface CourseHierarchy {
  courseId: string;
  courseTitle: string;
  communityName: string;
  modules: CourseModule[];
  scannedAt: number;
  totalLessons: number;
  totalVideos: number;
  totalAttachments: number;
}
