/* ============================================================
   Ledger — a spreadsheet for .xlsx, .xls, .ods, .csv and .tsv that
   saves back to the format it opened.

   The grid is virtualised (only the rows in view are in the DOM), so
   a sheet with a hundred thousand rows scrolls like one with ten.
   Formulas run through lib/docs/formula.js; a function it does not
   know shows the value the file was saved with.
   ============================================================ */

import { mountShell, icon, esc } from '../lib/docs/editor-shell.js';
import { readWorkbook, writeWorkbook, emptySheet, coerce, parseDelimited, cellKey } from '../lib/docs/sheets.js';
import { evaluate, isError, indexToCol, ERRORS } from '../lib/docs/formula.js';
import { shiftFormula } from '../lib/docs/formula-shift.js';

const ROW_H = 26;
const HEAD_W = 52;
const DEFAULT_W = 96;
const MAX_ROWS = 1_048_576;
const MAX_COLS = 16_384;

const I = {
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  sum: '<path d="M18 5H6l6 7-6 7h12"/>',
  rowAdd: '<rect x="3" y="4" width="18" height="6" rx="1"/><path d="M12 14v6M9 17h6"/>',
  rowDel: '<rect x="3" y="4" width="18" height="6" rx="1"/><path d="M9 17h6"/>',
  colAdd: '<rect x="4" y="3" width="6" height="18" rx="1"/><path d="M17 9v6M14 12h6"/>',
  colDel: '<rect x="4" y="3" width="6" height="18" rx="1"/><path d="M14 12h6"/>',
  sortAsc: '<path d="M7 4v16M4 17l3 3 3-3M14 6h6M14 12h4M14 18h2"/>',
  sortDesc: '<path d="M7 4v16M4 17l3 3 3-3M14 6h2M14 12h4M14 18h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};

const tb = (act, label, ic) => `<button type="button" class="dx-tbtn" data-act="${act}" title="${esc(label)}" aria-label="${esc(label)}">${icon(ic)}</button>`;

const TOOLBAR = `
  <div class="dx-tgroup">${tb('undo', 'Undo (Ctrl+Z)', I.undo)}${tb('redo', 'Redo (Ctrl+Y)', I.redo)}</div>
  <select class="dx-select" data-format aria-label="Number format" title="Number format">
    <option value="">General</option><option value="0">Whole number</option><option value="#,##0.00">Number</option>
    <option value="$#,##0.00">Currency</option><option value="0.00%">Percent</option><option value="yyyy-mm-dd">Date</option><option value="@">Text</option>
  </select>
  <div class="dx-tgroup">${tb('sum', 'Sum the cells above or to the left', I.sum)}</div>
  <div class="dx-tgroup">${tb('rowAdd', 'Insert row above', I.rowAdd)}${tb('rowDel', 'Delete row', I.rowDel)}${tb('colAdd', 'Insert column to the left', I.colAdd)}${tb('colDel', 'Delete column', I.colDel)}</div>
  <div class="dx-tgroup">${tb('sortAsc', 'Sort A to Z by this column', I.sortAsc)}${tb('sortDesc', 'Sort Z to A by this column', I.sortDesc)}</div>
`;

const BODY = `
  <div class="ldg-bar">
    <input class="ldg-ref" type="text" aria-label="Cell reference" title="Go to cell" spellcheck="false" autocomplete="off">
    <span class="ldg-fx" aria-hidden="true">fx</span>
    <input class="ldg-input" type="text" aria-label="Cell contents" spellcheck="false" autocomplete="off">
  </div>
  <div class="ldg-viewport" tabindex="0" role="grid" aria-label="Spreadsheet">
    <div class="ldg-canvas"><table class="ldg-table"><thead></thead><tbody></tbody></table></div>
    <input class="ldg-editor" type="text" hidden spellcheck="false" autocomplete="off" aria-label="Edit cell">
  </div>
  <div class="ldg-tabs" role="tablist" aria-label="Sheets"></div>
`;

/* ---------------- display formatting ---------------- */

export function formatValue(v, z) {
  if (v === undefined || v === null || v === '') return '';
  if (isError(v)) return v.code;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v !== 'number') return String(v);
  if (!Number.isFinite(v)) return '#NUM!';
  if (z && z !== 'General' && z !== '@') {
    if (/[dmy]/i.test(z.replace(/"[^"]*"/g, '')) && !/0/.test(z)) {
      const d = new Date(Math.round((v - 25569) * 86400000));
      if (!Number.isNaN(d.getTime())) {
        const iso = d.toISOString();
        return /h/i.test(z) ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : iso.slice(0, 10);
      }
    }
    const pct = z.includes('%');
    const decimals = (/\.(0+)/.exec(z)?.[1] || '').length;
    const grouped = z.includes(',');
    const cur = /^[^0#]*?([$€£¥₦])/.exec(z)?.[1] || '';
    const n = pct ? v * 100 : v;
    const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouped });
    return `${n < 0 ? '-' : ''}${cur}${s}${pct ? '%' : ''}`;
  }
  if (Number.isInteger(v)) return String(v);
  const r = Number(v.toPrecision(12));
  return Math.abs(r) >= 1e15 || (Math.abs(r) < 1e-6 && r !== 0) ? r.toExponential(6) : String(r);
}

/* ---------------- the tool ---------------- */

export default {
  ownFileChrome: true,
  render(container, { artifact } = {}) {
    let book = { sheets: [emptySheet('Sheet1')] };
    let active = 0;
    let sel = { r: 0, c: 0, r2: 0, c2: 0 };
    let editing = null; // { r, c, via: 'cell'|'bar', original }
    let memo = new Map();
    const computing = new Set();
    let undo = [], redo = [];
    let internalClip = null;

    const shell = mountShell(container, {
      tool: 'ledger',
      defaultName: 'Untitled.xlsx',
      accept: '.xlsx,.xlsm,.xls,.ods,.csv,.tsv',
      toolbar: TOOLBAR,
      body: BODY,
      footer: '<span class="ldg-stats" aria-live="polite"></span>',
      load: async (bytes, name) => {
        const loaded = await readWorkbook(bytes, name);
        for (const s of loaded.sheets) for (const cell of s.cells.values()) if (cell.f) { cell.fileV = cell.v; cell.fileF = cell.f; }
        book = loaded;
        active = 0; sel = { r: 0, c: 0, r2: 0, c2: 0 }; undo = []; redo = [];
        invalidate(); renderTabs(); layout(); viewport.scrollTo?.(0, 0); paint(); syncBar();
      },
      blank: () => {
        book = { sheets: [emptySheet('Sheet1')] };
        active = 0; sel = { r: 0, c: 0, r2: 0, c2: 0 }; undo = []; redo = [];
        invalidate(); renderTabs(); layout(); paint(); syncBar();
      },
      selection: () => {
        const { r0, r1, c0, c1 } = range();
        return r0 === r1 && c0 === c1 && !sheet().cells.get(cellKey(r0, c0)) ? '' : selectionTsv();
      },
      serialize: async (format) => {
        commitEdit();
        // Write the values people see next to the formulas that made them.
        for (let si = 0; si < book.sheets.length; si++) {
          for (const [k, cell] of book.sheets[si].cells) {
            if (!cell.f) continue;
            const [r, c] = k.split(':').map(Number);
            const v = value(si, r, c);
            cell.v = isError(v) ? v.code : v;
          }
        }
        return writeWorkbook(book, format, { active });
      },
    });
    this._shell = shell;

    const root = shell.root;
    const viewport = root.querySelector('.ldg-viewport');
    const canvas = root.querySelector('.ldg-canvas');
    const table = root.querySelector('.ldg-table');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    const refBox = root.querySelector('.ldg-ref');
    const input = root.querySelector('.ldg-input');
    const editor = root.querySelector('.ldg-editor');
    const tabs = root.querySelector('.ldg-tabs');
    const stats = root.querySelector('.ldg-stats');
    const formatSel = root.querySelector('[data-format]');

    const sheet = () => book.sheets[active];
    const colW = (c) => sheet().colWidths?.[c] || DEFAULT_W;
    const rowCount = () => Math.min(MAX_ROWS, Math.max(sheet().rows + 60, 100));
    const colCount = () => Math.min(MAX_COLS, Math.max(sheet().cols + 6, 26));

    /* ---------- values ---------- */

    function invalidate() { memo = new Map(); }

    function sheetIndex(name) {
      if (!name) return active;
      const i = book.sheets.findIndex(s => s.name.toLowerCase() === String(name).toLowerCase());
      return i;
    }

    function value(si, r, c) {
      const cell = book.sheets[si]?.cells.get(cellKey(r, c));
      if (!cell) return undefined;
      if (!cell.f) return cell.v;
      const mk = `${si}:${r}:${c}`;
      if (memo.has(mk)) return memo.get(mk);
      if (computing.has(mk)) return ERRORS.CIRC;
      computing.add(mk);
      let v;
      try {
        v = evaluate(cell.f, {
          cell: (name, rr, cc) => {
            const idx = name ? sheetIndex(name) : si;
            if (idx < 0) throw ERRORS.REF;
            const out = value(idx, rr, cc);
            if (isError(out)) throw out;
            return out;
          },
        });
      } finally { computing.delete(mk); }
      // An unfamiliar function keeps the value the file was saved with.
      if (isError(v) && v.code === '#NAME?' && cell.fileF === cell.f && cell.fileV !== undefined && cell.fileV !== '') v = cell.fileV;
      memo.set(mk, v);
      return v;
    }

    function raw(r, c) {
      const cell = sheet().cells.get(cellKey(r, c));
      if (!cell) return '';
      if (cell.f) return `=${cell.f}`;
      return cell.v == null ? '' : typeof cell.v === 'boolean' ? (cell.v ? 'TRUE' : 'FALSE') : String(cell.v);
    }

    /* ---------- history ---------- */

    function snapshot() {
      const s = sheet();
      return { active, name: s.name, cells: new Map([...s.cells].map(([k, v]) => [k, { ...v }])), rows: s.rows, cols: s.cols, colWidths: [...(s.colWidths || [])] };
    }
    function restore(snap) {
      active = Math.min(snap.active, book.sheets.length - 1);
      const s = sheet();
      Object.assign(s, { cells: snap.cells, rows: snap.rows, cols: snap.cols, colWidths: snap.colWidths });
      invalidate(); layout(); paint(); syncBar(); renderTabs();
    }
    function record() {
      undo.push(snapshot());
      if (undo.length > 60) undo.shift();
      redo = [];
    }
    function changed() {
      invalidate();
      shell.markDirty();
      layout();
      paint();
      syncBar();
    }

    /* ---------- editing ---------- */

    function setRaw(r, c, text) {
      const s = sheet();
      const k = cellKey(r, c);
      const prev = s.cells.get(k);
      const t = String(text ?? '');
      if (t === '') {
        if (prev?.z) s.cells.set(k, { v: '', z: prev.z });
        else s.cells.delete(k);
        return;
      }
      let cell;
      if (t.startsWith('=') && t.length > 1) cell = { v: '', f: t.slice(1) };
      else if (prev?.z === '@') cell = { v: t };
      else cell = { v: coerce(t) };
      if (prev?.z) cell.z = prev.z;
      s.cells.set(k, cell);
      s.rows = Math.max(s.rows, r + 1);
      s.cols = Math.max(s.cols, c + 1);
    }

    function startEdit(initial, via = 'cell') {
      if (editing) return;
      const { r, c } = sel;
      editing = { r, c, via, original: raw(r, c) };
      if (via === 'bar') { input.focus(); return; }
      const td = cellEl(r, c);
      const vr = viewport.getBoundingClientRect?.();
      const tr = td?.getBoundingClientRect?.();
      if (td && vr && tr) {
        editor.style.left = `${tr.left - vr.left + viewport.scrollLeft}px`;
        editor.style.top = `${tr.top - vr.top + viewport.scrollTop}px`;
        editor.style.width = `${Math.max(tr.width, 120)}px`;
        editor.style.height = `${tr.height}px`;
      }
      editor.hidden = false;
      editor.value = initial ?? editing.original;
      input.value = editor.value;
      editor.focus();
      const end = editor.value.length;
      editor.setSelectionRange?.(end, end);
    }

    function commitEdit(move) {
      if (!editing) return;
      const { r, c, via, original } = editing;
      const text = via === 'bar' ? input.value : editor.value;
      editing = null;
      editor.hidden = true;
      if (text !== original) {
        record();
        setRaw(r, c, text);
        changed();
      }
      if (move) moveBy(move[0], move[1], false);
      else paint();
      viewport.focus({ preventScroll: true });
    }

    function cancelEdit() {
      if (!editing) return;
      editing = null;
      editor.hidden = true;
      syncBar();
      viewport.focus({ preventScroll: true });
    }

    /* ---------- selection ---------- */

    const range = () => ({ r0: Math.min(sel.r, sel.r2), r1: Math.max(sel.r, sel.r2), c0: Math.min(sel.c, sel.c2), c1: Math.max(sel.c, sel.c2) });

    function select(r, c, extend = false) {
      r = Math.max(0, Math.min(MAX_ROWS - 1, r));
      c = Math.max(0, Math.min(MAX_COLS - 1, c));
      if (extend) { sel.r2 = r; sel.c2 = c; }
      else sel = { r, c, r2: r, c2: c };
      scrollIntoView(extend ? sel.r2 : r, extend ? sel.c2 : c);
      paint();
      syncBar();
    }

    function moveBy(dr, dc, extend) {
      if (extend) select(sel.r2 + dr, sel.c2 + dc, true);
      else select(sel.r + dr, sel.c + dc);
    }

    function colLeft(c) {
      let x = HEAD_W;
      for (let i = 0; i < c; i++) x += colW(i);
      return x;
    }

    function scrollIntoView(r, c) {
      const top = ROW_H + r * ROW_H;
      const vh = viewport.clientHeight || 0;
      if (vh) {
        if (top - ROW_H < viewport.scrollTop) viewport.scrollTop = top - ROW_H;
        else if (top + ROW_H > viewport.scrollTop + vh) viewport.scrollTop = top + ROW_H - vh;
      }
      const left = colLeft(c);
      const vw = viewport.clientWidth || 0;
      if (vw) {
        if (left - HEAD_W < viewport.scrollLeft) viewport.scrollLeft = left - HEAD_W;
        else if (left + colW(c) > viewport.scrollLeft + vw) viewport.scrollLeft = left + colW(c) - vw;
      }
    }

    function syncBar() {
      const { r0, r1, c0, c1 } = range();
      refBox.value = r0 === r1 && c0 === c1 ? `${indexToCol(sel.c)}${sel.r + 1}` : `${indexToCol(c0)}${r0 + 1}:${indexToCol(c1)}${r1 + 1}`;
      if (!editing) input.value = raw(sel.r, sel.c);
      const z = sheet().cells.get(cellKey(sel.r, sel.c))?.z || '';
      formatSel.value = [...formatSel.options].some(o => o.value === z) ? z : '';
      // Sum, average and count of the numbers in the selection.
      let sum = 0, count = 0, filled = 0;
      if ((r1 - r0 + 1) * (c1 - c0 + 1) <= 200_000) {
        for (const [k] of sheet().cells) {
          const [r, c] = k.split(':').map(Number);
          if (r < r0 || r > r1 || c < c0 || c > c1) continue;
          const v = value(active, r, c);
          if (v !== '' && v != null) filled++;
          if (typeof v === 'number') { sum += v; count++; }
        }
      }
      stats.textContent = filled > 1 || count > 1
        ? `Sum ${formatValue(sum)} · Average ${count ? formatValue(sum / count) : '–'} · Count ${filled}`
        : '';
    }

    /* ---------- rendering ---------- */

    let firstRow = 0, lastRow = 0;

    function layout() {
      const cols = colCount();
      let width = HEAD_W;
      for (let c = 0; c < cols; c++) width += colW(c);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${ROW_H * (rowCount() + 1)}px`;
      thead.innerHTML = `<tr><th class="ldg-corner" style="width:${HEAD_W}px"></th>${Array.from({ length: cols }, (_, c) => `<th class="ldg-colh" data-c="${c}" style="width:${colW(c)}px;min-width:${colW(c)}px;max-width:${colW(c)}px">${indexToCol(c)}<span class="ldg-resize" data-resize="${c}"></span></th>`).join('')}</tr>`;
    }

    function cellEl(r, c) {
      return tbody.querySelector(`td[data-r="${r}"][data-c="${c}"]`);
    }

    function paint() {
      const vh = viewport.clientHeight || 600;
      const top = viewport.scrollTop || 0;
      firstRow = Math.max(0, Math.floor(top / ROW_H) - 8);
      lastRow = Math.min(rowCount() - 1, Math.ceil((top + vh) / ROW_H) + 8);
      const cols = colCount();
      const { r0, r1, c0, c1 } = range();
      const s = sheet();
      const rowsHtml = [];
      if (firstRow) rowsHtml.push(`<tr class="ldg-spacer" style="height:${firstRow * ROW_H}px"><td colspan="${cols + 1}"></td></tr>`);
      for (let r = firstRow; r <= lastRow; r++) {
        let row = `<tr><th class="ldg-rowh${r >= r0 && r <= r1 ? ' is-on' : ''}" data-r="${r}">${r + 1}</th>`;
        for (let c = 0; c < cols; c++) {
          const cell = s.cells.get(cellKey(r, c));
          const v = cell ? value(active, r, c) : undefined;
          const cls = [];
          if (typeof v === 'number') cls.push('n');
          if (isError(v)) cls.push('err');
          if (typeof v === 'boolean') cls.push('b');
          if (r >= r0 && r <= r1 && c >= c0 && c <= c1) cls.push('in-sel');
          if (r === sel.r && c === sel.c) cls.push('is-active');
          row += `<td data-r="${r}" data-c="${c}"${cls.length ? ` class="${cls.join(' ')}"` : ''}>${cell ? esc(formatValue(v, cell.z)) : ''}</td>`;
        }
        rowsHtml.push(row + '</tr>');
      }
      rowsHtml.push(`<tr class="ldg-spacer" style="height:${Math.max(0, (rowCount() - lastRow - 1) * ROW_H)}px"><td colspan="${cols + 1}"></td></tr>`);
      tbody.innerHTML = rowsHtml.join('');
      thead.querySelectorAll('.ldg-colh').forEach(th => th.classList.toggle('is-on', +th.dataset.c >= c0 && +th.dataset.c <= c1));
    }

    function renderTabs() {
      tabs.innerHTML = book.sheets.map((s, i) => `<button type="button" role="tab" class="ldg-tab${i === active ? ' is-active' : ''}" aria-selected="${i === active}" data-sheet="${i}" title="Double-click to rename">${esc(s.name)}</button>`).join('')
        + `<button type="button" class="ldg-tab ldg-tab-add" data-add-sheet title="Add sheet" aria-label="Add sheet">${icon(I.plus, 14)}</button>`;
    }

    let raf = 0;
    viewport.addEventListener('scroll', () => {
      if (raf) return;
      raf = (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : setTimeout)(() => {
        raf = 0;
        const top = viewport.scrollTop;
        if (Math.floor(top / ROW_H) - 4 < firstRow || Math.ceil((top + viewport.clientHeight) / ROW_H) + 4 > lastRow) paint();
      });
    });

    /* ---------- mouse ---------- */

    let dragging = false;
    viewport.addEventListener('mousedown', (e) => {
      const resize = e.target.closest('[data-resize]');
      if (resize) {
        e.preventDefault();
        const c = +resize.dataset.resize;
        const startX = e.clientX, startW = colW(c);
        const move = (ev) => {
          const s = sheet();
          s.colWidths = s.colWidths || [];
          s.colWidths[c] = Math.max(32, Math.round(startW + ev.clientX - startX));
          layout(); paint();
        };
        const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); shell.markDirty(); };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
        return;
      }
      if (e.target === editor) return;
      const td = e.target.closest('td[data-r]');
      const rowh = e.target.closest('th.ldg-rowh');
      const colh = e.target.closest('th.ldg-colh');
      // The cell is re-rendered under the pointer, so take focus ourselves
      // rather than let the browser hand it to whatever is left.
      if (td || rowh || colh) e.preventDefault();
      if (editing) commitEdit();
      if (td) { select(+td.dataset.r, +td.dataset.c, e.shiftKey); dragging = true; }
      else if (rowh) { const r = +rowh.dataset.r; sel = { r, c: 0, r2: r, c2: colCount() - 1 }; paint(); syncBar(); }
      else if (colh) { const c = +colh.dataset.c; sel = { r: 0, c, r2: rowCount() - 1, c2: c }; paint(); syncBar(); }
      viewport.focus({ preventScroll: true });
    });
    viewport.addEventListener('mouseover', (e) => {
      if (!dragging) return;
      const td = e.target.closest('td[data-r]');
      if (td && (+td.dataset.r !== sel.r2 || +td.dataset.c !== sel.c2)) { sel.r2 = +td.dataset.r; sel.c2 = +td.dataset.c; paint(); syncBar(); }
    });
    const stopDrag = () => { dragging = false; };
    document.addEventListener('mouseup', stopDrag);
    viewport.addEventListener('dblclick', (e) => {
      const td = e.target.closest('td[data-r]');
      if (td) { select(+td.dataset.r, +td.dataset.c); startEdit(); }
    });

    /* ---------- keyboard ---------- */

    viewport.addEventListener('keydown', (e) => {
      if (e.target === editor) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key;
      if (mod && k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); return; }
      if (mod && k.toLowerCase() === 'y') { e.preventDefault(); doRedo(); return; }
      if (mod && k.toLowerCase() === 'a') { e.preventDefault(); sel = { r: 0, c: 0, r2: Math.max(0, sheet().rows - 1), c2: Math.max(0, sheet().cols - 1) }; paint(); syncBar(); return; }
      if (mod) return; // copy/paste arrive as clipboard events
      const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (moves[k]) { e.preventDefault(); moveBy(...moves[k], e.shiftKey); return; }
      if (k === 'Enter') { e.preventDefault(); if (e.shiftKey) moveBy(-1, 0); else startEdit(); return; }
      if (k === 'Tab') { e.preventDefault(); moveBy(0, e.shiftKey ? -1 : 1); return; }
      if (k === 'F2') { e.preventDefault(); startEdit(); return; }
      if (k === 'Home') { e.preventDefault(); select(sel.r, 0); return; }
      if (k === 'PageDown' || k === 'PageUp') { e.preventDefault(); moveBy((k === 'PageDown' ? 1 : -1) * Math.max(1, Math.floor((viewport.clientHeight || 400) / ROW_H) - 2), 0, e.shiftKey); return; }
      if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); clearRange(); return; }
      if (k.length === 1 && !e.altKey) { e.preventDefault(); startEdit(k); }
    });

    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commitEdit([e.shiftKey ? -1 : 1, 0]); }
      else if (e.key === 'Tab') { e.preventDefault(); commitEdit([0, e.shiftKey ? -1 : 1]); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
    });
    editor.addEventListener('input', () => { input.value = editor.value; });
    editor.addEventListener('blur', () => { if (editing?.via === 'cell') commitEdit(); });

    input.addEventListener('focus', () => { if (!editing) { editing = { r: sel.r, c: sel.c, via: 'bar', original: raw(sel.r, sel.c) }; } });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commitEdit([1, 0]); }
      else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
    });
    input.addEventListener('blur', () => { if (editing?.via === 'bar') commitEdit(); });

    refBox.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const m = /^([A-Za-z]{1,3})(\d+)(?::([A-Za-z]{1,3})(\d+))?$/.exec(refBox.value.trim());
      if (!m) { syncBar(); return; }
      const toC = (s) => { let n = 0; for (const ch of s.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
      select(+m[2] - 1, toC(m[1]));
      if (m[3]) select(+m[4] - 1, toC(m[3]), true);
      viewport.focus({ preventScroll: true });
    });

    /* ---------- clipboard ---------- */

    function selectionTsv() {
      const { r0, r1, c0, c1 } = range();
      const lines = [];
      for (let r = r0; r <= Math.min(r1, r0 + 10000); r++) {
        const row = [];
        for (let c = c0; c <= Math.min(c1, c0 + 500); c++) {
          const cell = sheet().cells.get(cellKey(r, c));
          const text = cell ? formatValue(value(active, r, c), cell.z) : '';
          row.push(/[\t\n"]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
        }
        lines.push(row.join('\t'));
      }
      return lines.join('\n');
    }
    function copy(e, cut) {
      if (editing || !root.contains(document.activeElement)) return;
      const tsv = selectionTsv();
      const { r0, r1, c0, c1 } = range();
      internalClip = { tsv, cells: [] };
      for (let r = r0; r <= r1 && r <= r0 + 10000; r++) {
        const row = [];
        for (let c = c0; c <= c1 && c <= c0 + 500; c++) row.push(raw(r, c));
        internalClip.cells.push(row);
      }
      e.clipboardData?.setData('text/plain', tsv);
      e.preventDefault();
      if (cut) clearRange();
    }
    const onCopy = (e) => { if (document.activeElement === viewport) copy(e, false); };
    const onCut = (e) => { if (document.activeElement === viewport) copy(e, true); };
    const onPaste = (e) => {
      if (document.activeElement !== viewport) return;
      const text = e.clipboardData?.getData('text/plain') ?? '';
      e.preventDefault();
      const grid = internalClip && internalClip.tsv === text ? internalClip.cells : parseDelimited(text.replace(/\r?\n$/, ''), '\t');
      if (!grid.length) return;
      record();
      grid.forEach((row, i) => row.forEach((t, j) => setRaw(sel.r + i, sel.c + j, t)));
      sel.r2 = sel.r + grid.length - 1;
      sel.c2 = sel.c + Math.max(...grid.map(r => r.length)) - 1;
      changed();
    };
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('paste', onPaste);

    /* ---------- operations ---------- */

    function clearRange() {
      const { r0, r1, c0, c1 } = range();
      record();
      const s = sheet();
      for (const k of [...s.cells.keys()]) {
        const [r, c] = k.split(':').map(Number);
        if (r >= r0 && r <= r1 && c >= c0 && c <= c1) s.cells.delete(k);
      }
      changed();
    }

    function shiftCells(axis, at, delta) {
      const s = sheet();
      const next = new Map();
      for (const [k, cell] of s.cells) {
        let [r, c] = k.split(':').map(Number);
        const pos = axis === 'row' ? r : c;
        if (delta < 0 && pos === at) continue;
        if (pos >= at + (delta < 0 ? 1 : 0)) { if (axis === 'row') r += delta; else c += delta; }
        next.set(cellKey(r, c), cell);
      }
      // Keep formulas pointing at the same cells, on every sheet.
      book.sheets.forEach((other, si) => {
        const map = si === active ? next : other.cells;
        for (const cell of map.values()) {
          if (cell.f) cell.f = shiftFormula(cell.f, { axis, at, delta, sheetName: s.name, own: si === active });
        }
      });
      s.cells = next;
      if (axis === 'row') s.rows = Math.max(0, s.rows + delta);
      else {
        s.cols = Math.max(0, s.cols + delta);
        const w = s.colWidths || [];
        if (delta > 0) w.splice(at, 0, undefined); else w.splice(at, 1);
      }
    }

    function sortBy(desc) {
      const s = sheet();
      const { r0, r1 } = range();
      const c = sel.c;
      let start = r0, end = r1;
      if (r0 === r1) {
        // One cell selected: sort the whole table, keeping a text header row.
        start = 0; end = s.rows - 1;
        const header = [...s.cells].filter(([k]) => k.startsWith('0:')).map(([, v]) => v.v);
        if (header.length && header.every(v => typeof v === 'string')) start = 1;
      }
      if (end <= start) return;
      record();
      const rows = [];
      for (let r = start; r <= end; r++) {
        const cells = new Map();
        for (const [k, v] of s.cells) { const [rr, cc] = k.split(':').map(Number); if (rr === r) cells.set(cc, v); }
        rows.push({ key: value(active, r, c), cells });
      }
      const rank = (v) => (v === '' || v == null ? 3 : typeof v === 'number' ? 0 : typeof v === 'boolean' ? 2 : 1);
      rows.sort((a, b) => {
        const ra = rank(a.key), rb = rank(b.key);
        if (ra !== rb) return ra - rb; // blanks always last
        const cmp = ra === 0 ? a.key - b.key : String(a.key).localeCompare(String(b.key), undefined, { numeric: true, sensitivity: 'base' });
        return desc ? -cmp : cmp;
      });
      for (const k of [...s.cells.keys()]) { const r = +k.split(':')[0]; if (r >= start && r <= end) s.cells.delete(k); }
      rows.forEach((row, i) => { for (const [cc, v] of row.cells) s.cells.set(cellKey(start + i, cc), v); });
      changed();
    }

    function autoSum() {
      const { r, c } = sel;
      const num = (rr, cc) => typeof value(active, rr, cc) === 'number';
      let top = r - 1;
      while (top >= 0 && num(top, c)) top--;
      let text;
      if (top < r - 1) text = `=SUM(${indexToCol(c)}${top + 2}:${indexToCol(c)}${r})`;
      else {
        let left = c - 1;
        while (left >= 0 && num(r, left)) left--;
        text = left < c - 1 ? `=SUM(${indexToCol(left + 1)}${r + 1}:${indexToCol(c - 1)}${r + 1})` : '=SUM()';
      }
      record();
      setRaw(r, c, text);
      changed();
    }

    function doUndo() {
      const snap = undo.pop();
      if (!snap) return;
      redo.push(snapshot());
      restore(snap);
      shell.markDirty();
    }
    function doRedo() {
      const snap = redo.pop();
      if (!snap) return;
      undo.push(snapshot());
      restore(snap);
      shell.markDirty();
    }

    root.querySelector('.dx-toolbar').addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      commitEdit();
      const { r0, c0 } = range();
      if (act === 'undo') doUndo();
      else if (act === 'redo') doRedo();
      else if (act === 'sum') autoSum();
      else if (act === 'rowAdd') { record(); shiftCells('row', r0, 1); changed(); }
      else if (act === 'rowDel') { record(); shiftCells('row', r0, -1); changed(); }
      else if (act === 'colAdd') { record(); shiftCells('col', c0, 1); changed(); }
      else if (act === 'colDel') { record(); shiftCells('col', c0, -1); changed(); }
      else if (act === 'sortAsc') sortBy(false);
      else if (act === 'sortDesc') sortBy(true);
      viewport.focus({ preventScroll: true });
    });

    formatSel.addEventListener('change', () => {
      const z = formatSel.value;
      const { r0, r1, c0, c1 } = range();
      record();
      const s = sheet();
      const maxR = Math.min(r1, Math.max(r0, s.rows - 1)), maxC = Math.min(c1, Math.max(c0, s.cols - 1));
      for (let r = r0; r <= maxR; r++) for (let c = c0; c <= maxC; c++) {
        const k = cellKey(r, c);
        const cell = s.cells.get(k);
        if (!cell && !z) continue;
        const next = { ...(cell || { v: '' }) };
        if (z) next.z = z; else delete next.z;
        if (z === '@' && typeof next.v === 'number') next.v = String(next.v);
        s.cells.set(k, next);
      }
      changed();
      viewport.focus({ preventScroll: true });
    });

    tabs.addEventListener('click', (e) => {
      if (e.target.closest('[data-add-sheet]')) {
        commitEdit();
        let n = book.sheets.length + 1;
        while (book.sheets.some(s => s.name.toLowerCase() === `sheet${n}`)) n++;
        book.sheets.push(emptySheet(`Sheet${n}`));
        active = book.sheets.length - 1;
        sel = { r: 0, c: 0, r2: 0, c2: 0 };
        shell.markDirty(); invalidate(); renderTabs(); layout(); paint(); syncBar();
        return;
      }
      const t = e.target.closest('[data-sheet]');
      if (!t) return;
      commitEdit();
      active = +t.dataset.sheet;
      sel = { r: 0, c: 0, r2: 0, c2: 0 };
      renderTabs(); layout(); viewport.scrollTo?.(0, 0); paint(); syncBar();
    });
    tabs.addEventListener('dblclick', (e) => {
      const t = e.target.closest('[data-sheet]');
      if (!t || typeof prompt !== 'function') return;
      const i = +t.dataset.sheet;
      const name = prompt('Sheet name (leave empty to delete this sheet)', book.sheets[i].name);
      if (name === null) return;
      const clean = name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31);
      if (!clean) {
        if (book.sheets.length === 1) return;
        if (typeof confirm === 'function' && !confirm(`Delete ${book.sheets[i].name}?`)) return;
        book.sheets.splice(i, 1);
        active = Math.min(active, book.sheets.length - 1);
        undo = []; redo = [];
      } else {
        const old = book.sheets[i].name;
        book.sheets[i].name = clean;
        // References to the old name follow the rename.
        for (const s of book.sheets) for (const cell of s.cells.values()) {
          if (cell.f) cell.f = cell.f.replace(new RegExp(`('?)${old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1!`, 'gi'), () => (/[^A-Za-z0-9_]/.test(clean) ? `'${clean}'!` : `${clean}!`));
        }
      }
      shell.markDirty(); invalidate(); renderTabs(); layout(); paint(); syncBar();
    });

    this._book = () => book;
    this._setRaw = (r, c, t) => { setRaw(r, c, t); changed(); };
    this._value = (r, c) => value(active, r, c);
    this._teardown = () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('mouseup', stopDrag);
    };

    renderTabs();
    layout();
    paint();
    syncBar();

    const incoming = artifact || this._pending;
    if (incoming) this.setArtifact(incoming);
  },

  getArtifact() {
    const book = this._book?.();
    if (!book) return null;
    try {
      const s = book.sheets[0];
      const lines = [];
      for (let r = 0; r < Math.min(s.rows, 5000); r++) {
        const row = [];
        for (let c = 0; c < s.cols; c++) {
          const v = this._value(r, c);
          const t = v == null ? '' : isError(v) ? v.code : String(v);
          row.push(/[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
        }
        lines.push(row.join(','));
      }
      return { kind: 'csv', text: lines.join('\n') };
    } catch { return null; }
  },

  async setArtifact(a) {
    if (!a) return;
    if (!this._shell) { this._pending = a; return; }
    try {
      // CSV handed over from another tool has no file behind it.
      const art = a.name ? a : { ...a, name: a.kind === 'csv' ? 'Imported.csv' : 'Imported.xlsx' };
      await this._shell.openArtifact(art);
    } catch (err) { console.warn('Ledger could not open that file', err); }
  },

  destroy() {
    this._teardown?.();
    this._shell?.destroy();
    this._shell = this._book = this._setRaw = this._value = this._teardown = this._pending = null;
  },
};
