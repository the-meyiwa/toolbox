/* ============================================================
   Container Builder — 3D models for the parts library

   partModel(item, ctx) returns a THREE.Group for any part in
   container-library.js that is not a wall opening (openings are
   cut by container-mesh.js). Local frames:

     fitting  back to −Z, centred on the origin, standing on y = 0
              (the same frame as container-mesh fittingModel)
     facade   x across the width (centred), y up from the sill,
              z outward from the wall face
     roof     centred, y = 0 on the roof, w along X, d along Z
     site     centred, y = 0 on the ground, w along X, d along Z;
              stairs and ramps climb towards +Z

   ctx: { unit: { len, wid, hgt, color } } for unit parts.
   ============================================================ */

import * as THREE from 'three';
import { material } from './render-materials.js';
import { fittingModel, box, boxMM, cyl, mesh, at } from './container-mesh.js';
import { PART } from './container-library.js';

const steelDark = () => material('paint', 0x2a2c2f, { grime: 0.05 });
const glassM = () => material('glass');

function finish(g) {
  g.traverse(o => { if (o.isMesh && !o.material?.transparent) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/** A glass balustrade from (x0,z0) to (x1,z1) at height y, 1.1 m high. */
function glassRun(g, x0, z0, x1, z1, y, h = 1.1) {
  const L = Math.hypot(x1 - x0, z1 - z0);
  if (L < 0.05) return;
  const run = new THREE.Group();
  run.add(box(L, 0.08, 0.06, material('aluminium', 0x2f3134), 0, 0.04, 0));
  const pane = box(L, h - 0.08, 0.016, glassM(), 0, 0.04 + (h - 0.08) / 2, 0, { cast: false });
  pane.renderOrder = 2;
  run.add(pane);
  run.add(box(L, 0.03, 0.05, material('steel', 0x9aa0a4), 0, h, 0));
  run.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  run.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  g.add(run);
}

/** A straight flight of `n` treads rising `rise` over `run` towards +Z, width w, centred on x = 0, starting at z0. */
function flight(g, w, run, rise, z0, y0 = 0, { treadM = material('floor-timber', 0x8a6b4a), rail = true } = {}) {
  const n = Math.max(2, Math.round(rise / 0.18));
  const going = run / n, r = rise / n;
  const st = steelDark();
  const L = Math.hypot(run, rise), ang = Math.atan2(rise, run);
  for (const sx of [-1, 1]) {
    const s = box(0.012, 0.2, L, st, sx * (w / 2 - 0.006), y0 + rise / 2, z0 + run / 2);
    s.rotation.x = -ang;
    g.add(s);
    if (rail) {
      const hr = cyl(0.02, L, material('steel', 0x2f3134), sx * (w / 2 - 0.006), y0 + rise / 2 + 0.95, z0 + run / 2, 'z', 8);
      hr.rotation.x = Math.PI / 2 - ang;
      g.add(hr);
      for (const f of [0.1, 0.5, 0.9]) g.add(box(0.025, 0.95, 0.025, st, sx * (w / 2 - 0.006), y0 + rise * f + 0.475, z0 + run * f));
    }
  }
  for (let i = 0; i < n; i++) g.add(box(w - 0.03, 0.035, going + 0.02, treadM, 0, y0 + (i + 1) * r - 0.018, z0 + (i + 0.5) * going));
}

/* ---------------- fittings (inside) ---------------- */

function fittingPart(type, it, p, ctx) {
  const w = it.w ?? p.w, d = it.d ?? p.d, h = it.h ?? p.h;
  const g = new THREE.Group();
  const color = p.color;
  switch (type) {
    case 'double-bed': return fittingModel('bed', w, d, h, color);
    case 'wardrobe': {
      const m = material('plastic', color);
      g.add(box(w, h, d, m, 0, h / 2, 0));
      g.add(box(0.006, h - 0.06, 0.004, material('plastic', 0x6d665c), 0, h / 2, d / 2 + 0.002));
      for (const sx of [-1, 1]) g.add(box(0.015, 0.3, 0.02, material('chrome'), sx * 0.05, h * 0.55, d / 2 + 0.012));
      return finish(g);
    }
    case 'armchair': return fittingModel('sofa', w, d, h, color);
    case 'tv-unit': {
      g.add(box(w, h, d, material('timber', color), 0, h / 2, 0));
      g.add(box(Math.min(1.4, w * 0.8), 0.8, 0.04, material('plastic', 0x111214), 0, h + 0.45, -d / 4));
      return finish(g);
    }
    case 'bookcase': {
      const wood = material('timber', color);
      g.add(box(w, h, 0.02, wood, 0, h / 2, -d / 2 + 0.01));
      for (const sx of [-1, 1]) g.add(box(0.02, h, d, wood, sx * (w / 2 - 0.01), h / 2, 0));
      const cols = [0x7a3b2e, 0x2e4a5e, 0xc2a36b, 0x4d5a3a, 0x8b8b86];
      for (let i = 0; i <= 5; i++) {
        const y = i * (h - 0.02) / 5;
        g.add(box(w, 0.02, d, wood, 0, y + 0.01, 0));
        if (i < 5) for (let b = 0, x = -w / 2 + 0.05; x < w / 2 - 0.12; b++) {
          const bw = 0.03 + ((b * 37) % 5) * 0.008, bh = 0.2 + ((b * 13) % 4) * 0.025;
          g.add(box(bw, bh, d * 0.75, material('plastic', cols[b % cols.length]), x + bw / 2, y + 0.02 + bh / 2, 0));
          x += bw + 0.004;
        }
      }
      return finish(g);
    }
    case 'window-seat':
      g.add(box(w, h - 0.08, d, material('timber', color), 0, (h - 0.08) / 2, 0));
      g.add(box(w - 0.04, 0.08, d - 0.04, material('fabric', 0x6e7a6a), 0, h - 0.04, 0));
      return finish(g);
    case 'stove': {
      const black = material('steel', 0x1d1e20);
      g.add(box(w, h * 0.75, d, black, 0, h * 0.375 + 0.1, 0));
      g.add(box(w * 0.6, h * 0.35, 0.01, glassM(), 0, h * 0.45, d / 2 + 0.005));
      g.add(box(w + 0.3, 0.012, d + 0.3, material('concrete', 0x57585a), 0, 0.006, 0.05));
      for (const sx of [-1, 1]) g.add(box(0.04, 0.1, 0.04, black, sx * (w / 2 - 0.05), 0.05, 0));
      const top = (ctx.unit?.hgt ?? 2.4) - 0.01;
      g.add(cyl(0.075, top - (h * 0.75 + 0.1), black, 0, (top + h * 0.75 + 0.1) / 2, -d * 0.15, 'y', 16));
      return finish(g);
    }
    case 'island':
      g.add(box(w - 0.1, h - 0.04, d - 0.1, material('plastic', color), 0, (h - 0.04) / 2, 0));
      g.add(box(w + 0.1, 0.04, d + 0.1, material('marble', 0xe8e6e1), 0, h - 0.02, 0));
      return finish(g);
    case 'bath': {
      const white = material('plastic', 0xf2f2ef);
      g.add(box(w, h, d, white, 0, h / 2, 0));
      g.add(box(w - 0.12, 0.02, d - 0.12, material('water', 0x9fc3cf), 0, h - 0.06, 0));
      return finish(g);
    }
    case 'vanity': {
      g.add(box(w, h - 0.12, d, material('timber', color), 0, (h - 0.12) / 2 + 0.1, 0));
      g.add(box(w, 0.04, d, material('marble', 0xefefec), 0, h - 0.02, 0));
      g.add(box(w * 0.55, 0.12, d * 0.6, material('plastic', 0xf5f5f3), 0, h + 0.06, 0.02));
      g.add(box(w * 0.8, 0.7, 0.02, material('chrome', 0xe2e6ea), 0, h + 0.55, -d / 2 + 0.01));
      return finish(g);
    }
    case 'laundry': {
      const white = material('plastic', 0xefefed);
      for (const y of [0, h / 2]) {
        g.add(box(w, h / 2 - 0.01, d, white, 0, y + h / 4, 0));
        const door = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 24), material('chrome', 0x9ba3a8));
        door.rotation.x = Math.PI / 2;
        g.add(at(door, 0, y + h / 4 - 0.03, d / 2 + 0.01));
      }
      return finish(g);
    }
    case 'water-heater': {
      const c = cyl(Math.min(w, h) / 2, w, material('plastic', 0xf1f1ef), 0, h / 2, 0, 'x', 24);
      g.add(c);
      return finish(g);
    }
    case 'wall-bed':
      g.add(box(w, h, d, material('timber', color), 0, h / 2, 0));
      g.add(box(w - 0.08, h - 0.2, 0.01, material('timber', 0xcbb99a), 0, h / 2, d / 2 + 0.005));
      g.add(box(0.3, 0.02, 0.02, material('chrome'), 0, h * 0.45, d / 2 + 0.02));
      return finish(g);
    case 'glass-partition': {
      const H = Math.min(h, (ctx.unit?.hgt ?? 2.4));
      const D = Math.min(d, (ctx.unit?.wid ?? 2.35) - 0.08);
      const f = material('steel', 0x1f2023);
      g.add(box(w, 0.04, D, f, 0, 0.02, 0), box(w, 0.04, D, f, 0, H - 0.02, 0));
      for (let z = -D / 2; z <= D / 2 + 1e-6; z += D / Math.max(1, Math.round(D / 0.8))) g.add(box(w, H, 0.03, f, 0, H / 2, Math.max(-D / 2 + 0.015, Math.min(D / 2 - 0.015, z))));
      const pane = box(0.012, H - 0.08, D, glassM(), 0, H / 2, 0, { cast: false }); pane.renderOrder = 2; g.add(pane);
      return finish(g);
    }
    case 'mezzanine': {
      // w along the unit, d across it (wall to wall); open edge on +X.
      const deck = it.deck ?? p.deck;
      const D = Math.min(d, (ctx.unit?.wid ?? 2.35) - 0.08);
      const st = steelDark();
      g.add(box(w, 0.018, D, material('floor-timber', 0xa07a52), 0, deck - 0.009, 0));
      g.add(box(0.1, 0.15, D, st, w / 2 - 0.05, deck - 0.093, 0));                         // open-edge PFC
      for (const sz of [-1, 1]) g.add(box(w, 0.15, 0.05, st, 0, deck - 0.093, sz * (D / 2 - 0.025)));   // side PFCs on the side walls
      for (let x = -w / 2 + 0.4; x < w / 2 - 0.1; x += 0.4) g.add(box(0.05, 0.1, D - 0.1, st, x, deck - 0.07, 0));
      for (const sz of [-1, 1]) g.add(box(0.08, deck - 0.168, 0.08, st, w / 2 - 0.05, (deck - 0.168) / 2, sz * (D / 2 - 0.06)));
      // balustrade along the open edge, gap for the ladder at the −Z end
      glassRun(g, w / 2 - 0.03, -D / 2 + 0.75, w / 2 - 0.03, D / 2 - 0.02, deck, 1.1);
      g.add(box(w * 0.6, 0.15, D * 0.75, material('fabric', 0xeeeae2), -w * 0.15, deck + 0.075, 0));   // mattress
      return finish(g);
    }
    case 'stair': case 'ship-ladder': {
      // Climbs towards +Z over its depth.
      const rise = it.h ?? p.h;
      if (type === 'ship-ladder') {
        const st = steelDark();
        const L = Math.hypot(d, rise), ang = Math.atan2(rise, d);
        for (const sx of [-1, 1]) { const s = box(0.04, 0.12, L, st, sx * (w / 2 - 0.02), rise / 2, 0); s.rotation.x = -ang; g.add(s); }
        const n = Math.round(rise / 0.23);
        for (let i = 1; i <= n; i++) g.add(box(w - 0.08, 0.03, 0.14, material('floor-timber', 0x8a6b4a), 0, i * rise / (n + 0.4), -d / 2 + i * d / (n + 0.4)));
        return finish(g);
      }
      flight(g, w, d, rise, -d / 2);
      return finish(g);
    }
    case 'spiral-in': return spiral(w, it.h ?? p.h);
    default: return fittingModel(type, w, d, h, color);
  }
}

function spiral(dia, rise) {
  const g = new THREE.Group();
  const st = steelDark();
  g.add(cyl(0.05, rise + 1.0, st, 0, (rise + 1.0) / 2, 0, 'y', 12));
  const n = Math.max(8, Math.round(rise / 0.2));
  const R = dia / 2;
  for (let i = 1; i <= n; i++) {
    const tread = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.03, 12, 1, false, 0, Math.PI * 2 / 12), material('galvanised'));
    tread.position.y = i * rise / n;
    tread.rotation.y = i * Math.PI * 2 / 12;
    g.add(tread);
    const post = box(0.02, 0.95, 0.02, st, 0, i * rise / n + 0.475, 0);
    post.position.x = Math.cos(-(i + 0.9) * Math.PI * 2 / 12) * (R - 0.03);
    post.position.z = Math.sin(-(i + 0.9) * Math.PI * 2 / 12) * (R - 0.03);
    g.add(post);
  }
  return finish(g);
}

/* ---------------- facade (outside a wall) ---------------- */

function facadePart(type, it, p, ctx) {
  const w = it.w ?? p.w, h = it.h ?? p.h;
  const g = new THREE.Group();
  switch (type) {
    case 'slat-screen': {
      const wood = material('timber', 0x7a5236);
      const st = steelDark();
      for (const y of [0.05, h - 0.05]) g.add(box(w, 0.04, 0.03, st, 0, y, 0.045));
      for (let x = -w / 2 + 0.03; x <= w / 2 - 0.02; x += 0.065) g.add(box(0.045, h, 0.02, wood, x, h / 2, 0.075));
      return finish(g);
    }
    case 'fins': {
      const st = material('paint', 0x2b2d30, { grime: 0.05 });
      for (let x = -w / 2 + 0.05; x <= w / 2 - 0.04; x += 0.3) g.add(box(0.012, h, 0.2, st, x, h / 2, 0.1));
      g.add(box(w, 0.012, 0.2, st, 0, h, 0.1));
      return finish(g);
    }
    case 'green-wall': {
      g.add(box(w, h, 0.12, material('grass', 0x3f6b35), 0, h / 2, 0.06));
      const leaf = material('grass', 0x4f7d3c);
      for (let i = 0; i < Math.round(w * h * 10); i++) {
        const s = mesh(new THREE.IcosahedronGeometry(0.06 + ((i * 7) % 5) * 0.012, 0), leaf);
        g.add(at(s, -w / 2 + ((i * 0.618) % 1) * w, ((i * 0.382 + 0.1) % 1) * h, 0.13));
      }
      return finish(g);
    }
    case 'awning': {
      const P = it.proj ?? p.proj;
      const sheet = box(w, 0.03, P, material('galvanised', 0xb8bec2), 0, 0, P / 2);
      sheet.rotation.x = 0.06;
      g.add(sheet);
      g.add(box(w, 0.12, 0.05, steelDark(), 0, -0.05, P));
      for (const sx of [-1, 1]) {
        const rod = cyl(0.01, Math.hypot(P, 0.6), material('steel', 0x2f3134), sx * (w / 2 - 0.1), 0.3, P / 2, 'z', 6);
        rod.rotation.x = Math.PI / 2 + Math.atan2(0.6, P);
        g.add(rod);
      }
      return finish(g);
    }
    case 'window-hood': {
      const P = it.proj ?? p.proj, T = 0.012, plate = material('paint', 0x1f2023, { grime: 0.05 });
      g.add(box(w + 2 * T, T, P, plate, 0, h + T / 2, P / 2), box(w + 2 * T, T, P, plate, 0, -T / 2, P / 2));
      g.add(box(T, h, P, plate, -w / 2 - T / 2, h / 2, P / 2), box(T, h, P, plate, w / 2 + T / 2, h / 2, P / 2));
      return finish(g);
    }
    case 'ac-outdoor': {
      g.add(box(w, h, 0.3, material('plastic', 0xe9e9e6), 0, h / 2, 0.2));
      const grille = mesh(new THREE.CylinderGeometry(h * 0.35, h * 0.35, 0.01, 24), material('steel', 0x55595c));
      grille.rotation.x = Math.PI / 2;
      g.add(at(grille, -w * 0.15, h / 2, 0.355));
      for (const sx of [-1, 1]) g.add(box(0.03, 0.03, 0.4, steelDark(), sx * w * 0.4, -0.015, 0.2));
      return finish(g);
    }
    default:
      g.add(box(w, h, 0.05, material('render', 0xcccccc), 0, h / 2, 0.025));
      return finish(g);
  }
}

/* ---------------- roof ---------------- */

function roofPart(type, it, p) {
  const w = it.w ?? p.w, d = it.d ?? p.d;
  const g = new THREE.Group();
  switch (type) {
    case 'roof-deck': {
      const st = steelDark();
      for (let x = -w / 2 + 0.1; x <= w / 2 - 0.05; x += 0.6) g.add(box(0.05, 0.1, d, st, x, 0.05, 0));
      g.add(box(w, 0.025, d, material('floor-timber', 0x7b6a58), 0, 0.1125, 0));
      const y = 0.125;
      glassRun(g, -w / 2, -d / 2, w / 2, -d / 2, y);
      glassRun(g, -w / 2, d / 2, w / 2, d / 2, y);
      glassRun(g, w / 2, -d / 2, w / 2, d / 2, y);
      glassRun(g, -w / 2, -d / 2, -w / 2, d / 2 - 1.0, y);   // gap for the stair
      return finish(g);
    }
    case 'solar': {
      const pw = p.panel.w, pd = p.panel.d;
      const cols = Math.max(1, Math.floor(w / pw)), rows = Math.max(1, Math.floor(d / pd));
      const rail = material('aluminium', 0x9aa1a6);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const pn = new THREE.Group();
        pn.add(box(pw - 0.02, 0.035, pd - 0.02, rail, 0, 0, 0));
        pn.add(box(pw - 0.05, 0.005, pd - 0.05, material('steel', 0x0f1a2c), 0, 0.02, 0));
        pn.position.set(-cols * pw / 2 + (c + 0.5) * pw, 0.18 + Math.sin(0.17) * pd / 2, -rows * pd / 2 + (r + 0.5) * pd);
        pn.rotation.x = -0.17;
        g.add(pn);
      }
      for (const sx of [-1, 1]) g.add(box(cols * pw, 0.04, 0.04, rail, 0, 0.1, sx * rows * pd / 2 * 0.9));
      return finish(g);
    }
    case 'green-roof':
      g.add(box(w, 0.1, d, material('soil', 0x4b3b2c), 0, 0.05, 0));
      g.add(box(w - 0.04, 0.03, d - 0.04, material('grass', 0x5f8a3f), 0, 0.11, 0));
      for (const sz of [-1, 1]) g.add(box(w, 0.13, 0.02, material('aluminium', 0x7d8387), 0, 0.065, sz * d / 2));
      return finish(g);
    case 'skylight': case 'roof-hatch': {
      g.add(box(w, 0.15, 0.04, steelDark(), 0, 0.075, -d / 2 + 0.02), box(w, 0.15, 0.04, steelDark(), 0, 0.075, d / 2 - 0.02));
      g.add(box(0.04, 0.15, d, steelDark(), -w / 2 + 0.02, 0.075, 0), box(0.04, 0.15, d, steelDark(), w / 2 - 0.02, 0.075, 0));
      const lid = type === 'skylight' ? box(w + 0.04, 0.04, d + 0.04, glassM(), 0, 0.17, 0, { cast: false }) : box(w + 0.04, 0.06, d + 0.04, material('aluminium', 0xb9bec2), 0, 0.18, 0);
      g.add(lid);
      return finish(g);
    }
    case 'roof-pergola': return pergola(w, d, it.h ?? p.h);
    case 'pitched-roof': {
      // Mono-pitch at 5°, 300 mm clear above the container roof at the low side.
      const rise = Math.tan(5 * Math.PI / 180) * d;
      const sheet = box(w, 0.03, d / Math.cos(5 * Math.PI / 180), material('galvanised', 0xa9b0b4), 0, 0.3 + rise / 2, 0);
      sheet.rotation.x = -5 * Math.PI / 180;
      g.add(sheet);
      const st = steelDark();
      for (let x = -w / 2 + 0.1; x <= w / 2; x += Math.max(1.2, (w - 0.2) / Math.ceil((w - 0.2) / 3))) for (const sz of [-1, 1]) {
        const hh = 0.3 + (sz > 0 ? rise : 0) - 0.02;
        g.add(box(0.06, hh, 0.06, st, x, hh / 2, sz * (d / 2 - 0.3)));
      }
      return finish(g);
    }
    default:
      g.add(box(w, 0.05, d, material('render', 0xcccccc), 0, 0.025, 0));
      return finish(g);
  }
}

function pergola(w, d, h) {
  const g = new THREE.Group();
  const st = steelDark();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.1, h, 0.1, st, sx * (w / 2 - 0.05), h / 2, sz * (d / 2 - 0.05)));
  for (const sz of [-1, 1]) g.add(box(w, 0.15, 0.08, st, 0, h - 0.075, sz * (d / 2 - 0.05)));
  const wood = material('timber', 0x8a6242);
  for (let x = -w / 2 + 0.1; x <= w / 2 - 0.05; x += 0.2) g.add(box(0.045, 0.12, d + 0.2, wood, x, h + 0.06, 0));
  return finish(g);
}

/* ---------------- site ---------------- */

function sitePart(type, it, p) {
  const w = it.w ?? p.w, d = it.d ?? p.d, h = it.h ?? p.h;
  const g = new THREE.Group();
  switch (type) {
    case 'deck': case 'walkway': {
      const top = h;
      const st = material('galvanised', 0x8f969a);
      const board = type === 'deck' ? material('floor-timber', 0x7b6a58) : material('galvanised', 0x9aa1a6);
      g.add(box(w, 0.03, d, board, 0, top - 0.015, 0));
      g.add(box(w, 0.12, 0.05, st, 0, top - 0.09, -d / 2 + 0.025), box(w, 0.12, 0.05, st, 0, top - 0.09, d / 2 - 0.025));
      const nx = Math.max(2, Math.ceil(w / 1.8) + 1), nz = Math.max(2, Math.ceil(d / 1.8) + 1);
      for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
        const x = -w / 2 + 0.05 + i * (w - 0.1) / (nx - 1), z = -d / 2 + 0.05 + k * (d - 0.1) / (nz - 1);
        if (type === 'deck' || i === 0 || i === nx - 1) g.add(box(0.07, top - 0.15, 0.07, st, x, (top - 0.15) / 2, z));
      }
      if (type === 'walkway') { glassRun(g, -w / 2, -d / 2 + 0.02, w / 2, -d / 2 + 0.02, top); glassRun(g, -w / 2, d / 2 - 0.02, w / 2, d / 2 - 0.02, top); }
      return finish(g);
    }
    case 'pergola': return pergola(w, d, h);
    case 'canopy': {
      const st = steelDark();
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.1, h, 0.1, st, sx * (w / 2 - 0.05), h / 2, sz * (d / 2 - 0.05)));
      g.add(box(w, 0.12, d, st, 0, h - 0.06, 0));
      const sheet = box(w + 0.2, 0.01, d + 0.2, material('glass', 0xdfe8ec, { opacity: 0.55 }), 0, h + 0.01, 0, { cast: false });
      g.add(sheet);
      return finish(g);
    }
    case 'steps': {
      const n = Math.max(1, Math.round(h / 0.15));
      const chq = material('galvanised', 0x9aa1a6);
      for (let i = 0; i < n; i++) g.add(box(w, (i + 1) * h / n, d / n, chq, 0, (i + 1) * h / n / 2, d / 2 - (i + 0.5) * d / n));
      return finish(g);
    }
    case 'ramp': {
      const L = Math.hypot(d, h), ang = Math.atan2(h, d);
      const slab = box(w, 0.06, L, material('galvanised', 0x9aa1a6), 0, h / 2, 0);
      slab.rotation.x = -ang;
      g.add(slab);
      for (const sx of [-1, 1]) {
        const r = cyl(0.02, L, material('steel', 0x2f3134), sx * (w / 2 - 0.03), h / 2 + 0.9, 0, 'z', 8);
        r.rotation.x = Math.PI / 2 - ang;
        g.add(r);
        for (const f of [-0.45, 0, 0.45]) g.add(box(0.03, 0.9 + h * (f + 0.5), 0.03, steelDark(), sx * (w / 2 - 0.03), (0.9 + h * (f + 0.5)) / 2, f * d));
      }
      return finish(g);
    }
    case 'ext-stair': {
      // Flight up +Z with a 1 m top landing on posts.
      const land = Math.min(1.0, d * 0.3), run = d - land;
      flight(g, w, run, h, -d / 2, 0, { treadM: material('galvanised', 0x9aa1a6) });
      g.add(box(w, 0.05, land, material('galvanised', 0x9aa1a6), 0, h - 0.025, d / 2 - land / 2));
      for (const sz of [0, 1]) for (const sx of [-1, 1]) g.add(box(0.08, h - 0.05, 0.08, steelDark(), sx * (w / 2 - 0.04), (h - 0.05) / 2, d / 2 - 0.04 - sz * (land - 0.08)));
      return finish(g);
    }
    case 'spiral': return spiral(w, h);
    case 'balustrade': glassRun(g, -w / 2, 0, w / 2, 0, 0, h); return finish(g);
    case 'screen': {
      const wood = material('timber', 0x7a5236);
      for (const sx of [-1, 0, 1]) g.add(box(0.06, h, 0.06, steelDark(), sx * (w / 2 - 0.03), h / 2, 0));
      for (let y = 0.1; y < h; y += 0.11) g.add(box(w, 0.08, 0.02, wood, 0, y, 0.04));
      return finish(g);
    }
    case 'planter': {
      const cor = material('steel', 0x8a4b2a);
      g.add(box(w, h, 0.01, cor, 0, h / 2, -d / 2), box(w, h, 0.01, cor, 0, h / 2, d / 2), box(0.01, h, d, cor, -w / 2, h / 2, 0), box(0.01, h, d, cor, w / 2, h / 2, 0));
      g.add(box(w - 0.02, 0.05, d - 0.02, material('soil', 0x4b3b2c), 0, h - 0.06, 0));
      const leaf = material('grass', 0x4f7d3c);
      for (let x = -w / 2 + 0.25; x < w / 2; x += 0.45) g.add(at(mesh(new THREE.IcosahedronGeometry(0.22, 1), leaf), x, h + 0.12, 0));
      return finish(g);
    }
    case 'hot-tub':
      g.add(box(w, h, d, material('timber', 0x6d4a31), 0, h / 2, 0));
      g.add(box(w - 0.16, 0.02, d - 0.16, material('water', 0x6fa7b8), 0, h - 0.08, 0));
      return finish(g);
    case 'column':
      g.add(box(w, h, d, steelDark(), 0, h / 2, 0));
      g.add(box(0.35, 0.02, 0.35, steelDark(), 0, 0.01, 0));
      return finish(g);
    case 'rain-tank':
      g.add(cyl(w / 2, h, material('plastic', 0x3d5a45), 0, h / 2, 0, 'y', 28));
      g.add(cyl(0.25, 0.08, material('plastic', 0x2e4535), 0, h + 0.04, 0, 'y', 16));
      return finish(g);
    case 'septic':
      g.add(box(w, 0.08, d, material('concrete', 0xa9a59c), 0, 0.04, 0));
      for (const sx of [-1, 1]) g.add(cyl(0.3, 0.03, material('steel', 0x55595c), sx * w / 4, 0.095, 0, 'y', 20));
      return finish(g);
    case 'generator':
      g.add(box(w, h, d, material('paint', 0x5e6468, { grime: 0.1 }), 0, h / 2, 0));
      for (let y = 0.2; y < h - 0.1; y += 0.08) g.add(box(w * 0.4, 0.02, 0.005, material('steel', 0x2f3134), w * 0.2, y, d / 2 + 0.003));
      return finish(g);
    default: {
      const part = PART[type];
      if (part?.kind === 'fitting') return fittingModel(type, w, d, h, part.color);
      g.add(box(w, h, d, material('render', 0xcccccc), 0, h / 2, 0));
      return finish(g);
    }
  }
}

/** The model for a placed part (not a wall opening). */
export function partModel(it, ctx = {}) {
  const p = PART[it.type];
  if (!p) return new THREE.Group();
  if (it.kind === 'facade') return facadePart(it.type, it, p, ctx);
  if (it.kind === 'roof') return roofPart(it.type, it, p);
  if (it.kind === 'site') return sitePart(it.type, it, p);
  return fittingPart(it.type, it, p, ctx);
}

/** Size of a part on plan after its quarter turn: { dx, dz }. */
export function planSize(it) {
  const p = PART[it.type] || {};
  const w = it.w ?? p.w ?? 1, d = it.d ?? p.d ?? 1;
  return (it.rot || 0) % 2 ? { dx: d, dz: w } : { dx: w, dz: d };
}

export { boxMM };
