/* ============================================================
   Text extraction: pdf.js text items → lines → .txt / .md.

   pdf.js hands back positioned runs of text, not lines. Runs are
   grouped by baseline, ordered left to right, and joined with a space
   only where the gap between them is wide enough to be one. Markdown
   headings are inferred from font size relative to the body text.
   ============================================================ */

import { checkAbort, tick } from './core.js';

/**
 * @param {Array<{str: string, transform: number[], width?: number, height?: number, hasEOL?: boolean}>} items
 * @returns {Array<{text: string, size: number, y: number, x: number}>} top-to-bottom
 */
export function itemsToLines(items) {
  const runs = [];
  for (const it of items || []) {
    if (!it || typeof it.str !== 'string') continue;
    const tr = it.transform || [1, 0, 0, 1, 0, 0];
    const size = Math.abs(it.height || Math.hypot(tr[2], tr[3]) || Math.hypot(tr[0], tr[1]) || 10);
    runs.push({ str: it.str, x: tr[4], y: tr[5], w: it.width || it.str.length * size * 0.5, size, eol: it.hasEOL });
  }
  // Baseline buckets: runs within 40% of the font size share a line.
  runs.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const r of runs) {
    const line = lines.find(l => Math.abs(l.y - r.y) <= Math.max(2, Math.min(l.size, r.size) * 0.4));
    if (line) { line.runs.push(r); line.size = Math.max(line.size, r.str.trim() ? r.size : 0); }
    else lines.push({ y: r.y, size: r.str.trim() ? r.size : 0, runs: [r] });
  }
  lines.sort((a, b) => b.y - a.y);
  return lines.map(l => {
    l.runs.sort((a, b) => a.x - b.x);
    let text = '';
    let end = null;
    for (const r of l.runs) {
      if (end != null && text && !/\s$/.test(text) && !/^\s/.test(r.str)) {
        const gap = r.x - end;
        if (gap > r.size * 0.18) text += gap > r.size * 2.5 ? '    ' : ' ';
      }
      text += r.str;
      end = r.x + r.w;
    }
    return { text: text.replace(/\s+$/, ''), size: Math.round(l.size * 10) / 10, y: l.y, x: l.runs[0]?.x ?? 0 };
  }).filter(l => l.text.trim());
}

/**
 * Pull text from a pdf.js document page by page.
 * @returns {Promise<Array<{page: number, lines: Array}>>}
 */
export async function extractText(pdfDoc, { pages, signal, onProgress } = {}) {
  const list = pages ?? Array.from({ length: pdfDoc.numPages }, (_, i) => i);
  const out = [];
  for (let k = 0; k < list.length; k++) {
    checkAbort(signal);
    const page = await pdfDoc.getPage(list[k] + 1);
    const content = await page.getTextContent();
    out.push({ page: list[k] + 1, lines: itemsToLines(content.items) });
    page.cleanup?.();
    onProgress?.((k + 1) / list.length);
    if (k % 8 === 7) await tick();
  }
  return out;
}

/** Join wrapped lines into paragraphs. A short line or a big vertical gap ends a paragraph. */
function paragraphs(lines) {
  const out = [];
  let cur = null;
  let prev = null;
  const width = Math.max(...lines.map(l => l.text.length), 1);
  for (const l of lines) {
    const gap = prev ? prev.y - l.y : 0;
    const newPara = !cur || !prev
      || gap > Math.max(prev.size, l.size) * 1.9
      || Math.abs(l.size - prev.size) > 0.6
      || prev.text.length < width * 0.6
      || /^\s*([-•*▪◦·]|\d+[.)])\s/.test(l.text);
    if (newPara) { cur = { text: l.text.trim(), size: l.size }; out.push(cur); }
    else cur.text = cur.text.endsWith('-') ? cur.text.slice(0, -1) + l.text.trim() : `${cur.text} ${l.text.trim()}`;
    prev = l;
  }
  return out;
}

export function pagesToText(pages, { pageBreaks = true } = {}) {
  return pages.map(p => {
    const body = p.lines.map(l => l.text).join('\n');
    return pageBreaks ? `--- Page ${p.page} ---\n${body}` : body;
  }).join('\n\n').trim() + '\n';
}

export function pagesToMarkdown(pages, { title = '' } = {}) {
  const sizes = pages.flatMap(p => p.lines.map(l => l.size)).filter(Boolean).sort((a, b) => a - b);
  const body = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 10;
  const blocks = [];
  if (title) blocks.push(`# ${title}`);
  for (const p of pages) {
    if (pages.length > 1) blocks.push(`<!-- Page ${p.page} -->`);
    for (const para of paragraphs(p.lines)) {
      let t = para.text.replace(/\s{2,}/g, ' ').trim();
      if (!t) continue;
      const ratio = para.size / body;
      if (ratio >= 1.6 && t.length < 120) blocks.push(`${title ? '##' : '#'} ${t}`);
      else if (ratio >= 1.25 && t.length < 140) blocks.push(`${title ? '###' : '##'} ${t}`);
      else if (ratio >= 1.1 && t.length < 90 && !/[.:;,]$/.test(t)) blocks.push(`${title ? '####' : '###'} ${t}`);
      else {
        t = t.replace(/^[•▪◦·]\s*/, '- ');
        blocks.push(t);
      }
    }
  }
  return blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
