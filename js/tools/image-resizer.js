/* Image Resizer — pixels, percentage, or fit-within, with ratio lock. */

import {
  MIME, EXT_FOR, transformImage, decodeImage, humanBytes, fitWithin,
  downloadBlob, renameExt, attachFileInput, dropZone,
} from '../lib/file-engine.js';

const PRESETS = [
  { id: 'none',   label: 'Custom' },
  { id: '1920',   label: 'Full HD — 1920 wide', w: 1920 },
  { id: '1280',   label: 'Web — 1280 wide', w: 1280 },
  { id: '800',    label: 'Email — 800 wide', w: 800 },
  { id: '1080s',  label: 'Instagram square — 1080 × 1080', w: 1080, h: 1080 },
  { id: '1200og', label: 'Open Graph — 1200 × 630', w: 1200, h: 630 },
  { id: '512',    label: 'Avatar — 512 × 512', w: 512, h: 512 },
];

export default {
  async render(container, { analytics } = {}) {
    this._cleanup = [];
    // Closure-scoped: `this` is undefined inside the plain function

    // declarations below, so these must not go through `this`.

    const urls = [];

    this._urls = urls;

    container.innerHTML = `
      ${dropZone('rs-zone', { label: 'Drop images to resize', accept: 'image/*' })}
      <div id="rs-work" hidden>
        <div class="tool-controls fz-controls">
          <label class="fz-ctl"><span>Preset</span>
            <select class="tool-select" id="rs-preset">
              ${PRESETS.map(p => `<option value="${p.id}">${p.label}</option>`).join('')}
            </select></label>
          <label class="fz-ctl"><span>Mode</span>
            <select class="tool-select" id="rs-mode">
              <option value="fit">Fit within (keeps the whole image)</option>
              <option value="exact">Exact size (may distort)</option>
              <option value="percent">Percentage</option>
            </select></label>
        </div>
        <div class="tool-controls fz-controls" id="rs-dims">
          <label class="fz-ctl"><span>Width</span><input type="number" class="tool-input" id="rs-w" min="1" step="1"></label>
          <label class="fz-ctl"><span>Height</span><input type="number" class="tool-input" id="rs-h" min="1" step="1"></label>
          <label class="tool-checkbox"><input type="checkbox" id="rs-lock" checked> <span>Lock aspect ratio</span></label>
        </div>
        <div class="tool-controls fz-controls" id="rs-pct" hidden>
          <label class="fz-ctl"><span>Scale</span>
            <input type="range" id="rs-scale" class="tool-range" min="5" max="200" value="50">
            <output id="rs-scale-out">50%</output></label>
        </div>
        <div class="fz-list" id="rs-list"></div>
        <div class="tool-controls">
          <button class="btn btn-primary" id="rs-download">Download all</button>
          <button class="btn btn-secondary btn-sm" id="rs-clear">Clear</button>
        </div>
      </div>`;

    const zone    = container.querySelector('#rs-zone');
    const input   = container.querySelector('#rs-zone-input');
    const work    = container.querySelector('#rs-work');
    const list    = container.querySelector('#rs-list');
    const preset  = container.querySelector('#rs-preset');
    const mode    = container.querySelector('#rs-mode');
    const wIn     = container.querySelector('#rs-w');
    const hIn     = container.querySelector('#rs-h');
    const lock    = container.querySelector('#rs-lock');
    const scale   = container.querySelector('#rs-scale');

    let items = [];
    let runToken = 0;
    const revokeAll = () => { for (const u of urls.splice(0)) URL.revokeObjectURL(u); };

    // The ratio comes from the first image, which is what the number boxes describe.
    const ratio = () => (items[0]?.h ? items[0].w / items[0].h : 1);

    function targetFor(item) {
      if (mode.value === 'percent') {
        const s = Number(scale.value) / 100;
        return { width: Math.max(1, Math.round(item.w * s)), height: Math.max(1, Math.round(item.h * s)) };
      }
      const w = Number(wIn.value) || item.w;
      const h = Number(hIn.value) || item.h;
      return mode.value === 'fit' ? fitWithin(item.w, item.h, w, h) : { width: w, height: h };
    }

    async function process() {
      const token = ++runToken;
      for (const item of items) {
        if (token !== runToken) return;
        if (item.error) continue;
        try {
          const { width, height } = targetFor(item);
          const type = EXT_FOR[item.file.type] ? item.file.type : MIME.png;
          const res = await transformImage({ file: item.file, width, height, type, quality: 0.9 });
          item.blob = res.blob; item.outW = res.width; item.outH = res.height;
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
        return `
          <div class="fz-row">
            <img class="fz-thumb" src="${url}" alt="">
            <div class="fz-name">
              <strong>${item.file.name}</strong>
              <span class="fz-meta">${item.w}×${item.h} → <b>${item.outW}×${item.outH}</b> · ${humanBytes(item.file.size)} → ${humanBytes(item.blob.size)}</span>
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
        catch { items.push({ file, w: 0, h: 0, error: 'Not a readable image' }); }
      }
      if (items[0]?.w && !wIn.value) { wIn.value = items[0].w; hIn.value = items[0].h; }
      render();
      await process();
      const ok = items.filter(i => i.blob);
      if (ok.length) analytics?.completed({ fileCount: ok.length });
    }

    this._cleanup.push(attachFileInput(zone, input, addFiles));

    let debounce;
    const rerun = () => { clearTimeout(debounce); debounce = setTimeout(process, 200); };

    preset.addEventListener('change', () => {
      const p = PRESETS.find(x => x.id === preset.value);
      if (!p?.w) return;
      wIn.value = p.w;
      hIn.value = p.h ?? Math.round(p.w / ratio());
      mode.value = p.h ? 'fit' : 'fit';
      container.querySelector('#rs-pct').hidden = true;
      container.querySelector('#rs-dims').hidden = false;
      rerun();
    });

    mode.addEventListener('change', () => {
      const pct = mode.value === 'percent';
      container.querySelector('#rs-pct').hidden = !pct;
      container.querySelector('#rs-dims').hidden = pct;
      rerun();
    });

    wIn.addEventListener('input', () => {
      if (lock.checked && mode.value === 'exact') hIn.value = Math.round(Number(wIn.value) / ratio()) || '';
      preset.value = 'none';
      rerun();
    });
    hIn.addEventListener('input', () => {
      if (lock.checked && mode.value === 'exact') wIn.value = Math.round(Number(hIn.value) * ratio()) || '';
      preset.value = 'none';
      rerun();
    });
    scale.addEventListener('input', () => {
      container.querySelector('#rs-scale-out').textContent = `${scale.value}%`;
      rerun();
    });

    const saveName = (item) => renameExt(item.file.name, EXT_FOR[item.blob.type] ?? 'png', `-${item.outW}x${item.outH}`);

    list.addEventListener('click', (e) => {
      const idx = e.target.dataset.dl;
      if (idx == null) return;
      const item = items[Number(idx)];
      if (!item?.blob) return;
      downloadBlob(item.blob, saveName(item));
      analytics?.downloaded({ fileCount: 1 });
    });

    container.querySelector('#rs-download').addEventListener('click', () => {
      const ready = items.filter(i => i.blob);
      for (const item of ready) downloadBlob(item.blob, saveName(item));
      if (ready.length) analytics?.downloaded({ fileCount: ready.length });
    });

    container.querySelector('#rs-clear').addEventListener('click', () => {
      revokeAll(); items = []; work.hidden = true; list.innerHTML = ''; wIn.value = ''; hIn.value = '';
    });

    this._revoke = revokeAll;
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    this._revoke?.();
    this._cleanup = [];
  },
};
