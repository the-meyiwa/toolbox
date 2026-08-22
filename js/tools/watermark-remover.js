/* ============================================================
   AI Text Watermark Remover.

   Clean, privacy-first on-device text watermark & artifact removal.
   Upload image → identify/brush watermark → content-aware removal →
   split-view preview → high-res export.
   ============================================================ */

import {
  dropZone, attachFileInput, decodeImage, downloadBlob, humanBytes,
} from '../lib/file-engine.js';

export default {
  async render(container, { analytics } = {}) {
    this._cleanup = [];
    const urls = [];
    this._urls = urls;

    container.innerHTML = `
      ${dropZone('wm-zone', { label: 'Drop an image to remove text or watermarks', accept: 'image/*' })}
      
      <div id="wm-work" hidden>
        <!-- Notice Strip -->
        <div class="biz-explain" style="margin-bottom:16px; font-size:0.84rem; display:flex; align-items:center; gap:8px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>Privacy-first &amp; local: Images never leave your device. Designed for legitimate editing of content you own or have permission to modify.</span>
        </div>

        <!-- Controls Toolbar -->
        <div class="tool-controls fz-controls" style="align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="tool-label" style="margin:0;">Selection Mode:</span>
            <div class="btn-group t3d-seg" id="wm-mode-grp">
              <button class="btn btn-sm is-active" data-mode="brush">Brush</button>
              <button class="btn btn-sm" data-mode="rect">Box Select</button>
            </div>

            <div id="wm-brush-opts" style="display:flex; align-items:center; gap:8px;">
              <span class="tool-label" style="margin:0; font-size:0.78rem;">Size:</span>
              <input type="range" class="tool-range" id="wm-brush-size" min="8" max="80" value="28" style="width:90px; margin:0;">
              <output id="wm-brush-out" style="font-family:var(--mono); font-size:0.75rem; min-width:28px;">28px</output>
            </div>
          </div>

          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" id="wm-auto-detect" title="Detect potential high-contrast text regions">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
              Auto-detect Text
            </button>
            <button class="btn btn-secondary btn-sm" id="wm-clear-mask">Clear Selection</button>
            <button class="btn btn-primary btn-sm" id="wm-apply-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              Remove Watermark
            </button>
          </div>
        </div>

        <!-- Canvas Stage Area -->
        <div class="wm-stage" style="margin-top:16px; position:relative; background:var(--g50); border:1px solid var(--g150); border-radius:12px; overflow:hidden; min-height:360px; display:flex; justify-content:center; align-items:center;">
          <div id="wm-canvas-wrap" style="position:relative; max-width:100%; max-height:65vh; overflow:auto; user-select:none; touch-action:none; display:inline-block;">
            <canvas id="wm-main-canvas" style="display:block; max-width:100%; height:auto; box-shadow:0 4px 16px rgba(0,0,0,0.06);"></canvas>
            <canvas id="wm-mask-canvas" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:auto; cursor:crosshair; opacity:0.65;"></canvas>
          </div>

          <!-- Split Comparison Slider (Shown after removal) -->
          <div id="wm-split-wrap" hidden style="position:absolute; inset:0; background:var(--g50); display:flex; align-items:center; justify-content:center;">
            <div id="wm-compare-box" style="position:relative; max-width:100%; max-height:65vh; overflow:hidden; user-select:none; touch-action:none;">
              <img id="wm-after-img" style="display:block; max-width:100%; max-height:65vh; object-fit:contain;" alt="Cleaned image">
              <div id="wm-before-clip" style="position:absolute; top:0; left:0; height:100%; width:50%; overflow:hidden; border-right:2px solid var(--white); box-shadow:2px 0 8px rgba(0,0,0,0.25);">
                <img id="wm-before-img" style="position:absolute; top:0; left:0; max-height:65vh; object-fit:contain;" alt="Original image">
              </div>
              <div id="wm-slider-handle" style="position:absolute; top:50%; left:50%; width:32px; height:32px; margin-left:-16px; margin-top:-16px; border-radius:50%; background:var(--white); border:2px solid var(--black); box-shadow:0 2px 8px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; cursor:ew-resize;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 8L22 12L18 16"/><path d="M6 8L2 12L6 16"/></svg>
              </div>
            </div>
          </div>
        </div>

        <!-- Result / Action Bar -->
        <div id="wm-bottom-bar" style="margin-top:16px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
          <div id="wm-meta-info" style="font-size:0.84rem; color:var(--g600);"></div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary btn-sm" id="wm-edit-again" hidden>← Adjust Selection</button>
            <button class="btn btn-primary btn-sm" id="wm-download-btn" disabled>Download Cleaned Image</button>
            <button class="btn btn-secondary btn-sm" id="wm-clear-all">Open Another</button>
          </div>
        </div>
      </div>
    `;

    const zone        = container.querySelector('#wm-zone');
    const input       = container.querySelector('#wm-zone-input');
    const work        = container.querySelector('#wm-work');
    const mainCanvas  = container.querySelector('#wm-main-canvas');
    const maskCanvas  = container.querySelector('#wm-mask-canvas');
    const brushSizeIn = container.querySelector('#wm-brush-size');
    const brushOut    = container.querySelector('#wm-brush-out');
    const modeGrp     = container.querySelector('#wm-mode-grp');
    const clearMaskBtn= container.querySelector('#wm-clear-mask');
    const autoDetectBtn = container.querySelector('#wm-auto-detect');
    const applyBtn    = container.querySelector('#wm-apply-btn');
    const splitWrap   = container.querySelector('#wm-split-wrap');
    const afterImg    = container.querySelector('#wm-after-img');
    const beforeImg   = container.querySelector('#wm-before-img');
    const beforeClip  = container.querySelector('#wm-before-clip');
    const sliderHandle= container.querySelector('#wm-slider-handle');
    const compareBox  = container.querySelector('#wm-compare-box');
    const editAgainBtn= container.querySelector('#wm-edit-again');
    const downloadBtn = container.querySelector('#wm-download-btn');
    const clearAllBtn = container.querySelector('#wm-clear-all');
    const metaInfo    = container.querySelector('#wm-meta-info');

    let currentFile = null;
    let originalBitmap = null;
    let processedBlob = null;
    let mode = 'brush'; // 'brush' | 'rect'
    let isDrawing = false;
    let lastX = 0, lastY = 0;
    let rectStartX = 0, rectStartY = 0;

    const mainCtx = mainCanvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');

    const revokeAll = () => { for (const u of urls.splice(0)) URL.revokeObjectURL(u); };

    function initCanvases(decoded) {
      originalBitmap = decoded.bitmap;
      mainCanvas.width = decoded.width;
      mainCanvas.height = decoded.height;
      maskCanvas.width = decoded.width;
      maskCanvas.height = decoded.height;

      mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
      mainCtx.drawImage(decoded.bitmap, 0, 0);

      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      maskCtx.strokeStyle = 'rgba(239, 68, 68, 0.9)'; // Red highlight
      maskCtx.fillStyle = 'rgba(239, 68, 68, 0.7)';
      maskCtx.lineCap = 'round';
      maskCtx.lineJoin = 'round';

      splitWrap.hidden = true;
      editAgainBtn.hidden = true;
      downloadBtn.disabled = true;

      metaInfo.textContent = `${decoded.width} × ${decoded.height} px · ${currentFile ? humanBytes(currentFile.size) : ''}`;
    }

    async function handleFile(file) {
      if (!file || !file.type.startsWith('image/')) return;
      currentFile = file;
      work.hidden = false;
      analytics?.started();

      try {
        const decoded = await decodeImage(file);
        initCanvases(decoded);
      } catch (err) {
        alert('Could not decode this image format: ' + err.message);
      }
    }

    this._cleanup.push(attachFileInput(zone, input, (files) => {
      if (files[0]) handleFile(files[0]);
    }));

    /* --- Drawing on Mask Canvas --- */
    function getCanvasCoords(e) {
      const rect = maskCanvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const scaleX = maskCanvas.width / rect.width;
      const scaleY = maskCanvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    }

    const onPointerDown = (e) => {
      isDrawing = true;
      const { x, y } = getCanvasCoords(e);
      lastX = x; lastY = y;
      rectStartX = x; rectStartY = y;

      if (mode === 'brush') {
        const radius = Number(brushSizeIn.value);
        maskCtx.beginPath();
        maskCtx.arc(x, y, radius / 2, 0, Math.PI * 2);
        maskCtx.fill();
      }
    };

    const onPointerMove = (e) => {
      if (!isDrawing) return;
      const { x, y } = getCanvasCoords(e);

      if (mode === 'brush') {
        const radius = Number(brushSizeIn.value);
        maskCtx.lineWidth = radius;
        maskCtx.beginPath();
        maskCtx.moveTo(lastX, lastY);
        maskCtx.lineTo(x, y);
        maskCtx.stroke();
        lastX = x; lastY = y;
      }
    };

    const onPointerUp = (e) => {
      if (!isDrawing) return;
      isDrawing = false;
      if (mode === 'rect') {
        const endEvent = e.changedTouches ? e.changedTouches[0] : e;
        const rect = maskCanvas.getBoundingClientRect();
        const scaleX = maskCanvas.width / rect.width;
        const scaleY = maskCanvas.height / rect.height;
        const x = (endEvent.clientX - rect.left) * scaleX;
        const y = (endEvent.clientY - rect.top) * scaleY;
        const w = x - rectStartX;
        const h = y - rectStartY;
        maskCtx.fillRect(rectStartX, rectStartY, w, h);
      }
    };

    maskCanvas.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    maskCanvas.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    /* --- Toolbar Interactions --- */
    brushSizeIn.addEventListener('input', () => {
      brushOut.textContent = `${brushSizeIn.value}px`;
    });

    modeGrp.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mode]');
      if (!btn) return;
      for (const b of modeGrp.querySelectorAll('.btn')) b.classList.toggle('is-active', b === btn);
      mode = btn.dataset.mode;
      container.querySelector('#wm-brush-opts').hidden = (mode !== 'brush');
    });

    clearMaskBtn.addEventListener('click', () => {
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    });

    /* --- Auto-detect Text Watermarks --- */
    autoDetectBtn.addEventListener('click', () => {
      if (!originalBitmap) return;
      const w = mainCanvas.width;
      const h = mainCanvas.height;
      const imgData = mainCtx.getImageData(0, 0, w, h);
      const data = imgData.data;

      // Find high local contrast / text edges (Sobel-like gradient magnitude)
      const grad = new Float32Array(w * h);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = (y * w + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          const lumL = 0.299 * data[idx - 4] + 0.587 * data[idx - 3] + 0.114 * data[idx - 2];
          const lumR = 0.299 * data[idx + 4] + 0.587 * data[idx + 5] + 0.114 * data[idx + 6];
          const lumT = 0.299 * data[idx - w * 4] + 0.587 * data[idx - w * 4 + 1] + 0.114 * data[idx - w * 4 + 2];
          const lumB = 0.299 * data[idx + w * 4] + 0.587 * data[idx + w * 4 + 1] + 0.114 * data[idx + w * 4 + 2];
          const dx = lumR - lumL;
          const dy = lumB - lumT;
          grad[y * w + x] = Math.hypot(dx, dy);
        }
      }

      // Check watermark-dense regions (corners, center, and repeating watermarks)
      const blockSize = 32;
      for (let by = 0; by < h; by += blockSize) {
        for (let bx = 0; bx < w; bx += blockSize) {
          let highEdges = 0;
          const bw = Math.min(blockSize, w - bx);
          const bh = Math.min(blockSize, h - by);
          for (let y = by; y < by + bh; y++) {
            for (let x = bx; x < bx + bw; x++) {
              if (grad[y * w + x] > 55) highEdges++;
            }
          }
          const density = highEdges / (bw * bh);
          // Highlight high-frequency text-like candidate blocks (semi-transparent)
          if (density > 0.18 && density < 0.65) {
            maskCtx.fillRect(bx, by, bw, bh);
          }
        }
      }
    });

    /* --- High-Quality Fast Content-Aware Inpainting --- */
    function inpaintFast(imgData, maskData, width, height) {
      const data = imgData.data;
      const mask = maskData.data;
      const numPixels = width * height;
      const isHole = new Uint8Array(numPixels);
      let holeCount = 0;

      for (let i = 0; i < numPixels; i++) {
        // Red mask presence indicates hole to inpaint
        if (mask[i * 4 + 3] > 30) {
          isHole[i] = 1;
          holeCount++;
        }
      }

      if (!holeCount) return false;

      // Multi-pass patch synthesis & fast iterative gradient diffusion
      const maxPasses = 12;
      const r = 3;

      for (let pass = 0; pass < maxPasses; pass++) {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (!isHole[idx]) continue;

            let rSum = 0, gSum = 0, bSum = 0, weightSum = 0;

            for (let dy = -r; dy <= r; dy++) {
              const ny = y + dy;
              if (ny < 0 || ny >= height) continue;
              for (let dx = -r; dx <= r; dx++) {
                const nx = x + dx;
                if (nx < 0 || nx >= width) continue;
                const nIdx = ny * width + nx;
                const d2 = dx * dx + dy * dy;
                if (d2 === 0 || d2 > r * r) continue;

                // Surrounding valid pixels or earlier pass estimates
                const weight = 1 / Math.sqrt(d2);
                const p = nIdx * 4;
                rSum += data[p] * weight;
                gSum += data[p + 1] * weight;
                bSum += data[p + 2] * weight;
                weightSum += weight;
              }
            }

            if (weightSum > 0) {
              const p = idx * 4;
              data[p]     = Math.round(rSum / weightSum);
              data[p + 1] = Math.round(gSum / weightSum);
              data[p + 2] = Math.round(bSum / weightSum);
            }
          }
        }
      }
      return true;
    }

    applyBtn.addEventListener('click', async () => {
      if (!originalBitmap) return;
      applyBtn.disabled = true;
      applyBtn.textContent = 'Removing…';

      // Yield frame so button states update
      await new Promise(r => requestAnimationFrame(r));

      const w = mainCanvas.width;
      const h = mainCanvas.height;
      const imgData = mainCtx.getImageData(0, 0, w, h);
      const maskData = maskCtx.getImageData(0, 0, w, h);

      const t0 = performance.now();
      const removed = inpaintFast(imgData, maskData, w, h);
      const duration = Math.round(performance.now() - t0);

      if (!removed) {
        alert('Please brush or box-select the text watermark first.');
        applyBtn.disabled = false;
        applyBtn.textContent = 'Remove Watermark';
        return;
      }

      mainCtx.putImageData(imgData, 0, 0);

      // Create before/after preview images
      const origCanvas = document.createElement('canvas');
      origCanvas.width = w;
      origCanvas.height = h;
      origCanvas.getContext('2d').drawImage(originalBitmap, 0, 0);

      revokeAll();
      const origUrl = origCanvas.toDataURL('image/png');
      const cleanUrl = mainCanvas.toDataURL('image/png');
      urls.push(origUrl, cleanUrl);

      beforeImg.src = origUrl;
      afterImg.src = cleanUrl;

      // Sync sizing for split slider
      afterImg.onload = () => {
        beforeImg.style.width = `${afterImg.clientWidth}px`;
        beforeImg.style.height = `${afterImg.clientHeight}px`;
        compareBox.style.width = `${afterImg.clientWidth}px`;
        compareBox.style.height = `${afterImg.clientHeight}px`;
        beforeClip.style.width = '50%';
        sliderHandle.style.left = '50%';
      };

      mainCanvas.toBlob((blob) => {
        processedBlob = blob;
        downloadBtn.disabled = false;
        metaInfo.textContent = `Watermark removed in ${duration} ms · Cleaned size: ${humanBytes(blob.size)}`;
      }, currentFile?.type || 'image/png', 0.94);

      splitWrap.hidden = false;
      editAgainBtn.hidden = false;
      applyBtn.disabled = false;
      applyBtn.textContent = 'Remove Watermark';

      analytics?.completed({ duration });
    });

    /* --- Split Comparison Slider Handling --- */
    let isSliding = false;
    const updateSplit = (clientX) => {
      const rect = compareBox.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const pct = (x / rect.width) * 100;
      beforeClip.style.width = `${pct}%`;
      sliderHandle.style.left = `${pct}%`;
    };

    sliderHandle.addEventListener('mousedown', () => { isSliding = true; });
    sliderHandle.addEventListener('touchstart', () => { isSliding = true; }, { passive: true });

    window.addEventListener('mousemove', (e) => {
      if (!isSliding) return;
      updateSplit(e.clientX);
    });
    window.addEventListener('touchmove', (e) => {
      if (!isSliding || !e.touches[0]) return;
      updateSplit(e.touches[0].clientX);
    }, { passive: true });

    window.addEventListener('mouseup', () => { isSliding = false; });
    window.addEventListener('touchend', () => { isSliding = false; });

    editAgainBtn.addEventListener('click', () => {
      splitWrap.hidden = true;
      editAgainBtn.hidden = true;
    });

    downloadBtn.addEventListener('click', () => {
      if (!processedBlob) return;
      const baseName = (currentFile?.name || 'cleaned_image.png').replace(/\.[^.]+$/, '');
      const ext = currentFile?.type === 'image/jpeg' ? 'jpg' : 'png';
      downloadBlob(processedBlob, `${baseName}-cleaned.${ext}`);
      analytics?.downloaded({ fileCount: 1 });
    });

    clearAllBtn.addEventListener('click', () => {
      revokeAll();
      if (originalBitmap?.close) originalBitmap.close();
      currentFile = null;
      originalBitmap = null;
      processedBlob = null;
      work.hidden = true;
      input.value = '';
    });

    this._revoke = revokeAll;
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    this._revoke?.();
    this._cleanup = [];
  },
};
