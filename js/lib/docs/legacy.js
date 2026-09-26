/* ============================================================
   Legacy binary formats: .doc (Word 97–2003) and .ppt.

   These are OLE compound files. We read the text out of them — the
   piece table for .doc, the text atoms for .ppt — which is enough to
   preview the file and to carry its words into a modern format.
   Layout and formatting of the old binary formats are not recovered.
   ============================================================ */

import { toBytes } from './xml.js';

async function openCfb(data) {
  const XLSX = await import('@e965/xlsx');
  const CFB = XLSX.CFB ?? XLSX.default?.CFB;
  return { CFB, cfb: CFB.read(await toBytes(data), { type: 'array' }) };
}

function stream(CFB, cfb, name) {
  const entry = CFB.find(cfb, name) || CFB.find(cfb, `/${name}`);
  if (!entry?.content) return null;
  const c = entry.content;
  return c instanceof Uint8Array ? c : Uint8Array.from(c);
}

const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

const CP1252 = { 0x80: 0x20AC, 0x82: 0x201A, 0x83: 0x0192, 0x84: 0x201E, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02C6, 0x89: 0x2030, 0x8A: 0x0160, 0x8B: 0x2039, 0x8C: 0x0152, 0x8E: 0x017D, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201C, 0x94: 0x201D, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02DC, 0x99: 0x2122, 0x9A: 0x0161, 0x9B: 0x203A, 0x9C: 0x0153, 0x9E: 0x017E, 0x9F: 0x0178 };
const latin = (b, start, end) => {
  let s = '';
  for (let i = start; i < end && i < b.length; i++) s += String.fromCharCode(CP1252[b[i]] ?? b[i]);
  return s;
};
const utf16 = (b, start, end) => {
  let s = '';
  for (let i = start; i + 1 < end && i + 1 < b.length; i += 2) s += String.fromCharCode(u16(b, i));
  return s;
};

/** Clean Word's control characters out of the raw character stream. */
export function cleanWordText(raw) {
  let out = '';
  let fieldDepth = 0;
  const skipping = []; // per field: true while in the instruction part
  for (const ch of raw) {
    const c = ch.charCodeAt(0);
    if (c === 0x13) { fieldDepth++; skipping.push(true); continue; }
    if (c === 0x14) { if (skipping.length) skipping[skipping.length - 1] = false; continue; }
    if (c === 0x15) { if (fieldDepth) { fieldDepth--; skipping.pop(); } continue; }
    if (skipping.some(Boolean)) continue;
    if (c === 0x0D || c === 0x0B) out += '\n';
    else if (c === 0x07) out += '\t'; // cell / row mark
    else if (c === 0x0C) out += '\n\f\n';
    else if (c === 0x09) out += '\t';
    else if (c === 0x1E) out += '-';
    else if (c === 0x1F || c === 0x01 || c === 0x08 || c === 0x05 || c === 0x02 || c < 0x09) continue;
    else out += ch;
  }
  return out.replace(/\t\n/g, '\n');
}

/** Text of a Word 97–2003 document. */
export async function docToText(data) {
  const { CFB, cfb } = await openCfb(data);
  const word = stream(CFB, cfb, 'WordDocument');
  if (!word || u16(word, 0) !== 0xA5EC) throw new Error('This is not a Word 97–2003 document');
  const flags = u16(word, 0x0A);
  const table = stream(CFB, cfb, flags & 0x0200 ? '1Table' : '0Table');
  const fcClx = u32(word, 0x01A2);
  const lcbClx = u32(word, 0x01A6);
  let raw = '';
  if (table && lcbClx) {
    let p = fcClx;
    const end = fcClx + lcbClx;
    while (p < end && table[p] === 0x01) p += 3 + u16(table, p + 1); // skip Prc blocks
    if (table[p] === 0x02) {
      const lcb = u32(table, p + 1);
      const base = p + 5;
      const n = Math.floor((lcb - 4) / 12);
      for (let i = 0; i < n; i++) {
        const cpStart = u32(table, base + i * 4);
        const cpEnd = u32(table, base + (i + 1) * 4);
        const pcd = base + (n + 1) * 4 + i * 8;
        const fcRaw = u32(table, pcd + 2);
        const compressed = (fcRaw & 0x40000000) !== 0;
        const count = cpEnd - cpStart;
        if (compressed) {
          const fc = (fcRaw & 0x3FFFFFFF) / 2;
          raw += latin(word, fc, fc + count);
        } else raw += utf16(word, fcRaw, fcRaw + count * 2);
      }
    }
  }
  if (!raw) {
    // Very old or unusual file: fall back to the main text range from the FIB.
    const ccpText = u32(word, 0x004C);
    const fcMin = u32(word, 0x0018);
    raw = latin(word, fcMin, fcMin + ccpText);
  }
  // Only the main document story; footnotes and headers follow it.
  const ccpText = u32(word, 0x004C);
  if (ccpText && ccpText < raw.length) raw = raw.slice(0, ccpText);
  return cleanWordText(raw).replace(/\n{3,}/g, '\n\n').trim();
}

/* ---------------- .ppt ---------------- */

const SLIDE_LIST = 0x0FF0, SLIDE_PERSIST = 0x03F3, TEXT_HEADER = 0x0F9F, TEXT_CHARS = 0x0FA0, TEXT_BYTES = 0x0FA8, SLIDE = 0x03EE, DOCUMENT_ATOM = 0x03E9;

/** Slides of a PowerPoint 97–2003 file as {title, body[]} text. */
export async function pptToOutline(data) {
  const { CFB, cfb } = await openCfb(data);
  const doc = stream(CFB, cfb, 'PowerPoint Document');
  if (!doc) throw new Error('This is not a PowerPoint 97–2003 file');

  const listed = []; // from SlideListWithText
  const drawn = []; // from Slide containers
  let size = null;

  const walk = (start, end, ctx) => {
    let p = start;
    while (p + 8 <= end) {
      const verInst = u16(doc, p);
      const type = u16(doc, p + 2);
      const len = u32(doc, p + 4);
      const body = p + 8;
      const next = body + len;
      if (next > end || len > doc.length) break;
      const isContainer = (verInst & 0x0F) === 0x0F;
      if (type === DOCUMENT_ATOM && len >= 8) size = { w: u32(doc, body), h: u32(doc, body + 4) };
      if (isContainer) {
        if (type === SLIDE_LIST) walk(body, next, { list: (verInst >> 4) === 0, header: null });
        else if (type === SLIDE && !ctx.list) { drawn.push([]); walk(body, next, { drawn: drawn[drawn.length - 1] }); }
        else walk(body, next, ctx);
      } else if (ctx.list) {
        if (type === SLIDE_PERSIST) listed.push({ title: '', body: [] });
        else if (type === TEXT_HEADER) ctx.header = u32(doc, body);
        else if ((type === TEXT_CHARS || type === TEXT_BYTES) && listed.length) {
          const text = (type === TEXT_CHARS ? utf16(doc, body, next) : latin(doc, body, next)).replace(/\r/g, '\n').replace(/\u000B/g, '\n');
          const slide = listed[listed.length - 1];
          if ((ctx.header === 0 || ctx.header === 6) && !slide.title) slide.title = text.trim();
          else slide.body.push(...text.split('\n').filter(l => l.trim()));
        }
      } else if (ctx.drawn && (type === TEXT_CHARS || type === TEXT_BYTES)) {
        const text = (type === TEXT_CHARS ? utf16(doc, body, next) : latin(doc, body, next)).replace(/\r/g, '\n').replace(/\u000B/g, '\n');
        ctx.drawn.push(...text.split('\n').filter(l => l.trim()));
      }
      p = next;
    }
  };
  walk(0, doc.length, {});

  const slides = listed.length ? listed : drawn.map(lines => ({ title: lines[0] || '', body: lines.slice(1) }));
  if (listed.length && drawn.length === listed.length) {
    listed.forEach((s, i) => {
      const seen = new Set([s.title, ...s.body]);
      for (const line of drawn[i]) if (!seen.has(line)) s.body.push(line);
    });
  }
  // DocumentAtom sizes are in master units (576 per inch).
  const toPt = (v) => (v ? v / 8 : 0);
  return { width: toPt(size?.w) || 720, height: toPt(size?.h) || 540, slides };
}

/** A .ppt as an editable deck: a title and a bulleted body per slide. */
export async function pptToDeck(data) {
  const outline = await pptToOutline(data);
  const { width: W, height: H } = outline;
  const slides = outline.slides.map(s => ({
    notes: '',
    elements: [
      { type: 'box', x: W * 0.07, y: H * 0.06, w: W * 0.86, h: H * 0.18, valign: 'middle', paragraphs: [{ runs: s.title ? [{ text: s.title, size: 36, bold: true }] : [] }] },
      ...(s.body.length ? [{ type: 'box', x: W * 0.07, y: H * 0.28, w: W * 0.86, h: H * 0.64, paragraphs: s.body.map(line => ({ bullet: true, level: 0, runs: [{ text: line, size: 22 }] })) }] : []),
    ],
  }));
  return { width: W, height: H, slides: slides.length ? slides : [{ elements: [], notes: '' }] };
}
