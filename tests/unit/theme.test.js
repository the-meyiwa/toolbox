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

  // 2. Viewport exceptions: full-width for container-planner and proportional scaling for assistant
  assert.ok(
    css.includes('body[data-tool-id="container-planner"] #tool-viewport') &&
    css.includes('body[data-tool-id="assistant"] #tool-viewport'),
    'css/style.css must define viewport overrides for container-planner and assistant'
  );

  assert.ok(
    css.includes('max-width: 100% !important'),
    'Full-width tool exceptions must specify max-width: 100% !important'
  );

  assert.ok(
    css.includes('68vw') && css.includes('75vw'),
    'Assistant viewport on desktop must scale proportionally between half and 3/4 page width (68vw to 75vw)'
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

test('Pill Buttons, Segmented Switchers & Typography Smoothing', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const css = fs.readFileSync(path.resolve('css/style.css'), 'utf8');

  // 1. Most buttons must be pill shaped (border-radius: 9999px)
  assert.ok(
    /\.btn\s*\{[^}]*border-radius:\s*9999px/i.test(css),
    '.btn must have pill-shaped border-radius: 9999px'
  );
  assert.ok(
    /\.btn-sm\s*\{[^}]*border-radius:\s*9999px/i.test(css),
    '.btn-sm must have pill-shaped border-radius: 9999px'
  );

  // 2. Segmented switchers and slider pills must have borders and animations
  assert.ok(
    css.includes('.segmented-slider-pill'),
    'css/style.css must define .segmented-slider-pill'
  );
  assert.ok(
    css.includes('.cal-view-switcher') && css.includes('.sv-storage-switch'),
    'css/style.css must define .cal-view-switcher and .sv-storage-switch'
  );
  assert.ok(
    /\.segmented-slider-pill\s*\{[^}]*border:\s*1px solid/i.test(css),
    '.segmented-slider-pill must have border'
  );
  assert.ok(
    /\.segmented-slider-pill\s*\{[^}]*transition:[^}]*transform/i.test(css),
    '.segmented-slider-pill must animate switching with transform transition'
  );

  // 3. Typography smoothing across elements
  assert.ok(
    css.includes('-webkit-font-smoothing: antialiased !important') &&
    css.includes('text-rendering: optimizeLegibility !important'),
    'Universal typography smoothing must be active across elements'
  );
});

test('Home Page Suggested Tools: excludes Assistant from #home-quick row and is centered', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const appJs = fs.readFileSync(path.resolve('js/app.js'), 'utf8');
  const css = fs.readFileSync(path.resolve('css/style.css'), 'utf8');

  assert.ok(
    appJs.includes("t.id !== 'assistant'") && appJs.includes('popular(8)'),
    'renderQuickRow in js/app.js must query popular tools and explicitly filter out assistant'
  );

  assert.ok(
    /\.home-quick\s*\{[^}]*margin:\s*[^;]*auto/i.test(css) ||
    /\.home-quick\s*\{[^}]*margin-left:\s*auto/i.test(css),
    '.home-quick must have auto horizontal margins to center under search bar'
  );
});
