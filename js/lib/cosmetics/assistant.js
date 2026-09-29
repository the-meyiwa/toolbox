/* ============================================================
   TOOLBOX — Cosmetics Database for the Assistant

   cosmetics_database: a product's specs and full ingredient list
   (every ingredient explained), an ingredient, a brand, products
   matching filters, or two products side by side. Products outside
   the catalogue are looked up live in Open Beauty Facts.
   Card: js/lib/assistant/renderers.js (renderer "cosmetic").
   ============================================================ */

import {
  PRODUCTS, BRANDS, BRAND_BY_ID, INCI, analyse, ingredientInfo, productsOfBrand, productsWith, search, searchOnline,
  typeLabel, groupOf, similarProducts,
} from './db.js';

export { COSMETICS_TOOL_DECLARATION } from './declaration.js';

const lower = (s) => String(s || '').toLowerCase();

/** The catalogue product the words name best, or null. */
export function findProduct(query) {
  const q = String(query || '').trim();
  if (!q) return null;
  const hits = search(q, { limit: 3 }).products;
  if (!hits.length) return null;
  // every word typed must be in the brand + name (so "cerave cream" ≠ a Nivea cream)
  const words = lower(q).replace(/[^a-z0-9%+ ]+/g, ' ').split(/\s+/).filter(w => w.length > 1);
  const ok = (p) => { const h = lower(`${p.brand} ${p.name} ${p.type}`).replace(/[^a-z0-9%+ ]+/g, ' '); return words.filter(w => h.includes(w)).length >= Math.max(1, Math.ceil(words.length * 0.6)); };
  return hits.find(ok) || null;
}
export function findBrand(query) {
  const q = lower(query).trim();
  if (!q) return null;
  return BRANDS.find(b => lower(b.name) === q) || BRANDS.find(b => lower(b.name).startsWith(q)) || search(query, { limit: 1 }).brands[0] || null;
}

function specLines(p) {
  const s = p.specs;
  return [['Type', typeLabel(p.type)], ['Size', p.size], ['Launched', p.year], ['SPF', s.spf], ['PA', s.pa], ['UVA', s.uva], ['Water resistance', s.water], ['Skin / hair', s.skin || s.hair || s.lips || s.teeth],
    ['Finish', s.finish], ['Coverage', s.coverage], ['Shades', s.shades || s.shade], ['Wear', s.wear], ['Actives', s.actives], ['pH', s.ph], ['Fluoride', s.fluoride], ['Alcohol', s.alcohol],
    ['Concentration', s.conc], ['Family', s.family], ['Perfumer', s.perfumer], ['Top notes', s.top], ['Heart notes', s.heart], ['Base notes', s.base], ['Formula', s.formula], ['Claim', s.claim],
    ['Fragrance-free', p.flags.ff ? 'yes' : ''], ['Non-comedogenic', p.flags.nc ? 'yes (as labelled)' : ''], ['Vegan', p.flags.vegan ? 'yes' : '']].filter(([, v]) => v);
}

function productPayload(p) {
  const a = analyse(p);
  const brand = p.brandId ? BRAND_BY_ID.get(p.brandId) : null;
  const ingredients = a.rows.map(r => ({ name: r.name, does: r.fn || 'not in the dictionary', compound: r.info?.c || null, group: r.group, formula: r.info?.formula || null }));
  const specs = specLines(p);
  const caveat = p.source === 'openbeautyfacts' ? `Community label from Open Beauty Facts; not independently verified or guaranteed complete.${p.imported ? ` Offline snapshot imported ${p.imported}.` : ''}${p.modified ? ` Source record last edited ${p.modified}.` : ''} Unknown ingredients remain unidentified; check the pack.`
    : p.typical ? 'Representative list: key ingredients confirmed, the full list may differ from a given pack.' : 'Published INCI list for one market and version; formulas change, so the pack is the final word.';
  return {
    status: 'success', renderer: 'cosmetic', type: 'cosmetic', kind: 'product',
    id: p.id, name: p.name, brand: p.brand, brandId: p.brandId, country: brand?.country || null, category: p.category, productType: p.type,
    specs: Object.fromEntries(specs), ingredients, notes: a.notes, groups: a.groups, source: p.source, url: p.url || null, image: p.image || null, caveat,
    similar: p.source === 'catalogue' ? similarProducts(p, 4).map(s => ({ id: s.product.id, name: `${s.product.brand} ${s.product.name}`, shared: s.shared })) : [],
    open: p.source === 'catalogue' || p.offline ? { product: p.id } : { online: `${p.brand} ${p.name}` },
    message: `${p.brand} ${p.name} (${typeLabel(p.type)}${brand?.country ? `, ${brand.country}` : ''}).\nSpecs: ${specs.map(([k, v]) => `${k}: ${v}`).join('; ') || 'none listed'}.\nIngredients in label order (${ingredients.length}): ${ingredients.map((x, i) => `${i + 1}. ${x.name} — ${x.does}${x.compound && lower(x.compound) !== lower(x.name) ? ` (${x.compound})` : ''}`).join('; ')}.\nWorth knowing: ${a.notes.map(n => `${n.title}: ${n.text}`).join(' ') || 'nothing stands out'}.\n${caveat} Shown as a card that opens it in the Cosmetics Database.`,
  };
}

function ingredientPayload(info) {
  const uses = productsWith(info.inci).slice().sort((x, y) => x.position - y.position);
  const aliases = Object.entries(INCI).filter(([k, v]) => v.c === info.c && k !== info.inci).map(([k]) => k);
  return {
    status: 'success', renderer: 'cosmetic', type: 'cosmetic', kind: 'ingredient',
    inci: info.inci, compound: info.c, does: info.f, group: groupOf(info.f).label, formula: info.formula || null, molarMass: info.mw || null, cas: info.cas || null, cid: info.cid || null, aliases,
    products: uses.slice(0, 12).map(u => ({ id: u.product.id, name: `${u.product.brand} ${u.product.name}`, position: u.position, of: u.product.inci.length })),
    open: { ingredient: info.inci },
    message: `${info.inci}: ${info.f}. Compound Database record: ${info.c}${info.formula ? ` (${info.formula}${info.cas ? `, CAS ${info.cas}` : ''})` : ''}.${aliases.length ? ` Also on labels as ${aliases.join(', ')}.` : ''} In ${uses.length} catalogue product${uses.length === 1 ? '' : 's'}${uses.length ? `: ${uses.slice(0, 12).map(u => `${u.product.brand} ${u.product.name} (#${u.position} of ${u.product.inci.length})`).join('; ')}` : ''}. Shown as a card.`,
  };
}

function brandPayload(b) {
  const list = productsOfBrand(b.id);
  return {
    status: 'success', renderer: 'cosmetic', type: 'cosmetic', kind: 'brand',
    id: b.id, name: b.name, country: b.country, parent: b.parent, founded: b.founded, focus: b.focus, tier: b.tier,
    products: list.map(p => ({ id: p.id, name: p.name, type: typeLabel(p.type) })),
    open: { brand: b.id },
    message: `${b.name}: ${b.country}${b.founded ? `, founded ${b.founded}` : ''}${b.parent && b.parent !== b.name ? `, owned by ${b.parent}` : ''}. Makes ${b.focus.join(', ')} (${b.tier}). ${list.length ? `In the catalogue: ${list.map(p => p.name).join('; ')}.` : 'No products in the built-in catalogue; its range can be searched live in Open Beauty Facts from the card.'}`,
  };
}

const FREE_OF = {
  fragrance: (a) => a.fragrance.length || a.allergens.length || a.essentialOils.length,
  alcohol: (a, p) => p.inci.some(n => /^(Alcohol|Alcohol Denat\.|Isopropyl Alcohol)$/i.test(n)),
  silicones: (a) => a.silicones.length, silicone: (a) => a.silicones.length,
  sulfates: (a) => a.sulfates.length, sulfate: (a) => a.sulfates.length, sls: (a) => a.sulfates.length,
  parabens: (a) => a.parabens.length, paraben: (a) => a.parabens.length,
  'essential oils': (a) => a.essentialOils.length,
  'mineral oil': (a) => a.mineralOil.length, petrolatum: (a) => a.mineralOil.length,
};
function hasIngredient(p, name) {
  const info = ingredientInfo(name);
  const want = info ? new Set(Object.entries(INCI).filter(([, v]) => v.c === info.c).map(([k]) => lower(k))) : null;
  return p.inci.some(n => (want ? want.has(lower(n)) : lower(n).includes(lower(name))));
}

export async function cosmeticsTool(args = {}) {
  const action = args.action || 'product';
  if (action === 'ingredient') {
    const info = ingredientInfo(args.query) || (search(args.query || '', { limit: 1 }).ingredients[0] && ingredientInfo(search(args.query, { limit: 1 }).ingredients[0].inci));
    if (!info) return { status: 'error', message: `"${args.query}" is not in the cosmetic ingredient dictionary. Look it up with lookup_compound instead.` };
    return ingredientPayload(info);
  }
  if (action === 'brand') {
    const b = findBrand(args.query);
    if (!b) return { status: 'error', message: `No brand named "${args.query}" in the directory of ${BRANDS.length} brands.`, renderer: 'cosmetic', type: 'cosmetic', kind: 'online', query: args.query, open: { online: args.query } };
    return brandPayload(b);
  }
  if (action === 'find') {
    const free = (args.free_of || []).map(lower);
    const list = PRODUCTS.filter(p => {
      if (args.category && p.category !== args.category) return false;
      if (args.type && !lower(p.type).includes(lower(args.type))) return false;
      if (args.min_spf && !(parseFloat(p.specs.spf) >= args.min_spf)) return false;
      if ((args.contains || []).some(c => !hasIngredient(p, c))) return false;
      if (free.length) {
        const a = analyse(p);
        if (!a.complete) return false;
        for (const f of free) { if (FREE_OF[f] ? FREE_OF[f](a, p) : hasIngredient(p, f)) return false; }
      }
      if (args.query && !lower(`${p.brand} ${p.name} ${p.type}`).includes(lower(args.query))) return false;
      return true;
    });
    return {
      status: 'success', renderer: 'cosmetic', type: 'cosmetic', kind: 'list', total: list.length,
      products: list.slice(0, 20).map(p => ({ id: p.id, name: p.name, brand: p.brand, type: typeLabel(p.type), spf: p.specs.spf || null })),
      open: args.query ? { query: args.query } : {},
      message: list.length ? `${list.length} catalogue product${list.length === 1 ? '' : 's'} match: ${list.slice(0, 20).map(p => `${p.brand} ${p.name} (${typeLabel(p.type)}${p.specs.spf ? `, SPF ${p.specs.spf}` : ''})`).join('; ')}. The catalogue is a curated selection, not every product sold.` : 'No catalogue product matches those filters. The catalogue is a curated selection; say so and suggest what to look for on labels.',
    };
  }
  if (action === 'compare') {
    const A = findProduct(args.query), B = findProduct(args.other);
    if (!A || !B) return { status: 'error', message: `Could not find ${!A ? `"${args.query}"` : `"${args.other}"`} in the catalogue.` };
    const setA = new Set(A.inci.map(n => ingredientInfo(n)?.c || n)), setB = new Set(B.inci.map(n => ingredientInfo(n)?.c || n));
    const shared = [...setA].filter(x => setB.has(x)), onlyA = [...setA].filter(x => !setB.has(x)), onlyB = [...setB].filter(x => !setA.has(x));
    const sa = Object.fromEntries(specLines(A)), sb = Object.fromEntries(specLines(B));
    const keys = [...new Set([...Object.keys(sa), ...Object.keys(sb)])];
    return {
      status: 'success', renderer: 'cosmetic', type: 'cosmetic', kind: 'compare',
      a: { id: A.id, name: `${A.brand} ${A.name}`, count: A.inci.length }, b: { id: B.id, name: `${B.brand} ${B.name}`, count: B.inci.length },
      specs: keys.map(k => ({ label: k, a: sa[k] || '—', b: sb[k] || '—' })), shared, onlyA, onlyB,
      open: { product: A.id },
      message: `${A.brand} ${A.name} vs ${B.brand} ${B.name}. Specs: ${keys.map(k => `${k}: ${sa[k] || '—'} vs ${sb[k] || '—'}`).join('; ')}. Shared ingredients (${shared.length}): ${shared.join(', ')}. Only in the first: ${onlyA.join(', ') || 'none'}. Only in the second: ${onlyB.join(', ') || 'none'}.`,
    };
  }
  // product
  const p = findProduct(args.query);
  if (p) return productPayload(p);
  try {
    const online = await searchOnline(args.query, { pageSize: 5 });
    const best = online.find(x => x.inci.length) || online[0];
    if (best) return productPayload(best);
  } catch { /* offline or unreachable: fall through */ }
  const b = findBrand(String(args.query || '').split(/\s+/)[0]);
  return {
    status: 'error', renderer: 'cosmetic', type: 'cosmetic', kind: 'online', query: args.query, open: { online: args.query },
    message: `"${args.query}" is not in the built-in catalogue${b ? ` (the brand ${b.name} is: ${b.country}${b.parent && b.parent !== b.name ? `, ${b.parent}` : ''})` : ''} and Open Beauty Facts could not be reached or has no record. Answer from general knowledge, say so, and suggest reading the INCI list on the pack.`,
  };
}
