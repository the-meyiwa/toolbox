/* ============================================================
   Document previews for the File Explorer.

   Each preview is a whole HTML page meant for a sandboxed iframe
   (no scripts, no same-origin) with a content policy that blocks all
   network access, so a hostile document can neither run code nor
   phone home. Only the parser a file needs is loaded.
   ============================================================ */

import { extOf, docFamily } from './formats.js';
export { RICH_PREVIEW, hasRichPreview } from './formats.js';
import { modelToHtml, textToModel } from './model.js';
import { slideHtml, DECK_CSS } from './deck-render.js';
import { escHtml } from './xml.js';

const CSP = "default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:";

function page(body, css = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root{color-scheme:light}
html,body{margin:0;background:#ecebe8}
body{font:15px/1.55 Georgia,'Times New Roman',serif;color:#161616;padding:16px}
.pv-page{background:#fff;max-width:780px;margin:0 auto 16px;padding:56px 64px;box-shadow:0 1px 3px rgba(0,0,0,.12);border-radius:2px;box-sizing:border-box;overflow-wrap:break-word}
.pv-page h1,.pv-page h2,.pv-page h3,.pv-page h4{font-family:Calibri,Carlito,'Segoe UI',Arial,sans-serif;line-height:1.25;margin:1.1em 0 .45em}
.pv-page h1:first-child,.pv-page h2:first-child{margin-top:0}
.pv-page p{margin:0 0 .7em}
.pv-page img{max-width:100%;height:auto}
.pv-page table{border-collapse:collapse;margin:0 0 1em;width:100%}
.pv-page td,.pv-page th{border:1px solid #c9c9c6;padding:4px 8px;vertical-align:top;text-align:left}
.pv-page blockquote{margin:0 0 .8em;padding-left:1em;border-left:3px solid #ccc;color:#444;font-style:italic}
.pv-page pre{white-space:pre-wrap;font:13px/1.45 ui-monospace,Menlo,Consolas,monospace;background:#f5f5f3;padding:10px;border-radius:4px}
.pv-page hr[data-page-break]{border:0;border-top:1px dashed #bbb;margin:2em -64px}
.pv-note{font:12px/1.4 system-ui,sans-serif;color:#666;text-align:center;margin:0 0 12px}
@media (max-width:640px){body{padding:8px}.pv-page{padding:28px 22px}.pv-page hr[data-page-break]{margin:1.5em -22px}}
${css}
</style></head><body>${body}</body></html>`;
}

async function documentPage(bytes, ext) {
  let blocks;
  let note = '';
  if (ext === 'docx') blocks = await (await import('./docx.js')).docxToModel(bytes);
  else if (ext === 'odt') blocks = await (await import('./odf.js')).odtToModel(bytes);
  else if (ext === 'rtf') blocks = (await import('./rtf.js')).rtfToModel(new TextDecoder('latin1').decode(bytes));
  else if (ext === 'doc') {
    blocks = textToModel(await (await import('./legacy.js')).docToText(bytes));
    note = 'Text only: this is an older document format, so layout and formatting are not shown.';
  }
  return page(`${note ? `<p class="pv-note">${escHtml(note)}</p>` : ''}<article class="pv-page">${modelToHtml(blocks || [])}</article>`);
}

const SHEET_CSS = `
html,body{background:#fff}
body{font:13px/1.35 system-ui,-apple-system,'Segoe UI',sans-serif;padding:0}
h2{font:600 13px system-ui,sans-serif;margin:0;padding:10px 12px;background:#f4f4f2;border-bottom:1px solid #e0e0de;position:sticky;left:0}
.pv-sheet{margin-bottom:18px}
.pv-wrap{overflow:auto}
table{border-collapse:collapse;font-variant-numeric:tabular-nums}
th,td{border:1px solid #e3e3e1;padding:3px 8px;white-space:nowrap;max-width:320px;overflow:hidden;text-overflow:ellipsis}
th{background:#f7f7f5;color:#777;font-weight:500;text-align:center;min-width:28px}
td.n{text-align:right}
.pv-note{font:12px system-ui,sans-serif;color:#666;padding:6px 12px;margin:0}
`;

const ROW_LIMIT = 300, COL_LIMIT = 40;

async function sheetPage(bytes, name) {
  const { readWorkbook, fillFormulaValues } = await import('./sheets.js');
  const { indexToCol } = await import('./formula.js');
  const book = fillFormulaValues(await readWorkbook(bytes, name));
  const parts = book.sheets.slice(0, 12).map(sheet => {
    const rows = Math.min(sheet.rows, ROW_LIMIT);
    const cols = Math.min(sheet.cols, COL_LIMIT);
    if (!rows || !cols) return `<section class="pv-sheet"><h2>${escHtml(sheet.name)}</h2><p class="pv-note">This sheet is empty.</p></section>`;
    let html = `<tr><th></th>${Array.from({ length: cols }, (_, c) => `<th>${indexToCol(c)}</th>`).join('')}</tr>`;
    for (let r = 0; r < rows; r++) {
      html += `<tr><th>${r + 1}</th>`;
      for (let c = 0; c < cols; c++) {
        const v = sheet.cells.get(`${r}:${c}`)?.v;
        const isNum = typeof v === 'number';
        const text = v == null ? '' : isNum ? String(Math.round(v * 1e9) / 1e9) : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v);
        html += `<td${isNum ? ' class="n"' : ''}>${escHtml(text)}</td>`;
      }
      html += '</tr>';
    }
    const more = sheet.rows > rows || sheet.cols > cols ? `<p class="pv-note">Showing ${rows} of ${sheet.rows} rows and ${cols} of ${sheet.cols} columns. Open it in Ledger to see everything.</p>` : '';
    return `<section class="pv-sheet"><h2>${escHtml(sheet.name)}</h2><div class="pv-wrap"><table>${html}</table></div>${more}</section>`;
  });
  if (book.sheets.length > 12) parts.push(`<p class="pv-note">${book.sheets.length - 12} more sheets. Open it in Ledger to see them.</p>`);
  return page(parts.join(''), SHEET_CSS);
}

async function deckPage(bytes, ext) {
  let deck;
  let note = '';
  if (ext === 'pptx') deck = await (await import('./pptx.js')).pptxToDeck(bytes);
  else if (ext === 'odp') deck = await (await import('./odf.js')).odpToDeck(bytes);
  else {
    deck = await (await import('./legacy.js')).pptToDeck(bytes);
    note = 'Text only: this is an older presentation format, so layout and pictures are not shown.';
  }
  const slides = deck.slides.slice(0, 200).map((s, i) => `<figure class="pv-slide"><figcaption>${i + 1}</figcaption>${slideHtml(s, deck)}</figure>`).join('');
  return page(`${note ? `<p class="pv-note">${escHtml(note)}</p>` : ''}${slides}`, `
body{padding:12px}
.pv-slide{margin:0 auto 14px;max-width:900px;position:relative}
.pv-slide .dk-slide{box-shadow:0 1px 3px rgba(0,0,0,.18);border-radius:2px}
.pv-slide figcaption{font:11px system-ui,sans-serif;color:#777;margin:0 0 4px}
${DECK_CSS}`);
}

async function epubPage(bytes) {
  const { readEpub } = await import('./epub.js');
  const book = await readEpub(bytes);
  const head = book.title ? `<header class="pv-page pv-cover"><h1>${escHtml(book.title)}</h1>${book.creator ? `<p>${escHtml(book.creator)}</p>` : ''}</header>` : '';
  return page(head + book.chapters.map(c => `<article class="pv-page">${c.html}</article>`).join(''), '.pv-cover{text-align:center;padding:80px 64px}.pv-cover h1{font-size:2em}');
}

/**
 * Build a preview page for a document.
 * @param {Blob|ArrayBuffer|Uint8Array} data
 * @param {string} name file name, for the format
 * @returns {Promise<string>} a complete HTML document for iframe srcdoc
 */
export async function renderPreview(data, name) {
  const ext = extOf(name);
  const { toBytes } = await import('./xml.js');
  const bytes = await toBytes(data);
  if (ext === 'epub') return epubPage(bytes);
  const family = docFamily(name);
  if (family === 'document') return documentPage(bytes, ext);
  if (family === 'spreadsheet') return sheetPage(bytes, name);
  if (family === 'presentation') return deckPage(bytes, ext);
  throw new Error('No preview for this format');
}

/** A small page that says why a preview failed, in the same frame. */
export function errorPage(message) {
  return page(`<p class="pv-note" style="padding:40px 16px">${escHtml(message)}</p>`);
}
