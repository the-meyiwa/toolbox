import { readMind, writeMind, addMindRoom, removeMindRoom, upsertMindEntity, addMindMembership, roomEntities, relateMindEntities, forgetMindEntity, supersedeMindEntity, recallMind, compiledMind, reviewMindSuggestion } from '../lib/mind-store.js';
import { showDialog } from '../lib/dialog.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const TYPES = ['Person', 'Song', 'Artist', 'Project', 'Idea', 'Memory', 'Place', 'Technology', 'Media', 'Note', 'Link', 'Custom', 'Desk'];
const date = ts => ts ? new Date(ts).toLocaleDateString() : '';

export default {
  render(container) {
    this.container = container; this.roomId = null; this.focusId = null; this.trail = []; this.editDesk = false; this.view = 'space'; this.query = '';
    this.onClick = e => this.click(e);
    this.onInput = e => {
      if (e.target.matches('[data-search]')) {
        this.query = e.target.value;
        this.paint({ transition: false, preserveSearch: true });
      }
    };
    this.onSubmit = e => { if (e.target.matches('[data-entity-form]')) { e.preventDefault(); this.saveEntity(e.target); } };
    this.onKey = e => { if (e.key === 'Escape' && (this.focusId || this.roomId)) { this.back(); } };
    container.addEventListener('click', this.onClick);
    container.addEventListener('input', this.onInput);
    container.addEventListener('submit', this.onSubmit);
    container.addEventListener('keydown', this.onKey);
    this.paint({ transition: false });
  },
  navigate(change) {
    if (!reduce() && document.startViewTransition) document.startViewTransition(() => { change(); this.paint({ transition: false }); });
    else { change(); this.paint({ transition: !reduce() }); }
  },
  back() {
    this.navigate(() => { if (this.editDesk) this.editDesk = false; else if (this.focusId) this.focusId = this.trail.pop() || null; else this.roomId = null; });
  },
  paint({ transition = true, preserveSearch = false } = {}) {
    const root = this.container, wasFocused = preserveSearch && root.querySelector('[data-search]') === document.activeElement;
    const cursor = wasFocused ? root.querySelector('[data-search]').selectionStart : null;
    const graph = readMind(), room = graph.rooms.find(r => r.id === this.roomId), focus = graph.entities.find(e => e.id === this.focusId);
    const matches = this.query.trim() ? recallMind(this.query, 30) : null;
    root.innerHTML = `<main class="mind ${transition ? 'mind-enter' : ''}" data-view="${this.view}">
      <header class="mind-top"><div><span class="mind-eyebrow">YOUR INNER WORLD</span><h1>Mind<span>.</span></h1></div>
      <div class="mind-top-controls">
        <nav class="mind-modes" aria-label="Mind views">
          ${[['space','Space'],['map','Map'],['sense','Sense']].map(([key,label]) => `<button type="button" data-mode="${key}" class="${this.view === key ? 'active' : ''}" aria-pressed="${this.view === key}">${label}</button>`).join('')}
        </nav>
        <button class="btn btn-primary" data-action="new-room">New room</button>
      </div></header>
      <div class="mind-subhead"><nav class="mind-path" aria-label="Mind location"><button data-action="home">Mind</button>${room ? `<span>/</span><button data-action="room" data-id="${room.id}">${esc(room.name)}</button>` : ''}${this.trail.map(id => graph.entities.find(e => e.id === id)).filter(Boolean).map(e => `<span>/</span><button data-action="trail" data-id="${e.id}">${esc(e.name)}</button>`).join('')}${focus ? `<span>/</span><strong>${esc(focus.name)}</strong>` : ''}</nav>
      <label class="mind-find"><span class="visually-hidden">Search Mind</span><input type="search" data-search placeholder="Find a person, idea, memory…" value="${esc(this.query)}"></label></div>
      <section class="mind-scene" aria-live="polite">
      ${matches ? this.searchView(matches) : this.view === 'map' ? this.mapView(graph) : this.view === 'sense' ? this.senseView(graph) : focus?.type === 'Desk' && !this.editDesk ? this.deskView(graph, focus) : focus ? this.entityView(graph, focus) : room ? this.roomView(graph, room) : this.homeView(graph)}
      </section></main>`;
    if (wasFocused) { const input = root.querySelector('[data-search]'); input.focus(); input.setSelectionRange(cursor, cursor); }
  },
  homeView(graph) {
    const n = graph.rooms.length;
    return `<div class="mind-space mind-home"><div class="mind-self"><small>AT THE CENTRE</small><strong>You</strong><span>${n} ${n === 1 ? 'room' : 'rooms'} in your Mind</span></div>
      <div class="mind-orbit" style="--count:${Math.max(n,1)}">${graph.rooms.map((r,i) => {
        const theta = (i / Math.max(n,1)) * Math.PI * 2 - Math.PI / 2;
        const x = Math.round(Math.cos(theta) * 39), y = Math.round(Math.sin(theta) * 38);
        return `<button class="mind-object mind-room" style="--x:${x}%;--y:${y}%;--order:${i};view-transition-name:mind-${r.id}" data-open-room="${r.id}"><small>${r.mode === 'smart' ? 'SMART ROOM' : 'ROOM'}</small><strong>${esc(r.name)}</strong><span>${roomEntities(graph,r).length} things</span></button>`;
      }).join('')}</div>
      ${!n ? '<p class="mind-empty">Begin with a room for an area of your life.</p>' : ''}</div>`;
  },
  roomView(graph, room) {
    const members = roomEntities(graph, room).filter(e => room.mode === 'smart' || graph.memberships.some(m => m.roomId === room.id && m.entityId === e.id && !m.parentId));
    const desks = members.filter(e => e.type === 'Desk'), others = members.filter(e => e.type !== 'Desk');
    return `<div class="mind-room-scene"><div class="mind-scene-heading" style="view-transition-name:mind-${room.id}"><small>${room.mode === 'smart' ? 'A LIVING COLLECTION' : 'A ROOM IN YOUR MIND'}</small><h2>${esc(room.name)}</h2><p>${members.length} things live here</p></div>
      <div class="mind-scene-actions">${room.mode === 'manual' ? '<button class="btn" data-action="new-entity">Add something</button><button class="btn" data-action="place-existing">Place existing</button><button class="btn btn-ghost" data-action="new-desk">New desk</button>' : ''}<button class="btn btn-ghost" data-action="rename-room">Rename</button><button class="btn btn-ghost" data-action="delete-room">Delete room</button></div>
      <div class="mind-objects">${[...desks,...others].map((e,i) => this.object(e, i, graph)).join('') || '<p class="mind-empty">Add a person, project, idea, memory, or desk to begin.</p>'}</div></div>`;
  },
  deskView(graph, desk) {
    const children = graph.relationships.filter(r => r.status === 'active' && r.type === 'contains' && r.from === desk.id)
      .map(r => graph.entities.find(e => e.id === r.to)).filter(e => e?.status === 'active');
    return `<div class="mind-desk-scene"><div class="mind-scene-heading" style="view-transition-name:mind-${desk.id}"><small>INSIDE THE DESK</small><h2>${esc(desk.name)}</h2><p>${children.length} ${children.length === 1 ? 'thing' : 'things'} gathered here</p></div>
      <div class="mind-scene-actions"><button class="btn" data-action="new-entity">Add something</button><button class="btn" data-action="place-existing">Place existing</button><button class="btn btn-ghost" data-action="edit-desk">Edit desk</button></div>
      <div class="mind-objects">${children.map((e,i) => this.object(e,i,graph)).join('') || '<p class="mind-empty">Place a note, person, project, or idea at this desk.</p>'}</div></div>`;
  },
  object(e, i, graph) {
    const count = graph.relationships.filter(r => r.status === 'active' && (r.from === e.id || r.to === e.id)).length;
    return `<button class="mind-object mind-entity" style="--order:${i};view-transition-name:mind-${e.id}" data-open-entity="${e.id}"><small>${esc(e.type)}</small><strong>${esc(e.name)}</strong><span>${count ? `${count} connections` : esc(e.content?.slice(0, 72) || 'Open to explore')}</span></button>`;
  },
  entityView(graph, entity) {
    const links = graph.relationships.filter(r => r.status === 'active' && (r.from === entity.id || r.to === entity.id));
    const sources = (entity.sourceIds || []).map(id => graph.sources.find(s => s.id === id)).filter(Boolean);
    return `<div class="mind-detail"><div class="mind-scene-heading" style="view-transition-name:mind-${entity.id}"><small>${esc(entity.type)} · ${esc(entity.memoryType || 'explicit')} memory</small><h2>${esc(entity.name)}</h2><p>${links.length} relationships · Updated ${date(entity.updatedAt)}</p></div>
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
        return other ? `<button data-open-entity="${other.id}"><span>${esc(r.type)}</span><strong>${esc(other.name)}</strong></button>` : '';
      }).join('') || '<p>No connections yet.</p>'}
      ${sources.length ? `<h3>Sources</h3>${sources.map(s => `<p>${esc(s.kind)} · ${esc(s.ref)}${s.excerpt ? ` — ${esc(s.excerpt)}` : ''}</p>`).join('')}` : ''}</aside></div>`;
  },
  searchView(items) { return `<div class="mind-results"><div class="mind-scene-heading"><small>SEARCH YOUR MIND</small><h2>${items.length} matches</h2></div><div class="mind-objects">${items.map((e,i) => this.object(e,i,readMind())).join('') || '<p class="mind-empty">Nothing found. Try another phrase.</p>'}</div></div>`; },
  mapView(graph) {
    const nodes = graph.entities.filter(e => e.status === 'active').slice(0, 80), ids = new Set(nodes.map(e => e.id));
    const focus = this.focusId && ids.has(this.focusId) ? this.focusId : nodes[0]?.id;
    const rank = e => e.id === focus ? 0 : graph.relationships.some(r => r.status === 'active' && (r.from === focus && r.to === e.id || r.to === focus && r.from === e.id)) ? 1 : 2;
    const ordered = [...nodes].sort((a,b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
    const positions = new Map(ordered.map((e,i) => {
      const a = i * 2.39996, radius = i === 0 ? 0 : Math.min(39, 9 + Math.sqrt(i) * 5);
      return [e.id, { x: 50 + Math.cos(a) * radius, y: 50 + Math.sin(a) * radius }];
    }));
    return `<div class="mind-map"><div class="mind-scene-heading"><small>ASSOCIATIONS</small><h2>Map</h2><p>Select a thing to bring its relationships forward.</p></div><div class="mind-map-field">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${graph.relationships.filter(r => r.status === 'active' && ids.has(r.from) && ids.has(r.to)).map(r => {
        const a = positions.get(r.from), b = positions.get(r.to), near = !focus || r.from === focus || r.to === focus;
        return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${near ? 'near' : 'far'}"/>`;
      }).join('')}</svg>
      ${nodes.map(e => {
        const p = positions.get(e.id), near = e.id === focus || graph.relationships.some(r => r.status === 'active' && (r.from === focus && r.to === e.id || r.to === focus && r.from === e.id));
        return `<button class="mind-map-node ${e.id === focus ? 'active' : near ? 'near' : 'far'}" style="--x:${p.x}%;--y:${p.y}%;view-transition-name:mind-map-${e.id}" data-map-focus="${e.id}"><small>${esc(e.type)}</small><strong>${esc(e.name)}</strong></button>`;
      }).join('')}${!nodes.length ? '<div class="mind-map-empty"><p>Connections appear as your Mind grows.</p><button class="btn" data-action="new-room">Create a room</button></div>' : ''}</div><div class="mind-map-foot">${focus ? `<button class="btn" data-open-entity="${focus}">Open ${esc(graph.entities.find(e => e.id === focus)?.name)}</button>` : ''}</div></div>`;
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
      <section class="mind-sense-chapter"><small>01 / CLUSTERS</small><h3>Where your thoughts gather</h3><div class="mind-sense-bars">${clusters.map((c,i) => `<button data-open-room="${c.room.id}" style="--diameter:${Math.min(250, 138 + c.count * 14)}px;--order:${i}"><i aria-hidden="true"></i><span>${esc(c.room.name)}</span><b>${c.count} ${c.count === 1 ? 'thing' : 'things'}</b></button>`).join('') || '<p>Rooms will give your Mind its first shape.</p>'}</div></section>
      <section class="mind-sense-chapter"><small>02 / BRIDGES</small><h3>The ideas that connect worlds</h3><div class="mind-sense-constellation bridges">${bridges.map((e,i) => this.object(e,i,graph)).join('') || '<p>Connect two things to reveal bridges.</p>'}</div></section>
      <section class="mind-sense-chapter"><small>03 / EDGES</small><h3>Things waiting for a connection</h3><div class="mind-sense-constellation edges">${quiet.map((e,i) => this.object(e,i,graph)).join('') || '<p>Everything has a connection.</p>'}</div></section>
      ${dormant.length ? `<section class="mind-sense-chapter"><small>04 / DORMANT</small><h3>Worth revisiting</h3><div class="mind-sense-constellation">${dormant.map((e,i) => this.object(e,i,graph)).join('')}</div></section>` : ''}
      ${suggestions.length ? `<section class="mind-sense-chapter"><small>FOR YOUR REVIEW</small><h3>Suggested connections</h3>${suggestions.map(s => `<p>${esc(graph.entities.find(e => e.id === s.from)?.name)} ↔ ${esc(graph.entities.find(e => e.id === s.to)?.name)} · ${esc(s.reason)} <button data-review="${s.id}" data-accept="true">Connect</button> <button data-review="${s.id}" data-accept="false">Dismiss</button></p>`).join('')}</section>` : ''}</div>`;
  },
  async click(event) {
    const button = event.target.closest('button'); if (!button || !this.container.contains(button)) return;
    const d = button.dataset;
    if (d.mode) return this.navigate(() => { this.view = d.mode; this.focusId = null; this.editDesk = false; this.query = ''; });
    if (d.openRoom) return this.navigate(() => { this.view = 'space'; this.roomId = d.openRoom; this.focusId = null; this.editDesk = false; this.trail = []; this.query = ''; });
    if (d.openEntity) return this.navigate(() => { this.view = 'space'; if (this.focusId && this.focusId !== d.openEntity) this.trail.push(this.focusId); this.focusId = d.openEntity; this.editDesk = false; this.query = ''; });
    if (d.mapFocus) return this.navigate(() => { this.focusId = d.mapFocus; });
    if (d.review) { reviewMindSuggestion(d.review, d.accept === 'true'); return this.paint(); }
    if (d.action === 'home') return this.navigate(() => { this.view = 'space'; this.roomId = this.focusId = null; this.editDesk = false; this.trail = []; this.query = ''; });
    if (d.action === 'room') return this.navigate(() => { this.view = 'space'; this.roomId = d.id; this.focusId = null; this.editDesk = false; this.trail = []; });
    if (d.action === 'trail') return this.navigate(() => { const index = this.trail.indexOf(d.id); if (index >= 0) { this.focusId = d.id; this.trail = this.trail.slice(0, index); this.editDesk = false; } });
    if (d.action === 'new-room') return this.createRoom();
    if (d.action === 'rename-room') return this.renameRoom();
    if (d.action === 'delete-room') return this.deleteRoom();
    if (d.action === 'new-entity' || d.action === 'new-desk') return this.createEntity(d.action === 'new-desk' ? 'Desk' : null);
    if (d.action === 'edit-desk') return this.navigate(() => { this.editDesk = true; });
    if (d.action === 'place-existing') return this.placeExisting();
    if (d.action === 'connect') return this.connect();
    if (d.action === 'supersede') { supersedeMindEntity(this.focusId); return this.navigate(() => this.focusId = null); }
    if (d.action === 'delete-entity') return this.removeEntity();
  },
  async createRoom() {
    const name = await showDialog({ type: 'prompt', title: 'New room', message: 'Name an area of your world.', confirmText: 'Create' });
    if (!name?.trim()) return;
    const room = addMindRoom(name);
    this.navigate(() => { this.view = 'space'; this.roomId = room.id; this.focusId = null; });
  },
  async renameRoom() {
    const graph = readMind(), room = graph.rooms.find(r => r.id === this.roomId); if (!room) return;
    const name = await showDialog({ type: 'prompt', title: 'Rename room', defaultValue: room.name, confirmText: 'Save' });
    if (!name?.trim()) return;
    room.name = name.trim().slice(0,120); room.updatedAt = Date.now(); writeMind(graph); this.paint();
  },
  async deleteRoom() {
    const room = readMind().rooms.find(r => r.id === this.roomId); if (!room) return;
    const yes = await showDialog({ type: 'confirm', destructive: true, title: 'Delete room?', message: `Remove ${room.name} from Mind? Its things remain available in search and other rooms.`, confirmText: 'Delete room' });
    if (!yes) return;
    removeMindRoom(room.id);
    this.navigate(() => { this.roomId = this.focusId = null; this.trail = []; });
  },
  async createEntity(type = null) {
    const name = await showDialog({ type: 'prompt', title: type === 'Desk' ? 'New desk' : 'Add to Mind', message: 'Name a person, idea, project, memory, or anything that matters.', confirmText: 'Add' });
    if (!name?.trim()) return;
    const entity = upsertMindEntity({ name, type: type || 'Note', memoryType: 'explicit' });
    const parent = readMind().entities.find(e => e.id === this.focusId && e.type === 'Desk')?.id || null;
    if (readMind().rooms.find(r => r.id === this.roomId)?.mode === 'manual') addMindMembership(this.roomId, entity.id, parent);
    if (parent) relateMindEntities(parent, entity.id, 'contains');
    this.navigate(() => { if (parent) this.trail.push(parent); this.focusId = entity.id; });
  },
  async placeExisting() {
    const graph = readMind(), name = await showDialog({ type: 'prompt', title: 'Place existing thing', message: 'Enter its exact name. It will stay the same thing everywhere.', confirmText: 'Place' });
    if (!name) return;
    const found = graph.entities.find(e => e.status === 'active' && e.name.toLowerCase() === name.trim().toLowerCase());
    if (!found) return showDialog({ title: 'Not found', message: 'Search Mind for the exact name, or add a new thing.' });
    const parent = graph.entities.find(e => e.id === this.focusId && e.type === 'Desk')?.id || null;
    if (graph.rooms.find(r => r.id === this.roomId)?.mode === 'manual') addMindMembership(this.roomId, found.id, parent);
    if (parent) relateMindEntities(parent, found.id, 'contains');
    this.paint();
  },
  async connect() {
    const graph = readMind(), name = await showDialog({ type: 'prompt', title: 'Connect to', message: 'Enter the exact name of another thing in Mind.', confirmText: 'Connect' });
    if (!name) return;
    const found = graph.entities.find(e => e.id !== this.focusId && e.name.toLowerCase() === name.trim().toLowerCase());
    if (!found) return showDialog({ title: 'Not found', message: 'Choose an existing thing in Mind.' });
    const type = await showDialog({ type: 'prompt', title: 'How are they related?', defaultValue: 'related', confirmText: 'Save connection' });
    if (!type) return;
    relateMindEntities(this.focusId, found.id, type); this.paint();
  },
  saveEntity(form) {
    const data = new FormData(form), id = form.dataset.id;
    let properties;
    try { properties = JSON.parse(data.get('properties') || '{}'); if (!properties || typeof properties !== 'object' || Array.isArray(properties)) throw new Error(); }
    catch { showDialog({ title: 'Check custom properties', message: 'Enter a JSON object, such as {"category":"music"}.' }); return; }
    upsertMindEntity({ id, name: data.get('name'), type: data.get('type'), content: data.get('content'), memoryType: data.get('memoryType'), access: data.get('access'), importance: data.get('importance'), confidence: data.get('confidence'), properties, replaceProperties: true });
    this.paint({ transition: false });
  },
  async removeEntity() {
    const entity = readMind().entities.find(e => e.id === this.focusId);
    if (!entity) return;
    const yes = await showDialog({ type: 'confirm', destructive: true, title: 'Delete from Mind?', message: `Delete ${entity.name} and its connections everywhere?`, confirmText: 'Delete' });
    if (yes) { forgetMindEntity(entity.id); this.navigate(() => this.focusId = null); }
  },
  destroy() {
    this.container?.removeEventListener('click', this.onClick);
    this.container?.removeEventListener('input', this.onInput);
    this.container?.removeEventListener('submit', this.onSubmit);
    this.container?.removeEventListener('keydown', this.onKey);
  },
};
