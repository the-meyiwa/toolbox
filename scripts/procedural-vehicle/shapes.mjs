/**
 * Shape builders shared by the SUV and aircraft generators.
 *
 * Loft   — a skin swept through cross-sections placed along the length
 *          (fuselages, nacelles, an SUV body). Positions are (u, t): u is
 *          metres behind the front, t runs up one side of the section.
 * Wing   — a lifting surface (wing, tailplane, fin, winglet, propeller
 *          blade) described by leading-edge stations, chord and thickness.
 *
 * Both cut their skin into components by a classify(…) callback over a
 * parameter grid whose lines include every breakpoint the caller names, so
 * door, window and control-surface edges are exact and neighbouring panels
 * share vertices. Vehicle space: +X forward (x = -u), +Y up, +Z right.
 */
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { merge, clamp, lerp } from './geometry.mjs';

/* ------------------------------------------------------------ sampling -- */

/** Sorted samples from a to b no further apart than `step`, including every break inside [a, b]. */
export function samples(a, b, step, breaks = []) {
  const knots = [...new Set([a, b, ...breaks.filter(v => v > a + 1e-9 && v < b - 1e-9)].map(v => +v.toFixed(9)))].sort((x, y) => x - y);
  const out = [knots[0]];
  for (let i = 1; i < knots.length; i++) {
    const n = Math.max(1, Math.ceil((knots[i] - knots[i - 1]) / step - 1e-9));
    for (let k = 1; k <= n; k++) out.push(knots[i - 1] + (knots[i] - knots[i - 1]) * k / n);
  }
  return out;
}

/** Monotone cubic (PCHIP) interpolation through [x, y] knots, flat outside. */
export function pchip(knots) {
  const xs = knots.map(k => k[0]), ys = knots.map(k => k[1]), n = xs.length;
  if (n === 1) return () => ys[0];
  const h = [], d = [];
  for (let i = 0; i < n - 1; i++) { h.push(xs[i + 1] - xs[i]); d.push((ys[i + 1] - ys[i]) / h[i]); }
  const m = new Array(n).fill(0);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  }
  return x => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
  };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/**
 * Indexed geometry from a grid of points P[i][j] over the listed cells,
 * wound so the face normals agree with `outward(p)` (a direction at p).
 */
export function gridGeometry(P, cells, outward) {
  const index = new Map(), positions = [], tris = [];
  const vid = (i, j) => {
    const key = i * 100003 + j;
    let v = index.get(key);
    if (v === undefined) { v = positions.length / 3; index.set(key, v); positions.push(...P[i][j]); }
    return v;
  };
  let flip = null;
  for (const [i, j] of cells) {
    const a = P[i][j], b = P[i + 1][j], c = P[i][j + 1], d = P[i + 1][j + 1];
    if (flip === null) {
      const n = cross(sub(d, a), sub(c, b));
      const len = Math.hypot(...n);
      if (len > 1e-12) flip = dot(n, outward([(a[0] + d[0]) / 2, (a[1] + d[1]) / 2, (a[2] + d[2]) / 2])) < 0;
    }
    tris.push([vid(i, j), vid(i + 1, j), vid(i, j + 1)], [vid(i + 1, j), vid(i + 1, j + 1), vid(i, j + 1)]);
  }
  if (!tris.length) return null;
  const idx = [];
  for (const [a, b, c] of tris) if (flip) idx.push(a, c, b); else idx.push(a, b, c);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Group grid cells by classify(i, j) → component id (null skips the cell). */
function classifyCells(ni, nj, classify) {
  const groups = new Map();
  for (let i = 0; i < ni - 1; i++) for (let j = 0; j < nj - 1; j++) {
    const id = classify(i, j);
    if (!id) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push([i, j]);
  }
  return groups;
}

/* ----------------------------------------------------------------- loft -- */

/**
 * sectionFn(params, t, side) → [y, z] for the section parameters at u.
 * stations: [{ u, ...numeric params }]; each numeric key is PCHIP-interpolated.
 */
export class Loft {
  constructor(stations, sectionFn, { keys } = {}) {
    this.stations = stations;
    this.section = sectionFn;
    this.keys = keys || Object.keys(stations[0]).filter(k => k !== 'u' && typeof stations[0][k] === 'number');
    this.tracks = Object.fromEntries(this.keys.map(k => [k, pchip(stations.map(s => [s.u, s[k] ?? stations[0][k]]))]));
    this.u0 = stations[0].u; this.u1 = stations[stations.length - 1].u;
  }
  params(u) { const p = { u }; for (const k of this.keys) p[k] = this.tracks[k](u); return p; }
  point(u, t, side = 1) { const [y, z] = this.section(this.params(u), t, side); return [-u, y, z]; }
  /** Rough outward direction at p for winding: away from the section's centre line. */
  outward(p) { const q = this.params(-p[0]); return [0, p[1] - (q.yc ?? p[1]), p[2] - (q.zc ?? 0)]; }

  /**
   * Cut the skin between us × ts (sample arrays) into components.
   * classify({ u, t, side, p }) → id | null. offset pushes the skin outward (overlays).
   * Returns Map(id → geometry).
   */
  regions({ us, ts, side = 1, classify, offset = 0 }) {
    const P = us.map(u => ts.map(t => this.point(u, t, side)));
    if (offset) this.inflate(P, us, ts, side, offset);
    const groups = classifyCells(us.length, ts.length, (i, j) => {
      const um = (us[i] + us[i + 1]) / 2, tm = (ts[j] + ts[j + 1]) / 2;
      return classify({ u: um, t: tm, side, p: this.point(um, tm, side) });
    });
    const out = new Map();
    for (const [id, cells] of groups) { const g = gridGeometry(P, cells, p => this.outward(p)); if (g) out.set(id, g); }
    return out;
  }

  /** Offset grid points along the outward surface normal. */
  inflate(P, us, ts, side, d) {
    const e = 1e-3;
    for (let i = 0; i < us.length; i++) for (let j = 0; j < ts.length; j++) {
      const u = us[i], t = ts[j];
      const du = sub(this.point(u + e, t, side), this.point(u - e, t, side));
      const dt = sub(this.point(u, Math.min(t + e, this.tMax ?? Infinity), side), this.point(u, Math.max(t - e, 0), side));
      let n = norm(cross(du, dt));
      if (dot(n, this.outward(P[i][j])) < 0) n = n.map(v => -v);
      if (!Number.isFinite(n[0]) || Math.hypot(...dt) < 1e-9) continue;
      P[i][j] = [P[i][j][0] + n[0] * d, P[i][j][1] + n[1] * d, P[i][j][2] + n[2] * d];
    }
  }

  /** A single overlay patch over [u0,u1] × [t0,t1], offset outward. */
  patch(u0, u1, t0, t1, { side = 1, nu = 4, nt = 4, offset = 0.004 } = {}) {
    const us = samples(u0, u1, (u1 - u0) / nu), ts = samples(t0, t1, (t1 - t0) / nt);
    return this.regions({ us, ts, side, offset, classify: () => 'x' }).get('x') || null;
  }

  /** Solve t on one side for a height y at station u (the section must rise monotonically in t). */
  tAtY(u, y, side = 1, t0 = 0, t1 = 1) {
    let a = t0, b = t1;
    for (let k = 0; k < 40; k++) { const m = (a + b) / 2; if (this.point(u, m, side)[1] < y) a = m; else b = m; }
    return (a + b) / 2;
  }

  /**
   * Flat end cap at station u, meshed on a (z, y) grid whose lines include
   * the given breaks, clamped to the section outline. classify({ z, y }) → id.
   */
  cap(u, { zs, ys, classify, tSamples = 60, tMax = 1, face = 1 }) {
    // Half-width of the outline as a function of height, from the right side.
    const outline = [];
    for (let k = 0; k <= tSamples; k++) { const [, y, z] = this.point(u, tMax * k / tSamples, 1); outline.push([y, Math.abs(z)]); }
    const hw = y => {
      let best = 0;
      for (let k = 0; k < outline.length - 1; k++) {
        const [y0, z0] = outline[k], [y1, z1] = outline[k + 1];
        const lo = Math.min(y0, y1), hi = Math.max(y0, y1);
        if (y < lo - 1e-9 || y > hi + 1e-9) continue;
        const z = hi - lo < 1e-9 ? Math.max(z0, z1) : lerp(z0, z1, (y - y0) / (y1 - y0));
        best = Math.max(best, z);
      }
      return best;
    };
    const P = zs.map(z => ys.map(y => [-u, y, clamp(z, -hw(y), hw(y))]));
    const groups = classifyCells(zs.length, ys.length, (i, j) => {
      const zm = (zs[i] + zs[i + 1]) / 2, ym = (ys[j] + ys[j + 1]) / 2;
      if (Math.abs(zm) > hw(ym)) return null;
      return classify({ z: zm, y: ym });
    });
    const out = new Map();
    for (const [id, cells] of groups) { const g = gridGeometry(P, cells, () => [face, 0, 0]); if (g) out.set(id, g); }
    return out;
  }
}

/** Superellipse half-section: t 0 = bottom, 0.5 = side, 1 = top (on `side`). */
export function superSection({ yc, w, ht, hb, n = 2, zc = 0 }, t, side = 1) {
  const th = -Math.PI / 2 + t * Math.PI;
  const c = Math.cos(th), s = Math.sin(th), e = 2 / n;
  const z = zc + side * w * Math.pow(Math.max(0, c), e);
  const y = yc + (s >= 0 ? ht : hb) * Math.sign(s) * Math.pow(Math.abs(s), e);
  return [y, z];
}

/* ----------------------------------------------------------------- wing -- */

/** NACA 4-digit thickness (closed trailing edge) and camber at chord fraction x. */
export function airfoil(x, { t = 0.12, m = 0.02, p = 0.4 } = {}) {
  const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
  const yc = m === 0 ? 0 : x < p ? m / (p * p) * (2 * p * x - x * x) : m / ((1 - p) ** 2) * ((1 - 2 * p) + 2 * p * x - x * x);
  return { yt: Math.max(0, yt), yc };
}

/** Cosine-spaced chord samples with breaks. */
export function chordSamples(n, breaks = []) {
  const base = Array.from({ length: n + 1 }, (_, k) => (1 - Math.cos(Math.PI * k / n)) / 2);
  return [...new Set([...base, ...breaks].map(v => +v.toFixed(9)))].sort((a, b) => a - b);
}

/**
 * stations: [{ le: [x,y,z], chord, t, up: [x,y,z], m?, p?, chordDir? }] from root to tip.
 * s ∈ [0, stations.length - 1] runs along them; c ∈ [0, 1] from leading to trailing edge.
 * face = +1 on the `up` side, -1 on the other.
 */
export class Wing {
  constructor(stations, { m = 0.02, p = 0.4 } = {}) {
    this.st = stations.map(s => ({ m, p, chordDir: [-1, 0, 0], ...s, up: norm(s.up || [0, 1, 0]) }));
    this.sMax = this.st.length - 1;
  }
  at(s) {
    const i = Math.min(this.sMax - 1, Math.max(0, Math.floor(s))), f = s - i;
    const a = this.st[i], b = this.st[Math.min(this.sMax, i + 1)];
    const L = (x, y) => lerp(x, y, f), L3 = (x, y) => [L(x[0], y[0]), L(x[1], y[1]), L(x[2], y[2])];
    return { le: L3(a.le, b.le), chord: L(a.chord, b.chord), t: L(a.t, b.t), up: norm(L3(a.up, b.up)), m: L(a.m, b.m), p: L(a.p, b.p), chordDir: norm(L3(a.chordDir, b.chordDir)) };
  }
  point(s, c, face = 1, inset = 0) {
    const q = this.at(s), { yt, yc } = airfoil(c, q);
    const h = (yc + face * Math.max(0, yt - inset / q.chord)) * q.chord;
    return [q.le[0] + q.chordDir[0] * c * q.chord + q.up[0] * h, q.le[1] + q.chordDir[1] * c * q.chord + q.up[1] * h, q.le[2] + q.chordDir[2] * c * q.chord + q.up[2] * h];
  }
  /** Point on the camber line (hinge lines, pivots). */
  mid(s, c) { const a = this.point(s, c, 1), b = this.point(s, c, -1); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; }

  /** Upper and lower skins over ss × cs, cut by classify({ s, c, face }). Map(id → geometry). */
  regions({ ss, cs, classify, faces = [1, -1], offset = 0 }) {
    const out = new Map();
    for (const face of faces) {
      const P = ss.map(s => cs.map(c => this.point(s, c, face, -offset)));
      const groups = classifyCells(ss.length, cs.length, (i, j) => classify({ s: (ss[i] + ss[i + 1]) / 2, c: (cs[j] + cs[j + 1]) / 2, face }));
      for (const [id, cells] of groups) {
        const g = gridGeometry(P, cells, p => { const q = this.at(ss[0]); return q.up.map(v => v * face); });
        if (!g) continue;
        out.set(id, out.has(id) ? merge([out.get(id), g]) : g);
      }
    }
    return out;
  }
  /** Face closing the section between the skins at chord fraction c, over [s0, s1]. */
  chordFace(s0, s1, c, n = 8) {
    const ss = samples(s0, s1, (s1 - s0) / n), P = ss.map(s => [this.point(s, c, 1), this.point(s, c, -1)]);
    return gridGeometry(P, ss.slice(0, -1).map((_, i) => [i, 0]), () => this.at(s0).chordDir.map(v => -v));
  }
  /** Rib closing the section at station s over [c0, c1]. */
  rib(s, c0 = 0, c1 = 1, n = 16) {
    const cs = chordSamples(n).map(v => c0 + (c1 - c0) * v), P = cs.map(c => [this.point(s, c, 1), this.point(s, c, -1)]);
    const q0 = this.at(0), q1 = this.at(this.sMax), span = norm(sub(q1.le, q0.le));
    const dir = s <= 0.5 ? span.map(v => -v) : span;
    return gridGeometry(P, cs.slice(0, -1).map((_, i) => [i, 0]), () => dir);
  }
}

/** Direction of the camber hinge line between two span stations, pointing towards +z (or +y for fins). */
export function hingeAxis(wing, s0, s1, c, prefer = 2) {
  const a = wing.mid(s0, c), b = wing.mid(s1, c);
  let d = norm(sub(b, a));
  if (d[prefer] < 0) d = d.map(v => -v);
  return d;
}
