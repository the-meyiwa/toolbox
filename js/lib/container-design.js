/* ============================================================
   TOOLBOX — Container structure design engine

   Turns a structured spec, or just an intent brief ("a 20ft office for
   4 staff with a toilet"), into a validated, fully resolved design:
   modules on a site grid and levels, rooms, partitions, doors and
   windows, furniture, stairs and extras, warnings, and an NGN estimate
   priced with the same quote engine as the Container Planner.

   Pure: no DOM, no three.js. Runs in the browser and in node.

   Coordinates (metres) match the Container Planner exactly:
   - each module has a local frame: X along its length, 0 = back end,
     len = front (door) end; Z across its width, 0 = left side.
   - openings: `wall` (front/back/left/right) + `along` (centre, metres
     from the wall's start) + `sill`. Along a wall the local point is
       front (len, along)   back (0, wid - along)
       left  (along, 0)     right (len - along, wid)
   - fittings: centre `x`, `z`, and `r` (0..3). r even: w along X and
     d along Z; r odd: swapped. The back of the item faces -Z (r0),
     +X (r1), +Z (r2), -X (r3); its front faces the opposite way.
   - site: rot 0 → X = x + lx, Z = z + lz; rot 90 → X = x + wid - lz,
     Z = z + lx. Level 0 is the ground; its floor is at y = 0.
   ============================================================ */

import { buildQuote } from './container-quote.js';
import { defaultRateBook, COMMERCIAL_DEFAULTS, FITTING_RATES, SERVICES, LOGISTICS } from './container-catalog.js';

export const M_PER_FT = 0.3048;
export const WALL = 0.06;          // shell thickness, drawn outside the internal box
export const GROUND_Y = -0.25;     // ground plane (units sit on blocks)
const PART_T = 0.1;
const GAP = WALL * 2;              // clear gap between two touching modules' internal boxes
const RES = 0.1;                   // walkway grid
const RAD = 0.25;                  // half of the clear walkway width

const r3 = (v) => Math.round(v * 1000) / 1000;
const r2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lower = (v) => String(v ?? '').toLowerCase().trim();
const num = (v) => { const n = typeof v === 'string' ? parseFloat(v) : v; return Number.isFinite(n) ? n : undefined; };
const clone = (v) => JSON.parse(JSON.stringify(v));

/* ============================================================
   Catalogues
   ============================================================ */

export const SIZES = {
  '10ft': { name: '10 ft container', short: '10 ft', len: 2.831, wid: 2.352, hgt: 2.393, shell: 'buy-20', container: true },
  '20ft': { name: '20 ft container', short: '20 ft', len: 5.898, wid: 2.352, hgt: 2.393, shell: 'buy-20', container: true },
  '40ft': { name: '40 ft container', short: '40 ft', len: 12.032, wid: 2.352, hgt: 2.393, shell: 'buy-40', container: true },
  '40hc': { name: '40 ft high cube', short: '40 ft HC', len: 12.032, wid: 2.352, hgt: 2.698, shell: 'buy-40hc', container: true },
  '45hc': { name: '45 ft high cube', short: '45 ft HC', len: 13.556, wid: 2.352, hgt: 2.698, shell: 'buy-40hc', container: true },
  pc12: { name: '12 × 8 ft cabin', short: '12 ft cabin', len: 3.658, wid: 2.438, hgt: 2.4, shell: 'fabricate' },
  pc16: { name: '16 × 8 ft cabin', short: '16 ft cabin', len: 4.877, wid: 2.438, hgt: 2.4, shell: 'fabricate' },
  pc20: { name: '20 × 8 ft cabin', short: '20 ft cabin', len: 6.096, wid: 2.438, hgt: 2.4, shell: 'fabricate' },
  pc24: { name: '24 × 9 ft cabin', short: '24 ft cabin', len: 7.315, wid: 2.743, hgt: 2.5, shell: 'fabricate' },
  pc32: { name: '32 × 10 ft cabin', short: '32 ft cabin', len: 9.754, wid: 3.048, hgt: 2.5, shell: 'fabricate' },
};

export const COLORS = {
  green: { name: 'Green', hex: '#3f6b52' }, blue: { name: 'Blue', hex: '#2f5f86' },
  red: { name: 'Red', hex: '#8d3a32' }, grey: { name: 'Grey', hex: '#6f7479' },
  white: { name: 'White', hex: '#dedbd4' }, sand: { name: 'Sand', hex: '#bfa87e' },
};

export const OPENINGS = {
  'personnel-door': { name: 'Door', w: 0.9, h: 2.0, sill: 0, door: true, planner: 'personnel-door', price: 'personnel-door' },
  'glass-door': { name: 'Glazed door', w: 0.9, h: 2.1, sill: 0, door: true, glass: true, planner: 'personnel-door', price: 'personnel-door' },
  'double-door': { name: 'Double door', w: 1.8, h: 2.0, sill: 0, door: true, planner: 'double-door', price: 'double-door' },
  'roller-door': { name: 'Roller shutter', w: 2.2, h: 2.1, sill: 0, door: true, roller: true, planner: 'roller-door', price: 'roller-door' },
  window: { name: 'Window', w: 1.2, h: 1.0, sill: 0.95, glass: true, planner: 'window', price: 'window' },
  'small-window': { name: 'Small window', w: 0.6, h: 0.6, sill: 1.4, glass: true, planner: 'small-window', price: 'small-window' },
  vent: { name: 'Air vent', w: 0.3, h: 0.25, sill: 2.0, planner: 'vent', price: 'vent' },
  'serving-hatch': { name: 'Serving hatch', w: 1.5, h: 1.0, sill: 0.95, glass: true, planner: 'window', price: 'window' },
  'glass-wall': { name: 'Glass curtain wall', w: 2.4, h: 2.1, sill: 0.1, glass: true, planner: 'window', price: null },
  cutout: { name: 'Opening to next unit', w: 1.8, h: 2.1, sill: 0, open: true, planner: null, price: null },
};

/* w = the back edge (against a wall), d = depth, h = height. */
export const FITTINGS = {
  partition: { name: 'Partition wall', w: PART_T, d: 2.35, h: 2.3, color: '#e4e0d8', planner: 'partition' },
  desk: { name: 'Desk', w: 1.4, d: 0.7, h: 0.75, color: '#b08d5f', planner: 'desk' },
  chair: { name: 'Chair', w: 0.55, d: 0.55, h: 0.9, color: '#555b60', soft: true, planner: 'chair' },
  bed: { name: 'Bed', w: 0.9, d: 1.9, h: 0.55, color: '#8f7f6a', planner: 'bed' },
  bunk: { name: 'Bunk beds', w: 1.9, d: 0.9, h: 1.7, color: '#8f7f6a', planner: 'bunk', rotOffset: 1, openFrame: true },
  kitchen: { name: 'Kitchen unit', w: 1.8, d: 0.6, h: 0.9, color: '#c9c4bb', planner: 'kitchen' },
  toilet: { name: 'WC', w: 0.9, d: 1.2, h: 0.8, color: '#eef0f1', planner: 'toilet' },
  shower: { name: 'Shower', w: 0.9, d: 0.9, h: 2.1, color: '#dfe3e6', planner: 'shower' },
  rack: { name: 'Storage rack', w: 1.8, d: 0.5, h: 2.0, color: '#7d8388', planner: 'rack' },
  cabinet: { name: 'Cabinet', w: 0.8, d: 0.45, h: 1.8, color: '#a89a86', planner: 'cabinet' },
  table: { name: 'Table', w: 1.6, d: 0.8, h: 0.75, color: '#b08d5f', planner: 'table' },
  sofa: { name: 'Sofa', w: 1.8, d: 0.8, h: 0.8, color: '#7c7468', planner: 'bed', rotOffset: 1, rate: 380000, labour: 0 },
  counter: { name: 'Service counter', w: 2.0, d: 0.6, h: 1.05, color: '#a58a66', planner: 'kitchen', rate: 450000, labour: 45000 },
  reception: { name: 'Reception desk', w: 1.6, d: 0.7, h: 1.05, color: '#a58a66', planner: 'desk', rate: 420000, labour: 30000 },
  basin: { name: 'Wash basin', w: 0.5, d: 0.4, h: 0.85, color: '#eef0f1', planner: null, rate: 85000, labour: 25000 },
  fridge: { name: 'Fridge', w: 0.7, d: 0.7, h: 1.8, color: '#d9dcde', planner: 'cabinet', rate: 520000, labour: 0 },
  stool: { name: 'Stool', w: 0.4, d: 0.4, h: 0.75, color: '#555b60', soft: true, planner: 'chair', rate: 45000, labour: 0 },
  bistro: { name: 'Café table', w: 0.7, d: 0.7, h: 0.75, color: '#b08d5f', planner: 'table', rate: 95000, labour: 0 },
  ac: { name: 'Split AC (indoor unit)', w: 0.9, d: 0.25, h: 0.3, mount: 2.0, color: '#f4f4f2', planner: null, wallMounted: true },
};

const SPEC_TIERS = {
  economy: { prep: 'light', exterior: 'paint', insulation: 'eps50', framing: 'steel25', interior: 'pvc', ceiling: 'pvc', floor: 'vinyl', subfloor: 'ply12', paint: 'emulsion' },
  standard: { prep: 'full', exterior: 'paint', insulation: 'pu25', framing: 'steel40', interior: 'ply9', ceiling: 'pvc', floor: 'vinyl', subfloor: 'marine18', paint: 'emulsion' },
  premium: { prep: 'full', exterior: 'paint', insulation: 'pu50', framing: 'steel40', interior: 'mdf', ceiling: 'gypsum', floor: 'lvt', subfloor: 'marine18', paint: 'emulsion' },
};

/* Structure works the planner does not price per unit (NGN, starting points). */
const WORKS = {
  footing: { name: 'Concrete pad footings', unit: 'each', rate: 38000, labour: 16000 },
  stack: { name: 'Stacking: twist-locks, welding & corner reinforcement', unit: 'each', rate: 220000, labour: 140000 },
  stair: { name: 'External steel staircase & handrail (per flight)', unit: 'each', rate: 780000, labour: 220000 },
  roofdeck: { name: 'Roof deck: WPC decking on steel joists', unit: 'area', rate: 24000, labour: 8000 },
  railing: { name: 'Steel & glass safety railing', unit: 'length', rate: 42000, labour: 9000 },
  pitched: { name: 'Pitched roof: steel trusses & long-span roofing', unit: 'area', rate: 17500, labour: 6500 },
  canopy: { name: 'Canopy: steel frame & polycarbonate', unit: 'area', rate: 26000, labour: 8000 },
  deck: { name: 'Deck / verandah: WPC on steel frame', unit: 'area', rate: 27000, labour: 9000 },
  timber: { name: 'Timber cladding on battens', unit: 'area', rate: 19000, labour: 6500 },
  glazing: { name: 'Aluminium & glass curtain wall', unit: 'area', rate: 115000, labour: 22000 },
  joint: { name: 'Weather seal & flashing between joined units', unit: 'each', rate: 70000, labour: 35000 },
};

/* ============================================================
   Parsing helpers (tolerant: models and people say things loosely)
   ============================================================ */

export function resolveSize(input) {
  if (!input) return null;
  const s = lower(input).replace(/[’'"]/g, ' ft ').replace(/\s+/g, ' ');
  if (SIZES[s]) return s;
  if (/cabin|porta|portable/.test(s)) {
    const m = /(12|16|20|24|32)/.exec(s);
    return m ? `pc${m[1]}` : 'pc20';
  }
  if (/\b45/.test(s)) return '45hc';
  if (/\b40/.test(s)) return /hc|high|cube/.test(s) ? '40hc' : '40ft';
  if (/\b10\b|\b10 ?f/.test(s)) return '10ft';
  if (/\b20\b|\b20 ?f|twenty/.test(s)) return '20ft';
  if (/forty/.test(s)) return '40ft';
  if (/high ?cube|\bhc\b/.test(s)) return '40hc';
  return null;
}

export function resolveColor(input) {
  const s = lower(input);
  if (!s) return null;
  if (COLORS[s]) return s;
  if (/navy|blue|teal/.test(s)) return 'blue';
  if (/red|maroon|burgundy|orange|rust|brick/.test(s)) return 'red';
  if (/white|cream|ivory/.test(s)) return 'white';
  if (/sand|beige|tan|brown|khaki|yellow|gold/.test(s)) return 'sand';
  if (/green|olive|army/.test(s)) return 'green';
  if (/grey|gray|black|charcoal|silver|anthracite|dark/.test(s)) return 'grey';
  return null;
}

const WALL_IDS = ['front', 'back', 'left', 'right'];
export function resolveWall(input) {
  const s = lower(input);
  if (WALL_IDS.includes(s)) return s;
  if (/rear|back/.test(s)) return 'back';
  if (/front|end|door end|entrance end/.test(s)) return 'front';
  if (/left/.test(s)) return 'left';
  if (/right|side|long|street/.test(s)) return 'right';
  return null;
}

export function resolveOpeningType(input) {
  const s = lower(input).replace(/_/g, '-');
  if (OPENINGS[s]) return s;
  if (s === 'door' || /personnel|single door|entrance|entry|main door|front door|^door/.test(s)) return /glass|glaz/.test(s) ? 'glass-door' : 'personnel-door';
  if (/double|french|twin/.test(s)) return 'double-door';
  if (/roll|shutter|garage/.test(s)) return 'roller-door';
  if (/glass ?door|glazed door/.test(s)) return 'glass-door';
  if (/curtain|glass ?wall|glazing|shop ?front|storefront|full.?height/.test(s)) return 'glass-wall';
  if (/hatch|serving/.test(s)) return 'serving-hatch';
  if (/vent|louv/.test(s)) return 'vent';
  if (/small|high|clerestory|bathroom window|toilet window/.test(s)) return 'small-window';
  if (/window/.test(s)) return 'window';
  if (/cut|opening|arch|pass/.test(s)) return 'cutout';
  return null;
}

export function resolveFittingType(input) {
  const s = lower(input).replace(/_/g, '-');
  if (FITTINGS[s]) return s;
  const map = [
    [/partition|wall/, 'partition'], [/reception|front desk/, 'reception'], [/counter|bar/, 'counter'],
    [/workstation|desk/, 'desk'], [/stool/, 'stool'], [/chair|seat/, 'chair'], [/bunk/, 'bunk'], [/bed/, 'bed'],
    [/kitchen|cooker|stove|worktop/, 'kitchen'], [/toilet|wc|water closet/, 'toilet'], [/shower/, 'shower'],
    [/sink|basin|wash/, 'basin'], [/fridge|freezer|chiller/, 'fridge'], [/rack|shel/, 'rack'],
    [/cabinet|cupboard|wardrobe|locker|file/, 'cabinet'], [/sofa|couch|settee/, 'sofa'],
    [/bistro|cafe table|café table|small table|round table/, 'bistro'], [/table/, 'table'], [/\bac\b|air ?con|split/, 'ac'],
  ];
  for (const [re, t] of map) if (re.test(s)) return t;
  return null;
}

const USE_RULES = [
  [/coffee|caf[eé]|restaurant|bar\b|eatery|canteen|food|bakery|juice|lounge bar/, 'cafe'],
  [/kiosk|booth|pos\b|ticket/, 'kiosk'],
  [/shop|retail|boutique|pharmacy|supermarket|mini ?mart|store front|showroom|provision/, 'shop'],
  [/site office|site-office|construction/, 'site-office'],
  [/bunk|hostel|accommodation|dorm|quarters|camp|lodg/, 'bunkhouse'],
  [/clinic|hospital|consult|lab\b|medical|health/, 'clinic'],
  [/salon|barber|spa|beauty|nail/, 'salon'],
  [/security|gate ?house|guard|checkpoint|post\b/, 'gatehouse'],
  [/class|school|training|creche/, 'classroom'],
  [/ablution|toilet block|restroom|washroom|toilets/, 'ablution'],
  [/storage|warehouse|workshop|tool|archive/, 'storage'],
  [/home|house|apartment|flat|studio|residence|living|guest|airbnb|tiny|bedroom|duplex/, 'home'],
  [/office|workspace|admin|agency|headquarters|hq|co-?work/, 'office'],
];
export function resolveUse(input) {
  const s = lower(input);
  for (const [re, k] of USE_RULES) if (re.test(s)) return k;
  return s ? 'office' : null;
}

/* ============================================================
   Room kinds: how long a room needs to be across a container, and
   what goes in it. Lengths are metres along the unit.
   ============================================================ */

const R = (label, o) => ({ label, habitable: true, flex: 0, order: 5, ...o });
export const ROOM_KINDS = {
  toilet: R('Toilet', { wet: true, habitable: false, order: 0, need: () => 1.3,
    furnish: () => [{ type: 'toilet', walls: ['left', 'right'], end: 'back' }, { type: 'basin', walls: ['right', 'back', 'left'] }] }),
  bathroom: R('Bathroom', { wet: true, habitable: false, order: 0, need: () => 2.0,
    furnish: () => [{ type: 'shower', walls: ['left', 'right'], end: 'back' }, { type: 'toilet', walls: ['left', 'right'] }, { type: 'basin', walls: ['right', 'left', 'back'] }] }),
  store: R('Store', { habitable: false, order: 1, need: () => 2.0, vent: true,
    furnish: () => [{ type: 'rack', walls: ['left', 'right'] }, { type: 'cabinet', walls: ['right', 'left', 'back'], optional: true }] }),
  storage: R('Storage', { habitable: false, order: 1, flex: 3, need: () => 2.2, vent: true,
    furnish: (p) => Array.from({ length: p.racks || 4 }, (_, i) => ({ type: 'rack', walls: i % 2 ? ['right', 'left'] : ['left', 'right'], optional: i > 1 })) }),
  kitchenette: R('Kitchenette', { order: 2, need: () => 2.0, vent: true,
    furnish: () => [{ type: 'kitchen', walls: ['left', 'right'] }, { type: 'fridge', walls: ['left', 'right', 'back'], optional: true }] }),
  kitchen: R('Kitchen', { order: 2, need: () => 2.6, vent: true, flex: 1,
    furnish: () => [{ type: 'kitchen', walls: ['left', 'right'] }, { type: 'fridge', walls: ['left', 'right', 'back'] }, { type: 'cabinet', walls: ['right', 'left'], optional: true }] }),
  bedroom: R('Bedroom', { order: 2, need: () => 2.6, flex: 1,
    furnish: () => [{ type: 'bed', walls: ['left', 'right'], end: 'back' }, { type: 'cabinet', walls: ['right', 'left', 'front'] }, { type: 'ac', walls: ['back', 'front'] }] }),
  bunkroom: R('Bunk room', { order: 2, flex: 1, need: (p) => Math.ceil((p.bunks || 2) / 2) * 2.0 + 0.4,
    furnish: (p) => [...Array.from({ length: p.bunks || 2 }, (_, i) => ({ type: 'bunk', walls: i % 2 ? ['right', 'left'] : ['left', 'right'] })), { type: 'cabinet', walls: ['back', 'front'], optional: true }] }),
  manager: R('Manager’s office', { order: 3, flex: 1, need: () => 2.8,
    furnish: () => [{ type: 'desk', walls: ['left', 'right'], offset: 0.8, companion: 'behind+visitors' }, { type: 'cabinet', walls: ['right', 'left', 'back'], optional: true }, { type: 'ac', walls: ['back', 'front'] }] }),
  consult: R('Consulting room', { order: 3, flex: 1, need: () => 3.0,
    furnish: () => [{ type: 'bed', walls: ['left', 'right'], end: 'back' }, { type: 'desk', walls: ['right', 'left'], companion: 'chair' }, { type: 'basin', walls: ['right', 'left', 'back'] }, { type: 'ac', walls: ['back', 'front'] }] }),
  meeting: R('Meeting room', { order: 4, flex: 1, need: (p) => ((p.seats || 6) > 6 ? 3.2 : 1.6) + 1.3,
    furnish: (p) => { const s = p.seats || 6; const t = s > 6 ? 2 : 1; return [...Array.from({ length: t }, () => ({ type: 'table', place: 'center', companion: 'around', seats: Math.ceil(s / t) })), { type: 'ac', walls: ['back', 'front'] }]; } }),
  service: R('Service & kitchen', { order: 4, flex: 1, need: () => 3.4, vent: true,
    furnish: () => [{ type: 'counter', walls: ['right', 'left'], end: 'front' }, { type: 'kitchen', walls: ['left', 'right'] }, { type: 'fridge', walls: ['left', 'right', 'back'] }, { type: 'rack', walls: ['left', 'back'], optional: true }] }),
  kiosk: R('Kiosk', { order: 6, need: () => 2.0,
    furnish: () => [{ type: 'counter', walls: ['right', 'left'] }, { type: 'fridge', walls: ['left', 'back'], optional: true }, { type: 'stool', walls: ['left', 'right'], optional: true }] }),
  sales: R('Sales floor', { order: 5, flex: 3, need: (p) => Math.max(3.0, Math.ceil((p.racks || 3) / 2) * 1.9 + 1.2),
    furnish: (p) => [{ type: 'counter', walls: ['right', 'left'], end: 'front' }, ...Array.from({ length: p.racks || 3 }, (_, i) => ({ type: 'rack', walls: i % 2 ? ['right', 'left'] : ['left', 'right'], end: 'back', optional: i > 0 }))] }),
  'open-office': R('Open office', { order: 5, flex: 3, need: (p) => Math.max(2.4, Math.ceil((p.desks || 2) / 2) * 1.5 + 0.4),
    furnish: (p) => [...Array.from({ length: p.desks || 2 }, (_, i) => ({ type: 'desk', walls: i % 2 ? ['right', 'left'] : ['left', 'right'], companion: 'chair' })), { type: 'cabinet', walls: ['back', 'front', 'left', 'right'], optional: true }, { type: 'ac', walls: ['back', 'front', 'left'] }] }),
  classroom: R('Classroom', { order: 5, flex: 3, need: (p) => Math.max(3.0, Math.ceil((p.desks || 8) / 2) * 1.5 + 1.2),
    furnish: (p) => [{ type: 'desk', walls: ['back'], companion: 'chair' }, ...Array.from({ length: p.desks || 8 }, (_, i) => ({ type: 'desk', walls: i % 2 ? ['right', 'left'] : ['left', 'right'], companion: 'chair', optional: i > 3 })), { type: 'ac', walls: ['front', 'back'] }] }),
  station: R('Salon', { order: 5, flex: 2, need: (p) => Math.max(2.6, Math.ceil((p.stations || 3) / 1) * 1.1 + 0.8),
    furnish: (p) => [...Array.from({ length: p.stations || 3 }, () => ({ type: 'cabinet', walls: ['left', 'right'], companion: 'chair-free' })), { type: 'basin', walls: ['back', 'right'] }, { type: 'sofa', walls: ['right', 'front'], optional: true }] }),
  post: R('Guard post', { order: 6, need: () => 2.0,
    furnish: () => [{ type: 'desk', walls: ['left', 'right', 'front'], companion: 'chair' }, { type: 'cabinet', walls: ['back', 'right'], optional: true }] }),
  living: R('Living room', { order: 6, flex: 2, need: () => 3.0,
    furnish: () => [{ type: 'sofa', walls: ['left', 'right'] }, { type: 'bistro', place: 'center', companion: 'chairs-2', optional: true }, { type: 'cabinet', walls: ['right', 'front'], optional: true }, { type: 'ac', walls: ['back', 'front'] }] }),
  seating: R('Seating', { order: 6, flex: 3, need: (p) => Math.max(2.4, Math.ceil(Math.ceil((p.seats || 8) / 2) / 2) * 1.75 + 0.6),
    furnish: (p) => [...Array.from({ length: Math.ceil((p.seats || 8) / 2) }, (_, i) => ({ type: 'bistro', walls: i % 2 ? ['right', 'left'] : ['left', 'right'], companion: 'stools', optional: i > 1 })), { type: 'ac', walls: ['back', 'front'] }] }),
  waiting: R('Waiting area', { order: 7, flex: 1, need: () => 2.4,
    furnish: () => [{ type: 'sofa', walls: ['left', 'right'] }, { type: 'chair', walls: ['right', 'left'], optional: true }, { type: 'chair', walls: ['right', 'left'], optional: true }] }),
  reception: R('Reception', { order: 8, flex: 1, need: () => 2.2,
    furnish: () => [{ type: 'reception', walls: ['left', 'right'], offset: 0.7, companion: 'behind' }, { type: 'chair', walls: ['right', 'left'], optional: true }, { type: 'chair', walls: ['right', 'left'], optional: true }] }),
  lobby: R('Lobby', { order: 8, need: () => 1.6, furnish: () => [] }),
  room: R('Room', { order: 5, flex: 1, need: () => 2.4, furnish: () => [] }),
};

const ROOM_RULES = [
  [/bath|en-?suite|shower/, 'bathroom'], [/toilet|\bwc\b|restroom|washroom|loo|lavatory/, 'toilet'],
  [/kitchenette|pantry|tea ?(point|room)|break ?room/, 'kitchenette'], [/kitchen/, 'kitchen'],
  [/server|archive|store|storage|stock/, 'store'], [/manager|\bmd\b|ceo|director|private office|boss|executive|principal/, 'manager'],
  [/meeting|board|conference/, 'meeting'], [/reception|front desk/, 'reception'], [/waiting/, 'waiting'],
  [/lobby|landing|hall/, 'lobby'], [/bunk|dorm/, 'bunkroom'], [/bed ?room|sleep/, 'bedroom'],
  [/living|lounge|sitting|parlou?r/, 'living'], [/consult|exam|treatment|nurse/, 'consult'],
  [/service|barista|serving|bar\b|counter/, 'service'], [/seating|dining|customer|eat/, 'seating'],
  [/sales|shop floor|display|retail|showroom/, 'sales'], [/kiosk/, 'kiosk'], [/salon|station|barber/, 'station'],
  [/security|guard|post|gate/, 'post'], [/class/, 'classroom'], [/office|workspace|work area|staff|open/, 'open-office'],
];
export function resolveRoomKind(input) {
  const s = lower(input);
  if (ROOM_KINDS[s]) return s;
  for (const [re, k] of ROOM_RULES) if (re.test(s)) return k;
  return 'room';
}

/* ============================================================
   Geometry helpers
   ============================================================ */

const spanOf = (m, wall) => (wall === 'front' || wall === 'back' ? m.wid : m.len);

/** Local rectangle occupied by an opening's hole (a zero-thickness strip on the wall line). */
function openingLocal(m, o) {
  const a = o.along - o.w / 2, b = o.along + o.w / 2;
  switch (o.wall) {
    case 'front': return { x0: m.len, x1: m.len, z0: a, z1: b };
    case 'back': return { x0: 0, x1: 0, z0: m.wid - b, z1: m.wid - a };
    case 'left': return { x0: a, x1: b, z0: 0, z1: 0 };
    default: return { x0: m.len - b, x1: m.len - a, z0: m.wid, z1: m.wid };
  }
}
const alongFromLocal = (m, wall, coord) => (wall === 'front' ? coord : wall === 'back' ? m.wid - coord : wall === 'left' ? coord : m.len - coord);
const inward = { front: [-1, 0], back: [1, 0], left: [0, 1], right: [0, -1] };

export function toSite(m, lx, lz) {
  return m.rot === 90 ? { x: m.x + m.wid - lz, z: m.z + lx } : { x: m.x + lx, z: m.z + lz };
}
export function rectToSite(m, r) {
  const a = toSite(m, r.x0, r.z0), b = toSite(m, r.x1, r.z1);
  return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) };
}
export function siteToLocal(m, x, z) {
  return m.rot === 90 ? { x: z - m.z, z: m.wid - (x - m.x) } : { x: x - m.x, z: z - m.z };
}
export function footprint(m, pad = 0) {
  const r = rectToSite(m, { x0: 0, x1: m.len, z0: 0, z1: m.wid });
  return { x0: r.x0 - pad, x1: r.x1 + pad, z0: r.z0 - pad, z1: r.z1 + pad };
}
const hit = (a, b, e = 0) => a.x0 < b.x1 - e && a.x1 > b.x0 + e && a.z0 < b.z1 - e && a.z1 > b.z0 + e;
const area = (r) => (r.x1 - r.x0) * (r.z1 - r.z0);

/** Local rect of an item with centre (x,z) and rotation r. */
function dims(type, r, it = {}) {
  const f = FITTINGS[type];
  const w = it.w ?? f.w, d = it.d ?? f.d;
  return r % 2 ? { dx: d, dz: w } : { dx: w, dz: d };
}
function itemRect(it) {
  const { dx, dz } = dims(it.type, it.r, it);
  return { x0: it.x - dx / 2, x1: it.x + dx / 2, z0: it.z - dz / 2, z1: it.z + dz / 2 };
}
const FRONT = [[0, 1], [-1, 0], [0, -1], [1, 0]];   // front direction for r = 0..3

/** Outside strip in front of a wall segment (site rect). */
function outsideRect(m, wall, along0, along1, depth) {
  const [ix, iz] = inward[wall];
  let r;
  if (wall === 'front' || wall === 'back') {
    const z0 = wall === 'front' ? along0 : m.wid - along1, z1 = wall === 'front' ? along1 : m.wid - along0;
    const x = wall === 'front' ? m.len : 0;
    r = { x0: Math.min(x, x - ix * (depth + WALL)), x1: Math.max(x, x - ix * (depth + WALL)), z0, z1 };
  } else {
    const x0 = wall === 'left' ? along0 : m.len - along1, x1 = wall === 'left' ? along1 : m.len - along0;
    const z = wall === 'left' ? 0 : m.wid;
    r = { x0, x1, z0: Math.min(z, z - iz * (depth + WALL)), z1: Math.max(z, z - iz * (depth + WALL)) };
  }
  // shift the strip off the shell wall so it only covers the outside
  if (wall === 'front') r.x0 += WALL; if (wall === 'back') r.x1 -= WALL;
  if (wall === 'left') r.z1 -= WALL; if (wall === 'right') r.z0 += WALL;
  return rectToSite(m, r);
}

/* ============================================================
   Source normalisation
   ============================================================ */

function normRooms(list) {
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const o = typeof raw === 'string' ? { name: raw } : { ...(raw || {}) };
    const text = `${o.name || ''} ${o.kind || ''}`;
    let count = num(o.count) || 1;
    const m = /^\s*(\d+|two|three|four)\s+/i.exec(o.name || '');
    if (m) count = { two: 2, three: 3, four: 4 }[m[1].toLowerCase()] || Number(m[1]);
    const kind = resolveRoomKind(o.kind || o.name || '');
    const level = o.level != null ? (/up|1|first|upper|top/.test(lower(o.level)) ? 'upper' : /ground|down|0/.test(lower(o.level)) ? 'ground' : 'any')
      : /upstairs|upper|first floor|level ?1|top floor/.test(lower(text)) ? 'upper' : /downstairs|ground/.test(lower(text)) ? 'ground' : 'any';
    const cleanName = String(o.name || '').replace(/^\s*(\d+|two|three|four)\s+/i, '').replace(/\b(upstairs|downstairs|on the ground floor|ground floor|first floor|upper floor|upper level)\b/ig, '').replace(/\s+/g, ' ').trim();
    const params = {};
    for (const k of ['desks', 'seats', 'bunks', 'stations', 'racks']) if (num(o[k])) params[k] = num(o[k]);
    for (let i = 0; i < Math.min(count, 6); i++) {
      const name = cleanName ? cleanName.replace(/s$/i, count > 1 ? '' : 's').replace(/^./, c => c.toUpperCase()) : ROOM_KINDS[kind].label;
      out.push({ kind, name: count > 1 ? `${name.replace(/s$/i, '')} ${i + 1}` : (cleanName ? cleanName.replace(/^./, c => c.toUpperCase()) : ROOM_KINDS[kind].label), level, length: num(o.length_m), params, furniture: o.furniture });
    }
  }
  return out;
}

function normOpening(o) {
  const type = resolveOpeningType(o?.type || o?.kind || 'window');
  if (!type) return null;
  return {
    type, wall: resolveWall(o.wall) || null, along: num(o.along_m ?? o.along), position: lower(o.position) || null,
    w: num(o.width_m ?? o.w), h: num(o.height_m ?? o.h), sill: num(o.sill_m ?? o.sill), room: o.room || null, id: o.id || null,
  };
}
function normFitting(f) {
  const type = resolveFittingType(f?.type || f?.kind || '');
  if (!type) return null;
  return {
    type, x: num(f.x_m ?? f.x), z: num(f.z_m ?? f.z), r: num(f.rotation ?? f.rot ?? f.r), room: f.room || null,
    d: type === 'partition' ? num(f.length_m) : undefined, id: f.id || null,
  };
}

function normModule(src, i) {
  const size = resolveSize(src.size) || (num(src.length_m) ? 'custom' : null) || '20ft';
  const base = SIZES[size] || { name: 'Custom unit', short: 'Custom', len: 6, wid: 2.4, hgt: 2.4, shell: 'fabricate' };
  const mod = {
    id: src.id || `m${i + 1}`,
    size,
    len: r3(clamp(num(src.length_m) ?? base.len, 2, 16)),
    wid: r3(clamp(num(src.width_m) ?? base.wid, 1.8, 4)),
    hgt: r3(clamp(num(src.height_m) ?? base.hgt, 2.1, 3.2)),
    x: num(src.x_m ?? src.x), z: num(src.z_m ?? src.z),
    level: clamp(Math.round(num(src.level) ?? 0), 0, 2),
    rot: /90|270|rot|turn|perp/.test(String(src.rotation ?? src.rot ?? '')) ? 90 : 0,
    color: resolveColor(src.color) || null,
    use: src.use ? resolveUse(src.use) : null,
    name: src.name || null,
    rooms: normRooms(src.rooms),
    openings: (src.openings || []).map(normOpening).filter(Boolean),
    fittings: (src.fittings || []).map(normFitting).filter(Boolean),
    suppress: Array.isArray(src.suppress) ? [...src.suppress] : [],
    entrance: src.entrance ?? null,
    glassWall: src.glassWall ? resolveWall(src.glassWall) : null,
    autoOpenings: src.autoOpenings ?? (src.auto_layout === true || !(src.openings || []).length),
    autoFurnish: src.autoFurnish ?? (src.auto_layout === true || !(src.fittings || []).some(f => resolveFittingType(f?.type || '') !== 'partition')),
  };
  if (size !== 'custom' && (num(src.length_m) || num(src.width_m) || num(src.height_m))) mod.size = 'custom';
  return mod;
}

function normExtras(e = {}, brief = {}) {
  const style = lower([...(brief.style || []), brief.notes || ''].join(' '));
  const pick = (v, fallback) => (v === undefined || v === null || v === '' ? fallback : v);
  const cl = lower(pick(e.cladding, /timber|wood/.test(style) ? 'timber' : /composite|acp|aluco|cladd/.test(style) ? 'composite' : 'none'));
  return {
    stairs: pick(e.stairs, 'auto'),
    roofDeck: Boolean(pick(e.roof_deck ?? e.roofDeck, /roof ?(deck|terrace|top)|rooftop/.test(style))),
    canopy: lower(pick(e.canopy === true ? 'entrance' : e.canopy === false ? 'none' : e.canopy, /canopy|awning|shade/.test(style) ? 'entrance' : 'auto')),
    pitchedRoof: Boolean(pick(e.pitched_roof ?? e.pitchedRoof, /pitch|gable|sloped roof/.test(style))),
    cladding: /timber|wood/.test(cl) ? 'timber' : /comp|acp|alu/.test(cl) ? 'composite' : 'none',
    glassWall: pick(e.glass_wall ?? e.glassWall, /glass|curtain|shop ?front|modern/.test(style) ? true : 'auto'),
    deck: pick(e.deck, /deck|verandah|veranda|terrace|porch|patio/.test(style) ? true : false),
  };
}

export function normalizeSource(args = {}) {
  const b = args.brief || {};
  const briefUse = b.use || args.use || '';
  const brief = {
    use: String(briefUse || ''),
    useKind: resolveUse(briefUse) || null,
    headcount: num(b.headcount ?? b.staff ?? b.people ?? b.seats),
    rooms: normRooms(b.rooms),
    size: resolveSize(b.size) || null,
    containers: num(b.containers ?? b.count),
    levels: num(b.levels ?? b.storeys ?? b.floors),
    arrangement: lower(b.arrangement) || null,
    budget: num(b.budget_ngn ?? b.budget),
    color: resolveColor(b.color ?? b.colour ?? args.color) || null,
    style: Array.isArray(b.style) ? b.style.map(String) : b.style ? [String(b.style)] : [],
    notes: String(b.notes || ''),
  };
  const modules = Array.isArray(args.modules) ? args.modules.map(normModule) : [];
  return {
    title: args.title || null,
    brief,
    modules,
    extras: normExtras(args.extras || {}, brief),
    specLevel: ['economy', 'standard', 'premium'].includes(lower(args.spec_level)) ? lower(args.spec_level) : null,
    clientShell: Boolean(args.client_supplies_container),
    units: lower(args.units) === 'm' ? 'm' : 'ft',
  };
}

/* ============================================================
   Programme: which rooms, how big, on which level
   ============================================================ */

function room(kind, extra = {}) {
  return { kind, name: extra.name || ROOM_KINDS[kind].label, level: extra.level || 'any', params: extra.params || {}, length: extra.length };
}

function buildProgram(brief) {
  const use = brief.useKind || 'office';
  const n = brief.headcount;
  const rooms = brief.rooms.map(r => ({ ...r, params: { ...r.params } }));
  const has = (k) => rooms.some(r => r.kind === k);
  const add = (kind, extra) => rooms.push(room(kind, extra));
  switch (use) {
    case 'office': case 'site-office': {
      const staff = n ?? (use === 'site-office' ? 4 : 3);
      const managers = rooms.filter(r => r.kind === 'manager').length;
      if (!has('open-office') && staff - managers > 0) add('open-office', { params: { desks: Math.max(1, staff - managers) } });
      for (const r of rooms) if (r.kind === 'open-office' && !r.params.desks) r.params.desks = Math.max(1, staff - managers);
      for (const r of rooms) if (r.kind === 'meeting' && !r.params.seats) r.params.seats = clamp(staff + 2, 4, 8);
      if (use === 'site-office' && !has('store')) add('store');
      if (!has('toilet') && !has('bathroom') && staff >= 4) add('toilet');
      break;
    }
    case 'cafe': {
      if (!has('service')) add('service');
      if (!has('seating')) add('seating', { params: { seats: n || 8 } });
      for (const r of rooms) if (r.kind === 'seating' && !r.params.seats) r.params.seats = n || 8;
      if (!has('toilet') && !has('bathroom')) add('toilet');
      break;
    }
    case 'kiosk': if (!has('kiosk')) add('kiosk'); break;
    case 'shop': if (!has('sales')) add('sales', { params: { racks: 4 } }); break;
    case 'home': {
      if (!has('living')) add('living');
      if (!has('bedroom')) add('bedroom');
      if (!has('kitchen') && !has('kitchenette')) add('kitchenette', { name: 'Kitchen' });
      if (!has('bathroom') && !has('toilet')) add('bathroom');
      break;
    }
    case 'bunkhouse': {
      const beds = n || 8;
      if (!has('bunkroom')) {
        const bunks = Math.ceil(beds / 2);
        const perRoom = 4;
        const k = Math.ceil(bunks / perRoom);
        for (let i = 0; i < k; i++) add('bunkroom', { name: k > 1 ? `Bunk room ${i + 1}` : 'Bunk room', params: { bunks: Math.min(perRoom, bunks - i * perRoom) } });
      }
      if (!has('bathroom')) add('bathroom');
      break;
    }
    case 'clinic': if (!has('consult')) add('consult'); if (!has('waiting') && !has('reception')) add('waiting'); if (!has('toilet')) add('toilet'); break;
    case 'salon': if (!has('station')) add('station', { params: { stations: n || 3 } }); break;
    case 'gatehouse': if (!has('post')) add('post'); break;
    case 'classroom': if (!has('classroom')) add('classroom', { params: { desks: n || 10 } }); break;
    case 'ablution': {
      if (!rooms.length) { add('toilet', { name: 'Toilet 1' }); add('toilet', { name: 'Toilet 2' }); add('bathroom', { name: 'Shower room' }); }
      break;
    }
    case 'storage': if (!has('storage')) add('storage', { params: { racks: 6 } }); break;
    default: if (!rooms.length) add('room');
  }
  return rooms;
}

const needOf = (r) => r.length || ROOM_KINDS[r.kind].need(r.params || {});
const needTotal = (rooms) => rooms.reduce((s, r) => s + needOf(r), 0) + Math.max(0, rooms.length - 1) * PART_T;

function normArrangement(a, count) {
  const s = lower(a);
  if (/\bl\b|l-?shape|corner/.test(s)) return 'L';
  if (/\bt\b|t-?shape/.test(s)) return 'T';
  if (/stack|storey|story|level|upstairs|double/.test(s)) return 'stacked';
  if (/row|end|line|inline/.test(s)) return 'row';
  if (/side|parallel|twin|combined|joined|wide/.test(s)) return 'side';
  if (/single|one/.test(s)) return 'single';
  return count > 1 ? 'side' : 'single';
}

/** Split rooms across modules in order, keeping each room whole. */
function fillModules(rooms, mods) {
  const sorted = [...rooms].sort((a, b) => ROOM_KINDS[a.kind].order - ROOM_KINDS[b.kind].order);
  const out = mods.map(() => []);
  let i = 0;
  for (const r of sorted) {
    while (i < mods.length - 1 && out[i].length && needTotal([...out[i], r]) > mods[i].len + 0.05) i++;
    out[i].push(r);
  }
  // no empty modules: borrow from the fullest, or split a flexible room
  for (let k = 0; k < out.length; k++) {
    if (out[k].length) continue;
    const donor = out.reduce((best, list, j) => (list.length > (out[best]?.length || 0) ? j : best), 0);
    if (out[donor].length > 1) out[k].push(out[donor].pop());
    else if (out[donor].length === 1) {
      const r = out[donor][0];
      const p = r.params || {};
      const half = (v) => (v ? Math.max(1, Math.floor(v / 2)) : v);
      const second = { ...r, name: `${r.name} 2`, params: { ...p, desks: half(p.desks), seats: half(p.seats), bunks: half(p.bunks) } };
      r.params = { ...p, desks: p.desks ? p.desks - half(p.desks) : p.desks, seats: p.seats ? p.seats - half(p.seats) : p.seats, bunks: p.bunks ? p.bunks - half(p.bunks) : p.bunks };
      out[k].push(second);
    }
  }
  return out;
}

function pickSize(need, brief) {
  if (brief.size) return brief.size;
  if (need <= SIZES['10ft'].len && /kiosk|gatehouse/.test(brief.useKind || '')) return '10ft';
  if (need <= SIZES['20ft'].len + 0.05) return '20ft';
  return '40ft';
}

function planFromBrief(src, warnings) {
  const { brief } = src;
  let rooms = buildProgram(brief);
  let levels = clamp(Math.round(brief.levels || (rooms.some(r => r.level === 'upper') ? 2 : 1)), 1, 2);
  if ((brief.levels || 0) > 2) warnings.push({ level: 'warn', text: 'Designs go up to two storeys here; a third level needs an engineer’s structural check.' });
  let arrangement = normArrangement(brief.arrangement, brief.containers || 1);
  if (levels > 1 && ['single', 'side'].includes(arrangement) && !brief.arrangement) arrangement = 'stacked';
  if (arrangement === 'stacked') levels = 2;

  let upper = levels > 1 ? rooms.filter(r => r.level === 'upper') : [];
  let ground = rooms.filter(r => !upper.includes(r));
  if (levels > 1 && !upper.length) {
    const privateKinds = ['manager', 'meeting', 'bedroom', 'bathroom', 'consult', 'bunkroom'];
    upper = ground.filter(r => privateKinds.includes(r.kind));
    if (!upper.length || upper.length === ground.length) {
      const flex = ground.find(r => ROOM_KINDS[r.kind].flex >= 2) || ground[ground.length - 1];
      const p = flex.params || {};
      const half = (v) => (v ? Math.max(1, Math.floor(v / 2)) : v);
      const up = { ...flex, name: `${flex.name} (upper)`, params: { ...p, desks: half(p.desks), seats: half(p.seats), bunks: half(p.bunks) } };
      flex.params = { ...p, desks: p.desks ? p.desks - half(p.desks) : p.desks, seats: p.seats ? p.seats - half(p.seats) : p.seats, bunks: p.bunks ? p.bunks - half(p.bunks) : p.bunks };
      upper = [up];
      ground = ground.filter(r => r !== up);
    } else ground = ground.filter(r => !upper.includes(r));
  }
  if (levels > 1 && !upper.some(r => ['lobby', 'meeting', 'open-office', 'living', 'reception', 'waiting'].includes(r.kind)) && needTotal(upper) < 4) {
    upper.push(room('lobby', { name: 'Landing lobby' }));
  }

  // how many modules per level
  const perLevelRequested = brief.containers ? Math.max(1, Math.round(brief.containers / levels)) : null;
  const want = (arrangement === 'L' || arrangement === 'T' || arrangement === 'side' || arrangement === 'row') ? Math.max(2, perLevelRequested || 2) : (perLevelRequested || 1);
  const needG = needTotal(ground), needU = needTotal(upper);
  let size = brief.size;
  if (!size) {
    const perModule = Math.max(needG, needU) / (want || 1);
    size = pickSize(perModule, brief);
  }
  let countG = want;
  if (!brief.containers && arrangement !== 'L' && arrangement !== 'T') {
    // a size the person named is a promise: squeeze before adding units
    countG = Math.max(want, Math.ceil(needG / (SIZES[size].len * (brief.size ? 1.25 : 1) + 0.05)));
    if (countG > want && arrangement === 'single') arrangement = 'side';
  }
  countG = clamp(countG, 1, 4);
  const countU = levels > 1 ? clamp(Math.ceil(needU / (SIZES[size].len + 0.05)), 1, countG) : 0;

  const S = SIZES[size];
  const color = brief.color || 'green';
  const mods = [];
  for (let i = 0; i < countG; i++) mods.push({ size, len: S.len, wid: S.wid, hgt: S.hgt, level: 0, rot: 0, x: 0, z: 0, color });
  // arrange the ground floor
  if (arrangement === 'L' && countG >= 2) {
    mods[1].rot = 90; mods[1].x = mods[0].len + GAP; mods[1].z = 0;
    for (let i = 2; i < countG; i++) { mods[i].x = 0; mods[i].z = -(i - 1) * (S.wid + GAP); }
  } else if (arrangement === 'T' && countG >= 2) {
    mods[1].rot = 90; mods[1].x = (mods[0].len - S.wid) / 2; mods[1].z = S.wid + GAP;
  } else if (arrangement === 'row') {
    mods.forEach((m, i) => { m.x = i * (S.len + GAP); });
  } else {
    mods.forEach((m, i) => { m.z = i * (S.wid + GAP); });
  }
  for (let i = 0; i < countU; i++) mods.push({ ...mods[i], level: 1 });

  // rooms onto modules; the public room ends up in the last ground module
  const gMods = mods.filter(m => m.level === 0), uMods = mods.filter(m => m.level === 1);
  fillModules(ground, gMods).forEach((list, i) => { gMods[i].rooms = list; });
  if (uMods.length) fillModules(upper, uMods).forEach((list, i) => { uMods[i].rooms = list; });

  const joined = countG > 1;
  gMods.forEach((m, i) => { m.entrance = joined && i < gMods.length - 1 ? 'none' : 'auto'; });
  return { modules: mods.map((m, i) => normModule({ size: m.size, rotation: m.rot === 90 ? '90' : 0 }, i)).map((nm, i) => ({
    ...nm, ...mods[i], id: `m${i + 1}`, rooms: mods[i].rooms || [], openings: [], fittings: [], suppress: [], glassWall: null, planned: true,
  })), arrangement, levels };
}

/* ============================================================
   Site: overlaps, levels, joins, stairs
   ============================================================ */

function resolveOverlaps(mods, warnings) {
  for (let i = 0; i < mods.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = mods[i], b = mods[j];
      if (a.level !== b.level) continue;
      const fa = footprint(a, WALL), fb = footprint(b, WALL);
      if (!hit(fa, fb, 0.01)) continue;
      const dx = fb.x1 - fa.x0, dz = fb.z1 - fa.z0;
      if (dz <= dx) a.z += dz; else a.x += dx;
      warnings.push({ level: 'info', text: `Moved ${a.name} so it doesn’t overlap ${b.name}.` });
      j = -1;   // re-check against everything
    }
  }
}

function computeLevels(mods) {
  const top = Math.max(...mods.map(m => m.level));
  const elev = [0];
  for (let L = 1; L <= top + 1; L++) {
    const below = mods.filter(m => m.level === L - 1);
    elev[L] = elev[L - 1] + (below.length ? Math.max(...below.map(m => m.hgt)) + 0.2 : 2.6);
  }
  for (const m of mods) { m.elev = r3(elev[m.level]); m.extH = r3(m.hgt + 0.2); }
  return elev;
}

/** Walls of different modules that face each other closely become joins (cut-outs). */
function findJoins(mods) {
  const joins = [];
  const segs = (m) => WALL_IDS.map(wall => {
    const span = spanOf(m, wall);
    const a = alongPoint(m, wall, 0), b = alongPoint(m, wall, span);
    const pa = toSite(m, a.x, a.z), pb = toSite(m, b.x, b.z);
    const [ix, iz] = inward[wall];
    const n = m.rot === 90 ? { x: iz, z: -ix } : { x: -ix, z: -iz };   // outward, site
    return { m, wall, pa, pb, n };
  });
  for (let i = 0; i < mods.length; i++) {
    for (let j = i + 1; j < mods.length; j++) {
      const A = mods[i], B = mods[j];
      if (A.level !== B.level) continue;
      for (const sa of segs(A)) for (const sb of segs(B)) {
        if (Math.abs(sa.n.x + sb.n.x) > 0.01 || Math.abs(sa.n.z + sb.n.z) > 0.01) continue;
        const alongX = Math.abs(sa.n.x) < 0.5;   // wall runs along X
        const offA = alongX ? sa.pa.z : sa.pa.x, offB = alongX ? sb.pa.z : sb.pa.x;
        const gap = (offB - offA) * (alongX ? sa.n.z : sa.n.x);
        if (gap < -0.01 || gap > 0.4) continue;
        const [a0, a1] = alongX ? [Math.min(sa.pa.x, sa.pb.x), Math.max(sa.pa.x, sa.pb.x)] : [Math.min(sa.pa.z, sa.pb.z), Math.max(sa.pa.z, sa.pb.z)];
        const [b0, b1] = alongX ? [Math.min(sb.pa.x, sb.pb.x), Math.max(sb.pa.x, sb.pb.x)] : [Math.min(sb.pa.z, sb.pb.z), Math.max(sb.pa.z, sb.pb.z)];
        const lo = Math.max(a0, b0), hi = Math.min(a1, b1);
        if (hi - lo < 1.2) continue;
        joins.push({ a: A.id, wallA: sa.wall, b: B.id, wallB: sb.wall, alongX, lo, hi, line: (offA + offB) / 2 });
      }
    }
  }
  return joins;
}
function alongPoint(m, wall, along) {
  switch (wall) {
    case 'front': return { x: m.len, z: along };
    case 'back': return { x: 0, z: m.wid - along };
    case 'left': return { x: along, z: 0 };
    default: return { x: m.len - along, z: m.wid };
  }
}
/** Along-position on a module's wall for a site coordinate on the wall line. */
function alongForSite(m, wall, sx, sz) {
  const p = siteToLocal(m, sx, sz);
  return alongFromLocal(m, wall, wall === 'front' || wall === 'back' ? p.z : p.x);
}

function stairFlight(rise) {
  const risers = Math.max(3, Math.ceil(rise / 0.18));
  return { risers, run: r3((risers - 1) * 0.25) };
}

/** Place one straight flight + top landing along a long wall of `host`, outside. */
function placeStair(host, fromY, toY, mods, taken, groundDoors, prefer) {
  const { risers, run } = stairFlight(toY - fromY);
  const LAND = 1.2, W = 0.95;
  const total = run + LAND;
  const sides = prefer?.side ? [prefer.side, prefer.side === 'right' ? 'left' : 'right'] : ['right', 'left'];
  for (const side of sides) {
    for (const dir of [1, -1]) {
      // top landing at the chosen end of the host wall
      const xTop = dir > 0 ? host.len : 0;
      const x0 = dir > 0 ? xTop - total : xTop, x1 = dir > 0 ? xTop : xTop + total;
      const zA = side === 'right' ? host.wid + WALL : -WALL - W, zB = zA + W;
      const whole = rectToSite(host, { x0, x1, z0: zA, z1: zB });
      if (mods.some(m => m.level <= host.level && hit(footprint(m, WALL), whole, 0.005))) continue;
      if (taken.some(t => hit(t, whole, -0.02))) continue;
      if (groundDoors.some(d => hit(d, whole))) continue;
      const landLocal = dir > 0 ? { x0: xTop - LAND, x1: xTop } : { x0: xTop, x1: xTop + LAND };
      const flightLocal = dir > 0 ? { x0, x1: xTop - LAND } : { x0: xTop + LAND, x1 };
      const doorAlong = alongFromLocal(host, side, (landLocal.x0 + landLocal.x1) / 2);
      return {
        host: host.id, side, dir, risers, run, fromY: r3(fromY), toY: r3(toY), width: W,
        flight: rectToSite(host, { ...flightLocal, z0: zA, z1: zB }),
        landing: rectToSite(host, { ...landLocal, z0: zA, z1: zB }),
        ascent: siteDir(host, dir),
        doorAlong: r3(doorAlong), rect: whole,
      };
    }
  }
  return null;
}
function siteDir(m, dir) {
  // direction of +X local in site, times dir
  return m.rot === 90 ? { x: 0, z: dir } : { x: dir, z: 0 };
}

/* ============================================================
   Module layout: rooms, partitions, openings, furniture
   ============================================================ */

function layoutRooms(m, warnings) {
  let rooms = m.rooms.length ? m.rooms : [];
  const manualParts = m.fittings.filter(f => f.type === 'partition' && Number.isFinite(f.x) && !(f.r % 2));
  if (!rooms.length && manualParts.length) {
    const xs = manualParts.map(p => p.x).sort((a, b) => a - b);
    rooms = xs.concat([m.len + PART_T / 2]).map((x, i) => ({ kind: 'room', name: `Room ${i + 1}`, length: x - PART_T / 2 - (i ? xs[i - 1] + PART_T / 2 : 0), params: {} }));
  }
  if (!rooms.length) rooms = [room(m.use ? (buildProgram({ useKind: m.use, rooms: [] })[0]?.kind || 'room') : 'room')];
  rooms = rooms.map(r => ({ ...r, params: { ...(r.params || {}) } }));
  // Too long for the unit? Fold a reception / waiting area into the main room first.
  if (needTotal(rooms) > m.len + 0.01) {
    const host = rooms.find(r => ['open-office', 'sales', 'seating', 'living', 'station', 'consult'].includes(r.kind));
    for (const kind of ['lobby', 'waiting', 'reception']) {
      const ix = rooms.findIndex(r => r.kind === kind);
      if (ix < 0 || !host || needTotal(rooms) <= m.len + 0.01) continue;
      const [gone] = rooms.splice(ix, 1);
      host.merged = [...(host.merged || []), gone.kind];
      if (gone.kind === 'reception' && host.kind === 'open-office' && (host.params.desks || 2) > 1) host.params.desks = (host.params.desks || 2) - 1;
      host.name = `${host.name} & ${gone.name.toLowerCase()}`;
      warnings.push({ level: 'info', text: `${m.name} is too short for a separate ${gone.name.toLowerCase()}, so it shares the ${ROOM_KINDS[host.kind].label.toLowerCase()}.` });
    }
  }
  const n = rooms.length;
  const avail = m.len - (n - 1) * PART_T;
  const need = rooms.map(needOf);
  const fixed = rooms.map(r => Boolean(r.length));
  const total = need.reduce((a, b) => a + b, 0);
  let lens;
  if (total > avail + 0.001) {
    const over = total - avail;
    const give = rooms.map((r, i) => (fixed[i] || !ROOM_KINDS[r.kind].flex ? 0 : need[i] * 0.3));
    const giveSum = give.reduce((a, b) => a + b, 0);
    if (giveSum >= over) lens = need.map((v, i) => v - over * give[i] / giveSum);
    else {
      const scale = avail / total;
      lens = need.map(v => v * scale);
      warnings.push({ level: 'warn', text: `${m.name} is tight: the rooms asked for need about ${r2(total + (n - 1) * PART_T)} m of length but the unit has ${r2(m.len)} m. Consider a longer unit or fewer rooms.` });
    }
  } else {
    const extra = avail - total;
    let weights = rooms.map((r, i) => (fixed[i] ? 0 : ROOM_KINDS[r.kind].flex));
    if (!weights.some(Boolean)) weights = rooms.map((r, i) => (fixed[i] ? 0 : ROOM_KINDS[r.kind].habitable ? 1 : 0.2));
    if (!weights.some(Boolean)) weights = rooms.map(() => 1);
    const wsum = weights.reduce((a, b) => a + b, 0);
    lens = need.map((v, i) => v + extra * weights[i] / wsum);
  }
  let x = 0;
  const out = rooms.map((r, i) => {
    const x0 = x, x1 = i === n - 1 ? m.len : x + lens[i];
    x = x1 + PART_T;
    return { id: `${m.id}-r${i + 1}`, name: r.name, kind: r.kind, params: r.params || {}, furniture: r.furniture, ...(r.merged ? { merged: r.merged } : {}), x0: r3(x0), x1: r3(x1), z0: 0, z1: m.wid };
  });
  // partitions between rooms with a door in the middle
  const parts = [];
  for (let i = 0; i < n - 1; i++) {
    const px = (out[i].x1 + out[i + 1].x0) / 2;
    const dw = Math.min(0.8, m.wid - 0.6);
    const a = out[i], b = out[i + 1];
    // toilets and stores take their own door swing; otherwise it opens into the bigger room
    const small = (r) => ['toilet', 'bathroom', 'store'].includes(r.kind);
    const swingInto = small(a) && !small(b) ? i : small(b) && !small(a) ? i + 1 : (b.x1 - b.x0) >= (a.x1 - a.x0) ? i + 1 : i;
    parts.push({ id: `${m.id}-p${i + 1}`, kind: 'fitting', type: 'partition', x: r3(px), z: r3(m.wid / 2), r: 0, w: PART_T, d: m.wid, h: r3(Math.min(2.3, m.hgt)),
      door: { z0: r3(m.wid - 0.12 - dw), z1: r3(m.wid - 0.12), swing: swingInto === i + 1 ? 1 : -1 }, rooms: [a.id, b.id] });
  }
  return { rooms: out, parts };
}

const roomAt = (rooms, x) => rooms.find(r => x >= r.x0 - 0.06 && x <= r.x1 + 0.06) || rooms[0];

/** Intervals (in `along`) on a wall that openings must stay clear of. */
function wallBlocks(m, wall, openings, parts, skip = null) {
  const span = spanOf(m, wall);
  const blocks = [[-1, 0.12], [span - 0.12, span + 1]];
  for (const o of openings) if (o !== skip && o.wall === wall) blocks.push([o.along - o.w / 2 - 0.12, o.along + o.w / 2 + 0.12]);
  if (wall === 'left' || wall === 'right') {
    for (const p of parts) { const a = alongFromLocal(m, wall, p.x); blocks.push([a - 0.12, a + 0.12]); }
  }
  return blocks;
}
function fitsAt(blocks, a, w) { return blocks.every(([b0, b1]) => a + w / 2 <= b0 || a - w / 2 >= b1); }
function findSpot(m, wall, w, openings, parts, prefer, range = null, skip = null) {
  const span = spanOf(m, wall);
  const blocks = wallBlocks(m, wall, openings, parts, skip);
  const lo = Math.max(w / 2 + 0.12, range ? range[0] + w / 2 : 0), hi = Math.min(span - w / 2 - 0.12, range ? range[1] - w / 2 : span);
  if (hi < lo - 1e-6) return null;
  const p = clamp(prefer ?? (lo + hi) / 2, lo, hi);
  for (let k = 0; k <= Math.ceil((hi - lo) / 0.05) * 2 + 1; k++) {
    const a = p + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.05;
    if (a < lo - 1e-6 || a > hi + 1e-6) continue;
    if (fitsAt(blocks, a, w)) return r3(a);
  }
  return null;
}
/** along-range of a room on a long wall */
function roomRange(m, wall, rm) {
  const a = alongFromLocal(m, wall, rm.x0), b = alongFromLocal(m, wall, rm.x1);
  return [Math.min(a, b), Math.max(a, b)];
}

function makeOpening(m, type, wall, along, extra = {}) {
  const c = OPENINGS[type];
  const w = r3(extra.w ?? c.w);
  const h = r3(Math.min(extra.h ?? c.h, m.hgt - 0.08));
  const sill = r3(clamp(extra.sill ?? c.sill, 0, Math.max(0, m.hgt - h - 0.05)));
  return { id: extra.id || null, kind: 'opening', type, wall, along: r3(along), w, h, sill, auto: extra.auto !== false, ...(extra.to ? { to: extra.to } : {}) };
}

function outsideFree(m, wall, along, w, ctx, depth = 1.1) {
  const zone = outsideRect(m, wall, along - w / 2 - 0.2, along + w / 2 + 0.2, depth);
  if (ctx.mods.some(o => o !== m && o.level === m.level && hit(footprint(o, WALL), zone))) return false;
  if (m.level === 0 && ctx.stairs.some(s => hit(s.rect, zone))) return false;
  return true;
}
/** Largest run of [a0, a1] along a wall whose outside is open (not against another unit or a stair). */
function exteriorRun(m, wall, a0, a1, ctx, depth = 0.6, around = null) {
  const step = 0.1;
  const free = [];
  for (let a = a0; a < a1 - 1e-6; a += step) {
    const zone = outsideRect(m, wall, a, Math.min(a1, a + step), depth);
    free.push(!ctx.mods.some(o => o !== m && o.level === m.level && hit(footprint(o, WALL), zone, 0.001)) && !ctx.stairs.some(s => hit(s.rect, zone, 0.001)));
  }
  let best = null, start = null;
  const close = (i) => {
    if (start == null) return;
    const run = [a0 + start * step, Math.min(a1, a0 + i * step)];
    const has = around == null || (around >= run[0] && around <= run[1]);
    const len = run[1] - run[0];
    if (!best || (has && !best.has) || (has === best.has && len > best.len)) best = { run, has, len };
    start = null;
  };
  free.forEach((f, i) => { if (f && start == null) start = i; if (!f) close(i); });
  close(free.length);
  return best && best.len >= 0.8 ? best.run : null;
}

function wallExterior(m, wall, a0, a1, ctx) {
  const zone = outsideRect(m, wall, a0, a1, 0.3);
  return !ctx.mods.some(o => o !== m && o.level === m.level && hit(footprint(o, WALL), zone));
}

function layoutOpenings(m, rooms, parts, ctx, warnings, choice = 0) {
  const openings = [];
  const add = (o) => { o.id = o.id || `${m.id}-o${openings.length + 1}`; openings.push(o); return o; };
  const auto = m.autoOpenings !== false;
  const suppressed = new Set(m.suppress);

  // 1. forced: joins to neighbouring units and the stair landing door
  for (const c of ctx.cutouts.filter(c => c.module === m.id)) add(makeOpening(m, 'cutout', c.wall, c.along, { w: c.w, to: c.to, id: `${m.id}-j${c.n}` }));
  if (ctx.landing[m.id]) {
    const L = ctx.landing[m.id];
    const a = findSpot(m, L.wall, 0.9, openings, parts, L.along, [L.along - 0.7, L.along + 0.7]);
    if (a != null) add(makeOpening(m, 'personnel-door', L.wall, a, { id: `${m.id}-landing` }));
  }

  // 2. what the person asked for
  for (const src of m.openings) {
    const type = src.type;
    const c = OPENINGS[type];
    let wall = src.wall;
    let targetRoom = src.room ? rooms.find(r => lower(r.name).includes(lower(src.room)) || r.kind === resolveRoomKind(src.room)) : null;
    if (!wall) wall = c.door ? 'right' : 'left';
    const span = spanOf(m, wall);
    const w = Math.min(src.w ?? (type === 'glass-wall' ? span - 0.3 : c.w), span - 0.3);
    let range = null;
    if (targetRoom && (wall === 'left' || wall === 'right')) range = roomRange(m, wall, targetRoom);
    let prefer = src.along;
    if (prefer == null) {
      if (src.position === 'start') prefer = w / 2 + 0.15;
      else if (src.position === 'end') prefer = span - w / 2 - 0.15;
      else if (range) prefer = (range[0] + range[1]) / 2;
      else prefer = span / 2;
    }
    let a = findSpot(m, wall, w, openings, parts, prefer, range);
    if (a == null && range) a = findSpot(m, wall, w, openings, parts, prefer);
    if (a == null) { warnings.push({ level: 'warn', text: `No room for the ${c.name.toLowerCase()} on the ${wall} wall of ${m.name}; it was left out.` }); continue; }
    if (src.along != null && Math.abs(a - src.along) > 0.06) warnings.push({ level: 'info', text: `Moved the ${c.name.toLowerCase()} on the ${wall} wall of ${m.name} to ${r2(a)} m so it clears the corners, partitions and other openings.` });
    add(makeOpening(m, type, wall, a, { w, h: src.h, sill: src.sill, auto: false, id: src.id }));
  }

  if (!auto) return openings;

  // 3. entrance
  const use = ctx.useKind;
  const front = rooms[rooms.length - 1];
  const hasDoor = () => openings.some(o => OPENINGS[o.type].door || o.type === 'cutout');
  const glassWall = m.glassWall || (ctx.extras.glassWall === true || (ctx.extras.glassWall === 'auto' && ['cafe', 'shop'].includes(use)) ? 'pending' : null);
  if (m.level === 0 && m.entrance !== 'none' && !openings.some(o => OPENINGS[o.type].door)) {
    const type = use === 'storage' ? 'roller-door' : ['cafe', 'shop'].includes(use) ? 'glass-door' : use === 'kiosk' ? 'personnel-door' : 'personnel-door';
    const w = OPENINGS[type].w;
    const walls = ctx.entranceWalls[m.id] || (use === 'storage' ? ['front', 'right', 'left'] : ['right', 'front', 'left', 'back']);
    const valids = [];
    for (const wall of walls) {
      const span = spanOf(m, wall);
      let range = null, prefer;
      if (wall === 'left' || wall === 'right') {
        const target = use === 'kiosk' ? rooms[0] : front;
        range = roomRange(m, wall, target);
        prefer = type === 'glass-door' ? (range[0] + range[1]) / 2 : wall === 'right' ? range[0] + w / 2 + 0.35 : range[1] - w / 2 - 0.35;
      } else {
        if ((wall === 'front' && front !== rooms[rooms.length - 1]) || (wall === 'back' && rooms.length > 1 && use !== 'kiosk')) continue;
        prefer = span / 2;
      }
      for (const cand of [prefer, ...(range ? [range[0] + (range[1] - range[0]) / 2, range[0] + w / 2 + 0.2, range[1] - w / 2 - 0.2] : [])]) {
        const a = findSpot(m, wall, w, openings, parts, cand, range);
        if (a != null && outsideFree(m, wall, a, w, ctx) && !valids.some(v => v.wall === wall && Math.abs(v.a - a) < 0.3)) valids.push({ wall, a });
      }
    }
    m._entranceOptions = valids.length;
    const placed = valids[Math.min(choice, valids.length - 1)] || null;
    if (placed) {
      add(makeOpening(m, type, placed.wall, placed.a, { id: `${m.id}-entrance` }));
      if (use === 'kiosk') {
        const range = roomRange(m, placed.wall === 'front' || placed.wall === 'back' ? 'right' : placed.wall === 'right' ? 'left' : 'right', front);
        const wall = placed.wall === 'right' ? 'left' : 'right';
        const a = findSpot(m, wall, 1.5, openings, parts, (range[0] + range[1]) / 2);
        if (a != null) add(makeOpening(m, 'serving-hatch', wall, a));
      }
    }
  }
  if (m.level === 0 && m.entrance !== 'none' && !hasDoor()) warnings.push({ level: 'warn', text: `${m.name} has no door that opens to the outside.` });

  // 4. glass curtain wall on the entrance side of the public room
  let glazed = null;
  if (glassWall && m.level === 0 && m.entrance !== 'none') {
    const door = openings.find(o => o.id === `${m.id}-entrance`);
    glazed = m.glassWall || (door && (door.wall === 'left' || door.wall === 'right') ? door.wall : 'right');
    const range = roomRange(m, glazed, front);
    const blocks = wallBlocks(m, glazed, openings, parts).sort((a, b) => a[0] - b[0]);
    let cursor = Math.max(range[0], 0.12);
    const end = Math.min(range[1], spanOf(m, glazed) - 0.12);
    const segs = [];
    for (const [b0, b1] of blocks) {
      if (b1 <= cursor) continue;
      if (b0 > cursor) segs.push([cursor, Math.min(b0, end)]);
      cursor = Math.max(cursor, b1);
      if (cursor >= end) break;
    }
    if (cursor < end) segs.push([cursor, end]);
    for (let [s0, s1] of segs) {
      for (let k = 0; k < 40 && s1 - s0 >= 0.8 && !wallExterior(m, glazed, s0, s1, ctx); k++) {
        if (!wallExterior(m, glazed, s0, s0 + 0.3, ctx)) s0 += 0.1; else s1 -= 0.1;
      }
      const w = s1 - s0 - 0.04;
      if (w >= 0.8 && wallExterior(m, glazed, s0, s1, ctx)) add(makeOpening(m, 'glass-wall', glazed, (s0 + s1) / 2, { w: r3(w) }));
    }
  }

  // 5. windows and vents room by room
  for (const rm of rooms) {
    const K = ROOM_KINDS[rm.kind];
    const len = rm.x1 - rm.x0;
    const longWalls = ['right', 'left'].filter(w => w !== glazed || rm !== front);
    if (K.wet) {
      let ok = false;
      for (const wall of longWalls) {
        const range = roomRange(m, wall, rm);
        if (!wallExterior(m, wall, range[0], range[1], ctx)) continue;
        const a = findSpot(m, wall, 0.6, openings, parts, (range[0] + range[1]) / 2, range);
        if (a != null) { add(makeOpening(m, 'small-window', wall, a, { sill: 1.5 })); ok = true; break; }
      }
      if (!ok) {
        for (const wall of ['back', 'front']) {
          if ((wall === 'back' && rm !== rooms[0]) || (wall === 'front' && rm !== rooms[rooms.length - 1])) continue;
          if (!wallExterior(m, wall, 0.2, m.wid - 0.2, ctx)) continue;
          const a = findSpot(m, wall, 0.3, openings, parts, m.wid / 2);
          if (a != null) { add(makeOpening(m, 'vent', wall, a)); ok = true; break; }
        }
      }
      continue;
    }
    if (K.vent && !K.habitable) {
      for (const wall of longWalls) {
        const range = roomRange(m, wall, rm);
        if (!wallExterior(m, wall, range[0], range[1], ctx)) continue;
        const a = findSpot(m, wall, 0.3, openings, parts, (range[0] + range[1]) / 2, range);
        if (a != null) { add(makeOpening(m, 'vent', wall, a)); break; }
      }
      continue;
    }
    if (!K.habitable && !K.vent) continue;
    for (const wall of longWalls) {
      const range = roomRange(m, wall, rm);
      if (!wallExterior(m, wall, range[0], range[1], ctx)) continue;
      const count = len >= 2.2 ? Math.max(1, Math.round(len / 3.2)) : len >= 1.4 ? 1 : 0;
      const type = len >= 2.2 ? 'window' : 'small-window';
      const worktop = ['service', 'kitchen', 'kitchenette', 'kiosk', 'sales'].includes(rm.kind);
      for (let k = 0; k < count; k++) {
        const want = range[0] + (range[1] - range[0]) * (k + 0.5) / count;
        const a = findSpot(m, wall, OPENINGS[type].w, openings, parts, want, range);
        if (a != null) add(makeOpening(m, type, wall, a, worktop && type === 'window' ? { sill: 1.15, h: 0.8 } : {}));
      }
    }
    for (const wall of ['back', 'front']) {
      if ((wall === 'back' && rm !== rooms[0]) || (wall === 'front' && rm !== rooms[rooms.length - 1])) continue;
      if (openings.some(o => o.wall === wall)) continue;
      if (!wallExterior(m, wall, 0.2, m.wid - 0.2, ctx)) continue;
      const a = findSpot(m, wall, 1.2, openings, parts, m.wid / 2);
      if (a != null) add(makeOpening(m, 'window', wall, a));
    }
  }
  return openings.filter(o => !suppressed.has(o.id));
}

/* ---------- walkway grid ---------- */

function makeGrid(m) {
  const nx = Math.max(1, Math.ceil(m.len / RES)), nz = Math.max(1, Math.ceil(m.wid / RES));
  const g = new Uint8Array(nx * nz);
  const cx = (i) => (i + 0.5) * RES * (m.len / (nx * RES)), cz = (k) => (k + 0.5) * RES * (m.wid / (nz * RES));
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
    const x = cx(i), z = cz(k);
    if (x < RAD || x > m.len - RAD || z < RAD || z > m.wid - RAD) g[i * nz + k] = 1;
  }
  return { nx, nz, g, cx, cz, m };
}
function blockRect(G, r, pad = RAD, into = G.g) {
  const { nx, nz, cx, cz } = G;
  for (let i = 0; i < nx; i++) {
    const x = cx(i);
    if (x < r.x0 - pad || x > r.x1 + pad) continue;
    for (let k = 0; k < nz; k++) {
      const z = cz(k);
      if (z < r.z0 - pad || z > r.z1 + pad) continue;
      const dx = Math.max(r.x0 - x, 0, x - r.x1), dz = Math.max(r.z0 - z, 0, z - r.z1);
      if (dx * dx + dz * dz <= pad * pad + 1e-9) into[i * nz + k] = 1;
    }
  }
}
function cellOf(G, x, z) {
  const i = clamp(Math.floor(x / G.m.len * G.nx), 0, G.nx - 1), k = clamp(Math.floor(z / G.m.wid * G.nz), 0, G.nz - 1);
  return i * G.nz + k;
}
function nearestFree(G, grid, x, z, maxR = 3) {
  const { nx, nz } = G;
  const c = cellOf(G, x, z);
  const i0 = Math.floor(c / nz), k0 = c % nz;
  for (let rr = 0; rr <= maxR; rr++) {
    for (let di = -rr; di <= rr; di++) for (let dk = -rr; dk <= rr; dk++) {
      if (Math.max(Math.abs(di), Math.abs(dk)) !== rr) continue;
      const i = i0 + di, k = k0 + dk;
      if (i < 0 || k < 0 || i >= nx || k >= nz) continue;
      if (!grid[i * nz + k]) return i * nz + k;
    }
  }
  return -1;
}
function flood(G, grid, starts) {
  const { nx, nz } = G;
  const seen = new Uint8Array(nx * nz);
  const q = [];
  for (const s of starts) if (s >= 0 && !grid[s] && !seen[s]) { seen[s] = 1; q.push(s); }
  while (q.length) {
    const c = q.pop();
    const i = Math.floor(c / nz), k = c % nz;
    if (i > 0 && !grid[c - nz] && !seen[c - nz]) { seen[c - nz] = 1; q.push(c - nz); }
    if (i < nx - 1 && !grid[c + nz] && !seen[c + nz]) { seen[c + nz] = 1; q.push(c + nz); }
    if (k > 0 && !grid[c - 1] && !seen[c - 1]) { seen[c - 1] = 1; q.push(c - 1); }
    if (k < nz - 1 && !grid[c + 1] && !seen[c + 1]) { seen[c + 1] = 1; q.push(c + 1); }
  }
  return seen;
}

/** Access point in front of an item (where a person stands to use it). */
function accessPoint(it) {
  const { dx, dz } = dims(it.type, it.r, it);
  const [fx, fz] = FRONT[it.r];
  const depth = Math.abs(fx) ? dx : dz;
  if (it.behind) return { x: it.x - fx * (depth / 2 + 0.35), z: it.z - fz * (depth / 2 + 0.35) };
  return { x: it.x + fx * (depth / 2 + 0.35), z: it.z + fz * (depth / 2 + 0.35) };
}
const NEEDS_ACCESS = new Set(['desk', 'kitchen', 'toilet', 'shower', 'basin', 'rack', 'cabinet', 'fridge', 'counter', 'reception', 'bed', 'bunk', 'sofa', 'table']);

function layoutFurniture(m, rooms, parts, openings, warnings) {
  const items = [];
  let n = 0;
  const G = makeGrid(m);
  // static: partitions with their door gaps
  for (const p of parts) {
    blockRect(G, { x0: p.x - PART_T / 2, x1: p.x + PART_T / 2, z0: 0, z1: p.door ? p.door.z0 : m.wid });
    if (p.door) blockRect(G, { x0: p.x - PART_T / 2, x1: p.x + PART_T / 2, z0: p.door.z1, z1: m.wid });
  }
  // zones nothing may sit in: door swings, thresholds, openings to neighbours
  const zones = [];
  const starts = [], targets = [];
  for (const o of openings) {
    const c = OPENINGS[o.type];
    if (!c.door && o.type !== 'cutout') continue;
    const L = openingLocal(m, o);
    const [ix, iz] = inward[o.wall];
    const depth = o.type === 'cutout' ? 0.8 : c.roller ? 1.2 : Math.min(o.w, 0.95);
    const zone = ix ? { x0: ix > 0 ? 0 : m.len - depth, x1: ix > 0 ? depth : m.len, z0: L.z0, z1: L.z1 } : { x0: L.x0, x1: L.x1, z0: iz > 0 ? 0 : m.wid - depth, z1: iz > 0 ? depth : m.wid };
    zones.push(zone);
    const cxp = (L.x0 + L.x1) / 2 + ix * 0.4, czp = (L.z0 + L.z1) / 2 + iz * 0.4;
    starts.push({ x: cxp, z: czp });
  }
  for (const p of parts) {
    if (!p.door) continue;
    const zw = p.door.z1 - p.door.z0;
    for (const side of [-1, 1]) {
      const depth = side === p.door.swing ? zw + 0.05 : 0.35;
      zones.push({ x0: side > 0 ? p.x + PART_T / 2 : p.x - PART_T / 2 - depth, x1: side > 0 ? p.x + PART_T / 2 + depth : p.x - PART_T / 2, z0: p.door.z0, z1: p.door.z1 });
      targets.push({ x: p.x + side * 0.35, z: (p.door.z0 + p.door.z1) / 2, what: 'door' });
    }
  }
  const winZones = openings.filter(o => OPENINGS[o.type].glass).map(o => {
    const L = openingLocal(m, o);
    const [ix, iz] = inward[o.wall];
    const zone = ix ? { x0: ix > 0 ? 0 : m.len - 0.5, x1: ix > 0 ? 0.5 : m.len, z0: L.z0, z1: L.z1 } : { x0: L.x0, x1: L.x1, z0: iz > 0 ? 0 : m.wid - 0.5, z1: iz > 0 ? 0.5 : m.wid };
    return { ...zone, sill: o.type === 'glass-wall' ? 1.0 : o.sill };
  });
  if (!starts.length) starts.push({ x: (rooms[rooms.length - 1].x0 + rooms[rooms.length - 1].x1) / 2, z: m.wid / 2 });

  const startCells = () => starts.map(s => nearestFree(G, G.g, s.x, s.z));
  const reachableAll = (grid, extraTargets) => {
    const st = starts.map(s => nearestFree(G, grid, s.x, s.z));
    if (st.some(c => c < 0)) return false;
    const seen = flood(G, grid, st);
    if (st.some(c => !seen[c])) return false;
    for (const t of [...targets, ...extraTargets]) {
      const c = nearestFree(G, grid, t.x, t.z, 1);
      if (c < 0 || !seen[c]) return false;
    }
    return true;
  };
  const baseReachable = reachableAll(G.g, []);

  const occupied = [];   // {rect, soft}
  let missedTotal = 0;
  const valid = (rect, soft, h, rm, mount, openFrame = false) => {
    if (rect.x0 < rm.x0 - 0.001 || rect.x1 > rm.x1 + 0.001 || rect.z0 < -0.001 || rect.z1 > m.wid + 0.001) return false;
    if (mount) return !occupied.some(o => o.mount && hit(o.rect, rect, -0.02));
    for (const o of occupied) if (!o.mount && hit(o.rect, rect, -0.04)) return false;
    for (const z of zones) if (hit(z, rect)) return false;
    if (!soft && !openFrame) for (const w of winZones) if (h > w.sill - 0.02 && hit(w, rect)) return false;
    return true;
  };
  const rectAt = (type, x, z, r, extra) => { const { dx, dz } = dims(type, r, extra); return { x0: x - dx / 2, x1: x + dx / 2, z0: z - dz / 2, z1: z + dz / 2 }; };

  function companions(req, it) {
    const out = [];
    const { dx, dz } = dims(it.type, it.r, it);
    const [fx, fz] = FRONT[it.r];
    const depth = Math.abs(fx) ? dx : dz, width = Math.abs(fx) ? dz : dx;
    const side = Math.abs(fx) ? [0, 1] : [1, 0];
    const cc = (type, off, lat, r) => ({ type, x: it.x + fx * off + side[0] * lat, z: it.z + fz * off + side[1] * lat, r });
    const C = FITTINGS.chair.d;
    switch (req.companion) {
      case 'chair': out.push(cc('chair', depth / 2 + C / 2 - 0.15, 0, (it.r + 2) % 4)); break;
      case 'chair-free': out.push(cc('chair', depth / 2 + C / 2 + 0.15, 0, (it.r + 2) % 4)); break;
      case 'behind': out.push(cc('chair', -(depth / 2 + C / 2 + 0.02), 0, it.r)); break;
      case 'behind+visitors':
        out.push(cc('chair', -(depth / 2 + C / 2 + 0.02), 0, it.r));
        out.push(cc('chair', depth / 2 + C / 2 + 0.05, -0.33, (it.r + 2) % 4));
        out.push(cc('chair', depth / 2 + C / 2 + 0.05, 0.33, (it.r + 2) % 4));
        break;
      case 'stools': {
        const S = FITTINGS.stool.w;
        out.push(cc('stool', 0, -(width / 2 + S / 2 + 0.08), it.r));
        out.push(cc('stool', 0, width / 2 + S / 2 + 0.08, it.r));
        break;
      }
      case 'chairs-2':
        out.push(cc('chair', 0, -(width / 2 + C / 2 + 0.05), it.r));
        out.push(cc('chair', 0, width / 2 + C / 2 + 0.05, it.r));
        break;
      case 'around': {
        const seats = req.seats || 4;
        const perSide = Math.max(1, Math.floor(width / 0.62));
        const pos = [];
        for (const s of [1, -1]) for (let k = 0; k < perSide; k++) pos.push([s * (depth / 2 + C / 2 - 0.1), (k + 0.5) * width / perSide - width / 2, s > 0 ? (it.r + 2) % 4 : it.r]);
        for (const s of [1, -1]) pos.push(['end', s * (width / 2 + C / 2 - 0.1), s]);
        for (const p of pos.slice(0, seats)) {
          if (p[0] === 'end') { const r = side[0] ? (p[2] > 0 ? 1 : 3) : (p[2] > 0 ? 0 : 2); out.push({ type: 'chair', x: it.x + side[0] * p[1], z: it.z + side[1] * p[1], r }); }
          else out.push(cc('chair', p[0], p[1], p[2]));
        }
        break;
      }
      default:
    }
    return out;
  }

  function tryPlace(req, rm) {
    const type = req.type;
    const f = FITTINGS[type];
    const walls = req.walls || ['left', 'right', 'back', 'front'];
    const cands = [];
    const push = (x, z, r) => cands.push({ x: r3(x), z: r3(z), r });
    if (f.wallMounted) {
      for (const w of walls) {
        const r = { left: 0, right: 2, back: 3, front: 1 }[w];
        const { dx, dz } = dims(type, r);
        if (w === 'left' || w === 'right') push((rm.x0 + rm.x1) / 2, w === 'left' ? dz / 2 : m.wid - dz / 2, r);
        else push(w === 'back' ? rm.x0 + dx / 2 : rm.x1 - dx / 2, m.wid / 2, r);
      }
      for (const c of cands) {
        const rect = rectAt(type, c.x, c.z, c.r);
        if (!valid(rect, false, 0, rm, true)) continue;
        return [{ type, x: c.x, z: c.z, r: c.r, mount: f.mount }];
      }
      return null;
    }
    const off = req.offset || 0;
    const ext = req.w ? { w: req.w } : {};
    if (req.place === 'center') {
      const cx = (rm.x0 + rm.x1) / 2;
      for (let k = 0; k < 60; k++) {
        const x = cx + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.1;
        for (const r of [0, 1]) push(x, m.wid / 2, r);
      }
    } else {
      for (const w of walls) {
        const r = { left: 0, right: 2, back: 3, front: 1 }[w];
        const { dx, dz } = dims(type, r, ext);
        if (w === 'left' || w === 'right') {
          const z = w === 'left' ? dz / 2 + off + 0.01 : m.wid - dz / 2 - off - 0.01;
          const xs = [];
          for (let x = rm.x0 + dx / 2 + 0.02; x <= rm.x1 - dx / 2 - 0.02 + 1e-6; x += 0.05) xs.push(x);
          if (req.end === 'front') xs.reverse();
          for (const x of xs) push(x, z, r);
        } else {
          const x = w === 'back' ? rm.x0 + dx / 2 + off + 0.01 : rm.x1 - dx / 2 - off - 0.01;
          const zs = [];
          for (let z = dz / 2 + 0.02; z <= m.wid - dz / 2 - 0.02 + 1e-6; z += 0.05) zs.push(z);
          const mid = m.wid / 2;
          zs.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
          for (const z of zs) push(x, z, r);
        }
      }
    }
    for (const c of cands) {
      const main = { type, x: c.x, z: c.z, r: c.r, ...ext, ...(req.companion?.startsWith('behind') ? { behind: true } : {}) };
      const rect = rectAt(type, c.x, c.z, c.r, ext);
      if (!valid(rect, f.soft, f.h, rm, false, f.openFrame)) continue;
      const comp = companions(req, main);
      let ok = true;
      const placedRects = [];
      for (const cmp of comp) {
        const cr = rectAt(cmp.type, cmp.x, cmp.z, cmp.r);
        if (!valid(cr, true, FITTINGS[cmp.type].h, rm) || placedRects.some(p => hit(p, cr, -0.02))) { ok = false; break; }
        placedRects.push(cr);
      }
      if (!ok) continue;
      // walkway still works with this item in place?
      if (!f.soft && baseReachable) {
        const grid = G.g.slice();
        blockRect(G, rect, RAD, grid);
        const extra = [];
        if (NEEDS_ACCESS.has(type)) extra.push(accessPoint(main));
        for (const it of items) if (NEEDS_ACCESS.has(it.type)) extra.push(accessPoint(it));
        if (!reachableAll(grid, extra)) continue;
        G.g.set(grid);
      }
      return [main, ...comp.map(c => ({ ...c, companion: true }))];
    }
    return null;
  }

  const commit = (list, rm, auto) => {
    let parent = null;
    for (const it of list) {
      const rect = rectAt(it.type, it.x, it.z, it.r, it);
      occupied.push({ rect, soft: FITTINGS[it.type].soft, mount: FITTINGS[it.type].wallMounted });
      const id = `${m.id}-f${++n}`;
      items.push({ id, kind: 'fitting', type: it.type, x: r3(it.x), z: r3(it.z), r: it.r, room: rm.id, auto, ...(it.behind ? { behind: true } : {}), ...(it.mount ? { mount: it.mount } : {}), ...(it.w ? { w: it.w } : {}), ...(it.companion && parent ? { with: parent } : {}) });
      if (!it.companion) parent = id;
    }
  };

  // manual fittings first (clamped into the unit)
  for (const f of m.fittings) {
    if (f.type === 'partition') continue;
    const spec = FITTINGS[f.type];
    const r = ((Math.round(f.r ?? 0) % 4) + 4) % 4;
    const target = f.room ? rooms.find(rm => lower(rm.name).includes(lower(f.room)) || rm.kind === resolveRoomKind(f.room)) : null;
    if (Number.isFinite(f.x) && Number.isFinite(f.z)) {
      const { dx, dz } = dims(f.type, r);
      const x = clamp(f.x, dx / 2, m.len - dx / 2), z = clamp(f.z, dz / 2, m.wid - dz / 2);
      const rm = roomAt(rooms, x);
      const rect = rectAt(f.type, x, z, r);
      const clash = occupied.some(o => !o.mount && !spec.wallMounted && hit(o.rect, rect, -0.02));
      if (clash || zones.some(zz => hit(zz, rect))) {
        const alt = tryPlace({ type: f.type, walls: ['left', 'right', 'back', 'front'] }, rm);
        if (alt) { commit(alt.slice(0, 1), rm, false); warnings.push({ level: 'info', text: `Moved the ${spec.name.toLowerCase()} in ${rm.name} so it doesn’t clash with a door or other furniture.` }); continue; }
      }
      commit([{ type: f.type, x, z, r, mount: spec.mount }], { ...rm, x0: 0, x1: m.len }, false);
      if (Math.abs(x - f.x) > 0.02 || Math.abs(z - f.z) > 0.02) warnings.push({ level: 'info', text: `Pulled the ${spec.name.toLowerCase()} in ${m.name} back inside the walls.` });
    } else {
      const rm = target || rooms.reduce((a, b) => (b.x1 - b.x0 > a.x1 - a.x0 ? b : a), rooms[0]);
      const req = { type: f.type, walls: ['left', 'right', 'back', 'front'], ...(f.type === 'desk' ? { companion: 'chair' } : f.type === 'table' ? { place: 'center', companion: 'around', seats: 4 } : f.type === 'bistro' ? { companion: 'stools' } : {}) };
      const placed = tryPlace(req, rm) || rooms.map(o => tryPlace(req, o)).find(Boolean);
      if (placed) commit(placed, rm, false);
      else warnings.push({ level: 'warn', text: `There is no clear space for the ${spec.name.toLowerCase()} in ${m.name}.` });
    }
  }

  // then each room's programme
  if (m.autoFurnish !== false) {
    for (const rm of rooms) {
      const K = ROOM_KINDS[rm.kind];
      let reqs = K.furnish(rm.params || {});
      if (rm.merged?.includes('reception')) reqs = [{ type: 'reception', walls: ['left', 'right', 'front'], end: 'front', offset: 0.7, companion: 'behind' }, ...reqs, { type: 'chair', walls: ['right', 'left', 'front'], optional: true }];
      if (rm.merged?.includes('waiting')) reqs = [...reqs, { type: 'sofa', walls: ['right', 'left', 'front'], optional: true }];
      if (Array.isArray(rm.furniture) && rm.furniture.length) reqs = rm.furniture.map(t => resolveFittingType(t)).filter(Boolean).map(type => ({ type, walls: ['left', 'right', 'back', 'front'], ...(type === 'desk' ? { companion: 'chair' } : type === 'table' ? { place: 'center', companion: 'around', seats: 4 } : {}) }));
      if (m.level > 0 || rm.x1 - rm.x0 < 2) reqs = reqs.filter(q => !(q.type === 'ac' && rm.x1 - rm.x0 < 2));
      let missed = [];
      for (const req of reqs) {
        const placed = tryPlace(req, rm) || (req.type === 'desk' && !req.w ? tryPlace({ ...req, w: 1.2 }, rm) : null);
        if (placed) commit(placed, rm, true);
        else if (!req.optional) missed.push(FITTINGS[req.type].name.toLowerCase());
      }
      missedTotal += missed.length;
      if (missed.length) {
        const counts = missed.reduce((a, t) => ({ ...a, [t]: (a[t] || 0) + 1 }), {});
        warnings.push({ level: 'warn', text: `${rm.name} (${m.name}) is too small for ${Object.entries(counts).map(([t, c]) => (c > 1 ? `${c} × ${t}` : `a ${t}`)).join(', ')}; ${missed.length > 1 ? 'they were' : 'it was'} left out.` });
      }
    }
  }
  if (!baseReachable) warnings.push({ level: 'warn', text: `Part of ${m.name} can’t be reached from its door; check the partitions and door positions.` });
  void startCells;
  return { items, missed: missedTotal };
}

/* ============================================================
   Resolution
   ============================================================ */

let idSeq = 0;
function newId() { idSeq = (idSeq + 1) % 1296; return `cd-${Date.now().toString(36).slice(-5)}${idSeq.toString(36).padStart(2, '0')}`; }

export function resolveDesign(sourceIn, { id = null, version = 1, rateBook = null } = {}) {
  const source = clone(sourceIn);
  const warnings = [];
  const brief = source.brief;
  let arrangement = null;
  let mods;

  if (source.modules.length) {
    mods = source.modules.map((m, i) => ({ ...m, id: m.id || `m${i + 1}` }));
    // modules without rooms take the brief's programme
    const bare = mods.filter(m => !m.rooms.length && !m.fittings.length);
    if (bare.length && (brief.useKind || brief.rooms.length)) {
      const prog = buildProgram(brief);
      const byLevel = [0, 1, 2].map(L => bare.filter(m => m.level === L));
      const upper = prog.filter(r => r.level === 'upper');
      const ground = prog.filter(r => r.level !== 'upper');
      if (byLevel[0].length) fillModules(byLevel[1].length ? ground : prog, byLevel[0]).forEach((l, i) => { byLevel[0][i].rooms = l; });
      if (byLevel[1].length) fillModules(upper.length ? upper : [room(prog.find(r => ['manager', 'meeting', 'bedroom'].includes(r.kind))?.kind || 'room')], byLevel[1]).forEach((l, i) => { byLevel[1][i].rooms = l; });
    }
    // default positions: stacked over the one below, otherwise side by side
    const placed = [];
    for (const m of mods) {
      if (!Number.isFinite(m.x) || !Number.isFinite(m.z)) {
        const below = placed.find(p => p.level === m.level - 1 && !placed.some(q => q.level === m.level && q.x === p.x && q.z === p.z));
        if (m.level > 0 && below) { m.x = below.x; m.z = below.z; m.rot = below.rot; }
        else {
          const same = placed.filter(p => p.level === m.level);
          m.x = 0; m.z = same.length ? Math.max(...same.map(p => footprint(p).z1)) + GAP : 0;
        }
      }
      if (!m.color) m.color = brief.color || 'green';
      placed.push(m);
    }
    if (mods.some(m => m.level > 0) && !mods.some(m => m.level === 0)) { mods.forEach(m => { m.level = 0; }); warnings.push({ level: 'info', text: 'Nothing was on the ground floor, so every unit was placed at ground level.' }); }
  } else {
    const plan = planFromBrief(source, warnings);
    mods = plan.modules;
    arrangement = plan.arrangement;
  }
  mods.forEach((m, i) => {
    const S = SIZES[m.size];
    const lvl = m.level === 0 ? 'Ground' : `Level ${m.level}`;
    m.index = i;
    m.name = m.name || `${S ? S.short : `${r2(m.len)} m`} unit ${i + 1}`;
    m.label = `${lvl} · ${S ? S.short : 'Custom'}`;
  });

  resolveOverlaps(mods, warnings);
  const elev = computeLevels(mods);
  const topLevel = Math.max(...mods.map(m => m.level));

  // joins between neighbouring units on the same level
  const joins = findJoins(mods);
  const cutouts = [];
  joins.forEach((j, n) => {
    const A = mods.find(m => m.id === j.a), B = mods.find(m => m.id === j.b);
    const w = Math.min(1.8, j.hi - j.lo - 0.4);
    const mid = (j.lo + j.hi) / 2;
    const pt = j.alongX ? { x: mid, z: j.line } : { x: j.line, z: mid };
    cutouts.push({ module: A.id, wall: j.wallA, along: r3(alongForSite(A, j.wallA, pt.x, pt.z)), w: r3(w), to: B.id, n: n + 1 });
    cutouts.push({ module: B.id, wall: j.wallB, along: r3(alongForSite(B, j.wallB, pt.x, pt.z)), w: r3(w), to: A.id, n: n + 1 });
  });

  // stairs: one flight per level change, plus one to a roof deck
  const extras = source.extras;
  if (extras.glassWall && typeof extras.glassWall === 'object') {
    const t = mods.find(m => m.id === extras.glassWall.module || m.index + 1 === Number(extras.glassWall.module)) || mods.find(m => m.level === 0);
    if (t) t.glassWall = resolveWall(extras.glassWall.wall) || 'right';
  }
  const ctx = { mods, stairs: [], cutouts, landing: {}, extras, useKind: brief.useKind || mods.find(m => m.use)?.use || 'office', entranceWalls: {} };
  const wantRoofDeck = extras.roofDeck;
  const needStairs = extras.stairs !== false && extras.stairs !== 'none' && (topLevel > 0 || wantRoofDeck);
  if (topLevel > 0 || wantRoofDeck) {
    // with a stair along the right side, the ground entrance moves to the front end
    for (const m of mods.filter(x => x.level === 0)) ctx.entranceWalls[m.id] = ['front', 'left', 'right', 'back'];
  }
  const manualGroundDoors = [];
  for (const m of mods.filter(x => x.level === 0)) {
    for (const o of m.openings) {
      if (!OPENINGS[o.type].door || !o.wall) continue;
      const a = o.along ?? spanOf(m, o.wall) / 2;
      manualGroundDoors.push(outsideRect(m, o.wall, a - (o.w || 0.9) / 2 - 0.1, a + (o.w || 0.9) / 2 + 0.1, 1.2));
    }
  }
  const stairs = [];
  if (needStairs) {
    const taken = [];
    for (let L = 1; L <= topLevel + (wantRoofDeck ? 1 : 0); L++) {
      const hosts = L <= topLevel ? mods.filter(m => m.level === L) : mods.filter(m => m.level === topLevel);
      if (!hosts.length) continue;
      const host = hosts[0];
      const prev = stairs[stairs.length - 1];
      let s = null;
      if (prev && L > 1) {
        // switchback: second flight rises back from the first flight's landing, one flight further out
        const { risers, run } = stairFlight(elev[L] - elev[L - 1]);
        const W = prev.width;
        const out = prev.side === 'right' ? 1 : -1;
        const hostLocal = (r) => rectToSite(host, r);
        const xTop = prev.dir > 0 ? host.len : 0;
        const zA = prev.side === 'right' ? host.wid + WALL + W : -WALL - 2 * W;
        const zB = zA + W;
        const landX = prev.dir > 0 ? [xTop - 1.2, xTop] : [xTop, xTop + 1.2];
        const fl = prev.dir > 0 ? [xTop - 1.2 - run, xTop - 1.2] : [xTop + 1.2, xTop + 1.2 + run];
        const top = prev.dir > 0 ? [fl[0] - 1.2, fl[0]] : [fl[1], fl[1] + 1.2];
        const zIn = prev.side === 'right' ? host.wid + WALL : -WALL - 2 * W;
        const rect = hostLocal({ x0: Math.min(top[0], landX[0]), x1: Math.max(top[1], landX[1]), z0: Math.min(zA, zIn), z1: Math.max(zB, zIn + 2 * W) });
        const blocked = mods.some(m => hit(footprint(m, WALL), rect, 0.005)) || manualGroundDoors.some(d => hit(d, rect));
        void out;
        if (!blocked) {
          s = {
            host: host.id, side: prev.side, dir: -prev.dir, risers, run, fromY: r3(elev[L - 1]), toY: r3(elev[L]), width: W,
            flight: hostLocal({ x0: fl[0], x1: fl[1], z0: zA, z1: zB }),
            landing: hostLocal({ x0: top[0], x1: top[1], z0: prev.side === 'right' ? zIn : zA, z1: prev.side === 'right' ? zB : zIn + 2 * W }),
            ascent: siteDir(host, -prev.dir), doorAlong: null, rect, switchback: true,
          };
          // the shared landing becomes a double-width platform
          prev.landing = hostLocal({ x0: landX[0], x1: landX[1], z0: prev.side === 'right' ? zIn : zA, z1: prev.side === 'right' ? zB : zIn + 2 * W });
        }
      }
      if (!s) s = placeStair(host, L === 1 ? GROUND_Y : elev[L - 1], elev[L], mods, taken, manualGroundDoors, { side: 'right' });
      if (!s) { warnings.push({ level: 'warn', text: `There is no clear place for an external stair up to ${L <= topLevel ? `level ${L}` : 'the roof'}; leave space beside ${host.name}.` }); continue; }
      s.id = `s${stairs.length + 1}`;
      s.to = L <= topLevel ? `Level ${L}` : 'Roof deck';
      s.toLevel = L;
      stairs.push(s);
      taken.push(s.rect);
      if (L <= topLevel && s.doorAlong != null) ctx.landing[host.id] = { wall: s.side, along: s.doorAlong };
    }
  }
  ctx.stairs = stairs;

  // lay out every unit
  for (const m of mods) {
    const { rooms, parts } = layoutRooms(m, warnings);
    const manualParts = m.fittings.filter(f => f.type === 'partition');
    const partItems = parts.length ? parts : manualParts.map((p, i) => {
      const r = ((Math.round(p.r ?? 0) % 4) + 4) % 4;
      const d = clamp(p.d ?? (r % 2 ? m.len : m.wid), 0.5, r % 2 ? m.len : m.wid);
      const { dx, dz } = dims('partition', r, { d });
      return { id: `${m.id}-p${i + 1}`, kind: 'fitting', type: 'partition', x: r3(clamp(p.x ?? m.len / 2, dx / 2, m.len - dx / 2)), z: r3(clamp(p.z ?? m.wid / 2, dz / 2, m.wid - dz / 2)), r, w: PART_T, d, h: r3(Math.min(2.3, m.hgt)), door: null, auto: false };
    });
    m.rooms = rooms;
    const cross = partItems.filter(p => !(p.r % 2));
    // try a few entrance positions and keep the one that fits the most furniture
    let best = null;
    for (let k = 0; k < 5; k++) {
      const w = [];
      const openings = layoutOpenings(m, rooms, cross, ctx, w, k);
      const fu = layoutFurniture(m, rooms, cross, openings, w);
      const score = fu.missed * 10 + w.filter(x => x.level === 'warn').length;
      if (!best || score < best.score) best = { score, openings, items: fu.items, w };
      if (!fu.missed || k + 1 >= (m._entranceOptions || 1)) break;
    }
    delete m._entranceOptions;
    warnings.push(...best.w);
    m.items = [...best.openings, ...partItems, ...best.items];
    for (const rm of m.rooms) {
      rm.area = r2((rm.x1 - rm.x0) * m.wid);
      rm.module = m.id; rm.level = m.level;
    }
  }

  // extras: decks, canopies, roof decks, pitched roofs
  const decks = [], canopies = [], roofs = [];
  const topMods = mods.filter(m => m.level === topLevel);
  if (wantRoofDeck) {
    for (const m of topMods) {
      const fp = footprint(m, WALL);
      roofs.push({ module: m.id, kind: 'deck', y: r3(m.elev + m.hgt + 0.1), rect: fp, railing: r2(2 * ((fp.x1 - fp.x0) + (fp.z1 - fp.z0))) });
    }
  }
  if (extras.pitchedRoof) {
    if (wantRoofDeck) warnings.push({ level: 'info', text: 'A roof deck and a pitched roof can’t share the same roof; the roof deck was kept.' });
    else for (const m of topMods) roofs.push({ module: m.id, kind: 'pitched', y: r3(m.elev + m.hgt + 0.1), rect: footprint(m, WALL + 0.3), ridge: m.rot === 90 ? 'z' : 'x', rise: 0.7 });
  }
  const groundMods = mods.filter(m => m.level === 0);
  const entranceOf = (m) => m.items.find(o => o.kind === 'opening' && OPENINGS[o.type].door && o.id.endsWith('entrance')) || m.items.find(o => o.kind === 'opening' && OPENINGS[o.type].door && !o.id.endsWith('landing'));
  const blocked = (rect) => mods.some(m => m.level === 0 && hit(footprint(m, WALL), rect)) || stairs.some(s => hit(s.rect, rect));
  const canopyMode = extras.canopy === 'auto' ? (['cafe', 'shop', 'kiosk'].includes(ctx.useKind) ? 'entrance' : 'none') : extras.canopy;
  if (canopyMode && canopyMode !== 'none') {
    for (const m of groundMods) {
      const door = entranceOf(m);
      if (!door) continue;
      const full = /full|side|whole|long/.test(canopyMode) || door.type === 'glass-door';
      const span = spanOf(m, door.wall);
      const depth = full ? 1.8 : 1.2;
      const run = exteriorRun(m, door.wall, 0, span, ctx, depth, door.along) || [door.along - door.w / 2 - 0.3, door.along + door.w / 2 + 0.3];
      const a0 = full ? run[0] : Math.max(run[0], door.along - door.w / 2 - 0.6), a1 = full ? run[1] : Math.min(run[1], door.along + door.w / 2 + 0.6);
      const rect = outsideRect(m, door.wall, a0, a1, depth);
      const out = m.rot === 90 ? { x: inward[door.wall][1], z: -inward[door.wall][0] } : { x: -inward[door.wall][0], z: -inward[door.wall][1] };
      canopies.push({ module: m.id, wall: door.wall, rect, y: r3(m.elev + Math.min(m.hgt, door.sill + door.h + 0.3)), out, posts: depth > 1.5 });
    }
  }
  if (extras.deck) {
    const want = typeof extras.deck === 'object' ? extras.deck : {};
    const byEntrance = [...groundMods].sort((a, b) => Boolean(entranceOf(b)) - Boolean(entranceOf(a)));
    for (const m of byEntrance.filter(g => !want.module || want.module === g.id || want.module === g.index + 1)) {
      const door = entranceOf(m);
      const walls = want.wall ? [resolveWall(want.wall)] : [door?.wall || 'right', 'right', 'left', 'front'];
      for (const wall of walls) {
        if (!wall) continue;
        const span = spanOf(m, wall);
        const depth = clamp(num(want.depth_m) || 2.0, 1.0, 3.5);
        const run = exteriorRun(m, wall, 0, span, ctx, depth, door?.wall === wall ? door.along : null);
        if (!run || run[1] - run[0] < 1.5) continue;
        const rect = outsideRect(m, wall, run[0], run[1], depth);
        if (blocked(rect)) continue;
        const out = m.rot === 90 ? { x: inward[wall][1], z: -inward[wall][0] } : { x: -inward[wall][0], z: -inward[wall][1] };
        decks.push({ module: m.id, wall, rect, y: 0, out });
        break;
      }
      if (!decks.some(d => d.module === m.id)) warnings.push({ level: 'info', text: `No free side for a deck beside ${m.name}.` });
      if (!want.module) break;
    }
  }

  const design = {
    id: id || newId(), version, currency: 'NGN', units: source.units || 'ft',
    title: source.title || defaultTitle(brief, mods, arrangement),
    use: ctx.useKind, arrangement: arrangement || (mods.length > 1 ? 'custom' : 'single'),
    modules: mods.map(m => ({
      id: m.id, index: m.index, name: m.name, label: m.label, size: m.size, sizeName: SIZES[m.size]?.name || 'Custom unit',
      len: m.len, wid: m.wid, hgt: m.hgt, extH: m.extH, x: r3(m.x), z: r3(m.z), rot: m.rot, level: m.level, elev: m.elev,
      color: m.color, colorHex: COLORS[m.color]?.hex || COLORS.green.hex, cladding: extras.cladding,
      rooms: m.rooms.map(({ furniture, ...rm }) => rm), items: m.items,
    })),
    stairs, decks, canopies, roofs, levels: elev.slice(0, topLevel + 1).map((e, L) => ({ level: L, elev: r3(e), name: L ? `Level ${L}` : 'Ground' })),
    extras, specLevel: source.specLevel || 'standard',
  };
  design.site = siteBounds(design);
  validate(design, warnings);
  design.quantities = quantities(design);
  design.cost = costDesign(design, source, rateBook, warnings);
  design.rooms = design.modules.flatMap(m => m.rooms.map(r => ({ name: r.name, kind: r.kind, module: m.id, level: m.level, area: r.area })));
  design.warnings = dedupe(warnings);
  design.summary = summarize(design);
  return design;
}

function dedupe(list) {
  const seen = new Set();
  return list.filter(w => (seen.has(w.text) ? false : seen.add(w.text)));
}

function defaultTitle(brief, mods, arrangement) {
  const useName = { office: 'Container office', 'site-office': 'Site office', cafe: 'Container café', shop: 'Container shop', kiosk: 'Container kiosk', home: 'Container home', bunkhouse: 'Staff quarters', clinic: 'Container clinic', salon: 'Container salon', gatehouse: 'Gatehouse', classroom: 'Container classroom', ablution: 'Toilet block', storage: 'Storage unit' }[brief.useKind] || 'Container structure';
  const sizes = [...new Set(mods.map(m => SIZES[m.size]?.short || 'custom'))].join(' + ');
  const levels = Math.max(...mods.map(m => m.level)) + 1;
  const bits = [mods.length > 1 ? `${mods.length} × ${sizes}` : sizes];
  if (levels > 1) bits.push(`${levels}-storey`);
  if (arrangement === 'L') bits.push('L-shape');
  if (arrangement === 'T') bits.push('T-shape');
  return `${useName} · ${bits.join(', ')}`;
}

function siteBounds(d) {
  const rects = [...d.modules.map(m => footprint(m, WALL)), ...d.stairs.map(s => s.rect), ...d.decks.map(x => x.rect), ...d.canopies.map(c => c.rect), ...d.roofs.map(r => r.rect)];
  return {
    x0: r3(Math.min(...rects.map(r => r.x0))), x1: r3(Math.max(...rects.map(r => r.x1))),
    z0: r3(Math.min(...rects.map(r => r.z0))), z1: r3(Math.max(...rects.map(r => r.z1))),
  };
}

/* ============================================================
   Validation
   ============================================================ */

function validate(d, warnings) {
  for (const m of d.modules) {
    const openings = m.items.filter(i => i.kind === 'opening');
    const fittings = m.items.filter(i => i.kind === 'fitting' && i.type !== 'partition');
    // openings on the same wall must not overlap; openings must not straddle partitions
    for (let i = 0; i < openings.length; i++) for (let j = i + 1; j < openings.length; j++) {
      const a = openings[i], b = openings[j];
      if (a.wall === b.wall && Math.abs(a.along - b.along) < (a.w + b.w) / 2 - 0.01) warnings.push({ level: 'warn', text: `Two openings overlap on the ${a.wall} wall of ${m.name}.` });
    }
    for (const p of m.items.filter(i => i.type === 'partition' && !(i.r % 2))) {
      for (const o of openings.filter(o => o.wall === 'left' || o.wall === 'right')) {
        const L = openingLocal(m, o);
        if (L.x0 < p.x + PART_T / 2 && L.x1 > p.x - PART_T / 2) warnings.push({ level: 'warn', text: `A ${OPENINGS[o.type].name.toLowerCase()} on the ${o.wall} wall of ${m.name} runs into a partition.` });
      }
    }
    // furniture overlaps
    for (let i = 0; i < fittings.length; i++) for (let j = i + 1; j < fittings.length; j++) {
      const a = fittings[i], b = fittings[j];
      if (FITTINGS[a.type].wallMounted || FITTINGS[b.type].wallMounted) continue;
      if (a.with === b.id || b.with === a.id) continue;   // a chair tucked under its own desk
      if (hit(itemRect(a), itemRect(b), 0.02)) warnings.push({ level: 'warn', text: `${FITTINGS[a.type].name} and ${FITTINGS[b.type].name.toLowerCase()} overlap in ${m.name}.` });
    }
    // wet rooms need air
    for (const rm of m.rooms) {
      const K = ROOM_KINDS[rm.kind];
      const inRoom = openings.filter(o => {
        const L = openingLocal(m, o);
        return (o.wall === 'left' || o.wall === 'right') ? L.x0 >= rm.x0 - 0.05 && L.x1 <= rm.x1 + 0.05
          : (o.wall === 'back' ? rm.x0 < 0.2 : rm.x1 > m.len - 0.2);
      });
      if (K.wet && !inRoom.some(o => ['vent', 'small-window', 'window'].includes(o.type))) warnings.push({ level: 'warn', text: `${rm.name} in ${m.name} has no vent or window; add an extractor or a small high window.` });
      if (K.habitable && !K.wet && rm.kind !== 'lobby' && !inRoom.some(o => OPENINGS[o.type].glass)) warnings.push({ level: 'info', text: `${rm.name} in ${m.name} has no window, so it will rely on artificial light.` });
      const desks = fittings.filter(f => f.room === rm.id && f.type === 'desk').length;
      if (desks && rm.area / desks < 3) warnings.push({ level: 'info', text: `${rm.name} gives about ${r2(rm.area / desks)} m² per desk, which is tight (4–6 m² is comfortable).` });
    }
    // upper floors need a way up and support
    if (m.level > 0) {
      const below = d.modules.filter(b => b.level === m.level - 1);
      const fp = footprint(m);
      const covered = below.some(b => { const f = footprint(b); return fp.x0 >= f.x0 - 0.3 && fp.x1 <= f.x1 + 0.3 && fp.z0 >= f.z0 - 0.3 && fp.z1 <= f.z1 + 0.3; });
      if (!covered) warnings.push({ level: 'warn', text: `${m.name} overhangs the unit below; it needs a steel transfer frame or posts checked by an engineer.` });
      else if (below.some(b => b.len !== m.len && hit(footprint(b), fp))) warnings.push({ level: 'info', text: `${m.name}’s corner castings don’t sit on the corners below; add a steel transfer beam.` });
      if (!d.stairs.some(s => s.toLevel === m.level) && !m.items.some(o => o.kind === 'opening' && OPENINGS[o.type].door)) warnings.push({ level: 'warn', text: `${m.name} is upstairs with no stair or door to reach it.` });
      else if (!d.stairs.some(s => s.toLevel === m.level && s.host === m.id) && !d.stairs.some(s => s.toLevel === m.level)) warnings.push({ level: 'warn', text: `${m.name} has no stair.` });
    }
  }
  // stairs must not block ground doors
  for (const s of d.stairs) {
    for (const m of d.modules.filter(x => x.level === 0)) {
      for (const o of m.items.filter(i => i.kind === 'opening' && OPENINGS[i.type].door)) {
        const zone = outsideRect(m, o.wall, o.along - o.w / 2, o.along + o.w / 2, 1.0);
        if (hit(zone, s.rect)) warnings.push({ level: 'warn', text: `The stair blocks the ${OPENINGS[o.type].name.toLowerCase()} on the ${o.wall} wall of ${m.name}.` });
      }
    }
  }
  if (d.roofs.some(r => r.kind === 'deck') && !d.stairs.some(s => s.to === 'Roof deck')) warnings.push({ level: 'warn', text: 'The roof deck has no stair up to it.' });
}

/* ============================================================
   Quantities and cost (priced exactly like the Planner's quote)
   ============================================================ */

function quantities(d) {
  const q = { floorArea: 0, footprintArea: 0, grossWallArea: 0, netWallArea: 0, openingArea: 0, partitionLength: 0, openings: {}, fittings: {}, rooms: 0, deckArea: 0, canopyArea: 0, roofDeckArea: 0, stairFlights: d.stairs.length, units: d.modules.length };
  for (const m of d.modules) {
    q.floorArea += m.len * m.wid;
    if (m.level === 0) q.footprintArea += area(footprint(m, WALL));
    const gross = 2 * (m.len + m.wid) * m.hgt;
    const op = m.items.filter(i => i.kind === 'opening');
    const oa = op.reduce((s, o) => s + o.w * o.h, 0);
    q.grossWallArea += gross; q.openingArea += oa; q.netWallArea += Math.max(0, gross - oa);
    for (const o of op) q.openings[o.type] = (q.openings[o.type] || 0) + 1;
    for (const f of m.items.filter(i => i.kind === 'fitting')) {
      if (f.type === 'partition') q.partitionLength += f.d - (f.door ? f.door.z1 - f.door.z0 : 0);
      else q.fittings[f.type] = (q.fittings[f.type] || 0) + 1;
    }
    q.rooms += m.rooms.length;
  }
  q.deckArea = d.decks.reduce((s, x) => s + area(x.rect), 0);
  q.canopyArea = d.canopies.reduce((s, x) => s + area(x.rect), 0);
  q.roofDeckArea = d.roofs.filter(r => r.kind === 'deck').reduce((s, x) => s + area(x.rect), 0);
  for (const k of Object.keys(q)) if (typeof q[k] === 'number') q[k] = r2(q[k]);
  return q;
}

const zeroServices = () => Object.fromEntries(SERVICES.map(s => [s.id, 0]));
const zeroLogistics = () => Object.fromEntries(LOGISTICS.map(l => [l.id, 0]));

/** The model the Planner's quote engine prices for one unit. */
export function quoteModelFor(d, m, tier = 'standard', { clientShell = false, plumbingDone = false } = {}) {
  const items = [];
  const extras = new Map();
  for (const it of m.items) {
    if (it.kind === 'opening') { items.push({ kind: 'opening', type: OPENINGS[it.type].price || it.type, w: it.w, h: it.h, sill: it.sill }); continue; }
    if (it.type === 'partition') { const nseg = Math.max(1, Math.round(it.d / 2.35)); for (let k = 0; k < nseg; k++) items.push({ kind: 'fitting', type: 'partition' }); continue; }
    if (FITTING_RATES[it.type]) { items.push({ kind: 'fitting', type: it.type }); continue; }
    const f = FITTINGS[it.type];
    if (f.rate) extras.set(it.type, (extras.get(it.type) || 0) + 1);
  }
  const wet = m.items.some(i => ['toilet', 'shower', 'basin', 'kitchen'].includes(i.type));
  const ac = m.items.filter(i => i.type === 'ac').length;
  const S = SIZES[m.size];
  const spec = { ...SPEC_TIERS[tier] || SPEC_TIERS.standard, shell: clientShell ? 'client' : (S?.shell || 'fabricate') };
  if (d.extras.cladding === 'composite') spec.exterior = 'acp4';
  if (d.extras.cladding === 'timber') spec.exterior = 'paint';
  const services = {};
  if (ac) services.ac = ac;
  if (wet) { services.plumbing = 1; if (!plumbingDone) services.watertank = 1; }
  return {
    len: m.len, wid: m.wid, hgt: m.hgt, items, spec, services, logistics: {},
    customLines: [...extras].map(([type, qty]) => ({ id: `custom:${type}`, name: FITTINGS[type].name, unit: 'each', qty, wastage: 0, rate: FITTINGS[type].rate, labour: FITTINGS[type].labour || 0 })),
    commercial: { ...COMMERCIAL_DEFAULTS, discount: 0 },
  };
}

function worksLines(d) {
  const lines = [];
  const add = (key, qty, note) => { if (qty > 0.01) lines.push({ id: `works:${key}`, name: WORKS[key].name + (note ? ` (${note})` : ''), unit: WORKS[key].unit, qty: r2(qty), wastage: 0, rate: WORKS[key].rate, labour: WORKS[key].labour }); };
  const ground = d.modules.filter(m => m.level === 0);
  add('footing', ground.length * 6, `${ground.length * 6} pads`);
  add('stack', d.modules.filter(m => m.level > 0).length);
  add('stair', d.stairs.length);
  add('roofdeck', d.quantities.roofDeckArea);
  add('railing', d.roofs.filter(r => r.kind === 'deck').reduce((s, r) => s + r.railing, 0));
  add('pitched', d.roofs.filter(r => r.kind === 'pitched').reduce((s, r) => s + area(r.rect) * 1.08, 0));
  add('canopy', d.quantities.canopyArea);
  add('deck', d.quantities.deckArea);
  if (d.extras.cladding === 'timber') add('timber', d.quantities.netWallArea * 1.02);
  add('glazing', d.modules.reduce((s, m) => s + m.items.filter(i => i.type === 'glass-wall').reduce((a, o) => a + o.w * o.h, 0), 0));
  add('joint', d.modules.reduce((s, m) => s + m.items.filter(i => i.type === 'cutout').length, 0) / 2);
  return lines;
}

function costFor(d, source, tier, rateBook) {
  const book = { ...defaultRateBook(), ...(rateBook || {}) };
  let plumbingDone = false;
  const modules = d.modules.map(m => {
    const model = quoteModelFor(d, m, tier, { clientShell: source.clientShell, plumbingDone });
    if (model.services.watertank) plumbingDone = true;
    const q = buildQuote(model, book);
    const top = [...q.lines].sort((a, b) => b.total - a.total).slice(0, 6).map(l => ({ name: l.name, total: Math.round(l.total) }));
    return { id: m.id, name: m.name, label: m.label, material: Math.round(q.totals.material), labour: Math.round(q.totals.labour), prime: Math.round(q.totals.prime), vat: Math.round(q.totals.vat), total: Math.round(q.totals.grandTotal), perM2: Math.round(q.totals.grandTotal / (m.len * m.wid)), lines: q.lines.length, top };
  });
  const works = worksLines(d);
  const wq = buildQuote({ len: 0, wid: 0, hgt: 0, items: [], spec: {}, services: zeroServices(), logistics: zeroLogistics(), customLines: works, commercial: { ...COMMERCIAL_DEFAULTS, discount: 0 } }, book);
  const structure = { lines: wq.lines.map(l => ({ name: l.name, qty: l.qty, unit: l.unit, total: Math.round(l.total) })), prime: Math.round(wq.totals.prime), vat: Math.round(wq.totals.vat), total: Math.round(wq.totals.grandTotal) };
  const total = modules.reduce((s, x) => s + x.total, 0) + structure.total;
  const prime = modules.reduce((s, x) => s + x.prime, 0) + structure.prime;
  const vat = modules.reduce((s, x) => s + x.vat, 0) + structure.vat;
  return { tier, modules, structure, prime, vat, total, perM2: Math.round(total / Math.max(1, d.quantities.floorArea)) };
}

function costDesign(d, source, rateBook, warnings) {
  const budget = source.brief.budget;
  let tier = source.specLevel || 'standard';
  let cost = costFor(d, source, tier, rateBook);
  if (budget && !source.specLevel && cost.total > budget) {
    const eco = costFor(d, source, 'economy', rateBook);
    if (eco.total <= budget) { cost = eco; tier = 'economy'; warnings.push({ level: 'info', text: 'Switched to the economy finish specification to stay within the budget.' }); }
  }
  d.specLevel = tier;
  if (budget) {
    cost.budget = budget;
    cost.withinBudget = cost.total <= budget;
    if (!cost.withinBudget) warnings.push({ level: 'warn', text: `The estimate is about ₦${Math.round((cost.total - budget) / 1000).toLocaleString('en-NG')}k over the ₦${Math.round(budget).toLocaleString('en-NG')} budget. Options: client-supplied container, fewer rooms or openings, or a smaller unit.` });
  }
  cost.note = 'Estimate from the Toolbox Container Planner rate book (NGN, incl. overheads, contingency, profit and 7.5% VAT). Rates are editable in the Planner.';
  return cost;
}

/* ============================================================
   Summary for the model
   ============================================================ */

const naira = (v) => `₦${Math.round(v).toLocaleString('en-NG')}`;
function summarize(d) {
  const lines = [];
  const levels = d.levels.length;
  lines.push(`${d.title}: ${d.modules.length} unit${d.modules.length > 1 ? 's' : ''}${levels > 1 ? ` over ${levels} levels` : ''}, ${d.quantities.floorArea} m² inside.`);
  for (const m of d.modules) {
    const ops = m.items.filter(i => i.kind === 'opening').reduce((a, o) => ({ ...a, [OPENINGS[o.type].name]: (a[OPENINGS[o.type].name] || 0) + 1 }), {});
    lines.push(`- ${m.id} ${m.label} (${COLORS[m.color]?.name || m.color}): ${m.rooms.map(r => `${r.name} ${r.area} m²`).join(', ')}. Openings: ${Object.entries(ops).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(', ') || 'none'}.`);
  }
  if (d.stairs.length) lines.push(`Stairs: ${d.stairs.map(s => `external flight to ${s.to.toLowerCase()}`).join(', ')}.`);
  const ex = [d.decks.length && 'deck', d.canopies.length && 'canopy', d.roofs.some(r => r.kind === 'deck') && 'roof deck', d.roofs.some(r => r.kind === 'pitched') && 'pitched roof', d.extras.cladding !== 'none' && `${d.extras.cladding} cladding`].filter(Boolean);
  if (ex.length) lines.push(`Extras: ${ex.join(', ')}.`);
  lines.push(`Estimate (${d.specLevel} spec): ${naira(d.cost.total)} incl. VAT (${naira(d.cost.perM2)}/m²).${d.cost.budget ? ` Budget ${naira(d.cost.budget)}: ${d.cost.withinBudget ? 'within' : 'over'}.` : ''}`);
  const warn = d.warnings.filter(w => w.level === 'warn');
  if (warn.length) lines.push(`Warnings: ${warn.map(w => w.text).join(' ')}`);
  return lines.join('\n');
}

/* ============================================================
   Revisions
   ============================================================ */

function moduleRef(source, ref) {
  if (ref == null || ref === '') return source.modules[0];
  const s = lower(ref);
  return source.modules.find(m => lower(m.id) === s) || source.modules[Number(s) - 1] || source.modules[Number(s)] ||
    source.modules.find(m => (/up|upper|top|first/.test(s) && m.level > 0) || (/ground|down/.test(s) && m.level === 0)) || source.modules[0];
}

/** Freeze a resolved design into an editable source (every module explicit). */
function freeze(design, source) {
  const out = clone(source);
  out.modules = design.modules.map(m => {
    const prev = source.modules.find(p => p.id === m.id) || {};
    return {
      id: m.id, size: m.size, len: m.len, wid: m.wid, hgt: m.hgt, x: m.x, z: m.z, level: m.level, rot: m.rot, color: m.color,
      use: prev.use || null, name: prev.name || null,
      rooms: m.rooms.map(r => ({ kind: r.kind, name: r.name, level: 'any', params: r.params || {}, ...(r.merged ? { merged: r.merged } : {}) })),
      openings: prev.openings || [], fittings: prev.fittings || [], suppress: prev.suppress || [],
      entrance: prev.entrance ?? (m.level > 0 || m.items.some(i => i.id === `${m.id}-entrance`) ? null : 'none'), glassWall: prev.glassWall || null,
      autoOpenings: prev.autoOpenings ?? true, autoFurnish: prev.autoFurnish ?? true,
    };
  });
  return out;
}

export function applyChanges(sourceIn, design, changes = []) {
  let source = sourceIn.modules.length ? clone(sourceIn) : freeze(design, sourceIn);
  const notes = [];
  for (const raw of changes) {
    const c = raw || {};
    const action = lower(c.action).replace(/[\s-]/g, '_');
    const m = moduleRef(source, c.module);
    switch (action) {
      case 'add_opening': {
        const o = normOpening(c);
        if (o) { m.openings.push(o); notes.push(`added a ${OPENINGS[o.type].name.toLowerCase()}`); }
        break;
      }
      case 'add_fitting': case 'add_furniture': {
        const f = normFitting(c);
        if (f) { m.fittings.push(f); m.autoFurnish = true; notes.push(`added a ${FITTINGS[f.type].name.toLowerCase()}`); }
        break;
      }
      case 'remove': case 'remove_item': {
        const target = design.modules.find(x => x.id === m.id);
        const type = c.type ? (resolveOpeningType(c.type) && !resolveFittingType(c.type) ? resolveOpeningType(c.type) : resolveFittingType(c.type) || resolveOpeningType(c.type)) : null;
        const wall = resolveWall(c.wall);
        const matches = (target?.items || []).filter(i => (c.item && i.id === c.item) || (!c.item && type && (i.type === type || (type === 'personnel-door' && OPENINGS[i.type]?.door)) && (!wall || i.wall === wall)));
        const pick = c.all ? matches : matches.slice(-1);
        for (const it of pick) {
          if (it.auto === false) {
            m.openings = m.openings.filter(o => !(o.id === it.id || (o.type === it.type && o.wall === it.wall)));
            m.fittings = m.fittings.filter(f => !(f.id === it.id || f.type === it.type));
          }
          m.suppress.push(it.id);
          if (it.kind === 'fitting') { m.fittings = m.fittings.filter(f => f.id !== it.id); if (!m.fittings.length) { /* keep programme */ } }
        }
        if (pick.length) notes.push(`removed ${pick.length} item${pick.length > 1 ? 's' : ''}`);
        if (pick.some(i => i.kind === 'fitting' && i.auto !== false)) {
          // freeze the remaining furniture so the removed piece doesn't come back
          const keep = target.items.filter(i => i.kind === 'fitting' && i.type !== 'partition' && !pick.includes(i));
          m.fittings = [...m.fittings.filter(f => f.type === 'partition'), ...keep.map(i => ({ type: i.type, x: i.x, z: i.z, r: i.r, id: i.id }))];
          m.autoFurnish = false;
        }
        break;
      }
      case 'move': case 'update': case 'update_opening': {
        const target = design.modules.find(x => x.id === m.id);
        const it = target?.items.find(i => i.id === c.item) || target?.items.filter(i => i.kind === 'opening' && (!c.type || i.type === resolveOpeningType(c.type))).slice(-1)[0];
        if (it?.kind === 'opening') {
          m.suppress.push(it.id);
          m.openings = m.openings.filter(o => o.id !== it.id);
          m.openings.push({ ...normOpening({ type: it.type, wall: c.wall || it.wall, along_m: c.along_m ?? (c.wall ? undefined : it.along), width_m: c.width_m ?? it.w, height_m: c.height_m ?? it.h, sill_m: c.sill_m ?? it.sill, position: c.position }), id: it.id });
          notes.push('moved an opening');
        }
        break;
      }
      case 'resize': case 'set_size': {
        const size = resolveSize(c.size);
        const targets = c.module == null && source.modules.length > 1 && !c.only ? source.modules : [m];
        for (const t of targets) {
          const oldLen = t.len;
          if (size) { const S = SIZES[size]; Object.assign(t, { size, len: S.len, wid: S.wid, hgt: S.hgt }); }
          if (num(c.length_m)) { t.len = num(c.length_m); t.size = 'custom'; }
          if (num(c.height_m)) { t.hgt = num(c.height_m); t.size = 'custom'; }
          t.openings = t.openings.map(o => ({ ...o, along: o.along != null && (o.wall === 'left' || o.wall === 'right') ? o.along * t.len / oldLen : o.along }));
          t.fittings = t.fittings.filter(f => f.type !== 'partition').map(f => ({ ...f, x: Number.isFinite(f.x) ? f.x * t.len / oldLen : f.x }));
        }
        // re-arrange neighbours so they still meet after a length change
        relayout(source);
        notes.push(`resized to ${size ? SIZES[size].short : `${c.length_m} m`}`);
        break;
      }
      case 'recolor': case 'set_color': case 'colour': {
        const col = resolveColor(c.color ?? c.colour);
        if (col) { for (const t of c.module == null ? source.modules : [m]) t.color = col; source.brief.color = col; notes.push(`recoloured ${COLORS[col].name.toLowerCase()}`); }
        break;
      }
      case 'set_extras': case 'extras': {
        source.extras = { ...source.extras, ...normExtrasPatch(c) };
        notes.push('updated extras');
        break;
      }
      case 'set_rooms': case 'rooms': {
        m.rooms = normRooms(c.rooms);
        m.fittings = m.fittings.filter(f => f.type !== 'partition');
        m.suppress = []; m.openings = m.openings.filter(o => o.auto === false || !o.auto);
        notes.push('changed the rooms');
        break;
      }
      case 'add_room': {
        m.rooms.push(...normRooms([c.room || c.name || c.kind]));
        m.suppress = [];
        notes.push('added a room');
        break;
      }
      case 'add_module': case 'add_unit': {
        const nm = normModule({ size: c.size || m.size, level: c.level ?? 0, color: c.color || m.color, rotation: c.rotation, x_m: c.x_m, z_m: c.z_m, rooms: c.rooms }, source.modules.length);
        nm.id = `m${source.modules.length + 1}`;
        if (!Number.isFinite(nm.x)) {
          if (nm.level > 0) { const below = source.modules.find(b => b.level === nm.level - 1); nm.x = below?.x ?? 0; nm.z = below?.z ?? 0; nm.rot = below?.rot ?? 0; }
          else { nm.x = 0; nm.z = Math.max(...source.modules.filter(b => b.level === 0).map(b => b.z + (b.rot === 90 ? b.len : b.wid))) + GAP; }
        }
        if (!nm.rooms.length) nm.rooms = [room(nm.level > 0 ? 'meeting' : 'room')];
        source.modules.push(nm);
        notes.push('added a unit');
        break;
      }
      case 'remove_module': case 'remove_unit': {
        if (source.modules.length > 1) { source.modules = source.modules.filter(x => x !== m); notes.push('removed a unit'); }
        break;
      }
      case 'set_brief': case 'brief': {
        const nb = normalizeSource({ brief: { ...briefToArgs(source.brief), ...(c.brief || c) } }).brief;
        source = { ...normalizeSource({}), ...source, brief: nb, modules: [] };
        notes.push('re-planned from the brief');
        break;
      }
      default:
    }
  }
  return { source, notes };
}

function normExtrasPatch(c) {
  const out = {};
  if (c.stairs !== undefined) out.stairs = c.stairs;
  if (c.roof_deck !== undefined) out.roofDeck = Boolean(c.roof_deck);
  if (c.pitched_roof !== undefined) out.pitchedRoof = Boolean(c.pitched_roof);
  if (c.canopy !== undefined) out.canopy = c.canopy === true ? 'entrance' : c.canopy === false ? 'none' : lower(c.canopy);
  if (c.cladding !== undefined) out.cladding = /timber|wood/.test(lower(c.cladding)) ? 'timber' : /comp|acp|alu/.test(lower(c.cladding)) ? 'composite' : 'none';
  if (c.glass_wall !== undefined) out.glassWall = c.glass_wall;
  if (c.deck !== undefined) out.deck = c.deck;
  return out;
}
function briefToArgs(b) {
  return { use: b.use, headcount: b.headcount, rooms: b.rooms.map(r => ({ name: r.name, kind: r.kind, level: r.level })), size: b.size, containers: b.containers, levels: b.levels, arrangement: b.arrangement, budget_ngn: b.budget, color: b.color, style: b.style, notes: b.notes };
}

/** After a resize, keep stacked units aligned and joined units touching. */
function relayout(source) {
  const ground = source.modules.filter(m => m.level === 0);
  for (let i = 1; i < ground.length; i++) {
    const a = ground[i - 1], b = ground[i];
    const fa = footprint(a);
    if (b.rot === 90 && a.rot === 0) { b.x = fa.x1 + GAP; }
    else if (Math.abs(b.x - a.x) < 0.01) b.z = fa.z1 + GAP;
    else if (Math.abs(b.z - a.z) < 0.01) b.x = fa.x1 + GAP;
  }
  for (const m of source.modules.filter(x => x.level > 0)) {
    const below = source.modules.find(b => b.level === m.level - 1);
    if (below) { m.x = below.x; m.z = below.z; m.rot = below.rot; }
  }
}

/* ============================================================
   Store (last designs, so "add a window on the left" works)
   ============================================================ */

export const STORE_KEY = 'toolbox_container_designs_v1';
const MEMORY = new Map();
const storage = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } };

export const designStore = {
  all() {
    const ls = storage();
    if (ls) { try { return JSON.parse(ls.getItem(STORE_KEY) || '[]'); } catch { return []; } }
    return [...MEMORY.values()];
  },
  get(id) {
    const list = this.all();
    if (!id || /^(last|latest|previous|current)$/i.test(String(id))) return list[0] || null;
    return list.find(e => e.id === id) || null;
  },
  put(entry) {
    const list = this.all().filter(e => e.id !== entry.id);
    list.unshift(entry);
    const kept = list.slice(0, 24);
    const ls = storage();
    if (ls) { try { ls.setItem(STORE_KEY, JSON.stringify(kept)); } catch { /* storage full */ } }
    MEMORY.clear(); for (const e of kept) MEMORY.set(e.id, e);
  },
};

/**
 * Create or revise a design. `args` is the tool input (see design_container).
 * Returns the resolved design; the source is kept for later revisions.
 */
export function designContainer(args = {}, { rateBook = null } = {}) {
  let source, id = null, version = 1, notes = [];
  if (args.revise) {
    const prev = designStore.get(args.revise);
    if (!prev) throw new Error(`There is no saved design "${args.revise}" to revise. Create a new design instead.`);
    id = prev.id; version = (prev.version || 1) + 1;
    source = clone(prev.source);
    const patch = normalizeSource(args);
    if (args.brief) { source.brief = normalizeSource({ brief: { ...briefToArgs(source.brief), ...args.brief } }).brief; if (!args.modules && !args.changes) source.modules = []; }
    if (Array.isArray(args.modules) && args.modules.length) source.modules = patch.modules;
    if (args.extras) source.extras = { ...source.extras, ...normExtrasPatch(args.extras) };
    if (args.spec_level) source.specLevel = patch.specLevel;
    if (args.title) source.title = args.title;
    if (args.units) source.units = patch.units;
    if (Array.isArray(args.changes) && args.changes.length) {
      const res = applyChanges(source, prev.design, args.changes);
      source = res.source; notes = res.notes;
    }
  } else {
    source = normalizeSource(args);
    if (!source.modules.length && !source.brief.useKind && !source.brief.rooms.length) source.brief.useKind = 'office';
  }
  const design = resolveDesign(source, { id, version, rateBook });
  if (notes.length) design.changes = notes;
  // keep the resolved layout's items so later revisions can refer to them by id
  designStore.put({ id: design.id, version: design.version, title: design.title, updatedAt: Date.now(), source, design: { modules: design.modules.map(m => ({ id: m.id, items: m.items, rooms: m.rooms, len: m.len, wid: m.wid, hgt: m.hgt, x: m.x, z: m.z, level: m.level, rot: m.rot, color: m.color, size: m.size })) } });
  return design;
}

/* ============================================================
   Container Planner hand-off
   ============================================================ */

export const HANDOFF_KEY = 'toolbox.container.handoff';

/** The Planner's own state shape for one unit (openings: wall/along/sill; fittings: x/z centre, rot). */
export function plannerHandoff(design, moduleId) {
  const m = design.modules.find(x => x.id === moduleId) || design.modules[0];
  const notes = [];
  const items = [];
  for (const it of m.items) {
    if (it.kind === 'opening') {
      const t = OPENINGS[it.type].planner;
      if (!t) { notes.push(`${OPENINGS[it.type].name} (not modelled in the Planner)`); continue; }
      if (t !== it.type) notes.push(`${OPENINGS[it.type].name} shown as ${t.replace('-', ' ')}`);
      items.push({ kind: 'opening', type: t, wall: it.wall, along: it.along, sill: it.sill, w: it.w, h: it.h });
    } else if (it.type === 'partition') {
      // the Planner's partition is a fixed 2.35 m panel: split long walls into panels along their run
      const nseg = Math.max(1, Math.round(it.d / 2.35));
      for (let k = 0; k < nseg; k++) {
        const off = (k + 0.5) * it.d / nseg - it.d / 2;
        items.push({ kind: 'fitting', type: 'partition', x: r3(it.r % 2 ? it.x + off : it.x), z: r3(it.r % 2 ? it.z : it.z + off), rot: it.r % 2 });
      }
      if (it.door) notes.push('doorways in partitions');
    } else {
      const f = FITTINGS[it.type];
      if (!f.planner) { notes.push(`${f.name}`); continue; }
      if (it.w && Math.abs(it.w - f.w) > 0.01) notes.push(`compact ${f.name.toLowerCase()} shown at the standard size`);
      items.push({ kind: 'fitting', type: f.planner, x: it.x, z: it.z, rot: (it.r + (f.rotOffset || 0)) % 4 });
    }
  }
  const S = SIZES[m.size];
  return {
    source: 'assistant', designId: design.id, module: m.id, name: `${design.title} · ${m.label}`,
    preset: S ? m.size : 'custom', len: m.len, wid: m.wid, hgt: m.hgt, color: m.color, items,
    spec: { ...(SPEC_TIERS[design.specLevel] || SPEC_TIERS.standard), shell: S?.shell || 'fabricate', ...(design.extras.cladding === 'composite' ? { exterior: 'acp4' } : {}) },
    notes: [...new Set(notes)], createdAt: Date.now(),
  };
}

/* ---------- helpers the preview uses ---------- */
export { openingLocal, itemRect, dims, outsideRect, spanOf };
