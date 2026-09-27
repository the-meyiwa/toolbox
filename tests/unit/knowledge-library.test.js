/* ============================================================
   Assistant knowledge library: learning concepts from the web
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

setupDOMEnvironment();
const KL = await import('../../js/lib/assistant/knowledge-library.js');

test('Knowledge library: learn, search, update and forget', () => {
  KL.forgetKnowledge({ all: true });
  const r = KL.learnConcepts({ topic: 'tensegrity', concepts: [
    { term: 'Tensegrity', summary: 'A structural principle where isolated compression struts float inside a continuous net of tension cables.', source: 'https://en.wikipedia.org/wiki/Tensegrity', tags: ['structure'] },
    { term: 'Strut', summary: 'too short' },
    { term: 'Prestress', summary: 'Tension locked into the cables so the whole assembly stays rigid under load.', source: '<b>notes</b>' },
  ] });
  assert.deepEqual([r.added, r.updated], [2, 0]);
  const again = KL.learnConcepts({ topic: 'tensegrity', concepts: [{ term: 'tensegrity', summary: 'Isolated struts in compression held by a continuous tension network of cables.' }] });
  assert.deepEqual([again.added, again.updated, again.total], [0, 1, 2]);
  const found = KL.searchKnowledge('tensegrity cables');
  assert.equal(found[0].term.toLowerCase(), 'tensegrity');
  assert.equal(found.find(c => c.term === 'Prestress').source, 'notes');   // markup stripped
  assert.equal(KL.searchKnowledge('concrete slab').length, 0);
  assert.equal(KL.forgetKnowledge({ term: 'prestress' }).removed, 1);
  assert.equal(KL.listKnowledge().length, 1);
});

test('Knowledge library: extracts definitions and figures, not page furniture', () => {
  const text = 'We use cookies to improve your experience on this website, please accept them. '
    + 'A space frame is a rigid, lightweight, truss-like structure built from interlocking struts in a geometric pattern. '
    + 'Space frames can span 30 m to 150 m with few interior supports, and the depth is typically span/20 to span/30. '
    + 'Our team loves building things and we are proud of the many happy clients across the region. '
    + 'Subscribe to our newsletter for more articles about building.';
  const out = KL.extractConcepts(text, 'space frame', 'https://example.edu/space-frames');
  assert.ok(out.length >= 2);
  assert.ok(out.some(c => /space frame/i.test(c.term)));
  assert.ok(out.every(c => !/cookies|newsletter|happy clients/i.test(c.summary)));
  assert.ok(out.every(c => c.source === 'https://example.edu/space-frames'));
});

test('Knowledge library: studies a topic through the search and page endpoints', async () => {
  KL.forgetKnowledge({ all: true });
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    const body = String(url).includes('/browser/search')
      ? { results: [{ title: 'Shop', url: 'https://shop.example.com/domes' }, { title: 'Geodesic dome', url: 'https://engineering.example.edu/geodesic' }] }
      : { success: true, title: 'Geodesic domes', text: 'A geodesic dome is a hemispherical thin-shell structure based on a geodesic polyhedron. Frequency 3 domes use two strut lengths and typically span 10 m to 60 m. Click here to buy now.' };
    return { ok: true, json: async () => body };
  };
  try {
    const r = await KL.knowledgeLibraryTool({ action: 'study', topic: 'geodesic dome', max_pages: 1, save: true });
    assert.equal(r.status, 'success');
    assert.equal(r.pagesRead[0].url, 'https://engineering.example.edu/geodesic');   // reference sources first
    assert.ok(r.candidates.length >= 1);
    assert.ok(r.saved.added >= 1);
    assert.ok(calls.some(u => u.startsWith('/api/assistant/browser/fetch?url=')));
    const recall = await KL.knowledgeLibraryTool({ action: 'search', query: 'geodesic dome' });
    assert.ok(recall.count >= 1);
  } finally {
    globalThis.fetch = realFetch;
    KL.forgetKnowledge({ all: true });
  }
});
