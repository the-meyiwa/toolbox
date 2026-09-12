/* ============================================================
   Theme Engine & Palettes Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';
import { THEMES, getStoredTheme, applyTheme, initTheme } from '../../js/lib/theme.js';

test('Theme: contains exactly 4 canonical palettes', () => {
  assert.equal(THEMES.length, 4);

  const requiredIds = [
    'default',
    'white-on-black',
    'linux-mint',
    'ubuntu',
  ];

  for (const id of requiredIds) {
    const theme = THEMES.find(t => t.id === id);
    assert.ok(theme, `Required theme "${id}" not found in THEMES`);
    assert.ok(theme.name, `Theme "${id}" has no display name`);
    assert.ok(theme.preview.bg, `Theme "${id}" missing preview bg`);
    assert.ok(theme.preview.text, `Theme "${id}" missing preview text`);
    assert.ok(theme.preview.accent, `Theme "${id}" missing preview accent`);
  }
});

test('Theme: applyTheme updates DOM and localStorage', () => {
  setupDOMEnvironment();

  // 1. Apply ubuntu theme
  applyTheme('ubuntu');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'ubuntu');
  assert.equal(getStoredTheme(), 'ubuntu');

  // 2. Apply linux-mint theme
  applyTheme('linux-mint');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'linux-mint');
  assert.equal(getStoredTheme(), 'linux-mint');

  // 3. Apply default theme removes data-theme attribute
  applyTheme('default');
  assert.equal(document.documentElement.getAttribute('data-theme'), null);
  assert.equal(getStoredTheme(), 'default');

  // 4. Apply invalid theme defaults safely
  applyTheme('non-existent-theme-xyz');
  assert.equal(document.documentElement.getAttribute('data-theme'), null);
  assert.equal(getStoredTheme(), 'default');
});

test('Theme: initTheme hydrates theme on boot', () => {
  setupDOMEnvironment();
  localStorage.setItem('toolbox_theme', 'linux-mint');

  const active = initTheme();
  assert.equal(active, 'linux-mint');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'linux-mint');
});
