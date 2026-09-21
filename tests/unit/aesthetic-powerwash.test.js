/* ============================================================
   Toolbox UI/UX Audit & Aesthetic Powerwash Test Suite
   Exhaustive automated verification covering:
   1. Typography & Font Stacks (R2, AC 1)
   2. Diffuse Multi-Stop Layered Elevation Shadows (R2, AC 2)
   3. Standardized Border Radii & Design Tokens (R2, F3)
   4. Dynamic Adaptive Glassmorphism & Token Compliance (R3, AC 3)
   5. Animation CSS Deduplication & Keyframe Integrity (R2, F4)
   6. WCAG AA Contrast Compliance Across 24 Canonical Themes (R3, F7)
   7. Mobile Viewports, Breakpoints, Safe Area & Overflow Safety (R1, AC 4)
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES } from '../../js/lib/theme.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const styleCssPath = path.join(projectRoot, 'css/style.css');
const indexHtmlPath = path.join(projectRoot, 'index.html');

// Read files synchronously once for all tests
const styleCss = fs.readFileSync(styleCssPath, 'utf8');
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

test('Typography: :root --sans defines Apple native system font stack ahead of Inter', () => {
  const rootBlock = extractBlock(styleCss, /:root\s*\{/);
  assert.ok(rootBlock, 'css/style.css must contain a :root definition');

  const sans = getProperty(rootBlock, '--sans');
  assert.ok(sans, ':root must define --sans token');

  // Verify -apple-system, BlinkMacSystemFont, "SF Pro Display" (with or without quotes) are present
  const appleIndex = sans.indexOf('-apple-system');
  const blinkIndex = sans.indexOf('BlinkMacSystemFont');
  const sfProIndex = sans.search(/"SF Pro Display"|'SF Pro Display'|SF Pro Display/);
  const interIndex = sans.search(/'Inter'|"Inter"|\bInter\b/);

  assert.ok(appleIndex !== -1, '--sans must include -apple-system');
  assert.ok(blinkIndex !== -1, '--sans must include BlinkMacSystemFont');
  assert.ok(sfProIndex !== -1, '--sans must include SF Pro Display');

  // -apple-system and SF Pro Display must precede Inter
  if (interIndex !== -1) {
    assert.ok(appleIndex < interIndex, `-apple-system (pos ${appleIndex}) must precede Inter (pos ${interIndex}) in --sans`);
    assert.ok(sfProIndex < interIndex, `SF Pro Display (pos ${sfProIndex}) must precede Inter (pos ${interIndex}) in --sans`);
  }
});

test('Typography: :root --mono begins with ui-monospace and SF Mono', () => {
  const rootBlock = extractBlock(styleCss, /:root\s*\{/);
  assert.ok(rootBlock, 'css/style.css must contain a :root definition');

  const mono = getProperty(rootBlock, '--mono');
  assert.ok(mono, ':root must define --mono token');

  const uiMonoIndex = mono.indexOf('ui-monospace');
  const sfMonoIndex = mono.search(/"SF Mono"|'SF Mono'|SF Mono/);

  assert.ok(uiMonoIndex !== -1, '--mono must include ui-monospace');
  assert.ok(sfMonoIndex !== -1, '--mono must include SF Mono');
  assert.ok(uiMonoIndex < sfMonoIndex, 'ui-monospace must precede SF Mono in --mono');
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

test('Elevation: :root defines multi-stop diffuse elevation tokens (--shadow-xs through --shadow-xl)', () => {
  const rootBlock = extractBlock(styleCss, /:root\s*\{/);
  assert.ok(rootBlock, 'css/style.css must contain a :root definition');

  const shadowTokens = ['--shadow-xs', '--shadow-sm', '--shadow-md', '--shadow-lg', '--shadow-xl'];

  for (const token of shadowTokens) {
    const value = getProperty(rootBlock, token);
    assert.ok(value, `:root must define ${token}`);

    const stops = splitTopLevelCommas(value);
    assert.ok(
      stops.length >= 2,
      `${token} must define at least 2 comma-separated shadow stops for diffuse ambient layering (got ${stops.length}: "${value}")`
    );
  }
});

test('Elevation: Dark themes define distinct visible shadows or ambient contrast', () => {
  const darkThemeIds = [
    'white-on-black',
    'yosemite-night',
    'coca-cola',
    'playstation',
    'miami-vice',
    'lagos',
    'ubuntu',
    'art-deco'
  ];

  for (const themeId of darkThemeIds) {
    const themeBlock = extractBlock(styleCss, new RegExp(`\\[data-theme=["']${themeId}["']\\]\\s*\\{`));
    assert.ok(themeBlock, `css/style.css must define [data-theme="${themeId}"]`);

    // In dark themes, elevation shadows must not be invisible 3%-5% black.
    // They must define their own --shadow-* tokens with higher alpha/borders or specify distinct elevated shadows.
    const shadowMd = getProperty(themeBlock, '--shadow-md');
    const shadowLg = getProperty(themeBlock, '--shadow-lg');
    const shadow = getProperty(themeBlock, '--shadow');
    const shadowElevated = getProperty(themeBlock, '--shadow-elevated');

    const hasExplicitShadowTokens = Boolean(shadowMd || shadowLg || shadow || shadowElevated);
    assert.ok(
      hasExplicitShadowTokens,
      `Dark theme "${themeId}" must define distinct visible shadow tokens (--shadow-md, --shadow-lg, --shadow, or --shadow-elevated)`
    );

    const testedShadow = shadowLg || shadowElevated || shadowMd || shadow;
    if (testedShadow) {
      const isVisibleInDark =
        testedShadow.includes('rgba(255') ||
        testedShadow.includes('var(--accent') ||
        testedShadow.match(/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\.[2-9]/) ||
        testedShadow.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\.[2-9]/) ||
        testedShadow.includes('0 0 0 1px');
      assert.ok(
        isVisibleInDark,
        `Dark theme "${themeId}" shadow "${testedShadow}" must be visibly discernible in dark mode`
      );
    }
  }
});

/* ============================================================
   TIER 3: STANDARDIZED BORDER RADII & DESIGN TOKENS (R2, F3)
   ============================================================ */

test('Tokens: :root defines standardized border radius tokens (--radius-xs through --radius-pill)', () => {
  const rootBlock = extractBlock(styleCss, /:root\s*\{/);
  assert.ok(rootBlock, 'css/style.css must contain a :root definition');

  const requiredRadiusTokens = [
    '--radius-xs',
    '--radius-sm',
    '--radius-md',
    '--radius-lg',
    '--radius-xl',
    '--radius-pill'
  ];

  for (const token of requiredRadiusTokens) {
    const val = getProperty(rootBlock, token);
    assert.ok(val, `:root must define ${token} border radius token`);
  }
});

/* ============================================================
   TIER 4: DYNAMIC ADAPTIVE GLASSMORPHISM (R3, AC 3)
   ============================================================ */

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

test('Glassmorphism: Core elements use color-mix or semantic tokens with backdrop-filter', () => {
  // Test #app-header
  assert.ok(
    styleCss.includes('color-mix(in srgb, var(--bg-card)') ||
    styleCss.includes('var(--bg-glass)'),
    'Stylesheet must utilize color-mix or var(--bg-glass) for adaptive glassmorphism'
  );

  // Assert [data-theme] #app-header does NOT override background with 100% opaque var(--surface)
  const themeHeaderBlock = extractBlock(styleCss, /\[data-theme\]\s*#app-header\s*\{/);
  if (themeHeaderBlock) {
    const bg = getProperty(themeHeaderBlock, 'background');
    assert.notEqual(
      bg,
      'var(--surface)',
      '[data-theme] #app-header must not be hardcoded to opaque var(--surface); must allow backdrop blur'
    );
  }

  // Check key floating menus (.finder-context-menu, .ast-attach-popup, .mobile-nav)
  const contextMenuBlock = extractBlock(styleCss, /\.finder-context-menu\s*\{/);
  if (contextMenuBlock && contextMenuBlock.includes('backdrop-filter')) {
    const bg = getProperty(contextMenuBlock, 'background');
    assert.ok(
      !bg || bg.includes('color-mix') || bg.includes('--bg-glass') || bg === 'transparent',
      `.finder-context-menu with backdrop-filter must use adaptive glassmorphism (found: ${bg})`
    );
  }

  const attachPopupBlock = extractBlock(styleCss, /\.ast-attach-popup\s*\{/);
  if (attachPopupBlock && attachPopupBlock.includes('backdrop-filter')) {
    const bg = getProperty(attachPopupBlock, 'background');
    assert.ok(
      !bg || bg.includes('color-mix') || bg.includes('--bg-glass') || bg === 'transparent',
      `.ast-attach-popup with backdrop-filter must use adaptive glassmorphism (found: ${bg})`
    );
  }
});

/* ============================================================
   TIER 5: ANIMATION CSS DEDUPLICATION & INTEGRITY (R2, F4)
   ============================================================ */

test('Animations: Keyframe animations (@keyframes astColorRave, etc.) are declared without duplicates', () => {
  const keyframes = ['astColorRave', 'astGlowEntrance', 'astGlowPulse', 'astPlainFade', 'astPopIn'];

  for (const name of keyframes) {
    const regex = new RegExp(`@keyframes\\s+${name}\\b`, 'g');
    const matches = [...styleCss.matchAll(regex)];
    assert.ok(matches.length >= 1, `@keyframes ${name} must be declared in css/style.css`);
    assert.equal(
      matches.length,
      1,
      `@keyframes ${name} is declared ${matches.length} times. Duplicate animation declarations must be deduplicated (F4).`
    );
  }
});

test('Animations: Dynamic animation utility classes are preserved and styled', () => {
  const animClasses = [
    '.ast-anim-color-rave',
    '.ast-anim-glow',
    '.ast-anim-pixel',
    '.ast-anim-plain-fade',
    '.ast-anim-pop-in',
    '.ast-anim-preview-box'
  ];

  for (const cls of animClasses) {
    assert.ok(
      styleCss.includes(cls),
      `Animation utility class ${cls} must be preserved in core stylesheet (UI Rule §24)`
    );
  }
});

/* ============================================================
   TIER 6: WCAG AA CONTRAST COMPLIANCE ACROSS 24 THEMES (R3, F7)
   ============================================================ */

test('Contrast: Exactly five curated themes are registered in THEMES registry', () => {
  assert.equal(THEMES.length, 5, `Expected exactly five curated themes, found ${THEMES.length}`);
});

test('Contrast: All curated themes meet WCAG AA contrast ratio (>= 4.5:1) between accent and contrast text', () => {
  const rootBlock = extractBlock(styleCss, /:root\s*\{/);

  for (const theme of THEMES) {
    let accent = null;
    let accentContrast = null;

    if (theme.id === 'default') {
      accent = getProperty(rootBlock, '--accent') || theme.preview.accent;
      accentContrast = getProperty(rootBlock, '--accent-contrast') || '#ffffff';
    } else {
      const themeBlock = extractBlock(styleCss, new RegExp(`\\[data-theme=["']${theme.id}["']\\]\\s*\\{`));
      assert.ok(themeBlock, `css/style.css must contain block for [data-theme="${theme.id}"]`);

      accent = getProperty(themeBlock, '--accent') || theme.preview.accent;
      accentContrast = getProperty(themeBlock, '--accent-contrast') || '#ffffff';
    }

    assert.ok(accent, `Theme "${theme.id}" must have --accent`);
    assert.ok(accentContrast, `Theme "${theme.id}" must have --accent-contrast`);

    const ratio = getContrastRatio(accent, accentContrast);

    assert.ok(
      ratio >= 4.5,
      `Theme "${theme.id}" failed WCAG AA contrast: accent (${accent}) vs text (${accentContrast}) ratio is ${ratio.toFixed(2)}:1 (must be >= 4.5:1)`
    );
  }
});

test('Contrast: Tiffany theme explicitly resolves 2.41:1 contrast defect with dark contrast text', () => {
  const tiffanyBlock = extractBlock(styleCss, /\[data-theme=["']tiffany["']\]\s*\{/);
  assert.ok(tiffanyBlock, 'css/style.css must contain [data-theme="tiffany"]');

  const accent = getProperty(tiffanyBlock, '--accent');
  const accentContrast = getProperty(tiffanyBlock, '--accent-contrast');

  assert.equal(accent, '#0abab5', 'Tiffany accent must be Robin egg cyan #0abab5');
  assert.notEqual(accentContrast, '#ffffff', 'Tiffany --accent-contrast must NOT be #ffffff (fails with 2.41:1 contrast)');

  const ratio = getContrastRatio(accent, accentContrast);
  assert.ok(ratio >= 4.5, `Tiffany contrast ratio must be >= 4.5:1 (got ${ratio.toFixed(2)}:1)`);
});

/* ============================================================
   TIER 7: MOBILE RESPONSIVE RULES & BREAKPOINTS (R1, AC 4)
   ============================================================ */

test('Mobile: Small mobile breakpoint (<=480px) hides #header-about-link to prevent flex overcrowding', () => {
  const mediaBlocks = extractAllBlocks(styleCss, /@media[^{]*max-width\s*:\s*(?:480|500)px[^{]*\{/g);
  assert.ok(mediaBlocks.length > 0, 'css/style.css must contain @media (max-width: 480px) or (max-width: 500px)');

  let found = false;
  for (const block of mediaBlocks) {
    if (block.includes('#header-about-link') || block.includes('.header-about-link')) {
      if (block.includes('display: none') || block.includes('display:none')) {
        found = true;
        break;
      }
    }
  }

  assert.ok(
    found,
    'css/style.css must include a mobile media query (<=480px) hiding #header-about-link to ensure search input is not cramped on 375px screens'
  );
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
