import { currencySelect, field, selectField, statGrid, dataTable, money, num, pct, parseNum, liveCompute, downloadCSV } from '../lib/biz.js';

const METHODS = [
  { value: 'sl',   label: 'Straight line — same amount every year' },
  { value: 'ddb',  label: 'Declining balance — faster at the start' },
  { value: 'syd',  label: 'Sum of the years’ digits' },
  { value: 'units', label: 'Units of production — based on usage' },
];

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          <div class="biz-field">
            <label class="tool-label" for="dep-cur">Currency</label>
            ${currencySelect('dep-cur')}
          </div>
          ${selectField('Method', 'dep-method', METHODS, 'sl')}
          ${field('Purchase cost', 'dep-cost', 50000, { min: 0 })}
          ${field('Salvage value at the end', 'dep-salvage', 5000, { min: 0, hint: 'What you expect it to still be worth when you are finished with it.' })}
          ${field('Useful life', 'dep-life', 5, { min: 1, step: 1, suffix: 'years' })}
          <div id="dep-rate-f">${field('Declining balance factor', 'dep-factor', 2, { min: 1, max: 4, step: 0.25, hint: '2 is “double declining”, the most common choice.' })}</div>
          <div id="dep-units-f" hidden>
            ${field('Total units over its life', 'dep-total-units', 100000, { min: 1, step: 1 })}
            ${field('Units used per year', 'dep-units-year', 20000, { min: 0, step: 1 })}
          </div>
          <button class="btn btn-secondary btn-sm" id="dep-csv" style="margin-top:18px;">Download as CSV</button>
        </div>

        <div class="tool-section">
          <div id="dep-out"></div>
          <div id="dep-table"></div>
        </div>
      </div>`;

    let lastSchedule = [];
    const out = container.querySelector('#dep-out');

    function buildSchedule({ method, cost, salvage, life, factor, totalUnits, unitsYear }) {
      const rows = [];
      const depreciable = Math.max(cost - salvage, 0);
      let book = cost;

      for (let year = 1; year <= life; year++) {
        let charge;

        if (method === 'sl') {
          charge = depreciable / life;
        } else if (method === 'ddb') {
          charge = book * (factor / life);
          // Never depreciate below salvage value.
          charge = Math.min(charge, Math.max(book - salvage, 0));
        } else if (method === 'syd') {
          const sumDigits = (life * (life + 1)) / 2;
          charge = depreciable * ((life - year + 1) / sumDigits);
        } else {
          const perUnit = totalUnits > 0 ? depreciable / totalUnits : 0;
          charge = Math.min(perUnit * unitsYear, Math.max(book - salvage, 0));
        }

        charge = Math.max(Math.min(charge, Math.max(book - salvage, 0)), 0);
        const opening = book;
        book -= charge;
        rows.push({ year, opening, charge, closing: book });
      }
      return rows;
    }

    function compute() {
      const cur    = container.querySelector('#dep-cur').value;
      const method = container.querySelector('#dep-method').value;

      container.querySelector('#dep-rate-f').hidden  = method !== 'ddb';
      container.querySelector('#dep-units-f').hidden = method !== 'units';

      const cost       = parseNum(container.querySelector('#dep-cost'));
      const salvage    = parseNum(container.querySelector('#dep-salvage'));
      const life       = Math.max(Math.round(parseNum(container.querySelector('#dep-life'), 1)), 1);
      const factor     = parseNum(container.querySelector('#dep-factor'), 2);
      const totalUnits = parseNum(container.querySelector('#dep-total-units'), 1);
      const unitsYear  = parseNum(container.querySelector('#dep-units-year'));

      const rows = buildSchedule({ method, cost, salvage, life, factor, totalUnits, unitsYear });
      lastSchedule = rows;

      const totalCharged = rows.reduce((s, r) => s + r.charge, 0);
      const endBook      = rows.length ? rows[rows.length - 1].closing : cost;
      const firstYear    = rows[0]?.charge ?? 0;

      out.innerHTML = statGrid([
        { value: money(firstYear, cur),          label: 'Year 1 charge', tone: 'hero' },
        { value: money(totalCharged / life, cur), label: 'Average per year' },
        { value: money(totalCharged, cur),        label: 'Total depreciated' },
        { value: money(endBook, cur),             label: `Book value after ${life}y` },
        { value: pct(cost > 0 ? firstYear / cost * 100 : NaN), label: 'Year 1 as % of cost' },
      ]);

      container.querySelector('#dep-table').innerHTML = dataTable(
        ['Year',
         { label: 'Opening value', align: 'right' },
         { label: 'Depreciation', align: 'right' },
         { label: 'Closing value', align: 'right' }],
        rows.map(r => [num(r.year), money(r.opening, cur), money(r.charge, cur), money(r.closing, cur)]),
        { caption: METHODS.find(m => m.value === method).label, maxHeight: '340px' }
      );

      if (salvage > cost) {
        container.querySelector('#dep-table').insertAdjacentHTML('afterbegin',
          `<div class="tool-output biz-warn">Salvage value is higher than the purchase cost,
           so there is nothing to depreciate.</div>`);
      }
    }

    container.querySelector('#dep-csv').addEventListener('click', () => {
      const cur = container.querySelector('#dep-cur').value;
      downloadCSV('depreciation-schedule',
        ['Year', `Opening (${cur})`, `Depreciation (${cur})`, `Closing (${cur})`],
        lastSchedule.map(r => [r.year, r.opening.toFixed(2), r.charge.toFixed(2), r.closing.toFixed(2)]));
    });

    liveCompute(container, compute);
  },
  destroy() {},
};
