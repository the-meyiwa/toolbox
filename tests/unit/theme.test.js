/* ============================================================
   Theme Engine & Palettes Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';
import { THEMES, getStoredTheme, applyTheme, initTheme } from '../../js/lib/theme.js';

test('Theme: contains canonical palettes', () => {
  assert.equal(THEMES.length, 24, 'Expected exactly 24 canonical themes');

  const requiredIds = [
    // System (4)
    'yosemite', 'yosemite-night', 'linux-mint', 'ubuntu',
    // Minimal (2)
    'default', 'white-on-black',
    // Cultural / Design (9)
    'mondrian', 'memphis', 'art-deco', 'mid-century',
    'japanese-traditional', 'lagos', 'african-textile', 'british-racing-green', 'wimbledon',
    // Brand-Inspired (8)
    'barbie', 'tiffany', 'coca-cola', 'mcdonalds',
    'playstation', 'ikea', 'google', 'claude',
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

  const deprecated = ['windows-11', 'macos-sonoma', 'macos-big-sur', 'elementary-os', 'chromeos', 'swiss', 'bauhaus', 'lego', 'nintendo'];
  for (const d of deprecated) {
    assert.ok(!THEMES.some(t => t.id === d), `Deprecated theme "${d}" should not be in THEMES`);
  }
});

test('Theme: all 24 themes have CSS definitions in css/style.css', async () => {
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

  // 4. Apply mondrian theme
  applyTheme('mondrian');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'mondrian');
  assert.equal(getStoredTheme(), 'mondrian');

  // 5. Apply claude theme
  applyTheme('claude');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'claude');
  assert.equal(getStoredTheme(), 'claude');
});

test('Theme: initTheme hydrates theme on boot', () => {
  setupDOMEnvironment();
  localStorage.setItem('toolbox_theme', 'mondrian');

  const theme = initTheme();
  assert.equal(theme, 'mondrian');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'mondrian');
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

test('Theme: Grayscale token bridge, accent contrast & universal tool compatibility', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const css = fs.readFileSync(path.resolve('css/style.css'), 'utf8');

  // 1. All 28 themes must have grayscale bridge (--g50 through --g900)
  for (const theme of THEMES) {
    const sel = `[data-theme="${theme.id}"]`;
    const idx = css.indexOf(sel);
    assert.ok(idx !== -1, `Selector ${sel} must exist in css/style.css`);
    const end = css.indexOf('}', idx);
    const block = css.slice(idx, end);

    assert.ok(block.includes('--g50: var(--surface-secondary)'), `${theme.id} must map --g50`);
    assert.ok(block.includes('--g100: var(--surface-tertiary)'), `${theme.id} must map --g100`);
    assert.ok(block.includes('--g200: var(--border)'), `${theme.id} must map --g200`);
    assert.ok(block.includes('--g500: var(--text-secondary)'), `${theme.id} must map --g500`);
    assert.ok(block.includes('--g800: var(--text)'), `${theme.id} must map --g800`);
    assert.ok(block.includes('--accent-contrast:'), `${theme.id} must define --accent-contrast`);
  }

  // 2. :root must define black-on-white accent and contrast
  assert.ok(
    css.includes('--accent: #000000;') && css.includes('--accent-contrast: #ffffff;'),
    ':root must define black accent and white contrast for Black on White default'
  );

  // 3. Calculator equals button must use accent tokens
  assert.ok(
    css.includes('.calc-btn-eq') &&
    css.includes('background: var(--accent) !important;') &&
    css.includes('color: var(--accent-contrast, #ffffff) !important;'),
    '.calc-btn-eq must use var(--accent) and var(--accent-contrast)'
  );

  // 4. Active chips and buttons must use accent contrast
  assert.ok(
    css.includes('.category-chip.active') &&
    css.includes('color: var(--accent-contrast, #ffffff) !important;'),
    '.category-chip.active must use var(--accent-contrast)'
  );
  assert.ok(
    css.includes('.btn.active') &&
    css.includes('color: var(--accent-contrast, #ffffff) !important;'),
    '.btn.active must use var(--accent-contrast)'
  );

  // 5. Theme card must use theme surface and accent
  assert.ok(
    css.includes('.theme-card.is-active') &&
    css.includes('border-color: var(--accent);'),
    '.theme-card.is-active must use border-color: var(--accent)'
  );
});

test('Theme: Tiles are arranged vertically as long horizontal bars', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const css = fs.readFileSync(path.resolve('css/style.css'), 'utf-8');
  const settingsUi = fs.readFileSync(path.resolve('js/lib/settings-ui.js'), 'utf-8');

  // 1. .theme-grid must use a vertical column flex layout
  assert.ok(
    css.includes('.theme-grid') &&
    css.includes('flex-direction: column;'),
    '.theme-grid must use flex-direction: column to stack bars vertically'
  );

  // 2. .theme-card must be a horizontal bar with flex-direction: row
  assert.ok(
    css.includes('.theme-card') &&
    css.includes('flex-direction: row;') &&
    css.includes('align-items: center;') &&
    css.includes('width: 100%;'),
    '.theme-card must be a horizontal bar spanning full width'
  );

  // 3. settings-ui renders theme card markup with meta, palette and radio check
  assert.ok(
    settingsUi.includes('class="theme-card-palette"'),
    'renderThemeCard must render theme-card-palette'
  );
  assert.ok(
    settingsUi.includes('class="theme-card-meta"'),
    'renderThemeCard must render theme-card-meta'
  );
  assert.ok(
    settingsUi.includes('class="theme-card-check"'),
    'renderThemeCard must render theme-card-check'
  );
});


