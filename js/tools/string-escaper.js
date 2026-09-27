/* ============================================================
   String Escaper — escape or unescape text for JSON, JavaScript,
   HTML, XML, URLs, SQL, CSV, regex, Unicode and the shell.
   ============================================================ */

import { makeTextTool } from '../lib/kit/text-tool.js';
import { ESCAPES } from '../lib/transforms/text-ops.js';

const TARGETS = Object.entries(ESCAPES).map(([k, e]) => [k, e.label]);

export default makeTextTool({
  id: 'string-escaper',
  produces: ['text', 'code'],
  sample: 'She said "it\'s <done>" & left.\nPath: C:\\temp\\new — 50% off ✓',
  fields: [{ key: 'target', label: 'Format', type: 'select', options: TARGETS, value: 'json' }],
  modes: [
    { id: 'escape', label: 'Escape', run: (i, v) => ESCAPES[v.target].encode(i) },
    { id: 'unescape', label: 'Unescape', run: (i, v) => { try { return ESCAPES[v.target].decode(i); } catch (e) { throw new Error(`Not valid ${ESCAPES[v.target].label}: ${e.message}`); } } },
  ],
});
