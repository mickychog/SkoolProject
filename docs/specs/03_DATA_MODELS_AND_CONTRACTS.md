# 03 - Data Models and Messaging Contracts (Schema Spec)

## 1. Modelos de Dominio de Datos

### 1.1. Estructura Jerárquica del Curso (`src/types/course.ts`)
```typescript
export interface CourseHierarchy {
  courseId: string;
  courseTitle: string;
  communityName: string;
  modules: CourseModule[];
  scannedAt: number;
}

export interface CourseModule {
  moduleId: string;
  moduleIndex: number;
  moduleTitle: string;
  lessons: CourseLesson[];
}

export interface CourseLesson {
  lessonId: string;
  lessonIndex: number;
  lessonTitle: string;
  url: string;
  media?: MediaAsset;
  attachments: ResourceAttachment[];
}

export interface MediaAsset {
  provider: 'skool_native' | 'loom' | 'vimeo' | 'wistia' | 'youtube' | 'unknown';
  sourceUrl: string;
  posterUrl?: string;
  durationSeconds?: number;
  qualities: VideoQualityOption[];
}

export interface VideoQualityOption {
  qualityLabel: string; // ej. "1080p", "720p", "Auto"
  resolution?: { width: number; height: number };
  bitrate?: number;
  streamUrl: string;
  isHLS: boolean;
}

export interface ResourceAttachment {
  id: string;
  fileName: string;
  downloadUrl: string;
  fileExtension: string;
  fileSizeBytes?: number;
}
```

---

## 2. Modelos de la Cola de Descarga (`src/types/queue.ts`)

```typescript
export type TaskStatus = 'idle' | 'queued' | 'downloading' | 'processing' | 'completed' | 'failed' | 'paused';

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
  targetFolder: string; // ej. "Skool/CursoNombre/01_Modulo/"
  status: TaskStatus;
  progressPercent: number;
  bytesDownloaded: number;
  totalBytes?: number;
  error?: string;
  retryCount: number;
  createdAt: number;
  completedAt?: number;
}

export interface QueueState {
  tasks: Record<string, DownloadTask>;
  activeTaskIds: string[];
  isPaused: boolean;
  maxConcurrent: number;
}
```

---

## 3. Protocolo de Mensajería Tipado (`src/types/messages.ts`)

Todas las comunicaciones entre `Popup`, `Content Script`, `Background Service Worker` y `Offscreen Document` utilizan una **Unión Discriminada**:

```typescript
export type ExtensionMessage =
  // Peticiones desde Popup hacia Content Script
  | { type: 'SCAN_ACTIVE_LESSON' }
  | { type: 'SCAN_FULL_COURSE' }

  // Respuestas desde Content Script
  | { type: 'LESSON_SCANNED_SUCCESS'; payload: CourseLesson }
  | { type: 'COURSE_SCANNED_SUCCESS'; payload: CourseHierarchy }
  | { type: 'SCAN_ERROR'; payload: { message: string } }

  // Peticiones de Gestión de Cola hacia Background SW
  | { type: 'QUEUE_ADD_TASKS'; payload: { tasks: Omit<DownloadTask, 'id' | 'status' | 'progressPercent' | 'bytesDownloaded' | 'retryCount' | 'createdAt'>[] } }
  | { type: 'QUEUE_PAUSE' }
  | { type: 'QUEUE_RESUME' }
  | { type: 'QUEUE_CANCEL_TASK'; payload: { taskId: string } }
  | { type: 'QUEUE_RETRY_FAILED' }
  | { type: 'QUEUE_CLEAR_COMPLETED' }
  | { type: 'QUEUE_GET_STATE' }

  // Broadcasts de Estado desde Background SW hacia Popup
  | { type: 'QUEUE_STATE_CHANGED'; payload: QueueState }
  | { type: 'TASK_PROGRESS_UPDATE'; payload: { taskId: string; progressPercent: number; bytesDownloaded: number; totalBytes?: number; status: TaskStatus } }

  // Mensajes Inter-Process con Offscreen Document
  | { type: 'OFFSCREEN_START_HLS_DOWNLOAD'; payload: { taskId: string; manifestUrl: string; targetFileName: string } }
  | { type: 'OFFSCREEN_HLS_PROGRESS'; payload: { taskId: string; percent: number; chunksProcessed: number; totalChunks: number } }
  | { type: 'OFFSCREEN_HLS_COMPLETED'; payload: { taskId: string; blobUrl: string } }
  | { type: 'OFFSCREEN_HLS_FAILED'; payload: { taskId: string; error: string } };
```
