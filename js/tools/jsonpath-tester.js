/* ============================================================
   JSONPath Tester — run a JSONPath expression against a document
   and see every match with its exact path.
   ============================================================ */

import { makeTextTool } from '../lib/kit/text-tool.js';
import { jsonPathQuery } from '../lib/transforms/dev-ops.js';
import { table, code } from '../lib/kit/render.js';

export default makeTextTool({
  id: 'jsonpath-tester',
  inputLabel: 'JSON document',
  outputLabel: 'Matches',
  produces: ['json'],
  sample: '{\n  "store": {\n    "book": [\n      { "category": "reference", "author": "Nigel Rees", "title": "Sayings of the Century", "price": 8.95 },\n      { "category": "fiction", "author": "Evelyn Waugh", "title": "Sword of Honour", "price": 12.99 },\n      { "category": "fiction", "author": "Herman Melville", "title": "Moby Dick", "isbn": "0-553-21311-3", "price": 8.99 }\n    ],\n    "bicycle": { "color": "red", "price": 19.95 }\n  }\n}',
  fields: [
    { key: 'path', label: 'JSONPath', type: 'text', value: '$.store.book[?(@.price < 10)].title', wide: true, hint: '$ root · .key child · ..key anywhere · [*] every item · [0,2] / [1:3] slices · [?(@.price < 10)] filters' },
    { key: 'view', label: 'Show', type: 'seg', options: [['table', 'Matches'], ['json', 'Values as JSON']], value: 'table' },
  ],
  async run(input, v) {
    if (!v.path.trim()) return '';
    let data;
    try { data = JSON.parse(input); } catch (e) { throw new Error(`The document is not valid JSON: ${e.message}`); }
    const hits = await jsonPathQuery(data, v.path.trim());
    const text = JSON.stringify(hits.map((h) => h.value), null, 2);
    const stats = [['matches', hits.length]];
    if (v.view === 'json' || !hits.length) return { text: hits.length ? text : '', html: hits.length ? undefined : '<p class="kit-empty">No matches.</p>', stats, kind: 'json' };
    return { text, kind: 'json', stats, html: table(['#', 'Path', 'Value'], hits.map((h, i) => [String(i + 1), code(h.path), JSON.stringify(h.value)])) };
  },
});
