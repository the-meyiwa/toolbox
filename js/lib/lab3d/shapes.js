/* ============================================================
   3D Lab — shape library

   Basic primitives, intermediate solids (gears, springs, stars,
   stairs…) and advanced mathematical shapes (knots, Möbius strip,
   Klein bottle, superquadrics, supershapes, seashells, fractals,
   minimal surfaces). Each entry has typed parameters so the Lab can
   draw sliders and the Assistant can pass values by name.

   buildShapeGeometry(id, params) → THREE.BufferGeometry, sitting on
   y = 0 and centred on x/z so it lands on the floor of the scene.
   ============================================================ */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ParametricGeometry } from 'three/examples/jsm/geometries/ParametricGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { shapeFrom, roundRect, circlePath } from './kit.js';

const TAU = Math.PI * 2;
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const int = (v, d) => Math.round(num(v, d));

const P = {
  size: { label: 'Size', min: 0.02, max: 5, step: 0.01, default: 0.3, unit: 'm' },
  width: { label: 'Width', min: 0.01, max: 5, step: 0.01, default: 0.3, unit: 'm' },
  height: { label: 'Height', min: 0.01, max: 5, step: 0.01, default: 0.3, unit: 'm' },
  depth: { label: 'Depth', min: 0.01, max: 5, step: 0.01, default: 0.3, unit: 'm' },
  radius: { label: 'Radius', min: 0.01, max: 3, step: 0.01, default: 0.15, unit: 'm' },
  segments: { label: 'Smoothness', min: 3, max: 128, step: 1, default: 48 },
};
const p = (base, over = {}) => ({ ...base, ...over });

function extrudeShape(shape, depth, bevel = 0, curveSegments = 6) {
  const b = Math.min(bevel, depth / 3);
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(1e-4, depth - 2 * b), bevelEnabled: b > 0, bevelSize: b, bevelThickness: b, bevelOffset: b ? -b : 0, bevelSegments: 3, curveSegments });
  g.translate(0, 0, -(depth - 2 * b) / 2);
  return g;
}

function parametric(fn, slices, stacks) {
  const g = new ParametricGeometry(fn, slices, stacks);
  return g;
}

/* ---------------- advanced surface functions ---------------- */

function klein(u, v, t, s) {
  // Classic Klein bottle (the "bottle" immersion), scaled to `s`.
  u *= Math.PI; v *= TAU; u *= 2;
  let x, z;
  if (u < Math.PI) {
    x = 3 * Math.cos(u) * (1 + Math.sin(u)) + (2 * (1 - Math.cos(u) / 2)) * Math.cos(u) * Math.cos(v);
    z = -8 * Math.sin(u) - 2 * (1 - Math.cos(u) / 2) * Math.sin(u) * Math.cos(v);
  } else {
    x = 3 * Math.cos(u) * (1 + Math.sin(u)) + (2 * (1 - Math.cos(u) / 2)) * Math.cos(v + Math.PI);
    z = -8 * Math.sin(u);
  }
  const y = -2 * (1 - Math.cos(u) / 2) * Math.sin(v);
  t.set(x, z, y).multiplyScalar(s / 16);
}

function superformula(a, m, n1, n2, n3) {
  const r = Math.pow(Math.pow(Math.abs(Math.cos(m * a / 4)), n2) + Math.pow(Math.abs(Math.sin(m * a / 4)), n3), -1 / n1);
  return Number.isFinite(r) ? r : 0;
}

const sgnPow = (x, e) => Math.sign(x) * Math.pow(Math.abs(x), e);

/* ---------------- fractals ---------------- */

function menger(level, s) {
  const cubes = [];
  const rec = (x, y, z, size, l) => {
    if (l === 0) { cubes.push([x, y, z, size]); return; }
    const n = size / 3;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      if ((i === 0 && j === 0) || (i === 0 && k === 0) || (j === 0 && k === 0)) continue;
      rec(x + i * n, y + j * n, z + k * n, n, l - 1);
    }
  };
  rec(0, 0, 0, s, level);
  return mergeGeometries(cubes.map(([x, y, z, n]) => new THREE.BoxGeometry(n, n, n).translate(x, y, z)));
}

function sierpinski(level, s) {
  const tets = [];
  const base = [[1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1]].map(v => new THREE.Vector3(...v).multiplyScalar(s / (2 * Math.SQRT2)));
  const rec = (verts, l) => {
    if (l === 0) { tets.push(verts); return; }
    for (let i = 0; i < 4; i++) rec(verts.map(v => v.clone().add(verts[i]).multiplyScalar(0.5)), l - 1);
  };
  rec(base, level);
  const pos = [];
  for (const [a, b, c, d] of tets) for (const f of [[a, b, c], [a, c, d], [a, d, b], [b, d, c]]) for (const v of f) pos.push(v.x, v.y, v.z);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // Rotate so one face sits flat on the ground.
  g.lookAt(new THREE.Vector3(1, 1, 1));
  return g;
}

/* ---------------- 2D outlines ---------------- */

function starShape(points, outer, inner) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer, a = Math.PI / 2 + i * Math.PI / points;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return shapeFrom(pts, outer * 0.02);
}

function heartShape(s) {
  const h = new THREE.Shape();
  const k = s / 2;
  h.moveTo(0, -k * 0.9);
  h.bezierCurveTo(k * 0.2, -k * 0.6, k * 1.05, -k * 0.2, k * 1.0, k * 0.35);
  h.bezierCurveTo(k * 0.95, k * 0.95, k * 0.25, k * 1.05, 0, k * 0.55);
  h.bezierCurveTo(-k * 0.25, k * 1.05, -k * 0.95, k * 0.95, -k * 1.0, k * 0.35);
  h.bezierCurveTo(-k * 1.05, -k * 0.2, -k * 0.2, -k * 0.6, 0, -k * 0.9);
  return h;
}

function gearShape(teeth, rOuter, rRoot, rHole) {
  const pts = [];
  const step = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    pts.push([Math.cos(a - step * 0.28) * rRoot, Math.sin(a - step * 0.28) * rRoot]);
    pts.push([Math.cos(a - step * 0.14) * rOuter, Math.sin(a - step * 0.14) * rOuter]);
    pts.push([Math.cos(a + step * 0.14) * rOuter, Math.sin(a + step * 0.14) * rOuter]);
    pts.push([Math.cos(a + step * 0.28) * rRoot, Math.sin(a + step * 0.28) * rRoot]);
  }
  const s = shapeFrom(pts, rOuter * 0.012);
  if (rHole > 0) s.holes.push(circlePath(rHole));
  return s;
}

/* ---------------- the catalogue ---------------- */

export const SHAPES = [
  // ---- basic
  { id: 'cube', name: 'Cube', level: 'basic', aliases: ['box', 'block', 'cuboid'], params: { width: P.width, height: P.height, depth: P.depth },
    build: (q) => new THREE.BoxGeometry(num(q.width, 0.3), num(q.height, 0.3), num(q.depth, 0.3)) },
  { id: 'sphere', name: 'Sphere', level: 'basic', aliases: ['ball', 'orb'], params: { radius: P.radius, segments: P.segments },
    build: (q) => new THREE.SphereGeometry(num(q.radius, 0.15), int(q.segments, 48), Math.max(8, int(q.segments, 48) >> 1)) },
  { id: 'cylinder', name: 'Cylinder', level: 'basic', aliases: ['column', 'rod', 'can'], params: { radius: P.radius, height: P.height, segments: P.segments },
    build: (q) => new THREE.CylinderGeometry(num(q.radius, 0.15), num(q.radius, 0.15), num(q.height, 0.3), int(q.segments, 48)) },
  { id: 'cone', name: 'Cone', level: 'basic', aliases: [], params: { radius: P.radius, height: P.height, segments: P.segments },
    build: (q) => new THREE.ConeGeometry(num(q.radius, 0.15), num(q.height, 0.3), int(q.segments, 48)) },
  { id: 'pyramid', name: 'Pyramid', level: 'basic', aliases: ['square pyramid'], params: { width: P.width, height: P.height },
    build: (q) => new THREE.ConeGeometry(num(q.width, 0.3) / Math.SQRT2, num(q.height, 0.3), 4).rotateY(Math.PI / 4) },
  { id: 'torus', name: 'Torus', level: 'basic', aliases: ['donut', 'doughnut', 'ring torus'], params: { radius: P.radius, tube: p(P.radius, { label: 'Tube radius', default: 0.05 }), segments: P.segments },
    build: (q) => new THREE.TorusGeometry(num(q.radius, 0.15), num(q.tube, 0.05), Math.max(8, int(q.segments, 48) >> 1), int(q.segments, 48) * 2).rotateX(Math.PI / 2) },
  { id: 'capsule', name: 'Capsule', level: 'basic', aliases: ['pill'], params: { radius: p(P.radius, { default: 0.08 }), height: P.height },
    build: (q) => new THREE.CapsuleGeometry(num(q.radius, 0.08), Math.max(0.001, num(q.height, 0.3) - 2 * num(q.radius, 0.08)), 10, 24) },
  { id: 'hemisphere', name: 'Hemisphere', level: 'basic', aliases: ['dome', 'half sphere'], params: { radius: P.radius, segments: P.segments },
    build: (q) => new THREE.SphereGeometry(num(q.radius, 0.15), int(q.segments, 48), Math.max(6, int(q.segments, 48) >> 2), 0, TAU, 0, Math.PI / 2) },
  { id: 'plane', name: 'Plane', level: 'basic', aliases: ['square', 'sheet'], params: { width: P.width, depth: P.depth },
    build: (q) => new THREE.PlaneGeometry(num(q.width, 0.3), num(q.depth, 0.3)).rotateX(-Math.PI / 2) },
  { id: 'disc', name: 'Disc', level: 'basic', aliases: ['circle', 'disk', 'coin'], params: { radius: P.radius, height: p(P.height, { label: 'Thickness', default: 0.01 }) },
    build: (q) => new THREE.CylinderGeometry(num(q.radius, 0.15), num(q.radius, 0.15), num(q.height, 0.01), 64) },
  { id: 'tube', name: 'Tube', level: 'basic', aliases: ['pipe', 'hollow cylinder'], params: { radius: P.radius, wall: p(P.radius, { label: 'Wall', min: 0.002, default: 0.02 }), height: P.height },
    build: (q) => { const r = num(q.radius, 0.15), w = Math.min(num(q.wall, 0.02), r * 0.95); const s = new THREE.Shape(); s.absarc(0, 0, r, 0, TAU); s.holes.push(circlePath(r - w)); return extrudeShape(s, num(q.height, 0.3), 0, 48).rotateX(Math.PI / 2); } },
  { id: 'prism', name: 'Triangular prism', level: 'basic', aliases: ['prism', 'wedge prism', 'toblerone'], params: { width: P.width, height: P.height, depth: P.depth },
    build: (q) => { const w = num(q.width, 0.3), h = num(q.height, 0.26); return extrudeShape(shapeFrom([[-w / 2, -h / 2], [w / 2, -h / 2], [0, h / 2]]), num(q.depth, 0.3)); } },
  { id: 'tetrahedron', name: 'Tetrahedron', level: 'basic', aliases: ['d4', 'triangular pyramid'], params: { radius: P.radius },
    build: (q) => new THREE.TetrahedronGeometry(num(q.radius, 0.15)) },
  { id: 'octahedron', name: 'Octahedron', level: 'basic', aliases: ['d8', 'diamond'], params: { radius: P.radius },
    build: (q) => new THREE.OctahedronGeometry(num(q.radius, 0.15)) },
  { id: 'dodecahedron', name: 'Dodecahedron', level: 'basic', aliases: ['d12'], params: { radius: P.radius },
    build: (q) => new THREE.DodecahedronGeometry(num(q.radius, 0.15)) },
  { id: 'icosahedron', name: 'Icosahedron', level: 'basic', aliases: ['d20'], params: { radius: P.radius },
    build: (q) => new THREE.IcosahedronGeometry(num(q.radius, 0.15)) },

  // ---- intermediate
  { id: 'rounded-box', name: 'Rounded box', level: 'intermediate', aliases: ['rounded cube', 'soft box'], params: { width: P.width, height: P.height, depth: P.depth, round: p(P.radius, { label: 'Corner radius', min: 0, default: 0.04 }) },
    build: (q) => { const w = num(q.width, 0.3), h = num(q.height, 0.3), d = num(q.depth, 0.3); return new RoundedBoxGeometry(w, h, d, 5, Math.min(num(q.round, 0.04), Math.min(w, h, d) / 2 - 1e-4)); } },
  { id: 'geodesic-sphere', name: 'Geodesic sphere', level: 'intermediate', aliases: ['geodesic dome', 'geosphere', 'icosphere'], params: { radius: P.radius, detail: { label: 'Detail', min: 0, max: 5, step: 1, default: 2 } },
    build: (q) => { const g = new THREE.IcosahedronGeometry(num(q.radius, 0.15), int(q.detail, 2)); return g; }, flat: true },
  { id: 'hex-prism', name: 'Hexagonal prism', level: 'intermediate', aliases: ['hexagon', 'hex prism', 'hex nut'], params: { radius: P.radius, height: p(P.height, { default: 0.12 }) },
    build: (q) => new THREE.CylinderGeometry(num(q.radius, 0.15), num(q.radius, 0.15), num(q.height, 0.12), 6), flat: true },
  { id: 'star', name: 'Star', level: 'intermediate', aliases: ['star shape'], params: { points: { label: 'Points', min: 3, max: 16, step: 1, default: 5 }, radius: P.radius, inner: { label: 'Inner ratio', min: 0.15, max: 0.9, step: 0.01, default: 0.45 }, depth: p(P.depth, { label: 'Thickness', default: 0.05 }) },
    build: (q) => extrudeShape(starShape(int(q.points, 5), num(q.radius, 0.15), num(q.radius, 0.15) * num(q.inner, 0.45)), num(q.depth, 0.05), 0.006) },
  { id: 'heart', name: 'Heart', level: 'intermediate', aliases: ['love heart'], params: { size: P.size, depth: p(P.depth, { label: 'Thickness', default: 0.07 }) },
    build: (q) => extrudeShape(heartShape(num(q.size, 0.3)), num(q.depth, 0.07), 0.015, 32) },
  { id: 'gear', name: 'Gear', level: 'intermediate', aliases: ['cog', 'cogwheel', 'sprocket'], params: { teeth: { label: 'Teeth', min: 6, max: 80, step: 1, default: 18 }, radius: P.radius, hole: p(P.radius, { label: 'Bore radius', min: 0, default: 0.03 }), depth: p(P.depth, { label: 'Thickness', default: 0.04 }) },
    build: (q) => { const r = num(q.radius, 0.15), t = int(q.teeth, 18); const tooth = Math.min(r * 0.18, (TAU * r / t) * 0.5); return extrudeShape(gearShape(t, r, r - tooth, Math.min(num(q.hole, 0.03), r * 0.6)), num(q.depth, 0.04), 0.002).rotateX(Math.PI / 2); } },
  { id: 'spring', name: 'Spring / helix', level: 'intermediate', aliases: ['helix', 'coil', 'spiral spring'], params: { radius: P.radius, wire: p(P.radius, { label: 'Wire radius', min: 0.002, default: 0.012 }), turns: { label: 'Turns', min: 1, max: 40, step: 0.5, default: 8 }, height: P.height },
    build: (q) => { const R = num(q.radius, 0.1), turns = num(q.turns, 8), h = num(q.height, 0.3); const curve = new THREE.Curve(); curve.getPoint = (t, v = new THREE.Vector3()) => v.set(Math.cos(t * turns * TAU) * R, t * h - h / 2, Math.sin(t * turns * TAU) * R); return new THREE.TubeGeometry(curve, Math.round(turns * 48), num(q.wire, 0.012), 12, false); } },
  { id: 'arrow', name: 'Arrow', level: 'intermediate', aliases: ['pointer'], params: { size: P.size, depth: p(P.depth, { label: 'Thickness', default: 0.04 }) },
    build: (q) => { const s = num(q.size, 0.3); return extrudeShape(shapeFrom([[-s / 2, -s * 0.08], [s * 0.1, -s * 0.08], [s * 0.1, -s * 0.22], [s / 2, 0], [s * 0.1, s * 0.22], [s * 0.1, s * 0.08], [-s / 2, s * 0.08]], s * 0.01), num(q.depth, 0.04), 0.004); } },
  { id: 'cross', name: 'Cross / plus', level: 'intermediate', aliases: ['plus', 'plus sign'], params: { size: P.size, depth: p(P.depth, { label: 'Thickness', default: 0.06 }) },
    build: (q) => { const s = num(q.size, 0.3) / 2, a = s / 3; return extrudeShape(shapeFrom([[-a, s], [a, s], [a, a], [s, a], [s, -a], [a, -a], [a, -s], [-a, -s], [-a, -a], [-s, -a], [-s, a], [-a, a]], s * 0.03), num(q.depth, 0.06), 0.005); } },
  { id: 'l-bracket', name: 'L-bracket', level: 'intermediate', aliases: ['angle bracket', 'l shape'], params: { size: P.size, thickness: p(P.depth, { label: 'Thickness', default: 0.03 }), depth: p(P.depth, { label: 'Width', default: 0.08 }) },
    build: (q) => { const s = num(q.size, 0.3), t = num(q.thickness, 0.03); return extrudeShape(shapeFrom([[0, 0], [s, 0], [s, t], [t, t, t * 0.8], [t, s], [0, s]], 0.002), num(q.depth, 0.08), 0.002).translate(-s / 2, -s / 2, 0); } },
  { id: 'stairs', name: 'Staircase', level: 'intermediate', aliases: ['steps', 'stairs'], params: { steps: { label: 'Steps', min: 2, max: 30, step: 1, default: 8 }, width: P.width, height: p(P.height, { default: 1.4 }), depth: p(P.depth, { default: 2.2 }) },
    build: (q) => { const n = int(q.steps, 8), W = num(q.width, 0.9), H = num(q.height, 1.4), D = num(q.depth, 2.2); const pts = [[0, 0], [D, 0]]; for (let i = n; i >= 1; i--) { pts.push([D * (i / n), H * (i / n)]); pts.push([D * ((i - 1) / n), H * (i / n)]); } return extrudeShape(shapeFrom(pts.slice(0, -1).concat([[0, H * (1 / n)]])), W).translate(-D / 2, -H / 2, 0); } },
  { id: 'vase', name: 'Vase (lathe)', level: 'intermediate', aliases: ['lathe', 'urn', 'amphora'], params: { height: p(P.height, { default: 0.35 }), radius: p(P.radius, { default: 0.1 }), segments: P.segments },
    build: (q) => { const h = num(q.height, 0.35), r = num(q.radius, 0.1); const prof = [[0, 0], [r * 0.55, 0], [r * 0.8, h * 0.08], [r, h * 0.35], [r * 0.7, h * 0.7], [r * 0.4, h * 0.86], [r * 0.52, h], [r * 0.46, h], [r * 0.34, h * 0.87], [r * 0.62, h * 0.68], [r * 0.92, h * 0.35], [r * 0.72, h * 0.1], [0, h * 0.06]].map(([x, y]) => new THREE.Vector2(x, y - h / 2)); return new THREE.LatheGeometry(prof, int(q.segments, 48)); } },
  { id: 'bowl', name: 'Bowl', level: 'intermediate', aliases: ['dish'], params: { radius: p(P.radius, { default: 0.12 }), segments: P.segments },
    build: (q) => { const r = num(q.radius, 0.12), w = r * 0.06; const pts = []; for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * r, r - Math.cos(a) * r * 0.75)); } for (let i = 16; i >= 0; i--) { const a = (i / 16) * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0, Math.sin(a) * (r - w)), r - Math.cos(a) * (r * 0.75 - w))); } return new THREE.LatheGeometry(pts, int(q.segments, 48)).translate(0, -r * 0.1, 0); } },
  { id: 'wedge', name: 'Wedge / ramp', level: 'intermediate', aliases: ['ramp', 'door wedge', 'incline'], params: { width: P.width, height: p(P.height, { default: 0.12 }), depth: p(P.depth, { default: 0.4 }) },
    build: (q) => { const d = num(q.depth, 0.4), h = num(q.height, 0.12); return extrudeShape(shapeFrom([[-d / 2, -h / 2], [d / 2, -h / 2], [-d / 2, h / 2]]), num(q.width, 0.3)); } },
  { id: 'chain-link', name: 'Chain link', level: 'intermediate', aliases: ['link', 'chain'], params: { size: p(P.size, { default: 0.12 }), wire: p(P.radius, { label: 'Wire radius', min: 0.002, default: 0.012 }) },
    build: (q) => { const s = num(q.size, 0.12), r = num(q.wire, 0.012); const a = s * 0.3, b = s * 0.2; const loop = new THREE.Shape(); loop.absarc(0, a, b, 0, Math.PI); loop.absarc(0, -a, b, Math.PI, TAU); const pts = loop.getSpacedPoints(96).map(p2 => new THREE.Vector3(p2.x, p2.y, 0)); return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 128, r, 12, true); } },

  // ---- advanced
  { id: 'torus-knot', name: 'Torus knot', level: 'advanced', aliases: ['knot', 'pq knot'], params: { radius: P.radius, tube: p(P.radius, { label: 'Tube radius', default: 0.035 }), p: { label: 'p (winds)', min: 1, max: 12, step: 1, default: 2 }, q: { label: 'q (loops)', min: 1, max: 20, step: 1, default: 3 } },
    build: (q) => new THREE.TorusKnotGeometry(num(q.radius, 0.12), num(q.tube, 0.035), 256, 24, int(q.p, 2), int(q.q, 3)) },
  { id: 'trefoil', name: 'Trefoil knot', level: 'advanced', aliases: ['trefoil'], params: { size: P.size, tube: p(P.radius, { label: 'Tube radius', default: 0.03 }) },
    build: (q) => { const s = num(q.size, 0.3) / 6; const c = new THREE.Curve(); c.getPoint = (t, v = new THREE.Vector3()) => { const a = t * TAU; return v.set(Math.sin(a) + 2 * Math.sin(2 * a), Math.cos(a) - 2 * Math.cos(2 * a), -Math.sin(3 * a)).multiplyScalar(s); }; return new THREE.TubeGeometry(c, 256, num(q.tube, 0.03), 20, true); } },
  { id: 'mobius', name: 'Möbius strip', level: 'advanced', aliases: ['mobius', 'moebius', 'möbius'], params: { radius: P.radius, width: p(P.width, { label: 'Band width', default: 0.08 }), twists: { label: 'Half-twists', min: 1, max: 7, step: 1, default: 1 } },
    build: (q) => { const R = num(q.radius, 0.15), w = num(q.width, 0.08), k = int(q.twists, 1); return parametric((u, v, t) => { const a = u * TAU, s = (v - 0.5) * w; t.set((R + s * Math.cos(k * a / 2)) * Math.cos(a), s * Math.sin(k * a / 2), (R + s * Math.cos(k * a / 2)) * Math.sin(a)); }, 160, 12); }, doubleSided: true },
  { id: 'klein-bottle', name: 'Klein bottle', level: 'advanced', aliases: ['klein'], params: { size: P.size },
    build: (q) => parametric((u, v, t) => klein(u, v, t, num(q.size, 0.3)), 96, 48), doubleSided: true },
  { id: 'superellipsoid', name: 'Superellipsoid', level: 'advanced', aliases: ['superquadric', 'squircle ball', 'superegg'], params: { radius: P.radius, e1: { label: 'Squareness N–S', min: 0.1, max: 3, step: 0.05, default: 0.3 }, e2: { label: 'Squareness E–W', min: 0.1, max: 3, step: 0.05, default: 0.3 } },
    build: (q) => { const r = num(q.radius, 0.15), e1 = num(q.e1, 0.3), e2 = num(q.e2, 0.3); return parametric((u, v, t) => { const th = (u - 0.5) * TAU, ph = (v - 0.5) * Math.PI; const cp = Math.cos(ph), sp = Math.sin(ph); t.set(sgnPow(cp, e1) * sgnPow(Math.cos(th), e2) * r, sgnPow(sp, e1) * r, sgnPow(cp, e1) * sgnPow(Math.sin(th), e2) * r); }, 96, 64); } },
  { id: 'supershape', name: 'Supershape', level: 'advanced', aliases: ['superformula', 'gielis'], params: { radius: P.radius, m: { label: 'Symmetry m', min: 0, max: 20, step: 1, default: 7 }, n1: { label: 'n1', min: 0.1, max: 10, step: 0.1, default: 0.2 }, n2: { label: 'n2', min: 0.1, max: 10, step: 0.1, default: 1.7 }, n3: { label: 'n3', min: 0.1, max: 10, step: 0.1, default: 1.7 } },
    build: (q) => { const r = num(q.radius, 0.15), m = num(q.m, 7), n1 = num(q.n1, 0.2), n2 = num(q.n2, 1.7), n3 = num(q.n3, 1.7); let max = 0; const g = parametric((u, v, t) => { const th = (u - 0.5) * TAU, ph = (v - 0.5) * Math.PI; const r1 = superformula(th, m, n1, n2, n3), r2 = superformula(ph, m, n1, n2, n3); t.set(r1 * Math.cos(th) * r2 * Math.cos(ph), r2 * Math.sin(ph), r1 * Math.sin(th) * r2 * Math.cos(ph)); max = Math.max(max, t.length()); }, 128, 96); g.scale(r / (max || 1), r / (max || 1), r / (max || 1)); return g; } },
  { id: 'seashell', name: 'Seashell', level: 'advanced', aliases: ['shell', 'nautilus', 'conch', 'snail shell'], params: { size: P.size, turns: { label: 'Turns', min: 1, max: 8, step: 0.25, default: 3.5 } },
    build: (q) => { const s = num(q.size, 0.3), n = num(q.turns, 3.5); const g = parametric((u, v, t) => { const a = u * n * TAU, b = v * TAU; const k = Math.exp(0.12 * a) / Math.exp(0.12 * n * TAU); t.set(k * Math.cos(a) * (1 + Math.cos(b)), -k * (1 + Math.sin(b)) * 1.1 + k * 1.6, k * Math.sin(a) * (1 + Math.cos(b))); }, 240, 32); g.scale(s / 4, s / 4, s / 4); return g; }, doubleSided: true },
  { id: 'menger-sponge', name: 'Menger sponge', level: 'advanced', aliases: ['menger', 'fractal cube', 'sponge'], params: { size: P.size, level: { label: 'Level', min: 0, max: 3, step: 1, default: 2 } },
    build: (q) => menger(Math.min(3, int(q.level, 2)), num(q.size, 0.3)), flat: true },
  { id: 'sierpinski', name: 'Sierpiński pyramid', level: 'advanced', aliases: ['sierpinski', 'sierpinski tetrahedron', 'tetrix', 'fractal pyramid'], params: { size: P.size, level: { label: 'Level', min: 0, max: 6, step: 1, default: 4 } },
    build: (q) => sierpinski(Math.min(6, int(q.level, 4)), num(q.size, 0.3)), flat: true },
  { id: 'helicoid', name: 'Helicoid', level: 'advanced', aliases: ['spiral ramp', 'screw surface'], params: { radius: P.radius, height: P.height, turns: { label: 'Turns', min: 0.5, max: 6, step: 0.25, default: 2 } },
    build: (q) => { const r = num(q.radius, 0.15), h = num(q.height, 0.3), n = num(q.turns, 2); return parametric((u, v, t) => { const a = u * n * TAU, s = v * r; t.set(s * Math.cos(a), u * h - h / 2, s * Math.sin(a)); }, 160, 12); }, doubleSided: true },
  { id: 'enneper', name: 'Enneper surface', level: 'advanced', aliases: ['enneper', 'minimal surface', 'saddle'], params: { size: P.size, extent: { label: 'Extent', min: 0.5, max: 2.2, step: 0.05, default: 1.4 } },
    build: (q) => { const s = num(q.size, 0.3), e = num(q.extent, 1.4); const g = parametric((u, v, t) => { const r = u * e, a = v * TAU; const x = r * Math.cos(a), y = r * Math.sin(a); t.set(x - x ** 3 / 3 + x * y * y, x * x - y * y, y - y ** 3 / 3 + y * x * x); }, 64, 96); g.scale(s / (2 * e * e), s / (2 * e * e), s / (2 * e * e)); return g; }, doubleSided: true },
  { id: 'dini', name: "Dini's surface", level: 'advanced', aliases: ['dini', 'twisted pseudosphere'], params: { size: P.size, twist: { label: 'Twist', min: 0.05, max: 0.6, step: 0.01, default: 0.2 } },
    build: (q) => { const s = num(q.size, 0.3), b = num(q.twist, 0.2); const g = parametric((u, v, t) => { const U = u * 4 * Math.PI, V = 0.02 + v * 1.8; t.set(Math.cos(U) * Math.sin(V), Math.cos(V) + Math.log(Math.tan(V / 2)) + b * U, Math.sin(U) * Math.sin(V)); }, 192, 48); g.computeBoundingBox(); const bb = g.boundingBox, k = s / Math.max(bb.max.y - bb.min.y, 1e-3); g.scale(k, k, k); return g; }, doubleSided: true },
  { id: 'hyperboloid', name: 'Hyperboloid', level: 'advanced', aliases: ['cooling tower', 'hyperbolic'], params: { radius: P.radius, height: P.height, waist: { label: 'Waist ratio', min: 0.2, max: 1, step: 0.01, default: 0.55 } },
    build: (q) => { const r = num(q.radius, 0.15), h = num(q.height, 0.3), w = num(q.waist, 0.55); const c = h / 2 / Math.sqrt(Math.max(1e-3, 1 / (w * w) - 1)); const pts = []; for (let i = 0; i <= 32; i++) { const y = -h / 2 + h * i / 32; pts.push(new THREE.Vector2(r * w * Math.sqrt(1 + (y * y) / (c * c)), y)); } return new THREE.LatheGeometry(pts, 96); }, doubleSided: true },
  { id: 'spherical-harmonic', name: 'Spherical harmonic', level: 'advanced', aliases: ['harmonic blob', 'bourke'], params: { size: P.size, m1: { label: 'm1', min: 0, max: 8, step: 1, default: 4 }, m2: { label: 'm2', min: 0, max: 8, step: 1, default: 3 }, m3: { label: 'm3', min: 0, max: 8, step: 1, default: 2 }, m4: { label: 'm4', min: 0, max: 8, step: 1, default: 6 } },
    build: (q) => { const s = num(q.size, 0.3); const m = [int(q.m1, 4), 2, int(q.m2, 3), 4, int(q.m3, 2), 2, int(q.m4, 6), 4]; let max = 0; const g = parametric((u, v, t) => { const th = u * TAU, ph = v * Math.PI; const r = Math.pow(Math.sin(m[0] * ph), m[1]) + Math.pow(Math.cos(m[2] * ph), m[3]) + Math.pow(Math.sin(m[4] * th), m[5]) + Math.pow(Math.cos(m[6] * th), m[7]); t.set(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)); max = Math.max(max, t.length()); }, 128, 128); g.scale(s / 2 / (max || 1), s / 2 / (max || 1), s / 2 / (max || 1)); return g; }, doubleSided: true },
  { id: 'twisted-torus', name: 'Twisted torus', level: 'advanced', aliases: ['twisted ring'], params: { radius: P.radius, tube: p(P.radius, { label: 'Section size', default: 0.05 }), sides: { label: 'Section sides', min: 3, max: 8, step: 1, default: 4 }, twist: { label: 'Twist steps', min: 0, max: 8, step: 1, default: 1 } },
    build: (q) => {
      const R = num(q.radius, 0.15), r = num(q.tube, 0.05), n = int(q.sides, 4), tw = int(q.twist, 1), seg = TAU / n;
      // Polygonal section (vertex at b = 0); a whole number of 1/n turns keeps the ends aligned.
      return parametric((u, v, t) => {
        const a = u * TAU, b = v * TAU, phi = a * tw / n;
        const rr = r * Math.cos(Math.PI / n) / Math.cos((b % seg) - Math.PI / n);
        t.set((R + rr * Math.cos(b + phi)) * Math.cos(a), rr * Math.sin(b + phi), (R + rr * Math.cos(b + phi)) * Math.sin(a));
      }, 192, n * 12);
    }, flat: true },
];

export const SHAPE_BY_ID = new Map(SHAPES.map(s => [s.id, s]));
export const SHAPE_LEVELS = [['basic', 'Basic'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']];

export function shapeDefaults(id) {
  const s = SHAPE_BY_ID.get(id);
  if (!s) return {};
  return Object.fromEntries(Object.entries(s.params).map(([k, v]) => [k, v.default]));
}

/** Geometry for a shape, sitting on y = 0, centred on x/z. */
export function buildShapeGeometry(id, params = {}) {
  const s = SHAPE_BY_ID.get(id);
  if (!s) throw new Error(`Unknown shape "${id}".`);
  const q = { ...shapeDefaults(id), ...clampParams(id, params) };
  let g = s.build(q);
  if (s.flat) { g = g.index ? g.toNonIndexed() : g; g.computeVertexNormals(); }
  g.computeBoundingBox();
  const bb = g.boundingBox;
  g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

export function clampParams(id, params = {}) {
  const s = SHAPE_BY_ID.get(id);
  const out = {};
  if (!s) return out;
  for (const [k, def] of Object.entries(s.params)) {
    if (params[k] == null || params[k] === '') continue;
    const v = Number(params[k]);
    if (!Number.isFinite(v)) continue;
    out[k] = Math.min(def.max ?? Infinity, Math.max(def.min ?? -Infinity, v));
  }
  return out;
}

export { roundRect };
