/* ============================================================
   TOOLBOX — Mathematical Knowledge Library
   Comprehensive structured knowledge catalog covering 38+ domains,
   famous theorems, laws, formulas, identities, conjectures with
   formal proof status, mathematical constants, and four-figure tables.
   Designed as an authoritative reference for secondary-school,
   undergraduate, and engineering mathematics.
   ============================================================ */

export const PROOF_STATUS = {
  THEOREM: 'PROVEN THEOREM',
  LEMMA: 'LEMMA',
  COROLLARY: 'COROLLARY',
  CONJECTURE: 'CONJECTURE (UNPROVEN)',
  OPEN_PROBLEM: 'OPEN PROBLEM',
  AXIOM: 'AXIOM / DEFINITION',
  IDENTITY: 'IDENTITY',
  LAW: 'LAW / PRINCIPLE',
  DISPROVEN: 'DISPROVEN CONJECTURE',
  NUMERICAL: 'NUMERICALLY VERIFIED',
  ALGORITHM: 'ALGORITHM / METHOD'
};

export const MATH_CATEGORIES = [
  { id: 'foundations', name: 'Foundations of Mathematics' },
  { id: 'arithmetic', name: 'Arithmetic & Elementary Math' },
  { id: 'set-theory', name: 'Set Theory' },
  { id: 'number-theory', name: 'Number Theory' },
  { id: 'conjectures', name: 'Conjectures & Open Problems' },
  { id: 'algebra', name: 'Algebra' },
  { id: 'functions', name: 'Functions' },
  { id: 'logarithms-exponents', name: 'Exponents & Logarithms' },
  { id: 'geometry-plane', name: 'Plane Geometry' },
  { id: 'geometry-solid', name: 'Solid Geometry' },
  { id: 'coordinate-geometry', name: 'Coordinate Geometry' },
  { id: 'trigonometry', name: 'Trigonometry' },
  { id: 'hyperbolic-functions', name: 'Hyperbolic Functions' },
  { id: 'sequences-series', name: 'Sequences & Series' },
  { id: 'complex-numbers', name: 'Complex Numbers' },
  { id: 'complex-analysis', name: 'Complex Analysis' },
  { id: 'matrices', name: 'Matrices' },
  { id: 'linear-algebra', name: 'Linear Algebra' },
  { id: 'calculus-differential', name: 'Differential Calculus' },
  { id: 'calculus-integral', name: 'Integral Calculus' },
  { id: 'calculus-multivariable', name: 'Multivariable Calculus' },
  { id: 'vector-calculus', name: 'Vector Calculus' },
  { id: 'differential-equations', name: 'Differential Equations' },
  { id: 'pde', name: 'Partial Differential Equations' },
  { id: 'laplace-transforms', name: 'Laplace Transforms' },
  { id: 'fourier-analysis', name: 'Fourier Analysis' },
  { id: 'z-transform', name: 'Z-Transform' },
  { id: 'numerical-methods', name: 'Numerical Methods' },
  { id: 'probability', name: 'Probability' },
  { id: 'statistics', name: 'Statistics' },
  { id: 'combinatorics', name: 'Combinatorics' },
  { id: 'discrete-math', name: 'Discrete Mathematics' },
  { id: 'graph-theory', name: 'Graph Theory' },
  { id: 'geometric-transforms', name: 'Geometric Transformations' },
  { id: 'special-functions', name: 'Special Functions' },
  { id: 'vector-tensor', name: 'Vector & Tensor Mathematics' },
  { id: 'optimization', name: 'Optimization' },
  { id: 'mathematical-physics', name: 'Mathematical Physics Formulas' },
  { id: 'engineering-math', name: 'Engineering Mathematics Reference' }
];

export const MATHEMATICAL_CONSTANTS = [
  {
    id: 'pi',
    name: 'Pi (Archimedes Constant)',
    symbol: 'π',
    value: Math.PI,
    displayValue: '3.14159265358979323846…',
    precision: 'Transcendental / Irrational',
    domain: 'Geometry & Analysis',
    description: 'The ratio of a circle\'s circumference to its diameter in Euclidean space.',
    aliases: ['pi', 'archimedes constant', 'circle ratio']
  },
  {
    id: 'e',
    name: 'Euler\'s Number (Base of Natural Logarithm)',
    symbol: 'e',
    value: Math.E,
    displayValue: '2.71828182845904523536…',
    precision: 'Transcendental / Irrational',
    domain: 'Calculus & Analysis',
    description: 'The unique real number such that the derivative of the exponential function e^x at x=0 is exactly 1.',
    aliases: ['e', 'eulers number', 'natural base', 'napier constant']
  },
  {
    id: 'phi',
    name: 'Golden Ratio',
    symbol: 'φ',
    value: 1.618033988749895,
    displayValue: '1.61803398874989484820… ( (1 + √5) / 2 )',
    precision: 'Algebraic Irrational (degree 2)',
    domain: 'Geometry & Number Theory',
    description: 'Two quantities are in the golden ratio if their ratio is the same as the ratio of their sum to the larger quantity.',
    aliases: ['phi', 'golden ratio', 'divine proportion', 'golden mean']
  },
  {
    id: 'sqrt2',
    name: 'Pythagoras\' Constant (Square Root of 2)',
    symbol: '√2',
    value: Math.SQRT2,
    displayValue: '1.41421356237309504880…',
    precision: 'Algebraic Irrational',
    domain: 'Geometry & Number Theory',
    description: 'The length of the hypotenuse of an isosceles right triangle with unit legs.',
    aliases: ['sqrt2', 'square root of 2', 'pythagoras constant']
  },
  {
    id: 'sqrt3',
    name: 'Theodorus\' Constant (Square Root of 3)',
    symbol: '√3',
    value: 1.7320508075688772,
    displayValue: '1.73205080756887729352…',
    precision: 'Algebraic Irrational',
    domain: 'Geometry',
    description: 'The length of the diagonal of a unit cube or the height of an equilateral triangle with side 2.',
    aliases: ['sqrt3', 'square root of 3', 'theodorus constant']
  },
  {
    id: 'sqrt5',
    name: 'Square Root of 5',
    symbol: '√5',
    value: Math.sqrt(5),
    displayValue: '2.23606797749978969640…',
    precision: 'Algebraic Irrational',
    domain: 'Number Theory',
    description: 'The positive real number that, when multiplied by itself, gives 5; foundational to the golden ratio φ = (1 + √5)/2.',
    aliases: ['sqrt5', 'square root of 5']
  },
  {
    id: 'ln2',
    name: 'Natural Logarithm of 2',
    symbol: 'ln(2)',
    value: Math.LN2,
    displayValue: '0.69314718055994530941…',
    precision: 'Transcendental / Irrational',
    domain: 'Calculus & Information Theory',
    description: 'The natural logarithm of the base 2; fundamental to half-life calculations and information entropy (bits to nats).',
    aliases: ['ln2', 'ln(2)', 'natural log of 2']
  },
  {
    id: 'ln10',
    name: 'Natural Logarithm of 10',
    symbol: 'ln(10)',
    value: Math.LN10,
    displayValue: '2.30258509299404568401…',
    precision: 'Transcendental / Irrational',
    domain: 'Calculus & Decibel Scaling',
    description: 'Modulus of transformation between common (base-10) and natural logarithms: ln(x) = log10(x) * ln(10).',
    aliases: ['ln10', 'ln(10)', 'natural log of 10']
  },
  {
    id: 'euler-mascheroni',
    name: 'Euler-Mascheroni Constant',
    symbol: 'γ',
    value: 0.5772156649015329,
    displayValue: '0.57721566490153286060…',
    precision: 'Irrationality unproven (widely believed irrational)',
    domain: 'Analysis & Number Theory',
    description: 'The limiting difference between the harmonic series and the natural logarithm: lim_{n→∞} (∑_{k=1}^n 1/k - ln(n)).',
    aliases: ['gamma', 'euler mascheroni constant', 'euler constant']
  },
  {
    id: 'catalan',
    name: 'Catalan\'s Constant',
    symbol: 'G',
    value: 0.915965594177219,
    displayValue: '0.91596559417721901505…',
    precision: 'Irrationality unproven',
    domain: 'Combinatorics & Analysis',
    description: 'The sum of the alternating series of odd inverse squares: ∑_{n=0}^∞ (-1)^n / (2n + 1)^2.',
    aliases: ['catalan constant', 'catalans constant']
  },
  {
    id: 'feigenbaum-alpha',
    name: 'Feigenbaum Reduction Parameter (Alpha)',
    symbol: 'α',
    value: 2.5029078750958928,
    displayValue: '2.50290787509589282228…',
    precision: 'Transcendental conjectured',
    domain: 'Chaos Theory & Dynamical Systems',
    description: 'Universal scaling factor for period-doubling bifurcations in non-linear dynamical systems.',
    aliases: ['feigenbaum alpha', 'chaos constant alpha']
  },
  {
    id: 'feigenbaum-delta',
    name: 'Feigenbaum Bifurcation Velocity (Delta)',
    symbol: 'δ',
    value: 4.66920160910299,
    displayValue: '4.66920160910299067185…',
    precision: 'Transcendental conjectured',
    domain: 'Chaos Theory & Dynamical Systems',
    description: 'The asymptotic ratio of the distance between consecutive period-doubling bifurcation intervals.',
    aliases: ['feigenbaum delta', 'chaos constant delta']
  },
  {
    id: 'apery',
    name: 'Apéry\'s Constant',
    symbol: 'ζ(3)',
    value: 1.2020569031595942,
    displayValue: '1.20205690315959428539…',
    precision: 'Proven Irrational (Apéry 1979)',
    domain: 'Number Theory',
    description: 'The value of the Riemann zeta function at 3: ∑_{n=1}^∞ 1/n^3. Arises in quantum electrodynamics.',
    aliases: ['apery constant', 'zeta 3', 'zeta(3)']
  }
];

export const MATH_KNOWLEDGE_ENTRIES = [
  // ==========================================
  // 1. FOUNDATIONS OF MATHEMATICS
  // ==========================================
  {
    id: 'peano-axioms',
    title: 'Peano Axioms',
    category: 'foundations',
    categoryName: 'Foundations of Mathematics',
    subdomain: 'Axiomatic Arithmetic',
    proofStatus: PROOF_STATUS.AXIOM,
    formula: '0 ∈ ℕ, \\; ∀n (S(n) ∈ ℕ), \\; S(n) = S(m) \\implies n = m',
    definition: 'A set of formal axioms formulated by Giuseppe Peano defining the natural numbers ℕ in terms of a successor function S(n).',
    statement: 'Natural numbers are generated from 0 by successive application of the successor function S, with mathematical induction ensuring full coverage.',
    variables: { '0': 'base natural number', 'S(n)': 'successor of n (conceptually n + 1)' },
    conditions: 'Foundational framework for arithmetic.',
    examples: ['S(0) = 1, S(1) = 2, S(2) = 3.'],
    relatedEntries: ['mathematical-induction', 'order-of-operations'],
    aliases: ['peano axioms', 'peano postulates', 'foundations of arithmetic'],
    computationalOp: null
  },
  {
    id: 'order-of-operations',
    title: 'Order of Operations (PEMDAS / BODMAS)',
    category: 'foundations',
    categoryName: 'Foundations of Mathematics',
    subdomain: 'Operational Hierarchy',
    proofStatus: PROOF_STATUS.AXIOM,
    formula: 'P/B \\to E/O \\to (M, D) \\to (A, S)',
    definition: 'Universal mathematical convention governing evaluation order of arithmetic expressions.',
    statement: '1. Parentheses/Brackets; 2. Exponents/Orders; 3. Multiplication and Division (left-to-right); 4. Addition and Subtraction (left-to-right).',
    variables: { P: 'Parentheses', E: 'Exponents', M: 'Multiplication', D: 'Division', A: 'Addition', S: 'Subtraction' },
    conditions: 'Applies to all real and complex mathematical expressions.',
    examples: ['3 + 4 * 2 = 3 + 8 = 11 (not 14).'],
    relatedEntries: ['field-axioms', 'peano-axioms'],
    aliases: ['pemdas', 'bodmas', 'order of operations', 'operator precedence'],
    computationalOp: 'evaluate'
  },
  {
    id: 'field-axioms',
    title: 'Field Axioms of Real Numbers',
    category: 'foundations',
    categoryName: 'Foundations of Mathematics',
    subdomain: 'Abstract Algebra',
    proofStatus: PROOF_STATUS.AXIOM,
    formula: 'a + b = b + a, \\quad a \\cdot b = b \\cdot a, \\quad a(b + c) = ab + ac',
    definition: 'Eleven algebraic properties that define a field (F, +, ·), satisfied by real and complex numbers.',
    statement: 'Closure, associativity, commutativity, existence of additive (0) and multiplicative (1) identities, additive inverses (-a), multiplicative inverses (a⁻¹ for a ≠ 0), and distributivity of multiplication over addition.',
    variables: { a: 'field element', b: 'field element', c: 'field element' },
    conditions: 'Multiplicative inverse requires a ≠ 0.',
    examples: ['5 + (-5) = 0 (additive inverse); 4 * (1/4) = 1 (multiplicative inverse).'],
    relatedEntries: ['order-of-operations', 'peano-axioms'],
    aliases: ['field axioms', 'real field properties', 'algebraic field'],
    computationalOp: null
  },

  // ==========================================
  // 2. ARITHMETIC & ELEMENTARY MATH
  // ==========================================
  {
    id: 'divisibility-rules',
    title: 'Standard Divisibility Rules',
    category: 'arithmetic',
    categoryName: 'Arithmetic & Elementary Math',
    subdomain: 'Elementary Number Theory',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'n \\equiv \\sum d_i \\pmod 3, \\quad n \\equiv \\sum (-1)^i d_i \\pmod{11}',
    definition: 'Algorithmic criteria for determining whether an integer is divisible by another without full division.',
    statement: 'Divisible by 2 if last digit is even; by 3 if sum of digits is divisible by 3; by 4 if last two digits form a multiple of 4; by 5 if last digit is 0 or 5; by 9 if sum of digits is divisible by 9; by 11 if alternating sum of digits is divisible by 11.',
    variables: { n: 'integer tested', d_i: 'decimal digits' },
    conditions: 'Base-10 integer representation.',
    examples: ['132: 1 - 3 + 2 = 0 (divisible by 11); 1 + 3 + 2 = 6 (divisible by 3).'],
    relatedEntries: ['prime-factorization', 'modular-arithmetic'],
    aliases: ['divisibility rules', 'divisibility tests', 'divisibility by 3', 'divisibility by 11'],
    computationalOp: 'evaluate'
  },
  {
    id: 'relative-and-percentage-error',
    title: 'Relative and Percentage Error Formulas',
    category: 'arithmetic',
    categoryName: 'Arithmetic & Elementary Math',
    subdomain: 'Error Analysis',
    proofStatus: PROOF_STATUS.AXIOM,
    formula: '\\text{Relative Error} = \\frac{|x_{\\text{approx}} - x_{\\text{true}}|}{|x_{\\text{true}}|}, \\quad \\% \\text{ Error} = \\text{Relative Error} \\times 100\\%',
    definition: 'Quantitative metrics measuring discrepancy between an approximated or experimental value and an exact reference.',
    statement: 'Absolute error is |x_approx - x_true|. Relative error normalizes absolute error by true magnitude, expressing deviation as a dimensionless fraction or percentage.',
    variables: { x_approx: 'approximated or measured value', x_true: 'true reference value' },
    conditions: 'x_true ≠ 0.',
    examples: ['If true is 2.5 and approx is 2.45, relative error = |2.45 - 2.5| / 2.5 = 0.05 / 2.5 = 0.02 (2%).'],
    relatedEntries: ['taylor-theorem', 'numerical-integration-simpson'],
    aliases: ['percentage error', 'relative error', 'absolute error', 'error propagation'],
    computationalOp: 'evaluate'
  },

  // ==========================================
  // 3. SET THEORY
  // ==========================================
  {
    id: 'de-morgans-laws-sets',
    title: 'De Morgan\'s Laws (Set Theory)',
    category: 'set-theory',
    categoryName: 'Set Theory',
    subdomain: 'Set Algebra',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: '(A \\cup B)\' = A\' \\cap B\', \\quad (A \\cap B)\' = A\' \\cup B\'',
    definition: 'Fundamental duality identities relating the complement of set unions and intersections.',
    statement: 'The complement of the union of two sets is the intersection of their complements; the complement of the intersection of two sets is the union of their complements.',
    variables: { A: 'first set', B: 'second set', '\'': 'complement operator' },
    conditions: 'Defined within a universal set U.',
    examples: ['If U={1,2,3,4}, A={1}, B={2}: (A∪B)\' = {3,4} = A\'∩B\'.'],
    relatedEntries: ['venn-diagram-principles', 'boolean-algebra-laws'],
    aliases: ['de morgan sets', 'de morgans laws set theory', 'complements duality'],
    computationalOp: null
  },
  {
    id: 'power-set-theorem',
    title: 'Power Set Cardinality Theorem',
    category: 'set-theory',
    categoryName: 'Set Theory',
    subdomain: 'Combinatorics of Sets',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: '|\\mathcal{P}(A)| = 2^{|A|}',
    definition: 'Formula determining the total number of subsets that can be constructed from a finite set A.',
    statement: 'For any finite set A with cardinality |A| = n, the power set P(A) contains exactly 2^n elements including the empty set ∅ and A itself.',
    variables: { A: 'finite set', '\\mathcal{P}(A)': 'power set of A', n: 'number of elements in A' },
    conditions: 'Finite cardinality n ≥ 0.',
    examples: ['For A={x, y}, P(A) = {∅, {x}, {y}, {x, y}}, total = 2² = 4.'],
    relatedEntries: ['binomial-theorem', 'combinations-formula'],
    aliases: ['power set cardinality', 'number of subsets', 'power set theorem'],
    computationalOp: 'evaluate'
  },

  // ==========================================
  // 4. NUMBER THEORY
  // ==========================================
  {
    id: 'fundamental-theorem-of-arithmetic',
    title: 'Fundamental Theorem of Arithmetic (Unique Factorization)',
    category: 'number-theory',
    categoryName: 'Number Theory',
    subdomain: 'Prime Factorization',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'n = p_1^{a_1} p_2^{a_2} \\cdots p_k^{a_k} \\quad (p_1 < p_2 < \\dots < p_k)',
    definition: 'Every integer n > 1 can be represented uniquely as a product of prime powers up to order of factors.',
    statement: 'Every positive integer strictly greater than 1 either is a prime itself or can be factorized as the product of prime numbers, unique up to factor ordering.',
    variables: { n: 'integer > 1', p_i: 'distinct prime numbers', a_i: 'positive integer exponents' },
    conditions: 'Integer n > 1.',
    examples: ['1200 = 2^4 * 3^1 * 5^2.'],
    relatedEntries: ['euclidean-algorithm', 'euler-totient-theorem'],
    aliases: ['unique factorization theorem', 'prime factorization theorem'],
    computationalOp: 'prime_factors'
  },
  {
    id: 'euclidean-algorithm',
    title: 'Euclidean Algorithm & Bézout\'s Identity',
    category: 'number-theory',
    categoryName: 'Number Theory',
    subdomain: 'Divisibility & GCD',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: '\\gcd(a, b) = \\gcd(b, a \\bmod b), \\quad ax + by = \\gcd(a, b)',
    definition: 'Efficient method for computing the greatest common divisor of two integers and obtaining linear Bézout coefficients.',
    statement: 'The GCD of a and b is invariant under Euclidean reduction a mod b. The extended algorithm produces integer coefficients x, y satisfying ax + by = gcd(a, b).',
    variables: { a: 'first integer', b: 'second integer', x: 'Bézout coefficient for a', y: 'Bézout coefficient for b' },
    conditions: 'Integers a, b not both zero.',
    examples: ['GCD(48, 18) = 6; Bézout: 48 * (-1) + 18 * 3 = 6.'],
    relatedEntries: ['fundamental-theorem-of-arithmetic', 'chinese-remainder-theorem'],
    aliases: ['gcd', 'greatest common divisor', 'euclidean algorithm', 'bezouts identity'],
    computationalOp: 'gcd'
  },
  {
    id: 'fermats-little-theorem',
    title: 'Fermat\'s Little Theorem',
    category: 'number-theory',
    categoryName: 'Number Theory',
    subdomain: 'Modular Arithmetic',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'a^{p-1} \\equiv 1 \\pmod p \\quad \\text{for } p \\nmid a, \\quad a^p \\equiv a \\pmod p',
    definition: 'Foundational modular arithmetic identity for prime moduli; essential for RSA cryptography and primality testing.',
    statement: 'If p is a prime number and a is an integer coprime to p, then a^(p-1) - 1 is an integer multiple of p.',
    variables: { p: 'prime modulus', a: 'integer coprime to p' },
    conditions: 'p is prime and gcd(a, p) = 1.',
    examples: ['For a = 2, p = 7: 2^6 = 64 = 7 * 9 + 1 ≡ 1 (mod 7).'],
    relatedEntries: ['eulers-totient-theorem', 'chinese-remainder-theorem'],
    aliases: ['fermats little theorem', 'flt', 'modular exponentiation prime'],
    computationalOp: 'evaluate'
  },
  {
    id: 'eulers-totient-theorem',
    title: 'Euler\'s Totient Function & Euler\'s Theorem',
    category: 'number-theory',
    categoryName: 'Number Theory',
    subdomain: 'Modular Arithmetic',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'a^{\\phi(n)} \\equiv 1 \\pmod n \\quad (\\gcd(a, n) = 1), \\quad \\phi(n) = n \\prod_{p | n} \\left(1 - \\frac{1}{p}\\right)',
    definition: 'Generalization of Fermat\'s Little Theorem to arbitrary composite moduli using Euler\'s totient function φ(n).',
    statement: 'If a and n are coprime integers, then a raised to φ(n) is congruent to 1 modulo n, where φ(n) counts integers k in [1, n] coprime to n.',
    variables: { n: 'modulus', a: 'integer coprime to n', '\\phi(n)': 'count of coprimes up to n' },
    conditions: 'gcd(a, n) = 1.',
    examples: ['φ(10) = 4 (coprimes: 1, 3, 7, 9); 3⁴ = 81 ≡ 1 (mod 10).'],
    relatedEntries: ['fermats-little-theorem', 'fundamental-theorem-of-arithmetic'],
    aliases: ['eulers theorem', 'euler totient', 'phi function', 'totient theorem'],
    computationalOp: 'totient'
  },
  {
    id: 'chinese-remainder-theorem',
    title: 'Chinese Remainder Theorem (CRT)',
    category: 'number-theory',
    categoryName: 'Number Theory',
    subdomain: 'Simultaneous Congruences',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'x \\equiv a_i \\pmod{m_i} \\implies x \\text{ unique modulo } M = \\prod m_i',
    definition: 'Theorem establishing the existence and uniqueness of solutions to systems of simultaneous modular congruences with pairwise coprime moduli.',
    statement: 'If moduli m₁, m₂, ..., m_k are pairwise coprime, the system x ≡ a_i (mod m_i) has a unique solution modulo M = m₁ * m₂ * ... * m_k.',
    variables: { a_i: 'remainders', m_i: 'pairwise coprime moduli', M: 'product of all moduli' },
    conditions: 'gcd(m_i, m_j) = 1 for all i ≠ j.',
    examples: ['x ≡ 2 (mod 3), x ≡ 3 (mod 5), x ≡ 2 (mod 7) -> unique solution x ≡ 23 (mod 105).'],
    relatedEntries: ['eulers-totient-theorem', 'euclidean-algorithm'],
    aliases: ['chinese remainder theorem', 'crt', 'system of congruences'],
    computationalOp: 'modular_arithmetic'
  },

  // ==========================================
  // 5. CONJECTURES & OPEN PROBLEMS
  // ==========================================
  {
    id: 'collatz-conjecture',
    title: 'Collatz Conjecture (3n + 1 Problem)',
    category: 'conjectures',
    categoryName: 'Conjectures & Open Problems',
    subdomain: 'Dynamical Number Theory',
    proofStatus: PROOF_STATUS.CONJECTURE,
    formula: 'T(n) = \\begin{cases} n/2 & \\text{if } n \\text{ is even} \\\\ 3n + 1 & \\text{if } n \\text{ is odd} \\end{cases}',
    definition: 'Famous unsolved problem in number theory asserting that repeated application of the mapping T(n) eventually reaches the cycle 4 -> 2 -> 1 for all positive integers n.',
    statement: 'Starting from any positive integer n > 0, iterating n / 2 (for even n) and 3n + 1 (for odd n) will always reach 1 in a finite number of steps. THIS CLAIM REMAINS MATHEMATICALLY UNPROVEN.',
    variables: { n: 'initial positive integer', 'T(n)': 'Collatz transformation step' },
    conditions: 'Initial input n ∈ ℕ, n ≥ 1.',
    examples: ['For n = 12: 12 -> 6 -> 3 -> 10 -> 5 -> 16 -> 8 -> 4 -> 2 -> 1 (9 steps, peak 16).'],
    relatedEntries: ['goldbach-conjecture', 'riemann-hypothesis'],
    aliases: ['collatz conjecture', '3n+1 problem', 'syracuse problem', 'kakutani problem', 'hailstone sequence'],
    computationalOp: 'collatz'
  },
  {
    id: 'riemann-hypothesis',
    title: 'Riemann Hypothesis',
    category: 'conjectures',
    categoryName: 'Conjectures & Open Problems',
    subdomain: 'Analytic Number Theory',
    proofStatus: PROOF_STATUS.OPEN_PROBLEM,
    formula: '\\zeta(s) = \\sum_{n=1}^\\infty \\frac{1}{n^s} = 0 \\implies \\text{Re}(s) = \\frac{1}{2} \\quad (0 < \\text{Re}(s) < 1)',
    definition: 'Millennium Prize Problem stating that all non-trivial zeros of the Riemann zeta function have a real part of exactly 1/2.',
    statement: 'The non-trivial zeros of the analytic continuation of the Riemann zeta function lie exclusively on the critical line Re(s) = 1/2 in the complex plane.',
    variables: { s: 'complex variable σ + it', '\\zeta(s)': 'Riemann zeta function' },
    conditions: 'Non-trivial zeros within the critical strip 0 < Re(s) < 1.',
    examples: ['First zero at s ≈ 1/2 + 14.134725i.'],
    relatedEntries: ['prime-number-theorem', 'collatz-conjecture'],
    aliases: ['riemann hypothesis', 'rh', 'zeros of zeta function', 'critical line'],
    computationalOp: null
  },
  {
    id: 'goldbach-conjecture',
    title: 'Goldbach\'s Strong Conjecture',
    category: 'conjectures',
    categoryName: 'Conjectures & Open Problems',
    subdomain: 'Additive Number Theory',
    proofStatus: PROOF_STATUS.CONJECTURE,
    formula: '\\forall n \\in 2\\mathbb{N}, \\; n > 2 \\implies \\exists p_1, p_2 \\in \\mathbb{P} \\; (n = p_1 + p_2)',
    definition: 'One of the oldest open conjectures in mathematics, stating that every even integer greater than 2 is the sum of two primes.',
    statement: 'Every even integer greater than 2 can be expressed as the sum of two prime numbers. Numerically verified up to 4 × 10¹⁸, but mathematically unproven.',
    variables: { n: 'even integer > 2', p_1: 'first prime', p_2: 'second prime' },
    conditions: 'Even integer n ≥ 4.',
    examples: ['4 = 2 + 2, 6 = 3 + 3, 8 = 3 + 5, 10 = 3 + 7 = 5 + 5.'],
    relatedEntries: ['collatz-conjecture', 'twin-prime-conjecture'],
    aliases: ['goldbach conjecture', 'goldbachs conjecture', 'strong goldbach'],
    computationalOp: null
  },
  {
    id: 'p-vs-np',
    title: 'P versus NP Problem',
    category: 'conjectures',
    categoryName: 'Conjectures & Open Problems',
    subdomain: 'Computational Complexity',
    proofStatus: PROOF_STATUS.OPEN_PROBLEM,
    formula: 'P \\overset{?}{=} NP',
    definition: 'Major unsolved problem in computer science asking whether every problem whose solution can be quickly verified by a computer can also be quickly solved by a computer.',
    statement: 'Does polynomial-time verifiability (NP) imply polynomial-time solvability (P)? Widely suspected to be P ≠ NP.',
    variables: { P: 'problems solvable in polynomial time', NP: 'problems verifiable in polynomial time' },
    conditions: 'Deterministic vs non-deterministic Turing machines.',
    examples: ['Boolean Satisfiability (SAT), Traveling Salesperson, Subset Sum.'],
    relatedEntries: ['riemann-hypothesis'],
    aliases: ['p vs np', 'p versus np', 'complexity classes'],
    computationalOp: null
  },
  {
    id: 'navier-stokes-existence',
    title: 'Navier-Stokes Existence and Smoothness',
    category: 'conjectures',
    categoryName: 'Conjectures & Open Problems',
    subdomain: 'Non-linear Partial Differential Equations / Fluid Dynamics',
    proofStatus: PROOF_STATUS.OPEN_PROBLEM,
    formula: '\\frac{\\partial \\mathbf{u}}{\\partial t} + (\\mathbf{u} \\cdot \\nabla)\\mathbf{u} = -\\frac{1}{\\rho}\\nabla p + \\nu \\nabla^2 \\mathbf{u} + \\mathbf{f}, \\quad \\nabla \\cdot \\mathbf{u} = 0',
    definition: 'Millennium Prize Problem concerning the fundamental partial differential equations governing incompressible viscous fluid flow.',
    statement: 'Prove or give a counter-example: whether smooth, physically reasonable solutions to the 3D incompressible Navier-Stokes equations always exist for all time given smooth initial conditions.',
    variables: { '\\mathbf{u}': 'velocity vector field', 'p': 'pressure field', '\\nu': 'kinematic viscosity', '\\rho': 'fluid density' },
    conditions: '3D incompressible fluid in ℝ³ with finite kinetic energy.',
    examples: ['Turbulence modeling, aerodynamic drag calculation, weather prediction systems.'],
    relatedEntries: ['laplace-equation', 'divergence-theorem', 'stokes-theorem'],
    aliases: ['navier-stokes', 'navier stokes existence', 'navier stokes smoothness', 'millennium prize fluid'],
    computationalOp: null
  },
  {
    id: 'birch-swinnerton-dyer',
    title: 'Birch and Swinnerton-Dyer Conjecture',
    category: 'conjectures',
    categoryName: 'Conjectures & Open Problems',
    subdomain: 'Arithmetic Algebraic Geometry',
    proofStatus: PROOF_STATUS.OPEN_PROBLEM,
    formula: 'L(E, s) \\sim c(s - 1)^r \\quad \\text{as } s \\to 1, \\quad r = \\text{rank}(E(\\mathbb{Q}))',
    definition: 'Millennium Prize Problem relating the arithmetic of elliptic curves to the behavior of their Hasse-Weil L-functions at s = 1.',
    statement: 'The rank of the abelian group of rational points E(ℚ) on an elliptic curve E equals the order of vanishing of its L-function L(E, s) at the central point s = 1.',
    variables: { 'E': 'elliptic curve over ℚ', 'r': 'algebraic rank of rational points', 'L(E, s)': 'Hasse-Weil L-function' },
    conditions: 'Elliptic curve defined over the rational numbers.',
    examples: ['Curves with rank 0 have finitely many rational points; rank ≥ 1 curves have infinitely many.'],
    relatedEntries: ['riemann-hypothesis', 'elliptic-curves'],
    aliases: ['birch swinnerton dyer', 'bsd conjecture', 'elliptic curve rank'],
    computationalOp: null
  },
  {
    id: 'hodge-conjecture',
    title: 'Hodge Conjecture',
    category: 'conjectures',
    categoryName: 'Conjectures & Open Problems',
    subdomain: 'Complex Algebraic Geometry',
    proofStatus: PROOF_STATUS.OPEN_PROBLEM,
    formula: 'H^{2k}(X, \\mathbb{Q}) \\cap H^{k,k}(X) = \\text{span}_{\\mathbb{Q}} \\{[Z] : Z \\text{ algebraic cycle of codimension } k\\}',
    definition: 'Millennium Prize Problem stating that on non-singular complex projective algebraic varieties, special de Rham cohomology classes are algebraic.',
    statement: 'Every Hodge class on a non-singular complex projective manifold is a rational linear combination of cohomology classes of algebraic cycles.',
    variables: { 'X': 'projective complex manifold', 'H^{k,k}': 'Dolbeault cohomology component', '[Z]': 'fundamental class of cycle' },
    conditions: 'Non-singular complex projective variety.',
    examples: ['True for divisor classes (k=1) by the Lefschetz (1,1) theorem.'],
    relatedEntries: ['riemann-hypothesis'],
    aliases: ['hodge conjecture', 'hodge cycles', 'algebraic cycles'],
    computationalOp: null
  },

  // ==========================================
  // 6. ALGEBRA
  // ==========================================
  {
    id: 'quadratic-formula',
    title: 'Quadratic Formula & Discriminant Analysis',
    category: 'algebra',
    categoryName: 'Algebra',
    subdomain: 'Polynomial Equations',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}, \\quad D = b^2 - 4ac',
    definition: 'Closed-form formula yielding the exact roots of any general quadratic equation ax² + bx + c = 0.',
    statement: 'Roots are determined by the discriminant D = b² - 4ac: if D > 0, two distinct real roots; if D = 0, one repeated real root -b/(2a); if D < 0, two complex conjugate roots.',
    variables: { a: 'quadratic coefficient (a ≠ 0)', b: 'linear coefficient', c: 'constant term', D: 'discriminant' },
    conditions: 'Coefficient a ≠ 0.',
    examples: ['x² - 5x + 6 = 0: a=1, b=-5, c=6 -> D=1 -> x = (5 ± 1)/2 -> x = 3, 2.'],
    relatedEntries: ['vietas-formulas', 'remainder-and-factor-theorems'],
    aliases: ['quadratic formula', 'solve quadratic', 'roots of quadratic', 'discriminant'],
    computationalOp: 'solve_quadratic'
  },
  {
    id: 'vietas-formulas',
    title: 'Vieta\'s Formulas',
    category: 'algebra',
    categoryName: 'Algebra',
    subdomain: 'Polynomial Roots',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'r_1 + r_2 = -\\frac{b}{a}, \\quad r_1 r_2 = \\frac{c}{a}, \\quad \\sum_{i} r_i = -\\frac{a_{n-1}}{a_n}',
    definition: 'Formulas relating the coefficients of a polynomial to symmetric sums and products of its roots.',
    statement: 'For a monic polynomial, the sum of roots equals the negative of the second coefficient, and the product of roots equals (-1)^n times the constant term.',
    variables: { a: 'leading coefficient', b: 'sub-leading coefficient', c: 'constant term', r_i: 'roots of polynomial' },
    conditions: 'Polynomial of degree n ≥ 1 over an algebraically closed field.',
    examples: ['For x² - 5x + 6 = 0: roots 2, 3 -> sum = 5 = -(-5)/1, product = 6 = 6/1.'],
    relatedEntries: ['quadratic-formula', 'fundamental-theorem-of-algebra'],
    aliases: ['vietas formulas', 'vieta relations', 'roots and coefficients'],
    computationalOp: 'solve_quadratic'
  },
  {
    id: 'remainder-and-factor-theorems',
    title: 'Polynomial Remainder & Factor Theorems',
    category: 'algebra',
    categoryName: 'Algebra',
    subdomain: 'Polynomial Algebra',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'P(x) = (x - c)Q(x) + P(c), \\quad (x - c) \\mid P(x) \\iff P(c) = 0',
    definition: 'Theorems linking polynomial evaluation at a point c to the remainder obtained from algebraic division by (x - c).',
    statement: 'When polynomial P(x) is divided by (x - c), the remainder is P(c). Consequently, (x - c) is a factor of P(x) if and only if P(c) = 0.',
    variables: { 'P(x)': 'polynomial', 'Q(x)': 'quotient polynomial', c: 'test point / candidate root' },
    conditions: 'Polynomial P(x) over a field.',
    examples: ['P(x) = x³ - 2x² - x + 2: P(1) = 1 - 2 - 1 + 2 = 0 -> (x - 1) is a factor.'],
    relatedEntries: ['quadratic-formula', 'partial-fractions-decomposition'],
    aliases: ['remainder theorem', 'factor theorem', 'polynomial division', 'synthetic division'],
    computationalOp: 'evaluate'
  },
  {
    id: 'partial-fractions-decomposition',
    title: 'Partial Fraction Decomposition',
    category: 'algebra',
    categoryName: 'Algebra',
    subdomain: 'Rational Functions',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: '\\frac{P(x)}{(x-a)(x-b)} = \\frac{A}{x-a} + \\frac{B}{x-b}, \\quad \\frac{P(x)}{(x^2+px+q)} = \\frac{Ax + B}{x^2+px+q}',
    definition: 'Algebraic method decomposing a proper rational function into a sum of simpler fractions with linear or irreducible quadratic denominators.',
    statement: 'Every proper rational function P(x)/Q(x) with deg(P) < deg(Q) can be uniquely expressed as a sum of partial fractions corresponding to the real irreducible factors of Q(x).',
    variables: { 'P(x)': 'numerator polynomial', 'Q(x)': 'factored denominator', A: 'constant coefficient', B: 'constant coefficient' },
    conditions: 'Proper rational fraction: deg(P) < deg(Q). Denominator factored over reals.',
    examples: ['1 / (x² - 1) = 1/2(x - 1) - 1/2(x + 1).'],
    relatedEntries: ['laplace-transforms-table', 'integration-by-parts'],
    aliases: ['partial fractions', 'partial fraction decomposition', 'rational fraction splitting'],
    computationalOp: null
  },

  // ==========================================
  // 7. FUNCTIONS
  // ==========================================
  {
    id: 'function-composition-inversion',
    title: 'Function Composition & Invertibility',
    category: 'functions',
    categoryName: 'Functions',
    subdomain: 'Function Theory',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: '(f \\circ g)(x) = f(g(x)), \\quad f(f^{-1}(y)) = y \\iff f \\text{ is bijective}',
    definition: 'Mathematical formalization of chaining operations and reversing mappings through bijection.',
    statement: 'A function f: X -> Y has a well-defined two-sided inverse f⁻¹: Y -> X if and only if f is bijective (both injective / one-to-one and surjective / onto).',
    variables: { f: 'outer function', g: 'inner function', 'f^{-1}': 'inverse mapping' },
    conditions: 'f must be bijective across its designated domain and codomain.',
    examples: ['f(x) = 2x + 3 -> f⁻¹(y) = (y - 3) / 2.'],
    relatedEntries: ['field-axioms'],
    aliases: ['composite functions', 'inverse function', 'bijective function'],
    computationalOp: null
  },

  // ==========================================
  // 8. EXPONENTS & LOGARITHMS
  // ==========================================
  {
    id: 'logarithm-laws',
    title: 'Universal Logarithm Laws & Change of Base',
    category: 'logarithms-exponents',
    categoryName: 'Exponents & Logarithms',
    subdomain: 'Logarithmic Algebra',
    proofStatus: PROOF_STATUS.IDENTITY,
    formula: '\\log_b(xy) = \\log_b x + \\log_b y, \\quad \\log_b(x^k) = k \\log_b x, \\quad \\log_b x = \\frac{\\ln x}{\\ln b}',
    definition: 'The set of fundamental identities governing logarithmic transformations across arbitrary positive bases.',
    statement: 'Logarithm of a product is the sum of logarithms; logarithm of a quotient is the difference; logarithm of a power is the exponent times the logarithm; change of base formula enables computation in natural or common base.',
    variables: { b: 'logarithm base (b > 0, b ≠ 1)', x: 'positive argument', y: 'positive argument', k: 'exponent' },
    conditions: 'Arguments x > 0, y > 0; bases b > 0, b ≠ 1.',
    examples: ['log10(1000) = 3; ln(e⁵) = 5; log2(8) = ln(8)/ln(2) = 3.'],
    relatedEntries: ['exponential-growth-decay'],
    aliases: ['log rules', 'logarithm laws', 'change of base', 'properties of logarithms'],
    computationalOp: 'evaluate'
  },
  {
    id: 'exponential-growth-decay',
    title: 'Exponential Growth and Decay Model',
    category: 'logarithms-exponents',
    categoryName: 'Exponents & Logarithms',
    subdomain: 'Applied Analysis',
    proofStatus: PROOF_STATUS.LAW,
    formula: 'N(t) = N_0 e^{kt} = N_0 \\left(\\frac{1}{2}\\right)^{t / t_{1/2}}',
    definition: 'Universal mathematical law governing quantities whose rate of change is proportional to their current magnitude.',
    statement: 'Solves the differential equation dN/dt = kN. For k > 0, models exponential growth (compound interest, population); for k < 0, models decay (radioactive half-life, cooling).',
    variables: { N_0: 'initial quantity', 'N(t)': 'quantity at time t', k: 'continuous growth rate', 't_{1/2}': 'half-life period' },
    conditions: 'Continuous rate k constant over time.',
    examples: ['Carbon-14 half-life 5730 years: k = -ln(2)/5730 ≈ -0.00012097.'],
    relatedEntries: ['first-order-linear-ode', 'logarithm-laws'],
    aliases: ['exponential growth', 'exponential decay', 'half life formula', 'malthusian model'],
    computationalOp: 'evaluate'
  },

  // ==========================================
  // 9. PLANE & SOLID GEOMETRY
  // ==========================================
  {
    id: 'pythagorean-theorem',
    title: 'Pythagorean Theorem',
    category: 'geometry-plane',
    categoryName: 'Plane Geometry',
    subdomain: 'Euclidean Geometry',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'a^2 + b^2 = c^2',
    definition: 'Geometric relation in Euclidean space between the three sides of a right triangle.',
    statement: 'In any right-angled triangle, the area of the square whose side is the hypotenuse (c) is equal to the sum of the areas of the squares on the other two legs (a and b).',
    variables: { a: 'first perpendicular leg', b: 'second perpendicular leg', c: 'hypotenuse' },
    conditions: 'Triangle must be planar and right-angled (90°).',
    examples: ['3² + 4² = 9 + 16 = 25 = 5²; 5, 12, 13 triangle.'],
    relatedEntries: ['law-of-cosines', 'distance-formula-cartesian'],
    aliases: ['pythagoras', 'pythagorean theorem', 'hypotenuse formula'],
    computationalOp: 'evaluate'
  },
  {
    id: 'herons-formula',
    title: 'Heron\'s Formula for Triangle Area',
    category: 'geometry-plane',
    categoryName: 'Plane Geometry',
    subdomain: 'Euclidean Area',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'A = \\sqrt{s(s-a)(s-b)(s-c)}, \\quad s = \\frac{a + b + c}{2}',
    definition: 'Direct formula calculating the area of any general triangle given solely the lengths of its three sides.',
    statement: 'Given side lengths a, b, c with semiperimeter s = (a + b + c)/2, the area is the square root of s(s-a)(s-b)(s-c).',
    variables: { a: 'first side', b: 'second side', c: 'third side', s: 'semiperimeter' },
    conditions: 'Triangle inequality must hold: a + b > c, a + c > b, b + c > a.',
    examples: ['Sides 7, 8, 9 -> s = 12 -> Area = √(12 * 5 * 4 * 3) = √720 ≈ 26.83.'],
    relatedEntries: ['pythagorean-theorem', 'law-of-cosines'],
    aliases: ['herons formula', 'triangle area from sides', 'semiperimeter area'],
    computationalOp: 'evaluate'
  },
  {
    id: 'solid-geometry-volumes',
    title: 'Volume and Surface Area of Standard Solids',
    category: 'geometry-solid',
    categoryName: 'Solid Geometry',
    subdomain: 'Mensuration',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'V_{\\text{sphere}} = \\frac{4}{3}\\pi r^3, \\quad V_{\\text{cylinder}} = \\pi r^2 h, \\quad V_{\\text{cone}} = \\frac{1}{3}\\pi r^2 h',
    definition: 'Formulas governing the 3D capacity and 2D bounding boundary area of regular Euclidean geometric solids.',
    statement: 'Sphere: V = (4/3)πr³, SA = 4πr²; Cylinder: V = πr²h, Total SA = 2πr(r + h); Cone: V = (1/3)πr²h, Lateral SA = πr√(r² + h²).',
    variables: { r: 'radius', h: 'height', V: 'volume', SA: 'surface area' },
    conditions: 'Euclidean three-dimensional space.',
    examples: ['Sphere of radius 3: Volume = (4/3)π(27) = 36π ≈ 113.097.'],
    relatedEntries: ['surface-integrals-flux'],
    aliases: ['volume of sphere', 'cylinder volume', 'cone volume', 'solid geometry formulas'],
    computationalOp: 'evaluate'
  },

  // ==========================================
  // 10. COORDINATE GEOMETRY
  // ==========================================
  {
    id: 'distance-formula-cartesian',
    title: 'Distance and Perpendicular Line Distance Formulas',
    category: 'coordinate-geometry',
    categoryName: 'Coordinate Geometry',
    subdomain: 'Cartesian Geometry',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'd = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}, \\quad d(P, L) = \\frac{|Ax_0 + By_0 + C|}{\\sqrt{A^2 + B^2}}',
    definition: 'Formulas for Euclidean metric separation between points and the shortest orthogonal distance from a point to a linear locus.',
    statement: 'Direct application of the Pythagorean theorem to Cartesian coordinates yields distance d; perpendicular projection of point (x₀, y₀) onto line Ax + By + C = 0 yields orthogonal distance d(P, L).',
    variables: { x_1: 'x-coord point 1', y_1: 'y-coord point 1', x_2: 'x-coord point 2', y_2: 'y-coord point 2', A: 'line x-coeff', B: 'line y-coeff', C: 'constant' },
    conditions: 'Cartesian orthogonal coordinate system.',
    examples: ['Distance between (0, 0) and (3, 4) is √(9 + 16) = 5.'],
    relatedEntries: ['pythagorean-theorem'],
    aliases: ['distance formula', 'point to line distance', 'cartesian distance'],
    computationalOp: 'evaluate'
  },
  {
    id: 'conic-sections-general',
    title: 'Conic Sections in Cartesian Coordinates',
    category: 'coordinate-geometry',
    categoryName: 'Coordinate Geometry',
    subdomain: 'Conic Sections',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: '\\frac{x^2}{a^2} + \\frac{y^2}{b^2} = 1 \\; (\\text{Ellipse}), \\quad \\frac{x^2}{a^2} - \\frac{y^2}{b^2} = 1 \\; (\\text{Hyperbola}), \\quad y^2 = 4ax \\; (\\text{Parabola})',
    definition: 'Loci formed by the intersection of a plane with a double circular cone, classified by their eccentricity e.',
    statement: 'Ellipse has eccentricity e < 1 (circle when e=0); Parabola has e = 1; Hyperbola has e > 1.',
    variables: { a: 'semi-major axis', b: 'semi-minor axis', e: 'eccentricity' },
    conditions: 'Standard canonical orientation centered at origin.',
    examples: ['Circle: x² + y² = r² (special case of ellipse with a = b = r).'],
    relatedEntries: ['distance-formula-cartesian'],
    aliases: ['conic sections', 'ellipse equation', 'hyperbola equation', 'parabola equation'],
    computationalOp: null
  },

  // ==========================================
  // 11. TRIGONOMETRY
  // ==========================================
  {
    id: 'pythagorean-trig-identities',
    title: 'Pythagorean Trigonometric Identities',
    category: 'trigonometry',
    categoryName: 'Trigonometry',
    subdomain: 'Trigonometric Identities',
    proofStatus: PROOF_STATUS.IDENTITY,
    formula: '\\sin^2\\theta + \\cos^2\\theta = 1, \\quad 1 + \\tan^2\\theta = \\sec^2\\theta, \\quad 1 + \\cot^2\\theta = \\csc^2\\theta',
    definition: 'Fundamental trigonometric identities expressing the Pythagorean theorem on the unit circle.',
    statement: 'For any real or complex angle θ, the sum of the squares of sine and cosine is identically 1. Dividing by cos²θ and sin²θ yields the tangent-secant and cotangent-cosecant identities.',
    variables: { '\\theta': 'angle in radians or degrees' },
    conditions: 'Valid for all θ where functions are defined (cos θ ≠ 0 for tan/sec; sin θ ≠ 0 for cot/csc).',
    examples: ['sin²(45°) + cos²(45°) = (1/√2)² + (1/√2)² = 1/2 + 1/2 = 1.'],
    relatedEntries: ['compound-angle-formulas', 'double-angle-formulas'],
    aliases: ['pythagorean identity', 'sin2 + cos2', 'trigonometric pythagoras'],
    computationalOp: 'evaluate'
  },
  {
    id: 'compound-angle-formulas',
    title: 'Compound Angle Formulas (Sum and Difference)',
    category: 'trigonometry',
    categoryName: 'Trigonometry',
    subdomain: 'Trigonometric Identities',
    proofStatus: PROOF_STATUS.IDENTITY,
    formula: '\\sin(A \\pm B) = \\sin A \\cos B \\pm \\cos A \\sin B, \\quad \\cos(A \\pm B) = \\cos A \\cos B \\mp \\sin A \\sin B',
    definition: 'Addition and subtraction formulas expressing trigonometric functions of compound angles.',
    statement: 'Enables expansion and decomposition of trigonometric arguments involving sums or differences.',
    variables: { A: 'first angle', B: 'second angle' },
    conditions: 'All real or complex angles.',
    examples: ['sin(75°) = sin(45° + 30°) = sin45 cos30 + cos45 sin30 = (√6 + √2)/4.'],
    relatedEntries: ['double-angle-formulas', 'product-to-sum-formulas'],
    aliases: ['compound angle', 'sum and difference trig', 'angle addition formulas'],
    computationalOp: 'evaluate'
  },
  {
    id: 'double-angle-formulas',
    title: 'Double and Half-Angle Formulas',
    category: 'trigonometry',
    categoryName: 'Trigonometry',
    subdomain: 'Trigonometric Identities',
    proofStatus: PROOF_STATUS.IDENTITY,
    formula: '\\sin(2\\theta) = 2\\sin\\theta\\cos\\theta, \\quad \\cos(2\\theta) = \\cos^2\\theta - \\sin^2\\theta = 2\\cos^2\\theta - 1 = 1 - 2\\sin^2\\theta',
    definition: 'Formulas expressing trigonometric functions of double or half arguments in terms of single-angle functions.',
    statement: 'Derivable directly from compound angle formulas; foundational for power reduction and trigonometric integration.',
    variables: { '\\theta': 'angle' },
    conditions: 'Defined across all real numbers.',
    examples: ['cos(2θ) = 1 - 2sin²θ -> sin²θ = (1 - cos 2θ)/2 (power reduction).'],
    relatedEntries: ['compound-angle-formulas', 'pythagorean-trig-identities'],
    aliases: ['double angle', 'half angle formulas', 'power reduction trig'],
    computationalOp: 'evaluate'
  },
  {
    id: 'law-of-sines',
    title: 'Law of Sines (Sine Rule)',
    category: 'trigonometry',
    categoryName: 'Trigonometry',
    subdomain: 'Triangle Solving',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: '\\frac{a}{\\sin A} = \\frac{b}{\\sin B} = \\frac{c}{\\sin C} = 2R',
    definition: 'Equation relating the lengths of the sides of any plane triangle to the sines of its angles and its circumradius R.',
    statement: 'The ratio of any side length of a triangle to the sine of its opposite angle is constant and equals the diameter of the triangle\'s circumcircle (2R).',
    variables: { a: 'side opposite angle A', b: 'side opposite angle B', c: 'side opposite angle C', R: 'circumradius' },
    conditions: 'Plane Euclidean triangle.',
    examples: ['If a=10, A=30°, then a/sin(A) = 10 / 0.5 = 20 = 2R.'],
    relatedEntries: ['law-of-cosines', 'herons-formula'],
    aliases: ['sine rule', 'law of sines', 'triangle sine law'],
    computationalOp: 'evaluate'
  },
  {
    id: 'law-of-cosines',
    title: 'Law of Cosines (Cosine Rule)',
    category: 'trigonometry',
    categoryName: 'Trigonometry',
    subdomain: 'Triangle Solving',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'c^2 = a^2 + b^2 - 2ab \\cos C',
    definition: 'Generalization of the Pythagorean theorem to arbitrary triangles, accounting for non-right angles.',
    statement: 'The square of any side equals the sum of the squares of the other two sides minus twice their product times the cosine of the included angle.',
    variables: { a: 'first side', b: 'second side', c: 'side opposite angle C', C: 'angle between sides a and b' },
    conditions: 'Plane Euclidean triangle. Reduces to Pythagorean theorem when C = 90° (cos 90° = 0).',
    examples: ['a=5, b=7, C=60°: c² = 25 + 49 - 2(5)(7)(0.5) = 74 - 35 = 39 -> c = √39.'],
    relatedEntries: ['law-of-sines', 'pythagorean-theorem'],
    aliases: ['cosine rule', 'law of cosines', 'triangle cosine law'],
    computationalOp: 'evaluate'
  },

  // ==========================================
  // 12. HYPERBOLIC FUNCTIONS
  // ==========================================
  {
    id: 'hyperbolic-definitions-identities',
    title: 'Hyperbolic Functions & Fundamental Identities',
    category: 'hyperbolic-functions',
    categoryName: 'Hyperbolic Functions',
    subdomain: 'Hyperbolic Trigonometry',
    proofStatus: PROOF_STATUS.IDENTITY,
    formula: '\\sinh x = \\frac{e^x - e^{-x}}{2}, \\quad \\cosh x = \\frac{e^x + e^{-x}}{2}, \\quad \\cosh^2 x - \\sinh^2 x = 1',
    definition: 'Analogs of trigonometric functions defined via the exponential function, corresponding to parametric coordinates on a hyperbola.',
    statement: 'sinh(x) and cosh(x) parametrize the unit hyperbola x² - y² = 1. The fundamental identity is cosh² x - sinh² x = 1.',
    variables: { x: 'real or complex argument' },
    conditions: 'Valid for all x ∈ ℂ.',
    examples: ['cosh(0) = 1, sinh(0) = 0; d/dx[sinh x] = cosh x; d/dx[cosh x] = sinh x.'],
    relatedEntries: ['pythagorean-trig-identities', 'eulers-formula'],
    aliases: ['hyperbolic functions', 'sinh', 'cosh', 'tanh', 'hyperbolic identity'],
    computationalOp: 'evaluate'
  },

  // ==========================================
  // 13. SEQUENCES & SERIES
  // ==========================================
  {
    id: 'arithmetic-geometric-progressions',
    title: 'Arithmetic and Geometric Progressions',
    category: 'sequences-series',
    categoryName: 'Sequences & Series',
    subdomain: 'Elementary Progressions',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'S_{n,\\text{arith}} = \\frac{n}{2}(2a + (n-1)d), \\quad S_{n,\\text{geom}} = \\frac{a(1 - r^n)}{1 - r}, \\quad S_\\infty = \\frac{a}{1 - r} \\; (|r| < 1)',
    definition: 'Formulas for the n-th term and sum of arithmetic and geometric series, including infinite sum for |r| < 1.',
    statement: 'An arithmetic sequence has constant difference d; a geometric sequence has constant ratio r. Infinite geometric series converges if and only if |r| < 1.',
    variables: { a: 'first term', d: 'common difference', r: 'common ratio', n: 'number of terms' },
    conditions: 'Infinite sum valid strictly for |r| < 1.',
    examples: ['1 + 1/2 + 1/4 + 1/8 + ... = 1 / (1 - 0.5) = 2.'],
    relatedEntries: ['taylor-series-maclaurin', 'convergence-tests-series'],
    aliases: ['ap and gp', 'geometric series', 'arithmetic series', 'infinite geometric series'],
    computationalOp: 'evaluate'
  },
  {
    id: 'taylor-series-maclaurin',
    title: 'Taylor and Maclaurin Series',
    category: 'sequences-series',
    categoryName: 'Sequences & Series',
    subdomain: 'Power Series',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'f(x) = \\sum_{n=0}^\\infty \\frac{f^{(n)}(a)}{n!} (x - a)^n, \\quad e^x = 1 + x + \\frac{x^2}{2!} + \\frac{x^3}{3!} + \\dots',
    definition: 'Representation of an infinitely differentiable function as an infinite sum of polynomial terms calculated from its derivatives at a single point.',
    statement: 'When expanded about a = 0, the series is known as a Maclaurin series. Common expansions: e^x = ∑ x^n/n!, sin x = ∑ (-1)^n x^(2n+1)/(2n+1)!, cos x = ∑ (-1)^n x^(2n)/(2n)!.',
    variables: { f: 'infinitely differentiable function', a: 'center of expansion', n: 'derivative order' },
    conditions: 'Convergence within radius of convergence R: |x - a| < R.',
    examples: ['Approximation of e^0.1 ≈ 1 + 0.1 + 0.01/2 = 1.105.'],
    relatedEntries: ['convergence-tests-series', 'eulers-formula'],
    aliases: ['taylor series', 'maclaurin series', 'power series expansion'],
    computationalOp: null
  },
  {
    id: 'convergence-tests-series',
    title: 'Series Convergence Tests (Ratio, Root, Integral, Alternating)',
    category: 'sequences-series',
    categoryName: 'Sequences & Series',
    subdomain: 'Infinite Series',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'L = \\lim_{n\\to\\infty} \\left|\\frac{a_{n+1}}{a_n}\\right| \\; (< 1 \\implies \\text{converges}), \\quad L = \\lim_{n\\to\\infty} \\sqrt[n]{|a_n|}',
    definition: 'Standard analytical criteria used to establish absolute or conditional convergence of infinite series.',
    statement: 'Ratio Test: L < 1 converges absolutely, L > 1 diverges, L = 1 inconclusive; Alternating Series Test (Leibniz): alternating signs and monotonic decrease to 0 guarantees convergence.',
    variables: { a_n: 'n-th term of series', L: 'limit value' },
    conditions: 'Terms non-zero for ratio test.',
    examples: ['∑ 1/n! has ratio (1/(n+1)!)/(1/n!) = 1/(n+1) -> 0 < 1: converges for all x.'],
    relatedEntries: ['taylor-series-maclaurin', 'arithmetic-geometric-progressions'],
    aliases: ['ratio test', 'root test', 'alternating series test', 'series convergence'],
    computationalOp: null
  },

  // ==========================================
  // 14. COMPLEX NUMBERS & COMPLEX ANALYSIS
  // ==========================================
  {
    id: 'eulers-formula',
    title: 'Euler\'s Formula and Euler\'s Identity',
    category: 'complex-numbers',
    categoryName: 'Complex Numbers',
    subdomain: 'Complex Analysis',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'e^{i\\theta} = \\cos\\theta + i\\sin\\theta, \\quad e^{i\\pi} + 1 = 0',
    definition: 'Fundamental bridge connecting complex exponential functions directly to trigonometry, established by Leonhard Euler.',
    statement: 'For any real number θ, the complex exponential e^(iθ) represents a point on the unit circle with angle θ. Setting θ = π yields Euler\'s Identity, connecting 0, 1, e, i, and π.',
    variables: { '\\theta': 'angle in radians', i: 'imaginary unit (i² = -1)', e: 'Euler\'s number' },
    conditions: 'Valid across all real and complex θ.',
    examples: ['e^(i π/2) = i; e^(i π) = -1.'],
    relatedEntries: ['de-moivres-theorem', 'taylor-series-maclaurin'],
    aliases: ['eulers formula', 'eulers identity', 'complex exponential', 'cis formula'],
    computationalOp: 'evaluate'
  },
  {
    id: 'de-moivres-theorem',
    title: 'De Moivre\'s Theorem & n-th Roots of Unity',
    category: 'complex-numbers',
    categoryName: 'Complex Numbers',
    subdomain: 'Complex Powers & Roots',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: '(\\cos\\theta + i\\sin\\theta)^n = \\cos(n\\theta) + i\\sin(n\\theta), \\quad z_k = r^{1/n} e^{i(\\theta + 2k\\pi)/n}',
    definition: 'Formula computing integer and fractional powers and roots of complex numbers expressed in polar form.',
    statement: 'Raising a complex number in polar form to power n multiplies its argument by n and raises its modulus to power n. For fractional powers 1/n, it generates n distinct roots of unity spaced evenly by 2π/n.',
    variables: { r: 'modulus |z|', '\\theta': 'argument Arg(z)', n: 'power/root degree', k: 'root index (0, 1, ..., n-1)' },
    conditions: 'r ≥ 0.',
    examples: ['Cube roots of 1: e^(0) = 1, e^(i 2π/3) = -1/2 + i√3/2, e^(i 4π/3) = -1/2 - i√3/2.'],
    relatedEntries: ['eulers-formula', 'fundamental-theorem-of-algebra'],
    aliases: ['de moivre', 'de moivres theorem', 'nth roots of unity', 'complex roots'],
    computationalOp: 'evaluate'
  },
  {
    id: 'cauchy-riemann-equations',
    title: 'Cauchy-Riemann Equations',
    category: 'complex-analysis',
    categoryName: 'Complex Analysis',
    subdomain: 'Holomorphic Functions',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: '\\frac{\\partial u}{\\partial x} = \\frac{\\partial v}{\\partial y}, \\quad \\frac{\\partial u}{\\partial y} = -\\frac{\\partial v}{\\partial x}',
    definition: 'System of two partial differential equations forming the necessary and sufficient condition for a complex function f(z) = u(x, y) + i v(x, y) to be holomorphic (complex differentiable).',
    statement: 'If u and v have continuous first partial derivatives, f(z) is differentiable at z if and only if u_x = v_y and u_y = -v_x.',
    variables: { u: 'real part u(x, y)', v: 'imaginary part v(x, y)', x: 'real coordinate', y: 'imaginary coordinate' },
    conditions: 'Partial derivatives must be continuous in an open neighborhood.',
    examples: ['f(z) = z² = (x² - y²) + i(2xy): u_x = 2x = v_y; u_y = -2y = -v_x (Holomorphic).'],
    relatedEntries: ['cauchy-integral-formula-residue'],
    aliases: ['cauchy riemann', 'holomorphic condition', 'analytic function equations'],
    computationalOp: null
  },
  {
    id: 'cauchy-integral-formula-residue',
    title: 'Cauchy\'s Integral Formula & Residue Theorem',
    category: 'complex-analysis',
    categoryName: 'Complex Analysis',
    subdomain: 'Contour Integration',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'f(a) = \\frac{1}{2\\pi i} \\oint_C \\frac{f(z)}{z - a} dz, \\quad \\oint_C f(z) dz = 2\\pi i \\sum \\text{Res}(f, z_k)',
    definition: 'Cornerstone theorem of complex analysis stating that values of a holomorphic function inside a disk are completely determined by boundary values, generalized to the Residue Theorem for poles.',
    statement: 'The contour integral of a meromorphic function around a closed curve is 2πi times the sum of the residues of its enclosed singularities.',
    variables: { C: 'positively oriented closed contour', 'f(z)': 'meromorphic function', a: 'interior point', '\\text{Res}': 'residue at pole z_k' },
    conditions: 'Contour C simple and closed; f analytic on and within C except for isolated poles.',
    examples: ['Evaluating real improper integrals: ∫_{-∞}^∞ dx/(1 + x²) = 2πi * Res(1/(z²+1), i) = 2πi * (1/(2i)) = π.'],
    relatedEntries: ['cauchy-riemann-equations'],
    aliases: ['cauchy integral formula', 'residue theorem', 'contour integration'],
    computationalOp: null
  },

  // ==========================================
  // 15. MATRICES & LINEAR ALGEBRA
  // ==========================================
  {
    id: 'matrix-determinant-general',
    title: 'Matrix Determinant (2x2, 3x3, and NxN)',
    category: 'matrices',
    categoryName: 'Matrices',
    subdomain: 'Matrix Invariants',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: '\\det\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix} = ad - bc, \\quad \\det(A) = \\sum_{j=1}^n (-1)^{i+j} a_{ij} M_{ij}',
    definition: 'Scalar attribute characterizing square matrices; equals 0 if and only if the matrix is singular (non-invertible).',
    statement: 'The determinant represents the signed hyper-volume scaling factor of the linear transformation described by matrix A. Invertibility condition: det(A) ≠ 0.',
    variables: { a: 'matrix element', M_ij: 'minor determinant of submatrix deleting row i and col j' },
    conditions: 'Matrix must be square (n × n).',
    examples: ['det([[1, 2], [3, 4]]) = 1*4 - 2*3 = -2.'],
    relatedEntries: ['matrix-inverse-adjugate', 'eigenvalues-eigenvectors-characteristic'],
    aliases: ['determinant', 'matrix determinant', 'det'],
    computationalOp: 'matrix_determinant'
  },
  {
    id: 'matrix-inverse-adjugate',
    title: 'Matrix Inverse & Invertibility',
    category: 'matrices',
    categoryName: 'Matrices',
    subdomain: 'Matrix Inverses',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'A^{-1} = \\frac{1}{\\det(A)} \\text{adj}(A), \\quad A A^{-1} = A^{-1} A = I',
    definition: 'The unique matrix A⁻¹ which, when multiplied by square matrix A, yields the identity matrix I.',
    statement: 'A square matrix A is invertible if and only if det(A) ≠ 0. The inverse can be calculated via adjugate cofactor matrix or Gauss-Jordan row reduction on [A | I].',
    variables: { A: 'square invertible matrix', '\\text{adj}(A)': 'transpose of cofactor matrix', I: 'identity matrix' },
    conditions: 'det(A) ≠ 0 (non-singular matrix).',
    examples: ['For A = [[4, 7], [2, 6]], det=10, A⁻¹ = [[0.6, -0.7], [-0.2, 0.4]].'],
    relatedEntries: ['matrix-determinant-general', 'rank-nullity-theorem'],
    aliases: ['matrix inverse', 'inverse matrix', 'invertible matrix'],
    computationalOp: 'matrix_inverse'
  },
  {
    id: 'eigenvalues-eigenvectors-characteristic',
    title: 'Eigenvalues, Eigenvectors & Characteristic Equation',
    category: 'linear-algebra',
    categoryName: 'Linear Algebra',
    subdomain: 'Spectral Theory',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'A v = \\lambda v \\iff \\det(A - \\lambda I) = 0, \\quad \\lambda^2 - \\text{tr}(A)\\lambda + \\det(A) = 0 \\; (2\\times 2)',
    definition: 'Non-zero vectors v that only undergo scalar scaling λ when operated on by linear transformation A.',
    statement: 'Eigenvalues are the roots of the characteristic polynomial det(A - λI) = 0. Associated non-zero eigenvectors span the null space Null(A - λI).',
    variables: { A: 'square matrix', v: 'eigenvector (v ≠ 0)', '\\lambda': 'eigenvalue scalar', I: 'identity matrix' },
    conditions: 'Square matrix (n × n); eigenvector v ≠ 0.',
    examples: ['For A = [[2, 1], [1, 2]]: tr=4, det=3 -> λ² - 4λ + 3 = 0 -> λ₁=3, λ₂=1.'],
    relatedEntries: ['matrix-determinant-general', 'cayley-hamilton-theorem'],
    aliases: ['eigenvalues', 'eigenvectors', 'characteristic polynomial', 'eigenspace'],
    computationalOp: 'eigenvalues'
  },
  {
    id: 'rank-nullity-theorem',
    title: 'Rank-Nullity Theorem',
    category: 'linear-algebra',
    categoryName: 'Linear Algebra',
    subdomain: 'Vector Spaces',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: '\\text{rank}(T) + \\text{nullity}(T) = \\dim(V)',
    definition: 'Fundamental dimensional theorem relating the dimension of the range and kernel of a linear transformation.',
    statement: 'For a linear map T: V -> W between vector spaces, the dimension of the vector space V equals the dimension of the image/column space (rank) plus the dimension of the kernel/null space (nullity).',
    variables: { T: 'linear map', V: 'domain vector space', '\\text{rank}(T)': 'dim(Im(T))', '\\text{nullity}(T)': 'dim(Ker(T))' },
    conditions: 'Domain vector space V must be finite-dimensional.',
    examples: ['For an m x n matrix representing T: ℝⁿ -> ℝᵐ, rank + nullity = n.'],
    relatedEntries: ['matrix-inverse-adjugate', 'eigenvalues-eigenvectors-characteristic'],
    aliases: ['rank nullity', 'dimension theorem', 'kernel and image'],
    computationalOp: null
  },
  {
    id: 'cayley-hamilton-theorem',
    title: 'Cayley-Hamilton Theorem',
    category: 'linear-algebra',
    categoryName: 'Linear Algebra',
    subdomain: 'Matrix Polynomials',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'p(\\lambda) = \\det(\\lambda I - A) \\implies p(A) = O',
    definition: 'Every square matrix satisfies its own characteristic polynomial equation.',
    statement: 'Substituting matrix A into its scalar characteristic polynomial p(λ) yields the zero matrix O, enabling fast computation of high matrix powers and inverses.',
    variables: { A: 'square matrix', 'p(\\lambda)': 'characteristic polynomial', O: 'zero matrix' },
    conditions: 'Square matrix over any commutative ring.',
    examples: ['For A 2x2 with tr=4, det=3: A² - 4A + 3I = O -> A² = 4A - 3I.'],
    relatedEntries: ['eigenvalues-eigenvectors-characteristic'],
    aliases: ['cayley hamilton', 'matrix characteristic equation'],
    computationalOp: null
  },

  // ==========================================
  // 16. DIFFERENTIAL CALCULUS
  // ==========================================
  {
    id: 'derivative-definition-rules',
    title: 'Derivative Definition and Fundamental Differentiation Rules',
    category: 'calculus-differential',
    categoryName: 'Differential Calculus',
    subdomain: 'Derivatives',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'f\'(x) = \\lim_{h\\to 0} \\frac{f(x+h) - f(x)}{h}, \\quad (uv)\' = u\'v + uv\', \\quad \\left(\\frac{u}{v}\\right)\' = \\frac{u\'v - uv\'}{v^2}, \\quad (f(g(x)))\' = f\'(g(x))g\'(x)',
    definition: 'Instantaneous rate of change of a function with respect to its variable, and standard product, quotient, and chain rules.',
    statement: 'The derivative gives the slope of the tangent line to f at x. Power rule d/dx(x^n) = n x^(n-1); product rule; quotient rule; chain rule for composite functions.',
    variables: { f: 'differentiable function', h: 'step size approaching 0', u: 'function', v: 'function' },
    conditions: 'Limit must exist at point x.',
    examples: ['d/dx(x³) = 3x²; d/dx(x² sin x) = 2x sin x + x² cos x.'],
    relatedEntries: ['mean-value-theorem', 'lhopitals-rule'],
    aliases: ['derivative', 'differentiation rules', 'product rule', 'quotient rule', 'chain rule'],
    computationalOp: 'derivative'
  },
  {
    id: 'lhopitals-rule',
    title: 'L\'Hôpital\'s Rule for Indeterminate Limits',
    category: 'calculus-differential',
    categoryName: 'Differential Calculus',
    subdomain: 'Limits',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: '\\lim_{x\\to c} \\frac{f(x)}{g(x)} = \\lim_{x\\to c} \\frac{f\'(x)}{g\'(x)} \\quad \\text{for } \\left[\\frac{0}{0}\\right] \\text{ or } \\left[\\frac{\\pm\\infty}{\\pm\\infty}\\right]',
    definition: 'Analytical method converting indeterminate limits of quotients into limits of derivatives.',
    statement: 'If lim f(x)/g(x) yields 0/0 or ±∞/±∞, and f and g are differentiable near c with g\'(x) ≠ 0, then the limit of f/g equals the limit of f\'/g\'.',
    variables: { f: 'numerator function', g: 'denominator function', c: 'limiting point' },
    conditions: 'Indeterminate form 0/0 or ±∞/±∞; g\'(x) ≠ 0 near c; derivative limit must exist or be ±∞.',
    examples: ['lim_{x->0} (sin x)/x = lim_{x->0} (cos x)/1 = 1.'],
    relatedEntries: ['derivative-definition-rules'],
    aliases: ['lhopital', 'lhopitals rule', 'indeterminate limits'],
    computationalOp: 'evaluate'
  },
  {
    id: 'mean-value-theorem',
    title: 'Mean Value Theorem (MVT) & Rolle\'s Theorem',
    category: 'calculus-differential',
    categoryName: 'Differential Calculus',
    subdomain: 'Theoretical Calculus',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: '\\exists c \\in (a, b) : f\'(c) = \\frac{f(b) - f(a)}{b - a}',
    definition: 'Theorem stating that a continuous, differentiable curve has at least one point where its instantaneous slope matches the average secant slope.',
    statement: 'If f is continuous on [a, b] and differentiable on (a, b), there exists at least one c in (a, b) such that f\'(c) equals the average rate of change (f(b) - f(a))/(b - a). If f(a) = f(b), f\'(c) = 0 (Rolle\'s Theorem).',
    variables: { a: 'interval start', b: 'interval end', c: 'intermediate point' },
    conditions: 'Continuous on closed [a, b], differentiable on open (a, b).',
    examples: ['For f(x) = x² on [0, 2]: f\'(c) = 2c = (4 - 0)/(2 - 0) = 2 -> c = 1.'],
    relatedEntries: ['derivative-definition-rules', 'fundamental-theorem-of-calculus'],
    aliases: ['mvt', 'mean value theorem', 'rolles theorem'],
    computationalOp: null
  },

  // ==========================================
  // 17. INTEGRAL CALCULUS
  // ==========================================
  {
    id: 'fundamental-theorem-of-calculus',
    title: 'Fundamental Theorem of Calculus (FTC)',
    category: 'calculus-integral',
    categoryName: 'Integral Calculus',
    subdomain: 'Integration',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: '\\frac{d}{dx} \\left[ \\int_a^x f(t) dt \\right] = f(x), \\quad \\int_a^b f(x) dx = F(b) - F(a) \\; (F\' = f)',
    definition: 'The central theorem of mathematical analysis linking differentiation and integration as inverse processes.',
    statement: 'Part 1: The derivative of the accumulation function is the original function f(x). Part 2: Definite integrals can be evaluated by evaluating any antiderivative F at the bounds: F(b) - F(a).',
    variables: { f: 'integrand', F: 'antiderivative of f', a: 'lower limit', b: 'upper limit' },
    conditions: 'f must be continuous on [a, b].',
    examples: ['∫_0^3 2x dx = [x²]_0^3 = 9 - 0 = 9.'],
    relatedEntries: ['integration-by-parts', 'derivative-definition-rules'],
    aliases: ['ftc', 'fundamental theorem of calculus', 'definite integral theorem'],
    computationalOp: 'integral'
  },
  {
    id: 'integration-by-parts',
    title: 'Integration by Parts',
    category: 'calculus-integral',
    categoryName: 'Integral Calculus',
    subdomain: 'Integration Techniques',
    proofStatus: PROOF_STATUS.IDENTITY,
    formula: '\\int u \\, dv = uv - \\int v \\, du, \\quad \\int_a^b u v\' dx = [uv]_a^b - \\int_a^b v u\' dx',
    definition: 'Integration counterpart to the product rule of differentiation.',
    statement: 'Transforms the integral of a product of two functions into an evaluation term uv minus a simpler integral ∫ v du. Selection prioritized by LIATE rule (Logarithmic, Inverse trig, Algebraic, Trig, Exponential).',
    variables: { u: 'differentiated part', dv: 'integrated part', du: 'differential u\' dx', v: 'antiderivative of dv' },
    conditions: 'u and v continuously differentiable on the interval.',
    examples: ['∫ x e^x dx: u = x, dv = e^x dx -> x e^x - ∫ e^x dx = (x - 1)e^x + C.'],
    relatedEntries: ['fundamental-theorem-of-calculus', 'partial-fractions-decomposition'],
    aliases: ['integration by parts', 'ibp', 'product integration'],
    computationalOp: 'integral'
  },

  // ==========================================
  // 18. MULTIVARIABLE CALCULUS
  // ==========================================
  {
    id: 'gradient-directional-derivative',
    title: 'Gradient Vector, Directional Derivative & Tangent Plane',
    category: 'calculus-multivariable',
    categoryName: 'Multivariable Calculus',
    subdomain: 'Multivariable Differentiation',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: '\\nabla f = \\left( \\frac{\\partial f}{\\partial x}, \\frac{\\partial f}{\\partial y}, \\frac{\\partial f}{\\partial z} \\right), \\quad D_\\mathbf{u} f = \\nabla f \\cdot \\mathbf{u}',
    definition: 'Vector of first partial derivatives indicating the direction and magnitude of steepest ascent of a scalar field.',
    statement: 'The gradient ∇f points in the direction of maximum increase, with magnitude ||∇f|| representing the maximum rate of change. The directional derivative along unit vector u is the dot product ∇f · u.',
    variables: { f: 'scalar field f(x, y, z)', '\\nabla f': 'gradient vector', '\\mathbf{u}': 'unit direction vector' },
    conditions: 'f must be continuously differentiable.',
    examples: ['f(x, y) = x² + y² -> ∇f = (2x, 2y); at (1, 2), ∇f = (2, 4), max rate = √20.'],
    relatedEntries: ['divergence-and-curl', 'lagrange-multipliers'],
    aliases: ['gradient', 'directional derivative', 'del operator', 'steepest ascent'],
    computationalOp: null
  },
  {
    id: 'lagrange-multipliers',
    title: 'Method of Lagrange Multipliers',
    category: 'calculus-multivariable',
    categoryName: 'Multivariable Calculus',
    subdomain: 'Constrained Optimization',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: '\\nabla f(x, y, z) = \\lambda \\nabla g(x, y, z), \\quad g(x, y, z) = c',
    definition: 'Analytical strategy for finding local maxima and minima of a function subject to equality constraints.',
    statement: 'At an extremum of f subject to constraint g = c, the gradient of f is collinear with the gradient of g, scaled by the Lagrange multiplier λ.',
    variables: { f: 'objective function', g: 'constraint function', '\\lambda': 'Lagrange multiplier' },
    conditions: '∇g ≠ 0 on constraint surface; f and g continuously differentiable.',
    examples: ['Max xy subject to x + y = 10: ∇f = (y, x), ∇g = (1, 1) -> y = λ, x = λ -> x = y = 5.'],
    relatedEntries: ['gradient-directional-derivative'],
    aliases: ['lagrange multipliers', 'constrained optimization', 'extrema with constraints'],
    computationalOp: null
  },

  // ==========================================
  // 19. VECTOR CALCULUS
  // ==========================================
  {
    id: 'divergence-and-curl',
    title: 'Divergence, Curl, and Vector Laplacian',
    category: 'vector-calculus',
    categoryName: 'Vector Calculus',
    subdomain: 'Differential Vector Operators',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: '\\nabla \\cdot \\mathbf{F} = \\frac{\\partial F_x}{\\partial x} + \\frac{\\partial F_y}{\\partial y} + \\frac{\\partial F_z}{\\partial z}, \\quad \\nabla \\times \\mathbf{F} = \\begin{vmatrix} \\mathbf{i} & \\mathbf{j} & \\mathbf{k} \\\\ \\partial_x & \\partial_y & \\partial_z \\\\ F_x & F_y & F_z \\end{vmatrix}',
    definition: 'Fundamental spatial derivative operators measuring flux density (divergence) and rotational circulation (curl) of vector fields.',
    statement: 'Divergence measures local net outflow per unit volume (div F = 0 -> incompressible / solenoidal). Curl measures infinitesimal circulation / rotation (curl F = 0 -> irrotational / conservative). Identity: curl(grad f) = 0 and div(curl F) = 0.',
    variables: { '\\mathbf{F}': 'vector field (F_x, F_y, F_z)', '\\nabla': 'vector del operator' },
    conditions: 'Components of F twice continuously differentiable.',
    examples: ['For F = (y, -x, 0), div F = 0, curl F = (0, 0, -2) (rotational vortex field).'],
    relatedEntries: ['greens-theorem', 'stokes-theorem-divergence'],
    aliases: ['divergence', 'curl', 'div and curl', 'solenoidal', 'irrotational'],
    computationalOp: null
  },
  {
    id: 'greens-theorem',
    title: 'Green\'s Theorem in the Plane',
    category: 'vector-calculus',
    categoryName: 'Vector Calculus',
    subdomain: 'Integral Vector Theorems',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: '\\oint_C (P dx + Q dy) = \\iint_D \\left( \\frac{\\partial Q}{\\partial x} - \\frac{\\partial P}{\\partial y} \\right) dA',
    definition: 'The 2D precursor to Stokes\' theorem relating a line integral around a simple closed curve C to a double integral over the enclosed plane region D.',
    statement: 'The counter-clockwise circulation of a vector field (P, Q) along boundary curve C equals the integrated microscopic 2D curl over the interior domain D.',
    variables: { P: 'x-component of field', Q: 'y-component of field', C: 'positively oriented boundary', D: 'plane region' },
    conditions: 'C simple, closed, piecewise-smooth; P and Q continuous partial derivatives on D.',
    examples: ['Area of domain D = (1/2) ∮_C (x dy - y dx).'],
    relatedEntries: ['stokes-theorem-divergence', 'divergence-and-curl'],
    aliases: ['greens theorem', 'green theorem plane', 'circulation double integral'],
    computationalOp: null
  },
  {
    id: 'stokes-theorem-divergence',
    title: 'Stokes\' Theorem and the Divergence Theorem (Gauss)',
    category: 'vector-calculus',
    categoryName: 'Vector Calculus',
    subdomain: 'Integral Vector Theorems',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: '\\oint_C \\mathbf{F} \\cdot d\\mathbf{r} = \\iint_S (\\nabla \\times \\mathbf{F}) \\cdot d\\mathbf{S}, \\quad \\iint_S \\mathbf{F} \\cdot d\\mathbf{S} = \\iiint_V (\\nabla \\cdot \\mathbf{F}) dV',
    definition: 'Universal integral theorems of vector calculus connecting boundary circulation/flux with interior curl/divergence.',
    statement: 'Stokes\' Theorem equates circulation around loop C to the flux of curl F through surface S. Gauss\'s Divergence Theorem equates net outward flux through closed surface S to the volume integral of div F throughout interior V.',
    variables: { '\\mathbf{F}': 'vector field', S: 'surface', C: 'boundary curve', V: 'enclosed 3D volume' },
    conditions: 'Smooth orientable surfaces and piecewise-smooth boundaries.',
    examples: ['Electrostatic Gauss\'s Law: ∬ E · dS = Q_enclosed / ε₀ = ∭ (ρ/ε₀) dV.'],
    relatedEntries: ['greens-theorem', 'divergence-and-curl'],
    aliases: ['stokes theorem', 'divergence theorem', 'gauss theorem', 'flux theorem'],
    computationalOp: null
  },

  // ==========================================
  // 20. DIFFERENTIAL EQUATIONS (ODEs)
  // ==========================================
  {
    id: 'first-order-linear-ode',
    title: 'First-Order Linear ODEs & Integrating Factor',
    category: 'differential-equations',
    categoryName: 'Differential Equations',
    subdomain: 'First-Order ODEs',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: '\\frac{dy}{dx} + P(x)y = Q(x) \\implies y(x) = \\frac{1}{I(x)} \\int I(x)Q(x) dx, \\quad I(x) = e^{\\int P(x) dx}',
    definition: 'General method solving any first-order linear ordinary differential equation using an integrating factor I(x).',
    statement: 'Multiplying through by I(x) = exp(∫ P(x) dx) transforms the left-hand side into the exact derivative d/dx [y · I(x)], which is then integrated directly.',
    variables: { 'P(x)': 'coefficient function of y', 'Q(x)': 'non-homogeneous driving function', 'I(x)': 'integrating factor' },
    conditions: 'P(x) and Q(x) continuous on interval.',
    examples: ['dy/dx + 2y = 4: I(x) = e^(2x) -> y · e^(2x) = ∫ 4e^(2x) dx = 2e^(2x) + C -> y = 2 + C e^(-2x).'],
    relatedEntries: ['second-order-linear-ode-constant-coeff', 'laplace-transforms-table'],
    aliases: ['integrating factor', 'first order ode', 'linear ode', 'leibniz ode'],
    computationalOp: null
  },
  {
    id: 'second-order-linear-ode-constant-coeff',
    title: 'Second-Order Linear ODEs with Constant Coefficients',
    category: 'differential-equations',
    categoryName: 'Differential Equations',
    subdomain: 'Second-Order ODEs',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'a y\'\' + b y\' + c y = 0 \\iff a r^2 + b r + c = 0 \\implies y_h(x) = c_1 e^{r_1 x} + c_2 e^{r_2 x}',
    definition: 'Fundamental engineering ODE modeling damped harmonic oscillators, RLC circuits, and vibrations.',
    statement: 'Solution behavior is dictated by auxiliary roots r: distinct real (exponential growth/decay), repeated real (x e^(rx)), or complex conjugate α ± iβ (damped sinusoidal oscillations e^(αx)(c₁ cos βx + c₂ sin βx)).',
    variables: { a: 'mass / inductance parameter', b: 'damping / resistance parameter', c: 'spring / capacitance parameter', r: 'characteristic root' },
    conditions: 'Constant real coefficients a ≠ 0.',
    examples: ['y\'\' + 4y = 0: r² + 4 = 0 -> r = ±2i -> y(x) = c₁ cos(2x) + c₂ sin(2x).'],
    relatedEntries: ['first-order-linear-ode', 'laplace-transforms-table'],
    aliases: ['second order ode', 'auxiliary equation', 'harmonic oscillator ode', 'constant coefficient ode'],
    computationalOp: null
  },

  // ==========================================
  // 21. PARTIAL DIFFERENTIAL EQUATIONS (PDEs)
  // ==========================================
  {
    id: 'classical-pdes-heat-wave-laplace',
    title: 'Classical PDEs: Heat, Wave, and Laplace Equations',
    category: 'pde',
    categoryName: 'Partial Differential Equations',
    subdomain: 'Boundary Value Problems',
    proofStatus: PROOF_STATUS.LAW,
    formula: '\\frac{\\partial u}{\\partial t} = \\alpha \\nabla^2 u \\; (\\text{Heat}), \\quad \\frac{\\partial^2 u}{\\partial t^2} = c^2 \\nabla^2 u \\; (\\text{Wave}), \\quad \\nabla^2 u = 0 \\; (\\text{Laplace})',
    definition: 'The three canonical second-order partial differential equations governing parabolic diffusion, hyperbolic wave propagation, and elliptic equilibrium potentials.',
    statement: 'Parabolic Heat equation models thermal diffusion; Hyperbolic Wave equation models mechanical vibrations and acoustics; Elliptic Laplace equation models steady-state electrostatic and gravitational potentials. Solved via separation of variables u(x,t) = X(x)T(t).',
    variables: { u: 'state field (temperature, displacement, potential)', '\\alpha': 'thermal diffusivity', c: 'wave propagation speed', '\\nabla^2': 'Laplacian operator' },
    conditions: 'Specified boundary conditions (Dirichlet, Neumann, Robin) and initial conditions.',
    examples: ['1D Wave equation on string length L with fixed ends: normal modes u_n(x, t) = sin(nπx/L) cos(nπct/L).'],
    relatedEntries: ['fourier-series-coefficients', 'divergence-and-curl'],
    aliases: ['heat equation', 'wave equation', 'laplace equation', 'separation of variables', 'pde'],
    computationalOp: null
  },

  // ==========================================
  // 22. LAPLACE TRANSFORMS
  // ==========================================
  {
    id: 'laplace-transforms-table',
    title: 'Laplace Transform Definition & Standard Pairs Table',
    category: 'laplace-transforms',
    categoryName: 'Laplace Transforms',
    subdomain: 'Integral Transforms',
    proofStatus: PROOF_STATUS.IDENTITY,
    formula: '\\mathcal{L}\\{f(t)\\} = F(s) = \\int_0^\\infty e^{-st} f(t) dt, \\quad \\mathcal{L}\\{t^n\\} = \\frac{n!}{s^{n+1}}, \\quad \\mathcal{L}\\{e^{at}\\} = \\frac{1}{s - a}',
    definition: 'Integral transform converting differential equations in the time domain t into algebraic equations in the complex frequency domain s.',
    statement: 'Standard transform pairs:\n1. L{1} = 1/s\n2. L{t^n} = n! / s^(n+1)\n3. L{e^(at)} = 1 / (s - a)\n4. L{sin(ωt)} = ω / (s² + ω²)\n5. L{cos(ωt)} = s / (s² + ω²)\n6. L{sinh(at)} = a / (s² - a²)\n7. L{cosh(at)} = s / (s² - a²)\n8. L{f\'(t)} = s F(s) - f(0)\n9. L{f\'\'(t)} = s² F(s) - s f(0) - f\'(0)\n10. Shifting: L{e^(at) f(t)} = F(s - a).',
    variables: { t: 'time domain variable (t ≥ 0)', s: 'complex frequency variable (σ + iω)', 'F(s)': 'Laplace domain function' },
    conditions: 'Function f(t) must be piecewise continuous and of exponential order.',
    examples: ['L{t²} = 2! / s³ = 2/s³; L{e^(3t) cos(2t)} = (s - 3) / ((s - 3)² + 4).'],
    relatedEntries: ['fourier-series-coefficients', 'first-order-linear-ode'],
    aliases: ['laplace transform', 'laplace table', 'frequency domain transform', 'solving odes laplace'],
    computationalOp: null
  },

  // ==========================================
  // 23. FOURIER ANALYSIS
  // ==========================================
  {
    id: 'fourier-series-coefficients',
    title: 'Fourier Series & Euler-Fourier Formulas',
    category: 'fourier-analysis',
    categoryName: 'Fourier Analysis',
    subdomain: 'Harmonic Analysis',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'f(x) = \\frac{a_0}{2} + \\sum_{n=1}^\\infty \\left( a_n \\cos\\frac{n\\pi x}{L} + b_n \\sin\\frac{n\\pi x}{L} \\right), \\quad a_n = \\frac{1}{L} \\int_{-L}^L f(x) \\cos\\frac{n\\pi x}{L} dx',
    definition: 'Representation of any piecewise smooth periodic function as an infinite superposition of sines and cosines.',
    statement: 'For a function of period 2L satisfying Dirichlet conditions: a_0 is twice the average value; for even functions, b_n = 0 (cosine series); for odd functions, a_n = 0 (sine series). Complex exponential form: f(x) = ∑ c_n e^(i n π x / L).',
    variables: { '2L': 'period of function', a_n: 'cosine Fourier coefficient', b_n: 'sine Fourier coefficient', c_n: 'complex Fourier coefficient' },
    conditions: 'Dirichlet conditions: f has a finite number of discontinuities and extrema in any period.',
    examples: ['Square wave of period 2π: f(x) = (4/π) [sin x + (1/3)sin 3x + (1/5)sin 5x + ...].'],
    relatedEntries: ['laplace-transforms-table', 'classical-pdes-heat-wave-laplace'],
    aliases: ['fourier series', 'fourier coefficients', 'harmonic analysis', 'fourier expansion'],
    computationalOp: null
  },

  // ==========================================
  // 24. Z-TRANSFORM
  // ==========================================
  {
    id: 'z-transform-definition-pairs',
    title: 'Z-Transform & Discrete-Time Transfer Functions',
    category: 'z-transform',
    categoryName: 'Z-Transform',
    subdomain: 'Discrete-Time Systems',
    proofStatus: PROOF_STATUS.IDENTITY,
    formula: '\\mathcal{Z}\\{x[n]\\} = X(z) = \\sum_{n=-\\infty}^\\infty x[n] z^{-n}, \\quad \\mathcal{Z}\\{a^n u[n]\\} = \\frac{1}{1 - a z^{-1}} = \\frac{z}{z - a}',
    definition: 'The discrete-time counterpart to the Laplace transform, converting discrete sequences and difference equations into complex z-domain algebraic representations.',
    statement: 'Standard pairs: Z{δ[n]} = 1; Z{u[n]} = z/(z-1); Z{a^n u[n]} = z/(z-a) for |z| > |a|; Time-shift: Z{x[n-k]} = z^(-k) X(z); Convolution: Z{x[n] * h[n]} = X(z) H(z).',
    variables: { 'x[n]': 'discrete sequence', 'u[n]': 'unit step sequence', z: 'complex variable', 'X(z)': 'Z-domain transform' },
    conditions: 'Convergence within specified Region of Convergence (ROC).',
    examples: ['Z{0.5^n u[n]} = z / (z - 0.5) with ROC |z| > 0.5.'],
    relatedEntries: ['laplace-transforms-table'],
    aliases: ['z transform', 'discrete laplace', 'difference equations z transform'],
    computationalOp: null
  },

  // ==========================================
  // 25. NUMERICAL METHODS
  // ==========================================
  {
    id: 'newton-raphson-method',
    title: 'Newton-Raphson Method for Root Finding',
    category: 'numerical-methods',
    categoryName: 'Numerical Methods',
    subdomain: 'Non-linear Equations',
    proofStatus: PROOF_STATUS.ALGORITHM,
    formula: 'x_{n+1} = x_n - \\frac{f(x_n)}{f\'(x_n)}, \\quad |x_{n+1} - x_n| < \\epsilon',
    definition: 'Iterative root-finding algorithm that produces successively better approximations to the roots (zeroes) of a real-valued function.',
    statement: 'Starts with initial guess x_0 and projects tangent line slope f\'(x_n) to intersect the x-axis at x_(n+1). Exhibits quadratic convergence near simple roots: error e_(n+1) ≈ C e_n².',
    variables: { x_n: 'current approximation', 'f(x_n)': 'function value at x_n', 'f\'(x_n)': 'derivative value at x_n', '\\epsilon': 'convergence tolerance' },
    conditions: 'f\'(x_n) ≠ 0; initial guess x_0 sufficiently close to root.',
    examples: ['To find √2, solve x² - 2 = 0: x_(n+1) = (x_n + 2/x_n)/2. Starting at x_0=1: x_1=1.5, x_2=1.4167, x_3=1.4142136.'],
    relatedEntries: ['taylor-series-maclaurin', 'derivative-definition-rules'],
    aliases: ['newton raphson', 'newtons method', 'root finding', 'iterative root finder'],
    computationalOp: 'newton_raphson'
  },
  {
    id: 'runge-kutta-rk4-method',
    title: 'Runge-Kutta 4th-Order Method (RK4)',
    category: 'numerical-methods',
    categoryName: 'Numerical Methods',
    subdomain: 'Numerical ODEs',
    proofStatus: PROOF_STATUS.ALGORITHM,
    formula: 'y_{n+1} = y_n + \\frac{h}{6}(k_1 + 2k_2 + 2k_3 + k_4), \\quad k_1 = f(x_n, y_n), \\; k_2 = f(x_n + \\frac{h}{2}, y_n + \\frac{h}{2}k_1)',
    definition: 'High-accuracy explicit numerical method solving initial-value ODEs y\' = f(x, y) with local truncation error of order O(h⁵) and global error O(h⁴).',
    statement: 'Advances y_n to y_(n+1) across step size h using a weighted average of four slope estimates: k_1 (start), k_2 (midpoint using k_1), k_3 (midpoint using k_2), and k_4 (endpoint using k_3).',
    variables: { h: 'step size', x_n: 'independent variable at step n', y_n: 'state vector at step n', k_i: 'slope evaluations' },
    conditions: 'f(x, y) sufficiently smooth; step size h chosen within stability region.',
    examples: ['Solving dy/dx = y, y(0)=1 with h=0.1: produces y(0.1) ≈ 1.1051708 (exact e^0.1 = 1.1051709).'],
    relatedEntries: ['first-order-linear-ode', 'newton-raphson-method'],
    aliases: ['rk4', 'runge kutta', 'numerical ode', '4th order runge kutta'],
    computationalOp: 'ode_rk4'
  },
  {
    id: 'numerical-integration-simpson',
    title: 'Simpson\'s 1/3 Rule for Numerical Quadrature',
    category: 'numerical-methods',
    categoryName: 'Numerical Methods',
    subdomain: 'Numerical Quadrature',
    proofStatus: PROOF_STATUS.ALGORITHM,
    formula: '\\int_a^b f(x) dx \\approx \\frac{h}{3} \\left[ f(x_0) + 4 \\sum_{\\text{odd}} f(x_i) + 2 \\sum_{\\text{even}} f(x_i) + f(x_n) \\right], \\quad h = \\frac{b-a}{n}',
    definition: 'Composite numerical integration method that approximates the integrand using piecewise parabolic arcs across subintervals.',
    statement: 'For an even number of intervals n, Simpson\'s 1/3 rule yields exact results for polynomials up to degree 3, with truncation error proportional to h⁴ f⁴(ξ).',
    variables: { a: 'lower limit', b: 'upper limit', n: 'even number of subintervals', h: 'step width' },
    conditions: 'Subintervals n must be even.',
    examples: ['Integrating 2x from 0 to 2 with n=2: h=1 -> (1/3)[0 + 4(2) + 4] = 12/3 = 4 (exact).'],
    relatedEntries: ['fundamental-theorem-of-calculus'],
    aliases: ['simpsons rule', 'simpson 1/3', 'numerical integration', 'quadrature'],
    computationalOp: 'integral'
  },

  // ==========================================
  // 26. PROBABILITY & STATISTICS
  // ==========================================
  {
    id: 'bayes-theorem',
    title: 'Bayes\' Theorem & Law of Total Probability',
    category: 'probability',
    categoryName: 'Probability',
    subdomain: 'Conditional Probability',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'P(A \\mid B) = \\frac{P(B \\mid A) P(A)}{P(B)} = \\frac{P(B \\mid A) P(A)}{\\sum_i P(B \\mid A_i) P(A_i)}',
    definition: 'Fundamental theorem of probability calculating the posterior probability of an event given prior belief and observed evidence.',
    statement: 'Relates conditional probability P(A|B) to its inverse conditional probability P(B|A), normalized by total marginal probability P(B).',
    variables: { 'P(A \\mid B)': 'posterior probability', 'P(B \\mid A)': 'likelihood of evidence', 'P(A)': 'prior probability', 'P(B)': 'marginal evidence probability' },
    conditions: 'P(B) > 0.',
    examples: ['Medical testing: Prior disease rate 1%, test accuracy 95% -> posterior probability given positive test is calculated directly via Bayes\' formula.'],
    relatedEntries: ['normal-distribution-clt'],
    aliases: ['bayes theorem', 'bayes rule', 'conditional probability', 'posterior probability'],
    computationalOp: 'evaluate'
  },
  {
    id: 'normal-distribution-clt',
    title: 'Normal Distribution & Central Limit Theorem (CLT)',
    category: 'probability',
    categoryName: 'Probability',
    subdomain: 'Continuous Distributions',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'f(x) = \\frac{1}{\\sigma \\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x - \\mu}{\\sigma}\\right)^2}, \\quad \\bar{X}_n \\xrightarrow{d} \\mathcal{N}\\left(\\mu, \\frac{\\sigma^2}{n}\\right)',
    definition: 'The Gaussian distribution and the theorem stating that the normalized sum of independent random variables converges to a normal distribution.',
    statement: 'For any independent and identically distributed random variables with mean μ and variance σ², the sample mean of n variables approaches a normal distribution N(μ, σ²/n) as n -> ∞, regardless of the underlying distribution shape.',
    variables: { '\\mu': 'mean', '\\sigma': 'standard deviation', n: 'sample size', '\\bar{X}': 'sample mean' },
    conditions: 'Finite population variance σ² < ∞; independent samples.',
    examples: ['Empirical 68-95-99.7 rule: 68.27% of data falls within 1σ of mean, 95.45% within 2σ, 99.73% within 3σ.'],
    relatedEntries: ['bayes-theorem', 'linear-regression-least-squares'],
    aliases: ['normal distribution', 'gaussian distribution', 'central limit theorem', 'clt', 'bell curve'],
    computationalOp: 'statistics'
  },
  {
    id: 'linear-regression-least-squares',
    title: 'Simple Linear Regression & Pearson Correlation',
    category: 'statistics',
    categoryName: 'Statistics',
    subdomain: 'Statistical Modeling',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'y = mx + c, \\quad m = \\frac{n\\sum xy - \\sum x\\sum y}{n\\sum x^2 - (\\sum x)^2}, \\quad r = \\frac{\\text{Cov}(X, Y)}{\\sigma_X \\sigma_Y}',
    definition: 'Best-fit line minimizing the sum of squared vertical residuals between observed data points and model predictions.',
    statement: 'The least-squares line y = mx + c passes through the data centroid (x̄, ȳ). Pearson correlation coefficient r ranges from -1 to +1; coefficient of determination R² measures the proportion of variance explained.',
    variables: { m: 'regression slope', c: 'y-intercept', r: 'Pearson correlation coefficient', 'R^2': 'coefficient of determination' },
    conditions: 'Linearity and homoscedasticity of residuals.',
    examples: ['For points (1, 2), (2, 4), (3, 6): exact slope m = 2, c = 0, correlation r = 1.0 (perfect positive linear correlation).'],
    relatedEntries: ['normal-distribution-clt'],
    aliases: ['linear regression', 'least squares', 'pearson correlation', 'line of best fit'],
    computationalOp: 'linear_regression'
  },

  // ==========================================
  // 27. COMBINATORICS & DISCRETE MATH
  // ==========================================
  {
    id: 'binomial-theorem',
    title: 'Binomial Theorem & Pascal\'s Identity',
    category: 'combinatorics',
    categoryName: 'Combinatorics',
    subdomain: 'Combinatorial Identities',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: '(x + y)^n = \\sum_{k=0}^n \\binom{n}{k} x^{n-k} y^k, \\quad \\binom{n}{k} + \\binom{n}{k-1} = \\binom{n+1}{k}',
    definition: 'Algebraic expansion of powers of a binomial into a sum involving binomial coefficients n choose k.',
    statement: 'Coefficients are given by C(n, k) = n! / (k!(n-k)!), corresponding directly to the n-th row of Pascal\'s triangle.',
    variables: { n: 'power exponent (non-negative integer)', k: 'term index', '\\binom{n}{k}': 'combinations formula' },
    conditions: 'Non-negative integer n (generalized to complex α via Newton series).',
    examples: ['(x + y)³ = x³ + 3x²y + 3xy² + y³; coefficients are 1, 3, 3, 1.'],
    relatedEntries: ['power-set-theorem', 'combinations-formula'],
    aliases: ['binomial theorem', 'pascals triangle', 'pascals identity', 'binomial expansion'],
    computationalOp: 'combinations'
  },

  // ==========================================
  // 28. GRAPH THEORY
  // ==========================================
  {
    id: 'eulers-formula-graphs-polyhedra',
    title: 'Euler\'s Formula for Planar Graphs & Polyhedra',
    category: 'graph-theory',
    categoryName: 'Graph Theory',
    subdomain: 'Topological Graph Theory',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'V - E + F = 2 \\quad (\\text{Polyhedra / Connected Planar Graphs})',
    definition: 'Topological relationship invariant connecting the number of vertices, edges, and faces of a connected planar graph or convex polyhedron.',
    statement: 'For any finite connected planar graph drawn without edge crossings, the number of vertices V minus edges E plus faces F always equals 2 (the Euler characteristic of a 2-sphere).',
    variables: { V: 'number of vertices', E: 'number of edges', F: 'number of faces' },
    conditions: 'Connected planar graph with non-intersecting edges; convex 3D polyhedron.',
    examples: ['Cube: V = 8, E = 12, F = 6 -> 8 - 12 + 6 = 2; Tetrahedron: 4 - 6 + 4 = 2.'],
    relatedEntries: ['peano-axioms'],
    aliases: ['eulers formula graphs', 'euler characteristic', 'v - e + f = 2', 'planar graphs'],
    computationalOp: null
  },

  // ==========================================
  // 29. SPECIAL FUNCTIONS
  // ==========================================
  {
    id: 'gamma-function-properties',
    title: 'Gamma Function & Factorial Continuation',
    category: 'special-functions',
    categoryName: 'Special Functions',
    subdomain: 'Transcendental Functions',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: '\\Gamma(z) = \\int_0^\\infty t^{z-1} e^{-t} dt, \\quad \\Gamma(n) = (n-1)!, \\quad \\Gamma(1/2) = \\sqrt{\\pi}',
    definition: 'The canonical smooth analytic continuation of the factorial function to complex and real numbers with Re(z) > 0.',
    statement: 'Satisfies functional equation Γ(z + 1) = z Γ(z). For positive integers n, Γ(n + 1) = n!. Evaluates the Gaussian integral at z = 1/2: Γ(1/2) = √π.',
    variables: { z: 'complex argument', t: 'integration dummy variable' },
    conditions: 'Re(z) > 0 for integral; extended by analytic continuation across all complex plane except non-positive integers.',
    examples: ['Γ(4) = 3! = 6; Γ(5/2) = (3/2)(1/2)√π = (3/4)√π.'],
    relatedEntries: ['normal-distribution-clt'],
    aliases: ['gamma function', 'generalized factorial', 'euler gamma function'],
    computationalOp: 'evaluate'
  },

  // ==========================================
  // 30. MATHEMATICAL PHYSICS
  // ==========================================
  {
    id: 'maxwell-equations-differential',
    title: 'Maxwell\'s Equations in Differential Form',
    category: 'mathematical-physics',
    categoryName: 'Mathematical Physics Formulas',
    subdomain: 'Electrodynamics',
    proofStatus: PROOF_STATUS.LAW,
    formula: '\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}, \\; \\nabla \\cdot \\mathbf{B} = 0, \\; \\nabla \\times \\mathbf{E} = -\\frac{\\partial \\mathbf{B}}{\\partial t}, \\; \\nabla \\times \\mathbf{B} = \\mu_0 \\mathbf{J} + \\mu_0\\varepsilon_0 \\frac{\\partial \\mathbf{E}}{\\partial t}',
    definition: 'The four fundamental partial differential equations of classical electrodynamics relating electric and magnetic fields to charges and currents.',
    statement: '1. Gauss\'s Law (electric divergence from charge); 2. Gauss\'s Magnetism Law (no magnetic monopoles); 3. Faraday\'s Induction Law; 4. Ampère-Maxwell Law (displacement current). Together they predict electromagnetic waves with speed c = 1/√(μ₀ε₀).',
    variables: { '\\mathbf{E}': 'electric field', '\\mathbf{B}': 'magnetic field', '\\rho': 'charge density', '\\mathbf{J}': 'current density', '\\varepsilon_0': 'permittivity of free space', '\\mu_0': 'permeability of free space' },
    conditions: 'Classical continuum electrodynamics.',
    examples: ['In vacuum (ρ=0, J=0): taking curl of Faraday yields the wave equation ∇²E = (1/c²) ∂²E/∂t².'],
    relatedEntries: ['divergence-and-curl', 'classical-pdes-heat-wave-laplace'],
    aliases: ['maxwells equations', 'maxwell equations', 'electromagnetic equations'],
    computationalOp: null
  },
  {
    id: 'schrodinger-equation',
    title: 'Time-Dependent & Time-Independent Schrödinger Equation',
    category: 'mathematical-physics',
    categoryName: 'Mathematical Physics Formulas',
    subdomain: 'Quantum Mechanics',
    proofStatus: PROOF_STATUS.LAW,
    formula: 'i\\hbar \\frac{\\partial \\Psi}{\\partial t} = \\hat{H}\\Psi = \\left( -\\frac{\\hbar^2}{2m}\\nabla^2 + V(\\mathbf{r}) \\right) \\Psi, \\quad \\hat{H}\\psi = E\\psi',
    definition: 'Fundamental differential equation of non-relativistic quantum mechanics describing how the quantum state wave function of a physical system evolves over time.',
    statement: 'The Hamiltonian operator Ĥ governs temporal evolution. For conservative potentials, separation of variables yields the eigenvalue problem Ĥψ = Eψ, where eigenvalues E represent quantized energy levels.',
    variables: { '\\Psi': 'wave function', '\\hbar': 'reduced Planck constant', m: 'particle mass', 'V(\\mathbf{r})': 'potential energy', E: 'energy eigenvalue' },
    conditions: 'Non-relativistic quantum systems.',
    examples: ['Particle in a 1D infinite potential well of width L: E_n = n² π² ℏ² / (2 m L²), n = 1, 2, 3...'],
    relatedEntries: ['classical-pdes-heat-wave-laplace', 'eigenvalues-eigenvectors-characteristic'],
    aliases: ['schrodinger equation', 'quantum wave equation', 'schroedinger equation'],
    computationalOp: null
  },

  // ==========================================
  // 31. DEDICATED ENGINEERING MATHEMATICS
  // ==========================================
  {
    id: 'engineering-laplace-circuit-transfer',
    title: 'Engineering Circuit & System Transfer Function (s-Domain)',
    category: 'engineering-math',
    categoryName: 'Engineering Mathematics Reference',
    subdomain: 'Linear Systems & Control',
    proofStatus: PROOF_STATUS.THEOREM,
    formula: 'H(s) = \\frac{Y(s)}{X(s)} = \\frac{b_m s^m + \\dots + b_0}{a_n s^n + \\dots + a_0}, \\quad Z_R = R, \\; Z_L = sL, \\; Z_C = \\frac{1}{sC}',
    definition: 'Standard engineering formulation representing linear time-invariant (LTI) electrical circuits and control systems in the Laplace s-domain.',
    statement: 'Components are replaced by algebraic impedances: Resistor R -> R, Inductor L -> sL, Capacitor C -> 1/(sC). System transfer function H(s) gives output Y(s) = H(s) X(s). System poles (roots of denominator) determine transient stability.',
    variables: { 'H(s)': 'transfer function', R: 'resistance', L: 'inductance', C: 'capacitance', s: 'complex Laplace parameter' },
    conditions: 'Zero initial conditions for transfer function analysis; linear time-invariant system.',
    examples: ['Series RLC circuit output across capacitor: H(s) = (1/LC) / (s² + (R/L)s + 1/LC).'],
    relatedEntries: ['laplace-transforms-table', 'second-order-linear-ode-constant-coeff'],
    aliases: ['transfer function', 's domain impedance', 'circuit transfer function', 'control systems laplace'],
    computationalOp: null
  },
  {
    id: 'engineering-fourier-harmonic-thd',
    title: 'Total Harmonic Distortion (THD) & Fourier Harmonics',
    category: 'engineering-math',
    categoryName: 'Engineering Mathematics Reference',
    subdomain: 'Power & Signal Engineering',
    proofStatus: PROOF_STATUS.IDENTITY,
    formula: '\\text{THD} = \\frac{\\sqrt{V_2^2 + V_3^2 + V_4^2 + \\dots}}{V_1} \\times 100\\%, \\quad P = \\sum_{n=1}^\\infty V_n I_n \\cos\\phi_n',
    definition: 'Standard electrical and audio engineering metric quantifying the harmonic distortion power present in a signal relative to its fundamental frequency.',
    statement: 'Calculated directly from the Fourier amplitude spectrum: V₁ is the fundamental root-mean-square amplitude, while V_n (n ≥ 2) are higher harmonic components.',
    variables: { V_1: 'fundamental harmonic RMS voltage', V_n: 'n-th harmonic RMS voltage', '\\text{THD}': 'total harmonic distortion' },
    conditions: 'Periodic waveform with non-zero fundamental V₁ > 0.',
    examples: ['If fundamental is 100V, second harmonic 3V, third harmonic 4V: THD = √(9 + 16)/100 = 5/100 = 5%.'],
    relatedEntries: ['fourier-series-coefficients'],
    aliases: ['thd', 'total harmonic distortion', 'fourier harmonics', 'power distortion'],
    computationalOp: 'evaluate'
  }
];

/* ============================================================
   EXPANDED FOUR-FIGURE MATHEMATICAL TABLES ENGINE
   Traditional 4-figure table lookups with side-by-side comparison
   against direct machine floating precision.
   ============================================================ */

export function lookupFourFigureTable(tableName, value) {
  const x = Number(value);
  if (isNaN(x)) {
    throw new Error(`Invalid numerical input for four-figure table: "${value}".`);
  }

  let tableVal = 0;
  let exactVal = 0;
  let description = '';
  const cleanName = tableName.toLowerCase().trim();

  switch (cleanName) {
    case 'log':
    case 'logarithm':
    case 'log10': {
      if (x <= 0) throw new Error('Common logarithm table requires argument x > 0.');
      exactVal = Math.log10(x);
      const mantissa = exactVal - Math.floor(exactVal);
      const roundedMantissa = Math.round(mantissa * 10000) / 10000;
      tableVal = Math.floor(exactVal) + roundedMantissa;
      description = `Four-figure logarithm table for log10(${x}).`;
      break;
    }

    case 'antilog':
    case 'antilogarithm': {
      exactVal = Math.pow(10, x);
      const fractionalPart = x - Math.floor(x);
      const mantissaVal = Math.pow(10, fractionalPart);
      const tableMantissa = Math.round(mantissaVal * 1000) / 1000;
      tableVal = tableMantissa * Math.pow(10, Math.floor(x));
      description = `Four-figure antilogarithm table for 10^(${x}).`;
      break;
    }

    case 'ln':
    case 'natural-log': {
      if (x <= 0) throw new Error('Natural logarithm requires argument x > 0.');
      exactVal = Math.log(x);
      tableVal = Math.round(exactVal * 10000) / 10000;
      description = `Four-figure natural logarithm table for ln(${x}).`;
      break;
    }

    case 'sin':
    case 'sine': {
      const rad = (x * Math.PI) / 180;
      exactVal = Math.sin(rad);
      tableVal = Math.round(exactVal * 10000) / 10000;
      description = `Four-figure natural sine table for angle ${x}°.`;
      break;
    }

    case 'cos':
    case 'cosine': {
      const rad = (x * Math.PI) / 180;
      exactVal = Math.cos(rad);
      tableVal = Math.round(exactVal * 10000) / 10000;
      description = `Four-figure natural cosine table for angle ${x}°.`;
      break;
    }

    case 'tan':
    case 'tangent': {
      const normalized = ((x % 180) + 180) % 180;
      if (Math.abs(normalized - 90) < 1e-6) {
        throw new Error(`Tangent is undefined at ${x}°.`);
      }
      const rad = (x * Math.PI) / 180;
      exactVal = Math.tan(rad);
      tableVal = Math.round(exactVal * 10000) / 10000;
      description = `Four-figure natural tangent table for angle ${x}°.`;
      break;
    }

    case 'sqrt':
    case 'square-root': {
      if (x < 0) throw new Error('Square root table requires argument x ≥ 0.');
      exactVal = Math.sqrt(x);
      tableVal = Math.round(exactVal * 1000) / 1000;
      description = `Four-figure square root table for √(${x}).`;
      break;
    }

    case 'cbrt':
    case 'cube-root': {
      exactVal = Math.cbrt(x);
      tableVal = Math.round(exactVal * 1000) / 1000;
      description = `Four-figure cube root table for ∛(${x}).`;
      break;
    }

    case 'reciprocal': {
      if (x === 0) throw new Error('Reciprocal table: division by zero.');
      exactVal = 1 / x;
      tableVal = Math.round(exactVal * 10000) / 10000;
      description = `Four-figure reciprocal table for 1/(${x}).`;
      break;
    }

    case 'squares':
    case 'square': {
      exactVal = x * x;
      tableVal = Math.round(exactVal * 10000) / 10000;
      description = `Four-figure squares table for (${x})².`;
      break;
    }

    case 'cubes':
    case 'cube': {
      exactVal = x * x * x;
      tableVal = Math.round(exactVal * 10000) / 10000;
      description = `Four-figure cubes table for (${x})³.`;
      break;
    }

    default:
      throw new Error(`Unsupported four-figure table: "${tableName}". Supported tables: log, antilog, ln, sin, cos, tan, sqrt, cbrt, reciprocal, squares, cubes.`);
  }

  const error = Math.abs(exactVal - tableVal);

  return {
    table: cleanName,
    input: x,
    tableValue: tableVal,
    machineValue: exactVal,
    difference: Number(error.toExponential(4)),
    description,
    isTableApproximation: true,
    message: `Four-Figure Table value: ${tableVal} | Machine computed value: ${exactVal.toFixed(8)} (Difference: ${error.toPrecision(2)}).`
  };
}

/**
 * Search Mathematical Knowledge Library
 */
export function searchMathKnowledge(query, { category = null, proofStatus = null, limit = 15 } = {}) {
  const q = (query || '').toLowerCase().trim();

  let results = MATH_KNOWLEDGE_ENTRIES.filter(entry => {
    if (category && category !== 'all' && entry.category !== category) return false;
    if (proofStatus && entry.proofStatus !== proofStatus) return false;

    if (!q) return true;

    const haystacks = [
      entry.title,
      entry.formula,
      entry.definition,
      entry.statement,
      entry.categoryName,
      entry.subdomain,
      entry.proofStatus,
      ...(entry.aliases || [])
    ].map(s => (s || '').toLowerCase());

    return haystacks.some(h => h.includes(q));
  });

  return results.slice(0, limit);
}

/**
 * Get Math Knowledge Entry by exact ID
 */
export function getMathKnowledgeById(id) {
  if (!id) return null;
  const clean = id.toLowerCase().trim();
  return MATH_KNOWLEDGE_ENTRIES.find(e => e.id.toLowerCase() === clean) || null;
}

/**
 * Search or Retrieve Mathematical Constants (Prioritizes exact matches)
 */
export function getMathematicalConstant(nameOrSymbol) {
  if (!nameOrSymbol) return null;
  const q = nameOrSymbol.toLowerCase().trim();

  // 1. Exact match by id, symbol, or alias
  const exact = MATHEMATICAL_CONSTANTS.find(c =>
    c.id.toLowerCase() === q ||
    c.symbol.toLowerCase() === q ||
    c.aliases.some(a => a.toLowerCase() === q)
  );
  if (exact) return exact;

  // 2. Substring match by name
  return MATHEMATICAL_CONSTANTS.find(c =>
    c.name.toLowerCase().includes(q)
  ) || null;
}
