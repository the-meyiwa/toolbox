/* ============================================================
   3D Lab — model catalogue and prompt resolver

   MODELS is every procedural model; resolveObject("an iphone 17 pro
   in deep blue") finds the best model or shape for a request and
   reads its options from the words (colour and finish names, select
   options such as "collapsing stock", "no headrest", "32 inch").
   ============================================================ */

import { TECH_MODELS } from './models/tech.js';
import { FURNITURE_MODELS } from './models/furniture.js';
import { WEAPON_MODELS } from './models/weapons.js';
import { OBJECT_MODELS } from './models/objects.js';
import { SHAPES, SHAPE_BY_ID } from './shapes.js';
import { colorFromWords } from './materials.js';

export const MODELS = [...TECH_MODELS, ...FURNITURE_MODELS, ...OBJECT_MODELS, ...WEAPON_MODELS];
export const MODEL_BY_ID = new Map(MODELS.map(m => [m.id, m]));
export const MODEL_CATEGORIES = [...new Set(MODELS.map(m => m.category))];

export function modelDefaults(id) {
  const m = MODEL_BY_ID.get(id);
  return m ? Object.fromEntries(Object.entries(m.params || {}).map(([k, v]) => [k, v.default])) : {};
}

/** Cleans model params: known keys only, values of the right type. */
export function cleanModelParams(id, params = {}) {
  const m = MODEL_BY_ID.get(id);
  const out = {};
  if (!m) return out;
  for (const [k, def] of Object.entries(m.params || {})) {
    const v = params[k];
    if (v == null || v === '') continue;
    if (def.type === 'color') { const c = /^#?[0-9a-f]{6}$/i.test(String(v)) ? `#${String(v).replace('#', '')}` : colorFromWords(String(v)); if (c) out[k] = c; }
    else if (def.type === 'select') { const o = def.options.find(([val, label]) => String(v).toLowerCase() === val || String(v).toLowerCase() === label.toLowerCase()); if (o) out[k] = o[0]; }
    else if (def.type === 'toggle') out[k] = v === true || v === 'true' || v === 1 || v === 'yes' || v === 'on';
    else if (def.type === 'range') { const n = Number(v); if (Number.isFinite(n)) out[k] = Math.min(def.max, Math.max(def.min, n)); }
  }
  return out;
}

/* ---------------- matching ---------------- */

const FILLER = new Set(['a', 'an', 'the', 'of', 'me', 'my', 'for', 'please', 'make', 'create', 'generate', 'build', 'render', 'model', 'models', '3d', 'three', 'dimensional', 'show', 'draw', 'design', 'can', 'you', 'i', 'want', 'need', 'give', 'object', 'realistic', 'detailed', 'simple', 'with', 'in', 'on', 'and', 'some', 'new', 'like', 'that', 'this', 'it', 'is', 'looks']);

export const norm = (s) => ` ${String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[''"“”]/g, '').replace(/[^a-z0-9#+.]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
const compact = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');

function lev(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m || !n) return m || n;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

function aliasScore(q, qTokens, qCompact, alias) {
  const a = norm(alias);
  if (q.includes(a)) return 100 + a.length;
  const ac = compact(alias);
  if (ac.length >= 3 && qCompact.includes(ac) && /\d/.test(ac)) return 90 + ac.length;
  // Every alias word in the query, in any order; words may carry a typo (numbers must be exact).
  // A long name with one typo still beats a shorter exact word ("ofice chair" → office chair, not chair).
  const words = a.trim().split(' ');
  let typos = 0;
  for (const w of words) {
    if (qTokens.includes(w)) continue;
    if (/^\d/.test(w) || w.length < 4) return 0;
    const d = Math.min(...qTokens.filter(t => t.length >= 4).map(t => lev(t, w)), 9);
    if (d > (w.length > 7 ? 2 : 1)) return 0;
    typos += d;
  }
  return 98 + a.length - typos * 4;
}

function candidates() {
  const out = [];
  for (const m of MODELS) out.push({ kind: 'model', id: m.id, names: [m.name, m.id.replace(/-/g, ' '), ...(m.aliases || [])] });
  for (const s of SHAPES) out.push({ kind: 'shape', id: s.id, names: [s.name, s.id.replace(/-/g, ' '), ...(s.aliases || [])] });
  return out;
}
let CANDS = null;

/** Ranked matches for a request: [{ kind, id, score }]. */
export function matchObjects(text, limit = 6) {
  const q = norm(text);
  const qTokens = q.trim().split(' ').filter(t => t && !FILLER.has(t));
  const qCompact = compact(qTokens.join(' '));
  CANDS = CANDS || candidates();
  const hits = [];
  for (const c of CANDS) {
    let best = 0;
    for (const n of c.names) best = Math.max(best, aliasScore(q, qTokens, qCompact, n));
    if (best) hits.push({ kind: c.kind, id: c.id, score: best + (c.kind === 'model' ? 0.5 : 0) });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Model/shape options read from the request's words. */
export function paramsFromText(kind, id, text) {
  const q = norm(text);
  const out = {};
  const defs = kind === 'model' ? MODEL_BY_ID.get(id)?.params || {} : SHAPE_BY_ID.get(id)?.params || {};
  for (const [k, def] of Object.entries(defs)) {
    if (def.type === 'color') {
      const sw = (def.swatches || []).find(([, label]) => q.includes(norm(label)));
      if (sw) { out[k] = sw[0]; continue; }
    } else if (def.type === 'select') {
      const o = def.options.find(([val, label]) => q.includes(norm(label)) || q.includes(norm(val)) || norm(label).trim().split(' ').some(w => w.length > 4 && q.includes(` ${w} `)));
      if (o && o[0] !== def.default) out[k] = o[0];
    } else if (def.type === 'toggle') {
      const lab = norm(def.label).trim();
      if (new RegExp(` (no|without) ${lab}s? `).test(q)) out[k] = false;
      else if (new RegExp(` with ${lab}s? `).test(q)) out[k] = true;
    } else if (def.type === 'range' || def.min != null) {
      if (def.unit === 'in') { const m = q.match(/ (\d{2}(?:\.\d)?) ?(?:in|inch|inches|") /); if (m) out[k] = Math.min(def.max, Math.max(def.min, Number(m[1]))); }
      if (k === 'seats') { const m = q.match(/ (\d) ?(?:seat|seater|seats) /); if (m) out[k] = Number(m[1]); continue; }
      // "level 3", "24 teeth", "7 points", "turns 5"
      const names = [k, norm(def.label || '').trim().split(' ')[0]].filter(Boolean).map(x => x.replace(/[^a-z]/g, ''));
      for (const n of new Set(names)) {
        if (n.length < 3) continue;
        const m = q.match(new RegExp(` ${n}s? (\\d+(?:\\.\\d+)?) `)) || q.match(new RegExp(` (\\d+(?:\\.\\d+)?) ${n}s? `));
        if (m) { out[k] = Math.min(def.max ?? Infinity, Math.max(def.min ?? -Infinity, Number(m[1]))); break; }
      }
    }
  }
  // A plain colour word goes to the first colour parameter.
  const firstColor = Object.entries(defs).find(([, d]) => d.type === 'color');
  if (firstColor && out[firstColor[0]] == null) { const c = colorFromWords(text); if (c) out[firstColor[0]] = c; }
  return out;
}

/** Best model or shape for a request, with options, or null. */
export function resolveObject(text) {
  const hits = matchObjects(text, 6);
  if (!hits.length) return null;
  const top = hits[0];
  return { kind: top.kind, id: top.id, params: paramsFromText(top.kind, top.id, text), score: top.score, alternatives: hits.slice(1) };
}

export function describeLibrary() {
  const byCat = {};
  for (const m of MODELS) (byCat[m.category] = byCat[m.category] || []).push(m.id);
  return byCat;
}
