/* PDF Merge — combine documents, reorder before you commit. */

import { attachFileInput, dropZone, humanBytes, downloadBlob } from '../lib/file-engine.js';
import { inspectPdf, mergePdfs, pdfBlob } from '../lib/pdf-engine.js';

export default {
  async render(container, { analytics } = {}) {
    this._cleanup = [];

    container.innerHTML = `
      ${dropZone('pm-zone', { label: 'Drop PDFs to combine', hint: 'or click to choose · add as many as you like', accept: 'application/pdf,.pdf' })}
      <div id="pm-work" hidden>
        <p class="biz-hint">Files are combined top to bottom. Drag a row, or use the arrows, to change the order.</p>
        <div class="fz-list pdf-list" id="pm-list"></div>
        <div class="fz-summary" id="pm-summary"></div>
        <div class="tool-controls">
          <label class="fz-ctl"><span>Save as</span>
            <input type="text" class="tool-input" id="pm-name" value="merged.pdf"></label>
          <button class="btn btn-primary" id="pm-go">Merge &amp; download</button>
          <button class="btn btn-secondary btn-sm" id="pm-clear">Clear</button>
        </div>
        <p class="fz-err" id="pm-error" hidden></p>
      </div>`;

    const zone  = container.querySelector('#pm-zone');
    const input = container.querySelector('#pm-zone-input');
    const work  = container.querySelector('#pm-work');
    const list  = container.querySelector('#pm-list');
    const summary = container.querySelector('#pm-summary');
    const errorEl = container.querySelector('#pm-error');

    /** @type {Array<{file: File, pages: number, error?: string}>} */
    let docs = [];

    function render() {
      list.innerHTML = docs.map((d, i) => `
        <div class="fz-row pdf-row" draggable="true" data-i="${i}">
          <span class="pdf-grip" aria-hidden="true">⋮⋮</span>
          <div class="fz-name">
            <strong>${d.file.name}</strong>
            <span class="fz-meta">${d.error ? `<span class="fz-err">${d.error}</span>` : `${d.pages} page${d.pages === 1 ? '' : 's'} · ${humanBytes(d.file.size)}`}</span>
          </div>
          <div class="pdf-actions">
            <button class="btn btn-sm" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
            <button class="btn btn-sm" data-down="${i}" ${i === docs.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
            <button class="btn btn-sm ct-del" data-remove="${i}" aria-label="Remove">×</button>
          </div>
        </div>`).join('');

      const usable = docs.filter(d => !d.error);
      summary.innerHTML = usable.length ? `
        <div class="fz-stat"><span class="fz-stat-v">${usable.length}</span><span class="fz-stat-l">Document${usable.length === 1 ? '' : 's'}</span></div>
        <div class="fz-stat"><span class="fz-stat-v">${usable.reduce((s, d) => s + d.pages, 0)}</span><span class="fz-stat-l">Total pages</span></div>
        <div class="fz-stat"><span class="fz-stat-v">${humanBytes(usable.reduce((s, d) => s + d.file.size, 0))}</span><span class="fz-stat-l">Combined size</span></div>` : '';
    }

    async function addFiles(files) {
      work.hidden = false;
      analytics?.started();
      for (const file of files) {
        try {
          const info = await inspectPdf(file);
          docs.push({ file, pages: info.pageCount });
        } catch (err) {
          // A password-protected or corrupt file should be visible, not silently skipped.
          docs.push({ file, pages: 0, error: /encrypt|password/i.test(err.message) ? 'Password protected — cannot merge' : 'Could not read this PDF' });
          analytics?.error('pdf_unreadable');
        }
      }
      render();
    }

    this._cleanup.push(attachFileInput(zone, input, addFiles, { accept: /pdf/i }));

    list.addEventListener('click', (e) => {
      const t = e.target;
      const move = (from, to) => {
        if (to < 0 || to >= docs.length) return;
        const [item] = docs.splice(from, 1);
        docs.splice(to, 0, item);
        render();
      };
      if (t.dataset.up != null)     move(Number(t.dataset.up), Number(t.dataset.up) - 1);
      else if (t.dataset.down != null) move(Number(t.dataset.down), Number(t.dataset.down) + 1);
      else if (t.dataset.remove != null) { docs.splice(Number(t.dataset.remove), 1); render(); }
    });

    /* Drag to reorder. */
    let dragIndex = null;
    list.addEventListener('dragstart', (e) => {
      const row = e.target.closest('[data-i]');
      if (!row) return;
      dragIndex = Number(row.dataset.i);
      row.classList.add('is-dragging');
    });
    list.addEventListener('dragend', (e) => e.target.closest('[data-i]')?.classList.remove('is-dragging'));
    list.addEventListener('dragover', (e) => e.preventDefault());
    list.addEventListener('drop', (e) => {
      e.preventDefault();
      const row = e.target.closest('[data-i]');
      if (!row || dragIndex == null) return;
      const to = Number(row.dataset.i);
      const [item] = docs.splice(dragIndex, 1);
      docs.splice(to, 0, item);
      dragIndex = null;
      render();
    });

    container.querySelector('#pm-go').addEventListener('click', async () => {
      const usable = docs.filter(d => !d.error).map(d => d.file);
      errorEl.hidden = true;
      if (usable.length < 2) {
        errorEl.hidden = false;
        errorEl.textContent = 'Add at least two readable PDFs to merge.';
        return;
      }
      try {
        const bytes = await mergePdfs(usable);
        const blob = pdfBlob(bytes);
        const name = (container.querySelector('#pm-name').value || 'merged.pdf').replace(/(\.pdf)?$/i, '.pdf');
        downloadBlob(blob, name);
        analytics?.completed({ fileCount: usable.length, bytesOut: blob.size });
        analytics?.downloaded({ fileCount: 1, bytesOut: blob.size });
      } catch (err) {
        errorEl.hidden = false;
        errorEl.textContent = `Could not merge: ${err.message}`;
        analytics?.error('merge_failed');
      }
    });

    container.querySelector('#pm-clear').addEventListener('click', () => {
      docs = []; work.hidden = true; list.innerHTML = ''; summary.innerHTML = '';
    });
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    this._cleanup = [];
  },
};
