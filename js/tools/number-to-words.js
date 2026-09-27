/* ============================================================
   Number to Words — amounts in words for cheques, invoices and
   contracts, in a dozen currencies, plus ordinals and Roman
   numerals. Exact for very large numbers.
   ============================================================ */

import { makeTextTool } from '../lib/kit/text-tool.js';
import { numberToWords, ordinal, toRoman, CURRENCIES } from '../lib/transforms/number-words.js';

const CUR = Object.keys(CURRENCIES).map((k) => [k, k === 'none' ? 'Plain number' : k]);

export default makeTextTool({
  id: 'number-to-words',
  inputLabel: 'Numbers (one per line)',
  outputLabel: 'In words',
  produces: ['text'],
  rows: 6,
  sample: '1250000.50\n42\n1999.99',
  fields: [
    { key: 'as', label: 'Write as', type: 'seg', options: [['words', 'Words'], ['ordinal', 'Ordinal'], ['roman', 'Roman']], value: 'words' },
    { key: 'currency', label: 'Currency', type: 'select', options: CUR, value: 'none', show: (v) => v.as === 'words' },
    { key: 'style', label: 'Capitals', type: 'select', options: [['sentence', 'Sentence case'], ['title', 'Title Case'], ['upper', 'UPPERCASE'], ['lower', 'lowercase']], value: 'sentence', show: (v) => v.as === 'words' },
    { key: 'and', label: 'British “and” (one hundred and five)', type: 'checkbox', value: true, show: (v) => v.as !== 'roman' },
    { key: 'only', label: 'End with “only” (cheques)', type: 'checkbox', value: false, show: (v) => v.as === 'words' && v.currency !== 'none' },
  ],
  run(input, v) {
    return input.split('\n').filter((l) => l.trim()).map((l) => {
      try {
        if (v.as === 'roman') return toRoman(l.replace(/[,\s]/g, ''));
        if (v.as === 'ordinal') return ordinal(l.replace(/[,\s]/g, '').split('.')[0]);
        return numberToWords(l, v);
      } catch (e) { return `${l.trim()}: ${e.message}`; }
    }).join('\n');
  },
});
