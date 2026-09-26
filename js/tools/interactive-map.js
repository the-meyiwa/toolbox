/* ============================================================
   TOOLBOX — Maps

   One window: a side panel (search, place, directions) beside a
   live vector map. Search suggests as you type, chips find
   nearby places, right-click the map for "directions from/to
   here" and "what's here". Directions cover driving, walking,
   cycling and local transport; the transport view lists the
   roads in order with their stops and areas, which side of the
   road to board on, and landmarks near the destination.
   Data: OpenStreetMap via /api/maps/* (server-maps.js).
   ============================================================ */

import * as api from '../lib/maps/client.js';
import { createMap } from '../lib/maps/map-view.js';
import { HANDOFF_KEY } from '../lib/maps/map-card.js';
import { formatDistance, formatDuration, isLngLat } from '../lib/maps/geo.js';
import { openContextMenu } from '../lib/context-menu.js';
import { askAssistant, ASK_ICON } from '../lib/ask-assistant.js';

const ICON = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  locate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 1v3M12 20v3M1 12h3M20 12h3"/></svg>',
  route: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8.5a3.5 3.5 0 0 0 0-7h-9a3.5 3.5 0 0 1 0-7H16"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16M3 8l4-4 4 4M17 20V4M21 16l-4 4-4-4"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-6.1 7-12a7 7 0 0 0-14 0c0 5.9 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
};

const MODES = [
  ['driving', 'Drive'],
  ['transit', 'Transport'],
  ['walking', 'Walk'],
  ['cycling', 'Cycle'],
];

const CHIPS = ['Fuel', 'Food', 'Pharmacy', 'ATM', 'Supermarket', 'Hospital', 'Bus stop', 'Hotel'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtCoord = (p) => `${p[1].toFixed(5)}, ${p[0].toFixed(5)}`;

/** Suggest-as-you-type on an input. onPick receives a place { name, address, lat, lng }. */
function autocomplete(input, list, { near, onPick, onSubmit }) {
  let timer = 0;
  let ctrl = null;
  let items = [];
  let active = -1;
  const close = () => { list.hidden = true; active = -1; };
  const paint = () => {
    list.innerHTML = items.map((p, i) => `
      <li role="option" data-i="${i}" class="${i === active ? 'is-active' : ''}" aria-selected="${i === active}">
        ${ICON.pin}<span><b>${esc(p.name)}</b><small>${esc(p.address || p.kind || '')}</small></span>
      </li>`).join('');
    list.hidden = !items.length;
  };
  const pick = (i) => {
    const p = items[i];
    if (!p) return;
    input.value = p.name;
    close();
    onPick(p);
  };
  const run = async () => {
    const q = input.value.trim();
    if (q.length < 2) { items = []; paint(); return; }
    ctrl?.abort();
    ctrl = new AbortController();
    try {
      items = await api.searchPlaces(q, { near: near(), limit: 6, signal: ctrl.signal });
      active = -1;
      paint();
    } catch (err) {
      if (err.name !== 'AbortError') { items = []; paint(); }
    }
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 280); });
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return;
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      paint();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(timer);
      if (active >= 0 && !list.hidden) { pick(active); return; }
      // Enter on typed text: the caller resolves the text itself ("X at Y" and all).
      const q = input.value.trim();
      close();
      if (q) onSubmit ? onSubmit(q) : (await run(), pick(0));
    } else if (e.key === 'Escape' && !list.hidden) {
      e.stopPropagation();
      close();
    }
  });
  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li[data-i]');
    if (li) { e.preventDefault(); pick(Number(li.dataset.i)); }
  });
  input.addEventListener('blur', () => setTimeout(close, 120));
  return { close, isOpen: () => !list.hidden };
}

export default {
  async render(container) {
    container.innerHTML = `
      <div class="mp" data-panel="browse" data-busy="false">
        <aside class="mp-panel" aria-label="Maps panel">
          <section class="mp-browse">
            <div class="mp-search">
              ${ICON.search}
              <input type="search" id="mp-q" placeholder="Search places and addresses" autocomplete="off" aria-label="Search places" aria-autocomplete="list" aria-controls="mp-q-list">
              <kbd>/</kbd>
              <ul class="mp-suggest" id="mp-q-list" role="listbox" hidden></ul>
            </div>
            <button type="button" class="mp-btn mp-btn--ink" data-act="directions">${ICON.route}<span>Directions</span></button>
            <div class="mp-chips" role="group" aria-label="Find nearby">
              ${CHIPS.map(c => `<button type="button" class="mp-chip" data-chip="${esc(c)}">${esc(c)}</button>`).join('')}
            </div>
            <div class="mp-list" aria-live="polite"></div>
          </section>

          <section class="mp-place" hidden></section>

          <section class="mp-dir" hidden>
            <div class="mp-dir-head">
              <button type="button" class="mp-icon" data-act="back" title="Back">${ICON.back}</button>
              <div class="mp-seg" role="radiogroup" aria-label="Travel mode">
                ${MODES.map(([m, l]) => `<button type="button" role="radio" data-mode="${m}" aria-checked="${m === 'driving'}">${l}</button>`).join('')}
              </div>
            </div>
            <div class="mp-ends">
              <div class="mp-end"><span class="mp-dot mp-dot--start"></span><input id="mp-from" placeholder="Start (your location)" autocomplete="off" aria-label="Start"><ul class="mp-suggest" role="listbox" hidden></ul></div>
              <div class="mp-end"><span class="mp-dot mp-dot--end"></span><input id="mp-to" placeholder="Destination" autocomplete="off" aria-label="Destination"><ul class="mp-suggest" role="listbox" hidden></ul></div>
              <button type="button" class="mp-icon mp-swap" data-act="swap" title="Swap start and destination">${ICON.swap}</button>
            </div>
            <div class="mp-dir-body" aria-live="polite"></div>
          </section>
        </aside>
        <div class="mp-stage">
          <div class="mp-map"></div>
          <button type="button" class="mp-fab" data-act="locate" title="Show my location">${ICON.locate}</button>
          <div class="mp-toast" role="status" hidden></div>
        </div>
      </div>`;

    const root = container.querySelector('.mp');
    const $ = (s) => root.querySelector(s);
    const mapEl = $('.mp-map');
    const listEl = $('.mp-list');
    const placeEl = $('.mp-place');
    const dirBody = $('.mp-dir-body');
    const fromIn = $('#mp-from');
    const toIn = $('#mp-to');
    const qIn = $('#mp-q');
    const toastEl = $('.mp-toast');

    const state = {
      me: null,
      mode: 'driving',
      from: null, // { name, lng, lat } — null means "my location"
      to: null,
      results: [],
      place: null,
      routeCtrl: null,
    };

    let toastTimer = 0;
    const toast = (msg) => {
      toastEl.textContent = msg;
      toastEl.hidden = !msg;
      clearTimeout(toastTimer);
      if (msg) toastTimer = setTimeout(() => { toastEl.hidden = true; }, 4200);
    };

    let view;
    const panel = $('.mp-panel');
    panel.inert = true; // until MapLibre has loaded
    try {
      view = await createMap(mapEl, { center: [0, 20], zoom: 1.6 });
      panel.inert = false;
    } catch {
      mapEl.innerHTML = '<div class="mp-fail">The map could not load. Check your connection, or any extension blocking it, and reopen Maps.</div>';
      return;
    }
    this._view = view;
    const center = () => { const c = view.map.getCenter(); return [c.lng, c.lat]; };
    const near = () => (state.me ? [state.me.lng, state.me.lat] : center());

    const setPanel = (name) => {
      root.dataset.panel = name;
      $('.mp-browse').hidden = name !== 'browse';
      placeEl.hidden = name !== 'place';
      $('.mp-dir').hidden = name !== 'directions';
    };

    const hereMarker = () => (state.me ? [{ kind: 'here', lng: state.me.lng, lat: state.me.lat, title: 'You are here' }] : []);

    /* ---------- browse: search results and nearby ---------- */

    const showResults = (places, heading) => {
      state.results = places;
      view.setRoute(null);
      view.setStops([]);
      view.setMarkers([...hereMarker(), ...places.map((p, i) => ({ kind: 'place', lng: p.lng, lat: p.lat, label: i + 1, title: p.name, onClick: () => showPlace(p) }))]);
      if (places.length) view.fit(places.map(p => [p.lng, p.lat]).concat(state.me ? [[state.me.lng, state.me.lat]] : []), { padding: 60 });
      listEl.innerHTML = places.length ? `
        <h3>${esc(heading)}</h3>
        <ol>${places.map((p, i) => `
          <li><button type="button" data-i="${i}">
            <span class="mp-rank">${i + 1}</span>
            <span class="mp-li-main"><b>${esc(p.name)}</b><small>${esc([p.kind, p.address].filter(Boolean).join(' · '))}</small></span>
            ${Number.isFinite(p.distanceM) ? `<span class="mp-dim">${formatDistance(p.distanceM)}</span>` : ''}
          </button></li>`).join('')}
        </ol>` : `<p class="mp-empty">${esc(heading)}</p>`;
    };
    listEl.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]');
      if (b) showPlace(state.results[Number(b.dataset.i)]);
    });

    const findNearby = async (label) => {
      root.dataset.busy = 'true';
      const at = near();
      try {
        const res = await api.nearby({ q: '', category: label, near: at, limit: 15 });
        const places = res.places || [];
        showResults(places, places.length ? `${label} nearby` : `No ${label.toLowerCase()} is mapped within ${formatDistance(res.radius)}.`);
      } catch (err) {
        toast(`Nearby search failed: ${err.message}`);
      } finally {
        root.dataset.busy = 'false';
      }
    };
    root.querySelectorAll('[data-chip]').forEach(b => b.addEventListener('click', () => { setPanel('browse'); findNearby(b.dataset.chip); }));

    autocomplete(qIn, $('#mp-q-list'), {
      near,
      onPick: (p) => showPlace(p),
      onSubmit: async (q) => {
        root.dataset.busy = 'true';
        try {
          const found = await api.searchPlaces(q, { near: near(), limit: 8 });
          if (found.length === 1) showPlace(found[0]);
          else showResults(found, found.length ? `Results for "${q}"` : `Nothing on the map matches "${q}".`);
        } catch (err) {
          toast(`Search failed: ${err.message}`);
        } finally {
          root.dataset.busy = 'false';
        }
      },
    });

    /* ---------- place ---------- */

    const showPlace = (p) => {
      if (!p) return;
      state.place = p;
      const pt = [p.lng, p.lat];
      placeEl.innerHTML = `
        <div class="mp-place-head">
          <button type="button" class="mp-icon" data-act="back" title="Back">${ICON.back}</button>
          <div><h2>${esc(p.name)}</h2><p class="mp-dim">${esc(p.kind || '')}</p></div>
        </div>
        ${p.address ? `<p class="mp-addr">${esc(p.address)}</p>` : ''}
        <dl class="mp-facts">
          ${p.phone ? `<dt>Phone</dt><dd><a href="tel:${esc(p.phone)}">${esc(p.phone)}</a></dd>` : ''}
          ${p.openingHours ? `<dt>Hours</dt><dd>${esc(p.openingHours)}</dd>` : ''}
          ${p.website ? `<dt>Website</dt><dd><a href="${esc(/^https?:/i.test(p.website) ? p.website : `https://${p.website}`)}" target="_blank" rel="noopener">${esc(p.website.replace(/^https?:\/\//, ''))}</a></dd>` : ''}
          <dt>Coordinates</dt><dd><button type="button" class="mp-link" data-act="copy">${fmtCoord(pt)} ${ICON.copy}</button></dd>
        </dl>
        <div class="mp-actions">
          <button type="button" class="mp-btn mp-btn--ink" data-act="to-here">${ICON.route}<span>Directions</span></button>
          <button type="button" class="mp-btn" data-act="from-here"><span>Start here</span></button>
        </div>
        <div class="mp-chips">${CHIPS.slice(0, 5).map(c => `<button type="button" class="mp-chip" data-near-chip="${esc(c)}">${esc(c)} nearby</button>`).join('')}</div>`;
      setPanel('place');
      view.setRoute(null);
      view.setStops([]);
      view.setMarkers([...hereMarker(), { kind: 'end', lng: p.lng, lat: p.lat, title: p.name }]);
      view.flyTo(pt, Math.max(view.map.getZoom(), 15));
    };
    placeEl.addEventListener('click', async (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      const chip = e.target.closest('[data-near-chip]')?.dataset.nearChip;
      const p = state.place;
      if (chip && p) {
        setPanel('browse');
        view.map.jumpTo({ center: [p.lng, p.lat] });
        const saved = state.me;
        state.me = null; // search around the place, not the person
        await findNearby(chip);
        state.me = saved;
        return;
      }
      if (!p) return;
      if (act === 'copy') {
        try { await navigator.clipboard.writeText(fmtCoord([p.lng, p.lat])); toast('Coordinates copied'); } catch { toast(fmtCoord([p.lng, p.lat])); }
      } else if (act === 'to-here') {
        openDirections({ to: p });
      } else if (act === 'from-here') {
        openDirections({ from: p });
      }
    });

    /* ---------- directions ---------- */

    const endLabel = (p) => (p ? p.name : '');
    const openDirections = ({ from, to } = {}) => {
      if (from !== undefined) state.from = from;
      if (to !== undefined) state.to = to;
      fromIn.value = endLabel(state.from);
      toIn.value = endLabel(state.to);
      setPanel('directions');
      if (state.to) planRoute();
      else toIn.focus();
    };

    const [fromList, toList] = root.querySelectorAll('.mp-end .mp-suggest');
    // Typed text goes to the server as is, which understands "business at street".
    autocomplete(fromIn, fromList, { near, onPick: (p) => { state.from = p; planRoute(); }, onSubmit: (q) => { state.from = { name: q, query: q }; planRoute(); } });
    autocomplete(toIn, toList, { near, onPick: (p) => { state.to = p; planRoute(); }, onSubmit: (q) => { state.to = { name: q, query: q }; planRoute(); } });
    fromIn.addEventListener('change', () => { if (!fromIn.value.trim()) { state.from = null; planRoute(); } });

    root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
      state.mode = b.dataset.mode;
      root.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-checked', String(x === b)));
      planRoute();
    }));

    const endPayload = (p) => (p ? (p.query ? p.query : { lat: p.lat, lng: p.lng, name: p.name }) : null);

    const planRoute = async () => {
      if (!state.to) return;
      let from = endPayload(state.from);
      if (!from) {
        const me = state.me || await api.deviceLocation();
        if (!me) { dirBody.innerHTML = '<p class="mp-empty">Turn on location, or type a start.</p>'; fromIn.focus(); return; }
        state.me = me;
        from = { lat: me.lat, lng: me.lng, name: 'Your location' };
      }
      state.routeCtrl?.abort();
      const ctrl = new AbortController();
      state.routeCtrl = ctrl;
      root.dataset.busy = 'true';
      dirBody.innerHTML = '<p class="mp-empty">Finding the best route…</p>';
      try {
        const d = await api.directions({ from, to: endPayload(state.to), mode: state.mode, signal: ctrl.signal });
        if (ctrl.signal.aborted) return;
        if (d.status !== 'success') { dirBody.innerHTML = `<p class="mp-empty">${esc(d.message || 'No route found.')}</p>`; return; }
        if (state.to?.query) { state.to = d.to; toIn.value = d.to.name; }
        if (state.from?.query) { state.from = d.from; fromIn.value = d.from.name; }
        drawDirections(d);
      } catch (err) {
        if (err.name !== 'AbortError') dirBody.innerHTML = `<p class="mp-empty">${esc(err.message)}</p>`;
      } finally {
        if (state.routeCtrl === ctrl) root.dataset.busy = 'false';
      }
    };

    const drawDirections = (d) => {
      const r = d.route;
      const c = d.corridor;
      view.setRoute(r.geometry, { dashed: d.mode === 'walking' });
      view.setStops(c?.stopsOnMap || []);
      view.setMarkers([
        { kind: 'start', lng: d.from.lng, lat: d.from.lat, title: d.from.name },
        { kind: 'end', lng: d.to.lng, lat: d.to.lat, title: d.to.name },
      ]);
      view.fit(r.geometry, { padding: 70 });
      const steps = r.steps.filter(s => s.type !== 'arrive');
      const head = `
        <div class="mp-sum">
          <strong>${formatDuration(r.duration)}</strong>
          <span>${formatDistance(r.distance)}${d.mode === 'transit' ? ' · riding time without traffic' : ''}</span>
        </div>
        ${(d.approximate || []).map(a => `<p class="mp-note">${esc(a)}</p>`).join('')}`;
      let body = '';
      if (d.mode === 'transit') {
        body = transitHtml(d);
      }
      body += `
        <details class="mp-steps" ${d.mode === 'transit' ? '' : 'open'}>
          <summary>${d.mode === 'transit' ? 'Road-by-road route' : `${steps.length} steps`}</summary>
          <ol>${steps.map((s, i) => `<li><button type="button" data-step="${i}"><span>${esc(s.instruction)}</span><span class="mp-dim">${s.distance >= 25 ? formatDistance(s.distance) : ''}</span></button></li>`).join('')}</ol>
        </details>`;
      dirBody.innerHTML = head + body;
      dirBody.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => view.flyTo(steps[Number(b.dataset.step)].location, 17)));
      dirBody.querySelector('[data-act="ask"]')?.addEventListener('click', () => askAboutRoute(d));
    };

    const transitHtml = (d) => {
      const c = d.corridor;
      if (!c) return `<p class="mp-note">${esc(d.corridorError || 'Stops along this route could not be loaded.')}</p>`;
      const b = c.boarding;
      const board = b ? `<p class="mp-note">${b.crossToBoard
        ? `You start on the ${esc(b.originSide)} of ${esc(b.road)}. Vehicles heading ${esc(b.heading)} stop on the ${esc(d.drivingSide)}, so cross over to board.`
        : `Board on your side of ${esc(b.road)}, heading ${esc(b.heading)}.`}${b.firstStop ? ` Nearest stop: ${esc(b.firstStop.name)}.` : ''}</p>` : '';
      const lines = c.transitLines?.direct?.length ? `<p class="mp-note">Lines serving both ends: ${esc(c.transitLines.direct.join(', '))}</p>` : '';
      const segs = c.segments.map(s => `
        <li>
          <b>${esc(s.road)}</b> <span class="mp-dim">${s.km} km${s.stopCount ? ` · ${s.stopCount} stop${s.stopCount === 1 ? '' : 's'}` : ''}</span>
          ${s.stops.length ? `<small>Stops: ${esc(s.stops.join(', '))}</small>` : ''}
          ${s.areas.length ? `<small>Through ${esc(s.areas.join(', '))}</small>` : ''}
          ${s.endsNear ? `<small>Ends near ${esc(s.endsNear)}</small>` : ''}
        </li>`).join('');
      const marks = c.destinationLandmarks?.length
        ? `<h4>Landmarks near the destination</h4><ul class="mp-marks">${c.destinationLandmarks.map(l => `<li><b>${esc(l.name)}</b> <span class="mp-dim">${esc(l.kind)} · ${formatDistance(l.m)} ${esc(l.dir)}</span></li>`).join('')}</ul>`
        : '';
      return `${board}${lines}<h4>Roads in order</h4><ol class="mp-segs">${segs}</ol>${marks}
        <button type="button" class="mp-btn" data-act="ask">${ASK_ICON}<span>Ask Assistant for local directions</span></button>`;
    };

    const askAboutRoute = (d) => {
      const summary = {
        from: d.from.name, to: d.to.name, country: d.country, drivingSide: d.drivingSide,
        distance: formatDistance(d.route.distance), roads: d.corridor?.segments, areas: d.corridor?.areasInOrder,
        boarding: d.corridor?.boarding, lines: d.corridor?.transitLines, landmarks: d.corridor?.destinationLandmarks,
      };
      askAssistant({
        name: 'route.json',
        text: JSON.stringify(summary, null, 2),
        type: 'application/json',
        prompt: `How do I get from ${d.from.name} to ${d.to.name} by local transport? Use the attached route data.`,
      });
    };

    /* ---------- panel buttons, map menu, keys ---------- */

    root.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'directions') openDirections({ to: state.place || state.to || null });
      else if (act === 'back') { setPanel('browse'); view.setRoute(null); view.setStops([]); view.setMarkers(hereMarker()); }
      else if (act === 'swap') {
        [state.from, state.to] = [state.to, state.from];
        fromIn.value = endLabel(state.from);
        toIn.value = endLabel(state.to);
        if (!state.to && state.from === null) return;
        if (!state.to) { toIn.focus(); return; }
        planRoute();
      } else if (act === 'locate') locate();
    });

    const locate = async () => {
      root.dataset.busy = 'true';
      const me = await api.deviceLocation({ maxAge: 0 });
      root.dataset.busy = 'false';
      if (!me) { toast('Location is off or was refused. Allow it in your browser to use this.'); return; }
      state.me = me;
      view.setMarkers([...hereMarker()]);
      view.flyTo([me.lng, me.lat], 15);
    };

    const pointPlace = async (pt) => {
      try {
        const p = await api.reverse(pt);
        return { ...p, lng: pt[0], lat: pt[1] };
      } catch {
        return { name: fmtCoord(pt), address: '', lng: pt[0], lat: pt[1], kind: 'Dropped pin' };
      }
    };

    view.map.on('contextmenu', (e) => {
      const pt = [e.lngLat.lng, e.lngLat.lat];
      openContextMenu({
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        title: fmtCoord(pt),
        items: [
          { label: 'Directions to here', action: async () => openDirections({ to: await pointPlace(pt) }) },
          { label: 'Directions from here', action: async () => openDirections({ from: await pointPlace(pt) }) },
          { label: "What's here?", action: async () => showPlace(await pointPlace(pt)) },
          { separator: true },
          { label: 'Copy coordinates', action: async () => { try { await navigator.clipboard.writeText(fmtCoord(pt)); toast('Coordinates copied'); } catch { toast(fmtCoord(pt)); } } },
        ],
      });
    });

    this._onKey = (e) => {
      if (!root.isConnected) return;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
      if (e.key === '/' && !typing) {
        e.preventDefault();
        e.stopPropagation();
        setPanel('browse');
        qIn.focus();
      } else if (e.key === 'Escape' && root.dataset.panel !== 'browse' && !document.querySelector('#toolbox-context-menu')) {
        // Close the panel instead of leaving the app (app.js goes back on Escape).
        e.stopPropagation();
        setPanel('browse');
        view.setRoute(null);
        view.setStops([]);
        view.setMarkers(hereMarker());
      }
    };
    window.addEventListener('keydown', this._onKey, true);

    this._ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => view.resize()) : null;
    this._ro?.observe(mapEl);

    /* ---------- Assistant handoff ---------- */

    let handoff = null;
    try {
      handoff = JSON.parse(sessionStorage.getItem(HANDOFF_KEY) || 'null');
      sessionStorage.removeItem(HANDOFF_KEY);
    } catch { /* nothing handed over */ }
    if (handoff?.from && handoff?.to && isLngLat([handoff.to.lng, handoff.to.lat])) {
      state.mode = ['driving', 'walking', 'cycling', 'transit'].includes(handoff.mode) ? handoff.mode : 'driving';
      root.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-checked', String(x.dataset.mode === state.mode)));
      openDirections({ from: handoff.from, to: handoff.to });
    } else if (Array.isArray(handoff?.places) && handoff.places.length) {
      showResults(handoff.places.map(p => ({ ...p, kind: p.category || p.kind, distanceM: Number.isFinite(p.distanceKm) ? p.distanceKm * 1000 : undefined })), handoff.title || 'Places');
    } else {
      // Start where the person is, if location is already allowed; never prompt on open.
      try {
        const perm = await navigator.permissions?.query({ name: 'geolocation' });
        if (perm?.state === 'granted') locate();
      } catch { /* permissions API unavailable */ }
    }
  },

  destroy() {
    if (this._onKey) window.removeEventListener('keydown', this._onKey, true);
    this._ro?.disconnect();
    this._view?.destroy();
    this._view = null;
  },
};
