/* ============================================================
   PDF Workflow — chain PDF jobs and run them in one go: clean up
   a scan, number the pages, watermark, lay out, protect. Every step
   is the same function the single tools use (js/lib/pdf/ops.js,
   js/lib/pdf/core.js), so a workflow never behaves differently
   from doing the steps by hand.
   ============================================================ */

import { makeFileTool, checkAbort } from '../lib/kit/file-tool.js';
import { mountForm, esc, defaults } from '../lib/kit/form.js';
import * as O from '../lib/pdf/ops.js';
import { loadPdfLib, openPdfLib, savePdf, applyWatermark, applyHeaderFooter, compressPdfBytes, stripMetadata, baseName, parseRange } from '../lib/pdf/core.js';
import { icon } from '../lib/icons.js';

const pagesOf = async (bytes, spec) => (spec ? parseRange(spec, (await openPdfLib(bytes)).getPageCount()) : undefined);

/** Every step: fields and bytes → bytes. */
export const STEPS = {
  blank: { label: 'Remove blank pages', fields: [{ key: 'threshold', label: 'Sensitivity (% ink)', type: 'number', value: 0.5, step: 0.1, min: 0.1 }],
    run: async (b, v, c) => (await O.removeBlankPages(b, v, c)).bytes },
  reverse: { label: 'Reverse page order', fields: [], run: (b, v, c) => O.reversePages(b, v, c) },
  rotate: { label: 'Rotate pages', fields: [{ key: 'deg', label: 'Rotate', type: 'select', options: [['90', '90° clockwise'], ['180', '180°'], ['270', '90° anticlockwise']], value: '90' }, { key: 'pages', label: 'Pages (blank = all)', type: 'text', value: '' }],
    async run(b, v) {
      const { degrees } = await loadPdfLib();
      const doc = await openPdfLib(b); const list = doc.getPages();
      const only = v.pages ? new Set(parseRange(v.pages, list.length)) : null;
      list.forEach((p, i) => { if (!only || only.has(i)) p.setRotation(degrees(((p.getRotation().angle || 0) + Number(v.deg)) % 360)); });
      return savePdf(doc);
    } },
  crop: { label: 'Trim to content', fields: [{ key: 'padding', label: 'Keep around content (mm)', type: 'number', value: 4, min: 0 }], run: (b, v, c) => O.cropPages(b, { mode: 'auto', padding: v.padding }, c) },
  filter: { label: 'Colour filter', fields: [{ key: 'filter', label: 'Filter', type: 'select', options: [['grayscale', 'Greyscale'], ['invert', 'Invert'], ['threshold', 'Black and white'], ['scan', 'Scanned look']], value: 'grayscale' }],
    run: (b, v, c) => O.filterPages(b, v.filter, { dpi: 150 }, c) },
  ocr: { label: 'OCR (make searchable)', fields: [{ key: 'lang', label: 'Language', type: 'select', options: O.OCR_LANGS, value: 'eng' }], run: async (b, v, c) => (await O.ocrPdf(b, { lang: v.lang }, c)).bytes },
  numbers: { label: 'Page numbers / Bates', fields: [
    { key: 'template', label: 'Text ({n}, {total}, {bates}, {date})', type: 'text', value: 'Page {n} of {total}' },
    { key: 'position', label: 'Where', type: 'select', options: [['bottom-center', 'Bottom centre'], ['bottom-right', 'Bottom right'], ['bottom-left', 'Bottom left'], ['top-right', 'Top right'], ['top-center', 'Top centre'], ['top-left', 'Top left']], value: 'bottom-center' },
    { key: 'batesPrefix', label: 'Bates prefix (if using {bates})', type: 'text', value: 'ABC' },
    { key: 'skipFirst', label: 'Skip the first page', type: 'checkbox', value: false }],
    async run(b, v) {
      const doc = await openPdfLib(b);
      await applyHeaderFooter(doc, { template: v.template, position: v.position, skipFirst: v.skipFirst, bates: v.template.includes('{bates}') ? { prefix: v.batesPrefix, start: 1, digits: 6 } : null });
      return savePdf(doc);
    } },
  watermark: { label: 'Watermark', fields: [{ key: 'text', label: 'Text', type: 'text', value: 'CONFIDENTIAL' }, { key: 'opacity', label: 'Opacity', type: 'range', min: 5, max: 60, value: 18, unit: '%' },
    { key: 'layout', label: 'Layout', type: 'select', options: [['center', 'Once, centred'], ['tile', 'Tiled']], value: 'center' }, { key: 'pages', label: 'Pages (blank = all)', type: 'text', value: '' }],
    async run(b, v) { const doc = await openPdfLib(b); await applyWatermark(doc, { text: v.text, opacity: v.opacity / 100, layout: v.layout, pages: await pagesOf(b, v.pages) }); return savePdf(doc); } },
  nup: { label: 'Pages per sheet', fields: [{ key: 'per', label: 'Per sheet', type: 'select', options: [['2', '2'], ['4', '4'], ['6', '6'], ['9', '9']], value: '2' }], run: (b, v, c) => O.nUp(b, { perSheet: Number(v.per) }, c) },
  booklet: { label: 'Booklet', fields: [], run: (b, v, c) => O.booklet(b, {}, c) },
  metadata: { label: 'Remove metadata', fields: [], async run(b) { const doc = await openPdfLib(b); await stripMetadata(doc); return savePdf(doc); } },
  compress: { label: 'Compress (lossless)', fields: [], run: (b) => compressPdfBytes(b) },
  linearize: { label: 'Fast web view', fields: [], run: async (b) => (await O.repairPdf(b, { mode: 'linearize' })).bytes },
  protect: { label: 'Password-protect', fields: [{ key: 'user', label: 'Password to open', type: 'text', value: '' }, { key: 'print', label: 'Allow printing', type: 'checkbox', value: true }, { key: 'copy', label: 'Allow copying', type: 'checkbox', value: true }],
    run: (b, v) => O.encryptPdf(b, { user: v.user, owner: v.user, print: v.print, copy: v.copy }) },
};

const PRESETS = {
  scan: ['blank', 'crop', 'ocr', 'compress'],
  court: ['numbers', 'metadata', 'compress'],
  share: ['watermark', 'metadata', 'protect'],
  print: ['booklet'],
};

/** Run a list of { step, values } over bytes. Exported for the Assistant and tests. */
export async function runWorkflow(bytes, steps, { signal, onProgress } = {}) {
  let cur = bytes;
  for (let i = 0; i < steps.length; i++) {
    checkAbort(signal);
    const def = STEPS[steps[i].step];
    if (!def) throw new Error(`Unknown step: ${steps[i].step}`);
    const part = (f, label) => onProgress?.((i + (Number.isFinite(f) ? f : 0)) / steps.length, `Step ${i + 1} of ${steps.length}: ${label || def.label}`);
    part(0);
    cur = await def.run(cur, defaults(def.fields, steps[i].values), { signal, onProgress: part });
  }
  return cur;
}

let chain = [];
let forms = [];

function paintSteps(host) {
  forms.forEach((f) => f.destroy());
  forms = [];
  host.innerHTML = chain.length ? chain.map((s, i) => `
    <div class="kit-step" data-i="${i}">
      <div class="kit-step-head"><span>${i + 1}. ${esc(STEPS[s.step].label)}</span>
        <button type="button" class="btn btn-ghost btn-sm" data-step-move="-1" aria-label="Move up"${i ? '' : ' disabled'}>${icon('chevron-up')}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-step-move="1" aria-label="Move down"${i < chain.length - 1 ? '' : ' disabled'}>${icon('chevron-down')}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-step-remove aria-label="Remove step">${icon('x')}</button></div>
      <div class="kit-form" data-step-form></div>
    </div>`).join('') : '<p class="kit-note">Add steps below, or start from a preset.</p>';
  host.querySelectorAll('[data-step-form]').forEach((el, i) => {
    const f = mountForm(el, STEPS[chain[i].step].fields, { prefix: `wf${i}`, initial: chain[i].values, onChange: (_, vals) => { chain[i].values = { ...vals }; } });
    chain[i].values = { ...f.values };
    el.hidden = !STEPS[chain[i].step].fields.length;
    forms.push(f);
  });
}

export default makeFileTool({
  id: 'pdf-workflow',
  accept: 'application/pdf,.pdf',
  dropLabel: 'Drop PDFs to run a workflow on',
  dropHint: 'every file goes through the same steps',
  max: 50,
  action: 'Run workflow',
  mounted(container) {
    chain = PRESETS.scan.map((step) => ({ step, values: {} }));
    const box = document.createElement('section');
    box.className = 'kit';
    box.innerHTML = `
      <div class="kit-pane-head"><span class="tool-label">Steps</span>
        <div class="kit-pane-actions">
          <select class="tool-select" data-preset aria-label="Preset" style="height:32px">
            <option value="">Presets…</option><option value="scan">Tidy a scan</option><option value="court">Court filing</option><option value="share">Share safely</option><option value="print">Print a booklet</option>
          </select>
        </div></div>
      <div class="kit-steps" data-steps></div>
      <div class="kit-actions"><select class="tool-select" data-add aria-label="Add a step" style="max-width:260px">
        <option value="">+ Add a step…</option>${Object.entries(STEPS).map(([k, s]) => `<option value="${k}">${esc(s.label)}</option>`).join('')}
      </select></div>`;
    container.querySelector('.kit').insertBefore(box, container.querySelector('[data-el="actions"]'));
    const host = box.querySelector('[data-steps]');
    paintSteps(host);
    box.querySelector('[data-add]').addEventListener('change', (e) => { if (e.target.value) { chain.push({ step: e.target.value, values: {} }); e.target.value = ''; paintSteps(host); } });
    box.querySelector('[data-preset]').addEventListener('change', (e) => { if (e.target.value) { chain = PRESETS[e.target.value].map((step) => ({ step, values: {} })); e.target.value = ''; paintSteps(host); } });
    host.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const i = Number(b.closest('[data-i]').dataset.i);
      if (b.hasAttribute('data-step-remove')) chain.splice(i, 1);
      else if (b.dataset.stepMove) { const j = i + Number(b.dataset.stepMove); [chain[i], chain[j]] = [chain[j], chain[i]]; }
      paintSteps(host);
    });
  },
  fields: () => [
    // Hidden from the form (the step list is its own UI); used when run headlessly.
    { key: 'steps', label: 'Steps', type: 'text', value: '', show: () => false, hint: `Comma-separated steps or a preset (${Object.keys(PRESETS).join(', ')}). Steps: ${Object.keys(STEPS).join(', ')}.` },
  ],
  async run(files, v, { signal, progress }) {
    const named = String(v.steps || '').trim();
    const list = named ? (PRESETS[named] || named.split(/[\s,]+/).filter(Boolean)) : null;
    if (list) { const bad = list.filter((x) => !STEPS[x]); if (bad.length) throw new Error(`Unknown step: ${bad.join(', ')}. Steps: ${Object.keys(STEPS).join(', ')}.`); }
    const steps = (list ? list.map((step) => ({ step, values: {} })) : chain)
      .map((s) => ({ step: s.step, values: defaults(STEPS[s.step].fields, s.values) }));
    if (!steps.length) throw new Error('Add at least one step.');
    const out = [];
    for (let k = 0; k < files.length; k++) {
      const f = files[k];
      const bytes = await runWorkflow(await f.bytes(), steps, { signal, onProgress: (x, label) => progress((k + x) / files.length, files.length > 1 ? `${f.name} · ${label}` : label) });
      out.push({ name: `${baseName(f.name)}-processed.pdf`, data: bytes });
    }
    return { files: out, note: `Ran ${steps.length} step${steps.length === 1 ? '' : 's'} on ${files.length} file${files.length === 1 ? '' : 's'}.`, zipName: 'workflow-output.zip' };
  },
});
