/* ============================================================
   mathx / calculus — symbolic differentiation (with rule steps),
   gradient/Jacobian/Hessian, symbolic integration (table, linear
   substitution, rational functions via partial fractions,
   derivative-divides substitution, by parts, trig powers) with
   verification by differentiation, adaptive Gauss–Kronrod and
   tanh-sinh quadrature, limits (substitution, L'Hôpital, rational
   degree rule, numeric Richardson), Taylor series (exact power-series
   arithmetic, fallback to derivatives), sums/products with closed
   forms. Pure (no DOM).
   ============================================================ */

import { Q, Q0, Q1, rationalApprox } from './rational.js';
import {
  A, M, P, F, N, S, ONE, ZERO, MONE, TWO, HALF, PI, E, OO, numQ, isNum, isSym, isZero, isOne, key, equal, has,
  neg, sub, div, sqrtE, subs, replace, freeSyms, toLatex, toStr, evalReal, simplifyTree, isInf, fmtNum, CONST_SYMS
} from './expr.js';
import { expand, toPoly, fromPoly, apart, numden, cancel, pdeg, coeffsIn, factorPolyExpr } from './poly.js';
import { zetaFn } from './special.js';

/* ============================================================
   DIFFERENTIATION
   ============================================================ */

export function diff(x, v) {
  if (!has(x, v)) return ZERO;
  switch (x.t) {
    case 'sym': return x.n === v ? ONE : ZERO;
    case 'add': return A(x.a.map((t) => diff(t, v)));
    case 'mul': {
      // product rule over factors
      const terms = [];
      for (let i = 0; i < x.a.length; i++) {
        if (!has(x.a[i], v)) continue;
        terms.push(M(...x.a.slice(0, i), diff(x.a[i], v), ...x.a.slice(i + 1)));
      }
      return A(terms);
    }
    case 'pow': {
      const b = x.b, e = x.e;
      if (!has(e, v)) return M(e, P(b, sub(e, ONE)), diff(b, v));
      if (!has(b, v)) return M(x, F('log', b), diff(e, v));
      // general: d(b^e) = b^e (e' ln b + e b'/b)
      return M(x, A(M(diff(e, v), F('log', b)), M(e, diff(b, v), P(b, MONE))));
    }
    case 'fn': {
      const u = x.a[0];
      if (x.n === 'besselj') {
        const nn = x.a[0], z = x.a[1];
        return M(HALF, sub(F('besselj', sub(nn, ONE), z), F('besselj', A(nn, ONE), z)), diff(z, v));
      }
      const du = diff(u, v);
      const outer = fnDeriv(x.n, u, x);
      if (!outer) throw new Error(`Cannot differentiate ${x.n}()`);
      return M(outer, du);
    }
    case 'list': return { t: 'list', a: x.a.map((y) => diff(y, v)) };
    default: throw new Error('Cannot differentiate this expression');
  }
}

function fnDeriv(n, u, whole) {
  switch (n) {
    case 'sin': return F('cos', u);
    case 'cos': return neg(F('sin', u));
    case 'tan': return P(F('cos', u), N(-2));
    case 'asin': return P(sub(ONE, P(u, TWO)), N(new Q(-1n, 2n)));
    case 'acos': return neg(P(sub(ONE, P(u, TWO)), N(new Q(-1n, 2n))));
    case 'atan': return P(A(ONE, P(u, TWO)), MONE);
    case 'sinh': return F('cosh', u);
    case 'cosh': return F('sinh', u);
    case 'tanh': return P(F('cosh', u), N(-2));
    case 'asinh': return P(A(P(u, TWO), ONE), N(new Q(-1n, 2n)));
    case 'acosh': return P(sub(P(u, TWO), ONE), N(new Q(-1n, 2n)));
    case 'atanh': return P(sub(ONE, P(u, TWO)), MONE);
    case 'exp': return whole;
    case 'log': return P(u, MONE);
    case 'abs': return F('sign', u);
    case 'erf': return M(TWO, P(PI, N(new Q(-1n, 2n))), F('exp', neg(P(u, TWO))));
    case 'erfc': return neg(M(TWO, P(PI, N(new Q(-1n, 2n))), F('exp', neg(P(u, TWO)))));
    case 'gamma': return M(whole, F('digamma', u));
    case 'lambertw': return div(whole, M(u, A(ONE, whole)));
    case 'sign': return ZERO;
    default: return null;
  }
}

/** derivative with rule-by-rule step descriptions (top two levels) */
export function diffSteps(x, v) {
  const steps = [];
  const L = (e) => toLatex(e);
  const dv = `\\frac{d}{d${v}}`;
  const describe = (e, depth) => {
    if (depth > 2 || !has(e, v)) return;
    if (e.t === 'add') {
      steps.push({ text: 'Sum rule: differentiate term by term', latex: `${dv}\\left[${L(e)}\\right] = ${e.a.map((t) => `${dv}\\left[${L(t)}\\right]`).join(' + ')}` });
      e.a.forEach((t) => describe(t, depth + 1));
    } else if (e.t === 'mul') {
      const c = e.a.filter((f) => !has(f, v)); const vs = e.a.filter((f) => has(f, v));
      if (c.length && vs.length === 1) {
        steps.push({ text: 'Constant multiple rule', latex: `${dv}\\left[${L(e)}\\right] = ${L(M(c))} \\cdot ${dv}\\left[${L(vs[0])}\\right]` });
        describe(vs[0], depth + 1);
      } else {
        const [n, d] = numden(e);
        if (has(d, v) && !isOne(d) && has(n, v)) {
          steps.push({ text: 'Quotient rule', latex: `\\left(\\frac{f}{g}\\right)' = \\frac{f' g - f g'}{g^2},\\; f = ${L(n)},\\; g = ${L(d)}` });
        } else {
          steps.push({ text: 'Product rule', latex: `(fg)' = f'g + fg',\\; ${vs.map(L).join(',\\;')}` });
        }
        vs.forEach((f) => { const r = diff(f, v); steps.push({ text: `d/d${v} of factor`, latex: `${dv}\\left[${L(f)}\\right] = ${L(r)}` }); });
      }
    } else if (e.t === 'pow') {
      if (!has(e.e, v)) {
        const chain = !isSym(e.b, v);
        steps.push({ text: chain ? 'Power rule with chain rule' : 'Power rule', latex: `${dv}\\left[${L(e)}\\right] = ${L(e.e)} \\cdot ${L(P(e.b, sub(e.e, ONE)))}${chain ? ` \\cdot ${dv}\\left[${L(e.b)}\\right]` : ''}` });
        if (chain) describe(e.b, depth + 1);
      } else if (!has(e.b, v)) {
        steps.push({ text: 'Exponential rule: d/dx a^u = a^u ln(a) u\'', latex: `${dv}\\left[${L(e)}\\right] = ${L(e)} \\ln ${L(e.b)} \\cdot ${dv}\\left[${L(e.e)}\\right]` });
      } else steps.push({ text: 'Logarithmic differentiation: f^g = e^{g ln f}', latex: `${L(e)} = e^{${L(M(e.e, F('log', e.b)))}}` });
    } else if (e.t === 'fn') {
      const u = e.a[0];
      const outer = fnDeriv(e.n, S('u'), F(e.n, S('u')));
      if (outer && !isSym(u, v)) {
        steps.push({ text: `Chain rule with outer function ${e.n}`, latex: `${dv}\\left[${L(e)}\\right] = ${L(subs(outer, { u }))} \\cdot ${dv}\\left[${L(u)}\\right]` });
        describe(u, depth + 1);
      } else if (outer) steps.push({ text: `Standard derivative of ${e.n}`, latex: `${dv}\\left[${L(e)}\\right] = ${L(subs(outer, { u }))}` });
    }
  };
  describe(x, 0);
  return steps;
}

export function nthDiff(x, v, n = 1) { let r = x; for (let i = 0; i < n; i++) r = diff(r, v); return r; }
export const gradient = (f, vars) => vars.map((v) => diff(f, v));
export const jacobian = (fs, vars) => fs.map((f) => vars.map((v) => diff(f, v)));
export const hessian = (f, vars) => vars.map((a) => vars.map((b) => diff(diff(f, a), b)));

/* ============================================================
   NICER FORMS (used for presenting results)
   ============================================================ */

/** Try several rewrites and keep the shortest equivalent form. */
export function niceSimplify(x) {
  const cands = [x];
  try { cands.push(expand(x)); } catch { /* ignore */ }
  const vs = [...freeSyms(x)];
  if (vs.length === 1) {
    try { const c = cancel(x, vs[0]); cands.push(c); } catch { /* ignore */ }
  }
  try { cands.push(trigSimp(x)); } catch { /* ignore */ }
  let best = x, bl = toStr(x).length;
  for (const c of cands) { const l = toStr(c).length; if (l < bl) { best = c; bl = l; } }
  return best;
}
/** sin^2 + cos^2 -> 1 (same argument) */
export function trigSimp(x) {
  if (x.t !== 'add') return x.t === 'num' || x.t === 'sym' ? x : mapKids(x, trigSimp);
  const terms = x.a.map(trigSimp);
  // find c*sin(u)^2 and c*cos(u)^2 pairs
  const info = terms.map((t) => {
    const fs = t.t === 'mul' ? t.a : [t];
    const idx = fs.findIndex((f) => f.t === 'pow' && isNum(f.e) && f.e.v.eq(new Q(2n)) && f.b.t === 'fn' && (f.b.n === 'sin' || f.b.n === 'cos'));
    if (idx < 0) return null;
    const rest = M(fs.filter((_, i) => i !== idx));
    return { fn: fs[idx].b.n, arg: key(fs[idx].b.a[0]), rest: key(rest), restE: rest };
  });
  const used = new Set(); const out = [];
  for (let i = 0; i < terms.length; i++) {
    if (used.has(i)) continue;
    const a = info[i];
    if (a) {
      const j = info.findIndex((b, k) => k !== i && !used.has(k) && b && b.fn !== a.fn && b.arg === a.arg && b.rest === a.rest);
      if (j >= 0) { used.add(i); used.add(j); out.push(a.restE); continue; }
    }
    out.push(terms[i]);
  }
  return A(out);
}
function mapKids(x, f) {
  switch (x.t) {
    case 'mul': return M(x.a.map(f));
    case 'pow': return P(f(x.b), f(x.e));
    case 'fn': return F(x.n, ...x.a.map(f));
    default: return x;
  }
}

/* ============================================================
   NUMERIC QUADRATURE
   ============================================================ */

const XGK = [0.991455371120812639206854697526329, 0.949107912342758524526189684047851, 0.864864423359769072789712788640926,
  0.741531185599394439863864773280788, 0.586087235467691130294144845693013, 0.405845151377397166906606412076961,
  0.207784955007898467600689403773245, 0];
const WGK = [0.022935322010529224963732008058970, 0.063092092629978553290700663189204, 0.104790010322250183839876322541518,
  0.140653259715525918745189590510238, 0.169004726639267902826583426598550, 0.190350578064785409913256402421014,
  0.204432940075298892414161999234649, 0.209482141084727828012999174891714];
const WG = [0.129484966168869693270611432679082, 0.279705391489276667901467771423780, 0.381830050505118944950369775488975,
  0.417959183673469387755102040816327];

function gk15(f, a, b) {
  const c = (a + b) / 2, h = (b - a) / 2;
  const fc = f(c);
  let rk = fc * WGK[7], rg = fc * WG[3];
  for (let j = 0; j < 7; j++) {
    const dx = h * XGK[j];
    const f1 = f(c - dx), f2 = f(c + dx);
    rk += WGK[j] * (f1 + f2);
    if (j % 2 === 1) rg += WG[(j - 1) / 2] * (f1 + f2);
  }
  return [rk * h, Math.abs((rk - rg) * h)];
}

/** adaptive Gauss–Kronrod on finite [a,b] */
export function adaptiveGK(f, a, b, tol = 1e-12, maxIntervals = 4000) {
  let [v, e] = gk15(f, a, b);
  const heap = [{ a, b, v, e }];
  let total = v, err = e, count = 1;
  while (err > Math.max(tol, tol * Math.abs(total)) && count < maxIntervals) {
    // pop worst
    let wi = 0; for (let i = 1; i < heap.length; i++) if (heap[i].e > heap[wi].e) wi = i;
    const w = heap.splice(wi, 1)[0];
    const m = (w.a + w.b) / 2;
    const [v1, e1] = gk15(f, w.a, m), [v2, e2] = gk15(f, m, w.b);
    heap.push({ a: w.a, b: m, v: v1, e: e1 }, { a: m, b: w.b, v: v2, e: e2 });
    total += v1 + v2 - w.v; err += e1 + e2 - w.e; count++;
    if (!Number.isFinite(total)) break;
  }
  return { value: total, error: err, intervals: count };
}

/** tanh-sinh (double exponential) on finite [a,b]; robust for endpoint singularities */
export function tanhSinh(f, a, b, levels = 7) {
  const c = (a + b) / 2, h0 = (b - a) / 2;
  let prev = NaN, sum = 0, h = 1;
  const fm = (t) => {
    const u = Math.PI / 2 * Math.sinh(t);
    const x = Math.tanh(u);
    const w = Math.PI / 2 * Math.cosh(t) / (Math.cosh(u) ** 2);
    const dist = 1 - Math.abs(x);
    if (dist < 1e-300) return 0;
    // evaluate near endpoints using distance to avoid cancellation
    const xx = x > 0 ? b - h0 * dist : a + h0 * dist;
    const y = f(xx);
    return Number.isFinite(y) ? y * w : 0;
  };
  sum = fm(0);
  for (let k = 1; k < 400; k++) { const t = k * h; const s = fm(t) + fm(-t); sum += s; if (Math.abs(s) < 1e-18 && t > 3) break; }
  let est = sum * h * h0;
  for (let lev = 1; lev <= levels; lev++) {
    h /= 2;
    let s2 = 0;
    for (let k = 1; k < 4000; k += 2) { const t = k * h; const s = fm(t) + fm(-t); s2 += s; if (Math.abs(s) < 1e-18 && t > 3) break; }
    sum += s2;
    prev = est;
    est = sum * h * h0;
    if (Math.abs(est - prev) < 1e-14 * Math.max(1, Math.abs(est))) break;
  }
  return { value: est, error: Math.abs(est - prev) };
}

/** numeric definite integral over possibly infinite interval */
export function numIntegrate(f, a, b) {
  if (a === b) return { value: 0, error: 0, method: 'trivial' };
  if (a > b) { const r = numIntegrate(f, b, a); return { ...r, value: -r.value }; }
  let g = f, lo = a, hi = b, note = '';
  if (!Number.isFinite(a) && !Number.isFinite(b)) { g = (t) => { const x = t / (1 - t * t); return f(x) * (1 + t * t) / ((1 - t * t) ** 2); }; lo = -1; hi = 1; note = 'x = t/(1−t²)'; }
  else if (!Number.isFinite(b)) { g = (t) => { const x = a + t / (1 - t); return f(x) / ((1 - t) ** 2); }; lo = 0; hi = 1; note = 'x = a + t/(1−t)'; }
  else if (!Number.isFinite(a)) { g = (t) => { const x = b - (1 - t) / t; return f(x) / (t * t); }; lo = 0; hi = 1; note = 'x = b − (1−t)/t'; }
  const safe = (x) => { const y = g(x); return Number.isFinite(y) ? y : 0; };
  const gk = adaptiveGK(safe, lo, hi);
  const endpointBad = !Number.isFinite(g(lo)) || !Number.isFinite(g(hi));
  if (gk.error < 1e-10 * Math.max(1, Math.abs(gk.value)) && !endpointBad) return { ...gk, method: 'adaptive Gauss–Kronrod (G7/K15)' + (note ? `, ${note}` : '') };
  const ts = tanhSinh(g, lo, hi);
  if (ts.error < gk.error || endpointBad) return { ...ts, method: 'tanh–sinh (double exponential)' + (note ? `, ${note}` : '') };
  return { ...gk, method: 'adaptive Gauss–Kronrod (G7/K15)' + (note ? `, ${note}` : '') };
}

/* ============================================================
   INTEGRATION
   ============================================================ */

function linearIn(u, v) {
  // u = a v + b with a,b free of v -> [a,b] or null
  const m = coeffsIn(u, v);
  if (!m) return null;
  for (const d of m.keys()) if (d > 1) return null;
  if (!m.has(1)) return null;
  return [m.get(1), m.get(0) || ZERO];
}
function quadIn(u, v) {
  const m = coeffsIn(u, v);
  if (!m) return null;
  for (const d of m.keys()) if (d > 2) return null;
  if (!m.has(2)) return null;
  return [m.get(2), m.get(1) || ZERO, m.get(0) || ZERO];
}
function isPosConst(x) { const val = evalReal(x); return Number.isFinite(val) && val > 0; }

class IntCtx {
  constructor(v) { this.v = v; this.steps = []; this.depth = 0; this.budget = 400; }
  step(text, latex) { if (this.steps.length < 40) this.steps.push({ text, latex }); }
}

/** table of standard forms with linear inner argument */
function tableInt(f, ctx) {
  const v = ctx.v, X = S(v);
  // power of v or of linear
  if (f.t === 'sym' && f.n === v) return M(HALF, P(X, TWO));
  if (f.t === 'pow' && !has(f.e, v)) {
    const lin = linearIn(f.b, v);
    if (lin) {
      const [a] = lin;
      if (isNum(f.e) && f.e.v.eq(new Q(-1n))) return div(F('log', F('abs', f.b)), a);
      const n1 = A(f.e, ONE);
      return div(P(f.b, n1), M(a, n1));
    }
    // 1/(a x^2 + b x + c), (1 - x^2)^(-1/2) etc.
    const qd = quadIn(f.b, v);
    if (qd && isNum(f.e)) {
      const [a2, b1, c0] = qd;
      if (f.e.v.eq(new Q(-1n))) {
        // complete the square: a(x + b/2a)^2 + (c - b^2/4a)
        const k = sub(c0, div(P(b1, TWO), M(N(4), a2)));
        const shift = A(X, div(b1, M(TWO, a2)));
        const kv = evalReal(div(k, a2));
        if (Number.isFinite(kv) && kv > 0) {
          const r = sqrtE(div(k, a2));
          ctx.step('Complete the square and use ∫ du/(u²+r²) = (1/r) arctan(u/r)', `${toLatex(f.b)} = ${toLatex(a2)}\\left(${toLatex(shift)}\\right)^2 + ${toLatex(k)}`);
          return div(F('atan', div(shift, r)), M(a2, r));
        }
        if (Number.isFinite(kv) && kv < 0) {
          const r = sqrtE(neg(div(k, a2)));
          return div(F('log', F('abs', div(sub(shift, r), A(shift, r)))), M(TWO, r, a2));
        }
        if (Number.isFinite(kv) && kv === 0) return neg(div(P(shift, MONE), a2));
      }
      if (f.e.v.eq(new Q(-1n, 2n)) && isZero(b1)) {
        const av = evalReal(a2), cv = evalReal(c0);
        if (av < 0 && cv > 0) { const s = sqrtE(neg(a2)); return div(F('asin', div(M(s, X), sqrtE(c0))), s); }
        if (av > 0 && cv > 0) { const s = sqrtE(a2); return div(F('asinh', div(M(s, X), sqrtE(c0))), s); }
        if (av > 0 && cv < 0) { const s = sqrtE(a2); return div(F('log', F('abs', A(M(s, X), sqrtE(f.b)))), s); }
      }
      if (f.e.v.eq(HALF.v) && isZero(b1)) {
        // sqrt(c - a x^2), sqrt(a x^2 + c)
        const av = evalReal(a2), cv = evalReal(c0);
        if (av < 0 && cv > 0) { // sqrt(c - k x^2)
          const kk = neg(a2), s = sqrtE(kk);
          return A(M(HALF, X, f), div(M(c0, F('asin', div(M(s, X), sqrtE(c0)))), M(TWO, s)));
        }
      }
    }
  }
  if (f.t === 'pow' && !has(f.b, v)) {
    // a^(linear)
    const lin = linearIn(f.e, v);
    if (lin) return div(f, M(lin[0], F('log', f.b)));
  }
  if (f.t === 'fn' && f.n === 'exp') {
    const q = quadIn(f.a[0], v);
    if (q && isZero(q[1]) && evalReal(q[0]) < 0) {
      const k = sqrtE(neg(q[0]));
      ctx.step('Gaussian integral: ∫e^{−k²x²}dx = (√π / 2k) erf(kx)', '');
      return M(F('exp', q[2]), sqrtE(PI), P(M(TWO, k), MONE), F('erf', M(k, X)));
    }
  }
  if (f.t === 'fn' && f.a.length === 1) {
    const u = f.a[0];
    const lin = linearIn(u, v);
    if (lin) {
      const a = lin[0];
      const r = (() => {
        switch (f.n) {
          case 'sin': return neg(F('cos', u));
          case 'cos': return F('sin', u);
          case 'tan': return neg(F('log', F('abs', F('cos', u))));
          case 'exp': return F('exp', u);
          case 'sinh': return F('cosh', u);
          case 'cosh': return F('sinh', u);
          case 'tanh': return F('log', F('cosh', u));
          case 'log': return sub(M(u, F('log', u)), u);
          case 'atan': return sub(M(u, F('atan', u)), M(HALF, F('log', A(ONE, P(u, TWO)))));
          case 'asin': return A(M(u, F('asin', u)), sqrtE(sub(ONE, P(u, TWO))));
          case 'acos': return sub(M(u, F('acos', u)), sqrtE(sub(ONE, P(u, TWO))));
          case 'erf': return A(M(u, F('erf', u)), div(F('exp', neg(P(u, TWO))), sqrtE(PI)));
          default: return null;
        }
      })();
      if (r) return div(r, a);
    }
  }
  if (f.t === 'pow' && f.b.t === 'fn' && isNum(f.e) && f.e.v.isInt) {
    const u = f.b.a[0], lin = linearIn(u, v);
    const n = Number(f.e.v.n);
    if (lin) {
      const a = lin[0];
      if (f.b.n === 'cos' && n === -2) return div(F('tan', u), a);
      if (f.b.n === 'sin' && n === -2) return neg(div(div(F('cos', u), F('sin', u)), a));
      if (f.b.n === 'cosh' && n === -2) return div(F('tanh', u), a);
      if (f.b.n === 'cos' && n === -1) return div(F('log', F('abs', div(A(ONE, F('sin', u)), F('cos', u)))), a);
      if (f.b.n === 'sin' && n === -1) return div(F('log', F('abs', div(sub(ONE, F('cos', u)), F('sin', u)))), a);
      if (f.b.n === 'tan' && n === 2) return div(sub(F('tan', u), u), a);
      if ((f.b.n === 'sin' || f.b.n === 'cos') && n >= 2) {
        // reduction formula
        const s = F('sin', u), c = F('cos', u);
        const lower = n - 2 === 0 ? M(u, P(a, MONE)) : integ(P(f.b, N(n - 2)), ctx);
        if (!lower) return null;
        ctx.step(`Reduction formula for ∫${f.b.n}^n`, f.b.n === 'sin'
          ? `\\int \\sin^n u\\,du = -\\frac{\\sin^{n-1}u\\cos u}{n} + \\frac{n-1}{n}\\int \\sin^{n-2}u\\,du`
          : `\\int \\cos^n u\\,du = \\frac{\\cos^{n-1}u\\sin u}{n} + \\frac{n-1}{n}\\int \\cos^{n-2}u\\,du`);
        const first = f.b.n === 'sin' ? neg(M(P(s, N(n - 1)), c)) : M(P(c, N(n - 1)), s);
        return A(div(first, M(N(n), a)), M(N(new Q(BigInt(n - 1), BigInt(n))), lower));
      }
    }
  }
  return null;
}

function splitConst(f, v) {
  if (f.t !== 'mul') return [ONE, f];
  const c = f.a.filter((x) => !has(x, v)), r = f.a.filter((x) => has(x, v));
  return [M(c), M(r)];
}

/** e^(ax) sin(bx) / cos(bx) */
function expTrig(f, v) {
  if (f.t !== 'mul' || f.a.length !== 2) return null;
  const ex = f.a.find((g) => g.t === 'fn' && g.n === 'exp'), tr = f.a.find((g) => g.t === 'fn' && (g.n === 'sin' || g.n === 'cos'));
  if (!ex || !tr) return null;
  const l1 = linearIn(ex.a[0], v), l2 = linearIn(tr.a[0], v);
  if (!l1 || !l2) return null;
  const a = l1[0], b = l2[0];
  const den = A(P(a, TWO), P(b, TWO));
  const s = F('sin', tr.a[0]), c = F('cos', tr.a[0]);
  const inner = tr.n === 'sin' ? sub(M(a, s), M(b, c)) : A(M(a, c), M(b, s));
  return div(M(ex, inner), den);
}

/** rational function integration via partial fractions */
function rationalInt(f, ctx) {
  const v = ctx.v;
  const [n, d] = numden(f);
  const pn = toPoly(n, v), pd = toPoly(d, v);
  if (!pn || !pd || pdeg(pd) < 1) return null;
  let pf;
  try { pf = apart(f, v); } catch { return null; }
  ctx.step('Partial fraction decomposition', `${toLatex(f)} = ${toLatex(pf.expr)}`);
  const parts = [];
  const X = S(v);
  if (pf.poly.length) parts.push(integPoly(pf.poly, v));
  for (const t of pf.terms) {
    const fd = pdeg(t.f);
    if (fd === 1) {
      // num const / (a x + b)^j
      const cst = numQ(t.num[0]);
      const base = fromPoly(t.f, v);
      const a = numQ(t.f[1]);
      if (t.j === 1) parts.push(div(M(cst, F('log', F('abs', base))), a));
      else parts.push(div(M(cst, P(base, N(1 - t.j))), M(a, N(1 - t.j))));
    } else if (fd === 2 && t.j === 1) {
      const [c, b, a] = t.f; // a x^2 + b x + c
      const B = t.num[1] ? numQ(t.num[1]) : ZERO, C = numQ(t.num[0] || Q0);
      // (Bx + C)/(ax^2+bx+c) = (B/2a)(2ax+b)/(q) + (C - Bb/2a)/q
      const q = fromPoly(t.f, v);
      const k1 = div(B, M(TWO, numQ(a)));
      const k2 = sub(C, M(k1, numQ(b)));
      const disc = new Q(4n).mul(a).mul(c).sub(b.mul(b)); // > 0 for irreducible
      const r = sqrtE(numQ(disc));
      parts.push(A(M(k1, F('log', q)), M(k2, TWO, P(r, MONE), F('atan', div(A(M(TWO, numQ(a), X), numQ(b)), r)))));
    } else return null;
  }
  return A(parts);
}
function integPoly(p, v) {
  const out = [];
  for (let i = 0; i < p.length; i++) if (!p[i].isZero) out.push(M(numQ(p[i].div(new Q(BigInt(i + 1)))), P(S(v), N(i + 1))));
  return A(out);
}

/** candidate inner functions for u-substitution */
function subCandidates(f, v, out = new Map()) {
  const add = (u) => { if (has(u, v) && !(u.t === 'sym')) out.set(key(u), u); };
  const walk = (x) => {
    if (x.t === 'fn') { x.a.forEach(add); x.a.forEach(walk); add(x); }
    else if (x.t === 'pow') { add(x.b); if (has(x.e, v)) add(x.e); walk(x.b); walk(x.e); if (!isNum(x.e) || x.e.v.isInt) add(x); }
    else if (x.a) x.a.forEach(walk);
  };
  walk(f);
  return [...out.values()];
}

function uSub(f, ctx) {
  const v = ctx.v, T = S('_u');
  for (const u of subCandidates(f, v)) {
    const du = diff(u, v);
    if (isZero(du)) continue;
    let q;
    try { q = M(f, P(du, MONE)); } catch { continue; }
    let g = replace(q, u, T);
    if (has(g, v)) {
      // try expanded form of the quotient
      try { g = replace(expand(q), u, T); } catch { /* ignore */ }
      // try powers: if u = v^k appear as v^(k m)
      if (has(g, v)) {
        const lin = u.t === 'pow' && isSym(u.b, v) && isNum(u.e) ? u.e : null;
        if (lin) {
          // substitute v = T^(1/k)
          try { g = subs(q, { [v]: P(T, P(lin, MONE)) }); } catch { continue; }
        }
      }
      if (has(g, v)) continue;
    }
    if (equal(g, f)) continue;
    const sub2 = new IntCtx('_u'); sub2.depth = ctx.depth + 1; sub2.budget = ctx.budget;
    const G = integ(g, sub2);
    ctx.budget = sub2.budget;
    if (G) {
      ctx.step('Substitution', `u = ${toLatex(u)},\\; du = ${toLatex(du)}\\,d${v} \\Rightarrow \\int ${toLatex(replace(g, T, S('u')))}\\,du`);
      return subs(G, { _u: u });
    }
  }
  return null;
}

function byParts(f, ctx) {
  const v = ctx.v;
  if (f.t !== 'mul' && !(f.t === 'fn' && ['log', 'atan', 'asin', 'acos'].includes(f.n))) return null;
  const fs = f.t === 'mul' ? f.a : [f, ONE];
  // LIATE priority for u
  const rank = (g) => {
    if (g.t === 'fn' && g.n === 'log') return 0;
    if (g.t === 'pow' && g.b.t === 'fn' && g.b.n === 'log' && isNum(g.e) && g.e.v.isInt && g.e.v.sign > 0) return 0;
    if (g.t === 'fn' && ['atan', 'asin', 'acos'].includes(g.n)) return 1;
    if (isSym(g, v) || (g.t === 'pow' && isSym(g.b, v) && isNum(g.e) && g.e.v.isInt && g.e.v.sign > 0)) return 2;
    if (g.t === 'add' && toPoly(g, v)) return 2;
    return 9;
  };
  let bi = -1, br = 9;
  fs.forEach((g, i) => { const r = rank(g); if (r < br) { br = r; bi = i; } });
  if (bi < 0 || br === 9) return null;
  const u = fs[bi];
  const dv = M(fs.filter((_, i) => i !== bi));
  const c1 = new IntCtx(v); c1.depth = ctx.depth + 1; c1.budget = ctx.budget;
  const Vv = integ(dv, c1);
  ctx.budget = c1.budget;
  if (!Vv) return null;
  const du = diff(u, v);
  const rest = M(Vv, du);
  const c2 = new IntCtx(v); c2.depth = ctx.depth + 1; c2.budget = ctx.budget;
  let R = integ(expand(rest), c2);
  ctx.budget = c2.budget;
  if (!R) return null;
  ctx.step('Integration by parts', `\\int u\\,dv = uv - \\int v\\,du,\\; u = ${toLatex(u)},\\; dv = ${toLatex(dv)}\\,d${v},\\; v = ${toLatex(Vv)}`);
  return sub(M(u, Vv), R);
}

/** sin^m cos^n with an odd power */
function trigProduct(f, ctx) {
  const v = ctx.v;
  if (f.t !== 'mul') return null;
  let sinE = null, cosE = null, arg = null;
  for (const g of f.a) {
    const b = g.t === 'pow' ? g.b : g, e = g.t === 'pow' ? g.e : ONE;
    if (b.t !== 'fn' || !(b.n === 'sin' || b.n === 'cos') || !isNum(e) || !e.v.isInt) return null;
    if (arg && !equal(arg, b.a[0])) return null;
    arg = b.a[0];
    if (b.n === 'sin') sinE = Number(e.v.n); else cosE = Number(e.v.n);
  }
  if (sinE === null || cosE === null) return null;
  const lin = linearIn(arg, v); if (!lin) return null;
  const W = S('_w');
  const a = lin[0];
  let poly, back;
  if (sinE % 2 !== 0 && sinE > 0) {
    // sin^m cos^n dx = -(1-w^2)^((m-1)/2) w^n dw / a with w=cos
    poly = M(MONE, P(sub(ONE, P(W, TWO)), N((sinE - 1) / 2)), P(W, N(cosE)));
    back = F('cos', arg);
  } else if (cosE % 2 !== 0 && cosE > 0) {
    poly = M(P(sub(ONE, P(W, TWO)), N((cosE - 1) / 2)), P(W, N(sinE)));
    back = F('sin', arg);
  } else if (sinE >= 0 && cosE >= 0) {
    // both even: sin^2 = (1-cos2u)/2 ... rewrite and expand
    const u2 = M(TWO, arg);
    const rew = M(P(M(HALF, sub(ONE, F('cos', u2))), N(sinE / 2)), P(M(HALF, A(ONE, F('cos', u2))), N(cosE / 2)));
    const c = new IntCtx(v); c.depth = ctx.depth + 1; c.budget = ctx.budget;
    const r = integ(expand(rew), c);
    ctx.budget = c.budget;
    if (r) ctx.step('Power-reduction identities', `\\sin^2 u = \\tfrac{1 - \\cos 2u}{2},\\; \\cos^2 u = \\tfrac{1+\\cos 2u}{2}`);
    return r;
  } else return null;
  const c = new IntCtx('_w'); c.depth = ctx.depth + 1; c.budget = ctx.budget;
  const G = integ(expand(poly), c);
  ctx.budget = c.budget;
  if (!G) return null;
  ctx.step('Odd trig power: substitute', `w = ${toLatex(back)}`);
  return div(subs(G, { _w: back }), a);
}

export function integ(f, ctx) {
  const v = ctx.v;
  if (--ctx.budget < 0 || ctx.depth > 6) return null;
  if (!has(f, v)) return M(f, S(v));
  if (f.t === 'add') {
    const parts = [];
    for (const t of f.a) { const r = integ(t, ctx); if (!r) { parts.length = 0; break; } parts.push(r); }
    if (parts.length) return A(parts);
    // retry on expanded form below
  }
  const [c, g] = splitConst(f, v);
  if (!isOne(c)) { const r = integ(g, ctx); return r ? M(c, r) : null; }
  let r = tableInt(f, ctx);
  if (r) return r;
  r = expTrig(f, v); if (r) { ctx.step('Standard form ∫e^{ax} sin/cos(bx) dx', ''); return r; }
  // polynomial?
  const pp = toPoly(f, v);
  if (pp) return integPoly(pp, v);
  r = rationalInt(f, ctx); if (r) return r;
  r = trigProduct(f, ctx); if (r) return r;
  r = uSub(f, ctx); if (r) return r;
  r = byParts(f, ctx); if (r) return r;
  try {
    const ex = expand(f);
    if (!equal(ex, f) && ex.t === 'add') {
      const parts = [];
      for (const t of ex.a) { const q = integ(t, ctx); if (!q) return null; parts.push(q); }
      ctx.step('Expand the integrand', `${toLatex(f)} = ${toLatex(ex)}`);
      return A(parts);
    }
  } catch { /* ignore */ }
  // tan^n etc: rewrite tan = sin/cos
  if (key(f).includes('tan(')) {
    const rew = replaceFn(f, 'tan', (u) => div(F('sin', u), F('cos', u)));
    if (!equal(rew, f)) return integ(rew, ctx);
  }
  return null;
}
function replaceFn(x, name, fn) {
  if (x.t === 'fn' && x.n === name) return fn(replaceFn(x.a[0], name, fn));
  if (x.t === 'num' || x.t === 'sym') return x;
  switch (x.t) {
    case 'add': return A(x.a.map((y) => replaceFn(y, name, fn)));
    case 'mul': return M(x.a.map((y) => replaceFn(y, name, fn)));
    case 'pow': return P(replaceFn(x.b, name, fn), replaceFn(x.e, name, fn));
    case 'fn': return F(x.n, ...x.a.map((y) => replaceFn(y, name, fn)));
    default: return x;
  }
}

/** numeric equality check of two expressions in v over sample points */
export function numericallyEqual(a, b, v, pts = [0.3, 0.7, 1.3, 2.1, -0.6, 3.7, -1.9, 0.11]) {
  let checked = 0;
  for (const p of pts) {
    const x = evalReal(a, { [v]: p }), y = evalReal(b, { [v]: p });
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    checked++;
    if (Math.abs(x - y) > 1e-8 * Math.max(1, Math.abs(x), Math.abs(y))) return { ok: false, checked };
  }
  return { ok: checked >= 3, checked };
}

/** Indefinite integral with steps and verification. */
export function integrate(f, v) {
  const ctx = new IntCtx(v);
  let F0 = integ(f, ctx);
  if (!F0) return { ok: false, steps: ctx.steps };
  F0 = niceSimplify(F0);
  const dF = diff(F0, v);
  const d = niceSimplify(sub(dF, f));
  let verified = isZero(d) ? 'symbolic' : null;
  if (!verified) { const ne = numericallyEqual(dF, f, v); if (ne.ok) verified = `numeric (${ne.checked} sample points)`; }
  return { ok: true, result: F0, steps: ctx.steps, verified, derivative: dF };
}

/** Definite integral: exact via antiderivative when safe, always cross-checked numerically. */
export function definiteIntegral(f, v, a, b) {
  const fa = evalReal(a), fb = evalReal(b);
  const fn = (x) => evalReal(f, { [v]: x });
  const num = numIntegrate(fn, fa, fb);
  const out = { numeric: num.value, numericError: num.error, method: num.method, steps: [] };
  const ind = integrate(f, v);
  if (ind.ok) {
    out.antiderivative = ind.result;
    out.steps = ind.steps;
    // check integrand finite on interior samples (no poles crossed)
    let ok = true;
    if (Number.isFinite(fa) && Number.isFinite(fb)) {
      for (let k = 1; k < 200; k++) { const x = fa + (fb - fa) * k / 200; const y = fn(x); if (!Number.isFinite(y) || Math.abs(y) > 1e12) { ok = false; break; } }
    }
    if (ok) {
      try {
        const Fb = limitAt(ind.result, v, b, fb === Infinity ? '-' : fb === -Infinity ? '+' : '-');
        const Fa = limitAt(ind.result, v, a, fa === -Infinity ? '+' : fa === Infinity ? '-' : '+');
        if (Fb && Fa && !isInf(Fb.value) && !isInf(Fa.value)) {
          const exact = niceSimplify(sub(Fb.value, Fa.value));
          const ev = evalReal(exact);
          if (Number.isFinite(ev) && Math.abs(ev - num.value) <= 1e-7 * Math.max(1, Math.abs(ev))) {
            out.exact = exact;
            out.verified = `F(b) − F(a) agrees with ${num.method} to ${fmtNum(Math.abs(ev - num.value), 3)}`;
          }
        }
      } catch { /* ignore */ }
    }
  }
  if (!out.exact) {
    const id = identify(num.value);
    if (id && Math.abs(num.error) < 1e-9) out.identified = id;
  }
  return out;
}

/* ============================================================
   LIMITS
   ============================================================ */

function isFiniteConst(x) {
  if (!x) return false;
  if (has(x, 'nan') || has(x, 'zoo') || has(x, 'oo')) return false;
  return Number.isFinite(evalReal(x));
}

function directSub(f, v, a) {
  try {
    const r = subs(f, { [v]: a });
    if (isFiniteConst(r)) return r;
    if (isSym(r, 'oo') || isInf(r)) return r;
  } catch { /* division by zero etc */ }
  return null;
}

/** symbolic limit, returns {value: expr, method} or null */
export function limitSym(f, v, a, dir = '', depth = 0) {
  if (depth > 8) return null;
  if (!has(f, v)) return { value: f, method: 'constant' };
  const aInf = isSym(a, 'oo') || isInf(a);
  // rational function at infinity: degree rule
  if (aInf) {
    const [n, d] = numden(f);
    const pn = toPoly(n, v), pd = toPoly(d, v);
    if (pn && pd && pd.length) {
      const dn = pdeg(pn), dd = pdeg(pd);
      const sgnA = isSym(a, 'oo') ? 1 : -1;
      if (dn < dd) return { value: ZERO, method: 'degree comparison (deg num < deg den)' };
      if (dn === dd) return { value: numQ(pn[dn].div(pd[dd])), method: 'ratio of leading coefficients' };
      const s = Math.sign(pn[dn].toNumber() / pd[dd].toNumber()) * ((dn - dd) % 2 === 1 ? sgnA : 1);
      return { value: s > 0 ? OO : neg(OO), method: 'degree comparison (deg num > deg den)' };
    }
  }
  if (aInf && depth < 6) {
    const T = S('_t');
    const g = subs(f, { [v]: isSym(a, 'oo') ? P(T, MONE) : neg(P(T, MONE)) });
    const r = limitSym(g, '_t', ZERO, '+', depth + 1);
    if (r) return { value: r.value, method: `substitute ${v} = ${isSym(a, 'oo') ? '' : '−'}1/t, t → 0⁺; ${r.method}` };
  }
  if (!aInf) {
    const r = directSub(f, v, a);
    if (r && !isSym(r, 'oo') && !isInf(r)) return { value: r, method: 'direct substitution' };
  }
  // variable exponent: f = b^e -> exp(lim e ln b)
  if (f.t === 'pow' && has(f.e, v)) {
    const inner = limitSym(M(f.e, F('log', f.b)), v, a, dir, depth + 1);
    if (inner) {
      if (isSym(inner.value, 'oo')) return { value: OO, method: 'exp of limit' };
      if (isInf(inner.value)) return { value: ZERO, method: 'exp of limit' };
      return { value: F('exp', inner.value), method: `write as e^{g ln f}; ${inner.method}` };
    }
  }
  // quotient & L'Hôpital
  const [n, d] = numden(f);
  if (!isOne(d) && has(d, v)) {
    const ln = limitPiece(n, v, a, dir, depth), ld = limitPiece(d, v, a, dir, depth);
    if (ln && ld) {
      const zn = isZero(ln), zd = isZero(ld);
      const inN = isSym(ln, 'oo') || isInf(ln), inD = isSym(ld, 'oo') || isInf(ld);
      if ((zn && zd) || (inN && inD)) {
        const n1 = diff(n, v), d1 = diff(d, v);
        const r = limitSym(niceSimplify(div(n1, d1)), v, a, dir, depth + 1);
        if (r) return { value: r.value, method: `L'Hôpital's rule (${zn ? '0/0' : '∞/∞'})${r.method.startsWith('L') ? ', repeated' : ''}` };
        return null;
      }
      if (!inD && !zd && !inN) return { value: div(ln, ld), method: 'limit of quotient' };
      if (zd && !zn && !inN) {
        // c/0: one-sided sign decides
        const av = evalReal(a);
        const sideSign = (s) => Math.sign(evalReal(f, { [v]: av + s * 1e-7 }));
        const sR = sideSign(1), sL = sideSign(-1);
        const sg = dir === '+' ? sR : dir === '-' ? sL : (sR === sL ? sR : 0);
        if (sg) return { value: sg > 0 ? OO : neg(OO), method: 'nonzero / 0 — sign analysis' };
        return null;
      }
      if (inD && !inN) return { value: ZERO, method: 'bounded / unbounded' };
    }
  }
  // products 0*inf -> quotient
  if (f.t === 'mul') {
    const lims = f.a.map((g) => limitPiece(g, v, a, dir, depth));
    if (lims.every(Boolean)) {
      const zeroI = lims.findIndex(isZero), infI = lims.findIndex((l) => isSym(l, 'oo') || isInf(l));
      if (zeroI >= 0 && infI >= 0) {
        const zeroPart = f.a[zeroI], infPart = M(f.a.filter((_, i) => i !== zeroI));
        const n1 = diff(infPart, v), d1 = diff(P(zeroPart, MONE), v);
        const r = limitSym(niceSimplify(div(n1, d1)), v, a, dir, depth + 1);
        return r ? { value: r.value, method: `rewrite 0·∞ as ∞/∞, L'Hôpital; ${r.method}` } : null;
      }
      if (lims.every(isFiniteConst)) return { value: M(lims), method: 'product of limits' };
    }
  }
  if (f.t === 'add') {
    const lims = f.a.map((g) => limitPiece(g, v, a, dir, depth));
    if (lims.every(Boolean)) {
      const pos = lims.some((l) => isSym(l, 'oo')), negI = lims.some(isInf);
      if (lims.every(isFiniteConst)) return { value: A(lims), method: 'sum of limits' };
      if (pos && !negI) return { value: OO, method: 'sum of limits' };
      if (negI && !pos) return { value: neg(OO), method: 'sum of limits' };
      // ∞ - ∞: combine over common denominator
      const [n2, d2] = numden(f);
      if (!isOne(d2)) return limitSym(div(expand(n2), d2), v, a, dir, depth + 1);
    }
  }
  return null;
}
function limitPiece(g, v, a, dir, depth) {
  if (!has(g, v)) return g;
  const aInf = isSym(a, 'oo') || isInf(a);
  const r = aInf ? null : directSub(g, v, a);
  if (r) return r;
  const n = limitNumeric(g, v, evalReal(a), dir);
  if (n && n.kind === 'inf') return n.sign > 0 ? OO : neg(OO);
  const s = limitSym(g, v, a, dir, depth + 1);
  if (s) return s.value;
  if (n && n.kind === 'finite' && Math.abs(n.value) < 1e-10) return ZERO;
  return null;
}

/** numeric limit with Richardson extrapolation */
export function limitNumeric(f, v, a, dir = '') {
  const g = (x) => evalReal(f, { [v]: x });
  const sides = dir === '+' ? [1] : dir === '-' ? [-1] : [1, -1];
  const results = [];
  for (const s of sides) {
    const vals = [];
    for (let k = 0; k < 14; k++) {
      const h = Math.pow(2, -k) * 0.1;
      const x = Number.isFinite(a) ? a + s * h : (a > 0 ? 1 / (h * h) * 10 : -1 / (h * h) * 10);
      vals.push(g(x));
    }
    if (vals.some((y) => !Number.isFinite(y) && !Number.isNaN(y))) {
      results.push({ kind: 'inf', sign: Math.sign(vals.find((y) => !Number.isFinite(y))) }); continue;
    }
    const finiteVals = vals.filter(Number.isFinite);
    if (finiteVals.length < 6) { results.push(null); continue; }
    const last = finiteVals.slice(-6);
    const growing = last.every((y, i) => i === 0 || (Math.abs(y) > Math.abs(last[i - 1]) * 1.15 && Math.sign(y) === Math.sign(last[0]))) && Math.abs(last[5]) > 1e4;
    if (growing) { results.push({ kind: 'inf', sign: Math.sign(last[5]) }); continue; }
    // Richardson on h -> 0 with ratio 2 (assume error ~ h^p, p=1,2,..)
    const R = [finiteVals.slice(-8)];
    for (let lvl = 1; lvl < 5; lvl++) {
      const prev = R[lvl - 1], cur = [];
      const fac = Math.pow(2, lvl);
      for (let i = 1; i < prev.length; i++) cur.push((fac * prev[i] - prev[i - 1]) / (fac - 1));
      R.push(cur);
    }
    let best = R[0][R[0].length - 1];
    let bestDiff = Math.abs(R[0][R[0].length - 1] - R[0][R[0].length - 2]);
    for (const row of R) if (row.length >= 2) {
      const dlt = Math.abs(row[row.length - 1] - row[row.length - 2]);
      if (dlt < bestDiff) { bestDiff = dlt; best = row[row.length - 1]; }
    }
    results.push({ kind: 'finite', value: best, err: bestDiff });
  }
  if (results.some((r) => !r)) return null;
  if (results.length === 2) {
    const [p, q] = results;
    if (p.kind === 'inf' && q.kind === 'inf') return p.sign === q.sign ? p : { kind: 'dne', left: q, right: p };
    if (p.kind !== q.kind || Math.abs(p.value - q.value) > 1e-5 * Math.max(1, Math.abs(p.value))) return { kind: 'dne', left: q, right: p };
    return { kind: 'finite', value: (p.value + q.value) / 2, err: Math.max(p.err, q.err) };
  }
  return results[0];
}

export function limitAt(f, v, a, dir = '') {
  const s = limitSym(f, v, a, dir);
  if (s) return s;
  const n = limitNumeric(f, v, evalReal(a), dir);
  if (n && n.kind === 'finite') {
    const id = identify(n.value);
    return { value: id || numQ(Q.fromNumber(Number(n.value.toPrecision(12)))), method: 'numeric (Richardson)', numeric: true };
  }
  if (n && n.kind === 'inf') return { value: n.sign > 0 ? OO : neg(OO), method: 'numeric growth', numeric: true };
  return null;
}

/** full limit report */
export function limit(f, v, a, dir = '') {
  const aNum = evalReal(a);
  const num = limitNumeric(f, v, aNum, dir);
  let sym = null;
  try { sym = limitSym(f, v, a, dir); } catch { sym = null; }
  if (sym) {
    sym.value = niceSimplify(sym.value);
    const sv = evalReal(sym.value);
    if (num && num.kind === 'finite' && Number.isFinite(sv) && Math.abs(sv - num.value) > 1e-4 * Math.max(1, Math.abs(sv))) {
      if (!dir && num.kind !== 'dne') sym = null; // disagreement: trust numerics
    }
    if (num && num.kind === 'dne' && !dir) sym = null;
  }
  return { sym, num };
}

/** Try to recognise a float as a closed form */
export function identify(x, tol = 1e-10) {
  if (!Number.isFinite(x)) return null;
  if (Math.abs(x) < 1e-14) return ZERO;
  const r = rationalApprox(x, 2000, tol);
  if (r) return numQ(r);
  const bases = [
    [PI, Math.PI], [P(PI, TWO), Math.PI ** 2], [E, Math.E], [sqrtE(TWO), Math.SQRT2], [sqrtE(N(3)), Math.sqrt(3)], [sqrtE(PI), Math.sqrt(Math.PI)],
    [F('log', TWO), Math.LN2], [F('log', N(3)), Math.log(3)], [P(PI, MONE), 1 / Math.PI], [sqrtE(N(5)), Math.sqrt(5)], [P(PI, N(4)), Math.PI ** 4],
    [F('exp', TWO), Math.E ** 2], [P(E, MONE), 1 / Math.E], [F('zeta', N(3)), zetaFn(3)], [sqrtE(M(TWO, PI)), Math.sqrt(2 * Math.PI)], [M(PI, sqrtE(TWO)), Math.PI * Math.SQRT2], [M(PI, sqrtE(N(3))), Math.PI * Math.sqrt(3)],
  ];
  for (const [e, val] of bases) {
    const q = rationalApprox(x / val, 200, tol);
    if (q) return M(numQ(q), e);
  }
  // a + b*pi etc with small rationals? (keep simple)
  return null;
}

/* ============================================================
   SERIES
   ============================================================ */

// power series over Q: {val: valuation, c: [Q...]} meaning sum c[i] h^(val+i)
const PS = {
  trim(s, n) { return { val: s.val, c: s.c.slice(0, n) }; },
  norm(s) { let k = 0; while (k < s.c.length && s.c[k].isZero) k++; return { val: s.val + k, c: s.c.slice(k) }; },
  const(q, n) { return { val: 0, c: [q, ...new Array(n - 1).fill(Q0)] }; },
  add(a, b, n) {
    const v = Math.min(a.val, b.val); const c = [];
    for (let i = 0; i < n; i++) c.push((a.c[i + v - a.val] || Q0).add(b.c[i + v - b.val] || Q0));
    return PS.norm({ val: v, c });
  },
  mul(a, b, n) {
    const c = new Array(n).fill(Q0);
    for (let i = 0; i < Math.min(n, a.c.length); i++) for (let j = 0; j + i < n && j < b.c.length; j++) c[i + j] = c[i + j].add(a.c[i].mul(b.c[j]));
    return { val: a.val + b.val, c };
  },
  inv(a, n) {
    a = PS.norm(a);
    if (!a.c.length) throw new Error('series division by zero');
    const c = [a.c[0].inv()];
    for (let k = 1; k < n; k++) {
      let s = Q0; for (let j = 1; j <= k; j++) s = s.add((a.c[j] || Q0).mul(c[k - j]));
      c.push(s.neg().div(a.c[0]));
    }
    return { val: -a.val, c };
  },
  compose(coef, u, n) {
    // sum coef[k] u^k, u.val >= 1
    let res = { val: 0, c: new Array(n).fill(Q0) };
    let pw = PS.const(Q1, n);
    for (let k = 0; k < n; k++) {
      if (!coef[k].isZero) res = PS.add(res, { val: pw.val, c: pw.c.map((q) => q.mul(coef[k])) }, n);
      pw = PS.norm(PS.mul(pw, u, n));
      if (pw.val >= n) break;
    }
    return res;
  },
};
function fact(k) { let r = 1n; for (let i = 2n; i <= BigInt(k); i++) r *= i; return r; }
const SERIES_COEF = {
  exp: (k) => new Q(1n, fact(k)),
  sin: (k) => (k % 2 === 0 ? Q0 : new Q((k % 4 === 1 ? 1n : -1n), fact(k))),
  cos: (k) => (k % 2 === 1 ? Q0 : new Q((k % 4 === 0 ? 1n : -1n), fact(k))),
  sinh: (k) => (k % 2 === 0 ? Q0 : new Q(1n, fact(k))),
  cosh: (k) => (k % 2 === 1 ? Q0 : new Q(1n, fact(k))),
  log1p: (k) => (k === 0 ? Q0 : new Q(k % 2 ? 1n : -1n, BigInt(k))),
  atan: (k) => (k % 2 === 0 ? Q0 : new Q(((k - 1) / 2) % 2 ? -1n : 1n, BigInt(k))),
  atanh: (k) => (k % 2 === 0 ? Q0 : new Q(1n, BigInt(k))),
};
function binomSeries(r, k) { // coefficient of u^k in (1+u)^r
  let c = Q1; for (let j = 0; j < k; j++) c = c.mul(r.sub(new Q(BigInt(j)))).div(new Q(BigInt(j + 1)));
  return c;
}
function toPS(x, v, n) {
  if (!has(x, v)) { if (isNum(x)) return PS.const(x.v, n); throw new Error('non-rational constant'); }
  switch (x.t) {
    case 'sym': return { val: 1, c: [Q1, ...new Array(n - 1).fill(Q0)] };
    case 'add': { let s = { val: 0, c: new Array(n).fill(Q0) }; for (const t of x.a) s = PS.add(s, toPS(t, v, n), n); return s; }
    case 'mul': { let s = PS.const(Q1, n); for (const t of x.a) s = PS.mul(s, toPS(t, v, n + 4), n + 4); return PS.trim(PS.norm(s), n); }
    case 'pow': {
      if (has(x.e, v) || !isNum(x.e)) throw new Error('unsupported');
      const b = PS.norm(toPS(x.b, v, n + 4));
      const e = x.e.v;
      if (e.isInt) {
        if (e.sign >= 0) { let r = PS.const(Q1, n + 4); for (let i = 0n; i < e.n; i++) r = PS.mul(r, b, n + 4); return PS.trim(r, n); }
        let r = PS.const(Q1, n + 4); const ib = PS.inv(b, n + 4); for (let i = 0n; i < -e.n; i++) r = PS.mul(r, ib, n + 4); return PS.trim(r, n);
      }
      // (c0 h^val (1 + u))^e requires val*e integer and c0^e rational
      if (!b.c.length) throw new Error('0^r');
      const c0 = b.c[0];
      const ve = new Q(BigInt(b.val)).mul(e);
      if (!ve.isInt) throw new Error('fractional valuation');
      const c0e = (() => { const r = P(numQ(c0), numQ(e)); if (!isNum(r)) throw new Error('irrational'); return r.v; })();
      const u = PS.norm({ val: 1, c: b.c.slice(1).map((q) => q.div(c0)) });
      const s = PS.compose(Array.from({ length: n + 2 }, (_, k) => binomSeries(e, k)), u, n + 2);
      return PS.trim({ val: Number(ve.n) + s.val, c: s.c.map((q) => q.mul(c0e)) }, n);
    }
    case 'fn': {
      const u = PS.norm(toPS(x.a[0], v, n + 2));
      const c0 = u.val > 0 || !u.c.length ? Q0 : u.c[0];
      const rest = u.val > 0 ? u : PS.norm({ val: 0, c: [Q0, ...u.c.slice(1)] });
      if (rest.c.length && rest.val < 1) throw new Error('negative valuation');
      const coef = (fn) => Array.from({ length: n + 2 }, (_, k) => SERIES_COEF[fn](k));
      if (x.n === 'log') {
        if (c0.isZero || c0.sign < 0) throw new Error('log at 0');
        const w = { val: rest.val, c: rest.c.map((q) => q.div(c0)) };
        const s = PS.compose(coef('log1p'), w, n);
        if (!c0.isOne) throw new Error('log constant');
        return s;
      }
      if (!c0.isZero) throw new Error('shifted argument');
      if (SERIES_COEF[x.n]) return PS.compose(coef(x.n), rest, n);
      if (x.n === 'tan') { const s = PS.compose(coef('sin'), rest, n + 2), c = PS.compose(coef('cos'), rest, n + 2); return PS.trim(PS.mul(s, PS.inv(c, n + 2), n + 2), n); }
      if (x.n === 'tanh') { const s = PS.compose(coef('sinh'), rest, n + 2), c = PS.compose(coef('cosh'), rest, n + 2); return PS.trim(PS.mul(s, PS.inv(c, n + 2), n + 2), n); }
      if (x.n === 'asin') { // integrate (1-u^2)^(-1/2)
        const cs = Array.from({ length: n + 2 }, (_, k) => (k % 2 === 0 ? Q0 : binomSeries(new Q(-1n, 2n), (k - 1) / 2).mul(new Q(((k - 1) / 2) % 2 ? -1n : 1n)).div(new Q(BigInt(k)))));
        return PS.compose(cs, rest, n);
      }
      throw new Error('unsupported function');
    }
    default: throw new Error('unsupported');
  }
}

/** Taylor/Laurent series of f about v = a, up to (but excluding) order n. */
export function series(f, v, a = ZERO, n = 6) {
  const H = S('_h');
  let g = isZero(a) ? f : subs(f, { [v]: A(a, H) });
  if (!isZero(a)) g = simplifyTree(g);
  else g = replace(g, S(v), H);
  const shift = isZero(a) ? S(v) : sub(S(v), a);
  let terms = [];
  let method = '';
  try {
    const s = PS.norm(toPS(g, '_h', n + 2));
    for (let i = 0; i < s.c.length; i++) {
      const k = s.val + i;
      if (k >= n) break;
      if (!s.c[i].isZero) terms.push(M(numQ(s.c[i]), P(shift, N(k))));
    }
    method = 'exact power-series arithmetic';
  } catch {
    // derivative fallback
    terms = [];
    let d = f;
    for (let k = 0; k < n; k++) {
      const lim = limitAt(d, v, a, '');
      if (!lim || lim.numeric && !isFiniteConst(lim.value)) throw new Error('Could not compute Taylor coefficients (singular point?)');
      const c = niceSimplify(div(lim.value, numQ(new Q(fact(k)))));
      if (!isZero(c)) terms.push(M(c, P(shift, N(k))));
      d = niceSimplify(diff(d, v));
    }
    method = 'repeated differentiation: c_k = f^{(k)}(a)/k!';
  }
  const expr = terms.length ? (terms.length === 1 ? terms[0] : { t: 'add', a: terms, ord: true }) : ZERO;
  return { terms, expr, method, order: n };
}

/* ============================================================
   SUMS & PRODUCTS
   ============================================================ */

function harmonic(m, p = 1) { // exact H_m^{(p)}
  let s = Q0; for (let k = 1n; k <= BigInt(m); k++) s = s.add(new Q(1n, k ** BigInt(p))); return s;
}

export function sum(f, k, lo, hi) {
  const steps = [];
  const loV = evalReal(lo), hiV = evalReal(hi);
  const infinite = isSym(hi, 'oo');
  // finite numeric range: exact direct sum
  if (!infinite && Number.isFinite(loV) && Number.isFinite(hiV) && isNum(lo) && isNum(hi) && hiV - loV <= 5000) {
    let acc = ZERO;
    for (let j = loV; j <= hiV; j++) acc = A(acc, subs(f, { [k]: N(j) }));
    return { exact: niceSimplify(acc), method: `direct summation of ${hiV - loV + 1} terms`, steps };
  }
  // polynomial in k with symbolic upper limit: interpolate closed form
  const pk = toPoly(f, k);
  if (pk && !infinite) {
    const d = Math.max(0, pdeg(pk)) + 1;
    const nSym = hi;
    const loQ = isNum(lo) ? lo.v : Q0;
    // S(m) for m = lo .. lo + d
    const xs = [], ys = [];
    let acc = Q0;
    for (let j = 0; j <= d; j++) {
      const m = loQ.add(new Q(BigInt(j)));
      acc = acc.add(pkEval(pk, m));
      xs.push(m); ys.push(acc);
    }
    // Lagrange interpolation in symbol n
    const Nn = nSym;
    let poly = ZERO;
    for (let i = 0; i <= d; i++) {
      let term = numQ(ys[i]);
      for (let j = 0; j <= d; j++) if (j !== i) term = M(term, div(sub(Nn, numQ(xs[j])), numQ(xs[i].sub(xs[j]))));
      poly = A(poly, expand(term));
    }
    steps.push({ text: `Sum of a degree-${d - 1} polynomial is a degree-${d} polynomial in the upper limit (Faulhaber); fitted exactly from ${d + 1} partial sums`, latex: '' });
    const factored = (() => { try { const pp = toPoly(poly, freeSyms(Nn).values().next().value); return pp ? factorPolyExpr2(pp, [...freeSyms(Nn)][0]) : poly; } catch { return poly; } })();
    return { exact: factored, method: 'Faulhaber / exact interpolation', steps };
  }
  // geometric c * r^k
  const geo = geometricParts(f, k);
  if (geo) {
    const { c, r } = geo;
    const rv = evalReal(r);
    if (infinite) {
      if (Math.abs(rv) < 1) return { exact: niceSimplify(div(M(c, P(r, lo)), sub(ONE, r))), method: `geometric series, |r| = ${fmtNum(Math.abs(rv))} < 1`, steps };
      return { diverges: true, method: `geometric series with |r| ≥ 1 diverges`, steps };
    }
    return { exact: niceSimplify(div(M(c, sub(P(r, A(hi, ONE)), P(r, lo))), sub(r, ONE))), method: 'geometric series', steps };
  }
  if (infinite) {
    // rational function via partial fractions with integer shifts -> exact
    try {
      const [n0, d0] = numden(f);
      const pn = toPoly(n0, k), pd = toPoly(d0, k);
      if (pn && pd && pdeg(pd) >= pdeg(pn) + 2 && isNum(lo)) {
        const pf = apart(f, k);
        if (!pf.poly.length && pf.terms.every((t) => pdeg(t.f) === 1 && t.f[1].isOne && t.f[0].isInt)) {
          let total = ZERO; let sumA1 = Q0;
          const L = lo.v.n;
          for (const t of pf.terms) {
            const Acoef = t.num[0];
            const cshift = t.f[0].n; // term A/(k + c)^j
            const start = L + cshift; // sum_{m=start}^{∞} 1/m^j
            if (start <= 0n) throw new Error('pole in range');
            if (t.j === 1) { sumA1 = sumA1.add(Acoef); total = A(total, M(numQ(Acoef.neg()), numQ(harmonic(Number(start) - 1)))); }
            else total = A(total, M(numQ(Acoef), sub(F('zeta', N(t.j)), numQ(harmonic(Number(start) - 1, t.j)))));
          }
          if (sumA1.isZero) {
            steps.push({ text: 'Partial fractions, then telescoping / ζ-values', latex: `${toLatex(f)} = ${toLatex(pf.expr)}` });
            return { exact: niceSimplify(total), method: 'partial fractions + telescoping', steps };
          }
          return { diverges: true, method: 'harmonic-type tail (terms ~ 1/k) diverges', steps };
        }
      }
    } catch { /* fall through */ }
    // p-series
    if (f.t === 'pow' && isSym(f.b, k) && isNum(f.e) && f.e.v.sign < 0 && isNum(lo) && lo.v.isOne) {
      const p = f.e.v.neg();
      if (p.cmp(Q1) <= 0) return { diverges: true, method: 'p-series with p ≤ 1 diverges', steps };
      return { exact: F('zeta', numQ(p)), method: 'p-series = ζ(p)', steps };
    }
    // numeric
    const numv = numericSum(f, k, loV);
    if (numv.diverges) return { diverges: true, method: numv.method, steps };
    const id = identify(numv.value, 1e-9);
    return { numeric: numv.value, identified: id, method: numv.method, steps };
  }
  return { numeric: null, method: 'no closed form found', steps };
}
function factorPolyExpr2(pp, v) { return factorPolyExpr(pp, v).expr; }

function pkEval(p, m) { let r = Q0; for (let i = p.length - 1; i >= 0; i--) r = r.mul(m).add(p[i]); return r; }

function geometricParts(f, k) {
  // f = c * r^k (r, c free of k), allowing r^(a k + b)
  const fs = f.t === 'mul' ? f.a : [f];
  let c = [], r = null;
  for (const g of fs) {
    if (!has(g, k)) { c.push(g); continue; }
    if (g.t === 'pow' && !has(g.b, k)) {
      const lin = linearIn(g.e, k);
      if (!lin || r) return null;
      r = P(g.b, lin[0]); c.push(P(g.b, lin[1]));
      continue;
    }
    if (g.t === 'fn' && g.n === 'exp') {
      const lin = linearIn(g.a[0], k);
      if (!lin || r) return null;
      r = F('exp', lin[0]); c.push(F('exp', lin[1]));
      continue;
    }
    return null;
  }
  if (!r) return null;
  return { c: M(c), r };
}

export function numericSum(f, k, lo) {
  const g = (j) => evalReal(f, { [k]: j });
  const t0 = g(lo), t1 = g(lo + 1), t2 = g(lo + 2), t3 = g(lo + 3);
  const alternating = Math.sign(t0) !== Math.sign(t1) && Math.sign(t1) !== Math.sign(t2) && Math.sign(t2) !== Math.sign(t3);
  if (alternating) {
    // Cohen–Rodriguez Villegas–Zagier acceleration
    const n = 60;
    let d = Math.pow(3 + Math.sqrt(8), n); d = (d + 1 / d) / 2;
    let b = -1, c = -d, s = 0;
    for (let j = 0; j < n; j++) {
      c = b - c;
      s += c * Math.abs(g(lo + j));
      b = (j + n) * (j - n) * b / ((j + 0.5) * (j + 1));
    }
    return { value: Math.sign(t0) * s / d, method: 'alternating series, CVZ acceleration' };
  }
  // direct + Euler–Maclaurin tail
  const N0 = 2000;
  let s = 0;
  for (let j = lo; j < lo + N0; j++) s += g(j);
  const fN = g(lo + N0);
  const tailInt = numIntegrate(g, lo + N0, Infinity).value;
  const h = 1e-3;
  const dfN = (g(lo + N0 + h) - g(lo + N0 - h)) / (2 * h);
  const tail = tailInt + fN / 2 - dfN / 12;
  if (!Number.isFinite(tail) || Math.abs(fN) * N0 > 1e-1 * Math.max(1, Math.abs(s)) && Math.abs(tailInt) > 1e6) return { diverges: true, method: 'terms decay too slowly (integral test tail diverges)' };
  const val = s + tail;
  if (!Number.isFinite(val)) return { diverges: true, method: 'partial sums unbounded' };
  // divergence check: ratio of tail integral from N0 vs 2N0
  const tail2 = numIntegrate(g, lo + 2 * N0, Infinity).value;
  if (Math.abs(tailInt) > 1e8 || (Math.abs(tailInt) > 1e-3 && Math.abs(tail2) > 0.9 * Math.abs(tailInt) && Math.abs(tailInt) > 5)) return { diverges: true, method: 'integral test: tail does not shrink' };
  return { value: val, method: `direct sum of ${N0} terms + Euler–Maclaurin tail` };
}

export function product(f, k, lo, hi) {
  const loV = evalReal(lo), hiV = evalReal(hi);
  if (isNum(lo) && isNum(hi) && hiV - loV <= 3000) {
    let acc = ONE;
    for (let j = loV; j <= hiV; j++) acc = M(acc, subs(f, { [k]: N(j) }));
    return { exact: niceSimplify(acc), method: `direct product of ${hiV - loV + 1} factors` };
  }
  if (isSym(hi, 'oo')) {
    // log-sum numerically
    let s = 0, j = loV;
    for (; j < loV + 200000; j++) { const t = evalReal(f, { [k]: j }); if (!(t > 0)) return { numeric: null, method: 'non-positive factor' }; s += Math.log(t); }
    const val = Math.exp(s);
    return { numeric: val, identified: identify(val, 1e-5), method: 'partial product of 200000 factors (log-sum); accuracy ~1e-5' };
  }
  return { numeric: null, method: 'no closed form found' };
}
