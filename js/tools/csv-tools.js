/* ============================================================
   CSV Tools — transpose, sort, filter, de-duplicate, rearrange
   columns, check for broken rows, summarise columns, and change
   the delimiter. Quoted fields and embedded newlines are kept.
   ============================================================ */

import { makeTextTool } from '../lib/kit/text-tool.js';
import * as T from '../lib/transforms/table-ops.js';
import { table } from '../lib/kit/render.js';

const DELIMS = [['auto', 'Detect'], [',', 'Comma'], [';', 'Semicolon'], ['\\t', 'Tab'], ['|', 'Pipe']];
const list = (s) => String(s).split(',').map((x) => x.trim()).filter(Boolean);
const out = (rows, d) => ({ text: T.writeCsvRows(rows, d), kind: 'csv', stats: [['rows', rows.length], ['columns', Math.max(0, ...rows.map((r) => r.length))]] });

export default makeTextTool({
  id: 'csv-tools',
  inputLabel: 'CSV',
  outputKind: 'csv',
  produces: ['csv', 'text'],
  accept: '.csv,.tsv,.txt,text/csv',
  sample: 'id,name,department,salary,start\n1,Ada,Engineering,98000,2021-03-01\n2,Grace,Engineering,105000,2019-07-15\n3,Alan,Research,,2022-01-10\n4,Katherine,Research,91000,2020-11-02\n2,Grace,Engineering,105000,2019-07-15\n5,Hedy,Design,87000',
  fields: [
    { key: 'delimiter', label: 'Delimiter', type: 'select', options: DELIMS, value: 'auto' },
    { key: 'header', label: 'First row is a header', type: 'checkbox', value: true },
  ],
  modes: [
    { id: 'sort', label: 'Sort', fields: [{ key: 'col', label: 'Column (name or number)', type: 'text', value: '1' }, { key: 'desc', label: 'Descending', type: 'checkbox', value: false }],
      run(i, v) { const { rows, d } = T.readTable(i, v.delimiter); return out(T.sortByColumn(rows, T.columnIndex(rows, v.col), { desc: v.desc, header: v.header }), d); } },
    { id: 'filter', label: 'Filter', fields: [{ key: 'col', label: 'Column', type: 'text', value: '1' }, { key: 'how', label: 'Match', type: 'select', options: [['contains', 'Contains'], ['equals', 'Equals'], ['not', 'Does not contain']], value: 'contains' }, { key: 'q', label: 'Value', type: 'text', value: '' }],
      run(i, v) { const { rows, d } = T.readTable(i, v.delimiter); return out(T.filterRows(rows, T.columnIndex(rows, v.col), v.q, { header: v.header, mode: v.how }), d); } },
    { id: 'dedupe', label: 'Remove duplicates', fields: [{ key: 'col', label: 'Compare column (blank = whole row)', type: 'text', value: '' }],
      run(i, v) { const { rows, d } = T.readTable(i, v.delimiter); const res = T.dedupeRows(rows, { header: v.header, col: v.col ? T.columnIndex(rows, v.col) : null }); const r = out(res, d); r.stats.push(['removed', rows.length - res.length]); return r; } },
    { id: 'columns', label: 'Columns',
      fields: [
        { key: 'op', label: 'Action', type: 'select', options: [['keep', 'Keep only these'], ['delete', 'Delete these'], ['swap', 'Swap two'], ['insert', 'Insert a column']], value: 'keep' },
        { key: 'cols', label: 'Columns (comma-separated names or numbers)', type: 'text', value: '1,2', show: (v) => v.op !== 'insert' },
        { key: 'at', label: 'Insert before column', type: 'number', value: 1, min: 1, show: (v) => v.op === 'insert' },
        { key: 'name', label: 'New header', type: 'text', value: 'new_column', show: (v) => v.op === 'insert' },
        { key: 'fill', label: 'Fill value', type: 'text', value: '', show: (v) => v.op === 'insert' },
      ],
      run(i, v) {
        const { rows, d } = T.readTable(i, v.delimiter);
        if (v.op === 'insert') return out(T.insertColumn(rows, Math.max(0, Number(v.at) - 1), v.header ? v.name : '', v.fill), d);
        const idx = list(v.cols).map((c) => T.columnIndex(rows, c));
        if (v.op === 'swap') { if (idx.length !== 2) throw new Error('Name exactly two columns to swap'); return out(T.swapColumns(rows, idx[0], idx[1]), d); }
        return out(v.op === 'delete' ? T.deleteColumns(rows, idx) : T.pickColumns(rows, idx), d);
      } },
    { id: 'transpose', label: 'Transpose', run(i, v) { const { rows, d } = T.readTable(i, v.delimiter); return out(T.transpose(rows), d); } },
    { id: 'check', label: 'Check rows', fields: [{ key: 'empty', label: 'Flag empty cells', type: 'checkbox', value: true }],
      run(i, v) {
        const { rows } = T.readTable(i, v.delimiter);
        const p = T.incompleteRows(rows, { header: v.header, emptyCells: v.empty });
        if (!p.length) return { text: `All ${rows.length} rows have ${rows[0]?.length ?? 0} fields.`, stats: [['problems', 0]] };
        return { text: p.map((x) => `Row ${x.line}: ${x.issue}`).join('\n'), stats: [['problems', p.length], ['rows', rows.length]], html: table(['Row', 'Issue', 'Content'], p.map((x) => [String(x.line), x.issue, x.row.join(' | ')])) };
      } },
    { id: 'stats', label: 'Summary',
      run(i, v) {
        const { rows } = T.readTable(i, v.delimiter);
        const s = T.columnStats(rows, { header: v.header });
        const f = (n) => (n == null ? '' : Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 }));
        const body = s.map((c) => [c.column, String(c.filled), String(c.empty), String(c.unique), f(c.min), f(c.max), f(c.sum), f(c.mean)]);
        return { text: T.writeCsvRows([['column', 'filled', 'empty', 'unique', 'min', 'max', 'sum', 'mean'], ...body]), kind: 'csv', html: table(['Column', 'Filled', 'Empty', 'Unique', 'Min', 'Max', 'Sum', 'Mean'], body, { numeric: [1, 2, 3, 4, 5, 6, 7] }), stats: [['rows', rows.length - (v.header ? 1 : 0)], ['columns', s.length]] };
      } },
    { id: 'delimiter', label: 'Change delimiter', fields: [{ key: 'to', label: 'New delimiter', type: 'select', options: DELIMS.slice(1), value: ';' }],
      run(i, v) { const { rows } = T.readTable(i, v.delimiter); return out(rows, v.to === '\\t' ? '\t' : v.to); } },
  ],
});
