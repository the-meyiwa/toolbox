/* ============================================================
   mathx / poly — univariate polynomials over Q (exact), plus
   expression <-> polynomial conversion, expand/collect, factoring
   over Q (numeric-guided, verified by exact division), square-free
   decomposition, all complex roots (Aberth–Ehrlich), exact roots
   for linear/quadratic factors, partial fractions, rational
   simplification. Pure (no DOM).
   ============================================================ */

import { Q, Q0, Q1, bgcd, blcm, babs } from './rational.js';
import {
  A, M, P, F, N, S, ONE, ZERO, MONE, HALF, numQ, isNum, key, has, simpAdd, simpMul, simpPow, simplifyTree,
  neg, div, sub, sqrtE, equal, I
} from './expr.js';

/* ---------------- expand ---------------- */

export function expand(x) {
  switch (x.t) {
    case 'add': return A(x.a.map(expand));
    case 'mul': {
      let acc = ONE;
      for (const f of x.a.map(expand)) acc = mulExpand(acc, f);
      return acc;
    }
    case 'pow': {
      const b = expand(x.b), e = expand(x.e);
      if (b.t === 'add' && isNum(e) && e.v.isInt && e.v.sign > 0 && e.v.n <= 60n) {
        let r = ONE;
        const n = Number(e.v.n);
        // binary powering with expansion
        let base = b, k = n, res = null;
        while (k) {
          if (k & 1) res = res ? mulExpand(res, base) : base;
          k >>= 1;
          if (k) base = mulExpand(base, base);
        }
        r = res;
        return r;
      }
      if (b.t === 'add' && isNum(e) && e.v.isInt && e.v.sign < 0) return P(expand(P(b, numQ(e.v.neg()))), MONE);
      return P(b, e);
    }
    case 'fn': return F(x.n, ...x.a.map(expand));
    case 'rel': return { t: 'rel', op: x.op, l: expand(x.l), r: expand(x.r) };
    case 'list': return { t: 'list', a: x.a.map(expand) };
    default: return x;
  }
}

export function mulExpand(a, b) {
  const as = a.t === 'add' ? a.a : [a], bs = b.t === 'add' ? b.a : [b];
  if (as.length * bs.length > 40000) throw new Error('Expansion too large');
  const out = [];
  for (const u of as) for (const w of bs) {
    const t = M(u, w);
    if (t.t === 'add') out.push(...t.a); else out.push(t);
  }
  return A(out);
}

/* ---------------- coefficients in a variable ---------------- */

/** degree of a monomial term in v (number) or null if not polynomial in v */
function termDeg(t, v) {
  if (!has(t, v)) return 0;
  if (t.t === 'sym') return 1;
  if (t.t === 'pow' && t.b.t === 'sym' && t.b.n === v && isNum(t.e) && t.e.v.isInt && t.e.v.sign > 0) return Number(t.e.v.n);
  if (t.t === 'mul') {
    let d = 0;
    for (const f of t.a) { const k = termDeg(f, v); if (k === null) return null; d += k; }
    return d;
  }
  return null;
}
function termStrip(t, v) {
  if (!has(t, v)) return t;
  if (t.t === 'sym' || t.t === 'pow') return ONE;
  return M(t.a.filter((f) => !has(f, v)));
}
/** expanded expr -> Map(degree -> coefficient expr) or null */
export function coeffsIn(x, v) {
  const e = expand(x);
  const ts = e.t === 'add' ? e.a : [e];
  const m = new Map();
  for (const t of ts) {
    const d = termDeg(t, v);
    if (d === null) return null;
    const c = termStrip(t, v);
    m.set(d, m.has(d) ? A(m.get(d), c) : c);
  }
  for (const [d, c] of [...m]) if (equal(c, ZERO)) m.delete(d);
  return m;
}

export function collect(x, v) {
  const m = coeffsIn(x, v);
  if (!m) return x;
  const degs = [...m.keys()].sort((a, b) => b - a);
  return A(degs.map((d) => M(m.get(d), P(S(v), N(d)))));
}

/* ---------------- Q[x] polynomials: arrays, index = degree ---------------- */

export function ptrim(p) { let n = p.length; while (n > 0 && p[n - 1].isZero) n--; return p.slice(0, n); }
export const pdeg = (p) => ptrim(p).length - 1;
export const plc = (p) => { const t = ptrim(p); return t.length ? t[t.length - 1] : Q0; };
export function padd(a, b) { const r = []; for (let i = 0; i < Math.max(a.length, b.length); i++) r.push((a[i] || Q0).add(b[i] || Q0)); return ptrim(r); }
export function psub(a, b) { const r = []; for (let i = 0; i < Math.max(a.length, b.length); i++) r.push((a[i] || Q0).sub(b[i] || Q0)); return ptrim(r); }
export function pscale(a, c) { return ptrim(a.map((x) => x.mul(c))); }
export function pmul(a, b) {
  if (!a.length || !b.length) return [];
  const r = new Array(a.length + b.length - 1).fill(Q0);
  for (let i = 0; i < a.length; i++) if (!a[i].isZero) for (let j = 0; j < b.length; j++) r[i + j] = r[i + j].add(a[i].mul(b[j]));
  return ptrim(r);
}
export function pdivmod(a, b) {
  a = ptrim(a); b = ptrim(b);
  if (!b.length) throw new Error('Polynomial division by zero');
  let r = a.slice();
  const q = new Array(Math.max(0, a.length - b.length + 1)).fill(Q0);
  const lb = b[b.length - 1];
  while (r.length >= b.length && r.length) {
    const k = r.length - b.length;
    const c = r[r.length - 1].div(lb);
    q[k] = c;
    for (let i = 0; i < b.length; i++) r[i + k] = r[i + k].sub(c.mul(b[i]));
    r = ptrim(r);
  }
  return [ptrim(q), r];
}
export function pmonic(p) { p = ptrim(p); if (!p.length) return p; const l = p[p.length - 1]; return p.map((c) => c.div(l)); }
export function pgcd(a, b) {
  a = ptrim(a); b = ptrim(b);
  while (b.length) { const [, r] = pdivmod(a, b); a = b; b = r; }
  return pmonic(a);
}
export function pderiv(p) { const r = []; for (let i = 1; i < p.length; i++) r.push(p[i].mul(new Q(BigInt(i)))); return ptrim(r); }
export function pevalQ(p, x) { let r = Q0; for (let i = p.length - 1; i >= 0; i--) r = r.mul(x).add(p[i]); return r; }
export function pevalC(p, z) {
  let re = 0, im = 0;
  for (let i = p.length - 1; i >= 0; i--) { const nr = re * z.re - im * z.im + p[i].toNumber(); im = re * z.im + im * z.re; re = nr; }
  return { re, im };
}
/** content & primitive integer polynomial: p = c * prim, prim in Z[x] with positive lc */
export function primitive(p) {
  p = ptrim(p);
  if (!p.length) return [Q0, []];
  let L = 1n; for (const c of p) L = blcm(L, c.d) || 1n;
  const ints = p.map((c) => c.n * (L / c.d));
  let g = 0n; for (const c of ints) g = bgcd(g, c);
  let sgn = ints[ints.length - 1] < 0n ? -1n : 1n;
  const prim = ints.map((c) => new Q(c / g * sgn));
  return [new Q(g * sgn, L), prim];
}

export function toPoly(x, v) {
  const m = coeffsIn(x, v);
  if (!m) return null;
  let deg = 0; for (const d of m.keys()) deg = Math.max(deg, d);
  const p = new Array(deg + 1).fill(Q0);
  for (const [d, c] of m) { if (!isNum(c)) return null; p[d] = c.v; }
  return ptrim(p);
}
export function fromPoly(p, v) {
  const x = S(v);
  const ts = [];
  for (let i = 0; i < p.length; i++) if (!p[i].isZero) ts.push(M(numQ(p[i]), P(x, N(i))));
  return A(ts);
}
export function polyLatexStr(p, v) { return fromPoly(p, v); }

/* ---------------- square-free (Yun) ---------------- */
export function squareFree(p) {
  // returns [[factor, multiplicity], ...] with monic factors
  p = pmonic(p);
  const out = [];
  if (pdeg(p) < 1) return out;
  let a = pgcd(p, pderiv(p));
  let b = pdivmod(p, a)[0];
  let c = pdivmod(pderiv(p), a)[0];
  let d = psub(c, pderiv(b));
  let i = 1;
  while (pdeg(b) >= 1) {
    a = pgcd(b, d);
    if (pdeg(a) >= 1) out.push([pmonic(a), i]);
    b = pdivmod(b, a)[0];
    c = pdivmod(d, a)[0];
    d = psub(c, pderiv(b));
    i++;
    if (i > 200) break;
  }
  return out;
}

/* ---------------- numeric roots: Aberth–Ehrlich ---------------- */
export function polyRootsNumeric(p) {
  p = ptrim(p);
  const n = p.length - 1;
  if (n < 1) return [];
  const c = p.map((q) => q.toNumber());
  // scale for conditioning
  const lc = c[n];
  const a = c.map((v) => v / lc);
  if (n === 1) return [{ re: -a[0], im: 0 }];
  // Cauchy bound radius
  let R = 0; for (let i = 0; i < n; i++) R = Math.max(R, Math.abs(a[i]));
  R = 1 + R;
  let r0 = 0; for (let i = 0; i < n; i++) r0 = Math.max(r0, Math.pow(Math.abs(a[i]), 1 / (n - i)));
  const rad = Math.min(R, 2 * r0 || 1);
  let z = [];
  for (let k = 0; k < n; k++) { const th = 2 * Math.PI * k / n + 0.4; z.push({ re: rad * Math.cos(th), im: rad * Math.sin(th) }); }
  const ev = (w) => { // p(w), p'(w)
    let pr = 1, pi = 0, dr = 0, di = 0;
    for (let i = n - 1; i >= 0; i--) {
      const ndr = dr * w.re - di * w.im + pr, ndi = dr * w.im + di * w.re + pi;
      dr = ndr; di = ndi;
      const npr = pr * w.re - pi * w.im + a[i], npi = pr * w.im + pi * w.re;
      pr = npr; pi = npi;
    }
    return [pr, pi, dr, di];
  };
  for (let it = 0; it < 500; it++) {
    let maxStep = 0;
    for (let k = 0; k < n; k++) {
      const [pr, pi, dr, di] = ev(z[k]);
      const dd = dr * dr + di * di;
      if (pr === 0 && pi === 0) continue;
      // ratio = p/p'
      const rr = (pr * dr + pi * di) / dd, ri = (pi * dr - pr * di) / dd;
      let sr = 0, si = 0;
      for (let j = 0; j < n; j++) if (j !== k) {
        const xr = z[k].re - z[j].re, xi = z[k].im - z[j].im;
        const m = xr * xr + xi * xi || 1e-300;
        sr += xr / m; si += -xi / m;
      }
      // w = ratio / (1 - ratio*sum)
      const tr = 1 - (rr * sr - ri * si), ti = -(rr * si + ri * sr);
      const tm = tr * tr + ti * ti || 1e-300;
      const wr = (rr * tr + ri * ti) / tm, wi = (ri * tr - rr * ti) / tm;
      z[k] = { re: z[k].re - wr, im: z[k].im - wi };
      maxStep = Math.max(maxStep, Math.hypot(wr, wi) / (1 + Math.hypot(z[k].re, z[k].im)));
    }
    if (maxStep < 1e-15) break;
  }
  // Newton polish on original
  z = z.map((w) => {
    for (let i = 0; i < 3; i++) {
      const [pr, pi, dr, di] = ev(w); const dd = dr * dr + di * di; if (!dd) break;
      w = { re: w.re - (pr * dr + pi * di) / dd, im: w.im - (pi * dr - pr * di) / dd };
    }
    if (Math.abs(w.im) < 1e-12 * Math.max(1, Math.abs(w.re))) w = { re: w.re, im: 0 };
    return w;
  });
  z.sort((u, v) => (u.re - v.re) || (u.im - v.im));
  return z;
}

/* ---------------- factor over Q ---------------- */

function roundBig(x) { return BigInt(Math.round(x)); }

function factorSquareFreeZ(p) {
  // p primitive in Z[x], square-free, deg >= 1. Returns list of primitive integer factors.
  p = ptrim(p);
  const n = p.length - 1;
  if (n <= 1) return [p];
  // rational root test first (fast & exact)
  const lc = p[n].n, c0 = p[0].n;
  if (c0 === 0n) {
    const rest = pdivmod(p, [Q0, Q1])[0];
    return [[Q0, Q1], ...factorSquareFreeZ(primitive(rest)[1])];
  }
  const roots = polyRootsNumeric(p);
  // try rational roots near real numeric roots
  for (const r of roots) {
    if (r.im !== 0) continue;
    for (let q = 1n; q <= babs(lc) && q <= 100000n; q++) {
      if (lc % q !== 0n) continue;
      const num = roundBig(r.re * Number(q));
      const cand = new Q(num, q);
      if (pevalQ(p, cand).isZero) {
        const lin = primitive([cand.neg(), Q1])[1];
        const rest = pdivmod(p, lin)[0];
        return [lin, ...factorSquareFreeZ(primitive(rest)[1])];
      }
    }
  }
  if (n <= 3) return [p]; // no rational root => irreducible for deg 2,3
  if (n > 18) return [p];
  // numeric-guided subset search for higher-degree factors
  const L = Math.abs(p[n].toNumber());
  const idx = roots.map((_, i) => i);
  const tryDeg = (k) => {
    const combo = [];
    const rec = (start) => {
      if (combo.length === k) {
        // product of (x - r)
        let cr = [1], ci = [0];
        for (const j of combo) {
          const r = roots[j];
          const nr = new Array(cr.length + 1).fill(0), ni = new Array(cr.length + 1).fill(0);
          for (let t = 0; t < cr.length; t++) {
            nr[t + 1] += cr[t]; ni[t + 1] += ci[t];
            nr[t] += -(cr[t] * r.re - ci[t] * r.im); ni[t] += -(cr[t] * r.im + ci[t] * r.re);
          }
          cr = nr; ci = ni;
        }
        if (ci.some((v) => Math.abs(v) * L > 1e-6 * Math.max(1, ...cr.map(Math.abs)) * L)) return null;
        const ints = cr.map((v) => v * L);
        if (ints.some((v) => Math.abs(v - Math.round(v)) > 1e-6 * Math.max(1, Math.abs(v)))) return null;
        const cand = primitive(ints.map((v) => new Q(roundBig(v))))[1];
        if (pdeg(cand) !== k) return null;
        const [qq, rr] = pdivmod(p, cand);
        if (!rr.length) return [cand, qq];
        return null;
      }
      for (let s = start; s < idx.length; s++) {
        combo.push(s);
        const res = rec(s + 1);
        combo.pop();
        if (res) return res;
      }
      return null;
    };
    return rec(0);
  };
  for (let k = 2; k <= Math.floor(n / 2); k++) {
    const res = tryDeg(k);
    if (res) {
      const [f, rest] = res;
      return [...factorSquareFreeZ(f), ...factorSquareFreeZ(primitive(rest)[1])];
    }
  }
  return [p];
}

/**
 * Factor polynomial over Q. Returns {content: Q, factors: [[primPoly, mult], ...]}
 */
export function factorPolyQ(p) {
  p = ptrim(p);
  const [cont, prim] = primitive(p);
  if (pdeg(prim) < 1) return { content: cont.mul(prim[0] || Q1), factors: [] };
  const sqf = squareFree(prim);
  const factors = [];
  for (const [f, m] of sqf) {
    const pf = primitive(f)[1];
    for (const g of factorSquareFreeZ(pf)) factors.push([primitive(g)[1], m]);
  }
  // fix content so that content * prod(factors) == p
  let prod = [Q1];
  for (const [f, m] of factors) for (let i = 0; i < m; i++) prod = pmul(prod, f);
  const c = plc(p).div(plc(prod));
  factors.sort((a, b) => (pdeg(a[0]) - pdeg(b[0])) || (a[0][0].cmp(b[0][0])));
  return { content: c, factors };
}

/* ---------------- exact roots of a polynomial ---------------- */

/** returns {exact:[{expr, mult}], numeric:[{re,im,mult}], factorization} */
export function polyRoots(p, v = 'x') {
  const { content, factors } = factorPolyQ(p);
  const exact = [], numeric = [];
  for (const [f, m] of factors) {
    const d = pdeg(f);
    if (d === 1) exact.push({ expr: numQ(f[0].neg().div(f[1])), mult: m });
    else if (d === 2) {
      const [c, b, a] = f;
      const D = b.mul(b).sub(a.mul(c).mul(new Q(4n)));
      const sq = sqrtE(numQ(D));
      const den = a.mul(new Q(2n));
      exact.push({ expr: div(A(numQ(b.neg()), neg(sq)), numQ(den)), mult: m });
      exact.push({ expr: div(A(numQ(b.neg()), sq), numQ(den)), mult: m });
    } else if (d === 3 || d === 4) {
      const ex = d === 3 ? cardano(f) : null;
      if (ex) ex.forEach((e) => exact.push({ expr: e, mult: m }));
      else polyRootsNumeric(f).forEach((z) => numeric.push({ ...z, mult: m }));
    } else polyRootsNumeric(f).forEach((z) => numeric.push({ ...z, mult: m }));
  }
  return { content, factors, exact, numeric };
}

/** Cardano for irreducible cubic with one real root (casus irreducibilis -> null => numeric). */
function cardano(f) {
  const [d0, c0, b0, a0] = f;
  const b = b0.div(a0), c = c0.div(a0), d = d0.div(a0);
  // depressed t^3 + pt + q, x = t - b/3
  const p = c.sub(b.mul(b).div(new Q(3n)));
  const q = new Q(2n).mul(b.pow(3)).div(new Q(27n)).sub(b.mul(c).div(new Q(3n))).add(d);
  const disc = q.mul(q).div(new Q(4n)).add(p.pow(3).div(new Q(27n)));
  if (disc.sign <= 0) return null; // three real roots -> give numerics
  const s = sqrtE(numQ(disc));
  const third = numQ(new Q(1n, 3n));
  const u = cbrtReal(A(numQ(q.neg().div(new Q(2n))), s));
  const w = cbrtReal(A(numQ(q.neg().div(new Q(2n))), neg(s)));
  const real = A(u, w, numQ(b.neg().div(new Q(3n))));
  return [real];
  function cbrtReal(e) {
    // real cube root: sign handling
    const val = numVal(e);
    if (val < 0) return neg(P(neg(e), third));
    return P(e, third);
  }
}
function numVal(e) {
  // local numeric evaluation for constants (avoid import cycle issues)
  switch (e.t) {
    case 'num': return e.v.toNumber();
    case 'add': return e.a.reduce((s, t) => s + numVal(t), 0);
    case 'mul': return e.a.reduce((s, t) => s * numVal(t), 1);
    case 'pow': return Math.pow(numVal(e.b), numVal(e.e));
    case 'sym': return e.n === 'pi' ? Math.PI : e.n === 'e' ? Math.E : NaN;
    default: return NaN;
  }
}

/* ---------------- rational functions ---------------- */

/** numerator/denominator of an expression (combining over common denominator) */
export function numden(x) {
  if (x.t === 'num') return [numQ(new Q(x.v.n)), numQ(new Q(x.v.d))];
  if (x.t === 'pow' && isNum(x.e) && x.e.v.sign < 0) return [ONE, P(x.b, numQ(x.e.v.neg()))];
  if (x.t === 'mul') {
    const nums = [], dens = [];
    for (const f of x.a) { const [n, d] = numden(f); nums.push(n); dens.push(d); }
    return [M(nums), M(dens)];
  }
  if (x.t === 'add') {
    let n = ZERO, d = ONE;
    for (const t of x.a) {
      const [tn, td] = numden(t);
      if (equal(td, d)) { n = A(n, tn); continue; }
      n = A(M(n, td), M(tn, d));
      d = M(d, td);
    }
    return [n, d];
  }
  return [x, ONE];
}

/** together + cancel for univariate rational functions in v (exact) */
export function cancel(x, v) {
  const [n0, d0] = numden(x);
  const pn = toPoly(n0, v), pd = toPoly(d0, v);
  if (!pn || !pd) return div(expand(n0), expand(d0));
  if (!pd.length) throw new Error('Division by zero');
  const g = pgcd(pn, pd);
  let [qn] = pdivmod(pn, g);
  let [qd] = pdivmod(pd, g);
  const l = plc(qd);
  qn = pscale(qn, l.inv()); qd = pscale(qd, l.inv());
  return div(fromPoly(qn, v), fromPoly(qd, v));
}

/** factored form of a polynomial expression */
export function factorPolyExpr(p, v) {
  const { content, factors } = factorPolyQ(p);
  const parts = [numQ(content)];
  for (const [f, m] of factors) parts.push(P(fromPoly(f, v), N(m)));
  return { expr: mulNoDistribute(parts), content, factors };
}
/** product that keeps a numeric factor outside a single sum (display form) */
export function mulNoDistribute(parts) {
  const c = parts.filter(isNum).reduce((acc, n) => acc.mul(n.v), Q1);
  const rest = parts.filter((p) => !isNum(p) && !(isNum(p) && p.v.isOne));
  if (c.isOne) return rest.length ? (rest.length === 1 ? rest[0] : { t: 'mul', a: rest }) : ONE;
  if (!rest.length) return numQ(c);
  return { t: 'mul', a: [numQ(c), ...rest] };
}

/* ---------------- partial fractions ---------------- */
import { solveLinearQ } from './linalg-exact.js';

/**
 * apart(x, v) -> {expr, terms:[{num, den, k}], poly}
 */
export function apart(x, v) {
  const [n0, d0] = numden(x);
  const pn = toPoly(n0, v), pd = toPoly(d0, v);
  if (!pn || !pd) throw new Error('Partial fractions need a rational function with rational coefficients');
  const g = pgcd(pn, pd);
  let num = pdivmod(pn, g)[0], den = pdivmod(pd, g)[0];
  const [polyPart, rem] = pdivmod(num, den);
  const { content, factors } = factorPolyQ(den);
  // unknown numerators: for each factor f^m, terms A_j(x)/f^j, deg A_j < deg f
  const blocks = [];
  let nUnk = 0;
  for (const [f, m] of factors) for (let j = 1; j <= m; j++) { blocks.push({ f, j, d: pdeg(f), off: nUnk }); nUnk += pdeg(f); }
  const D = pdeg(den);
  // rem / content = sum A_j * (den/content)/f^j
  const denMonicish = pscale(den, content.inv());
  const cols = [];
  for (const b of blocks) {
    let fj = [Q1]; for (let i = 0; i < b.j; i++) fj = pmul(fj, b.f);
    const cof = pdivmod(denMonicish, fj)[0];
    for (let k = 0; k < b.d; k++) { const shifted = new Array(k).fill(Q0).concat(cof); cols.push(shifted); }
  }
  const target = pscale(rem, content.inv());
  const rows = [];
  for (let r = 0; r < D; r++) rows.push(cols.map((c) => c[r] || Q0));
  const rhs = []; for (let r = 0; r < D; r++) rhs.push(target[r] || Q0);
  const sol = solveLinearQ(rows, rhs);
  if (!sol) throw new Error('Partial fraction system singular');
  const terms = [];
  const outs = [fromPoly(polyPart, v)];
  for (const b of blocks) {
    const coeffs = sol.slice(b.off, b.off + b.d);
    const numP = ptrim(coeffs);
    if (!numP.length) continue;
    const numE = fromPoly(numP, v);
    const denE = P(fromPoly(b.f, v), N(b.j));
    terms.push({ num: numP, f: b.f, j: b.j });
    outs.push(M(numE, P(denE, MONE)));
  }
  const exprDisplay = outs.filter((o) => !equal(o, ZERO));
  return { expr: exprDisplay.length ? (exprDisplay.length === 1 ? exprDisplay[0] : { t: 'add', a: exprDisplay }) : ZERO, terms, poly: polyPart, simplified: A(exprDisplay) };
}

/* ---------------- polynomial expression helpers ---------------- */
export function polyToLatexFactored(p, v) { return factorPolyExpr(p, v).expr; }
export function isPolyIn(x, v) { return coeffsIn(x, v) !== null; }
export { simplifyTree, I };
