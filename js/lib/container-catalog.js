/* ============================================================
   Container & cabin conversion catalogue.

   Every rate here is a STARTING POINT, not a price list. Nigerian
   material prices move constantly, so the tool treats this as seed
   data: the user edits rates in the app, they persist to the browser,
   and they can be exported and shared between machines.

   RATES_REVISED is shown in the UI so a stale rate book is obvious.

   Money is in the quote's currency; defaults are Nigerian Naira
   because that is the market this was built for.
   ============================================================ */

export const RATES_REVISED = '2026-08-19';

/* Units and how a quantity is derived.
   'area'      – square metres of the driving surface
   'length'    – linear metres
   'each'      – counted items
   'sheet'     – area converted to boards using `coverage` m² per sheet
   'sum'       – a single lump figure
   'trip'      – deliveries */
export const UNITS = {
  area:   { label: 'm²',    plural: 'm²' },
  length: { label: 'm',     plural: 'm' },
  each:   { label: 'no.',   plural: 'no.' },
  sheet:  { label: 'sheet', plural: 'sheets' },
  sum:    { label: 'sum',   plural: 'sum' },
  trip:   { label: 'trip',  plural: 'trips' },
  litre:  { label: 'litre', plural: 'litres' },
};

/* Standard board sizes, used to turn an area into a sheet count. */
const SHEET_2440 = 1.22 * 2.44;   // 2.977 m² — plywood, ACP, MDF
const SHEET_2400 = 1.20 * 2.40;   // 2.880 m² — gypsum plasterboard

/* ------------------------------------------------------------
   ELEMENTS — the parts of the build the user specifies.
   `driver` names the quantity the options are measured against.
   ------------------------------------------------------------ */

export const ELEMENTS = [
  {
    id: 'shell',
    name: 'Shell / base unit',
    driver: 'each',
    help: 'The container or cabin frame itself. Set to "client supplies" if they already have one.',
    options: [
      { id: 'buy-20', name: '20 ft container (bought used)',      unit: 'each', rate: 2200000, labour: 120000, wastage: 0 },
      { id: 'buy-40', name: '40 ft container (bought used)',      unit: 'each', rate: 3800000, labour: 180000, wastage: 0 },
      { id: 'buy-40hc', name: '40 ft high cube (bought used)',    unit: 'each', rate: 4300000, labour: 200000, wastage: 0 },
      { id: 'fabricate', name: 'Fabricated cabin frame (new steel)', unit: 'area', rate: 46000, labour: 18000, wastage: 6,
        driverOverride: 'floorArea' },
      { id: 'client',  name: 'Client supplies the container',     unit: 'each', rate: 0, labour: 0, wastage: 0 },
    ],
  },

  {
    id: 'prep',
    name: 'Strip, de-rust & prep',
    driver: 'shellArea',
    help: 'Cleaning, patching, treating rust and priming before anything is fitted.',
    options: [
      { id: 'full',  name: 'Full strip, de-rust and prime',  unit: 'area', rate: 900, labour: 1100, wastage: 5 },
      { id: 'light', name: 'Light clean and spot prime',     unit: 'area', rate: 450, labour: 600, wastage: 5 },
      { id: 'none',  name: 'Not required (new unit)',        unit: 'area', rate: 0, labour: 0, wastage: 0 },
    ],
  },

  {
    id: 'exterior',
    name: 'Exterior / cladding',
    driver: 'exteriorArea',
    help: 'What the outside is finished in.',
    options: [
      { id: 'acp4',      name: 'Aluminium composite panel (Aluco) 4 mm', unit: 'sheet', coverage: SHEET_2440, rate: 38000, labour: 9500, wastage: 12 },
      { id: 'acp3',      name: 'Aluminium composite panel (Aluco) 3 mm', unit: 'sheet', coverage: SHEET_2440, rate: 30000, labour: 9500, wastage: 12 },
      { id: 'sand-eps50', name: 'Sandwich panel 50 mm EPS core',         unit: 'area',  rate: 15500, labour: 3600, wastage: 8 },
      { id: 'sand-pu75',  name: 'Sandwich panel 75 mm PU core',          unit: 'area',  rate: 24000, labour: 4200, wastage: 8 },
      { id: 'sand-rw50',  name: 'Sandwich panel 50 mm rockwool core',    unit: 'area',  rate: 20500, labour: 4200, wastage: 8 },
      { id: 'profiled',  name: 'Profiled / corrugated steel sheet',      unit: 'area',  rate: 6800,  labour: 2200, wastage: 10 },
      { id: 'stonecoat', name: 'Stone-coated sheet cladding',            unit: 'area',  rate: 11500, labour: 3400, wastage: 10 },
      { id: 'paint',     name: 'Epoxy paint only (no cladding)',         unit: 'area',  rate: 2200,  labour: 1500, wastage: 6 },
      { id: 'none',      name: 'Leave as-is',                            unit: 'area',  rate: 0, labour: 0, wastage: 0 },
    ],
  },

  {
    id: 'insulation',
    name: 'Insulation',
    driver: 'envelopeArea',
    help: 'Walls and roof. This is what makes the difference between a usable office and an oven.',
    options: [
      { id: 'pu25',   name: 'Spray PU foam 25 mm',        unit: 'area', rate: 5200, labour: 2200, wastage: 8 },
      { id: 'pu50',   name: 'Spray PU foam 50 mm',        unit: 'area', rate: 8800, labour: 3000, wastage: 8 },
      { id: 'eps50',  name: 'EPS board 50 mm',            unit: 'area', rate: 3200,  labour: 1400, wastage: 7 },
      { id: 'rw50',   name: 'Rockwool 50 mm (fire rated)', unit: 'area', rate: 6500,  labour: 2000, wastage: 7 },
      { id: 'glass50', name: 'Fibreglass wool 50 mm',     unit: 'area', rate: 4200,  labour: 1600, wastage: 7 },
      { id: 'foil',   name: 'Reflective foil barrier',    unit: 'area', rate: 1500,  labour: 900, wastage: 6 },
      { id: 'none',   name: 'None',                        unit: 'area', rate: 0, labour: 0, wastage: 0 },
    ],
  },

  {
    id: 'framing',
    name: 'Stud framing',
    driver: 'studLength',
    help: 'The frame the interior lining is fixed to. Quantity is estimated at 600 mm centres.',
    options: [
      { id: 'steel40', name: 'Steel hollow section 40 × 40 × 2 mm', unit: 'length', rate: 2700, labour: 1100, wastage: 10 },
      { id: 'steel25', name: 'Steel hollow section 25 × 25 × 2 mm', unit: 'length', rate: 1750, labour: 900, wastage: 10 },
      { id: 'timber',  name: 'Timber batten 2 × 3',                 unit: 'length', rate: 780,  labour: 620,  wastage: 12 },
      { id: 'none',    name: 'None (direct fix)',                   unit: 'length', rate: 0, labour: 0, wastage: 0 },
    ],
  },

  {
    id: 'interior',
    name: 'Interior wall lining',
    driver: 'interiorArea',
    help: 'The inside wall finish.',
    options: [
      { id: 'ply9',    name: 'Plywood 9 mm',                    unit: 'sheet', coverage: SHEET_2440, rate: 17500, labour: 3500, wastage: 12 },
      { id: 'ply12',   name: 'Plywood 12 mm',                   unit: 'sheet', coverage: SHEET_2440, rate: 22000, labour: 3800, wastage: 12 },
      { id: 'marine18', name: 'Marine plywood 18 mm',           unit: 'sheet', coverage: SHEET_2440, rate: 32000, labour: 4200, wastage: 12 },
      { id: 'packing', name: 'Packing-case board',              unit: 'area',  rate: 4200,  labour: 1800, wastage: 18 },
      { id: 'pvc',     name: 'PVC wall panel',                  unit: 'area',  rate: 4000,  labour: 1700, wastage: 10 },
      { id: 'gypsum',  name: 'Gypsum board 12 mm',              unit: 'sheet', coverage: SHEET_2400, rate: 9500, labour: 3200, wastage: 12 },
      { id: 'mdf',     name: 'MDF laminated board',             unit: 'sheet', coverage: SHEET_2440, rate: 22000, labour: 4200, wastage: 12 },
      { id: 'melamine', name: 'Melamine faced panel',           unit: 'sheet', coverage: SHEET_2440, rate: 24000, labour: 4600, wastage: 12 },
      { id: 'none',    name: 'None (bare shell)',               unit: 'area',  rate: 0, labour: 0, wastage: 0 },
    ],
  },

  {
    id: 'ceiling',
    name: 'Ceiling',
    driver: 'floorArea',
    options: [
      { id: 'pvc',    name: 'PVC ceiling panel',        unit: 'area', rate: 3800, labour: 1800, wastage: 10 },
      { id: 'gypsum', name: 'Gypsum ceiling board',     unit: 'area', rate: 4800, labour: 2400, wastage: 10 },
      { id: 'pop',    name: 'POP (plaster of Paris)',   unit: 'area', rate: 5200, labour: 2800, wastage: 8 },
      { id: 'ply',    name: 'Plywood ceiling',          unit: 'area', rate: 4400, labour: 2000, wastage: 12 },
      { id: 'alu',    name: 'Aluminium strip ceiling',  unit: 'area', rate: 8800, labour: 3000, wastage: 10 },
      { id: 'none',   name: 'None',                     unit: 'area', rate: 0, labour: 0, wastage: 0 },
    ],
  },

  {
    id: 'floor',
    name: 'Floor finish',
    driver: 'floorArea',
    options: [
      { id: 'vinyl',    name: 'Vinyl sheet',              unit: 'area', rate: 4200,  labour: 1800, wastage: 10 },
      { id: 'lvt',      name: 'Vinyl plank / LVT',        unit: 'area', rate: 8500, labour: 2400, wastage: 10 },
      { id: 'ceramic',  name: 'Ceramic tiles',            unit: 'area', rate: 6500,  labour: 3000, wastage: 12 },
      { id: 'porcelain', name: 'Porcelain tiles',         unit: 'area', rate: 9800, labour: 3400, wastage: 12 },
      { id: 'laminate', name: 'Laminate flooring',        unit: 'area', rate: 7200, labour: 2200, wastage: 10 },
      { id: 'epoxy',    name: 'Epoxy floor coating',      unit: 'area', rate: 5600,  labour: 2600, wastage: 6 },
      { id: 'carpet',   name: 'Carpet tiles',             unit: 'area', rate: 6200,  labour: 1900, wastage: 10 },
      { id: 'ply',      name: 'Plywood deck only',        unit: 'area', rate: 5400,  labour: 1800, wastage: 12 },
      { id: 'none',     name: 'None (existing deck)',     unit: 'area', rate: 0, labour: 0, wastage: 0 },
    ],
  },

  {
    id: 'subfloor',
    name: 'Sub-floor',
    driver: 'floorArea',
    help: 'Laid over the original container deck before the finish goes down.',
    options: [
      { id: 'marine18', name: 'Marine plywood 18 mm',    unit: 'area', rate: 11400, labour: 3200, wastage: 10 },
      { id: 'ply12',    name: 'Plywood 12 mm',           unit: 'area', rate: 7400,  labour: 2000, wastage: 10 },
      { id: 'cement',   name: 'Cement board 18 mm',      unit: 'area', rate: 8200,  labour: 2400, wastage: 10 },
      { id: 'none',     name: 'None',                    unit: 'area', rate: 0, labour: 0, wastage: 0 },
    ],
  },

  {
    id: 'paint',
    name: 'Painting & decoration',
    driver: 'paintArea',
    options: [
      { id: 'emulsion', name: 'Emulsion, two coats',       unit: 'area', rate: 1500, labour: 1100, wastage: 8 },
      { id: 'gloss',    name: 'Gloss / enamel, two coats',  unit: 'area', rate: 2100, labour: 1300, wastage: 8 },
      { id: 'texture',  name: 'Textured / decorative coat', unit: 'area', rate: 3600, labour: 2200, wastage: 8 },
      { id: 'none',     name: 'None',                       unit: 'area', rate: 0, labour: 0, wastage: 0 },
    ],
  },
];

/* ------------------------------------------------------------
   OPENINGS — priced per item, quantities come from the 3D model.
   `matches` maps to the planner's opening types.
   ------------------------------------------------------------ */

export const OPENING_RATES = {
  'personnel-door': { name: 'Steel security door, 900 × 2100',      rate: 185000, labour: 38000, wastage: 0 },
  'double-door':    { name: 'Double leaf door, 1800 × 2100',        rate: 320000, labour: 56000, wastage: 0 },
  'roller-door':    { name: 'Roller shutter door',                  rate: 480000, labour: 85000, wastage: 0 },
  'window':         { name: 'Aluminium sliding window, 1200 × 1000', rate: 95000, labour: 19000, wastage: 0 },
  'small-window':   { name: 'Aluminium window, 600 × 600',          rate: 48000, labour: 12000, wastage: 0 },
  'vent':           { name: 'Louvre air vent',                      rate: 12000, labour: 4500,  wastage: 0 },
};

/* Cutting a hole in a container weakens it — every opening needs a
   welded frame back in. Charged per opening, not per square metre. */
export const OPENING_REINFORCEMENT = { name: 'Cut opening & weld reinforcing frame', rate: 25000, labour: 20000, wastage: 0 };

/* ------------------------------------------------------------
   FITTINGS — furniture and partitions placed in the 3D model.
   ------------------------------------------------------------ */

export const FITTING_RATES = {
  partition: { name: 'Internal partition wall (framed & lined, both faces)', unit: 'area', rate: 18500, labour: 8500, wastage: 10 },
  desk:      { name: 'Office desk',                unit: 'each', rate: 145000, labour: 12000, wastage: 0 },
  chair:     { name: 'Office chair',               unit: 'each', rate: 78000,  labour: 0,     wastage: 0 },
  bed:       { name: 'Single bed & mattress',      unit: 'each', rate: 165000, labour: 8000,  wastage: 0 },
  bunk:      { name: 'Bunk beds & mattresses',     unit: 'each', rate: 285000, labour: 15000, wastage: 0 },
  kitchen:   { name: 'Kitchen unit & worktop',     unit: 'each', rate: 420000, labour: 65000, wastage: 0 },
  toilet:    { name: 'Toilet cubicle, WC & fittings', unit: 'each', rate: 385000, labour: 95000, wastage: 0 },
  shower:    { name: 'Shower cubicle & fittings',  unit: 'each', rate: 295000, labour: 78000, wastage: 0 },
  rack:      { name: 'Storage racking',            unit: 'each', rate: 135000, labour: 15000, wastage: 0 },
  cabinet:   { name: 'Cabinet / cupboard',         unit: 'each', rate: 118000, labour: 12000, wastage: 0 },
  table:     { name: 'Table',                      unit: 'each', rate: 125000, labour: 8000,  wastage: 0 },
};

/* ------------------------------------------------------------
   SERVICES — counted items the user sets directly, plus sensible
   auto-suggested quantities based on floor area.
   ------------------------------------------------------------ */

export const SERVICES = [
  { id: 'light',    name: 'Light point (fitting, wiring, switch)', unit: 'each', rate: 12000, labour: 6000, wastage: 0, auto: a => Math.max(1, Math.round(a / 6)) },
  { id: 'socket',   name: 'Socket outlet',                         unit: 'each', rate: 11000, labour: 5500, wastage: 0, auto: a => Math.max(2, Math.round(a / 4)) },
  { id: 'db',       name: 'Distribution board & earthing',         unit: 'each', rate: 85000, labour: 42000, wastage: 0, auto: () => 1 },
  { id: 'cabling',  name: 'Conduit, cabling & accessories',        unit: 'area', rate: 2500, labour: 1500, wastage: 10, auto: a => a },
  { id: 'ac',       name: 'Split air conditioner, 1.5 HP',         unit: 'each', rate: 520000, labour: 48000, wastage: 0, auto: a => Math.max(1, Math.round(a / 16)) },
  { id: 'fan',      name: 'Ceiling fan',                           unit: 'each', rate: 48000, labour: 12000, wastage: 0, auto: () => 0 },
  { id: 'plumbing', name: 'Plumbing rough-in & connection',        unit: 'sum',  rate: 180000, labour: 120000, wastage: 0, auto: () => 0 },
  { id: 'watertank', name: 'Water tank & pump',                    unit: 'each', rate: 210000, labour: 35000, wastage: 0, auto: () => 0 },
  { id: 'skirting', name: 'Skirting',                              unit: 'length', rate: 2800, labour: 1400, wastage: 10, auto: () => 0, autoFrom: 'perimeter' },
  { id: 'burglary', name: 'Burglary proofing to windows',          unit: 'area', rate: 28000, labour: 9000, wastage: 5, auto: () => 0 },
];

export const LOGISTICS = [
  { id: 'haulage',   name: 'Haulage & delivery',            unit: 'trip', rate: 180000, labour: 0, wastage: 0, qty: 1 },
  { id: 'offload',   name: 'Crane hire / offloading',       unit: 'each', rate: 120000, labour: 0, wastage: 0, qty: 1 },
  { id: 'install',   name: 'Site set-out & installation',   unit: 'sum',  rate: 0,      labour: 150000, wastage: 0, qty: 1 },
  { id: 'transport', name: 'Workshop transport & handling', unit: 'sum',  rate: 45000,  labour: 0, wastage: 0, qty: 1 },
];

/* ------------------------------------------------------------
   Commercial defaults applied on top of the measured work.
   ------------------------------------------------------------ */

export const COMMERCIAL_DEFAULTS = {
  overheadPct: 8,
  profitPct: 20,
  contingencyPct: 5,
  vatPct: 7.5,
  validityDays: 30,
  depositPct: 70,
};

/* ------------------------------------------------------------
   USER-DEFINED MATERIALS

   The catalogue can never be complete — every fabricator has a supplier,
   an offcut, a finish nobody else uses. Rather than pretend otherwise,
   the user's own materials are first-class: they appear in the same
   dropdowns, price through the same engine, and export with the rate
   book. They live in the browser, so nothing has to be signed up for.

   A custom material is a normal catalogue option carrying the element it
   belongs to.
   @typedef {object} CustomMaterial
   @property {string} id        unique, generated
   @property {string} element   which ELEMENTS entry it belongs to
   @property {string} name
   @property {string} unit      key of UNITS
   @property {number|null} coverage  m² per sheet, when unit is 'sheet'
   @property {number} rate
   @property {number} labour
   @property {number} wastage
   ------------------------------------------------------------ */

/** Elements a user-defined material can be filed under. */
export const CUSTOM_TARGETS = ELEMENTS.map(el => ({ id: el.id, name: el.name, driver: el.driver }));

/** Merge user materials into the catalogue so they appear as options. */
export function elementsWith(custom = []) {
  if (!custom.length) return ELEMENTS;
  return ELEMENTS.map(el => {
    const mine = custom.filter(c => c.element === el.id);
    if (!mine.length) return el;
    return {
      ...el,
      options: [
        // User materials sit above "none" but below the stock list, so a
        // familiar catalogue does not suddenly reorder itself.
        ...el.options.filter(o => o.id !== 'none'),
        ...mine.map(c => ({
          id: c.id, name: c.name, unit: c.unit, coverage: c.coverage ?? undefined,
          rate: c.rate, labour: c.labour, wastage: c.wastage, custom: true,
        })),
        ...el.options.filter(o => o.id === 'none'),
      ],
    };
  });
}

/* Build the full default rate book, keyed by a stable line id, so the
   user's edits can be stored as a flat override map. */
export function defaultRateBook(custom = []) {
  const book = {};

  for (const el of elementsWith(custom)) {
    for (const opt of el.options) {
      book[`${el.id}:${opt.id}`] = {
        name: opt.name, unit: opt.unit, coverage: opt.coverage ?? null,
        rate: opt.rate, labour: opt.labour, wastage: opt.wastage,
        group: el.name, custom: !!opt.custom,
      };
    }
  }
  for (const [key, o] of Object.entries(OPENING_RATES)) {
    book[`opening:${key}`] = { name: o.name, unit: 'each', coverage: null, rate: o.rate, labour: o.labour, wastage: o.wastage, group: 'Doors & windows' };
  }
  book['opening:reinforce'] = { ...OPENING_REINFORCEMENT, unit: 'each', coverage: null, group: 'Doors & windows' };

  for (const [key, o] of Object.entries(FITTING_RATES)) {
    book[`fitting:${key}`] = { name: o.name, unit: o.unit, coverage: null, rate: o.rate, labour: o.labour, wastage: o.wastage, group: 'Fittings & furniture' };
  }
  for (const s of SERVICES) {
    book[`service:${s.id}`] = { name: s.name, unit: s.unit, coverage: null, rate: s.rate, labour: s.labour, wastage: s.wastage, group: 'Services & installations' };
  }
  for (const l of LOGISTICS) {
    book[`logistics:${l.id}`] = { name: l.name, unit: l.unit, coverage: null, rate: l.rate, labour: l.labour, wastage: l.wastage, group: 'Logistics' };
  }
  return book;
}
