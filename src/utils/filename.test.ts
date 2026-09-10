import { describe, it, expect } from 'vitest';
import { sanitizeName, formatIndex, buildDownloadPath } from './filename';

describe('Filename and Path Sanitization (Spec 04)', () => {
  describe('sanitizeName', () => {
    it('removes illegal Windows/Linux characters', () => {
      const raw = 'How to: "Build" a <Great> App/Project? *Yes|No*';
      const clean = sanitizeName(raw);
      expect(clean).not.toMatch(/[\\/:*?"<>|]/);
      expect(clean).toBe('How to_ _Build_ a _Great_ App_Project_ _Yes_No_');
    });

    it('removes leading and trailing dots and spaces', () => {
      const raw = '... Lesson Title ...';
      const clean = sanitizeName(raw);
      expect(clean).toBe('Lesson Title');
    });

    it('truncates to maximum length safely', () => {
      const longName = 'A'.repeat(150);
      const clean = sanitizeName(longName, 50);
      expect(clean.length).toBe(50);
    });

    it('handles empty or non-string inputs safely', () => {
      // @ts-expect-error testing invalid input
      expect(sanitizeName(null)).toBe('unnamed');
      expect(sanitizeName('')).toBe('unnamed');
    });
  });

  describe('formatIndex', () => {
    it('pads single-digit numbers with leading zero', () => {
      expect(formatIndex(1)).toBe('01');
      expect(formatIndex(9)).toBe('09');
    });

    it('keeps multi-digit numbers unchanged', () => {
      expect(formatIndex(10)).toBe('10');
      expect(formatIndex(105)).toBe('105');
    });
  });

  describe('buildDownloadPath', () => {
    it('constructs a clean nested directory path with proper naming structure', () => {
      const path = buildDownloadPath({
        communityName: 'Mastery Club',
        courseTitle: 'Next.js & AI Mastery',
        moduleIndex: 1,
        moduleTitle: 'Introducción & Setup',
        lessonIndex: 2,
        lessonTitle: 'Instalación: de Herramientas',
        extension: '.mp4',
      });

      expect(path).toBe(
        'Skool/Mastery Club - Next.js & AI Mastery/01_Introducción & Setup/01_02_Instalación_ de Herramientas.mp4'
      );
    });
  });
});
