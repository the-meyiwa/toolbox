/* ============================================================
   TOOLBOX — Math Utility & Deterministic Math Engine Unit Tests
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateExpression,
  solveQuadratic,
  solveCubic,
  solvePolynomial,
  solveLinear,
  solveEquation,
  calculateDerivative,
  calculateIntegral,
  calculateMatrixDeterminant,
  calculateMatrixInverse,
  calculateGcd,
  calculateLcm,
  calculateTotient,
  isPrime,
  primeFactors,
  generateFibonacci,
  calculateCollatz,
  calculatePermutations,
  calculateCombinations,
  calculateStatistics,
  calculateNewtonRaphson,
  solveOdeInitialValue,
  calculateComplex,
  calculateEigenvalues2x2,
  solveLinearSystem,
  calculateModularArithmetic,
  calculateLinearRegression,
  calculateMath
} from '../../js/lib/math-engine.js';

import {
  MATH_CATEGORIES,
  PROOF_STATUS,
  MATHEMATICAL_CONSTANTS,
  searchMathKnowledge,
  getMathematicalConstant,
  lookupFourFigureTable
} from '../../js/lib/math-knowledge.js';

import { executeAssistantTool } from '../../js/lib/assistant-tools.js';

/* ------------------------------------------------------------
   1. ARITHMETIC & EVALUATOR
   ------------------------------------------------------------ */
test('Math Engine: basic arithmetic (2 + 2 = 4) and precedence', () => {
  assert.equal(evaluateExpression('2 + 2'), 4);
  assert.equal(evaluateExpression('1837 * 492'), 903804);
  assert.equal(evaluateExpression('3 + 5 * 2'), 13);
  assert.equal(evaluateExpression('(3 + 5) * 2'), 16);
  assert.equal(evaluateExpression('2^3 + 4'), 12);
  assert.equal(evaluateExpression('sqrt(144) + 8'), 20);
  assert.equal(evaluateExpression('fact(5)'), 120);
});

test('Math Engine: division by zero throws an honest error', () => {
  assert.throws(() => {
    evaluateExpression('10 / 0');
  }, /Division by zero/);
});

/* ------------------------------------------------------------
   2. ALGEBRA & EQUATIONS (WITH RESIDUAL SUBSTITUTION CHECK)
   ------------------------------------------------------------ */
test('Math Engine: quadratic equation x^2 - 5x + 6 = 0 has roots 2 and 3 with verified residual ≤ 1e-5', () => {
  const res = solveQuadratic(1, -5, 6);
  assert.equal(res.operation, 'solve_quadratic');
  assert.equal(res.discriminant, 1);
  assert.equal(res.verified, true);
  assert.ok(res.roots.includes(2) && res.roots.includes(3));
  // Residual check
  assert.ok(res.residuals.every(r => r <= 1e-5));
});

test('Math Engine: linear equation 2x - 8 = 0 solves to x = 4 with verified residual', () => {
  const res = solveLinear(2, -8);
  assert.equal(res.root, 4);
  assert.equal(res.verified, true);
  assert.equal(res.residual, 0);
});

test('Math Engine: equation string parser parses and solves equations', () => {
  const res1 = solveEquation('x^2 - 5x + 6 = 0');
  assert.equal(res1.verified, true);
  assert.ok(res1.roots.includes(2) && res1.roots.includes(3));

  const res2 = solveEquation('3x + 9 = 0');
  assert.equal(res2.root, -3);
  assert.equal(res2.verified, true);
});

test('Math Engine: repeated and complex roots handling', () => {
  // Repeated root: x^2 - 4x + 4 = 0 -> root 2
  const repeated = solveQuadratic(1, -4, 4);
  assert.equal(repeated.discriminant, 0);
  assert.deepEqual(repeated.roots, [2]);
  assert.equal(repeated.verified, true);

  // Complex roots: x^2 + 1 = 0 -> roots ±1i
  const complex = solveQuadratic(1, 0, 1);
  assert.equal(complex.discriminant, -4);
  assert.equal(complex.roots.length, 2);
  assert.ok(complex.roots[0].includes('i'));
  assert.equal(complex.verified, true);
});

test('Math Engine: cubic equation x^3 - 6x^2 + 11x - 6 = 0 solves to roots 1, 2, 3 with verified residuals', () => {
  const direct = solveCubic(1, -6, 11, -6);
  assert.equal(direct.operation, 'solve_cubic');
  assert.deepEqual(direct.roots, [1, 2, 3]);
  assert.equal(direct.verified, true);
  assert.ok(direct.residuals.every(r => r <= 1e-4));

  const parsed = solveEquation('x^3 - 6x^2 + 11x - 6 = 0');
  assert.equal(parsed.operation, 'solve_cubic');
  assert.deepEqual(parsed.roots, [1, 2, 3]);
  assert.equal(parsed.verified, true);

  // Rearranged sides
  const rearranged = solveEquation('11x - 6 = 6x^2 - x^3');
  assert.deepEqual(rearranged.roots, [1, 2, 3]);
  assert.equal(rearranged.verified, true);

  // Unicode superscripts
  const unicode = solveEquation('x³ - 6x² + 11x - 6 = 0');
  assert.deepEqual(unicode.roots, [1, 2, 3]);
  assert.equal(unicode.verified, true);

  // Repeated root: x^3 - 3x^2 + 3x - 1 = 0 -> root 1
  const repeated = solveEquation('x^3 - 3x^2 + 3x - 1 = 0');
  assert.deepEqual(repeated.roots, [1]);
  assert.equal(repeated.verified, true);

  // Complex roots: x^3 - 1 = 0 -> 1 real root and 2 complex conjugate roots
  const complexCubic = solveEquation('x^3 - 1 = 0');
  assert.equal(complexCubic.roots[0], 1);
  assert.ok(complexCubic.roots[1].includes('i'));
  assert.equal(complexCubic.verified, true);
});

test('Math Engine: quartic equation x^4 - 5x^2 + 4 = 0 solves via Durand-Kerner polynomial solver', () => {
  const quartic = solveEquation('x^4 - 5x^2 + 4 = 0');
  assert.equal(quartic.operation, 'solve_polynomial');
  assert.equal(quartic.degree, 4);
  assert.deepEqual(quartic.roots, [-2, -1, 1, 2]);
  assert.equal(quartic.verified, true);
});

/* ------------------------------------------------------------
   3. TRIGONOMETRY & IDENTITIES
   ------------------------------------------------------------ */
test('Math Engine: trigonometric evaluation and Pythagorean identity', () => {
  // sin(30 deg) = 0.5
  const sin30 = evaluateExpression('sind(30)');
  assert.ok(Math.abs(sin30 - 0.5) < 1e-7);

  // cos(60 deg) = 0.5
  const cos60 = evaluateExpression('cosd(60)');
  assert.ok(Math.abs(cos60 - 0.5) < 1e-7);

  // Pythagorean identity: sin^2(x) + cos^2(x) = 1
  for (const angle of [0, 0.5, 1.2, Math.PI / 4, 2.5]) {
    const sinVal = Math.sin(angle);
    const cosVal = Math.cos(angle);
    assert.ok(Math.abs(sinVal * sinVal + cosVal * cosVal - 1) < 1e-12);
  }
});

/* ------------------------------------------------------------
   4. CALCULUS (DERIVATIVES & INTEGRALS)
   ------------------------------------------------------------ */
test('Math Engine: symbolic and numerical derivatives', () => {
  // d/dx(x^3) = 3x^2
  const derivPoly = calculateDerivative('x^3');
  assert.equal(derivPoly.result, '3x^2');

  // d/dx(x^2 + 3x) at x = 2: 2(2) + 3 = 7
  const derivAt = calculateDerivative('x^2 + 3*x', 'x', 2);
  assert.equal(derivAt.result, 7);
});

test('Math Engine: definite and indefinite integrals', () => {
  // Indefinite: ∫ 2x dx = x^2 + C
  const indDef = calculateIntegral('2x');
  assert.ok(indDef.result.includes('x^2') && indDef.result.includes('+ C'));

  // Definite: ∫[0 to 2] 2x dx = 2^2 - 0 = 4
  const defInt = calculateIntegral('2*x', { from: 0, to: 2 });
  assert.ok(Math.abs(defInt.result - 4) < 1e-4);
});

/* ------------------------------------------------------------
   5. LINEAR ALGEBRA (MATRICES: DETERMINANT & INVERSE)
   ------------------------------------------------------------ */
test('Math Engine: matrix determinant (2x2 and 3x3)', () => {
  // 2x2: [[1, 2], [3, 4]] -> 1*4 - 2*3 = -2
  const d2 = calculateMatrixDeterminant([[1, 2], [3, 4]]);
  assert.equal(d2.determinant, -2);

  // 3x3: [[6, 1, 1], [4, -2, 5], [2, 8, 7]] -> -306
  const d3 = calculateMatrixDeterminant([
    [6, 1, 1],
    [4, -2, 5],
    [2, 8, 7]
  ]);
  assert.equal(d3.determinant, -306);
});

test('Math Engine: matrix inverse with A * A^-1 = I verification', () => {
  const A = [[4, 7], [2, 6]];
  const invRes = calculateMatrixInverse(A);
  assert.equal(invRes.operation, 'matrix_inverse');
  assert.equal(invRes.verified, true);
  assert.ok(invRes.residual < 1e-5);
  // Expected inverse of [[4, 7], [2, 6]]: det = 10, inverse = [[0.6, -0.7], [-0.2, 0.4]]
  assert.deepEqual(invRes.inverse, [[0.6, -0.7], [-0.2, 0.4]]);
});

test('Math Engine: singular matrix inversion throws error', () => {
  assert.throws(() => {
    calculateMatrixInverse([[1, 2], [2, 4]]);
  }, /singular/);
});

/* ------------------------------------------------------------
   6. NUMBER THEORY & GCD BÉZOUT IDENTITY
   ------------------------------------------------------------ */
test('Math Engine: GCD with extended Euclidean Bézout verification and LCM', () => {
  // GCD(48, 18) = 6
  const gcdRes = calculateGcd(48, 18);
  assert.equal(gcdRes.gcd, 6);
  assert.equal(gcdRes.verified, true);
  // Bézout identity: 48*x + 18*y = 6
  assert.equal(48 * gcdRes.bezoutCoefficients.x + 18 * gcdRes.bezoutCoefficients.y, 6);

  // LCM(48, 18) = 144
  const lcmRes = calculateLcm(48, 18);
  assert.equal(lcmRes.lcm, 144);
  assert.equal(lcmRes.verified, true);
});

test('Math Engine: prime tests, prime factorization, and Euler totient', () => {
  assert.equal(isPrime(2), true);
  assert.equal(isPrime(29), true);
  assert.equal(isPrime(1), false);
  assert.equal(isPrime(30), false);

  // Prime factors of 60 = 2^2 * 3^1 * 5^1
  const pf60 = primeFactors(60);
  assert.deepEqual(pf60, [
    { prime: 2, power: 2 },
    { prime: 3, power: 1 },
    { prime: 5, power: 1 }
  ]);

  // Euler's totient φ(12) = 4, φ(60) = 16
  assert.equal(calculateTotient(12).phi, 4);
  assert.equal(calculateTotient(60).phi, 16);
});

/* ------------------------------------------------------------
   7. SEQUENCES & CONJECTURES (COLLATZ & FIBONACCI)
   ------------------------------------------------------------ */
test('Math Engine: Fibonacci numbers', () => {
  const fib = generateFibonacci(10);
  assert.deepEqual(fib.sequence, [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]);
});

test('Math Engine: Collatz 12 sequence and EXPLICIT UNPROVEN CONJECTURE STATUS', () => {
  const collatz12 = calculateCollatz(12);
  assert.equal(collatz12.operation, 'collatz');
  assert.equal(collatz12.input, 12);
  assert.deepEqual(collatz12.sequence, [12, 6, 3, 10, 5, 16, 8, 4, 2, 1]);
  assert.equal(collatz12.steps, 9);
  assert.equal(collatz12.reached_one, true);
  assert.equal(collatz12.maximum_value, 16);

  // CRITICAL REQUIREMENT: Must be explicitly tagged as CONJECTURE (UNPROVEN)
  assert.equal(collatz12.conjectureStatus, 'CONJECTURE (UNPROVEN)');
  assert.ok(collatz12.message.includes('UNPROVEN open problem'));
});

/* ------------------------------------------------------------
   8. FOUR-FIGURE TABLES & CONSTANTS
   ------------------------------------------------------------ */
test('Math Knowledge: four-figure tables distinguish table approximation from machine value', () => {
  const logTable = lookupFourFigureTable('log', 3.456);
  assert.equal(logTable.isTableApproximation, true);
  assert.equal(typeof logTable.tableValue, 'number');
  assert.equal(typeof logTable.machineValue, 'number');
  assert.ok(logTable.difference >= 0);

  // Sin(30 deg) table
  const sinTable = lookupFourFigureTable('sin', 30);
  assert.equal(sinTable.tableValue, 0.5);
  assert.ok(Math.abs(sinTable.machineValue - 0.5) < 1e-6);
});

test('Math Knowledge: mathematical constants library', () => {
  const pi = getMathematicalConstant('pi');
  assert.ok(pi);
  assert.equal(pi.symbol, 'π');
  assert.equal(pi.value, Math.PI);

  const eConst = getMathematicalConstant('e');
  assert.ok(eConst);
  assert.equal(eConst.value, Math.E);

  const phi = getMathematicalConstant('phi');
  assert.ok(phi);
  assert.ok(Math.abs(phi.value - 1.6180339887) < 1e-6);
});

/* ------------------------------------------------------------
   9. COMBINATORICS & STATISTICS
   ------------------------------------------------------------ */
test('Math Engine: permutations, combinations, and statistics', () => {
  assert.equal(calculatePermutations(5, 2).result, 20);
  assert.equal(calculateCombinations(5, 2).result, 10);

  const stats = calculateStatistics([2, 4, 4, 4, 5, 5, 7, 9]);
  assert.equal(stats.count, 8);
  assert.equal(stats.mean, 5);
  assert.equal(stats.median, 4.5);
  assert.equal(stats.min, 2);
  assert.equal(stats.max, 9);
});

/* ------------------------------------------------------------
   10. NUMERICAL METHODS (NEWTON-RAPHSON & RESIDUAL VERIFICATION)
   ------------------------------------------------------------ */
test('Math Engine: Newton-Raphson non-linear root finder with residual verification', () => {
  // cos(x) - x = 0 with x0 = 0.5 -> Dottie number ~0.739085
  const nr = calculateNewtonRaphson('cos(x) - x', { x0: 0.5 });
  assert.equal(nr.operation, 'newton_raphson');
  assert.equal(nr.converged, true);
  assert.equal(nr.verified, true);
  assert.ok(Math.abs(nr.root - 0.739085) < 1e-4);
  assert.ok(nr.residual <= 1e-5);
  assert.ok(nr.iterationCount > 0 && nr.iterationCount < 15);
  assert.ok(Array.isArray(nr.iterations) && nr.iterations.length === nr.iterationCount);

  // x^2 - 2 = 0 with x0 = 1 -> sqrt(2) ~1.414213
  const nrSqrt2 = calculateNewtonRaphson('x^2 - 2', { x0: 1 });
  assert.equal(nrSqrt2.verified, true);
  assert.ok(Math.abs(nrSqrt2.root - 1.414213) < 1e-4);
  assert.ok(nrSqrt2.residual <= 1e-5);
});

/* ------------------------------------------------------------
   11. DIFFERENTIAL EQUATIONS (RUNGE-KUTTA 4TH ORDER & EULER)
   ------------------------------------------------------------ */
test('Math Engine: RK4 numerical ODE initial-value solver', () => {
  // dy/dx = x + y, y(0) = 1, target x = 1
  // Exact analytical solution: y(x) = 2e^x - x - 1. At x = 1, y(1) = 2e - 2 ~ 3.4365636
  const rk4 = solveOdeInitialValue('x + y', 0, 1, 1, { steps: 20, method: 'rk4' });
  assert.equal(rk4.operation, 'ode_rk4');
  assert.equal(rk4.verified, true);
  assert.equal(rk4.xEnd, 1);
  assert.ok(Math.abs(rk4.yEnd - 3.43656) < 1e-2);
  assert.ok(Array.isArray(rk4.trajectory) && rk4.trajectory.length === 21);

  // Euler comparison on same problem
  const euler = solveOdeInitialValue('x + y', 0, 1, 1, { steps: 50, method: 'euler' });
  assert.equal(euler.operation, 'ode_euler');
  assert.ok(Math.abs(euler.yEnd - 3.43656) < 0.2); // Euler has higher truncation error
});

/* ------------------------------------------------------------
   12. COMPLEX NUMBERS (ARITHMETIC, POLAR, DE MOIVRE)
   ------------------------------------------------------------ */
test('Math Engine: Complex number arithmetic, polar conversion, and De Moivre powers', () => {
  // Addition: (3 + 4i) + (1 - 2i) = 4 + 2i
  const addRes = calculateComplex('add', '3 + 4i', '1 - 2i');
  assert.equal(addRes.result.re, 4);
  assert.equal(addRes.result.im, 2);
  assert.equal(addRes.rectangular, '4 + 2i');

  // Multiplication: (3 + 4i) * (1 - 2i) = 3 - 6i + 4i + 8 = 11 - 2i
  const mulRes = calculateComplex('multiply', '3 + 4i', '1 - 2i');
  assert.equal(mulRes.result.re, 11);
  assert.equal(mulRes.result.im, -2);
  assert.equal(mulRes.rectangular, '11 - 2i');

  // Polar form: 3 + 4i -> r = 5, theta ~ 53.13 deg
  const polarRes = calculateComplex('polar', '3 + 4i');
  assert.equal(polarRes.modulus, 5);
  assert.ok(Math.abs(polarRes.polar.degrees - 53.13) < 0.1);

  // De Moivre Power: (1 + i)^4 -> r = sqrt(2), theta = 45 deg -> r^4 = 4, theta = 180 deg -> -4
  const pwrRes = calculateComplex('power', '1 + 1i', null, { power: 4 });
  assert.ok(Math.abs(pwrRes.result.re - (-4)) < 1e-4);
  assert.ok(Math.abs(pwrRes.result.im) < 1e-4);
});

/* ------------------------------------------------------------
   13. LINEAR ALGEBRA (2x2 EIGENVALUES & LINEAR SYSTEMS)
   ------------------------------------------------------------ */
test('Math Engine: 2x2 characteristic polynomial, eigenvalues, and eigenvectors', () => {
  // Matrix A = [[4, 1], [2, 3]]
  // Characteristic polynomial: det(A - lambda*I) = lambda^2 - 7*lambda + 10 = 0 -> lambda = 5, 2
  const eig = calculateEigenvalues2x2([[4, 1], [2, 3]]);
  assert.equal(eig.operation, 'eigenvalues');
  assert.equal(eig.trace, 7);
  assert.equal(eig.determinant, 10);
  assert.equal(eig.verified, true);
  assert.ok(eig.residual <= 1e-5);
  assert.equal(eig.eigenvalues.lambda1.val, 5);
  assert.equal(eig.eigenvalues.lambda2.val, 2);
});

test('Math Engine: linear system solving Ax = b via Gaussian elimination with residual check', () => {
  // System: 2x + y = 5, x - y = 1 -> solution x = 2, y = 1
  const sys = solveLinearSystem([[2, 1], [1, -1]], [5, 1]);
  assert.equal(sys.operation, 'solve_system');
  assert.equal(sys.verified, true);
  assert.ok(sys.residual <= 1e-5);
  assert.equal(sys.solution[0], 2);
  assert.equal(sys.solution[1], 1);
});

/* ------------------------------------------------------------
   14. NUMBER THEORY (MODULAR INVERSE & CHINESE REMAINDER THEOREM)
   ------------------------------------------------------------ */
test('Math Engine: modular arithmetic, modular inverse, and Chinese Remainder Theorem', () => {
  // Modular inverse: 7^-1 mod 26 = 15 because 7 * 15 = 105 = 4*26 + 1
  const inv = calculateModularArithmetic({ subOp: 'inverse', a: 7, m: 26 });
  assert.equal(inv.inverse, 15);
  assert.equal(inv.verified, true);

  // Modular exponentiation: 2^10 mod 1000 = 1024 mod 1000 = 24
  const mexp = calculateModularArithmetic({ subOp: 'mod_exp', a: 2, b: 10, m: 1000 });
  assert.equal(mexp.result, 24);

  // Chinese Remainder Theorem:
  // x = 2 mod 3, x = 3 mod 5, x = 2 mod 7 -> x = 23 mod 105
  const crt = calculateModularArithmetic({
    subOp: 'crt',
    remainders: [2, 3, 2],
    moduli: [3, 5, 7]
  });
  assert.equal(crt.crtSolution, 23);
  assert.equal(crt.modulusProduct, 105);
  assert.equal(crt.verified, true);
});

/* ------------------------------------------------------------
   15. STATISTICS (ORDINARY LEAST SQUARES LINEAR REGRESSION)
   ------------------------------------------------------------ */
test('Math Engine: ordinary least squares linear regression with Pearson r and R^2', () => {
  // Perfect linear relationship: y = 2x + 1
  const reg = calculateLinearRegression([1, 2, 3, 4, 5], [3, 5, 7, 9, 11]);
  assert.equal(reg.operation, 'linear_regression');
  assert.equal(reg.slope, 2);
  assert.equal(reg.intercept, 1);
  assert.equal(reg.correlationR, 1);
  assert.equal(reg.rSquared, 1);
  assert.equal(reg.verified, true);
  assert.ok(reg.residual <= 1e-5);
});

/* ------------------------------------------------------------
   16. EXPANDED FOUR-FIGURE TABLES & KNOWLEDGE TAXONOMY
   ------------------------------------------------------------ */
test('Math Knowledge: expanded four-figure tables (cbrt, ln, squares, cubes)', () => {
  const cbrt27 = lookupFourFigureTable('cbrt', 27);
  assert.equal(cbrt27.tableValue, 3);
  assert.ok(Math.abs(cbrt27.machineValue - 3) < 1e-6);

  const lnE = lookupFourFigureTable('ln', 2.718);
  assert.ok(Math.abs(lnE.tableValue - 1.0) < 0.01);

  const sq12 = lookupFourFigureTable('squares', 12);
  assert.equal(sq12.tableValue, 144);

  const cb5 = lookupFourFigureTable('cubes', 5);
  assert.equal(cb5.tableValue, 125);
});

test('Math Knowledge: 39 mathematical domains and proof status catalog', () => {
  assert.ok(MATH_CATEGORIES.length >= 39, `Expected at least 39 categories, got ${MATH_CATEGORIES.length}`);

  const engCategory = MATH_CATEGORIES.find(c => c.id === 'engineering-math');
  assert.ok(engCategory, 'Engineering mathematics domain must exist');

  // Search knowledge
  const pyth = searchMathKnowledge('pythagorean theorem');
  assert.ok(pyth.length > 0);
  assert.equal(pyth[0].proofStatus, PROOF_STATUS.THEOREM);

  const collatzKnowledge = searchMathKnowledge('collatz');
  assert.ok(collatzKnowledge.length > 0);
  assert.equal(collatzKnowledge[0].proofStatus, PROOF_STATUS.CONJECTURE);

  const riemann = searchMathKnowledge('riemann hypothesis');
  assert.ok(riemann.length > 0);
  assert.equal(riemann[0].proofStatus, PROOF_STATUS.OPEN_PROBLEM);

  // Engineering entries search
  const laplace = searchMathKnowledge('laplace transform');
  assert.ok(laplace.length > 0);

  const fourier = searchMathKnowledge('fourier series');
  assert.ok(fourier.length > 0);

  const navier = searchMathKnowledge('navier-stokes');
  assert.ok(navier.length > 0);
  assert.equal(navier[0].proofStatus, PROOF_STATUS.OPEN_PROBLEM);
});

/* ------------------------------------------------------------
   17. ASSISTANT INTEGRATION FOR NEW MATHEMATICAL SOLVERS
   ------------------------------------------------------------ */
test('Assistant Integration: executeAssistantTool("calculate_math") for Newton-Raphson', async () => {
  const res = await executeAssistantTool('calculate_math', {
    operation: 'newton_raphson',
    expression: 'cos(x) - x',
    x0: 0.5
  });

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'math-result');
  assert.equal(res.verified, true);
  assert.ok(Math.abs(res.root - 0.739085) < 1e-4);
});

test('Assistant Integration: executeAssistantTool("calculate_math") for RK4 ODE solver', async () => {
  const res = await executeAssistantTool('calculate_math', {
    operation: 'ode_rk4',
    expression: 'x + y',
    x0: 0,
    y0: 1,
    xEnd: 1,
    steps: 20
  });

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'math-result');
  assert.equal(res.verified, true);
  assert.ok(Math.abs(res.yEnd - 3.43656) < 1e-2);
});

test('Assistant Integration: executeAssistantTool("calculate_math") for eigenvalues', async () => {
  const res = await executeAssistantTool('calculate_math', {
    operation: 'eigenvalues',
    matrix: [[4, 1], [2, 3]]
  });

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'math-result');
  assert.equal(res.verified, true);
  assert.equal(res.eigenvalues.lambda1.val, 5);
  assert.equal(res.eigenvalues.lambda2.val, 2);
});

test('Assistant Integration: executeAssistantTool("calculate_math") for linear system Ax = b', async () => {
  const res = await executeAssistantTool('calculate_math', {
    operation: 'solve_system',
    matrix: [[2, 1], [1, -1]],
    vector: [5, 1]
  });

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'math-result');
  assert.equal(res.verified, true);
  assert.deepEqual(res.solution, [2, 1]);
});

test('Assistant Integration: executeAssistantTool("calculate_math") for linear regression', async () => {
  const res = await executeAssistantTool('calculate_math', {
    operation: 'linear_regression',
    xData: [1, 2, 3, 4, 5],
    yData: [3, 5, 7, 9, 11]
  });

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'math-result');
  assert.equal(res.verified, true);
  assert.equal(res.slope, 2);
  assert.equal(res.intercept, 1);
});

test('Assistant Integration: executeAssistantTool("query_math_knowledge") for engineering math', async () => {
  const res = await executeAssistantTool('query_math_knowledge', {
    category: 'engineering-math',
    query: ''
  });

  assert.equal(res.status, 'success');
  assert.equal(res.type, 'math-knowledge');
  assert.ok(res.entries.length > 0);
  assert.ok(res.entries.every(e => e.category === 'engineering-math'));
});

test('Assistant Integration: Chemistry capability separation (Copper molar mass)', async () => {
  // Chemistry should continue using calculate_chemistry and not be duplicated in math utility
  const chemRes = await executeAssistantTool('calculate_chemistry', {
    action: 'molar_mass',
    formulaOrQuery: 'Cu'
  });

  assert.equal(chemRes.status, 'success');
  assert.ok(Math.abs(chemRes.molarMassGPerMol - 63.546) < 0.1);
});
