/* Image Cropper — drag a selection, or lock it to a ratio. */

import {
  MIME, EXT_FOR, transformImage, decodeImage, humanBytes,
  downloadBlob, renameExt, attachFileInput, dropZone,
} from '../lib/file-engine.js';

const RATIOS = [
  { id: 'free', label: 'Freeform', v: null },
  { id: '1:1',  label: 'Square 1:1', v: 1 },
  { id: '4:3',  label: 'Standard 4:3', v: 4 / 3 },
  { id: '3:2',  label: 'Photo 3:2', v: 3 / 2 },
  { id: '16:9', label: 'Widescreen 16:9', v: 16 / 9 },
  { id: '9:16', label: 'Story 9:16', v: 9 / 16 },
];

export default {
  async render(container, { analytics } = {}) {
    this._cleanup = [];
    // Closure-scoped: `this` is undefined inside the plain function

    // declarations below, so these must not go through `this`.

    const urls = [];

    this._urls = urls;

    container.innerHTML = `
      ${dropZone('cr-zone', { label: 'Drop an image to crop', accept: 'image/*', multiple: false })}
      <div id="cr-work" hidden>
        <div class="tool-controls fz-controls">
          <label class="fz-ctl"><span>Ratio</span>
            <select class="tool-select" id="cr-ratio">
              ${RATIOS.map(r => `<option value="${r.id}">${r.label}</option>`).join('')}
            </select></label>
          <button class="btn btn-sm" id="cr-reset">Reset selection</button>
        </div>
        <div class="cr-stage" id="cr-stage">
          <img id="cr-img" alt="">
          <div class="cr-sel" id="cr-sel">
            <span class="cr-handle" data-h="nw"></span><span class="cr-handle" data-h="ne"></span>
            <span class="cr-handle" data-h="sw"></span><span class="cr-handle" data-h="se"></span>
          </div>
        </div>
        <div class="fz-summary" id="cr-info"></div>
        <div class="tool-controls">
          <button class="btn btn-primary" id="cr-save">Crop &amp; download</button>
          <button class="btn btn-secondary btn-sm" id="cr-clear">Choose another</button>
        </div>
      </div>`;

    const zone  = container.querySelector('#cr-zone');
    const input = container.querySelector('#cr-zone-input');
    const work  = container.querySelector('#cr-work');
    const stage = container.querySelector('#cr-stage');
    const imgEl = container.querySelector('#cr-img');
    const selEl = container.querySelector('#cr-sel');
    const info  = container.querySelector('#cr-info');
    const ratioSel = container.querySelector('#cr-ratio');

    let file = null;
    let natural = { w: 0, h: 0 };
    /** Selection in natural image pixels. */
    let sel = { x: 0, y: 0, w: 0, h: 0 };

    const ratio = () => RATIOS.find(r => r.id === ratioSel.value)?.v ?? null;

    /** Displayed pixels per natural pixel. */
    const scale = () => (imgEl.clientWidth || 1) / (natural.w || 1);

    function clampSel() {
      sel.w = Math.max(8, Math.min(sel.w, natural.w));
      sel.h = Math.max(8, Math.min(sel.h, natural.h));
      sel.x = Math.max(0, Math.min(sel.x, natural.w - sel.w));
      sel.y = Math.max(0, Math.min(sel.y, natural.h - sel.h));
    }

    function applyRatio(anchor = 'se') {
      const r = ratio();
      if (!r) return;
      // Height follows width, then correct if that overflowed the image.
      let w = sel.w;
      let h = w / r;
      if (h > natural.h) { h = natural.h; w = h * r; }
      if (anchor.includes('n')) sel.y = sel.y + sel.h - h;
      if (anchor.includes('w')) sel.x = sel.x + sel.w - w;
      sel.w = w; sel.h = h;
      clampSel();
    }

    function paint() {
      const s = scale();
      selEl.style.left   = `${sel.x * s}px`;
      selEl.style.top    = `${sel.y * s}px`;
      selEl.style.width  = `${sel.w * s}px`;
      selEl.style.height = `${sel.h * s}px`;
      info.innerHTML = `
        <div class="fz-stat"><span class="fz-stat-v">${Math.round(sel.w)}×${Math.round(sel.h)}</span><span class="fz-stat-l">Crop size</span></div>
        <div class="fz-stat"><span class="fz-stat-v">${Math.round(sel.x)}, ${Math.round(sel.y)}</span><span class="fz-stat-l">Offset</span></div>
        <div class="fz-stat"><span class="fz-stat-v">${natural.w}×${natural.h}</span><span class="fz-stat-l">Original</span></div>`;
    }

    function resetSel() {
      const r = ratio();
      if (r) {
        let w = natural.w, h = w / r;
        if (h > natural.h) { h = natural.h; w = h * r; }
        sel = { x: (natural.w - w) / 2, y: (natural.h - h) / 2, w, h };
      } else {
        sel = { x: natural.w * 0.1, y: natural.h * 0.1, w: natural.w * 0.8, h: natural.h * 0.8 };
      }
      clampSel();
      paint();
    }

    /* Pointer drag: move the selection, or resize from a corner handle. */
    let drag = null;
    const onDown = (e) => {
      const handle = e.target.closest('.cr-handle');
      const inside = e.target === selEl || handle;
      const rect = imgEl.getBoundingClientRect();
      const s = scale();
      const px = (e.clientX - rect.left) / s;
      const py = (e.clientY - rect.top) / s;

      if (handle) drag = { kind: 'resize', corner: handle.dataset.h, start: { ...sel } };
      else if (inside) drag = { kind: 'move', dx: px - sel.x, dy: py - sel.y };
      else drag = { kind: 'new', ox: px, oy: py };

      stage.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    };

    const onMove = (e) => {
      if (!drag) return;
      const rect = imgEl.getBoundingClientRect();
      const s = scale();
      const px = Math.max(0, Math.min((e.clientX - rect.left) / s, natural.w));
      const py = Math.max(0, Math.min((e.clientY - rect.top) / s, natural.h));

      if (drag.kind === 'move') {
        sel.x = px - drag.dx;
        sel.y = py - drag.dy;
      } else if (drag.kind === 'new') {
        sel.x = Math.min(drag.ox, px);
        sel.y = Math.min(drag.oy, py);
        sel.w = Math.abs(px - drag.ox);
        sel.h = Math.abs(py - drag.oy);
        applyRatio('se');
      } else {
        const s0 = drag.start;
        const right = s0.x + s0.w;
        const bottom = s0.y + s0.h;
        if (drag.corner.includes('e')) sel.w = px - s0.x;
        if (drag.corner.includes('s')) sel.h = py - s0.y;
        if (drag.corner.includes('w')) { sel.x = px; sel.w = right - px; }
        if (drag.corner.includes('n')) { sel.y = py; sel.h = bottom - py; }
        applyRatio(drag.corner);
      }
      clampSel();
      paint();
    };

    const onUp = () => { drag = null; };

    stage.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    this._cleanup.push(() => {
      stage.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    });

    const onResize = () => paint();
    window.addEventListener('resize', onResize);
    this._cleanup.push(() => window.removeEventListener('resize', onResize));

    async function load(files) {
      file = files[0];
      if (!file) return;
      analytics?.started();
      try {
        const probe = await decodeImage(file);
        natural = { w: probe.width, h: probe.height };
        probe.close();
      } catch {
        analytics?.error('decode_failed');
        return;
      }
      const url = URL.createObjectURL(file);
      urls.push(url);
      imgEl.src = url;
      await new Promise(r => { imgEl.onload = r; });
      work.hidden = false;
      resetSel();
    }

    this._cleanup.push(attachFileInput(zone, input, load));

    ratioSel.addEventListener('change', () => { resetSel(); });
    container.querySelector('#cr-reset').addEventListener('click', resetSel);

    container.querySelector('#cr-save').addEventListener('click', async () => {
      if (!file) return;
      try {
        const type = EXT_FOR[file.type] ? file.type : MIME.png;
        const res = await transformImage({
          file,
          crop: { x: Math.round(sel.x), y: Math.round(sel.y), w: Math.round(sel.w), h: Math.round(sel.h) },
          type, quality: 0.92,
        });
        downloadBlob(res.blob, renameExt(file.name, EXT_FOR[res.blob.type] ?? 'png', '-cropped'));
        analytics?.completed({ fileCount: 1, bytesOut: res.blob.size });
        analytics?.downloaded({ fileCount: 1 });
      } catch (err) {
        analytics?.error('encode_failed');
        info.innerHTML = `<p class="fz-err">${err.message}</p>`;
      }
    });

    container.querySelector('#cr-clear').addEventListener('click', () => {
      file = null;
      work.hidden = true;
      imgEl.removeAttribute('src');
    });
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    for (const u of this._urls ?? []) URL.revokeObjectURL(u);
    this._cleanup = [];
    this._urls = [];
  },
};
