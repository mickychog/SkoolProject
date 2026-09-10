import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Video,
  FileText,
  CheckSquare,
  Square,
  DownloadCloud,
  FileCode,
  SlidersHorizontal,
} from 'lucide-react';
import { CourseHierarchy, CourseLesson } from '@/types/course';
import { buildDownloadPath } from '@/utils/filename';
import { ManifestGenerator } from '@/utils/manifest-generator';

interface Props {
  course: CourseHierarchy;
  onEnqueueTasks: (tasks: any[]) => void;
}

type FilterType = 'all' | 'videos_only' | 'attachments_only';

export default function CourseTreeView({ course, onEnqueueTasks }: Props) {
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});
  const [filterMode, setFilterMode] = useState<FilterType>('all');
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(() => {
    const allIds = new Set<string>();
    course.modules.forEach((mod) => {
      mod.lessons.forEach((l) => allIds.add(l.lessonId));
    });
    return allIds;
  });

  const toggleModuleCollapse = (moduleId: string) => {
    setCollapsedModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  const toggleLessonSelection = (lessonId: string) => {
    setSelectedLessonIds((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) {
        next.delete(lessonId);
      } else {
        next.add(lessonId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLessonIds.size > 0) {
      setSelectedLessonIds(new Set());
    } else {
      const allIds = new Set<string>();
      course.modules.forEach((mod) => {
        mod.lessons.forEach((l) => allIds.add(l.lessonId));
      });
      setSelectedLessonIds(allIds);
    }
  };

  const handleDownloadSelected = () => {
    const tasks: any[] = [];

    course.modules.forEach((mod) => {
      mod.lessons.forEach((lesson: CourseLesson) => {
        if (selectedLessonIds.has(lesson.lessonId)) {
          // Add Video task if permitted by filter
          if (filterMode !== 'attachments_only') {
            const targetPath = buildDownloadPath({
              communityName: course.communityName,
              courseTitle: course.courseTitle,
              moduleIndex: mod.moduleIndex,
              moduleTitle: mod.moduleTitle,
              lessonIndex: lesson.lessonIndex,
              lessonTitle: lesson.lessonTitle,
              extension: '.mp4',
            });
            const pathParts = targetPath.split('/');
            const suggestedFileName = pathParts.pop()!;
            const targetFolder = pathParts.join('/') + '/';

            const videoUrl = lesson.media?.sourceUrl || lesson.url;
            if (videoUrl) {
              tasks.push({
                courseTitle: course.courseTitle,
                moduleTitle: mod.moduleTitle,
                moduleIndex: mod.moduleIndex,
                lessonTitle: lesson.lessonTitle,
                lessonIndex: lesson.lessonIndex,
                assetType: 'video',
                title: `${lesson.lessonTitle} (Video)`,
                sourceUrl: videoUrl,
                suggestedFileName,
                targetFolder,
              });
            }
          }

          // Add Attachment tasks if permitted by filter
          if (filterMode !== 'videos_only') {
            lesson.attachments.forEach((att) => {
              const targetPath = buildDownloadPath({
                communityName: course.communityName,
                courseTitle: course.courseTitle,
                moduleIndex: mod.moduleIndex,
                moduleTitle: mod.moduleTitle,
                lessonIndex: lesson.lessonIndex,
                lessonTitle: lesson.lessonTitle,
                assetTitle: att.fileName.replace(/\.[^/.]+$/, ''),
                extension: att.fileExtension,
              });
              const pathParts = targetPath.split('/');
              const suggestedFileName = pathParts.pop()!;
              const targetFolder = pathParts.join('/') + '/';

              tasks.push({
                courseTitle: course.courseTitle,
                moduleTitle: mod.moduleTitle,
                moduleIndex: mod.moduleIndex,
                lessonTitle: lesson.lessonTitle,
                lessonIndex: lesson.lessonIndex,
                assetType: 'attachment',
                title: att.fileName,
                sourceUrl: att.downloadUrl,
                suggestedFileName,
                targetFolder,
              });
            });
          }
        }
      });
    });

    onEnqueueTasks(tasks);
  };

  const handleExportOfflineViewer = () => {
    const htmlContent = ManifestGenerator.generateOfflineHtmlViewer(course);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);

    const safeTitle = course.courseTitle.replace(/[/\\?%*:|"<>]/g, '_').trim();
    chrome.downloads.download({
      url: blobUrl,
      filename: `Skool/${course.communityName} - ${safeTitle}/index_offline.html`,
      saveAs: false,
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '450px',
        gap: '8px',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. Header / Filter Controls (Fixed) */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          padding: '8px 10px',
          backgroundColor: '#111827',
          border: '1px solid #1e293b',
          borderRadius: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={toggleSelectAll}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {selectedLessonIds.size > 0 ? (
              <CheckSquare size={15} color="#3b82f6" />
            ) : (
              <Square size={15} color="#64748b" />
            )}
            {selectedLessonIds.size === course.totalLessons
              ? 'Deseleccionar todo'
              : `Seleccionados (${selectedLessonIds.size}/${course.totalLessons})`}
          </button>

          <button
            onClick={handleExportOfflineViewer}
            title="Genera un archivo index_offline.html para ver el curso offline con un clic"
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '4px',
              color: '#38bdf8',
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
            }}
          >
            <FileCode size={12} />
            Visor Offline
          </button>
        </div>

        {/* Quick Filter Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <SlidersHorizontal size={11} color="#64748b" />
          <span style={{ fontSize: '10px', color: '#64748b', marginRight: '4px' }}>Filtro:</span>
          {(['all', 'videos_only', 'attachments_only'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: filterMode === mode ? '#2563eb' : '#1e293b',
                color: filterMode === mode ? '#fff' : '#94a3b8',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {mode === 'all' ? 'Todo' : mode === 'videos_only' ? 'Solo Videos' : 'Solo Adjuntos'}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Scrollable Modules Tree (Flexible & non-overflowing) */}
      <div
        style={{
          flex: 1,
          minHeight: '120px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          paddingRight: '2px',
        }}
      >
        {course.modules.map((mod) => {
          const isCollapsed = collapsedModules[mod.moduleId];

          return (
            <div
              key={mod.moduleId}
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <div
                onClick={() => toggleModuleCollapse(mod.moduleId)}
                style={{
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#131d31',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  {isCollapsed ? <ChevronRight size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#f1f5f9',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '220px',
                    }}
                  >
                    {mod.moduleTitle}
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                  {mod.lessons.length} lecciones
                </span>
              </div>

              {!isCollapsed && (
                <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {mod.lessons.map((lesson) => {
                    const isSelected = selectedLessonIds.has(lesson.lessonId);

                    return (
                      <div
                        key={lesson.lessonId}
                        onClick={() => toggleLessonSelection(lesson.lessonId)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          backgroundColor: isSelected ? '#1e293b' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                          {isSelected ? (
                            <CheckSquare size={13} color="#3b82f6" />
                          ) : (
                            <Square size={13} color="#475569" />
                          )}
                          <span
                            style={{
                              fontSize: '12px',
                              color: isSelected ? '#f8fafc' : '#94a3b8',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '190px',
                            }}
                          >
                            {lesson.lessonTitle}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          {lesson.media && <Video size={12} color="#60a5fa" />}
                          {lesson.attachments.length > 0 && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '10px', color: '#34d399' }}>
                              <FileText size={11} />
                              {lesson.attachments.length}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 3. Action Enqueue Button (Pinned at Bottom) */}
      <div style={{ flexShrink: 0, paddingTop: '4px' }}>
        <button
          onClick={handleDownloadSelected}
          disabled={selectedLessonIds.size === 0}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '8px',
            backgroundColor: selectedLessonIds.size > 0 ? '#10b981' : '#334155',
            border: 'none',
            color: '#fff',
            fontWeight: 600,
            fontSize: '13px',
            cursor: selectedLessonIds.size > 0 ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: selectedLessonIds.size > 0 ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none',
          }}
        >
          <DownloadCloud size={16} />
          Encolar {selectedLessonIds.size} Lecciones Seleccionadas
        </button>
      </div>
    </div>
  );
}
