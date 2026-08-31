/* ============================================================
   Architecture Editor — Interactive Touch & Mouse Floor Plan Editor.

   Vector element modeling, clean background inpainting (zero residual ghosting),
   cursor-centered mouse-wheel zoom, seamless 1-finger / mouse canvas pan,
   multi-touch pinch-to-zoom, element drag transformations, and PDF export.
   ============================================================ */

import {
  dropZone, attachFileInput, downloadBlob, humanBytes,
} from '../lib/file-engine.js';
import {
  loadFloorPlanSource, detectFloorPlanElements, reconstructCleanBackground,
  renderArchitecturePlan, getElementBounds, exportPlanToPdf,
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
            <span id="arch-banner-text">Floor plan vectorized &amp; background cleaned. Drag elements to reposition · Pan canvas with mouse/fingers · Pinch/wheel to zoom freely.</span>
          </div>
          <button class="btn btn-secondary btn-sm" id="arch-dismiss-banner" style="font-size:0.75rem; padding:2px 8px;">Got it</button>
        </div>

        <!-- Top Controls Strip -->
        <div class="tool-controls fz-controls" style="align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
          <!-- "+ Add" Menu -->
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <span class="tool-label" style="margin:0; font-weight:600; font-size:0.84rem;">+ Add:</span>
            <button class="btn btn-sm btn-secondary" data-add="wall" title="Add a Wall"> Wall</button>
            <button class="btn btn-sm btn-secondary" data-add="door" title="Add a Door"> Door</button>
            <button class="btn btn-sm btn-secondary" data-add="window" title="Add a Window">🪟 Window</button>
            <button class="btn btn-sm btn-secondary" data-add="room" title="Add a Room Area"> Room</button>
            <button class="btn btn-sm btn-secondary" data-add="text" title="Add a Text Label"> Text</button>
            <button class="btn btn-sm btn-secondary" data-add="dimension" title="Add a Dimension Line"> Dimension</button>
          </div>

          <!-- Undo / Redo & Viewport Info -->
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <button class="btn btn-sm btn-secondary" id="arch-undo-btn" title="Undo (Ctrl+Z)" disabled>↶ Undo</button>
            <button class="btn btn-sm btn-secondary" id="arch-redo-btn" title="Redo (Ctrl+Y)" disabled>↷ Redo</button>
            <div style="display:inline-flex; align-items:center; gap:4px; margin-left:6px;">
              <span id="arch-zoom-val" style="font-family:var(--mono); font-size:0.78rem; min-width:44px; text-align:center; background:var(--g100); padding:3px 8px; border-radius:4px;">100%</span>
              <button class="btn btn-sm btn-secondary" id="arch-zoom-fit" title="Fit to Screen" style="padding:0 10px;">Fit View</button>
            </div>
          </div>
        </div>

        <!-- Canvas Stage -->
        <div class="arch-stage" style="position:relative; width:100%; height:min(70vh, 640px); min-height:400px; background:var(--g50); border:1px solid var(--g150); border-radius:12px; overflow:hidden; touch-action:none; display:flex; align-items:center; justify-content:center;">
          <canvas id="arch-canvas" style="display:block; cursor:grab;"></canvas>

          <!-- Floating Element Action Menu (when an element is selected) -->
          <div id="arch-floating-actions" hidden style="position:absolute; bottom:16px; left:50%; transform:translateX(-50%); background:var(--white); border:1px solid var(--g200); border-radius:999px; box-shadow:0 8px 24px rgba(0,0,0,0.14); padding:6px 14px; display:flex; align-items:center; gap:8px; z-index:10;">
            <span id="arch-selected-name" style="font-size:0.82rem; font-weight:600; color:var(--g800); margin-right:4px;">Wall</span>
            <button class="btn btn-sm btn-secondary" id="arch-rotate-el" title="Rotate element 45°">↻ Rotate</button>
            <button class="btn btn-sm btn-secondary" id="arch-dup-el" title="Duplicate element"> Duplicate</button>
            <button class="btn btn-sm btn-secondary" id="arch-del-el" title="Delete element" style="color:#ef4444;"> Delete</button>
          </div>
        </div>

        <!-- Bottom Actions / Export Strip -->
        <div style="margin-top:14px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; align-items:center; gap:12px; font-size:0.84rem;">
            <label class="tool-checkbox" style="margin:0;">
              <input type="checkbox" id="arch-show-bg" checked> <span>Inpainted clean background</span>
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
    let cleanBgCanvas = null;
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
      const activePlate = cleanBgCanvas || bgCanvas;
      renderArchitecturePlan(ctx, elements, activePlate, {
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
        // Reconstruct clean background plate by inpainting detected elements
        cleanBgCanvas = reconstructCleanBackground(bgCanvas, detected);
        elements = detected;
        saveState();

        if (detected.length >= 2) {
          bannerText.innerHTML = `Identified <strong>${detected.length} structures</strong>. Background plate reconstructed. Drag elements to move · Pan canvas with mouse/fingers · Pinch/wheel to zoom.`;
        }
        fitToScreen();
      } catch (err) {
        alert('Could not load architectural floor plan: ' + err.message);
      }
    }

    attachFileInput(zone, input, (files) => handleFile(files[0]));

    dismissBtn.addEventListener('click', () => {
      banner.hidden = true;
    });

    newBtn.addEventListener('click', () => {
      work.hidden = true;
      bgCanvas = null;
      cleanBgCanvas = null;
      elements = [];
      selectedId = null;
      undoStack.length = 0;
      redoStack.length = 0;
    });

    /* --- "+ Add" Toolbar Items --- */
    let nextId = 100;
    container.querySelectorAll('[data-add]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.add;
        saveState();

        const centerX = bgCanvas ? bgCanvas.width / 2 : 300;
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

    /* --- High-Performance Mouse & Multi-Touch Gesture Navigation --- */
    let isDragging = false;
    let isPanning = false;
    let dragStart = { x: 0, y: 0 };
    let initialElementPos = null;
    let touchStartDist = 0;
    let touchStartMid = { x: 0, y: 0 };

    function screenToWorld(sx, sy) {
      return {
        x: (sx - panX) / zoom,
        y: (sy - panY) / zoom,
      };
    }

    function findHitElement(wx, wy) {
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        const bounds = getElementBounds(el);
        if (wx >= bounds.x - 10 && wx <= bounds.x + bounds.w + 10 &&
            wy >= bounds.y - 10 && wy <= bounds.y + bounds.h + 10) {
          return el;
        }
      }
      return null;
    }

    // Cursor-centered Mouse Wheel Zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      const newZoom = Math.max(0.15, Math.min(5.0, zoom * zoomFactor));

      panX = mouseX - (mouseX - panX) * (newZoom / zoom);
      panY = mouseY - (mouseY - panY) * (newZoom / zoom);
      zoom = newZoom;

      zoomVal.textContent = `${Math.round(zoom * 100)}%`;
      redraw();
    }, { passive: false });

    // Pointer Down (Mouse & Touch)
    const onPointerDown = (e) => {
      const rect = canvas.getBoundingClientRect();

      // Handle 2-Finger Touch Gestures (Pinch-to-zoom and Dual-finger Pan)
      if (e.touches && e.touches.length === 2) {
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchStartMid = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top,
        };
        isPanning = true;
        isDragging = false;
        return;
      }

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;

      // Check if Middle Mouse button or Spacebar is held
      const isMiddleOrRight = e.button === 1 || e.button === 2;

      const { x: wx, y: wy } = screenToWorld(sx, sy);
      const hit = findHitElement(wx, wy);

      if (hit && !isMiddleOrRight) {
        saveState();
        selectedId = hit.id;
        isDragging = true;
        isPanning = false;
        dragStart = { x: wx, y: wy };
        initialElementPos = { ...hit };
        canvas.style.cursor = 'move';
      } else {
        selectedId = null;
        isPanning = true;
        isDragging = false;
        dragStart = { x: sx, y: sy };
        canvas.style.cursor = 'grabbing';
      }
      redraw();
    };

    // Pointer Move (Mouse Drag / Touch Drag)
    const onPointerMove = (e) => {
      const rect = canvas.getBoundingClientRect();

      // Handle 2-Finger Touch Move (Pinch-to-zoom & Midpoint Pan)
      if (e.touches && e.touches.length === 2 && touchStartDist > 0) {
        const newDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const newMid = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top,
        };

        const factor = newDist / touchStartDist;
        const newZoom = Math.max(0.15, Math.min(5.0, zoom * factor));

        // Center zoom at touch midpoint
        panX = newMid.x - (newMid.x - panX) * (newZoom / zoom) + (newMid.x - touchStartMid.x);
        panY = newMid.y - (newMid.y - panY) * (newZoom / zoom) + (newMid.y - touchStartMid.y);
        zoom = newZoom;

        touchStartDist = newDist;
        touchStartMid = newMid;
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
      } else {
        // Hover cursor check
        const { x: wx, y: wy } = screenToWorld(sx, sy);
        const hit = findHitElement(wx, wy);
        canvas.style.cursor = hit ? 'pointer' : 'grab';
      }
    };

    const onPointerUp = () => {
      isDragging = false;
      isPanning = false;
      touchStartDist = 0;
      initialElementPos = null;
      canvas.style.cursor = 'grab';
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

      const activePlate = cleanBgCanvas || bgCanvas;
      renderArchitecturePlan(expCtx, elements, activePlate, {
        showBackground: showBgCheck.checked,
        selectedId: null,
        zoom: 1,
        panX: 0,
        panY: 0,
      });

      exportCanvas.toBlob((blob) => {
        downloadBlob(blob, `floor_plan_${Date.now()}.png`);
        analytics?.completed({ format: 'png', elements: elements.length });
      }, 'image/png');
    });

    exportPdfBtn.addEventListener('click', async () => {
      exportPdfBtn.disabled = true;
      exportPdfBtn.textContent = 'Building PDF…';

      try {
        const activePlate = cleanBgCanvas || bgCanvas;
        const pdfBlob = await exportPlanToPdf(elements, activePlate, {
          showBackground: showBgCheck.checked,
        });
        downloadBlob(pdfBlob, `floor_plan_${Date.now()}.pdf`);
        analytics?.completed({ format: 'pdf', elements: elements.length });
      } catch (err) {
        alert('Could not export PDF: ' + err.message);
      } finally {
        exportPdfBtn.disabled = false;
        exportPdfBtn.textContent = 'Download PDF';
      }
    });

    window.addEventListener('resize', redraw);
    this._cleanup.push(() => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      window.removeEventListener('resize', redraw);
    });
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    this._cleanup = [];
  },
};
