/* ============================================================
   TOOLBOX — Geometry helpers for Maps (browser and server)

   Pure functions over [lng, lat] coordinates: distances,
   bearings, projecting a point onto a route line (how far along
   the route it sits and how far off it), which side of the road
   a point is on, and polyline simplification.
   ============================================================ */

const R = 6371008.8; // mean Earth radius, metres
const rad = (d) => d * Math.PI / 180;

export function isLngLat(p) {
  return Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;
}

/** Great-circle distance in metres between two [lng, lat] points. */
export function distanceM(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b, degrees clockwise from north. */
export function bearing(a, b) {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
export const compass = (deg) => COMPASS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];

// Local flat projection around a reference latitude, in metres. Accurate enough for the
// few-kilometre spans used when snapping points to a route.
function flat(ref) {
  const kx = Math.cos(rad(ref)) * R * Math.PI / 180;
  const ky = R * Math.PI / 180;
  return (p) => [p[0] * kx, p[1] * ky];
}

/** Total length of a line in metres. */
export function lineLength(line) {
  let d = 0;
  for (let i = 1; i < line.length; i++) d += distanceM(line[i - 1], line[i]);
  return d;
}

/**
 * Where a point sits relative to a line: `along` metres from the start of the line to the
 * closest point, `offset` metres away from the line, `side` -1 left / +1 right of the
 * direction of travel, and the segment index.
 */
export function projectOnLine(line, p) {
  if (!Array.isArray(line) || line.length < 2 || !isLngLat(p)) return null;
  const toXY = flat(p[1]);
  const P = toXY(p);
  let best = null;
  let run = 0;
  for (let i = 1; i < line.length; i++) {
    const A = toXY(line[i - 1]);
    const B = toXY(line[i]);
    const dx = B[0] - A[0];
    const dy = B[1] - A[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((P[0] - A[0]) * dx + (P[1] - A[1]) * dy) / len2)) : 0;
    const cx = A[0] + t * dx;
    const cy = A[1] + t * dy;
    const offset = Math.hypot(P[0] - cx, P[1] - cy);
    const segLen = Math.sqrt(len2);
    if (!best || offset < best.offset) {
      const cross = dx * (P[1] - A[1]) - dy * (P[0] - A[0]);
      best = { along: run + t * segLen, offset, side: cross > 0 ? -1 : 1, index: i - 1 };
    }
    run += segLen;
  }
  return best;
}

/** Douglas-Peucker simplification with a tolerance in metres. */
export function simplify(line, toleranceM = 8) {
  if (!Array.isArray(line) || line.length < 3) return line || [];
  const toXY = flat(line[0][1]);
  const pts = line.map(toXY);
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  const stack = [[0, line.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    const [ax, ay] = pts[s];
    const [bx, by] = pts[e];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let max = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len;
      if (d > max) { max = d; idx = i; }
    }
    if (max > toleranceM && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return line.filter((_, i) => keep[i]);
}

/** The point `m` metres along a line, and the travel bearing there. */
export function pointAlong(line, m) {
  let run = 0;
  for (let i = 1; i < line.length; i++) {
    const seg = distanceM(line[i - 1], line[i]);
    if (run + seg >= m || i === line.length - 1) {
      const t = seg ? Math.max(0, Math.min(1, (m - run) / seg)) : 0;
      const a = line[i - 1];
      const b = line[i];
      return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], bearing: bearing(a, b) };
    }
    run += seg;
  }
  return { point: line[line.length - 1], bearing: 0 };
}

/** [[west, south], [east, north]] around the given points. */
export function bounds(points) {
  const ok = points.filter(isLngLat);
  if (!ok.length) return null;
  let w = 180; let s = 90; let e = -180; let n = -90;
  for (const [x, y] of ok) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
  return [[w, s], [e, n]];
}

export function formatDistance(m) {
  if (!Number.isFinite(m)) return '';
  if (m < 950) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(m < 9500 ? 1 : 0)} km`;
}

export function formatDuration(s) {
  if (!Number.isFinite(s)) return '';
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h${min % 60 ? ` ${min % 60} min` : ''}`;
}

/** Parses "6.59, 3.38" (lat, lng) into [lng, lat]. */
export function parseLatLng(text) {
  const m = String(text || '').trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const p = [Number(m[2]), Number(m[1])];
  return isLngLat(p) ? p : null;
}
