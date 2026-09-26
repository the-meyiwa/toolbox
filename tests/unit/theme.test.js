/* ============================================================
   Theme Engine & Palettes Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';
import { THEMES, getStoredTheme, applyTheme, initTheme } from '../../js/lib/theme.js';
import { readStylesheet } from '../helpers/stylesheet.js';

test('Theme: offers System, Light and Dark', () => {
  assert.deepEqual(THEMES.map(t => t.id), ['system', 'light', 'dark']);
  for (const theme of THEMES) {
    assert.ok(theme.name, `Theme "${theme.id}" has no display name`);
    assert.ok(theme.description, `Theme "${theme.id}" has no description`);
  }
});

test('Theme: light is the default token set and dark overrides it', () => {
  const css = readStylesheet();
  assert.ok(/:root,\s*\[data-theme="light"\]\s*\{/.test(css), 'Light tokens must apply on :root and [data-theme="light"]');
  assert.ok(/\[data-theme="dark"\]\s*\{[^}]*--bg:/.test(css), '[data-theme="dark"] must redefine --bg');
  assert.ok(/\[data-theme="dark"\]\s*\{[^}]*--text:/.test(css), '[data-theme="dark"] must redefine --text');
});

test('Theme: applyTheme updates DOM and localStorage', () => {
  setupDOMEnvironment();

  applyTheme('dark');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(getStoredTheme(), 'dark');

  applyTheme('light');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
  assert.equal(getStoredTheme(), 'light');

  // Old palette themes migrate to the side they looked like.
  applyTheme('ubuntu');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
  assert.equal(getStoredTheme(), 'dark');

  applyTheme('claude');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'light');
  assert.equal(getStoredTheme(), 'light');

  // System resolves to light or dark but stores the preference itself.
  applyTheme('system');
  assert.ok(['light', 'dark'].includes(document.documentElement.getAttribute('data-theme')));
  assert.equal(getStoredTheme(), 'system');
});

test('Theme: initTheme hydrates theme on boot', () => {
  setupDOMEnvironment();
  localStorage.setItem('toolbox_theme', 'dark');

  const theme = initTheme();
  assert.equal(theme, 'dark');
  assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
});

test('Desktop Tool Viewport: tools share one centered width, wide tools opt out', () => {
  const css = readStylesheet();
  assert.ok(
    /#tool-viewport\s*\{[^}]*max-width:\s*calc\(var\(--tool-max\)/.test(css),
    '#tool-viewport must be capped at the --tool-max token'
  );
  assert.ok(/#tool-viewport\s*\{[^}]*margin:\s*0 auto/.test(css), '#tool-viewport must be centered');
  assert.ok(/--tool-max:\s*\d+px/.test(css), '--tool-max token must be defined');
  assert.ok(/body\.tool-wide #tool-viewport\s*\{[^}]*max-width:/.test(css), 'body.tool-wide must widen the viewport');
});

test('Calculator Tool: Button Group Spacing & Pill Chips Styling', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const css = readStylesheet();

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
  const css = readStylesheet();

  assert.ok(
    html.includes('id="header-about-link"') && html.includes('href="#about"'),
    'index.html must include #header-about-link pointing to #about'
  );
  assert.ok(
    html.includes('header-avatar-btn') || html.includes('header-menu-btn'),
    'index.html must have header preferences button'
  );
  assert.ok(
    /\.header-avatar-btn\s*\{[^}]*border-radius:\s*var\(--radius-pill\)/.test(css),
    '.header-avatar-btn must be circular'
  );
});

test('Pill Buttons & Typography Smoothing', () => {
  const css = readStylesheet();
  assert.ok(/\.btn\s*\{[^}]*border-radius:\s*var\(--radius-pill\)/.test(css), '.btn must be pill shaped');
  assert.ok(
    /body\s*\{[^}]*-webkit-font-smoothing:\s*antialiased/.test(css) &&
    /body\s*\{[^}]*-moz-osx-font-smoothing:\s*grayscale/.test(css),
    'body must enable font smoothing'
  );
});

test('Home Page Suggested Tools: excludes Assistant from #home-quick row and is centered', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const appJs = fs.readFileSync(path.resolve('js/app.js'), 'utf8');
  const css = readStylesheet();

  assert.ok(
    appJs.includes("t.id !== 'assistant'") && appJs.includes('popular(8)'),
    'renderQuickRow in js/app.js must query popular tools and explicitly filter out assistant'
  );
  assert.ok(
    /\.home-quick\s*\{[^}]*justify-content:\s*center/.test(css),
    '.home-quick must center its items under the search bar'
  );
});

test('Theme: legacy token aliases resolve to the new tokens in both modes', () => {
  const css = readStylesheet();
  const m = css.match(/:root,\s*\[data-theme="light"\],\s*\[data-theme="dark"\]\s*\{([^}]*)\}/);
  assert.ok(m, 'Legacy aliases must be declared for :root, light and dark');
  const block = m[1];
  for (const alias of ['--g50: var(--surface-2)', '--g200: var(--line-strong)', '--g800: var(--text)', '--accent: var(--ink)', '--accent-contrast: var(--text-inverse)']) {
    assert.ok(block.includes(alias), `Legacy alias missing: ${alias}`);
  }
});

test('Theme: picker renders one option per theme', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const css = readStylesheet();
  const settingsUi = fs.readFileSync(path.resolve('js/lib/settings-ui.js'), 'utf-8');

  assert.ok(/\.theme-choice\s*\{[^}]*grid-template-columns:\s*repeat\(3, 1fr\)/.test(css), '.theme-choice must lay out three options');
  assert.ok(/\.theme-option\.is-active\s*\{/.test(css), '.theme-option.is-active must be styled');
  assert.ok(settingsUi.includes('class="theme-option'), 'settings-ui must render .theme-option buttons');
  assert.ok(settingsUi.includes('role="radio"'), 'theme options must be radios');
});

test('UI Refinements: Top Bar About Link is strictly mobile only', () => {
  const css = readStylesheet();
  assert.ok(/#header-about-link\s*\{\s*display:\s*none;?\s*\}/.test(css), 'Desktop #header-about-link must be hidden');
  assert.ok(
    /@media\s*\(max-width:\s*768px\)\s*\{[\s\S]*?#header-about-link\s*\{\s*display:\s*inline-flex/.test(css),
    'Mobile @media (max-width: 768px) must show #header-about-link'
  );
});

test('UI Refinements: Files view is hidden with !important and unmount clears DOM', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const css = readStylesheet();
  const savedJs = fs.readFileSync(path.resolve('js/views/saved.js'), 'utf-8');
  const appJs = fs.readFileSync(path.resolve('js/app.js'), 'utf-8');

  // CSS must have #saved-view.hidden display: none !important
  assert.ok(
    css.includes('#saved-view.hidden') &&
    css.includes('display: none !important;'),
    '#saved-view.hidden must have display: none !important'
  );

  // saved.js unmount cleanup must empty host.innerHTML
  assert.ok(
    savedJs.includes("host.innerHTML = '';"),
    'unmountSaved cleanup in saved.js must clear host.innerHTML'
  );

  // app.js showPage must clean up savedView when navigating away
  assert.ok(
    appJs.includes("if (page !== 'saved' && page !== 'files')") &&
    appJs.includes("if (savedView) savedView.innerHTML = '';"),
    'app.js showPage must empty savedView when navigating to any non-files page'
  );
});

test('UI Refinements: Avatar Selector styling and card grid', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const css = readStylesheet();

  // .settings-avatar-grid-gallery grid layout
  assert.ok(
    css.includes('.settings-avatar-grid-gallery') &&
    css.includes('grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))'),
    '.settings-avatar-grid-gallery must be defined with responsive minmax grid'
  );

  // .avatar-story-card styles
  assert.ok(
    css.includes('.avatar-story-card') &&
    css.includes('.avatar-story-card.is-active') &&
    css.includes('.avatar-story-avatar-wrap') &&
    css.includes('.avatar-story-badge'),
    'CSS must style avatar-story-card, active state, avatar image wrap, and badge'
  );
});

test('UI Refinements: Calendar month switcher slide/fade animations', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const css = readStylesheet();
  const calJs = fs.readFileSync(path.resolve('js/tools/calendar.js'), 'utf-8');

  // CSS keyframes
  assert.ok(
    css.includes('@keyframes calFadeSlideLeft') &&
    css.includes('@keyframes calFadeSlideRight') &&
    css.includes('.cal-anim-slide-left') &&
    css.includes('.cal-anim-slide-right'),
    'CSS must define calFadeSlideLeft, calFadeSlideRight, and animation utility classes'
  );

  // calendar.js triggers animation on prevBtn and nextBtn
  assert.ok(
    calJs.includes("renderCurrentView('prev')") &&
    calJs.includes("renderCurrentView('next')"),
    'calendar.js must pass prev and next animDir to renderCurrentView'
  );
  assert.ok(
    calJs.includes('cal-anim-slide-left') &&
    calJs.includes('cal-anim-slide-right'),
    'calendar.js must apply cal-anim-slide classes on monthTitle'
  );
});

test('UI Refinements: Assistant hides related tools', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const css = readStylesheet();
  const appJs = fs.readFileSync(path.resolve('js/app.js'), 'utf-8');

  assert.ok(appJs.includes("tool?.id === 'assistant'"), 'app.js renderRelated must suppress related tools for assistant');
  assert.ok(/body\.in-tool[^{]*#tool-related[^{]*\{\s*display:\s*none !important/.test(css), 'In-tool mode must hide #tool-related');
});

test('UI Refinements: Container Quote Builder full height and mobile scaling', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const css = readStylesheet();
  const appJs = fs.readFileSync(path.resolve('js/app.js'), 'utf-8');

  assert.ok(css.includes('body[data-tool-id="container-planner"] #tool-related'), 'Container planner must hide related tools');
  assert.ok(appJs.includes("tool?.id === 'container-planner'"), 'app.js renderRelated must suppress related tools for container-planner');
  assert.ok(
    css.includes('body[data-tool-id="container-planner"] .t3d-canvas') && css.includes('max-height: 300px !important;'),
    'Container planner canvas must be scaled on mobile to max-height 300px'
  );
  assert.ok(
    css.includes('body[data-tool-id="container-planner"] .cp') && css.includes('flex-direction: column !important;'),
    'Container planner .cp must adapt to column layout on mobile'
  );
});

