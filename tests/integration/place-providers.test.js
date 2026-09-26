/* ============================================================
   TOOLBOX — Extra place providers (TomTom, Foursquare)
   Offline: tests/helpers/maps-fixture.js stubs both services.
   Checks that providers are used only when their key is set,
   that answers are merged so each place appears once and names
   who listed it, that a spent quota or outage just drops that
   provider, and that fuzzy matches never replace a named business.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { executeAssistantTool } from '../../js/lib/assistant-tools.js';
import { searchNearby } from '../../server-maps.js';
import { mergePlaces, samePlace } from '../../server-place-providers.js';
import { installMapsFixture } from '../helpers/maps-fixture.js';

const HOME = [3.3800, 6.5805];
const at = (p) => ({ taskState: { userLocation: { lng: p[0], lat: p[1] } } });

const ALL_KEYS = ['TOMTOM_API_KEY', 'FOURSQUARE_API_KEY', 'HERE_API_KEY', 'MAPBOX_ACCESS_TOKEN', 'GOOGLE_PLACES_API_KEY'];

function withKeys(keys, fn) {
  return async () => {
    const saved = Object.fromEntries(ALL_KEYS.map(k => [k, process.env[k]]));
    for (const k of ALL_KEYS) delete process.env[k];
    Object.assign(process.env, keys);
    try { await fn(); } finally {
      for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    }
  };
}

test('no keys: only OpenStreetMap is asked', withKeys({}, async () => {
  const fx = installMapsFixture();
  try {
    const res = await searchNearby({ q: 'pharmacy', near: HOME, limit: 5 });
    assert.deepEqual(res.searched, ['OpenStreetMap']);
    assert.ok(!fx.calls.some(h => /tomtom|foursquare|here|mapbox|google/.test(h)));
  } finally { fx.restore(); }
}));

test('every provider key set: five providers, still one entry per place', withKeys({ TOMTOM_API_KEY: 'a', FOURSQUARE_API_KEY: 'b', HERE_API_KEY: 'c', MAPBOX_ACCESS_TOKEN: 'd', GOOGLE_PLACES_API_KEY: 'e' }, async () => {
  const fx = installMapsFixture();
  try {
    const res = await searchNearby({ q: 'nearest pharmacy', near: HOME, limit: 10 });
    assert.deepEqual(res.searched, ['OpenStreetMap', 'TomTom', 'Foursquare', 'HERE', 'Mapbox', 'Google']);
    assert.equal(res.providerErrors, undefined, 'every provider answered');
    assert.deepEqual(res.places.map(p => p.name), ['Estate Pharmacy', 'HealthPlus']);
    assert.equal(res.places[0].sources.length, 6);
    assert.equal(res.places[0].phone, '+234 800 000 0000');
  } finally { fx.restore(); }
}));

test('all providers: one entry per place, agreement recorded, extra places added', withKeys({ TOMTOM_API_KEY: 't', FOURSQUARE_API_KEY: 'f' }, async () => {
  const fx = installMapsFixture();
  try {
    const res = await executeAssistantTool('search_places_nearby', { query: 'Shoprite', limit: 10 }, at(HOME));
    assert.equal(res.status, 'success');
    const names = res.places.map(p => p.name);
    assert.equal(names.filter(n => /ojota/i.test(n)).length, 1, `merged: ${names.join(', ')}`);
    assert.equal(names[0], 'Shoprite Ojota', 'the OpenStreetMap name is kept');
    assert.deepEqual(res.places[0].confirmedBy, ['OpenStreetMap', 'TomTom', 'Foursquare']);
    assert.ok(names.some(n => /^shoprite maryland mall$/i.test(n)), 'a place only the providers know is added');
    assert.ok(!names.some(n => /spar/i.test(n)), 'a fuzzy match on "supermarket" never answers a brand search');
    assert.ok(fx.calls.includes('api.tomtom.com') && fx.calls.includes('places-api.foursquare.com'));
  } finally { fx.restore(); }
}));

test('a spent quota drops that provider and it sits out the next searches', withKeys({ TOMTOM_API_KEY: 't2', FOURSQUARE_API_KEY: 'f2' }, async () => {
  const fx = installMapsFixture({ providerStatus: { 'api.tomtom.com': 429 } });
  try {
    const res = await searchNearby({ q: 'fuel', near: HOME, limit: 5 });
    assert.ok(res.places.length >= 2);
    assert.ok(res.providerErrors.some(e => /TomTom: TomTom answered 429/.test(e)));
    const before = fx.calls.filter(h => h === 'api.tomtom.com').length;
    const again = await searchNearby({ q: 'bank', near: HOME, limit: 5 });
    assert.equal(fx.calls.filter(h => h === 'api.tomtom.com').length, before, 'TomTom not asked again');
    assert.ok(!again.searched.includes('TomTom'));
  } finally { fx.restore(); }
}));

test('OpenStreetMap down: the other providers still answer', withKeys({ FOURSQUARE_API_KEY: 'f3' }, async () => {
  const fx = installMapsFixture({ overpassDown: 'all' });
  const keepAlive = setInterval(() => {}, 1000);
  try {
    const res = await searchNearby({ q: 'KFC', near: HOME, limit: 5 });
    assert.equal(res.places[0].name, 'KFC Ikosi');
    assert.deepEqual(res.places[0].sources, ['Foursquare']);
  } finally { clearInterval(keepAlive); fx.restore(); }
}));

test('samePlace and mergePlaces', () => {
  const a = { name: 'Shoprite Ojota', lat: 6.5820, lng: 3.3830, distanceM: 400 };
  assert.ok(samePlace(a, { name: 'ShopRite', lat: 6.5821, lng: 3.3831 }));
  assert.ok(!samePlace(a, { name: 'Shoprite Ikeja', lat: 6.62, lng: 3.41 }), 'same brand, other branch');
  assert.ok(!samePlace(a, { name: 'Estate Pharmacy', lat: 6.5820, lng: 3.3830 }), 'neighbours are not merged');
  const merged = mergePlaces([
    { source: 'A', places: [a, { name: 'Far Shop', lat: 6.59, lng: 3.38, distanceM: 480 }] },
    { source: 'B', places: [{ name: 'Far Shop', lat: 6.5901, lng: 3.38, distanceM: 610, phone: '1' }, { name: 'Shoprite Ojota', lat: 6.582, lng: 3.383, distanceM: 400 }] },
    { source: 'C', places: [{ name: 'Far Shop', lat: 6.59, lng: 3.3801, distanceM: 600 }] },
  ]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].name, 'Far Shop', 'three providers agreeing outrank a slightly nearer place two know');
  assert.equal(merged[0].phone, '1', 'details are filled from any provider');
});
