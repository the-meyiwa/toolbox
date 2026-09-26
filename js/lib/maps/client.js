/* ============================================================
   TOOLBOX — Maps API client (browser)
   Thin wrappers over /api/maps/* (server-maps.js) plus the
   device location. Every function throws a readable Error.
   ============================================================ */

async function call(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(path, {
    method,
    signal,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* not JSON */ }
  if (!res.ok && !(json && json.status === 'not_found')) {
    throw new Error(json?.error || json?.message || `The map service answered ${res.status}`);
  }
  return json || {};
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
export async function deviceLocation({ timeout = 8000, maxAge = 120_000 } = {}) {
  if (lastFix && Date.now() - lastFix.at < maxAge) return lastFix.pos;
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  try {
    const p = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout, maximumAge: maxAge }));
    const pos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy || 0) };
    lastFix = { at: Date.now(), pos };
    return pos;
  } catch {
    return null;
  }
}
