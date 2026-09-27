/* ============================================================
   Data Converter — JSON, CSV, TSV, YAML and XML to each other,
   through one value model (js/lib/transforms/data-formats.js).
   ============================================================ */

import { makeTextTool } from '../lib/kit/text-tool.js';
import { convert, FORMATS } from '../lib/transforms/data-formats.js';

const KIND = { json: 'json', csv: 'csv', tsv: 'csv', yaml: 'yaml', xml: 'text' };

export default makeTextTool({
  id: 'data-converter',
  inputLabel: 'Data',
  outputLabel: 'Converted',
  placeholder: 'Paste JSON, CSV, TSV, YAML or XML…',
  produces: ['json', 'csv', 'yaml', 'text'],
  sample: 'name,role,joined,active\nAda Lovelace,Engineer,1843-07-01,true\nGrace Hopper,"Rear Admiral, USN",1943-12-01,true\nAlan Turing,Mathematician,1936-05-28,false',
  fields: [
    { key: 'from', label: 'From', type: 'select', options: [['auto', 'Detect automatically'], ...FORMATS], value: 'auto' },
    { key: 'to', label: 'To', type: 'select', options: FORMATS, value: 'json' },
    { key: 'indent', label: 'Indent', type: 'select', options: [['2', '2 spaces'], ['4', '4 spaces'], ['0', 'None (minified)']], value: '2', show: (v) => ['json', 'yaml', 'xml'].includes(v.to) },
    { key: 'types', label: 'Read numbers and true/false as values', type: 'checkbox', value: true, show: (v) => v.from === 'csv' || v.from === 'tsv' || v.from === 'auto' },
    { key: 'unflatten', label: 'Rebuild nested objects from dotted columns', type: 'checkbox', value: false, show: (v) => v.from !== 'json' && v.from !== 'yaml' && v.from !== 'xml' },
    { key: 'root', label: 'XML root element', type: 'text', value: 'root', show: (v) => v.to === 'xml' },
  ],
  run(input, v) {
    const { text, from } = convert(input, v.from, v.to, { indent: Number(v.indent), types: v.types, unflatten: v.unflatten, root: v.root || 'root' });
    return { text, kind: KIND[v.to], stats: [['read as', from.toUpperCase()], ['characters', text.length.toLocaleString()]] };
  },
});
