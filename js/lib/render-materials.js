/* ============================================================
   Architectural materials for the realistic 3D viewers.

   One cached set of physically based materials (painted steel,
   galvanised steel, concrete, glass, timber, brick, …) with subtle
   procedural shading added through onBeforeCompile:
   - paint: faint mottling, grime rising from the ground and light
     vertical run-off streaks, so a painted box does not look like
     plastic;
   - concrete, render, timber and brick: world-space noise and
     procedural texture so large faces are never a flat fill.
   Everything is procedural (no image downloads) and works with the
   scene environment map set by Viewer3D's realism mode.
   ============================================================ */

import * as THREE from 'three';

const NOISE_GLSL = `
  varying vec3 vWorldPos;
  float mHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float mNoise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(mHash(i), mHash(i+vec3(1,0,0)), f.x), mix(mHash(i+vec3(0,1,0)), mHash(i+vec3(1,1,0)), f.x), f.y),
               mix(mix(mHash(i+vec3(0,0,1)), mHash(i+vec3(1,0,1)), f.x), mix(mHash(i+vec3(0,1,1)), mHash(i+vec3(1,1,1)), f.x), f.y), f.z); }
  float mFbm(vec3 p){ return mNoise(p) * 0.55 + mNoise(p * 2.03) * 0.28 + mNoise(p * 4.1) * 0.17; }
`;

/**
 * Adds world-space shading to a standard material.
 * mottle: colour variation; grime: darkening near the ground (metres);
 * streaks: vertical run-off; rough: roughness variation.
 */
export function withSurfaceShading(material, { mottle = 0.06, scale = 0.8, grime = 0, grimeHeight = 0.6, streaks = 0, rough = 0.08 } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uMottle = { value: mottle };
    shader.uniforms.uScale = { value: scale };
    shader.uniforms.uGrime = { value: grime };
    shader.uniforms.uGrimeH = { value: grimeHeight };
    shader.uniforms.uStreaks = { value: streaks };
    shader.uniforms.uRough = { value: rough };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE_GLSL}\nuniform float uMottle; uniform float uScale; uniform float uGrime; uniform float uGrimeH; uniform float uStreaks; uniform float uRough;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float mv = mFbm(vWorldPos * uScale);
        diffuseColor.rgb *= 1.0 - uMottle * 0.5 + mv * uMottle;
        float gh = clamp(1.0 - vWorldPos.y / max(uGrimeH, 0.01), 0.0, 1.0);
        diffuseColor.rgb *= 1.0 - uGrime * gh * gh * (0.7 + 0.3 * mv);
        float st = mNoise(vec3(vWorldPos.x * 9.0 + vWorldPos.z * 9.0, vWorldPos.y * 0.35, 0.0));
        diffuseColor.rgb *= 1.0 - uStreaks * smoothstep(0.62, 1.0, st);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (mFbm(vWorldPos * uScale * 1.7) - 0.5) * uRough * 2.0, 0.04, 1.0);`);
  };
  material.customProgramCacheKey = () => `surf-${mottle}-${scale}-${grime}-${grimeHeight}-${streaks}-${rough}`;
  return material;
}

/* ---------------- procedural textures ---------------- */

const texCache = new Map();

function canvasTexture(key, size, draw, repeat = [1, 1]) {
  if (texCache.has(key)) return texCache.get(key);
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  try { draw(c.getContext('2d'), size); } catch { return null; }   // no 2D canvas: plain colour instead
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

// Seeded random so textures are identical on every load.
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** Timber floor or cladding planks, laid along the texture's U axis. */
export function plankTexture(base = '#9c7a52') {
  return canvasTexture(`plank-${base}`, 512, (g, n) => {
    const r = rng(7);
    const rows = 8, h = n / rows;
    const col = new THREE.Color(base);
    for (let i = 0; i < rows; i++) {
      let x = -r() * n;
      while (x < n) {
        const len = n * (0.45 + r() * 0.5);
        const k = 0.86 + r() * 0.24;
        g.fillStyle = `rgb(${Math.min(255, col.r * 255 * k)|0},${Math.min(255, col.g * 255 * k)|0},${Math.min(255, col.b * 255 * k)|0})`;
        g.fillRect(x, i * h, len, h);
        g.globalAlpha = 0.08;
        for (let j = 0; j < 6; j++) { g.fillStyle = r() > 0.5 ? '#000' : '#fff'; g.fillRect(x, i * h + r() * h, len, 1 + r() * 1.5); }
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(x, i * h, 1.5, h);
        x += len;
      }
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(0, i * h, n, 1.5);
    }
  });
}

/** Running-bond brick or block wall (brick 215 × 65 mm courses by default). */
export function brickTexture(base = '#9b5a42', mortar = '#c9c1b3', { courses = 8, perCourse = 4 } = {}) {
  return canvasTexture(`brick-${base}-${mortar}-${courses}-${perCourse}`, 512, (g, n) => {
    const r = rng(11);
    g.fillStyle = mortar; g.fillRect(0, 0, n, n);
    const h = n / courses, w = n / perCourse, jt = Math.max(2, n / 128);
    const col = new THREE.Color(base);
    for (let i = 0; i < courses; i++) {
      const off = i % 2 ? w / 2 : 0;
      for (let x = -w + off; x < n; x += w) {
        const k = 0.82 + r() * 0.3;
        g.fillStyle = `rgb(${Math.min(255, col.r * 255 * k)|0},${Math.min(255, col.g * 255 * k)|0},${Math.min(255, col.b * 255 * k)|0})`;
        g.fillRect(x + jt / 2, i * h + jt / 2, w - jt, h - jt);
      }
    }
  });
}

/** Concrete: fine speckle and faint formwork board lines. */
export function concreteTexture(base = '#b9b6ae') {
  return canvasTexture(`concrete-${base}`, 256, (g, n) => {
    const r = rng(3);
    g.fillStyle = base; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
      g.fillRect(r() * n, r() * n, 1 + r() * 2, 1 + r() * 2);
    }
    g.fillStyle = 'rgba(0,0,0,0.04)';
    for (let y = 0; y < n; y += n / 4) g.fillRect(0, y, n, 1);
  });
}

/* ---------------- material presets ---------------- */

const matCache = new Map();

/**
 * Returns a shared material. `kind` is a preset name; `color` overrides
 * its base colour. Presets: paint (painted steel), steel, galvanised,
 * aluminium, glass, concrete, render, timber, floor-timber, brick,
 * block, asphalt, grass, water, rubber, plastic, fabric, gold, copper,
 * marble, soil, emissive.
 */
export function material(kind = 'paint', color = null, opts = {}) {
  const key = `${kind}|${color ?? ''}|${JSON.stringify(opts)}`;
  if (matCache.has(key)) return matCache.get(key);
  const c = color != null ? new THREE.Color(color) : null;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  let m;
  switch (kind) {
    case 'paint':
      m = withSurfaceShading(std({ color: c ?? 0x3f6b52, roughness: 0.62, metalness: 0.22 }),
        { mottle: 0.07, scale: 1.4, grime: opts.grime ?? 0.28, grimeHeight: 0.7, streaks: opts.streaks ?? 0, rough: 0.12 });
      break;
    case 'steel':
      m = withSurfaceShading(std({ color: c ?? 0x5b6066, roughness: 0.42, metalness: 0.85 }), { mottle: 0.05, scale: 2, rough: 0.1 });
      break;
    case 'galvanised':
      m = withSurfaceShading(std({ color: c ?? 0xaab0b4, roughness: 0.35, metalness: 0.9 }), { mottle: 0.12, scale: 3.5, rough: 0.15 });
      break;
    case 'aluminium':
      m = std({ color: c ?? 0xc7ccd1, roughness: 0.28, metalness: 0.95 });
      break;
    case 'chrome':
      m = std({ color: c ?? 0xf0f0f0, roughness: 0.08, metalness: 1 });
      break;
    case 'glass':
      m = new THREE.MeshPhysicalMaterial({ color: c ?? 0xbcd4dc, roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: opts.opacity ?? 0.38, envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
      break;
    case 'concrete': {
      const t = concreteTexture(c ? `#${c.getHexString()}` : '#b9b6ae');
      m = withSurfaceShading(std({ color: t ? 0xffffff : (c ?? 0xb9b6ae), map: t, roughness: 0.92, metalness: 0 }), { mottle: 0.1, scale: 0.6, grime: opts.grime ?? 0.12, grimeHeight: 0.4, rough: 0.05 });
      break;
    }
    case 'render':
      m = withSurfaceShading(std({ color: c ?? 0xe6e1d6, roughness: 0.9, metalness: 0 }), { mottle: 0.06, scale: 0.9, grime: opts.grime ?? 0.18, grimeHeight: 0.5, streaks: 0.05 });
      break;
    case 'timber': {
      const t = plankTexture(c ? `#${c.getHexString()}` : '#9c7a52');
      m = withSurfaceShading(std({ color: t ? 0xffffff : (c ?? 0x9c7a52), map: t, roughness: 0.7, metalness: 0 }), { mottle: 0.05, scale: 1.2, rough: 0.08 });
      break;
    }
    case 'floor-timber': {
      const t = plankTexture(c ? `#${c.getHexString()}` : '#a88457');
      m = std({ color: t ? 0xffffff : (c ?? 0xa88457), map: t, roughness: 0.62, metalness: 0 });
      break;
    }
    case 'brick': {
      const t = brickTexture(c ? `#${c.getHexString()}` : '#9b5a42');
      m = withSurfaceShading(std({ color: t ? 0xffffff : (c ?? 0x9b5a42), map: t, roughness: 0.88, metalness: 0 }), { mottle: 0.08, scale: 0.8, grime: 0.15, grimeHeight: 0.5 });
      break;
    }
    case 'block': {
      const t = brickTexture(c ? `#${c.getHexString()}` : '#a9a59c', '#8f8b83', { courses: 4, perCourse: 2 });
      m = withSurfaceShading(std({ color: t ? 0xffffff : (c ?? 0xa9a59c), map: t, roughness: 0.92, metalness: 0 }), { mottle: 0.08, scale: 0.8, grime: 0.12, grimeHeight: 0.5 });
      break;
    }
    case 'asphalt':
      m = withSurfaceShading(std({ color: c ?? 0x3a3b3d, roughness: 0.95, metalness: 0 }), { mottle: 0.15, scale: 3 });
      break;
    case 'grass':
      m = withSurfaceShading(std({ color: c ?? 0x5d7d3e, roughness: 1, metalness: 0 }), { mottle: 0.3, scale: 1.3 });
      break;
    case 'soil':
      m = withSurfaceShading(std({ color: c ?? 0x8a6e52, roughness: 1, metalness: 0 }), { mottle: 0.25, scale: 1.1 });
      break;
    case 'water':
      m = new THREE.MeshPhysicalMaterial({ color: c ?? 0x2f6f8f, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.8, clearcoat: 1, envMapIntensity: 1.4 });
      break;
    case 'rubber':
      m = std({ color: c ?? 0x222426, roughness: 0.9, metalness: 0 });
      break;
    case 'plastic':
      m = std({ color: c ?? 0xe8e8e6, roughness: 0.45, metalness: 0 });
      break;
    case 'fabric':
      m = withSurfaceShading(std({ color: c ?? 0x7c7468, roughness: 0.95, metalness: 0 }), { mottle: 0.08, scale: 6 });
      break;
    case 'marble':
      m = withSurfaceShading(std({ color: c ?? 0xefece6, roughness: 0.18, metalness: 0 }), { mottle: 0.12, scale: 1.8, rough: 0.05 });
      break;
    case 'gold':
      m = std({ color: c ?? 0xd4a64a, roughness: 0.25, metalness: 1 });
      break;
    case 'copper':
      m = std({ color: c ?? 0xb87333, roughness: 0.3, metalness: 1 });
      break;
    case 'emissive':
      m = std({ color: c ?? 0xfff2c8, emissive: c ?? 0xfff2c8, emissiveIntensity: opts.intensity ?? 1.5, roughness: 0.5 });
      break;
    default:
      m = std({ color: c ?? 0xcccccc, roughness: opts.roughness ?? 0.7, metalness: opts.metalness ?? 0 });
  }
  if (opts.opacity != null && kind !== 'glass') { m.transparent = opts.opacity < 1; m.opacity = opts.opacity; }
  if (opts.side === 'double') m.side = THREE.DoubleSide;
  matCache.set(key, m);
  return m;
}

export const MATERIAL_KINDS = ['paint', 'steel', 'galvanised', 'aluminium', 'chrome', 'glass', 'concrete', 'render', 'timber', 'floor-timber', 'brick', 'block', 'asphalt', 'grass', 'soil', 'water', 'rubber', 'plastic', 'fabric', 'marble', 'gold', 'copper', 'emissive'];

/** Materials are shared across viewers; call when every viewer using them is gone. */
export function disposeMaterials() {
  for (const m of matCache.values()) m.dispose();
  matCache.clear();
  for (const t of texCache.values()) t.dispose();
  texCache.clear();
}
