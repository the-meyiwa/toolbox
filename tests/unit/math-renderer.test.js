import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMath, renderMathInText, latexToMathML } from '../../js/lib/math-renderer.js';
import { searchMathKnowledge } from '../../js/lib/math-knowledge.js';

test('Math Renderer: fractions render to MathML mfrac elements', () => {
  const result = renderMath('\\frac{a}{b}');
  assert.ok(result.includes('<mfrac>'), 'Must contain <mfrac>');
  assert.ok(result.includes('<mi>a</mi>'), 'Must contain numerator identifier');
  assert.ok(result.includes('<mi>b</mi>'), 'Must contain denominator identifier');
  assert.ok(!result.includes('\\frac'), 'Must not contain raw \\frac');
});

test('Math Renderer: square roots and nth roots render to msqrt and mroot', () => {
  const sqrtRes = renderMath('\\sqrt{b^2 - 4ac}');
  assert.ok(sqrtRes.includes('<msqrt>'), 'Must contain <msqrt>');
  assert.ok(!sqrtRes.includes('\\sqrt'), 'Must not contain raw \\sqrt');

  const rootRes = renderMath('\\sqrt[n]{x}');
  assert.ok(rootRes.includes('<mroot>'), 'Must contain <mroot>');
  assert.ok(rootRes.includes('<mi>x</mi>'), 'Must contain radicand');
});

test('Math Renderer: superscripts and subscripts render to msup and msub', () => {
  const supRes = renderMath('x^2');
  assert.ok(supRes.includes('<msup>'), 'Must contain <msup>');
  assert.ok(supRes.includes('<mn>2</mn>'), 'Must contain exponent 2');

  const subRes = renderMath('x_{0}');
  assert.ok(subRes.includes('<msub>'), 'Must contain <msub>');

  const dualRes = renderMath('x_0^2');
  assert.ok(dualRes.includes('<msubsup>'), 'Must contain <msubsup> for dual sub/superscripts');
});

test('Math Renderer: Greek letters and math operators resolve to unicode characters', () => {
  const greek = renderMath('\\alpha + \\beta = \\gamma + \\pi + \\theta + \\lambda');
  assert.ok(greek.includes('α'), 'Must contain alpha');
  assert.ok(greek.includes('β'), 'Must contain beta');
  assert.ok(greek.includes('γ'), 'Must contain gamma');
  assert.ok(greek.includes('π'), 'Must contain pi');
  assert.ok(greek.includes('θ'), 'Must contain theta');
  assert.ok(greek.includes('λ'), 'Must contain lambda');
  assert.ok(!greek.includes('\\alpha'), 'Must not contain raw \\alpha');

  const ops = renderMath('a \\pm b \\le c \\ge d \\neq e \\approx f \\equiv g \\implies h');
  assert.ok(ops.includes('±'), 'Must contain ±');
  assert.ok(ops.includes('≤'), 'Must contain ≤');
  assert.ok(ops.includes('≥'), 'Must contain ≥');
  assert.ok(ops.includes('≠'), 'Must contain ≠');
  assert.ok(ops.includes('≈'), 'Must contain ≈');
  assert.ok(ops.includes('≡'), 'Must contain ≡');
  assert.ok(ops.includes('⟹'), 'Must contain ⟹');
});

test('Math Renderer: big operators (sum, integral, product) and delimiters', () => {
  const sumRes = renderMath('\\sum_{i=1}^n i');
  assert.ok(sumRes.includes('∑'), 'Must contain summation symbol');
  assert.ok(sumRes.includes('<munderover>'), 'Must contain munderover for limits');

  const intRes = renderMath('\\int_a^b f(x) dx');
  assert.ok(intRes.includes('∫'), 'Must contain integral symbol');

  const fences = renderMath('\\left( \\frac{1}{2} \\right)');
  assert.ok(fences.includes('fence="true"'), 'Must include fences');
});

test('Math Renderer: matrix environments render to mtable', () => {
  const mat = renderMath('\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}');
  assert.ok(mat.includes('<mtable'), 'Must contain mtable');
  assert.ok(mat.includes('<mtr>'), 'Must contain mtr');
  assert.ok(mat.includes('<mtd>'), 'Must contain mtd');
  assert.ok(!mat.includes('\\begin'), 'Must not contain raw \\begin');
});

test('Math Renderer: modular arithmetic notation pmod', () => {
  const modRes = renderMath('a \\equiv b \\pmod{m}');
  assert.ok(modRes.includes('≡'), 'Must contain ≡');
  assert.ok(modRes.includes('mod'), 'Must contain mod');
  assert.ok(!modRes.includes('\\pmod'), 'Must not contain raw \\pmod');
});

test('Math Renderer: renderMathInText cleans embedded LaTeX in prose', () => {
  const rawText = 'For coprime integers: a^{\\phi(n)} \\equiv 1 \\pmod n where \\gcd(a, n) = 1 and error \\le 0.05.';
  const cleaned = renderMathInText(rawText);
  assert.ok(!cleaned.includes('\\equiv'), 'Must not leak \\equiv');
  assert.ok(!cleaned.includes('\\pmod'), 'Must not leak \\pmod');
  assert.ok(!cleaned.includes('\\le'), 'Must not leak \\le');
  assert.ok(cleaned.includes('≡'), 'Must contain ≡');
  assert.ok(cleaned.includes('(mod n)'), 'Must contain (mod n)');
  assert.ok(cleaned.includes('≤'), 'Must contain ≤');
});

test('Math Renderer: complete audit of all 78 knowledge entries has zero raw LaTeX leakage', () => {
  const entries = searchMathKnowledge('', { limit: 200 });
  assert.ok(entries.length >= 78, 'Expected at least 78 entries');

  let leakCount = 0;
  for (const entry of entries) {
    if (entry.formula) {
      const rendered = renderMath(entry.formula);
      // Check for common unescaped LaTeX commands
      if (
        rendered.includes('\\frac') ||
        rendered.includes('\\equiv') ||
        rendered.includes('\\sqrt') ||
        rendered.includes('\\text{') ||
        rendered.includes('\\sum') ||
        rendered.includes('\\int') ||
        rendered.includes('\\prod')
      ) {
        leakCount++;
      }
    }
  }

  assert.equal(leakCount, 0, 'No raw LaTeX commands must leak across any knowledge entry');
});
