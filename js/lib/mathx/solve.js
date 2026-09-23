/* ============================================================
   mathx / solve — equations (exact polynomial roots incl. surds,
   isolation through invertible functions with general trig
   solutions, substitution to polynomial, numeric bracketing),
   systems (exact rational Gaussian elimination, substitution,
   Newton with symbolic Jacobian), inequalities (sign charts),
   ODEs (first-order linear, separable, constant-coefficient linear
   n-th order with undetermined coefficients, initial conditions),
   adaptive Dormand–Prince RK45 for systems. Pure (no DOM).
   ============================================================ */

import { Q, Q0, Q1, rationalApprox } from './rational.js';
import {
  A, M, P, F, N, S, ONE, ZERO, MONE, TWO, HALF, PI, OO, numQ, isNum, isSym, isZero, isOne, key, equal, has,
  neg, sub, div, sqrtE, subs, replace, freeSyms, toLatex, toStr, evalReal, evalComplex, fmtNum, fmtComplex, simplifyTree, mainVar
} from './expr.js';
import { expand, toPoly, fromPoly, numden, polyRoots, polyRootsNumeric, factorPolyExpr, coeffsIn, pdeg, ptrim } from './poly.js';
import { solveSystemQ } from './linalg-exact.js';
import { diff, integ, integrate, niceSimplify, jacobian, numericallyEqual } from './calculus.js';

/* ============================================================
   SINGLE EQUATION
   ============================================================ */

function asZeroForm(eq) {
  if (eq.t === 'rel') return sub(eq.l, eq.r);
  return eq;
}

function brent(f, a, b, tol = 1e-15) {
  let fa = f(a), fb = f(b);
  if (fa * fb > 0) return null;
  let c = a, fc = fa, d = b - a, e = d;
  for (let it = 0; it < 200; it++) {
    if (fb * fc > 0) { c = a; fc = fa; d = b - a; e = d; }
    if (Math.abs(fc) < Math.abs(fb)) { a = b; b = c; c = a; fa = fb; fb = fc; fc = fa; }
    const tol1 = 2 * Number.EPSILON * Math.abs(b) + tol / 2, xm = (c - b) / 2;
    if (Math.abs(xm) <= tol1 || fb === 0) return b;
    if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
      const s = fb / fa; let p, q;
      if (a === c) { p = 2 * xm * s; q = 1 - s; }
      else { const qq = fa / fc, r = fb / fc; p = s * (2 * xm * qq * (qq - r) - (b - a) * (r - 1)); q = (qq - 1) * (r - 1) * (s - 1); }
      if (p > 0) q = -q; p = Math.abs(p);
      if (2 * p < Math.min(3 * xm * q - Math.abs(tol1 * q), Math.abs(e * q))) { e = d; d = p / q; } else { d = xm; e = d; }
    } else { d = xm; e = d; }
    a = b; fa = fb;
    b += Math.abs(d) > tol1 ? d : (xm > 0 ? tol1 : -tol1);
    fb = f(b);
  }
  return b;
}
export { brent };

/** all real roots of a real function in [lo,hi] by scanning + Brent + minima refinement */
export function numericRealRoots(f, lo = -50, hi = 50, n = 4000) {
  const roots = [];
  const push = (r) => { if (r !== null && Number.isFinite(r) && !roots.some((q) => Math.abs(q - r) < 1e-9 * Math.max(1, Math.abs(r)))) roots.push(r); };
  let px = lo, pf = f(lo);
  const h = (hi - lo) / n;
  let ppf = NaN;
  for (let i = 1; i <= n; i++) {
    const x = lo + i * h, fx = f(x);
    if (Number.isFinite(pf) && Number.isFinite(fx)) {
      if (pf === 0) push(px);
      else if (pf * fx < 0) {
        // avoid poles: check magnitude near crossing
        const r = brent(f, px, x);
        if (r !== null && Math.abs(f(r)) < 1e-6 * (1 + Math.abs(pf) + Math.abs(fx))) push(r);
      } else if (Number.isFinite(ppf) && Math.abs(pf) < Math.abs(ppf) && Math.abs(pf) < Math.abs(fx) && Math.abs(pf) < 1e-3) {
        // touching root (even multiplicity): minimise |f|
        let a = px - h, b = x;
        for (let k = 0; k < 100; k++) { const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3; if (Math.abs(f(m1)) < Math.abs(f(m2))) b = m2; else a = m1; }
        const r = (a + b) / 2; if (Math.abs(f(r)) < 1e-10) push(r);
      }
    }
    ppf = pf; px = x; pf = fx;
  }
  return roots.sort((a, b) => a - b);
}

const INT_K = (v) => S(v === 'k' ? 'm' : 'k');

/** isolate v in L = R, returning list of solution expressions (may contain integer parameter k) */
function isolate(L, R, v, steps, depth = 0) {
  if (depth > 12) return null;
  if (isSym(L, v)) return [R];
  if (!has(L, v)) return null;
  const kk = INT_K(v);
  if (L.t === 'add') {
    const withV = L.a.filter((t) => has(t, v)), without = L.a.filter((t) => !has(t, v));
    if (withV.length !== 1) return null;
    return isolate(withV[0], sub(R, A(without)), v, steps, depth + 1);
  }
  if (L.t === 'mul') {
    const withV = L.a.filter((t) => has(t, v)), without = L.a.filter((t) => !has(t, v));
    if (withV.length !== 1) return null;
    return isolate(withV[0], div(R, M(without)), v, steps, depth + 1);
  }
  if (L.t === 'pow') {
    if (!has(L.e, v)) {
      const inv = P(R, P(L.e, MONE));
      if (isNum(L.e) && L.e.v.isInt && L.e.v.n % 2n === 0n) {
        const a = isolate(L.b, inv, v, steps, depth + 1), b = isolate(L.b, neg(inv), v, steps, depth + 1);
        return a && b ? [...a, ...b] : a || b;
      }
      return isolate(L.b, inv, v, steps, depth + 1);
    }
    if (!has(L.b, v)) return isolate(L.e, div(F('log', R), F('log', L.b)), v, steps, depth + 1);
    return null;
  }
  if (L.t === 'fn' && L.a.length === 1) {
    const u = L.a[0];
    switch (L.n) {
      case 'exp': return isolate(u, F('log', R), v, steps, depth + 1);
      case 'log': return isolate(u, F('exp', R), v, steps, depth + 1);
      case 'sqrt': return isolate(u, P(R, TWO), v, steps, depth + 1);
      case 'sin': {
        const a = isolate(u, A(F('asin', R), M(TWO, PI, kk)), v, steps, depth + 1);
        const b = isolate(u, A(sub(PI, F('asin', R)), M(TWO, PI, kk)), v, steps, depth + 1);
        return a && b ? dedupe([...a, ...b]) : null;
      }
      case 'cos': {
        const a = isolate(u, A(F('acos', R), M(TWO, PI, kk)), v, steps, depth + 1);
        const b = isolate(u, A(neg(F('acos', R)), M(TWO, PI, kk)), v, steps, depth + 1);
        return a && b ? dedupe([...a, ...b]) : null;
      }
      case 'tan': return isolate(u, A(F('atan', R), M(PI, kk)), v, steps, depth + 1);
      case 'atan': return isolate(u, F('tan', R), v, steps, depth + 1);
      case 'asin': return isolate(u, F('sin', R), v, steps, depth + 1);
      case 'acos': return isolate(u, F('cos', R), v, steps, depth + 1);
      case 'sinh': return isolate(u, F('asinh', R), v, steps, depth + 1);
      case 'tanh': return isolate(u, F('atanh', R), v, steps, depth + 1);
      case 'abs': {
        const a = isolate(u, R, v, steps, depth + 1), b = isolate(u, neg(R), v, steps, depth + 1);
        return a && b ? dedupe([...a, ...b]) : a || b;
      }
      default: return null;
    }
  }
  return null;
}
function dedupe(list) { const seen = new Set(); return list.filter((e) => { const k = key(e); if (seen.has(k)) return false; seen.add(k); return true; }); }

function candidatesU(f, v) {
  const out = new Map();
  const walk = (x) => {
    if (x.t === 'fn' && has(x, v)) out.set(key(x), x);
    if (x.t === 'pow' && has(x, v) && !isSym(x.b, v)) out.set(key(x), x);
    if (x.t === 'pow' && has(x.e, v)) { out.set(key(x), x); }
    if (x.a) x.a.forEach(walk);
    if (x.t === 'pow') { walk(x.b); walk(x.e); }
  };
  walk(f);
  // e^(2x) = (e^x)^2: add base exponentials with the gcd exponent
  const exps = [...out.values()].filter((e) => e.t === 'fn' && e.n === 'exp');
  for (const e of exps) {
    const m = coeffsIn(e.a[0], v);
    if (m && m.size === 1 && m.has(1) && isNum(m.get(1))) out.set('exp1' + key(m.get(1)), F('exp', S(v)));
  }
  return [...out.values()];
}

/**
 * Solve one equation for v. Returns {exact:[{expr, value}], numeric:[number|complex], general, steps, verified, factored}
 */
export function solveEquation(eq, v, { range = [-50, 50] } = {}) {
  const steps = [];
  const g0 = asZeroForm(eq);
  if (eq.t === 'rel') steps.push({ text: 'Move everything to one side', latex: `${toLatex(g0)} = 0` });
  const [n, d] = numden(g0);
  const nE = expand(n);
  const res = { exact: [], numeric: [], complex: [], steps, general: false };
  const denOK = (val) => { const dv = typeof val === 'number' ? evalReal(d, { [v]: val }) : evalComplex(d, { [v]: val }); return typeof dv === 'number' ? Math.abs(dv) > 1e-12 : Math.hypot(dv.re, dv.im) > 1e-12; };
  if (!isOne(d) && has(d, v)) steps.push({ text: 'Multiply through by the denominator (excluding its zeros)', latex: `${toLatex(nE)} = 0,\\quad ${toLatex(d)} \\ne 0` });
  const p = toPoly(nE, v);
  if (p) {
    if (!p.length) { res.identity = true; steps.push({ text: 'The equation reduces to 0 = 0: true for every value (identity)', latex: '0 = 0' }); return res; }
    if (pdeg(p) < 1) { res.none = true; steps.push({ text: 'The equation reduces to a false statement: no solution', latex: `${toLatex(fromPoly(p, v))} = 0` }); return res; }
    const fac = factorPolyExpr(p, v);
    res.factored = fac.expr;
    if (fac.factors.length > 1 || fac.factors.some(([, m]) => m > 1)) steps.push({ text: 'Factor over the rationals', latex: `${toLatex(fac.expr)} = 0` });
    if (pdeg(p) === 2 && fac.factors.length === 1) {
      const [c, b, a] = p;
      const D = b.mul(b).sub(a.mul(c).mul(new Q(4n)));
      steps.push({ text: 'Quadratic formula', latex: `${v} = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a},\\quad \\Delta = ${D.toLatex()}` });
    }
    const pr = polyRoots(p, v);
    for (const { expr, mult } of pr.exact) {
      const val = evalComplex(expr);
      if (!denOK(Math.abs(val.im) < 1e-14 ? val.re : val)) { steps.push({ text: `Reject ${toStr(expr)} (makes the denominator zero)`, latex: '' }); continue; }
      res.exact.push({ expr: niceSimplify(expr), value: val, mult });
    }
    for (const z of pr.numeric) {
      if (!denOK(z.im === 0 ? z.re : z)) continue;
      res.numeric.push({ ...z });
    }
    if (pr.numeric.length) steps.push({ text: `Irreducible factor of degree ≥ 3 with no simple radical form here: roots by Aberth–Ehrlich iteration (all complex roots)`, latex: '' });
    // verification
    let maxRes = 0;
    for (const r of [...res.exact.map((e) => e.value), ...res.numeric]) {
      const val = evalComplex(g0, { [v]: r });
      maxRes = Math.max(maxRes, Math.hypot(val.re, val.im) / (1 + Math.hypot(r.re, r.im)));
    }
    res.verified = maxRes < 1e-8;
    res.residual = maxRes;
    return res;
  }
  // isolation
  const iso = isolate(nE, ZERO, v, steps) || isolate(g0.t === 'add' ? g0 : n, ZERO, v, steps);
  if (iso && iso.length) {
    const sols = iso.map((e) => niceSimplify(e));
    const general = sols.some((e) => has(e, INT_K(v).n));
    steps.push({ text: 'Isolate the variable by applying inverse functions', latex: sols.map((e) => `${v} = ${toLatex(e)}`).join(',\\; ') });
    let ok = true, maxRes = 0;
    const others = {}; [...freeSyms(g0)].filter((w) => w !== v).forEach((w, i) => { others[w] = 0.37 + 0.21 * i; });
    for (const e of sols) {
      for (const kv of [0, 1, -1]) {
        const val = evalComplex(e, { ...others, [INT_K(v).n]: kv });
        if (!Number.isFinite(val.re)) continue;
        const r = evalComplex(g0, { ...others, [v]: val });
        const rr = Math.hypot(r.re, r.im);
        if (Number.isFinite(rr)) maxRes = Math.max(maxRes, rr);
      }
    }
    ok = maxRes < 1e-8;
    const valid = sols.filter((e) => { const val = evalComplex(e, { ...others, [INT_K(v).n]: 0 }); return Number.isFinite(val.re); });
    res.exact = valid.map((e) => ({ expr: e, value: evalComplex(e, { ...others, [INT_K(v).n]: 0 }) }));
    res.general = general;
    res.param = general ? INT_K(v).n : null;
    res.verified = ok; res.residual = maxRes;
    if (res.exact.length && ok) return res;
    res.exact = [];
  }
  // substitution u = f(x) making a polynomial
  for (const u of candidatesU(nE, v)) {
    const T = S('_u');
    let gT;
    try { gT = replace(nE, u, T); } catch { continue; }
    if (u.t === 'fn' && u.n === 'exp' && has(gT, v)) {
      // rewrite exp(c x) as T^c
      const c1 = coeffsIn(u.a[0], v);
      if (c1 && c1.size === 1 && c1.has(1)) {
        const unit = c1.get(1);
        const rew = (x) => {
          if (x.t === 'fn' && x.n === 'exp') { const m = coeffsIn(x.a[0], v); if (m && [...m.keys()].every((k) => k <= 1) && m.has(1)) return M(P(T, div(m.get(1), unit)), F('exp', m.get(0) || ZERO)); }
          if (x.t === 'num' || x.t === 'sym') return x;
          switch (x.t) { case 'add': return A(x.a.map(rew)); case 'mul': return M(x.a.map(rew)); case 'pow': return P(rew(x.b), rew(x.e)); default: return x; }
        };
        gT = rew(nE);
      }
    }
    if (has(gT, v)) continue;
    const pT = toPoly(gT, '_u');
    if (!pT || pdeg(pT) < 1) continue;
    const inner = solveEquation(gT, '_u');
    const out = [];
    steps.push({ text: `Substitute u = ${toStr(u)} to get a polynomial`, latex: `${toLatex(replace(gT, T, S('u')))} = 0` });
    for (const r of inner.exact) {
      const sub1 = solveEquation({ t: 'rel', op: '=', l: u, r: r.expr }, v);
      out.push(...sub1.exact);
      if (sub1.general) { res.general = true; res.param = sub1.param; }
    }
    if (out.length) {
      res.exact = out.filter((e) => Math.abs(e.value.im) < 1e-12);
      res.verified = true;
      return res;
    }
  }
  // numeric fallback
  const fx = (x) => evalReal(g0, { [v]: x });
  const roots = numericRealRoots(fx, range[0], range[1]);
  for (const r of roots) {
    const q = rationalApprox(r, 1000, 1e-9);
    let exactHit = false;
    if (q) { try { const val = niceSimplify(subs(g0, { [v]: numQ(q) })); if (isZero(val)) { res.exact.push({ expr: numQ(q), value: { re: q.toNumber(), im: 0 } }); exactHit = true; } } catch { /* pole */ } }
    if (!exactHit) res.numeric.push({ re: r, im: 0 });
  }
  res.numericOnly = res.exact.length === 0;
  steps.push({ text: `No closed form found: real roots located numerically in [${range[0]}, ${range[1]}] by sign-change scan + Brent's method`, latex: '' });
  const maxRes = roots.reduce((m, r) => Math.max(m, Math.abs(fx(r))), 0);
  res.verified = roots.length > 0 && maxRes < 1e-8;
  res.residual = maxRes;
  return res;
}

/* ============================================================
   SYSTEMS
   ============================================================ */

function linearCoeffs(eq, vars) {
  // returns [row(Q[]), rhs Q] or null
  const g = expand(asZeroForm(eq));
  const ts = g.t === 'add' ? g.a : [g];
  const row = vars.map(() => Q0); let c = Q0;
  for (const t of ts) {
    const inV = vars.filter((v) => has(t, v));
    if (!inV.length) { if (!isNum(t)) return null; c = c.add(t.v); continue; }
    if (inV.length > 1) return null;
    const v = inV[0];
    const m = coeffsIn(t, v);
    if (!m || m.size !== 1 || !m.has(1)) return null;
    const co = m.get(1);
    if (!isNum(co)) return null;
    row[vars.indexOf(v)] = row[vars.indexOf(v)].add(co.v);
  }
  return [row, c.neg()];
}

export function newtonSystem(fs, vars, x0, maxIt = 60) {
  const J = jacobian(fs, vars);
  let x = x0.slice();
  const envOf = (xx) => Object.fromEntries(vars.map((v, i) => [v, xx[i]]));
  for (let it = 0; it < maxIt; it++) {
    const env = envOf(x);
    const Fv = fs.map((f) => evalReal(f, env));
    if (Fv.some((q) => !Number.isFinite(q))) return null;
    const nrm = Math.hypot(...Fv);
    if (nrm < 1e-14) return { x, residual: nrm, iterations: it };
    const Jv = J.map((r) => r.map((e) => evalReal(e, env)));
    const dx = gaussSolve(Jv, Fv.map((q) => -q));
    if (!dx) return null;
    // damped step
    let t = 1;
    for (let k = 0; k < 20; k++) {
      const xn = x.map((xi, i) => xi + t * dx[i]);
      const nn = Math.hypot(...fs.map((f) => evalReal(f, envOf(xn))));
      if (Number.isFinite(nn) && nn < nrm) { x = xn; break; }
      t /= 2;
      if (k === 19) x = xn;
    }
  }
  const env = envOf(x);
  const res = Math.hypot(...fs.map((f) => evalReal(f, env)));
  return res < 1e-9 ? { x, residual: res, iterations: maxIt } : null;
}
export function gaussSolve(Am, b) {
  const n = b.length;
  const Mx = Am.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let i = c + 1; i < n; i++) if (Math.abs(Mx[i][c]) > Math.abs(Mx[p][c])) p = i;
    if (Math.abs(Mx[p][c]) < 1e-300) return null;
    [Mx[p], Mx[c]] = [Mx[c], Mx[p]];
    for (let i = c + 1; i < n; i++) { const f = Mx[i][c] / Mx[c][c]; for (let j = c; j <= n; j++) Mx[i][j] -= f * Mx[c][j]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = Mx[i][n]; for (let j = i + 1; j < n; j++) s -= Mx[i][j] * x[j]; x[i] = s / Mx[i][i]; }
  return x;
}

/** Solve a system of equations. */
export function solveSystem(eqs, vars) {
  const steps = [];
  if (!vars || !vars.length) { const fs = new Set(); eqs.forEach((e) => freeSyms(e, fs)); vars = [...fs].sort(); }
  // linear?
  const lin = eqs.map((e) => linearCoeffs(e, vars));
  if (lin.every(Boolean)) {
    const Am = lin.map((r) => r[0]), b = lin.map((r) => r[1]);
    const r = solveSystemQ(Am, b, { record: true });
    steps.push({ text: 'Linear system: augmented matrix [A | b]', latex: augLatex(Am, b) });
    r.steps.slice(0, 14).forEach((s) => steps.push({ text: s.op, latex: augLatex(s.M.map((row) => row.slice(0, -1)), s.M.map((row) => row[row.length - 1])) }));
    if (r.kind === 'none') return { kind: 'none', steps, vars, text: 'Inconsistent: no solution (a row reads 0 = nonzero)' };
    if (r.kind === 'unique') {
      // verification by back-substitution
      const ok = Am.every((row, i) => row.reduce((s, a, j) => s.add(a.mul(r.x[j])), Q0).eq(b[i]));
      return { kind: 'unique', solutions: [vars.map((v, i) => ({ v, expr: numQ(r.x[i]) }))], steps, vars, verified: ok, verifyText: ok ? 'A·x = b holds exactly (rational arithmetic)' : 'check failed' };
    }
    const params = r.nulls.map((_, i) => S(`t_${i + 1}`));
    const sol = vars.map((v, i) => ({ v, expr: A(numQ(r.x[i]), ...r.nulls.map((nv, j) => M(numQ(nv[i]), params[j]))) }));
    return { kind: 'infinite', solutions: [sol], steps, vars, verified: true, verifyText: `rank ${r.rank} < ${vars.length} unknowns: ${r.free}-parameter family` };
  }
  // substitution elimination
  const exact = eliminate(eqs.map(asZeroForm), vars, steps, 0);
  if (exact && exact.length) {
    const good = exact.filter((sol) => {
      const env = {}; sol.forEach(({ v, expr }) => { env[v] = evalComplex(expr); });
      return eqs.every((e) => { const r = evalComplex(asZeroForm(e), env); return Math.hypot(r.re, r.im) < 1e-8; });
    });
    for (const sol of good) {
      if (sol.some((q) => q.approx)) {
        const env = {}; sol.forEach(({ v, expr }) => { env[v] = evalReal(expr); });
        sol.forEach((q) => { q.value = env[q.v]; q.expr = numQ(Q.fromNumber(Number(env[q.v].toPrecision(12)))); q.approx = true; });
      }
    }
    if (good.length) return { kind: 'finite', solutions: good, steps, vars, verified: true, verifyText: 'each solution substituted back: residual < 1e−8' };
  }
  // Newton multi-start
  const fs = eqs.map(asZeroForm);
  const found = [];
  const starts = [];
  const grid = [-3, -1, -0.3, 0.5, 1.2, 2.5];
  const rng = mulberry(7);
  for (let s = 0; s < 80; s++) starts.push(vars.map(() => (s < 36 ? grid[Math.floor(rng() * grid.length)] : (rng() - 0.5) * 12)));
  for (const x0 of starts) {
    const r = newtonSystem(fs, vars, x0);
    if (r && !found.some((f) => f.x.every((xv, i) => Math.abs(xv - r.x[i]) < 1e-7))) found.push(r);
    if (found.length > 12) break;
  }
  steps.push({ text: `Nonlinear system: Newton's method with the exact Jacobian from ${starts.length} starting points`, latex: `J = ${matLatexE(jacobian(fs, vars))}` });
  found.sort((a, b) => a.x[0] - b.x[0]);
  return {
    kind: found.length ? 'numeric' : 'nonefound', steps, vars,
    solutions: found.map((f) => vars.map((v, i) => ({ v, value: f.x[i], expr: numQ(Q.fromNumber(Number(f.x[i].toPrecision(12)))) }))),
    verified: found.length > 0, verifyText: found.length ? `max residual ${fmtNum(Math.max(...found.map((f) => f.residual)), 3)}` : 'no real solution found from the starting grid',
  };
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function eliminate(fs, vars, steps, depth) {
  if (depth > 4) return null;
  if (fs.length === 1 && vars.length === 1) {
    const r = solveEquation(fs[0], vars[0]);
    if (r.general || r.numericOnly) return null;
    const out = r.exact.map((e) => [{ v: vars[0], expr: e.expr }]);
    r.numeric.filter((z) => Math.abs(z.im) < 1e-12).forEach((z) => out.push([{ v: vars[0], expr: numQ(Q.fromNumber(Number(z.re.toPrecision(15)))), approx: true }]));
    return out;
  }
  // find an equation linear in some variable with constant coefficient
  for (let i = 0; i < fs.length; i++) for (const v of vars) {
    const m = coeffsIn(fs[i], v);
    if (!m || [...m.keys()].some((k) => k > 1) || !m.has(1)) continue;
    const co = m.get(1);
    if (!isNum(co)) continue;
    const expr = niceSimplify(neg(div(m.get(0) || ZERO, co)));
    steps.push({ text: `Solve equation ${i + 1} for ${v} and substitute`, latex: `${v} = ${toLatex(expr)}` });
    const rest = fs.filter((_, j) => j !== i).map((f) => expand(subs(f, { [v]: expr })));
    const restVars = vars.filter((w) => w !== v);
    if (!rest.length) return null;
    const sub1 = eliminate(rest, restVars, steps, depth + 1);
    if (!sub1) return null;
    return sub1.map((sol) => {
      const env = Object.fromEntries(sol.map((s) => [s.v, s.expr]));
      return [...sol, { v, expr: niceSimplify(subs(expr, env)) }].sort((a, b) => vars.indexOf(a.v) - vars.indexOf(b.v));
    });
  }
  return null;
}

function augLatex(Am, b) {
  const rows = Am.map((r, i) => [...r.map((q) => q.toLatex()), b[i].toLatex()]);
  const cols = Am[0].length;
  return `\\left(\\begin{array}{${'c'.repeat(cols)}|c} ${rows.map((r) => r.join(' & ')).join(' \\\\ ')} \\end{array}\\right)`;
}
function matLatexE(Mx) { return `\\begin{pmatrix} ${Mx.map((r) => r.map((e) => toLatex(e)).join(' & ')).join(' \\\\ ')} \\end{pmatrix}`; }

/* ============================================================
   INEQUALITIES
   ============================================================ */

export function solveInequality(rel, v) {
  const steps = [];
  const g = sub(rel.l, rel.r);
  const op = rel.op;
  const [n, d] = numden(g);
  const crit = []; // {x: number, expr, kind:'zero'|'pole'}
  const addRoots = (e, kind) => {
    const p = toPoly(expand(e), v);
    if (p && pdeg(p) >= 1) {
      const pr = polyRoots(p, v);
      pr.exact.forEach(({ expr }) => { const z = evalComplex(expr); if (Math.abs(z.im) < 1e-12) crit.push({ x: z.re, expr: niceSimplify(expr), kind }); });
      pr.numeric.forEach((z) => { if (Math.abs(z.im) < 1e-12) crit.push({ x: z.re, expr: numQ(Q.fromNumber(Number(z.re.toPrecision(10)))), kind, approx: true }); });
    } else if (!p) {
      const r = numericRealRoots((x) => evalReal(e, { [v]: x }), -100, 100);
      r.forEach((x) => crit.push({ x, expr: numQ(Q.fromNumber(Number(x.toPrecision(10)))), kind, approx: true }));
    }
  };
  addRoots(n, 'zero');
  if (has(d, v)) addRoots(d, 'pole');
  crit.sort((a, b) => a.x - b.x);
  const uniq = [];
  for (const c of crit) { const u = uniq.find((q) => Math.abs(q.x - c.x) < 1e-9); if (u) { if (c.kind === 'pole') u.kind = 'pole'; } else uniq.push({ ...c }); }
  steps.push({ text: 'Critical points (zeros of numerator, poles of denominator)', latex: uniq.length ? uniq.map((c) => `${toLatex(c.expr)}${c.kind === 'pole' ? '\\;(\\text{pole})' : ''}`).join(',\\; ') : '\\text{none}' });
  const test = (x) => { const val = evalReal(g, { [v]: x }); return val; };
  const holds = (val) => op === '<' ? val < 0 : op === '<=' ? val <= 1e-12 : op === '>' ? val > 0 : op === '>=' ? val >= -1e-12 : Math.abs(val) > 1e-12;
  const pts = [-Infinity, ...uniq.map((c) => c.x), Infinity];
  const intervals = [];
  const chart = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const mid = !Number.isFinite(a) && !Number.isFinite(b) ? 0 : !Number.isFinite(a) ? b - 1 - Math.abs(b) : !Number.isFinite(b) ? a + 1 + Math.abs(a) : (a + b) / 2;
    const val = test(mid);
    chart.push({ a, b, sign: Math.sign(val) });
    if (holds(val)) intervals.push({ lo: i === 0 ? null : uniq[i - 1], hi: i === pts.length - 2 ? null : uniq[i] });
  }
  steps.push({ text: 'Sign chart (test a point in each interval)', latex: chart.map((c) => `(${Number.isFinite(c.a) ? fmtNum(c.a, 5) : '-\\infty'}, ${Number.isFinite(c.b) ? fmtNum(c.b, 5) : '\\infty'}): ${c.sign > 0 ? '+' : c.sign < 0 ? '-' : '0'}`).join(',\\; ') });
  const closed = op === '<=' || op === '>=';
  // merge intervals and endpoints
  const parts = [];
  for (const iv of intervals) {
    const loIncl = iv.lo && closed && iv.lo.kind === 'zero';
    const hiIncl = iv.hi && closed && iv.hi.kind === 'zero';
    const last = parts[parts.length - 1];
    if (last && last.hi && iv.lo && last.hi === iv.lo && closed && iv.lo.kind === 'zero') { last.hi = iv.hi; last.hiIncl = hiIncl; continue; }
    parts.push({ lo: iv.lo, hi: iv.hi, loIncl, hiIncl });
  }
  // isolated points for <=, >= where zero between non-holding intervals
  if (closed) for (const c of uniq) if (c.kind === 'zero' && !parts.some((p) => (p.lo === c && p.loIncl) || (p.hi === c && p.hiIncl))) parts.push({ lo: c, hi: c, loIncl: true, hiIncl: true, point: true });
  parts.sort((a, b) => (a.lo ? a.lo.x : -Infinity) - (b.lo ? b.lo.x : -Infinity));
  const latex = parts.length ? parts.map((p) => p.point ? `\\{${toLatex(p.lo.expr)}\\}` : `${p.loIncl ? '[' : '('}${p.lo ? toLatex(p.lo.expr) : '-\\infty'}, ${p.hi ? toLatex(p.hi.expr) : '\\infty'}${p.hiIncl ? ']' : ')'}`).join(' \\cup ') : '\\varnothing';
  const plain = parts.length ? parts.map((p) => p.point ? `{${toStr(p.lo.expr)}}` : `${p.loIncl ? '[' : '('}${p.lo ? toStr(p.lo.expr) : '-oo'}, ${p.hi ? toStr(p.hi.expr) : 'oo'}${p.hiIncl ? ']' : ')'}`).join(' U ') : 'no solution';
  // verification: random samples agree with membership
  let ok = true;
  for (let t = 0; t < 60; t++) {
    const x = (t - 30) * 0.37 + 0.013;
    const inSet = parts.some((p) => (p.lo ? (p.loIncl ? x >= p.lo.x : x > p.lo.x) : true) && (p.hi ? (p.hiIncl ? x <= p.hi.x : x < p.hi.x) : true));
    const val = test(x);
    if (!Number.isFinite(val)) continue;
    if (inSet !== holds(val)) { ok = false; break; }
  }
  return { latex, plain, parts, steps, verified: ok };
}

/* ============================================================
   ODEs
   ============================================================ */

const DSYM = (k, y = 'y') => S(y + "'".repeat(k));

function odeOrder(g, y) { let o = -1; for (let k = 0; k < 10; k++) if (has(g, y + "'".repeat(k))) o = k; return o; }

/**
 * dsolve: symbolic ODE solving.
 * @param eq rel or expr (=0) in y, y', y'', ... and independent var x
 * @param ics [{k, x0: expr, val: expr}]
 */
export function dsolve(eq, { y = 'y', x = 'x', ics = [] } = {}) {
  const steps = [];
  const g = expand(asZeroForm(eq));
  const order = odeOrder(g, y);
  if (order < 1) throw new Error(`No derivative of ${y} found — write e.g. y' or y''`);
  const Ys = Array.from({ length: order + 1 }, (_, k) => DSYM(k, y).n);
  const X = S(x);
  // linearity check: coefficients of each Y_k, no products
  const ts = g.t === 'add' ? g.a : [g];
  const coef = Ys.map(() => ZERO); let rhs = ZERO; let linear = true;
  for (const t of ts) {
    const inY = Ys.filter((n) => has(t, n));
    if (!inY.length) { rhs = sub(rhs, t); continue; }
    if (inY.length > 1) { linear = false; break; }
    const m = coeffsIn(t, inY[0]);
    if (!m || m.size !== 1 || !m.has(1)) { linear = false; break; }
    coef[Ys.indexOf(inY[0])] = A(coef[Ys.indexOf(inY[0])], m.get(1));
  }
  let general = null; let Cs = [];
  const constCoef = linear && coef.every((c) => !has(c, x));
  if (linear && constCoef) {
    const r = constantCoefficient(coef, rhs, x, y, steps);
    if (r) { general = r.expr; Cs = r.Cs; }
  }
  if (!general && linear && order === 1) {
    // y' + p y = q
    const a1 = coef[1], p = div(coef[0], a1), q = div(rhs, a1);
    const Ip = integrate(niceSimplify(p), x);
    if (Ip.ok) {
      const mu = niceSimplify(F('exp', Ip.result));
      steps.push({ text: 'First-order linear: integrating factor μ = e^{∫p dx}', latex: `${y}' + ${toLatex(niceSimplify(p))}\\,${y} = ${toLatex(niceSimplify(q))},\\quad \\mu = ${toLatex(mu)}` });
      const Iq = integrate(niceSimplify(expand(M(mu, q))), x);
      if (Iq.ok) {
        const C1 = S('C1'); Cs = [C1];
        general = niceSimplify(div(A(Iq.result, C1), mu));
        steps.push({ text: '(μy)\' = μq, integrate both sides', latex: `${toLatex(mu)}\\,${y} = ${toLatex(Iq.result)} + C_1` });
      }
    }
  }
  if (!general && order === 1) {
    // separable: y' = F(x,y)
    const m = coeffsIn(g, Ys[1]);
    if (m && m.size <= 2 && m.has(1) && !has(m.get(1), Ys[1])) {
      const Fxy = niceSimplify(neg(div(m.get(0) || ZERO, m.get(1))));
      const Yv = S(y);
      const fs = Fxy.t === 'mul' ? Fxy.a : [Fxy];
      const fx = M(fs.filter((f) => !has(f, y))), hy = M(fs.filter((f) => has(f, y)));
      if (!has(fx, y) && !has(hy, x)) {
        steps.push({ text: 'Separable: dy / h(y) = f(x) dx', latex: `\\frac{d${y}}{${toLatex(hy)}} = ${toLatex(fx)}\\,d${x}` });
        const Hy = integrate(niceSimplify(P(hy, MONE)), y), Gx = integrate(fx, x);
        if (Hy.ok && Gx.ok) {
          const C1 = S('C1'); Cs = [C1];
          steps.push({ text: 'Integrate both sides', latex: `${toLatex(Hy.result)} = ${toLatex(Gx.result)} + C_1` });
          // try explicit
          const Hs = Hy.result;
          if (Hs.t === 'fn' && Hs.n === 'log') { general = niceSimplify(M(C1, F('exp', Gx.result))); steps.push({ text: 'Exponentiate (absorbing ±e^{C} into C₁)', latex: `${y} = C_1 e^{${toLatex(Gx.result)}}` }); }
          else {
            const iso = solveEquation({ t: 'rel', op: '=', l: Hs, r: A(Gx.result, C1) }, y);
            if (iso.exact.length === 1 && !iso.general) general = iso.exact[0].expr;
            else if (iso.exact.length > 1 && !iso.general) { general = iso.exact[iso.exact.length - 1].expr; steps.push({ text: `${iso.exact.length} branches; showing one (others: ${iso.exact.slice(0, -1).map((e) => toStr(e.expr)).join(', ')})`, latex: '' }); }
            else { return { implicit: { t: 'rel', op: '=', l: Hs, r: A(Gx.result, C1) }, steps, order }; }
          }
        }
      }
    }
  }
  if (!general) throw new Error('No symbolic method applies (supported: constant-coefficient linear, first-order linear, separable). Try "ode" for a numeric solution.');
  // verify
  let ver = null;
  try {
    const env = {}; let dd = general;
    for (let k = 0; k <= order; k++) { env[Ys[k]] = dd; dd = diff(dd, x); }
    const resid = niceSimplify(subs(asZeroForm(eq), env));
    if (isZero(resid)) ver = 'substituted into the ODE: residual simplifies to 0';
    else {
      const Cenv = Object.fromEntries(Cs.map((c, i) => [c.n, 0.7 + 0.3 * i]));
      const r2 = subs(resid, Object.fromEntries(Object.entries(Cenv).map(([k, v]) => [k, numQ(Q.fromNumber(v))])));
      const ne = numericallyEqual(r2, ZERO, x);
      if (ne.ok) ver = `substituted into the ODE: residual ≈ 0 at ${ne.checked} sample points`;
    }
  } catch { /* ignore */ }
  let particular = null;
  if (ics.length && Cs.length) {
    const eqs = []; let dd = general;
    const ders = [general];
    for (let k = 1; k < order; k++) { dd = diff(dd, x); ders.push(dd); }
    for (const ic of ics) eqs.push({ t: 'rel', op: '=', l: niceSimplify(subs(ders[ic.k], { [x]: ic.x0 })), r: ic.val });
    const sol = solveSystem(eqs, Cs.map((c) => c.n));
    if (sol.solutions && sol.solutions.length) {
      const env = Object.fromEntries(sol.solutions[0].map((s) => [s.v, s.expr]));
      particular = niceSimplify(subs(general, env));
      steps.push({ text: 'Apply initial conditions and solve for the constants', latex: sol.solutions[0].map((s) => `${s.v.replace(/C(\d)/, 'C_$1')} = ${toLatex(s.expr)}`).join(',\\; ') });
    }
  }
  return { general, particular, Cs, steps, verified: ver, order };
}

function constantCoefficient(coef, rhs, x, y, steps) {
  const order = coef.length - 1;
  const X = S(x);
  const R = S('r');
  const charPoly = A(coef.map((c, k) => M(c, P(R, N(k)))));
  const cp = toPoly(charPoly, 'r');
  if (!cp) return null;
  steps.push({ text: 'Characteristic equation (try y = e^(rx))', latex: `${toLatex(charPoly)} = 0` });
  const pr = polyRoots(cp, 'r');
  const roots = [];
  pr.exact.forEach(({ expr, mult }) => roots.push({ expr: niceSimplify(expr), z: evalComplex(expr), mult }));
  pr.numeric.forEach((z) => roots.push({ expr: null, z, mult: z.mult || 1 }));
  const tidy = (z) => numQ(Q.fromNumber(Number(z.toPrecision(12))));
  steps.push({ text: 'Roots', latex: roots.map((r) => `r = ${r.expr ? toLatex(r.expr) : fmtComplex(r.z)}${r.mult > 1 ? `\\;(\\times${r.mult})` : ''}`).join(',\\; ') });
  const basis = [];
  const usedConj = new Set();
  roots.forEach((r, idx) => {
    if (usedConj.has(idx)) return;
    if (Math.abs(r.z.im) < 1e-12) {
      const re = r.expr ? r.expr : tidy(r.z.re);
      for (let j = 0; j < r.mult; j++) basis.push(M(P(X, N(j)), F('exp', M(re, X))));
    } else {
      const conjIdx = roots.findIndex((s, k) => k !== idx && Math.abs(s.z.re - r.z.re) < 1e-10 && Math.abs(s.z.im + r.z.im) < 1e-10);
      if (conjIdx >= 0) usedConj.add(conjIdx);
      let alpha, beta;
      if (r.expr) { alpha = niceSimplify(A(M(HALF, r.expr), M(HALF, conjIdx >= 0 && roots[conjIdx].expr ? roots[conjIdx].expr : r.expr))); beta = niceSimplify(M(A(r.expr, neg(alpha)), P(S('i'), MONE))); if (evalReal(beta) < 0) beta = neg(beta); }
      else { alpha = tidy(r.z.re); beta = tidy(Math.abs(r.z.im)); }
      if (!Number.isFinite(evalReal(alpha)) || !Number.isFinite(evalReal(beta))) { alpha = tidy(r.z.re); beta = tidy(Math.abs(r.z.im)); }
      for (let j = 0; j < r.mult; j++) {
        basis.push(M(P(X, N(j)), F('exp', M(alpha, X)), F('cos', M(beta, X))));
        basis.push(M(P(X, N(j)), F('exp', M(alpha, X)), F('sin', M(beta, X))));
      }
    }
  });
  const Cs = basis.map((_, i) => S(`C${i + 1}`));
  let yh = A(basis.map((b, i) => M(Cs[i], b)));
  steps.push({ text: 'Homogeneous solution', latex: `${y}_h = ${toLatex(yh)}` });
  let yp = ZERO;
  if (!isZero(rhs)) {
    yp = undetermined(coef, rhs, x, roots, steps);
    if (!yp) return null;
  }
  return { expr: A(yh, yp), Cs };
}

function undetermined(coef, rhs, x, roots, steps) {
  // trial family: for each term of rhs = poly(x) e^{ax} (cos bx | sin bx)
  const X = S(x);
  const terms = expand(rhs).t === 'add' ? expand(rhs).a : [expand(rhs)];
  const fams = new Map();
  for (const t of terms) {
    const fs = t.t === 'mul' ? t.a : [t];
    let a = ZERO, b = ZERO, deg = 0;
    for (const f of fs) {
      if (!has(f, x)) continue;
      if (isSym(f, x)) deg += 1;
      else if (f.t === 'pow' && isSym(f.b, x) && isNum(f.e) && f.e.v.isInt && f.e.v.sign > 0) deg += Number(f.e.v.n);
      else if (f.t === 'fn' && f.n === 'exp') { const m = coeffsIn(f.a[0], x); if (!m || [...m.keys()].some((k) => k > 1)) return null; a = A(a, m.get(1) || ZERO); }
      else if (f.t === 'fn' && (f.n === 'sin' || f.n === 'cos')) { const m = coeffsIn(f.a[0], x); if (!m || m.size !== 1 || !m.has(1)) return null; b = m.get(1); if (evalReal(b) < 0) b = neg(b); }
      else return null;
    }
    const k = key(a) + '|' + key(b);
    const cur = fams.get(k);
    if (cur) cur.deg = Math.max(cur.deg, deg); else fams.set(k, { a, b, deg });
  }
  const trial = [];
  for (const { a, b, deg } of fams.values()) {
    // multiplicity s of a + ib as a characteristic root
    const av = evalReal(a), bv = evalReal(b);
    let s = 0;
    for (const r of roots) if (Math.abs(r.z.re - av) < 1e-9 && Math.abs(Math.abs(r.z.im) - Math.abs(bv)) < 1e-9 && (bv === 0 ? Math.abs(r.z.im) < 1e-9 : r.z.im > 0)) s = r.mult;
    for (let j = 0; j <= deg; j++) {
      const base = M(P(X, N(j + s)), F('exp', M(a, X)));
      if (isZero(b)) trial.push(base);
      else { trial.push(M(base, F('cos', M(b, X)))); trial.push(M(base, F('sin', M(b, X)))); }
    }
  }
  // L[trial_i] evaluated at sample points -> least squares for coefficients, then rationalise & verify
  const L = (e) => { let r = ZERO, d = e; for (let k = 0; k < coef.length; k++) { r = A(r, M(coef[k], d)); d = diff(d, x); } return r; };
  const Ls = trial.map(L);
  const pts = Array.from({ length: trial.length * 3 + 4 }, (_, i) => -1.3 + i * 0.173);
  const Am = pts.map((p) => Ls.map((e) => evalReal(e, { [x]: p })));
  const bv = pts.map((p) => evalReal(rhs, { [x]: p }));
  // normal equations
  const n = trial.length;
  const AtA = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => Am.reduce((s, r) => s + r[i] * r[j], 0)));
  const Atb = Array.from({ length: n }, (_, i) => Am.reduce((s, r, k) => s + r[i] * bv[k], 0));
  const c = gaussSolve(AtA, Atb);
  if (!c) return null;
  const cq = c.map((v) => { const q = rationalApprox(v, 100000, 1e-9); return q ? numQ(q) : null; });
  if (cq.some((q) => !q)) return null;
  const yp = niceSimplify(A(trial.map((t, i) => M(cq[i], t))));
  const check = niceSimplify(sub(L(yp), rhs));
  const ok = isZero(check) || numericallyEqual(L(yp), rhs, x).ok;
  if (!ok) return null;
  steps.push({ text: 'Undetermined coefficients: trial family from the right-hand side (multiplied by x^s on resonance)', latex: `${'y'}_p = ${toLatex(yp)}` });
  return yp;
}

/* ============================================================
   NUMERIC ODE: Dormand–Prince RK45 (adaptive)
   ============================================================ */

export function rk45(f, t0, y0, t1, { rtol = 1e-9, atol = 1e-11, maxSteps = 20000, h0 = null } = {}) {
  const c = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1];
  const a = [[], [1 / 5], [3 / 40, 9 / 40], [44 / 45, -56 / 15, 32 / 9], [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
    [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656], [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84]];
  const b5 = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0];
  const b4 = [5179 / 57600, 0, 7571 / 16695, 393 / 640, -92097 / 339200, 187 / 2100, 1 / 40];
  const dir = Math.sign(t1 - t0) || 1;
  let t = t0, y = y0.slice();
  let h = h0 || dir * Math.min(Math.abs(t1 - t0) / 100, 0.1);
  const ts = [t], ys = [y.slice()];
  let steps = 0, rejected = 0;
  while (dir * (t1 - t) > 1e-14 && steps < maxSteps) {
    if (dir * (t + h - t1) > 0) h = t1 - t;
    const k = [];
    for (let s = 0; s < 7; s++) {
      const yi = y.map((yv, i) => yv + h * a[s].reduce((acc, aij, j) => acc + aij * k[j][i], 0));
      k.push(f(t + c[s] * h, yi));
    }
    const y5 = y.map((yv, i) => yv + h * b5.reduce((acc, bj, j) => acc + bj * k[j][i], 0));
    const y4 = y.map((yv, i) => yv + h * b4.reduce((acc, bj, j) => acc + bj * k[j][i], 0));
    let err = 0;
    for (let i = 0; i < y.length; i++) { const sc = atol + rtol * Math.max(Math.abs(y[i]), Math.abs(y5[i])); err = Math.max(err, Math.abs(y5[i] - y4[i]) / sc); }
    if (!Number.isFinite(err)) { h /= 4; rejected++; if (Math.abs(h) < 1e-14) break; continue; }
    if (err <= 1) { t += h; y = y5; ts.push(t); ys.push(y.slice()); steps++; }
    else rejected++;
    const fac = err === 0 ? 5 : Math.min(5, Math.max(0.2, 0.9 * Math.pow(err, -0.2)));
    h *= fac;
    if (Math.abs(h) < 1e-14) break;
  }
  return { t: ts, y: ys, steps, rejected, done: dir * (t1 - t) <= 1e-12 };
}

/** Build a first-order system from textual ODEs (already parsed) */
export function odeSystem(eqs, { x = 'x' } = {}) {
  // eqs: rel nodes like y' = expr, or y'' = expr (converted)
  const states = []; const rhs = [];
  for (const e of eqs) {
    if (e.t !== 'rel' || e.l.t !== 'sym' || !/'+$/.test(e.l.n)) {
      // try to solve for the highest derivative
      const g = asZeroForm(e);
      const fsy = [...freeSyms(g)].filter((n) => /'+$/.test(n));
      if (!fsy.length) throw new Error('Each ODE must contain a derivative like y\'');
      const top = fsy.sort((a, b) => b.length - a.length)[0];
      const m = coeffsIn(g, top);
      if (!m || m.size > 2 || !m.has(1) || has(m.get(1), top)) throw new Error(`Cannot solve for ${top}`);
      eqs = eqs.map((q) => (q === e ? { t: 'rel', op: '=', l: S(top), r: niceSimplify(neg(div(m.get(0) || ZERO, m.get(1)))) } : q));
    }
  }
  for (const e of eqs) {
    const name = e.l.n.replace(/'+$/, ''), ord = e.l.n.length - name.length;
    for (let k = 0; k < ord; k++) { const s = name + "'".repeat(k); if (!states.includes(s)) states.push(s); }
  }
  for (const s of states) {
    const nxt = s + "'";
    if (states.includes(nxt)) { rhs.push(S(nxt)); continue; }
    const e = eqs.find((q) => q.l.n === nxt);
    if (!e) throw new Error(`Missing equation for ${nxt}`);
    rhs.push(e.r);
  }
  const f = (t, yv) => { const env = { [x]: t }; states.forEach((s, i) => { env[s] = yv[i]; }); return rhs.map((r) => evalReal(r, env)); };
  return { states, rhs, f };
}
