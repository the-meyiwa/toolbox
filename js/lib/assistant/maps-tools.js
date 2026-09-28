/* ============================================================
   TOOLBOX — Assistant map tools

   find_place           where a place is (address, area, country)
   search_places_nearby named businesses or categories near a point
   get_directions       driving, walking, cycling and local-transport
                        directions; for transit it returns the roads
                        in order with their stops and area names,
                        which side of the road to board on, transit
                        lines that serve both ends, and well-known
                        landmarks near the destination, so the model
                        can write directions the way locals give them
   render_map           shows chosen places (and optionally the road
                        route between them) on a map

   All data is live OpenStreetMap data from /api/maps/*. Nothing
   about a place is written here. Route geometry travels to the
   chat card in `mapLayers`, which is not sent back to the model.
   ============================================================ */

import * as maps from '../maps/client.js';
import { formatDistance, formatDuration, isLngLat } from '../maps/geo.js';

const HERE_RE = /^\s*(here|my (current )?location|current location|me|where i am|my position|my place)\s*$/i;

export const MAPS_TOOL_DECLARATIONS = [
  {
    name: 'find_place',
    description: 'Finds where a place, address or landmark is on the map (coordinates, full address, area, country) and shows it. Use for "where is X".',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Place, address or landmark as the person wrote it, e.g. "Ketu bus stop, Lagos".' },
        near: { type: 'STRING', description: 'Optional area to search around, e.g. "Ikeja". Defaults to the person\'s location.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_places_nearby',
    description: 'Finds the nearest named businesses or kinds of place (fuel stations, pharmacies, "Shoprite", ATMs, restaurants...) around the person or an area, nearest first, with distances, and shows them on a map.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Business name or brand exactly as asked (e.g. "Shoprite", "KFC"), or the kind of place.' },
        category: { type: 'STRING', description: 'Kind of place, e.g. "gas station", "pharmacy", "bank", "driving school".' },
        location: { type: 'STRING', description: 'Area to search around, e.g. "Lekki Phase 1". Omit to use the person\'s location.' },
        latitude: { type: 'NUMBER' },
        longitude: { type: 'NUMBER' },
        radius_km: { type: 'NUMBER', description: 'Search radius. Default widens from 2.5 to 30 km until places are found.' },
        limit: { type: 'INTEGER', description: 'How many to return (default 5).' },
      },
    },
  },
  {
    name: 'get_directions',
    description: 'Directions between two places by car, on foot, by bicycle, or by local/public transport ("transit": buses, shared taxis, tricycles, trains...). Draws the route on a map. For transit it returns the roads in order with the stops and area names on each, which side of the road to board on, transit lines serving both ends, and landmarks near the destination; write the directions from those. Set analyse to study any route (stops, areas, landmarks along it).',
    parameters: {
      type: 'OBJECT',
      properties: {
        to: { type: 'STRING', description: 'Destination as the person wrote it, including any street or area, e.g. "AA Rescue driving school, CMD Road".' },
        from: { type: 'STRING', description: 'Start. Omit, or "my location", to start from where the person is.' },
        mode: { type: 'STRING', enum: ['driving', 'walking', 'cycling', 'transit'], description: 'transit for buses, taxis, keke, danfo, trains or any local transport.' },
        analyse: { type: 'BOOLEAN', description: 'Also list the roads, stops, areas and landmarks along a driving/walking/cycling route.' },
      },
      required: ['to'],
    },
  },
  {
    name: 'render_map',
    description: 'Shows specific places on a map, optionally joined by the real road route between them in order. Places without coordinates are looked up. Do not use after search_places_nearby, find_place or get_directions: they already show a map.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        places: {
          type: 'ARRAY',
          description: 'Places to show, in route order.',
          items: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING', description: 'Name or address; looked up when lat/lng are missing.' },
              lat: { type: 'NUMBER' },
              lng: { type: 'NUMBER' },
              note: { type: 'STRING' },
            },
            required: ['name'],
          },
        },
        route_mode: { type: 'STRING', enum: ['none', 'driving', 'walking', 'cycling'], description: 'Join the places with a road route (default none).' },
      },
      required: ['places'],
    },
  },
];

export const MAPS_TOOL_NAMES = new Set(MAPS_TOOL_DECLARATIONS.map(d => d.name));

/* ---------------- helpers ---------------- */

async function userPoint(taskState, { precise = false } = {}) {
  const known = taskState?.userLocation;
  const knownOk = known && isLngLat([Number(known.lng), Number(known.lat)]) && (!precise || !(Number(known.accuracy) > 150));
  if (knownOk) return [Number(known.lng), Number(known.lat)];
  const pos = await maps.deviceLocation({ precise });
  if (!pos) return null;
  if (taskState) taskState.userLocation = { ...(taskState.userLocation || {}), lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy };
  return [pos.lng, pos.lat];
}

const km = (m) => (Number.isFinite(m) ? Math.round(m / 100) / 10 : undefined);
const brief = (p) => (p ? { name: p.name, address: p.address || undefined, area: p.area || undefined, lat: round(p.lat), lng: round(p.lng) } : null);
const round = (n) => (Number.isFinite(n) ? Math.round(n * 1e5) / 1e5 : n);

const needLocation = (what) => ({
  status: 'needs_location',
  success: false,
  message: `Location is off or was refused, so ${what}. Ask which area or address to use.`,
});

function failed(err) {
  return { status: 'error', success: false, error: err?.message || 'Map service unavailable', message: `The map service did not answer (${err?.message || 'unknown error'}). Say so; do not guess places or routes.` };
}

/* ---------------- tools ---------------- */

async function findPlace(args, ctx) {
  const query = String(args.query || '').trim();
  if (!query) return { status: 'error', message: 'query is required' };
  let near = await userPoint(ctx.taskState).catch(() => null);
  if (args.near) {
    const area = (await maps.searchPlaces(args.near, { near, limit: 1 }))[0];
    if (area) near = [area.lng, area.lat];
  }
  const found = await maps.searchPlaces(query, { near, limit: 5 });
  if (!found.length) return { status: 'not_found', success: false, message: `"${query}" is not on OpenStreetMap. Ask for a nearby street or landmark.` };
  const [top, ...rest] = found;
  return {
    status: 'success',
    type: 'map-view',
    renderer: 'map-view',
    title: top.name,
    place: { ...brief(top), kind: top.kind, city: top.city || undefined, country: top.country || undefined },
    otherMatches: rest.slice(0, 3).map(p => `${p.name}${p.address ? `, ${p.address}` : ''}`),
    places: [{ name: top.name, address: top.address, lat: top.lat, lng: top.lng, category: top.kind }],
    message: `${top.name}${top.address ? `, ${top.address}` : ''}.`,
  };
}

async function searchNearby(args, ctx) {
  const query = String(args.query || '').trim();
  const category = String(args.category || '').trim();
  if (!query && !category) return { status: 'error', message: 'Give a query or a category.' };
  let near = isLngLat([Number(args.longitude), Number(args.latitude)]) ? [Number(args.longitude), Number(args.latitude)] : null;
  let where = '';
  if (!near && args.location) {
    const loc = (await maps.searchPlaces(args.location, { near: await userPoint(ctx.taskState).catch(() => null), limit: 1 }))[0];
    if (!loc) return { status: 'not_found', success: false, message: `Could not find "${args.location}" on the map.` };
    near = [loc.lng, loc.lat];
    where = loc.name;
  }
  if (!near) near = await userPoint(ctx.taskState);
  if (!near) return needLocation('there is no point to search around');
  const limit = Math.min(20, Math.max(1, Number(args.limit) || 5));
  const radius = Number(args.radius_km) > 0 ? Math.round(Number(args.radius_km) * 1000) : undefined;
  const res = await maps.nearby({ q: query, category, near, radius, limit });
  const places = (res.places || []).map(p => ({
    name: p.name,
    address: p.address || '',
    lat: p.lat,
    lng: p.lng,
    category: p.kind,
    distanceKm: km(p.distanceM),
    phone: p.phone,
    website: p.website,
    openingHours: p.openingHours,
    // Listed by more than one map provider: very likely real and still there.
    confirmedBy: p.sources?.length > 1 ? p.sources : undefined,
  }));
  const label = query || category;
  const searched = (res.searched || ['OpenStreetMap']).join(', ');
  const title = `${label.replace(/^(nearest|closest)\s+/i, '').replace(/^\w/, c => c.toUpperCase())} near ${where || 'you'}`;
  if (!places.length) {
    return { status: 'not_found', success: false, title, searchedKm: km(res.radius), message: `No "${label}" is mapped within ${km(res.radius)} km (searched ${searched}). Say so plainly; do not invent places.` };
  }
  return {
    status: 'success',
    type: 'map-view',
    renderer: 'map-view',
    title,
    query: label,
    places,
    userLocation: where ? undefined : { lat: near[1], lng: near[0] },
    searchedKm: km(res.radius),
    message: `${places.length} found. Nearest: ${places[0].name}${places[0].distanceKm != null ? `, ${places[0].distanceKm} km away (straight line)` : ''}. The card lists them all.`,
  };
}

function condenseSteps(steps) {
  return steps
    .filter(s => s.type !== 'arrive' && !(s.distance < 25 && s.type !== 'depart'))
    .slice(0, 22)
    .map(s => `${s.instruction}${s.distance >= 25 ? ` (${formatDistance(s.distance)})` : ''}`);
}

function transitGuidance(d) {
  const b = d.corridor?.boarding;
  return [
    `Write step-by-step local-transport directions the way people in ${d.country || 'that country'} give them.`,
    'Use corridor.roadsInOrder: suggest the vehicle people there actually use for each stretch (mass buses on main roads with many stops; shared taxis, tricycles or motorbikes on short feeder roads where they operate), and say where to board and get off using the stop or area names (startsNear, endsNear, stops, areasInOrder).',
    b ? `Boarding: the traveller starts on the ${b.originSide} of ${b.road} and vehicles heading ${b.heading} drive on the ${d.drivingSide}; ${b.crossToBoard ? 'tell them to cross to the other side first' : 'no need to cross'}.` : '',
    'For the last stretch, if the destination is little-known, give the driver a well-known landmark from destinationLandmarks to ask for.',
    'Only name transit lines that appear in transitLines. Keep it short, and note that stops and fares come from map data and may differ on the day.',
  ].filter(Boolean).join(' ');
}

async function getDirections(args, ctx) {
  const to = String(args.to || '').trim();
  if (!to) return { status: 'error', message: 'to is required' };
  const mode = ['driving', 'walking', 'cycling', 'transit'].includes(args.mode) ? args.mode : 'driving';
  let from = String(args.from || '').trim();
  const fromHere = !from || HERE_RE.test(from);
  // Routing from the person's position needs a precise fix (a Wi-Fi estimate can be off by a
  // kilometre and start the route on the wrong street). A named start only uses it as a bias.
  const here = await userPoint(ctx.taskState, { precise: fromHere }).catch(() => null);
  if (fromHere) {
    if (!here) return needLocation('the start of the route is unknown');
    from = { lat: here[1], lng: here[0], name: 'Your location' };
  }
  const d = await maps.directions({ from, to, mode, near: here || undefined, analyse: Boolean(args.analyse) });
  if (d.status !== 'success') return { status: 'not_found', success: false, message: d.message || 'No route was found.' };
  const r = d.route;
  const c = d.corridor;
  const title = `${d.from.name} to ${d.to.name}`;
  const summary = {
    distanceKm: km(r.distance),
    [mode === 'transit' ? 'vehicleMinutesWithoutTraffic' : 'minutes']: Math.round(r.duration / 60),
  };
  const result = {
    status: 'success',
    type: 'map-view',
    renderer: 'map-view',
    title,
    mode,
    from: brief(d.from),
    to: brief(d.to),
    country: d.country || undefined,
    drivingSide: d.drivingSide || undefined,
    ...summary,
    approximate: d.approximate?.length ? d.approximate : undefined,
    otherMatchesForDestination: d.alternatives?.to?.length ? d.alternatives.to.map(p => p.name) : undefined,
    steps: mode === 'transit' ? undefined : condenseSteps(r.steps),
    corridor: c ? {
      roadsInOrder: c.segments,
      areasInOrder: c.areasInOrder,
      majorStops: c.majorStops?.length ? c.majorStops : undefined,
      boarding: c.boarding || undefined,
      transitLines: c.transitLines,
      destinationLandmarks: c.destinationLandmarks,
    } : undefined,
    corridorError: d.corridorError,
    guidance: mode === 'transit' ? transitGuidance(d) : undefined,
    directions: {
      mode,
      distance: formatDistance(r.distance),
      duration: formatDuration(r.duration),
      steps: r.steps.filter(s => s.type !== 'arrive').map(s => ({ text: s.instruction, distance: s.distance >= 25 ? formatDistance(s.distance) : '', at: s.location })),
    },
    mapLayers: {
      route: r.geometry,
      dashed: mode === 'walking',
      stops: c?.stopsOnMap || [],
      markers: [
        { kind: 'start', lat: d.from.lat, lng: d.from.lng, title: d.from.name },
        { kind: 'end', lat: d.to.lat, lng: d.to.lng, title: d.to.name },
      ],
    },
    message: `${title}: ${formatDistance(r.distance)}, about ${formatDuration(r.duration)}${mode === 'transit' ? ' of riding time without traffic' : ''}. The map card shows the route${mode === 'transit' ? '' : ' and every turn'}; do not repeat the full turn list.`,
  };
  return result;
}

async function renderMap(args, ctx) {
  const list = Array.isArray(args.places) ? args.places : Array.isArray(args.markers) ? args.markers : [];
  if (!list.length) return { status: 'error', success: false, message: 'Give the places to show.' };
  const near = await userPoint(ctx.taskState).catch(() => null);
  const resolved = [];
  const missing = [];
  for (const p of list.slice(0, 25)) {
    const lat = Number(p.lat);
    const lng = Number(p.lng);
    if (isLngLat([lng, lat])) { resolved.push({ name: p.name, address: p.note || p.description || '', lat, lng }); continue; }
    const hit = (await maps.searchPlaces(p.name, { near: resolved.length ? [resolved.at(-1).lng, resolved.at(-1).lat] : near, limit: 1 }).catch(() => []))[0];
    if (hit) resolved.push({ name: p.name, address: p.note || hit.address || '', lat: hit.lat, lng: hit.lng });
    else missing.push(p.name);
  }
  if (!resolved.length) return { status: 'not_found', success: false, message: `None of these are on the map: ${missing.join(', ')}.` };
  const mode = ['driving', 'walking', 'cycling'].includes(args.route_mode) ? args.route_mode : null;
  let r = null;
  if (mode && resolved.length > 1) r = await maps.route(resolved.map(p => [p.lng, p.lat]), mode).catch(() => null);
  const title = args.title || resolved.map(p => p.name).slice(0, 3).join(', ');
  return {
    status: 'success',
    type: 'map-view',
    renderer: 'map-view',
    title,
    places: resolved.map(({ name, address, lat, lng }) => ({ name, address, lat, lng })),
    notFound: missing.length ? missing : undefined,
    distanceKm: r ? km(r.distance) : undefined,
    minutes: r ? Math.round(r.duration / 60) : undefined,
    mapLayers: r ? { route: r.geometry, dashed: mode === 'walking' } : undefined,
    message: `Showing ${resolved.length} place${resolved.length === 1 ? '' : 's'}${r ? ` joined by a ${formatDistance(r.distance)} ${mode} route` : ''}.${missing.length ? ` Not found: ${missing.join(', ')}.` : ''}`,
  };
}

export async function executeMapsTool(name, args = {}, ctx = {}) {
  try {
    switch (name) {
      case 'find_place': return await findPlace(args, ctx);
      case 'search_places_nearby': return await searchNearby(args, ctx);
      case 'get_directions': return await getDirections(args, ctx);
      case 'render_map': return await renderMap(args, ctx);
      default: return undefined;
    }
  } catch (err) {
    return failed(err);
  }
}
