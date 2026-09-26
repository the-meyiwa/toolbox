/* ============================================================
   TOOLBOX — Maps API (/api/maps/*)

   Free OpenStreetMap services, no API keys:
   - Photon (komoot) and Nominatim for place search and reverse
     geocoding
   - Overpass for points of interest, bus stops, stations, area
     names, junctions and landmarks
   - OSRM (FOSSGIS car, bike and foot profiles) for routes

   /api/maps/directions also studies the corridor a route runs
   through: the roads it uses in order, the stops and area names
   along each road, which side of the road the traveller starts
   on, transit lines that serve both ends, and well-known places
   near the destination. The Assistant composes local-transport
   directions from that; nothing about a place is written here.
   ============================================================ */

import { activeProviders, searchProviders, mergePlaces } from './server-place-providers.js';
import {
  distanceM, bearing, compass, projectOnLine, simplify, lineLength, pointAlong, isLngLat, parseLatLng,
} from './js/lib/maps/geo.js';

const UA = 'Toolbox/1.0 (+https://github.com/the-meyiwa/toolbox)';
const PHOTON = 'https://photon.komoot.io';
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const OSRM = {
  driving: ['https://routing.openstreetmap.de/routed-car', 'https://router.project-osrm.org'],
  cycling: ['https://routing.openstreetmap.de/routed-bike'],
  walking: ['https://routing.openstreetmap.de/routed-foot'],
};
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

// Countries that drive on the left (ISO 3166-1 alpha-2).
const LEFT_HAND_TRAFFIC = new Set('AG AI AU BB BD BM BN BS BT BW CC CK CX CY DM FJ FK GB GD GG GY HK ID IE IM IN JE JM JP KE KI KN KY LC LK LS MO MS MT MU MV MW MY MZ NA NF NP NR NU NZ PG PK PN SB SC SG SH SR SZ TC TH TK TL TO TT TV TZ UG VC VG VI WS ZA ZM ZW'.split(' '));
export const drivingSide = (cc) => (cc ? (LEFT_HAND_TRAFFIC.has(String(cc).toUpperCase()) ? 'left' : 'right') : null);

/* ---------------- fetching, caching, politeness ---------------- */

const cache = new Map();
const CACHE_MAX = 400;

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) { cache.delete(key); return undefined; }
  return hit.value;
}

function cacheSet(key, value, ttlMs) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expires: Date.now() + ttlMs });
}

// Nominatim's usage policy allows one request per second.
let nominatimNext = 0;
async function nominatimSlot() {
  const wait = nominatimNext - Date.now();
  nominatimNext = Math.max(Date.now(), nominatimNext) + 1100;
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
}

async function getJson(url, { ttl = 10 * 60_000, timeout = 12_000, method = 'GET', body } = {}) {
  const key = `${method} ${url} ${body || ''}`;
  const hit = cacheGet(key);
  if (hit !== undefined) return hit;
  if (url.startsWith(NOMINATIM)) await nominatimSlot();
  const res = await fetch(url, {
    method,
    body,
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      'Accept-Language': 'en',
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
  const json = await res.json();
  cacheSet(key, json, ttl);
  return json;
}

async function firstOk(tasks) {
  let lastErr;
  for (const task of tasks) {
    try { return await task(); } catch (err) { lastErr = err; }
  }
  throw lastErr || new Error('No service answered');
}

// Public Overpass servers are often busy. Ask one, bring in the next mirror when it fails or
// has not answered within a few seconds, and take the first good answer, so a slow mirror
// costs seconds, not the whole request. A mirror that lost the race sits out for a while.
const overpassSlowUntil = new Map();

export async function overpass(query, timeout = 10_000, stagger = 3_000) {
  const body = `data=${encodeURIComponent(query)}`;
  const hit = cacheGet(`overpass ${body}`);
  if (hit !== undefined) return hit;
  const now = Date.now();
  const mirrors = [...OVERPASS].sort((x, y) => ((overpassSlowUntil.get(x) || 0) > now) - ((overpassSlowUntil.get(y) || 0) > now));
  const ctrl = new AbortController();
  const reasons = [];
  let winner = -1;
  const ask = async (url) => {
    const res = await fetch(url, {
      method: 'POST',
      body,
      headers: { 'User-Agent': UA, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.any([ctrl.signal, AbortSignal.timeout(timeout)]),
    });
    if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
    const json = await res.json();
    // Overpass reports its own timeouts inside a 200 answer.
    if (json.remark && /runtime error|timed out|out of memory/i.test(json.remark) && !json.elements?.length) throw new Error('the map server timed out');
    return json;
  };
  const json = await new Promise((resolve) => {
    let started = 0;
    let settled = 0;
    let timer = 0;
    const next = () => {
      clearTimeout(timer);
      if (winner >= 0 || started >= mirrors.length) return;
      const i = started++;
      ask(mirrors[i]).then((j) => {
        if (winner < 0) { winner = i; resolve(j); }
      }, (err) => {
        if (winner < 0) reasons.push(err.name === 'TimeoutError' ? 'timed out' : err.message);
        if (++settled === mirrors.length && winner < 0) resolve(null);
        else next();
      });
      if (started < mirrors.length) timer = setTimeout(next, stagger);
    };
    next();
  });
  ctrl.abort();
  if (!json) throw new Error(`The map data servers are busy (${[...new Set(reasons)].join('; ') || 'no answer'})`);
  for (let i = 0; i < winner; i++) overpassSlowUntil.set(mirrors[i], Date.now() + 5 * 60_000);
  cacheSet(`overpass ${body}`, json, 10 * 60_000);
  return json;
}

/* ---------------- places ---------------- */

const titleCase = (s) => String(s || '').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

function joinAddress(parts) {
  const seen = new Set();
  return parts.map(p => String(p || '').trim()).filter(p => p && !seen.has(p.toLowerCase()) && seen.add(p.toLowerCase())).join(', ');
}

function fromPhoton(f) {
  const p = f.properties || {};
  const [lng, lat] = f.geometry?.coordinates || [];
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const name = p.name || street || p.district || p.city || p.state || p.country || 'Place';
  return {
    name,
    address: joinAddress([street !== name ? street : '', p.locality, p.district, p.city, p.county, p.state, p.country].filter(x => x !== name)),
    lat, lng,
    kind: titleCase(p.osm_value || p.type || 'place'),
    area: p.district || p.locality || p.city || '',
    city: p.city || p.county || '',
    country: p.country || '',
    countryCode: String(p.countrycode || '').toUpperCase(),
    osm: p.osm_type && p.osm_id ? `${p.osm_type}${p.osm_id}` : undefined,
    extent: Array.isArray(p.extent) ? p.extent : undefined,
  };
}

function fromNominatim(item) {
  const a = item.address || {};
  const name = item.name || String(item.display_name || '').split(',')[0] || 'Place';
  return {
    name,
    address: joinAddress(String(item.display_name || '').split(',').slice(name && item.display_name?.startsWith(name) ? 1 : 0)),
    lat: Number(item.lat), lng: Number(item.lon),
    kind: titleCase(item.type || item.category || item.class || 'place'),
    area: a.suburb || a.neighbourhood || a.city_district || a.quarter || a.town || a.city || '',
    city: a.city || a.town || a.village || a.county || a.state || '',
    country: a.country || '',
    countryCode: String(a.country_code || '').toUpperCase(),
    osm: item.osm_type && item.osm_id ? `${item.osm_type[0].toUpperCase()}${item.osm_id}` : undefined,
  };
}

/** Free-text place search, biased towards `near` ([lng, lat]) when given. */
export async function searchPlaces(q, { near, limit = 6 } = {}) {
  const query = String(q || '').trim();
  if (!query) return [];
  const coords = parseLatLng(query);
  if (coords) return [await reverseGeocode(coords).catch(() => ({ name: query, address: '', lng: coords[0], lat: coords[1] }))];
  const bias = isLngLat(near) ? `&lat=${near[1]}&lon=${near[0]}` : '';
  try {
    const j = await getJson(`${PHOTON}/api/?q=${encodeURIComponent(query)}&limit=${limit}&lang=en${bias}`, { ttl: 24 * 3600_000 });
    const out = (j.features || []).map(fromPhoton).filter(p => isLngLat([p.lng, p.lat]));
    if (out.length) return out;
  } catch { /* fall through to Nominatim */ }
  const box = isLngLat(near) ? `&viewbox=${near[0] - 0.4},${near[1] + 0.4},${near[0] + 0.4},${near[1] - 0.4}` : '';
  const j = await getJson(`${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=${limit}&q=${encodeURIComponent(query)}${box}`, { ttl: 24 * 3600_000 });
  return (Array.isArray(j) ? j : []).map(fromNominatim).filter(p => isLngLat([p.lng, p.lat]));
}

export async function reverseGeocode(p) {
  const [lng, lat] = p;
  try {
    const j = await getJson(`${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&zoom=17&lat=${lat}&lon=${lng}`, { ttl: 24 * 3600_000 });
    if (j && !j.error) return { ...fromNominatim(j), lat, lng };
  } catch { /* fall through to Photon */ }
  const j = await getJson(`${PHOTON}/reverse?lat=${lat}&lon=${lng}&lang=en`, { ttl: 24 * 3600_000 });
  const f = (j.features || [])[0];
  if (!f) throw new Error('Nothing is mapped at that point');
  return { ...fromPhoton(f), lat, lng };
}

/* ---------------- nearby search (Overpass) ---------------- */

// Everyday words mapped to OpenStreetMap tags. Anything not listed is matched against
// names, brands and tag values, so "Shoprite" or "bakery" work without an entry.
const CATEGORY_TAGS = [
  [/\b(gas|petrol|fuel|filling)( station)?\b/, '["amenity"="fuel"]'],
  [/\b(atm|cash ?point)\b/, '["amenity"="atm"]'],
  [/\bbanks?\b/, '["amenity"="bank"]'],
  [/\b(hospital|emergency)\b/, '["amenity"="hospital"]'],
  [/\b(clinic|doctor|medical cent(er|re))\b/, '["amenity"~"^(clinic|doctors)$"]'],
  [/\b(pharmacy|pharmacies|chemist|drug ?store)\b/, '["amenity"="pharmacy"]'],
  [/\b(restaurant|eatery|eateries|food|place to eat)\b/, '["amenity"~"^(restaurant|fast_food|food_court)$"]'],
  [/\b(fast ?food)\b/, '["amenity"="fast_food"]'],
  [/\b(cafe|coffee)\b/, '["amenity"="cafe"]'],
  [/\b(bar|pub|lounge)s?\b/, '["amenity"~"^(bar|pub)$"]'],
  [/\b(supermarket|grocery|groceries)\b/, '["shop"~"^(supermarket|convenience|grocery)$"]'],
  [/\b(market)s?\b/, '["amenity"="marketplace"]'],
  [/\b(mall|shopping cent(er|re)|plaza)\b/, '["shop"="mall"]'],
  [/\b(hotel|lodging|guest ?house|motel)s?\b/, '["tourism"~"^(hotel|guest_house|motel|hostel)$"]'],
  [/\b(school)s?\b/, '["amenity"~"^(school|college|driving_school)$"]'],
  [/\bdriving school\b/, '["amenity"="driving_school"]'],
  [/\b(universit(y|ies)|college)\b/, '["amenity"~"^(university|college)$"]'],
  [/\b(church|mosque|temple|worship)\b/, '["amenity"="place_of_worship"]'],
  [/\b(police)\b/, '["amenity"="police"]'],
  [/\b(fire station)\b/, '["amenity"="fire_station"]'],
  [/\b(post office)\b/, '["amenity"="post_office"]'],
  [/\b(park|garden)s?\b/, '["leisure"~"^(park|garden)$"]'],
  [/\b(gym|fitness)\b/, '["leisure"="fitness_centre"]'],
  [/\b(cinema|movies?)\b/, '["amenity"="cinema"]'],
  [/\b(bus stop|bus station|park and ride|motor park)\b/, '["highway"="bus_stop"]'],
  [/\b(train station|railway station|rail)\b/, '["railway"~"^(station|halt)$"]'],
  [/\b(parking|car park)\b/, '["amenity"="parking"]'],
  [/\b(mechanic|car repair|workshop)\b/, '["shop"="car_repair"]'],
  [/\b(car wash)\b/, '["amenity"="car_wash"]'],
  [/\b(hair|salon|barber)s?\b/, '["shop"~"^(hairdresser|beauty)$"]'],
  [/\b(toilet|restroom)s?\b/, '["amenity"="toilets"]'],
  [/\b(charging|ev charger)\b/, '["amenity"="charging_station"]'],
];

// Overpass string literals treat backslashes as escapes, so regex specials become wildcards.
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\"]/g, '.');

function tagFilterFor(text) {
  const t = String(text || '').toLowerCase();
  const hit = CATEGORY_TAGS.filter(([re]) => re.test(t)).map(([, f]) => f);
  return hit.length ? hit[hit.length - 1] : null;
}

function elementPoint(el) {
  if (Number.isFinite(el.lon) && Number.isFinite(el.lat)) return [el.lon, el.lat];
  if (el.center) return [el.center.lon, el.center.lat];
  return null;
}

function tagKind(tags = {}) {
  for (const k of ['amenity', 'shop', 'tourism', 'leisure', 'office', 'craft', 'healthcare', 'public_transport', 'railway', 'highway', 'place', 'historic', 'man_made', 'building']) {
    if (tags[k] && tags[k] !== 'yes') return titleCase(tags[k]);
  }
  return 'Place';
}

function fromElement(el, origin) {
  const t = el.tags || {};
  const p = elementPoint(el);
  const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  return {
    name: t.name || t.brand || t.operator || tagKind(t),
    address: joinAddress([street, t['addr:suburb'] || t['addr:district'], t['addr:city']]),
    lat: p?.[1], lng: p?.[0],
    kind: tagKind(t),
    brand: t.brand || undefined,
    phone: t.phone || t['contact:phone'] || undefined,
    website: t.website || t['contact:website'] || undefined,
    openingHours: t.opening_hours || undefined,
    osm: `${el.type[0].toUpperCase()}${el.id}`,
    distanceM: origin && p ? Math.round(distanceM(origin, p)) : undefined,
  };
}

async function photonNearby(text, near, radius, limit) {
  const q = String(text || '').trim();
  if (!q) return [];
  const j = await getJson(`${PHOTON}/api/?q=${encodeURIComponent(q)}&limit=20&lang=en&lat=${near[1]}&lon=${near[0]}&location_bias_scale=0.1&zoom=14`, { ttl: 3600_000, timeout: 8_000 });
  return (j.features || []).map(fromPhoton)
    .filter(p => isLngLat([p.lng, p.lat]))
    .map(p => ({ ...p, distanceM: Math.round(distanceM(near, [p.lng, p.lat])) }))
    .filter(p => p.distanceM <= Math.max(radius, 15000))
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}

function nearbyTerms(q, category) {
  const text = String(q || '').trim();
  const words = text.toLowerCase().replace(/\b(nearest|closest|nearby|near me|around me|the|a|an)\b/g, ' ').trim().split(/\s+/).filter(w => w.length > 1).slice(0, 4);
  // Words that name a business ("Ebeano" in "Ebeano supermarket") must match a name; a pure
  // category ("pharmacy") searches by tag instead.
  const generic = (w) => tagFilterFor(w) || /^(shop|store|station|stop|place|centre|center|outlet|branch)s?$/.test(w);
  return { text, words, nameWords: words.filter(w => !generic(w)) };
}

/**
 * Places matching a name, brand or category around a point. OpenStreetMap and every extra
 * provider with a key (server-place-providers.js) are asked at once; the answers are merged
 * so each place appears once, with `sources` naming who knows it.
 */
export async function searchNearby({ q = '', category = '', near, radius, limit = 10 }) {
  if (!isLngLat(near)) throw new Error('A location is needed to search nearby');
  const { words, nameWords } = nearbyTerms(q, category);
  const reach = radius || 15000;
  const searched = ['OpenStreetMap', ...activeProviders().map(p => p.name)];
  const [osm, extra] = await Promise.all([
    osmNearby({ q, category, near, radius, limit }).then(r => ({ ok: r }), err => ({ err })),
    activeProviders().length
      ? searchProviders({ text: words.join(' ') || String(category || '').trim(), near, radius: reach, limit })
      : { lists: [], errors: [] },
  ]);
  // A business name must appear in what a provider returns; their fuzzy matching would
  // otherwise answer "Ebeano" with the nearest supermarket of any name.
  const named = (p) => nameWords.every(w => `${p.name} ${p.brand || ''}`.toLowerCase().includes(w));
  const lists = extra.lists.map(l => ({ ...l, places: l.places.filter(named) })).filter(l => l.places.length);
  if (!lists.length) {
    if (osm.err) throw osm.err;
    return { ...osm.ok, searched, ...(extra.errors.length ? { providerErrors: extra.errors } : {}) };
  }
  const osmPlaces = osm.ok?.places || [];
  const places = mergePlaces([{ source: 'OpenStreetMap', places: osmPlaces }, ...lists], limit);
  return {
    places,
    searched,
    radius: Math.max(osm.ok?.radius || 0, reach),
    ...(extra.errors.length || osm.err ? { providerErrors: [...extra.errors, ...(osm.err ? [`OpenStreetMap: ${osm.err.message}`] : [])] } : {}),
  };
}

async function osmNearby({ q = '', category = '', near, radius, limit = 10 }) {
  const { text, words, nameWords } = nearbyTerms(q, category);
  const filter = tagFilterFor(category) || tagFilterFor(text);
  const nameRe = nameWords.map(escapeRe).join('.*');
  const run = async (r) => {
    const around = `(around:${r},${near[1]},${near[0]})`;
    const parts = [];
    if (nameRe) {
      parts.push(`nwr${around}[~"^(name|brand|operator|name:en)$"~"${nameRe}",i];`);
    } else if (filter) {
      parts.push(`nwr${around}${filter};`);
    } else if (words.length) {
      // An everyday word with no mapping ("bakery") is usually the tag value itself.
      parts.push(`nwr${around}[~"^(amenity|shop|tourism|leisure|office|craft|healthcare)$"~"^${words.map(escapeRe).join('_')}$",i];`);
    }
    if (!parts.length) return [];
    const j = await overpass(`[out:json][timeout:10];(${parts.join('')});out center tags 120;`);
    return (j.elements || []).filter(el => el.tags && elementPoint(el));
  };
  let found = [];
  let used = radius || 0;
  const started = Date.now();
  try {
    for (const r of radius ? [radius] : [3000, 15000]) {
      // Widen only while there is time left, so one search never runs past about half a minute.
      if (found.length && Date.now() - started > 10_000) break;
      const more = await run(r);
      used = r;
      found = more;
      if (found.length >= Math.min(3, limit)) break;
    }
  } catch (err) {
    // Keep what a smaller radius already found; otherwise try Photon's text search around
    // the same point. Photon finding nothing is not proof there is nothing, so the
    // Overpass error stands in that case.
    if (!found.length) {
      const places = await photonNearby(text || category, near, 15000, limit).catch(() => null);
      if (!places?.length) throw err;
      return { places: places.map(p => ({ ...p, sources: ['OpenStreetMap'] })), radius: 15000, source: 'photon' };
    }
  }
  const seen = new Set();
  const places = found.map(el => fromElement(el, near))
    .filter(p => {
      const k = `${p.name.toLowerCase()}|${Math.round(p.lat * 2000)}|${Math.round(p.lng * 2000)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
  return { places: places.map(p => ({ ...p, sources: ['OpenStreetMap'] })), radius: used };
}

/* ---------------- routing ---------------- */

const side = (mod) => (/left/.test(mod || '') ? 'left' : 'right');

export function stepInstruction(step) {
  const m = step.maneuver || {};
  const mod = m.modifier;
  const road = step.name || step.ref || '';
  const onto = road ? ` onto ${road}` : '';
  switch (m.type) {
    case 'depart': return `Head ${compass(m.bearing_after || 0)}${road ? ` on ${road}` : ''}`;
    case 'arrive': return `Arrive at the destination${mod && mod !== 'straight' && mod !== 'uturn' ? `, on the ${side(mod)}` : ''}`;
    case 'roundabout': case 'rotary': case 'roundabout turn':
      return `At the roundabout, take the ${ordinal(m.exit || 1)} exit${onto}`;
    case 'exit roundabout': case 'exit rotary': return `Leave the roundabout${onto}`;
    case 'merge': return `Merge${mod ? ` ${side(mod)}` : ''}${onto}`;
    case 'on ramp': return `Take the ramp${mod ? ` on the ${side(mod)}` : ''}${onto}`;
    case 'off ramp': return `Take the exit${mod ? ` on the ${side(mod)}` : ''}${onto}`;
    case 'fork': return `Keep ${side(mod)} at the fork${onto}`;
    case 'end of road': return `At the end of the road, turn ${side(mod)}${onto}`;
    case 'new name': return `Continue${onto}`;
    default:
      if (mod === 'uturn') return `Make a U-turn${road ? ` on ${road}` : ''}`;
      if (!mod || mod === 'straight') return `Continue straight${road ? ` on ${road}` : ''}`;
      return `Turn ${mod}${onto}`;
  }
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** A road route through the given [lng, lat] points. mode: driving | walking | cycling. */
export async function route(points, mode = 'driving') {
  const pts = points.filter(isLngLat);
  if (pts.length < 2) throw new Error('A route needs a start and an end');
  const coords = pts.map(p => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join(';');
  const bases = OSRM[mode] || OSRM.driving;
  const j = await firstOk(bases.map(b => () => getJson(`${b}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=true&alternatives=false`, { timeout: 12_000 })));
  const r = j.routes?.[0];
  if (!r) throw new Error(j.message || 'No route was found between those places');
  let along = 0;
  const steps = [];
  for (const leg of r.legs || []) {
    for (const s of leg.steps || []) {
      steps.push({
        instruction: stepInstruction(s),
        road: s.name || '',
        ref: s.ref || undefined,
        distance: Math.round(s.distance),
        duration: Math.round(s.duration),
        type: s.maneuver?.type,
        modifier: s.maneuver?.modifier,
        location: s.maneuver?.location,
        along: Math.round(along),
      });
      along += s.distance;
    }
  }
  return {
    mode,
    distance: Math.round(r.distance),
    duration: Math.round(r.duration),
    geometry: r.geometry?.coordinates || [],
    steps,
    snapped: (j.waypoints || []).map(w => ({ location: w.location, distance: Math.round(w.distance || 0), road: w.name || '' })),
  };
}

/* ---------------- corridor analysis ---------------- */

const STOP_RE = /^(bus_stop|platform|stop_position|station|bus_station|ferry_terminal|taxi|halt)$/;

function landmarkScore(tags = {}) {
  let s = 0;
  if (tags.wikidata || tags.wikipedia) s += 4;
  if (tags.brand || tags['brand:wikidata']) s += 3;
  const kind = tags.amenity || tags.shop || tags.tourism || tags.leisure || tags.man_made || tags.historic || tags.building || '';
  if (/^(mall|supermarket|department_store|stadium|marketplace|bus_station|university|hospital|hotel|place_of_worship|fuel|bank|restaurant|fast_food|cinema|police|fire_station|tower|monument|memorial|townhall|courthouse|school|college)$/.test(kind)) s += 2;
  if (tags.opening_hours || tags.phone || tags.website) s += 1;
  if (tags.name && tags.name.length <= 28) s += 1;
  return s;
}

function stopName(tags = {}) {
  return tags.name || tags['name:en'] || tags.official_name || tags.local_name || '';
}

/**
 * Studies the roads, stops, areas and landmarks along a route, for transit planning.
 * `geometry` and `steps` come from route(); `origin`/`destination` are [lng, lat].
 */
export async function analyseCorridor({ geometry, steps, origin, destination }) {
  let line = simplify(geometry, 20);
  for (let tol = 40; line.length > 180; tol *= 2) line = simplify(geometry, tol);
  const poly = line.map(([x, y]) => `${y.toFixed(5)},${x.toFixed(5)}`).join(',');
  const d = `${destination[1]},${destination[0]}`;
  const o = `${origin[1]},${origin[0]}`;
  const ROUTE_TYPES = '^(bus|minibus|share_taxi|trolleybus|tram|train|light_rail|subway|monorail|ferry)$';
  const q = `[out:json][timeout:15];
(
  node(around:60,${poly})[highway=bus_stop];
  nwr(around:60,${poly})[public_transport~"^(platform|station)$"];
  nwr(around:150,${poly})[amenity~"^(bus_station|ferry_terminal|taxi)$"];
  nwr(around:200,${poly})[railway~"^(station|halt)$"];
  node(around:800,${poly})[place~"^(suburb|neighbourhood|quarter|village|town|locality)$"][name];
  node(around:30,${poly})[highway~"^(traffic_signals|motorway_junction)$"][name];
  nwr(around:70,${poly})[name][~"^(wikidata|brand)$"~"."];
);
out center tags;
make section name="destination";out;
nwr(around:450,${d})[name][~"^(amenity|shop|tourism|leisure|office|historic|man_made|building|healthcare)$"~"."];
out center tags 150;
make section name="origin_lines";out;
nwr(around:600,${o})[~"^(highway|public_transport)$"~"^(bus_stop|platform|stop_position)$"]->.os;
(rel(bn.os)[type=route][route~"${ROUTE_TYPES}"];rel(bw.os)[type=route][route~"${ROUTE_TYPES}"];);
out tags 40;
make section name="destination_lines";out;
nwr(around:600,${d})[~"^(highway|public_transport)$"~"^(bus_stop|platform|stop_position)$"]->.ds;
(rel(bn.ds)[type=route][route~"${ROUTE_TYPES}"];rel(bw.ds)[type=route][route~"${ROUTE_TYPES}"];);
out tags 40;`;
  const j = await overpass(q, 15_000, 3_000);
  const sections = { corridor: [], destination: [], origin_lines: [], destination_lines: [] };
  let cur = 'corridor';
  for (const el of j.elements || []) {
    if (el.type === 'section') { cur = el.tags?.name || cur; continue; }
    sections[cur]?.push(el);
  }
  return buildCorridor({ geometry, steps, origin, destination, sections });
}

/** Pure part of analyseCorridor, exported for tests. */
export function buildCorridor({ geometry, steps, origin, destination, sections }) {
  const total = lineLength(geometry);
  const stops = [];
  const areas = [];
  const junctions = [];
  const landmarks = [];
  for (const el of sections.corridor || []) {
    const t = el.tags || {};
    const p = elementPoint(el);
    const proj = p && projectOnLine(geometry, p);
    if (!proj) continue;
    const name = stopName(t);
    const kind = t.highway || t.public_transport || t.amenity || t.railway || t.place || '';
    const item = { name, along: Math.round(proj.along), offset: Math.round(proj.offset), side: proj.side, point: p };
    if (STOP_RE.test(kind) && (t.highway === 'bus_stop' || t.public_transport || t.amenity || t.railway)) {
      if (!name) continue;
      stops.push({ ...item, kind: t.railway ? 'rail station' : t.amenity === 'bus_station' || t.public_transport === 'station' ? 'bus station' : t.amenity === 'ferry_terminal' ? 'ferry terminal' : t.amenity === 'taxi' ? 'taxi rank' : 'stop' });
    } else if (t.place) {
      if (proj.offset <= 800) areas.push({ ...item, kind: t.place });
    } else if (t.highway === 'traffic_signals' || t.highway === 'motorway_junction') {
      junctions.push({ ...item, kind: 'junction' });
    } else if (name) {
      landmarks.push({ ...item, kind: tagKind(t), score: landmarkScore(t) });
    }
  }

  // One entry per name within 250 m of route distance (both sides of a road share a name).
  const dedupe = (list, gap = 250) => {
    const out = [];
    for (const s of list.sort((a, b) => a.along - b.along)) {
      const prev = out.findLast(x => x.name.toLowerCase() === s.name.toLowerCase());
      if (prev && s.along - prev.along < gap) continue;
      out.push(s);
    }
    return out;
  };
  const stopList = dedupe(stops);
  // An area is "passed" at the point of the route closest to its centre.
  const areaList = dedupe(areas, 1500).filter(a => a.along > 150 || a.offset < 400);

  // Road segments: consecutive steps on the same road merge; short unnamed links fold in.
  const segs = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s.type === 'arrive') continue;
    const road = s.road || s.ref || '';
    const last = segs[segs.length - 1];
    if (last && (last.road === road || (!road && s.distance < 200))) {
      last.distance += s.distance;
      continue;
    }
    segs.push({ road: road || 'an unnamed road', start: s.along, distance: s.distance, enter: i === 0 ? 'start' : s.instruction });
  }
  const segments = segs.filter((s, i) => s.distance >= 120 || i === 0 || i === segs.length - 1).map(s => {
    const end = s.start + s.distance;
    const on = stopList.filter(x => x.along >= s.start - 30 && x.along <= end + 30);
    const passed = areaList.filter(x => x.along >= s.start && x.along <= end).map(x => x.name);
    // Stops are what people board and alight at, then area names, then named junctions.
    const near = (m) => {
      for (const [list, reach] of [[stopList, 300], [areaList, 500], [junctions, 300]]) {
        const hit = list.map(x => ({ x, gap: Math.abs(x.along - m) })).filter(({ gap }) => gap <= reach).sort((a, b) => a.gap - b.gap)[0];
        if (hit) return hit.x.name;
      }
      return undefined;
    };
    return {
      road: s.road,
      enter: s.enter,
      km: Math.round(s.distance / 100) / 10,
      stopCount: on.length,
      stops: pickSpread(on.map(x => x.name), 6),
      areas: [...new Set(passed)].slice(0, 6),
      startsNear: near(s.start) || undefined,
      endsNear: near(end) || undefined,
    };
  });

  // Which side of the first main road the traveller starts on.
  let boarding = null;
  const main = segments.find(s => s.stopCount > 0 && s.km >= 0.5) || segments.find(s => s.km >= 1);
  if (main && isLngLat(origin)) {
    const seg = segs.find(s => s.road === main.road);
    const at = pointAlong(geometry, (seg?.start ?? 0) + 25);
    const j = at.point;
    const b = at.bearing;
    const toOrigin = bearing(j, origin);
    const rel = ((toOrigin - b) + 360) % 360; // 0-180 right, 180-360 left
    const walk = distanceM(origin, j);
    const firstStop = stopList.find(x => x.along >= (seg?.start ?? 0) - 30);
    boarding = {
      road: main.road,
      heading: compass(b),
      originSide: walk < 15 ? 'on the road' : rel < 180 ? 'right' : 'left',
      walkToRoadM: Math.round(walk / 10) * 10,
      firstStop: firstStop ? { name: firstStop.name, alongM: Math.round(firstStop.along - (seg?.start ?? 0)) } : undefined,
    };
  }

  const destLandmarks = (sections.destination || [])
    .map(el => {
      const p = elementPoint(el);
      const t = el.tags || {};
      if (!p || !t.name) return null;
      const m = distanceM(destination, p);
      return { name: t.name, kind: tagKind(t), m: Math.round(m / 10) * 10, dir: compass(bearing(destination, p)), score: landmarkScore(t) - m / 150 };
    })
    .filter(x => x && x.m > 15)
    .sort((a, b) => b.score - a.score);
  const uniq = [];
  for (const l of destLandmarks) if (!uniq.some(u => u.name.toLowerCase() === l.name.toLowerCase())) uniq.push(l);

  const lineName = (el) => {
    const t = el.tags || {};
    return [t.route && titleCase(t.route), t.ref, t.name || [t.from, t.to].filter(Boolean).join(' - ')].filter(Boolean).join(' ').trim();
  };
  const ol = new Map((sections.origin_lines || []).map(el => [el.id, lineName(el)]));
  const dl = new Map((sections.destination_lines || []).map(el => [el.id, lineName(el)]));
  const direct = [...ol.keys()].filter(id => dl.has(id)).map(id => ol.get(id));

  return {
    totalKm: Math.round(total / 100) / 10,
    segments,
    areasInOrder: areaList.map(a => a.name).slice(0, 12),
    majorStops: pickSpread(stopList.filter(s => s.kind !== 'stop').map(s => `${s.name} (${s.kind})`), 8),
    boarding,
    transitLines: {
      direct: [...new Set(direct)].slice(0, 8),
      nearOrigin: [...new Set(ol.values())].slice(0, 8),
      nearDestination: [...new Set(dl.values())].slice(0, 8),
    },
    destinationLandmarks: uniq.slice(0, 6).map(({ score, ...l }) => l),
    stopsOnMap: stopList.slice(0, 150).map(s => ({ name: s.name, lng: s.point[0], lat: s.point[1] })),
  };
}

function pickSpread(list, n) {
  if (list.length <= n) return list;
  const out = [];
  for (let i = 0; i < n; i++) out.push(list[Math.round(i * (list.length - 1) / (n - 1))]);
  return [...new Set(out)];
}

/* ---------------- directions ---------------- */

const SPLIT_RE = /\s+(?:at|on|in|near|along|by|off|opposite|beside|behind)\s+|\s*,\s*/i;

/**
 * Finds a place from free text such as "AA Rescue driving school at CMD Road".
 * Tries the whole text, then the business name around the located street or area.
 */
export async function resolvePlace(text, near) {
  const raw = String(text || '').trim();
  const coords = parseLatLng(raw);
  if (coords) {
    const r = await reverseGeocode(coords).catch(() => null);
    return { place: { name: r?.name || raw, address: r?.address || '', lng: coords[0], lat: coords[1], country: r?.country, countryCode: r?.countryCode, area: r?.area }, alternatives: [] };
  }
  const whole = await searchPlaces(raw, { near, limit: 4 }).catch(() => []);
  const parts = raw.split(SPLIT_RE).map(s => s.trim()).filter(Boolean);
  const headWords = (parts[0] || '').toLowerCase().split(/\W+/).filter(w => w.length > 2);
  const named = (p) => headWords.filter(w => p.name.toLowerCase().includes(w)).length >= Math.min(2, headWords.length);
  // With "X at Y", the whole-text result counts only when its name is X, not the street Y.
  if (whole.length && (parts.length < 2 || named(whole[0]))) {
    return { place: whole[0], alternatives: whole.slice(1, 3) };
  }
  if (parts.length >= 2) {
    const [head, ...rest] = parts;
    const ctx = await searchPlaces(rest.join(', '), { near, limit: 1 }).catch(() => []);
    const anchor = ctx[0] ? [ctx[0].lng, ctx[0].lat] : near;
    if (isLngLat(anchor)) {
      const byName = await searchNearby({ q: head, near: anchor, radius: 3000, limit: 3 }).catch(() => ({ places: [] }));
      const hits = byName.places.filter(named);
      if (hits.length) return { place: { ...hits[0], country: ctx[0]?.country, countryCode: ctx[0]?.countryCode }, alternatives: hits.slice(1) };
      const biased = await searchPlaces(head, { near: anchor, limit: 3 }).catch(() => []);
      const close = biased.filter(p => distanceM(anchor, [p.lng, p.lat]) < 5000);
      if (close.length) return { place: close[0], alternatives: close.slice(1) };
    }
    if (ctx[0]) {
      return { place: ctx[0], alternatives: [], approximate: `"${head}" is not on OpenStreetMap, so the route ends at ${ctx[0].name}.` };
    }
  }
  if (whole.length) return { place: whole[0], alternatives: whole.slice(1, 3) };
  return { place: null, alternatives: [] };
}

/**
 * Full directions: resolves both ends, routes, and for transit (or when asked) studies
 * the corridor. from/to are text or {lat, lng}. near biases place search.
 */
export async function directions({ from, to, mode = 'driving', near, analyse = false }) {
  const asPoint = (v) => (v && Number.isFinite(Number(v.lat)) && Number.isFinite(Number(v.lng)) ? [Number(v.lng), Number(v.lat)] : null);
  const resolveEnd = async (v, bias) => {
    const p = asPoint(v);
    if (p) {
      const r = await reverseGeocode(p).catch(() => null);
      return { place: { name: v.name || r?.name || 'Start', address: r?.address || '', lng: p[0], lat: p[1], country: r?.country, countryCode: r?.countryCode, area: r?.area }, alternatives: [] };
    }
    return resolvePlace(v, bias);
  };
  const a = await resolveEnd(from, near);
  if (!a.place) return { status: 'not_found', which: 'from', message: `Could not find "${from}" on the map.` };
  const aPt = [a.place.lng, a.place.lat];
  const b = await resolveEnd(to, aPt);
  if (!b.place) return { status: 'not_found', which: 'to', message: `Could not find "${to}" on the map.` };
  const bPt = [b.place.lng, b.place.lat];

  const routeMode = mode === 'transit' ? 'driving' : mode;
  const r = await route([aPt, bPt], routeMode);
  const countryCode = a.place.countryCode || b.place.countryCode || '';
  const out = {
    status: 'success',
    mode,
    from: a.place,
    to: b.place,
    alternatives: { from: a.alternatives, to: b.alternatives },
    approximate: [a.approximate, b.approximate].filter(Boolean),
    country: a.place.country || b.place.country || '',
    countryCode,
    drivingSide: drivingSide(countryCode),
    route: r,
  };
  if (mode === 'transit' || analyse) {
    try {
      out.corridor = await analyseCorridor({ geometry: r.geometry, steps: r.steps, origin: aPt, destination: bPt });
      const b = out.corridor.boarding;
      // Vehicles heading the traveller's way stop on the driving side of the road.
      if (b && out.drivingSide) b.crossToBoard = b.originSide !== 'on the road' && b.originSide !== out.drivingSide;
    } catch (err) {
      out.corridorError = `Stops and landmarks could not be loaded (${err.message}).`;
    }
  }
  return out;
}

/* ---------------- HTTP ---------------- */

function send(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
  return true;
}

async function readBody(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 64_000) throw new Error('Request too large');
  }
  return raw ? JSON.parse(raw) : {};
}

const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
const pointParam = (params, lat = 'lat', lng = 'lng') => {
  const p = [num(params.get(lng)), num(params.get(lat))];
  return isLngLat(p) ? p : null;
};

export async function handleMaps(request, response, url) {
  const p = url.searchParams;
  try {
    switch (url.pathname) {
      case '/api/maps/search': {
        const q = (p.get('q') || '').trim().slice(0, 200);
        if (!q) return send(response, 400, { success: false, error: 'q is required' });
        const places = await searchPlaces(q, { near: pointParam(p), limit: Math.min(10, Number(p.get('limit')) || 6) });
        return send(response, 200, { success: true, places });
      }
      case '/api/maps/reverse': {
        const pt = pointParam(p);
        if (!pt) return send(response, 400, { success: false, error: 'lat and lng are required' });
        return send(response, 200, { success: true, place: await reverseGeocode(pt) });
      }
      case '/api/maps/nearby': {
        const pt = pointParam(p);
        if (!pt) return send(response, 400, { success: false, error: 'lat and lng are required' });
        const res = await searchNearby({
          q: (p.get('q') || '').slice(0, 120),
          category: (p.get('category') || '').slice(0, 60),
          near: pt,
          radius: Math.min(50_000, Number(p.get('radius')) || 0) || undefined,
          limit: Math.min(40, Number(p.get('limit')) || 10),
        });
        return send(response, 200, { success: true, ...res });
      }
      case '/api/maps/route': {
        const pts = String(p.get('points') || '').split(';').map(s => s.split(',').map(Number)).filter(isLngLat);
        if (pts.length < 2 || pts.length > 12) return send(response, 400, { success: false, error: 'points must be 2 to 12 "lng,lat" pairs separated by ;' });
        return send(response, 200, { success: true, route: await route(pts, p.get('mode') || 'driving') });
      }
      case '/api/maps/directions': {
        const body = request.method === 'POST' ? await readBody(request) : {};
        const get = (k) => body[k] ?? p.get(k);
        const mode = String(get('mode') || 'driving').toLowerCase();
        if (!['driving', 'walking', 'cycling', 'transit'].includes(mode)) return send(response, 400, { success: false, error: 'mode must be driving, walking, cycling or transit' });
        const from = get('from');
        const to = get('to');
        if (!from || !to) return send(response, 400, { success: false, error: 'from and to are required' });
        const near = Array.isArray(body.near) ? body.near : pointParam(p);
        const res = await directions({ from, to, mode, near, analyse: get('analyse') === true || get('analyse') === '1' });
        return send(response, res.status === 'success' ? 200 : 404, { success: res.status === 'success', ...res });
      }
      default:
        return send(response, 404, { success: false, error: 'Unknown maps endpoint' });
    }
  } catch (err) {
    return send(response, 502, { success: false, error: err?.message || 'The map service did not answer' });
  }
}
