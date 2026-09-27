/* ============================================================
   Car controls: the researched Corolla switch library, the
   "what is this button?" search, the SVG panel and the
   Assistant's vehicle_controls tool.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

setupDOMEnvironment();
const { CLUSTERS, CLUSTER, VEHICLE_ID, findControls, allControls } = await import('../../js/lib/automobile/corolla-controls.js');
const { SYMBOLS } = await import('../../js/lib/automobile/vehicle-symbols.js');
const { clusterSvg } = await import('../../js/lib/automobile/control-panel.js');
const { executeExtraTool, EXTRA_TOOL_NAMES } = await import('../../js/lib/assistant/extra-tools.js');
const { TOOL_GROUPS } = await import('../../js/lib/assistant/tool-groups.js');

const manifest = JSON.parse(readFileSync(new URL(`../../public/automobile/packages/${VEHICLE_ID}/manifest.json`, import.meta.url)));
const componentIds = new Set(manifest.components.map(c => c.id));

test('Car controls: every cluster is anchored to a real part and every symbol exists', () => {
  assert.ok(CLUSTERS.length >= 15);
  assert.ok(componentIds.has('headrest_front_left'), "the interior view sits at the driver's head restraint");
  const ids = new Set();
  for (const cl of CLUSTERS) {
    assert.ok(componentIds.has(cl.anchor), `${cl.id} anchors to ${cl.anchor}, which the package lacks`);
    assert.ok(['interior', 'exterior'].includes(cl.zone), cl.id);
    for (const ctl of allControls(cl)) {
      assert.ok(!ids.has(ctl.id), `duplicate control id ${ctl.id}`);
      ids.add(ctl.id);
      assert.ok(SYMBOLS[ctl.sym], `${ctl.id}: no symbol "${ctl.sym}"`);
      if (ctl.sym2) assert.ok(SYMBOLS[ctl.sym2], `${ctl.id}: no symbol "${ctl.sym2}"`);
      assert.ok(ctl.label && ctl.what, `${ctl.id} needs a label and an explanation`);
    }
  }
});

test('Car controls: plain descriptions find the right switch or light', () => {
  const cases = [
    ["There's a button on the door of my Toyota, what is it for?", 'driver-door', null],
    ['orange light that looks like an engine', 'cluster', 'lamp-mil'],
    ['red light like a battery', 'cluster', 'lamp-charging'],
    ['yellow light with exclamation in a horseshoe', 'cluster', 'lamp-tpms'],
    ['what does the button with a car and squiggly lines do', 'lower-left-dash', 'vsc-off'],
    ['what is the knob with L and R', 'lower-left-dash', 'mirror-switch'],
    ['lever on the right of the steering wheel', 'wiper-stalk', null],
    ['where is the hood release', 'releases', 'hood-release'],
    ['the car with arrow button', 'climate', 'recirc'],
    ['how do I open the fuel door', 'fuel-filler', null],
  ];
  for (const [q, cluster, control] of cases) {
    const r = findControls(q);
    assert.equal(r?.cluster.id, cluster, q);
    if (control) assert.equal(r.control?.id, control, q);
  }
  assert.equal(findControls('weather in lagos'), null);
  assert.equal(findControls(''), null);
});

test('Car controls: a cluster draws as one SVG with every control tappable', () => {
  for (const cl of CLUSTERS) {
    const svg = clusterSvg(cl, { selected: allControls(cl)[0].id });
    assert.match(svg, /^<svg class="vc-svg" viewBox="0 0 \d+(\.\d+)? \d+(\.\d+)?"/, cl.id);
    assert.equal((svg.match(/data-ctl="/g) || []).length, allControls(cl).length, cl.id);
    assert.equal((svg.match(/is-selected/g) || []).length, 1, cl.id);
    assert.doesNotMatch(svg, /NaN|undefined/, cl.id);
  }
});

test('Assistant: vehicle_controls shows "One of these?" for a described button', async () => {
  assert.ok(EXTRA_TOOL_NAMES.has('vehicle_controls'));
  assert.ok(TOOL_GROUPS.vehicles.tools.includes('vehicle_controls'));
  assert.match("there's a button on the door of my toyota", TOOL_GROUPS.vehicles.match);
  assert.match('orange light on my dashboard', TOOL_GROUPS.vehicles.match);
  const r = await executeExtraTool('vehicle_controls', { query: 'orange light that looks like an engine' });
  assert.equal(r.renderer, 'vehicle-controls');
  assert.equal(r.cluster, 'cluster');
  assert.equal(r.control, 'lamp-mil');
  assert.ok(CLUSTER[r.cluster]);
  assert.match(r.best_match.what, /engine/i);
  assert.ok(r.controls.length > 10);
  const other = await executeExtraTool('vehicle_controls', { query: 'button on the door', vehicle: 'Honda Civic 2018' });
  assert.match(other.message, /Honda Civic 2018 may lay these out differently/);
  const none = await executeExtraTool('vehicle_controls', { query: 'weather in lagos' });
  assert.equal(none.status, 'error');
});

test('Car parts: mechanics\' and everyday names find the right component', async () => {
  const { findPart, specRowsFor } = await import('../../js/lib/automobile/part-search.js');
  const specs = JSON.parse(readFileSync(new URL(`../../public/automobile/packages/${VEHICLE_ID}/specs.json`, import.meta.url)));
  const cases = [
    ['where is the oil filter', /^oil_filter/], ['sump', /^oil_pan$/], ['fan belt', /^drive_belt$/], ['cat', /^catalytic_converter$/],
    ['front left brake pads', /^brake_pads_front_left$/], ['rear right shock', /^rear_shock_absorber_right$/],
    ['cv axle on the passenger side', /^driveshaft_right$/], ['bonnet', /^hood$/], ['fuse box', /^fuse_relay_box$/],
    ['o2 sensor', /^oxygen_sensors$/], ['where is the battery', /^battery_12v$/],
  ];
  for (const [q, id] of cases) assert.match(findPart(manifest.components, q)?.component.id || '', id, q);
  assert.equal(findPart(manifest.components, 'the weather'), null);
  const oil = specRowsFor(specs, manifest.components.find(c => c.id === 'oil_filter_housing')).map(r => r[1]);
  assert.deepEqual(oil, ['Engine oil', 'Oil filter']);
  assert.deepEqual(specRowsFor(specs, manifest.components.find(c => c.id === 'fuse_relay_box')), [], 'the fuse box is not an engine spec');
});

test('Assistant: vehicle_part returns the part, its figures and a 3D handoff', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const file = new URL(`../../public${url}`, import.meta.url);
    return { ok: true, json: async () => JSON.parse(readFileSync(file)) };
  };
  try {
    assert.ok(EXTRA_TOOL_NAMES.has('vehicle_part'));
    assert.ok(TOOL_GROUPS.vehicles.tools.includes('vehicle_part'));
    assert.match('where is the oil filter on my car', TOOL_GROUPS.vehicles.match);
    const r = await executeExtraTool('vehicle_part', { query: 'where is the oil filter' });
    assert.equal(r.renderer, 'vehicle-part');
    assert.match(r.component.id, /^oil_filter/);
    assert.ok(r.specRows.some(([, k, v]) => k === 'Engine oil' && /0W-20/.test(v)));
    assert.match(r.message, /Where:/);
    const none = await executeExtraTool('vehicle_part', { query: 'the weather' });
    assert.equal(none.status, 'error');
  } finally { globalThis.fetch = realFetch; }
});
