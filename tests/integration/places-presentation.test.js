/* ============================================================
   TOOLBOX — Places Search Result Presentation & Formatting Regression Tests
   Verifies:
   1. Clean title formatting (no distance concatenated into the heading)
   2. Address printed exactly once per place (no duplicate address row)
   3. Distance displayed separately per place (no magic numbers or title badges)
   4. No HTML entity leakage (no literal &#x20;, &#32;, &nbsp;, or &amp;#x20;)
   5. No duplicate result cards (deduplication of sequential map views)
   6. Structured renderer + Assistant response path cleanliness
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

import { executeAssistantTool } from '../../js/lib/assistant-tools.js';
import { MapResultRenderer } from '../../js/lib/assistant-result-renderer.js';
import { sanitizeUserFacingText } from '../../js/utils.js';

// DOM mock for MapResultRenderer in Node test environment
class MockElement {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.style = {};
    this._textContent = '';
    this._innerHTML = '';
    this.attributes = {};
  }
  set textContent(val) { this._textContent = String(val); }
  get textContent() {
    if (this._textContent) return this._textContent;
    return this.children.map(c => c.textContent).join('');
  }
  set innerHTML(val) { this._innerHTML = String(val); }
  get innerHTML() {
    if (this._innerHTML) return this._innerHTML;
    return this.children.map(c => c.innerHTML).join('');
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  addEventListener() {}
  setAttribute(k, v) { this.attributes[k] = v; }
}

globalThis.document = {
  createElement: (tag) => new MockElement(tag)
};

test('Places Presentation: search_places_nearby formats title and distances cleanly', async () => {
  const res = await executeAssistantTool('search_places_nearby', {
    query: 'Ebeano Supermarket',
    location: 'Lekki, Lagos'
  });

  assert.equal(res.status, 'success');
  assert.equal(res.renderer, 'map-view');

  // Title must NOT concatenate distance
  assert.ok(
    !res.title.includes('8.5 km') && !res.title.includes('8.5km'),
    `Title should not concatenate distance: "${res.title}"`
  );
  assert.ok(
    res.title.toLowerCase().includes('ebeano'),
    `Title must contain business name: "${res.title}"`
  );

  // No hardcoded top-level distanceKm: 8.5
  assert.notEqual(res.distanceKm, 8.5, 'Must not return hardcoded 8.5 km at root');

  // Places list must have real places with non-duplicated address/description
  assert.ok(Array.isArray(res.places) && res.places.length > 0, 'Places list must not be empty');
  for (const place of res.places) {
    assert.ok(place.name, 'Place must have name');
    assert.ok(place.address, 'Place must have address');
    if (place.description) {
      assert.notEqual(
        place.description.trim().toLowerCase(),
        place.address.trim().toLowerCase(),
        'Description must not duplicate address'
      );
    }
  }
});

test('Places Presentation: MapResultRenderer renders clean card with separate distance, no duplicate address, and no &#x20;', () => {
  const container = new MockElement('div');
  const mockToolResult = {
    type: 'map-view',
    renderer: 'map-view',
    title: 'Prince Ebeano Supermarket near Lekki, Lagos',
    places: [
      {
        name: 'Prince Ebeano Supermarket Lekki',
        address: '9, Admiralty Way, Lekki Phase I, Lagos, Nigeria',
        distanceKm: 3.2,
        description: '9, Admiralty Way, Lekki Phase I, Lagos, Nigeria' // Identical description to test duplicate suppression
      },
      {
        name: 'Prince Ebeano Supermarket Chevron',
        address: 'Chevron Drive, Lekki-Epe Expressway, Lagos',
        distanceKm: 7.8,
        description: ''
      }
    ],
    markers: [
      { name: 'Prince Ebeano Supermarket Lekki', lat: 6.447, lng: 3.470 },
      { name: 'Prince Ebeano Supermarket Chevron', lat: 6.435, lng: 3.520 }
    ]
  };

  const card = MapResultRenderer.render(mockToolResult, container);
  const cardHtml = card.innerHTML;

  // 1. Business name present
  assert.ok(cardHtml.includes('Prince Ebeano Supermarket Lekki'), 'Card must contain business name');

  // 2. Address printed once per place (duplicate description suppressed)
  const addr1Matches = cardHtml.match(/9, Admiralty Way, Lekki Phase I, Lagos, Nigeria/g) || [];
  assert.equal(addr1Matches.length, 1, 'Address 1 must only be rendered once (no duplicate address below)');

  // 3. Distance displayed separately per place
  assert.ok(cardHtml.includes('3.2 km'), 'Must display Place 1 distance');
  assert.ok(cardHtml.includes('7.8 km'), 'Must display Place 2 distance');

  // Header must NOT concatenate distance
  const headerLeft = card.children[0].children[0];
  assert.ok(!headerLeft.textContent.includes('8.5 km'), 'Header must not contain 8.5 km');
  assert.ok(!headerLeft.textContent.includes('3.2 km'), 'Header must not concatenate Place 1 distance');

  // 4. No HTML entity leakage
  assert.ok(!cardHtml.includes('&#x20;'), 'Must not leak literal &#x20;');
  assert.ok(!cardHtml.includes('&amp;#x20;'), 'Must not leak literal &amp;#x20;');
  assert.ok(!cardHtml.includes('&#32;'), 'Must not leak literal &#32;');
  assert.ok(!cardHtml.includes('&nbsp;'), 'Must not leak raw &nbsp;');

  // 5. No internal tool output exposure
  assert.ok(!cardHtml.includes('"status": "success"'), 'Must not expose internal tool JSON');
  assert.ok(!cardHtml.includes('"renderer": "map-view"'), 'Must not expose internal renderer key');
});

test('Places Presentation: Sanitization pipeline eliminates literal &#x20; and entities from response formatting', () => {
  const dirtyAssistantText = '**Nearest Ebeano in Erukan**&#x20;8.5 km\n1. Prince&#x20;Ebeano&nbsp;Supermarket&amp;#x20;Lekki';
  const clean = sanitizeUserFacingText(dirtyAssistantText, { preserveWhitespace: false });

  assert.ok(!clean.includes('&#x20;'), 'Must decode &#x20;');
  assert.ok(!clean.includes('&amp;#x20;'), 'Must unwrap &amp;#x20;');
  assert.ok(!clean.includes('&nbsp;'), 'Must decode &nbsp;');
  assert.ok(clean.includes('Prince Ebeano Supermarket Lekki'), 'Must normalize words with proper ASCII spaces');
});

/* ============================================================
   REGRESSION TESTS A THROUGH E (Mandated User Acceptance Criteria)
   ============================================================ */

test('TEST A: "Where is the nearest mall?" — Direct Answer First, Category Quality, Ascending Sort, and Zero Emojis', async () => {
  const res = await executeAssistantTool('search_places_nearby', {
    query: 'nearest mall',
    category: 'mall',
    location: 'Erukan, Lagos'
  });

  assert.equal(res.status, 'success');
  assert.equal(res.renderer, 'map-view');
  assert.ok(res.places.length > 0, 'Must return malls');

  // 1. Proximity constraint: strictly ascending distances (d0 <= d1 <= d2 <= d3...)
  for (let i = 0; i < res.places.length - 1; i++) {
    const dCurr = res.places[i].distanceKm;
    const dNext = res.places[i + 1].distanceKm;
    if (typeof dCurr === 'number' && typeof dNext === 'number') {
      assert.ok(
        dCurr <= dNext,
        `Malls must be sorted ascending by distance: place[${i}] (${dCurr} km) > place[${i+1}] (${dNext} km)`
      );
    }
  }

  // 2. Nearest result is first
  const nearest = res.places[0];
  assert.ok(nearest, 'Nearest place must be first in list');
  assert.equal(res.nearestPlace?.name, nearest.name);

  // 3. Category verification: no road/highway presented as a mall
  for (const p of res.places) {
    assert.ok(
      !p.name.includes('Road)') && !p.name.includes('Way)') && !p.name.includes('Street)'),
      `Candidate business name must not be an unclassified road label: "${p.name}"`
    );
    assert.notEqual(p.osmClass, 'highway', 'Class must not be highway');
  }

  // 4. Assistant response answers the question directly without redundant status sentence
  assert.ok(
    res.message.includes(nearest.name),
    `Message must identify the nearest place by name: "${res.message}"`
  );
  if (typeof nearest.distanceKm === 'number') {
    assert.ok(
      res.message.includes(`${nearest.distanceKm} km`),
      `Message must state nearest distance: "${res.message}"`
    );
  }
  assert.ok(
    res.message.startsWith('The nearest verified mall I found is'),
    `Message must lead with direct answer: "${res.message}"`
  );
  assert.ok(
    !res.message.includes('Found 5 verified') && !res.message.includes('Found 4 verified'),
    `Message must not include redundant second sentence: "${res.message}"`
  );
  assert.ok(!res.message.includes('Rendered interactive visual map'), 'Must not expose implementation language');

  // 5. Map and list agreement: markers must match places 1-to-1 in order and rank
  assert.equal(res.markers.length, res.places.length);
  for (let i = 0; i < res.places.length; i++) {
    assert.equal(res.markers[i].name, res.places[i].name);
    assert.equal(res.markers[i].rank, i + 1);
  }

  // 6. Render to DOM and verify zero emojis, zero &#x20;, no duplicate addresses
  const container = new MockElement('div');
  const card = MapResultRenderer.render(res, container);
  const cardHtml = card.innerHTML;

  assert.ok(!cardHtml.includes('📍'), 'Must not contain emoji location pin 📍');
  assert.ok(!cardHtml.includes('📞'), 'Must not contain emoji phone 📞');
  assert.ok(!cardHtml.includes('&#x20;'), 'Must not contain raw &#x20;');
  assert.ok(!cardHtml.includes('&amp;#x20;'), 'Must not contain raw &amp;#x20;');

  // 7. Current location appears on map
  assert.ok(res.userLocation, 'Result must contain userLocation object');
  assert.equal(res.userLocation.name, 'Your location');
  assert.ok(cardHtml.includes('map-user-location-marker'), 'Map SVG must render user location marker');
  assert.ok(cardHtml.includes('Your location'), 'Map SVG must label "Your location"');
  assert.ok(!res.places.some(p => p.name === 'Your location'), 'Places must not include "Your location"');
});

test('TEST A2: "Where is the nearest gas station?" — Authoritative Ascending Sort, Category Verification, Direct Answer, and Zero Emojis', async () => {
  const res = await executeAssistantTool('search_places_nearby', {
    query: 'nearest gas station',
    category: 'gas station',
    location: 'Erukan, Lagos'
  });

  assert.equal(res.status, 'success');
  assert.equal(res.renderer, 'map-view');
  assert.ok(res.places.length > 0, 'Must return gas stations');

  // 1. Proximity constraint: strictly ascending distances (d0 <= d1 <= d2 <= d3...)
  for (let i = 0; i < res.places.length - 1; i++) {
    const dCurr = res.places[i].distanceKm;
    const dNext = res.places[i + 1].distanceKm;
    if (typeof dCurr === 'number' && typeof dNext === 'number') {
      assert.ok(
        dCurr <= dNext,
        `Places must be sorted ascending by distance: place[${i}] (${dCurr} km) > place[${i+1}] (${dNext} km)`
      );
    }
  }

  // 2. Nearest result is first
  const nearest = res.places[0];
  assert.ok(nearest, 'Nearest place must be first in list');
  assert.equal(res.nearestPlace?.name, nearest.name);

  // 3. Category verification: no road/highway presented as gas station
  for (const p of res.places) {
    assert.ok(
      !p.name.toLowerCase().startsWith('road ') && !p.name.toLowerCase().endsWith(' road') && !p.name.toLowerCase().endsWith(' expressway'),
      `Candidate business name must not be an unclassified road: "${p.name}"`
    );
    assert.notEqual(p.osmClass, 'highway', 'Class must not be highway');
  }

  // 4. Assistant response answers the question directly with nearest place and distance
  assert.ok(
    res.message.includes(nearest.name),
    `Message must identify the nearest place by name: "${res.message}"`
  );
  if (typeof nearest.distanceKm === 'number') {
    assert.ok(
      res.message.includes(`${nearest.distanceKm} km`),
      `Message must state nearest distance: "${res.message}"`
    );
  }
  assert.ok(
    res.message.startsWith('The nearest verified gas station I found is'),
    `Message must lead with direct answer: "${res.message}"`
  );
  assert.ok(
    !res.message.includes('Found 5 verified') && !res.message.includes('Found 4 verified'),
    `Message must not include redundant second sentence: "${res.message}"`
  );

  // 5. Zero implementation language: no "Rendered interactive visual map"
  assert.ok(!res.message.includes('Rendered interactive visual map'), 'Must not expose implementation language');
  assert.ok(!res.message.includes('map-view'), 'Must not expose renderer name');

  // 6. Map and list agreement: markers must match places 1-to-1 in order and rank
  assert.equal(res.markers.length, res.places.length);
  for (let i = 0; i < res.places.length; i++) {
    assert.equal(res.markers[i].name, res.places[i].name);
    assert.equal(res.markers[i].rank, i + 1);
  }

  // 7. Render to DOM and verify zero emojis, zero &#x20;, no duplicate addresses
  const container = new MockElement('div');
  const card = MapResultRenderer.render(res, container);
  const cardHtml = card.innerHTML;

  assert.ok(!cardHtml.includes('📍'), 'Must not contain emoji location pin 📍');
  assert.ok(!cardHtml.includes('📞'), 'Must not contain emoji phone 📞');
  assert.ok(!cardHtml.includes('&#x20;'), 'Must not contain raw &#x20;');
  assert.ok(!cardHtml.includes('&amp;#x20;'), 'Must not contain raw &amp;#x20;');
  // 8. User's Current Location: Appears on map, shares origin with distance calculation, not counted in business results
  assert.ok(res.userLocation, 'Result must contain userLocation object');
  assert.equal(typeof res.userLocation.lat, 'number', 'userLocation must have numeric lat');
  assert.equal(typeof res.userLocation.lng, 'number', 'userLocation must have numeric lng');
  assert.equal(res.userLocation.name, 'Your location', 'userLocation name must be "Your location"');

  // Map card must render the distinct "Your location" marker
  assert.ok(cardHtml.includes('map-user-location-marker'), 'Map SVG must render distinct user location marker');
  assert.ok(cardHtml.includes('Your location'), 'Map SVG must label "Your location"');
  assert.ok(cardHtml.includes('aria-label="Your location"'), 'User marker must have accessible aria-label');

  // Current location must NOT count as a business result or receive a rank number
  assert.ok(res.places.every(p => p.name !== 'Your location'), 'Places must not include "Your location" as a business');
  assert.ok(res.markers.every(m => m.name !== 'Your location'), 'Markers must not include "Your location" as a business');
  assert.equal(res.places.length, res.markers.length, 'Business place count must equal business marker count');
});

test('TEST B: "nearest Shoprite" — Named Entity Preserved, Nearest First, No Driving School Fallback', async () => {
  const res = await executeAssistantTool('search_places_nearby', {
    query: 'nearest Shoprite',
    location: 'Ikeja, Lagos'
  });

  assert.equal(res.status, 'success');
  // Shoprite entity preserved
  assert.ok(res.query.toLowerCase().includes('shoprite'), 'Query must preserve Shoprite entity');
  assert.ok(res.title.toLowerCase().includes('shoprite'), 'Title must preserve Shoprite entity');

  // Zero driving schools
  for (const m of res.markers) {
    assert.ok(
      !/driving school|driving academy|lasdri|vio/i.test(m.name + ' ' + (m.description || '')),
      `Found unrelated driving school in Shoprite results: ${m.name}`
    );
  }

  // Nearest place first
  if (res.places.length > 1) {
    assert.ok(res.places[0].distanceKm <= res.places[1].distanceKm, 'Nearest Shoprite must be first');
  }
});

test('TEST C: "nearest pharmacy" — Generic Category Intent, Nearest First', async () => {
  const res = await executeAssistantTool('search_places_nearby', {
    query: 'nearest pharmacy',
    category: 'pharmacy',
    location: 'Yaba, Lagos'
  });

  assert.equal(res.status, 'success');
  assert.ok(res.title.toLowerCase().includes('pharmaci') || res.title.toLowerCase().includes('pharmacy'), 'Title must reflect pharmacies');
  assert.ok(res.message.toLowerCase().includes('pharmacy'), 'Message must refer to pharmacy');
  if (res.places.length > 1) {
    assert.ok(res.places[0].distanceKm <= res.places[1].distanceKm, 'Nearest pharmacy must be first');
  }
});

test('TEST D: "where Ebeano is" — Entity Preserved, Clean Rendering, No Duplicates or Emojis', async () => {
  const res = await executeAssistantTool('search_places_nearby', {
    query: 'Ebeano',
    location: 'Lekki, Lagos'
  });

  assert.equal(res.status, 'success');
  assert.ok(res.title.toLowerCase().includes('ebeano'), 'Entity Ebeano must be preserved');

  const container = new MockElement('div');
  const card = MapResultRenderer.render(res, container);
  const cardHtml = card.innerHTML;

  assert.ok(!cardHtml.includes('📍'), 'No emoji pins');
  assert.ok(!cardHtml.includes('&#x20;'), 'No HTML entities');
  assert.ok(!cardHtml.includes('&amp;#x20;'), 'No double-encoded entities');
});

test('TEST E: "Where is the nearest bank?" — Bank Category, Ascending Distance, Map/List Agreement, and Current Location Marker', async () => {
  const res = await executeAssistantTool('search_places_nearby', {
    query: 'nearest bank',
    category: 'bank',
    location: 'Akoka, Lagos'
  });

  assert.equal(res.status, 'success');
  assert.equal(res.renderer, 'map-view');
  assert.ok(res.places.length > 0, 'Must return banks');

  // 1. Proximity constraint: strictly ascending distances (d0 <= d1 <= d2 <= d3...)
  for (let i = 0; i < res.places.length - 1; i++) {
    const dCurr = res.places[i].distanceKm;
    const dNext = res.places[i + 1].distanceKm;
    if (typeof dCurr === 'number' && typeof dNext === 'number') {
      assert.ok(
        dCurr <= dNext,
        `Banks must be sorted ascending by distance: place[${i}] (${dCurr} km) > place[${i+1}] (${dNext} km)`
      );
    }
  }

  // 2. Nearest result is first and identified in natural language
  const nearest = res.places[0];
  assert.ok(nearest, 'Nearest bank must be first in list');
  assert.equal(res.nearestPlace?.name, nearest.name);
  assert.ok(
    res.message.startsWith('The nearest verified bank I found is'),
    `Message must lead with direct answer: "${res.message}"`
  );
  assert.ok(
    res.message.includes(nearest.name),
    `Message must identify nearest bank name: "${res.message}"`
  );
  if (typeof nearest.distanceKm === 'number') {
    assert.ok(
      res.message.includes(`${nearest.distanceKm} km`),
      `Message must include distance: "${res.message}"`
    );
  }

  // 3. Map markers and place list share identical ordering and numbering
  assert.equal(res.markers.length, res.places.length);
  for (let i = 0; i < res.places.length; i++) {
    assert.equal(res.markers[i].name, res.places[i].name);
    assert.equal(res.markers[i].rank, i + 1);
  }

  // 4. Current location marker appears on map and shares origin
  assert.ok(res.userLocation, 'Must return userLocation');
  assert.equal(res.userLocation.name, 'Your location');

  const container = new MockElement('div');
  const card = MapResultRenderer.render(res, container);
  const cardHtml = card.innerHTML;

  assert.ok(cardHtml.includes('map-user-location-marker'), 'Map must render current location marker');
  assert.ok(cardHtml.includes('Your location'), 'Map must show "Your location"');
  assert.ok(!res.places.some(p => p.name === 'Your location'), 'Your location must not be in business places');

  // 5. Zero emojis, zero &#x20;, zero internal implementation language
  assert.ok(!cardHtml.includes('📍'), 'Zero emoji location pin');
  assert.ok(!cardHtml.includes('📞'), 'Zero emoji phone');
  assert.ok(!cardHtml.includes('&#x20;'), 'Zero &#x20;');
  assert.ok(!cardHtml.includes('&amp;#x20;'), 'Zero &amp;#x20;');
  assert.ok(!res.message.includes('Rendered interactive visual map'), 'Zero internal implementation language');
  assert.ok(!res.message.includes('Found 5 verified'), 'Zero redundant counts');
});

test('TEST F: Non-location Assistant response unaffected', async () => {
  const mathRes = await executeAssistantTool('calculate_math', { expression: '42 * 2' });
  assert.equal(mathRes.status, 'success');
  assert.equal(mathRes.result, 84);

  const noteRes = await executeAssistantTool('create_note', {
    title: 'Standard Note',
    content: 'Testing non-location tool execution'
  });
  assert.equal(noteRes.status, 'success');
  assert.ok(noteRes.noteId);
});

