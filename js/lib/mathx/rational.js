/* ============================================================
   mathx / rational — exact BigInt integer + rational arithmetic.
   Pure (no DOM). Used by the CAS, exact linear algebra and the
   number-theory module.
   ============================================================ */

export const B0 = 0n;
export const B1 = 1n;

export function babs(a) { return a < 0n ? -a : a; }

export function bgcd(a, b) {
  a = babs(a); b = babs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

export function blcm(a, b) {
  if (!a || !b) return 0n;
  return babs(a / bgcd(a, b) * b);
}

/** floor(sqrt(n)) for n >= 0 */
export function isqrt(n) {
  if (n < 0n) throw new Error('isqrt of negative');
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  if (x === 0n) x = 1n;
  // Newton refinement (handles huge n where the float guess is off)
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) {
      // make sure x is floor sqrt
      while (x * x > n) x -= 1n;
      while ((x + 1n) * (x + 1n) <= n) x += 1n;
      return x;
    }
    x = y;
  }
}

/** integer k-th root floor for n >= 0 */
export function iroot(n, k) {
  if (n < 0n) throw new Error('iroot of negative');
  if (n < 2n || k === 1) return n;
  const K = BigInt(k);
  let x = BigInt(Math.floor(Math.pow(Number(n), 1 / k)));
  if (x < 1n) x = 1n;
  // Newton iterations
  for (let it = 0; it < 200; it++) {
    const y = ((K - 1n) * x + n / (x ** (K - 1n))) / K;
    if (y === x || y === x + 1n || y + 1n === x) { x = y < x ? y : x; break; }
    x = y;
  }
  while (x ** K > n) x -= 1n;
  while ((x + 1n) ** K <= n) x += 1n;
  return x;
}

export function bpow(b, e) {
  let r = 1n;
  while (e > 0n) { if (e & 1n) r *= b; b *= b; e >>= 1n; }
  return r;
}

/* ---------------- Rational Q ---------------- */

export class Q {
  constructor(n, d = 1n) {
    n = BigInt(n); d = BigInt(d);
    if (d === 0n) throw new Error('Division by zero');
    if (d < 0n) { n = -n; d = -d; }
    const g = bgcd(n, d);
    if (g > 1n) { n /= g; d /= g; }
    this.n = n; this.d = d;
  }
  static of(x) {
    if (x instanceof Q) return x;
    if (typeof x === 'bigint') return new Q(x, 1n);
    if (typeof x === 'number') return Q.fromNumber(x);
    if (typeof x === 'string') return Q.parse(x);
    throw new Error('Cannot convert to rational');
  }
  static parse(s) {
    s = String(s).trim();
    const fm = s.match(/^([+-]?\d+)\s*\/\s*([+-]?\d+)$/);
    if (fm) return new Q(BigInt(fm[1]), BigInt(fm[2]));
    const m = s.match(/^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
    if (!m || (m[2] === '' && (m[3] === undefined || m[3] === ''))) throw new Error(`Not a number: ${s}`);
    const sign = m[1] === '-' ? -1n : 1n;
    const intPart = m[2] || '0';
    const frac = m[3] || '';
    let n = BigInt(intPart + frac) * sign;
    let d = 10n ** BigInt(frac.length);
    if (m[4]) {
      const e = parseInt(m[4], 10);
      if (e >= 0) n *= 10n ** BigInt(e); else d *= 10n ** BigInt(-e);
    }
    return new Q(n, d);
  }
  static fromNumber(x) {
    if (!Number.isFinite(x)) throw new Error('Non-finite number');
    if (Number.isInteger(x)) return new Q(BigInt(x), 1n);
    // exact binary expansion is ugly; use shortest decimal representation
    return Q.parse(String(x));
  }
  get isInt() { return this.d === 1n; }
  get isZero() { return this.n === 0n; }
  get isOne() { return this.n === 1n && this.d === 1n; }
  get sign() { return this.n > 0n ? 1 : this.n < 0n ? -1 : 0; }
  add(o) { o = Q.of(o); return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { o = Q.of(o); return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { o = Q.of(o); return new Q(this.n * o.n, this.d * o.d); }
  div(o) { o = Q.of(o); if (o.n === 0n) throw new Error('Division by zero'); return new Q(this.n * o.d, this.d * o.n); }
  neg() { return new Q(-this.n, this.d); }
  abs() { return new Q(babs(this.n), this.d); }
  inv() { return new Q(this.d, this.n); }
  pow(k) {
    k = BigInt(k);
    if (k === 0n) return new Q(1n);
    if (k < 0n) return this.inv().pow(-k);
    return new Q(bpow(this.n, k), bpow(this.d, k));
  }
  cmp(o) { o = Q.of(o); const l = this.n * o.d, r = o.n * this.d; return l < r ? -1 : l > r ? 1 : 0; }
  eq(o) { o = Q.of(o); return this.n === o.n && this.d === o.d; }
  floor() { let q = this.n / this.d; if (this.n < 0n && q * this.d !== this.n) q -= 1n; return q; }
  toNumber() {
    const n = this.n, d = this.d;
    const nn = Number(n), dd = Number(d);
    if (Number.isFinite(nn) && Number.isFinite(dd)) return nn / dd;
    // scale down huge values
    const shift = BigInt(Math.max(0, n.toString().length - 300, d.toString().length - 300));
    return Number(n / 10n ** shift) / Number(d / 10n ** shift || 1n);
  }
  toString() { return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`; }
  toLatex() {
    if (this.d === 1n) return this.n.toString();
    const s = this.n < 0n ? '-' : '';
    return `${s}\\frac{${babs(this.n)}}{${this.d}}`;
  }
  /** decimal string with `digits` significant-ish digits after point */
  toDecimal(digits = 12) {
    const neg = this.n < 0n;
    const n = babs(this.n);
    const ip = n / this.d;
    let rem = n % this.d;
    let s = ip.toString();
    if (rem === 0n) return (neg ? '-' : '') + s;
    let frac = '';
    for (let i = 0; i < digits && rem; i++) { rem *= 10n; frac += (rem / this.d).toString(); rem %= this.d; }
    frac = frac.replace(/0+$/, '');
    return (neg ? '-' : '') + s + (frac ? '.' + frac : '');
  }
}

export const Q0 = new Q(0n);
export const Q1 = new Q(1n);
export const QM1 = new Q(-1n);

/** best rational approximation with denominator <= maxDen (continued fractions) */
export function rationalApprox(x, maxDen = 1000, tol = 1e-12) {
  if (!Number.isFinite(x)) return null;
  const sign = x < 0 ? -1 : 1;
  let v = Math.abs(x);
  let h0 = 0, h1 = 1, k0 = 1, k1 = 0;
  for (let i = 0; i < 64; i++) {
    const a = Math.floor(v);
    const h2 = a * h1 + h0, k2 = a * k1 + k0;
    if (k2 > maxDen) break;
    h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    if (Math.abs(sign * h1 / k1 - x) <= tol * Math.max(1, Math.abs(x))) return new Q(BigInt(sign * h1), BigInt(k1));
    const f = v - a;
    if (f < 1e-15) break;
    v = 1 / f;
  }
  if (k1 && Math.abs(sign * h1 / k1 - x) <= tol * Math.max(1, Math.abs(x))) return new Q(BigInt(sign * h1), BigInt(k1));
  return null;
}

/** Factor small |n| (BigInt) by trial division; returns Map prime->exp. For big numbers use ntheory. */
export function smallFactor(n) {
  n = babs(n);
  const f = new Map();
  if (n < 2n) return f;
  for (const p of [2n, 3n, 5n]) {
    while (n % p === 0n) { f.set(p, (f.get(p) || 0) + 1); n /= p; }
  }
  let p = 7n; let step = [4n, 2n, 4n, 2n, 4n, 6n, 2n, 6n]; let i = 0;
  while (p * p <= n && p < 1000000n) {
    while (n % p === 0n) { f.set(p, (f.get(p) || 0) + 1); n /= p; }
    p += step[i++ & 7];
  }
  if (n > 1n) f.set(n, (f.get(n) || 0) + 1);
  return f;
}
