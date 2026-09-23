/* ============================================================
   TOOLBOX — Container design preview card

   Renders a design from js/lib/container-design.js without three.js:
   - an isometric 3D view (SVG, painter's algorithm over axis-aligned
     boxes), with a cut-away / roof toggle, four view angles, levels
     and an exploded mode,
   - a dimensioned floor plan per level,
   - a spec & cost sheet.
   Downloads (PNG of the current view, SVG plan) and a hand-off to
   the Container Planner live in the footer.
   ============================================================ */

import {
  OPENINGS, FITTINGS, COLORS, WALL, GROUND_Y, M_PER_FT,
  toSite, rectToSite, footprint, openingLocal, dims,
  plannerHandoff, HANDOFF_KEY,
} from '../container-design.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f1 = (v) => Math.round(v * 10) / 10;
const naira = (v) => `₦${Math.round(v || 0).toLocaleString('en-NG')}`;
const nairaShort = (v) => (v >= 1e6 ? `₦${(v / 1e6).toFixed(v >= 1e8 ? 0 : 1)}m` : `₦${Math.round(v / 1000)}k`);
const FRONT = [[0, 1], [-1, 0], [0, -1], [1, 0]];

/* ---------------- colour helpers ---------------- */

function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(hex, to, t) {
  const a = hexToRgb(hex), b = hexToRgb(to);
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}
const shade = (hex, t) => (t >= 0 ? mix(hex, '#ffffff', t) : mix(hex, '#000000', -t));

function palette(dark) {
  return dark ? {
    bg0: '#1d1d1c', bg1: '#141414', ground: '#262625', grid: 'rgba(255,255,255,0.035)', shadow: 'rgba(0,0,0,0.6)',
    text: '#f1f1ef', halo: '#121212', sub: '#a3a3a3', interior: '#c9c4bb', floor: '#b09f84', wet: '#a9b6bc', poche: '#0b0b0b',
    steel: '#34373a', glass: 'rgba(170,205,222,0.42)', glassEdge: '#dfe9ee', door: '#6b5039', plan: '#171717', ink: '#ededeb',
    ink2: '#8f8f8b', roomFill: 'rgba(255,255,255,0.025)', wetFill: 'rgba(150,185,200,0.13)', furn: '#b4b4ae', dim: '#9a9a96', accent: '#f1f1ef',
  } : {
    bg0: '#f6f5f2', bg1: '#e9e7e2', ground: '#e3e1dc', grid: 'rgba(0,0,0,0.035)', shadow: 'rgba(30,30,25,0.26)',
    text: '#1c1c1a', halo: '#ffffff', sub: '#6b6b6b', interior: '#efebe4', floor: '#d8c9ae', wet: '#cfdadf', poche: '#232323',
    steel: '#3a3d40', glass: 'rgba(150,196,218,0.45)', glassEdge: '#f4f8fa', door: '#6b4c33', plan: '#ffffff', ink: '#1a1a1a',
    ink2: '#7a7a76', roomFill: 'rgba(0,0,0,0.018)', wetFill: 'rgba(120,160,180,0.12)', furn: '#5b5b58', dim: '#6f6f6b', accent: '#0a0a0a',
  };
}

/* ============================================================
   Isometric scene
   ============================================================ */

const C30 = Math.cos(Math.PI / 6), S30 = 0.5;
const SCALE = 40;   // px per metre in the SVG's own units

function viewXf(design, v) {
  const s = design.site;
  const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
  const rot = (x, z) => {
    const dx = x - cx, dz = z - cz;
    return [[dx, dz], [dz, -dx], [-dx, -dz], [-dz, dx]][v];
  };
  const vec = (x, z) => [[x, z], [z, -x], [-x, -z], [-z, x]][v];
  const box = (r, y0, y1) => {
    const a = rot(r.x0, r.z0), b = rot(r.x1, r.z1);
    return { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), z0: Math.min(a[1], b[1]), z1: Math.max(a[1], b[1]), y0, y1 };
  };
  return { rot, vec, box };
}
const P = (x, y, z) => [(x - z) * C30 * SCALE, (x + z) * S30 * SCALE - y * SCALE];
const pts = (list) => list.map(([x, y, z]) => P(x, y, z).map(n => n.toFixed(1)).join(',')).join(' ');
const poly = (list, fill, extra = '') => `<polygon points="${pts(list)}" fill="${fill}" ${extra}/>`;

/** Visible faces of a box: top, +X side, +Z side. */
function boxFaces(b, color, { top = null, sx = -0.2, sz = -0.08, stroke = null, sw = 0.6, opacity = 1 } = {}) {
  const { x0, x1, y0, y1, z0, z1 } = b;
  const st = stroke ? `stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"` : '';
  const op = opacity < 1 ? `fill-opacity="${opacity}"` : '';
  return [
    poly([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], shade(color, sx), `${st} ${op}`),
    poly([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], shade(color, sz), `${st} ${op}`),
    poly([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], top || shade(color, 0.12), `${st} ${op}`),
  ].join('');
}

/** A face on the plane axis = c (normal +axis), spanning u along the other axis and y. Holes cut out. */
function faceWithHoles(axis, c, u0, u1, y0, y1, holes) {
  const at = (u, y) => (axis === 'x' ? [c, y, u] : [u, y, c]);
  const ring = (a0, a1, b0, b1) => `M${pts([at(a0, b0)])}L${pts([at(a1, b0)])}L${pts([at(a1, b1)])}L${pts([at(a0, b1)])}Z`;
  let d = ring(u0, u1, y0, y1);
  for (const h of holes) {
    const a0 = Math.max(u0, h.u0), a1 = Math.min(u1, h.u1), b0 = Math.max(y0, h.y0), b1 = Math.min(y1, h.y1);
    if (a1 - a0 > 0.01 && b1 - b0 > 0.01) d += ring(a0, a1, b0, b1);
  }
  return d;
}

function sortPrims(prims) {
  const n = prims.length;
  const bb = prims.map(p => {
    const b = p.box;
    const cs = [[b.x0, b.y0, b.z0], [b.x1, b.y0, b.z0], [b.x0, b.y0, b.z1], [b.x1, b.y0, b.z1], [b.x0, b.y1, b.z0], [b.x1, b.y1, b.z0], [b.x0, b.y1, b.z1], [b.x1, b.y1, b.z1]].map(q => P(...q));
    return { x0: Math.min(...cs.map(c => c[0])), x1: Math.max(...cs.map(c => c[0])), y0: Math.min(...cs.map(c => c[1])), y1: Math.max(...cs.map(c => c[1])) };
  });
  const E = 0.005;
  const behind = (a, b) => a.x1 <= b.x0 + E || a.z1 <= b.z0 + E || a.y1 <= b.y0 + E;
  const out = Array.from({ length: n }, () => []);
  const indeg = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const A = bb[i], B = bb[j];
    if (A.x1 <= B.x0 || B.x1 <= A.x0 || A.y1 <= B.y0 || B.y1 <= A.y0) continue;
    const a = prims[i].box, b = prims[j].box;
    const ab = behind(a, b), ba = behind(b, a);
    if (ab && !ba) { out[i].push(j); indeg[j]++; }
    else if (ba && !ab) { out[j].push(i); indeg[i]++; }
    // separated along two axes in opposite senses: they only meet at an edge, so no order is needed
  }
  const depth = (p) => (p.box.x0 + p.box.x1 + p.box.z0 + p.box.z1) / 2 + (p.box.y0 + p.box.y1) / 2 * 0.5 + (p.bias || 0);
  const ready = [];
  for (let i = 0; i < n; i++) if (!indeg[i]) ready.push(i);
  const order = [], done = new Uint8Array(n);
  while (order.length < n) {
    if (!ready.length) {   // cycle: take the deepest remaining
      let best = -1;
      for (let i = 0; i < n; i++) if (!done[i] && (best < 0 || depth(prims[i]) < depth(prims[best]))) best = i;
      ready.push(best); indeg[best] = 0;
    }
    ready.sort((a, b) => depth(prims[b]) - depth(prims[a]));
    const i = ready.pop();
    if (done[i]) continue;
    done[i] = 1; order.push(prims[i]);
    for (const j of out[i]) if (!done[j] && --indeg[j] === 0) ready.push(j);
  }
  return order;
}

/** Build the isometric SVG for a view state. */
export function isoSvg(design, view, pal) {
  const { angle = 0, roof = false, level = 'all', explode = false } = view;
  const X = viewXf(design, angle);
  const topLevel = design.levels.length - 1;
  const showLevel = (L) => (level === 'all' ? true : L <= level);
  const cutLevel = (L) => !roof && (level === 'all' ? (explode || topLevel === 0 ? true : L === topLevel) : L === level);
  const lift = (L) => (explode && level === 'all' ? L * 2.4 : 0);
  const prims = [];
  const labels = [];
  const kind = (m) => (design.extras.cladding !== 'none' ? design.extras.cladding : String(m.size).startsWith('pc') || m.size === 'custom' ? 'cabin' : 'container');

  // view-space helpers
  const vis = (n) => { const v = X.vec(n.x, n.z); return v[0] > 0.5 || v[1] > 0.5; };   // outward face towards the viewer?
  const itemBack = (m, r) => { const [fx, fz] = FRONT[r]; const s = m.rot === 90 ? { x: fz, z: -fx } : { x: -fx, z: -fz }; return s; };

  for (const m of design.modules) {
    if (!showLevel(m.level)) continue;
    const dy = lift(m.level);
    const e = m.elev + dy;
    const cut = cutLevel(m.level);
    const shellTop = e + m.hgt + 0.1;
    const skin = kind(m);
    const base = skin === 'timber' ? '#8a5d3b' : m.colorHex;
    const fp = footprint(m, WALL);

    // floor slab with rooms
    prims.push({
      box: X.box(fp, e - 0.14, e), bias: -0.02,
      draw: () => {
        const b = X.box(fp, e - 0.14, e);
        let s = boxFaces(b, pal.steel, { top: pal.floor });
        for (const rm of m.rooms) {
          const r = rectToSite(m, { x0: rm.x0, x1: rm.x1, z0: 0, z1: m.wid });
          const q = X.box(r, e, e);
          const wet = ['toilet', 'bathroom'].includes(rm.kind);
          const fill = wet ? pal.wet : ['store', 'storage'].includes(rm.kind) ? shade(pal.floor, -0.12) : ['seating', 'service', 'living', 'bedroom'].includes(rm.kind) ? shade(pal.floor, -0.05) : pal.floor;
          s += poly([[q.x0, e, q.z0], [q.x1, e, q.z0], [q.x1, e, q.z1], [q.x0, e, q.z1]], fill);
          if (wet) {
            // tile grid
            const step = 0.3;
            let g = '';
            for (let t = q.x0 + step; t < q.x1; t += step) g += `M${pts([[t, e, q.z0]])}L${pts([[t, e, q.z1]])}`;
            for (let t = q.z0 + step; t < q.z1; t += step) g += `M${pts([[q.x0, e, t]])}L${pts([[q.x1, e, t]])}`;
            s += `<path d="${g}" stroke="rgba(255,255,255,0.35)" stroke-width="0.6" fill="none"/>`;
          }
          if (cut) {
            const c = X.rot(...Object.values(toSite(m, (rm.x0 + rm.x1) / 2, m.wid / 2)));
            labels.push({ p: P(c[0], e + 0.02, c[1]), name: rm.name, area: rm.area, small: rm.x1 - rm.x0 < 1.6 });
          }
        }
        return s;
      },
    });

    // walls
    const wallDefs = [
      { wall: 'left', r: { x0: 0, x1: m.len, z0: -WALL, z1: 0 }, n: { x: 0, z: -1 } },
      { wall: 'right', r: { x0: 0, x1: m.len, z0: m.wid, z1: m.wid + WALL }, n: { x: 0, z: 1 } },
      { wall: 'back', r: { x0: -WALL, x1: 0, z0: -WALL, z1: m.wid + WALL }, n: { x: -1, z: 0 } },
      { wall: 'front', r: { x0: m.len, x1: m.len + WALL, z0: -WALL, z1: m.wid + WALL }, n: { x: 1, z: 0 } },
    ];
    for (const wd of wallDefs) {
      const siteR = rectToSite(m, wd.r);
      const sn = m.rot === 90 ? { x: -wd.n.z, z: wd.n.x } : wd.n;
      const outward = vis(sn);
      const near = outward;
      const hTop = cut ? (near ? e + 0.9 : shellTop) : shellTop;
      const box = X.box(siteR, e - 0.14, hTop);
      const ops = m.items.filter(i => i.kind === 'opening' && i.wall === wd.wall);
      prims.push({
        box,
        draw: () => {
          const axis = (box.x1 - box.x0) < (box.z1 - box.z0) ? 'x' : 'z';   // thin along this axis → the face is on it
          const c = axis === 'x' ? box.x1 : box.z1;
          const [u0, u1] = axis === 'x' ? [box.z0, box.z1] : [box.x0, box.x1];
          const holes = ops.map(o => {
            const L = rectToSite(m, openingLocal(m, o));
            const q = X.box(L, 0, 0);
            const [a0, a1] = axis === 'x' ? [q.z0, q.z1] : [q.x0, q.x1];
            return { u0: a0, u1: a1, y0: e + o.sill, y1: e + o.sill + o.h, o };
          });
          const faceColor = outward ? base : pal.interior;
          const d = faceWithHoles(axis, c, u0, u1, box.y0, box.y1, holes);
          let s = `<path d="${d}" fill="${shade(faceColor, axis === 'x' ? -0.2 : -0.06)}" fill-rule="evenodd"/>`;
          if (outward && skin !== 'cabin') s += `<path d="${d}" fill="url(#cd-${skin === 'timber' ? 'slat' : skin === 'composite' ? 'panel' : 'corr'}-${axis})" fill-rule="evenodd"/>`;
          if (outward && skin === 'container') {
            // top & bottom rails, corner posts
            const band = (y0, y1) => faceWithHoles(axis, c, u0, u1, y0, y1, []);
            s += `<path d="${band(box.y0, e + 0.08)}" fill="${shade(base, -0.42)}"/>`;
            if (!cut || !near) s += `<path d="${band(shellTop - 0.1, shellTop)}" fill="${shade(base, -0.3)}"/>`;
            s += `<path d="${faceWithHoles(axis, c, u0, u0 + 0.14, box.y0, box.y1, [])}${faceWithHoles(axis, c, u1 - 0.14, u1, box.y0, box.y1, [])}" fill="${shade(base, -0.36)}"/>`;
          }
          // openings
          for (const h of holes) {
            const spec = OPENINGS[h.o.type];
            const a0 = Math.max(u0, h.u0), a1 = Math.min(u1, h.u1), b0 = Math.max(box.y0, h.y0), b1 = Math.min(box.y1, h.y1);
            if (a1 - a0 < 0.02 || b1 - b0 < 0.02) continue;
            const at = (u, y) => (axis === 'x' ? [c - WALL / 2, y, u] : [u, y, c - WALL / 2]);
            const quad = (p0, p1, q0, q1) => [at(p0, q0), at(p1, q0), at(p1, q1), at(p0, q1)];
            // reveal (the jamb depth) as a dark sliver
            s += poly(quad(a0, a1, b0, b1), shade(outward ? base : pal.interior, -0.5));
            if (spec.glass) {
              s += poly(quad(a0 + 0.03, a1 - 0.03, b0 + 0.03, b1 - 0.03), pal.glass, `stroke="${pal.glassEdge}" stroke-width="1.1"`);
              const mull = h.o.type === 'glass-wall' ? Math.max(1, Math.round((a1 - a0) / 1.1)) : h.o.w > 0.9 ? 2 : 1;
              let g = '';
              for (let k = 1; k < mull; k++) { const u = a0 + (a1 - a0) * k / mull; g += `M${pts([at(u, b0)])}L${pts([at(u, b1)])}`; }
              if (h.o.type === 'glass-door') g += `M${pts([at((a0 + a1) / 2 + 0.25, b0 + 1)])}L${pts([at((a0 + a1) / 2 + 0.25, b0 + 1.1)])}`;
              // sheen
              g += `M${pts([at(a0 + (a1 - a0) * 0.18, b0 + (b1 - b0) * 0.25)])}L${pts([at(a0 + (a1 - a0) * 0.38, b1 - (b1 - b0) * 0.12)])}`;
              s += `<path d="${g}" stroke="${pal.glassEdge}" stroke-width="1.1" fill="none" stroke-opacity="0.85"/>`;
            } else if (spec.door && !spec.roller) {
              const leaf = h.o.type === 'double-door' ? 2 : 1;
              s += poly(quad(a0 + 0.02, a1 - 0.02, b0, b1 - 0.02), pal.door, `stroke="${shade(pal.door, -0.35)}" stroke-width="0.8"`);
              let g = '';
              for (let k = 1; k < leaf; k++) { const u = (a0 + a1) / 2; g += `M${pts([at(u, b0)])}L${pts([at(u, b1)])}`; }
              const hu = leaf > 1 ? (a0 + a1) / 2 - 0.12 : a1 - 0.12;
              g += `M${pts([at(hu, b0 + 1.0)])}L${pts([at(hu, b0 + 1.08)])}`;
              if (leaf === 1) g += `M${pts([at(a0 + 0.12, b0 + 0.3)])}L${pts([at(a1 - 0.2, b0 + 0.3)])}L${pts([at(a1 - 0.2, b1 - 0.35)])}L${pts([at(a0 + 0.12, b1 - 0.35)])}Z`;
              s += `<path d="${g}" stroke="${shade(pal.door, 0.35)}" stroke-width="1" fill="none"/>`;
            } else if (spec.roller) {
              s += poly(quad(a0 + 0.02, a1 - 0.02, b0, b1), '#a3a9ad');
              let g = '';
              for (let y = b0 + 0.08; y < b1; y += 0.08) g += `M${pts([at(a0 + 0.02, y)])}L${pts([at(a1 - 0.02, y)])}`;
              s += `<path d="${g}" stroke="rgba(0,0,0,0.22)" stroke-width="0.7" fill="none"/>`;
            } else if (h.o.type === 'vent') {
              s += poly(quad(a0, a1, b0, b1), '#8a9298');
              let g = '';
              for (let y = b0 + 0.05; y < b1; y += 0.06) g += `M${pts([at(a0, y)])}L${pts([at(a1, y)])}`;
              s += `<path d="${g}" stroke="rgba(0,0,0,0.35)" stroke-width="0.7" fill="none"/>`;
            }
          }
          // top of the wall: dark poche where cut, shell colour at the eaves
          const tb = { ...box };
          const topFill = cut && near ? pal.poche : shade(outward ? base : pal.interior, 0.1);
          s += poly([[tb.x0, tb.y1, tb.z0], [tb.x1, tb.y1, tb.z0], [tb.x1, tb.y1, tb.z1], [tb.x0, tb.y1, tb.z1]], topFill);
          // the thin end face
          if (axis === 'x') s += poly([[box.x0, box.y0, box.z1], [box.x1, box.y0, box.z1], [box.x1, box.y1, box.z1], [box.x0, box.y1, box.z1]], shade(base, -0.3));
          else s += poly([[box.x1, box.y0, box.z0], [box.x1, box.y0, box.z1], [box.x1, box.y1, box.z1], [box.x1, box.y1, box.z0]], shade(base, -0.35));
          return s;
        },
      });
    }

    // roof
    if (!cut) {
      const hasPitch = design.roofs.some(r => r.module === m.id && r.kind === 'pitched');
      const rb = X.box(fp, shellTop, shellTop + 0.06);
      const along = X.vec(...(m.rot === 90 ? [0, 1] : [1, 0]));
      prims.push({
        box: rb,
        draw: () => {
          let s = boxFaces(rb, base, { top: shade(base, 0.1), sx: -0.3, sz: -0.15 });
          const top = [[rb.x0, rb.y1, rb.z0], [rb.x1, rb.y1, rb.z0], [rb.x1, rb.y1, rb.z1], [rb.x0, rb.y1, rb.z1]];
          if (skin === 'container' && !hasPitch) s += `<polygon points="${pts(top)}" fill="url(#cd-roof-${Math.abs(along[0]) > 0.5 ? 'x' : 'z'})"/>`;
          return s;
        },
      });
    }

    // partitions
    for (const p of m.items.filter(i => i.type === 'partition')) {
      const { dx, dz } = dims('partition', p.r, p);
      const segs = [];
      if (p.door && !(p.r % 2)) {
        segs.push({ x0: p.x - dx / 2, x1: p.x + dx / 2, z0: 0, z1: p.door.z0 });
        segs.push({ x0: p.x - dx / 2, x1: p.x + dx / 2, z0: p.door.z1, z1: m.wid });
      } else segs.push({ x0: p.x - dx / 2, x1: p.x + dx / 2, z0: p.z - dz / 2, z1: p.z + dz / 2 });
      const h = cut ? 1.25 : p.h;
      for (const sg of segs) {
        if (sg.z1 - sg.z0 < 0.02) continue;
        const b = X.box(rectToSite(m, sg), e, e + h);
        prims.push({ box: b, draw: () => boxFaces(b, pal.interior, { top: cut ? pal.poche : shade(pal.interior, 0.08), sx: -0.14, sz: -0.05 }) });
      }
      // door leaf standing open inside the gap
      if (p.door && !(p.r % 2)) {
        const hx = p.x + p.door.swing * (p.door.z1 - p.door.z0 - 0.02) / 2;
        const leaf = { x0: Math.min(p.x, p.x + p.door.swing * (p.door.z1 - p.door.z0)), x1: Math.max(p.x, p.x + p.door.swing * (p.door.z1 - p.door.z0)), z0: p.door.z0 + 0.01, z1: p.door.z0 + 0.05 };
        void hx;
        const b = X.box(rectToSite(m, leaf), e, e + Math.min(h, 2.0));
        prims.push({ box: b, draw: () => boxFaces(b, shade(pal.door, 0.25), { sx: -0.2, sz: -0.1 }) });
      }
    }

    // furniture
    for (const it of m.items.filter(i => i.kind === 'fitting' && i.type !== 'partition')) {
      const f = FITTINGS[it.type];
      const { dx, dz } = dims(it.type, it.r, it);
      const lr = { x0: it.x - dx / 2, x1: it.x + dx / 2, z0: it.z - dz / 2, z1: it.z + dz / 2 };
      const y0 = e + (it.mount || 0);
      const bx = X.box(rectToSite(m, lr), y0, y0 + f.h);
      const back = itemBack(m, it.r);
      prims.push({ box: bx, draw: () => drawFurniture(it, f, bx, X.vec(back.x, back.z), pal) });
    }
  }

  // stairs
  for (const st of design.stairs) {
    const L = st.toLevel;
    if (!showLevel(Math.min(L, topLevel)) && level !== 'all') continue;
    if (level !== 'all' && st.toLevel > level + 0) continue;
    const dy = lift(Math.max(0, L - 1));
    const fromY = st.fromY + dy, toY = st.toY + lift(Math.min(L, topLevel)) + (L > topLevel ? lift(topLevel) - lift(topLevel) : 0);
    const fb = X.box(st.flight, Math.min(fromY, toY) - 0.02, toY + 1.0);
    const asc = X.vec(st.ascent.x, st.ascent.z);
    prims.push({ box: fb, draw: () => drawFlight(fb, asc, fromY, toY, st.risers, pal) });
    const lb = X.box(st.landing, GROUND_Y + (L > 1 ? lift(L - 1) : 0), toY + 1.0);
    prims.push({ box: lb, draw: () => drawLanding(lb, toY, pal, asc) });
  }

  // decks, canopies, roof decks and pitched roofs
  for (const dk of design.decks) {
    const b = X.box(dk.rect, -0.2, 0);
    const o = X.vec(dk.out.x, dk.out.z);
    prims.push({ box: b, draw: () => drawDeck(b, o, pal) });
  }
  for (const cp of design.canopies) {
    const m = design.modules.find(x => x.id === cp.module);
    if (!showLevel(m.level)) continue;
    const y = cp.y + lift(m.level);
    const b = X.box(cp.rect, cp.posts ? GROUND_Y : y - 0.18, y + 0.05);
    const o = X.vec(cp.out.x, cp.out.z);
    prims.push({ box: b, draw: () => drawCanopy(b, o, y, cp.posts, pal) });
  }
  for (const rf of design.roofs) {
    const m = design.modules.find(x => x.id === rf.module);
    if (!showLevel(m.level) || cutLevel(m.level)) continue;
    const y = rf.y + lift(m.level) + 0.06;
    if (rf.kind === 'deck') {
      const b = X.box(rf.rect, y, y + 0.05);
      prims.push({ box: b, draw: () => boxFaces(b, '#9b7653', { top: '#b08a63', sx: -0.25, sz: -0.12 }) + deckLines(b, y + 0.05, X.vec(...(m.rot === 90 ? [0, 1] : [1, 0]))) });
      // railings: four glass panels
      const r = rf.rect, t = 0.04;
      for (const side of [{ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z0 + t }, { x0: r.x0, x1: r.x1, z0: r.z1 - t, z1: r.z1 }, { x0: r.x0, x1: r.x0 + t, z0: r.z0 + t, z1: r.z1 - t }, { x0: r.x1 - t, x1: r.x1, z0: r.z0 + t, z1: r.z1 - t }]) {
        const rb = X.box(side, y + 0.05, y + 1.05);
        prims.push({ box: rb, draw: () => drawRailing(rb, pal) });
      }
    } else {
      const b = X.box(rf.rect, y, y + rf.rise);
      const ridgeAlongX = Math.abs(X.vec(...(rf.ridge === 'x' ? [1, 0] : [0, 1]))[0]) > 0.5;
      prims.push({ box: b, draw: () => drawPitched(b, ridgeAlongX, m.colorHex, pal) });
    }
  }

  const order = sortPrims(prims);
  const body = order.map(p => p.draw()).join('');   // also collects the room labels

  // frame
  const allPts = [];
  for (const p of prims) {
    const b = p.box;
    for (const q of [[b.x0, b.y0, b.z0], [b.x1, b.y0, b.z0], [b.x0, b.y0, b.z1], [b.x1, b.y0, b.z1], [b.x0, b.y1, b.z0], [b.x1, b.y1, b.z0], [b.x0, b.y1, b.z1], [b.x1, b.y1, b.z1]]) allPts.push(P(...q));
  }
  // ground shadow under everything at level 0
  const sb = X.box(design.site, GROUND_Y, GROUND_Y);
  const pad = 1.1;
  const gpts = [[sb.x0 - pad, GROUND_Y, sb.z0 - pad], [sb.x1 + pad, GROUND_Y, sb.z0 - pad], [sb.x1 + pad, GROUND_Y, sb.z1 + pad], [sb.x0 - pad, GROUND_Y, sb.z1 + pad]];
  for (const g of gpts) allPts.push(P(...g));
  const minX = Math.min(...allPts.map(p => p[0])) - 24, maxX = Math.max(...allPts.map(p => p[0])) + 24;
  const minY = Math.min(...allPts.map(p => p[1])) - 30, maxY = Math.max(...allPts.map(p => p[1])) + 18;
  const W = maxX - minX, H = maxY - minY;

  const shadowPolys = design.modules.filter(m => showLevel(m.level) && m.level === 0).map(m => {
    const r = footprint(m, WALL + 0.05);
    const b = X.box(r, 0, 0);
    const off = 0.35;
    return poly([[b.x0 + off, GROUND_Y, b.z0 + off], [b.x1 + off, GROUND_Y, b.z0 + off], [b.x1 + off, GROUND_Y, b.z1 + off], [b.x0 + off, GROUND_Y, b.z1 + off]], pal.shadow);
  }).join('');
  let grid = '';
  for (let t = Math.floor(sb.x0 - pad); t <= sb.x1 + pad; t += 1) grid += `M${pts([[t, GROUND_Y, sb.z0 - pad]])}L${pts([[t, GROUND_Y, sb.z1 + pad]])}`;
  for (let t = Math.floor(sb.z0 - pad); t <= sb.z1 + pad; t += 1) grid += `M${pts([[sb.x0 - pad, GROUND_Y, t]])}L${pts([[sb.x1 + pad, GROUND_Y, t]])}`;

  const shown = view.displayWidth || 720;
  const k = Math.min(shown / W, (view.maxHeight || 560) / H);   // on-screen px per SVG unit
  const fs = Math.max(12, Math.min(44, (shown < 500 ? 10.5 : 12.5) / k));
  const labelSvg = labels.map(l => {
    const size = l.small ? fs * 0.78 : fs;
    return `<g font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" text-anchor="middle" paint-order="stroke" stroke="${pal.halo}" stroke-width="${size * 0.32}" stroke-linejoin="round">
      <text x="${l.p[0].toFixed(1)}" y="${(l.p[1] - size * 0.2).toFixed(1)}" font-size="${size.toFixed(1)}" font-weight="600" fill="${pal.text}">${esc(l.name)}</text>
      <text x="${l.p[0].toFixed(1)}" y="${(l.p[1] + size * 0.95).toFixed(1)}" font-size="${(size * 0.82).toFixed(1)}" fill="${pal.sub}">${esc(f1(l.area))} m²</text></g>`;
  }).join('');

  const S = SCALE;
  const defs = `
    <defs>
      <linearGradient id="cd-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.bg0}"/><stop offset="1" stop-color="${pal.bg1}"/></linearGradient>
      <filter id="cd-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${(S * 0.28).toFixed(1)}"/></filter>
      ${['x', 'z'].map(ax => {
        const u = ax === 'x' ? [-C30 * S, S30 * S] : [C30 * S, S30 * S];
        const m = `matrix(${u[0].toFixed(3)} ${u[1].toFixed(3)} 0 ${(-S).toFixed(3)} 0 0)`;
        return `
      <pattern id="cd-corr-${ax}" patternUnits="userSpaceOnUse" width="0.16" height="4" patternTransform="${m}"><rect width="0.055" height="4" fill="rgba(0,0,0,0.16)"/><rect x="0.08" width="0.03" height="4" fill="rgba(255,255,255,0.10)"/></pattern>
      <pattern id="cd-slat-${ax}" patternUnits="userSpaceOnUse" width="0.12" height="4" patternTransform="${m}"><rect width="0.012" height="4" fill="rgba(0,0,0,0.35)"/><rect x="0.03" width="0.02" height="4" fill="rgba(255,255,255,0.08)"/></pattern>
      <pattern id="cd-panel-${ax}" patternUnits="userSpaceOnUse" width="1.22" height="1.2" patternTransform="${m}"><rect width="1.22" height="0.012" fill="rgba(0,0,0,0.28)"/><rect width="0.012" height="1.2" fill="rgba(0,0,0,0.28)"/></pattern>`;
      }).join('')}
      <pattern id="cd-roof-x" patternUnits="userSpaceOnUse" width="0.2" height="4" patternTransform="matrix(${(C30 * S).toFixed(3)} ${(S30 * S).toFixed(3)} ${(-C30 * S).toFixed(3)} ${(S30 * S).toFixed(3)} 0 0)"><rect width="0.07" height="4" fill="rgba(0,0,0,0.12)"/></pattern>
      <pattern id="cd-roof-z" patternUnits="userSpaceOnUse" width="0.2" height="4" patternTransform="matrix(${(-C30 * S).toFixed(3)} ${(S30 * S).toFixed(3)} ${(C30 * S).toFixed(3)} ${(S30 * S).toFixed(3)} 0 0)"><rect width="0.07" height="4" fill="rgba(0,0,0,0.12)"/></pattern>
    </defs>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX.toFixed(0)} ${minY.toFixed(0)} ${W.toFixed(0)} ${H.toFixed(0)}" width="${W.toFixed(0)}" height="${H.toFixed(0)}" role="img" aria-label="${esc(design.title)} — isometric view">
    ${defs}
    <rect x="${minX.toFixed(0)}" y="${minY.toFixed(0)}" width="${W.toFixed(0)}" height="${H.toFixed(0)}" fill="url(#cd-bg)"/>
    <polygon points="${pts(gpts)}" fill="${pal.ground}"/>
    <path d="${grid}" stroke="${pal.grid}" stroke-width="1" fill="none"/>
    <g filter="url(#cd-blur)">${shadowPolys}</g>
    ${body}
    ${labelSvg}
  </svg>`;
}

/* ---------- furniture and structure drawing ---------- */

function subBoxes(bx, back, parts) {
  // parts: [{a0,a1 (0..1 across), b0,b1 (0..1 from back), y0, y1 (m from bx.y0), color}]
  const alongX = Math.abs(back[1]) > 0.5;   // back points along Z → across runs along X
  const out = parts.map(p => {
    const [A0, A1] = alongX ? [bx.x0, bx.x1] : [bx.z0, bx.z1];
    const [B0, B1] = alongX ? [bx.z0, bx.z1] : [bx.x0, bx.x1];
    const dirBack = alongX ? back[1] : back[0];   // +1: the back is at the max side
    const a0 = A0 + (A1 - A0) * p.a0, a1 = A0 + (A1 - A0) * p.a1;
    const b0 = dirBack > 0 ? B1 - (B1 - B0) * p.b1 : B0 + (B1 - B0) * p.b0;
    const b1 = dirBack > 0 ? B1 - (B1 - B0) * p.b0 : B0 + (B1 - B0) * p.b1;
    const box = alongX ? { x0: a0, x1: a1, z0: b0, z1: b1 } : { x0: b0, x1: b1, z0: a0, z1: a1 };
    return { ...box, y0: bx.y0 + p.y0, y1: bx.y0 + p.y1, color: p.color, top: p.top, opacity: p.opacity };
  });
  out.sort((a, b) => (a.x0 + a.x1 + a.z0 + a.z1) / 2 + (a.y0 + a.y1) / 4 - ((b.x0 + b.x1 + b.z0 + b.z1) / 2 + (b.y0 + b.y1) / 4));
  return out.map(b => boxFaces(b, b.color, { top: b.top, sx: -0.22, sz: -0.09, stroke: 'rgba(0,0,0,0.18)', sw: 0.5, opacity: b.opacity ?? 1 })).join('');
}

function drawFurniture(it, f, bx, back, pal) {
  const H = bx.y1 - bx.y0;
  const wood = '#b08d5f', dark = '#4b5055', white = '#f1f2f2';
  switch (it.type) {
    case 'desk':
      return subBoxes(bx, back, [
        { a0: 0.03, a1: 0.07, b0: 0.05, b1: 0.95, y0: 0, y1: 0.71, color: '#6d6d6a' }, { a0: 0.93, a1: 0.97, b0: 0.05, b1: 0.95, y0: 0, y1: 0.71, color: '#6d6d6a' },
        { a0: 0, a1: 1, b0: 0, b1: 1, y0: 0.71, y1: 0.75, color: wood },
        { a0: 0.35, a1: 0.65, b0: 0.12, b1: 0.18, y0: 0.75, y1: 1.12, color: '#26292c', top: '#3a3e42' },
      ]);
    case 'reception':
      return subBoxes(bx, back, [{ a0: 0, a1: 1, b0: 0, b1: 1, y0: 0, y1: 0.75, color: '#d8d2c6' }, { a0: 0, a1: 1, b0: 0.62, b1: 1, y0: 0.75, y1: 1.05, color: wood }, { a0: 0.3, a1: 0.55, b0: 0.2, b1: 0.26, y0: 0.75, y1: 1.1, color: '#26292c' }]);
    case 'chair': case 'stool':
      return subBoxes(bx, back, it.type === 'stool'
        ? [{ a0: 0.42, a1: 0.58, b0: 0.42, b1: 0.58, y0: 0, y1: 0.68, color: '#6d6d6a' }, { a0: 0.1, a1: 0.9, b0: 0.1, b1: 0.9, y0: 0.68, y1: 0.75, color: dark }]
        : [{ a0: 0.42, a1: 0.58, b0: 0.42, b1: 0.58, y0: 0, y1: 0.42, color: '#6d6d6a' }, { a0: 0.08, a1: 0.92, b0: 0.12, b1: 0.9, y0: 0.42, y1: 0.5, color: dark }, { a0: 0.1, a1: 0.9, b0: 0, b1: 0.14, y0: 0.5, y1: 0.9, color: dark }]);
    case 'table': case 'bistro':
      return subBoxes(bx, back, [
        ...(it.type === 'bistro' ? [{ a0: 0.44, a1: 0.56, b0: 0.44, b1: 0.56, y0: 0, y1: 0.71, color: '#555' }] :
          [[0.04, 0.08, 0.06, 0.12], [0.92, 0.96, 0.06, 0.12], [0.04, 0.08, 0.88, 0.94], [0.92, 0.96, 0.88, 0.94]].map(([a0, a1, b0, b1]) => ({ a0, a1, b0, b1, y0: 0, y1: 0.71, color: '#6d6d6a' }))),
        { a0: 0, a1: 1, b0: 0, b1: 1, y0: 0.71, y1: 0.75, color: wood },
      ]);
    case 'bed':
      return subBoxes(bx, back, [{ a0: 0, a1: 1, b0: 0, b1: 1, y0: 0, y1: 0.35, color: '#7b6a55' }, { a0: 0.03, a1: 0.97, b0: 0.02, b1: 0.98, y0: 0.35, y1: 0.52, color: '#eceae4' }, { a0: 0.1, a1: 0.9, b0: 0.04, b1: 0.2, y0: 0.52, y1: 0.6, color: white }, { a0: 0.02, a1: 0.98, b0: 0.45, b1: 0.99, y0: 0.52, y1: 0.55, color: '#6f8aa3' }, { a0: 0, a1: 1, b0: 0, b1: 0.04, y0: 0.35, y1: 0.9, color: '#7b6a55' }]);
    case 'bunk':
      return subBoxes(bx, back, [
        ...[[0, 0.04, 0, 0.06], [0.96, 1, 0, 0.06], [0, 0.04, 0.94, 1], [0.96, 1, 0.94, 1]].map(([a0, a1, b0, b1]) => ({ a0, a1, b0, b1, y0: 0, y1: 1.7, color: '#5d5f61' })),
        { a0: 0.02, a1: 0.98, b0: 0.04, b1: 0.96, y0: 0.2, y1: 0.42, color: '#eceae4' }, { a0: 0.02, a1: 0.98, b0: 0.04, b1: 0.96, y0: 1.2, y1: 1.4, color: '#e2ded5' },
      ]);
    case 'sofa':
      return subBoxes(bx, back, [{ a0: 0.08, a1: 0.92, b0: 0.25, b1: 1, y0: 0, y1: 0.42, color: '#77706a' }, { a0: 0, a1: 1, b0: 0, b1: 0.25, y0: 0, y1: 0.8, color: '#6b645e' }, { a0: 0, a1: 0.08, b0: 0.25, b1: 1, y0: 0, y1: 0.6, color: '#6b645e' }, { a0: 0.92, a1: 1, b0: 0.25, b1: 1, y0: 0, y1: 0.6, color: '#6b645e' }]);
    case 'toilet':
      return subBoxes(bx, back, [{ a0: 0.28, a1: 0.72, b0: 0, b1: 0.16, y0: 0.35, y1: 0.8, color: white }, { a0: 0.32, a1: 0.68, b0: 0.12, b1: 0.55, y0: 0, y1: 0.42, color: white, top: '#dfe4e6' }]);
    case 'basin':
      return subBoxes(bx, back, [{ a0: 0.38, a1: 0.62, b0: 0.1, b1: 0.4, y0: 0, y1: 0.68, color: white }, { a0: 0, a1: 1, b0: 0, b1: 1, y0: 0.68, y1: 0.85, color: white, top: '#cfd8dc' }]);
    case 'shower':
      return subBoxes(bx, back, [{ a0: 0, a1: 1, b0: 0, b1: 1, y0: 0, y1: 0.06, color: white }, { a0: 0, a1: 1, b0: 0, b1: 1, y0: 0.06, y1: 2.0, color: '#b9d2de', opacity: 0.35, top: 'rgba(0,0,0,0)' }]);
    case 'kitchen': case 'counter':
      return subBoxes(bx, back, [{ a0: 0, a1: 1, b0: 0.04, b1: 1, y0: 0, y1: H - 0.04, color: it.type === 'counter' ? '#8e7355' : '#d9d4ca' }, { a0: 0, a1: 1, b0: 0, b1: 1, y0: H - 0.04, y1: H, color: '#3b3f43', top: '#4a4f54' }]);
    case 'rack':
      return subBoxes(bx, back, [
        ...[[0, 0.03], [0.97, 1]].map(([a0, a1]) => ({ a0, a1, b0: 0, b1: 1, y0: 0, y1: 2.0, color: '#6c7176' })),
        ...[0.1, 0.6, 1.1, 1.6].map(y => ({ a0: 0.03, a1: 0.97, b0: 0, b1: 1, y0: y, y1: y + 0.04, color: '#8b9095' })),
        { a0: 0.1, a1: 0.45, b0: 0.15, b1: 0.85, y0: 0.64, y1: 0.95, color: '#b79a6a' }, { a0: 0.55, a1: 0.9, b0: 0.2, b1: 0.8, y0: 1.14, y1: 1.4, color: '#a4b0b8' },
      ]);
    case 'cabinet': case 'fridge':
      return subBoxes(bx, back, [
        { a0: 0, a1: 1, b0: 0, b1: 0.97, y0: 0, y1: H, color: f.color },
        ...(it.type === 'fridge'
          ? [{ a0: 0.02, a1: 0.98, b0: 0.97, b1: 1, y0: 0.05, y1: H * 0.62, color: shade(f.color, -0.04) }, { a0: 0.02, a1: 0.98, b0: 0.97, b1: 1, y0: H * 0.64, y1: H - 0.04, color: shade(f.color, -0.04) }]
          : [{ a0: 0.02, a1: 0.49, b0: 0.97, b1: 1, y0: 0.06, y1: H - 0.04, color: shade(f.color, 0.06) }, { a0: 0.51, a1: 0.98, b0: 0.97, b1: 1, y0: 0.06, y1: H - 0.04, color: shade(f.color, 0.06) }]),
      ]);
    case 'ac':
      return subBoxes(bx, back, [{ a0: 0, a1: 1, b0: 0, b1: 1, y0: 0, y1: H, color: '#f4f4f2' }]);
    default:
      return boxFaces(bx, f.color || '#999', { stroke: 'rgba(0,0,0,0.2)', sw: 0.5 });
  }
}

function drawFlight(b, asc, fromY, toY, risers, pal) {
  const steel = '#3d4145', tread = '#8e969c';
  const alongX = Math.abs(asc[0]) > 0.5;
  const dir = alongX ? asc[0] : asc[1];
  const [A0, A1] = alongX ? [b.x0, b.x1] : [b.z0, b.z1];
  const [W0, W1] = alongX ? [b.z0, b.z1] : [b.x0, b.x1];
  const n = risers - 1;
  const go = (A1 - A0) / n;
  const rise = (toY - fromY) / risers;
  const at = (a, y, w) => (alongX ? [a, y, w] : [w, y, a]);
  const treads = [];
  for (let k = 0; k < n; k++) {
    const a0 = dir > 0 ? A0 + k * go : A1 - (k + 1) * go;
    const y = fromY + (k + 1) * rise;
    const box = alongX ? { x0: a0, x1: a0 + go, z0: W0 + 0.05, z1: W1 - 0.05 } : { x0: W0 + 0.05, x1: W1 - 0.05, z0: a0, z1: a0 + go };
    treads.push({ ...box, y0: y - 0.04, y1: y });
  }
  treads.sort((p, q) => (p.x0 + p.z0 + p.y0) - (q.x0 + q.z0 + q.y0));
  const aLow = dir > 0 ? A0 : A1, aHigh = dir > 0 ? A1 : A0;
  const stringer = (w) => poly([at(aLow, fromY, w), at(aHigh, toY, w), at(aHigh, toY - 0.22, w), at(aLow, fromY - 0.22 < GROUND_Y ? GROUND_Y : fromY - 0.22, w)], steel);
  const farW = W0, nearW = W1;
  const rail = (w) => `<path d="M${pts([at(aLow, fromY + 0.95, w)])}L${pts([at(aHigh, toY + 0.95, w)])}" stroke="${steel}" stroke-width="2" fill="none" stroke-linecap="round"/>` +
    [0, 0.33, 0.66, 1].map(t => `<path d="M${pts([at(aLow + (aHigh - aLow) * t, fromY + (toY - fromY) * t, w)])}L${pts([at(aLow + (aHigh - aLow) * t, fromY + (toY - fromY) * t + 0.95, w)])}" stroke="${steel}" stroke-width="1.2"/>`).join('');
  return rail(farW) + stringer(farW + 0.02) + treads.map(t => boxFaces(t, tread, { sx: -0.3, sz: -0.15 })).join('') + stringer(nearW - 0.02) + rail(nearW);
}

function drawLanding(b, y, pal, asc) {
  const steel = '#3d4145';
  const plat = { ...b, y0: y - 0.1, y1: y };
  let s = '';
  for (const [px, pz] of [[b.x0 + 0.05, b.z1 - 0.05], [b.x1 - 0.05, b.z1 - 0.05], [b.x1 - 0.05, b.z0 + 0.05]]) {
    s += boxFaces({ x0: px - 0.04, x1: px + 0.04, z0: pz - 0.04, z1: pz + 0.04, y0: b.y0, y1: y - 0.1 }, steel);
  }
  s += boxFaces(plat, '#8e969c', { sx: -0.3, sz: -0.15 });
  // guard rail on the open sides
  const r = y + 1.0;
  const alongX = Math.abs(asc[0]) > 0.5;
  const edges = alongX
    ? [[[b.x0, r, b.z1], [b.x1, r, b.z1]], [[b.x1, r, b.z0], [b.x1, r, b.z1]]]
    : [[[b.x1, r, b.z0], [b.x1, r, b.z1]], [[b.x0, r, b.z1], [b.x1, r, b.z1]]];
  s += edges.map(([p, q]) => `<path d="M${pts([p])}L${pts([q])}" stroke="${steel}" stroke-width="2" stroke-linecap="round"/><path d="M${pts([[q[0], y, q[2]]])}L${pts([q])}" stroke="${steel}" stroke-width="1.2"/>`).join('');
  void pal;
  return s;
}

function deckLines(b, y, along) {
  const alongX = Math.abs(along[0]) > 0.5;
  let g = '';
  if (alongX) for (let t = b.z0 + 0.14; t < b.z1; t += 0.14) g += `M${pts([[b.x0, y, t]])}L${pts([[b.x1, y, t]])}`;
  else for (let t = b.x0 + 0.14; t < b.x1; t += 0.14) g += `M${pts([[t, y, b.z0]])}L${pts([[t, y, b.z1]])}`;
  return `<path d="${g}" stroke="rgba(0,0,0,0.18)" stroke-width="0.7" fill="none"/>`;
}

function drawDeck(b, out, pal) {
  const alongX = Math.abs(out[1]) > 0.5;   // boards run along the wall
  return boxFaces(b, '#8f6b48', { top: '#b08a63', sx: -0.28, sz: -0.14 }) + deckLines(b, b.y1, alongX ? [1, 0] : [0, 1]);
}

function drawCanopy(b, out, y, posts, pal) {
  // slopes down away from the wall
  const drop = 0.18;
  const hiX = out[0] < -0.5 ? b.x1 : out[0] > 0.5 ? b.x0 : null;
  const hiZ = out[1] < -0.5 ? b.z1 : out[1] > 0.5 ? b.z0 : null;
  const yAt = (x, z) => {
    if (hiX != null) return y - drop * Math.abs(x - hiX) / (b.x1 - b.x0);
    return y - drop * Math.abs(z - hiZ) / (b.z1 - b.z0);
  };
  let s = '';
  if (posts) {
    const far = [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]].filter(([x, z]) => (hiX != null ? Math.abs(x - hiX) > 0.2 : Math.abs(z - hiZ) > 0.2));
    for (const [x, z] of far) s += boxFaces({ x0: x - 0.05, x1: x + 0.05, z0: z - 0.05, z1: z + 0.05, y0: GROUND_Y, y1: yAt(x, z) }, '#3d4145');
  }
  const c = [[b.x0, b.z0], [b.x1, b.z0], [b.x1, b.z1], [b.x0, b.z1]].map(([x, z]) => [x, yAt(x, z), z]);
  const under = c.map(([x, yy, z]) => [x, yy - 0.05, z]);
  s += poly(under, 'rgba(47,51,54,0.55)');
  s += poly(c, 'rgba(214,226,232,0.42)', 'stroke="#3d4145" stroke-width="1.2"');
  // rafters
  let g = '';
  const alongX = hiX == null;
  if (alongX) for (let x = b.x0 + 0.6; x < b.x1 - 0.1; x += 0.6) g += `M${pts([[x, yAt(x, b.z0), b.z0]])}L${pts([[x, yAt(x, b.z1), b.z1]])}`;
  else for (let z = b.z0 + 0.6; z < b.z1 - 0.1; z += 0.6) g += `M${pts([[b.x0, yAt(b.x0, z), z]])}L${pts([[b.x1, yAt(b.x1, z), z]])}`;
  s += `<path d="${g}" stroke="#3d4145" stroke-width="1" stroke-opacity="0.7" fill="none"/>`;
  void pal;
  return s;
}

function drawRailing(b, pal) {
  const steel = '#3d4145';
  const top = [[b.x0, b.y1, b.z0], [b.x1, b.y1, b.z0], [b.x1, b.y1, b.z1], [b.x0, b.y1, b.z1]];
  return boxFaces(b, '#b9d2de', { opacity: 0.32, sx: -0.1, sz: 0 }) + poly(top, steel);
  void pal;
}

function drawPitched(b, ridgeAlongX, color, pal) {
  const sheet = shade(color, -0.1);
  const y0 = b.y0, y1 = b.y1;
  if (ridgeAlongX) {
    const zc = (b.z0 + b.z1) / 2;
    const gable = [[b.x1, y0, b.z0], [b.x1, y0, b.z1], [b.x1, y1, zc]];
    return poly([[b.x0, y0, b.z0], [b.x1, y0, b.z0], [b.x1, y1, zc], [b.x0, y1, zc]], shade(sheet, 0.12)) +
      poly(gable, shade(color, -0.35)) +
      poly([[b.x0, y1, zc], [b.x1, y1, zc], [b.x1, y0, b.z1], [b.x0, y0, b.z1]], shade(sheet, -0.05)) + roofRibs(b, true, zc, y0, y1);
  }
  const xc = (b.x0 + b.x1) / 2;
  return poly([[b.x0, y0, b.z0], [b.x0, y0, b.z1], [xc, y1, b.z1], [xc, y1, b.z0]], shade(sheet, 0.12)) +
    poly([[b.x0, y0, b.z1], [b.x1, y0, b.z1], [xc, y1, b.z1]], shade(color, -0.35)) +
    poly([[xc, y1, b.z0], [xc, y1, b.z1], [b.x1, y0, b.z1], [b.x1, y0, b.z0]], shade(sheet, -0.18)) + roofRibs(b, false, xc, y0, y1);
  void pal;
}
function roofRibs(b, alongX, mid, y0, y1) {
  let g = '';
  if (alongX) for (let x = b.x0 + 0.25; x < b.x1; x += 0.25) g += `M${pts([[x, y0, b.z0]])}L${pts([[x, y1, mid]])}L${pts([[x, y0, b.z1]])}`;
  else for (let z = b.z0 + 0.25; z < b.z1; z += 0.25) g += `M${pts([[b.x0, y0, z]])}L${pts([[mid, y1, z]])}L${pts([[b.x1, y0, z]])}`;
  return `<path d="${g}" stroke="rgba(0,0,0,0.13)" stroke-width="0.8" fill="none"/>`;
}

/* ============================================================
   Floor plan
   ============================================================ */

const PS = 50;   // px per metre

export function fmtLen(m, unit) {
  if (unit === 'm') return `${m.toFixed(2)} m`;
  const inches = Math.round(m / M_PER_FT * 12);
  const ft = Math.floor(inches / 12), inch = inches - ft * 12;
  return inch ? `${ft}′ ${inch}″` : `${ft}′`;
}
const fmtArea = (a, unit) => (unit === 'm' ? `${f1(a)} m²` : `${Math.round(a * 10.7639)} sq ft`);

export function planSvg(design, level, unit, pal, displayWidth = 0) {
  const mods = design.modules.filter(m => m.level === level);
  const px = (x) => (x * PS).toFixed(1);
  const Pp = (x, z) => `${px(x)},${px(z)}`;
  const rects = [...mods.map(m => footprint(m, WALL)), ...design.stairs.filter(s => s.toLevel === level + 1 || s.toLevel === level).flatMap(s => [s.flight, s.landing]), ...(level === 0 ? [...design.decks.map(d => d.rect), ...design.canopies.map(c => c.rect)] : [])];
  const b = { x0: Math.min(...rects.map(r => r.x0)) - 1.35, x1: Math.max(...rects.map(r => r.x1)) + 1.35, z0: Math.min(...rects.map(r => r.z0)) - 1.35, z1: Math.max(...rects.map(r => r.z1)) + 1.6 };
  const W = (b.x1 - b.x0) * PS, H = (b.z1 - b.z0) * PS;
  const ts = displayWidth ? Math.max(1, Math.min(2.4, (W / displayWidth) * 0.95)) : 1;
  const T = (n) => (n * ts).toFixed(1);
  const font = `font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"`;
  let s = '';

  // decks & canopies (under everything)
  if (level === 0) {
    for (const d of design.decks) {
      const r = d.rect;
      let hatch = '';
      const alongX = Math.abs(d.out.z) > 0.5;
      if (alongX) for (let z = r.z0 + 0.15; z < r.z1; z += 0.15) hatch += `M${Pp(r.x0, z)}L${Pp(r.x1, z)}`;
      else for (let x = r.x0 + 0.15; x < r.x1; x += 0.15) hatch += `M${Pp(x, r.z0)}L${Pp(x, r.z1)}`;
      s += `<rect x="${px(r.x0)}" y="${px(r.z0)}" width="${px(r.x1 - r.x0)}" height="${px(r.z1 - r.z0)}" fill="none" stroke="${pal.ink2}" stroke-width="1"/><path d="${hatch}" stroke="${pal.ink2}" stroke-opacity="0.45" stroke-width="0.7"/>`;
      s += `<text x="${px((r.x0 + r.x1) / 2)}" y="${px((r.z0 + r.z1) / 2)}" dy="4" ${font} font-size="${T(11)}" text-anchor="middle" fill="${pal.ink2}" paint-order="stroke" stroke="${pal.plan}" stroke-width="4">Deck</text>`;
    }
    for (const c of design.canopies) {
      const r = c.rect;
      s += `<rect x="${px(r.x0)}" y="${px(r.z0)}" width="${px(r.x1 - r.x0)}" height="${px(r.z1 - r.z0)}" fill="none" stroke="${pal.ink2}" stroke-width="1" stroke-dasharray="6 4"/>`;
    }
  }

  for (const m of mods) {
    const outer = footprint(m, WALL), inner = footprint(m, 0);
    s += `<rect x="${px(outer.x0)}" y="${px(outer.z0)}" width="${px(outer.x1 - outer.x0)}" height="${px(outer.z1 - outer.z0)}" fill="${pal.ink}"/>`;
    s += `<rect x="${px(inner.x0)}" y="${px(inner.z0)}" width="${px(inner.x1 - inner.x0)}" height="${px(inner.z1 - inner.z0)}" fill="${pal.plan}"/>`;
    for (const rm of m.rooms) {
      const r = rectToSite(m, { x0: rm.x0, x1: rm.x1, z0: 0, z1: m.wid });
      const wet = ['toilet', 'bathroom'].includes(rm.kind);
      s += `<rect x="${px(r.x0)}" y="${px(r.z0)}" width="${px(r.x1 - r.x0)}" height="${px(r.z1 - r.z0)}" fill="${wet ? pal.wetFill : pal.roomFill}"/>`;
    }
    // partitions with door gaps and swings
    for (const p of m.items.filter(i => i.type === 'partition')) {
      const { dx, dz } = dims('partition', p.r, p);
      const segs = p.door && !(p.r % 2)
        ? [{ x0: p.x - dx / 2, x1: p.x + dx / 2, z0: 0, z1: p.door.z0 }, { x0: p.x - dx / 2, x1: p.x + dx / 2, z0: p.door.z1, z1: m.wid }]
        : [{ x0: p.x - dx / 2, x1: p.x + dx / 2, z0: p.z - dz / 2, z1: p.z + dz / 2 }];
      for (const sg of segs) {
        const r = rectToSite(m, sg);
        s += `<rect x="${px(r.x0)}" y="${px(r.z0)}" width="${px(r.x1 - r.x0)}" height="${px(r.z1 - r.z0)}" fill="${pal.ink2}"/>`;
      }
      if (p.door && !(p.r % 2)) {
        const w = p.door.z1 - p.door.z0;
        const hinge = toSite(m, p.x, p.door.z0), tip = toSite(m, p.x + p.door.swing * w, p.door.z0), end = toSite(m, p.x, p.door.z1);
        s += swing(hinge, tip, end, w, px, pal);
      }
    }
    // openings
    for (const o of m.items.filter(i => i.kind === 'opening')) {
      const spec = OPENINGS[o.type];
      const L = openingLocal(m, o);
      const inw = { front: [-1, 0], back: [1, 0], left: [0, 1], right: [0, -1] }[o.wall];
      const t = WALL + 0.004;
      const band = o.wall === 'front' ? { x0: m.len - 0.002, x1: m.len + t, z0: L.z0, z1: L.z1 } : o.wall === 'back' ? { x0: -t, x1: 0.002, z0: L.z0, z1: L.z1 }
        : o.wall === 'left' ? { x0: L.x0, x1: L.x1, z0: -t, z1: 0.002 } : { x0: L.x0, x1: L.x1, z0: m.wid - 0.002, z1: m.wid + t };
      const r = rectToSite(m, band);
      const along = Math.abs(r.x1 - r.x0) > Math.abs(r.z1 - r.z0);
      if (o.type === 'vent') { s += `<rect x="${px(r.x0)}" y="${px(r.z0)}" width="${px(r.x1 - r.x0)}" height="${px(r.z1 - r.z0)}" fill="${pal.plan}" stroke="${pal.ink}" stroke-width="0.8"/>`; continue; }
      s += `<rect x="${px(r.x0)}" y="${px(r.z0)}" width="${px(r.x1 - r.x0)}" height="${px(r.z1 - r.z0)}" fill="${pal.plan}"/>`;
      if (spec.glass && !spec.door) {
        const lines = o.type === 'glass-wall' ? [0.2, 0.5, 0.8] : [0.33, 0.67];
        s += lines.map(f => along
          ? `<line x1="${px(r.x0)}" x2="${px(r.x1)}" y1="${px(r.z0 + (r.z1 - r.z0) * f)}" y2="${px(r.z0 + (r.z1 - r.z0) * f)}" stroke="${pal.ink}" stroke-width="0.8"/>`
          : `<line y1="${px(r.z0)}" y2="${px(r.z1)}" x1="${px(r.x0 + (r.x1 - r.x0) * f)}" x2="${px(r.x0 + (r.x1 - r.x0) * f)}" stroke="${pal.ink}" stroke-width="0.8"/>`).join('');
        s += `<rect x="${px(r.x0)}" y="${px(r.z0)}" width="${px(r.x1 - r.x0)}" height="${px(r.z1 - r.z0)}" fill="none" stroke="${pal.ink}" stroke-width="0.8"/>`;
      } else if (spec.door) {
        const a = o.along - o.w / 2, c = o.along + o.w / 2;
        const pt = (along2, off) => {
          const q = o.wall === 'front' ? { x: m.len, z: along2 } : o.wall === 'back' ? { x: 0, z: m.wid - along2 } : o.wall === 'left' ? { x: along2, z: 0 } : { x: m.len - along2, z: m.wid };
          return toSite(m, q.x + inw[0] * off, q.z + inw[1] * off);
        };
        if (spec.roller) {
          const p0 = pt(a, 0.15), p1 = pt(c, 0.15);
          s += `<line x1="${px(p0.x)}" y1="${px(p0.z)}" x2="${px(p1.x)}" y2="${px(p1.z)}" stroke="${pal.ink}" stroke-width="1" stroke-dasharray="4 3"/>`;
        } else if (o.type === 'double-door') {
          const mid = (a + c) / 2, w = o.w / 2;
          s += swing(pt(a, 0), pt(a, w), pt(mid, 0), w, px, pal) + swing(pt(c, 0), pt(c, w), pt(mid, 0), w, px, pal);
        } else s += swing(pt(c, 0), pt(c, o.w), pt(a, 0), o.w, px, pal);
        if (spec.glass) s += `<rect x="${px(r.x0)}" y="${px(r.z0)}" width="${px(r.x1 - r.x0)}" height="${px(r.z1 - r.z0)}" fill="none" stroke="${pal.ink}" stroke-width="0.6"/>`;
      } else if (o.type === 'cutout') {
        const p0 = rectToSite(m, band);
        s += along ? `<line x1="${px(p0.x0)}" x2="${px(p0.x1)}" y1="${px((p0.z0 + p0.z1) / 2)}" y2="${px((p0.z0 + p0.z1) / 2)}" stroke="${pal.ink2}" stroke-width="0.8" stroke-dasharray="3 3"/>`
          : `<line y1="${px(p0.z0)}" y2="${px(p0.z1)}" x1="${px((p0.x0 + p0.x1) / 2)}" x2="${px((p0.x0 + p0.x1) / 2)}" stroke="${pal.ink2}" stroke-width="0.8" stroke-dasharray="3 3"/>`;
      }
    }
    // furniture
    for (const it of m.items.filter(i => i.kind === 'fitting' && i.type !== 'partition')) s += planFurniture(m, it, px, pal);
  }

  // stairs
  for (const st of design.stairs) {
    const onThis = st.toLevel === level + 1 || (level === design.levels.length - 1 && st.to === 'Roof deck' && st.toLevel === level + 1);
    const arriving = st.toLevel === level;
    if (!onThis && !arriving) continue;
    const r = st.flight, l = st.landing;
    const alongX = Math.abs(st.ascent.x) > 0.5;
    const dash = arriving ? 'stroke-dasharray="4 3"' : '';
    s += `<rect x="${px(r.x0)}" y="${px(r.z0)}" width="${px(r.x1 - r.x0)}" height="${px(r.z1 - r.z0)}" fill="${pal.plan}" stroke="${pal.ink}" stroke-width="1" ${dash}/>`;
    s += `<rect x="${px(l.x0)}" y="${px(l.z0)}" width="${px(l.x1 - l.x0)}" height="${px(l.z1 - l.z0)}" fill="${pal.plan}" stroke="${pal.ink}" stroke-width="1" ${dash}/>`;
    let tr = '';
    const n = st.risers - 1;
    for (let k = 1; k < n; k++) {
      if (alongX) { const x = r.x0 + (r.x1 - r.x0) * k / n; tr += `M${Pp(x, r.z0)}L${Pp(x, r.z1)}`; }
      else { const z = r.z0 + (r.z1 - r.z0) * k / n; tr += `M${Pp(r.x0, z)}L${Pp(r.x1, z)}`; }
    }
    s += `<path d="${tr}" stroke="${pal.ink}" stroke-width="0.6" ${dash}/>`;
    if (!arriving) {
      const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
      const a = alongX ? [r.x0 + 0.2, cz, r.x1 - 0.2, cz] : [cx, r.z0 + 0.2, cx, r.z1 - 0.2];
      const dirPos = (alongX ? st.ascent.x : st.ascent.z) > 0;
      const [x1, z1, x2, z2] = dirPos ? a : [a[2], a[3], a[0], a[1]];
      const ang = Math.atan2(z2 - z1, x2 - x1);
      const hx = x2 - Math.cos(ang) * 0.22, hz = z2 - Math.sin(ang) * 0.22;
      s += `<path d="M${Pp(x1, z1)}L${Pp(x2, z2)}" stroke="${pal.ink}" stroke-width="1.2"/><circle cx="${px(x1)}" cy="${px(z1)}" r="2.6" fill="${pal.ink}"/>`;
      s += `<path d="M${Pp(x2, z2)}L${Pp(hx - Math.sin(ang) * 0.1, hz + Math.cos(ang) * 0.1)}L${Pp(hx + Math.sin(ang) * 0.1, hz - Math.cos(ang) * 0.1)}Z" fill="${pal.ink}"/>`;
      s += `<text x="${px(x1 + (alongX ? (dirPos ? 0.35 : -0.35) : 0.28))}" y="${px(z1 + (alongX ? -0.28 : (dirPos ? 0.45 : -0.3)))}" ${font} font-size="${T(10)}" font-weight="600" fill="${pal.ink}" text-anchor="middle" paint-order="stroke" stroke="${pal.plan}" stroke-width="3">UP</text>`;
    }
  }

  // room labels
  for (const m of mods) {
    for (const rm of m.rooms) {
      const c = toSite(m, (rm.x0 + rm.x1) / 2, m.wid / 2);
      const narrow = (rm.x1 - rm.x0) < 1.5;
      const fsz = (narrow ? 10 : 12) * ts;
      s += `<g ${font} text-anchor="middle" paint-order="stroke" stroke="${pal.plan}" stroke-width="4" stroke-linejoin="round">
        <text x="${px(c.x)}" y="${px(c.z)}" dy="-2" font-size="${fsz}" font-weight="600" fill="${pal.ink}">${esc(narrow && rm.name.length > 9 ? rm.name.split(/\s|&/)[0] : rm.name)}</text>
        <text x="${px(c.x)}" y="${px(c.z)}" dy="${fsz + 1}" font-size="${fsz * 0.86}" fill="${pal.ink2}">${fmtArea(rm.area, unit)}</text></g>`;
    }
  }

  // dimensions
  const others = design.modules.filter(o => o.level === level);
  const clear = (r) => !others.some(o => { const f = footprint(o, WALL); return r.x0 < f.x1 && r.x1 > f.x0 && r.z0 < f.z1 && r.z1 > f.z0; });
  for (const m of mods) {
    const f = footprint(m, WALL);
    const lenAlongX = m.rot !== 90;
    // length: on whichever long side is clear
    const off = 0.75;
    const sides = lenAlongX ? [['z', f.z0 - off], ['z', f.z1 + off]] : [['x', f.x1 + off], ['x', f.x0 - off]];
    const lenSide = sides.find(([ax, v]) => clear(ax === 'z' ? { x0: f.x0, x1: f.x1, z0: Math.min(v, ax === 'z' && v < f.z0 ? v : f.z1), z1: Math.max(v, v < f.z0 ? f.z0 : v) } : { z0: f.z0, z1: f.z1, x0: Math.min(v, v < f.x0 ? v : f.x1), x1: Math.max(v, v < f.x0 ? f.x0 : v) }));
    if (lenSide) {
      const [ax, v] = lenSide;
      s += dimLine(ax === 'z' ? [f.x0, v, f.x1, v] : [v, f.z0, v, f.z1], fmtLen(m.len + 2 * WALL, unit), px, pal, font, ax === 'x' ? (v > f.x1 ? 1 : -1) : (v < f.z0 ? -1 : 1), false, ts);
      if (m.rooms.length > 1) {
        const v2 = ax === 'z' ? (v < f.z0 ? v + 0.38 : v - 0.38) : (v > f.x1 ? v - 0.38 : v + 0.38);
        for (const rm of m.rooms) {
          const a = toSite(m, rm.x0, 0), c = toSite(m, rm.x1, 0);
          const seg = ax === 'z' ? [Math.min(a.x, c.x), v2, Math.max(a.x, c.x), v2] : [v2, Math.min(a.z, c.z), v2, Math.max(a.z, c.z)];
          s += dimLine(seg, fmtLen(rm.x1 - rm.x0, unit), px, pal, font, 0, true, ts);
        }
      }
    }
    // width at the back end (or front, if that is clear)
    const wsides = lenAlongX ? [['x', f.x0 - off], ['x', f.x1 + off]] : [['z', f.z0 - off], ['z', f.z1 + off]];
    const wSide = wsides.find(([ax, v]) => clear(ax === 'x' ? { z0: f.z0, z1: f.z1, x0: Math.min(v, f.x0), x1: Math.max(v, f.x1) === f.x1 && v > f.x1 ? v : v < f.x0 ? f.x0 : v } : { x0: f.x0, x1: f.x1, z0: Math.min(v, f.z0), z1: v > f.z1 ? v : f.z0 }));
    if (wSide) {
      const [ax, v] = wSide;
      s += dimLine(ax === 'x' ? [v, f.z0, v, f.z1] : [f.x0, v, f.x1, v], fmtLen(m.wid + 2 * WALL, unit), px, pal, font, ax === 'x' ? (v < f.x0 ? -1 : 1) : (v < f.z0 ? -1 : 1), false, ts);
    }
  }

  // scale bar and title
  const barM = unit === 'm' ? 2 : 3 * M_PER_FT * 2;
  const bx = b.x0 + 0.35, bz = b.z1 - 0.3;
  s += `<g ${font} font-size="${T(10)}" fill="${pal.ink2}">
    <rect x="${px(bx)}" y="${px(bz)}" width="${px(barM / 2)}" height="4" fill="${pal.ink}"/><rect x="${px(bx + barM / 2)}" y="${px(bz)}" width="${px(barM / 2)}" height="4" fill="none" stroke="${pal.ink}" stroke-width="1"/>
    <text x="${px(bx)}" y="${px(bz) - 4}">0</text><text x="${px(bx + barM)}" y="${px(bz) - 4}" text-anchor="middle">${unit === 'm' ? '2 m' : '6 ft'}</text>
    <text x="${px(b.x1 - 0.35)}" y="${px(bz) + 4}" text-anchor="end" font-weight="600" fill="${pal.ink}">${esc(design.levels[level]?.name || 'Ground')} floor plan</text></g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${px(b.x0)} ${px(b.z0)} ${W.toFixed(0)} ${H.toFixed(0)}" width="${W.toFixed(0)}" height="${H.toFixed(0)}" role="img" aria-label="${esc(design.title)} — ${esc(design.levels[level]?.name || '')} floor plan">
    <rect x="${px(b.x0)}" y="${px(b.z0)}" width="${W.toFixed(0)}" height="${H.toFixed(0)}" fill="${pal.plan}"/>${s}</svg>`;
}

function swing(hinge, tip, end, w, px, pal) {
  const vx1 = tip.x - hinge.x, vz1 = tip.z - hinge.z, vx2 = end.x - hinge.x, vz2 = end.z - hinge.z;
  const sweep = vx1 * vz2 - vz1 * vx2 > 0 ? 1 : 0;
  const R = (w * PS).toFixed(1);
  return `<line x1="${px(hinge.x)}" y1="${px(hinge.z)}" x2="${px(tip.x)}" y2="${px(tip.z)}" stroke="${pal.ink}" stroke-width="1.3"/>` +
    `<path d="M${px(tip.x)},${px(tip.z)} A${R},${R} 0 0 ${sweep} ${px(end.x)},${px(end.z)}" fill="none" stroke="${pal.ink}" stroke-width="0.7" stroke-dasharray="3 2"/>`;
}

function dimLine([x1, z1, x2, z2], text, px, pal, font, side, small = false, ts = 1) {
  const horiz = Math.abs(z2 - z1) < 1e-6;
  const t = 0.1;
  const ticks = horiz
    ? `M${px(x1)},${px(z1 - t)}L${px(x1)},${px(z1 + t)}M${px(x2)},${px(z2 - t)}L${px(x2)},${px(z2 + t)}`
    : `M${px(x1 - t)},${px(z1)}L${px(x1 + t)},${px(z1)}M${px(x2 - t)},${px(z2)}L${px(x2 + t)},${px(z2)}`;
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  const fs = (small ? 9.5 : 11) * ts;
  const label = horiz
    ? `<text x="${px(cx)}" y="${px(cz)}" dy="${side < 0 ? -4 : side > 0 ? fs + 2 : 3.5}" ${font} font-size="${fs}" text-anchor="middle" fill="${pal.dim}" paint-order="stroke" stroke="${pal.plan}" stroke-width="${side ? 0 : 4}">${esc(text)}</text>`
    : `<text transform="translate(${px(cx)},${px(cz)}) rotate(-90)" dy="${side > 0 ? fs + 2 : side < 0 ? -4 : 3.5}" ${font} font-size="${fs}" text-anchor="middle" fill="${pal.dim}" paint-order="stroke" stroke="${pal.plan}" stroke-width="${side ? 0 : 4}">${esc(text)}</text>`;
  return `<path d="M${px(x1)},${px(z1)}L${px(x2)},${px(z2)}${ticks}" stroke="${pal.dim}" stroke-width="0.8" fill="none"/>${label}`;
}

function planFurniture(m, it, px, pal) {
  const f = FITTINGS[it.type];
  const { dx, dz } = dims(it.type, it.r, it);
  const [fx, fz] = FRONT[it.r];
  const ax = -fz, az = fx;   // across direction
  const w = Math.abs(fx) ? dz : dx, d = Math.abs(fx) ? dx : dz;
  // local item coords: u across (-w/2..w/2), v from back (0..d)
  const L = (u, v) => { const p = toSite(m, it.x + ax * u + fx * (v - d / 2), it.z + az * u + fz * (v - d / 2)); return `${px(p.x)},${px(p.z)}`; };
  const rect = (u0, u1, v0, v1, extra = '') => `<polygon points="${L(u0, v0)} ${L(u1, v0)} ${L(u1, v1)} ${L(u0, v1)}" ${extra}/>`;
  const line = (u0, v0, u1, v1) => `<path d="M${L(u0, v0)}L${L(u1, v1)}"/>`;
  const circ = (u, v, r) => { const p = toSite(m, it.x + ax * u + fx * (v - d / 2), it.z + az * u + fz * (v - d / 2)); return `<circle cx="${px(p.x)}" cy="${px(p.z)}" r="${(r * PS).toFixed(1)}"/>`; };
  const g = (inner, fill = 'none', dash = '') => `<g fill="${fill}" stroke="${pal.furn}" stroke-width="0.9" stroke-linejoin="round" ${dash}>${inner}</g>`;
  const W2 = w / 2;
  switch (it.type) {
    case 'desk': case 'reception': return g(rect(-W2, W2, 0, d) + (it.type === 'desk' ? rect(-0.22, 0.22, 0.06, 0.12) : line(-W2, d * 0.35, W2, d * 0.35)), pal.plan);
    case 'chair': return g(rect(-W2 + 0.05, W2 - 0.05, 0.08, d - 0.04, 'rx="3"') + line(-W2 + 0.05, 0.08, W2 - 0.05, 0.08), pal.plan);
    case 'stool': return g(circ(0, d / 2, 0.17), pal.plan);
    case 'bistro': return g(circ(0, d / 2, w / 2 - 0.02), pal.plan);
    case 'table': return g(rect(-W2, W2, 0, d), pal.plan);
    case 'bed': return g(rect(-W2, W2, 0, d) + rect(-W2 + 0.1, W2 - 0.1, 0.06, 0.32, 'rx="3"') + line(-W2, d * 0.42, W2, d * 0.42), pal.plan);
    case 'bunk': return g(rect(-W2, W2, 0, d) + line(-W2, 0, W2, d) + line(-W2, d, W2, 0), pal.plan);
    case 'sofa': return g(rect(-W2, W2, 0, d, 'rx="4"') + rect(-W2 + 0.14, W2 - 0.14, 0.2, d - 0.04), pal.plan);
    case 'toilet': return g(rect(-0.2, 0.2, 0, 0.16) + `<ellipse cx="0" cy="0" rx="0"/>` + circ(0, 0.4, 0.19), pal.plan);
    case 'basin': return g(rect(-W2, W2, 0, d, 'rx="3"') + circ(0, d * 0.55, 0.13), pal.plan);
    case 'shower': return g(rect(-W2, W2, 0, d) + line(-W2, 0, W2, d) + line(-W2, d, W2, 0) + circ(0, d / 2, 0.05), pal.plan);
    case 'kitchen': return g(rect(-W2, W2, 0, d) + rect(-W2 + 0.15, -W2 + 0.65, 0.1, d - 0.1, 'rx="3"') + circ(W2 - 0.5, d * 0.35, 0.09) + circ(W2 - 0.25, d * 0.35, 0.09) + circ(W2 - 0.5, d * 0.7, 0.09) + circ(W2 - 0.25, d * 0.7, 0.09), pal.plan);
    case 'counter': return g(rect(-W2, W2, 0, d) + line(-W2, d * 0.7, W2, d * 0.7), pal.plan);
    case 'rack': return g(rect(-W2, W2, 0, d) + line(-W2, 0, W2, d), pal.plan);
    case 'cabinet': case 'fridge': return g(rect(-W2, W2, 0, d) + line(0, 0, 0, d) + (it.type === 'fridge' ? line(-W2, 0, W2, d) : ''), pal.plan);
    case 'ac': return g(rect(-W2, W2, 0, d), 'none', 'stroke-dasharray="3 2"');
    default: return g(rect(-W2, W2, 0, d), pal.plan);
  }
  void f;
}

/* ============================================================
   Card
   ============================================================ */

const ICON = '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/><path d="M7.5 5.3v9.4M16.5 5.3v9.4" opacity=".55"/>';
const I = {
  rotL: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4"/>',
  rotR: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4h-4"/>',
  download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  warn: '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.3"/>',
  roof: '<path d="M3 11 12 4l9 7"/><path d="M5 10v9h14v-9"/>',
  explode: '<rect x="5" y="3" width="14" height="6" rx="1"/><rect x="5" y="15" width="14" height="6" rx="1"/><path d="M12 10.5v3"/>',
};
const svgI = (p, s = 15) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;

function slug(s) { return String(s || 'container-design').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'container-design'; }
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function svgToPng(markup, scale = 2) {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const root = doc.documentElement;
  const w = Number(root.getAttribute('width')) || 1200, h = Number(root.getAttribute('height')) || 800;
  const blob = new Blob([new XMLSerializer().serializeToString(root)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.max(1, Math.min(scale, 4096 / Math.max(w, h)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * k); canvas.height = Math.round(h * k);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise(res => canvas.toBlob(res, 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

/** Best first view: show the entrance, stairs and glazing. */
function bestAngle(design) {
  let best = 0, score = -1;
  for (let v = 0; v < 4; v++) {
    const X = viewXf(design, v);
    let s = 0;
    for (const m of design.modules) {
      for (const o of m.items.filter(i => i.kind === 'opening')) {
        const n = { front: [1, 0], back: [-1, 0], left: [0, -1], right: [0, 1] }[o.wall];
        const sn = m.rot === 90 ? [-n[1], n[0]] : n;
        const q = X.vec(sn[0], sn[1]);
        if (q[0] > 0.5 || q[1] > 0.5) s += OPENINGS[o.type].door ? 3 : o.type === 'glass-wall' ? 3 : 1;
      }
    }
    for (const st of design.stairs) {
      const c = X.rot((st.flight.x0 + st.flight.x1) / 2, (st.flight.z0 + st.flight.z1) / 2);
      const mc = X.rot((design.site.x0 + design.site.x1) / 2, (design.site.z0 + design.site.z1) / 2);
      if (c[0] + c[1] > mc[0] + mc[1]) s += 6;
    }
    if (s > score) { score = s; best = v; }
  }
  return best;
}

export function renderContainerDesign(data, container) {
  const design = data.design || data;
  const el = document.createElement('section');
  el.className = 'astc astc-cd';
  const multi = design.levels.length > 1;
  const view = { tab: '3d', angle: bestAngle(design), roof: false, level: 'all', explode: multi, unit: design.units || 'ft', planLevel: 0, module: design.modules[0].id };
  const q = design.quantities, cost = design.cost;
  const warn = design.warnings.filter(w => w.level === 'warn'), info = design.warnings.filter(w => w.level !== 'warn');
  const sub = `${design.modules.length > 1 ? `${design.modules.length} units` : esc(design.modules[0].sizeName)} · ${f1(q.floorArea)} m² · ${esc(nairaShort(cost.total))}${design.version > 1 ? ` · v${design.version}` : ''}`;
  el.innerHTML = `
    <header class="astc-head">
      <span class="astc-icon">${svgI(ICON, 16)}</span>
      <div class="astc-titles"><h4 class="astc-title">${esc(design.title)}</h4><p class="astc-sub">${sub}</p></div>
    </header>
    <div class="astc-cd-bar">
      <div class="astc-cd-tabs" role="tablist">
        <button type="button" role="tab" data-tab="3d" aria-selected="true">3D view</button>
        <button type="button" role="tab" data-tab="plan" aria-selected="false">Floor plan</button>
        <button type="button" role="tab" data-tab="spec" aria-selected="false">Spec &amp; cost</button>
      </div>
      <div class="astc-cd-units" role="group" aria-label="Units"><button type="button" data-unit="ft">ft</button><button type="button" data-unit="m">m</button></div>
    </div>
    <div class="astc-cd-stage">
      <div class="astc-cd-canvas" data-pane="3d"></div>
      <div class="astc-cd-canvas is-plan" data-pane="plan" hidden></div>
      <div class="astc-cd-sheet" data-pane="spec" hidden></div>
      <div class="astc-cd-ctrl" data-for="3d">
        <div class="astc-cd-grp">
          <button type="button" class="astc-cd-ib" data-act="rotl" aria-label="Rotate view left" title="Rotate left">${svgI(I.rotL)}</button>
          <button type="button" class="astc-cd-ib" data-act="rotr" aria-label="Rotate view right" title="Rotate right">${svgI(I.rotR)}</button>
        </div>
        <div class="astc-cd-grp">
          <button type="button" class="astc-cd-chip" data-act="roof" aria-pressed="false">${svgI(I.roof, 14)}<span>Roof</span></button>
          ${multi ? `<button type="button" class="astc-cd-chip" data-act="explode" aria-pressed="true">${svgI(I.explode, 14)}<span>Explode</span></button>` : ''}
        </div>
        ${multi ? `<div class="astc-cd-grp astc-cd-levels" role="group" aria-label="Level">
          <button type="button" class="astc-cd-chip" data-level="all" aria-pressed="true">All</button>
          ${design.levels.map(l => `<button type="button" class="astc-cd-chip" data-level="${l.level}" aria-pressed="false">${l.level ? `L${l.level}` : 'G'}</button>`).join('')}
        </div>` : ''}
      </div>
      ${multi ? `<div class="astc-cd-ctrl is-plan" data-for="plan" hidden><div class="astc-cd-grp" role="group" aria-label="Level">${design.levels.map(l => `<button type="button" class="astc-cd-chip" data-plan-level="${l.level}" aria-pressed="${l.level === 0}">${esc(l.name)}</button>`).join('')}</div></div>` : ''}
    </div>
    <dl class="astc-cd-stats">
      <div><dt>Floor area</dt><dd class="u-num" data-stat="area"></dd></div>
      <div><dt>Units</dt><dd class="u-num">${design.modules.length}${design.levels.length > 1 ? ` · ${design.levels.length} levels` : ''}</dd></div>
      <div><dt>Rooms</dt><dd class="u-num">${design.rooms.length}</dd></div>
      <div><dt>Doors · windows</dt><dd class="u-num">${Object.entries(q.openings).filter(([k]) => OPENINGS[k].door).reduce((a, [, v]) => a + v, 0)} · ${Object.entries(q.openings).filter(([k]) => OPENINGS[k].glass && !OPENINGS[k].door).reduce((a, [, v]) => a + v, 0)}</dd></div>
      <div><dt>Estimate</dt><dd class="u-num">${esc(nairaShort(cost.total))}</dd></div>
    </dl>
    ${warn.length || info.length ? `<details class="astc-cd-notes" ${warn.length ? 'open' : ''}>
      <summary>${warn.length ? `${warn.length} thing${warn.length > 1 ? 's' : ''} to check` : `${info.length} note${info.length > 1 ? 's' : ''}`}</summary>
      <ul>${warn.map(w => `<li data-level="warn">${svgI(I.warn, 14)}<span>${esc(w.text)}</span></li>`).join('')}${info.map(w => `<li data-level="info">${svgI(I.info, 14)}<span>${esc(w.text)}</span></li>`).join('')}</ul>
    </details>` : ''}
    <footer class="astc-cd-foot">
      <div class="astc-cd-acts">
        <button type="button" class="astc-btn" data-act="png">${svgI(I.download, 14)}<span>PNG</span></button>
        <button type="button" class="astc-btn" data-act="svg">${svgI(I.download, 14)}<span>Plan SVG</span></button>
        <span class="astc-cd-open">
          ${design.modules.length > 1 ? `<select class="astc-cd-select" data-act="module" aria-label="Unit to open">${design.modules.map(m => `<option value="${esc(m.id)}">${esc(m.label)}</option>`).join('')}</select>` : ''}
          <button type="button" class="astc-btn is-primary" data-act="planner">${svgI(I.external, 14)}<span>Open in Container Planner</span></button>
        </span>
      </div>
      <p class="astc-cd-hint">To change it, just ask — “add a window on the left”, “make it 40 ft”, “paint it blue”. Design <code>${esc(design.id)}</code>.</p>
    </footer>`;

  const pane3d = el.querySelector('[data-pane="3d"]');
  const panePlan = el.querySelector('[data-pane="plan"]');
  const paneSpec = el.querySelector('[data-pane="spec"]');
  let lastSvg = '';

  const paint = () => {
    const pal = palette(isDark());
    el.querySelectorAll('[data-unit]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.unit === view.unit)));
    el.querySelector('[data-stat="area"]').textContent = fmtArea(q.floorArea, view.unit);
    const shownW = el.querySelector('.astc-cd-stage').clientWidth || 720;
    view.displayWidth = shownW;
    if (view.tab === '3d') {
      lastSvg = isoSvg(design, view, pal);
      pane3d.innerHTML = lastSvg;
      pane3d.style.background = `linear-gradient(${pal.bg0}, ${pal.bg1})`;
    } else if (view.tab === 'plan') {
      lastSvg = planSvg(design, view.planLevel, view.unit, pal, shownW);
      panePlan.innerHTML = lastSvg;
    } else paneSpec.innerHTML = specHtml(design, view.unit);
    for (const [k, p] of [['3d', pane3d], ['plan', panePlan], ['spec', paneSpec]]) p.hidden = view.tab !== k;
    el.querySelectorAll('[data-for]').forEach(c => { c.hidden = c.dataset.for !== view.tab; });
    el.querySelectorAll('[role="tab"]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === view.tab)));
    el.querySelector('[data-act="roof"]')?.setAttribute('aria-pressed', String(view.roof));
    el.querySelector('[data-act="explode"]')?.setAttribute('aria-pressed', String(view.explode));
    el.querySelectorAll('[data-level]').forEach(b => b.setAttribute('aria-pressed', String(String(view.level) === b.dataset.level)));
    el.querySelectorAll('[data-plan-level]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.planLevel) === view.planLevel)));
    el.querySelector('[data-act="png"]').hidden = view.tab === 'spec';
  };

  el.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t || !el.contains(t)) return;
    if (t.dataset.tab) { view.tab = t.dataset.tab; paint(); return; }
    if (t.dataset.unit) { view.unit = t.dataset.unit; paint(); return; }
    if (t.dataset.level) { view.level = t.dataset.level === 'all' ? 'all' : Number(t.dataset.level); if (view.level !== 'all') view.planLevel = view.level; paint(); return; }
    if (t.dataset.planLevel) { view.planLevel = Number(t.dataset.planLevel); paint(); return; }
    switch (t.dataset.act) {
      case 'rotl': view.angle = (view.angle + 3) % 4; paint(); break;
      case 'rotr': view.angle = (view.angle + 1) % 4; paint(); break;
      case 'roof': view.roof = !view.roof; paint(); break;
      case 'explode': view.explode = !view.explode; paint(); break;
      case 'png': {
        const name = `${slug(design.title)}-${view.tab === 'plan' ? 'plan' : 'view'}.png`;
        try { const png = await svgToPng(view.tab === 'plan' ? planSvg(design, view.planLevel, view.unit, palette(false)) : isoSvg(design, { ...view, displayWidth: 1100, maxHeight: 1e9 }, palette(isDark())), 2); if (png) downloadBlob(png, name); } catch { /* ignore */ }
        break;
      }
      case 'svg': downloadBlob(new Blob([planSvg(design, view.planLevel, view.unit, palette(false))], { type: 'image/svg+xml' }), `${slug(design.title)}-plan-${view.planLevel ? `level-${view.planLevel}` : 'ground'}.svg`); break;
      case 'planner': {
        const sel = el.querySelector('[data-act="module"]');
        const handoff = plannerHandoff(design, sel ? sel.value : design.modules[0].id);
        try { localStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff)); } catch { /* storage unavailable */ }
        window.location.hash = '#container-planner';
        break;
      }
      default:
    }
  });

  // repaint when the theme flips
  const mo = new MutationObserver(() => { if (el.isConnected) paint(); else mo.disconnect(); });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  container.appendChild(el);
  paint();
  void lastSvg;
  return el;
}

function specHtml(d, unit) {
  const c = d.cost;
  const rows = d.modules.map(m => {
    const mc = c.modules.find(x => x.id === m.id);
    const ops = m.items.filter(i => i.kind === 'opening');
    return `<tr><th scope="row"><span class="astc-cd-sw" style="background:${m.colorHex}"></span>${esc(m.label)}<small>${esc(m.sizeName)} · ${esc(COLORS[m.color]?.name || m.color)}</small></th>
      <td class="u-num">${fmtArea(m.len * m.wid, unit)}</td><td class="u-num">${ops.length}</td><td class="u-num">${naira(mc?.total)}</td></tr>`;
  }).join('');
  const works = c.structure.lines.map(l => `<tr><th scope="row">${esc(l.name)}</th><td class="u-num">${f1(l.qty)} ${l.unit === 'area' ? 'm²' : l.unit === 'length' ? 'm' : 'no.'}</td><td></td><td class="u-num">${naira(l.total)}</td></tr>`).join('');
  const openings = Object.entries(d.quantities.openings).map(([k, v]) => `${v} × ${OPENINGS[k].name.toLowerCase()}`).join(', ');
  const fittings = Object.entries(d.quantities.fittings).map(([k, v]) => `${v} × ${FITTINGS[k].name.toLowerCase()}`).join(', ');
  return `
    <div class="astc-table-wrap"><table class="astc-table astc-cd-table">
      <thead><tr><th>Unit</th><th>Floor</th><th>Openings</th><th>Estimate</th></tr></thead>
      <tbody>${rows}${works ? `<tr class="astc-cd-sub"><th colspan="4">Structure works</th></tr>${works}` : ''}</tbody>
      <tfoot>
        <tr><th scope="row">Prime cost</th><td></td><td></td><td class="u-num">${naira(c.prime)}</td></tr>
        <tr><th scope="row">Overheads, contingency &amp; profit</th><td></td><td></td><td class="u-num">${naira(c.total - c.prime - c.vat)}</td></tr>
        <tr><th scope="row">VAT (7.5%)</th><td></td><td></td><td class="u-num">${naira(c.vat)}</td></tr>
        <tr class="is-total"><th scope="row">Estimated total</th><td></td><td></td><td class="u-num">${naira(c.total)}</td></tr>
      </tfoot>
    </table></div>
    <p class="astc-cd-fine">${esc(c.tier[0].toUpperCase() + c.tier.slice(1))} finish spec · ${naira(c.perM2)} per m² of floor${c.budget ? ` · budget ${naira(c.budget)} (${c.withinBudget ? 'within' : 'over'})` : ''}. Includes overheads, contingency and profit. Rates come from the Container Planner’s rate book, which you can edit.</p>
    <div class="astc-cd-cols">
      <section><h5>Rooms</h5><ul class="astc-cd-rooms">${d.modules.map(m => m.rooms.map(r => `<li><span>${esc(r.name)}<small>${esc(m.label)}</small></span><b class="u-num">${fmtArea(r.area, unit)}</b></li>`).join('')).join('')}</ul></section>
      <section><h5>Bill of main quantities</h5><dl class="astc-cd-boq">
        <div><dt>Internal floor</dt><dd>${fmtArea(d.quantities.floorArea, unit)}</dd></div>
        <div><dt>Ground footprint</dt><dd>${fmtArea(d.quantities.footprintArea, unit)}</dd></div>
        <div><dt>Wall area (net)</dt><dd>${fmtArea(d.quantities.netWallArea, unit)}</dd></div>
        <div><dt>Openings</dt><dd>${esc(openings || '—')}</dd></div>
        <div><dt>Partitions</dt><dd>${fmtLen(d.quantities.partitionLength, unit)}</dd></div>
        <div><dt>Furniture &amp; fittings</dt><dd>${esc(fittings || '—')}</dd></div>
        ${d.quantities.stairFlights ? `<div><dt>Stairs</dt><dd>${d.quantities.stairFlights} flight${d.quantities.stairFlights > 1 ? 's' : ''}</dd></div>` : ''}
        ${d.quantities.deckArea ? `<div><dt>Deck</dt><dd>${fmtArea(d.quantities.deckArea, unit)}</dd></div>` : ''}
        ${d.quantities.roofDeckArea ? `<div><dt>Roof deck</dt><dd>${fmtArea(d.quantities.roofDeckArea, unit)}</dd></div>` : ''}
      </dl></section>
    </div>`;
}
