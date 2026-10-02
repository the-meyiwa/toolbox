/* ============================================================
   TOOLBOX — Mind

   Personal Knowledge Graph & Mind Palace. You sit at the centre,
   rooms orbit you, things live in rooms and on desks, and things
   connect to each other.

   The header (search, modes, New) stays put while the scene below
   changes, and every change says where you went (lib/mind-motion.js):
   into a room or a thing zooms in and the card you tapped becomes
   the page, back zooms out into that card again, the three modes
   slide side by side, and edits inside a view move only what changed.

   Every kind of thing has its own colour and icon, so a room of
   people reads differently from a room of songs at a glance.
   ============================================================ */

import {
  readMind, writeMind, addMindRoom, removeMindRoom, upsertMindEntity, addMindMembership, removeMindMembership,
  roomEntities, relateMindEntities, removeMindRelationship, forgetMindEntity, supersedeMindEntity, recallMind, reviewMindSuggestion,
} from '../lib/mind-store.js';
import { showDialog } from '../lib/dialog.js';
import { MindMotion, movePill, mindPointerLight } from '../lib/mind-motion.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MODES = [['space', 'Space'], ['map', 'Map'], ['sense', 'Sense']];
const ago = (ts) => {
  if (!ts) return '';
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)} d ago`;
  return new Date(ts).toLocaleDateString();
};

/* ---------------- icons ---------------- */
const P = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  space: '<circle cx="12" cy="12" r="2.4"/><ellipse cx="12" cy="12" rx="9.5" ry="4"/><ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(60 12 12)"/>',
  map: '<circle cx="6" cy="7" r="2.2"/><circle cx="18" cy="6" r="2.2"/><circle cx="12" cy="17.5" r="2.6"/><path d="m7.6 8.8 3 6.6M16.6 7.8l-3.4 7.6M8.2 6.8l7.6-.6"/>',
  sense: '<path d="M4 19v-6M9.3 19V7M14.6 19v-9M20 19V4"/>',
  you: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6"/>',
  room: '<path d="M4 10.5 12 4l8 6.5V20H4z"/><path d="M9.5 20v-5.5h5V20"/>',
  smart: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
  desk: '<path d="M3 9.5h18M5 9.5V19M19 9.5V19M5 14.5h6V19"/><path d="M8 9.5V6.5h8v3"/>',
  person: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6"/>',
  song: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  artist: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  project: '<path d="M5 21V4M5 4.5h11l-2 4 2 4H5"/>',
  idea: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1 2.2h5.2c0-.9.4-1.7 1-2.2A6 6 0 0 0 12 3z"/>',
  memory: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  place: '<path d="M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  tech: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
  media: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>',
  note: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  custom: '<path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.9L12 18.5l-1.8-5.8-5.7-1.9L10.2 9z"/>',
  connect: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>',
  place_in: '<path d="M12 4v10M7 9l5 5 5-5"/><path d="M4 18h16"/>',
  source: '<path d="M4 6h16M4 12h10M4 18h7"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  open: '<path d="M7 17 17 7M9 7h8v8"/>',
};
const icon = (name, size = 18, sw = 1.8) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.custom}</svg>`;

/* ---------------- kinds of thing: colour + icon ---------------- */
const TYPE_META = {
  Person: { hue: 214, icon: 'person' }, Song: { hue: 330, icon: 'song' }, Artist: { hue: 292, icon: 'artist' },
  Project: { hue: 152, icon: 'project' }, Idea: { hue: 42, icon: 'idea' }, Memory: { hue: 262, icon: 'memory' },
  Place: { hue: 6, icon: 'place' }, Technology: { hue: 188, icon: 'tech' }, Media: { hue: 20, icon: 'media' },
  Note: { hue: 32, icon: 'note' }, Link: { hue: 200, icon: 'link' }, Custom: { hue: 230, icon: 'custom' }, Desk: { hue: 28, icon: 'desk' },
};
const TYPES = Object.keys(TYPE_META);
const CAPTURE_TYPES = ['Note', 'Idea', 'Person', 'Memory', 'Project', 'Place', 'Link'];
const metaOf = type => TYPE_META[type] || TYPE_META.Custom;
const ROOM_HUES = [214, 152, 28, 330, 262, 188, 6, 42, 292, 120];
const roomHue = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return ROOM_HUES[h % ROOM_HUES.length]; };
const RELATIONS = ['related', 'part of', 'works with', 'inspired by', 'knows', 'about', 'uses'];
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const count = (n) => `<span class="mind-count" data-count="${n}">${n}</span>`;

export default {
  render(container) {
    this.container = container; this.roomId = null; this.focusId = null; this.trail = []; this.editDesk = false; this.view = 'space'; this.query = '';
    this.drawn = 0; this.lastKey = null; this.returnTo = null; this.filter = 'all';
    this.motion = new MindMotion(container);
    container.innerHTML = `<main class="mind">
      <header class="mind-bar">
        <div class="mind-brand">
          <span class="mind-logo" aria-hidden="true">${icon('space', 22, 1.7)}</span>
          <div><h1>Mind</h1><p class="mind-tally"></p></div>
        </div>
        <label class="mind-find">${icon('search', 16)}<span class="visually-hidden">Search Mind</span><input type="search" data-search placeholder="Find a person, idea, memory…" autocomplete="off"><kbd aria-hidden="true">/</kbd></label>
        <div class="mind-bar-end">
          <nav class="mind-modes" aria-label="Mind views">${MODES.map(([key, label]) => `<button type="button" data-mode="${key}">${icon(key, 16)}<span>${label}</span></button>`).join('')}</nav>
          <div class="mind-menu-wrap">
            <button type="button" class="mind-btn mind-btn-primary" data-action="menu" aria-haspopup="menu" aria-expanded="false">${icon('plus', 16, 2.2)}<span>New</span></button>
            <div class="mind-menu" role="menu" hidden data-new-menu></div>
          </div>
        </div>
      </header>
      <nav class="mind-path" aria-label="Mind location"></nav>
      <section class="mind-scene" aria-live="polite"></section>
    </main>`;
    this.el = {
      modes: container.querySelector('.mind-modes'), path: container.querySelector('.mind-path'), scene: container.querySelector('.mind-scene'),
      search: container.querySelector('[data-search]'), tally: container.querySelector('.mind-tally'), newMenu: container.querySelector('[data-new-menu]'),
    };
    this.onClick = e => this.click(e);
    this.onInput = e => {
      if (e.target === this.el.search) { this.query = e.target.value; this.draw('update'); return; }
      const form = e.target.closest?.('[data-entity-form]');
      if (form) this.markDirty(form, e.target);
    };
    this.onSubmit = e => {
      if (e.target.matches('[data-entity-form]')) { e.preventDefault(); this.saveEntity(e.target); }
      else if (e.target.matches('[data-capture]')) { e.preventDefault(); this.capture(e.target); }
    };
    this.onKey = e => {
      // "/" jumps to search from anywhere in Mind.
      if (e.key === '/' && !e.target.closest('input, textarea, select, [contenteditable="true"]')) { e.preventDefault(); this.el.search.focus(); return; }
      if (e.key !== 'Escape') return;
      if (this.closeMenus()) { e.stopPropagation(); return; }
      if (this.view !== 'space' || (e.target === this.el.search && this.query)) return;
      // Typing in the editor: Escape leaves the field, not the page (unsaved words stay).
      if (e.target.closest?.('[data-entity-form]')) { e.stopPropagation(); e.target.blur(); return; }
      // Escape steps back inside Mind; only at the top does it leave Mind (the app's own Escape).
      if (this.focusId || this.roomId) { e.stopPropagation(); this.back(); }
    };
    container.addEventListener('click', this.onClick);
    container.addEventListener('input', this.onInput);
    container.addEventListener('submit', this.onSubmit);
    container.addEventListener('keydown', this.onKey);
    this.unlight = mindPointerLight(container);
    if (typeof ResizeObserver === 'function') { this.modesRO = new ResizeObserver(() => movePill(this.el.modes)); this.modesRO.observe(this.el.modes); }
    this.draw('first');
  },

  /* ---------------- navigation ---------------- */
  /** What the current page is about: the thing in focus, else the room. */
  subject() { return this.view === 'space' ? this.focusId || this.roomId : null; },
  /** Identifies the page, so in-place edits can tell a new page from the same one changing. */
  viewKey() {
    if (this.query.trim()) return 'search';
    if (this.view !== 'space') return this.view;
    return this.focusId ? `e:${this.focusId}:${this.editDesk}` : this.roomId ? `r:${this.roomId}` : 'home';
  },
  /**
   * Changes state, then shows the change. kind says how you travelled:
   * 'in' (deeper), 'out' (back up), 'next'/'prev' (side by side), 'update' (same page).
   */
  go(change, kind, source = null) {
    const back = this.subject();
    change();
    if (kind !== 'update') this.filter = 'all';
    return this.draw(kind, { source, back });
  },
  /** One step up. A page opened from Map or Sense returns there, to the thing it was opened from. */
  back() {
    this.go(() => {
      if (this.editDesk) this.editDesk = false;
      else if (this.focusId && this.trail.length) this.focusId = this.trail.pop();
      else if (this.returnTo) { this.view = this.returnTo.view; this.focusId = this.returnTo.focusId; this.roomId = null; this.returnTo = null; }
      else if (this.focusId) this.focusId = null;
      else this.roomId = null;
    }, 'out');
  },
  /** Remembers Map or Sense before leaving it for a page, so back can return there. */
  leaveFor(id) {
    if (this.view !== 'space') { this.returnTo = { view: this.view, focusId: this.view === 'map' ? id : null }; this.trail = []; this.roomId = null; }
    this.view = 'space'; this.editDesk = false; this.query = '';
  },
  switchMode(mode) {
    const from = MODES.findIndex(([k]) => k === this.view), to = MODES.findIndex(([k]) => k === mode);
    if (from === to && !this.query && !this.focusId) return;
    this.go(() => {
      this.view = mode; this.focusId = null; this.trail = []; this.editDesk = false; this.query = ''; this.returnTo = null;
    }, to > from ? 'next' : to < from ? 'prev' : 'out');
  },

  /* ---------------- draw: the header updates at once, the scene travels ---------------- */
  async draw(kind = 'update', { source = null, back = null } = {}) {
    const token = ++this.drawn, scene = this.el.scene, key = this.viewKey();
    if (kind === 'update' && key !== this.lastKey) kind = 'swap';
    this.motion.clearGhosts();
    const before = kind === 'update' ? this.motion.snapshot(scene) : null;
    const morph = kind === 'in' ? this.motion.lift(source) : null;
    const from = kind === 'out' ? scene.querySelector('.mind-scene-heading')?.getBoundingClientRect() : null;
    const hadFocus = scene.contains(document.activeElement);
    // A field that is redrawn in place keeps the cursor (quick capture, filters).
    const focusKey = document.activeElement?.closest?.('[data-focus-key]')?.dataset.focusKey || null;

    this.chrome(kind);
    if (kind !== 'update' && kind !== 'first') await this.motion.leave(scene, kind, morph?.rect || from);
    if (token !== this.drawn) { this.motion.drop(morph); return; }

    this.motion.reset();
    scene.style.transformOrigin = '';
    scene.innerHTML = this.sceneHTML(readMind());
    this.lastKey = key;

    // New pages start at the top; going back keeps you near where you were.
    if (kind === 'in' || kind === 'next' || kind === 'prev' || (kind === 'out' && !back)) {
      const top = this.container.querySelector('.mind')?.getBoundingClientRect().top;
      if (top < 0) this.container.querySelector('.mind').scrollIntoView({ block: 'start', behavior: 'auto' });
    }
    const target = this.motion.enter(scene, kind, { morph, from, back, before });

    if (focusKey && kind === 'update') scene.querySelector(`[data-focus-key="${focusKey}"]`)?.focus({ preventScroll: true });
    // Keep keyboard focus in Mind, so Escape keeps working: on the new page, or the card we came out of.
    else if (kind !== 'update' && kind !== 'first' && (hadFocus || document.activeElement === document.body)) {
      const heading = scene.querySelector('.mind-scene-heading h2');
      const next = target || heading;
      if (next) { if (next === heading) heading.tabIndex = -1; next.focus({ preventScroll: true }); }
    }
  },

  /** Header pieces never leave the screen, so they simply update. */
  chrome(kind) {
    const graph = readMind(), room = graph.rooms.find(r => r.id === this.roomId), focus = graph.entities.find(e => e.id === this.focusId);
    this.el.modes.querySelectorAll('[data-mode]').forEach(b => {
      const on = b.dataset.mode === this.view;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    movePill(this.el.modes);
    if (this.el.search.value !== this.query) this.el.search.value = this.query;
    const things = graph.entities.filter(e => e.status === 'active' && e.type !== 'Desk').length;
    const links = graph.relationships.filter(r => r.status === 'active' && r.type !== 'contains').length;
    this.el.tally.textContent = `${plural(things, 'thing')} · ${plural(graph.rooms.length, 'room')} · ${plural(links, 'connection')}`;
    // The New menu offers what fits where you are.
    const manualRoom = room?.mode === 'manual' && this.view === 'space';
    const deskHere = focus?.type === 'Desk' && this.view === 'space';
    this.el.newMenu.innerHTML = [
      ['new-entity', 'plus', deskHere ? `Thing on ${focus.name}` : manualRoom ? `Thing in ${room.name}` : 'Thing', 'A person, idea, memory, project…'],
      manualRoom ? ['new-desk', 'desk', 'Desk', 'A place inside this room'] : null,
      ['new-room', 'room', 'Room', 'An area of your life'],
    ].filter(Boolean).map(([action, ico, label, sub]) => `<button type="button" role="menuitem" data-action="${action}">${icon(ico, 17)}<span><strong>${esc(label)}</strong><small>${esc(sub)}</small></span></button>`).join('');

    const crumbs = [`<button data-action="home">${icon('space', 14)}<span>Mind</span></button>`];
    if (this.view !== 'space') crumbs.push(`<strong>${this.view === 'map' ? 'Map' : 'Sense'}</strong>`);
    if (room) crumbs.push(`<button data-action="room" data-id="${room.id}" style="--hue:${roomHue(room.id)}"><i class="mind-dot"></i><span>${esc(room.name)}</span></button>`);
    this.trail.map(id => graph.entities.find(e => e.id === id)).filter(Boolean).forEach(e => crumbs.push(`<button data-action="trail" data-id="${e.id}"><span>${esc(e.name)}</span></button>`));
    if (focus && this.view === 'space') crumbs.push(`<strong>${esc(focus.name)}</strong>`);
    const html = crumbs.join('<span class="mind-sep" aria-hidden="true">/</span>');
    if (this.el.path.innerHTML === html) return;
    this.el.path.innerHTML = html;
    // A step deeper adds a crumb: it slides in from where you are heading.
    const last = this.el.path.lastElementChild;
    if (kind === 'in' && crumbs.length > 1 && last && !this.motion.off) {
      [last, last.previousElementSibling].forEach(el => el?.animate([{ opacity: 0, transform: 'translateX(10px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 120, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'backwards' }));
    }
    if (this.el.path.scrollWidth > this.el.path.clientWidth) this.el.path.scrollLeft = this.el.path.scrollWidth;
  },

  sceneHTML(graph) {
    const room = graph.rooms.find(r => r.id === this.roomId), focus = graph.entities.find(e => e.id === this.focusId);
    if (this.query.trim()) return this.searchView(recallMind(this.query, 30), graph);
    if (this.view === 'map') return this.mapView(graph);
    if (this.view === 'sense') return this.senseView(graph);
    if (focus?.type === 'Desk' && !this.editDesk) return this.deskView(graph, focus);
    if (focus) return this.entityView(graph, focus);
    if (room) return this.roomView(graph, room);
    return this.homeView(graph);
  },

  /* ---------------- shared pieces ---------------- */

  /** The page head: a coloured badge, a title and what the page can do. */
  head({ ico, hue, kicker, title, meta = '', actions = '' }) {
    return `<div class="mind-scene-heading mind-head" style="--hue:${hue}">
      <span class="mind-badge">${icon(ico, 24, 1.7)}</span>
      <div class="mind-head-text"><small>${kicker}</small><h2>${esc(title)}</h2>${meta ? `<p>${meta}</p>` : ''}</div>
      ${actions ? `<div class="mind-scene-actions">${actions}</div>` : ''}
    </div>`;
  },
  button(action, label, ico, { primary = false, attrs = '' } = {}) {
    return `<button type="button" class="mind-btn${primary ? ' mind-btn-primary' : ''}" data-action="${action}" ${attrs}>${ico ? icon(ico, 16, 2) : ''}<span>${esc(label)}</span></button>`;
  },
  menu(items) {
    return `<div class="mind-menu-wrap"><button type="button" class="mind-btn mind-btn-icon" data-action="menu" aria-haspopup="menu" aria-expanded="false" aria-label="More">${icon('more', 18)}</button>
      <div class="mind-menu" role="menu" hidden>${items.map(([action, label, ico, danger]) => `<button type="button" role="menuitem" data-action="${action}" ${danger ? 'class="is-danger"' : ''}>${icon(ico, 16)}<span><strong>${esc(label)}</strong></span></button>`).join('')}</div></div>`;
  },
  capture(formOrPlaceholder) {
    if (typeof formOrPlaceholder !== 'string') return this.saveCapture(formOrPlaceholder);
    return `<form class="mind-capture" data-capture>
      <span class="mind-capture-ico">${icon('plus', 18, 2)}</span>
      <input name="name" maxlength="120" placeholder="${esc(formOrPlaceholder)}" aria-label="Capture" data-focus-key="capture" autocomplete="off">
      <select name="type" aria-label="Kind">${CAPTURE_TYPES.map(t => `<option>${t}</option>`).join('')}</select>
      <button type="submit" class="mind-btn mind-btn-primary">Add</button>
    </form>`;
  },
  degree(graph, id) { return graph.relationships.filter(r => r.status === 'active' && r.type !== 'contains' && (r.from === id || r.to === id)).length; },

  /** A thing as a card. `group` prefixes its key when the same thing appears in several sections. */
  object(e, i, graph, group = '', { row = false } = {}) {
    const m = metaOf(e.type), links = this.degree(graph, e.id);
    const snippet = String(e.content || '').replace(/\s+/g, ' ').trim();
    return `<button class="mind-object mind-entity${row ? ' mind-row' : ''}" style="--order:${i};--hue:${m.hue}" data-open-entity="${e.id}" data-key="${group}${e.id}">
      <span class="mind-obj-top"><span class="mind-type-ico">${icon(m.icon, 16, 1.9)}</span><small>${esc(e.type)}</small>${links ? `<span class="mind-links" title="${plural(links, 'connection')}">${icon('connect', 13, 2)}${count(links)}</span>` : ''}</span>
      <strong>${esc(e.name)}</strong>
      <span class="mind-snippet">${snippet ? esc(snippet.slice(0, 110)) : (e.type === 'Desk' ? 'Open the desk' : 'Open to add what you know')}</span>
    </button>`;
  },

  /* ---------------- views ----------------
     Parts that can stay on screen while a view changes carry data-key,
     so the motion can tell what moved, what is new and what has gone. */
  homeView(graph) {
    const rooms = graph.rooms, n = rooms.length;
    const active = graph.entities.filter(e => e.status === 'active');
    const recent = active.filter(e => e.type !== 'Desk').sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 8);
    const spots = rooms.map((r, i) => {
      const theta = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
      return { r, x: Math.round(Math.cos(theta) * 38), y: Math.round(Math.sin(theta) * 36) };
    });
    return `<div class="mind-home">
      <div class="mind-space${n ? '' : ' is-empty'}">
        <svg class="mind-tethers" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${spots.map(({ r, x, y }) => `<line x1="50" y1="50" x2="${50 + x}" y2="${50 + y}" style="--hue:${roomHue(r.id)}"/>`).join('')}</svg>
        <div class="mind-self"><span class="mind-self-ico">${icon('you', 26, 1.6)}</span><strong>You</strong><span>${count(n)} ${n === 1 ? 'room' : 'rooms'}</span></div>
        <div class="mind-orbit">${spots.map(({ r, x, y }, i) => this.roomTile(graph, r, i, x, y)).join('')}</div>
        ${!n ? `<div class="mind-empty mind-home-empty"><strong>Your Mind is empty</strong><span>Rooms hold the areas of your life: people, work, music, places.</span>${this.button('new-room', 'Create your first room', 'room', { primary: true })}</div>` : ''}
      </div>
      ${this.capture('Capture a thought, a person, an idea…')}
      ${recent.length ? `<section class="mind-section"><div class="mind-section-head"><h3>Recently touched</h3><span>${plural(active.filter(e => e.type !== 'Desk').length, 'thing')} in all</span></div><div class="mind-objects mind-strip">${recent.map((e, i) => this.object(e, i, graph, 'recent:')).join('')}</div></section>` : ''}
    </div>`;
  },

  roomTile(graph, r, i, x, y) {
    const members = roomEntities(graph, r);
    const desks = members.filter(e => e.type === 'Desk').length;
    const kinds = [...new Set(members.filter(e => e.type !== 'Desk').map(e => e.type))].slice(0, 5);
    return `<button class="mind-object mind-room" style="--x:${x}%;--y:${y}%;--order:${i};--hue:${roomHue(r.id)}" data-open-room="${r.id}" data-key="room:${r.id}">
      <span class="mind-obj-top"><span class="mind-type-ico">${icon(r.mode === 'smart' ? 'smart' : 'room', 16, 1.9)}</span><small>${r.mode === 'smart' ? 'Smart room' : 'Room'}</small></span>
      <strong>${esc(r.name)}</strong>
      <span class="mind-meta">${count(members.length - desks)} ${members.length - desks === 1 ? 'thing' : 'things'}${desks ? ` · ${plural(desks, 'desk')}` : ''}</span>
      ${kinds.length ? `<span class="mind-kind-dots">${kinds.map(k => `<i style="--hue:${metaOf(k).hue}" title="${esc(k)}"></i>`).join('')}</span>` : ''}
    </button>`;
  },

  roomView(graph, room) {
    const members = roomEntities(graph, room).filter(e => room.mode === 'smart' || graph.memberships.some(m => m.roomId === room.id && m.entityId === e.id && !m.parentId));
    const desks = members.filter(e => e.type === 'Desk'), others = members.filter(e => e.type !== 'Desk');
    const kinds = [...new Set(others.map(e => e.type))];
    if (this.filter !== 'all' && !kinds.includes(this.filter)) this.filter = 'all';
    const shown = this.filter === 'all' ? others : others.filter(e => e.type === this.filter);
    const manual = room.mode === 'manual';
    const actions = `${manual ? this.button('new-entity', 'Add thing', 'plus', { primary: true }) + this.button('place-existing', 'Place existing', 'place_in') : ''}${this.menu([
      ...(manual ? [['new-desk', 'New desk', 'desk']] : []), ['rename-room', 'Rename room', 'edit'], ['delete-room', 'Delete room', 'trash', true]])}`;
    return `<div class="mind-page">
      ${this.head({ ico: manual ? 'room' : 'smart', hue: roomHue(room.id), kicker: manual ? 'Room' : 'Smart room · fills itself', title: room.name, meta: `${count(others.length)} ${others.length === 1 ? 'thing' : 'things'}${desks.length ? ` · ${plural(desks.length, 'desk')}` : ''}`, actions })}
      ${manual ? this.capture(`Add to ${room.name}…`) : ''}
      ${desks.length ? `<section class="mind-section"><div class="mind-section-head"><h3>Desks</h3><span>Places inside this room</span></div><div class="mind-objects mind-desks">${desks.map((d, i) => this.deskCard(graph, d, i)).join('')}</div></section>` : ''}
      <section class="mind-section"><div class="mind-section-head"><h3>Things</h3>${kinds.length > 1 ? `<div class="mind-filters" role="group" aria-label="Show">${['all', ...kinds].map(k => `<button type="button" data-filter="${esc(k)}" aria-pressed="${this.filter === k}" ${k !== 'all' ? `style="--hue:${metaOf(k).hue}"` : ''}>${k === 'all' ? 'All' : `<i class="mind-dot"></i>${esc(k)}`}</button>`).join('')}</div>` : ''}</div>
      <div class="mind-objects">${shown.map((e, i) => this.object(e, i, graph)).join('') || `<p class="mind-empty" data-key="empty">${manual ? 'Nothing here yet. Capture something above, or place a thing you already have.' : 'Nothing matches this smart room yet.'}</p>`}</div></section>
    </div>`;
  },

  deskCard(graph, desk, i) {
    const items = this.deskItems(graph, desk);
    return `<button class="mind-object mind-desk" style="--order:${i};--hue:${metaOf('Desk').hue}" data-open-entity="${desk.id}" data-key="${desk.id}">
      <span class="mind-obj-top"><span class="mind-type-ico">${icon('desk', 16, 1.9)}</span><small>Desk</small><span class="mind-links">${count(items.length)}</span></span>
      <strong>${esc(desk.name)}</strong>
      <span class="mind-desk-items">${items.slice(0, 4).map(e => `<i style="--hue:${metaOf(e.type).hue}">${esc(e.name)}</i>`).join('') || '<em>Empty desk</em>'}${items.length > 4 ? `<em>+${items.length - 4}</em>` : ''}</span>
    </button>`;
  },
  deskItems(graph, desk) {
    return graph.relationships.filter(r => r.status === 'active' && r.type === 'contains' && r.from === desk.id)
      .map(r => graph.entities.find(e => e.id === r.to)).filter(e => e?.status === 'active');
  },

  deskView(graph, desk) {
    const children = this.deskItems(graph, desk);
    const actions = `${this.button('new-entity', 'Add thing', 'plus', { primary: true })}${this.button('place-existing', 'Place existing', 'place_in')}${this.menu([['edit-desk', 'Edit desk', 'edit'], ['delete-entity', 'Delete desk', 'trash', true]])}`;
    return `<div class="mind-page">
      ${this.head({ ico: 'desk', hue: metaOf('Desk').hue, kicker: 'Desk', title: desk.name, meta: `${count(children.length)} ${children.length === 1 ? 'thing' : 'things'} gathered here`, actions })}
      <div class="mind-objects">${children.map((e, i) => this.object(e, i, graph)).join('') || '<p class="mind-empty" data-key="empty">Place a note, person, project or idea on this desk.</p>'}</div>
    </div>`;
  },

  entityView(graph, entity) {
    const m = metaOf(entity.type);
    const links = graph.relationships.filter(r => r.status === 'active' && (r.from === entity.id || r.to === entity.id));
    const rooms = graph.rooms.filter(r => roomEntities(graph, r).some(e => e.id === entity.id));
    const sources = (entity.sourceIds || []).map(id => graph.sources.find(s => s.id === id)).filter(Boolean);
    const props = Object.entries(entity.properties || {}).filter(([k]) => k !== 'origin');
    const pct = v => Math.round((Number(v) || 0) * 100);
    const choice = (name, value, options) => options.map(([v, label, hint]) => `<label class="mind-choice" title="${esc(hint || '')}"><input type="radio" name="${name}" value="${v}" ${value === v ? 'checked' : ''}><span>${esc(label)}</span></label>`).join('');
    const relLabel = (r) => (r.type === 'contains' ? (r.from === entity.id ? 'Holds' : 'On desk') : r.type[0].toUpperCase() + r.type.slice(1));
    const meta = `${count(links.filter(r => r.type !== 'contains').length)} connections${rooms.length ? ` · in ${rooms.map(r => esc(r.name)).join(', ')}` : ''} · updated ${ago(entity.updatedAt)}`;
    return `<div class="mind-page mind-thing">
      ${this.head({ ico: m.icon, hue: m.hue, kicker: `${esc(entity.type)}${entity.properties?.origin === 'assistant' ? ' · remembered by the Assistant' : ''}`, title: entity.name, meta })}
      <div class="mind-thing-grid">
        <form data-entity-form class="mind-editor" data-id="${entity.id}">
          <label class="mind-field"><span>Name</span><input name="name" value="${esc(entity.name)}" required maxlength="120" autocomplete="off"></label>
          <fieldset class="mind-field mind-kinds"><legend>Kind</legend><div>${TYPES.map(t => `<label class="mind-kind" style="--hue:${metaOf(t).hue}"><input type="radio" name="type" value="${t}" ${entity.type === t ? 'checked' : ''}><span>${icon(metaOf(t).icon, 14, 2)}${t}</span></label>`).join('')}</div></fieldset>
          <label class="mind-field mind-field-wide"><span>What you know</span><textarea name="content" rows="8" placeholder="Notes, facts, how you met, why it matters…">${esc(entity.content || '')}</textarea></label>
          <details class="mind-more">
            <summary>Details</summary>
            <div class="mind-more-body">
              <div class="mind-field"><span>How you know it</span><div class="mind-choices">${choice('memoryType', entity.memoryType || 'explicit', [['explicit', 'Told', 'You wrote it down'], ['learned', 'Learned', 'Worked out over time'], ['episodic', 'Lived', 'Something that happened']])}</div></div>
              <div class="mind-field"><span>Who can see it</span><div class="mind-choices">${choice('access', entity.access || 'private', [['private', 'Only me'], ['shared', 'Shared']])}</div></div>
              <label class="mind-field mind-range"><span>Importance <output>${pct(entity.importance ?? .5)}%</output></span><input name="importance" type="range" min="0" max="1" step=".05" value="${entity.importance ?? .5}"></label>
              <label class="mind-field mind-range"><span>Confidence <output>${pct(entity.confidence ?? 1)}%</output></span><input name="confidence" type="range" min="0" max="1" step=".05" value="${entity.confidence ?? 1}"></label>
              <div class="mind-field mind-field-wide"><span>Properties</span>
                <div class="mind-props">${props.map(([k, v]) => this.propRow(k, v)).join('')}</div>
                <button type="button" class="mind-btn mind-btn-quiet" data-action="add-prop">${icon('plus', 15, 2)}<span>Add property</span></button>
              </div>
            </div>
          </details>
          <div class="mind-editor-actions"><button class="mind-btn mind-btn-primary" type="submit" disabled>${icon('check', 16, 2.2)}<span>Save</span></button><span class="mind-save-state" aria-live="polite">All changes saved</span></div>
        </form>
        <aside class="mind-related">
          <section class="mind-panel">
            <div class="mind-panel-head"><h3>Connections</h3>${this.button('connect', 'Connect', 'connect', { attrs: 'data-small' })}</div>
            <div class="mind-link-list">${links.map(r => {
              const other = graph.entities.find(e => e.id === (r.from === entity.id ? r.to : r.from));
              if (!other) return '';
              const om = metaOf(other.type);
              return `<div class="mind-link-row" data-key="rel:${r.id}" style="--hue:${om.hue}"><button type="button" class="mind-link-open" data-open-entity="${other.id}"><span class="mind-type-ico">${icon(om.icon, 15, 1.9)}</span><span><small>${esc(relLabel(r))}</small><strong>${esc(other.name)}</strong></span></button><button type="button" class="mind-x" data-unlink="${r.id}" aria-label="Remove connection to ${esc(other.name)}">${icon('x', 14, 2)}</button></div>`;
            }).join('') || '<p class="mind-hint" data-key="rel:none">Not connected yet. Connections are how Mind finds this again.</p>'}</div>
          </section>
          <section class="mind-panel">
            <div class="mind-panel-head"><h3>Lives in</h3>${graph.rooms.some(r => r.mode === 'manual') ? this.button('add-to-room', 'Room', 'plus', { attrs: 'data-small' }) : ''}</div>
            <div class="mind-chips">${rooms.map(r => `<span class="mind-chip" data-key="in:${r.id}" style="--hue:${roomHue(r.id)}"><button type="button" data-open-room="${r.id}"><i class="mind-dot"></i>${esc(r.name)}</button>${r.mode === 'manual' ? `<button type="button" class="mind-x" data-leave-room="${r.id}" aria-label="Take out of ${esc(r.name)}">${icon('x', 12, 2.2)}</button>` : ''}</span>`).join('') || '<p class="mind-hint" data-key="in:none">Not in a room. It is still found by search, the map and the Assistant.</p>'}</div>
          </section>
          ${sources.length ? `<section class="mind-panel"><div class="mind-panel-head"><h3>Sources</h3></div>${sources.map(s => `<p class="mind-source">${icon('source', 14)}<span><strong>${esc(s.kind)}</strong> ${esc(s.ref)}${s.excerpt ? ` — ${esc(s.excerpt)}` : ''}</span></p>`).join('')}</section>` : ''}
          <section class="mind-panel mind-panel-quiet">
            ${this.button('supersede', 'Mark as outdated', 'archive')}
            ${this.button('delete-entity', 'Delete', 'trash', { attrs: 'data-danger' })}
          </section>
        </aside>
      </div>
    </div>`;
  },
  propRow(k = '', v = '') {
    const value = typeof v === 'string' ? v : JSON.stringify(v);
    return `<div class="mind-prop"><input name="propKey" value="${esc(k)}" placeholder="Name" maxlength="60" aria-label="Property name"><input name="propValue" value="${esc(value)}" placeholder="Value" maxlength="400" aria-label="Property value"><button type="button" class="mind-x" data-action="remove-prop" aria-label="Remove property">${icon('x', 14, 2)}</button></div>`;
  },

  searchView(items, graph) {
    return `<div class="mind-page mind-results">
      ${this.head({ ico: 'search', hue: 214, kicker: 'Search your Mind', title: items.length ? `${items.length} ${items.length === 1 ? 'match' : 'matches'}` : 'No matches', meta: `For “${esc(this.query.trim())}”` })}
      <div class="mind-objects">${items.map((e, i) => this.object(e, i, graph)).join('') || '<p class="mind-empty" data-key="empty">Nothing found. Try another word, or capture it as something new.</p>'}</div>
    </div>`;
  },

  /** Lays the map out around one thing: it sits at the centre, its connections closest to it. */
  mapLayout(graph, focusId) {
    const nodes = graph.entities.filter(e => e.status === 'active').slice(0, 80), ids = new Set(nodes.map(e => e.id));
    const focus = focusId && ids.has(focusId) ? focusId : nodes[0]?.id;
    const rels = graph.relationships.filter(r => r.status === 'active' && ids.has(r.from) && ids.has(r.to));
    const near = new Set(rels.filter(r => r.from === focus || r.to === focus).flatMap(r => [r.from, r.to]));
    const rank = e => e.id === focus ? 0 : near.has(e.id) ? 1 : 2;
    const ordered = [...nodes].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    const positions = new Map(ordered.map((e, i) => {
      const a = i * 2.39996, radius = i === 0 ? 0 : Math.min(39, 9 + Math.sqrt(i) * 5);
      return [e.id, { x: +(50 + Math.cos(a) * radius).toFixed(2), y: +(50 + Math.sin(a) * radius).toFixed(2) }];
    }));
    const role = id => id === focus ? 'active' : near.has(id) ? 'near' : 'far';
    return { nodes: ordered, focus, rels, positions, role };
  },

  mapView(graph) {
    const { nodes, focus, rels, positions, role } = this.mapLayout(graph, this.focusId);
    // Lines start at the focused thing, so they draw outward from it; its own lines draw first.
    const lines = rels.map(r => (r.to === focus ? { r, a: r.to, b: r.from } : { r, a: r.from, b: r.to }))
      .sort((p, q) => (p.a === focus ? 0 : 1) - (q.a === focus ? 0 : 1));
    const kinds = [...new Set(nodes.map(e => e.type))];
    return `<div class="mind-page mind-map">
      ${this.head({ ico: 'map', hue: 188, kicker: 'Associations', title: 'Map', meta: 'Select a thing to bring its connections forward. Select it again to open it.' })}
      ${kinds.length ? `<div class="mind-legend">${kinds.map(k => `<span style="--hue:${metaOf(k).hue}"><i class="mind-dot"></i>${esc(k)}</span>`).join('')}</div>` : ''}
      <div class="mind-map-field">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines.map(({ a, b }) => {
          const p = positions.get(a), q = positions.get(b);
          return `<line data-a="${a}" data-b="${b}" x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" class="${a === focus ? 'near' : 'far'}"/>`;
        }).join('')}</svg>
        ${nodes.map(e => {
          const p = positions.get(e.id), m = metaOf(e.type);
          return `<button class="mind-map-node ${role(e.id)}" style="--x:${p.x}%;--y:${p.y}%;--hue:${m.hue}" data-map-focus="${e.id}" aria-pressed="${e.id === focus}"><span class="mind-type-ico">${icon(m.icon, 13, 2)}</span><strong>${esc(e.name)}</strong></button>`;
        }).join('')}${!nodes.length ? `<div class="mind-map-empty"><p>Connections appear here as your Mind grows.</p>${this.button('new-room', 'Create a room', 'room', { primary: true })}</div>` : ''}
      </div>
      <div class="mind-map-foot">${this.mapFoot(graph, focus)}</div>
    </div>`;
  },
  mapFoot(graph, focus) {
    const name = graph.entities.find(e => e.id === focus)?.name;
    return name ? `<button class="mind-btn" data-open-entity="${focus}">${icon('open', 16, 2)}<span>Open ${esc(name)}</span></button>` : '';
  },

  /** Brings a thing to the centre of the map without redrawing it: nodes and lines glide to their new places. */
  focusMap(id, node) {
    const field = this.el.scene.querySelector('.mind-map-field');
    if (this.focusId === id || (!this.focusId && node?.classList.contains('active'))) {
      return this.go(() => { this.leaveFor(id); this.focusId = id; }, 'in', node);
    }
    this.focusId = id;
    if (!field) return this.draw('update');
    const graph = readMind(), { focus, rels, positions, role } = this.mapLayout(graph, id);
    this.motion.settle(this.el.scene);
    field.querySelectorAll('[data-map-focus]').forEach(n => {
      const p = positions.get(n.dataset.mapFocus);
      if (!p) return;
      const was = n.classList.contains('active');
      n.style.setProperty('--x', `${p.x}%`); n.style.setProperty('--y', `${p.y}%`);
      n.classList.remove('active', 'near', 'far', 'is-centred');
      n.classList.add(role(n.dataset.mapFocus));
      n.setAttribute('aria-pressed', String(n.dataset.mapFocus === focus));
      if (n.dataset.mapFocus === focus && !was && !this.motion.off) { void n.offsetWidth; n.classList.add('is-centred'); }
    });
    const near = new Set(rels.filter(r => r.from === focus || r.to === focus).map(r => `${r.from}|${r.to}`));
    field.querySelectorAll('line[data-a]').forEach(l => {
      const on = near.has(`${l.dataset.a}|${l.dataset.b}`) || near.has(`${l.dataset.b}|${l.dataset.a}`);
      l.classList.toggle('near', on); l.classList.toggle('far', !on);
    });
    this.motion.moveLines(field, key => positions.get(key));
    const foot = this.el.scene.querySelector('.mind-map-foot');
    if (foot) foot.innerHTML = this.mapFoot(graph, focus);
  },

  senseView(graph) {
    const active = graph.entities.filter(e => e.status === 'active' && e.type !== 'Desk');
    const degree = id => this.degree(graph, id);
    const links = graph.relationships.filter(r => r.status === 'active' && r.type !== 'contains').length;
    const clusters = graph.rooms.map(r => ({ room: r, count: roomEntities(graph, r).filter(e => e.type !== 'Desk').length })).sort((a, b) => b.count - a.count);
    const most = Math.max(1, ...clusters.map(c => c.count));
    const bridges = active.filter(e => degree(e.id) >= 2).sort((a, b) => degree(b.id) - degree(a.id)).slice(0, 6);
    const quiet = active.filter(e => degree(e.id) === 0).slice(0, 8);
    const dormant = active.filter(e => e.updatedAt && Date.now() - e.updatedAt > 90 * 86400000).slice(0, 6);
    const suggestions = graph.suggestions.filter(s => s.status === 'pending');
    const stat = (label, n, hint) => `<div class="mind-stat"><strong>${count(n)}</strong><span>${label}</span>${hint ? `<small>${hint}</small>` : ''}</div>`;
    const list = (items, group) => `<div class="mind-objects mind-list">${items.map((e, i) => this.object(e, i, graph, group, { row: true })).join('')}</div>`;
    return `<div class="mind-page mind-sense">
      ${this.head({ ico: 'sense', hue: 262, kicker: 'A portrait of your knowledge', title: 'Sense', meta: 'Patterns that emerge from what you have placed and connected.' })}
      <div class="mind-stats">${stat('Things', active.length)}${stat('Connections', links, active.length ? `${(links * 2 / active.length).toFixed(1)} per thing` : '')}${stat('Rooms', graph.rooms.length)}${stat('Waiting', quiet.length, 'not connected yet')}</div>
      <section class="mind-panel mind-sense-chapter"><div class="mind-panel-head"><h3>Where your thoughts gather</h3></div>
        <div class="mind-bubbles">${clusters.map((c, i) => `<button data-open-room="${c.room.id}" data-key="cluster:${c.room.id}" style="--size:${(0.62 + 0.38 * (c.count / most)).toFixed(3)};--order:${i};--hue:${roomHue(c.room.id)}"><span>${esc(c.room.name)}</span><b>${count(c.count)} ${c.count === 1 ? 'thing' : 'things'}</b></button>`).join('') || '<p class="mind-hint">Rooms give your Mind its first shape.</p>'}</div>
      </section>
      <div class="mind-sense-cols">
        <section class="mind-panel"><div class="mind-panel-head"><h3>Bridges</h3><span>Ideas that connect worlds</span></div>${bridges.length ? list(bridges, 'bridge:') : '<p class="mind-hint">Connect two things to reveal bridges.</p>'}</section>
        <section class="mind-panel"><div class="mind-panel-head"><h3>Waiting for a connection</h3><span>Easy to lose</span></div>${quiet.length ? list(quiet, 'edge:') : '<p class="mind-hint">Everything has a connection.</p>'}</section>
      </div>
      ${dormant.length ? `<section class="mind-panel"><div class="mind-panel-head"><h3>Worth revisiting</h3><span>Untouched for three months</span></div>${list(dormant, 'dormant:')}</section>` : ''}
      ${suggestions.length ? `<section class="mind-panel"><div class="mind-panel-head"><h3>Suggested connections</h3><span>From the Assistant</span></div>${suggestions.map(s => `<div class="mind-suggestion" data-key="suggestion:${s.id}"><p><strong>${esc(graph.entities.find(e => e.id === s.from)?.name)}</strong> ${icon('connect', 14, 2)} <strong>${esc(graph.entities.find(e => e.id === s.to)?.name)}</strong><span>${esc(s.reason)}</span></p><div><button class="mind-btn mind-btn-primary" data-review="${s.id}" data-accept="true">Connect</button><button class="mind-btn" data-review="${s.id}" data-accept="false">Dismiss</button></div></div>`).join('')}</section>` : ''}
    </div>`;
  },

  /* ---------------- picker: choose a thing or a room without typing exact names ---------------- */
  pick({ title, hint = '', items, relations = null, placeholder = 'Search…', create = false }) {
    return new Promise((resolve) => {
      const host = this.container.querySelector('.mind');
      const wrap = document.createElement('div');
      wrap.className = 'mind-sheet-wrap';
      wrap.innerHTML = `<div class="mind-sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="mind-sheet-head"><div><h3>${esc(title)}</h3>${hint ? `<p>${esc(hint)}</p>` : ''}</div><button type="button" class="mind-x" data-close aria-label="Close">${icon('x', 16, 2)}</button></div>
        ${relations ? `<div class="mind-relations" role="radiogroup" aria-label="How they are related">${relations.map((r, i) => `<button type="button" role="radio" aria-checked="${i === 0}" data-rel="${esc(r)}">${esc(r)}</button>`).join('')}<input class="mind-rel-custom" placeholder="or your own…" maxlength="40" aria-label="Your own relation"></div>` : ''}
        <label class="mind-sheet-find">${icon('search', 16)}<input type="search" placeholder="${esc(placeholder)}" autocomplete="off"></label>
        <div class="mind-sheet-list" role="listbox"></div>
      </div>`;
      host.appendChild(wrap);
      const sheet = wrap.querySelector('.mind-sheet'), list = wrap.querySelector('.mind-sheet-list'), find = wrap.querySelector('.mind-sheet-find input');
      let relation = relations?.[0] || null;
      const paint = () => {
        const q = find.value.trim().toLowerCase();
        const shown = items.filter(it => !q || it.name.toLowerCase().includes(q) || String(it.sub || '').toLowerCase().includes(q)).slice(0, 80);
        const exact = items.some(it => it.name.toLowerCase() === q);
        list.innerHTML = shown.map(it => `<button type="button" class="mind-sheet-item" role="option" data-id="${esc(it.id)}" style="--hue:${it.hue}"><span class="mind-type-ico">${icon(it.icon, 15, 1.9)}</span><span><strong>${esc(it.name)}</strong>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span></button>`).join('')
          + (create && q && !exact ? `<button type="button" class="mind-sheet-item is-create" role="option" data-create="${esc(find.value.trim())}" style="--hue:${metaOf('Note').hue}"><span class="mind-type-ico">${icon('plus', 15, 2)}</span><span><strong>Create “${esc(find.value.trim())}”</strong><small>As a new note</small></span></button>` : '')
          || '<p class="mind-hint">Nothing to choose yet.</p>';
      };
      const finish = (value) => {
        document.removeEventListener('keydown', onKey, true);
        const done = () => { wrap.remove(); resolve(value); };
        if (this.motion.off || typeof sheet.animate !== 'function') return done();
        wrap.classList.add('is-closing');
        sheet.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(12px) scale(.98)' }], { duration: 160, easing: 'cubic-bezier(.4, 0, 1, 1)' }).finished.then(done, done);
      };
      const choose = (btn) => {
        const custom = wrap.querySelector('.mind-rel-custom')?.value.trim();
        const rel = custom || relation;
        if (btn.dataset.create) finish({ create: btn.dataset.create, relation: rel });
        else finish({ id: btn.dataset.id, relation: rel });
      };
      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(null); return; }
        const opts = [...list.querySelectorAll('.mind-sheet-item')];
        const at = opts.indexOf(document.activeElement);
        if (e.key === 'ArrowDown') { e.preventDefault(); opts[Math.min(opts.length - 1, at + 1)]?.focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); (at <= 0 ? find : opts[at - 1])?.focus(); }
        else if (e.key === 'Enter' && document.activeElement === find && opts[0]) { e.preventDefault(); choose(opts[0]); }
      };
      document.addEventListener('keydown', onKey, true);
      wrap.addEventListener('click', (e) => {
        if (e.target === wrap || e.target.closest('[data-close]')) { finish(null); return; }
        const rel = e.target.closest('[data-rel]');
        if (rel) { relation = rel.dataset.rel; wrap.querySelectorAll('[data-rel]').forEach(b => b.setAttribute('aria-checked', String(b === rel))); return; }
        const item = e.target.closest('.mind-sheet-item');
        if (item) choose(item);
      });
      find.addEventListener('input', paint);
      paint();
      find.focus();
    });
  },
  thingItems(graph, exclude = new Set()) {
    return graph.entities.filter(e => e.status === 'active' && !exclude.has(e.id))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .map(e => ({ id: e.id, name: e.name, sub: e.type, icon: metaOf(e.type).icon, hue: metaOf(e.type).hue }));
  },

  /* ---------------- actions ---------------- */
  closeMenus(except = null) {
    let closed = false;
    this.container.querySelectorAll('.mind-menu:not([hidden])').forEach(menu => {
      if (menu === except) return;
      menu.hidden = true; closed = true;
      menu.previousElementSibling?.setAttribute('aria-expanded', 'false');
    });
    return closed;
  },

  async click(event) {
    const button = event.target.closest('button'); if (!button || !this.container.contains(button) || button.closest('.mind-sheet-wrap')) return;
    const d = button.dataset;
    if (d.action === 'menu') {
      const menu = button.nextElementSibling;
      const open = menu.hidden;
      this.closeMenus(menu);
      menu.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
      if (open) menu.querySelector('button')?.focus({ preventScroll: true });
      return;
    }
    this.closeMenus();
    if (d.mode) {
      // Tactile pop on the mode button while the pill glides to it.
      button.classList.remove('is-picked');
      void button.offsetWidth;
      button.classList.add('is-picked');
      return this.switchMode(d.mode);
    }
    if (d.openRoom) return this.go(() => { this.leaveFor(d.openRoom); this.roomId = d.openRoom; this.focusId = null; this.trail = []; }, 'in', button.closest('.mind-chip') ? null : button);
    if (d.openEntity) return this.go(() => { if (this.view === 'space' && !this.query && this.focusId && this.focusId !== d.openEntity) this.trail.push(this.focusId); this.leaveFor(d.openEntity); this.focusId = d.openEntity; }, 'in', button);
    if (d.mapFocus) return this.focusMap(d.mapFocus, button);
    if (d.filter) { this.filter = d.filter; return this.draw('update'); }
    if (d.unlink) { removeMindRelationship(d.unlink); return this.draw('update'); }
    if (d.leaveRoom) { removeMindMembership(d.leaveRoom, this.focusId); return this.draw('update'); }
    if (d.review) { reviewMindSuggestion(d.review, d.accept === 'true'); return this.draw('update'); }
    if (d.action === 'home') return this.go(() => { this.view = 'space'; this.roomId = this.focusId = this.returnTo = null; this.editDesk = false; this.trail = []; this.query = ''; }, 'out');
    if (d.action === 'room') return this.go(() => { this.view = 'space'; this.roomId = d.id; this.focusId = null; this.editDesk = false; this.trail = []; this.query = ''; }, 'out');
    if (d.action === 'trail') return this.go(() => { const index = this.trail.indexOf(d.id); if (index >= 0) { this.focusId = d.id; this.trail = this.trail.slice(0, index); this.editDesk = false; this.query = ''; } }, 'out');
    if (d.action === 'new-room') return this.createRoom();
    if (d.action === 'rename-room') return this.renameRoom();
    if (d.action === 'delete-room') return this.deleteRoom();
    if (d.action === 'new-entity' || d.action === 'new-desk') return this.createEntity(d.action === 'new-desk' ? 'Desk' : null);
    if (d.action === 'edit-desk') return this.go(() => { this.editDesk = true; }, 'in');
    if (d.action === 'place-existing') return this.placeExisting();
    if (d.action === 'connect') return this.connect();
    if (d.action === 'add-to-room') return this.addToRoom();
    if (d.action === 'add-prop') { const list = button.parentElement.querySelector('.mind-props'); list.insertAdjacentHTML('beforeend', this.propRow()); list.lastElementChild.querySelector('input').focus(); return this.markDirty(button.closest('form')); }
    if (d.action === 'remove-prop') { const form = button.closest('form'); button.closest('.mind-prop').remove(); return this.markDirty(form); }
    if (d.action === 'supersede') {
      const yes = await showDialog({ type: 'confirm', title: 'Mark as outdated?', message: 'It leaves your rooms, the map and the Assistant’s memory, but is kept in your history.', confirmText: 'Mark as outdated' });
      if (!yes) return;
      supersedeMindEntity(this.focusId);
      return this.go(() => { this.focusId = this.trail.pop() || null; }, 'out');
    }
    if (d.action === 'delete-entity') return this.removeEntity();
  },

  /** The editor shows when there is something to save, and keeps slider read-outs current. */
  markDirty(form, field = null) {
    if (!form) return;
    if (field?.type === 'range') { const out = field.closest('.mind-range')?.querySelector('output'); if (out) out.textContent = `${Math.round(Number(field.value) * 100)}%`; }
    const save = form.querySelector('[type="submit"]');
    if (save) save.disabled = false;
    const state = form.querySelector('.mind-save-state');
    if (state) { state.textContent = 'Unsaved changes'; state.classList.add('is-dirty'); }
  },

  /** Quick capture: a name and a kind, straight into Mind (and into the room you are in). */
  saveCapture(form) {
    const name = String(new FormData(form).get('name') || '').trim();
    if (!name) { form.querySelector('input')?.focus(); return; }
    const type = String(new FormData(form).get('type') || 'Note');
    const entity = upsertMindEntity({ name, type, memoryType: 'explicit' });
    const graph = readMind(), room = graph.rooms.find(r => r.id === this.roomId);
    if (room?.mode === 'manual' && this.view === 'space' && !this.focusId) addMindMembership(room.id, entity.id);
    this.draw('update');
  },

  async createRoom() {
    const name = await showDialog({ type: 'prompt', title: 'New room', message: 'Name an area of your life: people, work, music, a place…', confirmText: 'Create' });
    if (!name?.trim()) return;
    const room = addMindRoom(name);
    this.go(() => { this.view = 'space'; this.roomId = room.id; this.focusId = null; this.editDesk = false; this.trail = []; this.query = ''; this.returnTo = null; }, 'in');
  },
  async renameRoom() {
    const graph = readMind(), room = graph.rooms.find(r => r.id === this.roomId); if (!room) return;
    const name = await showDialog({ type: 'prompt', title: 'Rename room', defaultValue: room.name, confirmText: 'Save' });
    if (!name?.trim()) return;
    room.name = name.trim().slice(0, 120); room.updatedAt = Date.now(); writeMind(graph); this.draw('update');
  },
  async deleteRoom() {
    const room = readMind().rooms.find(r => r.id === this.roomId); if (!room) return;
    const yes = await showDialog({ type: 'confirm', destructive: true, title: 'Delete room?', message: `Remove ${room.name} from Mind? Its things stay in Mind and in their other rooms.`, confirmText: 'Delete room' });
    if (!yes) return;
    removeMindRoom(room.id);
    this.go(() => { this.roomId = this.focusId = null; this.trail = []; this.editDesk = false; }, 'out');
  },
  async createEntity(type = null) {
    const name = await showDialog({ type: 'prompt', title: type === 'Desk' ? 'New desk' : 'Add to Mind', message: type === 'Desk' ? 'Name a place inside this room.' : 'Name a person, idea, project, memory, or anything that matters.', confirmText: 'Add' });
    if (!name?.trim()) return;
    const entity = upsertMindEntity({ name, type: type || 'Note', memoryType: 'explicit' });
    const parent = readMind().entities.find(e => e.id === this.focusId && e.type === 'Desk')?.id || null;
    if (readMind().rooms.find(r => r.id === this.roomId)?.mode === 'manual' && this.view === 'space') addMindMembership(this.roomId, entity.id, parent);
    if (parent) relateMindEntities(parent, entity.id, 'contains');
    this.go(() => { if (parent) this.trail.push(parent); this.leaveFor(entity.id); this.focusId = entity.id; }, 'in');
  },
  async placeExisting() {
    const graph = readMind(), parent = graph.entities.find(e => e.id === this.focusId && e.type === 'Desk')?.id || null;
    const room = graph.rooms.find(r => r.id === this.roomId);
    const here = new Set([...(room ? roomEntities(graph, room).map(e => e.id) : []), ...(parent ? this.deskItems(graph, { id: parent }).map(e => e.id) : []), parent].filter(Boolean));
    const picked = await this.pick({ title: parent ? 'Place on this desk' : `Place in ${room?.name || 'this room'}`, hint: 'It stays the same thing everywhere it appears.', items: this.thingItems(graph, here).filter(it => it.sub !== 'Desk' || !parent), placeholder: 'Find a thing…', create: true });
    if (!picked) return;
    const id = picked.create ? upsertMindEntity({ name: picked.create, type: 'Note', memoryType: 'explicit' }).id : picked.id;
    if (room?.mode === 'manual') addMindMembership(room.id, id, parent);
    if (parent) relateMindEntities(parent, id, 'contains');
    this.draw('update');
  },
  async connect() {
    const graph = readMind();
    const linked = new Set([this.focusId, ...graph.relationships.filter(r => r.status === 'active' && (r.from === this.focusId || r.to === this.focusId)).flatMap(r => [r.from, r.to])]);
    const picked = await this.pick({ title: 'Connect to…', hint: 'Choose how they are related, then the thing.', items: this.thingItems(graph, linked), relations: RELATIONS, placeholder: 'Find a person, idea, memory…', create: true });
    if (!picked) return;
    const id = picked.create ? upsertMindEntity({ name: picked.create, type: 'Note', memoryType: 'explicit' }).id : picked.id;
    relateMindEntities(this.focusId, id, picked.relation || 'related');
    this.draw('update');
  },
  async addToRoom() {
    const graph = readMind();
    const inRooms = new Set(graph.rooms.filter(r => roomEntities(graph, r).some(e => e.id === this.focusId)).map(r => r.id));
    const items = graph.rooms.filter(r => r.mode === 'manual' && !inRooms.has(r.id)).map(r => ({ id: r.id, name: r.name, sub: `${roomEntities(graph, r).length} things`, icon: 'room', hue: roomHue(r.id) }));
    const picked = await this.pick({ title: 'Add to a room', items, placeholder: 'Find a room…' });
    if (!picked?.id) return;
    addMindMembership(picked.id, this.focusId);
    this.draw('update');
  },
  async saveEntity(form) {
    const data = new FormData(form), id = form.dataset.id;
    // Properties are edited as rows; values that read as numbers, true/false or JSON keep their type.
    const properties = {};
    const keys = data.getAll('propKey'), values = data.getAll('propValue');
    keys.forEach((k, i) => {
      const key = String(k).trim().slice(0, 60);
      if (!key) return;
      const raw = String(values[i] ?? '').trim();
      let value = raw;
      if (/^(-?\d+(\.\d+)?|true|false|null|\[.*\]|\{.*\})$/s.test(raw)) { try { value = JSON.parse(raw); } catch { value = raw; } }
      properties[key] = value;
    });
    const existing = readMind().entities.find(e => e.id === id);
    if (existing?.properties?.origin) properties.origin = existing.properties.origin;
    upsertMindEntity({ id, name: data.get('name'), type: data.get('type'), content: data.get('content'), memoryType: data.get('memoryType'), access: data.get('access'), importance: data.get('importance'), confidence: data.get('confidence'), properties, replaceProperties: true });
    const wasOpen = form.querySelector('.mind-more')?.open;
    await this.draw('update');
    const fresh = this.el.scene.querySelector('[data-entity-form]');
    if (wasOpen && fresh) fresh.querySelector('.mind-more').open = true;
    // The page stays as it was; the button confirms the save in place.
    const save = fresh?.querySelector('[type="submit"]'), state = fresh?.querySelector('.mind-save-state');
    if (save) { save.disabled = false; save.focus({ preventScroll: true }); save.classList.add('is-saved'); save.querySelector('span').textContent = 'Saved'; }
    if (state) state.textContent = 'All changes saved';
    this.motion.later(() => { if (save?.isConnected) { save.classList.remove('is-saved'); save.querySelector('span').textContent = 'Save'; save.disabled = true; } }, 1600);
  },
  async removeEntity() {
    const entity = readMind().entities.find(e => e.id === this.focusId);
    if (!entity) return;
    const yes = await showDialog({ type: 'confirm', destructive: true, title: entity.type === 'Desk' ? 'Delete desk?' : 'Delete from Mind?', message: `Delete ${entity.name} and its connections everywhere? This cannot be undone.`, confirmText: 'Delete' });
    if (yes) { forgetMindEntity(entity.id); this.go(() => { this.focusId = this.trail.pop() || null; }, 'out'); }
  },
  destroy() {
    this.drawn++;
    this.modesRO?.disconnect();
    this.motion?.destroy();
    this.unlight?.();
    this.container?.querySelector('.mind-sheet-wrap')?.remove();
    this.container?.removeEventListener('click', this.onClick);
    this.container?.removeEventListener('input', this.onInput);
    this.container?.removeEventListener('submit', this.onSubmit);
    this.container?.removeEventListener('keydown', this.onKey);
  },
};
