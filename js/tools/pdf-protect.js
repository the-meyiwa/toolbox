/* ============================================================
   PDF Password & Permissions — lock a PDF with AES-256, set what
   people may do with it, or remove a password you know. Uses qpdf
   compiled to WebAssembly; the file never leaves this device.
   ============================================================ */

import { makeFileTool } from '../lib/kit/file-tool.js';
import { encryptPdf, decryptPdf, outName } from '../lib/pdf/ops.js';

export default makeFileTool({
  id: 'pdf-protect',
  accept: 'application/pdf,.pdf',
  dropLabel: 'Drop a PDF',
  action: 'Apply',
  fields: [
    { key: 'op', label: 'Job', type: 'seg', options: [['lock', 'Add password'], ['unlock', 'Remove password']], value: 'lock' },
    { key: 'user', label: 'Password to open', type: 'text', value: '', show: (v) => v.op === 'lock', hint: 'Leave blank to let anyone open it but still restrict what they can do.' },
    { key: 'owner', label: 'Permissions password', type: 'text', value: '', show: (v) => v.op === 'lock', hint: 'Needed to change the restrictions below. Defaults to the open password.' },
    { key: 'print', label: 'Allow printing', type: 'checkbox', value: true, show: (v) => v.op === 'lock' },
    { key: 'copy', label: 'Allow copying text', type: 'checkbox', value: true, show: (v) => v.op === 'lock' },
    { key: 'annotate', label: 'Allow comments and form filling', type: 'checkbox', value: true, show: (v) => v.op === 'lock' },
    { key: 'modify', label: 'Allow editing', type: 'checkbox', value: false, show: (v) => v.op === 'lock' },
    { key: 'password', label: 'Current password', type: 'text', value: '', show: (v) => v.op === 'unlock', hint: 'Leave blank if it opens without one and only has restrictions.' },
  ],
  async run([f], v) {
    const bytes = await f.bytes();
    if (v.op === 'unlock') return { files: [{ name: outName(f.name, 'unlocked'), data: await decryptPdf(bytes, { password: v.password }) }], note: 'Password and restrictions removed.' };
    const data = await encryptPdf(bytes, v);
    return { files: [{ name: outName(f.name, 'protected'), data }], note: `Locked with AES-256.${v.user ? ' Keep the password safe: it cannot be recovered.' : ''}` };
  },
});
