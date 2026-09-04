import { currencySelect, field, statGrid, dataTable, money, num, pct, parseNum, liveCompute } from '../lib/biz.js';

/* Net present value discounts each future cash flow back to today.
   IRR is the discount rate at which NPV is exactly zero — solved
   numerically, because there is no closed form for it. */

function npv(rate, flows) {
  return flows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + rate, t), 0);
}

/* Bisection on [-0.9999, 10]. Slower than Newton but it cannot diverge,
   which matters because users paste in all sorts of cash flow shapes. */
function irr(flows) {
  const f = (r) => npv(r, flows);
  let lo = -0.9999, hi = 10;
  let flo = f(lo), fhi = f(hi);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return NaN;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.abs(fm) < 1e-9) return mid;
    if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          <div class="biz-field">
            <label class="tool-label" for="npv-cur">Currency</label>
            ${currencySelect('npv-cur')}
          </div>
          ${field('Discount rate', 'npv-rate', 10, { min: -50, max: 100, step: 0.5, suffix: '%', hint: 'Your cost of capital — the return you could get elsewhere for the same risk.' })}
          ${field('Initial investment', 'npv-initial', 500000, { min: 0, hint: 'Entered as money out, at time zero.' })}

          <label class="tool-label" style="margin-top:18px;">Cash coming back in</label>
          <p class="biz-hint">One year per line. Use a minus sign for a year that costs you money.</p>
          <textarea class="tool-textarea" id="npv-flows" rows="8" spellcheck="false">120000
150000
180000
200000
220000</textarea>

          <div class="tool-controls" style="margin-top:14px;">
            <button class="btn btn-secondary btn-sm" data-fill="even">5 even years</button>
            <button class="btn btn-secondary btn-sm" data-fill="ramp">Ramping up</button>
          </div>
        </div>

        <div class="tool-section">
          <div id="npv-out"></div>
          <div id="npv-verdict"></div>
          <div id="npv-table"></div>
        </div>
      </div>`;

    const out = container.querySelector('#npv-out');
    const flowsEl = container.querySelector('#npv-flows');

    function compute() {
      const cur     = container.querySelector('#npv-cur').value;
      const rate    = parseNum(container.querySelector('#npv-rate')) / 100;
      const initial = parseNum(container.querySelector('#npv-initial'));

      const inflows = flowsEl.value.split('\n')
        .map(l => l.trim())
        .filter(Boolean)
        .map(l => parseNum(l, NaN))
        .filter(Number.isFinite);

      const flows = [-Math.abs(initial), ...inflows];

      const value = npv(rate, flows);
      const rateOfReturn = irr(flows);
      const totalIn = inflows.reduce((s, v) => s + v, 0);

      // Payback: first year the running total turns positive (undiscounted),
      // interpolated within the year for a sensible fractional answer.
      let cumulative = -Math.abs(initial), payback = NaN;
      for (let t = 0; t < inflows.length; t++) {
        const next = cumulative + inflows[t];
        if (cumulative < 0 && next >= 0) {
          payback = t + (inflows[t] !== 0 ? -cumulative / inflows[t] : 0);
          break;
        }
        cumulative = next;
      }

      // Discounted payback uses present values instead.
      let dCum = -Math.abs(initial), dPayback = NaN;
      for (let t = 0; t < inflows.length; t++) {
        const pv = inflows[t] / Math.pow(1 + rate, t + 1);
        const next = dCum + pv;
        if (dCum < 0 && next >= 0) { dPayback = t + (pv !== 0 ? -dCum / pv : 0); break; }
        dCum = next;
      }

      out.innerHTML = statGrid([
        { value: money(value, cur), label: `NPV at ${pct(rate * 100)}`, tone: value >= 0 ? 'good' : 'bad' },
        { value: Number.isFinite(rateOfReturn) ? pct(rateOfReturn * 100) : '—', label: 'IRR', tone: 'hero' },
        { value: Number.isFinite(payback) ? `${payback.toFixed(1)} yrs` : 'Never', label: 'Payback period' },
        { value: Number.isFinite(dPayback) ? `${dPayback.toFixed(1)} yrs` : 'Never', label: 'Discounted payback' },
        { value: money(totalIn - Math.abs(initial), cur), label: 'Total profit (undiscounted)' },
      ]);

      container.querySelector('#npv-verdict').innerHTML = value >= 0
        ? `<div class="tool-output biz-good">
             The project returns <strong>${money(value, cur)}</strong> more than your
             ${pct(rate * 100)} hurdle rate, in today's money. On NPV alone, it is worth doing.
             ${Number.isFinite(rateOfReturn) ? `It earns an effective <strong>${pct(rateOfReturn * 100)}</strong> a year.` : ''}
           </div>`
        : `<div class="tool-output biz-warn">
             At a ${pct(rate * 100)} discount rate this destroys <strong>${money(Math.abs(value), cur)}</strong>
             of value — the money would do better in whatever alternative justifies that rate.
             ${Number.isFinite(rateOfReturn) ? `It only returns ${pct(rateOfReturn * 100)} a year.` : ''}
           </div>`;

      let running = 0;
      container.querySelector('#npv-table').innerHTML = dataTable(
        ['Year',
         { label: 'Cash flow', align: 'right' },
         { label: 'Discount factor', align: 'right' },
         { label: 'Present value', align: 'right' },
         { label: 'Cumulative PV', align: 'right' }],
        flows.map((cf, t) => {
          const factor = 1 / Math.pow(1 + rate, t);
          const pv = cf * factor;
          running += pv;
          return {
            emphasis: t === 0,
            cells: [t === 0 ? 'Now' : num(t), money(cf, cur), factor.toFixed(4), money(pv, cur),
                    `<span class="${running >= 0 ? 'biz-pos' : 'biz-neg'}">${money(running, cur)}</span>`],
          };
        }),
        { maxHeight: '320px' }
      );
    }

    container.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fill]');
      if (!b) return;
      flowsEl.value = b.dataset.fill === 'even'
        ? '150000\n150000\n150000\n150000\n150000'
        : '80000\n130000\n190000\n250000\n310000';
      compute();
    });

    liveCompute(container, compute);
  },
  destroy() {},
};
