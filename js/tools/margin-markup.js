import { currencySelect, field, statGrid, money, pct, parseNum, liveCompute } from '../lib/biz.js';

/* Margin and markup are the two most commonly confused numbers in
   pricing: a 50% markup is a 33.3% margin. This tool solves from
   whichever pair you actually know. */

const SOLVE_FOR = [
  { value: 'price',  label: 'I know cost and margin — what price?' },
  { value: 'margin', label: 'I know cost and price — what margin?' },
  { value: 'cost',   label: 'I know price and margin — what cost?' },
];

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          <div class="biz-field">
            <label class="tool-label" for="mm-cur">Currency</label>
            ${currencySelect('mm-cur')}
          </div>

          <div class="biz-field">
            <label class="tool-label" for="mm-solve">What are you working out?</label>
            <select class="tool-select" id="mm-solve">
              ${SOLVE_FOR.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}
            </select>
          </div>

          <div id="mm-cost-f">${field('Cost to you', 'mm-cost', 60, { min: 0 })}</div>
          <div id="mm-price-f" hidden>${field('Selling price', 'mm-price', 100, { min: 0 })}</div>
          <div id="mm-margin-f">${field('Gross margin you want', 'mm-margin', 40, { min: 0, max: 99.9, step: 0.1, suffix: '%' })}</div>

          <div class="tool-controls" style="margin-top:20px;">
            <button class="btn btn-secondary btn-sm" data-preset="30">30% margin</button>
            <button class="btn btn-secondary btn-sm" data-preset="50">50% margin</button>
            <button class="btn btn-secondary btn-sm" data-preset="60">60% margin</button>
          </div>
        </div>

        <div class="tool-section">
          <div id="mm-out"></div>
          <div class="tool-output biz-explain" id="mm-explain"></div>
        </div>
      </div>`;

    const out     = container.querySelector('#mm-out');
    const explain = container.querySelector('#mm-explain');
    const solveEl = container.querySelector('#mm-solve');

    function compute() {
      const cur   = container.querySelector('#mm-cur').value;
      const solve = solveEl.value;

      // Show only the two inputs the chosen calculation needs.
      container.querySelector('#mm-cost-f').hidden   = solve === 'cost';
      container.querySelector('#mm-price-f').hidden  = solve === 'price';
      container.querySelector('#mm-margin-f').hidden = solve === 'margin';

      let cost   = parseNum(container.querySelector('#mm-cost'));
      let price  = parseNum(container.querySelector('#mm-price'));
      let margin = parseNum(container.querySelector('#mm-margin'));

      if (solve === 'price') {
        price = margin >= 100 ? NaN : cost / (1 - margin / 100);
      } else if (solve === 'cost') {
        cost = price * (1 - margin / 100);
      } else {
        margin = price > 0 ? (price - cost) / price * 100 : NaN;
      }

      const profit = price - cost;
      const markup = cost > 0 ? profit / cost * 100 : NaN;

      out.innerHTML = statGrid([
        { value: money(cost, cur, { dp: 2 }),   label: 'Cost' },
        { value: money(price, cur, { dp: 2 }),  label: 'Selling price', tone: 'hero' },
        { value: money(profit, cur, { dp: 2 }), label: 'Profit per unit', tone: profit >= 0 ? 'good' : 'bad' },
        { value: pct(margin),                   label: 'Gross margin', sub: 'profit ÷ price' },
        { value: pct(markup),                   label: 'Markup', sub: 'profit ÷ cost' },
      ]);

      explain.innerHTML = `
        <strong>Margin and markup are not the same number.</strong><br>
        Here you are adding <strong>${pct(markup)}</strong> on top of your cost,
        which leaves you a <strong>${pct(margin)}</strong> margin on the price you charge.
        <br><br>
        <span class="biz-formula">margin = (price − cost) ÷ price&nbsp;&nbsp;·&nbsp;&nbsp;markup = (price − cost) ÷ cost</span>
        <br><br>
        Margin can never reach 100% — that would mean the item cost you nothing.
        Markup has no upper limit.`;
    }

    container.addEventListener('click', (e) => {
      const b = e.target.closest('[data-preset]');
      if (!b) return;
      solveEl.value = 'price';
      container.querySelector('#mm-margin').value = b.dataset.preset;
      compute();
    });

    liveCompute(container, compute);
  },
  destroy() {},
};
