/* ============================================================
   Cosmetics Database: catalogue integrity, every ingredient is a
   Compound Database record, label analysis, search, live Open
   Beauty Facts parsing, the Assistant tool, and motion.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const db = await import('../../js/lib/cosmetics/db.js');
const { COMPOUNDS_DATA } = await import('../../js/lib/compounds-dataset.js');
const { curatedCompoundIndex, searchIndex } = await import('../../js/lib/compound-search.js');
const tool = await import('../../js/lib/cosmetics/assistant.js');

test('catalogue: brands from around the world, products tied to real brand records', () => {
  assert.ok(db.BRANDS.length >= 300, `${db.BRANDS.length} brands`);
  assert.ok(db.STATS.countries >= 30, `${db.STATS.countries} countries`);
  assert.ok(db.PRODUCTS.length >= 150, `${db.PRODUCTS.length} products`);
  const ids = db.PRODUCTS.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length, 'product ids are unique');
  assert.equal(new Set(db.BRANDS.map(b => b.id)).size, db.BRANDS.length, 'brand ids are unique');
  for (const p of db.PRODUCTS) {
    assert.ok(db.BRAND_BY_ID.has(p.brandId), `${p.name}: unknown brand ${p.brandId}`);
    assert.ok(p.inci.length >= 1, `${p.name} has an ingredient list`);
    assert.ok(db.CATEGORY_BY_ID[p.category], `${p.name}: category ${p.category}`);
  }
  for (const c of db.CATEGORIES) assert.ok(db.PRODUCTS.some(p => p.category === c.id), `no ${c.id} products`);
  for (const country of ['Nigeria', 'South Korea', 'Japan', 'France', 'India', 'Brazil', 'China', 'South Africa', 'United States', 'United Kingdom', 'Germany']) {
    assert.ok(db.BRANDS.some(b => b.country === country), `no brand from ${country}`);
  }
});

test('every ingredient of every product is a record in the Compound Database', () => {
  const byName = new Map(COMPOUNDS_DATA.map(c => [c.name, c]));
  // Curated labels are dictionary-backed; community labels retain unknown entries visibly.
  for (const p of db.PRODUCTS.filter(p => p.source === 'catalogue')) {
    for (const name of p.inci) {
      const info = db.ingredientInfo(name);
      assert.ok(info, `${p.brand} ${p.name}: "${name}" is not in the ingredient dictionary`);
      const rec = byName.get(info.c);
      assert.ok(rec, `"${name}" maps to "${info.c}", which is not a Compound Database record`);
      assert.ok(rec.inci?.includes(info.inci), `"${info.c}" does not carry the label name "${info.inci}"`);
      assert.ok(rec.fields.includes('Cosmetic & Personal Care'), `"${info.c}" is not in the cosmetic field`);
    }
  }
  // and the dictionary is exactly the build script's list
  const rows = fs.readFileSync('scripts/compounds/cosmetic-inci.txt', 'utf8').split('\n').filter(l => l.includes(' | ') && !l.startsWith('#')).map(l => l.split(' | ')[0]);
  assert.deepEqual(new Set(rows), new Set(Object.keys(db.INCI)));
  const community = db.PRODUCTS.find(p => p.source === 'openbeautyfacts' && db.analyse(p).unknown.length);
  assert.ok(community, 'community labels may contain unknown ingredients');
  assert.ok(db.analyse(community).notes.some(n => n.title === 'Label coverage'));
});

test('Compound Database: label names are searchable and identifiers are right', () => {
  const idx = curatedCompoundIndex();
  assert.equal(searchIndex(idx, 'Aqua', { limit: 1 })[0].name, 'Water');
  assert.equal(searchIndex(idx, 'Glycerin', { limit: 1 })[0].name, 'Glycerol');
  assert.equal(db.INCI.Glycerin.formula, 'C3H8O3');
  assert.equal(db.INCI.Niacinamide.cas, '98-92-0');
  assert.equal(db.INCI['CI 77891'].c, 'Titanium dioxide');
  // polymers are named records, never mistaken for their (hazardous) monomers
  assert.ok(!db.INCI.Polyacrylamide.formula, 'polyacrylamide is not acrylamide');
  assert.ok(!db.INCI.Polyethylene.formula, 'polyethylene is not ethene');
  assert.equal(db.INCI['Zinc Gluconate'].cas, '4468-02-4');
});

test('reading a label: fragrance allergens, alcohol, silicones, composition', () => {
  const no5 = db.PRODUCT_BY_ID.get('chanel--n-5-eau-de-parfum');
  const a = db.analyse(no5);
  assert.ok(a.allergens.length >= 8);
  assert.ok(a.notes.some(n => /allergen/.test(n.title)));
  assert.ok(a.notes.some(n => /Alcohol high/.test(n.title)));
  const cerave = db.analyse(db.PRODUCT_BY_ID.get('cerave--moisturizing-cream'));
  assert.ok(cerave.notes.some(n => n.title === 'No added fragrance'));
  assert.ok(cerave.silicones.some(s => s.name === 'Dimethicone'));
  assert.equal(Object.values(cerave.groups).reduce((x, y) => x + y, 0), 24);
  assert.ok(!cerave.groups.other, 'every ingredient has a job group');
  for (const p of db.PRODUCTS.filter(p => p.source === 'catalogue')) assert.ok(!db.analyse(p).groups.other, `${p.name} has ungrouped ingredients`);
});

test('search, similar formulas and label parsing', () => {
  assert.equal(db.search('cerave moisturizing cream').products[0].id, 'cerave--moisturizing-cream');
  assert.equal(db.search('nivea creme').products[0].name, 'Creme');
  assert.equal(db.search('cosrx').brands[0].name, 'COSRX');
  assert.equal(db.search('glycerin').ingredients[0].inci, 'Glycerin');
  const sim = db.similarProducts(db.PRODUCT_BY_ID.get('cerave--moisturizing-cream'), 3);
  assert.ok(sim.length && sim[0].product.brandId === 'cerave');
  assert.deepEqual(db.splitIngredients('Ingredients: AQUA, GLYCERIN, PARFUM (FRAGRANCE, SCENT), CI 77891.'), ['Aqua', 'Glycerin', 'Parfum (Fragrance, Scent)', 'CI 77891']);
  const p = db.fromOpenBeautyFacts({ code: '1', product_name: 'Crème', brands: 'Nivea, Beiersdorf', categories: 'Face creams', ingredients_text: 'Aqua, Glycerin' });
  assert.equal(p.brandId, 'nivea');
  assert.equal(p.type, 'moisturizer');
  assert.deepEqual(p.inci, ['Aqua', 'Glycerin']);
  assert.equal(db.ingredientInfo('AQUA/WATER/EAU').c, 'Water');
});

test('live lookup: Open Beauty Facts search is parsed into products', async () => {
  let url = '';
  const fetchImpl = async (u) => { url = u; return { ok: true, json: async () => ({ products: [{ code: '3337875597197', product_name: 'Effaclar Duo+M', brands: 'La Roche-Posay', categories: 'Face creams', ingredients_text: 'AQUA / WATER, NIACINAMIDE' }] }) }; };
  const list = await db.searchOnline('effaclar', { fetchImpl });
  assert.match(url, /^https:\/\/world\.openbeautyfacts\.org\/cgi\/search\.pl\?search_terms=effaclar/);
  assert.equal(list[0].brandId, 'la-roche-posay');
  assert.equal(list[0].source, 'openbeautyfacts');
  assert.equal(db.ingredientInfo(list[0].inci[0]).c, 'Water');
});

test('Assistant tool: products, ingredients, brands, filters and comparisons', async () => {
  const product = await tool.cosmeticsTool({ action: 'product', query: 'CeraVe Moisturizing Cream' });
  assert.equal(product.status, 'success');
  assert.equal(product.renderer, 'cosmetic');
  assert.equal(product.ingredients.length, 24);
  assert.match(product.message, /Ceramide NP/);
  const ing = await tool.cosmeticsTool({ action: 'ingredient', query: 'niacinamide' });
  assert.equal(ing.compound, 'Nicotinamide');
  assert.ok(ing.products.length >= 5);
  const brand = await tool.cosmeticsTool({ action: 'brand', query: 'Zaron' });
  assert.equal(brand.country, 'Nigeria');
  const find = await tool.cosmeticsTool({ action: 'find', category: 'sun', free_of: ['fragrance'] });
  assert.ok(find.total >= 1);
  for (const p of find.products) {
    const a = db.analyse(db.PRODUCT_BY_ID.get(p.id));
    assert.ok(!a.fragrance.length && !a.allergens.length, `${p.name} has fragrance`);
  }
  const cmp = await tool.cosmeticsTool({ action: 'compare', query: 'cerave moisturizing cream', other: 'cetaphil moisturizing cream' });
  assert.ok(cmp.shared.includes('Glycerol'));
  const decl = tool.COSMETICS_TOOL_DECLARATION;
  assert.equal(decl.name, 'cosmetics_database');
  assert.deepEqual(decl.parameters.properties.category.enum, db.CATEGORIES.map(c => c.id));
  const groups = await import('../../js/lib/assistant/tool-groups.js');
  assert.ok(groups.TOOL_GROUPS.cosmetics.tools.includes('cosmetics_database'));
  assert.ok(groups.TOOL_GROUPS.cosmetics.match.test('is the ordinary niacinamide good for oily skin'));
});

test('tool: registered, and every block has an entrance', () => {
  const src = fs.readFileSync('js/tools/cosmetics-database.js', 'utf8');
  const motionCss = fs.readFileSync('css/motion.css', 'utf8');
  const css = fs.readFileSync('css/cosmetics.css', 'utf8');
  const block = src.slice(src.indexOf('const MOTION'), src.indexOf('export default'));
  const kinds = [...new Set([...block.matchAll(/\['[^']+',\s*'([a-z]+)'\]/g)].map(m => m[1]))];
  assert.ok(kinds.length >= 9, `kinds: ${kinds}`);
  for (const k of kinds) assert.ok(motionCss.includes(`[data-rv="${k}"]`), `no styles for "${k}"`);
  for (const sel of ['.cz-tile', '.cz-pcard', '.cz-irow', '.cz-brow', '.cz-lrow', '.cz-urow', '.cz-note', '.cz-compo', '.cz-stat', '.cz-chip', '.cz-card', 'p']) assert.ok(block.includes(sel), `${sel} is not animated`);
  assert.match(block, /fill: '[^']*\.cz-seg/, 'the composition bar fills');
  assert.match(src, /data-count=/, 'figures count up');
  assert.match(src, /class="home-search-wrap cz-qs"/, 'the search bar is the home page one');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  const registry = fs.readFileSync('js/registry/tools.js', 'utf8');
  assert.match(registry, /id: 'cosmetics-database'/);
  assert.match(fs.readFileSync('css/style.css', 'utf8'), /cosmetics\.css/);
});
