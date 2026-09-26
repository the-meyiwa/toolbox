/* ============================================================
   PDF workspace UI kit — shared by PDF Editor, Merge, Split and
   Image to PDF so the four tools look and behave as one.

   PdfSession    sources (bytes + pdf.js document) and page items
   ThumbService  lazy thumbnails: IntersectionObserver, small batches,
                 JPEG object URLs instead of live canvases, cancellable
   PageGrid      the page grid: select, drag to reorder, rotate,
                 duplicate, delete, keyboard support
   runTask       progress strip with Cancel
   askPassword   password dialog for encrypted files
   ============================================================ */

import {
  toBytes, isPdfBytes, openPdfLib, pageGeometry, readOutline, getMetadata, normRot, viewSize,
  composeDocument, humanBytes, isCancel, tick, baseName,
} from './core.js';
import { openPdfJs } from './pdfjs-loader.js';
import { createZip } from './zip.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let uidN = 0;
export const uid = (p = 'p') => `${p}${Date.now().toString(36)}${(uidN++).toString(36)}`;

/* ---------------- icons (24px grid, stroke) ---------------- */

const P = {
  upload: '<path d="M12 15V4M7 9l5-5 5 5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  rotateCw: '<path d="M20 11a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
  rotateCcw: '<path d="M4 11a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  blank: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>',
  file: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/>',
  fileIn: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 14h6M12 11l3 3-3 3"/>',
  extract: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h5"/><path d="M14 3v5h5v4"/><path d="M15 17h6M18 14l3 3-3 3"/>',
  scissors: '<circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path d="M8.5 8.5L20 19M8.5 15.5L20 5"/>',
  merge: '<path d="M6 3v5a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4v5"/><path d="M18 3v5a4 4 0 0 1-4 4"/><path d="M15 18l3 3 3-3"/>',
  select: '<path d="M5 3l14 7-6 2-2 6z"/>',
  text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  highlight: '<path d="M4 20h7"/><path d="M14.5 4.5l5 5L11 18H6v-5z"/>',
  pen: '<path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M13 7l4 4"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="8" ry="6"/>',
  arrow: '<path d="M5 19L19 5M10 5h9v9"/>',
  line: '<path d="M5 19L19 5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  zoomIn: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11h6M11 8v6"/>',
  zoomOut: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11h6"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  sign: '<path d="M3 17c3-6 5-9 6-8s-2 6 0 7 3-5 5-4 0 4 2 4 3-2 5-2"/><path d="M3 21h18"/>',
  form: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  redact: '<rect x="3" y="5" width="18" height="14" rx="1"/><rect x="6" y="9" width="12" height="3" fill="currentColor"/><path d="M6 15h7"/>',
  convert: '<path d="M4 7h13l-3-3M20 17H7l3 3"/>',
  organise: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
  left: '<path d="M15 6l-6 6 6 6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  stamp: '<path d="M5 21h14M6 17h12v-3a2 2 0 0 0-2-2h-2l-.5-3a2.5 2.5 0 1 0-3 0L10 12H8a2 2 0 0 0-2 2z"/>',
  hash: '<path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  compress: '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  textFile: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M8 13h8M8 17h6"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
};

export function icon(name, size = 18) {
  return `<svg class="pw-ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

/* ---------------- downloads ---------------- */

export function downloadBytes(bytes, name, type = 'application/octet-stream') {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return blob.size;
}

/** One file downloads as itself; several go into one ZIP. */
export function downloadFiles(files, zipName = 'files.zip') {
  if (!files.length) return 0;
  if (files.length === 1) return downloadBytes(files[0].data, files[0].name, mimeFor(files[0].name));
  return downloadBytes(createZip(files), zipName, 'application/zip');
}

export function mimeFor(name) {
  const ext = String(name).split('.').pop().toLowerCase();
  return { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', txt: 'text/plain', md: 'text/markdown', zip: 'application/zip' }[ext] || 'application/octet-stream';
}

/* ---------------- password dialog ---------------- */

export function askPassword(fileName, reason = 'need') {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'pw-modal-backdrop';
    wrap.innerHTML = `
      <form class="pw-modal" role="dialog" aria-modal="true" aria-labelledby="pw-pass-title">
        <div class="pw-modal-icon">${icon('lock', 22)}</div>
        <h3 id="pw-pass-title">Password required</h3>
        <p><strong>${esc(fileName)}</strong> is protected. Enter its password to open it. The password stays on this device.</p>
        <label class="pw-field"><span>Password</span>
          <input type="password" class="tool-input" autocomplete="current-password" required></label>
        <p class="pw-modal-err" ${reason === 'incorrect' ? '' : 'hidden'}>That password is not correct. Try again.</p>
        <div class="pw-modal-actions">
          <button type="button" class="btn btn-secondary" data-cancel>Cancel</button>
          <button type="submit" class="btn btn-primary">Open</button>
        </div>
      </form>`;
    document.body.appendChild(wrap);
    const input = wrap.querySelector('input');
    const close = (v) => { wrap.remove(); document.removeEventListener('keydown', onKey, true); prev?.focus?.(); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(null); } };
    document.addEventListener('keydown', onKey, true);
    wrap.querySelector('[data-cancel]').addEventListener('click', () => close(null));
    wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(null); });
    wrap.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); close(input.value); });
    setTimeout(() => input.focus(), 20);
  });
}

/* ---------------- session: sources and page items ---------------- */

export class PdfSession {
  constructor({ onPassword = askPassword } = {}) {
    this.sources = new Map();
    this.onPassword = onPassword;
    this.destroyed = false;
  }

  /** Load a PDF file. Throws PasswordCancelled if the person gives up on a password. */
  async add(file, { name } = {}) {
    const bytes = await toBytes(file);
    const label = name || file?.name || 'document.pdf';
    if (!isPdfBytes(bytes)) throw new Error(`${label} is not a PDF.`);
    const { doc: pdf, password } = await openPdfJs(bytes, { onPassword: (reason) => this.onPassword(label, reason) });
    const src = {
      id: uid('s'), name: label, size: bytes.length, bytes, pdf, password,
      encrypted: Boolean(password), pageCount: pdf.numPages, pages: [], outline: [], formFields: 0, meta: {},
    };
    let parsed = false;
    try {
      const lib = await openPdfLib(bytes);
      src.encrypted = src.encrypted || lib.isEncrypted;
      if (!lib.isEncrypted) {
        src.pages = lib.getPages().map(p => { const g = pageGeometry(p); return { x: g.box.x, y: g.box.y, w: g.box.width, h: g.box.height, rot: g.rot }; });
        src.outline = await readOutline(lib);
        try { src.formFields = lib.getForm().getFields().length; } catch { /* no form */ }
        src.meta = getMetadata(lib);
        parsed = src.pages.length === pdf.numPages;
      }
    } catch { src.encrypted = true; }
    if (!parsed) {
      src.pages = [];
      for (let i = 0; i < pdf.numPages; i++) {
        const page = await pdf.getPage(i + 1);
        const [x0, y0, x1, y1] = page.view;
        src.pages.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, rot: normRot(page.rotate) });
        if (i % 25 === 24) await tick();
      }
    }
    if (this.destroyed) { pdf.destroy?.(); throw Object.assign(new Error('Cancelled'), { cancelled: true }); }
    this.sources.set(src.id, src);
    return src;
  }

  get(id) { return this.sources.get(id); }

  /** Page items for a source, optionally limited to indices. */
  pageItems(srcId, indices = null) {
    const src = this.sources.get(srcId);
    const list = indices ?? src.pages.map((_, i) => i);
    return list.map(i => ({ id: uid(), src: srcId, index: i, rotate: 0, baseRot: src.pages[i].rot, x: src.pages[i].x || 0, y: src.pages[i].y || 0, w: src.pages[i].w, h: src.pages[i].h }));
  }

  /** A fresh pdf-lib document for a source; encrypted sources are rebuilt from rendered pages once. */
  async libDoc(srcId, { signal, onProgress } = {}) {
    const src = this.sources.get(srcId);
    if (src.encrypted) {
      if (!src.rasterBytes) {
        const { rasterizePdf } = await import('./raster.js');
        src.rasterBytes = await rasterizePdf(src.bytes, { dpi: 150, quality: 0.85, password: src.password, signal, onProgress });
      }
      return openPdfLib(src.rasterBytes);
    }
    return openPdfLib(src.bytes);
  }

  compose(pages, opts = {}) {
    return composeDocument(pages.map(p => ({ src: p.src, index: p.index, rotate: p.rotate, blank: p.blank })), (id) => this.libDoc(id, opts), opts);
  }

  remove(srcId) {
    const src = this.sources.get(srcId);
    src?.pdf?.destroy?.();
    this.sources.delete(srcId);
  }

  destroy() {
    this.destroyed = true;
    for (const src of this.sources.values()) src.pdf?.destroy?.();
    this.sources.clear();
  }
}

export const displayRot = (p) => normRot((p.baseRot || 0) + (p.rotate || 0));

/** User-space box of a page item (crop box). */
export const boxOf = (p) => ({ x: p.x || 0, y: p.y || 0, width: p.w, height: p.h });

export function blankPage(like) {
  const w = like?.blank?.width || (like ? (displayRot(like) % 180 ? like.h : like.w) : 595.28);
  const h = like?.blank?.height || (like ? (displayRot(like) % 180 ? like.w : like.h) : 841.89);
  return { id: uid(), blank: { width: w, height: h }, src: null, index: -1, rotate: 0, baseRot: 0, x: 0, y: 0, w, h };
}

/* ---------------- thumbnails ---------------- */

export class ThumbService {
  constructor(session, { width = 150, concurrency = 2, rootMargin = '600px 0px' } = {}) {
    this.session = session;
    this.width = width;
    this.concurrency = concurrency;
    this.rootMargin = rootMargin;
    this.cache = new Map();           // key → object URL
    this.observed = new Map();        // element → spec
    this.wanted = new Map();          // element → spec (visible, not yet drawn)
    this.ios = new Map();             // scroll root → IntersectionObserver
    this.active = new Set();          // render tasks in flight
    this.running = 0;
    this.destroyed = false;
  }

  /** One observer per scroll container, so the preload margin applies inside it. */
  observerFor(root) {
    if (typeof IntersectionObserver === 'undefined') return null;
    const key = root || document;
    let io = this.ios.get(key);
    if (!io) {
      io = new IntersectionObserver((entries) => this.onIntersect(entries), { root: root || null, rootMargin: this.rootMargin });
      this.ios.set(key, io);
    }
    return io;
  }

  key(spec) { return `${spec.src}:${spec.index}:${spec.rot}:${this.width}`; }

  /** Attach a thumbnail target. `el` must contain an <img>. */
  observe(el, spec, root = null) {
    if (this.destroyed || !spec.src) return;
    const url = this.cache.get(this.key(spec));
    const img = el.querySelector('img');
    if (url) { if (img && img.src !== url) img.src = url; el.classList.add('is-ready'); return; }
    const io = this.observerFor(root);
    this.observed.set(el, { ...spec, io });
    if (io) io.observe(el);
    else { this.wanted.set(el, spec); this.pump(); }
  }

  /** Stop tracking elements inside `host` (called before a grid re-renders). */
  forget(host) {
    for (const el of [...this.observed.keys()]) {
      if (!el.isConnected || host.contains(el)) {
        this.observed.get(el)?.io?.unobserve(el);
        this.observed.delete(el);
        this.wanted.delete(el);
      }
    }
  }

  onIntersect(entries) {
    for (const e of entries) {
      const spec = this.observed.get(e.target);
      if (!spec) continue;
      if (e.isIntersecting) this.wanted.set(e.target, spec);
      else this.wanted.delete(e.target);
    }
    this.pump();
  }

  pump() {
    while (!this.destroyed && this.running < this.concurrency && this.wanted.size) {
      const [el, spec] = this.wanted.entries().next().value;
      this.wanted.delete(el);
      this.running++;
      this.draw(el, spec).finally(() => {
        this.running--;
        // Small pause between batches so scrolling stays smooth.
        setTimeout(() => this.pump(), 0);
      });
    }
  }

  async draw(el, spec) {
    const key = this.key(spec);
    try {
      let url = this.cache.get(key);
      if (!url) {
        const src = this.session.get(spec.src);
        if (!src?.pdf) return;
        const page = await src.pdf.getPage(spec.index + 1);
        if (this.destroyed) return;
        const base = page.getViewport({ scale: 1, rotation: spec.rot });
        const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
        const scale = (this.width * dpr) / base.width;
        const viewport = page.getViewport({ scale, rotation: spec.rot });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const task = page.render({ canvasContext: ctx, viewport });
        this.active.add(task);
        try { await task.promise; } finally { this.active.delete(task); page.cleanup?.(); }
        if (this.destroyed) { canvas.width = 0; return; }
        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.82));
        canvas.width = 0; canvas.height = 0;
        if (!blob || this.destroyed) return;
        url = URL.createObjectURL(blob);
        this.cache.set(key, url);
        this.trim();
      }
      this.observed.get(el)?.io?.unobserve(el);
      this.observed.delete(el);
      const img = el.querySelector('img');
      if (img) img.src = url;
      el.classList.add('is-ready');
    } catch (err) {
      if (!this.destroyed && err?.name !== 'RenderingCancelledException') el.classList.add('is-error');
    }
  }

  trim(max = 1600) {
    while (this.cache.size > max) {
      const [k, u] = this.cache.entries().next().value;
      this.cache.delete(k);
      URL.revokeObjectURL(u);
    }
  }

  /** Drop cached images for a source (after it is removed). */
  dropSource(srcId) {
    for (const [k, u] of [...this.cache]) if (k.startsWith(`${srcId}:`)) { URL.revokeObjectURL(u); this.cache.delete(k); }
  }

  destroy() {
    this.destroyed = true;
    for (const io of this.ios.values()) io.disconnect();
    this.ios.clear();
    for (const t of this.active) { try { t.cancel(); } catch { /* already done */ } }
    this.active.clear();
    this.wanted.clear();
    this.observed.clear();
    for (const u of this.cache.values()) URL.revokeObjectURL(u);
    this.cache.clear();
  }
}

/** Nearest ancestor that scrolls vertically, or null for the viewport. */
export function scrollParent(el) {
  for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if (oy === 'auto' || oy === 'scroll') return n;
  }
  return null;
}

/* ---------------- page grid ---------------- */

/**
 * @param {HTMLElement} host
 * @param {object} o
 *   thumbs      ThumbService
 *   actions     subset of ['rotate', 'duplicate', 'delete']
 *   reorder     allow drag and keyboard moves
 *   label(p,i)  secondary caption
 *   badge(p,i)  small tag in the corner (e.g. split part)
 *   dim(p,i)    render faded
 *   onChange(kind)   after pages or selection change: 'pages' | 'selection'
 *   onOpen(p,i) double-click / Enter
 */
export class PageGrid {
  constructor(host, o = {}) {
    this.host = host;
    this.o = { actions: ['rotate', 'duplicate', 'delete'], reorder: true, ...o };
    this.pages = [];
    this.selected = new Set();
    this.anchor = null;
    this.focusId = null;
    this.dragIds = null;
    host.classList.add('pw-pagegrid');
    host.setAttribute('role', 'listbox');
    host.setAttribute('aria-multiselectable', 'true');
    host.setAttribute('aria-label', 'Pages');
    this.bind();
  }

  setPages(pages, { keepSelection = true } = {}) {
    this.pages = pages;
    if (keepSelection) { const ids = new Set(pages.map(p => p.id)); for (const id of [...this.selected]) if (!ids.has(id)) this.selected.delete(id); }
    else this.selected.clear();
    this.render();
  }

  getSelected() { return this.pages.filter(p => this.selected.has(p.id)); }
  selectedIndices() { return this.pages.map((p, i) => (this.selected.has(p.id) ? i : -1)).filter(i => i >= 0); }

  select(ids, { silent = false } = {}) {
    this.selected = new Set(ids);
    this.syncSelection();
    if (!silent) this.o.onChange?.('selection');
  }

  selectAll() { this.select(this.pages.map(p => p.id)); }
  selectNone() { this.select([]); }
  invert() { this.select(this.pages.filter(p => !this.selected.has(p.id)).map(p => p.id)); }

  render() {
    const { thumbs } = this.o;
    thumbs?.forget(this.host);
    const acts = this.o.actions;
    const actBtn = (a, ic, label) => `<button type="button" class="pw-page-act" data-act="${a}" title="${label}" aria-label="${label}">${icon(ic, 15)}</button>`;
    const html = this.pages.map((p, i) => {
      const rot = displayRot(p);
      const vs = viewSize({ width: p.w, height: p.h }, rot);
      const ar = vs.width / vs.height;
      const label = this.o.label?.(p, i) ?? '';
      const badge = this.o.badge?.(p, i) ?? '';
      const dim = this.o.dim?.(p, i);
      const sel = this.selected.has(p.id);
      return `<div class="pw-page${sel ? ' is-selected' : ''}${dim ? ' is-dim' : ''}${p.blank ? ' is-blank' : ''}" role="option" aria-selected="${sel}" data-id="${p.id}" tabindex="${(this.focusId ? p.id === this.focusId : i === 0) ? 0 : -1}" ${this.o.reorder ? 'draggable="true"' : ''} aria-label="Page ${i + 1}">
        <div class="pw-thumb"><div class="pw-sheet${ar > 0.78 ? ' is-wide' : ''}${p.url ? ' is-ready is-image' : ''}${p.url && rot % 180 ? ' is-turned' : ''}" style="--ar:${ar.toFixed(4)}${p.url ? `;--rot:${rot}deg` : ''}">${p.blank ? '' : p.url ? `<img alt="" decoding="async" src="${esc(p.url)}">` : '<img alt="" decoding="async">'}</div>${badge ? `<span class="pw-badge">${esc(badge)}</span>` : ''}<span class="pw-check" aria-hidden="true">${icon('check', 12)}</span></div>
        <div class="pw-page-foot"><span class="pw-page-num">${i + 1}</span>${label ? `<span class="pw-page-lbl">${esc(label)}</span>` : ''}${p.rotate ? `<span class="pw-page-rot" title="Rotated">${normRot(p.rotate)}&deg;</span>` : ''}</div>
        ${acts.length ? `<div class="pw-page-acts">${acts.includes('rotate') ? actBtn('rotate', 'rotateCw', 'Rotate clockwise') : ''}${acts.includes('duplicate') ? actBtn('duplicate', 'copy', 'Duplicate') : ''}${acts.includes('delete') ? actBtn('delete', 'trash', 'Delete') : ''}</div>` : ''}
      </div>`;
    }).join('');
    this.host.innerHTML = html || `<div class="pw-pagegrid-empty">No pages</div>`;
    if (thumbs) {
      const cells = this.host.children;
      this.pages.forEach((p, i) => {
        if (p.blank || p.url) return;
        thumbs.observe(cells[i].querySelector('.pw-sheet'), { src: p.src, index: p.index, rot: displayRot(p) }, this.o.scrollRoot === undefined ? scrollParent(this.host) : this.o.scrollRoot);
      });
    }
  }

  /** Refresh badges and dimming without rebuilding cells. */
  decorate() {
    const cells = this.host.children;
    this.pages.forEach((p, i) => {
      const el = cells[i];
      if (!el || !el.classList.contains('pw-page')) return;
      el.classList.toggle('is-dim', Boolean(this.o.dim?.(p, i)));
      const b = this.o.badge?.(p, i) ?? '';
      let tag = el.querySelector('.pw-badge');
      if (b && !tag) {
        tag = document.createElement('span');
        tag.className = 'pw-badge';
        el.querySelector('.pw-thumb').appendChild(tag);
      }
      if (tag) { if (b) tag.textContent = b; else tag.remove(); }
    });
  }

  syncSelection() {
    for (const el of this.host.querySelectorAll('.pw-page')) {
      const on = this.selected.has(el.dataset.id);
      el.classList.toggle('is-selected', on);
      el.setAttribute('aria-selected', String(on));
    }
  }

  indexOf(id) { return this.pages.findIndex(p => p.id === id); }

  /** Apply a change to the page list and notify. */
  mutate(fn) {
    fn(this.pages);
    this.render();
    this.o.onChange?.('pages');
  }

  rotate(ids, deg = 90) {
    this.mutate(pages => { for (const p of pages) if (ids.includes(p.id)) p.rotate = normRot((p.rotate || 0) + deg); });
  }

  remove(ids) {
    this.mutate(pages => { for (let i = pages.length - 1; i >= 0; i--) if (ids.includes(pages[i].id)) pages.splice(i, 1); });
  }

  duplicate(ids) {
    this.mutate(pages => {
      for (let i = pages.length - 1; i >= 0; i--) if (ids.includes(pages[i].id)) pages.splice(i + 1, 0, { ...pages[i], id: uid(), dupOf: pages[i].id });
    });
  }

  /** Move `ids` so they sit before position `to` (index in the current list). */
  move(ids, to) {
    this.mutate(pages => {
      const moving = pages.filter(p => ids.includes(p.id));
      let insertAt = to;
      for (let i = 0; i < to && i < pages.length; i++) if (ids.includes(pages[i].id)) insertAt--;
      const rest = pages.filter(p => !ids.includes(p.id));
      rest.splice(Math.max(0, Math.min(rest.length, insertAt)), 0, ...moving);
      pages.splice(0, pages.length, ...rest);
    });
  }

  insertAt(index, items) {
    this.mutate(pages => pages.splice(Math.max(0, Math.min(pages.length, index)), 0, ...items));
  }

  shift(ids, delta) {
    const idx = this.pages.map((p, i) => (ids.includes(p.id) ? i : -1)).filter(i => i >= 0);
    if (!idx.length) return;
    if (delta < 0 && idx[0] === 0) return;
    if (delta > 0 && idx.at(-1) === this.pages.length - 1) return;
    this.move(ids, delta < 0 ? idx[0] - 1 : idx.at(-1) + 2);
  }

  focusCell(id) {
    this.focusId = id;
    for (const el of this.host.querySelectorAll('.pw-page')) el.tabIndex = el.dataset.id === id ? 0 : -1;
    this.host.querySelector(`.pw-page[data-id="${id}"]`)?.focus();
  }

  bind() {
    const h = this.host;
    h.addEventListener('click', (e) => {
      const cell = e.target.closest('.pw-page');
      if (!cell) return;
      const id = cell.dataset.id;
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act) {
        e.stopPropagation();
        const ids = this.selected.has(id) && this.selected.size > 1 ? [...this.selected] : [id];
        if (act === 'rotate') this.rotate(ids, 90);
        else if (act === 'duplicate') this.duplicate(ids);
        else if (act === 'delete') this.remove(ids);
        return;
      }
      this.focusId = id;
      if (e.shiftKey && this.anchor) {
        const a = this.indexOf(this.anchor), b = this.indexOf(id);
        const [lo, hi] = a < b ? [a, b] : [b, a];
        this.select(this.pages.slice(lo, hi + 1).map(p => p.id));
      } else if (e.metaKey || e.ctrlKey || this.o.toggleClick || e.pointerType === 'touch' || matchMedia('(pointer: coarse)').matches) {
        const s = new Set(this.selected);
        s.has(id) ? s.delete(id) : s.add(id);
        this.anchor = id;
        this.select([...s]);
      } else {
        this.anchor = id;
        this.select(this.selected.size === 1 && this.selected.has(id) ? [] : [id]);
      }
    });
    h.addEventListener('dblclick', (e) => {
      const cell = e.target.closest('.pw-page');
      if (cell && !e.target.closest('[data-act]')) this.o.onOpen?.(this.pages[this.indexOf(cell.dataset.id)], this.indexOf(cell.dataset.id));
    });
    h.addEventListener('keydown', (e) => {
      const cell = e.target.closest('.pw-page');
      if (!cell) return;
      const id = cell.dataset.id;
      const i = this.indexOf(id);
      const cols = Math.max(1, Math.round(h.clientWidth / (cell.offsetWidth || 1)));
      const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key];
      if (step) {
        e.preventDefault();
        if ((e.ctrlKey || e.metaKey || e.altKey) && this.o.reorder) {
          const ids = this.selected.has(id) ? [...this.selected] : [id];
          this.shift(ids, Math.sign(step));
          this.focusCell(id);
          return;
        }
        const next = this.pages[Math.max(0, Math.min(this.pages.length - 1, i + step))];
        if (next) {
          if (e.shiftKey) { const s = new Set(this.selected); s.add(id); s.add(next.id); this.select([...s]); }
          this.focusCell(next.id);
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        const s = new Set(this.selected);
        s.has(id) ? s.delete(id) : s.add(id);
        this.anchor = id;
        this.select([...s]);
      } else if (e.key === 'Enter') {
        this.o.onOpen?.(this.pages[i], i);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && this.o.actions.includes('delete')) {
        e.preventDefault();
        const ids = this.selected.size ? [...this.selected] : [id];
        const nextId = this.pages[i + 1]?.id || this.pages[i - 1]?.id;
        this.remove(ids);
        if (nextId && this.indexOf(nextId) >= 0) this.focusCell(nextId);
      } else if ((e.key === 'r' || e.key === 'R') && this.o.actions.includes('rotate') && !e.ctrlKey && !e.metaKey) {
        this.rotate(this.selected.size ? [...this.selected] : [id], e.shiftKey ? 270 : 90);
        this.focusCell(id);
      } else if ((e.key === 'a' || e.key === 'A') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.selectAll();
      }
    });

    if (!this.o.reorder) return;
    let marker = null;
    const clearMarker = () => { marker?.classList.remove('drop-before', 'drop-after'); marker = null; };
    h.addEventListener('dragstart', (e) => {
      const cell = e.target.closest('.pw-page');
      if (!cell) return;
      const id = cell.dataset.id;
      this.dragIds = this.selected.has(id) ? this.pages.filter(p => this.selected.has(p.id)).map(p => p.id) : [id];
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', `${this.dragIds.length} page(s)`); } catch { /* Safari */ }
      requestAnimationFrame(() => { for (const el of h.querySelectorAll('.pw-page')) if (this.dragIds?.includes(el.dataset.id)) el.classList.add('is-dragging'); });
    });
    h.addEventListener('dragend', () => {
      this.dragIds = null;
      clearMarker();
      for (const el of h.querySelectorAll('.is-dragging')) el.classList.remove('is-dragging');
    });
    h.addEventListener('dragover', (e) => {
      if (!this.dragIds) return;
      e.preventDefault();
      const cell = e.target.closest('.pw-page');
      if (!cell) return;
      const r = cell.getBoundingClientRect();
      const after = e.clientX > r.left + r.width / 2;
      if (marker !== cell) clearMarker();
      marker = cell;
      cell.classList.toggle('drop-after', after);
      cell.classList.toggle('drop-before', !after);
    });
    h.addEventListener('dragleave', (e) => { if (!h.contains(e.relatedTarget)) clearMarker(); });
    h.addEventListener('drop', (e) => {
      if (!this.dragIds) return;
      e.preventDefault();
      const cell = e.target.closest('.pw-page') || marker;
      const ids = this.dragIds;
      const after = cell?.classList.contains('drop-after');
      clearMarker();
      this.dragIds = null;
      if (!cell) return;
      const to = this.indexOf(cell.dataset.id) + (after ? 1 : 0);
      this.move(ids, to);
    });
  }
}

/* ---------------- progress with cancel ---------------- */

/**
 * Run a long job with a progress strip in `host`. The job receives
 * {signal, progress(fraction, label)} and may throw PdfCancelled.
 * Returns the job's result, or undefined when cancelled.
 */
export async function runTask(host, label, job, { onError } = {}) {
  let bar = host.querySelector(':scope > .pw-progress');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'pw-progress';
    bar.setAttribute('role', 'status');
    bar.innerHTML = `<div class="pw-progress-text"><span class="pw-progress-label"></span><span class="pw-progress-pct"></span></div>
      <div class="pw-progress-track"><i></i></div>
      <button type="button" class="btn btn-secondary btn-sm pw-progress-cancel">Cancel</button>`;
    host.appendChild(bar);
  }
  if (bar._ctrl && !bar._ctrl.signal.aborted) bar._ctrl.abort();
  const ctrl = new AbortController();
  bar._ctrl = ctrl;
  const lab = bar.querySelector('.pw-progress-label');
  const pct = bar.querySelector('.pw-progress-pct');
  const fill = bar.querySelector('i');
  const cancel = bar.querySelector('.pw-progress-cancel');
  cancel.onclick = () => ctrl.abort();
  lab.textContent = label;
  pct.textContent = '';
  fill.style.width = '0%';
  bar.classList.add('is-indeterminate');
  bar.hidden = false;
  host.classList.add('is-busy');
  let last = 0;
  const progress = (f, text) => {
    if (text) lab.textContent = text;
    if (!Number.isFinite(f)) return;
    const now = performance.now();
    if (now - last < 60 && f < 1) return;
    last = now;
    bar.classList.remove('is-indeterminate');
    const v = Math.max(0, Math.min(1, f));
    fill.style.width = `${(v * 100).toFixed(1)}%`;
    pct.textContent = `${Math.round(v * 100)}%`;
  };
  await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  try {
    return await job({ signal: ctrl.signal, progress });
  } catch (err) {
    if (isCancel(err) || ctrl.signal.aborted) { notify('Cancelled.'); return undefined; }
    console.error(err);
    if (onError) onError(err); else notify(err?.message || 'Something went wrong.', 'error');
    return undefined;
  } finally {
    if (bar._ctrl === ctrl) { bar.hidden = true; host.classList.remove('is-busy'); }
  }
}

/* ---------------- small UI helpers ---------------- */

export function notify(message, type = 'info') {
  try {
    import('../../utils.js').then(({ showToast }) => showToast(message, type === 'error' ? 'error' : type));
  } catch { /* no toast host */ }
}

export function segmented(name, options, value) {
  return `<div class="pw-seg" role="radiogroup" data-seg="${name}">${options.map(([v, label]) =>
    `<button type="button" role="radio" data-v="${esc(v)}" aria-checked="${String(v) === String(value)}">${esc(label)}</button>`).join('')}</div>`;
}

/** Wire every [data-seg] inside root; returns a getter map. */
export function bindSegmented(root, onChange) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-seg] > button');
    if (!b) return;
    const group = b.parentElement;
    for (const x of group.children) x.setAttribute('aria-checked', String(x === b));
    onChange?.(group.dataset.seg, b.dataset.v);
  });
  return (name) => root.querySelector(`[data-seg="${name}"] [aria-checked="true"]`)?.dataset.v;
}

export function fileSummary(src) {
  return `${src.pageCount} page${src.pageCount === 1 ? '' : 's'} · ${humanBytes(src.size)}${src.encrypted ? ' · encrypted' : ''}`;
}

export function pickFiles({ accept = 'application/pdf,.pdf', multiple = false } = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.addEventListener('change', () => resolve([...(input.files || [])]), { once: true });
    input.click();
  });
}

export function outName(src, suffix) {
  return `${baseName(src?.name || 'document')}${suffix}`;
}
