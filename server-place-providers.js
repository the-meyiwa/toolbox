/* ============================================================
   TOOLBOX — Extra place providers for nearby search
   TomTom, Foursquare, HERE, Mapbox and Google Places, used
   beside OpenStreetMap when their keys are set (see PROVIDERS).
   Each one is optional: no key, a spent quota or an outage just
   leaves it out. mergePlaces() folds the answers from every provider
   into one list, one entry per real place.
   ============================================================ */

import { distanceM } from './js/lib/maps/geo.js';

const TIMEOUT_MS = 6_000;
const CACHE_MS = 30 * 60_000;
const cache = new Map();
// A provider that answers 401/403/429 (bad key or quota used up) sits out until this time.
const restingUntil = new Map();

const titleCase = (s) => String(s || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();

async function fetchJson(provider, url, headers = {}, body) {
  const key = body ? `${url} ${body}` : url;
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    body,
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 429 || res.status === 401 || res.status === 403) {
    // Quota or key trouble does not clear in seconds; try again in an hour.
    restingUntil.set(provider, Date.now() + 60 * 60_000);
    throw new Error(`${provider} answered ${res.status}`);
  }
  if (!res.ok) throw new Error(`${provider} answered ${res.status}`);
  const value = await res.json();
  cache.set(key, { value, until: Date.now() + CACHE_MS });
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  return value;
}

async function tomtom({ text, near, radius, limit }) {
  const key = process.env.TOMTOM_API_KEY;
  const url = `https://api.tomtom.com/search/2/poiSearch/${encodeURIComponent(text)}.json`
    + `?key=${encodeURIComponent(key)}&lat=${near[1]}&lon=${near[0]}&radius=${Math.round(radius)}&limit=${Math.min(limit, 50)}&language=en-GB`;
  const j = await fetchJson('TomTom', url);
  return (j.results || []).filter(r => r.poi?.name && r.position).map(r => ({
    name: r.poi.name,
    address: r.address?.freeformAddress || '',
    lat: r.position.lat,
    lng: r.position.lon,
    kind: titleCase(r.poi.categories?.[0] || r.poi.classifications?.[0]?.code || 'Place'),
    brand: r.poi.brands?.[0]?.name,
    phone: r.poi.phone,
    website: r.poi.url,
  }));
}

async function foursquare({ text, near, radius, limit }) {
  const key = process.env.FOURSQUARE_API_KEY;
  const url = `https://places-api.foursquare.com/places/search?query=${encodeURIComponent(text)}`
    + `&ll=${near[1]},${near[0]}&radius=${Math.min(Math.round(radius), 100_000)}&limit=${Math.min(limit, 50)}&sort=DISTANCE`;
  const j = await fetchJson('Foursquare', url, { Authorization: `Bearer ${key}`, 'X-Places-Api-Version': '2025-06-17' });
  return (j.results || []).map(r => {
    const lat = r.latitude ?? r.geocodes?.main?.latitude ?? r.location?.lat;
    const lng = r.longitude ?? r.geocodes?.main?.longitude ?? r.location?.lng;
    return {
      name: r.name,
      address: r.location?.formatted_address || [r.location?.address, r.location?.locality].filter(Boolean).join(', '),
      lat, lng,
      kind: r.categories?.[0]?.name || 'Place',
      phone: r.tel || undefined,
      website: r.website || undefined,
    };
  }).filter(p => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

async function here({ text, near, radius, limit }) {
  const key = process.env.HERE_API_KEY;
  const url = `https://discover.search.hereapi.com/v1/discover?q=${encodeURIComponent(text)}`
    + `&in=circle:${near[1]},${near[0]};r=${Math.min(Math.round(radius), 250_000)}&limit=${Math.min(limit, 100)}&lang=en&apiKey=${encodeURIComponent(key)}`;
  const j = await fetchJson('HERE', url);
  return (j.items || []).filter(r => r.position && r.resultType === 'place').map(r => ({
    name: r.title,
    address: r.address?.label || '',
    lat: r.position.lat,
    lng: r.position.lng,
    kind: r.categories?.[0]?.name || 'Place',
    phone: r.contacts?.[0]?.phone?.[0]?.value,
    website: r.contacts?.[0]?.www?.[0]?.value,
  }));
}

async function mapbox({ text, near, limit }) {
  const key = process.env.MAPBOX_ACCESS_TOKEN;
  const url = `https://api.mapbox.com/search/searchbox/v1/forward?q=${encodeURIComponent(text)}`
    + `&proximity=${near[0]},${near[1]}&types=poi&limit=${Math.min(limit, 10)}&language=en&access_token=${encodeURIComponent(key)}`;
  const j = await fetchJson('Mapbox', url);
  return (j.features || []).map(f => {
    const p = f.properties || {};
    const [lng, lat] = f.geometry?.coordinates || [p.coordinates?.longitude, p.coordinates?.latitude];
    return {
      name: p.name,
      address: p.full_address || p.place_formatted || '',
      lat, lng,
      kind: titleCase(p.poi_category?.[0] || 'Place'),
      brand: p.brand?.[0],
      phone: p.metadata?.phone,
      website: p.metadata?.website,
    };
  }).filter(p => p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

// Google bills by the fields asked for. These are all in its lower-priced tier; phone numbers,
// websites and hours would move every call to the dearest one.
const GOOGLE_FIELDS = 'places.displayName,places.formattedAddress,places.location,places.primaryTypeDisplayName,places.types';

async function google({ text, near, radius, limit }) {
  const body = JSON.stringify({
    textQuery: text,
    pageSize: Math.min(limit, 20),
    languageCode: 'en',
    locationBias: { circle: { center: { latitude: near[1], longitude: near[0] }, radius: Math.min(radius, 50_000) } },
  });
  const j = await fetchJson('Google', 'https://places.googleapis.com/v1/places:searchText', {
    'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
    'X-Goog-FieldMask': GOOGLE_FIELDS,
  }, body);
  return (j.places || []).filter(p => p.location).map(p => ({
    name: p.displayName?.text,
    address: p.formattedAddress || '',
    lat: p.location.latitude,
    lng: p.location.longitude,
    kind: p.primaryTypeDisplayName?.text || titleCase(p.types?.[0] || 'Place'),
  })).filter(p => p.name);
}

// Each provider is used only when its variable is set on the API server.
const PROVIDERS = [
  { name: 'TomTom', env: 'TOMTOM_API_KEY', search: tomtom },
  { name: 'Foursquare', env: 'FOURSQUARE_API_KEY', search: foursquare },
  { name: 'HERE', env: 'HERE_API_KEY', search: here },
  { name: 'Mapbox', env: 'MAPBOX_ACCESS_TOKEN', search: mapbox },
  { name: 'Google', env: 'GOOGLE_PLACES_API_KEY', search: google },
];

/** Providers with a key set and not resting after a quota or key error. */
export function activeProviders() {
  const now = Date.now();
  return PROVIDERS.filter(p => process.env[p.env] && !((restingUntil.get(p.name) || 0) > now));
}

/**
 * Asks every active provider at once. Returns { lists: [{ source, places }], errors }.
 * A failing provider is left out; it never fails the search.
 */
export async function searchProviders({ text, near, radius, limit }) {
  const q = String(text || '').trim();
  if (!q) return { lists: [], errors: [] };
  const active = activeProviders();
  const settled = await Promise.allSettled(active.map(p => p.search({ text: q, near, radius, limit })));
  const lists = [];
  const errors = [];
  settled.forEach((s, i) => {
    const source = active[i].name;
    if (s.status === 'fulfilled') {
      lists.push({ source, places: s.value.map(p => ({ ...p, distanceM: Math.round(distanceM(near, [p.lng, p.lat])) })).filter(p => p.distanceM <= radius * 1.1) });
    } else {
      errors.push(`${source}: ${s.reason?.name === 'TimeoutError' ? 'timed out' : s.reason?.message}`);
    }
  });
  return { lists, errors };
}

const STOP = new Set(['the', 'and', 'ltd', 'limited', 'plc', 'nig', 'nigeria', 'store', 'shop', 'branch', 'outlet']);
const nameWords = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .split(/[^a-z0-9]+/).filter(w => w.length > 1 && !STOP.has(w));

/** True when two provider entries very likely describe the same place. */
export function samePlace(a, b) {
  const d = distanceM([a.lng, a.lat], [b.lng, b.lat]);
  if (d > 250) return false;
  const wa = nameWords(a.name);
  const wb = nameWords(b.name);
  if (!wa.length || !wb.length) return false;
  const shared = wa.filter(w => wb.includes(w)).length;
  const overlap = shared / Math.min(wa.length, wb.length);
  // Close together needs less name agreement than far apart ("Shoprite" vs "Shoprite Ojota").
  return overlap >= 1 || (overlap >= 0.5 && d <= 80);
}

/**
 * Folds lists from several providers into one, one entry per place. Each entry keeps the
 * fullest details and lists every provider that knows it in `sources`. Nearest first, with a
 * place confirmed by more providers ranked as if it were closer.
 */
export function mergePlaces(lists, limit = 10) {
  const merged = [];
  for (const { source, places } of lists) {
    for (const p of places) {
      const twin = merged.find(m => !m.sources.includes(source) && samePlace(m, p));
      if (!twin) {
        merged.push({ ...p, sources: [source] });
        continue;
      }
      twin.sources.push(source);
      for (const k of ['address', 'phone', 'website', 'openingHours', 'brand']) if (!twin[k] && p[k]) twin[k] = p[k];
    }
  }
  const score = (p) => (p.distanceM ?? 1e9) / (1 + 0.6 * (p.sources.length - 1));
  return merged
    .map(p => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== '')))
    .sort((a, b) => score(a) - score(b))
    .slice(0, limit);
}
