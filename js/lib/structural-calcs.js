/* ============================================================
   TOOLBOX — Structural and building calculations

   One set of formulas shared by the Assistant's architecture
   advisor and Math Utility's Structures commands. Pure functions,
   SI units in and out (m, kN, kN/m, kNm, MPa, mm where noted), each
   returning the working as short steps so answers can show it.

   Sources: standard beam formulas (Roark / steel designers' manuals),
   EN 1993-1-1 flexural buckling (curves a–d), EN 1991-1-4 style
   velocity pressure q = 0.613 V², BS 8110 simplified RC beam design,
   ISO 6946 U-values, BS EN 12056-3 style gutter flow, BS 9999 / NBC
   style escape widths, BS 6297 septic tank capacity. Preliminary
   sizing only: an engineer and the local code decide.
   ============================================================ */

const r = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const num = (v, d = 0) => { const n = typeof v === 'string' ? parseFloat(v) : v; return Number.isFinite(n) ? n : d; };
const step = (text) => ({ text });

/* ---------------- materials ---------------- */

export const MATERIALS = {
  steel: { E: 210000, fy: 275, density: 78.5, name: 'Steel S275' },
  s355: { E: 210000, fy: 355, density: 78.5, name: 'Steel S355' },
  aluminium: { E: 70000, fy: 160, density: 27, name: 'Aluminium 6063-T6' },
  timber: { E: 11000, fy: 24, density: 5, name: 'Timber C24 (bending strength)' },
  hardwood: { E: 14000, fy: 40, density: 8, name: 'Tropical hardwood (Iroko class)' },
  concrete: { E: 30000, fy: 25, density: 24, name: 'Concrete C25/30' },
};
const mat = (m) => MATERIALS[String(m || 'steel').toLowerCase()] || MATERIALS.steel;

/* ---------------- sections ---------------- */

// Hot-rolled sections (typical published values): A cm², Iy cm⁴, Wy cm³ (elastic), iz cm (minor radius).
export const HOT_ROLLED = {
  'UB 203x133x25': { A: 32.0, Iy: 2340, Wy: 232, iz: 3.10, iy: 8.56, kgm: 25.1 },
  'UB 254x146x31': { A: 39.7, Iy: 4410, Wy: 351, iz: 3.35, iy: 10.5, kgm: 31.1 },
  'UB 305x165x40': { A: 51.3, Iy: 8500, Wy: 560, iz: 3.86, iy: 12.9, kgm: 40.3 },
  'UB 356x171x51': { A: 64.9, Iy: 14100, Wy: 796, iz: 3.86, iy: 14.8, kgm: 51.0 },
  'UB 406x178x60': { A: 76.5, Iy: 21600, Wy: 1060, iz: 3.97, iy: 16.8, kgm: 60.1 },
  'UB 457x191x67': { A: 85.5, Iy: 29400, Wy: 1300, iz: 4.12, iy: 18.5, kgm: 67.1 },
  'UB 533x210x82': { A: 105, Iy: 47500, Wy: 1800, iz: 4.38, iy: 21.3, kgm: 82.2 },
  'UC 152x152x23': { A: 29.2, Iy: 1250, Wy: 164, iz: 3.70, iy: 6.54, kgm: 23.0 },
  'UC 203x203x46': { A: 58.7, Iy: 4570, Wy: 450, iz: 5.13, iy: 8.82, kgm: 46.1 },
  'UC 254x254x73': { A: 93.1, Iy: 11400, Wy: 898, iz: 6.48, iy: 11.1, kgm: 73.1 },
  'UC 305x305x97': { A: 123, Iy: 22200, Wy: 1440, iz: 7.69, iy: 13.4, kgm: 96.9 },
};

/**
 * Section properties in SI (A m², I m⁴, W m³, rMin m) from a description:
 * "UB 305x165x40", "RHS 150x100x5", "SHS 100x5", "CHS 114.3x5", "rect 200x450" (mm),
 * "circle 300", "timber 50x150", or { b, h } / { d } in mm.
 */
export function sectionProperties(desc) {
  const s = typeof desc === 'string' ? desc.trim() : '';
  const nums = (s.match(/\d+(\.\d+)?/g) || []).map(Number);
  const key = Object.keys(HOT_ROLLED).find(k => k.replace(/\s+/g, '').toLowerCase() === s.replace(/[\s×]+/g, '').replace(/×/g, 'x').toLowerCase());
  if (key) {
    const t = HOT_ROLLED[key];
    return { name: key, A: t.A * 1e-4, I: t.Iy * 1e-8, W: t.Wy * 1e-6, rMin: t.iz * 1e-2, kgm: t.kgm, shape: 'I' };
  }
  const mm = (v) => v / 1000;
  if (/^(rhs|shs)/i.test(s)) {
    let [h, b, t] = nums;
    if (/^shs/i.test(s) && nums.length === 2) { t = b; b = h; }
    b = b || h; t = t || h / 25;
    const H = mm(h), B = mm(b), T = mm(t);
    const I = (B * H ** 3 - (B - 2 * T) * (H - 2 * T) ** 3) / 12;
    const Iz = (H * B ** 3 - (H - 2 * T) * (B - 2 * T) ** 3) / 12;
    const A = B * H - (B - 2 * T) * (H - 2 * T);
    return { name: s.toUpperCase(), A, I, W: I / (H / 2), rMin: Math.sqrt(Math.min(I, Iz) / A), kgm: A * 7850, shape: 'rect' };
  }
  if (/^(chs|pipe)/i.test(s)) {
    const [d, t = d / 25] = nums;
    const D = mm(d), T = mm(t), di = D - 2 * T;
    const I = Math.PI * (D ** 4 - di ** 4) / 64, A = Math.PI * (D ** 2 - di ** 2) / 4;
    return { name: s.toUpperCase(), A, I, W: I / (D / 2), rMin: Math.sqrt(I / A), kgm: A * 7850, shape: 'round' };
  }
  if (/^(circle|round|rod|bar)/i.test(s) || (desc && typeof desc === 'object' && desc.d)) {
    const D = mm(desc?.d ?? nums[0] ?? 20);
    const I = Math.PI * D ** 4 / 64, A = Math.PI * D * D / 4;
    return { name: `Ø${Math.round(D * 1000)}`, A, I, W: I / (D / 2), rMin: D / 4, shape: 'round' };
  }
  const b = mm(desc?.b ?? nums[0] ?? 200), h = mm(desc?.h ?? nums[1] ?? nums[0] ?? 400);
  const I = b * h ** 3 / 12, Iz = h * b ** 3 / 12, A = b * h;
  return { name: `${Math.round(b * 1000)} × ${Math.round(h * 1000)}`, A, I, W: b * h * h / 6, rMin: Math.sqrt(Math.min(I, Iz) / A), shape: 'rect' };
}

/* ---------------- beams ---------------- */

/**
 * Beam analysis. support: 'simple' | 'cantilever' | 'fixed'. Loads: w (kN/m, full length)
 * and/or P (kN) at a (m from the left / fixed end; default mid-span or tip).
 * section (optional) and material give stress and deflection.
 * Returns reactions, Mmax, Vmax, deflection, V(x), M(x) functions and steps.
 */
export function beam({ L = 6, w = 0, P = 0, a = null, support = 'simple', section = null, material = 'steel', limit = 360 } = {}) {
  L = Math.max(0.1, num(L, 6)); w = num(w, 0); P = num(P, 0);
  const sup = /cant/i.test(support) ? 'cantilever' : /fix|encas/i.test(support) ? 'fixed' : 'simple';
  const pa = a == null ? (sup === 'cantilever' ? L : L / 2) : Math.min(L, Math.max(0, num(a, L / 2)));
  const steps = [];
  let V, M, R1, R2, Mmax, Vmax, deflCoef;
  if (sup === 'simple') {
    R1 = w * L / 2 + P * (L - pa) / L; R2 = w * L / 2 + P * pa / L;
    V = (x) => R1 - w * x - (x > pa ? P : 0);
    M = (x) => R1 * x - w * x * x / 2 - (x > pa ? P * (x - pa) : 0);
    steps.push(step(`Reactions: R₁ = wL/2 + P(L−a)/L = ${r(R1)} kN, R₂ = ${r(R2)} kN`));
    deflCoef = (EI) => {
      // Superpose UDL (5wL⁴/384EI) and point load (exact at its worst point).
      const dUdl = 5 * w * L ** 4 / (384 * EI);
      const b = L - pa;
      const dP = P && pa > 0 && pa < L ? (P * b * (L * L - b * b) ** 1.5) / (9 * Math.sqrt(3) * L * EI) : 0;
      return dUdl + dP;
    };
  } else if (sup === 'cantilever') {
    R1 = w * L + P; R2 = 0;
    V = (x) => w * (L - x) + (x < pa ? P : 0);
    M = (x) => -(w * (L - x) ** 2 / 2 + (x < pa ? P * (pa - x) : 0));
    steps.push(step(`Fixed end: reaction ${r(R1)} kN, moment ${r(w * L * L / 2 + P * pa)} kNm (hogging)`));
    deflCoef = (EI) => w * L ** 4 / (8 * EI) + P * pa * pa * (3 * L - pa) / (6 * EI);
  } else {
    R1 = w * L / 2 + P * (L - pa) ** 2 * (L + 2 * pa) / L ** 3; R2 = w * L + P - R1;
    const Mfix1 = w * L * L / 12 + P * pa * (L - pa) ** 2 / (L * L);
    V = (x) => R1 - w * x - (x > pa ? P : 0);
    M = (x) => -Mfix1 + R1 * x - w * x * x / 2 - (x > pa ? P * (x - pa) : 0);
    steps.push(step(`Fixed ends: end moment wL²/12 + Pab²/L² = ${r(Mfix1)} kNm`));
    deflCoef = (EI) => w * L ** 4 / (384 * EI) + (P && pa ? P * (pa ** 3) * ((L - pa) ** 3) / (3 * EI * L ** 3) : 0);
  }
  // Extremes by sampling (exact enough for reporting; formulas give the same at these points).
  let mMax = 0, mAt = 0, vMax = 0;
  for (let i = 0; i <= 400; i++) {
    const x = L * i / 400;
    const m = M(x), v = V(x);
    if (Math.abs(m) > Math.abs(mMax)) { mMax = m; mAt = x; }
    if (Math.abs(v) > Math.abs(vMax)) vMax = v;
  }
  Mmax = mMax; Vmax = vMax;
  steps.push(step(`Maximum bending moment ${r(Math.abs(Mmax))} kNm at x = ${r(mAt)} m; maximum shear ${r(Math.abs(Vmax))} kN`));
  const out = { support: sup, L, w, P, a: pa, reactions: [r(R1), r(R2)], Mmax: r(Math.abs(Mmax)), MmaxAt: r(mAt), Vmax: r(Math.abs(Vmax)), V, M, steps };
  if (section) {
    const s = sectionProperties(section);
    const m = mat(material);
    const EI = m.E * 1e3 * s.I;                   // kN·m² (E in MPa = 1e3 kN/m²)
    const defl = deflCoef(EI) * 1000;            // mm
    const stress = Math.abs(Mmax) / s.W / 1000;  // MPa
    out.section = s.name;
    out.stressMPa = r(stress, 1);
    out.utilisation = r(stress / m.fy);
    out.deflectionMm = r(defl, 1);
    out.deflectionLimitMm = r(L * 1000 / (sup === 'cantilever' ? limit / 2 : limit), 1);
    out.selfWeightKnm = s.kgm ? r(s.kgm * 9.81 / 1000, 3) : null;
    steps.push(step(`Bending stress M/W = ${r(Math.abs(Mmax), 2)} kNm ÷ ${r(s.W * 1e6, 1)} cm³ = ${r(stress, 1)} MPa (${Math.round(stress / m.fy * 100)}% of fy ${m.fy} MPa)`));
    steps.push(step(`Deflection ${r(defl, 1)} mm against a limit of span/${sup === 'cantilever' ? limit / 2 : limit} = ${out.deflectionLimitMm} mm`));
    out.ok = stress <= m.fy && defl <= out.deflectionLimitMm;
  }
  return out;
}

/* ---------------- columns ---------------- */

const BUCKLING_ALPHA = { a0: 0.13, a: 0.21, b: 0.34, c: 0.49, d: 0.76 };

/** Axial buckling resistance (EN 1993-1-1 §6.3.1). L m, K effective-length factor, curve a0–d. */
export function columnBuckling({ section = 'UC 203x203x46', L = 3.5, K = 1.0, material = 'steel', curve = null, NEd = null } = {}) {
  const s = sectionProperties(section);
  // EN 1993-1-1 Table 6.2: rolled I-sections about the weak axis use curve c; hot-finished hollow sections curve a.
  curve = curve || (s.shape === 'I' ? 'c' : /RHS|SHS|CHS/.test(s.name) ? 'a' : 'b');
  const m = mat(material);
  const Le = num(K, 1) * num(L, 3.5);
  const Ncr = Math.PI ** 2 * m.E * 1e3 * (s.rMin ** 2 * s.A) / (Le * Le);            // kN, weak axis
  const Npl = s.A * m.fy * 1e3;                                                         // kN
  const lam = Math.sqrt(Npl / Ncr);
  const alpha = BUCKLING_ALPHA[curve] ?? 0.34;
  const phi = 0.5 * (1 + alpha * (lam - 0.2) + lam * lam);
  const chi = Math.min(1, 1 / (phi + Math.sqrt(Math.max(0, phi * phi - lam * lam))));
  const NbRd = chi * Npl / 1.0;
  const steps = [
    step(`Effective length Lcr = K·L = ${r(Le)} m; slenderness Lcr/i = ${r(Le / s.rMin, 0)}`),
    step(`Euler load Ncr = π²EI/Lcr² = ${r(Ncr, 0)} kN; squash load A·fy = ${r(Npl, 0)} kN`),
    step(`λ̄ = √(A fy/Ncr) = ${r(lam, 3)}; curve ${curve} (α = ${alpha}) gives χ = ${r(chi, 3)}`),
    step(`Buckling resistance Nb,Rd = χ A fy = ${r(NbRd, 0)} kN`),
  ];
  const out = { section: s.name, Lcr: r(Le), slenderness: r(Le / s.rMin, 0), NcrKn: r(Ncr, 0), NplKn: r(Npl, 0), lambdaBar: r(lam, 3), chi: r(chi, 3), NbRdKn: r(NbRd, 0), steps };
  if (NEd != null) { out.utilisation = r(num(NEd) / NbRd); out.ok = num(NEd) <= NbRd; }
  return out;
}

/* ---------------- wind ---------------- */

/** Velocity pressure and the forces it makes on a wall and a roof. V m/s, heights and areas in m. */
export function windLoad({ V = 38, height = 3, width = 6, depth = 6, Cp = 0.8, CpRoof = -0.9, exposure = 1 } = {}) {
  V = num(V, 38);
  const q = 0.613 * V * V * num(exposure, 1) / 1000;          // kN/m²
  const wallArea = num(width, 6) * num(height, 3);
  const roofArea = num(width, 6) * num(depth, 6);
  const wall = q * (Math.abs(num(Cp, 0.8)) + 0.5) * wallArea;  // windward + leeward suction
  const uplift = q * Math.abs(num(CpRoof, -0.9)) * roofArea;
  return {
    windSpeed: V, qKnm2: r(q, 3), wallForceKn: r(wall, 1), roofUpliftKn: r(uplift, 1), overturningKnm: r(wall * num(height, 3) / 2, 1),
    steps: [
      step(`q = 0.613 V² = 0.613 × ${V}² = ${r(q * 1000, 0)} N/m² (${r(q, 3)} kN/m²)`),
      step(`Wall: q × (Cp windward ${Cp} + 0.5 leeward) × ${r(wallArea, 1)} m² = ${r(wall, 1)} kN`),
      step(`Roof uplift: q × |Cp| ${Math.abs(CpRoof)} × ${r(roofArea, 1)} m² = ${r(uplift, 1)} kN — anchor the roof for at least this`),
    ],
  };
}

/* ---------------- reinforced concrete ---------------- */

const BARS = [10, 12, 16, 20, 25, 32];

/** Singly reinforced rectangular beam (BS 8110 simplified). M kNm, b and d mm, fcu and fy MPa. */
export function rcBeam({ M = 100, b = 230, d = 400, fcu = 25, fy = 460 } = {}) {
  M = num(M, 100); b = num(b, 230); d = num(d, 400); fcu = num(fcu, 25); fy = num(fy, 460);
  const K = M * 1e6 / (b * d * d * fcu);
  const steps = [step(`K = M/(b d² fcu) = ${r(K, 4)}`)];
  if (K > 0.156) {
    steps.push(step('K > 0.156: the section needs compression steel or more depth.'));
    return { K: r(K, 4), ok: false, steps, advice: `Increase the depth to about ${Math.ceil(Math.sqrt(M * 1e6 / (0.156 * b * fcu)) / 25) * 25} mm or add compression reinforcement.` };
  }
  const z = Math.min(0.95 * d, d * (0.5 + Math.sqrt(0.25 - K / 0.9)));
  const As = M * 1e6 / (0.87 * fy * z);
  const Amin = 0.0013 * b * (d + 50);
  const need = Math.max(As, Amin);
  const pick = BARS.map(dia => ({ dia, n: Math.max(2, Math.ceil(need / (Math.PI * dia * dia / 4))) })).find(p => p.n <= Math.floor((b - 2 * 30) / (p.dia + 25)) + 1) || { dia: 32, n: Math.ceil(need / 804) };
  steps.push(step(`Lever arm z = d(0.5 + √(0.25 − K/0.9)) = ${r(z, 0)} mm (≤ 0.95d)`));
  steps.push(step(`As = M/(0.87 fy z) = ${r(As, 0)} mm² (minimum 0.13% bh = ${r(Amin, 0)} mm²)`));
  steps.push(step(`Provide ${pick.n}Y${pick.dia} = ${r(pick.n * Math.PI * pick.dia ** 2 / 4, 0)} mm²`));
  return { K: r(K, 4), zMm: r(z, 0), AsMm2: r(As, 0), AsMinMm2: r(Amin, 0), bars: `${pick.n}Y${pick.dia}`, ok: true, steps };
}

/** Preliminary slab or beam depth from span (span/depth rules, EC2/BS 8110). */
export function spanDepth({ span = 5, element = 'slab', support = 'simple' } = {}) {
  span = num(span, 5);
  const e = String(element).toLowerCase(), s = String(support).toLowerCase();
  const table = {
    slab: { simple: 28, continuous: 32, cantilever: 10, flat: 28 },
    beam: { simple: 12, continuous: 15, cantilever: 6 },
    steel: { simple: 20, continuous: 24, cantilever: 10 },
    timber: { simple: 18, continuous: 22, cantilever: 8 },
    truss: { simple: 10, continuous: 12, cantilever: 5 },
  };
  const t = table[e] || table.slab;
  const ratio = t[/cont/.test(s) ? 'continuous' : /cant/.test(s) ? 'cantilever' : /flat/.test(s) ? 'flat' : 'simple'] || t.simple;
  const depth = span * 1000 / ratio;
  const out = { element: e, span, ratio, depthMm: Math.ceil(depth / 25) * 25, steps: [step(`${e} ${s}: span/depth ≈ ${ratio}, so ${r(span, 2)} m ÷ ${ratio} ≈ ${Math.ceil(depth / 25) * 25} mm`)] };
  if (e === 'slab') out.selfWeightKnm2 = r(out.depthMm / 1000 * 24, 2);
  return out;
}

/* ---------------- building physics and services ---------------- */

// Thermal conductivity λ, W/m·K (typical design values).
export const LAMBDA = {
  concrete: 1.7, 'dense block': 1.1, sandcrete: 0.8, 'hollow sandcrete': 0.6, brick: 0.77, 'laterite brick': 0.6, render: 0.8, plaster: 0.5,
  gypsum: 0.25, plywood: 0.13, timber: 0.13, steel: 50, aluminium: 160, glass: 1.0, rockwool: 0.037, 'glass wool': 0.04, eps: 0.035,
  xps: 0.03, pu: 0.025, pir: 0.022, tile: 1.3, screed: 1.2, bitumen: 0.23,
};

/** U-value from layers [{ material | lambda, thickness (mm) }] (ISO 6946 simple method). */
export function uValue({ layers = [], Rsi = 0.13, Rse = 0.04 } = {}) {
  let R = num(Rsi, 0.13) + num(Rse, 0.04);
  const steps = [step(`Surface resistances Rsi + Rse = ${r(R, 2)} m²K/W`)];
  for (const l of layers) {
    const lam = num(l.lambda, LAMBDA[String(l.material || '').toLowerCase()] ?? 0.5);
    const t = num(l.thickness, 100) / 1000;
    const Rl = /air/.test(String(l.material)) ? 0.18 : t / lam;
    R += Rl;
    steps.push(step(`${l.material || 'layer'} ${num(l.thickness, 100)} mm: R = ${/air/.test(String(l.material)) ? 'unventilated gap 0.18' : `${r(t, 3)} / ${lam}`} = ${r(Rl, 3)}`));
  }
  const U = 1 / R;
  steps.push(step(`U = 1 / ΣR = 1 / ${r(R, 3)} = ${r(U, 3)} W/m²K`));
  return { R: r(R, 3), U: r(U, 3), steps };
}

/** Gutter and downpipe flow for a roof area (m², plan) and rainfall intensity (mm/h). */
export function gutterFlow({ area = 100, intensity = 150 } = {}) {
  const Q = num(area, 100) * num(intensity, 150) / 3600;          // l/s
  const gutter = Q <= 1.1 ? '100 mm half-round' : Q <= 2.3 ? '125 mm half-round' : Q <= 3.8 ? '150 mm box' : 'box gutter sized by calculation (or more outlets)';
  const downpipes = Math.max(1, Math.ceil(Q / 1.6));               // ~1.6 l/s per 68–75 mm downpipe
  return { flowLs: r(Q, 2), gutter, downpipes, steps: [step(`Q = A × i / 3600 = ${area} × ${intensity} / 3600 = ${r(Q, 2)} l/s`), step(`About ${downpipes} × 75 mm downpipe${downpipes > 1 ? 's' : ''}; ${gutter}`)] };
}

/** Escape widths for a number of occupants (BS 9999 style: about 5 mm per person, never under the minimums). */
export function escapeWidth({ occupants = 100, storeys = 1 } = {}) {
  const p = num(occupants, 100);
  const exits = p > 600 ? 3 : p > 60 ? 2 : 1;
  const exitWidth = Math.max(850, Math.ceil(p * 5 / exits / 50) * 50);
  const stair = Math.max(1000, Math.ceil(p * 5 * (num(storeys, 1) > 1 ? 1.1 : 1) / 50) * 50);
  return { occupants: p, exits, exitWidthMm: exitWidth, stairWidthMm: stair, steps: [step(`${p} people → at least ${exits} exit${exits > 1 ? 's' : ''}`), step(`About 5 mm of exit width per person: ${exitWidth} mm per exit, stairs ${stair} mm clear`), step('Check travel distances and the local fire code (in Nigeria, the National Building Code).')] };
}

/** Ramp length and landings for a rise (m) at a gradient (default 1:12). */
export function ramp({ rise = 0.6, gradient = 12 } = {}) {
  const g = num(gradient, 12), h = num(rise, 0.6);
  const run = h * g;
  const landings = Math.max(0, Math.ceil(run / 9) - 1);
  return { rise: h, gradient: `1:${g}`, runM: r(run, 2), landings, steps: [step(`Run = rise × ${g} = ${r(run, 2)} m`), step(`${landings} intermediate landing${landings === 1 ? '' : 's'} (1.5 m long) keep each flight under 9 m`)] };
}

/** Septic tank capacity (BS 6297: C = 180 P + 2000 litres) and daily water storage. */
export function septicTank({ people = 6, litresPerDay = 150, storageDays = 2 } = {}) {
  const P = Math.max(4, num(people, 6));
  const C = 180 * P + 2000;
  const water = P * num(litresPerDay, 150) * num(storageDays, 2);
  return { people: P, septicLitres: C, septicM3: r(C / 1000, 2), waterStorageLitres: water, steps: [step(`Septic tank C = 180P + 2000 = 180 × ${P} + 2000 = ${C} litres`), step(`Water storage: ${P} people × ${litresPerDay} l/day × ${storageDays} days = ${water} litres`)] };
}

/** Dead and imposed loads on a floor or roof, and the factored design load (EN 1990: 1.35G + 1.5Q). */
export const IMPOSED_LOADS = {
  residential: 1.5, office: 2.5, classroom: 3.0, shop: 4.0, assembly: 5.0, corridor: 3.0, storage: 7.5, carpark: 2.5, roof: 0.75, 'roof terrace': 3.0,
};
export const DEAD_LOADS = {
  'rc slab 150': 3.6, 'rc slab 200': 4.8, 'screed 50': 1.1, tiles: 0.5, 'ceiling and services': 0.5, partitions: 1.0,
  'sandcrete 225 wall': 2.9, 'sandcrete 150 wall': 2.2, 'aluminium roofing': 0.05, 'steel roofing': 0.1, 'roof timber': 0.25,
};
export function designLoad({ use = 'office', dead = null, extras = [] } = {}) {
  const q = IMPOSED_LOADS[String(use).toLowerCase()] ?? num(use, 2.5);
  const g = dead != null ? num(dead, 5) : 4.8 + 1.1 + 0.5 + 1.0;
  const gx = g + (Array.isArray(extras) ? extras.reduce((s, e) => s + (DEAD_LOADS[e] ?? 0), 0) : 0);
  const uls = 1.35 * gx + 1.5 * q;
  return { gk: r(gx, 2), qk: q, ulsKnm2: r(uls, 2), slsKnm2: r(gx + q, 2), steps: [step(`Dead load gk = ${r(gx, 2)} kN/m² (slab, screed, finishes, partitions)`), step(`Imposed load qk (${use}) = ${q} kN/m²`), step(`Design load 1.35gk + 1.5qk = ${r(uls, 2)} kN/m²`)] };
}
