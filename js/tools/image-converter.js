/* Image Converter — format changes, including HEIC-ish inputs the browser can decode. */

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
    const LABEL = { [MIME.png]: 'PNG', [MIME.jpeg]: 'JPEG', [MIME.webp]: 'WebP', [MIME.avif]: 'AVIF' };

    container.innerHTML = `
      ${dropZone('cv-zone', { label: 'Drop images to convert', accept: 'image/*' })}
      <div id="cv-work" hidden>
        <div class="tool-controls fz-controls">
          <label class="fz-ctl"><span>Convert to</span>
            <select class="tool-select" id="cv-format">
              ${outputs.map(t => `<option value="${t}"${t === MIME.webp ? ' selected' : ''}>${LABEL[t] ?? t}</option>`).join('')}
            </select></label>
          <label class="fz-ctl" id="cv-q-wrap"><span>Quality</span>
            <input type="range" id="cv-quality" class="tool-range" min="40" max="100" value="90">
            <output id="cv-quality-out">90%</output></label>
          <label class="fz-ctl" id="cv-bg-wrap"><span>Background</span>
            <input type="color" id="cv-bg" class="tool-input" value="#ffffff"></label>
        </div>
        <p class="biz-hint" id="cv-note"></p>
        <div class="fz-list" id="cv-list"></div>
        <div class="tool-controls">
          <button class="btn btn-primary" id="cv-download">Download all</button>
          <button class="btn btn-secondary btn-sm" id="cv-clear">Clear</button>
        </div>
      </div>`;

    const zone = container.querySelector('#cv-zone');
    const input = container.querySelector('#cv-zone-input');
    const work = container.querySelector('#cv-work');
    const list = container.querySelector('#cv-list');
    const fmt = container.querySelector('#cv-format');
    const quality = container.querySelector('#cv-quality');
    const bg = container.querySelector('#cv-bg');
    const note = container.querySelector('#cv-note');

    let items = [];
    let runToken = 0;
    const revokeAll = () => { for (const u of urls.splice(0)) URL.revokeObjectURL(u); };

    function syncControls() {
      const lossless = fmt.value === MIME.png;
      container.querySelector('#cv-q-wrap').style.display = lossless ? 'none' : '';
      // Only JPEG genuinely lacks an alpha channel.
      const flattens = fmt.value === MIME.jpeg;
      container.querySelector('#cv-bg-wrap').style.display = flattens ? '' : 'none';
      note.textContent = flattens
        ? 'JPEG has no transparency, so transparent areas are filled with the background colour.'
        : lossless ? 'PNG is lossless — file size depends on the image, not a quality setting.' : '';
    }

    async function process() {
      const token = ++runToken;
      for (const item of items) {
        if (token !== runToken) return;
        try {
          const res = await transformImage({
            file: item.file, type: fmt.value,
            quality: Number(quality.value) / 100,
            background: fmt.value === MIME.jpeg ? bg.value : undefined,
          });
          item.blob = res.blob; item.outW = res.width; item.outH = res.height; item.error = null;
        } catch (err) {
          item.error = err.message; item.blob = null;
          analytics?.error('encode_failed');
        }
      }
      if (token === runToken) render();
    }

    function render() {
      revokeAll();
      list.innerHTML = items.map((item, i) => {
        if (item.error) return `<div class="fz-row fz-row-error"><span class="fz-name">${item.file.name}</span><span class="fz-err">${item.error}</span></div>`;
        if (!item.blob) return `<div class="fz-row"><span class="fz-name">${item.file.name}</span><span class="fz-meta">working…</span></div>`;
        const url = URL.createObjectURL(item.blob);
        urls.push(url);
        const fromExt = (EXT_FOR[item.file.type] ?? item.file.name.split('.').pop() ?? '?').toUpperCase();
        const toExt = (EXT_FOR[item.blob.type] ?? '?').toUpperCase();
        return `
          <div class="fz-row">
            <img class="fz-thumb" src="${url}" alt="">
            <div class="fz-name">
              <strong>${item.file.name}</strong>
              <span class="fz-meta">${fromExt} → <b>${toExt}</b> · ${item.outW}×${item.outH} · ${humanBytes(item.file.size)} → ${humanBytes(item.blob.size)}</span>
            </div>
            <button class="btn btn-sm" data-dl="${i}">Save</button>
          </div>`;
      }).join('');
    }

    async function addFiles(files) {
      work.hidden = false;
      analytics?.started();
      for (const file of files) {
        try { const p = await decodeImage(file); items.push({ file, w: p.width, h: p.height }); p.close(); }
        catch { items.push({ file, error: 'This browser cannot decode that format' }); }
      }
      render();
      await process();
      const ok = items.filter(i => i.blob);
      if (ok.length) analytics?.completed({ fileCount: ok.length, outputKind: 'image' });
    }

    this._cleanup.push(attachFileInput(zone, input, addFiles));

    let debounce;
    for (const el of [fmt, quality, bg]) {
      el.addEventListener('input', () => {
        if (el === quality) container.querySelector('#cv-quality-out').textContent = `${quality.value}%`;
        syncControls();
        clearTimeout(debounce);
        debounce = setTimeout(process, 180);
      });
    }

    list.addEventListener('click', (e) => {
      const idx = e.target.dataset.dl;
      if (idx == null) return;
      const item = items[Number(idx)];
      if (!item?.blob) return;
      downloadBlob(item.blob, renameExt(item.file.name, EXT_FOR[item.blob.type] ?? 'img'));
      analytics?.downloaded({ fileCount: 1 });
    });

    container.querySelector('#cv-download').addEventListener('click', () => {
      const ready = items.filter(i => i.blob);
      for (const item of ready) downloadBlob(item.blob, renameExt(item.file.name, EXT_FOR[item.blob.type] ?? 'img'));
      if (ready.length) analytics?.downloaded({ fileCount: ready.length });
    });

    container.querySelector('#cv-clear').addEventListener('click', () => {
      revokeAll(); items = []; work.hidden = true; list.innerHTML = '';
    });

    syncControls();
    this._revoke = revokeAll;
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    this._revoke?.();
    this._cleanup = [];
  },
};
