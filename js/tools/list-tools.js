/* ============================================================
   List Tools — shuffle, count, de-duplicate, group, rotate, wrap,
   number and sample lists. Sort Lines and Remove Duplicates keep
   the simple cases; this is everything else a list needs.
   ============================================================ */

import { makeTextTool } from '../lib/kit/text-tool.js';
import * as L from '../lib/transforms/table-ops.js';
import { table } from '../lib/kit/render.js';

const SEPS = [['newline', 'New line'], ['comma', 'Comma'], ['semicolon', 'Semicolon'], ['space', 'Space'], ['tab', 'Tab']];
const items = (i, v) => { let x = L.splitItems(i, v.sep); if (v.trim) x = x.map((s) => s.trim()); return v.skipEmpty ? x.filter((s) => s !== '') : x; };
const done = (list, v, extra = []) => ({ text: L.joinItems(list, v.joinWith === 'same' ? v.sep : v.joinWith), stats: [['items', list.length], ...extra] });

export default makeTextTool({
  id: 'list-tools',
  inputLabel: 'List',
  produces: ['text'],
  sample: 'apples\nbananas\ncherries\napples\ndates\nelderberries\nbananas\nfigs\ngrapes\napples',
  fields: [
    { key: 'sep', label: 'Items separated by', type: 'select', options: SEPS, value: 'newline' },
    { key: 'joinWith', label: 'Join result with', type: 'select', options: [['same', 'Same as input'], ...SEPS], value: 'same' },
    { key: 'trim', label: 'Trim spaces', type: 'checkbox', value: true },
    { key: 'skipEmpty', label: 'Skip empty items', type: 'checkbox', value: true },
  ],
  modes: [
    { id: 'shuffle', label: 'Shuffle', run: (i, v) => done(L.shuffle(items(i, v)), v) },
    { id: 'count', label: 'Count',
      fields: [{ key: 'caseSensitive', label: 'Case-sensitive', type: 'checkbox', value: false }, { key: 'top', label: 'Show top', type: 'number', value: 50, min: 1 }],
      run(i, v) {
        const all = items(i, v); const f = L.frequencies(all, { caseSensitive: v.caseSensitive }).slice(0, Number(v.top) || 50);
        return { text: f.map((e) => `${e.count}\t${e.item}`).join('\n'), html: table(['Item', 'Count', 'Share'], f.map((e) => [e.item, String(e.count), `${((e.count / all.length) * 100).toFixed(1)}%`]), { numeric: [1, 2] }), stats: [['items', all.length], ['distinct', L.frequencies(all, { caseSensitive: v.caseSensitive }).length]] };
      } },
    { id: 'unique', label: 'Unique',
      fields: [{ key: 'which', label: 'Keep', type: 'seg', options: [['first', 'One of each'], ['once', 'Only items that appear once']], value: 'first' }, { key: 'caseSensitive', label: 'Case-sensitive', type: 'checkbox', value: false }],
      run(i, v) { const all = items(i, v); const u = L.uniqueItems(all, { caseSensitive: v.caseSensitive, onlyOnce: v.which === 'once' }); return done(u, v, [['removed', all.length - u.length]]); } },
    { id: 'group', label: 'Group', fields: [{ key: 'size', label: 'Items per group', type: 'number', value: 3, min: 1 }, { key: 'within', label: 'Join inside a group with', type: 'text', value: ', ' }],
      run(i, v) { const g = L.groupItems(items(i, v), v.size); return { text: g.map((x) => x.join(v.within)).join('\n'), stats: [['groups', g.length]] }; } },
    { id: 'rotate', label: 'Rotate / reverse', fields: [{ key: 'by', label: 'Rotate by (negative = right)', type: 'number', value: 1 }, { key: 'reverse', label: 'Reverse instead', type: 'checkbox', value: false }],
      run: (i, v) => done(v.reverse ? items(i, v).reverse() : L.rotateItems(items(i, v), v.by), v) },
    { id: 'wrap', label: 'Wrap', fields: [{ key: 'prefix', label: 'Before each', type: 'text', value: '"' }, { key: 'suffix', label: 'After each', type: 'text', value: '",' }, { key: 'unwrap', label: 'Remove instead', type: 'checkbox', value: false }],
      run: (i, v) => done(v.unwrap ? L.unwrapItems(items(i, v), v.prefix, v.suffix) : L.wrapItems(items(i, v), v.prefix, v.suffix), v) },
    { id: 'number', label: 'Number', fields: [{ key: 'start', label: 'Start at', type: 'number', value: 1 }, { key: 'format', label: 'Format ({n} is the number)', type: 'text', value: '{n}. ' }],
      run: (i, v) => done(L.numberItems(items(i, v), { start: Number(v.start) || 0, format: v.format || '{n}. ' }), v) },
    { id: 'sample', label: 'Pick random', fields: [{ key: 'n', label: 'How many', type: 'number', value: 3, min: 1 }],
      run: (i, v) => done(L.sample(items(i, v), Number(v.n) || 1), v) },
  ],
});
