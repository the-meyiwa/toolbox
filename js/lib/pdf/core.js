/* ============================================================
   PDF core — the DOM-free half of the PDF workspace.

   Everything here runs on pdf-lib and plain data, so it works the same
   in a page, a worker or Node (the tests run it there). Rendering,
   thumbnails and rasterising live in raster.js; the UI kit lives in
   workspace.js.

   Coordinates. Annotations, stamps and redaction boxes are stored in
   PDF user space (points, origin bottom-left of the page's crop box)
   so they stay attached to the content when a page is later rotated.
   "View" space is what a person sees: origin top-left of the page as
   displayed with its /Rotate applied, y growing downwards, 1 unit = 1
   point. viewToUser / userToView convert between the two for the four
   legal rotations.
   ============================================================ */

let libPromise = null;

/** pdf-lib, loaded once and only when a PDF feature is used. */
export function loadPdfLib() {
  libPromise ??= import('pdf-lib');
  return libPromise;
}

/* ---------------- cancellation & pacing ---------------- */

export class PdfCancelled extends Error {
  constructor(message = 'Cancelled') { super(message); this.name = 'AbortError'; this.cancelled = true; }
}

export function checkAbort(signal) {
  if (signal?.aborted) throw new PdfCancelled();
}

/** Give the event loop a turn so long jobs keep the page responsive. */
export const tick = () => new Promise(resolve => setTimeout(resolve, 0));

export function isCancel(err) {
  return Boolean(err && (err.cancelled || err.name === 'AbortError'));
}

/* ---------------- bytes ---------------- */

export function base64ToBytes(b64) {
  const bin = atob(String(b64).replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function bytesToDataUrl(bytes, mime = 'application/pdf') {
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

/** File, Blob, ArrayBuffer, typed array, data URL or bare base64 → Uint8Array. */
export async function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  if (typeof input === 'string') {
    const i = input.startsWith('data:') ? input.indexOf(',') : -1;
    return base64ToBytes(i >= 0 ? input.slice(i + 1) : input);
  }
  if (input && typeof input.arrayBuffer === 'function') return new Uint8Array(await input.arrayBuffer());
  throw new TypeError('Unsupported input: expected a PDF file or bytes.');
}

/** True when the bytes carry a %PDF- header within the first KB (some files have junk before it). */
export function isPdfBytes(bytes) {
  const n = Math.min(bytes?.length || 0, 1024);
  for (let i = 0; i < n - 4; i++) {
    if (bytes[i] === 0x25 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x44 && bytes[i + 3] === 0x46 && bytes[i + 4] === 0x2d) return true;
  }
  return false;
}

export function baseName(name = 'document.pdf') {
  return String(name).replace(/\.[^./\\]+$/, '').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'document';
}

export function humanBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1048576).toFixed(n < 10485760 ? 2 : 1)} MB`;
}

export const PAGE_SIZES = {
  a4:     { label: 'A4',        width: 595.28, height: 841.89 },
  letter: { label: 'US Letter', width: 612,    height: 792 },
  legal:  { label: 'US Legal',  width: 612,    height: 1008 },
  a3:     { label: 'A3',        width: 841.89, height: 1190.55 },
  a5:     { label: 'A5',        width: 419.53, height: 595.28 },
};

/* ---------------- page ranges ---------------- */

/**
 * Parse one range token ("3", "1-4", "8-", "-3", "9-5", "odd", "even",
 * "all", "last", "last-2") into 1-based page numbers, or null if invalid.
 */
function parseToken(token, count) {
  const t = token.trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return [];
  const all = Array.from({ length: count }, (_, i) => i + 1);
  if (t === 'all' || t === '*') return all;
  if (t === 'odd') return all.filter(p => p % 2 === 1);
  if (t === 'even') return all.filter(p => p % 2 === 0);
  const num = (s) => {
    if (s === 'last' || s === 'end' || s === 'z') return count;
    const m = s.match(/^(?:last|z)-(\d+)$/);
    if (m) return count - Number(m[1]);
    return /^\d+$/.test(s) ? Number(s) : NaN;
  };
  const single = num(t);
  if (Number.isFinite(single)) return single >= 1 && single <= count ? [single] : null;
  const dash = t.match(/^(last-\d+|last|z|\d*)(?:-|\u2013|\.\.|to)(last-\d+|last|z|end|\d*)$/);
  if (!dash) return null;
  const a = dash[1] === '' ? 1 : num(dash[1]);
  const b = dash[2] === '' ? count : num(dash[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  // Clamp overshoot ("5-999" on a 10-page file) instead of rejecting it.
  const lo = Math.max(1, Math.min(a, b));
  const hi = Math.min(count, Math.max(a, b));
  if (lo > hi) return null;
  const out = [];
  for (let p = lo; p <= hi; p++) out.push(p);
  return a > b ? out.reverse() : out;
}

/**
 * "1-3, 5, 8-" → zero-based indices in the order written, duplicates
 * dropped. Invalid fragments are reported, not thrown, because this is
 * parsed live as someone types.
 */
export function parseRange(spec, count) {
  const { groups, errors } = parseRangeGroups(spec, count);
  const seen = new Set();
  const indices = [];
  for (const g of groups) for (const i of g) if (!seen.has(i)) { seen.add(i); indices.push(i); }
  parseRange.lastErrors = errors;
  return indices;
}

/** Like parseRange but keeps each comma-separated part as its own group (used by split). */
export function parseRangeGroups(spec, count) {
  const groups = [];
  const errors = [];
  for (const part of String(spec ?? '').split(/[,;\n]+/)) {
    if (!part.trim()) continue;
    const pages = parseToken(part, count);
    if (!pages) { errors.push(part.trim()); continue; }
    if (pages.length) groups.push(pages.map(p => p - 1));
  }
  return { groups, errors };
}

/** Zero-based indices → "1-3, 5, 8-10" (sorted). */
export function formatRange(indices) {
  const sorted = [...new Set(indices)].sort((a, b) => a - b);
  if (!sorted.length) return '';
  const parts = [];
  let start = sorted[0], prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i];
    if (cur !== prev + 1) {
      parts.push(start === prev ? `${start + 1}` : `${start + 1}-${prev + 1}`);
      start = cur;
    }
    prev = cur;
  }
  return parts.join(', ');
}

/* ---------------- split plans ---------------- */

/** Chunks of n pages: [[0..n-1], [n..2n-1], …]. */
export function planEvery(count, n) {
  const size = Math.max(1, Math.floor(Number(n) || 1));
  const groups = [];
  for (let i = 0; i < count; i += size) groups.push(Array.from({ length: Math.min(size, count - i) }, (_, k) => i + k));
  return groups;
}

export function planEach(count) {
  return Array.from({ length: count }, (_, i) => [i]);
}

/**
 * One part per top-level bookmark, running to the next one. Pages before
 * the first bookmark become their own leading part.
 * @param {Array<{title: string, pageIndex: number, depth: number}>} outline
 */
export function planBookmarks(outline, count, { depth = 0 } = {}) {
  const marks = outline
    .filter(o => o.depth <= depth && Number.isInteger(o.pageIndex) && o.pageIndex >= 0 && o.pageIndex < count)
    .sort((a, b) => a.pageIndex - b.pageIndex);
  const starts = [];
  for (const m of marks) if (!starts.length || starts.at(-1).pageIndex !== m.pageIndex) starts.push(m);
  if (!starts.length) return [];
  const parts = [];
  if (starts[0].pageIndex > 0) parts.push({ title: 'Front matter', pages: range(0, starts[0].pageIndex) });
  starts.forEach((m, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].pageIndex : count;
    parts.push({ title: m.title || `Part ${parts.length + 1}`, pages: range(m.pageIndex, end) });
  });
  return parts;
}

const range = (a, b) => Array.from({ length: Math.max(0, b - a) }, (_, i) => a + i);

/** File names for split parts: "report-01-intro.pdf" or "report-p4-7.pdf". */
export function partNames(base, groups, titles = []) {
  const pad = String(groups.length).length;
  const used = new Set();
  return groups.map((g, i) => {
    const t = titles[i] ? String(titles[i]).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) : '';
    let name = t
      ? `${base}-${String(i + 1).padStart(Math.max(2, pad), '0')}-${t}`
      : `${base}-p${g.length === 1 ? g[0] + 1 : `${g[0] + 1}-${g.at(-1) + 1}`}`;
    while (used.has(name)) name += `-${i + 1}`;
    used.add(name);
    return `${name}.pdf`;
  });
}

/* ---------------- geometry ---------------- */

export const normRot = (deg) => ((Math.round((Number(deg) || 0) / 90) * 90) % 360 + 360) % 360;

/** Size of a box as displayed at rotation `rot`. */
export function viewSize(box, rot) {
  const r = normRot(rot);
  return r === 90 || r === 270 ? { width: box.height, height: box.width } : { width: box.width, height: box.height };
}

/** View point (top-left origin, y down, as displayed) → PDF user space. */
export function viewToUser(box, rot, vx, vy) {
  const { x: x0 = 0, y: y0 = 0, width: w, height: h } = box;
  switch (normRot(rot)) {
    case 90:  return { x: x0 + vy, y: y0 + vx };
    case 180: return { x: x0 + w - vx, y: y0 + vy };
    case 270: return { x: x0 + w - vy, y: y0 + h - vx };
    default:  return { x: x0 + vx, y: y0 + h - vy };
  }
}

/** PDF user space → view point. Inverse of viewToUser. */
export function userToView(box, rot, ux, uy) {
  const { x: x0 = 0, y: y0 = 0, width: w, height: h } = box;
  switch (normRot(rot)) {
    case 90:  return { x: uy - y0, y: ux - x0 };
    case 180: return { x: x0 + w - ux, y: uy - y0 };
    case 270: return { x: y0 + h - uy, y: x0 + w - ux };
    default:  return { x: ux - x0, y: y0 + h - uy };
  }
}

/** View rectangle → normalised user rectangle {x, y, width, height}. */
export function viewRectToUser(box, rot, r) {
  const a = viewToUser(box, rot, r.x, r.y);
  const b = viewToUser(box, rot, r.x + r.width, r.y + r.height);
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

export function userRectToView(box, rot, r) {
  const a = userToView(box, rot, r.x, r.y);
  const b = userToView(box, rot, r.x + r.width, r.y + r.height);
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

/** Crop box and effective rotation of a pdf-lib page. */
export function pageGeometry(page) {
  let box;
  try { box = page.getCropBox(); } catch { box = page.getMediaBox(); }
  return { box: { x: box.x, y: box.y, width: box.width, height: box.height }, rot: normRot(page.getRotation().angle) };
}

export function parseColor(hex, fallback = [0, 0, 0]) {
  const m = String(hex || '').trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return fallback;
  let h = m[1];
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
}

/* ---------------- opening ---------------- */

/**
 * Parse with pdf-lib. Encrypted files load (ignoreEncryption) so their
 * structure can be read, but their content streams are still encrypted,
 * which is why callers check `doc.isEncrypted` and rasterise instead.
 */
export async function openPdfLib(bytes) {
  const { PDFDocument } = await loadPdfLib();
  return PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
}

export async function savePdf(doc, { objectStreams = true } = {}) {
  return doc.save({ useObjectStreams: objectStreams, addDefaultPage: false, objectsPerTick: 200 });
}

/* ---------------- composing ---------------- */

/**
 * Build a document from a page list.
 * @param {Array<{src: string|number, index?: number, rotate?: number, blank?: {width: number, height: number}}>} pages
 * @param {(src) => Promise<PDFDocument>} getDoc  a fresh pdf-lib document per source
 * @returns {Promise<{doc: PDFDocument, inPlace: boolean, starts: Map}>} starts: src → first output index
 */
export async function composeDocument(pages, getDoc, { signal, onProgress, keepStructure = true } = {}) {
  const { PDFDocument, degrees } = await loadPdfLib();
  const srcIds = [...new Set(pages.filter(p => !p.blank).map(p => p.src))];
  const starts = new Map();

  // Same single source, every page once, in order: edit that document in
  // place so forms, bookmarks, links and metadata survive.
  if (keepStructure && srcIds.length === 1 && !pages.some(p => p.blank)) {
    const doc = await getDoc(srcIds[0]);
    const n = doc.getPageCount();
    if (pages.length === n && pages.every((p, i) => p.index === i)) {
      doc.getPages().forEach((page, i) => {
        const extra = normRot(pages[i].rotate);
        if (extra) page.setRotation(degrees(normRot(page.getRotation().angle + extra)));
      });
      starts.set(srcIds[0], 0);
      return { doc, inPlace: true, starts };
    }
  }

  const out = await PDFDocument.create({ updateMetadata: false });
  const docs = new Map();
  for (const id of srcIds) docs.set(id, await getDoc(id));

  // pdf-lib's copier caches per call, so a page requested twice in one
  // copyPages call would come back as the same object. Copy in rounds of
  // unique indices per source instead.
  const copies = new Map();         // `${src}:${index}` → array of copied pages
  for (const id of srcIds) {
    const wanted = pages.filter(p => !p.blank && p.src === id).map(p => p.index);
    const counts = new Map();
    for (const i of wanted) counts.set(i, (counts.get(i) || 0) + 1);
    let round = 0;
    while (true) {
      const batch = [...counts.entries()].filter(([, c]) => c > round).map(([i]) => i);
      if (!batch.length) break;
      checkAbort(signal);
      for (let k = 0; k < batch.length; k += 200) {
        const chunk = batch.slice(k, k + 200);
        const copied = await out.copyPages(docs.get(id), chunk);
        chunk.forEach((i, j) => {
          const key = `${id}:${i}`;
          if (!copies.has(key)) copies.set(key, []);
          copies.get(key).push(copied[j]);
        });
        onProgress?.(Math.min(0.9, (copies.size / Math.max(1, pages.length)) * 0.9));
        await tick();
        checkAbort(signal);
      }
      round++;
    }
  }

  pages.forEach((p, i) => {
    if (p.blank) {
      const pg = out.addPage([p.blank.width || 595.28, p.blank.height || 841.89]);
      if (normRot(p.rotate)) pg.setRotation(degrees(normRot(p.rotate)));
      return;
    }
    if (!starts.has(p.src)) starts.set(p.src, i);
    const page = copies.get(`${p.src}:${p.index}`).shift();
    const extra = normRot(p.rotate);
    if (extra) page.setRotation(degrees(normRot(page.getRotation().angle + extra)));
    out.addPage(page);
  });

  // Carry the first source's document information across.
  const first = docs.get(srcIds[0]);
  if (first) copyInfo(first, out);
  onProgress?.(1);
  return { doc: out, inPlace: false, starts };
}

function copyInfo(from, to) {
  const m = getMetadata(from);
  try {
    if (m.title) to.setTitle(m.title);
    if (m.author) to.setAuthor(m.author);
    if (m.subject) to.setSubject(m.subject);
    if (m.keywords) to.setKeywords(m.keywords.split(/\s*[,;]\s*/).filter(Boolean));
    if (m.creator) to.setCreator(m.creator);
  } catch { /* information dictionary is optional */ }
}

/**
 * Merge several PDFs, each optionally limited to a page range.
 * @param {Array<{bytes: Uint8Array, range?: string, name?: string}>} items
 */
export async function mergePdfBytes(items, { bookmarks = false, signal, onProgress } = {}) {
  const { PDFDocument } = await loadPdfLib();
  const out = await PDFDocument.create({ updateMetadata: false });
  const marks = [];
  for (let n = 0; n < items.length; n++) {
    checkAbort(signal);
    const item = items[n];
    const src = await openPdfLib(item.bytes);
    if (src.isEncrypted) throw new Error(`${item.name || `File ${n + 1}`} is encrypted. Open it in the PDF Editor with its password first.`);
    const count = src.getPageCount();
    const indices = item.range && String(item.range).trim() ? parseRange(item.range, count) : range(0, count);
    if (!indices.length) continue;
    marks.push({ title: baseName(item.name || `Document ${n + 1}`), pageIndex: out.getPageCount() });
    for (let k = 0; k < indices.length; k += 200) {
      const copied = await out.copyPages(src, indices.slice(k, k + 200));
      copied.forEach(p => out.addPage(p));
      await tick();
      checkAbort(signal);
    }
    onProgress?.((n + 1) / items.length);
  }
  if (!out.getPageCount()) throw new Error('No pages selected to merge.');
  if (bookmarks) await addOutline(out, marks);
  out.setProducer('Toolbox');
  out.setCreationDate(new Date());
  return savePdf(out);
}

/** Split into several documents; groups are arrays of zero-based indices. */
export async function splitPdfBytes(bytes, groups, { signal, onProgress } = {}) {
  const { PDFDocument } = await loadPdfLib();
  const src = await openPdfLib(bytes);
  if (src.isEncrypted) throw new Error('This PDF is encrypted. Open it in the PDF Editor with its password first.');
  const results = [];
  for (let g = 0; g < groups.length; g++) {
    checkAbort(signal);
    const out = await PDFDocument.create({ updateMetadata: false });
    const copied = await out.copyPages(src, groups[g]);
    copied.forEach(p => out.addPage(p));
    copyInfo(src, out);
    results.push(await savePdf(out));
    onProgress?.((g + 1) / groups.length);
    await tick();
  }
  return results;
}

/* ---------------- outline (bookmarks) ---------------- */

/** Read bookmarks as a flat list {title, pageIndex, depth}. Missing or broken outlines give []. */
export async function readOutline(doc) {
  const { PDFName, PDFDict, PDFArray, PDFRef, PDFString, PDFHexString } = await loadPdfLib();
  const out = [];
  try {
    const pageIndexByRef = new Map(doc.getPages().map((p, i) => [p.ref.toString(), i]));
    const catalog = doc.catalog;
    const outlines = catalog.lookupMaybe(PDFName.of('Outlines'), PDFDict);
    if (!outlines) return out;

    const named = (name) => {
      const key = name instanceof PDFName ? name.decodeText?.() ?? name.asString().slice(1) : name.decodeText();
      const dests = catalog.lookupMaybe(PDFName.of('Dests'), PDFDict);
      if (dests && name instanceof PDFName) {
        const v = dests.lookup(name);
        if (v) return v;
      }
      const names = catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
      const tree = names?.lookupMaybe(PDFName.of('Dests'), PDFDict);
      const walk = (node, depth = 0) => {
        if (!node || depth > 32) return null;
        const arr = node.lookupMaybe(PDFName.of('Names'), PDFArray);
        if (arr) {
          for (let i = 0; i + 1 < arr.size(); i += 2) {
            const k = arr.lookup(i);
            const text = (k instanceof PDFString || k instanceof PDFHexString) ? k.decodeText() : String(k);
            if (text === key) return arr.lookup(i + 1);
          }
        }
        const kids = node.lookupMaybe(PDFName.of('Kids'), PDFArray);
        if (kids) for (let i = 0; i < kids.size(); i++) {
          const found = walk(kids.lookup(i, PDFDict), depth + 1);
          if (found) return found;
        }
        return null;
      };
      return walk(tree);
    };

    const pageOf = (dest) => {
      if (!dest) return null;
      if (dest instanceof PDFName || dest instanceof PDFString || dest instanceof PDFHexString) dest = named(dest);
      if (dest instanceof PDFDict) dest = dest.lookup(PDFName.of('D'));
      if (dest instanceof PDFArray && dest.size()) {
        const first = dest.get(0);
        if (first instanceof PDFRef) return pageIndexByRef.get(first.toString()) ?? null;
        const n = Number(first?.asNumber?.());
        return Number.isInteger(n) ? n : null;
      }
      return null;
    };

    const seen = new Set();
    const visit = (item, depth) => {
      let guard = 0;
      while (item && guard++ < 10000) {
        const id = item.toString?.() ?? '';
        if (seen.has(item)) break;
        seen.add(item);
        const titleObj = item.lookup(PDFName.of('Title'));
        const title = titleObj?.decodeText ? titleObj.decodeText() : '';
        let dest = item.lookup(PDFName.of('Dest'));
        if (!dest) {
          const action = item.lookupMaybe(PDFName.of('A'), PDFDict);
          if (action && String(action.lookup(PDFName.of('S'))) === '/GoTo') dest = action.lookup(PDFName.of('D'));
        }
        out.push({ title: title.trim(), pageIndex: pageOf(dest), depth });
        const child = item.lookupMaybe(PDFName.of('First'), PDFDict);
        if (child) visit(child, depth + 1);
        item = item.lookupMaybe(PDFName.of('Next'), PDFDict);
        void id;
      }
    };
    visit(outlines.lookupMaybe(PDFName.of('First'), PDFDict), 0);
  } catch { /* a malformed outline is not worth failing over */ }
  return out;
}

/** Replace the document's bookmarks with a flat list [{title, pageIndex}]. */
export async function addOutline(doc, entries) {
  const { PDFName, PDFHexString, PDFNull } = await loadPdfLib();
  const pages = doc.getPages();
  const items = entries.filter(e => pages[e.pageIndex]);
  if (!items.length) return;
  const ctx = doc.context;
  const rootRef = ctx.nextRef();
  const refs = items.map(() => ctx.nextRef());
  items.forEach((e, i) => {
    const dict = ctx.obj({});
    dict.set(PDFName.of('Title'), PDFHexString.fromText(String(e.title || `Section ${i + 1}`)));
    dict.set(PDFName.of('Parent'), rootRef);
    if (i > 0) dict.set(PDFName.of('Prev'), refs[i - 1]);
    if (i < refs.length - 1) dict.set(PDFName.of('Next'), refs[i + 1]);
    dict.set(PDFName.of('Dest'), ctx.obj([pages[e.pageIndex].ref, PDFName.of('XYZ'), PDFNull, PDFNull, PDFNull]));
    ctx.assign(refs[i], dict);
  });
  const root = ctx.obj({});
  root.set(PDFName.of('Type'), PDFName.of('Outlines'));
  root.set(PDFName.of('First'), refs[0]);
  root.set(PDFName.of('Last'), refs.at(-1));
  root.set(PDFName.of('Count'), ctx.obj(items.length));
  ctx.assign(rootRef, root);
  doc.catalog.set(PDFName.of('Outlines'), rootRef);
}

/* ---------------- text helpers ---------------- */

/** Drop characters the (WinAnsi) standard font cannot encode instead of throwing. */
export function safeText(font, text) {
  const s = String(text ?? '');
  let set = null;
  try { set = new Set(font.getCharacterSet()); } catch { /* old pdf-lib */ }
  const map = { '‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-', '…': '...', ' ': ' ' };
  return [...s].map(ch => {
    const cp = ch.codePointAt(0);
    if (ch === '\n') return ch;
    if (!set || set.has(cp)) return ch;
    const alt = map[ch];
    return alt ?? '?';
  }).join('');
}

/** Expand {n} {total} {bates} {date} {file} {title} in a header/footer template. */
export function fillTemplate(template, vars) {
  return String(template ?? '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? vars[k.toLowerCase()] ?? m));
}

export function batesNumber(prefix, n, digits = 6, suffix = '') {
  return `${prefix || ''}${String(n).padStart(Math.max(1, digits | 0), '0')}${suffix || ''}`;
}

/** Draw a line of text at a view-space baseline point, upright as displayed. */
function drawViewText(page, geom, text, vx, vy, opts, lib) {
  const { rgb, degrees } = lib;
  const p = viewToUser(geom.box, geom.rot, vx, vy);
  const [r, g, b] = opts.color || [0, 0, 0];
  page.drawText(text, {
    x: p.x, y: p.y, size: opts.size, font: opts.font,
    color: rgb(r, g, b), opacity: opts.opacity ?? 1,
    rotate: degrees(normRot(geom.rot) + (opts.angle || 0)),
  });
}

/* ---------------- stamps ---------------- */

/**
 * Text or image watermark on each (selected) page, centred as displayed.
 * @param {object} o {text, image:{bytes, type}, size, opacity, angle, color, pages, layout:'center'|'tile', scale}
 */
export async function applyWatermark(doc, o = {}) {
  const lib = await loadPdfLib();
  const { StandardFonts, rgb, degrees } = lib;
  const pages = doc.getPages();
  const targets = o.pages ?? pages.map((_, i) => i);
  const opacity = Math.max(0.02, Math.min(1, o.opacity ?? 0.18));
  const angle = Number.isFinite(o.angle) ? o.angle : 45;
  let image = null;
  if (o.image?.bytes) image = /png/i.test(o.image.type) ? await doc.embedPng(o.image.bytes) : await doc.embedJpg(o.image.bytes);
  const font = await doc.embedFont(o.bold === false ? StandardFonts.Helvetica : StandardFonts.HelveticaBold);
  const text = safeText(font, o.text ?? 'CONFIDENTIAL').trim();
  const [cr, cg, cb] = parseColor(o.color, [0.45, 0.45, 0.45]);

  for (const i of targets) {
    const page = pages[i];
    if (!page) continue;
    const geom = pageGeometry(page);
    const vs = viewSize(geom.box, geom.rot);
    const total = normRot(geom.rot) + angle;
    const t = total * Math.PI / 180;
    const centers = [];
    if (o.layout === 'tile') {
      const step = Math.max(vs.width, vs.height) / 3;
      for (let y = step / 2; y < vs.height; y += step) for (let x = step / 2; x < vs.width; x += step) centers.push([x, y]);
    } else centers.push([vs.width / 2, vs.height / 2]);

    for (const [cx, cy] of centers) {
      const c = viewToUser(geom.box, geom.rot, cx, cy);
      if (image) {
        const w = vs.width * Math.max(0.05, Math.min(1, o.scale ?? 0.5)) * (o.layout === 'tile' ? 0.45 : 1);
        const h = w * image.height / image.width;
        const ax = c.x - (w / 2) * Math.cos(t) + (h / 2) * Math.sin(t);
        const ay = c.y - (w / 2) * Math.sin(t) - (h / 2) * Math.cos(t);
        page.drawImage(image, { x: ax, y: ay, width: w, height: h, opacity, rotate: degrees(total) });
      } else if (text) {
        const diag = Math.hypot(vs.width, vs.height);
        let size = o.size || Math.min(120, (diag * 0.7) / Math.max(4, text.length) * 1.6);
        if (o.layout === 'tile') size = o.size || Math.max(14, size * 0.4);
        const w = font.widthOfTextAtSize(text, size);
        const h = size * 0.7;
        const ax = c.x - (w / 2) * Math.cos(t) + (h / 2) * Math.sin(t);
        const ay = c.y - (w / 2) * Math.sin(t) - (h / 2) * Math.cos(t);
        page.drawText(text, { x: ax, y: ay, size, font, color: rgb(cr, cg, cb), opacity, rotate: degrees(total) });
      }
    }
  }
  return doc;
}

/**
 * Page numbers and Bates-style headers/footers.
 * @param {object} o {template:'Page {n} of {total}', position:'bottom-center', size, margin,
 *   startAt:1, pages, bates:{prefix, start, digits, suffix}, color, file, title, skipFirst}
 * Returns the last Bates number used (handy for continuing a set).
 */
export async function applyHeaderFooter(doc, o = {}) {
  const lib = await loadPdfLib();
  const font = await doc.embedFont(lib.StandardFonts.Helvetica);
  const pages = doc.getPages();
  const targets = (o.pages ?? pages.map((_, i) => i)).filter(i => pages[i]);
  const size = o.size || 10;
  const margin = o.margin ?? 28;
  const [pos, align] = String(o.position || 'bottom-center').split('-');
  const total = targets.length;
  const startAt = Number.isFinite(o.startAt) ? o.startAt : 1;
  const bates = o.bates || null;
  let batesN = bates ? (Number(bates.start) || 1) : 0;
  const date = o.date || new Date().toISOString().slice(0, 10);
  const color = parseColor(o.color, [0.15, 0.15, 0.15]);

  targets.forEach((i, k) => {
    if (o.skipFirst && k === 0) return;
    const page = pages[i];
    const geom = pageGeometry(page);
    const vs = viewSize(geom.box, geom.rot);
    const vars = {
      n: String(startAt + k), page: String(startAt + k), total: String(total + startAt - 1),
      bates: bates ? batesNumber(bates.prefix, batesN, bates.digits ?? 6, bates.suffix) : '',
      date, file: o.file || '', title: o.title || '',
    };
    const template = o.template ?? (bates ? '{bates}' : 'Page {n} of {total}');
    const text = safeText(font, fillTemplate(template, vars));
    if (bates) batesN++;
    if (!text.trim()) return;
    const w = font.widthOfTextAtSize(text, size);
    const vx = align === 'left' ? margin : align === 'right' ? vs.width - margin - w : (vs.width - w) / 2;
    const vy = pos === 'top' ? margin + size * 0.8 : vs.height - margin;
    drawViewText(page, geom, text, vx, vy, { size, font, color }, lib);
  });
  return bates ? batesN - 1 : null;
}

/* ---------------- annotations ---------------- */

/**
 * Burn annotations into one page. Geometry is PDF user space:
 *   text      {x, y (baseline), size, rot, text, color}
 *   highlight {x, y, width, height, color}
 *   rect      {x, y, width, height, color, stroke}
 *   ellipse   {x, y, width, height, color, stroke}
 *   line/arrow{points:[{x,y},{x,y}], color, stroke}
 *   ink       {points:[{x,y}…], color, stroke}
 *   image     {x, y, width, height, rot, bytes, mime}  (x,y = lower-left as displayed)
 * Redaction boxes are handled by raster.js because they must remove content.
 */
export async function drawAnnotations(doc, pageIndex, annotations, cache = new Map()) {
  const lib = await loadPdfLib();
  const { rgb, degrees, StandardFonts } = lib;
  const page = doc.getPage(pageIndex);
  const col = (hex, fb) => { const [r, g, b] = parseColor(hex, fb); return rgb(r, g, b); };
  const getFont = async () => {
    if (!cache.has('font')) cache.set('font', await doc.embedFont(StandardFonts.Helvetica));
    return cache.get('font');
  };

  for (const a of annotations) {
    switch (a.type) {
      case 'text': {
        const font = await getFont();
        const size = a.size || 14;
        const lines = safeText(font, a.text).split('\n');
        const rot = normRot(a.rot);
        const t = rot * Math.PI / 180;
        lines.forEach((line, n) => {
          // Successive lines step "down" as displayed, which is -90° from the text direction.
          const dx = Math.sin(t) * size * 1.2 * n;
          const dy = -Math.cos(t) * size * 1.2 * n;
          if (line) page.drawText(line, { x: a.x + dx, y: a.y + dy, size, font, color: col(a.color, [0, 0, 0]), rotate: degrees(rot) });
        });
        break;
      }
      case 'highlight':
        page.drawRectangle({ x: a.x, y: a.y, width: a.width, height: a.height, color: col(a.color || '#ffe14d'), opacity: a.opacity ?? 0.38, blendMode: lib.BlendMode?.Multiply });
        break;
      case 'rect':
        page.drawRectangle({ x: a.x, y: a.y, width: a.width, height: a.height, borderColor: col(a.color, [0.86, 0.15, 0.15]), borderWidth: a.stroke || 2, ...(a.fill ? { color: col(a.fill), opacity: a.fillOpacity ?? 1 } : {}) });
        break;
      case 'ellipse':
        page.drawEllipse({ x: a.x + a.width / 2, y: a.y + a.height / 2, xScale: a.width / 2, yScale: a.height / 2, borderColor: col(a.color, [0.86, 0.15, 0.15]), borderWidth: a.stroke || 2 });
        break;
      case 'line':
      case 'arrow': {
        const [p, q] = a.points || [];
        if (!p || !q) break;
        const color = col(a.color, [0.86, 0.15, 0.15]);
        const thickness = a.stroke || 2;
        page.drawLine({ start: p, end: q, thickness, color, lineCap: lib.LineCapStyle?.Round });
        if (a.type === 'arrow') {
          const ang = Math.atan2(q.y - p.y, q.x - p.x);
          const len = Math.max(8, thickness * 5);
          for (const s of [-1, 1]) {
            const e = { x: q.x - len * Math.cos(ang + s * 0.45), y: q.y - len * Math.sin(ang + s * 0.45) };
            page.drawLine({ start: q, end: e, thickness, color, lineCap: lib.LineCapStyle?.Round });
          }
        }
        break;
      }
      case 'ink': {
        const pts = a.points || [];
        if (pts.length < 2) break;
        // drawSvgPath flips y, so feed it (x, -y) and anchor at the origin.
        const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${(-p.y).toFixed(2)}`).join(' ');
        page.drawSvgPath(d, { x: 0, y: 0, borderColor: col(a.color, [0, 0, 0]), borderWidth: a.stroke || 2, borderLineCap: lib.LineCapStyle?.Round });
        break;
      }
      case 'image': {
        const bytes = a.bytes || (a.src ? await toBytes(a.src) : null);
        if (!bytes) break;
        const key = a.key || a.src || bytes;
        let img = cache.get(key);
        if (!img) {
          img = /png/i.test(a.mime || a.src?.slice(0, 30) || '') ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
          cache.set(key, img);
        }
        page.drawImage(img, { x: a.x, y: a.y, width: a.width, height: a.height, rotate: degrees(normRot(a.rot)), opacity: a.opacity ?? 1 });
        break;
      }
      default: break;
    }
  }
}

/* ---------------- metadata ---------------- */

export function getMetadata(doc) {
  const get = (fn) => { try { const v = fn(); return v instanceof Date ? v.toISOString() : (v || ''); } catch { return ''; } };
  return {
    title: get(() => doc.getTitle()),
    author: get(() => doc.getAuthor()),
    subject: get(() => doc.getSubject()),
    keywords: get(() => doc.getKeywords()),
    creator: get(() => doc.getCreator()),
    producer: get(() => doc.getProducer()),
    created: get(() => doc.getCreationDate()),
    modified: get(() => doc.getModificationDate()),
  };
}

export async function setMetadata(doc, m = {}) {
  if (m.title !== undefined) doc.setTitle(String(m.title), { showInWindowTitleBar: Boolean(m.title) });
  if (m.author !== undefined) doc.setAuthor(String(m.author));
  if (m.subject !== undefined) doc.setSubject(String(m.subject));
  if (m.keywords !== undefined) doc.setKeywords(String(m.keywords).split(/\s*[,;]\s*/).filter(Boolean));
  if (m.creator !== undefined) doc.setCreator(String(m.creator));
  if (m.producer !== undefined) doc.setProducer(String(m.producer));
  doc.setModificationDate(new Date());
}

/** Remove the information dictionary and XMP metadata stream. */
export async function stripMetadata(doc) {
  const { PDFName } = await loadPdfLib();
  try { doc.catalog.delete(PDFName.of('Metadata')); } catch { /* none */ }
  try { doc.context.trailerInfo.Info = undefined; } catch { /* none */ }
  // pdf-lib recreates Info on demand; blank the fields it would write.
  for (const fn of ['setTitle', 'setAuthor', 'setSubject', 'setCreator', 'setProducer']) { try { doc[fn](''); } catch { /* ignore */ } }
  try { doc.setKeywords([]); } catch { /* ignore */ }
}

/* ---------------- forms ---------------- */

/** List AcroForm fields in a form the UI can render. */
export async function listFormFields(doc) {
  const lib = await loadPdfLib();
  let form;
  try { form = doc.getForm(); } catch { return []; }
  const pageIndexByRef = new Map(doc.getPages().map((p, i) => [p.ref.toString(), i]));
  const fields = [];
  for (const f of form.getFields()) {
    const name = f.getName();
    let type = 'unknown', value = '', options = [];
    try {
      if (f instanceof lib.PDFTextField) { type = 'text'; value = f.getText() || ''; }
      else if (f instanceof lib.PDFCheckBox) { type = 'checkbox'; value = f.isChecked(); }
      else if (f instanceof lib.PDFRadioGroup) { type = 'radio'; options = f.getOptions(); value = f.getSelected() || ''; }
      else if (f instanceof lib.PDFDropdown) { type = 'dropdown'; options = f.getOptions(); value = f.getSelected()[0] || ''; }
      else if (f instanceof lib.PDFOptionList) { type = 'list'; options = f.getOptions(); value = f.getSelected()[0] || ''; }
      else if (f instanceof lib.PDFSignature) type = 'signature';
      else if (f instanceof lib.PDFButton) type = 'button';
    } catch { /* unreadable value */ }
    let page = null;
    try {
      const w = f.acroField.getWidgets()[0];
      const pref = w?.P?.();
      if (pref) page = pageIndexByRef.get(pref.toString()) ?? null;
    } catch { /* no widget page */ }
    fields.push({
      name, type, value, options, page,
      readOnly: safeBool(() => f.isReadOnly()),
      required: safeBool(() => f.isRequired()),
      multiline: type === 'text' && safeBool(() => f.isMultiline()),
      maxLength: type === 'text' ? (safe(() => f.getMaxLength()) ?? null) : null,
    });
  }
  return fields;
}
const safe = (fn) => { try { return fn(); } catch { return undefined; } };
const safeBool = (fn) => Boolean(safe(fn));

/** Fill fields by name. Unknown names and read-only fields are skipped and reported. */
export async function fillFormFields(doc, values = {}, { flatten = false } = {}) {
  const lib = await loadPdfLib();
  const form = doc.getForm();
  const skipped = [];
  for (const [name, value] of Object.entries(values)) {
    let f;
    try { f = form.getField(name); } catch { skipped.push(name); continue; }
    try {
      if (f instanceof lib.PDFTextField) {
        const max = safe(() => f.getMaxLength());
        f.setText(value == null ? '' : String(value).slice(0, max || undefined));
      } else if (f instanceof lib.PDFCheckBox) {
        (value === true || value === 'true' || value === 'on' || value === 'yes') ? f.check() : f.uncheck();
      } else if (f instanceof lib.PDFRadioGroup) {
        if (value) f.select(String(value)); else f.clear();
      } else if (f instanceof lib.PDFDropdown || f instanceof lib.PDFOptionList) {
        if (value) f.select(String(value)); else f.clear();
      } else skipped.push(name);
    } catch { skipped.push(name); }
  }
  if (flatten) flattenForm(doc);
  return { skipped };
}

export function flattenForm(doc) {
  try {
    const form = doc.getForm();
    if (!form.getFields().length) return false;
    form.flatten({ updateFieldAppearances: true });
    return true;
  } catch {
    // Some generators write widgets pdf-lib cannot re-draw; fall back to keeping appearances.
    try { doc.getForm().flatten({ updateFieldAppearances: false }); return true; } catch { return false; }
  }
}

/* ---------------- compress ---------------- */

/**
 * Lossless re-save: object streams, unused objects dropped, optional
 * metadata strip. Returns the new bytes (the caller compares sizes).
 */
export async function compressPdfBytes(bytes, { strip = false } = {}) {
  const src = await openPdfLib(bytes);
  if (src.isEncrypted) throw new Error('This PDF is encrypted; open it in the PDF Editor with its password first.');
  // Copy pages into a fresh document so objects no page references are left behind.
  const { doc } = await composeDocument(src.getPages().map((_, i) => ({ src: 0, index: i })), async () => src, { keepStructure: false });
  if (strip) await stripMetadata(doc); else doc.setProducer('Toolbox');
  return savePdf(doc);
}

/* ---------------- quick summary ---------------- */

export async function inspectPdfBytes(bytes) {
  const doc = await openPdfLib(bytes);
  const pages = doc.getPages().map((p, i) => {
    const g = pageGeometry(p);
    const v = viewSize(g.box, g.rot);
    return { index: i, width: Math.round(v.width), height: Math.round(v.height), rotation: g.rot };
  });
  let fields = 0;
  try { fields = doc.getForm().getFields().length; } catch { /* none */ }
  return { pageCount: pages.length, pages, encrypted: Boolean(doc.isEncrypted), formFields: fields, ...getMetadata(doc) };
}
