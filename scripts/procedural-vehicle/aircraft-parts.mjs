/**
 * Parts shared by the aircraft generators: lifting surfaces with cut-out
 * trailing-edge controls, overlay panels (spoilers, slats, Kruegers),
 * wheels and small helpers for placing geometry about a hinge.
 */
import { Matrix4, Vector3 } from 'three';
import { merge, mirrorZ, lathe, cylinder, clean } from './geometry.mjs';
import { Wing, samples, chordSamples, hingeAxis } from './shapes.mjs';

export const SIDE_KEYS = [{ key: 'right', s: 1, label: 'Right' }, { key: 'left', s: -1, label: 'Left' }];

/** Rotate a geometry about an axis through a point (radians). */
export function rotateAbout(geometry, point, axis, angle) {
  const m = new Matrix4().makeTranslation(point[0], point[1], point[2])
    .multiply(new Matrix4().makeRotationAxis(new Vector3(...axis).normalize(), angle))
    .multiply(new Matrix4().makeTranslation(-point[0], -point[1], -point[2]));
  geometry.applyMatrix4(m);
  return geometry;
}

/** Mirror a point / axis for the left-hand side; axes keep pointing towards +z. */
export const mirrorPoint = (p, s) => (s > 0 ? p : [p[0], p[1], -p[2]]);
export const mirrorAxis = (a, s) => (s > 0 ? a : [-a[0], -a[1], a[2]]);
const handed = (g, s) => (s < 0 ? mirrorZ(g) : g);

/**
 * One lifting surface (right-hand instance, mirrored for s = -1; s = 0 for a fin).
 * te: trailing-edge controls [{ id, s0, s1, c0, pivot?, parent? }] cut out of the skin.
 * Returns { pivots: { id: node }, axes: { id: axis } } — axes point to +z (+y on fins),
 * so a positive rotation moves the trailing edge down (to the right on fins).
 */
export function liftingSurface(A, wing, { skinId, s = 1, te = [], parent = A.root, ss, cs, gap = 0.012, cgap = 0.012, capRoot = true, capTip = true, prefer = 2, skinParts = null }) {
  const inCut = (sm, cm) => te.find(t => sm > t.s0 && sm < t.s1 && cm > t.c0);
  const skin = wing.regions({ ss, cs, classify: ({ s: sm, c: cm }) => (inCut(sm, cm) ? null : (skinParts ? skinParts(sm, cm) : skinId)) });
  const extra = [];
  for (const t of te) {
    extra.push(wing.chordFace(t.s0, t.s1, t.c0), wing.rib(t.s0, t.c0, 1, 8), wing.rib(t.s1, t.c0, 1, 8));
  }
  if (capRoot) extra.push(wing.rib(0));
  if (capTip) extra.push(wing.rib(wing.sMax));
  const skinGeo = merge([skin.get(skinId), ...extra].filter(Boolean));
  A.add(skinId, s < 0 ? mirrorZ(skinGeo) : skinGeo, parent);
  for (const [id, g] of skin) if (id !== skinId) A.add(id, handed(g, s), parent);

  const pivots = {}, axes = {};
  for (const t of te) {
    const a0 = t.s0 + gap, a1 = t.s1 - gap, c0 = t.c0 + cgap;
    const sub = wing.regions({ ss: samples(a0, a1, (a1 - a0) / Math.max(2, Math.ceil((a1 - a0) / 0.1))), cs: chordSamples(10).map(v => c0 + (1 - c0) * v), classify: () => 'x' }).get('x');
    const geo = merge([sub, wing.chordFace(a0, a1, c0, 4), wing.rib(a0, c0, 1, 8), wing.rib(a1, c0, 1, 8)]);
    const hingeMid = wing.mid((a0 + a1) / 2, c0);
    const axis = hingeAxis(wing, a0, a1, c0, prefer);
    const node = A.pivot(t.pivot || `tbx_pivot_${t.id}`, mirrorPoint(hingeMid, s || 1), t.parent || parent);
    A.add(t.id, handed(geo, s), node);
    pivots[t.id] = node; axes[t.id] = mirrorAxis(axis, s || 1);
  }
  return { pivots, axes };
}

/**
 * Thin overlay panels on a wing skin (spoilers on top, slats round the nose,
 * Krueger flaps underneath), each on its own pivot at the given hinge chord.
 * panels: [{ id, s0, s1, c0, c1, faces: [1] | [-1] | [1, -1], hingeC }]
 */
export function overlayPanels(A, wing, panels, { s = 1, parent = A.root, offset = 0.008, prefer = 2 } = {}) {
  const pivots = {}, axes = {};
  for (const p of panels) {
    const ss = samples(p.s0, p.s1, (p.s1 - p.s0) / 4), cs = samples(p.c0, p.c1, (p.c1 - p.c0) / 6);
    const skin = wing.regions({ ss, cs, faces: p.faces, offset, classify: () => 'x' }).get('x');
    const hc = p.hingeC ?? p.c0;
    const face = p.faces.length === 1 ? p.faces[0] : 1;
    const h0 = wing.point(p.s0, hc, face, -offset), h1 = wing.point(p.s1, hc, face, -offset);
    const mid = [(h0[0] + h1[0]) / 2, (h0[1] + h1[1]) / 2, (h0[2] + h1[2]) / 2];
    const node = A.pivot(`tbx_pivot_${p.id}`, mirrorPoint(mid, s || 1), parent);
    A.add(p.id, handed(skin, s), node);
    pivots[p.id] = node; axes[p.id] = mirrorAxis(hingeAxis(wing, p.s0, p.s1, hc, prefer), s || 1);
  }
  return { pivots, axes };
}

/** Aircraft tyre and rim about the z axis, centred at the origin. */
export function aircraftTyre(od, width, rimD) {
  const r = od / 2, w = width / 2, rr = rimD / 2;
  const prof = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + Math.PI * i / n;
    prof.push([rr + (r - rr) * (0.55 + 0.45 * Math.cos(a)), w * Math.sin(a) * 0.98]);
  }
  prof.unshift([rr, -w * 0.9]); prof.push([rr, w * 0.9]);
  return lathe(prof, { axis: 'z', seg: 32 });
}
export function aircraftRim(rimD, width, hubR = 0.08) {
  const rr = rimD / 2, w = width / 2;
  return merge([
    lathe([[hubR, -w * 0.9], [rr * 0.55, -w * 0.9], [rr, -w * 0.95], [rr, w * 0.95], [rr * 0.55, w * 0.7], [hubR, w * 0.7]], { axis: 'z', seg: 28 }),
    cylinder(hubR, hubR, width * 1.05, { axis: 'z', seg: 16 })
  ]);
}

/** Spanwise station parameter for a z (or y) coordinate along a piecewise-straight wing. */
export function sAt(wing, coord, axis = 2) {
  const st = wing.st;
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i].le[axis], b = st[i + 1].le[axis];
    if ((coord - a) * (coord - b) <= 0 && a !== b) return i + (coord - a) / (b - a);
  }
  return coord <= st[0].le[axis] ? 0 : st.length - 1;
}

export { Wing, handed, clean };
