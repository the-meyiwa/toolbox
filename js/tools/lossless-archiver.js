/* ============================================================
   Lossless Archiver — the Korempress codec and PDF container.

   PDFs: every Flate stream is unpacked, recompressed with the `kl`
   codec, and rebuilt byte-for-byte on restore (checked by SHA-256).
   Typically 1.4–3.9× smaller where zip barely manages 1.1×. Other
   files use the codec alone. Archives are compatible with the
   Korempress command-line tool (github.com/thatcrazydave/Korempress).
   ============================================================ */

import { makeFileTool } from '../lib/kit/file-tool.js';
import { runKorempress } from '../lib/korempress/client.js';
import { isContainer, isKlFile } from '../lib/korempress/container.js';
import { humanBytes, esc } from '../lib/kit/form.js';

const LEVELS = [['1', 'Fastest'], ['3', 'Fast (recommended for large files)'], ['6', 'Balanced'], ['9', 'Maximum (slow)']];
const sniff = async (f) => new Uint8Array(await f.file.slice(0, 4).arrayBuffer());

export default makeFileTool({
  id: 'lossless-archiver',
  accept: '*/*',
  dropLabel: 'Drop a PDF or any file to shrink, or an archive to restore',
  dropHint: '.own and .klf archives restore to the exact original',
  max: 20,
  action: 'Go',
  note: 'Lossless: restoring gives back the identical file, verified by its SHA-256 fingerprint. Restoring needs Toolbox or the Korempress tool.',
  fields: [
    { key: 'level', label: 'Effort', type: 'select', options: LEVELS, value: '6', hint: 'Only used when compressing. Maximum can take a minute on large files.' },
  ],
  async run(files, v, { signal, progress }) {
    const out = []; const rows = [];
    for (let k = 0; k < files.length; k++) {
      const f = files[k];
      const head = await sniff(f);
      const step = (x, label) => progress((k + (x || 0)) / files.length, `${f.name}${label ? ` · ${label}` : ''}`);
      const bytes = await f.bytes();
      if (isContainer(head)) {
        const r = await runKorempress('unpackPdf', bytes, { signal, onProgress: step });
        const name = f.name.replace(/\.own$/i, '') || 'restored.pdf';
        out.push({ name: /\.pdf$/i.test(name) ? name : `${name}.pdf`, data: r.bytes });
        rows.push([f.name, 'Restored and verified', humanBytes(f.size), humanBytes(r.bytes.length)]);
      } else if (isKlFile(head)) {
        const r = await runKorempress('unpackFile', bytes, { signal, onProgress: step });
        out.push({ name: r.name, data: r.bytes });
        rows.push([f.name, 'Restored and verified', humanBytes(f.size), humanBytes(r.bytes.length)]);
      } else if (/\.pdf$/i.test(f.name) || (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46)) {
        const r = await runKorempress('packPdf', bytes, { level: Number(v.level), signal, onProgress: step });
        out.push({ name: `${f.name}.own`, data: r.bytes });
        rows.push([f.name, `${r.recovered} of ${r.streams} streams recompressed`, humanBytes(f.size), `${humanBytes(r.bytes.length)} · ${(f.size / r.bytes.length).toFixed(2)}×`]);
      } else {
        const r = await runKorempress('packFile', bytes, { name: f.name, level: Number(v.level), signal, onProgress: step });
        out.push({ name: `${f.name}.klf`, data: r.bytes });
        rows.push([f.name, 'Compressed', humanBytes(f.size), `${humanBytes(r.bytes.length)} · ${(f.size / r.bytes.length).toFixed(2)}×`]);
      }
    }
    const html = `<div class="kit-table-wrap"><table class="kit-table"><thead><tr><th>File</th><th>Result</th><th>Before</th><th>After</th></tr></thead><tbody>${
      rows.map((r) => `<tr>${r.map((c, i) => `<td${i > 1 ? ' class="num"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    return { files: out, html, zipName: 'korempress.zip' };
  },
});
