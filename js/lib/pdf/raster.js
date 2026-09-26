/* ============================================================
   Rendering side of the PDF workspace (browser only).

   Page rendering, rasterising (compress-by-downsampling, redaction,
   encrypted-file fallback), page → PNG/JPEG export and embedded image
   extraction. Pages are processed one at a time and every canvas is
   released straight after use, so a 500-page job never holds more
   than one page of pixels.
   ============================================================ */

import { loadPdfLib, checkAbort, tick, normRot, userRectToView, viewSize, openPdfLib, savePdf } from './core.js';
import { openPdfJs } from './pdfjs-loader.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function releaseCanvas(c) {
  if (!c) return;
  c.width = 0; c.height = 0;
}

export function canvasToBlob(canvas, type = 'image/png', quality = 0.9) {
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not encode the page image.'))), type, quality));
}

/**
 * Render one page. `rotation` is the absolute display rotation; omit it
 * to use the page's own /Rotate. Returns {canvas, viewport}; the render
 * can be cancelled through `signal`.
 */
export async function renderPage(pdfDoc, pageIndex, { scale = 1, rotation, canvas, signal, background = '#ffffff', maxPixels = 16e6 } = {}) {
  checkAbort(signal);
  const page = await pdfDoc.getPage(pageIndex + 1);
  const rot = rotation == null ? page.rotate : normRot(rotation);
  let viewport = page.getViewport({ scale, rotation: rot });
  // Keep huge pages within what browsers allow a canvas to be.
  if (viewport.width * viewport.height > maxPixels) {
    const s = Math.sqrt(maxPixels / (viewport.width * viewport.height));
    viewport = page.getViewport({ scale: scale * s, rotation: rot });
  }
  const c = canvas || makeCanvas(viewport.width, viewport.height);
  c.width = Math.max(1, Math.floor(viewport.width));
  c.height = Math.max(1, Math.floor(viewport.height));
  const ctx = c.getContext('2d', { alpha: false });
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, c.width, c.height);
  const task = page.render({ canvasContext: ctx, viewport, background });
  const onAbort = () => task.cancel();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    await task.promise;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    page.cleanup?.();
  }
  checkAbort(signal);
  return { canvas: c, viewport, page };
}

/**
 * Rebuild pages as images. Used for
 *  - compress with downsampling (every page, JPEG at `dpi`),
 *  - redaction (only pages with boxes; boxes painted before encoding, so
 *    the covered text and graphics no longer exist anywhere in the file),
 *  - encrypted sources pdf-lib cannot copy.
 * @param {Uint8Array} bytes
 * @param {object} o {dpi, quality, pages (indices|null), redactions: Map<index, userRect[]>, password, keepOthers}
 * @returns {Promise<Uint8Array>}
 */
export async function rasterizePdf(bytes, { dpi = 150, quality = 0.8, pages = null, redactions = null, password = '', signal, onProgress, grayscale = false } = {}) {
  const { PDFDocument } = await loadPdfLib();
  const { doc: pdf } = await openPdfJs(bytes, { password });
  let out;
  let inPlace = false;
  try {
    const lib = await openPdfLib(bytes);
    if (!lib.isEncrypted) { out = lib; inPlace = true; }
  } catch { /* fall through to a fresh document */ }
  if (!out) out = await PDFDocument.create();

  const count = pdf.numPages;
  const targets = pages ?? Array.from({ length: count }, (_, i) => i);
  const targetSet = new Set(targets);
  const scale = dpi / 72;
  try {
    for (let i = 0, done = 0; i < count; i++) {
      if (!inPlace && !targetSet.has(i)) {
        // Fresh document (encrypted source): every page has to be rebuilt.
        targetSet.add(i);
      }
      if (!targetSet.has(i)) continue;
      checkAbort(signal);
      const { canvas, viewport, page } = await renderPage(pdf, i, { scale, signal });
      const ctx = canvas.getContext('2d');
      const boxes = redactions?.get(i) || [];
      if (boxes.length) {
        const view = page.view; // [x0, y0, x1, y1]
        const box = { x: view[0], y: view[1], width: view[2] - view[0], height: view[3] - view[1] };
        const s = canvas.width / viewSize(box, page.rotate).width;
        ctx.fillStyle = '#000';
        for (const r of boxes) {
          const v = userRectToView(box, page.rotate, r);
          ctx.fillRect(Math.floor(v.x * s) - 1, Math.floor(v.y * s) - 1, Math.ceil(v.width * s) + 2, Math.ceil(v.height * s) + 2);
        }
      }
      if (grayscale) {
        ctx.globalCompositeOperation = 'saturation';
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
      }
      const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
      const w = viewport.width / scale, h = viewport.height / scale;
      releaseCanvas(canvas);
      const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      if (inPlace) {
        const fresh = out.insertPage(i, [w, h]);
        fresh.drawImage(img, { x: 0, y: 0, width: w, height: h });
        out.removePage(i + 1);
      } else {
        const fresh = out.addPage([w, h]);
        fresh.drawImage(img, { x: 0, y: 0, width: w, height: h });
      }
      done++;
      onProgress?.(done / (inPlace ? targets.length : count));
      await tick();
    }
  } finally {
    pdf.destroy?.();
  }
  out.setProducer('Toolbox');
  return savePdf(out);
}

/**
 * Pages → PNG/JPEG files.
 * @returns {Promise<Array<{name: string, data: Uint8Array}>>}
 */
export async function pagesToImages(pdfDoc, indices, { format = 'png', dpi = 150, quality = 0.9, base = 'page', signal, onProgress } = {}) {
  const type = format === 'jpeg' || format === 'jpg' ? 'image/jpeg' : 'image/png';
  const ext = type === 'image/png' ? 'png' : 'jpg';
  const pad = String(pdfDoc.numPages).length;
  const out = [];
  for (let k = 0; k < indices.length; k++) {
    checkAbort(signal);
    const { canvas } = await renderPage(pdfDoc, indices[k], { scale: dpi / 72, signal });
    const blob = await canvasToBlob(canvas, type, quality);
    releaseCanvas(canvas);
    out.push({ name: `${base}-${String(indices[k] + 1).padStart(pad, '0')}.${ext}`, data: new Uint8Array(await blob.arrayBuffer()) });
    onProgress?.((k + 1) / indices.length);
    await tick();
  }
  return out;
}

/**
 * Pull embedded raster images out as PNG files. Uses the operator list so
 * each image XObject is visited once per page; duplicates across pages
 * (a logo on every page) are exported once.
 */
export async function extractImages(pdfDoc, { pages, minSize = 24, signal, onProgress, base = 'image', limit = 400 } = {}) {
  const pdfjs = await import('pdfjs-dist');
  const OPS = pdfjs.OPS;
  const list = pages ?? Array.from({ length: pdfDoc.numPages }, (_, i) => i);
  const out = [];
  const seen = new Set();
  for (let k = 0; k < list.length && out.length < limit; k++) {
    checkAbort(signal);
    const page = await pdfDoc.getPage(list[k] + 1);
    const ops = await page.getOperatorList();
    let n = 0;
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      if (fn !== OPS.paintImageXObject && fn !== OPS.paintInlineImageXObject && fn !== OPS.paintImageXObjectRepeat) continue;
      const arg = ops.argsArray[i][0];
      const id = typeof arg === 'string' ? arg : null;
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      const img = id ? await getObj(page, id) : arg;
      if (!img || (img.width || 0) < minSize || (img.height || 0) < minSize) continue;
      const canvas = imageToCanvas(img);
      if (!canvas) continue;
      const blob = await canvasToBlob(canvas, 'image/png');
      releaseCanvas(canvas);
      n++;
      out.push({ name: `${base}-p${list[k] + 1}-${n}.png`, data: new Uint8Array(await blob.arrayBuffer()), width: img.width, height: img.height });
    }
    page.cleanup?.();
    onProgress?.((k + 1) / list.length);
    await tick();
  }
  return out;
}

function getObj(page, id) {
  return new Promise((resolve) => {
    const store = id.startsWith('g_') ? page.commonObjs : page.objs;
    const timer = setTimeout(() => resolve(null), 4000);
    try {
      store.get(id, (v) => { clearTimeout(timer); resolve(v); });
    } catch { clearTimeout(timer); resolve(null); }
  });
}

function imageToCanvas(img) {
  const w = img.width, h = img.height;
  if (!w || !h) return null;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  if (img.bitmap) { ctx.drawImage(img.bitmap, 0, 0); return c; }
  if (!img.data) return null;
  const px = ctx.createImageData(w, h);
  const src = img.data;
  const dst = px.data;
  if (src.length === w * h * 4) dst.set(src);
  else if (src.length === w * h * 3) {
    for (let i = 0, j = 0; i < src.length; i += 3, j += 4) { dst[j] = src[i]; dst[j + 1] = src[i + 1]; dst[j + 2] = src[i + 2]; dst[j + 3] = 255; }
  } else if (src.length === w * h) {
    for (let i = 0, j = 0; i < src.length; i++, j += 4) { dst[j] = dst[j + 1] = dst[j + 2] = src[i]; dst[j + 3] = 255; }
  } else {
    // 1-bit packed rows (kind 1).
    const row = (w + 7) >> 3;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const bit = (src[y * row + (x >> 3)] >> (7 - (x & 7))) & 1;
      const j = (y * w + x) * 4;
      dst[j] = dst[j + 1] = dst[j + 2] = bit ? 255 : 0; dst[j + 3] = 255;
    }
  }
  ctx.putImageData(px, 0, 0);
  return c;
}
