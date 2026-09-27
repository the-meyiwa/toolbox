/* ============================================================
   Text Transformer — ciphers (ROT13, ROT47, Caesar, Atbash),
   reversing, playful casing, repeating, truncating, censoring and
   a palindrome check.
   ============================================================ */

import { makeTextTool } from '../lib/kit/text-tool.js';
import * as X from '../lib/transforms/text-ops.js';

export default makeTextTool({
  id: 'text-transformer',
  produces: ['text'],
  sample: 'The quick brown fox jumps over the lazy dog.',
  modes: [
    { id: 'cipher', label: 'Cipher',
      fields: [{ key: 'kind', label: 'Cipher', type: 'select', options: [['rot13', 'ROT13'], ['rot47', 'ROT47'], ['caesar', 'Caesar shift'], ['atbash', 'Atbash']], value: 'rot13' },
        { key: 'shift', label: 'Shift', type: 'number', value: 3, show: (v) => v.kind === 'caesar' }, { key: 'decode', label: 'Decode', type: 'checkbox', value: false, show: (v) => v.kind === 'caesar' }],
      run: (i, v) => (v.kind === 'rot47' ? X.rot47(i) : v.kind === 'atbash' ? X.atbash(i) : X.rot(i, v.kind === 'rot13' ? 13 : (v.decode ? -1 : 1) * Number(v.shift || 0))) },
    { id: 'reverse', label: 'Reverse', fields: [{ key: 'unit', label: 'Reverse', type: 'seg', options: [['chars', 'Characters'], ['words', 'Words'], ['lines', 'Lines']], value: 'chars' }], run: (i, v) => X.reverseText(i, v.unit) },
    { id: 'case', label: 'Fun case', fields: [{ key: 'style', label: 'Style', type: 'seg', options: [['random', 'rAnDoM'], ['alternate', 'aLtErNaTe']], value: 'random' }], run: (i, v) => (v.style === 'random' ? X.randomCase(i) : X.alternateCase(i)) },
    { id: 'repeat', label: 'Repeat', fields: [{ key: 'times', label: 'Times', type: 'number', value: 3, min: 1, max: 10000 }, { key: 'sep', label: 'Separator (\\n = new line)', type: 'text', value: '\\n' }], run: (i, v) => X.repeatText(i, Number(v.times) || 1, v.sep) },
    { id: 'truncate', label: 'Truncate', fields: [{ key: 'max', label: 'Keep', type: 'number', value: 20, min: 1 }, { key: 'by', label: 'Count', type: 'seg', options: [['chars', 'Characters'], ['words', 'Words']], value: 'chars' }, { key: 'ellipsis', label: 'Ending', type: 'text', value: '…' }],
      run: (i, v) => i.split('\n').map((l) => X.truncateText(l, Number(v.max) || 1, { by: v.by, ellipsis: v.ellipsis })).join('\n') },
    { id: 'censor', label: 'Censor', fields: [{ key: 'words', label: 'Words to hide (comma or line separated)', type: 'textarea', value: 'fox, dog', wide: true }, { key: 'mask', label: 'Mask', type: 'text', value: '*' }, { key: 'keepFirst', label: 'Keep first letter', type: 'checkbox', value: false }],
      run: (i, v) => X.censor(i, v.words, { mask: v.mask || '*', keepFirst: v.keepFirst }) },
    { id: 'palindrome', label: 'Palindrome',
      run(i) {
        const lines = i.split('\n').filter((l) => l.trim());
        return { text: lines.map((l) => `${X.isPalindrome(l) ? '✓' : '✗'}  ${l}`).join('\n'), stats: [['palindromes', lines.filter(X.isPalindrome).length], ['lines', lines.length]] };
      } },
  ],
});
