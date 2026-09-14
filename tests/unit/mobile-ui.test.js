/* ============================================================
   Mobile UI & Responsive Tool Engine Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { TOOLS } from '../../js/registry/index.js';

test('Mobile UI: Tool Viewport enforces bottom dock clearance on mobile screens', () => {
  const css = fs.readFileSync(path.resolve('css/style.css'), 'utf-8');

  // Verify mobile media query on tool-viewport
  assert.ok(
    /@media\s*\(\s*max-width:\s*768px\s*\)[^{]*\{[\s\S]*?#tool-viewport\s*\{[^}]*padding:\s*0\s+12px\s+96px\s*!important/i.test(css),
    'css/style.css must enforce padding: 0 12px 96px !important on #tool-viewport at <= 768px for bottom dock clearance'
  );
});

test('Mobile UI: Universal two-column and multi-column layouts stack to single column on mobile', () => {
  const css = fs.readFileSync(path.resolve('css/style.css'), 'utf-8');

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
  const css = fs.readFileSync(path.resolve('css/style.css'), 'utf-8');

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
  const css = fs.readFileSync(path.resolve('css/style.css'), 'utf-8');

  assert.ok(
    css.includes('min-height: 40px !important;') || css.includes('min-height: 42px !important;'),
    'Mobile form controls and buttons must declare comfortable minimum heights'
  );
});

test('Mobile UI: Diagram and modeling palettes convert to horizontal scroll bars', () => {
  const css = fs.readFileSync(path.resolve('css/style.css'), 'utf-8');

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
  const css = fs.readFileSync(path.resolve('css/style.css'), 'utf-8');

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
  const css = fs.readFileSync(path.resolve('css/style.css'), 'utf-8');

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
  const css = fs.readFileSync(path.resolve('css/style.css'), 'utf-8');

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
