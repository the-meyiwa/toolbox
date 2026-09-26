/* ============================================================
   The frame Scribe, Ledger and Podium share: file name, New, Open,
   Save (back to the same file in Files), Save as another format,
   Download, and the "unsaved changes" state.

   Each editor supplies its body and three callbacks:
     load(bytes, name)  read a file into the editor
     blank()            start an empty document
     serialize(format)  → Blob of the current document in that format
   ============================================================ */

import { extOf, stemOf, saveFormatFor, SAVE_FORMATS, DOC_FORMATS, mimeFor } from './formats.js';
import { toBytes } from './xml.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICONS = {
  new: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M12 11v6M9 14h6"/>',
  open: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1"/><path d="M3 7v10a2 2 0 0 0 2 2h13l3-8H7l-3 8"/>',
  save: '<path d="M5 3h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v5h8V3M7 21v-7h10v7"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
};
export const icon = (d, size = 16) => `<svg class="dx-ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

const FORMAT_LABELS = {
  docx: 'Word-processor (.docx)', odt: 'OpenDocument text (.odt)', rtf: 'Rich text (.rtf)', md: 'Markdown (.md)', txt: 'Plain text (.txt)', html: 'Web page (.html)',
  xlsx: 'Spreadsheet (.xlsx)', xls: 'Legacy spreadsheet (.xls)', ods: 'OpenDocument spreadsheet (.ods)', csv: 'CSV (.csv)', tsv: 'TSV (.tsv)',
  pptx: 'Presentation (.pptx)', odp: 'OpenDocument presentation (.odp)',
};

async function toast(message, type = 'info') {
  try { (await import('../../utils.js')).showToast(message, type); } catch { /* no toast host in tests */ }
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Mount the frame. Returns the controller the editor talks to.
 * @param {HTMLElement} container
 * @param {{ tool: 'scribe'|'ledger'|'podium', defaultName: string, accept: string,
 *           toolbar: string, body: string, footer?: string,
 *           load: (bytes: Uint8Array, name: string) => Promise<void>|void,
 *           blank: () => void, serialize: (format: string) => Promise<Blob> }} opts
 */
export function mountShell(container, opts) {
  const formats = SAVE_FORMATS[opts.tool];
  const state = { name: opts.defaultName, path: null, dir: null, storage: 'offline', dirty: false, savedAt: null, busy: false, note: '' };

  container.innerHTML = `
    <div class="dx dx-${opts.tool}">
      <header class="dx-head">
        <div class="dx-file">
          <input class="dx-name" type="text" value="${esc(state.name)}" aria-label="File name" spellcheck="false" autocomplete="off">
          <span class="dx-status" aria-live="polite"></span>
        </div>
        <div class="dx-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-dx="new" title="New">${icon(ICONS.new)}<span>New</span></button>
          <label class="btn btn-ghost btn-sm dx-open" title="Open a file from this device">${icon(ICONS.open)}<span>Open</span><input type="file" accept="${esc(opts.accept)}" hidden></label>
          <select class="dx-format" aria-label="Save as format" title="Format to save in">
            ${formats.map(f => `<option value="${f}">${esc(FORMAT_LABELS[f] || f)}</option>`).join('')}
          </select>
          <button type="button" class="btn btn-secondary btn-sm" data-dx="download" title="Download to this device">${icon(ICONS.download)}<span>Download</span></button>
          <button type="button" class="btn btn-primary btn-sm" data-dx="save" title="Save to Files (Ctrl+S)">${icon(ICONS.save)}<span>Save</span></button>
        </div>
      </header>
      <div class="dx-toolbar" role="toolbar" aria-label="Formatting">${opts.toolbar}</div>
      <div class="dx-body">${opts.body}</div>
      ${opts.footer ? `<footer class="dx-foot">${opts.footer}</footer>` : ''}
    </div>
  `;

  const root = container.querySelector('.dx');
  const nameInput = root.querySelector('.dx-name');
  const formatSel = root.querySelector('.dx-format');
  const statusEl = root.querySelector('.dx-status');
  const fileInput = root.querySelector('.dx-open input');

  const paint = () => {
    const where = state.path ? `In Files at ${state.path.split('/').slice(0, -1).join('/') || '/'}` : 'Not saved yet';
    const text = state.busy ? state.busy : state.dirty ? 'Unsaved changes' : state.savedAt ? `Saved · ${where}` : where;
    statusEl.textContent = state.note ? `${text} · ${state.note}` : text;
    root.classList.toggle('is-dirty', state.dirty);
  };

  const syncFormat = () => {
    const f = saveFormatFor(state.name, opts.tool);
    if (formats.includes(f)) formatSel.value = f;
  };

  const setName = (name) => {
    state.name = name;
    nameInput.value = name;
    syncFormat();
    paint();
  };

  nameInput.addEventListener('change', () => {
    const v = nameInput.value.trim().replace(/[\\/:*?"<>|]/g, '-');
    if (!v) { nameInput.value = state.name; return; }
    // Keep a known extension; add the current format's when there is none.
    const ext = extOf(v);
    state.name = formats.includes(ext) || DOC_FORMATS[ext] ? v : `${v}.${formatSel.value}`;
    nameInput.value = state.name;
    if (state.path) state.path = `${state.path.split('/').slice(0, -1).join('/')}/${state.name}`;
    syncFormat();
    markDirty();
  });
  formatSel.addEventListener('change', () => {
    state.name = `${stemOf(state.name) || 'Untitled'}.${formatSel.value}`;
    nameInput.value = state.name;
    if (state.path) state.path = `${state.path.split('/').slice(0, -1).join('/')}/${state.name}`;
    markDirty();
  });

  function markDirty() {
    if (!state.dirty) { state.dirty = true; paint(); }
  }

  async function serializeCurrent() {
    const format = formatSel.value;
    const name = extOf(state.name) === format ? state.name : `${stemOf(state.name) || 'Untitled'}.${format}`;
    const blob = await opts.serialize(format);
    return { blob, name, format };
  }

  async function uniquePath(dir, name) {
    const { fs } = await import('../filesystem.js');
    let candidate = `${dir}/${name}`;
    const stem = stemOf(name), ext = extOf(name);
    for (let n = 2; n < 500 && await fs.stat(candidate, { storage: state.storage }).catch(() => null); n++) candidate = `${dir}/${stem} ${n}.${ext}`;
    return candidate;
  }

  async function save() {
    if (state.busy) return;
    state.busy = 'Saving…'; paint();
    try {
      const { blob, name } = await serializeCurrent();
      const { fs } = await import('../filesystem.js');
      let target = state.path;
      if (target && target.split('/').pop() !== name) target = `${target.split('/').slice(0, -1).join('/')}/${name}`;
      if (!target) target = await uniquePath(state.dir || '/Home/Documents', name);
      await fs.writeFile(target, blob, { mimeType: mimeFor(name), storage: state.storage });
      state.path = target;
      state.name = target.split('/').pop();
      nameInput.value = state.name;
      state.dirty = false;
      state.note = '';
      state.savedAt = Date.now();
      toast(`Saved ${state.name} to Files`, 'success');
    } catch (err) {
      console.error(err);
      toast(`Couldn't save: ${err.message || err}`, 'error');
    } finally {
      state.busy = false; paint();
    }
  }

  async function doDownload() {
    if (state.busy) return;
    state.busy = 'Preparing…'; paint();
    try {
      const { blob, name } = await serializeCurrent();
      download(blob, name);
    } catch (err) {
      console.error(err);
      toast(`Couldn't export: ${err.message || err}`, 'error');
    } finally {
      state.busy = false; paint();
    }
  }

  async function openBytes(bytes, name, { path = null, storage = 'offline' } = {}) {
    state.busy = 'Opening…'; paint();
    try {
      await opts.load(bytes, name);
      state.path = path;
      state.storage = storage;
      state.dirty = false;
      state.savedAt = path ? Date.now() : null;
      // Legacy formats are read, then saved as their modern sibling, as a
      // new file beside the original rather than over it.
      const ext = extOf(name);
      const target = saveFormatFor(name, opts.tool);
      const converted = ext !== target && ext !== 'markdown';
      state.dir = path ? path.split('/').slice(0, -1).join('/') || '/Home' : null;
      state.path = converted ? null : path;
      state.note = converted ? `saves as .${target}` : '';
      setName(converted ? `${stemOf(name) || 'Untitled'}.${target}` : name);
    } catch (err) {
      console.error(err);
      toast(`Couldn't open ${name}: ${err.message || 'the file may be damaged or password-protected'}`, 'error');
    } finally {
      state.busy = false; paint();
    }
  }

  const onClick = (e) => {
    const act = e.target.closest('[data-dx]')?.dataset.dx;
    if (act === 'save') save();
    else if (act === 'download') doDownload();
    else if (act === 'new') {
      if (state.dirty && typeof confirm === 'function' && !confirm('Discard unsaved changes and start a new file?')) return;
      opts.blank();
      state.path = null; state.dir = null; state.dirty = false; state.savedAt = null; state.note = '';
      setName(opts.defaultName);
    }
  };
  root.addEventListener('click', onClick);

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    if (state.dirty && typeof confirm === 'function' && !confirm('Discard unsaved changes and open another file?')) return;
    await openBytes(new Uint8Array(await file.arrayBuffer()), file.name);
  });

  const onKey = (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's' && root.isConnected) {
      e.preventDefault();
      save();
    }
  };
  document.addEventListener('keydown', onKey);

  syncFormat();
  paint();

  return {
    root,
    state,
    markDirty,
    save,
    openBytes,
    setStatusNote(note) { state.note = note; paint(); },
    /** Open whatever the File Explorer or another tool handed over. */
    async openArtifact(a) {
      if (!a) return false;
      const name = a.name || opts.defaultName;
      let data = a.blob instanceof Blob ? a.blob : a.content instanceof Blob ? a.content : null;
      if (!data && a.path) {
        try {
          const { fs } = await import('../filesystem.js');
          data = await fs.readFile(a.path, { encoding: 'blob', storage: a.storage || 'offline' });
        } catch { /* fall through to text */ }
      }
      if (!data && typeof a.text === 'string') data = new Blob([a.text], { type: mimeFor(name) });
      if (!data) return false;
      await openBytes(await toBytes(data), name, { path: a.path || null, storage: a.storage || 'offline' });
      return true;
    },
    destroy() {
      document.removeEventListener('keydown', onKey);
      root.removeEventListener('click', onClick);
    },
  };
}
