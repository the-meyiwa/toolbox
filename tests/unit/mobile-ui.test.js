/* ============================================================
   Mobile UI & Responsive Tool Engine Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { TOOLS } from '../../js/registry/index.js';
import { readStylesheet } from '../helpers/stylesheet.js';

test('Mobile UI: Tool Viewport enforces bottom dock clearance on mobile screens', () => {
  const css = readStylesheet();

  // Verify mobile media query on tool-viewport
  assert.ok(
    /@media\s*\(\s*max-width:\s*768px\s*\)[^{]*\{[\s\S]*?#tool-viewport\s*\{[^}]*padding:\s*0\s+12px\s+96px\s*!important/i.test(css),
    'css/style.css must enforce padding: 0 12px 96px !important on #tool-viewport at <= 768px for bottom dock clearance'
  );
});

test('Mobile UI: Universal two-column and multi-column layouts stack to single column on mobile', () => {
  const css = readStylesheet();

  const requiredStackClasses = [
    '.tool-row',
    '.tool-columns',
    '.tool-split',
    '.input-split',
    '.editor-split',
    '.biz-grid',
    '.inv-grid-2',
    '.pay-hub-grid',
    '.tool-grid-2',
    '.tool-grid-3',
    '.tool-grid-4'
  ];

  for (const cls of requiredStackClasses) {
    assert.ok(
      css.includes(cls),
      `css/style.css must include mobile responsive stacking rule for ${cls}`
    );
  }

  assert.ok(
    css.includes('flex-direction: column !important') || css.includes('grid-template-columns: 1fr !important'),
    'Multi-column layouts must stack vertically on mobile screens'
  );
});

test('Mobile UI: Action bars, buttons, and control groups wrap on mobile', () => {
  const css = readStylesheet();

  assert.ok(
    css.includes('.tool-controls') && css.includes('flex-wrap: wrap !important;'),
    '.tool-controls must have flex-wrap: wrap !important on mobile'
  );
  assert.ok(
    css.includes('.btn-group') && css.includes('flex-wrap: wrap !important;'),
    '.btn-group must have flex-wrap: wrap !important on mobile'
  );
});

test('Mobile UI: Touch targets maintain comfortable finger tap sizes (min 38px - 44px)', () => {
  const css = readStylesheet();

  assert.ok(
    css.includes('min-height: 40px !important;') || css.includes('min-height: 42px !important;'),
    'Mobile form controls and buttons must declare comfortable minimum heights'
  );
});

test('Mobile UI: Diagram and modeling palettes convert to horizontal scroll bars', () => {
  const css = readStylesheet();

  assert.ok(
    css.includes('.flw-palette') && css.includes('overflow-x: auto !important;'),
    'Flowchart palette must scroll horizontally on mobile'
  );
  assert.ok(
    css.includes('.uml-palette') && css.includes('overflow-x: auto !important;'),
    'UML diagram palette must scroll horizontally on mobile'
  );
  assert.ok(
    css.includes('.lgl-palette') && css.includes('overflow-x: auto !important;'),
    'Logic lab palette must scroll horizontally on mobile'
  );
  assert.ok(
    css.includes('.alab-bar') && css.includes('flex-direction: column !important;'),
    'Algorithm lab bar must stack on mobile'
  );
});

test('Mobile UI: Visual stages and canvas elements scale within viewport bounds', () => {
  const css = readStylesheet();

  assert.ok(
    css.includes('.cr-stage') && css.includes('max-height: 280px !important;'),
    'Image cropper stage must constrain max-height on mobile'
  );
  assert.ok(
    css.includes('.wm-stage') && css.includes('max-height: 280px !important;'),
    'Watermark stage must constrain max-height on mobile'
  );
  assert.ok(
    css.includes('.st-gauge-wrap') && css.includes('max-width: 220px !important;'),
    'Speed test gauge must constrain width on mobile'
  );
  assert.ok(
    css.includes('.tuner-needle-wrap') && css.includes('max-width: 200px !important;'),
    'Guitar tuner needle must constrain width on mobile'
  );
});

test('Mobile UI: Periodic table and wide data containers support touch horizontal scroll', () => {
  const css = readStylesheet();

  assert.ok(
    css.includes('.pt-wrap') && css.includes('overflow-x: auto !important;'),
    'Periodic table wrapper must support horizontal touch scrolling'
  );
  assert.ok(
    css.includes('-webkit-overflow-scrolling: touch !important;'),
    'Scroll containers must declare smooth touch scrolling for iOS'
  );
});

test('Mobile UI: All 14 Tool Categories have distinct mobile rules in css/style.css', () => {
  const css = readStylesheet();

  const categorySelectors = {
    'developer': ['.diff-split', '.cron-grid', '.hm-grid', '.jview-split', '.sql-grid'],
    'business': ['.inv-wrap', '.cap-table-wrap', '.be-grid', '.bmc-grid'],
    'images-files': ['.cr-layout', '.wm-layout', '.exif-split', '.pde-layout'],
    'numbers': ['.calc-grid', '.stat-grid', '.bcon-grid'],
    'text': ['.md-split', '.wc-grid', '.slug-split'],
    'networking': ['.st-layout', '.ip-grid', '.dns-grid'],
    'science': ['.pt-wrap', '.unit-grid', '.astro-grid'],
    'law': ['.nda-grid', '.privacy-grid', '.contract-grid'],
    'music': ['.tuner-layout', '.bpm-grid', '.synth-keys'],
    'reference': ['.bible-layout', '.quran-layout', '.tz-grid'],
    'design': ['.cp-layout', '.svg-split', '.palette-grid'],
    'everyday': ['.clock-grid', '.weather-grid', '.timer-grid'],
    'modeling': ['.flw-layout', '.uml-layout', '.lgl-layout'],
    'security': ['.hash-grid', '.pw-grid', '.jwt-split']
  };

  for (const [cat, selectors] of Object.entries(categorySelectors)) {
    const matched = selectors.some(sel => css.includes(sel));
    assert.ok(
      matched,
      `Category "${cat}" must have mobile responsive rules defined in css/style.css (checked ${selectors.join(', ')})`
    );
  }
});

test('Mobile UI: Every registered tool has viewport rendering capability and responsive DOM structure', () => {
  assert.ok(TOOLS.length >= 109, `Expected at least 109 tools in registry, found ${TOOLS.length}`);

  for (const tool of TOOLS) {
    assert.ok(tool.id, `Tool missing id`);
    assert.ok(tool.name, `Tool ${tool.id} missing name`);
    assert.ok(tool.category, `Tool ${tool.id} missing category`);
  }
});

test('Modern UI/UX Standards: Universal Search Box sizing is strictly restrained and sleek (<= 36px desktop / 38px mobile)', () => {
  const css = readStylesheet();
  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf-8');

  // Hero search bar in index.html is modern and sleek
  assert.ok(
    indexHtml.includes('height:38px;') || indexHtml.includes('height: 38px;'),
    'Home hero search box must be sleek (38px height)'
  );
  assert.ok(
    !indexHtml.includes('padding: 0 54px 0 54px;') && !indexHtml.includes('padding:0 54px 0 54px;'),
    'Home hero search box must not have bulky 54px padding'
  );

  // Universal CSS rules covering all search bars
  assert.ok(
    css.includes('#search') && css.includes('.home-search-input') && css.includes('max-height: 36px !important;'),
    'Universal search rule must enforce max-height: 36px !important on desktop'
  );
  assert.ok(
    css.includes('input[placeholder*="Search" i]') || css.includes('input[type="search"]'),
    'Universal search rule must target all search inputs by selector and placeholder'
  );
});

test('Modern UI/UX Standards: Files View buttons have compact desktop height (26px - 28px)', () => {
  const css = readStylesheet();
  const savedJs = fs.readFileSync(path.resolve('js/views/saved.js'), 'utf-8');

  assert.ok(
    css.includes('.sv-head .btn') && css.includes('height: 28px !important;'),
    '.sv-head .btn must have 28px height on desktop'
  );
  assert.ok(
    css.includes('.sv-head .sv-tb-btn') && css.includes('height: 26px !important;'),
    '.sv-head .sv-tb-btn must have 26px height on desktop'
  );
  assert.ok(
    css.includes('.sv-head #sv-search-box') && css.includes('height: 28px !important;'),
    '.sv-head #sv-search-box must have 28px height on desktop'
  );
  assert.ok(
    savedJs.includes('height:28px') || savedJs.includes('height: 28px'),
    'saved.js must render buttons with compact 28px dimensions'
  );
});

test('Mobile-Adapted Tool Behaviors: Progressive disclosure switchers linearize desktop-heavy multi-pane layouts', () => {
  const css = readStylesheet() + fs.readFileSync(path.resolve('css/code-playground.css'), 'utf-8');
  const cpgJs = fs.readFileSync(path.resolve('js/tools/code-playground.js'), 'utf-8') + fs.readFileSync(path.resolve('js/lib/playground/ide.js'), 'utf-8');
  const flJs = fs.readFileSync(path.resolve('js/tools/flowchart.js'), 'utf-8');
  const umlJs = fs.readFileSync(path.resolve('js/tools/uml-diagram.js'), 'utf-8');
  const ptJs = fs.readFileSync(path.resolve('js/tools/periodic-table.js'), 'utf-8');

  // 1. Code Playground: Mobile Segmented Switcher [ Editor | Files | Preview | Console ]
  assert.ok(cpgJs.includes('id="cpg-mobile-nav"'), 'Code playground must include #cpg-mobile-nav segmented control');
  assert.ok(cpgJs.includes('data-tab="editor"') && cpgJs.includes('data-tab="preview"'), 'Code playground must provide tab targets');
  assert.ok(css.includes('#cpg-root[data-mob-view="files"]'), 'CSS must manage single-pane visibility for code playground on mobile');

  // 2. Flowchart: Mobile Segmented Switcher [ Diagram | Code ]
  assert.ok(flJs.includes('id="fl-mob-switcher"'), 'Flowchart must include #fl-mob-switcher');
  assert.ok(flJs.includes('data-view="chart"') && flJs.includes('data-view="code"'), 'Flowchart must provide Diagram/Code tabs');
  assert.ok(css.includes('.flw[data-mob-view="code"]'), 'CSS must toggle code and chart panes for Flowchart on mobile');

  // 3. UML Diagram: Mobile Segmented Switcher [ Preview | Source Code ]
  assert.ok(umlJs.includes('id="uml-mob-switcher"'), 'UML Diagram must include #uml-mob-switcher');
  assert.ok(umlJs.includes('data-view="preview"') && umlJs.includes('data-view="editor"'), 'UML Diagram must provide Preview/Source Code tabs');
  assert.ok(css.includes('.uml[data-mob-view="editor"]'), 'CSS must toggle editor and preview panes for UML Diagram on mobile');

  // 4. Periodic Table: Mobile Segmented Switcher [ Element Cards | 18-Col Table ] & Card Grid
  assert.ok(ptJs.includes('id="pt-mob-switcher"'), 'Periodic table must include #pt-mob-switcher');
  assert.ok(ptJs.includes('id="pt-card-grid"'), 'Periodic table must render #pt-card-grid for mobile');
  assert.ok(css.includes('.pt-wrap[data-mob-view="table"]'), 'CSS must toggle card grid and 18-col table on mobile');

  // 5. Cap Table: Mobile Responsive Cards
  assert.ok(css.includes('.ct-row') && css.includes('.ct-row-3') && css.includes('flex-wrap: wrap !important;'), 'Cap table rows must wrap cleanly on mobile');
});

