import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';
import { readMind, addMindRoom, removeMindRoom, upsertMindEntity, addMindMembership, roomEntities, relateMindEntities, compiledMind, recallMind, supersedeMindEntity, forgetMindEntity } from '../../js/lib/mind-store.js';

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
