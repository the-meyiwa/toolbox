// Disposable machine index. Every record keeps IDs for lossless graph/source drill-down.
const words = value => [...new Set(String(value ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]{2,}/g) || [])];
const concepts = [
  ['car', 'vehicle', 'automobile'], ['song', 'music', 'melody', 'track'],
  ['person', 'people', 'friend', 'family', 'human'], ['place', 'location', 'city', 'home'],
  ['project', 'work', 'task'], ['idea', 'thought', 'concept'],
  ['favorite', 'favourite', 'prefer', 'preference', 'likes'],
];
const conceptKeys = terms => concepts.flatMap((group, index) => terms.some(t => group.includes(t)) ? [index] : []);
const stamp = e => `${e.updatedAt || e.createdAt || 0}:${e.status}:${e.name}:${e.content}:${JSON.stringify(e.properties || {})}`;
const compact = e => ({
  id: e.id, type: e.type, name: e.name,
  terms: words(`${e.name} ${e.type} ${e.content || ''} ${JSON.stringify(e.properties || {})}`),
  concepts: conceptKeys(words(`${e.name} ${e.type} ${e.content || ''} ${JSON.stringify(e.properties || {})}`)),
  stamp: stamp(e), importance: e.importance ?? .5, confidence: e.confidence ?? 1,
  updatedAt: e.updatedAt || e.createdAt || 0, sourceIds: e.sourceIds || [],
});

export function compileMind(graph, previous = null) {
  const entries = {};
  for (const e of graph.entities) {
    if (e.status !== 'active' || e.memoryType === 'working') continue;
    const old = previous?.version === 2 ? previous.entries?.[e.id] : null;
    entries[e.id] = old?.stamp === stamp(e) ? old : compact(e);
  }
  const adjacency = {};
  for (const edge of graph.relationships) {
    if (edge.status !== 'active' || !entries[edge.from] || !entries[edge.to]) continue;
    (adjacency[edge.from] ||= []).push({ id: edge.id, other: edge.to, type: edge.type });
    (adjacency[edge.to] ||= []).push({ id: edge.id, other: edge.from, type: edge.type });
  }
  const rooms = {};
  for (const r of graph.rooms) {
    const ids = r.mode === 'smart'
      ? graph.entities.filter(e => entries[e.id] && (!r.rule?.type || e.type === r.rule.type) && (!r.rule?.property || e.properties?.[r.rule.property] === r.rule.value) && (!r.rule?.query || `${e.name} ${e.content || ''}`.toLowerCase().includes(String(r.rule.query).toLowerCase()))).map(e => e.id)
      : graph.memberships.filter(m => m.roomId === r.id && entries[m.entityId]).map(m => m.entityId);
    const entityIds = [...new Set(ids)];
    rooms[r.id] = { id: r.id, name: r.name, mode: r.mode, entityIds, summary: `${r.name}: ${entityIds.slice(0, 5).map(id => entries[id]?.name).filter(Boolean).join(', ')}` };
  }
  const ranked = Object.values(entries).sort((a, b) => b.importance - a.importance || b.updatedAt - a.updatedAt);
  const global = ranked.length ? `Mind: ${graph.rooms.slice(0, 8).map(r => r.name).join(', ')}. Key: ${ranked.slice(0, 8).map(e => `${e.name} (${e.type})`).join(', ')}.`.slice(0, 500) : '';
  return { version: 2, revision: graph.revision, global, rooms, entries, adjacency };
}

export function retrieveMind(graph, compiled, query, limit = 8) {
  const terms = words(query);
  if (!terms.length) return [];
  const queryConcepts = conceptKeys(terms);
  const byId = new Map(graph.entities.map(e => [e.id, e]));
  const grams = s => { const value = `  ${String(s).toLowerCase()}  `; return new Set(Array.from({ length: Math.max(0, value.length - 2) }, (_, i) => value.slice(i, i + 3))); };
  const queryGrams = grams(query);
  const similarity = name => { const target = grams(name), common = [...queryGrams].filter(x => target.has(x)).length; return common / Math.max(1, queryGrams.size + target.size - common); };
  const roomMatches = new Set(Object.values(compiled.rooms).filter(r => terms.some(t => r.name.toLowerCase().includes(t))).flatMap(r => r.entityIds));
  const scored = Object.values(compiled.entries).map(entry => {
    const overlap = terms.filter(t => entry.terms.some(w => w === t || (t.length > 3 && w.startsWith(t)))).length;
    const semantic = queryConcepts.filter(key => entry.concepts?.includes(key)).length;
    const names = terms.filter(t => entry.name.toLowerCase().includes(t)).length;
    const recent = Math.max(0, 1 - (Date.now() - entry.updatedAt) / (365 * 86400000));
    return { entry, score: overlap * 3 + semantic * 1.4 + names * 2 + similarity(entry.name) * 2 + (roomMatches.has(entry.id) ? 2 : 0) + entry.importance * .7 + entry.confidence * .4 + recent * .3 };
  }).filter(x => x.score > 1).sort((a, b) => b.score - a.score);
  const candidate = new Map(scored.map(x => [x.entry.id, x]));
  for (const seed of scored.slice(0, 4)) for (const link of compiled.adjacency[seed.entry.id] || []) {
    const entry = compiled.entries[link.other];
    if (!entry) continue;
    const prior = candidate.get(entry.id);
    const relationScore = seed.score * .4 + entry.importance * .3;
    if (!prior || relationScore > prior.score) candidate.set(entry.id, { entry, score: relationScore });
  }
  return [...candidate.values()].sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(50, limit)))
    .map(({ entry, score }) => ({ ...byId.get(entry.id), score, relationships: (compiled.adjacency[entry.id] || []).slice(0, 8), rooms: Object.values(compiled.rooms).filter(r => r.entityIds.includes(entry.id)).map(r => r.name) }));
}
