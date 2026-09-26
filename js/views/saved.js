/* ============================================================
   TOOLBOX — Files (Browser File Explorer)
   One window, three views (preview, icons, list) over the in-browser
   filesystem. The interaction model follows the desktop file managers
   people already know:

   - click selects, Ctrl/Cmd-click toggles, Shift-click selects a range
   - double-click (or Enter) opens: folders navigate, files open in
     their best tool; on touch a tap opens
   - Space previews (Quick Look), F2 renames, Delete deletes,
     Backspace / Alt+Up goes to the enclosing folder, arrows move
   - right-click or long-press opens the context menu

   Markup lives here; every style lives in css/files.css.
   Strictly zero emojis.
   ============================================================ */

import { tbConfirm, tbPrompt } from '../lib/dialog.js';
import { openContextMenu, closeContextMenu } from '../lib/context-menu.js';
import { fs, normalizePath, getParentPath, getBaseName } from '../lib/filesystem.js';
import { createZip } from '../lib/archive-engine.js';
import * as store from '../lib/artifacts.js';
import { kindFromFilename } from '../registry/kinds.js';
import { hasRichPreview, editorFor, docFamily } from '../lib/docs/formats.js';
import { BY_ID, toolsAccepting } from '../registry/index.js';
import { getFileTypeIcon, detectFileCategory } from '../lib/file-icons.js';
import { getCurrentUser } from '../lib/supabase.js';
import { attachSegmentedSlider } from '../lib/segmented-slider.js';
import { openAccountModal } from './account-modal.js';

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const TAG_COLORS = {
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#a855f7'
};

const svg = (body, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const ICONS = {
  file: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'),
  filePlus: svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="12" x2="12" y2="18"/><line x1="9" y1="15" x2="15" y2="15"/>'),
  folder: svg('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'),
  folderOpen: svg('<path d="M6 14l1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>'),
  folderPlus: svg('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>'),
  split: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>'),
  grid: svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>'),
  list: svg('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'),
  download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
  delete: svg('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  upload: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'),
  table: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/>'),
  code: svg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
  zip: svg('<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>'),
  chevronRight: svg('<polyline points="9 18 15 12 9 6"/>', 14),
  chevronLeft: svg('<polyline points="15 18 9 12 15 6"/>', 14),
  chevronDown: svg('<polyline points="6 9 12 15 18 9"/>', 14),
  arrowUp: svg('<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>'),
  sort: svg('<path d="M3 6h13"/><path d="M3 12h9"/><path d="M3 18h5"/><path d="M18 8v12"/><polyline points="15 17 18 20 21 17"/>'),
  plus: svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
  copy: svg('<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  scissors: svg('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>'),
  paste: svg('<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>'),
  info: svg('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'),
  eye: svg('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'),
  expand: svg('<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>'),
  external: svg('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>'),
  pencil: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>'),
  checkAll: svg('<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
  x: svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
  lock: svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', 12),
};

/* ---------------- Session state ----------------
   Kept at module level so leaving Files and coming back lands the person
   where they were. */

const STORAGE_FILES_VIEW_MODE = 'toolbox_files_view_mode';
const STORAGE_FILES_SORT = 'toolbox_files_sort';
const readPref = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const writePref = (key, value) => { try { localStorage.setItem(key, value); } catch {} };

const SORTS = [
  { value: 'name:asc', label: 'Name, A to Z' },
  { value: 'name:desc', label: 'Name, Z to A' },
  { value: 'modified:desc', label: 'Newest first' },
  { value: 'modified:asc', label: 'Oldest first' },
  { value: 'size:desc', label: 'Largest first' },
  { value: 'size:asc', label: 'Smallest first' },
  { value: 'kind:asc', label: 'Kind' },
];

let currentLayout = (() => {
  const saved = readPref(STORAGE_FILES_VIEW_MODE);
  return saved === 'split' || saved === 'grid' || saved === 'list' ? saved : 'split';
})();
let currentSort = (() => {
  const saved = readPref(STORAGE_FILES_SORT);
  return SORTS.some(s => s.value === saved) ? saved : 'name:asc';
})();
let currentContentView = 'formatted'; // 'formatted' | 'table' | 'raw'
let currentSearch = '';
let currentPath = '/Home';
let currentStorage = 'offline'; // 'offline' | 'online'
let currentTagFilter = null;
let selectedPaths = new Set();
let selectionAnchor = null; // Shift-click / Shift-arrow range origin
let cursorPath = null; // Item the keyboard is on
let autoSelectedFor = null; // Folder whose first file was selected for the preview
let lastClick = { path: null, at: 0 }; // Double-click detection across re-renders
let fileClipboard = { op: null, paths: [] }; // { op: 'copy'|'cut'|null, paths: string[] }

// Bodies and object URLs, keyed by path and invalidated when the file changes.
const textCache = new Map();
const blobUrlCache = new Map();
const docPreviewCache = new Map(); // path → { stamp, html } for documents rendered by lib/docs

/* ---------------- Formatting helpers ---------------- */

const size = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
};

function when(ts, { long = false } = {}) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const dayMs = 86400000;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (ts >= startOfToday) return `Today, ${time}`;
  if (ts >= startOfToday - dayMs) return `Yesterday, ${time}`;
  const date = d.toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric'
  });
  return long ? `${date}, ${time}` : date;
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const extOf = (name = '') => {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
};
const stampOf = (item) => `${item?.updatedAt || 0}:${item?.size ?? item?.bytes ?? 0}`;
const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || '');
const modKey = () => (isMac() ? '⌘' : 'Ctrl+');
const matches = (query) => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
const isNarrow = () => matches('(max-width: 720px)');
const isTouchOnly = () => matches('(hover: none) and (pointer: coarse)');

const KIND_LABELS = {
  folder: 'Folder', pdf: 'PDF document', spreadsheet: 'Spreadsheet', document: 'Document',
  presentation: 'Presentation', image: 'Image', json: 'JSON', code: 'Source code', audio: 'Audio',
  video: 'Video', archive: 'Archive', markdown: 'Markdown', text: 'Plain text', generic: 'File'
};

function kindOf(item) {
  if (!item) return '';
  if (item.isDirectory) return 'Folder';
  const category = detectFileCategory(item.name, item.kind);
  const ext = extOf(item.name);
  if (category === 'code' && ext) return `${ext.toUpperCase()} source`;
  if (category === 'image' && ext) return `${ext.toUpperCase()} image`;
  if (category === 'archive' && ext) return `${ext.toUpperCase()} archive`;
  return KIND_LABELS[category] || 'File';
}

/** How the preview pane can show a file. */
function previewTypeOf(file) {
  const ext = extOf(file?.name || '');
  const kind = file?.kind;
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'avif', 'ico'].includes(ext) || kind === 'image') return 'image';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'md' || ext === 'markdown' || kind === 'markdown') return 'markdown';
  if (ext === 'csv' || ext === 'tsv' || kind === 'csv') return 'csv';
  if (ext === 'json' || kind === 'json') return 'json';
  if (ext === 'pdf' || kind === 'pdf') return 'pdf';
  if (hasRichPreview(file?.name)) return 'document';
  if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)) return 'audio';
  if (['mp4', 'webm', 'mov', 'm4v'].includes(ext)) return 'video';
  if (['zip', 'gz', 'tar', 'bz2', '7z', 'rar', 'docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt', 'odt', 'woff', 'woff2', 'ttf', 'otf', 'exe', 'bin', 'dmg'].includes(ext) || kind === 'archive') return 'binary';
  return 'text';
}

const CONTENT_VIEWS = {
  html: [['formatted', 'Preview', ICONS.eye], ['raw', 'Source', ICONS.code]],
  markdown: [['formatted', 'Preview', ICONS.eye], ['raw', 'Source', ICONS.code]],
  json: [['formatted', 'Preview', ICONS.eye], ['raw', 'Source', ICONS.code]],
  csv: [['table', 'Table', ICONS.table], ['raw', 'Source', ICONS.code]],
};

function effectiveView(type) {
  const options = CONTENT_VIEWS[type];
  if (!options) return 'raw';
  return options.some(([key]) => key === currentContentView) ? currentContentView : options[0][0];
}

const sanitizeName = (name) => String(name ?? '').trim().replace(/[/\\?%*:|"<>]/g, '-');

/** "report.txt" -> "report 2.txt" until nothing in the folder has that name. */
function uniquePath(dir, name) {
  const taken = new Set(listDir(dir).map(i => i.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return normalizePath(`${dir}/${name}`);
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let n = 2; n < 1000; n++) {
    const candidate = `${stem} ${n}${ext}`;
    if (!taken.has(candidate.toLowerCase())) return normalizePath(`${dir}/${candidate}`);
  }
  return normalizePath(`${dir}/${stem} ${Date.now()}${ext}`);
}

/* ---------------- Reading the filesystem ---------------- */

function listDir(path) {
  try { return fs.listSync(path, { storage: currentStorage }); } catch { return []; }
}

/** Every item under root (not root itself), depth first. */
function walk(root) {
  const out = [];
  const seen = new Set([root]);
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const item of listDir(dir)) {
      if (seen.has(item.path)) continue;
      seen.add(item.path);
      out.push(item);
      if (item.isDirectory) stack.push(item.path);
    }
  }
  return out;
}

function sortItems(items) {
  const [key, dir] = currentSort.split(':');
  const sign = dir === 'desc' ? -1 : 1;
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  const compare = {
    name: byName,
    modified: (a, b) => (a.updatedAt || 0) - (b.updatedAt || 0),
    size: (a, b) => (a.size || 0) - (b.size || 0),
    kind: (a, b) => kindOf(a).localeCompare(kindOf(b)),
  }[key] || byName;
  return [...items].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return (compare(a, b) * sign) || byName(a, b);
  });
}

/** A record with its body attached when the body is already in memory. */
function withBody(item) {
  if (!item || item.isDirectory) return item;
  if (item.text != null) return item;
  const cached = textCache.get(item.path);
  if (cached && cached.stamp === stampOf(item)) return { ...item, text: cached.text };
  const art = item.id ? store.get(item.id) : null;
  if (art?.text != null) return { ...item, text: art.text };
  return item;
}

function folderLabel(path) {
  if (path === '/') return 'Files';
  return getBaseName(path) || 'Files';
}

/* ============================================================
   Mount
   ============================================================ */

/**
 * @param {HTMLElement} host
 * @param {string|null} selectedId  a path or artifact id to reveal and select
 * @returns {() => void} teardown
 */
export function renderSaved(host, selectedId = null) {
  let teardown = () => {};
  let unmounted = false;
  const state = { reveal: selectedId && selectedId !== 'none' ? selectedId : null };
  autoSelectedFor = null;

  if (selectedId === false || selectedId === 'none') selectedPaths.clear();

  if (currentStorage === 'online' && !getCurrentUser()) currentStorage = 'offline';

  const ui = { focusItem: false, keepSearchFocus: null };

  const refresh = (selectPath = null) => {
    if (unmounted) return;
    if (selectPath) {
      selectedPaths = new Set([selectPath]);
      selectionAnchor = selectPath;
      cursorPath = selectPath;
    }

    // Keep what the person was doing across the re-render: scroll offsets,
    // focus in the search box, keyboard focus on an item.
    const scrolls = {};
    host.querySelectorAll('[data-scroll-key]').forEach(el => { scrolls[el.dataset.scrollKey] = el.scrollTop; });
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    const search = host.querySelector('#sv-search-box');
    if (search && active === search) {
      ui.keepSearchFocus = [search.selectionStart ?? search.value.length, search.selectionEnd ?? search.value.length];
    }
    if (active && host.contains?.(active) && active.matches?.('[data-context-target]')) ui.focusItem = true;

    teardown();
    teardown = paint(host, state, refresh, ui);

    host.querySelectorAll('[data-scroll-key]').forEach(el => {
      if (scrolls[el.dataset.scrollKey] != null) el.scrollTop = scrolls[el.dataset.scrollKey];
    });
    if (ui.keepSearchFocus) {
      const box = host.querySelector('#sv-search-box');
      if (box) {
        box.focus();
        try { box.setSelectionRange(...ui.keepSearchFocus); } catch {}
      }
      ui.keepSearchFocus = null;
    } else if (ui.focusItem && cursorPath) {
      const el = [...host.querySelectorAll('[data-context-target]')].find(n => n.dataset.path === cursorPath);
      if (el) {
        el.focus?.({ preventScroll: true });
        el.scrollIntoView?.({ block: 'nearest' });
      }
    }
    ui.focusItem = false;
  };

  const authHandler = () => {
    if (unmounted) return;
    if (!getCurrentUser() && currentStorage === 'online') currentStorage = 'offline';
    refresh();
  };
  window.addEventListener('toolbox:authchange', authHandler);

  const unFs = fs.onChange(() => { if (!unmounted) refresh(); });

  refresh();

  fs.init().then(() => { if (!unmounted) refresh(); }).catch(() => {});

  return () => {
    unmounted = true;
    teardown();
    unFs();
    window.removeEventListener('toolbox:authchange', authHandler);
    selectedPaths.clear();
    for (const { url } of blobUrlCache.values()) { try { URL.revokeObjectURL(url); } catch {} }
    blobUrlCache.clear();
    docPreviewCache.clear();
    document.getElementById('sv-toast')?.remove();
    document.getElementById('sv-quicklook-modal')?.remove();
    document.getElementById('sv-properties-modal')?.remove();
    if (document.getElementById('toolbox-context-menu')) closeContextMenu();
  };
}

function paint(host, state, refresh, ui) {
  const user = getCurrentUser();
  if (currentStorage === 'online' && !user) currentStorage = 'offline';

  // A deep link (#files/<path or id>) opens the item's folder and selects it.
  const reveal = state.reveal;
  if (reveal) {
    const here = listDir(currentPath).find(i => i.path === reveal || i.id === reveal);
    const hit = here || fs.statSync(reveal);
    if (hit) {
      state.reveal = null;
      if (!here) currentPath = hit.isDirectory ? getParentPath(hit.path) : (hit.parentPath || getParentPath(hit.path));
      selectedPaths = new Set([hit.path]);
      selectionAnchor = cursorPath = hit.path;
    }
  }

  const inDir = listDir(currentPath);
  const q = currentSearch.toLowerCase();
  let items = q ? walk(currentPath).filter(i => i.name.toLowerCase().includes(q)) : inDir;
  if (currentTagFilter) items = items.filter(i => i.tags?.includes(currentTagFilter));
  items = sortItems(items);

  const byPath = new Map(items.map(i => [i.path, i]));

  // Selection only ever refers to things on screen.
  selectedPaths = new Set([...selectedPaths].filter(p => byPath.has(p)));

  // In the preview view the pane is the point, so land on the first file.
  // Only once per folder visit, so clearing the selection sticks.
  if (!selectedPaths.size && currentLayout === 'split' && !isNarrow() && autoSelectedFor !== currentPath) {
    const first = items.find(i => !i.isDirectory);
    autoSelectedFor = currentPath;
    if (first) {
      selectedPaths.add(first.path);
      selectionAnchor = cursorPath = first.path;
    }
  }

  const selItems = items.filter(i => selectedPaths.has(i.path));
  const single = selItems.length === 1 ? withBody(selItems[0]) : null;

  const ctx = { user, items, inDir, byPath, selItems, single };
  host.innerHTML = full(ctx);
  return wire(host, ctx, refresh, ui);
}

/* ============================================================
   Markup
   ============================================================ */

function full(ctx) {
  const { user, items, selItems } = ctx;
  const isOnline = currentStorage === 'online';
  const everything = walk('/');
  const totalBytes = everything.reduce((sum, i) => sum + (i.isDirectory ? 0 : (i.size || 0)), 0);
  const driveIsEmpty = !everything.some(i => !i.isDirectory) && !store.list().length;

  return `
    <div class="sv" data-layout="${currentLayout}">
      <header class="sv-top">
        <div class="sv-top-text">
          <h1 class="sv-title">Files</h1>
          <p class="sv-lede">${isOnline ? 'Synced to your account' : `${size(totalBytes)} stored in this browser`}</p>
        </div>
        <div class="sv-top-actions">
          ${renderStorageSwitch(user)}
          <button type="button" class="btn btn-secondary btn-sm sv-top-btn" data-act="new-folder" title="New folder" aria-label="New folder">${ICONS.folderPlus}<span class="sv-btn-label">New folder</span></button>
          <button type="button" class="btn btn-secondary btn-sm sv-top-btn" data-act="new-file" title="New file" aria-label="New file">${ICONS.filePlus}<span class="sv-btn-label">New file</span></button>
          <button type="button" class="btn btn-primary btn-sm sv-top-btn" data-act="upload" title="Upload files" aria-label="Upload files">${ICONS.upload}<span class="sv-btn-label">Upload</span></button>
        </div>
      </header>

      <section class="sv-window" aria-label="File browser">
        ${renderToolbar()}
        ${renderSubbar(items, selItems)}
        ${renderExplorerBody(ctx, driveIsEmpty)}
        ${renderStatus(items, selItems)}
      </section>
      ${storageNote()}
    </div>
  `;
}

function renderStorageSwitch(user) {
  const isOnline = currentStorage === 'online';
  return `
    <div class="sv-storage-switch" role="group" aria-label="Storage">
      <button type="button" class="sv-storage-btn ${!isOnline ? 'active' : ''}" data-storage="offline" aria-pressed="${!isOnline}" title="Files kept in this browser">Offline</button>
      <button type="button" class="sv-storage-btn ${isOnline ? 'active' : ''}" data-storage="online" aria-pressed="${isOnline}" title="${user ? 'Files synced to your account' : 'Sign in to use online storage'}">${user ? '' : `<span class="sv-lock">${ICONS.lock}</span>`}Online</button>
    </div>
  `;
}

function renderToolbar() {
  const segments = currentPath.split('/').filter(Boolean);
  const atRoot = currentPath === '/';
  const crumbs = [{ path: '/', label: 'Files' }].concat(
    segments.map((seg, i) => ({ path: '/' + segments.slice(0, i + 1).join('/'), label: seg }))
  );

  return `
    <div class="sv-head">
      <div class="sv-nav">
        <button type="button" class="sv-icon-btn" data-act="nav-up" title="Enclosing folder (Backspace)" aria-label="Go to enclosing folder" ${atRoot ? 'disabled' : ''}>${ICONS.arrowUp}</button>
        <nav class="sv-breadcrumbs" aria-label="Folder path">
          ${crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return `${i ? `<span class="sv-crumb-sep" aria-hidden="true">${ICONS.chevronRight}</span>` : ''}<button type="button" class="sv-crumb-btn ${last ? 'is-current' : ''}" data-nav-path="${escapeHtml(c.path)}" ${last ? 'aria-current="page"' : ''}>${escapeHtml(c.label)}</button>`;
          }).join('')}
        </nav>
      </div>
      <div class="sv-head-right">
        <div class="sv-search-wrap">
          <span class="sv-search-icon">${ICONS.search}</span>
          <input type="search" id="sv-search-box" class="sv-search-input" placeholder="Search ${escapeHtml(folderLabel(currentPath))}" aria-label="Search this folder and its subfolders" value="${escapeHtml(currentSearch)}" autocomplete="off" spellcheck="false">
          ${currentSearch ? `<button type="button" class="sv-search-clear" data-act="clear-search" title="Clear search" aria-label="Clear search">${ICONS.x}</button>` : ''}
        </div>
        <label class="sv-sort" title="Sort">
          ${ICONS.sort}
          <span class="visually-hidden">Sort by</span>
          <select id="sv-sort-select" aria-label="Sort by">
            ${SORTS.map(s => `<option value="${s.value}" ${s.value === currentSort ? 'selected' : ''}>${s.label}</option>`).join('')}
          </select>
        </label>
        <div class="sv-view-switcher" role="group" aria-label="View">
          ${[['split', 'Preview view', ICONS.split], ['grid', 'Icon view', ICONS.grid], ['list', 'List view', ICONS.list]].map(([key, label, icon]) => `
            <button type="button" class="sv-layout-btn ${currentLayout === key ? 'active' : ''}" data-layout="${key}" aria-pressed="${currentLayout === key}" title="${label}" aria-label="${label}">${icon}</button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderSubbar(items, selItems) {
  const n = selItems.length;
  const none = n === 0;
  const clip = fileClipboard.paths.length;
  const label = none
    ? (currentSearch ? plural(items.length, 'result') : plural(items.length, 'item'))
    : `${n} of ${items.length} selected`;

  return `
    <div class="sv-subbar">
      <div class="sv-tags-bar" role="group" aria-label="Filter by tag">
        <button type="button" class="sv-tag-pill sv-tag-all ${!currentTagFilter ? 'active' : ''}" data-filter-tag="all" aria-pressed="${!currentTagFilter}" title="Show all files">All</button>
        ${Object.entries(TAG_COLORS).map(([tag, color]) => `
          <button type="button" class="sv-tag-chip ${currentTagFilter === tag ? 'active' : ''}" data-filter-tag="${tag}" aria-pressed="${currentTagFilter === tag}" title="Only ${tag} tags" aria-label="Only files tagged ${tag}">
            <span class="sv-tag-chip-dot" style="background:${color};"></span>
          </button>
        `).join('')}
      </div>
      <div class="sv-selection">
        <span class="sv-sel-label" aria-live="polite">${label}</span>
        <div class="sv-sel-actions" role="toolbar" aria-label="Selection actions">
          <button type="button" class="sv-icon-btn sv-tb-btn" data-act="cut" title="Cut (${modKey()}X)" aria-label="Cut" ${none ? 'disabled' : ''}>${ICONS.scissors}</button>
          <button type="button" class="sv-icon-btn sv-tb-btn" data-act="copy" title="Copy (${modKey()}C)" aria-label="Copy" ${none ? 'disabled' : ''}>${ICONS.copy}</button>
          <button type="button" class="sv-icon-btn sv-tb-btn" data-act="paste" title="${clip ? `Paste ${plural(clip, 'item')} here (${modKey()}V)` : 'Nothing to paste'}" aria-label="Paste" ${clip ? '' : 'disabled'}>${ICONS.paste}${clip ? `<span class="sv-badge">${clip}</span>` : ''}</button>
          <button type="button" class="sv-icon-btn sv-tb-btn" data-act="multi-download" title="Download" aria-label="Download" ${none ? 'disabled' : ''}>${ICONS.download}</button>
          <button type="button" class="sv-icon-btn sv-tb-btn is-danger" data-act="delete-selected" title="Delete (Del)" aria-label="Delete" ${none ? 'disabled' : ''}>${ICONS.delete}</button>
          <span class="sv-divider" aria-hidden="true"></span>
          <button type="button" class="sv-icon-btn sv-tb-btn" data-act="select-all" title="Select all (${modKey()}A)" aria-label="Select all">${ICONS.checkAll}</button>
          <button type="button" class="sv-icon-btn sv-tb-btn" data-act="folder-properties" title="Folder info" aria-label="Folder info">${ICONS.info}</button>
        </div>
      </div>
    </div>
  `;
}

function renderStatus(items, selItems) {
  const clip = fileClipboard.paths.length;
  const folders = items.filter(i => i.isDirectory).length;
  const files = items.length - folders;
  const bytes = (selItems.length ? selItems : items).reduce((s, i) => s + (i.isDirectory ? 0 : (i.size || 0)), 0);
  const counts = [folders ? plural(folders, 'folder') : '', files ? plural(files, 'file') : ''].filter(Boolean).join(', ') || 'Empty';
  const hint = isTouchOnly()
    ? 'Tap to open, hold for more'
    : 'Double-click to open, Space to preview, right-click for more';

  return `
    <footer class="sv-status">
      <span class="sv-status-count">${counts}${bytes ? ` <span class="sv-status-dim">· ${size(bytes)}${selItems.length ? ' selected' : ''}</span>` : ''}</span>
      ${clip ? `
        <span class="sv-status-clip">
          ${plural(clip, 'item')} ${fileClipboard.op === 'cut' ? 'ready to move' : 'copied'}
          <button type="button" class="sv-link-btn" data-act="paste">Paste here</button>
          <button type="button" class="sv-link-btn is-quiet" data-act="clear-clipboard">Cancel</button>
        </span>
      ` : `<span class="sv-status-hint">${hint}</span>`}
    </footer>
  `;
}

function renderEmptyBody(ctx, driveIsEmpty) {
  if (currentSearch) {
    return `
      <div class="sv-body-empty" data-canvas="true">
        <div class="sv-empty-icon">${ICONS.search}</div>
        <h3>No results for "${escapeHtml(currentSearch)}"</h3>
        <p>Nothing in ${escapeHtml(folderLabel(currentPath))} or its subfolders matches${currentTagFilter ? ` with the ${escapeHtml(currentTagFilter)} tag` : ''}.</p>
        <button type="button" class="btn btn-secondary btn-sm" id="sv-clear-search">Clear search</button>
      </div>
    `;
  }
  if (currentTagFilter) {
    return `
      <div class="sv-body-empty" data-canvas="true">
        <div class="sv-empty-icon"><span class="sv-tag-chip-dot is-large" style="background:${TAG_COLORS[currentTagFilter]};"></span></div>
        <h3>Nothing tagged ${escapeHtml(currentTagFilter)} here</h3>
        <p>Right-click a file to tag it, or show everything in this folder.</p>
        <button type="button" class="btn btn-secondary btn-sm" data-filter-tag="all">Show all</button>
      </div>
    `;
  }
  const actions = `
    <div class="sv-empty-actions">
      <button type="button" class="btn btn-primary btn-sm" data-act="upload">${ICONS.upload}<span>Upload files</span></button>
      <button type="button" class="btn btn-secondary btn-sm" data-act="new-file">${ICONS.filePlus}<span>New file</span></button>
      <button type="button" class="btn btn-secondary btn-sm" data-act="new-folder">${ICONS.folderPlus}<span>New folder</span></button>
    </div>
  `;
  if (driveIsEmpty) {
    return `
      <div class="sv-body-empty sv-empty" data-canvas="true">
        <div class="sv-empty-icon">${ICONS.file}</div>
        <h3>Nothing saved yet</h3>
        <p>Tools that produce something, like a tidied document, converted data or a diagram, have a Save action. What you save lands here and stays in this browser. You can also drop files anywhere on this window.</p>
        ${actions}
        <a class="sv-link-btn" href="#tools">Browse tools</a>
      </div>
    `;
  }
  return `
    <div class="sv-body-empty" data-canvas="true">
      <div class="sv-empty-icon">${ICONS.folderOpen}</div>
      <h3>${escapeHtml(folderLabel(currentPath))} is empty</h3>
      <p>Drop files here, or create something new.</p>
      ${actions}
    </div>
  `;
}

function renderExplorerBody(ctx, driveIsEmpty) {
  const { items } = ctx;
  if (!items.length) {
    return `<div class="sv-body sv-body--empty">${renderEmptyBody(ctx, driveIsEmpty)}</div>`;
  }

  const listLabel = `Contents of ${escapeHtml(folderLabel(currentPath))}`;

  if (currentLayout === 'grid') {
    return `
      <div class="sv-body sv-fade-wrapper">
        <div class="sv-fade-scroll sv-grid-scroll" data-canvas="true" data-scroll-key="grid">
          <div class="sv-grid-view" data-canvas="true" role="listbox" aria-multiselectable="true" aria-label="${listLabel}">
            ${items.map(renderGridIcon).join('')}
          </div>
        </div>
        <div class="sv-fade-bottom"></div>
      </div>
    `;
  }

  if (currentLayout === 'list') {
    const [key, dir] = currentSort.split(':');
    const col = (k, label, cls) => `
      <button type="button" class="sv-col ${cls} ${key === k ? 'is-sorted' : ''}" data-sort="${k}" aria-label="Sort by ${label.toLowerCase()}">
        <span>${label}</span>${key === k ? `<span class="sv-sort-arrow ${dir}">${ICONS.chevronDown}</span>` : ''}
      </button>`;
    return `
      <div class="sv-body sv-fade-wrapper sv-list-pane">
        <div class="sv-list-head">
          ${col('name', 'Name', 'sv-col-name')}
          ${col('modified', 'Modified', 'sv-col-date')}
          ${col('size', 'Size', 'sv-col-size')}
          ${col('kind', 'Kind', 'sv-col-kind')}
        </div>
        <div class="sv-fade-scroll sv-list-scroll sv-list-view" data-canvas="true" data-scroll-key="list" role="listbox" aria-multiselectable="true" aria-label="${listLabel}">
          ${items.map(renderListRow).join('')}
        </div>
        <div class="sv-fade-bottom"></div>
      </div>
    `;
  }

  return `
    <div class="sv-body sv-split-view">
      <div class="sv-fade-wrapper sv-split-master-wrap">
        <div class="sv-fade-scroll sv-split-master" data-canvas="true" data-scroll-key="master" role="listbox" aria-multiselectable="true" aria-label="${listLabel}">
          ${items.map(renderSplitItem).join('')}
        </div>
        <div class="sv-fade-bottom"></div>
      </div>
      <div class="sv-fade-wrapper sv-detail-pane">
        <div class="sv-fade-scroll sv-detail-scroll" data-scroll-key="detail">
          ${renderDetail(ctx)}
        </div>
        <div class="sv-fade-bottom"></div>
      </div>
    </div>
  `;
}

function itemAttrs(item) {
  const selected = selectedPaths.has(item.path);
  const isCut = fileClipboard.op === 'cut' && fileClipboard.paths.includes(item.path);
  return `class="__CLS__ sv-item ${selected ? 'is-selected' : ''} ${isCut ? 'is-cut' : ''}"
    data-context-target="true" data-path="${escapeHtml(item.path)}" data-is-dir="${item.isDirectory ? 'true' : 'false'}"
    draggable="true" role="option" aria-selected="${selected}" tabindex="${item.path === cursorPath ? '0' : '-1'}"`;
}

function renderTagDots(tags = []) {
  if (!tags?.length) return '';
  return `<span class="sv-tags-dots" aria-label="Tags: ${escapeHtml(tags.join(', '))}">${tags.map(t => `<span class="sv-tag-dot" style="background:${TAG_COLORS[t] || 'var(--text-3)'};" title="${escapeHtml(t)}"></span>`).join('')}</span>`;
}

function itemMeta(item) {
  if (item.isDirectory) return plural(listDir(item.path).length, 'item');
  return size(item.size || 0);
}

function locationOf(item) {
  const parent = item.parentPath || getParentPath(item.path);
  if (parent === currentPath) return '';
  const rel = parent.startsWith(currentPath + '/') ? parent.slice(currentPath.length + 1) : parent.replace(/^\//, '');
  return rel.split('/').join(' / ');
}

function isImageName(name) { return /\.(png|jpe?g|webp|gif|svg|bmp|avif)$/i.test(name || ''); }

function renderGridIcon(item) {
  const loc = currentSearch ? locationOf(item) : '';
  const thumb = !item.isDirectory && isImageName(item.name)
    ? `<img class="sv-thumb-img" alt="" data-thumb-path="${escapeHtml(item.path)}" hidden>`
    : '';
  return `
    <div ${itemAttrs(item).replace('__CLS__', 'sv-grid-icon')} title="${escapeHtml(item.name)}">
      <div class="sv-grid-thumb">${thumb}<span class="sv-grid-glyph">${getFileTypeIcon(item.name, item.isDirectory ? 'folder' : item.kind, 36)}</span></div>
      <div class="sv-grid-name">${escapeHtml(item.name)}</div>
      <div class="sv-grid-meta">${loc ? escapeHtml(loc) : itemMeta(item)}</div>
      ${renderTagDots(item.tags)}
    </div>
  `;
}

function renderListRow(item) {
  const loc = currentSearch ? locationOf(item) : '';
  return `
    <div ${itemAttrs(item).replace('__CLS__', 'sv-row')}>
      <div class="sv-cell sv-col-name">
        <span class="sv-item-icon">${getFileTypeIcon(item.name, item.isDirectory ? 'folder' : item.kind, 18)}</span>
        <span class="sv-item-text">
          <span class="sv-item-name">${escapeHtml(item.name)}</span>
          ${loc ? `<span class="sv-item-loc">in ${escapeHtml(loc)}</span>` : ''}
        </span>
        ${renderTagDots(item.tags)}
      </div>
      <div class="sv-cell sv-col-date">${item.updatedAt ? when(item.updatedAt) : ''}</div>
      <div class="sv-cell sv-col-size">${item.isDirectory ? itemMeta(item) : size(item.size || 0)}</div>
      <div class="sv-cell sv-col-kind">${kindOf(item)}</div>
    </div>
  `;
}

function renderSplitItem(item) {
  const loc = currentSearch ? locationOf(item) : '';
  const meta = [loc ? `in ${loc}` : itemMeta(item), !item.isDirectory && item.updatedAt ? when(item.updatedAt) : ''].filter(Boolean).join(' · ');
  return `
    <div ${itemAttrs(item).replace('__CLS__', 'sv-split-item')}>
      <span class="sv-item-icon">${getFileTypeIcon(item.name, item.isDirectory ? 'folder' : item.kind, 18)}</span>
      <span class="sv-item-text">
        <span class="sv-item-name">${escapeHtml(item.name)}</span>
        <span class="sv-item-meta">${escapeHtml(meta)}</span>
      </span>
      ${renderTagDots(item.tags)}
      ${item.isDirectory ? `<button type="button" class="sv-row-open" data-act="open-folder" data-path="${escapeHtml(item.path)}" title="Open folder" aria-label="Open ${escapeHtml(item.name)}">${ICONS.chevronRight}</button>` : ''}
    </div>
  `;
}

/**
 * Resolves available tools for opening a file dynamically based on its extension, kind, and registry capabilities.
 * @param {object} file
 * @returns {import('../registry/schema.js').Tool[]}
 */
export function getToolsForFile(file) {
  if (!file) return [];
  const fileName = (file.name || '').toLowerCase();
  const ext = fileName.includes('.') ? fileName.split('.').pop() : '';
  const kind = file.kind || kindFromFilename(fileName);

  const seen = new Set();
  const result = [];
  const user = getCurrentUser();
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  const add = (toolOrId) => {
    if (!toolOrId) return;
    const tool = typeof toolOrId === 'string' ? BY_ID.get(toolOrId) : toolOrId;
    if (tool && tool.id && !seen.has(tool.id)) {
      if (!user && tool.id === 'assistant') return;
      if (!user && isMobile && tool.id === 'code-playground') return;
      if (user && tool.id === 'file-drop') return;
      seen.add(tool.id);
      result.push(tool);
    }
  };

  // 0. The document editor for this format leads, except for markdown and
  //    plain text, where the text tools people already use stay first.
  const editor = editorFor(fileName);
  if (editor && editor !== 'pdf-editor' && !['md', 'markdown', 'txt'].includes(ext)) add(editor);

  // 1. Domain-specific prioritization based on file extension and detected kind
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp', 'avif'].includes(ext) || kind === 'image') {
    ['image-compressor', 'image-converter', 'image-resizer', 'image-cropper', 'image-metadata', 'image-to-pdf'].forEach(add);
  } else if (ext === 'pdf' || kind === 'pdf') {
    ['pdf-editor', 'pdf-merge', 'pdf-split', 'legal-pdf'].forEach(add);
  } else if (ext === 'csv' || ext === 'tsv' || kind === 'csv') {
    ['csv-to-json', 'sort-lines', 'remove-duplicates', 'find-replace', 'text-diff', 'word-counter'].forEach(add);
  } else if (ext === 'md' || ext === 'markdown' || kind === 'markdown') {
    ['markdown-preview', 'word-counter', 'pdf-editor', 'code-playground', 'find-replace', 'text-diff', 'document-analyzer'].forEach(add);
  } else if (ext === 'json' || kind === 'json') {
    ['json-formatter', 'code-playground', 'find-replace', 'text-diff', 'invoice-generator'].forEach(add);
  } else if (['js', 'ts', 'jsx', 'tsx', 'py', 'cpp', 'c', 'h', 'cs', 'java', 'go', 'rs', 'php', 'rb', 'html', 'css', 'sql', 'sh', 'bash'].includes(ext) || kind === 'code') {
    ['code-playground', 'find-replace', 'case-converter', 'text-diff', 'word-counter'].forEach(add);
    if (ext === 'html') add('html-entity-codec');
  } else if (['zip', 'tar', 'gz', 'bz2'].includes(ext) || kind === 'archive') {
    ['file-decompressor', 'file-compressor'].forEach(add);
  } else if (['txt', 'rtf', 'log'].includes(ext) || kind === 'text') {
    ['find-replace', 'text-cleaner', 'word-counter', 'document-analyzer'].forEach(add);
  }
  if (editor && editor !== 'pdf-editor') add(editor);

  // 2. Include all registry tools that accept this kind
  for (const t of toolsAccepting(kind)) {
    add(t);
  }

  // 3. Fallback for general text documents
  if (result.length === 0) {
    ['word-counter', 'find-replace', 'text-cleaner', 'code-playground'].forEach(add);
  }

  return result;
}

function renderDetail(ctx) {
  const { selItems, single } = ctx;

  if (selItems.length > 1) {
    const bytes = selItems.reduce((s, i) => s + (i.isDirectory ? 0 : (i.size || 0)), 0);
    return `
      <div class="sv-detail-empty">
        <div class="sv-stack" aria-hidden="true">${selItems.slice(0, 3).map(i => `<span>${getFileTypeIcon(i.name, i.isDirectory ? 'folder' : i.kind, 28)}</span>`).join('')}</div>
        <h3>${selItems.length} items selected</h3>
        <p>${size(bytes)} in total</p>
        <div class="sv-detail-empty-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-act="multi-download">${ICONS.download}<span>Download ZIP</span></button>
          <button type="button" class="btn btn-secondary btn-sm" data-act="multi-properties">${ICONS.info}<span>Get info</span></button>
          <button type="button" class="btn btn-ghost btn-sm" data-act="clear-selection">Clear selection</button>
        </div>
      </div>
    `;
  }

  if (single?.isDirectory) {
    return `
      <div class="sv-detail-empty">
        <div class="sv-empty-icon is-large">${getFileTypeIcon(single.name, 'folder', 36)}</div>
        <h3>${escapeHtml(single.name)}</h3>
        <p>${itemMeta(single)}${single.updatedAt ? ` · Modified ${when(single.updatedAt)}` : ''}</p>
        <div class="sv-detail-empty-actions">
          <button type="button" class="btn btn-primary btn-sm" data-act="open-folder" data-path="${escapeHtml(single.path)}">${ICONS.folderOpen}<span>Open folder</span></button>
          <button type="button" class="btn btn-secondary btn-sm" data-act="multi-properties">${ICONS.info}<span>Get info</span></button>
        </div>
      </div>
    `;
  }

  if (single) return renderDetailPane(single);

  return `
    <div class="sv-detail-empty">
      <div class="sv-empty-icon">${ICONS.eye}</div>
      <h3>Nothing selected</h3>
      <p>Select a file to preview it here.</p>
    </div>
  `;
}

function renderDetailPane(selected) {
  const type = previewTypeOf(selected);
  const views = CONTENT_VIEWS[type];
  const view = effectiveView(type);
  const tools = getToolsForFile(selected);
  const top = tools[0];
  const isZip = extOf(selected.name) === 'zip' || selected.kind === 'archive';
  const meta = [kindOf(selected), size(selected.size ?? selected.bytes ?? 0), selected.updatedAt ? `Modified ${when(selected.updatedAt, { long: true })}` : ''].filter(Boolean);

  return `
    <div class="sv-detail">
      <div class="sv-detail-head">
        <div class="sv-detail-icon">${getFileTypeIcon(selected.name, selected.kind, 28)}</div>
        <div class="sv-detail-title">
          <input type="text" class="sv-rename" value="${escapeHtml(selected.name)}" data-path="${escapeHtml(selected.path || '')}" aria-label="File name" title="Click to rename" spellcheck="false" autocomplete="off">
          <div class="sv-detail-meta">${meta.map(escapeHtml).join('<span aria-hidden="true"> · </span>')}${renderTagDots(selected.tags)}</div>
        </div>
      </div>

      <div class="sv-detail-bar">
        ${views ? `
          <div class="sv-content-view-switcher" role="group" aria-label="Show as">
            ${views.map(([key, label, icon]) => `<button type="button" class="sv-cview-btn ${view === key ? 'active' : ''}" data-cview="${key}" aria-pressed="${view === key}" title="${label}">${icon}<span>${label}</span></button>`).join('')}
          </div>
        ` : '<span></span>'}
        <div class="sv-detail-actions">
          <button type="button" class="sv-icon-btn" data-act="quicklook" title="Quick Look (Space)" aria-label="Quick Look preview">${ICONS.expand}</button>
          ${isZip ? `<button type="button" class="sv-icon-btn" data-act="extract-archive" data-file-path="${escapeHtml(selected.path)}" title="Extract here" aria-label="Extract archive">${ICONS.zip}</button>` : ''}
          ${top ? `
            <div class="sv-open-split">
              <button type="button" class="sv-open-primary sv-open-btn" data-open="${escapeHtml(top.id)}" title="Open in ${escapeHtml(top.name)} (Enter)">${ICONS.external}<span>Open in ${escapeHtml(top.name)}</span></button>
              <div class="sv-open-dropdown-wrap">
                <button type="button" class="sv-open-dropdown-toggle" id="sv-open-dropdown-toggle" aria-haspopup="true" aria-expanded="false" title="Open with another tool" aria-label="Open with another tool">${ICONS.chevronDown}</button>
                <div id="sv-open-dropdown-menu" class="sv-open-dropdown-menu" role="menu" hidden>
                  <div class="sv-open-menu-title">Open with</div>
                  <div class="sv-open-menu-list">
                    ${tools.map(t => `
                      <button type="button" class="sv-open-btn sv-open-menu-item" role="menuitem" data-open="${escapeHtml(t.id)}" title="${escapeHtml(t.description || t.name)}">
                        <span class="sv-open-menu-icon">${t.icon || ICONS.file}</span>
                        <span class="sv-open-menu-text">
                          <strong>${escapeHtml(t.name)}</strong>
                          <span>${escapeHtml(t.description || '')}</span>
                        </span>
                      </button>
                    `).join('')}
                  </div>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="sv-preview" data-preview-type="${type}">
        ${renderContentBody(selected, type, view)}
      </div>
    </div>
  `;
}

function renderContentBody(file, type = previewTypeOf(file), view = effectiveView(type)) {
  const text = typeof file.text === 'string' ? file.text : (typeof file.content === 'string' && !file.content.startsWith('data:') ? file.content : null);
  const src = blobUrlCache.get(file.path)?.url || (typeof file.content === 'string' && file.content.startsWith('data:') ? file.content : file.dataUrl || '');

  if (type === 'image') {
    return `<div class="sv-media">${src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(file.name)}">` : '<span class="sv-loading">Loading preview</span>'}</div>`;
  }
  if (type === 'pdf') {
    return src
      ? `<iframe class="sv-frame sv-pdf-frame" src="${escapeHtml(src)}" title="${escapeHtml(file.name)}"></iframe>`
      : '<div class="sv-media"><span class="sv-loading">Loading preview</span></div>';
  }
  if (type === 'audio' || type === 'video') {
    if (!src) return '<div class="sv-media"><span class="sv-loading">Loading preview</span></div>';
    return `<div class="sv-media">${type === 'audio' ? `<audio controls src="${escapeHtml(src)}"></audio>` : `<video controls src="${escapeHtml(src)}"></video>`}</div>`;
  }
  if (type === 'document') {
    const cached = docPreviewCache.get(file.path);
    if (!cached || cached.stamp !== stampOf(file)) return '<div class="sv-media"><span class="sv-loading">Loading preview</span></div>';
    // No scripts, no same-origin, and the page itself forbids network access.
    return `<iframe class="sv-frame sv-doc-frame" sandbox="" referrerpolicy="no-referrer" srcdoc="${escapeHtml(cached.html)}" title="${escapeHtml(file.name)}"></iframe>`;
  }
  if (type === 'binary') {
    return `
      <div class="sv-no-preview">
        ${getFileTypeIcon(file.name, file.kind, 40)}
        <p>There's no preview for ${escapeHtml(kindOf(file).toLowerCase())} files.</p>
        <span>Open it in a tool, or download it.</span>
      </div>
    `;
  }

  if (text == null) return '<div class="sv-media"><span class="sv-loading">Loading preview</span></div>';
  if (!text.length) return '<div class="sv-no-preview"><p>This file is empty.</p></div>';

  if (view === 'raw') return `<pre class="sv-code">${escapeHtml(text)}</pre>`;
  if (type === 'csv') return renderCsvTable(text, extOf(file.name) === 'tsv' ? '\t' : ',');
  if (type === 'html') {
    // Scripts may run, but never with this page's origin.
    return `<iframe class="sv-frame" srcdoc="${escapeHtml(text)}" sandbox="allow-scripts" title="${escapeHtml(file.name)}"></iframe>`;
  }
  if (type === 'markdown') return `<div class="sv-md">${renderMarkdown(text)}</div>`;
  if (type === 'json') {
    try { return `<pre class="sv-code">${escapeHtml(JSON.stringify(JSON.parse(text), null, 2))}</pre>`; } catch {}
  }
  return `<pre class="sv-code">${escapeHtml(text)}</pre>`;
}

/** Minimal RFC 4180 parse: quoted fields, escaped quotes, embedded newlines. */
function parseDelimited(text, sep = ',') {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

function renderCsvTable(csvText, sep = ',') {
  const lines = parseDelimited(String(csvText || ''), sep);
  if (!lines.length) return '<div class="sv-no-preview"><p>This table is empty.</p></div>';
  const headers = lines[0];
  const totalRows = lines.length - 1;
  const rowLimit = 500;
  const rows = lines.slice(1, 1 + rowLimit);
  const numeric = headers.map((_, c) => rows.length > 0 && rows.every(r => r[c] == null || r[c].trim() === '' || !isNaN(Number(r[c].replace(/[,$%]/g, '')))));

  return `
    <div class="sv-table-wrap">
      <table class="sv-table">
        <thead><tr>${headers.map((h, c) => `<th class="${numeric[c] ? 'is-num' : ''}">${escapeHtml(h.trim())}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map(r => `<tr>${headers.map((_, c) => `<td class="${numeric[c] ? 'is-num' : ''}">${escapeHtml((r[c] ?? '').trim())}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>
    <p class="sv-table-note">${totalRows > rowLimit ? `Showing ${rowLimit} of ${totalRows} rows` : plural(totalRows, 'row')}, ${plural(headers.length, 'column')}</p>
  `;
}

/** Small, safe Markdown: input is escaped first, then block and inline rules. */
function renderMarkdown(md) {
  const inline = (s) => s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  const lines = escapeHtml(String(md).replace(/\r\n?/g, '\n')).split('\n');
  const out = [];
  let para = [];
  let list = null;
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map(i => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flushPara(); flushList();
      const body = [];
      while (++i < lines.length && !/^```/.test(lines[i])) body.push(lines[i]);
      out.push(`<pre><code>${body.join('\n')}</code></pre>`);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) { flushPara(); flushList(); out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flushPara(); flushList(); out.push('<hr>'); continue; }
    const quote = line.match(/^&gt;\s?(.*)$/);
    if (quote) { flushPara(); flushList(); out.push(`<blockquote>${inline(quote[1])}</blockquote>`); continue; }
    const bullet = line.match(/^\s*[-*+]\s+(.*)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      flushPara();
      const tag = bullet ? 'ul' : 'ol';
      if (list && list.tag !== tag) flushList();
      if (!list) list = { tag, items: [] };
      list.items.push((bullet || numbered)[1]);
      continue;
    }
    if (!line.trim()) { flushPara(); flushList(); continue; }
    flushList();
    para.push(line.trim());
  }
  flushPara(); flushList();
  return out.join('\n');
}

function storageNote() {
  return store.persistent
    ? ''
    : `<p class="sv-note is-warn">Private browsing is on, so files only last for this session. Download anything you want to keep.</p>`;
}

/* ============================================================
   Toast
   ============================================================ */

let toastTimer = null;
function toast(message, tone = 'good') {
  let el = document.getElementById('sv-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sv-toast';
    el.className = 'sv-flash sv-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.dataset.tone = tone;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3200);
}

/* ============================================================
   Event wiring
   ============================================================ */

function wire(host, ctx, refresh, ui) {
  const { items, byPath, single } = ctx;
  const current = single && !single.isDirectory ? single : null;
  const flash = toast;
  const cleanups = [];
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };

  const uploader = document.createElement('input');
  uploader.type = 'file';
  uploader.multiple = true;
  uploader.hidden = true;
  host.appendChild(uploader);

  const lookup = (path) => byPath.get(path) || fs.statSync(path);
  const selection = () => [...selectedPaths];
  const itemEls = () => [...host.querySelectorAll('[data-context-target]')];

  /* ---------- Loading bodies and object URLs for the preview ---------- */

  const loadBlobUrl = async (item) => {
    const cached = blobUrlCache.get(item.path);
    if (cached && cached.stamp === stampOf(item)) return cached.url;
    const blob = await fs.readFile(item.path, { encoding: 'blob', storage: currentStorage });
    if (!blob) return null;
    if (cached) { try { URL.revokeObjectURL(cached.url); } catch {} }
    const url = URL.createObjectURL(blob);
    blobUrlCache.set(item.path, { stamp: stampOf(item), url });
    return url;
  };

  const loadText = async (item) => {
    const cached = textCache.get(item.path);
    if (cached && cached.stamp === stampOf(item)) return cached.text;
    let text = null;
    try { text = fs.readFileSync?.(item.path, { encoding: 'utf8' }); } catch {}
    if (text == null) {
      try { text = await fs.readFile(item.path, { encoding: 'utf8', storage: currentStorage }); } catch {}
    }
    if (text == null && item.id) text = store.get(item.id)?.text ?? null;
    if (text != null) textCache.set(item.path, { stamp: stampOf(item), text });
    return text;
  };

  const loadDocPreview = async (item) => {
    const cached = docPreviewCache.get(item.path);
    if (cached && cached.stamp === stampOf(item)) return cached.html;
    const { renderPreview, errorPage } = await import('../lib/docs/preview.js');
    let html;
    try {
      const blob = await fs.readFile(item.path, { encoding: 'blob', storage: currentStorage });
      if (!blob) throw new Error('empty');
      html = await renderPreview(blob, item.name);
    } catch (err) {
      console.warn('Document preview failed', err);
      html = errorPage("This file couldn't be read. It may be damaged, password-protected, or not really the format its name says.");
    }
    if (docPreviewCache.size > 24) docPreviewCache.delete(docPreviewCache.keys().next().value);
    docPreviewCache.set(item.path, { stamp: stampOf(item), html });
    return html;
  };

  if (current?.path) {
    const type = previewTypeOf(current);
    const paintPreview = (patch) => {
      const pane = host.querySelector('.sv-preview');
      if (pane && pane.isConnected !== false) {
        Object.assign(current, patch);
        pane.innerHTML = renderContentBody(current, type, effectiveView(type));
      }
    };
    if (['image', 'pdf', 'audio', 'video'].includes(type)) {
      if (!blobUrlCache.get(current.path) || blobUrlCache.get(current.path).stamp !== stampOf(current)) {
        loadBlobUrl(current).then(url => url && paintPreview({})).catch(() => {});
      }
    } else if (type === 'document') {
      const cached = docPreviewCache.get(current.path);
      if (!cached || cached.stamp !== stampOf(current)) loadDocPreview(current).then(() => paintPreview({})).catch(() => {});
    } else if (type !== 'binary' && current.text == null) {
      loadText(current).then(text => paintPreview({ text: text ?? '' })).catch(() => paintPreview({ text: '' }));
    }
  }

  // Thumbnails in the icon view.
  host.querySelectorAll('img[data-thumb-path]').forEach((img, i) => {
    if (i > 80) return;
    const item = byPath.get(img.dataset.thumbPath);
    if (!item) return;
    loadBlobUrl(item).then(url => {
      if (!url || !img.isConnected) return;
      img.onload = () => { img.hidden = false; img.closest('.sv-grid-thumb')?.classList.add('has-thumb'); };
      img.src = url;
    }).catch(() => {});
  });

  /* ---------- Operations ---------- */

  function openFileInTool(fileOrPath, toolId) {
    if (!fileOrPath || !toolId) return;
    let fileObj = typeof fileOrPath === 'string' ? lookup(fileOrPath) : fileOrPath;
    if (!fileObj && typeof fileOrPath === 'string') {
      fileObj = store.get(fileOrPath) || { path: fileOrPath, name: getBaseName(fileOrPath) };
    }
    fileObj = withBody(fileObj);

    const path = fileObj.path;
    const name = fileObj.name || getBaseName(path);
    const text = typeof fileObj.text === 'string' ? fileObj.text : (typeof fileObj.content === 'string' ? fileObj.content : '');
    const handoff = {
      id: fileObj.id || path,
      name,
      path,
      kind: fileObj.kind || kindFromFilename(name),
      text,
      content: text || fileObj.blob || null,
      blob: fileObj.blob || null,
      storage: currentStorage,
      from: 'files'
    };
    store.handOff(handoff);

    // Fill in the body if it wasn't in memory; the tool reads the hand-off
    // object, which is the same reference.
    if (path && !text && !handoff.blob) {
      // Editors read documents as bytes, including the text-based ones they parse.
      const binary = ['image', 'pdf', 'binary', 'audio', 'video', 'document'].includes(previewTypeOf(fileObj)) || (docFamily(name) && ['scribe', 'ledger', 'podium'].includes(toolId));
      fs.readFile(path, { encoding: binary ? 'blob' : 'utf8', storage: currentStorage }).then(body => {
        if (!body) return;
        if (binary) { handoff.blob = body; handoff.content = body; }
        else { handoff.text = body; handoff.content = body; }
      }).catch(() => {});
    }

    if (window.location.hash === `#${toolId}`) window.dispatchEvent(new HashChangeEvent('hashchange'));
    else window.location.hash = `#${toolId}`;
  }

  function openItem(path) {
    const item = lookup(path);
    if (!item) return;
    if (item.isDirectory) return navigate(item.path);
    const top = getToolsForFile(item)[0];
    if (top) openFileInTool(item, top.id);
    else openQuickLook(item.path);
  }

  function navigate(path) {
    currentPath = path || '/Home';
    currentSearch = '';
    selectedPaths.clear();
    selectionAnchor = cursorPath = null;
    autoSelectedFor = null;
    if (/^#(files|saved)\//.test(window.location.hash || '')) history.replaceState(null, '', '#files');
    refresh();
  }

  function setClipboard(op) {
    const paths = selection();
    if (!paths.length) return;
    fileClipboard = { op, paths };
    flash(`${op === 'cut' ? 'Cut' : 'Copied'} ${plural(paths.length, 'item')}. Open a folder and paste.`);
    refresh();
  }

  async function executePaste(targetDir) {
    if (!fileClipboard.paths.length || !fileClipboard.op) return;
    const isCut = fileClipboard.op === 'cut';
    const pasted = [];
    let skipped = 0;
    for (const src of fileClipboard.paths) {
      try {
        if (targetDir === src || targetDir.startsWith(src + '/')) { skipped++; continue; }
        const name = getBaseName(src);
        if (isCut && getParentPath(src) === targetDir) continue;
        let dest = uniquePath(targetDir, name);
        if (!isCut && getParentPath(src) === targetDir) {
          const dot = name.lastIndexOf('.');
          dest = uniquePath(targetDir, dot > 0 ? `${name.slice(0, dot)} copy${name.slice(dot)}` : `${name} copy`);
        }
        if (isCut) await fs.rename(src, dest);
        else await fs.copy(src, dest);
        pasted.push(dest);
      } catch (err) {
        console.warn('Paste error:', err);
        skipped++;
      }
    }
    if (isCut) fileClipboard = { op: null, paths: [] };
    selectedPaths = new Set(pasted);
    cursorPath = pasted[0] || null;
    flash(pasted.length
      ? `${isCut ? 'Moved' : 'Pasted'} ${plural(pasted.length, 'item')}${skipped ? `, skipped ${skipped}` : ''}.`
      : 'Nothing was pasted. A folder can\'t go inside itself.', pasted.length ? 'good' : 'bad');
    refresh();
  }

  async function removePath(path) {
    const item = lookup(path);
    const removed = await fs.delete(path);
    if (!removed && item?.id && store.get(item.id)) store.remove(item.id);
  }

  async function executeDelete(paths) {
    if (!paths?.length) return;
    const first = lookup(paths[0]);
    const name = `"${getBaseName(paths[0])}"`;
    const msg = paths.length > 1
      ? `Delete ${paths.length} items? This can't be undone.`
      : (first?.isDirectory ? `Delete the folder ${name} and everything in it? This can't be undone.` : `Delete ${name}? This can't be undone.`);
    if (!(await tbConfirm(msg, { title: paths.length === 1 ? 'Delete item' : 'Delete items', destructive: true, confirmText: 'Delete' }))) return;
    let deleted = 0;
    for (const p of paths) {
      try {
        await removePath(p);
        deleted++;
        selectedPaths.delete(p);
        textCache.delete(p);
      } catch (err) {
        flash(err.message, 'bad');
      }
    }
    if (deleted) flash(`Deleted ${plural(deleted, 'item')}.`);
    if (/^#(files|saved)\//.test(window.location.hash || '')) history.replaceState(null, '', '#files');
    refresh();
  }

  async function renamePath(path, rawName) {
    const item = lookup(path);
    const clean = sanitizeName(rawName);
    if (!item || !clean || clean === item.name) return false;
    const dest = normalizePath(`${getParentPath(path)}/${clean}`);
    const clash = listDir(getParentPath(path)).find(i => i.name.toLowerCase() === clean.toLowerCase() && i.path !== path);
    if (clash) {
      flash(`There's already an item named "${clean}" in this folder.`, 'bad');
      return false;
    }
    try {
      if (fs.statSync(path)?.path === path) await fs.rename(path, dest);
      else if (item.id && store.get(item.id)) store.rename(item.id, clean);
      textCache.delete(path);
      flash(`Renamed to "${clean}".`);
      if (/^#(files|saved)\//.test(window.location.hash || '')) history.replaceState(null, '', `#files/${encodeURIComponent(dest)}`);
      refresh(item.id && !fs.statSync(dest) ? null : dest);
      return true;
    } catch (err) {
      flash(err.message, 'bad');
      return false;
    }
  }

  async function startRename(path) {
    const inline = host.querySelector('.sv-rename');
    if (inline && inline.dataset.path === path) {
      inline.focus();
      selectStem(inline);
      return;
    }
    const name = getBaseName(path);
    const next = await tbPrompt('New name', name, { title: 'Rename', confirmText: 'Rename' });
    if (next != null) await renamePath(path, next);
  }

  function selectStem(input) {
    const dot = input.value.lastIndexOf('.');
    try { input.setSelectionRange(0, dot > 0 ? dot : input.value.length); } catch {}
  }

  async function createFolder() {
    const name = await tbPrompt('Folder name', 'Untitled folder', { title: 'New folder', confirmText: 'Create' });
    const clean = sanitizeName(name);
    if (!clean) return;
    const target = uniquePath(currentPath, clean);
    try {
      await fs.mkdir(target, { storage: currentStorage });
      flash(`Created "${getBaseName(target)}".`);
      refresh(target);
    } catch (err) {
      flash(err.message, 'bad');
    }
  }

  async function createFile() {
    const name = await tbPrompt('File name, with an extension such as .txt or .md', 'Untitled.txt', { title: 'New file', confirmText: 'Create' });
    let clean = sanitizeName(name);
    if (!clean) return;
    if (!clean.includes('.')) clean += '.txt';
    const target = uniquePath(currentPath, clean);
    try {
      await fs.writeFile(target, '', { storage: currentStorage });
      flash(`Created "${getBaseName(target)}".`);
      refresh(target);
    } catch (err) {
      flash(err.message, 'bad');
    }
  }

  async function saveUploads(files, destDir = currentPath) {
    const added = [];
    for (const f of files) {
      try {
        const dest = uniquePath(destDir, f.name);
        await fs.writeFile(dest, f, { mimeType: f.type || 'application/octet-stream', storage: currentStorage });
        added.push(dest);
      } catch (err) {
        console.warn(`Failed to save ${f.name}:`, err);
      }
    }
    if (added.length) {
      const failed = files.length - added.length;
      flash(`Added ${plural(added.length, 'file')} to ${folderLabel(destDir)}${failed ? `, ${failed} failed` : ''}.`, failed ? 'bad' : 'good');
      if (destDir === currentPath) {
        selectedPaths = new Set(added);
        cursorPath = added[0];
      }
      refresh();
    } else if (files.length) {
      flash('Those files could not be added.', 'bad');
    }
  }

  async function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function downloadPaths(paths) {
    if (!paths?.length) return;
    try {
      if (paths.length === 1 && !lookup(paths[0])?.isDirectory) {
        const item = lookup(paths[0]);
        let blob;
        try { blob = await fs.readFile(paths[0], { encoding: 'blob', storage: currentStorage }); }
        catch {
          const text = withBody(item)?.text;
          if (text == null) throw new Error('File not found');
          blob = new Blob([text], { type: 'text/plain' });
        }
        await downloadBlob(blob, getBaseName(paths[0]));
        flash(`Downloaded "${getBaseName(paths[0])}".`);
        return;
      }
      const entries = [];
      const addDir = async (dir, prefix) => {
        for (const c of listDir(dir)) {
          if (c.isDirectory) await addDir(c.path, `${prefix}${c.name}/`);
          else entries.push({ path: `${prefix}${c.name}`, data: await fs.readFile(c.path, { encoding: 'binary' }) });
        }
      };
      for (const p of paths) {
        const item = lookup(p);
        if (item?.isDirectory) await addDir(p, `${item.name}/`);
        else entries.push({ path: getBaseName(p), data: await fs.readFile(p, { encoding: 'binary' }) });
      }
      if (!entries.length) {
        flash('There\'s nothing inside to download.', 'bad');
        return;
      }
      const zipName = paths.length === 1 ? `${getBaseName(paths[0])}.zip` : `${folderLabel(currentPath)} (${paths.length} items).zip`;
      await downloadBlob(await createZip(entries), zipName);
      flash(`Downloaded "${zipName}".`);
    } catch (err) {
      flash(`Download failed: ${err.message}`, 'bad');
    }
  }

  async function toggleTag(paths, tag) {
    const allHave = paths.every(p => lookup(p)?.tags?.includes(tag));
    for (const p of paths) {
      const tags = await fs.getTags(p);
      const next = allHave ? tags.filter(t => t !== tag) : [...new Set([...tags, tag])];
      await fs.setTags(p, next);
    }
    flash(`${allHave ? 'Removed' : 'Added'} the ${tag} tag${paths.length > 1 ? ` on ${plural(paths.length, 'item')}` : ''}.`);
    refresh();
  }

  function selectAll() {
    selectedPaths = new Set(items.map(i => i.path));
    selectionAnchor = items[0]?.path || null;
    refresh();
  }

  // Going up lands on the folder you came out of, like desktop file managers.
  function goUp() {
    if (currentPath === '/') return;
    const from = currentPath;
    currentPath = getParentPath(from);
    currentSearch = '';
    selectedPaths = new Set([from]);
    selectionAnchor = cursorPath = from;
    autoSelectedFor = currentPath;
    ui.focusItem = true;
    if (/^#(files|saved)\//.test(window.location.hash || '')) history.replaceState(null, '', '#files');
    refresh();
  }

  /* ---------- Modals ---------- */

  function openModal(id, html, { onKey } = {}) {
    document.getElementById(id)?.remove();
    const returnFocus = document.activeElement;
    const modal = document.createElement('div');
    modal.id = id;
    modal.className = 'sv-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = html;
    document.body.appendChild(modal);
    const close = () => {
      modal.remove();
      modal.dispatchEvent?.(new Event('sv-close'));
      document.removeEventListener('keydown', keyHandler, true);
      if (returnFocus && returnFocus.isConnected) returnFocus.focus?.({ preventScroll: true });
    };
    const keyHandler = (e) => {
      if (!modal.isConnected) return document.removeEventListener('keydown', keyHandler, true);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      onKey?.(e, close);
    };
    document.addEventListener('keydown', keyHandler, true);
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.closest('[data-modal-close]')) close();
    });
    // Focus the dialog itself so keys work at once without a ring on Close.
    const card = modal.querySelector('.sv-modal-card');
    card?.setAttribute('tabindex', '-1');
    card?.focus?.({ preventScroll: true });
    return { modal, close };
  }

  function propertiesFor(paths) {
    let fileCount = 0;
    let folderCount = 0;
    let totalBytes = 0;
    const count = (item) => {
      if (item.isDirectory) {
        for (const child of walk(item.path)) {
          if (child.isDirectory) folderCount++;
          else { fileCount++; totalBytes += child.size || 0; }
        }
      } else {
        totalBytes += item.size || item.bytes || 0;
      }
    };
    for (const p of paths) {
      const item = p === currentPath ? { path: p, isDirectory: true } : lookup(p);
      if (item) count(item);
    }
    return { fileCount, folderCount, totalBytes };
  }

  function openProperties(paths, { folder = false } = {}) {
    const isFolderView = folder || (paths.length === 1 && (paths[0] === currentPath || lookup(paths[0])?.isDirectory));
    const item = paths.length === 1 && paths[0] !== currentPath ? lookup(paths[0]) : null;
    const { fileCount, folderCount, totalBytes } = propertiesFor(paths);
    const title = paths.length > 1 ? `${paths.length} items` : (paths[0] === currentPath ? folderLabel(currentPath) : (item?.name || getBaseName(paths[0])));
    const location = paths.length > 1 || paths[0] === currentPath ? currentPath : (item?.parentPath || getParentPath(paths[0]));

    const rows = [];
    if (item && !item.isDirectory) {
      rows.push(['Kind', kindOf(item)], ['Size', size(item.size || 0)], ['Location', location]);
      if (item.createdAt) rows.push(['Created', when(item.createdAt, { long: true })]);
      if (item.updatedAt) rows.push(['Modified', when(item.updatedAt, { long: true })]);
    } else {
      rows.push(['Location', location], ['Contains', `${plural(fileCount, 'file')}, ${plural(folderCount, 'folder')}`], ['Total Size', size(totalBytes)]);
    }
    rows.push(['Storage', currentStorage === 'online' ? 'Online' : 'This browser']);
    if (item?.tags?.length) rows.push(['Tags', item.tags.join(', ')]);

    openModal('sv-properties-modal', `
      <div class="sv-modal-card sv-props" aria-labelledby="sv-prop-title">
        <div class="sv-modal-head">
          <span class="sv-modal-icon">${paths.length > 1 ? ICONS.checkAll : getFileTypeIcon(title, isFolderView ? 'folder' : item?.kind, 22)}</span>
          <strong id="sv-prop-title">${escapeHtml(title)} Properties</strong>
          <button type="button" id="sv-prop-close" class="sv-icon-btn" data-modal-close title="Close" aria-label="Close">${ICONS.x}</button>
        </div>
        <dl class="sv-props-list">
          ${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}
        </dl>
      </div>
    `, { onKey: (e, close) => { if (e.code === 'Space' && !e.target.closest?.('input, textarea, button')) { e.preventDefault(); e.stopPropagation(); close(); } } });
  }

  function openQuickLook(pathOrItem) {
    const files = items.filter(i => !i.isDirectory);
    let item = typeof pathOrItem === 'string' ? lookup(pathOrItem) : pathOrItem;
    if (!item) item = typeof pathOrItem === 'string' ? { path: pathOrItem, name: getBaseName(pathOrItem) } : null;
    if (!item || item.isDirectory) return;
    item = withBody(item);

    const index = files.findIndex(f => f.path === item.path);
    const type = previewTypeOf(item);
    const tools = getToolsForFile(item);
    const top = tools[0];

    const body = () => {
      if (type === 'text' || type === 'json' || type === 'markdown' || type === 'csv' || type === 'html') {
        const text = item.text;
        if (text == null) return '<pre id="sv-ql-pre" class="sv-code"></pre>';
        if (type === 'markdown') return `<div class="sv-md">${renderMarkdown(text)}</div>`;
        if (type === 'csv') return renderCsvTable(text, extOf(item.name) === 'tsv' ? '\t' : ',');
        return `<pre id="sv-ql-pre" class="sv-code">${escapeHtml(text || '')}</pre>`;
      }
      return renderContentBody(item, type, effectiveView(type));
    };

    const { modal, close } = openModal('sv-quicklook-modal', `
      <div class="sv-modal-card sv-ql" aria-labelledby="sv-ql-title">
        <div class="sv-modal-head">
          <span class="sv-modal-icon">${getFileTypeIcon(item.name, item.kind, 22)}</span>
          <div class="sv-ql-title">
            <strong id="sv-ql-title">${escapeHtml(item.name)}</strong>
            <span>${[kindOf(item), size(item.size ?? item.bytes ?? 0), item.updatedAt ? when(item.updatedAt) : ''].filter(Boolean).join(' · ')}</span>
          </div>
          ${files.length > 1 && index >= 0 ? `
            <span class="sv-ql-nav">
              <button type="button" class="sv-icon-btn" data-ql-step="-1" title="Previous file (Left arrow)" aria-label="Previous file" ${index === 0 ? 'disabled' : ''}>${ICONS.chevronLeft}</button>
              <span class="sv-ql-pos">${index + 1} of ${files.length}</span>
              <button type="button" class="sv-icon-btn" data-ql-step="1" title="Next file (Right arrow)" aria-label="Next file" ${index === files.length - 1 ? 'disabled' : ''}>${ICONS.chevronRight}</button>
            </span>
          ` : ''}
          <button type="button" id="sv-ql-close" class="sv-icon-btn" data-modal-close title="Close (Esc)" aria-label="Close">${ICONS.x}</button>
        </div>
        <div class="sv-ql-body sv-preview" data-preview-type="${type}">${body()}</div>
        <div class="sv-modal-foot">
          <span class="sv-kbd-hint"><kbd>Space</kbd> or <kbd>Esc</kbd> to close</span>
          ${top ? `<button type="button" class="btn btn-primary btn-sm" id="sv-ql-open-tool">${ICONS.external}<span>Open in ${escapeHtml(top.name)}</span></button>` : ''}
        </div>
      </div>
    `, {
      onKey: (e, closeFn) => {
        if (e.code === 'Space' && !e.target.closest?.('input, textarea, button, a')) { e.preventDefault(); e.stopPropagation(); closeFn(); }
        else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); step(e.key === 'ArrowRight' ? 1 : -1); }
      }
    });

    const step = (delta) => {
      const next = files[index + delta];
      if (!next) return;
      selectedPaths = new Set([next.path]);
      selectionAnchor = cursorPath = next.path;
      close();
      refresh();
      // The refresh rebuilt `items`; reopen through the fresh wiring.
      host.dispatchEvent(new CustomEvent('sv-quicklook', { detail: next.path }));
    };
    modal.querySelectorAll('[data-ql-step]').forEach(btn => btn.addEventListener('click', () => step(Number(btn.dataset.qlStep))));
    modal.querySelector('#sv-ql-open-tool')?.addEventListener('click', () => { close(); openFileInTool(item, top.id); });

    const update = (html) => { const el = modal.querySelector('.sv-ql-body'); if (el && modal.isConnected) el.innerHTML = html; };
    if (['image', 'pdf', 'audio', 'video'].includes(type) && !blobUrlCache.get(item.path)) {
      loadBlobUrl(item).then(() => update(renderContentBody(item, type, effectiveView(type)))).catch(() => {});
    } else if (type === 'document') {
      loadDocPreview(item).then(() => update(renderContentBody(item, type, effectiveView(type)))).catch(() => {});
    } else if (item.text == null && !['image', 'pdf', 'audio', 'video', 'binary', 'document'].includes(type)) {
      loadText(item).then(text => { item = { ...item, text: text ?? '' }; update(body()); }).catch(() => {});
    }
  }

  on(host, 'sv-quicklook', (e) => openQuickLook(e.detail));

  /* ---------- Context menus (shared engine) ---------- */

  const tagRow = (tags = [], label = 'Tags') => ({
    customHtml: `
      <div class="finder-menu-tags" role="group" aria-label="${label}">
        <span>${label}</span>
        <span class="finder-menu-tag-dots">
          ${Object.entries(TAG_COLORS).map(([t, color]) => `<button type="button" class="finder-tag-dot ${tags.includes(t) ? 'is-on' : ''}" data-set-tag="${t}" style="background:${color};" title="${t}" aria-label="${t} tag" aria-pressed="${tags.includes(t)}"></button>`).join('')}
        </span>
      </div>`
  });

  const bindTagClicks = (paths) => {
    const menu = document.getElementById('toolbox-context-menu');
    menu?.addEventListener('click', (e) => {
      const dot = e.target.closest('[data-set-tag]');
      if (!dot) return;
      closeContextMenu();
      toggleTag(paths, dot.dataset.setTag);
    });
  };

  function openItemMenu(x, y, path) {
    const item = lookup(path);
    if (!item) return;
    const paths = selectedPaths.has(path) && selectedPaths.size > 1 ? selection() : [path];
    const multi = paths.length > 1;
    const isDir = !multi && item.isDirectory;
    const top = !multi && !isDir ? getToolsForFile(item)[0] : null;
    const clip = fileClipboard.paths.length;
    const commonTags = Object.keys(TAG_COLORS).filter(t => paths.every(p => lookup(p)?.tags?.includes(t)));

    const menuItems = multi ? [
      { label: `Download ${paths.length} items as ZIP`, icon: ICONS.download, action: () => downloadPaths(paths) },
      { label: 'Get info', icon: ICONS.info, action: () => openProperties(paths) },
      { separator: true },
      { label: 'Cut', icon: ICONS.scissors, shortcut: `${modKey()}X`, action: () => setClipboard('cut') },
      { label: 'Copy', icon: ICONS.copy, shortcut: `${modKey()}C`, action: () => setClipboard('copy') },
      { separator: true },
      tagRow(commonTags, 'Tag all'),
      { separator: true },
      { label: `Delete ${paths.length} items`, icon: ICONS.delete, shortcut: 'Del', destructive: true, action: () => executeDelete(paths) },
    ] : [
      isDir
        ? { label: 'Open', icon: ICONS.folderOpen, shortcut: 'Enter', action: () => navigate(path) }
        : { label: 'Quick Look', icon: ICONS.eye, shortcut: 'Space', action: () => openQuickLook(path) },
      ...(top ? [{ label: `Open in ${top.name}`, icon: ICONS.external, shortcut: 'Enter', action: () => openFileInTool(item, top.id) }] : []),
      { separator: true },
      { label: 'Rename', icon: ICONS.pencil, shortcut: 'F2', action: () => startRename(path) },
      { label: 'Cut', icon: ICONS.scissors, shortcut: `${modKey()}X`, action: () => setClipboard('cut') },
      { label: 'Copy', icon: ICONS.copy, shortcut: `${modKey()}C`, action: () => setClipboard('copy') },
      ...(isDir && clip ? [{ label: `Paste ${plural(clip, 'item')} into folder`, icon: ICONS.paste, action: () => executePaste(path) }] : []),
      { label: isDir ? 'Download as ZIP' : 'Download', icon: ICONS.download, action: () => downloadPaths([path]) },
      { label: 'Get info', icon: ICONS.info, action: () => openProperties([path]) },
      { separator: true },
      tagRow(item.tags || []),
      { separator: true },
      { label: `Delete ${isDir ? 'folder' : 'file'}`, icon: ICONS.delete, shortcut: 'Del', destructive: true, action: () => executeDelete([path]) },
    ];

    openContextMenu({ x, y, title: multi ? `${paths.length} items selected` : item.name, items: menuItems, label: 'Item actions' });
    bindTagClicks(paths);
  }

  function openCanvasContextMenu(x, y) {
    const clip = fileClipboard.paths.length;
    openContextMenu({
      x, y,
      title: folderLabel(currentPath),
      label: 'Folder actions',
      items: [
        { label: 'New folder', icon: ICONS.folderPlus, action: createFolder },
        { label: 'New file', icon: ICONS.filePlus, action: createFile },
        { label: 'Upload files', icon: ICONS.upload, action: () => uploader.click() },
        ...(clip ? [{ separator: true }, { label: `Paste ${plural(clip, 'item')}`, icon: ICONS.paste, shortcut: `${modKey()}V`, action: () => executePaste(currentPath) }] : []),
        { separator: true },
        { label: 'Select all', icon: ICONS.checkAll, shortcut: `${modKey()}A`, action: selectAll },
        { label: 'Folder info', icon: ICONS.info, action: () => openProperties([currentPath], { folder: true }) },
      ]
    });
  }

  /* ---------- Drag and drop ---------- */

  let dragCounter = 0;
  let dragHoldTimer = null;
  let dragDesk = null;
  let draggingPath = null;

  const closeDragDesk = () => {
    clearTimeout(dragHoldTimer);
    dragHoldTimer = null;
    dragDesk?.remove();
    dragDesk = null;
  };

  const openDragDesk = (sourcePath) => {
    if (dragDesk || !sourcePath) return;
    const folders = walk('/')
      .filter(i => i.isDirectory && i.path !== sourcePath && !i.path.startsWith(`${sourcePath}/`) && i.path !== getParentPath(sourcePath))
      .sort((a, b) => a.path.localeCompare(b.path));
    dragDesk = document.createElement('aside');
    dragDesk.className = 'sv-drag-desk';
    dragDesk.setAttribute('aria-label', 'Move to folder');
    dragDesk.innerHTML = `
      <div class="sv-drag-desk-head"><strong>Move to</strong><span>Drop "${escapeHtml(getBaseName(sourcePath))}" on a folder</span></div>
      <div class="sv-drag-desk-folders">
        ${folders.map(f => `<button type="button" data-nav-path="${escapeHtml(f.path)}" class="sv-drag-desk-folder">${ICONS.folder}<span>${escapeHtml(f.path.replace(/^\//, '').split('/').join(' / '))}</span></button>`).join('')}
      </div>`;
    host.appendChild(dragDesk);
    requestAnimationFrame(() => dragDesk?.classList.add('is-open'));
  };

  const dropTargetOf = (el) => el?.closest?.('.sv-drag-desk-folder, [data-is-dir="true"], .sv-crumb-btn');
  const dirOf = (el) => el?.dataset.path || el?.dataset.navPath || null;
  const clearHover = () => host.querySelectorAll('.sv-folder-drop-hover').forEach(el => el.classList.remove('sv-folder-drop-hover'));

  on(host, 'dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (!draggingPath) host.classList.add('sv-drag-active');
  });
  on(host, 'dragover', (e) => {
    e.preventDefault();
    const target = dropTargetOf(e.target);
    clearHover();
    const dir = dirOf(target);
    const valid = target && dir && dir !== draggingPath && !(draggingPath && dir.startsWith(draggingPath + '/'));
    if (valid) target.classList.add('sv-folder-drop-hover');
    if (e.dataTransfer) e.dataTransfer.dropEffect = draggingPath ? (valid ? 'move' : 'none') : 'copy';
  });
  on(host, 'dragleave', () => {
    dragCounter = Math.max(0, dragCounter - 1);
    if (!dragCounter) { host.classList.remove('sv-drag-active'); clearHover(); }
  });
  on(host, 'drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    host.classList.remove('sv-drag-active');
    clearHover();
    const target = dropTargetOf(e.target);
    const targetDir = dirOf(target);
    const source = e.dataTransfer ? (e.dataTransfer.getData('application/toolbox-path') || '') : '';

    if (source) {
      closeDragDesk();
      if (!targetDir || targetDir === source || targetDir === getParentPath(source) || targetDir.startsWith(source + '/')) return;
      const moving = selectedPaths.has(source) ? selection() : [source];
      let moved = 0;
      for (const p of moving) {
        if (targetDir === p || targetDir.startsWith(p + '/') || getParentPath(p) === targetDir) continue;
        try { await fs.rename(p, uniquePath(targetDir, getBaseName(p))); moved++; }
        catch (err) { flash(`Move failed: ${err.message}`, 'bad'); }
      }
      if (moved) flash(`Moved ${moved === 1 ? `"${getBaseName(source)}"` : plural(moved, 'item')} to ${folderLabel(targetDir)}.`);
      refresh();
      return;
    }

    const dropped = Array.from(e.dataTransfer?.files || []);
    if (dropped.length) await saveUploads(dropped, target?.dataset.isDir === 'true' ? targetDir : currentPath);
  });
  on(host, 'dragstart', (e) => {
    const itemEl = e.target.closest?.('[data-context-target]');
    if (!itemEl || !e.dataTransfer) return;
    draggingPath = itemEl.dataset.path;
    e.dataTransfer.setData('application/toolbox-path', draggingPath);
    e.dataTransfer.setData('text/plain', itemEl.querySelector('.sv-item-name, .sv-grid-name')?.textContent || draggingPath);
    e.dataTransfer.effectAllowed = 'move';
    itemEl.classList.add('is-dragging');
    dragHoldTimer = setTimeout(() => openDragDesk(draggingPath), 650);
  });
  on(host, 'dragend', (e) => {
    e.target.closest?.('[data-context-target]')?.classList.remove('is-dragging');
    draggingPath = null;
    clearHover();
    closeDragDesk();
  });

  /* ---------- Right-click and long-press ---------- */

  const selectForMenu = (path) => {
    if (!selectedPaths.has(path)) {
      selectedPaths = new Set([path]);
      selectionAnchor = cursorPath = path;
      refresh();
    }
  };

  on(host, 'contextmenu', (e) => {
    const target = e.target.closest('[data-context-target]');
    if (target) {
      e.preventDefault();
      const path = target.dataset.path;
      selectForMenu(path);
      openItemMenu(e.clientX, e.clientY, path);
      return;
    }
    const canvas = e.target.closest('[data-canvas="true"]');
    if (canvas && !e.target.closest('button, input, a, select')) {
      e.preventDefault();
      openCanvasContextMenu(e.clientX, e.clientY);
    }
  });

  let touchTimer = null;
  let touchStart = null;
  let longPressed = false;
  on(host, 'touchstart', (e) => {
    const itemEl = e.target.closest('[data-context-target]');
    const canvas = !itemEl ? e.target.closest('[data-canvas="true"]') : null;
    if (!itemEl && !canvas) return;
    longPressed = false;
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
    itemEl?.classList.add('sv-touch-active');
    touchTimer = setTimeout(() => {
      longPressed = true;
      itemEl?.classList.remove('sv-touch-active');
      try { navigator.vibrate?.(20); } catch {}
      if (itemEl) {
        selectForMenu(itemEl.dataset.path);
        openItemMenu(touchStart.x, touchStart.y, itemEl.dataset.path);
      } else {
        openCanvasContextMenu(touchStart.x, touchStart.y);
      }
    }, 450);
  }, { passive: true });
  on(host, 'touchmove', (e) => {
    if (!touchStart || !e.touches?.[0]) return;
    if (Math.hypot(e.touches[0].clientX - touchStart.x, e.touches[0].clientY - touchStart.y) > 8) {
      clearTimeout(touchTimer);
      host.querySelectorAll('.sv-touch-active').forEach(el => el.classList.remove('sv-touch-active'));
    }
  }, { passive: true });
  on(host, 'touchend', (e) => {
    clearTimeout(touchTimer);
    host.querySelectorAll('.sv-touch-active').forEach(el => el.classList.remove('sv-touch-active'));
    if (longPressed && e.cancelable) e.preventDefault();
  }, { passive: false });

  /* ---------- Open-with dropdown ---------- */

  const openMenu = host.querySelector('#sv-open-dropdown-menu');
  const openToggleBtn = host.querySelector('#sv-open-dropdown-toggle');
  const setOpenMenu = (open) => {
    if (!openMenu || !openToggleBtn) return;
    openMenu.hidden = !open;
    openToggleBtn.setAttribute('aria-expanded', String(open));
    if (open) openMenu.querySelector('.sv-open-menu-item')?.focus?.({ preventScroll: true });
  };
  on(window, 'click', (e) => {
    if (openMenu && !openMenu.hidden && !e.target?.closest?.('.sv-open-dropdown-wrap')) setOpenMenu(false);
  });
  openMenu && on(openMenu, 'keydown', (e) => {
    const entries = [...openMenu.querySelectorAll('.sv-open-menu-item')];
    const i = entries.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      entries[(i + (e.key === 'ArrowDown' ? 1 : -1) + entries.length) % entries.length]?.focus();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setOpenMenu(false);
      openToggleBtn.focus();
    }
  });

  /* ---------- Clicks ---------- */

  const isTouchEvent = (e) => e.pointerType === 'touch' || (e.pointerType == null && isTouchOnly());

  on(host, 'click', async (e) => {
    const tagBtn = e.target.closest('[data-filter-tag]');
    if (tagBtn) {
      const tag = tagBtn.dataset.filterTag;
      currentTagFilter = tag === 'all' || tag === currentTagFilter ? null : tag;
      refresh();
      return;
    }

    const storageBtn = e.target.closest('.sv-storage-btn');
    if (storageBtn) {
      const wanted = storageBtn.dataset.storage || 'offline';
      if (wanted === currentStorage) return;
      if (wanted === 'online' && !getCurrentUser()) {
        flash('Sign in to keep files in your account.');
        try { openAccountModal(false); } catch {}
        return;
      }
      currentStorage = wanted;
      currentPath = currentStorage === 'online' ? '/Online' : '/Home';
      selectedPaths.clear();
      refresh();
      return;
    }

    const crumb = e.target.closest('[data-nav-path]');
    if (crumb && !crumb.closest('[data-context-target]')) {
      navigate(crumb.dataset.navPath || '/Home');
      return;
    }

    const layoutBtn = e.target.closest('.sv-layout-btn');
    if (layoutBtn) {
      currentLayout = layoutBtn.dataset.layout || 'split';
      writePref(STORAGE_FILES_VIEW_MODE, currentLayout);
      refresh();
      return;
    }

    const sortBtn = e.target.closest('[data-sort]');
    if (sortBtn) {
      const [key, dir] = currentSort.split(':');
      const k = sortBtn.dataset.sort;
      const nextDir = key === k ? (dir === 'asc' ? 'desc' : 'asc') : (k === 'modified' || k === 'size' ? 'desc' : 'asc');
      currentSort = SORTS.some(s => s.value === `${k}:${nextDir}`) ? `${k}:${nextDir}` : `${k}:asc`;
      writePref(STORAGE_FILES_SORT, currentSort);
      refresh();
      return;
    }

    const cviewBtn = e.target.closest('.sv-cview-btn');
    if (cviewBtn) {
      currentContentView = cviewBtn.dataset.cview || 'formatted';
      refresh();
      return;
    }

    if (e.target.closest('#sv-clear-search')) {
      e.stopPropagation?.();
      currentSearch = '';
      refresh();
      return;
    }

    const openToggle = e.target.closest('#sv-open-dropdown-toggle');
    if (openToggle) {
      e.stopPropagation?.();
      setOpenMenu(openMenu?.hidden ?? false);
      return;
    }

    const openIn = e.target.closest('[data-open]');
    if (openIn) {
      setOpenMenu(false);
      const target = current || lookup(selection()[0]);
      if (target && openIn.dataset.open) openFileInTool(target, openIn.dataset.open);
      return;
    }

    const itemEl = e.target.closest('[data-context-target]');
    if (itemEl && !e.target.closest('button, input, a, select')) {
      if (longPressed) { longPressed = false; return; }
      const path = itemEl.dataset.path;
      const isDir = itemEl.dataset.isDir === 'true';

      // A click re-renders the list, so the browser's own dblclick can land
      // on a replaced node and never fire. Detect the second click here.
      const now = Date.now();
      const repeat = lastClick.path === path && now - lastClick.at < 450;
      lastClick = { path, at: now };
      if ((e.detail >= 2 || repeat) && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        lastClick = { path: null, at: 0 };
        openItem(path);
        return;
      }

      if (e.shiftKey && selectionAnchor) {
        const order = items.map(i => i.path);
        const a = order.indexOf(selectionAnchor);
        const b = order.indexOf(path);
        if (a >= 0 && b >= 0) {
          const [from, to] = a < b ? [a, b] : [b, a];
          selectedPaths = new Set(order.slice(from, to + 1));
          cursorPath = path;
          refresh();
          return;
        }
      }

      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (selectedPaths.has(path)) selectedPaths.delete(path);
        else selectedPaths.add(path);
        selectionAnchor = cursorPath = path;
        refresh();
        return;
      }

      // On touch there's no double-click: a tap opens.
      if (isTouchEvent(e)) {
        if (isDir) { navigate(path); return; }
        if (currentLayout !== 'split' || isNarrow()) {
          selectedPaths = new Set([path]);
          selectionAnchor = cursorPath = path;
          refresh();
          openQuickLook(path);
          return;
        }
      }

      selectedPaths = new Set([path]);
      selectionAnchor = cursorPath = path;
      ui.focusItem = true;
      if (!isDir && currentLayout === 'split') history.replaceState(null, '', `#files/${encodeURIComponent(path)}`);
      refresh();
      return;
    }

    const actBtn = e.target.closest('[data-act]');
    const act = actBtn?.dataset.act;

    if (!actBtn) {
      const canvasEl = e.target.closest('[data-canvas="true"]');
      if (canvasEl && !e.target.closest('button, input, a, select') && selectedPaths.size) {
        selectedPaths.clear();
        refresh();
      }
      return;
    }

    switch (act) {
      case 'cut': setClipboard('cut'); return;
      case 'copy': setClipboard('copy'); return;
      case 'paste': await executePaste(currentPath); return;
      case 'clear-clipboard': fileClipboard = { op: null, paths: [] }; refresh(); return;
      case 'delete-selected': await executeDelete(selection().length ? selection() : (current ? [current.path] : [])); return;
      case 'select-all': selectAll(); return;
      case 'clear-selection': selectedPaths.clear(); refresh(); return;
      case 'folder-properties': openProperties([currentPath], { folder: true }); return;
      case 'multi-properties': openProperties(selection().length ? selection() : [currentPath]); return;
      case 'multi-download': await downloadPaths(selection()); return;
      case 'quicklook': {
        const target = current?.path || selection().find(p => !lookup(p)?.isDirectory);
        if (target) openQuickLook(target);
        return;
      }
      case 'open-folder': navigate(actBtn.dataset.path); return;
      case 'nav-up': goUp(); return;
      case 'clear-search': currentSearch = ''; ui.keepSearchFocus = [0, 0]; refresh(); return;
      case 'new-folder': await createFolder(); return;
      case 'new-file': await createFile(); return;
      case 'upload': uploader.click(); return;
      case 'extract-archive': {
        const filePath = actBtn.dataset.filePath || current?.path;
        if (!filePath) return;
        try {
          const extracted = await fs.extractArchive(filePath, currentPath);
          flash(`Extracted ${plural(extracted.length, 'file')} into ${folderLabel(currentPath)}.`);
          refresh();
        } catch (err) {
          flash(err.message, 'bad');
        }
        return;
      }
      default:
    }
  });

  /* ---------- Search, sort, rename, upload ---------- */

  const searchBox = host.querySelector('#sv-search-box');
  searchBox && on(searchBox, 'input', () => {
    currentSearch = searchBox.value.trim();
    ui.keepSearchFocus = [searchBox.selectionStart ?? searchBox.value.length, searchBox.selectionEnd ?? searchBox.value.length];
    selectedPaths.clear();
    refresh();
  });
  searchBox && on(searchBox, 'keydown', (e) => {
    if (e.key === 'Escape' && searchBox.value) {
      e.preventDefault();
      e.stopPropagation();
      currentSearch = '';
      ui.keepSearchFocus = [0, 0];
      refresh();
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      const first = itemEls()[0];
      if (!first) return;
      e.preventDefault();
      selectedPaths = new Set([first.dataset.path]);
      selectionAnchor = cursorPath = first.dataset.path;
      ui.focusItem = true;
      refresh();
      host.querySelector(`[data-context-target][tabindex="0"]`)?.focus?.();
    }
  });

  const sortSelect = host.querySelector('#sv-sort-select');
  sortSelect && on(sortSelect, 'change', () => {
    currentSort = sortSelect.value;
    writePref(STORAGE_FILES_SORT, currentSort);
    refresh();
  });

  const renameInput = host.querySelector('.sv-rename');
  if (renameInput) {
    on(renameInput, 'focus', () => selectStem(renameInput));
    on(renameInput, 'keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); renameInput.blur(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); renameInput.value = current?.name || renameInput.value; renameInput.blur(); }
    });
    on(renameInput, 'change', async () => {
      const ok = await renamePath(renameInput.dataset.path, renameInput.value);
      if (!ok && current) renameInput.value = current.name;
    });
  }

  on(uploader, 'change', async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length) await saveUploads(files);
  });

  /* ---------- Keyboard ---------- */

  const columnsInGrid = () => {
    const els = itemEls();
    if (currentLayout !== 'grid' || els.length < 2) return 1;
    const top = els[0].offsetTop;
    const n = els.findIndex(el => el.offsetTop !== top);
    return n > 0 ? n : els.length;
  };

  const moveCursor = (delta, extend) => {
    const order = items.map(i => i.path);
    if (!order.length) return;
    const from = order.indexOf(cursorPath);
    const next = from < 0 ? (delta > 0 ? 0 : order.length - 1) : Math.max(0, Math.min(order.length - 1, from + delta));
    const path = order[next];
    if (extend && selectionAnchor && order.includes(selectionAnchor)) {
      const a = order.indexOf(selectionAnchor);
      const [lo, hi] = a < next ? [a, next] : [next, a];
      selectedPaths = new Set(order.slice(lo, hi + 1));
    } else {
      selectedPaths = new Set([path]);
      selectionAnchor = path;
    }
    cursorPath = path;
    ui.focusItem = true;
    refresh();
  };

  on(window, 'keydown', (e) => {
    const t = e.target;
    if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.tagName === 'SELECT' || t?.isContentEditable) return;
    if (document.querySelector('.custom-dialog-backdrop, #sv-quicklook-modal, #sv-properties-modal, #toolbox-context-menu')) return;
    if (openMenu && !openMenu.hidden) return;

    const mod = isMac() ? e.metaKey : e.ctrlKey;
    const onControl = t?.closest?.('button, a, select, [role="menuitem"]');
    const paths = selection();

    if (e.code === 'Space' && !mod && !e.altKey) {
      if (onControl) return;
      e.preventDefault();
      if (paths.length > 1) { openProperties(paths); return; }
      const target = current?.path || paths.find(p => !lookup(p)?.isDirectory);
      if (target) openQuickLook(target);
      else if (paths.length === 1) openProperties(paths);
      return;
    }

    if (e.key === 'Enter' && !mod) {
      if (onControl || paths.length !== 1) return;
      e.preventDefault();
      openItem(paths[0]);
      return;
    }

    if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !mod) {
      if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); goUp(); return; }
      if (e.altKey && e.key === 'ArrowDown') { if (paths.length === 1) { e.preventDefault(); openItem(paths[0]); } return; }
      if (onControl && !t.closest('[data-context-target]')) return;
      const cols = columnsInGrid();
      const horizontal = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
      if (horizontal && currentLayout !== 'grid') return;
      e.preventDefault();
      const delta = horizontal ? (e.key === 'ArrowRight' ? 1 : -1) : (e.key === 'ArrowDown' ? cols : -cols);
      moveCursor(delta, e.shiftKey);
      return;
    }

    if (e.key === 'Home' || e.key === 'End') {
      if (onControl && !t.closest('[data-context-target]')) return;
      e.preventDefault();
      moveCursor(e.key === 'Home' ? -Infinity : Infinity, e.shiftKey);
      return;
    }

    if (e.key === 'Backspace' && !mod) {
      e.preventDefault();
      goUp();
      return;
    }

    if (e.key === 'F2' && paths.length === 1) {
      e.preventDefault();
      startRename(paths[0]);
      return;
    }

    if (e.key === 'Escape') {
      if (selectedPaths.size) { selectedPaths.clear(); refresh(); }
      else if (currentSearch) { currentSearch = ''; refresh(); }
      return;
    }

    if (mod && (e.key === 'a' || e.key === 'A')) { e.preventDefault(); selectAll(); return; }
    if (mod && (e.key === 'c' || e.key === 'C') && paths.length) { e.preventDefault(); setClipboard('copy'); return; }
    if (mod && (e.key === 'x' || e.key === 'X') && paths.length) { e.preventDefault(); setClipboard('cut'); return; }
    if (mod && (e.key === 'v' || e.key === 'V') && fileClipboard.paths.length) { e.preventDefault(); executePaste(currentPath); return; }

    if ((e.key === 'Delete' || (e.key === 'Backspace' && mod)) && paths.length) {
      e.preventDefault();
      executeDelete(paths);
    }
  });

  /* ---------- Segmented controls and scroll fades ---------- */

  const storageSwitch = host.querySelector('.sv-storage-switch');
  if (storageSwitch) attachSegmentedSlider(storageSwitch, '.sv-storage-btn');
  const viewSwitcher = host.querySelector('.sv-view-switcher');
  if (viewSwitcher) attachSegmentedSlider(viewSwitcher, '.sv-layout-btn');
  const cviewSwitcher = host.querySelector('.sv-content-view-switcher');
  if (cviewSwitcher) attachSegmentedSlider(cviewSwitcher, '.sv-cview-btn');

  const fadeWrappers = host.querySelectorAll('.sv-fade-wrapper');
  const updateFade = (wrapper) => {
    const scrollEl = wrapper.querySelector('.sv-fade-scroll');
    if (!scrollEl) return;
    wrapper.classList.toggle('has-overflow-bottom', scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight > 4);
  };
  const updateAllFades = () => fadeWrappers.forEach(updateFade);
  fadeWrappers.forEach(wrapper => {
    const scrollEl = wrapper.querySelector('.sv-fade-scroll');
    if (scrollEl) on(scrollEl, 'scroll', () => updateFade(wrapper), { passive: true });
  });
  requestAnimationFrame(updateAllFades);
  const fadeTimer = setTimeout(updateAllFades, 80);
  on(window, 'resize', updateAllFades, { passive: true });

  return () => {
    clearTimeout(fadeTimer);
    clearTimeout(touchTimer);
    closeDragDesk();
    cleanups.forEach(fn => fn());
    host.innerHTML = '';
  };
}
