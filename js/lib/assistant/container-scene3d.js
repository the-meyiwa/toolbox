/* ============================================================
   TOOLBOX — Container design in 3D (Assistant card)

   Turns a resolved design (js/lib/container-design.js) into a
   realistic three.js scene in the shared Viewer3D: every unit built
   by container-mesh.js on concrete pads, openings cut and fitted,
   furniture, partitions with their doorways, tiled wet rooms, room
   labels, steel stairs with landings and handrails, decks, canopies,
   roof decks with glass balustrades and pitched roofs.

   Design coordinates: site X/Z in metres, level-0 floor at y = 0 and
   the ground at GROUND_Y (−0.25). The scene puts the ground at y = 0.
   ============================================================ */

import * as THREE from 'three';
import { Viewer3D } from '../viewer3d.js';
import { buildUnit, fittingModel, LINED_CLEARANCE } from '../container-mesh.js';
import { material } from '../render-materials.js';
import { FLOOR_DEPTH } from '../container-structure.js';
import { FITTINGS, GROUND_Y, toSite, dims } from '../container-design.js';

const LIFT = -GROUND_Y;          // scene y of the design's level-0 floor
const EXPLODE = 2.4;

function boxAt(x0, y0, z0, x1, y1, z1, mat, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(1e-3, x1 - x0), Math.max(1e-3, y1 - y0), Math.max(1e-3, z1 - z0)), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.castShadow = cast; m.receiveShadow = true;
  return m;
}

/** A straight steel stair between two heights along `asc` (unit vector in X or Z) inside `rect`. */
function stairFlight(st, y0, y1) {
  const g = new THREE.Group();
  const r = st.flight;
  const alongX = Math.abs(st.ascent.x) > 0.5;
  const dir = alongX ? Math.sign(st.ascent.x) : Math.sign(st.ascent.z);
  const L = alongX ? r.x1 - r.x0 : r.z1 - r.z0;
  const W = alongX ? r.z1 - r.z0 : r.x1 - r.x0;
  const start = dir > 0 ? (alongX ? r.x0 : r.z0) : (alongX ? r.x1 : r.z1);
  const n = Math.max(2, st.risers - 1);
  const going = L / n, rise = (y1 - y0) / st.risers;
  const steel = material('paint', 0x3a3d40, { grime: 0.2 });
  const tread = material('galvanised');
  const at = (s, w, y) => (alongX ? new THREE.Vector3(start + dir * s, y, (r.z0 + r.z1) / 2 + w) : new THREE.Vector3((r.x0 + r.x1) / 2 + w, y, start + dir * s));
  for (let i = 0; i < n; i++) {
    const p = at((i + 0.5) * going, 0, y0 + (i + 1) * rise);
    const t = new THREE.Mesh(new THREE.BoxGeometry(alongX ? going * 0.96 : W - 0.1, 0.035, alongX ? W - 0.1 : going * 0.96), tread);
    t.position.copy(p); t.castShadow = true; t.receiveShadow = true;
    g.add(t);
  }
  // Two stringers and a handrail on each side, all along the pitch line.
  const len = Math.hypot(L, y1 - y0);
  const angle = Math.atan2(y1 - y0, L);
  for (const side of [-1, 1]) {
    const w = side * (W / 2 - 0.03);
    for (const [h, thick, mat] of [[0, 0.2, steel], [0.95, 0.045, steel]]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(len, thick, 0.05), mat);
      const mid = at(L / 2, w, (y0 + y1) / 2 + h + (h ? 0 : -0.05));
      s.position.copy(mid);
      if (alongX) s.rotation.set(0, 0, dir * angle);
      else { s.rotation.set(0, -Math.PI / 2, 0); s.rotateZ(dir * angle); }
      s.castShadow = true;
      g.add(s);
    }
    for (let k = 0; k <= 3; k++) {
      const s = (L * k) / 3;
      const base = y0 + (y1 - y0) * (s / L);
      g.add(boxAt(...at(s, w, base).toArray().map((v, i) => v - [0.02, 0, 0.02][i]), ...at(s, w, base + 0.95).toArray().map((v, i) => v + [0.02, 0, 0.02][i]), steel));
    }
  }
  return g;
}

function landing(st, y, ground) {
  const g = new THREE.Group();
  const r = st.landing;
  const steel = material('paint', 0x3a3d40, { grime: 0.2 });
  g.add(boxAt(r.x0, y - 0.05, r.z0, r.x1, y, r.z1, material('galvanised')));
  g.add(boxAt(r.x0, y - 0.2, r.z0, r.x1, y - 0.05, r.z1, steel));
  for (const [x, z] of [[r.x0 + 0.05, r.z0 + 0.05], [r.x1 - 0.05, r.z0 + 0.05], [r.x0 + 0.05, r.z1 - 0.05], [r.x1 - 0.05, r.z1 - 0.05]]) {
    g.add(boxAt(x - 0.04, ground, z - 0.04, x + 0.04, y - 0.2, z + 0.04, steel));
  }
  return g;
}

function glassRail(x0, z0, x1, z1, y) {
  const g = new THREE.Group();
  const t = 0.012;
  const horiz = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  const glass = boxAt(horiz ? x0 : x0 - t, y, horiz ? z0 - t : z0, horiz ? x1 : x0 + t, y + 1.0, horiz ? z0 + t : z1, material('glass'), false);
  glass.renderOrder = 2;
  g.add(glass);
  g.add(boxAt(horiz ? x0 : x0 - 0.025, y + 1.0, horiz ? z0 - 0.025 : z0, horiz ? x1 : x0 + 0.025, y + 1.05, horiz ? z0 + 0.025 : z1, material('aluminium')));
  return g;
}

function pitchedRoof(rf, y, color) {
  const g = new THREE.Group();
  const r = rf.rect;
  const alongX = rf.ridge === 'x';
  const span = alongX ? r.z1 - r.z0 : r.x1 - r.x0;
  const len = alongX ? r.x1 - r.x0 : r.z1 - r.z0;
  const slope = Math.hypot(span / 2, rf.rise);
  const ang = Math.atan2(rf.rise, span / 2);
  const sheet = material('galvanised', 0xa9b0b4, { side: 'double' });
  for (const side of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : slope, 0.02, alongX ? slope : len), sheet);
    const c = alongX ? [(r.x0 + r.x1) / 2, y + rf.rise / 2, (r.z0 + r.z1) / 2 + side * span / 4] : [(r.x0 + r.x1) / 2 + side * span / 4, y + rf.rise / 2, (r.z0 + r.z1) / 2];
    p.position.set(...c);
    if (alongX) p.rotation.x = side * ang; else p.rotation.z = -side * ang;
    p.castShadow = true; p.receiveShadow = true;
    g.add(p);
  }
  // gable ends
  const shape = new THREE.Shape([new THREE.Vector2(-span / 2, 0), new THREE.Vector2(span / 2, 0), new THREE.Vector2(0, rf.rise)]);
  const gm = material('paint', color, { side: 'double', grime: 0 });
  for (const end of [0, 1]) {
    const tri = new THREE.Mesh(new THREE.ShapeGeometry(shape), gm);
    if (alongX) { tri.rotation.y = Math.PI / 2; tri.position.set(end ? r.x1 - 0.05 : r.x0 + 0.05, y, (r.z0 + r.z1) / 2); }
    else tri.position.set((r.x0 + r.x1) / 2, y, end ? r.z1 - 0.05 : r.z0 + 0.05);
    tri.castShadow = true;
    g.add(tri);
  }
  return g;
}

/**
 * Builds the design into a group. view: { roof, level ('all'|n), explode }.
 * Returns { group, anchors: [{ text, object }] } for room labels.
 */
export function buildDesignScene(design, view = {}) {
  const group = new THREE.Group();
  const anchors = [];
  const topLevel = design.levels.length - 1;
  const level = view.level ?? 'all';
  const showLevel = (L) => (level === 'all' ? true : L <= level);
  const cutLevel = (L) => !view.roof && (level === 'all' ? (view.explode || topLevel === 0 ? true : L === topLevel) : L === level);
  const lift = (L) => (view.explode && level === 'all' ? L * EXPLODE : 0);
  const cladding = design.extras?.cladding || 'none';

  for (const m of design.modules) {
    if (!showLevel(m.level)) continue;
    const cut = cutLevel(m.level);
    const openings = m.items.filter(i => i.kind === 'opening');
    const color = new THREE.Color(m.colorHex).getHex();
    const { group: unit, ext } = buildUnit({ size: m.size, len: m.len, wid: m.wid, hgt: m.hgt, color, openings, roof: !cut, lined: true });

    if (cladding === 'timber' || cladding === 'composite') {
      const clad = cladding === 'timber' ? material('timber', 0x8a5d3b, { side: 'double' }) : material('render', 0x6f6a63, { side: 'double' });
      unit.traverse(o => { if (o.isMesh && /^wall-/.test(o.name)) o.material = clad; });
    }

    // Wet-room tiles and room labels.
    for (const rm of m.rooms) {
      if (['toilet', 'bathroom', 'kitchen'].includes(rm.kind)) {
        const tile = boxAt(rm.x0 - m.len / 2 + 0.01, 0.001, -m.wid / 2 + 0.01, rm.x1 - m.len / 2 - 0.01, 0.006, m.wid / 2 - 0.01, material('marble', 0xdde1e2), false);
        unit.add(tile);
      }
      if (cut) {
        const a = new THREE.Object3D();
        a.position.set((rm.x0 + rm.x1) / 2 - m.len / 2, 0.1, 0);
        unit.add(a);
        anchors.push({ text: `${rm.name} · ${Math.round(rm.area * 10) / 10} m²`, object: a });
      }
    }

    // Partitions, with their door leaf standing open in the gap.
    for (const p of m.items.filter(i => i.type === 'partition')) {
      const { dx, dz } = dims('partition', p.r, p);
      const segs = p.door && !(p.r % 2)
        ? [{ x0: p.x - dx / 2, x1: p.x + dx / 2, z0: 0, z1: p.door.z0 }, { x0: p.x - dx / 2, x1: p.x + dx / 2, z0: p.door.z1, z1: m.wid }]
        : [{ x0: p.x - dx / 2, x1: p.x + dx / 2, z0: p.z - dz / 2, z1: p.z + dz / 2 }];
      const h = Math.min(p.h || FITTINGS.partition.h, m.hgt);
      for (const s of segs) {
        s.z0 = Math.max(s.z0, LINED_CLEARANCE); s.z1 = Math.min(s.z1, m.wid - LINED_CLEARANCE);
        if (s.z1 - s.z0 < 0.02) continue;
        unit.add(boxAt(s.x0 - m.len / 2, 0, s.z0 - m.wid / 2, s.x1 - m.len / 2, h, s.z1 - m.wid / 2, material('render', 0xe8e4dc, { grime: 0 })));
      }
      if (p.door && !(p.r % 2)) {
        unit.add(boxAt(s0(p.x, p.door.swing * (p.door.z1 - p.door.z0)) - m.len / 2, 0, p.door.z0 + 0.01 - m.wid / 2, s1(p.x, p.door.swing * (p.door.z1 - p.door.z0)) - m.len / 2, 2.0, p.door.z0 + 0.05 - m.wid / 2, material('paint', 0xe7e5e0, { grime: 0 })));
      }
    }

    // Furniture.
    for (const it of m.items.filter(i => i.kind === 'fitting' && i.type !== 'partition')) {
      const f = FITTINGS[it.type];
      if (!f) continue;
      const w = it.w ?? f.w, d = it.d ?? f.d;
      const piece = fittingModel(it.type, w, d, f.h, f.color ? new THREE.Color(f.color).getHex() : undefined);
      // Keep furniture inside the lined face (the layout places it against the steel).
      const { dx, dz } = dims(it.type, it.r, it);
      const c = LINED_CLEARANCE;
      const x = Math.min(Math.max(it.x, dx / 2 + c), m.len - dx / 2 - c);
      const z = Math.min(Math.max(it.z, dz / 2 + c), m.wid - dz / 2 - c);
      piece.position.set(x - m.len / 2, it.mount || f.mount || 0, z - m.wid / 2);
      piece.rotation.y = -(it.r || 0) * Math.PI / 2;
      unit.add(piece);
    }

    // Place the unit on the site.
    const c = toSite(m, m.len / 2, m.wid / 2);
    unit.position.set(c.x, m.elev + LIFT + lift(m.level), c.z);
    unit.rotation.y = m.rot === 90 ? -Math.PI / 2 : 0;
    unit.userData.module = m.id;
    group.add(unit);

    // Pads under ground-floor units.
    if (m.level === 0) {
      const padMat = material('concrete', 0xb3afa6);
      const xs = ext.len > 7 ? [0, 0.5, 1] : [0, 1];
      const padTop = LIFT - FLOOR_DEPTH;
      for (const fx of xs) for (const fz of [0, 1]) {
        const lx = -ext.len / 2 + 0.2 + fx * (ext.len - 0.4), lz = -ext.wid / 2 + 0.2 + fz * (ext.wid - 0.4);
        const p = new THREE.Vector3(lx, 0, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), unit.rotation.y).add(new THREE.Vector3(c.x, 0, c.z));
        group.add(boxAt(p.x - 0.3, -0.02, p.z - 0.3, p.x + 0.3, padTop, p.z + 0.3, padMat));
      }
    }
  }

  // Stairs and landings.
  for (const st of design.stairs || []) {
    if (level !== 'all' && st.toLevel > level) continue;
    const top = Math.min(st.toLevel, topLevel);
    const y0 = st.fromY + LIFT + lift(Math.max(0, st.toLevel - 1));
    const y1 = st.toY + LIFT + lift(top);
    group.add(stairFlight(st, y0, y1));
    group.add(landing(st, y1, lift(Math.max(0, st.toLevel - 1))));
  }

  // Decks beside units.
  for (const dk of design.decks || []) {
    const r = dk.rect;
    group.add(boxAt(r.x0, LIFT - 0.05, r.z0, r.x1, LIFT, r.z1, material('timber', 0x8d6a4a)));
    group.add(boxAt(r.x0, 0, r.z0, r.x1, LIFT - 0.05, r.z1, material('paint', 0x2e2f31, { grime: 0.3 })));
  }

  // Canopies over doors.
  for (const cp of design.canopies || []) {
    const m = design.modules.find(x => x.id === cp.module);
    if (!m || !showLevel(m.level)) continue;
    const y = cp.y + LIFT + lift(m.level);
    const r = cp.rect;
    const pc = boxAt(r.x0, y, r.z0, r.x1, y + 0.012, r.z1, material('glass', 0xd9e6ea, { opacity: 0.55 }), false);
    pc.renderOrder = 2;
    group.add(pc);
    const steel = material('paint', 0x3a3d40, { grime: 0.1 });
    group.add(boxAt(r.x0, y - 0.1, r.z0, r.x1, y, r.z0 + 0.05, steel));
    group.add(boxAt(r.x0, y - 0.1, r.z1 - 0.05, r.x1, y, r.z1, steel));
    if (cp.posts) {
      const ox = cp.out.x, oz = cp.out.z;
      const outer = [];
      if (Math.abs(ox) > 0.5) { const x = ox > 0 ? r.x1 - 0.05 : r.x0 + 0.05; outer.push([x, r.z0 + 0.05], [x, r.z1 - 0.05]); }
      else { const z = oz > 0 ? r.z1 - 0.05 : r.z0 + 0.05; outer.push([r.x0 + 0.05, z], [r.x1 - 0.05, z]); }
      for (const [x, z] of outer) group.add(boxAt(x - 0.04, 0, z - 0.04, x + 0.04, y, z + 0.04, steel));
    }
  }

  // Roof decks and pitched roofs.
  for (const rf of design.roofs || []) {
    const m = design.modules.find(x => x.id === rf.module);
    if (!m || !showLevel(m.level) || cutLevel(m.level)) continue;
    const y = rf.y + LIFT + lift(m.level);
    const r = rf.rect;
    if (rf.kind === 'deck') {
      group.add(boxAt(r.x0, y, r.z0, r.x1, y + 0.05, r.z1, material('timber', 0x9b7653)));
      group.add(glassRail(r.x0, r.z0, r.x1, r.z0, y + 0.05));
      group.add(glassRail(r.x0, r.z1, r.x1, r.z1, y + 0.05));
      group.add(glassRail(r.x0, r.z0, r.x0, r.z1, y + 0.05));
      group.add(glassRail(r.x1, r.z0, r.x1, r.z1, y + 0.05));
    } else {
      group.add(pitchedRoof(rf, y, new THREE.Color(m.colorHex).getHex()));
    }
  }

  return { group, anchors };
}
const s0 = (x, span) => Math.min(x, x + span);
const s1 = (x, span) => Math.max(x, x + span);

/** WebGL available in this browser? */
export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

/**
 * Mounts the interactive 3D view of a design into `mount`.
 * Returns a controller: update(view), rotate(±1), snapshot() → Promise<Blob>, dispose().
 */
export function mountDesign3D(mount, design, view, { dark = false } = {}) {
  const viewer = new Viewer3D(mount, { realism: true, environment: 'outdoor', dark, ground: true, fov: 38, renderOnDemand: true });
  viewer.controls.maxPolarAngle = Math.PI / 2 - 0.03;
  let current = null;
  let framed = false;

  const build = (v) => {
    if (current) {
      viewer.scene.remove(current);
      current.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
      viewer.clearLabels();
    }
    const { group, anchors } = buildDesignScene(design, v);
    current = group;
    viewer.scene.add(group);
    for (const a of anchors) viewer.addLabel(a.text, a.object);
    if (!framed) {
      // Start from a three-quarter view looking at the entrance side.
      const s = design.site;
      const cx = (s.x0 + s.x1) / 2, cz = (s.z0 + s.z1) / 2;
      viewer.controls.target.set(cx, 1.2, cz);
      const a = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75][v.angle ?? 0];
      viewer.camera.position.set(cx + Math.cos(a) * 20, 12, cz + Math.sin(a) * 20);
      framed = true;
    }
    viewer.frame(group, 1.15);
  };
  build(view);

  return {
    viewer,
    update(v) { build(v); },
    rotate(step) {
      const t = viewer.controls.target;
      const off = viewer.camera.position.clone().sub(t);
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), step * Math.PI / 2);
      viewer.camera.position.copy(t).add(off);
      viewer.controls.update();
    },
    snapshot() {
      return new Promise((resolve) => {
        if (viewer.composer) viewer.composer.render(); else viewer.renderer.render(viewer.scene, viewer.camera);
        viewer.renderer.domElement.toBlob(b => resolve(b), 'image/png');
      });
    },
    dispose() { viewer.dispose(); },
  };
}

