/* ============================================================
   TOOLBOX — Files anywhere

   A file behaves the same wherever it appears: in Files, a
   message, an email, the Assistant, File Drop or a tool's list.

     drag it     into the Assistant, into Files, into a mail you
                 are writing, into any tool that takes dropped
                 files, or out to the desktop (where the browser
                 allows)
     Space       previews it (Quick Look); Space or Esc closes
     right-click Quick Look, Open in <tools>, Ask Assistant,
                 Save to Files, Download, Get info

   A surface marks an element with fileAttrs(ref):
     ref = { key?, name, type?, size?, from?,        (from: tool id)
             blob? | text? | url? | load?(): Promise<Blob>,
             path?  (a Toolbox Files path), packed? (a packed share) }

   Dragging carries a Toolbox id (browsers do not let a page put a
   real file into a drag). When it is dropped, the drop is replayed
   on the same spot with the real file attached, so every existing
   drop zone takes it without knowing about this module.
   ============================================================ */

import { icon } from './icons.js';

const REG = new Map();
const MAX = 400;
let seq = 0;
let installed = false;
let selected = null;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const DRAG_TYPE = 'application/toolbox-file';

export function formatSize(bytes = 0) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let n = bytes / 1024, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${units[i]}`;
}

/** Registers a file and returns its id. A stable `key` keeps one entry per file across re-renders. */
export function registerFile(ref) {
  const id = ref.key ? `k:${ref.key}` : `f${++seq}`;
  const prev = REG.get(id);
  REG.delete(id);
  // Keep a loaded body across re-renders of the same file.
  REG.set(id, { ...ref, id, blob: ref.blob || prev?.blob || null });
  while (REG.size > MAX) REG.delete(REG.keys().next().value);
  return id;
}

/** Attributes that make an element a file: draggable, focusable, previewable, with the file menu. */
export function fileAttrs(ref) {
  const id = registerFile(ref);
  return `data-tb-file="${esc(id)}" draggable="true" tabindex="0" aria-roledescription="file"`;
}

/** Marks an existing element as a file (for surfaces that build DOM nodes). */
export function markFile(el, ref) {
  if (!el?.setAttribute) return el;
  el.setAttribute('data-tb-file', registerFile(ref));
  el.setAttribute('draggable', 'true');
  if (!el.hasAttribute?.('tabindex')) el.setAttribute('tabindex', '0');
  el.setAttribute('aria-roledescription', 'file');
  return el;
}

export const fileRefOf = (el) => REG.get(el?.closest?.('[data-tb-file]')?.dataset.tbFile);
export const fileById = (id) => REG.get(id);

const extOf = (name = '') => { const i = name.lastIndexOf('.'); return i > 0 ? name.slice(i + 1).toLowerCase() : ''; };

/** The file's body as a Blob, loaded once and kept. */
export async function blobOf(ref) {
  if (!ref) throw new Error('That file is no longer available.');
  if (ref.blob) return ref.blob;
  let blob = null;
  if (ref.text != null) blob = new Blob([ref.text], { type: ref.type || 'text/plain' });
  else if (ref.load) blob = await ref.load();
  else if (ref.path) {
    const { fs } = await import('./filesystem.js');
    blob = await fs.readFile(ref.path, { encoding: 'blob', storage: ref.storage || 'offline' });
  } else if (ref.url) {
    if (ref.packed) blob = await (await import('./transfer-pack.js')).fetchTransfer(ref.url, { type: ref.type });
    else {
      const res = await fetch(ref.url);
      if (!res.ok) throw new Error(`The file could not be downloaded (${res.status}).`);
      blob = await res.blob();
    }
  }
  if (!blob) throw new Error('That file could not be read.');
  if (ref.type && !blob.type) blob = new Blob([blob], { type: ref.type });
  ref.blob = blob;
  if (!ref.size) ref.size = blob.size;
  return blob;
}

/** A work item for the interop layer (open in tools, save, ask). */
async function itemOf(ref) {
  const { toItem } = await import('./interop.js');
  const blob = await blobOf(ref);
  return toItem({ name: ref.name, type: ref.type || blob.type, blob, from: ref.from || null });
}

async function toast(text, tone = 'info') {
  try { (await import('../utils.js')).showToast?.(text, tone); } catch { /* no toast */ }
}

async function fail(err) {
  const { tbAlert } = await import('./dialog.js');
  tbAlert(err?.message || 'That file could not be opened.', 'File');
}

/* ---------------- actions ---------------- */

export async function downloadFile(ref) {
  try {
    const blob = await blobOf(ref);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = ref.name || 'file';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch (err) { fail(err); }
}

export async function askAboutFile(ref) {
  try { (await import('./interop.js')).askAssistant(await itemOf(ref)); } catch (err) { fail(err); }
}

export async function saveFileToFiles(ref) {
  try {
    const path = await (await import('./interop.js')).saveToFiles(await itemOf(ref));
    toast(`Saved to ${path}`, 'success');
  } catch (err) { fail(err); }
}

async function openFileIn(ref, toolId) {
  try { (await import('./interop.js')).openIn(toolId, await itemOf(ref)); } catch (err) { fail(err); }
}

/** The tools for this file, best first: the same list Files offers (its editor first). */
async function toolsFor(ref) {
  const [{ getToolsForFile }, { targetsFor, kindOf }] = await Promise.all([import('../views/saved.js'), import('./interop.js')]);
  const own = getToolsForFile({ name: ref.name || '' }).filter((t) => t?.id);
  const more = targetsFor(kindOf(ref.name, ref.type || ''));
  const seen = new Set();
  return [...own, ...more].filter((t) => !seen.has(t.id) && seen.add(t.id)).slice(0, 4);
}

/* ---------------- Quick Look ---------------- */

let openLook = null;

function modal(html, onKey) {
  document.getElementById('sv-quicklook-modal')?.remove();
  const returnFocus = document.activeElement;
  const el = document.createElement('div');
  el.id = 'sv-quicklook-modal';
  el.className = 'sv-modal tb-look';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = html;
  document.body.appendChild(el);
  const urls = [];
  const close = () => {
    if (!el.isConnected) return;
    el.remove();
    urls.forEach((u) => URL.revokeObjectURL(u));
    document.removeEventListener('keydown', keys, true);
    openLook = null;
    if (returnFocus?.isConnected) returnFocus.focus?.({ preventScroll: true });
  };
  const keys = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    onKey?.(e, close);
  };
  document.addEventListener('keydown', keys, true);
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('[data-modal-close]')) close(); });
  const card = el.querySelector('.sv-modal-card');
  card?.setAttribute('tabindex', '-1');
  card?.focus?.({ preventScroll: true });
  openLook = { el, close, urls };
  return openLook;
}

/** Previews a file, the same way Files does. */
export async function quickLook(ref) {
  if (!ref) return;
  if (openLook) { openLook.close(); return; }
  const S = await import('../views/saved.js');
  const { getFileTypeIcon } = await import('./file-icons.js');
  const item = { name: ref.name || 'file', kind: undefined, size: ref.size || 0 };
  const type = S.previewTypeOf(item);
  const tools = await toolsFor(ref);
  const top = tools[0];
  const look = modal(`
    <div class="sv-modal-card sv-ql" aria-labelledby="tb-ql-title">
      <div class="sv-modal-head">
        <span class="sv-modal-icon">${getFileTypeIcon(item.name, item.kind, 22)}</span>
        <div class="sv-ql-title">
          <strong id="tb-ql-title">${esc(item.name)}</strong>
          <span data-ql-meta>${esc([S.kindOf(item), ref.size ? formatSize(ref.size) : '', ref.fromLabel || ''].filter(Boolean).join(' · '))}</span>
        </div>
        <button type="button" class="sv-icon-btn" data-modal-close title="Close (Esc)" aria-label="Close">${icon('x')}</button>
      </div>
      <div class="sv-ql-body sv-preview" data-preview-type="${type}"><div class="sv-media"><span class="sv-loading">Loading preview</span></div></div>
      <div class="sv-modal-foot">
        <span class="sv-kbd-hint"><kbd>Space</kbd> or <kbd>Esc</kbd> to close</span>
        <span class="tb-ql-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-ql="ask">${icon('sparkle')}<span>Ask Assistant</span></button>
          <button type="button" class="btn btn-secondary btn-sm" data-ql="save">${icon('save')}<span>Save to Files</span></button>
          <button type="button" class="btn btn-secondary btn-sm" data-ql="download">${icon('download')}<span>Download</span></button>
          ${top ? `<button type="button" class="btn btn-primary btn-sm" data-ql="open">${icon('external')}<span>Open in ${esc(top.name)}</span></button>` : ''}
        </span>
      </div>
    </div>`, (e, close) => {
    if (e.code === 'Space' && !e.target.closest?.('input, textarea, button, a, video, audio')) { e.preventDefault(); e.stopPropagation(); close(); }
  });
  look.el.addEventListener('click', (e) => {
    const act = e.target.closest('[data-ql]')?.dataset.ql;
    if (!act) return;
    if (act === 'ask') { look.close(); askAboutFile(ref); }
    if (act === 'save') saveFileToFiles(ref);
    if (act === 'download') downloadFile(ref);
    if (act === 'open' && top) { look.close(); openFileIn(ref, top.id); }
  });
  const body = look.el.querySelector('.sv-ql-body');
  const put = (html) => { if (look.el.isConnected) body.innerHTML = html; };
  try {
    const blob = await blobOf(ref);
    if (!look.el.isConnected) return;
    look.el.querySelector('[data-ql-meta]').textContent = [S.kindOf(item), formatSize(blob.size), ref.fromLabel || ''].filter(Boolean).join(' · ');
    const src = () => { const u = URL.createObjectURL(blob); look.urls.push(u); return u; };
    if (type === 'image') put(`<div class="sv-media"><img src="${src()}" alt="${esc(item.name)}"></div>`);
    else if (type === 'pdf') put(`<iframe class="sv-frame sv-pdf-frame" src="${src()}" title="${esc(item.name)}"></iframe>`);
    else if (type === 'audio') put(`<div class="sv-media"><audio controls src="${src()}"></audio></div>`);
    else if (type === 'video') put(`<div class="sv-media"><video controls src="${src()}"></video></div>`);
    else if (type === 'document') {
      const { renderPreview } = await import('./docs/preview.js');
      const html = await renderPreview(blob, item.name);
      // No scripts, no same-origin, and the page itself forbids network access.
      put(`<iframe class="sv-frame sv-doc-frame" sandbox="" referrerpolicy="no-referrer" srcdoc="${esc(html)}" title="${esc(item.name)}"></iframe>`);
    } else if (type === 'binary') {
      put(`<div class="sv-no-preview">${getFileTypeIcon(item.name, item.kind, 40)}<p>There's no preview for ${esc(S.kindOf(item).toLowerCase())} files.</p><span>Open it in a tool, or download it.</span></div>`);
    } else {
      const text = blob.size > 4_000_000 ? `${await blob.slice(0, 4_000_000).text()}\n…` : await blob.text();
      if (!text.length) put('<div class="sv-no-preview"><p>This file is empty.</p></div>');
      else if (type === 'markdown') put(`<div class="sv-md">${S.renderMarkdown(text)}</div>`);
      else if (type === 'csv') put(S.renderCsvTable(text, extOf(item.name) === 'tsv' ? '\t' : ','));
      // Scripts may run, but never with this page's origin.
      else if (type === 'html') put(`<iframe class="sv-frame" srcdoc="${esc(text)}" sandbox="allow-scripts" title="${esc(item.name)}"></iframe>`);
      else if (type === 'json') { let out = text; try { out = JSON.stringify(JSON.parse(text), null, 2); } catch { /* as is */ } put(`<pre class="sv-code">${esc(out)}</pre>`); }
      else put(`<pre class="sv-code">${esc(text)}</pre>`);
    }
  } catch (err) {
    put(`<div class="sv-no-preview"><p>${esc(err?.message || 'This file could not be previewed.')}</p></div>`);
  }
}

/* ---------------- menu ---------------- */

async function infoDialog(ref) {
  const S = await import('../views/saved.js');
  let size = ref.size;
  try { size = (await blobOf(ref)).size; } catch { /* keep */ }
  const rows = [['Kind', S.kindOf({ name: ref.name })], ['Size', formatSize(size || 0)], ...(ref.fromLabel ? [['From', ref.fromLabel]] : []), ...(ref.date ? [['Date', new Date(ref.date).toLocaleString()]] : [])];
  const look = modal(`
    <div class="sv-modal-card sv-props" aria-labelledby="tb-info-title">
      <div class="sv-modal-head"><span class="sv-modal-icon">${icon('file')}</span><strong id="tb-info-title">${esc(ref.name)}</strong>
        <button type="button" class="sv-icon-btn" data-modal-close aria-label="Close">${icon('x')}</button></div>
      <dl class="sv-props-list">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    </div>`);
  return look;
}

/** The file menu, as items for js/lib/context-menu.js; `extra` are the surface's own actions. */
export async function fileMenuItems(ref, extra = []) {
  const tools = await toolsFor(ref);
  return [
    { label: 'Quick Look', icon: icon('eye'), shortcut: 'Space', action: () => quickLook(ref) },
    ...tools.map((t, i) => ({ label: `Open in ${t.name}`, icon: i === 0 ? icon('external') : t.icon, action: () => openFileIn(ref, t.id) })),
    { label: 'Ask Assistant', icon: icon('sparkle'), action: () => askAboutFile(ref) },
    { separator: true },
    ...(ref.path ? [] : [{ label: 'Save to Files', icon: icon('save'), action: () => saveFileToFiles(ref) }]),
    { label: 'Download', icon: icon('download'), action: () => downloadFile(ref) },
    { label: 'Get info', icon: icon('info'), action: () => infoDialog(ref) },
    ...(extra.length ? [{ separator: true }, ...extra] : []),
  ];
}

export async function openFileMenu(ref, x, y, extra = []) {
  const { openContextMenu } = await import('./context-menu.js');
  openContextMenu({ x, y, title: ref.name, items: await fileMenuItems(ref, extra), label: `Actions for ${ref.name}` });
}

/* ---------------- one set of listeners for the whole app ---------------- */

function select(el) {
  if (selected && selected !== el) selected.classList.remove('is-file-selected');
  selected = el;
  el?.classList.add('is-file-selected');
}

const editable = (el) => !!el?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]');

export function installFileSurface(root = document) {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  root.addEventListener('pointerdown', (e) => {
    const el = e.target.closest?.('[data-tb-file]');
    if (!el) { if (!e.target.closest?.('#toolbox-context-menu, .sv-modal')) select(null); return; }
    select(el);
    // Start loading a remote body now, so a quick drag or preview finds it ready.
    const ref = REG.get(el.dataset.tbFile);
    if (ref && !ref.blob && (ref.url || ref.load)) blobOf(ref).catch(() => {});
  }, true);

  root.addEventListener('dragstart', (e) => {
    const el = e.target.closest?.('[data-tb-file]');
    if (!el || !e.dataTransfer) return;
    const ref = REG.get(el.dataset.tbFile);
    if (!ref) return;
    const dt = e.dataTransfer;
    dt.effectAllowed = 'copy';
    dt.setData(DRAG_TYPE, ref.id);
    if (ref.path) dt.setData('application/toolbox-path', ref.path);
    dt.setData('text/plain', ref.name || '');
    // Out to the desktop (Chrome, Edge): a URL the browser can fetch by itself.
    const url = ref.blob ? (ref._dragUrl ||= URL.createObjectURL(ref.blob)) : (/^https?:/.test(ref.url || '') && !ref.packed ? ref.url : '');
    if (url) {
      try { dt.setData('DownloadURL', `${ref.type || ref.blob?.type || 'application/octet-stream'}:${(ref.name || 'file').replace(/:/g, '-')}:${url}`); } catch { /* not supported */ }
      if (/^https?:/.test(url)) dt.setData('text/uri-list', url);
    }
    el.classList.add('is-file-dragging');
    el.addEventListener('dragend', () => el.classList.remove('is-file-dragging'), { once: true });
  });

  // Let a Toolbox file drop anywhere a file could; the drop is replayed with the real file below.
  root.addEventListener('dragover', (e) => {
    const types = [...(e.dataTransfer?.types || [])];
    if (!types.includes(DRAG_TYPE) || types.includes('Files')) return;
    if (e.target.closest?.('[data-tb-file]') === document.querySelector('.is-file-dragging')) return;
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'copy'; } catch { /* read-only */ }
  }, true);

  root.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const types = [...(dt?.types || [])];
    if (!types.includes(DRAG_TYPE) || types.includes('Files') || e.__tbReplay) return;
    const ref = REG.get(dt.getData(DRAG_TYPE));
    if (!ref) return;
    const target = e.target;
    if (target.closest?.('[data-tb-file]')?.dataset.tbFile === ref.id) { e.preventDefault(); return; }
    e.preventDefault();
    e.stopImmediatePropagation();
    const at = { clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY };
    blobOf(ref).then((blob) => {
      const file = new File([blob], ref.name || 'file', { type: blob.type || ref.type || 'application/octet-stream' });
      const data = new DataTransfer();
      // The real file only: a Files path would make Files move the original rather than copy it.
      data.items.add(file);
      const replay = (type) => {
        const ev = new DragEvent(type, { bubbles: true, cancelable: true, composed: true, dataTransfer: data, ...at });
        ev.__tbReplay = true;
        target.dispatchEvent(ev);
      };
      replay('dragenter'); replay('dragover'); replay('drop');
    }).catch(fail);
  }, true);

  // Capture: the file menu wins over a tool's own menu for the area around it.
  root.addEventListener('contextmenu', (e) => {
    const el = e.target.closest?.('[data-tb-file]');
    if (!el || editable(e.target)) return;
    const ref = REG.get(el.dataset.tbFile);
    if (!ref) return;
    e.preventDefault();
    e.stopPropagation();
    select(el);
    openFileMenu(ref, e.clientX, e.clientY, ref.menu || []);
  }, true);

  root.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (editable(e.target) || document.querySelector('.custom-dialog-backdrop, #toolbox-context-menu')) return;
    if (openLook) return;
    const focused = e.target.closest?.('[data-tb-file]');
    const el = focused || (selected?.isConnected && (e.target === document.body || e.target.contains?.(selected)) ? selected : null);
    const ref = el && REG.get(el.dataset.tbFile);
    if (!ref) return;
    e.preventDefault();
    e.stopPropagation();
    quickLook(ref);
  });
}
