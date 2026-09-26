/* ============================================================
   TOOLBOX — Construction estimating engine

   DOM-free: imported by the Construction Estimator tool, by the
   Assistant (estimate_construction) and by node tests.

   Everything inside is metric. A project is a list of elements
   (slab, footing, blockwork, roofing …); each element turns into
   bill-of-quantities lines (quantity × rate key) and raw materials.
   `estimate()` prices the lines, groups them by element, adds
   contingency and VAT, and aggregates a shopping list.

   The rates are 2026 Lagos-area estimates in naira. They are meant
   to be edited: prices in Nigeria move month to month.
   ============================================================ */

export const RATES_DATE = '2026-09-01';

/* ---------------- physical constants ---------------- */

export const DRY_FACTOR = 1.54;          // wet concrete → dry loose materials
export const MORTAR_DRY_FACTOR = 1.33;   // wet mortar / plaster / screed → dry
export const CEMENT_DENSITY = 1440;      // kg/m³ loose
export const SAND_DENSITY = 1.6;         // t/m³ sharp sand
export const GRANITE_DENSITY = 1.5;      // t/m³ 20 mm granite
export const BAG_KG = 50;
export const STOCK_BAR_M = 12;           // rods are sold in 12 m lengths
export const LAP_D = 40;                 // lap length = 40 × bar diameter
export const WIRE_KG_PER_T = 10;         // binding wire per tonne of steel
export const WIRE_ROLL_KG = 20;
export const WC_RATIO = 0.5;             // litres of water per kg of cement
export const BLOCK_FACE = { l: 0.45, h: 0.225, joint: 0.01 };
export const BLOCKS_PER_M2 = 1 / ((BLOCK_FACE.l + BLOCK_FACE.joint) * (BLOCK_FACE.h + BLOCK_FACE.joint)); // 9.25
/* Wet mortar per m² of wall, including what drops into the hollow cores
   (calibrated to the site rule of roughly 1 bag laying 50–60 blocks). */
export const MORTAR_M3_PER_M2 = { 6: 0.022, 9: 0.03 };
export const TIMBER_PIECE_M = 3.66;      // 12 ft lengths
export const DPM_ROLL_M2 = 200;          // 4 m × 50 m
export const PAINT_BUCKET_L = 20;
export const PURLIN_SPACING = 0.9;

export const BAR_SIZES = [8, 10, 12, 16, 20, 25];
/** Mass of a round bar, kg per metre: d² / 162. */
export const barKgPerM = (d) => (Number(d) ** 2) / 162;
/** Length of one run of bar including laps where it exceeds a 12 m stock length. */
export function barRun(len, d) {
  if (!(len > 0)) return 0;
  const pieces = Math.ceil(len / STOCK_BAR_M - 1e-9);
  return len + Math.max(0, pieces - 1) * LAP_D * d / 1000;
}

/* ---------------- mixes ---------------- */

export const MIXES = {
  '1:3:6':   { parts: [1, 3, 6],     grade: 'C10', label: '1:3:6 (C10)', use: 'Blinding and mass fill' },
  '1:2:4':   { parts: [1, 2, 4],     grade: 'C15', label: '1:2:4 (C15)', use: 'Ground slabs, light structural' },
  '1:1.5:3': { parts: [1, 1.5, 3],   grade: 'C20', label: '1:1.5:3 (C20)', use: 'Slabs, beams, columns' },
  '1:1:2':   { parts: [1, 1, 2],     grade: 'C25', label: '1:1:2 (C25)', use: 'Heavier structural work' },
  '1:1:1.5': { parts: [1, 1, 1.5],   grade: 'C30', label: '1:1:1.5 (≈C30)', use: 'Approximate; order a designed mix' },
};
export const GRADES = { C10: '1:3:6', C15: '1:2:4', C20: '1:1.5:3', C25: '1:1:2', C30: '1:1:1.5' };
export const MORTARS = { '1:3': [1, 3], '1:4': [1, 4], '1:6': [1, 6] };

/** Dry materials for a wet volume of concrete. Waste is a fraction (0.05 = 5%). */
export function concreteMaterials(wet, mixKey = '1:2:4', waste = 0) {
  const mix = MIXES[mixKey] || MIXES[GRADES[mixKey]] || MIXES['1:2:4'];
  const [c, s, g] = mix.parts;
  const sum = c + s + g;
  const dry = Math.max(0, wet) * DRY_FACTOR * (1 + waste);
  const cementKg = dry * c / sum * CEMENT_DENSITY;
  return {
    dry, cementKg, bags: cementKg / BAG_KG,
    sandM3: dry * s / sum, sandT: dry * s / sum * SAND_DENSITY,
    graniteM3: dry * g / sum, graniteT: dry * g / sum * GRANITE_DENSITY,
    waterL: cementKg * WC_RATIO,
  };
}

/** Dry materials for a wet volume of cement–sand mortar, plaster or screed. */
export function mortarMaterials(wet, mixKey = '1:6', waste = 0) {
  const [c, s] = MORTARS[mixKey] || MORTARS['1:6'];
  const dry = Math.max(0, wet) * MORTAR_DRY_FACTOR * (1 + waste);
  const cementKg = dry * c / (c + s) * CEMENT_DENSITY;
  return { dry, cementKg, bags: cementKg / BAG_KG, sandM3: dry * s / (c + s), sandT: dry * s / (c + s) * SAND_DENSITY, waterL: cementKg * 0.6 };
}

/* ---------------- rates (NGN) ---------------- */

const R = (key, label, unit, rate, group, note = '') => ({ key, label, unit, rate, group, note });
export const RATE_GROUPS = [
  { id: 'concrete', label: 'Concrete and steel' },
  { id: 'masonry', label: 'Blockwork and fill' },
  { id: 'finishes', label: 'Finishes' },
  { id: 'roof', label: 'Roofing, doors and windows' },
  { id: 'labour', label: 'Labour' },
];
export const DEFAULT_RATES = [
  R('cement', 'Cement, 50 kg bag', 'bag', 10500, 'concrete', 'Dangote / BUA / Lafarge 42.5R'),
  R('sand', 'Sharp sand', 't', 14000, 'concrete', 'About ₦280,000 for a 20-tonne trip'),
  R('granite', 'Granite, ¾ inch (20 mm)', 't', 27000, 'concrete', 'About ₦810,000 for a 30-tonne trip'),
  R('rebar', 'Reinforcement, high-yield', 't', 1250000, 'concrete', 'Y12 × 12 m ≈ ₦13,300'),
  R('wire', 'Binding wire', 'kg', 1800, 'concrete', '20 kg roll ≈ ₦36,000'),
  R('formwork', 'Formwork materials (plywood, planks, props)', 'm²', 4500, 'concrete', 'Allows for reuse'),
  R('block6', '6 inch sandcrete block (150 mm)', 'nr', 650, 'masonry'),
  R('block9', '9 inch sandcrete block (225 mm)', 'nr', 800, 'masonry'),
  R('hardcore', 'Hardcore / laterite fill', 'm³', 9000, 'masonry'),
  R('dpm', 'DPM, 1000-gauge polythene', 'm²', 400, 'masonry', '4 × 50 m roll ≈ ₦80,000'),
  R('disposal', 'Cart away surplus soil', 'm³', 4000, 'masonry'),
  R('tile_floor', 'Floor tiles', 'm²', 11000, 'finishes', 'Mid-range 60 × 60 ceramic'),
  R('tile_wall', 'Wall tiles', 'm²', 9500, 'finishes'),
  R('grout', 'Tile grout', 'kg', 1200, 'finishes'),
  R('paint_emulsion', 'Emulsion paint, 20 L', 'bucket', 55000, 'finishes'),
  R('paint_satin', 'Satin / silk paint, 20 L', 'bucket', 78000, 'finishes'),
  R('paint_textured', 'Textured coat, 20 L', 'bucket', 60000, 'finishes'),
  R('ceiling', 'PVC ceiling with noggins', 'm²', 7500, 'finishes'),
  R('roof_045', 'Long-span aluminium, 0.45 mm', 'm²', 6500, 'roof'),
  R('roof_055', 'Long-span aluminium, 0.55 mm', 'm²', 8000, 'roof'),
  R('roof_070', 'Long-span aluminium, 0.70 mm', 'm²', 10500, 'roof'),
  R('timber_2x4', 'Timber 2 × 4 in, 12 ft', 'nr', 5500, 'roof', 'Hardwood, treated'),
  R('timber_2x3', 'Timber 2 × 3 in, 12 ft', 'nr', 4000, 'roof'),
  R('nails', 'Nails, assorted', 'kg', 2000, 'roof'),
  R('fascia', 'Fascia / barge board', 'm', 4500, 'roof'),
  R('door_int', 'Internal flush door with frame', 'nr', 95000, 'roof'),
  R('door_ext', 'Steel security door', 'nr', 280000, 'roof'),
  R('window', 'Aluminium casement window', 'm²', 70000, 'roof'),
  R('burglar', 'Burglary-proof bars', 'm²', 30000, 'roof'),
  R('lab_excavation', 'Excavate by hand', 'm³', 4500, 'labour'),
  R('lab_backfill', 'Backfill and ram', 'm³', 2500, 'labour'),
  R('lab_concrete', 'Mix, place and vibrate concrete', 'm³', 22000, 'labour'),
  R('lab_rebar', 'Cut, bend and fix reinforcement', 't', 180000, 'labour'),
  R('lab_formwork', 'Erect and strike formwork', 'm²', 2500, 'labour'),
  R('lab_blockwork', 'Lay blocks', 'm²', 2200, 'labour'),
  R('lab_plaster', 'Plaster / render', 'm²', 1800, 'labour'),
  R('lab_screed', 'Floor screed', 'm²', 1500, 'labour'),
  R('lab_tiling', 'Lay tiles', 'm²', 3000, 'labour'),
  R('lab_painting', 'Painting, all coats', 'm²', 900, 'labour'),
  R('lab_roofing', 'Roof carpentry and sheeting', 'm²', 3000, 'labour'),
  R('lab_hardcore', 'Spread and compact fill', 'm³', 3000, 'labour'),
  R('lab_ceiling', 'Fix ceiling', 'm²', 1500, 'labour'),
];
export const RATE_BY_KEY = Object.fromEntries(DEFAULT_RATES.map(r => [r.key, r]));
/* Truck sizes turn tonnes into trips. They sit with the rates because they vary by supplier. */
export const DEFAULT_TRIPS = { sand: 20, granite: 30 };

export const REGIONS = {
  lagos: { label: 'Lagos', factor: 1 },
  abuja: { label: 'Abuja (FCT)', factor: 1.05 },
  ph: { label: 'Port Harcourt', factor: 1.08 },
  southwest: { label: 'Ibadan, Abeokuta, South-West', factor: 0.92 },
  southeast: { label: 'Enugu, Onitsha, South-East', factor: 0.95 },
  north: { label: 'Kano, Kaduna, North', factor: 0.9 },
};

/** Effective rates: defaults × region factor, then any saved overrides (absolute naira). */
export function resolveRates(overrides = {}, region = 'lagos') {
  const f = REGIONS[region]?.factor ?? 1;
  const out = {};
  for (const r of DEFAULT_RATES) {
    const o = Number(overrides?.[r.key]);
    out[r.key] = Number.isFinite(o) && o >= 0 && overrides?.[r.key] !== '' && overrides?.[r.key] != null ? o : Math.round(r.rate * f);
  }
  return out;
}

/* ---------------- element catalogue ---------------- */

/* Field kinds: m (metres), mm, m2, num (count), deg, pct, select, bool, text, money.
   Every length is metric; the UI converts for feet. */
const F = (key, label, kind, def, extra = {}) => ({ key, label, kind, default: def, ...extra });
const MIX_OPTS = [{ value: 'default', label: 'Project default' }, ...Object.entries(MIXES).map(([v, m]) => ({ value: v, label: m.label }))];
const BAR_OPTS = BAR_SIZES.map(d => ({ value: String(d), label: `Y${d}` }));
const MORTAR_OPTS = Object.keys(MORTARS).map(v => ({ value: v, label: v }));
const barF = (key, label, def) => F(key, label, 'select', String(def), { options: BAR_OPTS });
const spacingF = (key, label, def) => F(key, label, 'mm', def, { min: 75, max: 600, step: 25 });

export const ELEMENT_GROUPS = [
  { id: 'substructure', label: 'Substructure' },
  { id: 'frame', label: 'Concrete frame' },
  { id: 'walls', label: 'Walls' },
  { id: 'finishes', label: 'Finishes' },
  { id: 'roof', label: 'Roof and openings' },
  { id: 'other', label: 'Other' },
];

export const ELEMENT_TYPES = {
  excavation: { label: 'Excavation and backfill', group: 'substructure', fields: [
    F('length', 'Length', 'm', 10, { min: 0.1, max: 1000 }), F('width', 'Width', 'm', 1, { min: 0.1, max: 200 }),
    F('depth', 'Depth', 'm', 1, { min: 0.1, max: 10 }), F('backfillPct', 'Backfilled', 'pct', 30, { min: 0, max: 100 }),
    F('disposal', 'Cart away the rest', 'bool', true) ] },
  strip_footing: { label: 'Strip footing', group: 'substructure', fields: [
    F('length', 'Total run', 'm', 60, { min: 0.5, max: 2000 }), F('width', 'Width', 'mm', 675, { min: 225, max: 3000 }),
    F('thickness', 'Thickness', 'mm', 225, { min: 100, max: 1500 }), F('excDepth', 'Trench depth', 'mm', 900, { min: 0, max: 5000, step: 50 }),
    F('blinding', 'Blinding', 'mm', 50, { min: 0, max: 150 }), F('mix', 'Concrete', 'select', 'default', { options: MIX_OPTS }),
    F('mainBars', 'Main bars', 'num', 3, { min: 0, max: 12 }), barF('mainSize', 'Main size', 12),
    barF('distSize', 'Distribution size', 10), spacingF('distSpacing', 'Distribution spacing', 300) ] },
  pad_footing: { label: 'Pad footing', group: 'substructure', fields: [
    F('count', 'Number of pads', 'num', 8, { min: 1, max: 500 }), F('length', 'Length', 'm', 1.2, { min: 0.3, max: 10 }),
    F('width', 'Width', 'm', 1.2, { min: 0.3, max: 10 }), F('thickness', 'Thickness', 'mm', 300, { min: 150, max: 2000 }),
    F('excDepth', 'Pit depth', 'mm', 1200, { min: 0, max: 5000, step: 50 }), F('blinding', 'Blinding', 'mm', 50, { min: 0, max: 150 }),
    F('mix', 'Concrete', 'select', 'default', { options: MIX_OPTS }), barF('barSize', 'Bar size', 12), spacingF('spacing', 'Spacing each way', 150) ] },
  hardcore: { label: 'Hardcore filling', group: 'substructure', fields: [
    F('length', 'Length', 'm', 12, { min: 0.1, max: 500 }), F('width', 'Width', 'm', 10, { min: 0.1, max: 500 }),
    F('thickness', 'Compacted thickness', 'mm', 150, { min: 50, max: 1500 }) ] },
  dpm: { label: 'Damp-proof membrane', group: 'substructure', fields: [
    F('length', 'Length', 'm', 12, { min: 0.1, max: 500 }), F('width', 'Width', 'm', 10, { min: 0.1, max: 500 }),
    F('lapPct', 'Laps and turn-ups', 'pct', 15, { min: 0, max: 50 }) ] },
  slab_ground: { label: 'Ground floor slab', group: 'substructure', floor: true, fields: [
    F('length', 'Length', 'm', 12, { min: 0.5, max: 500 }), F('width', 'Width', 'm', 10, { min: 0.5, max: 500 }),
    F('thickness', 'Thickness', 'mm', 150, { min: 75, max: 500 }), F('mix', 'Concrete', 'select', '1:2:4', { options: MIX_OPTS }),
    F('layers', 'Mesh layers', 'num', 1, { min: 0, max: 2 }), barF('barSize', 'Bar size', 10), spacingF('spacing', 'Spacing', 250) ] },
  slab_suspended: { label: 'Suspended slab', group: 'frame', floor: true, fields: [
    F('length', 'Length', 'm', 12, { min: 0.5, max: 500 }), F('width', 'Width', 'm', 10, { min: 0.5, max: 500 }),
    F('thickness', 'Thickness', 'mm', 150, { min: 100, max: 400 }), F('mix', 'Concrete', 'select', 'default', { options: MIX_OPTS }),
    F('layers', 'Mesh layers', 'num', 2, { min: 1, max: 2 }), barF('barSize', 'Bar size', 12), spacingF('spacing', 'Spacing', 200),
    F('formwork', 'Soffit formwork', 'bool', true) ] },
  column: { label: 'Columns', group: 'frame', fields: [
    F('count', 'Number', 'num', 12, { min: 1, max: 500 }), F('b', 'Width', 'mm', 225, { min: 150, max: 1200 }),
    F('h', 'Depth', 'mm', 225, { min: 150, max: 1200 }), F('height', 'Height', 'm', 3, { min: 0.3, max: 20 }),
    F('mix', 'Concrete', 'select', 'default', { options: MIX_OPTS }), F('mainBars', 'Main bars', 'num', 4, { min: 4, max: 20 }),
    barF('mainSize', 'Main size', 12), barF('linkSize', 'Link size', 8), spacingF('linkSpacing', 'Link spacing', 200) ] },
  beam: { label: 'Beams', group: 'frame', fields: [
    F('count', 'Number', 'num', 1, { min: 1, max: 500 }), F('length', 'Length each', 'm', 40, { min: 0.5, max: 500 }),
    F('b', 'Width', 'mm', 225, { min: 150, max: 1000 }), F('h', 'Overall depth', 'mm', 450, { min: 150, max: 1500 }),
    F('mix', 'Concrete', 'select', 'default', { options: MIX_OPTS }), F('bottomBars', 'Bottom bars', 'num', 3, { min: 2, max: 12 }),
    barF('bottomSize', 'Bottom size', 16), F('topBars', 'Top bars', 'num', 2, { min: 0, max: 12 }), barF('topSize', 'Top size', 12),
    barF('linkSize', 'Link size', 8), spacingF('linkSpacing', 'Link spacing', 200) ] },
  lintel: { label: 'Lintels', group: 'frame', fields: [
    F('count', 'Openings', 'num', 10, { min: 1, max: 500 }), F('opening', 'Opening width', 'm', 1.2, { min: 0.3, max: 6 }),
    F('bearing', 'Bearing each end', 'mm', 150, { min: 100, max: 600 }), F('b', 'Width', 'mm', 225, { min: 100, max: 450 }),
    F('h', 'Depth', 'mm', 225, { min: 100, max: 600 }), F('mix', 'Concrete', 'select', 'default', { options: MIX_OPTS }),
    F('mainBars', 'Main bars', 'num', 4, { min: 2, max: 8 }), barF('mainSize', 'Main size', 12), barF('linkSize', 'Link size', 8),
    spacingF('linkSpacing', 'Link spacing', 200) ] },
  stairs: { label: 'Staircase', group: 'frame', fields: [
    F('width', 'Stair width', 'm', 1.2, { min: 0.6, max: 5 }), F('risers', 'Risers', 'num', 18, { min: 2, max: 40 }),
    F('riser', 'Riser height', 'mm', 170, { min: 120, max: 220 }), F('going', 'Going', 'mm', 250, { min: 200, max: 400 }),
    F('waist', 'Waist', 'mm', 150, { min: 100, max: 300 }), F('landing', 'Landing length', 'm', 1.2, { min: 0, max: 6 }),
    F('mix', 'Concrete', 'select', 'default', { options: MIX_OPTS }), barF('mainSize', 'Main bars', 12), spacingF('mainSpacing', 'Main spacing', 150),
    barF('distSize', 'Distribution bars', 10), spacingF('distSpacing', 'Distribution spacing', 250) ] },
  blockwork: { label: 'Blockwork', group: 'walls', fields: [
    F('length', 'Wall length', 'm', 60, { min: 0.1, max: 5000 }), F('height', 'Height', 'm', 3, { min: 0.2, max: 20 }),
    F('openings', 'Less openings', 'm2', 20, { min: 0, max: 5000 }),
    F('block', 'Block', 'select', '9', { options: [{ value: '9', label: '9 inch (225 mm)' }, { value: '6', label: '6 inch (150 mm)' }] }),
    F('mortar', 'Mortar', 'select', '1:6', { options: MORTAR_OPTS }) ] },
  plaster: { label: 'Plastering and rendering', group: 'finishes', fields: [
    F('length', 'Wall length', 'm', 60, { min: 0.1, max: 5000 }), F('height', 'Height', 'm', 3, { min: 0.2, max: 20 }),
    F('faces', 'Faces', 'num', 2, { min: 1, max: 2 }), F('openings', 'Less openings', 'm2', 20, { min: 0, max: 5000 }),
    F('thickness', 'Thickness', 'mm', 12, { min: 6, max: 30 }), F('mix', 'Mix', 'select', '1:4', { options: MORTAR_OPTS }) ] },
  screed: { label: 'Floor screed', group: 'finishes', fields: [
    F('length', 'Length', 'm', 12, { min: 0.1, max: 500 }), F('width', 'Width', 'm', 10, { min: 0.1, max: 500 }),
    F('thickness', 'Thickness', 'mm', 40, { min: 15, max: 100 }), F('mix', 'Mix', 'select', '1:4', { options: MORTAR_OPTS }) ] },
  tiling: { label: 'Tiling', group: 'finishes', fields: [
    F('surface', 'Surface', 'select', 'floor', { options: [{ value: 'floor', label: 'Floor' }, { value: 'wall', label: 'Wall' }] }),
    F('length', 'Length', 'm', 12, { min: 0.1, max: 500 }), F('width', 'Width or height', 'm', 10, { min: 0.1, max: 500 }),
    F('size', 'Tile size', 'select', '600x600', { options: ['600x600', '400x400', '300x600', '300x300', '250x400'].map(v => ({ value: v, label: v.replace('x', ' × ') + ' mm' })) }),
    F('tileWaste', 'Cutting waste', 'pct', 10, { min: 0, max: 30 }) ] },
  painting: { label: 'Painting', group: 'finishes', fields: [
    F('area', 'Area', 'm2', 400, { min: 1, max: 20000 }), F('coats', 'Coats', 'num', 2, { min: 1, max: 4 }),
    F('paint', 'Paint', 'select', 'emulsion', { options: [{ value: 'emulsion', label: 'Emulsion' }, { value: 'satin', label: 'Satin / silk' }, { value: 'textured', label: 'Textured coat' }] }) ] },
  ceiling: { label: 'Ceiling', group: 'finishes', fields: [
    F('area', 'Area', 'm2', 120, { min: 1, max: 20000 }) ] },
  roofing: { label: 'Roofing', group: 'roof', fields: [
    F('length', 'Building length', 'm', 13, { min: 2, max: 200 }), F('span', 'Span (width)', 'm', 11, { min: 2, max: 40 }),
    F('pitch', 'Pitch', 'deg', 25, { min: 5, max: 45 }), F('overhang', 'Overhang', 'm', 0.6, { min: 0, max: 1.5 }),
    F('spacing', 'Truss spacing', 'm', 1.2, { min: 0.6, max: 2.4 }),
    F('form', 'Roof form', 'select', 'gable', { options: [{ value: 'gable', label: 'Gable' }, { value: 'hip', label: 'Hip' }] }),
    F('gauge', 'Sheet gauge', 'select', '055', { options: [{ value: '045', label: '0.45 mm' }, { value: '055', label: '0.55 mm' }, { value: '070', label: '0.70 mm' }] }),
    F('fascia', 'Fascia boards', 'bool', true) ] },
  openings: { label: 'Doors and windows', group: 'roof', fields: [
    F('doorsExt', 'Security doors', 'num', 2, { min: 0, max: 200 }), F('doorsInt', 'Internal doors', 'num', 6, { min: 0, max: 500 }),
    F('windows', 'Windows', 'num', 10, { min: 0, max: 500 }), F('winW', 'Window width', 'm', 1.2, { min: 0.3, max: 6 }),
    F('winH', 'Window height', 'm', 1.2, { min: 0.3, max: 4 }), F('burglar', 'Burglary-proof bars', 'bool', true) ] },
  formwork: { label: 'Formwork', group: 'other', fields: [F('area', 'Contact area', 'm2', 20, { min: 0.1, max: 20000 })] },
  custom: { label: 'Custom item', group: 'other', fields: [
    F('desc', 'Description', 'text', 'Site preliminaries'), F('qty', 'Quantity', 'num', 1, { min: 0, max: 1e7, step: 'any' }),
    F('unit', 'Unit', 'text', 'item'), F('rate', 'Rate', 'money', 250000, { min: 0, max: 1e11 }) ] },
};

const TILE_SIZES = { '600x600': 1.44, '400x400': 1.6, '300x600': 1.44, '300x300': 1.0, '250x400': 1.5 }; // m² per carton
const PAINT_COVER = { emulsion: 8, satin: 9, textured: 3 }; // m² per litre per coat

let uid = 0;
export function newElement(type, overrides = {}) {
  const def = ELEMENT_TYPES[type];
  if (!def) throw new Error(`Unknown element type "${type}"`);
  const el = { id: `e${Date.now().toString(36)}${(uid++).toString(36)}`, type, name: def.label };
  for (const f of def.fields) el[f.key] = f.default;
  for (const [k, v] of Object.entries(overrides || {})) if (v !== undefined && v !== null) el[k] = v;
  return el;
}

/** Field errors for an element: { key: message }. */
export function validateElement(el) {
  const def = ELEMENT_TYPES[el?.type];
  const errors = {};
  if (!def) return { type: 'Unknown element' };
  for (const f of def.fields) {
    if (['select', 'bool', 'text'].includes(f.kind)) continue;
    const v = Number(el[f.key]);
    if (el[f.key] === '' || el[f.key] == null || !Number.isFinite(v)) { errors[f.key] = 'Enter a number'; continue; }
    if (f.min != null && v < f.min) errors[f.key] = `At least ${f.min}`;
    else if (f.max != null && v > f.max) errors[f.key] = `At most ${f.max}`;
  }
  return errors;
}

/* ---------------- element maths ---------------- */

const n = (v, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
const mm = (v) => n(v) / 1000;

function makeCtx(el, opts) {
  const lines = [];
  const mats = {};
  const waste = opts.waste;
  const mixOf = (m) => (m && m !== 'default' && MIXES[m] ? m : opts.mix);
  const mat = (k, q) => { if (q > 0) mats[k] = (mats[k] || 0) + q; };
  const line = (desc, qty, unit, rate, extra = {}) => { if (qty > 0) lines.push({ desc, qty, unit, rate, ...extra }); };
  const concrete = (vol, mixKey, label = 'concrete') => {
    const key = mixOf(mixKey);
    const m = concreteMaterials(vol, key, waste);
    const bags = Math.ceil(m.bags - 1e-9);
    line(`Cement for ${key} ${label}`, bags, 'bag', 'cement');
    line('Sharp sand', m.sandT, 't', 'sand');
    line('Granite, 20 mm', m.graniteT, 't', 'granite');
    line(`Mix and place ${label}`, vol, 'm³', 'lab_concrete');
    mat('cement', bags); mat('sand', m.sandT); mat('granite', m.graniteT); mat('water', m.waterL);
    return { vol, ...m, bags };
  };
  const mortar = (wet, mixKey, what) => {
    const m = mortarMaterials(wet, mixKey, waste);
    const bags = Math.ceil(m.bags - 1e-9);
    line(`Cement for ${mixKey} ${what}`, bags, 'bag', 'cement');
    line('Sharp sand', m.sandT, 't', 'sand');
    mat('cement', bags); mat('sand', m.sandT); mat('water', m.waterL);
    return { ...m, bags };
  };
  /* bars: list of { d, m } (metres of bar, laps included) */
  const steel = (bars) => {
    let kg = 0;
    const byD = {};
    for (const b of bars) if (b.m > 0) { byD[b.d] = (byD[b.d] || 0) + b.m; }
    for (const [d, m] of Object.entries(byD)) {
      const mw = m * (1 + waste);
      const k = mw * barKgPerM(d);
      kg += k;
      line(`Reinforcement Y${d}`, k / 1000, 't', 'rebar', { note: `${fmt(mw, 0)} m, ${fmt(k, 0)} kg` });
      mat(`rebar${d}`, mw);
    }
    const netKg = Object.entries(byD).reduce((s, [d, m]) => s + m * barKgPerM(d), 0);
    if (kg > 0) {
      const wire = kg / 1000 * WIRE_KG_PER_T;
      line('Binding wire', wire, 'kg', 'wire');
      line('Cut, bend and fix reinforcement', netKg / 1000, 't', 'lab_rebar');
      mat('wire', wire);
    }
    return { kg, netKg, byD };
  };
  const formwork = (area) => {
    line('Formwork', area, 'm²', 'formwork');
    line('Erect and strike formwork', area, 'm²', 'lab_formwork');
    mat('formwork', area);
  };
  const excavate = (vol, backfill) => {
    line('Excavate', vol, 'm³', 'lab_excavation');
    if (backfill > 0) line('Backfill and ram', backfill, 'm³', 'lab_backfill');
  };
  return { lines, mats, waste, mixOf, mat, line, concrete, mortar, steel, formwork, excavate };
}

const fmt = (v, dp = 0) => Number(v).toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: dp });

/** Mesh of bars at `spacing` each way across an L × W panel, `layers` deep. */
export function meshBars(L, W, d, spacing, layers = 1, cover = 0.025) {
  if (!(layers > 0) || !(spacing > 0)) return [];
  const along = Math.floor((W - 2 * cover) / spacing + 1e-9) + 1;   // bars running along L
  const across = Math.floor((L - 2 * cover) / spacing + 1e-9) + 1;  // bars running across W
  const m = (along * barRun(L - 2 * cover, d) + across * barRun(W - 2 * cover, d)) * layers;
  return [{ d: Number(d), m, along, across }];
}

/** Closed rectangular link length for a b × h section (mm), 25 mm cover, two 10d hooks. */
export function linkLength(b, h, d, cover = 25) {
  return (2 * ((b - 2 * cover) + (h - 2 * cover)) + 20 * d) / 1000;
}

export function computeElement(el, opts = {}) {
  const o = { waste: opts.waste ?? 0.05, mix: opts.mix || GRADES[opts.grade] || '1:1.5:3' };
  const c = makeCtx(el, o);
  const type = el.type;
  let floorArea = 0;
  const info = {};

  switch (type) {
    case 'excavation': {
      const vol = n(el.length) * n(el.width) * n(el.depth);
      const back = vol * n(el.backfillPct) / 100;
      c.excavate(vol, back);
      if (el.disposal) c.line('Cart away surplus', (vol - back) * 1.25, 'm³', 'disposal', { note: '25% bulking' });
      Object.assign(info, { volume: vol, backfill: back });
      break;
    }
    case 'strip_footing': {
      const L = n(el.length), W = mm(el.width), T = mm(el.thickness), B = mm(el.blinding), D = mm(el.excDepth);
      const vol = L * W * T;
      if (D > 0) {
        const exc = L * W * D;
        const wall = L * 0.225 * Math.max(0, D - T - B);
        c.excavate(exc, Math.max(0, exc - vol - L * W * B - wall));
        info.excavation = exc;
      }
      if (B > 0) c.concrete(L * W * B, '1:3:6', 'blinding');
      const conc = c.concrete(vol, el.mix, 'footing concrete');
      const cover = 0.05;
      const dist = Math.floor(L / mm(el.distSpacing) + 1e-9) + 1;
      c.steel([{ d: n(el.mainSize), m: n(el.mainBars) * barRun(L, n(el.mainSize)) },
        { d: n(el.distSize), m: el.mainBars > 0 ? dist * (W - 2 * cover) : 0 }]);
      Object.assign(info, { volume: vol, cementBags: conc.bags });
      break;
    }
    case 'pad_footing': {
      const N = n(el.count), L = n(el.length), W = n(el.width), T = mm(el.thickness), B = mm(el.blinding), D = mm(el.excDepth);
      const vol = N * L * W * T;
      if (D > 0) {
        const exc = N * (L + 0.3) * (W + 0.3) * D;    // 150 mm working space all round
        const column = N * 0.225 * 0.225 * Math.max(0, D - T - B);
        c.excavate(exc, Math.max(0, exc - vol - N * L * W * B - column));
      }
      if (B > 0) c.concrete(N * L * W * B, '1:3:6', 'blinding');
      c.concrete(vol, el.mix, 'pad concrete');
      const mesh = meshBars(L, W, n(el.barSize), mm(el.spacing), 1, 0.05);
      c.steel(mesh.map(b => ({ ...b, m: b.m * N })));
      info.volume = vol;
      break;
    }
    case 'hardcore': {
      const net = n(el.length) * n(el.width) * mm(el.thickness);
      const loose = net * 1.25 * (1 + o.waste);
      c.line('Hardcore / laterite, loose', loose, 'm³', 'hardcore', { note: '25% compaction allowance' });
      c.line('Spread and compact', net, 'm³', 'lab_hardcore');
      c.mat('hardcore', loose);
      info.volume = net;
      break;
    }
    case 'dpm': {
      const a = n(el.length) * n(el.width) * (1 + n(el.lapPct) / 100);
      c.line('DPM, 1000-gauge polythene', a, 'm²', 'dpm');
      c.mat('dpm', a);
      info.area = n(el.length) * n(el.width);
      break;
    }
    case 'slab_ground':
    case 'slab_suspended': {
      const L = n(el.length), W = n(el.width), T = mm(el.thickness);
      const vol = L * W * T;
      c.concrete(vol, el.mix, 'slab concrete');
      const layers = type === 'slab_suspended' ? Math.max(1, n(el.layers, 2)) : n(el.layers);
      c.steel(meshBars(L, W, n(el.barSize), mm(el.spacing), layers));
      if (type === 'slab_suspended' && el.formwork) c.formwork(L * W + 2 * (L + W) * T);
      if (type === 'slab_ground') c.formwork(2 * (L + W) * T);
      floorArea = L * W;
      info.volume = vol;
      break;
    }
    case 'column': {
      const N = n(el.count), b = n(el.b), h = n(el.h), H = n(el.height);
      const vol = N * (b / 1000) * (h / 1000) * H;
      c.concrete(vol, el.mix, 'column concrete');
      const main = N * n(el.mainBars) * barRun(H + LAP_D * n(el.mainSize) / 1000, n(el.mainSize));
      const links = N * (Math.floor(H / mm(el.linkSpacing) + 1e-9) + 1) * linkLength(b, h, n(el.linkSize));
      c.steel([{ d: n(el.mainSize), m: main }, { d: n(el.linkSize), m: links }]);
      c.formwork(N * 2 * (b + h) / 1000 * H);
      info.volume = vol;
      break;
    }
    case 'beam': {
      const N = n(el.count), L = n(el.length), b = n(el.b), h = n(el.h);
      const vol = N * L * (b / 1000) * (h / 1000);
      c.concrete(vol, el.mix, 'beam concrete');
      const run = (d) => barRun(L, d);
      const links = N * (Math.floor(L / mm(el.linkSpacing) + 1e-9) + 1) * linkLength(b, h, n(el.linkSize));
      c.steel([{ d: n(el.bottomSize), m: N * n(el.bottomBars) * run(n(el.bottomSize)) },
        { d: n(el.topSize), m: N * n(el.topBars) * run(n(el.topSize)) },
        { d: n(el.linkSize), m: links }]);
      c.formwork(N * L * (2 * h + b) / 1000);
      info.volume = vol;
      break;
    }
    case 'lintel': {
      const N = n(el.count), L = n(el.opening) + 2 * mm(el.bearing), b = n(el.b), h = n(el.h);
      const vol = N * L * (b / 1000) * (h / 1000);
      c.concrete(vol, el.mix, 'lintel concrete');
      const links = N * (Math.floor(L / mm(el.linkSpacing) + 1e-9) + 1) * linkLength(b, h, n(el.linkSize));
      c.steel([{ d: n(el.mainSize), m: N * n(el.mainBars) * L }, { d: n(el.linkSize), m: links }]);
      c.formwork(N * L * (2 * h + b) / 1000);
      info.volume = vol;
      break;
    }
    case 'stairs': {
      const W = n(el.width), Nr = n(el.risers), Rr = mm(el.riser), G = mm(el.going), t = mm(el.waist), Ld = n(el.landing);
      const incline = Nr * Math.hypot(Rr, G);
      const vol = W * (incline * t + Nr * Rr * G / 2 + Ld * t);
      c.concrete(vol, el.mix, 'stair concrete');
      const runL = incline + Ld + 0.6;                         // plus 300 mm anchorage each end
      const mainCount = Math.floor(W / mm(el.mainSpacing) + 1e-9) + 1;
      const distCount = Math.floor((incline + Ld) / mm(el.distSpacing) + 1e-9) + 1;
      c.steel([{ d: n(el.mainSize), m: mainCount * barRun(runL, n(el.mainSize)) }, { d: n(el.distSize), m: distCount * W }]);
      c.formwork((incline + Ld) * W + Nr * Rr * W + 2 * incline * (t + Rr / 2));
      Object.assign(info, { volume: vol, incline });
      break;
    }
    case 'blockwork': {
      const area = Math.max(0, n(el.length) * n(el.height) - n(el.openings));
      const size = el.block === '6' ? 6 : 9;
      const blocks = Math.ceil(area * BLOCKS_PER_M2 * (1 + o.waste) - 1e-9);
      c.line(`${size} inch sandcrete blocks`, blocks, 'nr', `block${size}`, { note: `${fmt(area, 1)} m² at ${fmt(BLOCKS_PER_M2, 2)}/m²` });
      c.mat(`block${size}`, blocks);
      c.mortar(area * MORTAR_M3_PER_M2[size], el.mortar || '1:6', 'mortar');
      c.line('Lay blocks', area, 'm²', 'lab_blockwork');
      Object.assign(info, { area, blocks });
      break;
    }
    case 'plaster': {
      const area = Math.max(0, n(el.length) * n(el.height) * n(el.faces, 1) - n(el.openings) * n(el.faces, 1));
      c.mortar(area * mm(el.thickness), el.mix || '1:4', 'plaster');
      c.line('Plaster / render', area, 'm²', 'lab_plaster');
      info.area = area;
      break;
    }
    case 'screed': {
      const area = n(el.length) * n(el.width);
      c.mortar(area * mm(el.thickness), el.mix || '1:4', 'screed');
      c.line('Lay screed', area, 'm²', 'lab_screed');
      info.area = area;
      break;
    }
    case 'tiling': {
      const area = n(el.length) * n(el.width);
      const floor = el.surface !== 'wall';
      const buy = area * (1 + n(el.tileWaste) / 100);
      const size = TILE_SIZES[el.size] ? el.size : '600x600';
      c.line(`${floor ? 'Floor' : 'Wall'} tiles ${size.replace('x', ' × ')} mm`, buy, 'm²', floor ? 'tile_floor' : 'tile_wall',
        { note: `${Math.ceil(buy / TILE_SIZES[size] - 1e-9)} cartons` });
      c.mat(`tile_${floor ? 'floor' : 'wall'}_${size}`, buy);
      c.mortar(area * (floor ? 0.02 : 0.01), '1:3', 'bedding');
      c.line('Tile grout', area * 0.3, 'kg', 'grout');
      c.mat('grout', area * 0.3);
      c.line('Lay tiles', area, 'm²', 'lab_tiling');
      info.area = area;
      break;
    }
    case 'painting': {
      const kind = PAINT_COVER[el.paint] ? el.paint : 'emulsion';
      const litres = n(el.area) * n(el.coats, 1) / PAINT_COVER[kind] * (1 + o.waste);
      const buckets = Math.ceil(litres / PAINT_BUCKET_L - 1e-9);
      c.line(`${kind[0].toUpperCase()}${kind.slice(1)} paint, 20 L`, buckets, 'bucket', `paint_${kind}`, { note: `${fmt(litres, 0)} L for ${n(el.coats)} coats` });
      c.mat(`paint_${kind}`, buckets);
      c.line('Painting, all coats', n(el.area), 'm²', 'lab_painting');
      info.litres = litres;
      break;
    }
    case 'ceiling': {
      c.line('PVC ceiling with noggins', n(el.area) * (1 + o.waste), 'm²', 'ceiling');
      c.mat('ceiling', n(el.area) * (1 + o.waste));
      c.line('Fix ceiling', n(el.area), 'm²', 'lab_ceiling');
      break;
    }
    case 'roofing': {
      const r = roofGeometry(el);
      const gauge = ['045', '055', '070'].includes(el.gauge) ? el.gauge : '055';
      const sheets = r.area * (1 + o.waste);
      c.line(`Long-span aluminium ${gauge[0]}.${gauge.slice(1)} mm`, sheets, 'm²', `roof_${gauge}`, { note: `${fmt(r.area, 1)} m² on slope` });
      c.mat(`roof_${gauge}`, sheets);
      const p4 = Math.ceil(r.timber2x4 * (1 + o.waste) / TIMBER_PIECE_M - 1e-9);
      const p3 = Math.ceil(r.timber2x3 * (1 + o.waste) / TIMBER_PIECE_M - 1e-9);
      c.line('Timber 2 × 4 in (trusses, wall plate)', p4, 'nr', 'timber_2x4', { note: `${r.trusses} trusses at ${fmt(n(el.spacing), 1)} m` });
      c.line('Timber 2 × 3 in (struts, purlins)', p3, 'nr', 'timber_2x3');
      c.mat('timber_2x4', p4); c.mat('timber_2x3', p3);
      c.line('Nails', r.area * 0.1, 'kg', 'nails');
      c.mat('nails', r.area * 0.1);
      if (el.fascia) { c.line('Fascia and barge boards', r.fascia, 'm', 'fascia'); c.mat('fascia', r.fascia); }
      c.line('Roof carpentry and sheeting', r.area, 'm²', 'lab_roofing');
      Object.assign(info, r);
      break;
    }
    case 'openings': {
      const winA = n(el.windows) * n(el.winW) * n(el.winH);
      c.line('Steel security doors', n(el.doorsExt), 'nr', 'door_ext');
      c.line('Internal flush doors with frames', n(el.doorsInt), 'nr', 'door_int');
      c.line('Aluminium casement windows', winA, 'm²', 'window', { note: `${n(el.windows)} at ${fmt(n(el.winW), 2)} × ${fmt(n(el.winH), 2)} m` });
      if (el.burglar) c.line('Burglary-proof bars', winA, 'm²', 'burglar');
      c.mat('door_ext', n(el.doorsExt)); c.mat('door_int', n(el.doorsInt)); c.mat('window', winA);
      if (el.burglar) c.mat('burglar', winA);
      break;
    }
    case 'formwork': c.formwork(n(el.area)); break;
    case 'custom': {
      const q = n(el.qty);
      if (q > 0) c.lines.push({ desc: String(el.desc || 'Item'), qty: q, unit: String(el.unit || 'item'), rate: null, fixedRate: Math.max(0, n(el.rate)) });
      break;
    }
    default: break;
  }
  return { lines: c.lines, mats: c.mats, floorArea, info };
}

export function roofGeometry(el) {
  const L = n(el.length), W = n(el.span), oh = n(el.overhang), p = n(el.pitch) * Math.PI / 180;
  const cos = Math.cos(p);
  const rafter = (W / 2 + oh) / cos;
  const rise = (W / 2) * Math.tan(p);
  const area = (L + 2 * oh) * (W + 2 * oh) / cos;
  const trusses = Math.ceil(L / n(el.spacing, 1.2) - 1e-9) + 1;
  const strut = Math.hypot(W / 4, rise / 2);
  const hipF = el.form === 'hip' ? 1.15 : 1;
  const perTruss4 = 2 * rafter + W + rise;
  const purlinRows = (Math.ceil(rafter / PURLIN_SPACING - 1e-9) + 1) * 2;
  const timber2x4 = (trusses * perTruss4 + 2 * L) * hipF;
  const timber2x3 = (trusses * 2 * strut + purlinRows * (L + 2 * oh)) * hipF;
  const fascia = el.form === 'hip' ? 2 * (L + 2 * oh) + 2 * (W + 2 * oh) : 2 * (L + 2 * oh) + 4 * rafter;
  return { area, rafter, rise, trusses, timber2x4, timber2x3, fascia, purlinRows };
}

/* ---------------- whole estimate ---------------- */

export function normaliseProject(p = {}) {
  return {
    name: String(p.name || 'Untitled project'),
    client: String(p.client || ''),
    site: String(p.site || ''),
    gfa: Math.max(0, n(p.gfa)),
    contingency: Math.min(50, Math.max(0, n(p.contingency, 5))),
    vat: typeof p.vat === 'boolean' ? p.vat : null,
    elements: (Array.isArray(p.elements) ? p.elements : [])
      .filter(e => e && ELEMENT_TYPES[e.type])
      .map(e => ({ ...newElement(e.type), ...e })),
  };
}

/**
 * Price a project.
 * opts: { rates (resolved map), waste (fraction), grade | mix, vat (bool), vatRate (0.075), trips }
 */
export function estimate(project, opts = {}) {
  const p = normaliseProject(project);
  const rates = opts.rates || resolveRates({}, opts.region);
  const waste = opts.waste ?? 0.05;
  const vatOn = p.vat ?? Boolean(opts.vat);
  const vatRate = opts.vatRate ?? 0.075;
  const trips = { ...DEFAULT_TRIPS, ...(opts.trips || {}) };
  const groups = [];
  const mats = {};
  let floorArea = 0;
  const issues = [];

  for (const el of p.elements) {
    const errs = validateElement(el);
    const r = computeElement(el, { waste, grade: opts.grade, mix: opts.mix });
    const lines = r.lines.map(l => {
      const rate = l.rate ? n(rates[l.rate]) : n(l.fixedRate);
      return { desc: l.desc, qty: l.qty, unit: l.unit, rateKey: l.rate, rate, amount: l.qty * rate, note: l.note || '' };
    });
    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    groups.push({ id: el.id, type: el.type, name: el.name || ELEMENT_TYPES[el.type].label, lines, subtotal, info: r.info, errors: errs });
    if (Object.keys(errs).length) issues.push({ id: el.id, name: el.name, errors: errs });
    for (const [k, q] of Object.entries(r.mats)) mats[k] = (mats[k] || 0) + q;
    floorArea += r.floorArea;
  }

  const subtotal = groups.reduce((s, g) => s + g.subtotal, 0);
  const materialsCost = groups.reduce((s, g) => s + g.lines.filter(l => !String(l.rateKey || '').startsWith('lab_')).reduce((a, l) => a + l.amount, 0), 0);
  const labourCost = subtotal - materialsCost;
  const contingency = subtotal * p.contingency / 100;
  const net = subtotal + contingency;
  const vat = vatOn ? net * vatRate : 0;
  const total = net + vat;
  const area = p.gfa > 0 ? p.gfa : floorArea;
  return {
    project: p, groups, subtotal, materialsCost, labourCost,
    contingencyPct: p.contingency, contingency, net, vatOn, vatRate, vat, total,
    floorArea: area, costPerM2: area > 0 ? total / area : 0,
    shopping: shoppingList(mats, rates, trips), materials: mats, issues,
  };
}

/** Aggregate raw materials into what you actually buy. */
export function shoppingList(mats, rates = resolveRates(), trips = DEFAULT_TRIPS) {
  const items = [];
  const add = (group, key, label, qty, unit, detail = '', cost = null) => items.push({ group, key, label, qty, unit, detail, cost });
  const m = (k) => mats[k] || 0;
  if (m('cement')) add('Concrete and mortar', 'cement', 'Cement, 50 kg', Math.ceil(m('cement') - 1e-9), 'bags', `${fmt(m('cement') * BAG_KG / 1000, 1)} t`, Math.ceil(m('cement') - 1e-9) * n(rates.cement));
  if (m('sand')) add('Concrete and mortar', 'sand', 'Sharp sand', round1(m('sand')), 't', `${tripText(m('sand'), trips.sand)}`, m('sand') * n(rates.sand));
  if (m('granite')) add('Concrete and mortar', 'granite', 'Granite, 20 mm', round1(m('granite')), 't', `${tripText(m('granite'), trips.granite)}`, m('granite') * n(rates.granite));
  if (m('water')) add('Concrete and mortar', 'water', 'Water', Math.ceil(m('water') / 100) * 100, 'L', `${fmt(m('water') / 1000, 1)} m³, about ${Math.ceil(m('water') / 1000 / 9 - 1e-9)} tanker loads of 9,000 L`);
  let rebarKg = 0;
  for (const d of BAR_SIZES) {
    const metres = m(`rebar${d}`);
    if (!metres) continue;
    const kg = metres * barKgPerM(d);
    rebarKg += kg;
    const lengths = Math.ceil(metres / STOCK_BAR_M - 1e-9);
    add('Steel', `rebar${d}`, `Y${d} rods, 12 m`, lengths, 'lengths', `${fmt(kg, 0)} kg, ${fmt(barKgPerM(d), 3)} kg/m`, kg / 1000 * n(rates.rebar));
  }
  if (rebarKg) add('Steel', 'rebar', 'All reinforcement', round2(rebarKg / 1000), 't', `${fmt(rebarKg, 0)} kg`);
  if (m('wire')) add('Steel', 'wire', 'Binding wire', Math.ceil(m('wire') / WIRE_ROLL_KG - 1e-9), 'rolls', `${fmt(m('wire'), 1)} kg, 20 kg rolls`, m('wire') * n(rates.wire));
  if (m('block9')) add('Walls and fill', 'block9', '9 inch blocks', m('block9'), 'nr', '', m('block9') * n(rates.block9));
  if (m('block6')) add('Walls and fill', 'block6', '6 inch blocks', m('block6'), 'nr', '', m('block6') * n(rates.block6));
  if (m('hardcore')) add('Walls and fill', 'hardcore', 'Hardcore / laterite', round1(m('hardcore')), 'm³', `about ${Math.ceil(m('hardcore') / 12 - 1e-9)} tipper loads`, m('hardcore') * n(rates.hardcore));
  if (m('dpm')) add('Walls and fill', 'dpm', 'DPM polythene', Math.ceil(m('dpm') / DPM_ROLL_M2 - 1e-9), 'rolls', `${fmt(m('dpm'), 0)} m², 4 × 50 m rolls`, m('dpm') * n(rates.dpm));
  if (m('formwork')) add('Walls and fill', 'formwork', 'Formwork contact area', round1(m('formwork')), 'm²', 'Plywood and planks, reused', m('formwork') * n(rates.formwork));
  for (const [k, q] of Object.entries(mats)) {
    const t = /^tile_(floor|wall)_(.+)$/.exec(k);
    if (!t) continue;
    const per = TILE_SIZES[t[2]] || 1.44;
    add('Finishes', k, `${t[1] === 'floor' ? 'Floor' : 'Wall'} tiles ${t[2].replace('x', ' × ')} mm`, Math.ceil(q / per - 1e-9), 'cartons', `${fmt(q, 1)} m², ${per} m² a carton`, q * n(rates[`tile_${t[1]}`]));
  }
  if (m('grout')) add('Finishes', 'grout', 'Tile grout', Math.ceil(m('grout') - 1e-9), 'kg', '', m('grout') * n(rates.grout));
  for (const kind of Object.keys(PAINT_COVER)) if (m(`paint_${kind}`)) add('Finishes', `paint_${kind}`, `${kind[0].toUpperCase()}${kind.slice(1)} paint`, m(`paint_${kind}`), 'buckets', '20 L', m(`paint_${kind}`) * n(rates[`paint_${kind}`]));
  if (m('ceiling')) add('Finishes', 'ceiling', 'PVC ceiling', round1(m('ceiling')), 'm²', '', m('ceiling') * n(rates.ceiling));
  for (const g of ['045', '055', '070']) if (m(`roof_${g}`)) add('Roof and openings', `roof_${g}`, `Long-span aluminium ${g[0]}.${g.slice(1)} mm`, round1(m(`roof_${g}`)), 'm²', '', m(`roof_${g}`) * n(rates[`roof_${g}`]));
  if (m('timber_2x4')) add('Roof and openings', 'timber_2x4', 'Timber 2 × 4 in, 12 ft', m('timber_2x4'), 'pieces', '', m('timber_2x4') * n(rates.timber_2x4));
  if (m('timber_2x3')) add('Roof and openings', 'timber_2x3', 'Timber 2 × 3 in, 12 ft', m('timber_2x3'), 'pieces', '', m('timber_2x3') * n(rates.timber_2x3));
  if (m('nails')) add('Roof and openings', 'nails', 'Nails, assorted', Math.ceil(m('nails') - 1e-9), 'kg', '', m('nails') * n(rates.nails));
  if (m('fascia')) add('Roof and openings', 'fascia', 'Fascia and barge boards', round1(m('fascia')), 'm', '', m('fascia') * n(rates.fascia));
  if (m('door_ext')) add('Roof and openings', 'door_ext', 'Steel security doors', m('door_ext'), 'nr', '', m('door_ext') * n(rates.door_ext));
  if (m('door_int')) add('Roof and openings', 'door_int', 'Internal doors with frames', m('door_int'), 'nr', '', m('door_int') * n(rates.door_int));
  if (m('window')) add('Roof and openings', 'window', 'Aluminium windows', round2(m('window')), 'm²', '', m('window') * n(rates.window));
  if (m('burglar')) add('Roof and openings', 'burglar', 'Burglary-proof bars', round2(m('burglar')), 'm²', '', m('burglar') * n(rates.burglar));
  return items;
}

const round1 = (v) => Math.round(v * 10) / 10;
const round2 = (v) => Math.round(v * 100) / 100;
const tripText = (t, size) => {
  const trips = t / size;
  return trips < 0.5 ? `under half a ${size}-tonne trip` : `${fmt(trips, 1)} × ${size}-tonne trip${trips > 1.05 ? 's' : ''}`;
};

/* ---------------- exports ---------------- */

const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function toCSV(result) {
  const rows = [['Element', 'Item', 'Quantity', 'Unit', 'Rate (NGN)', 'Amount (NGN)', 'Note']];
  for (const g of result.groups) {
    for (const l of g.lines) rows.push([g.name, l.desc, round2(l.qty), l.unit, Math.round(l.rate), Math.round(l.amount), l.note]);
    rows.push([g.name, 'Subtotal', '', '', '', Math.round(g.subtotal), '']);
  }
  rows.push(['', 'Subtotal', '', '', '', Math.round(result.subtotal), '']);
  rows.push(['', `Contingency ${result.contingencyPct}%`, '', '', '', Math.round(result.contingency), '']);
  if (result.vatOn) rows.push(['', `VAT ${result.vatRate * 100}%`, '', '', '', Math.round(result.vat), '']);
  rows.push(['', 'Grand total', '', '', '', Math.round(result.total), '']);
  rows.push([]);
  rows.push(['Shopping list', 'Item', 'Quantity', 'Unit', '', 'Est. cost (NGN)', 'Detail']);
  for (const s of result.shopping) rows.push([s.group, s.label, s.qty, s.unit, '', s.cost == null ? '' : Math.round(s.cost), s.detail]);
  return rows.map(r => r.map(csvCell).join(',')).join('\r\n');
}

/* ---------------- presets ---------------- */

/** A rectangular bungalow or storey building from its outline. */
export function presetBuilding({ length = 15, width = 12, storeys = 1, wallHeight = 3, internalWalls = 0.9, roof = true, finishes = true } = {}) {
  const L = Math.max(3, n(length, 15)), W = Math.max(3, n(width, 12)), S = Math.min(4, Math.max(1, Math.round(n(storeys, 1)))), H = n(wallHeight, 3);
  const perim = 2 * (L + W);
  const internal = perim * n(internalWalls, 0.9);
  const run = perim + internal;
  const area = L * W;
  const rooms = Math.max(2, Math.round(area / 18));
  const els = [
    newElement('strip_footing', { name: 'Strip foundation', length: round1(run) }),
    newElement('blockwork', { name: 'Substructure blockwork, 9 inch', length: round1(run), height: 0.9, openings: 0, block: '9' }),
    newElement('hardcore', { length: L, width: W }),
    newElement('dpm', { length: L, width: W }),
    newElement('slab_ground', { length: L, width: W }),
  ];
  const cols = Math.ceil(perim / 3.5);
  for (let s = 1; s <= S; s++) {
    const tag = S > 1 ? ` (floor ${s})` : '';
    els.push(newElement('column', { name: `Columns${tag}`, count: cols, height: H }));
    els.push(newElement('blockwork', { name: `External walls${tag}`, length: round1(perim), height: H, openings: round1(rooms * 1.44 + 2 * 2.1), block: '9' }));
    els.push(newElement('blockwork', { name: `Internal walls${tag}`, length: round1(internal), height: H, openings: round1(rooms * 1.9), block: '6' }));
    els.push(newElement('lintel', { name: `Lintels${tag}`, count: rooms * 2 + 2 }));
    if (s < S) {
      els.push(newElement('beam', { name: `Floor beams${tag}`, length: round1(run * 0.8) }));
      els.push(newElement('slab_suspended', { name: `Floor slab over floor ${s}`, length: L, width: W }));
    } else {
      els.push(newElement('beam', { name: `Roof ring beam${tag}`, length: round1(perim), h: 225, bottomBars: 2, bottomSize: '12', topBars: 2, topSize: '12' }));
    }
  }
  if (S > 1) els.push(newElement('stairs', { risers: Math.round(H / 0.17) }));
  if (finishes) {
    const wallArea = (perim * 2 + internal * 2) * H * S;
    els.push(newElement('plaster', { name: 'Plaster and render', length: round1((perim + internal) * S), height: H, faces: 2, openings: round1(rooms * 3.3) }));
    els.push(newElement('screed', { length: L, width: W * S }));
    els.push(newElement('tiling', { name: 'Floor tiles', length: L, width: W * S }));
    els.push(newElement('painting', { area: Math.round(wallArea * 0.9) }));
    els.push(newElement('ceiling', { area: Math.round(area * S) }));
    els.push(newElement('openings', { doorsExt: 2, doorsInt: rooms * S, windows: rooms * S }));
  }
  if (roof) els.push(newElement('roofing', { length: L, span: W }));
  return els;
}

/** Foundations and apron for placing shipping containers. */
export function presetContainerBase({ size = '40', count = 1, apron = true } = {}) {
  const N = Math.max(1, Math.round(n(count, 1)));
  const pads = (String(size) === '20' ? 4 : 6) * N;
  const L = String(size) === '20' ? 6.06 : 12.19;
  const els = [
    newElement('pad_footing', { name: 'Container pad footings', count: pads, length: 0.9, width: 0.9, thickness: 300, excDepth: 900 }),
    newElement('column', { name: 'Plinth pedestals', count: pads, b: 450, h: 450, height: 0.6, mainBars: 4, mainSize: '12' }),
  ];
  if (apron) els.push(newElement('slab_ground', { name: 'Apron / walkway slab', length: round1(L + 2), width: round1(2.44 * N + 2), thickness: 100, layers: 1 }));
  return els;
}

export const PRESETS = {
  bungalow: { label: '3-bedroom bungalow shell', make: () => presetBuilding({ length: 15, width: 12 }) },
  duplex: { label: 'Two-storey duplex', make: () => presetBuilding({ length: 14, width: 11, storeys: 2 }) },
  container40: { label: 'Base for one 40 ft container', make: () => presetContainerBase({ size: '40', count: 1 }) },
  container20x2: { label: 'Base for two 20 ft containers', make: () => presetContainerBase({ size: '20', count: 2 }) },
};
