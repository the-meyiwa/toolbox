/* ============================================================
   mathx / stats — descriptive statistics, distributions
   (normal, t, chi², F, binomial, Poisson, gamma, beta, exponential,
   uniform: pdf/pmf, cdf, quantile), hypothesis tests (z, one/two
   sample & paired t, chi-square GOF & independence, one-way ANOVA),
   confidence intervals, correlation (Pearson/Spearman), regression
   (linear, polynomial, exponential, power) with R², combinatorics.
   Pure (no DOM).
   ============================================================ */

import { gammaP, gammaQ, betaI, lgammaFn, erfFn, erfcFn } from './special.js';
import { lstsq } from './linalg.js';

/* ---------------- descriptive ---------------- */
const sum = (a) => a.reduce((s, v) => s + v, 0);
export function quantileSorted(s, p) { // type 7 (NumPy / R default)
  const h = (s.length - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
  return s[lo] + (h - lo) * (s[hi] - s[lo]);
}
export function describe(data) {
  const x = data.filter(Number.isFinite);
  const n = x.length;
  if (!n) throw new Error('No numeric data');
  const s = [...x].sort((a, b) => a - b);
  const mean = sum(x) / n;
  const m2 = sum(x.map((v) => (v - mean) ** 2)), m3 = sum(x.map((v) => (v - mean) ** 3)), m4 = sum(x.map((v) => (v - mean) ** 4));
  const varS = n > 1 ? m2 / (n - 1) : NaN, varP = m2 / n;
  const counts = new Map(); x.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  const maxC = Math.max(...counts.values());
  const modes = maxC > 1 ? [...counts].filter(([, c]) => c === maxC).map(([v]) => v).sort((a, b) => a - b) : [];
  const q1 = quantileSorted(s, 0.25), q3 = quantileSorted(s, 0.75);
  const sdP = Math.sqrt(varP);
  return {
    n, sum: sum(x), mean, median: quantileSorted(s, 0.5), modes, min: s[0], max: s[n - 1], range: s[n - 1] - s[0],
    q1, q3, iqr: q3 - q1, varSample: varS, varPop: varP, sdSample: Math.sqrt(varS), sdPop: sdP,
    sem: Math.sqrt(varS / n), skewness: n > 2 ? (m3 / n) / sdP ** 3 : NaN, kurtosisExcess: n > 3 ? (m4 / n) / (varP ** 2) - 3 : NaN,
    geomMean: x.every((v) => v > 0) ? Math.exp(sum(x.map(Math.log)) / n) : NaN,
  };
}

/* ---------------- distributions ---------------- */
function bisectQuantile(cdf, p, lo, hi) {
  if (p <= 0) return lo; if (p >= 1) return hi;
  // expand
  let a = lo, b = hi;
  if (!Number.isFinite(a)) { a = -1; while (cdf(a) > p) a *= 2; }
  if (!Number.isFinite(b)) { b = 1; while (cdf(b) < p) b *= 2; }
  for (let i = 0; i < 200; i++) { const m = (a + b) / 2; if (cdf(m) < p) a = m; else b = m; if (b - a < 1e-15 * Math.max(1, Math.abs(m))) break; }
  return (a + b) / 2;
}
function normInv(p) {
  // Acklam + Newton refinement
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  let x;
  if (p < 0.02425) { const q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else if (p > 1 - 0.02425) { const q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else { const q = p - 0.5, r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  for (let i = 0; i < 2; i++) { const e = 0.5 * erfcFn(-x / Math.SQRT2) - p; const u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2); x -= u / (1 + x * u / 2); }
  return x;
}
const lchoose = (n, k) => lgammaFn(n + 1) - lgammaFn(k + 1) - lgammaFn(n - k + 1);

export const DISTS = {
  normal: {
    params: ['mu', 'sigma'], defaults: [0, 1], continuous: true, label: (p) => `N(${p[0]}, ${p[1]}²)`,
    pdf: (x, [m, s]) => Math.exp(-(((x - m) / s) ** 2) / 2) / (s * Math.sqrt(2 * Math.PI)),
    cdf: (x, [m, s]) => 0.5 * erfcFn(-(x - m) / (s * Math.SQRT2)),
    quantile: (p, [m, s]) => m + s * normInv(p),
    mean: ([m]) => m, variance: ([, s]) => s * s,
  },
  t: {
    params: ['df'], defaults: [10], continuous: true, label: (p) => `t(${p[0]})`,
    pdf: (x, [v]) => Math.exp(lgammaFn((v + 1) / 2) - lgammaFn(v / 2)) / Math.sqrt(v * Math.PI) * Math.pow(1 + x * x / v, -(v + 1) / 2),
    cdf: (x, [v]) => { const ib = betaI(v / (v + x * x), v / 2, 0.5); return x >= 0 ? 1 - ib / 2 : ib / 2; },
    quantile: (p, par) => bisectQuantile((x) => DISTS.t.cdf(x, par), p, -Infinity, Infinity),
    mean: ([v]) => (v > 1 ? 0 : NaN), variance: ([v]) => (v > 2 ? v / (v - 2) : Infinity),
  },
  chi2: {
    params: ['df'], defaults: [1], continuous: true, label: (p) => `χ²(${p[0]})`,
    pdf: (x, [k]) => (x < 0 ? 0 : Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.LN2 - lgammaFn(k / 2))),
    cdf: (x, [k]) => (x <= 0 ? 0 : gammaP(k / 2, x / 2)),
    quantile: (p, par) => bisectQuantile((x) => DISTS.chi2.cdf(x, par), p, 0, Infinity),
    mean: ([k]) => k, variance: ([k]) => 2 * k,
  },
  f: {
    params: ['d1', 'd2'], defaults: [5, 10], continuous: true, label: (p) => `F(${p[0]}, ${p[1]})`,
    pdf: (x, [a, b]) => (x <= 0 ? 0 : Math.exp(0.5 * (a * Math.log(a * x) + b * Math.log(b) - (a + b) * Math.log(a * x + b)) - Math.log(x) - (lgammaFn(a / 2) + lgammaFn(b / 2) - lgammaFn((a + b) / 2)))),
    cdf: (x, [a, b]) => (x <= 0 ? 0 : betaI(a * x / (a * x + b), a / 2, b / 2)),
    quantile: (p, par) => bisectQuantile((x) => DISTS.f.cdf(x, par), p, 0, Infinity),
    mean: ([, b]) => (b > 2 ? b / (b - 2) : NaN), variance: ([a, b]) => (b > 4 ? 2 * b * b * (a + b - 2) / (a * (b - 2) ** 2 * (b - 4)) : NaN),
  },
  exponential: {
    params: ['lambda'], defaults: [1], continuous: true, label: (p) => `Exp(${p[0]})`,
    pdf: (x, [l]) => (x < 0 ? 0 : l * Math.exp(-l * x)), cdf: (x, [l]) => (x < 0 ? 0 : 1 - Math.exp(-l * x)),
    quantile: (p, [l]) => -Math.log(1 - p) / l, mean: ([l]) => 1 / l, variance: ([l]) => 1 / (l * l),
  },
  gamma: {
    params: ['k', 'theta'], defaults: [2, 1], continuous: true, label: (p) => `Gamma(k=${p[0]}, θ=${p[1]})`,
    pdf: (x, [k, t]) => (x < 0 ? 0 : Math.exp((k - 1) * Math.log(x) - x / t - lgammaFn(k) - k * Math.log(t))),
    cdf: (x, [k, t]) => (x <= 0 ? 0 : gammaP(k, x / t)),
    quantile: (p, par) => bisectQuantile((x) => DISTS.gamma.cdf(x, par), p, 0, Infinity),
    mean: ([k, t]) => k * t, variance: ([k, t]) => k * t * t,
  },
  beta: {
    params: ['a', 'b'], defaults: [2, 5], continuous: true, label: (p) => `Beta(${p[0]}, ${p[1]})`,
    pdf: (x, [a, b]) => (x < 0 || x > 1 ? 0 : Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - (lgammaFn(a) + lgammaFn(b) - lgammaFn(a + b)))),
    cdf: (x, [a, b]) => betaI(x, a, b),
    quantile: (p, par) => bisectQuantile((x) => DISTS.beta.cdf(x, par), p, 0, 1),
    mean: ([a, b]) => a / (a + b), variance: ([a, b]) => a * b / ((a + b) ** 2 * (a + b + 1)),
  },
  uniform: {
    params: ['a', 'b'], defaults: [0, 1], continuous: true, label: (p) => `U(${p[0]}, ${p[1]})`,
    pdf: (x, [a, b]) => (x < a || x > b ? 0 : 1 / (b - a)), cdf: (x, [a, b]) => Math.min(1, Math.max(0, (x - a) / (b - a))),
    quantile: (p, [a, b]) => a + p * (b - a), mean: ([a, b]) => (a + b) / 2, variance: ([a, b]) => (b - a) ** 2 / 12,
  },
  binomial: {
    params: ['n', 'p'], defaults: [10, 0.5], continuous: false, label: (p) => `Bin(${p[0]}, ${p[1]})`,
    pdf: (k, [n, p]) => (k < 0 || k > n || !Number.isInteger(k) ? 0 : Math.exp(lchoose(n, k) + k * Math.log(p) + (n - k) * Math.log1p(-p))),
    cdf: (k, [n, p]) => (k < 0 ? 0 : k >= n ? 1 : betaI(1 - p, n - Math.floor(k), Math.floor(k) + 1)),
    quantile: (q, par) => { let k = 0; while (DISTS.binomial.cdf(k, par) < q - 1e-14 && k < par[0]) k++; return k; },
    mean: ([n, p]) => n * p, variance: ([n, p]) => n * p * (1 - p),
  },
  poisson: {
    params: ['lambda'], defaults: [3], continuous: false, label: (p) => `Poisson(${p[0]})`,
    pdf: (k, [l]) => (k < 0 || !Number.isInteger(k) ? 0 : Math.exp(k * Math.log(l) - l - lgammaFn(k + 1))),
    cdf: (k, [l]) => (k < 0 ? 0 : gammaQ(Math.floor(k) + 1, l)),
    quantile: (q, par) => { let k = 0; while (DISTS.poisson.cdf(k, par) < q - 1e-14 && k < 1e7) k++; return k; },
    mean: ([l]) => l, variance: ([l]) => l,
  },
};
export const DIST_ALIASES = { norm: 'normal', gaussian: 'normal', n: 'normal', student: 't', studentt: 't', chisq: 'chi2', chisquare: 'chi2', 'chi-square': 'chi2', 'chi²': 'chi2', exp: 'exponential', expon: 'exponential', binom: 'binomial', pois: 'poisson', unif: 'uniform', fisher: 'f' };

export function distribution(name, params) {
  const key = DIST_ALIASES[name.toLowerCase()] || name.toLowerCase();
  const d = DISTS[key];
  if (!d) throw new Error(`Unknown distribution "${name}". Known: ${Object.keys(DISTS).join(', ')}`);
  const p = d.defaults.map((v, i) => (params[i] !== undefined ? params[i] : v));
  return { key, d, p };
}

/* ---------------- tests ---------------- */
const tcdf = (t, df) => DISTS.t.cdf(t, [df]);
function pTwo(t, df) { return 2 * (1 - tcdf(Math.abs(t), df)); }
const zcdf = (z) => DISTS.normal.cdf(z, [0, 1]);

export function ttest1(x, mu0 = 0) {
  const d = describe(x);
  const t = (d.mean - mu0) / d.sem, df = d.n - 1;
  const crit = DISTS.t.quantile(0.975, [df]);
  return { test: 'one-sample t-test', n: d.n, mean: d.mean, sd: d.sdSample, t, df, p: pTwo(t, df), ci: [d.mean - crit * d.sem, d.mean + crit * d.sem], mu0 };
}
export function ttest2(x, y, { equalVar = false } = {}) {
  const a = describe(x), b = describe(y);
  let t, df, se;
  if (equalVar) {
    const sp2 = ((a.n - 1) * a.varSample + (b.n - 1) * b.varSample) / (a.n + b.n - 2);
    se = Math.sqrt(sp2 * (1 / a.n + 1 / b.n)); df = a.n + b.n - 2;
  } else {
    const va = a.varSample / a.n, vb = b.varSample / b.n;
    se = Math.sqrt(va + vb); df = (va + vb) ** 2 / (va * va / (a.n - 1) + vb * vb / (b.n - 1));
  }
  t = (a.mean - b.mean) / se;
  const crit = DISTS.t.quantile(0.975, [df]);
  const diff = a.mean - b.mean;
  return { test: equalVar ? 'two-sample t-test (pooled)' : "Welch's two-sample t-test", n1: a.n, n2: b.n, mean1: a.mean, mean2: b.mean, t, df, p: pTwo(t, df), ci: [diff - crit * se, diff + crit * se] };
}
export function ttestPaired(x, y) {
  if (x.length !== y.length) throw new Error('Paired t-test needs equal-length samples');
  const r = ttest1(x.map((v, i) => v - y[i]), 0);
  return { ...r, test: 'paired t-test (on differences)' };
}
export function ztest(x, mu0, sigma) {
  const d = describe(x);
  const se = sigma / Math.sqrt(d.n), z = (d.mean - mu0) / se;
  return { test: 'one-sample z-test', n: d.n, mean: d.mean, z, p: 2 * (1 - zcdf(Math.abs(z))), ci: [d.mean - 1.959963984540054 * se, d.mean + 1.959963984540054 * se] };
}
export function chisqGOF(obs, exp = null) {
  const n = sum(obs);
  const e = exp ? (Math.abs(sum(exp) - n) > 1e-9 && sum(exp) <= 1.0000001 ? exp.map((p) => p * n) : exp) : obs.map(() => n / obs.length);
  const chi = sum(obs.map((o, i) => (o - e[i]) ** 2 / e[i]));
  const df = obs.length - 1;
  return { test: 'chi-square goodness of fit', chi2: chi, df, p: 1 - DISTS.chi2.cdf(chi, [df]), expected: e };
}
export function chisqIndependence(table) {
  const r = table.length, c = table[0].length;
  const rs = table.map(sum), cs = table[0].map((_, j) => sum(table.map((row) => row[j]))), n = sum(rs);
  const e = table.map((row, i) => row.map((_, j) => rs[i] * cs[j] / n));
  const chi = sum(table.map((row, i) => sum(row.map((o, j) => (o - e[i][j]) ** 2 / e[i][j]))));
  const df = (r - 1) * (c - 1);
  return { test: 'chi-square test of independence', chi2: chi, df, p: 1 - DISTS.chi2.cdf(chi, [df]), expected: e, cramersV: Math.sqrt(chi / (n * Math.min(r - 1, c - 1))) };
}
export function anova1(groups) {
  const all = groups.flat(); const N = all.length, k = groups.length;
  const gm = sum(all) / N;
  const ssb = sum(groups.map((g) => g.length * (sum(g) / g.length - gm) ** 2));
  const ssw = sum(groups.map((g) => { const m = sum(g) / g.length; return sum(g.map((v) => (v - m) ** 2)); }));
  const dfb = k - 1, dfw = N - k;
  const F = (ssb / dfb) / (ssw / dfw);
  return { test: 'one-way ANOVA', F, dfb, dfw, ssb, ssw, msb: ssb / dfb, msw: ssw / dfw, p: 1 - DISTS.f.cdf(F, [dfb, dfw]), etaSq: ssb / (ssb + ssw) };
}
export function ciMean(x, level = 0.95) {
  const d = describe(x); const crit = DISTS.t.quantile(1 - (1 - level) / 2, [d.n - 1]);
  return { level, mean: d.mean, lo: d.mean - crit * d.sem, hi: d.mean + crit * d.sem, crit, sem: d.sem, df: d.n - 1 };
}
export function ciProportion(k, n, level = 0.95) {
  const z = normInv(1 - (1 - level) / 2), p = k / n;
  const den = 1 + z * z / n, centre = (p + z * z / (2 * n)) / den, half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den;
  return { level, p, lo: centre - half, hi: centre + half, method: 'Wilson score interval' };
}

/* ---------------- correlation & regression ---------------- */
export function pearson(x, y) {
  const n = x.length; const mx = sum(x) / n, my = sum(y) / n;
  let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  const r = sxy / Math.sqrt(sxx * syy);
  const t = r * Math.sqrt((n - 2) / (1 - r * r));
  return { r, t, df: n - 2, p: pTwo(t, n - 2) };
}
function ranks(a) {
  const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
  const r = new Array(a.length);
  for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const avg = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = avg; i = j + 1; }
  return r;
}
export function spearman(x, y) { const r = pearson(ranks(x), ranks(y)); return { ...r, rho: r.r }; }

export function regress(x, y, kind = 'linear', degree = 2) {
  const n = x.length;
  if (n !== y.length || n < 2) throw new Error('x and y must have the same length (≥ 2)');
  let design, yy = y, back, labels;
  if (kind === 'linear') { design = x.map((v) => [1, v]); labels = ['b0', 'b1']; }
  else if (kind === 'poly') { design = x.map((v) => Array.from({ length: degree + 1 }, (_, k) => v ** k)); labels = Array.from({ length: degree + 1 }, (_, k) => `b${k}`); }
  else if (kind === 'exp') { if (y.some((v) => v <= 0)) throw new Error('Exponential fit needs y > 0'); design = x.map((v) => [1, v]); yy = y.map(Math.log); labels = ['ln a', 'b']; }
  else if (kind === 'power') { if (y.some((v) => v <= 0) || x.some((v) => v <= 0)) throw new Error('Power fit needs x, y > 0'); design = x.map((v) => [1, Math.log(v)]); yy = y.map(Math.log); labels = ['ln a', 'b']; }
  else throw new Error('Unknown regression kind');
  const { x: beta } = lstsq(design, yy);
  let predict;
  if (kind === 'exp') { const a = Math.exp(beta[0]), b = beta[1]; predict = (v) => a * Math.exp(b * v); back = { a, b }; }
  else if (kind === 'power') { const a = Math.exp(beta[0]), b = beta[1]; predict = (v) => a * v ** b; back = { a, b }; }
  else predict = (v) => beta.reduce((s, c, k) => s + c * v ** k, 0);
  const my = sum(y) / n;
  const ssr = sum(y.map((v, i) => (v - predict(x[i])) ** 2)), sst = sum(y.map((v) => (v - my) ** 2));
  const p = beta.length;
  const r2 = 1 - ssr / sst;
  return { kind, beta, back, labels, r2, adjR2: 1 - (1 - r2) * (n - 1) / (n - p), rmse: Math.sqrt(ssr / n), predict, n };
}

/* ---------------- combinatorics (BigInt exact) ---------------- */
export function bfact(n) { let r = 1n; for (let k = 2n; k <= BigInt(n); k++) r *= k; return r; }
export function bchoose(n, k) { n = BigInt(n); k = BigInt(k); if (k < 0n || k > n) return 0n; if (k > n - k) k = n - k; let r = 1n; for (let i = 0n; i < k; i++) r = r * (n - i) / (i + 1n); return r; }
export function bperm(n, k) { n = BigInt(n); k = BigInt(k); if (k < 0n || k > n) return 0n; let r = 1n; for (let i = 0n; i < k; i++) r *= n - i; return r; }
export function catalan(n) { return bchoose(2 * n, n) / BigInt(n + 1); }
export function stirling2(n, k) {
  const S = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(0n)); S[0][0] = 1n;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= Math.min(i, k); j++) S[i][j] = BigInt(j) * S[i - 1][j] + S[i - 1][j - 1];
  return S[n][k];
}
export function bell(n) { let s = 0n; for (let k = 0; k <= n; k++) s += stirling2(n, k); return s; }
export function derangements(n) { let a = 1n, b = 0n; if (n === 0) return 1n; for (let i = 2; i <= n; i++) { const c = BigInt(i - 1) * (a + b); a = b; b = c; } return b; }
export function partitions(n) {
  const p = new Array(n + 1).fill(0n); p[0] = 1n;
  for (let i = 1; i <= n; i++) {
    let s = 0n;
    for (let k = 1; ; k++) {
      const g1 = k * (3 * k - 1) / 2, g2 = k * (3 * k + 1) / 2;
      if (g1 > i) break;
      const sg = k % 2 ? 1n : -1n;
      s += sg * p[i - g1]; if (g2 <= i) s += sg * p[i - g2];
    }
    p[i] = s;
  }
  return p[n];
}
export function multinomial(ks) { const n = ks.reduce((a, b) => a + b, 0); let r = bfact(n); for (const k of ks) r /= bfact(k); return r; }
