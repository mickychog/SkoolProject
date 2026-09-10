import { useState, useEffect, useCallback } from 'react';
import {
  Download,
  FolderTree,
  ListOrdered,
  Settings,
  Sparkles,
  Video,
  FileText,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { CourseLesson, CourseHierarchy } from '@/types/course';
import { QueueState } from '@/types/queue';
import { buildDownloadPath } from '@/utils/filename';
import CourseTreeView from './components/CourseTreeView';
import DownloadQueueList from './components/DownloadQueueList';

type TabType = 'lesson' | 'course' | 'queue' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('lesson');
  const [activeLesson, setActiveLesson] = useState<CourseLesson | null>(null);
  const [courseData, setCourseData] = useState<CourseHierarchy | null>(null);
  const [queueState, setQueueState] = useState<QueueState>({
    tasks: {},
    activeTaskIds: [],
    isPaused: false,
    maxConcurrent: 2,
    defaultQuality: '1080p',
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const fetchQueueState = useCallback(async () => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        const response = await chrome.runtime.sendMessage({ type: 'QUEUE_GET_STATE' });
        if (response?.payload) {
          setQueueState(response.payload);
        }
      } else {
        // Mock data for preview when tested in browser outside extension
        setQueueState({
          tasks: {
            task_1: {
              id: 'task_1',
              courseTitle: 'Masterclass Skool Pro',
              moduleTitle: '01. Fundamentos y Arquitectura',
              moduleIndex: 1,
              lessonTitle: '01. Bienvenida al Curso',
              lessonIndex: 1,
              assetType: 'video',
              title: '01. Bienvenida al Curso (Video HD)',
              sourceUrl: 'https://stream.mux.com/sample.m3u8',
              suggestedFileName: '01_Bienvenida.mp4',
              targetFolder: 'Skool/Masterclass/01_Fundamentos/',
              status: 'downloading',
              progressPercent: 68,
              bytesDownloaded: 14500000,
              totalBytes: 21000000,
              retryCount: 0,
              createdAt: Date.now() - 5000,
            },
            task_2: {
              id: 'task_2',
              courseTitle: 'Masterclass Skool Pro',
              moduleTitle: '01. Fundamentos y Arquitectura',
              moduleIndex: 1,
              lessonTitle: '02. Recursos y Plantillas',
              lessonIndex: 2,
              assetType: 'attachment',
              title: 'Guia_Estudio_Oficial.pdf',
              sourceUrl: 'https://s3.amazonaws.com/files/Guia.pdf',
              suggestedFileName: 'Guia_Estudio_Oficial.pdf',
              targetFolder: 'Skool/Masterclass/01_Fundamentos/',
              status: 'queued',
              progressPercent: 0,
              bytesDownloaded: 0,
              retryCount: 0,
              createdAt: Date.now() - 2000,
            },
          },
          activeTaskIds: ['task_1'],
          isPaused: false,
          maxConcurrent: 2,
          defaultQuality: '1080p',
        });
      }
    } catch {
      // Safe fallback
    }
  }, []);

  const fetchActiveLesson = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage('Escaneando lección en pestaña activa...');
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (tab?.id && tab.url?.includes('skool.com')) {
          let response: any = null;
          try {
            response = await chrome.tabs.sendMessage(tab.id, { type: 'SCAN_ACTIVE_LESSON' });
          } catch {
            // Auto-recovery: inject content script if tab was opened before extension reload
            try {
              if (chrome.scripting?.executeScript) {
                await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  files: ['src/content/index.ts'],
                });
                await new Promise((r) => setTimeout(r, 120));
                response = await chrome.tabs.sendMessage(tab.id, { type: 'SCAN_ACTIVE_LESSON' });
              }
            } catch {
              // Ignore
            }
          }

          if (response?.type === 'LESSON_SCANNED_SUCCESS' && response.payload) {
            setActiveLesson(response.payload);
            setStatusMessage('');
          } else {
            setStatusMessage(response?.payload?.message || 'Abre una lección de Skool para detectarla.');
          }
        } else {
          setStatusMessage('Navega a una lección de Skool en la pestaña activa.');
        }
      } else {
        // Mock data when rendered in standard web browser preview
        setActiveLesson({
          lessonId: 'lesson_intro',
          lessonIndex: 1,
          lessonTitle: '01. Introducción al Desarrollo con Skool',
          url: 'https://www.skool.com/community/classroom/course-1?md=lesson_intro',
          descriptionHtml: 'Lección introductoria con conceptos clave y diagrama de arquitectura.',
          media: {
            provider: 'skool_native',
            sourceUrl: 'https://stream.mux.com/sample.m3u8',
            qualities: [{ qualityLabel: '1080p', streamUrl: 'https://stream.mux.com/sample.m3u8', isHLS: true }],
          },
          attachments: [
            { id: 'att_1', fileName: 'Diagrama_Arquitectura.pdf', downloadUrl: 'https://s3.amazonaws.com/diagram.pdf', fileExtension: 'pdf' },
            { id: 'att_2', fileName: 'Plantilla_Inicio.xlsx', downloadUrl: 'https://s3.amazonaws.com/template.xlsx', fileExtension: 'xlsx' },
          ],
        });
        setStatusMessage('');
      }
    } catch {
      setStatusMessage('Recarga la pestaña de Skool (F5) y presiona Reescanear.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchFullCourse = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage('Escaneando estructura del aula virtual...');
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (tab?.id && tab.url?.includes('skool.com')) {
          let response: any = null;
          try {
            response = await chrome.tabs.sendMessage(tab.id, { type: 'SCAN_FULL_COURSE' });
          } catch {
            // Auto-recovery: inject content script if tab was opened before extension reload
            try {
              if (chrome.scripting?.executeScript) {
                await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  files: ['src/content/index.ts'],
                });
                await new Promise((r) => setTimeout(r, 120));
                response = await chrome.tabs.sendMessage(tab.id, { type: 'SCAN_FULL_COURSE' });
              }
            } catch {
              // Ignore
            }
          }

          if (response?.type === 'COURSE_SCANNED_SUCCESS' && response.payload) {
            setCourseData(response.payload);
            setStatusMessage('');
          } else {
            setStatusMessage(response?.payload?.message || 'Abre el aula virtual (Classroom) en Skool.');
          }
        } else {
          setStatusMessage('Abre una comunidad de Skool en la pestaña activa.');
        }
      } else {
        // Mock full course data when rendered in browser preview
        setCourseData({
          courseId: 'course_preview_1',
          courseTitle: 'Desarrollo Avanzado de Aplicaciones Web',
          communityName: 'Devs Hispanos',
          scannedAt: Date.now(),
          totalLessons: 6,
          totalVideos: 5,
          totalAttachments: 3,
          modules: [
            {
              moduleId: 'mod_1',
              moduleIndex: 1,
              moduleTitle: 'Módulo 1: Fundamentos y Setup de Entorno',
              lessons: [
                {
                  lessonId: 'l1',
                  lessonIndex: 1,
                  lessonTitle: '01. Bienvenida y Roadmap del Curso',
                  url: 'https://www.skool.com/c/m1/l1',
                  media: { provider: 'skool_native', sourceUrl: 'https://stream.mux.com/1.m3u8', qualities: [{ qualityLabel: '1080p', streamUrl: 'https://stream.mux.com/1.m3u8', isHLS: true }] },
                  attachments: [{ id: 'a1', fileName: 'Roadmap_Estudio.pdf', downloadUrl: 'https://s3/roadmap.pdf', fileExtension: 'pdf' }],
                },
                {
                  lessonId: 'l2',
                  lessonIndex: 2,
                  lessonTitle: '02. Configuración de IDE y Extensiones',
                  url: 'https://www.skool.com/c/m1/l2',
                  media: { provider: 'loom', sourceUrl: 'https://loom.com/share/2', qualities: [{ qualityLabel: '1080p', streamUrl: 'https://loom.com/2', isHLS: false }] },
                  attachments: [],
                },
              ],
            },
            {
              moduleId: 'mod_2',
              moduleIndex: 2,
              moduleTitle: 'Módulo 2: Arquitectura y Patrones de Diseño',
              lessons: [
                {
                  lessonId: 'l3',
                  lessonIndex: 1,
                  lessonTitle: '01. Principios SOLID en TypeScript',
                  url: 'https://www.skool.com/c/m2/l1',
                  media: { provider: 'vimeo', sourceUrl: 'https://player.vimeo.com/video/3', qualities: [{ qualityLabel: '1080p', streamUrl: 'https://vimeo/3.mp4', isHLS: false }] },
                  attachments: [{ id: 'a2', fileName: 'Ejercicios_SOLID.zip', downloadUrl: 'https://s3/solid.zip', fileExtension: 'zip' }],
                },
                {
                  lessonId: 'l4',
                  lessonIndex: 2,
                  lessonTitle: '02. Patrón Strategy y Dependency Injection',
                  url: 'https://www.skool.com/c/m2/l2',
                  media: { provider: 'skool_native', sourceUrl: 'https://stream.mux.com/4.m3u8', qualities: [{ qualityLabel: '1080p', streamUrl: 'https://stream.mux.com/4.m3u8', isHLS: true }] },
                  attachments: [],
                },
              ],
            },
            {
              moduleId: 'mod_3',
              moduleIndex: 3,
              moduleTitle: 'Módulo 3: Despliegue y Distribución',
              lessons: [
                {
                  lessonId: 'l5',
                  lessonIndex: 1,
                  lessonTitle: '01. Creación del Bundle y Manifiesto V3',
                  url: 'https://www.skool.com/c/m3/l1',
                  media: { provider: 'skool_native', sourceUrl: 'https://stream.mux.com/5.m3u8', qualities: [{ qualityLabel: '1080p', streamUrl: 'https://stream.mux.com/5.m3u8', isHLS: true }] },
                  attachments: [{ id: 'a3', fileName: 'Guia_Despliegue.pdf', downloadUrl: 'https://s3/deploy.pdf', fileExtension: 'pdf' }],
                },
                {
                  lessonId: 'l6',
                  lessonIndex: 2,
                  lessonTitle: '02. Publicación en Chrome Web Store',
                  url: 'https://www.skool.com/c/m3/l2',
                  attachments: [],
                },
              ],
            },
          ],
        });
        setStatusMessage('');
      }
    } catch {
      setStatusMessage('Error al conectar con la página. Recarga la pestaña de Skool (F5).');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveLesson();
    fetchQueueState();

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      const messageListener = (message: any) => {
        if (message && message.type === 'QUEUE_STATE_CHANGED' && message.payload) {
          setQueueState(message.payload);
        }
      };
      chrome.runtime.onMessage.addListener(messageListener);
      return () => {
        chrome.runtime.onMessage.removeListener(messageListener);
      };
    }
  }, [fetchActiveLesson, fetchQueueState]);

  const handleDownloadActiveLesson = async () => {
    setIsLoading(true);
    try {
      let lesson = activeLesson;

      if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];

        if (tab?.id && tab.url?.includes('skool.com')) {
          try {
            const res = await chrome.tabs.sendMessage(tab.id, { type: 'SCAN_ACTIVE_LESSON' });
            if (res?.type === 'LESSON_SCANNED_SUCCESS' && res.payload) {
              lesson = res.payload;
              setActiveLesson(lesson);
            }
          } catch {
            // Fallback to existing activeLesson
          }
        }
      }

      if (!lesson) {
        setStatusMessage('Abre una lección de Skool para descargarla.');
        setIsLoading(false);
        return;
      }

      const tasks: any[] = [];
      const mediaSource = lesson.media?.sourceUrl;
      const communityName = 'Skool';
      const courseTitle = document.title.replace('· Skool', '').trim() || 'Curso';

      if (mediaSource) {
        const targetPath = buildDownloadPath({
          communityName,
          courseTitle,
          moduleIndex: 1,
          moduleTitle: 'Module 01',
          lessonIndex: lesson.lessonIndex,
          lessonTitle: lesson.lessonTitle,
          extension: '.mp4',
        });
        const pathParts = targetPath.split('/');
        const suggestedFileName = pathParts.pop()!;
        const targetFolder = pathParts.join('/') + '/';

        tasks.push({
          courseTitle,
          moduleTitle: 'Module 01',
          moduleIndex: 1,
          lessonTitle: lesson.lessonTitle,
          lessonIndex: lesson.lessonIndex,
          assetType: 'video',
          title: `${lesson.lessonTitle} (Video)`,
          sourceUrl: mediaSource,
          suggestedFileName,
          targetFolder,
        });
      }

      // Add attachments
      lesson.attachments.forEach((att) => {
        const targetPath = buildDownloadPath({
          communityName,
          courseTitle,
          moduleIndex: 1,
          moduleTitle: 'Module 01',
          lessonIndex: lesson.lessonIndex,
          lessonTitle: lesson.lessonTitle,
          assetTitle: att.fileName.replace(/\.[^/.]+$/, ''),
          extension: att.fileExtension,
        });
        const pathParts = targetPath.split('/');
        const suggestedFileName = pathParts.pop()!;
        const targetFolder = pathParts.join('/') + '/';

        tasks.push({
          courseTitle,
          moduleTitle: 'Module 01',
          moduleIndex: 1,
          lessonTitle: lesson.lessonTitle,
          lessonIndex: lesson.lessonIndex,
          assetType: 'attachment',
          title: att.fileName,
          sourceUrl: att.downloadUrl,
          suggestedFileName,
          targetFolder,
        });
      });

      if (tasks.length === 0) {
        setStatusMessage('Esta lección no contiene video ni archivos descargables.');
        setIsLoading(false);
        return;
      }

      await handleEnqueueTasks(tasks);
    } catch {
      setStatusMessage('Error al encolar la lección.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnqueueTasks = async (tasks: any[]) => {
    if (!tasks || tasks.length === 0) return;

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        await chrome.runtime.sendMessage({
          type: 'QUEUE_ADD_TASKS',
          payload: { tasks },
        });
      } else {
        // Mock add in preview mode
        const newTasks = { ...queueState.tasks };
        tasks.forEach((t, i) => {
          const id = `mock_task_${Date.now()}_${i}`;
          newTasks[id] = {
            ...t,
            id,
            status: 'queued',
            progressPercent: 0,
            bytesDownloaded: 0,
            retryCount: 0,
            createdAt: Date.now(),
          };
        });
        setQueueState({ ...queueState, tasks: newTasks });
      }
    } catch {
      // Safe fallback
    }
    await fetchQueueState();
    setActiveTab('queue');
  };

  const handleRemoveTask = async (taskId: string) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        await chrome.runtime.sendMessage({
          type: 'QUEUE_REMOVE_TASK',
          payload: { taskId },
        });
      } else {
        const nextTasks = { ...queueState.tasks };
        delete nextTasks[taskId];
        setQueueState({ ...queueState, tasks: nextTasks });
      }
    } catch {
      // Safe fallback
    }
    await fetchQueueState();
  };

  const togglePauseQueue = async () => {
    const action = queueState.isPaused ? 'QUEUE_RESUME' : 'QUEUE_PAUSE';
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        await chrome.runtime.sendMessage({ type: action });
      } else {
        setQueueState({ ...queueState, isPaused: !queueState.isPaused });
      }
    } catch {
      // Safe fallback
    }
    await fetchQueueState();
  };

  const clearCompleted = async () => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        await chrome.runtime.sendMessage({ type: 'QUEUE_CLEAR_COMPLETED' });
      } else {
        const remaining: any = {};
        Object.values(queueState.tasks).forEach((t) => {
          if (t.status !== 'completed' && t.status !== 'failed') {
            remaining[t.id] = t;
          }
        });
        setQueueState({ ...queueState, tasks: remaining });
      }
    } catch {
      // Safe fallback
    }
    await fetchQueueState();
  };

  const handleClearAll = async () => {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        await chrome.runtime.sendMessage({ type: 'QUEUE_CLEAR_ALL' });
      } else {
        setQueueState({ ...queueState, tasks: {}, activeTaskIds: [] });
      }
    } catch {
      // Safe fallback
    }
    await fetchQueueState();
  };

  const taskList = Object.values(queueState.tasks || {});
  const activeCount = queueState.activeTaskIds?.length || 0;
  const totalInQueue = taskList.filter((t) => t.status === 'queued' || t.status === 'downloading' || t.status === 'processing').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '560px', backgroundColor: '#090d16' }}>
      {/* Top Header */}
      <header
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #3b82f6, #10b981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={16} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', lineHeight: 1.2 }}>
              Skool Downloader
            </h1>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Spec-Driven Edition</span>
          </div>
        </div>

        {totalInQueue > 0 && (
          <div
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '999px',
              backgroundColor: '#1e3a8a',
              color: '#93c5fd',
              fontWeight: 600,
            }}
          >
            {activeCount} activo / {totalInQueue} en cola
          </div>
        )}
      </header>

      {/* Navigation Tabs */}
      <nav
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          borderBottom: '1px solid #1e293b',
          background: '#0c1322',
        }}
      >
        <button
          onClick={() => setActiveTab('lesson')}
          style={{
            padding: '10px 4px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'lesson' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'lesson' ? '#60a5fa' : '#94a3b8',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <Video size={14} />
          Lección
        </button>

        <button
          onClick={() => {
            setActiveTab('course');
            if (!courseData) fetchFullCourse();
          }}
          style={{
            padding: '10px 4px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'course' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'course' ? '#60a5fa' : '#94a3b8',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <FolderTree size={14} />
          Curso
        </button>

        <button
          onClick={() => {
            fetchQueueState();
            setActiveTab('queue');
          }}
          style={{
            padding: '10px 4px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'queue' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'queue' ? '#60a5fa' : '#94a3b8',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            position: 'relative',
          }}
        >
          <ListOrdered size={14} />
          Cola
          {taskList.length > 0 && (
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#3b82f6',
              }}
            />
          )}
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          style={{
            padding: '10px 4px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'settings' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'settings' ? '#60a5fa' : '#94a3b8',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <Settings size={14} />
          Ajustes
        </button>
      </nav>

      {/* Main Tab Content Area */}
      <main
        style={{
          flex: 1,
          overflowY: activeTab === 'course' ? 'hidden' : 'auto',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {/* TAB 1: ACTIVE LESSON */}
        {activeTab === 'lesson' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {activeLesson ? (
              <>
                <div
                  style={{
                    backgroundColor: '#111827',
                    border: '1px solid #1f2937',
                    borderRadius: '10px',
                    padding: '14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: '#1e293b',
                        color: '#38bdf8',
                        fontWeight: 700,
                      }}
                    >
                      Lección Detectada
                    </span>
                  </div>
                  <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#f1f5f9', marginBottom: '8px' }}>
                    {activeLesson.lessonTitle}
                  </h2>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#94a3b8' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Video size={13} color="#60a5fa" />
                      {activeLesson.media ? '1 Video HD' : 'Texto / Sin Video'}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FileText size={13} color="#34d399" />
                      {activeLesson.attachments.length} Recursos
                    </span>
                  </div>
                </div>

                {/* Attachments Preview */}
                {activeLesson.attachments.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      Recursos Adjuntos ({activeLesson.attachments.length})
                    </span>
                    {activeLesson.attachments.map((att) => (
                      <div
                        key={att.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          backgroundColor: '#0f172a',
                          border: '1px solid #1e293b',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}
                      >
                        <span style={{ color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '280px' }}>
                          {att.fileName}
                        </span>
                        <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>
                          {att.fileExtension}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleDownloadActiveLesson}
                  disabled={isLoading}
                  style={{
                    marginTop: '8px',
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: '#2563eb',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                  }}
                >
                  <Download size={16} />
                  Descargar Lección Completa
                </button>
              </>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px 20px',
                  textAlign: 'center',
                  gap: '12px',
                }}
              >
                <Layers size={36} color="#475569" />
                <p style={{ fontSize: '13px', color: '#94a3b8' }}>
                  {statusMessage || 'Abre una lección de Skool para detectarla automáticamente.'}
                </p>
                <button
                  onClick={fetchActiveLesson}
                  disabled={isLoading}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    color: '#f1f5f9',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                  Reescanear Pestaña
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FULL COURSE TREE */}
        {activeTab === 'course' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {courseData && courseData.modules.length > 0 ? (
              <CourseTreeView course={courseData} onEnqueueTasks={handleEnqueueTasks} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center', padding: '20px 0' }}>
                <FolderTree size={36} color="#60a5fa" style={{ margin: '0 auto' }} />
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
                  Escáner de Curso Completo
                </h3>
                <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
                  {statusMessage || 'Genera el árbol jerárquico de módulos, lecciones y archivos adjuntos del aula virtual.'}
                </p>
                <button
                  onClick={fetchFullCourse}
                  disabled={isLoading}
                  style={{
                    marginTop: '10px',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#10b981',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
                  Escanear Estructura del Curso
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DOWNLOAD QUEUE */}
        {activeTab === 'queue' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
                {taskList.length} Tareas Totales
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={togglePauseQueue}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    color: '#cbd5e1',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {queueState.isPaused ? <Play size={11} color="#34d399" /> : <Pause size={11} color="#fbbf24" />}
                  {queueState.isPaused ? 'Reanudar' : 'Pausar'}
                </button>
                <button
                  onClick={clearCompleted}
                  title="Eliminar descargas completadas o con error"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    color: '#cbd5e1',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Trash2 size={11} />
                  Limpiar
                </button>
                <button
                  onClick={handleClearAll}
                  title="Eliminar todas las descargas de la cola"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#450a0a',
                    border: '1px solid #7f1d1d',
                    color: '#fca5a5',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 600,
                  }}
                >
                  Eliminar Todo
                </button>
              </div>
            </div>

            <DownloadQueueList tasks={taskList} onRemoveTask={handleRemoveTask} />
          </div>
        )}

        {/* TAB 4: SETTINGS */}
        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
                Calidad de Video Predeterminada
              </label>
              <select
                value={queueState.defaultQuality}
                onChange={(e) => setQueueState({ ...queueState, defaultQuality: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: '#111827',
                  border: '1px solid #1f2937',
                  borderRadius: '6px',
                  color: '#f1f5f9',
                  fontSize: '12px',
                }}
              >
                <option value="1080p">1080p (Full HD)</option>
                <option value="720p">720p (HD)</option>
                <option value="480p">480p (SD)</option>
                <option value="highest">Máxima Disponible</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', display: 'block', marginBottom: '6px' }}>
                Descargas Simultáneas Máximas
              </label>
              <input
                type="number"
                min="1"
                max="4"
                value={queueState.maxConcurrent}
                onChange={(e) => setQueueState({ ...queueState, maxConcurrent: parseInt(e.target.value) || 2 })}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: '#111827',
                  border: '1px solid #1f2937',
                  borderRadius: '6px',
                  color: '#f1f5f9',
                  fontSize: '12px',
                }}
              />
              <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                Recomendado: 2 para evitar saturación de red y rate limits.
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
