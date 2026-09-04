import { currencySelect, field, statGrid, dataTable, money, num, months, pct, parseNum, liveCompute } from '../lib/biz.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          <div class="biz-field">
            <label class="tool-label" for="rw-cur">Currency</label>
            ${currencySelect('rw-cur')}
          </div>
          ${field('Cash in the bank', 'rw-cash', 750000, { min: 0 })}
          ${field('Monthly costs', 'rw-costs', 95000, { min: 0, hint: 'Everything going out: salaries, rent, tools, contractors.' })}
          ${field('Monthly revenue', 'rw-revenue', 32000, { min: 0 })}
          ${field('Revenue growth per month', 'rw-growth', 6, { min: -50, max: 100, step: 0.5, suffix: '%' })}
          ${field('Cost growth per month', 'rw-cost-growth', 2, { min: -50, max: 100, step: 0.5, suffix: '%', hint: 'Costs creep up as you hire. Set to 0 to hold them flat.' })}
        </div>

        <div class="tool-section">
          <div id="rw-out"></div>
          <div id="rw-verdict"></div>
          <div id="rw-table"></div>
        </div>
      </div>`;

    const out = container.querySelector('#rw-out');
    const MAX_MONTHS = 120;

    function compute() {
      const cur        = container.querySelector('#rw-cur').value;
      const cash0      = parseNum(container.querySelector('#rw-cash'));
      const costs0     = parseNum(container.querySelector('#rw-costs'));
      const revenue0   = parseNum(container.querySelector('#rw-revenue'));
      const gRev       = parseNum(container.querySelector('#rw-growth')) / 100;
      const gCost      = parseNum(container.querySelector('#rw-cost-growth')) / 100;

      const rows = [];
      let cash = cash0, revenue = revenue0, costs = costs0;
      let zeroMonth = null, breakEvenMonth = null;

      for (let m = 1; m <= MAX_MONTHS; m++) {
        const burn = costs - revenue;
        cash -= burn;

        if (breakEvenMonth === null && burn <= 0) breakEvenMonth = m;
        if (zeroMonth === null && cash <= 0) { zeroMonth = m; }

        rows.push({ m, revenue, costs, burn, cash: Math.max(cash, 0) });

        if (cash <= 0) break;
        // Once revenue covers costs the balance only grows — stop early.
        if (burn <= 0 && m > 12) break;

        revenue *= (1 + gRev);
        costs   *= (1 + gCost);
      }

      const netBurn0   = costs0 - revenue0;
      const simpleRun  = netBurn0 > 0 ? cash0 / netBurn0 : Infinity;
      const modelledRun = zeroMonth ?? Infinity;

      out.innerHTML = statGrid([
        { value: modelledRun === Infinity ? 'Profitable' : months(modelledRun),
          label: 'Runway (with growth)', tone: modelledRun === Infinity ? 'good' : (modelledRun < 6 ? 'bad' : 'hero') },
        { value: netBurn0 > 0 ? money(netBurn0, cur) : money(0, cur), label: 'Net burn this month' },
        { value: money(costs0, cur), label: 'Gross burn this month' },
        { value: simpleRun === Infinity ? '∞' : months(simpleRun), label: 'Runway if nothing changes' },
        { value: breakEvenMonth ? `Month ${breakEvenMonth}` : 'Not within 10y', label: 'Break-even point',
          tone: breakEvenMonth ? 'good' : null },
        { value: pct(costs0 > 0 ? revenue0 / costs0 * 100 : NaN), label: 'Default alive ratio', sub: 'revenue ÷ costs' },
      ]);

      const verdict = container.querySelector('#rw-verdict');
      if (modelledRun === Infinity) {
        verdict.innerHTML = `<div class="tool-output biz-good">
          On these numbers revenue overtakes costs${breakEvenMonth ? ` in month ${breakEvenMonth}` : ''}
          and you never run out. That is <em>default alive</em> — you control your own timeline.</div>`;
      } else if (modelledRun <= 6) {
        verdict.innerHTML = `<div class="tool-output biz-warn">
          You have <strong>${months(modelledRun)}</strong> of cash. Fundraising typically takes
          three to six months from first conversation to money in the bank, so this is the point
          where raising, cutting costs, or both stops being optional.</div>`;
      } else {
        verdict.innerHTML = `<div class="tool-output biz-explain">
          Cash runs out in <strong>month ${modelledRun}</strong>${breakEvenMonth
            ? `, though you break even in month ${breakEvenMonth} — the gap is what you need to bridge`
            : ''}. Most investors want to see 18–24 months of runway after a round.</div>`;
      }

      const shown = rows.filter((r, i) => i < 3 || r.m % 3 === 0 || r.m === rows.length);
      container.querySelector('#rw-table').innerHTML = dataTable(
        ['Month',
         { label: 'Revenue', align: 'right' },
         { label: 'Costs', align: 'right' },
         { label: 'Net burn', align: 'right' },
         { label: 'Cash left', align: 'right' }],
        shown.map(r => ({
          emphasis: r.m === zeroMonth || r.m === breakEvenMonth,
          cells: [num(r.m), money(r.revenue, cur), money(r.costs, cur),
                  `<span class="${r.burn > 0 ? 'biz-neg' : 'biz-pos'}">${money(r.burn, cur)}</span>`,
                  money(r.cash, cur)],
        })),
        { caption: 'Projection — every third month', maxHeight: '320px' }
      );
    }

    liveCompute(container, compute);
  },
  destroy() {},
};
