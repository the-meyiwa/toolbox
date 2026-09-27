/* ============================================================
   Developer operations: JSON diff and key sorting, JSONPath, SQL
   formatting, gzip/deflate, and bcrypt. Heavy libraries are loaded
   on first use so opening the tool stays instant.
   ============================================================ */

/* ---------------- JSON ---------------- */

export function sortKeys(value, { deep = true, desc = false } = {}) {
  if (Array.isArray(value)) return deep ? value.map((v) => sortKeys(v, { deep, desc })) : value;
  if (!value || typeof value !== 'object') return value;
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (desc) keys.reverse();
  return Object.fromEntries(keys.map((k) => [k, deep ? sortKeys(value[k], { deep, desc }) : value[k]]));
}

const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
const pathJoin = (p, k) => (typeof k === 'number' ? `${p}[${k}]` : /^[A-Za-z_$][\w$]*$/.test(k) ? `${p}.${k}` : `${p}[${JSON.stringify(k)}]`);

/**
 * Structural differences between two JSON values.
 * @returns {{path: string, type: 'added'|'removed'|'changed', before?: any, after?: any}[]}
 */
export function jsonDiff(a, b, { path = '$', ignoreOrder = false } = {}) {
  const out = [];
  const walk = (x, y, p) => {
    const tx = typeOf(x); const ty = typeOf(y);
    if (tx !== ty) { out.push({ path: p, type: 'changed', before: x, after: y }); return; }
    if (tx === 'array') {
      if (ignoreOrder) {
        const key = (v) => JSON.stringify(sortKeys(v));
        const bx = x.map(key); const by = y.map(key);
        const left = [...by];
        bx.forEach((k, i) => { const j = left.indexOf(k); if (j >= 0) left.splice(j, 1); else out.push({ path: `${p}[${i}]`, type: 'removed', before: x[i] }); });
        const right = [...bx];
        by.forEach((k, i) => { const j = right.indexOf(k); if (j >= 0) right.splice(j, 1); else out.push({ path: `${p}[${i}]`, type: 'added', after: y[i] }); });
        return;
      }
      const n = Math.max(x.length, y.length);
      for (let i = 0; i < n; i++) {
        if (i >= x.length) out.push({ path: pathJoin(p, i), type: 'added', after: y[i] });
        else if (i >= y.length) out.push({ path: pathJoin(p, i), type: 'removed', before: x[i] });
        else walk(x[i], y[i], pathJoin(p, i));
      }
      return;
    }
    if (tx === 'object') {
      for (const k of Object.keys(x)) {
        if (!(k in y)) out.push({ path: pathJoin(p, k), type: 'removed', before: x[k] });
        else walk(x[k], y[k], pathJoin(p, k));
      }
      for (const k of Object.keys(y)) if (!(k in x)) out.push({ path: pathJoin(p, k), type: 'added', after: y[k] });
      return;
    }
    if (!Object.is(x, y)) out.push({ path: p, type: 'changed', before: x, after: y });
  };
  walk(a, b, path);
  return out;
}

/** Split "left ===== right" (or two JSON documents one after the other). */
export function splitPair(text) {
  const sep = text.split(/^\s*(?:={3,}|-{3,}|#{3,})\s*$/m);
  if (sep.length === 2) return sep;
  const t = text.trim();
  // Two top-level documents back to back: find where the first one ends.
  let depth = 0; let inStr = false; let esc = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') { depth--; if (depth === 0) return [t.slice(0, i + 1), t.slice(i + 1)]; }
  }
  throw new Error('Put the second JSON document after a line of ===== (or straight after the first)');
}

export async function jsonPathQuery(json, path) {
  const { JSONPath } = await import('jsonpath-plus');
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  const values = JSONPath({ path, json: data, wrap: true });
  const paths = JSONPath({ path, json: data, resultType: 'path', wrap: true });
  return values.map((value, i) => ({ path: paths[i], value }));
}

export function escapeJsonString(s) { return JSON.stringify(s); }
export function unescapeJsonString(s) {
  const t = s.trim();
  return JSON.parse(t.startsWith('"') ? t : `"${t}"`);
}

/* ---------------- SQL ---------------- */

export const SQL_DIALECTS = [
  ['sql', 'Standard SQL'], ['postgresql', 'PostgreSQL'], ['mysql', 'MySQL'], ['mariadb', 'MariaDB'], ['sqlite', 'SQLite'],
  ['transactsql', 'SQL Server (T-SQL)'], ['plsql', 'Oracle PL/SQL'], ['bigquery', 'BigQuery'], ['snowflake', 'Snowflake'],
  ['redshift', 'Redshift'], ['spark', 'Spark'], ['db2', 'Db2'], ['trino', 'Trino / Presto'],
];

export async function formatSql(sql, { dialect = 'sql', keywordCase = 'upper', indent = 2, linesBetween = 1, minify = false } = {}) {
  if (minify) return minifySql(sql);
  const { format } = await import('sql-formatter');
  return format(sql, { language: dialect, keywordCase, tabWidth: Number(indent) || 2, linesBetweenQueries: Number(linesBetween) });
}

/** Collapse whitespace outside strings and drop comments. */
export function minifySql(sql) {
  let out = ''; let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < sql.length && !(sql[j] === c && sql[j + 1] !== c)) j += sql[j] === c ? 2 : 1;
      out += sql.slice(i, j + 1); i = j + 1; continue;
    }
    if (c === '-' && sql[i + 1] === '-') { while (i < sql.length && sql[i] !== '\n') i++; continue; }
    if (c === '/' && sql[i + 1] === '*') { const e = sql.indexOf('*/', i + 2); i = e < 0 ? sql.length : e + 2; continue; }
    if (/\s/.test(c)) { if (out && !/[\s(,]$/.test(out)) out += ' '; i++; continue; }
    if ((c === ')' || c === ',') && out.endsWith(' ')) out = out.slice(0, -1);
    out += c; i++;
  }
  return out.trim();
}

/* ---------------- gzip / deflate ---------------- */

async function pipe(bytes, stream) {
  const s = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(s).arrayBuffer());
}
export const compressBytes = (bytes, format = 'gzip') => pipe(bytes, new CompressionStream(format));
export const decompressBytes = (bytes, format = 'gzip') => pipe(bytes, new DecompressionStream(format));

export function bytesToBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function base64ToBytes(b64) {
  let t = b64.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  return Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
}
export const bytesToHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
export function hexToBytes(h) {
  const t = h.replace(/[\s:]|0x/gi, '');
  if (t.length % 2 || /[^0-9a-f]/i.test(t)) throw new Error('That is not valid hex');
  return Uint8Array.from(t.match(/../g) || [], (x) => parseInt(x, 16));
}

/** Which container a compressed blob is, from its first bytes. */
export function sniffCompression(bytes) {
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return 'gzip';
  if ((bytes[0] & 0x0f) === 8 && ((bytes[0] << 8) | bytes[1]) % 31 === 0) return 'deflate';
  return 'deflate-raw';
}

/* ---------------- bcrypt ---------------- */

export async function bcryptHash(password, rounds = 10) {
  const b = (await import('bcryptjs')).default;
  return b.hash(password, Math.min(15, Math.max(4, Number(rounds) || 10)));
}
export async function bcryptVerify(password, hash) {
  const b = (await import('bcryptjs')).default;
  return b.compare(password, hash.trim());
}
export function bcryptInfo(hash) {
  const m = hash.trim().match(/^\$(2[abxy]?)\$(\d{2})\$([./A-Za-z0-9]{22})([./A-Za-z0-9]{31})$/);
  return m ? { version: m[1], cost: Number(m[2]), salt: m[3], digest: m[4] } : null;
}

/* ---------------- JSON → TypeScript ---------------- */

const pascal = (s) => (String(s).replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : '')).replace(/^./, (c) => c.toUpperCase()) || 'Item').replace(/^\d/, '_$&');

/** Interfaces inferred from a sample. Arrays of objects are merged, so optional keys show as `?`. */
export function jsonToTypeScript(value, { root = 'Root', useType = false } = {}) {
  const decls = new Map();
  const typeFor = (v, name) => {
    if (v === null) return 'null';
    if (Array.isArray(v)) {
      if (!v.length) return 'unknown[]';
      const objs = v.filter((x) => x && typeof x === 'object' && !Array.isArray(x));
      const others = [...new Set(v.filter((x) => !(x && typeof x === 'object' && !Array.isArray(x))).map((x) => typeFor(x, name)))];
      const parts = [...others];
      if (objs.length) parts.push(objectType(objs, singular(name)));
      const u = parts.join(' | ');
      return parts.length > 1 ? `(${u})[]` : `${u}[]`;
    }
    if (typeof v === 'object') return objectType([v], name);
    return typeof v;
  };
  const objectType = (objs, name) => {
    const n = pascal(name);
    const keys = [...new Set(objs.flatMap(Object.keys))];
    const lines = keys.map((k) => {
      const present = objs.filter((o) => k in o);
      const types = [...new Set(present.map((o) => typeFor(o[k], k)))];
      const key = /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
      return `  ${key}${present.length < objs.length ? '?' : ''}: ${types.join(' | ')};`;
    });
    let unique = n; let i = 2;
    while (decls.has(unique) && decls.get(unique) !== lines.join('\n')) unique = `${n}${i++}`;
    decls.set(unique, lines.join('\n'));
    return unique;
  };
  const singular = (s) => String(s).replace(/ies$/, 'y').replace(/s$/, '') || 'Item';
  const top = typeFor(value, root);
  const out = [...decls].reverse().map(([n, body]) => (useType ? `export type ${n} = {\n${body}\n};` : `export interface ${n} {\n${body}\n}`));
  if (!decls.has(pascal(root))) out.push(`export type ${pascal(root)} = ${top};`);
  return out.join('\n\n');
}
