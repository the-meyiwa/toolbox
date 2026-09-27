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

import { CATEGORIES, CATEGORY_ORDER, CATEGORY_GROUPS } from './schema.js';

export { CATEGORIES, CATEGORY_ORDER, CATEGORY_GROUPS };

const LOADERS = {
  phones: () => Promise.all([import('./data/phones-a.js'), import('./data/phones-b.js')]).then(m => m.flatMap(x => x.default)),
  tablets: () => import('./data/tablets.js').then(m => m.default),
  laptops: () => import('./data/laptops.js').then(m => m.default),
  socs: () => Promise.all([import('./data/socs.js'), import('./data/socs-more.js')]).then(m => m.flatMap(x => x.default)),
  cpus: () => Promise.all([import('./data/cpus.js'), import('./data/cpus-legacy.js')]).then(m => m.flatMap(x => x.default)),
  gpus: () => Promise.all([import('./data/gpus.js'), import('./data/gpus-legacy.js')]).then(m => m.flatMap(x => x.default)),
  watches: () => import('./data/watches.js').then(m => m.default),
  audio: () => Promise.all([import('./data/audio.js'), import('./data/audio-more.js')]).then(m => m.flatMap(x => x.default)),
  consoles: () => import('./data/consoles.js').then(m => m.default),
  tvs: () => import('./data/tvs.js').then(m => m.default),
  monitors: () => import('./data/monitors.js').then(m => m.default),
  speakers: () => import('./data/speakers.js').then(m => m.default),
  chargers: () => import('./data/chargers.js').then(m => m.default),
  powerbanks: () => import('./data/powerbanks.js').then(m => m.default),
  printers: () => import('./data/printers.js').then(m => m.default),
  copiers: () => import('./data/copiers.js').then(m => m.default),
  coffee: () => import('./data/coffee.js').then(m => m.default),
  inverters: () => import('./data/inverters.js').then(m => m.default),
  ups: () => import('./data/ups.js').then(m => m.default),
  guitars: () => import('./data/guitars.js').then(m => m.default),
  keyboards: () => import('./data/keyboards.js').then(m => m.default),
  evs: () => import('./data/evs.js').then(m => m.default),
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
  /** Contrast / black-level quality of a TV or monitor panel, 0..1. */
  screen(t, zones) {
    if (!t) return null;
    const s = t.toLowerCase();
    if (/oled/.test(s)) return /tandem|mla|4th gen|glare-free 2/.test(s) ? 1 : 0.95;
    const z = Number(zones) || 0;
    const zoneBonus = z ? Math.min(0.25, Math.log10(Math.max(10, z)) / 16) : 0;
    if (/mini-?led/.test(s)) return Math.min(0.9, (/va/.test(s) ? 0.6 : 0.5) + zoneBonus);
    if (/full-array/.test(s)) return (/va/.test(s) ? 0.5 : 0.4) + zoneBonus;
    if (/ips black/.test(s)) return 0.35;
    if (/\bva\b|va\)|\(va/.test(s)) return 0.4;
    if (/ips/.test(s)) return 0.25;
    if (/tn/.test(s)) return 0.15;
    return 0.3;
  },
  hdrFormats(list) {
    if (!Array.isArray(list)) return null;
    const s = list.join(' ').toLowerCase();
    return Math.min(1, (/hdr10\b|hdr10(?!\+)/.test(s) ? 0.4 : 0.2) + (/dolby vision/.test(s) ? 0.35 : 0) + (/hdr10\+/.test(s) ? 0.2 : 0) + (/hlg/.test(s) ? 0.05 : 0));
  },
  hdrCert(t) {
    if (!t) return 0;
    const s = t.toLowerCase();
    if (/true black 600|true black 500/.test(s)) return 1;
    if (/true black 400/.test(s)) return 0.85;
    const m = /displayhdr\s*(\d{3,4})/.exec(s);
    if (m) return Math.min(1, Number(m[1]) / 1400);
    if (/dolby vision/.test(s)) return 0.8;
    return /hdr/.test(s) ? 0.1 : 0;
  },
  vrr(list) {
    if (!Array.isArray(list) || !list.length) return 0;
    const s = list.join(' ').toLowerCase();
    let v = 0.4;
    if (/g-sync/.test(s)) v += 0.3;
    if (/freesync premium|hdmi forum/.test(s)) v += 0.3;
    return Math.min(1, v);
  },
  stand(t) {
    if (!t) return null;
    const s = t.toLowerCase();
    if (/sold separately/.test(s)) return 0.3;
    return Math.min(1, 0.2 + ['height', 'tilt', 'swivel', 'pivot'].filter(k => s.includes(k)).length * 0.2);
  },
  monitorPorts(d) {
    const s = `${d.dp || ''} ${d.hdmi || ''}`.toLowerCase();
    let v = 0.3;
    if (/hdmi 2\.1/.test(s)) v += 0.25;
    if (/displayport 2\.1|uhbr/.test(s)) v += 0.35;
    else if (/displayport 1\.4/.test(s)) v += 0.15;
    if (/in\/out/.test(s)) v += 0.1;
    return Math.min(1, v);
  },
  /** Guitar pickup layout versatility, 0..1 (HSS/HSH most flexible). */
  pickups(t) {
    if (!t) return null;
    const s = String(t).toUpperCase();
    const h = (s.match(/H/g) || []).length, sc = (s.match(/S(?!\w)/g) || s.match(/S/g) || []).length;
    if (/P90/.test(s)) return 0.6;
    if (h && sc) return 1;
    if (h >= 2 || sc >= 3) return 0.75;
    return 0.5;
  },
  keyAction(t) {
    if (!t) return null;
    const s = t.toLowerCase();
    if (/wood|escapement|let-off|triple-sensor|gex|nwx/.test(s)) return 1;
    if (/hammer|graded|pha|ghs|ghc/.test(s)) return 0.8;
    if (/semi-weighted|fatar/.test(s)) return 0.55;
    if (/synth|organ|touch/.test(s)) return 0.35;
    return 0.25;
  },
  heating(t) {
    if (!t) return null;
    const s = t.toLowerCase();
    if (/dual/.test(s)) return 1;
    if (/thermojet/.test(s)) return 0.8;
    if (/brass|boiler/.test(s)) return 0.65;
    if (/thermocoil|thermoblock/.test(s)) return 0.55;
    return 0.4;
  },
  milk(t) { if (!t) return null; const s = t.toLowerCase(); return /^none/.test(s) ? 0 : /automatic|lattego|lattecrema|fine-foam/.test(s) ? 1 : /frother/.test(s) ? 0.4 : 0.6; },
  pdLevel(t) { if (!t) return null; const s = String(t); return /3\.1|EPR/i.test(s) ? 1 : /3\.0|PD/.test(s) ? 0.7 : 0.2; },
  sine(t) { if (!t) return null; return /pure/i.test(t) ? 1 : /pwm|simulated|stepped/i.test(t) ? 0.4 : 0.6; },
  topology(t) { if (!t) return null; return /online/i.test(t) ? 1 : /line/i.test(t) ? 0.6 : 0.25; },
  managed(t) { if (!t) return 0; return /none/i.test(t) ? 0 : 1; },
  screenKind(t) { if (!t) return 0; return /touch/i.test(t) ? 1 : /lcd|oled|colour|color/i.test(t) ? 0.6 : /none|button/i.test(t) ? 0.1 : 0.3; },
  /** EV range on an EPA-like basis: EPA as is, WLTP × 0.88, CLTC × 0.75. */
  evRange(d) { return d.rangeEpa ?? (d.rangeWltp ? Math.round(d.rangeWltp * 0.88) : d.rangeCltc ? Math.round(d.rangeCltc * 0.75) : null); },
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
  tvs: [
    { key: 'picture', label: 'Picture quality', weight: 0.35, metrics: [M(d => parse.screen(d.panel, d.zones), 1.6, { fixed: true }), M('dciP3', 0.8), M(d => parse.pixels(d.displayRes), 0.3, { log: true })] },
    { key: 'hdr', label: 'Brightness & HDR', weight: 0.25, metrics: [M('nits', 1.4, { log: true }), M(d => parse.hdrFormats(d.hdr), 0.8, { fixed: true })] },
    { key: 'gaming', label: 'Motion & gaming', weight: 0.20, metrics: [M('refresh', 1, { log: true }), M('inputLag', 0.8, { low: true }), M(d => d.hdmi21 ?? null, 0.8), M(d => parse.vrr(d.vrr), 0.4, { fixed: true })] },
    { key: 'features', label: 'Sound & features', weight: 0.20, metrics: [M('audioW', 0.9, { log: true }), M(d => (d.atmos ? 1 : 0), 0.3, { fixed: true }), M('displaySize', 0.8), M(d => parse.wifi(d.wifi), 0.3)] },
  ],
  monitors: [
    { key: 'picture', label: 'Picture quality', weight: 0.30, metrics: [M(d => parse.screen(d.panel, d.zones), 1.4, { fixed: true }), M('dciP3', 0.8), M('ppi', 0.8), M(d => parse.pixels(d.displayRes), 0.4, { log: true })] },
    { key: 'hdr', label: 'Brightness & HDR', weight: 0.20, metrics: [M('nits', 1.2, { log: true }), M('sdrNits', 0.4), M(d => parse.hdrCert(d.hdrCert), 0.8, { fixed: true })] },
    { key: 'motion', label: 'Motion & gaming', weight: 0.30, metrics: [M('refresh', 1.4, { log: true }), M('response', 1, { low: true, log: true }), M(d => parse.vrr(d.vrr), 0.4, { fixed: true })] },
    { key: 'features', label: 'Connectivity & design', weight: 0.20, metrics: [M(d => d.usbPd ?? null, 0.8), M(d => (d.kvm ? 1 : 0), 0.4, { fixed: true }), M(d => parse.stand(d.stand), 0.5, { fixed: true }), M(d => parse.monitorPorts(d), 0.6, { fixed: true }), M(d => (d.speakers ? 1 : 0), 0.2, { fixed: true }), M('displaySize', 0.3)] },
  ],
  consoles: [
    { key: 'performance', label: 'Performance', weight: 0.50, metrics: [M('tflops', 1.4, { log: true }), M('ram', 0.6, { log: true })] },
    { key: 'display', label: 'Display & output', weight: 0.25, metrics: [M(d => parse.res(d.maxRes), 1, { fixed: true }), M('maxFps', 0.6), M('refresh', 0.4)] },
    { key: 'storage', label: 'Storage', weight: 0.25, metrics: [M('storage', 1, { log: true })] },
  ],
  speakers: [
    { key: 'sound', label: 'Sound', weight: 0.4, metrics: [M('outputW', 1.2, { log: true }), M('bassLow', 0.6, { low: true }), M(d => (d.stereo ? 1 : 0), 0.5, { fixed: true }), M(d => parse.codecs(d.codecs), 0.5, { fixed: true })] },
    { key: 'battery', label: 'Battery', weight: 0.25, metrics: [M('battery', 1, { log: true }), M(d => (d.chargeOut ? 1 : 0), 0.3, { fixed: true })] },
    { key: 'durability', label: 'Durability', weight: 0.15, metrics: [M(d => parse.ip(d.water), 1, { fixed: true }), M(d => (d.floats ? 1 : 0), 0.3, { fixed: true })] },
    { key: 'features', label: 'Features', weight: 0.2, metrics: [M('bt', 0.4), M(d => (d.wifi ? 1 : 0), 0.6, { fixed: true }), M(d => (d.mic ? 1 : 0), 0.4, { fixed: true }), M(d => (d.aux ? 1 : 0), 0.3, { fixed: true }), M(d => (d.app ? 1 : 0), 0.3, { fixed: true }), M(d => (d.pairing && !/^none/i.test(d.pairing) ? 1 : 0), 0.3, { fixed: true })] },
  ],
  chargers: [
    { key: 'power', label: 'Power', weight: 0.5, metrics: [M('maxW', 1.4, { log: true }), M('singleW', 1, { log: true }), M('portCount', 0.6)] },
    { key: 'standards', label: 'Charging standards', weight: 0.2, metrics: [M(d => (d.pps ? 1 : 0), 0.8, { fixed: true }), M(d => parse.pdLevel(d.pd), 0.6, { fixed: true }), M(d => (d.gan ? 1 : 0), 0.5, { fixed: true })] },
    { key: 'cable', label: 'Cable quality', weight: 0.15, metrics: [M('data', 1, { log: true }), M(d => (d.video ? 1 : 0), 0.5, { fixed: true }), M(d => (d.emarker ? 1 : 0), 0.3, { fixed: true }), M(d => (d.braided ? 1 : 0), 0.3, { fixed: true })] },
    { key: 'portability', label: 'Size & weight', weight: 0.15, metrics: [M('weight', 1, { low: true, log: true }), M(d => (d.foldingPlug ? 1 : 0), 0.4, { fixed: true })] },
  ],
  powerbanks: [
    { key: 'capacity', label: 'Capacity', weight: 0.35, metrics: [M('wh', 1.4, { log: true }), M('capacity', 0.4, { log: true })] },
    { key: 'charging', label: 'Charging speed', weight: 0.35, metrics: [M('maxOut', 1, { log: true }), M('singleOut', 0.8, { log: true }), M('input', 0.8, { log: true }), M('rechargeTime', 0.6, { low: true, log: true }), M('acW', 0.5, { log: true })] },
    { key: 'portability', label: 'Portability', weight: 0.15, metrics: [M('weight', 1, { low: true, log: true }), M(d => (d.wh && d.weight ? d.wh / d.weight * 1000 : null), 0.8)] },
    { key: 'features', label: 'Features', weight: 0.15, metrics: [M('portCount', 0.6), M(d => (d.passthrough ? 1 : 0), 0.4, { fixed: true }), M(d => (d.pps ? 1 : 0), 0.4, { fixed: true }), M(d => (d.magnetic ? 1 : 0), 0.3, { fixed: true }), M(d => (d.wireless ? 1 : 0), 0.3, { fixed: true })] },
  ],
  printers: [
    { key: 'speed', label: 'Speed', weight: 0.3, metrics: [M('ppmBlack', 1, { log: true }), M('ppmColor', 1, { log: true }), M('firstPage', 0.4, { low: true })] },
    { key: 'cost', label: 'Running cost', weight: 0.3, metrics: [M('cppBlack', 1, { low: true, log: true }), M('cppColor', 0.8, { low: true, log: true }), M('yieldBlack', 0.5, { log: true })] },
    { key: 'paper', label: 'Paper handling', weight: 0.2, metrics: [M(d => (d.duplex ? 1 : 0), 0.8, { fixed: true }), M(d => d.adf || 0, 0.5), M('tray', 0.5), M('duty', 0.3, { log: true })] },
    { key: 'features', label: 'Quality & connectivity', weight: 0.2, metrics: [M('dpi', 0.6, { log: true }), M('colors', 0.6), M(d => (d.wifi ? 1 : 0), 0.5, { fixed: true }), M(d => (d.ethernet ? 1 : 0), 0.5, { fixed: true })] },
  ],
  copiers: [
    { key: 'speed', label: 'Speed', weight: 0.35, metrics: [M('ppmBlack', 1), M('ppmColor', 0.8), M('firstCopy', 0.4, { low: true }), M('warmUp', 0.2, { low: true })] },
    { key: 'scanning', label: 'Scanning', weight: 0.2, metrics: [M('scanIpm', 1, { log: true }), M('adf', 0.6)] },
    { key: 'paper', label: 'Paper & volume', weight: 0.25, metrics: [M('paperStd', 0.6, { log: true }), M('paperMax', 0.6, { log: true }), M('volume', 0.8, { log: true })] },
    { key: 'features', label: 'Controller & options', weight: 0.2, metrics: [M(d => (d.ppmColor ? 1 : 0), 0.5, { fixed: true }), M('memory', 0.5, { log: true }), M('storage', 0.4, { log: true }), M('screen', 0.6), M(d => (d.fax ? 1 : 0), 0.2, { fixed: true })] },
  ],
  coffee: [
    { key: 'brewing', label: 'Brewing', weight: 0.4, metrics: [M(d => (d.pid ? 1 : 0), 0.8, { fixed: true }), M(d => (d.grinder ? 1 : 0), 1, { fixed: true }), M('grindSettings', 0.5, { log: true }), M('heatUp', 0.6, { low: true, log: true }), M(d => parse.heating(d.heating), 0.6, { fixed: true })] },
    { key: 'milk', label: 'Milk & drinks', weight: 0.3, metrics: [M(d => (d.autoMilk ? 1 : 0), 1, { fixed: true }), M('drinks', 0.8, { log: true }), M(d => parse.milk(d.milk), 0.5, { fixed: true })] },
    { key: 'convenience', label: 'Convenience', weight: 0.3, metrics: [M(d => (d.programmable ? 1 : 0), 0.5, { fixed: true }), M(d => (d.app ? 1 : 0), 0.4, { fixed: true }), M('tank', 0.8), M('beans', 0.3), M('cups', 0.4)] },
  ],
  inverters: [
    { key: 'output', label: 'Output', weight: 0.35, metrics: [M('ratedW', 1.2, { log: true }), M('surgeW', 0.6, { log: true }), M('efficiency', 0.8), M('transfer', 0.4, { low: true }), M(d => parse.sine(d.waveform), 0.4, { fixed: true })] },
    { key: 'solar', label: 'Solar', weight: 0.35, metrics: [M('pvW', 1, { log: true }), M('pvVoc', 0.4), M('mppt', 0.5), M(d => (d.gridTie ? 1 : 0), 0.3, { fixed: true })] },
    { key: 'battery', label: 'Battery', weight: 0.15, metrics: [M('chargeA', 1, { log: true }), M(d => (d.lithium ? 1 : 0), 0.5, { fixed: true })] },
    { key: 'features', label: 'Features', weight: 0.15, metrics: [M('parallel', 0.6), M(d => (d.generator ? 1 : 0), 0.4, { fixed: true }), M(d => parse.managed(d.monitoring), 0.4, { fixed: true })] },
  ],
  ups: [
    { key: 'power', label: 'Power quality', weight: 0.4, metrics: [M('watts', 1.2, { log: true }), M('va', 0.6, { log: true }), M(d => parse.sine(d.waveform), 0.8, { fixed: true }), M(d => parse.topology(d.type), 0.8, { fixed: true }), M(d => (d.avr ? 1 : 0), 0.4, { fixed: true }), M('transfer', 0.5, { low: true })] },
    { key: 'battery', label: 'Battery', weight: 0.3, metrics: [M('runtimeHalf', 1, { log: true }), M(d => (d.hotSwap ? 1 : 0), 0.4, { fixed: true }), M(d => (d.extBattery ? 1 : 0), 0.4, { fixed: true })] },
    { key: 'outlets', label: 'Outlets', weight: 0.15, metrics: [M('outlets', 1)] },
    { key: 'management', label: 'Management', weight: 0.15, metrics: [M(d => (d.usb ? 1 : 0), 0.4, { fixed: true }), M(d => parse.managed(d.network), 0.6, { fixed: true }), M(d => parse.screenKind(d.display), 0.4, { fixed: true })] },
  ],
  guitars: [
    { key: 'versatility', label: 'Versatility', weight: 0.4, metrics: [M(d => parse.pickups(d.pickups), 1, { fixed: true }), M(d => (d.coilSplit ? 1 : 0), 0.6, { fixed: true }), M(d => (d.tremolo ? 1 : 0), 0.3, { fixed: true }), M(d => (d.strings > 6 ? 1 : 0), 0.2, { fixed: true })] },
    { key: 'playability', label: 'Playability', weight: 0.3, metrics: [M('frets', 1), M('weight', 1, { low: true })] },
    { key: 'hardware', label: 'Hardware', weight: 0.3, metrics: [M(d => (d.lockingTuners ? 1 : 0), 0.8, { fixed: true }), M(d => (!d.case ? null : /hardshell/i.test(d.case) ? 1 : /case/i.test(d.case) ? 0.7 : /bag/i.test(d.case) ? 0.4 : 0), 0.6, { fixed: true }), M(d => (/set|through/i.test(d.neckJoint || '') ? 1 : 0.5), 0.4, { fixed: true })] },
  ],
  keyboards: [
    { key: 'keys', label: 'Keys & action', weight: 0.35, metrics: [M('keys', 1), M(d => (d.weighted ? 1 : 0), 0.8, { fixed: true }), M(d => (d.aftertouch ? 1 : 0), 0.4, { fixed: true }), M(d => parse.keyAction(d.action), 0.8, { fixed: true })] },
    { key: 'sound', label: 'Sound', weight: 0.35, metrics: [M('polyphony', 1, { log: true }), M('voices', 0.8, { log: true }), M('speakers', 0.6, { log: true })] },
    { key: 'features', label: 'Features', weight: 0.2, metrics: [M('rhythms', 0.4, { log: true }), M(d => (d.bluetooth ? 1 : 0), 0.6, { fixed: true }), M(d => (d.battery ? 1 : 0), 0.3, { fixed: true }), M(d => parse.screenKind(d.display), 0.4, { fixed: true }), M(d => (!d.sequencer || /^none/i.test(d.sequencer) ? 0 : 1), 0.4, { fixed: true })] },
    { key: 'portability', label: 'Portability', weight: 0.1, metrics: [M('weight', 1, { low: true, log: true })] },
  ],
  evs: [
    { key: 'range', label: 'Range', weight: 0.3, metrics: [M(d => parse.evRange(d), 1.4), M('batteryKwh', 0.4, { log: true })] },
    { key: 'performance', label: 'Performance', weight: 0.25, metrics: [M('powerKw', 1, { log: true }), M('accel', 1, { low: true, log: true }), M('topSpeed', 0.4)] },
    { key: 'charging', label: 'Charging', weight: 0.25, metrics: [M('dcKw', 1, { log: true }), M('dc10to80', 0.8, { low: true }), M('voltage', 0.4), M('acKw', 0.3), M(d => (d.v2l ? 1 : 0), 0.3, { fixed: true })] },
    { key: 'practicality', label: 'Practicality', weight: 0.2, metrics: [M('seats', 0.5), M('cargo', 0.8), M(d => d.frunk || 0, 0.3), M('screen', 0.2)] },
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
  zones: 1.4, dciP3: 1.2, inputLag: 1.4, hdmi21: 1.4, audioW: 1, atmos: 0.8, hdmi: 0.5, power: 0.8, response: 1.6, sdrNits: 1, usbPd: 1.3, kvm: 0.9,
  frets: 0.8, keys: 1.4, polyphony: 1.6, voices: 1, rhythms: 0.7, speakers: 1.2, heatUp: 1.2, grindSettings: 0.9, drinks: 1.2, tank: 1, beans: 0.6, cups: 0.8, pressure: 0.5,
  maxW: 2.4, singleW: 1.8, portCount: 1.2, data: 1.6, capacity: 2, wh: 2.4, maxOut: 2, singleOut: 1.4, input: 1.4, rechargeTime: 1.2, acW: 1.6,
  outputW: 2, bassLow: 1.4, ppmBlack: 1.8, ppmColor: 1.6, firstPage: 0.8, dpi: 0.8, colors: 0.8, adf: 1.2, tray: 1, duty: 0.9, yieldBlack: 1.4, yieldColor: 1.2, cppBlack: 2.2, cppColor: 2,
  firstCopy: 1, warmUp: 0.7, scanIpm: 1.4, paperStd: 1.1, paperMax: 1, volume: 1.4, memory: 0.6, screen: 0.8,
  ratedW: 2.6, surgeW: 1.4, efficiency: 1.6, transfer: 1.2, chargeA: 1.4, pvW: 2.2, pvVoc: 1, mppt: 1, parallel: 0.8, va: 1.6, watts: 2.2, outlets: 1, runtimeHalf: 2,
  seats: 1.2, powerKw: 1.8, torque: 1, accel: 2, topSpeed: 1, batteryKwh: 1.8, rangeWltp: 2.6, rangeEpa: 2.6, rangeCltc: 2.2, dcKw: 2, dc10to80: 2, acKw: 0.8, cargo: 1.4, frunk: 0.8, voltage: 1.2,
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
  zones: 'more local dimming zones', dciP3: 'wider colour gamut (DCI-P3)', inputLag: 'lower input lag', hdmi21: 'more HDMI 2.1 ports',
  audioW: 'more powerful speakers', hdmi: 'more HDMI ports', power: 'lower power use', response: 'faster pixel response', sdrNits: 'brighter in SDR',
  usbPd: 'more USB-C charging power',
  frets: 'more frets', keys: 'more keys', polyphony: 'higher polyphony', voices: 'more voices', rhythms: 'more rhythms and styles', speakers: 'more powerful speakers',
  heatUp: 'faster heat-up', grindSettings: 'more grind settings', drinks: 'more preset drinks', tank: 'bigger water tank', beans: 'bigger bean hopper', cups: 'bigger carafe', pressure: 'higher pump rating',
  maxW: 'more total output', singleW: 'more power from one port', portCount: 'more ports', data: 'faster data transfer', capacity: 'more capacity', wh: 'more stored energy',
  maxOut: 'more output power', singleOut: 'more power from one port', input: 'faster recharging', rechargeTime: 'recharges faster', acW: 'more AC output',
  outputW: 'more output power', bassLow: 'deeper bass', ppmBlack: 'faster black printing', ppmColor: 'faster colour printing', firstPage: 'faster first page', dpi: 'higher print resolution',
  colors: 'more inks', adf: 'bigger document feeder', tray: 'more paper input', duty: 'higher duty cycle', yieldBlack: 'more pages per black refill', yieldColor: 'more pages per colour refill',
  cppBlack: 'cheaper black pages', cppColor: 'cheaper colour pages', firstCopy: 'faster first copy', warmUp: 'faster warm-up', scanIpm: 'faster scanning', paperStd: 'more paper as standard',
  paperMax: 'more paper with options', volume: 'rated for more pages a month', memory: 'more memory', screen: 'bigger screen',
  ratedW: 'more rated power', surgeW: 'higher surge capacity', efficiency: 'more efficient', transfer: 'faster switch-over', chargeA: 'faster battery charging', pvW: 'takes more solar',
  pvVoc: 'higher solar voltage limit', mppt: 'more MPPT trackers', parallel: 'more units in parallel', va: 'more VA capacity', watts: 'more real power (watts)', outlets: 'more battery-backed outlets', runtimeHalf: 'longer runtime at half load',
  seats: 'more seats', powerKw: 'more power', torque: 'more torque', accel: 'quicker 0–100 km/h', topSpeed: 'higher top speed', batteryKwh: 'bigger battery',
  rangeWltp: 'longer WLTP range', rangeEpa: 'longer EPA range', rangeCltc: 'longer CLTC range', dcKw: 'faster DC charging', dc10to80: 'faster 10–80% charge', acKw: 'faster AC charging',
  cargo: 'more boot space', frunk: 'bigger front trunk', voltage: 'higher-voltage architecture',
  ramMax: 'more maximum RAM', charger: 'faster charger', mics: 'more microphones', transistors: 'more transistors',
};
const BOOL_PHRASE = {
  ois: 'Has optical image stabilisation', wireless: 'Supports wireless charging', reverse: 'Can charge other devices wirelessly',
  sd: 'Has a memory card slot', jack: 'Has a 3.5 mm headphone jack', nfc: 'Has NFC for payments', esim: 'Supports eSIM', fiveG: 'Supports 5G',
  touch: 'Has a touchscreen', cellular: 'Offers a cellular model', anc: 'Has active noise cancelling', spatial: 'Supports spatial audio',
  hires: 'Supports hi-res wireless audio', multipoint: 'Connects to two devices at once (multipoint)', wirelessCharging: 'Case charges wirelessly',
  coilSplit: 'Has coil splitting for single-coil sounds', lockingTuners: 'Has locking tuners', tremolo: 'Has a tremolo bridge', weighted: 'Has weighted keys', aftertouch: 'Has aftertouch',
  bluetooth: 'Has Bluetooth', battery: 'Can run on batteries', pid: 'Has PID temperature control', grinder: 'Has a built-in grinder', autoMilk: 'Froths milk automatically',
  programmable: 'Has a timer / programmable brewing', app: 'Has an app', gan: 'Uses GaN (smaller and cooler)', foldingPlug: 'Has a folding plug', display: 'Shows power on a display',
  video: 'Carries video (DisplayPort)', emarker: 'Has an e-marker chip', braided: 'Has a braided jacket', magnetic: 'Snaps on magnetically', passthrough: 'Charges devices while it recharges',
  builtInCable: 'Has a built-in cable', stereo: 'Plays stereo from one speaker', chargeOut: 'Can charge your phone', floats: 'Floats', wifi: 'Has Wi-Fi', mic: 'Has a microphone',
  aux: 'Has a wired audio input', duplex: 'Prints two-sided automatically', ethernet: 'Has Ethernet', fax: 'Offers fax', lithium: 'Talks to lithium batteries', gridTie: 'Can export to the grid',
  generator: 'Has a generator input', avr: 'Regulates voltage (AVR)', hotSwap: 'Battery swaps without shutting down', extBattery: 'Takes extra battery packs', usb: 'Has USB monitoring', v2l: 'Can power appliances (V2L)',
  aod: 'Has an always-on display', atmos: 'Decodes Dolby Atmos', kvm: 'Has a built-in KVM switch', speakers: 'Has built-in speakers', ecg: 'Can take an ECG', spo2: 'Measures blood oxygen', lte: 'Available with LTE',
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
  if (cat === 'monitors' && d.ppi == null && d.displaySize) {
    const m = /(\d{3,5})\s*[x×]\s*(\d{3,5})/.exec(d.displayRes || '');
    if (m) { d.ppi = Math.round(Math.hypot(Number(m[1]), Number(m[2])) / d.displaySize); derived.ppi = 'calculated from size and resolution'; }
  }
  if (cat === 'evs' && d.rangeEpa == null && (d.rangeWltp || d.rangeCltc)) {
    d._rangeEst = parse.evRange(d);
  }
  d._derived = derived;
  const general = ` ${d.type || ''} ${d.series || ''} ${d.segment || ''} ${d.body || ''} ${d.market || ''} ${d.pickups || ''} ${d.maxSize || ''}`;
  const extra = general + (cat === 'tvs' || cat === 'monitors' ? ` ${d.panel || ''} ${d.type || ''} ${d.series || ''} ${d.displaySize ? `${d.displaySize}"` : ''} ${/oled/i.test(d.panel || '') ? 'oled' : ''} ${/mini-?led/i.test(d.panel || '') ? 'mini-led miniled' : ''}` : '');
  d._search = `${d.name} ${d.brand} ${d.chip || ''} ${d.cpu || ''} ${d.gpu || ''} ${(d.released || '').slice(0, 4)}${extra}`.toLowerCase();
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
  // value for money: tech score weighed against launch price (log-scaled so a
  // doubling of price must buy a clear jump in score), normalised to 15..99
  const rawValue = (d) => (d._score != null && d.price > 0 ? Math.log(d._score) - 0.5 * Math.log(d.price) : null);
  const vals = devices.map(rawValue).filter(v => v != null).sort((a, b) => a - b);
  const vlo = quantile(vals, 0.03), vhi = Math.max(quantile(vals, 0.97), vlo + 1e-6);
  for (const d of devices) {
    const v = rawValue(d);
    d._value = v == null ? null : Math.round(15 + Math.max(0, Math.min(1, (v - vlo) / (vhi - vlo))) * 84);
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
    case 'list': return Array.isArray(v) ? (v.length ? v.join(', ') : 'None') : String(v);
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
      if (field.key === 'usbPd' && v === 0) return 'None';
      if (field.key === 'hdmi21' && v === 0) return 'None';
      if (u === '%') return `${num(v)}%`;
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
    if (!field.better || field.key === 'released' || field.key === 'price') continue;
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
  if (cat === 'tvs' || cat === 'monitors') {
    const qa = parse.screen(a.panel, a.zones), qb = parse.screen(b.panel, b.zones);
    if (qa != null && qb != null && qa - qb >= 0.12) out.push({ key: 'panel', weight: 2.8, title: /oled/i.test(a.panel) ? 'Per-pixel OLED contrast (true blacks, no blooming)' : 'Better contrast and black levels', detail: `${a.panel} vs ${b.panel}` });
    const ha = cat === 'tvs' ? parse.hdrFormats(a.hdr) : parse.hdrCert(a.hdrCert), hb = cat === 'tvs' ? parse.hdrFormats(b.hdr) : parse.hdrCert(b.hdrCert);
    if (cat === 'tvs' && (a.hdr || []).includes('Dolby Vision') && !(b.hdr || []).includes('Dolby Vision')) out.push({ key: 'dv', weight: 1.6, title: 'Supports Dolby Vision', detail: `${b.name} lacks it` });
    else if (cat === 'tvs' && (a.hdr || []).includes('HDR10+') && !(b.hdr || []).includes('HDR10+')) out.push({ key: 'hdr10p', weight: 1.1, title: 'Supports HDR10+', detail: `${b.name} lacks it` });
    else if (cat === 'monitors' && ha - hb >= 0.2) out.push({ key: 'hdrCert', weight: 1.4, title: 'Higher HDR certification', detail: `${a.hdrCert || 'none'} vs ${b.hdrCert || 'none'}` });
    const pa = parse.pixels(a.displayRes), pb = parse.pixels(b.displayRes);
    if (pa && pb && pa / pb >= 1.3) out.push({ key: 'res', weight: 2, title: `${num(pa / pb, 1)}× the pixels`, detail: `${a.displayRes} vs ${b.displayRes}` });
    if (cat === 'monitors') {
      const va = parse.vrr(a.vrr), vb = parse.vrr(b.vrr);
      if (va - vb >= 0.3) out.push({ key: 'vrr', weight: 1, title: 'Better variable-refresh support', detail: `${(a.vrr || []).join(', ') || 'none'} vs ${(b.vrr || []).join(', ') || 'none'}` });
      const sa = parse.stand(a.stand), sb = parse.stand(b.stand);
      if (sa != null && sb != null && sa - sb >= 0.2) out.push({ key: 'stand', weight: 0.9, title: 'More adjustable stand', detail: `${a.stand} vs ${b.stand}` });
    }
  }
  return out.sort((p, q) => q.weight - p.weight).slice(0, limit);
}

/* ---------- verdicts: better tech vs better buy ---------- */
const money = (v) => `$${num(v)}`;
const lowerLabel = (t) => t.split(' ').map(w => (/^[A-Z]{2,}/.test(w) ? w : w.toLowerCase())).join(' ');
const listNames = (arr) => arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`;

/**
 * Two separate verdicts for a head-to-head.
 * tech — pure spec score, price ignored.
 * buy  — value for money: the tech score weighed against launch price.
 * Each: { winner: 'a' | 'b' | 'tie' | null, name, headline, text, figures }.
 */
export function verdicts(cat, a, b) {
  const def = CATEGORIES[cat];
  const scores = SCORES[cat] || [];
  const out = {};

  // better tech
  const sa = a._score, sb = b._score;
  if (sa == null || sb == null) {
    out.tech = { winner: null, headline: 'Not enough data', text: `${sa == null ? a.name : b.name} doesn't have enough listed specs to score.`, figures: `${sa ?? '—'} vs ${sb ?? '—'}` };
  } else if (Math.abs(sa - sb) <= 1) {
    out.tech = { winner: 'tie', headline: 'Too close to call', text: `On specs alone they are within a point of each other (${sa} vs ${sb}); pick on the individual differences below.`, figures: `Score ${sa} vs ${sb}` };
  } else {
    const [w, l, ws, ls] = sa > sb ? [a, b, sa, sb] : [b, a, sb, sa];
    const leads = scores.filter(s => w._scores[s.key] != null && l._scores[s.key] != null && w._scores[s.key] - l._scores[s.key] >= 5)
      .sort((x, y) => (w._scores[y.key] - l._scores[y.key]) - (w._scores[x.key] - l._scores[x.key])).slice(0, 2).map(s => lowerLabel(s.label));
    const behind = scores.filter(s => w._scores[s.key] != null && l._scores[s.key] != null && l._scores[s.key] - w._scores[s.key] >= 5).map(s => lowerLabel(s.label));
    out.tech = {
      winner: sa > sb ? 'a' : 'b', name: w.name, headline: w.name,
      text: `Scores ${ws} vs ${ls} on specs alone${leads.length ? `, mainly on ${listNames(leads)}` : ''}${behind.length ? `; ${l.name} still wins on ${listNames(behind.slice(0, 2))}` : ''}. Price is not counted.`,
      figures: `Score ${sa} vs ${sb}`,
    };
  }

  // better buy
  const hasPriceField = def.fields.some(f => f.key === 'price');
  if (!hasPriceField) {
    out.buy = { winner: null, noPrice: true, headline: 'No price data', text: `${def.label} aren't sold on their own, so there is no launch price to weigh against the score.`, figures: '' };
  } else if (!(a.price > 0) || !(b.price > 0)) {
    const missing = [a, b].filter(d => !(d.price > 0)).map(d => d.name);
    out.buy = { winner: null, noPrice: true, headline: 'No price data', text: `No US launch price is listed for ${listNames(missing)}, so value for money can't be judged. Better tech still applies.`, figures: [a, b].map(d => (d.price > 0 ? money(d.price) : 'no price')).join(' vs ') };
  } else if (a._value == null || b._value == null) {
    out.buy = { winner: null, noPrice: true, headline: 'Not enough data', text: 'One of these has no score, so value can\'t be judged.', figures: `${money(a.price)} vs ${money(b.price)}` };
  } else {
    const va = a._value, vb = b._value;
    const figures = `Value ${va} vs ${vb} · ${money(a.price)} vs ${money(b.price)}`;
    if (Math.abs(va - vb) <= 2) {
      out.buy = { winner: 'tie', headline: 'About even', text: `Price and performance balance out: ${a.name} and ${b.name} give about the same score for the money.`, figures };
    } else {
      const aWins = va > vb;
      const [w, l] = aWins ? [a, b] : [b, a];
      let text;
      if (w.price < l.price && (w._score ?? 0) < (l._score ?? 0)) {
        text = `Gets ${Math.round(w._score / l._score * 100)}% of ${l.name}'s score for ${Math.round(w.price / l.price * 100)}% of its launch price (${money(l.price - w.price)} less).`;
      } else if (w.price <= l.price) {
        text = `Scores higher${w.price < l.price ? ` and cost ${money(l.price - w.price)} less at launch` : ' for the same launch price'}; an easy pick.`;
      } else {
        text = `Costs ${money(w.price - l.price)} more at launch, but the ${w._score - l._score}-point lead is worth the premium.`;
      }
      out.buy = { winner: aWins ? 'a' : 'b', name: w.name, headline: w.name, text, figures };
    }
  }

  const tw = out.tech.winner, bw = out.buy.winner;
  out.same = (tw === 'a' || tw === 'b') && tw === bw;
  out.summary = out.same
    ? `${out.tech.name} is both the better tech and the better buy.`
    : (tw === 'a' || tw === 'b') && (bw === 'a' || bw === 'b')
      ? `${out.tech.name} is the better tech, but ${out.buy.name} is the better buy.`
      : '';
  return out;
}

/** A handful of well-scored recent devices to start a comparison from (never auto-applied). */
export function popular(data, n = 8) {
  const years = data.years.slice(0, 3);
  const pool = data.devices.filter(d => d._score != null && years.includes((d.released || '').slice(0, 4))).sort((a, b) => b._score - a._score);
  const fam = (d) => d.series || d.name.replace(/\s+\d+(\.\d+)?"$/, '');
  // for size ranges (TVs), show the most common size of each family
  const rep = (d) => pool.find(x => fam(x) === fam(d) && x.displaySize === 65) || d;
  const out = [], brands = new Map(), seen = new Set();
  for (const d of pool) {
    const f = fam(d);
    if (seen.has(f) || (brands.get(d.brand) || 0) >= 2) continue;
    seen.add(f); brands.set(d.brand, (brands.get(d.brand) || 0) + 1); out.push(rep(d));
    if (out.length >= n) break;
  }
  return out;
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

/** A few pairings people would plausibly compare next. */
export function suggestions(data, current, n = 6) {
  const d = data.byId.get(current);
  if (!d) return [];
  const near = data.devices.filter(x => x.id !== d.id && x._score != null && d._score != null)
    .map(x => [Math.abs(x._score - d._score) + Math.abs(Number((x.released || '0').slice(0, 4)) - Number((d.released || '0').slice(0, 4))) * 4 + (x.brand === d.brand ? 3 : 0), x])
    .sort((p, q) => p[0] - q[0]).slice(0, n).map(x => x[1]);
  return near;
}
