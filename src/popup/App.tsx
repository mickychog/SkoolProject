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
      const response = await chrome.runtime.sendMessage({ type: 'QUEUE_GET_STATE' });
      if (response?.payload) {
        setQueueState(response.payload);
      }
    } catch {
      // Background worker might be starting, safe to ignore
    }
  }, []);

  const fetchActiveLesson = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage('Escaneando lección en pestaña activa...');
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (tab?.id && tab.url?.includes('skool.com')) {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'SCAN_ACTIVE_LESSON' });
        if (response?.type === 'LESSON_SCANNED_SUCCESS') {
          setActiveLesson(response.payload);
          setStatusMessage('');
        } else {
          setStatusMessage(response?.payload?.message || 'Abre una lección de Skool para detectarla.');
        }
      } else {
        setStatusMessage('Navega a una lección de Skool en la pestaña activa.');
      }
    } catch {
      setStatusMessage('Navega a una lección de Skool y presiona Reescanear.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchFullCourse = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage('Escaneando estructura del aula virtual...');
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (tab?.id && tab.url?.includes('skool.com')) {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'SCAN_FULL_COURSE' });
        if (response?.type === 'COURSE_SCANNED_SUCCESS') {
          setCourseData(response.payload);
          setStatusMessage('');
        } else {
          setStatusMessage(response?.payload?.message || 'Abre el aula virtual (Classroom) en Skool.');
        }
      } else {
        setStatusMessage('Abre una comunidad de Skool en la pestaña activa.');
      }
    } catch {
      setStatusMessage('Error al conectar con la página. Recarga la pestaña de Skool.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveLesson();
    fetchQueueState();

    const messageListener = (message: any) => {
      if (message && message.type === 'QUEUE_STATE_CHANGED' && message.payload) {
        setQueueState(message.payload);
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [fetchActiveLesson, fetchQueueState]);

  const handleDownloadActiveLesson = async () => {
    if (!activeLesson) return;

    const tasks: any[] = [];
    if (activeLesson.media) {
      tasks.push({
        courseTitle: 'Skool Course',
        moduleTitle: 'Module 01',
        moduleIndex: 1,
        lessonTitle: activeLesson.lessonTitle,
        lessonIndex: activeLesson.lessonIndex,
        assetType: 'video',
        title: `${activeLesson.lessonTitle} (Video)`,
        sourceUrl: activeLesson.media.sourceUrl,
        suggestedFileName: `${activeLesson.lessonTitle}.mp4`,
        targetFolder: 'Skool/Course/01_Module/',
      });
    }

    activeLesson.attachments.forEach((att) => {
      tasks.push({
        courseTitle: 'Skool Course',
        moduleTitle: 'Module 01',
        moduleIndex: 1,
        lessonTitle: activeLesson.lessonTitle,
        lessonIndex: activeLesson.lessonIndex,
        assetType: 'attachment',
        title: att.fileName,
        sourceUrl: att.downloadUrl,
        suggestedFileName: att.fileName,
        targetFolder: 'Skool/Course/01_Module/',
      });
    });

    await handleEnqueueTasks(tasks);
  };

  const handleEnqueueTasks = async (tasks: any[]) => {
    if (!tasks || tasks.length === 0) return;

    try {
      await chrome.runtime.sendMessage({
        type: 'QUEUE_ADD_TASKS',
        payload: { tasks },
      });
    } catch {
      // Ignore
    }
    await fetchQueueState();
    setActiveTab('queue');
  };

  const handleCancelTask = async (taskId: string) => {
    try {
      await chrome.runtime.sendMessage({
        type: 'QUEUE_CANCEL_TASK',
        payload: { taskId },
      });
    } catch {
      // Ignore
    }
    await fetchQueueState();
  };

  const togglePauseQueue = async () => {
    const action = queueState.isPaused ? 'QUEUE_RESUME' : 'QUEUE_PAUSE';
    try {
      await chrome.runtime.sendMessage({ type: action });
    } catch {
      // Ignore
    }
    await fetchQueueState();
  };

  const clearCompleted = async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'QUEUE_CLEAR_COMPLETED' });
    } catch {
      // Ignore
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
      <main style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
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
                      {activeLesson.media ? '1 Video HD' : 'Sin video detectado'}
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
          <div>
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
              </div>
            </div>

            <DownloadQueueList tasks={taskList} onCancelTask={handleCancelTask} />
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
