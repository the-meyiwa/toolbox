/* Image to PDF — photos in, one document out. */

import {
  MIME, transformImage, decodeImage, humanBytes,
  downloadBlob, attachFileInput, dropZone,
} from '../lib/file-engine.js';
import { imagesToPdf, pdfBlob, PAGE_SIZES } from '../lib/pdf-engine.js';

export default {
  async render(container, { analytics } = {}) {
    this._cleanup = [];
    // Closure-scoped: `this` is undefined inside the plain function

    // declarations below, so these must not go through `this`.

    const urls = [];

    this._urls = urls;

    container.innerHTML = `
      ${dropZone('ip-zone', { label: 'Drop images to turn into a PDF', accept: 'image/*' })}
      <div id="ip-work" hidden>
        <div class="tool-controls fz-controls">
          <label class="fz-ctl"><span>Page size</span>
            <select class="tool-select" id="ip-size">
              ${Object.entries(PAGE_SIZES).map(([k, v]) => `<option value="${k}"${k === 'a4' ? ' selected' : ''}>${v.label}</option>`).join('')}
            </select></label>
          <label class="fz-ctl"><span>Orientation</span>
            <select class="tool-select" id="ip-orient">
              <option value="auto">Match each image</option>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select></label>
          <label class="fz-ctl"><span>Margin</span>
            <input type="range" id="ip-margin" class="tool-range" min="0" max="72" value="24">
            <output id="ip-margin-out">24 pt</output></label>
        </div>
        <p class="biz-hint">Images are placed one per page in the order below. Drag to reorder.</p>
        <div class="fz-list pdf-list" id="ip-list"></div>
        <div class="tool-controls">
          <label class="fz-ctl"><span>Save as</span>
            <input type="text" class="tool-input" id="ip-name" value="images.pdf"></label>
          <button class="btn btn-primary" id="ip-go">Create PDF</button>
          <button class="btn btn-secondary btn-sm" id="ip-clear">Clear</button>
        </div>
        <p class="fz-err" id="ip-error" hidden></p>
      </div>`;

    const zone  = container.querySelector('#ip-zone');
    const input = container.querySelector('#ip-zone-input');
    const work  = container.querySelector('#ip-work');
    const list  = container.querySelector('#ip-list');
    const errorEl = container.querySelector('#ip-error');
    const margin = container.querySelector('#ip-margin');

    let items = [];

    function render() {
      list.innerHTML = items.map((item, i) => `
        <div class="fz-row pdf-row" draggable="true" data-i="${i}">
          <span class="pdf-grip" aria-hidden="true">⋮⋮</span>
          <img class="fz-thumb" src="${item.url}" alt="">
          <div class="fz-name">
            <strong>${item.file.name}</strong>
            <span class="fz-meta">${item.w}×${item.h} · ${humanBytes(item.file.size)}</span>
          </div>
          <div class="pdf-actions">
            <button class="btn btn-sm" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
            <button class="btn btn-sm" data-down="${i}" ${i === items.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
            <button class="btn btn-sm ct-del" data-remove="${i}" aria-label="Remove">×</button>
          </div>
        </div>`).join('');
    }

    async function addFiles(files) {
      work.hidden = false;
      analytics?.started();
      for (const file of files) {
        try {
          const probe = await decodeImage(file);
          const url = URL.createObjectURL(file);
          urls.push(url);
          items.push({ file, w: probe.width, h: probe.height, url });
          probe.close();
        } catch {
          analytics?.error('decode_failed');
        }
      }
      render();
    }

    this._cleanup.push(attachFileInput(zone, input, addFiles));

    list.addEventListener('click', (e) => {
      const t = e.target;
      const move = (from, to) => {
        if (to < 0 || to >= items.length) return;
        const [it] = items.splice(from, 1);
        items.splice(to, 0, it);
        render();
      };
      if (t.dataset.up != null) move(Number(t.dataset.up), Number(t.dataset.up) - 1);
      else if (t.dataset.down != null) move(Number(t.dataset.down), Number(t.dataset.down) + 1);
      else if (t.dataset.remove != null) { items.splice(Number(t.dataset.remove), 1); render(); }
    });

    let dragIndex = null;
    list.addEventListener('dragstart', (e) => {
      const row = e.target.closest('[data-i]');
      if (row) { dragIndex = Number(row.dataset.i); row.classList.add('is-dragging'); }
    });
    list.addEventListener('dragend', (e) => e.target.closest('[data-i]')?.classList.remove('is-dragging'));
    list.addEventListener('dragover', (e) => e.preventDefault());
    list.addEventListener('drop', (e) => {
      e.preventDefault();
      const row = e.target.closest('[data-i]');
      if (!row || dragIndex == null) return;
      const [it] = items.splice(dragIndex, 1);
      items.splice(Number(row.dataset.i), 0, it);
      dragIndex = null;
      render();
    });

    margin.addEventListener('input', () => {
      container.querySelector('#ip-margin-out').textContent = `${margin.value} pt`;
    });

    container.querySelector('#ip-go').addEventListener('click', async () => {
      errorEl.hidden = true;
      if (!items.length) {
        errorEl.hidden = false;
        errorEl.textContent = 'Add at least one image.';
        return;
      }
      try {
        // pdf-lib embeds JPEG and PNG only, so anything else (WebP, AVIF,
        // BMP) is re-encoded to PNG first rather than failing.
        const prepared = [];
        for (const item of items) {
          const isJpeg = /jpe?g/.test(item.file.type);
          const isPng = item.file.type === MIME.png;
          if (isJpeg || isPng) {
            prepared.push({ bytes: await item.file.arrayBuffer(), type: item.file.type });
          } else {
            const res = await transformImage({ file: item.file, type: MIME.png });
            prepared.push({ bytes: await res.blob.arrayBuffer(), type: MIME.png });
          }
        }

        const bytes = await imagesToPdf(prepared, {
          pageSize: container.querySelector('#ip-size').value,
          orientation: container.querySelector('#ip-orient').value,
          margin: Number(margin.value),
        });
        const blob = pdfBlob(bytes);
        const name = (container.querySelector('#ip-name').value || 'images.pdf').replace(/(\.pdf)?$/i, '.pdf');
        downloadBlob(blob, name);
        analytics?.completed({ fileCount: items.length, bytesOut: blob.size });
        analytics?.downloaded({ fileCount: 1, bytesOut: blob.size });
      } catch (err) {
        errorEl.hidden = false;
        errorEl.textContent = `Could not build the PDF: ${err.message}`;
        analytics?.error('pdf_build_failed');
      }
    });

    container.querySelector('#ip-clear').addEventListener('click', () => {
      for (const u of urls.splice(0)) URL.revokeObjectURL(u);
      items = [];
      work.hidden = true;
      list.innerHTML = '';
    });
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    for (const u of this._urls ?? []) URL.revokeObjectURL(u);
    this._cleanup = [];
    this._urls = [];
  },
};
