/* ============================================================
   N-up & Booklet — several pages per sheet to save paper, or a
   saddle-stitched booklet: print double-sided, fold, staple.
   ============================================================ */

import { makeFileTool } from '../lib/kit/file-tool.js';
import { nUp, booklet, outName } from '../lib/pdf/ops.js';

const SHEETS = [['a4', 'A4'], ['letter', 'US Letter'], ['a3', 'A3'], ['legal', 'US Legal'], ['a5', 'A5'], ['tabloid', 'Tabloid']];

export default makeFileTool({
  id: 'pdf-nup',
  accept: 'application/pdf,.pdf',
  dropLabel: 'Drop a PDF to lay out',
  action: 'Lay out pages',
  fields: [
    { key: 'layout', label: 'Layout', type: 'seg', options: [['nup', 'Pages per sheet'], ['booklet', 'Booklet']], value: 'nup' },
    { key: 'per', label: 'Pages per sheet', type: 'select', options: [['2', '2'], ['4', '4'], ['6', '6'], ['8', '8'], ['9', '9'], ['16', '16']], value: '2', show: (v) => v.layout === 'nup' },
    { key: 'sheet', label: 'Sheet size', type: 'select', options: [...SHEETS, ['same', 'Same as the pages']], value: 'a4' },
    { key: 'orientation', label: 'Orientation', type: 'select', options: [['auto', 'Best fit'], ['portrait', 'Portrait'], ['landscape', 'Landscape']], value: 'auto', show: (v) => v.layout === 'nup' },
    { key: 'order', label: 'Order', type: 'select', options: [['row', 'Across, then down'], ['column', 'Down, then across']], value: 'row', show: (v) => v.layout === 'nup' },
    { key: 'margin', label: 'Margin (mm)', type: 'number', value: 8, min: 0, max: 40 },
    { key: 'gap', label: 'Gap (mm)', type: 'number', value: 4, min: 0, max: 30, show: (v) => v.layout === 'nup' },
    { key: 'creep', label: 'Creep per sheet (mm)', type: 'number', value: 0, min: 0, max: 2, step: 0.1, show: (v) => v.layout === 'booklet', hint: 'For thick booklets: nudges inner pages toward the fold.' },
    { key: 'border', label: 'Thin border around each page', type: 'checkbox', value: false, show: (v) => v.layout === 'nup' },
  ],
  note: (files) => (files.length ? 'Booklets print double-sided, flipping on the short edge.' : ''),
  async run([f], v, { signal, progress }) {
    const bytes = await f.bytes();
    const out = v.layout === 'booklet'
      ? await booklet(bytes, { sheet: v.sheet === 'same' ? 'a4' : v.sheet, margin: v.margin, creep: v.creep }, { signal, onProgress: progress })
      : await nUp(bytes, { perSheet: Number(v.per), sheet: v.sheet, orientation: v.orientation, margin: v.margin, gap: v.gap, border: v.border, order: v.order }, { signal, onProgress: progress });
    return { files: [{ name: outName(f.name, v.layout === 'booklet' ? 'booklet' : `${v.per}-up`), data: out }] };
  },
});
