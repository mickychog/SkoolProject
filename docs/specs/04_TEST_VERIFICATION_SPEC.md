# 04 - Test & Verification Specification (Test Spec)

## 1. Estrategia de Pruebas SDD

La metodología SDD exige que cada especificación funcional y modelo de datos tenga criterios de verificación verificables automáticamente con `Vitest`.

## 2. Suites de Pruebas Unitarias

### 2.1. Sanitización de Nombres de Archivos y Rutas (`src/utils/filename.test.ts`)
- **Objetivo**: Asegurar que ningún carácter ilegal en sistemas operativos (`\ / : * ? " < > |` o secuencias de control) provoque fallos en la API `chrome.downloads`.
- **Casos de prueba**:
  1. Reemplazo de caracteres prohibidos por guiones bajos o espacios limpios.
  2. Truncado inteligente para no superar el límite de longitud de ruta de 255 caracteres en Windows/Linux.
  3. Padding numérico para orden secuencial (`01_`, `02_`, etc.).
  4. Preservación estricta de extensiones válidas (`.mp4`, `.pdf`, `.docx`, `.zip`).

### 2.2. Validación de Contratos de Mensajería (`src/types/messages.test.ts`)
- **Objetivo**: Validar que todos los tipos discriminados de `ExtensionMessage` cumplan con las firmas de payload esperadas y que ningún mensaje inválido pase sin captura de errores.

### 2.3. Lógica del Administrador de Colas (`src/background/queue-manager.test.ts`)
- **Objetivo**: Probar la máquina de estados de la cola de descargas sin depender de la API nativa de Chrome (usando mocks para `chrome.storage.local` y `chrome.downloads`).
- **Casos de prueba**:
  1. Encolar $N$ tareas y verificar que solo $maxConcurrent$ pasen a estado `downloading`.
  2. Al completar una tarea, la siguiente en estado `queued` debe activarse automáticamente.
  3. Pausar la cola detiene la transición de nuevas tareas.
  4. Reintentar tareas fallidas resetea `status` y suma al contador `retryCount`.

### 2.4. Adaptadores de Proveedores (`src/providers/*.test.ts`)
- **Objetivo**: Probar el reconocimiento de URLs y resolución de streams con fixtures mockeados de Loom, Skool Native HLS y Vimeo.

---

## 3. Pruebas de Integración y E2E (Manual Verification)
1. **Carga en Navegador**:
   - Compilación exitosa con `npm run build`.
   - Carga del directorio `dist/` en `chrome://extensions` en modo desarrollador sin advertencias de manifiesto.
2. **Prueba de Interfaz en Vivo**:
   - Renderizado responsivo del popup.
   - Navegación fluida entre pestañas (Descarga Rápida, Árbol del Curso, Cola en Vivo, Ajustes).
