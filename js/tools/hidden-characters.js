/* ============================================================
   Hidden Characters & Unicode — find zero-width spaces, bidi
   overrides, tag characters and look-alike letters (the tricks
   behind spoofed links and watermarked text), clean them out, or
   inspect any text character by character.
   ============================================================ */

import { makeTextTool } from '../lib/kit/text-tool.js';
import { findHiddenChars, cleanHiddenChars, inspectChars } from '../lib/transforms/text-ops.js';
import { table, code, badge } from '../lib/kit/render.js';
import { esc } from '../lib/kit/form.js';

const TONE = { invisible: 'warn', control: 'bad', lookalike: 'bad', private: 'warn' };

function highlight(text, hits) {
  const at = new Map(hits.map((h) => [h.index, h]));
  let html = ''; let i = 0;
  for (const ch of text) {
    const h = at.get(i);
    html += h ? `<mark class="kit-mark" title="${esc(`${h.hex} ${h.name}`)}">${h.kind === 'lookalike' ? esc(ch) : esc(h.hex)}</mark>` : esc(ch);
    i += ch.length;
  }
  return `<pre class="kit-pre">${html}</pre>`;
}

export default makeTextTool({
  id: 'hidden-characters',
  produces: ['text'],
  sample: 'Pay at https://pаypal.com/​login now.‮txT.exe‬ Totally normal text⁠ here.',
  modes: [
    { id: 'find', label: 'Find',
      run(input) {
        const hits = findHiddenChars(input);
        if (!hits.length) return { html: '<p class="kit-empty">No hidden or look-alike characters found.</p>', text: input, stats: [['found', 0]] };
        return {
          text: cleanHiddenChars(input),
          html: highlight(input, hits) + table(['Line:col', 'Code point', 'What it is', 'Kind'], hits.map((h) => [`${h.line}:${h.col}`, code(h.hex), h.name, badge(h.kind, TONE[h.kind])])),
          stats: [['found', hits.length], ...['invisible', 'lookalike', 'control'].map((k) => [k, hits.filter((h) => h.kind === k).length])],
        };
      } },
    { id: 'clean', label: 'Clean',
      fields: [{ key: 'lookalikes', label: 'Replace look-alike letters', type: 'checkbox', value: true }, { key: 'controls', label: 'Remove control characters', type: 'checkbox', value: true }],
      run(input, v) { const out = cleanHiddenChars(input, v); return { text: out, stats: [['characters removed or replaced', findHiddenChars(input).length]] }; } },
    { id: 'inspect', label: 'Inspect',
      run(input) {
        const chars = inspectChars(input, 1500);
        return {
          text: chars.map((c) => `${c.hex}\t${c.category}\t${c.char}`).join('\n'),
          html: table(['Char', 'Code point', 'Category', 'UTF-8', 'UTF-16', 'HTML', 'Escape', 'Note'],
            chars.map((c) => [/\s|\p{C}/u.test(c.char) ? '·' : c.char, code(c.hex), c.category, code(c.utf8), code(c.utf16), code(c.html), code(c.escape), c.flag])),
          stats: [['characters', Array.from(input).length], ['UTF-8 bytes', new TextEncoder().encode(input).length], ['UTF-16 units', input.length]],
        };
      } },
  ],
});
