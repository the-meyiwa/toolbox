/* Image Compressor — quality/size trade-off with a real before-and-after. */

import {
  MIME, EXT_FOR, transformImage, decodeImage, humanBytes,
  downloadBlob, renameExt, attachFileInput, dropZone, supportedOutputs,
} from '../lib/file-engine.js';

export default {
  async render(container, { analytics } = {}) {
    this._cleanup = [];
    // Object-URL bookkeeping stays in the closure: the plain function
    // declarations below have no `this` of their own to reach it through.
    const urls = [];

    const outputs = await supportedOutputs();
    const canWebp = outputs.includes(MIME.webp);

    container.innerHTML = `
      ${dropZone('ic-zone', { label: 'Drop images here', accept: 'image/*' })}
      <div id="ic-work" hidden>
        <div class="tool-controls fz-controls">
          <label class="fz-ctl"><span>Quality</span>
            <input type="range" id="ic-quality" class="tool-range" min="30" max="95" value="75">
            <output id="ic-quality-out">75%</output></label>
          <label class="fz-ctl"><span>Max width</span>
            <select class="tool-select" id="ic-maxw">
              <option value="0">Keep original</option>
              <option value="2560">2560 px</option>
              <option value="1920" selected>1920 px</option>
              <option value="1280">1280 px</option>
              <option value="1024">1024 px</option>
              <option value="640">640 px</option>
            </select></label>
          <label class="fz-ctl"><span>Format</span>
            <select class="tool-select" id="ic-format">
              <option value="keep">Keep original</option>
              <option value="${MIME.jpeg}">JPEG</option>
              ${canWebp ? `<option value="${MIME.webp}" selected>WebP (smallest)</option>` : ''}
              <option value="${MIME.png}">PNG</option>
            </select></label>
        </div>
        <div class="fz-summary" id="ic-summary"></div>
        <div class="fz-list" id="ic-list"></div>
        <div class="tool-controls">
          <button class="btn btn-primary" id="ic-download">Download all</button>
          <button class="btn btn-secondary btn-sm" id="ic-clear">Clear</button>
        </div>
      </div>`;

    const zone = container.querySelector('#ic-zone');
    const input = container.querySelector('#ic-zone-input');
    const work = container.querySelector('#ic-work');
    const list = container.querySelector('#ic-list');
    const summary = container.querySelector('#ic-summary');
    const quality = container.querySelector('#ic-quality');
    const maxw = container.querySelector('#ic-maxw');
    const format = container.querySelector('#ic-format');

    /** @type {Array<{file: File, w: number, h: number, blob?: Blob, url?: string, error?: string}>} */
    let items = [];
    let runToken = 0;

    const revokeAll = () => { for (const u of urls.splice(0)) URL.revokeObjectURL(u); };

    async function process() {
      if (!items.length) return;
      const token = ++runToken;
      const q = Number(quality.value) / 100;
      const cap = Number(maxw.value) || 0;
      const chosen = format.value;

      for (const item of items) {
        if (token !== runToken) return;                 // a newer run supersedes this one
        try {
          const type = chosen === 'keep'
            ? (EXT_FOR[item.file.type] ? item.file.type : MIME.jpeg)
            : chosen;
          const width = cap && item.w > cap ? cap : undefined;
          const height = width ? Math.round(item.h * (width / item.w)) : undefined;
          const res = await transformImage({ file: item.file, type, quality: q, width, height });
          item.blob = res.blob;
          item.outW = res.width;
          item.outH = res.height;
          item.error = null;
        } catch (err) {
          item.error = err.message;
          item.blob = null;
          analytics?.error('encode_failed');
        }
      }
      if (token === runToken) render();
    }

    function render() {
      revokeAll();
      const done = items.filter(i => i.blob);
      const inBytes = items.reduce((s, i) => s + i.file.size, 0);
      const outBytes = done.reduce((s, i) => s + i.blob.size, 0);
      const saved = inBytes - outBytes;

      summary.innerHTML = done.length ? `
        <div class="fz-stat"><span class="fz-stat-v">${humanBytes(inBytes)}</span><span class="fz-stat-l">Before</span></div>
        <div class="fz-stat"><span class="fz-stat-v">${humanBytes(outBytes)}</span><span class="fz-stat-l">After</span></div>
        <div class="fz-stat"><span class="fz-stat-v">${saved > 0 ? '−' + Math.round(saved / inBytes * 100) + '%' : '+' + Math.round(-saved / inBytes * 100) + '%'}</span><span class="fz-stat-l">${saved > 0 ? 'Smaller' : 'Larger'}</span></div>
        <div class="fz-stat"><span class="fz-stat-v">${done.length}</span><span class="fz-stat-l">Image${done.length === 1 ? '' : 's'}</span></div>` : '';

      list.innerHTML = items.map((item, i) => {
        if (item.error) {
          return `<div class="fz-row fz-row-error"><span class="fz-name">${item.file.name}</span><span class="fz-err">${item.error}</span></div>`;
        }
        if (!item.blob) return `<div class="fz-row"><span class="fz-name">${item.file.name}</span><span class="fz-meta">working…</span></div>`;
        const url = URL.createObjectURL(item.blob);
        urls.push(url);
        const pct = Math.round((1 - item.blob.size / item.file.size) * 100);
        return `
          <div class="fz-row">
            <img class="fz-thumb" src="${url}" alt="">
            <div class="fz-name">
              <strong>${item.file.name}</strong>
              <span class="fz-meta">${item.outW}×${item.outH} · ${humanBytes(item.file.size)} → ${humanBytes(item.blob.size)}
                <b class="${pct >= 0 ? 'fz-good' : 'fz-bad'}">${pct >= 0 ? pct + '% smaller' : Math.abs(pct) + '% larger'}</b></span>
            </div>
            <button class="btn btn-sm" data-dl="${i}">Save</button>
          </div>`;
      }).join('');
    }

    async function addFiles(files) {
      work.hidden = false;
      analytics?.started();
      for (const file of files) {
        try {
          const probe = await decodeImage(file);
          items.push({ file, w: probe.width, h: probe.height });
          probe.close();
        } catch {
          items.push({ file, w: 0, h: 0, error: 'Not a readable image' });
        }
      }
      render();
      await process();
      const ok = items.filter(i => i.blob);
      if (ok.length) {
        analytics?.completed({
          fileCount: ok.length,
          bytesIn: items.reduce((s, i) => s + i.file.size, 0),
          bytesOut: ok.reduce((s, i) => s + i.blob.size, 0),
        });
      }
    }

    this._cleanup.push(attachFileInput(zone, input, addFiles));

    let debounce;
    for (const el of [quality, maxw, format]) {
      el.addEventListener('input', () => {
        if (el === quality) container.querySelector('#ic-quality-out').textContent = `${quality.value}%`;
        clearTimeout(debounce);
        debounce = setTimeout(process, 180);
      });
    }

    list.addEventListener('click', (e) => {
      const idx = e.target.dataset.dl;
      if (idx == null) return;
      const item = items[Number(idx)];
      if (!item?.blob) return;
      downloadBlob(item.blob, renameExt(item.file.name, EXT_FOR[item.blob.type] ?? 'jpg', '-compressed'));
      analytics?.downloaded({ fileCount: 1, bytesOut: item.blob.size });
    });

    container.querySelector('#ic-download').addEventListener('click', () => {
      const ready = items.filter(i => i.blob);
      for (const item of ready) {
        downloadBlob(item.blob, renameExt(item.file.name, EXT_FOR[item.blob.type] ?? 'jpg', '-compressed'));
      }
      if (ready.length) analytics?.downloaded({ fileCount: ready.length, bytesOut: ready.reduce((s, i) => s + i.blob.size, 0) });
    });

    container.querySelector('#ic-clear').addEventListener('click', () => {
      revokeAll();
      items = [];
      work.hidden = true;
      list.innerHTML = '';
      summary.innerHTML = '';
    });

    this._revoke = revokeAll;
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    this._revoke?.();
    this._cleanup = [];
  },
};
