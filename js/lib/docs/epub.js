/* ============================================================
   EPUB reading: title, spine order, chapter bodies with their
   pictures inlined, for the File Explorer preview.

   Chapter markup is only ever shown inside a sandboxed frame with a
   no-network content policy (see preview.js), so here it is trimmed
   rather than rebuilt: scripts, styles and event handlers go.
   ============================================================ */

import { parseXml, all, attr, kid, bytesToDataUrl, imageMime, resolvePart, loadZip, toBytes } from './xml.js';

export async function readEpub(data) {
  const zip = await loadZip(await toBytes(data));
  const container = zip.file('META-INF/container.xml');
  if (!container) throw new Error('This e-book has no container file');
  const rootPath = attr(all(parseXml(await container.async('string')).documentElement, 'rootfile')[0], 'full-path');
  const opfFile = rootPath && zip.file(rootPath);
  if (!opfFile) throw new Error('This e-book has no package file');
  const opf = parseXml(await opfFile.async('string')).documentElement;

  const title = all(opf, 'title')[0]?.textContent?.trim() || '';
  const creator = all(opf, 'creator')[0]?.textContent?.trim() || '';
  const manifest = new Map();
  for (const item of all(opf, 'item')) manifest.set(attr(item, 'id'), { href: resolvePart(rootPath, decodeURIComponent(attr(item, 'href') || '')), type: attr(item, 'media-type') || '' });

  const chapters = [];
  const spine = kid(opf, 'spine') || all(opf, 'spine')[0];
  for (const ref of all(spine, 'itemref')) {
    const item = manifest.get(attr(ref, 'idref'));
    if (!item || !/html|xml/.test(item.type)) continue;
    const file = zip.file(item.href);
    if (!file) continue;
    const raw = await file.async('string');
    chapters.push({ href: item.href, html: await cleanChapter(raw, item.href, zip) });
    if (chapters.length >= 400) break;
  }
  return { title, creator, chapters };
}

async function cleanChapter(raw, base, zip) {
  let body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(raw)?.[1] ?? raw;
  body = body
    .replace(/<(script|style|iframe|object|embed|form|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?(script|style|iframe|object|embed|form|link|meta|base|noscript|template)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '');

  // Inline pictures, which the preview frame cannot fetch.
  const refs = new Set();
  body.replace(/\s(?:src|xlink:href|href)\s*=\s*("|')([^"']+)\1/gi, (m, q, src) => { if (/\.(png|jpe?g|gif|svg|webp|bmp)$/i.test(src.split('#')[0])) refs.add(src); return m; });
  const urls = new Map();
  for (const src of refs) {
    const path = resolvePart(base, decodeURIComponent(src.split('#')[0]));
    const f = zip.file(path);
    if (f) urls.set(src, bytesToDataUrl(await f.async('uint8array'), imageMime(path)));
  }
  return body.replace(/(\s(?:src|xlink:href|href)\s*=\s*)("|')([^"']+)\2/gi, (m, pre, q, src) => {
    if (urls.has(src)) return `${pre}${q}${urls.get(src)}${q}`;
    // Links between chapters cannot navigate inside the preview.
    if (/^(?!https?:|mailto:|data:)/i.test(src) && /href/i.test(pre)) return `${pre}${q}#${q}`;
    return m;
  });
}
