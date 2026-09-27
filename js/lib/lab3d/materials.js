/* ============================================================
   3D Lab — materials

   Physically based presets for objects (not buildings): plastics,
   anodised aluminium, gunmetal, glass, screens, woods, fabrics.
   Every call returns a fresh material so an object can be recoloured
   or disposed on its own. Wood grain, woven mesh and fabric use small
   canvas textures (skipped where there is no DOM, e.g. tests); they
   export into GLB/USDZ like any image texture.
   ============================================================ */

import * as THREE from 'three';

const hasDom = () => typeof document !== 'undefined' && typeof document.createElement === 'function';
const texCache = new Map();

function canvasTexture(key, w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  if (!hasDom()) return null;
  let base = texCache.get(key);
  if (!base) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    if (!g) return null;
    draw(g, w, h);
    base = new THREE.CanvasTexture(c);
    base.wrapS = base.wrapT = THREE.RepeatWrapping;
    base.anisotropy = 4;
    if (srgb) base.colorSpace = THREE.SRGBColorSpace;
    texCache.set(key, base);
  }
  const t = base.clone();
  t.needsUpdate = true;
  t.repeat.set(repeat[0], repeat[1]);
  return t;
}

/* deterministic noise so textures look the same every load */
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function woodTexture(hex) {
  return canvasTexture(`wood|${hex}`, 512, 512, (g, w, h) => {
    const base = new THREE.Color(hex);
    const dark = base.clone().multiplyScalar(0.62), light = base.clone().lerp(new THREE.Color(0xffffff), 0.12);
    g.fillStyle = `#${base.getHexString()}`; g.fillRect(0, 0, w, h);
    const r = rng(7);
    for (let i = 0; i < 90; i++) {
      const y0 = r() * h, amp = 4 + r() * 16, freq = 0.004 + r() * 0.012, ph = r() * 6;
      g.strokeStyle = `#${(r() > 0.5 ? dark : light).getHexString()}`;
      g.globalAlpha = 0.08 + r() * 0.22;
      g.lineWidth = 0.6 + r() * 2.4;
      g.beginPath();
      for (let x = 0; x <= w; x += 8) g.lineTo(x, y0 + Math.sin(x * freq + ph) * amp + Math.sin(x * freq * 3.1) * amp * 0.25);
      g.stroke();
    }
    g.globalAlpha = 1;
  }, { repeat: [1, 1] });
}

function meshWeaveTexture() {
  // Woven chair mesh: small diamond openings with an alpha channel.
  return canvasTexture('weave', 128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 5;
    for (let i = -h; i < w + h; i += 16) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke();
      g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke();
    }
  }, { repeat: [14, 16], srgb: false });
}

function fabricTexture(hex) {
  return canvasTexture(`fabric|${hex}`, 128, 128, (g, w, h) => {
    const c = new THREE.Color(hex);
    g.fillStyle = `#${c.getHexString()}`; g.fillRect(0, 0, w, h);
    const r = rng(11);
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
      const v = (r() - 0.5) * 0.16 + ((x + y) % 4 === 0 ? 0.04 : -0.02);
      g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
      g.fillRect(x, y, 2, 2);
    }
  }, { repeat: [6, 6] });
}

function knurlTexture() {
  return canvasTexture('knurl', 64, 64, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#303030'; g.lineWidth = 2;
    for (let i = -h; i < w + h; i += 8) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke();
      g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke();
    }
  }, { repeat: [8, 8], srgb: false });
}

/* name → [default colour, factory] */
const PRESETS = {
  plastic: [0xe9e9e6, (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.42, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.4 })],
  'matte-plastic': [0x2a2b2d, (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.78, metalness: 0 })],
  'glossy-plastic': [0xd8262e, (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08 })],
  polymer: [0x1d1e20, (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.62, metalness: 0.02 })],
  rubber: [0x1b1c1e, (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.93, metalness: 0 })],
  metal: [0x9aa0a6, (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.95 })],
  steel: [0x8d9399, (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 1 })],
  'brushed-steel': [0xb5babf, (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.28, metalness: 1, anisotropy: 0.6 })],
  gunmetal: [0x2c2d30, (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.46, metalness: 0.72 })],
  aluminium: [0xc9ccd0, (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, metalness: 0.92, clearcoat: 0.25, clearcoatRoughness: 0.35 })],
  anodized: [0x3a4a6a, (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.34, metalness: 0.62, clearcoat: 0.35, clearcoatRoughness: 0.25 })],
  titanium: [0x8b8a86, (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.4, metalness: 0.9, clearcoat: 0.15 })],
  chrome: [0xf2f2f2, (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.06, metalness: 1 })],
  gold: [0xd9ad55, (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.22, metalness: 1 })],
  copper: [0xc07a45, (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.28, metalness: 1 })],
  brass: [0xc9a85a, (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, metalness: 1 })],
  glass: [0xdfeaf0, (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.04, metalness: 0, transmission: 0.92, thickness: 0.004, ior: 1.5, transparent: true, opacity: 1, envMapIntensity: 1.3 })],
  'tinted-glass': [0x223036, (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.06, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.72 })],
  'frosted-glass': [0xe8ecee, (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.55, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.4 })],
  screen: [0x07080a, (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.04, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02 })],
  lens: [0x0c1320, (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.02, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.01, iridescence: 0.6, iridescenceIOR: 1.6 })],
  ceramic: [0xf4f2ee, (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.18, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.1 })],
  porcelain: [0xfbfbf8, (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.2 })],
  wood: [0x8a5a34, (c) => { const t = woodTexture(`#${new THREE.Color(c).getHexString()}`); return new THREE.MeshPhysicalMaterial({ color: t ? 0xffffff : c, map: t, roughness: 0.58, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4 }); }],
  walnut: [0x5b3620, (c) => { const t = woodTexture(`#${new THREE.Color(c).getHexString()}`); return new THREE.MeshPhysicalMaterial({ color: t ? 0xffffff : c, map: t, roughness: 0.48, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.3 }); }],
  oak: [0xb88d5a, (c) => { const t = woodTexture(`#${new THREE.Color(c).getHexString()}`); return new THREE.MeshPhysicalMaterial({ color: t ? 0xffffff : c, map: t, roughness: 0.62, metalness: 0 }); }],
  fabric: [0x55585c, (c) => { const t = fabricTexture(`#${new THREE.Color(c).getHexString()}`); return new THREE.MeshPhysicalMaterial({ color: t ? 0xffffff : c, map: t, roughness: 0.96, metalness: 0, sheen: 0.6, sheenRoughness: 0.8, sheenColor: new THREE.Color(c).lerp(new THREE.Color(0xffffff), 0.3) }); }],
  velvet: [0x3d4f6d, (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.9, metalness: 0, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(c).lerp(new THREE.Color(0xffffff), 0.45) })],
  leather: [0x3b2a20, (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.55, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.5, sheen: 0.3 })],
  mesh: [0x1f2022, (c) => { const a = meshWeaveTexture(); return new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0, alphaMap: a, transparent: !!a, alphaTest: a ? 0.35 : 0, side: THREE.DoubleSide }); }],
  knurled: [0x2c2d30, (c) => { const b = knurlTexture(); return new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.7, bumpMap: b, bumpScale: 0.6 }); }],
  paint: [0xb7322c, (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.06 })],
  'car-paint': [0x9c1b1f, (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.28, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.03 })],
  marble: [0xefece6, (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.14, metalness: 0, clearcoat: 0.8 })],
  concrete: [0xa9a6a0, (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, metalness: 0 })],
  stone: [0x8f8a82, (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, metalness: 0, flatShading: true })],
  foliage: [0x3f7a3a, (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, flatShading: true, side: THREE.DoubleSide })],
  bark: [0x5c4230, (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95, metalness: 0, flatShading: true })],
  paper: [0xf3efe6, (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, metalness: 0 })],
  wax: [0xf1e6d0, (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.5, metalness: 0, sheen: 0.4, transmission: 0.15, thickness: 0.02 })],
  emissive: [0xfff1c9, (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.6, roughness: 0.5 })],
  light: [0xfff6e0, (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.4, roughness: 0.4 })],
};

export const MATERIALS = Object.keys(PRESETS);
export const MATERIAL_LABELS = {
  plastic: 'Plastic', 'matte-plastic': 'Matte plastic', 'glossy-plastic': 'Glossy plastic', polymer: 'Polymer', rubber: 'Rubber',
  metal: 'Metal', steel: 'Steel', 'brushed-steel': 'Brushed steel', gunmetal: 'Gunmetal', aluminium: 'Aluminium', anodized: 'Anodised aluminium',
  titanium: 'Titanium', chrome: 'Chrome', gold: 'Gold', copper: 'Copper', brass: 'Brass', glass: 'Clear glass', 'tinted-glass': 'Tinted glass',
  'frosted-glass': 'Frosted glass', screen: 'Screen', lens: 'Camera lens', ceramic: 'Ceramic', porcelain: 'Porcelain', wood: 'Wood', walnut: 'Walnut',
  oak: 'Oak', fabric: 'Fabric', velvet: 'Velvet', leather: 'Leather', mesh: 'Woven mesh', knurled: 'Knurled metal', paint: 'Gloss paint',
  'car-paint': 'Car paint', marble: 'Marble', concrete: 'Concrete', stone: 'Stone', foliage: 'Foliage', bark: 'Bark', paper: 'Paper',
  wax: 'Wax', emissive: 'Glowing', light: 'Light source',
};

/** A new material. `kind` is a preset name; `color` (hex number or "#rrggbb") overrides its colour. */
export function mat(kind = 'plastic', color = null, opts = {}) {
  const [def, make] = PRESETS[kind] || PRESETS.plastic;
  const c = color != null && color !== '' ? new THREE.Color(color) : new THREE.Color(def);
  const m = make(c);
  m.name = kind;
  if (opts.side === 'double') m.side = THREE.DoubleSide;
  if (opts.opacity != null) { m.transparent = opts.opacity < 1; m.opacity = opts.opacity; }
  if (opts.roughness != null) m.roughness = opts.roughness;
  if (opts.metalness != null) m.metalness = opts.metalness;
  if (opts.emissive != null) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.emissiveIntensity ?? 1; }
  if (opts.map) { m.map = opts.map; m.color?.set(0xffffff); }
  return m;
}

/** Colour names people use for objects, including product finishes. */
export const COLOR_WORDS = {
  black: '#1c1c1e', white: '#f2f2f0', grey: '#8a8d91', gray: '#8a8d91', silver: '#d6d8da', red: '#c1272d', blue: '#2c5aa0',
  navy: '#1f2d4d', green: '#2f7d4a', olive: '#6b6b3a', yellow: '#e8c33a', orange: '#e2742f', purple: '#6a4c93', violet: '#7d5ba6',
  pink: '#e58fb0', brown: '#6b4428', tan: '#c8a47a', beige: '#dccbb0', gold: '#d4af37', teal: '#2a8c8c', cyan: '#35b6c9',
  maroon: '#6d1f2a', cream: '#f1e8d6', khaki: '#b8a77a', lime: '#9ac43c', coral: '#ef7f67', mint: '#9fd8c1', lavender: '#b9a7d9',
  sand: '#d2bb8d', graphite: '#3a3b3e', charcoal: '#2e3033', 'space black': '#2b2c2e', 'space grey': '#5d6064', 'space gray': '#5d6064',
  midnight: '#232a36', starlight: '#ece4d6', 'rose gold': '#e1b3a0', bronze: '#9a6b3c',
  'cosmic orange': '#d9722e', 'deep blue': '#2e3c5c', 'mist blue': '#a7bcd0', sage: '#a4b393',
  'sky blue': '#9ec3e6', 'light gold': '#e7d3a8', 'cloud white': '#f0efec', 'desert titanium': '#bfa48a', 'natural titanium': '#b9b4ab',
  'black titanium': '#3a3a3c', 'white titanium': '#e8e6e1', 'flat dark earth': '#c2a878', 'od green': '#4b5320',
};

export function colorFromWords(text) {
  const s = ` ${String(text || '').toLowerCase()} `;
  const hex = s.match(/#([0-9a-f]{6}|[0-9a-f]{3})\b/);
  if (hex) return `#${hex[1]}`;
  // longest name first so "space black" wins over "black"
  const names = Object.keys(COLOR_WORDS).sort((a, b) => b.length - a.length);
  for (const n of names) if (s.includes(` ${n} `) || s.includes(` ${n},`) || s.includes(` ${n}.`)) return COLOR_WORDS[n];
  return null;
}
