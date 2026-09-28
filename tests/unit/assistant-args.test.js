/* ============================================================
   Tool-argument coercion: models send the wrong types; tools
   receive the ones they declared.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { coerceArgs, missingArgsResult } from '../../js/lib/assistant/args.js';

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Project name.' },
    amount: { type: 'number' },
    count: { type: 'integer' },
    enabled: { type: 'boolean' },
    tags: { type: 'array', items: { type: 'string' } },
    unit: { type: 'string', enum: ['km', 'mi'] },
    options: { type: 'object', properties: { depth: { type: 'number' } } },
    files: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } } } },
  },
  required: ['name'],
};

test('Args: wrong primitive types are converted to the declared ones', () => {
  const { args, missing } = coerceArgs({ name: 2024, amount: '₦1,500.50', count: '7.6', enabled: 'yes', unit: 'KM' }, schema);
  assert.deepEqual(missing, []);
  assert.deepEqual(args, { name: '2024', amount: 1500.5, count: 8, enabled: true, unit: 'km' });
});

test('Args: junk values are dropped rather than passed on', () => {
  const { args } = coerceArgs({ name: 'x', amount: 'lots', count: NaN, enabled: 'maybe', unit: 'parsecs', options: 'not json', tags: null }, schema);
  assert.deepEqual(args, { name: 'x' });
});

test('Args: lists, objects and JSON strings take the declared shape', () => {
  const { args } = coerceArgs({
    name: ['a', 'b'],
    tags: 'solo',
    options: '{"depth":"3"}',
    files: [{ path: 'index.html', content: 42 }, null, { path: 7 }],
  }, schema);
  assert.equal(args.name, 'a, b');
  assert.deepEqual(args.tags, ['solo']);
  assert.deepEqual(args.options, { depth: 3 });
  assert.deepEqual(args.files, [{ path: 'index.html', content: '42' }, { path: '7' }]);
  assert.deepEqual(coerceArgs({ name: 'x', tags: '["a","b"]' }, schema).args.tags, ['a', 'b']);
  assert.equal(coerceArgs({ name: { text: 'from wrapper' } }, schema).args.name, 'from wrapper');
});

test('Args: missing required arguments are reported, unless an alias may cover them', () => {
  const miss = coerceArgs({ amount: 3 }, schema);
  assert.deepEqual(miss.missing, ['name']);
  assert.deepEqual(coerceArgs({ name: '   ' }, schema).missing, ['name']);
  assert.deepEqual(coerceArgs({ project_name: 'alias' }, schema).missing, [], 'an undeclared key may be the tool\'s alias');
  const res = missingArgsResult('ide_create_project', ['name'], schema);
  assert.equal(res.status, 'error');
  assert.match(res.message, /needs name \(Project name\)/);
});

test('Args: hostile input never throws', () => {
  const cyclic = {}; cyclic.self = cyclic;
  for (const v of [null, undefined, 5, 'str', [], [null], cyclic, { __proto__: { polluted: 1 } }]) {
    assert.doesNotThrow(() => coerceArgs(v, schema));
    assert.doesNotThrow(() => coerceArgs({ name: v, options: v, files: v, tags: v }, schema));
  }
  assert.equal(({}).polluted, undefined);
});
