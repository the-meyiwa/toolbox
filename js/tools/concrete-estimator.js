/* Concrete & Rebar Estimator — volume, mix, bags and steel.

   Sized for the way a small site actually orders: how many bags of
   cement, how much sand and stone, how many lengths of rebar, and what
   it costs. Waste allowance is separate and visible, because that is the
   figure people argue about. */

import { field, selectField, statGrid, dataTable, num, money, parseNum, liveCompute, currencySelect } from '../lib/biz.js';

/* Nominal volumetric mixes. Cement content is kg of cement per m³ of
   finished concrete — the number that drives the bag count. */
const MIXES = {
  '1:3:6': { name: '1:3:6 — mass fill, blinding', cement: 210, sand: 0.55, stone: 0.83 },
  '1:2:4': { name: '1:2:4 — general purpose (C20)', cement: 320, sand: 0.50, stone: 0.75 },
  '1:1.5:3': { name: '1:1½:3 — structural (C25)', cement: 380, sand: 0.45, stone: 0.72 },
  '1:1:2': { name: '1:1:2 — high strength (C30+)', cement: 450, sand: 0.42, stone: 0.68 },
};

const BARS = {
  8:  0.395, 10: 0.617, 12: 0.888, 16: 1.579, 20: 2.466, 25: 3.854, 32: 6.313,
};

export default {
  render(container, { analytics } = {}) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          ${selectField('What are you pouring?', 'ce-shape', [
            { value: 'slab', label: 'Slab or floor' },
            { value: 'footing', label: 'Strip footing' },
            { value: 'column', label: 'Column or pad' },
          ], 'slab')}

          <div class="biz-grid" id="ce-dims">
            ${field('Length', 'ce-l', 10, { suffix: 'm', min: 0, step: 0.1 })}
            ${field('Width', 'ce-w', 4, { suffix: 'm', min: 0, step: 0.1 })}
            ${field('Thickness or depth', 'ce-t', 150, { suffix: 'mm', min: 10, step: 5 })}
            ${field('How many?', 'ce-n', 1, { min: 1, step: 1 })}
          </div>

          ${selectField('Mix', 'ce-mix', Object.entries(MIXES).map(([v, m]) => ({ value: v, label: m.name })), '1:2:4')}
          ${field('Waste allowance', 'ce-waste', 8, { suffix: '%', min: 0, max: 40, step: 1, hint: 'Spillage, over-dig and uneven substrate. Eight per cent is typical on a prepared base.' })}
          ${field('Cement bag size', 'ce-bag', 50, { suffix: 'kg', min: 10, step: 5 })}

          <h3 class="cq-h" style="margin-top:24px;">Reinforcement</h3>
          ${selectField('Bar size', 'ce-bar', Object.keys(BARS).map(d => ({ value: d, label: `Y${d} — ${d} mm (${BARS[d]} kg/m)` })), '12')}
          ${field('Spacing', 'ce-spacing', 200, { suffix: 'mm centres', min: 50, step: 25 })}
          ${field('Layers', 'ce-layers', 1, { min: 0, max: 4, step: 1, hint: 'Two for a suspended slab with top and bottom mesh.' })}
          ${field('Bar length', 'ce-barlen', 12, { suffix: 'm', min: 1, step: 0.5 })}
        </div>

        <div class="tool-section">
          <div id="ce-out"></div>
          <div id="ce-table"></div>

          <h3 class="cq-h" style="margin-top:26px;">Cost</h3>
          <div class="biz-field">
            <label class="tool-label" for="ce-cur">Currency</label>
            ${currencySelect('ce-cur', 'NGN')}
          </div>
          <div class="biz-grid">
            ${field('Cement per bag', 'ce-pc', 9500, { min: 0, step: 100 })}
            ${field('Sand per m³', 'ce-ps', 22000, { min: 0, step: 500 })}
            ${field('Stone per m³', 'ce-pg', 30000, { min: 0, step: 500 })}
            ${field('Rebar per kg', 'ce-pr', 1800, { min: 0, step: 50 })}
          </div>
          <div id="ce-cost"></div>
          <p class="biz-explain" style="margin-top:12px; color:var(--g500);">
            Nominal volumetric mixes for estimating quantities to order. A designed mix from a
            batching plant will differ, and structural rebar should follow the engineer's schedule.</p>
        </div>
      </div>`;

    const $ = (id) => container.querySelector('#' + id);
    let started = false;

    liveCompute(container, () => {
      const shape = $('ce-shape').value;
      const L = parseNum($('ce-l')), Wd = parseNum($('ce-w'));
      const T = parseNum($('ce-t')) / 1000;
      const count = Math.max(1, parseNum($('ce-n'), 1));

      // The three shapes differ only in which dimensions multiply, so
      // the labels change rather than the arithmetic.
      const one = shape === 'column' ? L * Wd * T : L * Wd * T;
      const net = one * count;
      const waste = parseNum($('ce-waste')) / 100;
      const gross = net * (1 + waste);

      if (!(gross > 0)) { $('ce-out').innerHTML = ''; return; }

      const mix = MIXES[$('ce-mix')?.value] || MIXES['1:2:4'];
      const bagKg = Math.max(1, parseNum($('ce-bag'), 50));
      const cementKg = gross * (mix?.cement ?? 320);
      const bags = Math.ceil(cementKg / bagKg);
      const sand = gross * (mix?.sand ?? 0.50);
      const stone = gross * (mix?.stone ?? 0.75);
      const water = cementKg * 0.5;      // w/c ratio 0.5, a sane default

      /* Rebar: a grid each way across the plan area. */
      const spacing = Math.max(0.05, parseNum($('ce-spacing')) / 1000);
      const layers = parseNum($('ce-layers'), 1);
      const barKgPerM = BARS[$('ce-bar')?.value] || BARS['12'] || 0.888;
      const barLen = Math.max(1, parseNum($('ce-barlen'), 12));

      const barsX = layers ? Math.ceil(Wd / spacing) + 1 : 0;
      const barsY = layers ? Math.ceil(L / spacing) + 1 : 0;
      const rebarM = layers ? (barsX * L + barsY * Wd) * layers * count : 0;
      const rebarKg = rebarM * barKgPerM;
      const lengths = Math.ceil(rebarM / barLen);

      $('ce-out').innerHTML = statGrid([
        { label: 'Net volume', value: `${num(net, 2)} m³` },
        { label: `With ${num(waste * 100, 0)}% waste`, value: `${num(gross, 2)} m³` },
        { label: 'Cement', value: `${bags} bags` },
        { label: 'Sand', value: `${num(sand, 2)} m³` },
        { label: 'Stone', value: `${num(stone, 2)} m³` },
        ...(layers ? [{ label: 'Rebar', value: `${num(rebarKg, 0)} kg` }] : []),
      ]);

      $('ce-table').innerHTML = dataTable(
        ['Material', 'Quantity', 'Note'],
        [
          ['Cement', `${bags} × ${bagKg} kg`, `${num(cementKg, 0)} kg at ${mix.cement} kg/m³`],
          ['Sharp sand', `${num(sand, 2)} m³`, `${num(sand * 1.6, 2)} tonnes approx.`],
          ['Coarse aggregate', `${num(stone, 2)} m³`, `${num(stone * 1.5, 2)} tonnes approx.`],
          ['Water', `${num(water, 0)} litres`, 'At a 0.5 water–cement ratio'],
          ...(layers ? [
            [`Rebar Y${$('ce-bar').value}`, `${num(rebarM, 0)} m`, `${lengths} lengths of ${barLen} m`],
            ['Rebar weight', `${num(rebarKg, 0)} kg`, `${barsX} bars one way, ${barsY} the other, ${layers} layer${layers > 1 ? 's' : ''}`],
          ] : []),
        ],
        { caption: 'Order list' },
      );

      const cur = $('ce-cur').value;
      const cost = bags * parseNum($('ce-pc')) + sand * parseNum($('ce-ps'))
                 + stone * parseNum($('ce-pg')) + rebarKg * parseNum($('ce-pr'));
      $('ce-cost').innerHTML = statGrid([
        { label: 'Materials total', value: money(cost, cur) },
        { label: 'Per m³', value: money(gross > 0 ? cost / gross : 0, cur) },
      ]);

      if (!started) { started = true; analytics?.started(); }
      analytics?.completed({ resultCount: 1 });
    });
  },

  destroy() {},
};
