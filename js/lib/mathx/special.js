/* ============================================================
   mathx / special — complex arithmetic, special functions
   (gamma, beta, erf, zeta, Bessel J, digamma, Lambert W,
   incomplete gamma/beta) and arbitrary-precision constants.
   Pure (no DOM).
   ============================================================ */

/* ---------------- complex ---------------- */
export const cx = {
  of: (re, im = 0) => ({ re, im }),
  add: (a, b) => ({ re: a.re + b.re, im: a.im + b.im }),
  sub: (a, b) => ({ re: a.re - b.re, im: a.im - b.im }),
  mul: (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }),
  div: (a, b) => {
    const d = b.re * b.re + b.im * b.im;
    return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
  },
  abs: (a) => ({ re: Math.hypot(a.re, a.im), im: 0 }),
  mag: (a) => Math.hypot(a.re, a.im),
  arg: (a) => ({ re: Math.atan2(a.im, a.re), im: 0 }),
  conj: (a) => ({ re: a.re, im: -a.im }),
  re: (a) => ({ re: a.re, im: 0 }),
  im: (a) => ({ re: a.im, im: 0 }),
  exp: (a) => { const m = Math.exp(a.re); return { re: m * Math.cos(a.im), im: m * Math.sin(a.im) }; },
  log: (a) => ({ re: Math.log(Math.hypot(a.re, a.im)), im: Math.atan2(a.im, a.re) }),
  powi: (a, n) => {
    if (n < 0) return cx.div({ re: 1, im: 0 }, cx.powi(a, -n));
    let r = { re: 1, im: 0 }, b = a;
    while (n) { if (n & 1) r = cx.mul(r, b); b = cx.mul(b, b); n >>= 1; }
    return r;
  },
  pow: (a, b) => {
    if (a.re === 0 && a.im === 0) return (b.re > 0) ? { re: 0, im: 0 } : { re: NaN, im: NaN };
    if (b.im === 0 && a.im === 0 && a.re > 0) return { re: Math.pow(a.re, b.re), im: 0 };
    return cx.exp(cx.mul(b, cx.log(a)));
  },
  sqrt: (a) => cx.pow(a, { re: 0.5, im: 0 }),
  sin: (a) => ({ re: Math.sin(a.re) * Math.cosh(a.im), im: Math.cos(a.re) * Math.sinh(a.im) }),
  cos: (a) => ({ re: Math.cos(a.re) * Math.cosh(a.im), im: -Math.sin(a.re) * Math.sinh(a.im) }),
  tan: (a) => cx.div(cx.sin(a), cx.cos(a)),
  sinh: (a) => ({ re: Math.sinh(a.re) * Math.cos(a.im), im: Math.cosh(a.re) * Math.sin(a.im) }),
  cosh: (a) => ({ re: Math.cosh(a.re) * Math.cos(a.im), im: Math.sinh(a.re) * Math.sin(a.im) }),
  tanh: (a) => cx.div(cx.sinh(a), cx.cosh(a)),
  asin: (a) => { // -i log(iz + sqrt(1-z^2))
    const iz = { re: -a.im, im: a.re };
    const r = cx.log(cx.add(iz, cx.sqrt(cx.sub({ re: 1, im: 0 }, cx.mul(a, a)))));
    return { re: r.im, im: -r.re };
  },
  acos: (a) => cx.sub({ re: Math.PI / 2, im: 0 }, cx.asin(a)),
  atan: (a) => { // i/2 (log(1-iz) - log(1+iz))
    const iz = { re: -a.im, im: a.re };
    const d = cx.sub(cx.log(cx.sub({ re: 1, im: 0 }, iz)), cx.log(cx.add({ re: 1, im: 0 }, iz)));
    return { re: -d.im / 2, im: d.re / 2 };
  },
};

/* ---------------- gamma family ---------------- */
const LG = 7;
const LC = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

export function gammaFn(x) {
  if (Number.isInteger(x) && x <= 0) return NaN;
  if (Number.isInteger(x) && x > 0 && x < 171) { let r = 1; for (let k = 2; k < x; k++) r *= k; return r; }
  if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gammaFn(1 - x));
  if (x > 171.6) return Infinity;
  x -= 1;
  let a = LC[0];
  const t = x + LG + 0.5;
  for (let i = 1; i < LG + 2; i++) a += LC[i] / (x + i);
  return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * a;
}
export function lgammaFn(x) {
  if (x <= 0 && Number.isInteger(x)) return Infinity;
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgammaFn(1 - x);
  x -= 1;
  let a = LC[0];
  const t = x + LG + 0.5;
  for (let i = 1; i < LG + 2; i++) a += LC[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
export function betaFn(a, b) { return Math.exp(lgammaFn(a) + lgammaFn(b) - lgammaFn(a + b)); }
export function digammaFn(x) {
  let r = 0;
  if (x <= 0 && Number.isInteger(x)) return NaN;
  if (x < 0) return digammaFn(1 - x) - Math.PI / Math.tan(Math.PI * x);
  while (x < 6) { r -= 1 / x; x += 1; }
  const f = 1 / (x * x);
  return r + Math.log(x) - 0.5 / x - f * (1 / 12 - f * (1 / 120 - f * (1 / 252 - f * (1 / 240 - f / 132))));
}

/** regularized lower incomplete gamma P(a,x) */
export function gammaP(a, x) {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let sum = 1 / a, term = sum, ap = a;
    for (let n = 0; n < 1000; n++) { ap += 1; term *= x / ap; sum += term; if (Math.abs(term) < Math.abs(sum) * 1e-16) break; }
    return sum * Math.exp(-x + a * Math.log(x) - lgammaFn(a));
  }
  return 1 - gammaQcf(a, x);
}
function gammaQcf(a, x) {
  const FPMIN = 1e-300;
  let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a); b += 2;
    d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return Math.exp(-x + a * Math.log(x) - lgammaFn(a)) * h;
}
export function gammaQ(a, x) { return x <= 0 ? 1 : (x < a + 1 ? 1 - gammaP(a, x) : gammaQcf(a, x)); }

/** regularized incomplete beta I_x(a,b) */
export function betaI(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgammaFn(a + b) - lgammaFn(a) - lgammaFn(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return bt * betacf(x, a, b) / a;
  return 1 - bt * betacf(1 - x, b, a) / b;
}
function betacf(x, a, b) {
  const FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d; let h = d;
  for (let m = 1; m <= 1000; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return h;
}

export function erfFn(x) {
  if (x === 0) return 0;
  if (!Number.isFinite(x)) return Math.sign(x);
  const s = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  if (ax < 3) {
    // Maclaurin series (accurate to ~1e-16 for |x|<3)
    let sum = ax, term = ax;
    for (let n = 1; n < 200; n++) {
      term *= -ax * ax / n;
      const add = term / (2 * n + 1);
      sum += add;
      if (Math.abs(add) < 1e-17 * Math.abs(sum)) break;
    }
    return s * sum * 2 / Math.sqrt(Math.PI);
  }
  return s * (1 - erfcFn(ax));
}
export function erfcFn(x) {
  if (x < 3) return 1 - erfFn(x);
  // continued fraction (Lentz) for erfc
  const FPMIN = 1e-300;
  // erfc(x) = exp(-x^2)/sqrt(pi) * 1/(x + 1/2/(x + 1/(x + 3/2/(x + ...))))
  let f = x, C = x, D = 0;
  for (let n = 1; n < 500; n++) {
    const an = n / 2;
    D = x + an * D; if (Math.abs(D) < FPMIN) D = FPMIN;
    C = x + an / C; if (Math.abs(C) < FPMIN) C = FPMIN;
    D = 1 / D; const del = C * D; f *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return Math.exp(-x * x) / Math.sqrt(Math.PI) / f;
}

/** Riemann zeta at real s (s != 1) */
export function zetaFn(s) {
  if (s === 1) return Infinity;
  if (s < 0.5) {
    // functional equation
    if (Number.isInteger(s) && s < 0 && s % 2 === 0) return 0;
    return Math.pow(2, s) * Math.pow(Math.PI, s - 1) * Math.sin(Math.PI * s / 2) * gammaFn(1 - s) * zetaFn(1 - s);
  }
  // Borwein algorithm 2 (alternating eta series acceleration)
  const n = 40;
  const d = new Array(n + 1);
  let sum = 0;
  // d_k = n * sum_{i=0}^{k} (n+i-1)! 4^i / ((n-i)! (2i)!)
  let term = 1 / n; // i=0: (n-1)!/(n!0!) = 1/n
  sum = term; d[0] = n * sum;
  for (let i = 1; i <= n; i++) {
    term *= (n + i - 1) * (n - i + 1) * 4 / ((2 * i - 1) * (2 * i));
    sum += term; d[i] = n * sum;
  }
  let eta = 0;
  for (let k = 0; k < n; k++) eta += (k % 2 ? -1 : 1) * (d[k] - d[n]) / Math.pow(k + 1, s);
  eta = -eta / d[n];
  return eta / (1 - Math.pow(2, 1 - s));
}

/** Bessel J_n(x), integer n, via trapezoid on Bessel's integral (spectrally accurate). */
export function besselJ(n, x) {
  if (!Number.isInteger(n)) {
    // series for non-integer order (moderate x)
    let sum = 0;
    for (let m = 0; m < 200; m++) {
      const t = Math.pow(-1, m) * Math.exp((2 * m + n) * Math.log(Math.abs(x) / 2) - lgammaFn(m + 1) - lgammaFn(m + n + 1));
      sum += t; if (Math.abs(t) < 1e-17 * Math.abs(sum) && m > 5) break;
    }
    return sum;
  }
  const N = Math.max(64, Math.ceil(Math.abs(x)) * 2 + 2 * Math.abs(n) + 40);
  let s = 0;
  for (let k = 0; k <= N; k++) {
    const tau = Math.PI * k / N;
    const w = (k === 0 || k === N) ? 0.5 : 1;
    s += w * Math.cos(n * tau - x * Math.sin(tau));
  }
  return s / N;
}

export function lambertW(x) {
  if (x < -1 / Math.E) return NaN;
  let w = x < 1 ? 0 : Math.log(x) - Math.log(Math.log(x) + 1e-300 + 1);
  if (x === 0) return 0;
  for (let i = 0; i < 100; i++) {
    const ew = Math.exp(w);
    const f = w * ew - x;
    const wn = w - f / (ew * (w + 1) - (w + 2) * f / (2 * w + 2));
    if (Math.abs(wn - w) < 1e-15 * (1 + Math.abs(wn))) return wn;
    w = wn;
  }
  return w;
}

/* ---------------- arbitrary-precision constants ---------------- */

function arctanInv(x, unity) { // arctan(1/x) * unity
  x = BigInt(x);
  let sum = 0n, term = unity / x, n = 1n, sign = 1n;
  const x2 = x * x;
  while (term !== 0n) { sum += sign * (term / n); term /= x2; n += 2n; sign = -sign; }
  return sum;
}
/** Returns constant as a string with `digits` decimals (truncated, guard digits used). */
export function constantDigits(name, digits = 100) {
  digits = Math.max(1, Math.min(10000, Math.floor(digits)));
  const guard = 12n;
  const unity = 10n ** (BigInt(digits) + guard);
  let v;
  switch (name) {
    case 'pi': v = 4n * (4n * arctanInv(5, unity) - arctanInv(239, unity)); break;
    case 'e': {
      let sum = 0n, term = unity, k = 1n;
      while (term) { sum += term; term /= k; k++; }
      v = sum; break;
    }
    case 'sqrt2': case 'sqrt3': case 'sqrt5': {
      const n = BigInt(name.slice(4));
      v = bigSqrt(n * unity * unity); break;
    }
    case 'phi': v = (unity + bigSqrt(5n * unity * unity)) / 2n; break;
    case 'ln2': {
      // ln2 = 2 atanh(1/3)
      let sum = 0n, term = unity / 3n, n = 1n;
      while (term) { sum += term / n; term /= 9n; n += 2n; }
      v = 2n * sum; break;
    }
    default: throw new Error(`Unknown constant "${name}" (try pi, e, sqrt2, phi, ln2)`);
  }
  const s = v.toString();
  const intLen = s.length - Number(BigInt(digits) + guard);
  return (intLen > 0 ? s.slice(0, intLen) : '0') + '.' + (intLen < 0 ? '0'.repeat(-intLen) : '') + s.slice(Math.max(0, intLen), Math.max(0, intLen) + digits);
}
function bigSqrt(n) {
  if (n < 2n) return n;
  let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
  for (;;) { const y = (x + n / x) >> 1n; if (y >= x) return x; x = y; }
}
