/**
 * Procedural Toyota Corolla sedan (North American E170 2014–2016 and E140 2013).
 *
 * Builds a semantic scene graph: every mesh belongs to a stable component id,
 * and every moving assembly (doors, bonnet, boot lid, wheels, caps, seats …)
 * hangs under a pivot node positioned at its real hinge or slide origin so
 * the viewer can articulate it without guessing geometry.
 */
import { surface, merge, mirrorZ, place, box, roundedBox, cylinder, tube, lerp, TAU } from './geometry.mjs';
import { SedanBody } from './sedan-body.mjs';
import { Assembly } from './assembly.mjs';
import { derive } from './corolla-profiles.mjs';
import { SIDES, handed } from './common.mjs';
import { buildStructure, buildWheelsAndBrakes, buildSuspensionAndSteering, buildPowertrain, buildEngineBay, buildInterior, buildTrunkAndFuel } from './corolla-systems.mjs';

export function buildCorolla(profile) {
  const P = derive(profile);
  const B = new SedanBody(P);
  const A = new Assembly();
  const X = B.X;
  const art = [];
  const ctx = { P, B, A, X, art };

  buildBody(ctx);
  buildGlassAndLighting(ctx);
  buildDoors(ctx);
  buildClosures(ctx);
  buildStructure(ctx);
  buildWheelsAndBrakes(ctx);
  buildSuspensionAndSteering(ctx);
  buildPowertrain(ctx);
  buildEngineBay(ctx);
  buildInterior(ctx);
  buildTrunkAndFuel(ctx);

  return { assembly: A, articulations: art, profile: P };
}

/* ------------------------------------------------------------------ BODY -- */

function buildBody({ P, B, A }) {
  const xiA = B.xiAtU(P.axleFU - P.archR, 0.5);
  const xiDoor = B.xiAtU(P.doors.frontU);
  const xiB = B.xiAtU(P.doors.bU);
  const xiRE = B.xiAtU(P.doors.rearEndU);
  const xiArchRE = B.xiAtU(P.axleRU + P.archR, 0.5);
  const xiLid = B.xiTopAtZ(P.deck.z1, 'rear');
  const topY = xi => B.top(xi).y;
  const frontArch = xi => { const u = B.wrap(xi, 0.5).u, a = B.archY(u, P.axleFU); return a > -Infinity ? a : P.rockerTop; };
  const rearArch = xi => { const u = B.wrap(xi, 0.5).u, a = B.archY(u, P.axleRU); return a > -Infinity ? Math.max(P.rockerTop, a) : P.rockerTop; };
  const quarterLow = xi => { const u = B.wrap(xi, 0.6).u, a = B.archY(u, P.axleRU); return a > -Infinity ? a : (u > P.axleRU ? P.bumperTopR : P.rockerTop); };
  Object.assign(B, { xiA, xiDoor, xiB, xiRE, xiArchRE, xiLid, edgeY: topY, rearArch });

  // Front bumper cover (fascia) — full width.
  A.add('front_bumper_cover', B.both(B.region({ xi0: 0, xi1: xiA, yLow: P.bottomF, yHigh: topY, nu: 26, nv: 14 })));
  // Rear bumper cover.
  A.add('rear_bumper_cover', B.both(B.region({ xi0: xiArchRE, xi1: 1, yLow: P.bottomR, yHigh: P.bumperTopR, nu: 22, nv: 8 })));
  // Rear end panel (between bumper and boot lid, behind the lamps).
  A.add('rear_end_panel', B.both(B.region({ xi0: xiLid, xi1: 1, yLow: P.bumperTopR, yHigh: P.rearPanelTop, nu: 10, nv: 3 })));

  for (const { key, s } of SIDES) {
    const fender = merge([
      B.region({ xi0: xiA, xi1: xiDoor, yLow: frontArch, yHigh: topY, nu: 22, nv: 10 }),
      B.wingFlange()
    ]);
    A.add(`front_fender_${key}`, handed(fender, s));
    A.add(`rocker_panel_${key}`, handed(B.region({ xi0: B.xiAtU(P.axleFU + P.archR, 0.25), xi1: B.xiAtU(P.axleRU - P.archR, 0.25), yLow: P.sillY, yHigh: P.rockerTop, nu: 18, nv: 2 }), s));
    const quarter = merge([
      B.region({ xi0: xiRE, xi1: xiLid, yLow: quarterLow, yHigh: topY, nu: 26, nv: 12 }),
      B.quarterFlange()
    ]);
    A.add(`rear_quarter_panel_${key}`, handed(quarter, s));
    A.add(`wheel_well_liner_front_${key}`, handed(B.wellLiner(P.axleFU), s));
    A.add(`wheel_well_liner_rear_${key}`, handed(B.wellLiner(P.axleRU, 0.26), s));
  }
  A.add('cowl_panel', B.cowlPanel());
}

/* ------------------------------------------------- GLASS, LAMPS AND TRIM -- */

function buildGlassAndLighting({ P, B, A }) {
  const g = P.glass;
  A.add('windshield', B.glassTop(g.cowlU, g.roofFrontU, 14, 12));
  A.add('roof_panel', B.glassTop(g.roofFrontU, g.roofRearU, 14, 12));
  A.add('rear_window', B.glassTop(g.roofRearU, g.deckU, 12, 12));

  const t1 = 0.93;
  for (const { key, s } of SIDES) {
    A.add(`a_pillar_${key}`, handed(merge([
      B.greenhouseSide(g.cowlU, g.cowlU + 0.05, 0, 1, { nu: 2, nv: 6 }),
      B.greenhouseSide(g.cowlU + 0.05, g.roofFrontU, t1, 1, { nu: 12, nv: 1 })
    ]), s));
    A.add(`roof_side_rail_${key}`, handed(B.greenhouseSide(g.roofFrontU, P.doors.rearEndU, t1, 1, { nu: 12, nv: 1 }), s));
    A.add(`b_pillar_${key}`, handed(B.greenhouseSide(P.doors.bU - 0.02, P.doors.bU + 0.02, 0, t1, { nu: 1, nv: 6 }), s));
    A.add(`c_pillar_${key}`, handed(B.greenhouseSide(P.doors.rearEndU, g.deckU, 0, 1, { nu: 10, nv: 8 }), s));
  }

  // Headlamps: sweep from the upper grille back onto the wing.
  const L = P.lamps, topY = B.edgeY;
  for (const { key, s } of SIDES) {
    const xi0 = B.xiAtZ(L.head.zInner, 0.72, 'front'), xi1 = B.xiAtU(L.head.uOuter, 0.72);
    const lamp = B.region({ xi0, xi1, yLow: xi => lerp(L.head.yLow, L.head.yLow + 0.05, (xi - xi0) / (xi1 - xi0)), yHigh: xi => topY(xi) - 0.006, nu: 12, nv: 4, offset: 0.004 });
    A.add(`headlamp_${key}`, handed(lamp, s));
    const fogXi = B.xiAtZ(L.fog.z, L.fog.y, 'front');
    const fog = surface(16, 2, (a, b) => {
      const ang = a * TAU, r = L.fog.r * b;
      const zc = B.wrap(fogXi, L.fog.y).z + Math.cos(ang) * r;
      const y = L.fog.y + Math.sin(ang) * r;
      return B.point(B.xiAtZ(zc, y, 'front'), y, 0.006);
    });
    A.add(`fog_lamp_${key}`, handed(fog, s));
    // Tail lamp on the quarter panel.
    const tq0 = B.xiAtU(L.tailOuterU, 0.9);
    A.add(`tail_lamp_outer_${key}`, handed(B.region({ xi0: tq0, xi1: B.xiLid, yLow: L.tailLow, yHigh: xi => topY(xi) - 0.005, nu: 10, nv: 4, offset: 0.004 }), s));
    // Rear bumper reflector.
    const rx0 = B.xiAtU(P.axleRU + P.archR + 0.05, 0.4);
    A.add(`rear_reflector_${key}`, handed(B.region({ xi0: rx0, xi1: rx0 + 0.012, yLow: 0.38, yHigh: 0.41, nu: 3, nv: 1, offset: 0.004 }), s));
  }
  // Upper grille between the headlamps, lower grille in the fascia.
  const ug = B.region({ xi0: 0, xi1: B.xiAtZ(L.upperGrille.z, 0.7, 'front'), yLow: L.upperGrille.yLow, yHigh: xi => topY(xi) - 0.006, nu: 8, nv: 2, offset: 0.004 });
  A.add('upper_grille', B.both(ug));
  const lg = L.lowerGrille;
  const lowerGrille = B.region({
    xiFn: (a, y) => a * B.xiAtZ(lerp(lg.zBottom, lg.zTop, (y - lg.yLow) / (lg.yHigh - lg.yLow)), y, 'front'),
    yFn: b => lerp(lg.yLow, lg.yHigh, b), nu: 10, nv: 6, offset: 0.004
  });
  const slats = [];
  for (let i = 1; i < 4; i++) {
    const y = lerp(lg.yLow, lg.yHigh, i / 4);
    slats.push(B.region({ xiFn: (a, yy) => a * B.xiAtZ(lerp(lg.zBottom, lg.zTop, (yy - lg.yLow) / (lg.yHigh - lg.yLow)) - 0.01, yy, 'front'), yFn: b => y + b * 0.012, nu: 10, nv: 1, offset: 0.012 }));
  }
  A.add('lower_grille', B.both(merge([lowerGrille, ...slats])));
  // Front emblem: a plain oval badge on the upper grille (no manufacturer artwork).
  const eY = (L.upperGrille.yLow + B.top(0).y) / 2;
  A.add('front_emblem', surface(20, 2, (a, b) => {
    const ang = a * TAU, z = Math.cos(ang) * 0.07 * b, y = eY + Math.sin(ang) * 0.03 * b;
    return B.point(B.xiAtZ(Math.abs(z) + 1e-4, y, 'front'), y, 0.012).map((v, i) => (i === 2 ? Math.sign(z || 1) * Math.abs(v) : v));
  }));
}

/* ----------------------------------------------------------------- DOORS -- */

function doorWindowParts(B, u0, u1, opts) {
  const { t1 = 0.86, t2 = 0.93, belt = 0.03, divider } = opts;
  const frame = [
    B.greenhouseSide(u0, u1, t1, t2, { nu: 12, nv: 1 }),
    B.greenhouseSide(u0, u1, 0, belt, { nu: 12, nv: 1 }),
  ];
  if (opts.frontPost) frame.push(B.greenhouseSide(u0, u0 + 0.025, belt, t1, { nu: 1, nv: 5 }));
  if (opts.rearPost !== false) frame.push(B.greenhouseSide(u1 - 0.025, u1, belt, t1, { nu: 1, nv: 5 }));
  const glass = [];
  const g0 = opts.frontPost ? u0 + 0.025 : u0 + 0.004, g1 = u1 - 0.025;
  if (divider) {
    frame.push(B.greenhouseSide(divider, divider + 0.022, belt, t1, { nu: 1, nv: 5 }));
    glass.push(B.greenhouseSide(g0, divider, belt, t1, { nu: 10, nv: 5, offset: -0.006 }));
    return { frame: merge(frame), glass: merge(glass), fixed: B.greenhouseSide(divider + 0.022, g1, belt, t1, { nu: 3, nv: 5, offset: -0.006 }) };
  }
  glass.push(B.greenhouseSide(g0, g1, belt, t1, { nu: 10, nv: 5, offset: -0.006 }));
  return { frame: merge(frame), glass: merge(glass) };
}

function buildDoors({ P, B, A, X, art }) {
  const D = P.doors, g = P.glass;
  const doors = [
    { pos: 'front', u0: D.frontU, u1: D.bU - 0.02, gu0: g.cowlU + 0.05, low: () => P.rockerTop, xi0: B.xiDoor, xi1: B.xiAtU(D.bU - 0.02) },
    { pos: 'rear', u0: D.bU + 0.02, u1: D.rearEndU, gu0: D.bU + 0.02, low: B.rearArch, xi0: B.xiAtU(D.bU + 0.02), xi1: B.xiRE }
  ];
  for (const d of doors) for (const { key, s } of SIDES) {
    const id = `door_${d.pos}_${key}`;
    const hingeZ = (B.HWy(0.6) - 0.025) * s;
    const pivot = A.pivot(`tbx_pivot_${id}`, [X(d.u0) + 0.01, 0.6, hingeZ]);
    const outer = B.region({ xi0: d.xi0, xi1: d.xi1, yLow: d.low, yHigh: B.edgeY, nu: 18, nv: 10 });
    A.add(`${id}_outer_panel`, handed(outer, s), pivot);
    const inner = B.region({ xi0: d.xi0 + 0.002, xi1: d.xi1 - 0.002, yLow: xi => d.low(xi) + 0.03, yHigh: xi => B.edgeY(xi) - 0.02, nu: 12, nv: 6, offset: -0.085 });
    A.add(`${id}_trim_panel`, handed(inner, s), pivot);
    // Armrest ledge on the trim panel.
    const armU0 = d.u0 + 0.12, armU1 = d.u1 - 0.1;
    const armZ = (B.HWy(0.62) - 0.13) * s;
    A.add(`${id}_trim_panel`, roundedBox(armU1 - armU0, 0.035, 0.07, 0.01, { at: [X((armU0 + armU1) / 2), 0.66, armZ] }), pivot);
    const win = doorWindowParts(B, d.gu0, d.u1, d.pos === 'front' ? { frontPost: false } : { frontPost: true, divider: D.quarterGlassU });
    A.add(`${id}_window_frame`, handed(win.frame, s), pivot);
    const glassPivot = A.pivot(`tbx_pivot_${id}_glass`, [X((d.gu0 + d.u1) / 2), B.belt((d.gu0 + d.u1) / 2), hingeZ], pivot);
    A.add(`${id}_glass`, handed(win.glass, s), glassPivot);
    if (win.fixed) A.add(`${id}_quarter_glass`, handed(win.fixed, s), pivot);
    // Exterior handle.
    const hu = d.u1 - 0.16, hy = B.belt(hu) - 0.075, hxi = B.xiAtU(hu, hy);
    const handle = surface(6, 2, (a, b) => B.point(hxi + (a - 0.5) * 0.028, hy + (b - 0.5) * 0.032, 0.012));
    A.add(`${id}_handle`, handed(handle, s), pivot);
    // Interior release lever.
    A.add(`${id}_trim_panel`, roundedBox(0.08, 0.025, 0.02, 0.006, { at: [X(d.u0 + 0.2), 0.86, (B.HWy(0.86) - 0.12) * s] }), pivot);
    art.push({
      id, label: `${d.pos === 'front' ? 'Front' : 'Rear'} ${key} door`, group: 'Doors',
      actions: { on: 'Open door', off: 'Close door' },
      components: [`${id}_outer_panel`, `${id}_trim_panel`, `${id}_window_frame`, `${id}_handle`, `${id}_glass`, `${id}_quarter_glass`].filter(c => A.counts.has(c)),
      transforms: [{ node: pivot.name, rotate: { axis: [0, 1, 0], degrees: (d.pos === 'front' ? 66 : 70) * s } }]
    });
    art.push({
      id: `${id}_window`, label: `${d.pos === 'front' ? 'Front' : 'Rear'} ${key} window`, group: 'Windows',
      actions: { on: 'Lower window', off: 'Raise window' },
      components: [`${id}_glass`, `${id}_window_frame`, `${id}_outer_panel`, `${id}_trim_panel`],
      transforms: [{ node: glassPivot.name, translate: [0, -(P.doors.bU - P.glass.cowlU > 0 ? 0.36 : 0.3), 0] }],
      duration: 1600
    });
    if (d.pos === 'front') {
      // Door-mounted mirror with a fold pivot at its base.
      const mu = g.cowlU + 0.1, my = B.belt(mu) + 0.03, mz = B.wrap(B.xiAtU(mu, my), my).z;
      const mp = A.pivot(`tbx_pivot_mirror_${key}`, [X(mu), my, (mz + 0.01) * s], pivot);
      const housing = merge([
        roundedBox(0.09, 0.115, 0.19, 0.035, { at: [X(mu) - 0.03, my + 0.05, (mz + 0.12) * s] }),
        roundedBox(0.05, 0.04, 0.05, 0.012, { at: [X(mu), my + 0.01, (mz + 0.025) * s] })
      ]);
      A.add(`side_mirror_${key}`, housing, mp);
      A.add(`side_mirror_${key}`, roundedBox(0.006, 0.095, 0.165, 0.025, { at: [X(mu) - 0.077, my + 0.05, (mz + 0.12) * s] }), mp);
      art.push({
        id: `mirror_${key}`, label: `${key === 'left' ? 'Left' : 'Right'} mirror`, group: 'Mirrors',
        actions: { on: 'Fold mirror', off: 'Unfold mirror' }, components: [`side_mirror_${key}`],
        transforms: [{ node: mp.name, rotate: { axis: [0, 1, 0], degrees: -62 * s } }]
      });
    }
  }
}

/* ---------------------------------------------------- BONNET, BOOT, FUEL -- */

function buildClosures({ P, B, A, X, art }) {
  const h = P.hood;
  const hinge = A.pivot('tbx_pivot_hood', [X(h.rearU), B.hoodY(h.rearU) - 0.01, 0]);
  A.add('hood', B.hood(), hinge);
  // Hood inner reinforcement frame (visible when open).
  const strip = (u0, u1, z0, z1, along) => surface(along ? 12 : 1, along ? 1 : 12, (a, b) => {
    const u = along ? lerp(u0, u1, a) : lerp(u0, u1, b), z = along ? lerp(z0, z1, b) : lerp(z0, z1, a);
    return [X(u), B.hoodSurfaceY(u, z) - 0.03, z];
  });
  const innerFrame = [-0.55, 0, 0.55].map(z => strip(0.42, h.rearU - 0.06, z - 0.025, z + 0.025, true));
  innerFrame.push(strip(0.4, 0.45, -0.6, 0.6, false), strip(h.rearU - 0.1, h.rearU - 0.05, -0.7, 0.7, false));
  A.add('hood_inner_frame', merge(innerFrame), hinge);
  // Hinges.
  for (const { s } of SIDES) {
    A.add('hood_hinges', place(tube([[0, 0, 0], [0.06, -0.06, 0], [0.15, -0.05, 0]], 0.01, { radial: 6 }), { at: [X(h.rearU) - 0.02, B.hoodY(h.rearU) - 0.01, 0.62 * s] }), hinge);
  }
  // Prop rod: stowed along the radiator support, swings up when the bonnet opens.
  const propBase = [X(0.42), 0.72, -0.48];
  const prop = A.pivot('tbx_pivot_hood_prop_rod', propBase);
  A.add('hood_prop_rod', cylinder(0.005, 0.005, 0.72, { axis: 'z', at: [propBase[0], propBase[1], propBase[2] + 0.36], seg: 6 }), prop);
  A.add('hood_latch', roundedBox(0.06, 0.08, 0.1, 0.01, { at: [X(0.3), 0.7, 0] }));
  art.push({
    id: 'hood', label: 'Bonnet (hood)', group: 'Body',
    actions: { on: 'Open bonnet', off: 'Close bonnet' },
    components: ['hood', 'hood_inner_frame', 'hood_hinges', 'hood_latch', 'hood_prop_rod'],
    transforms: [
      { node: hinge.name, rotate: { axis: [0, 0, 1], degrees: 54 } },
      { node: prop.name, rotate: { axis: [1, 0, 0], degrees: -75 }, delay: 0.15 }
    ], duration: 1300
  });

  // Boot lid: deck, rear face, inner lamps and plate recess.
  const d = P.deck;
  const lidHinge = A.pivot('tbx_pivot_trunk_lid', [X(d.u0 + 0.02), B.deckY(d.u0) - 0.01, 0]);
  const { geometry: deck } = B.deckLid();
  const rearFace = B.both(B.region({ xi0: B.xiLid, xi1: 1, yLow: P.rearPanelTop + 0.004, yHigh: B.edgeY, nu: 12, nv: 6 }));
  A.add('trunk_lid', merge([deck, rearFace]), lidHinge);
  const L = P.lamps;
  for (const { key, s } of SIDES) {
    const xi0 = B.xiLid + 0.002, xi1 = B.xiAtZ(L.tailInnerZ, 0.9, 'rear');
    A.add(`tail_lamp_inner_${key}`, handed(B.region({ xi0, xi1, yLow: L.tailLow + 0.03, yHigh: xi => B.edgeY(xi) - 0.012, nu: 6, nv: 3, offset: 0.004 }), s), lidHinge);
    // Gooseneck hinge arms (move with the lid).
    A.add('trunk_lid_hinges', place(tube([[0, 0, 0], [-0.08, -0.1, 0], [-0.25, -0.08, 0], [-0.33, 0.0, 0]], 0.012, { radial: 6 }), { at: [X(d.u0 + 0.02), B.deckY(d.u0) - 0.02, 0.5 * s] }), lidHinge);
  }
  const plateY = (P.rearPanelTop + B.top(1).y) / 2;
  A.add('license_plate_recess', B.both(B.region({ xi0: B.xiAtZ(0.16, plateY, 'rear'), xi1: 1, yLow: P.rearPanelTop + 0.02, yHigh: P.rearPanelTop + 0.17, nu: 5, nv: 2, offset: 0.004 })), lidHinge);
  A.add('license_plate_lamps', B.both(B.region({ xi0: B.xiAtZ(0.1, 0.8, 'rear'), xi1: B.xiAtZ(0.06, 0.8, 'rear'), yLow: P.rearPanelTop + 0.176, yHigh: P.rearPanelTop + 0.19, nu: 2, nv: 1, offset: 0.006 })), lidHinge);
  A.add('trunk_lid_inner_frame', merge([
    box(0.5, 0.02, 0.05, { at: [X(d.u0 + 0.28), B.deckY(d.u0 + 0.28) - 0.05, 0.4] }),
    box(0.5, 0.02, 0.05, { at: [X(d.u0 + 0.28), B.deckY(d.u0 + 0.28) - 0.05, -0.4] }),
    box(0.05, 0.02, 1.0, { at: [X(d.u0 + 0.45), B.deckY(d.u0 + 0.45) - 0.05, 0] })
  ]), lidHinge);
  A.add('trunk_latch', roundedBox(0.05, 0.05, 0.12, 0.01, { at: [X(P.L - 0.1), P.rearPanelTop + 0.02, 0] }));
  art.push({
    id: 'trunk_lid', label: 'Boot lid (trunk)', group: 'Body',
    actions: { on: 'Open boot', off: 'Close boot' },
    components: ['trunk_lid', 'tail_lamp_inner_left', 'tail_lamp_inner_right', 'trunk_lid_hinges', 'license_plate_recess', 'license_plate_lamps', 'trunk_lid_inner_frame', 'trunk_latch'],
    transforms: [{ node: lidHinge.name, rotate: { axis: [0, 0, 1], degrees: -72 } }], duration: 1300
  });

  // Fuel filler door on the left rear quarter.
  const fu0 = P.axleRU + 0.1, fu1 = fu0 + 0.17, fy0 = B.archY(fu0 + 0.085, P.axleRU) + 0.07;
  const fp = A.pivot('tbx_pivot_fuel_door', [X(fu0), fy0 + 0.075, -B.HWy(fy0)]);
  const fd = B.region({ xi0: B.xiAtU(fu0, fy0), xi1: B.xiAtU(fu1, fy0), yLow: fy0, yHigh: fy0 + 0.15, nu: 5, nv: 4, offset: 0.004 });
  A.add('fuel_filler_door', mirrorZ(fd), fp);
  art.push({
    id: 'fuel_door', label: 'Fuel filler door', group: 'Body',
    actions: { on: 'Open fuel door', off: 'Close fuel door' }, components: ['fuel_filler_door', 'fuel_filler_cap'],
    transforms: [{ node: fp.name, rotate: { axis: [0, 1, 0], degrees: -80 } }]
  });
  B.fuelDoor = { u: (fu0 + fu1) / 2, y: fy0 + 0.075 };

  // Wipers: park on the cowl, lift to the service position.
  for (const [i, zBase] of [[0, -0.33], [1, 0.12]]) {
    const key = i === 0 ? 'driver' : 'passenger';
    const u = P.glass.cowlU + 0.03, y = B.topCenterY(u) + 0.01;
    const wp = A.pivot(`tbx_pivot_wiper_${key}`, [X(u), y, zBase]);
    const len = i === 0 ? 0.62 : 0.52;
    A.add(`wiper_arm_${key}`, merge([
      cylinder(0.012, 0.012, 0.025, { at: [X(u), y, zBase], seg: 10 }),
      box(0.012, 0.012, len, { at: [X(u) - 0.02, y + 0.012, zBase + len / 2] }),
      box(0.02, 0.018, len * 0.9, { at: [X(u) - 0.035, y + 0.02, zBase + len * 0.52] })
    ]), wp);
    art.push({
      id: `wiper_${key}`, label: `${i === 0 ? 'Driver' : 'Passenger'} wiper arm`, group: 'Body',
      actions: { on: 'Lift to service position', off: 'Lower onto glass' }, components: [`wiper_arm_${key}`],
      transforms: [{ node: wp.name, rotate: { axis: [1, 0, 0], degrees: -55 } }]
    });
  }
}

