/* ============================================================
   mathx / optimize — 1-D minimisation (golden section + Brent),
   multivariate (Nelder–Mead, BFGS with exact symbolic gradient or
   finite differences), exact rational simplex for linear programs
   (two-phase, Bland's rule), constrained nonlinear via augmented
   Lagrangian (penalty) with BFGS inner solves. Pure (no DOM).
   ============================================================ */

import { Q, Q0, Q1 } from './rational.js';

/** Brent's method for minimisation on [a,b] */
export function brentMin(f, a, b, tol = 1e-12) {
  const CG = 0.3819660112501051;
  let x = a + CG * (b - a), w = x, v = x, fx = f(x), fw = fx, fv = fx, d = 0, e = 0;
  let iters = 0;
  for (; iters < 500; iters++) {
    const xm = (a + b) / 2, tol1 = tol * Math.abs(x) + 1e-15, tol2 = 2 * tol1;
    if (Math.abs(x - xm) <= tol2 - (b - a) / 2) break;
    let useGolden = true;
    if (Math.abs(e) > tol1) {
      let r = (x - w) * (fx - fv), q = (x - v) * (fx - fw), p = (x - v) * q - (x - w) * r;
      q = 2 * (q - r); if (q > 0) p = -p; q = Math.abs(q);
      if (Math.abs(p) < Math.abs(0.5 * q * e) && p > q * (a - x) && p < q * (b - x)) { e = d; d = p / q; useGolden = false; const u = x + d; if (u - a < tol2 || b - u < tol2) d = xm - x >= 0 ? tol1 : -tol1; }
    }
    if (useGolden) { e = (x >= xm ? a : b) - x; d = CG * e; }
    const u = x + (Math.abs(d) >= tol1 ? d : (d > 0 ? tol1 : -tol1));
    const fu = f(u);
    if (fu <= fx) { if (u >= x) a = x; else b = x; v = w; fv = fw; w = x; fw = fx; x = u; fx = fu; }
    else { if (u < x) a = u; else b = u; if (fu <= fw || w === x) { v = w; fv = fw; w = u; fw = fu; } else if (fu <= fv || v === x || v === w) { v = u; fv = fu; } }
  }
  return { x, fx, iterations: iters };
}

/** global-ish 1-D minimum on [a,b]: sample grid, then Brent around the best bracket */
export function minimize1D(f, a, b) {
  const N = 400; let bi = 0, bv = Infinity; const xs = [];
  for (let i = 0; i <= N; i++) { const x = a + (b - a) * i / N; const y = f(x); xs.push(x); if (Number.isFinite(y) && y < bv) { bv = y; bi = i; } }
  const lo = xs[Math.max(0, bi - 1)], hi = xs[Math.min(N, bi + 1)];
  const r = brentMin(f, lo, hi);
  // endpoint check
  if (f(a) < r.fx) return { x: a, fx: f(a), iterations: r.iterations, boundary: true };
  if (f(b) < r.fx) return { x: b, fx: f(b), iterations: r.iterations, boundary: true };
  return r;
}

export function nelderMead(f, x0, { maxIter = 5000, tol = 1e-14, step = 0.5 } = {}) {
  const n = x0.length;
  let simplex = [x0.slice()];
  for (let i = 0; i < n; i++) { const p = x0.slice(); p[i] += p[i] ? step * Math.abs(p[i]) : step; simplex.push(p); }
  let vals = simplex.map(f);
  let it = 0;
  for (; it < maxIter; it++) {
    const order = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]);
    simplex = order.map((i) => simplex[i]); vals = order.map((i) => vals[i]);
    if (Math.abs(vals[n] - vals[0]) <= tol * (Math.abs(vals[0]) + 1e-20) && it > 10) break;
    const c = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) c[j] += simplex[i][j] / n;
    const refl = c.map((cj, j) => cj + (cj - simplex[n][j])); const fr = f(refl);
    if (fr < vals[0]) {
      const exp = c.map((cj, j) => cj + 2 * (cj - simplex[n][j])); const fe = f(exp);
      if (fe < fr) { simplex[n] = exp; vals[n] = fe; } else { simplex[n] = refl; vals[n] = fr; }
    } else if (fr < vals[n - 1]) { simplex[n] = refl; vals[n] = fr; }
    else {
      const con = c.map((cj, j) => cj + 0.5 * (simplex[n][j] - cj)); const fc = f(con);
      if (fc < vals[n]) { simplex[n] = con; vals[n] = fc; }
      else { for (let i = 1; i <= n; i++) { simplex[i] = simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j])); vals[i] = f(simplex[i]); } }
    }
  }
  return { x: simplex[0], fx: vals[0], iterations: it };
}

export function numGrad(f, x) {
  return x.map((xi, i) => {
    const h = 1e-6 * Math.max(1, Math.abs(xi));
    const a = x.slice(), b = x.slice(); a[i] += h; b[i] -= h;
    return (f(a) - f(b)) / (2 * h);
  });
}

export function bfgs(f, x0, { grad = null, maxIter = 500, gtol = 1e-10 } = {}) {
  const n = x0.length;
  const g = grad || ((x) => numGrad(f, x));
  let x = x0.slice(), fx = f(x), gx = g(x);
  let H = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  let it = 0;
  for (; it < maxIter; it++) {
    const gn = Math.hypot(...gx);
    if (!(gn > gtol)) break;
    const p = H.map((r) => -r.reduce((s, v, j) => s + v * gx[j], 0));
    // backtracking Armijo line search
    let t = 1; const slope = p.reduce((s, v, i) => s + v * gx[i], 0);
    if (slope >= 0) { H = H.map((r, i) => r.map((_, j) => (i === j ? 1 : 0))); continue; }
    let xn, fn;
    for (let k = 0; k < 60; k++) { xn = x.map((v, i) => v + t * p[i]); fn = f(xn); if (Number.isFinite(fn) && fn <= fx + 1e-4 * t * slope) break; t /= 2; }
    const gnew = g(xn);
    const s = xn.map((v, i) => v - x[i]), y = gnew.map((v, i) => v - gx[i]);
    const sy = s.reduce((a, v, i) => a + v * y[i], 0);
    if (sy > 1e-300) {
      const Hy = H.map((r) => r.reduce((a, v, j) => a + v * y[j], 0));
      const yHy = y.reduce((a, v, i) => a + v * Hy[i], 0);
      H = H.map((r, i) => r.map((v, j) => v + ((sy + yHy) * s[i] * s[j]) / (sy * sy) - (Hy[i] * s[j] + s[i] * Hy[j]) / sy));
    }
    const done = Math.abs(fn - fx) < 1e-16 * (1 + Math.abs(fx)) && Math.hypot(...s) < 1e-14;
    x = xn; fx = fn; gx = gnew;
    if (done) break;
  }
  return { x, fx, iterations: it, gradNorm: Math.hypot(...gx) };
}

/** augmented Lagrangian: minimise f s.t. eq(x)=0, ineq(x) <= 0 */
export function constrainedMin(f, x0, eqs = [], ineqs = [], { grad = null } = {}) {
  let lam = eqs.map(() => 0), mu = ineqs.map(() => 0), rho = 10;
  let x = x0.slice();
  let hist = [];
  for (let outer = 0; outer < 40; outer++) {
    const L = (z) => {
      let v = f(z);
      eqs.forEach((h, i) => { const hv = h(z); v += lam[i] * hv + 0.5 * rho * hv * hv; });
      ineqs.forEach((gq, i) => { const gv = Math.max(0, mu[i] / rho + gq(z)); v += 0.5 * rho * gv * gv - mu[i] * mu[i] / (2 * rho); });
      return v;
    };
    const r = bfgs(L, x, { maxIter: 400 });
    x = r.x;
    const viol = Math.max(0, ...eqs.map((h) => Math.abs(h(x))), ...ineqs.map((gq) => Math.max(0, gq(x))));
    hist.push(viol);
    eqs.forEach((h, i) => { lam[i] += rho * h(x); });
    ineqs.forEach((gq, i) => { mu[i] = Math.max(0, mu[i] + rho * gq(x)); });
    if (viol < 1e-10) break;
    rho = Math.min(rho * 4, 1e8);
  }
  const viol = Math.max(0, ...eqs.map((h) => Math.abs(h(x))), ...ineqs.map((gq) => Math.max(0, gq(x))));
  return { x, fx: f(x), violation: viol, multipliers: { eq: lam, ineq: mu } };
}

/**
 * Exact simplex. maximize c·x s.t. rows: {a:[Q], op:'<='|'>='|'=', b:Q}, x >= 0.
 * Returns {status, x:[Q], value:Q, iterations}
 */
export function simplexQ(c, cons) {
  const n = c.length;
  // normalise b >= 0
  const rows = cons.map((r) => {
    if (r.b.sign < 0) return { a: r.a.map((v) => v.neg()), b: r.b.neg(), op: r.op === '<=' ? '>=' : r.op === '>=' ? '<=' : '=' };
    return r;
  });
  const m = rows.length;
  // columns: x (n), slack/surplus, artificial
  let nS = 0, nA = 0;
  const slackCol = [], artCol = [];
  rows.forEach((r) => { slackCol.push(r.op === '=' ? -1 : n + nS++); });
  const base = n + nS;
  rows.forEach((r) => { artCol.push(r.op === '<=' ? -1 : base + nA++); });
  const W = base + nA;
  const T = rows.map((r, i) => {
    const row = new Array(W + 1).fill(Q0);
    r.a.forEach((v, j) => { row[j] = v; });
    if (slackCol[i] >= 0) row[slackCol[i]] = r.op === '<=' ? Q1 : Q1.neg();
    if (artCol[i] >= 0) row[artCol[i]] = Q1;
    row[W] = r.b;
    return row;
  });
  const basis = rows.map((r, i) => (artCol[i] >= 0 ? artCol[i] : slackCol[i]));
  let iterations = 0;
  const pivot = (pr, pc) => {
    const pv = T[pr][pc];
    T[pr] = T[pr].map((v) => v.div(pv));
    for (let i = 0; i < m; i++) if (i !== pr && !T[i][pc].isZero) { const f = T[i][pc]; T[i] = T[i].map((v, j) => v.sub(f.mul(T[pr][j]))); }
    basis[pr] = pc; iterations++;
  };
  const run = (obj, allowed) => {
    // obj: array length W (maximize), reduced costs computed each iteration
    for (let guard = 0; guard < 500; guard++) {
      const red = new Array(W).fill(Q0);
      for (let j = 0; j < W; j++) { if (!allowed(j)) continue; let z = Q0; for (let i = 0; i < m; i++) z = z.add((obj[basis[i]] || Q0).mul(T[i][j])); red[j] = (obj[j] || Q0).sub(z); }
      let pc = -1; for (let j = 0; j < W; j++) if (allowed(j) && red[j].sign > 0) { pc = j; break; } // Bland
      if (pc < 0) return 'optimal';
      let pr = -1, best = null;
      for (let i = 0; i < m; i++) if (T[i][pc].sign > 0) { const ratio = T[i][W].div(T[i][pc]); if (!best || ratio.cmp(best) < 0 || (ratio.cmp(best) === 0 && basis[i] < basis[pr])) { best = ratio; pr = i; } }
      if (pr < 0) return 'unbounded';
      pivot(pr, pc);
    }
    return 'cycling';
  };
  if (nA) {
    const obj1 = new Array(W).fill(Q0); for (let j = base; j < W; j++) obj1[j] = Q1.neg();
    run(obj1, () => true);
    let infeas = Q0; for (let i = 0; i < m; i++) if (basis[i] >= base) infeas = infeas.add(T[i][W]);
    if (infeas.sign > 0) return { status: 'infeasible', iterations };
    // drive artificials out of basis
    for (let i = 0; i < m; i++) if (basis[i] >= base) { const j = T[i].findIndex((v, k) => k < base && !v.isZero); if (j >= 0) pivot(i, j); }
  }
  const obj = new Array(W).fill(Q0); c.forEach((v, j) => { obj[j] = v; });
  const st = run(obj, (j) => j < base);
  if (st !== 'optimal') return { status: st, iterations };
  const x = new Array(n).fill(Q0);
  for (let i = 0; i < m; i++) if (basis[i] < n) x[basis[i]] = T[i][W];
  const value = c.reduce((s, v, j) => s.add(v.mul(x[j])), Q0);
  return { status: 'optimal', x, value, iterations };
}
