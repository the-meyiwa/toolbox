/* ============================================================
   mathx / ntheory — BigInt number theory: Miller–Rabin (deterministic
   below 3.3·10^24, strong probable-prime above), Pollard rho (Brent)
   factorisation, divisors, σ, φ, μ, modular inverse / power, general
   CRT, continued fractions (rationals and quadratic surds √n),
   convergents, Pell equation, linear Diophantine, base conversion,
   next/prev prime, prime counting. Pure (no DOM).
   ============================================================ */

import { bgcd, babs, isqrt } from './rational.js';

export const toBig = (x) => {
  if (typeof x === 'bigint') return x;
  if (typeof x === 'number') { if (!Number.isInteger(x)) throw new Error('Integer required'); return BigInt(x); }
  const s = String(x).trim().replace(/[_\s,]/g, '');
  if (!/^[+-]?\d+$/.test(s)) throw new Error(`Not an integer: ${x}`);
  return BigInt(s);
};

export function modpow(b, e, m) {
  b = toBig(b); e = toBig(e); m = toBig(m);
  if (m === 1n) return 0n;
  if (e < 0n) { b = modinv(b, m); e = -e; }
  let r = 1n; b = ((b % m) + m) % m;
  while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; }
  return r;
}
export function egcd(a, b) {
  a = toBig(a); b = toBig(b);
  let [or, r] = [a, b], [os, s] = [1n, 0n], [ot, t] = [0n, 1n];
  while (r !== 0n) { const q = or / r; [or, r] = [r, or - q * r]; [os, s] = [s, os - q * s]; [ot, t] = [t, ot - q * t]; }
  if (or < 0n) { or = -or; os = -os; ot = -ot; }
  return { g: or, x: os, y: ot };
}
export function modinv(a, m) {
  a = toBig(a); m = toBig(m);
  const { g, x } = egcd(((a % m) + m) % m, m);
  if (g !== 1n) throw new Error(`${a} has no inverse mod ${m} (gcd = ${g})`);
  return ((x % m) + m) % m;
}

const SMALL_PRIMES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n];
export function isPrime(n) {
  n = toBig(n);
  if (n < 2n) return false;
  for (const p of SMALL_PRIMES) { if (n === p) return true; if (n % p === 0n) return false; }
  let d = n - 1n, s = 0;
  while ((d & 1n) === 0n) { d >>= 1n; s++; }
  const bases = n < 3317044064679887385961981n ? SMALL_PRIMES : [...SMALL_PRIMES, 43n, 47n, 53n, 59n, 61n, 67n, 71n, 73n, 79n, 83n, 89n, 97n];
  outer: for (const a of bases) {
    let x = modpow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let r = 1; r < s; r++) { x = x * x % n; if (x === n - 1n) continue outer; }
    return false;
  }
  return true;
}
export const primalityCertainty = (n) => (toBig(n) < 3317044064679887385961981n ? 'deterministic (Miller–Rabin with the first 13 prime bases, proven for n < 3.3·10²⁴)' : 'strong probable prime (Miller–Rabin, 25 bases; error < 4⁻²⁵)');

function pollardBrent(n, deadline = Infinity) {
  if (n % 2n === 0n) return 2n;
  for (let c = 1n; c < 200n; c++) {
    let y = 2n + c, m = 128n, g = 1n, r = 1n, q = 1n, x = y, ys = y;
    const f = (v) => (v * v + c) % n;
    while (g === 1n) {
      x = y;
      for (let i = 0n; i < r; i++) y = f(y);
      let k = 0n;
      while (k < r && g === 1n) {
        ys = y;
        const lim = m < r - k ? m : r - k;
        for (let i = 0n; i < lim; i++) { y = f(y); q = q * babs(x - y) % n; }
        g = bgcd(q, n); k += m;
        if (Date.now() > deadline) return null;
      }
      r *= 2n;
      if (r > 1n << 26n) break;
    }
    if (g === n) { do { ys = f(ys); g = bgcd(babs(x - ys), n); } while (g === 1n); }
    if (g !== n && g !== 1n) return g;
  }
  return null;
}

/** factorise |n|: Map prime -> exponent (sorted) */
export function factorize(n, { deadline = Date.now() + 4000 } = {}) {
  n = babs(toBig(n));
  const f = new Map();
  let incomplete = false;
  const add = (p, k = 1) => f.set(p, (f.get(p) || 0) + k);
  if (n < 2n) return { factors: f, incomplete };
  for (const p of [2n, 3n, 5n, 7n, 11n, 13n]) while (n % p === 0n) { add(p); n /= p; }
  for (let p = 17n; p < 10000n && p * p <= n; p += 2n) while (n % p === 0n) { add(p); n /= p; }
  const stack = n > 1n ? [n] : [];
  while (stack.length) {
    const m = stack.pop();
    if (m === 1n) continue;
    if (isPrime(m)) { add(m); continue; }
    const r = isqrt(m); if (r * r === m) { stack.push(r, r); continue; }
    if (Date.now() > deadline) { add(m); incomplete = true; continue; }
    const d = pollardBrent(m, deadline);
    if (!d) { add(m); incomplete = true; continue; }
    stack.push(d, m / d);
  }
  return { factors: new Map([...f].sort((a, b) => (a[0] < b[0] ? -1 : 1))), incomplete };
}

export function divisors(n) {
  const { factors } = factorize(n);
  let ds = [1n];
  for (const [p, k] of factors) { const nx = []; for (const d of ds) { let pp = 1n; for (let i = 0; i <= k; i++) { nx.push(d * pp); pp *= p; } } ds = nx; }
  return ds.sort((a, b) => (a < b ? -1 : 1));
}
export function totient(n) { const { factors } = factorize(n); let r = toBig(n); for (const p of factors.keys()) r = r / p * (p - 1n); return babs(r); }
export function sigma(n, k = 1) { let s = 0n; for (const d of divisors(n)) s += d ** BigInt(k); return s; }
export function mobius(n) { const { factors } = factorize(n); for (const e of factors.values()) if (e > 1) return 0; return factors.size % 2 ? -1 : 1; }

/** general CRT (moduli need not be coprime). returns {x, m} or null */
export function crt(rs, ms) {
  let x = 0n, m = 1n;
  for (let i = 0; i < rs.length; i++) {
    const r = toBig(rs[i]), mi = toBig(ms[i]);
    const { g, x: p } = egcd(m, mi);
    if ((r - x) % g !== 0n) return null;
    const l = m / g * mi;
    x = ((x + m * ((r - x) / g * p % (mi / g))) % l + l) % l;
    m = l;
  }
  return { x, m };
}

export function contFracRational(p, q) {
  p = toBig(p); q = toBig(q);
  const a = [];
  while (q !== 0n) { let t = p / q; if (p % q !== 0n && ((p < 0n) !== (q < 0n))) t -= 1n; a.push(t); [p, q] = [q, p - t * q]; }
  return a;
}
/** continued fraction of sqrt(n): [a0; periodic...] */
export function contFracSqrt(n) {
  n = toBig(n);
  const a0 = isqrt(n);
  if (a0 * a0 === n) return { a0, period: [] };
  let m = 0n, d = 1n, a = a0; const period = [];
  do { m = d * a - m; d = (n - m * m) / d; a = (a0 + m) / d; period.push(a); } while (a !== 2n * a0 && period.length < 10000);
  return { a0, period };
}
export function convergents(as) {
  let [h0, h1] = [0n, 1n], [k0, k1] = [1n, 0n];
  const out = [];
  for (const a of as) { [h0, h1] = [h1, a * h1 + h0]; [k0, k1] = [k1, a * k1 + k0]; out.push([h1, k1]); }
  return out;
}
/** fundamental solution of x^2 - n y^2 = 1 */
export function pell(n) {
  const { a0, period } = contFracSqrt(n);
  if (!period.length) throw new Error('n must not be a perfect square');
  const L = period.length;
  const seq = [a0, ...period.slice(0, L - 1)];
  const terms = L % 2 === 0 ? seq : [...seq, period[L - 1], ...period.slice(0, L - 1)];
  const c = convergents(terms);
  const [x, y] = c[c.length - 1];
  return { x, y };
}
/** ax + by = c integer solutions */
export function linearDiophantine(a, b, c) {
  a = toBig(a); b = toBig(b); c = toBig(c);
  const { g, x, y } = egcd(a, b);
  if (g === 0n) return c === 0n ? { any: true } : null;
  if (c % g !== 0n) return null;
  const k = c / g;
  return { g, x0: x * k, y0: y * k, dx: b / g, dy: -a / g };
}
export function toBase(n, base) {
  n = toBig(n); if (base < 2 || base > 36) throw new Error('Base must be 2–36');
  return (n < 0n ? '-' : '') + babs(n).toString(base).toUpperCase();
}
export function fromBase(s, base) {
  s = String(s).trim().toLowerCase(); let neg = false;
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  s = s.replace(/^0x|^0b|^0o/, '');
  let r = 0n; const B = BigInt(base);
  for (const ch of s) { const d = parseInt(ch, 36); if (Number.isNaN(d) || d >= base) throw new Error(`Digit "${ch}" invalid in base ${base}`); r = r * B + BigInt(d); }
  return neg ? -r : r;
}
export function nextPrime(n) { n = toBig(n) + 1n; if (n <= 2n) return 2n; if (n % 2n === 0n) n++; while (!isPrime(n)) n += 2n; return n; }
export function prevPrime(n) { n = toBig(n) - 1n; if (n < 2n) return null; if (n === 2n) return 2n; if (n % 2n === 0n) n--; while (n > 1n && !isPrime(n)) n -= 2n; return n > 1n ? n : null; }
export function primePi(n) {
  n = Number(n); if (n > 5e7) throw new Error('π(n) limited to n ≤ 5·10⁷');
  if (n < 2) return 0;
  const s = new Uint8Array(n + 1); let c = 0;
  for (let i = 2; i <= n; i++) { if (!s[i]) { c++; for (let j = i * i; j <= n; j += i) s[j] = 1; } }
  return c;
}
export function primesUpTo(n, cap = 2000) {
  const s = new Uint8Array(n + 1), out = [];
  for (let i = 2; i <= n && out.length < cap; i++) { if (!s[i]) { out.push(i); for (let j = i * i; j <= n; j += i) s[j] = 1; } }
  return out;
}
export function formatFactors(factors) {
  return [...factors].map(([p, k]) => (k > 1 ? `${p}^${k}` : `${p}`)).join(' × ');
}
export function latexFactors(factors) {
  return [...factors].map(([p, k]) => (k > 1 ? `${p}^{${k}}` : `${p}`)).join(' \\cdot ');
}
