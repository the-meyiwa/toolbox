import { currencySelect, field, statGrid, dataTable, money, num, pct, parseNum, liveCompute } from '../lib/biz.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          <div class="biz-field">
            <label class="tool-label" for="pc-cur">Currency</label>
            ${currencySelect('pc-cur')}
          </div>
          ${field('Gross salary', 'pc-salary', 65000, { min: 0, suffix: 'per year' })}
          ${field('Employer payroll tax', 'pc-tax', 13.8, { min: 0, max: 60, step: 0.1, suffix: '%', hint: 'Employer National Insurance, FICA, social contributions — whatever applies where you are.' })}
          ${field('Pension / retirement contribution', 'pc-pension', 5, { min: 0, max: 40, step: 0.5, suffix: '%' })}
          ${field('Benefits', 'pc-benefits', 3200, { min: 0, suffix: 'per year', hint: 'Health cover, life insurance, perks.' })}
          ${field('Equipment & software', 'pc-equipment', 2400, { min: 0, suffix: 'per year' })}
          ${field('Workspace & overhead', 'pc-overhead', 4800, { min: 0, suffix: 'per year', hint: 'Desk, utilities, admin — the share of running the business this person consumes.' })}
          ${field('One-off recruitment cost', 'pc-recruit', 9750, { min: 0, hint: 'Agency fee or the cost of your own time. Spread over the first year below.' })}
          ${field('Working days a year', 'pc-days', 227, { min: 1, max: 365, step: 1, hint: '260 weekdays less holiday and public holidays.' })}
        </div>

        <div class="tool-section">
          <div id="pc-out"></div>
          <div id="pc-table"></div>
          <div class="tool-output biz-explain" id="pc-note"></div>
        </div>
      </div>`;

    const out = container.querySelector('#pc-out');

    function compute() {
      const cur       = container.querySelector('#pc-cur').value;
      const salary    = parseNum(container.querySelector('#pc-salary'));
      const taxPct    = parseNum(container.querySelector('#pc-tax')) / 100;
      const pensPct   = parseNum(container.querySelector('#pc-pension')) / 100;
      const benefits  = parseNum(container.querySelector('#pc-benefits'));
      const equipment = parseNum(container.querySelector('#pc-equipment'));
      const overhead  = parseNum(container.querySelector('#pc-overhead'));
      const recruit   = parseNum(container.querySelector('#pc-recruit'));
      const days      = Math.max(parseNum(container.querySelector('#pc-days'), 1), 1);

      const tax     = salary * taxPct;
      const pension = salary * pensPct;

      const ongoing   = salary + tax + pension + benefits + equipment + overhead;
      const firstYear = ongoing + recruit;

      const multiplier = salary > 0 ? ongoing / salary : NaN;
      const perDay     = ongoing / days;
      const perHour    = perDay / 7.5;

      out.innerHTML = statGrid([
        { value: money(ongoing, cur),        label: 'True annual cost', tone: 'hero' },
        { value: money(firstYear, cur),      label: 'First year (with hiring)', tone: 'bad' },
        { value: money(ongoing / 12, cur),   label: 'Per month' },
        { value: money(perDay, cur),         label: 'Per working day' },
        { value: money(perHour, cur, { dp: 2 }), label: 'Per hour', sub: '7.5 hour day' },
        { value: Number.isFinite(multiplier) ? `${multiplier.toFixed(2)}×` : '—', label: 'Cost multiplier', sub: 'vs. their salary' },
      ]);

      const rows = [
        ['Gross salary', money(salary, cur), pct(ongoing > 0 ? salary / ongoing * 100 : NaN)],
        ['Employer payroll tax', money(tax, cur), pct(ongoing > 0 ? tax / ongoing * 100 : NaN)],
        ['Pension contribution', money(pension, cur), pct(ongoing > 0 ? pension / ongoing * 100 : NaN)],
        ['Benefits', money(benefits, cur), pct(ongoing > 0 ? benefits / ongoing * 100 : NaN)],
        ['Equipment & software', money(equipment, cur), pct(ongoing > 0 ? equipment / ongoing * 100 : NaN)],
        ['Workspace & overhead', money(overhead, cur), pct(ongoing > 0 ? overhead / ongoing * 100 : NaN)],
      ];

      container.querySelector('#pc-table').innerHTML = dataTable(
        ['Cost', { label: 'Amount', align: 'right' }, { label: 'Share', align: 'right' }],
        [...rows, { emphasis: true, cells: ['<strong>Ongoing total</strong>', `<strong>${money(ongoing, cur)}</strong>`, '100%'] }],
        { caption: 'Where the money actually goes' }
      );

      container.querySelector('#pc-note').innerHTML = `
        A salary is rarely more than about ${pct(ongoing > 0 ? salary / ongoing * 100 : NaN)} of what
        an employee costs. Budgeting on salary alone is the single most common way headcount plans
        go wrong — on these numbers you would be understating each hire by
        <strong>${money(ongoing - salary, cur)}</strong> a year.
        ${recruit > 0 ? `<br><br>Recruitment adds <strong>${money(recruit, cur)}</strong> in year one,
        which is why churn in the first year is so expensive.` : ''}`;
    }

    liveCompute(container, compute);
  },
  destroy() {},
};
