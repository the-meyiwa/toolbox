/* ============================================================
   TOOLBOX — Files & Saved Work (Browser File Explorer)
   Lightweight, hierarchical browser-based file explorer with
   nested folders, dual Offline / Online storage views, breadcrumb
   navigation, rich file inspectors (Formatted, Table, Raw, Image),
   PKZIP compression / decompression, tag management, Mac Finder-style
   context menu on right-click / touch hold, and OS icon grid view.
   Strictly zero emojis.
   ============================================================ */

import { fs, normalizePath, getParentPath, getBaseName } from '../lib/filesystem.js';
import * as store from '../lib/artifacts.js';
import { kindLabel, kindFromFilename } from '../registry/kinds.js';
import { BY_ID, toolsAccepting } from '../registry/index.js';
import { getFileTypeIcon, detectFileCategory } from '../lib/file-icons.js';
import { getCurrentUser } from '../lib/supabase.js';

const escapeHtml = (s) => String(s || '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const when = (ts) => new Date(ts).toLocaleDateString(undefined, {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const size = (bytes) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`);

export const TAG_COLORS = {
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#a855f7'
};

// Minimal vector SVG icons (strictly no emojis)
const ICONS = {
  file: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  folder: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  folderPlus: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>',
  split: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>',
  grid: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  list: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  download: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  delete: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  upload: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  table: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/></svg>',
  code: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  raw: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="14" y2="18"/></svg>',
  zip: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>',
  chevronRight: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
  arrowUp: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
  plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
};

// UI state preserved across refreshes in current session
let currentLayout = 'split'; // 'split' | 'grid' | 'list'
let currentContentView = 'formatted'; // 'formatted' | 'table' | 'raw'
let currentSearch = '';
let currentPath = '/Home'; // Hierarchical directory pointer
let currentStorage = 'offline'; // 'offline' | 'online'
let currentTagFilter = null; // null | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple'

function renderTagDots(tags = []) {
  if (!tags || !tags.length) return '';
  return `
    <div class="sv-tags-dots" style="display:flex; align-items:center; justify-content:center; gap:3px; margin-top:3px;">
      ${tags.map(t => `<span style="width:6px; height:6px; border-radius:50%; background:${TAG_COLORS[t] || '#888'}; display:inline-block;" title="${escapeHtml(t)}"></span>`).join('')}
    </div>
  `;
}

/**
 * @param {HTMLElement} host
 * @param {string|null} selectedId
 * @returns {() => void} teardown
 */
export function renderSaved(host, selectedId = null) {
  let teardown = () => {};

  // Verify authentication if online requested
  const user = getCurrentUser();
  if (currentStorage === 'online' && !user) {
    currentStorage = 'offline';
  }

  const refresh = (nextId = null) => {
    teardown();
    teardown = paint(host, nextId, refresh);
  };

  // Listen to auth state changes to update Online storage tab
  const authHandler = () => {
    const u = getCurrentUser();
    if (!u && currentStorage === 'online') {
      currentStorage = 'offline';
    }
    refresh(selectedId);
  };
  window.addEventListener('toolbox:authchange', authHandler);

  // Listen to filesystem changes
  const unFs = fs.onChange(() => {
    refresh(selectedId);
  });

  refresh(selectedId);

  // Background full initialization & hydration
  fs.init().then(() => {
    refresh(selectedId);
  }).catch(() => {});

  return () => {
    teardown();
    unFs();
    window.removeEventListener('toolbox:authchange', authHandler);
  };
}

function paint(host, selectedId, refresh) {
  const user = getCurrentUser();

  if (currentStorage === 'online' && !user) {
    currentStorage = 'offline';
  }

  // Load files in current directory synchronously
  let itemsInDir = [];
  try {
    itemsInDir = fs.listSync(currentPath, { storage: currentStorage });
  } catch (err) {
    itemsInDir = [];
  }

  // Apply search filter if query is present
  let items = itemsInDir;
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    items = itemsInDir.filter(f => f.name.toLowerCase().includes(q));
  }

  // Apply tag filter if active
  if (currentTagFilter) {
    items = items.filter(f => f.tags && f.tags.includes(currentTagFilter));
  }

  // Find selected item synchronously
  let selected = null;
  if (selectedId) {
    const rec = fs.statSync(selectedId);
    if (rec && !rec.isDirectory) {
      const art = store.get(rec.id || selectedId);
      selected = { ...rec, text: art?.text || '', id: rec.id || rec.path };
    } else {
      const art = store.get(selectedId);
      if (art) selected = art;
    }
  }

  // Default selection if none active
  if (!selected && items.length > 0) {
    const firstFile = items.find(f => !f.isDirectory);
    if (firstFile) {
      const art = store.get(firstFile.id || firstFile.path);
      selected = { ...firstFile, text: art?.text || '' };
    }
  }

  const isAtRoot = currentPath === '/Home' || currentPath === '/';
  const allArtifacts = store.list();
  const allFiles = fs.listSync('/', { recursive: true }).filter(f => !f.isDirectory);
  const customFolders = fs.listSync('/').filter(f => f.isDirectory && !['/Home', '/Projects', '/Documents', '/Images', '/Downloads'].includes(f.path));

  if (isAtRoot && allArtifacts.length === 0 && allFiles.length === 0 && customFolders.length === 0 && !currentSearch && !currentTagFilter) {
    host.innerHTML = empty();
    return wire(host, null, refresh);
  }

  host.innerHTML = full(user, itemsInDir, items, selected);
  return wire(host, selected, refresh);
}

function empty() {
  return `
    <div class="sv-empty" style="max-width:680px; margin:40px auto; padding:36px 24px; text-align:center; background:var(--bg-card); border:1px solid var(--border); border-radius:18px;">
      <div style="width:48px; height:48px; border-radius:12px; background:var(--bg-subtle); border:1px solid var(--border); display:flex; align-items:center; justify-content:center; margin:0 auto 16px; color:var(--text);">
        ${ICONS.file}
      </div>
      <h1 class="sv-title" style="font-size:1.4rem; font-weight:700; color:var(--text); margin-bottom:10px;">Files & Saved Work</h1>
      <p class="sv-lede" style="color:var(--text-secondary); line-height:1.6; font-size:0.92rem; margin-bottom:24px;">
        Nothing saved yet. Tools that generate content—such as tidied documents, converted data, diagrams, or code—include a Save action. Items you save persist offline in this browser and appear here.
      </p>
      <div class="sv-empty-actions" style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
        <button type="button" class="btn btn-primary" data-act="new-file" style="display:inline-flex; align-items:center; gap:6px;">
          ${ICONS.plus}
          <span>New File</span>
        </button>
        <button type="button" class="btn btn-secondary" data-act="new-folder" style="display:inline-flex; align-items:center; gap:6px;">
          ${ICONS.folderPlus}
          <span>New Folder</span>
        </button>
        <button type="button" class="btn btn-secondary" data-act="upload" style="display:inline-flex; align-items:center; gap:6px;">
          ${ICONS.upload}
          <span>Upload</span>
        </button>
        <button type="button" class="btn btn-secondary" data-act="import" style="display:inline-flex; align-items:center; gap:6px;">
          ${ICONS.upload}
          <span>Open a saved file</span>
        </button>
        <a class="btn btn-secondary" href="#tools">Browse tools</a>
      </div>
      <div style="margin-top:24px; text-align:left;">
        ${storageNote()}
      </div>
    </div>`;
}

function full(user, allItems, filteredItems, selected) {
  const use = store.usage();
  const isOnline = currentStorage === 'online';
  const pathSegments = currentPath.split('/').filter(Boolean);

  return `
    <div class="sv" style="max-width:1280px; margin:0 auto; display:flex; flex-direction:column; gap:14px;">
      
      <!-- TOOLBAR & HEADER -->
      <header class="sv-head" style="background:var(--bg-card); border:1px solid var(--border); border-radius:16px; padding:16px 20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; box-shadow:0 4px 16px rgba(0,0,0,0.03);">
        
        <!-- Left: Storage Tabs & Folder Info -->
        <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <h1 class="sv-title" style="margin:0; font-size:1.35rem; font-weight:700; color:var(--text);">Files</h1>
              
              <!-- Storage Mode Pill Switcher (Offline / Online) -->
              <div class="sv-storage-switch" style="display:flex; background:var(--bg-subtle); padding:2px; border-radius:999px; border:1px solid var(--border);">
                <button type="button" class="sv-storage-btn ${!isOnline ? 'active' : ''}" data-storage="offline" style="padding:3px 12px; border:none; border-radius:999px; font-size:0.75rem; font-weight:600; cursor:pointer; background:${!isOnline ? 'var(--bg-card)' : 'transparent'}; color:${!isOnline ? 'var(--text)' : 'var(--text-secondary)'}; box-shadow:${!isOnline ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'};">
                  Offline
                </button>
                ${user ? `
                  <button type="button" class="sv-storage-btn ${isOnline ? 'active' : ''}" data-storage="online" style="padding:3px 12px; border:none; border-radius:999px; font-size:0.75rem; font-weight:600; cursor:pointer; background:${isOnline ? 'var(--bg-card)' : 'transparent'}; color:${isOnline ? 'var(--text)' : 'var(--text-secondary)'}; box-shadow:${isOnline ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'};">
                    Online (Cloud)
                  </button>
                ` : ''}
              </div>
            </div>
            
            <p class="sv-lede" style="margin:4px 0 0; font-size:0.78rem; color:var(--text-secondary);">
              ${isOnline ? 'Synchronized to your authenticated Supabase Cloud storage' : `${size(use.used)} stored offline in this browser`}
            </p>
          </div>
        </div>

        <!-- Right: Search and View Controls -->
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <!-- Search input -->
          <div style="position:relative; width:180px;">
            <input type="text" id="sv-search-box" class="tool-input" placeholder="Search files…" value="${escapeHtml(currentSearch)}" style="width:100%; height:32px; font-size:0.82rem; padding:0 8px 0 28px; border-radius:8px;">
            <div style="position:absolute; left:8px; top:8px; color:var(--text-muted); pointer-events:none;">
              ${ICONS.search}
            </div>
          </div>

          <!-- Multiple Layout Views Switcher -->
          <div class="sv-view-switcher" style="display:flex; background:var(--bg-subtle); padding:3px; border-radius:10px; border:1px solid var(--border);">
            <button type="button" class="sv-layout-btn ${currentLayout === 'split' ? 'active' : ''}" data-layout="split" title="Split Master/Detail View" style="padding:4px 7px; background:none; border:none; cursor:pointer; color:var(--text); border-radius:6px;">
              ${ICONS.split}
            </button>
            <button type="button" class="sv-layout-btn ${currentLayout === 'grid' ? 'active' : ''}" data-layout="grid" title="OS Icon Grid View" style="padding:4px 7px; background:none; border:none; cursor:pointer; color:var(--text); border-radius:6px;">
              ${ICONS.grid}
            </button>
            <button type="button" class="sv-layout-btn ${currentLayout === 'list' ? 'active' : ''}" data-layout="list" title="Tabular List View" style="padding:4px 7px; background:none; border:none; cursor:pointer; color:var(--text); border-radius:6px;">
              ${ICONS.list}
            </button>
          </div>

          <!-- Primary Actions -->
          <button type="button" class="btn btn-secondary btn-sm" data-act="new-folder" title="Create New Folder" style="display:inline-flex; align-items:center; gap:5px; font-size:0.8rem;">
            ${ICONS.folderPlus}
            <span>New Folder</span>
          </button>
          <button type="button" class="btn btn-secondary btn-sm" data-act="new-file" title="Create New File" style="display:inline-flex; align-items:center; gap:5px; font-size:0.8rem;">
            ${ICONS.plus}
            <span>New File</span>
          </button>
          <button type="button" class="btn btn-primary btn-sm" data-act="upload" title="Upload Files" style="display:inline-flex; align-items:center; gap:5px; font-size:0.8rem;">
            ${ICONS.upload}
            <span>Upload</span>
          </button>
        </div>
      </header>

      <!-- BREADCRUMB NAVIGATION & FOLDER ACTIONS -->
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:10px 16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <!-- Breadcrumb Links -->
        <div class="sv-breadcrumbs" style="display:flex; align-items:center; gap:6px; font-size:0.85rem;">
          <button type="button" class="sv-crumb-btn" data-nav-path="/" style="background:none; border:none; color:var(--text); font-weight:700; cursor:pointer; padding:2px 4px; border-radius:4px;">
            Root
          </button>
          ${pathSegments.map((seg, idx) => {
            const subPath = '/' + pathSegments.slice(0, idx + 1).join('/');
            const isLast = idx === pathSegments.length - 1;
            return `
              <span style="color:var(--text-muted);">${ICONS.chevronRight}</span>
              <button type="button" class="sv-crumb-btn" data-nav-path="${subPath}" style="background:none; border:none; color:${isLast ? 'var(--text)' : 'var(--text-secondary)'}; font-weight:${isLast ? '700' : '500'}; cursor:pointer; padding:2px 4px; border-radius:4px;">
                ${escapeHtml(seg)}
              </button>
            `;
          }).join('')}
        </div>

        <!-- Folder Actions (Up, Import) -->
        <div style="display:flex; align-items:center; gap:8px;">
          ${currentPath !== '/' ? `
            <button type="button" class="btn btn-secondary btn-sm" data-act="nav-up" title="Go up one folder" style="padding:4px 8px; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px;">
              ${ICONS.arrowUp}
              <span>Up</span>
            </button>
          ` : ''}
          <button type="button" class="btn btn-secondary btn-sm" data-act="import" title="Open JSON backup bundle" style="padding:4px 8px; font-size:0.75rem; display:inline-flex; align-items:center; gap:4px;">
            ${ICONS.upload}
            <span>Import</span>
          </button>
        </div>
      </div>

      <!-- TAGS FILTER BAR -->
      <div class="sv-tags-bar" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; padding:8px 14px; background:var(--bg-card); border:1px solid var(--border); border-radius:10px;">
        <span style="font-size:0.74rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.04em; margin-right:4px;">Tags:</span>
        <button type="button" class="sv-tag-pill ${!currentTagFilter ? 'active' : ''}" data-filter-tag="all">All</button>
        ${Object.entries(TAG_COLORS).map(([tagKey, color]) => `
          <button type="button" class="sv-tag-pill ${currentTagFilter === tagKey ? 'active' : ''}" data-filter-tag="${tagKey}">
            <span style="width:8px; height:8px; border-radius:50%; background:${color}; display:inline-block;"></span>
            <span style="text-transform:capitalize;">${tagKey}</span>
          </button>
        `).join('')}
      </div>

      <!-- MAIN EXPLORER AREA (Split, Grid, or List) -->
      ${renderExplorerBody(filteredItems, selected)}

      <!-- STORAGE FOOTER NOTE -->
      ${storageNote()}
    </div>
  `;
}

function renderExplorerBody(items, selected) {
  if (items.length === 0) {
    return `
      <div style="text-align:center; padding:50px 20px; background:var(--bg-card); border:1px solid var(--border); border-radius:14px;">
        <div style="color:var(--text-muted); margin-bottom:10px;">
          ${ICONS.folder}
        </div>
        <h3 style="margin:0 0 6px; font-size:1rem; color:var(--text);">This folder is empty</h3>
        <p style="margin:0 0 16px; font-size:0.84rem; color:var(--text-secondary);">Right-click or hold on files/folders to access the Finder menu.</p>
        <div style="display:flex; justify-content:center; gap:8px;">
          <button type="button" class="btn btn-secondary btn-sm" data-act="new-file" style="display:inline-flex; align-items:center; gap:5px;">
            ${ICONS.plus}
            <span>New File</span>
          </button>
          <button type="button" class="btn btn-secondary btn-sm" data-act="new-folder" style="display:inline-flex; align-items:center; gap:5px;">
            ${ICONS.folderPlus}
            <span>New Folder</span>
          </button>
        </div>
      </div>
    `;
  }

  if (currentLayout === 'grid') {
    return `
      <div class="sv-grid-view" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(110px, 1fr)); gap:16px 12px; justify-items:center; padding:12px; background:var(--bg-card); border:1px solid var(--border); border-radius:14px; min-height:360px;">
        ${items.map(item => renderGridIcon(item, selected)).join('')}
      </div>
    `;
  }

  if (currentLayout === 'list') {
    return `
      <div class="sv-list-view" style="background:var(--bg-card); border:1px solid var(--border); border-radius:14px; overflow:hidden;">
        <div style="padding:10px 16px; background:var(--bg-subtle); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; font-size:0.75rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.04em;">
          <span style="flex:2;">Name</span>
          <span style="width:100px;">Size</span>
          <span style="width:140px;">Modified</span>
          <span style="width:90px; text-align:right;">Tags</span>
        </div>
        <div style="display:flex; flex-direction:column;">
          ${items.map(item => renderListRow(item, selected)).join('')}
        </div>
      </div>
    `;
  }

  // Default: Split Master/Detail View
  return `
    <div class="sv-split-view" style="display:grid; grid-template-columns:360px 1fr; gap:16px; min-height:560px; align-items:start;">
      <!-- Master: Files List -->
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:14px; overflow:hidden; max-height:680px; overflow-y:auto; display:flex; flex-direction:column;">
        <div style="padding:10px 14px; background:var(--bg-subtle); border-bottom:1px solid var(--border); font-size:0.75rem; font-weight:700; color:var(--text-secondary);">
          ITEMS IN ${escapeHtml(currentPath.toUpperCase())} (${items.length})
        </div>
        <div style="display:flex; flex-direction:column;">
          ${items.map(item => renderSplitItem(item, selected)).join('')}
        </div>
      </div>

      <!-- Detail: File Inspector / Content Preview Pane -->
      <div class="sv-detail-pane" style="background:var(--bg-card); border:1px solid var(--border); border-radius:14px; overflow:hidden; min-height:560px; display:flex; flex-direction:column;">
        ${selected ? renderDetailPane(selected) : `
          <div style="display:flex; align-items:center; justify-content:center; flex:1; color:var(--text-muted); font-size:0.88rem; padding:40px;">
            Select a file to view and inspect its contents. Right-click or hold for options.
          </div>
        `}
      </div>
    </div>
  `;
}

/* OS-Style Vertical Icon Grid Item (Mac Finder / Windows Explorer) */
function renderGridIcon(item, selected) {
  const isSelected = selected && (selected.path === item.path || selected.id === item.id);
  const clickAction = item.isDirectory ? `data-nav-path="${escapeHtml(item.path)}"` : `data-pick="${escapeHtml(item.id || item.path)}"`;

  // Image thumbnail support
  const isImg = !item.isDirectory && /\.(png|jpe?g|webp|gif|svg)$/i.test(item.name);
  let iconHtml;
  if (isImg && (item.dataUrl || item.thumbnail || (typeof item.content === 'string' && item.content.startsWith('data:image')))) {
    const src = item.thumbnail || item.dataUrl || item.content;
    iconHtml = `<img src="${escapeHtml(src)}" alt="${escapeHtml(item.name)}" style="max-width:54px; max-height:54px; object-fit:contain; border-radius:6px; box-shadow:0 2px 6px rgba(0,0,0,0.12);" />`;
  } else if (item.isDirectory) {
    iconHtml = `<div style="color:var(--text); transform:scale(1.4);">${ICONS.folder}</div>`;
  } else {
    iconHtml = getFileTypeIcon(item.name, item.kind, 44);
  }

  return `
    <div class="sv-grid-icon ${isSelected ? 'is-selected' : ''}" 
         data-context-target="true" 
         data-path="${escapeHtml(item.path)}" 
         data-is-dir="${item.isDirectory ? 'true' : 'false'}"
         draggable="true"
         ${clickAction}
         style="display:flex; flex-direction:column; align-items:center; text-align:center; width:110px; padding:12px 8px; border-radius:10px; cursor:pointer; user-select:none; transition:all 0.15s ease; position:relative; background:${isSelected ? 'rgba(59,130,246,0.12)' : 'transparent'}; border:1px solid ${isSelected ? 'rgba(59,130,246,0.35)' : 'transparent'};">
      
      <!-- Icon / Thumbnail Container -->
      <div style="width:58px; height:58px; display:flex; align-items:center; justify-content:center; margin-bottom:6px; position:relative;">
        ${iconHtml}
      </div>

      <!-- Centered Filename underneath -->
      <div style="font-size:0.8rem; font-weight:600; color:var(--text); width:100%; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; word-break:break-word; line-height:1.25; margin-bottom:2px;" title="${escapeHtml(item.name)}">
        ${escapeHtml(item.name)}
      </div>

      <!-- Centered Metadata underneath (Size or Folder) -->
      <div style="font-size:0.7rem; color:var(--text-muted); font-family:var(--mono); width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
        ${item.isDirectory ? 'Folder' : size(item.size || 0)}
      </div>

      <!-- Tags indicator -->
      ${renderTagDots(item.tags)}
    </div>
  `;
}

function renderListRow(item, selected) {
  const isSelected = selected && (selected.path === item.path || selected.id === item.id);
  const icon = item.isDirectory ? ICONS.folder : getFileTypeIcon(item.name, item.kind, 16);
  const clickAction = item.isDirectory ? `data-nav-path="${escapeHtml(item.path)}"` : `data-pick="${escapeHtml(item.id || item.path)}"`;

  return `
    <div class="sv-row ${isSelected ? 'is-selected' : ''}" 
         data-context-target="true"
         data-path="${escapeHtml(item.path)}"
         data-is-dir="${item.isDirectory ? 'true' : 'false'}"
         draggable="true"
         ${clickAction} 
         style="padding:10px 16px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; cursor:pointer; background:${isSelected ? 'var(--bg-subtle)' : 'transparent'};">
      <div style="flex:2; display:flex; align-items:center; gap:10px; overflow:hidden; padding-right:12px;">
        <span style="color:var(--text); flex-shrink:0;">${icon}</span>
        <span style="font-weight:600; font-size:0.86rem; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          ${escapeHtml(item.name)}
        </span>
      </div>
      <div style="width:100px; font-size:0.78rem; color:var(--text-secondary); font-family:var(--mono);">
        ${item.isDirectory ? 'Folder' : size(item.size || 0)}
      </div>
      <div style="width:140px; font-size:0.75rem; color:var(--text-muted);">
        ${item.updatedAt ? when(item.updatedAt) : ''}
      </div>
      <div style="width:90px; text-align:right; display:flex; justify-content:flex-end; align-items:center; gap:4px;">
        ${renderTagDots(item.tags)}
      </div>
    </div>
  `;
}

function renderSplitItem(item, selected) {
  const isSelected = selected && (selected.path === item.path || selected.id === item.id);
  const icon = item.isDirectory ? ICONS.folder : getFileTypeIcon(item.name, item.kind, 16);
  const clickAction = item.isDirectory ? `data-nav-path="${escapeHtml(item.path)}"` : `data-pick="${escapeHtml(item.id || item.path)}"`;

  return `
    <div class="sv-split-item ${isSelected ? 'is-selected' : ''}" 
         data-context-target="true"
         data-path="${escapeHtml(item.path)}"
         data-is-dir="${item.isDirectory ? 'true' : 'false'}"
         draggable="true"
         ${clickAction} 
         style="padding:10px 14px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; cursor:pointer; background:${isSelected ? 'var(--bg-subtle)' : 'transparent'};">
      <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
        <span style="color:var(--text); flex-shrink:0;">${icon}</span>
        <div style="overflow:hidden;">
          <div style="font-weight:600; font-size:0.84rem; color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${escapeHtml(item.name)}
          </div>
          <div style="font-size:0.7rem; color:var(--text-muted); display:flex; align-items:center; gap:6px;">
            <span>${item.isDirectory ? 'Folder' : size(item.size || 0)}</span>
            ${renderTagDots(item.tags)}
          </div>
        </div>
      </div>
      ${item.isDirectory ? `<span style="color:var(--text-muted);">${ICONS.chevronRight}</span>` : ''}
    </div>
  `;
}

function renderDetailPane(selected) {
  const isCsv = selected.name.endsWith('.csv') || selected.kind === 'csv';
  const isImage = /\.(png|jpe?g|webp|gif|svg)$/i.test(selected.name);
  const isZip = selected.name.endsWith('.zip') || selected.kind === 'archive';
  const tools = toolsAccepting(selected.kind || kindFromFilename(selected.name));

  return `
    <div style="display:flex; flex-direction:column; height:100%;">
      
      <!-- Detail Header -->
      <div style="padding:14px 18px; border-bottom:1px solid var(--border); background:var(--bg-subtle); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div style="display:flex; align-items:center; gap:10px; overflow:hidden;">
          <div style="color:var(--text); flex-shrink:0;">
            ${getFileTypeIcon(selected.name, selected.kind, 22)}
          </div>
          <div style="overflow:hidden;">
            <input type="text" class="sv-rename" value="${escapeHtml(selected.name)}" data-path="${escapeHtml(selected.path || '')}" style="font-weight:700; font-size:0.96rem; color:var(--text); background:transparent; border:none; border-bottom:1px dashed var(--border); outline:none; padding:2px 4px; max-width:280px;">
            <div style="font-size:0.74rem; color:var(--text-muted); margin-top:2px; display:flex; align-items:center; gap:8px;">
              <span>${size(selected.size || selected.bytes || 0)} · ${selected.updatedAt ? when(selected.updatedAt) : ''}</span>
              ${renderTagDots(selected.tags)}
            </div>
          </div>
        </div>

        <!-- Content View Switcher & Action Buttons -->
        <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
          ${!isImage ? `
            <div class="sv-content-view-switcher" style="display:flex; background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:2px;">
              <button type="button" class="sv-cview-btn ${currentContentView === 'formatted' ? 'active' : ''}" data-cview="formatted" title="Formatted Render" style="padding:3px 7px; border:none; background:none; cursor:pointer; font-size:0.75rem; border-radius:5px; color:var(--text);">
                Formatted
              </button>
              ${isCsv ? `
                <button type="button" class="sv-cview-btn ${currentContentView === 'table' ? 'active' : ''}" data-cview="table" title="Data Table" style="padding:3px 7px; border:none; background:none; cursor:pointer; font-size:0.75rem; border-radius:5px; color:var(--text);">
                  ${ICONS.table} Table
                </button>
              ` : ''}
              <button type="button" class="sv-cview-btn ${currentContentView === 'raw' ? 'active' : ''}" data-cview="raw" title="Raw Text" style="padding:3px 7px; border:none; background:none; cursor:pointer; font-size:0.75rem; border-radius:5px; color:var(--text);">
                Raw
              </button>
            </div>
          ` : ''}

          <!-- Open in tool handoff buttons -->
          ${tools.slice(0, 2).map(toolId => {
            const t = BY_ID[toolId];
            return `<button type="button" class="btn btn-secondary btn-sm sv-open-btn" data-open="${toolId}" title="Open in ${t?.title || toolId}" style="font-size:0.75rem; padding:4px 8px;">Open in ${escapeHtml(t?.title || toolId)}</button>`;
          }).join('')}

          ${isZip ? `
            <button type="button" class="btn btn-secondary btn-sm" data-act="extract-archive" data-file-path="${escapeHtml(selected.path)}" title="Unpack archive into current directory" style="font-size:0.75rem; padding:4px 8px; display:inline-flex; align-items:center; gap:4px;">
              ${ICONS.zip} Extract
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Preview Body -->
      <div class="sv-preview" style="flex:1; overflow:auto; padding:18px;">
        ${renderContentBody(selected)}
      </div>
    </div>
  `;
}

function renderContentBody(file) {
  if (/\.(png|jpe?g|webp|gif|svg)$/i.test(file.name)) {
    return `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:300px; background:var(--bg-subtle); border-radius:10px; padding:20px;">
        <img src="${escapeHtml(file.content || file.dataUrl || '')}" alt="${escapeHtml(file.name)}" style="max-width:100%; max-height:420px; object-fit:contain; border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,0.1);">
      </div>
    `;
  }

  const text = file.text || file.content || '';

  if (currentContentView === 'table' && (file.name.endsWith('.csv') || file.kind === 'csv')) {
    return renderCsvTable(text);
  }

  if (currentContentView === 'raw') {
    return `
      <pre style="margin:0; font-family:var(--mono); font-size:0.82rem; line-height:1.5; color:var(--text); white-space:pre-wrap; word-break:break-all;">${escapeHtml(text)}</pre>
    `;
  }

  // Formatted view
  if (file.name.endsWith('.md') || file.kind === 'markdown') {
    return `<div class="sv-md" style="font-size:0.88rem; line-height:1.6; color:var(--text);">${renderMarkdown(text)}</div>`;
  }

  return `
    <pre style="margin:0; font-family:var(--mono); font-size:0.82rem; line-height:1.5; color:var(--text); white-space:pre-wrap; word-break:break-all;">${escapeHtml(text)}</pre>
  `;
}

function renderCsvTable(csvText) {
  const lines = String(csvText || '').trim().split('\n').map(l => l.split(','));
  if (!lines.length || !lines[0].length) {
    return '<p style="color:var(--text-muted);">Empty table.</p>';
  }
  const headers = lines[0];
  const rows = lines.slice(1, 40);

  return `
    <div style="overflow-x:auto; border:1px solid var(--border); border-radius:8px;">
      <table style="width:100%; border-collapse:collapse; font-size:0.8rem; text-align:left; font-family:var(--sans);">
        <thead>
          <tr style="background:var(--bg-subtle); border-bottom:1px solid var(--border);">
            ${headers.map(h => `<th style="padding:8px 12px; font-weight:700; color:var(--text);">${escapeHtml(h.trim())}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr style="border-bottom:1px solid var(--border);">
              ${r.map(cell => `<td style="padding:6px 12px; color:var(--text); font-family:var(--mono);">${escapeHtml(cell.trim())}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderMarkdown(md) {
  let html = escapeHtml(md);
  html = html.replace(/^### (.*$)/gim, '<h3 style="font-size:1rem; font-weight:700; margin:14px 0 6px; color:var(--text);">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="font-size:1.15rem; font-weight:700; margin:16px 0 8px; color:var(--text);">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="font-size:1.35rem; font-weight:800; margin:20px 0 10px; color:var(--text);">$1</h1>');
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
  html = html.replace(/```([\s\S]*?)```/gim, '<pre style="background:var(--bg-card); padding:10px; border-radius:6px; border:1px solid var(--border); font-family:var(--mono); font-size:0.8rem; overflow-x:auto;">$1</pre>');
  html = html.replace(/`([^`]+)`/gim, '<code style="background:var(--bg-card); padding:2px 5px; border-radius:4px; font-family:var(--mono); font-size:0.82rem; border:1px solid var(--border);">$1</code>');
  html = html.replace(/^\- (.*$)/gim, '<li style="margin-left:18px; margin-bottom:4px;">$1</li>');
  html = html.replace(/\n\n/gim, '<br><br>');
  return html;
}

function storageNote() {
  return store.persistent
    ? `<p class="sv-note" style="margin-top:16px; font-size:0.75rem; color:var(--text-muted); line-height:1.5;">Offline Files are persisted locally in browser IndexedDB. No account required. Files remain accessible offline.</p>`
    : `<p class="sv-note is-warn" style="margin-top:16px; font-size:0.75rem; color:#f59e0b; line-height:1.5;">Private browsing mode detected. Files persist during this session. Download files to keep them permanently.</p>`;
}

/* ---------------- Event Wiring ---------------- */

function wire(host, selected, refresh) {
  let current = selected;

  const importer = document.createElement('input');
  importer.type = 'file';
  importer.accept = 'application/json,.json';
  importer.hidden = true;
  host.appendChild(importer);

  const uploader = document.createElement('input');
  uploader.type = 'file';
  uploader.multiple = true;
  uploader.hidden = true;
  host.appendChild(uploader);

  const flash = (message, tone = 'good') => {
    let el = host.querySelector('.sv-flash');
    if (!el) {
      el = document.createElement('p');
      el.className = 'sv-flash';
      el.style.cssText = 'padding:10px 14px; border-radius:8px; font-size:0.84rem; margin-bottom:12px; font-weight:600;';
      host.prepend(el);
    }
    el.textContent = message;
    el.style.background = tone === 'bad' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)';
    el.style.color = tone === 'bad' ? '#ef4444' : '#10b981';
    el.style.border = `1px solid ${tone === 'bad' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`;
    setTimeout(() => { if (el && el.parentNode) el.remove(); }, 3500);
  };

  const searchBox = host.querySelector('#sv-search-box');
  if (searchBox) {
    searchBox.addEventListener('input', () => {
      currentSearch = searchBox.value.trim();
      refresh(current?.id || null);
    });
  }

  // Context Menu: Mac Finder style popup
  function openContextMenu(x, y, targetPath, isDir) {
    const existing = document.getElementById('sv-finder-menu');
    if (existing) existing.remove();

    const baseName = getBaseName(targetPath);
    const itemRecord = fs.statSync(targetPath) || {};
    const tags = itemRecord.tags || [];

    const menu = document.createElement('div');
    menu.id = 'sv-finder-menu';
    menu.className = 'finder-context-menu';
    menu.style.cssText = `
      position: fixed;
      z-index: 10000;
      min-width: 200px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 6px;
      box-shadow: 0 16px 36px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.12);
      backdrop-filter: blur(16px);
      font-family: var(--sans);
      font-size: 0.84rem;
    `;

    menu.innerHTML = `
      <div style="padding: 4px 10px 8px; font-size: 0.72rem; color: var(--text-muted); font-weight: 700; border-bottom: 1px solid var(--border); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${escapeHtml(baseName)}
      </div>
      
      <div class="finder-menu-item" data-cmenu="open" style="padding: 6px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; margin-top: 4px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        <span>Open</span>
      </div>

      <div class="finder-menu-item" data-cmenu="rename" style="padding: 6px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        <span>Rename</span>
      </div>

      <div style="margin: 4px 0; border-top: 1px solid var(--border);"></div>

      <!-- Tags Row -->
      <div style="padding: 6px 10px; display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Tags</span>
        <div style="display: flex; gap: 6px;">
          ${Object.entries(TAG_COLORS).map(([tKey, color]) => `
            <span class="finder-tag-dot" data-set-tag="${tKey}" title="Tag ${tKey}" style="width: 14px; height: 14px; border-radius: 50%; background: ${color}; cursor: pointer; box-shadow: ${tags.includes(tKey) ? '0 0 0 2px var(--text)' : 'none'};"></span>
          `).join('')}
        </div>
      </div>

      <div style="margin: 4px 0; border-top: 1px solid var(--border);"></div>

      <div class="finder-menu-item" data-cmenu="download" style="padding: 6px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>${isDir ? 'Download as ZIP' : 'Download'}</span>
      </div>

      <div style="margin: 4px 0; border-top: 1px solid var(--border);"></div>

      <div class="finder-menu-item" data-cmenu="delete" style="padding: 6px 12px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 8px; color: #ef4444;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        <span>Delete ${isDir ? 'Folder' : 'File'}</span>
      </div>
    `;

    document.body.appendChild(menu);

    // Position clamping
    const rect = menu.getBoundingClientRect();
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - 10) left = window.innerWidth - rect.width - 10;
    if (top + rect.height > window.innerHeight - 10) top = window.innerHeight - rect.height - 10;
    menu.style.left = `${Math.max(10, left)}px`;
    menu.style.top = `${Math.max(10, top)}px`;

    menu.addEventListener('click', async (me) => {
      const tagTarget = me.target.closest('[data-set-tag]');
      if (tagTarget) {
        const clickedTag = tagTarget.dataset.setTag;
        const currentTags = await fs.getTags(targetPath);
        const nextTags = currentTags.includes(clickedTag)
          ? currentTags.filter(t => t !== clickedTag)
          : [...currentTags, clickedTag];
        await fs.setTags(targetPath, nextTags);
        flash(`Updated tags for "${baseName}".`);
        menu.remove();
        refresh(null);
        return;
      }

      const itemTarget = me.target.closest('[data-cmenu]');
      if (!itemTarget) return;
      const act = itemTarget.dataset.cmenu;
      menu.remove();

      if (act === 'open') {
        if (isDir) {
          currentPath = targetPath;
          refresh(null);
        } else {
          refresh(targetPath);
        }
      } else if (act === 'rename') {
        const nextName = prompt('New name:', baseName);
        if (nextName && nextName.trim() && nextName.trim() !== baseName) {
          try {
            await fs.rename(targetPath, nextName.trim());
            flash(`Renamed to "${nextName.trim()}".`);
            refresh(null);
          } catch (err) {
            flash(err.message, 'bad');
          }
        }
      } else if (act === 'download') {
        try {
          if (isDir) {
            const destZip = normalizePath(`${targetPath}.zip`);
            await fs.compressDirectory(targetPath, destZip);
            const blob = await fs.readFile(destZip, { encoding: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = getBaseName(destZip);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            flash(`Downloaded "${getBaseName(destZip)}".`);
          } else {
            const blob = await fs.readFile(targetPath, { encoding: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = baseName;
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            flash(`Downloaded "${baseName}".`);
          }
        } catch (err) {
          flash(`Download failed: ${err.message}`, 'bad');
        }
      } else if (act === 'delete') {
        const itemType = isDir ? 'folder' : 'file';
        if (confirm(`Are you sure you want to permanently delete ${itemType} "${baseName}"${isDir ? ' and all its contents' : ''}?`)) {
          try {
            await fs.delete(targetPath);
            flash(`Deleted ${itemType} "${baseName}".`);
            refresh(null);
          } catch (err) {
            flash(err.message, 'bad');
          }
        }
      }
    });
  }

  // ---------------- Drag & Drop in Files ----------------
  let dragCounter = 0;

  const onDragEnter = (e) => {
    e.preventDefault();
    dragCounter++;
    host.classList.add('sv-drag-active');
  };

  const onDragOver = (e) => {
    e.preventDefault();
    const folderTarget = e.target.closest('[data-is-dir="true"]');
    if (folderTarget) {
      folderTarget.classList.add('sv-folder-drop-hover');
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    } else {
      host.querySelectorAll('.sv-folder-drop-hover').forEach(el => el.classList.remove('sv-folder-drop-hover'));
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    }
  };

  const onDragLeave = (e) => {
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      host.classList.remove('sv-drag-active');
    }
    const folderTarget = e.target.closest('[data-is-dir="true"]');
    if (folderTarget) {
      folderTarget.classList.remove('sv-folder-drop-hover');
    }
  };

  const onDrop = async (e) => {
    e.preventDefault();
    dragCounter = 0;
    host.classList.remove('sv-drag-active');
    host.querySelectorAll('.sv-folder-drop-hover').forEach(el => el.classList.remove('sv-folder-drop-hover'));

    // 1. Check if internal item was dropped onto a folder
    const internalSource = e.dataTransfer ? (e.dataTransfer.getData('application/toolbox-path') || e.dataTransfer.getData('text/plain')) : null;
    const folderTarget = e.target.closest('[data-is-dir="true"]') || e.target.closest('[data-nav-path]');

    if (internalSource && folderTarget) {
      const targetDir = folderTarget.dataset.path || folderTarget.dataset.navPath;
      if (targetDir && targetDir !== internalSource && targetDir !== getParentPath(internalSource)) {
        try {
          const dest = normalizePath(`${targetDir}/${getBaseName(internalSource)}`);
          await fs.rename(internalSource, dest);
          flash(`Moved "${getBaseName(internalSource)}" to "${getBaseName(targetDir) || 'Root'}".`);
          refresh(null);
          return;
        } catch (err) {
          flash(`Move failed: ${err.message}`, 'bad');
          return;
        }
      }
    }

    // 2. Check if desktop/OS files were dropped
    const droppedFiles = Array.from(e.dataTransfer?.files || []);
    if (droppedFiles.length > 0) {
      const destDir = (folderTarget && folderTarget.dataset.isDir === 'true') ? folderTarget.dataset.path : currentPath;
      let successCount = 0;
      for (const f of droppedFiles) {
        try {
          const dest = normalizePath(`${destDir}/${f.name}`);
          await fs.writeFile(dest, f, {
            mimeType: f.type || 'application/octet-stream',
            storage: currentStorage
          });
          successCount++;
        } catch (err) {
          console.warn(`Failed to save dropped file ${f.name}:`, err);
        }
      }
      if (successCount > 0) {
        flash(`Added ${successCount} file${successCount === 1 ? '' : 's'} to ${escapeHtml(getBaseName(destDir) || 'Files')}.`);
        refresh(null);
      }
    }
  };

  const onDragStart = (e) => {
    const itemEl = e.target.closest('[data-path]');
    if (!itemEl) return;
    const itemPath = itemEl.dataset.path;
    if (itemPath && e.dataTransfer) {
      e.dataTransfer.setData('application/toolbox-path', itemPath);
      e.dataTransfer.setData('text/plain', itemPath);
      e.dataTransfer.effectAllowed = 'move';
      itemEl.classList.add('is-dragging');
    }
  };

  const onDragEnd = (e) => {
    const itemEl = e.target.closest('[data-path]');
    if (itemEl) itemEl.classList.remove('is-dragging');
    host.querySelectorAll('.sv-folder-drop-hover').forEach(el => el.classList.remove('sv-folder-drop-hover'));
  };

  host.addEventListener('dragenter', onDragEnter);
  host.addEventListener('dragover', onDragOver);
  host.addEventListener('dragleave', onDragLeave);
  host.addEventListener('drop', onDrop);
  host.addEventListener('dragstart', onDragStart);
  host.addEventListener('dragend', onDragEnd);

  // Right-click contextmenu event
  const onContextMenu = (e) => {
    const target = e.target.closest('[data-context-target]');
    if (target) {
      e.preventDefault();
      const p = target.dataset.path;
      const isDir = target.dataset.isDir === 'true';
      openContextMenu(e.clientX, e.clientY, p, isDir);
    }
  };
  host.addEventListener('contextmenu', onContextMenu);

  // Touchscreen long-press (500ms)
  let touchTimer = null;
  let touchMoved = false;

  const onTouchStart = (e) => {
    const target = e.target.closest('[data-context-target]');
    if (!target) return;
    touchMoved = false;
    const touch = e.touches[0];
    const cx = touch.clientX;
    const cy = touch.clientY;
    const p = target.dataset.path;
    const isDir = target.dataset.isDir === 'true';

    touchTimer = setTimeout(() => {
      if (!touchMoved) {
        try { navigator.vibrate?.(20); } catch {}
        openContextMenu(cx, cy, p, isDir);
      }
    }, 500);
  };

  const onTouchMove = () => {
    touchMoved = true;
    if (touchTimer) clearTimeout(touchTimer);
  };

  const onTouchEnd = () => {
    if (touchTimer) clearTimeout(touchTimer);
  };

  host.addEventListener('touchstart', onTouchStart, { passive: true });
  host.addEventListener('touchmove', onTouchMove, { passive: true });
  host.addEventListener('touchend', onTouchEnd, { passive: true });

  const dismissMenu = (me) => {
    const menu = document.getElementById('sv-finder-menu');
    if (menu && !menu.contains(me.target)) {
      menu.remove();
    }
  };
  window.addEventListener('click', dismissMenu);
  window.addEventListener('scroll', dismissMenu, { passive: true });

  const onClick = async (e) => {
    // Tag filter pill click
    const tagFilterBtn = e.target.closest('[data-filter-tag]');
    if (tagFilterBtn) {
      const tag = tagFilterBtn.dataset.filterTag;
      currentTagFilter = tag === 'all' ? null : tag;
      refresh(current?.id || null);
      return;
    }

    // Storage Switcher (Offline / Online)
    const storageBtn = e.target.closest('.sv-storage-btn');
    if (storageBtn) {
      currentStorage = storageBtn.dataset.storage || 'offline';
      currentPath = currentStorage === 'online' ? '/Online' : '/Home';
      refresh(null);
      return;
    }

    // Breadcrumb navigation
    const navPathBtn = e.target.closest('[data-nav-path]');
    if (navPathBtn) {
      currentPath = navPathBtn.dataset.navPath || '/Home';
      refresh(null);
      return;
    }

    // Layout switcher
    const layoutBtn = e.target.closest('.sv-layout-btn');
    if (layoutBtn) {
      currentLayout = layoutBtn.dataset.layout || 'grid';
      refresh(current?.id || null);
      return;
    }

    // Content view switcher
    const cviewBtn = e.target.closest('.sv-cview-btn');
    if (cviewBtn) {
      currentContentView = cviewBtn.dataset.cview || 'formatted';
      refresh(current?.id || null);
      return;
    }

    // Pick file
    const pick = e.target.closest('[data-pick]')?.dataset.pick;
    if (pick) {
      history.replaceState(null, '', `#files/${encodeURIComponent(pick)}`);
      refresh(pick);
      return;
    }

    // Open in other tool
    const openIn = e.target.closest('[data-open]')?.dataset.open;
    if (openIn && current) {
      store.handOff({ ...current });
      window.location.hash = `#${openIn}`;
      return;
    }

    const actBtn = e.target.closest('[data-act]');
    const act = actBtn?.dataset.act;

    if (act === 'nav-up') {
      currentPath = getParentPath(currentPath);
      refresh(null);
      return;
    }

    if (act === 'new-folder') {
      const name = prompt('Folder Name:');
      if (name && name.trim()) {
        const clean = name.trim().replace(/[/\\?%*:|"<>]/g, '-');
        const target = normalizePath(`${currentPath}/${clean}`);
        try {
          await fs.mkdir(target, { storage: currentStorage });
          flash(`Folder "${clean}" created.`);
          refresh(null);
        } catch (err) {
          flash(err.message, 'bad');
        }
      }
      return;
    }

    if (act === 'new-file') {
      const name = prompt('File Name (with extension, e.g. document.txt):');
      if (name && name.trim()) {
        const clean = name.trim().replace(/[/\\?%*:|"<>]/g, '-');
        const target = normalizePath(`${currentPath}/${clean}`);
        try {
          await fs.writeFile(target, '', { storage: currentStorage });
          flash(`File "${clean}" created.`);
          refresh(target);
        } catch (err) {
          flash(err.message, 'bad');
        }
      }
      return;
    }

    if (act === 'upload') {
      uploader.click();
      return;
    }

    if (act === 'compress-current') {
      const folderName = getBaseName(currentPath) || 'archive';
      const destZip = normalizePath(`${currentPath}/${folderName}.zip`);
      try {
        await fs.compressDirectory(currentPath, destZip);
        flash(`Folder compressed to ${folderName}.zip.`);
        refresh(destZip);
      } catch (err) {
        flash(err.message, 'bad');
      }
      return;
    }

    if (act === 'extract-archive') {
      const filePath = actBtn.dataset.filePath || current?.path;
      if (filePath) {
        try {
          const targetDir = currentPath;
          const extracted = await fs.extractArchive(filePath, targetDir);
          flash(`Extracted ${extracted.length} file(s) into current directory.`);
          refresh(null);
        } catch (err) {
          flash(err.message, 'bad');
        }
      }
      return;
    }

    if (act === 'import') { importer.click(); return; }

    if (act === 'export-all') {
      const n = store.exportAll();
      flash(`Downloaded ${n} item${n === 1 ? '' : 's'}.`);
      return;
    }

    if (act === 'export-one' || act === 'download-file') {
      const filePath = actBtn.dataset.filePath || current?.path;
      if (filePath) {
        try {
          const blob = await fs.readFile(filePath, { encoding: 'blob', storage: currentStorage });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = getBaseName(filePath);
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          flash(`Downloaded ${getBaseName(filePath)}.`);
        } catch (err) {
          flash(`Download failed: ${err.message}`, 'bad');
        }
      } else if (current) {
        store.exportOne(current);
        flash(`Downloaded ${current.name}.`);
      }
      return;
    }

    if (act === 'delete') {
      const filePath = actBtn.dataset.filePath || current?.path;
      const targetName = filePath ? getBaseName(filePath) : (current?.name || 'file');

      if (confirm(`Are you sure you want to permanently delete "${targetName}"?`)) {
        try {
          if (filePath) {
            await fs.delete(filePath);
          } else if (current?.id) {
            store.remove(current.id);
          }
          flash(`Deleted "${targetName}".`);
          history.replaceState(null, '', '#files');
          refresh(null);
        } catch (err) {
          flash(err.message, 'bad');
        }
      }
    }
  };

  const onRename = async (e) => {
    if (!e.target.classList.contains('sv-rename') || !current) return;
    const newName = e.target.value.trim();
    if (!newName || newName === current.name) return;

    try {
      if (current.path) {
        await fs.rename(current.path, newName);
      } else if (current.id) {
        store.rename(current.id, newName);
      }
      flash(`Renamed to "${newName}".`);
      refresh(null);
    } catch (err) {
      flash(err.message, 'bad');
    }
  };

  const onUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    let successCount = 0;
    for (const f of files) {
      try {
        const dest = normalizePath(`${currentPath}/${f.name}`);
        await fs.writeFile(dest, f, {
          mimeType: f.type || 'application/octet-stream',
          storage: currentStorage
        });
        successCount++;
      } catch (err) {
        console.warn(`Failed to upload ${f.name}:`, err);
      }
    }
    flash(`Uploaded ${successCount} file(s).`);
    e.target.value = '';
    refresh(null);
  };

  const onImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const n = store.importAll(text);
      flash(`Imported ${n} artifact${n === 1 ? '' : 's'}.`);
      e.target.value = '';
      refresh(null);
    } catch (err) {
      flash(`Import failed: ${err.message}`, 'bad');
    }
  };

  host.addEventListener('click', onClick);
  host.addEventListener('change', onRename);
  uploader.addEventListener('change', onUpload);
  importer.addEventListener('change', onImport);

  return () => {
    host.removeEventListener('click', onClick);
    host.removeEventListener('change', onRename);
    host.removeEventListener('dragenter', onDragEnter);
    host.removeEventListener('dragover', onDragOver);
    host.removeEventListener('dragleave', onDragLeave);
    host.removeEventListener('drop', onDrop);
    host.removeEventListener('dragstart', onDragStart);
    host.removeEventListener('dragend', onDragEnd);
    host.removeEventListener('contextmenu', onContextMenu);
    host.removeEventListener('touchstart', onTouchStart);
    host.removeEventListener('touchmove', onTouchMove);
    host.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('click', dismissMenu);
    window.removeEventListener('scroll', dismissMenu);
    const m = document.getElementById('sv-finder-menu');
    if (m) m.remove();
  };
}
