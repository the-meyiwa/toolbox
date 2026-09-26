/* ============================================================
   TOOLBOX — Map view (MapLibre GL + OpenFreeMap vector tiles)

   One small wrapper used by the Maps app and by the maps the
   Assistant draws in chat. MapLibre loads on first use. Tiles
   come from OpenFreeMap (no key); if that style cannot load,
   the map falls back to the standard OpenStreetMap raster tiles.
   The map follows the app theme (positron light, dark dark).
   ============================================================ */

import { bounds, isLngLat } from './geo.js';

let libPromise;
export function loadMapLibre() {
  libPromise ||= Promise.all([
    import('maplibre-gl'),
    import('maplibre-gl/dist/maplibre-gl.css').catch(() => null),
  ]).then(([m]) => m.default || m).catch((err) => { libPromise = null; throw err; });
  return libPromise;
}

const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};
const RASTER = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

export const currentTheme = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

const css = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

// MapLibre positions a marker with an inline transform on the element it is given, so the
// visible shape (which may be rotated into a pin) sits inside that element.
function markerEl(kind, label) {
  const el = document.createElement('div');
  el.className = `mpv-marker mpv-marker--${kind}`;
  const shape = document.createElement('div');
  shape.className = 'mpv-shape';
  if (label != null && label !== '') {
    const b = document.createElement('span');
    b.textContent = String(label);
    shape.appendChild(b);
  }
  el.appendChild(shape);
  return el;
}

export class MapView {
  constructor(map, lib) {
    this.map = map;
    this.lib = lib;
    this.markers = [];
    this.data = { route: null, stops: null, alt: null };
    // Custom layers go when the style changes (theme switch, raster fallback); put them back.
    map.on('style.load', () => this.#applyLayers());
    this.#watchTheme();
  }

  #watchTheme() {
    if (typeof MutationObserver === 'undefined') return;
    this.themeObserver = new MutationObserver(() => {
      const t = currentTheme();
      if (t !== this.theme && !this.raster) {
        this.theme = t;
        this.map.setStyle(STYLES[t]);
      }
    });
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  #applyLayers() {
    const m = this.map;
    const ink = css('--ink', '#0a0a0a');
    const surface = css('--surface', '#ffffff');
    const set = (id, data) => {
      const src = m.getSource(id);
      const fc = { type: 'FeatureCollection', features: data || [] };
      if (src) src.setData(fc);
      else m.addSource(id, { type: 'geojson', data: fc });
    };
    set('mpv-route', this.data.route);
    set('mpv-alt', this.data.alt);
    set('mpv-stops', this.data.stops);
    const add = (layer) => { if (!m.getLayer(layer.id)) m.addLayer(layer); };
    add({ id: 'mpv-alt-line', type: 'line', source: 'mpv-alt', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ink, 'line-opacity': 0.25, 'line-width': 5 } });
    add({ id: 'mpv-route-casing', type: 'line', source: 'mpv-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': surface, 'line-width': 9 } });
    add({
      id: 'mpv-route-line', type: 'line', source: 'mpv-route', layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ink, 'line-width': 5, 'line-dasharray': ['case', ['==', ['get', 'dashed'], true], ['literal', [0.4, 1.6]], ['literal', [1, 0]]] },
    });
    add({ id: 'mpv-stops-dot', type: 'circle', source: 'mpv-stops', minzoom: 11, paint: { 'circle-radius': 3.5, 'circle-color': surface, 'circle-stroke-color': ink, 'circle-stroke-width': 1.5 } });
    add({
      id: 'mpv-stops-label', type: 'symbol', source: 'mpv-stops', minzoom: 14,
      layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true },
      paint: { 'text-color': ink, 'text-halo-color': surface, 'text-halo-width': 1.5 },
    });
  }

  #refresh() {
    // isStyleLoaded() is also false while a source is updating, so just try: before the
    // first style has loaded this throws, and 'style.load' applies the data instead.
    try { this.#applyLayers(); } catch { /* applied on style.load */ }
  }

  /** Draws a route line. geometry is [[lng, lat], ...]; dashed for walking. */
  setRoute(geometry, { dashed = false } = {}) {
    this.data.route = Array.isArray(geometry) && geometry.length > 1
      ? [{ type: 'Feature', properties: { dashed }, geometry: { type: 'LineString', coordinates: geometry } }]
      : null;
    this.#refresh();
  }

  setStops(stops) {
    this.data.stops = (stops || []).filter(s => isLngLat([s.lng, s.lat])).map(s => ({
      type: 'Feature', properties: { name: s.name || '' }, geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
    }));
    this.#refresh();
  }

  /** Markers: [{ lng, lat, kind: 'start'|'end'|'place'|'here', label, title, onClick }]. */
  setMarkers(list) {
    this.markers.forEach(m => m.remove());
    this.markers = (list || []).filter(p => isLngLat([p.lng, p.lat])).map(p => {
      const el = markerEl(p.kind || 'place', p.label);
      if (p.title) el.title = p.title;
      if (p.onClick) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', (e) => { e.stopPropagation(); p.onClick(p); });
      }
      return new this.lib.Marker({ element: el, anchor: p.kind === 'place' || p.kind === 'end' ? 'bottom' : 'center' })
        .setLngLat([p.lng, p.lat])
        .addTo(this.map);
    });
  }

  fit(points, { padding = 48, maxZoom = 16, animate = true } = {}) {
    const b = bounds(points);
    if (!b) return;
    if (b[0][0] === b[1][0] && b[0][1] === b[1][1]) {
      this.map.jumpTo({ center: b[0], zoom: Math.min(maxZoom, 15) });
      return;
    }
    this.map.fitBounds(b, { padding, maxZoom, animate, duration: animate ? 600 : 0 });
  }

  flyTo(lngLat, zoom = 16) {
    if (isLngLat(lngLat)) this.map.flyTo({ center: lngLat, zoom, duration: 700 });
  }

  resize() { this.map.resize(); }

  destroy() {
    this.themeObserver?.disconnect();
    this.markers.forEach(m => m.remove());
    this.map.remove();
  }
}

/**
 * Creates a map in `container`. Options: center [lng, lat], zoom, compact (chat cards:
 * two-finger/ctrl scroll, no zoom buttons), interactive.
 */
export async function createMap(container, { center = [0, 20], zoom = 1.6, compact = false, interactive = true } = {}) {
  const lib = await loadMapLibre();
  const theme = currentTheme();
  const map = new lib.Map({
    container,
    style: STYLES[theme],
    center,
    zoom,
    interactive,
    cooperativeGestures: compact,
    attributionControl: { compact: true },
    dragRotate: !compact,
    pitchWithRotate: false,
  });
  const view = new MapView(map, lib);
  view.theme = theme;
  map.on('error', (e) => {
    const msg = String(e?.error?.message || '');
    if (!view.raster && !map.isStyleLoaded() && /style|openfreemap|Failed to fetch|NetworkError|404/i.test(msg)) {
      view.raster = true;
      map.setStyle(RASTER);
    }
  });
  if (interactive && !compact) {
    map.addControl(new lib.NavigationControl({ visualizePitch: false }), 'bottom-right');
  }
  map.addControl(new lib.ScaleControl({ unit: 'metric' }), 'bottom-left');
  // Usable at once: markers and camera moves work before the style arrives, and route
  // layers are added on 'style.load'.
  return view;
}
