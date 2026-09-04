import { currencySelect, statGrid, dataTable, money, num, pct, parseNum, escapeHtml, downloadCSV } from '../lib/biz.js';

let uid = 0;

const BLANK = () => ({ id: ++uid, date: new Date().toISOString().slice(0, 10), client: '', task: '', hours: 0, rate: 0, billable: true });

export default {
  render(container) {
    const state = {
      entries: [
        { id: ++uid, date: new Date().toISOString().slice(0, 10), client: 'Northwind', task: 'Discovery workshop', hours: 6, rate: 95, billable: true },
        { id: ++uid, date: new Date().toISOString().slice(0, 10), client: 'Northwind', task: 'Write-up', hours: 2.5, rate: 95, billable: true },
        { id: ++uid, date: new Date().toISOString().slice(0, 10), client: 'Internal', task: 'Team meeting', hours: 1, rate: 0, billable: false },
      ],
      defaultRate: 95,
    };

    container.innerHTML = `
      <div class="tool-section ts-controls">
        <div class="biz-field">
          <label class="tool-label" for="ts-cur">Currency</label>
          ${currencySelect('ts-cur')}
        </div>
        <div class="biz-field">
          <label class="tool-label" for="ts-rate">Default hourly rate</label>
          <input type="number" class="tool-input" id="ts-rate" value="${state.defaultRate}" min="0" step="5">
        </div>
      </div>

      <div class="ts-table-head">
        <span>Date</span><span>Client</span><span>Task</span>
        <span class="ta-right">Hours</span><span class="ta-right">Rate</span><span>Bill</span><span></span>
      </div>
      <div id="ts-rows"></div>

      <div class="tool-controls" style="margin-top:14px;">
        <button class="btn btn-secondary btn-sm" id="ts-add">Add a line</button>
        <button class="btn btn-secondary btn-sm" id="ts-csv">Download as CSV</button>
        <button class="btn btn-secondary btn-sm" id="ts-clear">Clear all</button>
      </div>

      <div id="ts-out" style="margin-top:26px;"></div>
      <div id="ts-by-client"></div>`;

    const rowsEl = container.querySelector('#ts-rows');

    function renderRows() {
      rowsEl.innerHTML = state.entries.map(e => `
        <div class="ts-row" data-id="${e.id}">
          <input type="date"   class="tool-input" data-k="date"   value="${e.date}">
          <input type="text"   class="tool-input" data-k="client" value="${escapeHtml(e.client)}" placeholder="Client">
          <input type="text"   class="tool-input" data-k="task"   value="${escapeHtml(e.task)}"   placeholder="What you did">
          <input type="number" class="tool-input ta-right" data-k="hours" value="${e.hours}" min="0" step="0.25">
          <input type="number" class="tool-input ta-right" data-k="rate"  value="${e.rate}"  min="0" step="5">
          <label class="ts-bill"><input type="checkbox" data-k="billable" ${e.billable ? 'checked' : ''}></label>
          <button class="ct-del" data-del="${e.id}" aria-label="Remove line">×</button>
        </div>`).join('');
    }

    function compute() {
      const cur = container.querySelector('#ts-cur').value;

      const billable    = state.entries.filter(e => e.billable);
      const totalHours  = state.entries.reduce((s, e) => s + Math.max(e.hours, 0), 0);
      const billHours   = billable.reduce((s, e) => s + Math.max(e.hours, 0), 0);
      const revenue     = billable.reduce((s, e) => s + Math.max(e.hours, 0) * Math.max(e.rate, 0), 0);
      const utilisation = totalHours > 0 ? billHours / totalHours * 100 : NaN;
      const effective   = totalHours > 0 ? revenue / totalHours : NaN;

      container.querySelector('#ts-out').innerHTML = statGrid([
        { value: money(revenue, cur), label: 'To invoice', tone: 'hero' },
        { value: `${num(billHours, 2)} h`, label: 'Billable hours' },
        { value: `${num(totalHours, 2)} h`, label: 'Total hours logged' },
        { value: pct(utilisation), label: 'Utilisation', tone: utilisation >= 70 ? 'good' : (utilisation < 50 ? 'bad' : null) },
        { value: money(effective, cur, { dp: 2 }), label: 'Effective rate', sub: 'across every hour worked' },
      ]);

      const byClient = new Map();
      for (const e of state.entries) {
        const key = e.client.trim() || 'Unassigned';
        const cur_ = byClient.get(key) || { hours: 0, billHours: 0, amount: 0 };
        cur_.hours += Math.max(e.hours, 0);
        if (e.billable) {
          cur_.billHours += Math.max(e.hours, 0);
          cur_.amount += Math.max(e.hours, 0) * Math.max(e.rate, 0);
        }
        byClient.set(key, cur_);
      }

      container.querySelector('#ts-by-client').innerHTML = dataTable(
        ['Client',
         { label: 'Hours', align: 'right' },
         { label: 'Billable', align: 'right' },
         { label: 'Amount', align: 'right' }],
        [...byClient.entries()]
          .sort((a, b) => b[1].amount - a[1].amount)
          .map(([name, v]) => [escapeHtml(name), num(v.hours, 2), num(v.billHours, 2), money(v.amount, cur)]),
        { caption: 'By client' }
      );
    }

    function refresh() { renderRows(); compute(); }

    container.addEventListener('input', (e) => {
      const k = e.target.dataset.k;
      if (k) {
        const row = e.target.closest('[data-id]');
        const entry = state.entries.find(x => x.id === Number(row.dataset.id));
        if (!entry) return;
        entry[k] = k === 'billable' ? e.target.checked
                 : (k === 'hours' || k === 'rate') ? parseNum(e.target)
                 : e.target.value;
        compute();     // deliberately not re-rendering: it would steal focus
        return;
      }
      if (e.target.id === 'ts-rate') state.defaultRate = parseNum(e.target);
      if (e.target.id === 'ts-cur') compute();
    });

    container.addEventListener('change', (e) => {
      if (e.target.dataset.k === 'billable' || e.target.id === 'ts-cur') compute();
    });

    container.addEventListener('click', (e) => {
      if (e.target.id === 'ts-add') {
        const row = BLANK();
        row.rate = state.defaultRate;
        state.entries.push(row);
        refresh();
      } else if (e.target.id === 'ts-clear') {
        state.entries = [BLANK()];
        refresh();
      } else if (e.target.id === 'ts-csv') {
        const cur = container.querySelector('#ts-cur').value;
        downloadCSV('timesheet',
          ['Date', 'Client', 'Task', 'Hours', `Rate (${cur})`, 'Billable', `Amount (${cur})`],
          state.entries.map(x => [x.date, x.client, x.task, x.hours, x.rate,
                                  x.billable ? 'yes' : 'no',
                                  (x.billable ? x.hours * x.rate : 0).toFixed(2)]));
      } else if (e.target.dataset.del) {
        state.entries = state.entries.filter(x => x.id !== Number(e.target.dataset.del));
        if (!state.entries.length) state.entries = [BLANK()];
        refresh();
      }
    });

    this._state = state;
    this._getCur = () => container.querySelector('#ts-cur')?.value || 'USD';
    refresh();
  },

  getArtifact() {
    if (!this._state?.entries) return null;
    const cur = this._getCur?.() || 'USD';
    const rows = [
      ['Date', 'Client', 'Task', 'Hours', `Rate (${cur})`, 'Billable', `Amount (${cur})`],
      ...this._state.entries.map(x => [
        x.date, x.client, x.task, x.hours, x.rate,
        x.billable ? 'yes' : 'no',
        (x.billable ? x.hours * x.rate : 0).toFixed(2)
      ])
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    return {
      kind: 'csv',
      name: 'timesheet.csv',
      text: csv,
    };
  },

  destroy() {
    this._state = null;
    this._getCur = null;
  },
};
