/* ============================================================
   PDF Merge — combine many PDFs, each with its own page range, then
   fine-tune the combined page order in the shared page grid.

   Built on the shared PDF workspace (js/lib/pdf/*).
   ============================================================ */

import { attachFileInput, dropZone } from '../lib/file-engine.js';
import {
  PdfSession, ThumbService, PageGrid, runTask, icon, esc, fileSummary, downloadBytes, notify,
  displayRot, pickFiles, uid, scrollParent,
} from '../lib/pdf/workspace.js';
import { parseRange, parseRangeGroups, addOutline, savePdf, baseName, humanBytes, viewSize } from '../lib/pdf/core.js';
import { getToolSettings } from '../lib/tool-settings.js';

const THUMB_W = { small: 96, medium: 124, large: 170 };

export default {
  async render(container, { analytics, artifact } = {}) {
    this._cleanup = [];
    const prefs = getToolSettings('pdf-merge');
    const session = new PdfSession();
    const thumbs = new ThumbService(session, { width: THUMB_W[prefs.thumbSize] || 124 });
    this._session = session;
    this._thumbs = thumbs;

    /** @type {Array<{id: string, src: string, range: string}>} */
    let files = [];
    let view = 'files';
    let custom = false;       // page view edited by hand

    container.innerHTML = `
      <div class="pw" data-tool="merge" style="--pw-thumb:${THUMB_W[prefs.thumbSize] || 124}px">
        ${dropZone('pm-zone', { label: 'Drop PDFs to combine', hint: 'or click to choose · add as many as you like', accept: 'application/pdf,.pdf' })}
        <div class="pw-work" id="pm-work" hidden>
          <header class="pw-head">
            <div class="pw-file">${icon('merge', 20)}<div class="pw-file-text"><strong id="pm-title">Merge PDFs</strong><span id="pm-meta"></span></div></div>
            <div class="pw-head-actions">
              <button type="button" class="btn btn-secondary btn-sm" id="pm-add">${icon('plus', 15)}<span>Add PDFs</span></button>
              <button type="button" class="btn btn-ghost btn-sm" id="pm-clear">Clear</button>
            </div>
          </header>
          <div class="pw-body">
            <section class="pw-main">
              <div class="pw-toolbar" role="toolbar" aria-label="View">
                <div class="pw-tgroup" role="tablist">
                  <button type="button" class="pw-tbtn" data-view="files" aria-pressed="true">${icon('file', 15)}Files</button>
                  <button type="button" class="pw-tbtn" data-view="pages" aria-pressed="false">${icon('organise', 15)}Pages</button>
                </div>
                <div class="pw-tgroup" id="pm-page-tools" hidden>
                  <button type="button" class="pw-tbtn pw-icon-btn" data-pt="left" title="Move selected earlier" aria-label="Move selected earlier">${icon('left', 16)}</button>
                  <button type="button" class="pw-tbtn pw-icon-btn" data-pt="right" title="Move selected later" aria-label="Move selected later">${icon('right', 16)}</button>
                  <button type="button" class="pw-tbtn pw-icon-btn" data-pt="rotate" title="Rotate selected" aria-label="Rotate selected">${icon('rotateCw', 16)}</button>
                  <button type="button" class="pw-tbtn pw-icon-btn" data-pt="delete" title="Remove selected" aria-label="Remove selected">${icon('trash', 16)}</button>
                </div>
                <button type="button" class="pw-tbtn" id="pm-reset" hidden>Reset order</button>
                <span class="pw-tstatus" id="pm-status"></span>
              </div>
              <ol class="pw-files" id="pm-files"></ol>
              <div id="pm-grid" hidden></div>
            </section>
            <aside class="pw-side">
              <div class="pw-panel">
                <h3 class="pw-panel-title">Combined document</h3>
                <div class="pw-stats" id="pm-stats"></div>
                <label class="pw-field"><span>File name</span>
                  <input type="text" class="tool-input" id="pm-name" value="merged.pdf" spellcheck="false"></label>
                <label class="pw-check-row"><input type="checkbox" id="pm-bookmarks" ${prefs.bookmarks ? 'checked' : ''}><span>Bookmark each file<small>Readers can jump between the original documents.</small></span></label>
                <label class="pw-check-row"><input type="checkbox" id="pm-blank"><span>Blank page between files<small>Keeps double-sided printing aligned.</small></span></label>
                <button type="button" class="btn btn-primary pw-go" id="pm-go">${icon('merge', 16)}<span>Merge PDFs</span></button>
                <p class="pw-note" id="pm-note"></p>
              </div>
            </aside>
          </div>
        </div>
      </div>`;

    const root = container.querySelector('.pw');
    const zone = container.querySelector('#pm-zone');
    const work = container.querySelector('#pm-work');
    const listEl = container.querySelector('#pm-files');
    const gridEl = container.querySelector('#pm-grid');
    const goBtn = container.querySelector('#pm-go');

    const grid = new PageGrid(gridEl, {
      thumbs,
      actions: ['rotate', 'duplicate', 'delete'],
      label: (p) => (p.blank ? 'Blank' : shortName(session.get(p.src)?.name)),
      onChange: (kind) => {
        if (kind === 'pages') { custom = true; container.querySelector('#pm-reset').hidden = false; }
        updateSummary();
      },
    });

    const shortName = (n = '') => baseName(n).slice(0, 18);

    /* ---------- model ---------- */

    function rangeInfo(f) {
      const src = session.get(f.src);
      if (!f.range.trim()) return { indices: src.pages.map((_, i) => i), errors: [] };
      const { errors } = parseRangeGroups(f.range, src.pageCount);
      return { indices: parseRange(f.range, src.pageCount), errors };
    }

    function derivedPages() {
      const out = [];
      const blankBetween = container.querySelector('#pm-blank').checked;
      files.forEach((f, n) => {
        const items = session.pageItems(f.src, rangeInfo(f).indices);
        out.push(...items);
        if (blankBetween && n < files.length - 1 && items.length) {
          const last = items.at(-1);
          const vs = viewSize({ width: last.w, height: last.h }, displayRot(last));
          out.push({ id: uid(), blank: { width: vs.width, height: vs.height }, src: null, index: -1, rotate: 0, baseRot: 0, w: vs.width, h: vs.height });
        }
      });
      return out;
    }

    function currentPages() {
      return custom ? grid.pages : derivedPages();
    }

    function syncGrid({ reset = false } = {}) {
      if (reset && custom) notify('Page order reset to follow the file list.');
      if (reset) custom = false;
      if (!custom) grid.setPages(derivedPages(), { keepSelection: false });
      container.querySelector('#pm-reset').hidden = !custom;
    }

    /* ---------- rendering ---------- */

    function renderFiles() {
      thumbs.forget(listEl);
      listEl.innerHTML = files.map((f, i) => {
        const src = session.get(f.src);
        const info = rangeInfo(f);
        const first = src.pages[info.indices[0] ?? 0];
        const ar = first ? (first.rot % 180 ? first.h / first.w : first.w / first.h) : 0.707;
        return `<li class="pw-fcard" draggable="true" data-id="${f.id}">
          <span class="pw-grip" title="Drag to reorder" aria-hidden="true">${icon('grip', 16)}</span>
          <div class="pw-fthumb"><div class="pw-sheet${ar > 0.8 ? ' is-wide' : ''}" style="--ar:${ar.toFixed(3)}"><img alt=""></div></div>
          <div class="pw-fbody">
            <span class="pw-fname" title="${esc(src.name)}">${esc(src.name)}</span>
            <span class="pw-fmeta">${fileSummary(src)}${src.encrypted ? ' · pages saved as images' : ''}</span>
            <label class="pw-frange"><input type="text" class="tool-input" data-range="${f.id}" value="${esc(f.range)}" placeholder="All pages (e.g. 1-3, 7)" aria-label="Pages to include from ${esc(src.name)}" spellcheck="false">
              <small class="${info.errors.length ? 'is-bad' : ''}" data-count="${f.id}">${info.errors.length ? `Check "${esc(info.errors[0])}"` : `${info.indices.length} of ${src.pageCount}`}</small></label>
          </div>
          <div class="pw-fact">
            <button type="button" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${icon('up', 16)}</button>
            <button type="button" data-down="${i}" ${i === files.length - 1 ? 'disabled' : ''} aria-label="Move down">${icon('down', 16)}</button>
            <button type="button" data-remove="${i}" aria-label="Remove ${esc(src.name)}">${icon('x', 16)}</button>
          </div>
        </li>`;
      }).join('') + `<li class="pw-add-row"><button type="button" class="pw-add" id="pm-add-inline">${icon('plus', 16)}<span>Add more PDFs</span></button></li>`;
      files.forEach((f, i) => {
        const src = session.get(f.src);
        const idx = rangeInfo(f).indices[0] ?? 0;
        const sheet = listEl.children[i].querySelector('.pw-sheet');
        thumbs.observe(sheet, { src: f.src, index: idx, rot: src.pages[idx]?.rot || 0 }, scrollParent(listEl));
      });
      updateSummary();
    }

    function updateSummary() {
      const pages = currentPages();
      const size = files.reduce((s, f) => s + (session.get(f.src)?.size || 0), 0);
      container.querySelector('#pm-meta').textContent = `${files.length} file${files.length === 1 ? '' : 's'} · ${pages.length} page${pages.length === 1 ? '' : 's'} · ${humanBytes(size)}`;
      container.querySelector('#pm-stats').innerHTML = `
        <div class="pw-stat"><b>${files.length}</b><span>Files</span></div>
        <div class="pw-stat"><b>${pages.length}</b><span>Pages</span></div>
        <div class="pw-stat"><b>${humanBytes(size)}</b><span>Input</span></div>`;
      container.querySelector('#pm-status').textContent = view === 'pages'
        ? (grid.selected.size ? `${grid.selected.size} selected` : 'Drag pages to reorder')
        : 'Drag files to reorder';
      const enough = pages.length > 0 && (files.length > 1 || custom || pages.length !== session.get(files[0]?.src)?.pageCount);
      goBtn.disabled = !enough;
      goBtn.querySelector('span').textContent = files.length < 2 && !custom ? 'Add another PDF to merge' : `Merge ${pages.length} pages`;
      if (files.length === 1 && !custom && enough) goBtn.querySelector('span').textContent = `Save ${pages.length} pages`;
      const enc = files.some(f => session.get(f.src)?.encrypted);
      container.querySelector('#pm-note').textContent = enc ? 'Encrypted files are rebuilt from page images, so their text will not be selectable.' : '';
    }

    function setView(v) {
      view = v;
      root.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
      listEl.hidden = v !== 'files';
      gridEl.hidden = v !== 'pages';
      container.querySelector('#pm-page-tools').hidden = v !== 'pages';
      container.querySelector('#pm-reset').hidden = v !== 'pages' || !custom;
      if (v === 'pages') { if (!custom) syncGrid(); else grid.render(); }
      updateSummary();
    }

    /* ---------- loading ---------- */

    async function addFiles(list) {
      const pdfs = [...list].filter(f => /pdf/i.test(f.type) || /\.pdf$/i.test(f.name));
      if (!pdfs.length) return;
      analytics?.started();
      await runTask(root, pdfs.length > 1 ? `Opening ${pdfs.length} PDFs` : 'Opening PDF', async ({ progress, signal }) => {
        let n = 0;
        for (const file of pdfs) {
          if (signal.aborted) break;
          progress(n / pdfs.length, `Opening ${file.name}`);
          try {
            const src = await session.add(file);
            files.push({ id: uid('f'), src: src.id, range: '' });
          } catch (err) {
            if (err?.passwordCancelled) notify(`Skipped ${file.name}: no password given.`);
            else { notify(`${file.name}: ${err.message || 'could not be read.'}`, 'error'); analytics?.error('pdf_unreadable'); }
          }
          n++;
        }
        if (files.length) {
          zone.hidden = true;
          work.hidden = false;
          if (files.length === 1 || container.querySelector('#pm-name').value === 'merged.pdf') {
            container.querySelector('#pm-name').value = files.length > 1 ? `${baseName(session.get(files[0].src).name)}-merged.pdf` : 'merged.pdf';
          }
        }
        renderFiles();
        if (custom) {
          // Keep hand-made order; append pages of new files.
          const known = new Set(grid.pages.map(p => p.src));
          const extra = files.filter(f => !known.has(f.src)).flatMap(f => session.pageItems(f.src, rangeInfo(f).indices));
          if (extra.length) grid.insertAt(grid.pages.length, extra);
        } else if (view === 'pages') syncGrid();
      });
    }
    this._load = addFiles;

    this._cleanup.push(attachFileInput(zone, container.querySelector('#pm-zone-input'), addFiles, { accept: /pdf/i }));

    /* ---------- events ---------- */

    const addMore = async () => addFiles(await pickFiles({ multiple: true }));
    container.querySelector('#pm-add').addEventListener('click', addMore);
    container.querySelector('#pm-clear').addEventListener('click', () => {
      for (const f of files) { session.remove(f.src); thumbs.dropSource(f.src); }
      files = []; custom = false;
      grid.setPages([], { keepSelection: false });
      work.hidden = true; zone.hidden = false;
      setView('files');
    });

    root.addEventListener('click', (e) => {
      const v = e.target.closest('[data-view]')?.dataset.view;
      if (v) setView(v);
    });

    listEl.addEventListener('click', (e) => {
      if (e.target.closest('#pm-add-inline')) { addMore(); return; }
      const b = e.target.closest('button');
      if (!b) return;
      const move = (from, to) => {
        if (to < 0 || to >= files.length) return;
        const [f] = files.splice(from, 1);
        files.splice(to, 0, f);
        renderFiles();
        syncGrid({ reset: custom });
      };
      if (b.dataset.up != null) move(Number(b.dataset.up), Number(b.dataset.up) - 1);
      else if (b.dataset.down != null) move(Number(b.dataset.down), Number(b.dataset.down) + 1);
      else if (b.dataset.remove != null) {
        const [f] = files.splice(Number(b.dataset.remove), 1);
        session.remove(f.src);
        thumbs.dropSource(f.src);
        if (custom) grid.setPages(grid.pages.filter(p => p.src !== f.src));
        renderFiles();
        if (!files.length) { work.hidden = true; zone.hidden = false; custom = false; }
      }
    });

    let rangeTimer = null;
    listEl.addEventListener('input', (e) => {
      const id = e.target.dataset.range;
      if (!id) return;
      const f = files.find(x => x.id === id);
      f.range = e.target.value;
      const info = rangeInfo(f);
      const small = listEl.querySelector(`[data-count="${id}"]`);
      small.textContent = info.errors.length ? `Check "${info.errors[0]}"` : `${info.indices.length} of ${session.get(f.src).pageCount}`;
      small.classList.toggle('is-bad', info.errors.length > 0);
      clearTimeout(rangeTimer);
      rangeTimer = setTimeout(() => { syncGrid({ reset: custom }); updateSummary(); }, 250);
      updateSummary();
    });

    container.querySelector('#pm-blank').addEventListener('change', () => { syncGrid({ reset: custom }); updateSummary(); });
    container.querySelector('#pm-reset').addEventListener('click', () => { syncGrid({ reset: true }); updateSummary(); });

    container.querySelector('#pm-page-tools').addEventListener('click', (e) => {
      const t = e.target.closest('[data-pt]')?.dataset.pt;
      const ids = [...grid.selected];
      if (!t || !ids.length) { if (t) notify('Select pages first (click, or shift-click for a run).'); return; }
      if (t === 'left') grid.shift(ids, -1);
      else if (t === 'right') grid.shift(ids, 1);
      else if (t === 'rotate') grid.rotate(ids, 90);
      else if (t === 'delete') grid.remove(ids);
    });

    /* drag files to reorder, or drop new files onto the list */
    let dragId = null;
    let mark = null;
    const clearMark = () => { mark?.classList.remove('drop-before', 'drop-after'); mark = null; };
    listEl.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.pw-fcard');
      if (!card || e.target.closest('input')) { e.preventDefault(); return; }
      dragId = card.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', dragId); } catch { /* ignore */ }
      requestAnimationFrame(() => card.classList.add('is-dragging'));
    });
    listEl.addEventListener('dragend', () => { dragId = null; clearMark(); listEl.querySelector('.is-dragging')?.classList.remove('is-dragging'); });
    listEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!dragId) { listEl.querySelector('.pw-add')?.classList.add('is-drop'); return; }
      const card = e.target.closest('.pw-fcard');
      if (!card) return;
      const r = card.getBoundingClientRect();
      const after = e.clientY > r.top + r.height / 2;
      if (mark !== card) clearMark();
      mark = card;
      card.classList.toggle('drop-after', after);
      card.classList.toggle('drop-before', !after);
    });
    listEl.addEventListener('dragleave', (e) => { if (!listEl.contains(e.relatedTarget)) { clearMark(); listEl.querySelector('.pw-add')?.classList.remove('is-drop'); } });
    listEl.addEventListener('drop', (e) => {
      e.preventDefault();
      listEl.querySelector('.pw-add')?.classList.remove('is-drop');
      if (!dragId) { if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files); return; }
      const card = e.target.closest('.pw-fcard') || mark;
      const after = card?.classList.contains('drop-after');
      clearMark();
      if (!card || card.dataset.id === dragId) return;
      const from = files.findIndex(f => f.id === dragId);
      const [f] = files.splice(from, 1);
      let to = files.findIndex(x => x.id === card.dataset.id) + (after ? 1 : 0);
      files.splice(to, 0, f);
      dragId = null;
      renderFiles();
      syncGrid({ reset: custom });
    });

    goBtn.addEventListener('click', async () => {
      const pages = currentPages();
      if (!pages.length) return;
      const name = (container.querySelector('#pm-name').value.trim() || 'merged.pdf').replace(/(\.pdf)?$/i, '.pdf');
      const bookmarks = container.querySelector('#pm-bookmarks').checked;
      await runTask(root, `Merging ${pages.length} pages`, async ({ signal, progress }) => {
        const { doc, starts } = await session.compose(pages, { signal, onProgress: (f) => progress(f * 0.8), keepStructure: files.length === 1 });
        if (bookmarks && files.length > 1) {
          await addOutline(doc, files.filter(f => starts.has(f.src)).map(f => ({ title: baseName(session.get(f.src).name), pageIndex: starts.get(f.src) }))
            .sort((a, b) => a.pageIndex - b.pageIndex));
        }
        doc.setProducer('Toolbox');
        doc.setModificationDate(new Date());
        progress(0.9, 'Saving');
        const bytes = await savePdf(doc, { objectStreams: prefs.compress !== false });
        const size = downloadBytes(bytes, name, 'application/pdf');
        notify(`Saved ${name} (${pages.length} pages, ${humanBytes(size)}).`, 'success');
        analytics?.completed({ fileCount: files.length, bytesOut: size });
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
    if (!blob || !this._load) return;
    this._lastArtifact = incoming;
    await this._load([new File([blob], incoming.name || 'document.pdf', { type: 'application/pdf' })]);
  },

  destroy() {
    for (const fn of this._cleanup ?? []) fn();
    this._cleanup = [];
    this._thumbs?.destroy();
    this._session?.destroy();
    this._thumbs = this._session = this._load = null;
    this._lastArtifact = this._incomingArtifact = null;
  },
};
