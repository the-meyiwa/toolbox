/* ============================================================
   Search & Discovery Engine Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, CATEGORY_LABELS } from '../../js/registry/index.js';
import { search, parseQuery, scoreTool, relatedTools, tokenise } from '../../js/lib/search.js';

test('Search: tokenise expands shorthands and strips stopwords', () => {
  const tokens = tokenise('how to compress my photo quickly');
  assert.ok(tokens.includes('compress'));
  assert.ok(tokens.includes('image')); // photo -> image expansion
  assert.ok(!tokens.includes('how'));
  assert.ok(!tokens.includes('to'));
  assert.ok(!tokens.includes('my'));
});

test('Search: parseQuery parses format conversions', () => {
  const q1 = parseQuery('png to webp');
  assert.deepEqual(q1.conversion, { from: 'png', to: 'webp' });

  const q2 = parseQuery('json into csv');
  assert.deepEqual(q2.conversion, { from: 'json', to: 'csv' });
});

test('Search: exact tool name yields top score', () => {
  const { results } = search('JSON Formatter', TOOLS, { labels: CATEGORY_LABELS });
  assert.ok(results.length > 0);
  assert.equal(results[0].tool.id, 'json-formatter');
});

test('Search: intent search correctly matches tools', () => {
  // "compress photo" -> image-compressor
  const r1 = search('compress photo', TOOLS, { labels: CATEGORY_LABELS });
  assert.equal(r1.results[0].tool.id, 'image-compressor');

  // "balance chemical equation" -> chemical-equation-balancer
  const r2 = search('balance chemical equation', TOOLS, { labels: CATEGORY_LABELS });
  assert.equal(r2.results[0].tool.id, 'chemical-equation-balancer');

  // "receive money" -> payment-hub
  const r3 = search('receive money', TOOLS, { labels: CATEGORY_LABELS });
  assert.equal(r3.results[0].tool.id, 'payment-hub');
});

test('Search: format conversion query lands on relevant converter', () => {
  const r1 = search('png to webp', TOOLS, { labels: CATEGORY_LABELS });
  assert.equal(r1.results[0].tool.id, 'image-converter');

  const r2 = search('csv to json', TOOLS, { labels: CATEGORY_LABELS });
  assert.equal(r2.results[0].tool.id, 'csv-to-json');
});

test('Search: fuzzy matching handles typos', () => {
  const r1 = search('passwrd generatr', TOOLS, { labels: CATEGORY_LABELS });
  assert.ok(r1.results.some(r => r.tool.id === 'password-generator'));

  const r2 = search('jws decoder', TOOLS, { labels: CATEGORY_LABELS });
  assert.ok(r2.results.some(r => r.tool.id === 'jwt-decoder'));
});

test('Search: empty query returns all tools', () => {
  const { results, noResult } = search('', TOOLS, { labels: CATEGORY_LABELS });
  assert.equal(results.length, TOOLS.length);
  assert.equal(noResult, false);
});

test('Search: gibberish query flags noResult', () => {
  const { noResult } = search('xyz999qweasdzxcvbnm', TOOLS, { labels: CATEGORY_LABELS });
  assert.equal(noResult, true);
});

test('Search: relatedTools returns distinct relevant tools', () => {
  const tool = TOOLS.find(t => t.id === 'image-compressor');
  const related = relatedTools(tool, TOOLS, 4);
  assert.ok(related.length > 0);
  assert.ok(!related.some(r => r.id === tool.id));
});
