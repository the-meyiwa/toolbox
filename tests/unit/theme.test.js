/* ============================================================
   Theme Engine & Palettes Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';
import { THEMES, getStoredTheme, applyTheme, initTheme } from '../../js/lib/theme.js';

test('Theme: contains canonical palettes', () => {
  assert.equal(THEMES.length, 28, 'Expected exactly 28 canonical themes');

  const requiredIds = [
    // System (4)
    'yosemite', 'yosemite-night', 'linux-mint', 'ubuntu',
    // Minimal (3)
    'default', 'white-on-black', 'swiss',
    // Cultural / Design (10)
    'bauhaus', 'mondrian', 'memphis', 'art-deco', 'mid-century',
    'japanese-traditional', 'lagos', 'african-textile', 'british-racing-green', 'wimbledon',
    // Brand-Inspired (10)
    'barbie', 'tiffany', 'coca-cola', 'mcdonalds', 'lego',
    'nintendo', 'playstation', 'ikea', 'google', 'claude',
    // Expressive (1)
    'miami-vice'
  ];

  for (const id of requiredIds) {
    const theme = THEMES.find(t => t.id === id);
    assert.ok(theme, `Required theme "${id}" not found in THEMES`);
    assert.ok(theme.name, `Theme "${id}" has no display name`);
    assert.ok(theme.group, `Theme "${id}" has no group`);
    assert.ok(theme.preview.bg, `Theme "${id}" missing preview bg`);
    assert.ok(theme.preview.text, `Theme "${id}" missing preview text`);
    assert.ok(theme.preview.accent, `Theme "${id}" missing preview accent`);
  }

  const deprecated = ['windows-11', 'macos-sonoma', 'macos-big-sur', 'elementary-os', 'chromeos'];
  for (const d of deprecated) {
    assert.ok(!THEMES.some(t => t.id === d), `Deprecated theme "${d}" should not be in THEMES`);
  }
});

test('Theme: all 28 themes have CSS definitions in css/style.css', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const css = fs.readFileSync(path.resolve('css/style.css'), 'utf8');

  for (const theme of THEMES) {
    assert.ok(
      css.includes(`[data-theme="${theme.id}"]`),
      `css/style.css must define [data-theme="${theme.id}"]`
    );
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

  // 4. Apply swiss theme
  applyTheme('swiss');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'swiss');
  assert.equal(getStoredTheme(), 'swiss');

  // 5. Apply claude theme
  applyTheme('claude');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'claude');
  assert.equal(getStoredTheme(), 'claude');
});

test('Theme: initTheme hydrates theme on boot', () => {
  setupDOMEnvironment();
  localStorage.setItem('toolbox_theme', 'bauhaus');

  const theme = initTheme();
  assert.equal(theme, 'bauhaus');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'bauhaus');
});

test('Desktop Tool Viewport: width aligns all tools (1100px) with exceptions for container-planner and assistant', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const css = fs.readFileSync(path.resolve('css/style.css'), 'utf8');

  // 1. Tool viewport standard desktop alignment
  assert.ok(
    /#tool-viewport\s*\{[^}]*max-width:\s*1100px/i.test(css),
    'Standard desktop tool-viewport must have max-width: 1100px'
  );
  assert.ok(
    /#tool-viewport\s*\{[^}]*margin-left:\s*auto/i.test(css) &&
    /#tool-viewport\s*\{[^}]*margin-right:\s*auto/i.test(css),
    'Desktop tool-viewport must be centered with margin auto'
  );

  // 2. Full-bleed exception for container-planner
  assert.ok(
    css.includes('container-planner') && css.includes('max-width: 100% !important'),
    'container-planner must override tool-viewport with max-width: 100% !important'
  );

  // 3. Assistant proportional scaling (~68vw to 75vw)
  assert.ok(
    css.includes('clamp(620px, 68vw, 1140px)') && css.includes('max-width: 75vw'),
    'Assistant desktop card width must scale proportionally between half and 3/4 page width'
  );
});

test('Calculator Tool: Button Group Spacing & Pill Chips Styling', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const css = fs.readFileSync(path.resolve('css/style.css'), 'utf8');

  // 1. .calc-btn-group-row must have flex, wrap and gap to prevent buttons touching
  assert.ok(
    css.includes('.calc-btn-group-row') && css.includes('gap: 8px;'),
    '.calc-btn-group-row must have display: flex and gap: 8px'
  );

  // 2. Programmer mode word size and sign chips must be pill-shaped
  assert.ok(
    css.includes('.calc-chip-group') && css.includes('border-radius: 9999px;'),
    '.calc-chip-group must have border-radius: 9999px'
  );
  assert.ok(
    css.includes('.calc-chip-btn') && css.includes('border-radius: 9999px;'),
    '.calc-chip-btn must have border-radius: 9999px'
  );
});

test('Header: Circular Avatar Preferences Button & Mobile About Link', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
  const css = fs.readFileSync(path.resolve('css/style.css'), 'utf8');

  // 1. Mobile about link in header
  assert.ok(
    html.includes('header-about-link') && html.includes('href="#about"'),
    'index.html must include .header-about-link pointing to #about'
  );
  assert.ok(
    css.includes('.header-about-link'),
    'css/style.css must define .header-about-link'
  );

  // 2. Circular avatar preferences button
  assert.ok(
    html.includes('header-avatar-btn') || html.includes('header-menu-btn'),
    'index.html must have header preferences button'
  );
  assert.ok(
    css.includes('.header-avatar-btn') && css.includes('border-radius: 50% !important;'),
    '.header-avatar-btn must be circular with border-radius: 50%'
  );
});

test('Pill Buttons, Segmented Switchers & Typography Smoothing', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const css = fs.readFileSync(path.resolve('css/style.css'), 'utf8');

  // 1. Most buttons must be pill shaped (border-radius: 9999px)
  assert.ok(
    css.includes('.btn') && css.includes('border-radius: 9999px;'),
    '.btn must have pill-shaped border-radius: 9999px'
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
    css.includes('.segmented-slider-pill') && css.includes('border: 1px solid'),
    '.segmented-slider-pill must have border'
  );
  assert.ok(
    css.includes('.segmented-slider-pill') && css.includes('transform'),
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
    css.includes('.home-quick') && css.includes('margin: 18px auto 0'),
    '.home-quick must have auto horizontal margins to center under search bar'
  );
});
