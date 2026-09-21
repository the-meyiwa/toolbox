/**
 * Parametric four-door sedan skin.
 *
 * The outer body is described by a "wrap" surface W(ξ, y): ξ runs around one
 * half of the body in plan view (0 = front centre, 1 = rear centre) and y is
 * height above ground. Nose and tail follow superellipses with a height-
 * dependent lean, the flanks follow the published overall width with a
 * vertical tumble factor. Top surfaces (bonnet, glasshouse, boot lid) are
 * patches that share their boundary curves with the wrap, so neighbouring
 * panels meet on common shut lines.
 *
 * All longitudinal positions are expressed as u = metres behind the front
 * bumper. Vehicle-space X = L/2 - u (forward positive).
 */
import { surface, merge, mirrorZ, clamp, lerp, smooth } from './geometry.mjs';

/** Centripetal-ish Catmull-Rom through [u, value] knots (u ascending). */
export function spline(knots) {
  return u => {
    if (u <= knots[0][0]) return knots[0][1];
    const last = knots.length - 1;
    if (u >= knots[last][0]) return knots[last][1];
    let i = 0; while (u > knots[i + 1][0]) i++;
    const p0 = knots[Math.max(0, i - 1)], p1 = knots[i], p2 = knots[i + 1], p3 = knots[Math.min(last, i + 2)];
    const t = (u - p1[0]) / (p2[0] - p1[0]);
    const m1 = (p2[1] - p0[1]) / (p2[0] - p0[0]) * (p2[0] - p1[0]);
    const m2 = (p3[1] - p1[1]) / (p3[0] - p1[0]) * (p2[0] - p1[0]);
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
  };
}

export class SedanBody {
  constructor(p) {
    this.p = p;
    const { L } = p;
    this.X = u => L / 2 - u;
    this.topCenterY = spline(p.glass.center);
    this.railZ = spline(p.glass.railZ);
    this.crownG = spline(p.glass.crown);
    // Arc-length proportions for the three wrap segments.
    const front = Math.PI / 2 * (p.noseA + p.HW) / 2, rear = Math.PI / 2 * (p.tailA + p.HW) / 2, mid = L - p.noseA - p.tailA;
    const total = front + mid + rear;
    this.xi1 = front / total; this.xi2 = (front + mid) / total;
  }

  leanF(y) { const { amt, y0, span } = this.p.leanF; return amt * ((y - y0) / span) ** 2; }
  leanR(y) { const { amt, y0, span } = this.p.leanR; return amt * ((y - y0) / span) ** 2; }
  vf(y) { return 1 - this.p.vfAmt * ((y - this.p.vfPeak) / 0.45) ** 2; }
  HWy(y) { return this.p.HW * this.vf(y); }

  /** Plan-view position of wrap coordinate ξ at height y. */
  wrap(xi, y) {
    const p = this.p;
    if (xi <= this.xi1) {
      const phi = xi / this.xi1 * Math.PI / 2, e = 2 / p.noseN;
      const base = p.noseA * (1 - Math.cos(phi) ** e);
      return { u: base + this.leanF(y) * (1 - smooth(0, p.noseA, base)), z: this.HWy(y) * Math.sin(phi) ** e };
    }
    if (xi < this.xi2) return { u: lerp(p.noseA, p.L - p.tailA, (xi - this.xi1) / (this.xi2 - this.xi1)), z: this.HWy(y) };
    const phi = (1 - xi) / (1 - this.xi2) * Math.PI / 2, e = 2 / p.tailN;
    const base = p.tailA * (1 - Math.cos(phi) ** e);
    return { u: p.L - base - this.leanR(y) * (1 - smooth(0, p.tailA, base)), z: this.HWy(y) * Math.sin(phi) ** e };
  }

  point(xi, y, offset = 0) {
    const { u, z } = this.wrap(xi, y);
    if (!offset) return [this.X(u), y, z];
    const n = this.normal(xi, y);
    return [this.X(u) + n[0] * offset, y + n[1] * offset, z + n[2] * offset];
  }

  normal(xi, y) {
    const e = 1e-4;
    const a = this.point(Math.min(1, xi + e), y), b = this.point(Math.max(0, xi - e), y);
    const c = this.point(xi, y + e), d = this.point(xi, y - e);
    const tx = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], ty = [c[0] - d[0], c[1] - d[1], c[2] - d[2]];
    let n = [ty[1] * tx[2] - ty[2] * tx[1], ty[2] * tx[0] - ty[0] * tx[2], ty[0] * tx[1] - ty[1] * tx[0]];
    const l = Math.hypot(...n) || 1; n = n.map(v => v / l);
    // Outward = away from the vehicle centre line.
    const pt = this.point(xi, y);
    if (n[2] * pt[2] + n[0] * pt[0] * 0.2 < 0) n = n.map(v => -v);
    return n;
  }

  /** ξ at a longitudinal station (monotonic bisection). */
  xiAtU(u, y = 0.55) {
    let a = 0, b = 1;
    for (let i = 0; i < 48; i++) { const m = (a + b) / 2; if (this.wrap(m, y).u < u) a = m; else b = m; }
    return (a + b) / 2;
  }

  /** ξ at a lateral offset on the nose ('front') or tail ('rear'). */
  xiAtZ(z, y = 0.55, end = 'front') {
    let a = end === 'front' ? 0 : this.xi2, b = end === 'front' ? this.xi1 : 1;
    for (let i = 0; i < 48; i++) {
      const m = (a + b) / 2, zm = this.wrap(m, y).z;
      if ((end === 'front') === (zm < z)) a = m; else b = m;
    }
    return (a + b) / 2;
  }

  hoodY(u) { const h = this.p.hood; return h.y0 + h.rise * (clamp(u, 0, h.rearU) / h.rearU) ** h.pow; }
  hoodSurfaceY(u, z) { const h = this.p.hood; return this.hoodY(u) - h.crown * (Math.min(Math.abs(z), h.zMax) / h.zMax) ** 2; }
  belt(u) { const b = this.p.belt; return lerp(b.y0, b.y1, clamp((u - b.u0) / (b.u1 - b.u0), 0, 1) ** b.pow); }
  deckY(u) { const d = this.p.deck; return d.y0 + (d.y1 - d.y0) * smooth(d.u0, d.uPeak, u); }
  zLid(u) { const d = this.p.deck; return lerp(d.z0, d.z1, smooth(d.u0, d.u0 + 0.35, u)); }
  deckSurfaceY(u, z) { const d = this.p.deck, zl = this.zLid(u); return this.deckY(u) - d.crown * (Math.min(Math.abs(z), zl) / zl) ** 2; }

  topY(u, z) {
    const { hood, belt } = this.p;
    if (u <= hood.rearU) return this.hoodSurfaceY(u, z);
    if (u <= belt.u1) return this.belt(u);
    return this.deckSurfaceY(u, z);
  }

  /** Top edge of the wrap at ξ (fixed-point iteration because nose/tail lean depends on y). */
  top(xi) {
    let y = 0.9;
    for (let i = 0; i < 6; i++) { const { u, z } = this.wrap(xi, y); y = this.topY(u, z); }
    const { u, z } = this.wrap(xi, y);
    return { u, z, y };
  }

  /** ξ where the wrap top edge reaches lateral z (nose or tail). */
  xiTopAtZ(z, end = 'front') {
    let a = end === 'front' ? 0 : this.xi2, b = end === 'front' ? this.xi1 : 1;
    for (let i = 0; i < 48; i++) {
      const m = (a + b) / 2, zm = this.top(m).z;
      if ((end === 'front') === (zm < z)) a = m; else b = m;
    }
    return (a + b) / 2;
  }

  archY(u, axleU) {
    const { archR, wheelY } = this.p; const d = u - axleU;
    return Math.abs(d) < archR ? wheelY + Math.sqrt(archR * archR - d * d) : -Infinity;
  }

  /** A patch on the right half of the wrap. xiFn(a, y) and yFn(b, xi) define the region. */
  region({ xi0, xi1, yLow, yHigh, nu = 16, nv = 8, offset = 0, xiFn, yFn }) {
    return surface(nu, nv, (a, b) => {
      if (xiFn) { const y = yFn(b); return this.point(xiFn(a, y), y, offset); }
      const xi = lerp(xi0, xi1, a);
      const lo = typeof yLow === 'function' ? yLow(xi) : yLow;
      const hi = typeof yHigh === 'function' ? yHigh(xi) : yHigh;
      return this.point(xi, lerp(lo, hi, b), offset);
    });
  }

  /** Right-half patch mirrored and merged into a full-width part. */
  both(geometry) { return merge([geometry, mirrorZ(geometry)]); }

  /* ---------------------------------------------------------- top panels -- */

  hood() {
    const { hood } = this.p;
    const fronts = [];
    for (let i = 0; i <= 18; i++) fronts.push(this.top(this.xiTopAtZ(Math.max(1e-4, (i / 18) * hood.zMax), 'front')).u);
    const g = surface(18, 16, (t, s) => {
      const f = fronts[Math.round(t * 18)];
      const u = lerp(f, hood.rearU, s), z = t * hood.zMax;
      return [this.X(u), this.hoodSurfaceY(u, z), z];
    });
    return this.both(g);
  }

  /** Top flange of the front wing between the wrap edge and the bonnet/cowl edge. */
  wingFlange() {
    const { hood } = this.p, cowlU = this.p.glass.cowlU;
    const xi0 = this.xiTopAtZ(hood.zMax, 'front'), xi1 = this.xiAtU(cowlU, this.belt(cowlU));
    return surface(18, 2, (a, b) => {
      const outer = this.top(lerp(xi0, xi1, a));
      const u = outer.u;
      const zIn = u <= hood.rearU ? hood.zMax : lerp(hood.zMax, this.railZ(cowlU), (u - hood.rearU) / (cowlU - hood.rearU));
      const yIn = u <= hood.rearU ? this.hoodSurfaceY(u, hood.zMax) : this.cowlY(u, zIn);
      return [this.X(u), lerp(outer.y, yIn, b), lerp(outer.z, zIn, b)];
    });
  }

  cowlY(u, z) {
    const { hood } = this.p, cowlU = this.p.glass.cowlU;
    const s = clamp((u - hood.rearU) / (cowlU - hood.rearU), 0, 1);
    const yEdge = lerp(this.hoodSurfaceY(hood.rearU, z) - 0.012, this.topCenterY(cowlU), s);
    return yEdge - 0.025 * Math.sin(Math.PI * s);
  }

  cowlPanel() {
    const { hood } = this.p, cowlU = this.p.glass.cowlU;
    const g = surface(4, 12, (s, t) => {
      const u = lerp(hood.rearU, cowlU, s), zMax = lerp(hood.zMax, this.railZ(cowlU), s), z = t * zMax;
      return [this.X(u), this.cowlY(u, z), z];
    });
    return this.both(g);
  }

  /** Glasshouse top surface between rails, u ∈ [u0, u1]. */
  glassTop(u0, u1, nu = 16, nv = 12) {
    const g = surface(nu, nv, (s, t) => {
      const u = lerp(u0, u1, s), zr = this.railZ(u), z = t * zr;
      return [this.X(u), this.topCenterY(u) - this.crownG(u) * t * t, z];
    });
    return this.both(g);
  }

  railY(u) { return this.topCenterY(u) - this.crownG(u); }

  /** Glasshouse side between the belt edge (t = 0) and the rail (t = 1). Right side. */
  greenhouseSide(u0, u1, t0, t1, { nu = 14, nv = 6, offset = 0 } = {}) {
    return surface(nu, nv, (s, t) => this.greenhousePoint(lerp(u0, u1, s), lerp(t0, t1, t), offset));
  }

  greenhousePoint(u, t, offset = 0) {
    const yb = this.belt(u);
    const zb = this.wrap(this.xiAtU(u, yb), yb).z;
    const yr = this.railY(u), zr = this.railZ(u);
    const bulge = 0.018 * Math.sin(Math.PI * t) * smooth(0, 0.2, yr - yb);
    const y = lerp(yb, yr, t), z = lerp(zb, zr, t) + bulge;
    // Offset roughly along the outward side-glass normal.
    const dy = yr - yb, dz = zr - zb, l = Math.hypot(dy, dz) || 1;
    return [this.X(u), y - (dz / l) * offset, z + (dy / l) * offset];
  }

  deckLid() {
    const { deck } = this.p;
    const xiLid = this.xiTopAtZ(deck.z1, 'rear');
    const rears = [];
    for (let i = 0; i <= 16; i++) rears.push(this.top(this.xiTopAtZ(Math.max(1e-4, (i / 16) * deck.z1), 'rear')).u);
    const g = surface(16, 12, (t, s) => {
      const r = rears[Math.round(t * 16)];
      const u = lerp(deck.u0, r, s), z = t * this.zLid(u);
      return [this.X(u), this.deckSurfaceY(u, z), z];
    });
    return { geometry: this.both(g), xiLid };
  }

  /** Quarter top flange between the wrap top edge and the lid side edge. */
  quarterFlange() {
    const { deck } = this.p;
    const xi0 = this.xiAtU(deck.u0, this.belt(deck.u0)), xi1 = this.xiTopAtZ(deck.z1, 'rear');
    return surface(16, 2, (a, b) => {
      const outer = this.top(lerp(xi0, xi1, a));
      const zIn = Math.min(outer.z, this.zLid(outer.u));
      return [this.X(outer.u), lerp(outer.y, this.deckSurfaceY(outer.u, zIn), b), lerp(outer.z, zIn, b)];
    });
  }

  /** Wheel-well liner: a partial cylinder following the arch, inset from the body side. */
  wellLiner(axleU, depth = 0.3) {
    const { archR, wheelY } = this.p;
    const start = Math.asin(clamp((this.p.rockerTop - wheelY) / archR, -1, 1));
    return surface(20, 3, (a, b) => {
      const ang = lerp(start, Math.PI - start, a);
      const u = axleU + Math.cos(ang) * (archR + 0.01) * -1;
      const y = wheelY + Math.sin(ang) * (archR + 0.01);
      const zo = this.wrap(this.xiAtU(u, y), y).z - 0.01;
      return [this.X(u), y, lerp(zo, zo - depth, b)];
    });
  }
}
