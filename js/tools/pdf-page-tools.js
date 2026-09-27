/* ============================================================
   PDF Page Tools — the page-order jobs scanners create: merge
   one-sided front and back scans, reverse, remove blank pages,
   and insert blank pages for double-sided printing.
   ============================================================ */

import { makeFileTool } from '../lib/kit/file-tool.js';
import { reversePages, interleave, removeBlankPages, insertBlanks, outName } from '../lib/pdf/ops.js';

export default makeFileTool({
  id: 'pdf-page-tools',
  accept: 'application/pdf,.pdf',
  dropLabel: 'Drop a PDF (or two for front and back scans)',
  max: 2,
  action: 'Apply',
  fields: (files) => [
    { key: 'op', label: 'Job', type: 'select', value: files.length === 2 ? 'interleave' : 'blank',
      options: [['interleave', 'Combine front and back scans'], ['blank', 'Remove blank pages'], ['reverse', 'Reverse page order'], ['insert', 'Insert blank pages']] },
    { key: 'backsReversed', label: 'Backs were scanned last page first', type: 'checkbox', value: true, show: (v) => v.op === 'interleave',
      hint: files.length === 2 ? 'First file: fronts. Second file: backs.' : 'One file: all fronts, then all backs.' },
    { key: 'threshold', label: 'Sensitivity', type: 'range', min: 0.1, max: 3, step: 0.1, value: 0.5, unit: '% ink', show: (v) => v.op === 'blank', hint: 'Pages with less ink than this count as blank. Raise it for scans with specks.' },
    { key: 'every', label: 'After every N pages', type: 'number', value: 1, min: 0, show: (v) => v.op === 'insert' },
    { key: 'after', label: 'Or after these pages', type: 'text', value: '', show: (v) => v.op === 'insert', placeholder: 'e.g. 3, 7' },
  ],
  async run(files, v, { signal, progress }) {
    const f = files[0];
    const ctx = { signal, onProgress: progress };
    if (v.op === 'interleave') {
      const list = await Promise.all(files.map((x) => x.bytes()));
      return { files: [{ name: outName(f.name, 'combined'), data: await interleave(list, { backsReversed: v.backsReversed }, ctx) }] };
    }
    const bytes = await f.bytes();
    if (v.op === 'reverse') return { files: [{ name: outName(f.name, 'reversed'), data: await reversePages(bytes, {}, ctx) }] };
    if (v.op === 'insert') return { files: [{ name: outName(f.name, 'with-blanks'), data: await insertBlanks(bytes, { every: Number(v.every) || 0, after: v.after }, ctx) }] };
    const r = await removeBlankPages(bytes, { threshold: v.threshold }, ctx);
    return { files: [{ name: outName(f.name, 'no-blanks'), data: r.bytes }], note: r.removed.length ? `Removed ${r.removed.length} blank page${r.removed.length === 1 ? '' : 's'}: ${r.removed.join(', ')}.` : 'No blank pages found at this sensitivity.' };
  },
});
