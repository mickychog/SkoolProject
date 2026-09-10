import { describe, it, expect } from 'vitest';
import { ManifestGenerator } from './manifest-generator';
import { CourseHierarchy } from '@/types/course';

describe('ManifestGenerator (Spec 01 & 03)', () => {
  const sampleCourse: CourseHierarchy = {
    courseId: 'course_123',
    courseTitle: 'Fullstack AI Masterclass <Pro>',
    communityName: 'Dev Academy & Co',
    scannedAt: Date.now(),
    totalLessons: 2,
    totalVideos: 2,
    totalAttachments: 1,
    modules: [
      {
        moduleId: 'mod_1',
        moduleIndex: 1,
        moduleTitle: '01. Introducción',
        lessons: [
          {
            lessonId: 'l1',
            lessonIndex: 1,
            lessonTitle: 'Bienvenida al Curso',
            url: 'https://skool.com/classroom/l1',
            attachments: [
              {
                id: 'att_1',
                fileName: 'Recursos.pdf',
                downloadUrl: 'https://s3.amazonaws.com/Recursos.pdf',
                fileExtension: 'pdf',
              },
            ],
          },
        ],
      },
    ],
  };

  it('generates valid JSON manifest', () => {
    const jsonStr = ManifestGenerator.generateJsonManifest(sampleCourse);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.courseId).toBe('course_123');
    expect(parsed.modules.length).toBe(1);
    expect(parsed.modules[0].lessons[0].attachments.length).toBe(1);
  });

  it('generates standalone HTML offline viewer with escaped titles and player scripts', () => {
    const htmlStr = ManifestGenerator.generateOfflineHtmlViewer(sampleCourse);
    expect(htmlStr).toContain('<!DOCTYPE html>');
    expect(htmlStr).toContain('Fullstack AI Masterclass &lt;Pro&gt;');
    expect(htmlStr).toContain('Dev Academy &amp; Co');
    expect(htmlStr).toContain('id="player"');
    expect(htmlStr).toContain('renderTree()');
  });
});
