/* ============================================================
   PDF Split — ranges, every N pages, bookmarks, selected pages or
   every page. Several outputs download as one ZIP.

   Built on the shared PDF workspace (js/lib/pdf/*): the same page grid,
   lazy thumbnails and progress strip as Merge, Editor and Image to PDF.
   ============================================================ */

import { attachFileInput, dropZone } from '../lib/file-engine.js';
import {
  PdfSession, ThumbService, PageGrid, runTask, icon, esc, segmented, bindSegmented,
  fileSummary, downloadFiles, downloadBytes, notify, displayRot,
} from '../lib/pdf/workspace.js';
import {
  parseRangeGroups, planEvery, planEach, planBookmarks, partNames, formatRange, baseName,
  composeDocument, savePdf, checkAbort, tick, humanBytes,
} from '../lib/pdf/core.js';
import { getToolSettings } from '../lib/tool-settings.js';

const THUMB_W = { small: 96, medium: 124, large: 170 };
const MODES = [['ranges', 'Ranges'], ['every', 'Every N'], ['bookmarks', 'Bookmarks'], ['selected', 'Selected'], ['each', 'Each page']];

export default {
  async render(container, { analytics, artifact } = {}) {
    this._cleanup = [];
    const prefs = getToolSettings('pdf-split');
    const session = new PdfSession();
    const thumbs = new ThumbService(session, { width: THUMB_W[prefs.thumbSize] || 124 });
    this._session = session;
    this._thumbs = thumbs;

    let src = null;
    let mode = prefs.mode || 'ranges';
    let everyN = prefs.everyN || 1;
    let rangeSpec = '';
    let removeSelected = false;
    let plan = { groups: [], titles: [], errors: [] };

    container.innerHTML = `
      <div class="pw" data-tool="split" style="--pw-thumb:${THUMB_W[prefs.thumbSize] || 124}px">
        ${dropZone('ps-zone', { label: 'Drop a PDF to split', hint: 'or click to choose · large files are fine', accept: 'application/pdf,.pdf', multiple: false })}
        <div class="pw-work" id="ps-work" hidden>
          <header class="pw-head">
            <div class="pw-file">${icon('file', 20)}<div class="pw-file-text"><strong id="ps-name"></strong><span id="ps-meta"></span></div></div>
            <div class="pw-head-actions">
              <button type="button" class="btn btn-secondary btn-sm" id="ps-another">${icon('upload', 15)}<span>Choose another</span></button>
            </div>
          </header>
          <div class="pw-body">
            <section class="pw-main">
              <div class="pw-toolbar" role="toolbar" aria-label="Selection">
                <div class="pw-tgroup">
                  <button type="button" class="pw-tbtn" data-sel="all">Select all</button>
                  <button type="button" class="pw-tbtn" data-sel="none">None</button>
                  <button type="button" class="pw-tbtn" data-sel="invert">Invert</button>
                </div>
                <div class="pw-tgroup">
                  <button type="button" class="pw-tbtn pw-icon-btn" data-rot="270" title="Rotate selected left" aria-label="Rotate selected left">${icon('rotateCcw', 17)}</button>
                  <button type="button" class="pw-tbtn pw-icon-btn" data-rot="90" title="Rotate selected right" aria-label="Rotate selected right">${icon('rotateCw', 17)}</button>
                </div>
                <span class="pw-tstatus" id="ps-selinfo"></span>
              </div>
              <div id="ps-grid"></div>
            </section>
            <aside class="pw-side">
              <div class="pw-panel">
                <h3 class="pw-panel-title">Split method</h3>
                ${segmented('mode', MODES, mode)}
                <div class="pw-mode" id="ps-mode"></div>
              </div>
              <div class="pw-panel">
                <div class="pw-panel-head"><h3 class="pw-panel-title">Output</h3><span class="pw-chip" id="ps-count"></span></div>
                <ol class="pw-outlist" id="ps-out"></ol>
                <button type="button" class="btn btn-primary pw-go" id="ps-go">${icon('scissors', 16)}<span>Split</span></button>
                <p class="pw-note" id="ps-note"></p>
              </div>
            </aside>
          </div>
        </div>
      </div>`;

    const root = container.querySelector('.pw');
    const zone = container.querySelector('#ps-zone');
    const work = container.querySelector('#ps-work');
    const modeEl = container.querySelector('#ps-mode');
    const outEl = container.querySelector('#ps-out');
    const goBtn = container.querySelector('#ps-go');
    const noteEl = container.querySelector('#ps-note');

    const grid = new PageGrid(container.querySelector('#ps-grid'), {
      thumbs,
      actions: ['rotate'],
      reorder: false,
      toggleClick: true,
      badge: (p, i) => partBadge(i),
      dim: (p, i) => !inPlan(i),
      onChange: (kind) => {
        if (kind === 'selection' && (mode === 'selected' || mode === 'ranges')) {
          if (mode === 'ranges') {
            rangeSpec = formatRange(grid.selectedIndices());
            const input = modeEl.querySelector('#ps-ranges');
            if (input) input.value = rangeSpec;
          }
          recompute();
        } else if (kind === 'pages') recompute(false);
        updateSelInfo();
      },
    });

    /* ---------- plan ---------- */

    let startOf = new Map();
    let covered = new Set();
    const partBadge = (i) => (startOf.has(i) && plan.groups.length > 1 ? `Part ${startOf.get(i) + 1}` : '');
    const inPlan = (i) => covered.has(i);

    function computePlan() {
      const count = grid.pages.length;
      if (!count) return { groups: [], titles: [], errors: [] };
      if (mode === 'ranges') {
        const r = parseRangeGroups(rangeSpec, count);
        return { groups: r.groups, titles: [], errors: r.errors };
      }
      if (mode === 'every') return { groups: planEvery(count, everyN), titles: [], errors: [] };
      if (mode === 'each') return { groups: planEach(count), titles: [], errors: [] };
      if (mode === 'bookmarks') {
        const parts = planBookmarks(src?.outline || [], count, { depth: bmDepth });
        return { groups: parts.map(p => p.pages), titles: parts.map(p => p.title), errors: [] };
      }
      const sel = grid.selectedIndices();
      if (removeSelected) {
        const keep = grid.pages.map((_, i) => i).filter(i => !sel.includes(i));
        return { groups: sel.length && keep.length ? [keep] : [], titles: [], errors: [] };
      }
      return { groups: sel.length ? [sel] : [], titles: [], errors: [] };
    }
    let bmDepth = 0;

    function recompute(rerender = true) {
      plan = computePlan();
      startOf = new Map();
      covered = new Set();
      plan.groups.forEach((g, n) => { if (!startOf.has(g[0])) startOf.set(g[0], n); g.forEach(i => covered.add(i)); });
      if (rerender) grid.decorate();
      renderOutputs();
    }

    function names() {
      const base = baseName(src?.name);
      if (mode === 'selected') return [`${base}-${removeSelected ? 'trimmed' : 'extract'}.pdf`];
      return partNames(base, plan.groups, plan.titles);
    }

    function renderOutputs() {
      const n = plan.groups.length;
      const nm = names();
      container.querySelector('#ps-count').textContent = n ? `${n} file${n === 1 ? '' : 's'}` : 'Nothing yet';
      const shown = plan.groups.slice(0, 60);
      outEl.innerHTML = shown.map((g, i) => `
        <li><span class="pw-out-name">${esc(nm[i])}</span><span class="pw-out-meta">${g.length === 1 ? `page ${g[0] + 1}` : `${formatRange(g).length < 24 ? `pages ${formatRange(g)}` : `${g.length} pages`}`}</span></li>`).join('')
        + (n > shown.length ? `<li class="pw-out-more">and ${n - shown.length} more</li>` : '');
      goBtn.disabled = !n;
      goBtn.querySelector('span').textContent = !n ? 'Split' : n === 1 ? `Save ${plan.groups[0].length} page${plan.groups[0].length === 1 ? '' : 's'} as PDF` : `Split into ${n} PDFs`;
      noteEl.textContent = n > 1 ? 'Several files download together as one ZIP.' : '';
      const err = modeEl.querySelector('.pw-err');
      if (err) { err.hidden = !plan.errors.length; err.textContent = plan.errors.length ? `Not understood: ${plan.errors.join(', ')}` : ''; }
    }

    function renderMode() {
      const count = grid.pages.length;
      const outline = (src?.outline || []).filter(o => Number.isInteger(o.pageIndex));
      const depths = [...new Set(outline.map(o => o.depth))].sort();
      modeEl.innerHTML = {
        ranges: `<label class="pw-field"><span>Page ranges</span>
            <input type="text" class="tool-input" id="ps-ranges" value="${esc(rangeSpec)}" placeholder="e.g. 1-3, 5, 8-" autocomplete="off" spellcheck="false"></label>
            <p class="pw-hint">Each comma makes a separate file. <code>8-</code> runs to the end, <code>odd</code> and <code>even</code> work too. Or click pages.</p>
            <p class="pw-err" hidden></p>`,
        every: `<label class="pw-field"><span>Pages per file</span>
            <div class="pw-stepper"><button type="button" class="pw-tbtn pw-icon-btn" data-step="-1" aria-label="Fewer">${icon('left', 16)}</button>
            <input type="number" class="tool-input" id="ps-every" min="1" max="${count}" value="${everyN}">
            <button type="button" class="pw-tbtn pw-icon-btn" data-step="1" aria-label="More">${icon('right', 16)}</button></div></label>
            <p class="pw-hint">${count} pages in chunks of ${everyN}.</p>`,
        bookmarks: outline.length
          ? `<label class="pw-field"><span>Split at</span><select class="tool-select" id="ps-depth">${depths.map(d => `<option value="${d}"${d === bmDepth ? ' selected' : ''}>${d === 0 ? 'Top-level bookmarks' : `Bookmarks up to level ${d + 1}`}</option>`).join('')}</select></label>
             <p class="pw-hint">${outline.filter(o => o.depth === 0).length} top-level bookmark${outline.filter(o => o.depth === 0).length === 1 ? '' : 's'} found. Each starts a new file.</p>`
          : `<p class="pw-empty-note">${icon('info', 16)}<span>This PDF has no bookmarks. Use ranges or every N pages instead.</span></p>`,
        selected: `<p class="pw-hint">Click pages in the grid (shift-click for a run). ${grid.selected.size} selected.</p>
            <label class="pw-check-row"><input type="checkbox" id="ps-remove" ${removeSelected ? 'checked' : ''}><span>Remove the selected pages and keep the rest</span></label>`,
        each: `<p class="pw-hint">Every page becomes its own PDF: ${count} files in a ZIP.</p>`,
      }[mode];
    }

    function updateSelInfo() {
      const n = grid.selected.size;
      container.querySelector('#ps-selinfo').textContent = n ? `${n} selected` : `${grid.pages.length} pages`;
      if (mode === 'selected') { const h = modeEl.querySelector('.pw-hint'); if (h) h.textContent = `Click pages in the grid (shift-click for a run). ${n} selected.`; }
    }

    /* ---------- load ---------- */

    async function load(files) {
      const file = files[0];
      if (!file) return;
      analytics?.started();
      await runTask(root, 'Opening PDF', async () => {
        const next = await session.add(file);
        if (src) { session.remove(src.id); thumbs.dropSource(src.id); }
        src = next;
        container.querySelector('#ps-name').textContent = src.name;
        container.querySelector('#ps-meta').textContent = fileSummary(src);
        zone.hidden = true;
        work.hidden = false;
        rangeSpec = '';
        grid.setPages(session.pageItems(src.id), { keepSelection: false });
        if (mode === 'bookmarks' && !src.outline.some(o => Number.isInteger(o.pageIndex))) mode = 'ranges';
        root.querySelectorAll('[data-seg="mode"] button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === mode)));
        renderMode();
        recompute();
        updateSelInfo();
      }, { onError: (err) => { if (!err?.passwordCancelled) notify(err.message || 'That file could not be opened.', 'error'); analytics?.error('pdf_unreadable'); } });
    }
    this._load = load;

    this._cleanup.push(attachFileInput(zone, container.querySelector('#ps-zone-input'), load, { accept: /pdf/i }));

    /* ---------- events ---------- */

    bindSegmented(root, (name, v) => {
      if (name !== 'mode') return;
      mode = v;
      renderMode();
      recompute();
    });

    modeEl.addEventListener('input', (e) => {
      if (e.target.id === 'ps-ranges') {
        rangeSpec = e.target.value;
        recompute();
        grid.select(plan.groups.flat().map(i => grid.pages[i].id), { silent: true });
      } else if (e.target.id === 'ps-every') {
        everyN = Math.max(1, Math.min(grid.pages.length || 1, parseInt(e.target.value, 10) || 1));
        const hint = modeEl.querySelector('.pw-hint');
        if (hint) hint.textContent = `${grid.pages.length} pages in chunks of ${everyN}.`;
        recompute();
      }
    });
    modeEl.addEventListener('change', (e) => {
      if (e.target.id === 'ps-depth') { bmDepth = Number(e.target.value); recompute(); }
      if (e.target.id === 'ps-remove') { removeSelected = e.target.checked; recompute(); }
    });
    modeEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-step]');
      if (!b) return;
      const input = modeEl.querySelector('#ps-every');
      input.value = Math.max(1, Math.min(grid.pages.length, (parseInt(input.value, 10) || 1) + Number(b.dataset.step)));
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    container.querySelector('.pw-toolbar').addEventListener('click', (e) => {
      const s = e.target.closest('[data-sel]')?.dataset.sel;
      if (s === 'all') grid.selectAll();
      else if (s === 'none') grid.selectNone();
      else if (s === 'invert') grid.invert();
      const r = e.target.closest('[data-rot]')?.dataset.rot;
      if (r) {
        const ids = grid.selected.size ? [...grid.selected] : grid.pages.map(p => p.id);
        grid.rotate(ids, Number(r));
      }
    });

    container.querySelector('#ps-another').addEventListener('click', () => container.querySelector('#ps-zone-input').click());

    goBtn.addEventListener('click', async () => {
      if (!src || !plan.groups.length) return;
      const nm = names();
      const groups = plan.groups;
      await runTask(root, groups.length > 1 ? `Splitting into ${groups.length} files` : 'Building PDF', async ({ signal, progress }) => {
        const lib = await session.libDoc(src.id, { signal, onProgress: (f) => progress(f * 0.3, 'Preparing encrypted file') });
        const files = [];
        for (let g = 0; g < groups.length; g++) {
          checkAbort(signal);
          const items = groups[g].map(i => grid.pages[i]);
          const { doc } = await composeDocument(items.map(p => ({ src: 0, index: p.index, rotate: p.rotate })), async () => lib, { keepStructure: false, signal });
          doc.setProducer('Toolbox');
          files.push({ name: nm[g], data: await savePdf(doc) });
          progress((g + 1) / groups.length, `Building ${g + 1} of ${groups.length}`);
          if (g % 4 === 3) await tick();
        }
        const size = downloadFiles(files, `${baseName(src.name)}-split.zip`);
        notify(files.length > 1 ? `Saved ${files.length} PDFs as a ZIP (${humanBytes(size)}).` : `Saved ${nm[0]} (${humanBytes(size)}).`, 'success');
        analytics?.completed({ fileCount: 1, resultCount: files.length, bytesOut: size });
        analytics?.downloaded({ fileCount: files.length });
      });
    });

    this._downloadBytes = downloadBytes;
    void displayRot;

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
