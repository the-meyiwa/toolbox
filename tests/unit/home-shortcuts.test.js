import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

setupDOMEnvironment();
const { TOOLS } = await import('../../js/registry/index.js');
const { updateSettings } = await import('../../js/lib/settings.js');
const { homeShortcutTools, setShortcutIds, isCustomShortcuts, editableShortcutIds, MAX_SHORTCUTS } = await import('../../js/lib/home-shortcuts.js');

const visible = TOOLS.filter(t => !t.hidden);
const ids = visible.filter(t => t.id !== 'assistant').slice(0, 12).map(t => t.id);

test('automatic shortcuts are the most used tools and never the Assistant', () => {
  updateSettings({ homeShortcuts: [] });
  const tools = homeShortcutTools(visible);
  assert.equal(isCustomShortcuts(), false);
  assert.ok(tools.length > 0 && tools.length <= 6);
  assert.ok(!tools.some(t => t.id === 'assistant'));
});

test('chosen shortcuts keep their order, drop unknown tools and stop at the maximum', () => {
  setShortcutIds([ids[2], 'no-such-tool', ids[0], ids[2], ...ids.slice(3)]);
  const got = homeShortcutTools(visible).map(t => t.id);
  assert.deepEqual(got.slice(0, 2), [ids[2], ids[0]]);
  assert.equal(new Set(got).size, got.length);
  assert.ok(got.length <= MAX_SHORTCUTS);
  assert.deepEqual(editableShortcutIds(visible), got);
});

test('choosing no shortcuts at all is remembered, not mistaken for automatic', () => {
  setShortcutIds([]);
  assert.equal(isCustomShortcuts(), true);
  assert.deepEqual(homeShortcutTools(visible), []);
  updateSettings({ homeShortcuts: [] });
  assert.ok(homeShortcutTools(visible).length > 0);
});

test('shortcuts this person or device cannot open are not shown', () => {
  setShortcutIds([ids[0], ids[1]]);
  assert.deepEqual(homeShortcutTools(visible.filter(t => t.id !== ids[0])).map(t => t.id), [ids[1]]);
  updateSettings({ homeShortcuts: [] });
});
