/* ============================================================
   TOOLBOX — Map card for Assistant results

   A live map (route, stops, start/end, ranked places) with the
   route summary and turn list, or the list of places. The map
   loads only when the card scrolls into view. "Open in Maps"
   hands the same data to the Maps app.
   ============================================================ */

import { sanitizeUserFacingText } from '../../utils.js';
import { isLngLat } from './geo.js';

export const HANDOFF_KEY = 'toolbox.map.handoff';

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

const clean = (s) => sanitizeUserFacingText(String(s ?? '')).trim();
const MODE_LABEL = { driving: 'Drive', walking: 'Walk', cycling: 'Cycle', transit: 'Local transport' };

function placesOf(data) {
  const list = Array.isArray(data.places) && data.places.length ? data.places
    : Array.isArray(data.markers) ? data.markers : [];
  return list
    .map(p => ({ ...p, lat: Number(p.lat), lng: Number(p.lng) }))
    .filter(p => isLngLat([p.lng, p.lat]) && !(p.lat === 0 && p.lng === 0));
}

function mountMap(stage, data, places, onReady) {
  const layers = data.mapLayers || {};
  const start = async () => {
    try {
      const { createMap } = await import('./map-view.js');
      const view = await createMap(stage, { compact: true });
      const pts = [];
      if (Array.isArray(layers.route) && layers.route.length > 1) {
        view.setRoute(layers.route, { dashed: layers.dashed });
        pts.push(...layers.route);
      }
      if (layers.stops?.length) view.setStops(layers.stops);
      const markers = layers.markers?.length ? layers.markers
        : places.map((p, i) => ({ kind: 'place', lat: p.lat, lng: p.lng, label: i + 1, title: p.name }));
      const user = data.userLocation;
      if (user && isLngLat([user.lng, user.lat])) markers.push({ kind: 'here', lat: user.lat, lng: user.lng, title: 'You' });
      view.setMarkers(markers);
      pts.push(...markers.map(m => [m.lng, m.lat]));
      view.fit(pts, { padding: 36, animate: false });
      onReady(view);
    } catch {
      stage.className += ' is-failed';
      stage.textContent = 'The map could not load. The details below are still correct.';
    }
  };
  const io = new IntersectionObserver((entries) => {
    if (entries.some(e => e.isIntersecting)) { io.disconnect(); start(); }
  }, { rootMargin: '200px' });
  io.observe(stage);
}

export function renderMapCard(result, container) {
  const data = (result?.data && (result.data.places || result.data.markers || result.data.mapLayers)) ? result.data : (result || {});
  const places = placesOf(data);
  const dir = data.directions;

  const card = el('div', 'mpc');
  const head = el('div', 'mpc-head');
  const titles = el('div', 'mpc-titles');
  titles.appendChild(el('strong', 'mpc-title', clean(data.title || 'Map')));
  const sub = [];
  if (dir) sub.push(MODE_LABEL[dir.mode] || dir.mode, dir.distance, dir.mode === 'transit' ? `${dir.duration} riding` : dir.duration);
  else if (Number(data.distanceKm) > 0 && !places.some(p => p.distanceKm != null)) sub.push(`${data.distanceKm} km`);
  if (sub.filter(Boolean).length) titles.appendChild(el('span', 'mpc-sub', sub.filter(Boolean).join(' · ')));
  head.appendChild(titles);

  const open = el('button', 'mpc-open', 'Open in Maps');
  open.type = 'button';
  open.addEventListener('click', () => {
    try {
      sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({
        title: data.title, places, mapLayers: data.mapLayers, directions: dir, from: data.from, to: data.to, mode: data.mode, userLocation: data.userLocation,
      }));
    } catch { /* storage full or blocked: the app still opens */ }
    window.location.hash = '#interactive-map';
  });
  head.appendChild(open);
  card.appendChild(head);

  const stage = el('div', 'mpc-map');
  stage.role = 'img';
  stage.ariaLabel = `Map: ${clean(data.title || 'places')}`;
  card.appendChild(stage);

  let view = null;
  const fly = (lngLat) => view?.flyTo(lngLat, 16);

  if (dir?.steps?.length) {
    const box = el('details', 'mpc-steps');
    box.appendChild(el('summary', null, dir.mode === 'transit' ? `Route through ${dir.steps.length} roads and turns` : `${dir.steps.length} steps`));
    const ol = el('ol');
    dir.steps.forEach((s) => {
      const li = el('li');
      li.appendChild(el('span', null, clean(s.text)));
      if (s.distance) li.appendChild(el('span', 'mpc-dim', s.distance));
      if (Array.isArray(s.at)) li.addEventListener('click', () => fly(s.at));
      ol.appendChild(li);
    });
    box.appendChild(ol);
    card.appendChild(box);
  } else if (places.length) {
    const list = el('ol', 'mpc-places');
    places.forEach((p, i) => {
      const li = el('li');
      const top = el('div', 'mpc-row');
      top.appendChild(el('span', 'mpc-rank', String(i + 1)));
      top.appendChild(el('strong', null, clean(p.name || 'Place')));
      const dist = p.distanceKm != null && p.distanceKm !== '' ? `${p.distanceKm} km` : '';
      if (dist) top.appendChild(el('span', 'mpc-dim', dist));
      li.appendChild(top);
      const name = clean(p.name).toLowerCase();
      let addr = clean(p.address || p.description || '');
      if (addr.toLowerCase().startsWith(`${name},`)) addr = addr.slice(name.length + 1).trim();
      const info = [addr, clean(p.phone), clean(p.openingHours)].filter(Boolean).join(' · ');
      if (info) li.appendChild(el('div', 'mpc-info', info));
      li.addEventListener('click', () => fly([p.lng, p.lat]));
      list.appendChild(li);
    });
    card.appendChild(list);
  }

  const attribution = el('div', 'mpc-foot', 'Map data © OpenStreetMap contributors');
  card.appendChild(attribution);
  container.appendChild(card);

  // Browsers only: the map loads once the card scrolls into view.
  if (typeof IntersectionObserver === 'function' && (places.length || data.mapLayers)) {
    mountMap(stage, data, places, (v) => { view = v; });
  }
  return card;
}
