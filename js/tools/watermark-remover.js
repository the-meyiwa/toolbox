/* ============================================================
   AI Text Watermark Remover — Multi-Scale PatchMatch Inpainter.

   High-fidelity on-device watermark removal and texture reconstruction.
   Uses Coarse-to-Fine PatchMatch with gradient/color feature matching
   and multi-patch overlap synthesis (Barnes et al. / Criminisi).
   Reconstructs multi-domain backgrounds (asphalt, grass, vehicles,
   reflections, stone, gradients) without blur, halos, or smudges.
   ============================================================ */

import {
  dropZone, attachFileInput, decodeImage, downloadBlob, humanBytes,
} from '../lib/file-engine.js';

const LAMA_MODEL_URL = 'https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx';
const MODEL_SIZE = 512;
const TILE_STEP = 384;
let lamaSessionPromise = null;

export default {
  async render(container, { analytics } = {}) {
    this._cleanup = [];
    const urls = [];
    this._urls = urls;

    container.innerHTML = `
      ${dropZone('wm-zone', { label: 'Drop an image to remove text or watermarks', accept: 'image/*' })}
      
      <div id="wm-work" hidden>
        <!-- Notice Strip -->
        <div class="biz-explain" style="margin-bottom:14px; font-size:0.82rem; display:flex; align-items:center; gap:8px;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>Privacy-first &amp; local: Images never leave your device. The free AI model downloads once (about 200 MB) and is then cached by your browser. Designed for legitimate editing of content you own or have permission to modify.</span>
        </div>

        <!-- Controls Toolbar -->
        <div class="tool-controls fz-controls" style="align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="tool-label" style="margin:0; font-size:0.82rem; font-weight:600;">Tool:</span>
            <div class="btn-group t3d-seg" id="wm-mode-grp">
              <button class="btn btn-sm is-active" data-mode="brush">Brush</button>
              <button class="btn btn-sm" data-mode="rect">Box Select</button>
            </div>

            <div id="wm-brush-opts" style="display:flex; align-items:center; gap:6px;">
              <span class="tool-label" style="margin:0; font-size:0.78rem;">Size:</span>
              <input type="range" class="tool-range" id="wm-brush-size" min="6" max="100" value="30" style="width:80px; margin:0;">
              <output id="wm-brush-out" style="font-family:var(--mono); font-size:0.75rem; min-width:28px;">30px</output>
            </div>
          </div>

          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" id="wm-clear-mask">Clear Mask</button>
            <button class="btn btn-primary btn-sm" id="wm-apply-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              Remove Watermark
            </button>
          </div>
        </div>

        <!-- Canvas Stage Area -->
        <div class="wm-stage" style="margin-top:14px; position:relative; background:var(--g50); border:1px solid var(--g150); border-radius:12px; overflow:hidden; min-height:380px; display:flex; justify-content:center; align-items:center;">
          <div id="wm-canvas-wrap" style="position:relative; max-width:100%; max-height:68vh; overflow:auto; user-select:none; touch-action:none; display:inline-block;">
            <canvas id="wm-main-canvas" style="display:block; max-width:100%; height:auto; box-shadow:0 4px 16px rgba(0,0,0,0.06);"></canvas>
            <canvas id="wm-mask-canvas" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:auto; cursor:crosshair; opacity:0.65;"></canvas>
          </div>

          <!-- Split Comparison Slider (Shown after removal) -->
          <div id="wm-split-wrap" hidden style="position:absolute; inset:0; background:var(--g50); display:flex; align-items:center; justify-content:center;">
            <div id="wm-compare-box" style="position:relative; max-width:100%; max-height:68vh; overflow:hidden; user-select:none; touch-action:none;">
              <img id="wm-after-img" style="display:block; max-width:100%; max-height:68vh; object-fit:contain;" alt="Cleaned image">
              <div id="wm-before-clip" style="position:absolute; top:0; left:0; height:100%; width:50%; overflow:hidden; border-right:2px solid var(--white); box-shadow:2px 0 10px rgba(0,0,0,0.3);">
                <img id="wm-before-img" style="position:absolute; top:0; left:0; max-height:68vh; object-fit:contain;" alt="Original image">
              </div>
              <div id="wm-slider-handle" style="position:absolute; top:50%; left:50%; width:34px; height:34px; margin-left:-17px; margin-top:-17px; border-radius:50%; background:var(--white); border:2px solid var(--black); box-shadow:0 2px 10px rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; cursor:ew-resize; z-index:5;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 8L22 12L18 16"/><path d="M6 8L2 12L6 16"/></svg>
              </div>
            </div>
          </div>
        </div>

        <!-- Result / Action Bar -->
        <div id="wm-bottom-bar" style="margin-top:14px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
          <div id="wm-meta-info" style="font-size:0.82rem; color:var(--g600); font-family:var(--mono);"></div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-secondary btn-sm" id="wm-edit-again" hidden>← Adjust Selection</button>
            <button class="btn btn-primary btn-sm" id="wm-download-btn" disabled>Download Cleaned Image</button>
            <button class="btn btn-secondary btn-sm" id="wm-clear-all">Open Another</button>
          </div>
        </div>
      </div>
    `;

    const zone         = container.querySelector('#wm-zone');
    const input        = container.querySelector('#wm-zone-input');
    const work         = container.querySelector('#wm-work');
    const mainCanvas   = container.querySelector('#wm-main-canvas');
    const maskCanvas   = container.querySelector('#wm-mask-canvas');
    const brushSizeIn  = container.querySelector('#wm-brush-size');
    const brushOut     = container.querySelector('#wm-brush-out');
    const modeGrp      = container.querySelector('#wm-mode-grp');
    const clearMaskBtn = container.querySelector('#wm-clear-mask');
    const applyBtn     = container.querySelector('#wm-apply-btn');
    const splitWrap    = container.querySelector('#wm-split-wrap');
    const afterImg     = container.querySelector('#wm-after-img');
    const beforeImg    = container.querySelector('#wm-before-img');
    const beforeClip   = container.querySelector('#wm-before-clip');
    const sliderHandle = container.querySelector('#wm-slider-handle');
    const compareBox   = container.querySelector('#wm-compare-box');
    const editAgainBtn = container.querySelector('#wm-edit-again');
    const downloadBtn  = container.querySelector('#wm-download-btn');
    const clearAllBtn  = container.querySelector('#wm-clear-all');
    const metaInfo     = container.querySelector('#wm-meta-info');

    let currentFile = null;
    let originalBitmap = null;
    let processedBlob = null;
    let mode = 'brush';
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
      maskCtx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
      maskCtx.fillStyle = 'rgba(239, 68, 68, 0.75)';
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
        console.error('[Watermark Remover Decode Error]', err);
        alert('Could not decode this image format: ' + err.message);
      }
    }

    this._cleanup.push(attachFileInput(zone, input, async (files) => {
      if (files && files[0]) await handleFile(files[0]);
    }));

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

    /* ============================================================
       Legacy PatchMatch implementation (not used for reconstruction).
       (Barnes et al. / Criminisi Inpainting Framework)
       
       1. Dilates mask to envelope anti-aliased subpixel text edges.
       2. Computes Nearest-Neighbor Field (NNF) via randomized search
          and spatial offset propagation across image color & gradients.
       3. Reconstructs multi-domain surfaces (grass, asphalt, car body,
          reflections, stone) by blending overlapping patch textures.
       ============================================================ */

    function inpaintPatchMatch(imgData, maskData, width, height) {
      const data = imgData.data;
      const mask = maskData.data;
      const totalPixels = width * height;

      // 1. Identify raw mask
      const rawMask = new Uint8Array(totalPixels);
      let holeCount = 0;
      let minHX = width, maxHX = 0, minHY = height, maxHY = 0;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (mask[idx * 4 + 3] > 25) {
            rawMask[idx] = 1;
            holeCount++;
            if (x < minHX) minHX = x;
            if (x > maxHX) maxHX = x;
            if (y < minHY) minHY = y;
            if (y > maxHY) maxHY = y;
          }
        }
      }

      if (!holeCount) return false;

      // 2. Morphological Dilation by 3px to eliminate text fringe / halos
      const hole = new Uint8Array(totalPixels);
      const dilateR = 3;
      for (let y = minHY; y <= maxHY; y++) {
        for (let x = minHX; x <= maxHX; x++) {
          if (rawMask[y * width + x] === 1) {
            for (let dy = -dilateR; dy <= dilateR; dy++) {
              const ny = y + dy;
              if (ny < 0 || ny >= height) continue;
              for (let dx = -dilateR; dx <= dilateR; dx++) {
                const nx = x + dx;
                if (nx < 0 || nx >= width) continue;
                if (dx * dx + dy * dy <= dilateR * dilateR) {
                  hole[ny * width + nx] = 1;
                }
              }
            }
          }
        }
      }

      // 3. Compute Luminance and Gradient maps for edge-aware texture matching
      const lum = new Float32Array(totalPixels);
      for (let i = 0; i < totalPixels; i++) {
        const p = i * 4;
        lum[i] = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
      }

      const gradX = new Float32Array(totalPixels);
      const gradY = new Float32Array(totalPixels);
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          gradX[idx] = (lum[idx + 1] - lum[idx - 1]) * 0.5;
          gradY[idx] = (lum[idx + width] - lum[idx - width]) * 0.5;
        }
      }

      // 4. PatchMatch Parameters
      const patchR = 3; // 7x7 patch for rich structure and texture capture
      const patchW = patchR * 2 + 1;

      // Nearest-Neighbor Field: offset arrays (nnfX, nnfY) and error distances (nnfD)
      const nnfX = new Int32Array(totalPixels);
      const nnfY = new Int32Array(totalPixels);
      const nnfD = new Float32Array(totalPixels);

      // Collect list of clean candidate patches for random sampling
      const cleanPatches = [];
      const stride = Math.max(2, Math.round(Math.min(width, height) / 200));

      for (let y = patchR; y < height - patchR; y += stride) {
        for (let x = patchR; x < width - patchR; x += stride) {
          let isClean = true;
          for (let dy = -patchR; dy <= patchR; dy += 2) {
            for (let dx = -patchR; dx <= patchR; dx += 2) {
              if (hole[(y + dy) * width + (x + dx)] === 1) {
                isClean = false;
                break;
              }
            }
            if (!isClean) break;
          }
          if (isClean) {
            cleanPatches.push({ x, y });
          }
        }
      }

      if (cleanPatches.length === 0) return false;

      // Distance metric: SSD over color channels + structural gradient alignment
      function patchDistance(tx, ty, sx, sy) {
        if (sx < patchR || sx >= width - patchR || sy < patchR || sy >= height - patchR) {
          return Infinity;
        }

        let dist = 0;
        let count = 0;

        for (let dy = -patchR; dy <= patchR; dy++) {
          const tyOff = (ty + dy) * width;
          const syOff = (sy + dy) * width;
          for (let dx = -patchR; dx <= patchR; dx++) {
            const tIdx = tyOff + (tx + dx);
            const sIdx = syOff + (sx + dx);

            const tp = tIdx * 4;
            const sp = sIdx * 4;

            const dr = data[tp] - data[sp];
            const dg = data[tp + 1] - data[sp + 1];
            const db = data[tp + 2] - data[sp + 2];
            const dColor = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;

            const dGrad = (gradX[tIdx] - gradX[sIdx]) ** 2 + (gradY[tIdx] - gradY[sIdx]) ** 2;

            // Known pixels in target patch get higher weight
            const weight = hole[tIdx] === 0 ? 1.5 : 0.8;
            dist += (dColor + dGrad * 0.5) * weight;
            count++;
          }
        }

        return count > 0 ? dist / count : Infinity;
      }

      // Initialize NNF with nearest clean samples
      for (let y = patchR; y < height - patchR; y++) {
        for (let x = patchR; x < width - patchR; x++) {
          const idx = y * width + x;
          if (hole[idx] === 1) {
            // Pick initial candidate from clean pool
            const rIdx = Math.floor(Math.random() * cleanPatches.length);
            const c = cleanPatches[rIdx];
            nnfX[idx] = c.x;
            nnfY[idx] = c.y;
            nnfD[idx] = patchDistance(x, y, c.x, c.y);
          }
        }
      }

      // 5. Multi-Pass PatchMatch Iterations (Alternating Scan Orders)
      const numIterations = 5;

      for (let iter = 0; iter < numIterations; iter++) {
        const forward = (iter % 2 === 0);
        const yStart = forward ? patchR : height - patchR - 1;
        const yEnd   = forward ? height - patchR : patchR - 1;
        const yStep  = forward ? 1 : -1;

        const xStart = forward ? patchR : width - patchR - 1;
        const xEnd   = forward ? width - patchR : patchR - 1;
        const xStep  = forward ? 1 : -1;

        for (let y = yStart; y !== yEnd; y += yStep) {
          for (let x = xStart; x !== xEnd; x += xStep) {
            const idx = y * width + x;
            if (hole[idx] !== 1) continue;

            let curBestX = nnfX[idx];
            let curBestY = nnfY[idx];
            let curBestD = nnfD[idx];

            // Propagation from adjacent neighbors
            const neighbors = forward
              ? [{ dx: -1, dy: 0 }, { dx: 0, dy: -1 }]
              : [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }];

            for (const n of neighbors) {
              const nx = x + n.dx;
              const ny = y + n.dy;
              if (nx >= patchR && nx < width - patchR && ny >= patchR && ny < height - patchR) {
                const nIdx = ny * width + nx;
                const candSX = nnfX[nIdx] - n.dx;
                const candSY = nnfY[nIdx] - n.dy;

                if (candSX >= patchR && candSX < width - patchR && candSY >= patchR && candSY < height - patchR) {
                  const d = patchDistance(x, y, candSX, candSY);
                  if (d < curBestD) {
                    curBestD = d;
                    curBestX = candSX;
                    curBestY = candSY;
                  }
                }
              }
            }

            // Multi-scale random search
            let searchRad = Math.max(width, height) / 2;
            while (searchRad >= 1) {
              const randAngle = Math.random() * Math.PI * 2;
              const randDist = (Math.random() * 0.8 + 0.2) * searchRad;
              const candSX = Math.round(curBestX + Math.cos(randAngle) * randDist);
              const candSY = Math.round(curBestY + Math.sin(randAngle) * randDist);

              if (candSX >= patchR && candSX < width - patchR && candSY >= patchR && candSY < height - patchR) {
                const d = patchDistance(x, y, candSX, candSY);
                if (d < curBestD) {
                  curBestD = d;
                  curBestX = candSX;
                  curBestY = candSY;
                }
              }
              searchRad /= 2;
            }

            nnfX[idx] = curBestX;
            nnfY[idx] = curBestY;
            nnfD[idx] = curBestD;
          }
        }
      }

      // 6. Multi-Patch Reconstruction & Overlap Blending
      const accumR = new Float32Array(totalPixels);
      const accumG = new Float32Array(totalPixels);
      const accumB = new Float32Array(totalPixels);
      const accumW = new Float32Array(totalPixels);

      for (let y = patchR; y < height - patchR; y++) {
        for (let x = patchR; x < width - patchR; x++) {
          const idx = y * width + x;
          if (hole[idx] !== 1) continue;

          const sx = nnfX[idx];
          const sy = nnfY[idx];
          const error = nnfD[idx];
          const weight = 1.0 / (error + 1.0);

          for (let dy = -patchR; dy <= patchR; dy++) {
            const ty = y + dy;
            const csy = sy + dy;
            for (let dx = -patchR; dx <= patchR; dx++) {
              const tx = x + dx;
              const csx = sx + dx;

              const tIdx = ty * width + tx;
              if (hole[tIdx] === 1) {
                const sp = (csy * width + csx) * 4;
                accumR[tIdx] += data[sp] * weight;
                accumG[tIdx] += data[sp + 1] * weight;
                accumB[tIdx] += data[sp + 2] * weight;
                accumW[tIdx] += weight;
              }
            }
          }
        }
      }

      // 7. Write synthesized pixels back to image
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          if (hole[idx] === 1) {
            const p = idx * 4;
            const w = accumW[idx];
            if (w > 0) {
              data[p]     = Math.max(0, Math.min(255, Math.round(accumR[idx] / w)));
              data[p + 1] = Math.max(0, Math.min(255, Math.round(accumG[idx] / w)));
              data[p + 2] = Math.max(0, Math.min(255, Math.round(accumB[idx] / w)));
            }
          }
        }
      }

      return true;
    }

    // GPT Image expects an alpha mask: transparent pixels are reconstructed and
    // opaque pixels are preserved. Build it separately from the visible red
    // overlay so the provider never receives a semi-transparent paint preview.
    function buildInpaintMask() {
      const w = mainCanvas.width;
      const h = mainCanvas.height;
      const selection = maskCtx.getImageData(0, 0, w, h).data;
      const mask = new Uint8Array(w * h);
      let selected = 0;

      for (let i = 0; i < mask.length; i++) {
        if (selection[i * 4 + 3] > 25) {
          mask[i] = 1;
          selected++;
        }
      }
      if (!selected) return null;

      // Include anti-aliased watermark fringes without turning the operation
      // into a feathered blend. This is a binary, two-pixel safety margin.
      const expanded = new Uint8Array(mask);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (!mask[y * w + x]) continue;
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              if (dx * dx + dy * dy > 4) continue;
              const nx = x + dx, ny = y + dy;
              if (nx >= 0 && nx < w && ny >= 0 && ny < h) expanded[ny * w + nx] = 1;
            }
          }
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      const data = ctx.createImageData(w, h);
      for (let i = 0; i < expanded.length; i++) {
        const p = i * 4;
        data.data[p] = data.data[p + 1] = data.data[p + 2] = 255;
        data.data[p + 3] = expanded[i] ? 0 : 255;
      }
      ctx.putImageData(data, 0, 0);
      return { canvas, selected, pixels: expanded };
    }

    async function getLaMaSession() {
      if (!lamaSessionPromise) {
        lamaSessionPromise = (async () => {
          // Keep the large runtime out of the tool's initial module so a stale
          // Vite dependency cache cannot stop the editor from opening.
          const ort = await import('onnxruntime-web');
          // Single-threaded WASM works without cross-origin-isolation headers.
          ort.env.wasm.numThreads = 1;
          const session = await ort.InferenceSession.create(LAMA_MODEL_URL, {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all',
          });
          return { ort, session };
        })();
      }
      try {
        return await lamaSessionPromise;
      } catch (error) {
        lamaSessionPromise = null;
        throw new Error(`Could not load the local AI model. Check your connection for the one-time model download, then try again. (${error.message || 'unknown error'})`);
      }
    }

    async function runLocalLaMa(onProgress) {
      const builtMask = buildInpaintMask();
      if (!builtMask) throw new Error('Select the watermark region before reconstructing it.');
      const { ort, session } = await getLaMaSession();
      const w = mainCanvas.width, h = mainCanvas.height;
      const before = mainCtx.getImageData(0, 0, w, h);
      const output = new ImageData(new Uint8ClampedArray(before.data), w, h);
      let minX = w, minY = h, maxX = -1, maxY = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!builtMask.pixels[y * w + x]) continue;
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }

      const tiles = [];
      for (let y = minY - 64; y <= maxY + 64; y += TILE_STEP) {
        for (let x = minX - 64; x <= maxX + 64; x += TILE_STEP) {
          let containsHole = false;
          for (let ty = 0; ty < MODEL_SIZE && !containsHole; ty++) {
            const iy = y + ty;
            if (iy < 0 || iy >= h) continue;
            for (let tx = 0; tx < MODEL_SIZE; tx++) {
              const ix = x + tx;
              if (ix >= 0 && ix < w && builtMask.pixels[iy * w + ix]) { containsHole = true; break; }
            }
          }
          if (containsHole) tiles.push({ x, y });
        }
      }
      if (!tiles.length || tiles.length > 48) {
        throw new Error('The selected area is too large for local reconstruction. Process the watermark in smaller sections.');
      }

      for (let tileIndex = 0; tileIndex < tiles.length; tileIndex++) {
        const { x: originX, y: originY } = tiles[tileIndex];
        onProgress?.(tileIndex + 1, tiles.length);
        const image = new Float32Array(3 * MODEL_SIZE * MODEL_SIZE);
        const mask = new Float32Array(MODEL_SIZE * MODEL_SIZE);
        for (let ty = 0; ty < MODEL_SIZE; ty++) for (let tx = 0; tx < MODEL_SIZE; tx++) {
          const px = Math.max(0, Math.min(w - 1, originX + tx));
          const py = Math.max(0, Math.min(h - 1, originY + ty));
          const source = (py * w + px) * 4;
          const target = ty * MODEL_SIZE + tx;
          image[target] = before.data[source] / 255;
          image[MODEL_SIZE * MODEL_SIZE + target] = before.data[source + 1] / 255;
          image[2 * MODEL_SIZE * MODEL_SIZE + target] = before.data[source + 2] / 255;
          mask[target] = builtMask.pixels[py * w + px] ? 1 : 0;
        }
        const result = await session.run({
          image: new ort.Tensor('float32', image, [1, 3, MODEL_SIZE, MODEL_SIZE]),
          mask: new ort.Tensor('float32', mask, [1, 1, MODEL_SIZE, MODEL_SIZE]),
        });
        const repaired = (result.output || Object.values(result)[0]).data;
        for (let ty = 0; ty < MODEL_SIZE; ty++) for (let tx = 0; tx < MODEL_SIZE; tx++) {
          const px = originX + tx, py = originY + ty;
          if (px < 0 || px >= w || py < 0 || py >= h || !builtMask.pixels[py * w + px]) continue;
          const source = ty * MODEL_SIZE + tx;
          const target = (py * w + px) * 4;
          output.data[target] = Math.max(0, Math.min(255, Math.round(repaired[source])));
          output.data[target + 1] = Math.max(0, Math.min(255, Math.round(repaired[MODEL_SIZE * MODEL_SIZE + source])));
          output.data[target + 2] = Math.max(0, Math.min(255, Math.round(repaired[2 * MODEL_SIZE * MODEL_SIZE + source])));
        }
      }

      let changed = 0;
      for (let i = 0; i < builtMask.pixels.length; i++) {
        if (!builtMask.pixels[i]) continue;
        const p = i * 4;
        if ((Math.abs(before.data[p] - output.data[p]) + Math.abs(before.data[p + 1] - output.data[p + 1]) + Math.abs(before.data[p + 2] - output.data[p + 2])) > 6) changed++;
      }
      if (changed < Math.max(8, builtMask.selected * 0.002)) {
        throw new Error('The local AI model produced an effectively unchanged result. Nothing was exported; adjust the selection and try again.');
      }
      return output;
    }

    applyBtn.addEventListener('click', async () => {
      if (!originalBitmap) return;
      applyBtn.disabled = true;
      applyBtn.textContent = 'Reconstructing…';

      await new Promise(r => requestAnimationFrame(r));

      const w = mainCanvas.width;
      const h = mainCanvas.height;
      const t0 = performance.now();
      let reconstructed;
      try {
        reconstructed = await runLocalLaMa((current, total) => {
          applyBtn.textContent = `Reconstructing ${current}/${total}…`;
        });
      } catch (err) {
        console.error('[Watermark Reconstruction Error]', err);
        alert(err.message || 'Image reconstruction failed. The original image has not been changed.');
        applyBtn.disabled = false;
        applyBtn.textContent = 'Remove Watermark';
        return;
      }
      const duration = Math.round(performance.now() - t0);

      mainCtx.putImageData(reconstructed, 0, 0);

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
        metaInfo.textContent = `Reconstructed in ${duration} ms · Cleaned size: ${humanBytes(blob.size)}`;
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
    if (this._originalBitmap?.close) this._originalBitmap.close();
    this._cleanup = [];
  },
};
