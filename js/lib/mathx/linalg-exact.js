/* ============================================================
   mathx / linalg-exact — exact rational (BigInt) linear algebra:
   RREF, rank, determinant (Bareiss-style via elimination), inverse,
   null space, exact solve (unique / parametric / inconsistent),
   characteristic polynomial (Faddeev–LeVerrier). Pure.
   ============================================================ */

import { Q, Q0, Q1 } from './rational.js';

export const qm = (A) => A.map((r) => r.map((v) => Q.of(v)));
const clone = (A) => A.map((r) => r.slice());

/** RREF with steps. Returns {R, pivots, rank, steps, swaps, detFactor} */
export function rrefQ(A0, { record = false } = {}) {
  const A = clone(A0);
  const m = A.length, n = m ? A[0].length : 0;
  const pivots = [];
  const steps = [];
  let r = 0;
  for (let c = 0; c < n && r < m; c++) {
    let p = -1;
    for (let i = r; i < m; i++) if (!A[i][c].isZero) { p = i; break; }
    if (p < 0) continue;
    if (p !== r) { [A[p], A[r]] = [A[r], A[p]]; if (record) steps.push({ op: `R${r + 1} ↔ R${p + 1}`, M: clone(A) }); }
    const pv = A[r][c];
    if (!pv.isOne) { A[r] = A[r].map((v) => v.div(pv)); if (record) steps.push({ op: `R${r + 1} → R${r + 1} / (${pv})`, M: clone(A) }); }
    for (let i = 0; i < m; i++) {
      if (i === r || A[i][c].isZero) continue;
      const f = A[i][c];
      A[i] = A[i].map((v, j) => v.sub(f.mul(A[r][j])));
      if (record) steps.push({ op: `R${i + 1} → R${i + 1} − (${f})·R${r + 1}`, M: clone(A) });
    }
    pivots.push(c);
    r++;
  }
  return { R: A, pivots, rank: pivots.length, steps };
}

export function detQ(A0) {
  const A = clone(A0);
  const n = A.length;
  if (!n || A.some((r) => r.length !== n)) throw new Error('Determinant needs a square matrix');
  let det = Q1;
  for (let c = 0; c < n; c++) {
    let p = -1;
    for (let i = c; i < n; i++) if (!A[i][c].isZero) { p = i; break; }
    if (p < 0) return Q0;
    if (p !== c) { [A[p], A[c]] = [A[c], A[p]]; det = det.neg(); }
    det = det.mul(A[c][c]);
    for (let i = c + 1; i < n; i++) {
      if (A[i][c].isZero) continue;
      const f = A[i][c].div(A[c][c]);
      for (let j = c; j < n; j++) A[i][j] = A[i][j].sub(f.mul(A[c][j]));
    }
  }
  return det;
}

export function inverseQ(A) {
  const n = A.length;
  if (A.some((r) => r.length !== n)) throw new Error('Inverse needs a square matrix');
  const aug = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? Q1 : Q0))]);
  const { R, rank, pivots } = rrefQ(aug);
  if (rank < n || pivots[n - 1] !== n - 1) return null;
  return R.map((r) => r.slice(n));
}

export function matmulQ(A, B) {
  return A.map((r) => B[0].map((_, j) => r.reduce((s, v, k) => s.add(v.mul(B[k][j])), Q0)));
}

export function nullspaceQ(A) {
  const { R, pivots } = rrefQ(A);
  const n = A[0].length;
  const free = [];
  for (let j = 0; j < n; j++) if (!pivots.includes(j)) free.push(j);
  return free.map((f) => {
    const v = new Array(n).fill(Q0);
    v[f] = Q1;
    pivots.forEach((pc, i) => { v[pc] = R[i][f].neg(); });
    return v;
  });
}

/** Solve A x = b exactly. Returns x (unique) or null if singular/inconsistent. */
export function solveLinearQ(A, b) {
  const res = solveSystemQ(A, b);
  return res.kind === 'unique' ? res.x : null;
}

/** Full classification: unique / infinite (particular + null basis) / none */
export function solveSystemQ(A, b, { record = false } = {}) {
  const m = A.length, n = A[0].length;
  const aug = A.map((r, i) => [...r, b[i]]);
  const { R, pivots, rank, steps } = rrefQ(aug, { record });
  if (pivots.includes(n)) return { kind: 'none', R, steps, rank };
  const x = new Array(n).fill(Q0);
  pivots.forEach((pc, i) => { x[pc] = R[i][n]; });
  if (rank === n) return { kind: 'unique', x, R, steps, rank };
  const nulls = nullspaceQ(A);
  return { kind: 'infinite', x, nulls, R, steps, rank, free: n - rank };
}

/** characteristic polynomial coefficients c[0..n] of det(λI - A) (index = degree) */
export function charPolyQ(A) {
  const n = A.length;
  // Faddeev–LeVerrier
  let Mk = A.map((r) => r.map(() => Q0));
  const I = A.map((r, i) => r.map((_, j) => (i === j ? Q1 : Q0)));
  const c = new Array(n + 1).fill(Q0);
  c[n] = Q1;
  for (let k = 1; k <= n; k++) {
    // M_k = A M_{k-1} + c_{n-k+1} I
    const AM = matmulQ(A, Mk);
    Mk = AM.map((r, i) => r.map((v, j) => v.add(i === j ? c[n - k + 1] : Q0)));
    const AMk = matmulQ(A, Mk);
    let tr = Q0; for (let i = 0; i < n; i++) tr = tr.add(AMk[i][i]);
    c[n - k] = tr.neg().div(new Q(BigInt(k)));
  }
  return c;
}
