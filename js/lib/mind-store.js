import { getCurrentUser } from './supabase.js';
import { compileMind, retrieveMind } from './mind-compiler.js';

const KEY = 'toolbox_mind_v1', CLAIM = KEY + '_owner';
const uid = () => globalThis.crypto?.randomUUID?.() || 'mind-' + Math.random().toString(36).slice(2);
const clean = (v, n = 50000) => String(v ?? '').trim().slice(0, n);
const empty = () => ({ version: 2, revision: 0, rooms: [], entities: [], relationships: [], memberships: [], sources: [], suggestions: [] });
const fields = ['rooms', 'entities', 'relationships', 'memberships', 'sources', 'suggestions'];
const score = (v, fallback) => Math.max(0, Math.min(1, Number.isFinite(Number(v)) ? Number(v) : fallback));
const TYPES = new Set(['Person', 'Song', 'Artist', 'Project', 'Idea', 'Memory', 'Place', 'Technology', 'Media', 'Note', 'Link', 'Custom', 'Desk']);

function storageKey() {
  const user = getCurrentUser()?.id;
  if (!user) return localStorage.getItem(CLAIM) ? KEY + ':anonymous' : KEY;
  const scoped = KEY + ':' + user;
  if (!localStorage.getItem(scoped) && !localStorage.getItem(CLAIM) && localStorage.getItem(KEY)) {
    localStorage.setItem(scoped, localStorage.getItem(KEY));
    localStorage.setItem(CLAIM, user);
  }
  return scoped;
}

function migrate(old) {
  const graph = empty(), stamp = Date.now(), deskRoom = new Map();
  graph.rooms = old.rooms.map(r => ({ id: r.id || uid(), name: clean(r.name, 120), mode: 'manual', rule: null, createdAt: r.createdAt || stamp, updatedAt: stamp }));
  for (const d of old.desks) {
    const e = { id: d.id || uid(), type: 'Desk', name: clean(d.name, 120), content: '', properties: {}, createdAt: d.createdAt || stamp, updatedAt: stamp, confidence: 1, importance: .5, access: 'private', memoryType: 'explicit', status: 'active', sourceIds: [] };
    graph.entities.push(e); deskRoom.set(d.id, d.parentId);
    if (graph.rooms.some(r => r.id === d.parentId)) graph.memberships.push({ id: uid(), roomId: d.parentId, entityId: e.id, parentId: null, createdAt: stamp });
  }
  for (const f of old.files) {
    const e = { id: f.id || uid(), type: 'Note', name: clean(f.name, 120), content: clean(f.content), properties: {}, createdAt: f.createdAt || stamp, updatedAt: stamp, confidence: 1, importance: .5, access: 'private', memoryType: 'explicit', status: 'active', sourceIds: [] };
    graph.entities.push(e);
    const roomId = deskRoom.get(f.parentId);
    if (graph.rooms.some(r => r.id === roomId)) graph.memberships.push({ id: uid(), roomId, entityId: e.id, parentId: f.parentId, createdAt: stamp });
    if (graph.entities.some(x => x.id === f.parentId)) graph.relationships.push({ id: uid(), from: f.parentId, to: e.id, type: 'contains', status: 'active', confidence: 1, createdAt: stamp, updatedAt: stamp, sourceIds: [] });
  }
  for (const l of old.links) if (graph.entities.some(e => e.id === l.a) && graph.entities.some(e => e.id === l.b))
    graph.relationships.push({ id: uid(), from: l.a, to: l.b, type: 'related', status: 'active', confidence: 1, createdAt: stamp, updatedAt: stamp, sourceIds: [] });
  return graph;
}

function absorbLegacyMemory(graph, key) {
  const marker = key + ':memory-migrated';
  if (localStorage.getItem(marker)) return graph;
  const legacyOwnerKey = 'toolbox_assistant_memory_v1_owner';
  const legacyOwner = localStorage.getItem(legacyOwnerKey);
  if (legacyOwner && legacyOwner !== key) {
    localStorage.setItem(marker, '1');
    return graph;
  }
  let old = [];
  try { old = JSON.parse(localStorage.getItem('toolbox_assistant_memory_v1') || '[]'); } catch { /* ignore */ }
  if (Array.isArray(old)) for (const fact of old) {
    const text = clean(fact?.text, 240);
    if (!text || graph.entities.some(e => e.type === 'Memory' && e.content === text)) continue;
    graph.entities.push({ id: uid(), type: 'Memory', name: text.slice(0, 100), content: text, properties: {}, createdAt: fact.at || Date.now(), updatedAt: fact.at || Date.now(), confidence: 1, importance: .7, access: 'private', memoryType: 'explicit', status: 'active', sourceIds: [] });
  }
  graph.revision++;
  localStorage.setItem(key, JSON.stringify(graph));
  if (!legacyOwner) localStorage.setItem(legacyOwnerKey, key);
  localStorage.setItem(marker, '1');
  return graph;
}

export function readMind() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey()) || 'null');
    if (!value) return absorbLegacyMemory(empty(), storageKey());
    if (value.version === 2 && fields.every(k => Array.isArray(value[k]))) return absorbLegacyMemory(value, storageKey());
    if (['rooms', 'desks', 'files', 'links'].every(k => Array.isArray(value[k]))) {
      const graph = migrate(value);
      localStorage.setItem(storageKey(), JSON.stringify(graph));
      return absorbLegacyMemory(graph, storageKey());
    }
  } catch { /* Keep the UI usable if storage is unavailable. */ }
  return empty();
}
export function writeMind(graph) {
  if (!fields.every(k => Array.isArray(graph[k]))) throw new Error('Invalid Mind graph.');
  graph.version = 2; graph.revision = (graph.revision || 0) + 1;
  localStorage.setItem(storageKey(), JSON.stringify(graph));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('toolbox:mindchange'));
  return graph;
}
export function compiledMind() {
  const graph = readMind(), key = storageKey() + ':compiled';
  let previous = null;
  try { previous = JSON.parse(localStorage.getItem(key) || 'null'); } catch { /* rebuild */ }
  if (previous?.version === 2 && previous.revision === graph.revision) return previous;
  const result = compileMind(graph, previous);
  try { localStorage.setItem(key, JSON.stringify(result)); } catch { /* disposable cache */ }
  return result;
}

export function addMindRoom(name, { mode = 'manual', rule = null } = {}) {
  name = clean(name, 120); if (!name) throw new Error('Name the room.');
  const graph = readMind(), stamp = Date.now();
  const room = { id: uid(), name, mode: mode === 'smart' ? 'smart' : 'manual', rule: mode === 'smart' ? rule : null, createdAt: stamp, updatedAt: stamp };
  graph.rooms.push(room); writeMind(graph); return room;
}
export function removeMindRoom(roomId) {
  const graph = readMind();
  if (!graph.rooms.some(r => r.id === roomId)) return false;
  graph.rooms = graph.rooms.filter(r => r.id !== roomId);
  graph.memberships = graph.memberships.filter(m => m.roomId !== roomId);
  writeMind(graph);
  return true;
}
export function addMindSource({ kind = 'manual', ref = '', excerpt = '' } = {}) {
  const graph = readMind(), source = { id: uid(), kind: clean(kind, 40), ref: clean(ref, 500), excerpt: clean(excerpt, 2000), createdAt: Date.now() };
  graph.sources.push(source); writeMind(graph); return source;
}
export function upsertMindEntity(input = {}) {
  const graph = readMind(), name = clean(input.name, 120);
  if (!name) throw new Error('Name the thing to remember.');
  const existingById = input.id ? graph.entities.find(e => e.id === input.id) : null;
  const type = TYPES.has(input.type) ? input.type : (existingById?.type || 'Custom');
  const existing = existingById || (!input.id && graph.entities.find(e => e.status === 'active' && e.type === type && e.name.toLowerCase() === name.toLowerCase()));
  const stamp = Date.now(), entity = existing || { id: uid(), createdAt: stamp, sourceIds: [] };
  Object.assign(entity, {
    name, type, content: input.content == null ? (entity.content || '') : clean(input.content),
    properties: input.properties && typeof input.properties === 'object' && !Array.isArray(input.properties) ? (input.replaceProperties ? { ...input.properties } : { ...entity.properties, ...input.properties }) : (entity.properties || {}),
    updatedAt: stamp, confidence: score(input.confidence, entity.confidence ?? 1), importance: score(input.importance, entity.importance ?? .5),
    access: ['private', 'shared'].includes(input.access) ? input.access : (entity.access || 'private'),
    memoryType: ['explicit', 'learned', 'episodic'].includes(input.memoryType) ? input.memoryType : (entity.memoryType || 'explicit'),
    status: input.status || entity.status || 'active', sourceIds: [...new Set([...(entity.sourceIds || []), ...(input.sourceIds || [])])],
  });
  if (!existing) graph.entities.push(entity);
  writeMind(graph); return entity;
}
export function addMindMembership(roomId, entityId, parentId = null) {
  const graph = readMind(), room = graph.rooms.find(r => r.id === roomId);
  if (!room || !graph.entities.some(e => e.id === entityId)) throw new Error('Room or entity not found.');
  if (room.mode !== 'manual') throw new Error('Smart rooms derive their contents from rules.');
  const found = graph.memberships.find(m => m.roomId === roomId && m.entityId === entityId && m.parentId === parentId);
  if (found) return found;
  const item = { id: uid(), roomId, entityId, parentId, createdAt: Date.now() };
  graph.memberships.push(item); writeMind(graph); return item;
}
export function roomEntities(graph, room) {
  if (!room) return [];
  if (room.mode === 'smart') {
    const r = room.rule || {};
    return graph.entities.filter(e => e.status === 'active' && (!r.type || e.type === r.type) && (!r.property || e.properties?.[r.property] === r.value) && (!r.query || (e.name + ' ' + e.content).toLowerCase().includes(String(r.query).toLowerCase())));
  }
  const ids = new Set(graph.memberships.filter(m => m.roomId === room.id).map(m => m.entityId));
  return graph.entities.filter(e => ids.has(e.id) && e.status === 'active');
}
export function relateMindEntities(from, to, type = 'related', options = {}) {
  const graph = readMind(); type = clean(type, 80) || 'related';
  if (from === to || !graph.entities.some(e => e.id === from) || !graph.entities.some(e => e.id === to)) throw new Error('Choose two different entities.');
  const found = graph.relationships.find(r => r.from === from && r.to === to && r.type === type && r.status === 'active');
  if (found) return found;
  const stamp = Date.now(), edge = { id: uid(), from, to, type, properties: options.properties || {}, confidence: score(options.confidence, 1), importance: score(options.importance, .5), status: 'active', sourceIds: options.sourceIds || [], createdAt: stamp, updatedAt: stamp };
  graph.relationships.push(edge); writeMind(graph); return edge;
}
export function supersedeMindEntity(oldId, replacementId = null) {
  const graph = readMind(), old = graph.entities.find(e => e.id === oldId);
  if (!old) throw new Error('Memory not found.');
  if (replacementId && !graph.entities.some(e => e.id === replacementId)) throw new Error('Replacement not found.');
  old.status = 'superseded'; old.supersededBy = replacementId; old.updatedAt = Date.now();
  writeMind(graph); return old;
}
export function forgetMindEntity(entityId) {
  const graph = readMind();
  if (!graph.entities.some(e => e.id === entityId)) return false;
  graph.entities = graph.entities.filter(e => e.id !== entityId);
  graph.relationships = graph.relationships.filter(r => r.from !== entityId && r.to !== entityId);
  graph.memberships = graph.memberships.filter(m => m.entityId !== entityId && m.parentId !== entityId);
  writeMind(graph); return true;
}
export function addMindSuggestion(from, to, type = 'related', reason = '') {
  const graph = readMind();
  if (from === to || !graph.entities.some(e => e.id === from) || !graph.entities.some(e => e.id === to)) throw new Error('Choose two different entities.');
  const item = { id: uid(), from, to, type: clean(type, 80), reason: clean(reason, 500), status: 'pending', createdAt: Date.now() };
  graph.suggestions.push(item); writeMind(graph); return item;
}
export function reviewMindSuggestion(suggestionId, accept) {
  const graph = readMind(), item = graph.suggestions.find(s => s.id === suggestionId);
  if (!item) throw new Error('Suggestion not found.');
  item.status = accept ? 'accepted' : 'rejected'; item.reviewedAt = Date.now(); writeMind(graph);
  if (accept) relateMindEntities(item.from, item.to, item.type);
  return item;
}
export function recallMind(query, limit = 8) { return retrieveMind(readMind(), compiledMind(), query, limit); }
export function mindProfile(query = '') {
  const c = compiledMind();
  if (!c.global) return '';
  return [c.global, ...(query ? recallMind(query, 5).map(e => `${e.type}:${e.name}${e.content ? ' — ' + e.content.slice(0, 150) : ''} [id:${e.id}]`) : [])].join('\n').slice(0, 1300);
}
// Compatibility entry points for older Assistant callers.
export function addMindItem(kind, name, parentId, content = '') {
  if (kind === 'room') return addMindRoom(name);
  if (!['desk', 'file'].includes(kind)) throw new Error('Choose a type and name.');
  const graph = readMind(), roomId = kind === 'desk' ? parentId : graph.memberships.find(m => m.entityId === parentId)?.roomId;
  if (!graph.rooms.some(r => r.id === roomId)) throw new Error('The parent room or desk was not found.');
  const entity = upsertMindEntity({ name, type: kind === 'desk' ? 'Desk' : 'Note', content });
  addMindMembership(roomId, entity.id, kind === 'file' ? parentId : null);
  if (kind === 'file') relateMindEntities(parentId, entity.id, 'contains');
  return entity;
}
export const connectMindFiles = (a, b) => relateMindEntities(a, b);
export const searchMind = query => recallMind(query, 50);
