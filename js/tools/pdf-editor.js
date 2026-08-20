/* PDF Editor — edit and annotate PDFs */

import { attachFileInput, dropZone, downloadBlob } from '../lib/file-engine.js';
import { loadPdfLib, pdfBlob } from '../lib/pdf-engine.js';
import { loadPdfJs, renderPageToCanvas, renderPageThumbnail, flattenAnnotations, convertToDocx, convertToPptx, convertToXlsx } from '../lib/pdf-editor-engine.js';

export default {
  async render(container, { analytics } = {}) {
    this._cleanup = [];

    container.innerHTML = `
      ${dropZone('pe-zone', { label: 'Drop a PDF', hint: 'or click to choose', accept: 'application/pdf,.pdf', multiple: false })}
      <div id="pe-work" class="pde" hidden>
        <div class="pde-toolbar">
          <button class="btn btn-sm pde-tool-btn is-active" data-tool="select">Select</button>
          <button class="btn btn-sm pde-tool-btn" data-tool="text">Text</button>
          <button class="btn btn-sm pde-tool-btn" data-tool="highlight">Highlight</button>
          <button class="btn btn-sm pde-tool-btn" data-tool="draw">Draw</button>
          <button class="btn btn-sm pde-tool-btn" data-tool="image">Image</button>
          <button class="btn btn-sm pde-tool-btn" data-tool="rect">Rectangle</button>
          <button class="btn btn-sm pde-tool-btn" data-tool="circle">Circle</button>
          <button class="btn btn-sm pde-tool-btn" data-tool="arrow">Arrow</button>
          <div class="pde-tool-sep"></div>
          <button class="btn btn-sm" id="pe-rot-cw">Rotate CW</button>
          <button class="btn btn-sm" id="pe-rot-ccw">Rotate CCW</button>
          <button class="btn btn-sm" id="pe-delete">Delete Page</button>
          <div class="pde-tool-sep"></div>
          <div class="pde-zoom-controls">
            <button class="btn btn-sm" id="pe-zoom-out">−</button>
            <span id="pe-zoom-val">100%</span>
            <button class="btn btn-sm" id="pe-zoom-in">+</button>
          </div>
          <button class="btn btn-sm" id="pe-undo">Undo</button>
        </div>
        <div class="pde-sidebar" id="pe-thumbs"></div>
        <div class="pde-canvas-area" id="pe-canvas-area">
          <div class="pde-canvas-wrapper" id="pe-canvas-wrapper">
            <canvas class="pde-page-canvas" id="pe-page-canvas"></canvas>
            <canvas class="pde-annot-canvas" id="pe-annot-canvas"></canvas>
            <div class="pde-text-overlay" id="pe-text-overlay"></div>
          </div>
        </div>
        <div class="pde-convert-panel">
          <div class="pde-convert-bar">
            <button class="btn btn-primary pde-convert-btn" id="pe-save">Save PDF</button>
            <button class="btn btn-secondary pde-convert-btn" id="pe-to-word">Convert to Word</button>
            <button class="btn btn-secondary pde-convert-btn" id="pe-to-excel">Convert to Excel</button>
            <button class="btn btn-secondary pde-convert-btn" id="pe-to-ppt">Convert to PPT</button>
          </div>
          <p class="fz-err" id="pe-error" hidden></p>
        </div>
      </div>
    `;

    const zone = container.querySelector('#pe-zone');
    const input = container.querySelector('#pe-zone-input');
    const work = container.querySelector('#pe-work');
    const thumbs = container.querySelector('#pe-thumbs');
    const pageCanvas = container.querySelector('#pe-page-canvas');
    const annotCanvas = container.querySelector('#pe-annot-canvas');
    const textOverlay = container.querySelector('#pe-text-overlay');
    const errorEl = container.querySelector('#pe-error');

    let file = null;
    let pdfJsDoc = null;
    let pdfBytes = null;
    let numPages = 0;

    let activePage = 0;
    let scale = 1.0;
    let activeTool = 'select';

    let annotations = [];
    const pageRotations = {};
    const deletedPages = new Set();

    async function load(files) {
      file = files[0];
      if (!file) return;
      analytics?.started();
      zone.hidden = true;
      work.hidden = false;
      errorEl.hidden = true;

      try {
        pdfBytes = await file.arrayBuffer();
        const pdfjsLib = await loadPdfJs();
        pdfJsDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
        numPages = pdfJsDoc.numPages;

        await renderThumbs();
        await renderActivePage();
      } catch (err) {
        errorEl.hidden = false;
        errorEl.textContent = 'Could not read PDF.';
        analytics?.error('pdf_load_failed');
      }
    }

    this._cleanup.push(attachFileInput(zone, input, load, { accept: /pdf/i }));

    async function renderThumbs() {
      thumbs.innerHTML = '';
      for (let i = 0; i < numPages; i++) {
        if (deletedPages.has(i)) continue;
        const div = document.createElement('div');
        div.className = 'pde-thumb' + (i === activePage ? ' is-active' : '');
        div.dataset.page = i;
        const c = document.createElement('canvas');
        div.appendChild(c);
        const lbl = document.createElement('div');
        lbl.className = 'pde-thumb-label';
        lbl.textContent = i + 1;
        div.appendChild(lbl);
        thumbs.appendChild(div);

        await renderPageThumbnail(pdfJsDoc, i, c, 120);
      }
    }

    async function renderActivePage() {
      if (deletedPages.has(activePage)) return;
      await renderPageToCanvas(pdfJsDoc, activePage, pageCanvas, scale);
      annotCanvas.width = pageCanvas.width;
      annotCanvas.height = pageCanvas.height;

      const rot = pageRotations[activePage] || 0;
      pageCanvas.style.transform = 'rotate(' + rot + 'deg)';
      annotCanvas.style.transform = 'rotate(' + rot + 'deg)';

      drawAnnotations();
    }

    function drawAnnotations() {
      const ctx = annotCanvas.getContext('2d');
      ctx.clearRect(0, 0, annotCanvas.width, annotCanvas.height);
      textOverlay.innerHTML = '';

      const pageAnnots = annotations.filter(a => a.page === activePage);
      for (const ann of pageAnnots) {
        if (ann.type === 'highlight') {
          ctx.fillStyle = 'rgba(255, 255, 0, 0.4)';
          ctx.fillRect(ann.x, ann.y, ann.w, ann.h);
        } else if (ann.type === 'text') {
          const div = document.createElement('div');
          div.className = 'pde-text-box';
          div.contentEditable = true;
          div.style.left = ann.x + 'px';
          div.style.top = ann.y + 'px';
          div.textContent = ann.text || '';
          div.addEventListener('input', (e) => {
            ann.text = e.target.textContent;
          });
          textOverlay.appendChild(div);
        } else if (ann.type === 'shape') {
          ctx.strokeStyle = 'red';
          ctx.lineWidth = 2;
          if (ann.shape === 'rect') {
            ctx.strokeRect(ann.x, ann.y, ann.w, ann.h);
          } else if (ann.shape === 'circle') {
            ctx.beginPath();
            ctx.ellipse(ann.x + ann.w / 2, ann.y + ann.h / 2, ann.w / 2, ann.h / 2, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (ann.type === 'freehand' && ann.points && ann.points.length > 1) {
          ctx.strokeStyle = ann.color || '#000';
          ctx.lineWidth = ann.lineWidth || 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(ann.points[0].x, ann.points[0].y);
          for (let p = 1; p < ann.points.length; p++) {
            ctx.lineTo(ann.points[p].x, ann.points[p].y);
          }
          ctx.stroke();
        }
      }
    }

    // Tool selection
    container.querySelectorAll('.pde-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.pde-tool-btn').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        activeTool = btn.dataset.tool;
      });
    });

    // Thumbnail navigation
    thumbs.addEventListener('click', async (e) => {
      const thumb = e.target.closest('.pde-thumb');
      if (!thumb) return;
      activePage = parseInt(thumb.dataset.page, 10);
      container.querySelectorAll('.pde-thumb').forEach(t => t.classList.remove('is-active'));
      thumb.classList.add('is-active');
      await renderActivePage();
    });

    // Rotate
    container.querySelector('#pe-rot-cw').addEventListener('click', () => {
      pageRotations[activePage] = ((pageRotations[activePage] || 0) + 90) % 360;
      renderActivePage();
    });
    container.querySelector('#pe-rot-ccw').addEventListener('click', () => {
      pageRotations[activePage] = ((pageRotations[activePage] || 0) + 270) % 360;
      renderActivePage();
    });

    // Delete page
    container.querySelector('#pe-delete').addEventListener('click', () => {
      deletedPages.add(activePage);
      renderThumbs();
      for (let i = 0; i < numPages; i++) {
        if (!deletedPages.has(i)) { activePage = i; renderActivePage(); break; }
      }
    });

    // Zoom
    container.querySelector('#pe-zoom-in').addEventListener('click', () => {
      scale = Math.min(3, scale + 0.25);
      container.querySelector('#pe-zoom-val').textContent = Math.round(scale * 100) + '%';
      renderActivePage();
    });
    container.querySelector('#pe-zoom-out').addEventListener('click', () => {
      scale = Math.max(0.5, scale - 0.25);
      container.querySelector('#pe-zoom-val').textContent = Math.round(scale * 100) + '%';
      renderActivePage();
    });

    // Undo
    container.querySelector('#pe-undo').addEventListener('click', () => {
      if (annotations.length > 0) { annotations.pop(); drawAnnotations(); }
    });

    // --- Canvas annotation interactions ---
    let isDrawing = false;
    let startX = 0, startY = 0;
    let currentFreehand = null;

    annotCanvas.addEventListener('mousedown', (e) => {
      if (activeTool === 'select') return;
      const rect = annotCanvas.getBoundingClientRect();
      startX = e.clientX - rect.left;
      startY = e.clientY - rect.top;

      if (activeTool === 'text') {
        annotations.push({ type: 'text', page: activePage, x: startX, y: startY, text: 'Text' });
        drawAnnotations();
        return;
      }

      if (activeTool === 'draw') {
        currentFreehand = { type: 'freehand', page: activePage, points: [{ x: startX, y: startY }], color: '#000', lineWidth: 2 };
        isDrawing = true;
        return;
      }

      isDrawing = true;
    });

    annotCanvas.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      if (activeTool === 'draw' && currentFreehand) {
        const rect = annotCanvas.getBoundingClientRect();
        currentFreehand.points.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        // Live preview
        const ctx = annotCanvas.getContext('2d');
        const pts = currentFreehand.points;
        if (pts.length > 1) {
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
          ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
          ctx.stroke();
        }
      }
    });

    annotCanvas.addEventListener('mouseup', (e) => {
      if (!isDrawing) return;
      isDrawing = false;

      if (activeTool === 'draw' && currentFreehand) {
        if (currentFreehand.points.length > 1) {
          annotations.push(currentFreehand);
        }
        currentFreehand = null;
        drawAnnotations();
        return;
      }

      const rect = annotCanvas.getBoundingClientRect();
      const endX = e.clientX - rect.left;
      const endY = e.clientY - rect.top;
      const w = Math.abs(endX - startX);
      const h = Math.abs(endY - startY);
      const x = Math.min(startX, endX);
      const y = Math.min(startY, endY);

      if (w > 5 && h > 5) {
        if (activeTool === 'highlight') {
          annotations.push({ type: 'highlight', page: activePage, x, y, w, h });
        } else if (activeTool === 'rect' || activeTool === 'circle') {
          annotations.push({ type: 'shape', shape: activeTool, page: activePage, x, y, w, h });
        }
      }
      drawAnnotations();
    });

    // Image tool
    container.querySelector('[data-tool="image"]').addEventListener('click', () => {
      const picker = document.createElement('input');
      picker.type = 'file';
      picker.accept = 'image/*';
      picker.addEventListener('change', () => {
        const imgFile = picker.files?.[0];
        if (!imgFile) return;
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const w = Math.min(img.width, pageCanvas.width * 0.4);
            const h = (img.height / img.width) * w;
            annotations.push({ type: 'image', page: activePage, x: 20, y: 20, w, h, src: reader.result });
            drawImageAnnotations();
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(imgFile);
      });
      picker.click();
    });

    function drawImageAnnotations() {
      const imgAnnots = annotations.filter(a => a.page === activePage && a.type === 'image');
      for (const ann of imgAnnots) {
        const img = new Image();
        img.onload = () => {
          const ctx = annotCanvas.getContext('2d');
          ctx.drawImage(img, ann.x, ann.y, ann.w, ann.h);
        };
        img.src = ann.src;
      }
    }

    // --- Export / Conversion ---
    const getBaseName = () => file ? file.name.replace(/\.pdf$/i, '') : 'document';

    const setBusy = (isBusy, msg) => {
      container.querySelectorAll('.pde-convert-btn').forEach(btn => { btn.disabled = isBusy; });
      if (isBusy) {
        errorEl.hidden = false;
        errorEl.textContent = msg || 'Working…';
        errorEl.classList.remove('fz-err');
      } else {
        errorEl.hidden = true;
      }
    };

    container.querySelector('#pe-save').addEventListener('click', async () => {
      try {
        setBusy(true, 'Saving PDF…');
        const { PDFDocument, degrees } = await loadPdfLib();
        const src = await PDFDocument.load(pdfBytes);
        const out = await PDFDocument.create();

        const validPages = [];
        for (let i = 0; i < numPages; i++) {
          if (!deletedPages.has(i)) validPages.push(i);
        }

        const copied = await out.copyPages(src, validPages);
        copied.forEach((page, idx) => {
          const originalIdx = validPages[idx];
          const rot = pageRotations[originalIdx] || 0;
          if (rot !== 0) {
            page.setRotation(degrees((page.getRotation().angle + rot) % 360));
          }
          out.addPage(page);
        });

        await flattenAnnotations(out, annotations);

        const bytes = await out.save();
        downloadBlob(pdfBlob(bytes), getBaseName() + '-edited.pdf');
        analytics?.completed({ bytesOut: bytes.length });
      } catch (e) {
        errorEl.hidden = false;
        errorEl.textContent = 'Failed to save: ' + e.message;
      } finally {
        setBusy(false);
      }
    });

    container.querySelector('#pe-to-word').addEventListener('click', async () => {
      try {
        setBusy(true, 'Converting to Word…');
        const blob = await convertToDocx(pdfJsDoc, numPages);
        downloadBlob(blob, getBaseName() + '.docx');
        analytics?.completed();
      } catch (e) {
        errorEl.textContent = 'Word conversion failed.';
        errorEl.hidden = false;
      } finally {
        setBusy(false);
      }
    });

    container.querySelector('#pe-to-ppt').addEventListener('click', async () => {
      try {
        setBusy(true, 'Converting to PowerPoint…');
        const blob = await convertToPptx(pdfJsDoc, numPages, async (i) => {
          const c = document.createElement('canvas');
          await renderPageToCanvas(pdfJsDoc, i, c, 2);
          return c.toDataURL('image/png');
        });
        downloadBlob(blob, getBaseName() + '.pptx');
        analytics?.completed();
      } catch (e) {
        errorEl.textContent = 'PowerPoint conversion failed.';
        errorEl.hidden = false;
      } finally {
        setBusy(false);
      }
    });

    container.querySelector('#pe-to-excel').addEventListener('click', async () => {
      try {
        setBusy(true, 'Converting to Excel…');
        const blob = await convertToXlsx(pdfJsDoc, numPages);
        downloadBlob(blob, getBaseName() + '.xlsx');
        analytics?.completed();
      } catch (e) {
        errorEl.textContent = 'Excel conversion failed.';
        errorEl.hidden = false;
      } finally {
        setBusy(false);
      }
    });
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    this._cleanup = [];
  },
};
