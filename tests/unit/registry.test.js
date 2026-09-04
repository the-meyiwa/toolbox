/* ============================================================
   Registry & Taxonomy Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { TOOLS, CATEGORIES, ALIASES, BY_ID, categorised, inCategory, popular, resolveId, OFFLINE_TOOLS } from '../../js/registry/index.js';
import { validateRegistry } from '../../js/registry/schema.js';
import { KIND_IDS, TASK_IDS } from '../../js/registry/kinds.js';

test('Registry: validateRegistry returns zero problems', () => {
  const problems = validateRegistry(TOOLS);
  assert.deepEqual(problems, [], `Registry has validation problems:\n${problems.join('\n')}`);
});

test('Registry: all tools have mandatory fields and valid taxonomy', () => {
  assert.ok(TOOLS.length >= 100, `Expected at least 100 tools, found ${TOOLS.length}`);

  const ids = new Set();
  for (const t of TOOLS) {
    assert.ok(t.id, 'Tool missing ID');
    assert.ok(!ids.has(t.id), `Duplicate ID: ${t.id}`);
    ids.add(t.id);

    assert.ok(t.name, `Tool ${t.id} missing name`);
    assert.ok(t.description, `Tool ${t.id} missing description`);
    assert.ok(!t.description.endsWith('.'), `Tool ${t.id} description ends with period`);
    assert.ok(t.icon, `Tool ${t.id} missing icon`);
    assert.ok(t.keywords && t.keywords.length > 0, `Tool ${t.id} missing keywords`);

    assert.ok(CATEGORIES.some(c => c.id === t.category), `Tool ${t.id} has invalid category: ${t.category}`);
    for (const sec of t.secondary ?? []) {
      assert.ok(CATEGORIES.some(c => c.id === sec), `Tool ${t.id} has invalid secondary category: ${sec}`);
      assert.notEqual(sec, t.category, `Tool ${t.id} repeats primary category in secondary`);
    }

    for (const kind of t.accepts ?? []) {
      assert.ok(KIND_IDS.has(kind), `Tool ${t.id} has invalid accepts kind: ${kind}`);
    }
    for (const kind of t.produces ?? []) {
      assert.ok(KIND_IDS.has(kind), `Tool ${t.id} has invalid produces kind: ${kind}`);
    }

    if (t.task) {
      assert.ok(TASK_IDS.has(t.task), `Tool ${t.id} has invalid task: ${t.task}`);
    }

    for (const rel of t.related ?? []) {
      assert.ok(BY_ID.has(rel), `Tool ${t.id} references non-existent related tool: ${rel}`);
      assert.notEqual(rel, t.id, `Tool ${t.id} lists itself as related`);
    }
  }
});

test('Registry: aliases map cleanly to live tools', () => {
  for (const [alias, target] of Object.entries(ALIASES)) {
    assert.ok(BY_ID.has(target), `Alias "${alias}" maps to non-existent tool "${target}"`);
  }
});

test('Registry: resolveId resolves direct IDs and aliases', () => {
  assert.deepEqual(resolveId(''), { id: null, redirected: false });
  assert.deepEqual(resolveId('non-existent-tool-id-xyz'), { id: null, redirected: false });

  // Direct tool
  assert.deepEqual(resolveId('json-formatter'), { id: 'json-formatter', redirected: false });

  // Aliased tools
  assert.deepEqual(resolveId('loan-calculator'), { id: 'amortization-schedule', redirected: true });
  assert.deepEqual(resolveId('clean-text'), { id: 'text-cleaner', redirected: true });
  assert.deepEqual(resolveId('inet-qr-generator'), { id: 'qr-generator', redirected: true });
});

test('Registry: categorised groups tools properly', () => {
  const cats = categorised();
  assert.ok(cats.length > 0);
  for (const cat of cats) {
    assert.ok(cat.tools.length > 0, `Category ${cat.id} has no tools`);
    for (const t of cat.tools) {
      assert.equal(t.category, cat.id);
    }
  }
});

test('Registry: popular returns highest weight tools', () => {
  const top = popular(5);
  assert.equal(top.length, 5);
  for (let i = 0; i < top.length - 1; i++) {
    assert.ok((top[i].weight ?? 50) >= (top[i + 1].weight ?? 50));
  }
});

test('Registry: offline tools correctly identified', () => {
  assert.ok(OFFLINE_TOOLS.length > 0);
  for (const t of OFFLINE_TOOLS) {
    assert.notEqual(t.offline, false);
  }
});
