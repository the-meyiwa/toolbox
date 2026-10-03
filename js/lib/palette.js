/* ============================================================
   Command palette.

   One way in, from anywhere: tools, saved work, and the few commands
   that are not tools. It is a navigator, not an assistant — every row
   goes somewhere, and pressing Enter always does the obvious thing.

   Tool ranking is the same engine the Tools page uses, so "png to
   webp" finds the same thing in both places.
   ============================================================ */

import { pushBack } from './back-stack.js';
import { TOOLS, CATEGORY_LABELS, BY_ID, popular } from '../registry/index.js';
import { search } from './search.js';
import * as store from './artifacts.js';
import { quickDeviceLookup, openQuickResult, quickResultHint, quickResultTitle } from './devices/quick-search.js';
import { kindLabel } from '../registry/kinds.js';
import { getCurrentUser } from './supabase.js';
import { openAssistant } from './assistant-popup.js';
import { detect, looksLikeData } from './smart-detect.js';
import { createSuggestionWeb, webSuits } from './suggestion-web.js';
import { morph } from './morph.js';

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const COMMANDS = [
  { id: 'cmd-tools', label: 'Browse all tools', hint: 'Every tool, by category', go: () => { window.location.hash = '#tools'; } },
  { id: 'cmd-saved', label: 'Saved work', hint: 'What you have kept in this browser', go: () => { window.location.hash = '#saved'; } },
  { id: 'cmd-home', label: 'Home', hint: 'Start again', go: () => { window.location.hash = '#home'; } },
  { id: 'cmd-support', label: 'Support and privacy', hint: 'How Toolbox works, and how to reach a person', go: () => { window.location.hash = '#support'; } },
];

let root = null;
let input = null;
let listEl = null;
let rows = [];
let cursor = 0;
let open = false;
/* The palette field is one line, so a paste loses its line breaks. The full
   clipboard text is kept here for detection until the query is edited. */
let pasted = null;
let pastedShown = null;   // what the field showed for it
let pasteNext = false;
let web = null;          // the suggestion web, on desktop

function build() {
  root = document.createElement('div');
  root.className = 'pal';
  root.hidden = true;
  root.innerHTML = `
    <div class="pal-scrim" data-close></div>
    <div class="pal-panel" role="dialog" aria-modal="true" aria-label="Search Toolbox">
      <div class="pal-field">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        <input type="text" id="pal-input" placeholder="What do you need to do?" autocomplete="off" spellcheck="false" aria-label="Search tools and saved work">
        <kbd>Esc</kbd>
      </div>
      <p class="pal-hint">Type to find tools, saved work and places in Toolbox. <kbd>↑</kbd><kbd>↓</kbd> to choose, <kbd>Enter</kbd> to open.</p>
      <div class="pal-list" id="pal-list" role="listbox"></div>
    </div>`;
  document.body.appendChild(root);

  input = root.querySelector('#pal-input');
  listEl = root.querySelector('#pal-list');
  // On desktop, results grow out of the field as a web; phones keep a list.
  web = createSuggestionWeb({
    host: root,
    field: root.querySelector('.pal-field'),
    input,
    above: true,
    onPick: (item) => run(rows.indexOf(item.row)),
  });

  input.addEventListener('input', () => {
    if (pasteNext) { pastedShown = input.value; pasteNext = false; }
    else if (pasted != null && input.value !== pastedShown) pasted = null;
    render();
  });
  input.addEventListener('paste', (e) => {
    const t = e.clipboardData?.getData('text');
    if (t && looksLikeData(t)) { pasted = t; pasteNext = true; }
  });
  input.addEventListener('keydown', onKeys);
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) return close();
    const row = e.target.closest('[data-idx]');
    if (row) run(Number(row.dataset.idx));
  });
  root.addEventListener('mousemove', (e) => {
    const row = e.target.closest('[data-idx]');
    if (row && Number(row.dataset.idx) !== cursor) {
      cursor = Number(row.dataset.idx);
      paintCursor();
    }
  });
}

export function detectAiIntent(query) {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const words = q.split(/\s+/);
  
  const promptStarters = [
    'how', 'what', 'why', 'who', 'where', 'when', 'which',
    'can you', 'could you', 'please', 'tell me', 'write', 'create',
    'generate', 'summarize', 'explain', 'convert this', 'analyze',
    'help me', 'solve', 'calculate', 'code a', 'make a', 'fix',
    'translate', 'describe', 'find out', 'build', 'give me'
  ];

  if (promptStarters.some(s => q.startsWith(s))) return true;
  if (q.endsWith('?')) return true;
  if (words.length >= 4) return true;
  return false;
}

/* ---------------- results ---------------- */

const flat = (t) => String(t).replace(/\r?\n/g, ' ').trim();

/** "Open in …" rows for pasted data, one per tool that can take it. */
function detectedRows(text) {
  const hits = detect(text);
  const seen = new Set();
  const out = [];
  for (const h of hits) {
    for (const id of h.tools) {
      const tool = BY_ID.get(id);
      if (!tool || tool.hidden || seen.has(id)) continue;
      seen.add(id);
      out.push({
        key: `data:${id}`,
        group: `Looks like ${h.label}`,
        title: `Open in ${tool.name}`,
        hint: tool.description,
        icon: tool.icon,
        go: () => { store.handOff({ kind: h.kind, text, name: h.label }); window.location.hash = `#${id}`; },
      });
    }
  }
  return out.slice(0, 5);
}

function collect(query) {
  const q = query.trim();

  const saved = store.list();
  const savedRows = (q
    ? saved.filter(m => m.name.toLowerCase().includes(q.toLowerCase()))
    : saved.slice(0, 3)
  ).slice(0, 6).map(m => ({
    key: `saved:${m.id}`,
    group: 'Saved work',
    title: m.name,
    hint: `${kindLabel(m.kind)}${m.from && BY_ID.has(m.from) ? ` · from ${BY_ID.get(m.from).name}` : ''}`,
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>',
    go: () => { window.location.hash = `#saved/${m.id}`; },
  }));

  const user = getCurrentUser();
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const availableTools = TOOLS.filter(t => {
    if (t.hidden) return false;
    if (!user && t.id === 'assistant') return false;
    if (!user && isMobile && t.id === 'code-playground') return false;
    if (user && t.id === 'file-drop') return false;
    return true;
  });

  const toolRows = (q
    ? search(q, availableTools, { labels: CATEGORY_LABELS }).results.map(r => r.tool)
    : popular(6).filter(t => {
        if (!user && t.id === 'assistant') return false;
        if (!user && isMobile && t.id === 'code-playground') return false;
        if (user && t.id === 'file-drop') return false;
        return true;
      })
  ).slice(0, 8).map(t => ({
    key: `tool:${t.id}`,
    group: q ? 'Tools' : 'Most used',
    title: t.name,
    badge: t.badge || '',
    hint: t.description,
    icon: t.icon,
    // A tool on another site (KoreLearn) opens there, from the same keypress or click.
    go: () => { if (t.external) window.open(t.external, '_blank', 'noopener'); else window.location.hash = `#${t.id}`; },
  }));

  const cmdRows = COMMANDS
    .filter(c => !q || c.label.toLowerCase().includes(q.toLowerCase()))
    .map(c => ({ key: c.id, group: 'Go to', title: c.label, hint: c.hint, icon: '', go: c.go }));

  const isAi = user ? detectAiIntent(q) : false;
  const aiRow = (user && q) ? {
    key: 'ai',
    kind: 'ai',
    group: isAi ? 'Assistant (Recommended)' : 'Assistant',
    title: `Ask Assistant: “${q}”`,
    hint: 'Let Assistant process files, generate code, or execute tools for you',
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>',
    go: () => { openAssistant({ prompt: query.trim() }); },
  } : null;

  const dataRows = q ? detectedRows(pasted ?? q) : [];
  if (dataRows.length) return [...dataRows, ...toolRows.slice(0, 3), ...(aiRow ? [aiRow] : [])];

  if (isAi && aiRow) {
    return [aiRow, ...toolRows, ...savedRows, ...cmdRows];
  }
  return [...savedRows, ...toolRows, ...(aiRow ? [aiRow] : []), ...cmdRows];
}

/** The same results Spotlight shows, for other search surfaces (the header search). */
export function searchRows(query) { return collect(query); }

/** Device/comparison row for a query that resolves to something in the device
    database (a specific product, or "A vs B"). Resolved async and spliced
    into `rows` once ready, without blocking the rest of the results. */
function deviceRow(hit) {
  return {
    key: `device:${quickResultTitle(hit)}`,
    group: hit.kind === 'compare' ? 'Compare' : 'Specs',
    title: quickResultTitle(hit),
    hint: quickResultHint(hit),
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="7" height="12" rx="1.5"/><rect x="13" y="8" width="7" height="12" rx="1.5"/><path d="M7.5 16v2M16.5 20v2"/></svg>',
    go: () => openQuickResult(hit),
  };
}

let searchGen = 0;

function render() {
  const gen = ++searchGen;
  rows = collect(input.value);
  cursor = 0;
  paint();

  const q = input.value.trim();
  if (q.length >= 3) {
    setTimeout(() => {
      if (gen !== searchGen) return;
      quickDeviceLookup(q).then(hit => {
        if (gen !== searchGen || !hit) return;
        rows = [deviceRow(hit), ...rows];
        if (cursor > 0) cursor += 1;
        paint();
      }).catch(() => {});
    }, 150);
  }
}

/** Desktop: the web shows the best few, nearest first; the field stays the focus. */
function paintWeb() {
  const q = input.value.trim();
  root.classList.toggle('has-query', !!q);
  if (!q) { web.clear(); return; }
  web.update(rows.slice(0, 9).map(row => ({ key: row.key || row.title, title: row.title, hint: row.hint, icon: row.icon, kind: row.kind, row })));
}

function paint() {
  const useWeb = webSuits();
  root.classList.toggle('pal-web', useWeb);
  if (useWeb) { listEl.innerHTML = ''; paintWeb(); return; }
  web?.clear();
  // Phones: the list changes size and shape with its results instead of jumping.
  morph(listEl, paintList, { rows: '.pal-row, .pal-empty', shape: false });
}

function paintList() {
  if (!rows.length) {
    listEl.innerHTML = `<p class="pal-empty">Nothing matches “${escapeHtml(input.value.trim())}”. Try the job rather than the name — “format json”, “compress photo”.</p>`;
    return;
  }

  let html = '';
  let group = null;
  rows.forEach((row, i) => {
    if (row.group !== group) {
      group = row.group;
      html += `<p class="pal-group">${escapeHtml(group)}</p>`;
    }
    html += `
      <button class="pal-row" data-idx="${i}" role="option">
        <span class="pal-icon">${row.icon}</span>
        <span class="pal-text"><strong>${escapeHtml(row.title)}${row.badge === 'Beta' ? ' <span class="beta-badge">Beta</span>' : ''}</strong><em>${escapeHtml(row.hint)}</em></span>
      </button>`;
  });
  listEl.innerHTML = html;
  paintCursor();
}

function paintCursor() {
  if (webSuits()) return;
  for (const el of listEl.querySelectorAll('.pal-row')) {
    const on = Number(el.dataset.idx) === cursor;
    el.classList.toggle('is-cursor', on);
    el.setAttribute('aria-selected', String(on));
    if (on) el.scrollIntoView({ block: 'nearest' });
  }
}

function run(index) {
  const row = rows[index];
  if (!row) return;
  close();
  row.go();
}

function onKeys(e) {
  if (webSuits()) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); web.move(e.key === 'ArrowDown' ? 1 : -1); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = web.active();
      // Nothing chosen with the arrows: the closest suggestion is the answer.
      if (chosen) run(rows.indexOf(chosen.row));
      else if (input.value.trim()) run(0);
      return;
    }
    // Escape clears what was typed first (the web folds away), then closes.
    if (e.key === 'Escape') { e.preventDefault(); if (input.value) { input.value = ''; pasted = null; render(); } else close(); return; }
    return;
  }
  if (e.key === 'ArrowDown') { e.preventDefault(); cursor = Math.min(cursor + 1, rows.length - 1); paintCursor(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); cursor = Math.max(cursor - 1, 0); paintCursor(); }
  else if (e.key === 'Enter') { e.preventDefault(); run(cursor); }
  else if (e.key === 'Escape') { e.preventDefault(); close(); }
}

/* ---------------- open / close ---------------- */

let offBack = null;
export function openPalette(prefill = '', { data = null } = {}) {
  if (!root) build();
  if (!open) { offBack?.(); offBack = pushBack(() => close()); }
  open = true;
  clearTimeout(root._closeTimer);
  root.classList.remove('is-closing');
  root.hidden = false;
  pasted = data;
  input.value = data != null ? flat(data).slice(0, 500) : prefill;
  pastedShown = input.value;
  render();
  requestAnimationFrame(() => input.focus());
}

export function close() {
  if (!root || !open) return;
  open = false;
  offBack?.(); offBack = null;
  web?.clear();
  // Fade out, then hide; reopening during the fade cancels it.
  root.classList.add('is-closing');
  clearTimeout(root._closeTimer);
  root._closeTimer = setTimeout(() => { if (!open) root.hidden = true; root.classList.remove('is-closing'); }, 150);
}

export const isOpen = () => open;

/* The home page has its own search box in plain sight, so Spotlight is not
   used there: the shortcuts go to that box instead. */
const onHome = () => {
  const h = (window.location.hash || '').replace(/^#/, '');
  return (h === '' || h === 'home' || h.startsWith('home-')) && !!document.getElementById('home-hero-input')?.offsetParent;
};

export function focusHomeSearch() {
  const input = document.getElementById('home-hero-input');
  if (!input) return false;
  input.scrollIntoView({ block: 'center', behavior: 'smooth' });
  input.focus({ preventScroll: true });
  input.select?.();
  return true;
}

/** Opens Spotlight, or focuses the home search when on the home page. */
export function openSearch(prefill = '') {
  if (onHome() && focusHomeSearch()) return;
  openPalette(prefill);
}

/** Bind the global shortcut once. */
export function installPalette() {
  document.addEventListener('keydown', (e) => {
    const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)
      || document.activeElement?.isContentEditable;

    // Ctrl/Cmd+K belongs to the Assistant (js/lib/assistant-shortcut.js); `/` is the way into search.
    // A bare slash is the quick way in, but only when not already typing.
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !inField && !open) {
      e.preventDefault();
      openSearch();
    }
  });

  /* Smart paste: pasting a token, JSON, a certificate… anywhere outside a
     tool (or into the home search) offers the tools that can open it. */
  document.addEventListener('paste', (e) => {
    if (open || document.body.classList.contains('in-tool')) return;
    const el = document.activeElement;
    const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName) || el?.isContentEditable;
    if (inField && el?.id !== 'home-hero-input') return;
    const text = e.clipboardData?.getData('text');
    if (!text || !detect(text).length) return;
    e.preventDefault();
    openPalette('', { data: text });
  });
}
