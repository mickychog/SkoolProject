/**
 * Message Protocol Contracts across Chrome Extension contexts:
 * Popup <-> Content Script <-> Background Service Worker <-> Offscreen Document.
 */

import { CourseHierarchy, CourseLesson } from './course';
import { DownloadTask, QueueState, TaskStatus } from './queue';

export type ExtensionMessage =
  // 1. Popup -> Content Script
  | { type: 'SCAN_ACTIVE_LESSON' }
  | { type: 'SCAN_FULL_COURSE' }

  // 2. Content Script -> Popup / SW
  | { type: 'LESSON_SCANNED_SUCCESS'; payload: CourseLesson }
  | { type: 'COURSE_SCANNED_SUCCESS'; payload: CourseHierarchy }
  | { type: 'SCAN_PROGRESS_UPDATE'; payload: { percent: number; currentItem: string } }
  | { type: 'SCAN_ERROR'; payload: { message: string } }

  // 3. Popup -> Background SW (Queue Commands)
  | {
      type: 'QUEUE_ADD_TASKS';
      payload: {
        tasks: Array<
          Omit<
            DownloadTask,
            'id' | 'status' | 'progressPercent' | 'bytesDownloaded' | 'retryCount' | 'createdAt'
          >
        >;
      };
    }
  | { type: 'QUEUE_PAUSE' }
  | { type: 'QUEUE_RESUME' }
  | { type: 'QUEUE_CANCEL_TASK'; payload: { taskId: string } }
  | { type: 'QUEUE_REMOVE_TASK'; payload: { taskId: string } }
  | { type: 'QUEUE_RETRY_FAILED' }
  | { type: 'QUEUE_CLEAR_COMPLETED' }
  | { type: 'QUEUE_CLEAR_ALL' }
  | { type: 'QUEUE_GET_STATE' }

  // 4. Background SW -> Popup (State Updates)
  | { type: 'QUEUE_STATE_CHANGED'; payload: QueueState }
  | {
      type: 'TASK_PROGRESS_UPDATE';
      payload: {
        taskId: string;
        progressPercent: number;
        bytesDownloaded: number;
        totalBytes?: number;
        status: TaskStatus;
      };
    }

  // 5. Background SW <-> Offscreen Document
  | {
      type: 'OFFSCREEN_START_HLS_DOWNLOAD';
      payload: {
        taskId: string;
        manifestUrl: string;
        targetFileName: string;
        headers?: Record<string, string>;
      };
    }
  | {
      type: 'OFFSCREEN_START_DIRECT_DOWNLOAD';
      payload: {
        taskId: string;
        url: string;
        targetFileName: string;
      };
    }
  | {
      type: 'OFFSCREEN_HLS_PROGRESS';
      payload: {
        taskId: string;
        percent: number;
        chunksProcessed: number;
        totalChunks: number;
      };
    }
  | {
      type: 'OFFSCREEN_HLS_COMPLETED';
      payload: {
        taskId: string;
        blobUrl: string;
      };
    }
  | {
      type: 'OFFSCREEN_HLS_FAILED';
      payload: {
        taskId: string;
        error: string;
      };
    };
