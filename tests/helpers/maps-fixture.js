/* ============================================================
   Test fixture for Maps: a small made-up neighbourhood and stub
   versions of the services server-maps.js calls (Photon,
   Nominatim, Overpass, OSRM). Relative /api/maps/* requests are
   answered by the real handleMaps(), so tests run the whole path
   from Assistant tool to server and back, offline.

   Layout (north is up):
       Magodo            D  AA Rescue Driving School (CMD Road)
                         |  Kilimanjaro (fast food) just south of D
       Ketu ----Ikosi Road----+
        |
     Ikorodu Road (runs north)
        |
       Ojota
        |
   O ---+  Laniyan Estate is WEST of Ikorodu Road
   ============================================================ */

import { handleMaps } from '../../server-maps.js';

export const O = [3.3790, 6.5800]; // Laniyan Estate
export const J = [3.3820, 6.5800]; // joins Ikorodu Road
export const K = [3.3820, 6.5980]; // Ketu junction
export const T = [3.3900, 6.5980]; // Ikosi Road meets CMD Road
export const D = [3.3900, 6.6040]; // AA Rescue Driving School

const node = (id, [lon, lat], tags) => ({ type: 'node', id, lon, lat, tags });

export const POIS = [
  node(1, D, { name: 'AA Rescue Driving School', amenity: 'driving_school', 'addr:street': 'CMD Road' }),
  node(2, [3.3905, 6.6030], { name: 'Kilimanjaro', amenity: 'fast_food', brand: 'Kilimanjaro', 'brand:wikidata': 'Q1', opening_hours: 'Mo-Su 08:00-22:00' }),
  node(3, [3.3902, 6.6043], { name: 'Mama Put Canteen', amenity: 'restaurant' }),
  node(4, [3.3895, 6.6052], { name: 'Zenith Bank', amenity: 'bank', brand: 'Zenith Bank', 'brand:wikidata': 'Q2' }),
  node(10, [3.3830, 6.5820], { name: 'Shoprite Ojota', shop: 'supermarket', brand: 'Shoprite', 'addr:street': 'Ikorodu Road', 'addr:city': 'Lagos' }),
  node(11, [3.4100, 6.6200], { name: 'Shoprite Ikeja', shop: 'supermarket', brand: 'Shoprite', 'addr:city': 'Lagos' }),
  node(12, [3.3810, 6.5790], { name: 'Estate Pharmacy', amenity: 'pharmacy', phone: '+234 800 000 0000' }),
  node(13, [3.3900, 6.5900], { name: 'HealthPlus', amenity: 'pharmacy' }),
  node(14, [3.3840, 6.5870], { name: 'Total Ojota', amenity: 'fuel', brand: 'TotalEnergies' }),
  node(15, [3.3700, 6.5750], { name: 'Mobil Estate Road', amenity: 'fuel', brand: 'Mobil' }),
  node(16, [3.3825, 6.5990], { name: 'Ketu Mall', shop: 'mall' }),
  node(17, [3.3960, 6.5930], { name: 'KFC Ikosi', amenity: 'fast_food', brand: 'KFC' }),
];

const PHOTON_INDEX = [
  { name: 'Laniyan Estate', at: O, osm_value: 'residential', district: 'Ojota', city: 'Lagos', state: 'Lagos State', country: 'Nigeria', countrycode: 'NG' },
  { name: 'CMD Road', at: [3.3900, 6.6020], osm_value: 'secondary', district: 'Magodo', city: 'Lagos', state: 'Lagos State', country: 'Nigeria', countrycode: 'NG' },
  { name: 'Ketu', at: [3.3850, 6.5985], osm_value: 'suburb', city: 'Lagos', state: 'Lagos State', country: 'Nigeria', countrycode: 'NG' },
  { name: 'Ojota', at: [3.3850, 6.5860], osm_value: 'suburb', city: 'Lagos', state: 'Lagos State', country: 'Nigeria', countrycode: 'NG' },
];

const CORRIDOR = [
  node(100, [3.3823, 6.5850], { highway: 'bus_stop', name: 'Ojota' }),
  node(101, [3.3817, 6.5852], { highway: 'bus_stop', name: 'Ojota' }),
  node(102, [3.3823, 6.5920], { highway: 'bus_stop', name: 'New Garage' }),
  node(103, [3.3823, 6.5975], { highway: 'bus_stop', name: 'Ketu' }),
  node(104, [3.3860, 6.5982], { highway: 'bus_stop', name: 'Ikosi Junction' }),
  node(110, [3.3850, 6.5860], { place: 'suburb', name: 'Ojota' }),
  node(111, [3.3850, 6.5985], { place: 'suburb', name: 'Ketu' }),
  node(112, [3.3920, 6.6050], { place: 'neighbourhood', name: 'Magodo' }),
  node(120, [3.3820, 6.5980], { highway: 'traffic_signals', name: 'Ketu Junction' }),
];

const O_LINES = [{ type: 'relation', id: 900, tags: { type: 'route', route: 'bus', ref: '12', name: 'Ojota - Ketu' } }];

// OSRM route for O -> D following the roads in the layout above.
export const ROUTE = {
  code: 'Ok',
  waypoints: [{ location: O, distance: 4 }, { location: D, distance: 2 }],
  routes: [{
    distance: 3890,
    duration: 540,
    geometry: { type: 'LineString', coordinates: [O, J, [3.3820, 6.5900], K, T, D] },
    legs: [{
      steps: [
        { name: 'Laniyan Close', distance: 330, duration: 60, maneuver: { type: 'depart', bearing_after: 90, location: O } },
        { name: 'Ikorodu Road', ref: 'A1', distance: 2000, duration: 260, maneuver: { type: 'turn', modifier: 'left', location: J } },
        { name: 'Ikosi Road', distance: 890, duration: 130, maneuver: { type: 'turn', modifier: 'right', location: K } },
        { name: 'CMD Road', distance: 670, duration: 90, maneuver: { type: 'turn', modifier: 'left', location: T } },
        { name: 'CMD Road', distance: 0, duration: 0, maneuver: { type: 'arrive', location: D } },
      ],
    }],
  }],
};

const words = (s) => String(s).toLowerCase().split(/[^a-z0-9']+/).filter(w => w.length > 2);

function photon(url) {
  const q = url.searchParams.get('q');
  const qw = words(q);
  const hits = PHOTON_INDEX
    .map(p => ({ p, score: words(p.name).filter(w => qw.includes(w)).length }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ p }) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p.at }, properties: { ...p, at: undefined } }));
  return { type: 'FeatureCollection', features: hits };
}

function reverse(url) {
  const lat = Number(url.searchParams.get('lat'));
  const lon = Number(url.searchParams.get('lon'));
  return { lat, lon, name: '', display_name: 'Ojota, Lagos, Nigeria', type: 'road', address: { suburb: 'Ojota', city: 'Lagos', country: 'Nigeria', country_code: 'ng' } };
}

const dist = (a, b) => Math.hypot((a[0] - b[0]) * 110_500, (a[1] - b[1]) * 110_600);

function overpass(query) {
  if (query.includes('make section')) {
    return { elements: [...CORRIDOR, { type: 'section', id: 1, tags: { name: 'destination' } }, ...POIS.filter(p => dist([p.lon, p.lat], D) < 450), { type: 'section', id: 2, tags: { name: 'origin_lines' } }, ...O_LINES, { type: 'section', id: 3, tags: { name: 'destination_lines' } }] };
  }
  const around = query.match(/around:(\d+),(-?[\d.]+),(-?[\d.]+)/);
  const [r, lat, lon] = around ? around.slice(1).map(Number) : [1e9, 0, 0];
  const nameRe = query.match(/\[~"\^\(name\|brand\|operator\|name:en\)\$"~"([^"]+)",i\]/)?.[1];
  const tagFilters = [...query.matchAll(/\["(\w+)"(=|~)"([^"]+)"\]/g)].map(m => ({ k: m[1], re: m[2] === '=' ? new RegExp(`^${m[3]}$`) : new RegExp(m[3]) }));
  const els = POIS.filter(p => dist([p.lon, p.lat], [lon, lat]) <= r).filter(p => {
    const byName = nameRe && ['name', 'brand'].some(k => p.tags[k] && new RegExp(nameRe, 'i').test(p.tags[k]));
    const byTag = tagFilters.length && tagFilters.some(f => p.tags[f.k] && f.re.test(p.tags[f.k]));
    return byName || byTag;
  });
  return { elements: els };
}

function osrm(url) {
  const coords = decodeURIComponent(url.pathname.split('/').pop()).split(';').map(s => s.split(',').map(Number));
  const [a, b] = [coords[0], coords[coords.length - 1]];
  if (dist(a, O) < 60 && dist(b, D) < 60) return ROUTE;
  const d = dist(a, b);
  return {
    code: 'Ok',
    waypoints: coords.map(location => ({ location, distance: 0 })),
    routes: [{
      distance: d, duration: d / 10,
      geometry: { type: 'LineString', coordinates: coords },
      legs: [{ steps: [
        { name: 'Test Street', distance: d, duration: d / 10, maneuver: { type: 'depart', bearing_after: 0, location: a } },
        { name: 'Test Street', distance: 0, duration: 0, maneuver: { type: 'arrive', location: b } },
      ] }],
    }],
  };
}

async function callHandler(url, init = {}) {
  const request = {
    method: init.method || 'GET',
    url: url.pathname + url.search,
    headers: { host: 'localhost' },
    async *[Symbol.asyncIterator]() { if (init.body) yield init.body; },
  };
  let status = 200;
  let body = '';
  const response = { writeHead(s) { status = s; }, setHeader() {}, end(b) { body = b; } };
  await handleMaps(request, response, url);
  return new Response(body, { status, headers: { 'Content-Type': 'application/json' } });
}

/** Replaces fetch with the fixture. Returns a restore function and the list of upstream calls. */
export function installMapsFixture({ down = false, overpassDown = [] } = {}) {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const raw = typeof input === 'string' ? input : input.url;
    const url = new URL(raw, 'http://localhost');
    if (url.hostname === 'localhost' && url.pathname.startsWith('/api/maps/')) return callHandler(url, init);
    calls.push(url.hostname);
    if (down) throw new TypeError('fetch failed');
    const json = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url.hostname === 'photon.komoot.io') return json(url.pathname.startsWith('/reverse') ? { features: [] } : photon(url));
    if (url.hostname === 'nominatim.openstreetmap.org') return json(url.pathname.startsWith('/reverse') ? reverse(url) : []);
    if (url.pathname.endsWith('/api/interpreter') && (overpassDown === 'all' || overpassDown.includes(url.hostname))) {
      // A busy mirror that never answers until the caller gives up.
      return new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
    }
    if (url.pathname.endsWith('/api/interpreter')) return json(overpass(decodeURIComponent(String(init.body || '').replace(/^data=/, ''))));
    if (url.pathname.includes('/route/v1/')) return json(osrm(url));
    throw new TypeError(`fixture has no answer for ${url.href}`);
  };
  return { restore: () => { globalThis.fetch = real; }, calls };
}

/** Minimal DOM so renderers can build cards under Node. */
export class FakeElement {
  constructor(tag) { this.tagName = String(tag).toUpperCase(); this.children = []; this.style = {}; this.attrs = {}; this.className = ''; this._text = ''; this.listeners = {}; }
  set textContent(v) { this._text = String(v); this.children = []; }
  get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
  appendChild(c) { this.children.push(c); return c; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }
  get classList() { return { add: (c) => { this.className += ` ${c}`; } }; }
  find(pred) { if (pred(this)) return this; for (const c of this.children) { const f = c.find(pred); if (f) return f; } return null; }
}
