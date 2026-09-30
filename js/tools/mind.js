import { readMind, writeMind, addMindItem, connectMindFiles, searchMind } from '../lib/mind-store.js';
import { showDialog } from '../lib/dialog.js';
import { openContextMenu, closeContextMenu } from '../lib/context-menu.js';
import '../../css/mind.css';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default {
  render(container) {
    this.container = container;
    this.room = null; this.desk = null; this.query = '';
    this.onClick = e => this.click(e);
    this.onInput = e => {
      if (!e.target.matches('[data-search]')) return;
      this.query = e.target.value;
      const stage = container.querySelector('.mind-stage');
      stage.classList.add('is-filtering');
      const m = readMind();
      stage.innerHTML = this.stageContent(m, m.rooms.find(x => x.id === this.room), m.desks.find(x => x.id === this.desk));
    };
    this.onContext = e => {
      if (e.defaultPrevented) return;
      const target = e.target.closest('[data-file], [data-desk], [data-room]');
      e.preventDefault(); e.stopPropagation();
      if (!target || !container.contains(target)) {
        openContextMenu({ x: e.clientX, y: e.clientY, title: 'Mind', items: [
          { label: 'New room', action: () => this.create('room') },
          ...(this.room ? [{ label: 'New desk', action: () => this.create('desk') }] : []),
          ...(this.desk ? [{ label: 'New file', action: () => this.create('file') }] : []),
        ] });
        return;
      }
      const m = readMind(), id = target.dataset.file || target.dataset.desk || target.dataset.room;
      const kind = target.dataset.file ? 'file' : target.dataset.desk ? 'desk' : 'room';
      const item = m[`${kind}s`].find(x => x.id === id); if (!item) return;
      openContextMenu({ x: e.clientX, y: e.clientY, title: item.name, items: [
        { label: kind === 'file' ? 'Open file' : `Enter ${kind}`, action: () => this.open(kind, id) },
        { label: 'Rename', action: () => this.rename(kind, id) },
        ...(kind === 'file' ? [{ label: 'Connect to another file', action: () => this.connect(id) }] : []),
        { separator: true },
        { label: 'Delete', destructive: true, action: () => this.remove(kind, id) },
      ] });
    };
    container.addEventListener('click', this.onClick);
    container.addEventListener('input', this.onInput);
    container.addEventListener('contextmenu', this.onContext);
    this.paint();
  },
  paint({ animate = true } = {}) {
    const m = readMind(), room = m.rooms.find(x => x.id === this.room), desk = m.desks.find(x => x.id === this.desk);
    const content = this.stageContent(m, room, desk);
    this.container.innerHTML = `<main class="mind${animate ? '' : ' mind--instant'}" data-text-actions="off"><div class="mind-atmosphere" aria-hidden="true"><i></i><i></i><i></i></div><header class="mind-head"><div><span class="mind-kicker">A PLACE FOR YOUR INNER WORLD</span><h1>Mind<span class="mind-period">.</span></h1><p>Give the people, ideas, memories, and interests that matter to you a place to live.</p></div><button class="btn btn-primary" data-action="add-room">New room</button></header><div class="mind-workspace"><nav class="mind-crumb" aria-label="Mind location"><button data-action="home">Mind</button>${room ? `<span> / </span><button data-room="${room.id}">${esc(room.name)}</button>` : ''}${desk ? `<span> / </span><span>${esc(desk.name)}</span>` : ''}</nav><label class="mind-search-wrap"><span class="mind-search-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10.7" cy="10.7" r="6.7"/><path d="m16 16 4.6 4.6"/></svg></span><input class="tool-input mind-search" data-search placeholder="Search across every room" value="${esc(this.query)}" aria-label="Search your mind"></label><div class="mind-stage">${content}</div></div></main>`;
  },
  stageContent(m, room, desk) {
    const results = this.query.trim() ? searchMind(this.query) : null;
    const fileCard = f => {
      const connections = m.links.filter(l => l.a === f.id || l.b === f.id).length;
      return `<button class="mind-card mind-file" data-file="${f.id}"><span class="mind-card-top"><small>FILE</small><i aria-hidden="true">↗</i></span><strong>${esc(f.name)}</strong><span class="mind-excerpt">${esc(f.content?.slice(0, 160) || 'Add what this means to you')}</span><span class="mind-card-foot">${connections ? count(connections, 'connection') : 'Open to write'}</span></button>`;
    };
    const roomCard = r => `<button class="mind-card mind-room" data-room="${r.id}"><span class="mind-card-top"><small>ROOM</small><i aria-hidden="true">↗</i></span><strong>${esc(r.name)}</strong><span class="mind-card-foot">${count(m.desks.filter(d => d.parentId === r.id).length, 'desk')}</span></button>`;
    const deskCard = d => `<button class="mind-card mind-desk" data-desk="${d.id}"><span class="mind-card-top"><small>DESK</small><i aria-hidden="true">↗</i></span><strong>${esc(d.name)}</strong><span class="mind-card-foot">${count(m.files.filter(f => f.parentId === d.id).length, 'file')}</span></button>`;
    const content = results ? results.map(f => `<div class="mind-result-path">${esc(f.room)} / ${esc(f.desk)}</div>${fileCard(f)}`).join('') || '<p class="mind-empty">No matching files yet.</p>'
      : desk ? `<div class="mind-stage-title"><div><small>INSIDE THE DESK</small><h2>${esc(desk.name)}</h2></div><button class="btn" data-action="add-file">New file</button></div>${m.files.filter(f => f.parentId === desk.id).map(fileCard).join('') || '<p class="mind-empty">Give this desk its first file.</p>'}`
      : room ? `<div class="mind-stage-title"><div><small>INSIDE THE ROOM</small><h2>${esc(room.name)}</h2></div><button class="btn" data-action="add-desk">New desk</button></div>${m.desks.filter(d => d.parentId === room.id).map(deskCard).join('') || '<p class="mind-empty">Add a desk for a person, project, artist, or idea.</p>'}`
      : m.rooms.map(roomCard).join('') || '<p class="mind-empty">Start with a room for a part of your world.</p>';
    return content;
  },
  async click(e) {
    const t = e.target.closest('button'); if (!t || !this.container.contains(t)) return;
    if (t.dataset.action === 'home') { this.room = this.desk = null; this.query = ''; this.paint(); return; }
    if (t.dataset.room) return this.open('room', t.dataset.room);
    if (t.dataset.desk) return this.open('desk', t.dataset.desk);
    if (t.dataset.file) return this.open('file', t.dataset.file);
    if (t.dataset.action?.startsWith('add-')) return this.create(t.dataset.action.slice(4));
  },
  async create(kind) {
    const name = await showDialog({ type: 'prompt', title: `New ${kind}`, message: kind === 'room' ? 'What part of your world belongs here?' : kind === 'desk' ? 'Who or what belongs at this desk?' : 'What will you remember here?', placeholder: `${kind[0].toUpperCase()}${kind.slice(1)} name`, confirmText: 'Create' });
    if (!name?.trim()) return;
    const item = addMindItem(kind, name, kind === 'desk' ? this.room : kind === 'file' ? this.desk : undefined);
    if (kind === 'room') this.room = item.id;
    if (kind === 'desk') this.desk = item.id;
    this.paint();
    if (kind === 'file') this.open('file', item.id);
  },
  async open(kind, id) {
    if (kind === 'room') { this.room = id; this.desk = null; this.query = ''; this.paint(); return; }
    if (kind === 'desk') { this.desk = id; this.query = ''; this.paint(); return; }
    const m = readMind(), file = m.files.find(f => f.id === id); if (!file) return;
    const links = m.links.filter(l => l.a === id || l.b === id).map(l => m.files.find(f => f.id === (l.a === id ? l.b : l.a))?.name).filter(Boolean);
    const content = await showDialog({ type: 'prompt', multiline: true, title: file.name, message: `${links.length ? `Connected to ${links.join(', ')}. ` : ''}Write what you know, remember, or feel about this.`, defaultValue: file.content || '', confirmText: 'Save file', placeholder: 'This matters to me because…' });
    if (content === null) return;
    file.content = content.slice(0, 50000); writeMind(m); this.paint();
  },
  async rename(kind, id) {
    const m = readMind(), item = m[`${kind}s`].find(x => x.id === id); if (!item) return;
    const name = await showDialog({ type: 'prompt', title: `Rename ${kind}`, message: 'Choose a name that helps you find it again.', defaultValue: item.name, confirmText: 'Rename' });
    if (!name?.trim()) return;
    item.name = name.trim().slice(0, 120); writeMind(m); this.paint();
  },
  async connect(id) {
    const m = readMind(), choices = m.files.filter(x => x.id !== id);
    if (!choices.length) return showDialog({ title: 'Another file needed', message: 'Create another file first, then connect the two.' });
    const name = await showDialog({ type: 'prompt', title: 'Connect files', message: `Enter another file name: ${choices.slice(0, 12).map(f => f.name).join(', ')}`, placeholder: 'File name', confirmText: 'Connect' });
    if (!name) return;
    const other = choices.find(f => f.name.toLowerCase() === name.trim().toLowerCase());
    if (!other) return showDialog({ title: 'File not found', message: 'Choose the exact name of an existing file.' });
    connectMindFiles(id, other.id); this.paint();
  },
  async remove(kind, id) {
    const m = readMind(), item = m[`${kind}s`].find(x => x.id === id); if (!item) return;
    const ok = await showDialog({ type: 'confirm', destructive: true, title: `Delete ${kind}?`, message: `Delete ${item.name}${kind === 'room' ? ' and every desk and file inside it' : kind === 'desk' ? ' and every file inside it' : ''}?`, confirmText: 'Delete' });
    if (!ok) return;
    const desks = kind === 'room' ? m.desks.filter(d => d.parentId === id).map(d => d.id) : kind === 'desk' ? [id] : [];
    const files = kind === 'file' ? [id] : m.files.filter(f => desks.includes(f.parentId)).map(f => f.id);
    m.rooms = m.rooms.filter(r => !(kind === 'room' && r.id === id));
    m.desks = m.desks.filter(d => !desks.includes(d.id));
    m.files = m.files.filter(f => !files.includes(f.id));
    m.links = m.links.filter(l => !files.includes(l.a) && !files.includes(l.b));
    if (kind === 'room') this.room = this.desk = null;
    if (kind === 'desk') this.desk = null;
    writeMind(m); this.paint();
  },
  destroy() {
    closeContextMenu();
    this.container?.removeEventListener('click', this.onClick);
    this.container?.removeEventListener('input', this.onInput);
    this.container?.removeEventListener('contextmenu', this.onContext);
  },
};
