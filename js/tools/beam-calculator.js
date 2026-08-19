/* Beam Calculator — reactions, shear, moment and deflection.

   Covers the four load cases that account for most hand checks: a simply
   supported or cantilever beam under either a point load or a uniformly
   distributed one. Standard elastic formulae, stated in the output so
   the result can be checked rather than trusted.

   This is a design aid, not a substitute for a structural engineer's
   check, and the tool says so. */

import { field, selectField, statGrid, num, parseNum, liveCompute } from '../lib/biz.js';

/* Common sections, second moment of area about the strong axis (mm⁴)
   and depth (mm). Figures are nominal catalogue values. */
const SECTIONS = {
  custom:      { name: 'Custom', I: null, d: null },
  'ipe-200':   { name: 'IPE 200', I: 1943e4, d: 200 },
  'ipe-300':   { name: 'IPE 300', I: 8356e4, d: 300 },
  'ipe-400':   { name: 'IPE 400', I: 23130e4, d: 400 },
  'uc-203':    { name: 'UC 203×203×46', I: 4568e4, d: 203 },
  'ub-305':    { name: 'UB 305×102×25', I: 4455e4, d: 305 },
  'timber-2x8': { name: 'Timber 50×200', I: (50 * 200 ** 3) / 12, d: 200 },
  'timber-2x10': { name: 'Timber 50×250', I: (50 * 250 ** 3) / 12, d: 250 },
};

const MATERIALS = {
  steel:    { name: 'Steel', E: 210000 },
  aluminium: { name: 'Aluminium', E: 69000 },
  timber:   { name: 'Timber (softwood)', E: 11000 },
  concrete: { name: 'Concrete C25/30', E: 31000 },
};

export default {
  render(container, { analytics } = {}) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          ${selectField('Support', 'bm-type', [
            { value: 'ss-point', label: 'Simply supported · central point load' },
            { value: 'ss-udl', label: 'Simply supported · distributed load' },
            { value: 'cant-point', label: 'Cantilever · point load at the tip' },
            { value: 'cant-udl', label: 'Cantilever · distributed load' },
          ], 'ss-udl')}
          ${field('Span', 'bm-l', 5, { suffix: 'm', min: 0.1, step: 0.1 })}
          ${field('Load', 'bm-w', 10, { suffix: 'kN or kN/m', min: 0, step: 0.5, hint: 'A point load in kN, or a distributed load in kN per metre.' })}
          ${selectField('Material', 'bm-mat', Object.entries(MATERIALS).map(([v, m]) => ({ value: v, label: m.name })), 'steel')}
          ${selectField('Section', 'bm-sec', Object.entries(SECTIONS).map(([v, s]) => ({ value: v, label: s.name })), 'ipe-300')}
          <div id="bm-custom" hidden>
            ${field('Second moment of area', 'bm-i', 8356, { suffix: 'cm⁴', min: 0.01, step: 0.01 })}
            ${field('Section depth', 'bm-d', 300, { suffix: 'mm', min: 1 })}
          </div>
          ${field('Deflection limit', 'bm-lim', 250, { suffix: 'span ÷', min: 50, step: 10, hint: 'Span over 250 is a common serviceability limit; 360 for brittle finishes.' })}
        </div>

        <div class="tool-section">
          <div id="bm-out"></div>
          <div id="bm-diagram"></div>
          <div id="bm-explain"></div>
        </div>
      </div>`;

    const $ = (id) => container.querySelector('#' + id);
    let started = false;

    liveCompute(container, () => {
      const type = $('bm-type').value;
      const L = parseNum($('bm-l'));            // m
      const W = parseNum($('bm-w'));            // kN or kN/m
      const mat = MATERIALS[$('bm-mat').value];
      const secKey = $('bm-sec').value;
      $('bm-custom').hidden = secKey !== 'custom';

      const I = secKey === 'custom' ? parseNum($('bm-i')) * 1e4 : SECTIONS[secKey].I;   // mm⁴
      const depth = secKey === 'custom' ? parseNum($('bm-d')) : SECTIONS[secKey].d;      // mm
      const E = mat.E;                                                                   // N/mm²

      if (!(L > 0) || !(I > 0)) { $('bm-out').innerHTML = ''; return; }

      let R1, R2, Mmax, defl, formula, shearMax;
      const L_mm = L * 1000;
      const P_N = W * 1000;          // point load, newtons
      const w_Nmm = W;               // kN/m is numerically N/mm

      if (type === 'ss-point') {
        R1 = R2 = W / 2;
        shearMax = W / 2;
        Mmax = (W * L) / 4;
        defl = (P_N * L_mm ** 3) / (48 * E * I);
        formula = 'R = P⁄2 · M = PL⁄4 · δ = PL³⁄48EI';
      } else if (type === 'ss-udl') {
        const total = W * L;
        R1 = R2 = total / 2;
        shearMax = total / 2;
        Mmax = (W * L * L) / 8;
        defl = (5 * w_Nmm * L_mm ** 4) / (384 * E * I);
        formula = 'R = wL⁄2 · M = wL²⁄8 · δ = 5wL⁴⁄384EI';
      } else if (type === 'cant-point') {
        R1 = W; R2 = 0;
        shearMax = W;
        Mmax = W * L;
        defl = (P_N * L_mm ** 3) / (3 * E * I);
        formula = 'R = P · M = PL · δ = PL³⁄3EI';
      } else {
        const total = W * L;
        R1 = total; R2 = 0;
        shearMax = total;
        Mmax = (W * L * L) / 2;
        defl = (w_Nmm * L_mm ** 4) / (8 * E * I);
        formula = 'R = wL · M = wL²⁄2 · δ = wL⁴⁄8EI';
      }

      // Bending stress from M/Z, with Z taken as I over half the depth.
      const Z = depth ? I / (depth / 2) : null;                 // mm³
      const stress = Z ? (Mmax * 1e6) / Z : null;               // N/mm²
      const limit = L_mm / parseNum($('bm-lim'), 250);
      const passes = defl <= limit;

      $('bm-out').innerHTML = statGrid([
        { label: 'Reaction (left)', value: `${num(R1, 2)} kN` },
        ...(R2 ? [{ label: 'Reaction (right)', value: `${num(R2, 2)} kN` }] : []),
        { label: 'Max shear', value: `${num(shearMax, 2)} kN` },
        { label: 'Max moment', value: `${num(Mmax, 2)} kNm` },
        { label: 'Deflection', value: `${num(defl, 2)} mm` },
        ...(stress ? [{ label: 'Bending stress', value: `${num(stress, 1)} N/mm²` }] : []),
      ]);

      $('bm-diagram').innerHTML = `
        <div class="bm-check ${passes ? 'is-pass' : 'is-fail'}">
          <strong>${passes ? 'Deflection is within limit' : 'Deflection exceeds the limit'}</strong>
          <span>${num(defl, 2)} mm against a limit of ${num(limit, 2)} mm (span ÷ ${num(parseNum($('bm-lim'), 250), 0)}).
          That is span ÷ ${defl > 0 ? num(L_mm / defl, 0) : '∞'}.</span>
        </div>`;

      $('bm-explain').innerHTML = `
        <p class="biz-explain">${formula}</p>
        <p class="biz-explain">Using E = ${num(E, 0).replace(/,/g, ' ')} N/mm² for ${mat.name.toLowerCase()}
          and I = ${num(I / 1e4, 0)} cm⁴.</p>
        <p class="biz-explain" style="margin-top:14px; color:var(--g500);">
          Elastic formulae for a single span with the stated support conditions. Self-weight is not
          included, and no factors are applied. Use it to size and sanity-check, not as a substitute
          for a structural engineer's calculation.</p>`;

      if (!started) { started = true; analytics?.started(); }
      analytics?.completed({ resultCount: 1 });
    });
  },

  destroy() {},
};
