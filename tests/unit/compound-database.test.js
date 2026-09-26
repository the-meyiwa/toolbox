/* ============================================================
   Compound database: search, extended index, PubChem client.
   PubChem calls run against a stubbed fetch.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildIndex, searchIndex, rowToRecord, curatedCompoundIndex, loadExtendedIndex,
} from '../../js/lib/compound-search.js';
import {
  searchPubChem, fetchGhs, fetchCasNumber, looksLikeFormula, isCasNumber,
} from '../../js/lib/pubchem.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const extendedPath = path.join(root, 'public/data/compounds-extended.json');
const extended = JSON.parse(fs.readFileSync(extendedPath, 'utf8'));

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

test('Compounds: extended index is well formed and large', () => {
  assert.deepEqual(extended.columns.slice(0, 5), ['cid', 'cas', 'name', 'formula', 'mw']);
  assert.ok(extended.rows.length > 50000, `expected tens of thousands of rows, got ${extended.rows.length}`);
  const cas = extended.columns.indexOf('cas');
  const water = extended.rows.find(r => r[cas] === '7732-18-5');
  assert.ok(water, 'water is in the index');
  const rec = rowToRecord(extended.columns, water);
  assert.equal(rec.formula, 'H2O');
  assert.ok(Math.abs(rec.molarMass - 18.015) < 0.01);
  assert.equal(rec.boil, 100);
  // Cloudflare static assets are capped at 25 MiB per file.
  assert.ok(fs.statSync(extendedPath).size < 25 * 1024 * 1024);
});

test('Compounds: exact name, CAS and formula matches rank first', () => {
  const index = curatedCompoundIndex();
  assert.equal(searchIndex(index, 'caffeine')[0].name, 'Caffeine');
  assert.equal(searchIndex(index, '50-78-2')[0].cas, '50-78-2');
  assert.equal(searchIndex(index, 'C6H6')[0].name, 'Benzene');
});

test('Compounds: field filter limits results to that field', () => {
  const results = searchIndex(curatedCompoundIndex(), 'herbicide', { field: 'Agricultural' });
  assert.ok(results.length > 10);
  assert.ok(results.every(r => r.fields.includes('Agricultural')));
  assert.equal(searchIndex(curatedCompoundIndex(), 'herbicide', { field: 'Cosmetic & Personal Care' }).length, 0);
});

test('Compounds: multi-token search requires every token', () => {
  const index = buildIndex([
    { name: 'Alpha', formula: 'C2H6O', use: 'solvent', fields: [] },
    { name: 'Beta', formula: 'C3H8O', use: 'solvent fuel', fields: [] },
  ]);
  assert.deepEqual(searchIndex(index, 'solvent fuel').map(r => r.name), ['Beta']);
});

test('Compounds: extended loader skips compounds already curated', async () => {
  const data = {
    columns: extended.columns,
    rows: [
      [2519, '58-08-2', 'Caffeine', 'C8H10N4O2', 194.19, '', 236, null, null, '', ''],
      [1, '999-99-9', 'Testium oxide', 'TeO', 143.6, '', null, null, null, '', 'test oxide'],
    ],
  };
  const { index, total } = await loadExtendedIndex({ fetchImpl: async () => jsonResponse(data), url: '/x.json' });
  assert.equal(total, 2);
  assert.deepEqual(index.map(e => e.record.name), ['Testium oxide']);
  assert.equal(searchIndex(index, 'test oxide')[0].cas, '999-99-9');
});

test('PubChem: query classification', () => {
  assert.ok(isCasNumber('7732-18-5'));
  assert.ok(!isCasNumber('water'));
  assert.ok(looksLikeFormula('C8H9NO2'));
  assert.ok(looksLikeFormula('NaCl'));
  assert.ok(!looksLikeFormula('Aspirin'));
});

test('PubChem: name search resolves CIDs then properties', async () => {
  const urls = [];
  const fetchImpl = async url => {
    urls.push(url);
    if (url.includes('/name/')) return jsonResponse({ IdentifierList: { CID: [2244] } });
    return jsonResponse({ PropertyTable: { Properties: [{ CID: 2244, Title: 'Aspirin', MolecularFormula: 'C9H8O4', MolecularWeight: '180.16', IUPACName: '2-acetyloxybenzoic acid' }] } });
  };
  const [hit] = await searchPubChem('aspirin', { fetchImpl });
  assert.equal(hit.cid, 2244);
  assert.equal(hit.formula, 'C9H8O4');
  assert.equal(hit.molarMass, 180.16);
  assert.ok(urls[0].includes('/compound/name/aspirin/cids/JSON'));
  assert.ok(urls[1].includes('/compound/cid/2244/property/'));
});

test('PubChem: formula search uses fastformula and a miss returns no results', async () => {
  let url;
  const results = await searchPubChem('C99H1', { fetchImpl: async u => { url = u; return jsonResponse({}, 404); } });
  assert.deepEqual(results, []);
  assert.ok(url.includes('/fastformula/C99H1/'));
});

test('PubChem: GHS classification is parsed and de-duplicated', async () => {
  const record = {
    Record: {
      Section: [{
        Section: [{
          Information: [
            { Name: 'Pictogram(s)', Value: { StringWithMarkup: [{ String: ' ', Markup: [{ Extra: 'Flammable' }, { Extra: 'Health Hazard' }] }] } },
            { Name: 'Signal', Value: { StringWithMarkup: [{ String: 'Danger' }] } },
            { Name: 'GHS Hazard Statements', Value: { StringWithMarkup: [
              { String: 'H225 (100%): Highly Flammable liquid and vapor [Danger Flammable liquids]' },
              { String: 'H350 (97.1%): May cause cancer [Danger Carcinogenicity]' },
            ] } },
            { Name: 'GHS Hazard Statements', Value: { StringWithMarkup: [{ String: 'H225: Highly Flammable liquid and vapor [Danger Flammable liquids]' }] } },
          ],
        }],
      }],
    },
  };
  const ghs = await fetchGhs(241, { fetchImpl: async () => jsonResponse(record) });
  assert.equal(ghs.signal, 'Danger');
  assert.deepEqual(ghs.pictograms, ['Flammable', 'Health Hazard']);
  assert.deepEqual(ghs.statements, ['H225: Highly Flammable liquid and vapor', 'H350: May cause cancer']);
  assert.equal(await fetchGhs(1, { fetchImpl: async () => jsonResponse({}, 404) }), null);
});

test('PubChem: CAS number is picked from synonyms', async () => {
  const fetchImpl = async () => jsonResponse({ InformationList: { Information: [{ Synonym: ['aspirin', '50-78-2', 'ASA'] }] } });
  assert.equal(await fetchCasNumber(2244, { fetchImpl }), '50-78-2');
});

test('PubChem: server errors surface as exceptions', async () => {
  await assert.rejects(searchPubChem('aspirin', { fetchImpl: async () => jsonResponse({}, 503) }));
});
