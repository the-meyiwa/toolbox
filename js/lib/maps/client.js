/* ============================================================
   TOOLBOX — Maps API client (browser)
   Thin wrappers over /api/maps/* (server-maps.js) plus the
   device location. Every function throws a readable Error.
   ============================================================ */

// The server gives up on slow map services well before this. The margin covers the API
// waking from sleep on its host; past it the request is treated as lost, so nothing spins
// forever.
const CLIENT_TIMEOUT_MS = 60_000;

async function call(path, { method = 'GET', body, signal } = {}) {
  const limit = AbortSignal.timeout(CLIENT_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(path, {
      method,
      signal: signal ? AbortSignal.any([signal, limit]) : limit,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (limit.aborted && !signal?.aborted) throw new Error('The map service took too long to answer. Try again in a moment.');
    throw err;
  }
  let json = null;
  try { json = await res.json(); } catch { /* not JSON */ }
  // Anything but JSON means the request never reached the maps API (for example a server
  // still running an older build answers with an HTML page). That is a failure, never
  // "nothing found".
  if (!json || typeof json !== 'object') {
    throw new Error('The maps service is not available on the server right now');
  }
  if (!res.ok && json.status !== 'not_found') {
    throw new Error(json?.error || json?.message || `The map service answered ${res.status}`);
  }
  return json;
}

const qs = (o) => Object.entries(o)
  .filter(([, v]) => v !== undefined && v !== null && v !== '' && !Number.isNaN(v))
  .map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

export async function searchPlaces(q, { near, limit, signal } = {}) {
  const j = await call(`/api/maps/search?${qs({ q, limit, lat: near?.[1], lng: near?.[0] })}`, { signal });
  return j.places || [];
}

export async function reverse([lng, lat], { signal } = {}) {
  return (await call(`/api/maps/reverse?${qs({ lat, lng })}`, { signal })).place;
}

export async function nearby({ q, category, near, radius, limit, signal }) {
  return call(`/api/maps/nearby?${qs({ q, category, lat: near[1], lng: near[0], radius, limit })}`, { signal });
}

export async function route(points, mode = 'driving', { signal } = {}) {
  const pts = points.map(p => `${p[0]},${p[1]}`).join(';');
  return (await call(`/api/maps/route?${qs({ points: pts, mode })}`, { signal })).route;
}

/** from/to: text or { lat, lng, name }. near: [lng, lat] to bias place search. */
export async function directions({ from, to, mode = 'driving', near, analyse = false, signal }) {
  return call('/api/maps/directions', { method: 'POST', body: { from, to, mode, near, analyse }, signal });
}

let lastFix = null;
/** The device position as { lat, lng, accuracy }, or null if unavailable or refused. */
export async function deviceLocation({ timeout = 8000, maxAge = 120_000, precise = false } = {}) {
  if (lastFix && Date.now() - lastFix.at < maxAge && (!precise || lastFix.pos.accuracy <= 100)) return lastFix.pos;
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  const ask = (opts, ms) => new Promise((resolve, reject) => {
    // The browser's own timeout does not run while its permission prompt is open, so an
    // unanswered prompt would otherwise leave the caller waiting forever.
    const guard = setTimeout(() => reject(new Error('Location timed out')), ms + 7000);
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(guard); resolve(pos); },
      (err) => { clearTimeout(guard); reject(err); },
      { ...opts, timeout: ms },
    );
  });
  try {
    // A network (Wi-Fi/cell) fix arrives in a fraction of a second and is accurate enough for
    // routes and "nearest"; waiting for GPS took seconds on laptops. Precise only when asked,
    // or when the quick fix is too rough to be useful.
    let p = precise ? null : await ask({ enableHighAccuracy: false, maximumAge: maxAge }, Math.min(timeout, 4000)).catch(() => null);
    if (!p || (p.coords.accuracy || 0) > 2000) p = await ask({ enableHighAccuracy: true, maximumAge: maxAge }, timeout).catch(() => p);
    if (!p) throw new Error('No position');
    const pos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy || 0) };
    lastFix = { at: Date.now(), pos };
    return pos;
  } catch {
    return null;
  }
}
