/* ============================================================
   TOOLBOX — Mind

   Personal Knowledge Graph & Mind Palace.  The header stays put
   while the scene below it changes, and every change says where
   you went (lib/mind-motion.js): into a room or a thing zooms in
   and the card you tapped becomes the page, back zooms out into
   that card again, the three modes slide side by side, and edits
   inside a view move only what changed.
   ============================================================ */

import { readMind, writeMind, addMindRoom, removeMindRoom, upsertMindEntity, addMindMembership, roomEntities, relateMindEntities, forgetMindEntity, supersedeMindEntity, recallMind, reviewMindSuggestion } from '../lib/mind-store.js';
import { showDialog } from '../lib/dialog.js';
import { MindMotion, movePill, mindPointerLight } from '../lib/mind-motion.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TYPES = ['Person', 'Song', 'Artist', 'Project', 'Idea', 'Memory', 'Place', 'Technology', 'Media', 'Note', 'Link', 'Custom', 'Desk'];
const MODES = [['space', 'Space'], ['map', 'Map'], ['sense', 'Sense']];
const date = ts => ts ? new Date(ts).toLocaleDateString() : '';

export default {
  render(container) {
    this.container = container; this.roomId = null; this.focusId = null; this.trail = []; this.editDesk = false; this.view = 'space'; this.query = '';
    this.drawn = 0; this.lastKey = null; this.returnTo = null;
    this.motion = new MindMotion(container);
    container.innerHTML = `<main class="mind">
      <header class="mind-top"><div><span class="mind-eyebrow">YOUR INNER WORLD</span><h1>Mind<span>.</span></h1></div>
      <div class="mind-top-controls">
        <nav class="mind-modes" aria-label="Mind views">${MODES.map(([key, label]) => `<button type="button" data-mode="${key}">${label}</button>`).join('')}</nav>
        <button class="btn btn-primary" data-action="new-room">New room</button>
      </div></header>
      <div class="mind-subhead"><nav class="mind-path" aria-label="Mind location"></nav>
      <label class="mind-find"><span class="visually-hidden">Search Mind</span><input type="search" data-search placeholder="Find a person, idea, memory…"></label></div>
      <section class="mind-scene" aria-live="polite"></section>
    </main>`;
    this.el = { modes: container.querySelector('.mind-modes'), path: container.querySelector('.mind-path'), scene: container.querySelector('.mind-scene'), search: container.querySelector('[data-search]') };
    this.onClick = e => this.click(e);
    this.onInput = e => {
      if (e.target === this.el.search) { this.query = e.target.value; this.draw('update'); }
    };
    this.onSubmit = e => { if (e.target.matches('[data-entity-form]')) { e.preventDefault(); this.saveEntity(e.target); } };
    this.onKey = e => {
      if (e.key !== 'Escape' || this.view !== 'space' || (e.target === this.el.search && this.query)) return;
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

    // Keep keyboard focus in Mind, so Escape keeps working: on the new page, or the card we came out of.
    if (kind !== 'update' && kind !== 'first' && (hadFocus || document.activeElement === document.body)) {
      const heading = scene.querySelector('.mind-scene-heading h2');
      const next = target || heading;
      if (next) { if (next === heading) heading.tabIndex = -1; next.focus({ preventScroll: true }); }
    }
  },

  /** Mode switcher and breadcrumbs: they never leave the screen, so they simply update. */
  chrome(kind) {
    const graph = readMind(), room = graph.rooms.find(r => r.id === this.roomId), focus = graph.entities.find(e => e.id === this.focusId);
    this.el.modes.querySelectorAll('[data-mode]').forEach(b => {
      const on = b.dataset.mode === this.view;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    movePill(this.el.modes);
    if (this.el.search.value !== this.query) this.el.search.value = this.query;
    const crumbs = [`<button data-action="home">Mind</button>`];
    if (room) crumbs.push(`<button data-action="room" data-id="${room.id}">${esc(room.name)}</button>`);
    this.trail.map(id => graph.entities.find(e => e.id === id)).filter(Boolean).forEach(e => crumbs.push(`<button data-action="trail" data-id="${e.id}">${esc(e.name)}</button>`));
    if (focus && this.view === 'space') crumbs.push(`<strong>${esc(focus.name)}</strong>`);
    const html = crumbs.join('<span>/</span>');
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

  /* ---------------- views ----------------
     Parts that can stay on screen while a view changes carry data-key,
     so the motion can tell what moved, what is new and what has gone. */
  homeView(graph) {
    const n = graph.rooms.length;
    return `<div class="mind-space mind-home"><div class="mind-self"><small>AT THE CENTRE</small><strong>You</strong><span><span class="mind-count" data-count="${n}">${n}</span> ${n === 1 ? 'room' : 'rooms'} in your Mind</span></div>
      <div class="mind-orbit" style="--count:${Math.max(n,1)}">${graph.rooms.map((r,i) => {
        const theta = (i / Math.max(n,1)) * Math.PI * 2 - Math.PI / 2;
        const x = Math.round(Math.cos(theta) * 39), y = Math.round(Math.sin(theta) * 38), count = roomEntities(graph,r).length;
        return `<button class="mind-object mind-room" style="--x:${x}%;--y:${y}%;--order:${i}" data-open-room="${r.id}" data-key="room:${r.id}"><small>${r.mode === 'smart' ? 'SMART ROOM' : 'ROOM'}</small><strong>${esc(r.name)}</strong><span><span class="mind-count" data-count="${count}">${count}</span> things</span></button>`;
      }).join('')}</div>
      ${!n ? '<p class="mind-empty">Begin with a room for an area of your life.</p>' : ''}</div>`;
  },

  roomView(graph, room) {
    const members = roomEntities(graph, room).filter(e => room.mode === 'smart' || graph.memberships.some(m => m.roomId === room.id && m.entityId === e.id && !m.parentId));
    const desks = members.filter(e => e.type === 'Desk'), others = members.filter(e => e.type !== 'Desk');
    return `<div class="mind-room-scene"><div class="mind-scene-heading"><small>${room.mode === 'smart' ? 'A LIVING COLLECTION' : 'A ROOM IN YOUR MIND'}</small><h2>${esc(room.name)}</h2><p><span class="mind-count" data-count="${members.length}">${members.length}</span> things live here</p></div>
      <div class="mind-scene-actions">${room.mode === 'manual' ? '<button class="btn" data-action="new-entity">Add something</button><button class="btn" data-action="place-existing">Place existing</button><button class="btn btn-ghost" data-action="new-desk">New desk</button>' : ''}<button class="btn btn-ghost" data-action="rename-room">Rename</button><button class="btn btn-ghost" data-action="delete-room">Delete room</button></div>
      <div class="mind-objects">${[...desks,...others].map((e,i) => this.object(e, i, graph)).join('') || '<p class="mind-empty" data-key="empty">Add a person, project, idea, memory, or desk to begin.</p>'}</div></div>`;
  },

  deskView(graph, desk) {
    const children = graph.relationships.filter(r => r.status === 'active' && r.type === 'contains' && r.from === desk.id)
      .map(r => graph.entities.find(e => e.id === r.to)).filter(e => e?.status === 'active');
    return `<div class="mind-desk-scene"><div class="mind-scene-heading"><small>INSIDE THE DESK</small><h2>${esc(desk.name)}</h2><p><span class="mind-count" data-count="${children.length}">${children.length}</span> ${children.length === 1 ? 'thing' : 'things'} gathered here</p></div>
      <div class="mind-scene-actions"><button class="btn" data-action="new-entity">Add something</button><button class="btn" data-action="place-existing">Place existing</button><button class="btn btn-ghost" data-action="edit-desk">Edit desk</button></div>
      <div class="mind-objects">${children.map((e,i) => this.object(e,i,graph)).join('') || '<p class="mind-empty" data-key="empty">Place a note, person, project, or idea at this desk.</p>'}</div></div>`;
  },

  object(e, i, graph, group = '') {
    const count = graph.relationships.filter(r => r.status === 'active' && (r.from === e.id || r.to === e.id)).length;
    return `<button class="mind-object mind-entity" style="--order:${i}" data-open-entity="${e.id}" data-key="${group}${e.id}"><small>${esc(e.type)}</small><strong>${esc(e.name)}</strong><span>${count ? `<span class="mind-count" data-count="${count}">${count}</span> connections` : esc(e.content?.slice(0, 72) || 'Open to explore')}</span></button>`;
  },

  entityView(graph, entity) {
    const links = graph.relationships.filter(r => r.status === 'active' && (r.from === entity.id || r.to === entity.id));
    const sources = (entity.sourceIds || []).map(id => graph.sources.find(s => s.id === id)).filter(Boolean);
    return `<div class="mind-detail"><div class="mind-scene-heading"><small>${esc(entity.type)} · ${esc(entity.memoryType || 'explicit')} memory</small><h2>${esc(entity.name)}</h2><p><span class="mind-count" data-count="${links.length}">${links.length}</span> relationships · Updated ${date(entity.updatedAt)}</p></div>
      <form data-entity-form class="mind-editor" data-id="${entity.id}">
        <label>Name<input name="name" value="${esc(entity.name)}" required maxlength="120"></label>
        <label>Kind<select name="type">${TYPES.map(t => `<option ${entity.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="mind-editor-wide">What you know<textarea name="content" rows="7">${esc(entity.content || '')}</textarea></label>
        <label>Memory type<select name="memoryType">${['explicit','learned','episodic'].map(t => `<option value="${t}" ${entity.memoryType === t ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select></label>
        <label>Access<select name="access">${['private','shared'].map(t => `<option value="${t}" ${entity.access === t ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select></label>
        <label>Importance <input name="importance" type="range" min="0" max="1" step=".1" value="${entity.importance ?? .5}"></label>
        <label>Confidence <input name="confidence" type="range" min="0" max="1" step=".1" value="${entity.confidence ?? 1}"></label>
        <label class="mind-editor-wide">Custom properties (JSON)<textarea name="properties" rows="3" spellcheck="false">${esc(JSON.stringify(entity.properties || {}, null, 2))}</textarea></label>
        <div class="mind-editor-actions"><button class="btn btn-primary" type="submit">Save</button><button class="btn btn-ghost" type="button" data-action="connect">Connect</button><button class="btn btn-ghost" type="button" data-action="supersede">Supersede</button><button class="btn btn-ghost" type="button" data-action="delete-entity">Delete</button></div>
      </form>
      <aside class="mind-related"><h3>Relationships</h3>${links.map(r => {
        const other = graph.entities.find(e => e.id === (r.from === entity.id ? r.to : r.from));
        return other ? `<button data-open-entity="${other.id}" data-key="rel:${r.id}"><span>${esc(r.type)}</span><strong>${esc(other.name)}</strong></button>` : '';
      }).join('') || '<p data-key="rel:none">No connections yet.</p>'}
      ${sources.length ? `<h3>Sources</h3>${sources.map(s => `<p>${esc(s.kind)} · ${esc(s.ref)}${s.excerpt ? ` — ${esc(s.excerpt)}` : ''}</p>`).join('')}` : ''}</aside></div>`;
  },

  searchView(items, graph) {
    return `<div class="mind-results"><div class="mind-scene-heading"><small>SEARCH YOUR MIND</small><h2><span class="mind-count" data-count="${items.length}">${items.length}</span> ${items.length === 1 ? 'match' : 'matches'}</h2></div><div class="mind-objects">${items.map((e,i) => this.object(e, i, graph)).join('') || '<p class="mind-empty" data-key="empty">Nothing found. Try another phrase.</p>'}</div></div>`;
  },

  /** Lays the map out around one thing: it sits at the centre, its connections closest to it. */
  mapLayout(graph, focusId) {
    const nodes = graph.entities.filter(e => e.status === 'active').slice(0, 80), ids = new Set(nodes.map(e => e.id));
    const focus = focusId && ids.has(focusId) ? focusId : nodes[0]?.id;
    const rels = graph.relationships.filter(r => r.status === 'active' && ids.has(r.from) && ids.has(r.to));
    const near = new Set(rels.filter(r => r.from === focus || r.to === focus).flatMap(r => [r.from, r.to]));
    const rank = e => e.id === focus ? 0 : near.has(e.id) ? 1 : 2;
    const ordered = [...nodes].sort((a,b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    const positions = new Map(ordered.map((e,i) => {
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
    return `<div class="mind-map"><div class="mind-scene-heading"><small>ASSOCIATIONS</small><h2>Map</h2><p>Select a thing to bring its relationships forward. Select it again to open it.</p></div><div class="mind-map-field">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines.map(({ r, a, b }) => {
        const p = positions.get(a), q = positions.get(b);
        return `<line data-a="${a}" data-b="${b}" x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" class="${a === focus ? 'near' : 'far'}"/>`;
      }).join('')}</svg>
      ${nodes.map(e => {
        const p = positions.get(e.id);
        return `<button class="mind-map-node ${role(e.id)}" style="--x:${p.x}%;--y:${p.y}%" data-map-focus="${e.id}" aria-pressed="${e.id === focus}"><small>${esc(e.type)}</small><strong>${esc(e.name)}</strong></button>`;
      }).join('')}${!nodes.length ? '<div class="mind-map-empty"><p>Connections appear as your Mind grows.</p><button class="btn" data-action="new-room">Create a room</button></div>' : ''}</div><div class="mind-map-foot">${this.mapFoot(graph, focus)}</div></div>`;
  },
  mapFoot(graph, focus) {
    const name = graph.entities.find(e => e.id === focus)?.name;
    return name ? `<button class="btn" data-open-entity="${focus}">Open ${esc(name)}</button>` : '';
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
    const active = graph.entities.filter(e => e.status === 'active');
    const degree = id => graph.relationships.filter(r => r.status === 'active' && (r.from === id || r.to === id)).length;
    const clusters = graph.rooms.map(r => ({ room: r, count: roomEntities(graph,r).length })).sort((a,b) => b.count - a.count);
    const bridges = active.filter(e => degree(e.id) >= 2).sort((a,b) => degree(b.id) - degree(a.id)).slice(0,5);
    const quiet = active.filter(e => degree(e.id) === 0).slice(0,8);
    const dormant = active.filter(e => e.updatedAt && Date.now() - e.updatedAt > 90 * 86400000).slice(0,8);
    const suggestions = graph.suggestions.filter(s => s.status === 'pending');
    return `<div class="mind-sense"><div class="mind-scene-heading"><small>A PORTRAIT OF YOUR KNOWLEDGE</small><h2>Sense</h2><p>Patterns emerge from the things you have placed and connected.</p></div>
      <section class="mind-sense-chapter"><small>01 / CLUSTERS</small><h3>Where your thoughts gather</h3><div class="mind-sense-bars">${clusters.map((c,i) => `<button data-open-room="${c.room.id}" data-key="cluster:${c.room.id}" style="--diameter:${Math.min(250, 138 + c.count * 14)}px;--order:${i}"><i aria-hidden="true"></i><span>${esc(c.room.name)}</span><b><span class="mind-count" data-count="${c.count}">${c.count}</span> ${c.count === 1 ? 'thing' : 'things'}</b></button>`).join('') || '<p>Rooms will give your Mind its first shape.</p>'}</div></section>
      <section class="mind-sense-chapter"><small>02 / BRIDGES</small><h3>The ideas that connect worlds</h3><div class="mind-sense-constellation bridges">${bridges.map((e,i) => this.object(e,i,graph,'bridge:')).join('') || '<p>Connect two things to reveal bridges.</p>'}</div></section>
      <section class="mind-sense-chapter"><small>03 / EDGES</small><h3>Things waiting for a connection</h3><div class="mind-sense-constellation edges">${quiet.map((e,i) => this.object(e,i,graph,'edge:')).join('') || '<p>Everything has a connection.</p>'}</div></section>
      ${dormant.length ? `<section class="mind-sense-chapter"><small>04 / DORMANT</small><h3>Worth revisiting</h3><div class="mind-sense-constellation">${dormant.map((e,i) => this.object(e,i,graph,'dormant:')).join('')}</div></section>` : ''}
      ${suggestions.length ? `<section class="mind-sense-chapter"><small>FOR YOUR REVIEW</small><h3>Suggested connections</h3>${suggestions.map(s => `<p class="mind-suggestion" data-key="suggestion:${s.id}">${esc(graph.entities.find(e => e.id === s.from)?.name)} ↔ ${esc(graph.entities.find(e => e.id === s.to)?.name)} · ${esc(s.reason)} <button data-review="${s.id}" data-accept="true">Connect</button> <button data-review="${s.id}" data-accept="false">Dismiss</button></p>`).join('')}</section>` : ''}</div>`;
  },

  /* ---------------- actions ---------------- */
  async click(event) {
    const button = event.target.closest('button'); if (!button || !this.container.contains(button)) return;
    const d = button.dataset;
    if (d.mode) {
      // Tactile pop on the mode button while the pill glides to it.
      button.classList.remove('is-picked');
      void button.offsetWidth;
      button.classList.add('is-picked');
      return this.switchMode(d.mode);
    }
    if (d.openRoom) return this.go(() => { this.leaveFor(d.openRoom); this.roomId = d.openRoom; this.focusId = null; this.trail = []; }, 'in', button);
    if (d.openEntity) return this.go(() => { if (this.view === 'space' && !this.query && this.focusId && this.focusId !== d.openEntity) this.trail.push(this.focusId); this.leaveFor(d.openEntity); this.focusId = d.openEntity; }, 'in', button);
    if (d.mapFocus) return this.focusMap(d.mapFocus, button);
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
    if (d.action === 'supersede') { supersedeMindEntity(this.focusId); return this.go(() => { this.focusId = this.trail.pop() || null; }, 'out'); }
    if (d.action === 'delete-entity') return this.removeEntity();
  },

  async createRoom() {
    const name = await showDialog({ type: 'prompt', title: 'New room', message: 'Name an area of your world.', confirmText: 'Create' });
    if (!name?.trim()) return;
    const room = addMindRoom(name);
    this.go(() => { this.view = 'space'; this.roomId = room.id; this.focusId = null; this.editDesk = false; this.trail = []; this.query = ''; }, 'in');
  },
  async renameRoom() {
    const graph = readMind(), room = graph.rooms.find(r => r.id === this.roomId); if (!room) return;
    const name = await showDialog({ type: 'prompt', title: 'Rename room', defaultValue: room.name, confirmText: 'Save' });
    if (!name?.trim()) return;
    room.name = name.trim().slice(0,120); room.updatedAt = Date.now(); writeMind(graph); this.draw('update');
  },
  async deleteRoom() {
    const room = readMind().rooms.find(r => r.id === this.roomId); if (!room) return;
    const yes = await showDialog({ type: 'confirm', destructive: true, title: 'Delete room?', message: `Remove ${room.name} from Mind? Its things remain available in search and other rooms.`, confirmText: 'Delete room' });
    if (!yes) return;
    removeMindRoom(room.id);
    this.go(() => { this.roomId = this.focusId = null; this.trail = []; this.editDesk = false; }, 'out');
  },
  async createEntity(type = null) {
    const name = await showDialog({ type: 'prompt', title: type === 'Desk' ? 'New desk' : 'Add to Mind', message: 'Name a person, idea, project, memory, or anything that matters.', confirmText: 'Add' });
    if (!name?.trim()) return;
    const entity = upsertMindEntity({ name, type: type || 'Note', memoryType: 'explicit' });
    const parent = readMind().entities.find(e => e.id === this.focusId && e.type === 'Desk')?.id || null;
    if (readMind().rooms.find(r => r.id === this.roomId)?.mode === 'manual') addMindMembership(this.roomId, entity.id, parent);
    if (parent) relateMindEntities(parent, entity.id, 'contains');
    this.go(() => { if (parent) this.trail.push(parent); this.focusId = entity.id; this.editDesk = false; }, 'in');
  },
  async placeExisting() {
    const graph = readMind(), name = await showDialog({ type: 'prompt', title: 'Place existing thing', message: 'Enter its exact name. It will stay the same thing everywhere.', confirmText: 'Place' });
    if (!name) return;
    const found = graph.entities.find(e => e.status === 'active' && e.name.toLowerCase() === name.trim().toLowerCase());
    if (!found) return showDialog({ title: 'Not found', message: 'Search Mind for the exact name, or add a new thing.' });
    const parent = graph.entities.find(e => e.id === this.focusId && e.type === 'Desk')?.id || null;
    if (graph.rooms.find(r => r.id === this.roomId)?.mode === 'manual') addMindMembership(this.roomId, found.id, parent);
    if (parent) relateMindEntities(parent, found.id, 'contains');
    this.draw('update');
  },
  async connect() {
    const graph = readMind(), name = await showDialog({ type: 'prompt', title: 'Connect to', message: 'Enter the exact name of another thing in Mind.', confirmText: 'Connect' });
    if (!name) return;
    const found = graph.entities.find(e => e.id !== this.focusId && e.name.toLowerCase() === name.trim().toLowerCase());
    if (!found) return showDialog({ title: 'Not found', message: 'Choose an existing thing in Mind.' });
    const type = await showDialog({ type: 'prompt', title: 'How are they related?', defaultValue: 'related', confirmText: 'Save connection' });
    if (!type) return;
    relateMindEntities(this.focusId, found.id, type); this.draw('update');
  },
  async saveEntity(form) {
    const data = new FormData(form), id = form.dataset.id;
    let properties;
    try { properties = JSON.parse(data.get('properties') || '{}'); if (!properties || typeof properties !== 'object' || Array.isArray(properties)) throw new Error(); }
    catch { showDialog({ title: 'Check custom properties', message: 'Enter a JSON object, such as {"category":"music"}.' }); return; }
    upsertMindEntity({ id, name: data.get('name'), type: data.get('type'), content: data.get('content'), memoryType: data.get('memoryType'), access: data.get('access'), importance: data.get('importance'), confidence: data.get('confidence'), properties, replaceProperties: true });
    await this.draw('update');
    // The page stays as it was; the button confirms the save in place.
    const save = this.el.scene.querySelector('[data-entity-form] [type="submit"]');
    if (save) { save.focus({ preventScroll: true }); save.textContent = 'Saved'; save.classList.add('is-saved'); this.motion.later(() => { save.textContent = 'Save'; save.classList.remove('is-saved'); }, 1600); }
  },
  async removeEntity() {
    const entity = readMind().entities.find(e => e.id === this.focusId);
    if (!entity) return;
    const yes = await showDialog({ type: 'confirm', destructive: true, title: 'Delete from Mind?', message: `Delete ${entity.name} and its connections everywhere?`, confirmText: 'Delete' });
    if (yes) { forgetMindEntity(entity.id); this.go(() => { this.focusId = this.trail.pop() || null; }, 'out'); }
  },
  destroy() {
    this.drawn++;
    this.modesRO?.disconnect();
    this.motion?.destroy();
    this.unlight?.();
    this.container?.removeEventListener('click', this.onClick);
    this.container?.removeEventListener('input', this.onInput);
    this.container?.removeEventListener('submit', this.onSubmit);
    this.container?.removeEventListener('keydown', this.onKey);
  },
};
