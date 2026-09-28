/* ============================================================
   Vehicle Guide: the 2008 Lexus GX 470, Boeing 737-800 and
   Cessna 172S packages. Published dimensions, complete reference
   data, every mesh mapped, moving parts that move the physical way,
   controls anchored to real parts, aircraft safety notes, and the
   Assistant answering from the vehicle the person names.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

setupDOMEnvironment();
const { validateVehiclePackage } = await import('../../js/lib/automobile/vehicle-package.js');
const { ArticulationController } = await import('../../js/lib/automobile/articulation-controller.js');
const { controlsFor, vehicleFromText } = await import('../../js/lib/automobile/vehicle-controls.js');
const { allControls } = await import('../../js/lib/automobile/controls-search.js');
const { SYMBOLS } = await import('../../js/lib/automobile/vehicle-symbols.js');
const { clusterSvg } = await import('../../js/lib/automobile/control-panel.js');
const { AIRCRAFT_SAFETY, INJURIES, safetyFor } = await import('../../js/lib/automobile/injury-data.js');

const PACKAGES = ['lexus-gx-470-2008', 'boeing-737-800', 'cessna-172s'];
const readJson = path => readFile(new URL(path, import.meta.url), 'utf8').then(JSON.parse);
const manifestOf = id => readJson(`../../public/automobile/packages/${id}/manifest.json`);
async function loadGlb(id) {
  const bytes = await readFile(new URL(`../../public/automobile/packages/${id}/vehicle.glb`, import.meta.url));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new Promise((resolve, reject) => new GLTFLoader().parse(buffer, '', resolve, reject));
}
/** World bounds of the meshes whose component satisfies `keep`. */
function bounds(gltf, manifest, keep) {
  const byId = new Map(manifest.components.map(c => [c.id, c]));
  const box = new Box3();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(node => { if (node.isMesh && keep(byId.get(manifest.meshMappings[node.name]))) box.expandByObject(node); });
  return box;
}
const partBox = (gltf, manifest, id) => bounds(gltf, manifest, c => c?.id === id);
const pivot = (gltf, name) => gltf.scene.getObjectByName(name).getWorldPosition(new Vector3());

test('New packages pass the runtime contract with complete, sourced reference data', async () => {
  const catalog = await readJson('../../public/automobile/catalog.json');
  for (const id of PACKAGES) {
    const m = await manifestOf(id);
    assert.equal(validateVehiclePackage(m), m);
    assert.equal(m.vehicle.accuracy, 'representative', 'procedural geometry never claims to be exact');
    assert.ok(m.components.length > 100, `${id} models body, cabin and mechanical parts`);
    assert.ok(m.articulations.length >= 20, `${id} has moving parts`);
    const layers = new Set(m.layerGroups.map(l => l.id));
    for (const c of m.components) {
      assert.ok(c.description && c.location && c.label, `${c.id} needs a label, description and location`);
      assert.ok(layers.has(c.layer), `${c.id} belongs to a declared layer`);
      assert.ok(c.sources?.length && c.sources.every(s => /^https:\/\//.test(s.url)), `${c.id} sources must be https links`);
    }
    const specs = await readJson(`../../public/automobile/packages/${id}/specs.json`);
    assert.ok(specs.groups.length >= 5 && specs.sources.length >= 4 && specs.disclaimer);
    // Quick actions and the cabin eye point name real things.
    const arts = new Set(m.articulations.map(a => a.id)), groups = new Set(m.articulations.map(a => a.group));
    for (const q of m.quickActions) {
      assert.ok(q.on && q.off, `${q.id} labels`);
      if (q.group) assert.ok(groups.has(q.group), q.id);
      for (const a of q.articulations || []) assert.ok(arts.has(a), `${q.id} → ${a}`);
      for (const l of q.layers || []) assert.ok(layers.has(l), `${q.id} → ${l}`);
    }
    const ids = new Set(m.components.map(c => c.id));
    assert.ok(ids.has(m.cabin.head) && ids.has(m.cabin.look), `${id} cabin eye point`);
    assert.ok(catalog.vehicles.some(v => v.id === id && v.specSheet && v.manifest), `${id} is in the catalogue`);
  }
});

test('GX 470 geometry follows the published 2008 dimensions', async () => {
  const id = 'lexus-gx-470-2008', m = await manifestOf(id), g = await loadGlb(id);
  const body = bounds(g, m, c => ['body', 'glass'].includes(c?.layer));
  const size = body.getSize(new Vector3());
  assert.ok(Math.abs(size.x - 4.780) < 0.02, `length ${size.x}`);
  assert.ok(Math.abs(size.z - 1.880) < 0.02, `width ${size.z}`);
  const roof = bounds(g, m, c => ['body', 'glass'].includes(c?.layer) || c?.id === 'roof_rails');
  assert.ok(Math.abs(roof.max.y - 1.895) < 0.01, `height with roof rails ${roof.max.y}`);
  assert.ok(Math.abs(pivot(g, 'tbx_pivot_wheel_front_left').x - pivot(g, 'tbx_pivot_wheel_rear_left').x - 2.789) < 0.01, 'wheelbase 109.8 in');
  assert.ok(Math.abs(pivot(g, 'tbx_pivot_wheel_front_right').z - pivot(g, 'tbx_pivot_wheel_front_left').z - 1.585) < 0.01, 'track 62.4 in');
  const diff = partBox(g, m, 'rear_differential');
  assert.ok(Math.abs(diff.min.y - 0.211) < 0.01, `ground clearance ${diff.min.y}`);
});

test('737-800 geometry follows Boeing’s airport-planning dimensions', async () => {
  const id = 'boeing-737-800', m = await manifestOf(id), g = await loadGlb(id);
  const all = bounds(g, m, c => ['airframe', 'wings', 'controls', 'glass', 'doors'].includes(c?.layer));
  const size = all.getSize(new Vector3());
  assert.ok(Math.abs(size.x - 39.47) < 0.05, `length ${size.x}`);
  assert.ok(Math.abs(size.z - 35.79) < 0.05, `wingspan with winglets ${size.z}`);
  assert.ok(Math.abs(all.max.y - 12.55) < 0.02, `tail height ${all.max.y}`);
  const fus = bounds(g, m, c => /^fuselage_section_/.test(c?.id || ''));
  assert.ok(Math.abs(fus.getSize(new Vector3()).z - 3.76) < 0.02, 'fuselage width 12 ft 4 in');
  assert.ok(Math.abs(fus.getSize(new Vector3()).y - 4.01) < 0.03, 'fuselage height');
  assert.ok(Math.abs(pivot(g, 'tbx_pivot_nose_gear').x - pivot(g, 'tbx_pivot_main_gear_left').x - 15.6) < 0.02, 'wheelbase 51 ft 2 in');
  assert.ok(Math.abs(pivot(g, 'tbx_pivot_main_gear_right').z - pivot(g, 'tbx_pivot_main_gear_left').z - 5.72) < 0.02, 'main gear track');
  const tyre = partBox(g, m, 'main_tyre_outboard_left');
  assert.ok(Math.abs(tyre.getSize(new Vector3()).y - 44.5 * 0.0254) < 0.01, 'H44.5 main tyres');
});

test('Cessna 172S geometry follows the handbook dimensions', async () => {
  const id = 'cessna-172s', m = await manifestOf(id), g = await loadGlb(id);
  // Overall length runs from the spinner tip to the rudder.
  const all = bounds(g, m, c => ['airframe', 'wings', 'controls', 'glass', 'doors', 'lighting'].includes(c?.layer) || c?.id === 'propeller_spinner');
  const size = all.getSize(new Vector3());
  assert.ok(Math.abs(size.x - 8.28) < 0.03, `length ${size.x}`);
  assert.ok(Math.abs(size.z - 11.0) < 0.03, `wingspan ${size.z}`);
  assert.ok(Math.abs(all.max.y - 2.72) < 0.02, `height ${all.max.y}`);
  const prop = partBox(g, m, 'propeller').getSize(new Vector3());
  assert.ok(Math.abs(Math.max(prop.y, prop.z) - 76 * 0.0254) < 0.03, `76 in propeller ${prop.y}`);
});

test('Every new mesh is mapped, fits the mobile budget, and every articulation resolves', async () => {
  for (const id of PACKAGES) {
    const m = await manifestOf(id), g = await loadGlb(id);
    let triangles = 0;
    g.scene.traverse(node => {
      if (!node.isMesh) return;
      triangles += node.geometry.index.count / 3;
      assert.ok(m.meshMappings[node.name], `unmapped mesh ${node.name}`);
    });
    assert.equal(triangles, m.layers[0].triangles);
    assert.ok(triangles < 250000, `${id} fits the mobile geometry budget`);
    const c = new ArticulationController(g.scene, m.articulations);
    assert.deepEqual(c.missing, []);
    assert.equal(c.size, m.articulations.length);
  }
});

/** Bounds of a part before and after setting articulations. */
async function move(id, part, arts) {
  const m = await manifestOf(id), g = await loadGlb(id);
  const c = new ArticulationController(g.scene, m.articulations, { reducedMotion: true });
  const before = partBox(g, m, part).clone();
  for (const a of arts) assert.ok(c.set(a, true), `${id}: ${a} can be set`);
  g.scene.updateMatrixWorld(true);
  return { before, after: partBox(g, m, part), c, g, m };
}

test('737 moving parts move the way the real ones do', async () => {
  const id = 'boeing-737-800';
  let r = await move(id, 'aileron_left', ['roll_left']);
  assert.ok(r.after.max.y > r.before.max.y + 0.05, 'rolling left raises the left aileron');
  r = await move(id, 'aileron_right', ['roll_left']);
  assert.ok(r.after.min.y < r.before.min.y - 0.05, 'and lowers the right one');
  r = await move(id, 'spoiler_3_left', ['roll_left']);
  assert.ok(r.after.max.y > r.before.max.y + 0.1, 'left flight spoilers help roll left');
  r = await move(id, 'elevator_left', ['pitch_up']);
  assert.ok(r.after.max.y > r.before.max.y + 0.05, 'pitch up raises the elevator trailing edge');
  r = await move(id, 'rudder', ['yaw_right']);
  assert.ok(r.after.max.z > r.before.max.z + 0.1, 'right rudder swings the trailing edge right');
  r = await move(id, 'flap_outboard_right', ['flaps_30']);
  assert.ok(r.after.min.y < r.before.min.y - 0.2 && r.after.min.x < r.before.min.x - 0.2, 'flaps travel aft and down');
  r = await move(id, 'slat_2_left', ['flaps_30']);
  assert.ok(r.after.max.x > r.before.max.x + 0.1 && r.after.min.y < r.before.min.y, 'slats move forward and down');
  r = await move(id, 'main_tyre_outboard_left', ['gear_main_left']);
  assert.ok(r.after.min.y > r.before.min.y + 0.8, 'the left main gear lifts');
  assert.ok(Math.abs((r.after.min.z + r.after.max.z) / 2) < Math.abs((r.before.min.z + r.before.max.z) / 2) - 0.8, 'and folds inboard');
  r = await move(id, 'nose_tyre_left', ['gear_nose']);
  assert.ok(r.after.min.y > r.before.min.y + 0.8 && r.after.max.x > r.before.max.x + 0.5, 'the nose gear folds forward');
  r = await move(id, 'door_l1', ['door_l1']);
  assert.ok(r.after.min.z < r.before.min.z - 0.4 && r.after.max.x > r.before.max.x, 'L1 swings out and forward');
  r = await move(id, 'cargo_door_forward', ['cargo_door_forward']);
  assert.ok(r.after.min.z < r.before.min.z - 0.3, 'the cargo door opens inward and up');
  r = await move(id, 'thrust_reverser_left', ['reverser_left']);
  assert.ok(r.after.min.x < r.before.min.x - 0.4, 'reverser sleeves slide aft');
  r = await move(id, 'radome', ['radome']);
  assert.ok(r.after.max.y > r.before.max.y + 0.5, 'the radome hinges up');
  // Fan cowls and reversers guard each other; closing the flaps is exclusive with the other setting.
  r = await move(id, 'engine_fan_cowl_left', ['reverser_left']);
  assert.equal(r.c.set('fan_cowl_left', true), false, 'cowls stay shut while the reverser is deployed');
  r.c.set('flaps_5', true); r.c.set('flaps_30', true);
  assert.equal(r.c.isActive('flaps_5'), false, 'one flap setting at a time');
});

test('Cessna and GX 470 moving parts move the way the real ones do', async () => {
  let r = await move('cessna-172s', 'aileron_left', ['roll_left']);
  assert.ok(r.after.max.y > r.before.max.y + 0.02, 'Cessna: rolling left raises the left aileron');
  r = await move('cessna-172s', 'flap_right', ['flaps_30']);
  assert.ok(r.after.min.y < r.before.min.y - 0.1, 'Cessna: flaps go down');
  r = await move('cessna-172s', 'cabin_door_left', ['cabin_door_left']);
  assert.ok(r.after.min.z < r.before.min.z - 0.3, 'Cessna: the left door opens outward');
  r = await move('cessna-172s', 'elevator_trim_tab', ['trim_nose_up']);
  assert.ok(r.after.min.y < r.before.min.y - 0.01, 'Cessna: nose-up trim puts the tab down');
  r = await move('cessna-172s', 'oil_dipstick', ['oil_access_door', 'oil_dipstick']);
  assert.ok(r.after.min.y > r.before.min.y + 0.1, 'Cessna: the dipstick pulls out once the oil door is open');
  const gx = 'lexus-gx-470-2008';
  r = await move(gx, 'rear_door', ['rear_door']);
  assert.ok(r.after.min.x < r.before.min.x - 0.5, 'GX: the side-hinged rear door swings out behind the vehicle');
  assert.ok(r.after.max.z > 0.5, 'GX: it is hinged on the right');
  r = await move(gx, 'rear_glass_hatch', ['rear_glass_hatch']);
  assert.ok(r.after.min.x < r.before.min.x - 0.2 && r.after.min.y > r.before.min.y + 0.1, 'GX: the glass hatch lifts up and out');
  r = await move(gx, 'door_front_left_outer_panel', ['door_front_left']);
  assert.ok(r.after.min.z < r.before.min.z - 0.4, 'GX: the driver’s door opens outward');
  r = await move(gx, 'hood', ['hood']);
  assert.ok(r.after.max.y > r.before.max.y + 0.4, 'GX: the bonnet opens');
  r = await move(gx, 'spare_tyre', ['spare_tyre']);
  assert.ok(r.after.min.y < r.before.min.y - 0.1, 'GX: the spare winches down');
  assert.equal(r.c.set('oil_dipstick', true), false, 'GX: service items need the bonnet open');
});

test('Controls: every panel is anchored to a real part and every symbol exists', async () => {
  for (const id of PACKAGES) {
    const lib = controlsFor(id), m = await manifestOf(id);
    const ids = new Set(m.components.map(c => c.id));
    assert.ok(lib.clusters.length >= 12, `${id} has a full controls library`);
    assert.ok(lib.clusters.some(c => c.zone === 'interior') && lib.clusters.some(c => c.zone === 'exterior'));
    const seen = new Set();
    for (const cl of lib.clusters) {
      assert.ok(ids.has(cl.anchor), `${id}/${cl.id} anchors to ${cl.anchor}`);
      assert.ok(cl.at.every(v => v >= 0 && v <= 1), cl.id);
      for (const ctl of allControls(cl)) {
        assert.ok(!seen.has(ctl.id), `duplicate control ${ctl.id}`); seen.add(ctl.id);
        assert.ok(SYMBOLS[ctl.sym], `${ctl.id}: no symbol ${ctl.sym}`);
        if (ctl.sym2) assert.ok(SYMBOLS[ctl.sym2], `${ctl.id}: no symbol ${ctl.sym2}`);
        assert.ok(ctl.label && ctl.what, ctl.id);
      }
      const svg = clusterSvg(cl, { selected: allControls(cl)[0].id });
      assert.equal((svg.match(/data-ctl="/g) || []).length, allControls(cl).length, cl.id);
      assert.doesNotMatch(svg, /NaN|undefined/, cl.id);
    }
  }
  assert.equal(controlsFor('boeing-737-800').spaces.interior, 'Flight deck');
  assert.equal(controlsFor('cessna-172s').spaces.interior, 'Cockpit');
});

test('Controls: plain descriptions find the right switch on each vehicle', () => {
  const cases = [
    ['boeing-737-800', 'where is the landing gear lever', 'center-panel', 'gear-lever'],
    ['boeing-737-800', 'what does the red fire warn light mean', 'warnings', 'fire-warn'],
    ['boeing-737-800', 'how do I set the altimeter baro', 'efis', 'efis-baro'],
    ['boeing-737-800', 'which lever sets the flaps', 'control-stand', 'flap-lever'],
    ['boeing-737-800', 'how do you turn on the seat belt sign', 'overhead-lights', 'belts'],
    ['cessna-172s', 'the red knob is it the mixture', 'power-controls', 'mixture'],
    ['cessna-172s', 'fuel selector on both', 'fuel', 'selector'],
    ['cessna-172s', 'how do I check the oil level', 'ext-engine', 'oil'],
    ['lexus-gx-470-2008', 'what is the center diff lock button', 'console', 'diff-lock-sw'],
    ['lexus-gx-470-2008', 'orange light that looks like an engine', 'cluster', 'check-engine'],
    ['lexus-gx-470-2008', 'how do I open the back glass', 'rear-exterior', 'rear-glass'],
    ['lexus-gx-470-2008', 'lever on the right of the steering wheel', 'wiper-stalk', null],
  ];
  for (const [id, q, cluster, control] of cases) {
    const r = controlsFor(id).find(q);
    assert.equal(r?.cluster.id, cluster, `${id}: ${q}`);
    if (control) assert.equal(r?.control?.id, control, `${id}: ${q}`);
  }
  assert.equal(vehicleFromText('the flight deck of a 737'), 'boeing-737-800');
  assert.equal(vehicleFromText('my Cessna 172'), 'cessna-172s');
  assert.equal(vehicleFromText('2008 Lexus GX470'), 'lexus-gx-470-2008');
  assert.equal(vehicleFromText('Honda Civic'), null);
});

test('Aircraft safety: every rule matches a real aircraft part and names known injuries', async () => {
  const ids = new Set();
  for (const id of ['boeing-737-800', 'cessna-172s']) for (const c of (await manifestOf(id)).components) ids.add(c.id);
  for (const r of AIRCRAFT_SAFETY) {
    assert.ok([...ids].some(id => r.test.test(id)), `rule ${r.test} matches a real component`);
    for (const i of r.injuries) assert.ok(INJURIES[i], `rule ${r.test}: injury ${i}`);
    assert.ok(r.prevention.length && r.hazard);
    for (const t of [r.hazard, ...r.prevention]) assert.doesNotMatch(t, /[{}]/, 'no compound links in aircraft notes');
  }
  for (const id of ['propeller', 'engine_inlet_cowl_left', 'main_tyre_outboard_left', 'door_l1', 'cabin_door_left', 'exhaust_system', 'fuel_tank_left']) {
    assert.ok(safetyFor(id, { kind: 'aircraft' })?.prevention.length, `${id} has aircraft safety notes`);
  }
  assert.equal(safetyFor('door_l1'), null, 'car rules stay car rules');
  assert.match(safetyFor('seat_belts', { kind: 'aircraft' }).hazard, /forced landing/);
});

test('Assistant: vehicle_part and vehicle_controls answer from the vehicle the person names', async () => {
  const { executeExtraTool } = await import('../../js/lib/assistant/extra-tools.js');
  const { TOOL_GROUPS } = await import('../../js/lib/assistant/tool-groups.js');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => ({ ok: true, json: async () => JSON.parse(readFileSync(new URL(`../../public${url}`, import.meta.url))) });
  try {
    assert.match('what does the mixture knob do in a cessna', TOOL_GROUPS.vehicles.match);
    assert.match('where is the landing gear lever on a 737', TOOL_GROUPS.vehicles.match);
    const apu = await executeExtraTool('vehicle_part', { query: 'where is the APU', vehicle: 'Boeing 737' });
    assert.equal(apu.vehicleId, 'boeing-737-800');
    assert.equal(apu.component.id, 'apu');
    assert.equal(apu.kind, 'aircraft');
    const spare = await executeExtraTool('vehicle_part', { query: 'spare tyre', vehicle: '2008 GX 470' });
    assert.equal(spare.vehicleId, 'lexus-gx-470-2008');
    assert.equal(spare.component.id, 'spare_tyre');
    const prop = await executeExtraTool('vehicle_part', { query: 'propeller on my cessna' });
    assert.equal(prop.vehicleId, 'cessna-172s');
    assert.ok(prop.hasSafety, 'the propeller carries its safety note');
    const mix = await executeExtraTool('vehicle_controls', { query: 'red knob mixture', vehicle: 'Cessna 172S' });
    assert.equal(mix.vehicleId, 'cessna-172s');
    assert.equal(mix.control, 'mixture');
    assert.match(mix.message, /learning/);
    const mcp = await executeExtraTool('vehicle_controls', { query: 'autopilot heading knob', vehicle: '737' });
    assert.equal(mcp.cluster, 'mcp');
    const civic = await executeExtraTool('vehicle_controls', { query: 'button on the door', vehicle: 'Honda Civic 2018' });
    assert.equal(civic.vehicleId, 'toyota-corolla-2014-2016');
    assert.match(civic.message, /Honda Civic 2018 may lay these out differently/);
  } finally { globalThis.fetch = realFetch; }
});

test('The tool is called the Vehicle Guide and #vehicle-guide opens it', async () => {
  const { BY_ID, resolveId } = await import('../../js/registry/index.js');
  assert.equal(BY_ID.get('automobile-guide').name, 'Vehicle Guide');
  assert.deepEqual(resolveId('vehicle-guide'), { id: 'automobile-guide', redirected: true });
  const src = readFileSync(new URL('../../js/tools/automobile-guide.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /Automobile Guide/);
});
