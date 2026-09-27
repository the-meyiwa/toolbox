/* ============================================================
   Crop PDF — trim margins by measurement, or cut every page down
   to its content automatically. The page is cropped for every
   viewer and printer, not just hidden.
   ============================================================ */

import { makeFileTool } from '../lib/kit/file-tool.js';
import { cropPages, outName } from '../lib/pdf/ops.js';

const m = (key, label) => ({ key, label: `${label} (mm)`, type: 'number', value: 10, min: 0, step: 0.5, show: (v) => v.mode === 'margins' });

export default makeFileTool({
  id: 'pdf-crop',
  accept: 'application/pdf,.pdf',
  dropLabel: 'Drop a PDF to crop',
  action: 'Crop',
  fields: [
    { key: 'mode', label: 'How', type: 'seg', options: [['auto', 'Trim to content'], ['margins', 'Set margins']], value: 'auto' },
    { key: 'padding', label: 'Keep around content (mm)', type: 'number', value: 4, min: 0, show: (v) => v.mode === 'auto' },
    m('top', 'Top'), m('right', 'Right'), m('bottom', 'Bottom'), m('left', 'Left'),
    { key: 'pages', label: 'Pages (blank = all)', type: 'text', value: '' },
  ],
  async run([f], v, { signal, progress }) {
    return { files: [{ name: outName(f.name, 'cropped'), data: await cropPages(await f.bytes(), v, { signal, onProgress: progress }) }] };
  },
});
