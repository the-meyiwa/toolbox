/* Image Metadata — show what a photo quietly reveals, then strip it. */

import {
  MIME, EXT_FOR, readExif, transformImage, decodeImage, humanBytes,
  downloadBlob, renameExt, attachFileInput, dropZone,
} from '../lib/file-engine.js';

export default {
  async render(container, { analytics } = {}) {
    this._cleanup = [];
    // Closure-scoped: `this` is undefined inside the plain function

    // declarations below, so these must not go through `this`.

    const urls = [];

    this._urls = urls;

    container.innerHTML = `
      ${dropZone('mx-zone', { label: 'Drop a photo to inspect', accept: 'image/*' })}
      <div id="mx-work" hidden>
        <p class="biz-hint">Photos from a phone often carry the camera model, the exact time, and sometimes
          the GPS coordinates of where they were taken. Re-encoding the image drops all of it — the cleaned
          copy is the same picture with the tags gone.</p>
        <div class="fz-list" id="mx-list"></div>
        <div class="tool-controls">
          <button class="btn btn-primary" id="mx-strip">Download cleaned copies</button>
          <button class="btn btn-secondary btn-sm" id="mx-clear">Clear</button>
        </div>
      </div>`;

    const zone  = container.querySelector('#mx-zone');
    const input = container.querySelector('#mx-zone-input');
    const work  = container.querySelector('#mx-work');
    const list  = container.querySelector('#mx-list');

    let items = [];
    const revokeAll = () => { for (const u of urls.splice(0)) URL.revokeObjectURL(u); };

    function render() {
      revokeAll();
      list.innerHTML = items.map(item => {
        const url = URL.createObjectURL(item.file);
        urls.push(url);
        const e = item.exif;
        const rows = e?.tags?.length
          ? `<table class="mx-table">${e.tags.map(t => `<tr><td>${t.name}</td><td>${t.value}</td></tr>`).join('')}</table>`
          : '';
        const verdict = !e?.present
          ? '<span class="mx-clean">No EXIF metadata found</span>'
          : e.gps
            ? '<span class="mx-warn">Contains GPS location</span>'
            : `<span class="mx-note">Contains ${e.tags.length} metadata field${e.tags.length === 1 ? '' : 's'}</span>`;
        return `
          <div class="fz-row fz-row-block">
            <img class="fz-thumb fz-thumb-lg" src="${url}" alt="">
            <div class="fz-name">
              <strong>${item.file.name}</strong>
              <span class="fz-meta">${item.w || '?'}×${item.h || '?'} · ${humanBytes(item.file.size)}</span>
              <div class="mx-verdict">${verdict}</div>
              ${rows}
            </div>
          </div>`;
      }).join('');
    }

    async function addFiles(files) {
      work.hidden = false;
      analytics?.started();
      let sawGps = false;
      for (const file of files) {
        let w = 0, h = 0;
        try { const p = await decodeImage(file); w = p.width; h = p.height; p.close(); } catch { /* still list it */ }
        const exif = await readExif(file);
        if (exif.gps) sawGps = true;
        items.push({ file, w, h, exif });
      }
      render();
      analytics?.completed({ fileCount: items.length, resultCount: sawGps ? 1 : 0 });
    }

    this._cleanup.push(attachFileInput(zone, input, addFiles));

    container.querySelector('#mx-strip').addEventListener('click', async () => {
      let n = 0;
      for (const item of items) {
        try {
          // Canvas output carries no EXIF, so a straight re-encode is the strip.
          const type = item.file.type === MIME.png ? MIME.png : MIME.jpeg;
          const res = await transformImage({ file: item.file, type, quality: 0.94 });
          downloadBlob(res.blob, renameExt(item.file.name, EXT_FOR[res.blob.type] ?? 'jpg', '-clean'));
          n++;
        } catch { analytics?.error('encode_failed'); }
      }
      if (n) analytics?.downloaded({ fileCount: n });
    });

    container.querySelector('#mx-clear').addEventListener('click', () => {
      revokeAll(); items = []; work.hidden = true; list.innerHTML = '';
    });

    this._revoke = revokeAll;
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    this._revoke?.();
    this._cleanup = [];
  },
};
