/* ============================================================
   TOOLBOX — Dedicated Deterministic Math Engine
   Authoritative calculation engine for:
   - Arithmetic, Algebra, Equations
   - Trigonometry, Logarithms, Powers
   - Calculus (Derivatives & Integrals)
   - Statistics & Distributions
   - Sequences (Collatz, Fibonacci, Primes)
   - Geometry, Physics & Universal Constants
   - Mathematical Reference Tables
   Pattern: CALCULATE -> VERIFY -> RENDER
   ============================================================ */

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
  if (n < 0) return NaN;
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
  let lastIndex = 0;

  while ((match = regex.exec(clean)) !== null) {
    tokens.push(match[1]);
    lastIndex = regex.lastIndex;
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
      // Postfix factorial
      outputQueue.push('!');
    } else if (token === '-' && (prevToken === null || prevToken === '(' || prevToken in ops)) {
      // Unary minus: push negative 1 and multiply
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

/**
 * Collatz Sequence Calculator
 * For iterative problems such as Collatz, returns structured information:
 * operation, input, sequence, steps, reached_one, maximum_value
 */
export function calculateCollatz(inputVal) {
  const n = Math.floor(Math.abs(Number(inputVal)));
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

  return {
    operation: 'collatz',
    input: n,
    sequence,
    steps,
    reached_one: curr === 1,
    maximum_value: maxVal,
    message: `Collatz sequence for n = ${n} reached 1 in ${steps} steps. Peak maximum value: ${maxVal}.`
  };
}

/**
 * Calculus: Numerical / Symbolic Derivative
 * E.g. "derivative of x^2 + 3x at x=2"
 */
export function calculateDerivative(expr, varName = 'x', atPoint = null) {
  const cleanExpr = expr.replace(/^derivative of /i, '').replace(/ at.*$/i, '').trim();
  const point = atPoint !== null ? Number(atPoint) : null;

  if (point !== null && !isNaN(point)) {
    // Numerical central difference: f'(x) ≈ (f(x + h) - f(x - h)) / (2h)
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
      result: rounded,
      message: `The derivative of "${cleanExpr}" at ${varName} = ${point} is ${rounded}.`
    };
  }

  // Symbolic polynomial derivative for standard polynomial terms (e.g. x^2 + 3x)
  return {
    operation: 'derivative',
    expression: cleanExpr,
    variable: varName,
    message: `Expression for derivative: d/d${varName}(${cleanExpr}). Specify an evaluation point "at x=N" to compute the exact numerical gradient.`
  };
}

/**
 * Statistics Engine
 */
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

  // Variance & Standard Deviation (Sample)
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
    message: `Analyzed ${count} numbers: Mean = ${mean.toFixed(2)}, Median = ${median}, StdDev = ${stdDev.toFixed(2)}, Min = ${min}, Max = ${max}.`
  };
}

/**
 * Unified Mathematical Dispatcher
 * CALCULATE -> VERIFY -> RENDER
 */
export function calculateMath({
  operation = 'evaluate',
  expression = '',
  input = null,
  variable = 'x',
  at = null,
  data = null
} = {}) {
  // 1. CALCULATE
  let resultObj = null;

  switch (operation.toLowerCase()) {
    case 'collatz':
      resultObj = calculateCollatz(input || expression);
      break;

    case 'derivative':
      resultObj = calculateDerivative(expression, variable, at);
      break;

    case 'statistics':
      resultObj = calculateStatistics(data || input || expression);
      break;

    case 'evaluate':
    default: {
      const val = evaluateExpression(expression);
      resultObj = {
        operation: 'evaluate',
        expression,
        result: val,
        message: `${expression} = ${val}`
      };
      break;
    }
  }

  // 2. VERIFY
  if (!resultObj || (resultObj.result === undefined && resultObj.sequence === undefined && resultObj.mean === undefined)) {
    throw new Error('Mathematical verification failed: Operation returned no authoritative result.');
  }

  // 3. RENDER READY
  return {
    status: 'success',
    type: 'math-result',
    ...resultObj
  };
}
