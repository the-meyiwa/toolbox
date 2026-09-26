/* ============================================================
   Legal tools — shared view helpers (DOM)

   Markup and behaviour the five legal tools share: the document
   source card (drop a PDF / DOCX / TXT or paste), page chips,
   the table of authorities, section blocks, copy / download /
   print-to-PDF, and the "check against the source" note.
   Styles live in css/legal.css (prefix .lg-).
   ============================================================ */

import { attachFileInput, downloadBlob } from '../file-engine.js';
import { readDocument, ACCEPT_DOCS } from './doc-text.js';
import { pagesTxt } from './authorities.js';

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const P = {
  upload: '<path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/>',
  file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17.5v.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
  x: '<path d="M7 7l10 10M17 7 7 17"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  scale: '<path d="M12 3v18M7 21h10M5 7h14"/><path d="m5 7-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
  up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', ext: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  redact: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h10M7 14h6" stroke-width="3.2"/>',
  gavel: '<path d="m14 13-7.5 7.5a2.12 2.12 0 0 1-3-3L11 10"/><path d="m16 16 6-6M8 8l6-6M9 7l8 8M21 11l-8-8"/>',
};
export const icon = (name, size = 16) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

export const pageChip = (p) => (p ? `<span class="lg-pg" title="Page in the source document">p. ${esc(p)}</span>` : '');
export const pagesChip = (list) => (list && list.length ? `<span class="lg-pg" title="Pages where cited">${esc(pagesTxt(list))}</span>` : '');

export const CHECK_NOTE = 'Extracted on your device by pattern matching. Check every extract, citation and page reference against the source before relying on it.';
export const note = (text = CHECK_NOTE) => `<p class="lg-note">${icon('info', 14)}<span>${esc(text)}</span></p>`;

/* ---------------- source card ---------------- */

export function sourceCard(id, { label = 'Document', placeholder = 'Paste the text here', hint = 'PDF, Word (.docx) or text', rows = 9, compact = false } = {}) {
  return `
    <section class="lg-source${compact ? ' is-compact' : ''}" data-src="${id}">
      <div class="lg-source-head">
        <label class="lg-label" for="${id}-text">${esc(label)}</label>
        <span class="lg-source-status" id="${id}-status">${esc(hint)}</span>
      </div>
      <div class="lg-drop" id="${id}-zone" role="button" tabindex="0" aria-label="Choose a file for ${esc(label)}">
        <input type="file" id="${id}-zone-input" accept="${ACCEPT_DOCS}" hidden>
        <span class="lg-drop-icon">${icon('upload', 18)}</span>
        <span class="lg-drop-text"><strong>Drop a file or choose one</strong><small>${esc(hint)} · read on this device, never uploaded</small></span>
      </div>
      <textarea class="tool-textarea lg-textarea" id="${id}-text" rows="${rows}" placeholder="${esc(placeholder)}" spellcheck="false"></textarea>
    </section>`;
}

/** Wires a source card. onLoaded({ text, name, kind, pages, scanned }) runs after a file is read. */
export function bindSource(root, id, { onLoaded, onError } = {}) {
  const zone = root.querySelector(`#${id}-zone`);
  const input = root.querySelector(`#${id}-zone-input`);
  const ta = root.querySelector(`#${id}-text`);
  const status = root.querySelector(`#${id}-status`);
  const set = (msg, tone = '') => { status.textContent = msg; status.dataset.tone = tone; };
  const off = attachFileInput(zone, input, async (files) => {
    const f = files[0];
    if (!f) return;
    set(`Reading ${f.name}…`, 'busy');
    try {
      const r = await readDocument(f, { onProgress: (n, t) => set(`Reading ${f.name}: page ${n} of ${t}`, 'busy') });
      ta.value = r.text;
      ta.dataset.file = f.name;
      const bits = [f.name, r.pages ? `${r.pages} page${r.pages === 1 ? '' : 's'}` : r.kind.toUpperCase()];
      if (r.scanned) { set(`${bits.join(' · ')} · little or no text: this looks scanned. Run OCR first.`, 'warn'); }
      else set(bits.join(' · '), 'ok');
      onLoaded?.(r);
    } catch (err) {
      set(err.message || 'Could not read the file.', 'error');
      onError?.(err);
    }
  }, { accept: ACCEPT_DOCS });
  // The drop zone listens for pastes on the window; a paste into a textarea is text, which it ignores.
  return { off, textarea: ta, setStatus: set, get file() { return ta.dataset.file || null; } };
}

/* ---------------- table of authorities ---------------- */

const WEIGHT_TONE = { binding: 'strong', self: 'strong', coordinate: 'mid', persuasive: 'soft', 'not-binding': 'soft', unknown: 'none' };

export function toaHTML(toa, { weights = true } = {}) {
  if (!toa || (!toa.counts.cases && !toa.counts.statutes && !toa.counts.rules)) return `<p class="lg-empty">No authorities were recognised in the text.</p>`;
  const caseRow = (c) => `
    <tr>
      <td data-label="Case"><span class="lg-case">${esc(c.title || 'Unnamed case')}</span>${c.per.length ? `<small class="lg-sub">per ${esc(c.per.join('; '))}</small>` : ''}${c.warnings.length ? `<small class="lg-sub lg-warn-text">${esc(c.warnings.join('; '))}</small>` : ''}</td>
      <td class="lg-cites" data-label="Citation">${c.citations.map(x => `<code>${esc(x)}</code>`).join('')}${c.pinpoints.length ? `<small class="lg-sub">at ${esc(c.pinpoints.join(', '))}</small>` : ''}</td>
      <td data-label="Court">${c.courtName ? `${esc(c.courtName)}${c.court?.inferred ? '<small class="lg-sub">inferred</small>' : ''}` : '<span class="lg-muted">Not stated</span>'}${weights && c.weight && c.court ? `<span class="lg-weight" data-tone="${WEIGHT_TONE[c.weight.status] || 'none'}" title="${esc(c.weight.reason)}">${esc(c.weight.label)}</span>` : ''}</td>
      <td data-label="Treatment">${c.treatments.length ? c.treatments.map(t => `<span class="lg-tag">${esc(t)}</span>`).join('') : '<span class="lg-muted">—</span>'}</td>
      <td class="lg-num" data-label="Cited at">${pagesChip(c.pages) || `<span class="lg-muted">${c.mentions}×</span>`}</td>
    </tr>`;
  const caseTable = (list, title) => (list.length ? `
    <h4 class="lg-h4">${esc(title)} <span class="lg-count">${list.length}</span></h4>
    <div class="lg-table-wrap"><table class="lg-table lg-toa">
      <thead><tr><th>Case</th><th>Citation</th><th>Court${weights && toa.forum ? ' · weight' : ''}</th><th>Treatment</th><th>Cited at</th></tr></thead>
      <tbody>${list.map(caseRow).join('')}</tbody></table></div>` : '');
  const statRows = (list) => list.map(s => `<li><span class="lg-stat-name">${esc(s.name)}${s.inferred ? '<small class="lg-sub">presumed from "the Constitution"</small>' : ''}</span>${s.provisions.length ? `<span class="lg-provs">${s.provisions.map(p => `<code title="${p.inferred ? 'Attributed from "the Act" nearby' : ''}">${esc(p.ref)}${p.inferred ? '*' : ''}</code>`).join('')}</span>` : ''}${pagesChip(s.pages)}</li>`).join('');
  return `
    ${caseTable(toa.cases.nigerian, 'Nigerian cases')}
    ${caseTable(toa.cases.foreign, 'Foreign cases (persuasive)')}
    ${toa.constitution.length ? `<h4 class="lg-h4">Constitution</h4><ul class="lg-stat-list">${statRows(toa.constitution)}</ul>` : ''}
    ${toa.statutes.length ? `<h4 class="lg-h4">Statutes <span class="lg-count">${toa.statutes.length}</span></h4><ul class="lg-stat-list">${statRows(toa.statutes)}</ul>` : ''}
    ${toa.rules.length ? `<h4 class="lg-h4">Rules of court</h4><ul class="lg-stat-list">${toa.rules.map(r => `<li><span class="lg-stat-name">${esc(r.name)}</span>${r.refs.length ? `<span class="lg-provs">${r.refs.map(x => `<code>${esc(x)}</code>`).join('')}</span>` : ''}${pagesChip(r.pages)}</li>`).join('')}</ul>` : ''}
    ${toa.loose.length ? `<p class="lg-fine">Sections without a named statute nearby: ${toa.loose.slice(0, 12).map(l => esc(l.ref)).join(', ')}${toa.loose.length > 12 ? '…' : ''}.</p>` : ''}`;
}

/* ---------------- output ---------------- */

export function download(name, text, type = 'text/markdown') {
  downloadBlob(new Blob([text], { type: `${type};charset=utf-8` }), name);
}

export const slug = (s) => String(s || 'document').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'document';

export async function copyToClipboard(text, btn) {
  try { await navigator.clipboard.writeText(text); } catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch { /* ignore */ } ta.remove();
  }
  if (btn) {
    const span = btn.querySelector('span') || btn;
    const prev = span.textContent;
    span.textContent = 'Copied';
    btn.classList.add('is-done');
    setTimeout(() => { span.textContent = prev; btn.classList.remove('is-done'); }, 1300);
  }
}

/** Prints Markdown through a hidden frame, so "Save as PDF" gives a clean document. */
export async function printMarkdown(title, md) {
  const { marked } = await import('marked');
  const html = marked.parse(md);
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    @page { size: A4; margin: 22mm 20mm; }
    body { font: 11.5pt/1.55 "Times New Roman", Times, serif; color: #111; }
    h1 { font-size: 17pt; margin: 0 0 8pt; } h2 { font-size: 13pt; margin: 16pt 0 6pt; border-bottom: .5pt solid #999; padding-bottom: 3pt; }
    h3 { font-size: 11.5pt; margin: 12pt 0 4pt; } code { font: 10pt ui-monospace, Menlo, monospace; }
    table { border-collapse: collapse; width: 100%; font-size: 10pt; } th, td { border: .5pt solid #999; padding: 3pt 5pt; text-align: left; vertical-align: top; }
    blockquote { margin: 4pt 0 4pt 12pt; color: #333; font-style: italic; } hr { border: 0; border-top: .5pt solid #999; margin: 14pt 0; }
    li { margin: 2pt 0; }
  </style></head><body>${html}</body></html>`);
  doc.close();
  setTimeout(() => {
    try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { /* blocked */ }
    setTimeout(() => frame.remove(), 60000);
  }, 120);
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
