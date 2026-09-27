/* ============================================================
   3D Lab — everyday objects, vehicles, sport, nature, buildings

   Real-size models (metres) built from lathes, extrusions and tubes.
   ============================================================ */

import { TeapotGeometry } from 'three/examples/jsm/geometries/TeapotGeometry.js';
import { group, at, box, cyl, cylX, cylZ, sphere, torus, lathe, tube, profile, extrude, shapeFrom, mesh, sample, DEG, THREE } from '../kit.js';
import { mat } from '../materials.js';

/* ---------------- kitchen and table ---------------- */

function mug(P) {
  const m = mat('ceramic', P.color || '#f4f2ee');
  const g = group('Mug');
  g.add(lathe([[0, 0], [0.038, 0], [0.041, 0.004], [0.042, 0.095], [0.0395, 0.097], [0.037, 0.093], [0.0365, 0.008], [0, 0.008]], m, { seg: 64 }));
  g.add(at(torus(0.026, 0.006, m, { arc: Math.PI * 1.15, radial: 12, tubular: 36 }), [0.043, 0.05, 0], [0, 0, -100]));
  if (P.coffee !== false) g.add(at(cyl(0.0366, 0.0366, 0.002, mat('glossy-plastic', '#3b2415'), { seg: 48 }), [0, 0.08, 0]));
  return g;
}

function wineGlass(P) {
  const glass = mat('glass', '#eef4f6');
  const g = group('Wine glass');
  g.add(lathe([[0, 0], [0.036, 0], [0.037, 0.002], [0.004, 0.006], [0.0035, 0.1], [0.012, 0.112], [0.036, 0.14], [0.042, 0.175], [0.036, 0.215], [0.0345, 0.215], [0.0405, 0.175], [0.0345, 0.142], [0.01, 0.114], [0, 0.113]], glass, { seg: 64 }));
  if (P.wine !== false) g.add(lathe([[0, 0.114], [0.012, 0.116], [0.033, 0.142], [0.039, 0.165], [0, 0.165]], mat('tinted-glass', P.color || '#5a0f1c', { opacity: 0.88 }), { seg: 48 }));
  return g;
}

function bottle(P) {
  const glass = P.kind === 'plastic' ? mat('glass', P.color || '#bfe0f0', { opacity: 0.7 }) : mat('tinted-glass', P.color || '#2d4a2a', { opacity: 0.85 });
  const g = group('Bottle');
  g.add(lathe([[0, 0], [0.036, 0], [0.038, 0.006], [0.038, 0.2], [0.032, 0.225], [0.014, 0.26], [0.013, 0.3], [0.015, 0.302], [0.015, 0.31], [0, 0.31]], glass, { seg: 48 }));
  g.add(at(cyl(0.0385, 0.0385, 0.08, mat('paper', P.label || '#efe7d4'), { seg: 48, open: true }), [0, 0.1, 0]));
  g.add(at(cyl(0.0155, 0.0155, 0.018, mat('gold'), { seg: 24 }), [0, 0.305, 0]));
  return g;
}

function teapot(P) {
  const geo = new TeapotGeometry(0.1, 12, true, true, true, true, true);
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y, 0);
  return group('Teapot', mesh(geo, mat(P.material === 'metal' ? 'brushed-steel' : 'porcelain', P.color || '#f7f6f2')));
}

function plate(P) {
  const m = mat('porcelain', P.color || '#fbfbf8');
  return group('Plate', lathe([[0, 0], [0.07, 0], [0.075, 0.004], [0.105, 0.006], [0.13, 0.02], [0.133, 0.022], [0.128, 0.022], [0.104, 0.011], [0.074, 0.009], [0, 0.009]], m, { seg: 72 }));
}

/* ---------------- household ---------------- */

function lightbulb(P) {
  const g = group('Light bulb');
  g.add(lathe([[0, 0], [0.008, 0], [0.012, 0.004], [0.013, 0.03], [0, 0.03]], mat('brass'), { seg: 32 }));
  for (let i = 0; i < 4; i++) g.add(at(torus(0.0132, 0.0012, mat('brass'), { radial: 6, tubular: 32 }), [0, 0.008 + i * 0.006, 0], [90, 0, 0]));
  const on = P.on !== false;
  g.add(lathe([[0.013, 0.03], [0.016, 0.045], [0.026, 0.06], [0.03, 0.08], [0.028, 0.098], [0.02, 0.114], [0.01, 0.12], [0, 0.122]], on ? mat('light', '#fff3d6') : mat('glass'), { seg: 48 }));
  return g;
}

function candle(P) {
  const g = group('Candle');
  g.add(at(cyl(0.035, 0.035, 0.14, mat('wax', P.color || '#f1e6d0'), { seg: 40 }), [0, 0.07, 0]));
  g.add(at(cyl(0.0015, 0.0015, 0.014, mat('matte-plastic', '#1a1a1a'), { seg: 8 }), [0, 0.147, 0]));
  if (P.lit !== false) g.add(at(sphere(0.01, mat('light', '#ffcf6b'), { w: 16, h: 12 }), [0, 0.165, 0], null, [0.7, 1.9, 0.7]));
  return g;
}

function trophy(P) {
  const m = mat(P.metal === 'silver' ? 'chrome' : 'gold');
  const g = group('Trophy');
  g.add(at(box(0.12, 0.05, 0.12, mat('walnut'), { r: 0.004 }), [0, 0.025, 0]));
  g.add(lathe([[0, 0.05], [0.04, 0.05], [0.036, 0.058], [0.012, 0.07], [0.01, 0.13], [0.02, 0.14], [0.06, 0.18], [0.07, 0.25], [0.066, 0.25], [0.056, 0.184], [0.016, 0.146], [0, 0.145]], m, { seg: 64 }));
  for (const s of [-1, 1]) g.add(at(torus(0.03, 0.005, m, { arc: Math.PI, radial: 10, tubular: 24 }), [s * 0.066, 0.21, 0], [0, 0, s * -90]));
  return g;
}

function trafficCone(P) {
  const orange = mat('glossy-plastic', P.color || '#f05a1a', { roughness: 0.4 });
  const g = group('Traffic cone');
  g.add(at(box(0.38, 0.03, 0.38, mat('rubber', '#1b1b1c'), { r: 0.02 }), [0, 0.015, 0]));
  g.add(lathe([[0.15, 0.03], [0.02, 0.7], [0, 0.7]], orange, { seg: 48 }));
  for (const [y0, y1] of [[0.42, 0.5], [0.27, 0.36]]) g.add(lathe([[0.15 - 0.13 * (y0 - 0.03) / 0.67 + 0.001, y0], [0.15 - 0.13 * (y1 - 0.03) / 0.67 + 0.001, y1]], mat('plastic', '#f4f4f2'), { seg: 48 }));
  return g;
}

function barrel(P) {
  const wood = mat('oak', P.color || '#8a5a34');
  const g = group('Barrel');
  g.add(lathe(sample(20, t => [0.26 + Math.sin(t * Math.PI) * 0.045, t * 0.88]).concat([[0, 0.88]]), wood, { seg: 48 }));
  g.add(at(cyl(0.255, 0.255, 0.01, wood, { seg: 48 }), [0, 0.005, 0]));
  for (const t of [0.08, 0.3, 0.7, 0.92]) g.add(at(torus(0.262 + Math.sin(t * Math.PI) * 0.045, 0.006, mat('gunmetal'), { radial: 8, tubular: 64 }), [0, t * 0.88, 0], [90, 0, 0], [1, 1, 3]));
  return g;
}

function crate(P) {
  const wood = mat('wood', P.color || '#b08958');
  const g = group('Crate');
  const s = Number(P.size) || 0.5;
  g.add(at(box(s * 0.94, s * 0.94, s * 0.94, mat('wood', '#6b5234')), [0, s / 2, 0]));
  for (const face of [0, 90, 180, 270]) {
    const f = group('Face');
    for (const y of [0.06, 0.94]) f.add(at(box(s, s * 0.12, 0.02, wood), [0, s * y, s / 2]));
    for (const x of [-0.44, 0.44]) f.add(at(box(s * 0.12, s, 0.02, wood), [s * x, s / 2, s / 2 + 0.001]));
    f.add(at(box(s * 1.2, s * 0.1, 0.018, wood), [0, s / 2, s / 2 + 0.004], [0, 0, 45]));
    f.rotation.y = face * DEG;
    g.add(f);
  }
  g.add(at(box(s, 0.02, s, wood), [0, s, 0]));
  return g;
}

function book(P) {
  const cover = mat('leather', P.color || '#6b1e24');
  const g = group('Book');
  const W = 0.16, H = 0.235, T = 0.035;
  g.add(at(box(W - 0.006, H - 0.008, T - 0.004, mat('paper', '#f1ead8')), [0.003, H / 2, 0]));
  for (const s of [-1, 1]) g.add(at(box(W, H, 0.003, cover, { r: 0.001 }), [0, H / 2, s * (T / 2)]));
  g.add(at(cyl(T / 2, T / 2, H, cover, { seg: 24, len: Math.PI, start: Math.PI }), [-W / 2, H / 2, 0]));
  g.add(at(box(0.08, 0.012, 0.0005, mat('gold')), [0, H * 0.7, T / 2 + 0.0017]));
  return g;
}

function pencil(P) {
  const g = group('Pencil');
  const body = cylX(0.0038, 0.15, mat('glossy-plastic', P.color || '#f2c230'), { seg: 6 });
  g.add(at(body, [0, 0.0038, 0]));
  g.add(at(cylX(0.0039, 0.012, mat('brass'), { seg: 16 }), [-0.081, 0.0038, 0]));
  g.add(at(cylX(0.0036, 0.01, mat('rubber', '#e89aa0'), { seg: 16 }), [-0.092, 0.0038, 0]));
  const cone = cylX(0.0038, 0.02, mat('oak', '#e2c49a'), { seg: 6, r2: 0.0008 });
  g.add(at(cone, [0.085, 0.0038, 0]));
  g.add(at(cylX(0.0009, 0.003, mat('gunmetal', '#2a2a2a'), { seg: 8, r2: 0.0001 }), [0.0965, 0.0038, 0]));
  return g;
}

function hammer(P) {
  const g = group('Hammer');
  g.add(at(box(0.33, 0.028, 0.02, mat(P.handle === 'rubber' ? 'rubber' : 'wood', '#b88a54'), { r: 0.009 }), [0, 0.014, 0]));
  const head = profile([[-0.02, -0.018], [0.02, -0.018], [0.02, 0.07], [0.012, 0.075], [0.012, 0.09], [-0.012, 0.09], [-0.012, 0.075], [-0.02, 0.07], [-0.02, -0.06, 0.02], [-0.03, -0.1]], 0.026, mat('steel'), { bevel: 0.003 });
  g.add(at(head, [0.15, 0.014, 0], [0, 0, 90]));
  return g;
}

/* ---------------- sport and games ---------------- */

function soccerBall(P) {
  // Truncated icosahedron: 12 pentagons (dark) + 20 hexagons, puffed onto a sphere.
  const R = 0.11;
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const pos = ico.attributes.position;
  const verts = [];
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    if (!verts.some(u => u.distanceTo(v) < 1e-4)) verts.push(v);
  }
  const g = group('Football');
  g.add(sphere(R * 0.985, mat('plastic', P.color || '#f4f4f2'), { w: 64, h: 40 }));
  const dark = mat('glossy-plastic', P.accent || '#1b1c1e', { roughness: 0.4 });
  for (const v of verts) {
    const patch = mesh(new THREE.SphereGeometry(R, 5, 1, 0, Math.PI * 2, 0, 0.36), dark);
    patch.lookAt(v);
    patch.rotateX(Math.PI / 2);
    g.add(patch);
  }
  g.position.y = R;
  return group('Football', g);
}

function basketball(P) {
  const R = 0.12;
  const g = group('Basketball', sphere(R, mat('rubber', P.color || '#d9621f'), { w: 64, h: 40 }));
  const line = mat('rubber', '#1b1b1b');
  g.add(torus(R, 0.0018, line, { radial: 6, tubular: 96 }));
  g.add(at(torus(R, 0.0018, line, { radial: 6, tubular: 96 }), [0, 0, 0], [0, 90, 0]));
  g.add(at(torus(R, 0.0018, line, { radial: 6, tubular: 96 }), [0, 0, 0], [90, 0, 0]));
  for (const s of [-1, 1]) g.add(at(torus(R * 0.78, 0.0018, line, { radial: 6, tubular: 96 }), [s * R * 0.62, 0, 0], [0, 90, 0]));
  g.position.y = R;
  return group('Basketball', g);
}

function die(P) {
  const s = Number(P.size) || 0.02;
  const g = group('Die', at(box(s, s, s, mat('glossy-plastic', P.color || '#f5f5f2'), { r: s * 0.14, seg: 4 }), [0, s / 2, 0]));
  const pip = mat('glossy-plastic', P.pips || '#1b1b1d');
  const faces = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  const place = [[1, [0, 1, 0]], [6, [0, -1, 0]], [2, [0, 0, 1]], [5, [0, 0, -1]], [3, [1, 0, 0]], [4, [-1, 0, 0]]];
  for (const [n, nrm] of place) {
    for (const [a, b] of faces[n]) {
      const d = sphere(s * 0.09, pip, { w: 12, h: 8 });
      const off = s * 0.27;
      const p = new THREE.Vector3(...nrm).multiplyScalar(s / 2 - s * 0.03);
      if (nrm[1]) p.add(new THREE.Vector3(a * off, 0, b * off));
      else if (nrm[2]) p.add(new THREE.Vector3(a * off, b * off, 0));
      else p.add(new THREE.Vector3(0, a * off, b * off));
      d.position.copy(p).add(new THREE.Vector3(0, s / 2, 0));
      d.scale.setComponent(nrm.findIndex(x => x !== 0), 0.35);
      g.add(d);
    }
  }
  return g;
}

const CHESS = {
  pawn: [[0, 0], [0.016, 0], [0.016, 0.004], [0.012, 0.008], [0.0075, 0.02], [0.006, 0.03], [0.0095, 0.032], [0.0095, 0.034], [0.006, 0.035], [0.0085, 0.043], [0.0075, 0.05], [0.004, 0.054], [0, 0.055]],
  rook: [[0, 0], [0.018, 0], [0.018, 0.005], [0.014, 0.009], [0.011, 0.02], [0.01, 0.045], [0.013, 0.048], [0.013, 0.064], [0.0095, 0.064], [0.0095, 0.058], [0, 0.058]],
  bishop: [[0, 0], [0.017, 0], [0.017, 0.005], [0.013, 0.009], [0.0075, 0.03], [0.006, 0.045], [0.0095, 0.047], [0.0095, 0.049], [0.006, 0.05], [0.009, 0.06], [0.008, 0.07], [0.004, 0.076], [0.0025, 0.078], [0.003, 0.081], [0, 0.083]],
  queen: [[0, 0], [0.019, 0], [0.019, 0.005], [0.015, 0.01], [0.008, 0.035], [0.0065, 0.058], [0.0105, 0.061], [0.0105, 0.063], [0.007, 0.064], [0.012, 0.08], [0.01, 0.084], [0.005, 0.086], [0.004, 0.09], [0, 0.093]],
  king: [[0, 0], [0.019, 0], [0.019, 0.005], [0.015, 0.01], [0.0085, 0.036], [0.007, 0.062], [0.011, 0.065], [0.011, 0.067], [0.0075, 0.068], [0.011, 0.082], [0.0105, 0.087], [0.004, 0.089], [0, 0.089]],
};

function chessPiece(P) {
  const kind = CHESS[P.piece] ? P.piece : 'king';
  const m = P.side === 'black' ? mat('glossy-plastic', '#1b1b1d', { roughness: 0.25 }) : mat('porcelain', '#efe8da');
  const g = group(`Chess ${kind}`, lathe(CHESS[kind], m, { seg: 48 }));
  if (kind === 'rook') for (let i = 0; i < 4; i++) g.add(at(box(0.0055, 0.006, 0.0055, m), [Math.cos(i * Math.PI / 2 + Math.PI / 4) * 0.0105, 0.067, Math.sin(i * Math.PI / 2 + Math.PI / 4) * 0.0105]));
  if (kind === 'king') { g.add(at(box(0.004, 0.02, 0.004, m), [0, 0.098, 0])); g.add(at(box(0.013, 0.004, 0.004, m), [0, 0.1, 0])); }
  if (kind === 'queen') for (let i = 0; i < 8; i++) g.add(at(sphere(0.0022, m, { w: 10, h: 8 }), [Math.cos(i * Math.PI / 4) * 0.011, 0.083, Math.sin(i * Math.PI / 4) * 0.011]));
  if (kind === 'bishop') g.add(at(sphere(0.003, m, { w: 12, h: 8 }), [0, 0.085, 0]));
  return g;
}

function chessSet() {
  const g = group('Chess set');
  const sq = 0.05;
  const board = group('Board');
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) board.add(at(box(sq, 0.01, sq, mat('wood', (i + j) % 2 ? '#5b3620' : '#e0c79a')), [(i - 3.5) * sq, 0.015, (j - 3.5) * sq]));
  board.add(at(box(sq * 8 + 0.04, 0.02, sq * 8 + 0.04, mat('walnut')), [0, 0.005, 0]));
  g.add(board);
  const back = ['rook', 'bishop', 'bishop', 'queen', 'king', 'bishop', 'bishop', 'rook'];
  for (const [side, row, pawnRow] of [['white', -3.5, -2.5], ['black', 3.5, 2.5]]) {
    back.forEach((piece, i) => g.add(at(chessPiece({ piece, side }), [(i - 3.5) * sq, 0.02, row * sq])));
    for (let i = 0; i < 8; i++) g.add(at(chessPiece({ piece: 'pawn', side }), [(i - 3.5) * sq, 0.02, pawnRow * sq]));
  }
  return g;
}

function guitar(P) {
  const top = mat('oak', P.color || '#d9b27a');
  const side = mat('walnut');
  const g = group('Acoustic guitar');
  // Body outline (front view), extruded for depth
  const outline = sample(40, t => { const a = t * Math.PI * 2; const y = -Math.cos(a) * 0.245 + 0.245; const w = (y < 0.2 ? 0.19 : y < 0.3 ? 0.13 + (0.3 - y) * 0.6 : 0.145) * Math.abs(Math.sin(a)) + 0.0001; return [Math.sin(a) >= 0 ? w : -w, y]; });
  const body = extrude(shapeFrom(outline), 0.1, side, { bevel: 0.01, curveSeg: 8 });
  g.add(body);
  g.add(at(extrude(shapeFrom(outline), 0.004, top, { bevel: 0.001 }), [0, 0, 0.049]));
  g.add(at(torus(0.043, 0.004, mat('walnut', '#2a1a10'), { radial: 6, tubular: 48 }), [0, 0.3, 0.052]));
  g.add(at(cyl(0.042, 0.042, 0.002, mat('matte-plastic', '#0a0a0a'), { seg: 40 }), [0, 0.3, 0.05], [90, 0, 0]));
  g.add(at(box(0.1, 0.012, 0.01, mat('walnut', '#241510')), [0, 0.1, 0.054]));
  g.add(at(box(0.048, 0.46, 0.022, mat('walnut'), { r: 0.006 }), [0, 0.7, 0.03]));
  g.add(at(box(0.052, 0.46, 0.006, mat('walnut', '#2a1a10')), [0, 0.7, 0.043]));
  for (let i = 1; i < 18; i++) g.add(at(box(0.052, 0.0015, 0.0015, mat('brass')), [0, 0.47 + i * 0.022 * Math.pow(0.985, i), 0.047]));
  g.add(at(box(0.085, 0.18, 0.018, mat('walnut'), { r: 0.012 }), [0, 1.01, 0.022], [-12, 0, 0]));
  for (let i = 0; i < 6; i++) g.add(at(cylX(0.004, 0.02, mat('chrome'), { seg: 10 }), [(i < 3 ? -1 : 1) * 0.052, 0.96 + (i % 3) * 0.045, 0.02]));
  for (let i = 0; i < 6; i++) g.add(at(cyl(0.0005, 0.0005, 0.9, mat('chrome'), { seg: 4 }), [(i - 2.5) * 0.007, 0.55, 0.057]));
  g.rotation.x = -8 * DEG;
  return g;
}

/* ---------------- nature ---------------- */

function tree(P) {
  const g = group('Tree');
  const bark = mat('bark', '#5c4230');
  g.add(lathe([[0.22, 0], [0.14, 0.2], [0.12, 1.8], [0.09, 2.6], [0, 2.7]], bark, { seg: 16 }));
  for (const [x, y, z, a] of [[0.4, 2.0, 0.2, 45], [-0.4, 2.3, -0.1, -40], [0.1, 2.5, -0.4, 30]]) g.add(tube([[0, y - 0.5, 0], [x * 0.6, y - 0.1, z * 0.6], [x, y + 0.2, z]], 0.05, bark, { segments: 12, radial: 8 }));
  const leaf = mat('foliage', P.color || '#4f8a3c');
  const rng = (() => { let x = 11; return () => ((x = (x * 16807) % 2147483647) / 2147483647); })();
  for (let i = 0; i < 12; i++) {
    const a = rng() * Math.PI * 2, r = rng() * 0.9, y = 2.6 + rng() * 1.4;
    g.add(at(mesh(new THREE.IcosahedronGeometry(0.6 + rng() * 0.45, 1), leaf), [Math.cos(a) * r, y, Math.sin(a) * r]));
  }
  return g;
}

function pineTree(P) {
  const g = group('Pine tree', lathe([[0.16, 0], [0.1, 1.2], [0, 1.25]], mat('bark', '#4f3827'), { seg: 12 }));
  const leaf = mat('foliage', P.color || '#2f5d3a');
  for (let i = 0; i < 5; i++) {
    const cone = mesh(new THREE.ConeGeometry(1.3 - i * 0.22, 1.5 - i * 0.12, 9, 2), leaf);
    cone.position.y = 1.2 + i * 0.75;
    cone.rotation.y = i * 0.4;
    g.add(cone);
  }
  if (P.snow) for (let i = 0; i < 5; i++) g.add(at(mesh(new THREE.ConeGeometry(0.9 - i * 0.16, 0.5, 9, 1), mat('plastic', '#f7f9fb')), [0, 1.62 + i * 0.75, 0], [0, i * 0.4 * 57.3, 0]));
  return g;
}

function rock(P) {
  const geo = new THREE.IcosahedronGeometry(0.4, 2);
  const pos = geo.attributes.position;
  let seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const bumps = Array.from({ length: 6 }, () => [new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), rnd() * 0.25]);
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const n = v.clone().normalize();
    let k = 1;
    for (const [d, a] of bumps) k += a * Math.max(0, n.dot(d)) ** 3;
    v.multiplyScalar(k * (0.9 + 0.1 * Math.sin(v.x * 11) * Math.cos(v.z * 9)));
    v.y *= 0.62;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.min.y, 0);
  return group('Rock', mesh(geo, mat('stone', P.color || '#8f8a82')));
}

/* ---------------- vehicles ---------------- */

function wheel(R, width, rimMat, tyreMat, spokes = 5) {
  const w = group('Wheel');
  const tyre = lathe([[R * 0.72, -width / 2], [R * 0.97, -width / 2], [R, -width * 0.3], [R, width * 0.3], [R * 0.97, width / 2], [R * 0.72, width / 2]], tyreMat, { seg: 56 });
  tyre.rotation.x = Math.PI / 2;
  w.add(tyre);
  const rim = cylZ(R * 0.72, width * 0.8, rimMat, { seg: 48 });
  w.add(rim);
  for (let i = 0; i < spokes; i++) w.add(at(box(R * 0.14, R * 0.62, 0.02, rimMat, { r: 0.008 }), [0, 0, width * 0.42], [0, 0, i * 360 / spokes]).translateY(R * 0.33));
  w.add(at(cylZ(R * 0.16, 0.03, mat('chrome'), { seg: 24 }), [0, 0, width * 0.42]));
  return w;
}

function car(P) {
  const paint = mat('car-paint', P.color || '#9c1b1f');
  const glass = mat('tinted-glass', '#1a2126');
  const black = mat('matte-plastic', '#141516');
  const W = 1.84;
  const g = group('Car');
  // Lower body side profile (x forward), extruded across the width
  const bodyPts = [[-2.35, 0.3], [2.3, 0.3], [2.38, 0.42, 0.08], [2.36, 0.68, 0.1], [1.2, 0.84, 0.2], [-1.6, 0.9], [-2.3, 0.88, 0.1], [-2.38, 0.6, 0.1]];
  g.add(profile(bodyPts, W, paint, { bevel: 0.09, bevelSeg: 5, curveSeg: 10, name: 'Body' }));
  // Cabin
  g.add(profile([[1.2, 0.83], [-1.7, 0.88], [-1.25, 1.36, 0.12], [0.35, 1.4, 0.15]], W - 0.18, glass, { bevel: 0.06, bevelSeg: 4, name: 'Glasshouse' }));
  g.add(profile([[0.9, 1.28], [-1.1, 1.3], [-0.98, 1.43, 0.1], [0.3, 1.44, 0.1]], W - 0.28, paint, { bevel: 0.04, name: 'Roof' }));
  for (const s of [-1, 1]) {
    g.add(at(box(0.09, 0.48, 0.02, paint), [-0.28, 1.12, s * (W / 2 - 0.1)], [0, 0, -6]));
    const mirror = box(0.14, 0.08, 0.16, paint, { r: 0.03 });
    g.add(at(mirror, [0.95, 0.98, s * (W / 2 + 0.05)]));
  }
  // Lights, grille, bumpers
  for (const s of [-1, 1]) {
    g.add(at(box(0.08, 0.08, 0.42, mat('light', '#eef4ff'), { r: 0.03 }), [2.32, 0.64, s * 0.62]));
    g.add(at(box(0.06, 0.07, 0.46, mat('emissive', '#c0121c'), { r: 0.025 }), [-2.36, 0.72, s * 0.6]));
  }
  g.add(at(box(0.05, 0.16, 0.9, black, { r: 0.03 }), [2.37, 0.46, 0]));
  g.add(at(box(0.1, 0.12, W - 0.1, black, { r: 0.04 }), [-2.36, 0.36, 0]));
  // Wheels in arches
  const rimMat = mat('aluminium', '#b9bec3', { roughness: 0.25 });
  const tyreMat = mat('rubber', '#1a1a1b');
  for (const x of [1.45, -1.45]) for (const s of [-1, 1]) {
    const w = wheel(0.34, 0.23, rimMat, tyreMat);
    if (s < 0) w.rotation.y = Math.PI;
    g.add(at(w, [x, 0.34, s * (W / 2 - 0.12)]));
    g.add(at(torus(0.4, 0.035, black, { arc: Math.PI, radial: 8, tubular: 32 }), [x, 0.34, s * (W / 2 - 0.02)], null, [1, 1, 2.2]));
  }
  return g;
}

function bicycle(P) {
  const frameM = mat('paint', P.color || '#2c5aa0');
  const dark = mat('matte-plastic', '#151516');
  const steel = mat('chrome', '#c9ccd0');
  const g = group('Bicycle');
  const R = 0.34, rearX = -0.5, frontX = 0.52, axleY = R;
  for (const x of [rearX, frontX]) {
    const w = group('Wheel');
    w.add(torus(R - 0.012, 0.016, mat('rubber', '#18181a'), { radial: 12, tubular: 96 }));
    w.add(torus(R - 0.03, 0.008, steel, { radial: 8, tubular: 96 }));
    for (let i = 0; i < 28; i++) { const a = i * Math.PI * 2 / 28; w.add(at(cyl(0.0012, 0.0012, R - 0.04, steel, { seg: 4 }), [Math.cos(a) * (R - 0.04) / 2, Math.sin(a) * (R - 0.04) / 2, (i % 2 ? 1 : -1) * 0.012], [0, 0, a / DEG - 90])); }
    w.add(cylZ(0.022, 0.08, steel, { seg: 20 }));
    g.add(at(w, [x, axleY, 0]));
  }
  const bb = [0.0, 0.3, 0], seat = [-0.14, 0.82, 0], head = [0.44, 0.84, 0], headLow = [0.47, 0.72, 0];
  const T = (a, b, r = 0.018) => g.add(tube([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], b], r, frameM, { segments: 4, radial: 12 }));
  T(bb, seat); T(seat, head, 0.016); T(bb, headLow, 0.021); T(head, headLow, 0.022);
  for (const s of [-1, 1]) {
    T([bb[0], bb[1], s * 0.03], [rearX, axleY, s * 0.06], 0.011);
    T([seat[0], seat[1] - 0.04, s * 0.02], [rearX, axleY, s * 0.06], 0.01);
    T([headLow[0], headLow[1], s * 0.02], [frontX, axleY, s * 0.055], 0.013);
  }
  g.add(tube([[head[0] - 0.01, head[1], 0], [head[0] - 0.03, head[1] + 0.12, 0]], 0.014, steel, { segments: 2 }));
  g.add(tube([[head[0] - 0.03, head[1] + 0.12, -0.28], [head[0] + 0.02, head[1] + 0.13, -0.2], [head[0] - 0.03, head[1] + 0.12, 0], [head[0] + 0.02, head[1] + 0.13, 0.2], [head[0] - 0.03, head[1] + 0.12, 0.28]], 0.012, dark, { segments: 40 }));
  g.add(tube([seat, [seat[0] - 0.03, seat[1] + 0.12, 0]], 0.013, steel, { segments: 2 }));
  g.add(at(profile([[-0.13, 0], [0.13, 0], [0.12, 0.02, 0.02], [0.02, 0.035], [-0.12, 0.04, 0.03]], 0.14, mat('leather', '#1d1d1f'), { bevel: 0.02 }), [seat[0] - 0.03, seat[1] + 0.12, 0]));
  g.add(at(cylZ(0.1, 0.01, steel, { seg: 40 }), [bb[0], bb[1], 0.06]));
  for (const s of [-1, 1]) {
    g.add(at(box(0.17, 0.016, 0.01, steel, { r: 0.004 }), [bb[0], bb[1], s * 0.08], [0, 0, s * 35]).translateX(s * 0.06));
  }
  return g;
}

function airplane(P) {
  const paint = mat('paint', P.color || '#f2f3f4', { roughness: 0.35 });
  const accent = mat('paint', P.accent || '#1f4e9c');
  const L = 37.6;
  const g = group('Airliner');
  const fus = lathe([[0, -L / 2], [0.9, -L / 2 + 1.2], [1.85, -L / 2 + 5], [1.98, -L / 2 + 9], [1.98, L / 2 - 9], [1.6, L / 2 - 4], [0.6, L / 2 - 0.6], [0, L / 2]], paint, { seg: 48 });
  fus.rotation.z = -Math.PI / 2;
  g.add(at(fus, [0, 2.9, 0]));
  // Wings (swept), tailplane, fin
  for (const s of [-1, 1]) {
    // Planform drawn in x/y then laid flat: y becomes the span on this side.
    const wing = profile([[3, 0], [-3.5, 0], [-9, 16.5], [-7.2, 16.5]], 0.45, paint, { bevel: 0.15 });
    g.add(at(wing, [-1, 2.2, 0], [s * 90, 0, 0]));
    const eng = lathe([[1.0, -2], [1.15, -1.6], [1.15, 1.4], [0.8, 2.1], [0.6, 2.1], [0.7, -1.9]], mat('aluminium', '#c8ccd0'), { seg: 36 });
    eng.rotation.z = -Math.PI / 2;
    g.add(at(eng, [0.5, 1.2, s * 5.8]));
    g.add(at(profile([[-14, 0], [-17.5, 0], [-19.4, 6.2], [-18.4, 6.2]], 0.25, paint, { bevel: 0.08 }), [0, 3.2, 0], [s * 90, 0, 0]));
  }
  g.add(profile([[-13.5, 4.6], [-18.8, 4.6], [-19.6, 11.5], [-17.6, 11.5]], 0.3, accent, { bevel: 0.1, name: 'Fin' }));
  // Windows and cockpit
  for (let i = 0; i < 30; i++) for (const s of [-1, 1]) g.add(at(box(0.22, 0.3, 0.02, mat('tinted-glass', '#1b2230'), { r: 0.08 }), [12 - i * 0.82, 3.35, s * 1.97]));
  g.add(at(box(0.9, 0.35, 2.2, mat('tinted-glass', '#1b2230'), { r: 0.1 }), [16.6, 3.55, 0], [0, 0, -18]));
  g.add(at(box(27, 0.4, 0.04, accent), [-1, 2.6, 1.98]));
  g.add(at(box(27, 0.4, 0.04, accent), [-1, 2.6, -1.98]));
  // Landing gear
  for (const [x, z] of [[13.5, 0], [-1.2, 3.8], [-1.2, -3.8]]) {
    g.add(at(cyl(0.12, 0.12, 1.3, mat('steel')), [x, 1.1, z]));
    g.add(at(cylZ(0.55, 0.4, mat('rubber'), { seg: 24 }), [x, 0.55, z]));
  }
  return g;
}

function rocket(P) {
  const white = mat('paint', P.color || '#f1f2f3', { roughness: 0.4 });
  const black = mat('matte-plastic', '#1a1b1d');
  const g = group('Rocket');
  g.add(lathe([[0, 0], [1.85, 0], [1.85, 45], [1.85, 47], [1.6, 52], [1.0, 56], [0.3, 58.5], [0, 59]], white, { seg: 48 }));
  g.add(at(cyl(1.87, 1.87, 3, black, { seg: 48 }), [0, 43.5, 0]));
  for (let i = 0; i < 4; i++) g.add(at(profile([[0, 0], [2.6, 0], [1.8, 3.2], [0, 6]], 0.2, black, { bevel: 0.05 }), [0, 0.5, 0], [0, i * 90, 0]).translateX(1.8));
  for (let i = 0; i < 9; i++) { const a = i * 40 * DEG, r = i ? 1.1 : 0; g.add(at(lathe([[0.2, 0], [0.45, -1.1], [0.42, -1.1], [0.18, 0]], mat('steel', '#565a60'), { seg: 20 }), [Math.cos(a) * r, 0.05, Math.sin(a) * r])); }
  if (P.flame !== false) g.add(at(mesh(new THREE.ConeGeometry(1.6, 9, 24, 1, true), mat('light', '#ffb347', { opacity: 0.85 })), [0, -5.6, 0], [180, 0, 0]));
  return g;
}

/* ---------------- buildings ---------------- */

function house(P) {
  const wall = mat('concrete', P.color || '#e8e1d4');
  const roofM = mat('stone', P.roof || '#7a3b2e');
  const W = 10, D = 8, H = 3;
  const g = group('House');
  g.add(at(box(W, H, D, wall), [0, H / 2, 0]));
  const roof = profile([[-D / 2 - 0.5, 0], [D / 2 + 0.5, 0], [0, 3.2]], W + 1, roofM, { bevel: 0.05 });
  roof.rotation.y = Math.PI / 2;
  g.add(at(roof, [0, H, 0]));
  g.add(at(box(1.1, 2.2, 0.08, mat('walnut'), { r: 0.02 }), [0, 1.1, D / 2 + 0.03]));
  for (const x of [-3, 3]) {
    g.add(at(box(1.6, 1.3, 0.06, mat('tinted-glass', '#2a3b48')), [x, 1.6, D / 2 + 0.02]));
    g.add(at(box(1.75, 0.08, 0.14, mat('plastic', '#fbfbfa')), [x, 0.93, D / 2 + 0.05]));
  }
  g.add(at(box(0.8, 1.8, 0.8, mat('stone', '#8a5a44')), [3, H + 2.2, -1.2]));
  g.add(at(box(W + 3, 0.1, D + 3, mat('foliage', '#6f9b52')), [0, -0.05, 0]));
  return g;
}

/* ---------------- catalogue ---------------- */

const colorParam = (def, label = 'Colour') => ({ color: { type: 'color', label, default: def } });

export const OBJECT_MODELS = [
  { id: 'mug', name: 'Coffee mug', category: 'Home & kitchen', aliases: ['mug', 'coffee mug', 'cup', 'coffee cup', 'tea cup'], description: 'Ceramic mug with coffee.', params: { ...colorParam('#f4f2ee'), coffee: { type: 'toggle', label: 'Coffee', default: true } }, build: mug },
  { id: 'wine-glass', name: 'Wine glass', category: 'Home & kitchen', aliases: ['wine glass', 'glass', 'goblet', 'wineglass'], description: 'Clear stemmed glass with red wine.', params: { wine: { type: 'toggle', label: 'Wine', default: true }, color: { type: 'color', label: 'Wine', default: '#5a0f1c' } }, build: wineGlass },
  { id: 'bottle', name: 'Bottle', category: 'Home & kitchen', aliases: ['bottle', 'wine bottle', 'beer bottle', 'glass bottle', 'water bottle'], description: 'Glass bottle with a paper label.', params: { ...colorParam('#2d4a2a', 'Glass'), label: { type: 'color', label: 'Label', default: '#efe7d4' } }, build: bottle },
  { id: 'teapot', name: 'Teapot', category: 'Home & kitchen', aliases: ['teapot', 'utah teapot', 'tea pot', 'kettle'], description: 'The classic Utah teapot in porcelain.', params: { ...colorParam('#f7f6f2'), material: { type: 'select', label: 'Material', options: [['porcelain', 'Porcelain'], ['metal', 'Steel']], default: 'porcelain' } }, build: teapot },
  { id: 'plate', name: 'Dinner plate', category: 'Home & kitchen', aliases: ['plate', 'dinner plate', 'dish'], description: 'Porcelain dinner plate.', params: colorParam('#fbfbf8'), build: plate },
  { id: 'lightbulb', name: 'Light bulb', category: 'Home & kitchen', aliases: ['light bulb', 'lightbulb', 'bulb', 'lamp bulb'], description: 'Screw-base light bulb, lit or off.', params: { on: { type: 'toggle', label: 'Lit', default: true } }, build: lightbulb },
  { id: 'candle', name: 'Candle', category: 'Home & kitchen', aliases: ['candle', 'pillar candle'], description: 'Wax pillar candle with a flame.', params: { ...colorParam('#f1e6d0', 'Wax'), lit: { type: 'toggle', label: 'Lit', default: true } }, build: candle },
  { id: 'book', name: 'Book', category: 'Home & kitchen', aliases: ['book', 'hardcover', 'novel'], description: 'Clothbound hardback.', params: colorParam('#6b1e24', 'Cover'), build: book },
  { id: 'pencil', name: 'Pencil', category: 'Home & kitchen', aliases: ['pencil', 'hb pencil'], description: 'Hexagonal HB pencil with an eraser.', params: colorParam('#f2c230'), build: pencil },
  { id: 'hammer', name: 'Hammer', category: 'Home & kitchen', aliases: ['hammer', 'claw hammer'], description: 'Claw hammer with a wooden handle.', params: {}, build: hammer },
  { id: 'crate', name: 'Wooden crate', category: 'Home & kitchen', aliases: ['crate', 'wooden crate', 'box crate', 'wooden box'], description: 'Braced timber crate.', params: { size: { type: 'range', label: 'Size', min: 0.2, max: 1.5, step: 0.05, default: 0.5, unit: 'm' } }, build: crate },
  { id: 'barrel', name: 'Barrel', category: 'Home & kitchen', aliases: ['barrel', 'wine barrel', 'wooden barrel', 'cask'], description: 'Oak barrel with iron hoops.', params: {}, build: barrel },
  { id: 'traffic-cone', name: 'Traffic cone', category: 'Home & kitchen', aliases: ['traffic cone', 'safety cone', 'road cone', 'pylon'], description: 'Road traffic cone with reflective bands.', params: colorParam('#f05a1a'), build: trafficCone },
  { id: 'trophy', name: 'Trophy', category: 'Sport & games', aliases: ['trophy', 'cup trophy', 'award'], description: 'Two-handled trophy cup on a walnut plinth.', params: { metal: { type: 'select', label: 'Metal', options: [['gold', 'Gold'], ['silver', 'Silver']], default: 'gold' } }, build: trophy },
  { id: 'football', name: 'Football (soccer ball)', category: 'Sport & games', aliases: ['football', 'soccer ball', 'soccer', 'ball'], description: 'Size-5 football with the classic pentagon panels.', params: { ...colorParam('#f4f4f2'), accent: { type: 'color', label: 'Panels', default: '#1b1c1e' } }, build: soccerBall },
  { id: 'basketball', name: 'Basketball', category: 'Sport & games', aliases: ['basketball'], description: 'Size-7 basketball with seams.', params: colorParam('#d9621f'), build: basketball },
  { id: 'die', name: 'Die', category: 'Sport & games', aliases: ['dice', 'die', 'd6'], description: 'Six-sided die with rounded edges.', params: { size: { type: 'range', label: 'Size', min: 0.01, max: 0.2, step: 0.005, default: 0.02, unit: 'm' }, ...colorParam('#f5f5f2') }, build: die },
  { id: 'chess-piece', name: 'Chess piece', category: 'Sport & games', aliases: ['chess piece', 'chess king', 'chess queen', 'pawn', 'rook', 'bishop'], description: 'Staunton-style chess piece.', params: { piece: { type: 'select', label: 'Piece', options: [['king', 'King'], ['queen', 'Queen'], ['bishop', 'Bishop'], ['rook', 'Rook'], ['pawn', 'Pawn']], default: 'king' }, side: { type: 'select', label: 'Side', options: [['white', 'White'], ['black', 'Black']], default: 'white' } }, build: chessPiece },
  { id: 'chess-set', name: 'Chess set', category: 'Sport & games', aliases: ['chess set', 'chess board', 'chessboard'], description: 'Wooden board set up for a game.', params: {}, build: chessSet },
  { id: 'guitar', name: 'Acoustic guitar', category: 'Sport & games', aliases: ['guitar', 'acoustic guitar', 'dreadnought'], description: 'Dreadnought acoustic guitar with six strings.', params: colorParam('#d9b27a', 'Top'), build: guitar },
  { id: 'tree', name: 'Tree', category: 'Nature & buildings', aliases: ['tree', 'oak tree', 'deciduous tree'], description: 'Broadleaf tree about 4 m tall.', params: colorParam('#4f8a3c', 'Leaves'), build: tree },
  { id: 'pine-tree', name: 'Pine tree', category: 'Nature & buildings', aliases: ['pine tree', 'pine', 'fir tree', 'christmas tree', 'conifer'], description: 'Conifer, optionally snow-capped.', params: { ...colorParam('#2f5d3a', 'Needles'), snow: { type: 'toggle', label: 'Snow', default: false } }, build: pineTree },
  { id: 'rock', name: 'Rock', category: 'Nature & buildings', aliases: ['rock', 'stone', 'boulder'], description: 'Weathered boulder.', params: colorParam('#8f8a82'), build: rock },
  { id: 'house', name: 'House', category: 'Nature & buildings', aliases: ['house', 'home', 'bungalow', 'cottage'], description: 'Single-storey house with a gable roof.', params: { ...colorParam('#e8e1d4', 'Walls'), roof: { type: 'color', label: 'Roof', default: '#7a3b2e' } }, build: house },
  { id: 'car', name: 'Car (sedan)', category: 'Vehicles', aliases: ['car', 'sedan', 'saloon', 'automobile', 'vehicle'], description: 'Four-door sedan, 4.7 m long, with alloy wheels.', params: colorParam('#9c1b1f', 'Paint'), build: car },
  { id: 'bicycle', name: 'Bicycle', category: 'Vehicles', aliases: ['bicycle', 'bike', 'road bike', 'cycle'], description: 'Diamond-frame bicycle with spoked wheels.', params: colorParam('#2c5aa0', 'Frame'), build: bicycle },
  { id: 'airplane', name: 'Airliner', category: 'Vehicles', aliases: ['airplane', 'aeroplane', 'plane', 'airliner', 'jet', 'a320', 'boeing 737'], description: 'Narrow-body twin-engine airliner at 37.6 m.', params: { ...colorParam('#f2f3f4', 'Livery'), accent: { type: 'color', label: 'Accent', default: '#1f4e9c' } }, build: airplane },
  { id: 'rocket', name: 'Rocket', category: 'Vehicles', aliases: ['rocket', 'space rocket', 'launch vehicle', 'falcon 9'], description: 'Two-stage launch vehicle with landing legs, about 59 m tall.', params: { flame: { type: 'toggle', label: 'Engine plume', default: false } }, build: rocket },
];

