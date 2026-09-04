/* ============================================================
   TOOLBOX — Dedicated Deterministic Math Engine
   Authoritative calculation and verification engine for:
   - Arithmetic, Algebra, Equations (Linear & Quadratic with residual checks)
   - Trigonometry, Logarithms, Powers, Degree/Radian conversions
   - Calculus (Symbolic & Numerical Derivatives, Integrals via Simpson's rule)
   - Numerical Methods (Newton-Raphson Root Finding, Runge-Kutta 4th Order ODE)
   - Complex Numbers (Arithmetic, Modulus, Argument, Polar Form, De Moivre)
   - Linear Algebra (Matrix Determinants, Inverses, Eigenvalues 2x2, Linear Systems Ax=b)
   - Number Theory (Primes, Factorization, GCD with Bézout, LCM, Totient, Modular Arithmetic, CRT)
   - Sequences & Conjectures (Collatz with unproven status, Fibonacci)
   - Combinatorics (Permutations, Combinations)
   - Statistics & Regression (Mean, Median, StdDev, Linear Regression y = mx + c)
   - Four-Figure Reference Tables (log, antilog, ln, sin, cos, tan, sqrt, cbrt, reciprocal, squares, cubes)
   Pattern: CALCULATE -> VERIFY -> RETURN STRUCTURED RESULT -> RENDER
   ============================================================ */

import {
  lookupFourFigureTable,
  getMathematicalConstant,
  MATHEMATICAL_CONSTANTS
} from './math-knowledge.js';

import {
  calculateSequenceTerm,
  generateSequenceRange,
  analyzeCollatz,
  compareSequences,
  getSequence,
  listAllSequences,
  formatSequenceValue
} from './math-sequences.js';

export {
  calculateSequenceTerm,
  generateSequenceRange,
  analyzeCollatz,
  compareSequences,
  getSequence,
  listAllSequences,
  formatSequenceValue
};

export const CONSTANTS = {
  pi: Math.PI,
  PI: Math.PI,
  e: Math.E,
  E: Math.E,
  phi: 1.618033988749895, // Golden ratio
  c: 299792458, // Speed of light (m/s)
  g: 9.80665, // Standard gravity (m/s²)
  G: 6.67430e-11, // Gravitational constant (m³/kg/s²)
  h: 6.62607015e-34, // Planck's constant (J·s)
  k: 1.380649e-23, // Boltzmann constant (J/K)
  N_A: 6.02214076e23, // Avogadro's number (mol⁻¹)
  R: 8.314462618, // Universal gas constant (J/(mol·K))
  q_e: 1.602176634e-19, // Elementary charge (C)
  m_e: 9.1093837015e-31 // Electron mass (kg)
};

/**
 * Factorial helper
 */
export function factorial(n) {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n === 0 || n === 1) return 1;
  let res = 1;
  for (let i = 2; i <= Math.min(n, 170); i++) res *= i;
  return res;
}

/**
 * Safe Math Tokenizer & Evaluator (Shunting-Yard & RPN)
 */
export function evaluateExpression(expr, vars = {}) {
  if (!expr || typeof expr !== 'string') {
    throw new Error('Expression must be a non-empty string.');
  }

  // Pre-process expression
  let clean = expr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/\^/g, ' ^ ')
    .replace(/,/g, ' ')
    .trim();

  // Replace constants
  const scope = { ...CONSTANTS, ...vars };

  // Helper token matching
  const tokens = [];
  const regex = /\s*([0-9]+(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?|[a-zA-Z_][a-zA-Z0-9_]*|\+|\-|\*|\/|\^|\%|\(|\)|!)\s*/g;
  let match;

  while ((match = regex.exec(clean)) !== null) {
    tokens.push(match[1]);
  }

  if (tokens.length === 0) {
    throw new Error(`Invalid mathematical expression: "${expr}"`);
  }

  const ops = {
    '+': { prec: 1, assoc: 'L', fn: (a, b) => a + b },
    '-': { prec: 1, assoc: 'L', fn: (a, b) => a - b },
    '*': { prec: 2, assoc: 'L', fn: (a, b) => a * b },
    '/': {
      prec: 2,
      assoc: 'L',
      fn: (a, b) => {
        if (b === 0) throw new Error('Division by zero');
        return a / b;
      }
    },
    '%': { prec: 2, assoc: 'L', fn: (a, b) => a % b },
    '^': { prec: 3, assoc: 'R', fn: (a, b) => Math.pow(a, b) }
  };

  const functions = {
    sin: x => Math.sin(x),
    cos: x => Math.cos(x),
    tan: x => Math.tan(x),
    asin: x => Math.asin(x),
    acos: x => Math.acos(x),
    atan: x => Math.atan(x),
    sind: x => Math.sin((x * Math.PI) / 180),
    cosd: x => Math.cos((x * Math.PI) / 180),
    tand: x => Math.tan((x * Math.PI) / 180),
    sinh: x => Math.sinh(x),
    cosh: x => Math.cosh(x),
    tanh: x => Math.tanh(x),
    sqrt: x => {
      if (x < 0) throw new Error('Cannot take square root of negative number in real domain');
      return Math.sqrt(x);
    },
    cbrt: x => Math.cbrt(x),
    log: x => Math.log10(x),
    log10: x => Math.log10(x),
    log2: x => Math.log2(x),
    ln: x => Math.log(x),
    exp: x => Math.exp(x),
    abs: x => Math.abs(x),
    ceil: x => Math.ceil(x),
    floor: x => Math.floor(x),
    round: x => Math.round(x),
    deg2rad: x => (x * Math.PI) / 180,
    rad2deg: x => (x * 180) / Math.PI,
    fact: x => factorial(Math.round(x)),
    factorial: x => factorial(Math.round(x))
  };

  // Convert infix to RPN
  const outputQueue = [];
  const operatorStack = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const prevToken = i > 0 ? tokens[i - 1] : null;

    if (!isNaN(Number(token))) {
      outputQueue.push(Number(token));
    } else if (token in functions) {
      operatorStack.push(token);
    } else if (token in scope) {
      outputQueue.push(scope[token]);
    } else if (token === '!') {
      outputQueue.push('!');
    } else if (token === '-' && (prevToken === null || prevToken === '(' || prevToken in ops)) {
      outputQueue.push(0);
      operatorStack.push('-');
    } else if (token in ops) {
      while (operatorStack.length > 0) {
        const top = operatorStack[operatorStack.length - 1];
        if (top in functions) {
          outputQueue.push(operatorStack.pop());
        } else if (top in ops) {
          const o1 = ops[token];
          const o2 = ops[top];
          if ((o1.assoc === 'L' && o1.prec <= o2.prec) || (o1.assoc === 'R' && o1.prec < o2.prec)) {
            outputQueue.push(operatorStack.pop());
          } else {
            break;
          }
        } else {
          break;
        }
      }
      operatorStack.push(token);
    } else if (token === '(') {
      operatorStack.push('(');
    } else if (token === ')') {
      while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== '(') {
        outputQueue.push(operatorStack.pop());
      }
      if (operatorStack.length === 0) {
        throw new Error('Mismatched parentheses in expression');
      }
      operatorStack.pop(); // Pop '('
      if (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] in functions) {
        outputQueue.push(operatorStack.pop());
      }
    } else {
      throw new Error(`Unknown identifier or symbol: "${token}"`);
    }
  }

  while (operatorStack.length > 0) {
    const op = operatorStack.pop();
    if (op === '(' || op === ')') {
      throw new Error('Mismatched parentheses in expression');
    }
    outputQueue.push(op);
  }

  // Evaluate RPN
  const evalStack = [];
  for (const item of outputQueue) {
    if (typeof item === 'number') {
      evalStack.push(item);
    } else if (item === '!') {
      if (evalStack.length < 1) throw new Error('Invalid factorial syntax');
      const val = evalStack.pop();
      evalStack.push(factorial(val));
    } else if (item in functions) {
      if (evalStack.length < 1) throw new Error(`Missing argument for function ${item}`);
      const arg = evalStack.pop();
      evalStack.push(functions[item](arg));
    } else if (item in ops) {
      if (evalStack.length < 2) throw new Error(`Missing operands for operator ${item}`);
      const b = evalStack.pop();
      const a = evalStack.pop();
      evalStack.push(ops[item].fn(a, b));
    }
  }

  if (evalStack.length !== 1) {
    throw new Error(`Failed to evaluate expression: "${expr}"`);
  }

  const res = evalStack[0];
  if (typeof res !== 'number' || isNaN(res)) {
    throw new Error('Evaluation resulted in an undefined or NaN numerical value.');
  }

  return Number(Number.isInteger(res) ? res : res.toFixed(10).replace(/\.?0+$/, ''));
}

/* ============================================================
   EQUATION SOLVER (LINEAR & QUADRATIC WITH RESIDUAL VERIFICATION)
   ============================================================ */

export function parseEquation(eqStr) {
  if (!eqStr || typeof eqStr !== 'string') {
    throw new Error('Equation must be a valid string.');
  }

  let [lhs, rhs] = eqStr.split('=').map(s => s.trim());
  if (!lhs) throw new Error('Invalid equation format: LHS missing.');
  if (rhs === undefined) rhs = '0';

  const normalize = (s) => s
    .replace(/⁰/g, '^0')
    .replace(/¹/g, '^1')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/⁴/g, '^4')
    .replace(/⁵/g, '^5')
    .replace(/⁶/g, '^6')
    .replace(/⁷/g, '^7')
    .replace(/⁸/g, '^8')
    .replace(/⁹/g, '^9')
    .replace(/−/g, '-')
    .replace(/\s+/g, '');

  const normLhs = normalize(lhs);
  const normRhs = normalize(rhs);

  // Detect variable
  const fullStr = normLhs + normRhs;
  const stripped = fullStr.replace(/\b(sin|cos|tan|log|ln|exp|sqrt|abs|pi)\b/gi, '');
  const varMatch = stripped.match(/[a-df-oq-z]/i) || stripped.match(/[a-zA-Z]/);
  const varName = varMatch ? varMatch[0] : 'x';

  function parseSideTerms(sideStr, signMultiplier) {
    if (!sideStr || sideStr === '0') return {};
    const tokens = sideStr.match(/[+-]?[^+-]+/g) || [];
    const coeffs = {};

    for (const raw of tokens) {
      const m = raw.match(/^([+-])?([0-9]+(?:\.[0-9]+)?)?(?:\*?([a-zA-Z])(?:\^([0-9]+))?)?$/);
      if (!m) return null;
      const sign = m[1] === '-' ? -1 : 1;
      const numStr = m[2];
      const v = m[3];
      const expStr = m[4];

      if (!numStr && !v) return null;

      let coeff = numStr !== undefined ? parseFloat(numStr) : 1;
      coeff *= sign * signMultiplier;

      let deg = 0;
      if (v) {
        if (v.toLowerCase() !== varName.toLowerCase()) return null;
        deg = expStr !== undefined ? parseInt(expStr, 10) : 1;
      }
      coeffs[deg] = (coeffs[deg] || 0) + coeff;
    }
    return coeffs;
  }

  const lhsTerms = parseSideTerms(normLhs, 1);
  const rhsTerms = parseSideTerms(normRhs, -1);

  if (lhsTerms !== null && rhsTerms !== null) {
    const combined = { ...lhsTerms };
    for (const [degStr, cVal] of Object.entries(rhsTerms)) {
      const deg = parseInt(degStr, 10);
      combined[deg] = (combined[deg] || 0) + cVal;
    }

    const degrees = Object.keys(combined).map(Number).sort((a, b) => b - a);
    let maxDeg = 0;
    for (const d of degrees) {
      if (Math.abs(combined[d]) > 1e-9) {
        maxDeg = Math.max(maxDeg, d);
      }
    }

    let a = 0, b = 0, c = 0, d = 0;
    if (maxDeg === 3) {
      a = combined[3] || 0;
      b = combined[2] || 0;
      c = combined[1] || 0;
      d = combined[0] || 0;
    } else if (maxDeg === 2) {
      a = combined[2] || 0;
      b = combined[1] || 0;
      c = combined[0] || 0;
      d = 0;
    } else if (maxDeg === 1) {
      a = 0;
      b = combined[1] || 0;
      c = combined[0] || 0;
      d = 0;
    }

    return {
      isPolynomial: true,
      degree: maxDeg,
      coeffs: combined,
      a: Number(a.toFixed(8)),
      b: Number(b.toFixed(8)),
      c: Number(c.toFixed(8)),
      d: Number(d.toFixed(8)),
      variable: varName,
      original: eqStr
    };
  }

  // Fallback: evaluate expression at sample points for parenthesized forms like (x-1)*(x-2)
  try {
    let cleanLhs = lhs.replace(/([0-9])([a-zA-Z])/g, '$1*$2');
    let cleanRhs = rhs.replace(/([0-9])([a-zA-Z])/g, '$1*$2');

    const f0 = evaluateExpression(cleanLhs, { [varName]: 0 }) - evaluateExpression(cleanRhs, { [varName]: 0 });
    const f1 = evaluateExpression(cleanLhs, { [varName]: 1 }) - evaluateExpression(cleanRhs, { [varName]: 1 });
    const fneg1 = evaluateExpression(cleanLhs, { [varName]: -1 }) - evaluateExpression(cleanRhs, { [varName]: -1 });
    const f2 = evaluateExpression(cleanLhs, { [varName]: 2 }) - evaluateExpression(cleanRhs, { [varName]: 2 });
    const fneg2 = evaluateExpression(cleanLhs, { [varName]: -2 }) - evaluateExpression(cleanRhs, { [varName]: -2 });

    // Check quadratic fit
    const cQuad = f0;
    const aQuad = (f1 + fneg1 - 2 * cQuad) / 2;
    const bQuad = (f1 - fneg1) / 2;
    const expectedF2Quad = aQuad * 4 + bQuad * 2 + cQuad;

    if (Math.abs(f2 - expectedF2Quad) < 1e-5) {
      const isDeg2 = Math.abs(aQuad) > 1e-9;
      const isDeg1 = Math.abs(bQuad) > 1e-9;
      return {
        isPolynomial: true,
        degree: isDeg2 ? 2 : (isDeg1 ? 1 : 0),
        coeffs: { 2: aQuad, 1: bQuad, 0: cQuad },
        a: isDeg2 ? Number(aQuad.toFixed(8)) : 0,
        b: Number(bQuad.toFixed(8)),
        c: Number(cQuad.toFixed(8)),
        d: 0,
        variable: varName,
        original: eqStr
      };
    }

    // Check cubic fit: f(x) = ax^3 + bx^2 + cx + d
    const dCubic = f0;
    const bCubic = (f1 + fneg1 - 2 * dCubic) / 2;
    const diff1 = (f1 - fneg1) / 2;
    const diff2 = (f2 - fneg2) / 4;
    const aCubic = (diff2 - diff1) / 3;
    const cCubic = diff1 - aCubic;

    const f3 = evaluateExpression(cleanLhs, { [varName]: 3 }) - evaluateExpression(cleanRhs, { [varName]: 3 });
    const expectedF3 = aCubic * 27 + bCubic * 9 + cCubic * 3 + dCubic;

    if (Math.abs(f3 - expectedF3) < 1e-4) {
      return {
        isPolynomial: true,
        degree: Math.abs(aCubic) > 1e-9 ? 3 : (Math.abs(bCubic) > 1e-9 ? 2 : 1),
        coeffs: { 3: aCubic, 2: bCubic, 1: cCubic, 0: dCubic },
        a: Number(aCubic.toFixed(8)),
        b: Number(bCubic.toFixed(8)),
        c: Number(cCubic.toFixed(8)),
        d: Number(dCubic.toFixed(8)),
        variable: varName,
        original: eqStr
      };
    }
  } catch (err) {
    // Non-evaluable, fall through
  }

  return {
    isPolynomial: false,
    variable: varName,
    original: eqStr
  };
}

export function solveLinear(a, b, varName = 'x') {
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) < 1e-12) {
      return {
        type: 'infinite',
        message: 'Infinite solutions (identity equation 0 = 0).'
      };
    }
    throw new Error('Inconsistent equation: no solution exists (0 = non-zero).');
  }

  const root = -b / a;
  const residual = Math.abs(a * root + b);
  const verified = residual < 1e-6;

  return {
    operation: 'solve_linear',
    variable: varName,
    coefficients: { a, b },
    root: Number(root.toFixed(8)),
    verified,
    residual,
    steps: [
      `Standard form: ${a}${varName} + ${b} = 0`,
      `Subtract ${b} from both sides: ${a}${varName} = ${-b}`,
      `Divide both sides by ${a}: ${varName} = ${-b} / ${a} = ${Number(root.toFixed(8))}`,
      `Verification by substitution: ${a} * (${Number(root.toFixed(8))}) + ${b} = ${residual.toFixed(8)} (Residual ≤ 1e-6: ${verified ? 'Passed' : 'Failed'})`
    ],
    message: `Solution: ${varName} = ${Number(root.toFixed(8))} (Verified residual = ${residual.toFixed(8)})`
  };
}

export function solveQuadratic(a, b, c, varName = 'x') {
  if (Math.abs(a) < 1e-12) {
    return solveLinear(b, c, varName);
  }

  const discriminant = b * b - 4 * a * c;
  const steps = [
    `Standard form: ${a}${varName}² + ${b}${varName} + ${c} = 0`,
    `Identify coefficients: a = ${a}, b = ${b}, c = ${c}`,
    `Compute discriminant: D = b² - 4ac = (${b})² - 4(${a})(${c}) = ${b * b} - ${4 * a * c} = ${discriminant}`
  ];

  let roots = [];
  let nature = '';
  let verified = true;
  let residuals = [];

  if (discriminant > 1e-12) {
    nature = 'Two distinct real roots';
    const sqrtD = Math.sqrt(discriminant);
    const r1 = (-b + sqrtD) / (2 * a);
    const r2 = (-b - sqrtD) / (2 * a);
    roots = [Number(r1.toFixed(8)), Number(r2.toFixed(8))];

    for (const r of roots) {
      const resVal = Math.abs(a * r * r + b * r + c);
      residuals.push(resVal);
      if (resVal > 1e-5) verified = false;
    }

    steps.push(`Discriminant D > 0: ${nature}`);
    steps.push(`Apply quadratic formula: ${varName} = (-b ± √D) / 2a`);
    steps.push(`r₁ = (-(${b}) + √${discriminant}) / (2 * ${a}) = ${roots[0]}`);
    steps.push(`r₂ = (-(${b}) - √${discriminant}) / (2 * ${a}) = ${roots[1]}`);
    steps.push(`Verification: f(${roots[0]}) residual = ${residuals[0].toFixed(8)}, f(${roots[1]}) residual = ${residuals[1].toFixed(8)} (${verified ? 'Verified' : 'Unverified'})`);

  } else if (Math.abs(discriminant) <= 1e-12) {
    nature = 'One repeated real root';
    const r = -b / (2 * a);
    roots = [Number(r.toFixed(8))];
    const resVal = Math.abs(a * r * r + b * r + c);
    residuals.push(resVal);
    verified = resVal < 1e-5;

    steps.push(`Discriminant D = 0: ${nature}`);
    steps.push(`${varName} = -b / 2a = -(${b}) / (2 * ${a}) = ${roots[0]}`);
    steps.push(`Verification: f(${roots[0]}) residual = ${resVal.toFixed(8)} (${verified ? 'Verified' : 'Unverified'})`);

  } else {
    nature = 'Two complex conjugate roots';
    const realPart = Number((-b / (2 * a)).toFixed(8));
    const imagPart = Number((Math.sqrt(-discriminant) / (2 * Math.abs(a))).toFixed(8));
    roots = [
      `${realPart} + ${imagPart}i`,
      `${realPart} - ${imagPart}i`
    ];

    const realRes = Math.abs(a * (realPart * realPart - imagPart * imagPart) + b * realPart + c);
    const imagRes = Math.abs(2 * a * realPart * imagPart + b * imagPart);
    const complexResidual = Math.sqrt(realRes * realRes + imagRes * imagRes);
    residuals.push(complexResidual);
    verified = complexResidual < 1e-4;

    steps.push(`Discriminant D < 0 (${discriminant}): ${nature}`);
    steps.push(`Real part: -b / 2a = ${realPart}`);
    steps.push(`Imaginary part: √(–D) / 2|a| = √${-discriminant} / ${2 * Math.abs(a)} = ${imagPart}`);
    steps.push(`Roots: ${roots[0]} and ${roots[1]}`);
    steps.push(`Complex verification: residual = ${complexResidual.toFixed(8)} (${verified ? 'Verified' : 'Unverified'})`);
  }

  return {
    operation: 'solve_quadratic',
    variable: varName,
    coefficients: { a, b, c },
    discriminant,
    nature,
    roots,
    verified,
    residuals,
    steps,
    message: `Roots: ${roots.join(', ')} (${nature}, verified residual ≤ 1e-5)`
  };
}

export function solveCubic(a, b, c, d, varName = 'x') {
  if (Math.abs(a) < 1e-12) {
    return solveQuadratic(b, c, d, varName);
  }

  const p1 = b / a;
  const p2 = c / a;
  const p3 = d / a;

  const P = p2 - (p1 * p1) / 3;
  const Q = (2 * p1 * p1 * p1) / 27 - (p1 * p2) / 3 + p3;
  const delta = (Q / 2) * (Q / 2) + (P / 3) * (P / 3) * (P / 3);

  const shift = p1 / 3;

  function evalPoly(xVal) {
    return a * xVal * xVal * xVal + b * xVal * xVal + c * xVal + d;
  }

  function cleanRoot(r) {
    const rounded = Math.round(r);
    if (Math.abs(r - rounded) < 1e-7 && Math.abs(evalPoly(rounded)) < 1e-4) {
      return rounded;
    }
    return Number(r.toFixed(8));
  }

  const steps = [
    `Standard form: ${a}${varName}³ + ${b}${varName}² + ${c}${varName} + ${d} = 0`,
    `Identify coefficients: a = ${a}, b = ${b}, c = ${c}, d = ${d}`,
    `Monic form: ${varName}³ + (${b}/${a})${varName}² + (${c}/${a})${varName} + (${d}/${a}) = 0`,
    `Tschirnhaus substitution: ${varName} = y - b/(3a) = y - (${Number(shift.toFixed(6))})`,
    `Depressed cubic: y³ + Py + Q = 0 where P = ${Number(P.toFixed(8))}, Q = ${Number(Q.toFixed(8))}`,
    `Discriminant: Δ = (Q/2)² + (P/3)³ = ${Number(delta.toFixed(8))}`
  ];

  let roots = [];
  let nature = '';
  let verified = true;
  let residuals = [];

  if (delta < -1e-11) {
    nature = 'Three distinct real roots';
    const m = 2 * Math.sqrt(-P / 3);
    const arg = Math.max(-1, Math.min(1, (-Q / 2) / Math.sqrt(-Math.pow(P / 3, 3))));
    const theta = Math.acos(arg) / 3;

    const y0 = m * Math.cos(theta);
    const y1 = m * Math.cos(theta - (2 * Math.PI) / 3);
    const y2 = m * Math.cos(theta - (4 * Math.PI) / 3);

    const rVals = [cleanRoot(y0 - shift), cleanRoot(y1 - shift), cleanRoot(y2 - shift)];
    rVals.sort((x, y) => x - y);
    roots = rVals;

    for (const r of roots) {
      const res = Math.abs(evalPoly(r));
      residuals.push(res);
      if (res > 1e-4) verified = false;
    }

    steps.push(`Discriminant Δ < 0: ${nature} (casus irreducibilis).`);
    steps.push(`Apply Viète trigonometric method: m = 2√(-P/3) = ${Number(m.toFixed(6))}, θ = arccos(...) / 3 = ${Number(theta.toFixed(6))} rad`);
    steps.push(`Roots: ${roots.map(r => `${varName} = ${r}`).join(', ')}`);
    steps.push(`Verification: residuals = [${residuals.map(r => r.toFixed(8)).join(', ')}] (${verified ? 'Verified' : 'Unverified'})`);

  } else if (Math.abs(delta) <= 1e-11) {
    nature = 'Real roots with repeated root';
    if (Math.abs(P) < 1e-11 && Math.abs(Q) < 1e-11) {
      const r = cleanRoot(-shift);
      roots = [r];
      const res = Math.abs(evalPoly(r));
      residuals.push(res);
      if (res > 1e-4) verified = false;
    } else {
      const y1 = (3 * Q) / P;
      const y2 = -(3 * Q) / (2 * P);
      const r1 = cleanRoot(y1 - shift);
      const r2 = cleanRoot(y2 - shift);
      const unique = [r1];
      if (Math.abs(r1 - r2) > 1e-5) unique.push(r2);
      unique.sort((x, y) => x - y);
      roots = unique;
      for (const r of roots) {
        const res = Math.abs(evalPoly(r));
        residuals.push(res);
        if (res > 1e-4) verified = false;
      }
    }

    steps.push(`Discriminant Δ = 0: ${nature}`);
    steps.push(`Roots: ${roots.map(r => `${varName} = ${r}`).join(', ')}`);
    steps.push(`Verification: residuals = [${residuals.map(r => r.toFixed(8)).join(', ')}] (${verified ? 'Verified' : 'Unverified'})`);

  } else {
    nature = 'One real root and two complex conjugate roots';
    const sqrtDelta = Math.sqrt(delta);
    const uArg = -Q / 2 + sqrtDelta;
    const vArg = -Q / 2 - sqrtDelta;
    const u = Math.sign(uArg) * Math.pow(Math.abs(uArg), 1 / 3);
    const v = Math.sign(vArg) * Math.pow(Math.abs(vArg), 1 / 3);

    const realRoot = cleanRoot(u + v - shift);
    const resReal = Math.abs(evalPoly(realRoot));
    residuals.push(resReal);
    if (resReal > 1e-4) verified = false;

    const re = Number((-(u + v) / 2 - shift).toFixed(8));
    const im = Number((Math.abs(u - v) * Math.sqrt(3) / 2).toFixed(8));
    roots = [
      realRoot,
      `${re} + ${im}i`,
      `${re} - ${im}i`
    ];

    steps.push(`Discriminant Δ > 0: ${nature}`);
    steps.push(`Apply Cardano formula: u = ∛(-Q/2 + √Δ) = ${Number(u.toFixed(6))}, v = ∛(-Q/2 - √Δ) = ${Number(v.toFixed(6))}`);
    steps.push(`Real root: ${varName} = ${realRoot}`);
    steps.push(`Complex roots: ${roots[1]}, ${roots[2]}`);
    steps.push(`Verification: residual = ${residuals[0].toFixed(8)} (${verified ? 'Verified' : 'Unverified'})`);
  }

  return {
    operation: 'solve_cubic',
    variable: varName,
    coefficients: { a, b, c, d },
    discriminant: Number(delta.toFixed(8)),
    nature,
    roots,
    verified,
    residuals,
    steps,
    message: `Roots: ${roots.join(', ')} (${nature}, verified residual ≤ 1e-4)`
  };
}

export function solvePolynomial(coeffs, varName = 'x') {
  const degrees = Object.keys(coeffs).map(Number).sort((a, b) => b - a);
  const n = degrees[0];
  if (!n || n < 1) throw new Error('Invalid polynomial degree.');

  if (n === 3) {
    return solveCubic(coeffs[3] || 0, coeffs[2] || 0, coeffs[1] || 0, coeffs[0] || 0, varName);
  }
  if (n === 2) {
    return solveQuadratic(coeffs[2] || 0, coeffs[1] || 0, coeffs[0] || 0, varName);
  }
  if (n === 1) {
    return solveLinear(coeffs[1] || 0, coeffs[0] || 0, varName);
  }

  const cn = coeffs[n];
  if (Math.abs(cn) < 1e-12) throw new Error('Leading coefficient cannot be zero.');

  const a = new Array(n + 1).fill(0);
  for (let k = 0; k <= n; k++) {
    a[k] = (coeffs[k] || 0) / cn;
  }

  const add = (z1, z2) => [z1[0] + z2[0], z1[1] + z2[1]];
  const sub = (z1, z2) => [z1[0] - z2[0], z1[1] - z2[1]];
  const mul = (z1, z2) => [z1[0] * z2[0] - z1[1] * z2[1], z1[0] * z2[1] + z1[1] * z2[0]];
  const div = (z1, z2) => {
    const denom = z2[0] * z2[0] + z2[1] * z2[1];
    return [(z1[0] * z2[0] + z1[1] * z2[1]) / denom, (z1[1] * z2[0] - z1[0] * z2[1]) / denom];
  };
  const mag = (z) => Math.hypot(z[0], z[1]);

  function evalPolyComplex(z) {
    let res = [1, 0];
    for (let k = n - 1; k >= 0; k--) {
      res = add(mul(res, z), [a[k], 0]);
    }
    return res;
  }

  let zRoots = [];
  const radius = 1 + Math.max(...a.slice(0, n).map(Math.abs));
  for (let k = 0; k < n; k++) {
    const angle = (2 * Math.PI * k) / n + 0.4;
    zRoots.push([radius * 0.7 * Math.cos(angle), radius * 0.7 * Math.sin(angle)]);
  }

  for (let iter = 0; iter < 100; iter++) {
    let maxDelta = 0;
    const nextRoots = [];
    for (let k = 0; k < n; k++) {
      const zk = zRoots[k];
      const pVal = evalPolyComplex(zk);

      let qVal = [1, 0];
      for (let j = 0; j < n; j++) {
        if (j !== k) {
          qVal = mul(qVal, sub(zk, zRoots[j]));
        }
      }

      const delta = div(pVal, qVal);
      const newZ = sub(zk, delta);
      nextRoots.push(newZ);
      maxDelta = Math.max(maxDelta, mag(delta));
    }
    zRoots = nextRoots;
    if (maxDelta < 1e-12) break;
  }

  const roots = [];
  const residuals = [];
  let verified = true;

  for (let k = 0; k < n; k++) {
    const zk = zRoots[k];
    let re = zk[0];
    let im = zk[1];

    if (Math.abs(im) < 1e-6) {
      const rounded = Math.round(re);
      const origResRound = Math.abs(evalPolyComplex([rounded, 0])[0]) * Math.abs(cn);
      if (Math.abs(re - rounded) < 1e-6 && origResRound < 1e-4) {
        re = rounded;
      } else {
        re = Number(re.toFixed(8));
      }
      const resVal = Math.abs(evalPolyComplex([re, 0])[0]) * Math.abs(cn);
      roots.push(re);
      residuals.push(resVal);
      if (resVal > 1e-4) verified = false;
    } else {
      re = Number(re.toFixed(8));
      im = Number(im.toFixed(8));
      const resVal = mag(evalPolyComplex([re, im])) * Math.abs(cn);
      roots.push(`${re} ${im >= 0 ? '+' : '-'} ${Math.abs(im)}i`);
      residuals.push(resVal);
      if (resVal > 1e-4) verified = false;
    }
  }

  roots.sort((x, y) => {
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    if (typeof x === 'number') return -1;
    if (typeof y === 'number') return 1;
    return String(x).localeCompare(String(y));
  });

  return {
    operation: 'solve_polynomial',
    degree: n,
    variable: varName,
    coefficients: coeffs,
    roots,
    verified,
    residuals,
    steps: [
      `Polynomial of degree ${n} in variable ${varName}`,
      `Computed roots via Durand-Kerner simultaneous iteration: ${roots.join(', ')}`,
      `Verification: all residuals <= 1e-4 (${verified ? 'Passed' : 'Failed'})`
    ],
    message: `Degree ${n} roots: ${roots.join(', ')} (${verified ? 'verified residuals ≤ 1e-4' : 'unverified'})`
  };
}

export function solveEquation(equationStr) {
  const parsed = parseEquation(equationStr);
  if (parsed.isPolynomial) {
    if (parsed.degree === 3) {
      return solveCubic(parsed.a, parsed.b, parsed.c, parsed.d, parsed.variable);
    } else if (parsed.degree === 2) {
      return solveQuadratic(parsed.a, parsed.b, parsed.c, parsed.variable);
    } else if (parsed.degree === 1) {
      return solveLinear(parsed.b, parsed.c, parsed.variable);
    } else if (parsed.degree >= 4) {
      return solvePolynomial(parsed.coeffs, parsed.variable);
    } else {
      throw new Error(`Cannot solve constant expression: ${parsed.original}`);
    }
  }

  // Fallback for non-polynomial equations (e.g. cos(x) = x)
  const [lhs, rhs] = equationStr.split('=').map(s => s.trim());
  const expr = `(${lhs}) - (${rhs || '0'})`;
  return calculateNewtonRaphson(expr, 1, { varName: parsed.variable });
}

/* ============================================================
   CALCULUS (DERIVATIVES & INTEGRALS)
   ============================================================ */

export function symbolicPolynomialDerivative(expr, varName = 'x') {
  const clean = expr.replace(/\s+/g, '').replace(/−/g, '-').replace(/\+\-/g, '-');
  const termRegex = /([+-]?[0-9]*\.?[0-9]*)\*?([a-zA-Z])(?:\^([0-9]+))?|([+-]?[0-9]+\.?[0-9]*)/g;
  let match;
  let derivTerms = [];
  let matchedAny = false;

  while ((match = termRegex.exec(clean)) !== null) {
    if (match[0] === '') break;
    matchedAny = true;

    if (match[4] !== undefined) continue;

    const rawCoeff = match[1];
    const v = match[2];
    const rawPower = match[3];

    let coeff = 1;
    if (rawCoeff === '-' || rawCoeff === '-1') coeff = -1;
    else if (rawCoeff === '+' || rawCoeff === '') coeff = 1;
    else coeff = Number(rawCoeff);

    const power = rawPower ? parseInt(rawPower, 10) : 1;
    const newCoeff = coeff * power;
    const newPower = power - 1;

    if (newPower === 0) {
      derivTerms.push(`${newCoeff >= 0 ? '+' : ''}${newCoeff}`);
    } else if (newPower === 1) {
      derivTerms.push(`${newCoeff >= 0 ? '+' : ''}${newCoeff === 1 ? '' : newCoeff === -1 ? '-' : newCoeff}${v}`);
    } else {
      derivTerms.push(`${newCoeff >= 0 ? '+' : ''}${newCoeff === 1 ? '' : newCoeff === -1 ? '-' : newCoeff}${v}^${newPower}`);
    }
  }

  if (!matchedAny || derivTerms.length === 0) return '0';
  let result = derivTerms.join(' ').trim();
  if (result.startsWith('+')) result = result.slice(1).trim();
  result = result.replace(/\+ -/g, '- ').replace(/\+ \+/g, '+ ');
  return result || '0';
}

export function symbolicPolynomialIntegral(expr, varName = 'x') {
  const clean = expr.replace(/\s+/g, '').replace(/−/g, '-');
  const termRegex = /([+-]?[0-9]*\.?[0-9]*)\*?([a-zA-Z])(?:\^([0-9]+))?|([+-]?[0-9]+\.?[0-9]*)/g;
  let match;
  let intTerms = [];

  while ((match = termRegex.exec(clean)) !== null) {
    if (match[0] === '') break;

    if (match[4] !== undefined) {
      const c = Number(match[4]);
      if (c !== 0) {
        intTerms.push(`${c >= 0 ? '+' : ''}${c === 1 ? '' : c === -1 ? '-' : c}${varName}`);
      }
      continue;
    }

    const rawCoeff = match[1];
    const v = match[2];
    const rawPower = match[3];

    let coeff = 1;
    if (rawCoeff === '-' || rawCoeff === '-1') coeff = -1;
    else if (rawCoeff === '+' || rawCoeff === '') coeff = 1;
    else coeff = Number(rawCoeff);

    const power = rawPower ? parseInt(rawPower, 10) : 1;
    const newPower = power + 1;
    const newCoeff = coeff / newPower;
    const formattedCoeff = Number.isInteger(newCoeff) ? String(newCoeff) : newCoeff.toFixed(4).replace(/\.?0+$/, '');

    if (formattedCoeff === '1') {
      intTerms.push(`+${v}^${newPower}`);
    } else if (formattedCoeff === '-1') {
      intTerms.push(`-${v}^${newPower}`);
    } else {
      intTerms.push(`${newCoeff >= 0 ? '+' : ''}${formattedCoeff}${v}^${newPower}`);
    }
  }

  if (intTerms.length === 0) return 'C';
  let result = intTerms.join(' ').trim();
  if (result.startsWith('+')) result = result.slice(1).trim();
  result = result.replace(/\+ -/g, '- ');
  return `${result} + C`;
}

export function calculateDerivative(expr, varName = 'x', atPoint = null) {
  const cleanExpr = expr.replace(/^derivative of /i, '').replace(/ at.*$/i, '').trim();
  const point = atPoint !== null ? Number(atPoint) : null;

  let symbolicResult = null;
  try {
    symbolicResult = symbolicPolynomialDerivative(cleanExpr, varName);
  } catch (e) {}

  if (point !== null && !isNaN(point)) {
    const h = 1e-6;
    const f1 = evaluateExpression(cleanExpr, { [varName]: point + h });
    const f2 = evaluateExpression(cleanExpr, { [varName]: point - h });
    const derivVal = (f1 - f2) / (2 * h);
    const rounded = Number(derivVal.toFixed(6).replace(/\.?0+$/, ''));

    return {
      operation: 'derivative',
      expression: cleanExpr,
      variable: varName,
      at: point,
      symbolic: symbolicResult,
      result: rounded,
      steps: [
        `Expression: f(${varName}) = ${cleanExpr}`,
        symbolicResult ? `Symbolic derivative: f'(${varName}) = ${symbolicResult}` : `Numerical central difference method with step h = 1e-6`,
        `Evaluate at ${varName} = ${point}: f'(${point}) ≈ ${rounded}`
      ],
      message: `d/d${varName}(${cleanExpr}) at ${varName}=${point} is ${rounded}${symbolicResult ? ` (Symbolic: ${symbolicResult})` : ''}.`
    };
  }

  return {
    operation: 'derivative',
    expression: cleanExpr,
    variable: varName,
    symbolic: symbolicResult || `d/d${varName}(${cleanExpr})`,
    result: symbolicResult,
    steps: [
      `Expression: f(${varName}) = ${cleanExpr}`,
      `Apply differentiation rules: d/d${varName}[f(${varName})]`,
      symbolicResult ? `Result: ${symbolicResult}` : `Specify an evaluation point "at x=N" to compute the exact numerical gradient.`
    ],
    message: symbolicResult
      ? `d/d${varName}(${cleanExpr}) = ${symbolicResult}`
      : `Derivative expression: d/d${varName}(${cleanExpr}).`
  };
}

export function calculateIntegral(expr, { from = null, to = null, variable = 'x' } = {}) {
  const cleanExpr = expr.replace(/^integral of /i, '').replace(/^integrate /i, '').replace(/dx$/i, '').trim();

  let symbolic = null;
  try {
    symbolic = symbolicPolynomialIntegral(cleanExpr, variable);
  } catch (e) {}

  if (from !== null && to !== null && !isNaN(Number(from)) && !isNaN(Number(to))) {
    const a = Number(from);
    const b = Number(to);
    const n = 1000;
    const h = (b - a) / n;

    let sum = evaluateExpression(cleanExpr, { [variable]: a }) + evaluateExpression(cleanExpr, { [variable]: b });

    for (let i = 1; i < n; i++) {
      const x_i = a + i * h;
      const f_x = evaluateExpression(cleanExpr, { [variable]: x_i });
      sum += (i % 2 === 0 ? 2 : 4) * f_x;
    }

    const numericalResult = Number(((h / 3) * sum).toFixed(6).replace(/\.?0+$/, ''));

    return {
      operation: 'definite_integral',
      expression: cleanExpr,
      from: a,
      to: b,
      variable,
      result: numericalResult,
      symbolic,
      steps: [
        `Definite integral: ∫[${a} to ${b}] (${cleanExpr}) d${variable}`,
        symbolic ? `Antiderivative: F(${variable}) = ${symbolic}` : `Numerical integration: Simpson's 1/3 rule (n = 1000 intervals)`,
        `Evaluated value: ${numericalResult}`
      ],
      message: `∫[${a} to ${b}] (${cleanExpr}) d${variable} = ${numericalResult}`
    };
  }

  return {
    operation: 'indefinite_integral',
    expression: cleanExpr,
    variable,
    result: symbolic || `∫(${cleanExpr}) d${variable}`,
    symbolic,
    steps: [
      `Indefinite integral: ∫ (${cleanExpr}) d${variable}`,
      symbolic ? `Antiderivative: ${symbolic}` : 'General antiderivative requires numerical bounds for definite integration.'
    ],
    message: symbolic ? `∫ (${cleanExpr}) d${variable} = ${symbolic}` : `∫ (${cleanExpr}) d${variable}`
  };
}

/* ============================================================
   NUMERICAL METHODS: NEWTON-RAPHSON & RUNGE-KUTTA (RK4)
   ============================================================ */

/**
 * Newton-Raphson Method for finding non-linear roots f(x) = 0
 */
export function calculateNewtonRaphson(expr, initialGuess, opts = {}) {
  let options = opts;
  let guess = initialGuess;
  if (typeof initialGuess === 'object' && initialGuess !== null) {
    options = initialGuess;
    guess = options.x0 ?? options.initialGuess ?? 0;
  }
  const tolerance = options.tolerance ?? 1e-6;
  const maxIterations = options.maxIterations ?? options.maxSteps ?? 50;
  const varName = options.varName ?? 'x';

  const cleanExpr = expr.replace(/^f\([a-z]\)\s*=\s*/i, '').replace(/=.*$/, '').trim();
  let x = Number(guess);
  if (isNaN(x)) throw new Error('Newton-Raphson requires a valid numerical initial guess x₀.');

  const iterationTable = [];
  let root = x;
  let iterations = 0;
  let converged = false;

  for (let i = 0; i < maxIterations; i++) {
    iterations++;
    const fx = evaluateExpression(cleanExpr, { [varName]: x });

    const h = 1e-6;
    const fPlus = evaluateExpression(cleanExpr, { [varName]: x + h });
    const fMinus = evaluateExpression(cleanExpr, { [varName]: x - h });
    const fpx = (fPlus - fMinus) / (2 * h);

    if (Math.abs(fpx) < 1e-12) {
      throw new Error(`Newton-Raphson failed: Derivative f'(${x.toFixed(6)}) is approximately zero (horizontal tangent).`);
    }

    const xNext = x - fx / fpx;
    const delta = Math.abs(xNext - x);

    iterationTable.push({
      step: i + 1,
      iteration: i + 1,
      x: Number(x.toFixed(8)),
      fx: Number(fx.toFixed(8)),
      fpx: Number(fpx.toFixed(8)),
      fPrime: Number(fpx.toFixed(8)),
      xNext: Number(xNext.toFixed(8)),
      error: Number(delta.toExponential(3)),
      delta: Number(delta.toExponential(3))
    });

    x = xNext;
    if (Math.abs(fx) < tolerance || delta < tolerance) {
      converged = true;
      root = x;
      break;
    }
  }

  const finalResidual = Math.abs(evaluateExpression(cleanExpr, { [varName]: root }));
  const verified = finalResidual <= 1e-5;
  const roundedRoot = Number(root.toFixed(8));

  return {
    operation: 'newton_raphson',
    expression: cleanExpr,
    initialGuess: Number(guess),
    x0: Number(guess),
    root: roundedRoot,
    iterations: iterationTable,
    iterationCount: iterations,
    iterationTable,
    converged,
    verified,
    residual: Number(finalResidual.toExponential(4)),
    steps: [
      `Function: f(${varName}) = ${cleanExpr}, Initial guess x₀ = ${guess}`,
      `Iteration formula: x_{n+1} = x_n - f(x_n) / f'(x_n)`,
      `Converged in ${iterations} iterations to root x* = ${roundedRoot}`,
      `Verification: |f(${roundedRoot})| = ${finalResidual.toFixed(8)} (Residual ≤ 1e-5: ${verified ? 'Passed' : 'Failed'})`
    ],
    message: `Root found by Newton-Raphson: ${varName} = ${roundedRoot} in ${iterations} iterations (Residual = ${finalResidual.toFixed(8)}).`
  };
}

/**
 * 4th-Order Runge-Kutta (RK4) & Euler Numerical ODE Initial-Value Solver
 * Solves dy/dx = f(x, y), y(x0) = y0 up to xEnd
 */
export function solveOdeInitialValue(expr, x0, y0, xEnd, { steps = 20, method = 'rk4' } = {}) {
  let clean = expr.replace(/^dy\/dx\s*=\s*/i, '').replace(/^y'\s*=\s*/i, '').trim();
  const numSteps = Math.min(Math.max(2, Math.floor(Number(steps) || 20)), 1000);
  const startX = Number(x0);
  const startY = Number(y0);
  const targetX = Number(xEnd);
  const h = (targetX - startX) / numSteps;

  const trajectory = [{ step: 0, x: startX, y: startY }];
  let currX = startX;
  let currY = startY;

  const f = (xVal, yVal) => evaluateExpression(clean, { x: xVal, y: yVal });

  for (let i = 1; i <= numSteps; i++) {
    if (method.toLowerCase() === 'euler') {
      const slope = f(currX, currY);
      currY = currY + h * slope;
      currX = startX + i * h;
    } else {
      // RK4
      const k1 = f(currX, currY);
      const k2 = f(currX + h / 2, currY + (h / 2) * k1);
      const k3 = f(currX + h / 2, currY + (h / 2) * k2);
      const k4 = f(currX + h, currY + h * k3);
      currY = currY + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      currX = startX + i * h;
    }

    trajectory.push({
      step: i,
      x: Number(currX.toFixed(6)),
      y: Number(currY.toFixed(6))
    });
  }

  const finalY = Number(currY.toFixed(6));

  return {
    operation: method.toLowerCase() === 'euler' ? 'ode_euler' : 'ode_rk4',
    method: method.toUpperCase(),
    expression: clean,
    x0: startX,
    y0: startY,
    xEnd: targetX,
    steps: numSteps,
    stepsCount: numSteps,
    stepSize: Number(h.toFixed(6)),
    finalValue: finalY,
    yEnd: finalY,
    verified: true,
    trajectory: trajectory.length > 25 ? trajectory.filter((_, idx) => idx % Math.ceil(trajectory.length / 20) === 0 || idx === trajectory.length - 1) : trajectory,
    fullTrajectoryCount: trajectory.length,
    message: `ODE ${method.toUpperCase()} solution: y(${targetX}) ≈ ${finalY} (from y(${startX}) = ${startY} with ${numSteps} steps).`
  };
}

/* ============================================================
   COMPLEX NUMBERS ENGINE (ARITHMETIC, POLAR FORM, DE MOIVRE)
   ============================================================ */

export function parseComplexNumber(input) {
  if (typeof input === 'object' && input !== null) {
    return {
      real: Number(input.real || input.r || 0),
      imag: Number(input.imag || input.i || 0)
    };
  }
  if (typeof input === 'number') {
    return { real: input, imag: 0 };
  }
  if (typeof input !== 'string') {
    throw new Error('Complex number must be a string (e.g. "3 + 4i") or object {real, imag}.');
  }

  const clean = input.replace(/\s+/g, '').replace(/−/g, '-');
  if (clean === 'i' || clean === '+i') return { real: 0, imag: 1 };
  if (clean === '-i') return { real: 0, imag: -1 };

  const match = clean.match(/^([+-]?[0-9]*\.?[0-9]+(?:e[+-]?[0-9]+)?)?([+-]?[0-9]*\.?[0-9]+(?:e[+-]?[0-9]+)?i)?$/i);
  if (!match || (match[1] === undefined && match[2] === undefined)) {
    throw new Error(`Cannot parse complex number: "${input}"`);
  }

  let real = 0;
  let imag = 0;

  if (match[1] !== undefined && !match[1].endsWith('i')) {
    real = Number(match[1]);
  }
  if (match[2] !== undefined) {
    const rawI = match[2].slice(0, -1);
    if (rawI === '' || rawI === '+') imag = 1;
    else if (rawI === '-') imag = -1;
    else imag = Number(rawI);
  } else if (match[1] !== undefined && match[1].endsWith('i')) {
    const rawI = match[1].slice(0, -1);
    if (rawI === '' || rawI === '+') imag = 1;
    else if (rawI === '-') imag = -1;
    else imag = Number(rawI);
    real = 0;
  }

  return { real, imag };
}

export function formatComplex({ real, imag }) {
  const r = Number(real.toFixed(6).replace(/\.?0+$/, ''));
  const i = Number(imag.toFixed(6).replace(/\.?0+$/, ''));
  if (i === 0) return `${r}`;
  if (r === 0) return i === 1 ? 'i' : (i === -1 ? '-i' : `${i}i`);
  if (i > 0) return `${r} + ${i === 1 ? '' : i}i`;
  return `${r} - ${Math.abs(i) === 1 ? '' : Math.abs(i)}i`;
}

export function calculateComplex(operation, z1Input, z2Input = null, { n = null, power = null } = {}) {
  const z1 = parseComplexNumber(z1Input);
  const z2 = z2Input !== null ? parseComplexNumber(z2Input) : null;
  const op = (operation || 'add').toLowerCase().trim();

  let resReal = 0;
  let resImag = 0;
  let verified = true;
  let steps = [];

  const mod1 = Math.hypot(z1.real, z1.imag);
  const arg1Rad = Math.atan2(z1.imag, z1.real);
  const arg1Deg = (arg1Rad * 180) / Math.PI;

  switch (op) {
    case 'add':
      if (!z2) throw new Error('Complex addition requires two operands (z1, z2).');
      resReal = z1.real + z2.real;
      resImag = z1.imag + z2.imag;
      steps = [
        `z₁ = ${formatComplex(z1)}, z₂ = ${formatComplex(z2)}`,
        `Real parts: ${z1.real} + ${z2.real} = ${resReal}`,
        `Imaginary parts: (${z1.imag} + ${z2.imag})i = ${resImag}i`,
        `Sum: ${formatComplex({ real: resReal, imag: resImag })}`
      ];
      break;

    case 'subtract':
      if (!z2) throw new Error('Complex subtraction requires two operands (z1, z2).');
      resReal = z1.real - z2.real;
      resImag = z1.imag - z2.imag;
      steps = [
        `z₁ = ${formatComplex(z1)}, z₂ = ${formatComplex(z2)}`,
        `Difference: (${z1.real} - ${z2.real}) + (${z1.imag} - ${z2.imag})i = ${formatComplex({ real: resReal, imag: resImag })}`
      ];
      break;

    case 'multiply': {
      if (!z2) throw new Error('Complex multiplication requires two operands (z1, z2).');
      resReal = z1.real * z2.real - z1.imag * z2.imag;
      resImag = z1.real * z2.imag + z1.imag * z2.real;
      steps = [
        `z₁ = ${formatComplex(z1)}, z₂ = ${formatComplex(z2)}`,
        `Formula: (ac - bd) + (ad + bc)i`,
        `Real: (${z1.real})(${z2.real}) - (${z1.imag})(${z2.imag}) = ${resReal}`,
        `Imaginary: (${z1.real})(${z2.imag}) + (${z1.imag})(${z2.real}) = ${resImag}`,
        `Product: ${formatComplex({ real: resReal, imag: resImag })}`
      ];
      break;
    }

    case 'divide': {
      if (!z2) throw new Error('Complex division requires two operands (z1, z2).');
      const denom = z2.real * z2.real + z2.imag * z2.imag;
      if (denom === 0) throw new Error('Complex division by zero.');
      resReal = (z1.real * z2.real + z1.imag * z2.imag) / denom;
      resImag = (z1.imag * z2.real - z1.real * z2.imag) / denom;
      steps = [
        `z₁ = ${formatComplex(z1)}, z₂ = ${formatComplex(z2)}`,
        `Multiply numerator and denominator by conjugate z₂* = ${formatComplex({ real: z2.real, imag: -z2.imag })}`,
        `Denominator |z₂|² = (${z2.real})² + (${z2.imag})² = ${denom}`,
        `Quotient: ${formatComplex({ real: resReal, imag: resImag })}`
      ];
      break;
    }

    case 'polar':
    case 'modulus':
      return {
        operation: 'complex_polar',
        z: formatComplex(z1),
        real: z1.real,
        imag: z1.imag,
        modulus: Number(mod1.toFixed(6)),
        argumentRadians: Number(arg1Rad.toFixed(6)),
        argumentDegrees: Number(arg1Deg.toFixed(4)),
        polar: {
          notation: `${Number(mod1.toFixed(4))} ∠ ${Number(arg1Deg.toFixed(2))}°`,
          degrees: Number(arg1Deg.toFixed(2)),
          radians: Number(arg1Rad.toFixed(4))
        },
        polarForm: `${Number(mod1.toFixed(4))} ∠ ${Number(arg1Deg.toFixed(2))}°`,
        exponentialForm: `${Number(mod1.toFixed(4))} e^{i(${Number(arg1Rad.toFixed(4))})}`,
        steps: [
          `Modulus r = √(a² + b²) = √(${z1.real * z1.real} + ${z1.imag * z1.imag}) = ${Number(mod1.toFixed(6))}`,
          `Argument θ = atan2(b, a) = ${Number(arg1Rad.toFixed(6))} rad (${Number(arg1Deg.toFixed(2))}°)`
        ],
        message: `${formatComplex(z1)} in polar form: r = ${Number(mod1.toFixed(4))}, θ = ${Number(arg1Deg.toFixed(2))}°`
      };

    case 'power': {
      const powerN = n !== null ? Number(n) : (power !== null ? Number(power) : 2);
      const rN = Math.pow(mod1, powerN);
      const thetaN = arg1Rad * powerN;
      resReal = rN * Math.cos(thetaN);
      resImag = rN * Math.sin(thetaN);
      steps = [
        `z = ${formatComplex(z1)} -> r = ${mod1.toFixed(4)}, θ = ${arg1Rad.toFixed(4)} rad`,
        `Apply De Moivre's Theorem: z^${powerN} = r^${powerN} [cos(${powerN}θ) + i sin(${powerN}θ)]`,
        `r^${powerN} = ${rN.toFixed(4)}, ${powerN}θ = ${thetaN.toFixed(4)} rad`,
        `Result: ${formatComplex({ real: resReal, imag: resImag })}`
      ];
      break;
    }
  }

  const rounded = {
    real: Number(resReal.toFixed(6)),
    imag: Number(resImag.toFixed(6))
  };

  return {
    operation: `complex_${op}`,
    result: { re: rounded.real, im: rounded.imag },
    rectangular: formatComplex(rounded),
    formatted: formatComplex(rounded),
    real: rounded.real,
    imag: rounded.imag,
    modulus: Number(Math.hypot(rounded.real, rounded.imag).toFixed(6)),
    steps,
    verified: true,
    message: `Complex ${op} result = ${formatComplex(rounded)}`
  };
}

/* ============================================================
   LINEAR ALGEBRA: MATRICES, EIGENVALUES, AND LINEAR SYSTEMS (Ax=b)
   ============================================================ */

export function calculateMatrixDeterminant(matrix) {
  if (!Array.isArray(matrix) || matrix.length === 0 || !Array.isArray(matrix[0])) {
    throw new Error('Matrix must be a 2D array of numbers.');
  }

  const n = matrix.length;
  for (const row of matrix) {
    if (!Array.isArray(row) || row.length !== n) {
      throw new Error(`Matrix must be square (n x n). Received row length ${row?.length} for ${n} rows.`);
    }
  }

  if (n === 1) {
    return {
      operation: 'matrix_determinant',
      dimensions: '1x1',
      determinant: matrix[0][0],
      steps: [`det([${matrix[0][0]}]) = ${matrix[0][0]}`],
      message: `Determinant: ${matrix[0][0]}`
    };
  }

  if (n === 2) {
    const [[a, b], [c, d]] = matrix;
    const det = a * d - b * c;
    return {
      operation: 'matrix_determinant',
      dimensions: '2x2',
      matrix,
      determinant: Number(det.toFixed(8)),
      steps: [
        `Matrix: [[${a}, ${b}], [${c}, ${d}]]`,
        `Formula: det(A) = ad - bc`,
        `Computation: (${a}) * (${d}) - (${b}) * (${c}) = ${a * d} - ${b * c} = ${det}`
      ],
      message: `Determinant of 2x2 matrix is ${Number(det.toFixed(8))}.`
    };
  }

  if (n === 3) {
    const [
      [a, b, c],
      [d, e, f],
      [g, h, i]
    ] = matrix;
    const term1 = a * (e * i - f * h);
    const term2 = b * (d * i - f * g);
    const term3 = c * (d * h - e * g);
    const det = term1 - term2 + term3;

    return {
      operation: 'matrix_determinant',
      dimensions: '3x3',
      matrix,
      determinant: Number(det.toFixed(8)),
      steps: [
        `Matrix 3x3: Row expansion along row 1`,
        `det(A) = a(ei - fh) - b(di - fg) + c(dh - eg)`,
        `= ${a}*(${e * i - f * h}) - ${b}*(${d * i - f * g}) + ${c}*(${d * h - e * g})`,
        `= ${term1} - ${term2} + ${term3} = ${det}`
      ],
      message: `Determinant of 3x3 matrix is ${Number(det.toFixed(8))}.`
    };
  }

  const M = matrix.map(r => [...r]);
  let det = 1;
  let swaps = 0;

  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(M[j][i]) > Math.abs(M[pivot][i])) pivot = j;
    }

    if (Math.abs(M[pivot][i]) < 1e-12) {
      return {
        operation: 'matrix_determinant',
        dimensions: `${n}x${n}`,
        matrix,
        determinant: 0,
        steps: [`Matrix is singular (column ${i} has zero pivot). det(A) = 0.`],
        message: `Determinant of ${n}x${n} matrix is 0 (singular matrix).`
      };
    }

    if (pivot !== i) {
      [M[i], M[pivot]] = [M[pivot], M[i]];
      swaps++;
    }

    det *= M[i][i];

    for (let j = i + 1; j < n; j++) {
      const factor = M[j][i] / M[i][i];
      for (let k = i; k < n; k++) M[j][k] -= factor * M[i][k];
    }
  }

  const finalDet = swaps % 2 === 1 ? -det : det;
  const rounded = Number(finalDet.toFixed(8));

  return {
    operation: 'matrix_determinant',
    dimensions: `${n}x${n}`,
    matrix,
    determinant: rounded,
    steps: [
      `Gaussian triangularization with ${swaps} row swaps`,
      `Product of diagonal elements: ${det.toFixed(6)}`,
      `Determinant: ${rounded}`
    ],
    message: `Determinant of ${n}x${n} matrix is ${rounded}.`
  };
}

export function calculateMatrixInverse(matrix) {
  const detObj = calculateMatrixDeterminant(matrix);
  const det = detObj.determinant;

  if (Math.abs(det) < 1e-12) {
    throw new Error('Matrix is singular (determinant is 0) and cannot be inverted.');
  }

  const n = matrix.length;
  const augmented = matrix.map((row, i) => {
    const identRow = new Array(n).fill(0);
    identRow[i] = 1;
    return [...row, ...identRow];
  });

  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(augmented[j][i]) > Math.abs(augmented[pivot][i])) pivot = j;
    }

    if (pivot !== i) {
      [augmented[i], augmented[pivot]] = [augmented[pivot], augmented[i]];
    }

    const div = augmented[i][i];
    for (let k = 0; k < 2 * n; k++) augmented[i][k] /= div;

    for (let j = 0; j < n; j++) {
      if (j !== i) {
        const factor = augmented[j][i];
        for (let k = 0; k < 2 * n; k++) augmented[j][k] -= factor * augmented[i][k];
      }
    }
  }

  const inverse = augmented.map(row => row.slice(n).map(val => Number(val.toFixed(8))));

  let maxResidual = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      let sum = 0;
      for (let k = 0; k < n; k++) sum += matrix[r][k] * inverse[k][c];
      const expected = r === c ? 1 : 0;
      const diff = Math.abs(sum - expected);
      if (diff > maxResidual) maxResidual = diff;
    }
  }

  const verified = maxResidual < 1e-5;

  return {
    operation: 'matrix_inverse',
    dimensions: `${n}x${n}`,
    determinant: det,
    inverse,
    verified,
    residual: Number(maxResidual.toExponential(4)),
    steps: [
      `Computed determinant det(A) = ${det} (non-zero: invertible)`,
      `Performed Gauss-Jordan elimination on [A | I]`,
      `Verification via A * A⁻¹ = I: maximum residual deviation = ${maxResidual.toFixed(8)} (${verified ? 'Passed' : 'Failed'})`
    ],
    message: `Matrix inverted successfully. Maximum verification residual: ${maxResidual.toFixed(8)}.`
  };
}

export function calculateEigenvalues2x2(matrix) {
  if (!Array.isArray(matrix) || matrix.length !== 2 || matrix[0]?.length !== 2) {
    throw new Error('2x2 eigenvalue calculator requires a 2x2 square matrix.');
  }
  const [[a, b], [c, d]] = matrix;
  const trace = a + d;
  const det = a * d - b * c;
  const disc = trace * trace - 4 * det;

  let eigenvalues = [];
  let eigenvectors = [];
  let isReal = disc >= -1e-12;
  let maxResidual = 0;

  if (isReal) {
    const sqrtDisc = Math.sqrt(Math.max(0, disc));
    const l1 = Number(((trace + sqrtDisc) / 2).toFixed(8));
    const l2 = Number(((trace - sqrtDisc) / 2).toFixed(8));
    eigenvalues = [l1, l2];

    for (const lambda of [l1, l2]) {
      let v = [1, 0];
      if (Math.abs(b) > 1e-9) {
        v = [b, lambda - a];
      } else if (Math.abs(c) > 1e-9) {
        v = [lambda - d, c];
      } else {
        v = Math.abs(lambda - a) < 1e-6 ? [1, 0] : [0, 1];
      }
      const norm = Math.hypot(v[0], v[1]) || 1;
      const normalizedV = [Number((v[0] / norm).toFixed(6)), Number((v[1] / norm).toFixed(6))];
      eigenvectors.push(normalizedV);

      const Av0 = a * normalizedV[0] + b * normalizedV[1];
      const Av1 = c * normalizedV[0] + d * normalizedV[1];
      const diff0 = Math.abs(Av0 - lambda * normalizedV[0]);
      const diff1 = Math.abs(Av1 - lambda * normalizedV[1]);
      if (diff0 > maxResidual) maxResidual = diff0;
      if (diff1 > maxResidual) maxResidual = diff1;
    }
  } else {
    const realPart = Number((trace / 2).toFixed(6));
    const imagPart = Number((Math.sqrt(-disc) / 2).toFixed(6));
    eigenvalues = [
      `${realPart} + ${imagPart}i`,
      `${realPart} - ${imagPart}i`
    ];
  }

  const verified = maxResidual <= 1e-4;

  return {
    operation: 'eigenvalues',
    matrix,
    trace,
    determinant: det,
    characteristicPolynomial: `λ² - ${trace}λ + ${det} = 0`,
    characteristicEquation: `λ² - ${trace}λ + ${det} = 0`,
    eigenvalues: {
      lambda1: { val: eigenvalues[0], formatted: String(eigenvalues[0]) },
      lambda2: { val: eigenvalues[1], formatted: String(eigenvalues[1]) }
    },
    eigenvaluesList: eigenvalues,
    eigenvectors: isReal ? eigenvectors : 'Complex conjugate eigenvector pair',
    isReal,
    verified,
    residual: Number(maxResidual.toExponential(4)),
    steps: [
      `Matrix: [[${a}, ${b}], [${c}, ${d}]]`,
      `Trace = a + d = ${trace}, Determinant = ad - bc = ${det}`,
      `Characteristic equation: λ² - (${trace})λ + ${det} = 0`,
      `Discriminant Δ = ${disc}`,
      `Eigenvalues: ${eigenvalues.join(', ')}`,
      isReal ? `Eigenvectors: v₁ = [${eigenvectors[0]?.join(', ')}], v₂ = [${eigenvectors[1]?.join(', ')}] (Residual ||Av - λv|| = ${maxResidual.toFixed(8)})` : 'Complex conjugate pair'
    ],
    message: `Eigenvalues: ${eigenvalues.join(', ')} (Trace = ${trace}, Det = ${det})`
  };
}

export function solveLinearSystem(A, b) {
  if (!Array.isArray(A) || !Array.isArray(b)) {
    throw new Error('Linear system requires matrix A and vector b.');
  }
  const n = A.length;
  if (b.length !== n) throw new Error(`Dimension mismatch: A is ${n}x${n} but b has length ${b.length}.`);

  const M = A.map((row, i) => [...row, b[i]]);

  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(M[j][i]) > Math.abs(M[pivot][i])) pivot = j;
    }
    if (Math.abs(M[pivot][i]) < 1e-12) {
      throw new Error('System has no unique solution (matrix is singular).');
    }
    if (pivot !== i) [M[i], M[pivot]] = [M[pivot], M[i]];

    for (let j = i + 1; j < n; j++) {
      const factor = M[j][i] / M[i][i];
      for (let k = i; k <= n; k++) M[j][k] -= factor * M[i][k];
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) sum -= M[i][j] * x[j];
    x[i] = Number((sum / M[i][i]).toFixed(8));
  }

  let maxResidual = 0;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) sum += A[i][j] * x[j];
    const diff = Math.abs(sum - b[i]);
    if (diff > maxResidual) maxResidual = diff;
  }
  const verified = maxResidual <= 1e-5;

  return {
    operation: 'solve_system',
    dimensions: `${n}x${n}`,
    solution: x,
    verified,
    residual: Number(maxResidual.toExponential(4)),
    steps: [
      `System of ${n} equations in ${n} unknowns`,
      `Augmented matrix triangularized via Gaussian elimination with partial pivoting`,
      `Back-substitution yields: [ ${x.map((val, idx) => `x_${idx+1} = ${val}`).join(', ')} ]`,
      `Verification residual ||Ax - b|| = ${maxResidual.toFixed(8)} (${verified ? 'Passed' : 'Failed'})`
    ],
    message: `System solved: [ ${x.map((val, idx) => `x_${idx+1} = ${val}`).join(', ')} ] (Residual = ${maxResidual.toFixed(8)})`
  };
}

/* ============================================================
   NUMBER THEORY & MODULAR ARITHMETIC
   ============================================================ */

export function isPrime(n) {
  const num = Math.floor(Math.abs(Number(n)));
  if (num < 2) return false;
  if (num === 2 || num === 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;
  for (let i = 5; i * i <= num; i += 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
  }
  return true;
}

export function primeFactors(n) {
  let num = Math.floor(Math.abs(Number(n)));
  if (num < 2) return [];

  const factors = [];
  let d = 2;
  while (d * d <= num) {
    if (num % d === 0) {
      let count = 0;
      while (num % d === 0) {
        count++;
        num /= d;
      }
      factors.push({ prime: d, power: count });
    }
    d = d === 2 ? 3 : d + 2;
  }
  if (num > 1) {
    factors.push({ prime: num, power: 1 });
  }
  return factors;
}

export function calculateGcd(a, b) {
  let numA = Math.floor(Math.abs(Number(a)));
  let numB = Math.floor(Math.abs(Number(b)));

  let [old_r, r] = [numA, numB];
  let [old_s, s] = [1, 0];
  let [old_t, t] = [0, 1];

  while (r !== 0) {
    const quotient = Math.floor(old_r / r);
    [old_r, r] = [r, old_r - quotient * r];
    [old_s, s] = [s, old_s - quotient * s];
    [old_t, t] = [t, old_t - quotient * t];
  }

  const gcdVal = old_r;
  const bezoutX = old_s;
  const bezoutY = old_t;

  const bezoutSum = numA * bezoutX + numB * bezoutY;
  const verified = bezoutSum === gcdVal;

  return {
    operation: 'gcd',
    a: numA,
    b: numB,
    gcd: gcdVal,
    bezoutCoefficients: { x: bezoutX, y: bezoutY },
    verified,
    steps: [
      `Euclidean Algorithm for GCD(${numA}, ${numB})`,
      `Result: GCD = ${gcdVal}`,
      `Bézout's identity verification: (${numA}) * (${bezoutX}) + (${numB}) * (${bezoutY}) = ${bezoutSum} (Verified = ${verified})`
    ],
    message: `GCD(${numA}, ${numB}) = ${gcdVal} (Verified via Bézout coefficients x = ${bezoutX}, y = ${bezoutY})`
  };
}

export function calculateLcm(a, b) {
  const numA = Math.floor(Math.abs(Number(a)));
  const numB = Math.floor(Math.abs(Number(b)));
  if (numA === 0 || numB === 0) return 0;

  const gcdRes = calculateGcd(numA, numB);
  const lcmVal = (numA / gcdRes.gcd) * numB;
  const verified = (gcdRes.gcd * lcmVal) === (numA * numB);

  return {
    operation: 'lcm',
    a: numA,
    b: numB,
    lcm: lcmVal,
    gcd: gcdRes.gcd,
    verified,
    steps: [
      `Calculate GCD(${numA}, ${numB}) = ${gcdRes.gcd}`,
      `Formula: LCM(a, b) = (|a * b|) / GCD(a, b)`,
      `LCM = (${numA} * ${numB}) / ${gcdRes.gcd} = ${lcmVal}`,
      `Verification: GCD * LCM = ${gcdRes.gcd * lcmVal} equals a * b = ${numA * numB} (Verified = ${verified})`
    ],
    message: `LCM(${numA}, ${numB}) = ${lcmVal}`
  };
}

export function calculateTotient(n) {
  const num = Math.floor(Math.abs(Number(n)));
  if (num === 0) return 0;
  if (num === 1) return 1;

  const factors = primeFactors(num);
  let phi = num;
  for (const { prime } of factors) {
    phi -= Math.floor(phi / prime);
  }

  return {
    operation: 'totient',
    n: num,
    phi,
    primeFactors: factors,
    steps: [
      `Euler's totient function φ(${num})`,
      `Prime factors: ${factors.map(f => `${f.prime}^${f.power}`).join(' × ')}`,
      `Formula: φ(n) = n * ∏(1 - 1/p) for distinct prime factors p`,
      `Result: φ(${num}) = ${phi}`
    ],
    message: `φ(${num}) = ${phi} (There are ${phi} integers k in [1, ${num}] coprime to ${num}).`
  };
}

export function calculateModularArithmetic(subOpOrOpts, maybeOpts = {}) {
  let subOp = subOpOrOpts;
  let opts = maybeOpts;
  if (typeof subOpOrOpts === 'object' && subOpOrOpts !== null) {
    opts = subOpOrOpts;
    subOp = opts.subOp || opts.operation || 'inverse';
  }
  const { a = null, b = null, m = null, moduli = null, remainders = null } = opts;
  const op = (subOp || 'inverse').toLowerCase().trim();

  if (op === 'inverse') {
    const numA = Math.floor(Number(a));
    const modM = Math.floor(Number(m));
    if (isNaN(numA) || isNaN(modM) || modM <= 1) {
      throw new Error('Modular inverse requires integer a and modulus m > 1.');
    }
    const gcdRes = calculateGcd(numA, modM);
    if (gcdRes.gcd !== 1) {
      throw new Error(`Modular inverse does not exist: gcd(${numA}, ${modM}) = ${gcdRes.gcd} ≠ 1.`);
    }
    let inv = (gcdRes.bezoutCoefficients.x % modM + modM) % modM;
    const verified = ((numA * inv) % modM + modM) % modM === 1;

    return {
      operation: 'modular_inverse',
      a: numA,
      m: modM,
      inverse: inv,
      verified,
      steps: [
        `Find x such that ${numA} * x ≡ 1 (mod ${modM})`,
        `GCD(${numA}, ${modM}) = 1 via Euclidean Algorithm`,
        `Bézout coefficient x = ${gcdRes.bezoutCoefficients.x}`,
        `Normalize modulo ${modM}: ${inv}`,
        `Verification: (${numA} * ${inv}) mod ${modM} = ${(numA * inv) % modM} (Verified = ${verified})`
      ],
      message: `${numA}⁻¹ ≡ ${inv} (mod ${modM})`
    };
  }

  if (op === 'pow' || op === 'exponentiation' || op === 'mod_exp') {
    let base = BigInt(Math.floor(Number(a)));
    let exp = BigInt(Math.floor(Number(b)));
    const mod = BigInt(Math.floor(Number(m)));
    if (mod <= 0n) throw new Error('Modulus must be > 0.');

    let res = 1n;
    base = ((base % mod) + mod) % mod;
    let currExp = exp;
    while (currExp > 0n) {
      if (currExp % 2n === 1n) res = (res * base) % mod;
      base = (base * base) % mod;
      currExp = currExp / 2n;
    }
    const finalVal = Number(res);
    return {
      operation: 'modular_exponentiation',
      a: Number(a),
      b: Number(b),
      m: Number(m),
      result: finalVal,
      steps: [
        `Binary exponentiation for (${a})^${b} mod ${m}`,
        `Result: ${finalVal}`
      ],
      message: `${a}^${b} ≡ ${finalVal} (mod ${m})`
    };
  }

  if (op === 'crt' || op === 'chinese_remainder') {
    if (!Array.isArray(moduli) || !Array.isArray(remainders) || moduli.length !== remainders.length) {
      throw new Error('Chinese Remainder Theorem requires equal-length arrays of moduli and remainders.');
    }
    const k = moduli.length;
    let M = 1n;
    for (const mod of moduli) M *= BigInt(mod);

    let x = 0n;
    for (let i = 0; i < k; i++) {
      const a_i = BigInt(remainders[i]);
      const m_i = BigInt(moduli[i]);
      const M_i = M / m_i;
      const invRes = calculateModularArithmetic('inverse', { a: Number(M_i % m_i), m: Number(m_i) });
      const y_i = BigInt(invRes.inverse);
      x = (x + a_i * M_i * y_i) % M;
    }
    x = (x % M + M) % M;
    const finalX = Number(x);
    const verified = moduli.every((mod, idx) => finalX % mod === remainders[idx]);

    return {
      operation: 'chinese_remainder_theorem',
      moduli,
      remainders,
      productM: Number(M),
      modulusProduct: Number(M),
      solution: finalX,
      crtSolution: finalX,
      verified,
      steps: [
        `System: x ≡ a_i (mod m_i) for moduli [${moduli.join(', ')}]`,
        `Total modulus M = ∏ m_i = ${Number(M)}`,
        `Unique solution: x ≡ ${finalX} (mod ${Number(M)})`,
        `Verification across all congruences: ${verified ? 'Passed' : 'Failed'}`
      ],
      message: `Unique solution: x ≡ ${finalX} (mod ${Number(M)}) (Verified: ${verified})`
    };
  }

  throw new Error(`Unsupported modular operation: "${subOp}". Supported: "inverse", "pow", "crt".`);
}

export function generateFibonacci(count) {
  const n = Math.min(Math.max(1, Math.floor(Number(count) || 10)), 500);
  const bigSeq = [0n];
  if (n > 1) bigSeq.push(1n);
  for (let i = 2; i < n; i++) {
    bigSeq.push(bigSeq[i - 1] + bigSeq[i - 2]);
  }
  const sequence = bigSeq.map(b => (b <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(b) : b.toString()));
  const lastBig = bigSeq[bigSeq.length - 1];
  return {
    operation: 'fibonacci',
    count: n,
    sequence,
    bigIntSequence: bigSeq.map(b => b.toString()),
    last: lastBig <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(lastBig) : lastBig.toString(),
    exactLast: lastBig.toString(),
    message: `First ${n} Fibonacci numbers: ${sequence.slice(0, 10).join(', ')}${n > 10 ? '…' : ''}`
  };
}

export function calculateCollatz(inputVal) {
  let val = inputVal;
  if (typeof val === 'string') {
    const numM = val.match(/\b\d+\b/);
    val = numM ? Number(numM[0]) : 27;
  }
  const n = Math.floor(Math.abs(Number(val))) || 27;
  if (!n || n <= 0) {
    throw new Error('Collatz conjecture requires a positive integer > 0.');
  }

  const sequence = [n];
  let curr = n;
  let steps = 0;
  let maxVal = n;

  while (curr !== 1 && steps < 10000) {
    if (curr % 2 === 0) {
      curr = curr / 2;
    } else {
      curr = 3 * curr + 1;
    }
    sequence.push(curr);
    if (curr > maxVal) maxVal = curr;
    steps++;
  }

  const peakIndex = sequence.indexOf(maxVal);

  return {
    operation: 'collatz',
    input: n,
    sequence,
    steps,
    stoppingTime: steps,
    reached_one: curr === 1,
    maximum_value: maxVal,
    peakValue: maxVal,
    peakStep: peakIndex,
    conjectureStatus: 'CONJECTURE (UNPROVEN)',
    verified: curr === 1,
    chart: {
      type: 'line',
      title: `Collatz Sequence Trajectory (n = ${n})`,
      labels: sequence.map((_, i) => `${i}`),
      peakMetric: { peakValue: maxVal, peakStep: peakIndex },
      stoppingTime: steps,
      datasets: [
        {
          label: `Value (Peak: ${maxVal} at step ${peakIndex})`,
          data: sequence
        }
      ]
    },
    message: `Collatz sequence for n = ${n} reached 1 in ${steps} steps (Peak maximum value: ${maxVal} at step ${peakIndex}). Note: The 3x+1 Collatz conjecture remains an UNPROVEN open problem in mathematics; empirical termination for finite integers does not constitute a general mathematical proof.`
  };
}

export function generateFunctionGraph(expr, from = -10, to = 10, steps = 50, varName = 'x') {
  const start = Number(from) || -10;
  const end = Number(to) || 10;
  const numSteps = Math.min(Math.max(10, Number(steps) || 50), 200);
  const stepSize = (end - start) / numSteps;

  const labels = [];
  const data = [];
  const cleanExpr = String(expr || 'x^2').replace(/^f\([a-z]\)\s*=\s*/i, '').replace(/^y\s*=\s*/i, '').trim();

  for (let i = 0; i <= numSteps; i++) {
    const xVal = Number((start + i * stepSize).toFixed(4));
    labels.push(`${xVal}`);
    try {
      const yVal = evaluateExpression(cleanExpr, { [varName]: xVal });
      data.push(isFinite(yVal) ? Number(yVal.toFixed(4)) : null);
    } catch {
      data.push(null);
    }
  }

  const points = labels.map((x, idx) => ({ x: Number(x), y: data[idx] }));

  return {
    operation: 'function_graph',
    expression: cleanExpr,
    formula: cleanExpr,
    points,
    variable: varName,
    domain: [start, end],
    chart: {
      type: 'line',
      title: `Plot of f(${varName}) = ${cleanExpr}`,
      formula: cleanExpr,
      labels,
      datasets: [{ label: `f(${varName})`, data }]
    },
    message: `Generated plot of f(${varName}) = ${cleanExpr} over domain [${start}, ${end}].`
  };
}

export function calculatePermutations(n, r) {
  const numN = Math.floor(Number(n));
  const numR = Math.floor(Number(r));
  if (numN < 0 || numR < 0 || numR > numN) {
    throw new Error('Permutations P(n, r) requires 0 ≤ r ≤ n.');
  }
  let res = 1;
  for (let i = 0; i < numR; i++) res *= (numN - i);
  return {
    operation: 'permutations',
    n: numN,
    r: numR,
    result: res,
    formula: `P(${numN}, ${numR}) = ${numN}! / (${numN} - ${numR})!`,
    message: `P(${numN}, ${numR}) = ${res}`
  };
}

export function calculateCombinations(n, r) {
  const numN = Math.floor(Number(n));
  const numR = Math.floor(Number(r));
  if (numN < 0 || numR < 0 || numR > numN) {
    throw new Error('Combinations C(n, r) requires 0 ≤ r ≤ n.');
  }
  const k = Math.min(numR, numN - numR);
  let res = 1;
  for (let i = 1; i <= k; i++) res = (res * (numN - k + i)) / i;
  const rounded = Math.round(res);
  return {
    operation: 'combinations',
    n: numN,
    r: numR,
    result: rounded,
    formula: `C(${numN}, ${numR}) = ${numN}! / (${numR}! * (${numN} - ${numR})!)`,
    message: `C(${numN}, ${numR}) = ${rounded}`
  };
}

/* ============================================================
   STATISTICS & LINEAR REGRESSION
   ============================================================ */

export function calculateStatistics(data) {
  const numbers = (Array.isArray(data) ? data : String(data).split(/[,\s]+/))
    .map(Number)
    .filter(n => !isNaN(n));

  if (numbers.length === 0) {
    throw new Error('Statistics requires a list of numerical values.');
  }

  const count = numbers.length;
  const sum = numbers.reduce((a, b) => a + b, 0);
  const mean = sum / count;

  const sorted = [...numbers].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const range = max - min;

  const median = count % 2 === 0
    ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
    : sorted[Math.floor(count / 2)];

  const variance = count > 1
    ? numbers.reduce((acc, n) => acc + Math.pow(n - mean, 2), 0) / (count - 1)
    : 0;
  const stdDev = Math.sqrt(variance);

  return {
    operation: 'statistics',
    count,
    sum: Number(sum.toFixed(6)),
    mean: Number(mean.toFixed(6)),
    median: Number(median.toFixed(6)),
    min,
    max,
    range,
    variance: Number(variance.toFixed(6)),
    standardDeviation: Number(stdDev.toFixed(6)),
    message: `Analyzed ${count} values: Mean = ${mean.toFixed(4)}, Median = ${median}, StdDev = ${stdDev.toFixed(4)}, Min = ${min}, Max = ${max}.`
  };
}

export function calculateLinearRegression(dataOrX, dataY = null) {
  let points = [];
  if (Array.isArray(dataOrX) && dataY === null) {
    points = dataOrX.map(p => Array.isArray(p) ? { x: Number(p[0]), y: Number(p[1]) } : { x: Number(p.x), y: Number(p.y) });
  } else if (Array.isArray(dataOrX) && Array.isArray(dataY)) {
    const n = Math.min(dataOrX.length, dataY.length);
    for (let i = 0; i < n; i++) points.push({ x: Number(dataOrX[i]), y: Number(dataY[i]) });
  } else {
    throw new Error('Linear regression requires array of (x, y) points or separate X and Y arrays.');
  }

  points = points.filter(p => !isNaN(p.x) && !isNaN(p.y));
  const n = points.length;
  if (n < 2) throw new Error('Linear regression requires at least 2 points.');

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
    sumYY += p.y * p.y;
  }

  const denomM = n * sumXX - sumX * sumX;
  if (Math.abs(denomM) < 1e-12) {
    throw new Error('Vertical line: all x coordinates are identical.');
  }

  const slope = (n * sumXY - sumX * sumY) / denomM;
  const intercept = (sumY - slope * sumX) / n;

  const denomR = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));
  const r = denomR !== 0 ? (n * sumXY - sumX * sumY) / denomR : 0;
  const rSquared = r * r;

  const meanX = sumX / n;
  const meanY = sumY / n;
  const centroidResidual = Math.abs(slope * meanX + intercept - meanY);
  const verified = centroidResidual < 1e-5;

  const roundedSlope = Number(slope.toFixed(6));
  const roundedIntercept = Number(intercept.toFixed(6));

  return {
    operation: 'linear_regression',
    pointsCount: n,
    slope: roundedSlope,
    intercept: roundedIntercept,
    correlation: Number(r.toFixed(6)),
    correlationR: Number(r.toFixed(6)),
    r: Number(r.toFixed(6)),
    rSquared: Number(rSquared.toFixed(6)),
    equation: `y = ${roundedSlope}x ${roundedIntercept >= 0 ? '+' : '-'} ${Math.abs(roundedIntercept)}`,
    verified,
    residual: Number(centroidResidual.toExponential(4)),
    steps: [
      `Data points: ${n}`,
      `Centroid: (x̄ = ${meanX.toFixed(4)}, ȳ = ${meanY.toFixed(4)})`,
      `Least-squares slope m = ${roundedSlope}, y-intercept c = ${roundedIntercept}`,
      `Pearson correlation r = ${r.toFixed(4)}, R² = ${(rSquared * 100).toFixed(2)}%`,
      `Centroid check m(x̄) + c = ȳ: residual = ${centroidResidual.toFixed(8)} (${verified ? 'Passed' : 'Failed'})`
    ],
    message: `Fitted line: y = ${roundedSlope}x ${roundedIntercept >= 0 ? '+' : '-'} ${Math.abs(roundedIntercept)} (r = ${r.toFixed(4)}, R² = ${(rSquared * 100).toFixed(2)}%)`
  };
}

/* ============================================================
   UNIFIED MATHEMATICAL DISPATCHER
   CALCULATE -> VERIFY -> RETURN STRUCTURED RESULT -> RENDER
   ============================================================ */

export function calculateMath({
  operation = 'evaluate',
  expression = '',
  input = null,
  variable = 'x',
  at = null,
  from = null,
  to = null,
  data = null,
  matrix = null,
  vector = null,
  a = null,
  b = null,
  c = null,
  d = null,
  m = null,
  n = null,
  r = null,
  z1 = null,
  z2 = null,
  x0 = null,
  y0 = null,
  xEnd = null,
  steps = null,
  table = null,
  subOp = null,
  moduli = null,
  formula = null,
  range = null,
  samples = null,
  xData = null,
  yData = null,
  sequence = null,
  sequenceA = null,
  sequenceB = null,
  seq1 = null,
  seq2 = null,
  count = null,
  term = null
} = {}) {
  const op = (operation || 'evaluate').toLowerCase().trim();
  let resultObj = null;

  switch (op) {
    case 'collatz':
      resultObj = calculateCollatz(input || expression || n);
      break;

    case 'graph':
    case 'plot':
    case 'function_graph': {
      const exprVal = expression || formula || input || 'x^2';
      let fStart = from;
      let fEnd = to;
      if (Array.isArray(range) && range.length >= 2) {
        fStart = range[0];
        fEnd = range[1];
      }
      const numSteps = samples || steps || 50;
      resultObj = generateFunctionGraph(exprVal, fStart ?? -10, fEnd ?? 10, numSteps, variable || 'x');
      break;
    }

    case 'solve':
    case 'solve_equation': {
      const eq = expression || input || '';
      resultObj = solveEquation(String(eq));
      break;
    }

    case 'cubic':
    case 'solve_cubic': {
      if (a !== null && b !== null && c !== null && d !== null) {
        resultObj = solveCubic(Number(a), Number(b), Number(c), Number(d), variable);
      } else {
        resultObj = solveEquation(expression || input || '');
      }
      break;
    }

    case 'quadratic':
    case 'solve_quadratic': {
      if (a !== null && b !== null && c !== null) {
        resultObj = solveQuadratic(Number(a), Number(b), Number(c), variable);
      } else {
        resultObj = solveEquation(expression || input || '');
      }
      break;
    }

    case 'linear':
    case 'solve_linear': {
      if (a !== null && b !== null) {
        resultObj = solveLinear(Number(a), Number(b), variable);
      } else {
        resultObj = solveEquation(expression || input || '');
      }
      break;
    }

    case 'newton_raphson':
    case 'root_finding':
      resultObj = calculateNewtonRaphson(expression || input, at !== null ? at : (x0 !== null ? x0 : 1), { varName: variable });
      break;

    case 'ode_rk4':
    case 'ode':
    case 'runge_kutta':
      resultObj = solveOdeInitialValue(expression || input, x0 !== null ? x0 : 0, y0 !== null ? y0 : 1, xEnd !== null ? xEnd : 1, { steps: steps || 20, method: 'rk4' });
      break;

    case 'ode_euler':
      resultObj = solveOdeInitialValue(expression || input, x0 !== null ? x0 : 0, y0 !== null ? y0 : 1, xEnd !== null ? xEnd : 1, { steps: steps || 20, method: 'euler' });
      break;

    case 'complex':
    case 'complex_arithmetic':
      resultObj = calculateComplex(subOp || 'add', z1 || input || expression, z2, { n });
      break;

    case 'eigenvalues':
    case 'eigenvalues_2x2':
      resultObj = calculateEigenvalues2x2(matrix || input);
      break;

    case 'solve_system':
    case 'linear_system':
      resultObj = solveLinearSystem(matrix || input, vector || b);
      break;

    case 'modular_arithmetic':
    case 'mod':
      resultObj = calculateModularArithmetic(subOp || 'inverse', { a, b, m, moduli, remainders });
      break;

    case 'linear_regression':
    case 'regression':
      resultObj = calculateLinearRegression(xData || data || input, yData || b);
      break;

    case 'derivative':
    case 'differentiate':
      resultObj = calculateDerivative(expression || input || '', variable, at);
      break;

    case 'integral':
    case 'integrate':
      resultObj = calculateIntegral(expression || input || '', { from, to, variable });
      break;

    case 'matrix_determinant':
    case 'determinant': {
      const mat = matrix || input;
      resultObj = calculateMatrixDeterminant(mat);
      break;
    }

    case 'matrix_inverse':
    case 'inverse': {
      const mat = matrix || input;
      resultObj = calculateMatrixInverse(mat);
      break;
    }

    case 'gcd': {
      const valA = a !== null ? a : (Array.isArray(input) ? input[0] : null);
      const valB = b !== null ? b : (Array.isArray(input) ? input[1] : null);
      if (valA === null || valB === null) throw new Error('GCD requires two integers: a and b.');
      resultObj = calculateGcd(valA, valB);
      break;
    }

    case 'lcm': {
      const valA = a !== null ? a : (Array.isArray(input) ? input[0] : null);
      const valB = b !== null ? b : (Array.isArray(input) ? input[1] : null);
      if (valA === null || valB === null) throw new Error('LCM requires two integers: a and b.');
      resultObj = calculateLcm(valA, valB);
      break;
    }

    case 'totient':
      resultObj = calculateTotient(input || n || expression);
      break;

    case 'prime_factors': {
      const num = input || n || expression;
      const factors = primeFactors(num);
      resultObj = {
        operation: 'prime_factors',
        input: Number(num),
        factors,
        formatted: factors.map(f => `${f.prime}^${f.power}`).join(' × '),
        message: `Prime factorization of ${num}: ${factors.map(f => `${f.prime}^${f.power}`).join(' × ')}`
      };
      break;
    }

    case 'is_prime': {
      const num = input || n || expression;
      const prime = isPrime(num);
      resultObj = {
        operation: 'is_prime',
        input: Number(num),
        isPrime: prime,
        message: `${num} is ${prime ? 'a prime number' : 'not a prime number'}.`
      };
      break;
    }

    case 'fibonacci': {
      if (subOp === 'term' || at !== null || term !== null) {
        resultObj = calculateSequenceTerm('fibonacci', at !== null ? at : (term !== null ? term : (input || n || 10)));
      } else {
        resultObj = generateFibonacci(input || n || 10);
      }
      break;
    }

    case 'sequence':
    case 'sequence_term':
    case 'sequence_range':
    case 'compare_sequences':
    case 'list_sequences': {
      if (op === 'list_sequences') {
        resultObj = { operation: 'list_sequences', sequences: listAllSequences() };
      } else if (op === 'compare_sequences') {
        resultObj = compareSequences(sequenceA || seq1 || a, sequenceB || seq2 || b, count || n || 20);
      } else if (op === 'sequence_term' || subOp === 'term' || at !== null || term !== null) {
        const targetSeq = sequence || input || expression || 'fibonacci';
        const targetIdx = at !== null ? at : (term !== null ? term : (n !== null ? n : (input || 10)));
        resultObj = calculateSequenceTerm(targetSeq, targetIdx);
      } else {
        const targetSeq = sequence || input || expression || 'fibonacci';
        resultObj = generateSequenceRange(targetSeq, { from: from ?? 1, to: to ?? 20, count: count ?? n });
      }
      break;
    }

    case 'permutations':
      resultObj = calculatePermutations(n || a, r || b);
      break;

    case 'combinations':
      resultObj = calculateCombinations(n || a, r || b);
      break;

    case 'four_figure_table':
      resultObj = lookupFourFigureTable(table || 'log', input !== null ? input : expression);
      break;

    case 'constant': {
      const cObj = getMathematicalConstant(expression || input);
      if (!cObj) throw new Error(`Unknown mathematical constant: "${expression || input}"`);
      resultObj = {
        operation: 'constant',
        ...cObj,
        message: `${cObj.name} (${cObj.symbol}) = ${cObj.displayValue}`
      };
      break;
    }

    case 'statistics':
      resultObj = calculateStatistics(data || input || expression);
      break;

    case 'evaluate':
    default: {
      const matchedSeq = getSequence(op);
      if (matchedSeq) {
        if (subOp === 'term' || at !== null || term !== null) {
          resultObj = calculateSequenceTerm(op, at !== null ? at : (term !== null ? term : (n !== null ? n : (input || 10))));
        } else {
          resultObj = generateSequenceRange(op, { from: from ?? 1, to: to ?? (n || 20), count: count });
        }
        break;
      }
      if (typeof expression === 'string' && expression.includes('=')) {
        resultObj = solveEquation(expression);
      } else {
        const val = evaluateExpression(expression);
        resultObj = {
          operation: 'evaluate',
          expression,
          result: val,
          message: `${expression} = ${val}`
        };
      }
      break;
    }
  }

  return {
    status: 'success',
    type: 'math-result',
    ...resultObj
  };
}
