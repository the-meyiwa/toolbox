/**
 * Structure, running gear, powertrain, engine bay, cabin and boot systems for
 * the procedural Corolla. Positions are derived from the profile's published
 * wheelbase, track, tyre size and axle location; component packaging (where a
 * battery or reservoir sits) is a Toolbox approximation and every such part
 * carries that caveat in its manifest metadata.
 */
import { merge, place, box, roundedBox, cylinder, sphere, torus, lathe, tube, extrude, helix, TAU } from './geometry.mjs';
import { SIDES, handed, deg } from './common.mjs';

const HOOD_REQ = [{ id: 'hood', state: true, reason: 'Open the bonnet first.' }];

/* ------------------------------------------------------------- STRUCTURE -- */

export function buildStructure({ P, B, A, X }) {
  const at = (u, y, z) => [X(u), y, z];
  const fw = P.glass.cowlU - 0.14; // firewall station
  B.firewallU = fw;
  const innerW = P.HW - 0.1;
  // Floor pan with transmission tunnel.
  A.add('floor_pan', merge([
    box(P.deck.u0 - fw, 0.02, innerW * 2, { at: at((fw + P.deck.u0) / 2, 0.235, 0) }),
    roundedBox(P.cabin.rearSeatU - 0.2 - fw, 0.15, 0.26, 0.05, { at: at((fw + P.cabin.rearSeatU - 0.2) / 2, 0.315, 0) })
  ]));
  // Firewall / bulkhead with cowl plenum ledge.
  A.add('firewall', merge([
    box(0.012, 0.68, innerW * 2 - 0.1, { at: at(fw, 0.59, 0) }),
    box(0.12, 0.012, innerW * 2 - 0.12, { at: at(fw + 0.06, 0.9, 0) })
  ]));
  for (const { key, s } of SIDES) {
    // Front side member (frame rail) running from the crash beam into the floor.
    A.add(`front_side_member_${key}`, tube([at(0.16, 0.44, 0.46 * s), at(0.6, 0.4, 0.46 * s), at(1.1, 0.34, 0.47 * s), at(fw + 0.05, 0.26, 0.5 * s), at(fw + 0.5, 0.22, 0.52 * s)], 0.045, { radial: 4 }));
    // Inner wing apron with strut tower.
    A.add(`strut_tower_${key}`, merge([
      box(1.05, 0.3, 0.012, { at: at(0.95, 0.6, 0.66 * s) }),
      cylinder(0.1, 0.095, 0.2, { at: at(P.axleFU + 0.02, 0.72, 0.585 * s), seg: 18 }),
      cylinder(0.096, 0.096, 0.012, { at: at(P.axleFU + 0.02, 0.82, 0.585 * s), seg: 18 })
    ]));
  }
  // Radiator core support (front end module).
  A.add('radiator_support', merge([
    box(0.05, 0.035, 1.26, { at: at(0.285, 0.76, 0) }),
    box(0.05, 0.04, 1.0, { at: at(0.3, 0.28, 0) }),
    box(0.05, 0.5, 0.04, { at: at(0.29, 0.52, 0.42) }),
    box(0.05, 0.5, 0.04, { at: at(0.29, 0.52, -0.42) })
  ]));
  A.add('front_bumper_reinforcement', merge([
    roundedBox(0.06, 0.1, 1.1, 0.02, { at: at(0.165, 0.45, 0) }),
    box(0.1, 0.07, 0.07, { at: at(0.22, 0.44, 0.46) }), box(0.1, 0.07, 0.07, { at: at(0.22, 0.44, -0.46) })
  ]));
  A.add('rear_bumper_reinforcement', roundedBox(0.06, 0.1, 1.0, 0.02, { at: at(P.L - 0.2, 0.44, 0) }));
  // Rear parcel shelf under the rear window.
  A.add('rear_parcel_shelf', box(P.deck.u0 - P.cabin.rearSeatU - 0.28, 0.015, innerW * 2 - 0.1, { at: at((P.cabin.rearSeatU + 0.28 + P.deck.u0) / 2, B.belt(P.deck.u0) - 0.05, 0) }));
  // Rear seat bulkhead with pass-through opening (seatbacks fold into it).
  const bu = P.cabin.rearSeatU + 0.32;
  A.add('rear_seat_bulkhead', merge([
    box(0.012, 0.2, innerW * 2 - 0.2, { at: at(bu, 0.92, 0) }),
    box(0.012, 0.52, 0.12, { at: at(bu, 0.55, innerW - 0.16) }),
    box(0.012, 0.52, 0.12, { at: at(bu, 0.55, -innerW + 0.16) })
  ]));
  // Front subframe (engine cradle) under the engine bay.
  A.add('front_subframe', merge([
    box(0.07, 0.05, 0.95, { at: at(P.axleFU - 0.18, 0.24, 0) }),
    box(0.07, 0.05, 0.95, { at: at(P.axleFU + 0.34, 0.24, 0) }),
    box(0.55, 0.05, 0.07, { at: at(P.axleFU + 0.08, 0.24, 0.44) }),
    box(0.55, 0.05, 0.07, { at: at(P.axleFU + 0.08, 0.24, -0.44) })
  ]));
}

/* ------------------------------------------------------- WHEELS & BRAKES -- */

function tyreGeometry(P) {
  const R = P.tyreOD / 2, r = P.rimD / 2, w = P.tyre.width, sh = R - r;
  const pr = [
    [r + 0.004, -w / 2 + 0.016], [r + sh * 0.35, -w / 2 - 0.002], [r + sh * 0.75, -w / 2 + 0.002], [R - 0.012, -w / 2 + 0.012],
    [R, -w / 2 + 0.03]
  ];
  // Four circumferential tread grooves.
  const grooves = [-0.055, -0.018, 0.018, 0.055].map(g => g * (w / 0.205));
  for (const g of grooves) pr.push([R, g - 0.007], [R - 0.008, g - 0.005], [R - 0.008, g + 0.005], [R, g + 0.007]);
  pr.push([R, w / 2 - 0.03], [R - 0.012, w / 2 - 0.012], [r + sh * 0.75, w / 2 - 0.002], [r + sh * 0.35, w / 2 + 0.002], [r + 0.004, w / 2 - 0.016]);
  return lathe(pr.map(([a, b]) => [a, -b]), { axis: 'z', seg: 44 });
}

function rimGeometry(P, style = 'alloy') {
  const r = P.rimD / 2, w = P.tyre.width - 0.03;
  const barrel = lathe([[r + 0.012, w / 2], [r - 0.004, w / 2 - 0.008], [r - 0.012, w / 2 - 0.02], [r - 0.012, -w / 2 + 0.02], [r - 0.004, -w / 2 + 0.008], [r + 0.012, -w / 2]], { axis: 'z', seg: 40 });
  const faceZ = 0.04;
  const parts = [barrel];
  if (style === 'alloy') {
    const ring = [], hole = [];
    for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; ring.push([Math.cos(a) * (r - 0.008), Math.sin(a) * (r - 0.008)]); hole.push([Math.cos(a) * (r - 0.035), Math.sin(a) * (r - 0.035)]); }
    parts.push(extrude(ring, 0.018, { at: [0, 0, faceZ - 0.012] }, { holes: [hole.reverse()] }));
    parts.push(cylinder(0.075, 0.07, 0.035, { axis: 'z', at: [0, 0, faceZ], seg: 24 }));
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU + Math.PI / 2;
      const c = Math.cos(a), s = Math.sin(a), n = [-s, c];
      const r0 = 0.065, r1 = r - 0.03, w0 = 0.028, w1 = 0.02;
      const pts = [[c * r0 + n[0] * w0, s * r0 + n[1] * w0], [c * r1 + n[0] * w1, s * r1 + n[1] * w1], [c * r1 - n[0] * w1, s * r1 - n[1] * w1], [c * r0 - n[0] * w0, s * r0 - n[1] * w0]];
      parts.push(extrude(pts, 0.022, { at: [0, 0, faceZ - 0.004] }));
    }
  } else {
    // Steel wheel: dished disc with ventilation slots (compact spare / base grades).
    parts.push(lathe([[r - 0.012, 0.0], [0.13, 0.02], [0.09, 0.045], [0.02, 0.045]], { axis: 'z', seg: 32 }));
  }
  // Lug nuts on a 5 × 100 mm pattern (M12 × 1.5).
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU + Math.PI / 2 + Math.PI / 5;
    parts.push(cylinder(0.0105, 0.0105, 0.025, { axis: 'z', seg: 6, at: [Math.cos(a) * 0.05, Math.sin(a) * 0.05, faceZ + 0.025] }));
  }
  return merge(parts);
}

export function buildWheelsAndBrakes({ P, B, A, X, art }) {
  const corners = [
    { pos: 'front', axle: P.axleFU, track: P.trackF },
    { pos: 'rear', axle: P.axleRU, track: P.trackR }
  ];
  B.wheelPivots = {};
  for (const c of corners) for (const { key, s, label } of SIDES) {
    const id = `${c.pos}_${key}`;
    const center = [X(c.axle), P.wheelY, (c.track / 2) * s];
    const wp = A.pivot(`tbx_pivot_wheel_${id}`, center);
    B.wheelPivots[id] = wp;
    const place3 = g => place(handed(g, s), { at: center });
    A.add(`wheel_rim_${id}`, place3(rimGeometry(P)), wp);
    const tp = A.pivot(`tbx_pivot_tyre_${id}`, center, wp);
    A.add(`tyre_${id}`, place3(tyreGeometry(P)), tp);
    // Valve stem.
    A.add(`wheel_rim_${id}`, place3(cylinder(0.004, 0.004, 0.03, { axis: 'z', at: [0, P.rimD / 2 - 0.02, 0.05], seg: 6 })), wp);

    const hubZ = (c.track / 2 + 0.035) * s;
    A.add(`wheel_hub_${id}`, merge([
      cylinder(0.068, 0.068, 0.02, { axis: 'z', at: [center[0], center[1], hubZ - 0.01 * s], seg: 20 }),
      cylinder(0.045, 0.05, 0.06, { axis: 'z', at: [center[0], center[1], hubZ - 0.05 * s], seg: 16 }),
      ...[0, 1, 2, 3, 4].map(i => { const a = i / 5 * TAU + Math.PI / 2 + Math.PI / 5; return cylinder(0.006, 0.006, 0.04, { axis: 'z', seg: 6, at: [center[0] + Math.cos(a) * 0.05, center[1] + Math.sin(a) * 0.05, hubZ + 0.01 * s] }); })
    ]));

    if (c.pos === 'front') {
      // 275 mm ventilated disc, single-piston floating caliper trailing the axle.
      const dz = hubZ - 0.045 * s;
      A.add(`brake_disc_${id}`, lathe([[0.07, 0.03], [0.07, 0.012], [0.08, 0.012], [0.1375, 0.012], [0.1375, -0.012], [0.08, -0.012], [0.075, 0.0], [0.07, 0.03]].map(([r, a]) => [r, a * s]), { axis: 'z', seg: 40, at: [center[0], center[1], dz] }));
      const cp = A.pivot(`tbx_pivot_caliper_${id}`, [center[0] - 0.1, center[1] + 0.04, dz]);
      const ang = deg(160);
      const cx = center[0] + Math.cos(ang) * 0.118, cy = center[1] + Math.sin(ang) * 0.118;
      A.add(`brake_caliper_${id}`, merge([
        place(roundedBox(0.05, 0.13, 0.085, 0.015), { rot: [0, 0, ang - Math.PI / 2 + Math.PI / 2], at: [cx, cy, dz] }),
        place(cylinder(0.024, 0.024, 0.03, { axis: 'z', seg: 14 }), { at: [cx, cy, dz - 0.05 * s] })
      ]), cp);
      A.add(`brake_pads_${id}`, merge([
        place(box(0.035, 0.1, 0.01), { rot: [0, 0, ang], at: [center[0] + Math.cos(ang) * 0.112, center[1] + Math.sin(ang) * 0.112, dz + 0.018] }),
        place(box(0.035, 0.1, 0.01), { rot: [0, 0, ang], at: [center[0] + Math.cos(ang) * 0.112, center[1] + Math.sin(ang) * 0.112, dz - 0.018] })
      ]), cp);
      A.add(`steering_knuckle_${id}`, merge([
        roundedBox(0.08, 0.26, 0.05, 0.02, { at: [center[0] + 0.01, center[1] + 0.02, hubZ - 0.1 * s] }),
        roundedBox(0.14, 0.04, 0.04, 0.012, { at: [center[0] - 0.09, center[1] + 0.02, hubZ - 0.11 * s] })
      ]));
      art.push({
        id: `caliper_${id}`, label: `${label} front brake caliper`, group: 'Brakes',
        actions: { on: 'Remove caliper', off: 'Refit caliper' }, components: [`brake_caliper_${id}`, `brake_pads_${id}`, `brake_disc_${id}`],
        requires: [{ id: `wheel_${id}`, state: true, reason: 'Remove the wheel first.' }],
        transforms: [{ node: cp.name, translate: [-0.05, 0.1, 0.22 * s] }]
      });
    } else {
      // Leading/trailing drum (≈229 mm). Removing the drum exposes shoes and wheel cylinder.
      const dz = hubZ - 0.04 * s;
      const dp = A.pivot(`tbx_pivot_brake_drum_${id}`, [center[0], center[1], dz]);
      A.add(`brake_drum_${id}`, lathe([[0.03, 0.03], [0.118, 0.03], [0.118, -0.03], [0.124, -0.03], [0.124, 0.034], [0.03, 0.034]].map(([r, a]) => [r, a * s]), { axis: 'z', seg: 36, at: [center[0], center[1], dz] }), dp);
      A.add(`brake_backing_plate_${id}`, cylinder(0.13, 0.13, 0.006, { axis: 'z', at: [center[0], center[1], dz - 0.036 * s], seg: 32 }));
      A.add(`brake_shoes_${id}`, merge([
        torus(0.105, 0.01, { arc: deg(130), at: [center[0], center[1], dz - 0.01 * s], rot: [0, 0, deg(25)], seg: 16, tubeSeg: 4 }),
        torus(0.105, 0.01, { arc: deg(130), at: [center[0], center[1], dz - 0.01 * s], rot: [0, 0, deg(205)], seg: 16, tubeSeg: 4 }),
        cylinder(0.012, 0.012, 0.07, { axis: 'x', at: [center[0], center[1] + 0.09, dz - 0.01 * s], seg: 10 })
      ]));
      art.push({
        id: `brake_drum_${id}`, label: `${label} rear brake drum`, group: 'Brakes',
        actions: { on: 'Remove drum', off: 'Refit drum' }, components: [`brake_drum_${id}`, `brake_shoes_${id}`, `brake_backing_plate_${id}`],
        requires: [{ id: `wheel_${id}`, state: true, reason: 'Remove the wheel first.' }],
        transforms: [{ node: dp.name, translate: [0, 0, 0.24 * s] }]
      });
    }
    const brakeReq = c.pos === 'front' ? `caliper_${id}` : `brake_drum_${id}`;
    art.push({
      id: `wheel_${id}`, label: `${label} ${c.pos} wheel`, group: 'Wheels',
      actions: { on: 'Remove wheel (rim + tyre)', off: 'Refit wheel' },
      components: [`wheel_rim_${id}`, `tyre_${id}`, `wheel_hub_${id}`],
      requires: [{ id: brakeReq, state: false, reason: c.pos === 'front' ? 'Refit the caliper first.' : 'Refit the drum first.' }],
      transforms: [{ node: wp.name, translate: [0, 0.03, 0.62 * s] }], duration: 1200
    });
    art.push({
      id: `tyre_${id}`, label: `${label} ${c.pos} tyre`, group: 'Wheels',
      actions: { on: 'Dismount tyre from rim', off: 'Mount tyre on rim' },
      components: [`tyre_${id}`, `wheel_rim_${id}`],
      requires: [{ id: `wheel_${id}`, state: true, reason: 'Remove the wheel from the car first.' }],
      transforms: [{ node: tp.name, translate: [0, 0, 0.34 * s] }], duration: 1100
    });
  }
}

/* -------------------------------------------- SUSPENSION & STEERING -- */

export function buildSuspensionAndSteering({ P, B, A, X, art }) {
  const at = (u, y, z) => [X(u), y, z];
  const fa = P.axleFU, ra = P.axleRU, wy = P.wheelY;
  for (const { key, s } of SIDES) {
    const tz = P.trackF / 2;
    // Front MacPherson strut.
    const lower = at(fa + 0.005, wy + 0.13, (tz - 0.13) * s), upper = at(fa + 0.02, 0.8, 0.585 * s);
    A.add(`front_strut_${key}`, merge([
      tube([lower, at(fa + 0.012, 0.6, (tz - 0.155) * s)], 0.026, { radial: 12 }),
      tube([at(fa + 0.012, 0.58, (tz - 0.155) * s), upper], 0.011, { radial: 8 }),
      cylinder(0.05, 0.05, 0.012, { at: at(fa + 0.012, 0.6, (tz - 0.155) * s), seg: 16 })
    ]));
    A.add(`front_coil_spring_${key}`, helix(0.072, 0.009, 0.19, 5, { at: at(fa + 0.014, 0.605, (tz - 0.16) * s), rot: [deg(-9) * s, 0, 0] }));
    A.add(`front_strut_mount_${key}`, cylinder(0.075, 0.07, 0.035, { at: upper, seg: 16 }));
    // L-shaped lower control arm with two bushings.
    const bj = at(fa - 0.005, wy - 0.12, (tz - 0.1) * s);
    A.add(`front_lower_control_arm_${key}`, merge([
      tube([bj, at(fa - 0.12, 0.225, 0.4 * s)], 0.018, { radial: 6 }),
      tube([bj, at(fa + 0.2, 0.23, 0.42 * s)], 0.02, { radial: 6 }),
      cylinder(0.03, 0.03, 0.06, { axis: 'x', at: at(fa - 0.12, 0.225, 0.4 * s), seg: 12 }),
      cylinder(0.04, 0.04, 0.05, { axis: 'y', at: at(fa + 0.2, 0.23, 0.42 * s), seg: 12 }),
      sphere(0.022, { at: bj })
    ]));
    // Stabiliser link.
    A.add('front_stabilizer_bar', tube([at(fa + 0.06, 0.3, (tz - 0.2) * s), at(fa + 0.02, 0.5, (tz - 0.17) * s)], 0.008, { radial: 6 }));
    // Tie rod + rack gaiter.
    A.add(`tie_rod_${key}`, merge([
      tube([at(fa + 0.14, 0.34, 0.36 * s), at(fa + 0.11, wy + 0.04, (tz - 0.15) * s)], 0.011, { radial: 6 }),
      lathe([[0.022, 0], [0.03, 0.02], [0.022, 0.035], [0.03, 0.05], [0.022, 0.065], [0.03, 0.08], [0.016, 0.1]].map(([r, a]) => [r, a * s]), { axis: 'z', seg: 12, at: at(fa + 0.14, 0.34, 0.33 * s) })
    ]));

    // Rear torsion-beam trailing arm, coil spring, damper.
    const rz = P.trackR / 2;
    A.add(`rear_trailing_arm_${key}`, merge([
      tube([at(ra - 0.52, 0.31, 0.6 * s), at(ra - 0.3, 0.27, 0.62 * s), at(ra, wy - 0.01, (rz - 0.13) * s)], 0.035, { radial: 6 }),
      cylinder(0.045, 0.045, 0.07, { axis: 'z', at: at(ra - 0.52, 0.31, 0.6 * s), seg: 14 })
    ]));
    A.add(`rear_coil_spring_${key}`, helix(0.065, 0.009, 0.22, 5, { at: at(ra - 0.14, 0.26, 0.52 * s) }));
    A.add(`rear_shock_absorber_${key}`, merge([
      tube([at(ra + 0.07, wy - 0.04, (rz - 0.2) * s), at(ra + 0.1, 0.5, 0.56 * s)], 0.022, { radial: 10 }),
      tube([at(ra + 0.1, 0.48, 0.56 * s), at(ra + 0.12, 0.66, 0.55 * s)], 0.009, { radial: 6 })
    ]));
    A.add(`rear_hub_carrier_${key}`, roundedBox(0.12, 0.12, 0.05, 0.02, { at: at(ra, wy, (rz - 0.1) * s) }));
  }
  A.add('front_stabilizer_bar', tube([
    at(fa + 0.06, 0.3, 0.62), at(fa + 0.24, 0.28, 0.5), at(fa + 0.26, 0.27, 0.28), at(fa + 0.26, 0.27, -0.28), at(fa + 0.24, 0.28, -0.5), at(fa + 0.06, 0.3, -0.62)
  ], 0.012, { radial: 6 }));
  A.add('rear_torsion_beam', merge([
    roundedBox(0.09, 0.07, 1.16, 0.02, { at: at(ra - 0.3, 0.265, 0) })
  ]));
  // Rack-and-pinion steering gear behind the axle line.
  A.add('steering_rack', merge([
    cylinder(0.028, 0.028, 0.66, { axis: 'z', at: at(fa + 0.14, 0.34, 0), seg: 14 }),
    cylinder(0.04, 0.04, 0.12, { axis: 'y', at: at(fa + 0.14, 0.38, -0.3), seg: 14 })
  ]));
  const colBottom = at(B.firewallU - 0.1, 0.62, -0.37);
  A.add('steering_intermediate_shaft', merge([
    tube([at(fa + 0.14, 0.44, -0.3), at(fa + 0.35, 0.52, -0.33), colBottom], 0.012, { radial: 6 }),
    sphere(0.02, { at: colBottom })
  ]));

  // Steering articulation: turns road wheels and the steering wheel together.
  for (const [id, dir, labelTxt] of [['steer_left', 1, 'Turn steering left'], ['steer_right', -1, 'Turn steering right']]) {
    art.push({
      id, label: labelTxt.replace('Turn steering', 'Steering lock'), group: 'Steering', exclusive: 'steering',
      actions: { on: labelTxt, off: 'Centre steering' },
      components: ['steering_wheel', 'steering_rack', 'tie_rod_left', 'tie_rod_right', 'steering_column', 'steering_knuckle_front_left', 'steering_knuckle_front_right', 'tyre_front_left', 'tyre_front_right', 'wheel_rim_front_left', 'wheel_rim_front_right'],
      transforms: [
        { node: B.wheelPivots.front_left.name, rotate: { axis: [0, 1, 0], degrees: dir > 0 ? 34 : -29 } },
        { node: B.wheelPivots.front_right.name, rotate: { axis: [0, 1, 0], degrees: dir > 0 ? 29 : -34 } },
        { node: 'tbx_pivot_steering_wheel', rotate: { axis: [-Math.cos(deg(25)), Math.sin(deg(25)), 0], degrees: 450 * dir } }
      ], duration: 1800
    });
  }
}

/* ------------------------------------------------------------ POWERTRAIN -- */

/** Engine-bay packaging keeps tall parts under the bonnet line. */
const squash = y => (y < 0.5 ? y : 0.5 + (y - 0.5) * 0.86);

export function buildPowertrain({ P, B, A, X, art }) {
  const at = (u, y, z) => [X(u), squash(y), z];
  const uE = P.engine.uCrank, yC = 0.44, zE = 0.12;
  const cyl = [0, 1, 2, 3].map(i => zE + 0.132 - i * 0.088); // cylinder 1 at the timing-chain (right) end
  B.engine = { uE, yC, zE, cyl };
  // Aluminium block with skirt and ribbing.
  A.add('engine_block', merge([
    roundedBox(0.29, 0.3, 0.44, 0.02, { at: at(uE + 0.01, 0.5, zE) }),
    ...[-0.1, 0, 0.1].map(dz => box(0.012, 0.22, 0.03, { at: at(uE - 0.14, 0.48, zE + dz) }))
  ]));
  A.add('cylinder_head', roundedBox(0.27, 0.12, 0.45, 0.02, { at: at(uE + 0.01, 0.71, zE) }));
  A.add('valve_cover', merge([
    roundedBox(0.22, 0.07, 0.43, 0.03, { at: at(uE + 0.02, 0.8, zE) }),
    roundedBox(0.06, 0.02, 0.36, 0.008, { at: at(uE + 0.02, 0.84, zE) })
  ]));
  A.add('oil_pan', merge([
    roundedBox(0.3, 0.07, 0.44, 0.02, { at: at(uE + 0.01, 0.315, zE) }),
    roundedBox(0.22, 0.07, 0.28, 0.02, { at: at(uE + 0.02, 0.255, zE - 0.04) })
  ]));
  A.add('oil_drain_plug', cylinder(0.011, 0.011, 0.014, { at: at(uE + 0.06, 0.214, zE - 0.07), seg: 6 }));
  A.add('timing_chain_cover', roundedBox(0.3, 0.48, 0.035, 0.03, { at: at(uE + 0.0, 0.55, zE + 0.24) }));
  // Cartridge-type oil filter housing at the front of the block.
  const ofp = A.pivot('tbx_pivot_oil_filter_cap', at(uE - 0.17, 0.33, zE + 0.07));
  A.add('oil_filter_housing', cylinder(0.042, 0.042, 0.075, { at: at(uE - 0.17, 0.37, zE + 0.07), seg: 18 }));
  A.add('oil_filter_cartridge', merge([
    cylinder(0.042, 0.042, 0.03, { at: at(uE - 0.17, 0.32, zE + 0.07), seg: 6 }),
    cylinder(0.03, 0.03, 0.09, { at: at(uE - 0.17, 0.37, zE + 0.07), seg: 14 })
  ]), ofp);
  art.push({
    id: 'oil_filter', label: 'Oil filter cartridge', group: 'Engine service',
    actions: { on: 'Remove filter cap and cartridge', off: 'Refit filter' }, components: ['oil_filter_cartridge', 'oil_filter_housing'],
    requires: HOOD_REQ, transforms: [{ node: ofp.name, translate: [0, -0.2, 0] }]
  });
  // Intake: four runners into a plenum on the radiator side, throttle body on the left end.
  const runners = cyl.map(z => tube([at(uE - 0.12, 0.72, z), at(uE - 0.22, 0.79, z), at(uE - 0.29, 0.72, z), at(uE - 0.27, 0.62, z)], 0.024, { radial: 8 }));
  A.add('intake_manifold', merge([
    ...runners,
    cylinder(0.06, 0.06, 0.4, { axis: 'z', at: at(uE - 0.27, 0.6, zE + 0.01), seg: 18 })
  ]));
  A.add('throttle_body', merge([
    cylinder(0.038, 0.038, 0.07, { axis: 'z', at: at(uE - 0.27, 0.62, zE - 0.225), seg: 16 }),
    roundedBox(0.05, 0.05, 0.03, 0.01, { at: at(uE - 0.25, 0.67, zE - 0.225) })
  ]));
  // Exhaust manifold (rear side), catalytic converter, oxygen sensors.
  const exPts = cyl.map(z => tube([at(uE + 0.14, 0.7, z), at(uE + 0.2, 0.66, z), at(uE + 0.24, 0.55, (z + zE) / 2), at(uE + 0.25, 0.48, zE)], 0.022, { radial: 8 }));
  A.add('exhaust_manifold', merge(exPts));
  A.add('exhaust_heat_shield', roundedBox(0.03, 0.22, 0.44, 0.01, { at: at(uE + 0.29, 0.62, zE), rot: [0, 0, deg(-12)] }));
  A.add('catalytic_converter', merge([
    tube([at(uE + 0.25, 0.48, zE), at(uE + 0.27, 0.38, zE - 0.02), at(uE + 0.3, 0.27, zE - 0.06)], 0.055, { radial: 14 })
  ]));
  A.add('oxygen_sensors', merge([
    cylinder(0.009, 0.009, 0.06, { axis: 'x', at: at(uE + 0.3, 0.5, zE), seg: 8 }),
    cylinder(0.009, 0.009, 0.06, { axis: 'x', at: at(uE + 0.36, 0.25, zE - 0.06), seg: 8 })
  ]));
  // Exhaust pipe along the tunnel to the rear muffler.
  const fw = B.firewallU;
  A.add('exhaust_pipe', merge([
    tube([at(uE + 0.3, 0.26, zE - 0.06), at(fw + 0.05, 0.22, 0.02), at(P.cabin.frontSeatU, 0.27, 0), at(P.cabin.rearSeatU - 0.3, 0.27, 0), at(P.axleRU - 0.45, 0.25, 0.05), at(P.axleRU + 0.1, 0.33, 0.18), at(P.L - 0.45, 0.3, 0.2)], 0.026, { radial: 8, seg: 80 }),
    cylinder(0.06, 0.06, 0.34, { axis: 'x', at: at((P.cabin.frontSeatU + P.cabin.rearSeatU) / 2, 0.26, 0), seg: 16 })
  ]));
  A.add('muffler', merge([
    roundedBox(0.26, 0.15, 0.46, 0.06, { at: at(P.L - 0.36, 0.3, 0.3) }),
    tube([at(P.L - 0.28, 0.28, 0.46), at(P.L - 0.16, 0.26, 0.47)], 0.025, { radial: 10 })
  ]));
  // Ignition coils (coil-on-plug) and spark plugs.
  const coilPivots = [], plugPivots = [];
  cyl.forEach((z, i) => {
    const cp = A.pivot(`tbx_pivot_ignition_coil_${i + 1}`, at(uE + 0.02, 0.85, z));
    A.add('ignition_coils', merge([
      cylinder(0.017, 0.017, 0.12, { at: at(uE + 0.02, 0.81, z), seg: 10 }),
      roundedBox(0.05, 0.035, 0.04, 0.008, { at: at(uE + 0.015, 0.87, z) })
    ]), cp);
    coilPivots.push(cp.name);
    const pp = A.pivot(`tbx_pivot_spark_plug_${i + 1}`, at(uE + 0.02, 0.7, z));
    A.add('spark_plugs', merge([
      cylinder(0.007, 0.007, 0.05, { at: at(uE + 0.02, 0.73, z), seg: 8 }),
      cylinder(0.0105, 0.0105, 0.02, { at: at(uE + 0.02, 0.7, z), seg: 6 }),
      cylinder(0.007, 0.007, 0.02, { at: at(uE + 0.02, 0.68, z), seg: 8 })
    ]), pp);
    plugPivots.push(pp.name);
  });
  art.push({
    id: 'ignition_coils', label: 'Ignition coils', group: 'Engine service',
    actions: { on: 'Pull ignition coils', off: 'Refit ignition coils' }, components: ['ignition_coils', 'spark_plugs', 'valve_cover'],
    requires: [...HOOD_REQ, { id: 'spark_plugs', state: false, reason: 'Refit the spark plugs first.' }],
    transforms: coilPivots.map((node, i) => ({ node, translate: [0, 0.17, 0], delay: i * 0.08 }))
  });
  art.push({
    id: 'spark_plugs', label: 'Spark plugs', group: 'Engine service',
    actions: { on: 'Remove spark plugs', off: 'Refit spark plugs' }, components: ['spark_plugs', 'ignition_coils', 'cylinder_head'],
    requires: [{ id: 'ignition_coils', state: true, reason: 'Pull the ignition coils first.' }],
    transforms: plugPivots.map((node, i) => ({ node, translate: [0, 0.26, 0], delay: i * 0.08 }))
  });
  // Oil filler cap and dipstick.
  const capP = A.pivot('tbx_pivot_oil_filler_cap', at(uE + 0.06, 0.845, zE - 0.15));
  A.add('oil_filler_cap', cylinder(0.03, 0.03, 0.022, { at: at(uE + 0.06, 0.848, zE - 0.15), seg: 16 }), capP);
  art.push({
    id: 'oil_filler_cap', label: 'Oil filler cap', group: 'Engine service',
    actions: { on: 'Remove oil filler cap', off: 'Refit cap' }, components: ['oil_filler_cap', 'valve_cover'],
    requires: HOOD_REQ, transforms: [{ node: capP.name, translate: [0, 0.1, 0], rotate: { axis: [0, 1, 0], degrees: -120 } }]
  });
  const dsP = A.pivot('tbx_pivot_oil_dipstick', at(uE - 0.2, 0.84, zE + 0.02));
  A.add('oil_dipstick', merge([
    tube([at(uE - 0.2, 0.84, zE + 0.02), at(uE - 0.19, 0.6, zE + 0.02), at(uE - 0.15, 0.4, zE + 0.02)], 0.004, { radial: 5 }),
    torus(0.02, 0.006, { axis: 'x', at: at(uE - 0.2, 0.865, zE + 0.02), seg: 14, tubeSeg: 5 })
  ]), dsP);
  A.add('oil_dipstick_tube', tube([at(uE - 0.2, 0.8, zE + 0.02), at(uE - 0.19, 0.6, zE + 0.02), at(uE - 0.15, 0.42, zE + 0.02)], 0.008, { radial: 6 }));
  art.push({
    id: 'oil_dipstick', label: 'Engine oil dipstick', group: 'Engine service',
    actions: { on: 'Pull dipstick', off: 'Reinsert dipstick' }, components: ['oil_dipstick', 'oil_dipstick_tube'],
    requires: HOOD_REQ, transforms: [{ node: dsP.name, translate: [0, 0.34, 0] }], duration: 1200
  });
  // Front-end accessory drive on the right (timing) end.
  const beltZ = zE + 0.275;
  const pulleys = [
    { id: 'crankshaft_pulley', u: uE, y: yC, r: 0.075 },
    { id: 'ac_compressor', u: uE - 0.17, y: 0.36, r: 0.055 },
    { id: 'alternator', u: uE - 0.17, y: 0.63, r: 0.032 },
    { id: 'water_pump', u: uE - 0.06, y: 0.62, r: 0.05 },
    { id: 'drive_belt_tensioner', u: uE - 0.03, y: 0.52, r: 0.032 }
  ];
  for (const p of pulleys) A.add(p.id, cylinder(p.r, p.r, 0.025, { axis: 'z', at: at(p.u, p.y, beltZ), seg: 20 }));
  A.add('alternator', cylinder(0.065, 0.065, 0.12, { axis: 'z', at: at(uE - 0.17, 0.63, beltZ - 0.08), seg: 20 }));
  A.add('ac_compressor', cylinder(0.06, 0.06, 0.15, { axis: 'z', at: at(uE - 0.17, 0.36, beltZ - 0.09), seg: 20 }));
  const beltPts = [];
  const cx = pulleys.reduce((a, p) => a + p.u, 0) / pulleys.length, cy = pulleys.reduce((a, p) => a + p.y, 0) / pulleys.length;
  const order = [0, 1, 2, 3, 4];
  for (const i of order) {
    const p = pulleys[i], base = Math.atan2(p.y - cy, -(p.u - cx));
    for (const d of [-0.6, 0, 0.6]) { const a = base + d; beltPts.push(at(p.u - Math.cos(a) * (p.r + 0.004), p.y + Math.sin(a) * (p.r + 0.004), beltZ)); }
  }
  A.add('drive_belt', tube(beltPts, 0.005, { closed: true, radial: 4, seg: 90 }));
  // Engine mounts.
  A.add('engine_mounts', merge([
    roundedBox(0.1, 0.06, 0.2, 0.015, { at: at(uE - 0.05, 0.74, 0.5) }),
    roundedBox(0.1, 0.07, 0.12, 0.015, { at: at(uE + 0.05, 0.61, -0.47) }),
    tube([at(uE + 0.15, 0.3, zE - 0.05), at(P.axleFU + 0.34, 0.25, 0.0)], 0.018, { radial: 6 })
  ]));
  // Transaxle (CVT / automatic / manual depending on grade) on the left.
  A.add('transaxle', merge([
    lathe([[0.19, 0], [0.2, -0.04], [0.17, -0.1], [0.14, -0.14]], { axis: 'z', seg: 24, at: at(uE + 0.02, 0.45, zE - 0.22) }),
    roundedBox(0.34, 0.3, 0.24, 0.04, { at: at(uE + 0.04, 0.44, zE - 0.5) }),
    cylinder(0.09, 0.09, 0.14, { axis: 'z', at: at(P.axleFU, P.wheelY + 0.02, zE - 0.46), seg: 18 })
  ]));
  A.add('starter_motor', cylinder(0.045, 0.045, 0.16, { axis: 'z', at: at(uE + 0.2, 0.42, zE - 0.28), seg: 14 }));
  // Driveshafts (CV axles). Right shaft is longer and uses an intermediate bearing.
  for (const { key, s } of SIDES) {
    const hub = at(P.axleFU, P.wheelY, (P.trackF / 2 - 0.1) * s);
    const inner = s < 0 ? at(P.axleFU, P.wheelY + 0.02, zE - 0.55) : at(P.axleFU, P.wheelY + 0.02, zE + 0.2);
    A.add(`driveshaft_${key}`, merge([
      tube([inner, hub], 0.013, { radial: 8 }),
      lathe([[0.04, 0], [0.045, 0.03], [0.03, 0.06], [0.04, 0.08], [0.02, 0.11]], { axis: 'z', seg: 14, at: [hub[0], hub[1], hub[2] - 0.11 * s] }),
      lathe([[0.045, 0], [0.05, 0.04], [0.03, 0.08], [0.02, 0.1]], { axis: 'z', seg: 14, at: [inner[0], inner[1], inner[2]] })
    ]));
  }
  A.add('driveshaft_right', tube([at(P.axleFU, P.wheelY + 0.02, zE - 0.4), at(P.axleFU, P.wheelY + 0.02, zE + 0.2)], 0.016, { radial: 8 }));
}


/* ------------------------------------------------------------ ENGINE BAY -- */

export function buildEngineBay({ P, B, A, X, art }) {
  const at = (u, y, z) => [X(u), squash(y), z];
  const { uE, zE } = B.engine;
  // Cooling module: condenser, radiator with side tanks, fan shroud.
  A.add('ac_condenser', box(0.016, 0.38, 0.66, { at: at(0.315, 0.51, 0) }));
  A.add('radiator', merge([
    box(0.028, 0.36, 0.62, { at: at(0.345, 0.51, 0) }),
    roundedBox(0.04, 0.4, 0.045, 0.01, { at: at(0.345, 0.51, 0.335) }),
    roundedBox(0.04, 0.4, 0.045, 0.01, { at: at(0.345, 0.51, -0.335) })
  ]));
  A.add('cooling_fan', merge([
    roundedBox(0.03, 0.38, 0.6, 0.03, { at: at(0.385, 0.51, 0) }),
    cylinder(0.16, 0.16, 0.012, { axis: 'x', at: at(0.395, 0.5, -0.08), seg: 28 }),
    cylinder(0.045, 0.045, 0.07, { axis: 'x', at: at(0.42, 0.5, -0.08), seg: 16 })
  ]));
  const rcP = A.pivot('tbx_pivot_radiator_cap', at(0.35, 0.73, 0.24));
  A.add('radiator_cap', merge([cylinder(0.022, 0.022, 0.012, { at: at(0.35, 0.735, 0.24), seg: 14 }), cylinder(0.018, 0.018, 0.03, { at: at(0.35, 0.715, 0.24), seg: 12 })]), rcP);
  art.push({
    id: 'radiator_cap', label: 'Radiator cap', group: 'Fluids',
    actions: { on: 'Remove radiator cap (engine cold only)', off: 'Refit radiator cap' }, components: ['radiator_cap', 'radiator'],
    requires: HOOD_REQ, transforms: [{ node: rcP.name, translate: [0, 0.09, 0], rotate: { axis: [0, 1, 0], degrees: 90 } }]
  });
  A.add('radiator_hoses', merge([
    tube([at(0.36, 0.69, -0.28), at(0.5, 0.74, -0.2), at(uE - 0.14, 0.74, zE - 0.24)], 0.018, { radial: 8 }),
    tube([at(0.37, 0.34, 0.28), at(0.55, 0.36, 0.3), at(uE - 0.1, 0.5, zE + 0.2)], 0.018, { radial: 8 })
  ]));
  A.add('heater_hoses', merge([
    tube([at(uE + 0.14, 0.62, zE + 0.05), at(B.firewallU - 0.05, 0.7, 0.05)], 0.01, { radial: 6 }),
    tube([at(uE + 0.14, 0.58, zE + 0.12), at(B.firewallU - 0.05, 0.66, 0.12)], 0.01, { radial: 6 })
  ]));
  // Coolant reservoir (right front) with cap.
  A.add('coolant_reservoir', roundedBox(0.12, 0.2, 0.12, 0.03, { at: at(0.48, 0.64, 0.56) }));
  const ccP = A.pivot('tbx_pivot_coolant_reservoir_cap', at(0.48, 0.75, 0.56));
  A.add('coolant_reservoir_cap', cylinder(0.025, 0.025, 0.025, { at: at(0.48, 0.752, 0.56), seg: 14 }), ccP);
  A.add('coolant_reservoir', tube([at(0.46, 0.7, 0.5), at(0.4, 0.74, 0.35), at(0.36, 0.73, 0.26)], 0.005, { radial: 5 }));
  art.push({
    id: 'coolant_reservoir_cap', label: 'Coolant reservoir cap', group: 'Fluids',
    actions: { on: 'Open coolant reservoir', off: 'Close reservoir' }, components: ['coolant_reservoir_cap', 'coolant_reservoir'],
    requires: HOOD_REQ, transforms: [{ node: ccP.name, translate: [0, 0.08, 0] }]
  });
  // Battery (left front), hold-down, tray; fuse and relay box behind it.
  const bp = A.pivot('tbx_pivot_battery', at(0.62, 0.52, -0.63));
  A.add('battery_12v', merge([
    roundedBox(0.23, 0.2, 0.175, 0.008, { at: at(0.62, 0.625, -0.63) }),
    cylinder(0.009, 0.009, 0.02, { at: at(0.53, 0.735, -0.58), seg: 10 }),
    cylinder(0.009, 0.009, 0.02, { at: at(0.53, 0.735, -0.68), seg: 10 })
  ]), bp);
  A.add('battery_hold_down', merge([box(0.03, 0.012, 0.2, { at: at(0.62, 0.732, -0.63) }), box(0.012, 0.2, 0.012, { at: at(0.62, 0.63, -0.53) })]));
  A.add('battery_tray', box(0.26, 0.02, 0.2, { at: at(0.62, 0.515, -0.63) }));
  A.add('battery_cables', merge([
    tube([at(0.53, 0.745, -0.58), at(0.56, 0.78, -0.5), at(0.8, 0.7, -0.62)], 0.007, { radial: 5 }),
    tube([at(0.53, 0.745, -0.68), at(0.48, 0.66, -0.72), at(0.5, 0.45, -0.66)], 0.007, { radial: 5 })
  ]));
  art.push({
    id: 'battery', label: '12 V battery', group: 'Electrical',
    actions: { on: 'Lift battery out', off: 'Install battery' }, components: ['battery_12v', 'battery_hold_down', 'battery_tray', 'battery_cables'],
    requires: HOOD_REQ, transforms: [{ node: bp.name, translate: [0, 0.42, -0.05] }], duration: 1300
  });
  A.add('fuse_relay_box', merge([
    roundedBox(0.11, 0.1, 0.13, 0.01, { at: at(0.81, 0.66, -0.67) }),
    roundedBox(0.115, 0.02, 0.135, 0.01, { at: at(0.81, 0.72, -0.67) })
  ]));
  // Air intake: snorkel → air cleaner box (lid hinged at the rear) → duct → throttle body.
  A.add('air_intake_snorkel', tube([at(0.36, 0.68, -0.5), at(0.6, 0.72, -0.46), at(0.9, 0.74, -0.42)], 0.035, { radial: 10 }));
  A.add('air_cleaner_box', roundedBox(0.28, 0.12, 0.3, 0.02, { at: at(1.03, 0.74, -0.4) }));
  const lidP = A.pivot('tbx_pivot_air_cleaner_lid', at(1.17, 0.81, -0.4));
  A.add('air_cleaner_lid', roundedBox(0.28, 0.05, 0.3, 0.02, { at: at(1.03, 0.825, -0.4) }), lidP);
  const filterP = A.pivot('tbx_pivot_air_filter', at(1.03, 0.8, -0.4));
  A.add('air_filter_element', merge([
    box(0.24, 0.02, 0.26, { at: at(1.03, 0.8, -0.4) }),
    ...[...Array(8).keys()].map(i => box(0.006, 0.03, 0.24, { at: at(0.93 + i * 0.028, 0.8, -0.4) }))
  ]), filterP);
  A.add('air_intake_duct', tube([at(1.0, 0.86, -0.3), at(0.8, 0.82, -0.2), at(uE - 0.27, 0.66, zE - 0.27)], 0.035, { radial: 10 }));
  art.push({
    id: 'air_cleaner_lid', label: 'Air cleaner housing', group: 'Engine service',
    actions: { on: 'Unclip and open air box', off: 'Close air box' }, components: ['air_cleaner_lid', 'air_cleaner_box', 'air_intake_duct'],
    requires: [...HOOD_REQ, { id: 'air_filter', state: false, reason: 'Refit the filter element first.' }],
    transforms: [{ node: lidP.name, rotate: { axis: [0, 0, 1], degrees: 70 } }]
  });
  art.push({
    id: 'air_filter', label: 'Engine air filter', group: 'Engine service',
    actions: { on: 'Lift filter element out', off: 'Refit filter element' }, components: ['air_filter_element', 'air_cleaner_box'],
    requires: [{ id: 'air_cleaner_lid', state: true, reason: 'Open the air box first.' }],
    transforms: [{ node: filterP.name, translate: [0, 0.28, 0] }]
  });
  // Brake booster, master cylinder, fluid reservoir (driver side), ABS actuator.
  const bu = B.firewallU;
  A.add('brake_booster', cylinder(0.12, 0.12, 0.12, { axis: 'x', at: at(bu - 0.07, 0.7, -0.4), seg: 28 }));
  A.add('brake_master_cylinder', cylinder(0.028, 0.028, 0.16, { axis: 'x', at: at(bu - 0.21, 0.7, -0.4), seg: 14 }));
  A.add('brake_fluid_reservoir', roundedBox(0.1, 0.07, 0.07, 0.015, { at: at(bu - 0.2, 0.765, -0.4) }));
  const bfP = A.pivot('tbx_pivot_brake_fluid_cap', at(bu - 0.2, 0.81, -0.4));
  A.add('brake_fluid_cap', cylinder(0.022, 0.022, 0.02, { at: at(bu - 0.2, 0.81, -0.4), seg: 12 }), bfP);
  art.push({
    id: 'brake_fluid_cap', label: 'Brake fluid reservoir cap', group: 'Fluids',
    actions: { on: 'Open brake fluid reservoir', off: 'Close reservoir' }, components: ['brake_fluid_cap', 'brake_fluid_reservoir'],
    requires: HOOD_REQ, transforms: [{ node: bfP.name, translate: [0, 0.07, 0] }]
  });
  A.add('abs_actuator', merge([roundedBox(0.12, 0.1, 0.1, 0.012, { at: at(bu - 0.18, 0.6, 0.52) }), roundedBox(0.06, 0.05, 0.08, 0.01, { at: at(bu - 0.18, 0.67, 0.52) })]));
  A.add('brake_lines', merge([
    tube([at(bu - 0.28, 0.7, -0.4), at(bu - 0.35, 0.66, 0.0), at(bu - 0.24, 0.62, 0.5)], 0.004, { radial: 4 }),
    tube([at(bu - 0.2, 0.58, 0.52), at(P.axleFU + 0.1, 0.55, 0.6), at(P.axleFU - 0.05, P.wheelY + 0.1, P.trackF / 2 - 0.1)], 0.004, { radial: 4 }),
    tube([at(bu - 0.2, 0.58, 0.48), at(P.axleFU + 0.2, 0.5, -0.5), at(P.axleFU - 0.05, P.wheelY + 0.1, -P.trackF / 2 + 0.1)], 0.004, { radial: 4 }),
    tube([at(bu - 0.15, 0.56, 0.48), at(bu + 0.3, 0.24, 0.4), at(P.axleRU - 0.4, 0.26, 0.45), at(P.axleRU, P.wheelY + 0.08, P.trackR / 2 - 0.12)], 0.004, { radial: 4 }),
    tube([at(bu - 0.15, 0.56, 0.46), at(bu + 0.3, 0.24, 0.36), at(P.axleRU - 0.4, 0.26, -0.45), at(P.axleRU, P.wheelY + 0.08, -P.trackR / 2 + 0.12)], 0.004, { radial: 4 })
  ]));
  // Washer fluid reservoir (front corner) with filler neck.
  A.add('washer_fluid_reservoir', merge([
    roundedBox(0.14, 0.25, 0.14, 0.03, { at: at(0.36, 0.48, 0.6) }),
    tube([at(0.4, 0.6, 0.6), at(0.44, 0.72, 0.56)], 0.015, { radial: 8 })
  ]));
  const wfP = A.pivot('tbx_pivot_washer_cap', at(0.44, 0.735, 0.56));
  A.add('washer_fluid_cap', cylinder(0.022, 0.022, 0.018, { at: at(0.44, 0.735, 0.56), seg: 12 }), wfP);
  art.push({
    id: 'washer_cap', label: 'Washer fluid cap', group: 'Fluids',
    actions: { on: 'Open washer filler', off: 'Close washer filler' }, components: ['washer_fluid_cap', 'washer_fluid_reservoir'],
    requires: HOOD_REQ, transforms: [{ node: wfP.name, translate: [0, 0.06, 0], rotate: { axis: [1, 0, 0], degrees: 80 } }]
  });
  A.add('horn', merge([cylinder(0.04, 0.04, 0.03, { axis: 'x', at: at(0.24, 0.52, -0.32), seg: 16 })]));
  A.add('hood_seal_and_cowl_seal', box(0.02, 0.015, 1.3, { at: at(bu - 0.02, 0.905, 0) }));
}

/* -------------------------------------------------------------- INTERIOR -- */

export function buildInterior({ P, B, A, X, art }) {
  const at = (u, y, z) => [X(u), y, z];
  const C = P.cabin, g = P.glass, w = P.HW - 0.1;
  const dU = C.dashU;
  const prof = pts => pts.map(([u, y]) => [X(u), y]);
  // Layered instrument panel: upper pad, horizontal trim band, lower panel.
  A.add('instrument_panel_upper', extrude(prof([[g.cowlU + 0.06, 0.95], [dU - 0.14, 1.03], [dU - 0.03, 1.02], [dU, 0.98], [dU, 0.9], [g.cowlU + 0.06, 0.9]]).reverse(), w * 2 - 0.04));
  A.add('dash_trim_band', extrude(prof([[dU - 0.02, 0.9], [dU + 0.06, 0.895], [dU + 0.065, 0.83], [dU - 0.02, 0.82]]), w * 2 - 0.12));
  A.add('instrument_panel_lower', extrude(prof([[dU - 0.02, 0.82], [dU + 0.02, 0.8], [dU - 0.02, 0.55], [dU - 0.25, 0.5], [dU - 0.25, 0.82]]), w * 2 - 0.06));
  // Gauge cluster hood and dials in front of the driver (left-hand drive).
  A.add('instrument_cluster', merge([
    roundedBox(0.12, 0.06, 0.36, 0.03, { at: at(dU - 0.02, 1.02, -0.37) }),
    cylinder(0.055, 0.055, 0.01, { axis: 'x', at: at(dU - 0.02, 0.965, -0.45), seg: 26 }),
    cylinder(0.055, 0.055, 0.01, { axis: 'x', at: at(dU - 0.02, 0.965, -0.29), seg: 26 }),
    box(0.01, 0.06, 0.05, { at: at(dU - 0.02, 0.965, -0.37) })
  ]));
  // Centre stack: touchscreen head unit, climate panel, vents.
  A.add('center_stack', roundedBox(0.03, 0.3, 0.28, 0.02, { at: at(dU + 0.035, 0.8, 0) }));
  A.add('audio_touchscreen', box(0.012, 0.08, 0.14, { at: at(dU + 0.055, 0.87, 0) }));
  A.add('climate_controls', merge([
    box(0.012, 0.06, 0.2, { at: at(dU + 0.05, 0.74, 0) }),
    cylinder(0.022, 0.022, 0.015, { axis: 'x', at: at(dU + 0.058, 0.74, -0.07), seg: 16 }),
    cylinder(0.022, 0.022, 0.015, { axis: 'x', at: at(dU + 0.058, 0.74, 0.07), seg: 16 })
  ]));
  A.add('air_vents', merge([
    box(0.02, 0.05, 0.05, { at: at(dU + 0.05, 0.945, -0.1) }), box(0.02, 0.05, 0.05, { at: at(dU + 0.05, 0.945, 0.1) }),
    box(0.02, 0.06, 0.07, { at: at(dU + 0.01, 0.93, -w + 0.1) }), box(0.02, 0.06, 0.07, { at: at(dU + 0.01, 0.93, w - 0.1) })
  ]));
  // Glovebox (passenger side) hinged at its lower edge.
  const gbP = A.pivot('tbx_pivot_glovebox', at(dU - 0.005, 0.6, 0.4));
  A.add('glovebox', merge([
    box(0.02, 0.16, 0.38, { at: at(dU, 0.68, 0.4) }),
    box(0.2, 0.012, 0.36, { at: at(dU - 0.1, 0.605, 0.4) }),
    box(0.2, 0.15, 0.012, { at: at(dU - 0.1, 0.68, 0.22) }), box(0.2, 0.15, 0.012, { at: at(dU - 0.1, 0.68, 0.58) })
  ]), gbP);
  art.push({
    id: 'glovebox', label: 'Glovebox', group: 'Cabin',
    actions: { on: 'Open glovebox', off: 'Close glovebox' }, components: ['glovebox', 'instrument_panel_lower'],
    transforms: [{ node: gbP.name, rotate: { axis: [0, 0, 1], degrees: 62 } }]
  });
  // Airbags: driver (hub), front passenger (dash top), driver knee, passenger seat-cushion, front side, curtains.
  A.add('airbag_passenger_front', box(0.2, 0.01, 0.3, { at: at(dU - 0.12, 1.035, 0.38) }));
  if (P.features.kneeAirbag) A.add('airbag_knee_driver', box(0.015, 0.1, 0.34, { at: at(dU - 0.005, 0.62, -0.37) }));
  for (const { key, s } of SIDES) {
    const cz = (g.roofFrontU + P.doors.rearEndU) / 2;
    A.add(`airbag_curtain_${key}`, tube([at(g.roofFrontU - 0.15, B.railY(g.roofFrontU) - 0.1, (B.railZ(g.roofFrontU) - 0.07) * s), at(cz, B.railY(cz) - 0.06, (B.railZ(cz) - 0.06) * s), at(P.doors.rearEndU + 0.15, B.railY(P.doors.rearEndU) - 0.08, (B.railZ(P.doors.rearEndU) - 0.06) * s)], 0.02, { radial: 6 }));
  }
  // Steering column with electric assist unit, and the steering wheel.
  const tilt = deg(25), steerC = at(C.steerU, 0.93, -0.37);
  const colDir = [Math.cos(tilt), -Math.sin(tilt)];
  A.add('steering_column', merge([
    tube([steerC.map((v, i) => (i === 0 ? v + colDir[0] * 0.05 : i === 1 ? v + colDir[1] * 0.05 : v)), at(B.firewallU - 0.1, 0.62, -0.37)], 0.022, { radial: 10 }),
    roundedBox(0.16, 0.1, 0.1, 0.02, { at: [steerC[0] + colDir[0] * 0.2, steerC[1] + colDir[1] * 0.2 - 0.02, -0.37], rot: [0, 0, -tilt] }),
    roundedBox(0.09, 0.08, 0.09, 0.02, { at: [steerC[0] + colDir[0] * 0.33, steerC[1] + colDir[1] * 0.33 - 0.05, -0.37] })
  ]));
  const swP = A.pivot('tbx_pivot_steering_wheel', steerC);
  const wheel = merge([
    torus(0.185, 0.016, { seg: 40, tubeSeg: 8 }),
    cylinder(0.07, 0.075, 0.06, { axis: 'z', seg: 20, at: [0, 0, 0.02] }),
    box(0.25, 0.03, 0.02, { at: [-0.125 - 0.04, -0.01, 0.01] }), box(0.25, 0.03, 0.02, { at: [0.125 + 0.04, -0.01, 0.01] }),
    box(0.03, 0.12, 0.02, { at: [0, -0.12, 0.01] })
  ]);
  const orient = gg => place(place(gg, { rot: [0, deg(-90), deg(-25)], order: 'ZYX' }), { at: steerC });
  A.add('steering_wheel', orient(wheel), swP);
  A.add('airbag_driver_front', orient(cylinder(0.068, 0.068, 0.012, { axis: 'z', seg: 20, at: [0, 0, 0.056] })), swP);
  // Pedal box (driver side).
  A.add('pedals', merge([
    roundedBox(0.03, 0.08, 0.1, 0.01, { at: at(C.pedalU, 0.36, -0.36), rot: [0, 0, deg(-20)] }),
    tube([at(C.pedalU, 0.4, -0.36), at(C.pedalU - 0.12, 0.62, -0.36)], 0.01, { radial: 5 }),
    roundedBox(0.02, 0.16, 0.07, 0.01, { at: at(C.pedalU + 0.03, 0.34, -0.21), rot: [0, 0, deg(-30)] })
  ]));
  // Centre console, gear selector, parking brake, armrest storage.
  A.add('center_console', merge([
    roundedBox(0.95, 0.22, 0.24, 0.04, { at: at(dU + 0.47, 0.44, 0) }),
    cylinder(0.04, 0.04, 0.06, { at: at(dU + 0.3, 0.56, 0.05), seg: 14 }), cylinder(0.04, 0.04, 0.06, { at: at(dU + 0.3, 0.56, -0.05), seg: 14 })
  ]));
  A.add('gear_selector', merge([
    roundedBox(0.14, 0.02, 0.1, 0.01, { at: at(dU + 0.2, 0.555, 0) }),
    tube([at(dU + 0.2, 0.56, 0), at(dU + 0.18, 0.66, 0)], 0.009, { radial: 6 }),
    sphere(0.028, { at: at(dU + 0.175, 0.68, 0), scale: [1, 1.3, 1] })
  ]));
  const pbP = A.pivot('tbx_pivot_parking_brake', at(dU + 0.46, 0.56, 0.02));
  A.add('parking_brake_lever', merge([
    tube([at(dU + 0.46, 0.56, 0.02), at(dU + 0.63, 0.6, 0.02)], 0.018, { radial: 8 }),
    cylinder(0.006, 0.006, 0.02, { axis: 'x', at: at(dU + 0.645, 0.6, 0.02), seg: 8 })
  ]), pbP);
  art.push({
    id: 'parking_brake', label: 'Parking brake lever', group: 'Cabin',
    actions: { on: 'Apply parking brake', off: 'Release parking brake' }, components: ['parking_brake_lever'],
    transforms: [{ node: pbP.name, rotate: { axis: [0, 0, 1], degrees: -28 } }]
  });
  const clP = A.pivot('tbx_pivot_console_lid', at(dU + 0.97, 0.7, 0));
  A.add('console_armrest_lid', roundedBox(0.28, 0.04, 0.2, 0.02, { at: at(dU + 0.83, 0.69, 0) }), clP);
  A.add('center_console', roundedBox(0.28, 0.14, 0.22, 0.03, { at: at(dU + 0.83, 0.61, 0) }));
  art.push({
    id: 'console_lid', label: 'Centre console lid', group: 'Cabin',
    actions: { on: 'Open console storage', off: 'Close console lid' }, components: ['console_armrest_lid', 'center_console'],
    transforms: [{ node: clP.name, rotate: { axis: [0, 0, 1], degrees: 95 } }]
  });
  // Front seats: slide on rails, recline about the hip point.
  for (const { key, s, label } of SIDES) {
    const zc = 0.37 * s, fu = C.frontSeatU;
    A.add(`seat_rails_front_${key}`, merge([box(0.5, 0.03, 0.03, { at: at(fu, 0.27, zc - 0.17) }), box(0.5, 0.03, 0.03, { at: at(fu, 0.27, zc + 0.17) })]));
    const slide = A.pivot(`tbx_pivot_seat_front_${key}`, at(fu, 0.3, zc));
    A.add(`seat_cushion_front_${key}`, merge([
      roundedBox(0.5, 0.11, 0.5, 0.04, { at: at(fu - 0.02, 0.44, zc) }),
      roundedBox(0.44, 0.1, 0.07, 0.03, { at: at(fu - 0.02, 0.5, zc - 0.22) }), roundedBox(0.44, 0.1, 0.07, 0.03, { at: at(fu - 0.02, 0.5, zc + 0.22) }),
      box(0.36, 0.1, 0.4, { at: at(fu, 0.34, zc) })
    ]), slide);
    const hip = A.pivot(`tbx_pivot_seatback_front_${key}`, at(fu + 0.2, 0.48, zc), slide);
    const back = merge([
      roundedBox(0.13, 0.62, 0.5, 0.05, { at: at(fu + 0.25, 0.8, zc) }),
      roundedBox(0.12, 0.5, 0.07, 0.03, { at: at(fu + 0.22, 0.78, zc - 0.23) }), roundedBox(0.12, 0.5, 0.07, 0.03, { at: at(fu + 0.22, 0.78, zc + 0.23) })
    ]);
    // Seatback leans back ~22° about the hip.
    const lean = gg => { gg.translate(-X(fu + 0.2), -0.48, 0); place(gg, { rot: [0, 0, deg(22)] }); gg.translate(X(fu + 0.2), 0.48, 0); return gg; };
    A.add(`seat_back_front_${key}`, lean(back), hip);
    A.add(`headrest_front_${key}`, lean(merge([
      roundedBox(0.1, 0.17, 0.26, 0.04, { at: at(fu + 0.26, 1.22, zc) }),
      cylinder(0.006, 0.006, 0.1, { at: at(fu + 0.26, 1.11, zc - 0.07), seg: 6 }), cylinder(0.006, 0.006, 0.1, { at: at(fu + 0.26, 1.11, zc + 0.07), seg: 6 })
    ])), hip);
    A.add(`airbag_seat_side_${key}`, lean(box(0.06, 0.22, 0.02, { at: at(fu + 0.22, 0.86, zc + 0.24 * s) })), hip);
    art.push({
      id: `seat_front_${key}_slide`, label: `${label} front seat position`, group: 'Seats',
      actions: { on: 'Slide seat forward', off: 'Slide seat back' }, components: [`seat_cushion_front_${key}`, `seat_back_front_${key}`, `seat_rails_front_${key}`],
      transforms: [{ node: slide.name, translate: [0.14, 0, 0] }], duration: 1100
    });
    art.push({
      id: `seat_front_${key}_recline`, label: `${label} front seatback`, group: 'Seats',
      actions: { on: 'Recline seatback', off: 'Raise seatback' }, components: [`seat_back_front_${key}`, `headrest_front_${key}`],
      transforms: [{ node: hip.name, rotate: { axis: [0, 0, 1], degrees: 28 } }], duration: 1100
    });
    // Sun visors hinge on the windscreen header.
    const vu = g.roofFrontU + 0.04, vz = 0.32 * s;
    const vp = A.pivot(`tbx_pivot_sun_visor_${key}`, at(vu, B.topCenterY(vu) - B.crownG(vu) * (0.32 / B.railZ(vu)) ** 2 - 0.03, vz));
    A.add(`sun_visor_${key}`, box(0.16, 0.018, 0.36, { at: [vp.world[0] - 0.085, vp.world[1] - 0.005, vz] }), vp);
    art.push({
      id: `sun_visor_${key}`, label: `${label} sun visor`, group: 'Cabin',
      actions: { on: 'Lower sun visor', off: 'Stow sun visor' }, components: [`sun_visor_${key}`],
      transforms: [{ node: vp.name, rotate: { axis: [0, 0, 1], degrees: 80 } }]
    });
  }
  if (P.features.cushionAirbag) A.add('airbag_seat_cushion_passenger', box(0.12, 0.03, 0.34, { at: at(C.frontSeatU - 0.2, 0.45, 0.37) }));
  // Rear bench: fixed cushion, 60/40 split folding backs.
  const ru = C.rearSeatU;
  A.add('rear_seat_cushion', merge([roundedBox(0.52, 0.13, 2 * w - 0.14, 0.05, { at: at(ru - 0.05, 0.47, 0) }), box(0.4, 0.14, 2 * w - 0.3, { at: at(ru - 0.05, 0.34, 0) })]));
  const split = -w + 0.07 + (2 * w - 0.14) * 0.6;
  for (const [id, z0, z1, labelTxt] of [['rear_seatback_60', -w + 0.07, split - 0.005, 'Rear seatback (60 % section)'], ['rear_seatback_40', split + 0.005, w - 0.07, 'Rear seatback (40 % section)']]) {
    const zc = (z0 + z1) / 2, width = z1 - z0;
    const hinge = A.pivot(`tbx_pivot_${id}`, at(ru + 0.22, 0.52, zc));
    const lean = gg => { gg.translate(-X(ru + 0.22), -0.52, 0); place(gg, { rot: [0, 0, deg(25)] }); gg.translate(X(ru + 0.22), 0.52, 0); return gg; };
    A.add(id, lean(roundedBox(0.12, 0.58, width, 0.04, { at: at(ru + 0.27, 0.82, zc) })), hinge);
    const heads = id.endsWith('60') ? [zc - width * 0.28, zc + width * 0.3] : [zc];
    A.add(`rear_headrests`, lean(merge(heads.map(z => roundedBox(0.09, 0.12, 0.24, 0.035, { at: at(ru + 0.28, 1.14, z) })))), hinge);
    art.push({
      id, label: labelTxt, group: 'Seats',
      actions: { on: 'Fold seatback forward', off: 'Raise seatback' }, components: [id, 'rear_headrests', 'rear_seat_cushion'],
      transforms: [{ node: hinge.name, rotate: { axis: [0, 0, 1], degrees: -106 } }], duration: 1300
    });
  }
  A.add('rearview_mirror', merge([
    roundedBox(0.03, 0.065, 0.24, 0.02, { at: at(g.roofFrontU - 0.12, B.topCenterY(g.roofFrontU - 0.12) - 0.11, 0) }),
    cylinder(0.008, 0.008, 0.07, { at: at(g.roofFrontU - 0.1, B.topCenterY(g.roofFrontU - 0.1) - 0.05, 0), seg: 6 })
  ]));
  A.add('dome_lamp', roundedBox(0.12, 0.015, 0.2, 0.02, { at: at(g.roofFrontU + 0.35, B.topCenterY(g.roofFrontU + 0.35) - 0.03, 0) }));
  A.add('high_mount_stop_lamp', roundedBox(0.04, 0.03, 0.22, 0.01, { at: at(g.roofRearU + 0.06, B.topCenterY(g.roofRearU + 0.06) - 0.035, 0) }));
}

/* ------------------------------------------------------- BOOT AND FUEL -- */

export function buildTrunkAndFuel({ P, B, A, X, art }) {
  const at = (u, y, z) => [X(u), y, z];
  const d = P.deck;
  const tf0 = d.u0 + 0.02, tf1 = P.L - 0.3;
  const spareU = Math.min(tf0 + 0.35, P.L - 0.5);
  A.add('trunk_floor', merge([
    box(tf1 - tf0, 0.015, 1.24, { at: at((tf0 + tf1) / 2, 0.29, 0) }),
    box(0.64, 0.12, 0.012, { at: at(spareU, 0.23, 0.36) }), box(0.64, 0.12, 0.012, { at: at(spareU, 0.23, -0.36) }),
    box(0.64, 0.012, 0.72, { at: at(spareU, 0.17, 0) })
  ]));
  const boardP = A.pivot('tbx_pivot_trunk_floor_board', at(tf0 + 0.12, 0.305, 0));
  A.add('trunk_floor_board', box(0.66, 0.012, 1.0, { at: at(tf0 + 0.45, 0.305, 0) }), boardP);
  art.push({
    id: 'trunk_floor_board', label: 'Boot floor board', group: 'Boot',
    actions: { on: 'Lift floor board', off: 'Lower floor board' }, components: ['trunk_floor_board', 'trunk_floor'],
    requires: [{ id: 'trunk_lid', state: true, reason: 'Open the boot first.' }, { id: 'spare_tyre', state: false, reason: 'Stow the spare wheel first.' }],
    transforms: [{ node: boardP.name, rotate: { axis: [0, 0, 1], degrees: -75 } }]
  });
  // Compact temporary spare on a steel wheel, with jack.
  const spP = A.pivot('tbx_pivot_spare_tyre', at(spareU, 0.22, 0));
  // Compact temporary spare: smaller diameter and narrow tread.
  const R = 0.29, r = 0.2;
  const spare = merge([
    lathe([[r, 0.055], [r + 0.03, 0.065], [R, 0.05], [R, -0.05], [r + 0.03, -0.065], [r, -0.055]], { axis: 'y', seg: 36 }),
    lathe([[r - 0.01, 0.05], [0.12, 0.03], [0.07, 0.0], [0.02, 0.0]], { axis: 'y', seg: 28 })
  ]);
  A.add('spare_tyre', place(spare, { at: at(spareU, 0.24, 0) }), spP);
  A.add('jack_and_tools', merge([
    roundedBox(0.3, 0.06, 0.08, 0.01, { at: at(spareU, 0.2, 0.3) }),
    cylinder(0.008, 0.008, 0.3, { axis: 'x', at: at(spareU, 0.25, 0.3), seg: 6 })
  ]));
  art.push({
    id: 'spare_tyre', label: 'Spare wheel', group: 'Boot',
    actions: { on: 'Lift spare out', off: 'Stow spare' }, components: ['spare_tyre', 'jack_and_tools', 'trunk_floor'],
    requires: [{ id: 'trunk_floor_board', state: true, reason: 'Lift the boot floor board first.' }],
    transforms: [{ node: spP.name, translate: [0.0, 0.55, 0] }], duration: 1300
  });
  // Fuel tank under the rear seat, filler neck to the left-rear filler door.
  A.add('fuel_tank', merge([
    roundedBox(0.52, 0.2, 1.0, 0.05, { at: at(P.cabin.rearSeatU - 0.12, 0.27, -0.05) }),
    roundedBox(0.2, 0.08, 0.3, 0.02, { at: at(P.cabin.rearSeatU - 0.12, 0.39, 0.1) })
  ]));
  const fdU = B.fuelDoor.u, fdY = B.fuelDoor.y, zOut = -B.HWy(fdY) + 0.035;
  A.add('fuel_filler_neck', tube([at(P.cabin.rearSeatU - 0.05, 0.32, -0.5), at(P.axleRU - 0.1, 0.5, -0.65), at(fdU, fdY, zOut - 0.02)], 0.02, { radial: 8 }));
  const capP = A.pivot('tbx_pivot_fuel_filler_cap', at(fdU, fdY, zOut));
  A.add('fuel_filler_cap', cylinder(0.028, 0.028, 0.025, { axis: 'z', at: at(fdU, fdY, zOut), seg: 14 }), capP);
  A.add('evap_canister', roundedBox(0.2, 0.1, 0.14, 0.02, { at: at(P.cabin.rearSeatU + 0.25, 0.29, 0.4) }));
  art.push({
    id: 'fuel_filler_cap', label: 'Fuel filler cap', group: 'Fluids',
    actions: { on: 'Remove fuel cap', off: 'Refit fuel cap' }, components: ['fuel_filler_cap', 'fuel_filler_neck'],
    requires: [{ id: 'fuel_door', state: true, reason: 'Open the fuel filler door first.' }],
    transforms: [{ node: capP.name, translate: [0, 0, -0.1], rotate: { axis: [0, 0, 1], degrees: 90 } }]
  });
}
