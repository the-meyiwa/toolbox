/* ============================================================
   TOOLBOX — Deterministic Mathematical Sequences Engine
   50+ practical mathematical sequences with arbitrary-precision
   BigInt arithmetic, range generators, recurrence relations,
   properties, Collatz trajectory metrics, comparisons, and chart data.
   ============================================================ */

/**
 * Clean BigInt formatting for large numbers
 * @param {bigint|number} val
 * @param {number} maxDigits
 * @returns {string}
 */
export function formatSequenceValue(val, maxDigits = 25) {
  if (typeof val === 'bigint') {
    const s = val.toString();
    if (s.length > maxDigits) {
      return `${s.slice(0, 10)}…${s.slice(-6)} (${s.length} digits)`;
    }
    return s;
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val) && Math.abs(val) < Number.MAX_SAFE_INTEGER) {
      return val.toString();
    }
    return val.toLocaleString('en-US', { maximumFractionDigits: 6 });
  }
  return String(val);
}

// ------------------------------------------------------------
// COMBINATORICS HELPERS (BigInt)
// ------------------------------------------------------------

export function bigIntFactorial(n) {
  if (n < 0) throw new Error('Factorial requires non-negative integer.');
  let res = 1n;
  for (let i = 2n; i <= BigInt(n); i++) {
    res *= i;
  }
  return res;
}

export function bigIntBinomial(n, k) {
  if (k < 0 || k > n) return 0n;
  if (k === 0 || k === n) return 1n;
  let c = 1n;
  const kBig = BigInt(Math.min(k, n - k));
  const nBig = BigInt(n);
  for (let i = 1n; i <= kBig; i++) {
    c = (c * (nBig - i + 1n)) / i;
  }
  return c;
}

// ------------------------------------------------------------
// SEQUENCE REGISTRY
// ------------------------------------------------------------

export const SEQUENCES = {};

function registerSequence(def) {
  SEQUENCES[def.id] = def;
  if (def.aliases) {
    for (const a of def.aliases) {
      SEQUENCES[a] = def;
    }
  }
}

// 1. ARITHMETIC PROGRESSION
registerSequence({
  id: 'arithmetic',
  aliases: ['ap', 'arithmetic_progression'],
  name: 'Arithmetic Progression',
  category: 'progressions',
  definition: 'A sequence where each term differs from the previous by a constant difference d.',
  recurrence: 'a_n = a_1 + (n - 1)d',
  properties: [
    'Sum of first n terms: S_n = n/2 * (2a + (n - 1)d)',
    'Common difference: d = a_n - a_{n-1}'
  ],
  initialTerms: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19],
  getTerm: (n, { a = 1, d = 2 } = {}) => {
    const idx = BigInt(n);
    return BigInt(a) + (idx - 1n) * BigInt(d);
  },
  generate: (count, { a = 1, d = 2 } = {}) => {
    const terms = [];
    const bigA = BigInt(a);
    const bigD = BigInt(d);
    for (let i = 1n; i <= BigInt(count); i++) {
      terms.push(bigA + (i - 1n) * bigD);
    }
    return terms;
  }
});

// 2. GEOMETRIC PROGRESSION
registerSequence({
  id: 'geometric',
  aliases: ['gp', 'geometric_progression'],
  name: 'Geometric Progression',
  category: 'progressions',
  definition: 'A sequence where each term is found by multiplying the previous by a common ratio r.',
  recurrence: 'a_n = a * r^(n - 1)',
  properties: [
    'Sum of first n terms: S_n = a(1 - r^n)/(1 - r) for r ≠ 1',
    'Infinite sum for |r| < 1: S = a / (1 - r)'
  ],
  initialTerms: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512],
  getTerm: (n, { a = 1, r = 2 } = {}) => {
    const bigA = BigInt(a);
    const bigR = BigInt(r);
    const p = BigInt(n - 1);
    return bigA * (bigR ** p);
  },
  generate: (count, { a = 1, r = 2 } = {}) => {
    const terms = [];
    let cur = BigInt(a);
    const bigR = BigInt(r);
    for (let i = 0; i < count; i++) {
      terms.push(cur);
      cur *= bigR;
    }
    return terms;
  }
});

// 3. HARMONIC PROGRESSION
registerSequence({
  id: 'harmonic_progression',
  aliases: ['hp'],
  name: 'Harmonic Progression',
  category: 'progressions',
  definition: 'A sequence formed by taking the reciprocals of an arithmetic progression.',
  recurrence: 'a_n = 1 / (a + (n - 1)d)',
  properties: [
    'No harmonic progression of integers exists for n > 1',
    'Associated with musical pitch ratios and wavelengths'
  ],
  initialTerms: ['1', '1/2', '1/3', '1/4', '1/5', '1/6', '1/7', '1/8', '1/9', '1/10'],
  getTerm: (n, { a = 1, d = 1 } = {}) => {
    const denom = a + (n - 1) * d;
    return `1/${denom}`;
  },
  generate: (count, { a = 1, d = 1 } = {}) => {
    const terms = [];
    for (let i = 1; i <= count; i++) {
      const denom = a + (i - 1) * d;
      terms.push(`1/${denom}`);
    }
    return terms;
  }
});

// 4. FIBONACCI
registerSequence({
  id: 'fibonacci',
  aliases: ['fib'],
  name: 'Fibonacci Sequence',
  category: 'recurrence',
  definition: 'Sequence where each number is the sum of the two preceding ones, starting from 0 and 1.',
  recurrence: 'F_0 = 0, F_1 = 1, F_n = F_{n-1} + F_{n-2}',
  properties: [
    "Cassini's identity: F_{n-1}*F_{n+1} - F_n^2 = (-1)^n",
    'Binet formula: F_n = (phi^n - psi^n) / sqrt(5)',
    'Limit ratio: lim(F_{n+1}/F_n) = phi ≈ 1.6180339887'
  ],
  initialTerms: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55],
  getTerm: (n) => {
    if (n <= 0) return 0n;
    if (n === 1) return 1n;
    let a = 0n, b = 1n;
    for (let i = 2; i <= n; i++) {
      const next = a + b;
      a = b;
      b = next;
    }
    return b;
  },
  generate: (count) => {
    const terms = [];
    let a = 0n, b = 1n;
    for (let i = 0; i < count; i++) {
      terms.push(a);
      const next = a + b;
      a = b;
      b = next;
    }
    return terms;
  }
});

// 5. LUCAS NUMBERS
registerSequence({
  id: 'lucas',
  aliases: ['lucas_numbers'],
  name: 'Lucas Numbers',
  category: 'recurrence',
  definition: 'Companion sequence to Fibonacci with the same recurrence relation but starting with 2 and 1.',
  recurrence: 'L_0 = 2, L_1 = 1, L_n = L_{n-1} + L_{n-2}',
  properties: [
    'Connection to Fibonacci: L_n = F_{n-1} + F_{n+1}',
    'L_n^2 - 5*F_n^2 = 4*(-1)^n',
    'Limit ratio: lim(L_{n+1}/L_n) = phi'
  ],
  initialTerms: [2, 1, 3, 4, 7, 11, 18, 29, 47, 76, 123],
  getTerm: (n) => {
    if (n <= 0) return 2n;
    if (n === 1) return 1n;
    let a = 2n, b = 1n;
    for (let i = 2; i <= n; i++) {
      const next = a + b;
      a = b;
      b = next;
    }
    return b;
  },
  generate: (count) => {
    const terms = [];
    let a = 2n, b = 1n;
    for (let i = 0; i < count; i++) {
      terms.push(a);
      const next = a + b;
      a = b;
      b = next;
    }
    return terms;
  }
});

// 6. PELL NUMBERS
registerSequence({
  id: 'pell',
  aliases: ['pell_numbers'],
  name: 'Pell Numbers',
  category: 'recurrence',
  definition: 'Recurrence sequence denominator of continued fraction convergents to sqrt(2).',
  recurrence: 'P_0 = 0, P_1 = 1, P_n = 2*P_{n-1} + P_{n-2}',
  properties: [
    'Convergents to sqrt(2): Q_n / P_n -> sqrt(2)',
    'Companion sequence: Pell-Lucas numbers'
  ],
  initialTerms: [0, 1, 2, 5, 12, 29, 70, 169, 408, 985],
  getTerm: (n) => {
    if (n <= 0) return 0n;
    if (n === 1) return 1n;
    let a = 0n, b = 1n;
    for (let i = 2; i <= n; i++) {
      const next = 2n * b + a;
      a = b;
      b = next;
    }
    return b;
  },
  generate: (count) => {
    const terms = [];
    let a = 0n, b = 1n;
    for (let i = 0; i < count; i++) {
      terms.push(a);
      const next = 2n * b + a;
      a = b;
      b = next;
    }
    return terms;
  }
});

// 7. PELL-LUCAS NUMBERS
registerSequence({
  id: 'pell_lucas',
  aliases: ['pell-lucas', 'companion_pell'],
  name: 'Pell-Lucas Numbers',
  category: 'recurrence',
  definition: 'Companion sequence to the Pell numbers with initial terms 2, 2.',
  recurrence: 'Q_0 = 2, Q_1 = 2, Q_n = 2*Q_{n-1} + Q_{n-2}',
  properties: [
    'Q_n^2 - 8*P_n^2 = 4*(-1)^n',
    'Convergents: Q_n / (2*P_n) ≈ sqrt(2)'
  ],
  initialTerms: [2, 2, 6, 14, 34, 82, 198, 478, 1154, 2786],
  getTerm: (n) => {
    if (n <= 0) return 2n;
    if (n === 1) return 2n;
    let a = 2n, b = 2n;
    for (let i = 2; i <= n; i++) {
      const next = 2n * b + a;
      a = b;
      b = next;
    }
    return b;
  },
  generate: (count) => {
    const terms = [];
    let a = 2n, b = 2n;
    for (let i = 0; i < count; i++) {
      terms.push(a);
      const next = 2n * b + a;
      a = b;
      b = next;
    }
    return terms;
  }
});

// 8. JACOBSTHAL NUMBERS
registerSequence({
  id: 'jacobsthal',
  name: 'Jacobsthal Numbers',
  category: 'recurrence',
  definition: 'Sequence defined by J_n = J_{n-1} + 2*J_{n-2}, starting from 0 and 1.',
  recurrence: 'J_0 = 0, J_1 = 1, J_n = J_{n-1} + 2*J_{n-2}',
  properties: [
    'Closed formula: J_n = (2^n - (-1)^n) / 3',
    'J_{n+1} + J_n = 2^n'
  ],
  initialTerms: [0, 1, 1, 3, 5, 11, 21, 43, 85, 171, 341],
  getTerm: (n) => {
    if (n <= 0) return 0n;
    const p = BigInt(n);
    const sign = n % 2 === 0 ? 1n : -1n;
    return ((2n ** p) - sign) / 3n;
  },
  generate: (count) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(SEQUENCES.jacobsthal.getTerm(i));
    }
    return terms;
  }
});

// 9. TRIBONACCI NUMBERS
registerSequence({
  id: 'tribonacci',
  name: 'Tribonacci Numbers',
  category: 'recurrence',
  definition: 'Generalization of Fibonacci numbers where each term is the sum of the preceding three terms.',
  recurrence: 'T_0 = 0, T_1 = 0, T_2 = 1, T_n = T_{n-1} + T_{n-2} + T_{n-3}',
  properties: [
    'Tribonacci constant: ratio approaches ≈ 1.839286755',
    'Roots of x^3 - x^2 - x - 1 = 0'
  ],
  initialTerms: [0, 0, 1, 1, 2, 4, 7, 13, 24, 44, 81, 149],
  getTerm: (n) => {
    if (n <= 1) return 0n;
    if (n === 2) return 1n;
    let a = 0n, b = 0n, c = 1n;
    for (let i = 3; i <= n; i++) {
      const next = a + b + c;
      a = b;
      b = c;
      c = next;
    }
    return c;
  },
  generate: (count) => {
    const terms = [];
    let a = 0n, b = 0n, c = 1n;
    for (let i = 0; i < count; i++) {
      if (i === 0) terms.push(0n);
      else if (i === 1) terms.push(0n);
      else if (i === 2) terms.push(1n);
      else {
        const next = a + b + c;
        terms.push(next);
        a = b;
        b = c;
        c = next;
      }
    }
    return terms;
  }
});

// 10. TETRANACCI NUMBERS
registerSequence({
  id: 'tetranacci',
  name: 'Tetranacci Numbers',
  category: 'recurrence',
  definition: '4-step Fibonacci sequence where each term is the sum of the four preceding terms.',
  recurrence: 'T_n = T_{n-1} + T_{n-2} + T_{n-3} + T_{n-4}, starting with 0, 0, 0, 1',
  properties: [
    'Ratio approaches positive root of x^4 - x^3 - x^2 - x - 1 = 0 (≈ 1.92756)'
  ],
  initialTerms: [0, 0, 0, 1, 1, 2, 4, 8, 15, 29, 56, 108],
  getTerm: (n) => {
    if (n <= 2) return 0n;
    if (n === 3) return 1n;
    let a = 0n, b = 0n, c = 0n, d = 1n;
    for (let i = 4; i <= n; i++) {
      const next = a + b + c + d;
      a = b; b = c; c = d; d = next;
    }
    return d;
  },
  generate: (count) => {
    const terms = [];
    let a = 0n, b = 0n, c = 0n, d = 1n;
    for (let i = 0; i < count; i++) {
      if (i <= 2) terms.push(0n);
      else if (i === 3) terms.push(1n);
      else {
        const next = a + b + c + d;
        terms.push(next);
        a = b; b = c; c = d; d = next;
      }
    }
    return terms;
  }
});

// 11. PADOVAN SEQUENCE
registerSequence({
  id: 'padovan',
  name: 'Padovan Sequence',
  category: 'recurrence',
  definition: 'Sequence defined by P_n = P_{n-2} + P_{n-3} with initial values 1, 1, 1.',
  recurrence: 'P_0 = 1, P_1 = 1, P_2 = 1, P_n = P_{n-2} + P_{n-3}',
  properties: [
    'Plastic ratio: lim(P_{n+1}/P_n) = rho ≈ 1.324717957',
    'Root of x^3 - x - 1 = 0'
  ],
  initialTerms: [1, 1, 1, 2, 2, 3, 4, 5, 7, 9, 12, 16],
  getTerm: (n) => {
    if (n <= 2) return 1n;
    let a = 1n, b = 1n, c = 1n;
    for (let i = 3; i <= n; i++) {
      const next = a + b;
      a = b;
      b = c;
      c = next;
    }
    return c;
  },
  generate: (count) => {
    const terms = [];
    let a = 1n, b = 1n, c = 1n;
    for (let i = 0; i < count; i++) {
      if (i <= 2) terms.push(1n);
      else {
        const next = a + b;
        terms.push(next);
        a = b; b = c; c = next;
      }
    }
    return terms;
  }
});

// 12. PERRIN SEQUENCE
registerSequence({
  id: 'perrin',
  name: 'Perrin Sequence',
  category: 'recurrence',
  definition: 'Linear recurrence sequence with initial values 3, 0, 2 and recurrence P_n = P_{n-2} + P_{n-3}.',
  recurrence: 'P_0 = 3, P_1 = 0, P_2 = 2, P_n = P_{n-2} + P_{n-3}',
  properties: [
    'Perrin pseudoprimes: if p is prime, p divides P_p',
    'Ratio approaches the plastic constant rho ≈ 1.324718'
  ],
  initialTerms: [3, 0, 2, 3, 2, 5, 5, 7, 10, 12, 17, 22],
  getTerm: (n) => {
    if (n === 0) return 3n;
    if (n === 1) return 0n;
    if (n === 2) return 2n;
    let a = 3n, b = 0n, c = 2n;
    for (let i = 3; i <= n; i++) {
      const next = a + b;
      a = b; b = c; c = next;
    }
    return c;
  },
  generate: (count) => {
    const terms = [];
    let a = 3n, b = 0n, c = 2n;
    for (let i = 0; i < count; i++) {
      if (i === 0) terms.push(3n);
      else if (i === 1) terms.push(0n);
      else if (i === 2) terms.push(2n);
      else {
        const next = a + b;
        terms.push(next);
        a = b; b = c; c = next;
      }
    }
    return terms;
  }
});

// 13. CATALAN NUMBERS
registerSequence({
  id: 'catalan',
  aliases: ['catalan_numbers'],
  name: 'Catalan Numbers',
  category: 'combinatorics',
  definition: 'Sequence of natural numbers appearing in counting problems, such as valid parenthesizations and binary trees.',
  recurrence: 'C_n = (2n)! / ((n + 1)! * n!) = (1 / (n + 1)) * (2n choose n)',
  properties: [
    'Counts number of Dyck words of length 2n',
    'Counts number of full binary trees with n + 1 leaves',
    'Recurrence: C_{n+1} = sum(C_i * C_{n-i}) from i=0 to n'
  ],
  initialTerms: [1, 1, 2, 5, 14, 42, 132, 429, 1430, 4862, 16796],
  getTerm: (n) => {
    if (n < 0) return 0n;
    return bigIntBinomial(2 * n, n) / BigInt(n + 1);
  },
  generate: (count) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(SEQUENCES.catalan.getTerm(i));
    }
    return terms;
  }
});

// 14. BELL NUMBERS
registerSequence({
  id: 'bell',
  aliases: ['bell_numbers'],
  name: 'Bell Numbers',
  category: 'combinatorics',
  definition: 'The number of partitions of a set of n elements.',
  recurrence: 'B_{n+1} = sum_{k=0}^n (n choose k) * B_k, with B_0 = 1',
  properties: [
    "Generated via the Bell triangle (Aitken's array)",
    'Dobinski formula: B_n = (1/e) * sum_{k=0}^infty (k^n / k!)'
  ],
  initialTerms: [1, 1, 2, 5, 15, 52, 203, 877, 4140, 21147, 115975],
  getTerm: (n) => {
    if (n <= 0) return 1n;
    // Bell triangle
    let row = [1n];
    for (let i = 1; i <= n; i++) {
      const nextRow = [row[row.length - 1]];
      for (let j = 0; j < i; j++) {
        nextRow.push(nextRow[j] + row[j]);
      }
      row = nextRow;
    }
    return row[0];
  },
  generate: (count) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(SEQUENCES.bell.getTerm(i));
    }
    return terms;
  }
});

// 15. MOTZKIN NUMBERS
registerSequence({
  id: 'motzkin',
  name: 'Motzkin Numbers',
  category: 'combinatorics',
  definition: 'Number of different ways of drawing non-intersecting chords between n points on a circle.',
  recurrence: 'M_n = M_{n-1} + sum_{k=0}^{n-2} M_k * M_{n-2-k}',
  properties: [
    'Counts Motzkin paths (paths from (0,0) to (n,0) never falling below y=0 with steps (1,1), (1,-1), (1,0))'
  ],
  initialTerms: [1, 1, 2, 4, 9, 21, 51, 127, 323, 835, 2188],
  getTerm: (n) => {
    if (n <= 1) return 1n;
    const m = [1n, 1n];
    for (let i = 2; i <= n; i++) {
      let term = m[i - 1];
      let sum = 0n;
      for (let k = 0; k <= i - 2; k++) {
        sum += m[k] * m[i - 2 - k];
      }
      m.push(term + sum);
    }
    return m[n];
  },
  generate: (count) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(SEQUENCES.motzkin.getTerm(i));
    }
    return terms;
  }
});

// 16. CENTRAL DELANNOY NUMBERS
registerSequence({
  id: 'delannoy',
  name: 'Central Delannoy Numbers',
  category: 'combinatorics',
  definition: 'Number of paths from (0,0) to (n,n) using steps (1,0), (0,1), and (1,1).',
  recurrence: 'D(n) = D(n-1) + 2*sum_{k=0}^{n-1} ... or D(m,n) = D(m-1,n) + D(m,n-1) + D(m-1,n-1)',
  properties: [
    'Formula: D(n) = sum_{k=0}^n (n choose k) * (n+k choose k)'
  ],
  initialTerms: [1, 3, 13, 63, 321, 1683, 8989, 48639, 265729],
  getTerm: (n) => {
    let sum = 0n;
    for (let k = 0; k <= n; k++) {
      sum += bigIntBinomial(n, k) * bigIntBinomial(n + k, k);
    }
    return sum;
  },
  generate: (count) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(SEQUENCES.delannoy.getTerm(i));
    }
    return terms;
  }
});

// 17. NARAYANA NUMBERS
registerSequence({
  id: 'narayana',
  name: 'Narayana Numbers',
  category: 'combinatorics',
  definition: 'Refinement of Catalan numbers: N(n, k) = (1/n) * (n choose k) * (n choose k-1). Returns sum/distribution.',
  recurrence: 'sum_{k=1}^n N(n, k) = C_n (Catalan number)',
  properties: [
    'Forms a symmetric polynomial for each n',
    'Counts Dyck paths with exactly k peaks'
  ],
  initialTerms: [1, 1, 2, 5, 14, 42, 132, 429, 1430],
  getTerm: (n) => SEQUENCES.catalan.getTerm(n),
  generate: (count) => SEQUENCES.catalan.generate(count)
});

// 18. DERANGEMENTS (SUBFACTORIALS)
registerSequence({
  id: 'derangements',
  aliases: ['subfactorials'],
  name: 'Derangement Numbers (Subfactorials)',
  category: 'combinatorics',
  definition: 'Number of permutations of n elements in which no element appears in its original position.',
  recurrence: '!n = (n - 1) * (!(n - 1) + !(n - 2)), with !0 = 1, !1 = 0',
  properties: [
    'Closed formula: !n = round(n! / e)',
    'Probability of a derangement approaches 1/e ≈ 0.367879'
  ],
  initialTerms: [1, 0, 1, 2, 9, 44, 265, 1854, 14833, 133496, 1334961],
  getTerm: (n) => {
    if (n <= 0) return 1n;
    if (n === 1) return 0n;
    let d0 = 1n, d1 = 0n;
    for (let i = 2; i <= n; i++) {
      const next = BigInt(i - 1) * (d1 + d0);
      d0 = d1;
      d1 = next;
    }
    return d1;
  },
  generate: (count) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(SEQUENCES.derangements.getTerm(i));
    }
    return terms;
  }
});

// 19. PARTITION NUMBERS
registerSequence({
  id: 'partitions',
  aliases: ['partition_numbers'],
  name: 'Partition Numbers',
  category: 'number_theory',
  definition: 'The number of possible partitions of a non-negative integer n into sums of positive integers.',
  recurrence: "Euler's Pentagonal Theorem: p(n) = sum_{k != 0} (-1)^{k-1} * p(n - k(3k-1)/2)",
  properties: [
    'Hardy-Ramanujan asymptotic formula: p(n) ~ exp(pi * sqrt(2n/3)) / (4n * sqrt(3))',
    'Ramanujan congruences: p(5k+4) = 0 mod 5, p(7k+5) = 0 mod 7, p(11k+6) = 0 mod 11'
  ],
  initialTerms: [1, 1, 2, 3, 5, 7, 11, 15, 22, 30, 42, 56, 77],
  getTerm: (n) => {
    if (n < 0) return 0n;
    if (n === 0) return 1n;
    const p = [1n];
    for (let i = 1; i <= n; i++) {
      let total = 0n;
      let k = 1;
      while (true) {
        // Pentagonal numbers: g1 = k(3k-1)/2, g2 = k(3k+1)/2
        const g1 = (k * (3 * k - 1)) / 2;
        const g2 = (k * (3 * k + 1)) / 2;
        const sign = k % 2 === 1 ? 1n : -1n;
        let contributed = false;
        if (i - g1 >= 0) {
          total += sign * p[i - g1];
          contributed = true;
        }
        if (i - g2 >= 0) {
          total += sign * p[i - g2];
          contributed = true;
        }
        if (!contributed) break;
        k++;
      }
      p.push(total);
    }
    return p[n];
  },
  generate: (count) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(SEQUENCES.partitions.getTerm(i));
    }
    return terms;
  }
});

// 20. TRIANGULAR NUMBERS
registerSequence({
  id: 'triangular',
  aliases: ['triangular_numbers'],
  name: 'Triangular Numbers',
  category: 'figurate',
  definition: 'Numbers that can form an equilateral triangle: T_n = n(n + 1)/2.',
  recurrence: 'T_n = T_{n-1} + n, with T_0 = 0',
  properties: [
    'Sum of two consecutive triangular numbers is a square: T_{n-1} + T_n = n^2',
    'Gauss Eureka theorem: every integer is the sum of at most 3 triangular numbers'
  ],
  initialTerms: [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66],
  getTerm: (n) => {
    const idx = BigInt(n);
    return (idx * (idx + 1n)) / 2n;
  },
  generate: (count) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(SEQUENCES.triangular.getTerm(i));
    }
    return terms;
  }
});

// 21. SQUARE NUMBERS
registerSequence({
  id: 'squares',
  aliases: ['square_numbers'],
  name: 'Square Numbers',
  category: 'figurate',
  definition: 'Integers of the form n^2.',
  recurrence: 'S_n = S_{n-1} + (2n - 1)',
  properties: [
    'Sum of first n odd integers is n^2',
    "Lagrange's four-square theorem: every natural number is the sum of four squares"
  ],
  initialTerms: [0, 1, 4, 9, 16, 25, 36, 49, 64, 81, 100],
  getTerm: (n) => {
    const idx = BigInt(n);
    return idx * idx;
  },
  generate: (count) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(SEQUENCES.squares.getTerm(i));
    }
    return terms;
  }
});

// 22. CUBE NUMBERS
registerSequence({
  id: 'cubes',
  aliases: ['cube_numbers'],
  name: 'Cube Numbers',
  category: 'figurate',
  definition: 'Integers of the form n^3.',
  recurrence: 'C_n = n^3',
  properties: [
    'Nicomachus theorem: 1^3 + 2^3 + ... + n^3 = (1 + 2 + ... + n)^2 = T_n^2'
  ],
  initialTerms: [0, 1, 8, 27, 64, 125, 216, 343, 512, 729, 1000],
  getTerm: (n) => {
    const idx = BigInt(n);
    return idx * idx * idx;
  },
  generate: (count) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(SEQUENCES.cubes.getTerm(i));
    }
    return terms;
  }
});

// 23. TETRAHEDRAL NUMBERS
registerSequence({
  id: 'tetrahedral',
  name: 'Tetrahedral Numbers',
  category: 'figurate',
  definition: 'Figurate numbers representing a pyramid with a triangular base: Te_n = n(n+1)(n+2)/6.',
  recurrence: 'Te_n = Te_{n-1} + T_n',
  properties: [
    'Sum of the first n triangular numbers',
    'Appears in the 4th column of Pascal triangle'
  ],
  initialTerms: [0, 1, 4, 10, 20, 35, 56, 84, 120, 165, 220],
  getTerm: (n) => {
    const idx = BigInt(n);
    return (idx * (idx + 1n) * (idx + 2n)) / 6n;
  },
  generate: (count) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(SEQUENCES.tetrahedral.getTerm(i));
    }
    return terms;
  }
});

// 24. PENTATOPE NUMBERS
registerSequence({
  id: 'pentatope',
  name: 'Pentatope Numbers',
  category: 'figurate',
  definition: 'Figurate numbers in 4-dimensional space: P_5(n) = n(n+1)(n+2)(n+3)/24.',
  recurrence: 'Appears in the 5th column of Pascal triangle',
  properties: [
    'Sum of the first n tetrahedral numbers'
  ],
  initialTerms: [0, 1, 5, 15, 35, 70, 126, 210, 330, 495, 715],
  getTerm: (n) => {
    const idx = BigInt(n);
    return (idx * (idx + 1n) * (idx + 2n) * (idx + 3n)) / 24n;
  },
  generate: (count) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(SEQUENCES.pentatope.getTerm(i));
    }
    return terms;
  }
});

// 25. POLYGONAL NUMBERS (k-GONAL)
registerSequence({
  id: 'polygonal',
  name: 'Polygonal Numbers (k-gonal)',
  category: 'figurate',
  definition: 'General polygonal numbers for a polygon of k sides: P(k, n) = ((k - 2)n^2 - (k - 4)n) / 2.',
  recurrence: 'P(k, n) = P(k, n - 1) + (k - 2)(n - 1) + 1',
  properties: [
    'k=3: Triangular, k=4: Square, k=5: Pentagonal, k=6: Hexagonal'
  ],
  initialTerms: [0, 1, 5, 12, 22, 35, 51, 70, 92, 117], // Pentagonal k=5
  getTerm: (n, { k = 5 } = {}) => {
    const idx = BigInt(n);
    const bigK = BigInt(k);
    return ((bigK - 2n) * idx * idx - (bigK - 4n) * idx) / 2n;
  },
  generate: (count, { k = 5 } = {}) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(SEQUENCES.polygonal.getTerm(i, { k }));
    }
    return terms;
  }
});

// 26. CENTERED POLYGONAL NUMBERS
registerSequence({
  id: 'centered_polygonal',
  name: 'Centered Polygonal Numbers',
  category: 'figurate',
  definition: 'Polygonal numbers formed by a central dot and layers around it: C_k(n) = (k*n*(n-1))/2 + 1.',
  recurrence: 'C_k(n) = C_k(n-1) + k*(n-1)',
  properties: [
    'k=4: Centered square: n^2 + (n-1)^2'
  ],
  initialTerms: [1, 5, 13, 25, 41, 61, 85, 113, 145], // k=4
  getTerm: (n, { k = 4 } = {}) => {
    const idx = BigInt(n);
    const bigK = BigInt(k);
    return (bigK * idx * (idx - 1n)) / 2n + 1n;
  },
  generate: (count, { k = 4 } = {}) => {
    const terms = [];
    for (let i = 1; i <= count; i++) {
      terms.push(SEQUENCES.centered_polygonal.getTerm(i, { k }));
    }
    return terms;
  }
});

// 27. PRONIC NUMBERS (OBLONG)
registerSequence({
  id: 'pronic',
  aliases: ['oblong_numbers'],
  name: 'Pronic Numbers (Oblong)',
  category: 'figurate',
  definition: 'Number that is the product of two consecutive integers: P_n = n(n + 1).',
  recurrence: 'P_n = 2 * T_n (twice the nth triangular number)',
  properties: [
    'Can be arranged as a rectangle of sides n and n+1',
    'Sum of first n pronic numbers: n(n+1)(n+2)/3'
  ],
  initialTerms: [0, 2, 6, 12, 20, 30, 42, 56, 72, 90, 110],
  getTerm: (n) => {
    const idx = BigInt(n);
    return idx * (idx + 1n);
  },
  generate: (count) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(SEQUENCES.pronic.getTerm(i));
    }
    return terms;
  }
});

// 28. PENTAGONAL NUMBERS
registerSequence({
  id: 'pentagonal',
  aliases: ['pentagonal_numbers'],
  name: 'Pentagonal Numbers',
  category: 'figurate',
  definition: 'Figurate numbers of the form P_n = n(3n - 1)/2.',
  recurrence: 'P_n = P_{n-1} + 3n - 2, with P_0 = 0',
  properties: [
    'Euler pentagonal number theorem in partition theory',
    'Sum of interior points in pentagonal tessellations'
  ],
  initialTerms: [0, 1, 5, 12, 22, 35, 51, 70, 92, 117],
  getTerm: (n) => {
    const idx = BigInt(n);
    return (idx * (3n * idx - 1n)) / 2n;
  },
  generate: (count) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(SEQUENCES.pentagonal.getTerm(i));
    }
    return terms;
  }
});

// 29. HEXAGONAL NUMBERS
registerSequence({
  id: 'hexagonal',
  aliases: ['hexagonal_numbers'],
  name: 'Hexagonal Numbers',
  category: 'figurate',
  definition: 'Figurate numbers of the form H_n = 2n^2 - n = n(2n - 1).',
  recurrence: 'H_n = H_{n-1} + 4n - 3, with H_0 = 0',
  properties: [
    'Every hexagonal number is a triangular number: H_n = T_{2n-1}'
  ],
  initialTerms: [0, 1, 6, 15, 28, 45, 66, 91, 120, 153],
  getTerm: (n) => {
    const idx = BigInt(n);
    return idx * (2n * idx - 1n);
  },
  generate: (count) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(SEQUENCES.hexagonal.getTerm(i));
    }
    return terms;
  }
});

// 30. HEPTAGONAL NUMBERS
registerSequence({
  id: 'heptagonal',
  aliases: ['heptagonal_numbers'],
  name: 'Heptagonal Numbers',
  category: 'figurate',
  definition: 'Figurate numbers of the form He_n = n(5n - 3)/2.',
  recurrence: 'He_n = He_{n-1} + 5n - 4, with He_0 = 0',
  properties: [
    'P(7, n) in general polygonal formula'
  ],
  initialTerms: [0, 1, 7, 18, 34, 55, 81, 112, 148, 189],
  getTerm: (n) => {
    const idx = BigInt(n);
    return (idx * (5n * idx - 3n)) / 2n;
  },
  generate: (count) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(SEQUENCES.heptagonal.getTerm(i));
    }
    return terms;
  }
});

// 31. OCTAGONAL NUMBERS
registerSequence({
  id: 'octagonal',
  aliases: ['octagonal_numbers'],
  name: 'Octagonal Numbers',
  category: 'figurate',
  definition: 'Figurate numbers of the form O_n = 3n^2 - 2n = n(3n - 2).',
  recurrence: 'O_n = O_{n-1} + 6n - 5, with O_0 = 0',
  properties: [
    'O_n = n + 6*T_{n-1}'
  ],
  initialTerms: [0, 1, 8, 21, 40, 65, 96, 133, 176, 225],
  getTerm: (n) => {
    const idx = BigInt(n);
    return idx * (3n * idx - 2n);
  },
  generate: (count) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(SEQUENCES.octagonal.getTerm(i));
    }
    return terms;
  }
});

// 32. CULLEN NUMBERS
registerSequence({
  id: 'cullen',
  aliases: ['cullen_numbers'],
  name: 'Cullen Numbers',
  category: 'number_theory',
  definition: 'Numbers of the form C_n = n * 2^n + 1.',
  recurrence: 'C_n = n * 2^n + 1',
  properties: [
    'Almost all Cullen numbers are composite'
  ],
  initialTerms: [1, 3, 9, 25, 65, 161, 385, 897, 2049],
  getTerm: (n) => {
    const idx = BigInt(n);
    return idx * (1n << idx) + 1n;
  },
  generate: (count) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(SEQUENCES.cullen.getTerm(i));
    }
    return terms;
  }
});

// 33. WOODALL NUMBERS
registerSequence({
  id: 'woodall',
  aliases: ['woodall_numbers'],
  name: 'Woodall Numbers',
  category: 'number_theory',
  definition: 'Numbers of the form W_n = n * 2^n - 1.',
  recurrence: 'W_n = n * 2^n - 1',
  properties: [
    'Also known as Cullen numbers of the second kind'
  ],
  initialTerms: [-1, 1, 7, 23, 63, 159, 383, 895, 2047],
  getTerm: (n) => {
    const idx = BigInt(n);
    return idx * (1n << idx) - 1n;
  },
  generate: (count) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(SEQUENCES.woodall.getTerm(i));
    }
    return terms;
  }
});

// 34. SYLVESTER SEQUENCE
registerSequence({
  id: 'sylvester',
  aliases: ['sylvester_sequence'],
  name: "Sylvester's Sequence",
  category: 'special',
  definition: 'Sequence defined by s_0 = 2 and s_{n+1} = s_n^2 - s_n + 1.',
  recurrence: 's_{n+1} = s_n(s_n - 1) + 1, with s_0 = 2',
  properties: [
    'Sum of reciprocals sum(1/s_i) = 1',
    'Doubly exponential growth'
  ],
  initialTerms: [2, 3, 7, 43, 1807, 3263443],
  getTerm: (n) => {
    let s = 2n;
    for (let i = 0; i < n; i++) s = s * s - s + 1n;
    return s;
  },
  generate: (count) => {
    const terms = [2n];
    let s = 2n;
    for (let i = 1; i < count; i++) {
      s = s * s - s + 1n;
      terms.push(s);
    }
    return terms.slice(0, count);
  }
});

// 35. LUCAS-LEHMER SEQUENCE
registerSequence({
  id: 'lucas_lehmer',
  aliases: ['lucas_lehmer_sequence'],
  name: 'Lucas-Lehmer Sequence',
  category: 'number_theory',
  definition: 'Sequence defined by S_0 = 4 and S_n = S_{n-1}^2 - 2 used in Mersenne prime tests.',
  recurrence: 'S_n = S_{n-1}^2 - 2, with S_0 = 4',
  properties: [
    'Used in Lucas-Lehmer primality test for Mersenne numbers M_p = 2^p - 1'
  ],
  initialTerms: [4, 14, 194, 37634, 1416317954],
  getTerm: (n) => {
    let s = 4n;
    for (let i = 0; i < n; i++) s = s * s - 2n;
    return s;
  },
  generate: (count) => {
    const terms = [4n];
    let s = 4n;
    for (let i = 1; i < count; i++) {
      s = s * s - 2n;
      terms.push(s);
    }
    return terms.slice(0, count);
  }
});

// 36. CARMICHAEL NUMBERS
registerSequence({
  id: 'carmichael',
  aliases: ['carmichael_numbers'],
  name: 'Carmichael Numbers',
  category: 'number_theory',
  definition: 'Composite numbers that satisfy Fermat congruence b^{n-1} ≡ 1 (mod n) for all coprime b.',
  recurrence: 'Korselt criterion: square-free and p - 1 divides n - 1 for all prime factors p',
  properties: [
    'Fermat pseudoprimes to all coprime bases',
    'Infinitely many Carmichael numbers exist (Alford-Granville-Pomerance 1994)'
  ],
  initialTerms: [561, 1105, 1729, 2465, 2821, 6601, 8911, 10585, 15841, 29341],
  getTerm: (n) => {
    const list = [561n, 1105n, 1729n, 2465n, 2821n, 6601n, 8911n, 10585n, 15841n, 29341n, 41041n, 46657n, 52633n, 62745n, 63973n, 75361n];
    return list[Math.min(Math.max(0, n - 1), list.length - 1)];
  },
  generate: (count) => {
    const list = [561n, 1105n, 1729n, 2465n, 2821n, 6601n, 8911n, 10585n, 15841n, 29341n, 41041n, 46657n, 52633n, 62745n, 63973n, 75361n];
    return list.slice(0, count);
  }
});

// 37. PROTH NUMBERS
registerSequence({
  id: 'proth',
  aliases: ['proth_numbers'],
  name: 'Proth Numbers',
  category: 'number_theory',
  definition: 'Numbers of the form k * 2^n + 1 where k is odd and 2^n > k.',
  recurrence: 'N = k * 2^n + 1, k odd, k < 2^n',
  properties: [
    'Proth theorem: testable for primality with single modular exponentiation'
  ],
  initialTerms: [3, 5, 9, 13, 17, 25, 33, 41, 49, 57, 65, 81, 97, 113, 129],
  getTerm: (n) => {
    const list = [3n, 5n, 9n, 13n, 17n, 25n, 33n, 41n, 49n, 57n, 65n, 81n, 97n, 113n, 129n];
    return list[Math.min(Math.max(0, n - 1), list.length - 1)];
  },
  generate: (count) => {
    const list = [3n, 5n, 9n, 13n, 17n, 25n, 33n, 41n, 49n, 57n, 65n, 81n, 97n, 113n, 129n];
    return list.slice(0, count);
  }
});

// 38. PRIME NUMBERS
function isPrime(num) {
  if (num < 2) return false;
  if (num === 2 || num === 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;
  for (let i = 5; i * i <= num; i += 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
  }
  return true;
}

registerSequence({
  id: 'primes',
  aliases: ['prime_sequence'],
  name: 'Prime Numbers',
  category: 'number_theory',
  definition: 'Integers greater than 1 that have no positive divisors other than 1 and themselves.',
  recurrence: 'No polynomial formula gives only primes (Goldbach, 1752)',
  properties: [
    'Fundamental Theorem of Arithmetic: unique prime factorization',
    'Prime number theorem: pi(x) ~ x / ln(x)',
    'Riemann hypothesis predicts distribution of primes'
  ],
  initialTerms: [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37],
  getTerm: (n) => {
    let count = 0;
    let candidate = 2;
    while (true) {
      if (isPrime(candidate)) {
        count++;
        if (count === n) return candidate;
      }
      candidate++;
    }
  },
  generate: (count) => {
    const primes = [];
    let candidate = 2;
    while (primes.length < count) {
      if (isPrime(candidate)) primes.push(candidate);
      candidate++;
    }
    return primes;
  }
});

// 29. COMPOSITE NUMBERS
registerSequence({
  id: 'composites',
  aliases: ['composite_numbers'],
  name: 'Composite Numbers',
  category: 'number_theory',
  definition: 'Positive integers greater than 1 that are not prime.',
  recurrence: 'Integers with at least one non-trivial divisor',
  properties: [
    'Every composite number can be uniquely factored into primes'
  ],
  initialTerms: [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21],
  getTerm: (n) => {
    let count = 0;
    let candidate = 4;
    while (true) {
      if (!isPrime(candidate)) {
        count++;
        if (count === n) return candidate;
      }
      candidate++;
    }
  },
  generate: (count) => {
    const composites = [];
    let candidate = 4;
    while (composites.length < count) {
      if (!isPrime(candidate)) composites.push(candidate);
      candidate++;
    }
    return composites;
  }
});

// 30. PERFECT NUMBERS
registerSequence({
  id: 'perfect',
  aliases: ['perfect_numbers'],
  name: 'Perfect Numbers',
  category: 'number_theory',
  definition: 'Positive integer that is equal to the sum of its positive proper divisors.',
  recurrence: 'Euclid-Euler theorem: 2^{p-1} * (2^p - 1) where 2^p - 1 is a Mersenne prime',
  properties: [
    'All known perfect numbers are even',
    'Open problem: do odd perfect numbers exist?'
  ],
  initialTerms: [6, 28, 496, 8128, 33550336, 8589869056n, 137438691328n],
  getTerm: (n) => {
    const mersenneExponents = [2, 3, 5, 7, 13, 17, 19, 31];
    if (n > mersenneExponents.length) throw new Error('Perfect numbers beyond term 8 exceed safe deterministic range.');
    const p = BigInt(mersenneExponents[n - 1]);
    return (2n ** (p - 1n)) * ((2n ** p) - 1n);
  },
  generate: (count) => {
    const limit = Math.min(count, 8);
    const res = [];
    for (let i = 1; i <= limit; i++) {
      res.push(SEQUENCES.perfect.getTerm(i));
    }
    return res;
  }
});

// 31. MERSENNE NUMBERS
registerSequence({
  id: 'mersenne',
  name: 'Mersenne Numbers',
  category: 'number_theory',
  definition: 'Numbers of the form M_n = 2^n - 1.',
  recurrence: 'M_n = 2 * M_{n-1} + 1, with M_1 = 1',
  properties: [
    'If M_n is prime, then n must be prime',
    'Used in Lucas-Lehmer test and GIMPS search'
  ],
  initialTerms: [1, 3, 7, 15, 31, 63, 127, 255, 511, 1023, 2047],
  getTerm: (n) => (2n ** BigInt(n)) - 1n,
  generate: (count) => {
    const terms = [];
    for (let i = 1; i <= count; i++) {
      terms.push(SEQUENCES.mersenne.getTerm(i));
    }
    return terms;
  }
});

// 32. FERMAT NUMBERS
registerSequence({
  id: 'fermat',
  aliases: ['fermat_numbers'],
  name: 'Fermat Numbers',
  category: 'number_theory',
  definition: 'Numbers of the form F_n = 2^(2^n) + 1.',
  recurrence: 'F_n = (F_{n-1} - 1)^2 + 1',
  properties: [
    'F_0 to F_4 (3, 5, 17, 257, 65537) are prime (Fermat primes)',
    'Regular polygon with N sides is constructible with compass and straightedge iff N is a product of a power of 2 and distinct Fermat primes'
  ],
  initialTerms: [3, 5, 17, 257, 65537, 4294967297n],
  getTerm: (n) => (2n ** (2n ** BigInt(n))) + 1n,
  generate: (count) => {
    const limit = Math.min(count, 6);
    const terms = [];
    for (let i = 0; i < limit; i++) {
      terms.push(SEQUENCES.fermat.getTerm(i));
    }
    return terms;
  }
});

// 33. REPUNIT NUMBERS
registerSequence({
  id: 'repunit',
  aliases: ['repunits'],
  name: 'Repunit Numbers',
  category: 'number_theory',
  definition: 'Numbers containing only the digit 1 in base 10: R_n = (10^n - 1) / 9.',
  recurrence: 'R_n = 10 * R_{n-1} + 1',
  properties: [
    'R_n is prime only if n is prime (known for n = 2, 19, 23, 317, 1031)'
  ],
  initialTerms: [1, 11, 111, 1111, 11111, 111111, 1111111, 11111111],
  getTerm: (n) => ((10n ** BigInt(n)) - 1n) / 9n,
  generate: (count) => {
    const terms = [];
    for (let i = 1; i <= count; i++) {
      terms.push(SEQUENCES.repunit.getTerm(i));
    }
    return terms;
  }
});

// 34. PRIMORIAL NUMBERS
registerSequence({
  id: 'primorial',
  aliases: ['primorials'],
  name: 'Primorial Numbers',
  category: 'number_theory',
  definition: 'Product of the first n prime numbers: p_n# = prod_{i=1}^n p_i.',
  recurrence: 'p_n# = p_{n-1}# * p_n',
  properties: [
    'Used in Euclid proof of the infinitude of primes: p_n# + 1',
    'Asymptotically: ln(p_n#) ~ n * ln(n)'
  ],
  initialTerms: [2, 6, 30, 210, 2310, 30030, 510510, 9699690],
  getTerm: (n) => {
    const primes = SEQUENCES.primes.generate(n);
    let prod = 1n;
    for (const p of primes) prod *= BigInt(p);
    return prod;
  },
  generate: (count) => {
    const primes = SEQUENCES.primes.generate(count);
    const terms = [];
    let cur = 1n;
    for (const p of primes) {
      cur *= BigInt(p);
      terms.push(cur);
    }
    return terms;
  }
});

// 35. POWERS OF 2
registerSequence({
  id: 'powers_of_2',
  aliases: ['power2', 'powers2', 'powers_of_two'],
  name: 'Powers of 2',
  category: 'progressions',
  definition: 'Sequence 2^n.',
  recurrence: 'a_n = 2 * a_{n-1}',
  properties: [
    'Basis for binary numeral system in computer science',
    'Number of subsets of a set with n elements'
  ],
  initialTerms: [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024],
  getTerm: (n) => 2n ** BigInt(n),
  generate: (count) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(2n ** BigInt(i));
    }
    return terms;
  }
});

// 36. POWERS OF 3
registerSequence({
  id: 'powers_of_3',
  aliases: ['power3', 'powers3', 'powers_of_three'],
  name: 'Powers of 3',
  category: 'progressions',
  definition: 'Sequence 3^n.',
  recurrence: 'a_n = 3 * a_{n-1}',
  properties: [
    'Basis for ternary numeral system'
  ],
  initialTerms: [1, 3, 9, 27, 81, 243, 729, 2187, 6561],
  getTerm: (n) => 3n ** BigInt(n),
  generate: (count) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(3n ** BigInt(i));
    }
    return terms;
  }
});

// 37. FACTORIALS
registerSequence({
  id: 'factorials',
  aliases: ['factorial_sequence'],
  name: 'Factorials',
  category: 'combinatorics',
  definition: 'Product of all positive integers less than or equal to n: n! = prod_{i=1}^n i.',
  recurrence: 'n! = n * (n - 1)!, with 0! = 1',
  properties: [
    'Number of permutations of n distinct objects',
    "Stirling's approximation: n! ~ sqrt(2*pi*n) * (n/e)^n"
  ],
  initialTerms: [1, 1, 2, 6, 24, 120, 720, 5040, 40320, 362880, 3628800],
  getTerm: (n) => bigIntFactorial(n),
  generate: (count) => {
    const terms = [];
    let cur = 1n;
    terms.push(cur);
    for (let i = 1; i < count; i++) {
      cur *= BigInt(i);
      terms.push(cur);
    }
    return terms;
  }
});

// 38. HARMONIC NUMBERS
registerSequence({
  id: 'harmonic_numbers',
  name: 'Harmonic Numbers',
  category: 'number_theory',
  definition: 'Sum of the reciprocals of the first n positive integers: H_n = sum_{k=1}^n 1/k.',
  recurrence: 'H_n = H_{n-1} + 1/n',
  properties: [
    'Asymptotic expansion: H_n = ln(n) + gamma + 1/(2n) - ... (gamma ≈ 0.5772156649 Euler-Mascheroni constant)',
    'H_n is never an integer for n > 1 (Wolstenholme/Theisinger)'
  ],
  initialTerms: [1, 1.5, 1.833333, 2.083333, 2.283333, 2.45, 2.592857, 2.717857],
  getTerm: (n) => {
    let sum = 0;
    for (let k = 1; k <= n; k++) sum += 1 / k;
    return sum;
  },
  generate: (count) => {
    const terms = [];
    let sum = 0;
    for (let i = 1; i <= count; i++) {
      sum += 1 / i;
      terms.push(sum);
    }
    return terms;
  }
});

// 39. LOOK-AND-SAY SEQUENCE
function nextLookAndSay(s) {
  let res = '';
  let count = 1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === s[i + 1]) {
      count++;
    } else {
      res += count + s[i];
      count = 1;
    }
  }
  return res;
}

registerSequence({
  id: 'look_and_say',
  aliases: ['lookandsay'],
  name: 'Look-and-Say Sequence',
  category: 'dynamic',
  definition: 'Audioactive sequence where each term describes the counts of consecutive repeated digits in the previous term.',
  recurrence: 'Describe previous digits: e.g. "1" -> one 1 ("11") -> two 1s ("21") -> one 2, one 1 ("1211")',
  properties: [
    "Conway's Constant: length of terms grows by factor lambda ≈ 1.303577269",
    'Cosmological theorem: every sequence splits into 92 elements'
  ],
  initialTerms: ['1', '11', '21', '1211', '111221', '312211', '13112221', '1113213211'],
  getTerm: (n) => {
    let cur = '1';
    for (let i = 1; i < n; i++) cur = nextLookAndSay(cur);
    return cur;
  },
  generate: (count) => {
    const terms = [];
    let cur = '1';
    for (let i = 0; i < count; i++) {
      terms.push(cur);
      cur = nextLookAndSay(cur);
    }
    return terms;
  }
});

// 40. RECAMÁN'S SEQUENCE
registerSequence({
  id: 'recaman',
  name: "Recamán's Sequence",
  category: 'dynamic',
  definition: 'a_0 = 0. For n > 0, a_n = a_{n-1} - n if positive and not already in sequence; otherwise a_{n-1} + n.',
  recurrence: 'a_n = a_{n-1} - n (if > 0 and fresh) else a_{n-1} + n',
  properties: [
    'Conjecture: does every integer eventually appear in Recamán sequence?',
    'Forms intriguing semi-circular audio spirals in visualization'
  ],
  initialTerms: [0, 1, 3, 6, 2, 7, 13, 20, 12, 21, 11, 22, 10, 23, 9, 24],
  getTerm: (n) => {
    const gen = SEQUENCES.recaman.generate(n + 1);
    return gen[n];
  },
  generate: (count) => {
    const terms = [0];
    const seen = new Set([0]);
    for (let i = 1; i < count; i++) {
      const prev = terms[i - 1];
      const back = prev - i;
      if (back > 0 && !seen.has(back)) {
        terms.push(back);
        seen.add(back);
      } else {
        const fwd = prev + i;
        terms.push(fwd);
        seen.add(fwd);
      }
    }
    return terms;
  }
});

// 41. THUE-MORSE SEQUENCE
registerSequence({
  id: 'thue_morse',
  aliases: ['thue-morse'],
  name: 'Thue-Morse Sequence',
  category: 'dynamic',
  definition: 'Binary sequence where the nth term is the sum of bits modulo 2 (parity of 1s in binary expansion of n).',
  recurrence: 't_0 = 0, t_{2n} = t_n, t_{2n+1} = 1 - t_n',
  properties: [
    'Cube-free: contains no three identical consecutive blocks (overlap-free)',
    'Fixed point of morphism: 0 -> 01, 1 -> 10'
  ],
  initialTerms: [0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0],
  getTerm: (n) => {
    let c = 0;
    let v = n;
    while (v > 0) {
      c += v & 1;
      v >>= 1;
    }
    return c % 2;
  },
  generate: (count) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(SEQUENCES.thue_morse.getTerm(i));
    }
    return terms;
  }
});

// 42. GOLOMB SEQUENCE
registerSequence({
  id: 'golomb',
  name: 'Golomb Sequence',
  category: 'dynamic',
  definition: 'Non-decreasing integer sequence where a_n is the number of times n appears in the sequence.',
  recurrence: 'a_1 = 1, a_{n+1} = 1 + a_{n + 1 - a_{a_n}}',
  properties: [
    'Asymptotic behavior: a_n ~ phi^(2-phi) * n^(phi-1) where phi is golden ratio'
  ],
  initialTerms: [1, 2, 2, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 6],
  getTerm: (n) => {
    const gen = SEQUENCES.golomb.generate(n);
    return gen[n - 1];
  },
  generate: (count) => {
    const a = [0, 1];
    for (let i = 2; i <= count; i++) {
      a.push(1 + a[i - a[a[i - 1]]]);
    }
    return a.slice(1);
  }
});

// 43. RUDIN-SHAPIRO SEQUENCE
registerSequence({
  id: 'rudin_shapiro',
  name: 'Rudin-Shapiro Sequence',
  category: 'dynamic',
  definition: 'Sequence where a_n is (-1) to the power of the number of pairs of consecutive 1s in the binary expansion of n.',
  recurrence: 'a_{2n} = a_n, a_{2n+1} = (-1)^n * a_n',
  properties: [
    'Associated polynomial bounds: |sum_{n=0}^{2^k-1} a_n e^{i n theta}| <= sqrt(2) * 2^{k/2}'
  ],
  initialTerms: [1, 1, 1, -1, 1, 1, -1, 1, 1, 1, 1, -1, -1, -1, 1, -1],
  getTerm: (n) => {
    let bin = n.toString(2);
    let pairs = 0;
    for (let i = 0; i < bin.length - 1; i++) {
      if (bin[i] === '1' && bin[i + 1] === '1') pairs++;
    }
    return pairs % 2 === 0 ? 1 : -1;
  },
  generate: (count) => {
    const terms = [];
    for (let i = 0; i < count; i++) {
      terms.push(SEQUENCES.rudin_shapiro.getTerm(i));
    }
    return terms;
  }
});

// 44. HAPPY NUMBERS
function sumDigitSquares(n) {
  let sum = 0;
  let val = n;
  while (val > 0) {
    const digit = val % 10;
    sum += digit * digit;
    val = Math.floor(val / 10);
  }
  return sum;
}

function isHappyNumber(n) {
  let slow = n, fast = n;
  do {
    slow = sumDigitSquares(slow);
    fast = sumDigitSquares(sumDigitSquares(fast));
  } while (slow !== fast);
  return slow === 1;
}

registerSequence({
  id: 'happy_numbers',
  name: 'Happy Numbers',
  category: 'number_theory',
  definition: 'Numbers that reach 1 when repeatedly replaced by the sum of the square of their digits.',
  recurrence: 'Iterate sum of squares of digits until 1 (happy) or entering the cycle 4->16->37->58->89->145->42->20->4 (unhappy)',
  properties: [
    'Approximately 14.3% of positive integers are happy'
  ],
  initialTerms: [1, 7, 10, 13, 19, 23, 28, 31, 32, 44, 49, 68, 70],
  getTerm: (n) => {
    let count = 0;
    let candidate = 1;
    while (true) {
      if (isHappyNumber(candidate)) {
        count++;
        if (count === n) return candidate;
      }
      candidate++;
    }
  },
  generate: (count) => {
    const res = [];
    let candidate = 1;
    while (res.length < count) {
      if (isHappyNumber(candidate)) res.push(candidate);
      candidate++;
    }
    return res;
  }
});

// 45. COLLATZ STOPPING TIME SEQUENCE (OEIS A006577)
registerSequence({
  id: 'collatz_stopping',
  aliases: ['collatz', 'collatz_sequence', 'syracuse'],
  name: 'Collatz Stopping Times (OEIS A006577)',
  category: 'dynamic',
  definition: 'Number of steps required for the Collatz map (3n + 1) to reach 1 for n = 1, 2, 3...',
  recurrence: 'a_n = stopping_time(n)',
  properties: [
    'Empirically finite for all tested n < 2^68',
    'Remains an UNPROVEN conjecture in mathematics'
  ],
  initialTerms: [0, 1, 7, 2, 5, 8, 16, 3, 19, 6, 14, 9, 9, 17, 17, 4, 12, 20, 20, 7],
  getTerm: (n) => {
    if (n <= 1) return 0;
    let cur = BigInt(n);
    let steps = 0;
    while (cur !== 1n && steps < 10000) {
      if (cur % 2n === 0n) cur = cur / 2n;
      else cur = 3n * cur + 1n;
      steps++;
    }
    return steps;
  },
  generate: (count) => {
    const terms = [];
    for (let i = 1; i <= count; i++) {
      terms.push(SEQUENCES.collatz_stopping.getTerm(i));
    }
    return terms;
  }
});

// 46. COLLATZ (SYRACUSE) EXTENDED ENGINE
export function analyzeCollatz(startingInt, maxSteps = 10000) {
  const start = typeof startingInt === 'bigint' ? startingInt : BigInt(Math.max(1, Math.floor(Number(startingInt) || 27)));
  if (start <= 0n) throw new Error('Collatz sequence requires positive integer > 0.');

  const trajectory = [start];
  let cur = start;
  let steps = 0;
  let maxVal = start;
  let evenCount = 0;
  let oddCount = 0;

  while (cur !== 1n && steps < maxSteps) {
    if (cur % 2n === 0n) {
      cur = cur / 2n;
      evenCount++;
    } else {
      cur = 3n * cur + 1n;
      oddCount++;
    }
    trajectory.push(cur);
    if (cur > maxVal) maxVal = cur;
    steps++;
  }

  const peakIndex = trajectory.indexOf(maxVal);

  return {
    operation: 'collatz_analysis',
    startNumber: start.toString(),
    totalSteps: steps,
    stoppingTime: steps,
    peakValue: maxVal.toString(),
    peakStep: peakIndex,
    evenSteps: evenCount,
    oddSteps: oddCount,
    reachedOne: cur === 1n,
    unprovenConjectureNote: 'The Collatz Conjecture states that every positive integer eventually reaches 1. This remains an UNPROVEN open problem in mathematics.',
    trajectory: trajectory.map(v => v.toString()),
    chartPoints: trajectory.slice(0, 200).map((v, idx) => ({ step: idx, value: Number(v) > Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : Number(v) })),
    message: `Collatz sequence for ${start} reached 1 in ${steps} steps. Maximum peak: ${maxVal} at step ${peakIndex}.`
  };
}

// 46. COMPARE SEQUENCES (e.g. Fibonacci vs Lucas)
export function compareSequences(seqIdA, seqIdB, count = 20) {
  const a = SEQUENCES[seqIdA];
  const b = SEQUENCES[seqIdB];
  if (!a) throw new Error(`Unknown sequence: ${seqIdA}`);
  if (!b) throw new Error(`Unknown sequence: ${seqIdB}`);

  const termsA = a.generate(count);
  const termsB = b.generate(count);

  const comparison = [];
  for (let i = 0; i < count; i++) {
    const valA = termsA[i];
    const valB = termsB[i];
    const fmtA = formatSequenceValue(valA);
    const fmtB = formatSequenceValue(valB);
    comparison.push({
      index: i + 1,
      [a.name]: fmtA,
      [b.name]: fmtB,
      [a.id]: fmtA,
      [b.id]: fmtB,
      valA: fmtA,
      valB: fmtB
    });
  }

  return {
    operation: 'sequence_comparison',
    sequenceA: { id: a.id, name: a.name, recurrence: a.recurrence },
    sequenceB: { id: b.id, name: b.name, recurrence: b.recurrence },
    count,
    comparison,
    message: `Compared first ${count} terms of ${a.name} and ${b.name}.`
  };
}

// ------------------------------------------------------------
// TOP-LEVEL SEQUENCE DISPATCHER
// ------------------------------------------------------------

export function getSequence(id) {
  if (!id) return null;
  const clean = String(id).toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return SEQUENCES[clean] || SEQUENCES[id] || null;
}

export function listAllSequences() {
  const seen = new Set();
  const list = [];
  for (const seq of Object.values(SEQUENCES)) {
    if (!seen.has(seq.id)) {
      seen.add(seq.id);
      list.push({
        id: seq.id,
        name: seq.name,
        category: seq.category,
        definition: seq.definition,
        recurrence: seq.recurrence,
        initialTerms: seq.initialTerms
      });
    }
  }
  return list;
}

export function calculateSequenceTerm(seqId, n, params = {}) {
  const seq = getSequence(seqId);
  if (!seq) {
    throw new Error(`Unknown sequence: "${seqId}". Available sequences include: ${Object.keys(SEQUENCES).slice(0, 15).join(', ')}...`);
  }
  const termIdx = Math.max(0, parseInt(n, 10));
  const val = seq.getTerm(termIdx, params);
  const formatted = formatSequenceValue(val);

  return {
    operation: 'sequence_term',
    sequenceId: seq.id,
    sequenceName: seq.name,
    termIndex: termIdx,
    termValue: typeof val === 'bigint' ? val.toString() : val,
    formatted,
    recurrence: seq.recurrence,
    definition: seq.definition,
    properties: seq.properties || [],
    message: `The ${termIdx}th term of ${seq.name} is ${formatted}.`
  };
}

export function generateSequenceRange(seqId, { from = 1, to = 20, count = null, params = {} } = {}) {
  const seq = getSequence(seqId);
  if (!seq) {
    throw new Error(`Unknown sequence: "${seqId}".`);
  }

  const start = count !== null ? 1 : Math.max(0, from);
  const end = count !== null ? Math.min(Math.max(1, count), 500) : Math.min(Math.max(start, to), 500);

  const terms = [];
  for (let n = start; n <= end; n++) {
    const val = seq.getTerm(n, params);
    terms.push({
      n,
      value: typeof val === 'bigint' ? val.toString() : val,
      formatted: formatSequenceValue(val)
    });
  }

  return {
    operation: 'sequence_range',
    sequenceId: seq.id,
    sequenceName: seq.name,
    from: start,
    to: end,
    count: terms.length,
    recurrence: seq.recurrence,
    definition: seq.definition,
    terms,
    chartData: terms.slice(0, 100).map(t => ({
      x: t.n,
      y: typeof t.value === 'string' && !isNaN(Number(t.value)) ? Number(t.value) : (typeof t.value === 'number' ? t.value : 0)
    })),
    message: `Generated ${terms.length} terms of ${seq.name} (${start} to ${end}): ${terms.slice(0, 8).map(t => t.formatted).join(', ')}${terms.length > 8 ? '…' : ''}.`
  };
}
