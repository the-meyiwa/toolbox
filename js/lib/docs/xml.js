/* ============================================================
   Small XML helpers shared by the document readers.

   Everything goes by local name so the same code reads OOXML and
   OpenDocument without caring which prefix a producer chose. Only the
   plain DOM Level 2 API is used, so the readers run on the browser's
   DOMParser and on @xmldom/xmldom in tests alike.
   ============================================================ */

export function parseXml(text) {
  if (typeof DOMParser === 'undefined') throw new Error('No XML parser available');
  return new DOMParser().parseFromString(text, 'application/xml');
}

const nameOf = (node) => node.localName || String(node.nodeName || '').replace(/^.*:/, '');

/** Element children, optionally filtered by local name. */
export function kids(el, name) {
  const out = [];
  if (!el) return out;
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (!name || nameOf(n) === name)) out.push(n);
  }
  return out;
}

export function kid(el, name) {
  if (!el) return null;
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && nameOf(n) === name) return n;
  }
  return null;
}

/** Follow a path of local names: path(el, 'spPr', 'xfrm', 'off'). */
export function path(el, ...names) {
  let cur = el;
  for (const n of names) { cur = kid(cur, n); if (!cur) return null; }
  return cur;
}

/** All descendants with a local name, in document order. */
export function all(el, name) {
  const out = [];
  if (!el) return out;
  const walk = (node) => {
    for (let n = node.firstChild; n; n = n.nextSibling) {
      if (n.nodeType !== 1) continue;
      if (nameOf(n) === name) out.push(n);
      walk(n);
    }
  };
  walk(el);
  return out;
}

/** Attribute by local name, whatever its prefix. */
export function attr(el, name) {
  if (!el?.attributes) return null;
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i];
    if ((a.localName || String(a.name).replace(/^.*:/, '')) === name) return a.value;
  }
  return null;
}

/** The r:id of an element that also has a plain id (p:sldId). */
export function relId(el) {
  if (!el?.attributes) return null;
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i];
    if (String(a.name).includes(':') && String(a.name).endsWith(':id')) return a.value;
  }
  return null;
}

export { nameOf as localName };

export function textOf(el) {
  return el ? String(el.textContent ?? '') : '';
}

export function escXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // XML 1.0 forbids most control characters outright.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

export const escHtml = escXml;

/** Bytes to a data: URL without FileReader, so it works in workers and tests. */
export function bytesToDataUrl(bytes, mime) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return `data:${mime};base64,${btoa(bin)}`;
}

export function dataUrlToBytes(url) {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(String(url || ''));
  if (!m) return null;
  const mime = m[1] || 'application/octet-stream';
  if (!m[2]) return { mime, bytes: new TextEncoder().encode(decodeURIComponent(m[3])) };
  const bin = atob(m[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { mime, bytes };
}

const IMAGE_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', webp: 'image/webp', tif: 'image/tiff', tiff: 'image/tiff', emf: 'image/emf', wmf: 'image/wmf' };
export function imageMime(name = '') {
  return IMAGE_MIME[String(name).toLowerCase().split('.').pop()] || 'application/octet-stream';
}

/** Resolve a relative zip path ("../media/a.png") against a base part. */
export function resolvePart(base, target) {
  if (!target) return '';
  if (target.startsWith('/')) return target.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg && seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}

/** Lazy JSZip, so the explorer never pays for it until a document opens. */
export async function loadZip(data) {
  const { default: JSZip } = await import('jszip');
  return JSZip.loadAsync(data);
}

export async function newZip() {
  const { default: JSZip } = await import('jszip');
  return new JSZip();
}

/** Accept a Blob, ArrayBuffer or typed array and hand back bytes. */
export async function toBytes(data) {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (data && typeof data.arrayBuffer === 'function') return new Uint8Array(await data.arrayBuffer());
  if (typeof data === 'string') return new TextEncoder().encode(data);
  throw new Error('Unsupported file data');
}

export async function toText(data) {
  if (typeof data === 'string') return data;
  const bytes = await toBytes(data);
  return new TextDecoder('utf-8').decode(bytes);
}
