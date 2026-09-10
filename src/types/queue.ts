/**
 * Download Queue & Task State Types.
 */

export type TaskStatus =
  | 'idle'
  | 'queued'
  | 'downloading'
  | 'processing' // e.g. HLS assembling / muxing in offscreen
  | 'completed'
  | 'failed'
  | 'paused';

export type TaskAssetType = 'video' | 'attachment';

export interface DownloadTask {
  id: string;
  courseTitle: string;
  moduleTitle: string;
  moduleIndex: number;
  lessonTitle: string;
  lessonIndex: number;
  assetType: TaskAssetType;
  title: string;
  sourceUrl: string;
  suggestedFileName: string;
  targetFolder: string; // e.g. "Skool/CourseName/01_Module/"
  status: TaskStatus;
  progressPercent: number;
  bytesDownloaded: number;
  totalBytes?: number;
  error?: string;
  retryCount: number;
  chromeDownloadId?: number;
  createdAt: number;
  completedAt?: number;
}

export interface QueueState {
  tasks: Record<string, DownloadTask>;
  activeTaskIds: string[];
  isPaused: boolean;
  maxConcurrent: number;
  defaultQuality: string;
}
