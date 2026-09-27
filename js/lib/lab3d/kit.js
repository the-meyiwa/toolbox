/* ============================================================
   3D Lab — geometry kit

   Small helpers the shape and model builders share. Units are metres,
   y is up. Side-profile extrusions (`profile`) are the workhorse for
   hard-surface objects: a part is drawn as an outline in the x/y plane
   (corners optionally rounded) and extruded across z with a bevel, the
   way product and weapon models are usually blocked out.
   ============================================================ */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const DEG = Math.PI / 180;

export function group(name = '', ...children) {
  const g = new THREE.Group();
  g.name = name;
  for (const c of children.flat()) if (c) g.add(c);
  return g;
}

export function mesh(geo, material, name = '') {
  const m = new THREE.Mesh(geo, material);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Position (metres) and rotation (degrees) in one call. */
export function at(obj, p = [0, 0, 0], r = null, s = null) {
  obj.position.set(p[0] || 0, p[1] || 0, p[2] || 0);
  if (r) obj.rotation.set((r[0] || 0) * DEG, (r[1] || 0) * DEG, (r[2] || 0) * DEG);
  if (s != null) Array.isArray(s) ? obj.scale.set(s[0], s[1], s[2]) : obj.scale.setScalar(s);
  return obj;
}

export function box(w, h, d, material, { r = 0, seg = 3, name = '' } = {}) {
  const rr = Math.min(r, w / 2 - 1e-5, h / 2 - 1e-5, d / 2 - 1e-5);
  const geo = rr > 0 ? new RoundedBoxGeometry(w, h, d, seg, rr) : new THREE.BoxGeometry(w, h, d);
  return mesh(geo, material, name);
}

/** Cylinder along y. */
export function cyl(rTop, rBot, h, material, { seg = 32, open = false, start = 0, len = Math.PI * 2, name = '' } = {}) {
  return mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open, start, len), material, name);
}
/** Cylinder along x (length `len`, centred). */
export function cylX(r, len, material, opts = {}) {
  const m = cyl(opts.r2 ?? r, r, len, material, opts);
  m.geometry.rotateZ(-Math.PI / 2);
  return m;
}
/** Cylinder along z. */
export function cylZ(r, len, material, opts = {}) {
  const m = cyl(opts.r2 ?? r, r, len, material, opts);
  m.geometry.rotateX(Math.PI / 2);
  return m;
}

export function sphere(r, material, { w = 32, h = 20, phiStart = 0, phiLen = Math.PI * 2, thetaStart = 0, thetaLen = Math.PI, name = '' } = {}) {
  return mesh(new THREE.SphereGeometry(r, w, h, phiStart, phiLen, thetaStart, thetaLen), material, name);
}

export function torus(R, r, material, { arc = Math.PI * 2, radial = 16, tubular = 48, name = '' } = {}) {
  return mesh(new THREE.TorusGeometry(R, r, radial, tubular, arc), material, name);
}

export function capsule(r, len, material, { cap = 8, radial = 20, name = '' } = {}) {
  return mesh(new THREE.CapsuleGeometry(r, len, cap, radial), material, name);
}

/** Lathe around y from [[radius, y], …] (bottom to top). */
export function lathe(points, material, { seg = 48, name = '', phiStart = 0, phiLen = Math.PI * 2 } = {}) {
  const pts = points.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
  return mesh(new THREE.LatheGeometry(pts, seg, phiStart, phiLen), material, name);
}

/** Tube along a smooth curve through [[x,y,z], …]. */
export function tube(points, r, material, { segments = 64, radial = 12, closed = false, tension = 0.5, name = '' } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), closed, 'catmullrom', tension);
  return mesh(new THREE.TubeGeometry(curve, segments, r, radial, closed), material, name);
}

/**
 * Outline → THREE.Shape. Points are [x, y] or [x, y, r]: r rounds that corner.
 * `round` rounds every corner that has no radius of its own.
 */
export function shapeFrom(points, round = 0) {
  const s = new THREE.Shape();
  traceRounded(s, points, round);
  return s;
}

export function pathFrom(points, round = 0) {
  const p = new THREE.Path();
  traceRounded(p, points, round);
  return p;
}

function traceRounded(path, points, round) {
  const n = points.length;
  const P = points.map(p => new THREE.Vector2(p[0], p[1]));
  const R = points.map(p => (p[2] != null ? p[2] : round));
  const corner = (i) => {
    const r = R[i];
    const cur = P[i], prev = P[(i - 1 + n) % n], next = P[(i + 1) % n];
    if (!r) return { a: cur, b: cur, c: cur };
    const d1 = prev.clone().sub(cur), d2 = next.clone().sub(cur);
    const l1 = d1.length(), l2 = d2.length();
    const k = Math.min(r, l1 / 2, l2 / 2);
    return { a: cur.clone().add(d1.multiplyScalar(k / (l1 || 1))), c: cur, b: cur.clone().add(d2.multiplyScalar(k / (l2 || 1))) };
  };
  const cs = P.map((_, i) => corner(i));
  path.moveTo(cs[0].b.x, cs[0].b.y);
  for (let i = 1; i <= n; i++) {
    const c = cs[i % n];
    path.lineTo(c.a.x, c.a.y);
    if (c.a !== c.c) path.quadraticCurveTo(c.c.x, c.c.y, c.b.x, c.b.y);
  }
  path.closePath?.();
}

/** Extrude a shape across z, centred on z = 0. */
export function extrude(shape, depth, material, { bevel = 0, bevelSeg = 3, curveSeg = 8, name = '', holes = [] } = {}) {
  for (const h of holes) shape.holes.push(h);
  const b = Math.min(bevel, depth / 2 - 1e-5);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(1e-4, depth - 2 * Math.max(0, b)), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: b > 0 ? -b : 0,
    bevelSegments: bevelSeg, curveSegments: curveSeg,
  });
  geo.translate(0, 0, -(depth - 2 * Math.max(0, b)) / 2);
  geo.computeVertexNormals();
  return mesh(geo, material, name);
}

/** Side profile [[x, y(, r)], …] extruded `depth` across z. */
export function profile(points, depth, material, { round = 0, bevel = 0, ...rest } = {}) {
  return extrude(shapeFrom(points, round), depth, material, { bevel, ...rest });
}

/** Plan outline in x/z extruded upwards by `height` (sits on y = 0). */
export function slab(points, height, material, opts = {}) {
  const m = profile(points.map(([x, z, r]) => [x, -z, r]), height, material, opts);
  m.geometry.rotateX(-Math.PI / 2);
  m.geometry.translate(0, height / 2, 0);
  return m;
}

export function roundRect(w, h, r, [cx, cy] = [0, 0]) {
  return roundRectRadii(w, h, [r, r, r, r], [cx, cy]);
}

/** Rounded rectangle with its own radius per corner: [top-left, top-right, bottom-right, bottom-left]. */
export function roundRectRadii(w, h, [tl, tr, br, bl], [cx, cy] = [0, 0], PathType = THREE.Shape) {
  const x = cx - w / 2, y = cy - h / 2;
  const s = new PathType();
  s.moveTo(x + bl, y);
  s.lineTo(x + w - br, y);
  if (br) s.quadraticCurveTo(x + w, y, x + w, y + br);
  s.lineTo(x + w, y + h - tr);
  if (tr) s.quadraticCurveTo(x + w, y + h, x + w - tr, y + h);
  s.lineTo(x + tl, y + h);
  if (tl) s.quadraticCurveTo(x, y + h, x, y + h - tl);
  s.lineTo(x, y + bl);
  if (bl) s.quadraticCurveTo(x, y, x + bl, y);
  return s;
}

/** A "squircle"-ish rounded rect using arcs (smoother than quadratic corners for devices). */
export function deviceRect(w, h, r, PathType = THREE.Shape, [cx, cy] = [0, 0]) {
  const s = new PathType();
  const x = cx - w / 2, y = cy - h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

export function circlePath(r, [cx, cy] = [0, 0], PathType = THREE.Path) {
  const p = new PathType();
  p.absarc(cx, cy, r, 0, Math.PI * 2, false);
  return p;
}

/** Annular sector (a curved band) between radii r1 < r2 around centre c, from angle a0 to a1 (radians). */
export function arcBand(c, r1, r2, a0, a1, steps = 24) {
  const pts = [];
  for (let i = 0; i <= steps; i++) { const a = a0 + (a1 - a0) * (i / steps); pts.push([c[0] + Math.cos(a) * r2, c[1] + Math.sin(a) * r2]); }
  for (let i = steps; i >= 0; i--) { const a = a0 + (a1 - a0) * (i / steps); pts.push([c[0] + Math.cos(a) * r1, c[1] + Math.sin(a) * r1]); }
  return pts;
}

/** Evenly repeat `make(i)` objects. */
export function repeat(n, make) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(make(i));
  return out;
}

/** Point on a quadratic/cubic path helper for tubes: sample a function t∈[0,1] → [x,y,z]. */
export function sample(n, f) {
  const out = [];
  for (let i = 0; i <= n; i++) out.push(f(i / n));
  return out;
}

export { THREE };
