/**
 * Offline Course Viewer & Manifest Generator
 * Follows: docs/specs/01_PRD_REQUIREMENTS_SPEC.md
 */

import { CourseHierarchy } from '@/types/course';

export class ManifestGenerator {
  /**
   * Generates a complete course JSON manifest
   */
  static generateJsonManifest(course: CourseHierarchy): string {
    return JSON.stringify(course, null, 2);
  }

  /**
   * Generates a standalone, zero-dependency HTML Offline Viewer
   * Allows the user to navigate modules, play downloaded MP4s, and open PDFs directly on their computer.
   */
  static generateOfflineHtmlViewer(course: CourseHierarchy): string {
    const courseTitleEscaped = this.escapeHtml(course.courseTitle);
    const communityNameEscaped = this.escapeHtml(course.communityName);

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${courseTitleEscaped} - Visor Offline</title>
  <style>
    :root {
      --bg: #090d16;
      --sidebar-bg: #0f172a;
      --card-bg: #1e293b;
      --accent: #3b82f6;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --border: #1e293b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
    body { display: flex; height: 100vh; background: var(--bg); color: var(--text); overflow: hidden; }
    
    /* Sidebar */
    #sidebar { width: 340px; background: var(--sidebar-bg); border-right: 1px solid var(--border); display: flex; flex-direction: column; }
    .sidebar-header { padding: 18px; border-bottom: 1px solid var(--border); }
    .community-badge { font-size: 11px; text-transform: uppercase; color: var(--accent); font-weight: 700; }
    .course-title { font-size: 16px; font-weight: 700; margin-top: 4px; }
    .tree-container { flex: 1; overflow-y: auto; padding: 12px; }
    
    .module-card { margin-bottom: 12px; background: #111827; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
    .module-header { padding: 10px 12px; font-size: 13px; font-weight: 600; background: #162032; }
    .lesson-item { padding: 10px 14px; font-size: 12px; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer; display: flex; justify-content: space-between; }
    .lesson-item:hover { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
    .lesson-item.active { background: rgba(59, 130, 246, 0.25); color: #93c5fd; font-weight: 600; }
    
    /* Main Content */
    #main { flex: 1; display: flex; flex-direction: column; overflow-y: auto; padding: 24px; }
    .video-container { width: 100%; max-width: 900px; aspect-ratio: 16/9; background: #000; border-radius: 12px; overflow: hidden; margin-bottom: 20px; }
    video { width: 100%; height: 100%; }
    .lesson-info { max-width: 900px; }
    .lesson-title-main { font-size: 20px; font-weight: 700; margin-bottom: 12px; }
    .attachments-section { margin-top: 24px; padding: 16px; background: #111827; border: 1px solid var(--border); border-radius: 10px; }
    .att-link { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; margin: 4px; background: #1e293b; color: #38bdf8; text-decoration: none; border-radius: 6px; font-size: 12px; }
    .att-link:hover { background: #2563eb; color: #fff; }
  </style>
</head>
<body>
  <div id="sidebar">
    <div class="sidebar-header">
      <span class="community-badge">${communityNameEscaped}</span>
      <h1 class="course-title">${courseTitleEscaped}</h1>
    </div>
    <div class="tree-container" id="tree"></div>
  </div>

  <div id="main">
    <div class="video-container">
      <video id="player" controls></video>
    </div>
    <div class="lesson-info">
      <h2 id="lesson-title" class="lesson-title-main">Selecciona una lección del menú lateral</h2>
      <div id="attachments" class="attachments-section" style="display: none;">
        <h3 style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">Archivos y Recursos Adjuntos</h3>
        <div id="att-list"></div>
      </div>
    </div>
  </div>

  <script>
    const course = ${JSON.stringify(course)};
    const treeEl = document.getElementById('tree');
    const playerEl = document.getElementById('player');
    const lessonTitleEl = document.getElementById('lesson-title');
    const attSection = document.getElementById('attachments');
    const attList = document.getElementById('att-list');

    let currentActiveEl = null;

    function renderTree() {
      course.modules.forEach((mod, modIdx) => {
        const modCard = document.createElement('div');
        modCard.className = 'module-card';
        modCard.innerHTML = \`<div class="module-header">\${mod.moduleTitle}</div>\`;

        mod.lessons.forEach((lesson, lIdx) => {
          const lItem = document.createElement('div');
          lItem.className = 'lesson-item';
          lItem.innerHTML = \`
            <span>\${lesson.lessonTitle}</span>
            <span>\${lesson.attachments.length > 0 ? '📎 ' + lesson.attachments.length : ''}</span>
          \`;

          lItem.onclick = () => selectLesson(modIdx, mod, lIdx, lesson, lItem);
          modCard.appendChild(lItem);
        });

        treeEl.appendChild(modCard);
      });
    }

    function selectLesson(modIdx, mod, lIdx, lesson, element) {
      if (currentActiveEl) currentActiveEl.classList.remove('active');
      element.classList.add('active');
      currentActiveEl = element;

      lessonTitleEl.textContent = lesson.lessonTitle;

      // Construct local video relative path
      const prefix = String(modIdx + 1).padStart(2, '0') + '_' + String(lIdx + 1).padStart(2, '0');
      const modFolder = String(modIdx + 1).padStart(2, '0') + '_' + mod.moduleTitle.replace(/[/\\\\?%*:|"<>]/g, '_').trim();
      const videoFileName = prefix + '_' + lesson.lessonTitle.replace(/[/\\\\?%*:|"<>]/g, '_').trim() + '.mp4';
      
      const localVideoPath = modFolder + '/' + videoFileName;
      playerEl.src = localVideoPath;
      playerEl.load();

      // Render attachments
      if (lesson.attachments && lesson.attachments.length > 0) {
        attSection.style.display = 'block';
        attList.innerHTML = '';
        lesson.attachments.forEach(att => {
          const a = document.createElement('a');
          a.className = 'att-link';
          a.href = modFolder + '/' + prefix + '_' + att.fileName.replace(/[/\\\\?%*:|"<>]/g, '_').trim();
          a.target = '_blank';
          a.textContent = '📄 ' + att.fileName;
          attList.appendChild(a);
        });
      } else {
        attSection.style.display = 'none';
      }
    }

    renderTree();
  </script>
</body>
</html>`;
  }

  private static escapeHtml(str: string): string {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
