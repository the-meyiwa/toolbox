/* ============================================================
   App Routing, Views & UI Navigation Integration Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';
import { resolveId } from '../../js/registry/index.js';
import { renderSaved } from '../../js/views/saved.js';

const { document } = setupDOMEnvironment();
const artifacts = await import('../../js/lib/artifacts.js');

test('Routing: resolveId handles canonical IDs, aliases, and bad hashes', () => {
  // Direct tool
  assert.deepEqual(resolveId('json-formatter'), { id: 'json-formatter', redirected: false });
  assert.deepEqual(resolveId('case-digest'), { id: 'case-digest', redirected: false });

  // Renamed alias
  assert.deepEqual(resolveId('loan-calculator'), { id: 'amortization-schedule', redirected: true });
  assert.deepEqual(resolveId('clean-text'), { id: 'text-cleaner', redirected: true });

  // Unknown
  assert.deepEqual(resolveId('some-random-unknown-tool'), { id: null, redirected: false });
});

test('Saved View: renders empty state when no artifacts exist', () => {
  for (const item of artifacts.list()) artifacts.remove(item.id);

  const host = document.createElement('div');
  const unmount = renderSaved(host);

  assert.ok(host.querySelector('.sv-empty'));
  assert.ok(host.textContent.includes('Nothing saved yet'));

  unmount();
});

test('Saved View: renders full list and detail view when artifacts exist', () => {
  for (const item of artifacts.list()) artifacts.remove(item.id);

  const savedArt = artifacts.save({
    name: 'meeting_notes.md',
    kind: 'markdown',
    text: '# Meeting Notes\n- Item 1\n- Item 2',
    from: 'markdown-preview',
  });

  const host = document.createElement('div');
  const unmount = renderSaved(host, savedArt.id);

  assert.ok(host.querySelector('.sv'));
  assert.ok(host.textContent.includes('meeting_notes.md'));
  assert.ok(host.querySelector('.sv-rename'));
  assert.ok(host.querySelector('.sv-preview'));

  // Test Open In button exists (since markdown has accepting tools)
  const openInBtns = host.querySelectorAll('.sv-open-btn');
  assert.ok(openInBtns.length > 0);

  // Test Hand-off on clicking Open In
  const firstOpenIn = openInBtns[0];
  firstOpenIn.click();

  const taken = artifacts.takeHandoff();
  assert.ok(taken);
  assert.equal(taken.name, 'meeting_notes.md');

  unmount();
  artifacts.remove(savedArt.id);
});
