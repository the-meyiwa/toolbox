/* ============================================================
   File tool shell.

   The PDF, media and archive tools are one machine: choose files,
   set options, run a long job with progress and cancel, then save or
   preview what came out. A tool is a definition:

   makeFileTool({
     id, accept, dropLabel, dropHint,
     min: 1, max: 1,                 // how many files the job takes
     fields: [...] | (files) => [...],
     action: 'Convert',
     note: 'shown above the button',
     async run(files, values, { signal, progress }) → Result,
   })

   files: [{ file: File, name, size, bytes(): Promise<Uint8Array> }]
   Result: { files?: [{ name, data: Uint8Array|Blob, type? }], zipName?,
             html?, text?, preview?: 'images'|'video'|'audio', note? }
   ============================================================ */

import { attachFileInput, dropZone } from '../file-engine.js';
import { mountForm, esc, saveBlob, humanBytes, defaults, describeFields } from './form.js';
import { createZip } from '../pdf/zip.js';
import { copyText } from '../../utils.js';
import { actionsFor, actionsButton, publish, pickWork, kindOf } from '../interop.js';
import { icon } from '../icons.js';

export class Cancelled extends Error { constructor() { super('Cancelled'); this.name = 'AbortError'; this.cancelled = true; } }
export const checkAbort = (signal) => { if (signal?.aborted) throw new Cancelled(); };

const MIME = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm',
  mov: 'video/quicktime', mkv: 'video/x-matroska', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac',
  opus: 'audio/ogg', txt: 'text/plain', csv: 'text/csv', md: 'text/markdown', json: 'application/json', zip: 'application/zip', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
/** Artifact kinds an accept string covers, for the Recent & Files picker. */
function acceptKinds(accept) {
  const kinds = new Set();
  for (const a of accept.split(',').map((x) => x.trim().toLowerCase())) {
    if (a.startsWith('video')) kinds.add('video'); else if (a.startsWith('audio')) kinds.add('audio');
    else if (a.startsWith('image')) kinds.add('image'); else if (a.includes('pdf')) kinds.add('pdf');
    else if (a.startsWith('.')) kinds.add(kindOf(`x${a}`));
  }
  return kinds.size ? [...kinds] : null;
}

export const mimeOf = (name) => MIME[String(name).split('.').pop().toLowerCase()] || 'application/octet-stream';
const toBlob = (f) => (f.data instanceof Blob ? f.data : new Blob([f.data], { type: f.type || mimeOf(f.name) }));

export function makeFileTool(def) {
  const min = def.min ?? 1;
  const max = def.max ?? 1;

  const fieldsFor = (files) => (typeof def.fields === 'function' ? def.fields(files) : def.fields || []);

  return {
    ownFileChrome: true,

    /* ---- headless: the same job without the UI, for the Assistant and other tools ---- */

    describe() {
      return { kind: 'files', accept: def.accept || '*/*', minFiles: min, maxFiles: max, action: def.action || 'Run', options: describeFields(fieldsFor([])) };
    },

    /**
     * @param {{name: string, data: Uint8Array|Blob, type?: string}[]} inputs
     * @param {object} options field values; anything missing takes its default
     */
    async runHeadless(inputs, options = {}, { signal, progress = () => {} } = {}) {
      if (inputs.length < min) throw new Error(`${def.action || 'This job'} needs ${min} file${min === 1 ? '' : 's'}; got ${inputs.length}.`);
      const files = inputs.slice(0, max).map((f) => {
        const blob = f.data instanceof Blob ? f.data : new Blob([f.data], { type: f.type || mimeOf(f.name) });
        const file = typeof File === 'function' ? new File([blob], f.name, { type: blob.type }) : Object.assign(blob, { name: f.name });
        let cache = null;
        return { file, name: f.name, size: blob.size, bytes: async () => (cache ??= new Uint8Array(await blob.arrayBuffer())) };
      });
      return def.run(files, defaults(fieldsFor(files), options), { signal, progress });
    },

    render(container) {
      /** @type {{file: File, name: string, size: number, bytes: () => Promise<Uint8Array>, id: number}[]} */
      let files = [];
      let form = null;
      let urls = [];
      let running = null;
      let last = null;
      let nextId = 1;

      container.innerHTML = `
        <div class="kit" data-kit="${esc(def.id)}">
          ${dropZone(`${def.id}-zone`, { label: def.dropLabel || 'Drop a file', hint: def.dropHint || 'or click to choose', accept: def.accept || '*/*', multiple: max > 1 })}
          <div class="kit-actions io-sources"><button type="button" class="btn btn-ghost btn-sm" data-act="pick">Use earlier work or Toolbox Files…</button></div>
          <div class="kit-files" data-el="files" hidden></div>
          <div class="kit-form" data-el="form" hidden></div>
          <p class="kit-note" data-el="note" hidden></p>
          <div class="kit-actions" data-el="actions" hidden>
            <button type="button" class="btn btn-primary" data-act="run">${esc(def.action || 'Run')}</button>
            ${max > 1 ? '<button type="button" class="btn btn-secondary btn-sm" data-act="add">Add files</button>' : ''}
            <button type="button" class="btn btn-ghost btn-sm" data-act="clear">Start over</button>
          </div>
          <div class="kit-progress" data-el="progress" hidden role="status">
            <div class="kit-bar"><i></i></div>
            <div class="kit-actions"><p data-el="plabel">Working…</p><button type="button" class="btn btn-ghost btn-sm" data-act="cancel">Cancel</button></div>
          </div>
          <div class="kit-result" data-el="result" hidden></div>
        </div>`;

      const $ = (s) => container.querySelector(`[data-el="${s}"]`);
      const zone = container.querySelector('.fz');
      const input = zone.querySelector('input[type="file"]');

      const clearUrls = () => { urls.forEach((u) => URL.revokeObjectURL(u)); urls = []; };
      const addFiles = (list) => {
        for (const f of list) {
          if (files.length >= max) files = max === 1 ? [] : files;
          if (files.length < max) {
            let cache = null;
            files.push({ id: nextId++, file: f, name: f.name, size: f.size, bytes: async () => (cache ??= new Uint8Array(await f.arrayBuffer())) });
          }
        }
        paint();
      };
      this._addFiles = addFiles;

      const paintFields = () => {
        const list = typeof def.fields === 'function' ? def.fields(files) : def.fields || [];
        const prior = form?.values || {};
        form?.destroy();
        form = mountForm($('form'), list, { prefix: `${def.id}-f`, initial: prior, onChange: () => def.onChange?.(form.values, files) });
        $('form').hidden = !list.some((f) => !f.show || f.show(form.values));
      };

      const paint = () => {
        const has = files.length > 0;
        zone.hidden = has && max === 1;
        $('files').hidden = !has;
        $('files').innerHTML = files.map((f, i) => `
          <div class="kit-file" data-id="${f.id}">
            <span class="kit-file-name" title="${esc(f.name)}">${max > 1 ? `${i + 1}. ` : ''}${esc(f.name)}</span>
            <span class="kit-file-meta">${humanBytes(f.size)}</span>
            ${max > 1 ? `<button type="button" class="btn btn-ghost btn-sm" data-move="-1" aria-label="Move up"${i === 0 ? ' disabled' : ''}>${icon('chevron-up')}</button>
            <button type="button" class="btn btn-ghost btn-sm" data-move="1" aria-label="Move down"${i === files.length - 1 ? ' disabled' : ''}>${icon('chevron-down')}</button>` : ''}
            <button type="button" class="btn btn-ghost btn-sm" data-remove aria-label="Remove ${esc(f.name)}">${icon('x')}</button>
          </div>`).join('');
        $('actions').hidden = !has;
        const enough = files.length >= min;
        const run = container.querySelector('[data-act="run"]');
        run.disabled = !enough || !!running;
        const note = !enough ? `Add ${min - files.length} more file${min - files.length === 1 ? '' : 's'}.` : typeof def.note === 'function' ? def.note(files) : def.note;
        $('note').hidden = !note; $('note').textContent = note || '';
        paintFields();
      };

      const showResult = (res) => {
        clearUrls();
        last = res;
        const box = $('result');
        if (!res) { box.hidden = true; box.innerHTML = ''; return; }
        const out = res.files || [];
        const total = out.reduce((n, f) => n + (f.data?.size ?? f.data?.length ?? 0), 0);
        let html = '';
        if (res.note) html += `<p class="kit-note">${res.note.html ?? esc(res.note)}</p>`;
        if (out.length) {
          html += `<div class="kit-actions">
            <button type="button" class="btn btn-primary" data-act="save-all">${out.length > 1 ? `Download all (${out.length}) as ZIP` : `Download ${esc(out[0].name)}`}</button>
            <span class="kit-file-meta">${humanBytes(total)}</span>
            ${res.text ? '<button type="button" class="btn btn-secondary btn-sm" data-act="copy-text">Copy text</button>' : ''}
          </div>`;
          if (out.length > 1 && out.length <= 60) html += `<div class="kit-files">${out.map((f, i) => `<div class="kit-file"><span class="kit-file-name">${esc(f.name)}</span><span class="kit-file-meta">${humanBytes(f.data?.size ?? f.data?.length ?? 0)}</span><button type="button" class="btn btn-ghost btn-sm" data-save="${i}">Download</button></div>`).join('')}</div>`;
        } else if (res.text) html += '<div class="kit-actions"><button type="button" class="btn btn-secondary btn-sm" data-act="copy-text">Copy text</button></div>';
        const kind = res.preview;
        if (kind === 'images') {
          html += `<div class="kit-thumbs">${out.slice(0, 48).map((f) => { const u = URL.createObjectURL(toBlob(f)); urls.push(u); return `<figure><img src="${u}" alt="" loading="lazy"><figcaption>${esc(f.name)}</figcaption></figure>`; }).join('')}</div>`;
        } else if ((kind === 'video' || kind === 'audio') && out[0]) {
          const u = URL.createObjectURL(toBlob(out[0])); urls.push(u);
          html += kind === 'video' ? `<video class="kit-media" src="${u}" controls playsinline></video>` : `<audio class="kit-media" src="${u}" controls></audio>`;
        } else if (kind === 'image' && out[0]) {
          const u = URL.createObjectURL(toBlob(out[0])); urls.push(u);
          html += `<img src="${u}" alt="" style="max-width:100%;border-radius:8px">`;
        }
        if (res.html) html += res.html;
        else if (res.text && !out.length) html += `<pre class="kit-pre">${esc(res.text.slice(0, 200000))}</pre>`;
        box.innerHTML = html;
        box.hidden = false;
        // Every output becomes reachable from other tools, Files and the Assistant.
        const items = out.map((f) => publish({ name: f.name, kind: kindOf(f.name, f.type || f.data?.type || ''), blob: toBlob(f), from: def.id }));
        const bar = box.querySelector('.kit-actions');
        if (bar && items.length === 1) bar.insertBefore(actionsButton(items[0], { exclude: def.id }), bar.children[1] || null);
        box.querySelectorAll('[data-save]').forEach((b) => {
          const item = items[Number(b.dataset.save)];
          if (item) b.parentElement.insertBefore(actionsButton(item, { exclude: def.id, label: 'Open in…' }), b);
        });
        last.items = items;
      };

      const go = async () => {
        if (running || files.length < min) return;
        const ctrl = new AbortController();
        running = ctrl;
        showResult(null);
        $('progress').hidden = false;
        const fill = $('progress').querySelector('i');
        fill.style.width = '0%';
        $('plabel').textContent = 'Starting…';
        paint();
        const progress = (f, label) => {
          if (label) $('plabel').textContent = label;
          if (Number.isFinite(f)) fill.style.width = `${Math.round(Math.max(0, Math.min(1, f)) * 100)}%`;
        };
        try {
          const res = await def.run(files, { ...form.values }, { signal: ctrl.signal, progress });
          if (!ctrl.signal.aborted) showResult(res);
        } catch (err) {
          if (!(err?.cancelled || ctrl.signal.aborted)) {
            console.error(err);
            showResult({ html: `<p class="kit-error">${esc(err?.message || String(err))}</p>` });
          }
        } finally {
          running = null;
          $('progress').hidden = true;
          paint();
        }
      };

      container.addEventListener('click', (e) => {
        const t = e.target.closest('button');
        if (!t) return;
        const act = t.dataset.act;
        if (act === 'run') go();
        else if (act === 'cancel') running?.abort();
        else if (act === 'clear') { running?.abort(); files = []; showResult(null); paint(); }
        else if (act === 'add') input.click();
        else if (act === 'pick') {
          const kinds = def.kinds || (def.accept && def.accept !== '*/*' ? acceptKinds(def.accept) : null);
          pickWork({ kinds, multiple: max > 1 }).then((items) => {
            const list = items.filter((i) => i.blob || i.text != null).map((i) => new File([i.blob || i.text], i.name, { type: i.blob?.type || '' }));
            if (list.length) addFiles(list);
          });
        }
        else if (act === 'save-all' && last?.files?.length) {
          const out = last.files;
          if (out.length === 1) saveBlob(toBlob(out[0]), out[0].name);
          else Promise.all(out.map(async (f) => ({ name: f.name, data: f.data instanceof Blob ? new Uint8Array(await f.data.arrayBuffer()) : f.data })))
            .then((entries) => saveBlob(new Blob([createZip(entries)], { type: 'application/zip' }), last.zipName || `${def.id}.zip`));
        } else if (act === 'copy-text' && last?.text) copyText(last.text, t);
        else if (t.dataset.save != null) { const f = last?.files?.[Number(t.dataset.save)]; if (f) saveBlob(toBlob(f), f.name); }
        else if (t.hasAttribute('data-remove')) { const id = Number(t.closest('[data-id]').dataset.id); files = files.filter((f) => f.id !== id); paint(); }
        else if (t.dataset.move) {
          const id = Number(t.closest('[data-id]').dataset.id); const i = files.findIndex((f) => f.id === id); const j = i + Number(t.dataset.move);
          if (j >= 0 && j < files.length) { [files[i], files[j]] = [files[j], files[i]]; paint(); }
        }
      });

      container.addEventListener('contextmenu', async (e) => {
        if (!last?.items?.length) return;
        const row = e.target.closest('[data-el="result"] .kit-file, [data-el="result"] figure, [data-el="result"] .kit-media, [data-el="result"] img');
        if (!row) return;
        const rows = [...container.querySelectorAll('[data-el="result"] .kit-file')];
        const figs = [...container.querySelectorAll('[data-el="result"] figure')];
        const i = rows.includes(row) ? rows.indexOf(row) : figs.includes(row) ? figs.indexOf(row) : 0;
        const item = last.items[i] || last.items[0];
        e.preventDefault();
        const { openContextMenu } = await import('../context-menu.js');
        openContextMenu({ x: e.clientX, y: e.clientY, title: item.name, items: actionsFor(item, { exclude: def.id, download: () => saveBlob(item.blob, item.name) }) });
      });

      this._detach = attachFileInput(zone, input, (list) => addFiles(list), { accept: def.accept });
      this._abort = () => running?.abort();
      this._clearUrls = clearUrls;
      paint();
      def.mounted?.(container, { addFiles, get values() { return form?.values; }, get files() { return files; } });
    },

    async setArtifact(a) {
      let blob = null;
      // Files reads the body after navigating, so give it a moment to land.
      for (let t = 0; t < 70 && !blob; t++) {
        blob = a?.blob || (a?.content instanceof Blob ? a.content : null);
        if (!blob) await new Promise((r) => setTimeout(r, 60));
      }
      if (!blob && a?.text != null) blob = new Blob([a.text], { type: 'text/plain' });
      if (!blob || !this._addFiles) return;
      this._addFiles([new File([blob], a.name || 'file', { type: blob.type })]);
    },

    destroy() { this._abort?.(); this._detach?.(); this._clearUrls?.(); this._addFiles = null; },
  };
}
