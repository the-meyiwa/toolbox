/**
 * Procedural 2008 Lexus GX 470 (UZJ120, body-on-frame SUV).
 *
 * Overall length, width, height, wheelbase, track, ground clearance and tyre
 * size follow Lexus's published 2008 specifications; body surfacing, trim
 * shapes and the placement of engine-bay, chassis and cabin components are
 * Toolbox approximations for orientation. Doors, the side-hinged rear door
 * and its separately opening glass, bonnet, fuel door, wheels, brakes and
 * seats move about their real pivots.
 *
 * Coordinates: metres, x = -u (u = distance behind the front bumper),
 * y up from the ground, z to the right. Left-hand drive.
 */
import { merge, mirrorZ, place, box, roundedBox, cylinder, sphere, lathe, tube, torus, helix, surface, lerp, TAU } from './geometry.mjs';
import { Assembly } from './assembly.mjs';
import { Loft, samples } from './shapes.mjs';
import { SIDES, handed, deg } from './common.mjs';

const IN = 0.0254;
const X = u => -u;
const at = (u, y, z) => [X(u), y, z];

export const GX470 = {
  L: 188.2 * IN, W: 1.88, H: 1.895, WB: 109.8 * IN, track: 1.585, clearance: 0.211,
  axleFU: 0.93, tyre: { width: 0.265, aspect: 0.65, rimIn: 17 }
};
GX470.axleRU = GX470.axleFU + GX470.WB;
GX470.tyreOD = GX470.tyre.rimIn * IN + 2 * GX470.tyre.width * GX470.tyre.aspect;
GX470.wheelY = GX470.tyreOD / 2;
const ARCH_R = 0.46;

/* Body sections: u, bottom, corner radius, lower half-width, side bulge, belt, shoulder, roof-edge half-width, roof top, roof radius. */
const BODY = [
  [0.00, 0.52, 0.06, 0.80, 0.00, 0.98, 0.01, 0.74, 1.02, 0.05],
  [0.06, 0.45, 0.07, 0.87, 0.00, 1.04, 0.02, 0.8, 1.08, 0.07],
  [0.18, 0.42, 0.08, 0.915, 0.005, 1.08, 0.03, 0.84, 1.12, 0.1],
  [0.6, 0.45, 0.08, 0.935, 0.01, 1.1, 0.04, 0.85, 1.155, 0.12],
  [0.93, 0.46, 0.08, 0.94, 0.0, 1.11, 0.05, 0.85, 1.175, 0.12],
  [1.55, 0.46, 0.08, 0.93, 0.01, 1.12, 0.05, 0.84, 1.2, 0.12],
  [2.05, 0.46, 0.08, 0.925, 0.012, 1.13, 0.07, 0.74, 1.845, 0.1],
  [2.7, 0.46, 0.08, 0.925, 0.012, 1.135, 0.07, 0.75, 1.86, 0.1],
  [3.72, 0.48, 0.08, 0.94, 0.0, 1.145, 0.07, 0.76, 1.855, 0.1],
  [4.4, 0.5, 0.08, 0.93, 0.01, 1.15, 0.07, 0.76, 1.85, 0.1],
  [4.66, 0.56, 0.08, 0.9, 0.005, 1.14, 0.07, 0.74, 1.82, 0.11],
  [4.74, 0.6, 0.07, 0.88, 0.0, 1.13, 0.07, 0.73, 1.8, 0.1],
  [4.78, 0.62, 0.06, 0.84, 0.0, 1.12, 0.07, 0.7, 1.76, 0.1]
].map(([u, yb, rb, wl, bulge, belt, sh, wr, yt, rr]) => ({ u, yb, rb, wl, bulge, belt, sh, wr, yt, rr }));

function archTop(u) {
  let y = -Infinity;
  for (const ua of [GX470.axleFU, GX470.axleRU]) if (Math.abs(u - ua) < ARCH_R) y = Math.max(y, GX470.wheelY + Math.sqrt(ARCH_R ** 2 - (u - ua) ** 2));
  return y;
}
const inArch = u => [GX470.axleFU, GX470.axleRU].some(ua => Math.abs(u - ua) < ARCH_R);

/** Section of the right half: t 0–1 bottom and sill corner, 1–2 body side, 2–3 glasshouse side, 3–4 roof (or bonnet). */
function section(p, t, side) {
  let y, z;
  if (t <= 1) {
    if (t <= 0.5) { z = lerp(0, p.wl - p.rb, t / 0.5); y = p.yb; }
    else { const a = (t - 0.5) / 0.5 * Math.PI / 2; z = p.wl - p.rb + p.rb * Math.sin(a); y = p.yb + p.rb - p.rb * Math.cos(a); }
  } else if (t <= 2) {
    const f = t - 1, low = Math.max(p.yb + p.rb, archTop(p.u));
    y = lerp(low, p.belt, f); z = p.wl + p.bulge * 4 * f * (1 - f);
  } else if (t <= 3) {
    const f = t - 2;
    if (f < 0.08) { z = lerp(p.wl, p.wl - p.sh, f / 0.08); y = lerp(p.belt, p.belt + 0.015, f / 0.08); }
    else { const g = (f - 0.08) / 0.92; z = lerp(p.wl - p.sh, p.wr, g); y = lerp(p.belt + 0.015, p.yt - p.rr, g); }
  } else {
    const f = t - 3;
    if (f < 0.5) { const a = f / 0.5 * Math.PI / 2; z = p.wr - p.rr + p.rr * Math.cos(a); y = p.yt - p.rr + p.rr * Math.sin(a); }
    else { const g = (f - 0.5) / 0.5; z = lerp(p.wr - p.rr, 0, g); y = p.yt + 0.012 * (1 - (1 - g) ** 2); }
  }
  return [y, side * z];
}

export function bodyLoft() {
  const L = new Loft(BODY, section);
  L.tMax = 4;
  L.outward = q => { const p = L.params(-q[0]); return [0, q[1] - (p.yb + p.yt) / 2, q[2]]; };
  return L;
}

export function buildGX470() {
  const A = new Assembly();
  const art = [];
  const B = bodyLoft();
  const ctx = { A, art, B, P: GX470 };
  buildBody(ctx);
  buildEnds(ctx);
  buildLampsAndTrim(ctx);
  buildFrameAndRunningGear(ctx);
  buildWheelsAndBrakes(ctx);
  buildPowertrain(ctx);
  buildEngineBay(ctx);
  buildInterior(ctx);
  buildFuelAndSpare(ctx);
  return { assembly: A, articulations: art };
}

/* ---------------------------------------------------------------- BODY -- */

const D = { hoodEnd: 1.52, wsTop: 2.05, frontDoor: [1.6, 2.72], rearDoor: [2.78, 3.6], cPillar: [3.6, 3.82], quarterGlass: [3.84, 4.5], rearFace: 4.66 };

function buildBody(ctx) {
  const { A, B, art } = ctx;
  const [fd0, fd1] = D.frontDoor, [rd0, rd1] = D.rearDoor;
  const us = samples(0, 4.78, 0.06, [0.18, D.hoodEnd, 1.55, D.wsTop, fd0, fd1, rd0, rd1, D.cPillar[1], ...D.quarterGlass, D.rearFace, GX470.axleFU - ARCH_R, GX470.axleFU + ARCH_R, GX470.axleRU - ARCH_R, GX470.axleRU + ARCH_R]);
  const ts = samples(0, 4, 0.06, [0.5, 1, 1.12, 2, 2.08, 2.14, 2.9, 3, 3.25, 3.5]);
  const doorPivots = {}, glassPivots = {};
  for (const { key, s } of SIDES) for (const [pos, u0] of [['front', fd0], ['rear', rd0]]) {
    const id = `door_${pos}_${key}`;
    const p = B.point(u0, 1.5, s);
    doorPivots[id] = A.pivot(`tbx_pivot_${id}`, [p[0] + 0.01, 0.75, p[2] - 0.02 * s]);
    const gu = pos === 'front' ? (fd0 + fd1) / 2 : (rd0 + rd1) / 2;
    glassPivots[id] = A.pivot(`tbx_pivot_${id}_glass`, [X(gu), 1.2, p[2]], doorPivots[id]);
  }
  ctx.doorPivots = doorPivots;
  const hoodPivot = A.pivot('tbx_pivot_hood', at(D.hoodEnd, 1.19, 0));
  ctx.hoodPivot = hoodPivot;
  for (const { key, s } of SIDES) {
    const parts = B.regions({
      us, ts, side: s, classify: ({ u, t, p }) => {
        const y = p[1], z = Math.abs(p[2]);
        // Bottom and sill corner: open under the wheel arches.
        if (t < 1) {
          if (inArch(u) && z > 0.55) return null;
          if (u < 0.2) return 'front_bumper_cover';
          if (u > 4.6) return 'rear_bumper_cover';
          if (t < 0.5 && z < 0.55) return null;  // the floor pan sits higher, on the frame
          return u > GX470.axleFU + ARCH_R && u < GX470.axleRU - ARCH_R ? `rocker_panel_${key}` : u < 2 ? `front_fender_${key}` : `rear_quarter_panel_${key}`;
        }
        // Body side, belt downwards.
        if (t < 2.08) {
          if (u < 0.2) return y < 0.74 ? 'front_bumper_cover' : `front_fender_${key}`;
          if (u > 4.6) return y < 0.8 ? 'rear_bumper_cover' : `rear_quarter_panel_${key}`;
          if (y < 0.74 && u < GX470.axleFU - ARCH_R) return 'front_bumper_cover';
          if (y < 0.8 && u > GX470.axleRU + ARCH_R) return 'rear_bumper_cover';
          if (u < fd0) return `front_fender_${key}`;
          if (u < fd1) return `door_front_${key}_outer_panel`;
          if (u < rd0) return `b_pillar_${key}`;
          if (u < rd1) return `door_rear_${key}_outer_panel`;
          return `rear_quarter_panel_${key}`;
        }
        // Glasshouse and roof.
        if (u < D.hoodEnd) return t < 3 ? `front_fender_${key}` : 'hood';
        if (u < 1.55) return t < 3 ? `front_fender_${key}` : 'cowl_panel';
        if (u < D.wsTop) return t > 3.25 ? 'windshield' : `a_pillar_${key}`;
        if (t > 2.9) return u > D.rearFace ? 'rear_roof_header' : 'roof_panel';
        if (u < fd1) return t > 2.14 && u > fd0 + 0.06 && u < fd1 - 0.04 ? `door_front_${key}_glass` : u > fd0 ? `door_front_${key}_window_frame` : `a_pillar_${key}`;
        if (u < rd0) return `b_pillar_${key}`;
        if (u < rd1) return t > 2.14 && u > rd0 + 0.04 && u < rd1 - 0.04 ? `door_rear_${key}_glass` : `door_rear_${key}_window_frame`;
        if (u < D.cPillar[1]) return `c_pillar_${key}`;
        if (u < D.quarterGlass[1]) return t > 2.14 && u > D.quarterGlass[0] ? `rear_quarter_glass_${key}` : `rear_quarter_panel_${key}`;
        return `d_pillar_${key}`;
      }
    });
    for (const [id, g] of parts) {
      const door = id.match(/^(door_(front|rear)_(left|right))_(outer_panel|window_frame|glass)$/);
      const parent = door ? (door[4] === 'glass' ? glassPivots[door[1]] : doorPivots[door[1]]) : id === 'hood' ? hoodPivot : A.root;
      A.add(id, g, parent);
    }
  }
  // Door inner trims, handles and mirrors; open, window and mirror movements.
  for (const { key, s, label } of SIDES) for (const [pos, u0, u1] of [['front', fd0, fd1], ['rear', rd0, rd1]]) {
    const id = `door_${pos}_${key}`, dp = doorPivots[id];
    const trim = B.patch(u0 + 0.03, u1 - 0.03, 1.12, 2.02, { side: s, nu: 6, nt: 5, offset: -0.09 });
    A.add(`${id}_trim_panel`, merge([trim, roundedBox(u1 - u0 - 0.3, 0.035, 0.08, 0.01, { at: at((u0 + u1) / 2, 0.88, (B.params((u0 + u1) / 2).wl - 0.16) * s) })]), dp);
    const hp = B.point(u1 - 0.18, 1.86, s);
    A.add(`${id}_handle`, box(0.13, 0.03, 0.03, { at: [hp[0], 1.02, hp[2] + 0.012 * s] }), dp);
    art.push({ id, label: `${pos === 'front' ? 'Front' : 'Rear'} ${key} door`, group: 'Doors', actions: { on: 'Open door', off: 'Close door' }, components: [`${id}_outer_panel`, `${id}_trim_panel`, `${id}_window_frame`, `${id}_handle`, `${id}_glass`], transforms: [{ node: dp.name, rotate: { axis: [0, 1, 0], degrees: (pos === 'front' ? 66 : 72) * s } }] });
    art.push({ id: `${id}_window`, label: `${pos === 'front' ? 'Front' : 'Rear'} ${key} window`, group: 'Windows', actions: { on: 'Lower window', off: 'Raise window' }, components: [`${id}_glass`, `${id}_window_frame`, `${id}_outer_panel`, `${id}_trim_panel`], transforms: [{ node: `tbx_pivot_${id}_glass`, translate: [0, pos === 'front' ? -0.5 : -0.42, 0] }], duration: 1600 });
    if (pos === 'front') {
      const mu = fd0 + 0.14, my = 1.2, mz = (B.params(mu).wl - 0.04) * s;
      const mp = A.pivot(`tbx_pivot_mirror_${key}`, at(mu, my, mz), dp);
      A.add(`side_mirror_${key}`, merge([roundedBox(0.11, 0.17, 0.24, 0.04, { at: at(mu + 0.03, my + 0.06, mz + 0.15 * s) }), roundedBox(0.06, 0.05, 0.06, 0.015, { at: at(mu, my + 0.01, mz + 0.03 * s) })]), mp);
      art.push({ id: `mirror_${key}`, label: `${label} mirror`, group: 'Mirrors', actions: { on: 'Fold mirror', off: 'Unfold mirror' }, components: [`side_mirror_${key}`], transforms: [{ node: mp.name, rotate: { axis: [0, 1, 0], degrees: -65 * s } }] });
    }
  }
  art.push({ id: 'hood', label: 'Bonnet (hood)', group: 'Body', actions: { on: 'Open bonnet', off: 'Close bonnet' }, components: ['hood', 'hood_hinges'], transforms: [{ node: hoodPivot.name, rotate: { axis: [0, 0, 1], degrees: 58 } }], duration: 1300 });
  for (const { s } of SIDES) A.add('hood_hinges', place(tube([[0, 0, 0], [0.08, -0.05, 0], [0.18, -0.03, 0]], 0.01, { radial: 6 }), { at: at(D.hoodEnd + 0.02, 1.15, 0.72 * s) }), hoodPivot);
  // Wheel-arch liners.
  for (const [pos, ua] of [['front', GX470.axleFU], ['rear', GX470.axleRU]]) for (const { key, s } of SIDES) {
    const wl = B.params(ua).wl;
    const liner = surface(18, 3, (a, b) => { const ang = Math.PI * a; return at(ua + ARCH_R * Math.cos(ang), GX470.wheelY + ARCH_R * Math.sin(ang), lerp(0.55, wl - 0.005, b)); });
    A.add(`wheel_well_liner_${pos}_${key}`, handed(liner, s));
  }
  // Roof rails and the fuel filler door (left rear quarter).
  A.add('roof_rails', merge([-1, 1].flatMap(s => [
    box(2.1, 0.028, 0.035, { at: at(3.45, 1.88, 0.6 * s) }),
    box(0.1, 0.04, 0.05, { at: at(2.45, 1.865, 0.6 * s) }), box(0.1, 0.04, 0.05, { at: at(4.45, 1.86, 0.6 * s) })
  ])));
  const fu0 = 4.22, fu1 = 4.4, ft0 = B.tAtY(4.31, 0.98, -1, 1, 2), ft1 = B.tAtY(4.31, 1.12, -1, 1, 2);
  const fp = B.point(fu0, (ft0 + ft1) / 2, -1);
  const fdp = A.pivot('tbx_pivot_fuel_door', [fp[0], fp[1], fp[2] - 0.01]);
  A.add('fuel_filler_door', B.patch(fu0, fu1, ft0, ft1, { side: -1, nu: 3, nt: 2, offset: 0.006 }), fdp);
  art.push({ id: 'fuel_door', label: 'Fuel filler door', group: 'Body', actions: { on: 'Open fuel door', off: 'Close fuel door' }, components: ['fuel_filler_door', 'fuel_filler_cap'], transforms: [{ node: fdp.name, rotate: { axis: [0, 1, 0], degrees: -80 } }] });
  ctx.fuelDoor = fp;
}

/* ------------------------------------------------------ FRONT AND REAR -- */

function buildEnds(ctx) {
  const { A, B, art } = ctx;
  // Front face: bumper below, grille surround above; lamps and grille are laid over it.
  const f = B.params(0);
  const front = B.cap(0, { zs: samples(-f.wl, f.wl, 0.06), ys: samples(f.yb, f.yt, 0.05, [0.74]), tMax: 4, face: 1, classify: ({ y }) => (y < 0.74 ? 'front_bumper_cover' : 'grille_surround') });
  for (const [id, g] of front) A.add(id, g);
  // Rear face: bumper, side-hinged rear door (hinged on the right) and its separately opening glass.
  const r = B.params(4.78), U = 4.78;
  const dz = 0.66, gz = 0.61, y0 = 0.8, y1 = 1.22, g1 = 1.66, top = 1.7;
  const rear = B.cap(U, {
    zs: samples(-r.wl, r.wl, 0.06, [-dz, -gz, gz, dz]), ys: samples(r.yb, r.yt, 0.05, [y0, y1, 1.24, g1, top]), tMax: 4, face: -1,
    classify: ({ z, y }) => {
      if (y < y0) return 'rear_bumper_cover';
      if (Math.abs(z) < gz && y > 1.24 && y < g1) return 'rear_glass_hatch';
      if (Math.abs(z) < dz && y < top) return 'rear_door';
      return 'rear_body_panel';
    }
  });
  const doorP = A.pivot('tbx_pivot_rear_door', at(U + 0.01, 1.2, dz));
  const glassP = A.pivot('tbx_pivot_rear_glass_hatch', at(U + 0.01, g1 + 0.02, 0), doorP);
  for (const [id, g] of rear) A.add(id, g, id === 'rear_door' ? doorP : id === 'rear_glass_hatch' ? glassP : A.root);
  A.add('rear_door', B.cap(U - 0.07, { zs: samples(-dz + 0.02, dz - 0.02, 0.1), ys: samples(y0 + 0.02, 1.2, 0.1), tMax: 4, face: 1, classify: () => 'x' }).get('x'), doorP);
  A.add('rear_door_handle', box(0.03, 0.03, 0.16, { at: at(U + 0.02, 1.08, -0.45) }), doorP);
  A.add('license_plate_recess', box(0.01, 0.17, 0.33, { at: at(U + 0.004, 0.98, 0) }), doorP);
  A.add('high_mount_stop_lamp', box(0.02, 0.03, 0.34, { at: at(U + 0.005, top - 0.012, 0) }), doorP);
  A.add('rear_wiper', merge([box(0.02, 0.02, 0.5, { rot: [deg(-20), 0, 0], at: at(U + 0.02, 1.36, 0.15) })]), glassP);
  art.push({ id: 'rear_door', label: 'Rear door (side-hinged)', group: 'Body', actions: { on: 'Open rear door', off: 'Close rear door' }, components: ['rear_door', 'rear_door_handle', 'rear_glass_hatch', 'license_plate_recess'], transforms: [{ node: doorP.name, rotate: { axis: [0, 1, 0], degrees: 100 } }], duration: 1500 });
  art.push({ id: 'rear_glass_hatch', label: 'Rear glass hatch', group: 'Body', actions: { on: 'Open rear glass', off: 'Close rear glass' }, components: ['rear_glass_hatch', 'rear_wiper'], transforms: [{ node: glassP.name, rotate: { axis: [0, 0, 1], degrees: -65 } }], duration: 1200 });
  // Bumper reinforcements and tow hooks.
  A.add('front_bumper_reinforcement', box(0.08, 0.14, 1.5, { at: at(0.14, 0.58, 0) }));
  A.add('rear_bumper_reinforcement', box(0.08, 0.14, 1.5, { at: at(4.66, 0.66, 0) }));
  A.add('front_skid_plate', box(0.9, 0.012, 0.9, { at: at(0.7, 0.3, 0) }));
  A.add('tow_hooks', merge([-1, 1].map(s => torus(0.04, 0.012, { axis: 'z', seg: 12, tubeSeg: 4, at: at(0.1, 0.4, 0.45 * s) }))));
}

function buildLampsAndTrim(ctx) {
  const { A, B } = ctx;
  const fx = X(0) + 0.006;
  A.add('radiator_grille', merge([box(0.01, 0.24, 0.8, { at: [fx, 0.88, 0] }), ...[0, 1, 2, 3].map(i => box(0.014, 0.012, 0.78, { at: [fx + 0.004, 0.79 + i * 0.06, 0] }))]));
  A.add('front_emblem', cylinder(0.05, 0.05, 0.012, { axis: 'x', seg: 18, at: [fx + 0.008, 0.9, 0] }));
  for (const { key, s } of SIDES) {
    A.add(`headlamp_${key}`, roundedBox(0.03, 0.18, 0.3, 0.03, { at: [fx, 0.9, 0.6 * s] }));
    A.add(`fog_lamp_${key}`, cylinder(0.045, 0.045, 0.02, { axis: 'x', seg: 16, at: [fx + 0.004, 0.53, 0.64 * s] }));
    A.add(`front_turn_signal_${key}`, box(0.02, 0.05, 0.14, { at: [fx, 0.68, 0.72 * s] }));
    A.add(`tail_lamp_${key}`, roundedBox(0.03, 0.4, 0.14, 0.02, { at: at(4.78 + 0.01, 1.16, 0.75 * s) }));
    A.add(`rear_reflector_${key}`, box(0.012, 0.05, 0.14, { at: at(4.78 + 0.008, 0.66, 0.66 * s) }));
    A.add(`running_board_${key}`, merge([box(1.9, 0.03, 0.2, { at: at(2.66, 0.42, 0.83 * s) }), box(0.08, 0.06, 0.12, { at: at(2.1, 0.46, 0.76 * s) }), box(0.08, 0.06, 0.12, { at: at(3.2, 0.46, 0.76 * s) })]));
    A.add(`side_marker_${key}`, box(0.08, 0.03, 0.01, { at: at(0.3, 0.7, (B.params(0.3).wl + 0.002) * s) }));
  }
  // Windscreen wipers on the cowl.
  for (const [key, z] of [['driver', -0.35], ['passenger', 0.2]]) A.add(`wiper_arm_${key}`, box(0.02, 0.012, 0.6, { rot: [0, deg(8), deg(-38)], at: at(1.58, 1.24, z + 0.25) }));
}

/* ---------------------------------------------------- FRAME AND CHASSIS -- */

function buildFrameAndRunningGear(ctx) {
  const { A, P, art } = ctx;
  const fy = 0.5;
  // Ladder frame: two boxed rails with crossmembers; the body sits on rubber mounts.
  A.add('ladder_frame', merge([
    ...[-1, 1].map(s => box(4.37, 0.16, 0.08, { at: at(2.535, fy, 0.44 * s) })),
    ...[0.35, 1.6, 2.6, 3.55].map(u => box(0.08, 0.12, 0.88, { at: at(u, fy, 0) })),
    box(0.08, 0.1, 0.88, { at: at(4.72, 0.6, 0) })
  ]));
  A.add('body_mounts', merge([0.5, 1.5, 2.5, 3.4, 4.2].flatMap(u => [-1, 1].map(s => cylinder(0.04, 0.04, 0.05, { axis: 'y', seg: 10, at: at(u, fy + 0.1, 0.52 * s) })))));
  // Front: double-wishbone independent suspension with coil-over dampers, stabiliser bar and rack-and-pinion steering.
  const wy = P.wheelY, fu = P.axleFU;
  ctx.knuckles = {};
  for (const { key, s } of SIDES) {
    const hz = (P.track / 2 - 0.14) * s;
    A.add(`front_upper_control_arm_${key}`, merge([tube([at(fu - 0.12, wy + 0.3, 0.42 * s), at(fu, wy + 0.24, hz), at(fu + 0.14, wy + 0.3, 0.42 * s)], 0.018, { radial: 6 })]));
    A.add(`front_lower_control_arm_${key}`, merge([tube([at(fu - 0.22, wy - 0.12, 0.38 * s), at(fu, wy - 0.16, hz + 0.02 * s), at(fu + 0.2, wy - 0.12, 0.38 * s)], 0.024, { radial: 6 })]));
    A.add(`front_coil_spring_${key}`, helix(0.07, 0.01, 0.32, 5.5, { at: at(fu + 0.04, wy - 0.06, (0.6) * s), rot: [0, 0, deg(-8) * s] }));
    A.add(`front_shock_absorber_${key}`, cylinder(0.026, 0.026, 0.42, { seg: 10, at: at(fu + 0.04, wy + 0.12, 0.6 * s) }));
    const kp = A.pivot(`tbx_pivot_knuckle_${key}`, at(fu, wy, hz));
    A.add(`steering_knuckle_${key}`, merge([roundedBox(0.09, 0.34, 0.06, 0.02, { at: at(fu + 0.01, wy + 0.04, hz) }), roundedBox(0.16, 0.04, 0.04, 0.01, { at: at(fu + 0.12, wy + 0.02, hz - 0.03 * s) })]), kp);
    A.add(`tie_rod_${key}`, tube([at(fu + 0.2, wy + 0.02, 0.3 * s), at(fu + 0.2, wy + 0.02, hz - 0.05 * s)], 0.012, { radial: 6 }));
    A.add(`front_driveshaft_${key}`, tube([at(fu + 0.02, wy - 0.02, 0.26 + 0.12 * s), at(fu, wy, hz - 0.04 * s)], 0.025, { radial: 8 }));
    ctx.knuckles[key] = kp;
  }
  A.add('front_stabilizer_bar', tube([at(fu - 0.12, wy - 0.06, -0.62), at(fu - 0.3, wy - 0.02, -0.38), at(fu - 0.3, wy - 0.02, 0.38), at(fu - 0.12, wy - 0.06, 0.62)], 0.016, { radial: 6 }));
  A.add('steering_rack', merge([cylinder(0.03, 0.03, 0.62, { axis: 'z', seg: 12, at: at(fu + 0.2, wy + 0.02, 0) }), cylinder(0.04, 0.04, 0.12, { axis: 'y', seg: 10, at: at(fu + 0.2, wy + 0.08, -0.2) })]));
  A.add('front_differential', merge([sphere(0.12, { at: at(fu + 0.02, wy - 0.02, 0.26), seg: 14, scale: [1, 0.9, 1.0] }), cylinder(0.06, 0.06, 0.18, { axis: 'x', seg: 12, at: at(fu - 0.12, wy - 0.02, 0.26) })]));
  // Rear: rigid axle on four links and a lateral rod, rear air springs with height control.
  const ru = P.axleRU;
  A.add('rear_axle_housing', merge([cylinder(0.05, 0.045, P.track - 0.3, { axis: 'z', seg: 14, at: at(ru, wy, 0) })]));
  A.add('rear_differential', merge([sphere(0.175, { at: at(ru, wy, 0.05), seg: 16, scale: [1.0, 1, 0.8] }), cylinder(0.06, 0.06, 0.16, { axis: 'x', seg: 12, at: at(ru - 0.18, wy, 0.05) })]));
  for (const { key, s } of SIDES) {
    A.add(`rear_lower_control_arm_${key}`, tube([at(ru - 0.7, fy - 0.02, 0.44 * s), at(ru, wy - 0.08, 0.5 * s)], 0.025, { radial: 6 }));
    A.add(`rear_air_spring_${key}`, merge([cylinder(0.09, 0.09, 0.2, { seg: 16, at: at(ru + 0.12, wy + 0.16, 0.5 * s) }), cylinder(0.06, 0.07, 0.06, { seg: 14, at: at(ru + 0.12, wy + 0.04, 0.5 * s) })]));
    A.add(`rear_shock_absorber_${key}`, cylinder(0.025, 0.025, 0.46, { seg: 10, rot: [deg(8) * s, 0, 0], at: at(ru - 0.1, wy + 0.16, 0.6 * s) }));
  }
  A.add('rear_upper_control_arms', merge([-1, 1].map(s => tube([at(ru - 0.55, wy + 0.22, 0.3 * s), at(ru - 0.05, wy + 0.2, 0.18 * s)], 0.02, { radial: 6 }))));
  A.add('rear_lateral_rod', tube([at(ru + 0.2, wy + 0.1, -0.5), at(ru + 0.2, wy + 0.15, 0.48)], 0.02, { radial: 6 }));
  A.add('rear_stabilizer_bar', tube([at(ru - 0.25, wy - 0.02, -0.55), at(ru - 0.1, wy, -0.5), at(ru - 0.1, wy, 0.5), at(ru - 0.25, wy - 0.02, 0.55)], 0.014, { radial: 6 }));
  A.add('height_control_sensor', box(0.05, 0.05, 0.05, { at: at(ru - 0.2, fy + 0.02, -0.4) }));
  // Steering: exclusive left / right lock turns both knuckles.
  for (const [dir, sgn] of [['left', 1], ['right', -1]]) {
    art.push({ id: `steer_${dir}`, label: `Steer ${dir}`, group: 'Steering', exclusive: 'steer', actions: { on: `Turn wheels ${dir}`, off: 'Straighten wheels' }, components: ['steering_rack', 'tie_rod_left', 'tie_rod_right', 'steering_knuckle_left', 'steering_knuckle_right', 'steering_wheel', 'tyre_front_left', 'tyre_front_right'], transforms: [...SIDES.map(({ key }) => ({ node: ctx.knuckles[key].name, rotate: { axis: [0, 1, 0], degrees: 30 * sgn } })), { node: 'tbx_pivot_steering_wheel', rotate: { axis: [-Math.cos(deg(26.6)), Math.sin(deg(26.6)), 0], degrees: 150 * sgn } }], duration: 1300 });
  }
}

function tyreGeometry(P) {
  const r = P.tyreOD / 2, rr = P.tyre.rimIn * IN / 2 + 0.01, w = P.tyre.width / 2;
  const prof = [];
  for (let i = 0; i <= 14; i++) { const a = -Math.PI / 2 + Math.PI * i / 14; prof.push([rr + (r - rr) * (0.5 + 0.5 * Math.cos(a) ** 0.6), w * Math.sin(a)]); }
  return lathe([[rr, -w * 0.85], ...prof, [rr, w * 0.85]], { axis: 'z', seg: 36 });
}
function rimGeometry(P) {
  const rr = P.tyre.rimIn * IN / 2 + 0.01, w = P.tyre.width / 2;
  const spokes = Array.from({ length: 6 }, (_, i) => { const a = i / 6 * TAU; return place(box(0.05, rr * 0.8, 0.03), { rot: [0, 0, a], at: [-Math.sin(a) * rr * 0.45, Math.cos(a) * rr * 0.45, w * 0.7] }); });
  return merge([lathe([[0.09, w * 0.75], [rr * 0.95, w * 0.8], [rr, w * 0.85], [rr, -w * 0.85], [rr * 0.9, -w * 0.8]], { axis: 'z', seg: 32 }), cylinder(0.09, 0.09, 0.06, { axis: 'z', seg: 18, at: [0, 0, w * 0.7] }), ...spokes]);
}

function buildWheelsAndBrakes(ctx) {
  const { A, P, art } = ctx;
  for (const [pos, au] of [['front', P.axleFU], ['rear', P.axleRU]]) for (const { key, s, label } of SIDES) {
    const id = `${pos}_${key}`, center = at(au, P.wheelY, (P.track / 2) * s);
    const parent = pos === 'front' ? ctx.knuckles[key] : A.root;
    const wp = A.pivot(`tbx_pivot_wheel_${id}`, center, parent);
    const p3 = g => place(handed(g, s), { at: center });
    A.add(`wheel_rim_${id}`, p3(rimGeometry(P)), wp);
    const tp = A.pivot(`tbx_pivot_tyre_${id}`, center, wp);
    A.add(`tyre_${id}`, p3(tyreGeometry(P)), tp);
    const hubZ = (P.track / 2 - 0.05) * s;
    A.add(`wheel_hub_${id}`, merge([cylinder(0.075, 0.075, 0.03, { axis: 'z', seg: 18, at: [center[0], center[1], hubZ] }), ...Array.from({ length: 6 }, (_, i) => { const a = i / 6 * TAU; return cylinder(0.007, 0.007, 0.05, { axis: 'z', seg: 6, at: [center[0] + Math.cos(a) * 0.07, center[1] + Math.sin(a) * 0.07, hubZ + 0.02 * s] }); })]), parent);
    const dz = hubZ - 0.05 * s;
    A.add(`brake_disc_${id}`, cylinder(pos === 'front' ? 0.165 : 0.155, pos === 'front' ? 0.165 : 0.155, 0.028, { axis: 'z', seg: 36, at: [center[0], center[1], dz] }), parent);
    const cp = A.pivot(`tbx_pivot_caliper_${id}`, [center[0] - 0.1, center[1] + 0.06, dz], parent);
    A.add(`brake_caliper_${id}`, place(roundedBox(0.07, 0.17, 0.09, 0.02), { rot: [0, 0, deg(30)], at: [center[0] - 0.12, center[1] + 0.07, dz] }), cp);
    A.add(`brake_pads_${id}`, merge([-1, 1].map(k => place(box(0.045, 0.12, 0.01), { rot: [0, 0, deg(30)], at: [center[0] - 0.12, center[1] + 0.07, dz + 0.02 * k] }))), cp);
    art.push({ id: `caliper_${id}`, label: `${label} ${pos} brake caliper`, group: 'Brakes', actions: { on: 'Remove caliper', off: 'Refit caliper' }, components: [`brake_caliper_${id}`, `brake_pads_${id}`, `brake_disc_${id}`], requires: [{ id: `wheel_${id}`, state: true, reason: 'Remove the wheel first.' }], transforms: [{ node: cp.name, translate: [-0.05, 0.1, 0.24 * s] }] });
    art.push({ id: `wheel_${id}`, label: `${label} ${pos} wheel`, group: 'Wheels', actions: { on: 'Remove wheel (rim + tyre)', off: 'Refit wheel' }, components: [`wheel_rim_${id}`, `tyre_${id}`, `wheel_hub_${id}`], requires: [{ id: `caliper_${id}`, state: false, reason: 'Refit the caliper first.' }], transforms: [{ node: wp.name, translate: [0, 0.03, 0.7 * s] }], duration: 1200 });
    art.push({ id: `tyre_${id}`, label: `${label} ${pos} tyre`, group: 'Wheels', actions: { on: 'Dismount tyre from rim', off: 'Mount tyre on rim' }, components: [`tyre_${id}`, `wheel_rim_${id}`], requires: [{ id: `wheel_${id}`, state: true, reason: 'Remove the wheel from the vehicle first.' }], transforms: [{ node: tp.name, translate: [0, 0, 0.38 * s] }], duration: 1100 });
  }
}

/* ---------------------------------------------------------- POWERTRAIN -- */

function buildPowertrain(ctx) {
  const { A, P } = ctx;
  // 2UZ-FE 4.7 L V8, mounted lengthwise behind the front axle line.
  const eu0 = 0.62, eu1 = 1.22, ey = 0.84;
  const bank = s => deg(45) * s;
  A.add('engine_block', merge([roundedBox(eu1 - eu0, 0.34, 0.36, 0.04, { at: at((eu0 + eu1) / 2, ey - 0.08, 0) }), roundedBox(eu1 - eu0 - 0.08, 0.14, 0.3, 0.03, { at: at((eu0 + eu1) / 2, ey - 0.3, 0) })]));
  for (const { key, s } of SIDES) {
    const hz = 0.22 * s, hy = ey + 0.14;
    A.add(`cylinder_head_${key}`, place(roundedBox(eu1 - eu0 - 0.04, 0.12, 0.2, 0.03), { rot: [bank(-s), 0, 0], at: at((eu0 + eu1) / 2, hy, hz) }));
    A.add(`valve_cover_${key}`, place(roundedBox(eu1 - eu0 - 0.06, 0.07, 0.18, 0.03), { rot: [bank(-s), 0, 0], at: at((eu0 + eu1) / 2, hy + 0.08, hz + 0.07 * s) }));
    A.add(`exhaust_manifold_${key}`, tube([at(eu0 + 0.08, ey - 0.02, 0.36 * s), at(eu1, ey - 0.12, 0.38 * s), at(eu1 + 0.25, ey - 0.4, 0.34 * s)], 0.035, { radial: 8 }));
    A.add('ignition_coils', merge([0, 1, 2, 3].map(i => cylinder(0.018, 0.018, 0.1, { seg: 8, rot: [bank(-s), 0, 0], at: at(eu0 + 0.1 + i * 0.13, hy + 0.08, hz + 0.1 * s) }))));
    A.add('spark_plugs', merge([0, 1, 2, 3].map(i => cylinder(0.008, 0.008, 0.08, { seg: 6, rot: [bank(-s), 0, 0], at: at(eu0 + 0.1 + i * 0.13, hy + 0.04, hz + 0.05 * s) }))));
  }
  A.add('intake_manifold', merge([roundedBox(eu1 - eu0 - 0.1, 0.12, 0.26, 0.05, { at: at((eu0 + eu1) / 2 + 0.04, ey + 0.24, 0) }), cylinder(0.05, 0.05, 0.18, { axis: 'x', seg: 14, at: at(eu0 - 0.02, ey + 0.22, 0) })]));
  A.add('throttle_body', cylinder(0.045, 0.045, 0.07, { axis: 'x', seg: 14, at: at(eu0 - 0.13, ey + 0.22, 0) }));
  A.add('timing_belt_cover', roundedBox(0.04, 0.42, 0.52, 0.06, { at: at(eu0 - 0.03, ey + 0.02, 0) }));
  A.add('crankshaft_pulley', cylinder(0.09, 0.09, 0.04, { axis: 'x', seg: 20, at: at(eu0 - 0.06, ey - 0.18, 0) }));
  A.add('oil_pan', roundedBox(0.52, 0.14, 0.3, 0.03, { at: at(0.95, ey - 0.43, 0) }));
  A.add('oil_filter', cylinder(0.04, 0.04, 0.09, { axis: 'y', seg: 12, at: at(0.72, ey - 0.4, 0.2) }));
  A.add('engine_mounts', merge([-1, 1].map(s => box(0.08, 0.08, 0.08, { at: at(0.9, ey - 0.3, 0.3 * s) }))));
  // A750F five-speed automatic and the two-speed transfer case (full-time 4WD, Torsen centre differential).
  A.add('transmission', merge([cylinder(0.2, 0.14, 0.7, { axis: 'x', seg: 18, at: at(1.6, ey - 0.12, 0) }), roundedBox(0.4, 0.08, 0.24, 0.02, { at: at(1.6, ey - 0.32, 0) })]));
  A.add('transfer_case', roundedBox(0.32, 0.3, 0.26, 0.05, { at: at(2.1, ey - 0.16, -0.04) }));
  A.add('front_propeller_shaft', tube([at(2.0, ey - 0.26, 0.12), at(1.4, ey - 0.4, 0.24), at(P.axleFU - 0.12, P.wheelY - 0.02, 0.26)], 0.028, { radial: 8 }));
  A.add('rear_propeller_shaft', tube([at(2.26, ey - 0.2, -0.04), at(P.axleRU - 0.2, P.wheelY, 0.05)], 0.035, { radial: 8 }));
  // Exhaust: twin downpipes to catalytic converters, one muffler, tailpipe exiting the rear.
  A.add('catalytic_converters', merge([-1, 1].map(s => cylinder(0.06, 0.06, 0.3, { axis: 'x', seg: 12, at: at(1.72, 0.4, 0.28 * s) }))));
  A.add('exhaust_pipe', tube([at(1.9, 0.4, 0.28), at(2.3, 0.38, 0.35), at(3.3, 0.4, 0.4), at(3.5, 0.42, 0.38)], 0.03, { radial: 8 }));
  A.add('muffler', roundedBox(0.55, 0.16, 0.3, 0.07, { at: at(3.1, 0.4, 0.6) }));
  A.add('tailpipe', tube([at(3.38, 0.4, 0.6), at(4.2, 0.4, 0.62), at(4.8, 0.44, 0.62)], 0.028, { radial: 8 }));
}

function buildEngineBay(ctx) {
  const { A, art } = ctx;
  A.add('radiator', box(0.06, 0.5, 1.1, { at: at(0.3, 0.84, 0) }));
  A.add('radiator_support', merge([box(0.06, 0.06, 1.5, { at: at(0.24, 1.1, 0) }), box(0.06, 0.06, 1.5, { at: at(0.24, 0.56, 0) })]));
  A.add('cooling_fan', merge([cylinder(0.24, 0.24, 0.03, { axis: 'x', seg: 24, at: at(0.44, 0.84, 0) }), cylinder(0.06, 0.06, 0.08, { axis: 'x', seg: 14, at: at(0.48, 0.84, 0) })]));
  A.add('fan_shroud', lathe([[0.33, 0.05], [0.28, -0.02], [0.28, -0.08]], { axis: 'x', seg: 28, at: at(0.36, 0.84, 0) }));
  A.add('radiator_hoses', merge([tube([at(0.32, 1.02, 0.35), at(0.5, 1.02, 0.25), at(0.6, 0.98, 0.1)], 0.02, { radial: 6 }), tube([at(0.32, 0.64, -0.38), at(0.5, 0.64, -0.2), at(0.62, 0.7, -0.05)], 0.02, { radial: 6 })]));
  A.add('water_pump', cylinder(0.06, 0.06, 0.06, { axis: 'x', seg: 14, at: at(0.56, 0.94, 0.0) }));
  A.add('coolant_reservoir', roundedBox(0.12, 0.14, 0.1, 0.02, { at: at(0.4, 1.02, 0.66) }));
  A.add('drive_belt', torus(0.12, 0.006, { axis: 'x', seg: 28, tubeSeg: 4, at: at(0.55, 0.86, 0) }));
  A.add('alternator', cylinder(0.07, 0.07, 0.11, { axis: 'x', seg: 16, at: at(0.62, 0.98, 0.3) }));
  A.add('ac_compressor', cylinder(0.07, 0.07, 0.15, { axis: 'x', seg: 16, at: at(0.66, 0.66, 0.3) }));
  A.add('power_steering_pump', cylinder(0.06, 0.06, 0.1, { axis: 'x', seg: 14, at: at(0.62, 0.96, -0.3) }));
  A.add('air_cleaner_housing', roundedBox(0.34, 0.2, 0.3, 0.04, { at: at(0.55, 1.0, -0.6) }));
  A.add('air_intake_duct', tube([at(0.55, 1.02, -0.45), at(0.45, 1.08, -0.2), at(0.52, 1.14, -0.02)], 0.045, { radial: 8 }));
  A.add('battery_12v', box(0.26, 0.2, 0.18, { at: at(0.62, 0.98, 0.64) }));
  A.add('fuse_relay_box', roundedBox(0.2, 0.08, 0.14, 0.02, { at: at(1.0, 1.04, 0.66) }));
  A.add('brake_master_cylinder', merge([cylinder(0.035, 0.035, 0.2, { axis: 'x', seg: 12, at: at(1.36, 1.02, -0.5) }), box(0.12, 0.08, 0.1, { at: at(1.3, 1.08, -0.5) })]));
  A.add('brake_fluid_reservoir', box(0.08, 0.06, 0.08, { at: at(1.3, 1.13, -0.5) }));
  A.add('abs_actuator', box(0.14, 0.12, 0.14, { at: at(1.2, 0.98, -0.66) }));
  A.add('washer_fluid_reservoir', roundedBox(0.2, 0.2, 0.12, 0.03, { at: at(0.3, 0.84, -0.7) }));
  A.add('firewall', box(0.03, 0.62, 1.6, { at: at(1.5, 0.92, 0) }));
  A.add('cowl_top_vent', box(0.14, 0.02, 1.4, { at: at(1.48, 1.2, 0) }));
  // Service items that need the bonnet open.
  const req = [{ id: 'hood', state: true, reason: 'Open the bonnet first.' }];
  const dp = A.pivot('tbx_pivot_oil_dipstick', at(0.72, 1.08, 0.3));
  A.add('oil_dipstick', merge([cylinder(0.006, 0.006, 0.34, { seg: 6, at: at(0.72, 0.92, 0.3) }), torus(0.02, 0.005, { axis: 'x', seg: 10, tubeSeg: 4, at: at(0.72, 1.1, 0.3) })]), dp);
  art.push({ id: 'oil_dipstick', label: 'Engine oil dipstick', group: 'Engine bay', actions: { on: 'Pull dipstick', off: 'Reinsert dipstick' }, components: ['oil_dipstick', 'engine_block'], requires: req, transforms: [{ node: dp.name, translate: [0, 0.3, 0] }] });
  const fc = A.pivot('tbx_pivot_oil_filler_cap', at(0.8, 1.09, -0.28));
  A.add('oil_filler_cap', cylinder(0.03, 0.03, 0.03, { seg: 14, at: at(0.8, 1.09, -0.28) }), fc);
  art.push({ id: 'oil_filler_cap', label: 'Oil filler cap', group: 'Engine bay', actions: { on: 'Remove filler cap', off: 'Refit filler cap' }, components: ['oil_filler_cap', 'valve_cover_left', 'valve_cover_right'], requires: req, transforms: [{ node: fc.name, translate: [0, 0.12, 0] }] });
  const rc = A.pivot('tbx_pivot_radiator_cap', at(0.3, 1.1, 0.1));
  A.add('radiator_cap', cylinder(0.028, 0.028, 0.02, { seg: 14, at: at(0.3, 1.1, 0.1) }), rc);
  art.push({ id: 'radiator_cap', label: 'Radiator cap', group: 'Engine bay', actions: { on: 'Remove cap (engine cold)', off: 'Refit cap' }, components: ['radiator_cap', 'radiator'], requires: req, transforms: [{ node: rc.name, translate: [0, 0.1, 0] }] });
}

/* ------------------------------------------------------------ INTERIOR -- */

function buildInterior(ctx) {
  const { A, B, art } = ctx;
  const floorY = 0.66, dU = 1.95, w = 0.8;
  A.add('floor_pan', merge([box(3.2, 0.02, 1.2, { at: at(3.0, 0.6, 0) }), ...[-1, 1].map(s => box(1.8, 0.02, 0.26, { at: at(2.3, 0.6, 0.73 * s) })), box(0.02, 0.5, 1.7, { at: at(1.4, 0.85, 0) })]));
  A.add('floor_carpet', box(1.55, 0.02, 1.62, { at: at(2.43, floorY, 0) }));
  A.add('cargo_area_floor', box(1.35, 0.02, 1.4, { at: at(3.95, 0.84, 0) }));
  A.add('instrument_panel_upper', merge([roundedBox(0.34, 0.12, 2 * w, 0.04, { at: at(dU - 0.1, 1.18, 0) })]));
  A.add('instrument_panel_lower', roundedBox(0.24, 0.34, 2 * w - 0.06, 0.04, { at: at(dU - 0.02, 0.94, 0) }));
  A.add('instrument_cluster', merge([roundedBox(0.12, 0.13, 0.42, 0.04, { at: at(dU + 0.02, 1.2, -0.38) }), ...[-0.48, -0.28].map(z => cylinder(0.06, 0.06, 0.01, { axis: 'x', seg: 22, at: at(dU + 0.085, 1.18, z) }))]));
  A.add('center_stack', roundedBox(0.06, 0.4, 0.3, 0.02, { at: at(dU + 0.1, 1.0, 0) }));
  A.add('audio_display', box(0.012, 0.13, 0.2, { at: at(dU + 0.135, 1.12, 0) }));
  A.add('climate_controls', merge([box(0.012, 0.08, 0.26, { at: at(dU + 0.135, 0.94, 0) }), ...[-1, 1].map(s => cylinder(0.022, 0.022, 0.02, { axis: 'x', seg: 14, at: at(dU + 0.14, 0.94, 0.09 * s) }))]));
  A.add('air_vents', merge([[-0.1, 1.08], [0.1, 1.08], [-w + 0.12, 1.12], [w - 0.12, 1.12]].map(([z, y]) => box(0.02, 0.05, 0.08, { at: at(dU + 0.13, y, z) }))));
  const gb = A.pivot('tbx_pivot_glovebox', at(dU + 0.1, 0.84, 0.45));
  A.add('glovebox', box(0.02, 0.17, 0.4, { at: at(dU + 0.11, 0.93, 0.45) }), gb);
  art.push({ id: 'glovebox', label: 'Glovebox', group: 'Cabin', actions: { on: 'Open glovebox', off: 'Close glovebox' }, components: ['glovebox', 'instrument_panel_lower'], transforms: [{ node: gb.name, rotate: { axis: [0, 0, 1], degrees: -60 } }] });
  A.add('airbag_passenger_front', box(0.2, 0.01, 0.32, { at: at(dU - 0.1, 1.245, 0.4) }));
  // Steering column (tilt) and wheel with the driver's airbag.
  const tilt = deg(24), sc = at(dU + 0.34, 1.2, -0.38);
  A.add('steering_column', tube([sc, at(dU - 0.1, 0.98, -0.38)], 0.03, { radial: 10 }));
  const sw = A.pivot('tbx_pivot_steering_wheel', sc);
  const wheel = merge([torus(0.19, 0.017, { seg: 40, tubeSeg: 8 }), cylinder(0.075, 0.08, 0.06, { axis: 'z', seg: 20, at: [0, 0, 0.02] }), box(0.26, 0.03, 0.02, { at: [-0.16, -0.01, 0.01] }), box(0.26, 0.03, 0.02, { at: [0.16, -0.01, 0.01] }), box(0.03, 0.12, 0.02, { at: [0, -0.12, 0.01] })]);
  const orient = g => place(place(g, { rot: [0, deg(-90), -tilt], order: 'ZYX' }), { at: sc });
  A.add('steering_wheel', orient(wheel), sw);
  A.add('airbag_driver_front', orient(cylinder(0.07, 0.07, 0.012, { axis: 'z', seg: 20, at: [0, 0, 0.058] })), sw);
  A.add('pedals', merge([roundedBox(0.03, 0.08, 0.12, 0.01, { rot: [0, 0, deg(-20)], at: at(1.72, 0.76, -0.4) }), roundedBox(0.02, 0.15, 0.07, 0.01, { rot: [0, 0, deg(-30)], at: at(1.74, 0.74, -0.25) })]));
  // Centre console with the gear selector and the 4WD controls, armrest storage.
  A.add('center_console', roundedBox(0.95, 0.26, 0.26, 0.04, { at: at(2.55, 0.86, 0) }));
  A.add('gear_selector', merge([box(0.18, 0.02, 0.12, { at: at(2.25, 1.0, 0) }), tube([at(2.25, 1.0, -0.02), at(2.22, 1.12, -0.02)], 0.01, { radial: 6 }), sphere(0.03, { at: at(2.215, 1.14, -0.02), scale: [1, 1.3, 1] })]));
  A.add('four_wheel_drive_controls', merge([box(0.05, 0.02, 0.04, { at: at(2.38, 1.0, 0.06) }), box(0.05, 0.02, 0.04, { at: at(2.44, 1.0, 0.06) })]));
  const cl = A.pivot('tbx_pivot_console_lid', at(3.0, 1.0, 0));
  A.add('console_armrest_lid', roundedBox(0.3, 0.04, 0.22, 0.02, { at: at(2.86, 1.0, 0) }), cl);
  art.push({ id: 'console_lid', label: 'Centre console lid', group: 'Cabin', actions: { on: 'Open console storage', off: 'Close console lid' }, components: ['console_armrest_lid', 'center_console'], transforms: [{ node: cl.name, rotate: { axis: [0, 0, 1], degrees: 95 } }] });
  // Front seats (slide), second-row 60/40 bench and fold-away third row.
  for (const { key, s, label } of SIDES) {
    const zc = 0.4 * s, fu = 2.72;
    const slide = A.pivot(`tbx_pivot_seat_front_${key}`, at(fu, 0.72, zc));
    A.add(`seat_cushion_front_${key}`, merge([roundedBox(0.52, 0.12, 0.52, 0.04, { at: at(fu - 0.02, 0.92, zc) }), box(0.36, 0.2, 0.4, { at: at(fu, 0.78, zc) })]), slide);
    const lean = g => { g.translate(-X(fu + 0.22), -0.96, 0); place(g, { rot: [0, 0, deg(20)] }); g.translate(X(fu + 0.22), 0.96, 0); return g; };
    A.add(`seat_back_front_${key}`, lean(roundedBox(0.13, 0.66, 0.52, 0.05, { at: at(fu + 0.27, 1.3, zc) })), slide);
    A.add(`headrest_front_${key}`, lean(roundedBox(0.1, 0.18, 0.28, 0.04, { at: at(fu + 0.28, 1.74, zc) })), slide);
    A.add(`airbag_seat_side_${key}`, lean(box(0.06, 0.22, 0.02, { at: at(fu + 0.24, 1.36, zc + 0.26 * s) })), slide);
    art.push({ id: `seat_front_${key}_slide`, label: `${label} front seat position`, group: 'Seats', actions: { on: 'Slide seat forward', off: 'Slide seat back' }, components: [`seat_cushion_front_${key}`, `seat_back_front_${key}`], transforms: [{ node: slide.name, translate: [0.14, 0, 0] }], duration: 1100 });
  }
  const r2 = 3.46;
  for (const [id, z0, z1] of [['second_row_seat_60', -0.72, 0.2], ['second_row_seat_40', 0.21, 0.72]]) {
    const zc = (z0 + z1) / 2, wd = z1 - z0;
    A.add(id, merge([roundedBox(0.5, 0.13, wd, 0.04, { at: at(r2, 0.94, zc) }), roundedBox(0.12, 0.62, wd, 0.04, { rot: [0, 0, deg(22)], at: at(r2 + 0.28, 1.28, zc) }), roundedBox(0.09, 0.14, 0.24, 0.035, { at: at(r2 + 0.36, 1.66, zc) })]));
  }
  const r3 = 4.2, h3 = A.pivot('tbx_pivot_third_row_seat', at(r3 - 0.25, 0.86, 0));
  A.add('third_row_seat', merge([roundedBox(0.42, 0.1, 1.3, 0.04, { at: at(r3, 0.98, 0) }), roundedBox(0.1, 0.5, 1.3, 0.04, { rot: [0, 0, deg(15)], at: at(r3 + 0.22, 1.26, 0) })]), h3);
  art.push({ id: 'third_row_seat', label: 'Third-row seat', group: 'Seats', actions: { on: 'Fold third row away', off: 'Raise third row' }, components: ['third_row_seat', 'cargo_area_floor'], transforms: [{ node: h3.name, rotate: { axis: [0, 0, 1], degrees: 80 } }], duration: 1500 });
  A.add('seat_belts', merge(SIDES.map(({ s }) => tube([at(2.95, 1.62, 0.72 * s), at(2.75, 1.2, 0.3 * s), at(2.6, 0.95, 0.62 * s)], 0.012, { radial: 4 }))));
  for (const { key, s } of SIDES) {
    A.add(`airbag_curtain_${key}`, tube([at(2.0, 1.72, 0.72 * s), at(3.2, 1.76, 0.74 * s), at(4.45, 1.72, 0.72 * s)], 0.02, { radial: 6 }));
    A.add(`sun_visor_${key}`, box(0.17, 0.018, 0.36, { at: at(2.32, 1.78, 0.34 * s) }));
  }
  A.add('rearview_mirror', roundedBox(0.03, 0.07, 0.25, 0.02, { at: at(2.2, 1.66, 0) }));
  A.add('overhead_console', roundedBox(0.3, 0.04, 0.22, 0.02, { at: at(2.4, 1.8, 0) }));
  A.add('headliner', box(2.3, 0.01, 1.4, { at: at(3.4, 1.82, 0) }));
  void B;
}

function buildFuelAndSpare(ctx) {
  const { A, art, fuelDoor } = ctx;
  A.add('fuel_tank', roundedBox(0.6, 0.24, 0.3, 0.05, { at: at(3.15, 0.45, -0.23) }));
  A.add('fuel_filler_neck', tube([[fuelDoor[0], fuelDoor[1], fuelDoor[2] + 0.06], at(4.1, 0.8, -0.7), at(3.5, 0.52, -0.42)], 0.025, { radial: 8 }));
  A.add('fuel_filler_cap', cylinder(0.03, 0.03, 0.03, { axis: 'z', seg: 12, at: [fuelDoor[0] - 0.08, fuelDoor[1], fuelDoor[2] + 0.04] }));
  A.add('evap_canister', cylinder(0.07, 0.07, 0.25, { axis: 'x', seg: 12, at: at(3.8, 0.48, -0.55) }));
  // Full-size spare carried under the rear floor on a winch.
  const sp = A.pivot('tbx_pivot_spare_tyre', at(4.3, 0.42, 0));
  const tyre = tyreGeometry(GX470); place(tyre, { rot: [Math.PI / 2, 0, 0], at: at(4.3, 0.42, 0) });
  A.add('spare_tyre', tyre, sp);
  A.add('spare_tyre_carrier', merge([box(0.05, 0.25, 0.05, { at: at(4.3, 0.62, 0) }), cylinder(0.05, 0.05, 0.08, { axis: 'z', seg: 12, at: at(4.3, 0.76, 0) })]));
  art.push({ id: 'spare_tyre', label: 'Spare tyre', group: 'Wheels', actions: { on: 'Lower spare tyre', off: 'Raise spare tyre' }, components: ['spare_tyre', 'spare_tyre_carrier'], transforms: [{ node: sp.name, translate: [0, -0.2, 0] }], duration: 1600 });
  A.add('jack_and_tools', box(0.4, 0.12, 0.14, { at: at(4.45, 0.9, 0.6) }));
}

