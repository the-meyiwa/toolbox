/* ============================================================
   Device name matching (js/lib/devices/db.js#deviceNameScore) and the
   quick device/comparison lookup used by Spotlight and the home search
   (js/lib/devices/quick-search.js).
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

const db = await import('../../js/lib/devices/db.js');
const qs = await import('../../js/lib/devices/quick-search.js');

test('deviceNameScore: shorthand and typos resolve, but not a chip false-positive', async () => {
  const phones = await db.loadCategory('phones');
  const named = (q) => db.searchDevices(phones, q, 5).map(d => d.name);

  assert.deepEqual(named('s23 plus'), ['Galaxy S23+']);
  assert.deepEqual(named('18 pro'), ['iPhone 18 Pro', 'iPhone 18 Pro Max']);
  assert.deepEqual(named('iphon 17 pro'), ['iPhone 17 Pro', 'iPhone 17 Pro Max']);
  // "18 Pro" must not resolve via the "A18 Pro" chip name of an unrelated, older phone.
  assert.ok(!named('18 pro').includes('iPhone 16 Pro'));
});

test('deviceNameScore: numbers never fuzzy-match (a typo is a different device, not a nearby model)', async () => {
  const cpus = await db.loadCategory('cpus');
  assert.deepEqual(db.searchDevices(cpus, 'm6', 5).map(d => d.name), ['Apple M6']); // base-only, ships in the Mac mini
  assert.deepEqual(db.searchDevices(cpus, 'm5 max', 5).map(d => d.name), ['Apple M5 Max']);
});

test('attribute search still works when no device is literally named that', async () => {
  const phones = await db.loadCategory('phones');
  const hits = db.searchDevices(phones, 'snapdragon 8 elite', 5);
  assert.ok(hits.length > 0);
  assert.ok(hits.every(d => /snapdragon 8 elite/i.test(d.chip || '')));
});

test('quickDeviceLookup: "A vs B" resolves both sides in the same category', async () => {
  const hit = await qs.quickDeviceLookup('18 pro vs s23 plus');
  assert.equal(hit.kind, 'compare');
  assert.equal(hit.category, 'phones');
  assert.deepEqual([hit.a.name, hit.b.name].sort(), ['Galaxy S23+', 'iPhone 18 Pro'].sort());
});

test('quickDeviceLookup: cross-category vs (GPUs, EVs)', async () => {
  const gpu = await qs.quickDeviceLookup('rtx 5090 vs 4090');
  assert.equal(gpu.category, 'gpus');
  const ev = await qs.quickDeviceLookup('byd seal vs tesla model 3');
  assert.equal(ev.category, 'evs');
});

test('quickDeviceLookup: a single confident device name', async () => {
  const hit = await qs.quickDeviceLookup('redmi pad se');
  assert.equal(hit.kind, 'device');
  assert.equal(hit.device.name, 'Redmi Pad SE');
});

test('quickDeviceLookup: ordinary text and tool searches never misfire', async () => {
  assert.equal(await qs.quickDeviceLookup('what is the weather today'), null);
  assert.equal(await qs.quickDeviceLookup('compress a photo'), null);
  assert.equal(await qs.quickDeviceLookup(''), null);
});

test('splitVsQuery', () => {
  assert.deepEqual(qs.splitVsQuery('A vs B'), ['A', 'B']);
  assert.deepEqual(qs.splitVsQuery('A versus B'), ['A', 'B']);
  assert.equal(qs.splitVsQuery('no separator here'), null);
  assert.equal(qs.splitVsQuery('A vs B vs C'), null);
});
