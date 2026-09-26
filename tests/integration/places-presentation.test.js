/* ============================================================
   TOOLBOX — Maps and places, end to end (offline fixture)

   Assistant tool -> /api/maps/* (server-maps.js) -> stubbed
   OpenStreetMap services (tests/helpers/maps-fixture.js).
   Checks that places are real results sorted nearest first,
   that nothing is invented when a search finds nothing or a
   service is down, that local-transport directions carry the
   facts the model needs (roads in order, stops, which side to
   board, landmarks), and that the map card renders cleanly.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { executeAssistantTool } from '../../js/lib/assistant-tools.js';
import { MapResultRenderer } from '../../js/lib/assistant-result-renderer.js';
import { sanitizeUserFacingText } from '../../js/utils.js';
import { installMapsFixture, FakeElement, O } from '../helpers/maps-fixture.js';

globalThis.document ??= { createElement: (tag) => new FakeElement(tag) };

const at = (p) => ({ taskState: { userLocation: { lng: p[0], lat: p[1] } } });
const HOME = [3.3800, 6.5805]; // beside Laniyan Estate

test('nearest Shoprite: the named brand, nearest first, real distances', async () => {
  const fx = installMapsFixture();
  try {
    const res = await executeAssistantTool('search_places_nearby', { query: 'nearest Shoprite' }, at(HOME));
    assert.equal(res.status, 'success');
    assert.equal(res.renderer, 'map-view');
    assert.deepEqual(res.places.map(p => p.name), ['Shoprite Ojota', 'Shoprite Ikeja']);
    assert.ok(res.places[0].distanceKm < res.places[1].distanceKm);
    assert.ok(!res.places.some(p => /driving/i.test(p.name)), 'no unrelated places');
    assert.match(res.title, /Shoprite near you/);
    assert.ok(fx.calls.includes('overpass-api.de'));
  } finally { fx.restore(); }
});

test('category search: pharmacy finds pharmacies only, nearest first', async () => {
  const fx = installMapsFixture();
  try {
    const res = await executeAssistantTool('search_places_nearby', { category: 'pharmacy' }, at(HOME));
    assert.equal(res.status, 'success');
    assert.deepEqual(res.places.map(p => p.name), ['Estate Pharmacy', 'HealthPlus']);
    assert.equal(res.places[0].phone, '+234 800 000 0000');
    const gas = await executeAssistantTool('search_places_nearby', { query: 'nearest gas station' }, at(HOME));
    assert.deepEqual(gas.places.map(p => p.category), ['Fuel', 'Fuel']);
  } finally { fx.restore(); }
});

test('search around a named area uses that area, not the person', async () => {
  const fx = installMapsFixture();
  try {
    const res = await executeAssistantTool('search_places_nearby', { query: 'KFC', location: 'Ketu' }, at([0, 0]));
    assert.equal(res.status, 'success');
    assert.equal(res.places[0].name, 'KFC Ikosi');
    assert.match(res.title, /near Ketu/);
  } finally { fx.restore(); }
});

test('nothing found: says so, never invents a place', async () => {
  const fx = installMapsFixture();
  try {
    const res = await executeAssistantTool('search_places_nearby', { query: 'Ebeano Supermarket' }, at(HOME));
    assert.equal(res.status, 'not_found');
    assert.ok(!res.places);
    assert.match(res.message, /do not invent/);
  } finally { fx.restore(); }
});

test('service down or no location: an honest error, no made-up places', async () => {
  const fx = installMapsFixture({ down: true });
  try {
    // A query no earlier test ran, so the server cache cannot answer it.
    const res = await executeAssistantTool('search_places_nearby', { query: 'Chicken Republic' }, at(HOME));
    assert.equal(res.success, false);
    assert.match(res.message, /do not guess/);
    assert.ok(!res.places?.length);
    const noLoc = await executeAssistantTool('search_places_nearby', { query: 'Shoprite' }, { taskState: {} });
    assert.equal(noLoc.status, 'needs_location');
  } finally { fx.restore(); }
});

test('local transport: Laniyan Estate to AA Rescue driving school at CMD Road', async () => {
  const fx = installMapsFixture();
  try {
    const res = await executeAssistantTool('get_directions', {
      from: 'Laniyan Estate',
      to: 'AA rescue driving school at CMD road',
      mode: 'transit',
    }, at(HOME));
    assert.equal(res.status, 'success', res.message);

    // The business was found by name around the street given, not swapped for the street.
    assert.equal(res.to.name, 'AA Rescue Driving School');
    assert.equal(res.from.name, 'Laniyan Estate');
    assert.equal(res.country, 'Nigeria');
    assert.equal(res.drivingSide, 'right');

    const c = res.corridor;
    assert.deepEqual(c.roadsInOrder.map(s => s.road), ['Laniyan Close', 'Ikorodu Road', 'Ikosi Road', 'CMD Road']);
    const main = c.roadsInOrder[1];
    assert.deepEqual(main.stops, ['Ojota', 'New Garage', 'Ketu'], 'stops in travel order, one per name');
    assert.equal(main.endsNear, 'Ketu');
    assert.ok(c.areasInOrder.indexOf('Ojota') < c.areasInOrder.indexOf('Ketu'));

    // The estate is west of a northbound road in a drive-on-the-right country: cross to board.
    assert.equal(c.boarding.road, 'Ikorodu Road');
    assert.equal(c.boarding.heading, 'north');
    assert.equal(c.boarding.originSide, 'left');
    assert.equal(c.boarding.crossToBoard, true);

    // A well-known landmark near the destination ranks first.
    assert.equal(c.destinationLandmarks[0].name, 'Kilimanjaro');
    assert.ok(c.destinationLandmarks.some(l => l.name === 'Zenith Bank'));
    assert.deepEqual(c.transitLines.nearOrigin, ['Bus 12 Ojota - Ketu']);
    assert.deepEqual(c.transitLines.direct, []);

    assert.match(res.guidance, /Nigeria/);
    assert.match(res.guidance, /cross to the other side/);
    assert.equal(res.steps, undefined, 'transit sends roads, not turn-by-turn');
    assert.ok(res.mapLayers.route.length > 2);
    assert.ok(res.mapLayers.stops.some(s => s.name === 'Ketu'));
  } finally { fx.restore(); }
});

test('driving directions from the person: turn list, no corridor unless asked', async () => {
  const fx = installMapsFixture();
  try {
    const res = await executeAssistantTool('get_directions', { to: 'AA Rescue Driving School, CMD Road', mode: 'driving' }, at(O));
    assert.equal(res.status, 'success');
    assert.equal(res.from.name, 'Your location');
    assert.deepEqual(res.steps.slice(0, 2), ['Head east on Laniyan Close (330 m)', 'Turn left onto Ikorodu Road (2.0 km)']);
    assert.equal(res.corridor, undefined);
    assert.equal(res.minutes, 9);
    assert.equal(res.distanceKm, 3.9);
  } finally { fx.restore(); }
});

test('the model never receives route geometry', async () => {
  const fx = installMapsFixture();
  try {
    const { compactForModel } = await import('../../js/lib/ai-provider.js');
    const res = await executeAssistantTool('get_directions', { from: 'Laniyan Estate', to: 'AA Rescue Driving School at CMD Road', mode: 'transit' }, at(HOME));
    const sent = JSON.stringify(compactForModel(res));
    assert.ok(!sent.includes('mapLayers') && !sent.includes('"directions"'));
    assert.ok(sent.length < 5000, `transit result is ${sent.length} characters`);
  } finally { fx.restore(); }
});

test('render_map looks up names and draws the road route between them', async () => {
  const fx = installMapsFixture();
  try {
    const res = await executeAssistantTool('render_map', {
      title: 'Estate to school',
      places: [{ name: 'Laniyan Estate' }, { name: 'Ketu' }, { name: 'Fixed point', lat: 6.6, lng: 3.39 }, { name: 'Atlantis' }],
      route_mode: 'driving',
    }, at(HOME));
    assert.equal(res.status, 'success');
    assert.deepEqual(res.places.map(p => p.name), ['Laniyan Estate', 'Ketu', 'Fixed point']);
    assert.deepEqual(res.notFound, ['Atlantis']);
    assert.ok(res.mapLayers.route.length >= 2);
    const empty = await executeAssistantTool('render_map', { title: 'Nothing' }, at(HOME));
    assert.equal(empty.success, false, 'no places means no invented markers');
  } finally { fx.restore(); }
});

test('map card: names, one address each, distances per place, no entities or emoji', () => {
  const container = new FakeElement('div');
  const card = MapResultRenderer.render({
    type: 'map-view',
    renderer: 'map-view',
    title: 'Prince Ebeano Supermarket near Lekki, Lagos',
    places: [
      { name: 'Prince Ebeano Supermarket Lekki', address: '9, Admiralty Way, Lekki Phase I, Lagos, Nigeria', description: '9, Admiralty Way, Lekki Phase I, Lagos, Nigeria', distanceKm: 3.2, lat: 6.447, lng: 3.47 },
      { name: 'Prince Ebeano Supermarket Chevron', address: 'Chevron Drive, Lekki-Epe Expressway, Lagos', distanceKm: 7.8, lat: 6.435, lng: 3.52 },
    ],
  }, container);
  const text = card.textContent;
  assert.ok(text.includes('Prince Ebeano Supermarket Lekki'));
  assert.equal((text.match(/9, Admiralty Way/g) || []).length, 1);
  assert.ok(text.includes('3.2 km') && text.includes('7.8 km'));
  const head = card.children[0];
  assert.ok(!head.textContent.includes('3.2 km'), 'no distance in the header');
  assert.ok(text.includes('Open in Maps'));
  for (const bad of ['&#x20;', '&amp;', '&nbsp;', '📍', '📞', '"status"']) assert.ok(!text.includes(bad), bad);
});

test('map card: directions show mode, distance and steps', async () => {
  const fx = installMapsFixture();
  try {
    const res = await executeAssistantTool('get_directions', { to: 'AA Rescue Driving School, CMD Road', mode: 'driving' }, at(O));
    const card = MapResultRenderer.render({ data: res }, new FakeElement('div'));
    const text = card.textContent;
    assert.ok(text.includes('Drive · 3.9 km · 9 min'));
    assert.ok(text.includes('Turn right onto Ikosi Road'));
  } finally { fx.restore(); }
});

test('sanitization removes literal entities from assistant text', () => {
  const clean = sanitizeUserFacingText('**Nearest Ebeano**&#x20;8.5 km\n1. Prince&#x20;Ebeano&nbsp;Supermarket&amp;#x20;Lekki', { preserveWhitespace: false });
  assert.ok(!clean.includes('&#x20;') && !clean.includes('&nbsp;') && !clean.includes('&amp;#x20;'));
  assert.ok(clean.includes('Prince Ebeano Supermarket Lekki'));
});
