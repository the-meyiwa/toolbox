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
  ELEMENTS, OPENING_RATES, OPENING_REINFORCEMENT, FITTING_RATES,
  SERVICES, LOGISTICS, defaultRateBook,
} from './container-catalog.js';

const STUD_CENTRES = 0.6;   // metres

/* ------------------------------------------------------------
   Quantities derived from the modelled unit.
   ------------------------------------------------------------ */

export function deriveQuantities(state) {
  const { len, wid, hgt } = state;

  const floorArea     = len * wid;
  const perimeter     = 2 * (len + wid);
  const grossWallArea = perimeter * hgt;

  const openings    = state.items.filter(i => i.kind === 'opening');
  const openingArea = openings.reduce((s, o) => s + o.w * o.h, 0);

  const netWallArea = Math.max(grossWallArea - openingArea, 0);

  // Partitions are lined on both faces.
  const partitionArea = state.items
    .filter(i => i.kind === 'fitting' && i.type === 'partition')
    .reduce((s, p) => s + 2.35 * Math.min(2.30, hgt) * 2, 0);

  // Studs at 600 centres around the perimeter, plus head and sole plates.
  const studLength = (perimeter / STUD_CENTRES + 4) * hgt + perimeter * 2;

  return {
    floorArea,
    perimeter,
    grossWallArea,
    openingArea,
    openingCount: openings.length,

    interiorArea: netWallArea + partitionArea,
    exteriorArea: netWallArea,
    roofArea: floorArea,
    envelopeArea: netWallArea + floorArea,          // walls + roof
    shellArea: grossWallArea + floorArea * 2,       // walls + roof + deck
    paintArea: netWallArea + partitionArea + floorArea,
    studLength,
    partitionArea,
    volume: floorArea * hgt,
  };
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
  const book = { ...defaultRateBook(), ...rateBook };
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
  for (const el of ELEMENTS) {
    const chosen = spec[el.id];
    if (!chosen || chosen === 'none') continue;
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

  /* --- openings, counted from the model --- */
  const byType = new Map();
  for (const o of state.items.filter(i => i.kind === 'opening')) {
    byType.set(o.type, (byType.get(o.type) || 0) + 1);
  }
  for (const [type, count] of byType) {
    const key = `opening:${type}`;
    push(key, book[key], count, { group: 'Doors & windows' });
  }
  if (q.openingCount > 0) {
    push('opening:reinforce', book['opening:reinforce'], q.openingCount, { group: 'Doors & windows' });
  }

  /* --- fittings placed in the model --- */
  const fittingCounts = new Map();
  for (const f of state.items.filter(i => i.kind === 'fitting')) {
    fittingCounts.set(f.type, (fittingCounts.get(f.type) || 0) + 1);
  }
  for (const [type, count] of fittingCounts) {
    const key = `fitting:${type}`;
    const entry = book[key];
    if (!entry) continue;
    // Partitions are priced by area, everything else by the item.
    const qty = type === 'partition' ? q.partitionArea : count;
    push(key, entry, qty, { group: 'Fittings & furniture' });
  }

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
    const qty = state.logistics?.[l.id] ?? l.qty;
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
