import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';
import { readMind, addMindRoom, removeMindRoom, upsertMindEntity, addMindMembership, addMindSource, addMindSuggestion, reviewMindSuggestion, roomEntities, relateMindEntities, compiledMind, recallMind, supersedeMindEntity, forgetMindEntity } from '../../js/lib/mind-store.js';

setupDOMEnvironment();
const KEY = 'toolbox_mind_v1';
function reset() {
  localStorage.clear();
  localStorage.setItem(KEY + ':memory-migrated', '1');
}

test('Mind migrates rooms, desks, files and links without changing their IDs', () => {
  reset();
  localStorage.setItem(KEY, JSON.stringify({
    rooms: [{ id: 'r1', name: 'Music' }],
    desks: [{ id: 'd1', name: 'Composers', parentId: 'r1' }],
    files: [{ id: 'f1', name: 'Vivaldi', parentId: 'd1', content: 'Winter' }, { id: 'f2', name: 'Bach', parentId: 'd1', content: 'Cello' }],
    links: [{ a: 'f1', b: 'f2' }],
  }));
  const graph = readMind();
  assert.equal(graph.version, 2);
  assert.ok(graph.entities.some(e => e.id === 'd1' && e.type === 'Desk'));
  assert.ok(graph.entities.some(e => e.id === 'f1' && e.content === 'Winter'));
  assert.ok(graph.memberships.some(m => m.roomId === 'r1' && m.entityId === 'f1' && m.parentId === 'd1'));
  assert.ok(graph.relationships.some(r => r.from === 'f1' && r.to === 'f2'));
});

test('Mind preserves Assistant provenance for memories migrated before provenance tracking', () => {
  reset();
  localStorage.setItem('toolbox_assistant_memory_v1_owner', KEY);
  localStorage.setItem('toolbox_assistant_memory_v1', JSON.stringify([{ text: 'Prefers concise replies', at: 12345 }]));
  localStorage.setItem(KEY, JSON.stringify({ version: 2, revision: 1, rooms: [], memberships: [], relationships: [], sources: [], suggestions: [], entities: [{ id: 'old-memory', type: 'Memory', name: 'Prefers concise replies', content: 'Prefers concise replies', properties: {}, createdAt: 12345, status: 'active', sourceIds: [] }] }));
  assert.equal(readMind().entities[0].properties.origin, 'assistant');
  assert.equal(readMind().entities[0].properties.origin, 'assistant');
});

test('one entity can appear in multiple rooms and retrieval sees graph connections', () => {
  reset();
  const music = addMindRoom('Music'), people = addMindRoom('People');
  const artist = upsertMindEntity({ type: 'Artist', name: 'Sol Gabetta', content: 'Cellist', importance: .9 });
  const song = upsertMindEntity({ type: 'Song', name: 'Cello concerto', content: 'A favourite recording' });
  addMindMembership(music.id, artist.id);
  addMindMembership(people.id, artist.id);
  relateMindEntities(artist.id, song.id, 'performs');
  const graph = readMind();
  assert.equal(graph.entities.filter(e => e.id === artist.id).length, 1);
  assert.ok(roomEntities(graph, music).some(e => e.id === artist.id));
  assert.ok(roomEntities(graph, people).some(e => e.id === artist.id));
  assert.equal(recallMind('cellist', 3)[0].id, artist.id);
  assert.ok(recallMind('Sol Gabetta', 3).some(e => e.id === song.id), 'a connected song should be retrieved with the artist');
  assert.ok(compiledMind().adjacency[artist.id].some(e => e.other === song.id));
});

test('compiled entries invalidate after edits; superseded and forgotten memories disappear', () => {
  reset();
  const old = upsertMindEntity({ type: 'Memory', name: 'Old preference', content: 'Likes blue' });
  const first = compiledMind();
  upsertMindEntity({ id: old.id, type: 'Memory', name: old.name, content: 'Likes green' });
  const second = compiledMind();
  assert.notEqual(first.entries[old.id].stamp, second.entries[old.id].stamp);
  supersedeMindEntity(old.id);
  assert.equal(recallMind('green').length, 0);
  assert.equal(forgetMindEntity(old.id), true);
  assert.ok(!readMind().entities.some(e => e.id === old.id));
});

test('deleting a room preserves shared entities and smart rooms derive from properties', () => {
  reset();
  const music = addMindRoom('Music'), people = addMindRoom('People');
  const artist = upsertMindEntity({ type: 'Artist', name: 'Cellist', properties: { genre: 'classical' } });
  addMindMembership(music.id, artist.id);
  addMindMembership(people.id, artist.id);
  const smart = addMindRoom('Classical', { mode: 'smart', rule: { property: 'genre', value: 'classical' } });
  assert.ok(compiledMind().rooms[smart.id].entityIds.includes(artist.id));
  removeMindRoom(music.id);
  assert.ok(roomEntities(readMind(), people).some(e => e.id === artist.id));
  assert.ok(readMind().entities.some(e => e.id === artist.id));
});

test('retrieval combines related concepts with lexical and graph matches', () => {
  reset();
  const vehicle = upsertMindEntity({ type: 'Technology', name: 'My vehicle', content: 'Blue Toyota Corolla' });
  assert.ok(recallMind('car', 3).some(e => e.id === vehicle.id));
});

test('retrieval excludes important but unrelated entities', () => {
  reset();
  upsertMindEntity({ type: 'Project', name: 'Garden redesign', content: 'Plant trees', importance: 1, confidence: 1 });
  assert.deepEqual(recallMind('quantum spectroscopy'), []);
});

test('forgetting removes orphaned sources and suggestions while retaining shared sources', () => {
  reset();
  const source = addMindSource({ kind: 'assistant', ref: 'conversation-1' });
  const privateSource = addMindSource({ kind: 'assistant', ref: 'conversation-2' });
  const a = upsertMindEntity({ type: 'Memory', name: 'A', sourceIds: [source.id, privateSource.id] });
  const b = upsertMindEntity({ type: 'Memory', name: 'B', sourceIds: [source.id] });
  const suggestion = addMindSuggestion(a.id, b.id, 'related');
  forgetMindEntity(a.id);
  const graph = readMind();
  assert.ok(graph.sources.some(s => s.id === source.id));
  assert.ok(!graph.sources.some(s => s.id === privateSource.id));
  assert.ok(!graph.suggestions.some(s => s.id === suggestion.id));
  assert.throws(() => upsertMindEntity({ id: a.id, name: 'Recreated' }), /not found/);
});

test('reviewing a suggested relationship is single-use and does not accept stale entities', () => {
  reset();
  const a = upsertMindEntity({ type: 'Idea', name: 'A' });
  const b = upsertMindEntity({ type: 'Idea', name: 'B' });
  const suggestion = addMindSuggestion(a.id, b.id, 'supports');
  assert.equal(addMindSuggestion(a.id, b.id, 'supports').id, suggestion.id);
  assert.equal(reviewMindSuggestion(suggestion.id, true).status, 'accepted');
  assert.throws(() => reviewMindSuggestion(suggestion.id, true), /already been reviewed/);
  assert.ok(readMind().relationships.some(r => r.from === a.id && r.to === b.id));
  const c = upsertMindEntity({ type: 'Idea', name: 'C' });
  const stale = addMindSuggestion(a.id, c.id, 'related');
  supersedeMindEntity(c.id);
  assert.throws(() => reviewMindSuggestion(stale.id, true), /no longer active/);
  assert.equal(readMind().suggestions.find(s => s.id === stale.id).status, 'pending');
});

test('Assistant Mind updates reject unknown entities without leaving orphaned sources', async () => {
  reset();
  const { executeExtraTool } = await import('../../js/lib/assistant/extra-tools.js');
  await assert.rejects(executeExtraTool('mind', { action: 'update', entityId: 'missing', name: 'Missing entity' }), /not found/);
  assert.equal(readMind().sources.length, 0);
});
