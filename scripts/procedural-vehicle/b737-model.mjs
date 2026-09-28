/**
 * Procedural Boeing 737-800 (Next Generation) with blended winglets.
 *
 * Overall length, wingspan (with and without winglets), height, fuselage
 * width and height, wheelbase, main-gear track and tyre sizes follow Boeing's
 * published airport-planning figures; section shapes, the planform between
 * the published points and the placement of systems are Toolbox
 * approximations for orientation. Every moving surface, door and gear leg
 * hangs under a pivot at its hinge so the viewer can move it.
 *
 * Coordinates: metres, x = -u (u = distance behind the nose), y up from the
 * ground with the aircraft on its wheels, z to the right wing.
 */
import { merge, mirrorZ, place, box, roundedBox, cylinder, sphere, lathe, tube, torus, extrude, TAU } from './geometry.mjs';
import { Assembly } from './assembly.mjs';
import { Loft, Wing, samples, chordSamples, superSection } from './shapes.mjs';
import { liftingSurface, overlayPanels, aircraftTyre, aircraftRim, rotateAbout, mirrorPoint, sAt, SIDE_KEYS } from './aircraft-parts.mjs';

const IN = 0.0254;
const deg = d => d * Math.PI / 180;
const X = u => -u;
const at = (u, y, z) => [X(u), y, z];

export const B737 = {
  L: 39.47, spanWinglets: 35.79, spanBasic: 34.32, H: 12.55, fuselageW: 3.76, fuselageH: 4.01,
  wheelbase: 15.6, track: 5.72, noseGearU: 3.45, cabinFloorY: 2.62, deckFloorY: 2.75,
  mainTyre: { od: 44.5 * IN, width: 16.5 * IN, rim: 21 * IN }, noseTyre: { od: 27 * IN, width: 7.75 * IN, rim: 15 * IN },
  engine: { z: 4.9, y: 1.47, inletU: 10.85, r: 0.99 }
};

/* Fuselage: [u, top, bottom, half-width, superellipse exponent]. */
const FUSELAGE = [
  [0.00, 3.10, 3.08, 0.001, 2], [0.10, 3.30, 2.86, 0.28, 2], [0.40, 3.55, 2.60, 0.58, 2], [0.90, 3.80, 2.24, 0.90, 2],
  [1.50, 4.00, 1.93, 1.18, 2.05], [2.20, 4.48, 1.72, 1.46, 2.1], [2.90, 4.93, 1.58, 1.68, 2.15], [3.70, 5.28, 1.50, 1.82, 2.2],
  [4.80, 5.465, 1.455, 1.88, 2.2], [26.0, 5.465, 1.455, 1.88, 2.2], [29.0, 5.44, 1.64, 1.86, 2.15], [32.0, 5.40, 2.28, 1.62, 2.1],
  [35.0, 5.30, 3.20, 1.08, 2.0], [37.6, 5.02, 4.02, 0.52, 2.0], [39.2, 4.80, 4.42, 0.20, 2.0], [39.47, 4.76, 4.46, 0.15, 2.0]
].map(([u, top, bot, w, n]) => ({ u, yc: (top + bot) / 2, h: (top - bot) / 2, w, n }));

export function fuselageLoft() {
  return new Loft(FUSELAGE, (p, t, side) => superSection({ yc: p.yc, w: p.w, ht: p.h, hb: p.h, n: p.n }, t, side));
}

export function build737() {
  const A = new Assembly('tbx_aircraft');
  const art = [];
  const F = fuselageLoft();
  const ctx = { A, art, F };
  buildFuselage(ctx);
  buildWings(ctx);
  buildTail(ctx);
  buildEngines(ctx);
  buildGear(ctx);
  buildFlightDeck(ctx);
  buildCabin(ctx);
  buildSystems(ctx);
  buildLightsAndSensors(ctx);
  buildMotion(ctx);
  return { assembly: A, articulations: art };
}

/* ------------------------------------------------------------ FUSELAGE -- */

const RADOME_U = 1.25;
const WINDSHIELDS = [
  { id: 'windshield_no1', u0: 1.46, u1: 2.2, t0: 0.862, t1: 0.985 },
  { id: 'windshield_no2', u0: 1.6, u1: 2.36, t0: 0.735, t1: 0.848 },
  { id: 'windshield_no3', u0: 2.46, u1: 3.02, t0: 0.66, t1: 0.748 }
];

function doorList(F) {
  const d = (id, side, u0, u1, y0, y1, extra = {}) => {
    const um = (u0 + u1) / 2;
    return { id, side, u0, u1, t0: F.tAtY(um, y0, side), t1: F.tAtY(um, y1, side), y0, y1, ...extra };
  };
  const floor = B737.cabinFloorY;
  return [
    d('door_l1', -1, 4.95, 5.81, floor, floor + 1.83, { kind: 'entry' }),
    d('door_l2', -1, 30.9, 31.76, floor, floor + 1.83, { kind: 'entry' }),
    d('door_r1', 1, 5.0, 5.76, floor, floor + 1.65, { kind: 'service' }),
    d('door_r2', 1, 30.95, 31.71, floor, floor + 1.65, { kind: 'service' }),
    d('overwing_exit_left_forward', -1, 15.35, 15.86, 3.0, 3.97, { kind: 'overwing' }),
    d('overwing_exit_left_aft', -1, 16.25, 16.76, 3.0, 3.97, { kind: 'overwing' }),
    d('overwing_exit_right_forward', 1, 15.35, 15.86, 3.0, 3.97, { kind: 'overwing' }),
    d('overwing_exit_right_aft', 1, 16.25, 16.76, 3.0, 3.97, { kind: 'overwing' }),
    d('cargo_door_forward', 1, 7.55, 8.77, 1.62, 2.92, { kind: 'cargo' }),
    d('cargo_door_aft', 1, 26.85, 28.07, 1.66, 2.88, { kind: 'cargo' })
  ];
}

function sectionId(u) {
  if (u < 4.8) return 'fuselage_section_41';
  if (u < 12.4) return 'fuselage_section_43';
  if (u < 20.3) return 'fuselage_section_44';
  if (u < 30.4) return 'fuselage_section_46';
  if (u < 36.6) return 'fuselage_section_47';
  return 'fuselage_section_48';
}

function buildFuselage({ A, art, F }) {
  const doors = doorList(F);
  A.doors = doors;
  const uBreaks = [RADOME_U, 4.8, 12.4, 20.3, 30.4, 36.6, ...WINDSHIELDS.flatMap(w => [w.u0, w.u1]), ...doors.flatMap(d => [d.u0, d.u1])];
  const us = [...samples(0, 4.8, 0.09, uBreaks), ...samples(4.8, 26, 0.55, uBreaks).slice(1), ...samples(26, 39.47, 0.22, uBreaks).slice(1)];
  const radome = A.pivot('tbx_pivot_radome', at(RADOME_U, F.params(RADOME_U).yc + F.params(RADOME_U).h - 0.02, 0));
  const doorPivots = {};
  for (const d of doors) {
    // Entry and service doors swing forward on a hinge at their front edge; exits and cargo doors hinge at the top.
    const um = (d.u0 + d.u1) / 2;
    const topPt = F.point(um, d.t1, d.side), frontPt = F.point(d.u0, (d.t0 + d.t1) / 2, d.side);
    const hinge = d.kind === 'entry' || d.kind === 'service'
      ? [frontPt[0] + 0.02, frontPt[1], frontPt[2] + d.side * 0.06]
      : d.kind === 'overwing' ? [topPt[0], topPt[1], topPt[2] + d.side * 0.03] : [topPt[0], topPt[1], topPt[2] - d.side * 0.08];
    doorPivots[d.id] = A.pivot(`tbx_pivot_${d.id}`, hinge);
  }
  for (const side of [1, -1]) {
    const ts = samples(0, 1, 0.025, [...WINDSHIELDS.flatMap(w => [w.t0, w.t1]), ...doors.filter(d => d.side === side).flatMap(d => [d.t0, d.t1])]);
    const parts = F.regions({
      us, ts, side, classify: ({ u, t }) => {
        if (u < RADOME_U) return 'radome';
        for (const w of WINDSHIELDS) if (u > w.u0 && u < w.u1 && t > w.t0 && t < w.t1) return `${w.id}_${side > 0 ? 'right' : 'left'}`;
        for (const d of doors) if (d.side === side && u > d.u0 && u < d.u1 && t > d.t0 && t < d.t1) return d.id;
        return sectionId(u);
      }
    });
    for (const [id, g] of parts) {
      const parent = id === 'radome' ? radome : doorPivots[id] || A.root;
      A.add(id, g, parent);
    }
  }
  // Door-frame surrounds: the door is a plug; show its inner lining so an open door reads as a door.
  for (const d of doors) {
    const lining = F.patch(d.u0 + 0.03, d.u1 - 0.03, d.t0 + 0.004, d.t1 - 0.004, { side: d.side, offset: -0.09, nu: 3, nt: 4 });
    A.add(d.id, lining, doorPivots[d.id]);
  }
  // APU exhaust: the open end of the tail cone.
  const end = F.params(39.47);
  A.add('apu_exhaust', merge([
    lathe([[end.w * 0.95, 0.1], [end.w * 0.95, -0.02], [end.w * 0.7, -0.02], [end.w * 0.7, 0.12]], { axis: 'x', seg: 20, at: at(39.45, end.yc, 0) })
  ]));
  // Radome bulkhead and weather radar antenna behind the radome.
  const bh = F.params(RADOME_U);
  A.add('forward_pressure_bulkhead', cylinder(Math.min(bh.w, bh.h) * 0.96, Math.min(bh.w, bh.h) * 0.96, 0.03, { axis: 'x', seg: 28, at: at(RADOME_U + 0.02, bh.yc, 0) }));
  A.add('weather_radar_antenna', merge([
    cylinder(0.36, 0.36, 0.03, { axis: 'x', seg: 28, at: at(0.72, 3.05, 0) }),
    box(0.4, 0.12, 0.12, { at: at(0.98, 3.05, 0) }),
    cylinder(0.05, 0.05, 0.25, { axis: 'y', seg: 10, at: at(1.1, 3.05, 0) })
  ]));
  // Cabin windows: 20-inch pitch along both sides, skipping doors and exits.
  for (const { key, s } of SIDE_KEYS) {
    const wins = [];
    for (let u = 6.35; u < 30.4; u += 0.508) {
      if (doors.some(d => d.side === s && u > d.u0 - 0.2 && u < d.u1 + 0.2 && d.kind !== 'cargo')) continue;
      const t0 = F.tAtY(u, 3.44, s), t1 = F.tAtY(u, 3.8, s);
      wins.push(F.patch(u - 0.12, u + 0.12, t0, t1, { side: s, nu: 2, nt: 2, offset: 0.004 }));
    }
    for (const d of doors) if (d.side === s && d.kind !== 'cargo') {
      const um = (d.u0 + d.u1) / 2;
      wins.push(F.patch(um - 0.11, um + 0.11, F.tAtY(um, 3.48, s), F.tAtY(um, 3.8, s), { side: s, nu: 2, nt: 2, offset: 0.012 }));
    }
    A.add(`cabin_windows_${key}`, merge(wins));
  }
  // Wing-to-body fairing below the centre fuselage.
  const fair = new Loft([
    { u: 11.0, yc: 1.72, h: 0.2, w: 0.5, n: 2 }, { u: 12.6, yc: 1.85, h: 0.48, w: 1.2, n: 2.4 }, { u: 16.0, yc: 1.87, h: 0.56, w: 1.26, n: 2.6 },
    { u: 20.4, yc: 1.87, h: 0.52, w: 1.24, n: 2.6 }, { u: 22.4, yc: 1.78, h: 0.24, w: 0.6, n: 2 }
  ], (p, t, side) => superSection({ yc: p.yc, w: p.w, ht: p.h, hb: p.h, n: p.n }, t * 0.5, side));
  for (const side of [1, -1]) {
    const g = fair.regions({ us: samples(11.0, 22.4, 0.35), ts: samples(0, 1, 0.1), side, classify: () => 'wing_body_fairing' }).get('wing_body_fairing');
    A.add('wing_body_fairing', g);
  }
  // Electronics bay access hatch under the nose.
  A.add('ee_access_hatch', F.patch(3.85, 4.5, 0.0, 0.05, { side: 1, nu: 2, nt: 1, offset: 0.006 }));
  A.add('ee_access_hatch', F.patch(3.85, 4.5, 0.0, 0.05, { side: -1, nu: 2, nt: 1, offset: 0.006 }));
}

/* --------------------------------------------------------------- WINGS -- */

const DIHEDRAL = deg(6);
const WING_Y0 = 2.02;
const wingY = z => WING_Y0 + (z - 1.3) * Math.tan(DIHEDRAL);
const UP = [0, Math.cos(DIHEDRAL), -Math.sin(DIHEDRAL)];

export function mainWing() {
  return new Wing([
    { le: at(12.6, wingY(1.3), 1.3), chord: 6.6, t: 0.15, up: UP },
    { le: at(12.95, wingY(1.88), 1.88), chord: 6.35, t: 0.145, up: UP },
    { le: at(14.95, wingY(5.7), 5.7), chord: 4.35, t: 0.125, up: UP },
    { le: at(20.95, wingY(17.16), 17.16), chord: 1.25, t: 0.105, up: UP }
  ], { m: 0.02, p: 0.45 });
}

function wingletSurface() {
  const y0 = wingY(17.16);
  const up = a => [0, Math.cos(deg(a)), -Math.sin(deg(a))];
  return new Wing([
    { le: at(20.95, y0, 17.16), chord: 1.25, t: 0.1, up: up(6) },
    { le: at(21.2, y0 + 0.2, 17.5), chord: 1.14, t: 0.095, up: up(40) },
    { le: at(21.5, y0 + 0.62, 17.76), chord: 1.0, t: 0.09, up: up(72) },
    { le: at(22.0, y0 + 1.45, 17.835), chord: 0.8, t: 0.085, up: up(80) },
    { le: at(22.55, y0 + 2.46, 17.87), chord: 0.6, t: 0.08, up: up(82) }
  ], { m: 0.01, p: 0.4 });
}

function buildWings(ctx) {
  const { A } = ctx;
  const W = mainWing();
  ctx.W = W;
  const S = z => sAt(W, z);
  const te = [
    { id: 'flap_inboard', s0: S(1.95), s1: S(5.62), c0: 0.7 },
    { id: 'flap_outboard', s0: S(5.8), s1: S(11.9), c0: 0.72 },
    { id: 'aileron', s0: S(12.05), s1: S(15.7), c0: 0.76 }
  ];
  const spoilers = [
    [1, 2.1, 3.3], [2, 3.35, 4.45], [3, 5.85, 7.3], [4, 7.35, 8.8], [5, 8.85, 10.3], [6, 10.35, 11.8]
  ];
  const slats = [[1, 5.95, 8.75], [2, 8.8, 11.6], [3, 11.65, 14.4], [4, 14.45, 16.9]];
  const kruegers = [[1, 2.05, 3.35], [2, 3.4, 4.3]];
  const breaks = [...te.flatMap(t => [t.s0, t.s1]), S(5.7)];
  const ss = samples(0, 3, 0.08, breaks);
  const cs = chordSamples(26, te.map(t => t.c0));
  ctx.wingControls = {};
  for (const { key, s } of SIDE_KEYS) {
    const tes = te.map(t => ({ ...t, id: `${t.id}_${key}` }));
    const res = liftingSurface(A, W, { skinId: `wing_${key}`, s, te: tes, ss, cs });
    const sp = overlayPanels(A, W, spoilers.map(([n, z0, z1]) => ({ id: `spoiler_${n}_${key}`, s0: S(z0), s1: S(z1), c0: 0.56, c1: 0.7, faces: [1], hingeC: 0.56 })), { s });
    const sl = overlayPanels(A, W, slats.map(([n, z0, z1]) => ({ id: `slat_${n}_${key}`, s0: S(z0), s1: S(z1), c0: 0, c1: 0.11, faces: [1, -1], hingeC: 0.11 })), { s, offset: 0.012 });
    const kr = overlayPanels(A, W, kruegers.map(([n, z0, z1]) => ({ id: `krueger_flap_${n}_${key}`, s0: S(z0), s1: S(z1), c0: 0.015, c1: 0.1, faces: [-1], hingeC: 0.015 })), { s });
    ctx.wingControls[key] = { ...res, sp, sl, kr };
    // Blended winglet.
    const WL = wingletSurface();
    const wl = WL.regions({ ss: samples(0, 4, 0.25), cs: chordSamples(14), classify: () => 'x' }).get('x');
    const wlGeo = merge([wl, WL.rib(4, 0, 1, 10)]);
    A.add(`winglet_${key}`, s > 0 ? wlGeo : mirrorZ(wlGeo));
    // Flap track fairings ("canoes") under the trailing edge.
    const canoes = [3.2, 7.4, 10.1].map(z => {
      const c = W.point(S(z), 0.62, -1);
      return place(sphere(0.16, { seg: 10, scale: [9, 1.05, 1] }), { at: [c[0] - 0.6, c[1] - 0.14, c[2]] });
    });
    A.add(`flap_track_fairings_${key}`, s > 0 ? merge(canoes) : mirrorZ(merge(canoes)));
  }
  // Structure and fuel inside the wing (seen in X-Ray).
  const box3 = (s0, s1, c0, c1, inset) => {
    const g = W.regions({ ss: samples(s0, s1, 0.2), cs: samples(c0, c1, (c1 - c0) / 4), classify: () => 'x', offset: -inset }).get('x');
    return merge([g, W.chordFace(s0, s1, c0, 6), W.chordFace(s0, s1, c1, 6), W.rib(s0, c0, c1, 6), W.rib(s1, c0, c1, 6)]);
  };
  for (const { key, s } of SIDE_KEYS) {
    const h = g => (s > 0 ? g : mirrorZ(g));
    A.add(`fuel_tank_main_${key}`, h(box3(S(2.0), S(13.7), 0.16, 0.6, 0.03)));
    A.add(`fuel_surge_tank_${key}`, h(box3(S(13.9), S(15.2), 0.18, 0.55, 0.03)));
    A.add(`wing_spars_${key}`, h(merge([W.chordFace(0.02, 2.98, 0.14, 24), W.chordFace(0.02, 2.98, 0.62, 24)])));
  }
  const cb = box3(0, S(1.95), 0.16, 0.6, 0.03);
  A.add('fuel_tank_center', merge([cb, mirrorZ(cb), box(4.1, 0.75, 2.65, { at: at(15.05, 2.03, 0) })]));
  A.add('wing_center_box', merge([box(0.08, 0.95, 2.7, { at: at(13.72, 2.03, 0) }), box(0.08, 0.95, 2.7, { at: at(16.6, 2.03, 0) })]));
}

/* ---------------------------------------------------------------- TAIL -- */

function buildTail(ctx) {
  const { A } = ctx;
  // Horizontal stabiliser: 14.35 m span, trimmable about a pivot near its rear spar.
  const stabUp = [0, Math.cos(deg(7)), -Math.sin(deg(7))];
  const sy = z => 4.12 + (z - 1.0) * Math.tan(deg(7));
  const HS = new Wing([
    { le: at(33.05, sy(1.0), 1.0), chord: 3.85, t: 0.1, up: stabUp },
    { le: at(33.75, sy(2.0), 2.0), chord: 3.3, t: 0.095, up: stabUp },
    { le: at(37.05, sy(7.175), 7.175), chord: 1.2, t: 0.085, up: stabUp }
  ], { m: 0 });
  ctx.HS = HS;
  const stab = A.pivot('tbx_pivot_horizontal_stabilizer', at(35.6, 4.12, 0));
  ctx.stabPivot = stab;
  const S = z => sAt(HS, z);
  const te = [{ id: 'elevator', s0: S(1.15), s1: S(7.0), c0: 0.7 }];
  ctx.elev = {};
  for (const { key, s } of SIDE_KEYS) {
    const r = liftingSurface(A, HS, { skinId: `horizontal_stabilizer_${key}`, s, te: te.map(t => ({ ...t, id: `elevator_${key}`, parent: stab })), parent: stab, ss: samples(0, 2, 0.1, te.flatMap(t => [t.s0, t.s1])), cs: chordSamples(18, [0.7]) });
    ctx.elev[key] = r;
  }
  A.add('stabilizer_jackscrew', cylinder(0.05, 0.05, 1.1, { axis: 'y', seg: 10, at: at(33.9, 3.75, 0) }));
  // Vertical fin with its dorsal fillet, and the rudder.
  const FIN = new Wing([
    { le: at(29.2, 5.25, 0), chord: 7.3, t: 0.1, up: [0, 0, 1] },
    { le: at(30.9, 5.95, 0), chord: 5.6, t: 0.1, up: [0, 0, 1] },
    { le: at(35.35, 12.55, 0), chord: 1.95, t: 0.09, up: [0, 0, 1] }
  ], { m: 0 });
  ctx.FIN = FIN;
  const SF = y => sAt(FIN, y, 1);
  const rud = [{ id: 'rudder', s0: SF(5.75), s1: SF(12.35), c0: 0.7 }];
  ctx.rudder = liftingSurface(A, FIN, { skinId: 'vertical_fin', s: 0, te: rud, ss: samples(0, 2, 0.08, [rud[0].s0, rud[0].s1]), cs: chordSamples(18, [0.7]), prefer: 1, capRoot: false });
  // Elevator feel pitot probes on the fin.
  A.add('elevator_feel_pitots', merge([-1, 1].map(s => cylinder(0.012, 0.012, 0.22, { axis: 'x', seg: 6, at: at(33.4, 9.0, 0.09 * s) }))));
}

/* ------------------------------------------------------------- ENGINES -- */

function nacelleLoft() {
  // Local u runs aft from the inlet lip; the lower lip is flattened for ground clearance.
  return new Loft([
    { u: 0, r: 0.86, fl: 0.9 }, { u: 0.25, r: 0.97, fl: 0.9 }, { u: 1.0, r: 1.0, fl: 0.93 }, { u: 2.2, r: 0.98, fl: 0.96 }, { u: 3.3, r: 0.85, fl: 1 }
  ], (p, t, side) => {
    const th = -Math.PI / 2 + t * Math.PI, sn = Math.sin(th);
    return [sn * p.r * (sn < 0 ? p.fl : 1), side * Math.cos(th) * p.r];
  });
}

function buildEngines(ctx) {
  const { A, W } = ctx;
  const E = B737.engine;
  const N = nacelleLoft();
  ctx.engines = {};
  for (const { key, s } of SIDE_KEYS) {
    // key names the engine: left = No. 1, right = No. 2.
    const cz = E.z * s, u0 = E.inletU;
    const shift = g => { g.translate(-u0, E.y, cz); return g; };  // local nacelle frame → aircraft
    const reg = (a, b, side) => shift(N.regions({ us: samples(a, b, 0.12), ts: samples(0, 1, 0.05), side, classify: () => 'x' }).get('x'));
    A.add(`engine_inlet_cowl_${key}`, merge([reg(0, 1.05, 1), reg(0, 1.05, -1),
      lathe([[0.86, 0.0], [0.8, -0.08], [0.78, -0.3], [0.775, -0.95]], { axis: 'x', seg: 36, at: at(u0, E.y, cz) })]));
    const cowlHinge = at(u0 + 1.5, E.y + 0.99, cz);
    const cowlOut = A.pivot(`tbx_pivot_fan_cowl_${key}_outboard`, cowlHinge), cowlIn = A.pivot(`tbx_pivot_fan_cowl_${key}_inboard`, cowlHinge);
    A.add(`engine_fan_cowl_${key}`, reg(1.05, 2.0, s), cowlOut);
    A.add(`engine_fan_cowl_${key}`, reg(1.05, 2.0, -s), cowlIn);
    const trOut = A.pivot(`tbx_pivot_thrust_reverser_${key}_outboard`, at(u0 + 2.6, E.y, cz + 0.6 * s)), trIn = A.pivot(`tbx_pivot_thrust_reverser_${key}_inboard`, at(u0 + 2.6, E.y, cz - 0.6 * s));
    A.add(`thrust_reverser_${key}`, reg(2.0, 3.3, s), trOut);
    A.add(`thrust_reverser_${key}`, reg(2.0, 3.3, -s), trIn);
    // Cascade vanes exposed when the sleeves slide aft.
    A.add(`thrust_reverser_cascades_${key}`, lathe([[0.9, 0], [0.9, -0.55]], { axis: 'x', seg: 30, at: at(u0 + 2.0, E.y, cz) }));
    // Fan, spinner, core, nozzle and plug.
    A.add(`engine_fan_${key}`, merge([
      lathe([[0.001, 0.3], [0.1, 0.22], [0.22, 0.05], [0.25, -0.05]], { axis: 'x', seg: 20, at: at(u0 + 0.95, E.y, cz) }),
      ...Array.from({ length: 24 }, (_, i) => {
        const a = i / 24 * TAU;
        return place(box(0.1, 0.5, 0.02), { rot: [a, deg(18), 0], order: 'XYZ', at: at(u0 + 1.0, E.y + Math.cos(a) * 0.5, cz + Math.sin(a) * 0.5) });
      })
    ]));
    A.add(`engine_core_${key}`, merge([
      cylinder(0.5, 0.45, 2.4, { axis: 'x', seg: 20, at: at(u0 + 2.3, E.y, cz) }),
      cylinder(0.3, 0.3, 0.5, { axis: 'x', seg: 14, at: at(u0 + 3.7, E.y, cz) })
    ]));
    A.add(`engine_core_cowl_${key}`, lathe([[0.62, 0], [0.6, -0.4], [0.52, -0.9], [0.44, -1.15]], { axis: 'x', seg: 28, at: at(u0 + 3.25, E.y, cz) }));
    A.add(`engine_exhaust_nozzle_${key}`, lathe([[0.44, 0], [0.4, -0.25], [0.36, -0.3]], { axis: 'x', seg: 24, at: at(u0 + 4.4, E.y, cz) }));
    A.add(`engine_exhaust_plug_${key}`, lathe([[0.3, 0], [0.28, -0.25], [0.12, -0.6], [0.001, -0.7]], { axis: 'x', seg: 20, at: at(u0 + 4.45, E.y, cz) }));
    A.add(`engine_accessory_gearbox_${key}`, roundedBox(0.7, 0.22, 0.3, 0.05, { at: at(u0 + 1.6, E.y - 0.62, cz - 0.52 * s) }));
    A.add(`engine_oil_tank_${key}`, cylinder(0.11, 0.11, 0.4, { axis: 'x', seg: 12, at: at(u0 + 1.4, E.y - 0.15, cz + 0.82 * s) }));
    // Pylon (strut) from the nacelle to the wing's front spar.
    const sE = sAt(W, E.z), le = W.point(sE, 0, 1), lower = c => W.point(sE, c, -1);
    const uLE = -le[0];
    const pylon = [[u0 + 0.9, E.y + 0.96], [u0 + 1.3, E.y + 1.1], [uLE - 0.15, le[1] + 0.12], [uLE + 1.3, lower(0.26)[1] - 0.02], [u0 + 4.5, E.y + 0.52], [u0 + 3.3, E.y + 0.84]].map(([u, y]) => [X(u), y]);
    A.add(`engine_pylon_${key}`, extrude(pylon, 0.34, { at: [0, 0, cz] }));
    ctx.engines[key] = { cowlOut, cowlIn, trOut, trIn, s };
  }
}

/* ---------------------------------------------------------------- GEAR -- */

function buildGear(ctx) {
  const { A, F } = ctx;
  const M = B737.mainTyre, Nt = B737.noseTyre;
  const mainU = B737.noseGearU + B737.wheelbase, trunnionY = 1.95, axleY = M.od / 2;
  ctx.gear = {};
  for (const { key, s } of SIDE_KEYS) {
    const z = (B737.track / 2) * s;
    const pivot = A.pivot(`tbx_pivot_main_gear_${key}`, at(mainU, trunnionY, z));
    const len = trunnionY - axleY;
    A.add(`main_gear_shock_strut_${key}`, merge([
      cylinder(0.12, 0.12, len * 0.62, { axis: 'y', seg: 14, at: at(mainU, trunnionY - len * 0.31, z) }),
      cylinder(0.085, 0.085, len * 0.5, { axis: 'y', seg: 12, at: at(mainU, axleY + len * 0.25, z) }),
      cylinder(0.07, 0.07, 0.95, { axis: 'z', seg: 12, at: at(mainU, axleY, z) }),
      box(0.35, 0.12, 0.5, { at: at(mainU, trunnionY, z) })
    ]), pivot);
    A.add(`main_gear_torsion_links_${key}`, merge([
      tube([at(mainU - 0.16, trunnionY - len * 0.55, z), at(mainU - 0.3, trunnionY - len * 0.72, z), at(mainU - 0.14, axleY + 0.22, z)], 0.025, { radial: 6 })
    ]), pivot);
    A.add(`main_gear_side_brace_${key}`, tube([at(mainU, trunnionY - len * 0.45, z), at(mainU - 0.1, trunnionY + 0.05, z - 0.95 * s)], 0.05, { radial: 8 }), pivot);
    A.add(`main_gear_strut_door_${key}`, box(0.7, len * 0.7, 0.02, { at: at(mainU, trunnionY - len * 0.4, z + 0.16 * s) }), pivot);
    for (const [n, dz] of [['outboard', 0.42], ['inboard', -0.42]]) {
      const c = at(mainU, axleY, z + dz * s);
      const tyre = aircraftTyre(M.od, M.width, M.rim); tyre.translate(...c);
      const rim = aircraftRim(M.rim, M.width); rim.translate(...c);
      const brake = cylinder(M.rim * 0.42, M.rim * 0.42, M.width * 0.8, { axis: 'z', seg: 18, at: c });
      A.add(`main_tyre_${n}_${key}`, tyre, pivot);
      A.add(`main_wheel_${n}_${key}`, rim, pivot);
      A.add(`main_wheel_brake_${n}_${key}`, brake, pivot);
    }
    ctx.gear[key] = pivot;
  }
  A.add('main_wheel_well', merge([box(2.0, 0.06, 2.9, { at: at(mainU + 0.1, 2.42, 0) }), box(0.06, 0.7, 2.4, { at: at(mainU - 0.9, 2.05, 0) }), box(0.06, 0.7, 2.4, { at: at(mainU + 1.1, 2.05, 0) })]));
  // Nose gear: two wheels, retracts forward into the well under the flight deck.
  const nu = B737.noseGearU, topY = 1.92, nAxle = Nt.od / 2;
  const np = A.pivot('tbx_pivot_nose_gear', at(nu, topY, 0));
  const nl = topY - nAxle;
  A.add('nose_gear_shock_strut', merge([
    cylinder(0.085, 0.085, nl * 0.6, { axis: 'y', seg: 12, at: at(nu, topY - nl * 0.3, 0) }),
    cylinder(0.06, 0.06, nl * 0.5, { axis: 'y', seg: 10, at: at(nu, nAxle + nl * 0.25, 0) }),
    cylinder(0.045, 0.045, 0.52, { axis: 'z', seg: 10, at: at(nu, nAxle, 0) })
  ]), np);
  A.add('nose_gear_drag_brace', tube([at(nu, topY - nl * 0.45, 0), at(nu - 0.9, topY + 0.05, 0)], 0.035, { radial: 6 }), np);
  A.add('nose_gear_steering', cylinder(0.12, 0.12, 0.12, { axis: 'y', seg: 14, at: at(nu, topY - nl * 0.62, 0) }), np);
  for (const [n, dz] of [['right', 0.2], ['left', -0.2]]) {
    const c = at(nu, nAxle, dz);
    const tyre = aircraftTyre(Nt.od, Nt.width, Nt.rim); tyre.translate(...c);
    const rim = aircraftRim(Nt.rim, Nt.width, 0.05); rim.translate(...c);
    A.add(`nose_tyre_${n}`, tyre, np);
    A.add(`nose_wheel_${n}`, rim, np);
  }
  A.add('taxi_light', merge([cylinder(0.06, 0.06, 0.08, { axis: 'x', seg: 12, at: at(nu - 0.09, topY - nl * 0.52, 0) })]), np);
  ctx.nosePivot = np;
  // Nose gear doors hang open with the gear down and close as it retracts.
  ctx.noseDoors = [];
  for (const { key, s } of SIDE_KEYS) {
    const hz = 0.42 * s, hy = F.params(2.7).yc - F.params(2.7).h + 0.06;
    const dp = A.pivot(`tbx_pivot_nose_gear_door_${key}`, at(2.65, hy, hz));
    const door = box(1.45, 0.02, 0.4, { at: at(2.65, hy - 0.01, hz - 0.2 * s) });
    rotateAbout(door, at(2.65, hy, hz), [1, 0, 0], deg(-80) * s);
    A.add(`nose_gear_door_${key}`, door, dp);
    ctx.noseDoors.push({ key, s, dp });
  }
}

/* ---------------------------------------------------------- FLIGHT DECK -- */

function buildFlightDeck(ctx) {
  const { A, F } = ctx;
  const fy = B737.deckFloorY;
  const half = u => { const p = F.params(u); const k = Math.abs((fy - p.yc) / p.h); return p.w * Math.pow(Math.max(0, 1 - Math.pow(k, p.n)), 1 / p.n); };
  A.add('flight_deck_floor', box(2.45, 0.04, 2 * half(2.6) - 0.1, { at: at(2.65, fy - 0.02, 0) }));
  // Main instrument panel with six display units, tilted back.
  const tilt = deg(12);
  const panel = roundedBox(0.1, 0.72, 1.9, 0.02, { rot: [0, 0, -tilt], at: at(2.12, 3.42, 0) });
  A.add('main_instrument_panel', panel);
  const du = (z, y) => box(0.02, 0.2, 0.2, { rot: [0, 0, -tilt], at: at(2.2, y, z) });
  A.add('display_units_captain', merge([du(-0.78, 3.5), du(-0.52, 3.5)]));
  A.add('display_units_first_officer', merge([du(0.52, 3.5), du(0.78, 3.5)]));
  A.add('display_units_center', merge([du(0, 3.56), du(0, 3.3)]));
  A.add('standby_flight_display', box(0.02, 0.09, 0.09, { rot: [0, 0, -tilt], at: at(2.2, 3.62, -0.24) }));
  A.add('landing_gear_lever', merge([
    box(0.03, 0.2, 0.08, { at: at(2.21, 3.26, 0.28) }),
    cylinder(0.035, 0.035, 0.05, { axis: 'z', seg: 12, at: at(2.25, 3.36, 0.28) })
  ]));
  A.add('autobrake_selector', cylinder(0.025, 0.025, 0.03, { axis: 'x', seg: 12, at: at(2.21, 3.18, 0.2) }));
  // Glareshield with the mode control panel, EFIS panels and warning lights.
  A.add('glareshield', roundedBox(0.3, 0.08, 1.95, 0.03, { at: at(2.06, 3.82, 0) }));
  A.add('mode_control_panel', box(0.04, 0.09, 0.9, { at: at(2.22, 3.8, 0) }));
  A.add('efis_control_panels', merge([box(0.04, 0.09, 0.22, { at: at(2.22, 3.8, -0.65) }), box(0.04, 0.09, 0.22, { at: at(2.22, 3.8, 0.65) })]));
  A.add('master_caution_lights', merge([-1, 1].map(s => box(0.04, 0.07, 0.1, { at: at(2.22, 3.8, 0.86 * s) }))));
  // Overhead panel, sloping with the roof.
  A.add('overhead_panel', roundedBox(0.95, 0.06, 0.95, 0.02, { rot: [0, 0, deg(-8)], at: at(2.95, 4.62, 0) }));
  A.add('forward_overhead_panel', box(0.25, 0.05, 0.9, { rot: [0, 0, deg(-40)], at: at(2.38, 4.42, 0) }));
  // Control stand (throttle quadrant) and the aft electronics pedestal.
  A.add('control_stand', merge([box(0.62, 0.45, 0.44, { at: at(2.62, fy + 0.225, 0) }), box(0.62, 0.12, 0.44, { rot: [0, 0, deg(-15)], at: at(2.62, fy + 0.5, 0) })]));
  const tl = A.pivot('tbx_pivot_thrust_levers', at(2.72, fy + 0.52, 0));
  A.add('thrust_levers', merge([-1, 1].map(s => merge([box(0.03, 0.26, 0.03, { rot: [0, 0, deg(-25)], at: at(2.66, fy + 0.66, 0.05 * s) }), box(0.05, 0.03, 0.09, { at: at(2.6, fy + 0.78, 0.05 * s) })]))), tl);
  A.add('flap_lever', merge([box(0.02, 0.2, 0.02, { at: at(2.7, fy + 0.62, 0.18) }), box(0.06, 0.04, 0.05, { at: at(2.7, fy + 0.72, 0.18) })]));
  A.add('speed_brake_lever', merge([box(0.02, 0.2, 0.02, { at: at(2.72, fy + 0.62, -0.18) }), box(0.07, 0.03, 0.04, { at: at(2.72, fy + 0.72, -0.18) })]));
  A.add('stabilizer_trim_wheels', merge([-1, 1].map(s => cylinder(0.14, 0.14, 0.03, { axis: 'z', seg: 22, at: at(2.72, fy + 0.3, 0.24 * s) }))));
  A.add('start_levers', merge([-1, 1].map(s => box(0.02, 0.1, 0.02, { at: at(2.88, fy + 0.58, 0.05 * s) }))));
  A.add('parking_brake_lever', box(0.08, 0.02, 0.03, { at: at(2.45, fy + 0.55, -0.15) }));
  A.add('aft_electronic_panel', box(0.5, 0.38, 0.44, { at: at(3.18, fy + 0.19, 0) }));
  A.add('engine_fire_handles', merge([-1, 0, 1].map(k => box(0.06, 0.03, 0.05, { at: at(3.05, fy + 0.4, 0.12 * k) }))));
  // Control columns and wheels; the wheel turns on its column, the column pivots at the floor.
  ctx.columns = {};
  for (const [key, z] of [['captain', -0.55], ['first_officer', 0.55]]) {
    const cp = A.pivot(`tbx_pivot_control_column_${key}`, at(2.52, fy + 0.05, z));
    A.add(`control_column_${key}`, merge([box(0.08, 0.62, 0.08, { at: at(2.52, fy + 0.34, z) }), box(0.12, 0.08, 0.14, { at: at(2.52, fy + 0.05, z) })]), cp);
    const wp = A.pivot(`tbx_pivot_control_wheel_${key}`, at(2.58, fy + 0.68, z), cp);
    const wheel = merge([
      torus(0.17, 0.018, { axis: 'x', arc: deg(200), rot: [deg(-10), 0, 0], seg: 20, tubeSeg: 6, at: at(2.58, fy + 0.68, z) }),
      box(0.03, 0.03, 0.34, { at: at(2.58, fy + 0.68, z) }),
      box(0.04, 0.1, 0.05, { at: at(2.58, fy + 0.66, z) })
    ]);
    rotateAbout(wheel, at(2.58, fy + 0.68, z), [1, 0, 0], deg(170));
    A.add(`control_wheel_${key}`, wheel, wp);
    const pp = A.pivot(`tbx_pivot_rudder_pedals_${key}`, at(2.3, fy + 0.12, z));
    A.add(`rudder_pedals_${key}`, merge([-1, 1].map(s => roundedBox(0.04, 0.2, 0.1, 0.01, { rot: [0, 0, deg(20)], at: at(2.25, fy + 0.18, z + 0.1 * s) }))), pp);
    ctx.columns[key] = { cp, wp, pp, z };
  }
  // Pilot seats and the observer seat.
  for (const [key, z] of [['captain', -0.55], ['first_officer', 0.55]]) {
    A.add(`pilot_seat_${key}`, merge([
      roundedBox(0.5, 0.1, 0.5, 0.03, { at: at(3.3, fy + 0.45, z) }),
      roundedBox(0.12, 0.8, 0.5, 0.04, { rot: [0, 0, deg(8)], at: at(3.55, fy + 0.9, z) }),
      box(0.3, 0.4, 0.3, { at: at(3.35, fy + 0.2, z) }),
      box(0.3, 0.05, 0.06, { at: at(3.25, fy + 0.68, z - 0.27) }), box(0.3, 0.05, 0.06, { at: at(3.25, fy + 0.68, z + 0.27) })
    ]));
    A.add(`headrest_${key}`, roundedBox(0.1, 0.18, 0.3, 0.04, { rot: [0, 0, deg(8)], at: at(3.63, fy + 1.4, z) }));
  }
  A.add('observer_seat', merge([roundedBox(0.4, 0.08, 0.45, 0.03, { at: at(3.65, fy + 0.45, -0.95 + 0.3) }), roundedBox(0.1, 0.6, 0.45, 0.03, { at: at(3.85, fy + 0.8, -0.65) })]));
  A.add('windshield_wipers', merge([-1, 1].map(s => box(0.03, 0.02, 0.5, { rot: [0, deg(20) * s, deg(-35)], at: at(1.5, 3.95, 0.3 * s) }))));
  // Flight deck door in the bulkhead.
  // Bulkhead across the section with the door opening, inset slightly from the skin.
  const bu = 3.97, bp = F.params(bu);
  const bulk = F.cap(bu, {
    zs: samples(-bp.w, bp.w, 0.15, [-0.4, 0.4]), ys: samples(fy, bp.yc + bp.h, 0.15, [fy + 2.0]),
    classify: ({ z, y }) => (Math.abs(z) < 0.4 && y < fy + 2.0 ? null : 'flight_deck_bulkhead')
  }).get('flight_deck_bulkhead');
  bulk.scale(1, 1, 0.97);
  A.add('flight_deck_bulkhead', bulk);
  const dp = A.pivot('tbx_pivot_flight_deck_door', at(3.95, fy, 0.4));
  A.add('flight_deck_door', box(0.05, 2.0, 0.78, { at: at(3.95, fy + 1.0, 0.0) }), dp);
  ctx.deckDoor = dp;
}

/* --------------------------------------------------------------- CABIN -- */

function buildCabin(ctx) {
  const { A, F } = ctx;
  const fy = B737.cabinFloorY;
  const half = (u, y) => { const p = F.params(u); const k = Math.abs((y - p.yc) / p.h); return p.w * Math.pow(Math.max(0, 1 - Math.pow(k, p.n)), 1 / p.n); };
  A.add('cabin_floor', merge(Array.from({ length: 14 }, (_, i) => { const u0 = 4.0 + i * 2, u1 = Math.min(31.8, u0 + 2); return u1 > u0 ? box(u1 - u0, 0.05, Math.max(0.3, 2 * Math.min(half(u0, fy), half(u1, fy)) - 0.06), { at: at((u0 + u1) / 2, fy - 0.025, 0) }) : null; }).filter(Boolean)));
  A.add('floor_beams', merge(Array.from({ length: 28 }, (_, i) => box(0.04, 0.12, Math.max(0.3, 2 * half(4.6 + i, fy - 0.11) - 0.1), { at: at(4.6 + i, fy - 0.11, 0) }))));
  // Seats: 16 in a 2-2 forward cabin at 38-inch pitch, 150 in 3-3 at 31-inch pitch.
  const seat = (u, z, w) => merge([
    box(0.46, 0.12, w, { at: at(u, fy + 0.42, z) }),
    box(0.1, 0.62, w, { rot: [0, 0, deg(10)], at: at(u + 0.24, fy + 0.8, z) }),
    box(0.3, 0.36, w * 0.8, { at: at(u, fy + 0.18, z) })
  ]);
  const biz = [], eco = [];
  for (let r = 0; r < 4; r++) for (const z of [-1.18, -0.62, 0.62, 1.18]) biz.push(seat(6.5 + r * 0.965, z, 0.54));
  for (let r = 0; r < 25; r++) for (const z of [-1.3, -0.84, -0.38, 0.38, 0.84, 1.3]) eco.push(seat(10.45 + r * 0.787, z, 0.44));
  A.add('passenger_seats_forward_cabin', merge(biz));
  A.add('passenger_seats_main_cabin', merge(eco));
  const bins = s => merge([
    box(24.0, 0.42, 0.55, { at: at(18.3, 4.25, 1.3 * s) }),
    box(24.0, 0.06, 0.4, { rot: [deg(-20) * s, 0, 0], at: at(18.3, 4.5, 1.05 * s) })
  ]);
  A.add('overhead_bins_left', bins(-1)); A.add('overhead_bins_right', bins(1));
  A.add('cabin_ceiling_panels', box(24.0, 0.03, 1.5, { at: at(18.3, 4.78, 0) }));
  A.add('galley_forward', box(0.85, 1.9, 1.05, { at: at(4.45, fy + 0.95, 1.0) }));
  A.add('lavatory_forward', box(0.85, 2.0, 1.0, { at: at(4.45, fy + 1.0, -1.05) }));
  A.add('lavatories_aft', merge([box(0.9, 2.0, 0.95, { at: at(30.35, fy + 1.0, -1.0) }), box(0.9, 2.0, 0.95, { at: at(30.35, fy + 1.0, 1.0) })]));
  A.add('galley_aft', box(0.95, 1.9, 2.6, { at: at(32.4, fy + 0.95, 0) }));
  const ab = F.params(33.3), abR = Math.min(ab.w, ab.h) * 0.97;
  A.add('aft_pressure_bulkhead', lathe([[0.001, 0.22], [abR * 0.55, 0.16], [abR * 0.88, 0.05], [abR, -0.02]], { axis: 'x', seg: 28, at: at(33.3, ab.yc, 0) }));
  A.add('flight_attendant_seats', merge([box(0.3, 0.5, 0.45, { at: at(5.95, fy + 0.7, -0.6) }), box(0.3, 0.5, 0.9, { at: at(32.95, fy + 0.7, 0) })]));
  // Cargo holds below the floor: forward (ahead of the wing) and aft (behind the wheel well).
  const hold = (u0, u1) => {
    const m = (u0 + u1) / 2, hf = Math.min(half(u0, 1.75), half(u1, 1.75)) - 0.08, hw = Math.min(half(u0, 1.98), half(u1, 1.98)) - 0.08;
    return merge([box(u1 - u0, 0.03, 2 * hf, { at: at(m, 1.75, 0) }), box(u1 - u0, 0.55, 0.03, { at: at(m, 2.26, -hw) }), box(u1 - u0, 0.55, 0.03, { at: at(m, 2.26, hw) })]);
  };
  A.add('cargo_hold_forward', hold(6.6, 12.3));
  A.add('cargo_hold_aft', hold(20.6, 29.8));
  A.add('keel_beam', box(7.8, 0.22, 0.2, { at: at(16.5, 1.52, 0) }));
}

/* ------------------------------------------------------------- SYSTEMS -- */

function buildSystems(ctx) {
  const { A, F } = ctx;
  A.add('electronics_equipment_bay', merge([box(1.9, 0.7, 0.5, { at: at(5.3, 2.18, -0.55) }), box(1.9, 0.7, 0.5, { at: at(5.3, 2.18, 0.55) })]));
  A.add('main_battery', box(0.28, 0.22, 0.25, { at: at(4.55, 2.2, 0.95) }));
  A.add('air_conditioning_packs', merge([-1, 1].map(s => merge([roundedBox(1.6, 0.46, 0.66, 0.08, { at: at(17.4, 1.72, 0.6 * s) }), cylinder(0.16, 0.16, 0.45, { axis: 'z', seg: 12, at: at(16.4, 1.74, 0.6 * s) })]))));
  A.add('hydraulic_reservoirs', merge([cylinder(0.16, 0.16, 0.55, { axis: 'y', seg: 14, at: at(19.6, 2.05, -0.95) }), cylinder(0.16, 0.16, 0.55, { axis: 'y', seg: 14, at: at(19.6, 2.05, 0.95) }), cylinder(0.1, 0.1, 0.35, { axis: 'y', seg: 12, at: at(20.2, 2.1, 0.35) })]));
  A.add('apu', merge([cylinder(0.3, 0.26, 1.2, { axis: 'x', seg: 16, at: at(38.0, 4.55, 0) }), box(0.5, 0.35, 0.45, { at: at(37.6, 4.4, 0) })]));
  // APU air inlet door on the right-hand side of the tail cone.
  const ip = A.pivot('tbx_pivot_apu_inlet_door', F.point(37.35, 0.72, 1));
  A.add('apu_inlet_door', F.patch(36.85, 37.35, 0.66, 0.78, { side: 1, nu: 3, nt: 2, offset: 0.012 }), ip);
  ctx.apuDoor = ip;
  const rp = ctx.W.point(sAt(ctx.W, 7.5), 0.3, -1);
  A.add('single_point_refuelling_panel', box(0.45, 0.06, 0.35, { at: [rp[0], rp[1] - 0.04, rp[2]] }));
  A.add('oxygen_cylinder', cylinder(0.11, 0.11, 0.8, { axis: 'x', seg: 12, at: at(6.0, 1.95, 1.05) }));
}


/* -------------------------------------------------- LIGHTS AND SENSORS -- */

function buildLightsAndSensors(ctx) {
  const { A, F, W } = ctx;
  const lamp = (p, r = 0.06) => sphere(r, { at: p, seg: 10 });
  for (const { key, s } of SIDE_KEYS) {
    const tip = W.point(3, 0.02, 1);
    A.add(`navigation_light_${key}`, lamp(mirrorPoint([tip[0] - 0.05, tip[1] + 0.02, tip[2] + 0.05], s), 0.07));
    A.add(`strobe_lights`, lamp(mirrorPoint([tip[0] - 1.15, tip[1] + 0.05, tip[2] + 0.05], s), 0.05));
    const root = W.point(sAt(W, 2.4), 0.0, 1);
    A.add('landing_lights', lamp(mirrorPoint([root[0] + 0.04, root[1] - 0.05, root[2]], s), 0.1));
    A.add('runway_turnoff_lights', lamp(mirrorPoint([root[0] + 0.02, root[1] - 0.05, root[2] + 0.35], s), 0.07));
    A.add('logo_lights', lamp(mirrorPoint(at(36.2, 4.62, 2.6), s), 0.05));
    A.add('wing_illumination_lights', lamp(mirrorPoint(F.point(12.8, 0.58, 1), s), 0.05));
  }
  A.add('strobe_lights', lamp(at(39.3, 4.62, 0), 0.05));
  A.add('anti_collision_beacon_upper', lamp(at(19.5, 5.49, 0), 0.08));
  A.add('anti_collision_beacon_lower', lamp(at(21.8, 1.49, 0), 0.08));
  // Pitot probes (captain, first officer, auxiliary), angle-of-attack vanes, total air temperature probe.
  const probe = (u, t, s, len = 0.2) => { const p = F.point(u, t, s); return cylinder(0.014, 0.014, len, { axis: 'x', seg: 6, at: [p[0] + len / 2, p[1], p[2] + 0.07 * s] }); };
  A.add('pitot_probes', merge([probe(2.95, 0.55, -1), probe(2.95, 0.55, 1), probe(3.1, 0.48, 1)]));
  A.add('angle_of_attack_vanes', merge([-1, 1].map(s => { const p = F.point(3.35, 0.62, s); return box(0.14, 0.1, 0.012, { at: [p[0], p[1], p[2] + 0.05 * s] }); })));
  A.add('total_air_temperature_probe', (() => { const p = F.point(3.5, 0.72, -1); return box(0.08, 0.14, 0.02, { at: [p[0], p[1], p[2] - 0.06] }); })());
  A.add('static_ports', merge([-1, 1].map(s => F.patch(5.9, 6.05, F.tAtY(6, 3.2, s), F.tAtY(6, 3.28, s), { side: s, nu: 1, nt: 1, offset: 0.005 }))));
  A.add('antennas', merge([
    box(0.4, 0.3, 0.03, { rot: [0, 0, deg(-30)], at: at(7.2, 5.6, 0) }), box(0.35, 0.25, 0.03, { rot: [0, 0, deg(-30)], at: at(24.0, 5.58, 0) }),
    box(0.4, 0.3, 0.03, { rot: [0, 0, deg(30)], at: at(13.2, 1.32, 0) }), cylinder(0.12, 0.12, 0.05, { axis: 'y', seg: 12, at: at(10.0, 5.48, 0) })
  ]));
}

/* ----------------------------------------------------------- MOVEMENT -- */

function buildMotion(ctx) {
  const { A, art, W, wingControls: WC, engines, gear, columns } = ctx;
  const ax = (key, id) => WC[key].axes[id];
  const piv = (key, id) => WC[key].pivots[id].name;
  const rot = (node, axis, degrees, extra = {}) => ({ node, rotate: { axis, degrees }, ...extra });
  // Doors.
  for (const d of A.doors) {
    const node = `tbx_pivot_${d.id}`;
    const labels = { entry: ['Passenger entry door', 'Doors'], service: ['Galley service door', 'Doors'], overwing: ['Overwing exit', 'Exits'], cargo: ['Cargo door', 'Cargo doors'] }[d.kind];
    const where = d.id.replace(/^(door|overwing_exit|cargo_door)_/, '').replace(/_/g, ' ');
    const t = d.kind === 'entry' || d.kind === 'service' ? [rot(node, [0, 1, 0], 150 * d.side)]
      : d.kind === 'overwing' ? [rot(node, [1, 0, 0], -100 * d.side)]
        : [{ node, translate: [0, 0, -0.1] }, rot(node, [1, 0, 0], 95, { delay: 0.2 })];
    art.push({ id: d.id, label: `${labels[0]} ${where.toUpperCase().length <= 2 ? where.toUpperCase() : `(${where})`}`, group: labels[1], actions: { on: d.kind === 'overwing' ? 'Open exit' : 'Open door', off: d.kind === 'overwing' ? 'Close exit' : 'Close door' }, components: [d.id], transforms: t, duration: 1500 });
  }
  art.push({ id: 'radome', label: 'Radome', group: 'Airframe', actions: { on: 'Open radome', off: 'Close radome' }, components: ['radome', 'weather_radar_antenna', 'forward_pressure_bulkhead'], transforms: [rot('tbx_pivot_radome', [0, 0, 1], 75)], duration: 1400 });
  art.push({ id: 'flight_deck_door', label: 'Flight deck door', group: 'Flight deck', actions: { on: 'Open door', off: 'Close door' }, components: ['flight_deck_door', 'flight_deck_bulkhead'], transforms: [rot('tbx_pivot_flight_deck_door', [0, 1, 0], -95)] });
  art.push({ id: 'apu_inlet_door', label: 'APU air inlet door', group: 'Engines', actions: { on: 'Open inlet door', off: 'Close inlet door' }, components: ['apu_inlet_door', 'apu'], transforms: [rot('tbx_pivot_apu_inlet_door', [0, 1, 0], -35)] });
  // Landing gear: mains fold inboard, nose folds forward and its doors close behind it.
  const gearComps = key => [`main_gear_shock_strut_${key}`, `main_gear_torsion_links_${key}`, `main_gear_side_brace_${key}`, `main_gear_strut_door_${key}`, ...['outboard', 'inboard'].flatMap(n => [`main_tyre_${n}_${key}`, `main_wheel_${n}_${key}`, `main_wheel_brake_${n}_${key}`])];
  for (const { key, s, label } of SIDE_KEYS) {
    art.push({ id: `gear_main_${key}`, label: `${label} main landing gear`, group: 'Landing gear', actions: { on: 'Retract gear', off: 'Extend gear' }, components: gearComps(key), transforms: [rot(gear[key].name, [1, 0, 0], 86 * s)], duration: 2600 });
  }
  art.push({
    id: 'gear_nose', label: 'Nose landing gear', group: 'Landing gear', actions: { on: 'Retract gear', off: 'Extend gear' },
    components: ['nose_gear_shock_strut', 'nose_gear_drag_brace', 'nose_gear_steering', 'nose_tyre_left', 'nose_tyre_right', 'nose_wheel_left', 'nose_wheel_right', 'nose_gear_door_left', 'nose_gear_door_right', 'taxi_light'],
    transforms: [rot('tbx_pivot_nose_gear', [0, 0, 1], 88), ...ctx.noseDoors.map(d => rot(d.dp.name, [1, 0, 0], 80 * d.s, { delay: 0.7 }))], duration: 2600
  });
  // High-lift devices: trailing-edge flaps travel aft and down; slats and Kruegers extend with them.
  const flapMove = (deflect, aft, drop, slatDeg, slatFwd) => SIDE_KEYS.flatMap(({ key }) => [
    { node: piv(key, `flap_inboard_${key}`), translate: [-aft, -drop, 0] }, rot(piv(key, `flap_inboard_${key}`), ax(key, `flap_inboard_${key}`), deflect),
    { node: piv(key, `flap_outboard_${key}`), translate: [-aft * 0.85, -drop * 0.85, 0] }, rot(piv(key, `flap_outboard_${key}`), ax(key, `flap_outboard_${key}`), deflect),
    ...[1, 2, 3, 4].flatMap(n => [{ node: WC[key].sl.pivots[`slat_${n}_${key}`].name, translate: [slatFwd, -slatFwd * 0.45, 0] }, rot(WC[key].sl.pivots[`slat_${n}_${key}`].name, WC[key].sl.axes[`slat_${n}_${key}`], -slatDeg)]),
    ...[1, 2].map(n => rot(WC[key].kr.pivots[`krueger_flap_${n}_${key}`].name, WC[key].kr.axes[`krueger_flap_${n}_${key}`], 115))
  ]);
  const hiLift = SIDE_KEYS.flatMap(({ key }) => [`flap_inboard_${key}`, `flap_outboard_${key}`, `wing_${key}`, ...[1, 2, 3, 4].map(n => `slat_${n}_${key}`), `krueger_flap_1_${key}`, `krueger_flap_2_${key}`]);
  art.push({ id: 'flaps_5', label: 'Flaps 5 (takeoff)', group: 'High-lift devices', exclusive: 'flaps', actions: { on: 'Set flaps 5', off: 'Flaps up' }, components: hiLift, transforms: flapMove(10, 0.32, 0.1, 12, 0.18), duration: 2400 });
  art.push({ id: 'flaps_30', label: 'Flaps 30 (landing)', group: 'High-lift devices', exclusive: 'flaps', actions: { on: 'Set flaps 30', off: 'Flaps up' }, components: hiLift, transforms: flapMove(32, 0.62, 0.26, 20, 0.3), duration: 3000 });
  // Roll: aileron up on the side the aircraft rolls towards, flight spoilers 2–5 assist; the control wheels turn.
  for (const [dir, sgn] of [['left', -1], ['right', 1]]) {
    const up = dir, down = dir === 'left' ? 'right' : 'left';
    art.push({
      id: `roll_${dir}`, label: `Roll ${dir}`, group: 'Flight controls', exclusive: 'roll', actions: { on: `Roll ${dir}`, off: 'Neutral' },
      components: [`aileron_left`, `aileron_right`, 'control_wheel_captain', 'control_wheel_first_officer', ...[2, 3, 4, 5].map(n => `spoiler_${n}_${up}`)],
      transforms: [
        rot(piv(up, `aileron_${up}`), ax(up, `aileron_${up}`), -18), rot(piv(down, `aileron_${down}`), ax(down, `aileron_${down}`), 14),
        ...[2, 3, 4, 5].map(n => rot(WC[up].sp.pivots[`spoiler_${n}_${up}`].name, WC[up].sp.axes[`spoiler_${n}_${up}`], -25)),
        ...Object.values(columns).map(c => rot(c.wp.name, [1, 0, 0], 45 * sgn))
      ]
    });
  }
  // Pitch: elevators and control columns.
  for (const [dir, e, c] of [['up', -20, 10], ['down', 15, -8]]) {
    art.push({
      id: `pitch_${dir}`, label: `Pitch ${dir}`, group: 'Flight controls', exclusive: 'pitch', actions: { on: `Nose ${dir}`, off: 'Neutral' },
      components: ['elevator_left', 'elevator_right', 'control_column_captain', 'control_column_first_officer'],
      transforms: [
        ...SIDE_KEYS.map(({ key }) => rot(ctx.elev[key].pivots[`elevator_${key}`].name, ctx.elev[key].axes[`elevator_${key}`], e)),
        ...Object.values(columns).map(col => rot(col.cp.name, [0, 0, 1], c))
      ]
    });
  }
  // Yaw: rudder and pedals.
  for (const [dir, sgn] of [['left', -1], ['right', 1]]) {
    art.push({
      id: `yaw_${dir}`, label: `Yaw ${dir}`, group: 'Flight controls', exclusive: 'yaw', actions: { on: `Rudder ${dir}`, off: 'Neutral' },
      components: ['rudder', 'rudder_pedals_captain', 'rudder_pedals_first_officer'],
      transforms: [rot(ctx.rudder.pivots.rudder.name, ctx.rudder.axes.rudder, 22 * sgn), ...Object.values(columns).map(col => rot(col.pp.name, [0, 1, 0], 8 * sgn))]
    });
  }
  // Stabiliser trim moves the whole tailplane about its pivot.
  for (const [dir, d] of [['nose_up', -4], ['nose_down', 3]]) {
    art.push({ id: `stab_trim_${dir}`, label: `Stabiliser trim ${dir.replace('_', ' ')}`, group: 'Flight controls', exclusive: 'stabtrim', actions: { on: `Trim ${dir.replace('_', ' ')}`, off: 'Neutral trim' }, components: ['horizontal_stabilizer_left', 'horizontal_stabilizer_right', 'stabilizer_jackscrew', 'stabilizer_trim_wheels'], transforms: [rot(ctx.stabPivot.name, [0, 0, 1], d)], duration: 2000 });
  }
  // Speed brakes: flight detent raises the flight spoilers; on the ground all six panels rise.
  const spoil = (nums, degrees) => SIDE_KEYS.flatMap(({ key }) => nums.map(n => rot(WC[key].sp.pivots[`spoiler_${n}_${key}`].name, WC[key].sp.axes[`spoiler_${n}_${key}`], -degrees)));
  const allSp = SIDE_KEYS.flatMap(({ key }) => [1, 2, 3, 4, 5, 6].map(n => `spoiler_${n}_${key}`));
  art.push({ id: 'speedbrake_flight', label: 'Speed brakes (flight detent)', group: 'Spoilers', exclusive: 'speedbrake', actions: { on: 'Extend speed brakes', off: 'Stow speed brakes' }, components: [...allSp, 'speed_brake_lever'], transforms: spoil([2, 3, 4, 5], 30) });
  art.push({ id: 'speedbrake_ground', label: 'Ground spoilers (landing)', group: 'Spoilers', exclusive: 'speedbrake', actions: { on: 'Deploy all spoilers', off: 'Stow spoilers' }, components: [...allSp, 'speed_brake_lever'], transforms: spoil([1, 2, 3, 4, 5, 6], 55) });
  // Engines: fan cowls open like a clamshell; thrust-reverser sleeves slide aft to uncover the cascades.
  for (const { key, s } of SIDE_KEYS) {
    const e = engines[key], no = key === 'left' ? 'No. 1' : 'No. 2';
    art.push({ id: `fan_cowl_${key}`, label: `${no} engine fan cowls`, group: 'Engines', actions: { on: 'Open fan cowls', off: 'Close fan cowls' }, components: [`engine_fan_cowl_${key}`, `engine_fan_${key}`, `engine_core_${key}`, `engine_accessory_gearbox_${key}`, `engine_oil_tank_${key}`], requires: [{ id: `reverser_${key}`, state: false, reason: 'Stow the thrust reverser first.' }], transforms: [rot(e.cowlOut.name, [1, 0, 0], -55 * s), rot(e.cowlIn.name, [1, 0, 0], 55 * s)], duration: 1800 });
    art.push({ id: `reverser_${key}`, label: `${no} engine thrust reverser`, group: 'Engines', actions: { on: 'Deploy reverser', off: 'Stow reverser' }, components: [`thrust_reverser_${key}`, `thrust_reverser_cascades_${key}`], requires: [{ id: `fan_cowl_${key}`, state: false, reason: 'Close the fan cowls first.' }], transforms: [{ node: e.trOut.name, translate: [-0.6, 0, 0] }, { node: e.trIn.name, translate: [-0.6, 0, 0] }], duration: 1500 });
  }
  void W;
}
