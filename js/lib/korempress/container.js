/* ============================================================
   Korempress PDF container, ported from container/*.py.

   A PDF's streams are already Flate-compressed, so a general codec has
   nothing left to find in them. The container inflates every stream,
   compresses the original bytes with `kl`, and records the exact zlib
   parameters ("recipe") that reproduce the original Flate bytes. Decoding
   re-deflates with that recipe, so the rebuilt file is byte-identical to
   the input and its SHA-256 is checked before it is handed back.

   A stream whose recipe cannot be found is left exactly as it was, never
   re-encoded on a guess. pako 2.1 reproduces zlib's output bit for bit
   (pako 3 does not), which is what makes the recipe search work here.

   Wire format is the Python tool's OWN1 with every block tagged kl (1),
   so files move between the two. A file whose blocks use `cm` (tag 2) is
   refused with a clear message: that coder is not in the browser build.
   ============================================================ */

import { Inflate, deflate } from 'pako';
import { klEncode, klDecode } from './kl.js';

const MAGIC = [0x4f, 0x57, 0x4e, 0x31];          // "OWN1"
const FILE_MAGIC = [0x4b, 0x4c, 0x46, 0x31];     // "KLF1": any file, kl only
const HEADER = 59;                                // magic 4 + sha 32 + <QIIIBBB> 23
const RECIPES = [[9, 0, 8, 15], [6, 0, 8, 15], [9, 0, 9, 15], [6, 0, 9, 15], [1, 0, 8, 15], [9, 1, 8, 15], [9, 2, 8, 15]];
const enc = new TextEncoder();
const dec = new TextDecoder();

export async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}
const sameBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const hasMagic = (b, m) => b.length >= 4 && m.every((v, i) => b[i] === v);

export const isContainer = (b) => hasMagic(b, MAGIC);
export const isKlFile = (b) => hasMagic(b, FILE_MAGIC);

/* ---------------- recipes ---------------- */

export function redeflate(data, [level, strategy, memLevel, windowBits]) {
  return deflate(data, { level, strategy, memLevel, windowBits });
}

export function findRecipe(raw, inflated) {
  for (const r of RECIPES) {
    const out = redeflate(inflated, r);
    if (out.length === raw.length && sameBytes(out, raw)) return r;
  }
  return null;
}

/* ---------------- stream discovery ---------------- */

const STREAM = enc.encode('stream');

function indexOf(buf, needle, from) {
  const first = needle[0];
  outer: for (let i = buf.indexOf(first, from); i !== -1 && i <= buf.length - needle.length; i = buf.indexOf(first, i + 1)) {
    for (let k = 1; k < needle.length; k++) if (buf[i + k] !== needle[k]) continue outer;
    return i;
  }
  return -1;
}

/* The image dimensions the Python tool took from pikepdf, read here from
   the stream's own dictionary. Only the plain case qualifies: a single
   FlateDecode filter, no DecodeParms, 8-bit Gray or RGB, direct numbers. */
function imageDims(buf, streamAt) {
  const from = Math.max(0, streamAt - 4096);
  const head = dec.decode(buf.subarray(from, streamAt));
  const objAt = head.lastIndexOf(' obj');
  const dict = objAt >= 0 ? head.slice(objAt) : head;
  if (!/\/Subtype\s*\/Image\b/.test(dict) || /\/DecodeParms/.test(dict)) return null;
  if (!/\/Filter\s*(\[\s*)?\/FlateDecode\s*\]?\s*[/>]/.test(dict)) return null;
  const num = (k) => { const m = dict.match(new RegExp(`/${k}\\s+(\\d+)(?!\\s+\\d+\\s+R)\\b`)); return m ? Number(m[1]) : null; };
  const w = num('Width'); const h = num('Height'); const bpc = num('BitsPerComponent');
  if (!w || !h || (bpc != null && bpc !== 8)) return null;
  const cs = dict.match(/\/ColorSpace\s*\/(\w+)/)?.[1];
  const nc = cs === 'DeviceRGB' ? 3 : (cs === 'DeviceGray' || cs === 'CalGray') ? 1 : 0;
  return nc ? [w, h, nc] : null;
}

/** Every inflatable Flate stream: [start, length, inflated, dims|null]. */
export function findStreams(buf) {
  const found = [];
  let pos = 0;
  for (;;) {
    const i = indexOf(buf, STREAM, pos);
    if (i < 0) break;
    let j = i + 6;
    if (buf[j] === 13 && buf[j + 1] === 10) j += 2;
    else if (buf[j] === 10 || buf[j] === 13) j += 1;
    else { pos = i + 6; continue; }
    /* A zlib header (deflate, no preset dictionary). The body is inflated
       raw: pako's zlib mode reads the bytes after the stream as a second
       member and fails. The recipe check compares the whole zlib stream,
       header and Adler-32 included, so nothing here is taken on trust. */
    if ((buf[j] & 0x0f) !== 8 || (buf[j + 1] & 0x20) || ((buf[j] << 8) | buf[j + 1]) % 31) { pos = i + 6; continue; }
    const inf = new Inflate({ raw: true });
    inf.push(buf.subarray(j + 2), true);
    if (!inf.ended || inf.err || !(inf.result instanceof Uint8Array)) { pos = i + 6; continue; }
    const consumed = 2 + inf.strm.next_in + 4;
    if (j + consumed > buf.length) { pos = i + 6; continue; }
    found.push([j, consumed, inf.result, imageDims(buf, i)]);
    pos = j + consumed;
  }
  return found;
}

/* ---------------- image transforms (exact inverses) ---------------- */

export function filterRows(data, w, h, nc) {
  const stride = w * nc;
  const out = new Uint8Array(h * (stride + 1));
  const row = new Int16Array(stride); const prev = new Int16Array(stride);
  const cand = Array.from({ length: 5 }, () => new Uint8Array(stride));
  for (let y = 0; y < h; y++) {
    for (let i = 0; i < stride; i++) row[i] = data[y * stride + i] ?? 0;
    for (let i = 0; i < stride; i++) {
      const a = i >= nc ? row[i - nc] : 0; const b = prev[i]; const c = i >= nc ? prev[i - nc] : 0;
      const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
      const paeth = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      cand[0][i] = row[i]; cand[1][i] = (row[i] - a) & 255; cand[2][i] = (row[i] - b) & 255;
      cand[3][i] = (row[i] - ((a + b) >> 1)) & 255; cand[4][i] = (row[i] - paeth) & 255;
    }
    let best = Infinity; let bi = 0;
    for (let k = 0; k < 5; k++) {
      let s = 0; const m = cand[k];
      for (let i = 0; i < stride; i++) s += Math.min(m[i], 256 - m[i]);
      if (s < best) { best = s; bi = k; }
    }
    const base = y * (stride + 1);
    out[base] = bi; out.set(cand[bi], base + 1);
    prev.set(row);
  }
  return out;
}

export function unfilterRows(f, w, h, nc) {
  const stride = w * nc;
  const out = new Uint8Array(h * stride);
  for (let y = 0; y < h; y++) {
    const base = y * (stride + 1); const ft = f[base]; const o = y * stride;
    for (let i = 0; i < stride; i++) {
      const r = f[base + 1 + i] ?? 0;
      const a = i >= nc ? out[o + i - nc] : 0;
      const b = y ? out[o - stride + i] : 0;
      const c = (y && i >= nc) ? out[o - stride + i - nc] : 0;
      let pred = 0;
      if (ft === 1) pred = a; else if (ft === 2) pred = b; else if (ft === 3) pred = (a + b) >> 1;
      else if (ft === 4) { const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c); pred = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      out[o + i] = (r + pred) & 255;
    }
  }
  return out;
}

export function subGreen(data, w, h, sign = -1) {
  const n = w * h * 3; const out = new Uint8Array(n);
  for (let i = 0; i < n; i += 3) {
    const g = data[i + 1] ?? 0;
    out[i] = ((data[i] ?? 0) + sign * g) & 255; out[i + 1] = g; out[i + 2] = ((data[i + 2] ?? 0) + sign * g) & 255;
  }
  return out;
}

/* ---------------- byte helpers ---------------- */

function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const u32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; };

async function encBlock(data, level) { return data.length ? klEncode(data, level) : new Uint8Array(0); }
async function decBlock(tag, blob) {
  if (!blob.length) return new Uint8Array(0);
  if (tag !== 1) throw new Error('This archive uses the context-mixing coder (cm), which only the command-line Korempress tool can open');
  return klDecode(blob);
}

/* ---------------- the container ---------------- */

/**
 * Compress a PDF losslessly.
 * @returns {Promise<{bytes: Uint8Array, streams: number, recovered: number, images: number}>}
 */
export async function packPdf(buf, { level = 6, onProgress = () => {} } = {}) {
  const digest = await sha256(buf);
  onProgress(0.02, 'Finding streams');
  const streams = findStreams(buf);
  const entries = []; const skeleton = []; const solid = []; const images = [];
  let cursor = 0;
  for (let k = 0; k < streams.length; k++) {
    const [start, length, inflated, dims] = streams[k];
    if (k % 8 === 0) onProgress(0.05 + 0.25 * (k / streams.length), 'Matching recipes');
    const recipe = findRecipe(buf.subarray(start, start + length), inflated);
    if (!recipe) continue;
    skeleton.push(buf.subarray(cursor, start));
    cursor = start + length;
    const gap = skeleton.reduce((n, p) => n + p.length, 0);
    const e = { gap, recipe, declen: inflated.length, dims: dims || null, solid: dims ? 0 : 1 };
    entries.push(e);
    if (dims) images.push([entries.length - 1, inflated, dims]); else solid.push(inflated);
  }
  skeleton.push(buf.subarray(cursor));

  const payloads = new Map();
  for (let k = 0; k < images.length; k++) {
    const [idx, data, [w, h, nc]] = images[k];
    onProgress(0.3 + 0.3 * (k / Math.max(1, images.length)), 'Compressing images');
    const cands = [[data, 0]];
    if (w * h * nc <= data.length) {
      cands.push([filterRows(data, w, h, nc), 1]);
      if (nc === 3) cands.push([filterRows(subGreen(data, w, h), w, h, 3), 2]);
    }
    let best = null;
    for (const [payload, mode] of cands) {
      const blob = await encBlock(payload, level);
      if (!best || blob.length < best[1].length) best = [mode, blob];
    }
    entries[idx].filtered = best[0]; entries[idx].tag = 1;
    payloads.set(idx, best[1]);
  }

  onProgress(0.62, 'Compressing text and fonts');
  const solidBlob = await encBlock(concat(solid), level);
  onProgress(0.85, 'Compressing structure');
  const skelBlob = await encBlock(concat(skeleton), level);
  const manBlob = await encBlock(enc.encode(JSON.stringify(entries)), level);

  const head = new Uint8Array(23); const dv = new DataView(head.buffer);
  dv.setBigUint64(0, BigInt(buf.length), true);
  dv.setUint32(8, manBlob.length, true); dv.setUint32(12, skelBlob.length, true); dv.setUint32(16, solidBlob.length, true);
  head[20] = 1; head[21] = 1; head[22] = 1;
  const parts = [new Uint8Array(MAGIC), digest, head, manBlob, skelBlob, solidBlob];
  entries.forEach((e, i) => { if (!e.solid) { const b = payloads.get(i); parts.push(u32(b.length), b); } });
  onProgress(1, 'Done');
  return { bytes: concat(parts), streams: streams.length, recovered: entries.length, images: images.length };
}

/** Rebuild the original PDF. Throws unless the SHA-256 matches. */
export async function unpackPdf(raw, { onProgress = () => {} } = {}) {
  if (!isContainer(raw)) throw new Error('Not a Korempress PDF archive');
  const digest = raw.subarray(4, 36);
  const dv = new DataView(raw.buffer, raw.byteOffset + 36, 23);
  const total = Number(dv.getBigUint64(0, true));
  const mlen = dv.getUint32(8, true); const slen = dv.getUint32(12, true); const sdlen = dv.getUint32(16, true);
  const [mt, st, sot] = [raw[36 + 20], raw[36 + 21], raw[36 + 22]];
  let off = HEADER;
  const take = (n) => { const b = raw.subarray(off, off + n); off += n; return b; };
  onProgress(0.1, 'Reading manifest');
  const entries = JSON.parse(dec.decode(await decBlock(mt, take(mlen))));
  const skeleton = await decBlock(st, take(slen));
  onProgress(0.3, 'Restoring streams');
  const solid = sdlen ? await decBlock(sot, take(sdlen)) : new Uint8Array(0);
  const out = []; let scur = 0; let spos = 0;
  for (let k = 0; k < entries.length; k++) {
    const e = entries[k];
    if (k % 16 === 0) onProgress(0.3 + 0.65 * (k / entries.length), 'Re-deflating streams');
    let data;
    if (e.solid) { data = solid.subarray(spos, spos + e.declen); spos += e.declen; }
    else {
      const n = new DataView(raw.buffer, raw.byteOffset + off, 4).getUint32(0, true); off += 4;
      const payload = await decBlock(e.tag, take(n));
      const [w, h, nc] = e.dims || [];
      if (e.filtered === 1) data = unfilterRows(payload, w, h, nc).subarray(0, e.declen);
      else if (e.filtered === 2) data = subGreen(unfilterRows(payload, w, h, 3), w, h, 1).subarray(0, e.declen);
      else data = payload;
    }
    if (data.length < e.declen) { const pad = new Uint8Array(e.declen); pad.set(data); data = pad; }
    out.push(skeleton.subarray(scur, e.gap));
    scur = e.gap;
    out.push(redeflate(data, e.recipe));
  }
  out.push(skeleton.subarray(scur));
  const bytes = concat(out);
  if (bytes.length !== total || !sameBytes(await sha256(bytes), digest)) {
    throw new Error('The rebuilt file does not match the original fingerprint, so it was not saved');
  }
  onProgress(1, 'Verified');
  return bytes;
}

/* ---------------- any file ---------------- */

/** kl alone, for files that are not PDFs. Keeps the name and a fingerprint. */
export async function packFile(buf, name = 'file', { level = 6 } = {}) {
  const nameBytes = enc.encode(name.slice(0, 255));
  const blob = await klEncode(buf, level);
  return concat([new Uint8Array(FILE_MAGIC), u32(nameBytes.length), nameBytes, await sha256(buf), blob]);
}

export async function unpackFile(raw) {
  if (!isKlFile(raw)) throw new Error('Not a Korempress file archive');
  const nlen = new DataView(raw.buffer, raw.byteOffset + 4, 4).getUint32(0, true);
  const name = dec.decode(raw.subarray(8, 8 + nlen));
  const digest = raw.subarray(8 + nlen, 40 + nlen);
  const bytes = await klDecode(raw.subarray(40 + nlen));
  if (!sameBytes(await sha256(bytes), digest)) throw new Error('The restored file does not match its fingerprint');
  return { name, bytes };
}
