/* Voltage Drop & Cable Size — will this cable actually do the job?

   Two questions an electrician asks on every run: is the cable big
   enough to carry the current, and will the volt drop over that distance
   leave enough at the far end. Both are answered, and the tool
   recommends the smallest size that passes. */

import { field, selectField, statGrid, dataTable, num, parseNum, liveCompute } from '../lib/biz.js';

/* Copper and aluminium resistivity at operating temperature, Ω·mm²/m. */
const RHO = { copper: 0.0178, aluminium: 0.0286 };

/* Metric cable sizes with indicative current ratings (A) for copper,
   single-phase, clipped direct in free air. Ratings vary considerably
   with installation method — the tool says so rather than implying
   these are the only figures that matter. */
const SIZES = [
  { mm2: 1.0, amps: 14 }, { mm2: 1.5, amps: 18 }, { mm2: 2.5, amps: 24 },
  { mm2: 4, amps: 32 },   { mm2: 6, amps: 41 },   { mm2: 10, amps: 57 },
  { mm2: 16, amps: 76 },  { mm2: 25, amps: 101 }, { mm2: 35, amps: 125 },
  { mm2: 50, amps: 151 }, { mm2: 70, amps: 192 }, { mm2: 95, amps: 232 },
  { mm2: 120, amps: 269 }, { mm2: 150, amps: 309 }, { mm2: 185, amps: 353 },
];

export default {
  render(container, { analytics } = {}) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          ${selectField('System', 'vd-phase', [
            { value: 'single', label: 'Single phase (2 conductors)' },
            { value: 'three', label: 'Three phase' },
            { value: 'dc', label: 'DC' },
          ], 'single')}
          ${field('Supply voltage', 'vd-v', 230, { suffix: 'V', min: 1, step: 1 })}
          ${field('Load current', 'vd-i', 20, { suffix: 'A', min: 0.1, step: 0.5 })}
          ${field('One-way cable run', 'vd-len', 35, { suffix: 'm', min: 0.1, step: 1, hint: 'Distance to the load, not there and back — the return path is accounted for.' })}
          ${selectField('Conductor', 'vd-mat', [
            { value: 'copper', label: 'Copper' },
            { value: 'aluminium', label: 'Aluminium' },
          ], 'copper')}
          ${field('Acceptable drop', 'vd-max', 4, { suffix: '%', min: 0.5, max: 15, step: 0.5, hint: '3% for lighting and 5% for power is the common rule; 4% is a safe general target.' })}
          ${selectField('Cable size', 'vd-size', [
            { value: 'auto', label: 'Recommend the smallest that passes' },
            ...SIZES.map(s => ({ value: String(s.mm2), label: `${s.mm2} mm² (${s.amps} A)` })),
          ], 'auto')}
        </div>

        <div class="tool-section">
          <div id="vd-out"></div>
          <div id="vd-verdict"></div>
          <div id="vd-table"></div>
          <p class="biz-explain" style="margin-top:14px; color:var(--g500);">
            Current ratings are indicative for copper clipped direct in free air. Grouping,
            insulation, ambient temperature and burial all derate a cable, sometimes heavily.
            Check against the wiring regulations that apply where the work is being done.</p>
        </div>
      </div>`;

    const $ = (id) => container.querySelector('#' + id);
    let started = false;

    liveCompute(container, () => {
      const phase = $('vd-phase').value;
      const V = parseNum($('vd-v'));
      const I = parseNum($('vd-i'));
      const L = parseNum($('vd-len'));
      const rho = RHO[$('vd-mat').value];
      const maxPct = parseNum($('vd-max'), 4);

      if (!(V > 0 && I > 0 && L > 0)) { $('vd-out').innerHTML = ''; return; }

      /* Single phase and DC see both conductors, so the effective length
         is doubled. Three phase uses √3 on the line-to-line drop. */
      const factor = phase === 'three' ? Math.sqrt(3) : 2;

      const dropFor = (mm2) => (factor * rho * L * I) / mm2;
      const pctFor = (mm2) => (dropFor(mm2) / V) * 100;

      const chosen = $('vd-size').value;
      const passing = SIZES.filter(s => s.amps >= I && pctFor(s.mm2) <= maxPct);
      const recommended = passing[0] ?? null;
      const size = chosen === 'auto'
        ? recommended
        : SIZES.find(s => String(s.mm2) === chosen);

      if (!size) {
        $('vd-out').innerHTML = '';
        $('vd-verdict').innerHTML = `
          <div class="bm-check is-fail">
            <strong>No cable in the list satisfies this run</strong>
            <span>${num(I, 1)} A over ${num(L, 0)} m needs more than 185 mm². Split the load,
            raise the voltage, or shorten the run.</span>
          </div>`;
        $('vd-table').innerHTML = '';
        return;
      }

      const drop = dropFor(size.mm2);
      const pct = pctFor(size.mm2);
      const atLoad = V - drop;
      const capacityOk = size.amps >= I;
      const dropOk = pct <= maxPct;
      const ok = capacityOk && dropOk;

      $('vd-out').innerHTML = statGrid([
        { label: 'Cable size', value: `${size.mm2} mm²` },
        { label: 'Volt drop', value: `${num(drop, 2)} V` },
        { label: 'As a percentage', value: `${num(pct, 2)}%` },
        { label: 'Voltage at load', value: `${num(atLoad, 1)} V` },
        { label: 'Cable rating', value: `${size.amps} A` },
        { label: 'Loading', value: `${num((I / size.amps) * 100, 0)}%` },
      ]);

      $('vd-verdict').innerHTML = `
        <div class="bm-check ${ok ? 'is-pass' : 'is-fail'}">
          <strong>${ok ? 'This cable will do' : !capacityOk ? 'Cable is too small for the current' : 'Volt drop is too high'}</strong>
          <span>${
            !capacityOk
              ? `${size.mm2} mm² is rated ${size.amps} A and the load draws ${num(I, 1)} A.`
              : !dropOk
                ? `${num(pct, 2)}% exceeds the ${num(maxPct, 1)}% target over ${num(L, 0)} m.${recommended ? ` Use ${recommended.mm2} mm² instead.` : ''}`
                : `${num(pct, 2)}% drop over ${num(L, 0)} m, leaving ${num(atLoad, 1)} V at the load.`
          }</span>
        </div>`;

      $('vd-table').innerHTML = dataTable(
        ['Size', 'Rating', 'Drop', '%', 'Verdict'],
        SIZES.filter(s => s.mm2 >= (recommended ? recommended.mm2 / 4 : 1)).slice(0, 8).map(s => {
          const p = pctFor(s.mm2);
          const good = s.amps >= I && p <= maxPct;
          return [
            `${s.mm2} mm²`, `${s.amps} A`, `${num(dropFor(s.mm2), 2)} V`, `${num(p, 2)}%`,
            s.amps < I ? 'Under-rated' : p > maxPct ? 'Drop too high' : good ? 'OK' : '—',
          ];
        }),
        { caption: 'Nearby sizes' },
      );

      if (!started) { started = true; analytics?.started(); }
      analytics?.completed({ resultCount: 1 });
    });
  },

  destroy() {},
};
