/* ============================================================
   SQL Formatter — dialect-aware formatting (sql-formatter) and a
   string-safe minifier.
   ============================================================ */

import { makeTextTool } from '../lib/kit/text-tool.js';
import { formatSql, SQL_DIALECTS } from '../lib/transforms/dev-ops.js';

export default makeTextTool({
  id: 'sql-formatter',
  inputLabel: 'SQL',
  outputLabel: 'Formatted SQL',
  outputKind: 'sql',
  produces: ['sql'],
  accept: '.sql,text/plain',
  sample: "select o.id, c.name as customer, sum(li.qty*li.price) total from orders o join customers c on c.id=o.customer_id left join line_items li on li.order_id=o.id where o.created_at >= '2026-01-01' and c.country in ('NG','GH') group by o.id, c.name having sum(li.qty*li.price) > 100 order by total desc limit 20;",
  fields: [
    { key: 'dialect', label: 'Dialect', type: 'select', options: SQL_DIALECTS, value: 'sql' },
    { key: 'keywordCase', label: 'Keywords', type: 'select', options: [['upper', 'UPPERCASE'], ['lower', 'lowercase'], ['preserve', 'As written']], value: 'upper' },
    { key: 'indent', label: 'Indent', type: 'select', options: [['2', '2 spaces'], ['4', '4 spaces']], value: '2' },
    { key: 'minify', label: 'Minify to one line', type: 'checkbox', value: false },
  ],
  async run(input, v) {
    try { return { text: await formatSql(input, v), kind: 'sql' }; }
    catch (e) { throw new Error(`Could not format this as ${SQL_DIALECTS.find(([k]) => k === v.dialect)?.[1] || v.dialect}: ${String(e.message).split('\n')[0]}`); }
  },
});
