/* ============================================================
   TOOLBOX — Realistic shipping-container and cabin models

   Builds a three.js model of one unit that matches the real thing:
   ISO 668 external size, corrugated Corten side walls (278 mm pitch,
   36 mm deep), end walls and a transversely corrugated roof, corner
   posts, ISO 1161 corner castings with their oval apertures, top and
   bottom side rails, a cargo-door end with four locking bars, cam
   keepers and hinges, a 28 mm plywood floor on cross-members, forklift
   pockets on 20 ft boxes — and every opening cut cleanly through the
   corrugation, framed in welded box section, with a proper door,
   window, shutter or louvre in it. Portacabins get sandwich-panel
   walls on a steel base frame.

   Frame of reference (same as the Container Planner): origin at the
   centre of the internal floor; X along the length (back at −len/2,
   cargo-door end at +len/2), Y up (internal floor at 0), Z across
   (left side at −wid/2). Openings use the design engine's wall/along
   convention; fittings use x/z from the back-left inner corner and
   r = 0..3 with the item's back facing −Z, +X, +Z, −X.
   ============================================================ */

import * as THREE from 'three';
import { material } from './render-materials.js';
import { ISO, SKIN, MEMBERS, FLOOR_DEPTH, ROOF_DEPTH, externalDims } from './container-structure.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const WALL_NORMAL = { left: V(0, 0, -1), right: V(0, 0, 1), front: V(1, 0, 0), back: V(-1, 0, 0) };

/* ---------------- corrugated panel geometry ---------------- */

/**
 * The trapezoidal profile along u, repeating every `pitch`, as [u, w] points
 * (w = 0 at the outer ridges, −depth in the valleys).
 */
function profilePoints(length, { pitch, depth, outer, inner }, phase = 0) {
  const slope = (pitch - outer - inner) / 2;
  const pts = [];
  const shape = [[0, 0], [outer, 0], [outer + slope, -depth], [outer + slope + inner, -depth], [pitch, 0]];
  const start = -((phase % pitch) + pitch) % pitch;
  for (let base = start; base < length; base += pitch) {
    for (const [du, w] of shape) {
      const u = base + du;
      if (u < 0 || u > length) continue;
      if (!pts.length || u - pts[pts.length - 1][0] > 1e-6) pts.push([u, w]);
    }
  }
  const wAt = (u) => {
    const local = ((u - start) % pitch + pitch) % pitch;
    for (let i = 1; i < shape.length; i++) {
      const [u0, w0] = shape[i - 1], [u1, w1] = shape[i];
      if (local <= u1 + 1e-9) return w0 + (w1 - w0) * ((local - u0) / Math.max(u1 - u0, 1e-9));
    }
    return 0;
  };
  if (!pts.length || pts[0][0] > 1e-6) pts.unshift([0, wAt(0)]);
  if (pts[pts.length - 1][0] < length - 1e-6) pts.push([length, wAt(length)]);
  return { pts, wAt };
}

/**
 * A corrugated sheet u ∈ [0, uLen], v ∈ [0, vLen] with rectangular holes
 * ({u0,u1,v0,v1}), placed with origin O and axes U (profile), Vd (plain
 * direction) and N (outward). Returns a BufferGeometry.
 */
export function corrugatedGeometry({ O, U, Vd, N, uLen, vLen, profile, holes = [], phase = 0 }) {
  const { pts, wAt } = profilePoints(uLen, profile, phase);
  // Break the profile at every hole edge so each strip is either cut or not.
  const cuts = new Set(pts.map(p => p[0]));
  for (const h of holes) for (const u of [h.u0, h.u1]) if (u > 0 && u < uLen) cuts.add(u);
  const us = [...cuts].sort((a, b) => a - b);
  const pos = [], nor = [], uv = [];
  const point = (u, v, w) => O.clone().addScaledVector(U, u).addScaledVector(Vd, v).addScaledVector(N, w);
  // Segment normals, then vertex normals averaged across each bend: the sheet is
  // roll-formed with rounded bends, and smooth shading stops thin slopes aliasing.
  const segN = [];
  for (let i = 1; i < us.length; i++) {
    const du = us[i] - us[i - 1], dw = wAt(us[i]) - wAt(us[i - 1]);
    segN.push(du < 1e-6 ? null : U.clone().multiplyScalar(-dw).addScaledVector(N, du).normalize());
  }
  const vertN = us.map((_, i) => {
    const a = segN[i - 1], b = segN[i];
    const n = new THREE.Vector3();
    if (a) n.add(a);
    if (b) n.add(b);
    return n.lengthSq() ? n.normalize() : N.clone();
  });
  for (let i = 1; i < us.length; i++) {
    const ua = us[i - 1], ub = us[i];
    if (ub - ua < 1e-6) continue;
    const wa = wAt(ua), wb = wAt(ub);
    const na = vertN[i - 1], nb = vertN[i];
    const mid = (ua + ub) / 2;
    const cover = holes.filter(h => h.u0 <= mid && h.u1 >= mid).map(h => [Math.max(0, h.v0), Math.min(vLen, h.v1)]).sort((a, b) => a[0] - b[0]);
    let v0 = 0;
    const spans = [];
    for (const [a, b] of cover) { if (a > v0) spans.push([v0, a]); v0 = Math.max(v0, b); }
    if (v0 < vLen) spans.push([v0, vLen]);
    for (const [va, vb] of spans) {
      if (vb - va < 1e-6) continue;
      const p1 = point(ua, va, wa), p2 = point(ub, va, wb), p3 = point(ub, vb, wb), p4 = point(ua, vb, wa);
      const ns = [na, nb, nb, na, nb, na];
      [p1, p2, p3, p1, p3, p4].forEach((p, k) => { pos.push(p.x, p.y, p.z); nor.push(ns[k].x, ns[k].y, ns[k].z); });
      uv.push(ua, va, ub, va, ub, vb, ua, va, ub, vb, ua, vb);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/* ---------------- small helpers ---------------- */

function box(w, h, d, mat, x = 0, y = 0, z = 0, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}
/** Axis-aligned box from min/max corners. */
function boxMM(x0, y0, z0, x1, y1, z1, mat, opts) {
  return box(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), mat, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, opts);
}
function cyl(r, h, mat, x, y, z, axis = 'y', seg = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
const mesh = (geo, mat, { cast = true, receive = true } = {}) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive; return m; };
const at = (obj, x, y, z) => { obj.position.set(x, y, z); return obj; };

/** Subtract a rectangle from a list of rectangles ({x0,x1,y0,y1}). */
export function subtractRect(rects, hole) {
  const out = [];
  for (const r of rects) {
    if (hole.x1 <= r.x0 || hole.x0 >= r.x1 || hole.y1 <= r.y0 || hole.y0 >= r.y1) { out.push(r); continue; }
    if (hole.y0 > r.y0) out.push({ x0: r.x0, x1: r.x1, y0: r.y0, y1: hole.y0 });
    if (hole.y1 < r.y1) out.push({ x0: r.x0, x1: r.x1, y0: hole.y1, y1: r.y1 });
    const y0 = Math.max(r.y0, hole.y0), y1 = Math.min(r.y1, hole.y1);
    if (hole.x0 > r.x0) out.push({ x0: r.x0, x1: hole.x0, y0, y1 });
    if (hole.x1 < r.x1) out.push({ x0: hole.x1, x1: r.x1, y0, y1 });
  }
  return out.filter(r => r.x1 - r.x0 > 1e-4 && r.y1 - r.y0 > 1e-4);
}

/* ---------------- opening inserts ---------------- */

const DARK_FRAME = 0x2b2d30;

/**
 * An opening's infill, in a local frame: x across the width (centred),
 * y up from the sill, z outward (0 = outer face of the wall, −depth = inner face).
 */
export function openingInsert(type, w, h, depth, { color = 0x3f6b52 } = {}) {
  const g = new THREE.Group();
  const frameM = material('paint', color, { grime: 0.1 });
  const alu = material('aluminium', DARK_FRAME);
  const glass = material('glass');
  const t = 0.05;   // welded RHS frame face
  // Welded box-section frame lining the cut.
  g.add(box(w + 2 * t, t, depth, frameM, 0, -t / 2, -depth / 2));
  g.add(box(w + 2 * t, t, depth, frameM, 0, h + t / 2, -depth / 2));
  g.add(box(t, h, depth, frameM, -w / 2 - t / 2, h / 2, -depth / 2));
  g.add(box(t, h, depth, frameM, w / 2 + t / 2, h / 2, -depth / 2));

  const glazing = (gw, gh, x0, y0, zc, mullions = 0) => {
    const f = 0.045;
    g.add(box(gw, f, 0.06, alu, x0 + gw / 2, y0 + f / 2, zc));
    g.add(box(gw, f, 0.06, alu, x0 + gw / 2, y0 + gh - f / 2, zc));
    g.add(box(f, gh, 0.06, alu, x0 + f / 2, y0 + gh / 2, zc));
    g.add(box(f, gh, 0.06, alu, x0 + gw - f / 2, y0 + gh / 2, zc));
    for (let i = 1; i <= mullions; i++) g.add(box(f * 0.8, gh, 0.06, alu, x0 + (gw * i) / (mullions + 1), y0 + gh / 2, zc));
    const pane = box(gw - 2 * f, gh - 2 * f, 0.012, glass, x0 + gw / 2, y0 + gh / 2, zc, { cast: false });
    pane.renderOrder = 2;
    g.add(pane);
  };
  const doorLeaf = (lw, lh, x0, handleSide = 1, glazed = false) => {
    const zc = -depth * 0.35;
    if (glazed) {
      glazing(lw, lh, x0, 0, zc);
      g.add(box(0.03, 0.9, 0.03, material('chrome'), x0 + lw / 2 + handleSide * (lw / 2 - 0.12), 1.05, zc + 0.06));
    } else {
      const leaf = material('paint', 0xe7e5e0, { grime: 0.15 });
      g.add(box(lw - 0.01, lh - 0.01, 0.045, leaf, x0 + lw / 2, lh / 2, zc));
      // panel lines and a lever handle
      g.add(box(lw - 0.2, 0.012, 0.004, material('paint', 0xcfccc6), x0 + lw / 2, lh * 0.52, zc + 0.024));
      const hx = x0 + lw / 2 + handleSide * (lw / 2 - 0.09);
      g.add(box(0.05, 0.14, 0.012, material('steel'), hx, 1.02, zc + 0.03));
      g.add(box(0.13, 0.022, 0.022, material('chrome'), hx - handleSide * 0.05, 1.05, zc + 0.05));
    }
  };

  switch (type) {
    case 'personnel-door': doorLeaf(w, h, -w / 2, 1); break;
    case 'glass-door': doorLeaf(w, h, -w / 2, 1, true); break;
    case 'double-door': doorLeaf(w / 2, h, -w / 2, 1); doorLeaf(w / 2, h, 0, -1); break;
    case 'roller-door': {
      const slats = corrugatedGeometry({ O: V(-w / 2, h, -0.05), U: V(0, -1, 0), Vd: V(1, 0, 0), N: V(0, 0, 1), uLen: h, vLen: w, profile: { pitch: 0.077, depth: 0.012, outer: 0.05, inner: 0.012 } });
      g.add(mesh(slats, material('galvanised')));
      g.add(box(w + 0.2, 0.34, 0.34, material('galvanised', 0x9ea5a9), 0, h + 0.17, 0.12));
      g.add(box(0.06, h, 0.08, material('steel'), -w / 2 + 0.03, h / 2, -0.03));
      g.add(box(0.06, h, 0.08, material('steel'), w / 2 - 0.03, h / 2, -0.03));
      break;
    }
    case 'window': case 'small-window':
      glazing(w, h, -w / 2, 0, -depth * 0.4, w > 1 ? 1 : 0);
      g.add(box(w + 0.08, 0.03, 0.12, material('aluminium', 0xc8ccd0), 0, -0.015, 0.03));   // cill
      break;
    case 'serving-hatch':
      glazing(w, h, -w / 2, 0, -depth * 0.4, 1);
      g.add(box(w + 0.1, 0.035, 0.32, material('chrome', 0xdadde0), 0, -0.0175, 0.13));
      break;
    case 'glass-wall': {
      const bays = Math.max(1, Math.ceil(w / 1.2));
      glazing(w, h, -w / 2, 0, -depth * 0.4, bays - 1);
      break;
    }
    case 'vent': {
      const louvre = material('aluminium', 0x8a9298);
      for (let i = 0; i < 4; i++) {
        const s = box(w - 0.02, 0.006, 0.07, louvre, 0, 0.03 + i * (h - 0.05) / 3.2, 0.01);
        s.rotation.x = -0.6;
        g.add(s);
      }
      break;
    }
    default: break;   // 'cutout': an open frame into the next unit
  }
  return g;
}

/* ---------------- fittings (furniture) ---------------- */

/** A piece of furniture with its back to −Z, centred on the origin, standing on y = 0. */
export function fittingModel(type, w, d, h, color) {
  const g = new THREE.Group();
  const wood = material('timber', color ?? 0xb08d5f);
  const leg = material('steel', 0x3d4145);
  const soft = material('fabric', color ?? 0x7c7468);
  const white = material('plastic', 0xf2f2ef);
  const top = (th = 0.03, m = wood) => g.add(box(w, th, d, m, 0, h - th / 2, 0));
  const legs = (inset = 0.04, lh = h - 0.03, r = 0.018) => {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(r * 2, lh, r * 2, leg, sx * (w / 2 - inset), lh / 2, sz * (d / 2 - inset)));
  };
  switch (type) {
    case 'desk': case 'table':
      top(); legs();
      if (type === 'desk') g.add(box(w - 0.1, 0.35, 0.018, wood, 0, h - 0.23, -d / 2 + 0.05));
      break;
    case 'bistro':
      g.add(at(mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.03, 24), wood), 0, h - 0.015, 0));
      g.add(cyl(0.03, h - 0.03, leg, 0, (h - 0.03) / 2, 0));
      g.add(at(mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.02, 20), leg), 0, 0.01, 0));
      break;
    case 'chair': case 'stool': {
      const seatH = type === 'stool' ? h : 0.46;
      g.add(box(w * 0.9, 0.05, d * 0.9, soft, 0, seatH, 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.025, seatH, 0.025, leg, sx * w * 0.38, seatH / 2, sz * d * 0.38));
      if (type === 'chair') g.add(box(w * 0.88, h - seatH - 0.03, 0.05, soft, 0, (h + seatH) / 2, -d * 0.42));
      break;
    }
    case 'sofa':
      g.add(box(w, 0.42, d, soft, 0, 0.21, 0));
      g.add(box(w, h - 0.42, 0.18, soft, 0, (h + 0.42) / 2, -d / 2 + 0.09));
      g.add(box(0.16, 0.2, d, soft, -w / 2 + 0.08, 0.52, 0));
      g.add(box(0.16, 0.2, d, soft, w / 2 - 0.08, 0.52, 0));
      break;
    case 'bed': {
      g.add(box(w, 0.3, d, wood, 0, 0.15, 0));
      g.add(box(w - 0.04, 0.2, d - 0.04, material('fabric', 0xeeeae2), 0, 0.4, 0));
      g.add(box(w - 0.2, 0.1, 0.35, material('fabric', 0xffffff), 0, 0.55, -d / 2 + 0.25));
      g.add(box(w, 0.9, 0.05, wood, 0, 0.45, -d / 2 + 0.025));
      break;
    }
    case 'bunk': {
      for (const y of [0.35, 1.3]) {
        g.add(box(w, 0.06, d, leg, 0, y, 0));
        g.add(box(w - 0.04, 0.15, d - 0.04, material('fabric', 0xeeeae2), 0, y + 0.1, 0));
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.04, h, 0.04, leg, sx * (w / 2 - 0.02), h / 2, sz * (d / 2 - 0.02)));
      break;
    }
    case 'kitchen': case 'counter': case 'reception': {
      const body = material('plastic', color ?? 0xc9c4bb);
      g.add(box(w, h - 0.04, d - 0.02, body, 0, (h - 0.04) / 2, 0.01));
      g.add(box(w + 0.02, 0.04, d + 0.02, type === 'kitchen' ? material('marble', 0x3a3a3a) : wood, 0, h - 0.02, 0));
      for (let x = -w / 2 + 0.3; x < w / 2; x += 0.6) g.add(box(0.012, h - 0.2, 0.004, material('plastic', 0x9d978d), x, (h - 0.04) / 2, d / 2 + 0.012));
      if (type === 'kitchen') {
        g.add(box(0.5, 0.012, 0.36, material('chrome'), w / 4, h + 0.001, 0));
        g.add(cyl(0.012, 0.22, material('chrome'), w / 4, h + 0.11, -d / 2 + 0.08));
      }
      break;
    }
    case 'toilet': {
      g.add(at(mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.4, 20), white), 0, 0.2, 0.05));
      g.add(box(0.4, 0.34, 0.16, white, 0, 0.6, -d / 2 + 0.12));
      if (h > 1.5) {   // planner's cubicle: partition walls around the WC
        const p = material('plastic', 0xdfe3e6);
        g.add(box(0.03, h, d, p, -w / 2, h / 2, 0));
        g.add(box(0.03, h, d, p, w / 2, h / 2, 0));
      }
      break;
    }
    case 'shower':
      g.add(box(w, 0.06, d, white, 0, 0.03, 0));
      g.add(box(0.008, h - 0.1, d, material('glass'), w / 2 - 0.01, h / 2, 0));
      g.add(box(w, h - 0.1, 0.008, material('glass'), 0, h / 2, d / 2 - 0.01));
      g.add(cyl(0.012, 0.5, material('chrome'), -w / 2 + 0.1, h - 0.35, -d / 2 + 0.05));
      break;
    case 'basin':
      g.add(box(w, 0.14, d, white, 0, h - 0.07, 0));
      g.add(cyl(0.06, h - 0.14, white, 0, (h - 0.14) / 2, -d / 4));
      break;
    case 'rack': {
      const shelf = material('galvanised');
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.04, h, 0.04, material('paint', 0x2f5f86), sx * (w / 2 - 0.02), h / 2, sz * (d / 2 - 0.02)));
      for (let i = 0; i < 4; i++) g.add(box(w, 0.02, d, shelf, 0, 0.12 + i * (h - 0.2) / 3, 0));
      break;
    }
    case 'cabinet': case 'fridge': {
      const m = type === 'fridge' ? material('aluminium', 0xd9dcde) : material('plastic', color ?? 0xa89a86);
      g.add(box(w, h, d, m, 0, h / 2, 0));
      g.add(box(0.006, h - 0.08, 0.004, material('plastic', 0x6d665c), 0, h / 2, d / 2 + 0.002));
      g.add(box(0.02, 0.18, 0.02, material('chrome'), 0.05, h * 0.55, d / 2 + 0.015));
      break;
    }
    case 'ac':
      g.add(box(w, h, d, material('plastic', 0xf4f4f2), 0, h / 2, 0));
      g.add(box(w - 0.1, 0.02, 0.01, material('plastic', 0xcfd2d4), 0, 0.04, d / 2));
      break;
    case 'partition':
      g.add(box(w, h, d, material('render', 0xe8e4dc, { grime: 0 }), 0, h / 2, 0));
      break;
    default:
      g.add(box(w, h, d, material('plastic', color ?? 0xcccccc), 0, h / 2, 0));
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/* ---------------- the unit ---------------- */

/**
 * Builds one container or cabin.
 * spec: { size, len, wid, hgt, color (hex), openings:[{type, wall, along, sill, w, h}],
 *         roof (bool), lined (bool), cargoDoors ('auto' | true | false) }
 * Returns { group, ext, bottomY } — `group` is centred on the internal floor.
 */
export function buildUnit(spec) {
  const { len, wid, hgt } = spec;
  const iso = ISO[spec.size] && spec.size !== 'custom' ? ISO[spec.size] : null;
  const ext = externalDims(spec);
  const color = spec.color ?? 0x3f6b52;
  const paint = material('paint', color);
  const under = material('paint', 0x1f1f21, { grime: 0, streaks: 0 });
  const hole = material('rubber', 0x121212);
  const group = new THREE.Group();
  group.name = 'unit';
  const shell = new THREE.Group();
  shell.name = 'shell';
  group.add(shell);

  const xb = -ext.len / 2, xf = ext.len / 2, zl = -ext.wid / 2, zr = ext.wid / 2;
  const yb = -FLOOR_DEPTH, yt = hgt + ROOF_DEPTH;
  const openings = spec.openings || [];
  const onWall = (w) => openings.filter(o => o.wall === w);

  if (!iso) return buildCabin(spec, { group, shell, ext, xb, xf, zl, zr, yb, yt, paint, under });

  const P = MEMBERS.post, C = MEMBERS.casting, BR = MEMBERS.bottomRail, TR = MEMBERS.topRail;

  /* --- frame: corner posts, castings, rails --- */
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x0 = sx < 0 ? xb : xf - P.x, z0 = sz < 0 ? zl : zr - P.z;
    shell.add(boxMM(x0, yb, z0, x0 + P.x, yt, z0 + P.z, paint));
    for (const top of [false, true]) {
      const cx = sx < 0 ? xb + C.x / 2 : xf - C.x / 2, cz = sz < 0 ? zl + C.z / 2 : zr - C.z / 2;
      const cy = top ? yt - C.y / 2 : yb + C.y / 2;
      shell.add(box(C.x + 0.004, C.y + 0.004, C.z + 0.004, paint, cx, cy, cz));
      // Oval apertures: side face, end face and (top castings) top face.
      shell.add(box(0.124, 0.064, 0.004, hole, cx, cy, sz < 0 ? zl - 0.0015 : zr + 0.0015, { cast: false }));
      shell.add(box(0.004, 0.064, 0.064, hole, sx < 0 ? xb - 0.0015 : xf + 0.0015, cy, cz, { cast: false }));
      if (top) shell.add(box(0.124, 0.004, 0.064, hole, cx, yt + 0.0015, cz, { cast: false }));
    }
  }
  const railX0 = xb + P.x, railX1 = xf - P.x;
  for (const sz of [-1, 1]) {
    const zo = sz < 0 ? zl : zr - BR.d;
    shell.add(boxMM(railX0, yb, zo, railX1, yb + BR.h, zo + BR.d, paint));                                             // bottom side rail
    shell.add(boxMM(railX0, yt - TR.h, sz < 0 ? zl : zr - TR.d, railX1, yt, sz < 0 ? zl + TR.d : zr, paint));           // top side rail
    if (iso.forkPockets) {
      for (const px of [-1.025, 1.025]) shell.add(box(0.36, 0.115, 0.006, hole, px, yb + 0.07, sz < 0 ? zl - 0.001 : zr + 0.001, { cast: false }));
    }
  }
  for (const sx of [-1, 1]) {
    const x0 = sx < 0 ? xb : xf - 0.1;
    shell.add(boxMM(x0, yb, zl + P.z, x0 + 0.1, yb + BR.h, zr - P.z, paint));                                          // end sill
    shell.add(boxMM(x0, yt - (sx > 0 ? MEMBERS.doorHeader.h : 0.1), zl + P.z, x0 + 0.1, yt, zr - P.z, paint));          // header
  }

  /* --- floor: plywood on cross-members --- */
  const ply = material('floor-timber', 0x9a7a55);
  const floor = boxMM(-len / 2, -0.028, -wid / 2, len / 2, 0, wid / 2, ply, { cast: false });
  floor.name = '__floorface';
  if (ply.map) ply.map.repeat.set(1, 1);
  shell.add(floor);
  const cm = MEMBERS.crossMember;
  const count = Math.floor((ext.len - 0.4) / cm.pitch);
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(cm.w, cm.h, ext.wid - 0.1), under, count);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < count; i++) { mtx.makeTranslation(xb + 0.2 + i * cm.pitch, -0.028 - cm.h / 2, 0); inst.setMatrixAt(i, mtx); }
  inst.castShadow = true; inst.receiveShadow = true;
  shell.add(inst);

  /* --- corrugated walls --- */
  const wallDepthSide = ext.wid / 2 - wid / 2;       // 43 mm: outer ridge to the internal face
  const wallDepthEnd = ext.len / 2 - len / 2;        // 80 mm
  const sideV0 = yb + BR.h, sideV1 = yt - TR.h;
  // Opening → hole in a panel's (u, v) coordinates.
  const holeFor = (o, uOfAlong, v0) => ({ u0: uOfAlong(o.along) - o.w / 2 - 0.05, u1: uOfAlong(o.along) + o.w / 2 + 0.05, v0: o.sill - 0.05 - v0, v1: o.sill + o.h + 0.05 - v0 });

  const walls = {
    left: { O: V(railX0, sideV0, zl + 0.004), U: V(1, 0, 0), N: V(0, 0, -1), uLen: railX1 - railX0, vLen: sideV1 - sideV0, uOf: (a) => (-len / 2 + a) - railX0, v0: sideV0, profile: SKIN.side },
    right: { O: V(railX1, sideV0, zr - 0.004), U: V(-1, 0, 0), N: V(0, 0, 1), uLen: railX1 - railX0, vLen: sideV1 - sideV0, uOf: (a) => railX1 - (len / 2 - a), v0: sideV0, profile: SKIN.side },
    back: { O: V(xb + 0.004, yb + BR.h, zr - P.z), U: V(0, 0, -1), N: V(-1, 0, 0), uLen: ext.wid - 2 * P.z, vLen: yt - 0.1 - (yb + BR.h), uOf: (a) => (zr - P.z) - (wid / 2 - a), v0: yb + BR.h, profile: SKIN.end },
    front: { O: V(xf - 0.004, yb + BR.h, zl + P.z), U: V(0, 0, 1), N: V(1, 0, 0), uLen: ext.wid - 2 * P.z, vLen: yt - MEMBERS.doorHeader.h - (yb + BR.h), uOf: (a) => (-wid / 2 + a) - (zl + P.z), v0: yb + BR.h, profile: SKIN.end },
  };
  const cargoDoors = spec.cargoDoors === true || (spec.cargoDoors !== false && !onWall('front').length);
  for (const [id, w] of Object.entries(walls)) {
    if (id === 'front' && cargoDoors) continue;
    const holes = onWall(id).map(o => holeFor(o, w.uOf, w.v0));
    const geo = corrugatedGeometry({ O: w.O, U: w.U, Vd: V(0, 1, 0), N: w.N, uLen: w.uLen, vLen: w.vLen, profile: w.profile, holes, phase: 0.02 });
    const panel = mesh(geo, material('paint', color, { side: 'double' }));
    panel.name = `wall-${id}`;
    shell.add(panel);
  }
  if (cargoDoors) shell.add(cargoDoorEnd({ xf, zl, zr, yb, yt, P, BR, paint, color }));

  /* --- roof --- */
  if (spec.roof !== false) {
    const roof = corrugatedGeometry({ O: V(railX0, yt - 0.006, zl + TR.d), U: V(1, 0, 0), Vd: V(0, 0, 1), N: V(0, 1, 0), uLen: railX1 - railX0, vLen: ext.wid - 2 * TR.d, profile: SKIN.roof });
    const r = mesh(roof, material('paint', color, { side: 'double', grime: 0, streaks: 0 }));
    r.name = '__roof';
    shell.add(r);
  }

  /* --- lining inside (fitted-out units) --- */
  if (spec.lined) addLining(shell, spec, openings);

  /* --- openings --- */
  for (const o of openings) {
    const depth = o.wall === 'left' || o.wall === 'right' ? wallDepthSide : wallDepthEnd;
    const ins = openingInsert(o.type, o.w, o.h, depth + (spec.lined ? LINING_IN : 0), { color });
    placeOnWall(ins, o, spec, ext);
    ins.userData.opening = o;
    group.add(ins);
  }

  return { group, ext, bottomY: yb };
}

/** Places an opening insert (local x across, z outward) on its wall at the outer face. */
export function placeOnWall(obj, o, spec, ext = externalDims(spec)) {
  const { len, wid } = spec;
  const n = WALL_NORMAL[o.wall];
  let x = 0, z = 0;
  if (o.wall === 'left') { x = -len / 2 + o.along; z = -ext.wid / 2; }
  else if (o.wall === 'right') { x = len / 2 - o.along; z = ext.wid / 2; }
  else if (o.wall === 'front') { x = ext.len / 2; z = -wid / 2 + o.along; }
  else { x = -ext.len / 2; z = wid / 2 - o.along; }
  obj.position.set(x, o.sill, z);
  obj.rotation.y = Math.atan2(n.x, n.z);
}

// Fit-out lining: 12 mm board on 40 mm studs with insulation, so its face sits
// about 40 mm inside the corrugation valleys (as built, not flush with the steel).
const LINING_IN = 0.04, LINING_T = 0.012;

function addLining(shell, spec, openings) {
  const { len, wid, hgt } = spec;
  const lin = material('render', 0xf1efea, { grime: 0, side: 'double' });
  const t = LINING_T, i = LINING_IN;
  const sides = [
    { id: 'left', span: len, place: (r) => boxMM(-len / 2 + r.x0, r.y0, -wid / 2 + i - t, -len / 2 + r.x1, r.y1, -wid / 2 + i, lin, { cast: false }) },
    { id: 'right', span: len, place: (r) => boxMM(len / 2 - r.x1, r.y0, wid / 2 - i, len / 2 - r.x0, r.y1, wid / 2 - i + t, lin, { cast: false }) },
    { id: 'front', span: wid, place: (r) => boxMM(len / 2 - i, r.y0, -wid / 2 + r.x0, len / 2 - i + t, r.y1, -wid / 2 + r.x1, lin, { cast: false }) },
    { id: 'back', span: wid, place: (r) => boxMM(-len / 2 + i - t, r.y0, wid / 2 - r.x1, -len / 2 + i, r.y1, wid / 2 - r.x0, lin, { cast: false }) },
  ];
  for (const s of sides) {
    let rects = [{ x0: 0, x1: s.span, y0: 0, y1: hgt }];
    // Cut back by the 50 mm opening frame, which returns to meet the lining.
    for (const o of openings.filter(o => o.wall === s.id)) rects = subtractRect(rects, { x0: o.along - o.w / 2 - 0.05, x1: o.along + o.w / 2 + 0.05, y0: o.sill - 0.05, y1: o.sill + o.h + 0.05 });
    for (const r of rects) shell.add(s.place(r));
  }
}

/** Inner clear width once lined: partitions stop at the lining, not the steel. */
export const LINED_CLEARANCE = LINING_IN;

/** The ISO cargo-door end: two corrugated leaves, four locking bars, cam keepers, handles and hinges. */
function cargoDoorEnd({ xf, zl, zr, yb, yt, P, BR, paint, color }) {
  const g = new THREE.Group();
  g.name = 'cargo-doors';
  const y0 = yb + BR.h, y1 = yt - MEMBERS.doorHeader.h;
  const z0 = zl + P.z, z1 = zr - P.z;
  const leafW = (z1 - z0) / 2;
  const doorMat = material('paint', color, { side: 'double' });
  const bar = material('galvanised', 0x9aa1a6);
  const x = xf - 0.012;
  for (let leaf = 0; leaf < 2; leaf++) {
    const lz0 = z0 + leaf * leafW;
    const geo = corrugatedGeometry({ O: V(x, y0 + 0.05, lz0 + 0.05), U: V(0, 0, 1), Vd: V(0, 1, 0), N: V(1, 0, 0), uLen: leafW - 0.1, vLen: y1 - y0 - 0.1, profile: SKIN.door, phase: 0.03 });
    g.add(mesh(geo, doorMat));
    // leaf frame
    g.add(boxMM(x - 0.03, y0, lz0, x + 0.004, y0 + 0.05, lz0 + leafW - 0.004, paint));
    g.add(boxMM(x - 0.03, y1 - 0.05, lz0, x + 0.004, y1, lz0 + leafW - 0.004, paint));
    g.add(boxMM(x - 0.03, y0, lz0, x + 0.004, y1, lz0 + 0.05, paint));
    g.add(boxMM(x - 0.03, y0, lz0 + leafW - 0.054, x + 0.004, y1, lz0 + leafW - 0.004, paint));
    // two locking bars per leaf, with cam keepers and a handle
    for (const at of [0.2, leafW - 0.28]) {
      const bz = lz0 + at;
      g.add(cyl(0.0135, y1 - y0 + 0.08, bar, x + 0.045, (y0 + y1) / 2, bz));
      g.add(box(0.05, 0.07, 0.07, bar, x + 0.03, y0 + 0.02, bz));
      g.add(box(0.05, 0.07, 0.07, bar, x + 0.03, y1 - 0.02, bz));
      for (const gy of [0.45, 1.6]) g.add(box(0.03, 0.03, 0.06, bar, x + 0.035, y0 + gy, bz));
      const handle = box(0.025, 0.025, 0.42, bar, x + 0.07, y0 + 1.1, bz + (leaf ? -0.2 : 0.2));
      g.add(handle);
    }
    // hinges on the corner-post side
    const hz = leaf ? z1 - 0.01 : z0 + 0.01;
    for (let i = 0; i < 4; i++) g.add(cyl(0.022, 0.12, bar, x + 0.02, y0 + 0.25 + i * (y1 - y0 - 0.5) / 3, hz));
  }
  // rubber seal between the leaves and the CSC safety-approval plate
  g.add(boxMM(x - 0.01, y0, (z0 + z1) / 2 - 0.006, x + 0.006, y1, (z0 + z1) / 2 + 0.006, material('rubber')));
  g.add(boxMM(x + 0.004, y0 + 1.35, z0 + 0.35, x + 0.008, y0 + 1.55, z0 + 0.6, material('aluminium', 0xd0d3d6)));
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** Portacabin: insulated sandwich-panel walls on a steel base frame, with a low-pitch sheet roof. */
function buildCabin(spec, { group, shell, ext, xb, xf, zl, zr, yb, yt, paint, under }) {
  const { len, wid, hgt } = spec;
  const panelMat = material('render', 0xecebe6, { grime: 0.12 });
  const trim = paint;
  const openings = spec.openings || [];
  // base frame and floor
  shell.add(boxMM(xb, yb, zl, xf, yb + 0.14, zr, under));
  const ply = material('floor-timber', 0x9a7a55);
  const f = boxMM(-len / 2, -0.02, -wid / 2, len / 2, 0, wid / 2, ply, { cast: false });
  f.name = '__floorface';
  shell.add(f);
  // walls with openings cut out (flat 60 mm panels)
  const t = 0.06;
  const walls = [
    { id: 'left', span: len, mk: (r) => boxMM(-len / 2 + r.x0, r.y0, zl, -len / 2 + r.x1, r.y1, zl + t, panelMat) },
    { id: 'right', span: len, mk: (r) => boxMM(len / 2 - r.x1, r.y0, zr - t, len / 2 - r.x0, r.y1, zr, panelMat) },
    { id: 'front', span: wid, mk: (r) => boxMM(xf - t, r.y0, -wid / 2 + r.x0, xf, r.y1, -wid / 2 + r.x1, panelMat) },
    { id: 'back', span: wid, mk: (r) => boxMM(xb, r.y0, wid / 2 - r.x1, xb + t, r.y1, wid / 2 - r.x0, panelMat) },
  ];
  for (const w of walls) {
    let rects = [{ x0: 0, x1: w.span, y0: 0, y1: hgt }];
    for (const o of openings.filter(o => o.wall === w.id)) rects = subtractRect(rects, { x0: o.along - o.w / 2, x1: o.along + o.w / 2, y0: o.sill, y1: o.sill + o.h });
    for (const r of rects) shell.add(w.mk(r));
  }
  // coloured corner trims and eaves band
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) shell.add(box(0.1, hgt + 0.14, 0.1, trim, sx * (ext.len / 2 - 0.045), (hgt + 0.14) / 2 - 0.14, sz * (ext.wid / 2 - 0.045)));
  // Eaves band: a coloured fascia round the top edge.
  const e = 0.05;
  shell.add(boxMM(xb - 0.01, hgt, zl - 0.01, xf + 0.01, hgt + 0.12, zl + e, trim));
  shell.add(boxMM(xb - 0.01, hgt, zr - e, xf + 0.01, hgt + 0.12, zr + 0.01, trim));
  shell.add(boxMM(xb - 0.01, hgt, zl + e, xb + e, hgt + 0.12, zr - e, trim));
  shell.add(boxMM(xf - e, hgt, zl + e, xf + 0.01, hgt + 0.12, zr - e, trim));
  if (spec.roof !== false) {
    const roof = corrugatedGeometry({ O: V(xb - 0.12, hgt + 0.13, zl - 0.12), U: V(1, 0, 0), Vd: V(0, 0.05, 1).normalize(), N: V(0, 1, -0.05).normalize(), uLen: ext.len + 0.24, vLen: ext.wid + 0.24, profile: { pitch: 0.2, depth: 0.025, outer: 0.03, inner: 0.1 } });
    const r = mesh(roof, material('galvanised', 0xb5bbbf, { side: 'double' }));
    r.name = '__roof';
    shell.add(r);
  }
  if (spec.lined) addLining(shell, spec, openings);
  for (const o of openings) {
    const ins = openingInsert(o.type, o.w, o.h, t, { color: spec.color ?? 0x3f6b52 });
    placeOnWall(ins, o, spec, ext);
    ins.userData.opening = o;
    group.add(ins);
  }
  return { group, ext, bottomY: yb };
}
