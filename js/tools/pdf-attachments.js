/* ============================================================
   PDF Attachments — see and save the files embedded in a PDF
   (invoices, spreadsheets, e-invoice XML), or attach new ones.
   ============================================================ */

import { makeFileTool } from '../lib/kit/file-tool.js';
import { listAttachments, addAttachments, outName } from '../lib/pdf/ops.js';
import { humanBytes } from '../lib/kit/form.js';

export default makeFileTool({
  id: 'pdf-attachments',
  accept: '*/*',
  dropLabel: 'Drop a PDF (and any files to attach to it)',
  dropHint: 'the first PDF is the document; anything after it gets attached',
  max: 30,
  action: 'Go',
  fields: (files) => [{ key: 'op', label: 'Job', type: 'seg', options: [['list', 'Extract attachments'], ['add', `Attach ${Math.max(0, files.length - 1)} file${files.length === 2 ? '' : 's'}`]], value: files.length > 1 ? 'add' : 'list' }],
  async run(files, v) {
    const pdf = files.find((f) => /\.pdf$/i.test(f.name)) || files[0];
    const bytes = await pdf.bytes();
    if (v.op === 'add') {
      const extra = files.filter((f) => f !== pdf);
      if (!extra.length) throw new Error('Add the files to attach after the PDF.');
      const data = await addAttachments(bytes, await Promise.all(extra.map(async (f) => ({ name: f.name, data: await f.bytes(), type: f.file.type }))));
      return { files: [{ name: outName(pdf.name, 'with-attachments'), data }], note: `Attached ${extra.length} file${extra.length === 1 ? '' : 's'}.` };
    }
    const found = await listAttachments(bytes);
    if (!found.length) return { note: 'This PDF has no embedded attachments.' };
    return { files: found.map((a) => ({ name: a.name, data: a.data })), note: `Found ${found.length}: ${found.map((a) => `${a.name} (${humanBytes(a.data.length)})`).join(', ')}.`, zipName: outName(pdf.name, 'attachments', 'zip') };
  },
});
