/**
 * Semantic segmentation of "2014 Toyota Corolla E180 EU (with interior)" by
 * Armored Wave (CC BY 4.0, https://skfb.ly/oLAVz).
 *
 * The source ships as a handful of material-merged meshes. We split every mesh
 * into vertex-connected islands (a door skin, a seat cushion, a wiper arm …),
 * classify each island by source node, material and bounding box, and cut the
 * single welded body shell per triangle into bonnet-independent panels. Rules
 * work in the source frame: +Z forward, +Y up, +X = vehicle left.
 */
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { readGLB, islands } from './glb-reader.mjs';

const side = x => (x > 0 ? 'left' : 'right');
const within = (b, z0, z1, tol = 0.03) => b[2] >= z0 - tol && b[5] <= z1 + tol;
const FRONT_DOOR = [-0.24, 0.93], REAR_DOOR = [-1.3, -0.17];

/** Door membership for trims, glass and frames on the door sides. */
function doorOf(isl, minAbsX) {
  if (Math.abs(isl.c[0]) < minAbsX) return null;
  if (within(isl.b, ...FRONT_DOOR)) return `door_front_${side(isl.c[0])}`;
  if (within(isl.b, ...REAR_DOOR)) return `door_rear_${side(isl.c[0])}`;
  return null;
}

const wheelCorner = c => `${c[2] > 0 ? 'front' : 'rear'}_${side(c[0])}`;

/** Island → component id ('SHELL' = per-triangle split, null = drop). */
export function classify(isl) {
  const { node, material: m, c, b, tris } = isl;
  const ax = Math.abs(c[0]);
  if (node.startsWith('Cube.002')) return 'front_license_plate';
  if (node.startsWith('Cube.003')) return 'rear_license_plate';
  if (m === 'invisible_dark') return null; // black stand-in planes that would hide the engine bay
  if (node === 'wheels') {
    const k = wheelCorner(c);
    if (m === 'tyre_side' || m === 'Material.011') return `tyre_${k}`;
    if (m === 'main_paint') return `wheel_rim_${k}`;
    if (m === 'Material.013') return tris > 30 ? `brake_disc_${k}` : ax > 0.68 ? `brake_caliper_${k}` : `wheel_hub_${k}`;
  }
  if (node === 'windows') {
    if (c[2] > 0.3 && ax < 0.3) return 'windshield';
    if (c[2] < -1.0 && ax < 0.3) return 'rear_window';
    const d = doorOf(isl, 0.5);
    if (d) return c[2] < -0.87 && d.startsWith('door_rear') ? `${d}_quarter_glass` : `${d}_glass`;
    return 'body_shell';
  }
  if (node === 'frontlights') return `headlamp_${side(c[0])}`;
  if (node === 'steering_wheel') return 'steering_wheel';
  if (node === 'body') {
    if (m === 'main_paint.001') {
      if (tris > 3000) return 'SHELL';
      if (ax > 0.66 && b[1] < 0.3 && b[4] > 0.9) return c[2] > -0.2 ? `door_front_${side(c[0])}_outer_panel` : `door_rear_${side(c[0])}_outer_panel`;
      if (c[2] < -1.2 && ax > 0.7 && b[1] > 0.8) return 'fuel_filler_door';
      if (c[2] > 0.55 && c[2] < 0.85 && ax > 0.76 && c[1] > 0.9) return `side_mirror_${side(c[0])}`;
      if (b[2] > 1.0 && ax < 0.3 && tris > 200) return 'hood';
      if (b[2] > 1.0 && ax < 0.3) return 'cowl_panel';
      if (tris === 128 && ax > 0.76) return c[2] > -0.25 ? `door_front_${side(c[0])}_handle` : `door_rear_${side(c[0])}_handle`;
      return 'body_shell';
    }
    if (m === 'main_paint') {
      if (c[2] > 0.55 && c[2] < 0.97 && ax > 0.76 && c[1] > 0.85) return `side_mirror_${side(c[0])}`;
      if (c[2] > 1.8 && ax < 0.12 && c[1] > 0.55) return 'front_emblem';
      if (c[2] > 1.4 && c[1] < 0.48) return 'front_bumper_cover';
      if (c[2] > 1.4 && c[1] > 0.7 && ax > 0.3) return `headlamp_${side(c[0])}`;
      if (c[2] > 1.4) return 'upper_grille';
      if (c[2] < -1.8 && c[1] > 0.8) return 'trunk_lid';
      return 'body_shell';
    }
    if (m === 'plastic1') {
      if (c[2] > 1.0 && c[2] < 1.26 && c[1] > 0.9 && c[1] < 1.0) return b[3] - b[0] > 1.0 ? 'cowl_panel' : 'wiper_arms';
      if (c[2] > 0.55 && c[2] < 0.97 && ax > 0.66 && c[1] > 0.85) return `side_mirror_${side(c[0])}`;
      if (c[2] > 1.6 && c[1] < 0.45 && ax > 0.55) return 'front_bumper_cover';
      if (c[2] > 1.9 && c[1] < 0.4) return 'lower_grille';
      if (c[2] > 1.8) return 'upper_grille';
      if (c[1] > 1.24 && ax < 0.6) return 'roof_panel';
      const d = doorOf(isl, 0.5);
      if (d && c[1] > 0.85) return `${d}_window_frame`;
      return 'body_shell';
    }
    if (m === 'Material.005') return `tail_lamp_${side(c[0])}`;
    if (m === 'klosz') return c[1] > 0.9 ? `side_mirror_${side(c[0])}` : `fog_lamp_${side(c[0])}`;
    if (m === 'miror') return `side_mirror_${side(c[0])}`;
    if (m === 'fabric_high') return 'headliner';
    if (m === 'car_plastic_grainy_gray') return 'pillar_trims';
    return 'body_shell';
  }
  if (node === 'interior1') {
    const d = doorOf(isl, 0.62);
    if (d) return `${d}_trim_panel`;
    if (m === 'carpet.002') return c[1] > 0.8 ? 'rear_parcel_shelf' : 'floor_carpet';
    if (m === 'belts') return 'seat_belts';
    if (m === 'car_plastic_grainy_gray' && c[1] > 1.19 && ax > 0.15 && c[2] > 0.25) return `sun_visor_${side(c[0])}`;
    if (c[1] > 1.1 && ax < 0.16 && c[2] > 0.2) return 'rearview_mirror';
    if (c[1] > 1.32) return 'dome_lamp';
    if (m === 'fabric_high') return 'grab_handles';
    if (c[1] > 1.1 || (c[1] > 0.5 && ax > 0.5 && ax < 0.62)) return 'seat_belts';
    if (ax > 0.6 && b[5] - b[2] > 1.2) return 'door_sill_trims';
    if (c[2] < -0.7 && ax > 0.38) return 'rear_quarter_trims';
    if (ax > 0.5 && c[1] > 0.85) return 'pillar_trims';
    return 'interior_trim';
  }
  if (node === 'furniture') {
    if (m === 'seat_fabric' && c[1] < 0.3) return 'floor_mats';
    if (c[2] > -0.4) {
      if (ax < 0.12) return c[1] > 0.57 ? 'console_armrest_lid' : 'center_console';
      const s = side(c[0]);
      if (ax > 0.56 && c[1] < 0.36) return `seat_rails_front_${s}`;
      if (c[1] > 1.02) return `headrest_front_${s}`;
      if (c[1] > 0.58 || c[2] < -0.13) return `seat_back_front_${s}`;
      return `seat_cushion_front_${s}`;
    }
    const section = c[0] > -0.14 ? 'rear_seatback_60' : 'rear_seatback_40';
    if (c[1] > 1.0) return `rear_headrest_${section.slice(-2)}`;
    if (c[2] < -0.86 && c[1] > 0.56) return section;
    if (c[2] < -1.1 && c[1] > 0.4) return section;
    return 'rear_seat_cushion';
  }
  if (node === 'interior_front') {
    const d = doorOf(isl, 0.62);
    if (d) return `${d}_trim_panel`;
    if (tris > 1500) return 'instrument_panel_upper';
    if (ax < 0.15 && b[4] - b[1] > 0.4) return 'center_console';
    if (c[0] > 0 && c[1] > 0.47 && c[1] < 0.6 && c[2] < 0.5 && ax < 0.12) return 'parking_brake_lever';
    if (c[0] < -0.1 && c[1] < 0.73 && c[1] > 0.45) return 'glovebox';
    if (m === 'speaker') return 'speakers';
    if (ax > 0.63 && c[1] > 0.9) return 'air_vents';
    if (c[1] > 0.84 && c[1] < 0.95) return 'dash_trim_band';
    return 'instrument_panel_lower';
  }
  if (node === 'dashboard' || node === 'dashboard.002') {
    if (ax < 0.1 && c[1] < 0.67) return c[1] < 0.53 ? 'center_console' : 'gear_selector';
    return 'instrument_cluster';
  }
  if (node === 'dashboard.001') {
    const d = doorOf(isl, 0.62);
    if (d) return `${d}_trim_panel`;
    if (m === 'screen') return 'audio_touchscreen';
    if (c[1] > 0.8 && c[0] > 0.15 && c[2] < 0.67) return 'steering_column';
    if (ax < 0.4 && c[1] < 0.72) return 'climate_controls';
    if (ax < 0.4) return 'center_stack';
    return 'instrument_panel_lower';
  }
  return 'body_shell';
}

/** Per-triangle split of the welded body shell. */
export function classifyShell(c) {
  const ax = Math.abs(c[0]);
  if (c[2] < -1.66 && c[1] > 0.84 && ax < 0.6) return 'trunk_lid';
  if (c[2] < -1.62 && c[1] < 0.8) return 'rear_bumper_cover';
  if (c[2] > 1.5 && c[1] < 0.72) return 'front_bumper_cover';
  if (c[2] > 1.9 && ax < 0.45) return 'front_bumper_cover';
  if (c[1] < 0.31 && ax > 0.66 && c[2] > -1.0 && c[2] < 0.85) return `rocker_panel_${side(c[0])}`;
  if (ax > 0.45 && c[2] > 0.87) return `front_fender_${side(c[0])}`;
  if (ax > 0.45 && c[2] < -1.26) return `rear_quarter_panel_${side(c[0])}`;
  return 'body_shell';
}

/**
 * Load, segment and transform to Toolbox vehicle space (+X forward, +Y up,
 * +Z right), uniformly scaled so overall length equals `length` metres.
 */
export function segmentCorolla(path, { length = 4.62 } = {}) {
  const { json, primitives } = readGLB(path);
  let zMin = Infinity, zMax = -Infinity;
  for (const p of primitives) for (let i = 2; i < p.positions.length; i += 3) { zMin = Math.min(zMin, p.positions[i]); zMax = Math.max(zMax, p.positions[i]); }
  const scale = length / (zMax - zMin);
  const parts = new Map();
  const bucket = id => { if (!parts.has(id)) parts.set(id, { positions: [], normals: [], indices: [], remap: new Map() }); return parts.get(id); };
  let primIndex = 0;
  const report = [];
  for (const prim of primitives) {
    const shortNode = prim.node.startsWith('Cube') ? prim.node : prim.parent.replace(/^corolla_e180_/, '');
    for (const tris of islands(prim)) {
      const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (const t of tris) for (let k = 0; k < 3; k++) { const v = prim.indices[t * 3 + k] * 3; for (let a = 0; a < 3; a++) { b[a] = Math.min(b[a], prim.positions[v + a]); b[a + 3] = Math.max(b[a + 3], prim.positions[v + a]); } }
      const isl = { node: shortNode, material: prim.material, tris: tris.length, b, c: [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2] };
      const id = classify(isl);
      report.push({ ...isl, id });
      if (!id) continue;
      for (const t of tris) {
        let target = id;
        if (id === 'SHELL') {
          const c = [0, 1, 2].map(a => (prim.positions[prim.indices[t * 3] * 3 + a] + prim.positions[prim.indices[t * 3 + 1] * 3 + a] + prim.positions[prim.indices[t * 3 + 2] * 3 + a]) / 3);
          target = classifyShell(c);
        }
        const out = bucket(target);
        for (let k = 0; k < 3; k++) {
          const v = prim.indices[t * 3 + k], key = primIndex * 16777216 + v;
          let index = out.remap.get(key);
          if (index === undefined) {
            index = out.positions.length / 3;
            out.remap.set(key, index);
            const [x, y, z] = [prim.positions[v * 3], prim.positions[v * 3 + 1], prim.positions[v * 3 + 2]];
            out.positions.push(z * scale, y * scale, -x * scale);
            if (prim.normals) out.normals.push(prim.normals[v * 3 + 2], prim.normals[v * 3 + 1], -prim.normals[v * 3]);
            else out.normals.push(0, 1, 0);
          }
          out.indices.push(index);
        }
      }
    }
    primIndex++;
  }
  const geometries = new Map();
  for (const [id, data] of [...parts].sort(([a], [b]) => a.localeCompare(b))) {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(data.positions, 3));
    g.setAttribute('normal', new Float32BufferAttribute(data.normals, 3));
    g.setIndex(data.indices);
    g.computeBoundingBox();
    geometries.set(id, g);
  }
  return { geometries, scale, report, asset: json.asset };
}
