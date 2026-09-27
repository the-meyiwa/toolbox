/* ============================================================
   PDF to Image — every page (or chosen pages) as PNG, JPG or WebP
   at the resolution you need. Several pages download as one ZIP.
   ============================================================ */

import { makeFileTool, checkAbort } from '../lib/kit/file-tool.js';
import { openPdfJs } from '../lib/pdf/pdfjs-loader.js';
import { renderPage, canvasToBlob, releaseCanvas } from '../lib/pdf/raster.js';
import { parseRange, baseName } from '../lib/pdf/core.js';

const TYPES = { png: ['image/png', 'png'], jpg: ['image/jpeg', 'jpg'], webp: ['image/webp', 'webp'] };

export default makeFileTool({
  id: 'pdf-to-image',
  accept: 'application/pdf,.pdf',
  dropLabel: 'Drop a PDF to turn into images',
  action: 'Convert to images',
  fields: [
    { key: 'format', label: 'Format', type: 'seg', options: [['png', 'PNG'], ['jpg', 'JPG'], ['webp', 'WebP']], value: 'png' },
    { key: 'dpi', label: 'Resolution', type: 'select', options: [['72', '72 dpi · screen'], ['150', '150 dpi · sharp'], ['200', '200 dpi'], ['300', '300 dpi · print']], value: '150' },
    { key: 'quality', label: 'Quality', type: 'range', min: 40, max: 100, value: 88, unit: '%', show: (v) => v.format !== 'png' },
    { key: 'pages', label: 'Pages (blank = all)', type: 'text', value: '', placeholder: 'e.g. 1-3, 7' },
  ],
  async run([f], v, { signal, progress }) {
    const { doc } = await openPdfJs(await f.bytes());
    const [mime, ext] = TYPES[v.format];
    const list = v.pages.trim() ? parseRange(v.pages, doc.numPages) : Array.from({ length: doc.numPages }, (_, i) => i);
    if (!list.length) throw new Error('None of those pages exist in this PDF');
    const pad = String(doc.numPages).length;
    const files = [];
    try {
      for (let k = 0; k < list.length; k++) {
        checkAbort(signal);
        progress(k / list.length, `Rendering page ${list[k] + 1} of ${doc.numPages}`);
        const { canvas } = await renderPage(doc, list[k], { scale: Number(v.dpi) / 72, signal });
        const blob = await canvasToBlob(canvas, mime, v.quality / 100);
        releaseCanvas(canvas);
        files.push({ name: `${baseName(f.name)}-${String(list[k] + 1).padStart(pad, '0')}.${ext}`, data: blob });
      }
    } finally { doc.destroy?.(); }
    return { files, preview: 'images', zipName: `${baseName(f.name)}-images.zip` };
  },
});
