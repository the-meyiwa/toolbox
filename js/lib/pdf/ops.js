/* ============================================================
   PDF operations beyond Merge, Split and the Editor.

   Each operation is bytes in, bytes (or files) out, so the single
   tools, the Workflow builder and the Assistant all run the same code:

     imposition   N-up, booklet
     pages        reverse, interleave, remove blank pages, insert blanks
     look         greyscale, invert, scanner effect, background tint
     geometry     crop margins, trim whitespace
     content      attachments, tables → CSV, compare, OCR
     structure    encrypt, decrypt, repair, linearise (qpdf, WASM)

   pdf-lib handles structure; pdf.js renders when pixels are needed;
   tesseract.js and qpdf load only when their operation runs.
   ============================================================ */

import { loadPdfLib, openPdfLib, savePdf, checkAbort, tick, pageGeometry, viewSize, normRot, parseRange, baseName } from './core.js';
import { openPdfJs } from './pdfjs-loader.js';
import { renderPage, canvasToBlob, releaseCanvas, makeCanvas } from './raster.js';
import { extractText } from './text.js';

const MM = 72 / 25.4;
export const SHEETS = { a4: [595.28, 841.89], a3: [841.89, 1190.55], a5: [419.53, 595.28], letter: [612, 792], legal: [612, 1008], tabloid: [792, 1224] };

async function loadForCopy(bytes) {
  const doc = await openPdfLib(bytes);
  if (doc.isEncrypted) throw new Error('This PDF is password-protected. Remove the password with PDF Protect first.');
  return doc;
}

/* ---------------- placing a page on a sheet ---------------- */

/** Draw an embedded page into the box [x, y, w, h] (view space), honouring its /Rotate. */
function placeRotated(sheet, emb, rot, x, y, w, h, degrees) {
  if (!emb) return;
  switch (normRot(rot)) {
    case 90: sheet.drawPage(emb, { x, y: y + h, width: h, height: w, rotate: degrees(-90) }); break;
    case 180: sheet.drawPage(emb, { x: x + w, y: y + h, width: w, height: h, rotate: degrees(180) }); break;
    case 270: sheet.drawPage(emb, { x: x + w, y, width: h, height: w, rotate: degrees(90) }); break;
    default: sheet.drawPage(emb, { x, y, width: w, height: h });
  }
}

/* pdf-lib cannot embed a page with no content stream (a truly blank page),
   and only says so when the document is saved. Such a page draws nothing
   anyway, so it becomes null here and is skipped. */
async function embedAll(out, pages) {
  const list = [];
  for (const p of pages) list.push(p.node.Contents() ? (await out.embedPages([p]))[0] : null);
  return list;
}

const GRIDS = { 2: [2, 1], 4: [2, 2], 6: [3, 2], 8: [4, 2], 9: [3, 3], 16: [4, 4] };

/**
 * N-up: several pages per sheet.
 * @param {{perSheet: number, sheet: string, orientation: 'auto'|'portrait'|'landscape', margin: number, gap: number, border: boolean, order: 'row'|'column'}} o
 */
export async function nUp(bytes, { perSheet = 2, sheet = 'a4', orientation = 'auto', margin = 8, gap = 4, border = false, order = 'row' } = {}, { signal, onProgress } = {}) {
  const { PDFDocument, degrees, rgb } = await loadPdfLib();
  const src = await loadForCopy(bytes);
  const pages = src.getPages();
  const out = await PDFDocument.create();
  const embedded = await embedAll(out, pages);
  let [cols, rows] = GRIDS[perSheet] || [2, 1];
  const first = viewSize(pageGeometry(pages[0]).box, pageGeometry(pages[0]).rot);
  let [W, H] = sheet === 'same' ? [first.width, first.height] : SHEETS[sheet] || SHEETS.a4;
  // Two or eight up read best side by side on a landscape sheet.
  const wantLandscape = orientation === 'landscape' || (orientation === 'auto' && (perSheet === 2 || perSheet === 8) === first.height >= first.width);
  if (wantLandscape !== W > H) [W, H] = [H, W];
  if (W > H && rows > cols) [cols, rows] = [rows, cols];
  if (H > W && cols > rows) [cols, rows] = [rows, cols];
  const m = margin * MM; const g = gap * MM;
  const cw = (W - 2 * m - (cols - 1) * g) / cols; const ch = (H - 2 * m - (rows - 1) * g) / rows;
  for (let s = 0; s < pages.length; s += perSheet) {
    checkAbort(signal);
    const sheetPage = out.addPage([W, H]);
    for (let k = 0; k < perSheet && s + k < pages.length; k++) {
      const i = s + k;
      const { box, rot } = pageGeometry(pages[i]);
      const v = viewSize(box, rot);
      const c = order === 'column' ? Math.floor(k / rows) : k % cols;
      const r = order === 'column' ? k % rows : Math.floor(k / cols);
      const scale = Math.min(cw / v.width, ch / v.height);
      const w = v.width * scale; const h = v.height * scale;
      const x = m + c * (cw + g) + (cw - w) / 2;
      const y = H - m - (r + 1) * ch - r * g + (ch - h) / 2;
      placeRotated(sheetPage, embedded[i], rot, x, y, w, h, degrees);
      if (border) sheetPage.drawRectangle({ x, y, width: w, height: h, borderColor: rgb(0.6, 0.6, 0.6), borderWidth: 0.5 });
    }
    onProgress?.((s + perSheet) / pages.length);
    if (s % 40 === 0) await tick();
  }
  return savePdf(out);
}

/** Saddle-stitch booklet: fold the printed stack in half and staple. */
export function bookletOrder(n) {
  const total = Math.ceil(n / 4) * 4;
  const order = [];
  for (let i = 0; i < total / 2; i += 2) {
    order.push(total - 1 - i, i, i + 1, total - 2 - i);
  }
  return order.map((p) => (p < n ? p : null));
}

export async function booklet(bytes, { sheet = 'a4', margin = 6, creep = 0 } = {}, { signal, onProgress } = {}) {
  const { PDFDocument, degrees } = await loadPdfLib();
  const src = await loadForCopy(bytes);
  const pages = src.getPages();
  const out = await PDFDocument.create();
  const embedded = await embedAll(out, pages);
  let [W, H] = SHEETS[sheet] || SHEETS.a4;
  if (H > W) [W, H] = [H, W];
  const m = margin * MM; const half = W / 2;
  const order = bookletOrder(pages.length);
  for (let s = 0; s < order.length; s += 2) {
    checkAbort(signal);
    const sheetPage = out.addPage([W, H]);
    const sheetNo = Math.floor(s / 4);
    [order[s], order[s + 1]].forEach((i, side) => {
      if (i == null) return;
      const { box, rot } = pageGeometry(pages[i]);
      const v = viewSize(box, rot);
      const scale = Math.min((half - 2 * m) / v.width, (H - 2 * m) / v.height);
      const w = v.width * scale; const h = v.height * scale;
      // Inner sheets sit further inside the fold; creep pulls them back toward the spine.
      const shift = creep * MM * sheetNo * (side === 0 ? 1 : -1);
      const x = side * half + (half - w) / 2 + shift;
      placeRotated(sheetPage, embedded[i], rot, x, (H - h) / 2, w, h, degrees);
    });
    onProgress?.((s + 2) / order.length);
  }
  return savePdf(out);
}

/* ---------------- page order ---------------- */

async function copyPages(sources, plan, { signal, onProgress } = {}) {
  const { PDFDocument, degrees } = await loadPdfLib();
  const out = await PDFDocument.create();
  const docs = await Promise.all(sources.map(loadForCopy));
  for (let k = 0; k < plan.length; k++) {
    checkAbort(signal);
    const step = plan[k];
    if (step.blank) { out.addPage([step.blank.width, step.blank.height]); continue; }
    const [p] = await out.copyPages(docs[step.src], [step.index]);
    if (step.rotate) p.setRotation(degrees(normRot((p.getRotation().angle || 0) + step.rotate)));
    out.addPage(p);
    onProgress?.((k + 1) / plan.length);
    if (k % 50 === 49) await tick();
  }
  return savePdf(out);
}

export async function reversePages(bytes, _o, ctx) {
  const n = (await loadForCopy(bytes)).getPageCount();
  return copyPages([bytes], Array.from({ length: n }, (_, i) => ({ src: 0, index: n - 1 - i })), ctx);
}

/**
 * Interleave fronts and backs from a one-sided scanner.
 * One file: first half fronts, second half backs. Two files: fronts, backs.
 */
export async function interleave(list, { backsReversed = true } = {}, ctx) {
  let fronts; let backs; let sources;
  if (list.length === 1) {
    const n = (await loadForCopy(list[0])).getPageCount();
    const h = Math.ceil(n / 2);
    fronts = Array.from({ length: h }, (_, i) => ({ src: 0, index: i }));
    backs = Array.from({ length: n - h }, (_, i) => ({ src: 0, index: h + i }));
    sources = [list[0]];
  } else {
    const [a, b] = await Promise.all(list.slice(0, 2).map(loadForCopy));
    fronts = Array.from({ length: a.getPageCount() }, (_, i) => ({ src: 0, index: i }));
    backs = Array.from({ length: b.getPageCount() }, (_, i) => ({ src: 1, index: i }));
    sources = list.slice(0, 2);
  }
  if (backsReversed) backs.reverse();
  const plan = [];
  for (let i = 0; i < Math.max(fronts.length, backs.length); i++) { if (fronts[i]) plan.push(fronts[i]); if (backs[i]) plan.push(backs[i]); }
  return copyPages(sources, plan, ctx);
}

/** Insert blank pages: after every N pages, or after listed pages. */
export async function insertBlanks(bytes, { every = 0, after = '', size = 'match' } = {}, ctx) {
  const doc = await loadForCopy(bytes);
  const n = doc.getPageCount();
  const listed = new Set(after ? parseRange(after, n) : []);
  const plan = [];
  doc.getPages().forEach((p, i) => {
    plan.push({ src: 0, index: i });
    if ((every > 0 && (i + 1) % every === 0) || listed.has(i)) {
      const { box, rot } = pageGeometry(p);
      const v = size === 'match' ? viewSize(box, rot) : { width: SHEETS[size][0], height: SHEETS[size][1] };
      plan.push({ blank: v });
    }
  });
  return copyPages([bytes], plan, ctx);
}

/** Share of a page that is not near-white, sampled at low resolution. */
export async function inkCoverage(pdf, index) {
  const { canvas } = await renderPage(pdf, index, { scale: 0.35 });
  const ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let ink = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i] + data[i + 1] + data[i + 2] < 690) ink++;
  releaseCanvas(canvas);
  return ink / (data.length / 4);
}

export async function removeBlankPages(bytes, { threshold = 0.5 } = {}, { signal, onProgress } = {}) {
  const { doc: pdf } = await openPdfJs(bytes);
  const keep = []; const dropped = [];
  try {
    for (let i = 0; i < pdf.numPages; i++) {
      checkAbort(signal);
      const cover = await inkCoverage(pdf, i);
      (cover * 100 > threshold ? keep : dropped).push(i);
      onProgress?.(((i + 1) / pdf.numPages) * 0.8, `Checking page ${i + 1} of ${pdf.numPages}`);
    }
  } finally { pdf.destroy?.(); }
  if (!keep.length) throw new Error('Every page looks blank at this setting. Lower the sensitivity.');
  const out = await copyPages([bytes], keep.map((index) => ({ src: 0, index })));
  return { bytes: out, removed: dropped.map((i) => i + 1) };
}

/* ---------------- pixels ---------------- */

export const FILTERS = {
  grayscale: (d) => { for (let i = 0; i < d.length; i += 4) { const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; d[i] = d[i + 1] = d[i + 2] = y; } },
  invert: (d) => { for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; } },
  threshold: (d, o) => { const t = (o.level ?? 60) * 2.55; for (let i = 0; i < d.length; i += 4) { const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; d[i] = d[i + 1] = d[i + 2] = y > t ? 255 : 0; } },
  scan: (d, o, w) => {
    // A photocopy look: greyscale, contrast, a little noise and toner warmth.
    let seed = 1234567 + (o.page || 0) * 7919;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < d.length; i += 4) {
      let y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      y = (y - 128) * 1.25 + 128 + (rnd() - 0.5) * 18;
      if ((i / 4) % w < 2) y *= 0.92;
      const v = Math.max(0, Math.min(255, y));
      d[i] = v; d[i + 1] = v * 0.995; d[i + 2] = v * 0.97;
    }
  },
  tint: (d, o) => {
    const [r, g, b] = o.rgb || [255, 248, 225];
    for (let i = 0; i < d.length; i += 4) {
      // Multiply keeps dark text dark and turns white paper into the tint.
      d[i] = (d[i] * r) / 255; d[i + 1] = (d[i + 1] * g) / 255; d[i + 2] = (d[i + 2] * b) / 255;
    }
  },
};

/**
 * Re-render each page through a pixel filter. The result is image-only:
 * text is no longer selectable, which callers say before running it.
 */
export async function filterPages(bytes, filter, { dpi = 150, quality = 0.85, pages = null, ...o } = {}, { signal, onProgress } = {}) {
  const { PDFDocument } = await loadPdfLib();
  const { doc: pdf } = await openPdfJs(bytes, { password: o.password || '' });
  const out = await PDFDocument.create();
  const fn = FILTERS[filter];
  if (!fn) throw new Error(`Unknown filter ${filter}`);
  const lib = await openPdfLib(bytes).catch(() => null);
  const target = pages ? new Set(typeof pages === 'string' ? parseRange(pages, pdf.numPages) : pages) : null;
  try {
    for (let i = 0; i < pdf.numPages; i++) {
      checkAbort(signal);
      if (target && !target.has(i) && lib && !lib.isEncrypted) {
        const [p] = await out.copyPages(lib, [i]); out.addPage(p); continue;
      }
      const { canvas, viewport } = await renderPage(pdf, i, { scale: dpi / 72, signal });
      const ctx = canvas.getContext('2d');
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      fn(img.data, { ...o, page: i }, canvas.width);
      ctx.putImageData(img, 0, 0);
      const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
      releaseCanvas(canvas);
      const jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      const w = viewport.width / (dpi / 72); const h = viewport.height / (dpi / 72);
      out.addPage([w, h]).drawImage(jpg, { x: 0, y: 0, width: w, height: h });
      onProgress?.((i + 1) / pdf.numPages, `Page ${i + 1} of ${pdf.numPages}`);
      await tick();
    }
  } finally { pdf.destroy?.(); }
  out.setProducer('Toolbox');
  return savePdf(out);
}

/* ---------------- crop ---------------- */

/** Bounding box of non-white pixels, as fractions of the page [left, top, right, bottom]. */
export function contentBounds(data, w, h, tolerance = 245) {
  let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (data[i] < tolerance || data[i + 1] < tolerance || data[i + 2] < tolerance) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  return [x0 / w, y0 / h, (x1 + 1) / w, (y1 + 1) / h];
}

/**
 * Crop by margins (mm, in the page as you see it) or trim to the content.
 * Sets both CropBox and MediaBox so every viewer and printer agrees.
 */
export async function cropPages(bytes, { mode = 'margins', top = 10, right = 10, bottom = 10, left = 10, padding = 4, pages = '' } = {}, { signal, onProgress } = {}) {
  const doc = await loadForCopy(bytes);
  const list = doc.getPages();
  const targets = new Set(pages ? parseRange(pages, list.length) : list.map((_, i) => i));
  let pdf = null;
  if (mode === 'auto') pdf = (await openPdfJs(bytes)).doc;
  try {
    for (let i = 0; i < list.length; i++) {
      if (!targets.has(i)) continue;
      checkAbort(signal);
      const p = list[i];
      const { box, rot } = pageGeometry(p);
      const v = viewSize(box, rot);
      // Margins as seen: [top, right, bottom, left] in points.
      let m;
      if (mode === 'auto') {
        const { canvas } = await renderPage(pdf, i, { scale: 0.75 });
        const b = contentBounds(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        releaseCanvas(canvas);
        if (!b) continue;
        const pad = padding * MM;
        m = [Math.max(0, b[1] * v.height - pad), Math.max(0, (1 - b[2]) * v.width - pad), Math.max(0, (1 - b[3]) * v.height - pad), Math.max(0, b[0] * v.width - pad)];
      } else m = [top, right, bottom, left].map((x) => Math.max(0, Number(x) || 0) * MM);
      // Map view-space margins onto the unrotated box's sides.
      const r = normRot(rot);
      // Clockwise 90: the page's left edge shows at the top, its top on the right, and so on.
      const [t, rt, bt, lt] = r === 90 ? [m[1], m[2], m[3], m[0]] : r === 180 ? [m[2], m[3], m[0], m[1]] : r === 270 ? [m[3], m[0], m[1], m[2]] : m;
      const w = box.width - lt - rt; const h = box.height - t - bt;
      if (w < 10 || h < 10) throw new Error(`The margins leave nothing of page ${i + 1}`);
      const x = box.x + lt; const y = box.y + bt;
      p.setMediaBox(x, y, w, h);
      p.setCropBox(x, y, w, h);
      onProgress?.((i + 1) / list.length);
    }
  } finally { pdf?.destroy?.(); }
  return savePdf(doc);
}

/* ---------------- attachments ---------------- */

export async function listAttachments(bytes) {
  const { doc } = await openPdfJs(bytes);
  try {
    const a = (await doc.getAttachments()) || {};
    return Object.values(a).map((x) => ({ name: x.filename, data: x.content, description: x.description || '' }));
  } finally { doc.destroy?.(); }
}

export async function addAttachments(bytes, files) {
  const doc = await loadForCopy(bytes);
  for (const f of files) {
    await doc.attach(f.data, f.name, { mimeType: f.type || 'application/octet-stream', description: f.name, creationDate: new Date(), modificationDate: new Date() });
  }
  return savePdf(doc);
}

/* ---------------- tables ---------------- */

/**
 * Tables from text PDFs: lines that split into the same number of
 * columns on wide gaps, in runs of three or more, become a table.
 */
export function linesToTables(lines, { minRows = 3, minCols = 2 } = {}) {
  const split = (t) => t.split(/\s{3,}/).map((c) => c.trim()).filter(Boolean);
  const tables = []; let cur = [];
  const flush = () => { if (cur.length >= minRows) tables.push(cur); cur = []; };
  for (const l of lines) {
    const cells = split(l.text);
    if (cells.length >= minCols) {
      if (cur.length && Math.abs(cur[0].length - cells.length) > 1) flush();
      cur.push(cells);
    } else flush();
  }
  flush();
  return tables.map((t) => { const w = Math.max(...t.map((r) => r.length)); return t.map((r) => [...r, ...Array(w - r.length).fill('')]); });
}

export async function extractTables(bytes, { minRows = 3 } = {}, { signal, onProgress } = {}) {
  const { doc } = await openPdfJs(bytes);
  try {
    const pages = await extractText(doc, { signal, onProgress });
    const out = [];
    for (const p of pages) linesToTables(p.lines, { minRows }).forEach((rows, k) => out.push({ page: p.page, index: k + 1, rows }));
    return out;
  } finally { doc.destroy?.(); }
}

/* ---------------- compare ---------------- */

/** Line diff (LCS) with an edit script of ['=', '-', '+', text]. */
export function diffLines(a, b) {
  const n = a.length; const m = b.length;
  if (n * m > 4e6) return [...a.map((t) => ['-', t]), ...b.map((t) => ['+', t])];
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = []; let i = 0; let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push(['=', a[i]]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push(['-', a[i++]]);
    else out.push(['+', b[j++]]);
  }
  while (i < n) out.push(['-', a[i++]]);
  while (j < m) out.push(['+', b[j++]]);
  return out;
}

/** Text changes page by page, plus a pixel-difference image of each changed page. */
export async function comparePdfs(aBytes, bBytes, { visual = true, dpi = 72 } = {}, { signal, onProgress } = {}) {
  const [{ doc: A }, { doc: B }] = await Promise.all([openPdfJs(aBytes), openPdfJs(bBytes)]);
  try {
    const [ta, tb] = [await extractText(A, { signal }), await extractText(B, { signal })];
    const pages = Math.max(A.numPages, B.numPages);
    const result = [];
    for (let i = 0; i < pages; i++) {
      checkAbort(signal);
      const la = (ta[i]?.lines || []).map((l) => l.text.trim()).filter(Boolean);
      const lb = (tb[i]?.lines || []).map((l) => l.text.trim()).filter(Boolean);
      const diff = diffLines(la, lb).filter((d) => d[0] !== '=');
      let image = null; let changedPixels = 0;
      if (visual && i < A.numPages && i < B.numPages) {
        const [ra, rb] = [await renderPage(A, i, { scale: dpi / 72 }), await renderPage(B, i, { scale: dpi / 72 })];
        const w = Math.min(ra.canvas.width, rb.canvas.width); const h = Math.min(ra.canvas.height, rb.canvas.height);
        const da = ra.canvas.getContext('2d').getImageData(0, 0, w, h).data; const db = rb.canvas.getContext('2d').getImageData(0, 0, w, h).data;
        const c = makeCanvas(w, h); const ctx = c.getContext('2d'); const img = ctx.createImageData(w, h); const o = img.data;
        for (let p = 0; p < da.length; p += 4) {
          const ya = (da[p] + da[p + 1] + da[p + 2]) / 3; const yb = (db[p] + db[p + 1] + db[p + 2]) / 3;
          const d = Math.abs(da[p] - db[p]) + Math.abs(da[p + 1] - db[p + 1]) + Math.abs(da[p + 2] - db[p + 2]);
          if (d > 60) { changedPixels++; if (yb < ya) { o[p] = 22; o[p + 1] = 163; o[p + 2] = 74; } else { o[p] = 220; o[p + 1] = 38; o[p + 2] = 38; } }
          else { const g = 255 - (255 - Math.min(ya, yb)) * 0.25; o[p] = o[p + 1] = o[p + 2] = g; }
          o[p + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        releaseCanvas(ra.canvas); releaseCanvas(rb.canvas);
        if (changedPixels || diff.length) image = new Uint8Array(await (await canvasToBlob(c, 'image/png')).arrayBuffer());
        releaseCanvas(c);
      }
      result.push({ page: i + 1, onlyIn: i >= A.numPages ? 'second' : i >= B.numPages ? 'first' : null, diff, changedPixels, image });
      onProgress?.((i + 1) / pages, `Comparing page ${i + 1} of ${pages}`);
      await tick();
    }
    return { pagesA: A.numPages, pagesB: B.numPages, pages: result };
  } finally { A.destroy?.(); B.destroy?.(); }
}

/* ---------------- OCR ---------------- */

export const OCR_LANGS = [['eng', 'English'], ['fra', 'French'], ['deu', 'German'], ['spa', 'Spanish'], ['por', 'Portuguese'], ['ita', 'Italian'],
  ['nld', 'Dutch'], ['yor', 'Yoruba'], ['swa', 'Swahili'], ['ara', 'Arabic'], ['hin', 'Hindi'], ['chi_sim', 'Chinese (simplified)'], ['jpn', 'Japanese'], ['rus', 'Russian']];

/**
 * Searchable PDF: each page is rendered, recognised by Tesseract, and
 * rebuilt with an invisible text layer over the page image.
 * The language data (a few MB) downloads once and is cached.
 */
export async function ocrPdf(bytes, { lang = 'eng', dpi = 200, pages = '' } = {}, { signal, onProgress } = {}) {
  const { PDFDocument } = await loadPdfLib();
  const { createWorker } = await import('tesseract.js');
  onProgress?.(0.01, 'Loading the text recogniser');
  const worker = await createWorker(lang, 1, {
    logger: (m) => { if (m.status && m.status.includes('loading')) onProgress?.(0.02 + (m.progress || 0) * 0.08, `Downloading ${lang} language data`); },
  });
  const onAbort = () => worker.terminate();
  signal?.addEventListener('abort', onAbort, { once: true });
  const { doc: pdf } = await openPdfJs(bytes);
  const out = await PDFDocument.create();
  const text = [];
  try {
    const list = pages ? parseRange(pages, pdf.numPages) : Array.from({ length: pdf.numPages }, (_, i) => i);
    for (let k = 0; k < list.length; k++) {
      checkAbort(signal);
      const i = list[k];
      onProgress?.(0.1 + 0.9 * (k / list.length), `Reading page ${i + 1} of ${pdf.numPages}`);
      const { canvas } = await renderPage(pdf, i, { scale: dpi / 72, signal });
      const { data } = await worker.recognize(canvas, {}, { pdf: true, text: true });
      releaseCanvas(canvas);
      text.push(`--- Page ${i + 1} ---\n${data.text.trim()}`);
      const pageDoc = await PDFDocument.load(new Uint8Array(data.pdf));
      const copied = await out.copyPages(pageDoc, pageDoc.getPageIndices());
      copied.forEach((p) => out.addPage(p));
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
    pdf.destroy?.();
    await worker.terminate().catch(() => {});
  }
  out.setProducer('Toolbox OCR (Tesseract)');
  return { bytes: await savePdf(out), text: text.join('\n\n') };
}

/* ---------------- qpdf: encryption and repair ---------------- */

let qpdfUrl = null;

/** Run qpdf once over `bytes`. `args` names the files /in.pdf and /out.pdf. */
export async function runQpdf(bytes, args) {
  const { default: createModule } = await import('@neslinesli93/qpdf-wasm');
  // Vite serves the wasm as an asset; Node (the tests) reads it from node_modules.
  qpdfUrl ??= import.meta.env
    ? (await import('@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url')).default
    : decodeURIComponent(new URL('../../../node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.wasm', import.meta.url).pathname.replace(/^\/([A-Za-z]:\/)/, '$1'));
  const log = [];
  const q = await createModule({ locateFile: () => qpdfUrl, noInitialRun: true, print: (s) => log.push(s), printErr: (s) => log.push(s) });
  q.FS.writeFile('/in.pdf', bytes);
  let code;
  try { code = q.callMain(args); } catch (e) { code = e?.status ?? 2; }
  let out = null;
  try { out = q.FS.readFile('/out.pdf'); } catch { /* no output */ }
  // 0 is success and 3 is success with warnings (typical after a repair).
  if ((code !== 0 && code !== 3) || !out) {
    const msg = log.join(' ');
    if (/invalid password/i.test(msg) || code === 2 && args.some((a) => a.startsWith('--password'))) throw new Error('That password is not correct.');
    throw new Error(`qpdf could not process this file${msg ? `: ${msg.replace(/^\S+: /, '').slice(0, 200)}` : ''}`);
  }
  return { bytes: out, warnings: code === 3 ? log : [] };
}

export async function encryptPdf(bytes, { user = '', owner = '', print = true, modify = false, copy = true, annotate = true } = {}) {
  if (!user && !owner) throw new Error('Set a password to open the file, a permissions password, or both.');
  const o = owner || user || cryptoRandomHex();
  const args = ['--encrypt', user, o, '256', `--print=${print ? 'full' : 'none'}`, `--modify=${modify ? 'all' : annotate ? 'annotate' : 'none'}`, `--extract=${copy ? 'y' : 'n'}`, '--', '/in.pdf', '/out.pdf'];
  return (await runQpdf(bytes, args)).bytes;
}

export async function decryptPdf(bytes, { password = '' } = {}) {
  return (await runQpdf(bytes, [`--password=${password}`, '--decrypt', '/in.pdf', '/out.pdf'])).bytes;
}

export async function repairPdf(bytes, { mode = 'repair' } = {}) {
  const args = mode === 'linearize' ? ['--linearize', '/in.pdf', '/out.pdf']
    : mode === 'compress' ? ['--object-streams=generate', '--compress-streams=y', '--recompress-flate', '--compression-level=9', '/in.pdf', '/out.pdf']
      : ['/in.pdf', '/out.pdf'];
  return runQpdf(bytes, args);
}

function cryptoRandomHex() {
  const b = new Uint8Array(16); crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export const outName = (name, suffix, ext = 'pdf') => `${baseName(name)}-${suffix}.${ext}`;
