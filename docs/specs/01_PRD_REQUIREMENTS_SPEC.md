# 01 - Product Requirements Document & Specification (PRD Spec)

## 1. Visión General del Producto
**Skool Downloader** es una extensión de navegador (Manifest V3 para Google Chrome y navegadores Chromium) diseñada para permitir a los estudiantes y creadores catalogar y descargar de forma organizada y eficiente cursos completos, módulos, lecciones individuales, videos y recursos adjuntos (PDFs, documentos, hojas de cálculo, imágenes) de comunidades educativas en Skool.

## 2. Casos de Uso Funcionales

### UC-01: Detección y Descarga Rápida de Lección Activa
- **Actor**: Usuario navegando en una lección de Skool (`/classroom/...`).
- **Descripción**: Al abrir el popup de la extensión, el sistema detecta inmediatamente la lección actual, su título, el módulo al que pertenece, el reproductor de video detectado (Skool Native HLS/DASH, Loom, Vimeo, YouTube, Wistia) y los archivos adjuntos disponibles.
- **Flujo**:
  1. El usuario hace clic en el icono de la extensión.
  2. El popup consulta a la pestaña activa los metadatos de la lección.
  3. El usuario puede seleccionar la calidad del video (ej. 1080p, 720p, 480p) o elegir descargar solo los adjuntos.
  4. Hace clic en "Descargar Lección" y la tarea entra a la cola.

### UC-02: Escaneo Jerárquico del Curso Completo
- **Actor**: Usuario en la vista principal de un aula virtual de Skool (`/classroom`).
- **Descripción**: La extensión escanea la estructura completa de módulos y lecciones del curso mediante el sidebar / DOM de Skool sin recargar agresivamente ni saturar la conexión.
- **Flujo**:
  1. El usuario pulsa "Escanear Curso Completo".
  2. El scanner recorre los módulos y lecciones accesibles.
  3. Muestra un árbol interactivo en el popup / dashboard con casillas de verificación para seleccionar/deseleccionar módulos completos o lecciones específicas.
  4. Indica el total estimado de videos y recursos a descargar.

### UC-03: Descarga por Lotes Estructurada en Carpetas
- **Descripción**: El sistema guarda los archivos en el disco local organizados jerárquicamente utilizando la API `chrome.downloads`:
  ```text
  Downloads/Skool/[Nombre_Comunidad] - [Nombre_Curso]/
  ├── 01_Modulo_Introduccion/
  │   ├── 01_01_Bienvenida.mp4
  │   ├── 01_01_Recurso_Guia.pdf
  │   └── 01_02_Configuracion.mp4
  └── 02_Modulo_Avanzado/
      ├── 02_01_Estrategia.mp4
      └── 02_01_Plantilla.xlsx
  ```
- Sanitiza nombres de archivos eliminando caracteres reservados de Windows/Linux/macOS (`\ / : * ? " < > |`).

### UC-04: Gestor de Cola de Descargas (Download Queue Manager)
- **Descripción**: Permite orquestar descargas concurrentes o secuenciales (configurable, por defecto 1 o 2 concurrentes para evitar bloqueos por rate limiting).
- **Acciones**: Pausar cola, Reanudar cola, Cancelar tarea individual, Reintentar fallidas, Limpiar completadas.
- **Métricas en tiempo real**: Progreso en porcentaje, velocidad estimada, bytes transferidos y estado (pendiente, descargando, procesando/ensamblando, completado, error).

---

## 3. Requerimientos No Funcionales (NFR)

1. **Manifest V3 Compliance**:
   - Todo el código debe ejecutarse sin `eval` ni scripts remotos no empaquetados.
   - Uso de `service_worker` para background y `offscreen` para operaciones DOM/Media prolongadas.
2. **Eficiencia de Memoria (Zero RAM Leak)**:
   - Los streams HLS/DASH deben ensamblarse y descargarse por fragmentos evitando cargar archivos de varios gigabytes íntegramente en la memoria heap de JavaScript.
3. **Resiliencia ante Fallos de Red**:
   - Reintentos exponenciales (máximo 3 reintentos) por cada segmento o archivo adjunto fallido.
4. **Seguridad y Privacidad**:
   - Principio de mínimo privilegio: sin permiso de `cookies` invasivo ni recolección de contraseñas.
   - Solo se comunica con los dominios autorizados de la lección abierta por el usuario (`activeTab` / `optional_host_permissions`).
5. **Estética y Experiencia de Usuario**:
   - Interfaz moderna en React con soporte para tema oscuro/claro, microanimaciones y feedback claro de progreso.
