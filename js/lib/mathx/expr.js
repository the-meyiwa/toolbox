/* ============================================================
   mathx / expr — expression AST, parser, canonical auto-simplifier,
   plain + LaTeX printers, real & complex numeric evaluation.
   Pure (no DOM).

   Node shapes (immutable):
     {t:'num', v:Q}            exact rational
     {t:'sym', n:'x'}          symbol (pi, e, i, oo are constants)
     {t:'add', a:[...]}        sum
     {t:'mul', a:[...]}        product (division = negative powers)
     {t:'pow', b, e}           power
     {t:'fn',  n:'sin', a:[...]}
     {t:'rel', op:'='|'<'|'>'|'<='|'>='|'!=', l, r}
     {t:'list', a:[...]}       vectors / matrices / tuples
   ============================================================ */

import { Q, Q0, Q1, QM1, bgcd, babs, iroot, smallFactor } from './rational.js';

/* ---------------- constructors ---------------- */

export const N = (v) => ({ t: 'num', v: Q.of(typeof v === 'number' && !Number.isInteger(v) ? String(v) : v) });
export const S = (n) => ({ t: 'sym', n });
export const ZERO = N(0), ONE = N(1), MONE = N(-1), TWO = N(2), HALF = { t: 'num', v: new Q(1n, 2n) };
export const PI = S('pi'), E = S('e'), I = S('i'), OO = S('oo');

export const isNum = (x) => x && x.t === 'num';
export const isSym = (x, n) => x && x.t === 'sym' && (n === undefined || x.n === n);
export const isZero = (x) => isNum(x) && x.v.isZero;
export const isOne = (x) => isNum(x) && x.v.isOne;
export const isInf = (x) => isSym(x, 'oo') || (x && x.t === 'mul' && x.a.length === 2 && isNum(x.a[0]) && x.a[0].v.sign < 0 && isSym(x.a[1], 'oo'));

export const CONST_SYMS = new Set(['pi', 'e', 'i', 'oo']);

export function A(...args) { return simpAdd(args.flat()); }
export function M(...args) { return simpMul(args.flat()); }
export function P(b, e) { return simpPow(b, typeof e === 'number' || typeof e === 'bigint' ? N(e) : e); }
export function F(n, ...a) { return simpFn(n, a); }
export const neg = (x) => M(MONE, x);
export const sub = (a, b) => A(a, neg(b));
export const div = (a, b) => M(a, P(b, MONE));
export const sqrtE = (x) => P(x, HALF);
export const numQ = (q) => ({ t: 'num', v: q });

/* ---------------- canonical key & ordering ---------------- */

export function key(x) {
  if (x._k) return x._k;
  let k;
  switch (x.t) {
    case 'num': k = '#' + x.v.toString(); break;
    case 'sym': k = x.n; break;
    case 'add': k = '+(' + x.a.map(key).join(',') + ')'; break;
    case 'mul': k = '*(' + x.a.map(key).join(',') + ')'; break;
    case 'pow': k = '^(' + key(x.b) + ',' + key(x.e) + ')'; break;
    case 'fn': k = x.n + '(' + x.a.map(key).join(',') + ')'; break;
    case 'rel': k = 'rel' + x.op + '(' + key(x.l) + ',' + key(x.r) + ')'; break;
    case 'list': k = '[' + x.a.map(key).join(',') + ']'; break;
    default: k = '?';
  }
  Object.defineProperty(x, '_k', { value: k, enumerable: false });
  return k;
}
export const equal = (a, b) => key(a) === key(b);

const TYPE_RANK = { num: 0, sym: 1, pow: 2, mul: 3, fn: 4, add: 5, list: 6, rel: 7 };
function baseOf(x) { return x.t === 'pow' ? x.b : x; }
export function cmpNode(a, b) {
  // order factors: numbers, then by base key (so x and x^2 sit together)
  if (a.t === 'num' && b.t !== 'num') return -1;
  if (b.t === 'num' && a.t !== 'num') return 1;
  const ba = baseOf(a), bb = baseOf(b);
  const ra = TYPE_RANK[ba.t], rb = TYPE_RANK[bb.t];
  if (ra !== rb) return ra - rb;
  const kba = key(ba), kbb = key(bb);
  if (kba !== kbb) return kba < kbb ? -1 : 1;
  const ka = key(a), kb = key(b);
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

/* ---------------- surds: exact rational^rational ---------------- */

function radical(base, ex) {
  // base: Q > 0, ex: Q non-integer. Returns node.
  const primes = new Map(); // prime -> Q exponent
  const addF = (n, sgn) => {
    for (const [p, a] of smallFactor(n)) {
      const cur = primes.get(p) || Q0;
      primes.set(p, cur.add(ex.mul(new Q(BigInt(a * sgn)))));
    }
  };
  // guard: huge numbers -> leave alone
  if (base.n.toString().length > 40 || base.d.toString().length > 40) return { t: 'pow', b: numQ(base), e: numQ(ex) };
  addF(base.n, 1); addF(base.d, -1);
  let coef = Q1;
  const groups = new Map(); // frac exponent key -> {e:Q, prod:Q}
  for (const [p, e] of primes) {
    const fl = e.floor();
    const frac = e.sub(new Q(fl));
    if (fl !== 0n) coef = coef.mul(new Q(p).pow(fl));
    if (!frac.isZero) {
      const k = frac.toString();
      const g = groups.get(k) || { e: frac, prod: Q1 };
      g.prod = g.prod.mul(new Q(p));
      groups.set(k, g);
    }
  }
  const fs = [numQ(coef)];
  for (const g of groups.values()) fs.push({ t: 'pow', b: numQ(g.prod), e: numQ(g.e) });
  return mkMul(fs);
}

/* ---------------- automatic simplification ---------------- */

function splitCoeff(x) {
  // term -> [Q coeff, rest node]
  if (x.t === 'num') return [x.v, ONE];
  if (x.t === 'mul' && isNum(x.a[0])) {
    const rest = x.a.slice(1);
    return [x.a[0].v, rest.length === 1 ? rest[0] : { t: 'mul', a: rest }];
  }
  return [Q1, x];
}

function mkMul(fs) {
  // assumes already simplified/combined factors; drops 1s, folds numbers
  let c = Q1; const rest = [];
  for (const f of fs) { if (isNum(f)) c = c.mul(f.v); else rest.push(f); }
  if (c.isZero) return ZERO;
  rest.sort(cmpNode);
  if (!rest.length) return numQ(c);
  if (c.isOne && rest.length === 1) return rest[0];
  return { t: 'mul', a: c.isOne ? rest : [numQ(c), ...rest] };
}

export function simpAdd(args) {
  const flat = [];
  for (const a of args) { if (a.t === 'add') flat.push(...a.a); else flat.push(a); }
  let c = Q0;
  const terms = new Map();
  let infSign = 0; let hasNaN = false;
  for (const t of flat) {
    if (t.t === 'num') { c = c.add(t.v); continue; }
    if (isSym(t, 'oo')) { if (infSign < 0) hasNaN = true; infSign = 1; continue; }
    if (isInf(t)) { if (infSign > 0) hasNaN = true; infSign = -1; continue; }
    if (t.t === 'list') throw new Error('Cannot add a list/matrix to a scalar here');
    const [k, rest] = splitCoeff(t);
    const kk = key(rest);
    const cur = terms.get(kk);
    if (cur) cur.c = cur.c.add(k); else terms.set(kk, { c: k, r: rest });
  }
  if (hasNaN) return S('nan');
  if (infSign) return infSign > 0 ? OO : { t: 'mul', a: [MONE, OO] };
  const out = [];
  for (const { c: k, r } of terms.values()) {
    if (k.isZero) continue;
    if (k.isOne) out.push(r);
    else if (r.t === 'mul') out.push({ t: 'mul', a: [numQ(k), ...r.a] });
    else out.push({ t: 'mul', a: [numQ(k), r] });
  }
  if (!c.isZero) out.push(numQ(c));
  if (!out.length) return ZERO;
  if (out.length === 1) return out[0];
  out.sort((a, b) => { const ka = key(a), kb = key(b); return ka < kb ? -1 : ka > kb ? 1 : 0; });
  return { t: 'add', a: out };
}

export function simpMul(args) {
  const flat = [];
  for (const a of args) { if (a.t === 'mul') flat.push(...a.a); else flat.push(a); }
  let c = Q1;
  const bases = new Map(); // key(base) -> {b, e:[...]}
  let inf = false;
  for (const f of flat) {
    if (f.t === 'num') { c = c.mul(f.v); continue; }
    if (isSym(f, 'oo')) { inf = true; continue; }
    if (f.t === 'list') throw new Error('Use matrix operations for lists');
    let b = f, e = ONE;
    if (f.t === 'pow') { b = f.b; e = f.e; }
    const kb = key(b);
    const cur = bases.get(kb);
    if (cur) cur.e.push(e); else bases.set(kb, { b, e: [e] });
  }
  if (c.isZero) return inf ? S('nan') : ZERO;
  const fs = [];
  let coef = c;
  for (const { b, e } of bases.values()) {
    const ex = e.length === 1 ? e[0] : simpAdd(e);
    const p = simpPow(b, ex);
    if (p.t === 'num') { coef = coef.mul(p.v); continue; }
    if (p.t === 'mul') {
      for (const q of p.a) { if (q.t === 'num') coef = coef.mul(q.v); else fs.push(q); }
      continue;
    }
    fs.push(p);
  }
  // re-merge radicals of numbers with identical fractional exponent (sqrt2*sqrt3 -> sqrt6)
  const radGroups = new Map(); const others = [];
  for (const f of fs) {
    if (f.t === 'pow' && isNum(f.b) && isNum(f.e) && !f.e.v.isInt && f.b.v.sign > 0) {
      const k = f.e.v.toString();
      const g = radGroups.get(k);
      if (g) g.b = g.b.mul(f.b.v); else radGroups.set(k, { b: f.b.v, e: f.e.v });
    } else others.push(f);
  }
  for (const g of radGroups.values()) {
    const r = radical(g.b, g.e);
    if (r.t === 'num') coef = coef.mul(r.v);
    else if (r.t === 'mul') for (const q of r.a) { if (q.t === 'num') coef = coef.mul(q.v); else others.push(q); }
    else others.push(r);
  }
  // i * i
  if (inf) {
    if (others.length) others.push(OO);
    else return coef.sign > 0 ? OO : coef.sign < 0 ? { t: 'mul', a: [MONE, OO] } : S('nan');
  }
  if (coef.isZero) return ZERO;
  // numeric * single add -> distribute (SymPy convention)
  if (!coef.isOne && others.length === 1 && others[0].t === 'add') {
    return simpAdd(others[0].a.map((t) => simpMul([numQ(coef), t])));
  }
  return mkMul([numQ(coef), ...others]);
}

export function simpPow(b, e) {
  if (isZero(e)) return ONE;
  if (isOne(e)) return b;
  if (isOne(b)) return ONE;
  if (isZero(b)) {
    if (isNum(e) && e.v.sign < 0) throw new Error('Division by zero');
    return isNum(e) ? ZERO : { t: 'pow', b, e };
  }
  if (isSym(b, 'e')) return simpFn('exp', [e]);
  if (isSym(b, 'oo') && isNum(e)) return e.v.sign > 0 ? OO : ZERO;
  if (isNum(b) && isNum(e)) {
    const bv = b.v, ev = e.v;
    if (ev.isInt) {
      if (babs(ev.n) > 100000n) return { t: 'pow', b, e };
      return numQ(bv.pow(ev.n));
    }
    if (bv.sign > 0) {
      // split integer part of exponent
      const fl = ev.floor();
      const frac = ev.sub(new Q(fl));
      const intPart = fl ? bv.pow(fl) : Q1;
      const r = radical(bv, frac);
      return mkMul([numQ(intPart), ...(r.t === 'mul' ? r.a : [r])]);
    }
    // negative base
    if (ev.d === 2n) {
      // (-a)^(p/2) = i^p * a^(p/2)
      const ip = simpPow(I, numQ(new Q(ev.n)));
      return simpMul([ip, simpPow(numQ(bv.neg()), e)]);
    }
    if (ev.d % 2n === 1n) {
      // real odd root: (-a)^(p/q) = (-1)^p a^(p/q)
      const sgn = ev.n % 2n === 0n ? Q1 : QM1;
      return simpMul([numQ(sgn), simpPow(numQ(bv.neg()), e)]);
    }
    return { t: 'pow', b, e };
  }
  if (isSym(b, 'i') && isNum(e) && e.v.isInt) {
    const r = Number(((e.v.n % 4n) + 4n) % 4n);
    return [ONE, I, MONE, simpMul([MONE, I])][r];
  }
  if (b.t === 'pow') {
    // (x^a)^c -> x^(a c) when c integer, or a integer odd & c rational? keep safe: c integer, or a is 1/n and c multiple
    if (isNum(e) && e.v.isInt) return simpPow(b.b, simpMul([b.e, e]));
    if (isNum(b.e) && isNum(e) && !b.e.v.isInt && b.e.v.n % 2n !== 0n && !(b.e.v.d % 2n === 0n && e.v.d === 1n)) {
      // (x^(1/2))^(1/3) = x^(1/6) valid for x >= 0 / principal branch
      if (b.e.v.abs().cmp(Q1) < 0) return simpPow(b.b, simpMul([b.e, e]));
    }
  }
  if (b.t === 'mul') {
    if (isNum(e) && e.v.isInt) return simpMul(b.a.map((f) => simpPow(f, e)));
    // pull out positive numeric coefficient
    if (isNum(b.a[0]) && b.a[0].v.sign > 0) {
      return simpMul([simpPow(b.a[0], e), simpPow(mkMul(b.a.slice(1)), e)]);
    }
  }
  if (b.t === 'fn' && b.n === 'exp' && isNum(e)) return simpFn('exp', [simpMul([b.a[0], e])]);
  if (b.t === 'fn' && b.n === 'abs' && isNum(e) && e.v.isInt && e.v.n % 2n === 0n) return simpPow(b.a[0], e);
  return { t: 'pow', b, e };
}

/* ---- function special values ---- */

function piMultiple(x) {
  // returns Q k such that x = k*pi, or null
  if (isSym(x, 'pi')) return Q1;
  if (isZero(x)) return Q0;
  if (x.t === 'mul' && x.a.length === 2 && isNum(x.a[0]) && isSym(x.a[1], 'pi')) return x.a[0].v;
  return null;
}
function isNegTerm(x) {
  if (isNum(x)) return x.v.sign < 0;
  if (x.t === 'mul' && isNum(x.a[0])) return x.a[0].v.sign < 0;
  if (x.t === 'add') return isNegTerm(x.a[0]) && x.a.every(isNegTerm);
  return false;
}
const SQ = (n) => simpPow(N(n), HALF);
function trigTable(name, k) {
  // k = multiple of pi (Q), reduce mod 2
  let r = k.sub(new Q(k.div(new Q(2n)).floor() * 2n)); // in [0,2)
  const d = r.d, n = Number(r.n);
  if (!(d === 1n || d === 2n || d === 3n || d === 4n || d === 6n)) return null;
  const deg = Math.round((n / Number(d)) * 180);
  const sinT = { 0: ZERO, 30: HALF, 45: simpMul([HALF, SQ(2)]), 60: simpMul([HALF, SQ(3)]), 90: ONE };
  const sinDeg = (a) => {
    a = ((a % 360) + 360) % 360;
    if (a <= 90) return sinT[a];
    if (a <= 180) return sinT[180 - a];
    if (a <= 270) return simpMul([MONE, sinT[a - 180]]);
    return simpMul([MONE, sinT[360 - a]]);
  };
  if (sinDeg(deg) === undefined) return null;
  if (name === 'sin') return sinDeg(deg);
  if (name === 'cos') return sinDeg(deg + 90);
  if (name === 'tan') {
    const c = sinDeg(deg + 90);
    if (isZero(c)) return S('zoo');
    return simpMul([sinDeg(deg), simpPow(c, MONE)]);
  }
  return null;
}

const INV_TRIG = {
  asin: [['0', '0'], ['1/2', '1/6'], ['1', '1/2'], ['-1', '-1/2'], ['-1/2', '-1/6']],
  acos: [['0', '1/2'], ['1', '0'], ['-1', '1'], ['1/2', '1/3'], ['-1/2', '2/3']],
  atan: [['0', '0'], ['1', '1/4'], ['-1', '-1/4']],
};

export const KNOWN_FUNCS = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'exp', 'log', 'abs', 'sign', 'floor', 'ceil', 'gamma', 'lgamma', 'beta', 'erf', 'erfc', 'zeta', 'besselj', 'bessely',
  'factorial', 'binomial', 'atan2', 'max', 'min', 'mod', 'gcd', 'lcm', 're', 'im', 'conj', 'arg', 'digamma', 'lambertw',
  'round', 'Heaviside', 'si', 'ci', 'ei', 'fresnels', 'fresnelc', 'airyai', 'erfi', 'polylog'
]);

export function simpFn(n, a) {
  const x = a[0];
  const allNum = a.every(isNum);
  switch (n) {
    case 'sin': case 'cos': case 'tan': {
      const k = piMultiple(x);
      if (k) { const v = trigTable(n, k); if (v) return v; }
      if (isNegTerm(x)) {
        const inner = simpMul([MONE, x]);
        return n === 'cos' ? simpFn('cos', [inner]) : simpMul([MONE, simpFn(n, [inner])]);
      }
      if (x.t === 'fn' && ((n === 'sin' && x.n === 'asin') || (n === 'cos' && x.n === 'acos') || (n === 'tan' && x.n === 'atan'))) return x.a[0];
      break;
    }
    case 'asin': case 'acos': case 'atan': {
      if (isNum(x)) for (const [v, k] of INV_TRIG[n]) if (x.v.eq(Q.parse(v))) return simpMul([numQ(Q.parse(k)), PI]);
      if (n === 'atan' && isOne(simpMul([x, simpPow(SQ(3), MONE)]))) return simpMul([numQ(new Q(1n, 3n)), PI]);
      if (isNegTerm(x) && n !== 'acos') return simpMul([MONE, simpFn(n, [simpMul([MONE, x])])]);
      if (isSym(x, 'oo') && n === 'atan') return simpMul([HALF, PI]);
      if (isInf(x) && n === 'atan') return simpMul([numQ(new Q(-1n, 2n)), PI]);
      break;
    }
    case 'sinh': case 'tanh': case 'asinh': case 'atanh':
      if (isZero(x)) return ZERO;
      if (isNegTerm(x)) return simpMul([MONE, simpFn(n, [simpMul([MONE, x])])]);
      break;
    case 'cosh':
      if (isZero(x)) return ONE;
      if (isNegTerm(x)) return simpFn('cosh', [simpMul([MONE, x])]);
      break;
    case 'exp':
      if (isZero(x)) return ONE;
      if (x.t === 'mul' && x.a.some((f) => isSym(f, 'i'))) {
        // e^{i k pi} exactly via cos + i sin
        const rest = simpMul(x.a.filter((f) => !isSym(f, 'i')));
        const k = piMultiple(rest);
        if (k) { const c = trigTable('cos', k), sn = trigTable('sin', k); if (c && sn && !isSym(c, 'zoo')) return simpAdd([c, simpMul([sn, I])]); }
      }
      if (isOne(x)) return E;
      if (x.t === 'fn' && x.n === 'log') return x.a[0];
      if (x.t === 'mul' && x.a.length === 2 && isNum(x.a[0]) && x.a[1].t === 'fn' && x.a[1].n === 'log') return simpPow(x.a[1].a[0], x.a[0]);
      if (isSym(x, 'oo')) return OO;
      if (isInf(x)) return ZERO;
      break;
    case 'log':
      if (a.length === 2) return simpMul([simpFn('log', [a[0]]), simpPow(simpFn('log', [a[1]]), MONE)]);
      if (isOne(x)) return ZERO;
      if (isSym(x, 'e')) return ONE;
      if (x.t === 'fn' && x.n === 'exp') return x.a[0];
      if (isSym(x, 'oo')) return OO;
      if (isZero(x)) return { t: 'mul', a: [MONE, OO] };
      if (isNum(x) && x.v.sign > 0 && x.v.d !== 1n && x.v.n === 1n) return simpMul([MONE, simpFn('log', [numQ(x.v.inv())])]);
      if (x.t === 'pow' && isSym(x.b, 'e')) return x.e;
      if (x.t === 'pow' && isNum(x.b) && x.b.v.sign > 0 && isNum(x.e)) return simpMul([x.e, simpFn('log', [x.b])]);
      if (isNum(x) && x.v.isInt && x.v.sign > 0) {
        // log(8) -> 3 log(2) when perfect power
        for (let k = 40; k >= 2; k--) {
          const r = iroot(x.v.n, k);
          if (r > 1n && r ** BigInt(k) === x.v.n) return simpMul([N(k), { t: 'fn', n: 'log', a: [numQ(new Q(r))] }]);
        }
      }
      break;
    case 'abs':
      if (isNum(x)) return numQ(x.v.abs());
      if (isSym(x, 'pi') || isSym(x, 'e')) return x;
      if (isNegTerm(x)) return simpFn('abs', [simpMul([MONE, x])]);
      if (x.t === 'fn' && x.n === 'abs') return x;
      if (x.t === 'pow' && isNum(x.e) && x.e.v.isInt && x.e.v.n % 2n === 0n) return x;
      if (x.t === 'fn' && x.n === 'exp') return x;
      break;
    case 'sign':
      if (isNum(x)) return N(x.v.sign);
      break;
    case 'floor': if (isNum(x)) return numQ(new Q(x.v.floor())); break;
    case 'ceil': if (isNum(x)) return numQ(new Q(-x.v.neg().floor())); break;
    case 'round': if (isNum(x)) return numQ(new Q(x.v.add(HALF.v).floor())); break;
    case 'factorial':
      if (isNum(x) && x.v.isInt && x.v.sign >= 0 && x.v.n <= 5000n) {
        let r = 1n; for (let k = 2n; k <= x.v.n; k++) r *= k; return numQ(new Q(r));
      }
      break;
    case 'gamma':
      if (isNum(x) && x.v.isInt && x.v.sign > 0 && x.v.n <= 5000n) return simpFn('factorial', [numQ(x.v.sub(Q1))]);
      if (isNum(x) && x.v.d === 2n && x.v.sign > 0 && x.v.n < 400n) {
        // Γ(n + 1/2) = (2n)! / (4^n n!) √π
        const n = (x.v.n - 1n) / 2n;
        let f2 = 1n; for (let k = 2n; k <= 2n * n; k++) f2 *= k;
        let f1 = 1n; for (let k = 2n; k <= n; k++) f1 *= k;
        return simpMul([numQ(new Q(f2, (4n ** n) * f1)), simpPow(PI, HALF)]);
      }
      break;
    case 'binomial':
      if (allNum && a[0].v.isInt && a[1].v.isInt) {
        const nn = a[0].v.n, k = a[1].v.n;
        if (k < 0n || (nn >= 0n && k > nn)) return ZERO;
        let r = 1n; for (let j = 0n; j < k; j++) r = r * (nn - j) / (j + 1n);
        return numQ(new Q(r));
      }
      break;
    case 'gcd': case 'lcm':
      if (allNum && a.every((y) => y.v.isInt)) {
        let r = a[0].v.n;
        for (const y of a.slice(1)) r = n === 'gcd' ? bgcd(r, y.v.n) : (r === 0n || y.v.n === 0n ? 0n : babs(r / bgcd(r, y.v.n) * y.v.n));
        return numQ(new Q(babs(r)));
      }
      break;
    case 'mod':
      if (allNum && a[0].v.isInt && a[1].v.isInt && a[1].v.n !== 0n) { const m = a[1].v.n; return numQ(new Q(((a[0].v.n % m) + m) % m)); }
      break;
    case 'max': case 'min':
      if (allNum) { let best = a[0]; for (const y of a) if ((n === 'max' ? y.v.cmp(best.v) > 0 : y.v.cmp(best.v) < 0)) best = y; return best; }
      break;
    case 're': if (isNum(x)) return x; break;
    case 'im': if (isNum(x)) return ZERO; break;
    case 'conj': if (isNum(x)) return x; break;
    case 'zeta':
      if (isNum(x) && x.v.isInt) {
        const k = Number(x.v.n);
        const Z = { 2: [1n, 6n], 4: [1n, 90n], 6: [1n, 945n], 8: [1n, 9450n], 10: [1n, 93555n] };
        if (Z[k]) return simpMul([numQ(new Q(Z[k][0], Z[k][1])), simpPow(PI, N(k))]);
        if (k === 0) return numQ(new Q(-1n, 2n));
      }
      break;
    case 'erf': if (isZero(x)) return ZERO; break;
    default: break;
  }
  return { t: 'fn', n, a };
}

/* full recursive simplification of arbitrary trees */
export function simplifyTree(x) {
  switch (x.t) {
    case 'num': case 'sym': return x;
    case 'add': return simpAdd(x.a.map(simplifyTree));
    case 'mul': return simpMul(x.a.map(simplifyTree));
    case 'pow': return simpPow(simplifyTree(x.b), simplifyTree(x.e));
    case 'fn': return simpFn(x.n, x.a.map(simplifyTree));
    case 'rel': return { t: 'rel', op: x.op, l: simplifyTree(x.l), r: simplifyTree(x.r) };
    case 'list': return { t: 'list', a: x.a.map(simplifyTree) };
    default: return x;
  }
}

/* ---------------- traversal helpers ---------------- */

export function map(x, f) {
  switch (x.t) {
    case 'add': return A(x.a.map(f));
    case 'mul': return M(x.a.map(f));
    case 'pow': return P(f(x.b), f(x.e));
    case 'fn': return F(x.n, ...x.a.map(f));
    case 'rel': return { t: 'rel', op: x.op, l: f(x.l), r: f(x.r) };
    case 'list': return { t: 'list', a: x.a.map(f) };
    default: return x;
  }
}

export function subs(x, env) {
  // env: {name: node}
  if (x.t === 'sym') return Object.prototype.hasOwnProperty.call(env, x.n) ? env[x.n] : x;
  if (x.t === 'num') return x;
  return map(x, (c) => subs(c, env));
}

/** replace any subtree equal to `target` with `repl` */
export function replace(x, target, repl) {
  const kt = key(target);
  const go = (y) => {
    if (key(y) === kt) return repl;
    if (y.t === 'num' || y.t === 'sym') return y;
    // also match powers of target: target^k inside pow bases handled naturally
    return map(y, go);
  };
  return go(x);
}

export function freeSyms(x, out = new Set()) {
  switch (x.t) {
    case 'sym': if (!CONST_SYMS.has(x.n)) out.add(x.n); break;
    case 'num': break;
    case 'pow': freeSyms(x.b, out); freeSyms(x.e, out); break;
    case 'rel': freeSyms(x.l, out); freeSyms(x.r, out); break;
    default: if (x.a) x.a.forEach((c) => freeSyms(c, out));
  }
  return out;
}
export const has = (x, name) => {
  if (x.t === 'sym') return x.n === name;
  if (x.t === 'num') return false;
  if (x.t === 'pow') return has(x.b, name) || has(x.e, name);
  if (x.t === 'rel') return has(x.l, name) || has(x.r, name);
  return x.a ? x.a.some((c) => has(c, name)) : false;
};
export const hasNode = (x, target) => {
  if (key(x) === key(target)) return true;
  if (x.t === 'num' || x.t === 'sym') return false;
  if (x.t === 'pow') return hasNode(x.b, target) || hasNode(x.e, target);
  if (x.t === 'rel') return hasNode(x.l, target) || hasNode(x.r, target);
  return x.a ? x.a.some((c) => hasNode(c, target)) : false;
};

/** pick the default variable of an expression */
export function mainVar(x, prefer = ['x', 't', 'y', 'z', 'n', 'k']) {
  const fs = freeSyms(x);
  for (const p of prefer) if (fs.has(p)) return p;
  return [...fs].sort()[0] || 'x';
}

/* ---------------- parser ---------------- */

const GREEK = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega'];
const FUNC_ALIASES = {
  ln: 'log', arcsin: 'asin', arccos: 'acos', arctan: 'atan', arsinh: 'asinh', arcosh: 'acosh', artanh: 'atanh',
  arcsinh: 'asinh', arccosh: 'acosh', arctanh: 'atanh', fact: 'factorial', choose: 'binomial', nCr: 'binomial', C: null,
  sgn: 'sign', conjugate: 'conj', Re: 're', Im: 'im', J: 'besselj', Gamma: 'gamma', W: 'lambertw', lambertw: 'lambertw',
  Ei: 'ei', Si: 'si', Ci: 'ci', heaviside: 'Heaviside', H: null, ncr: 'binomial'
};
const EXTRA_FUNCS = new Set(['sqrt', 'cbrt', 'root', 'log10', 'log2', 'lg', 'sec', 'csc', 'cot', 'asec', 'acsc', 'acot', 'sech', 'csch', 'coth', 'deg', 'rad', 'nPr', 'npr', 'perm']);
const UNI = { '×': '*', '·': '*', '⋅': '*', '÷': '/', '−': '-', '–': '-', 'π': 'pi', '∞': 'oo', '≤': '<=', '≥': '>=', '≠': '!=', '√': 'sqrt', '²': '^2', '³': '^3', 'θ': 'theta', 'λ': 'lambda', 'α': 'alpha', 'β': 'beta', 'μ': 'mu', 'σ': 'sigma', 'φ': 'phi', 'ω': 'omega', '∑': 'sum', '∫': 'integrate' };

export function isFuncName(w) {
  return KNOWN_FUNCS.has(w) || EXTRA_FUNCS.has(w) || (FUNC_ALIASES[w] !== undefined && FUNC_ALIASES[w] !== null);
}
function knownWord(w) {
  return isFuncName(w) || CONST_SYMS.has(w) || GREEK.includes(w) || w === 'inf' || w === 'infinity' || w === 'nan';
}

function tokenize(src) {
  let s = src;
  for (const [k, v] of Object.entries(UNI)) s = s.split(k).join(v);
  s = s.replace(/\*\*/g, '^');
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    const numM = s.slice(i).match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i);
    if (numM && !(numM[2] && /[a-z]/i.test(s[i + numM[0].length] || ''))) {
      toks.push({ k: 'num', v: numM[0] }); i += numM[0].length; continue;
    }
    const idM = s.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*'*/);
    if (idM) {
      let w = idM[0];
      const primes = (w.match(/'+$/) || [''])[0];
      const base = primes ? w.slice(0, -primes.length) : w;
      i += w.length;
      if (primes) { toks.push({ k: 'id', v: base + primes }); continue; }
      if (knownWord(base) || /[0-9_]/.test(base) || base.length === 1) { toks.push({ k: 'id', v: base }); continue; }
      // split unknown multi-letter words into letters, but keep known prefixes/suffixes (e.g. "xsin" -> x, sin)
      let rest = base;
      while (rest.length) {
        let matched = null;
        for (let L = rest.length; L >= 2; L--) { if (knownWord(rest.slice(0, L))) { matched = rest.slice(0, L); break; } }
        if (!matched) matched = rest[0];
        toks.push({ k: 'id', v: matched });
        rest = rest.slice(matched.length);
      }
      continue;
    }
    const two = s.slice(i, i + 2);
    if (['<=', '>=', '!=', '==', '->'].includes(two)) { toks.push({ k: 'op', v: two === '==' ? '=' : two }); i += 2; continue; }
    if ('+-*/^()[]{},=<>!|;\''.includes(ch)) { toks.push({ k: 'op', v: ch === '{' ? '(' : ch === '}' ? ')' : ch }); i++; continue; }
    throw new Error(`Unexpected character "${ch}"`);
  }
  return toks;
}

class Parser {
  constructor(src) { this.t = tokenize(src); this.i = 0; this.absDepth = 0; }
  peek(o = 0) { return this.t[this.i + o]; }
  isOp(v, o = 0) { const t = this.peek(o); return t && t.k === 'op' && t.v === v; }
  next() { return this.t[this.i++]; }
  expect(v) { if (!this.isOp(v)) throw new Error(`Expected "${v}"`); this.i++; }
  parseTop() {
    const items = [this.parseRel()];
    while (this.isOp(',') || this.isOp(';')) { this.next(); items.push(this.parseRel()); }
    if (this.i < this.t.length) throw new Error(`Unexpected "${this.peek().v}"`);
    return items.length === 1 ? items[0] : { t: 'list', a: items, tuple: true };
  }
  parseRel() {
    let l = this.parseExpr();
    const t = this.peek();
    if (t && t.k === 'op' && ['=', '<', '>', '<=', '>=', '!='].includes(t.v)) {
      this.next();
      const r = this.parseExpr();
      // chained a < x < b
      const t2 = this.peek();
      if (t2 && t2.k === 'op' && ['<', '>', '<=', '>='].includes(t2.v)) {
        this.next(); const r2 = this.parseExpr();
        return { t: 'list', a: [{ t: 'rel', op: t.v, l, r }, { t: 'rel', op: t2.v, l: r, r: r2 }], chain: true };
      }
      return { t: 'rel', op: t.v, l, r };
    }
    return l;
  }
  parseExpr() {
    let terms = [this.parseTerm()];
    for (;;) {
      if (this.isOp('+')) { this.next(); terms.push(this.parseTerm()); }
      else if (this.isOp('-')) { this.next(); terms.push({ t: 'mul', a: [MONE, this.parseTerm()] }); }
      else break;
    }
    return terms.length === 1 ? terms[0] : { t: 'add', a: terms };
  }
  startsOperand() {
    const t = this.peek();
    if (!t) return false;
    if (t.k === 'num' || t.k === 'id') return true;
    if (t.k === 'op' && (t.v === '(' || t.v === '[')) return true;
    if (t.k === 'op' && t.v === '|' && this.absDepth === 0) return true;
    return false;
  }
  parseTerm() {
    let fs = [this.parseUnary()];
    for (;;) {
      if (this.isOp('*')) { this.next(); fs.push(this.parseUnary()); }
      else if (this.isOp('/')) { this.next(); fs.push({ t: 'pow', b: this.parseUnary(), e: MONE }); }
      else if (this.startsOperand()) {
        // implicit multiplication; stop at 'dx' style differentials handled by the command layer
        fs.push(this.parsePow());
      } else break;
    }
    return fs.length === 1 ? fs[0] : { t: 'mul', a: fs };
  }
  parseUnary() {
    if (this.isOp('-')) { this.next(); return { t: 'mul', a: [MONE, this.parseUnary()] }; }
    if (this.isOp('+')) { this.next(); return this.parseUnary(); }
    return this.parsePow();
  }
  parsePow() {
    const b = this.parsePostfix();
    if (this.isOp('^')) {
      this.next();
      const e = this.parseUnary();
      return { t: 'pow', b, e };
    }
    return b;
  }
  parsePostfix() {
    let x = this.parsePrimary();
    for (;;) {
      if (this.isOp('!')) { this.next(); x = { t: 'fn', n: 'factorial', a: [x] }; continue; }
      break;
    }
    return x;
  }
  parseArgs() {
    this.expect('(');
    const args = [];
    if (!this.isOp(')')) {
      args.push(this.parseRel());
      while (this.isOp(',')) { this.next(); args.push(this.parseRel()); }
    }
    this.expect(')');
    return args;
  }
  parsePrimary() {
    const t = this.next();
    if (!t) throw new Error('Unexpected end of expression');
    if (t.k === 'num') return { t: 'num', v: Q.parse(t.v) };
    if (t.k === 'op' && t.v === '(') {
      const e = this.parseRel();
      if (this.isOp(',')) {
        const items = [e];
        while (this.isOp(',')) { this.next(); items.push(this.parseRel()); }
        this.expect(')');
        return { t: 'list', a: items, tuple: true };
      }
      this.expect(')');
      return e;
    }
    if (t.k === 'op' && t.v === '[') {
      const items = [];
      if (!this.isOp(']')) {
        items.push(this.parseRel());
        while (this.isOp(',') || this.isOp(';')) { this.next(); if (this.isOp(']')) break; items.push(this.parseRel()); }
      }
      this.expect(']');
      return { t: 'list', a: items };
    }
    if (t.k === 'op' && t.v === '|') {
      this.absDepth++;
      const e = this.parseExpr();
      this.absDepth--;
      this.expect('|');
      return { t: 'fn', n: 'abs', a: [e] };
    }
    if (t.k === 'id') {
      let w = t.v;
      if (w === 'inf' || w === 'infinity' || w === 'Infinity') return OO;
      if (FUNC_ALIASES[w]) w = FUNC_ALIASES[w];
      if (isFuncName(w)) {
        let args;
        if (this.isOp('(')) args = this.parseArgs();
        else if (this.isOp('^') && (w !== 'e')) {
          // sin^2 x  ==> sin(x)^2
          this.next(); const ex = this.parseUnary();
          const arg = this.isOp('(') ? this.parseArgs() : [this.parseFnArg()];
          return { t: 'pow', b: { t: 'fn', n: w, a: arg }, e: ex };
        } else args = [this.parseFnArg()];
        return { t: 'fn', n: w, a: args };
      }
      // user function call like f(x) is not supported: treat as multiplication
      return S(w);
    }
    throw new Error(`Unexpected "${t.v}"`);
  }
  parseFnArg() {
    // sin x, sin 2x, sin x^2
    let a = this.parsePow();
    if (a.t === 'num') {
      const t = this.peek();
      if (t && t.k === 'id' && !isFuncName(t.v) && t.v !== 'd' && !/^d[a-z]$/.test(t.v)) a = { t: 'mul', a: [a, this.parsePow()] };
    }
    return a;
  }
}

/** Parse a string to a raw AST (not simplified). */
export function parseRaw(src) {
  if (typeof src !== 'string' || !src.trim()) throw new Error('Empty expression');
  return new Parser(src).parseTop();
}

/** Convert parsed aliases to canonical functions + simplify. */
export function canon(x) {
  switch (x.t) {
    case 'num': return x;
    case 'sym': return x;
    case 'add': return A(x.a.map(canon));
    case 'mul': return M(x.a.map(canon));
    case 'pow': return P(canon(x.b), canon(x.e));
    case 'rel': return { t: 'rel', op: x.op, l: canon(x.l), r: canon(x.r) };
    case 'list': { const o = { t: 'list', a: x.a.map(canon) }; if (x.tuple) o.tuple = true; if (x.chain) o.chain = true; return o; }
    case 'fn': {
      const a = x.a.map(canon);
      const u = a[0];
      switch (x.n) {
        case 'sqrt': return P(u, HALF);
        case 'cbrt': return P(u, N(new Q(1n, 3n)));
        case 'root': return P(u, P(a[1], MONE));
        case 'log10': case 'lg': return div(F('log', u), F('log', N(10)));
        case 'log2': return div(F('log', u), F('log', N(2)));
        case 'sec': return P(F('cos', u), MONE);
        case 'csc': return P(F('sin', u), MONE);
        case 'cot': return div(F('cos', u), F('sin', u));
        case 'asec': return F('acos', P(u, MONE));
        case 'acsc': return F('asin', P(u, MONE));
        case 'acot': return F('atan', P(u, MONE));
        case 'sech': return P(F('cosh', u), MONE);
        case 'csch': return P(F('sinh', u), MONE);
        case 'coth': return div(F('cosh', u), F('sinh', u));
        case 'deg': return M(u, PI, N(new Q(1n, 180n)));
        case 'rad': return u;
        case 'nPr': case 'npr': case 'perm': return div(F('factorial', a[0]), F('factorial', sub(a[0], a[1])));
        case 'exp': return F('exp', u);
        default: return F(x.n, ...a);
      }
    }
    default: return x;
  }
}

export function parse(src) { return canon(parseRaw(src)); }

/* ---------------- printing ---------------- */

function termSortKey(t, vars) {
  // degree for ordering in sums: higher degree first, constants last
  let deg = 0;
  const walk = (f, mult) => {
    if (f.t === 'sym' && !CONST_SYMS.has(f.n)) deg += mult;
    else if (f.t === 'pow' && isNum(f.e) && f.b.t === 'sym' && !CONST_SYMS.has(f.b.n)) deg += mult * f.e.v.toNumber();
    else if (f.t === 'mul') f.a.forEach((g) => walk(g, mult));
    else if (f.t === 'fn' || f.t === 'pow') deg += 0.5 * mult;
  };
  walk(t, 1);
  return deg;
}
export function orderedTerms(x) {
  if (x.ord) return x.a;
  const ts = [...x.a];
  const vars = [...freeSyms(x)].sort();
  const expOf = (t) => {
    const m = {};
    const walk = (f) => {
      if (f.t === 'sym') m[f.n] = (m[f.n] || 0) + 1;
      else if (f.t === 'pow' && f.b.t === 'sym' && isNum(f.e)) m[f.b.n] = (m[f.b.n] || 0) + f.e.v.toNumber();
      else if (f.t === 'mul') f.a.forEach(walk);
    };
    walk(t); return m;
  };
  const scored = ts.map((t) => ({ t, d: termSortKey(t), e: expOf(t), k: key(splitCoeff(t)[1]) }));
  scored.sort((a, b) => {
    if (b.d !== a.d) return b.d - a.d;
    for (const v of vars) { const da = a.e[v] || 0, db = b.e[v] || 0; if (da !== db) return db - da; }
    return a.k < b.k ? -1 : a.k > b.k ? 1 : 0;
  });
  return scored.map((s) => s.t);
}

function isNegative(x) {
  if (isNum(x)) return x.v.sign < 0;
  if (x.t === 'mul' && isNum(x.a[0])) return x.a[0].v.sign < 0;
  return false;
}

function splitFrac(x) {
  // mul -> {c:Q, num:[factors], den:[factors]}
  const fs = x.t === 'mul' ? x.a : [x];
  let c = Q1; const num = [], den = [];
  for (const f of fs) {
    if (isNum(f)) c = c.mul(f.v);
    else if (f.t === 'pow' && isNum(f.e) && f.e.v.sign < 0) den.push(P(f.b, numQ(f.e.v.neg())));
    else num.push(f);
  }
  return { c, num, den };
}

const LATEX_FN = { sin: '\\sin', cos: '\\cos', tan: '\\tan', asin: '\\arcsin', acos: '\\arccos', atan: '\\arctan', sinh: '\\sinh', cosh: '\\cosh', tanh: '\\tanh', log: '\\ln', exp: '\\exp', gamma: '\\Gamma', zeta: '\\zeta', erf: '\\operatorname{erf}', erfc: '\\operatorname{erfc}', besselj: 'J', beta: '\\mathrm{B}', digamma: '\\psi', max: '\\max', min: '\\min', gcd: '\\gcd', arg: '\\arg', lambertw: 'W' };
const SYM_LATEX = { pi: '\\pi', oo: '\\infty', theta: '\\theta', alpha: '\\alpha', beta: '\\beta', gamma: '\\gamma', delta: '\\delta', epsilon: '\\varepsilon', lambda: '\\lambda', mu: '\\mu', sigma: '\\sigma', phi: '\\varphi', omega: '\\omega', tau: '\\tau', rho: '\\rho', psi: '\\psi', chi: '\\chi', xi: '\\xi', eta: '\\eta', kappa: '\\kappa', nu: '\\nu', nan: '\\text{undefined}', zoo: '\\tilde\\infty' };

function symLatex(n) {
  if (SYM_LATEX[n]) return SYM_LATEX[n];
  const pm = n.match(/^([A-Za-z]+)('+)$/);
  if (pm) return symLatex(pm[1]) + pm[2];
  const m = n.match(/^([A-Za-z]+)_?(\d+)$/);
  if (m) return `${symLatex(m[1])}_{${m[2]}}`;
  if (n.length > 1) return `\\mathrm{${n.replace(/_/g, '\\_')}}`;
  return n;
}

export function toLatex(x, ctx = 0) {
  // ctx precedence of parent: 0 top/add, 1 mul, 2 pow-base, 3 exponent
  switch (x.t) {
    case 'num': {
      const s = x.v.toLatex();
      return (x.v.sign < 0 && ctx >= 1) || (!x.v.isInt && ctx >= 2) ? `\\left(${s}\\right)` : s;
    }
    case 'sym': return symLatex(x.n);
    case 'add': {
      const ts = orderedTerms(x);
      let s = '';
      ts.forEach((t, idx) => {
        if (idx === 0) s += toLatex(t, 0);
        else if (isNegative(t)) s += ' - ' + toLatex(neg(t), 0);
        else s += ' + ' + toLatex(t, 0);
      });
      return ctx >= 1 ? `\\left(${s}\\right)` : s;
    }
    case 'mul': {
      const { c, num, den } = splitFrac(x);
      const sign = c.sign < 0 ? '-' : '';
      const ca = c.abs();
      const numC = ca.n, denC = ca.d;
      const joinF = (fs, cnum) => {
        const parts = fs.map((f) => toLatex(f, fs.length === 1 && cnum === 1n && (den.length || denC !== 1n) ? 0 : 1));
        let s = parts.join(' \\, ');
        if (fs.length > 1) s = parts.reduce((acc, p, i) => {
          if (i === 0) return p;
          const needsDot = /^[\d\\(]/.test(p) && /\d$/.test(acc);
          return acc + (needsDot ? ' \\cdot ' : ' ') + p;
        }, '');
        if (cnum !== 1n) s = fs.length ? `${cnum}${/^\d/.test(parts[0]) ? ' \\cdot ' : ' '}${s}` : `${cnum}`;
        else if (!fs.length) s = '1';
        return s;
      };
      let s;
      if (den.length || denC !== 1n) {
        const top = joinF(num, numC);
        const bottom = joinF(den, denC);
        s = `${sign}\\frac{${top}}{${bottom}}`;
      } else {
        s = sign + joinF(num, numC);
      }
      return (sign && ctx >= 1) || ctx >= 2 ? `\\left(${s}\\right)` : s;
    }
    case 'pow': {
      const b = x.b, e = x.e;
      if (isNum(e) && e.v.eq(HALF.v)) return `\\sqrt{${toLatex(b, 0)}}`;
      if (isNum(e) && e.v.n === 1n && e.v.d > 2n && e.v.d < 10n) return `\\sqrt[${e.v.d}]{${toLatex(b, 0)}}`;
      if (isNum(e) && e.v.sign < 0) {
        const inner = P(b, numQ(e.v.neg()));
        const s = `\\frac{1}{${toLatex(inner, 0)}}`;
        return ctx >= 2 ? `\\left(${s}\\right)` : s;
      }
      if (b.t === 'fn' && isNum(e) && e.v.isInt && ['sin', 'cos', 'tan', 'sinh', 'cosh', 'tanh', 'log'].includes(b.n)) {
        return `${LATEX_FN[b.n]}^{${e.v.n}}${fnArgLatex(b.a[0])}`;
      }
      const bs = toLatex(b, 2);
      return `${bs}^{${toLatex(e, 0)}}`;
    }
    case 'fn': return fnLatex(x);
    case 'rel': {
      const ops = { '=': '=', '<': '<', '>': '>', '<=': '\\le', '>=': '\\ge', '!=': '\\ne' };
      return `${toLatex(x.l)} ${ops[x.op]} ${toLatex(x.r)}`;
    }
    case 'list': {
      if (x.a.length && x.a.every((r) => r.t === 'list')) return matrixLatex(x.a.map((r) => r.a));
      return `\\left(${x.a.map((y) => toLatex(y)).join(', ')}\\right)`;
    }
    default: return '?';
  }
}
function fnArgLatex(a) {
  const s = toLatex(a, 0);
  if (a.t === 'sym' || (a.t === 'num' && a.v.isInt && a.v.sign >= 0)) return ' ' + s;
  if (a.t === 'mul' && a.a.length === 2 && isNum(a.a[0]) && a.a[0].v.isInt && a.a[0].v.sign > 0 && a.a[1].t === 'sym') return ' ' + s;
  return `\\left(${s}\\right)`;
}
function fnLatex(x) {
  const n = x.n, a = x.a;
  if (n === 'exp') return `e^{${toLatex(a[0], 0)}}`;
  if (n === 'abs') return `\\left|${toLatex(a[0])}\\right|`;
  if (n === 'factorial') return `${toLatex(a[0], 2)}!`;
  if (n === 'floor') return `\\lfloor ${toLatex(a[0])} \\rfloor`;
  if (n === 'ceil') return `\\lceil ${toLatex(a[0])} \\rceil`;
  if (n === 'binomial') return `\\binom{${toLatex(a[0])}}{${toLatex(a[1])}}`;
  if (n === 'besselj') return `J_{${toLatex(a[0])}}\\left(${toLatex(a[1])}\\right)`;
  if (n === 'conj') return `\\overline{${toLatex(a[0])}}`;
  const f = LATEX_FN[n] || `\\operatorname{${n}}`;
  if (a.length === 1 && ['sin', 'cos', 'tan', 'sinh', 'cosh', 'tanh', 'log'].includes(n)) return f + fnArgLatex(a[0]);
  return `${f}\\left(${a.map((y) => toLatex(y)).join(', ')}\\right)`;
}
export function matrixLatex(rows) {
  return `\\begin{pmatrix} ${rows.map((r) => r.map((c) => (typeof c === 'string' ? c : toLatex(c))).join(' & ')).join(' \\\\ ')} \\end{pmatrix}`;
}

export function toStr(x, ctx = 0) {
  switch (x.t) {
    case 'num': {
      const s = x.v.toString();
      return (x.v.sign < 0 && ctx >= 1) || (!x.v.isInt && ctx >= 1) ? `(${s})` : s;
    }
    case 'sym': return x.n === 'oo' ? 'oo' : x.n;
    case 'add': {
      const ts = orderedTerms(x);
      let s = '';
      ts.forEach((t, idx) => {
        if (idx === 0) s += toStr(t, 0);
        else if (isNegative(t)) s += ' - ' + toStr(neg(t), 0);
        else s += ' + ' + toStr(t, 0);
      });
      return ctx >= 1 ? `(${s})` : s;
    }
    case 'mul': {
      const { c, num, den } = splitFrac(x);
      const sign = c.sign < 0 ? '-' : '';
      const ca = c.abs();
      const joinF = (fs, cn) => {
        const parts = fs.map((f) => toStr(f, fs.length === 1 && cn === 1n && (den.length || ca.d !== 1n) ? 0 : 1));
        let s = parts.join('*');
        if (cn !== 1n) s = fs.length ? `${cn}${/^[a-zA-Z(]/.test(parts[0]) ? '' : '*'}${s}` : `${cn}`;
        else if (!fs.length) s = '1';
        return s;
      };
      let s;
      if (den.length || ca.d !== 1n) {
        let top = joinF(num, ca.n);
        let bottom = joinF(den, ca.d);
        if (num.length === 1 && num[0].t === 'add' && ca.n === 1n) top = `(${top})`;
        if (den.length + (ca.d !== 1n ? 1 : 0) > 1 || (den.length === 1 && den[0].t === 'add')) bottom = `(${bottom})`;
        s = `${sign}${top}/${bottom}`;
      } else s = sign + joinF(num, ca.n);
      return (sign && ctx >= 1) || ctx >= 2 ? `(${s})` : s;
    }
    case 'pow': {
      const b = x.b, e = x.e;
      if (isNum(e) && e.v.eq(HALF.v)) return `sqrt(${toStr(b)})`;
      if (isNum(e) && e.v.sign < 0) {
        const s = `1/${toStr(P(b, numQ(e.v.neg())), 2)}`;
        return ctx >= 1 ? `(${s})` : s;
      }
      const es = toStr(e, 2);
      return `${toStr(b, 2)}^${es}`;
    }
    case 'fn': {
      if (x.n === 'factorial') return `${toStr(x.a[0], 2)}!`;
      const nm = x.n === 'log' ? 'ln' : x.n;
      return `${nm}(${x.a.map((y) => toStr(y)).join(', ')})`;
    }
    case 'rel': return `${toStr(x.l)} ${x.op} ${toStr(x.r)}`;
    case 'list': return `[${x.a.map((y) => toStr(y)).join(', ')}]`;
    default: return '?';
  }
}

/* ---------------- numeric evaluation ---------------- */

import { gammaFn, lgammaFn, erfFn, erfcFn, zetaFn, besselJ, digammaFn, lambertW, betaFn, cx } from './special.js';

const RFN = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
  exp: Math.exp, log: Math.log, abs: Math.abs, sign: Math.sign, floor: Math.floor, ceil: Math.ceil, round: Math.round,
  gamma: gammaFn, lgamma: lgammaFn, erf: erfFn, erfc: erfcFn, zeta: zetaFn, digamma: digammaFn, lambertw: lambertW,
  factorial: (v) => gammaFn(v + 1), re: (v) => v, im: () => 0, conj: (v) => v, arg: (v) => (v < 0 ? Math.PI : 0),
  Heaviside: (v) => (v > 0 ? 1 : v < 0 ? 0 : 0.5),
};

export function evalReal(x, env = {}) {
  switch (x.t) {
    case 'num': return x.v.toNumber();
    case 'sym':
      if (x.n in env) return env[x.n];
      if (x.n === 'pi') return Math.PI;
      if (x.n === 'e') return Math.E;
      if (x.n === 'oo') return Infinity;
      if (x.n === 'i') return NaN;
      return NaN;
    case 'add': { let s = 0; for (const t of x.a) s += evalReal(t, env); return s; }
    case 'mul': { let s = 1; for (const t of x.a) s *= evalReal(t, env); return s; }
    case 'pow': {
      const b = evalReal(x.b, env);
      if (isNum(x.e) && !x.e.v.isInt && x.e.v.d % 2n === 1n && b < 0) {
        // real odd root
        const r = Math.pow(-b, x.e.v.toNumber());
        return x.e.v.n % 2n === 0n ? r : -r;
      }
      return Math.pow(b, evalReal(x.e, env));
    }
    case 'fn': {
      const a = x.a.map((y) => evalReal(y, env));
      if (RFN[x.n]) return RFN[x.n](a[0]);
      switch (x.n) {
        case 'atan2': return Math.atan2(a[0], a[1]);
        case 'besselj': return besselJ(a[0], a[1]);
        case 'beta': return betaFn(a[0], a[1]);
        case 'binomial': return Math.exp(lgammaFn(a[0] + 1) - lgammaFn(a[1] + 1) - lgammaFn(a[0] - a[1] + 1)) * (Number.isInteger(a[0]) && Number.isInteger(a[1]) ? 1 : 1);
        case 'max': return Math.max(...a);
        case 'min': return Math.min(...a);
        case 'mod': return ((a[0] % a[1]) + a[1]) % a[1];
        case 'log': return Math.log(a[0]);
        default: return NaN;
      }
    }
    default: return NaN;
  }
}

/** Compile an expression to a fast JS function of the named variables (real). */
export function compileReal(x, vars = ['x']) {
  const env = {};
  return (...vals) => { for (let k = 0; k < vars.length; k++) env[vars[k]] = vals[k]; return evalReal(x, env); };
}

export function evalComplex(x, env = {}) {
  switch (x.t) {
    case 'num': return cx.of(x.v.toNumber(), 0);
    case 'sym':
      if (x.n in env) { const v = env[x.n]; return typeof v === 'number' ? cx.of(v, 0) : v; }
      if (x.n === 'pi') return cx.of(Math.PI, 0);
      if (x.n === 'e') return cx.of(Math.E, 0);
      if (x.n === 'i') return cx.of(0, 1);
      if (x.n === 'oo') return cx.of(Infinity, 0);
      return cx.of(NaN, NaN);
    case 'add': { let s = cx.of(0, 0); for (const t of x.a) s = cx.add(s, evalComplex(t, env)); return s; }
    case 'mul': { let s = cx.of(1, 0); for (const t of x.a) s = cx.mul(s, evalComplex(t, env)); return s; }
    case 'pow': {
      const b = evalComplex(x.b, env);
      if (isNum(x.e) && x.e.v.isInt && babs(x.e.v.n) < 64n) return cx.powi(b, Number(x.e.v.n));
      return cx.pow(b, evalComplex(x.e, env));
    }
    case 'fn': {
      const a = x.a.map((y) => evalComplex(y, env));
      const z = a[0];
      if (cx[x.n]) return cx[x.n](...a);
      if (a.every((w) => Math.abs(w.im) < 1e-300)) {
        const r = evalReal({ t: 'fn', n: x.n, a: x.a.map((y) => numQ(Q.fromNumber(evalComplex(y, env).re))) }, env);
        return cx.of(r, 0);
      }
      return cx.of(NaN, NaN);
    }
    default: return cx.of(NaN, NaN);
  }
}

/** Nicely format a JS number */
export function fmtNum(v, sig = 12) {
  if (typeof v !== 'number') return String(v);
  if (Number.isNaN(v)) return 'undefined';
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '-∞';
  if (v === 0) return '0';
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
  const a = Math.abs(v);
  if (a >= 1e-5 && a < 1e15) return String(parseFloat(v.toPrecision(sig)));
  return v.toExponential(Math.min(sig - 1, 10)).replace(/\.?0+e/, 'e');
}
export function fmtComplex(z, sig = 12) {
  const re = Math.abs(z.re) < 1e-13 * Math.max(1, Math.abs(z.im)) ? 0 : z.re;
  const im = Math.abs(z.im) < 1e-13 * Math.max(1, Math.abs(z.re)) ? 0 : z.im;
  if (!im) return fmtNum(re, sig);
  const ims = Math.abs(im) === 1 ? '' : fmtNum(Math.abs(im), sig);
  if (!re) return `${im < 0 ? '-' : ''}${ims}i`;
  return `${fmtNum(re, sig)} ${im < 0 ? '-' : '+'} ${ims}i`;
}
export function numLatex(v, sig = 12) {
  const s = fmtNum(v, sig);
  const m = s.match(/^(-?[\d.]+)e([+-]?\d+)$/);
  if (m) return `${m[1]} \\times 10^{${parseInt(m[2], 10)}}`;
  return s.replace('∞', '\\infty');
}

/** Is expression free of variables (pure constant)? */
export const isConstant = (x) => freeSyms(x).size === 0;
