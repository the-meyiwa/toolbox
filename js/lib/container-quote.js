/* ============================================================
   Quote engine.

   Pure calculation: takes the geometry and specification from the
   planner and produces a priced bill of quantities. No DOM here, so
   the numbers can be reasoned about (and corrected) on their own.

   Convention used throughout, and stated in the UI so nobody has to
   guess: material carries the wastage allowance, labour does not.
   You pay for the offcut; you do not pay someone to fit it.
   ============================================================ */

import {
  SERVICES,
  LOGISTICS,
  defaultRateBook,
  elementsWith,
} from './container-catalog.js';
import { PART, UNIT_TYPE, extOf, layoutUnits, adjoiningPairs } from './container-library.js';

const STUD_CENTRES = 0.6;   // metres

/* ------------------------------------------------------------
   Quantities derived from the modelled unit.
   ------------------------------------------------------------ */

function unitQuantities(state) {
  const { len, wid, hgt } = state;
  const items = state.items || [];

  const floorArea     = len * wid;
  const perimeter     = 2 * (len + wid);
  const grossWallArea = perimeter * hgt;

  const openings    = items.filter(i => i.kind === 'opening');
  const openingArea = openings.reduce((s, o) => s + o.w * o.h, 0);
  const glazingArea = openings.filter(o => PART[o.type]?.glazed).reduce((s, o) => s + o.w * o.h, 0);

  const netWallArea = Math.max(grossWallArea - openingArea, 0);

  const partitionArea = items
    .filter(i => i.kind === 'fitting' && i.type === 'partition')
    .reduce((s, p) => s + Math.min(p.d ?? 2.35, wid) * Math.min(2.30, hgt) * 2, 0);

  const studLength = (perimeter / STUD_CENTRES + 4) * hgt + perimeter * 2;
  const ext = state.preset ? extOf(state) : { len: len + 0.16, wid: wid + 0.086 };

  return {
    floorArea,
    perimeter,
    grossWallArea,
    openingArea,
    openingCount: openings.length,
    glazingArea,

    interiorArea: netWallArea + partitionArea,
    exteriorArea: netWallArea,
    roofArea: floorArea,
    envelopeArea: netWallArea + floorArea,          // walls + roof
    shellArea: grossWallArea + floorArea * 2,       // walls + roof + deck
    paintArea: netWallArea + partitionArea + floorArea,
    studLength,
    partitionArea,
    volume: floorArea * hgt,
    supports: len > 7 ? 6 : 4,
    footprintArea: ext.len * ext.wid,
  };
}

/**
 * Quantities for the build. A single unit ({len, wid, hgt, items}) or a
 * Builder layout ({units: [...], site: [...]}), where each unit carries
 * its own size and items and the totals are summed.
 */
export function deriveQuantities(state) {
  if (!Array.isArray(state.units)) return unitQuantities(state);
  const units = state.units;
  const layout = layoutUnits(units);
  const sum = {};
  for (const u of units) {
    const q = unitQuantities(u);
    for (const [k, v] of Object.entries(q)) sum[k] = (sum[k] || 0) + v;
    const lv = u.level || 0;
    if (lv > 0) { sum.supports -= q.supports; sum.footprintArea -= q.footprintArea; }
    // A roof under another unit needs no waterproofing.
    sum.roofArea -= Math.min(q.roofArea, layout.get(u.id)?.covered || 0);
  }
  sum.units = units.length;
  sum.stacked = units.filter(u => (u.level || 0) > 0).length;
  sum.joins = adjoiningPairs(units).length;
  sum.transfers = units.filter(u => (u.level || 0) > 0 && !layout.get(u.id).aligned).length;
  sum.overhang = units.reduce((s, u) => s + (layout.get(u.id).overhang >= 0.3 ? layout.get(u.id).overhang : 0), 0);
  sum.fortyEquivalents = units.reduce((s, u) => s + (extOf(u).len > 7 ? 1 : 0.5), 0);
  return sum;
}

/* ------------------------------------------------------------
   One priced line.
   ------------------------------------------------------------ */

function priceLine({ id, group, name, unit, coverage, qty, wastage, rate, labour }) {
  const safeQty     = Math.max(Number(qty) || 0, 0);
  const safeWastage = Math.max(Number(wastage) || 0, 0);

  // Material takes the wastage; whole-unit items round up because you
  // cannot buy two thirds of a sheet or half a door.
  let chargeQty = safeQty * (1 + safeWastage / 100);
  if (unit === 'sheet' || unit === 'each' || unit === 'trip') chargeQty = Math.ceil(chargeQty);

  const materialCost = chargeQty * (Number(rate) || 0);
  const labourCost   = safeQty  * (Number(labour) || 0);

  return {
    id, group, name, unit, coverage,
    qty: safeQty,
    wastage: safeWastage,
    chargeQty,
    rate: Number(rate) || 0,
    labour: Number(labour) || 0,
    materialCost,
    labourCost,
    total: materialCost + labourCost,
  };
}

/* Convert an area into the unit the rate is quoted in. */
function quantityFor(entry, area) {
  if (entry.unit === 'sheet' && entry.coverage) return area / entry.coverage;
  return area;
}

/* ------------------------------------------------------------
   Build the whole bill of quantities.
   ------------------------------------------------------------ */

export function buildQuote(state, rateBook, opts = {}) {
  const q = deriveQuantities(state);
  // User-defined materials are part of the catalogue for this quote.
  const elements = elementsWith(state.customMaterials ?? []);
  const book = { ...defaultRateBook(state.customMaterials ?? []), ...rateBook };
  const spec = state.spec || {};
  const overrides = opts.overrides || {};
  const removed = new Set(opts.removed || []);

  const lines = [];

  const push = (id, entry, qty, extra = {}) => {
    if (!entry || removed.has(id)) return;
    const ov = overrides[id] || {};
    // A line with nothing to price is noise on a quote — drop it, unless
    // the user has explicitly typed a quantity or rate in.
    const finalQty  = ov.qty !== undefined ? ov.qty : qty;
    const finalRate = ov.rate !== undefined ? ov.rate : entry.rate;
    const finalLab  = ov.labour !== undefined ? ov.labour : entry.labour;
    if (finalQty <= 0) return;
    if (finalRate === 0 && finalLab === 0 && ov.rate === undefined && ov.labour === undefined) return;

    lines.push(priceLine({
      id,
      group: extra.group || entry.group || 'Other',
      name: ov.name ?? entry.name,
      unit: entry.unit,
      coverage: entry.coverage,
      qty: finalQty,
      wastage: ov.wastage !== undefined ? ov.wastage : entry.wastage,
      rate: finalRate,
      labour: finalLab,
    }));
  };

  /* --- specified elements --- */
  const multi = Array.isArray(state.units);
  const units = multi ? state.units : [state];
  const allItems = units.flatMap(u => u.items || []);

  for (const el of elements) {
    const chosen = spec[el.id];
    if (!chosen || chosen === 'none') continue;
    if (multi && el.id === 'shell') {
      // One shell per unit, of that unit's size; the spec sets used, one-trip or client-supplied.
      const counts = new Map();
      for (const u of units) {
        const base = UNIT_TYPE[u.preset]?.shell || 'fabricate';
        const opt = chosen === 'client' ? 'client' : base === 'fabricate' ? 'fabricate' : chosen.startsWith('new-') ? base.replace('buy-', 'new-') : base;
        const qty = opt === 'fabricate' ? u.len * u.wid : 1;
        counts.set(opt, (counts.get(opt) || 0) + qty);
      }
      for (const [opt, qty] of counts) { const key = `shell:${opt}`; push(key, book[key], qty, { group: el.name }); }
      continue;
    }
    const key = `${el.id}:${chosen}`;
    const entry = book[key];
    if (!entry) continue;

    const option = el.options.find(o => o.id === chosen);
    const driver = option?.driverOverride || el.driver;

    let baseQty;
    if (driver === 'each') baseQty = 1;
    else baseQty = quantityFor(entry, q[driver] ?? 0);

    push(key, entry, baseQty, { group: el.name });
  }

  /* --- parts placed in the model: openings, fittings, facade, roof, site --- */
  const placed = [...allItems, ...(state.site || []).map(i => ({ ...i, kind: 'site' }))];
  const tally = new Map();
  const add = (key, qty) => tally.set(key, (tally.get(key) || 0) + qty);
  let railing = 0;
  for (const it of placed) {
    const p = PART[it.type];
    const key = `${it.kind}:${it.type}`;
    if (!p || !book[key]) continue;
    const w = it.w ?? p.w, d = it.d ?? p.d, h = it.h ?? p.h;
    let qty = 1;
    if (it.type === 'partition') qty = Math.min(it.d ?? 2.35, 2.35) * Math.min(2.30, h ?? 2.3) * 2;
    else if (p.unit === 'area') qty = p.isWall ? d * h : (it.kind === 'opening' || it.kind === 'facade') ? w * h : w * d;
    else if (p.unit === 'length') qty = p.lengthOf === 'd' ? d : w;
    else if (p.unit === 'panel') qty = Math.max(1, Math.floor(w / p.panel.w)) * Math.max(1, Math.floor(d / p.panel.d));
    add(key, qty);
    if (p.railing) railing += Math.max(0, 2 * (w + d) - 1.0);
  }
  for (const [key, qty] of tally) push(key, book[key], qty, { group: book[key].group });
  const reinforced = allItems.filter(i => i.kind === 'opening' && !PART[i.type]?.open).length;
  if (reinforced > 0) push('opening:reinforce', book['opening:reinforce'], reinforced, { group: 'Doors & windows' });

  /* --- how the units go together --- */
  if (multi) {
    push('works:stack', book['works:stack'], q.stacked);
    push('works:join', book['works:join'], q.joins);
    push('works:transfer', book['works:transfer'], q.transfers);
    push('works:cantilever', book['works:cantilever'], q.overhang * 2);
  }
  push('works:railing', book['works:railing'], railing);

  /* --- services --- */
  for (const s of SERVICES) {
    const key = `service:${s.id}`;
    const entry = book[key];
    if (!entry) continue;
    const manual = state.services?.[s.id];
    // The catalogue's own `auto` is authoritative. An earlier version
    // fell back to floor area for any m² line, which silently billed
    // every quote for burglary proofing the estimator never asked for.
    let qty;
    if (manual !== undefined) qty = manual;
    else if (s.autoFrom) qty = q[s.autoFrom] ?? 0;
    else qty = s.auto ? s.auto(q.floorArea) : 0;
    push(key, entry, qty, { group: 'Services & installations' });
  }

  /* --- logistics --- */
  for (const l of LOGISTICS) {
    const key = `logistics:${l.id}`;
    const entry = book[key];
    if (!entry) continue;
    let qty = state.logistics?.[l.id] ?? l.qty;
    if (multi && state.logistics?.[l.id] === undefined) {
      if (l.id === 'haulage') qty = Math.ceil(q.fortyEquivalents || 1);
      if (l.id === 'offload') qty = q.stacked ? 2 : 1;
    }
    push(key, entry, qty, { group: 'Logistics' });
  }

  /* --- user-added lines --- */
  for (const c of (state.customLines || [])) {
    if (removed.has(c.id)) continue;
    lines.push(priceLine({
      id: c.id, group: 'Additional items', name: c.name, unit: c.unit,
      coverage: null, qty: c.qty, wastage: c.wastage, rate: c.rate, labour: c.labour,
    }));
  }

  return { quantities: q, lines, totals: totalsFor(lines, state.commercial) };
}

/* ------------------------------------------------------------
   Commercial roll-up.
   ------------------------------------------------------------ */

export function totalsFor(lines, commercial = {}) {
  const material = lines.reduce((s, l) => s + l.materialCost, 0);
  const labour   = lines.reduce((s, l) => s + l.labourCost, 0);
  const prime    = material + labour;

  const overheadPct    = Number(commercial.overheadPct) || 0;
  const profitPct      = Number(commercial.profitPct) || 0;
  const contingencyPct = Number(commercial.contingencyPct) || 0;
  const vatPct         = Number(commercial.vatPct) || 0;
  const discount       = Number(commercial.discount) || 0;

  const overhead    = prime * overheadPct / 100;
  const contingency = prime * contingencyPct / 100;
  const profit      = (prime + overhead + contingency) * profitPct / 100;

  const beforeDiscount = prime + overhead + contingency + profit;
  const netTotal = Math.max(beforeDiscount - discount, 0);
  const vat = netTotal * vatPct / 100;

  return {
    material, labour, prime,
    overhead, contingency, profit,
    discount, netTotal, vat,
    grandTotal: netTotal + vat,
  };
}

/* Group lines for display, preserving the catalogue's order. */
export function groupLines(lines) {
  const groups = new Map();
  for (const l of lines) {
    if (!groups.has(l.group)) groups.set(l.group, []);
    groups.get(l.group).push(l);
  }
  return [...groups.entries()].map(([name, items]) => ({
    name,
    items,
    subtotal: items.reduce((s, i) => s + i.total, 0),
  }));
}
