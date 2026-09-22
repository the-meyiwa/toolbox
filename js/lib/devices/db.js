/* ============================================================
   TOOLBOX — Device database: loading, scoring, comparing

   Data files hold plain specs (see schema.js). Everything a
   comparison page shows beyond the raw specs is derived here:
   - sub-scores (Performance, Display, Camera…) normalised against
     the rest of the category, so 90 means "near the top of phones";
   - an overall score as the weighted mean of the sub-scores;
   - "why is A better than B" reasons, ranked by how much each
     difference matters;
   - display formatting in metric or imperial units.
   ============================================================ */

import { CATEGORIES, CATEGORY_ORDER } from './schema.js';

export { CATEGORIES, CATEGORY_ORDER };

const LOADERS = {
  phones: () => Promise.all([import('./data/phones-a.js'), import('./data/phones-b.js')]).then(m => m.flatMap(x => x.default)),
  tablets: () => import('./data/tablets.js').then(m => m.default),
  laptops: () => import('./data/laptops.js').then(m => m.default),
  socs: () => import('./data/socs.js').then(m => m.default),
  cpus: () => import('./data/cpus.js').then(m => m.default),
  gpus: () => import('./data/gpus.js').then(m => m.default),
  watches: () => import('./data/watches.js').then(m => m.default),
  audio: () => import('./data/audio.js').then(m => m.default),
  consoles: () => import('./data/consoles.js').then(m => m.default),
};

/* Categories whose devices borrow benchmark data from a component category. */
const BORROWS = { phones: ['socs'], tablets: ['socs', 'cpus'], laptops: ['cpus', 'gpus'] };

const raw = new Map();       // category → array
const ready = new Map();     // category → Promise<Category data>

/* ---------- parsing helpers for text specs ---------- */
export const parse = {
  sensor(t) {        // '1/1.3"' → 0.77 ; '1"' → 1 ; '1-inch' → 1
    if (!t) return null;
    const m = /1\s*\/\s*([\d.]+)/.exec(t);
    if (m) return 1 / Number(m[1]);
    if (/(^|\D)1(\.0)?\s*("|”|-?inch|in)/i.test(t)) return 1;
    return null;
  },
  panel(t) {
    if (!t) return null;
    const s = t.toLowerCase();
    let v = /oled|amoled|micro-?led|mini-?led/.test(s) ? 0.7 : /ips|lcd|tft/.test(s) ? 0.35 : 0.4;
    if (/ltpo|tandem/.test(s)) v += 0.3;
    else if (/mini-?led/.test(s)) v += 0.15;
    return Math.min(1, v);
  },
  pixels(t) {
    const m = /(\d{3,5})\s*[x×]\s*(\d{3,5})/.exec(t || '');
    return m ? Number(m[1]) * Number(m[2]) : null;
  },
  video(t) {
    if (!t) return null;
    const s = t.toUpperCase();
    if (/8K/.test(s)) return 1;
    const fps = Number((/4K\s*@?\s*(\d+)/.exec(s) || [])[1] || 0);
    if (/4K/.test(s)) return fps >= 120 ? 0.9 : fps >= 60 ? 0.75 : 0.55;
    if (/1080|FHD/.test(s)) return 0.3;
    return 0.2;
  },
  ip(t) {
    if (!t) return 0;
    const m = /IP\s?(\d|X)(\d)/i.exec(t);
    if (!m) return /5\s?ATM|10\s?ATM|WR\d/i.test(t) ? 0.7 : 0.1;
    const dust = m[1] === 'X' ? 0 : Number(m[1]), water = Number(m[2]);
    return Math.min(1, (water / 8) * 0.85 + (dust / 6) * 0.15 + (/IP69/.test(t) ? 0.05 : 0));
  },
  wifi(t) {
    const m = /Wi-?Fi\s*(\d)(E)?/i.exec(t || '');
    return m ? Number(m[1]) + (m[2] ? 0.5 : 0) : null;
  },
  usb(t) {
    if (!t) return null;
    if (/thunderbolt|usb\s?4/i.test(t)) return 1;
    if (/3\.2 Gen 2|3\.1|3\.2|10\s?Gb/i.test(t)) return 0.75;
    if (/3\.0|3\.x|5\s?Gb/i.test(t)) return 0.6;
    return 0.3;
  },
  nm(t) {
    const m = /(\d+(?:\.\d+)?)\s*nm|N(\d)[A-Z]?\b|(\d)\s*nm-class|Intel\s*(\d+)|20A|18A/i.exec(t || '');
    if (!m) return null;
    if (/18A/i.test(t)) return 2; if (/20A/i.test(t)) return 2.5;
    return Number(m[1] || m[2] || m[3] || m[4]);
  },
  maxStorage(v) { return Array.isArray(v) ? Math.max(...v) : v ?? null; },
  gpsBands(t) { return !t ? 0 : /dual|multi|L1\s*\+\s*L5|L5/i.test(t) ? 1 : /gps|gnss/i.test(t) ? 0.6 : 0; },
  codecs(list) {
    if (!Array.isArray(list)) return null;
    const s = list.join(' ').toUpperCase();
    let v = 0.2;
    if (/AAC/.test(s)) v = 0.35;
    if (/APTX/.test(s)) v = 0.55;
    if (/APTX ADAPTIVE|APTX HD/.test(s)) v = 0.7;
    if (/LDAC|LHDC|LOSSLESS|APTX LOSSLESS/.test(s)) v = 0.9;
    if (/LOSSLESS/.test(s)) v = 1;
    return v;
  },
  res(t) { if (!t) return null; const s = t.toUpperCase(); return /8K/.test(s) ? 1 : /4K|2160/.test(s) ? 0.8 : /1440|QHD/.test(s) ? 0.6 : /1080/.test(s) ? 0.45 : 0.3; },
};

/* ---------- sub-score definitions ----------
   Each metric: [key or (device) => number, weight, options]
   options.log — compare on a log scale (benchmarks, prices, capacities)
   options.low — lower is better
   options.fixed — value is already 0..1, skip normalisation */
const M = (get, w = 1, o = {}) => ({ get: typeof get === 'string' ? (d) => d[get] : get, w, ...o });

const SCORES = {
  phones: [
    { key: 'performance', label: 'Performance', weight: 0.30, metrics: [M('gb6s', 1.2, { log: true }), M('gb6m', 1.2, { log: true }), M('antutu', 1.4, { log: true }), M('ram', 0.3, { log: true })] },
    { key: 'display', label: 'Display', weight: 0.18, metrics: [M('nits', 1), M('refresh', 1), M('ppi', 0.7), M(d => parse.panel(d.panel), 1.2, { fixed: true }), M('displaySize', 0.3)] },
    { key: 'camera', label: 'Camera', weight: 0.22, metrics: [M(d => parse.sensor(d.camMainSensor), 1.4), M('camMainAperture', 0.4, { low: true }), M(d => (d.ois ? 1 : 0), 0.5, { fixed: true }), M(d => d.teleZoom || (d.camTele ? 2 : 1), 1, { log: true }), M(d => d.camUltra || 0, 0.4), M(d => parse.video(d.video), 0.6, { fixed: true }), M('camMain', 0.3, { log: true }), M('camFront', 0.3, { log: true })] },
    { key: 'battery', label: 'Battery', weight: 0.18, metrics: [M('battery', 1.6), M('wired', 0.8, { log: true }), M(d => d.wireless || 0, 0.4), M(d => (d.reverse ? 1 : 0), 0.1, { fixed: true })] },
    { key: 'features', label: 'Features', weight: 0.12, metrics: [M(d => parse.ip(d.ip), 1, { fixed: true }), M(d => parse.wifi(d.wifi), 0.5), M('bt', 0.3), M(d => parse.usb(d.usb), 0.5, { fixed: true }), M(d => (d.nfc ? 1 : 0), 0.4, { fixed: true }), M(d => (d.esim ? 1 : 0), 0.2, { fixed: true }), M('updates', 0.8), M(d => parse.maxStorage(d.storage), 0.4, { log: true })] },
  ],
  tablets: [
    { key: 'performance', label: 'Performance', weight: 0.35, metrics: [M('gb6s', 1, { log: true }), M('gb6m', 1, { log: true }), M('antutu', 1, { log: true }), M('ram', 0.4, { log: true })] },
    { key: 'display', label: 'Display', weight: 0.30, metrics: [M('nits', 1), M('refresh', 1), M('ppi', 0.6), M(d => parse.panel(d.panel), 1.2, { fixed: true }), M('displaySize', 0.4)] },
    { key: 'battery', label: 'Battery', weight: 0.15, metrics: [M('battery', 1), M('wired', 0.6, { log: true })] },
    { key: 'portability', label: 'Portability', weight: 0.10, metrics: [M('weight', 1, { low: true }), M('thickness', 0.8, { low: true })] },
    { key: 'features', label: 'Features', weight: 0.10, metrics: [M(d => (d.stylus ? 1 : 0), 0.6, { fixed: true }), M(d => (d.keyboard ? 1 : 0), 0.4, { fixed: true }), M(d => (d.cellular ? 1 : 0), 0.3, { fixed: true }), M(d => parse.usb(d.usb), 0.5, { fixed: true }), M(d => parse.maxStorage(d.storage), 0.5, { log: true })] },
  ],
  laptops: [
    { key: 'cpu', label: 'Processor', weight: 0.28, metrics: [M('gb6s', 1, { log: true }), M('gb6m', 1.2, { log: true })] },
    { key: 'graphics', label: 'Graphics', weight: 0.18, metrics: [M(d => d._gpuScore, 1, { log: true })] },
    { key: 'display', label: 'Display', weight: 0.16, metrics: [M('nits', 1), M('refresh', 0.8), M(d => parse.pixels(d.displayRes), 0.7, { log: true }), M(d => parse.panel(d.panel), 1, { fixed: true })] },
    { key: 'battery', label: 'Battery', weight: 0.18, metrics: [M('batteryWh', 1), M('batteryLife', 1.2)] },
    { key: 'portability', label: 'Portability', weight: 0.12, metrics: [M('weight', 1.2, { low: true }), M('thickness', 0.8, { low: true })] },
    { key: 'memory', label: 'Memory & storage', weight: 0.08, metrics: [M('ram', 1, { log: true }), M('storage', 1, { log: true })] },
  ],
  socs: [
    { key: 'single', label: 'Single-core', weight: 0.30, metrics: [M('gb6s', 1, { log: true }), M('maxClock', 0.3)] },
    { key: 'multi', label: 'Multi-core', weight: 0.30, metrics: [M('gb6m', 1, { log: true }), M('cores', 0.2)] },
    { key: 'gpu', label: 'Graphics', weight: 0.25, metrics: [M('antutu', 1, { log: true }), M('wildlife', 1, { log: true })] },
    { key: 'efficiency', label: 'Efficiency & AI', weight: 0.15, metrics: [M(d => parse.nm(d.node), 1, { low: true }), M('npu', 0.6, { log: true })] },
  ],
  cpus: [
    { key: 'single', label: 'Single-core', weight: 0.35, metrics: [M('gb6s', 1.2, { log: true }), M('cb24s', 1, { log: true }), M('boostClock', 0.4)] },
    { key: 'multi', label: 'Multi-core', weight: 0.40, metrics: [M('gb6m', 1.2, { log: true }), M('cb24m', 1, { log: true }), M('threads', 0.4, { log: true }), M('l3', 0.2, { log: true })] },
    { key: 'efficiency', label: 'Efficiency', weight: 0.15, metrics: [M('tdp', 1, { low: true, log: true }), M(d => parse.nm(d.node), 0.5, { low: true })] },
    { key: 'platform', label: 'Platform', weight: 0.10, metrics: [M('pcie', 0.6), M('npu', 0.5, { log: true }), M(d => (/DDR5|LPDDR5/i.test(d.memory || '') ? 1 : 0.4), 0.5, { fixed: true })] },
  ],
  gpus: [
    { key: 'performance', label: 'Gaming performance', weight: 0.66, metrics: [M('timespy', 1.4, { log: true }), M('steelnomad', 1, { log: true }), M('tflops', 0.6, { log: true })] },
    { key: 'memory', label: 'Memory', weight: 0.16, metrics: [M('vram', 1, { log: true }), M('bandwidth', 1, { log: true })] },
    { key: 'efficiency', label: 'Efficiency', weight: 0.08, metrics: [M(d => (d.timespy && d.tdp ? d.timespy / d.tdp : null), 1)] },
    { key: 'features', label: 'Features', weight: 0.10, metrics: [M('rtCores', 0.5, { log: true }), M('tensor', 0.5, { log: true }), M(d => (/DLSS\s*4|FSR\s*4|XeSS\s*2/i.test(d.upscaler || '') ? 1 : /DLSS|FSR\s*3|XeSS/i.test(d.upscaler || '') ? 0.6 : 0.2), 0.6, { fixed: true })] },
  ],
  watches: [
    { key: 'display', label: 'Display', weight: 0.22, metrics: [M('nits', 1), M(d => parse.panel(d.panel), 1, { fixed: true }), M(d => parse.pixels(d.displayRes), 0.6, { log: true }), M(d => (d.aod ? 1 : 0), 0.4, { fixed: true })] },
    { key: 'battery', label: 'Battery', weight: 0.28, metrics: [M('batteryDays', 1, { log: true })] },
    { key: 'health', label: 'Health & fitness', weight: 0.30, metrics: [M(d => (d.sensors || []).length, 1), M(d => (d.ecg ? 1 : 0), 0.6, { fixed: true }), M(d => (d.spo2 ? 1 : 0), 0.4, { fixed: true }), M(d => parse.gpsBands(d.gps), 0.8, { fixed: true })] },
    { key: 'features', label: 'Features', weight: 0.20, metrics: [M(d => (d.lte ? 1 : 0), 0.6, { fixed: true }), M(d => (d.nfc ? 1 : 0), 0.6, { fixed: true }), M('storage', 0.4, { log: true }), M(d => parse.ip(d.water), 0.5, { fixed: true })] },
  ],
  audio: [
    { key: 'sound', label: 'Sound & ANC', weight: 0.40, metrics: [M(d => (d.anc ? 1 : 0), 1.2, { fixed: true }), M(d => parse.codecs(d.codecs), 0.8, { fixed: true }), M(d => (d.hires ? 1 : 0), 0.4, { fixed: true }), M(d => (d.spatial ? 1 : 0), 0.3, { fixed: true }), M('driver', 0.3, { log: true })] },
    { key: 'battery', label: 'Battery', weight: 0.30, metrics: [M('battery', 1, { log: true }), M('batteryTotal', 0.6, { log: true }), M(d => (d.wirelessCharging ? 1 : 0), 0.2, { fixed: true })] },
    { key: 'features', label: 'Features', weight: 0.30, metrics: [M(d => (d.multipoint ? 1 : 0), 0.8, { fixed: true }), M('bt', 0.5), M(d => parse.ip(d.water), 0.5, { fixed: true }), M('mics', 0.3)] },
  ],
  consoles: [
    { key: 'performance', label: 'Performance', weight: 0.50, metrics: [M('tflops', 1.4, { log: true }), M('ram', 0.6, { log: true })] },
    { key: 'display', label: 'Display & output', weight: 0.25, metrics: [M(d => parse.res(d.maxRes), 1, { fixed: true }), M('maxFps', 0.6), M('refresh', 0.4)] },
    { key: 'storage', label: 'Storage', weight: 0.25, metrics: [M('storage', 1, { log: true })] },
  ],
};

/* How much a difference in each field matters when writing reasons (default 1). */
const IMPORTANCE = {
  gb6s: 3, gb6m: 3, antutu: 3, timespy: 3.5, steelnomad: 2.5, cb24s: 2.4, cb24m: 2.4, tflops: 2.6, wildlife: 2,
  battery: 2.6, batteryWh: 2.4, batteryLife: 2.6, batteryDays: 2.8, batteryTotal: 1.4,
  nits: 1.6, refresh: 1.8, ppi: 1.1, wired: 1.6, wireless: 1.2, camMain: 1.1, teleZoom: 1.6, camUltra: 0.8, camFront: 0.8,
  ram: 1.6, vram: 2.2, bandwidth: 1.8, weight: 1.5, thickness: 1.1, price: 2.2, updates: 1.8, storage: 1.2,
  cores: 1.4, threads: 1.4, boostClock: 1.2, l3: 1.1, tdp: 1.2, npu: 1, displaySize: 0.9, maxFps: 1.4, driver: 0.6,
  anc: 2.6, ois: 1.2, wirelessCharging: 1.4, multipoint: 1.4, ecg: 1.4, spo2: 1.2, lte: 1.2, nfc: 1, esim: 0.8, jack: 1,
  sd: 1, fiveG: 1.4, touch: 1, cellular: 1.2, reverse: 0.7, spatial: 0.9, hires: 1, aod: 1, bt: 0.5, pcie: 1, shaders: 1.3, rtCores: 1, tensor: 0.9,
  camMainAperture: 1, maxClock: 1.1, gpuCores: 1, gpuClock: 0.8, transistors: 0.6, mics: 0.5, charger: 0.8, ramMax: 0.8,
};

/* Phrases for reasons: [when higher is better, when lower is better]. */
const PHRASE = {
  battery: 'bigger battery', batteryWh: 'bigger battery', batteryLife: 'longer rated battery life', batteryDays: 'longer battery life',
  batteryTotal: 'more total listening time with the case', weight: 'lighter', thickness: 'thinner', price: 'cheaper at launch',
  nits: 'brighter screen', refresh: 'higher refresh rate', ppi: 'sharper screen (pixel density)', displaySize: 'larger screen',
  wired: 'faster wired charging', wireless: 'faster wireless charging', ram: 'more RAM', vram: 'more video memory',
  storage: 'more storage', camTele: 'higher-resolution telephoto camera', camMain: 'higher-resolution main camera', teleZoom: 'longer optical zoom', camFront: 'higher-resolution selfie camera',
  camUltra: 'higher-resolution ultra-wide camera', camMainAperture: 'wider main-camera aperture', updates: 'longer software support',
  gb6s: 'higher Geekbench 6 single-core score', gb6m: 'higher Geekbench 6 multi-core score', antutu: 'higher AnTuTu score',
  timespy: 'higher 3DMark Time Spy score', steelnomad: 'higher 3DMark Steel Nomad score', wildlife: 'higher 3DMark Wild Life score',
  cb24s: 'higher Cinebench 2024 single-core score', cb24m: 'higher Cinebench 2024 multi-core score', tflops: 'more compute (TFLOPS)',
  cores: 'more cores', threads: 'more threads', boostClock: 'higher boost clock', maxClock: 'higher peak clock', l3: 'more L3 cache',
  tdp: 'lower power draw', bandwidth: 'more memory bandwidth', shaders: 'more shader units', npu: 'faster NPU for AI',
  maxFps: 'higher maximum frame rate', driver: 'larger drivers', bt: 'newer Bluetooth', pcie: 'newer PCIe generation',
  rtCores: 'more ray-tracing units', tensor: 'more AI cores', gpuCores: 'more GPU cores', gpuClock: 'higher GPU clock',
  ramMax: 'more maximum RAM', charger: 'faster charger', mics: 'more microphones', transistors: 'more transistors',
};
const BOOL_PHRASE = {
  ois: 'Has optical image stabilisation', wireless: 'Supports wireless charging', reverse: 'Can charge other devices wirelessly',
  sd: 'Has a memory card slot', jack: 'Has a 3.5 mm headphone jack', nfc: 'Has NFC for payments', esim: 'Supports eSIM', fiveG: 'Supports 5G',
  touch: 'Has a touchscreen', cellular: 'Offers a cellular model', anc: 'Has active noise cancelling', spatial: 'Supports spatial audio',
  hires: 'Supports hi-res wireless audio', multipoint: 'Connects to two devices at once (multipoint)', wirelessCharging: 'Case charges wirelessly',
  aod: 'Has an always-on display', ecg: 'Can take an ECG', spo2: 'Measures blood oxygen', lte: 'Available with LTE',
};

/* ---------- loading ---------- */
export function loadCategory(cat) {
  if (ready.has(cat)) return ready.get(cat);
  const p = (async () => {
    const [list, ...borrowed] = await Promise.all([LOADERS[cat](), ...(BORROWS[cat] || []).map(c => loadRaw(c))]);
    const lookups = Object.fromEntries((BORROWS[cat] || []).map((c, i) => [c, new Map(borrowed[i].map(d => [d.id, d]))]));
    const devices = list.map(d => enrich(cat, { ...d, category: cat }, lookups));
    score(cat, devices);
    const byId = new Map(devices.map(d => [d.id, d]));
    const brands = [...new Set(devices.map(d => d.brand))].sort((a, b) => a.localeCompare(b));
    const years = [...new Set(devices.map(d => (d.released || '').slice(0, 4)).filter(Boolean))].sort().reverse();
    return { cat, devices, byId, brands, years, def: CATEGORIES[cat], scores: SCORES[cat] };
  })();
  ready.set(cat, p);
  return p;
}
async function loadRaw(cat) {
  if (!raw.has(cat)) raw.set(cat, await LOADERS[cat]());
  return raw.get(cat);
}

/** Fill benchmark gaps from the device's chip, and attach derived values. */
function enrich(cat, d, lookups) {
  const derived = {};
  if ((cat === 'phones' || cat === 'tablets') && d.chipId) {
    const chip = lookups.socs?.get(d.chipId) || lookups.cpus?.get(d.chipId) || lookups.cpus?.get(`apple-${d.chipId}`);
    if (chip) {
      for (const k of ['gb6s', 'gb6m', 'antutu']) if (d[k] == null && chip[k] != null) { d[k] = chip[k]; derived[k] = `typical for ${chip.name}`; }
      d._chip = chip.id; d._chipCat = lookups.socs?.get(chip.id) === chip ? 'socs' : 'cpus';
    }
  }
  if (cat === 'laptops') {
    const cpu = d.cpuId && lookups.cpus?.get(d.cpuId);
    if (cpu) for (const k of ['gb6s', 'gb6m']) if (d[k] == null && cpu[k] != null) { d[k] = cpu[k]; derived[k] = `typical for ${cpu.name}`; }
    const gpu = d.gpuId && lookups.gpus?.get(d.gpuId);
    if (gpu?.timespy) d._gpuScore = gpu.timespy;
    else if (/apple m\d/i.test(d.cpu || '')) {
      // Apple GPUs are not in the graphics-card list; estimate from the chip tier
      const s = d.cpu.toLowerCase();
      const gen = Number((/m(\d)/.exec(s) || [])[1] || 1);
      const tier = /ultra/.test(s) ? 4.2 : /max/.test(s) ? 3 : /pro/.test(s) ? 1.7 : 1;
      d._gpuScore = Math.round(2400 * tier * (1 + (gen - 1) * 0.18));
      derived._gpuScore = 'estimated from the chip tier';
    } else if (/arc|radeon|iris|uhd|adreno|intel graphics/i.test(d.gpu || '')) {
      const g = d.gpu.toLowerCase();
      d._gpuScore = /890m|8060s/.test(g) ? 4000 : /880m|780m|arc 140v|arc 140t|arc b390/.test(g) ? 3300 : /arc/.test(g) ? 2800 : /adreno/.test(g) ? 2000 : 1500;
      derived._gpuScore = 'estimated for integrated graphics';
    }
    d._cpu = cpu?.id; d._gpu = gpu?.id;
  }
  d._derived = derived;
  d._search = `${d.name} ${d.brand} ${d.chip || ''} ${d.cpu || ''} ${d.gpu || ''} ${(d.released || '').slice(0, 4)}`.toLowerCase();
  return d;
}

/* ---------- scoring ---------- */
function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function score(cat, devices) {
  const defs = SCORES[cat] || [];
  for (const sub of defs) {
    for (const m of sub.metrics) {
      if (m.fixed) continue;
      const vals = devices.map(d => m.get(d)).filter(v => typeof v === 'number' && isFinite(v) && v > 0).map(v => (m.log ? Math.log(v) : v)).sort((a, b) => a - b);
      m.lo = quantile(vals, 0.03); m.hi = quantile(vals, 0.97);
      if (m.hi === m.lo) m.hi = m.lo + 1;
    }
  }
  for (const d of devices) {
    d._scores = {};
    let total = 0, totalW = 0;
    for (const sub of defs) {
      let s = 0, w = 0;
      for (const m of sub.metrics) {
        let v = m.get(d);
        if (typeof v !== 'number' || !isFinite(v)) continue;
        let n;
        if (m.fixed) n = v;
        else {
          if (v <= 0 && m.log) continue;
          const x = m.log ? Math.log(v) : v;
          n = (x - m.lo) / (m.hi - m.lo);
          if (m.low) n = 1 - n;
        }
        s += Math.max(0, Math.min(1, n)) * m.w; w += m.w;
      }
      // a sub-score needs at least a third of its weight to be meaningful
      const full = sub.metrics.reduce((a, m) => a + m.w, 0);
      if (w >= full / 3 || (w > 0 && sub.metrics.length === 1)) {
        const val = s / w;
        d._scores[sub.key] = Math.round(15 + val * 84);
        total += d._scores[sub.key] * sub.weight; totalW += sub.weight;
      } else d._scores[sub.key] = null;
    }
    d._score = totalW >= 0.5 ? Math.round(total / totalW) : null;
  }
  // rank within the category
  const ranked = devices.filter(d => d._score != null).sort((a, b) => b._score - a._score);
  ranked.forEach((d, i) => { d._rank = i + 1; });
  devices._ranked = ranked.length;
}

/* ---------- formatting ---------- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(v) {
  const m = /^(\d{4})(?:-(\d{2}))?/.exec(v || '');
  if (!m) return v || '';
  return m[2] ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : m[1];
}
const num = (v, dp = 0) => Number(v).toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: 0 });

/** Human text for a field value. units: 'metric' | 'imperial'. */
export function formatValue(field, v, units = 'metric') {
  if (v == null || v === '') return '';
  switch (field.type) {
    case 'bool': return v ? 'Yes' : 'No';
    case 'list': return Array.isArray(v) ? v.join(', ') : String(v);
    case 'nums': {
      const list = Array.isArray(v) ? v : [v];
      return list.map(x => (field.unit === 'GB' && x >= 1024 ? `${num(x / 1024, 1)} TB` : `${num(x)}`)).join(' / ') + (list.every(x => x < 1024) && field.unit ? ` ${field.unit}` : '');
    }
    case 'text':
      if (field.key === 'released') return fmtDate(v);
      if (field.key === 'dimensions' && units === 'imperial') {
        const parts = String(v).split(/\s*[x×]\s*/).map(Number);
        if (parts.every(n => isFinite(n))) return `${parts.map(n => num(n / 25.4, 2)).join(' × ')} in`;
      }
      if (field.key === 'dimensions') return `${String(v).replace(/x/g, ' × ')} mm`;
      return String(v);
    default: {
      if (typeof v !== 'number') return String(v);
      const u = field.unit;
      if (field.key === 'price') return `$${num(v)}`;
      if (units === 'imperial') {
        if (u === 'g') return v >= 453.6 ? `${num(v / 453.592, 2)} lb` : `${num(v / 28.3495, 2)} oz`;
        if (u === 'kg') return `${num(v * 2.20462, 2)} lb`;
        if (u === 'mm' && field.key !== 'driver') return `${num(v / 25.4, 2)} in`;
      }
      if (u === 'GB' && v >= 1024) return `${num(v / 1024, 1)} TB`;
      if (u === 'f/') return `f/${num(v, 2)}`;
      if (u === 'x') return `${num(v, 1)}×`;
      if (field.key === 'bt' || field.key === 'pcie') return num(v, 1);
      if (field.key === 'batteryDays' && v < 2) return `${num(v * 24)} h`;
      const dp = v % 1 ? (v < 10 ? 2 : 1) : 0;
      return u ? `${num(v, dp)} ${u}` : num(v, dp);
    }
  }
}

/** Numeric value used to compare a field between two devices (null when not comparable). */
export function comparable(field, v) {
  if (v == null) return null;
  if (field.type === 'bool') return v ? 1 : 0;
  if (field.type === 'nums') return parse.maxStorage(v);
  if (field.type === 'num') return typeof v === 'number' ? v : null;
  if (field.key === 'released') { const m = /^(\d{4})-(\d{2})/.exec(v); return m ? Number(m[1]) * 12 + Number(m[2]) : null; }
  return null;
}

/** 1 when a wins, -1 when b wins, 0 when equal or not comparable. */
export function winner(field, a, b) {
  if (!field.better) return 0;
  const x = comparable(field, a), y = comparable(field, b);
  if (x == null || y == null || x === y) return 0;
  const aBetter = field.better === 'high' ? x > y : x < y;
  return aBetter ? 1 : -1;
}

/** Ranked reasons why `a` beats `b`. */
export function reasons(cat, a, b, units = 'metric', limit = 6) {
  const out = [];
  for (const field of CATEGORIES[cat].fields) {
    if (!field.better || field.key === 'released') continue;
    const va = a[field.key], vb = b[field.key];
    if (field.type === 'bool') {
      if (va === true && vb === false && BOOL_PHRASE[field.key]) out.push({ key: field.key, weight: (IMPORTANCE[field.key] || 1) * 0.55, title: BOOL_PHRASE[field.key], detail: '' });
      continue;
    }
    const x = comparable(field, va), y = comparable(field, vb);
    if (x == null || y == null || x <= 0 || y <= 0 || x === y) continue;
    const better = field.better === 'high' ? x > y : x < y;
    if (!better) continue;
    const ratio = field.better === 'high' ? x / y : y / x;
    const rel = ratio - 1;
    if (rel < 0.03) continue;
    let phrase = PHRASE[field.key] || `better ${field.label.toLowerCase()}`;
    if (field.type === 'nums') phrase = `more ${field.label.toLowerCase().replace(' options', '')} in the top configuration`;
    const pct = field.better === 'high' ? Math.round(rel * 100) : Math.round((1 - x / y) * 100);
    const amount = ratio >= 2 && field.better === 'high' ? `${num(ratio, 1)}× ` : `${pct}% `;
    const detail = `${formatValue(field, va, units)} vs ${formatValue(field, vb, units)}`;
    const title = field.key === 'price' ? `${pct}% cheaper at launch`
      : field.key === 'weight' || field.key === 'thickness' ? `${pct}% ${phrase}`
      : `${amount}${phrase}`;
    out.push({ key: field.key, weight: (IMPORTANCE[field.key] || 1) * Math.min(1.6, Math.log2(1 + rel) * 2.2), title: title.charAt(0).toUpperCase() + title.slice(1), detail });
  }
  // derived camera sensor comparison for phones
  if (cat === 'phones') {
    const sa = parse.sensor(a.camMainSensor), sb = parse.sensor(b.camMainSensor);
    if (sa && sb && sa / sb > 1.08) out.push({ key: 'sensor', weight: 2.2, title: `${Math.round((sa * sa / (sb * sb) - 1) * 100)}% larger main camera sensor`, detail: `${a.camMainSensor} vs ${b.camMainSensor}` });
    const pa = parse.ip(a.ip), pb = parse.ip(b.ip);
    if (pa - pb > 0.1) out.push({ key: 'ip', weight: 1.4, title: 'Better water and dust resistance', detail: `${a.ip || 'none'} vs ${b.ip || 'none'}` });
    const qa = parse.panel(a.panel), qb = parse.panel(b.panel);
    if (qa - qb >= 0.3) out.push({ key: 'panel', weight: 1.4, title: 'Better display technology', detail: `${a.panel} vs ${b.panel}` });
  }
  return out.sort((p, q) => q.weight - p.weight).slice(0, limit);
}

/** Search a loaded category. */
export function searchDevices(data, query, limit = 12) {
  const q = query.trim().toLowerCase();
  if (!q) return data.devices.slice().sort((a, b) => (b.released || '').localeCompare(a.released || '') || (b._score || 0) - (a._score || 0)).slice(0, limit);
  const words = q.split(/\s+/);
  const scored = [];
  for (const d of data.devices) {
    if (!words.every(w => d._search.includes(w))) continue;
    const name = d.name.toLowerCase();
    let s = 0;
    if (name === q) s += 100;
    if (name.startsWith(q)) s += 40;
    if (`${d.brand} ${d.name}`.toLowerCase().startsWith(q)) s += 30;
    s += (d._score || 0) / 10 + Number((d.released || '0').slice(0, 4)) / 1000;
    scored.push([s, d]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, limit).map(x => x[1]);
}

/** Two sensible defaults to open a category with (newest flagships from different brands). */
export function defaultPair(data) {
  const byScore = data.devices.filter(d => d._score != null).sort((a, b) => (b.released || '').localeCompare(a.released || '') || b._score - a._score);
  const recent = byScore.filter(d => (d.released || '') >= (byScore[0]?.released || '').slice(0, 4) - 1 + '');
  const pool = (recent.length > 4 ? recent : byScore).sort((a, b) => b._score - a._score);
  const a = pool[0];
  const sameKind = (d) => (a?.segment ? d.segment === a.segment : true) && (a?.type ? d.type === a.type : true);
  const b = pool.find(d => d.id !== a?.id && d.brand !== a?.brand && sameKind(d)) || pool.find(d => d.id !== a?.id && sameKind(d)) || pool[1];
  return [a?.id, b?.id];
}

/** A few pairings people would plausibly compare next. */
export function suggestions(data, current, n = 6) {
  const d = data.byId.get(current);
  if (!d) return [];
  const near = data.devices.filter(x => x.id !== d.id && x._score != null && d._score != null)
    .map(x => [Math.abs(x._score - d._score) + Math.abs(Number((x.released || '0').slice(0, 4)) - Number((d.released || '0').slice(0, 4))) * 4 + (x.brand === d.brand ? 3 : 0), x])
    .sort((p, q) => p[0] - q[0]).slice(0, n).map(x => x[1]);
  return near;
}
