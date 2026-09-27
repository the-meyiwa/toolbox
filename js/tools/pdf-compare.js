/* ============================================================
   Compare PDFs — what changed between two versions: text changes
   line by line, and a picture of each changed page with removed
   ink in red and added ink in green.
   ============================================================ */

import { makeFileTool } from '../lib/kit/file-tool.js';
import { comparePdfs } from '../lib/pdf/ops.js';
import { esc } from '../lib/kit/form.js';

export default makeFileTool({
  id: 'pdf-compare',
  accept: 'application/pdf,.pdf',
  dropLabel: 'Drop two PDFs to compare',
  dropHint: 'the original first, then the new version',
  min: 2, max: 2,
  action: 'Compare',
  fields: [{ key: 'visual', label: 'Also compare how the pages look', type: 'checkbox', value: true }],
  async run([a, b], v, { signal, progress }) {
    const r = await comparePdfs(await a.bytes(), await b.bytes(), { visual: v.visual, dpi: 96 }, { signal, onProgress: progress });
    const changed = r.pages.filter((p) => p.diff.length || p.changedPixels || p.onlyIn);
    const files = []; const urls = [];
    let html = `<p class="kit-note"><b>${changed.length}</b> of ${r.pages.length} pages differ. ${esc(a.name)} has ${r.pagesA} pages; ${esc(b.name)} has ${r.pagesB}.</p>`;
    const report = [];
    for (const p of changed) {
      html += `<h4 class="kit-h">Page ${p.page}${p.onlyIn ? ` · only in the ${p.onlyIn} file` : ''}</h4>`;
      if (p.diff.length) {
        html += `<pre class="kit-pre">${p.diff.slice(0, 400).map(([t, s]) => `<span class="${t === '+' ? 'kit-add' : 'kit-del'}">${t} ${esc(s)}</span>`).join('\n')}</pre>`;
        report.push(`Page ${p.page}`, ...p.diff.map(([t, s]) => `${t} ${s}`), '');
      } else if (!p.onlyIn) html += '<p class="kit-note">Text is the same; the layout or images changed.</p>';
      if (p.image) {
        const blob = new Blob([p.image], { type: 'image/png' });
        const u = URL.createObjectURL(blob); urls.push(u);
        files.push({ name: `difference-page-${p.page}.png`, data: blob });
        html += `<img src="${u}" alt="Differences on page ${p.page}" style="max-width:100%;border:1px solid var(--line);border-radius:8px">`;
      }
    }
    if (!changed.length) html = '<p class="kit-note"><span class="kit-badge is-ok">Identical</span> No differences in text or appearance.</p>';
    setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 10 * 60 * 1000);
    const text = report.join('\n');
    if (text) files.unshift({ name: 'text-changes.txt', data: new TextEncoder().encode(text) });
    return { html, files, text, zipName: 'pdf-comparison.zip' };
  },
});
