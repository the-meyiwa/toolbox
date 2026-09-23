/* ============================================================
   mathx / linalg — linear algebra toolkit. Exact rational paths
   (det, inverse, rank, RREF, null space, char. polynomial, exact
   eigenvalues via polynomial factoring, eigenvectors) and floating
   point paths (Hessenberg + shifted QR eigenvalues incl. complex,
   Jacobi for symmetric, one-sided Jacobi SVD, LU with partial
   pivoting, Householder QR, Cholesky, least squares, matrix
   exponential by scaling & squaring). Pure (no DOM).
   ============================================================ */

import { Q, Q0, Q1 } from './rational.js';
import { rrefQ, detQ, inverseQ, nullspaceQ, charPolyQ, matmulQ, solveSystemQ } from './linalg-exact.js';
import { polyRoots, fromPoly, factorPolyExpr } from './poly.js';
import { numQ, toLatex, evalComplex, fmtNum, fmtComplex, S, isNum } from './expr.js';

export { rrefQ, detQ, inverseQ, nullspaceQ, charPolyQ, matmulQ, solveSystemQ };

/* ---------- helpers ---------- */
export const isSquare = (Mx) => Mx.length > 0 && Mx.every((r) => r.length === Mx.length);
export const toFloat = (Mx) => Mx.map((r) => r.map((v) => (v instanceof Q ? v.toNumber() : Number(v))));
export const eye = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
export const transpose = (Mx) => Mx[0].map((_, j) => Mx.map((r) => r[j]));
export const mmul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
export const mvec = (A, x) => A.map((r) => r.reduce((s, v, k) => s + v * x[k], 0));
export const fnorm = (A) => Math.sqrt(A.reduce((s, r) => s + r.reduce((t, v) => t + v * v, 0), 0));
export const msub = (A, B) => A.map((r, i) => r.map((v, j) => v - B[i][j]));
const vnorm = (v) => Math.hypot(...v);

export function qLatex(q) { return q instanceof Q ? q.toLatex() : String(q); }
export function matLatex(Mx, fmt = (v) => (v instanceof Q ? v.toLatex() : fmtNum(typeof v === 'number' ? cleanNum(v) : v, 8))) {
  return `\\begin{pmatrix} ${Mx.map((r) => r.map(fmt).join(' & ')).join(' \\\\ ')} \\end{pmatrix}`;
}
export function cleanNum(v) { return Math.abs(v) < 1e-12 ? 0 : v; }
export const vecLatex = (v, fmt) => matLatex(v.map((x) => [x]), fmt);

/* ---------- LU (partial pivoting) ---------- */
export function lu(A0) {
  const n = A0.length;
  const A = A0.map((r) => r.slice());
  const perm = [...Array(n).keys()];
  const L = eye(n);
  let sign = 1;
  for (let k = 0; k < n; k++) {
    let p = k; for (let i = k + 1; i < n; i++) if (Math.abs(A[i][k]) > Math.abs(A[p][k])) p = i;
    if (p !== k) {
      [A[p], A[k]] = [A[k], A[p]]; [perm[p], perm[k]] = [perm[k], perm[p]]; sign = -sign;
      for (let j = 0; j < k; j++) [L[p][j], L[k][j]] = [L[k][j], L[p][j]];
    }
    if (Math.abs(A[k][k]) < 1e-300) continue;
    for (let i = k + 1; i < n; i++) {
      const f = A[i][k] / A[k][k]; L[i][k] = f;
      for (let j = k; j < n; j++) A[i][j] -= f * A[k][j];
    }
  }
  const P = perm.map((pi) => Array.from({ length: n }, (_, j) => (j === pi ? 1 : 0)));
  return { P, L, U: A, sign };
}

/* ---------- Householder QR ---------- */
export function qr(A0) {
  const m = A0.length, n = A0[0].length;
  const R = A0.map((r) => r.slice());
  let Qm = eye(m);
  for (let k = 0; k < Math.min(m - 1, n); k++) {
    const x = []; for (let i = k; i < m; i++) x.push(R[i][k]);
    const alpha = -Math.sign(x[0] || 1) * vnorm(x);
    const v = x.slice(); v[0] -= alpha;
    const vn = vnorm(v);
    if (vn < 1e-300) continue;
    for (let i = 0; i < v.length; i++) v[i] /= vn;
    for (let j = 0; j < n; j++) { let s = 0; for (let i = k; i < m; i++) s += v[i - k] * R[i][j]; for (let i = k; i < m; i++) R[i][j] -= 2 * v[i - k] * s; }
    for (let i = 0; i < m; i++) { let s = 0; for (let j = k; j < m; j++) s += Qm[i][j] * v[j - k]; for (let j = k; j < m; j++) Qm[i][j] -= 2 * s * v[j - k]; }
  }
  return { Q: Qm, R };
}

export function cholesky(A) {
  const n = A.length;
  const L = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = A[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    if (i === j) { if (s <= 1e-14 * Math.abs(A[i][i] || 1)) return null; L[i][j] = Math.sqrt(s); }
    else L[i][j] = s / L[j][j];
  }
  return L;
}

/* ---------- eigenvalues ---------- */
export function jacobiEigen(A0) {
  const n = A0.length;
  const A = A0.map((r) => r.slice());
  const V = eye(n);
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
    if (off < 1e-30) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-300) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
      for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
      for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
    }
  }
  const vals = A.map((r, i) => r[i]);
  const order = [...vals.keys()].sort((a, b) => vals[b] - vals[a]);
  return { values: order.map((i) => vals[i]), vectors: order.map((i) => V.map((r) => r[i])) };
}

/** eigenvalues of a general real matrix: Householder Hessenberg reduction + complex single-shift
 *  QR iterations (Wilkinson shift, Givens rotations, deflation). Handles complex pairs. */
export function eigenvaluesQR(A0) {
  const n = A0.length;
  const H0 = A0.map((r) => r.slice());
  for (let k = 0; k < n - 2; k++) {
    const x = []; for (let i = k + 1; i < n; i++) x.push(H0[i][k]);
    const alpha = -Math.sign(x[0] || 1) * vnorm(x);
    const v = x.slice(); v[0] -= alpha;
    const vn = vnorm(v); if (vn < 1e-300) continue;
    for (let i = 0; i < v.length; i++) v[i] /= vn;
    for (let j = 0; j < n; j++) { let s = 0; for (let i = k + 1; i < n; i++) s += v[i - k - 1] * H0[i][j]; for (let i = k + 1; i < n; i++) H0[i][j] -= 2 * v[i - k - 1] * s; }
    for (let i = 0; i < n; i++) { let s = 0; for (let j = k + 1; j < n; j++) s += H0[i][j] * v[j - k - 1]; for (let j = k + 1; j < n; j++) H0[i][j] -= 2 * s * v[j - k - 1]; }
  }
  const C = (re, im = 0) => ({ re, im });
  const add = (a, b) => C(a.re + b.re, a.im + b.im), subc = (a, b) => C(a.re - b.re, a.im - b.im);
  const mul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  const conj = (a) => C(a.re, -a.im), abs = (a) => Math.hypot(a.re, a.im);
  const csqrt = (a) => { const r = abs(a); const re = Math.sqrt((r + a.re) / 2), im = Math.sign(a.im || 1) * Math.sqrt(Math.max(0, (r - a.re) / 2)); return C(re, im); };
  const H = H0.map((r) => r.map((v) => C(v)));
  const vals = new Array(n);
  let m = n - 1, iter = 0;
  while (m >= 0) {
    if (m === 0) { vals[0] = H[0][0]; break; }
    const s = abs(H[m][m]) + abs(H[m - 1][m - 1]);
    if (abs(H[m][m - 1]) <= 1e-15 * (s || 1)) { vals[m] = H[m][m]; m--; iter = 0; continue; }
    if (++iter > 500) throw new Error('QR iteration did not converge');
    // Wilkinson shift from trailing 2x2
    const a = H[m - 1][m - 1], b = H[m - 1][m], c = H[m][m - 1], d = H[m][m];
    const tr = add(a, d), det = subc(mul(a, d), mul(b, c));
    const disc = csqrt(subc(mul(tr, tr), mul(C(4), det)));
    const l1 = C((tr.re + disc.re) / 2, (tr.im + disc.im) / 2), l2 = C((tr.re - disc.re) / 2, (tr.im - disc.im) / 2);
    let mu = abs(subc(l1, d)) < abs(subc(l2, d)) ? l1 : l2;
    if (iter % 11 === 10) mu = add(mu, C(abs(H[m][m - 1]), 0.5 * abs(H[m][m - 1]))); // exceptional shift
    // find active block start
    let lo = m - 1;
    while (lo > 0 && abs(H[lo][lo - 1]) > 1e-15 * (abs(H[lo][lo]) + abs(H[lo - 1][lo - 1]) || 1)) lo--;
    for (let i = lo; i <= m; i++) H[i][i] = subc(H[i][i], mu);
    const rots = [];
    for (let k = lo; k < m; k++) {
      const x = H[k][k], y = H[k + 1][k];
      const r = Math.hypot(abs(x), abs(y));
      if (r === 0) { rots.push(null); continue; }
      const cs = C(x.re / r, -x.im / r), sn = C(y.re / r, -y.im / r); // G = [[c, s],[-conj(s), conj(c)]] acting as [c* ... ]
      rots.push([cs, sn]);
      for (let j = k; j < n; j++) {
        const u = H[k][j], w = H[k + 1][j];
        H[k][j] = add(mul(cs, u), mul(sn, w));
        H[k + 1][j] = subc(mul(conj(cs), w), mul(conj(sn), u));
      }
    }
    for (let k = lo; k < m; k++) {
      const g = rots[k - lo]; if (!g) continue;
      const [cs, sn] = g;
      for (let i = 0; i <= Math.min(k + 2, m); i++) {
        const u = H[i][k], w = H[i][k + 1];
        H[i][k] = add(mul(u, conj(cs)), mul(w, conj(sn)));
        H[i][k + 1] = subc(mul(w, cs), mul(u, sn));
      }
    }
    for (let i = lo; i <= m; i++) H[i][i] = add(H[i][i], mu);
  }
  return vals.map((z) => (Math.abs(z.im) < 1e-10 * Math.max(1, Math.abs(z.re)) ? C(z.re, 0) : z)).sort((p, q) => (q.re - p.re) || (q.im - p.im));
}

/** robust general eigenvalues: prefer characteristic polynomial for small exact matrices, else QR. */
export function eigenNumeric(A) {
  const n = A.length;
  const sym = A.every((r, i) => r.every((v, j) => Math.abs(v - A[j][i]) < 1e-12 * (1 + Math.abs(v))));
  if (sym) {
    const r = jacobiEigen(A);
    return { symmetric: true, values: r.values.map((re) => ({ re, im: 0 })), vectors: r.vectors, method: 'Jacobi rotations (symmetric)' };
  }
  let vals, method = 'Hessenberg reduction + shifted QR iterations';
  try { vals = eigenvaluesQR(A); } catch { vals = unshiftedQRFallback(A); method = 'characteristic polynomial + Aberth roots'; }
  const vectors = vals.map((lam) => inverseIteration(A, lam));
  return { symmetric: false, values: vals, vectors, method };
}

function unshiftedQRFallback(A) {
  // Use the polynomial root finder on the characteristic polynomial computed in floating point via
  // Hessenberg-QR where possible; fall back to Faddeev–LeVerrier + Aberth for robustness on small n.
  const n = A.length;
  // Faddeev–LeVerrier in floats
  let Mk = A.map((r) => r.map(() => 0));
  const c = new Array(n + 1).fill(0); c[n] = 1;
  for (let k = 1; k <= n; k++) {
    const AM = mmul(A, Mk);
    Mk = AM.map((r, i) => r.map((v, j) => v + (i === j ? c[n - k + 1] : 0)));
    const AMk = mmul(A, Mk);
    let tr = 0; for (let i = 0; i < n; i++) tr += AMk[i][i];
    c[n - k] = -tr / k;
  }
  // roots via Aberth (poly module takes Q coefficients)
  return aberthFloat(c).map((z) => polishEig(A, z));
}
function aberthFloat(c) {
  const n = c.length - 1;
  const a = c.map((v) => v / c[n]);
  let R = 1; for (let i = 0; i < n; i++) R = Math.max(R, 1 + Math.abs(a[i]));
  let z = Array.from({ length: n }, (_, k) => ({ re: R * 0.7 * Math.cos(2 * Math.PI * k / n + 0.4), im: R * 0.7 * Math.sin(2 * Math.PI * k / n + 0.4) }));
  const ev = (w) => { let pr = 1, pi = 0, dr = 0, di = 0; for (let i = n - 1; i >= 0; i--) { const ndr = dr * w.re - di * w.im + pr, ndi = dr * w.im + di * w.re + pi; dr = ndr; di = ndi; const npr = pr * w.re - pi * w.im + a[i], npi = pr * w.im + pi * w.re; pr = npr; pi = npi; } return [pr, pi, dr, di]; };
  for (let it = 0; it < 800; it++) {
    let mx = 0;
    for (let k = 0; k < n; k++) {
      const [pr, pi, dr, di] = ev(z[k]); const dd = dr * dr + di * di || 1e-300;
      const rr = (pr * dr + pi * di) / dd, ri = (pi * dr - pr * di) / dd;
      let sr = 0, si = 0;
      for (let j = 0; j < n; j++) if (j !== k) { const xr = z[k].re - z[j].re, xi = z[k].im - z[j].im, m = xr * xr + xi * xi || 1e-300; sr += xr / m; si -= xi / m; }
      const tr = 1 - (rr * sr - ri * si), ti = -(rr * si + ri * sr), tm = tr * tr + ti * ti || 1e-300;
      const wr = (rr * tr + ri * ti) / tm, wi = (ri * tr - rr * ti) / tm;
      z[k] = { re: z[k].re - wr, im: z[k].im - wi };
      mx = Math.max(mx, Math.hypot(wr, wi));
    }
    if (mx < 1e-15 * R) break;
  }
  return z;
}
function polishEig(A, z) {
  if (Math.abs(z.im) < 1e-10 * Math.max(1, Math.abs(z.re))) z = { re: z.re, im: 0 };
  return z;
}

/** eigenvector by inverse iteration (complex arithmetic) */
export function inverseIteration(A, lam) {
  const n = A.length;
  const shift = { re: lam.re + 1e-10 * (1 + Math.abs(lam.re)), im: lam.im };
  // complex matrix B = A - shift I
  const B = A.map((r, i) => r.map((v, j) => ({ re: v - (i === j ? shift.re : 0), im: i === j ? -shift.im : 0 })));
  let x = Array.from({ length: n }, (_, i) => ({ re: 1 / Math.sqrt(n) + 0.01 * i, im: 0 }));
  for (let it = 0; it < 4; it++) {
    const y = cSolve(B, x);
    if (!y) break;
    const nr = Math.sqrt(y.reduce((s, c) => s + c.re * c.re + c.im * c.im, 0));
    x = y.map((c) => ({ re: c.re / nr, im: c.im / nr }));
  }
  // normalise phase: make largest component real positive
  let bi = 0; x.forEach((c, i) => { if (Math.hypot(c.re, c.im) > Math.hypot(x[bi].re, x[bi].im)) bi = i; });
  const ph = Math.atan2(x[bi].im, x[bi].re);
  const cr = Math.cos(-ph), ci = Math.sin(-ph);
  return x.map((c) => ({ re: cleanNum(c.re * cr - c.im * ci), im: cleanNum(c.re * ci + c.im * cr) }));
}
function cSolve(B0, b0) {
  const n = b0.length;
  const Bm = B0.map((r, i) => [...r.map((c) => ({ ...c })), { ...b0[i] }]);
  const mul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
  const dv = (a, b) => { const d = b.re * b.re + b.im * b.im || 1e-300; return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }; };
  for (let c = 0; c < n; c++) {
    let p = c; for (let i = c + 1; i < n; i++) if (Math.hypot(Bm[i][c].re, Bm[i][c].im) > Math.hypot(Bm[p][c].re, Bm[p][c].im)) p = i;
    [Bm[p], Bm[c]] = [Bm[c], Bm[p]];
    if (Math.hypot(Bm[c][c].re, Bm[c][c].im) < 1e-300) Bm[c][c] = { re: 1e-300, im: 0 };
    for (let i = c + 1; i < n; i++) {
      const f = dv(Bm[i][c], Bm[c][c]);
      for (let j = c; j <= n; j++) { const t = mul(f, Bm[c][j]); Bm[i][j] = { re: Bm[i][j].re - t.re, im: Bm[i][j].im - t.im }; }
    }
  }
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = { ...Bm[i][n] };
    for (let j = i + 1; j < n; j++) { const t = mul(Bm[i][j], x[j]); s = { re: s.re - t.re, im: s.im - t.im }; }
    x[i] = dv(s, Bm[i][i]);
  }
  return x;
}

/* ---------- SVD (one-sided Jacobi) ---------- */
export function svd(A0) {
  let A = A0.map((r) => r.slice());
  let transposed = false;
  if (A.length < A[0].length) { A = transpose(A); transposed = true; }
  const m = A.length, n = A[0].length;
  const U = A.map((r) => r.slice());
  const V = eye(n);
  for (let sweep = 0; sweep < 80; sweep++) {
    let rot = 0;
    for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
      let alpha = 0, beta = 0, gamma = 0;
      for (let i = 0; i < m; i++) { alpha += U[i][p] ** 2; beta += U[i][q] ** 2; gamma += U[i][p] * U[i][q]; }
      if (Math.abs(gamma) < 1e-15 * Math.sqrt(alpha * beta) || gamma === 0) continue;
      rot++;
      const zeta = (beta - alpha) / (2 * gamma);
      const t = Math.sign(zeta || 1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
      const c = 1 / Math.sqrt(1 + t * t), s = c * t;
      for (let i = 0; i < m; i++) { const up = U[i][p], uq = U[i][q]; U[i][p] = c * up - s * uq; U[i][q] = s * up + c * uq; }
      for (let i = 0; i < n; i++) { const vp = V[i][p], vq = V[i][q]; V[i][p] = c * vp - s * vq; V[i][q] = s * vp + c * vq; }
    }
    if (!rot) break;
  }
  const sv = []; for (let j = 0; j < n; j++) { let s = 0; for (let i = 0; i < m; i++) s += U[i][j] ** 2; sv.push(Math.sqrt(s)); }
  const order = [...sv.keys()].sort((a, b) => sv[b] - sv[a]);
  const S = order.map((j) => sv[j]);
  const Uo = U.map((r) => order.map((j) => (sv[j] > 1e-300 ? r[j] / sv[j] : 0)));
  const Vo = V.map((r) => order.map((j) => r[j]));
  return transposed ? { U: Vo, S, V: Uo } : { U: Uo, S, V: Vo };
}

export function lstsq(A, b) {
  // via SVD pseudo-inverse (handles rank deficiency)
  const { U, S, V } = svd(A);
  const tol = Math.max(A.length, A[0].length) * (S[0] || 0) * 1e-14;
  const Utb = S.map((_, j) => U.reduce((s, r, i) => s + r[j] * b[i], 0));
  const x = V.map((r) => r.reduce((s, v, j) => s + (S[j] > tol ? v * Utb[j] / S[j] : 0), 0));
  const res = mvec(A, x).map((v, i) => v - b[i]);
  return { x, residual: vnorm(res), rank: S.filter((s) => s > tol).length };
}

export function expm(A) {
  const n = A.length;
  const nrm = Math.max(...A.map((r) => r.reduce((s, v) => s + Math.abs(v), 0)));
  let s = Math.max(0, Math.ceil(Math.log2(nrm || 1)) + 1);
  const As = A.map((r) => r.map((v) => v / 2 ** s));
  // Taylor to 20 terms (scaled norm <= 1/2)
  let term = eye(n), sum = eye(n);
  for (let k = 1; k < 24; k++) { term = mmul(term, As).map((r) => r.map((v) => v / k)); sum = sum.map((r, i) => r.map((v, j) => v + term[i][j])); }
  for (let i = 0; i < s; i++) sum = mmul(sum, sum);
  return sum;
}

/* ---------- exact eigen (rational matrices) ---------- */
export function eigenExact(Aq) {
  const cp = charPolyQ(Aq);
  const pr = polyRoots(cp, 'λ');
  const out = [];
  for (const { expr, mult } of pr.exact) {
    const val = evalComplex(expr);
    let vecs = null;
    if (isNum(expr)) {
      const lam = expr.v;
      const B = Aq.map((r, i) => r.map((v, j) => (i === j ? v.sub(lam) : v)));
      vecs = nullspaceQ(B).map(scaleToIntegers);
    }
    out.push({ expr, value: val, mult, vectors: vecs });
  }
  for (const z of pr.numeric) out.push({ expr: null, value: z, mult: z.mult || 1, vectors: null });
  return { charPoly: cp, charPolyExpr: factorPolyExpr(cp, 'λ').expr, charPolyExpanded: fromPoly(cp, 'λ'), eigen: out };
}
function scaleToIntegers(v) {
  let L = 1n; for (const q of v) { const g = gcdB(L, q.d); L = L / g * q.d; }
  let ints = v.map((q) => q.n * (L / q.d));
  let g = 0n; for (const c of ints) g = gcdB(g, c < 0n ? -c : c);
  if (g > 1n) ints = ints.map((c) => c / g);
  return ints.map((c) => new Q(c));
}
function gcdB(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; }

export function fmtC(z, sig = 10) { return fmtComplex(z, sig); }
