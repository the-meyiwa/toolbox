/* ============================================================
   Compound search over the curated set and the lazily loaded
   extended table (public/data/compounds-extended.json).
   ============================================================ */

import { COMPOUNDS_DATA } from './compounds-dataset.js';

export const EXTENDED_URL = '/data/compounds-extended.json';

/* Turn one row of the extended table into a record shaped like a curated one. */
export function rowToRecord(columns, row) {
  const r = {};
  columns.forEach((c, i) => { r[c] = row[i]; });
  return {
    cid: r.cid || null,
    cas: r.cas,
    name: r.name,
    formula: r.formula,
    molarMass: r.mw,
    iupac: r.iupac || '',
    melt: r.melt ?? undefined,
    boil: r.boil ?? undefined,
    density: r.density ?? undefined,
    hazards: r.hazard ? r.hazard.split('; ') : [],
    synonyms: r.synonyms ? r.synonyms.split('|') : [],
    category: /C(?![a-z])/.test(r.formula) ? 'Organic' : 'Inorganic',
    fields: [],
    extended: true,
  };
}

function haystackOf(c) {
  return [
    c.name, c.formula, c.cas, c.iupac, c.use, c.category,
    ...(c.fields || []), ...(c.hazards || []), ...(c.synonyms || []),
  ].filter(Boolean).join(' ').toLowerCase();
}

/* A searchable index: records plus a precomputed lowercase haystack per record. */
export function buildIndex(records) {
  return records.map(record => ({ record, hay: haystackOf(record) }));
}

function rank(record, q) {
  const name = (record.name || '').toLowerCase();
  if (name === q || (record.cas || '') === q || (record.formula || '').toLowerCase() === q) return 0;
  if ((record.synonyms || []).some(s => s.toLowerCase() === q)) return 1;
  if (name.startsWith(q)) return 2;
  return 3;
}

/* Every query token must appear somewhere in the record. Exact name, CAS and
   formula matches rank first, then synonym matches, then name prefixes. */
export function searchIndex(index, query, { field = 'all', limit = Infinity } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  const hits = [];
  for (const entry of index) {
    const { record } = entry;
    if (field !== 'all' && !(record.fields || []).includes(field)) continue;
    if (tokens.length && !tokens.every(t => entry.hay.includes(t))) continue;
    hits.push(record);
  }
  if (!tokens.length) return hits.slice(0, limit);
  return hits
    .map(record => ({ record, score: rank(record, q) }))
    .sort((a, b) => a.score - b.score || a.record.name.length - b.record.name.length)
    .slice(0, limit)
    .map(h => h.record);
}

let curatedIndex;
export function curatedCompoundIndex() {
  curatedIndex ??= buildIndex(COMPOUNDS_DATA);
  return curatedIndex;
}

let extendedPromise;
/* Loads the extended table once and indexes it. Records already in the curated
   set (same CAS number) are left out so results are not duplicated. */
export function loadExtendedIndex({ fetchImpl = globalThis.fetch, url = EXTENDED_URL } = {}) {
  extendedPromise ??= (async () => {
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`Could not load the compound index (${res.status})`);
    const data = await res.json();
    const curatedCas = new Set(COMPOUNDS_DATA.map(c => c.cas).filter(Boolean));
    const records = data.rows
      .filter(row => !curatedCas.has(row[data.columns.indexOf('cas')]))
      .map(row => rowToRecord(data.columns, row));
    return { index: buildIndex(records), total: data.rows.length };
  })().catch(err => {
    extendedPromise = undefined;
    throw err;
  });
  return extendedPromise;
}
