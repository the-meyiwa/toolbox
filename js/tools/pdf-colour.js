/* ============================================================
   PDF Colour Filters — greyscale for cheaper printing, inverted
   for night reading, black-and-white, a scanned-document look, or
   a paper tint. Pages are re-rendered as images.
   ============================================================ */

import { makeFileTool } from '../lib/kit/file-tool.js';
import { filterPages, outName } from '../lib/pdf/ops.js';

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export default makeFileTool({
  id: 'pdf-colour',
  accept: 'application/pdf,.pdf',
  dropLabel: 'Drop a PDF',
  action: 'Apply filter',
  note: 'Pages are rebuilt as images, so text is no longer selectable. Run OCR PDF afterwards if you need it searchable.',
  fields: [
    { key: 'filter', label: 'Filter', type: 'select', options: [['grayscale', 'Greyscale'], ['invert', 'Invert colours'], ['threshold', 'Black and white'], ['scan', 'Scanned look'], ['tint', 'Paper tint']], value: 'grayscale' },
    { key: 'level', label: 'Threshold', type: 'range', min: 20, max: 90, value: 60, unit: '%', show: (v) => v.filter === 'threshold' },
    { key: 'colour', label: 'Tint', type: 'color', value: '#fff4d6', show: (v) => v.filter === 'tint' },
    { key: 'dpi', label: 'Quality', type: 'select', options: [['100', 'Small file (100 dpi)'], ['150', 'Balanced (150 dpi)'], ['200', 'Sharp (200 dpi)'], ['300', 'Print (300 dpi)']], value: '150' },
    { key: 'pages', label: 'Pages (blank = all)', type: 'text', value: '' },
  ],
  async run([f], v, { signal, progress }) {
    const bytes = await f.bytes();
    const pages = v.pages.trim() || null;
    const out = await filterPages(bytes, v.filter, { dpi: Number(v.dpi), level: v.level, rgb: hexRgb(v.colour), pages }, { signal, onProgress: progress });
    return { files: [{ name: outName(f.name, v.filter), data: out }] };
  },
});
