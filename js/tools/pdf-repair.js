/* ============================================================
   Repair & Optimise PDF — rebuild a damaged cross-reference table,
   linearise for fast web view, or recompress streams losslessly.
   qpdf compiled to WebAssembly, on this device.
   ============================================================ */

import { makeFileTool } from '../lib/kit/file-tool.js';
import { repairPdf, outName } from '../lib/pdf/ops.js';
import { humanBytes } from '../lib/kit/form.js';

export default makeFileTool({
  id: 'pdf-repair',
  accept: 'application/pdf,.pdf',
  dropLabel: 'Drop a PDF',
  action: 'Process',
  fields: [{ key: 'mode', label: 'Job', type: 'select', options: [['repair', 'Repair a damaged file'], ['linearize', 'Fast web view (linearise)'], ['compress', 'Recompress losslessly']], value: 'repair' }],
  async run([f], v) {
    const before = f.size;
    const { bytes, warnings } = await repairPdf(await f.bytes(), { mode: v.mode });
    const note = `${humanBytes(before)} → ${humanBytes(bytes.length)}.${warnings.length ? ` qpdf fixed ${warnings.length} problem${warnings.length === 1 ? '' : 's'}.` : ''}`;
    return { files: [{ name: outName(f.name, v.mode === 'repair' ? 'repaired' : v.mode === 'linearize' ? 'web' : 'optimised'), data: bytes }], note, html: warnings.length ? `<pre class="kit-pre">${warnings.slice(0, 50).join('\n').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</pre>` : '' };
  },
});
