// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { LessonScanner } from './lesson-scanner';
import { CourseScanner } from './course-scanner';

describe('DOM Scanners (Spec 02 & Spec 04)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.title = 'Introducción al Proyecto · Skool';
  });

  describe('LessonScanner', () => {
    it('extracts lesson title from DOM elements or document title', () => {
      document.body.innerHTML = `
        <div data-testid="lesson-title">Masterclass de TypeScript</div>
      `;
      expect(LessonScanner.extractLessonTitle()).toBe('Masterclass de TypeScript');
    });

    it('extracts lesson ID from URL and search parameters', () => {
      const url1 = 'https://www.skool.com/community-123/classroom/7c8f2be8?md=421e01b6d01849c1af4e1fe13310ef17';
      expect(LessonScanner.extractLessonId(url1)).toBe('421e01b6d01849c1af4e1fe13310ef17');

      const url2 = 'https://www.skool.com/community-123/classroom/module-a/lesson-intro';
      expect(LessonScanner.extractLessonId(url2)).toBe('lesson-intro');
    });

    it('extracts attachment download links cleanly', () => {
      document.body.innerHTML = `
        <div class="attachments-list">
          <a href="https://s3.amazonaws.com/bucket/Guia_Estudio.pdf" download>Guía de Estudio</a>
          <a href="https://cloudfront.net/files/Plantilla.xlsx?token=123">Plantilla de Trabajo.xlsx</a>
        </div>
      `;

      const attachments = LessonScanner.extractAttachments();
      expect(attachments.length).toBe(2);
      expect(attachments[0].fileName).toBe('Guía de Estudio.pdf');
      expect(attachments[0].fileExtension).toBe('pdf');
      expect(attachments[1].fileName).toBe('Plantilla de Trabajo.xlsx');
      expect(attachments[1].fileExtension).toBe('xlsx');
    });
  });

  describe('CourseScanner', () => {
    it('extracts modules and nested lesson items from sidebar markup', () => {
      document.body.innerHTML = `
        <h1 data-testid="course-title">Curso Fullstack Pro</h1>
        <div data-testid="community-name">Comunidad Devs</div>
        <div class="sidebar">
          <div data-testid="module-item">
            <h3 class="header">Módulo 1: Fundamentos</h3>
            <a href="https://www.skool.com/com/classroom/m1-l1">01. Bienvenida</a>
            <a href="https://www.skool.com/com/classroom/m1-l2">02. Setup del Entorno</a>
          </div>
          <div data-testid="module-item">
            <h3 class="header">Módulo 2: Arquitectura</h3>
            <a href="https://www.skool.com/com/classroom/m2-l1">01. Patrones de Diseño</a>
          </div>
        </div>
      `;

      const hierarchy = CourseScanner.scanHierarchy();
      expect(hierarchy).not.toBeNull();
      expect(hierarchy?.courseTitle).toBe('Curso Fullstack Pro');
      expect(hierarchy?.communityName).toBe('Comunidad Devs');
      expect(hierarchy?.modules.length).toBe(2);
      expect(hierarchy?.modules[0].moduleTitle).toBe('Módulo 1: Fundamentos');
      expect(hierarchy?.modules[0].lessons.length).toBe(2);
      expect(hierarchy?.modules[1].moduleTitle).toBe('Módulo 2: Arquitectura');
      expect(hierarchy?.modules[1].lessons.length).toBe(1);
      expect(hierarchy?.totalLessons).toBe(3);
    });
  });
});
