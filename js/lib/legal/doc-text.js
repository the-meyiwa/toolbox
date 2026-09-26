/* ============================================================
   Legal engine — document text extraction

   PDF (page by page, with "[Page n]" markers so every extract
   can cite its page), DOCX (word/document.xml, inflated with the
   browser's DecompressionStream) and plain text. Runs on-device;
   nothing is uploaded. pdf.js is loaded on first use.
   ============================================================ */

import { loadPdfJs } from '../pdf/pdfjs-loader.js';

/** pdf.js through the shared loader (worker, polyfills). */
export const loadPdfjs = () => loadPdfJs();

const isPdf = (f) => /pdf/i.test(f?.type || '') || /\.pdf$/i.test(f?.name || '');
const isDocx = (f) => /wordprocessingml/i.test(f?.type || '') || /\.docx$/i.test(f?.name || '');

/** Joins pdf.js text items into lines, keeping line breaks where the PDF has them. */
function itemsToText(items) {
  let out = '';
  let lastY = null;
  for (const it of items) {
    if (!('str' in it)) continue;
    const y = it.transform ? Math.round(it.transform[5]) : null;
    if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && !out.endsWith('\n')) out += '\n';
    out += it.str;
    if (it.hasEOL) out += '\n';
    else if (it.str && !/\s$/.test(it.str)) out += ' ';
    lastY = y;
  }
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Extracts text from a PDF. Returns { text, pages, pageTexts, scanned }.
 * onProgress(done, total) is called per page.
 */
export async function pdfText(data, { maxPages = 400, onProgress } = {}) {
  const pdfjs = await loadPdfjs();
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const total = Math.min(doc.numPages, maxPages);
  const pageTexts = [];
  for (let n = 1; n <= total; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    pageTexts.push(itemsToText(content.items));
    page.cleanup?.();
    onProgress?.(n, total);
  }
  const text = pageTexts.map((t, i) => `[Page ${i + 1}]\n${t}`).join('\n\n');
  const chars = pageTexts.join('').replace(/\s/g, '').length;
  const scanned = chars < 30 * total;
  const out = { text, pages: doc.numPages, pageTexts, scanned, truncated: doc.numPages > total };
  doc.destroy?.();
  return out;
}

/** Minimal ZIP reader: returns one entry's text, inflating with the browser. */
export async function unzipEntry(bytes, wanted) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return null;
  let p = dv.getUint32(eocd + 16, true);
  const count = dv.getUint16(eocd + 10, true);
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true), extra = dv.getUint16(p + 30, true), comment = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    if (name === wanted) {
      const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      const data = bytes.subarray(start, start + size);
      if (method === 0) return dec.decode(data);
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return await new Response(stream).text();
    }
    p += 46 + nameLen + extra + comment;
  }
  return null;
}

/** word/document.xml → text with paragraph breaks, tabs and table cells. */
export function docxXmlToText(xml) {
  return String(xml || '')
    .replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n').replace(/<\/w:tc>/g, ' | ').replace(/<\/w:tr>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, d) => String.fromCharCode(Number(d)))
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function docxText(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const xml = await unzipEntry(bytes, 'word/document.xml');
  if (xml == null) throw new Error('This does not look like a Word (.docx) document.');
  return { text: docxXmlToText(xml), pages: null };
}

/**
 * Reads any supported file. Returns { text, kind, pages, scanned, name }.
 * Old .doc (binary Word) files are refused with a clear message.
 */
export async function readDocument(file, opts = {}) {
  const name = file?.name || 'document';
  if (isPdf(file)) {
    const r = await pdfText(await file.arrayBuffer(), opts);
    return { ...r, kind: 'pdf', name };
  }
  if (isDocx(file)) {
    const r = await docxText(await file.arrayBuffer());
    return { ...r, kind: 'docx', name };
  }
  if (/\.doc$/i.test(name) || /msword/i.test(file?.type || '')) throw new Error('Old Word (.doc) files cannot be read here. Save it as .docx or PDF and try again.');
  const text = await file.text();
  return { text: text.replace(/\r\n?/g, '\n'), kind: 'text', pages: null, name };
}

export const ACCEPT_DOCS = '.pdf,.docx,.txt,.md,.rtf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';
