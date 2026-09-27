/* ============================================================
   3D Lab — tech models

   Phones, laptops, monitors and accessories at real dimensions
   (metres). Phones face the display towards +z; the library shows
   them turned so the camera side is in view.
   ============================================================ */

import { group, at, box, cyl, cylX, cylZ, sphere, torus, lathe, tube, extrude, profile, shapeFrom, deviceRect, roundRect, roundRectRadii, THREE } from '../kit.js';
import { mat } from '../materials.js';

const hasDom = () => typeof document !== 'undefined';

/* ---------------- shared bits ---------------- */

/** A flat shape as a mesh with 0–1 UVs (ShapeGeometry uses raw x/y). */
function flat(shape, material, name = '') {
  const g = new THREE.ShapeGeometry(shape, 24);
  g.computeBoundingBox();
  const bb = g.boundingBox, uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x || 1), (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y || 1));
  const m = new THREE.Mesh(g, material);
  m.name = name;
  m.receiveShadow = true;
  return m;
}

const screenCache = new Map();
/** Lock-screen style wallpaper with the time, tinted to the device colour. */
function wallpaper(tint, { w = 512, h = 1110, time = true, kind = 'phone' } = {}) {
  if (!hasDom()) return null;
  const key = `${tint}|${w}|${h}|${time}|${kind}`;
  if (screenCache.has(key)) return screenCache.get(key).clone();
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (!g) return null;
  const base = new THREE.Color(tint);
  const hsl = {}; base.getHSL(hsl);
  const col = (dh, s, l) => `hsl(${Math.round(((hsl.h + dh) % 1) * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
  const bg = g.createLinearGradient(0, 0, w * 0.4, h);
  bg.addColorStop(0, col(0, Math.max(0.45, hsl.s), 0.18));
  bg.addColorStop(0.55, col(0.04, Math.max(0.5, hsl.s), 0.34));
  bg.addColorStop(1, col(0.1, 0.55, 0.12));
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (const [x, y, r, dh, l] of [[0.2, 0.62, 0.55, 0.02, 0.55], [0.85, 0.35, 0.45, 0.08, 0.5], [0.55, 0.95, 0.5, -0.03, 0.42]]) {
    const rg = g.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w);
    rg.addColorStop(0, col(dh, 0.75, l)); rg.addColorStop(1, col(dh, 0.75, l).replace('hsl', 'hsla').replace(')', ', 0)'));
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
  }
  if (time) {
    g.fillStyle = 'rgba(255,255,255,0.94)';
    g.textAlign = 'center';
    g.font = `600 ${Math.round(w * 0.05)}px -apple-system, "SF Pro Display", "Segoe UI", Roboto, sans-serif`;
    g.fillText(kind === 'phone' ? 'Saturday 27 September' : '', w / 2, h * 0.14);
    g.font = `700 ${Math.round(w * 0.24)}px -apple-system, "SF Pro Display", "Segoe UI", Roboto, sans-serif`;
    g.fillText('9:41', w / 2, h * 0.27);
    if (kind === 'phone') {
      g.fillStyle = 'rgba(255,255,255,0.22)';
      for (const x of [0.18, 0.82]) { g.beginPath(); g.arc(x * w, h * 0.9, w * 0.07, 0, Math.PI * 2); g.fill(); }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  screenCache.set(key, t);
  return t.clone();
}

function screenMaterial(tint, opts) {
  const t = wallpaper(tint, opts);
  return new THREE.MeshStandardMaterial({ color: t ? 0xffffff : 0x111318, map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: t ? 0.85 : 0, roughness: 0.25, metalness: 0 });
}

/** Camera lens module facing -z: a machined ring, cover glass and the lens stack inside. */
function lens(R, ringMat, { raise = 0.0022, glassR = R * 0.83 } = {}) {
  const g = group('Lens');
  const ring = lathe([[0, 0], [R, 0], [R, raise * 0.72], [R - raise * 0.3, raise], [glassR + raise * 0.12, raise], [glassR, raise * 0.7], [0, raise * 0.7]], ringMat, { seg: 48 });
  ring.rotation.x = -Math.PI / 2;
  g.add(ring);
  const glass = cylZ(glassR, 0.0004, mat('lens', '#0b0f18'), { seg: 40 });
  g.add(at(glass, [0, 0, -raise * 0.72]));
  const inner = cylZ(glassR * 0.58, 0.0003, mat('lens', '#1b2a44'), { seg: 32 });
  g.add(at(inner, [0, 0, -raise * 0.74]));
  g.add(at(cylZ(glassR * 0.22, 0.0003, mat('screen', '#020203'), { seg: 24 }), [0, 0, -raise * 0.76]));
  g.add(at(torus(glassR * 0.8, glassR * 0.035, mat('chrome', '#9aa3ad'), { radial: 6, tubular: 40 }), [0, 0, -raise * 0.73]));
  return g;
}

function sideButton(len, x, y, material, depth = 0.0028) {
  return at(box(0.0012, len, depth, material, { r: 0.0005 }), [x, y, 0]);
}

/* ---------------- iPhones ---------------- */

const IPHONES = {
  '17-pro': { name: 'iPhone 17 Pro', w: 0.0719, h: 0.150, d: 0.00875, r: 0.0112, layout: 'plateau', frame: 'anodized',
    colors: [['#d9722e', 'Cosmic Orange'], ['#2e3c5c', 'Deep Blue'], ['#dcdddf', 'Silver']] },
  '17-pro-max': { name: 'iPhone 17 Pro Max', w: 0.078, h: 0.1634, d: 0.00875, r: 0.0122, layout: 'plateau', frame: 'anodized',
    colors: [['#d9722e', 'Cosmic Orange'], ['#2e3c5c', 'Deep Blue'], ['#dcdddf', 'Silver']] },
  '17': { name: 'iPhone 17', w: 0.0715, h: 0.1496, d: 0.0079, r: 0.0112, layout: 'pill', frame: 'aluminium',
    colors: [['#2b2c2e', 'Black'], ['#ecebe7', 'White'], ['#a7bcd0', 'Mist Blue'], ['#a4b393', 'Sage'], ['#c3b6dc', 'Lavender']] },
  air: { name: 'iPhone Air', w: 0.0747, h: 0.1562, d: 0.00564, r: 0.0118, layout: 'bar', frame: 'titanium',
    colors: [['#2e2f31', 'Space Black'], ['#f0efec', 'Cloud White'], ['#e7d3a8', 'Light Gold'], ['#9ec3e6', 'Sky Blue']] },
  '16-pro': { name: 'iPhone 16 Pro', w: 0.0715, h: 0.1496, d: 0.00825, r: 0.0112, layout: 'square', frame: 'titanium',
    colors: [['#b9b4ab', 'Natural Titanium'], ['#bfa48a', 'Desert Titanium'], ['#3a3a3c', 'Black Titanium'], ['#e8e6e1', 'White Titanium']] },
};

function iphone(P, variant) {
  const V = IPHONES[variant] || IPHONES['17-pro'];
  const { w, h, d, r } = V;
  const color = P.color || V.colors[0][0];
  const light = new THREE.Color(color).getHSL({}).l > 0.6;
  const frameMat = mat(V.frame, color, V.frame === 'titanium' ? { roughness: 0.42 } : {});
  const bevel = d * 0.24;
  const g = group(V.name);

  // Body
  g.add(extrude(deviceRect(w, h, r), d, frameMat, { bevel, bevelSeg: 6, curveSeg: 28, name: 'Frame' }));

  // Front: cover glass, display, Dynamic Island
  const front = d / 2;
  g.add(at(extrude(deviceRect(w - 0.0016, h - 0.0016, r - 0.0008), 0.0006, mat('screen', '#050506'), { bevel: 0.00025, curveSeg: 28, name: 'Cover glass' }), [0, 0, front - 0.0001]));
  const disp = flat(deviceRect(w - 0.0046, h - 0.0046, r - 0.0023), screenMaterial(color), 'Display');
  g.add(at(disp, [0, 0, front + 0.00022]));
  g.add(at(flat(roundRect(0.0204, 0.0062, 0.0031), mat('screen', '#000000'), 'Dynamic Island'), [0, h / 2 - 0.0112, front + 0.00026]));

  // Back
  const back = -d / 2;
  const inset = bevel + 0.0004;
  const glassMat = mat('frosted-glass', new THREE.Color(color).lerp(new THREE.Color(light ? 0xffffff : 0x000000), light ? 0.14 : 0.06).offsetHSL(0, -0.05, light ? 0 : 0.06), { roughness: 0.62 });
  const ringMat = mat(V.frame === 'titanium' ? 'titanium' : 'anodized', new THREE.Color(color).multiplyScalar(light ? 0.92 : 0.8));
  const lensAt = (x, y, z, R, opts) => { const l = lens(R, ringMat, { raise: 0.0017, ...opts }); l.position.set(x, y, z); g.add(l); };
  const flash = (x, y, z) => g.add(at(cylZ(0.0033, 0.0004, mat('frosted-glass', '#fff6d8'), { seg: 24 }), [x, y, z]));
  const lidar = (x, y, z) => g.add(at(cylZ(0.0033, 0.0004, mat('screen', '#0a0a0c'), { seg: 24 }), [x, y, z]));

  if (V.layout === 'plateau') {
    // Full-width aluminium camera plateau across the top; glass window below.
    const ph = h * 0.285, raise = 0.0027, pw = w - inset * 2;
    const plateau = extrude(roundRectRadii(pw, ph, [r - inset, r - inset, 0.009, 0.009]), raise, frameMat, { bevel: 0.0012, bevelSeg: 4, curveSeg: 24, name: 'Camera plateau' });
    const yc = h / 2 - inset - ph / 2, zp = back - raise / 2 + 0.0002;
    g.add(at(plateau, [0, yc, zp]));
    const gh = h - inset * 2 - ph - 0.0016;
    g.add(at(flat(roundRectRadii(pw - 0.001, gh, [0.004, 0.004, r - inset, r - inset]), glassMat, 'Back glass'), [0, -h / 2 + inset + gh / 2, back - 0.00005], [0, 180, 0]));
    const top = back - raise + 0.0002, xl = pw / 2 - 0.0107, R = w * 0.114, dy = ph * 0.23;
    lensAt(xl, yc + dy, top, R); lensAt(xl, yc - dy, top, R); lensAt(xl - 0.0175, yc, top, R);
    flash(-xl, yc + dy, top - 0.0002); lidar(-xl, yc - dy, top - 0.0002);
    g.add(at(cylZ(0.0006, 0.0003, mat('screen', '#000'), { seg: 12 }), [-xl, yc, top - 0.0002]));
  } else if (V.layout === 'bar') {
    const ph = 0.0245, raise = 0.0024, pw = w - inset * 2;
    const yc = h / 2 - inset - 0.004 - ph / 2;
    g.add(at(flat(deviceRect(w - inset * 2, h - inset * 2, r - inset), glassMat, 'Back glass'), [0, 0, back - 0.00005], [0, 180, 0]));
    g.add(at(extrude(deviceRect(pw, ph, ph / 2 - 0.0005), raise, frameMat, { bevel: 0.0009, curveSeg: 24, name: 'Camera plateau' }), [0, yc, back - raise / 2 + 0.0002]));
    const top = back - raise + 0.0002;
    lensAt(pw / 2 - 0.0125, yc, top, 0.0086);
    flash(pw / 2 - 0.0285, yc + 0.004, top - 0.0002);
    g.add(at(cylZ(0.0006, 0.0003, mat('screen', '#000'), { seg: 12 }), [pw / 2 - 0.0285, yc - 0.004, top - 0.0002]));
  } else {
    g.add(at(flat(deviceRect(w - inset * 2, h - inset * 2, r - inset), glassMat, 'Back glass'), [0, 0, back - 0.00005], [0, 180, 0]));
    if (V.layout === 'pill') {
      const pw = 0.0215, ph2 = 0.0395, raise = 0.0014;
      const x = w / 2 - inset - 0.0036 - pw / 2, y = h / 2 - inset - 0.0036 - ph2 / 2;
      g.add(at(extrude(deviceRect(pw, ph2, pw / 2 - 0.0003), raise, mat('frosted-glass', color, { roughness: 0.3 }), { bevel: 0.0005, curveSeg: 24, name: 'Camera bump' }), [x, y, back - raise / 2]));
      const top = back - raise;
      lensAt(x, y + 0.0098, top, 0.0078); lensAt(x, y - 0.0098, top, 0.0078);
      flash(x - pw / 2 - 0.0055, y + 0.0098, back - 0.0001);
    } else {
      const s = 0.0375, raise = 0.0014;
      const x = w / 2 - inset - 0.0033 - s / 2, y = h / 2 - inset - 0.0033 - s / 2;
      g.add(at(extrude(deviceRect(s, s, 0.0075), raise, mat('frosted-glass', color, { roughness: 0.28 }), { bevel: 0.0005, curveSeg: 24, name: 'Camera bump' }), [x, y, back - raise / 2]));
      const top = back - raise, R = 0.0078;
      lensAt(x + 0.0082, y + 0.0092, top, R); lensAt(x + 0.0082, y - 0.0092, top, R); lensAt(x - 0.0088, y, top, R);
      flash(x - 0.0098, y + 0.0118, top - 0.0001); lidar(x - 0.0098, y - 0.0118, top - 0.0001);
    }
  }

  // Buttons: side button and Camera Control on the right; Action and volume on the left.
  const btn = frameMat;
  g.add(sideButton(0.0182, w / 2 + 0.0002, h * 0.19, btn));
  g.add(at(box(0.0007, 0.0118, 0.0036, mat('lens', '#15181d'), { r: 0.0003 }), [w / 2 + 0.00005, -h * 0.2, 0]));
  g.add(sideButton(0.0072, -w / 2 - 0.0002, h * 0.305, btn));
  g.add(sideButton(0.0118, -w / 2 - 0.0002, h * 0.19, btn));
  g.add(sideButton(0.0118, -w / 2 - 0.0002, h * 0.09, btn));

  // Bottom: USB-C, speaker and mic holes; antenna bands on the sides.
  const hole = mat('screen', '#050505');
  const port = extrude(deviceRect(0.0088, 0.0026, 0.0012), 0.0003, hole);
  g.add(at(port, [0, -h / 2 - 0.0001, 0], [90, 0, 0]));
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) g.add(at(cyl(0.00055, 0.00055, 0.0003, hole, { seg: 10 }), [s * (0.0095 + i * 0.0024), -h / 2 - 0.0001, 0]));
  const band = mat('matte-plastic', new THREE.Color(color).multiplyScalar(0.7));
  for (const s of [-1, 1]) for (const y of [h / 2 - 0.012, -h / 2 + 0.012]) g.add(at(box(0.0003, 0.0012, d * 0.62, band), [s * (w / 2 + 0.00005), y, 0]));
  return g;
}

/* ---------------- Android phone ---------------- */

function android(P) {
  const w = 0.0778, h = 0.1623, d = 0.0082, r = 0.0045;
  const color = P.color || '#3a3d42';
  const frameMat = mat('titanium', new THREE.Color(color).lerp(new THREE.Color(0x888888), 0.4));
  const g = group('Android phone');
  g.add(extrude(roundRect(w, h, r), d, frameMat, { bevel: 0.0012, bevelSeg: 4, name: 'Frame' }));
  g.add(at(extrude(roundRect(w - 0.001, h - 0.001, r - 0.0004), 0.0006, mat('screen'), { bevel: 0.0002 }), [0, 0, d / 2 - 0.0001]));
  g.add(at(flat(roundRect(w - 0.0032, h - 0.0032, r - 0.0012), screenMaterial(color), 'Display'), [0, 0, d / 2 + 0.00022]));
  g.add(at(cylZ(0.0016, 0.0002, mat('screen', '#000'), { seg: 20 }), [0, h / 2 - 0.0085, d / 2 + 0.00032]));
  g.add(at(flat(roundRect(w - 0.002, h - 0.002, r - 0.0006), mat('frosted-glass', color, { roughness: 0.5 }), 'Back glass'), [0, 0, -d / 2 - 0.00005], [0, 180, 0]));
  const ring = mat('titanium', '#9da1a6');
  const x = w / 2 - 0.0165;
  [[0.0125, 0.0071], [-0.0035, 0.0071], [-0.0195, 0.0071], [-0.0195 + 0.001, 0.0045]].forEach(([dy, R], i) => {
    const l = lens(R, ring, { raise: 0.0016 });
    l.position.set(i === 3 ? x - 0.0155 : x, h / 2 - 0.024 + dy, -d / 2);
    g.add(l);
  });
  g.add(at(cylZ(0.0024, 0.0003, mat('frosted-glass', '#fff5d6'), { seg: 20 }), [x - 0.0155, h / 2 - 0.0115, -d / 2 - 0.0001]));
  g.add(sideButton(0.022, w / 2 + 0.0002, h * 0.2, frameMat));
  g.add(sideButton(0.012, w / 2 + 0.0002, h * 0.06, frameMat));
  const port = extrude(deviceRect(0.0088, 0.0026, 0.0012), 0.0003, mat('screen', '#050505'));
  g.add(at(port, [0, -h / 2 - 0.0001, 0], [90, 0, 0]));
  return g;
}

/* ---------------- tablet ---------------- */

function tablet(P) {
  const w = 0.1785, h = 0.2476, d = 0.0061, r = 0.0185;
  const color = P.color || '#5d6064';
  const body = mat('aluminium', color);
  const g = group('Tablet');
  g.add(extrude(deviceRect(w, h, r), d, body, { bevel: 0.0011, bevelSeg: 4, curveSeg: 28, name: 'Body' }));
  g.add(at(extrude(deviceRect(w - 0.001, h - 0.001, r - 0.0005), 0.0005, mat('screen'), { bevel: 0.0002, curveSeg: 28 }), [0, 0, d / 2 - 0.0001]));
  g.add(at(flat(deviceRect(w - 0.0165, h - 0.0165, r - 0.007), screenMaterial(color, { w: 600, h: 832, kind: 'tablet' }), 'Display'), [0, 0, d / 2 + 0.0002]));
  const l = lens(0.0055, mat('aluminium', new THREE.Color(color).multiplyScalar(0.8)), { raise: 0.0012 });
  l.position.set(w / 2 - 0.013, h / 2 - 0.013, -d / 2);
  g.add(l);
  g.add(sideButton(0.012, w / 2 - 0.02, h / 2 + 0.0002, body).rotateZ(Math.PI / 2));
  return g;
}

/* ---------------- laptop ---------------- */

function laptop(P) {
  const W = 0.3041, D = 0.2155, baseH = 0.0156, lidT = 0.0045;
  const color = P.color || '#c9ccd0';
  const alu = mat('aluminium', color);
  const dark = mat('matte-plastic', '#101113');
  const g = group('Laptop');
  // Base
  const base = extrude(deviceRect(W, D, 0.012), baseH, alu, { bevel: 0.002, bevelSeg: 4, curveSeg: 20, name: 'Base' });
  base.rotation.x = -Math.PI / 2;
  base.position.y = baseH / 2;
  g.add(base);
  // Keyboard well and keys
  const well = at(box(W - 0.028, 0.0006, 0.108, dark, { r: 0.0002 }), [0, baseH + 0.0001, -0.0385]);
  g.add(well);
  const keyMat = mat('matte-plastic', '#1b1c1e');
  const rows = [[15, 0.0098], [14], [14], [13], [12], [10]];
  const pitch = 0.0189, keyW = 0.0162;
  const kg = new THREE.BoxGeometry(keyW, 0.0012, 0.0152);
  rows.forEach((row, ri) => {
    const n = row[0];
    const z = -0.0875 + ri * pitch + (ri === 0 ? 0.002 : 0);
    const h = ri === 0 ? 0.0098 : 0.0152;
    const total = n * pitch, fit = Math.min(1, (W - 0.03) / total);
    for (let i = 0; i < n; i++) {
      const x = (-total / 2 + pitch / 2 + i * pitch) * fit;
      const k = new THREE.Mesh(ri === 0 ? new THREE.BoxGeometry(keyW, 0.0012, h) : kg, keyMat);
      k.position.set(x, baseH + 0.0007, z);
      k.castShadow = true;
      g.add(k);
    }
  });
  // Trackpad
  g.add(at(box(0.1606, 0.0003, 0.0978, mat('frosted-glass', new THREE.Color(color).multiplyScalar(0.95), { roughness: 0.4 }), { r: 0.0001 }), [0, baseH + 0.00005, 0.052]));
  // Lid, hinged at the back edge
  const hinge = group('Lid');
  hinge.position.set(0, baseH, -D / 2 + 0.004);
  const lid = extrude(deviceRect(W, D - 0.006, 0.011), lidT, alu, { bevel: 0.0012, bevelSeg: 3, curveSeg: 20 });
  lid.position.set(0, (D - 0.006) / 2, -lidT / 2);
  hinge.add(lid);
  const panel = at(flat(deviceRect(W - 0.004, D - 0.01, 0.009), mat('screen', '#050506')), [0, (D - 0.006) / 2, 0.0001]);
  hinge.add(panel);
  const disp = flat(roundRect(W - 0.014, D - 0.024, 0.004), screenMaterial(color, { w: 900, h: 600, kind: 'laptop' }), 'Display');
  hinge.add(at(disp, [0, (D - 0.006) / 2 - 0.004, 0.0002]));
  hinge.add(at(flat(roundRect(0.03, 0.006, 0.002), mat('screen', '#000000')), [0, D - 0.0065, 0.00025]));
  hinge.rotation.x = -(Math.max(0, Math.min(180, Number(P.angle ?? 112))) - 90) * Math.PI / 180;
  g.add(hinge);
  return g;
}

/* ---------------- monitor ---------------- */

function monitor(P) {
  const size = Number(P.size) || 27;
  const diag = size * 0.0254, W = diag * 16 / Math.hypot(16, 9), H = diag * 9 / Math.hypot(16, 9);
  const color = P.color || '#2a2b2e';
  const body = mat('matte-plastic', color);
  const alu = mat('aluminium', '#b8bcc0');
  const g = group('Monitor');
  const lift = 0.14 + H / 2;
  const panel = extrude(roundRect(W + 0.012, H + 0.014, 0.006), 0.018, body, { bevel: 0.003, name: 'Panel' });
  g.add(at(panel, [0, lift, 0]));
  g.add(at(flat(roundRect(W + 0.006, H + 0.008, 0.003), mat('screen', '#040405')), [0, lift, 0.0091]));
  g.add(at(flat(roundRect(W, H, 0.001), screenMaterial(color, { w: 1024, h: 576, kind: 'monitor' }), 'Display'), [0, lift, 0.0093]));
  g.add(at(box(0.06, lift - 0.02, 0.022, alu, { r: 0.008 }), [0, (lift - 0.02) / 2 + 0.012, -0.03], [-6, 0, 0]));
  g.add(at(box(0.24, 0.012, 0.18, alu, { r: 0.005 }), [0, 0.006, -0.02]));
  return g;
}

/* ---------------- keyboard ---------------- */

function keyboard(P) {
  const color = P.color || '#2a2c30';
  const caseMat = mat('aluminium', color);
  const keyMat = mat('matte-plastic', P.keys || '#e9e7e2');
  const accent = mat('matte-plastic', P.accent || '#d9722e');
  const u = 0.019;
  const rows = [
    [[1, 'a'], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [2]],
    [[1.5], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1.5]],
    [[1.75], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [2.25, 'a']],
    [[2.25], [1], [1], [1], [1], [1], [1], [1], [1], [1], [1], [2.75]],
    [[1.25], [1.25], [1.25], [6.25], [1.25], [1.25], [1.25], [1.25]],
  ];
  const g = group('Keyboard');
  const W = 15 * u + 0.016, D = 5 * u + 0.016;
  g.add(at(box(W, 0.022, D, caseMat, { r: 0.004 }), [0, 0.011, 0], [3, 0, 0]));
  rows.forEach((row, ri) => {
    let x = -15 * u / 2;
    for (const [wu, tag] of row) {
      const k = box(wu * u - 0.0022, 0.009, u - 0.0022, tag ? accent : keyMat, { r: 0.0018, seg: 2 });
      k.position.set(x + (wu * u) / 2, 0.026 + (4 - ri) * 0.0012, -2 * u + ri * u);
      k.rotation.x = 3 * Math.PI / 180;
      g.add(k);
      x += wu * u;
    }
  });
  return g;
}

/* ---------------- mouse ---------------- */

function mouse(P) {
  const color = P.color || '#1f2023';
  const shell = sphere(0.5, mat('matte-plastic', color), { w: 48, h: 24, thetaLen: Math.PI / 2, name: 'Shell' });
  shell.scale.set(0.064, 0.042, 0.118);
  const g = group('Mouse', shell);
  g.add(at(cyl(0.031, 0.031, 0.002, mat('rubber', '#111'), { seg: 40 }), [0, 0.001, 0], null, [1, 1, 1.85]));
  const wheel = cylX(0.0085, 0.007, mat('rubber', '#3a3b3e'), { seg: 24 });
  g.add(at(wheel, [0, 0.0395, -0.022]));
  g.add(at(box(0.0008, 0.004, 0.05, mat('matte-plastic', '#0d0d0e')), [0, 0.04, -0.03]));
  return g;
}

/* ---------------- headphones ---------------- */

function headphones(P) {
  const color = P.color || '#2b2c30';
  const body = mat('matte-plastic', color);
  const alu = mat('aluminium', '#c9ccd0');
  const cushion = mat('leather', new THREE.Color(color).multiplyScalar(0.8));
  const g = group('Headphones');
  const R = 0.085, cupY = 0.07;
  const band = tube(Array.from({ length: 25 }, (_, i) => { const a = Math.PI * (i / 24); return [Math.cos(a) * R, cupY + 0.03 + Math.sin(a) * R * 1.12, 0]; }), 0.011, body, { segments: 80 });
  band.scale.z = 1.8;
  g.add(band);
  for (const s of [-1, 1]) {
    g.add(at(box(0.005, 0.05, 0.012, alu, { r: 0.002 }), [s * R, cupY + 0.02, 0]));
    const cup = group('Ear cup');
    cup.add(at(extrude(roundRect(0.068, 0.088, 0.03), 0.028, body, { bevel: 0.008, bevelSeg: 4 }), [0, 0, 0], [0, 90, 0]));
    cup.add(at(extrude(roundRect(0.062, 0.082, 0.028), 0.02, cushion, { bevel: 0.008, bevelSeg: 4 }), [-s * 0.02, 0, 0], [0, 90, 0]));
    cup.position.set(s * (R + 0.004), cupY - 0.02, 0);
    g.add(cup);
  }
  return g;
}

/* ---------------- game controller ---------------- */

function controller(P) {
  const color = P.color || '#f1f1ef';
  const body = mat('plastic', color);
  const black = mat('matte-plastic', '#1b1c1f');
  const g = group('Game controller');
  // Top view outline (x across, z towards the player), extruded upwards.
  const outline = [[-0.03, -0.045], [0.03, -0.045], [0.062, -0.04, 0.02], [0.078, -0.01, 0.02], [0.08, 0.04, 0.025], [0.066, 0.068, 0.018], [0.048, 0.062, 0.015], [0.03, 0.02], [-0.03, 0.02], [-0.048, 0.062, 0.015], [-0.066, 0.068, 0.018], [-0.08, 0.04, 0.025], [-0.078, -0.01, 0.02], [-0.062, -0.04, 0.02]];
  const shell = extrude(shapeFrom(outline.map(([x, z, r]) => [x, -z, r])), 0.03, body, { bevel: 0.011, bevelSeg: 5, curveSeg: 12 });
  shell.rotation.x = -Math.PI / 2;
  shell.position.y = 0.015;
  g.add(shell);
  for (const [x, z] of [[-0.035, 0.005], [0.018, 0.022]]) {
    g.add(at(cyl(0.008, 0.009, 0.012, black, { seg: 24 }), [x, 0.032, z]));
    g.add(at(cyl(0.011, 0.011, 0.004, mat('rubber', '#2a2b2e'), { seg: 24 }), [x, 0.039, z]));
  }
  const dp = group('D-pad', at(box(0.022, 0.004, 0.007, black, { r: 0.0015 }), [0, 0, 0]), at(box(0.007, 0.004, 0.022, black, { r: 0.0015 }), [0, 0, 0]));
  g.add(at(dp, [-0.018, 0.031, 0.024]));
  [['#3aa655', 0, 0.012], ['#d5463c', 0.011, 0], ['#3a6fd8', -0.011, 0], ['#e0b43a', 0, -0.012]].forEach(([c, dx, dz]) => g.add(at(cyl(0.0046, 0.0046, 0.004, mat('glossy-plastic', c), { seg: 20 }), [0.042 + dx, 0.031, -0.004 + dz])));
  return g;
}

/* ---------------- smartwatch ---------------- */

function smartwatch(P) {
  const color = P.color || '#2a2b2e';
  const alu = mat('aluminium', color);
  const g = group('Smartwatch');
  const W = 0.0396, H = 0.046, T = 0.0107;
  const body = extrude(deviceRect(W, H, 0.0105), T, alu, { bevel: 0.003, bevelSeg: 5, curveSeg: 24, name: 'Case' });
  body.rotation.x = -Math.PI / 2;
  g.add(at(body, [0, 0.03, 0]));
  const scr = flat(deviceRect(W - 0.003, H - 0.003, 0.009), screenMaterial(color, { w: 400, h: 470, kind: 'watch' }), 'Display');
  scr.rotation.x = -Math.PI / 2;
  g.add(at(scr, [0, 0.03 + T / 2 + 0.0002, 0]));
  g.add(at(cylX(0.0032, 0.004, mat('knurled', color), { seg: 24 }), [W / 2 + 0.0015, 0.03, -0.006]));
  const band = mat('rubber', P.band || '#384152');
  g.add(tubeBand(band, H));
  return g;
}

function tubeBand(material, H) {
  const pts = [[0, 0.03, -H / 2 + 0.002], [0, 0.025, -0.036], [0, 0.004, -0.044], [0, -0.02, -0.03], [0, -0.027, 0], [0, -0.02, 0.03], [0, 0.004, 0.044], [0, 0.025, 0.036], [0, 0.03, H / 2 - 0.002]];
  // A round tube flattened sideways into a 24 mm strap.
  const b = tube(pts, 0.0016, material, { segments: 96, radial: 10 });
  b.scale.set(7.5, 1, 1);
  return b;
}

/* ---------------- desktop PC ---------------- */

function desktopPC(P) {
  const color = P.color || '#1c1d20';
  const steel = mat('matte-plastic', color);
  const g = group('Desktop PC');
  const W = 0.23, H = 0.47, D = 0.46;
  g.add(at(box(W, H, D, steel, { r: 0.008 }), [0, H / 2 + 0.02, 0]));
  for (const x of [-0.08, 0.08]) for (const z of [-0.17, 0.17]) g.add(at(cyl(0.02, 0.02, 0.02, mat('rubber'), { seg: 16 }), [x, 0.01, z]));
  // Tempered glass side panel with lit fans behind
  g.add(at(box(0.004, H - 0.02, D - 0.02, mat('tinted-glass', '#222a30'), { r: 0.003 }), [W / 2 + 0.002, H / 2 + 0.02, 0]));
  const glow = mat('emissive', P.glow || '#5ab8ff');
  for (const [y, z] of [[0.36, 0.16], [0.22, 0.16], [0.36, -0.05]]) {
    const fan = group('Fan', at(torus(0.05, 0.004, glow, { radial: 8, tubular: 48 }), [0, 0, 0], [0, 90, 0]), at(cylX(0.018, 0.02, steel, { seg: 20 }), [0, 0, 0]));
    for (let i = 0; i < 7; i++) fan.add(at(box(0.004, 0.04, 0.014, mat('matte-plastic', '#2a2b2f')), [0, 0, 0], [i * (360 / 7), 0, 0]).translateY(0.026));
    g.add(at(fan, [W / 2 - 0.03, y, z]));
  }
  g.add(at(box(0.01, 0.12, 0.26, mat('gunmetal', '#34363a'), { r: 0.004 }), [W / 2 - 0.05, 0.16, -0.02]));
  g.add(at(cylZ(0.006, 0.004, mat('light', '#9fd8ff'), { seg: 20 }), [0, H - 0.02, D / 2 + 0.002]));
  return g;
}

/* ---------------- drone ---------------- */

function drone(P) {
  const color = P.color || '#4a4d52';
  const body = mat('plastic', color);
  const dark = mat('matte-plastic', '#1d1e21');
  const g = group('Drone');
  g.add(at(box(0.09, 0.05, 0.16, body, { r: 0.02 }), [0, 0.07, 0]));
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const arm = box(0.14, 0.012, 0.02, body, { r: 0.005 });
    const ang = Math.atan2(sz * 0.11, sx * 0.14);
    g.add(at(arm, [sx * 0.07, 0.08, sz * 0.055], [0, -ang * 180 / Math.PI, 0]));
    const mx = sx * 0.14, mz = sz * 0.11;
    g.add(at(cyl(0.013, 0.014, 0.02, dark, { seg: 20 }), [mx, 0.09, mz]));
    for (let b = 0; b < 2; b++) g.add(at(box(0.13, 0.002, 0.016, mat('matte-plastic', '#2c2d31'), { r: 0.006 }), [mx, 0.102, mz], [0, b * 90 + 20, 3]));
    g.add(at(cyl(0.004, 0.004, 0.07, dark), [mx * 0.55, 0.035, mz * 0.6]));
  }
  const gim = group('Gimbal camera', at(box(0.03, 0.028, 0.03, dark, { r: 0.006 }), [0, 0, 0]));
  const l = lens(0.009, mat('gunmetal'), { raise: 0.004 });
  l.rotation.y = Math.PI;
  gim.add(at(l, [0, 0, 0.015]));
  g.add(at(gim, [0, 0.038, 0.085]));
  return g;
}

/* ---------------- DSLR camera ---------------- */

function camera(P) {
  const color = P.color || '#1b1c1e';
  const body = mat('matte-plastic', color);
  const grip = mat('leather', '#141415');
  const g = group('Camera');
  g.add(at(profile([[-0.07, 0], [0.07, 0], [0.07, 0.08], [0.035, 0.08], [0.02, 0.104, 0.008], [-0.02, 0.104, 0.008], [-0.035, 0.08], [-0.07, 0.08]], 0.075, body, { round: 0.008, bevel: 0.008, name: 'Body' }), [0, 0, 0]));
  g.add(at(box(0.034, 0.078, 0.03, grip, { r: 0.012 }), [0.056, 0.04, 0.045]));
  const lensG = group('Lens', lathe([[0, 0], [0.036, 0], [0.036, 0.02], [0.034, 0.022], [0.034, 0.06], [0.037, 0.064], [0.037, 0.095], [0.033, 0.1], [0, 0.1]], mat('matte-plastic', '#141416'), { seg: 48 }));
  lensG.add(at(torus(0.0352, 0.0015, mat('glossy-plastic', '#c1272d'), { radial: 6, tubular: 48 }), [0, 0.062, 0], [90, 0, 0]));
  lensG.add(at(cyl(0.028, 0.028, 0.002, mat('lens', '#0a1020'), { seg: 40 }), [0, 0.1, 0]));
  g.add(at(lensG, [-0.005, 0.042, 0.035], [90, 0, 0]));
  g.add(at(box(0.05, 0.035, 0.004, mat('screen'), { r: 0.002 }), [0, 0.042, -0.0385]));
  g.add(at(cyl(0.009, 0.009, 0.006, mat('knurled', '#26272a'), { seg: 24 }), [0.045, 0.083, -0.01]));
  g.add(at(cyl(0.006, 0.006, 0.004, mat('gunmetal', '#b8bcc0'), { seg: 20 }), [0.048, 0.082, 0.028]));
  return g;
}

/* ---------------- catalogue ---------------- */

const iphoneColor = (id) => ({ type: 'color', label: 'Colour', default: IPHONES[id].colors[0][0], swatches: IPHONES[id].colors });
const iphoneDef = (id, aliases, desc) => ({
  id: `iphone-${id}`, name: IPHONES[id].name, category: 'Tech', aliases, description: desc,
  params: { color: iphoneColor(id) },
  build: (P) => iphone(P, id), present: { rotate: [0, 200, 0] },
});

export const TECH_MODELS = [
  iphoneDef('17-pro', ['iphone 17 pro', 'iphone17 pro', '17 pro', 'iphone 17pro', 'i phone 17 pro'], 'iPhone 17 Pro (2025) at 150.0 × 71.9 × 8.75 mm: aluminium unibody, full-width camera plateau with the triple 48 MP cameras, glass window, Camera Control and a lit Super Retina display.'),
  iphoneDef('17-pro-max', ['iphone 17 pro max', '17 pro max', 'iphone17 pro max', 'pro max'], 'iPhone 17 Pro Max (2025) at 163.4 × 78.0 × 8.75 mm with the full-width camera plateau.'),
  iphoneDef('17', ['iphone 17', 'iphone17', 'iphone 17 base'], 'iPhone 17 (2025): aluminium frame, colour-infused glass back and the vertical dual-camera pill.'),
  iphoneDef('air', ['iphone air', 'iphone 17 air'], 'iPhone Air (2025): 5.64 mm thin, titanium frame and a single-camera plateau across the top.'),
  iphoneDef('16-pro', ['iphone 16 pro', 'iphone16 pro', '16 pro'], 'iPhone 16 Pro (2024): titanium frame and the square triple-camera bump.'),
  { id: 'android-phone', name: 'Android phone', category: 'Tech', aliases: ['android', 'android phone', 'samsung phone', 'galaxy phone', 'galaxy s25 ultra', 'galaxy s26 ultra', 'smartphone', 'phone', 'mobile phone', 'cell phone'], description: 'Flagship Android phone with flat sides, individual camera rings and a punch-hole display.', params: { color: { type: 'color', label: 'Colour', default: '#3a3d42' } }, build: android, present: { rotate: [0, 200, 0] } },
  { id: 'tablet', name: 'Tablet', category: 'Tech', aliases: ['tablet', 'ipad', 'ipad air', 'ipad pro', 'galaxy tab'], description: '11-inch tablet with slim bezels and an aluminium unibody.', params: { color: { type: 'color', label: 'Colour', default: '#5d6064' } }, build: tablet },
  { id: 'laptop', name: 'Laptop', category: 'Tech', aliases: ['laptop', 'macbook', 'macbook air', 'macbook pro', 'notebook', 'notebook computer', 'ultrabook'], description: '13-inch aluminium laptop with a full keyboard, glass trackpad and adjustable lid.', params: { color: { type: 'color', label: 'Colour', default: '#c9ccd0', swatches: [['#c9ccd0', 'Silver'], ['#2f3134', 'Space Black'], ['#232a36', 'Midnight'], ['#e8ddc8', 'Starlight']] }, angle: { type: 'range', label: 'Lid angle', min: 0, max: 180, step: 1, default: 112, unit: '°' } }, build: laptop },
  { id: 'monitor', name: 'Monitor', category: 'Tech', aliases: ['monitor', 'display', 'computer monitor', 'screen', 'pc monitor'], description: '16:9 desktop monitor on an aluminium stand; set the diagonal.', params: { size: { type: 'range', label: 'Diagonal', min: 21, max: 49, step: 1, default: 27, unit: 'in' }, color: { type: 'color', label: 'Colour', default: '#2a2b2e' } }, build: monitor },
  { id: 'keyboard', name: 'Mechanical keyboard', category: 'Tech', aliases: ['keyboard', 'mechanical keyboard', '60% keyboard', 'computer keyboard'], description: '60% mechanical keyboard with sculpted keycaps and accent keys.', params: { color: { type: 'color', label: 'Case', default: '#2a2c30' }, keys: { type: 'color', label: 'Keycaps', default: '#e9e7e2' }, accent: { type: 'color', label: 'Accent keys', default: '#d9722e' } }, build: keyboard },
  { id: 'mouse', name: 'Computer mouse', category: 'Tech', aliases: ['mouse', 'computer mouse', 'gaming mouse'], description: 'Ergonomic computer mouse with a scroll wheel.', params: { color: { type: 'color', label: 'Colour', default: '#1f2023' } }, build: mouse },
  { id: 'headphones', name: 'Headphones', category: 'Tech', aliases: ['headphones', 'headset', 'over ear headphones', 'airpods max', 'sony wh-1000xm'], description: 'Over-ear headphones with a padded band and leather cushions.', params: { color: { type: 'color', label: 'Colour', default: '#2b2c30' } }, build: headphones },
  { id: 'game-controller', name: 'Game controller', category: 'Tech', aliases: ['controller', 'game controller', 'gamepad', 'joypad', 'xbox controller', 'playstation controller', 'dualsense'], description: 'Twin-stick gamepad with a d-pad and four face buttons.', params: { color: { type: 'color', label: 'Colour', default: '#f1f1ef' } }, build: controller },
  { id: 'smartwatch', name: 'Smartwatch', category: 'Tech', aliases: ['smartwatch', 'smart watch', 'apple watch', 'watch'], description: 'Smartwatch with a lit display, digital crown and sport band.', params: { color: { type: 'color', label: 'Case', default: '#2a2b2e' }, band: { type: 'color', label: 'Band', default: '#384152' } }, build: smartwatch },
  { id: 'desktop-pc', name: 'Gaming PC', category: 'Tech', aliases: ['pc', 'desktop pc', 'gaming pc', 'computer tower', 'pc case', 'desktop computer'], description: 'Mid-tower PC with a tempered-glass side and lit fans.', params: { color: { type: 'color', label: 'Case', default: '#1c1d20' }, glow: { type: 'color', label: 'Lighting', default: '#5ab8ff' } }, build: desktopPC },
  { id: 'drone', name: 'Camera drone', category: 'Tech', aliases: ['drone', 'quadcopter', 'dji drone', 'uav'], description: 'Quadcopter with four rotors and a gimbal camera.', params: { color: { type: 'color', label: 'Colour', default: '#4a4d52' } }, build: drone },
  { id: 'camera', name: 'DSLR camera', category: 'Tech', aliases: ['camera', 'dslr', 'mirrorless camera', 'digital camera', 'canon camera', 'nikon camera', 'sony camera'], description: 'Interchangeable-lens camera with a zoom lens and rear screen.', params: { color: { type: 'color', label: 'Colour', default: '#1b1c1e' } }, build: camera },
];

