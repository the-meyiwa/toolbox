const KEY = 'toolbox_mind_v1';
const empty = () => ({ rooms: [], desks: [], files: [], links: [] });
export function readMind() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null');
    return value && ['rooms', 'desks', 'files', 'links'].every(k => Array.isArray(value[k])) ? value : empty();
  } catch { return empty(); }
}
export function writeMind(mind) { localStorage.setItem(KEY, JSON.stringify(mind)); window.dispatchEvent(new Event('toolbox:mindchange')); }
export function addMindItem(kind, name, parentId, content = '') {
  if (!['room', 'desk', 'file'].includes(kind) || !String(name).trim()) throw new Error('Choose a type and name.');
  const mind = readMind();
  const parent = kind === 'desk' ? mind.rooms.find(x => x.id === parentId) : kind === 'file' ? mind.desks.find(x => x.id === parentId) : true;
  if (!parent) throw new Error('The parent room or desk was not found.');
  const item = { id: crypto.randomUUID(), name: String(name).trim().slice(0, 120), createdAt: Date.now() };
  if (kind !== 'room') item.parentId = parentId;
  if (kind === 'file') item.content = String(content).slice(0, 50000);
  mind[`${kind}s`].push(item); writeMind(mind); return item;
}
export function connectMindFiles(a, b) {
  const mind = readMind();
  if (a === b || !mind.files.some(x => x.id === a) || !mind.files.some(x => x.id === b)) throw new Error('Choose two different files.');
  if (!mind.links.some(x => (x.a === a && x.b === b) || (x.a === b && x.b === a))) mind.links.push({ a, b });
  writeMind(mind);
}
export function searchMind(query) {
  const mind = readMind(), q = String(query || '').toLowerCase().trim();
  return mind.files.filter(f => !q || `${f.name} ${f.content}`.toLowerCase().includes(q)).map(f => ({ ...f, desk: mind.desks.find(d => d.id === f.parentId)?.name, room: mind.rooms.find(r => r.id === mind.desks.find(d => d.id === f.parentId)?.parentId)?.name, connections: mind.links.filter(l => l.a === f.id || l.b === f.id).map(l => mind.files.find(x => x.id === (l.a === f.id ? l.b : l.a))?.name).filter(Boolean) }));
}
