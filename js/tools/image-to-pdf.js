/* ============================================================
   Image to PDF — photos and scans in, one document out.

   JPEG and PNG are embedded untouched (EXIF orientation is applied by
   the placement matrix, not by re-encoding). WebP, GIF, BMP, AVIF and
   HEIC (where the browser can decode it) are converted first. Same
   workspace as the other PDF tools: page grid, side panel, progress.
   ============================================================ */

import { attachFileInput, dropZone } from '../lib/file-engine.js';
import {
  PageGrid, runTask, icon, esc, segmented, bindSegmented, downloadBytes, notify, pickFiles, uid,
} from '../lib/pdf/workspace.js';
import { PAGE_SIZES, humanBytes, checkAbort, tick, normRot } from '../lib/pdf/core.js';
import { buildImagesPdf, prepareImage, layoutImagePage, QUALITY_PRESETS, displaySize } from '../lib/pdf/images.js';
import { getToolSettings } from '../lib/tool-settings.js';

const MARGINS = { none: 0, small: 18, normal: 36, large: 60 };
const ACCEPT = 'image/*,.heic,.heif,.avif,.webp';

async function thumbnailFor(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const w = bitmap.width, h = bitmap.height;
  const s = Math.min(1, 320 / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  bitmap.close?.();
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
  c.width = c.height = 0;
  return { url: URL.createObjectURL(blob), w, h };
}

export default {
  async render(container, { analytics, artifact } = {}) {
    this._cleanup = [];
    const prefs = getToolSettings('image-to-pdf');
    const urls = new Set();
    this._urls = urls;

    const opts = {
      pageSize: prefs.pageSize || 'a4',
      orientation: 'auto',
      margin: prefs.margin || 'normal',
      fit: 'contain',
      quality: prefs.quality || 'original',
    };

    container.innerHTML = `
      <div class="pw" data-tool="images" style="--pw-thumb:124px">
        ${dropZone('ip-zone', { label: 'Drop photos or scans', hint: 'JPEG, PNG, WebP, GIF, BMP, AVIF · HEIC where your browser supports it', accept: ACCEPT })}
        <div class="pw-work" id="ip-work" hidden>
          <header class="pw-head">
            <div class="pw-file">${icon('image', 20)}<div class="pw-file-text"><strong>Images to PDF</strong><span id="ip-meta"></span></div></div>
            <div class="pw-head-actions">
              <button type="button" class="btn btn-secondary btn-sm" id="ip-add">${icon('plus', 15)}<span>Add images</span></button>
              <button type="button" class="btn btn-ghost btn-sm" id="ip-clear">Clear</button>
            </div>
          </header>
          <div class="pw-body">
            <section class="pw-main">
              <div class="pw-toolbar" role="toolbar" aria-label="Images">
                <div class="pw-tgroup">
                  <button type="button" class="pw-tbtn pw-icon-btn" data-t="left" title="Move earlier" aria-label="Move selected earlier">${icon('left', 16)}</button>
                  <button type="button" class="pw-tbtn pw-icon-btn" data-t="right" title="Move later" aria-label="Move selected later">${icon('right', 16)}</button>
                  <button type="button" class="pw-tbtn pw-icon-btn" data-t="rotate" title="Rotate" aria-label="Rotate selected">${icon('rotateCw', 16)}</button>
                  <button type="button" class="pw-tbtn pw-icon-btn" data-t="delete" title="Remove" aria-label="Remove selected">${icon('trash', 16)}</button>
                </div>
                <div class="pw-tgroup">
                  <button type="button" class="pw-tbtn" data-t="sort">Sort by name</button>
                </div>
                <span class="pw-tstatus" id="ip-status"></span>
              </div>
              <div id="ip-grid"></div>
            </section>
            <aside class="pw-side">
              <div class="pw-panel">
                <h3 class="pw-panel-title">Page setup</h3>
                <div class="pw-layout" id="ip-preview" aria-hidden="true"></div>
                <label class="pw-field"><span>Page size</span>
                  <select class="tool-select" id="ip-size">
                    ${Object.entries(PAGE_SIZES).map(([k, v]) => `<option value="${k}"${k === opts.pageSize ? ' selected' : ''}>${v.label}</option>`).join('')}
                    <option value="fit"${opts.pageSize === 'fit' ? ' selected' : ''}>Fit to each image</option>
                  </select></label>
                <div class="pw-field"><span>Orientation</span>${segmented('orientation', [['auto', 'Auto'], ['portrait', 'Portrait'], ['landscape', 'Landscape']], opts.orientation)}</div>
                <div class="pw-field"><span>Margin</span>${segmented('margin', [['none', 'None'], ['small', 'Small'], ['normal', 'Normal'], ['large', 'Large']], opts.margin)}</div>
                <div class="pw-field"><span>Placement</span>${segmented('fit', [['contain', 'Fit whole image'], ['cover', 'Fill page']], opts.fit)}</div>
                <label class="pw-field"><span>Image quality</span>
                  <select class="tool-select" id="ip-quality">
                    ${Object.entries(QUALITY_PRESETS).map(([k, v]) => `<option value="${k}"${k === opts.quality ? ' selected' : ''}>${v.label}${k === 'original' ? ' (no re-encoding)' : ''}</option>`).join('')}
                  </select></label>
              </div>
              <div class="pw-panel">
                <label class="pw-field"><span>File name</span>
                  <input type="text" class="tool-input" id="ip-name" value="images.pdf" spellcheck="false"></label>
                <button type="button" class="btn btn-primary pw-go" id="ip-go">${icon('download', 16)}<span>Create PDF</span></button>
                <p class="pw-note" id="ip-note"></p>
              </div>
            </aside>
          </div>
        </div>
      </div>`;

    const root = container.querySelector('.pw');
    const zone = container.querySelector('#ip-zone');
    const work = container.querySelector('#ip-work');
    const goBtn = container.querySelector('#ip-go');

    const grid = new PageGrid(container.querySelector('#ip-grid'), {
      actions: ['rotate', 'delete'],
      label: (p) => p.name,
      onChange: () => update(),
      onOpen: (p) => grid.select([p.id]),
    });

    function update() {
      const items = grid.pages;
      const size = items.reduce((s, p) => s + p.size, 0);
      container.querySelector('#ip-meta').textContent = `${items.length} image${items.length === 1 ? '' : 's'} · ${humanBytes(size)}`;
      container.querySelector('#ip-status').textContent = grid.selected.size ? `${grid.selected.size} selected` : 'Drag to reorder';
      goBtn.disabled = !items.length;
      goBtn.querySelector('span').textContent = items.length ? `Create PDF · ${items.length} page${items.length === 1 ? '' : 's'}` : 'Create PDF';
      renderPreview();
      if (!items.length) { work.hidden = true; zone.hidden = false; }
    }

    function renderPreview() {
      const el = container.querySelector('#ip-preview');
      const p = grid.getSelected()[0] || grid.pages[0];
      if (!p) { el.innerHTML = ''; return; }
      const up = displaySize(p.w, p.h, 1, normRot(p.rotate) / 90);
      const L = layoutImagePage(up.width, up.height, { pageSize: opts.pageSize, orientation: opts.orientation, margin: MARGINS[opts.margin], fit: opts.fit });
      const H = 150, s = H / L.pageH;
      const W = L.pageW * s;
      const turned = normRot(p.rotate) % 180 !== 0;
      el.innerHTML = `<div class="pw-layout-page" style="width:${W.toFixed(1)}px;height:${H}px">
          <div class="pw-layout-img${turned ? ' is-turned' : ''}" style="left:${(L.x * s).toFixed(1)}px;bottom:${(L.y * s).toFixed(1)}px;width:${(L.w * s).toFixed(1)}px;height:${(L.h * s).toFixed(1)}px;--rot:${normRot(p.rotate)}deg;--ar:${(up.width / up.height).toFixed(4)}"><img src="${esc(p.url)}" alt=""></div>
        </div>
        <span class="pw-layout-cap">${opts.pageSize === 'fit' ? 'Page matches image' : `${PAGE_SIZES[opts.pageSize].label} ${L.pageW > L.pageH ? 'landscape' : 'portrait'}`}</span>`;
    }

    async function addFiles(list) {
      const files = [...list].filter(f => /^image\//.test(f.type) || /\.(heic|heif|avif|webp|jpe?g|png|gif|bmp)$/i.test(f.name));
      if (!files.length) return;
      analytics?.started();
      await runTask(root, `Reading ${files.length} image${files.length === 1 ? '' : 's'}`, async ({ signal, progress }) => {
        const added = [];
        for (let i = 0; i < files.length; i++) {
          checkAbort(signal);
          const file = files[i];
          try {
            const t = await thumbnailFor(file);
            urls.add(t.url);
            added.push({ id: uid('i'), file, url: t.url, w: t.w, h: t.h, rotate: 0, baseRot: 0, name: file.name, size: file.size, src: 'img', index: i });
          } catch {
            notify(/\.hei[cf]$/i.test(file.name) ? `${file.name}: this browser cannot decode HEIC. Safari can; or export it as JPEG.` : `${file.name} could not be read as an image.`, 'error');
            analytics?.error('decode_failed');
          }
          progress((i + 1) / files.length);
          if (i % 3 === 2) await tick();
        }
        if (added.length) {
          if (!grid.pages.length && added.length === 1) container.querySelector('#ip-name').value = added[0].name.replace(/\.[^.]+$/, '') + '.pdf';
          grid.insertAt(grid.pages.length, added);
          zone.hidden = true;
          work.hidden = false;
        }
        update();
      });
    }
    this._load = addFiles;

    this._cleanup.push(attachFileInput(zone, container.querySelector('#ip-zone-input'), addFiles));

    container.querySelector('#ip-add').addEventListener('click', async () => addFiles(await pickFiles({ accept: ACCEPT, multiple: true })));
    container.querySelector('#ip-clear').addEventListener('click', () => {
      for (const u of urls) URL.revokeObjectURL(u);
      urls.clear();
      grid.setPages([], { keepSelection: false });
      update();
    });

    container.querySelector('.pw-toolbar').addEventListener('click', (e) => {
      const t = e.target.closest('[data-t]')?.dataset.t;
      if (!t) return;
      if (t === 'sort') {
        const coll = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
        grid.mutate(pages => pages.sort((a, b) => coll.compare(a.name, b.name)));
        return;
      }
      const ids = [...grid.selected];
      if (!ids.length) { notify('Select images first.'); return; }
      if (t === 'left') grid.shift(ids, -1);
      else if (t === 'right') grid.shift(ids, 1);
      else if (t === 'rotate') grid.rotate(ids, 90);
      else if (t === 'delete') {
        for (const p of grid.getSelected()) { URL.revokeObjectURL(p.url); urls.delete(p.url); }
        grid.remove(ids);
      }
    });

    bindSegmented(root, (name, v) => { opts[name] = v; renderPreview(); });
    container.querySelector('#ip-size').addEventListener('change', (e) => { opts.pageSize = e.target.value; renderPreview(); });
    container.querySelector('#ip-quality').addEventListener('change', (e) => {
      opts.quality = e.target.value;
      container.querySelector('#ip-note').textContent = opts.quality === 'original' ? '' : `Images are re-encoded as JPEG (longest side ${QUALITY_PRESETS[opts.quality].max}px).`;
    });

    goBtn.addEventListener('click', async () => {
      const items = grid.pages;
      if (!items.length) return;
      const name = (container.querySelector('#ip-name').value.trim() || 'images.pdf').replace(/(\.pdf)?$/i, '.pdf');
      await runTask(root, 'Creating PDF', async ({ signal, progress }) => {
        const prepared = [];
        for (let i = 0; i < items.length; i++) {
          checkAbort(signal);
          progress((i / items.length) * 0.75, `Preparing image ${i + 1} of ${items.length}`);
          const im = await prepareImage(items[i].file, { quality: opts.quality });
          prepared.push({ bytes: im.bytes, type: im.type, width: im.width, height: im.height, orientation: im.orientation, turns: normRot(items[i].rotate) / 90 });
          await tick();
        }
        const bytes = await buildImagesPdf(prepared, {
          pageSize: opts.pageSize, orientation: opts.orientation, margin: MARGINS[opts.margin], fit: opts.fit,
          title: name.replace(/\.pdf$/i, ''),
        }, { signal, onProgress: (f) => progress(0.75 + f * 0.25, 'Building PDF') });
        const size = downloadBytes(bytes, name, 'application/pdf');
        notify(`Saved ${name} (${items.length} page${items.length === 1 ? '' : 's'}, ${humanBytes(size)}).`, 'success');
        analytics?.completed({ fileCount: items.length, bytesOut: size });
        analytics?.downloaded({ fileCount: 1, bytesOut: size });
      });
    });

    const incoming = artifact || this._incomingArtifact;
    if (incoming) this.setArtifact(incoming);
  },

  async setArtifact(incoming) {
    if (!incoming || incoming === this._lastArtifact) return;
    this._incomingArtifact = incoming;
    const blob = incoming.blob || (incoming.content instanceof Blob ? incoming.content : null);
    if (!blob || !/^image\//.test(blob.type || '') || !this._load) return;
    this._lastArtifact = incoming;
    await this._load([new File([blob], incoming.name || 'image', { type: blob.type })]);
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    for (const u of this._urls ?? []) URL.revokeObjectURL(u);
    this._cleanup = [];
    this._urls = null;
    this._load = null;
    this._lastArtifact = this._incomingArtifact = null;
  },
};
