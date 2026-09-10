import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Video,
  FileText,
  CheckSquare,
  Square,
  DownloadCloud,
} from 'lucide-react';
import { CourseHierarchy, CourseLesson } from '@/types/course';
import { buildDownloadPath } from '@/utils/filename';

interface Props {
  course: CourseHierarchy;
  onEnqueueTasks: (tasks: any[]) => void;
}

export default function CourseTreeView({ course, onEnqueueTasks }: Props) {
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(() => {
    // Select all lessons by default
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
          // Add Video task if available
          if (lesson.media) {
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

            tasks.push({
              courseTitle: course.courseTitle,
              moduleTitle: mod.moduleTitle,
              moduleIndex: mod.moduleIndex,
              lessonTitle: lesson.lessonTitle,
              lessonIndex: lesson.lessonIndex,
              assetType: 'video',
              title: `${lesson.lessonTitle} (Video)`,
              sourceUrl: lesson.media.sourceUrl,
              suggestedFileName,
              targetFolder,
            });
          }

          // Add Attachment tasks
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
      });
    });

    onEnqueueTasks(tasks);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Summary and Selection Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          backgroundColor: '#111827',
          border: '1px solid #1e293b',
          borderRadius: '8px',
        }}
      >
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

        <span style={{ fontSize: '11px', color: '#64748b' }}>
          {course.modules.length} módulos
        </span>
      </div>

      {/* Modules List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '330px', overflowY: 'auto' }}>
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
              }}
            >
              {/* Module Header */}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isCollapsed ? <ChevronRight size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#f1f5f9' }}>
                    {mod.moduleTitle}
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  {mod.lessons.length} lecciones
                </span>
              </div>

              {/* Module Lessons */}
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
                              maxWidth: '220px',
                            }}
                          >
                            {lesson.lessonTitle}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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

      {/* Action Download Button */}
      <button
        onClick={handleDownloadSelected}
        disabled={selectedLessonIds.size === 0}
        style={{
          padding: '12px',
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
  );
}
