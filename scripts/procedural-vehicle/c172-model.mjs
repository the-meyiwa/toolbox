/**
 * Procedural Cessna 172S Skyhawk SP.
 *
 * Length, wingspan, height, wing area, wheelbase, propeller diameter and
 * tyre sizes follow the published Pilot's Operating Handbook figures; the
 * section shapes, planform details and the placement of engine and cabin
 * items are Toolbox approximations for orientation. The panel shown is
 * the conventional six-instrument layout (aircraft from 2005 on usually
 * have the Garmin G1000 instead; the switches are much the same).
 *
 * Coordinates: metres, x = -u (u = distance behind the spinner tip), y up
 * from the ground, z towards the right wing.
 */
import { merge, mirrorZ, place, box, roundedBox, cylinder, sphere, lathe, tube, torus, TAU } from './geometry.mjs';
import { Assembly } from './assembly.mjs';
import { Loft, Wing, samples, chordSamples, superSection } from './shapes.mjs';
import { liftingSurface, overlayPanels, aircraftTyre, aircraftRim, rotateAbout, mirrorPoint, sAt, SIDE_KEYS } from './aircraft-parts.mjs';

const IN = 0.0254;
const deg = d => d * Math.PI / 180;
const X = u => -u;
const at = (u, y, z) => [X(u), y, z];

export const C172 = {
  L: 8.28, span: 11.0, H: 2.72, wheelbase: 65 * IN, track: 2.54, propD: 76 * IN, hubY: 1.25,
  mainTyre: { od: 17.5 * IN, width: 6.0 * IN, rim: 6 * IN }, noseTyre: { od: 15 * IN, width: 5.0 * IN, rim: 5 * IN },
  floorY: 0.9
};

const FUSELAGE = [
  [0.28, 1.52, 0.98, 0.33, 2.4], [0.45, 1.62, 0.88, 0.44, 2.6], [0.9, 1.68, 0.8, 0.5, 2.8], [1.55, 1.72, 0.76, 0.53, 3.0],
  [1.75, 1.78, 0.76, 0.55, 3.0], [2.15, 2.02, 0.8, 0.56, 3.2], [3.3, 2.05, 0.84, 0.56, 3.2], [3.9, 1.98, 0.92, 0.5, 3.0],
  [5.0, 1.84, 1.1, 0.34, 2.6], [6.5, 1.72, 1.3, 0.2, 2.4], [7.6, 1.66, 1.46, 0.08, 2.2], [7.75, 1.62, 1.52, 0.04, 2.0]
].map(([u, top, bot, w, n]) => ({ u, yc: (top + bot) / 2, h: (top - bot) / 2, w, n }));

export function fuselageLoft() {
  return new Loft(FUSELAGE, (p, t, side) => superSection({ yc: p.yc, w: p.w, ht: p.h, hb: p.h, n: p.n }, t, side));
}

export function build172() {
  const A = new Assembly('tbx_aircraft');
  const art = [];
  const F = fuselageLoft();
  const ctx = { A, art, F };
  buildFuselage(ctx);
  buildWings(ctx);
  buildTail(ctx);
  buildEngine(ctx);
  buildGear(ctx);
  buildCabin(ctx);
  buildDetails(ctx);
  buildMotion(ctx);
  return { assembly: A, articulations: art };
}

/* ------------------------------------------------------------ FUSELAGE -- */

function openings(F) {
  const tr = (u0, u1, y0, y1, side) => { const um = (u0 + u1) / 2; return [F.tAtY(um, y0, side), F.tAtY(um, y1, side)]; };
  const list = [];
  for (const { key, s } of SIDE_KEYS) {
    const [t0, t1] = tr(1.95, 2.95, 0.92, 1.97, s);
    const [w0, w1] = tr(1.95, 2.95, 1.42, 1.9, s);
    list.push({ id: `cabin_door_${key}`, side: s, u0: 1.95, u1: 2.95, t0, t1, win: [2.03, 2.87, w0, w1] });
    const [r0, r1] = tr(3.02, 3.62, 1.42, 1.9, s);
    list.push({ id: `rear_side_window_${key}`, side: s, u0: 3.02, u1: 3.62, t0: r0, t1: r1, glass: true });
  }
  const [b0, b1] = tr(3.98, 4.46, 1.08, 1.5, -1);
  list.push({ id: 'baggage_door', side: -1, u0: 3.98, u1: 4.46, t0: b0, t1: b1 });
  return list;
}

function buildFuselage(ctx) {
  const { A, F } = ctx;
  const ops = openings(F);
  ctx.ops = ops;
  const pivots = {};
  for (const o of ops) if (!o.glass) {
    const p = F.point(o.u0, (o.t0 + o.t1) / 2, o.side);
    pivots[o.id] = A.pivot(`tbx_pivot_${o.id}`, [p[0] + 0.01, p[1], p[2] + o.side * 0.02]);
  }
  ctx.doorPivots = pivots;
  const cowlPivot = A.pivot('tbx_pivot_cowling_upper', at(1.0, 1.7, 0));
  ctx.cowlPivot = cowlPivot;
  const oilHinge = F.point(1.12, 0.95, 1);
  const oilPivot = A.pivot('tbx_pivot_oil_access_door', [oilHinge[0], oilHinge[1], oilHinge[2]], cowlPivot);
  ctx.oilPivot = oilPivot;
  const us = [...samples(0.28, 1.6, 0.06, [0.95, 1.3, 1.55]), ...samples(1.6, 7.75, 0.1, [1.62, 2.12, 3.82, 4.5, ...ops.flatMap(o => [o.u0, o.u1]), ...ops.filter(o => o.win).flatMap(o => [o.win[0], o.win[1]])]).slice(1)];
  for (const side of [1, -1]) {
    const mine = ops.filter(o => o.side === side);
    const ts = samples(0, 1, 0.03, [0.52, 0.72, 0.8, 0.95, ...mine.flatMap(o => [o.t0, o.t1]), ...mine.filter(o => o.win).flatMap(o => [o.win[2], o.win[3]])]);
    const parts = F.regions({
      us, ts, side, classify: ({ u, t }) => {
        if (u < 1.55) {
          if (side > 0 && u > 0.95 && u < 1.3 && t > 0.8 && t < 0.95) return 'oil_access_door';
          return t > 0.52 ? 'cowling_upper' : 'cowling_lower';
        }
        if (u > 1.62 && u < 2.12 && t > 0.72) return 'windshield';
        if (u > 3.82 && u < 4.5 && t > 0.8) return 'rear_window';
        for (const o of mine) if (u > o.u0 && u < o.u1 && t > o.t0 && t < o.t1) {
          if (o.glass) return o.id;
          if (o.win && u > o.win[0] && u < o.win[1] && t > o.win[2] && t < o.win[3]) return `door_window_${side > 0 ? 'right' : 'left'}`;
          return o.id;
        }
        return u < 3.9 ? 'fuselage_cabin' : 'fuselage_tailcone';
      }
    });
    for (const [id, g] of parts) {
      const parent = id === 'oil_access_door' ? oilPivot : id === 'cowling_upper' ? cowlPivot
        : id.startsWith('door_window_') ? pivots[`cabin_door_${id.slice(12)}`] : pivots[id] || A.root;
      A.add(id, g, parent);
    }
  }
  // Nose bowl face round the spinner, with the two cooling-air inlets.
  const fp = F.params(0.28);
  const bowl = F.cap(0.28, {
    zs: samples(-fp.w, fp.w, 0.04, [-0.3, -0.12, 0.12, 0.3]), ys: samples(fp.yc - fp.h, fp.yc + fp.h, 0.04, [1.3, 1.44]),
    classify: ({ z, y }) => (Math.hypot(z, y - C172.hubY) < 0.2 ? null : Math.abs(z) > 0.12 && Math.abs(z) < 0.3 && y > 1.3 && y < 1.44 ? 'cowl_air_inlets' : 'cowling_lower')
  });
  for (const [id, g] of bowl) A.add(id, g);
  A.add('firewall', F.cap(1.56, { zs: samples(-0.53, 0.53, 0.1), ys: samples(0.76, 1.72, 0.1), classify: () => 'firewall' }).get('firewall'));
  const tail = F.params(7.75);
  A.add('fuselage_tailcone', cylinder(tail.w, tail.w, 0.01, { axis: 'x', seg: 10, at: at(7.75, tail.yc, 0) }));
}

/* --------------------------------------------------------------- WINGS -- */

const DIH = deg(1.73);
const wy = z => 2.02 + z * Math.tan(DIH);
const UPW = [0, Math.cos(DIH), -Math.sin(DIH)];
export function mainWing() {
  return new Wing([
    { le: at(2.14, wy(0), 0), chord: 1.63, t: 0.12, up: UPW },
    { le: at(2.14, wy(2.55), 2.55), chord: 1.63, t: 0.12, up: UPW },
    { le: at(2.65, wy(5.45), 5.45), chord: 1.12, t: 0.12, up: UPW },
    { le: at(2.72, wy(5.47), 5.47), chord: 1.0, t: 0.11, up: UPW }
  ], { m: 0.02, p: 0.4 });
}

function buildWings(ctx) {
  const { A, F } = ctx;
  const W = mainWing();
  ctx.W = W;
  const S = z => sAt(W, z);
  const te = [{ id: 'flap', s0: S(0.58), s1: S(2.5), c0: 0.7 }, { id: 'aileron', s0: S(2.85), s1: S(5.12), c0: 0.72 }];
  ctx.wc = {};
  for (const { key, s } of SIDE_KEYS) {
    const res = liftingSurface(A, W, { skinId: `wing_${key}`, s, te: te.map(t => ({ ...t, id: `${t.id}_${key}` })), ss: samples(0, 3, 0.06, [...te.flatMap(t => [t.s0, t.s1]), 1, 2]), cs: chordSamples(22, [0.7, 0.72]), capRoot: false });
    ctx.wc[key] = res;
    const h = g => (s > 0 ? g : mirrorZ(g));
    // Lift strut from the lower fuselage to the wing.
    const root = F.point(2.5, 0.28, 1), top = W.point(S(2.6), 0.3, -1);
    A.add(`wing_strut_${key}`, h(merge([
      tube([[root[0], root[1], root[2] - 0.02], [top[0], top[1] - 0.02, top[2]]], 0.03, { radial: 8 }),
      box(0.08, 0.05, 0.05, { at: [top[0], top[1] - 0.02, top[2]] })
    ])));
    // Integral fuel tank in the inboard wing, filler cap on top near the strut.
    const tank = W.regions({ ss: samples(S(0.62), S(2.45), 0.1), cs: samples(0.08, 0.5, 0.07), classify: () => 'x', offset: -0.015 }).get('x');
    A.add(`fuel_tank_${key}`, h(merge([tank, W.chordFace(S(0.62), S(2.45), 0.08, 6), W.chordFace(S(0.62), S(2.45), 0.5, 6), W.rib(S(0.62), 0.08, 0.5, 6), W.rib(S(2.45), 0.08, 0.5, 6)])));
    const cp = W.point(S(2.3), 0.28, 1);
    const capPivot = A.pivot(`tbx_pivot_fuel_cap_${key}`, mirrorPoint(cp, s));
    A.add(`fuel_cap_${key}`, h(cylinder(0.035, 0.035, 0.03, { axis: 'y', seg: 14, at: [cp[0], cp[1] + 0.012, cp[2]] })), capPivot);
    ctx.wc[key].capPivot = capPivot;
    const drain = W.point(S(0.9), 0.2, -1);
    A.add('fuel_sump_drains', h(cylinder(0.01, 0.01, 0.03, { axis: 'y', seg: 8, at: [drain[0], drain[1] - 0.015, drain[2]] })));
    const tip = W.point(3, 0.05, 1);
    A.add(`navigation_light_${key}`, h(sphere(0.03, { at: [tip[0], tip[1], tip[2]], seg: 8 })));
    A.add('tie_down_rings', h(torus(0.025, 0.006, { axis: 'x', seg: 10, tubeSeg: 4, at: (() => { const p = W.point(S(2.7), 0.5, -1); return [p[0], p[1] - 0.04, p[2]]; })() })));
  }
  // Landing and taxi lights in the left wing leading edge; pitot tube and stall-warning inlet also on the left.
  const lp = (z, c = 0.01) => { const p = W.point(S(z), c, 1); return [p[0], p[1] - 0.02, -p[2]]; };
  A.add('landing_taxi_lights', merge([sphere(0.035, { at: lp(3.25), seg: 10 }), sphere(0.035, { at: lp(3.4), seg: 10 })]));
  const pit = W.point(S(3.2), 0.25, -1);
  A.add('pitot_tube', merge([cylinder(0.008, 0.008, 0.28, { axis: 'x', seg: 6, at: [pit[0] + 0.14, pit[1] - 0.09, -pit[2]] }), box(0.02, 0.09, 0.012, { at: [pit[0], pit[1] - 0.045, -pit[2]] })]));
  A.add('stall_warning_inlet', box(0.01, 0.02, 0.05, { at: lp(1.6, 0.0) }));
  const vent = W.point(S(2.55), 0.3, -1);
  A.add('fuel_vent', tube([[vent[0], vent[1], -vent[2]], [vent[0] + 0.1, vent[1] - 0.12, -vent[2]]], 0.008, { radial: 5 }));
}

/* ---------------------------------------------------------------- TAIL -- */

function buildTail(ctx) {
  const { A } = ctx;
  const HS = new Wing([
    { le: at(6.62, 1.5, 0.08), chord: 1.18, t: 0.09, up: [0, 1, 0] },
    { le: at(6.95, 1.5, 1.725), chord: 0.8, t: 0.08, up: [0, 1, 0] }
  ], { m: 0 });
  ctx.HS = HS;
  const S = z => sAt(HS, z);
  ctx.elev = {};
  for (const { key, s } of SIDE_KEYS) {
    const r = liftingSurface(A, HS, { skinId: `horizontal_stabilizer_${key}`, s, te: [{ id: `elevator_${key}`, s0: S(0.1), s1: S(1.7), c0: 0.58 }], ss: samples(0, 1, 0.08, [S(0.1), S(1.7)]), cs: chordSamples(16, [0.58]), capRoot: false });
    ctx.elev[key] = r;
  }
  // Trim tab on the right elevator, hinged near its trailing edge and carried by the elevator.
  ctx.trim = overlayPanels(A, HS, [{ id: 'elevator_trim_tab', s0: S(0.35), s1: S(0.8), c0: 0.86, c1: 0.995, faces: [1, -1], hingeC: 0.86 }], { s: 1, parent: ctx.elev.right.pivots.elevator_right, offset: 0.004 });
  const FIN = new Wing([
    { le: at(6.2, 1.58, 0), chord: 2.08, t: 0.09, up: [0, 0, 1] },
    { le: at(6.45, 1.75, 0), chord: 1.8, t: 0.09, up: [0, 0, 1] },
    { le: at(7.35, 2.64, 0), chord: 0.7, t: 0.08, up: [0, 0, 1] }
  ], { m: 0 });
  ctx.FIN = FIN;
  const SF = y => sAt(FIN, y, 1);
  ctx.rudder = liftingSurface(A, FIN, { skinId: 'vertical_fin', s: 0, te: [{ id: 'rudder', s0: SF(1.62), s1: SF(2.6), c0: 0.56 }], ss: samples(0, 2, 0.05, [SF(1.62), SF(2.6)]), cs: chordSamples(16, [0.56]), prefer: 1, capRoot: false });
  A.add('beacon', merge([cylinder(0.025, 0.025, 0.08, { axis: 'y', seg: 10, at: at(7.62, 2.68, 0) })]));
  A.add('tail_position_light', sphere(0.022, { at: at(8.22, 1.62, 0), seg: 8 }));
  A.add('tie_down_rings', torus(0.025, 0.006, { axis: 'x', seg: 10, tubeSeg: 4, at: at(7.4, 1.4, 0) }));
}

/* -------------------------------------------------------------- ENGINE -- */

function buildEngine(ctx) {
  const { A, oilPivot } = ctx;
  const hy = C172.hubY;
  // Spinner and two-blade fixed-pitch propeller (76 in, about 60 in pitch).
  A.add('propeller_spinner', lathe([[0.001, 0.26], [0.09, 0.2], [0.17, 0.08], [0.2, -0.02], [0.2, -0.06]], { axis: 'x', seg: 24, at: at(0.26, hy, 0) }));
  const R = C172.propD / 2, pitch = 60 * IN;
  const stations = [0.12, 0.3, 0.5, 0.7, 0.85, R].map((r, i, a) => {
    const beta = Math.atan(pitch / (2 * Math.PI * Math.max(r, 0.2)));
    const chord = [0.1, 0.15, 0.15, 0.13, 0.1, 0.05][i];
    const cd = [-Math.sin(beta), 0, -Math.cos(beta)], up = [Math.cos(beta), 0, -Math.sin(beta)];
    return { le: [X(0.12) - cd[0] * chord * 0.3, hy + r, -cd[2] * chord * 0.3], chord, t: i === 0 ? 0.3 : 0.12, up, chordDir: cd };
  });
  const blade = new Wing(stations, { m: 0.03, p: 0.4 });
  const bg = merge([blade.regions({ ss: samples(0, 5, 0.25), cs: chordSamples(10), classify: () => 'x' }).get('x'), blade.rib(5, 0, 1, 6)]);
  const other = rotateAbout(bg.clone(), at(0.12, hy, 0), [1, 0, 0], Math.PI);
  A.add('propeller', merge([bg, other, cylinder(0.07, 0.07, 0.12, { axis: 'x', seg: 14, at: at(0.16, hy, 0) })]));
  // Lycoming IO-360-L2A: four horizontally opposed, air-cooled cylinders.
  const ey = 1.24;
  A.add('engine_crankcase', merge([roundedBox(0.72, 0.24, 0.3, 0.05, { at: at(0.95, ey, 0) }), cylinder(0.06, 0.06, 0.12, { axis: 'x', seg: 12, at: at(0.54, hy, 0) })]));
  const cyls = [];
  for (const [u, s] of [[0.73, 1], [0.8, -1], [1.08, 1], [1.15, -1]]) {
    cyls.push(cylinder(0.068, 0.068, 0.2, { axis: 'z', seg: 14, at: at(u, ey + 0.02, 0.26 * s) }));
    for (let k = 0; k < 5; k++) cyls.push(cylinder(0.082, 0.082, 0.008, { axis: 'z', seg: 14, at: at(u, ey + 0.02, (0.19 + k * 0.035) * s) }));
    cyls.push(roundedBox(0.16, 0.17, 0.1, 0.03, { at: at(u, ey + 0.03, 0.4 * s) }));
  }
  A.add('engine_cylinders', merge(cyls));
  A.add('oil_sump', roundedBox(0.52, 0.14, 0.24, 0.04, { at: at(1.0, ey - 0.18, 0) }));
  A.add('induction_air_box', merge([roundedBox(0.2, 0.1, 0.26, 0.03, { at: at(0.62, 0.98, 0) }), tube([at(0.62, 1.02, 0), at(0.9, 1.06, 0), at(1.15, 1.1, 0.12)], 0.035, { radial: 8 })]));
  A.add('fuel_injection_servo', roundedBox(0.1, 0.08, 0.1, 0.02, { at: at(1.05, 1.02, 0.02) }));
  A.add('exhaust_system', merge([
    tube([at(0.78, ey - 0.05, 0.36), at(0.95, 0.95, 0.3), at(1.2, 0.9, 0.12)], 0.02, { radial: 6 }),
    tube([at(0.85, ey - 0.05, -0.36), at(1.0, 0.95, -0.3), at(1.2, 0.9, -0.12)], 0.02, { radial: 6 }),
    cylinder(0.055, 0.055, 0.34, { axis: 'z', seg: 12, at: at(1.22, 0.88, 0) }),
    tube([at(1.3, 0.87, 0.1), at(1.42, 0.78, 0.22)], 0.018, { radial: 6 })
  ]));
  A.add('alternator', cylinder(0.06, 0.06, 0.1, { axis: 'x', seg: 12, at: at(0.6, ey - 0.08, 0.16) }));
  A.add('starter_motor', cylinder(0.05, 0.05, 0.15, { axis: 'x', seg: 12, at: at(0.62, ey - 0.1, -0.15) }));
  A.add('magnetos', merge([-1, 1].map(s => cylinder(0.04, 0.04, 0.1, { axis: 'x', seg: 10, at: at(1.36, ey + 0.08, 0.08 * s) }))));
  A.add('oil_filter', cylinder(0.045, 0.045, 0.1, { axis: 'x', seg: 12, at: at(1.4, ey - 0.02, 0.0) }));
  A.add('vacuum_pump', cylinder(0.04, 0.04, 0.08, { axis: 'x', seg: 10, at: at(1.4, ey - 0.08, -0.12) }));
  A.add('engine_mount', merge([[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => tube([at(1.18, ey + 0.1 * a, 0.12 * b), at(1.55, ey + 0.28 * a, 0.36 * b)], 0.012, { radial: 5 }))));
  A.add('battery', box(0.18, 0.18, 0.12, { at: at(1.46, 1.35, -0.34) }));
  A.add('fuel_strainer', cylinder(0.035, 0.035, 0.07, { axis: 'y', seg: 10, at: at(1.48, 0.86, 0.1) }));
  const dp = A.pivot('tbx_pivot_oil_dipstick', at(1.2, 1.55, 0.3));
  A.add('oil_dipstick', merge([cylinder(0.01, 0.01, 0.2, { axis: 'y', seg: 6, at: at(1.2, 1.45, 0.3) }), torus(0.018, 0.005, { axis: 'z', seg: 10, tubeSeg: 4, at: at(1.2, 1.57, 0.3) })]), dp);
  ctx.dipPivot = dp;
  void oilPivot;
}

/* ---------------------------------------------------------------- GEAR -- */

function buildGear(ctx) {
  const { A } = ctx;
  const M = C172.mainTyre, N = C172.noseTyre;
  const mainU = 1.35 + C172.wheelbase;
  for (const { key, s } of SIDE_KEYS) {
    const axle = at(mainU, M.od / 2, (C172.track / 2) * s);
    A.add(`main_gear_leg_${key}`, tube([at(mainU - 0.05, 0.86, 0.36 * s), at(mainU - 0.02, 0.5, 0.85 * s), [axle[0], axle[1] + 0.03, axle[2] - 0.1 * s]], 0.03, { radial: 8 }));
    const tyre = aircraftTyre(M.od, M.width, M.rim); tyre.translate(...axle);
    const rim = aircraftRim(M.rim, M.width, 0.035); rim.translate(...axle);
    A.add(`main_tyre_${key}`, tyre); A.add(`main_wheel_${key}`, rim);
    A.add(`main_brake_${key}`, merge([cylinder(0.075, 0.075, 0.008, { axis: 'z', seg: 16, at: [axle[0], axle[1], axle[2] - 0.08 * s] }), box(0.05, 0.05, 0.04, { at: [axle[0] - 0.07, axle[1] - 0.02, axle[2] - 0.09 * s] })]));
    A.add(`main_wheel_fairing_${key}`, merge([sphere(0.1, { seg: 14, at: [axle[0] - 0.05, axle[1] + 0.03, axle[2]], scale: [3.7, 2.25, 1.1] })]));
    A.add('boarding_steps', box(0.12, 0.012, 0.08, { at: at(mainU - 0.03, 0.62, 0.72 * s) }));
  }
  const nu = 1.35, np = A.pivot('tbx_pivot_nose_gear', at(nu + 0.05, 0.78, 0));
  ctx.nosePivot = np;
  const naxle = at(nu, N.od / 2, 0);
  A.add('nose_gear_strut', merge([
    cylinder(0.035, 0.035, 0.36, { axis: 'y', seg: 10, at: at(nu + 0.05, 0.66, 0) }),
    cylinder(0.025, 0.025, 0.28, { axis: 'y', seg: 10, at: at(nu + 0.02, 0.38, 0) }),
    tube([at(nu + 0.02, 0.3, 0.06), at(nu, N.od / 2, 0.06)], 0.012, { radial: 5 }), tube([at(nu + 0.02, 0.3, -0.06), at(nu, N.od / 2, -0.06)], 0.012, { radial: 5 })
  ]), np);
  A.add('nose_gear_shimmy_damper', cylinder(0.018, 0.018, 0.2, { axis: 'z', seg: 8, at: at(nu + 0.12, 0.62, 0.05) }), np);
  const nt = aircraftTyre(N.od, N.width, N.rim); nt.translate(...naxle);
  const nr = aircraftRim(N.rim, N.width, 0.03); nr.translate(...naxle);
  A.add('nose_tyre', nt, np); A.add('nose_wheel', nr, np);
  A.add('nose_wheel_fairing', sphere(0.1, { seg: 14, at: [naxle[0] + 0.02, naxle[1] + 0.03, 0], scale: [3.2, 2.2, 0.95] }), np);
}

/* --------------------------------------------------------------- CABIN -- */

function buildCabin(ctx) {
  const { A, F } = ctx;
  const fy = C172.floorY;
  const half = (u, y) => { const p = F.params(u); const k = Math.abs((y - p.yc) / p.h); return p.w * Math.pow(Math.max(0, 1 - Math.pow(k, p.n)), 1 / p.n); };
  A.add('cabin_floor', box(2.4, 0.02, 2 * half(2.8, fy) - 0.04, { at: at(2.8, fy, 0) }));
  A.add('instrument_panel', roundedBox(0.05, 0.44, 1.0, 0.02, { at: at(1.8, 1.42, 0) }));
  A.add('glareshield', roundedBox(0.16, 0.04, 1.0, 0.015, { at: at(1.74, 1.66, 0) }));
  const dial = (z, y, r = 0.04) => cylinder(r, r, 0.01, { axis: 'x', seg: 18, at: at(1.83, y, z) });
  A.add('flight_instruments', merge([[-0.4, 1.56], [-0.3, 1.56], [-0.2, 1.56], [-0.4, 1.46], [-0.3, 1.46], [-0.2, 1.46]].map(([z, y]) => dial(z, y))));
  A.add('engine_instruments', merge([dial(-0.12, 1.53, 0.035), ...[0, 1, 2, 3].map(i => box(0.01, 0.03, 0.06, { at: at(1.83, 1.4 - i * 0.035, -0.12) }))]));
  A.add('avionics_stack', merge([box(0.012, 0.3, 0.17, { at: at(1.83, 1.43, 0.06) })]));
  A.add('annunciator_panel', box(0.01, 0.03, 0.12, { at: at(1.83, 1.63, -0.3) }));
  A.add('switch_panel', merge(Array.from({ length: 8 }, (_, i) => box(0.02, 0.03, 0.014, { at: at(1.84, 1.24, -0.44 + i * 0.03) }))));
  A.add('ignition_switch', cylinder(0.02, 0.02, 0.02, { axis: 'x', seg: 12, at: at(1.84, 1.3, -0.46) }));
  A.add('throttle', merge([cylinder(0.006, 0.006, 0.12, { axis: 'x', seg: 6, at: at(1.86, 1.27, -0.02) }), sphere(0.02, { at: at(1.92, 1.27, -0.02), seg: 10 })]));
  A.add('mixture_control', merge([cylinder(0.006, 0.006, 0.1, { axis: 'x', seg: 6, at: at(1.86, 1.27, 0.06) }), sphere(0.017, { at: at(1.91, 1.27, 0.06), seg: 10 })]));
  A.add('flap_switch', merge([box(0.02, 0.07, 0.03, { at: at(1.84, 1.3, 0.16) }), box(0.03, 0.012, 0.03, { at: at(1.86, 1.31, 0.16) })]));
  A.add('parking_brake_handle', box(0.04, 0.02, 0.05, { at: at(1.86, 1.2, -0.36) }));
  A.add('cabin_heat_air_controls', merge([sphere(0.012, { at: at(1.86, 1.22, 0.3), seg: 8 }), sphere(0.012, { at: at(1.86, 1.22, 0.36), seg: 8 })]));
  A.add('circuit_breaker_panel', box(0.01, 0.06, 0.16, { at: at(1.83, 1.26, 0.34) }));
  A.add('magnetic_compass', roundedBox(0.06, 0.05, 0.06, 0.015, { at: at(1.9, 1.94, 0) }));
  A.add('elevator_trim_wheel', merge([cylinder(0.075, 0.075, 0.018, { axis: 'z', seg: 18, at: at(2.3, 1.02, 0) }), box(0.18, 0.12, 0.08, { at: at(2.3, 0.97, 0) })]));
  A.add('fuel_selector', merge([box(0.18, 0.02, 0.18, { at: at(2.05, fy + 0.02, 0) }), box(0.12, 0.02, 0.025, { at: at(2.05, fy + 0.04, 0) })]));
  A.add('fuel_shutoff_valve', cylinder(0.015, 0.015, 0.05, { axis: 'y', seg: 8, at: at(2.12, fy + 0.05, 0.06) }));
  // Yokes: pushed or pulled for pitch, turned for roll.
  ctx.yokes = {};
  for (const [key, z] of [['left', -0.3], ['right', 0.3]]) {
    const pp = A.pivot(`tbx_pivot_yoke_${key}`, at(1.97, 1.38, z));
    const rp = A.pivot(`tbx_pivot_yoke_${key}_roll`, at(1.97, 1.38, z), pp);
    A.add(`control_yoke_${key}`, cylinder(0.014, 0.014, 0.28, { axis: 'x', seg: 8, at: at(1.87, 1.38, z) }), pp);
    A.add(`control_yoke_${key}`, merge([box(0.03, 0.05, 0.22, { at: at(1.99, 1.38, z) }), box(0.03, 0.1, 0.03, { at: at(1.99, 1.42, z - 0.11) }), box(0.03, 0.1, 0.03, { at: at(1.99, 1.42, z + 0.11) })]), rp);
    const ped = A.pivot(`tbx_pivot_rudder_pedals_${key}`, at(1.72, 0.95, z));
    A.add(`rudder_pedals_${key}`, merge([-1, 1].map(s => roundedBox(0.03, 0.12, 0.07, 0.01, { rot: [0, 0, deg(25)], at: at(1.7, 1.02, z + 0.07 * s) }))), ped);
    ctx.yokes[key] = { pp, rp, ped };
  }
  // Seats: two adjustable front seats and a rear bench.
  ctx.seats = {};
  for (const [key, z] of [['left', -0.26], ['right', 0.26]]) {
    const sp = A.pivot(`tbx_pivot_seat_front_${key}`, at(2.6, fy, z));
    A.add(`seat_front_${key}`, merge([roundedBox(0.44, 0.08, 0.42, 0.03, { at: at(2.55, fy + 0.26, z) }), roundedBox(0.09, 0.58, 0.42, 0.04, { rot: [0, 0, deg(10)], at: at(2.8, fy + 0.57, z) }), box(0.3, 0.22, 0.3, { at: at(2.58, fy + 0.11, z) })]), sp);
    A.add(`headrest_front_${key}`, roundedBox(0.08, 0.14, 0.26, 0.03, { rot: [0, 0, deg(10)], at: at(2.86, fy + 0.93, z) }), sp);
    ctx.seats[key] = sp;
  }
  A.add('rear_seat', merge([roundedBox(0.44, 0.08, 0.95, 0.03, { at: at(3.35, fy + 0.32, 0) }), roundedBox(0.09, 0.56, 0.95, 0.04, { rot: [0, 0, deg(12)], at: at(3.6, fy + 0.62, 0) })]));
  A.add('seat_belts', merge([...[-0.26, 0.26].map(z => tube([at(2.85, fy + 0.95, z + 0.2 * Math.sign(z)), at(2.6, fy + 0.6, z), at(2.4, fy + 0.4, z - 0.15 * Math.sign(z))], 0.012, { radial: 4 }))]));
  A.add('baggage_compartment', merge([box(0.8, 0.02, 2 * half(4.2, 1.12) - 0.06, { at: at(4.2, 1.12, 0) }), box(0.02, 0.6, 2 * half(4.62, 1.4) - 0.06, { at: at(4.62, 1.4, 0) })]));
  A.add('elt', box(0.14, 0.07, 0.08, { at: at(5.3, 1.45, 0.1) }));
}

/* ------------------------------------------------------------- DETAILS -- */

function buildDetails(ctx) {
  const { A, F } = ctx;
  A.add('static_port', F.patch(1.86, 1.9, F.tAtY(1.88, 1.28, -1), F.tAtY(1.88, 1.31, -1), { side: -1, nu: 1, nt: 1, offset: 0.004 }));
  A.add('outside_air_temperature_probe', cylinder(0.006, 0.006, 0.06, { axis: 'y', seg: 6, at: at(2.02, 2.02, -0.3) }));
  A.add('com_antennas', merge([tube([at(4.0, 1.97, 0.05), at(4.3, 2.35, 0.05)], 0.006, { radial: 4 }), tube([at(4.5, 1.93, 0.02), at(4.8, 2.28, 0.02)], 0.006, { radial: 4 })]));
  A.add('nav_antenna', merge([-1, 1].map(s => tube([at(6.45, 2.1, 0), at(6.75, 2.12, 0.42 * s)], 0.005, { radial: 4 }))));
  A.add('transponder_antenna', cylinder(0.005, 0.005, 0.07, { axis: 'y', seg: 5, at: at(4.6, 1.02, 0) }));
  A.add('cowl_flaps_exhaust_outlet', F.patch(1.4, 1.55, 0.0, 0.12, { side: 1, nu: 1, nt: 2, offset: 0.004 }));
}

/* ----------------------------------------------------------- MOVEMENT -- */

function buildMotion(ctx) {
  const { art, wc, elev, rudder, yokes, seats, doorPivots, trim } = ctx;
  const rot = (node, axis, degrees, extra = {}) => ({ node, rotate: { axis, degrees }, ...extra });
  art.push({ id: 'cabin_door_left', label: 'Left cabin door', group: 'Doors', actions: { on: 'Open door', off: 'Close door' }, components: ['cabin_door_left', 'door_window_left'], transforms: [rot(doorPivots.cabin_door_left.name, [0, 1, 0], -78)], duration: 1200 });
  art.push({ id: 'cabin_door_right', label: 'Right cabin door', group: 'Doors', actions: { on: 'Open door', off: 'Close door' }, components: ['cabin_door_right', 'door_window_right'], transforms: [rot(doorPivots.cabin_door_right.name, [0, 1, 0], 78)], duration: 1200 });
  art.push({ id: 'baggage_door', label: 'Baggage door', group: 'Doors', actions: { on: 'Open baggage door', off: 'Close baggage door' }, components: ['baggage_door', 'baggage_compartment'], transforms: [rot(doorPivots.baggage_door.name, [0, 1, 0], -85)] });
  art.push({ id: 'oil_access_door', label: 'Oil access door', group: 'Engine', actions: { on: 'Open oil door', off: 'Close oil door' }, components: ['oil_access_door', 'oil_dipstick', 'cowling_upper'], transforms: [rot(ctx.oilPivot.name, [1, 0, 0], -110)] });
  art.push({ id: 'oil_dipstick', label: 'Oil dipstick', group: 'Engine', actions: { on: 'Pull dipstick', off: 'Refit dipstick' }, components: ['oil_dipstick'], requires: [{ id: 'oil_access_door', state: true, reason: 'Open the oil access door first.' }], transforms: [{ node: ctx.dipPivot.name, translate: [0, 0.24, 0] }] });
  art.push({ id: 'cowling_upper', label: 'Upper cowling', group: 'Engine', actions: { on: 'Remove upper cowling', off: 'Refit upper cowling' }, components: ['cowling_upper', 'oil_access_door', 'engine_cylinders', 'engine_crankcase'], requires: [{ id: 'oil_dipstick', state: false, reason: 'Refit the dipstick first.' }], transforms: [{ node: ctx.cowlPivot.name, translate: [0.15, 0.55, 0] }], duration: 1400 });
  for (const { key } of SIDE_KEYS) art.push({ id: `fuel_cap_${key}`, label: `${key === 'left' ? 'Left' : 'Right'} fuel cap`, group: 'Fuel', actions: { on: 'Remove fuel cap', off: 'Refit fuel cap' }, components: [`fuel_cap_${key}`, `fuel_tank_${key}`, `wing_${key}`], transforms: [{ node: wc[key].capPivot.name, translate: [0, 0.12, 0] }] });
  // Flaps: 10°, 20° and 30° steps; the single-slotted flap moves aft and down.
  const flaps = (d, aft, drop) => SIDE_KEYS.flatMap(({ key }) => [{ node: wc[key].pivots[`flap_${key}`].name, translate: [-aft, -drop, 0] }, rot(wc[key].pivots[`flap_${key}`].name, wc[key].axes[`flap_${key}`], d)]);
  for (const [d, aft, drop] of [[10, 0.06, 0.02], [20, 0.12, 0.04], [30, 0.16, 0.06]]) {
    art.push({ id: `flaps_${d}`, label: `Flaps ${d}°`, group: 'Flaps', exclusive: 'flaps', actions: { on: `Set flaps ${d}°`, off: 'Flaps up' }, components: ['flap_left', 'flap_right', 'flap_switch'], transforms: flaps(d, aft, drop), duration: 1200 + d * 40 });
  }
  const yokeRoll = sgn => Object.values(yokes).map(y => rot(y.rp.name, [1, 0, 0], 35 * sgn));
  for (const [dir, sgn] of [['left', -1], ['right', 1]]) {
    const up = dir, down = dir === 'left' ? 'right' : 'left';
    art.push({ id: `roll_${dir}`, label: `Roll ${dir}`, group: 'Flight controls', exclusive: 'roll', actions: { on: `Roll ${dir}`, off: 'Neutral' }, components: ['aileron_left', 'aileron_right', 'control_yoke_left', 'control_yoke_right'], transforms: [rot(wc[up].pivots[`aileron_${up}`].name, wc[up].axes[`aileron_${up}`], -20), rot(wc[down].pivots[`aileron_${down}`].name, wc[down].axes[`aileron_${down}`], 15), ...yokeRoll(sgn)] });
  }
  for (const [dir, e, d] of [['up', -25, -0.08], ['down', 20, 0.07]]) {
    art.push({ id: `pitch_${dir}`, label: `Pitch ${dir}`, group: 'Flight controls', exclusive: 'pitch', actions: { on: `Nose ${dir}`, off: 'Neutral' }, components: ['elevator_left', 'elevator_right', 'control_yoke_left', 'control_yoke_right'], transforms: [...SIDE_KEYS.map(({ key }) => rot(elev[key].pivots[`elevator_${key}`].name, elev[key].axes[`elevator_${key}`], e)), ...Object.values(yokes).map(y => ({ node: y.pp.name, translate: [-d, 0, 0] }))] });
  }
  for (const [dir, sgn] of [['left', -1], ['right', 1]]) {
    art.push({ id: `yaw_${dir}`, label: `Yaw ${dir}`, group: 'Flight controls', exclusive: 'yaw', actions: { on: `Rudder ${dir}`, off: 'Neutral' }, components: ['rudder', 'rudder_pedals_left', 'rudder_pedals_right', 'nose_gear_strut', 'nose_wheel', 'nose_tyre'], transforms: [rot(rudder.pivots.rudder.name, rudder.axes.rudder, 20 * sgn), rot(ctx.nosePivot.name, [0, 1, 0], 10 * sgn), ...Object.values(yokes).map(y => rot(y.ped.name, [0, 1, 0], 8 * sgn))] });
  }
  for (const [dir, d] of [['nose_up', 18], ['nose_down', -12]]) {
    art.push({ id: `trim_${dir}`, label: `Elevator trim ${dir.replace('_', ' ')}`, group: 'Flight controls', exclusive: 'trim', actions: { on: `Trim ${dir.replace('_', ' ')}`, off: 'Neutral trim' }, components: ['elevator_trim_tab', 'elevator_trim_wheel', 'elevator_right'], transforms: [rot(trim.pivots.elevator_trim_tab.name, trim.axes.elevator_trim_tab, d)] });
  }
  for (const { key } of SIDE_KEYS) art.push({ id: `seat_front_${key}`, label: `Front ${key} seat`, group: 'Cabin', actions: { on: 'Slide seat back', off: 'Slide seat forward' }, components: [`seat_front_${key}`, `headrest_front_${key}`], transforms: [{ node: seats[key].name, translate: [-0.2, 0, 0] }] });
}
