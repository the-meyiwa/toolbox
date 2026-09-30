import { readMind, writeMind, addMindItem, connectMindFiles, searchMind } from '../lib/mind-store.js';
import '../../css/mind.css';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export default {
  render(container) {
    this.container = container;
    this.room = null; this.desk = null; this.query = '';
    this.onClick = e => this.click(e); this.onInput = e => { if (e.target.matches('[data-search]')) { const pos = e.target.selectionStart; this.query = e.target.value; this.paint(); const field = this.container.querySelector('[data-search]'); field.focus(); field.setSelectionRange(pos, pos); } };
    container.addEventListener('click', this.onClick); container.addEventListener('input', this.onInput);
    this.paint();
  },
  paint() {
    const m = readMind(), room = m.rooms.find(x => x.id === this.room), desk = m.desks.find(x => x.id === this.desk);
    const results = this.query.trim() ? searchMind(this.query) : null;
    this.container.innerHTML = `<main class="mind"><header class="mind-head"><div><span class="mind-kicker">YOUR INNER WORLD</span><h1>Mind</h1><p>Rooms hold desks. Desks hold files. Connections travel between them.</p></div><button class="btn btn-primary" data-action="add-room">New room</button></header><nav class="mind-crumb"><button data-action="home">Mind</button>${room ? `<span> / </span><button data-room="${room.id}">${esc(room.name)}</button>` : ''}${desk ? `<span> / </span><span>${esc(desk.name)}</span>` : ''}</nav><input class="tool-input mind-search" data-search placeholder="Search your mind" value="${esc(this.query)}"><div class="mind-stage">${results ? results.map(f => `<button class="mind-card mind-file" data-file="${f.id}"><small>${esc(f.room)} / ${esc(f.desk)}</small><strong>${esc(f.name)}</strong><span>${esc(f.content.slice(0, 130))}</span></button>`).join('') || '<p>No matching files yet.</p>' : desk ? `<div class="mind-stage-title"><h2>${esc(desk.name)}</h2><button class="btn" data-action="add-file">New file</button></div>${m.files.filter(f => f.parentId === desk.id).map(f => `<button class="mind-card mind-file" data-file="${f.id}"><small>FILE</small><strong>${esc(f.name)}</strong><span>${esc(f.content.slice(0, 130))}</span></button>`).join('')}` : room ? `<div class="mind-stage-title"><h2>${esc(room.name)}</h2><button class="btn" data-action="add-desk">New desk</button></div>${m.desks.filter(d => d.parentId === room.id).map(d => `<button class="mind-card mind-desk" data-desk="${d.id}"><small>DESK</small><strong>${esc(d.name)}</strong><span>${m.files.filter(f => f.parentId === d.id).length} files</span></button>`).join('')}` : m.rooms.map(r => `<button class="mind-card mind-room" data-room="${r.id}"><small>ROOM</small><strong>${esc(r.name)}</strong><span>${m.desks.filter(d => d.parentId === r.id).length} desks</span></button>`).join('') || '<p>Start with a room for a part of your world.</p>'}</div></main>`;
  },
  click(e) {
    const t = e.target.closest('button'); if (!t) return;
    const m = readMind();
    if (t.dataset.action === 'home') { this.room = this.desk = null; this.query = ''; }
    else if (t.dataset.room) { this.room = t.dataset.room; this.desk = null; this.query = ''; }
    else if (t.dataset.desk) { this.desk = t.dataset.desk; this.query = ''; }
    else if (t.dataset.file) {
      const f = m.files.find(x => x.id === t.dataset.file); if (!f) return;
      const action = prompt(`File: ${f.name}\nType edit to change information, or connect to link another file.`, 'edit');
      if (action === 'connect') {
        const other = m.files.filter(x => x.id !== f.id);
        const chosen = prompt(`Connect to which file?\n${other.map((x, i) => `${i + 1}. ${x.name}`).join('\n')}`);
        const target = other[Number(chosen) - 1]; if (target) connectMindFiles(f.id, target.id);
      } else if (action === 'edit') {
        const content = prompt(`File: ${f.name}\nEdit its information:`, f.content); if (content === null) return;
        f.content = content.slice(0, 50000); writeMind(m);
      }
    } else if (t.dataset.action?.startsWith('add-')) {
      const kind = t.dataset.action.slice(4), name = prompt(`Name this ${kind}:`); if (!name?.trim()) return;
      const item = addMindItem(kind, name, kind === 'desk' ? this.room : kind === 'file' ? this.desk : undefined);
      if (kind === 'room') this.room = item.id; if (kind === 'desk') this.desk = item.id;
    }
    this.paint();
  },
  destroy() { this.container?.removeEventListener('click', this.onClick); this.container?.removeEventListener('input', this.onInput); },
};
