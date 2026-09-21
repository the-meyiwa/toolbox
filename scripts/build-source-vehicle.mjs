#!/usr/bin/env node
/**
 * Builds the interactive 2014–2016 Toyota Corolla package from real source
 * geometry: "2014 Toyota Corolla E180 EU (with interior)" by Armored Wave,
 * CC BY 4.0 (https://skfb.ly/oLAVz).
 *
 * The body, glass, lamps, wheels, brakes and complete cabin come from the
 * source model, split into semantic components and hung on hinge pivots so
 * doors, bonnet, boot, wheels, seats and trim articulate. The source has no
 * engine bay or chassis, so Toolbox's procedural 2ZR-FE powertrain,
 * engine-bay systems, suspension, steering gear, fuel system and boot floor
 * are fitted inside it and labelled as approximations.
 *
 *   node scripts/build-source-vehicle.mjs [path/to/source.glb]
 *
 * The 78 MB source (with textures) is not committed; download it from the
 * link above into vehicle-packages/sources/ (git-ignored).
 */
import { writeFile, mkdir, access } from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Assembly } from './procedural-vehicle/assembly.mjs';
import { writeGLB, cylinder, box, merge, tube } from './procedural-vehicle/geometry.mjs';
import { buildStructure, buildSuspensionAndSteering, buildPowertrain, buildEngineBay, buildTrunkAndFuel } from './procedural-vehicle/corolla-systems.mjs';
import { describeComponent, specSheet, LAYERS } from './procedural-vehicle/corolla-data.mjs';
import { segmentCorolla } from './vehicle-sources/corolla-e180.mjs';
import { updateCatalog } from './vehicle-sources/catalog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.resolve(process.argv[2] || path.join(ROOT, 'vehicle-packages/sources/2014_toyota_corolla_e180_eu_with_interior.glb'));
const ID = 'toyota-corolla-2014-2016';
const SIDES = [{ key: 'right', s: 1, label: 'Right' }, { key: 'left', s: -1, label: 'Left' }];
const cap = v => v.charAt(0).toUpperCase() + v.slice(1);

try { await access(SOURCE); } catch {
  console.error(`Source model not found: ${SOURCE}\nDownload it from https://skfb.ly/oLAVz (glTF binary) into vehicle-packages/sources/.`);
  process.exit(1);
}

const { geometries: G, scale } = segmentCorolla(SOURCE, { length: 4.62 });
const L = 4.62, X = u => L / 2 - u, U = x => L / 2 - x;
const bb = id => {
  const g = G.get(id); if (!g) throw new Error(`Source is missing ${id}`);
  const { min, max } = g.boundingBox;
  return { min, max, c: [(min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2] };
};
const A = new Assembly();
const art = [];
const used = new Set();
const put = (id, parent) => { if (!G.has(id)) return; A.add(id, G.get(id).clone(), parent); used.add(id); };

/* ------------------------------------------------ measured vehicle frame -- */
const wheel = k => bb(`tyre_${k}`).c;
const axleFX = (wheel('front_left')[0] + wheel('front_right')[0]) / 2;
const axleRX = (wheel('rear_left')[0] + wheel('rear_right')[0]) / 2;
const trackF = wheel('front_right')[2] - wheel('front_left')[2];
const trackR = wheel('rear_right')[2] - wheel('rear_left')[2];
const wheelY = (wheel('front_left')[1] + wheel('rear_left')[1]) / 2;
const bodyHalfWidth = Math.max(bb('door_front_right_outer_panel').max.z, bb('rear_quarter_panel_right').max.z);

/* ----------------------------------------------------------- closures -- */
// Bonnet: hinged at its rear edge; manual prop rod on the radiator support.
const hood = bb('hood');
const hoodPivot = A.pivot('tbx_pivot_hood', [hood.min.x + 0.03, hood.max.y - 0.015, 0]);
put('hood', hoodPivot);
const propBase = [X(0.36), 0.74, -0.46];
const prop = A.pivot('tbx_pivot_hood_prop_rod', propBase);
A.add('hood_prop_rod', cylinder(0.005, 0.005, 0.66, { axis: 'z', at: [propBase[0], propBase[1], propBase[2] + 0.33], seg: 6 }), prop);
art.push({ id: 'hood', label: 'Bonnet (hood)', group: 'Body', actions: { on: 'Open bonnet', off: 'Close bonnet' },
  components: ['hood', 'hood_prop_rod', 'cowl_panel'],
  transforms: [{ node: hoodPivot.name, rotate: { axis: [0, 0, 1], degrees: 55 } }, { node: prop.name, rotate: { axis: [1, 0, 0], degrees: -72 }, delay: 0.15 }], duration: 1300 });

const lid = bb('trunk_lid');
const lidPivot = A.pivot('tbx_pivot_trunk_lid', [lid.max.x - 0.02, lid.max.y - 0.01, 0]);
put('trunk_lid', lidPivot); put('rear_license_plate', lidPivot);
art.push({ id: 'trunk_lid', label: 'Boot lid (trunk)', group: 'Body', actions: { on: 'Open boot', off: 'Close boot' },
  components: ['trunk_lid', 'rear_license_plate'], transforms: [{ node: lidPivot.name, rotate: { axis: [0, 0, 1], degrees: -68 } }], duration: 1300 });

const fd = bb('fuel_filler_door');
const fuelPivot = A.pivot('tbx_pivot_fuel_door', [fd.max.x, fd.c[1], fd.min.z + 0.005]);
put('fuel_filler_door', fuelPivot);
art.push({ id: 'fuel_door', label: 'Fuel filler door', group: 'Body', actions: { on: 'Open fuel door', off: 'Close fuel door' },
  components: ['fuel_filler_door', 'fuel_filler_cap'], transforms: [{ node: fuelPivot.name, rotate: { axis: [0, 1, 0], degrees: -80 } }] });

/* -------------------------------------------------------------- doors -- */
for (const pos of ['front', 'rear']) for (const { key, s } of SIDES) {
  const id = `door_${pos}_${key}`;
  const skin = bb(`${id}_outer_panel`);
  const outerZ = s > 0 ? skin.max.z : skin.min.z;
  const pivot = A.pivot(`tbx_pivot_${id}`, [skin.max.x - 0.015, 0.6, outerZ - 0.03 * s]);
  for (const part of ['outer_panel', 'trim_panel', 'window_frame', 'handle', 'quarter_glass']) put(`${id}_${part}`, pivot);
  const glass = bb(`${id}_glass`);
  const glassPivot = A.pivot(`tbx_pivot_${id}_glass`, glass.c, pivot);
  put(`${id}_glass`, glassPivot);
  art.push({ id, label: `${cap(pos)} ${key} door`, group: 'Doors', actions: { on: 'Open door', off: 'Close door' },
    components: [`${id}_outer_panel`, `${id}_trim_panel`, `${id}_window_frame`, `${id}_handle`, `${id}_glass`, `${id}_quarter_glass`].filter(c => G.has(c)),
    transforms: [{ node: pivot.name, rotate: { axis: [0, 1, 0], degrees: (pos === 'front' ? 64 : 68) * s } }] });
  art.push({ id: `${id}_window`, label: `${cap(pos)} ${key} window`, group: 'Windows', actions: { on: 'Lower window', off: 'Raise window' },
    components: [`${id}_glass`, `${id}_window_frame`, `${id}_outer_panel`, `${id}_trim_panel`],
    transforms: [{ node: glassPivot.name, translate: [0, -(glass.max.y - glass.min.y) * 0.95, 0] }], duration: 1600 });
  if (pos === 'front') {
    const m = bb(`side_mirror_${key}`);
    const mp = A.pivot(`tbx_pivot_mirror_${key}`, [m.max.x - 0.03, m.min.y + 0.02, s > 0 ? m.min.z + 0.02 : m.max.z - 0.02], pivot);
    put(`side_mirror_${key}`, mp);
    art.push({ id: `mirror_${key}`, label: `${cap(key)} mirror`, group: 'Mirrors', actions: { on: 'Fold mirror', off: 'Unfold mirror' },
      components: [`side_mirror_${key}`], transforms: [{ node: mp.name, rotate: { axis: [0, 1, 0], degrees: -60 * s } }] });
  }
}

/* ------------------------------------------------ wheels and brakes -- */
const wheelPivots = {};
for (const axle of ['front', 'rear']) for (const { key, s, label } of SIDES) {
  const k = `${axle}_${key}`;
  const center = wheel(k);
  const wp = A.pivot(`tbx_pivot_wheel_${k}`, center);
  wheelPivots[k] = wp;
  put(`wheel_rim_${k}`, wp);
  const tp = A.pivot(`tbx_pivot_tyre_${k}`, center, wp);
  put(`tyre_${k}`, tp);
  put(`brake_disc_${k}`);
  const cal = bb(`brake_caliper_${k}`);
  const cp = A.pivot(`tbx_pivot_caliper_${k}`, cal.c);
  put(`brake_caliper_${k}`, cp);
  A.add(`brake_pads_${k}`, merge([
    box(0.012, 0.09, 0.03, { at: [cal.c[0] + 0.01, cal.c[1], cal.c[2] - 0.012] }),
    box(0.012, 0.09, 0.03, { at: [cal.c[0] + 0.01, cal.c[1], cal.c[2] + 0.012] })
  ]), cp);
  art.push({ id: `caliper_${k}`, label: `${label} ${axle} brake caliper`, group: 'Brakes', actions: { on: 'Remove caliper', off: 'Refit caliper' },
    components: [`brake_caliper_${k}`, `brake_pads_${k}`, `brake_disc_${k}`],
    requires: [{ id: `wheel_${k}`, state: true, reason: 'Remove the wheel first.' }],
    transforms: [{ node: cp.name, translate: [-0.04, 0.1, 0.24 * s] }] });
  art.push({ id: `wheel_${k}`, label: `${label} ${axle} wheel`, group: 'Wheels', actions: { on: 'Remove wheel (rim + tyre)', off: 'Refit wheel' },
    components: [`wheel_rim_${k}`, `tyre_${k}`],
    requires: [{ id: `caliper_${k}`, state: false, reason: 'Refit the caliper first.' }],
    transforms: [{ node: wp.name, translate: [0, 0.03, 0.62 * s] }], duration: 1200 });
  art.push({ id: `tyre_${k}`, label: `${label} ${axle} tyre`, group: 'Wheels', actions: { on: 'Dismount tyre from rim', off: 'Mount tyre on rim' },
    components: [`tyre_${k}`, `wheel_rim_${k}`],
    requires: [{ id: `wheel_${k}`, state: true, reason: 'Remove the wheel from the car first.' }],
    transforms: [{ node: tp.name, translate: [0, 0, 0.34 * s] }], duration: 1100 });
}

/* -------------------------------------------------------------- cabin -- */
const sw = bb('steering_wheel');
const swPivot = A.pivot('tbx_pivot_steering_wheel', sw.c);
put('steering_wheel', swPivot);
const tilt = Math.atan2(sw.max.x - sw.min.x, sw.max.y - sw.min.y); // rim plane leans forward at the top
A.add('airbag_driver_front', cylinder(0.07, 0.07, 0.012, { axis: 'x', at: [sw.c[0] - 0.035, sw.c[1], sw.c[2]], rot: [0, 0, tilt], seg: 20 }), swPivot);

for (const { key, s, label } of SIDES) {
  const cushion = bb(`seat_cushion_front_${key}`), back = bb(`seat_back_front_${key}`);
  const slide = A.pivot(`tbx_pivot_seat_front_${key}`, [cushion.c[0], cushion.min.y, cushion.c[2]]);
  put(`seat_cushion_front_${key}`, slide);
  const hip = A.pivot(`tbx_pivot_seatback_front_${key}`, [back.max.x - 0.06, back.min.y + 0.05, back.c[2]], slide);
  put(`seat_back_front_${key}`, hip); put(`headrest_front_${key}`, hip);
  A.add(`airbag_seat_side_${key}`, box(0.08, 0.24, 0.02, { at: [back.c[0], back.c[1] + 0.05, s > 0 ? back.max.z - 0.03 : back.min.z + 0.03] }), hip);
  art.push({ id: `seat_front_${key}_slide`, label: `${label} front seat position`, group: 'Seats', actions: { on: 'Slide seat forward', off: 'Slide seat back' },
    components: [`seat_cushion_front_${key}`, `seat_back_front_${key}`, `seat_rails_front_${key}`], transforms: [{ node: slide.name, translate: [0.14, 0, 0] }], duration: 1100 });
  art.push({ id: `seat_front_${key}_recline`, label: `${label} front seatback`, group: 'Seats', actions: { on: 'Recline seatback', off: 'Raise seatback' },
    components: [`seat_back_front_${key}`, `headrest_front_${key}`], transforms: [{ node: hip.name, rotate: { axis: [0, 0, 1], degrees: 26 } }], duration: 1100 });
  const visor = bb(`sun_visor_${key}`);
  const vp = A.pivot(`tbx_pivot_sun_visor_${key}`, [visor.max.x, visor.max.y, visor.c[2]]);
  put(`sun_visor_${key}`, vp);
  art.push({ id: `sun_visor_${key}`, label: `${label} sun visor`, group: 'Cabin', actions: { on: 'Lower sun visor', off: 'Stow sun visor' },
    components: [`sun_visor_${key}`], transforms: [{ node: vp.name, rotate: { axis: [0, 0, 1], degrees: 78 } }] });
}
for (const [id, head, labelTxt] of [['rear_seatback_60', 'rear_headrest_60', 'Rear seatback (60 % section)'], ['rear_seatback_40', 'rear_headrest_40', 'Rear seatback (40 % section)']]) {
  const b = bb(id);
  const hinge = A.pivot(`tbx_pivot_${id}`, [b.max.x - 0.03, b.min.y + 0.03, b.c[2]]);
  put(id, hinge); put(head, hinge);
  art.push({ id, label: labelTxt, group: 'Seats', actions: { on: 'Fold seatback forward', off: 'Raise seatback' },
    components: [id, head, 'rear_seat_cushion'], transforms: [{ node: hinge.name, rotate: { axis: [0, 0, 1], degrees: -72 } }], duration: 1300 });
}
const arm = bb('console_armrest_lid');
const armPivot = A.pivot('tbx_pivot_console_lid', [arm.min.x, arm.max.y, 0]);
put('console_armrest_lid', armPivot);
art.push({ id: 'console_lid', label: 'Centre console lid', group: 'Cabin', actions: { on: 'Open console storage', off: 'Close console lid' },
  components: ['console_armrest_lid', 'center_console'], transforms: [{ node: armPivot.name, rotate: { axis: [0, 0, 1], degrees: 100 } }] });
const pb = bb('parking_brake_lever');
const pbPivot = A.pivot('tbx_pivot_parking_brake', [pb.min.x, pb.min.y, pb.c[2]]);
put('parking_brake_lever', pbPivot);
art.push({ id: 'parking_brake', label: 'Parking brake lever', group: 'Cabin', actions: { on: 'Apply parking brake', off: 'Release parking brake' },
  components: ['parking_brake_lever'], transforms: [{ node: pbPivot.name, rotate: { axis: [0, 0, 1], degrees: 22 } }] });
const gb = bb('glovebox');
const gbPivot = A.pivot('tbx_pivot_glovebox', [gb.min.x, gb.min.y, gb.c[2]]);
put('glovebox', gbPivot);
art.push({ id: 'glovebox', label: 'Glovebox', group: 'Cabin', actions: { on: 'Open glovebox', off: 'Close glovebox' },
  components: ['glovebox', 'instrument_panel_lower'], transforms: [{ node: gbPivot.name, rotate: { axis: [0, 0, 1], degrees: 60 } }] });

// Supplemental restraints at their deployment zones (modules are concealed in the source trim).
const dash = bb('instrument_panel_upper');
A.add('airbag_passenger_front', box(0.2, 0.012, 0.3, { at: [dash.min.x + 0.2, dash.max.y - 0.075, 0.38] }));
A.add('airbag_knee_driver', box(0.015, 0.1, 0.32, { at: [sw.c[0] + 0.12, 0.6, sw.c[2]] }));
const roof = bb('headliner');
for (const { key, s } of SIDES) {
  A.add(`airbag_curtain_${key}`, tube([[0.35, roof.max.y - 0.16, 0.66 * s], [-0.4, roof.max.y - 0.1, 0.64 * s], [-1.25, roof.max.y - 0.14, 0.62 * s]], 0.02, { radial: 6 }));
}
const pc = bb('seat_cushion_front_right');
A.add('airbag_seat_cushion_passenger', box(0.12, 0.03, 0.3, { at: [pc.max.x - 0.1, pc.max.y - 0.07, pc.c[2]] }));

// Everything else from the source is fixed to the body.
for (const id of G.keys()) if (!used.has(id)) put(id);

/* -------------------------- procedural engine bay and chassis, fitted -- */
const P = {
  L, HW: bodyHalfWidth, trackF, trackR, wheelY, tyreOD: wheelY * 2,
  axleFU: U(axleFX), axleRU: U(axleRX), WB: axleFX - axleRX,
  glass: { cowlU: U(bb('cowl_panel').min.x) + 0.14 },
  deck: { u0: U(bb('rear_seatback_60').min.x) + 0.02 },
  cabin: { frontSeatU: U(bb('seat_cushion_front_left').c[0]), rearSeatU: U(bb('rear_seat_cushion').c[0]) },
  engine: { uCrank: 0.82 }, frontShift: 0.16,
  features: { kneeAirbag: true, cushionAirbag: true }
};
const B = { X, belt: () => 1.0, HWy: () => -fd.min.z, wheelPivots, fuelDoor: { u: U(fd.c[0]), y: fd.c[1] } };
const ctx = { P, B, A, X, art };
A.skip = new Set(['floor_pan', 'rear_parcel_shelf', 'rear_seat_bulkhead']);
buildStructure(ctx);
buildSuspensionAndSteering(ctx);
buildPowertrain(ctx);
buildEngineBay(ctx);
buildTrunkAndFuel(ctx);
// Steering axis follows the measured rim tilt.
for (const def of art) for (const t of def.transforms) if (t.node === 'tbx_pivot_steering_wheel') t.rotate.axis = [-Math.cos(tilt), Math.sin(tilt), 0];

/* ------------------------------------------------------------ package -- */
const ids = new Set(A.componentIds());
for (const def of art) def.components = def.components.filter(c => ids.has(c));
const glb = writeGLB([A.root], { generator: 'toolbox-source-vehicle@1.0.0' });
const sha256 = crypto.createHash('sha256').update(glb.bytes).digest('hex');
const SOURCE_URL = 'https://sketchfab.com/3d-models/2014-toyota-corolla-e180-eu-with-interior-36f95efb0585464cae43a25a3b3392e8';
const components = [...ids].sort().map(id => {
  const d = describeComponent(id, 'e170');
  const procedural = !G.has(id);
  if (id === 'headliner' || id === 'grab_handles') d.layer = 'body';
  if (!procedural) d.sources = [{ label: 'Armored Wave — 2014 Toyota Corolla E180 EU (with interior), CC BY 4.0', url: SOURCE_URL }, ...d.sources];
  return { ...d, source: procedural ? undefined : SOURCE_URL, accuracyNote: procedural ? (d.accuracyNote.startsWith('Geometry is') ? 'Toolbox procedural approximation fitted inside the source body; not scanned geometry.' : d.accuracyNote) : 'Geometry from the source model of the 2014 Corolla (E180, European body).' };
});
const manifest = {
  schemaVersion: 1, packageVersion: '2.0.0',
  vehicle: { id: ID, make: 'Toyota', model: 'Corolla', displayName: '2014–2016 Toyota Corolla', year: null, years: [2014, 2015, 2016], generation: 'Eleventh generation (E170 / E180)', variant: 'Sedan · real E180 body and cabin', bodyStyle: 'Sedan', accuracy: 'generation' },
  license: {
    spdx: 'CC-BY-4.0', creator: 'Armored Wave', sourceUrl: SOURCE_URL, licenseUrl: 'http://creativecommons.org/licenses/by/4.0/',
    attribution: '"2014 Toyota Corolla E180 EU (with interior)" (https://skfb.ly/oLAVz) by Armored Wave is licensed under Creative Commons Attribution (http://creativecommons.org/licenses/by/4.0/).',
    modifications: 'Converted to a Toolbox Vehicle Package: textures and materials removed; meshes split into named components; doors, bonnet, boot, fuel door, mirrors, wheels, calipers, seats, visors, glovebox, console lid and parking brake articulated; scaled to 4,620 mm overall length; procedural engine bay, chassis and fuel system added.'
  },
  layers: [{ id: 'complete', label: 'Source body and cabin, procedural mechanical', glb: 'vehicle.glb', available: true, triangles: glb.triangles, sha256 }],
  layerGroups: LAYERS.filter(layer => components.some(c => c.layer === layer.id)),
  components, meshMappings: A.mappings, articulations: art, specSheet: 'specs.json',
  notes: 'Body, glass, lamps, wheels, brakes and the complete cabin are real geometry of the 2014 Corolla sedan (E180, European market) by Armored Wave. North American 2014–2016 cars share this body and cabin but use different bumpers, grilles and lamps. The engine bay, suspension, steering gear, fuel system and boot floor are Toolbox procedural approximations fitted inside it. Specifications describe the North American 2014–2016 car.',
  ingestion: { tool: 'scripts/build-source-vehicle.mjs', sourceScale: +scale.toFixed(5), outputTriangles: glb.triangles, sourceComponents: G.size }
};
const specs = specSheet('e170');
specs.sources.unshift({ label: 'Armored Wave — 2014 Toyota Corolla E180 EU (with interior), CC BY 4.0', url: SOURCE_URL });
const dir = path.join(ROOT, 'public/automobile/packages', ID);
await mkdir(dir, { recursive: true });
await writeFile(path.join(dir, 'vehicle.glb'), glb.bytes);
await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(path.join(dir, 'specs.json'), JSON.stringify(specs, null, 2) + '\n');
await updateCatalog(ROOT, [{
  id: ID, make: 'Toyota', model: 'Corolla', year: null, years: '2014–2016', generation: manifest.vehicle.generation,
  variant: manifest.vehicle.variant, bodyStyle: 'Sedan',
  aliases: ['Corolla', 'Toyota Corolla', 'E170', 'E180', 'ZRE172', '2014', '2015', '2016', 'Corolla 2014', 'Corolla 2015', 'Corolla 2016', 'Corolla LE', 'Corolla S'],
  manifest: `/automobile/packages/${ID}/manifest.json`, specSheet: `/automobile/packages/${ID}/specs.json`,
  specifications: { bodyStyle: 'Sedan', layout: 'Front-engine, front-wheel drive', engine: { code: '2ZR-FE 1.8 L I4 (2ZR-FAE on LE Eco)' }, transmission: { code: '6MT · 4AT (L) · CVTi-S' }, curbWeight: 'About 2,800 lb (LE / S)', wheelbase: '106.3 in (2,700 mm)' }
}]);
console.log(JSON.stringify({ package: ID, triangles: glb.triangles, bytes: glb.bytes.length, components: components.length, fromSource: G.size, articulations: art.length, scale: +scale.toFixed(4), wheelbase: +(axleFX - axleRX).toFixed(3), trackF: +trackF.toFixed(3) }));
