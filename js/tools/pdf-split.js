/* PDF Split — pick pages, drop pages, rotate pages. */

import { attachFileInput, dropZone, humanBytes, downloadBlob } from '../lib/file-engine.js';
import { inspectPdf, extractPages, parsePageRange, pdfBlob } from '../lib/pdf-engine.js';

export default {
  async render(container, { analytics } = {}) {
    this._cleanup = [];

    container.innerHTML = `
      ${dropZone('ps-zone', { label: 'Drop a PDF', hint: 'or click to choose', accept: 'application/pdf,.pdf', multiple: false })}
      <div id="ps-work" hidden>
        <div class="fz-summary" id="ps-info"></div>
        <div class="tool-controls fz-controls">
          <label class="fz-ctl" style="flex:2;"><span>Pages to keep</span>
            <input type="text" class="tool-input" id="ps-range" placeholder="e.g. 1-3, 5, 8-">
          </label>
          <button class="btn btn-sm" id="ps-all">Select all</button>
          <button class="btn btn-sm" id="ps-none">Select none</button>
        </div>
        <p class="biz-hint">Ranges accept <code>1-3</code>, single pages <code>5</code>, and open ends <code>8-</code>.
          Or just click the pages below.</p>
        <div class="pdf-pages" id="ps-pages"></div>
        <div class="tool-controls">
          <button class="btn btn-primary" id="ps-go">Save selected pages</button>
          <button class="btn btn-secondary btn-sm" id="ps-each">Save each page separately</button>
          <button class="btn btn-secondary btn-sm" id="ps-clear">Choose another</button>
        </div>
        <p class="fz-err" id="ps-error" hidden></p>
      </div>`;

    const zone  = container.querySelector('#ps-zone');
    const input = container.querySelector('#ps-zone-input');
    const work  = container.querySelector('#ps-work');
    const info  = container.querySelector('#ps-info');
    const pagesEl = container.querySelector('#ps-pages');
    const rangeEl = container.querySelector('#ps-range');
    const errorEl = container.querySelector('#ps-error');

    let file = null;
    let doc = null;
    /** Selected page indices, in output order. */
    let selected = [];
    /** index → extra rotation in degrees. */
    let rotations = {};

    function renderPages() {
      if (!doc) return;
      pagesEl.innerHTML = doc.pages.map(p => {
        const on = selected.includes(p.index);
        const rot = rotations[p.index] ?? 0;
        return `
          <div class="pdf-page${on ? ' is-on' : ''}" data-page="${p.index}">
            <div class="pdf-page-box" style="transform: rotate(${rot}deg)">
              <span class="pdf-page-num">${p.index + 1}</span>
            </div>
            <div class="pdf-page-meta">${p.width}×${p.height}</div>
            <button class="btn btn-sm pdf-rotate" data-rotate="${p.index}" aria-label="Rotate page ${p.index + 1}">⟳</button>
          </div>`;
      }).join('');

      info.innerHTML = `
        <div class="fz-stat"><span class="fz-stat-v">${doc.pageCount}</span><span class="fz-stat-l">Pages</span></div>
        <div class="fz-stat"><span class="fz-stat-v">${selected.length}</span><span class="fz-stat-l">Selected</span></div>
        <div class="fz-stat"><span class="fz-stat-v">${humanBytes(doc.size)}</span><span class="fz-stat-l">Size</span></div>`;
    }

    /** Keep the text field and the clicked selection describing the same thing. */
    function syncRangeFromSelection() {
      if (!selected.length) { rangeEl.value = ''; return; }
      const sorted = [...selected].sort((a, b) => a - b);
      const parts = [];
      let start = sorted[0], prev = sorted[0];
      for (let i = 1; i <= sorted.length; i++) {
        const cur = sorted[i];
        if (cur !== prev + 1) {
          parts.push(start === prev ? `${start + 1}` : `${start + 1}-${prev + 1}`);
          start = cur;
        }
        prev = cur;
      }
      rangeEl.value = parts.join(', ');
    }

    async function load(files) {
      file = files[0];
      if (!file) return;
      analytics?.started();
      errorEl.hidden = true;
      try {
        doc = await inspectPdf(file);
      } catch (err) {
        errorEl.hidden = false;
        errorEl.textContent = /encrypt|password/i.test(err.message)
          ? 'That PDF is password protected, so its pages cannot be read.'
          : 'That file could not be read as a PDF.';
        analytics?.error('pdf_unreadable');
        return;
      }
      selected = doc.pages.map(p => p.index);
      rotations = {};
      work.hidden = false;
      syncRangeFromSelection();
      renderPages();
    }

    this._cleanup.push(attachFileInput(zone, input, load, { accept: /pdf/i }));

    pagesEl.addEventListener('click', (e) => {
      const rotateBtn = e.target.closest('[data-rotate]');
      if (rotateBtn) {
        const i = Number(rotateBtn.dataset.rotate);
        rotations[i] = ((rotations[i] ?? 0) + 90) % 360;
        renderPages();
        return;
      }
      const page = e.target.closest('[data-page]');
      if (!page) return;
      const i = Number(page.dataset.page);
      selected = selected.includes(i) ? selected.filter(x => x !== i) : [...selected, i].sort((a, b) => a - b);
      syncRangeFromSelection();
      renderPages();
    });

    rangeEl.addEventListener('input', () => {
      if (!doc) return;
      selected = parsePageRange(rangeEl.value, doc.pageCount);
      renderPages();
    });

    container.querySelector('#ps-all').addEventListener('click', () => {
      if (!doc) return;
      selected = doc.pages.map(p => p.index);
      syncRangeFromSelection(); renderPages();
    });
    container.querySelector('#ps-none').addEventListener('click', () => {
      selected = []; syncRangeFromSelection(); renderPages();
    });

    container.querySelector('#ps-go').addEventListener('click', async () => {
      errorEl.hidden = true;
      if (!file || !selected.length) {
        errorEl.hidden = false;
        errorEl.textContent = 'Select at least one page.';
        return;
      }
      try {
        const bytes = await extractPages(file, selected, rotations);
        const blob = pdfBlob(bytes);
        downloadBlob(blob, file.name.replace(/\.pdf$/i, '') + '-pages.pdf');
        analytics?.completed({ fileCount: 1, resultCount: selected.length, bytesOut: blob.size });
        analytics?.downloaded({ fileCount: 1 });
      } catch (err) {
        errorEl.hidden = false;
        errorEl.textContent = `Could not build the PDF: ${err.message}`;
        analytics?.error('split_failed');
      }
    });

    container.querySelector('#ps-each').addEventListener('click', async () => {
      if (!file || !selected.length) return;
      try {
        for (const index of selected) {
          const bytes = await extractPages(file, [index], rotations);
          downloadBlob(pdfBlob(bytes), `${file.name.replace(/\.pdf$/i, '')}-p${index + 1}.pdf`);
        }
        analytics?.completed({ fileCount: selected.length });
        analytics?.downloaded({ fileCount: selected.length });
      } catch {
        analytics?.error('split_failed');
      }
    });

    container.querySelector('#ps-clear').addEventListener('click', () => {
      file = null; doc = null; selected = []; rotations = {};
      work.hidden = true; pagesEl.innerHTML = ''; info.innerHTML = '';
    });
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    this._cleanup = [];
  },
};
