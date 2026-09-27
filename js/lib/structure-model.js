/* ============================================================
   TOOLBOX — Structure modeller (scene description → geometry list)

   The Assistant describes a 3D structure as JSON; this module expands
   it into plain primitives and structural members that
   structure-mesh.js turns into three.js meshes. Pure (three.js maths
   only, no DOM), so it runs in node for tests and for the numbers it
   reports back: size, member counts and a steel/timber takeoff.

   Spec: { title, environment: 'outdoor'|'studio', objects: [node, …] }
   Every node may carry at [x,y,z] (metres, y up), rotate [rx,ry,rz]
   (degrees), scale, material (see MATERIAL_KINDS), color '#rrggbb',
   name and label (a text tag shown in the view).

   Primitives: box {size}, cylinder {radius, radiusTop, height},
   cone {radius, height}, sphere {radius, hemisphere}, torus {radius,
   tube, arc}, plane {size}, extrude {points [[x,z]…] (plan outline),
   height, holes}, lathe {profile [[r,y]…]}, tube {path [[x,y,z]…],
   radius, closed}, mesh {vertices [[x,y,z]…], faces [[i,j,k]…]},
   member {from, to, section} (beam/column/brace/cable),
   polyline {points, section, closed} (members joining points).
   Composition: group {children}, array {item, count, step, rotateStep}
   or polar array {item, count, around: {center, axis, angle}},
   mirror {item, axis}.
   Generators: truss, space_frame, tower, stair, arch, dome, bridge,
   frame (multi-storey building), hypar, wall, roof, column_grid,
   tree, person. See GENERATORS for their parameters.
   ============================================================ */

import { Matrix4, Vector3, Euler, Quaternion } from 'three';

export const LIMITS = { members: 20000, prims: 6000, nodes: 20000, depth: 10, arrayCount: 600 };

const num = (v, d = 0) => { const n = typeof v === 'string' ? parseFloat(v) : v; return Number.isFinite(n) ? n : d; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const v3 = (a, d = [0, 0, 0]) => (Array.isArray(a) ? [num(a[0], d[0]), num(a[1], d[1]), num(a[2], d[2])] : typeof a === 'object' && a ? [num(a.x, d[0]), num(a.y, d[1]), num(a.z, d[2])] : [...d]);
const r3 = (v) => Math.round(v * 1000) / 1000;
const DEG = Math.PI / 180;

/* ---------------- sections ---------------- */

const DENSITY = { steel: 7850, galvanised: 7850, paint: 7850, aluminium: 2700, chrome: 7850, timber: 500, 'floor-timber': 500, concrete: 2400, render: 1800, brick: 1900, block: 1400, marble: 2700, glass: 2500, copper: 8900, gold: 19300 };

/**
 * Parses a section: "RHS 100x50x4", "SHS 60x3", "CHS 114.3x5", "UB 305x165x40",
 * "UC 203x203x46", "IPE 300", "rod 20", "cable 40", "200x300" (solid, mm),
 * a number (round, metres) or { shape, w, h, t, d } in metres.
 * Returns { shape: 'rect'|'round'|'I', w, h (m), area (m²), kgm (if known), name }.
 */
export function parseSection(sec, fallback = 0.1) {
  if (sec && typeof sec === 'object' && !Array.isArray(sec)) {
    const shape = /round|chs|rod|cable|circ/i.test(sec.shape || '') ? 'round' : /^i|ub|uc|ipe|hea|heb/i.test(sec.shape || '') ? 'I' : 'rect';
    const w = num(sec.w ?? sec.width ?? sec.d ?? sec.diameter, fallback), h = num(sec.h ?? sec.height ?? sec.depth ?? w, w);
    const t = num(sec.t ?? sec.thickness, 0);
    return withArea({ shape, w, h, t, name: sec.name || `${Math.round(w * 1000)}×${Math.round(h * 1000)}` });
  }
  if (Array.isArray(sec)) return withArea({ shape: 'rect', w: num(sec[0], fallback), h: num(sec[1], num(sec[0], fallback)), t: 0, name: `${Math.round(num(sec[0]) * 1000)}×${Math.round(num(sec[1], sec[0]) * 1000)}` });
  if (typeof sec === 'number') return withArea({ shape: 'round', w: sec, h: sec, t: 0, name: `Ø${Math.round(sec * 1000)}` });
  const s = String(sec || '').trim();
  if (!s) return withArea({ shape: 'rect', w: fallback, h: fallback, t: 0, name: `${Math.round(fallback * 1000)} sq` });
  const nums = (s.match(/\d+(\.\d+)?/g) || []).map(Number);
  const mm = (v) => v / 1000;
  if (/^(rhs|shs|box|tube)/i.test(s)) {
    // RHS h × b × t; SHS a × t or a × a × t.
    let h, b, t;
    if (/^shs/i.test(s) && nums.length === 2) [h, b, t] = [nums[0], nums[0], nums[1]];
    else [h, b = h, t] = nums;
    h = h || 100; b = b || h; t = t || Math.max(3, h / 25);
    return withArea({ shape: 'rect', w: mm(b), h: mm(h), t: mm(t), hollow: true, name: s.toUpperCase().replace(/\s*X\s*/g, ' × ') });
  }
  if (/^(pfc|channel|c\s)/i.test(s)) {
    // Parallel flange channel h × b: web and two flanges about h/25 thick.
    const h = nums[0] || 200, b = nums[1] || h * 0.45, t = Math.max(6, h / 25);
    const area = mm(mm(2 * b * t + (h - 2 * t) * t * 0.8));
    return { shape: 'rect', w: mm(b), h: mm(h), t: mm(t), area, name: s.toUpperCase().replace(/\s*X\s*/g, ' × ') };
  }
  if (/^(chs|pipe)/i.test(s)) {
    const [d, t = Math.max(3, nums[0] / 25)] = nums;
    return withArea({ shape: 'round', w: mm(d), h: mm(d), t: mm(t), hollow: true, name: s.toUpperCase() });
  }
  if (/^(ub|uc|ipe|hea|heb|i\b|w\d)/i.test(s)) {
    const depth = nums[0] || 300, width = nums.length >= 2 ? nums[1] : depth * 0.55;
    const kgm = nums.length >= 3 ? nums[2] : null;
    return withArea({ shape: 'I', w: mm(width), h: mm(depth), t: mm(Math.max(6, depth / 30)), kgm, name: s.toUpperCase() });
  }
  if (/^(rod|bar|cable|strand|dowel)/i.test(s)) return withArea({ shape: 'round', w: mm(nums[0] || 20), h: mm(nums[0] || 20), t: 0, name: s });
  if (nums.length >= 2) return withArea({ shape: 'rect', w: mm(nums[0]), h: mm(nums[1]), t: 0, name: `${nums[0]} × ${nums[1]}` });
  if (nums.length === 1) return withArea({ shape: 'round', w: mm(nums[0]), h: mm(nums[0]), t: 0, name: `Ø${nums[0]}` });
  return withArea({ shape: 'rect', w: fallback, h: fallback, t: 0, name: s });
}
function withArea(sec) {
  const { shape, w, h, t } = sec;
  let area;
  if (shape === 'round') area = t ? Math.PI * (w - t) * t : Math.PI * w * w / 4;
  else if (shape === 'I') area = 2 * w * t + (h - 2 * t) * t * 0.6;
  else area = t ? 2 * t * (w + h) - 4 * t * t : w * h;
  return { ...sec, w: Math.max(0.004, w), h: Math.max(0.004, h), area };
}

/* ---------------- the expansion context ---------------- */

class Ctx {
  constructor() {
    this.prims = []; this.members = []; this.nodes = []; this.labels = []; this.warnings = [];
    this.truncated = false;
  }
  warn(t) { if (this.warnings.length < 30 && !this.warnings.includes(t)) this.warnings.push(t); }
  prim(shape, params, M, style) {
    if (this.prims.length >= LIMITS.prims) { this.truncated = true; return; }
    this.prims.push({ shape, params, matrix: M.toArray(), material: style.material, color: style.color, name: style.name || null, opacity: style.opacity });
  }
  member(a, b, section, M, style) {
    if (this.members.length >= LIMITS.members) { this.truncated = true; return; }
    const A = new Vector3(...a).applyMatrix4(M), B = new Vector3(...b).applyMatrix4(M);
    if (A.distanceTo(B) < 1e-4) return;
    this.members.push({ a: A.toArray().map(r3), b: B.toArray().map(r3), section, material: style.material, color: style.color, role: style.role || null });
  }
  node(p, radius, M, style) {
    if (this.nodes.length >= LIMITS.nodes) { this.truncated = true; return; }
    const P = new Vector3(...p).applyMatrix4(M);
    this.nodes.push({ p: P.toArray().map(r3), radius, material: style.material, color: style.color });
  }
  label(text, p, M) { if (text && this.labels.length < 60) this.labels.push({ text: String(text).slice(0, 60), p: new Vector3(...p).applyMatrix4(M).toArray().map(r3) }); }
}

function nodeMatrix(n) {
  const M = new Matrix4();
  const at = v3(n.at ?? n.position);
  const rot = v3(n.rotate ?? n.rotation);
  const sc = n.scale == null ? [1, 1, 1] : typeof n.scale === 'number' ? [n.scale, n.scale, n.scale] : v3(n.scale, [1, 1, 1]);
  M.compose(new Vector3(...at), new Quaternion().setFromEuler(new Euler(rot[0] * DEG, rot[1] * DEG, rot[2] * DEG, 'YXZ')), new Vector3(...sc));
  return M;
}
const styleOf = (n, parent, defaults = {}) => ({
  material: n.material || defaults.material || parent.material || 'paint',
  color: n.color || defaults.color || parent.color || null,
  opacity: n.opacity ?? parent.opacity,
  name: n.name || null,
});

/* ---------------- generators ---------------- */

/** Planar truss in the XY plane from x = 0 to span. Returns { top, bottom, members:[[a,b,role]] }. */
export function trussMembers({ kind = 'pratt', span = 12, height = 1.5, panels = 0 }) {
  span = clamp(num(span, 12), 0.5, 500); height = clamp(num(height, span / 8), 0.1, 100);
  let n = Math.round(num(panels, 0)) || Math.max(2, Math.round(span / Math.max(height, 1)));
  if (n % 2) n += 1;
  n = clamp(n, 2, 200);
  const p = span / n;
  const members = [];
  const m = (a, b, role) => members.push([a, b, role]);
  const bottom = Array.from({ length: n + 1 }, (_, i) => [i * p, 0, 0]);
  const k = String(kind).toLowerCase();
  const pitched = /fink|king|queen|pitch|scissor|howe-pitched|gable|triang/.test(k);
  const topY = (x) => (pitched ? height * (1 - Math.abs(2 * x / span - 1)) : height);
  const top = bottom.map(([x]) => [x, topY(x), 0]);
  for (let i = 0; i < n; i++) m(bottom[i], bottom[i + 1], 'bottom chord');
  if (/warren/.test(k) && !pitched) {
    const tops = Array.from({ length: n }, (_, i) => [(i + 0.5) * p, height, 0]);
    for (let i = 0; i < n - 1; i++) m(tops[i], tops[i + 1], 'top chord');
    for (let i = 0; i < n; i++) { m(bottom[i], tops[i], 'diagonal'); m(tops[i], bottom[i + 1], 'diagonal'); }
    if (/vert/.test(k)) for (let i = 1; i < n; i++) m(bottom[i], [i * p, height, 0], 'vertical');
    return { top: tops, bottom, members };
  }
  for (let i = 0; i < n; i++) m(top[i], top[i + 1], 'top chord');
  const mid = n / 2;
  for (let i = 0; i <= n; i++) if (top[i][1] - bottom[i][1] > 1e-6) m(bottom[i], top[i], 'vertical');
  if (/^k/.test(k)) {
    for (let i = 0; i < n; i++) {
      const j = i < mid ? i + 1 : i;
      const midV = [j * p, topY(j * p) / 2, 0];
      const from = i < mid ? i : i + 1;
      m(top[from], midV, 'diagonal'); m(bottom[from], midV, 'diagonal');
    }
  } else {
    // Pratt: diagonals in tension, sloping down towards mid-span. Howe: the reverse.
    const howe = /howe/.test(k);
    for (let i = 0; i < n; i++) {
      const left = i < mid;
      const downToMid = left ? [top[i], bottom[i + 1]] : [bottom[i], top[i + 1]];
      const upToMid = left ? [bottom[i], top[i + 1]] : [top[i], bottom[i + 1]];
      const [a, b] = howe ? upToMid : downToMid;
      m(a, b, 'diagonal');
    }
  }
  return { top, bottom, members };
}

function geodesic(freq) {
  // Icosahedron, each face split into freq² triangles, pushed onto the unit sphere.
  const t = (1 + Math.sqrt(5)) / 2;
  const V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(p => new Vector3(...p).normalize());
  const F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const pts = [], key = new Map(), edges = new Set(), faces = [];
  const idx = (v) => {
    const k = `${v.x.toFixed(5)},${v.y.toFixed(5)},${v.z.toFixed(5)}`;
    if (!key.has(k)) { key.set(k, pts.length); pts.push(v); }
    return key.get(k);
  };
  for (const [a, b, c] of F) {
    const A = V[a], B = V[b], C = V[c];
    const grid = [];
    for (let i = 0; i <= freq; i++) {
      grid[i] = [];
      for (let j = 0; j <= freq - i; j++) {
        const p = A.clone().multiplyScalar(1 - (i + j) / freq).addScaledVector(B, i / freq).addScaledVector(C, j / freq).normalize();
        grid[i][j] = idx(p);
      }
    }
    for (let i = 0; i < freq; i++) for (let j = 0; j < freq - i; j++) {
      const tri = [[grid[i][j], grid[i + 1][j], grid[i][j + 1]]];
      if (j < freq - i - 1) tri.push([grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]]);
      for (const f of tri) { faces.push(f); for (let e = 0; e < 3; e++) { const u = f[e], w = f[(e + 1) % 3]; edges.add(u < w ? `${u}-${w}` : `${w}-${u}`); } }
    }
  }
  return { pts, edges: [...edges].map(e => e.split('-').map(Number)), faces };
}

/** Rotation that turns +Y towards the ground plane direction `angle` (radians about Y). */
const yRot = (angle) => new Matrix4().makeRotationY(angle);

const GEN = {
  truss(n, M, st, ctx) {
    const { members, top, bottom } = trussMembers(n);
    const chord = parseSection(n.chord ?? n.section ?? 'RHS 100x100x5');
    const web = parseSection(n.web ?? n.section ?? 'SHS 60x60x4');
    const depth = num(n.depth ?? n.width, 0);
    const planes = depth > 0 ? [-depth / 2, depth / 2] : [0];
    for (const z of planes) for (const [a, b, role] of members) ctx.member([a[0], a[1], z], [b[0], b[1], z], /chord/.test(role) ? chord : web, M, { ...st, role });
    if (depth > 0) {
      // Box truss: ties between the two planes and plan bracing in the top and bottom chords.
      for (const line of [top, bottom]) {
        line.forEach((p, i) => {
          ctx.member([p[0], p[1], -depth / 2], [p[0], p[1], depth / 2], web, M, { ...st, role: 'tie' });
          if (i && n.bracing !== false) ctx.member([line[i - 1][0], line[i - 1][1], -depth / 2], [p[0], p[1], depth / 2], web, M, { ...st, role: 'plan brace' });
        });
      }
    }
    if (n.nodes !== false) for (const p of [...top, ...bottom]) for (const z of planes) ctx.node([p[0], p[1], z], chord.w * 0.7, M, st);
  },

  space_frame(n, M, st, ctx) {
    const sz = Array.isArray(n.size) ? n.size : [12, 12];
    const [X, Z] = sz.length >= 3 ? [num(sz[0], 12), num(sz[2], 12)] : [num(sz[0], 12), num(sz[1], num(sz[0], 12))];
    const g = clamp(num(n.grid ?? n.module, 1.5), 0.3, 20), d = clamp(num(n.depth, g * 0.7), 0.1, 20);
    const nx = clamp(Math.round(X / g), 1, 80), nz = clamp(Math.round(Z / g), 1, 80);
    const sec = parseSection(n.section ?? 'CHS 60x3');
    const T = (i, j) => [i * g, d, j * g], B = (i, j) => [(i + 0.5) * g, 0, (j + 0.5) * g];
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
      if (i < nx) ctx.member(T(i, j), T(i + 1, j), sec, M, { ...st, role: 'top chord' });
      if (j < nz) ctx.member(T(i, j), T(i, j + 1), sec, M, { ...st, role: 'top chord' });
      ctx.node(T(i, j), sec.w * 1.3, M, st);
    }
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      if (i < nx - 1) ctx.member(B(i, j), B(i + 1, j), sec, M, { ...st, role: 'bottom chord' });
      if (j < nz - 1) ctx.member(B(i, j), B(i, j + 1), sec, M, { ...st, role: 'bottom chord' });
      for (const [a, b] of [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]]) ctx.member(B(i, j), T(a, b), sec, M, { ...st, role: 'diagonal' });
      ctx.node(B(i, j), sec.w * 1.3, M, st);
    }
    if (n.columns) {
      const h = num(n.columns.height ?? n.columns, 6);
      const col = parseSection(n.columns.section ?? 'CHS 219x8');
      for (const [i, j] of [[0, 0], [nx, 0], [0, nz], [nx, nz]]) ctx.member([i * g, -h, j * g], [i * g, 0, j * g], col, M, { ...st, role: 'column' });
    }
    if (n.roof) ctx.prim('box', { size: [nx * g, 0.03, nz * g] }, M.clone().multiply(new Matrix4().makeTranslation(nx * g / 2, d + 0.06, nz * g / 2)), { ...st, material: n.roof === true ? 'glass' : n.roof });
  },

  tower(n, M, st, ctx) {
    const H = clamp(num(n.height, 30), 1, 1000);
    const b0 = clamp(num(n.base ?? n.width, H / 8), 0.3, 200), b1 = clamp(num(n.top, b0 * 0.35), 0.1, 200);
    const k = String(n.kind || 'lattice').toLowerCase();
    if (/tube|mast|pole|chimney/.test(k)) {
      ctx.prim('cylinder', { radius: b0 / 2, radiusTop: b1 / 2, height: H, segments: 32 }, M.clone().multiply(new Matrix4().makeTranslation(0, H / 2, 0)), st);
      return;
    }
    const legs = clamp(Math.round(num(n.legs, 4)), 3, 8);
    const sections = clamp(Math.round(num(n.sections, H / Math.max(b0, 1))), 2, 200);
    const leg = parseSection(n.leg ?? n.section ?? `CHS ${Math.round(b0 * 40 + 60)}x6`);
    const brace = parseSection(n.brace ?? 'SHS 50x50x4');
    const ring = (L) => {
      const y = H * L / sections, w = b0 + (b1 - b0) * (L / sections);
      return Array.from({ length: legs }, (_, i) => { const a = (i / legs) * Math.PI * 2 + Math.PI / legs; return [Math.cos(a) * w / Math.SQRT2, y, Math.sin(a) * w / Math.SQRT2]; });
    };
    let prev = ring(0);
    for (let L = 1; L <= sections; L++) {
      const cur = ring(L);
      for (let i = 0; i < legs; i++) {
        const j = (i + 1) % legs;
        ctx.member(prev[i], cur[i], leg, M, { ...st, role: 'leg' });
        ctx.member(cur[i], cur[j], brace, M, { ...st, role: 'horizontal' });
        ctx.member(prev[i], cur[j], brace, M, { ...st, role: 'bracing' });
        if (!/single|k/.test(n.bracing || '')) ctx.member(prev[j], cur[i], brace, M, { ...st, role: 'bracing' });
      }
      prev = cur;
    }
    if (n.platform !== false && /observ|platform|lookout/.test(`${k} ${n.platform || ''}`)) {
      ctx.prim('cylinder', { radius: b1 * 1.2, height: 0.2, segments: 32 }, M.clone().multiply(new Matrix4().makeTranslation(0, H + 0.1, 0)), { ...st, material: 'concrete' });
    }
    if (n.antenna) ctx.member([0, H, 0], [0, H + num(n.antenna, H * 0.2), 0], parseSection('CHS 100x5'), M, { ...st, role: 'mast' });
  },

  stair(n, M, st, ctx) {
    const k = String(n.kind || 'straight').toLowerCase();
    const rise = clamp(num(n.rise ?? n.height, 3), 0.3, 50);
    const width = clamp(num(n.width, 1.1), 0.5, 10);
    const steps = clamp(Math.round(num(n.steps, Math.ceil(rise / 0.175))), 2, 300);
    const r = rise / steps;
    const treadM = { ...st, material: n.tread_material || (/concrete/.test(n.material || '') ? 'concrete' : 'timber') };
    const steel = { ...st, material: n.material || 'steel' };
    if (/spiral|helical/.test(k)) {
      const R = clamp(num(n.radius, 1.2), 0.5, 20);
      const turn = num(n.turn_degrees ?? n.turn, Math.min(360, steps * 22.5)) * DEG;
      ctx.prim('cylinder', { radius: Math.max(0.06, R * 0.08), height: rise + 1, segments: 20 }, M.clone().multiply(new Matrix4().makeTranslation(0, (rise + 1) / 2, 0)), steel);
      const path = [];
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * turn;
        const T = M.clone().multiply(new Matrix4().makeTranslation(0, (i + 1) * r, 0)).multiply(yRot(-a)).multiply(new Matrix4().makeTranslation(R / 2, 0, 0));
        ctx.prim('box', { size: [R, 0.05, Math.max(0.2, (turn / steps) * R * 1.05)] }, T, treadM);
        const pa = a;
        path.push([Math.cos(pa) * R, (i + 1) * r + 0.95, Math.sin(pa) * R]);
        if (i % 2 === 0) ctx.member([Math.cos(pa) * R, (i + 1) * r, Math.sin(pa) * R], [Math.cos(pa) * R, (i + 1) * r + 0.95, Math.sin(pa) * R], parseSection('rod 20'), M, { ...steel, role: 'baluster' });
      }
      if (n.rails !== false) ctx.prim('tube', { path, radius: 0.025 }, M, steel);
      return;
    }
    const going = clamp(num(n.going, 0.27), 0.2, 0.5);
    const flight = (Mf, count, y0) => {
      for (let i = 0; i < count; i++) ctx.prim('box', { size: [going, 0.05, width] }, Mf.clone().multiply(new Matrix4().makeTranslation((i + 0.5) * going, y0 + (i + 1) * r, 0)), treadM);
      const L = count * going, Hf = count * r;
      for (const z of [-width / 2, width / 2]) {
        ctx.member([0, y0, z], [L, y0 + Hf, z], parseSection('PFC 200x90') , Mf, { ...steel, role: 'stringer' });
        if (n.rails !== false) {
          ctx.member([0, y0 + 0.95, z], [L, y0 + Hf + 0.95, z], parseSection('CHS 42x3'), Mf, { ...steel, role: 'handrail' });
          for (let i = 0; i <= count; i += 3) ctx.member([i * going, y0 + i * r, z], [i * going, y0 + i * r + 0.95, z], parseSection('SHS 40x40x3'), Mf, { ...steel, role: 'post' });
        }
      }
      return { L, Hf };
    };
    if (/^l|dog|u\b|switch|return/.test(k)) {
      const half = Math.floor(steps / 2);
      const f1 = flight(M, half, 0);
      const land = clamp(num(n.landing, width), 0.9, 5);
      ctx.prim('box', { size: [land, 0.15, /^l/.test(k) ? land : width * 2 + 0.1] }, M.clone().multiply(new Matrix4().makeTranslation(f1.L + land / 2, f1.Hf, /^l/.test(k) ? 0 : width / 2 + 0.05)), treadM);
      const M2 = /^l/.test(k)
        ? M.clone().multiply(new Matrix4().makeTranslation(f1.L + land / 2, 0, width / 2)).multiply(yRot(-Math.PI / 2))
        : M.clone().multiply(new Matrix4().makeTranslation(f1.L, 0, width + 0.1)).multiply(yRot(Math.PI));
      flight(M2, steps - half, f1.Hf);
    } else flight(M, steps, 0);
  },

  arch(n, M, st, ctx) {
    const span = clamp(num(n.span, 10), 0.5, 1000), rise = clamp(num(n.rise, span / 4), 0.1, 500);
    const thick = clamp(num(n.thickness, span / 40), 0.02, 20), width = clamp(num(n.width, thick * 2), 0.02, 200);
    const segs = clamp(Math.round(num(n.segments, 32)), 4, 256);
    const circ = /circ|semi|round/.test(String(n.shape || n.kind || ''));
    const R = (span * span / 4 + rise * rise) / (2 * rise);
    const pt = (t) => {
      const x = t * span;
      if (circ) { const cx = span / 2, cy = rise - R; return [x, cy + Math.sqrt(Math.max(0, R * R - (x - cx) ** 2)), 0]; }
      return [x, rise * (1 - (2 * t - 1) ** 2), 0];
    };
    const sec = { shape: 'rect', w: width, h: thick, t: 0, area: width * thick, name: `${Math.round(thick * 1000)} × ${Math.round(width * 1000)}` };
    for (let i = 0; i < segs; i++) ctx.member(pt(i / segs), pt((i + 1) / segs), sec, M, { ...st, role: 'arch rib' });
    if (n.vault) {
      // Barrel vault: repeat ribs along Z and skin them.
      const len = num(n.vault, 10);
      const path = Array.from({ length: segs + 1 }, (_, i) => pt(i / segs));
      ctx.prim('vault', { path, length: len, thickness: thick }, M, st);
    }
  },

  dome(n, M, st, ctx) {
    const R = clamp(num(n.radius, 8), 0.2, 500);
    const k = String(n.kind || 'geodesic').toLowerCase();
    if (/shell|solid|masonry|concrete/.test(k)) {
      ctx.prim('sphere', { radius: R, hemisphere: true, thickness: num(n.thickness, R / 40) }, M, { ...st, material: n.material || 'concrete' });
      if (n.oculus) ctx.label('Oculus', [0, R, 0], M);
      return;
    }
    const sec = parseSection(n.section ?? `CHS ${Math.round(clamp(R * 12, 40, 400))}x5`);
    if (/rib|lamella|schwedler/.test(k)) {
      const ribs = clamp(Math.round(num(n.ribs, 16)), 4, 96), rings = clamp(Math.round(num(n.rings, 6)), 1, 48);
      const P = (i, j) => { const phi = (j / rings) * Math.PI / 2, th = (i / ribs) * Math.PI * 2; return [R * Math.cos(phi) * Math.cos(th), R * Math.sin(phi), R * Math.cos(phi) * Math.sin(th)]; };
      for (let i = 0; i < ribs; i++) for (let j = 0; j < rings; j++) {
        ctx.member(P(i, j), P(i, j + 1), sec, M, { ...st, role: 'rib' });
        ctx.member(P(i, j), P(i + 1, j), sec, M, { ...st, role: 'ring' });
        if (/schwedler|lamella/.test(k)) ctx.member(P(i, j), P(i + 1, j + 1), sec, M, { ...st, role: 'diagonal' });
      }
      return;
    }
    const f = clamp(Math.round(num(n.frequency, 3)), 1, 8);
    const g = geodesic(f);
    const keep = (p) => p.y >= -1e-6 - (n.truncation != null ? num(n.truncation, 0) : 0);
    const P = (i) => g.pts[i].clone().multiplyScalar(R).toArray();
    for (const [a, b] of g.edges) if (keep(g.pts[a]) && keep(g.pts[b])) ctx.member(P(a), P(b), sec, M, { ...st, role: 'strut' });
    g.pts.forEach((p) => { if (keep(p)) ctx.node(p.clone().multiplyScalar(R).toArray(), sec.w * 1.2, M, st); });
    if (n.panels) {
      const tris = g.faces.filter(f3 => f3.every(i => keep(g.pts[i])));
      const used = [...new Set(tris.flat())];
      const remap = new Map(used.map((i, k) => [i, k]));
      ctx.prim('mesh', { vertices: used.map((i) => g.pts[i].clone().multiplyScalar(R * 0.995).toArray()), faces: tris.map(f3 => f3.map(i => remap.get(i))) }, M, { ...st, material: n.panels === true ? 'glass' : n.panels });
    }
  },

  bridge(n, M, st, ctx) {
    const k = String(n.kind || 'beam').toLowerCase();
    const span = clamp(num(n.span, 40), 2, 3000), width = clamp(num(n.width, 8), 1, 100);
    const deckY = clamp(num(n.clearance ?? n.height, span / 12), 0, 300);
    const deckT = clamp(num(n.deck_depth, Math.max(0.3, span / 60)), 0.1, 10);
    const deckM = { ...st, material: n.deck_material || 'concrete' };
    const steel = { ...st, material: n.material || 'paint', color: n.color || st.color || '#b23a2a' };
    ctx.prim('box', { size: [span, deckT, width] }, M.clone().multiply(new Matrix4().makeTranslation(span / 2, deckY - deckT / 2, 0)), deckM);
    ctx.prim('box', { size: [span, 0.02, width - 1.2] }, M.clone().multiply(new Matrix4().makeTranslation(span / 2, deckY + 0.01, 0)), { ...st, material: 'asphalt' });
    for (const z of [-width / 2 + 0.25, width / 2 - 0.25]) ctx.prim('box', { size: [span, 1.0, 0.1] }, M.clone().multiply(new Matrix4().makeTranslation(span / 2, deckY + 0.5, z)), { ...st, material: 'galvanised' });
    const pier = (x, h) => { if (h > 0.2) ctx.prim('box', { size: [Math.max(1, span / 60), h, width * 0.7] }, M.clone().multiply(new Matrix4().makeTranslation(x, h / 2, 0)), deckM); };
    if (/suspension/.test(k)) {
      const towerH = num(n.tower_height, span / 9);
      const sag = num(n.sag, span / 10);
      const tA = span * 0.15, tB = span * 0.85;
      for (const x of [tA, tB]) for (const z of [-width / 2, width / 2]) ctx.member([x, 0, z], [x, deckY + towerH, z], parseSection(`${Math.round(span * 4 + 800)}x${Math.round(span * 4 + 800)}`), M, { ...deckM, role: 'tower' });
      for (const x of [tA, tB]) ctx.member([x, deckY + towerH * 0.95, -width / 2], [x, deckY + towerH * 0.95, width / 2], parseSection('1500x1200'), M, { ...deckM, role: 'tower beam' });
      const cable = parseSection(`cable ${Math.round(clamp(span / 2, 150, 900))}`);
      const cy = (x) => { const t = (x - tA) / (tB - tA); return deckY + towerH - 4 * sag * t * (1 - t); };
      for (const z of [-width / 2, width / 2]) {
        const pts = [[0, deckY, z], [tA, deckY + towerH, z]];
        for (let i = 1; i < 24; i++) { const x = tA + (tB - tA) * i / 24; pts.push([x, cy(x), z]); }
        pts.push([tB, deckY + towerH, z], [span, deckY, z]);
        for (let i = 0; i < pts.length - 1; i++) ctx.member(pts[i], pts[i + 1], cable, M, { ...st, material: 'galvanised', role: 'main cable' });
        for (let x = tA + 5; x < tB - 2; x += Math.max(4, span / 60)) ctx.member([x, cy(x), z], [x, deckY, z], parseSection('cable 60'), M, { ...st, material: 'galvanised', role: 'hanger' });
      }
      pier(tA, deckY); pier(tB, deckY);
    } else if (/cable|stay/.test(k)) {
      const towerH = num(n.tower_height, span / 5);
      const pylons = /two|double/.test(k) ? [span * 0.25, span * 0.75] : [span / 2];
      for (const x of pylons) {
        ctx.prim('cone', { radius: Math.max(1, span / 80), height: deckY + towerH, radiusTop: Math.max(0.5, span / 200) }, M.clone().multiply(new Matrix4().makeTranslation(x, (deckY + towerH) / 2, 0)), deckM);
        const reach = pylons.length === 1 ? span / 2 : span / 4;
        for (let i = 1; i <= 10; i++) for (const s of [-1, 1]) for (const z of [-width / 2 + 0.5, width / 2 - 0.5]) {
          const dx = (reach * i) / 10.5;
          ctx.member([x, deckY + towerH * (0.55 + 0.045 * i), 0], [x + s * dx, deckY, z], parseSection('cable 90'), M, { ...st, material: 'galvanised', role: 'stay' });
        }
      }
    } else if (/arch/.test(k)) {
      const rise = num(n.rise, span / 5);
      const through = !/deck arch|below/.test(k);
      for (const z of [-width / 2, width / 2]) {
        const segs = 32;
        const y = (t) => (through ? deckY + rise * 4 * t * (1 - t) : deckY - 0.5 - (deckY - 0.5) * (1 - 4 * t * (1 - t)));
        const sec = parseSection(`${Math.round(span * 6 + 600)}x${Math.round(span * 4 + 400)}`);
        for (let i = 0; i < segs; i++) ctx.member([span * i / segs, y(i / segs), z], [span * (i + 1) / segs, y((i + 1) / segs), z], sec, M, { ...steel, role: 'arch' });
        for (let i = 2; i < segs - 1; i += 2) ctx.member([span * i / segs, y(i / segs), z], [span * i / segs, deckY - (through ? 0 : deckT), z], parseSection(through ? 'cable 80' : 'SHS 300x300x10'), M, { ...steel, role: through ? 'hanger' : 'spandrel post' });
      }
      if (through) for (let i = 4; i < 30; i += 4) ctx.member([span * i / 32, deckY + rise * 4 * (i / 32) * (1 - i / 32), -width / 2], [span * i / 32, deckY + rise * 4 * (i / 32) * (1 - i / 32), width / 2], parseSection('SHS 300x300x10'), M, { ...steel, role: 'wind brace' });
    } else if (/truss/.test(k)) {
      const h = num(n.truss_height, Math.max(3, span / 8));
      const { members } = trussMembers({ kind: n.truss || 'pratt', span, height: h, panels: n.panels });
      const chord = parseSection(n.chord ?? `SHS ${Math.round(clamp(span * 8, 200, 600))}x${Math.round(clamp(span * 8, 200, 600))}x12`);
      const web = parseSection(n.web ?? `SHS ${Math.round(clamp(span * 5, 150, 400))}x${Math.round(clamp(span * 5, 150, 400))}x10`);
      for (const z of [-width / 2, width / 2]) for (const [a, b, role] of members) ctx.member([a[0], a[1] + deckY, z], [b[0], b[1] + deckY, z], /chord/.test(role) ? chord : web, M, { ...steel, role });
      for (let i = 1; i < 8; i++) ctx.member([span * i / 8, deckY + h, -width / 2], [span * i / 8, deckY + h, width / 2], web, M, { ...steel, role: 'portal' });
    } else {
      // Beam or girder bridge: girders under the deck and piers.
      const girders = clamp(Math.round(width / 2.5), 2, 12);
      const gd = parseSection(n.girder ?? `UB ${Math.round(clamp(span * 30, 400, 2500))}x${Math.round(clamp(span * 10, 200, 600))}`);
      for (let g = 0; g < girders; g++) {
        const z = -width / 2 + width * (g + 0.5) / girders;
        ctx.member([0, deckY - deckT - gd.h / 2, z], [span, deckY - deckT - gd.h / 2, z], gd, M, { ...steel, role: 'girder' });
      }
      const piers = Math.max(0, Math.round(num(n.piers, Math.floor(span / 35))));
      for (let i = 1; i <= piers; i++) pier(span * i / (piers + 1), deckY - deckT - gd.h);
    }
    // abutments
    for (const x of [0, span]) ctx.prim('box', { size: [3, deckY, width + 1] }, M.clone().multiply(new Matrix4().makeTranslation(x + (x ? 1.5 : -1.5), deckY / 2, 0)), deckM);
  },

  frame(n, M, st, ctx) {
    const [nx, nz] = Array.isArray(n.bays) ? [clamp(Math.round(num(n.bays[0], 3)), 1, 60), clamp(Math.round(num(n.bays[1], 2)), 1, 60)] : [3, 2];
    const [bx, bz] = Array.isArray(n.bay) ? [clamp(num(n.bay[0], 6), 1, 40), clamp(num(n.bay[1], num(n.bay[0], 6)), 1, 40)] : [clamp(num(n.bay, 6), 1, 40), clamp(num(n.bay, 6), 1, 40)];
    const storeys = clamp(Math.round(num(n.storeys ?? n.floors, 3)), 1, 200);
    const h = clamp(num(n.storey_height ?? n.floor_height, 3.5), 2.2, 12);
    const concrete = /concrete|rc/.test(String(n.system || n.structure || ''));
    const col = parseSection(n.columns ?? (concrete ? '400x400' : `UC ${storeys > 10 ? 356 : 254}x${storeys > 10 ? 368 : 254}x${storeys > 10 ? 129 : 73}`));
    const beam = parseSection(n.beams ?? (concrete ? '300x550' : 'UB 406x178x60'));
    const frameSt = { ...st, material: n.material || (concrete ? 'concrete' : 'steel') };
    const slabT = clamp(num(n.slab ?? 0.2, 0.2), 0, 1);
    const W = nx * bx, D = nz * bz;
    for (let s = 0; s < storeys; s++) {
      const y0 = s * h, y1 = (s + 1) * h;
      for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) ctx.member([i * bx, y0, j * bz], [i * bx, y1 - (slabT ? slabT : 0), j * bz], col, M, { ...frameSt, role: 'column' });
      const yb = y1 - slabT - beam.h / 2;
      for (let j = 0; j <= nz; j++) for (let i = 0; i < nx; i++) ctx.member([i * bx, yb, j * bz], [(i + 1) * bx, yb, j * bz], beam, M, { ...frameSt, role: 'beam' });
      for (let i = 0; i <= nx; i++) for (let j = 0; j < nz; j++) ctx.member([i * bx, yb, j * bz], [i * bx, yb, (j + 1) * bz], beam, M, { ...frameSt, role: 'beam' });
      if (slabT) ctx.prim('box', { size: [W + 0.3, slabT, D + 0.3] }, M.clone().multiply(new Matrix4().makeTranslation(W / 2, y1 - slabT / 2, D / 2)), { ...st, material: 'concrete' });
      if (n.bracing && !concrete) {
        const br = parseSection('CHS 139.7x6.3');
        for (const [a, b] of [[[0, y0, 0], [bx, y1 - slabT, 0]], [[bx, y0, 0], [0, y1 - slabT, 0]], [[W - bx, y0, D], [W, y1 - slabT, D]], [[W, y0, D], [W - bx, y1 - slabT, D]]]) ctx.member(a, b, br, M, { ...frameSt, role: 'bracing' });
      }
    }
    if (n.core) {
      const cw = Math.min(bx, W / 3), cd = Math.min(bz, D / 2);
      ctx.prim('box', { size: [cw, storeys * h + 1, cd] }, M.clone().multiply(new Matrix4().makeTranslation(W / 2, (storeys * h + 1) / 2, D / 2)), { ...st, material: 'concrete' });
    }
    const facade = String(n.facade || '').toLowerCase();
    if (facade && facade !== 'none') {
      const mat = /glass|curtain/.test(facade) ? 'glass' : /brick/.test(facade) ? 'brick' : /block/.test(facade) ? 'block' : /timber|wood/.test(facade) ? 'timber' : 'render';
      const H = storeys * h;
      for (const [cx, cz, sx, sz] of [[W / 2, -0.15, W, 0.02], [W / 2, D + 0.15, W, 0.02], [-0.15, D / 2, 0.02, D], [W + 0.15, D / 2, 0.02, D]]) {
        ctx.prim('box', { size: [sx || 0.02, H, sz || 0.02] }, M.clone().multiply(new Matrix4().makeTranslation(cx, H / 2, cz)), { ...st, material: mat });
      }
      if (mat === 'glass') {
        const mull = parseSection('100x50');
        for (let i = 0; i <= nx * 4; i++) for (const z of [-0.15, D + 0.15]) ctx.member([i * bx / 4, 0, z], [i * bx / 4, H, z], mull, M, { ...st, material: 'aluminium', role: 'mullion' });
        for (let j = 0; j <= nz * 4; j++) for (const x of [-0.15, W + 0.15]) ctx.member([x, 0, j * bz / 4], [x, H, j * bz / 4], mull, M, { ...st, material: 'aluminium', role: 'mullion' });
        for (let s = 1; s < storeys; s++) for (const z of [-0.15, D + 0.15]) ctx.member([0, s * h, z], [W, s * h, z], mull, M, { ...st, material: 'aluminium', role: 'transom' });
      }
    }
    if (n.roof && n.roof !== 'flat') GEN.roof({ kind: n.roof, size: [W, D], pitch: n.pitch ?? 20, overhang: 0.6 }, M.clone().multiply(new Matrix4().makeTranslation(W / 2, storeys * h, D / 2)), { ...st, material: n.roof_material || 'galvanised' }, ctx);
    ctx.label(`${storeys} storeys · ${W} × ${D} m`, [W / 2, storeys * h + 1.5, D / 2], M);
  },

  column_grid(n, M, st, ctx) {
    const [nx, nz] = Array.isArray(n.count) ? n.count.map(c => clamp(Math.round(num(c, 3)), 1, 200)) : [3, 3];
    const [sx, sz] = Array.isArray(n.spacing) ? n.spacing.map(c => num(c, 6)) : [num(n.spacing, 6), num(n.spacing, 6)];
    const h = num(n.height, 4);
    const sec = parseSection(n.section ?? '400x400');
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) ctx.member([i * sx, 0, j * sz], [i * sx, h, j * sz], sec, M, { ...st, material: n.material || 'concrete', role: 'column' });
  },

  hypar(n, M, st, ctx) {
    const size = v3(n.size ?? [10, 0, 10]);
    const [X, Z] = Array.isArray(n.size) && n.size.length === 2 ? [num(n.size[0], 10), num(n.size[1], 10)] : [size[0] || 10, size[2] || 10];
    ctx.prim('surface', { kind: n.kind || 'hypar', size: [X, Z], rise: num(n.rise, Math.min(X, Z) / 4), thickness: num(n.thickness, 0.12), segments: 40 }, M, { ...st, material: n.material || 'concrete' });
  },

  wall(n, M, st, ctx) {
    const a = Array.isArray(n.from) ? [num(n.from[0]), num(n.from.length === 3 ? n.from[2] : n.from[1])] : [0, 0];
    const b = Array.isArray(n.to) ? [num(n.to[0], 5), num(n.to.length === 3 ? n.to[2] : n.to[1])] : [5, 0];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.05) return;
    const H = clamp(num(n.height, 3), 0.1, 100), T = clamp(num(n.thickness, 0.225), 0.02, 3);
    const W = M.clone().multiply(new Matrix4().makeTranslation(a[0], 0, a[1])).multiply(yRot(-Math.atan2(b[1] - a[1], b[0] - a[0])));
    let rects = [{ x0: 0, x1: L, y0: 0, y1: H }];
    for (const o of Array.isArray(n.openings) ? n.openings : []) {
      const w = num(o.width, 1), h = num(o.height, 1.2), c = num(o.at ?? o.along, L / 2), s = num(o.sill, 0.9);
      rects = cut(rects, { x0: c - w / 2, x1: c + w / 2, y0: s, y1: s + h });
      if (!o.empty) ctx.prim('box', { size: [w, h, 0.02] }, W.clone().multiply(new Matrix4().makeTranslation(c, s + h / 2, 0)), { ...st, material: s < 0.05 ? 'timber' : 'glass' });
    }
    const wallSt = { ...st, material: n.material || 'block' };
    for (const r of rects) ctx.prim('box', { size: [r.x1 - r.x0, r.y1 - r.y0, T] }, W.clone().multiply(new Matrix4().makeTranslation((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2, 0)), wallSt);
  },

  roof(n, M, st, ctx) {
    const [X, Z] = Array.isArray(n.size) ? [num(n.size[0], 8), num(n.size[n.size.length === 3 ? 2 : 1], 6)] : [8, 6];
    const k = String(n.kind || 'gable').toLowerCase();
    const o = num(n.overhang, 0.5);
    const pitch = clamp(num(n.pitch, 25), 0, 75) * DEG;
    const w = X + 2 * o, d = Z + 2 * o;
    const rise = (k === 'shed' || k === 'mono') ? d * Math.tan(pitch) : (d / 2) * Math.tan(pitch);
    const roofSt = { ...st, material: n.material || st.material || 'galvanised' };
    const T = M.clone().multiply(new Matrix4().makeTranslation(-w / 2, 0, -d / 2));
    if (k === 'flat' || pitch === 0) { ctx.prim('box', { size: [w, 0.2, d] }, M.clone().multiply(new Matrix4().makeTranslation(0, 0.1, 0)), roofSt); return; }
    let verts, faces;
    if (k === 'shed' || k === 'mono') { verts = [[0, 0, 0], [w, 0, 0], [w, rise, d], [0, rise, d]]; faces = [[0, 1, 2], [0, 2, 3]]; }
    else if (k === 'hip') {
      const r = Math.min(d / 2, w / 2);
      verts = [[0, 0, 0], [w, 0, 0], [w, 0, d], [0, 0, d], [r, rise, d / 2], [w - r, rise, d / 2]];
      faces = [[0, 1, 5], [0, 5, 4], [1, 2, 5], [2, 3, 4], [2, 4, 5], [3, 0, 4]];
    } else if (k === 'pyramid') { verts = [[0, 0, 0], [w, 0, 0], [w, 0, d], [0, 0, d], [w / 2, rise, d / 2]]; faces = [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]]; }
    else {
      verts = [[0, 0, 0], [w, 0, 0], [w, rise, d / 2], [0, rise, d / 2], [w, 0, d], [0, 0, d]];
      faces = [[0, 1, 2], [0, 2, 3], [3, 2, 4], [3, 4, 5]];
      ctx.prim('mesh', { vertices: [[o, 0, o], [o, 0, d - o], [o, rise * (1 - o / (d / 2)), d / 2]], faces: [[0, 1, 2]] }, T, { ...st, material: n.gable_material || 'render' });
      ctx.prim('mesh', { vertices: [[w - o, 0, o], [w - o, 0, d - o], [w - o, rise * (1 - o / (d / 2)), d / 2]], faces: [[0, 2, 1]] }, T, { ...st, material: n.gable_material || 'render' });
    }
    ctx.prim('mesh', { vertices: verts, faces, corrugated: /galv|steel|paint|alumin/.test(roofSt.material) }, T, roofSt);
  },

  tree(n, M, st, ctx) {
    const h = clamp(num(n.height, 6), 0.5, 80);
    const k = String(n.kind || 'broadleaf').toLowerCase();
    ctx.prim('cylinder', { radius: h * 0.025, radiusTop: h * 0.015, height: h * 0.45, segments: 8 }, M.clone().multiply(new Matrix4().makeTranslation(0, h * 0.225, 0)), { material: 'timber', color: '#5b4330' });
    const leaf = { material: 'grass', color: n.color || (/palm/.test(k) ? '#4f7a35' : '#4d7a3a') };
    if (/palm/.test(k)) {
      ctx.prim('cylinder', { radius: h * 0.02, height: h * 0.55, segments: 8 }, M.clone().multiply(new Matrix4().makeTranslation(0, h * 0.72, 0)), { material: 'timber', color: '#6b5238' });
      for (let i = 0; i < 8; i++) ctx.prim('cone', { radius: h * 0.05, height: h * 0.35, segments: 6 }, M.clone().multiply(new Matrix4().makeTranslation(0, h, 0)).multiply(yRot(i * Math.PI / 4)).multiply(new Matrix4().makeRotationZ(-1.25)).multiply(new Matrix4().makeTranslation(0, h * 0.17, 0)), leaf);
    } else if (/conifer|pine|fir/.test(k)) {
      for (let i = 0; i < 3; i++) ctx.prim('cone', { radius: h * (0.22 - i * 0.05), height: h * 0.4, segments: 10 }, M.clone().multiply(new Matrix4().makeTranslation(0, h * (0.45 + i * 0.18), 0)), leaf);
    } else {
      for (const [x, y, z, r] of [[0, 0.68, 0, 0.26], [0.12, 0.6, 0.08, 0.18], [-0.12, 0.62, -0.06, 0.2], [0.02, 0.85, -0.04, 0.18]]) ctx.prim('sphere', { radius: h * r, segments: 12 }, M.clone().multiply(new Matrix4().makeTranslation(x * h, y * h, z * h)), leaf);
    }
  },

  person(n, M, st, ctx) {
    const h = clamp(num(n.height, 1.75), 0.8, 2.2);
    const body = { material: 'fabric', color: n.color || '#4b5563' };
    ctx.prim('cylinder', { radius: h * 0.1, radiusTop: h * 0.12, height: h * 0.5, segments: 12 }, M.clone().multiply(new Matrix4().makeTranslation(0, h * 0.55, 0)), body);
    ctx.prim('cylinder', { radius: h * 0.06, height: h * 0.45, segments: 8 }, M.clone().multiply(new Matrix4().makeTranslation(-h * 0.05, h * 0.22, 0)), { material: 'fabric', color: '#1f2937' });
    ctx.prim('cylinder', { radius: h * 0.06, height: h * 0.45, segments: 8 }, M.clone().multiply(new Matrix4().makeTranslation(h * 0.05, h * 0.22, 0)), { material: 'fabric', color: '#1f2937' });
    ctx.prim('sphere', { radius: h * 0.075, segments: 14 }, M.clone().multiply(new Matrix4().makeTranslation(0, h * 0.9, 0)), { material: 'plastic', color: n.skin || '#8d5b3d' });
  },
};

function cut(rects, hole) {
  const out = [];
  for (const r of rects) {
    if (hole.x1 <= r.x0 || hole.x0 >= r.x1 || hole.y1 <= r.y0 || hole.y0 >= r.y1) { out.push(r); continue; }
    if (hole.y0 > r.y0) out.push({ ...r, y1: hole.y0 });
    if (hole.y1 < r.y1) out.push({ ...r, y0: hole.y1 });
    const y0 = Math.max(r.y0, hole.y0), y1 = Math.min(r.y1, hole.y1);
    if (hole.x0 > r.x0) out.push({ x0: r.x0, x1: hole.x0, y0, y1 });
    if (hole.x1 < r.x1) out.push({ x0: hole.x1, x1: r.x1, y0, y1 });
  }
  return out.filter(r => r.x1 - r.x0 > 1e-3 && r.y1 - r.y0 > 1e-3);
}

export const GENERATORS = {
  truss: 'kind (pratt|howe|warren|k|fink|pitched), span, height, panels, depth (box truss), chord, web',
  space_frame: 'size [x,z], grid (module m), depth, section, columns {height, section}, roof (true|material)',
  tower: 'kind (lattice|tube), height, base, top, legs, sections, leg, brace, antenna, platform',
  stair: 'kind (straight|spiral|L|U), rise, width, steps, going, radius, turn_degrees, rails',
  arch: 'span, rise, thickness, width, segments, shape (parabolic|circular), vault (length)',
  dome: 'kind (geodesic|ribbed|schwedler|shell), radius, frequency, ribs, rings, panels (true|material), section',
  bridge: 'kind (beam|truss|arch|deck arch|suspension|cable-stayed), span, width, clearance, tower_height, sag, rise, piers',
  frame: 'bays [nx,nz], bay [x,z], storeys, storey_height, system (steel|concrete), columns, beams, slab, bracing, core, facade (glass|brick|render|timber), roof (flat|gable|hip)',
  column_grid: 'count [nx,nz], spacing [x,z], height, section',
  hypar: 'size [x,z], rise, thickness, kind (hypar|saddle|wave)',
  wall: 'from [x,z], to [x,z], height, thickness, openings [{at, width, height, sill}]',
  roof: 'kind (gable|hip|shed|pyramid|flat), size [x,z], pitch (deg), overhang',
  tree: 'kind (broadleaf|palm|conifer), height',
  person: 'height (scale figure)',
};

/* ---------------- expansion ---------------- */

function expandNode(n, parentM, parentStyle, ctx, depth) {
  if (!n || typeof n !== 'object') return;
  if (depth > LIMITS.depth) { ctx.warn('Groups nest too deeply; the innermost parts were skipped.'); return; }
  const type = String(n.type || n.kind_of || n.shape || 'box').toLowerCase().replace(/[\s-]+/g, '_');
  const M = parentM.clone().multiply(nodeMatrix(n));
  const st = styleOf(n, parentStyle);
  if (n.label) ctx.label(n.label, [0, 0, 0], M);

  switch (type) {
    case 'group': case 'assembly':
      for (const c of Array.isArray(n.children) ? n.children : []) expandNode(c, M, st, ctx, depth + 1);
      return;
    case 'array': case 'repeat': {
      const count = clamp(Math.round(num(n.count, 2)), 1, LIMITS.arrayCount);
      const item = n.item || n.of || n.child;
      if (!item) { ctx.warn('An array had no item to repeat.'); return; }
      if (n.around || n.polar) {
        const ar = n.around || n.polar;
        const c = v3(ar.center), axis = String(ar.axis || 'y');
        const total = num(ar.angle, 360) * DEG;
        const full = Math.abs(total - Math.PI * 2) < 1e-6;
        for (let i = 0; i < count; i++) {
          const a = total * i / (full ? count : Math.max(1, count - 1));
          const R = axis === 'x' ? new Matrix4().makeRotationX(a) : axis === 'z' ? new Matrix4().makeRotationZ(a) : new Matrix4().makeRotationY(a);
          const T = M.clone().multiply(new Matrix4().makeTranslation(...c)).multiply(R).multiply(new Matrix4().makeTranslation(-c[0], -c[1], -c[2]));
          expandNode(item, T, st, ctx, depth + 1);
        }
        return;
      }
      const step = v3(n.step ?? n.spacing, [1, 0, 0]);
      const rs = v3(n.rotateStep ?? n.rotate_step);
      const sc = num(n.scaleStep ?? n.scale_step, 1);
      for (let i = 0; i < count; i++) {
        const T = M.clone().multiply(new Matrix4().makeTranslation(step[0] * i, step[1] * i, step[2] * i))
          .multiply(new Matrix4().makeRotationFromEuler(new Euler(rs[0] * i * DEG, rs[1] * i * DEG, rs[2] * i * DEG, 'YXZ')))
          .multiply(new Matrix4().makeScale(sc ** i, sc ** i, sc ** i));
        expandNode(item, T, st, ctx, depth + 1);
      }
      return;
    }
    case 'mirror': {
      const item = n.item || n.child;
      if (!item) return;
      expandNode(item, M, st, ctx, depth + 1);
      const ax = String(n.axis || 'x');
      const S = new Matrix4().makeScale(ax === 'x' ? -1 : 1, ax === 'y' ? -1 : 1, ax === 'z' ? -1 : 1);
      expandNode(item, M.clone().multiply(S), st, ctx, depth + 1);
      return;
    }
    case 'member': case 'beam': case 'column': case 'brace': case 'cable': case 'rod': case 'pipe': {
      const from = v3(n.from ?? n.a ?? n.start), to = v3(n.to ?? n.b ?? n.end, [0, 3, 0]);
      const sec = parseSection(n.section ?? (type === 'cable' ? 'cable 30' : type === 'column' ? '300x300' : n.radius ? { shape: 'round', d: num(n.radius) * 2 } : 'RHS 150x100x5'));
      ctx.member(from, to, sec, M, { ...st, material: n.material || (type === 'cable' ? 'galvanised' : st.material), role: n.role || type });
      return;
    }
    case 'polyline': {
      const pts = (Array.isArray(n.points) ? n.points : []).map(p => v3(p));
      const sec = parseSection(n.section ?? 'CHS 60x4');
      for (let i = 0; i < pts.length - 1; i++) ctx.member(pts[i], pts[i + 1], sec, M, { ...st, role: n.role || 'member' });
      if (n.closed && pts.length > 2) ctx.member(pts[pts.length - 1], pts[0], sec, M, { ...st, role: n.role || 'member' });
      return;
    }
    case 'box': case 'cube': case 'slab': case 'block':
      ctx.prim('box', { size: v3(n.size ?? n.dimensions, [1, 1, 1]).map(v => Math.max(0.001, Math.abs(v))) }, M, st); return;
    case 'cylinder': case 'column_round':
      ctx.prim('cylinder', { radius: num(n.radius, 0.5), radiusTop: n.radiusTop ?? n.radius_top, height: num(n.height, 1), segments: n.segments }, M, st); return;
    case 'cone':
      ctx.prim('cone', { radius: num(n.radius, 0.5), height: num(n.height, 1), segments: n.segments }, M, st); return;
    case 'sphere': case 'ball':
      ctx.prim('sphere', { radius: num(n.radius, 0.5), hemisphere: Boolean(n.hemisphere), segments: n.segments }, M, st); return;
    case 'torus': case 'ring':
      ctx.prim('torus', { radius: num(n.radius, 1), tube: num(n.tube, 0.1), arc: num(n.arc, 360) }, M, st); return;
    case 'plane': case 'ground': case 'floor':
      ctx.prim('box', { size: [num(n.size?.[0], 10), num(n.thickness, 0.02), num(n.size?.[1] ?? n.size?.[0], 10)] }, M, st); return;
    case 'extrude': case 'prism': case 'slab_outline':
      if (!Array.isArray(n.points) || n.points.length < 3) { ctx.warn('An extrude needs at least three outline points.'); return; }
      ctx.prim('extrude', { points: n.points.map(p => [num(p[0]), num(p[p.length === 3 ? 2 : 1])]), height: num(n.height ?? n.depth, 1), holes: Array.isArray(n.holes) ? n.holes : [] }, M, st); return;
    case 'lathe': case 'revolve':
      if (!Array.isArray(n.profile) || n.profile.length < 2) { ctx.warn('A lathe needs a profile of [radius, height] points.'); return; }
      ctx.prim('lathe', { profile: n.profile.map(p => [Math.max(0, num(p[0])), num(p[1])]), segments: n.segments }, M, st); return;
    case 'tube': case 'sweep':
      if (!Array.isArray(n.path) || n.path.length < 2) { ctx.warn('A tube needs a path of at least two points.'); return; }
      ctx.prim('tube', { path: n.path.map(p => v3(p)), radius: num(n.radius, 0.05), closed: Boolean(n.closed) }, M, st); return;
    case 'mesh': case 'polyhedron':
      if (!Array.isArray(n.vertices) || !Array.isArray(n.faces)) { ctx.warn('A mesh needs vertices and faces.'); return; }
      ctx.prim('mesh', { vertices: n.vertices.slice(0, 20000).map(p => v3(p)), faces: n.faces.slice(0, 40000).filter(f => Array.isArray(f) && f.length >= 3) }, M, st); return;
    case 'label': case 'text':
      ctx.label(n.text || n.label || n.name, [0, 0, 0], M); return;
    default:
      if (GEN[type]) { GEN[type](n, M, st, ctx); return; }
      ctx.warn(`Unknown object type "${type}" was skipped.`);
  }
}

/**
 * Expands a spec. Returns { title, environment, prims, members, nodes, labels,
 * bounds {min,max,size}, stats, warnings }.
 */
export function expandStructure(spec = {}) {
  const ctx = new Ctx();
  const objects = Array.isArray(spec.objects) ? spec.objects : Array.isArray(spec.children) ? spec.children : spec.type ? [spec] : [];
  if (!objects.length) ctx.warn('The model had no objects.');
  const root = new Matrix4();
  for (const o of objects) expandNode(o, root, { material: spec.material || 'paint', color: spec.color || null }, ctx, 0);
  if (ctx.truncated) ctx.warn(`The model was capped at ${LIMITS.members.toLocaleString()} members and ${LIMITS.prims.toLocaleString()} solids.`);

  // Bounds from member ends, nodes and primitive origins (the renderer refines with real geometry).
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const grow = (p, pad = 0) => { for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], p[i] - pad); max[i] = Math.max(max[i], p[i] + pad); } };
  for (const m of ctx.members) { grow(m.a); grow(m.b); }
  for (const nd of ctx.nodes) grow(nd.p, nd.radius);
  for (const p of ctx.prims) {
    const M = new Matrix4().fromArray(p.matrix);
    const pts = p.params.vertices || p.params.path;
    if (pts) { for (const v of pts) grow(new Vector3(...v).applyMatrix4(M).toArray()); continue; }
    const lo = [0, 0, 0], hi = [0, 0, 0];
    const P = p.params;
    const r = Math.max(num(P.radius, 0), num(P.radiusTop, 0));
    if (P.size && p.shape === 'surface') { lo[0] = 0; hi[0] = P.size[0]; lo[2] = 0; hi[2] = P.size[1]; lo[1] = -num(P.rise, 1); hi[1] = num(P.rise, 1); }
    else if (P.size) { for (let i = 0; i < 3; i++) { lo[i] = -P.size[i] / 2; hi[i] = P.size[i] / 2; } }
    else if (p.shape === 'extrude') { const xs = P.points.map(q => q[0]), zs = P.points.map(q => q[1]); lo[0] = Math.min(...xs); hi[0] = Math.max(...xs); lo[2] = Math.min(...zs); hi[2] = Math.max(...zs); hi[1] = num(P.height, 1); }
    else if (p.shape === 'lathe') { const rr = Math.max(...P.profile.map(q => q[0])); lo[0] = lo[2] = -rr; hi[0] = hi[2] = rr; lo[1] = Math.min(...P.profile.map(q => q[1])); hi[1] = Math.max(...P.profile.map(q => q[1])); }
    else if (p.shape === 'torus') { const R = num(P.radius, 1) + num(P.tube, 0.1); lo[0] = lo[1] = -R; hi[0] = hi[1] = R; lo[2] = -num(P.tube, 0.1); hi[2] = num(P.tube, 0.1); }
    else if (p.shape === 'sphere') { lo[0] = lo[2] = -r; hi[0] = hi[2] = r; lo[1] = P.hemisphere ? 0 : -r; hi[1] = r; }
    else { lo[0] = lo[2] = -r; hi[0] = hi[2] = r; lo[1] = -num(P.height, 1) / 2; hi[1] = num(P.height, 1) / 2; }
    for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]]) grow(new Vector3(x, y, z).applyMatrix4(M).toArray());
  }
  const valid = Number.isFinite(min[0]);
  const bounds = valid ? { min: min.map(r3), max: max.map(r3), size: max.map((v, i) => r3(v - min[i])) } : { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0] };

  // Takeoff: member length and mass per section and material.
  const takeoff = new Map();
  let totalLen = 0, totalKg = 0, steelKg = 0;
  const STEEL = new Set(['steel', 'galvanised', 'paint', 'chrome']);
  for (const m of ctx.members) {
    const L = Math.hypot(m.b[0] - m.a[0], m.b[1] - m.a[1], m.b[2] - m.a[2]);
    totalLen += L;
    const dens = DENSITY[m.material] ?? 7850;
    const kg = (m.section.kgm ?? m.section.area * dens) * L;
    totalKg += kg;
    if (STEEL.has(m.material)) steelKg += kg;
    const key = `${m.section.name}|${m.material}`;
    const row = takeoff.get(key) || { section: m.section.name, material: m.material, count: 0, lengthM: 0, massKg: 0 };
    row.count++; row.lengthM += L; row.massKg += kg;
    takeoff.set(key, row);
  }
  const roles = {};
  for (const m of ctx.members) roles[m.role || 'member'] = (roles[m.role || 'member'] || 0) + 1;
  return {
    title: String(spec.title || 'Structure').slice(0, 120),
    description: String(spec.description || '').slice(0, 600),
    environment: spec.environment === 'studio' ? 'studio' : 'outdoor',
    prims: ctx.prims, members: ctx.members, nodes: ctx.nodes, labels: ctx.labels,
    bounds,
    stats: {
      solids: ctx.prims.length, members: ctx.members.length, nodes: ctx.nodes.length,
      memberLengthM: Math.round(totalLen * 10) / 10, memberMassT: Math.round(totalKg / 100) / 10, steelT: Math.round(steelKg / 100) / 10,
      roles,
      takeoff: [...takeoff.values()].sort((a, b) => b.massKg - a.massKg).map(r => ({ ...r, lengthM: Math.round(r.lengthM * 10) / 10, massKg: Math.round(r.massKg) })),
    },
    warnings: ctx.warnings,
  };
}
