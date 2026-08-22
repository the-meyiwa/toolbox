# Toolbox Tool Implementation Guide

This guide walks developers through implementing, polishing, and maintaining tools in Toolbox.

---

## 1. Creating a New Tool: Step-by-Step

### Step 1: Register in `js/registry/tools.js`
Add a tool definition to the `TOOLS` array:
```javascript
{
  id: 'my-tool',
  name: 'My New Tool',
  description: 'Clear, concise one-line explanation of what it does',
  category: 'developer',         // 'text' | 'developer' | 'images-files' | 'numbers' | 'business' | 'design' | 'modeling' | 'security' | 'reference' | 'everyday'
  secondary: ['text'],           // Optional secondary categories
  keywords: ['my', 'tool', 'keywords'],
  synonyms: ['alternative name'],
  intents: ['what a person searches for in natural language', 'how do i do X'],
  related: ['json-formatter', 'base64-codec'],
  accepts: ['json'],             // Optional: kinds of artifacts it can receive
  produces: ['json'],            // Optional: kinds of artifacts it outputs (enables Artifact Strip)
  weight: 75,                    // Discovery ranking priority (0 - 100)
  icon: svg('<path d="..."/>'),  // 24x24 SVG path
}
```

### Step 2: Implement the Tool Module in `js/tools/<id>.js`
Every tool module exports a default object conforming to the Tool Lifecycle:
```javascript
export default {
  /**
   * Called when the tool is opened.
   * @param {HTMLElement} container - Fresh container node in the viewport
   * @param {Object} context
   * @param {Object} [context.analytics] - Instrumentation handle (.started(), .completed(), .downloaded())
   * @param {Object} [context.tool] - Registry entry
   * @param {Object} [context.artifact] - Incoming artifact if opened via 'Open in...'
   */
  async render(container, { analytics, tool, artifact } = {}) {
    // 1. Render UI HTML template
    container.innerHTML = `
      <div class="tool-section">
        <textarea class="tool-textarea" id="my-input" placeholder="Enter input..."></textarea>
      </div>
      <div class="tool-controls">
        <button class="btn btn-primary" id="my-action">Process</button>
      </div>
    `;

    // 2. Wire event listeners
    const input = container.querySelector('#my-input');
    const actionBtn = container.querySelector('#my-action');

    actionBtn.addEventListener('click', () => {
      analytics?.completed();
    });

    // 3. Keep cleanup references if necessary
    this._cleanup = () => {
      // release worker, video stream, audio context, etc.
    };
  },

  /**
   * Optional: Returns current artifact for Save, Download, and Share to Space.
   * Only implement if tool declares `produces` in registry.
   */
  getArtifact() {
    return {
      kind: 'json',
      text: JSON.stringify({ example: true }, null, 2),
      name: 'result.json',
    };
  },

  /**
   * Optional: Accepts an incoming artifact handed off from another tool.
   */
  setArtifact(artifact) {
    // Populate inputs from artifact.text
  },

  /**
   * Called when navigating away from the tool.
   */
  destroy() {
    this._cleanup?.();
    this._cleanup = null;
  }
};
```

---

## 2. Common Engine Utilities

- **File Engine (`js/lib/file-engine.js`)**:
  - `dropZone(id, options)`: Standard drag-and-drop file upload zone.
  - `attachFileInput(zone, input, callback)`: Binds drag, drop, and file input handlers.
  - `decodeImage(file)`: Decodes images to `ImageBitmap` with orientation corrections.
  - `downloadBlob(blob, filename)`: Downloads any Blob cleanly.

- **PDF Engine (`js/lib/pdf-editor-engine.js`)**:
  - `loadPdfJs()`: Dynamically imports `pdfjs-dist` on demand.
  - `renderPageToCanvas(pdfDoc, pageIndex, canvas, scale)`: High-fidelity PDF rendering.
  - `exportPlanToPdf(canvas, title)`: Embeds rendered canvas into downloadable PDF document.

- **3D Viewer (`js/lib/viewer3d.js`)**:
  - `Viewer3D(mountElement, options)`: Instant WebGL scene with orbit controls, lighting, and picking.
  - `select(mesh)`: Instant highlight tinting with 0ms overhead.

---

## 3. UX & Performance Guidelines

1. **Mobile Usability**:
   - Ensure touch targets are at least `40px` in height/width.
   - Use `touch-action: none;` on custom gesture canvases (e.g. Floor Plan Editor, Image Cropper).
   - Use CSS Media queries for collapsible sidebars and responsive toolbars.

2. **60 FPS Interactions & INP**:
   - Never run synchronous heavy CPU operations during UI events. Use `requestAnimationFrame` yielding or Web Workers.
   - Debounce search and filter inputs (`setTimeout(fn, 150)`).
   - Avoid creating `THREE.EdgesGeometry` or cloning materials on every frame.
