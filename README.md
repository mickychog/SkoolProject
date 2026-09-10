# 🎓 Skool Course & Video Downloader

Una extensión de navegador moderna (**Chrome Manifest V3**) desarrollada en **TypeScript + React + Vite** bajo la metodología **Spec-Driven Development (SDD)** para catalogar y descargar de forma organizada cursos completos, lecciones, videos (HLS/DASH nativo, Loom, Vimeo, YouTube) y recursos adjuntos (PDFs, documentos, etc.) de Skool.

---

## 🚀 Características Principales

- ⚡ **Manifest V3 Nativo**: Arquitectura moderna con Service Worker y Offscreen Document para procesamiento multimedia seguro sin fugas de memoria.
- 🎯 **Detección Rápida de Lecciones**: Detecta automáticamente el video y los archivos adjuntos de la lección abierta en la pestaña activa.
- 📂 **Estructura Jerárquica Organizada**: Organiza automáticamente las descargas en carpetas locales limpias (`Skool / [Comunidad] - [Curso] / [01_Modulo] / [01_01_Leccion].mp4`).
- 🔄 **Cola de Descargas Concurrente**: Administrador de tareas con control de concurrencia, barra de progreso, pausas y reintentos.
- 🎨 **Interfaz de Usuario Moderna**: UI estética desarrollada con React, Tailwind/CSS y Lucide Icons.
- 📐 **Desarrollo Guiado por Especificaciones (SDD)**: Contratos de tipos estrictos y especificaciones técnicas completas en `docs/specs/`.

---

## 📁 Arquitectura del Proyecto

```text
SkoolProject/
├── docs/
│   └── specs/                     # Especificaciones formales SDD
│       ├── 01_PRD_REQUIREMENTS_SPEC.md
│       ├── 02_ARCHITECTURE_SPEC.md
│       ├── 03_DATA_MODELS_AND_CONTRACTS.md
│       └── 04_TEST_VERIFICATION_SPEC.md
├── src/
│   ├── types/                     # Contratos de tipos TypeScript
│   ├── background/                # Service Worker (State & Queue Manager)
│   ├── content/                   # Content Scripts (DOM Scanners)
│   ├── offscreen/                 # Offscreen Document (Media Stream Assembler)
│   ├── providers/                 # Adaptadores de video (Strategy Pattern)
│   ├── popup/                     # Interfaz de usuario (React)
│   └── utils/                     # Utilidades (Sanitización de nombres y paths)
├── manifest.json                  # Manifest V3
├── vite.config.ts
└── package.json
```

---

## 🛠️ Instalación y Desarrollo

### Prerrequisitos
- **Node.js**: v18 o superior
- **npm** o **pnpm**

### Pasos

1. Clonar el repositorio:
   ```bash
   git clone git@github.com:mickychog/skool-downloader.git
   cd skool-downloader
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Compilar la extensión para producción:
   ```bash
   npm run build
   ```

4. Cargar en Google Chrome / Navegadores Chromium:
   - Abre `chrome://extensions/` en tu navegador.
   - Activa el **Modo de desarrollador** (esquina superior derecha).
   - Haz clic en **Cargar descomprimida** (*Load unpacked*).
   - Selecciona la carpeta `dist/` generada por el build.

5. Ejecutar tests unitarios:
   ```bash
   npm test
   ```

---

## 📜 Licencia

MIT License.
