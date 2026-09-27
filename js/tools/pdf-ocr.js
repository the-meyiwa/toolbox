/* ============================================================
   OCR PDF — make a scanned PDF searchable and copyable. Pages are
   read by Tesseract on this device; the language data downloads
   once from a public CDN and is then cached.
   ============================================================ */

import { makeFileTool } from '../lib/kit/file-tool.js';
import { ocrPdf, OCR_LANGS, outName } from '../lib/pdf/ops.js';

export default makeFileTool({
  id: 'pdf-ocr',
  accept: 'application/pdf,.pdf',
  dropLabel: 'Drop a scanned PDF',
  action: 'Make searchable',
  note: 'Recognition runs on this device. The first run downloads the language data (a few MB). Expect a few seconds per page.',
  fields: [
    { key: 'lang', label: 'Language of the text', type: 'select', options: OCR_LANGS, value: 'eng' },
    { key: 'dpi', label: 'Scan detail', type: 'select', options: [['150', 'Fast (150 dpi)'], ['200', 'Balanced (200 dpi)'], ['300', 'Best for small print (300 dpi)']], value: '200' },
    { key: 'pages', label: 'Pages (blank = all)', type: 'text', value: '' },
  ],
  async run([f], v, { signal, progress }) {
    const { bytes, text } = await ocrPdf(await f.bytes(), { lang: v.lang, dpi: Number(v.dpi), pages: v.pages.trim() }, { signal, onProgress: progress });
    return {
      files: [{ name: outName(f.name, 'searchable'), data: bytes }, { name: outName(f.name, 'text', 'txt'), data: new TextEncoder().encode(text) }],
      text, note: 'Your PDF now has a hidden text layer: you can search, select and copy it.',
      html: `<pre class="kit-pre" style="max-height:320px;overflow:auto">${text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</pre>`,
    };
  },
});
