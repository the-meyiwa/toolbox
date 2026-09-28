/* ============================================================
   Workspace: a second tool beside the one you are using.

   Open any tool beside the current one (the ⧉ button in a tool's
   header, a right-click, or "Open beside" on any result). The side
   pane stays open while you move between tools, so a PDF made on the
   left can go straight into OCR on the right, a CSV can be summarised
   while it is being cleaned, and the Assistant, Files and Recent all
   see the same work. Work moves across with Send to the other side,
   in both directions.

   Desktop: a resizable pane on the right. Phone: a bottom sheet.
   ============================================================ */

import { BY_ID, TOOLS, CATEGORY_LABELS } from '../registry/index.js';
import { search } from './search.js';
import { recent } from './recent.js';
import { giveToTool, targetsFor, openIn } from './interop.js';

const modules = import.meta.glob('../tools/*.js');
const KEY = 'toolbox.beside.v1';
const MIN_W = 320;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let pane = null;
let body = null;
let instance = null;
let toolId = null;
let getMain = () => ({ id: null, instance: null, host: null });
let loadSeq = 0;

const store = {
  get() { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; } },
  set(v) { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } },
};

export const isBesideOpen = () => !!pane && pane.classList.contains('is-open');
export const besideToolId = () => (isBesideOpen() ? toolId : null);

function build() {
  pane = document.createElement('aside');
  pane.className = 'beside';
  pane.setAttribute('aria-label', 'Second tool');
  pane.innerHTML = `
    <div class="beside-grip" role="separator" aria-orientation="vertical" aria-label="Resize" tabindex="0"></div>
    <header class="beside-head">
      <button type="button" class="beside-title" data-act="pick" aria-haspopup="dialog">
        <span class="beside-icon" aria-hidden="true"></span><span class="beside-name">Choose a tool</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="beside-actions">
        <button type="button" class="btn-icon" data-act="swap" title="Swap sides" aria-label="Swap sides"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M7 7h13l-3-3M17 17H4l3 3"/></svg></button>
        <button type="button" class="btn-icon" data-act="close" title="Close (Esc)" aria-label="Close the second tool"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      </div>
    </header>
    <div class="beside-picker" hidden>
      <input type="search" class="tool-input beside-search" placeholder="Find a tool…" aria-label="Find a tool to open beside" autocomplete="off">
      <div class="beside-results" role="listbox"></div>
    </div>
    <div class="beside-body"></div>`;
  document.body.appendChild(pane);
  body = pane.querySelector('.beside-body');

  const saved = store.get();
  if (saved?.width) document.documentElement.style.setProperty('--beside-w', `${saved.width}px`);

  pane.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'close') closeBeside();
    else if (act === 'pick') togglePicker();
    else if (act === 'swap') swapSides();
    const row = e.target.closest('[data-tool]');
    if (row) { togglePicker(false); openBeside(row.dataset.tool, row.dataset.recent ? recent().find((r) => r.id === row.dataset.recent) : null); }
  });
  const input = pane.querySelector('.beside-search');
  input.addEventListener('input', () => paintResults(input.value));
  input.addEventListener('keydown', (e) => {
    const rows = [...pane.querySelectorAll('.beside-results [data-tool]')];
    const i = rows.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); rows[0]?.focus(); }
    else if (e.key === 'Enter' && rows[0]) { e.preventDefault(); rows[0].click(); }
    else if (e.key === 'Escape') { e.stopPropagation(); togglePicker(false); }
    void i;
  });
  pane.querySelector('.beside-results').addEventListener('keydown', (e) => {
    const rows = [...pane.querySelectorAll('.beside-results [data-tool]')];
    const i = rows.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); rows[Math.min(rows.length - 1, i + 1)]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (i <= 0 ? input : rows[i - 1]).focus(); }
    else if (e.key === 'Escape') { e.stopPropagation(); togglePicker(false); }
  });

  bindResize(pane.querySelector('.beside-grip'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isBesideOpen() && pane.contains(document.activeElement) && pane.querySelector('.beside-picker').hidden) closeBeside();
  });
}

/* Pointer-driven resize, painted once per frame. */
function bindResize(grip) {
  let startX = 0; let startW = 0; let frame = 0; let next = 0;
  const apply = () => { frame = 0; document.documentElement.style.setProperty('--beside-w', `${next}px`); };
  const clamp = (w) => Math.round(Math.max(MIN_W, Math.min(window.innerWidth * 0.7, w)));
  grip.addEventListener('pointerdown', (e) => {
    if (window.innerWidth < 900) return;
    e.preventDefault();
    grip.setPointerCapture(e.pointerId);
    startX = e.clientX; startW = pane.getBoundingClientRect().width;
    document.body.classList.add('is-resizing-beside');
  });
  grip.addEventListener('pointermove', (e) => {
    if (!grip.hasPointerCapture(e.pointerId)) return;
    next = clamp(startW + (startX - e.clientX));
    if (!frame) frame = requestAnimationFrame(apply);
  });
  const end = (e) => {
    if (!grip.hasPointerCapture?.(e.pointerId)) return;
    grip.releasePointerCapture(e.pointerId);
    document.body.classList.remove('is-resizing-beside');
    store.set({ ...(store.get() || {}), width: Math.round(pane.getBoundingClientRect().width) });
  };
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
  grip.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const w = clamp(pane.getBoundingClientRect().width + (e.key === 'ArrowLeft' ? 32 : -32));
    document.documentElement.style.setProperty('--beside-w', `${w}px`);
    store.set({ ...(store.get() || {}), width: w });
  });
}

function paintResults(q = '') {
  const host = pane.querySelector('.beside-results');
  const main = getMain().id;
  const pool = TOOLS.filter((t) => !t.hidden && t.id !== main && t.id !== 'assistant');
  const tools = (q.trim() ? search(q, pool, { labels: CATEGORY_LABELS }).results.map((r) => r.tool) : pool.slice().sort((a, b) => (b.weight ?? 50) - (a.weight ?? 50))).slice(0, 40);
  const rec = q.trim() ? [] : recent().slice(0, 4);
  const recRows = rec.flatMap((r) => {
    const t = targetsFor(r.kind).find((x) => x.id !== main);
    return t ? [`<button type="button" class="beside-row" data-tool="${t.id}" data-recent="${r.id}" role="option"><span class="beside-row-icon">${t.icon}</span><span><strong>${esc(r.name)}</strong><em>Open in ${esc(t.name)}</em></span></button>`] : [];
  });
  host.innerHTML = (recRows.length ? `<p class="beside-group">Recent work</p>${recRows.join('')}` : '')
    + `<p class="beside-group">${q.trim() ? 'Tools' : 'Popular tools'}</p>`
    + tools.map((t) => `<button type="button" class="beside-row" data-tool="${t.id}" role="option"><span class="beside-row-icon">${t.icon}</span><span><strong>${esc(t.name)}</strong><em>${esc(t.description)}</em></span></button>`).join('');
}

function togglePicker(force) {
  const picker = pane.querySelector('.beside-picker');
  const show = force ?? picker.hidden;
  picker.hidden = !show;
  pane.classList.toggle('is-picking', show);
  pane.querySelector('[data-act="pick"]').setAttribute('aria-expanded', String(show));
  if (show) { const input = picker.querySelector('input'); input.value = ''; paintResults(''); requestAnimationFrame(() => input.focus()); }
}

function setTitle(tool) {
  pane.querySelector('.beside-icon').innerHTML = tool ? tool.icon : '';
  pane.querySelector('.beside-name').textContent = tool ? tool.name : 'Choose a tool';
}

/**
 * Open a tool beside the current one, optionally handing it work.
 * @param {string|null} id  tool id, or null to open the picker
 * @param {{name, kind, text?, blob?}|null} item
 */
export async function openBeside(id = null, item = null) {
  if (!pane) build();
  document.body.classList.add('has-beside');
  requestAnimationFrame(() => pane.classList.add('is-open'));
  if (!id) { setTitle(null); if (!toolId) togglePicker(true); return; }
  if (id === getMain().id) { if (item) openIn(id, item); return; }
  const tool = BY_ID.get(id);
  const loader = modules[`../tools/${id}.js`];
  if (!tool || !loader) return;
  const my = ++loadSeq;
  teardown();
  toolId = id;
  setTitle(tool);
  store.set({ ...(store.get() || {}), tool: id });
  const host = document.createElement('div');
  host.className = 'beside-content';
  host.setAttribute('aria-busy', 'true');
  body.replaceChildren(host);
  try {
    const mod = (await loader()).default;
    if (my !== loadSeq) return;
    instance = mod;
    await mod.render(host, { tool, artifact: null, analytics: null });
    host.setAttribute('aria-busy', 'false');
    if (item) await giveToTool(mod, host, item);
  } catch (err) {
    console.error(err);
    host.innerHTML = `<p class="kit-error">${esc(tool.name)} could not open here.</p>`;
  }
}

function teardown() {
  try { instance?.destroy?.(); } catch { /* ignore */ }
  instance = null;
}

export function closeBeside() {
  if (!pane) return;
  loadSeq++;
  pane.classList.remove('is-open');
  document.body.classList.remove('has-beside');
  togglePicker(false);
  store.set({ ...(store.get() || {}), tool: null });
  // Unmount after the slide-out, so the animation has something to move.
  setTimeout(() => { if (!isBesideOpen()) { teardown(); toolId = null; body.replaceChildren(); } }, 320);
}

/** Put the side tool in the main view and the main tool beside it. */
function swapSides() {
  const main = getMain().id;
  const side = toolId;
  if (!side) return;
  if (main) openBeside(main); else closeBeside();
  window.location.hash = `#${side}`;
}

/** Current work of the side tool, if it has any. */
export function besideWork() {
  const a = instance?.getArtifact?.();
  return a && (a.text || a.blob) ? { name: a.name || `${toolId}-result`, kind: a.kind, text: a.text, blob: a.blob, from: toolId } : null;
}

/** Hand work to the side tool. */
export async function sendBeside(item) {
  if (!isBesideOpen() || !instance) return false;
  return giveToTool(instance, body.querySelector('.beside-content'), item);
}

/** Wire the header button and restore the side tool after a reload. */
export function initWorkspace({ main } = {}) {
  if (typeof document === 'undefined') return;
  if (main) getMain = main;
  const actions = document.querySelector('#tool-viewport .viewport-actions');
  if (actions && !actions.querySelector('#beside-btn')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'beside-btn';
    btn.className = 'btn-icon btn-secondary';
    btn.title = 'Open another tool beside this one';
    btn.setAttribute('aria-label', 'Open another tool beside this one');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M13 4v16"/></svg>';
    btn.addEventListener('click', () => (isBesideOpen() ? closeBeside() : openBeside(store.get()?.tool || null)));
    actions.prepend(btn);
  }
  const saved = store.get();
  if (saved?.tool && BY_ID.has(saved.tool)) {
    const wait = () => (document.body.classList.contains('in-tool') ? openBeside(saved.tool) : setTimeout(wait, 300));
    setTimeout(wait, 300);
  }
}
