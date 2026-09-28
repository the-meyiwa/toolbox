/* ============================================================
   Vehicle Guide injury reference: every drug and substance is in
   the Compound Database, every body site resolves to atlas
   structures, and every hazardous part has safety information.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

setupDOMEnvironment();
const { SITES, FRACTURE_TYPES, INJURIES, PART_SAFETY, safetyFor, findInjuries } = await import('../../js/lib/automobile/injury-data.js');
const { COMPOUNDS_DATA } = await import('../../js/lib/compounds-dataset.js');
const atlas = JSON.parse(readFileSync(new URL('../../public/anatomy/index.json', import.meta.url)));
const manifest = JSON.parse(readFileSync(new URL('../../public/automobile/packages/toyota-corolla-2014-2016/manifest.json', import.meta.url)));
const structureNames = new Set(atlas.structures.map(s => s.name));
const compoundNames = new Set(COMPOUNDS_DATA.map(c => c.name));

const texts = () => {
  const out = [];
  for (const inj of Object.values(INJURIES)) out.push(inj.what, inj.signs, inj.firstAid, ...(inj.treatment || []));
  for (const r of PART_SAFETY) out.push(r.hazard, ...r.prevention);
  return out.filter(Boolean);
};

test('Injuries: every drug and substance named is in the Compound Database', () => {
  const missing = new Set();
  for (const t of texts()) for (const [, name] of t.matchAll(/\{!?([^}]+)\}/g)) if (!compoundNames.has(name)) missing.add(name);
  assert.deepEqual([...missing], []);
});

test('Injuries: every body site resolves to real atlas structures', () => {
  for (const [key, site] of Object.entries(SITES)) {
    for (const n of [...site.structures, ...(site.context || [])]) assert.ok(structureNames.has(n), `${key}: no atlas structure “${n}”`);
    if (site.marker) assert.ok(site.structures.includes(site.marker.structure), `${key}: marker on a shown structure`);
  }
  for (const t of texts()) for (const [, key] of t.matchAll(/\[([a-z0-9-]+)\|/g)) assert.ok(SITES[key], `unknown site ${key} in “${t.slice(0, 50)}”`);
  for (const [id, inj] of Object.entries(INJURIES)) {
    for (const s of inj.sites || []) assert.ok(SITES[s], `${id}: site ${s}`);
    for (const f of inj.fractures || []) assert.ok(FRACTURE_TYPES[f], `${id}: fracture ${f}`);
    assert.ok(inj.name && inj.what && inj.firstAid && inj.treatment?.length, `${id} is complete`);
  }
});

test('Injuries: hazardous Corolla parts carry injuries and prevention', () => {
  const ids = new Set(manifest.components.map(c => c.id));
  for (const r of PART_SAFETY) {
    assert.ok([...ids].some(id => r.test.test(id)), `rule ${r.test} matches a real component`);
    for (const i of r.injuries) assert.ok(INJURIES[i], `rule ${r.test}: injury ${i}`);
    assert.ok(r.prevention.length, `rule ${r.test} has prevention`);
  }
  for (const id of ['airbag_driver_front', 'seat_belts', 'brake_pads_front_left', 'tyre_front_left', 'battery_12v', 'radiator_cap', 'cooling_fan', 'exhaust_manifold', 'jack_and_tools', 'door_front_left_outer_panel', 'headrest_front_left', 'steering_wheel', 'hood_prop_rod']) {
    const s = safetyFor(id);
    assert.ok(s && s.injuries.length && s.prevention.length, `${id} has safety information`);
  }
  assert.equal(safetyFor('sun_visor_left'), null, 'harmless parts stay quiet');
  const femur = safetyFor('instrument_panel_lower').injuries.find(i => i.id === 'femur-fracture');
  assert.ok(femur.fractures.includes('spiral') && femur.sites.includes('femur-shaft'));
  assert.equal(findInjuries('femur fracture')[0].id, 'femur-fracture');
});

test('Assistant: car_injury answers injury and part questions with the reference', async () => {
  const { executeExtraTool, EXTRA_TOOL_NAMES } = await import('../../js/lib/assistant/extra-tools.js');
  const { TOOL_GROUPS } = await import('../../js/lib/assistant/tool-groups.js');
  assert.ok(EXTRA_TOOL_NAMES.has('car_injury'));
  assert.ok(TOOL_GROUPS.vehicles.tools.includes('car_injury'));
  assert.match('what injuries can a seat belt cause in a crash', TOOL_GROUPS.vehicles.match);
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => ({ ok: true, json: async () => JSON.parse(readFileSync(new URL(`../../public${url}`, import.meta.url))) });
  try {
    const femur = await executeExtraTool('car_injury', { query: 'broken femur from hitting the dashboard' });
    assert.equal(femur.renderer, 'car-injury');
    assert.ok(femur.injuries.includes('femur-fracture'));
    assert.doesNotMatch(femur.message, /[{}[\]]/, 'the model sees plain text');
    const belt = await executeExtraTool('car_injury', { query: 'seat belt injuries' });
    assert.equal(belt.part?.id, 'seat_belts');
    assert.ok(belt.injuries.includes('clavicle-fracture'));
    const part = await executeExtraTool('vehicle_part', { query: 'radiator cap' });
    assert.ok(part.hasSafety);
    assert.match(part.message, /Common injuries: .*Burns and scalds/);
  } finally { globalThis.fetch = realFetch; }
});
