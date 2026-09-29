/* ============================================================
   TOOLBOX — Quick device lookup

   Turns a raw typed query ("18 pro vs s23 plus", "redmi pad se",
   "m6 max") into a direct answer from the device database: a single
   device's specs, or a head-to-head comparison — without the person
   having to open Tech Device Comparisons and pick both devices by
   hand first. Used by Spotlight and the home page search.

   Resolution is typo-tolerant (js/lib/devices/db.js#deviceNameScore)
   and runs across every category at once, so "rtx 5090 vs 4090" and
   "iphone 18 pro vs s23 plus" both just work.
   ============================================================ */

import { CATEGORY_ORDER, CATEGORIES, loadCategory, deviceNameScore, searchDevices } from './db.js';

const STORE = 'toolbox_devices_v2';
const MIN_SINGLE = 0.62;   // confidence floor for a bare "show me this device" query
const MIN_SIDE = 0.55;     // confidence floor for each side of an "A vs B" query

/** Splits "A vs B" / "A versus B" into two trimmed halves, or null. */
export function splitVsQuery(raw) {
  const parts = String(raw || '').split(/\s+(?:vs\.?|versus)\s+/i);
  if (parts.length !== 2) return null;
  const [a, b] = parts.map(s => s.trim());
  if (!a || !b || a.length > 60 || b.length > 60) return null;
  return [a, b];
}

/** A query only worth treating as a device lookup if it looks device-shaped:
    a model number, or a recognisable brand/family word. Keeps Spotlight and
    the home search from firing a device search on ordinary text. */
const DEVICEY = new RegExp([
  '\\d', // any digit — model numbers, generations, sizes
  'iphone', 'ipad', 'macbook', 'imac', 'airpods', 'apple watch', '\\bair\\b',
  'galaxy', 'pixel', 'oneplus', 'redmi', 'poco', 'realme', 'xiaomi', 'huawei', 'honor', 'oppo', 'vivo',
  'nothing phone', '\\bmoto\\b', 'nokia', 'tecno', 'infinix', 'itel', 'xperia', 'rog phone', 'zenfone',
  'thinkpad', 'ideapad', 'chromebook', 'surface', 'yoga', 'zenbook', 'xps', 'spectre', 'pavilion', 'legion',
  'ryzen', 'core i', 'core ultra', 'threadripper', 'snapdragon', 'dimensity', 'exynos', 'kirin', 'helio', 'tensor',
  'radeon', 'geforce', '\\brtx\\b', '\\bgtx\\b', 'arc a', 'arc b', 'nvidia', 'apple m\\d', '\\bm\\d\\b',
  'buds', 'airpods', 'jbl', 'bose', 'sony wh', 'sony wf', 'beats', 'marshall', 'sonos',
  'epson', 'canon', 'brother', '\\bhp\\b', 'bizhub', 'imagerunner',
  'deye', 'growatt', 'victron', '\\bapc\\b', 'cyberpower', 'eaton', 'vertiv',
  'tesla', '\\bbyd\\b', '\\bnio\\b', 'xpeng', 'zeekr', 'ioniq', 'polestar', 'rivian', 'lucid',
  'fender', 'gibson', 'ibanez', 'yamaha', '\\bcasio\\b', 'roland', 'korg', 'schecter', 'prs\\b',
  'anker', 'ugreen', 'ecoflow', 'jackery', 'bluetti', 'nespresso', 'keurig', 'breville', 'delonghi',
].join('|'), 'i');

/** Best-scoring device for `query` in one category, or null. */
async function bestInCategory(query, cat) {
  const data = await loadCategory(cat);
  let best = null;
  for (const d of data.devices) {
    const s = deviceNameScore(query, d);
    if (s > 0 && (!best || s > best.score)) best = { score: s, device: d };
  }
  return best ? { category: cat, data, device: best.device, score: best.score } : null;
}

/** Best-scoring device for `query` across every category, ranked. */
export async function resolveDevice(query, { limit = 5 } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  const hits = (await Promise.all(CATEGORY_ORDER.map(cat => bestInCategory(q, cat)))).filter(Boolean);
  hits.sort((a, b) => b.score - a.score || (b.device._score || 0) - (a.device._score || 0));
  return hits.slice(0, limit);
}

/**
 * Every device matching `query`, across all categories, best first — for a search field
 * that lists many results (resolveDevice keeps only the best per category). Name matches
 * come first; when nothing matches by name, specs and attributes are searched instead
 * ("oled 65", "rtx", "anc").
 * @returns {Promise<Array<{category, data, device, score}>>}
 */
export async function searchAllDevices(query, { limit = 8, categories = CATEGORY_ORDER } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  const all = await Promise.all(categories.map(cat => loadCategory(cat).then(data => ({ cat, data }))));
  const named = [];
  for (const { cat, data } of all) {
    for (const d of data.devices) {
      const s = deviceNameScore(q, d);
      if (s > 0.3) named.push({ category: cat, data, device: d, score: s });
    }
  }
  if (named.length) {
    named.sort((a, b) => b.score - a.score || (b.device._score || 0) - (a.device._score || 0) || (b.device.released || '').localeCompare(a.device.released || ''));
    return named.slice(0, limit);
  }
  const loose = [];
  for (const { cat, data } of all) {
    searchDevices(data, q, limit).forEach((d, i) => loose.push({ category: cat, data, device: d, score: 0.3 - i * 0.01 }));
  }
  return loose.sort((a, b) => b.score - a.score || (b.device._score || 0) - (a.device._score || 0)).slice(0, limit);
}

const norm = (s) => String(s || '').toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const CAT_WORDS = {
  phones: 'smartphone mobile cell', tablets: 'ipad', laptops: 'notebook macbook computer', socs: 'soc mobile chip chipset snapdragon',
  cpus: 'cpu processor desktop chip', gpus: 'gpu graphics video card', watches: 'smartwatch watch wearable', audio: 'headphones earbuds earphones',
  consoles: 'console handheld gaming', tvs: 'tv television', monitors: 'monitor display screen', guitars: 'guitar', keyboards: 'piano keyboard synth',
  coffee: 'coffee espresso', chargers: 'charger cable usb', powerbanks: 'power bank station battery', speakers: 'speaker bluetooth',
  printers: 'printer', copiers: 'copier photocopier', inverters: 'inverter solar', ups: 'ups backup', evs: 'ev electric car vehicle',
};

/** Categories a query names ("phones", "graphics card", "tv"), best first. */
export function matchCategories(query) {
  const q = norm(query);
  if (q.length < 2) return [];
  const out = [];
  for (const cat of CATEGORY_ORDER) {
    const def = CATEGORIES[cat];
    const words = norm(`${def.label} ${def.singular} ${CAT_WORDS[cat] || ''}`).split(' ');
    const phrase = norm(def.label), single = norm(def.singular);
    let s = 0;
    if (q === phrase || q === single || q === cat) s = 1;
    else if (phrase.startsWith(q) || single.startsWith(q)) s = 0.85;
    else if (q.split(' ').every(w => words.some(x => x.startsWith(w) && w.length >= 2))) s = 0.7;
    if (s) out.push({ category: cat, score: s });
  }
  return out.sort((a, b) => b.score - a.score);
}

/**
 * @returns {null | {kind:'compare', category, a, b} | {kind:'device', category, device}}
 */
export async function quickDeviceLookup(raw) {
  const q = String(raw || '').trim();
  if (q.length < 2) return null;

  const vs = splitVsQuery(q);
  if (vs) {
    const [aHits, bHits] = await Promise.all([resolveDevice(vs[0]), resolveDevice(vs[1])]);
    if (!aHits.length || !bHits.length) return null;
    for (const am of aHits) {
      if (am.score < MIN_SIDE) break;
      const bm = bHits.find(x => x.category === am.category && x.device.id !== am.device.id && x.score >= MIN_SIDE);
      if (bm) return { kind: 'compare', category: am.category, a: am.device, b: bm.device };
    }
    return null;
  }

  if (!DEVICEY.test(q)) return null;
  const hits = await resolveDevice(q, { limit: 1 });
  if (hits.length && hits[0].score >= MIN_SINGLE) {
    return { kind: 'device', category: hits[0].category, device: hits[0].device };
  }
  return null;
}

function writeHandoff(category, pair) {
  try {
    const store = JSON.parse(localStorage.getItem(STORE) || '{}');
    store.cat = category;
    store.view = 'compare';
    store.handoff = { cat: category, pair };
    localStorage.setItem(STORE, JSON.stringify(store));
  } catch { /* private mode: the tool just opens on its last state */ }
}

/** Opens Tech Device Comparisons pre-loaded with this result. */
export function openQuickResult(hit) {
  if (hit.kind === 'compare') writeHandoff(hit.category, [hit.a.id, hit.b.id]);
  else writeHandoff(hit.category, [hit.device.id, null]);
  window.location.hash = '#tech-device-comparisons';
}

/** A short line describing the match, for a search-result hint. */
export function quickResultHint(hit) {
  const label = CATEGORIES[hit.category]?.label || 'device';
  return hit.kind === 'compare'
    ? `${label} · Better tech and better buy`
    : `${hit.device.brand} · ${label} specs and score`;
}

export function quickResultTitle(hit) {
  return hit.kind === 'compare' ? `${hit.a.name} vs ${hit.b.name}` : hit.device.name;
}
