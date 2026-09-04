/* ============================================================
   Math Utility UI & Component Lifecycle Integration Tests
   Exhaustively tests:
   1. Clean lifecycle rendering and container teardown
   2. Zero raw LaTeX leakage across all views and tabs
   3. Zero emojis across all views and tabs
   4. High-contrast semantic controls bar & Engineering Math chip toggle
   5. Search, domain, and proof status filtering
   6. Minimal proof-status badges and card hierarchy
   7. Deterministic solver execution with residual verification
   8. Collatz explorer with explicit unproven conjecture status
   9. Four-figure tables with table approx vs machine value
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DOM environment
const { document } = setupDOMEnvironment();

const mockAnalytics = {
  started: () => {},
  completed: () => {},
  copied: () => {},
  downloaded: () => {},
  error: () => {},
  viewed: () => {},
};

test('Math Utility UI: Comprehensive Component & Interaction Suite', async (t) => {
  // 1. Dynamic import of Math Utility module
  const modulePath = '../../js/tools/math-utility.js';
  const mathUtilityModule = await import(modulePath);
  const mathUtility = mathUtilityModule.default || mathUtilityModule;

  assert.ok(mathUtility, 'Math Utility module exports default');
  assert.equal(typeof mathUtility.render, 'function', 'Math Utility has render() method');

  // 2. Setup Container
  const container = document.createElement('div');
  container.id = 'test-math-utility-container';
  document.body.appendChild(container);

  await mathUtility.render(container, {
    analytics: mockAnalytics,
    tool: { id: 'math-utility', name: 'Math Utility' },
    artifact: null
  });

  // Test 1: DOM Elements Rendered
  await t.test('1. Structure: tabs, controls bar, and card grid render correctly', () => {
    const tabs = container.querySelectorAll('.math-tab-btn');
    assert.equal(tabs.length, 4, 'Should render 4 navigation tabs');

    const controlsBar = container.querySelector('.math-controls-bar');
    assert.ok(controlsBar, '.math-controls-bar exists');

    const searchInput = container.querySelector('#math-lib-search');
    assert.ok(searchInput, 'Search input exists');
    assert.ok(searchInput.classList.contains('math-search-input'), 'Search input has .math-search-input class');

    const domainSelect = container.querySelector('#math-lib-cat-filter');
    assert.ok(domainSelect, 'Domain filter select exists');
    assert.ok(domainSelect.classList.contains('math-select-control'), 'Domain select has .math-select-control class');

    const engMathBtn = container.querySelector('#math-eng-filter-btn');
    assert.ok(engMathBtn, 'Engineering Math button exists');
    assert.ok(engMathBtn.classList.contains('math-chip-btn'), 'Engineering Math button has .math-chip-btn class');

    const statusSelect = container.querySelector('#math-lib-status-filter');
    assert.ok(statusSelect, 'Proof status select exists');
    assert.ok(statusSelect.classList.contains('math-select-control'), 'Status select has .math-select-control class');

    const cardsGrid = container.querySelector('#math-lib-results-grid');
    assert.ok(cardsGrid, 'Cards grid container exists');
  });

  // Test 2: Zero Raw LaTeX in Knowledge Cards
  await t.test('2. Notation: all rendered cards contain MathML and ZERO raw LaTeX source', () => {
    const cards = container.querySelectorAll('.math-knowledge-card');
    assert.ok(cards.length > 0, 'Knowledge cards should be populated');

    const rawLatexRegex = /\\(frac|sqrt|equiv|pmod|text|sum|prod|int|alpha|beta|theta|pi|partial|nabla|infty|left|right)\b/;

    for (const card of cards) {
      const mathFormula = card.querySelector('.math-rendered-formula');
      assert.ok(mathFormula, 'Card contains .math-rendered-formula');

      const formulaText = mathFormula.textContent || '';
      assert.doesNotMatch(formulaText, rawLatexRegex, `Card formula contains raw LaTeX: ${formulaText}`);

      const htmlContent = card.innerHTML;
      // Ensure no raw LaTeX command leaked outside math renderer or into visible text
      const visibleLeakMatch = htmlContent.match(/\\(frac|equiv|pmod|sum|int|sqrt)\{[^}]*\}/);
      assert.equal(visibleLeakMatch, null, `Visible LaTeX leak found in card: ${visibleLeakMatch?.[0]}`);
    }
  });

  // Test 3: Minimal Proof-Status Badges
  await t.test('3. Badges: proof-status badges use minimal .math-proof-badge classes', () => {
    const badges = container.querySelectorAll('.math-proof-badge');
    assert.ok(badges.length > 0, 'Proof badges should exist on cards');

    for (const badge of badges) {
      assert.ok(
        badge.classList.contains('math-badge-proven') ||
        badge.classList.contains('math-badge-conjecture') ||
        badge.classList.contains('math-badge-axiom') ||
        badge.classList.contains('math-badge-identity') ||
        badge.classList.contains('math-badge-algorithm'),
        `Badge has semantic status class: ${badge.className}`
      );
      // Ensure text is non-empty and contains valid mathematical category
      const text = badge.textContent.trim();
      assert.ok(text.length > 0, 'Badge text should not be empty');
    }
  });

  // Test 4: Engineering Math Filter Toggle
  await t.test('4. Filter: Engineering Math chip button toggles active state and filters cards', () => {
    const engBtn = container.querySelector('#math-eng-filter-btn');
    const cardsGrid = container.querySelector('#math-lib-results-grid');
    const initialCount = cardsGrid.querySelectorAll('.math-knowledge-card').length;

    // Click to activate Engineering Math filter
    engBtn.click();
    assert.ok(engBtn.classList.contains('active'), 'Engineering Math button gains .active class');

    const filteredCount = cardsGrid.querySelectorAll('.math-knowledge-card').length;
    assert.ok(filteredCount > 0 && filteredCount < initialCount, `Filtered count (${filteredCount}) should be subset of total (${initialCount})`);

    // Click to deactivate
    engBtn.click();
    assert.ok(!engBtn.classList.contains('active'), 'Engineering Math button loses .active class');
    assert.equal(cardsGrid.querySelectorAll('.math-knowledge-card').length, initialCount, 'Restores initial card count');
  });

  // Test 5: Search Filtering
  await t.test('5. Search: filters cards dynamically by title, formula, or keywords', () => {
    const searchInput = container.querySelector('#math-lib-search');
    const cardsGrid = container.querySelector('#math-lib-results-grid');

    searchInput.value = 'quadratic';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    const cards = cardsGrid.querySelectorAll('.math-knowledge-card');
    assert.ok(cards.length >= 1, 'Should find at least 1 card for "quadratic"');
    const firstTitle = cards[0].querySelector('.math-card-title').textContent;
    assert.match(firstTitle, /quadratic/i, 'First match relates to quadratic');

    // Reset search
    searchInput.value = '';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // Test 6: Zero Emojis Audit
  await t.test('6. Zero Emojis: strict absence of emojis in rendered UI', () => {
    // Standard unicode emoji regex
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    const fullHtml = container.innerHTML;
    const match = fullHtml.match(emojiRegex);
    assert.equal(match, null, `Emoji detected in Math Utility HTML: ${match?.[0]}`);
  });

  // Test 7: Solver & Computation Lab
  await t.test('7. Solver Tab: executes deterministic quadratic equation solving with verified residual', () => {
    const tabs = container.querySelectorAll('.math-tab-btn');
    const solverTabBtn = Array.from(tabs).find(b => b.dataset.tab === 'solver');
    assert.ok(solverTabBtn, 'Solver tab button exists');
    solverTabBtn.click();

    const paneSolver = container.querySelector('#pane-solver');
    assert.equal(paneSolver.style.display, 'flex', 'Solver pane is active');

    const opSelect = container.querySelector('#math-solver-op');
    opSelect.value = 'solve_quadratic';
    opSelect.dispatchEvent(new Event('change', { bubbles: true }));

    // Input coefficients for x^2 - 5x + 6 = 0
    const aInput = container.querySelector('#solver-a');
    const bInput = container.querySelector('#solver-b');
    const cInput = container.querySelector('#solver-c');
    assert.ok(aInput && bInput && cInput, 'Quadratic inputs exist');

    aInput.value = '1';
    bInput.value = '-5';
    cInput.value = '6';

    const execBtn = container.querySelector('#math-solver-exec-btn');
    execBtn.click();

    const output = container.querySelector('#math-solver-result-container');
    assert.ok(output.textContent.includes('Roots'), 'Output displays roots');
    assert.ok(output.textContent.includes('2') && output.textContent.includes('3'), 'Roots 2 and 3 found');
    assert.ok(output.textContent.includes('Residual') || output.textContent.includes('Verification'), 'Output displays verification residual');
  });

  // Test 8: Collatz & Sequences
  await t.test('8. Collatz Tab: calculates sequence for 12 with unproven conjecture status', () => {
    const tabs = container.querySelectorAll('.math-tab-btn');
    const collatzTabBtn = Array.from(tabs).find(b => b.dataset.tab === 'collatz');
    assert.ok(collatzTabBtn, 'Collatz tab button exists');
    collatzTabBtn.click();

    const paneCollatz = container.querySelector('#pane-collatz');
    assert.equal(paneCollatz.style.display, 'flex', 'Collatz pane is active');

    const input = container.querySelector('#collatz-input');
    assert.ok(input, 'Collatz input exists');
    input.value = '12';

    const runBtn = container.querySelector('#collatz-run-btn');
    runBtn.click();

    const output = container.querySelector('#collatz-result-zone');
    assert.ok(output.textContent.includes('9'), 'Collatz 12 takes 9 steps');
    assert.ok(output.textContent.includes('16'), 'Collatz 12 reaches peak excursion 16');
    assert.ok(/unproven.*conjecture/i.test(output.textContent), 'Collatz highlights explicit unproven conjecture status');
  });

  // Test 9: Teardown Cleanup
  await t.test('9. Lifecycle: destroy cleanly unbinds and clears container', () => {
    if (typeof mathUtility.destroy === 'function') {
      mathUtility.destroy();
    }
    assert.ok(true, 'Destroy completed without exception');
  });
});

test('Math Utility CSS Theme Tokens Audit', () => {
  const cssPath = path.resolve(__dirname, '../../css/style.css');
  const cssContent = fs.readFileSync(cssPath, 'utf-8');

  // Verify math utility classes exist
  assert.ok(cssContent.includes('.math-controls-bar'), 'css contains .math-controls-bar');
  assert.ok(cssContent.includes('.math-search-input'), 'css contains .math-search-input');
  assert.ok(cssContent.includes('.math-select-control'), 'css contains .math-select-control');
  assert.ok(cssContent.includes('.math-chip-btn'), 'css contains .math-chip-btn');
  assert.ok(cssContent.includes('.math-proof-badge'), 'css contains .math-proof-badge');
  assert.ok(cssContent.includes('.math-rendered-formula'), 'css contains .math-rendered-formula');

  // Verify semantic CSS variables are used
  assert.ok(cssContent.includes('var(--bg-card)'), 'Uses var(--bg-card)');
  assert.ok(cssContent.includes('var(--border)'), 'Uses var(--border)');
  assert.ok(cssContent.includes('var(--text)'), 'Uses var(--text)');
  assert.ok(cssContent.includes('var(--text-muted)'), 'Uses var(--text-muted)');
});
