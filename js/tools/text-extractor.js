/* ============================================================
   Text Extractor — pull emails, links, phone numbers, IPs, dates,
   amounts, hashtags and more out of any text.
   ============================================================ */

import { makeTextTool } from '../lib/kit/text-tool.js';
import { extract } from '../lib/transforms/text-ops.js';

const KINDS = [['emails', 'Email addresses'], ['urls', 'Links (URLs)'], ['domains', 'Domain names'], ['phones', 'Phone numbers'], ['ipv4', 'IPv4 addresses'],
  ['ipv6', 'IPv6 addresses'], ['numbers', 'Numbers'], ['money', 'Money amounts'], ['dates', 'Dates'], ['hashtags', 'Hashtags'], ['mentions', '@mentions'], ['hexColors', 'Hex colours']];

export default makeTextTool({
  id: 'text-extractor',
  inputLabel: 'Text to search',
  outputLabel: 'Found',
  produces: ['text'],
  sample: 'Thanks for the call on 2026-09-21. Reach Ada at ada.l@example.com or +234 803 555 0142; invoices go to billing@acme.co.uk.\nDocs: https://docs.example.com/start?ref=mail and see #launch #q4 — cc @grace.h. Budget is $12,500.00 (≈ ₦18,750,000). Server 192.168.10.24 answers; brand colour #1d4ed8.',
  fields: [
    { key: 'kind', label: 'Find', type: 'select', options: KINDS, value: 'emails' },
    { key: 'unique', label: 'Remove repeats', type: 'checkbox', value: true },
    { key: 'sort', label: 'Sort', type: 'checkbox', value: false },
    { key: 'join', label: 'One per', type: 'seg', options: [['line', 'Line'], ['comma', 'Comma']], value: 'line' },
  ],
  run(input, v) {
    const found = extract(input, v.kind, { unique: v.unique, sort: v.sort });
    return { text: found.join(v.join === 'comma' ? ', ' : '\n'), stats: [['found', found.length]] };
  },
});
