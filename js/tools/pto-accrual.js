import { field, selectField, statGrid, dataTable, num, pct, parseNum, liveCompute } from '../lib/biz.js';

const FREQ = [
  { value: '12', label: 'Monthly' },
  { value: '26', label: 'Every two weeks' },
  { value: '24', label: 'Twice a month' },
  { value: '52', label: 'Weekly' },
];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          ${field('Annual entitlement', 'pto-annual', 25, { min: 0, max: 365, step: 0.5, suffix: 'days', hint: 'Your full allowance for the year, not counting public holidays.' })}
          ${selectField('How it builds up', 'pto-freq', FREQ, '12')}
          ${field('Carried over from last year', 'pto-carry', 3, { min: 0, step: 0.5, suffix: 'days' })}
          ${field('Days already taken', 'pto-taken', 9, { min: 0, step: 0.5, suffix: 'days' })}
          ${field('Days already booked', 'pto-booked', 5, { min: 0, step: 0.5, suffix: 'days', hint: 'Approved but not yet taken.' })}
          ${field('Months into the leave year', 'pto-elapsed', new Date().getMonth() + 1, { min: 0, max: 12, step: 1, hint: 'How far through the year you are now.' })}
          ${field('Maximum you may carry over', 'pto-cap', 5, { min: 0, step: 0.5, suffix: 'days', hint: 'Anything above this is lost at year end. Set to 0 for use-it-or-lose-it.' })}
        </div>

        <div class="tool-section">
          <div id="pto-out"></div>
          <div id="pto-verdict"></div>
          <div id="pto-table"></div>
        </div>
      </div>`;

    const out = container.querySelector('#pto-out');

    function compute() {
      const annual  = parseNum(container.querySelector('#pto-annual'));
      const freq    = parseNum(container.querySelector('#pto-freq'), 12);
      const carry   = parseNum(container.querySelector('#pto-carry'));
      const taken   = parseNum(container.querySelector('#pto-taken'));
      const booked  = parseNum(container.querySelector('#pto-booked'));
      const elapsed = Math.min(Math.max(parseNum(container.querySelector('#pto-elapsed')), 0), 12);
      const cap     = parseNum(container.querySelector('#pto-cap'));

      const perPeriod   = freq > 0 ? annual / freq : 0;
      const periodsDone = Math.floor(freq * (elapsed / 12));
      const accrued     = perPeriod * periodsDone;

      const availableNow = carry + accrued - taken - booked;
      const endOfYear    = carry + annual - taken - booked;
      const lost         = Math.max(endOfYear - cap, 0);

      out.innerHTML = statGrid([
        { value: `${num(availableNow, 1)}`, label: 'Available right now', tone: availableNow < 0 ? 'bad' : 'hero',
          sub: 'accrued, less taken and booked' },
        { value: `${num(accrued, 1)}`, label: 'Accrued so far' },
        { value: `${num(taken + booked, 1)}`, label: 'Taken or booked' },
        { value: `${num(endOfYear, 1)}`, label: 'Left at year end' },
        { value: `${num(perPeriod, 2)}`, label: `Earned each ${FREQ.find(f => f.value === String(freq))?.label.toLowerCase() ?? 'period'}` },
        { value: pct(annual > 0 ? (taken + booked) / annual * 100 : NaN), label: 'Entitlement used' },
      ]);

      const verdict = container.querySelector('#pto-verdict');
      if (availableNow < 0) {
        verdict.innerHTML = `<div class="tool-output biz-warn">
          You have committed <strong>${num(Math.abs(availableNow), 1)} days</strong> more than you
          have accrued so far. That is usually fine if you will earn it back by the time the leave
          falls — but if you left the company today, it would normally be deducted from your final pay.</div>`;
      } else if (lost > 0) {
        verdict.innerHTML = `<div class="tool-output biz-warn">
          You are on course to finish the year with <strong>${num(endOfYear, 1)} days</strong> unused,
          but you can only carry <strong>${num(cap, 1)}</strong> forward — so
          <strong>${num(lost, 1)} days</strong> would simply disappear.
          To use them all you would need to book roughly
          <strong>${num(lost / Math.max(12 - elapsed, 1), 1)} days a month</strong> for the rest of the year.</div>`;
      } else {
        verdict.innerHTML = `<div class="tool-output biz-good">
          On track. You will finish the year with <strong>${num(endOfYear, 1)} days</strong> left,
          all of which fits inside your <strong>${num(cap, 1)} day</strong> carry-over allowance.</div>`;
      }

      const rows = [];
      let running = carry;
      for (let m = 1; m <= 12; m++) {
        const periods = Math.floor(freq * (m / 12)) - Math.floor(freq * ((m - 1) / 12));
        running += perPeriod * periods;
        rows.push({
          emphasis: m === Math.ceil(elapsed) && elapsed > 0,
          cells: [MONTH_NAMES[m - 1], num(perPeriod * periods, 2), num(running, 1)],
        });
      }

      container.querySelector('#pto-table').innerHTML = dataTable(
        ['Month', { label: 'Earned', align: 'right' }, { label: 'Total accrued', align: 'right' }],
        rows,
        { caption: 'Accrual through the year, before any leave is taken', maxHeight: '300px' }
      );
    }

    liveCompute(container, compute);
  },
  destroy() {},
};
