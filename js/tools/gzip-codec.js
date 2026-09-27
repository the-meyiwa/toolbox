/* ============================================================
   Gzip / Deflate — compress text to Base64 or hex, or inflate a
   pasted blob back to text. Uses the browser's CompressionStream.
   ============================================================ */

import { makeTextTool } from '../lib/kit/text-tool.js';
import { compressBytes, decompressBytes, bytesToBase64, base64ToBytes, bytesToHex, hexToBytes, sniffCompression } from '../lib/transforms/dev-ops.js';

const FORMATS = [['gzip', 'Gzip'], ['deflate', 'Zlib (deflate)'], ['deflate-raw', 'Raw deflate']];

export default makeTextTool({
  id: 'gzip-codec',
  produces: ['text'],
  modes: [
    {
      id: 'compress', label: 'Compress',
      fields: [
        { key: 'format', label: 'Format', type: 'select', options: FORMATS, value: 'gzip' },
        { key: 'encoding', label: 'Output as', type: 'seg', options: [['base64', 'Base64'], ['hex', 'Hex']], value: 'base64' },
      ],
      async run(input, v) {
        const raw = new TextEncoder().encode(input);
        const out = await compressBytes(raw, v.format);
        return { text: v.encoding === 'hex' ? bytesToHex(out) : bytesToBase64(out), stats: [['bytes in', raw.length], ['bytes out', out.length], ['ratio', `${(raw.length / out.length).toFixed(2)}×`]] };
      },
    },
    {
      id: 'decompress', label: 'Decompress',
      fields: [
        { key: 'format', label: 'Format', type: 'select', options: [['auto', 'Detect'], ...FORMATS], value: 'auto' },
        { key: 'encoding', label: 'Input is', type: 'seg', options: [['auto', 'Detect'], ['base64', 'Base64'], ['hex', 'Hex']], value: 'auto' },
      ],
      async run(input, v) {
        const t = input.trim();
        const enc = v.encoding === 'auto' ? (/^(0x)?[0-9a-f\s:]+$/i.test(t) && t.replace(/[\s:]/g, '').length % 2 === 0 ? 'hex' : 'base64') : v.encoding;
        let bytes;
        try { bytes = enc === 'hex' ? hexToBytes(t) : base64ToBytes(t); } catch { throw new Error(`That is not valid ${enc === 'hex' ? 'hex' : 'Base64'}`); }
        const format = v.format === 'auto' ? sniffCompression(bytes) : v.format;
        let out;
        try { out = await decompressBytes(bytes, format); } catch { throw new Error(`This is not ${FORMATS.find(([k]) => k === format)[1]} data`); }
        let text;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(out); } catch { text = `(binary, shown as hex)\n${bytesToHex(out)}`; }
        return { text, stats: [['format', format], ['bytes in', bytes.length], ['bytes out', out.length]] };
      },
    },
  ],
});
