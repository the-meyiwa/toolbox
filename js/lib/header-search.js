/* ============================================================
   TOOLBOX — Header search (desktop)

   The search in the header's corner. It is the quick, quiet way in:
   the button widens into a field where it sits, and results open in
   a small panel under it that changes size and shape as they change
   (js/lib/morph.js), rather than the full web Spotlight grows. Same
   results and ranking as Spotlight (palette.js searchRows).

   ↑ ↓ move, Enter opens, Escape or clicking away closes.
   ============================================================ */

import { searchRows } from './palette.js';
import { morph, collapse } from './morph.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MAX = 7;

let root = null, input = null, panel = null, btn = null;
let rows = [];
let cursor = 0;
let isOpenNow = false;

function build() {
  root = document.createElement('div');
  root.className = 'hs';
  root.hidden = true;
  root.innerHTML = `
    <div class="hs-field">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input type="text" class="hs-input" placeholder="Search tools" autocomplete="off" spellcheck="false" aria-label="Search tools" role="combobox" aria-expanded="false" aria-controls="hs-panel" aria-autocomplete="list">
      <kbd>Esc</kbd>
    </div>
    <div class="hs-panel" id="hs-panel" role="listbox" aria-label="Results" hidden></div>`;
  document.body.appendChild(root);
  input = root.querySelector('.hs-input');
  panel = root.querySelector('.hs-panel');

  input.addEventListener('input', paint);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!rows.length) return;
      e.preventDefault();
      cursor = (cursor + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
      paintCursor();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(cursor);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeHeaderSearch(true);
    }
  });
  input.addEventListener('blur', () => setTimeout(() => { if (isOpenNow && !root.contains(document.activeElement)) closeHeaderSearch(); }, 120));
  panel.addEventListener('pointerdown', (e) => { if (e.target.closest('.hs-row')) e.preventDefault(); });
  panel.addEventListener('click', (e) => {
    const row = e.target.closest('.hs-row');
    if (row) run(Number(row.dataset.idx));
  });
  panel.addEventListener('pointermove', (e) => {
    const row = e.target.closest('.hs-row');
    if (row && Number(row.dataset.idx) !== cursor) { cursor = Number(row.dataset.idx); paintCursor(); }
  });
  window.addEventListener('resize', () => { if (isOpenNow) place(); });
  window.addEventListener('hashchange', () => closeHeaderSearch());
}

function place() {
  const r = btn.getBoundingClientRect();
  root.style.setProperty('--hs-top', `${r.top}px`);
  root.style.setProperty('--hs-right', `${document.documentElement.clientWidth - r.right}px`);
  root.style.setProperty('--hs-from', `${r.width}px`);
  root.style.setProperty('--hs-h', `${r.height}px`);
}

function paint() {
  const q = input.value.trim();
  if (!q) { rows = []; input.setAttribute('aria-expanded', 'false'); collapse(panel); return; }
  rows = searchRows(q).slice(0, MAX);
  cursor = 0;
  morph(panel, () => {
    panel.hidden = false;
    panel.innerHTML = rows.length ? rows.map((row, i) => `
      <button type="button" class="hs-row" role="option" id="hs-o${i}" data-idx="${i}" tabindex="-1">
        <span class="hs-icon" aria-hidden="true">${row.icon || ''}</span>
        <span class="hs-text"><strong>${esc(row.title)}</strong><em>${esc(row.hint || '')}</em></span>
      </button>`).join('') : `<p class="hs-empty">Nothing matches “${esc(q)}”.</p>`;
    paintCursor();
  }, { rows: '.hs-row, .hs-empty' });
  input.setAttribute('aria-expanded', 'true');
}

function paintCursor() {
  panel.querySelectorAll('.hs-row').forEach((el, i) => {
    el.classList.toggle('is-cursor', i === cursor);
    el.setAttribute('aria-selected', String(i === cursor));
  });
  if (rows.length) input.setAttribute('aria-activedescendant', `hs-o${cursor}`); else input.removeAttribute('aria-activedescendant');
}

function run(i) {
  const row = rows[i];
  if (!row) return;
  closeHeaderSearch();
  row.go();
}

export function openHeaderSearch(button) {
  btn = button;
  if (!root) build();
  place();
  isOpenNow = true;
  root.hidden = false;
  input.value = '';
  rows = [];
  panel.hidden = true;
  btn.classList.add('is-searching');
  requestAnimationFrame(() => { root.classList.add('is-open'); input.focus(); });
}

export function closeHeaderSearch(returnFocus = false) {
  if (!root || !isOpenNow) return;
  isOpenNow = false;
  collapse(panel);
  root.classList.remove('is-open');
  input.setAttribute('aria-expanded', 'false');
  setTimeout(() => { if (!isOpenNow) { root.hidden = true; btn?.classList.remove('is-searching'); } }, 260);
  if (returnFocus) btn?.focus();
}
