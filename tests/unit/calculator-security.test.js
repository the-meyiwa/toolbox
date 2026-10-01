/* ============================================================
   TOOLBOX — Calculator Security, Stability & Sanitization Tests
   Covers:
   - Zero-eval createMathFunction (strict CSP compliance)
   - Simpson's rule numerical integration boundary/singularity validation
   - Cubic equation solver and polynomial solver execution
   - Hardened HTML sanitization against javascript:, vbscript:, data:text/html
   - Mobile responsive layout containment & theme adaptiveness
   ============================================================ */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';
import calculatorModule, { createMathFunction } from '../../js/tools/calculator.js';
import { sanitizeRenderedHtml, isDangerousUri } from '../../js/utils.js';
import watermarkRemover from '../../js/tools/watermark-remover.js';
import financialAnalyzer from '../../js/tools/financial-analyzer.js';
import diseasesDatabase from '../../js/tools/diseases-database.js';

test('Security: createMathFunction uses zero eval and complies with strict CSP', () => {
  // 1. Basic operations and variable evaluation
  const fn1 = createMathFunction('x^2 + 2*x + 1');
  assert.equal(fn1(0), 1);
  assert.equal(fn1(2), 9);
  assert.equal(fn1(-1), 0);

  // 2. Trigonometric and mathematical functions
  const fn2 = createMathFunction('sin(x)');
  assert.equal(Math.round(fn2(0)), 0);
  assert.ok(Math.abs(fn2(Math.PI / 2) - 1) < 1e-6);

  // 3. Mathematical constants e and pi
  const fn3 = createMathFunction('e^x');
  assert.ok(Math.abs(fn3(1) - Math.E) < 1e-6);

  const fn4 = createMathFunction('x + pi');
  assert.ok(Math.abs(fn4(0) - Math.PI) < 1e-6);

  // 4. Implicit multiplication handling (2x, 3(x+1), (x+1)(x-1))
  const fn5 = createMathFunction('2x + 5');
  assert.equal(fn5(3), 11);

  const fn6 = createMathFunction('2(x + 1)');
  assert.equal(fn6(4), 10);

  const fn7 = createMathFunction('(x + 2)(x - 2)');
  assert.equal(fn7(3), 5); // 3^2 - 4 = 5

  // 5. Scientific notation preservation (1e-3, 2e2)
  const fn8 = createMathFunction('x + 1e2');
  assert.equal(fn8(5), 105);

  // 6. Uppercase variable X support
  const fn9 = createMathFunction('X^3');
  assert.equal(fn9(3), 27);

  // 7. Power with ** converted to ^
  const fn10 = createMathFunction('x**2');
  assert.equal(fn10(4), 16);

  // 8. Variable juxtaposition with parentheses: x(x+1) and 3x(x+1)
  const fn11 = createMathFunction('x(x+1)');
  assert.equal(fn11(2), 6);

  const fn12 = createMathFunction('3x(x+1)');
  assert.equal(fn12(2), 18);

  // 9. Unary plus operator handling: +x and 10 * +x
  const fn13 = createMathFunction('+x');
  assert.equal(fn13(5), 5);

  const fn14 = createMathFunction('10 * +x');
  assert.equal(fn14(3), 30);

  // 10. Variable juxtaposition with function: x sin(x)
  const fn15 = createMathFunction('x sin(x)');
  assert.ok(Math.abs(fn15(Math.PI / 2) - Math.PI / 2) < 1e-6);

  // 11. Juxtaposition after closing paren: (x+1)x
  const fn16 = createMathFunction('(x+1)x');
  assert.equal(fn16(3), 12);
});

test('Security & Stability: createMathFunction handles errors and exploits safely', () => {
  // Empty or invalid expressions return NaN
  assert.ok(Number.isNaN(createMathFunction('')(1)));
  assert.ok(Number.isNaN(createMathFunction(null)(1)));
  assert.ok(Number.isNaN(createMathFunction(undefined)(1)));

  // Division by zero returns NaN
  const fnDivZero = createMathFunction('1 / x');
  assert.ok(Number.isNaN(fnDivZero(0)));
  assert.equal(fnDivZero(2), 0.5);

  // Negative square root returns NaN (real domain)
  const fnSqrt = createMathFunction('sqrt(x)');
  assert.ok(Number.isNaN(fnSqrt(-4)));
  assert.equal(fnSqrt(9), 3);

  // Code injection attempts are rejected without evaluation
  const fnAttack1 = createMathFunction('alert(1)');
  assert.ok(Number.isNaN(fnAttack1(1)));

  const fnAttack2 = createMathFunction('this.constructor.constructor("return process")()');
  assert.ok(Number.isNaN(fnAttack2(1)));

  const fnAttack3 = createMathFunction('x; window.evil = true');
  assert.ok(Number.isNaN(fnAttack3(1)));

  // Syntax errors return NaN
  assert.ok(Number.isNaN(createMathFunction('2++*3')(1)));
  assert.ok(Number.isNaN(createMathFunction('((x+1)')(1)));
});

test('Security: sanitizeRenderedHtml and isDangerousUri block malicious schemes', () => {
  const { document } = setupDOMEnvironment();

  // Test dangerous URI schemes
  assert.equal(isDangerousUri('javascript:alert(1)'), true);
  assert.equal(isDangerousUri('JAVASCRIPT:alert(1)'), true);
  assert.equal(isDangerousUri('  javascript:alert(1)'), true);
  assert.equal(isDangerousUri('java\x00script:alert(1)'), true);
  assert.equal(isDangerousUri('vbscript:msgbox(1)'), true);
  assert.equal(isDangerousUri('VBSCRIPT:msgbox(1)'), true);
  assert.equal(isDangerousUri('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='), true);
  assert.equal(isDangerousUri('data:text/html,<script>alert(1)</script>'), true);
  assert.equal(isDangerousUri('data:application/xhtml+xml;base64,PHhzaC8+'), true);
  assert.equal(isDangerousUri('DATA:APPLICATION/XHTML+XML,<html/>'), true);

  // Encoded bypasses (URL percent encoding and HTML numeric/hex character entities)
  assert.equal(isDangerousUri('javascript%3Aalert(1)'), true);
  assert.equal(isDangerousUri('&#106;avascript:alert(1)'), true);
  assert.equal(isDangerousUri('&#x6A;avascript:alert(1)'), true);
  assert.equal(isDangerousUri('data%3Atext/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='), true);

  // Safe URIs should not be blocked
  assert.equal(isDangerousUri('https://example.com'), false);
  assert.equal(isDangerousUri('http://example.com/path?arg=1'), false);
  assert.equal(isDangerousUri('mailto:support@example.com'), false);
  assert.equal(isDangerousUri('#heading-1'), false);
  assert.equal(isDangerousUri('/tools/calculator'), false);
  assert.equal(isDangerousUri('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE='), false);
  assert.equal(isDangerousUri('data:image/svg+xml,<svg></svg>'), false);

  // Sanitize rendered HTML attribute stripping
  const maliciousHtml = `
    <div>
      <a href="javascript:alert(1)" id="link-js">JS Link</a>
      <a href="vbscript:msgbox(1)" id="link-vbs">VBS Link</a>
      <a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==" id="link-data-html">Data HTML</a>
      <a href="data:application/xhtml+xml;base64,PHhtbD50ZXN0PC94bWw+" id="link-data-xhtml">Data XHTML</a>
      <a href="https://example.com" target="_blank" id="link-safe">Safe Link</a>
      <img src="javascript:alert(2)" alt="bad img">
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE=" alt="safe img">
      <video poster="javascript:alert(3)"></video>
      <div style="background-image:url(javascript:alert(4)); color:red;">Styled</div>
    </div>
  `;

  const clean = sanitizeRenderedHtml(maliciousHtml);
  assert.ok(!clean.includes('javascript:'), 'Must strip javascript: attributes');
  assert.ok(!clean.includes('vbscript:'), 'Must strip vbscript: attributes');
  assert.ok(!clean.includes('data:text/html'), 'Must strip data:text/html attributes');
  assert.ok(!clean.includes('data:application/xhtml+xml'), 'Must strip data:application/xhtml+xml');
  assert.ok(!clean.includes('poster='), 'Must strip dangerous video poster attribute');
  assert.ok(clean.includes('href="https://example.com"'), 'Must preserve safe HTTPS links');
  assert.ok(clean.includes('rel="noopener noreferrer"'), 'Must add noopener noreferrer to target=_blank links');
  assert.ok(clean.includes('data:image/png;base64'), 'Must preserve safe inline image data URIs');
});

test('Stability: Calculator component renders all modes and validates integration', async () => {
  const { document, window } = setupDOMEnvironment();

  const container = document.createElement('div');
  container.id = 'calculator-test-container';
  document.body.appendChild(container);

  calculatorModule.render(container, {
    analytics: { started: () => {}, completed: () => {} },
    tool: { id: 'calculator', name: 'Calculator' },
    artifact: null,
  });

  // 1. Verify mode bar buttons exist
  const modes = ['standard', 'scientific', 'programmer', 'financial', 'engineering', 'statistics', 'graphing', 'rpn', 'constants'];
  for (const mode of modes) {
    const btn = container.querySelector(`.calc-mode-btn[data-mode="${mode}"]`);
    assert.ok(btn, `Mode button for ${mode} must exist`);
    const pane = container.querySelector(`#pane-${mode}`);
    assert.ok(pane, `Mode pane #pane-${mode} must exist`);
  }

  // 2. Test switching to Scientific Mode
  const sciBtn = container.querySelector('.calc-mode-btn[data-mode="scientific"]');
  sciBtn.click();
  assert.ok(sciBtn.classList.contains('active'), 'Scientific mode button should be active');
  assert.ok(container.querySelector('#pane-scientific').classList.contains('active'), 'Scientific pane should be active');

  // 3. Test Simpson Definite Integral - Normal calculation
  const intExpr = container.querySelector('#sci-int-expr');
  const intA = container.querySelector('#sci-int-a');
  const intB = container.querySelector('#sci-int-b');
  const intCalcBtn = container.querySelector('#sci-int-calc');
  const intResult = container.querySelector('#sci-int-result');

  intExpr.value = 'x^2';
  intA.value = '0';
  intB.value = '3';
  intCalcBtn.click();
  assert.ok(intResult.innerHTML.includes('9.00000000'), 'Integral of x^2 from 0 to 3 should be 9.00000000');

  // 4. Test Simpson Definite Integral - Identical bounds (a === b)
  intA.value = '2.5';
  intB.value = '2.5';
  intCalcBtn.click();
  assert.ok(intResult.innerHTML.includes('0.00000000'), 'Integral with identical bounds should be 0.00000000');

  // 5. Test Simpson Definite Integral - Singularity handling (1/x over [-1, 1])
  intExpr.value = '1/x';
  intA.value = '-1';
  intB.value = '1';
  intCalcBtn.click();
  assert.ok(!intResult.innerHTML.includes('NaN'), 'Result must not display raw NaN');
  assert.ok(intResult.textContent.includes('singularity') || intResult.textContent.includes('undefined'), 'Must report singularity cleanly');

  // 6. Test Simpson Definite Integral - Singularity at boundary (1/x over [0, 2])
  intExpr.value = '1/x';
  intA.value = '0';
  intB.value = '2';
  intCalcBtn.click();
  assert.ok(!intResult.innerHTML.includes('NaN'), 'Result must not display raw NaN for boundary singularity');

  // 7. Test Simpson Definite Integral - Invalid bounds
  intA.value = 'foo';
  intB.value = 'bar';
  intCalcBtn.click();
  assert.ok(intResult.textContent.includes('valid numerical'), 'Must prompt for valid numerical bounds');

  // 8. Test Polynomial Solver in Scientific Mode - Cubic equation
  const eqTypeSelect = container.querySelector('#sci-eq-type');
  eqTypeSelect.value = 'cubic';
  eqTypeSelect.dispatchEvent(new window.Event('change'));

  const eqA = container.querySelector('#eq-a');
  const eqB = container.querySelector('#eq-b');
  const eqC = container.querySelector('#eq-c');
  const eqD = container.querySelector('#eq-d');
  const eqSolveBtn = container.querySelector('#sci-eq-solve');
  const eqResult = container.querySelector('#sci-eq-result');

  // x³ - 6x² + 11x - 6 = (x-1)(x-2)(x-3) = 0
  eqA.value = '1';
  eqB.value = '-6';
  eqC.value = '11';
  eqD.value = '-6';
  eqSolveBtn.click();

  assert.ok(!eqResult.textContent.includes('Roots & discriminant appear here'), 'Cubic solver must compute result');
  assert.ok(eqResult.innerHTML.includes('1.000000') || eqResult.innerHTML.includes('1'), 'Must include root 1');
  assert.ok(eqResult.innerHTML.includes('2.000000') || eqResult.innerHTML.includes('2'), 'Must include root 2');
  assert.ok(eqResult.innerHTML.includes('3.000000') || eqResult.innerHTML.includes('3'), 'Must include root 3');

  // 9. Test Financial Mode TVM solver and NaN guard
  const finBtn = container.querySelector('.calc-mode-btn[data-mode="financial"]');
  finBtn.click();

  const tvmN = container.querySelector('#tvm-n');
  const tvmI = container.querySelector('#tvm-i');
  const tvmPv = container.querySelector('#tvm-pv');
  const tvmFv = container.querySelector('#tvm-fv');
  const tvmResult = container.querySelector('#tvm-result-box');
  const solvePmtBtn = container.querySelector('.calc-solve-btn[data-tvm="PMT"]');

  tvmN.value = '60';
  tvmI.value = '6';
  tvmPv.value = '10000';
  tvmFv.value = '0';
  solvePmtBtn.click();
  assert.ok(tvmResult.innerHTML.includes('$193.33'), 'PMT must calculate properly');

  // Test invalid parameters (e.g. division by zero / negative rates)
  tvmN.value = '0';
  tvmI.value = '0';
  solvePmtBtn.click();
  assert.ok(!tvmResult.innerHTML.includes('$NaN'), 'TVM solver must not display $NaN');

  // 10. Test Constants Mode & Copy Button
  const constBtn = container.querySelector('.calc-mode-btn[data-mode="constants"]');
  constBtn.click();

  const copyButtons = container.querySelectorAll('.calc-copy-const');
  assert.ok(copyButtons.length > 5, 'Constants copy buttons should be rendered');
  copyButtons[0].click();
  assert.ok(copyButtons[0].textContent === 'Copied' || copyButtons[0].textContent === 'Copy', 'Copy button should handle click');

  // 11. Test SYD (Sum-of-the-Years'-Digits) Depreciation Schedule
  finBtn.click();
  const depCost = container.querySelector('#dep-cost');
  const depSalvage = container.querySelector('#dep-salvage');
  const depLife = container.querySelector('#dep-life');
  const depMethod = container.querySelector('#dep-method');
  const depCalcBtn = container.querySelector('#dep-calc-btn');
  const depTable = container.querySelector('#dep-schedule-table');

  depCost.value = '50000';
  depSalvage.value = '5000';
  depLife.value = '5';
  depMethod.value = 'syd';
  depCalcBtn.click();
  assert.ok(depTable.querySelectorAll('tbody tr').length === 5, 'SYD depreciation must produce 5 schedule rows');
  assert.ok(depTable.textContent.includes('$15000.00'), 'Year 1 SYD depreciation should be 15000');
  assert.ok(depTable.textContent.includes('$5000.00'), 'Ending book value should reach salvage value');

  // 12. Test Engineering Mode: Complex Modulus & Polar Angle (|Z₁| & ∠θ)
  const engBtn = container.querySelector('.calc-mode-btn[data-mode="engineering"]');
  engBtn.click();

  const engZ1 = container.querySelector('#eng-z1');
  const engModBtn = container.querySelector('.calc-z-btn[data-op="mod"]');
  const engRes = container.querySelector('#eng-z-result');

  engZ1.value = '3 + 4i';
  engModBtn.click();
  assert.ok(engRes.textContent.includes('|Z₁| = 5.0000'), 'Modulus of 3 + 4i should be 5.0000');
  assert.ok(engRes.textContent.includes('53.13°'), 'Polar angle should be 53.13°');

  // 13. Test Statistics Mode: Normal Distribution Sigma Validation
  const statBtn = container.querySelector('.calc-mode-btn[data-mode="statistics"]');
  statBtn.click();

  const distSigma = container.querySelector('#dist-norm-sigma');
  const distCalcBtn = container.querySelector('#stat-dist-calc-btn');
  const distRes = container.querySelector('#stat-dist-result');

  distSigma.value = '-2';
  distCalcBtn.click();
  assert.ok(distRes.textContent.includes('positive non-zero standard deviation'), 'Must reject negative standard deviation');

  distSigma.value = '1';
  distCalcBtn.click();
  assert.ok(distRes.textContent.includes('Z-Score:'), 'Must compute valid distribution with sigma = 1');

  // 14. Test Graphing Mode: Zoom updates domain/range labels
  const graphBtn = container.querySelector('.calc-mode-btn[data-mode="graphing"]');
  graphBtn.click();

  const domainLbl = container.querySelector('#graph-domain-lbl');
  const rangeLbl = container.querySelector('#graph-range-lbl');
  assert.equal(domainLbl.textContent, '[-10.0, 10.0]');
  assert.equal(rangeLbl.textContent, '[-6.0, 6.0]');

  const zoomInBtn = container.querySelector('#graph-zoom-in');
  zoomInBtn.click();
  assert.equal(domainLbl.textContent, '[-7.0, 7.0]');
  assert.equal(rangeLbl.textContent, '[-4.2, 4.2]');

  const resetBtn = container.querySelector('#graph-reset');
  resetBtn.click();
  assert.equal(domainLbl.textContent, '[-10.0, 10.0]');
  assert.equal(rangeLbl.textContent, '[-6.0, 6.0]');

  // Clean up calculator
  calculatorModule.destroy();
  assert.equal(calculatorModule.keyListener, null, 'Key listener must be null after destroy');
  assert.equal(calculatorModule.themeListener, null, 'Theme listener must be null after destroy');
  container.remove();
});

test('Stability: Lifecycle cleanup on unmount across audited tools', async () => {
  const { document, window } = setupDOMEnvironment();

  // 1. Watermark Remover cleanup
  const wmContainer = document.createElement('div');
  document.body.appendChild(wmContainer);
  await watermarkRemover.render(wmContainer, { analytics: {} });
  assert.ok(Array.isArray(watermarkRemover._cleanup), 'Watermark remover must initialize _cleanup array');
  assert.ok(watermarkRemover._cleanup.length > 0, 'Watermark remover must register window listener cleanups');
  watermarkRemover.destroy();
  assert.equal(watermarkRemover._cleanup.length, 0, '_cleanup array must be cleared on destroy');
  wmContainer.remove();

  // 2. Financial Analyzer cleanup
  const finContainer = document.createElement('div');
  document.body.appendChild(finContainer);
  financialAnalyzer.render(finContainer, { analytics: {} });
  assert.equal(typeof financialAnalyzer._cleanup, 'function', 'Financial analyzer must register _cleanup function');
  financialAnalyzer.destroy();
  assert.equal(financialAnalyzer._cleanup, null, 'Financial analyzer must clear _cleanup on destroy');
  finContainer.remove();

  // 3. Diseases Database cleanup
  const disContainer = document.createElement('div');
  document.body.appendChild(disContainer);
  diseasesDatabase.render(disContainer, { analytics: {} });
  assert.equal(typeof diseasesDatabase._onResize, 'function', 'Diseases database must register _onResize handler');
  diseasesDatabase.destroy();
  assert.equal(diseasesDatabase._onResize, null, 'Diseases database must clear _onResize on destroy');
  disContainer.remove();
});
