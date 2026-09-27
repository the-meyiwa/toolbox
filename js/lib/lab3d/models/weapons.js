/* ============================================================
   3D Lab — display models: rifles and blades

   Visual, non-functional replicas at real size, blocked out the way
   game and film props are: each part is a side-profile outline
   extruded across the gun with a small bevel. No internal mechanism
   is modelled. x runs towards the muzzle, y is up.
   ============================================================ */

import { group, at, box, cyl, cylX, cylZ, sphere, torus, profile, extrude, shapeFrom, pathFrom, arcBand, roundRect } from '../kit.js';
import { mat } from '../materials.js';

const FURNITURE = {
  wood: { kind: 'walnut', color: '#7a3c1b' },
  plum: { kind: 'polymer', color: '#4a2a2e' },
  black: { kind: 'polymer', color: '#1d1e20' },
  fde: { kind: 'polymer', color: '#b89b72' },
};

function ak47(P) {
  const steel = mat('gunmetal', '#2d2e31');
  const recv = mat('gunmetal', '#35363a', { roughness: 0.55 });
  const f = FURNITURE[P.furniture] || FURNITURE.wood;
  const wood = mat(f.kind, f.color);
  const magMat = P.magazine === 'bakelite' ? mat('glossy-plastic', '#8a3a14', { roughness: 0.35 })
    : P.magazine === 'polymer' ? mat('polymer', '#1f2022') : mat('gunmetal', '#2a2b2e');
  const dark = mat('matte-plastic', '#101112');
  const g = group('AK-47');

  // Receiver and top cover
  g.add(profile([[0, 0.004], [0.285, 0.004], [0.285, 0.052], [0, 0.052]], 0.032, recv, { round: 0.004, bevel: 0.003, name: 'Receiver' }));
  g.add(profile([[0.005, 0.05], [0.235, 0.05], [0.235, 0.064, 0.01], [0.2, 0.072], [0.02, 0.071], [0.005, 0.066, 0.005]], 0.03, steel, { bevel: 0.006, name: 'Dust cover' }));
  g.add(at(cylZ(0.0045, 0.012, steel), [0.004, 0.062, 0], [0, 0, 0]));
  // Ejection port (right side)
  g.add(at(box(0.07, 0.014, 0.002, dark, { r: 0.0009 }), [0.19, 0.043, 0.0161]));
  // Rivets, both sides
  for (const [x, y] of [[0.03, 0.014], [0.03, 0.04], [0.13, 0.012], [0.265, 0.014], [0.265, 0.04]]) g.add(at(cylZ(0.0026, 0.034, steel), [x, y, 0]));

  // Rear sight block and leaf
  g.add(profile([[0.235, 0.05], [0.31, 0.05], [0.305, 0.074], [0.255, 0.08], [0.235, 0.07]], 0.026, steel, { bevel: 0.003, name: 'Rear sight' }));
  g.add(profile([[0.25, 0.078], [0.305, 0.074], [0.305, 0.079], [0.25, 0.085]], 0.018, steel, { bevel: 0.0015 }));

  // Handguards
  g.add(profile([[0.31, 0.0], [0.488, 0.004], [0.5, 0.012], [0.5, 0.044], [0.31, 0.048]], 0.05, wood, { round: 0.006, bevel: 0.012, name: 'Lower handguard' }));
  g.add(profile([[0.315, 0.05], [0.49, 0.05], [0.49, 0.066, 0.008], [0.47, 0.077], [0.33, 0.077], [0.315, 0.068, 0.006]], 0.036, wood, { bevel: 0.012, name: 'Upper handguard' }));
  g.add(at(box(0.014, 0.052, 0.052, steel, { r: 0.004 }), [0.507, 0.024, 0]));

  // Barrel, gas system, cleaning rod
  g.add(at(cylX(0.0095, 0.43, steel, { seg: 24 }), [0.515, 0.034, 0]));
  g.add(at(cylX(0.0115, 0.075, steel, { seg: 24 }), [0.527, 0.066, 0]));
  g.add(profile([[0.555, 0.022], [0.587, 0.022], [0.587, 0.058], [0.58, 0.077], [0.562, 0.077], [0.555, 0.06]], 0.026, steel, { bevel: 0.004, name: 'Gas block' }));
  g.add(at(cylX(0.003, 0.25, steel, { seg: 10 }), [0.63, 0.013, 0]));
  // Front sight base, hood ears and post
  g.add(profile([[0.655, 0.018], [0.7, 0.018], [0.7, 0.045], [0.686, 0.062], [0.672, 0.062], [0.66, 0.04]], 0.024, steel, { bevel: 0.003, name: 'Front sight' }));
  for (const z of [-0.0105, 0.0105]) g.add(at(box(0.014, 0.022, 0.003, steel, { r: 0.001 }), [0.679, 0.072, z]));
  g.add(at(cyl(0.0018, 0.0018, 0.018, steel, { seg: 8 }), [0.679, 0.074, 0]));
  // Slant muzzle brake
  const brake = extrude(shapeFrom([[0, -0.0125], [0.04, -0.0125], [0.046, 0.0125], [0, 0.0125]], 0.002), 0.025, steel, { bevel: 0.004 });
  g.add(at(brake, [0.73, 0.034, 0]));

  // Magazine (curved), floorplate, catch
  const C = [0.555, 0.004];
  g.add(extrude(shapeFrom(arcBand(C, 0.34, 0.405, Math.PI, Math.PI + 0.6, 28)), 0.026, magMat, { bevel: 0.004, name: 'Magazine' }));
  g.add(extrude(shapeFrom(arcBand(C, 0.335, 0.41, Math.PI + 0.585, Math.PI + 0.605, 4)), 0.03, magMat, { bevel: 0.003 }));
  for (const t of [0.14, 0.3, 0.46]) {
    const a = Math.PI + 0.6 * t;
    const rib = extrude(shapeFrom(arcBand(C, 0.35, 0.395, a, a + 0.012, 3)), 0.029, magMat, { bevel: 0.0012 });
    g.add(rib);
  }
  g.add(at(box(0.008, 0.028, 0.02, steel, { r: 0.002 }), [0.144, -0.012, 0]));

  // Trigger guard and trigger
  const guard = roundRect(0.088, 0.036, 0.012, [0.103, -0.016]);
  guard.holes.push(roundRectPath(0.072, 0.024, 0.008, [0.103, -0.02]));
  g.add(extrude(guard, 0.011, steel, { bevel: 0.002, name: 'Trigger guard' }));
  g.add(profile([[0.098, -0.001], [0.105, -0.001], [0.1, -0.024, 0.004], [0.09, -0.029]], 0.007, steel, { bevel: 0.0015 }));

  // Pistol grip
  g.add(profile([[0.012, 0.002], [0.062, 0.002], [0.055, -0.022], [0.034, -0.11, 0.01], [-0.014, -0.116, 0.012], [-0.012, -0.08], [0.004, -0.024]], 0.03, wood, { bevel: 0.008, name: 'Pistol grip' }));

  // Stock and butt plate
  g.add(profile([[0.006, 0.052], [-0.3, 0.036], [-0.315, 0.032, 0.012], [-0.315, -0.084, 0.01], [-0.3, -0.09], [-0.18, -0.054], [-0.05, -0.014], [0.006, 0.004]], 0.042, wood, { bevel: 0.009, name: 'Stock' }));
  g.add(profile([[-0.315, 0.034], [-0.324, 0.033], [-0.324, -0.088], [-0.315, -0.089]], 0.043, steel, { round: 0.003, bevel: 0.004, name: 'Butt plate' }));
  g.add(at(torus(0.009, 0.0022, steel, { radial: 8, tubular: 20 }), [-0.24, -0.075, 0], [0, 90, 0]));

  // Selector lever (right side) and charging handle
  g.add(at(profile([[0.08, 0.036], [0.215, 0.044], [0.215, 0.05], [0.08, 0.046]], 0.003, steel, { bevel: 0.0008, name: 'Selector' }), [0, 0, 0.0185]));
  g.add(at(cylZ(0.0035, 0.004, steel), [0.215, 0.047, 0.0195]));
  g.add(at(cylZ(0.0045, 0.022, steel), [0.232, 0.054, 0.026]));
  g.add(at(sphere(0.0065, steel, { w: 16, h: 12 }), [0.232, 0.054, 0.037]));
  // Blocked out long: pull the fore-end and stock in to the AKM's ~0.9 m overall.
  remapX(g, (x) => (x > 0.31 ? 0.31 + (x - 0.31) * 0.78 : x < 0 ? x * 0.78 : x));
  return g;
}

/** Remaps x through `f`: long parts are stretched vertex by vertex, short ones just move. */
function remapX(g, f) {
  g.updateMatrixWorld(true);
  for (const m of g.children) {
    if (!m.isMesh) continue;
    m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox;
    const x0 = bb.min.x + m.position.x, x1 = bb.max.x + m.position.x;
    if (x1 - x0 < 0.06 || m.rotation.x || m.rotation.y || m.rotation.z) { const c = (x0 + x1) / 2; m.position.x += f(c) - c; continue; }
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setX(i, f(pos.getX(i) + m.position.x) - m.position.x);
    pos.needsUpdate = true;
    m.geometry.computeBoundingBox();
    m.geometry.computeBoundingSphere();
  }
}

function roundRectPath(w, h, r, [cx, cy]) {
  const x = cx - w / 2, y = cy - h / 2;
  return pathFrom([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], r);
}

function mp5(P) {
  const steel = mat('gunmetal', '#222326', { roughness: 0.5 });
  const poly = mat('polymer', P.furniture === 'fde' ? '#b89b72' : '#1b1c1e');
  const dark = mat('matte-plastic', '#0e0f10');
  const g = group('MP5');

  // Receiver: a rounded stamped tube; top spine and claw-mount dimples
  g.add(profile([[0, 0.0], [0.25, 0.0], [0.25, 0.054], [0.0, 0.054]], 0.036, steel, { round: 0.006, bevel: 0.011, name: 'Receiver' }));
  g.add(at(box(0.2, 0.004, 0.012, steel, { r: 0.0015 }), [0.13, 0.055, 0]));
  for (const x of [0.07, 0.19]) g.add(at(box(0.012, 0.004, 0.02, steel, { r: 0.0015 }), [x, 0.056, 0]));
  // Ejection port (right) and cocking tube
  g.add(at(box(0.05, 0.012, 0.002, dark, { r: 0.001 }), [0.16, 0.036, 0.0181]));
  g.add(at(cylX(0.0125, 0.16, steel, { seg: 28 }), [0.325, 0.04, 0]));
  g.add(at(cylX(0.0145, 0.012, steel, { seg: 28 }), [0.25, 0.04, 0]));
  // Cocking handle (left, folded forward)
  const ch = group('Cocking handle', at(box(0.028, 0.006, 0.005, steel, { r: 0.002 }), [0.012, 0, 0]), at(sphere(0.006, steel, { w: 14, h: 10 }), [0.026, 0, 0]));
  g.add(at(ch, [0.3, 0.046, -0.016], [0, 25, 12]));

  // Front sight: base and ring hood with post
  g.add(profile([[0.372, 0.028], [0.402, 0.028], [0.4, 0.052], [0.376, 0.052]], 0.02, steel, { bevel: 0.003, name: 'Front sight' }));
  g.add(at(torus(0.0135, 0.0032, steel, { radial: 10, tubular: 36 }), [0.388, 0.066, 0], [0, 90, 0]));
  g.add(at(box(0.004, 0.012, 0.0025, steel), [0.388, 0.06, 0]));

  // Barrel and three-lug muzzle
  g.add(at(cylX(0.0088, 0.2, steel, { seg: 24 }), [0.34, 0.018, 0]));
  g.add(at(cylX(0.011, 0.02, steel, { seg: 24 }), [0.432, 0.018, 0]));
  for (let i = 0; i < 3; i++) {
    const lug = at(box(0.012, 0.004, 0.005, steel), [0.432, 0.018, 0], [i * 120, 0, 0]);
    lug.geometry.translate(0, 0.012, 0);
    g.add(lug);
  }

  // Slim handguard
  g.add(profile([[0.25, -0.008], [0.378, -0.004], [0.388, 0.004], [0.388, 0.03], [0.25, 0.032]], 0.043, poly, { round: 0.008, bevel: 0.014, name: 'Handguard' }));
  for (let i = 0; i < 5; i++) g.add(at(box(0.004, 0.028, 0.044, dark, { r: 0.0015 }), [0.27 + i * 0.022, 0.012, 0]));

  // Rotary drum rear sight
  g.add(at(box(0.03, 0.012, 0.02, steel, { r: 0.002 }), [0.03, 0.058, 0]));
  g.add(at(cylX(0.0145, 0.02, steel, { seg: 20 }), [0.03, 0.072, 0]));

  // Magazine well and curved 30-round magazine
  g.add(profile([[0.152, 0.002], [0.195, 0.002], [0.195, -0.03], [0.152, -0.03]], 0.028, steel, { round: 0.003, bevel: 0.003, name: 'Magazine well' }));
  const C = [0.79, -0.02];
  g.add(extrude(shapeFrom(arcBand(C, 0.6, 0.634, Math.PI, Math.PI + 0.31, 20)), 0.022, steel, { bevel: 0.003, name: 'Magazine' }));
  g.add(extrude(shapeFrom(arcBand(C, 0.597, 0.637, Math.PI + 0.3, Math.PI + 0.316, 3)), 0.026, dark, { bevel: 0.002 }));
  g.add(profile([[0.14, -0.005], [0.148, -0.005], [0.146, -0.045], [0.138, -0.045]], 0.02, steel, { bevel: 0.002, name: 'Mag release' }));

  // Trigger housing, guard, trigger and pistol grip
  g.add(profile([[0.02, 0.003], [0.152, 0.003], [0.152, -0.01], [0.02, -0.01]], 0.034, poly, { round: 0.003, bevel: 0.006, name: 'Trigger housing' }));
  const guard = roundRect(0.07, 0.032, 0.012, [0.112, -0.024]);
  guard.holes.push(roundRectPath(0.056, 0.02, 0.007, [0.112, -0.027]));
  g.add(extrude(guard, 0.012, poly, { bevel: 0.002, name: 'Trigger guard' }));
  g.add(profile([[0.1, -0.008], [0.107, -0.008], [0.102, -0.03, 0.004], [0.093, -0.033]], 0.007, steel, { bevel: 0.0015 }));
  g.add(profile([[0.024, -0.006], [0.074, -0.006], [0.066, -0.03], [0.046, -0.112, 0.01], [0.002, -0.117, 0.012], [0.004, -0.09], [0.016, -0.03]], 0.032, poly, { bevel: 0.009, name: 'Pistol grip' }));
  // Selector (left) and push pins
  g.add(at(profile([[0, -0.003], [0.03, -0.001], [0.03, 0.004], [0, 0.003]], 0.003, steel, { bevel: 0.0008 }), [0.03, -0.002, -0.0195], [0, 0, 20]));
  for (const x of [0.026, 0.148]) g.add(at(cylZ(0.003, 0.04, steel), [x, -0.004, 0]));

  // Stock: fixed A2 or collapsing A3
  if (P.stock === 'collapsing') {
    for (const [y, z] of [[0.04, 0], [0.0, 0.014], [0.0, -0.014]]) g.add(at(cylX(0.0045, 0.21, steel, { seg: 12 }), [-0.1, y, z]));
    g.add(profile([[-0.2, 0.052], [-0.214, 0.05, 0.004], [-0.214, -0.074, 0.006], [-0.2, -0.076]], 0.04, steel, { bevel: 0.005, name: 'Butt plate' }));
    g.add(profile([[-0.214, 0.05], [-0.226, 0.048], [-0.226, -0.072], [-0.214, -0.074]], 0.044, mat('rubber', '#141516'), { round: 0.004, bevel: 0.006 }));
  } else {
    g.add(profile([[0.005, 0.052], [-0.232, 0.052], [-0.244, 0.046, 0.008], [-0.244, -0.07, 0.008], [-0.232, -0.076], [-0.12, -0.036], [-0.02, -0.006], [0.005, 0.002]], 0.038, poly, { bevel: 0.009, name: 'Stock' }));
    g.add(profile([[-0.244, 0.05], [-0.258, 0.048], [-0.258, -0.074], [-0.244, -0.076]], 0.042, mat('rubber', '#141516'), { round: 0.004, bevel: 0.008, name: 'Butt pad' }));
    g.add(at(box(0.05, 0.018, 0.04, dark, { r: 0.006 }), [-0.13, 0.02, 0]));
  }
  return g;
}

function katana(P) {
  const blade = mat('chrome', '#dfe3e6', { roughness: 0.12 });
  const tsuka = mat('fabric', P.color || '#1c1d24');
  const gold = mat('brass', '#b8923e');
  const g = group('Katana');
  // Curved blade: outline sampled along a gentle arc (sori), extruded thin
  const L = 0.7, sori = 0.018, pts = [], back = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40, x = t * L, y = sori * Math.sin(t * Math.PI * 0.9);
    const w = 0.031 - 0.006 * t;
    if (t > 0.94) { const k = (t - 0.94) / 0.06; pts.push([x, y + w * (1 - k * 0.6)]); back.push([x - 0.004 * k, y + w * 0.35 * k]); continue; }
    pts.push([x, y + w]); back.push([x, y]);
  }
  const outline = [...back, [L + 0.012, sori * Math.sin(Math.PI * 0.9) + 0.022], ...pts.reverse()];
  g.add(at(extrude(shapeFrom(outline), 0.007, blade, { bevel: 0.0028, bevelSeg: 2, name: 'Blade' }), [0.04, 0, 0]));
  // Habaki, tsuba, tsuka, kashira
  g.add(at(box(0.03, 0.036, 0.013, gold, { r: 0.003 }), [0.03, 0.015, 0]));
  const tsuba = extrude(shapeFrom([[0, 0.043], [0.03, 0.03], [0.036, 0], [0.03, -0.03], [0, -0.043], [-0.03, -0.03], [-0.036, 0], [-0.03, 0.03]], 0.012), 0.008, mat('gunmetal', '#1e1e20'), { bevel: 0.002, name: 'Tsuba' });
  tsuba.rotation.y = Math.PI / 2;
  g.add(at(tsuba, [0.01, 0.016, 0]));
  g.add(at(cylX(0.016, 0.27, tsuka, { seg: 16 }), [-0.13, 0.016, 0], null, [1, 1, 0.75]));
  for (let i = 0; i < 9; i++) g.add(at(box(0.012, 0.034, 0.026, mat('fabric', '#2c2e3a'), { r: 0.005 }), [-0.02 - i * 0.028, 0.016, 0], [0, 0, i % 2 ? 35 : -35]));
  g.add(at(cylX(0.0175, 0.02, gold, { seg: 16 }), [-0.272, 0.016, 0], null, [1, 1, 0.78]));
  g.add(at(cylX(0.0175, 0.012, gold, { seg: 16 }), [0.0, 0.016, 0], null, [1, 1, 0.78]));
  return g;
}

export const WEAPON_MODELS = [
  {
    id: 'ak-47', name: 'AK-47 (AKM)', category: 'Props & replicas',
    aliases: ['ak47', 'ak 47', 'ak-47', 'akm', 'kalashnikov', 'ak rifle', 'avtomat kalashnikova', 'assault rifle'],
    description: 'Display replica of the Kalashnikov AKM at real size: stamped receiver, wood furniture, curved 30-round magazine, slant brake. Visual only, no mechanism.',
    params: {
      furniture: { type: 'select', label: 'Furniture', options: [['wood', 'Wood'], ['plum', 'Plum polymer'], ['black', 'Black polymer'], ['fde', 'Tan polymer']], default: 'wood' },
      magazine: { type: 'select', label: 'Magazine', options: [['steel', 'Steel'], ['bakelite', 'Bakelite'], ['polymer', 'Polymer']], default: 'steel' },
    },
    build: ak47,
  },
  {
    id: 'mp5', name: 'MP5 submachine gun', category: 'Props & replicas',
    aliases: ['mp5', 'mp-5', 'hk mp5', 'h&k mp5', 'heckler koch mp5', 'heckler and koch mp5', 'mp5a2', 'mp5a3', 'smg', 'submachine gun'],
    description: 'Display replica of the Heckler & Koch MP5 at real size: rounded receiver, ring front sight, drum rear sight, slim handguard, curved magazine and fixed or collapsing stock. Visual only.',
    params: {
      stock: { type: 'select', label: 'Stock', options: [['fixed', 'Fixed (A2)'], ['collapsing', 'Collapsing (A3)']], default: 'fixed' },
      furniture: { type: 'select', label: 'Furniture', options: [['black', 'Black'], ['fde', 'Tan']], default: 'black' },
    },
    build: mp5,
  },
  {
    id: 'katana', name: 'Katana', category: 'Props & replicas',
    aliases: ['katana', 'samurai sword', 'japanese sword', 'sword'],
    description: 'Curved Japanese sword with a polished blade, brass habaki, iron tsuba and wrapped handle.',
    params: { color: { type: 'color', label: 'Handle wrap', default: '#1c1d24' } },
    build: katana,
  },
];

