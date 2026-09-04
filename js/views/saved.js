/* ============================================================
   TOOLBOX — Files & Saved Work
   Interactive multi-view files manager (Grid, List, and Split views)
   with rich content inspectors (Formatted, Table, and Raw) and full
   theme adaptivity. Strictly uses minimal vector SVG icons with zero emojis.
   ============================================================ */

import * as store from '../lib/artifacts.js';
import { kindLabel } from '../registry/kinds.js';
import { BY_ID, toolsAccepting } from '../registry/index.js';

const escapeHtml = (s) => String(s || '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const when = (ts) => new Date(ts).toLocaleDateString(undefined, {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const size = (bytes) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`);

// Minimal vector SVG icons (strictly no emojis)
const ICONS = {
  file: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
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
};

// UI state preserved across refreshes in current session
let currentLayout = 'split'; // 'split' | 'grid' | 'list'
let currentContentView = 'formatted'; // 'formatted' | 'table' | 'raw'
let currentSearch = '';

/**
 * @param {HTMLElement} host
 * @param {string|null} selectedId
 * @returns {() => void} teardown
 */
export function renderSaved(host, selectedId = null) {
  let teardown = () => {};

  const refresh = (nextId = null) => {
    teardown();
    teardown = paint(host, nextId, refresh);
  };

  refresh(selectedId);
  return () => teardown();
}

function paint(host, selectedId, refresh) {
  const allItems = store.list();
  
  // Filter by search query
  const items = currentSearch
    ? allItems.filter(m => m.name.toLowerCase().includes(currentSearch.toLowerCase()) || m.kind.toLowerCase().includes(currentSearch.toLowerCase()))
    : allItems;

  const selected = selectedId && allItems.some(m => m.id === selectedId)
    ? store.get(selectedId)
    : (items.length ? store.get(items[0].id) : (allItems.length ? store.get(allItems[0].id) : null));

  host.innerHTML = allItems.length ? full(allItems, items, selected) : empty();
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
        <a class="btn btn-primary" href="#tools">Browse tools</a>
        <button class="btn btn-secondary" data-act="import" style="display:inline-flex; align-items:center; gap:6px;">
          ${ICONS.upload}
          <span>Open a saved file</span>
        </button>
      </div>
      <div style="margin-top:24px; text-align:left;">
        ${storageNote()}
      </div>
    </div>`;
}

function full(allItems, filteredItems, selected) {
  const use = store.usage();
  return `
    <div class="sv" style="max-width:1240px; margin:0 auto; display:flex; flex-direction:column; gap:16px;">
      <!-- TOOLBAR & HEADER -->
      <header class="sv-head" style="background:var(--bg-card); border:1px solid var(--border); border-radius:16px; padding:18px 22px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; box-shadow:0 4px 16px rgba(0,0,0,0.03);">
        <div>
          <div style="display:flex; align-items:center; gap:10px;">
            <h1 class="sv-title" style="margin:0; font-size:1.35rem; font-weight:700; color:var(--text);">Files</h1>
            <span style="font-size:0.75rem; font-weight:700; color:var(--text-secondary); background:var(--bg-subtle); border:1px solid var(--border); padding:2px 8px; border-radius:999px;">
              ${allItems.length}
            </span>
          </div>
          <p class="sv-lede" style="margin:4px 0 0; font-size:0.8rem; color:var(--text-secondary);">
            ${size(use.used)} stored locally offline
          </p>
        </div>

        <!-- SEARCH AND CONTROLS -->
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <!-- Search input -->
          <div style="position:relative; width:190px;">
            <input type="text" id="sv-search-box" class="tool-input" placeholder="Search files…" value="${escapeHtml(currentSearch)}" style="width:100%; height:34px; font-size:0.82rem; padding:0 8px 0 28px; border-radius:8px;">
            <div style="position:absolute; left:8px; top:9px; color:var(--text-muted); pointer-events:none;">
              ${ICONS.search}
            </div>
          </div>

          <!-- Multiple Layout Views Switcher -->
          <div class="sv-view-switcher" style="display:flex; background:var(--bg-subtle); padding:3px; border-radius:10px; border:1px solid var(--border);">
            <button type="button" class="sv-layout-btn ${currentLayout === 'split' ? 'active' : ''}" data-layout="split" title="Split Master/Detail View" style="padding:5px 8px; background:none; border:none; cursor:pointer; color:var(--text); border-radius:6px;">
              ${ICONS.split}
            </button>
            <button type="button" class="sv-layout-btn ${currentLayout === 'grid' ? 'active' : ''}" data-layout="grid" title="Card Grid View" style="padding:5px 8px; background:none; border:none; cursor:pointer; color:var(--text); border-radius:6px;">
              ${ICONS.grid}
            </button>
            <button type="button" class="sv-layout-btn ${currentLayout === 'list' ? 'active' : ''}" data-layout="list" title="Tabular List View" style="padding:5px 8px; background:none; border:none; cursor:pointer; color:var(--text); border-radius:6px;">
              ${ICONS.list}
            </button>
          </div>

          <!-- Actions -->
          <button class="btn btn-secondary btn-sm" data-act="import" title="Import JSON backup bundle" style="display:inline-flex; align-items:center; gap:6px;">
            ${ICONS.upload}
            <span>Open a file</span>
          </button>
          <button class="btn btn-secondary btn-sm" data-act="export-all" title="Download all files in bundle" style="display:inline-flex; align-items:center; gap:6px;">
            ${ICONS.download}
            <span>Download all</span>
          </button>
        </div>
      </header>

      <!-- MAIN BODY DISPLAY BASED ON ACTIVE VIEW -->
      ${renderMainBody(filteredItems, selected)}

      ${storageNote()}
    </div>`;
}

function renderMainBody(items, selected) {
  if (items.length === 0) {
    return `
      <div style="padding:48px 24px; text-align:center; background:var(--bg-card); border:1px solid var(--border); border-radius:14px; color:var(--text-muted);">
        No files match your search filter.
      </div>
    `;
  }

  if (currentLayout === 'grid') {
    return `
      <div class="sv-grid-wrap" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:14px;">
        ${items.map(m => {
          const isSelected = selected && m.id === selected.id;
          return `
            <div class="sv-grid-card ${isSelected ? 'is-selected' : ''}" data-pick="${m.id}" style="background:var(--bg-card); border:1px solid ${isSelected ? 'var(--text)' : 'var(--border)'}; border-radius:14px; padding:16px; cursor:pointer; display:flex; flex-direction:column; justify-content:space-between; gap:12px; transition:border-color 0.15s ease, transform 0.15s ease;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                  <span style="font-size:0.7rem; font-weight:700; text-transform:uppercase; padding:2px 8px; border-radius:999px; background:var(--bg-subtle); border:1px solid var(--border); color:var(--text);">
                    ${kindLabel(m.kind)}
                  </span>
                  <span style="font-size:0.75rem; color:var(--text-muted); font-family:var(--mono);">${size(m.bytes ?? 0)}</span>
                </div>
                <h3 style="margin:0 0 6px; font-size:0.95rem; font-weight:700; color:var(--text); word-break:break-all;">${escapeHtml(m.name)}</h3>
                <p style="margin:0; font-size:0.75rem; color:var(--text-secondary);">Saved ${when(m.updatedAt)}</p>
              </div>

              <!-- Preview snippet -->
              <div style="background:var(--bg-subtle); padding:8px 10px; border-radius:8px; border:1px solid var(--border-subtle); font-family:var(--mono); font-size:0.72rem; color:var(--text-secondary); max-height:60px; overflow:hidden; white-space:pre-wrap;">
                ${escapeHtml((m.text || '').slice(0, 120))}
              </div>

              <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-subtle); padding-top:10px;">
                <button type="button" class="btn btn-secondary btn-sm" data-pick="${m.id}" style="font-size:0.75rem; padding:4px 10px;">Inspect</button>
                <div style="display:flex; gap:6px;">
                  <button type="button" class="btn btn-secondary btn-sm" data-act="export-one" data-file-id="${m.id}" title="Download file" style="padding:4px 8px;">
                    ${ICONS.download}
                  </button>
                  <button type="button" class="btn btn-secondary btn-sm sv-danger" data-act="delete" data-file-id="${m.id}" title="Delete file" style="padding:4px 8px; color:#ef4444;">
                    ${ICONS.delete}
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
      ${selected ? `<section class="sv-detail" style="margin-top:16px;">${detail(selected)}</section>` : ''}
    `;
  }

  if (currentLayout === 'list') {
    return `
      <div class="sv-table-wrap" style="background:var(--bg-card); border:1px solid var(--border); border-radius:16px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.03);">
        <table style="width:100%; border-collapse:collapse; font-size:0.85rem; text-align:left;">
          <thead>
            <tr style="background:var(--bg-subtle); border-bottom:1px solid var(--border); color:var(--text-secondary); font-size:0.75rem; text-transform:uppercase; letter-spacing:0.04em;">
              <th style="padding:12px 16px;">File Name</th>
              <th style="padding:12px 16px;">Kind</th>
              <th style="padding:12px 16px;">Size</th>
              <th style="padding:12px 16px;">Saved On</th>
              <th style="padding:12px 16px; text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(m => {
              const isSelected = selected && m.id === selected.id;
              return `
                <tr class="sv-table-row ${isSelected ? 'is-selected' : ''}" data-pick="${m.id}" style="border-bottom:1px solid var(--border-subtle); cursor:pointer; background:${isSelected ? 'var(--bg-hover)' : 'transparent'};">
                  <td style="padding:12px 16px; font-weight:600; color:var(--text); display:flex; align-items:center; gap:8px;">
                    <span style="color:var(--text-muted);">${ICONS.file}</span>
                    <span>${escapeHtml(m.name)}</span>
                  </td>
                  <td style="padding:12px 16px;">
                    <span style="font-size:0.7rem; font-weight:700; text-transform:uppercase; padding:2px 8px; border-radius:999px; background:var(--bg-subtle); border:1px solid var(--border); color:var(--text);">
                      ${kindLabel(m.kind)}
                    </span>
                  </td>
                  <td style="padding:12px 16px; font-family:var(--mono); color:var(--text-secondary);">${size(m.bytes ?? 0)}</td>
                  <td style="padding:12px 16px; color:var(--text-secondary);">${when(m.updatedAt)}</td>
                  <td style="padding:12px 16px; text-align:right;">
                    <div style="display:inline-flex; gap:6px;">
                      <button type="button" class="btn btn-secondary btn-sm" data-act="export-one" data-file-id="${m.id}" title="Download file" style="padding:4px 8px;">
                        ${ICONS.download}
                      </button>
                      <button type="button" class="btn btn-secondary btn-sm sv-danger" data-act="delete" data-file-id="${m.id}" title="Delete file" style="padding:4px 8px; color:#ef4444;">
                        ${ICONS.delete}
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      ${selected ? `<section class="sv-detail" style="margin-top:16px;">${detail(selected)}</section>` : ''}
    `;
  }

  // Split View (Master / Detail)
  return `
    <div class="sv-body" style="display:grid; grid-template-columns:minmax(280px, 340px) 1fr; gap:16px; align-items:start;">
      <!-- Left sidebar list -->
      <ul class="sv-list" style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px; max-height:76vh; overflow-y:auto;">
        ${items.map(m => `
          <li>
            <button class="sv-item ${selected && m.id === selected.id ? 'is-open' : ''}" data-pick="${m.id}" style="width:100%; text-align:left; background:var(--bg-card); border:1px solid ${selected && m.id === selected.id ? 'var(--text)' : 'var(--border)'}; border-radius:12px; padding:12px 14px; cursor:pointer; display:flex; flex-direction:column; gap:4px; transition:border-color 0.15s ease;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:0.9rem; color:var(--text); word-break:break-all;">${escapeHtml(m.name)}</strong>
                <span style="font-size:0.68rem; font-weight:700; text-transform:uppercase; padding:2px 6px; border-radius:6px; background:var(--bg-subtle); color:var(--text-secondary);">
                  ${kindLabel(m.kind)}
                </span>
              </div>
              <div style="font-size:0.75rem; color:var(--text-secondary); display:flex; gap:6px;">
                <span>${size(m.bytes ?? 0)}</span>
                <span>·</span>
                <span>${when(m.updatedAt)}</span>
              </div>
            </button>
          </li>`).join('')}
      </ul>

      <!-- Right detail inspector -->
      <section class="sv-detail" style="background:var(--bg-card); border:1px solid var(--border); border-radius:16px; padding:20px 24px; box-shadow:0 4px 16px rgba(0,0,0,0.03);">
        ${selected ? detail(selected) : ''}
      </section>
    </div>
  `;
}

function detail(art) {
  const targets = toolsAccepting(art.kind);
  const isDataKind = art.kind === 'csv' || art.kind === 'json' || art.name.endsWith('.csv') || art.name.endsWith('.json');

  return `
    <div class="sv-detail-head" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px; border-bottom:1px solid var(--border); padding-bottom:14px;">
      <div style="flex:1; min-width:220px;">
        <input type="text" class="tool-input sv-rename" value="${escapeHtml(art.name)}" aria-label="File Name" spellcheck="false" style="font-size:1.05rem; font-weight:700; width:100%; border-radius:8px;">
      </div>
      <div class="sv-detail-actions" style="display:flex; align-items:center; gap:8px;">
        <button class="btn btn-secondary btn-sm" data-act="export-one" style="display:inline-flex; align-items:center; gap:6px;">
          ${ICONS.download}
          <span>Download</span>
        </button>
        <button class="btn btn-secondary btn-sm sv-danger" data-act="delete" style="display:inline-flex; align-items:center; gap:6px; color:#ef4444;">
          ${ICONS.delete}
          <span>Delete</span>
        </button>
      </div>
    </div>

    <!-- Metadata & Viewer Switcher Strip -->
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
      <p class="sv-meta" style="margin:0; font-size:0.8rem; color:var(--text-secondary);">
        ${kindLabel(art.kind)} · saved ${when(art.updatedAt)} · ${size(art.bytes ?? art.text?.length ?? 0)}
      </p>

      <!-- Multiple Viewing Options for File Content -->
      <div class="sv-content-view-switcher" style="display:flex; background:var(--bg-subtle); padding:2px; border-radius:8px; border:1px solid var(--border);">
        <button type="button" class="sv-cview-btn ${currentContentView === 'formatted' ? 'active' : ''}" data-cview="formatted" style="padding:4px 10px; font-size:0.75rem; border:none; background:none; cursor:pointer; color:var(--text); border-radius:6px; font-weight:${currentContentView === 'formatted' ? '700' : '500'};">
          Formatted
        </button>
        ${isDataKind ? `
          <button type="button" class="sv-cview-btn ${currentContentView === 'table' ? 'active' : ''}" data-cview="table" style="padding:4px 10px; font-size:0.75rem; border:none; background:none; cursor:pointer; color:var(--text); border-radius:6px; font-weight:${currentContentView === 'table' ? '700' : '500'};">
            Table
          </button>
        ` : ''}
        <button type="button" class="sv-cview-btn ${currentContentView === 'raw' ? 'active' : ''}" data-cview="raw" style="padding:4px 10px; font-size:0.75rem; border:none; background:none; cursor:pointer; color:var(--text); border-radius:6px; font-weight:${currentContentView === 'raw' ? '700' : '500'};">
          Raw
        </button>
      </div>
    </div>

    <!-- Open In Tools Strip -->
    ${targets.length ? `
      <p class="sv-open-label" style="margin:0 0 8px; font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.04em;">Open in tool</p>
      <div class="sv-open" style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
        ${targets.map(t => `
          <button class="sv-open-btn" data-open="${t.id}" style="display:inline-flex; align-items:center; gap:6px; padding:6px 12px; background:var(--bg-subtle); border:1px solid var(--border); border-radius:8px; font-size:0.8rem; font-weight:600; color:var(--text); cursor:pointer; transition:all 0.15s ease;">
            <span class="sv-open-icon" style="display:flex; align-items:center;">${t.icon}</span>
            <span>${escapeHtml(t.name)}</span>
          </button>`).join('')}
      </div>`
    : `<p class="sv-meta" style="font-size:0.8rem; color:var(--text-muted); margin-bottom:16px;">No other tool accepts ${kindLabel(art.kind)} directly. Download it to open elsewhere.</p>`}

    <!-- Content Viewer -->
    <p class="sv-open-label" style="margin:0 0 8px; font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.04em;">Contents</p>
    <div class="sv-content-body" style="background:var(--bg-subtle); border:1px solid var(--border); border-radius:12px; overflow:hidden;">
      ${renderFileContent(art, currentContentView)}
    </div>
  `;
}

function renderFileContent(art, viewMode) {
  const text = art.text || '';

  if (viewMode === 'table') {
    return renderDataTable(text, art.kind);
  }

  if (viewMode === 'formatted') {
    // Check if markdown
    if (art.kind === 'markdown' || art.name.endsWith('.md')) {
      return `
        <div class="sv-preview sv-preview-md" style="padding:16px 20px; color:var(--text); font-size:0.88rem; line-height:1.6; max-height:540px; overflow-y:auto;">
          ${renderSimpleMarkdown(text)}
        </div>
      `;
    }
    // Code or text with formatted box
    return `
      <pre class="sv-preview" style="margin:0; padding:16px; font-family:var(--mono); font-size:0.82rem; line-height:1.55; color:var(--text); max-height:540px; overflow:auto; white-space:pre-wrap; word-break:break-word;">${escapeHtml(text.slice(0, 10000))}${text.length > 10000 ? '\n… (truncated for preview)' : ''}</pre>
    `;
  }

  // Raw mode
  return `
    <pre class="sv-preview sv-preview-raw" style="margin:0; padding:16px; font-family:var(--mono); font-size:0.82rem; line-height:1.55; color:var(--text); max-height:540px; overflow:auto; white-space:pre-wrap;">${escapeHtml(text)}</pre>
  `;
}

function renderDataTable(text, kind) {
  try {
    let rows = [];
    if (kind === 'csv' || (!text.trim().startsWith('{') && !text.trim().startsWith('['))) {
      // Basic CSV parser
      const lines = text.trim().split(/\r?\n/).filter(Boolean);
      rows = lines.map(line => {
        // Handle quoted commas
        const match = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        return line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
      });
    } else {
      // JSON parser
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        const headers = Object.keys(parsed[0]);
        rows.push(headers);
        for (const item of parsed.slice(0, 100)) {
          rows.push(headers.map(h => String(item[h] ?? '')));
        }
      }
    }

    if (rows.length === 0) {
      return `<div style="padding:16px; color:var(--text-muted);">No tabular records found in this file.</div>`;
    }

    const headers = rows[0];
    const dataRows = rows.slice(1, 101); // show up to 100 rows in preview

    return `
      <div style="max-height:540px; overflow:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:0.8rem; font-family:var(--mono); text-align:left;">
          <thead>
            <tr style="background:var(--bg-card); border-bottom:1px solid var(--border); position:sticky; top:0;">
              ${headers.map(h => `<th style="padding:8px 12px; color:var(--text); font-weight:700; border-right:1px solid var(--border-subtle);">${escapeHtml(h)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${dataRows.map(r => `
              <tr style="border-bottom:1px solid var(--border-subtle);">
                ${r.map(c => `<td style="padding:8px 12px; color:var(--text-secondary); border-right:1px solid var(--border-subtle); max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(c)}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    return `<div style="padding:16px; color:var(--text-muted); font-size:0.82rem;">Could not parse data as a table: ${escapeHtml(err.message)}</div>`;
  }
}

function renderSimpleMarkdown(md) {
  let html = escapeHtml(md);
  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3 style="font-size:1rem; font-weight:700; margin:14px 0 6px; color:var(--text);">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="font-size:1.15rem; font-weight:700; margin:16px 0 8px; color:var(--text);">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="font-size:1.35rem; font-weight:800; margin:20px 0 10px; color:var(--text);">$1</h1>');
  // Bold & Italics
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
  // Code block
  html = html.replace(/```([\s\S]*?)```/gim, '<pre style="background:var(--bg-card); padding:10px; border-radius:6px; border:1px solid var(--border); font-family:var(--mono); font-size:0.8rem; overflow-x:auto;">$1</pre>');
  // Inline code
  html = html.replace(/`([^`]+)`/gim, '<code style="background:var(--bg-card); padding:2px 5px; border-radius:4px; font-family:var(--mono); font-size:0.82rem; border:1px solid var(--border);">$1</code>');
  // Bullet lists
  html = html.replace(/^\- (.*$)/gim, '<li style="margin-left:18px; margin-bottom:4px;">$1</li>');
  // Paragraph line breaks
  html = html.replace(/\n\n/gim, '<br><br>');
  return html;
}

function storageNote() {
  return store.persistent
    ? `<p class="sv-note" style="margin-top:16px; font-size:0.75rem; color:var(--text-muted); line-height:1.5;">This storage lives locally in this browser. Clearing your browsing data removes it. Download anything you need to archive permanently.</p>`
    : `<p class="sv-note is-warn" style="margin-top:16px; font-size:0.75rem; color:#f59e0b; line-height:1.5;">This browser does not keep persistent storage (private mode). Saved files persist only until this tab is closed. Download your files to keep them.</p>`;
}

/* ---------------- behavior ---------------- */

function wire(host, selected, refresh) {
  let current = selected;

  const importer = document.createElement('input');
  importer.type = 'file';
  importer.accept = 'application/json,.json';
  importer.hidden = true;
  host.appendChild(importer);

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

  const onClick = (e) => {
    // Layout switcher button click
    const layoutBtn = e.target.closest('.sv-layout-btn');
    if (layoutBtn) {
      currentLayout = layoutBtn.dataset.layout || 'split';
      refresh(current?.id || null);
      return;
    }

    // Content view switcher click
    const cviewBtn = e.target.closest('.sv-cview-btn');
    if (cviewBtn) {
      currentContentView = cviewBtn.dataset.cview || 'formatted';
      refresh(current?.id || null);
      return;
    }

    const pick = e.target.closest('[data-pick]')?.dataset.pick;
    if (pick) {
      history.replaceState(null, '', `#files/${pick}`);
      refresh(pick);
      return;
    }

    const openIn = e.target.closest('[data-open]')?.dataset.open;
    if (openIn && current) {
      store.handOff({ ...current });
      window.location.hash = `#${openIn}`;
      return;
    }

    const actBtn = e.target.closest('[data-act]');
    const act = actBtn?.dataset.act;

    if (act === 'import') { importer.click(); return; }

    if (act === 'export-all') {
      const n = store.exportAll();
      flash(`Downloaded ${n} item${n === 1 ? '' : 's'}.`);
      return;
    }

    if (act === 'export-one') {
      const fileId = actBtn.dataset.fileId || current?.id;
      const target = fileId ? store.get(fileId) : current;
      if (target) {
        store.exportOne(target);
        flash(`Downloaded ${target.name}.`);
      }
      return;
    }

    if (act === 'delete') {
      const fileId = actBtn.dataset.fileId || current?.id;
      const target = fileId ? store.get(fileId) : current;
      if (!target) return;

      if (actBtn.dataset.armed !== 'yes') {
        actBtn.dataset.armed = 'yes';
        const origText = actBtn.innerHTML;
        actBtn.textContent = 'Confirm Delete?';
        setTimeout(() => {
          actBtn.dataset.armed = '';
          actBtn.innerHTML = origText;
        }, 4000);
        return;
      }
      store.remove(target.id);
      history.replaceState(null, '', '#files');
      refresh(null);
    }
  };

  const onRename = (e) => {
    if (!e.target.classList.contains('sv-rename') || !current) return;
    const next = store.rename(current.id, e.target.value);
    if (next) current = { ...current, name: next.name };
  };

  const onImport = async () => {
    const file = importer.files?.[0];
    if (!file) return;
    try {
      const { imported, skipped } = store.importBundle(await file.text());
      importer.value = '';
      refresh(null);
      flash(`Imported ${imported} item${imported === 1 ? '' : 's'}${skipped ? `, skipped ${skipped}` : ''}.`);
      return;
    } catch (err) {
      flash(err.message, 'bad');
    }
    importer.value = '';
  };

  host.addEventListener('click', onClick);
  host.addEventListener('change', onRename);
  importer.addEventListener('change', onImport);

  return () => {
    host.removeEventListener('click', onClick);
    host.removeEventListener('change', onRename);
  };
}
