import { currencySelect, field, statGrid, dataTable, money, num, pct, parseNum, liveCompute } from '../lib/biz.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          <div class="biz-field">
            <label class="tool-label" for="be-cur">Currency</label>
            ${currencySelect('be-cur')}
          </div>
          ${field('Fixed costs per month', 'be-fixed', 12000, { min: 0, hint: 'Rent, salaries, software — everything you pay whether you sell one unit or a thousand.' })}
          ${field('Selling price per unit', 'be-price', 45, { min: 0 })}
          ${field('Variable cost per unit', 'be-var', 18, { min: 0, hint: 'Materials, shipping, payment fees — the cost that only exists because you made a sale.' })}
          ${field('Units you expect to sell', 'be-expected', 400, { min: 0, step: 1 })}
        </div>

        <div class="tool-section">
          <div id="be-out"></div>
          <div id="be-chart" class="biz-chart"></div>
          <div id="be-table"></div>
        </div>
      </div>`;

    const out = container.querySelector('#be-out');

    function compute() {
      const cur      = container.querySelector('#be-cur').value;
      const fixed    = parseNum(container.querySelector('#be-fixed'));
      const price    = parseNum(container.querySelector('#be-price'));
      const varCost  = parseNum(container.querySelector('#be-var'));
      const expected = parseNum(container.querySelector('#be-expected'));

      const contribution = price - varCost;
      const cmRatio      = price > 0 ? contribution / price : 0;
      const beUnits      = contribution > 0 ? fixed / contribution : Infinity;
      const beRevenue    = beUnits * price;

      const expectedProfit = contribution * expected - fixed;
      const safetyUnits    = expected - beUnits;
      const safetyPct      = expected > 0 ? safetyUnits / expected * 100 : NaN;

      const viable = contribution > 0;

      out.innerHTML = statGrid([
        { value: viable ? num(Math.ceil(beUnits)) : '—', label: 'Units to break even', tone: 'hero' },
        { value: viable ? money(beRevenue, cur) : '—',   label: 'Revenue to break even' },
        { value: money(contribution, cur, { dp: 2 }),    label: 'Contribution per unit', sub: `${pct(cmRatio * 100)} of price` },
        { value: money(expectedProfit, cur),             label: 'Profit at your forecast', tone: expectedProfit >= 0 ? 'good' : 'bad' },
        { value: viable && expected > 0 ? pct(safetyPct) : '—', label: 'Margin of safety', sub: 'how far sales can fall' },
      ]);

      const chartEl = container.querySelector('#be-chart');
      const tableEl = container.querySelector('#be-table');

      if (!viable) {
        chartEl.innerHTML = '';
        tableEl.innerHTML = `<div class="tool-output biz-warn">
          Every unit you sell for ${money(price, cur, { dp: 2 })} costs you
          ${money(varCost, cur, { dp: 2 })} to make, so each sale loses money before
          fixed costs are even considered. There is no break-even point at this price —
          raise the price or cut the variable cost.</div>`;
        return;
      }

      /* --- chart --- */
      const maxUnits = Math.max(Math.ceil(beUnits * 2), expected * 1.2, 10);
      const maxMoney = Math.max(price * maxUnits, fixed + varCost * maxUnits);
      const W = 520, H = 240, PAD = 40;
      const sx = (u) => PAD + (u / maxUnits) * (W - PAD - 12);
      const sy = (m) => H - PAD - (m / maxMoney) * (H - PAD - 14);

      chartEl.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" class="biz-svg" role="img" aria-label="Break-even chart">
          <line x1="${PAD}" y1="${H - PAD}" x2="${W - 8}" y2="${H - PAD}" class="ax"/>
          <line x1="${PAD}" y1="12" x2="${PAD}" y2="${H - PAD}" class="ax"/>

          <polygon points="${sx(0)},${sy(fixed)} ${sx(maxUnits)},${sy(fixed + varCost * maxUnits)} ${sx(maxUnits)},${sy(price * maxUnits)}"
                   class="be-loss" opacity="0.12"/>

          <line x1="${sx(0)}" y1="${sy(fixed)}" x2="${sx(maxUnits)}" y2="${sy(fixed + varCost * maxUnits)}" class="be-cost"/>
          <line x1="${sx(0)}" y1="${sy(0)}"     x2="${sx(maxUnits)}" y2="${sy(price * maxUnits)}"          class="be-rev"/>

          <line x1="${sx(beUnits)}" y1="${sy(0)}" x2="${sx(beUnits)}" y2="${sy(beRevenue)}" class="be-mark"/>
          <circle cx="${sx(beUnits)}" cy="${sy(beRevenue)}" r="4.5" class="be-dot"/>
          <text x="${sx(beUnits)}" y="${sy(beRevenue) - 11}" class="be-lab" text-anchor="middle">break even</text>

          <text x="${PAD - 6}" y="${H - PAD + 4}" class="ax-lab" text-anchor="end">0</text>
          <text x="${W - 8}" y="${H - PAD + 16}" class="ax-lab" text-anchor="end">${num(maxUnits)} units</text>
          <text x="${PAD - 6}" y="18" class="ax-lab" text-anchor="end">${money(maxMoney, cur, { compact: true })}</text>
        </svg>
        <div class="biz-legend">
          <span><i class="sw-rev"></i> Revenue</span>
          <span><i class="sw-cost"></i> Total cost</span>
        </div>`;

      /* --- sensitivity table --- */
      const steps = [0.5, 0.75, 1, 1.25, 1.5].map(f => Math.round(expected * f));
      tableEl.innerHTML = dataTable(
        ['Units sold', { label: 'Revenue', align: 'right' }, { label: 'Total cost', align: 'right' }, { label: 'Profit', align: 'right' }],
        [...new Set(steps)].filter(u => u >= 0).sort((a, b) => a - b).map(u => {
          const rev = price * u;
          const cost = fixed + varCost * u;
          const p = rev - cost;
          return {
            emphasis: u === Math.round(expected),
            cells: [num(u), money(rev, cur), money(cost, cur),
                    `<span class="${p >= 0 ? 'biz-pos' : 'biz-neg'}">${money(p, cur)}</span>`],
          };
        }),
        { caption: 'What happens if sales come in above or below forecast' }
      );
    }

    liveCompute(container, compute);
  },
  destroy() {},
};
