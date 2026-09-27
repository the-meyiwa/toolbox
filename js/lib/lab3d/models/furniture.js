/* ============================================================
   3D Lab — furniture and lighting

   Real-size pieces (metres). Chairs face +z. The office chair is the
   detailed one: five-star base with twin-wheel casters, gas lift,
   tilt mechanism, contoured seat, a woven-mesh back with lumbar
   curve on a moulded frame, T-arms and an optional headrest.
   ============================================================ */

import { ParametricGeometry } from 'three/examples/jsm/geometries/ParametricGeometry.js';
import { group, at, box, cyl, cylZ, sphere, torus, lathe, tube, profile, extrude, shapeFrom, arcBand, mesh, sample, DEG } from '../kit.js';
import { mat } from '../materials.js';

const FRAME = { black: '#1c1d1f', white: '#e9e9e6', grey: '#8a8d91' };

/* ---------------- shared pieces ---------------- */

function caster(baseMat) {
  const c = group('Caster');
  c.add(at(cyl(0.0075, 0.0075, 0.03, mat('chrome'), { seg: 12 }), [0, 0.075, 0]));
  c.add(at(extrude(shapeFrom(arcBand([0, 0], 0.029, 0.035, 0, Math.PI, 14)), 0.05, baseMat, { bevel: 0.002 }), [0.012, 0.031, 0]));
  c.add(at(box(0.03, 0.01, 0.02, baseMat, { r: 0.003 }), [0.004, 0.063, 0]));
  for (const z of [-0.0125, 0.0125]) c.add(at(cylZ(0.03, 0.017, mat('rubber', '#1a1b1d'), { seg: 28 }), [0.012, 0.03, z]));
  c.add(at(cylZ(0.011, 0.052, mat('chrome'), { seg: 16 }), [0.012, 0.03, 0]));
  return c;
}

function fiveStarBase(baseMat, { reach = 0.3 } = {}) {
  const g = group('Five-star base');
  for (let i = 0; i < 5; i++) {
    const arm = group('Leg');
    arm.add(profile([[0.03, 0.085], [reach, 0.064], [reach + 0.018, 0.07, 0.012], [reach + 0.018, 0.094, 0.01], [0.03, 0.138]], 0.048, baseMat, { bevel: 0.009, name: 'Leg' }));
    arm.add(at(caster(baseMat), [reach + 0.005, 0, 0]));
    arm.rotation.y = i * 72 * DEG + 18 * DEG;
    g.add(arm);
  }
  g.add(at(cyl(0.05, 0.058, 0.06, baseMat, { seg: 32 }), [0, 0.11, 0]));
  return g;
}

/** Outline half-width of a chair back at height y, with rounded top and bottom. */
function backHalfWidth(y, H, w0, w1, topR = 0.08, botR = 0.04) {
  let hw = w0 + (w1 - w0) * Math.sin(Math.PI * Math.min(1, (y / H) * 1.15) * 0.5);
  if (y > H - topR) hw *= Math.sqrt(Math.max(0, 1 - ((y - (H - topR)) / topR) ** 2));
  if (y < botR) hw *= Math.sqrt(Math.max(0, 1 - ((botR - y) / botR) ** 2));
  return hw;
}

/** A curved mesh panel in a moulded frame. Local origin at the bottom centre. */
function meshPanel({ H, w0, w1, wrap = 0.9, lumbar = 0.022, lumbarY = 0.16, topR = 0.08, botR = 0.04, frameMat, meshMat, frameR = 0.013 }) {
  const z = (x, y) => wrap * x * x + lumbar * Math.exp(-(((y - lumbarY) / 0.1) ** 2));
  const g = group('Back');
  const side = sample(48, t => { const y = t * H; const hw = backHalfWidth(y, H, w0, w1, topR, botR); return [hw, y, z(hw, y)]; });
  const loop = [...side, ...side.slice(1, -1).reverse().map(([x, y, zz]) => [-x, y, zz])];
  g.add(tube(loop, frameR, frameMat, { closed: true, segments: 220, radial: 12 }));
  const geo = new ParametricGeometry((u, v, t) => {
    const y = 0.004 + v * (H - 0.008);
    const hw = backHalfWidth(y, H, w0, w1, topR, botR) * 0.985;
    const x = (u * 2 - 1) * hw;
    t.set(x, y, z(x, y) - 0.002);
  }, 48, 64);
  g.add(mesh(geo, meshMat, 'Mesh'));
  return g;
}

/* ---------------- office chair ---------------- */

function officeChair(P) {
  const frame = mat('matte-plastic', FRAME[P.frame] || FRAME.black);
  const baseMat = P.base === 'aluminium' ? mat('aluminium', '#cfd3d6', { roughness: 0.22 }) : mat('polymer', '#1b1c1e');
  const cushion = mat('fabric', P.color || '#26282b');
  const meshMat = mat('mesh', P.color || '#26282b');
  const g = group('Office chair');

  g.add(fiveStarBase(baseMat));
  // Gas lift: cover, telescoping sleeve, chrome piston
  g.add(at(cyl(0.03, 0.032, 0.12, mat('polymer', '#17181a'), { seg: 28 }), [0, 0.2, 0]));
  g.add(at(cyl(0.026, 0.026, 0.07, mat('polymer', '#17181a'), { seg: 28 }), [0, 0.29, 0]));
  g.add(at(cyl(0.014, 0.014, 0.1, mat('chrome'), { seg: 20 }), [0, 0.36, 0]));
  // Tilt mechanism, tension knob and height lever
  g.add(at(box(0.22, 0.045, 0.2, frame, { r: 0.01 }), [0, 0.415, -0.01]));
  g.add(at(cyl(0.028, 0.028, 0.03, frame, { seg: 24 }), [0, 0.385, 0.09]));
  g.add(at(box(0.11, 0.008, 0.018, frame, { r: 0.004 }), [0.16, 0.41, 0.05], [0, -8, -6]));
  g.add(at(sphere(0.011, frame, { w: 16, h: 12 }), [0.215, 0.405, 0.058]));

  // Seat: moulded pan and a contoured cushion with a waterfall front edge
  g.add(at(box(0.49, 0.02, 0.46, frame, { r: 0.008 }), [0, 0.447, 0]));
  const seat = profile([[-0.225, 0.455], [0.19, 0.455], [0.245, 0.47, 0.02], [0.243, 0.508, 0.025], [0.19, 0.522], [-0.05, 0.512], [-0.2, 0.53], [-0.232, 0.515, 0.02]], 0.495, cushion, { bevel: 0.022, bevelSeg: 5, curveSeg: 12, name: 'Seat cushion' });
  seat.rotation.y = -Math.PI / 2;
  g.add(seat);

  // Back support spine
  const spine = tube([[0, 0.415, -0.1], [0, 0.425, -0.2], [0, 0.46, -0.262], [0, 0.6, -0.272], [0, 0.68, -0.262]], 0.02, frame, { segments: 48 });
  spine.scale.x = 1.9;
  g.add(spine);

  // Mesh back, tilted back 12°, with lumbar curve
  const back = meshPanel({ H: 0.58, w0: 0.19, w1: 0.235, frameMat: frame, meshMat });
  back.position.set(0, 0.56, -0.25);
  back.rotation.x = -12 * DEG;
  if (P.headrest !== false) {
    const post = tube([[0, 0.5, 0.012], [0, 0.6, 0.004], [0, 0.66, 0.006]], 0.012, frame, { segments: 16 });
    post.scale.x = 2.2;
    back.add(post);
    const head = meshPanel({ H: 0.15, w0: 0.14, w1: 0.15, wrap: 1.2, lumbar: 0, topR: 0.06, botR: 0.05, frameMat: frame, meshMat, frameR: 0.011 });
    head.position.set(0, 0.64, 0.012);
    head.rotation.x = 6 * DEG;
    back.add(head);
  }
  g.add(back);

  // T-arms
  if (P.arms !== false) {
    for (const s of [-1, 1]) {
      const arm = tube([[s * 0.2, 0.43, -0.03], [s * 0.255, 0.44, -0.032], [s * 0.268, 0.5, -0.036], [s * 0.268, 0.648, -0.04]], 0.016, frame, { segments: 40 });
      arm.scale.z = 1.6;
      g.add(arm);
      g.add(at(box(0.08, 0.028, 0.25, mat('rubber', '#232427'), { r: 0.012 }), [s * 0.268, 0.662, -0.02]));
    }
  }
  return g;
}

/* ---------------- gaming chair ---------------- */

function gamingChair(P) {
  const main = mat('leather', P.color || '#1d1e22');
  const accent = mat('leather', P.accent || '#c1272d');
  const baseMat = mat('aluminium', '#2a2b2e', { roughness: 0.35 });
  const frame = mat('matte-plastic', '#17181a');
  const g = group('Gaming chair');
  g.add(fiveStarBase(baseMat, { reach: 0.32 }));
  g.add(at(cyl(0.03, 0.032, 0.2, frame, { seg: 28 }), [0, 0.25, 0]));
  g.add(at(box(0.24, 0.05, 0.22, frame, { r: 0.01 }), [0, 0.39, 0]));
  // Bucket seat with bolsters
  g.add(at(box(0.52, 0.09, 0.52, main, { r: 0.035, seg: 5 }), [0, 0.46, 0]));
  for (const s of [-1, 1]) g.add(at(box(0.08, 0.13, 0.5, accent, { r: 0.035, seg: 5 }), [s * 0.23, 0.49, 0], [0, 0, s * -8]));
  // Tall back with shoulder wings and stitched accent panels
  const outline = [[-0.26, 0], [0.26, 0], [0.27, 0.35], [0.24, 0.52], [0.29, 0.6], [0.24, 0.78, 0.04], [0.14, 0.86, 0.05], [-0.14, 0.86, 0.05], [-0.24, 0.78, 0.04], [-0.29, 0.6], [-0.24, 0.52], [-0.27, 0.35]];
  const backG = group('Back');
  backG.add(profile(outline, 0.1, main, { round: 0.03, bevel: 0.035, bevelSeg: 5, curveSeg: 10 }));
  for (const s of [-1, 1]) backG.add(at(profile([[0, 0.05], [0.05, 0.05], [0.07, 0.5], [0.04, 0.72], [0, 0.72]], 0.02, accent, { round: 0.015, bevel: 0.006 }), [s * 0.14, 0, 0.05], [0, s < 0 ? 180 : 0, 0]));
  backG.add(at(box(0.3, 0.12, 0.08, accent, { r: 0.04, seg: 5 }), [0, 0.2, 0.08]));
  backG.add(at(box(0.24, 0.1, 0.07, accent, { r: 0.035, seg: 5 }), [0, 0.72, 0.075]));
  backG.position.set(0, 0.48, -0.24);
  backG.rotation.x = -10 * DEG;
  g.add(backG);
  for (const s of [-1, 1]) {
    g.add(at(box(0.04, 0.2, 0.06, frame, { r: 0.012 }), [s * 0.3, 0.57, -0.03]));
    g.add(at(box(0.09, 0.03, 0.26, mat('rubber', '#202124'), { r: 0.012 }), [s * 0.3, 0.68, -0.02]));
  }
  return g;
}

/* ---------------- dining chair and stool ---------------- */

function diningChair(P) {
  const wood = mat(P.wood || 'oak');
  const seatM = P.upholstered ? mat('fabric', P.color || '#8a7f6e') : wood;
  const g = group('Dining chair');
  const W = 0.44, D = 0.46, SH = 0.45;
  for (const [x, z, back] of [[-1, 1, 0], [1, 1, 0], [-1, -1, 1], [1, -1, 1]]) {
    const hgt = back ? 0.9 : SH;
    g.add(at(box(0.036, hgt, 0.036, wood, { r: 0.006 }), [x * (W / 2 - 0.02), hgt / 2, z * (D / 2 - 0.02)], back ? [-4, 0, 0] : null));
  }
  for (const z of [1, -1]) g.add(at(box(W - 0.05, 0.05, 0.022, wood, { r: 0.004 }), [0, SH - 0.05, z * (D / 2 - 0.02)]));
  for (const x of [1, -1]) g.add(at(box(0.022, 0.05, D - 0.05, wood, { r: 0.004 }), [x * (W / 2 - 0.02), SH - 0.05, 0]));
  g.add(at(box(W, 0.035, D, seatM, { r: 0.01 }), [0, SH, 0]));
  for (const y of [0.6, 0.72, 0.84]) g.add(at(box(W - 0.04, 0.05, 0.02, wood, { r: 0.006 }), [0, y, -D / 2 + 0.005], [-4, 0, 0]));
  return g;
}

function barStool(P) {
  const seatM = mat('leather', P.color || '#3b2a20');
  const metal = mat(P.metal === 'black' ? 'gunmetal' : 'brushed-steel');
  const g = group('Bar stool');
  g.add(at(cyl(0.2, 0.19, 0.06, seatM, { seg: 48 }), [0, 0.75, 0]));
  g.add(at(torus(0.19, 0.03, seatM, { radial: 16, tubular: 64 }), [0, 0.765, 0], [90, 0, 0]));
  g.add(at(cyl(0.035, 0.035, 0.7, metal, { seg: 24 }), [0, 0.37, 0]));
  g.add(at(torus(0.17, 0.011, metal, { radial: 12, tubular: 64 }), [0, 0.28, 0], [90, 0, 0]));
  for (let i = 0; i < 4; i++) g.add(at(box(0.012, 0.012, 0.17, metal), [0, 0.28, 0], [0, i * 90, 0]).translateZ(0.085));
  g.add(at(cyl(0.2, 0.22, 0.02, metal, { seg: 48 }), [0, 0.01, 0]));
  return g;
}

/* ---------------- tables and desks ---------------- */

function desk(P) {
  const top = mat(P.top || 'walnut');
  const metal = mat('gunmetal', P.frame || '#1f2023', { roughness: 0.5 });
  const W = Number(P.width) || 1.4, D = 0.7, H = 0.74;
  const g = group('Desk');
  g.add(at(box(W, 0.028, D, top, { r: 0.004 }), [0, H - 0.014, 0]));
  for (const s of [-1, 1]) {
    const leg = profile([[-0.3, 0], [0.3, 0], [0.3, 0.04], [0.04, 0.04], [0.035, H - 0.06], [0.3, H - 0.06], [0.3, H - 0.028], [-0.3, H - 0.028], [-0.3, H - 0.06], [-0.035, H - 0.06], [-0.04, 0.04], [-0.3, 0.04]], 0.05, metal, { round: 0.008, bevel: 0.004 });
    leg.rotation.y = Math.PI / 2;
    g.add(at(leg, [s * (W / 2 - 0.08), 0, 0]));
  }
  g.add(at(box(W - 0.2, 0.06, 0.02, metal, { r: 0.004 }), [0, H - 0.07, -D / 2 + 0.08]));
  if (P.drawer) {
    g.add(at(box(0.4, 0.09, D - 0.1, top, { r: 0.004 }), [W / 2 - 0.34, H - 0.075, 0]));
    g.add(at(box(0.12, 0.012, 0.012, mat('brushed-steel')), [W / 2 - 0.34, H - 0.075, D / 2 - 0.04]));
  }
  return g;
}

function diningTable(P) {
  const top = mat(P.top || 'oak');
  const L = Number(P.length) || 1.8, W = 0.9, H = 0.75;
  const g = group('Dining table');
  g.add(at(box(L, 0.04, W, top, { r: 0.008 }), [0, H - 0.02, 0]));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(box(0.07, H - 0.04, 0.07, top, { r: 0.006 }), [sx * (L / 2 - 0.1), (H - 0.04) / 2, sz * (W / 2 - 0.1)]));
  for (const sz of [-1, 1]) g.add(at(box(L - 0.25, 0.08, 0.025, top, { r: 0.004 }), [0, H - 0.08, sz * (W / 2 - 0.1)]));
  for (const sx of [-1, 1]) g.add(at(box(0.025, 0.08, W - 0.25, top, { r: 0.004 }), [sx * (L / 2 - 0.1), H - 0.08, 0]));
  return g;
}

function coffeeTable(P) {
  const topM = mat(P.top || 'marble');
  const legM = mat(P.legs === 'black' ? 'gunmetal' : 'brass');
  const g = group('Coffee table');
  g.add(at(cyl(0.45, 0.45, 0.03, topM, { seg: 64 }), [0, 0.43, 0]));
  for (let i = 0; i < 3; i++) {
    const a = i * 120 * DEG;
    const leg = tube([[Math.cos(a) * 0.36, 0.415, Math.sin(a) * 0.36], [Math.cos(a) * 0.3, 0.2, Math.sin(a) * 0.3], [Math.cos(a) * 0.26, 0.0, Math.sin(a) * 0.26]], 0.014, legM, { segments: 16 });
    g.add(leg);
  }
  g.add(at(torus(0.3, 0.008, legM, { radial: 8, tubular: 64 }), [0, 0.2, 0], [90, 0, 0]));
  return g;
}

/* ---------------- soft furniture ---------------- */

function sofa(P, seats = Number(P.seats) || 3) {
  const fab = mat(P.material === 'velvet' ? 'velvet' : P.material === 'leather' ? 'leather' : 'fabric', P.color || '#6f7a86');
  const legM = mat(P.legs === 'metal' ? 'gunmetal' : 'walnut');
  const seatW = 0.64, armW = 0.2, D = 0.9;
  const W = seats * seatW + armW * 2;
  const g = group(seats === 1 ? 'Armchair' : 'Sofa');
  g.add(at(box(W - 0.04, 0.2, D - 0.04, fab, { r: 0.04, seg: 5 }), [0, 0.2, 0]));
  for (let i = 0; i < seats; i++) {
    const x = -((seats - 1) * seatW) / 2 + i * seatW;
    g.add(at(box(seatW - 0.012, 0.14, D - 0.26, fab, { r: 0.05, seg: 6 }), [x, 0.36, 0.08]));
    g.add(at(box(seatW - 0.02, 0.46, 0.2, fab, { r: 0.07, seg: 6 }), [x, 0.6, -D / 2 + 0.18], [-10, 0, 0]));
  }
  g.add(at(box(W - 0.04, 0.5, 0.16, fab, { r: 0.05, seg: 5 }), [0, 0.52, -D / 2 + 0.08]));
  for (const s of [-1, 1]) g.add(at(box(armW, 0.36, D - 0.02, fab, { r: 0.07, seg: 6 }), [s * (W / 2 - armW / 2), 0.43, 0]));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(cyl(0.022, 0.016, 0.1, legM, { seg: 16 }), [sx * (W / 2 - 0.08), 0.05, sz * (D / 2 - 0.08)]));
  if (P.pillows !== false && seats > 1) for (const s of [-1, 1]) g.add(at(box(0.42, 0.42, 0.12, mat('velvet', P.accent || '#c9a24a'), { r: 0.06, seg: 6 }), [s * (W / 2 - armW - 0.26), 0.58, -D / 2 + 0.34], [-12, s * 12, s * 4]));
  return g;
}

function bed(P) {
  const frameM = mat(P.frame || 'walnut');
  const sheet = mat('fabric', P.color || '#e7e3da');
  const duvet = mat('fabric', P.duvet || '#8497a8');
  const W = Number(P.width) || 1.6, L = 2.1;
  const g = group('Bed');
  g.add(at(box(W + 0.08, 0.28, L + 0.06, frameM, { r: 0.012 }), [0, 0.2, 0]));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(box(0.06, 0.08, 0.06, frameM), [sx * (W / 2 - 0.02), 0.04, sz * (L / 2 - 0.02)]));
  g.add(at(box(W + 0.1, 0.9, 0.08, mat('velvet', P.headboard || '#4a4f5a'), { r: 0.03, seg: 5 }), [0, 0.65, -L / 2 - 0.02]));
  g.add(at(box(W, 0.24, L - 0.04, sheet, { r: 0.06, seg: 5 }), [0, 0.46, 0.01]));
  g.add(at(box(W + 0.06, 0.08, L * 0.62, duvet, { r: 0.035, seg: 5 }), [0, 0.6, L * 0.18]));
  for (const s of [-1, 1]) g.add(at(box(W / 2 - 0.1, 0.14, 0.4, sheet, { r: 0.06, seg: 6 }), [s * (W / 4), 0.62, -L / 2 + 0.3], [-14, 0, 0]));
  return g;
}

/* ---------------- storage ---------------- */

function bookshelf(P) {
  const wood = mat(P.wood || 'oak');
  const W = 0.9, H = 1.8, D = 0.32, T = 0.022, shelves = 5;
  const g = group('Bookshelf');
  for (const s of [-1, 1]) g.add(at(box(T, H, D, wood), [s * (W / 2 - T / 2), H / 2, 0]));
  g.add(at(box(W, H, 0.008, wood), [0, H / 2, -D / 2 + 0.004]));
  const rng = (() => { let x = 42; return () => ((x = (x * 16807) % 2147483647) / 2147483647); })();
  const colors = ['#8b2e2e', '#2e4a6b', '#3f6b4a', '#c9a24a', '#e8e3d8', '#5a4a6b', '#1f2023', '#b76e3c', '#6b8fa6'];
  for (let i = 0; i <= shelves; i++) {
    const y = T / 2 + i * ((H - T) / shelves);
    g.add(at(box(W - 2 * T, T, D - 0.01, wood), [0, y, 0.005]));
    if (i === shelves || P.books === false) continue;
    let x = -W / 2 + T + 0.01;
    while (x < W / 2 - T - 0.06) {
      const bw = 0.018 + rng() * 0.03, bh = 0.18 + rng() * 0.12, bd = 0.17 + rng() * 0.07;
      if (rng() < 0.08) { x += 0.05; continue; }
      g.add(at(box(bw, bh, bd, mat('paper', colors[Math.floor(rng() * colors.length)]), { r: 0.002 }), [x + bw / 2, y + T / 2 + bh / 2, -D / 2 + 0.02 + bd / 2]));
      x += bw + 0.002;
    }
  }
  return g;
}

/* ---------------- lamps and plants ---------------- */

function deskLamp(P) {
  const body = mat(P.finish === 'brass' ? 'brass' : 'matte-plastic', P.color || '#e9e9e6');
  const g = group('Desk lamp');
  g.add(at(cyl(0.08, 0.085, 0.022, body, { seg: 40 }), [0, 0.011, 0]));
  const j1 = [0, 0.03, 0], j2 = [0.02, 0.33, -0.08], j3 = [0.24, 0.42, -0.05];
  g.add(tube([j1, [0.01, 0.18, -0.04], j2], 0.009, body, { segments: 16 }));
  g.add(tube([j2, [0.13, 0.4, -0.065], j3], 0.009, body, { segments: 16 }));
  for (const j of [j2, j3]) g.add(at(sphere(0.016, body, { w: 16, h: 12 }), j));
  const head = group('Shade', lathe([[0.012, 0.06], [0.03, 0.055], [0.06, 0.0], [0.058, -0.004], [0.028, 0.05], [0.0, 0.054]], body, { seg: 40 }));
  head.add(at(sphere(0.024, mat('light', '#fff3d4'), { w: 20, h: 12 }), [0, 0.012, 0]));
  g.add(at(head, [0.27, 0.36, -0.04], [0, 0, -30]));
  return g;
}

function floorLamp(P) {
  const metal = mat(P.finish === 'black' ? 'gunmetal' : 'brass');
  const g = group('Floor lamp');
  g.add(at(cyl(0.16, 0.17, 0.03, mat('marble', '#f0eee9'), { seg: 48 }), [0, 0.015, 0]));
  const arc = sample(24, t => [Math.sin(t * Math.PI * 0.62) * 1.1, 0.03 + Math.sin(Math.min(1, t * 1.25) * Math.PI / 2) * 1.85, 0]);
  g.add(tube(arc, 0.012, metal, { segments: 96 }));
  const tip = arc[arc.length - 1];
  const shade = group('Shade', lathe([[0.02, 0.12], [0.06, 0.12], [0.22, 0.0], [0.215, -0.005], [0.058, 0.113], [0, 0.114]], mat('matte-plastic', P.shade || '#1f2023'), { seg: 48 }));
  shade.add(at(sphere(0.04, mat('light', '#fff1cf'), { w: 20, h: 12 }), [0, 0.04, 0]));
  g.add(at(shade, [tip[0], tip[1] - 0.14, 0]));
  return g;
}

function pottedPlant(P) {
  const pot = mat('ceramic', P.pot || '#e9e5dc');
  const leaf = mat('foliage', P.color || '#2f6b35');
  const g = group('Potted plant');
  g.add(lathe([[0, 0], [0.12, 0], [0.15, 0.02], [0.17, 0.3], [0.165, 0.305], [0.15, 0.3], [0.13, 0.03], [0, 0.03]], pot, { seg: 48 }));
  g.add(at(cyl(0.155, 0.155, 0.01, mat('stone', '#4a3a2a'), { seg: 32 }), [0, 0.28, 0]));
  const rng = (() => { let x = 7; return () => ((x = (x * 16807) % 2147483647) / 2147483647); })();
  for (let i = 0; i < 14; i++) {
    const a = i * 137.5 * DEG, tilt = 25 + rng() * 45, len = 0.35 + rng() * 0.45;
    const stem = [[0, 0.28, 0], [Math.cos(a) * len * 0.25, 0.28 + len * 0.6, Math.sin(a) * len * 0.25], [Math.cos(a) * len * 0.55, 0.28 + len * Math.cos(tilt * DEG), Math.sin(a) * len * 0.55]];
    g.add(tube(stem, 0.005, mat('foliage', '#3c7a3a'), { segments: 12, radial: 6 }));
    const blade = extrude(shapeFrom(sample(16, t => [Math.sin(t * Math.PI) * 0.09 * (1 - t * 0.3), t * 0.26]).concat(sample(16, t => [-Math.sin((1 - t) * Math.PI) * 0.09 * (1 - (1 - t) * 0.3), (1 - t) * 0.26]))), 0.004, leaf, { bevel: 0 });
    const e = stem[2];
    blade.position.set(e[0], e[1], e[2]);
    blade.rotation.set(-(90 - tilt) * DEG * 0.7, -a + Math.PI / 2, 0, 'YXZ');
    g.add(blade);
  }
  return g;
}

/* ---------------- catalogue ---------------- */

export const FURNITURE_MODELS = [
  {
    id: 'office-chair', name: 'Office chair', category: 'Furniture',
    aliases: ['office chair', 'desk chair', 'task chair', 'ergonomic chair', 'mesh chair', 'computer chair', 'swivel chair', 'herman miller', 'executive chair'],
    description: 'Ergonomic mesh task chair: five-star base with twin-wheel casters, gas lift, contoured seat, lumbar-curved mesh back, T-arms and a headrest.',
    params: {
      color: { type: 'color', label: 'Mesh and seat', default: '#26282b', swatches: [['#26282b', 'Graphite'], ['#3f4a5c', 'Navy'], ['#7d8288', 'Grey'], ['#8a3b33', 'Rust'], ['#4b5f4c', 'Sage']] },
      frame: { type: 'select', label: 'Frame', options: [['black', 'Black'], ['white', 'White'], ['grey', 'Grey']], default: 'black' },
      base: { type: 'select', label: 'Base', options: [['nylon', 'Black nylon'], ['aluminium', 'Polished aluminium']], default: 'nylon' },
      headrest: { type: 'toggle', label: 'Headrest', default: true },
      arms: { type: 'toggle', label: 'Armrests', default: true },
    },
    build: officeChair,
  },
  { id: 'gaming-chair', name: 'Gaming chair', category: 'Furniture', aliases: ['gaming chair', 'racing chair', 'secretlab', 'bucket seat chair'], description: 'Racing-style gaming chair with a bucket seat, winged back and pillows.', params: { color: { type: 'color', label: 'Main', default: '#1d1e22' }, accent: { type: 'color', label: 'Accent', default: '#c1272d' } }, build: gamingChair },
  { id: 'dining-chair', name: 'Dining chair', category: 'Furniture', aliases: ['chair', 'dining chair', 'wooden chair', 'kitchen chair'], description: 'Solid-wood dining chair with a slatted back.', params: { wood: { type: 'select', label: 'Wood', options: [['oak', 'Oak'], ['walnut', 'Walnut'], ['wood', 'Teak']], default: 'oak' }, upholstered: { type: 'toggle', label: 'Upholstered seat', default: false }, color: { type: 'color', label: 'Seat fabric', default: '#8a7f6e' } }, build: diningChair },
  { id: 'bar-stool', name: 'Bar stool', category: 'Furniture', aliases: ['stool', 'bar stool', 'counter stool', 'kitchen stool'], description: 'Upholstered bar stool on a steel column with a foot ring.', params: { color: { type: 'color', label: 'Seat', default: '#3b2a20' }, metal: { type: 'select', label: 'Metal', options: [['steel', 'Brushed steel'], ['black', 'Black']], default: 'steel' } }, build: barStool },
  { id: 'desk', name: 'Desk', category: 'Furniture', aliases: ['desk', 'office desk', 'computer desk', 'work desk', 'writing desk', 'study desk'], description: 'Work desk with a timber top on a steel frame.', params: { width: { type: 'range', label: 'Width', min: 1, max: 2.2, step: 0.05, default: 1.4, unit: 'm' }, top: { type: 'select', label: 'Top', options: [['walnut', 'Walnut'], ['oak', 'Oak'], ['plastic', 'White']], default: 'walnut' }, drawer: { type: 'toggle', label: 'Drawer', default: true } }, build: desk },
  { id: 'dining-table', name: 'Dining table', category: 'Furniture', aliases: ['table', 'dining table', 'kitchen table', 'wooden table'], description: 'Six-seat solid-wood dining table.', params: { length: { type: 'range', label: 'Length', min: 1.2, max: 3, step: 0.1, default: 1.8, unit: 'm' }, top: { type: 'select', label: 'Wood', options: [['oak', 'Oak'], ['walnut', 'Walnut']], default: 'oak' } }, build: diningTable },
  { id: 'coffee-table', name: 'Coffee table', category: 'Furniture', aliases: ['coffee table', 'side table', 'round table', 'marble table'], description: 'Round marble coffee table on brass legs.', params: { top: { type: 'select', label: 'Top', options: [['marble', 'Marble'], ['walnut', 'Walnut'], ['tinted-glass', 'Glass']], default: 'marble' }, legs: { type: 'select', label: 'Legs', options: [['brass', 'Brass'], ['black', 'Black']], default: 'brass' } }, build: coffeeTable },
  { id: 'sofa', name: 'Sofa', category: 'Furniture', aliases: ['sofa', 'couch', 'settee', 'loveseat', 'three seater'], description: 'Upholstered sofa with deep seats, back cushions and throw pillows.', params: { seats: { type: 'range', label: 'Seats', min: 2, max: 4, step: 1, default: 3 }, material: { type: 'select', label: 'Cover', options: [['fabric', 'Fabric'], ['velvet', 'Velvet'], ['leather', 'Leather']], default: 'fabric' }, color: { type: 'color', label: 'Colour', default: '#6f7a86' } }, build: (P) => sofa(P) },
  { id: 'armchair', name: 'Armchair', category: 'Furniture', aliases: ['armchair', 'lounge chair', 'accent chair', 'club chair'], description: 'Single-seat upholstered armchair.', params: { material: { type: 'select', label: 'Cover', options: [['velvet', 'Velvet'], ['fabric', 'Fabric'], ['leather', 'Leather']], default: 'velvet' }, color: { type: 'color', label: 'Colour', default: '#3d4f6d' } }, build: (P) => sofa(P, 1) },
  { id: 'bed', name: 'Bed', category: 'Furniture', aliases: ['bed', 'double bed', 'queen bed', 'king bed'], description: 'Double bed with an upholstered headboard, mattress, duvet and pillows.', params: { width: { type: 'range', label: 'Width', min: 0.9, max: 2, step: 0.1, default: 1.6, unit: 'm' }, duvet: { type: 'color', label: 'Duvet', default: '#8497a8' } }, build: bed },
  { id: 'bookshelf', name: 'Bookshelf', category: 'Furniture', aliases: ['bookshelf', 'bookcase', 'shelf', 'shelves', 'shelving unit'], description: 'Five-shelf bookcase filled with books.', params: { wood: { type: 'select', label: 'Wood', options: [['oak', 'Oak'], ['walnut', 'Walnut'], ['plastic', 'White']], default: 'oak' }, books: { type: 'toggle', label: 'Books', default: true } }, build: bookshelf },
  { id: 'desk-lamp', name: 'Desk lamp', category: 'Furniture', aliases: ['desk lamp', 'table lamp', 'reading lamp', 'anglepoise', 'lamp'], description: 'Articulated desk lamp with a lit bulb.', params: { color: { type: 'color', label: 'Colour', default: '#e9e9e6' } }, build: deskLamp },
  { id: 'floor-lamp', name: 'Arc floor lamp', category: 'Furniture', aliases: ['floor lamp', 'arc lamp', 'standing lamp'], description: 'Arched floor lamp on a marble base.', params: { finish: { type: 'select', label: 'Finish', options: [['brass', 'Brass'], ['black', 'Black']], default: 'brass' } }, build: floorLamp },
  { id: 'potted-plant', name: 'Potted plant', category: 'Furniture', aliases: ['plant', 'potted plant', 'house plant', 'houseplant', 'plant pot'], description: 'Leafy house plant in a ceramic pot.', params: { color: { type: 'color', label: 'Leaves', default: '#2f6b35' }, pot: { type: 'color', label: 'Pot', default: '#e9e5dc' } }, build: pottedPlant },
];

