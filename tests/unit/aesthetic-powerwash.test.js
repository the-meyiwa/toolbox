/* ============================================================
   Toolbox UI/UX Audit & Aesthetic Powerwash Test Suite
   Exhaustive automated verification covering:
   1. Typography & Font Stacks (R2, AC 1)
   2. Diffuse Multi-Stop Layered Elevation Shadows (R2, AC 2)
   3. Standardized Border Radii & Design Tokens (R2, F3)
   4. Dynamic Adaptive Glassmorphism & Token Compliance (R3, AC 3)
   5. Animation CSS Deduplication & Keyframe Integrity (R2, F4)
   6. WCAG AA Contrast Compliance in Light and Dark (R3, F7)
   7. Mobile Viewports, Breakpoints, Safe Area & Overflow Safety (R1, AC 4)
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES } from '../../js/lib/theme.js';
import { readStylesheet } from '../helpers/stylesheet.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const indexHtmlPath = path.join(projectRoot, 'index.html');

// Read files synchronously once for all tests
const styleCss = readStylesheet();
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

/* ============================================================
   PARSING & CSS AST HELPER FUNCTIONS
   ============================================================ */

/**
 * Extracts the contents of the first CSS rule block matching selector pattern.
 * Uses brace depth matching to accurately handle nested blocks.
 */
function extractBlock(css, selectorRegex) {
  const match = selectorRegex.exec(css);
  if (!match) return null;
  const start = match.index + match[0].length;
  let depth = 1;
  let i = start;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }
  return css.slice(start, i - 1);
}

/**
 * Extracts all CSS rule blocks matching a selector pattern (e.g. repeated media queries).
 */
function extractAllBlocks(css, selectorRegex) {
  const blocks = [];
  const regex = new RegExp(
    selectorRegex.source,
    selectorRegex.flags.includes('g') ? selectorRegex.flags : selectorRegex.flags + 'g'
  );
  let match;
  while ((match = regex.exec(css)) !== null) {
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    blocks.push(css.slice(start, i - 1));
  }
  return blocks;
}

/**
 * Extracts a CSS property or custom property value from a block.
 */
function getProperty(block, propName) {
  if (!block) return null;
  const regex = new RegExp(`(?:^|[;\\s])${propName}\\s*:\\s*([^;]+);`, 'm');
  const match = block.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Splits a CSS value by top-level commas (ignoring commas inside parentheses like rgba(...) or color-mix(...)).
 */
function splitTopLevelCommas(value) {
  if (!value) return [];
  const parts = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}

/**
 * Parses color string (#rgb, #rrggbb, rgb, rgba) into {r, g, b}.
 */
function parseColor(colorStr) {
  if (!colorStr) throw new Error('Color string is empty');
  colorStr = colorStr.trim();
  if (colorStr.startsWith('#')) {
    let hex = colorStr.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const num = parseInt(hex.slice(0, 6), 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }
  const rgbMatch = colorStr.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10)
    };
  }
  throw new Error(`Unsupported color format for test: ${colorStr}`);
}

/**
 * Computes WCAG 2.1 relative luminance of an RGB object.
 */
function getRelativeLuminance(rgb) {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Computes WCAG 2.1 contrast ratio between two colors (>= 1.0 and <= 21.0).
 */
function getContrastRatio(color1, color2) {
  const l1 = getRelativeLuminance(parseColor(color1));
  const l2 = getRelativeLuminance(parseColor(color2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/* ============================================================
   TIER 1: FONT STACKS & TYPOGRAPHY (R2, AC 1)
   ============================================================ */

test('Typography: --font-sans puts the Apple system stack ahead of Segoe and generic fallbacks', () => {
  const sans = getProperty(styleCss, '--font-sans');
  assert.ok(sans, ':root must define --font-sans');
  const sfPro = sans.search(/SF Pro/);
  const apple = sans.indexOf('-apple-system');
  const segoe = sans.indexOf('Segoe');
  assert.ok(sfPro !== -1 && apple !== -1 && sans.includes('BlinkMacSystemFont'), '--font-sans must include SF Pro, -apple-system and BlinkMacSystemFont');
  assert.ok(apple < segoe, '-apple-system must precede Segoe UI');
  assert.ok(/--sans:\s*var\(--font-sans\)/.test(styleCss), '--sans alias must point at --font-sans');
});

test('Typography: --font-mono begins with ui-monospace and SF Mono', () => {
  const mono = getProperty(styleCss, '--font-mono');
  assert.ok(mono, ':root must define --font-mono');
  const uiMonoIndex = mono.indexOf('ui-monospace');
  const sfMonoIndex = mono.search(/"SF Mono"|'SF Mono'|SF Mono/);
  assert.equal(uiMonoIndex, 0, '--font-mono must start with ui-monospace');
  assert.ok(sfMonoIndex > uiMonoIndex, 'SF Mono must follow ui-monospace');
  assert.ok(/--mono:\s*var\(--font-mono\)/.test(styleCss), '--mono alias must point at --font-mono');
});

test('Typography: No CSS rule overrides font-family with Inter as first font family', () => {
  // Check for any rule setting font-family: 'Inter', ... or font-family: Inter, ...
  const regex = /font-family\s*:\s*['"]?Inter['"]?\s*[,;]/gi;
  const matches = [...styleCss.matchAll(regex)];

  assert.equal(
    matches.length,
    0,
    `Found ${matches.length} rule(s) overriding font-family with 'Inter' first. Generic fonts must not override native system fonts.`
  );
});

/* ============================================================
   TIER 2: LAYERED ELEVATION SHADOWS (R2, AC 2)
   ============================================================ */

test('Elevation: light tokens define three shadow levels, the larger ones layered', () => {
  const light = extractBlock(styleCss, /:root,\s*\[data-theme="light"\]\s*\{/);
  assert.ok(light, 'Light token block must exist');
  for (const token of ['--shadow-1', '--shadow-2', '--shadow-3']) {
    assert.ok(getProperty(light, token), `Light tokens must define ${token}`);
  }
  for (const token of ['--shadow-2', '--shadow-3']) {
    const stops = splitTopLevelCommas(getProperty(light, token));
    assert.ok(stops.length >= 2, `${token} must layer at least two shadows`);
  }
});

test('Elevation: dark mode shadows stay visible on near-black', () => {
  const dark = extractBlock(styleCss, /\[data-theme="dark"\]\s*\{/);
  assert.ok(dark, '[data-theme="dark"] token block must exist');
  for (const token of ['--shadow-1', '--shadow-2', '--shadow-3']) {
    const value = getProperty(dark, token);
    assert.ok(value, `Dark tokens must define ${token}`);
    assert.ok(value.includes('0 0 0 1px') || value.includes('rgba(255'), `Dark ${token} must carry a light hairline so it reads on black (got "${value}")`);
  }
});

test('Tokens: :root defines standardized border radius tokens (--radius-xs through --radius-pill)', () => {
  for (const token of ['--radius-xs', '--radius-sm', '--radius-md', '--radius-lg', '--radius-pill']) {
    assert.ok(getProperty(styleCss, token), `:root must define ${token}`);
  }
});

test('Glassmorphism: Elements with backdrop-filter do not use hardcoded static white or black RGBA', () => {
  // Match rules containing backdrop-filter: blur(...)
  const ruleRegex = /([^{}]+)\{([^}]+backdrop-filter\s*:[^;]*blur[^}]+)\}/gi;
  let match;
  const violations = [];

  // Scrim backdrops for modals (dimming overlays) and drag-and-drop overlays are exempt
  const exemptBackdrops = [
    'settings-modal-backdrop',
    'custom-dialog-backdrop',
    'notes-drawer-backdrop',
    'is-drag-over'
  ];

  while ((match = ruleRegex.exec(styleCss)) !== null) {
    const selector = match[1].trim();
    const body = match[2];

    const isExempt = exemptBackdrops.some(exempt => selector.includes(exempt));
    if (isExempt) continue;

    // Check for hardcoded rgba(255, 255, 255, X) or rgba(0, 0, 0, X) on background
    const bgMatch = body.match(/background(?:-color)?\s*:\s*([^;]+);/i);
    if (bgMatch) {
      const bgValue = bgMatch[1].trim();
      const hasStaticWhite = /rgba\(\s*255\s*,\s*255\s*,\s*255/i.test(bgValue);
      const hasStaticBlack = /rgba\(\s*0\s*,\s*0\s*,\s*0/i.test(bgValue);

      if (hasStaticWhite || hasStaticBlack) {
        violations.push(`${selector} -> ${bgValue}`);
      }
    }
  }

  assert.equal(
    violations.length,
    0,
    `Found hardcoded static RGBA on glassmorphic elements (violates R3 & UI Rule §25). Use color-mix with var(--bg-card) instead:\n${violations.join('\n')}`
  );
});

test('Glassmorphism: header and mobile nav blur over a translucent token colour', () => {
  const header = extractBlock(styleCss, /#app-header\s*\{/);
  assert.ok(header, '#app-header must be styled');
  assert.ok(getProperty(header, 'background').startsWith('color-mix(in srgb, var(--bg)'), '#app-header background must mix the --bg token');
  assert.ok(header.includes('backdrop-filter'), '#app-header must blur what scrolls beneath it');
  assert.ok(/--bg-glass:\s*color-mix\(/.test(styleCss), '--bg-glass token must be a color-mix');
});

test('Animations: no @keyframes name is declared twice', () => {
  const counts = new Map();
  for (const [, name] of styleCss.matchAll(/@keyframes\s+([\w-]+)/g)) counts.set(name, (counts.get(name) || 0) + 1);
  assert.ok(counts.size > 0, 'Stylesheet must declare keyframes');
  const dupes = [...counts].filter(([, n]) => n > 1).map(([name, n]) => `${name} x${n}`);
  assert.deepEqual(dupes, [], `Duplicate @keyframes declarations: ${dupes.join(', ')}`);
});

test('Contrast: ink on background and inverse text on ink meet WCAG AA in light and dark', () => {
  const blocks = {
    light: extractBlock(styleCss, /:root,\s*\[data-theme="light"\]\s*\{/),
    dark: extractBlock(styleCss, /\[data-theme="dark"\]\s*\{/),
  };
  for (const [mode, block] of Object.entries(blocks)) {
    assert.ok(block, `${mode} token block must exist`);
    const pairs = [['--text', '--bg'], ['--text-2', '--bg'], ['--text-3', '--surface'], ['--text-inverse', '--ink']];
    for (const [fg, bg] of pairs) {
      const ratio = getContrastRatio(getProperty(block, fg), getProperty(block, bg));
      assert.ok(ratio >= 4.5, `${mode}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1 (must be >= 4.5:1)`);
    }
  }
});

test('Mobile: .mobile-nav includes iOS safe-area-inset-bottom padding', () => {
  const mobileNavRules = [...styleCss.matchAll(/(?:\.mobile-nav|#mobile-nav)[^{]*\{([^}]+)\}/gi)];
  assert.ok(mobileNavRules.length > 0, 'Stylesheet must contain .mobile-nav declarations');

  const hasSafeArea = mobileNavRules.some(m => {
    const body = m[1];
    return body.includes('env(safe-area-inset-bottom');
  });

  assert.ok(
    hasSafeArea,
    '.mobile-nav must declare padding-bottom or height using env(safe-area-inset-bottom) to prevent home-indicator collision on modern devices'
  );
});

test('Mobile: Pro Tips modal layout does not amputate bottom border on centered window', () => {
  const tipsModalMatch = indexHtml.match(/<div[^>]*id=["']tips-modal["'][^>]*>/i);
  assert.ok(tipsModalMatch, 'index.html must contain #tips-modal');

  const styleStr = tipsModalMatch[0];
  const isCentered = styleStr.includes('align-items:center') || styleStr.includes('align-items: center');

  if (isCentered) {
    const amputated = styleCss.includes('#tips-modal .settings-modal-window') && styleCss.includes('border-bottom: none');
    assert.ok(!amputated, '#tips-modal .settings-modal-window must not have border-bottom: none while floating centered');
  }
});

test('Mobile: .ct-row-3 media query at <=900px defines 4 columns to match 4 child elements', () => {
  const mediaBlocks = extractAllBlocks(styleCss, /@media\s*\(max-width\s*:\s*900px\)\s*\{/g);
  assert.ok(mediaBlocks.length > 0, 'css/style.css must contain @media (max-width: 900px)');

  let targetRuleBody = null;
  for (const block of mediaBlocks) {
    if (block.includes('.ct-row-3')) {
      const row3Match = block.match(/\.ct-row-3\s*\{([^}]+)\}/);
      const combinedMatch = block.match(/(?:\.ct-row\s*,\s*\.ct-row-3|\.ct-row-3\s*,\s*\.ct-row)\s*\{([^}]+)\}/);
      targetRuleBody = (row3Match && row3Match[1]) || (combinedMatch && combinedMatch[1]);
      if (targetRuleBody) break;
    }
  }

  assert.ok(targetRuleBody, '@media (max-width: 900px) must style .ct-row-3');

  const gridCols = getProperty(targetRuleBody, 'grid-template-columns');
  assert.ok(gridCols, '.ct-row-3 must define grid-template-columns at <=900px');

  // Must have 4 columns (e.g. 1fr 1fr 1fr auto)
  const colCount = gridCols.trim().split(/\s+/).length;
  assert.equal(
    colCount,
    4,
    `.ct-row-3 has 4 child items (Name, Raise, Pre-Money, Action); grid-template-columns must have 4 column definitions (found ${colCount}: "${gridCols}")`
  );
});

test('Mobile: Tables and data wrappers provide horizontal scrolling (overflow-x: auto)', () => {
  const tableContainerClasses = ['.table-responsive', '.calc-table-box', '.biz-table-wrap', '.sheet-wrapper', '.scroller'];

  let scrollableCount = 0;
  for (const cls of tableContainerClasses) {
    const block = extractBlock(styleCss, new RegExp(`\\${cls}\\s*\\{`));
    if (block) {
      const overflowX = getProperty(block, 'overflow-x') || getProperty(block, 'overflow');
      if (overflowX && (overflowX.includes('auto') || overflowX.includes('scroll'))) {
        scrollableCount++;
      }
    }
  }

  assert.ok(
    scrollableCount >= 2,
    `At least 2 canonical table container classes must declare overflow-x: auto (found ${scrollableCount})`
  );
});
