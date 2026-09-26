/* ============================================================
   Workbooks for Ledger: read and write .xlsx, .xls, .ods, .csv, .tsv.

   The binary formats go through SheetJS, loaded on first use. CSV and
   TSV are parsed here so the File Explorer's preview never needs it.

   Workbook model
     { sheets: [{ name, cells: Map<"r:c", { v, f?, z? }>, rows, cols,
                  colWidths: number[] (px), merges: {s:{r,c},e:{r,c}}[] }] }
   `v` is the value shown; `f` the formula without its "=".
   ============================================================ */

import { toBytes, toText } from './xml.js';
import { extOf } from './formats.js';
import { evaluate, isError } from './formula.js';

const key = (r, c) => `${r}:${c}`;
export { key as cellKey };

export function emptySheet(name = 'Sheet1') {
  return { name, cells: new Map(), rows: 0, cols: 0, colWidths: [], merges: [] };
}

/** RFC 4180 parse: quoted fields, doubled quotes, embedded newlines. */
export function parseDelimited(text, sep = ',') {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const s = String(text ?? '').replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** A typed value from text: numbers become numbers unless that would lose digits. */
export function coerce(text) {
  const t = String(text ?? '');
  if (t === '') return '';
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t.trim()) && !/^[+-]?0\d/.test(t.trim()) && t.trim().replace(/[^\d]/g, '').length <= 15) return Number(t);
  if (/^true$/i.test(t)) return true;
  if (/^false$/i.test(t)) return false;
  return t;
}

export function sheetFromRows(rows, name = 'Sheet1') {
  const sheet = emptySheet(name);
  rows.forEach((row, r) => row.forEach((text, c) => {
    const v = coerce(text);
    if (v === '') return;
    if (typeof text === 'string' && text.startsWith('=') && text.length > 1) sheet.cells.set(key(r, c), { v: '', f: text.slice(1) });
    else sheet.cells.set(key(r, c), { v });
  }));
  sheet.rows = rows.length;
  sheet.cols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return sheet;
}

async function sheetjs() {
  const mod = await import('@e965/xlsx');
  return mod.read ? mod : mod.default;
}

/** Read any supported spreadsheet file into the workbook model. */
export async function readWorkbook(data, name = 'book.xlsx') {
  const ext = extOf(name);
  if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
    const text = await toText(data);
    const sep = ext === 'tsv' ? '\t' : sniffSeparator(text);
    return { sheets: [sheetFromRows(parseDelimited(text, sep), stemName(name))], separator: sep };
  }
  const XLSX = await sheetjs();
  const wb = XLSX.read(await toBytes(data), { type: 'array', cellFormula: true, cellNF: true, cellDates: false, cellStyles: true });
  const sheets = wb.SheetNames.map((sheetName) => {
    const ws = wb.Sheets[sheetName];
    const sheet = emptySheet(sheetName);
    if (!ws) return sheet;
    for (const addr of Object.keys(ws)) {
      if (addr[0] === '!') continue;
      const cell = ws[addr];
      const { r, c } = XLSX.utils.decode_cell(addr);
      let v = cell.v;
      if (cell.t === 'e') v = cell.w || '#ERROR';
      if (cell.t === 'z' || v == null) v = '';
      const out = { v };
      if (cell.f) out.f = String(cell.f).replace(/^=/, '');
      if (cell.z && cell.z !== 'General') out.z = cell.z;
      if (v === '' && !out.f) continue;
      sheet.cells.set(key(r, c), out);
      sheet.rows = Math.max(sheet.rows, r + 1);
      sheet.cols = Math.max(sheet.cols, c + 1);
    }
    if (ws['!ref']) {
      const range = XLSX.utils.decode_range(ws['!ref']);
      sheet.rows = Math.max(sheet.rows, Math.min(range.e.r + 1, 1_048_576));
      sheet.cols = Math.max(sheet.cols, Math.min(range.e.c + 1, 16_384));
    }
    sheet.colWidths = (ws['!cols'] || []).map(col => (col ? Math.round(col.wpx || (col.wch ? col.wch * 7 + 5 : 0) || (col.width ? col.width * 7 : 0)) || undefined : undefined));
    sheet.merges = (ws['!merges'] || []).map(m => ({ s: { r: m.s.r, c: m.s.c }, e: { r: m.e.r, c: m.e.c } }));
    return sheet;
  });
  return { sheets: sheets.length ? sheets : [emptySheet()] };
}

function stemName(name) {
  const base = String(name).split('/').pop();
  return (base.includes('.') ? base.slice(0, base.lastIndexOf('.')) : base).slice(0, 31) || 'Sheet1';
}

function sniffSeparator(text) {
  const head = String(text).split(/\r?\n/).slice(0, 5).join('\n');
  const counts = [',', ';', '\t', '|'].map(s => [s, head.split(s).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

const csvField = (v, sep) => {
  const s = v == null ? '' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v);
  return s.includes(sep) || /["\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One sheet as delimited text, using the values shown. */
export function sheetToDelimited(sheet, sep = ',') {
  const lines = [];
  let lastRow = -1, lastCol = -1;
  for (const [k, cell] of sheet.cells) {
    if (cell.v === '' || cell.v == null) continue;
    const [r, c] = k.split(':').map(Number);
    lastRow = Math.max(lastRow, r); lastCol = Math.max(lastCol, c);
  }
  for (let r = 0; r <= lastRow; r++) {
    const row = [];
    for (let c = 0; c <= lastCol; c++) row.push(csvField(sheet.cells.get(key(r, c))?.v, sep));
    lines.push(row.join(sep).replace(new RegExp(`(${sep === '|' ? '\\|' : sep})+$`), ''));
  }
  return lines.join('\r\n') + (lines.length ? '\r\n' : '');
}

const BOOK_TYPES = { xlsx: 'xlsx', xlsm: 'xlsx', xls: 'biff8', ods: 'ods' };
const MIMES = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
};

/** Workbook model → file Blob in the given format. CSV/TSV write the active sheet. */
export async function writeWorkbook(book, format, { active = 0 } = {}) {
  if (format === 'csv' || format === 'tsv') {
    const sep = format === 'tsv' ? '\t' : (book.separator && book.separator !== '\t' ? book.separator : ',');
    return new Blob([sheetToDelimited(book.sheets[active] || book.sheets[0], sep)], { type: `${MIMES[format]};charset=utf-8` });
  }
  // Formats that drop formulas (.xls) still need their results.
  fillFormulaValues(book);
  const XLSX = await sheetjs();
  const wb = XLSX.utils.book_new();
  const used = new Set();
  for (const sheet of book.sheets) {
    const ws = {};
    let maxR = 0, maxC = 0;
    for (const [k, cell] of sheet.cells) {
      const [r, c] = k.split(':').map(Number);
      const v = cell.v;
      if ((v === '' || v == null) && !cell.f) continue;
      const out = {};
      if (typeof v === 'number') { out.t = 'n'; out.v = Number.isFinite(v) ? v : 0; }
      else if (typeof v === 'boolean') { out.t = 'b'; out.v = v; }
      else if (typeof v === 'string' && /^#(DIV\/0!|VALUE!|REF!|NAME\?|N\/A|NUM!|NULL!)$/.test(v)) { out.t = 'e'; out.v = { '#NULL!': 0, '#DIV/0!': 7, '#VALUE!': 15, '#REF!': 23, '#NAME?': 29, '#NUM!': 36, '#N/A': 42 }[v]; out.w = v; }
      else { out.t = 's'; out.v = v == null ? '' : String(v); }
      if (cell.f) out.f = cell.f;
      if (cell.z) out.z = cell.z;
      ws[XLSX.utils.encode_cell({ r, c })] = out;
      maxR = Math.max(maxR, r); maxC = Math.max(maxC, c);
    }
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
    if (sheet.colWidths?.some(Boolean)) ws['!cols'] = sheet.colWidths.map(w => (w ? { wpx: w } : null)).map(c => c || {});
    if (sheet.merges?.length) ws['!merges'] = sheet.merges;
    let name = String(sheet.name || 'Sheet').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet';
    while (used.has(name.toLowerCase())) name = `${name.slice(0, 28)} ${used.size + 1}`;
    used.add(name.toLowerCase());
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const bookType = BOOK_TYPES[format] || 'xlsx';
  const out = XLSX.write(wb, { bookType, type: 'array', compression: true });
  return new Blob([out], { type: MIMES[format] || MIMES.xlsx });
}

/**
 * Give formula cells that arrived without a saved result (CSV, or files
 * written by tools that skip it) a value, so previews never show blanks.
 */
export function fillFormulaValues(book) {
  const busy = new Set();
  const byName = new Map(book.sheets.map((s, i) => [s.name.toLowerCase(), i]));
  const valueAt = (si, r, c) => {
    const cell = book.sheets[si]?.cells.get(key(r, c));
    if (!cell) return undefined;
    if (!cell.f || (cell.v !== '' && cell.v != null)) return cell.v;
    const id = `${si}:${r}:${c}`;
    if (busy.has(id)) return '#CIRC!';
    busy.add(id);
    const v = evaluate(cell.f, { cell: (name, rr, cc) => valueAt(name ? byName.get(name.toLowerCase()) ?? -1 : si, rr, cc) });
    busy.delete(id);
    cell.v = isError(v) ? v.code : v;
    return cell.v;
  };
  book.sheets.forEach((s, si) => { for (const k of s.cells.keys()) { const [r, c] = k.split(':').map(Number); valueAt(si, r, c); } });
  return book;
}
