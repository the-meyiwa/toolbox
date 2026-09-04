/* ============================================================
   Artifacts Storage & Interop Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

// Initialize DOM environment before importing artifacts
setupDOMEnvironment();

const artifacts = await import('../../js/lib/artifacts.js');

test('Artifacts: save, get, list, rename, and remove workflow', () => {
  // Clear any existing artifacts
  for (const item of artifacts.list()) {
    artifacts.remove(item.id);
  }
  assert.equal(artifacts.list().length, 0);

  // Save artifact
  const art1 = artifacts.save({
    name: 'test-doc.txt',
    kind: 'text',
    text: 'Hello Toolbox Artifacts',
    from: 'text-cleaner',
  });

  assert.ok(art1.id);
  assert.equal(art1.name, 'test-doc.txt');
  assert.equal(art1.text, 'Hello Toolbox Artifacts');

  // Verify list and get
  const list = artifacts.list();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, art1.id);

  const fetched = artifacts.get(art1.id);
  assert.equal(fetched.text, 'Hello Toolbox Artifacts');

  // Rename
  const renamed = artifacts.rename(art1.id, 'renamed-doc.txt');
  assert.equal(renamed.name, 'renamed-doc.txt');

  // Remove
  artifacts.remove(art1.id);
  assert.equal(artifacts.list().length, 0);
  assert.equal(artifacts.get(art1.id), null);
});

test('Artifacts: unique name deduplication', () => {
  const art1 = artifacts.save({ name: 'report.json', kind: 'json', text: '{}' });
  const art2 = artifacts.save({ name: 'report.json', kind: 'json', text: '{"n":2}' });

  assert.equal(art1.name, 'report.json');
  assert.equal(art2.name, 'report 2.json');

  artifacts.remove(art1.id);
  artifacts.remove(art2.id);
});

test('Artifacts: handoff protocol single-hop parking', () => {
  const payload = { kind: 'json', text: '{"foo":"bar"}', from: 'jwt-decoder' };
  artifacts.handOff(payload);

  const taken = artifacts.takeHandoff();
  assert.deepEqual(taken, payload);

  // Should be consumed
  const takenAgain = artifacts.takeHandoff();
  assert.equal(takenAgain, null);
});

test('Artifacts: bundle import and export', () => {
  const art1 = artifacts.save({ name: 'data.csv', kind: 'csv', text: 'a,b\n1,2' });

  const bundleJSON = JSON.stringify({
    format: 'toolbox.artifacts',
    version: 1,
    exportedAt: new Date().toISOString(),
    items: [
      { name: 'imported.md', kind: 'markdown', text: '# Title' },
    ],
  });

  const { imported, skipped } = artifacts.importBundle(bundleJSON);
  assert.equal(imported, 1);
  assert.equal(skipped, 0);

  const items = artifacts.list();
  assert.ok(items.some(m => m.name === 'imported.md'));

  // Cleanup
  for (const item of artifacts.list()) {
    artifacts.remove(item.id);
  }
});
