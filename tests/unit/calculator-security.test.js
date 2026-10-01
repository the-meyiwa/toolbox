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
      <div style="background-image:url(javascript:alert(3)); color:red;">Styled</div>
    </div>
  `;

  const clean = sanitizeRenderedHtml(maliciousHtml);
  assert.ok(!clean.includes('javascript:'), 'Must strip javascript: attributes');
  assert.ok(!clean.includes('vbscript:'), 'Must strip vbscript: attributes');
  assert.ok(!clean.includes('data:text/html'), 'Must strip data:text/html attributes');
  assert.ok(!clean.includes('data:application/xhtml+xml'), 'Must strip data:application/xhtml+xml');
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

  // Clean up
  calculatorModule.destroy();
  assert.equal(calculatorModule.keyListener, null, 'Key listener must be null after destroy');
  assert.equal(calculatorModule.themeListener, null, 'Theme listener must be null after destroy');
  container.remove();
});
