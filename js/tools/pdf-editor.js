/* ============================================================
   PDF Editor — one workspace, six toolsets:
     Organise  reorder, rotate, duplicate, delete, extract, insert blank,
               insert pages from another PDF
     Edit      text, highlight, ink, shapes, arrows, images; watermark;
               page numbers, headers/footers, Bates numbers
     Sign      draw, type or upload a signature and place it
     Forms     list and fill AcroForm fields, optionally flatten
     Protect   redaction (rasterised, so covered content is gone),
               document metadata, flatten forms
     Convert   text (.txt/.md), page images, embedded images, compress,
               Word / Excel / PowerPoint, hand-off to Split and Merge
   Everything runs in the browser; long jobs show progress and cancel.
   ============================================================ */

import { attachFileInput, dropZone } from '../lib/file-engine.js';
import {
  PdfSession, ThumbService, PageGrid, runTask, icon, esc, segmented, bindSegmented, fileSummary,
  downloadBytes, downloadFiles, notify, pickFiles, blankPage, displayRot, boxOf, uid,
} from '../lib/pdf/workspace.js';
import {
  composeDocument, drawAnnotations, applyWatermark, applyHeaderFooter, setMetadata, stripMetadata,
  listFormFields, fillFormFields, flattenForm, savePdf, baseName, humanBytes, formatRange, parseRange,
  viewToUser, viewSize, normRot, checkAbort, tick, fillTemplate, batesNumber, compressPdfBytes, openPdfLib,
} from '../lib/pdf/core.js';
import { PageViewer } from '../lib/pdf/viewer.js';
import { openPdfJs } from '../lib/pdf/pdfjs-loader.js';
import { getToolSettings } from '../lib/tool-settings.js';
import { handOff } from '../lib/artifacts.js';

const THUMB_W = { small: 96, medium: 124, large: 170 };
const TABS = [
  ['organise', 'Organise', 'organise'], ['edit', 'Edit', 'edit'], ['sign', 'Sign', 'sign'],
  ['forms', 'Forms', 'form'], ['protect', 'Protect', 'shield'], ['convert', 'Convert', 'convert'],
];
const VIEW_TABS = new Set(['edit', 'sign', 'forms', 'protect']);
const TOOLS = [
  ['select', 'select', 'Select and move (V)', 'edit sign forms protect'],
  ['text', 'text', 'Text (T)', 'edit'],
  ['highlight', 'highlight', 'Highlight (H)', 'edit'],
  ['ink', 'pen', 'Draw (D)', 'edit'],
  ['rect', 'rect', 'Rectangle (R)', 'edit'],
  ['ellipse', 'ellipse', 'Ellipse (E)', 'edit'],
  ['line', 'line', 'Line (L)', 'edit'],
  ['arrow', 'arrow', 'Arrow (A)', 'edit'],
  ['image', 'image', 'Image', 'edit'],
  ['redact', 'redact', 'Redact area (X)', 'protect'],
];
const KEYS = { v: 'select', t: 'text', h: 'highlight', d: 'ink', r: 'rect', e: 'ellipse', l: 'line', a: 'arrow', x: 'redact' };
const COLORS = ['#d92626', '#111111', '#1f7a3a', '#b45309'];
const POSITIONS = [['top-left', 'Top left'], ['top-center', 'Top centre'], ['top-right', 'Top right'], ['bottom-left', 'Bottom left'], ['bottom-center', 'Bottom centre'], ['bottom-right', 'Bottom right']];

export default {
  async render(container, { analytics, artifact } = {}) {
    this._cleanup = [];
    const prefs = getToolSettings('pdf-editor');
    const session = new PdfSession();
    const thumbs = new ThumbService(session, { width: THUMB_W[prefs.thumbSize] || 124 });
    this._session = session;
    this._thumbs = thumbs;

    /* ---------- state ---------- */
    let main = null;                       // first source
    let tab = prefs.startTab || 'organise';
    let activeId = null;
    const annots = new Map();              // page id → annotation[]
    const images = new Map();              // key → {bytes, mime, img}
    const formFields = new Map();          // src id → fields
    const formValues = new Map();          // src id → {name: value}
    const style = { color: prefs.annotColor || COLORS[0], stroke: 2, size: 14, highlight: '#ffe14d' };
    const stamps = {
      watermark: { enabled: false, text: 'CONFIDENTIAL', opacity: 0.18, angle: 45, layout: 'center', imageKey: null },
      header: { enabled: false, template: 'Page {n} of {total}', position: 'bottom-center', startAt: 1, size: 10, bates: false, prefix: 'DOC', start: 1, digits: 6 },
    };
    const meta = { title: '', author: '', subject: '', keywords: '', strip: false, touched: false };
    let flattenForms = false;
    let history = [];
    let hIndex = -1;
    const signatures = [];                 // image keys

    container.innerHTML = `
      <div class="pw" data-tool="editor" style="--pw-thumb:${THUMB_W[prefs.thumbSize] || 124}px">
        ${dropZone('pe-zone', { label: 'Drop a PDF to edit', hint: 'or click to choose · large and password-protected files are fine', accept: 'application/pdf,.pdf', multiple: false })}
        <div class="pw-work" id="pe-work" hidden>
          <header class="pw-head">
            <div class="pw-file">${icon('file', 20)}<div class="pw-file-text"><strong id="pe-name"></strong><span id="pe-meta"></span></div></div>
            <div class="pw-head-actions">
              <div class="pw-tgroup">
                <button type="button" class="pw-tbtn pw-icon-btn" id="pe-undo" title="Undo (Ctrl+Z)" aria-label="Undo">${icon('undo', 16)}</button>
                <button type="button" class="pw-tbtn pw-icon-btn" id="pe-redo" title="Redo (Ctrl+Shift+Z)" aria-label="Redo">${icon('redo', 16)}</button>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" id="pe-open">${icon('upload', 15)}<span>Open</span></button>
              <button type="button" class="btn btn-primary btn-sm" id="pe-save" data-busy-lock>${icon('download', 15)}<span>Save PDF</span></button>
            </div>
          </header>
          <nav class="pe-tabs" role="tablist" aria-label="Toolsets">
            ${TABS.map(([id, label, ic]) => `<button type="button" role="tab" class="pe-tab" data-tab="${id}" aria-selected="${id === tab}">${icon(ic, 16)}<span>${label}</span></button>`).join('')}
          </nav>
          <div class="pw-body">
            <section class="pw-main">
              <div id="pe-gridwrap">
                <div class="pw-toolbar" role="toolbar" aria-label="Pages">
                  <div class="pw-tgroup">
                    <button type="button" class="pw-tbtn" data-o="all">All</button>
                    <button type="button" class="pw-tbtn" data-o="none">None</button>
                  </div>
                  <div class="pw-tgroup" data-organise>
                    <button type="button" class="pw-tbtn pw-icon-btn" data-o="left" title="Move earlier" aria-label="Move selected earlier">${icon('left', 16)}</button>
                    <button type="button" class="pw-tbtn pw-icon-btn" data-o="right" title="Move later" aria-label="Move selected later">${icon('right', 16)}</button>
                    <button type="button" class="pw-tbtn pw-icon-btn" data-o="rotl" title="Rotate left" aria-label="Rotate selected left">${icon('rotateCcw', 16)}</button>
                    <button type="button" class="pw-tbtn pw-icon-btn" data-o="rotr" title="Rotate right" aria-label="Rotate selected right">${icon('rotateCw', 16)}</button>
                    <button type="button" class="pw-tbtn pw-icon-btn" data-o="dup" title="Duplicate" aria-label="Duplicate selected">${icon('copy', 16)}</button>
                    <button type="button" class="pw-tbtn pw-icon-btn" data-o="del" title="Delete" aria-label="Delete selected">${icon('trash', 16)}</button>
                  </div>
                  <span class="pw-tstatus" id="pe-gstatus"></span>
                </div>
                <div id="pe-grid"></div>
              </div>
              <div id="pe-viewwrap" hidden>
                <div class="pw-toolbar pe-vbar" role="toolbar" aria-label="Annotation tools">
                  <div class="pw-tgroup" id="pe-tools">
                    ${TOOLS.map(([id, ic, label, tabs]) => `<button type="button" class="pw-tbtn pw-icon-btn" data-tool="${id}" data-tabs="${tabs}" title="${label}" aria-label="${label}" aria-pressed="${id === 'select'}">${icon(ic, 17)}</button>`).join('')}
                  </div>
                  <div class="pw-tgroup" id="pe-colors" data-tabs="edit">
                    ${COLORS.map(c => `<button type="button" class="pw-tbtn pw-icon-btn" data-color="${c}" aria-label="Colour ${c}" aria-pressed="${c === style.color}"><span class="pw-swatch" style="background:${c}"></span></button>`).join('')}
                  </div>
                  <div class="pw-tgroup">
                    <button type="button" class="pw-tbtn pw-icon-btn" data-z="out" title="Zoom out" aria-label="Zoom out">${icon('zoomOut', 16)}</button>
                    <button type="button" class="pw-tbtn" data-z="fit" id="pe-zoomval" title="Fit width">100%</button>
                    <button type="button" class="pw-tbtn pw-icon-btn" data-z="in" title="Zoom in" aria-label="Zoom in">${icon('zoomIn', 16)}</button>
                  </div>
                  <div class="pw-tgroup pe-nav">
                    <button type="button" class="pw-tbtn pw-icon-btn" data-nav="-1" title="Previous page" aria-label="Previous page">${icon('left', 16)}</button>
                    <span class="pe-pageno"><input type="text" inputmode="numeric" id="pe-pageinput" aria-label="Page number"><span id="pe-pagecount"></span></span>
                    <button type="button" class="pw-tbtn pw-icon-btn" data-nav="1" title="Next page" aria-label="Next page">${icon('right', 16)}</button>
                  </div>
                </div>
                <div class="pe-stage">
                  <div class="pe-rail" id="pe-rail"></div>
                  <div class="pe-viewer" id="pe-viewer"></div>
                </div>
              </div>
            </section>
            <aside class="pw-side" id="pe-side"></aside>
          </div>
        </div>
      </div>`;

    const root = container.querySelector('.pw');
    const $ = (s) => container.querySelector(s);
    const zone = $('#pe-zone');
    const side = $('#pe-side');

    /* ---------- grid, rail, viewer ---------- */

    const grid = new PageGrid($('#pe-grid'), {
      thumbs,
      label: (p) => (p.blank ? 'Blank' : (session.sources.size > 1 ? baseName(session.get(p.src)?.name).slice(0, 14) : (annots.get(p.id)?.length ? `${annots.get(p.id).length} edit${annots.get(p.id).length === 1 ? '' : 's'}` : ''))),
      onChange: (kind) => {
        if (kind === 'pages') { commit('Organise pages'); syncRail(); }
        updateStatus();
        if (tab === 'convert') renderSide();
      },
      onOpen: (p) => { activeId = p.id; setTab('edit'); },
    });

    const rail = new PageGrid($('#pe-rail'), {
      thumbs, actions: [], reorder: false,
      onChange: (kind) => {
        if (kind !== 'selection') return;
        const p = rail.getSelected()[0];
        if (p && p.id !== activeId) showPage(p.id);
        else if (!p && activeId) rail.select([activeId], { silent: true });
      },
    });
    $('#pe-rail').classList.add('pe-rail-grid');

    const viewer = new PageViewer($('#pe-viewer'), {
      session,
      getAnnots: (id) => { if (!annots.has(id)) annots.set(id, []); return annots.get(id); },
      commit: (label) => commit(label),
      getImage: (key) => images.get(key)?.img,
      style: () => style,
      onSelect: (a) => { const b = side.querySelector('[data-act="del-annot"]'); if (b) b.disabled = !a; },
      onPlace: () => { setToolButton('select'); },
      onRedact: () => { if (tab === 'protect') renderSide(); },
      overlay: drawStampPreview,
    });

    const pages = () => grid.pages;
    const activePage = () => pages().find(p => p.id === activeId) || pages()[0];

    /* ---------- history ---------- */

    function snapshot() {
      return {
        pages: pages().map(p => ({ ...p })),
        annots: [...annots].map(([k, v]) => [k, structuredClone(v.map(a => { const { _hidden, ...rest } = a; return rest; }))]),
      };
    }
    function commit() {
      history = history.slice(0, hIndex + 1);
      history.push(snapshot());
      if (history.length > 80) history.shift();
      hIndex = history.length - 1;
      updateUndo();
      updateStatus();
    }
    function restore(s) {
      annots.clear();
      for (const [k, v] of s.annots) annots.set(k, structuredClone(v));
      grid.setPages(s.pages.map(p => ({ ...p })));
      if (!pages().some(p => p.id === activeId)) activeId = pages()[0]?.id || null;
      syncRail();
      viewer.selected = null;
      if (VIEW_TABS.has(tab)) showPage(activeId); else viewer.draw();
      updateUndo();
      updateStatus();
      if (tab === 'protect' || tab === 'convert') renderSide();
    }
    const undo = () => { if (hIndex > 0) { hIndex--; restore(history[hIndex]); } };
    const redo = () => { if (hIndex < history.length - 1) { hIndex++; restore(history[hIndex]); } };
    function updateUndo() {
      $('#pe-undo').disabled = hIndex <= 0;
      $('#pe-redo').disabled = hIndex >= history.length - 1;
    }

    /* ---------- views ---------- */

    function setTab(t) {
      tab = t;
      root.querySelectorAll('.pe-tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
      root.dataset.tab = t;
      const isView = VIEW_TABS.has(t);
      $('#pe-gridwrap').hidden = isView;
      $('#pe-viewwrap').hidden = !isView;
      root.querySelector('[data-organise]').hidden = t !== 'organise';
      grid.o.actions = t === 'organise' ? ['rotate', 'duplicate', 'delete'] : [];
      grid.o.reorder = t === 'organise';
      root.querySelectorAll('.pe-vbar [data-tabs]').forEach(el => { el.hidden = !el.dataset.tabs.split(' ').includes(t); });
      if (isView) {
        viewer.setTool('select');
        setToolButton(t === 'protect' ? 'redact' : 'select');
        syncRail();
        showPage(activeId || pages()[0]?.id);
      } else {
        grid.render();
      }
      renderSide();
      updateStatus();
    }

    function syncRail() {
      rail.setPages(pages());
      if (activeId) rail.select([activeId], { silent: true });
    }

    async function showPage(id) {
      const p = pages().find(x => x.id === id) || pages()[0];
      if (!p) return;
      activeId = p.id;
      rail.select([p.id], { silent: true });
      const cell = $('#pe-rail').querySelector(`[data-id="${p.id}"]`);
      cell?.scrollIntoView({ block: 'nearest' });
      const i = pages().indexOf(p);
      $('#pe-pageinput').value = String(i + 1);
      $('#pe-pagecount').textContent = `/ ${pages().length}`;
      await viewer.show(p);
      $('#pe-zoomval').textContent = `${Math.round(viewer.zoom * 100)}%`;
      if (tab === 'forms') highlightFieldsFor(p);
    }

    function setToolButton(t) {
      root.querySelectorAll('#pe-tools [data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
      if (t !== 'image') viewer.setTool(t);
    }

    function updateStatus() {
      if (!main) return;
      const n = pages().length;
      const edits = [...annots.values()].reduce((s, l) => s + l.length, 0);
      $('#pe-meta').textContent = `${n} page${n === 1 ? '' : 's'} · ${humanBytes(main.size)}${edits ? ` · ${edits} edit${edits === 1 ? '' : 's'}` : ''}${main.encrypted ? ' · encrypted' : ''}`;
      $('#pe-gstatus').textContent = grid.selected.size ? `${grid.selected.size} of ${n} selected` : `${n} pages`;
    }

    /* ---------- stamp preview on the page ---------- */

    function drawStampPreview(ctx, page, v) {
      const vs = viewSize(boxOf(page), displayRot(page));
      const z = v.zoom;
      const wm = stamps.watermark;
      if (wm.enabled && (wm.text || wm.imageKey)) {
        ctx.save();
        ctx.translate(vs.width * z / 2, vs.height * z / 2);
        ctx.rotate(-wm.angle * Math.PI / 180);
        ctx.globalAlpha = wm.opacity;
        const img = wm.imageKey && images.get(wm.imageKey)?.img;
        const tile = wm.layout === 'tile';
        const spots = tile ? [-1, 0, 1].flatMap(a => [-1, 0, 1].map(b => [a * vs.width * z / 3, b * vs.height * z / 3])) : [[0, 0]];
        for (const [dx, dy] of spots) {
          if (img) {
            const w = vs.width * z * 0.5 * (tile ? 0.45 : 1), h = w * img.naturalHeight / img.naturalWidth;
            ctx.drawImage(img, dx - w / 2, dy - h / 2, w, h);
          } else {
            const diag = Math.hypot(vs.width, vs.height);
            let size = Math.min(120, (diag * 0.7) / Math.max(4, wm.text.length) * 1.6);
            if (tile) size = Math.max(14, size * 0.4);
            ctx.font = `700 ${size * z}px Helvetica, Arial, sans-serif`;
            ctx.fillStyle = '#737373';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(wm.text, dx, dy);
          }
        }
        ctx.restore();
      }
      const hf = stamps.header;
      if (hf.enabled) {
        const i = pages().indexOf(page);
        const text = fillTemplate(hf.template || (hf.bates ? '{bates}' : ''), {
          n: String(hf.startAt + i), page: String(hf.startAt + i), total: String(pages().length + hf.startAt - 1),
          bates: hf.bates ? batesNumber(hf.prefix, hf.start + i, hf.digits) : '', date: new Date().toISOString().slice(0, 10),
          file: main?.name || '', title: meta.title || '',
        });
        const [pos, align] = hf.position.split('-');
        ctx.save();
        ctx.font = `${hf.size * z}px Helvetica, Arial, sans-serif`;
        ctx.fillStyle = '#262626';
        const w = ctx.measureText(text).width;
        const m = 28 * z;
        const x = align === 'left' ? m : align === 'right' ? vs.width * z - m - w : (vs.width * z - w) / 2;
        const y = pos === 'top' ? m + hf.size * z * 0.8 : vs.height * z - m;
        ctx.fillText(text, x, y);
        ctx.restore();
      }
    }

    /* ---------- side panels ---------- */

    function renderSide() {
      if (!main) return;
      side.innerHTML = PANELS[tab]();
      afterPanel[tab]?.();
    }

    const redactCount = () => {
      let n = 0, pagesWith = 0;
      for (const p of pages()) { const c = (annots.get(p.id) || []).filter(a => a.type === 'redact').length; n += c; if (c) pagesWith++; }
      return { n, pagesWith };
    };

    const PANELS = {
      organise: () => `
        <div class="pw-panel">
          <h3 class="pw-panel-title">Organise pages</h3>
          <p class="pw-panel-sub">Drag pages to reorder. Click to select, shift-click for a run. Keys: R rotates, Delete removes, Ctrl+arrows move.</p>
          <div class="pw-actions">
            <button type="button" class="btn btn-secondary" data-act="blank">${icon('blank', 16)}<span>Insert blank page</span></button>
            <button type="button" class="btn btn-secondary" data-act="insert-pdf">${icon('fileIn', 16)}<span>Insert pages from a PDF</span></button>
            <button type="button" class="btn btn-secondary" data-act="extract">${icon('extract', 16)}<span>Extract selected as PDF</span></button>
          </div>
          <p class="pw-hint">New pages go after the last selected page, or at the end.</p>
        </div>
        ${sourcesPanel()}`,

      edit: () => `
        <div class="pw-panel">
          <h3 class="pw-panel-title">Annotate</h3>
          <p class="pw-panel-sub">Pick a tool above, then draw on the page. Double-click text to edit it; drag the corner handle to resize.</p>
          <div class="pw-field"><span>Line width</span>${segmented('stroke', [['1', 'Thin'], ['2', 'Medium'], ['4', 'Thick']], String(style.stroke))}</div>
          <div class="pw-field"><span>Text size</span>${segmented('size', [['10', 'Small'], ['14', 'Medium'], ['22', 'Large']], String(style.size))}</div>
          <button type="button" class="btn btn-secondary btn-sm" data-act="del-annot" disabled>${icon('trash', 14)}<span>Delete selected annotation</span></button>
        </div>
        <div class="pw-panel">
          <label class="pw-check-row"><input type="checkbox" data-wm="enabled" ${stamps.watermark.enabled ? 'checked' : ''}><span><b>Watermark</b><small>Stamped on every page when you save.</small></span></label>
          <div class="pw-mode" data-wm-body ${stamps.watermark.enabled ? '' : 'hidden'}>
            <label class="pw-field"><span>Text</span><input type="text" class="tool-input" data-wm="text" value="${esc(stamps.watermark.text)}" maxlength="80"></label>
            <div class="pw-field"><span>Opacity</span><div class="pw-range-row"><input type="range" class="tool-range" data-wm="opacity" min="0.05" max="0.8" step="0.01" value="${stamps.watermark.opacity}"><output>${Math.round(stamps.watermark.opacity * 100)}%</output></div></div>
            <div class="pw-field"><span>Direction</span>${segmented('wm-angle', [['45', 'Diagonal'], ['0', 'Horizontal']], String(stamps.watermark.angle))}</div>
            <div class="pw-field"><span>Layout</span>${segmented('wm-layout', [['center', 'Centred'], ['tile', 'Tiled']], stamps.watermark.layout)}</div>
            <div class="pw-actions-2">
              <button type="button" class="btn btn-secondary btn-sm" data-act="wm-image">${icon('image', 14)}<span>${stamps.watermark.imageKey ? 'Change image' : 'Use an image'}</span></button>
              <button type="button" class="btn btn-ghost btn-sm" data-act="wm-image-clear" ${stamps.watermark.imageKey ? '' : 'disabled'}>Text only</button>
            </div>
          </div>
        </div>
        <div class="pw-panel">
          <label class="pw-check-row"><input type="checkbox" data-hf="enabled" ${stamps.header.enabled ? 'checked' : ''}><span><b>Page numbers, headers, footers</b><small>Including Bates numbering for legal sets.</small></span></label>
          <div class="pw-mode" data-hf-body ${stamps.header.enabled ? '' : 'hidden'}>
            <label class="pw-field"><span>Text</span><input type="text" class="tool-input" data-hf="template" value="${esc(stamps.header.template)}"></label>
            <p class="pw-hint"><code>{n}</code> page, <code>{total}</code> count, <code>{bates}</code>, <code>{date}</code>, <code>{file}</code>, <code>{title}</code></p>
            <label class="pw-field"><span>Position</span><select class="tool-select" data-hf="position">${POSITIONS.map(([v, l]) => `<option value="${v}"${v === stamps.header.position ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
            <div class="pw-row">
              <label class="pw-field"><span>Start at</span><input type="number" class="tool-input" data-hf="startAt" value="${stamps.header.startAt}" min="0"></label>
              <label class="pw-field"><span>Size</span><input type="number" class="tool-input" data-hf="size" value="${stamps.header.size}" min="6" max="36"></label>
            </div>
            <label class="pw-check-row"><input type="checkbox" data-hf="bates" ${stamps.header.bates ? 'checked' : ''}><span>Bates numbering</span></label>
            <div class="pw-row-3" data-bates ${stamps.header.bates ? '' : 'hidden'}>
              <label class="pw-field"><span>Prefix</span><input type="text" class="tool-input" data-hf="prefix" value="${esc(stamps.header.prefix)}"></label>
              <label class="pw-field"><span>First no.</span><input type="number" class="tool-input" data-hf="start" value="${stamps.header.start}" min="0"></label>
              <label class="pw-field"><span>Digits</span><input type="number" class="tool-input" data-hf="digits" value="${stamps.header.digits}" min="1" max="12"></label>
            </div>
          </div>
        </div>`,

      sign: () => `
        <div class="pw-panel">
          <h3 class="pw-panel-title">Create a signature</h3>
          ${segmented('sigmode', [['draw', 'Draw'], ['type', 'Type'], ['upload', 'Upload']], 'draw')}
          <div class="pe-sig" data-sig="draw"><canvas class="pe-sigpad" width="560" height="200" aria-label="Signature pad"></canvas><button type="button" class="pw-tbtn pe-sig-clear" data-act="sig-clear">Clear</button></div>
          <div class="pe-sig" data-sig="type" hidden>
            <input type="text" class="tool-input" data-sigtext placeholder="Your name" maxlength="60">
            <div class="pe-sigfonts">${['"Brush Script MT", "Segoe Script", cursive', '"Snell Roundhand", "Apple Chancery", cursive', 'Georgia, "Times New Roman", serif'].map((f, i) => `<button type="button" class="pe-sigfont" data-font='${f}' aria-pressed="${i === 0}" style='font-family:${f}'>Signature</button>`).join('')}</div>
          </div>
          <div class="pe-sig" data-sig="upload" hidden>
            <button type="button" class="btn btn-secondary btn-sm" data-act="sig-upload">${icon('upload', 14)}<span>Choose image</span></button>
            <label class="pw-check-row"><input type="checkbox" data-sigbg checked><span>Remove white background</span></label>
            <div class="pe-sigpreview" data-sigpreview></div>
          </div>
          <button type="button" class="btn btn-primary" data-act="sig-add">${icon('check', 15)}<span>Use this signature</span></button>
        </div>
        <div class="pw-panel">
          <h3 class="pw-panel-title">Place on the page</h3>
          ${signatures.length ? `<div class="pe-siglist">${signatures.map(k => `<button type="button" class="pe-sigitem" data-sigkey="${k}" title="Click, then click on the page"><img src="${images.get(k).url}" alt="Signature"></button>`).join('')}</div>
          <p class="pw-hint">Choose a signature, then click where it should go. Drag to move; drag the corner to resize.</p>` : '<p class="pw-hint">Signatures you create appear here. They stay on this device and are forgotten when you leave.</p>'}
          <div class="pw-actions-2">
            <button type="button" class="btn btn-secondary btn-sm" data-act="stamp-date">${icon('text', 14)}<span>Add date</span></button>
            <button type="button" class="btn btn-secondary btn-sm" data-act="stamp-initials">${icon('text', 14)}<span>Add initials</span></button>
          </div>
        </div>`,

      forms: () => {
        const all = [...formFields.entries()].flatMap(([srcId, fields]) => fields.map(f => ({ ...f, srcId })));
        const fillable = all.filter(f => ['text', 'checkbox', 'radio', 'dropdown', 'list'].includes(f.type));
        if (!fillable.length) return `<div class="pw-panel"><h3 class="pw-panel-title">Form fields</h3><p class="pw-empty-note">${icon('info', 16)}<span>This PDF has no fillable form fields. Use Edit, then the Text tool, to type onto the page.</span></p></div>`;
        const val = (f) => formValues.get(f.srcId)?.[f.name] ?? f.value;
        return `<div class="pw-panel">
          <div class="pw-panel-head"><h3 class="pw-panel-title">Form fields</h3><span class="pw-chip">${fillable.length}</span></div>
          <div class="pe-fields">${fillable.map((f, i) => {
            const id = `pe-f${i}`;
            const attrs = `data-src="${f.srcId}" data-field="${esc(f.name)}" ${f.readOnly ? 'disabled' : ''}`;
            const label = `<span>${esc(f.name)}${f.required ? ' *' : ''}${f.page != null ? `<button type="button" class="pe-goto" data-goto="${f.srcId}:${f.page}">p. ${f.page + 1}</button>` : ''}</span>`;
            if (f.type === 'checkbox') return `<label class="pw-check-row"><input type="checkbox" ${attrs} ${val(f) === true || val(f) === 'true' ? 'checked' : ''}><span>${esc(f.name)}</span></label>`;
            if (f.type === 'radio' || f.type === 'dropdown' || f.type === 'list') return `<label class="pw-field">${label}<select class="tool-select" ${attrs}><option value="">—</option>${f.options.map(o => `<option${o === val(f) ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
            return `<label class="pw-field" for="${id}">${label}${f.multiline ? `<textarea class="tool-input" id="${id}" ${attrs}>${esc(val(f))}</textarea>` : `<input type="text" class="tool-input" id="${id}" ${attrs} value="${esc(val(f))}" ${f.maxLength ? `maxlength="${f.maxLength}"` : ''}>`}</label>`;
          }).join('')}</div>
          <label class="pw-check-row"><input type="checkbox" data-act="flatten" ${flattenForms ? 'checked' : ''}><span>Flatten on save<small>Makes answers part of the page so they cannot be changed.</small></span></label>
        </div>`;
      },

      protect: () => {
        const r = redactCount();
        return `<div class="pw-panel">
          <div class="pw-panel-head"><h3 class="pw-panel-title">Redact</h3><span class="pw-chip">${r.n ? `${r.n} area${r.n === 1 ? '' : 's'} · ${r.pagesWith} page${r.pagesWith === 1 ? '' : 's'}` : 'None'}</span></div>
          <p class="pw-panel-sub">Drag boxes over anything to remove: names, numbers, signatures.</p>
          <p class="pw-warn">${icon('alert', 16)}<span>When you save, pages with redactions are rebuilt as images with the boxes burnt in, so the hidden content is permanently removed. Other text on those pages will no longer be selectable or searchable.</span></p>
          <button type="button" class="btn btn-ghost btn-sm" data-act="clear-redactions" ${r.n ? '' : 'disabled'}>Remove all redaction boxes</button>
        </div>
        <div class="pw-panel">
          <h3 class="pw-panel-title">Document properties</h3>
          <label class="pw-field"><span>Title</span><input type="text" class="tool-input" data-meta="title" value="${esc(meta.title)}"></label>
          <label class="pw-field"><span>Author</span><input type="text" class="tool-input" data-meta="author" value="${esc(meta.author)}"></label>
          <label class="pw-field"><span>Subject</span><input type="text" class="tool-input" data-meta="subject" value="${esc(meta.subject)}"></label>
          <label class="pw-field"><span>Keywords</span><input type="text" class="tool-input" data-meta="keywords" value="${esc(meta.keywords)}" placeholder="comma, separated"></label>
          <label class="pw-check-row"><input type="checkbox" data-meta="strip" ${meta.strip ? 'checked' : ''}><span>Remove all metadata<small>Clears author, software and dates, including XMP.</small></span></label>
          <label class="pw-check-row"><input type="checkbox" data-act="flatten" ${flattenForms ? 'checked' : ''}><span>Flatten form fields</span></label>
        </div>`;
      },

      convert: () => {
        const sel = grid.selected.size;
        return `<div class="pw-panel">
          <h3 class="pw-panel-title">Convert</h3>
          <div class="pw-field"><span>Pages</span>${segmented('scope', [['all', `All ${pages().length}`], ['selected', `Selected (${sel})`]], sel ? 'selected' : 'all')}</div>
          <div class="pw-actions-2">
            <button type="button" class="btn btn-secondary btn-sm" data-act="text-md">${icon('textFile', 14)}<span>Text .md</span></button>
            <button type="button" class="btn btn-secondary btn-sm" data-act="text-txt">${icon('textFile', 14)}<span>Text .txt</span></button>
            <button type="button" class="btn btn-secondary btn-sm" data-act="img-png">${icon('image', 14)}<span>Pages PNG</span></button>
            <button type="button" class="btn btn-secondary btn-sm" data-act="img-jpeg">${icon('image', 14)}<span>Pages JPEG</span></button>
          </div>
          <div class="pw-field"><span>Image resolution</span><div class="pw-range-row"><input type="range" class="tool-range" data-dpi min="72" max="300" step="6" value="${prefs.imageDpi || 150}"><output>${prefs.imageDpi || 150} dpi</output></div></div>
          <button type="button" class="btn btn-secondary btn-sm" data-act="extract-images">${icon('image', 14)}<span>Extract embedded images</span></button>
        </div>
        <div class="pw-panel">
          <h3 class="pw-panel-title">Compress</h3>
          ${segmented('compress', [['lossless', 'Lossless'], ['downsample', 'Downsample']], 'lossless')}
          <div data-downsample hidden class="pw-mode">
            <div class="pw-field"><span>Resolution</span><div class="pw-range-row"><input type="range" class="tool-range" data-cdpi min="50" max="200" step="10" value="110"><output>110 dpi</output></div></div>
            <p class="pw-warn">${icon('alert', 16)}<span>Downsampling re-renders every page as a JPEG image. It shrinks scans a lot, but flattens text: it will no longer be selectable or searchable.</span></p>
          </div>
          <button type="button" class="btn btn-secondary" data-act="compress">${icon('compress', 15)}<span>Compress and download</span></button>
        </div>
        <div class="pw-panel">
          <h3 class="pw-panel-title">Office and other tools</h3>
          <div class="pw-row-3">
            <button type="button" class="btn btn-secondary btn-sm" data-act="docx">Word</button>
            <button type="button" class="btn btn-secondary btn-sm" data-act="xlsx">Excel</button>
            <button type="button" class="btn btn-secondary btn-sm" data-act="pptx">PowerPoint</button>
          </div>
          <div class="pw-row-3">
            <button type="button" class="btn btn-ghost btn-sm" data-act="to-split">Split</button>
            <button type="button" class="btn btn-ghost btn-sm" data-act="to-merge">Merge</button>
            <button type="button" class="btn btn-ghost btn-sm" data-act="to-analyzer">Analyze</button>
          </div>
        </div>`;
      },
    };

    function sourcesPanel() {
      if (session.sources.size < 2) return '';
      return `<div class="pw-panel"><h3 class="pw-panel-title">Sources</h3><ol class="pw-outlist">${[...session.sources.values()].map(s => `<li><span class="pw-out-name">${esc(s.name)}</span><span class="pw-out-meta">${s.pageCount} p</span></li>`).join('')}</ol></div>`;
    }

    const afterPanel = {
      sign: () => setupSignaturePad(),
      forms: () => { const p = activePage(); if (p) highlightFieldsFor(p); },
    };

    function highlightFieldsFor(p) {
      side.querySelectorAll('[data-goto]').forEach(b => b.classList.toggle('is-here', b.dataset.goto === `${p.src}:${p.index}`));
    }

    /* ---------- side panel events ---------- */

    const getSeg = bindSegmented(side, (name, v) => {
      if (name === 'stroke') style.stroke = Number(v);
      else if (name === 'size') style.size = Number(v);
      else if (name === 'wm-angle') { stamps.watermark.angle = Number(v); viewer.draw(); }
      else if (name === 'wm-layout') { stamps.watermark.layout = v; viewer.draw(); }
      else if (name === 'sigmode') side.querySelectorAll('[data-sig]').forEach(el => { el.hidden = el.dataset.sig !== v; });
      else if (name === 'compress') side.querySelector('[data-downsample]').hidden = v !== 'downsample';
    });

    side.addEventListener('input', (e) => {
      const t = e.target;
      if (t.dataset.wm) {
        const k = t.dataset.wm;
        if (k === 'text') stamps.watermark.text = t.value;
        if (k === 'opacity') { stamps.watermark.opacity = Number(t.value); t.nextElementSibling.textContent = `${Math.round(t.value * 100)}%`; }
        viewer.draw();
      } else if (t.dataset.hf) {
        const k = t.dataset.hf;
        if (k === 'enabled' || k === 'bates') return;
        stamps.header[k] = ['startAt', 'size', 'start', 'digits'].includes(k) ? (Number(t.value) || 0) : t.value;
        viewer.draw();
      } else if (t.dataset.meta && t.type !== 'checkbox') {
        meta[t.dataset.meta] = t.value; meta.touched = true;
      } else if (t.dataset.field != null && t.type !== 'checkbox' && t.tagName !== 'SELECT') {
        setField(t.dataset.src, t.dataset.field, t.value);
      } else if (t.hasAttribute('data-dpi') || t.hasAttribute('data-cdpi')) {
        t.nextElementSibling.textContent = `${t.value} dpi`;
      }
    });

    side.addEventListener('change', (e) => {
      const t = e.target;
      if (t.dataset.wm === 'enabled') { stamps.watermark.enabled = t.checked; side.querySelector('[data-wm-body]').hidden = !t.checked; viewer.draw(); }
      else if (t.dataset.hf === 'enabled') { stamps.header.enabled = t.checked; side.querySelector('[data-hf-body]').hidden = !t.checked; viewer.draw(); }
      else if (t.dataset.hf === 'bates') {
        stamps.header.bates = t.checked;
        side.querySelector('[data-bates]').hidden = !t.checked;
        const tpl = side.querySelector('[data-hf="template"]');
        if (t.checked && !/\{bates\}/.test(tpl.value)) { tpl.value = '{bates}'; stamps.header.template = '{bates}'; stamps.header.position = 'bottom-right'; side.querySelector('[data-hf="position"]').value = 'bottom-right'; }
        viewer.draw();
      } else if (t.dataset.hf === 'position') { stamps.header.position = t.value; viewer.draw(); }
      else if (t.dataset.meta === 'strip') { meta.strip = t.checked; meta.touched = true; }
      else if (t.dataset.act === 'flatten') flattenForms = t.checked;
      else if (t.dataset.field != null && (t.type === 'checkbox' || t.tagName === 'SELECT')) setField(t.dataset.src, t.dataset.field, t.type === 'checkbox' ? t.checked : t.value);
    });

    function setField(srcId, name, value) {
      if (!formValues.has(srcId)) formValues.set(srcId, {});
      formValues.get(srcId)[name] = value;
    }

    side.addEventListener('click', async (e) => {
      const goto = e.target.closest('[data-goto]');
      if (goto) {
        e.preventDefault();
        const [srcId, idx] = goto.dataset.goto.split(':');
        const p = pages().find(x => x.src === srcId && x.index === Number(idx));
        if (p) showPage(p.id);
        return;
      }
      const sig = e.target.closest('[data-sigkey]');
      if (sig) {
        const im = images.get(sig.dataset.sigkey);
        const w = 150, h = w * im.img.naturalHeight / im.img.naturalWidth;
        side.querySelectorAll('[data-sigkey]').forEach(b => b.classList.toggle('is-armed', b === sig));
        viewer.arm({ key: sig.dataset.sigkey, width: w, height: h, sign: true });
        setToolButton('place');
        notify('Click on the page to place the signature.');
        return;
      }
      const font = e.target.closest('[data-font]');
      if (font) { side.querySelectorAll('[data-font]').forEach(b => b.setAttribute('aria-pressed', String(b === font))); return; }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act || e.target.closest('input')) return;
      await ACTIONS[act]?.();
    });

    /* ---------- signature pad ---------- */

    let sigUpload = null;
    function setupSignaturePad() {
      const pad = side.querySelector('.pe-sigpad');
      if (!pad) return;
      const ctx = pad.getContext('2d');
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 3.2; ctx.strokeStyle = '#111';
      let last = null;
      const pt = (e) => { const r = pad.getBoundingClientRect(); return { x: (e.clientX - r.left) * pad.width / r.width, y: (e.clientY - r.top) * pad.height / r.height }; };
      pad.addEventListener('pointerdown', (e) => { pad.setPointerCapture(e.pointerId); last = pt(e); pad.dataset.dirty = '1'; ctx.beginPath(); ctx.arc(last.x, last.y, 1.4, 0, Math.PI * 2); ctx.fillStyle = '#111'; ctx.fill(); });
      pad.addEventListener('pointermove', (e) => {
        if (!last) return;
        const p = pt(e);
        ctx.beginPath(); ctx.moveTo(last.x, last.y);
        ctx.quadraticCurveTo(last.x, last.y, (last.x + p.x) / 2, (last.y + p.y) / 2);
        ctx.lineTo(p.x, p.y); ctx.stroke();
        last = p;
      });
      const up = () => { last = null; };
      pad.addEventListener('pointerup', up);
      pad.addEventListener('pointercancel', up);
    }

    /** Crop a canvas to its inked area and return PNG bytes. */
    async function trimToPng(canvas) {
      const ctx = canvas.getContext('2d');
      const { width: w, height: h } = canvas;
      const data = ctx.getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) return null;
      const pad = 6;
      x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
      const out = document.createElement('canvas');
      out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
      out.getContext('2d').drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
      const blob = await new Promise(r => out.toBlob(r, 'image/png'));
      return new Uint8Array(await blob.arrayBuffer());
    }

    async function storeImage(bytes, mime) {
      const key = uid('img');
      const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
      const img = new Image();
      img.src = url;
      await img.decode().catch(() => {});
      images.set(key, { bytes, mime, img, url });
      return key;
    }

    /** Any image file → PNG or JPEG bytes pdf-lib can embed. */
    async function imageFileToBytes(file, { removeWhite = false } = {}) {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const s = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
      const ctx = c.getContext('2d');
      ctx.drawImage(bmp, 0, 0, c.width, c.height);
      bmp.close?.();
      if (removeWhite) {
        const id = ctx.getImageData(0, 0, c.width, c.height);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
          const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
          if (l > 225) d[i + 3] = 0; else if (l > 180) d[i + 3] = Math.round(d[i + 3] * (225 - l) / 45);
        }
        ctx.putImageData(id, 0, 0);
        return { bytes: await trimToPng(c), mime: 'image/png' };
      }
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: 'image/png' };
    }

    function stampText(text, { size = 12 } = {}) {
      const p = activePage();
      if (!p) return;
      const box = boxOf(p), rot = displayRot(p);
      const vs = viewSize(box, rot);
      const u = viewToUser(box, rot, vs.width / 2 - text.length * size * 0.25, vs.height / 2);
      const list = annots.get(p.id) || [];
      annots.set(p.id, list);
      const a = { id: uid('a'), type: 'text', x: u.x, y: u.y, size, rot, text, color: '#111111' };
      list.push(a);
      commit('Add text');
      viewer.setTool('select'); setToolButton('select');
      viewer.select(a);
      notify('Drag the text to where it belongs.');
    }

    /* ---------- actions ---------- */

    const insertionIndex = () => { const idx = grid.selectedIndices(); return idx.length ? idx.at(-1) + 1 : pages().length; };

    const ACTIONS = {
      blank: () => {
        const at = insertionIndex();
        grid.insertAt(at, [blankPage(pages()[at - 1] || pages()[0])]);
      },
      'insert-pdf': async () => {
        const [file] = await pickFiles();
        if (!file) return;
        await runTask(root, `Opening ${file.name}`, async () => {
          const src = await session.add(file);
          await loadFormFields(src);
          grid.insertAt(insertionIndex(), session.pageItems(src.id));
          notify(`Inserted ${src.pageCount} page${src.pageCount === 1 ? '' : 's'} from ${src.name}.`, 'success');
          renderSide();
        }, { onError: (err) => { if (!err?.passwordCancelled) notify(err.message, 'error'); } });
      },
      extract: async () => {
        const sel = grid.getSelected();
        if (!sel.length) { notify('Select the pages to extract first.'); return; }
        await runTask(root, `Extracting ${sel.length} page${sel.length === 1 ? '' : 's'}`, async ({ signal, progress }) => {
          const bytes = await build({ signal, progress, only: sel });
          downloadBytes(bytes, `${baseName(main.name)}-p${formatRange(grid.selectedIndices()).replace(/\s/g, '')}.pdf`, 'application/pdf');
        });
      },
      'del-annot': () => viewer.deleteSelected(),
      'wm-image': async () => {
        const [file] = await pickFiles({ accept: 'image/*' });
        if (!file) return;
        try {
          const { bytes, mime } = await imageFileToBytes(file);
          stamps.watermark.imageKey = await storeImage(bytes, mime);
          stamps.watermark.enabled = true;
          renderSide(); viewer.draw();
        } catch { notify('That image could not be read.', 'error'); }
      },
      'wm-image-clear': () => { stamps.watermark.imageKey = null; renderSide(); viewer.draw(); },
      'sig-clear': () => { const pad = side.querySelector('.pe-sigpad'); pad.getContext('2d').clearRect(0, 0, pad.width, pad.height); delete pad.dataset.dirty; },
      'sig-upload': async () => {
        const [file] = await pickFiles({ accept: 'image/*' });
        if (!file) return;
        sigUpload = file;
        const prev = side.querySelector('[data-sigpreview]');
        prev.innerHTML = `<img alt="" src="${URL.createObjectURL(file)}">`;
      },
      'sig-add': async () => {
        const mode = getSeg('sigmode') || 'draw';
        let bytes = null;
        if (mode === 'draw') {
          const pad = side.querySelector('.pe-sigpad');
          if (!pad.dataset.dirty) { notify('Draw your signature in the box first.'); return; }
          bytes = await trimToPng(pad);
        } else if (mode === 'type') {
          const text = side.querySelector('[data-sigtext]').value.trim();
          if (!text) { notify('Type your name first.'); return; }
          const font = side.querySelector('[data-font][aria-pressed="true"]')?.dataset.font || 'cursive';
          const c = document.createElement('canvas');
          c.width = 1400; c.height = 280;
          const ctx = c.getContext('2d');
          ctx.font = `120px ${font}`;
          ctx.fillStyle = '#111';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, 30, 140, 1340);
          bytes = await trimToPng(c);
        } else {
          if (!sigUpload) { notify('Choose an image of your signature first.'); return; }
          bytes = (await imageFileToBytes(sigUpload, { removeWhite: side.querySelector('[data-sigbg]').checked })).bytes;
        }
        if (!bytes) { notify('The signature is empty.'); return; }
        const key = await storeImage(bytes, 'image/png');
        signatures.push(key);
        renderSide();
        side.querySelector(`[data-sigkey="${key}"]`)?.click();
      },
      'stamp-date': () => stampText(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })),
      'stamp-initials': async () => {
        const { tbPrompt } = await import('../lib/dialog.js');
        const v = await tbPrompt('Initials to place on the page', '', { title: 'Add initials', confirmText: 'Place' });
        if (v && v.trim()) stampText(v.trim().slice(0, 8), { size: 16 });
      },
      'clear-redactions': () => {
        for (const [k, list] of annots) annots.set(k, list.filter(a => a.type !== 'redact'));
        commit('Clear redactions'); viewer.draw(); renderSide();
      },
      'text-md': () => convertText('md'),
      'text-txt': () => convertText('txt'),
      'img-png': () => convertImages('png'),
      'img-jpeg': () => convertImages('jpeg'),
      'extract-images': async () => {
        await withPdf('Extracting images', async (pdf, indices, { signal, progress }) => {
          const { extractImages } = await import('../lib/pdf/raster.js');
          const files = await extractImages(pdf, { pages: indices, signal, onProgress: progress, base: baseName(main.name) });
          if (!files.length) { notify('No embedded images were found on those pages.'); return; }
          downloadFiles(files, `${baseName(main.name)}-images.zip`);
          notify(`Saved ${files.length} image${files.length === 1 ? '' : 's'}.`, 'success');
        });
      },
      compress: async () => {
        const mode = getSeg('compress') || 'lossless';
        const dpi = Number(side.querySelector('[data-cdpi]')?.value || 110);
        await runTask(root, 'Compressing', async ({ signal, progress }) => {
          let bytes = await build({ signal, progress: (f, l) => progress(f * 0.4, l) });
          if (mode === 'downsample') {
            const { rasterizePdf } = await import('../lib/pdf/raster.js');
            bytes = await rasterizePdf(bytes, { dpi, quality: 0.72, signal, onProgress: (f) => progress(0.4 + f * 0.6, 'Re-rendering pages') });
          } else {
            try { const c = await compressPdfBytes(bytes); if (c.length < bytes.length) bytes = c; } catch { /* keep build output */ }
          }
          const before = main.size;
          downloadBytes(bytes, `${baseName(main.name)}-compressed.pdf`, 'application/pdf');
          const pct = Math.round((1 - bytes.length / before) * 100);
          notify(pct > 0 ? `${humanBytes(before)} to ${humanBytes(bytes.length)} (${pct}% smaller).` : `Saved at ${humanBytes(bytes.length)}; this file was already compact.${mode === 'lossless' ? ' Try Downsample for scans.' : ''}`, 'success');
        });
      },
      docx: () => office('docx'),
      xlsx: () => office('xlsx'),
      pptx: () => office('pptx'),
      'to-split': () => handTo('pdf-split'),
      'to-merge': () => handTo('pdf-merge'),
      'to-analyzer': async () => {
        await withPdf('Reading text', async (pdf, indices, { signal, progress }) => {
          const { extractText, pagesToMarkdown } = await import('../lib/pdf/text.js');
          const md = pagesToMarkdown(await extractText(pdf, { pages: indices, signal, onProgress: progress }), { title: baseName(main.name) });
          handOff({ kind: 'markdown', name: `${baseName(main.name)}.md`, text: md, from: 'pdf-editor' });
          window.location.hash = '#document-analyzer';
        });
      },
    };

    /* ---------- building the output ---------- */

    const isIdentity = () => {
      const ps = pages();
      return session.sources.size === 1 && ps.length === main.pageCount && ps.every((p, i) => !p.blank && p.src === main.id && p.index === i);
    };
    const hasEdits = () => [...annots.values()].some(l => l.length) || stamps.watermark.enabled || stamps.header.enabled
      || [...formValues.values()].some(v => Object.keys(v).length) || flattenForms || meta.touched;
    const pristine = () => isIdentity() && !hasEdits() && pages().every(p => !p.rotate);

    /** Build the edited PDF. `only` limits it to some page items (extract). */
    async function build({ signal, progress = () => {}, only = null } = {}) {
      const list = only || pages();
      const identity = !only && isIdentity();
      progress(0.02, 'Assembling pages');
      const getDoc = async (srcId) => {
        const doc = await session.libDoc(srcId, { signal, onProgress: (f) => progress(f * 0.3, 'Unlocking encrypted pages') });
        const values = formValues.get(srcId);
        try {
          if (values && Object.keys(values).length) await fillFormFields(doc, values, { flatten: flattenForms || !identity });
          else if (flattenForms || !identity) flattenForm(doc);
        } catch (err) { console.warn('form fill failed', err); }
        return doc;
      };
      const { doc } = await composeDocument(list.map(p => ({ src: p.src, index: p.index, rotate: p.rotate, blank: p.blank })), getDoc, { signal, keepStructure: identity, onProgress: (f) => progress(0.3 + f * 0.3, 'Assembling pages') });
      const cache = new Map();
      const redactions = new Map();
      for (let i = 0; i < list.length; i++) {
        checkAbort(signal);
        const items = annots.get(list[i].id) || [];
        const draw = items.filter(a => a.type !== 'redact').map(a => (a.type === 'image' ? { ...a, bytes: images.get(a.key)?.bytes, mime: images.get(a.key)?.mime } : a));
        if (draw.length) await drawAnnotations(doc, i, draw, cache);
        const red = items.filter(a => a.type === 'redact');
        if (red.length) redactions.set(i, red.map(({ x, y, width, height }) => ({ x, y, width, height })));
        if (i % 20 === 19) { progress(0.6 + (i / list.length) * 0.15, 'Applying edits'); await tick(); }
      }
      if (stamps.watermark.enabled) {
        const wm = stamps.watermark;
        const im = wm.imageKey ? images.get(wm.imageKey) : null;
        await applyWatermark(doc, { text: wm.text, opacity: wm.opacity, angle: wm.angle, layout: wm.layout, image: im ? { bytes: im.bytes, type: im.mime } : null });
      }
      if (stamps.header.enabled) {
        const hf = stamps.header;
        await applyHeaderFooter(doc, {
          template: hf.template, position: hf.position, startAt: hf.startAt, size: hf.size, file: main.name, title: meta.title,
          bates: hf.bates ? { prefix: hf.prefix, start: hf.start, digits: hf.digits } : null,
        });
      }
      if (meta.strip) await stripMetadata(doc);
      else {
        if (meta.touched) await setMetadata(doc, { title: meta.title, author: meta.author, subject: meta.subject, keywords: meta.keywords });
        doc.setProducer('Toolbox');
        doc.setModificationDate(new Date());
      }
      progress(0.8, 'Saving');
      let bytes = await savePdf(doc);
      if (redactions.size) {
        const { rasterizePdf } = await import('../lib/pdf/raster.js');
        bytes = await rasterizePdf(bytes, { dpi: Math.max(150, prefs.imageDpi || 150), quality: 0.9, pages: [...redactions.keys()], redactions, signal, onProgress: (f) => progress(0.85 + f * 0.15, 'Burning in redactions') });
      }
      progress(1);
      return bytes;
    }

    /** Run fn(pdfjsDoc, pageIndices) on the current document (edited if needed). */
    async function withPdf(label, fn) {
      const scope = getSeg('scope') || 'all';
      const selIdx = grid.selectedIndices();
      await runTask(root, label, async ({ signal, progress }) => {
        let pdf, temp = false;
        if (pristine()) pdf = main.pdf;
        else {
          const bytes = await build({ signal, progress: (f, l) => progress(f * 0.4, l) });
          pdf = (await openPdfJs(bytes)).doc;
          temp = true;
        }
        try {
          const indices = scope === 'selected' && selIdx.length ? selIdx : Array.from({ length: pdf.numPages }, (_, i) => i);
          await fn(pdf, indices, { signal, progress: (f, l) => progress((temp ? 0.4 : 0) + f * (temp ? 0.6 : 1), l) });
        } finally { if (temp) pdf.destroy?.(); }
      });
    }

    async function convertText(fmt) {
      await withPdf('Extracting text', async (pdf, indices, { signal, progress }) => {
        const { extractText, pagesToText, pagesToMarkdown } = await import('../lib/pdf/text.js');
        const res = await extractText(pdf, { pages: indices, signal, onProgress: progress });
        const text = fmt === 'md' ? pagesToMarkdown(res, { title: baseName(main.name) }) : pagesToText(res);
        const chars = res.reduce((s, p) => s + p.lines.reduce((t, l) => t + l.text.length, 0), 0);
        downloadBytes(new TextEncoder().encode(text), `${baseName(main.name)}.${fmt}`, fmt === 'md' ? 'text/markdown' : 'text/plain');
        notify(chars < 20 * res.length ? 'Very little text found: this looks like a scan, which needs OCR.' : `Extracted text from ${res.length} page${res.length === 1 ? '' : 's'}.`, chars < 20 * res.length ? 'info' : 'success');
      });
    }

    async function convertImages(format) {
      const dpi = Number(side.querySelector('[data-dpi]')?.value || prefs.imageDpi || 150);
      await withPdf(`Rendering pages as ${format.toUpperCase()}`, async (pdf, indices, { signal, progress }) => {
        const { pagesToImages } = await import('../lib/pdf/raster.js');
        const files = await pagesToImages(pdf, indices, { format, dpi, base: baseName(main.name), signal, onProgress: progress });
        downloadFiles(files, `${baseName(main.name)}-${format}.zip`);
        notify(`Saved ${files.length} image${files.length === 1 ? '' : 's'}${files.length > 1 ? ' as a ZIP' : ''}.`, 'success');
      });
    }

    async function office(kind) {
      await withPdf(`Converting to ${{ docx: 'Word', xlsx: 'Excel', pptx: 'PowerPoint' }[kind]}`, async (pdf, indices, { progress }) => {
        const eng = await import('../lib/pdf-editor-engine.js');
        let blob;
        progress(0.1);
        if (kind === 'docx') blob = await eng.convertToDocx(pdf, pdf.numPages);
        else if (kind === 'xlsx') blob = await eng.convertToXlsx(pdf, pdf.numPages);
        else {
          const { renderPage, releaseCanvas } = await import('../lib/pdf/raster.js');
          blob = await eng.convertToPptx(pdf, pdf.numPages, async (i) => {
            const { canvas } = await renderPage(pdf, i, { scale: 1.6 });
            const url = canvas.toDataURL('image/jpeg', 0.88);
            releaseCanvas(canvas);
            progress((i + 1) / pdf.numPages);
            return url;
          });
        }
        downloadBytes(blob, `${baseName(main.name)}.${kind}`);
        analytics?.completed();
      });
    }

    async function handTo(route) {
      await runTask(root, 'Preparing document', async ({ signal, progress }) => {
        const bytes = pristine() ? main.bytes : await build({ signal, progress });
        handOff({ kind: 'pdf', name: `${baseName(main.name)}.pdf`, blob: new Blob([bytes], { type: 'application/pdf' }), text: `PDF document: ${main.name}`, from: 'pdf-editor' });
        window.location.hash = `#${route}`;
      });
    }

    /* ---------- loading ---------- */

    async function loadFormFields(src) {
      if (src.encrypted || !src.formFields) return;
      try { formFields.set(src.id, await listFormFields(await openPdfLib(src.bytes))); } catch { /* unreadable form */ }
    }

    async function load(files) {
      const file = files[0];
      if (!file) return;
      analytics?.started();
      await runTask(root, 'Opening PDF', async () => {
        const src = await session.add(file);
        // A new document replaces everything.
        for (const s of [...session.sources.values()]) if (s.id !== src.id) { session.remove(s.id); thumbs.dropSource(s.id); }
        main = src;
        annots.clear(); formFields.clear(); formValues.clear();
        history = []; hIndex = -1;
        Object.assign(meta, { title: src.meta.title || '', author: src.meta.author || '', subject: src.meta.subject || '', keywords: src.meta.keywords || '', strip: false, touched: false });
        await loadFormFields(src);
        $('#pe-name').textContent = src.name;
        zone.hidden = true;
        $('#pe-work').hidden = false;
        grid.setPages(session.pageItems(src.id), { keepSelection: false });
        activeId = pages()[0]?.id;
        commit('Open');
        const startTab = src.formFields && tab === 'organise' ? 'forms' : tab;
        setTab(startTab);
        if (src.encrypted) notify('Encrypted PDF opened. Saved pages will be rebuilt as images.', 'info');
      }, { onError: (err) => { if (!err?.passwordCancelled) notify(err.message || 'That file could not be opened as a PDF.', 'error'); analytics?.error('pdf_load_failed'); } });
    }
    this._load = load;

    /* ---------- wiring ---------- */

    this._cleanup.push(attachFileInput(zone, $('#pe-zone-input'), load, { accept: /pdf/i }));
    $('#pe-open').addEventListener('click', () => $('#pe-zone-input').click());
    $('#pe-undo').addEventListener('click', undo);
    $('#pe-redo').addEventListener('click', redo);

    $('#pe-save').addEventListener('click', async () => {
      if (!main) return;
      await runTask(root, 'Saving PDF', async ({ signal, progress }) => {
        const bytes = await build({ signal, progress });
        const name = `${baseName(main.name)}-edited.pdf`;
        const size = downloadBytes(bytes, name, 'application/pdf');
        notify(`Saved ${name} (${humanBytes(size)}).`, 'success');
        analytics?.completed({ bytesOut: size });
        analytics?.downloaded({ fileCount: 1, bytesOut: size });
      });
    });

    root.querySelector('.pe-tabs').addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]')?.dataset.tab;
      if (t && t !== tab) setTab(t);
    });
    root.querySelector('.pe-tabs').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const i = TABS.findIndex(([id]) => id === tab);
      const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0];
      setTab(next);
      root.querySelector(`[data-tab="${next}"]`).focus();
    });

    $('#pe-gridwrap .pw-toolbar').addEventListener('click', (e) => {
      const o = e.target.closest('[data-o]')?.dataset.o;
      if (!o) return;
      if (o === 'all') return grid.selectAll();
      if (o === 'none') return grid.selectNone();
      const ids = [...grid.selected];
      if (!ids.length) { notify('Select pages first (click, or shift-click for a run).'); return; }
      if (o === 'left') grid.shift(ids, -1);
      else if (o === 'right') grid.shift(ids, 1);
      else if (o === 'rotl') grid.rotate(ids, 270);
      else if (o === 'rotr') grid.rotate(ids, 90);
      else if (o === 'dup') grid.duplicate(ids);
      else if (o === 'del') {
        if (ids.length === pages().length) { notify('A PDF needs at least one page.'); return; }
        grid.remove(ids);
      }
    });

    const vbar = root.querySelector('.pe-vbar');
    vbar.addEventListener('click', async (e) => {
      const tool = e.target.closest('[data-tool]')?.dataset.tool;
      if (tool === 'image') {
        const [file] = await pickFiles({ accept: 'image/*' });
        if (!file) return;
        try {
          const { bytes, mime } = await imageFileToBytes(file);
          const key = await storeImage(bytes, mime);
          const im = images.get(key).img;
          const p = activePage();
          const vs = viewSize(boxOf(p), displayRot(p));
          const w = Math.min(vs.width * 0.4, im.naturalWidth * 0.75);
          viewer.arm({ key, width: w, height: w * im.naturalHeight / im.naturalWidth });
          setToolButton('image');
          notify('Click on the page to place the image.');
        } catch { notify('That image could not be read.', 'error'); }
        return;
      }
      if (tool) { setToolButton(tool); return; }
      const color = e.target.closest('[data-color]')?.dataset.color;
      if (color) {
        style.color = color;
        vbar.querySelectorAll('[data-color]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.color === color)));
        if (viewer.selected && 'color' in viewer.selected && viewer.selected.type !== 'highlight' && viewer.selected.type !== 'redact') { viewer.selected.color = color; viewer.draw(); commit('Colour'); }
        return;
      }
      const z = e.target.closest('[data-z]')?.dataset.z;
      if (z) {
        if (z === 'fit') await viewer.fitWidth();
        else await viewer.setZoom(viewer.zoom * (z === 'in' ? 1.25 : 0.8));
        $('#pe-zoomval').textContent = `${Math.round(viewer.zoom * 100)}%`;
        return;
      }
      const nav = e.target.closest('[data-nav]')?.dataset.nav;
      if (nav) {
        const i = pages().findIndex(p => p.id === activeId) + Number(nav);
        if (pages()[i]) showPage(pages()[i].id);
      }
    });
    $('#pe-pageinput').addEventListener('change', (e) => {
      const n = parseInt(e.target.value, 10);
      const p = pages()[Math.max(0, Math.min(pages().length - 1, (n || 1) - 1))];
      if (p) showPage(p.id);
    });

    const onKey = (e) => {
      if (!main || !root.isConnected || root.querySelector('#pe-work').hidden) return;
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      if (!VIEW_TABS.has(tab) || mod || e.altKey) return;
      if (e.key === 'PageDown' || e.key === 'PageUp') {
        e.preventDefault();
        const i = pages().findIndex(p => p.id === activeId) + (e.key === 'PageDown' ? 1 : -1);
        if (pages()[i]) showPage(pages()[i].id);
        return;
      }
      if (e.target.closest?.('.pw-pagegrid')) return;
      const t = KEYS[e.key.toLowerCase()];
      if (t && root.querySelector(`#pe-tools [data-tool="${t}"]:not([hidden])`) && !root.querySelector(`#pe-tools [data-tool="${t}"]`).hidden) {
        const allowed = root.querySelector(`#pe-tools [data-tool="${t}"]`).dataset.tabs.split(' ').includes(tab);
        if (allowed) setToolButton(t);
      }
    };
    document.addEventListener('keydown', onKey);
    this._cleanup.push(() => document.removeEventListener('keydown', onKey));
    this._cleanup.push(() => viewer.destroy());
    this._cleanup.push(() => { for (const im of images.values()) URL.revokeObjectURL(im.url); images.clear(); });

    root.dataset.tab = tab;
    updateUndo();

    this._getArtifact = () => {
      if (!main) return null;
      const n = pages().length;
      const edits = [...annots.values()].flat();
      let text = `# ${baseName(main.name)}\n\n- Pages: ${n} (original ${main.pageCount})\n- Annotations: ${edits.length}\n`;
      if (stamps.watermark.enabled) text += `- Watermark: ${stamps.watermark.text}\n`;
      if (stamps.header.enabled) text += `- Header/footer: ${stamps.header.template}\n`;
      const texts = pages().flatMap((p, i) => (annots.get(p.id) || []).filter(a => a.type === 'text').map(a => `${i + 1}. [Page ${i + 1}] ${a.text}`));
      if (texts.length) text += `\n## Text notes\n${texts.join('\n')}\n`;
      return { kind: 'markdown', name: `${baseName(main.name)}-summary.md`, text };
    };

    const incoming = artifact || this._incomingArtifact;
    if (incoming) this.setArtifact(incoming);
    void parseRange; void normRot;
  },

  getArtifact() {
    return this._getArtifact?.() || null;
  },

  async setArtifact(incoming) {
    if (!incoming || incoming === this._lastArtifact) return;
    this._incomingArtifact = incoming;
    if (!this._load) return;
    try {
      let fileObj = null;
      if (incoming.blob instanceof Blob) fileObj = incoming.blob;
      else if (incoming.content instanceof Blob) fileObj = incoming.content;
      else if (incoming.path) {
        const { fs } = await import('../lib/filesystem.js');
        fileObj = await fs.readFile(incoming.path, { encoding: 'blob' });
      }
      if (!fileObj) return;
      this._lastArtifact = incoming;
      await this._load([new File([fileObj], incoming.name || 'document.pdf', { type: 'application/pdf' })]);
    } catch (err) {
      console.warn('Could not load PDF artifact', err);
    }
  },

  destroy() {
    for (const fn of this._cleanup ?? []) { try { fn(); } catch { /* keep tearing down */ } }
    this._cleanup = [];
    this._thumbs?.destroy();
    this._session?.destroy();
    this._thumbs = this._session = this._load = this._getArtifact = null;
    this._lastArtifact = this._incomingArtifact = null;
  },
};
