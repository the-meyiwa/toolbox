/* ============================================================
   CSV table operations and list operations. Pure functions over
   rows (arrays of strings) and lines, so the tools, the Assistant
   and the tests all call the same code.
   ============================================================ */

import { parseCsvRows, writeCsvRows, sniffDelimiter } from './data-formats.js';

/* ---------------- CSV ---------------- */

export function readTable(text, delimiter = 'auto') {
  const d = delimiter === 'auto' ? sniffDelimiter(text) : delimiter === '\\t' ? '\t' : delimiter;
  return { rows: parseCsvRows(text, d), d };
}

/** 1-based column reference by number or by header name. */
export function columnIndex(rows, ref) {
  const r = String(ref ?? '').trim();
  if (/^\d+$/.test(r)) return Number(r) - 1;
  const i = (rows[0] || []).findIndex((h) => h.trim().toLowerCase() === r.toLowerCase());
  if (i < 0) throw new Error(`No column called “${r}”`);
  return i;
}

export function transpose(rows) {
  const w = Math.max(0, ...rows.map((r) => r.length));
  return Array.from({ length: w }, (_, c) => rows.map((r) => r[c] ?? ''));
}

export function swapColumns(rows, a, b) {
  return rows.map((r) => { const x = [...r]; [x[a], x[b]] = [x[b] ?? '', x[a] ?? '']; return x; });
}

export function deleteColumns(rows, idx) {
  const drop = new Set(idx);
  return rows.map((r) => r.filter((_, i) => !drop.has(i)));
}

export function insertColumn(rows, at, header, fill = '') {
  return rows.map((r, i) => { const x = [...r]; x.splice(Math.min(at, x.length), 0, i === 0 && header ? header : fill); return x; });
}

export function pickColumns(rows, idx) { return rows.map((r) => idx.map((i) => r[i] ?? '')); }

export function sortByColumn(rows, col, { desc = false, numeric = 'auto', header = true } = {}) {
  const head = header ? rows.slice(0, 1) : [];
  const body = header ? rows.slice(1) : [...rows];
  const isNum = numeric === 'auto' ? body.every((r) => r[col] === '' || r[col] == null || !Number.isNaN(Number(r[col]))) : numeric;
  body.sort((x, y) => {
    const a = x[col] ?? ''; const b = y[col] ?? '';
    const c = isNum ? (Number(a) || 0) - (Number(b) || 0) : a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    return desc ? -c : c;
  });
  return [...head, ...body];
}

export function dedupeRows(rows, { header = true, col = null } = {}) {
  const seen = new Set();
  return rows.filter((r, i) => {
    if (header && i === 0) return true;
    const key = col == null ? JSON.stringify(r) : r[col];
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

/** Rows whose width differs from the header, or with empty cells. */
export function incompleteRows(rows, { header = true, emptyCells = true } = {}) {
  const width = rows[0]?.length ?? 0;
  const problems = [];
  rows.forEach((r, i) => {
    if (header && i === 0) return;
    if (r.length !== width) problems.push({ line: i + 1, issue: `${r.length} fields, expected ${width}`, row: r });
    else if (emptyCells) {
      const empty = r.map((c, j) => (c.trim() === '' ? j : -1)).filter((j) => j >= 0);
      if (empty.length) problems.push({ line: i + 1, issue: `empty: ${empty.map((j) => rows[0]?.[j] || `#${j + 1}`).join(', ')}`, row: r });
    }
  });
  return problems;
}

export function filterRows(rows, col, query, { header = true, mode = 'contains' } = {}) {
  const q = String(query).toLowerCase();
  return rows.filter((r, i) => {
    if (header && i === 0) return true;
    const v = String(r[col] ?? '').toLowerCase();
    return mode === 'equals' ? v === q : mode === 'not' ? !v.includes(q) : v.includes(q);
  });
}

export function columnStats(rows, { header = true } = {}) {
  const head = header ? rows[0] : rows[0].map((_, i) => `#${i + 1}`);
  const body = header ? rows.slice(1) : rows;
  return head.map((h, c) => {
    const vals = body.map((r) => r[c] ?? '');
    const filled = vals.filter((v) => v.trim() !== '');
    const nums = filled.map(Number).filter((n) => !Number.isNaN(n));
    const numeric = filled.length > 0 && nums.length === filled.length;
    return {
      column: h, filled: filled.length, empty: vals.length - filled.length, unique: new Set(filled).size,
      ...(numeric ? { min: Math.min(...nums), max: Math.max(...nums), sum: nums.reduce((a, b) => a + b, 0), mean: nums.reduce((a, b) => a + b, 0) / nums.length } : {}),
    };
  });
}

export { writeCsvRows };

/* ---------------- lists ---------------- */

export function splitItems(text, sep = 'newline') {
  const map = { newline: /\r?\n/, comma: /\s*,\s*/, space: /\s+/, semicolon: /\s*;\s*/, tab: /\t/ };
  const re = map[sep] ?? new RegExp(String(sep).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return text.split(re);
}

export function joinItems(items, sep = 'newline') {
  const map = { newline: '\n', comma: ', ', space: ' ', semicolon: '; ', tab: '\t' };
  return items.join(map[sep] ?? sep);
}

/** Fisher–Yates with crypto randomness, so shuffles are fair. */
export function shuffle(list, random = cryptoRandom) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export function cryptoRandom() {
  if (globalThis.crypto?.getRandomValues) { const u = new Uint32Array(1); crypto.getRandomValues(u); return u[0] / 2 ** 32; }
  return Math.random();
}

export function frequencies(list, { caseSensitive = false, trim = true } = {}) {
  const m = new Map();
  for (let x of list) {
    if (trim) x = x.trim();
    if (!x) continue;
    const k = caseSensitive ? x : x.toLowerCase();
    const e = m.get(k) || { item: x, count: 0 };
    e.count++; m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.item.localeCompare(b.item));
}

export function uniqueItems(list, { caseSensitive = false, onlyOnce = false } = {}) {
  const f = frequencies(list, { caseSensitive, trim: false });
  if (onlyOnce) return f.filter((e) => e.count === 1).map((e) => e.item);
  const seen = new Set(); const out = [];
  for (const x of list) { const k = caseSensitive ? x : x.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(x); } }
  return out;
}

export function groupItems(list, size) {
  const n = Math.max(1, Math.floor(size) || 1);
  const out = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

export function rotateItems(list, by) {
  if (!list.length) return list;
  const k = ((Math.trunc(by) % list.length) + list.length) % list.length;
  return [...list.slice(k), ...list.slice(0, k)];
}

export function wrapItems(list, prefix = '', suffix = '') { return list.map((x) => `${prefix}${x}${suffix}`); }

export function unwrapItems(list, prefix = '', suffix = '') {
  return list.map((x) => {
    let y = x;
    if (prefix && y.startsWith(prefix)) y = y.slice(prefix.length);
    if (suffix && y.endsWith(suffix)) y = y.slice(0, -suffix.length);
    return y;
  });
}

export function numberItems(list, { start = 1, format = '{n}. ' } = {}) {
  return list.map((x, i) => format.replace('{n}', String(start + i)) + x);
}

/** Random sample without replacement. */
export function sample(list, n, random = cryptoRandom) { return shuffle(list, random).slice(0, Math.max(0, n)); }
