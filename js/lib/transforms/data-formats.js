/* ============================================================
   Data formats: CSV, TSV, JSON, YAML and XML, read into one value
   model and written back out, so any pair converts through it.

   Tables are arrays of flat objects. Nested values written to CSV
   are flattened to dotted columns ("address.city") and rebuilt from
   them on the way back when asked. Pure functions, no DOM except the
   XML parser, which takes a DOMParser so tests can pass one in.
   ============================================================ */

import YAML from 'yaml';

/* ---------------- CSV ---------------- */

/** Guess the delimiter from the first few lines, ignoring quoted text. */
export function sniffDelimiter(text) {
  const sample = text.split(/\r?\n/).slice(0, 10).join('\n').replace(/"[^"]*"/g, '');
  let best = ','; let bestScore = 0;
  for (const d of [',', '\t', ';', '|']) {
    const counts = sample.split('\n').filter(Boolean).map((l) => l.split(d).length - 1);
    if (!counts.length || !counts[0]) continue;
    const consistent = counts.filter((c) => c === counts[0]).length;
    const score = counts[0] * consistent;
    if (score > bestScore) { best = d; bestScore = score; }
  }
  return best;
}

/** RFC 4180 rows: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsvRows(text, delimiter = ',') {
  const rows = []; let row = []; let field = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"' && field === '') q = true;
    else if (c === delimiter) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

const needsQuote = (s, d) => s.includes(d) || /["\r\n]/.test(s) || /^\s|\s$/.test(s);
export function csvCell(v, d = ',') {
  const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return needsQuote(s, d) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const writeCsvRows = (rows, d = ',') => rows.map((r) => r.map((c) => csvCell(c, d)).join(d)).join('\n');

/** Typed cell: numbers, booleans and null come back as themselves. */
export function typedCell(s) {
  const t = s.trim();
  if (t === '') return '';
  if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(t) && t.length < 16) return Number(t);
  if (t === 'true' || t === 'false') return t === 'true';
  if (t === 'null') return null;
  return s;
}

export function csvToRecords(text, { delimiter, header = true, types = true, unflatten = false } = {}) {
  const d = delimiter || sniffDelimiter(text);
  const rows = parseCsvRows(text, d);
  if (!rows.length) return [];
  const width = Math.max(...rows.map((r) => r.length));
  const head = header ? rows[0].map((h, i) => h.trim() || `column${i + 1}`) : Array.from({ length: width }, (_, i) => `column${i + 1}`);
  for (let i = head.length; i < width; i++) head.push(`column${i + 1}`);
  const body = header ? rows.slice(1) : rows;
  return body.map((r) => {
    const o = {};
    head.forEach((h, i) => { const v = r[i] ?? ''; o[h] = types ? typedCell(v) : v; });
    return unflatten ? unflattenObject(o) : o;
  });
}

export function flattenObject(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length) flattenObject(v, key, out);
    else out[key] = v;
  }
  return out;
}

export function unflattenObject(flat) {
  const out = {};
  for (const [k, v] of Object.entries(flat)) {
    const parts = k.split('.');
    let o = out;
    parts.slice(0, -1).forEach((p) => { if (typeof o[p] !== 'object' || o[p] === null) o[p] = {}; o = o[p]; });
    o[parts[parts.length - 1]] = v;
  }
  return out;
}

/** Records (or any JSON value) to CSV. Scalars and arrays of scalars are handled too. */
export function recordsToCsv(value, { delimiter = ',', flatten = true } = {}) {
  let list = Array.isArray(value) ? value : (value && typeof value === 'object' ? (Object.values(value).find(Array.isArray) || [value]) : [{ value }]);
  list = list.map((r) => (r && typeof r === 'object' && !Array.isArray(r) ? (flatten ? flattenObject(r) : r) : { value: r }));
  const cols = [];
  for (const r of list) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
  return writeCsvRows([cols, ...list.map((r) => cols.map((c) => r[c]))], delimiter);
}

/* ---------------- XML ---------------- */

function getParser(DOMParserImpl) {
  const P = DOMParserImpl || globalThis.DOMParser;
  if (!P) throw new Error('XML needs a DOM parser, which this environment lacks');
  return new P();
}

/** Parse and throw the parser's own message for malformed XML. */
export function parseXml(text, DOMParserImpl) {
  let doc;
  // Browsers return a <parsererror> document; other parsers throw.
  try { doc = getParser(DOMParserImpl).parseFromString(text, 'application/xml'); } catch (e) { throw new Error(`Invalid XML: ${String(e.message || e).slice(0, 300)}`); }
  const err = doc.getElementsByTagName('parsererror')[0];
  if (err) throw new Error(`Invalid XML: ${(err.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 300)}`);
  return doc;
}

function elementToValue(el) {
  const o = {};
  for (const a of Array.from(el.attributes || [])) o[`@${a.name}`] = a.value;
  const kids = Array.from(el.childNodes || []);
  const elems = kids.filter((n) => n.nodeType === 1);
  const text = kids.filter((n) => n.nodeType === 3 || n.nodeType === 4).map((n) => n.nodeValue).join('').trim();
  for (const c of elems) {
    const v = elementToValue(c);
    if (c.nodeName in o) { if (!Array.isArray(o[c.nodeName])) o[c.nodeName] = [o[c.nodeName]]; o[c.nodeName].push(v); }
    else o[c.nodeName] = v;
  }
  if (!elems.length && !Object.keys(o).length) return typedCell(text);
  if (text) o['#text'] = text;
  return o;
}

export function xmlToValue(text, DOMParserImpl) {
  const doc = parseXml(text, DOMParserImpl);
  const root = doc.documentElement;
  return { [root.nodeName]: elementToValue(root) };
}

const xmlEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tagName = (k) => { const t = String(k).replace(/[^\w.-]/g, '_'); return /^[A-Za-z_]/.test(t) ? t : `_${t}`; };

export function valueToXml(value, { root = 'root', indent = 2 } = {}) {
  const pad = (n) => ' '.repeat(indent * n);
  const node = (name, v, depth) => {
    const t = tagName(name);
    if (Array.isArray(v)) return v.map((x) => node(name, x, depth)).join('\n');
    if (v === null || v === undefined) return `${pad(depth)}<${t}/>`;
    if (typeof v !== 'object') return `${pad(depth)}<${t}>${xmlEsc(v)}</${t}>`;
    const attrs = Object.entries(v).filter(([k]) => k.startsWith('@')).map(([k, x]) => ` ${tagName(k.slice(1))}="${xmlEsc(x)}"`).join('');
    const text = v['#text'] != null ? xmlEsc(v['#text']) : '';
    const kids = Object.entries(v).filter(([k]) => !k.startsWith('@') && k !== '#text');
    if (!kids.length) return `${pad(depth)}<${t}${attrs}>${text}</${t}>`.replace(`<${t}${attrs}></${t}>`, `<${t}${attrs}/>`);
    return `${pad(depth)}<${t}${attrs}>${text ? `\n${pad(depth + 1)}${text}` : ''}\n${kids.map(([k, x]) => node(k, x, depth + 1)).join('\n')}\n${pad(depth)}</${t}>`;
  };
  let name = root; let body = value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length === 1 && !keys[0].startsWith('@')) { name = keys[0]; body = value[name]; }
  }
  if (Array.isArray(body)) body = { item: body };
  return `<?xml version="1.0" encoding="UTF-8"?>\n${node(name, body, 0)}`;
}

/** Pretty-print or minify XML without changing its content. */
export function formatXml(text, { indent = 2, minify = false } = {}, DOMParserImpl) {
  parseXml(text, DOMParserImpl);                                    // validate first
  const tokens = text.replace(/>\s+</g, '><').trim().split(/(<[^>]+>)/).filter((t) => t.trim() !== '');
  if (minify) return tokens.join('');
  let depth = 0; const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const pad = ' '.repeat(indent * depth);
    if (/^<\//.test(t)) { depth = Math.max(0, depth - 1); out.push(' '.repeat(indent * depth) + t); }
    else if (/^<[^!?][^>]*[^/]>$/.test(t) || /^<[a-zA-Z][^>]*>$/.test(t) && !t.endsWith('/>')) {
      const next = tokens[i + 1]; const close = tokens[i + 2];
      if (next && !next.startsWith('<') && close && /^<\//.test(close)) { out.push(pad + t + next.trim() + close); i += 2; }
      else { out.push(pad + t); depth++; }
    } else out.push(pad + (t.startsWith('<') ? t : t.trim()));
  }
  return out.join('\n');
}

/* ---------------- one entry point ---------------- */

export const FORMATS = [['json', 'JSON'], ['csv', 'CSV'], ['tsv', 'TSV'], ['yaml', 'YAML'], ['xml', 'XML']];

/** Best guess at what a pasted blob is. */
export function detectFormat(text) {
  const t = text.trim();
  if (!t) return null;
  if (/^[[{]/.test(t)) { try { JSON.parse(t); return 'json'; } catch { /* fall through */ } }
  if (/^<(\?xml|[A-Za-z])/.test(t)) return 'xml';
  const lines = t.split(/\r?\n/);
  if (lines.length > 1 && lines.every((l) => !l || l.includes('\t')) && lines[0].includes('\t')) return 'tsv';
  if (/^(---\s*$|[\w"'-][^:\n,]*:\s|- )/m.test(t) && !lines[0].includes(',')) return 'yaml';
  if (lines.length > 1 && sniffDelimiter(t) !== undefined && lines[0].split(sniffDelimiter(t)).length > 1) return 'csv';
  return null;
}

export function readAs(format, text, opts = {}) {
  switch (format) {
    case 'json': return JSON.parse(text);
    case 'yaml': return YAML.parse(text);
    case 'csv': return csvToRecords(text, { ...opts, delimiter: opts.delimiter || undefined });
    case 'tsv': return csvToRecords(text, { ...opts, delimiter: '\t' });
    case 'xml': return xmlToValue(text, opts.DOMParser);
    default: throw new Error(`Unknown format "${format}"`);
  }
}

export function writeAs(format, value, opts = {}) {
  const indent = opts.indent ?? 2;
  switch (format) {
    case 'json': return JSON.stringify(value, null, indent || undefined);
    case 'yaml': return YAML.stringify(value, { indent: indent || 2 });
    case 'csv': return recordsToCsv(value, { delimiter: opts.delimiter || ',' });
    case 'tsv': return recordsToCsv(value, { delimiter: '\t' });
    case 'xml': return valueToXml(value, { root: opts.root || 'root', indent: indent || 2 });
    default: throw new Error(`Unknown format "${format}"`);
  }
}

export function convert(text, from, to, opts = {}) {
  const src = from === 'auto' ? detectFormat(text) : from;
  if (!src) throw new Error('Could not tell what format this is. Pick it under “From”.');
  return { text: writeAs(to, readAs(src, text, opts), opts), from: src };
}
