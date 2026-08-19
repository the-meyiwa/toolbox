import { currencySelect, field, statGrid, dataTable, money, num, months, parseNum, liveCompute, downloadCSV } from '../lib/biz.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          <div class="biz-field">
            <label class="tool-label" for="am-cur">Currency</label>
            ${currencySelect('am-cur')}
          </div>
          ${field('Amount borrowed', 'am-principal', 250000, { min: 0 })}
          ${field('Annual interest rate', 'am-rate', 6.5, { min: 0, max: 100, step: 0.05, suffix: '%' })}
          ${field('Term', 'am-years', 25, { min: 1, max: 50, step: 1, suffix: 'years' })}
          ${field('Extra payment each month', 'am-extra', 0, { min: 0, hint: 'Optional. Even a small amount here changes the total dramatically — try it.' })}
          <button class="btn btn-secondary btn-sm" id="am-csv" style="margin-top:18px;">Download full schedule</button>
        </div>

        <div class="tool-section">
          <div id="am-out"></div>
          <div id="am-note"></div>
          <div id="am-table"></div>
        </div>
      </div>`;

    let schedule = [];
    const out = container.querySelector('#am-out');

    /* Standard amortising loan. Payments are applied monthly; any extra
       goes straight against principal, which is what shortens the term. */
    function amortise(principal, annualRate, years, extra) {
      const n = Math.round(years * 12);
      const i = annualRate / 100 / 12;

      const base = i > 0
        ? principal * i * Math.pow(1 + i, n) / (Math.pow(1 + i, n) - 1)
        : principal / n;

      if (!Number.isFinite(base) || base <= 0) return { base: 0, rows: [] };

      const rows = [];
      let balance = principal;
      let totalInterest = 0;

      // Cap iterations so a pathological rate cannot spin forever.
      for (let m = 1; m <= n && balance > 0.005 && m <= 1200; m++) {
        const interest = balance * i;
        let principalPart = base + extra - interest;
        if (principalPart > balance) principalPart = balance;
        const payment = principalPart + interest;

        balance -= principalPart;
        totalInterest += interest;
        rows.push({ m, payment, interest, principalPart, balance: Math.max(balance, 0) });
      }
      return { base, rows, totalInterest };
    }

    function compute() {
      const cur       = container.querySelector('#am-cur').value;
      const principal = parseNum(container.querySelector('#am-principal'));
      const rate      = parseNum(container.querySelector('#am-rate'));
      const years     = Math.max(parseNum(container.querySelector('#am-years'), 1), 0.1);
      const extra     = parseNum(container.querySelector('#am-extra'));

      const plain = amortise(principal, rate, years, 0);
      const withExtra = extra > 0 ? amortise(principal, rate, years, extra) : plain;
      schedule = withExtra.rows;

      const totalPaid = withExtra.rows.reduce((s, r) => s + r.payment, 0);
      const saved     = plain.totalInterest - withExtra.totalInterest;
      const monthsCut = plain.rows.length - withExtra.rows.length;

      out.innerHTML = statGrid([
        { value: money(withExtra.base + extra, cur, { dp: 2 }), label: 'Monthly payment', tone: 'hero',
          sub: extra > 0 ? `${money(withExtra.base, cur, { dp: 2 })} + ${money(extra, cur, { dp: 2 })} extra` : null },
        { value: money(withExtra.totalInterest, cur), label: 'Total interest', tone: 'bad' },
        { value: money(totalPaid, cur),               label: 'Total repaid' },
        { value: months(withExtra.rows.length),       label: 'Paid off in' },
      ]);

      container.querySelector('#am-note').innerHTML = extra > 0 && monthsCut > 0
        ? `<div class="tool-output biz-good">
             Paying an extra <strong>${money(extra, cur, { dp: 2 })}</strong> a month clears the
             loan <strong>${months(monthsCut)}</strong> early and saves
             <strong>${money(saved, cur)}</strong> in interest.
           </div>`
        : `<div class="tool-output biz-explain">
             Interest is <strong>${money(withExtra.totalInterest, cur)}</strong> —
             ${totalPaid > 0 ? ((withExtra.totalInterest / totalPaid) * 100).toFixed(1) : '0'}%
             of everything you will pay. Early payments are almost all interest; that flips
             as the balance falls.
           </div>`;

      // Yearly summary keeps the table readable; the CSV has every month.
      const byYear = [];
      for (let y = 0; y * 12 < schedule.length; y++) {
        const slice = schedule.slice(y * 12, y * 12 + 12);
        byYear.push({
          year: y + 1,
          interest: slice.reduce((s, r) => s + r.interest, 0),
          principal: slice.reduce((s, r) => s + r.principalPart, 0),
          balance: slice[slice.length - 1].balance,
        });
      }

      container.querySelector('#am-table').innerHTML = dataTable(
        ['Year',
         { label: 'Interest paid', align: 'right' },
         { label: 'Principal paid', align: 'right' },
         { label: 'Balance left', align: 'right' }],
        byYear.map(r => [num(r.year), money(r.interest, cur), money(r.principal, cur), money(r.balance, cur)]),
        { caption: 'Year by year — download the CSV for every single payment', maxHeight: '320px' }
      );
    }

    container.querySelector('#am-csv').addEventListener('click', () => {
      const cur = container.querySelector('#am-cur').value;
      downloadCSV('amortization-schedule',
        ['Payment', `Payment (${cur})`, `Interest (${cur})`, `Principal (${cur})`, `Balance (${cur})`],
        schedule.map(r => [r.m, r.payment.toFixed(2), r.interest.toFixed(2), r.principalPart.toFixed(2), r.balance.toFixed(2)]));
    });

    liveCompute(container, compute);
  },
  destroy() {},
};
