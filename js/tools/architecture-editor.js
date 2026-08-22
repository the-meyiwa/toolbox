/* ============================================================
   Architecture Editor — simple, touch-first floor plan editing.

   Designed for non-technical and older users.
   Upload architectural plan (PDF/Image) → auto-detect walls/doors/rooms
   → drag-and-drop elements → "+ Add" menu → undo/redo → export PDF/Image.
   ============================================================ */

import {
  dropZone, attachFileInput, downloadBlob, humanBytes,
} from '../lib/file-engine.js';
import {
  loadFloorPlanSource, detectFloorPlanElements, renderArchitecturePlan,
  getElementBounds, exportPlanToPdf,
} from '../lib/architecture-engine.js';

export default {
  async render(container, { analytics } = {}) {
    this._cleanup = [];

    container.innerHTML = `
      ${dropZone('arch-zone', { label: 'Drop a floor plan (PDF, PNG, JPG) to edit', accept: '.pdf,image/*' })}

      <div id="arch-work" hidden>
        <!-- Notice Bar -->
        <div id="arch-detection-banner" class="biz-explain" style="margin-bottom:12px; font-size:0.84rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            <span id="arch-banner-text">Floor plan loaded. Tap any element to move or resize it, or tap <strong>"+ Add"</strong> below.</span>
          </div>
          <button class="btn btn-secondary btn-sm" id="arch-dismiss-banner" style="font-size:0.75rem; padding:2px 8px;">Got it</button>
        </div>

        <!-- Top Controls Strip -->
        <div class="tool-controls fz-controls" style="align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
          <!-- "+ Add" Menu -->
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span class="tool-label" style="margin:0; font-weight:600; font-size:0.84rem;">+ Add:</span>
            <button class="btn btn-sm btn-secondary" data-add="wall" title="Add a Wall">🧱 Wall</button>
            <button class="btn btn-sm btn-secondary" data-add="door" title="Add a Door">🚪 Door</button>
            <button class="btn btn-sm btn-secondary" data-add="window" title="Add a Window">🪟 Window</button>
            <button class="btn btn-sm btn-secondary" data-add="room" title="Add a Room Area">🏠 Room</button>
            <button class="btn btn-sm btn-secondary" data-add="text" title="Add a Text Label">📝 Text</button>
            <button class="btn btn-sm btn-secondary" data-add="dimension" title="Add a Dimension Line">📏 Dimension</button>
          </div>

          <!-- Undo / Redo & Zoom -->
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <button class="btn btn-sm btn-secondary" id="arch-undo-btn" title="Undo (Ctrl+Z)" disabled>↶ Undo</button>
            <button class="btn btn-sm btn-secondary" id="arch-redo-btn" title="Redo (Ctrl+Y)" disabled>↷ Redo</button>
            <div style="display:inline-flex; align-items:center; gap:4px; margin-left:6px;">
              <button class="btn btn-sm btn-secondary" id="arch-zoom-out" title="Zoom Out" style="padding:0 8px;">−</button>
              <span id="arch-zoom-val" style="font-family:var(--mono); font-size:0.78rem; min-width:38px; text-align:center;">100%</span>
              <button class="btn btn-sm btn-secondary" id="arch-zoom-in" title="Zoom In" style="padding:0 8px;">+</button>
              <button class="btn btn-sm btn-secondary" id="arch-zoom-fit" title="Fit to Screen" style="padding:0 8px;">Fit</button>
            </div>
          </div>
        </div>

        <!-- Canvas Stage -->
        <div class="arch-stage" style="position:relative; width:100%; height:min(68vh, 620px); min-height:380px; background:var(--g50); border:1px solid var(--g150); border-radius:12px; overflow:hidden; touch-action:none; display:flex; align-items:center; justify-content:center;">
          <canvas id="arch-canvas" style="display:block; cursor:default;"></canvas>

          <!-- Floating Element Action Menu (when an element is selected) -->
          <div id="arch-floating-actions" hidden style="position:absolute; bottom:16px; left:50%; transform:translateX(-50%); background:var(--white); border:1px solid var(--g200); border-radius:999px; box-shadow:0 8px 24px rgba(0,0,0,0.14); padding:6px 14px; display:flex; align-items:center; gap:8px; z-index:10;">
            <span id="arch-selected-name" style="font-size:0.82rem; font-weight:600; color:var(--g800); margin-right:4px;">Wall</span>
            <button class="btn btn-sm btn-secondary" id="arch-rotate-el" title="Rotate element 45°">↻ Rotate</button>
            <button class="btn btn-sm btn-secondary" id="arch-dup-el" title="Duplicate element">📋 Duplicate</button>
            <button class="btn btn-sm btn-secondary" id="arch-del-el" title="Delete element" style="color:#ef4444;">🗑 Delete</button>
          </div>
        </div>

        <!-- Bottom Actions / Export Strip -->
        <div style="margin-top:14px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; align-items:center; gap:12px; font-size:0.84rem;">
            <label class="tool-checkbox" style="margin:0;">
              <input type="checkbox" id="arch-show-bg" checked> <span>Show original background drawing</span>
            </label>
            <span id="arch-count-badge" style="color:var(--g500);">0 elements</span>
          </div>

          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-secondary btn-sm" id="arch-export-img">Export Image (PNG)</button>
            <button class="btn btn-primary btn-sm" id="arch-export-pdf">Download PDF</button>
            <button class="btn btn-secondary btn-sm" id="arch-new-btn">Open Another</button>
          </div>
        </div>
      </div>
    `;

    const zone         = container.querySelector('#arch-zone');
    const input        = container.querySelector('#arch-zone-input');
    const work         = container.querySelector('#arch-work');
    const banner       = container.querySelector('#arch-detection-banner');
    const bannerText   = container.querySelector('#arch-banner-text');
    const dismissBtn   = container.querySelector('#arch-dismiss-banner');
    const canvas       = container.querySelector('#arch-canvas');
    const floatActions = container.querySelector('#arch-floating-actions');
    const selName      = container.querySelector('#arch-selected-name');
    const rotateBtn    = container.querySelector('#arch-rotate-el');
    const dupBtn       = container.querySelector('#arch-dup-el');
    const delBtn       = container.querySelector('#arch-del-el');
    const undoBtn      = container.querySelector('#arch-undo-btn');
    const redoBtn      = container.querySelector('#arch-redo-btn');
    const zoomInBtn    = container.querySelector('#arch-zoom-in');
    const zoomOutBtn   = container.querySelector('#arch-zoom-out');
    const zoomFitBtn   = container.querySelector('#arch-zoom-fit');
    const zoomVal      = container.querySelector('#arch-zoom-val');
    const showBgCheck  = container.querySelector('#arch-show-bg');
    const countBadge   = container.querySelector('#arch-count-badge');
    const exportImgBtn = container.querySelector('#arch-export-img');
    const exportPdfBtn = container.querySelector('#arch-export-pdf');
    const newBtn       = container.querySelector('#arch-new-btn');

    const ctx = canvas.getContext('2d');

    let currentFile = null;
    let bgCanvas = null;
    let elements = [];
    let selectedId = null;

    // Viewport transforms (Pan & Zoom)
    let zoom = 1.0;
    let panX = 0;
    let panY = 0;

    // Undo / Redo stacks
    const undoStack = [];
    const redoStack = [];

    function saveState() {
      undoStack.push(JSON.stringify(elements));
      if (undoStack.length > 30) undoStack.shift();
      redoStack.length = 0;
      updateUndoRedoBtns();
    }

    function updateUndoRedoBtns() {
      undoBtn.disabled = (undoStack.length === 0);
      redoBtn.disabled = (redoStack.length === 0);
      countBadge.textContent = `${elements.length} element${elements.length === 1 ? '' : 's'}`;
    }

    function redraw() {
      const containerRect = canvas.parentElement.getBoundingClientRect();
      canvas.width = containerRect.width;
      canvas.height = containerRect.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderArchitecturePlan(ctx, elements, bgCanvas, {
        showBackground: showBgCheck.checked,
        selectedId,
        zoom,
        panX,
        panY,
      });

      // Update floating action toolbar
      if (selectedId) {
        const sel = elements.find(e => e.id === selectedId);
        if (sel) {
          selName.textContent = sel.type.toUpperCase() + (sel.label ? ` (${sel.label})` : '');
          floatActions.hidden = false;
        } else {
          floatActions.hidden = true;
        }
      } else {
        floatActions.hidden = true;
      }
    }

    function fitToScreen() {
      if (!bgCanvas) return;
      const stageRect = canvas.parentElement.getBoundingClientRect();
      const scaleX = (stageRect.width - 40) / bgCanvas.width;
      const scaleY = (stageRect.height - 40) / bgCanvas.height;
      zoom = Math.min(scaleX, scaleY, 1.2);
      panX = (stageRect.width - bgCanvas.width * zoom) / 2;
      panY = (stageRect.height - bgCanvas.height * zoom) / 2;
      zoomVal.textContent = `${Math.round(zoom * 100)}%`;
      redraw();
    }

    async function handleFile(file) {
      if (!file) return;
      currentFile = file;
      work.hidden = false;
      analytics?.started();

      try {
        const source = await loadFloorPlanSource(file);
        bgCanvas = source.canvas;

        // Auto-detect architectural elements
        const detected = detectFloorPlanElements(bgCanvas);
        elements = detected;
        saveState();

        if (detected.length >= 2) {
          bannerText.innerHTML = `✨ Automatically detected <strong>${detected.length} elements</strong> (walls, openings, rooms). Tap any to modify, or add new ones.`;
        } else {
          bannerText.innerHTML = `Floor plan loaded. Tap <strong>"+ Add"</strong> above to easily place walls, doors, windows, and rooms.`;
        }
        banner.hidden = false;

        fitToScreen();
      } catch (err) {
        alert('Could not load plan: ' + err.message);
      }
    }

    this._cleanup.push(attachFileInput(zone, input, (files) => {
      if (files[0]) handleFile(files[0]);
    }));

    dismissBtn.addEventListener('click', () => { banner.hidden = true; });

    /* --- "+ Add" Toolbar Items --- */
    let nextId = 100;
    container.querySelectorAll('[data-add]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.add;
        saveState();

        const centerX = bgCanvas ? bgCanvas.width / 2 : 200;
        const centerY = bgCanvas ? bgCanvas.height / 2 : 200;
        const id = `${type}-${nextId++}`;

        let newEl = null;
        if (type === 'wall') {
          newEl = { id, type: 'wall', x: centerX - 60, y: centerY, x2: centerX + 60, y2: centerY, thickness: 8, color: '#0f172a' };
        } else if (type === 'door') {
          newEl = { id, type: 'door', x: centerX, y: centerY, width: 44, rotation: 0 };
        } else if (type === 'window') {
          newEl = { id, type: 'window', x: centerX, y: centerY, width: 60, rotation: 0 };
        } else if (type === 'room') {
          newEl = { id, type: 'room', x: centerX - 70, y: centerY - 60, width: 140, height: 120, label: 'Bedroom', color: 'rgba(59,130,246,0.1)' };
        } else if (type === 'text') {
          newEl = { id, type: 'text', x: centerX, y: centerY, text: 'Custom Room', size: 16 };
        } else if (type === 'dimension') {
          newEl = { id, type: 'dimension', x: centerX - 50, y: centerY, x2: centerX + 50, y2: centerY, label: '3.0 m' };
        }

        if (newEl) {
          elements.push(newEl);
          selectedId = id;
          redraw();
        }
      });
    });

    /* --- Direct Manipulation (Tap, Drag, Resize) --- */
    let isDragging = false;
    let isPanning = false;
    let dragStart = { x: 0, y: 0 };
    let initialElementPos = null;
    let touchStartDist = 0;

    function screenToWorld(sx, sy) {
      return {
        x: (sx - panX) / zoom,
        y: (sy - panY) / zoom,
      };
    }

    function findHitElement(wx, wy) {
      // Check in reverse order so top-most elements hit first
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        const bounds = getElementBounds(el);
        if (wx >= bounds.x - 8 && wx <= bounds.x + bounds.w + 8 &&
            wy >= bounds.y - 8 && wy <= bounds.y + bounds.h + 8) {
          return el;
        }
      }
      return null;
    }

    const onPointerDown = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;

      if (e.touches && e.touches.length === 2) {
        // Pinch to zoom initiation
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        isPanning = true;
        return;
      }

      const { x: wx, y: wy } = screenToWorld(sx, sy);
      const hit = findHitElement(wx, wy);

      if (hit) {
        saveState();
        selectedId = hit.id;
        isDragging = true;
        dragStart = { x: wx, y: wy };
        initialElementPos = { ...hit };
      } else {
        selectedId = null;
        isPanning = true;
        dragStart = { x: sx, y: sy };
      }
      redraw();
    };

    const onPointerMove = (e) => {
      const rect = canvas.getBoundingClientRect();

      if (e.touches && e.touches.length === 2 && touchStartDist > 0) {
        const newDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = newDist / touchStartDist;
        zoom = Math.max(0.2, Math.min(3.0, zoom * factor));
        touchStartDist = newDist;
        zoomVal.textContent = `${Math.round(zoom * 100)}%`;
        redraw();
        return;
      }

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;

      if (isDragging && selectedId) {
        const { x: wx, y: wy } = screenToWorld(sx, sy);
        const dx = wx - dragStart.x;
        const dy = wy - dragStart.y;
        const sel = elements.find(el => el.id === selectedId);

        if (sel && initialElementPos) {
          sel.x = Math.round(initialElementPos.x + dx);
          sel.y = Math.round(initialElementPos.y + dy);
          if (sel.x2 != null) sel.x2 = Math.round(initialElementPos.x2 + dx);
          if (sel.y2 != null) sel.y2 = Math.round(initialElementPos.y2 + dy);
          redraw();
        }
      } else if (isPanning) {
        panX += (sx - dragStart.x);
        panY += (sy - dragStart.y);
        dragStart = { x: sx, y: sy };
        redraw();
      }
    };

    const onPointerUp = () => {
      isDragging = false;
      isPanning = false;
      touchStartDist = 0;
      initialElementPos = null;
    };

    canvas.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    canvas.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    /* --- Floating Actions Handlers --- */
    rotateBtn.addEventListener('click', () => {
      if (!selectedId) return;
      saveState();
      const sel = elements.find(e => e.id === selectedId);
      if (sel) {
        sel.rotation = ((sel.rotation || 0) + 45) % 360;
        redraw();
      }
    });

    dupBtn.addEventListener('click', () => {
      if (!selectedId) return;
      saveState();
      const sel = elements.find(e => e.id === selectedId);
      if (sel) {
        const copy = JSON.parse(JSON.stringify(sel));
        copy.id = `${sel.type}-${nextId++}`;
        copy.x += 24;
        copy.y += 24;
        if (copy.x2 != null) copy.x2 += 24;
        if (copy.y2 != null) copy.y2 += 24;
        elements.push(copy);
        selectedId = copy.id;
        redraw();
      }
    });

    delBtn.addEventListener('click', () => {
      if (!selectedId) return;
      saveState();
      elements = elements.filter(e => e.id !== selectedId);
      selectedId = null;
      redraw();
    });

    /* --- Undo / Redo Handlers --- */
    undoBtn.addEventListener('click', () => {
      if (!undoStack.length) return;
      redoStack.push(JSON.stringify(elements));
      elements = JSON.parse(undoStack.pop());
      selectedId = null;
      updateUndoRedoBtns();
      redraw();
    });

    redoBtn.addEventListener('click', () => {
      if (!redoStack.length) return;
      undoStack.push(JSON.stringify(elements));
      elements = JSON.parse(redoStack.pop());
      selectedId = null;
      updateUndoRedoBtns();
      redraw();
    });

    /* --- Zoom Controls --- */
    zoomInBtn.addEventListener('click', () => {
      zoom = Math.min(3.0, zoom * 1.25);
      zoomVal.textContent = `${Math.round(zoom * 100)}%`;
      redraw();
    });

    zoomOutBtn.addEventListener('click', () => {
      zoom = Math.max(0.2, zoom / 1.25);
      zoomVal.textContent = `${Math.round(zoom * 100)}%`;
      redraw();
    });

    zoomFitBtn.addEventListener('click', fitToScreen);
    showBgCheck.addEventListener('change', redraw);

    /* --- Export Handlers --- */
    exportImgBtn.addEventListener('click', () => {
      const exportCanvas = document.createElement('canvas');
      const w = bgCanvas ? bgCanvas.width : 1200;
      const h = bgCanvas ? bgCanvas.height : 900;
      exportCanvas.width = w;
      exportCanvas.height = h;
      const expCtx = exportCanvas.getContext('2d');

      renderArchitecturePlan(expCtx, elements, bgCanvas, {
        showBackground: showBgCheck.checked,
        selectedId: null,
        zoom: 1.0,
        panX: 0,
        panY: 0,
      });

      exportCanvas.toBlob(blob => {
        downloadBlob(blob, `${(currentFile?.name || 'floor-plan').replace(/\.[^.]+$/, '')}-edited.png`);
        analytics?.downloaded({ fileCount: 1 });
      }, 'image/png');
    });

    exportPdfBtn.addEventListener('click', async () => {
      const exportCanvas = document.createElement('canvas');
      const w = bgCanvas ? bgCanvas.width : 1200;
      const h = bgCanvas ? bgCanvas.height : 900;
      exportCanvas.width = w;
      exportCanvas.height = h;
      const expCtx = exportCanvas.getContext('2d');

      renderArchitecturePlan(expCtx, elements, bgCanvas, {
        showBackground: showBgCheck.checked,
        selectedId: null,
        zoom: 1.0,
        panX: 0,
        panY: 0,
      });

      try {
        const blob = await exportPlanToPdf(exportCanvas, currentFile?.name || 'Floor Plan');
        downloadBlob(blob, `${(currentFile?.name || 'floor-plan').replace(/\.[^.]+$/, '')}-edited.pdf`);
        analytics?.downloaded({ fileCount: 1 });
      } catch (err) {
        alert('Could not generate PDF: ' + err.message);
      }
    });

    newBtn.addEventListener('click', () => {
      currentFile = null;
      bgCanvas = null;
      elements = [];
      selectedId = null;
      undoStack.length = 0;
      redoStack.length = 0;
      work.hidden = true;
      input.value = '';
    });

    window.addEventListener('resize', redraw);
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    this._cleanup = [];
  },
};
