import { currencySelect, field, statGrid, dataTable, money, num, pct, months, parseNum, liveCompute } from '../lib/biz.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          <div class="biz-field">
            <label class="tool-label" for="ue-cur">Currency</label>
            ${currencySelect('ue-cur')}
          </div>
          ${field('Sales & marketing spend per month', 'ue-spend', 60000, { min: 0 })}
          ${field('New customers won per month', 'ue-new', 40, { min: 0, step: 1 })}
          ${field('Average revenue per customer per month', 'ue-arpu', 220, { min: 0 })}
          ${field('Gross margin', 'ue-margin', 78, { min: 0, max: 100, step: 0.5, suffix: '%', hint: 'Revenue left after the direct cost of serving that customer.' })}
          ${field('Monthly customer churn', 'ue-churn', 3, { min: 0.01, max: 100, step: 0.1, suffix: '%', hint: 'Share of customers who leave each month.' })}
        </div>

        <div class="tool-section">
          <div id="ue-out"></div>
          <div id="ue-verdict"></div>
          <div id="ue-table"></div>
        </div>
      </div>`;

    const out = container.querySelector('#ue-out');

    function compute() {
      const cur    = container.querySelector('#ue-cur').value;
      const spend  = parseNum(container.querySelector('#ue-spend'));
      const newCus = parseNum(container.querySelector('#ue-new'));
      const arpu   = parseNum(container.querySelector('#ue-arpu'));
      const margin = parseNum(container.querySelector('#ue-margin')) / 100;
      const churn  = Math.max(parseNum(container.querySelector('#ue-churn')) / 100, 0.0001);

      const cac       = newCus > 0 ? spend / newCus : NaN;
      const lifetime  = 1 / churn;                      // expected months before they leave
      const grossPerM = arpu * margin;
      const ltv       = grossPerM * lifetime;
      const ratio     = cac > 0 ? ltv / cac : NaN;
      const payback   = grossPerM > 0 ? cac / grossPerM : NaN;
      const annualChurn = (1 - Math.pow(1 - churn, 12)) * 100;

      out.innerHTML = statGrid([
        { value: money(cac, cur), label: 'CAC', sub: 'cost to win one customer' },
        { value: money(ltv, cur), label: 'LTV', sub: 'gross profit over their life', tone: 'hero' },
        { value: Number.isFinite(ratio) ? `${ratio.toFixed(1)}×` : '—', label: 'LTV : CAC',
          tone: ratio >= 3 ? 'good' : (ratio < 1 ? 'bad' : null) },
        { value: Number.isFinite(payback) ? months(payback) : '—', label: 'CAC payback',
          tone: payback <= 12 ? 'good' : (payback > 24 ? 'bad' : null) },
        { value: months(lifetime), label: 'Average customer life' },
        { value: pct(annualChurn), label: 'Annual churn' },
      ]);

      let verdict, tone;
      if (!Number.isFinite(ratio)) {
        verdict = 'Enter a spend and a number of new customers to see the ratios.';
        tone = 'biz-explain';
      } else if (ratio < 1) {
        tone = 'biz-warn';
        verdict = `You are paying <strong>${money(cac, cur)}</strong> to acquire a customer who
          only ever returns <strong>${money(ltv, cur)}</strong> in gross profit. Every new
          customer makes the hole deeper. Growth will not fix this — the unit economics have
          to change first.`;
      } else if (ratio < 3) {
        tone = 'biz-explain';
        verdict = `A ratio of <strong>${ratio.toFixed(1)}×</strong> works, but it is thin.
          The usual benchmark is 3× or better, because CAC tends to rise as you exhaust the
          easiest customers. Reducing churn is normally the cheapest lever: dropping churn from
          ${pct(churn * 100)} to ${pct(churn * 100 * 0.7)} would take LTV to
          <strong>${money(grossPerM / (churn * 0.7), cur)}</strong>.`;
      } else {
        tone = 'biz-good';
        verdict = `<strong>${ratio.toFixed(1)}×</strong> is healthy — comfortably above the 3×
          benchmark. You recover the acquisition cost in <strong>${months(payback)}</strong>.
          ${payback <= 12
            ? 'Under twelve months means growth largely funds itself.'
            : 'Over twelve months means growth needs financing even though each customer is profitable.'}`;
      }
      container.querySelector('#ue-verdict').innerHTML = `<div class="tool-output ${tone}">${verdict}</div>`;

      /* What happens if churn moves — usually the most sensitive input. */
      const scenarios = [0.5, 0.75, 1, 1.5, 2].map(f => {
        const c = churn * f;
        const life = 1 / c;
        const v = grossPerM * life;
        return {
          emphasis: f === 1,
          cells: [pct(c * 100), months(life), money(v, cur),
                  Number.isFinite(cac) && cac > 0
                    ? `<span class="${v / cac >= 3 ? 'biz-pos' : (v / cac < 1 ? 'biz-neg' : '')}">${(v / cac).toFixed(1)}×</span>`
                    : '—'],
        };
      });

      container.querySelector('#ue-table').innerHTML = dataTable(
        ['Monthly churn', 'Customer life', { label: 'LTV', align: 'right' }, { label: 'LTV : CAC', align: 'right' }],
        scenarios,
        { caption: 'Churn is the input that moves LTV the most' }
      );
    }

    liveCompute(container, compute);
  },
  destroy() {},
};
