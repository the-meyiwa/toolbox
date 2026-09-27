/* ============================================================
   XML Tools — format, minify, validate, query with XPath, and
   convert to JSON. Parsing is the browser's own XML parser.
   ============================================================ */

import { makeTextTool } from '../lib/kit/text-tool.js';
import { formatXml, parseXml, xmlToValue } from '../lib/transforms/data-formats.js';
import { table, code } from '../lib/kit/render.js';

const serialise = (n) => (n.nodeType === 1 ? new XMLSerializer().serializeToString(n) : n.nodeValue ?? n.textContent);

export default makeTextTool({
  id: 'xml-tools',
  inputLabel: 'XML',
  produces: ['text', 'json'],
  accept: '.xml,.svg,.rss,.atom,.xsd,.xsl,.kml,.gpx,text/xml,application/xml',
  sample: '<?xml version="1.0"?><catalog><book id="bk101" lang="en"><author>Gambardella, Matthew</author><title>XML Developer\'s Guide</title><price currency="USD">44.95</price></book><book id="bk102" lang="fr"><author>Ralls, Kim</author><title>Midnight Rain</title><price currency="EUR">5.95</price></book></catalog>',
  modes: [
    { id: 'format', label: 'Format', fields: [{ key: 'indent', label: 'Indent', type: 'select', options: [['2', '2 spaces'], ['4', '4 spaces'], ['1', 'Tab-width 1']], value: '2' }], run: (i, v) => formatXml(i, { indent: Number(v.indent) }) },
    { id: 'minify', label: 'Minify', run: (i) => { const t = formatXml(i, { minify: true }); return { text: t, stats: [['characters saved', (i.length - t.length).toLocaleString()]] }; } },
    {
      id: 'validate', label: 'Validate',
      run(i) {
        const doc = parseXml(i);
        const all = doc.getElementsByTagName('*');
        const root = doc.documentElement;
        return { text: `Well-formed XML. Root <${root.nodeName}>, ${all.length} elements.`, stats: [['elements', all.length], ['root', root.nodeName], ['namespace', root.namespaceURI || 'none']] };
      },
    },
    {
      id: 'xpath', label: 'XPath',
      fields: [{ key: 'xpath', label: 'XPath expression', type: 'text', value: '//book[price > 10]/title', wide: true, hint: '//tag anywhere · @attr attributes · [n] position · text() · count(//book)' }],
      run(i, v) {
        const doc = parseXml(i);
        if (!v.xpath.trim()) return '';
        if (typeof doc.evaluate !== 'function') throw new Error('XPath needs a browser');
        const r = doc.evaluate(v.xpath, doc, doc.createNSResolver?.(doc.documentElement) ?? null, 0, null);
        if (r.resultType === 1) return { text: String(r.numberValue), stats: [['number', r.numberValue]] };
        if (r.resultType === 2) return { text: r.stringValue };
        if (r.resultType === 3) return { text: String(r.booleanValue) };
        const nodes = []; let n;
        while ((n = r.iterateNext())) nodes.push(n);
        return {
          text: nodes.map(serialise).join('\n'),
          stats: [['matches', nodes.length]],
          html: nodes.length ? table(['#', 'Node', 'Value'], nodes.map((x, k) => [String(k + 1), code(x.nodeName), serialise(x)])) : '<p class="kit-empty">No matches.</p>',
        };
      },
    },
    { id: 'json', label: 'To JSON', outputKind: 'json', run: (i) => ({ text: JSON.stringify(xmlToValue(i), null, 2), kind: 'json' }) },
  ],
});
