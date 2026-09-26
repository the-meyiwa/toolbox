/* ============================================================
   TOOLBOX — Timesheet & Billables

   A running timer that survives reloads, manual entries, a
   weekly view, totals by client and matter, and one-click
   invoices from unbilled time (opens the Invoice Generator
   with the draft ready and marks the entries invoiced).

   Shares lib/invoicing/store.js with the Invoice Generator, so
   clients and rates are the same in both. Preferences such as
   the billing increment: Preferences → Tools.
   ============================================================ */

import {
  getStore, formatDuration, parseDuration, timeAmount, weekStart, addDays, formatDate, isoDate,
  toMinor, BASE_CURRENCY, roundUpMinutes,
} from '../lib/invoicing/store.js';
import { esc, icon, moneyFmt, minorToInput, openModal, closeModal, downloadText } from '../lib/invoicing/ui.js';
import { getToolSettings, onToolSettings } from '../lib/tool-settings.js';
import { openSettings } from '../lib/settings-ui.js';
import { showToast } from '../utils.js';
import { tbConfirm } from '../lib/dialog.js';

const TOOL_ID = 'timesheet';
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const clock = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const hours = (min) => (min / 60).toFixed(min % 6 === 0 ? 1 : 2);

export default {
  render(container) {
    this.container = container;
    this.store = getStore();
    this.prefs = getToolSettings(TOOL_ID);
    this.money = moneyFmt(getToolSettings('invoice-generator').numberFormat);
    this.state = { week: weekStart(isoDate(), Number(this.prefs.weekStart)), editing: null };

    container.innerHTML = `
      <div class="iv iv-ts">
        <section class="iv-card iv-timer" aria-label="Timer"></section>
        <section class="iv-stats iv-ts-stats"></section>
        <section class="iv-card iv-week">
          <div class="iv-card-head">
            <h3>Week</h3>
            <div class="iv-weeknav">
              <button type="button" class="iv-icon-btn is-boxed" data-act="prev" aria-label="Previous week">${icon('chevL', 16)}</button>
              <span class="iv-weeklabel"></span>
              <button type="button" class="iv-icon-btn is-boxed" data-act="next" aria-label="Next week">${icon('chevR', 16)}</button>
              <button type="button" class="btn btn-ghost btn-sm" data-act="this-week">This week</button>
            </div>
            <div class="iv-btnrow">
              <button type="button" class="btn btn-secondary btn-sm" data-act="add">${icon('plus', 14)}<span>Add time</span></button>
              <button type="button" class="iv-icon-btn" data-act="csv" title="Download this week as CSV" aria-label="Download this week as CSV">${icon('download', 17)}</button>
            </div>
          </div>
          <div class="iv-days"></div>
          <div class="iv-entries"></div>
        </section>
        <section class="iv-card iv-unbilled"></section>
      </div>`;
    this.root = container.querySelector('.iv-ts');

    this.onClick = (e) => this.handleClick(e);
    this.onInput = (e) => this.handleInput(e);
    this.onChange = (e) => this.handleChange(e);
    this.onKey = (e) => { if (e.key === 'Enter' && e.target.closest('.iv-timer') && e.target.tagName === 'INPUT') { e.preventDefault(); this.toggleTimer(); } };
    container.addEventListener('click', this.onClick);
    container.addEventListener('input', this.onInput);
    container.addEventListener('change', this.onChange);
    container.addEventListener('keydown', this.onKey);

    this.offPrefs = onToolSettings(TOOL_ID, (p) => { this.prefs = p; this.renderAll(); });
    this.offStore = this.store.subscribe((what) => { if (!this.muted && (what === 'reload' || what === 'import')) this.renderAll(); });
    this.tick = setInterval(() => this.updateClock(), 1000);
    this.renderAll();
  },

  renderAll() {
    this.renderTimer();
    this.renderWeek();
    this.renderStats();
    this.renderUnbilled();
  },

  clientOptions(selected) {
    const clients = this.store.listClients();
    return `<option value="">No client</option>${clients.map(c => `<option value="${c.id}"${c.id === selected ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}<option value="__new">New client...</option>`;
  },
  matterList() {
    const set = new Set(this.store.listTime().map(e => e.matter).filter(Boolean));
    return `<datalist id="iv-matters">${[...set].slice(0, 60).map(m => `<option value="${esc(m)}">`).join('')}</datalist>`;
  },

  /* ---------------- timer ---------------- */

  renderTimer() {
    const t = this.store.getTimer();
    const cur = t?.currency || this.prefs.currency || BASE_CURRENCY;
    const draft = this.timerDraft || { clientId: '', matter: '', task: '', rate: 0, billable: this.prefs.billable !== false };
    const v = t || draft;
    const el = this.root.querySelector('.iv-timer');
    el.dataset.running = String(Boolean(t));
    el.innerHTML = `
      <div class="iv-timer-fields">
        <div class="iv-field"><label class="tool-label" for="tm-client">Client</label><select class="tool-select" id="tm-client" data-t="clientId">${this.clientOptions(v.clientId)}</select></div>
        <div class="iv-field"><label class="tool-label" for="tm-matter">Matter or project</label><input class="tool-input" id="tm-matter" data-t="matter" value="${esc(v.matter)}" list="iv-matters" placeholder="e.g. Suit FHC/L/CS/123 or Lekki site office"></div>
        <div class="iv-field iv-timer-task"><label class="tool-label" for="tm-task">What are you working on?</label><input class="tool-input" id="tm-task" data-t="task" value="${esc(v.task)}" placeholder="e.g. Drafting statement of claim"></div>
        <div class="iv-field"><label class="tool-label" for="tm-rate">Hourly rate (${cur})</label><input class="tool-input" id="tm-rate" data-t="rate" inputmode="decimal" value="${v.rate ? minorToInput(v.rate) : ''}" placeholder="0"></div>
        <label class="iv-check"><input type="checkbox" data-t="billable" ${v.billable !== false ? 'checked' : ''}><span>Billable</span></label>
      </div>
      <div class="iv-timer-run">
        <div class="iv-clock" aria-live="off">${clock(t ? this.store.timerElapsedMs() : 0)}</div>
        <span class="iv-timer-note">${t ? `Started ${new Date(t.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${Number(this.prefs.increment) ? `; billed in ${this.prefs.increment}-minute units` : ''}` : 'Keeps running if you close the tab'}</span>
        <div class="iv-timer-btns">
          ${t ? `<button type="button" class="btn btn-ghost btn-sm" data-act="discard">Discard</button>` : ''}
          <button type="button" class="btn btn-primary iv-timer-btn" data-act="toggle">${icon(t ? 'stop' : 'play', 16)}<span>${t ? 'Stop and log' : 'Start timer'}</span></button>
        </div>
      </div>
      ${this.matterList()}`;
  },
  updateClock() {
    const t = this.store.getTimer();
    const c = this.root?.querySelector('.iv-clock');
    if (c && t) c.textContent = clock(this.store.timerElapsedMs());
  },
  readTimerFields() {
    const q = (k) => this.root.querySelector(`[data-t="${k}"]`);
    return {
      clientId: q('clientId').value && q('clientId').value !== '__new' ? q('clientId').value : null,
      matter: q('matter').value, task: q('task').value,
      rate: toMinor(q('rate').value), billable: q('billable').checked,
      currency: this.store.getTimer()?.currency || this.prefs.currency || BASE_CURRENCY,
    };
  },
  toggleTimer() {
    if (this.store.getTimer()) {
      this.store.updateTimer(this.readTimerFields());
      const e = this.store.stopTimer({ increment: Number(this.prefs.increment) || 0 });
      this.timerDraft = { clientId: e.clientId, matter: e.matter, task: '', rate: e.rate, billable: e.billable };
      showToast(`Logged ${formatDuration(e.minutes)} h${e.billable && e.rate ? ` (${this.money(timeAmount(e.minutes, e.rate), e.currency)})` : ''}`, 'success');
      this.state.week = weekStart(e.date, Number(this.prefs.weekStart));
    } else {
      this.store.startTimer(this.readTimerFields());
      this.timerDraft = null;
    }
    this.renderAll();
  },

  /* ---------------- week ---------------- */

  weekEntries() {
    const from = this.state.week, to = addDays(from, 6);
    return this.store.listTime({ from, to });
  },

  renderWeek() {
    const from = this.state.week, to = addDays(from, 6);
    const entries = this.weekEntries();
    const today = isoDate();
    const clients = new Map(this.store.listClients().map(c => [c.id, c.name]));
    const invoices = new Map(this.store.listDocs({ type: 'invoice' }).map(d => [d.id, d.number]));
    const nY = (d) => formatDate(d, 'short').replace(/ \d{4}$/, '');
    this.root.querySelector('.iv-weeklabel').innerHTML = `${nY(from)}<i> ${from.slice(0, 4)}</i> to ${nY(to)}<i> ${to.slice(0, 4)}</i>`;

    const perDay = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(from, i);
      const list = entries.filter(e => e.date === date);
      return { date, total: list.reduce((a, e) => a + e.minutes, 0), bill: list.filter(e => e.billable).reduce((a, e) => a + e.minutes, 0) };
    });
    const max = Math.max(480, ...perDay.map(d => d.total));
    this.root.querySelector('.iv-days').innerHTML = perDay.map(d => {
      const dow = new Date(`${d.date}T12:00:00`).getDay();
      return `<div class="iv-day${d.date === today ? ' is-today' : ''}">
        <span class="iv-day-name">${DAY[dow]} <small>${Number(d.date.slice(8))}</small></span>
        <div class="iv-day-bar" title="${formatDuration(d.total)} h logged, ${formatDuration(d.bill)} h billable"><i style="height:${(d.total / max) * 100}%"></i><b style="height:${(d.bill / max) * 100}%"></b></div>
        <span class="iv-day-total">${d.total ? formatDuration(d.total) : '–'}</span>
      </div>`;
    }).join('');

    const byDay = new Map();
    for (const e of entries) { if (!byDay.has(e.date)) byDay.set(e.date, []); byDay.get(e.date).push(e); }
    const days = [...byDay.keys()].sort().reverse();
    this.root.querySelector('.iv-entries').innerHTML = days.length ? days.map(date => `
      <div class="iv-dayhead"><span>${formatDate(date)}</span><span>${formatDuration(byDay.get(date).reduce((a, e) => a + e.minutes, 0))} h</span></div>
      ${byDay.get(date).map(e => `
        <div class="iv-entry${e.billable ? '' : ' is-nb'}" data-id="${e.id}">
          <span class="iv-entry-dur">${formatDuration(e.minutes)}</span>
          <div class="iv-entry-main">
            <strong>${esc(e.task || 'No description')}</strong>
            <span>${esc([clients.get(e.clientId) || 'No client', e.matter].filter(Boolean).join(' · '))}</span>
          </div>
          <div class="iv-entry-tags">
            ${!e.billable ? '<span class="iv-tag">Non-billable</span>' : ''}
            ${e.invoiced ? `<button type="button" class="iv-tag is-done" data-inv="${e.invoiceId}" title="Open invoice">${esc(invoices.get(e.invoiceId) || 'Invoiced')}</button>` : ''}
          </div>
          <span class="iv-entry-amt">${e.billable && e.rate ? this.money(timeAmount(e.minutes, e.rate), e.currency) : ''}</span>
          <div class="iv-entry-actions">
            <button type="button" class="iv-icon-btn" data-edit="${e.id}" aria-label="Edit entry">${icon('edit', 15)}</button>
            <button type="button" class="iv-icon-btn" data-del="${e.id}" aria-label="Delete entry"${e.invoiced ? ' disabled title="On an invoice"' : ''}>${icon('trash', 15)}</button>
          </div>
        </div>`).join('')}`).join('')
      : `<div class="iv-empty is-compact">${icon('clock', 26, 1.5)}<strong>No time this week</strong><span>Start the timer above or add time you have already worked.</span></div>`;
  },

  renderStats() {
    const entries = this.weekEntries();
    const total = entries.reduce((a, e) => a + e.minutes, 0);
    const bill = entries.filter(e => e.billable).reduce((a, e) => a + e.minutes, 0);
    const byCur = {};
    for (const e of entries) if (e.billable) byCur[e.currency] = (byCur[e.currency] || 0) + timeAmount(e.minutes, e.rate);
    const unbilled = {};
    for (const e of this.store.listTime({ unbilled: true })) unbilled[e.currency] = (unbilled[e.currency] || 0) + timeAmount(e.minutes, e.rate);
    const moneyList = (o) => Object.keys(o).length ? Object.entries(o).map(([c, v]) => this.money(v, c)).join(' + ') : this.money(0, this.prefs.currency || BASE_CURRENCY);
    const util = total ? Math.round(bill / total * 100) : null;
    this.root.querySelector('.iv-ts-stats').innerHTML = [
      { label: 'Unbilled, all time', value: moneyList(unbilled), sub: 'ready to invoice', hero: true },
      { label: 'Billed value this week', value: moneyList(byCur), sub: `${formatDuration(bill)} h billable` },
      { label: 'Hours this week', value: `${formatDuration(total)}`, sub: `${hours(total)} hours logged` },
      { label: 'Billable share', value: util === null ? '–' : `${util}%`, sub: 'of hours this week', tone: util === null ? '' : util >= 70 ? 'good' : util < 50 ? 'bad' : '' },
    ].map(x => `<div class="iv-stat${x.hero ? ' is-hero' : ''}"${x.tone ? ` data-tone="${x.tone}"` : ''}><span class="iv-stat-label">${x.label}</span><strong class="iv-stat-value">${x.value}</strong><span class="iv-stat-sub">${esc(x.sub)}</span></div>`).join('');
  },

  renderUnbilled() {
    const rows = this.store.timeSummary().filter(r => r.minutes > 0);
    const byClient = new Map();
    for (const r of rows) {
      const k = `${r.clientId || ''}|${r.currency}`;
      if (!byClient.has(k)) byClient.set(k, { clientId: r.clientId, clientName: r.clientName, currency: r.currency, rows: [], unbilled: 0, unbilledMinutes: 0, minutes: 0 });
      const g = byClient.get(k);
      g.rows.push(r); g.unbilled += r.unbilled; g.unbilledMinutes += r.unbilledMinutes; g.minutes += r.minutes;
    }
    const groups = [...byClient.values()].sort((a, b) => b.unbilled - a.unbilled);
    this.root.querySelector('.iv-unbilled').innerHTML = `
      <div class="iv-card-head"><h3>By client and matter</h3><span class="iv-hint">All time. Unbilled means billable and not yet on an invoice.</span></div>
      ${groups.length ? groups.map(g => `
        <div class="iv-ub-group">
          <div class="iv-ub-head">
            <div><strong>${esc(g.clientName)}</strong><span>${formatDuration(g.minutes)} h logged${g.unbilledMinutes ? `; ${formatDuration(g.unbilledMinutes)} h unbilled` : ''}</span></div>
            <strong class="iv-ub-amt">${this.money(g.unbilled, g.currency)}</strong>
            ${g.unbilled > 0 && g.clientId ? `<button type="button" class="btn btn-primary btn-sm" data-bill="${g.clientId}" data-cur="${g.currency}">${icon('invoice', 14)}<span>Create invoice</span></button>`
              : g.unbilled > 0 ? '<span class="iv-hint">Choose a client on these entries to invoice them</span>' : '<span class="iv-hint">All billed</span>'}
          </div>
          <div class="iv-ub-rows">
            ${g.rows.map(r => `<div class="iv-ub-row"><span>${esc(r.matter)}</span><span>${formatDuration(r.minutes)} h</span><span>${formatDuration(r.billableMinutes)} h billable</span><span class="r">${r.unbilled ? this.money(r.unbilled, r.currency) : '<span class="iv-faint">–</span>'}</span></div>`).join('')}
          </div>
        </div>`).join('') : '<p class="iv-hint">Totals by client and matter appear here once you log time.</p>'}`;
  },

  /* ---------------- entries ---------------- */

  entryDialog(id = null) {
    const e = id ? this.store.listTime().find(x => x.id === id) : null;
    const lastRate = this.timerDraft?.rate || 0;
    const v = e || { date: this.state.week <= isoDate() && isoDate() <= addDays(this.state.week, 6) ? isoDate() : this.state.week, clientId: this.timerDraft?.clientId || '', matter: this.timerDraft?.matter || '', task: '', minutes: 0, rate: lastRate, billable: this.prefs.billable !== false, currency: this.prefs.currency || BASE_CURRENCY };
    const locked = Boolean(e?.invoiced);
    const { el, close } = openModal({
      title: e ? 'Edit time' : 'Add time',
      body: `
        <form class="iv-form" id="iv-time-form" novalidate>
          ${locked ? '<p class="iv-note">This entry is on an invoice, so only the date, matter and description can change.</p>' : ''}
          <div class="iv-grid-2">
            <div class="iv-field"><label class="tool-label" for="te-date">Date</label><input type="date" class="tool-input" id="te-date" name="date" value="${v.date}"></div>
            <div class="iv-field"><label class="tool-label" for="te-dur">Duration</label><input class="tool-input" id="te-dur" name="duration" value="${v.minutes ? formatDuration(v.minutes) : ''}" placeholder="1:30, 1.5h or 90m"${locked ? ' disabled' : ''}><p class="iv-hint te-dur-hint">${v.minutes ? `${hours(v.minutes)} hours` : 'Hours and minutes'}</p></div>
            <div class="iv-field"><label class="tool-label" for="te-client">Client</label><select class="tool-select" id="te-client" name="clientId"${locked ? ' disabled' : ''}>${this.clientOptions(v.clientId).replace('<option value="__new">New client...</option>', '')}</select></div>
            <div class="iv-field"><label class="tool-label" for="te-matter">Matter or project</label><input class="tool-input" id="te-matter" name="matter" value="${esc(v.matter)}" list="iv-matters"></div>
          </div>
          <div class="iv-field"><label class="tool-label" for="te-task">Description</label><input class="tool-input" id="te-task" name="task" value="${esc(v.task)}" placeholder="What you did; it appears on the invoice"></div>
          <div class="iv-grid-2">
            <div class="iv-field"><label class="tool-label" for="te-rate">Hourly rate (${v.currency})</label><input class="tool-input" id="te-rate" name="rate" inputmode="decimal" value="${v.rate ? minorToInput(v.rate) : ''}"${locked ? ' disabled' : ''}></div>
            <label class="iv-check iv-check-field"><input type="checkbox" name="billable" ${v.billable ? 'checked' : ''}${locked ? ' disabled' : ''}><span>Billable</span></label>
          </div>
          <p class="iv-field-error" hidden></p>
        </form>`,
      actions: `<span class="iv-grow"></span><button type="button" class="btn btn-secondary btn-sm" data-close>Cancel</button><button type="submit" form="iv-time-form" class="btn btn-primary btn-sm">${e ? 'Save' : 'Add time'}</button>`,
    });
    const form = el.querySelector('form');
    const clientSel = form.querySelector('#te-client');
    clientSel.addEventListener('change', () => {
      const c = this.store.getClient(clientSel.value);
      const rate = form.querySelector('#te-rate');
      if (c?.hourlyRate && !rate.value) rate.value = minorToInput(c.hourlyRate);
    });
    form.querySelector('#te-dur').addEventListener('input', (ev) => {
      const m = parseDuration(ev.target.value);
      form.querySelector('.te-dur-hint').textContent = m ? `${hours(m)} hours${Number(this.prefs.increment) && roundUpMinutes(m, Number(this.prefs.increment)) !== m ? `; bills as ${formatDuration(roundUpMinutes(m, Number(this.prefs.increment)))}` : ''}` : 'Hours and minutes';
    });
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      const err = form.querySelector('.iv-field-error');
      try {
        if (locked) this.store.updateTime(e.id, { date: f.date, matter: f.matter, task: f.task });
        else {
          const minutes = roundUpMinutes(parseDuration(f.duration), Number(this.prefs.increment) || 0);
          if (!minutes) { form.querySelector('#te-dur').setAttribute('aria-invalid', 'true'); throw new Error('Enter a duration such as 1:30, 1.5h or 45m.'); }
          const data = { date: f.date, clientId: f.clientId || null, matter: f.matter, task: f.task, minutes, rate: toMinor(f.rate), billable: form.querySelector('[name="billable"]').checked, currency: v.currency };
          if (e) this.store.updateTime(e.id, data); else this.store.addTime(data);
        }
        close();
        this.state.week = weekStart(f.date, Number(this.prefs.weekStart));
        this.renderAll();
      } catch (x) { err.textContent = x.message; err.hidden = false; }
    });
  },

  newClientFor(select) {
    const { el, close } = openModal({
      title: 'New client',
      body: `<form class="iv-form" id="iv-nc-form" novalidate>
        <div class="iv-field"><label class="tool-label" for="nc-name">Name</label><input class="tool-input" id="nc-name" name="name" required></div>
        <div class="iv-field"><label class="tool-label" for="nc-rate">Hourly rate (${this.prefs.currency || BASE_CURRENCY})</label><input class="tool-input" id="nc-rate" name="hourlyRate" inputmode="decimal" placeholder="Optional"></div>
        <p class="iv-hint">Add the address, email and TIN later in Invoice Generator, Clients.</p>
      </form>`,
      actions: `<span class="iv-grow"></span><button type="button" class="btn btn-secondary btn-sm" data-close>Cancel</button><button type="submit" form="iv-nc-form" class="btn btn-primary btn-sm">Add client</button>`,
    });
    el.querySelector('form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const f = Object.fromEntries(new FormData(ev.target));
      if (!f.name.trim()) { el.querySelector('#nc-name').setAttribute('aria-invalid', 'true'); return; }
      const c = this.store.saveClient({ name: f.name, hourlyRate: toMinor(f.hourlyRate) });
      close();
      this.timerDraft = { ...this.readTimerFields(), clientId: c.id, rate: c.hourlyRate || toMinor(this.root.querySelector('[data-t="rate"]').value) };
      if (this.store.getTimer()) this.store.updateTimer({ clientId: c.id, rate: this.timerDraft.rate });
      this.renderTimer();
    });
    el.addEventListener('click', (ev) => { if (ev.target.closest('[data-close]')) select.value = ''; });
  },

  async billClient(clientId, currency) {
    const c = this.store.getClient(clientId);
    const entries = this.store.listTime({ unbilled: true, clientId }).filter(e => e.currency === currency);
    const running = this.store.getTimer();
    if (running && running.clientId === clientId && !(await tbConfirm('A timer is still running for this client. Its time will not be on this invoice. Continue?', { confirmText: 'Continue', title: 'Timer running' }))) return;
    try {
      const ip = getToolSettings('invoice-generator');
      const res = this.store.invoiceFromTime({
        clientId, currency, group: this.prefs.group === 'matter' ? 'matter' : 'entry',
        defaults: { vat: ip.vat !== false, vatMode: 'global', whtRate: Number(ip.whtRate) || 0, dueDays: Number(ip.dueDays ?? 14), template: ip.template },
      });
      this.store.setPending({ open: 'edit', id: res.invoice.id, message: `Draft ${res.invoice.number} for ${c?.name || 'client'}: ${res.entries} time entr${res.entries === 1 ? 'y' : 'ies'} (${formatDuration(res.minutes)} h)` });
      window.location.hash = '#invoice-generator';
    } catch (err) { showToast(err.message, 'error'); }
    void entries;
  },

  /* ---------------- events ---------------- */

  async handleClick(e) {
    const t = e.target;
    const edit = t.closest('[data-edit]');
    if (edit) { this.entryDialog(edit.dataset.edit); return; }
    const del = t.closest('[data-del]');
    if (del) {
      if (!(await tbConfirm('Delete this time entry?', { destructive: true, title: 'Delete entry' }))) return;
      try { this.store.deleteTime(del.dataset.del); this.renderAll(); } catch (err) { showToast(err.message, 'error'); }
      return;
    }
    const inv = t.closest('[data-inv]');
    if (inv) { this.store.setPending({ open: 'doc', id: inv.dataset.inv }); window.location.hash = '#invoice-generator'; return; }
    const bill = t.closest('[data-bill]');
    if (bill) { this.billClient(bill.dataset.bill, bill.dataset.cur); return; }
    const act = t.closest('[data-act]')?.dataset.act;
    try {
      switch (act) {
        case 'toggle': this.toggleTimer(); break;
        case 'discard':
          if (await tbConfirm('Discard the running timer without logging it?', { destructive: true, confirmText: 'Discard', title: 'Discard timer' })) { this.store.stopTimer({ discard: true }); this.renderAll(); }
          break;
        case 'prev': this.state.week = addDays(this.state.week, -7); this.renderWeek(); this.renderStats(); break;
        case 'next': this.state.week = addDays(this.state.week, 7); this.renderWeek(); this.renderStats(); break;
        case 'this-week': this.state.week = weekStart(isoDate(), Number(this.prefs.weekStart)); this.renderWeek(); this.renderStats(); break;
        case 'add': this.entryDialog(); break;
        case 'prefs': openSettings(`tool:${TOOL_ID}`); break;
        case 'csv': downloadText(this.store.timeCSV(this.weekEntries()), `timesheet-${this.state.week}.csv`, 'text/csv'); break;
        default: break;
      }
    } catch (err) { showToast(err.message, 'error'); }
  },

  handleInput(e) {
    const k = e.target.dataset.t;
    if (!k || k === 'clientId' || k === 'billable') return;
    clearTimeout(this.tTimer);
    this.tTimer = setTimeout(() => {
      const f = this.readTimerFields();
      if (this.store.getTimer()) { this.muted = true; this.store.updateTimer(f); this.muted = false; } else this.timerDraft = f;
    }, 300);
  },

  handleChange(e) {
    const k = e.target.dataset.t;
    if (!k) return;
    if (k === 'clientId' && e.target.value === '__new') { this.newClientFor(e.target); return; }
    const f = this.readTimerFields();
    if (k === 'clientId') {
      const c = this.store.getClient(f.clientId);
      if (c?.hourlyRate) { f.rate = c.hourlyRate; this.root.querySelector('[data-t="rate"]').value = minorToInput(c.hourlyRate); }
    }
    if (k === 'rate' && e.target.value) e.target.value = minorToInput(toMinor(e.target.value));
    if (this.store.getTimer()) this.store.updateTimer(f); else this.timerDraft = f;
  },

  getArtifact() {
    if (!this.store) return null;
    return { kind: 'csv', name: 'timesheet.csv', text: this.store.timeCSV() };
  },

  destroy() {
    clearInterval(this.tick);
    clearTimeout(this.tTimer);
    closeModal();
    this.offPrefs?.(); this.offStore?.();
    if (this.container) {
      this.container.removeEventListener('click', this.onClick);
      this.container.removeEventListener('input', this.onInput);
      this.container.removeEventListener('change', this.onChange);
      this.container.removeEventListener('keydown', this.onKey);
    }
    this.container = this.root = null;
  },
};
