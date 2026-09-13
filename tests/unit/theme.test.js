/* ============================================================
   Theme Engine & Palettes Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';
import { THEMES, getStoredTheme, applyTheme, initTheme } from '../../js/lib/theme.js';

test('Theme: contains canonical palettes', () => {
  assert.ok(THEMES.length >= 6, 'Expected at least 6 standard themes');

  const requiredIds = [
    'default',
    'white-on-black',
    'linux-mint',
    'ubuntu',
    'yosemite',
    'yosemite-night',
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

test('Desktop Tool Viewport: width aligns all tools (1100px) with exceptions for container-planner and assistant', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const css = fs.readFileSync(path.resolve('css/style.css'), 'utf8');

  // 1. Tool viewport standard max-width is 1100px (wide enough for rich multi-column tools)
  assert.ok(
    /#tool-viewport\s*\{[^}]*max-width:\s*1100px/i.test(css),
    '#tool-viewport must have desktop max-width of 1100px'
  );

  // 2. Full-width exceptions for container-planner and assistant
  assert.ok(
    css.includes('body[data-tool-id="container-planner"] #tool-viewport') &&
    css.includes('body[data-tool-id="assistant"] #tool-viewport'),
    'css/style.css must define full-width exceptions for container-planner and assistant'
  );

  assert.ok(
    css.includes('max-width: 100% !important'),
    'Full-width tool exceptions must specify max-width: 100% !important'
  );

  // 3. Files page single-page lock (no vertical scroll on page)
  assert.ok(
    css.includes('body.in-files'),
    'css/style.css must define body.in-files rules to lock page scrolling'
  );

  assert.ok(
    css.includes('.sv-fade-bottom'),
    'css/style.css must define .sv-fade-bottom styles'
  );

  assert.ok(
    css.includes('.sv-fade-wrapper'),
    'css/style.css must define .sv-fade-wrapper styles'
  );

  // 4. Yosemite themes flat 3D gradient buttons and attach popup glass styling
  assert.ok(
    css.includes('[data-theme="yosemite"] .ast-attach-popup') &&
    css.includes('[data-theme="yosemite-night"] .ast-attach-popup'),
    'css/style.css must include .ast-attach-popup in Yosemite and Yosemite Night translucent glass modal styling'
  );

  assert.ok(
    css.includes('[data-theme="yosemite"] .btn-primary') &&
    css.includes('linear-gradient(180deg, #3aa0ff 0%, #007aff 48%, #006ee6 100%)'),
    'Yosemite primary button must use flat 3D Apple blue gradient'
  );
});
