/* ============================================================
   Command palette.

   One way in, from anywhere: tools, saved work, and the few commands
   that are not tools. It is a navigator, not an assistant — every row
   goes somewhere, and pressing Enter always does the obvious thing.

   Tool ranking is the same engine the Tools page uses, so "png to
   webp" finds the same thing in both places.
   ============================================================ */

import { TOOLS, CATEGORY_LABELS, BY_ID, popular } from '../registry/index.js';
import { search } from './search.js';
import * as store from './artifacts.js';
import { kindLabel } from '../registry/kinds.js';

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
      <div class="pal-list" id="pal-list" role="listbox"></div>
    </div>`;
  document.body.appendChild(root);

  input = root.querySelector('#pal-input');
  listEl = root.querySelector('#pal-list');

  input.addEventListener('input', render);
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

function collect(query) {
  const q = query.trim();

  const saved = store.list();
  const savedRows = (q
    ? saved.filter(m => m.name.toLowerCase().includes(q.toLowerCase()))
    : saved.slice(0, 3)
  ).slice(0, 6).map(m => ({
    group: 'Saved work',
    title: m.name,
    hint: `${kindLabel(m.kind)}${m.from && BY_ID.has(m.from) ? ` · from ${BY_ID.get(m.from).name}` : ''}`,
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/></svg>',
    go: () => { window.location.hash = `#saved/${m.id}`; },
  }));

  const toolRows = (q
    ? search(q, TOOLS, { labels: CATEGORY_LABELS }).results.map(r => r.tool)
    : popular(6)
  ).slice(0, 8).map(t => ({
    group: q ? 'Tools' : 'Most used',
    title: t.name,
    hint: t.description,
    icon: t.icon,
    go: () => { window.location.hash = `#${t.id}`; },
  }));

  const cmdRows = COMMANDS
    .filter(c => !q || c.label.toLowerCase().includes(q.toLowerCase()))
    .map(c => ({ group: 'Go to', title: c.label, hint: c.hint, icon: '', go: c.go }));

  const isAi = detectAiIntent(q);
  const aiRow = q ? {
    group: isAi ? 'Voltix Assistant (Recommended)' : 'Voltix Assistant',
    title: `Ask Voltix AI: “${q}”`,
    hint: 'Let Voltix Assistant process files, generate code, or execute tools for you',
    icon: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>',
    go: () => {
      sessionStorage.setItem('toolbox_pending_prompt', query.trim());
      window.location.hash = '#assistant';
    }
  } : null;

  if (isAi && aiRow) {
    return [aiRow, ...toolRows, ...savedRows, ...cmdRows];
  }
  return [...savedRows, ...toolRows, ...(aiRow ? [aiRow] : []), ...cmdRows];
}

function render() {
  rows = collect(input.value);
  cursor = 0;

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
        <span class="pal-text"><strong>${escapeHtml(row.title)}</strong><em>${escapeHtml(row.hint)}</em></span>
      </button>`;
  });
  listEl.innerHTML = html;
  paintCursor();
}

function paintCursor() {
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
  if (e.key === 'ArrowDown') { e.preventDefault(); cursor = Math.min(cursor + 1, rows.length - 1); paintCursor(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); cursor = Math.max(cursor - 1, 0); paintCursor(); }
  else if (e.key === 'Enter') { e.preventDefault(); run(cursor); }
  else if (e.key === 'Escape') { e.preventDefault(); close(); }
}

/* ---------------- open / close ---------------- */

export function openPalette(prefill = '') {
  if (!root) build();
  open = true;
  root.hidden = false;
  input.value = prefill;
  render();
  requestAnimationFrame(() => input.focus());
}

export function close() {
  if (!root || !open) return;
  open = false;
  root.hidden = true;
}

export const isOpen = () => open;

/** Bind the global shortcut once. */
export function installPalette() {
  document.addEventListener('keydown', (e) => {
    const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)
      || document.activeElement?.isContentEditable;

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      open ? close() : openPalette();
      return;
    }
    // A bare slash is the quick way in, but only when not already typing.
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !inField && !open) {
      e.preventDefault();
      openPalette();
    }
  });
}
