/* ============================================================
   Theme Engine & Palettes Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';
import { THEMES, getStoredTheme, applyTheme, initTheme } from '../../js/lib/theme.js';

test('Theme: contains all 9 canonical palettes + cyberpunk and experimental themes', () => {
  assert.ok(THEMES.length >= 16);

  const requiredIds = [
    'default',
    'white-on-black',
    'burgundy',
    'cozy-pink',
    'solar-blue',
    'nocturne-blue',
    'alpine-green',
    'canary-yellow',
    'espresso',
    'neon-tokyo',
    'cyber-matrix',
    'akira-crimson',
    'cyber-cyan',
    'nordic-slate',
    'sunset-ember',
    'paper-ink',
  ];

  for (const id of requiredIds) {
    const theme = THEMES.find(t => t.id === id);
    assert.ok(theme, `Required theme "${id}" not found in THEMES`);
    assert.ok(theme.name, `Theme "${id}" has no display name`);
    assert.ok(theme.preview.bg, `Theme "${id}" missing preview bg`);
    assert.ok(theme.preview.text, `Theme "${id}" missing preview text`);
    assert.ok(theme.preview.accent, `Theme "${id}" missing preview accent`);
  }

  const experimentals = THEMES.filter(t => t.experimental);
  assert.ok(experimentals.length >= 7, 'Expected at least 7 experimental/cyberpunk themes');
});

test('Theme: applyTheme updates DOM and localStorage', () => {
  setupDOMEnvironment();

  // 1. Apply burgundy theme
  applyTheme('burgundy');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'burgundy');
  assert.equal(getStoredTheme(), 'burgundy');

  // 2. Apply Neon Tokyo theme
  applyTheme('neon-tokyo');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'neon-tokyo');
  assert.equal(getStoredTheme(), 'neon-tokyo');

  // 3. Apply alias cyber-neon -> resolves to neon-tokyo
  applyTheme('cyber-neon');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'neon-tokyo');
  assert.equal(getStoredTheme(), 'neon-tokyo');

  // 4. Apply default theme removes data-theme attribute
  applyTheme('default');
  assert.equal(document.documentElement.getAttribute('data-theme'), null);
  assert.equal(getStoredTheme(), 'default');

  // 5. Apply invalid theme defaults safely
  applyTheme('non-existent-theme-xyz');
  assert.equal(document.documentElement.getAttribute('data-theme'), null);
  assert.equal(getStoredTheme(), 'default');
});

test('Theme: initTheme hydrates theme on boot', () => {
  setupDOMEnvironment();
  localStorage.setItem('toolbox_theme', 'cyber-matrix');

  const active = initTheme();
  assert.equal(active, 'cyber-matrix');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'cyber-matrix');
});
