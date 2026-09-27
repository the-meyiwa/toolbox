/* ============================================================
   JSON Tools — the jobs the formatter does not do: compare two
   documents, sort keys, infer TypeScript types, flatten, and
   escape to or from a string literal.
   ============================================================ */

import { makeTextTool } from '../lib/kit/text-tool.js';
import { jsonDiff, splitPair, sortKeys, jsonToTypeScript, escapeJsonString, unescapeJsonString } from '../lib/transforms/dev-ops.js';
import { flattenObject, unflattenObject } from '../lib/transforms/data-formats.js';
import { table, code, badge } from '../lib/kit/render.js';

const parse = (t, label = 'JSON') => { try { return JSON.parse(t); } catch (e) { throw new Error(`${label} is not valid: ${e.message}`); } };
const short = (v) => { const s = JSON.stringify(v); return s === undefined ? '' : s.length > 120 ? `${s.slice(0, 117)}…` : s; };

export default makeTextTool({
  id: 'json-tools',
  inputLabel: 'JSON',
  produces: ['json', 'code', 'text'],
  sample: (mode) => (mode === 'compare'
    ? '{\n  "name": "Toolbox",\n  "version": 1,\n  "tags": ["web", "tools"],\n  "owner": { "team": "core" }\n}\n=====\n{\n  "name": "Toolbox",\n  "version": 2,\n  "tags": ["web"],\n  "owner": { "team": "core", "lead": "Ada" }\n}'
    : '{\n  "id": 7,\n  "title": "Launch plan",\n  "owner": { "name": "Ada", "email": "ada@example.com" },\n  "tasks": [\n    { "id": 1, "done": true, "label": "Draft" },\n    { "id": 2, "done": false, "label": "Review", "due": "2026-10-01" }\n  ]\n}'),
  modes: [
    {
      id: 'compare', label: 'Compare',
      fields: [{ key: 'ignoreOrder', label: 'Ignore array order', type: 'checkbox', value: false }],
      run(input, v) {
        const [a, b] = splitPair(input);
        const diff = jsonDiff(parse(a, 'The first JSON'), parse(b, 'The second JSON'), { ignoreOrder: v.ignoreOrder });
        const text = diff.map((d) => `${d.type === 'added' ? '+' : d.type === 'removed' ? '-' : '~'} ${d.path}${d.type === 'changed' ? `: ${short(d.before)} → ${short(d.after)}` : `: ${short(d.after ?? d.before)}`}`).join('\n');
        if (!diff.length) return { text: 'The two documents are identical.', stats: [['differences', 0]] };
        const tone = { added: 'ok', removed: 'bad', changed: 'warn' };
        return {
          text,
          html: table(['Change', 'Path', 'Before', 'After'], diff.map((d) => [badge(d.type, tone[d.type]), code(d.path), short(d.before), short(d.after)])),
          stats: ['added', 'removed', 'changed'].map((t) => [t, diff.filter((d) => d.type === t).length]),
        };
      },
    },
    {
      id: 'sort', label: 'Sort keys',
      fields: [{ key: 'desc', label: 'Z to A', type: 'checkbox', value: false }, { key: 'shallow', label: 'Top level only', type: 'checkbox', value: false }],
      run: (input, v) => ({ text: JSON.stringify(sortKeys(parse(input), { deep: !v.shallow, desc: v.desc }), null, 2), kind: 'json' }),
    },
    {
      id: 'types', label: 'TypeScript',
      fields: [{ key: 'root', label: 'Root name', type: 'text', value: 'Root' }, { key: 'useType', label: 'Use type aliases', type: 'checkbox', value: false }],
      run: (input, v) => ({ text: jsonToTypeScript(parse(input), { root: v.root || 'Root', useType: v.useType }), kind: 'code' }),
    },
    {
      id: 'flatten', label: 'Flatten',
      fields: [{ key: 'dir', label: 'Direction', type: 'seg', options: [['flat', 'Flatten'], ['nest', 'Unflatten']], value: 'flat' }],
      run(input, v) {
        const data = parse(input);
        const fn = v.dir === 'nest' ? unflattenObject : flattenObject;
        return { text: JSON.stringify(Array.isArray(data) ? data.map((x) => fn(x)) : fn(data), null, 2), kind: 'json' };
      },
    },
    {
      id: 'string', label: 'String',
      fields: [{ key: 'dir', label: 'Direction', type: 'seg', options: [['to', 'JSON → string literal'], ['from', 'String literal → JSON']], value: 'to' }],
      run(input, v) {
        if (v.dir === 'to') return { text: escapeJsonString(JSON.stringify(parse(input))), kind: 'text' };
        const inner = unescapeJsonString(input);
        try { return { text: JSON.stringify(JSON.parse(inner), null, 2), kind: 'json' }; } catch { return { text: inner, kind: 'text' }; }
      },
    },
  ],
});
