/* ============================================================
   TOOLBOX — Invoice Generator

   Invoices and quotes for a Nigerian business: a dashboard of
   what is owed, an editor with live VAT (7.5%) and withholding
   tax, three A4 templates that print or save as PDF, payments,
   recurring invoices, clients and the business profile.

   Records live in lib/invoicing/store.js (shared with Timesheet
   & Billables and the Assistant). Preferences such as currency,
   VAT and WHT defaults: Preferences → Tools.
   ============================================================ */

import {
  getStore, computeTotals, effectiveStatus, formatDate, daysBetween, addDays, amountInWords,
  CURRENCIES, CURRENCY_CODES, BASE_CURRENCY, PAYMENT_METHODS, STATUS_LABEL, toMinor, isoDate,
} from '../lib/invoicing/store.js';
import { renderDocument } from '../lib/invoicing/document.js';
import {
  esc, icon, pill, moneyFmt, minorToInput, openModal, closeModal, printElement, downloadText, imageToDataURL, copyToClipboard,
} from '../lib/invoicing/ui.js';
import { getToolSettings, onToolSettings } from '../lib/tool-settings.js';
import { openSettings } from '../lib/settings-ui.js';
import { showToast } from '../utils.js';
import { tbConfirm } from '../lib/dialog.js';

const TOOL_ID = 'invoice-generator';
const VIEW_KEY = 'toolbox_invoicing_view_v1';

const INVOICE_FILTERS = [
  ['all', 'All'], ['draft', 'Drafts'], ['outstanding', 'Outstanding'], ['overdue', 'Overdue'],
  ['partial', 'Partially paid'], ['paid', 'Paid'], ['void', 'Void'],
];
const QUOTE_FILTERS = [
  ['all', 'All'], ['draft', 'Drafts'], ['sent', 'Sent'], ['accepted', 'Accepted'], ['converted', 'Converted'], ['declined', 'Declined'], ['expired', 'Expired'],
];

function prefsToDefaults(p) {
  return {
    currency: p.currency || BASE_CURRENCY,
    vat: p.vat !== false, vatMode: 'global',
    whtRate: Number(p.whtRate) || 0,
    dueDays: Number(p.dueDays ?? 14),
    template: p.template || 'classic',
  };
}

function dueText(doc, st, today) {
  if (doc.type === 'quote') return `Valid to ${formatDate(doc.dueDate, 'short')}`;
  if (['paid', 'void', 'draft'].includes(st)) return `Due ${formatDate(doc.dueDate, 'short')}`;
  const d = daysBetween(today, doc.dueDate);
  if (d < 0) return `${-d} day${d === -1 ? '' : 's'} overdue`;
  if (d === 0) return 'Due today';
  return `Due in ${d} day${d === 1 ? '' : 's'}`;
}

export default {
  render(container, ctx = {}) {
    this.container = container;
    this.store = getStore();
    this.prefs = getToolSettings(TOOL_ID);
    this.money = moneyFmt(this.prefs.numberFormat);
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(VIEW_KEY) || '{}'); } catch { saved = {}; }
    this.state = { view: 'list', type: saved.type === 'quote' ? 'quote' : 'invoice', filter: 'all', q: '', docId: null, clientFilter: null };
    this.timers = [];

    container.innerHTML = `
      <div class="iv" data-view="list">
        <div class="iv-top">
          <div class="iv-tabs" role="tablist" aria-label="Invoicing sections">
            <button role="tab" data-tab="invoice">${icon('invoice', 15)}<span>Invoices</span></button>
            <button role="tab" data-tab="quote">${icon('quote', 15)}<span>Quotes</span></button>
            <button role="tab" data-tab="clients">${icon('users', 15)}<span>Clients</span></button>
            <button role="tab" data-tab="business">${icon('building', 15)}<span>Business</span></button>
          </div>
          <div class="iv-top-actions">
            <button type="button" class="btn btn-primary btn-sm iv-new" data-act="new">${icon('plus', 15)}<span>New invoice</span></button>
          </div>
        </div>
        <div class="iv-body"></div>
      </div>`;
    this.root = container.querySelector('.iv');
    this.body = container.querySelector('.iv-body');

    this.onClick = (e) => this.handleClick(e);
    this.onInput = (e) => this.handleInput(e);
    this.onChange = (e) => this.handleChange(e);
    this.onKey = (e) => this.handleKey(e);
    container.addEventListener('click', this.onClick);
    container.addEventListener('input', this.onInput);
    container.addEventListener('change', this.onChange);
    container.addEventListener('keydown', this.onKey);

    this.offPrefs = onToolSettings(TOOL_ID, (p) => {
      this.prefs = p; this.money = moneyFmt(p.numberFormat);
      if (this.state.view !== 'edit') this.show();
    });
    this.offStore = this.store.subscribe((what) => {
      if (this.muted) return;
      if (what === 'pending') { const p = this.store.takePending(); if (p) this.openPending(p); return; }
      if (what === 'reload' && this.state.view !== 'edit') this.show();
    });

    // Recurring invoices whose date has come are drafted when the tool opens.
    const made = this.store.runRecurring();
    if (made.length) showToast(`${made.length} recurring invoice${made.length > 1 ? 's were' : ' was'} drafted: ${made.map(x => x.number).join(', ')}`, 'success', 6000);

    this.ro = new ResizeObserver(() => this.fitPaper());
    this.ro.observe(this.body);

    const pending = this.store.takePending() || this.takeLegacyHandoff() || this.importArtifact(ctx.artifact);
    if (pending) this.openPending(pending);
    else if (!this.store.getProfile().name && !this.store.listDocs({ type: 'all' }).length) this.go({ view: 'business', onboarding: true });
    else this.go({ view: 'list' });
  },

  /* ---------------- routing ---------------- */

  go(patch) {
    this.flushProfile();
    if (this.state.view === 'edit' && patch.view !== 'edit') this.leaveEditor();
    Object.assign(this.state, patch);
    if (patch.view === 'list' && !('filter' in patch) && patch.type && patch.type !== this.lastListType) this.state.filter = 'all';
    try { localStorage.setItem(VIEW_KEY, JSON.stringify({ type: this.state.type })); } catch { /* private mode */ }
    this.show();
    this.container.closest('#viewport-content')?.scrollTo?.({ top: 0 });
    if (patch.view !== 'edit') window.scrollTo?.({ top: 0 });
  },

  show() {
    const s = this.state;
    this.root.dataset.view = s.view;
    const tab = ['clients', 'business'].includes(s.view) ? s.view : s.type;
    for (const b of this.root.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    const newBtn = this.root.querySelector('.iv-new span');
    newBtn.textContent = s.view === 'clients' ? 'New client' : s.type === 'quote' ? 'New quote' : 'New invoice';
    this.root.querySelector('.iv-new').hidden = s.view === 'business';
    if (s.view === 'list') this.renderList();
    else if (s.view === 'doc') this.renderDoc();
    else if (s.view === 'edit') this.renderEditor();
    else if (s.view === 'clients') this.renderClients();
    else if (s.view === 'business') this.renderBusiness();
    if (s.view === 'list') this.lastListType = s.type;
  },

  openPending(p) {
    if (p.id && this.store.getDoc(p.id)) {
      const doc = this.store.getDoc(p.id);
      this.go({ view: p.open === 'edit' ? 'edit' : 'doc', docId: p.id, type: doc.type });
      if (p.message) showToast(p.message, 'success', 5000);
    } else this.go({ view: 'list' });
  },

  /* Invoice handed over by the Assistant's older generate_invoice card. */
  takeLegacyHandoff() {
    let raw = null;
    try { raw = sessionStorage.getItem('toolbox.invoice.handoff'); sessionStorage.removeItem('toolbox.invoice.handoff'); } catch { raw = null; }
    if (!raw) return null;
    try { return this.importLegacy(JSON.parse(raw)); } catch { return null; }
  },
  importArtifact(artifact) {
    if (!artifact?.text) return null;
    try { return this.importLegacy(JSON.parse(artifact.text)); } catch { return null; }
  },
  importLegacy(data) {
    if (!data || typeof data !== 'object') return null;
    if (data.app === 'toolbox-invoicing') { this.store.importJSON(data, { mode: 'merge' }); return { view: 'list' }; }
    const lines = Array.isArray(data.items) ? data.items : Array.isArray(data.lines) ? data.lines : [];
    const client = data.client ? this.store.ensureClient(typeof data.client === 'string' ? data.client : data.client) : null;
    const taxRate = Number(data.taxRate ?? data.vat?.rate ?? 0);
    const doc = this.store.createDoc({
      clientId: client?.id || null,
      currency: CURRENCIES[String(data.currency || '').toUpperCase()] ? String(data.currency).toUpperCase() : undefined,
      issueDate: /^\d{4}-\d{2}-\d{2}$/.test(data.issued || '') ? data.issued : undefined,
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(data.due || '') ? data.due : undefined,
      items: lines.map(l => ({ description: l.description || '', qty: Number(l.qty ?? 1) || 1, rate: typeof l.rate === 'number' && data.items ? l.rate : toMinor(l.price ?? l.rate ?? 0), vat: true })),
      vat: { mode: taxRate > 0 ? 'global' : 'none', rate: taxRate > 0 ? taxRate : 7.5 },
      notes: data.notes,
    }, prefsToDefaults(this.prefs));
    return { open: 'edit', id: doc.id, message: `Imported as draft ${doc.number}` };
  },

  /* ---------------- list / dashboard ---------------- */

  renderList() {
    const s = this.state;
    const isQuote = s.type === 'quote';
    const m = this.money;
    const today = isoDate();
    const all = this.store.listDocs({ type: s.type, clientId: s.clientFilter });
    const docs = this.store.listDocs({ type: s.type, status: s.filter, q: s.q, clientId: s.clientFilter });
    const counts = {};
    for (const d of all) {
      counts[d.effectiveStatus] = (counts[d.effectiveStatus] || 0) + 1;
      if (['sent', 'partial', 'overdue'].includes(d.effectiveStatus) && !isQuote) counts.outstanding = (counts.outstanding || 0) + 1;
    }
    counts.all = all.length;
    const dash = this.store.dashboard();
    const profile = this.store.getProfile();
    const recurring = this.store.listRecurring().filter(r => r.active);
    const clientName = s.clientFilter ? this.store.getClient(s.clientFilter)?.name : '';

    const stats = isQuote ? (() => {
      const open = all.filter(d => d.effectiveStatus === 'sent');
      const won = all.filter(d => ['accepted', 'converted'].includes(d.effectiveStatus));
      const answered = all.filter(d => ['accepted', 'converted', 'declined'].includes(d.effectiveStatus)).length;
      const base = (d, v) => (d.currency === BASE_CURRENCY ? v : Math.round(v * (d.fxRate || 0)));
      return [
        { label: 'Awaiting answer', value: m(open.reduce((a, d) => a + base(d, d.totals.total), 0), BASE_CURRENCY), sub: `${open.length} quote${open.length === 1 ? '' : 's'}`, hero: true },
        { label: 'Won', value: m(won.reduce((a, d) => a + base(d, d.totals.total), 0), BASE_CURRENCY), sub: `${won.length} accepted or invoiced` },
        { label: 'Win rate', value: answered ? `${Math.round(won.length / answered * 100)}%` : '–', sub: `${answered} answered` },
        { label: 'Drafts', value: String(counts.draft || 0), sub: 'not sent yet' },
      ];
    })() : [
      { label: 'Outstanding', value: m(dash.outstanding, BASE_CURRENCY), sub: `${dash.counts.outstanding || 0} unpaid invoice${dash.counts.outstanding === 1 ? '' : 's'}`, hero: true },
      { label: 'Overdue', value: m(dash.overdue, BASE_CURRENCY), sub: `${dash.counts.overdue || 0} past due date`, tone: dash.overdue > 0 ? 'bad' : '' },
      { label: 'Paid this month', value: m(dash.paidThisMonth, BASE_CURRENCY), sub: new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' }), tone: dash.paidThisMonth > 0 ? 'good' : '' },
      { label: 'Drafts', value: String(dash.drafts), sub: 'not sent yet' },
    ];

    const filters = isQuote ? QUOTE_FILTERS : INVOICE_FILTERS;
    this.body.innerHTML = `
      ${!profile.name ? `<div class="iv-banner">${icon('building', 18)}<div><strong>Add your business details</strong><span>Your name, address, TIN and bank account appear on every invoice.</span></div><button type="button" class="btn btn-secondary btn-sm" data-act="goto-business">Set up</button></div>` : ''}
      <section class="iv-stats">${stats.map(x => `
        <div class="iv-stat${x.hero ? ' is-hero' : ''}"${x.tone ? ` data-tone="${x.tone}"` : ''}>
          <span class="iv-stat-label">${x.label}</span>
          <strong class="iv-stat-value">${x.value}</strong>
          <span class="iv-stat-sub">${esc(x.sub)}</span>
        </div>`).join('')}
      </section>
      ${!isQuote && dash.missingFx ? `<p class="iv-note">${dash.missingFx} foreign-currency invoice${dash.missingFx > 1 ? 's have' : ' has'} no exchange rate, so ${dash.missingFx > 1 ? 'they are' : 'it is'} left out of the Naira totals.</p>` : ''}
      <section class="iv-listbar">
        <div class="iv-chips" role="tablist" aria-label="Filter by status">
          ${filters.map(([k, label]) => `<button type="button" class="iv-chip" data-filter="${k}" aria-selected="${s.filter === k}">${label}${counts[k] ? `<small>${counts[k]}</small>` : ''}</button>`).join('')}
        </div>
        <div class="iv-listtools">
          <label class="iv-search">${icon('search', 15)}<input type="search" data-f="q" value="${esc(s.q)}" placeholder="Search number, client or item" aria-label="Search"></label>
          <button type="button" class="iv-icon-btn" data-act="data-menu" aria-label="Export and backup" title="Export and backup">${icon('download', 17)}</button>
        </div>
      </section>
      ${clientName ? `<p class="iv-filtered">Showing ${esc(clientName)} only <button type="button" class="iv-link" data-act="clear-client">Show all clients</button></p>` : ''}
      <section class="iv-list" role="list">
        ${docs.length ? `<div class="iv-row iv-row-head" aria-hidden="true"><span>Number</span><span>Client</span><span>Issued</span><span>${isQuote ? 'Valid to' : 'Due'}</span><span class="r">Total</span><span class="r">${isQuote ? '' : 'Balance'}</span><span>Status</span></div>` : ''}
        ${docs.map(d => `
          <button type="button" class="iv-row" role="listitem" data-open="${d.id}">
            <span class="iv-row-num">${esc(d.number)}</span>
            <span class="iv-row-client">${esc(d.clientName || 'No client')}${d.recurringId ? `<i class="iv-rec" title="Recurring">${icon('repeat', 12)}</i>` : ''}</span>
            <span class="iv-row-date">${formatDate(d.issueDate, 'short')}</span>
            <span class="iv-row-due" data-s="${d.effectiveStatus}">${dueText(d, d.effectiveStatus, today)}</span>
            <span class="iv-row-amt r">${m(d.totals.total, d.currency)}</span>
            <span class="iv-row-bal r">${isQuote || d.effectiveStatus === 'void' ? '' : d.totals.balance > 0 ? m(d.totals.balance, d.currency) : '<span class="iv-faint">–</span>'}</span>
            <span class="iv-row-st">${pill(d.effectiveStatus)}</span>
          </button>`).join('')}
        ${!docs.length ? `<div class="iv-empty">
            ${icon(isQuote ? 'quote' : 'invoice', 28, 1.5)}
            <strong>${all.length ? 'Nothing matches' : isQuote ? 'No quotes yet' : 'No invoices yet'}</strong>
            <span>${all.length ? 'Try another filter or search.' : isQuote ? 'Send a quotation, then turn it into an invoice with one click when the client accepts.' : 'Create your first invoice. VAT, withholding tax and the amount in words are worked out for you.'}</span>
            ${all.length ? '' : `<button type="button" class="btn btn-primary btn-sm" data-act="new">${icon('plus', 15)}<span>${isQuote ? 'New quote' : 'New invoice'}</span></button>`}
          </div>` : ''}
      </section>
      ${!isQuote && recurring.length ? `
        <section class="iv-card iv-recurring">
          <h3>${icon('repeat', 16)} Recurring</h3>
          <ul>${recurring.map(r => {
            const tpl = this.store.getDoc(r.templateId);
            const c = tpl && this.store.getClient(tpl.clientId);
            return tpl ? `<li><button type="button" class="iv-link" data-open="${tpl.id}">${esc(tpl.number)}</button><span>${esc(c?.name || 'No client')}</span><span>${r.frequency === 'monthly' ? 'Monthly' : 'Quarterly'}</span><span>Next draft ${formatDate(r.nextDate, 'short')}</span><span class="r">${m(computeTotals(tpl).total, tpl.currency)}</span></li>` : '';
          }).join('')}</ul>
        </section>` : ''}`;
  },

  /* ---------------- document view ---------------- */

  renderDoc() {
    const doc = this.store.getDoc(this.state.docId);
    if (!doc) return this.go({ view: 'list' });
    const m = this.money;
    const t = computeTotals(doc);
    const st = effectiveStatus(doc);
    const isQuote = doc.type === 'quote';
    const client = this.store.getClient(doc.clientId);
    const rec = this.store.getRecurringFor(doc.id);
    const fromQuote = doc.fromQuoteId && this.store.getDoc(doc.fromQuoteId);
    const toInvoice = doc.convertedToId && this.store.getDoc(doc.convertedToId);

    const primary = [];
    if (st === 'draft') primary.push(`<button type="button" class="btn btn-primary btn-sm" data-act="send">${icon('send', 15)}<span>Mark as sent</span></button>`);
    if (!isQuote && ['sent', 'partial', 'overdue'].includes(st)) primary.push(`<button type="button" class="btn btn-primary btn-sm" data-act="pay">${icon('cash', 15)}<span>Record payment</span></button>`);
    if (isQuote && ['sent', 'accepted', 'draft'].includes(st)) primary.push(`<button type="button" class="btn ${st === 'draft' ? 'btn-secondary' : 'btn-primary'} btn-sm" data-act="convert">${icon('invoice', 15)}<span>Convert to invoice</span></button>`);

    this.body.innerHTML = `
      <div class="iv-docbar">
        <button type="button" class="iv-back" data-act="back">${icon('back', 16)}<span>${isQuote ? 'Quotes' : 'Invoices'}</span></button>
        <div class="iv-docbar-title"><h2>${esc(doc.number)}</h2>${pill(st)}</div>
        <div class="iv-docbar-actions">
          ${primary.join('')}
          ${st !== 'void' && st !== 'converted' ? `<button type="button" class="btn btn-secondary btn-sm" data-act="edit">${icon('edit', 15)}<span>Edit</span></button>` : ''}
          <button type="button" class="btn btn-secondary btn-sm" data-act="share">${icon('share', 15)}<span>Share</span></button>
          <button type="button" class="btn btn-secondary btn-sm" data-act="print">${icon('print', 15)}<span>Print or PDF</span></button>
          <div class="iv-menu-wrap">
            <button type="button" class="iv-icon-btn is-boxed" data-act="more" aria-haspopup="menu" aria-label="More actions">${icon('more', 18)}</button>
          </div>
        </div>
      </div>

      <section class="iv-docsum">
        <div class="iv-figs">
          <div><span>${isQuote ? 'Quote total' : 'Invoice total'}</span><strong>${m(t.total, doc.currency)}</strong></div>
          ${!isQuote && t.wht ? `<div><span>WHT (${t.whtRate}%) withheld</span><strong>${m(t.wht, doc.currency)}</strong></div>` : ''}
          ${!isQuote ? `<div><span>Paid</span><strong>${m(t.paid, doc.currency)}</strong></div>
          <div class="is-key"><span>Balance due</span><strong>${m(Math.max(t.balance, 0), doc.currency)}</strong></div>` : `<div><span>Valid until</span><strong>${formatDate(doc.dueDate)}</strong></div>`}
        </div>
        <div class="iv-docsum-meta">
          <span>${esc(client?.name || 'No client')}</span>
          <span>${isQuote ? 'Issued' : 'Issued'} ${formatDate(doc.issueDate)}${isQuote ? '' : ` &middot; ${dueText(doc, st, isoDate())}`}</span>
          ${doc.currency !== BASE_CURRENCY ? `<span>${doc.fxRate > 0 ? `About ${m(Math.round(t.total * doc.fxRate), BASE_CURRENCY)} at ${doc.fxRate}` : 'No exchange rate set'}</span>` : ''}
          ${rec ? `<span>${icon('repeat', 12)} Repeats ${rec.frequency}; next draft ${formatDate(rec.nextDate, 'short')}</span>` : ''}
          ${fromQuote ? `<span>From quote <button type="button" class="iv-link" data-open="${fromQuote.id}">${esc(fromQuote.number)}</button></span>` : ''}
          ${toInvoice ? `<span>Invoiced as <button type="button" class="iv-link" data-open="${toInvoice.id}">${esc(toInvoice.number)}</button></span>` : ''}
        </div>
        ${!isQuote && doc.payments.length ? `
          <ul class="iv-payments">
            ${doc.payments.map(p => `<li>
              <span>${formatDate(p.date, 'short')}</span><span>${esc(p.method)}${p.reference ? ` &middot; ${esc(p.reference)}` : ''}</span>
              <strong>${m(p.amount, doc.currency)}</strong>
              <button type="button" class="iv-icon-btn" data-delpay="${p.id}" aria-label="Remove payment">${icon('x', 14)}</button>
            </li>`).join('')}
          </ul>` : ''}
      </section>

      <div class="iv-tplbar">
        <div class="iv-seg" role="radiogroup" aria-label="Template">
          ${['classic', 'modern', 'compact'].map(k => `<button type="button" role="radio" data-tpl="${k}" aria-checked="${doc.template === k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}
        </div>
        <span class="iv-hint">A4. Choose "Save as PDF" in the print dialogue for a PDF.</span>
      </div>
      <div class="iv-paper-wrap"><div class="iv-paper-scale">${renderDocument(doc, { profile: this.store.getProfile(), client, prefs: this.prefs })}</div></div>`;
    this.fitPaper();
  },

  fitPaper() {
    const wrap = this.body?.querySelector('.iv-paper-wrap');
    const scaleEl = wrap?.querySelector('.iv-paper-scale');
    const paper = wrap?.querySelector('.iv-paper');
    if (!wrap || !paper) return;
    const pad = parseFloat(getComputedStyle(wrap).paddingLeft) || 0;
    const k = Math.min(1, (wrap.clientWidth - pad * 2) / 794);
    scaleEl.style.transform = k < 1 ? `scale(${k})` : '';
    scaleEl.style.marginBottom = `${Math.ceil(paper.offsetHeight * k) - paper.offsetHeight}px`;
  },

  moreMenu(anchor) {
    const doc = this.store.getDoc(this.state.docId);
    if (!doc) return;
    const st = effectiveStatus(doc);
    const isQuote = doc.type === 'quote';
    const rec = this.store.getRecurringFor(doc.id);
    const items = [
      ['duplicate', 'copy', 'Duplicate'],
      !isQuote && st === 'draft' ? null : null,
      !isQuote && ['sent', 'overdue'].includes(st) && !doc.payments.length ? ['to-draft', 'edit', 'Return to draft'] : null,
      !isQuote && st !== 'void' ? ['recurring', 'repeat', rec ? 'Change repeat schedule' : 'Repeat monthly or quarterly'] : null,
      isQuote && ['sent', 'draft'].includes(st) ? ['accept', 'check', 'Mark accepted'] : null,
      isQuote && ['sent', 'draft', 'accepted'].includes(st) ? ['decline', 'x', 'Mark declined'] : null,
      !isQuote ? ['as-quote', 'quote', 'Copy as a quote'] : null,
      !isQuote && st !== 'void' && st !== 'draft' ? ['void', 'x', 'Void invoice', true] : null,
      (st === 'draft' || st === 'void' || isQuote) ? ['delete', 'trash', 'Delete', true] : null,
    ].filter(Boolean);
    this.showMenu(anchor, items);
  },

  showMenu(anchor, items) {
    this.closeMenu();
    const menu = document.createElement('div');
    menu.className = 'iv-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = items.map(([act, ic, label, danger]) => `<button type="button" role="menuitem" data-act="${act}"${danger ? ' class="is-danger"' : ''}>${icon(ic, 15)}<span>${label}</span></button>`).join('');
    anchor.parentElement.appendChild(menu);
    this.menu = menu;
    setTimeout(() => {
      this.menuAway = (e) => { if (!menu.contains(e.target)) this.closeMenu(); };
      document.addEventListener('click', this.menuAway);
    }, 0);
    menu.querySelector('button')?.focus();
  },
  closeMenu() {
    this.menu?.remove(); this.menu = null;
    if (this.menuAway) document.removeEventListener('click', this.menuAway);
    this.menuAway = null;
  },

  /* ---------------- editor ---------------- */

  renderEditor() {
    const doc = this.store.getDoc(this.state.docId);
    if (!doc) return this.go({ view: 'list' });
    this.editing = doc;
    const isQuote = doc.type === 'quote';
    const clients = this.store.listClients();
    const rec = this.store.getRecurringFor(doc.id);
    const dueIn = daysBetween(doc.issueDate, doc.dueDate);
    const vatMode = doc.vat?.mode || 'none';
    const whtRate = Number(doc.wht?.rate || 0);

    this.body.innerHTML = `
      <div class="iv-docbar">
        <button type="button" class="iv-back" data-act="done">${icon('back', 16)}<span>${isQuote ? 'Quote' : 'Invoice'}</span></button>
        <div class="iv-docbar-title"><h2>${isQuote ? 'Edit quote' : 'Edit invoice'}</h2><span class="iv-saved" aria-live="polite">Saved</span></div>
        <div class="iv-docbar-actions">
          <button type="button" class="btn btn-primary btn-sm" data-act="done">${icon('check', 15)}<span>Done</span></button>
        </div>
      </div>

      <div class="iv-editor">
        <section class="iv-card iv-ed-head">
          <div class="iv-field iv-client-field">
            <label class="tool-label" for="iv-client">${isQuote ? 'Prepared for' : 'Bill to'}</label>
            <div class="iv-client-pick">
              <select class="tool-select" id="iv-client" data-f="clientId">
                <option value="">Choose a client</option>
                ${clients.map(c => `<option value="${c.id}"${c.id === doc.clientId ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}
              </select>
              <button type="button" class="btn btn-secondary btn-sm" data-act="new-client-inline">${icon('plus', 14)}<span>New</span></button>
            </div>
            <div class="iv-client-card">${this.clientCard(doc.clientId)}</div>
          </div>
          <div class="iv-grid">
            <div class="iv-field"><label class="tool-label" for="iv-number">${isQuote ? 'Quote number' : 'Invoice number'}</label><input class="tool-input" id="iv-number" data-f="number" value="${esc(doc.number)}" autocomplete="off"></div>
            <div class="iv-field"><label class="tool-label" for="iv-ref">Reference or PO</label><input class="tool-input" id="iv-ref" data-f="reference" value="${esc(doc.reference)}" placeholder="Optional"></div>
            <div class="iv-field"><label class="tool-label" for="iv-cur">Currency</label>
              <select class="tool-select" id="iv-cur" data-f="currency">${CURRENCY_CODES.map(c => `<option value="${c}"${c === doc.currency ? ' selected' : ''}>${c} (${CURRENCIES[c].symbol})</option>`).join('')}</select>
            </div>
            <div class="iv-field"><label class="tool-label" for="iv-issue">Issue date</label><input type="date" class="tool-input" id="iv-issue" data-f="issueDate" value="${doc.issueDate}"></div>
            <div class="iv-field iv-due-field"><label class="tool-label" for="iv-due">${isQuote ? 'Valid until' : 'Due date'}</label>
              <div class="iv-due">
                <input type="date" class="tool-input" id="iv-due" data-f="dueDate" value="${doc.dueDate}">
                <select class="tool-select" data-f="dueIn" aria-label="Due in">
                  ${[0, 7, 14, 30, 45, 60, 90].map(d => `<option value="${d}"${d === dueIn ? ' selected' : ''}>${d === 0 ? 'On receipt' : `${d} days`}</option>`).join('')}
                  ${[0, 7, 14, 30, 45, 60, 90].includes(dueIn) ? '' : `<option value="${dueIn}" selected>${dueIn} days</option>`}
                </select>
              </div>
            </div>
            <div class="iv-field iv-fx"${doc.currency === BASE_CURRENCY ? ' hidden' : ''}><label class="tool-label" for="iv-fx">Naira per 1 ${doc.currency}</label><input class="tool-input" id="iv-fx" data-f="fxRate" inputmode="decimal" value="${doc.fxRate || ''}" placeholder="e.g. 1550"></div>
          </div>
        </section>

        <section class="iv-card iv-items-card">
          <div class="iv-card-head"><h3>Items</h3><span class="iv-hint">Enter moves down a row; a new line is added at the end.</span></div>
          <div class="iv-items" data-vat="${vatMode}">
            <div class="iv-item iv-item-head" aria-hidden="true"><span>Description</span><span class="r">Qty</span><span>Unit</span><span class="r">Rate</span><span class="r">Disc %</span><span class="c iv-vatcol">VAT</span><span class="r">Amount</span><span></span></div>
            <div class="iv-item-rows"></div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm iv-additem" data-act="add-item">${icon('plus', 14)}<span>Add line</span></button>
        </section>

        <div class="iv-ed-bottom">
          <section class="iv-card iv-taxes">
            <div class="iv-field">
              <span class="tool-label">VAT</span>
              <div class="iv-taxrow">
                <div class="iv-seg" role="radiogroup" aria-label="VAT">
                  ${[['none', 'None'], ['global', 'All lines'], ['line', 'Per line']].map(([k, l]) => `<button type="button" role="radio" data-vat="${k}" aria-checked="${vatMode === k}">${l}</button>`).join('')}
                </div>
                <label class="iv-rate"${vatMode === 'none' ? ' hidden' : ''}><input class="tool-input" data-f="vatRate" inputmode="decimal" value="${doc.vat?.rate ?? 7.5}" aria-label="VAT rate"><span>%</span></label>
              </div>
            </div>
            ${isQuote ? '' : `<div class="iv-field">
              <span class="tool-label">Withholding tax</span>
              <div class="iv-taxrow">
                <div class="iv-seg" role="radiogroup" aria-label="Withholding tax">
                  ${[[0, 'None'], [5, '5%'], [10, '10%']].map(([k, l]) => `<button type="button" role="radio" data-wht="${k}" aria-checked="${whtRate === k}">${l}</button>`).join('')}
                  <button type="button" role="radio" data-wht="custom" aria-checked="${![0, 5, 10].includes(whtRate)}">Other</button>
                </div>
                <label class="iv-rate"${[0, 5, 10].includes(whtRate) ? ' hidden' : ''}><input class="tool-input" data-f="whtRate" inputmode="decimal" value="${whtRate}" aria-label="WHT rate"><span>%</span></label>
              </div>
              <p class="iv-hint">Deducted by your client and paid to FIRS or the State IRS. Shown below the total; VAT is not affected.</p>
            </div>`}
            ${isQuote ? '' : `<div class="iv-field">
              <label class="tool-label" for="iv-rec">Repeat</label>
              <select class="tool-select" id="iv-rec" data-f="recurring">
                <option value="none"${!rec ? ' selected' : ''}>Does not repeat</option>
                <option value="monthly"${rec?.frequency === 'monthly' ? ' selected' : ''}>Every month</option>
                <option value="quarterly"${rec?.frequency === 'quarterly' ? ' selected' : ''}>Every quarter</option>
              </select>
              <p class="iv-hint iv-rec-hint">${rec ? `Next draft on ${formatDate(rec.nextDate)}. It is created when you open Invoices on or after that day.` : 'A new draft copy is made each period, ready to check and send.'}</p>
            </div>`}
          </section>
          <section class="iv-card iv-totals-card" aria-live="polite"></section>
        </div>

        <section class="iv-card iv-notes-card">
          <div class="iv-field"><label class="tool-label" for="iv-notes">Notes</label><textarea class="tool-textarea" id="iv-notes" data-f="notes" rows="3" placeholder="A thank-you, delivery details or project notes">${esc(doc.notes)}</textarea></div>
          <div class="iv-field"><label class="tool-label" for="iv-terms">Terms</label><textarea class="tool-textarea" id="iv-terms" data-f="terms" rows="3" placeholder="e.g. 70% deposit before fabrication; balance on delivery.">${esc(doc.terms)}</textarea></div>
        </section>
      </div>`;
    if (!doc.items.length) this.editing.items.push(this.blankItem());
    this.renderItems();
    this.renderTotals();
  },

  blankItem() { return { id: `li_${Math.random().toString(36).slice(2, 10)}`, description: '', qty: 1, unit: '', rate: 0, discount: 0, vat: true }; },

  clientCard(id) {
    const c = id && this.store.getClient(id);
    if (!c) return '<span class="iv-faint">The client\'s name, address and TIN print in the Bill to box.</span>';
    return `<strong>${esc(c.name)}</strong>${[c.address.replace(/\n/g, ', '), c.email, c.phone, c.tin && `TIN ${c.tin}`].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('')}
      <button type="button" class="iv-link" data-editclient="${c.id}">Edit client</button>`;
  },

  renderItems() {
    const rowsEl = this.body.querySelector('.iv-item-rows');
    const doc = this.editing;
    const t = computeTotals(doc);
    rowsEl.innerHTML = doc.items.map((it, i) => `
      <div class="iv-item" data-i="${i}">
        <input class="tool-input iv-in-desc" data-li="description" value="${esc(it.description)}" placeholder="Description, e.g. 20ft container office conversion" aria-label="Description, line ${i + 1}">
        <input class="tool-input r" data-li="qty" inputmode="decimal" value="${it.qty}" aria-label="Quantity">
        <input class="tool-input" data-li="unit" value="${esc(it.unit)}" placeholder="unit" list="iv-units" aria-label="Unit">
        <input class="tool-input r" data-li="rate" inputmode="decimal" value="${it.rate ? minorToInput(it.rate) : ''}" placeholder="0.00" aria-label="Rate">
        <input class="tool-input r" data-li="discount" inputmode="decimal" value="${it.discount || ''}" placeholder="0" aria-label="Discount percent">
        <label class="iv-vatcol c"><input type="checkbox" data-li="vat" ${it.vat !== false ? 'checked' : ''} aria-label="Charge VAT on this line"></label>
        <span class="iv-item-amt r">${this.money(t.lines[i]?.net || 0, doc.currency)}</span>
        <button type="button" class="iv-icon-btn" data-delitem="${i}" aria-label="Remove line ${i + 1}">${icon('x', 15)}</button>
      </div>`).join('') + `<datalist id="iv-units">${['pcs', 'unit', 'hr', 'day', 'm', 'm²', 'm³', 'lot', 'set', 'trip', 'month'].map(u => `<option value="${u}">`).join('')}</datalist>`;
  },

  renderTotals() {
    const doc = this.editing;
    const t = computeTotals(doc);
    const m = (v) => this.money(v, doc.currency);
    const isQuote = doc.type === 'quote';
    this.body.querySelector('.iv-totals-card').innerHTML = `
      <dl class="iv-tot">
        <div><dt>Subtotal</dt><dd>${m(t.subtotal)}</dd></div>
        ${t.discount ? `<div class="is-sub"><dt>Discounts given</dt><dd>${m(t.discount)}</dd></div>` : ''}
        ${doc.vat.mode !== 'none' ? `<div><dt>VAT ${doc.vat.rate}%${doc.vat.mode === 'line' ? ` on ${m(t.vatBase)}` : ''}</dt><dd>${m(t.vat)}</dd></div>` : ''}
        <div class="is-total"><dt>Total</dt><dd>${m(t.total)}</dd></div>
        ${!isQuote && t.wht ? `<div><dt>Less WHT ${t.whtRate}%</dt><dd>(${m(t.wht)})</dd></div><div class="is-key"><dt>Amount payable</dt><dd>${m(t.payable)}</dd></div>` : ''}
        ${!isQuote && t.paid ? `<div><dt>Paid</dt><dd>(${m(t.paid)})</dd></div><div class="is-key"><dt>Balance due</dt><dd>${m(t.balance)}</dd></div>` : ''}
      </dl>
      ${doc.currency !== BASE_CURRENCY && doc.fxRate > 0 ? `<p class="iv-hint">About ${this.money(Math.round((isQuote ? t.total : t.payable) * doc.fxRate), BASE_CURRENCY)}</p>` : ''}
      ${t.total > 0 ? `<p class="iv-words">${esc(amountInWords(isQuote ? t.total : t.payable, doc.currency))}</p>` : ''}`;
    t.lines.forEach((l, i) => {
      const cell = this.body.querySelector(`.iv-item[data-i="${i}"] .iv-item-amt`);
      if (cell) cell.textContent = this.money(l.net, doc.currency);
    });
  },

  queueSave(patch = null) {
    if (patch) Object.assign(this.pendingPatch ||= {}, patch);
    this.pendingPatch ||= {};
    this.pendingPatch.items = this.editing.items;
    this.pendingPatch.vat = this.editing.vat;
    this.pendingPatch.wht = this.editing.wht;
    const flag = this.body.querySelector('.iv-saved');
    if (flag) { flag.textContent = 'Saving'; flag.classList.add('is-busy'); }
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flushSave(), 350);
  },
  flushSave() {
    clearTimeout(this.saveTimer);
    if (!this.pendingPatch || !this.editing) return;
    const patch = this.pendingPatch;
    this.pendingPatch = null;
    this.muted = true;
    try {
      const saved = this.store.updateDoc(this.editing.id, patch);
      this.editing.number = saved.number;
      const flag = this.body.querySelector('.iv-saved');
      if (flag) { flag.textContent = 'Saved'; flag.classList.remove('is-busy'); }
      this.body.querySelector('#iv-number')?.removeAttribute('aria-invalid');
    } catch (err) {
      const flag = this.body.querySelector('.iv-saved');
      if (flag) { flag.textContent = 'Not saved'; flag.classList.remove('is-busy'); }
      if ('number' in patch) this.body.querySelector('#iv-number')?.setAttribute('aria-invalid', 'true');
      showToast(err.message, 'error');
    } finally { this.muted = false; }
  },
  leaveEditor() {
    this.flushSave();
    const doc = this.editing && this.store.getDoc(this.editing.id);
    this.editing = null;
    if (!doc) return;
    // Drop an untouched new draft rather than leave an empty invoice behind.
    const empty = !doc.clientId && doc.items.every(i => !i.description.trim() && !i.rate);
    if (empty && doc.status === 'draft' && !doc.payments.length && !doc.recurringId) {
      try { this.store.deleteDoc(doc.id); } catch { /* keep it */ }
      if (this.state.docId === doc.id) this.state.docId = null;
      this.discarded = true;
    } else {
      // Drop blank lines.
      const items = doc.items.filter(i => i.description.trim() || i.rate);
      if (items.length !== doc.items.length) this.store.updateDoc(doc.id, { items });
    }
  },

  /* ---------------- clients ---------------- */

  renderClients() {
    const m = this.money;
    const clients = this.store.listClients();
    const docs = this.store.listDocs({ type: 'invoice' });
    const time = this.store.listTime({ unbilled: true });
    this.body.innerHTML = `
      <div class="iv-sec-head"><h2>Clients</h2><span class="iv-hint">${clients.length} client${clients.length === 1 ? '' : 's'}</span></div>
      ${clients.length ? `<div class="iv-clients">${clients.map(c => {
        const mine = docs.filter(d => d.clientId === c.id);
        const owed = mine.filter(d => ['sent', 'partial', 'overdue'].includes(d.effectiveStatus)).reduce((a, d) => a + (d.currency === BASE_CURRENCY ? d.totals.balance : Math.round(d.totals.balance * (d.fxRate || 0))), 0);
        const overdue = mine.some(d => d.effectiveStatus === 'overdue');
        const unbilled = time.filter(e => e.clientId === c.id).length;
        return `<article class="iv-client">
          <div class="iv-client-main">
            <span class="iv-avatar" aria-hidden="true">${esc(c.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase())}</span>
            <div><strong>${esc(c.name)}</strong><span>${esc([c.email, c.phone].filter(Boolean).join(' · ') || 'No contact details')}</span>${c.tin ? `<span>TIN ${esc(c.tin)}</span>` : ''}</div>
          </div>
          <div class="iv-client-figs">
            <div><span>Invoices</span><strong>${mine.length}</strong></div>
            <div${overdue ? ' data-tone="bad"' : ''}><span>Owes you</span><strong>${m(owed, BASE_CURRENCY)}</strong></div>
            ${unbilled ? `<div><span>Unbilled time</span><strong>${unbilled} entr${unbilled === 1 ? 'y' : 'ies'}</strong></div>` : ''}
          </div>
          <div class="iv-client-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-clientinv="${c.id}">${icon('plus', 14)}<span>Invoice</span></button>
            ${mine.length ? `<button type="button" class="btn btn-ghost btn-sm" data-clientdocs="${c.id}">View invoices</button>` : ''}
            <button type="button" class="iv-icon-btn" data-editclient="${c.id}" aria-label="Edit ${esc(c.name)}">${icon('edit', 15)}</button>
          </div>
        </article>`;
      }).join('')}</div>` : `<div class="iv-empty">${icon('users', 28, 1.5)}<strong>No clients yet</strong><span>Save a client once and pick them on every invoice. Their TIN and address print on the invoice.</span><button type="button" class="btn btn-primary btn-sm" data-act="new">${icon('plus', 15)}<span>New client</span></button></div>`}`;
  },

  clientForm(id = null, { onSaved } = {}) {
    const c = id ? this.store.getClient(id) : { name: '', email: '', phone: '', address: '', tin: '', contact: '', hourlyRate: 0 };
    const hasDocs = id && this.store.listDocs({ type: 'all', clientId: id }).length;
    const { el, close } = openModal({
      title: id ? 'Edit client' : 'New client',
      body: `
        <form class="iv-form" id="iv-client-form" novalidate>
          <div class="iv-field"><label class="tool-label" for="cf-name">Name</label><input class="tool-input" id="cf-name" name="name" value="${esc(c.name)}" required placeholder="Company or person"></div>
          <div class="iv-grid-2">
            <div class="iv-field"><label class="tool-label" for="cf-contact">Contact person</label><input class="tool-input" id="cf-contact" name="contact" value="${esc(c.contact)}" placeholder="Optional"></div>
            <div class="iv-field"><label class="tool-label" for="cf-tin">TIN</label><input class="tool-input" id="cf-tin" name="tin" value="${esc(c.tin)}" placeholder="Optional"></div>
            <div class="iv-field"><label class="tool-label" for="cf-email">Email</label><input type="email" class="tool-input" id="cf-email" name="email" value="${esc(c.email)}"></div>
            <div class="iv-field"><label class="tool-label" for="cf-phone">Phone</label><input type="tel" class="tool-input" id="cf-phone" name="phone" value="${esc(c.phone)}" placeholder="+234"></div>
          </div>
          <div class="iv-field"><label class="tool-label" for="cf-address">Address</label><textarea class="tool-textarea" id="cf-address" name="address" rows="3">${esc(c.address)}</textarea></div>
          <div class="iv-field"><label class="tool-label" for="cf-rate">Hourly rate for timesheets</label><input class="tool-input" id="cf-rate" name="hourlyRate" inputmode="decimal" value="${c.hourlyRate ? minorToInput(c.hourlyRate) : ''}" placeholder="Optional"></div>
        </form>`,
      actions: `${id && !hasDocs ? `<button type="button" class="btn btn-ghost btn-sm iv-danger-text" data-act="cf-delete">Delete</button>` : ''}<span class="iv-grow"></span><button type="button" class="btn btn-secondary btn-sm" data-close>Cancel</button><button type="submit" form="iv-client-form" class="btn btn-primary btn-sm">Save client</button>`,
    });
    el.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      if (!f.name.trim()) { el.querySelector('#cf-name').setAttribute('aria-invalid', 'true'); el.querySelector('#cf-name').focus(); return; }
      try {
        const saved = this.store.saveClient({ ...f, id, hourlyRate: toMinor(f.hourlyRate) });
        close();
        showToast(id ? 'Client updated' : `${saved.name} added`, 'success');
        onSaved ? onSaved(saved) : this.show();
      } catch (err) { showToast(err.message, 'error'); }
    });
    el.addEventListener('click', async (e) => {
      if (!e.target.closest('[data-act="cf-delete"]')) return;
      if (!(await tbConfirm(`Delete ${c.name}?`, { destructive: true, title: 'Delete client' }))) return;
      try { this.store.deleteClient(id); close(); this.show(); } catch (err) { showToast(err.message, 'error'); }
    });
  },

  /* ---------------- business profile ---------------- */

  renderBusiness() {
    const p = this.store.getProfile();
    const nextInv = this.store.peekNumber('invoice').number, nextQuo = this.store.peekNumber('quote').number;
    const f = (key, label, opts = {}) => `<div class="iv-field${opts.wide ? ' is-wide' : ''}"><label class="tool-label" for="bp-${key}">${label}</label>${opts.area
      ? `<textarea class="tool-textarea" id="bp-${key}" data-p="${key}" rows="${opts.rows || 3}" placeholder="${esc(opts.ph || '')}">${esc(p[key])}</textarea>`
      : `<input class="tool-input" id="bp-${key}" data-p="${key}" value="${esc(p[key])}" placeholder="${esc(opts.ph || '')}"${opts.type ? ` type="${opts.type}"` : ''}${opts.mode ? ` inputmode="${opts.mode}"` : ''}>`}${opts.help ? `<p class="iv-hint">${opts.help}</p>` : ''}</div>`;
    this.body.innerHTML = `
      ${this.state.onboarding ? `<div class="iv-banner is-plain">${icon('building', 18)}<div><strong>Start with your business details</strong><span>They print on every invoice and quote. You can change them any time.</span></div><button type="button" class="btn btn-primary btn-sm" data-act="onboard-done">Continue to invoices</button></div>` : ''}
      <div class="iv-sec-head"><h2>Business profile</h2><span class="iv-saved" aria-live="polite">Changes save as you type</span></div>
      <div class="iv-biz">
        <div class="iv-biz-col">
        <section class="iv-card">
          <h3>Business</h3>
          <div class="iv-grid-2">
            ${f('name', 'Business name', { wide: true, ph: 'e.g. Adeyemi Containers Ltd' })}
            ${f('address', 'Address', { area: true, wide: true, ph: 'Street, city, state' })}
            ${f('phone', 'Phone', { type: 'tel', ph: '+234' })}
            ${f('email', 'Email', { type: 'email' })}
            ${f('website', 'Website')}
            ${f('rcNumber', 'RC / BN number (CAC)', { ph: 'RC 1234567' })}
            ${f('tin', 'TIN', { ph: 'FIRS tax ID' })}
            ${f('vatNumber', 'VAT registration', { ph: 'Optional' })}
          </div>
        </section>
        <section class="iv-card">
          <h3>Numbering and defaults</h3>
          <div class="iv-grid-2">
            ${f('invoicePrefix', 'Invoice prefix', { help: `Next number: <b>${esc(nextInv)}</b>` })}
            ${f('quotePrefix', 'Quote prefix', { help: `Next number: <b>${esc(nextQuo)}</b>` })}
            ${f('notes', 'Default notes', { area: true, wide: true, rows: 2 })}
            ${f('terms', 'Default terms', { area: true, wide: true, rows: 2, ph: 'e.g. 70% deposit before fabrication, balance on delivery.' })}
          </div>
          <p class="iv-hint">Currency, VAT, withholding tax, due days and template are <button type="button" class="iv-link" data-act="prefs">preferences</button>.</p>
        </section>
        </div>
        <div class="iv-biz-col">
        <section class="iv-card">
          <h3>Bank details</h3>
          <p class="iv-hint">Printed on invoices and included when you share one.</p>
          <div class="iv-grid-2">
            ${f('bankName', 'Bank', { ph: 'e.g. Zenith Bank' })}
            ${f('accountNumber', 'Account number (NUBAN)', { mode: 'numeric', ph: '10 digits' })}
            ${f('accountName', 'Account name', { wide: true })}
          </div>
        </section>
        <section class="iv-card">
          <h3>Logo and signature</h3>
          <div class="iv-images">
            ${['logo', 'signature'].map(k => `
              <div class="iv-image">
                <div class="iv-image-box" data-kind="${k}">${p[k] ? `<img src="${esc(p[k])}" alt="">` : `<span>${k === 'logo' ? 'No logo' : 'No signature'}</span>`}</div>
                <div class="iv-image-actions">
                  <label class="btn btn-secondary btn-sm">${icon('upload', 14)}<span>${p[k] ? 'Replace' : 'Upload'}</span><input type="file" accept="image/*" data-img="${k}" hidden></label>
                  ${p[k] ? `<button type="button" class="btn btn-ghost btn-sm" data-clearimg="${k}">Remove</button>` : ''}
                </div>
                <p class="iv-hint">${k === 'logo' ? 'PNG with a transparent background looks best.' : 'A scan of your signature on white paper.'}</p>
              </div>`).join('')}
          </div>
          <div class="iv-grid-2">
            ${f('signatoryName', 'Signatory name')}
            ${f('signatoryTitle', 'Title', { ph: 'e.g. Managing Director' })}
          </div>
        </section>
        <section class="iv-card">
          <h3>Your data</h3>
          <p class="iv-hint">Everything is kept in this browser. Download a backup now and then, or move it to another device.</p>
          <div class="iv-btnrow">
            <button type="button" class="btn btn-secondary btn-sm" data-act="export-json">${icon('download', 14)}<span>Backup (JSON)</span></button>
            <label class="btn btn-secondary btn-sm">${icon('upload', 14)}<span>Restore backup</span><input type="file" accept=".json,application/json" data-act-file="import-json" hidden></label>
            <button type="button" class="btn btn-secondary btn-sm" data-act="export-csv">${icon('download', 14)}<span>Invoices (CSV)</span></button>
          </div>
        </section>
        </div>
      </div>`;
  },

  /* ---------------- actions ---------------- */

  newDoc(type = this.state.type, extra = {}) {
    const doc = this.store.createDoc({ type, ...extra }, prefsToDefaults(this.prefs));
    this.go({ view: 'edit', docId: doc.id, type });
  },

  paymentDialog(doc) {
    const t = computeTotals(doc);
    const { el, close } = openModal({
      title: `Record payment for ${doc.number}`,
      body: `
        <form class="iv-form" id="iv-pay-form" novalidate>
          <p class="iv-pay-due">Balance due <strong>${this.money(t.balance, doc.currency)}</strong>${t.wht ? `<span>after ${t.whtRate}% WHT of ${this.money(t.wht, doc.currency)}</span>` : ''}</p>
          <div class="iv-grid-2">
            <div class="iv-field"><label class="tool-label" for="pf-amt">Amount received (${doc.currency})</label><input class="tool-input" id="pf-amt" name="amount" inputmode="decimal" value="${minorToInput(t.balance)}"></div>
            <div class="iv-field"><label class="tool-label" for="pf-date">Date</label><input type="date" class="tool-input" id="pf-date" name="date" value="${isoDate()}"></div>
            <div class="iv-field"><label class="tool-label" for="pf-method">Method</label><select class="tool-select" id="pf-method" name="method">${PAYMENT_METHODS.map(x => `<option>${x}</option>`).join('')}</select></div>
            <div class="iv-field"><label class="tool-label" for="pf-ref">Reference</label><input class="tool-input" id="pf-ref" name="reference" placeholder="Transfer or teller ref."></div>
          </div>
          <p class="iv-field-error" hidden></p>
        </form>`,
      actions: `<span class="iv-grow"></span><button type="button" class="btn btn-secondary btn-sm" data-close>Cancel</button><button type="submit" form="iv-pay-form" class="btn btn-primary btn-sm">Record payment</button>`,
    });
    el.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      try {
        const saved = this.store.recordPayment(doc.id, { ...f, amount: toMinor(f.amount) });
        close();
        const st = effectiveStatus(saved);
        showToast(st === 'paid' ? `${doc.number} is paid in full` : `Payment recorded. ${STATUS_LABEL[st]}.`, 'success');
        this.show();
      } catch (err) {
        const p = el.querySelector('.iv-field-error');
        p.textContent = err.message; p.hidden = false;
        el.querySelector('#pf-amt').setAttribute('aria-invalid', 'true');
      }
    });
  },

  shareDialog(doc) {
    const text = this.store.shareText(doc.id, { format: this.prefs.numberFormat });
    const client = this.store.getClient(doc.clientId);
    const phone = (client?.phone || '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^0(?=\d{10}$)/, '234');
    const subject = `${doc.type === 'quote' ? 'Quotation' : 'Invoice'} ${doc.number} from ${this.store.getProfile().name || 'us'}`;
    const { el } = openModal({
      title: 'Share',
      body: `
        <p class="iv-hint">Copy this into an email or WhatsApp, and attach the PDF (Print or PDF, then Save as PDF).</p>
        <textarea class="tool-textarea iv-share-text" rows="11" aria-label="Message">${esc(text)}</textarea>`,
      actions: `
        <a class="btn btn-secondary btn-sm" data-share="mail" href="mailto:${esc(client?.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}">${icon('mail', 14)}<span>Email</span></a>
        <a class="btn btn-secondary btn-sm" data-share="wa" target="_blank" rel="noopener" href="https://wa.me/${phone}?text=${encodeURIComponent(text)}">${icon('whatsapp', 14)}<span>WhatsApp</span></a>
        <span class="iv-grow"></span>
        <button type="button" class="btn btn-primary btn-sm" data-share="copy">${icon('copy', 14)}<span>Copy message</span></button>`,
    });
    const ta = el.querySelector('textarea');
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-share]');
      if (!b) return;
      if (b.dataset.share === 'copy') {
        const ok = await copyToClipboard(ta.value);
        const span = b.querySelector('span'); span.textContent = ok ? 'Copied' : 'Copy failed';
        setTimeout(() => { span.textContent = 'Copy message'; }, 1400);
      } else if (b.dataset.share === 'mail') b.href = `mailto:${encodeURIComponent(client?.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(ta.value)}`;
      else b.href = `https://wa.me/${phone}?text=${encodeURIComponent(ta.value)}`;
    });
  },

  recurringDialog(doc) {
    const rec = this.store.getRecurringFor(doc.id);
    const { el, close } = openModal({
      title: 'Repeat this invoice',
      body: `
        <form class="iv-form" id="iv-rec-form">
          <p class="iv-hint">Each period a new draft copy of ${esc(doc.number)} is made with fresh dates and the next number. Check it and send it.</p>
          <div class="iv-field"><label class="tool-label" for="rf-freq">Repeat</label>
            <select class="tool-select" id="rf-freq" name="freq">
              <option value="none">Does not repeat</option>
              <option value="monthly"${rec?.frequency === 'monthly' ? ' selected' : ''}>Every month</option>
              <option value="quarterly"${rec?.frequency === 'quarterly' ? ' selected' : ''}>Every quarter</option>
            </select>
          </div>
        </form>`,
      actions: `<span class="iv-grow"></span><button type="button" class="btn btn-secondary btn-sm" data-close>Cancel</button><button type="submit" form="iv-rec-form" class="btn btn-primary btn-sm">Save</button>`,
    });
    el.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const r = this.store.setRecurring(doc.id, el.querySelector('#rf-freq').value);
      close();
      showToast(r ? `Next draft on ${formatDate(r.nextDate)}` : 'Repeat turned off', 'success');
      this.show();
    });
  },

  async handleClick(e) {
    const t = e.target;
    const tab = t.closest('[data-tab]');
    if (tab) {
      const k = tab.dataset.tab;
      if (k === 'invoice' || k === 'quote') this.go({ view: 'list', type: k, filter: this.state.type === k ? this.state.filter : 'all', clientFilter: null });
      else this.go({ view: k, onboarding: false });
      return;
    }
    const open = t.closest('[data-open]');
    if (open) { const d = this.store.getDoc(open.dataset.open); if (d) this.go({ view: 'doc', docId: d.id, type: d.type }); return; }
    const filter = t.closest('[data-filter]');
    if (filter) { this.state.filter = filter.dataset.filter; this.renderList(); return; }
    const tpl = t.closest('[data-tpl]');
    if (tpl) { this.store.updateDoc(this.state.docId, { template: tpl.dataset.tpl }); this.renderDoc(); return; }
    const vat = t.closest('[data-vat]');
    if (vat && this.editing && vat.tagName === 'BUTTON') {
      this.editing.vat = { ...this.editing.vat, mode: vat.dataset.vat };
      for (const b of vat.parentElement.children) b.setAttribute('aria-checked', String(b === vat));
      vat.closest('.iv-taxrow').querySelector('.iv-rate').hidden = vat.dataset.vat === 'none';
      this.body.querySelector('.iv-items').dataset.vat = vat.dataset.vat;
      this.renderTotals(); this.queueSave();
      return;
    }
    const wht = t.closest('[data-wht]');
    if (wht && this.editing) {
      for (const b of wht.parentElement.children) b.setAttribute('aria-checked', String(b === wht));
      const rateBox = wht.closest('.iv-taxrow').querySelector('.iv-rate');
      if (wht.dataset.wht === 'custom') { rateBox.hidden = false; rateBox.querySelector('input').focus(); rateBox.querySelector('input').select(); return; }
      rateBox.hidden = true;
      this.editing.wht = { rate: Number(wht.dataset.wht) };
      rateBox.querySelector('input').value = wht.dataset.wht;
      this.renderTotals(); this.queueSave();
      return;
    }
    const delItem = t.closest('[data-delitem]');
    if (delItem) {
      const i = Number(delItem.dataset.delitem);
      const it = this.editing.items[i];
      if (it?.timeIds?.length) showToast('Its time entries stay marked as invoiced until this invoice is voided or deleted.', 'info', 5000);
      this.editing.items.splice(i, 1);
      if (!this.editing.items.length) this.editing.items.push(this.blankItem());
      this.renderItems(); this.renderTotals(); this.queueSave();
      this.body.querySelector(`.iv-item[data-i="${Math.max(0, i - 1)}"] .iv-in-desc`)?.focus();
      return;
    }
    const delPay = t.closest('[data-delpay]');
    if (delPay) {
      if (!(await tbConfirm('Remove this payment?', { destructive: true, confirmText: 'Remove', title: 'Remove payment' }))) return;
      this.store.deletePayment(this.state.docId, delPay.dataset.delpay); this.renderDoc(); return;
    }
    const editClient = t.closest('[data-editclient]');
    if (editClient) {
      this.clientForm(editClient.dataset.editclient, { onSaved: () => { if (this.state.view === 'edit') { this.body.querySelector('.iv-client-card').innerHTML = this.clientCard(this.editing.clientId); const opt = this.body.querySelector(`#iv-client option[value="${editClient.dataset.editclient}"]`); if (opt) opt.textContent = this.store.getClient(editClient.dataset.editclient).name; } else this.show(); } });
      return;
    }
    const clientInv = t.closest('[data-clientinv]');
    if (clientInv) { this.newDoc('invoice', { clientId: clientInv.dataset.clientinv }); return; }
    const clientDocs = t.closest('[data-clientdocs]');
    if (clientDocs) { this.go({ view: 'list', type: 'invoice', filter: 'all', clientFilter: clientDocs.dataset.clientdocs }); return; }
    const clearImg = t.closest('[data-clearimg]');
    if (clearImg) { this.store.updateProfile({ [clearImg.dataset.clearimg]: '' }); this.renderBusiness(); return; }

    const act = t.closest('[data-act]')?.dataset.act;
    if (!act) return;
    const doc = this.state.docId ? this.store.getDoc(this.state.docId) : null;
    this.closeMenu();
    try {
      switch (act) {
        case 'prefs': openSettings(`tool:${TOOL_ID}`); break;
        case 'new':
          if (this.state.view === 'clients') this.clientForm();
          else this.newDoc(this.state.type);
          break;
        case 'goto-business': this.go({ view: 'business' }); break;
        case 'onboard-done': this.go({ view: 'list', type: 'invoice', onboarding: false }); break;
        case 'clear-client': this.go({ view: 'list', clientFilter: null }); break;
        case 'back': this.go({ view: 'list', type: doc?.type || this.state.type }); break;
        case 'done':
          this.flushSave();
          this.go({ view: 'doc' });
          if (this.discarded) { this.discarded = false; this.go({ view: 'list' }); }
          break;
        case 'edit': this.go({ view: 'edit' }); break;
        case 'send': this.store.markSent(doc.id); showToast(`${doc.number} marked as sent`, 'success'); this.renderDoc(); break;
        case 'pay': this.paymentDialog(doc); break;
        case 'share': this.shareDialog(doc); break;
        case 'print': {
          const paper = this.body.querySelector('.iv-paper');
          const client = this.store.getClient(doc.clientId);
          printElement(paper, { title: `${doc.number}${client ? ` ${client.name}` : ''}` });
          break;
        }
        case 'more': this.moreMenu(t.closest('[data-act]')); break;
        case 'duplicate': { const c = this.store.duplicateDoc(doc.id); showToast(`Copied to ${c.number}`, 'success'); this.go({ view: 'edit', docId: c.id, type: c.type }); break; }
        case 'as-quote': { const c = this.store.duplicateDoc(doc.id, { type: 'quote' }); showToast(`Copied to quote ${c.number}`, 'success'); this.go({ view: 'edit', docId: c.id, type: 'quote' }); break; }
        case 'convert': { const inv = this.store.convertQuote(doc.id); showToast(`Invoice ${inv.number} created from ${doc.number}`, 'success'); this.go({ view: 'doc', docId: inv.id, type: 'invoice' }); break; }
        case 'accept': this.store.setQuoteStatus(doc.id, 'accepted'); this.renderDoc(); break;
        case 'decline': this.store.setQuoteStatus(doc.id, 'declined'); this.renderDoc(); break;
        case 'to-draft': this.store.markDraft(doc.id); this.renderDoc(); break;
        case 'recurring': this.recurringDialog(doc); break;
        case 'void':
          if (await tbConfirm(`Void ${doc.number}? It stays in your records, marked void, and its number is not reused.`, { destructive: true, confirmText: 'Void', title: 'Void invoice' })) {
            this.store.voidDoc(doc.id); this.renderDoc();
          }
          break;
        case 'delete':
          if (await tbConfirm(`Delete ${doc.number}? This cannot be undone.`, { destructive: true, title: 'Delete' })) {
            this.store.deleteDoc(doc.id); showToast(`${doc.number} deleted`); this.go({ view: 'list', docId: null });
          }
          break;
        case 'add-item': this.addItemRow(); break;
        case 'new-client-inline':
          this.clientForm(null, { onSaved: (c) => {
            this.editing.clientId = c.id;
            const sel = this.body.querySelector('#iv-client');
            sel.insertAdjacentHTML('beforeend', `<option value="${c.id}">${esc(c.name)}</option>`);
            sel.value = c.id;
            this.body.querySelector('.iv-client-card').innerHTML = this.clientCard(c.id);
            this.queueSave({ clientId: c.id });
          } });
          break;
        case 'data-menu': this.showMenu(t.closest('[data-act]'), [['export-csv', 'download', 'Export invoices (CSV)'], ['export-quotes-csv', 'download', 'Export quotes (CSV)'], ['export-json', 'download', 'Backup everything (JSON)']]); break;
        case 'export-csv': downloadText(this.store.invoicesCSV({ type: 'invoice' }), `invoices-${isoDate()}.csv`, 'text/csv'); break;
        case 'export-quotes-csv': downloadText(this.store.invoicesCSV({ type: 'quote' }), `quotes-${isoDate()}.csv`, 'text/csv'); break;
        case 'export-json': downloadText(this.store.exportJSON(), `invoicing-backup-${isoDate()}.json`, 'application/json'); break;
        default: break;
      }
    } catch (err) { showToast(err.message, 'error', 5000); }
  },

  addItemRow(focusField = 'description') {
    this.editing.items.push(this.blankItem());
    this.renderItems(); this.renderTotals();
    const rows = this.body.querySelectorAll('.iv-item-rows .iv-item');
    rows[rows.length - 1]?.querySelector(`[data-li="${focusField}"]`)?.focus();
  },

  handleKey(e) {
    if (e.key === 'Escape' && this.menu) { this.closeMenu(); return; }
    const li = e.target.dataset?.li;
    if (!li || !this.editing || li === 'vat') return;
    const row = e.target.closest('.iv-item');
    const i = Number(row.dataset.i);
    if (e.key === 'Enter' || (e.key === 'ArrowDown' && li !== 'unit') || e.key === 'ArrowUp') {
      if (li === 'unit' && e.key !== 'Enter') return;
      e.preventDefault();
      const next = e.key === 'ArrowUp' ? i - 1 : i + 1;
      if (next < 0) return;
      const target = this.body.querySelector(`.iv-item[data-i="${next}"] [data-li="${li}"]`);
      if (target) { target.focus(); target.select?.(); } else if (e.key !== 'ArrowUp') {
        const cur = this.editing.items[i];
        if (cur.description.trim() || cur.rate) this.addItemRow('description');
      }
    } else if (e.key === 'Backspace' && li === 'description' && !e.target.value && this.editing.items.length > 1) {
      const it = this.editing.items[i];
      if (it.rate || it.timeIds?.length) return;
      e.preventDefault();
      this.editing.items.splice(i, 1);
      this.renderItems(); this.renderTotals(); this.queueSave();
      const prev = this.body.querySelector(`.iv-item[data-i="${Math.max(0, i - 1)}"] .iv-in-desc`);
      prev?.focus(); prev?.setSelectionRange?.(prev.value.length, prev.value.length);
    }
  },

  handleInput(e) {
    const t = e.target;
    if (t.dataset.f === 'q') { this.state.q = t.value; clearTimeout(this.qTimer); this.qTimer = setTimeout(() => { const pos = t.selectionStart; this.renderList(); const inp = this.body.querySelector('[data-f="q"]'); inp.focus(); inp.setSelectionRange(pos, pos); }, 160); return; }
    if (t.dataset.p) { (this.profDirty ||= new Set()).add(t); clearTimeout(this.profTimer); this.profTimer = setTimeout(() => this.flushProfile(), 300); return; }
    if (!this.editing) return;
    const li = t.dataset.li;
    if (li && li !== 'vat') {
      const i = Number(t.closest('.iv-item').dataset.i);
      const it = this.editing.items[i];
      if (li === 'rate') it.rate = toMinor(t.value);
      else if (li === 'qty') it.qty = Number(String(t.value).replace(/[^0-9.\-]/g, '')) || 0;
      else if (li === 'discount') it.discount = Math.min(100, Math.max(0, Number(String(t.value).replace(/[^0-9.]/g, '')) || 0));
      else it[li] = t.value;
      this.renderTotals(); this.queueSave();
      return;
    }
    const f = t.dataset.f;
    if (f === 'vatRate') { this.editing.vat = { ...this.editing.vat, rate: Number(t.value) || 0 }; this.renderTotals(); this.queueSave(); }
    else if (f === 'whtRate') { this.editing.wht = { rate: Math.min(100, Number(t.value) || 0) }; this.renderTotals(); this.queueSave(); }
    else if (['reference', 'notes', 'terms'].includes(f)) { this.editing[f] = t.value; this.queueSave({ [f]: t.value }); }
    else if (f === 'fxRate') { this.editing.fxRate = Number(t.value) || 0; this.renderTotals(); this.queueSave({ fxRate: this.editing.fxRate }); }
  },

  async handleChange(e) {
    const t = e.target;
    if (t.dataset.img) {
      try {
        const url = await imageToDataURL(t.files?.[0], t.dataset.img === 'logo' ? 520 : 420, t.dataset.img === 'logo' ? 260 : 180);
        this.store.updateProfile({ [t.dataset.img]: url });
        this.renderBusiness();
      } catch (err) { showToast(err.message, 'error'); }
      return;
    }
    if (t.dataset.actFile === 'import-json') {
      const file = t.files?.[0];
      if (!file) return;
      if (!(await tbConfirm('Replace everything here with the backup? Your current invoices, clients and time entries will be overwritten.', { destructive: true, confirmText: 'Restore', title: 'Restore backup' }))) { t.value = ''; return; }
      try { const r = this.store.importJSON(await file.text()); showToast(`Restored ${r.docs} documents, ${r.clients} clients and ${r.time} time entries`, 'success'); this.show(); }
      catch (err) { showToast(err.message, 'error'); }
      return;
    }
    if (!this.editing) return;
    const li = t.dataset.li;
    if (li === 'vat') {
      const i = Number(t.closest('.iv-item').dataset.i);
      this.editing.items[i].vat = t.checked;
      this.renderTotals(); this.queueSave();
      return;
    }
    if (li === 'rate' && t.value) { t.value = minorToInput(toMinor(t.value)); return; }
    const f = t.dataset.f;
    if (f === 'number') { this.queueSave({ number: t.value }); this.flushSave(); t.value = this.store.getDoc(this.editing.id)?.number || t.value; return; }
    if (f === 'clientId') {
      this.editing.clientId = t.value || null;
      this.body.querySelector('.iv-client-card').innerHTML = this.clientCard(t.value);
      this.queueSave({ clientId: t.value || null });
    } else if (f === 'issueDate' && t.value) {
      const dueIn = daysBetween(this.editing.issueDate, this.editing.dueDate);
      this.editing.issueDate = t.value;
      this.editing.dueDate = addDays(t.value, dueIn);
      this.body.querySelector('#iv-due').value = this.editing.dueDate;
      this.queueSave({ issueDate: t.value, dueDate: this.editing.dueDate });
    } else if (f === 'dueDate' && t.value) {
      this.editing.dueDate = t.value;
      const sel = this.body.querySelector('[data-f="dueIn"]');
      const d = daysBetween(this.editing.issueDate, t.value);
      if (![...sel.options].some(o => Number(o.value) === d)) sel.insertAdjacentHTML('beforeend', `<option value="${d}">${d} days</option>`);
      sel.value = String(d);
      this.queueSave({ dueDate: t.value });
    } else if (f === 'dueIn') {
      this.editing.dueDate = addDays(this.editing.issueDate, Number(t.value));
      this.body.querySelector('#iv-due').value = this.editing.dueDate;
      this.queueSave({ dueDate: this.editing.dueDate });
    } else if (f === 'currency') {
      this.editing.currency = t.value;
      const fx = this.body.querySelector('.iv-fx');
      fx.hidden = t.value === BASE_CURRENCY;
      fx.querySelector('label').textContent = `Naira per 1 ${t.value}`;
      this.renderItems(); this.renderTotals();
      this.queueSave({ currency: t.value });
    } else if (f === 'recurring') {
      this.flushSave();
      const r = this.store.setRecurring(this.editing.id, t.value);
      this.body.querySelector('.iv-rec-hint').textContent = r ? `Next draft on ${formatDate(r.nextDate)}. It is created when you open Invoices on or after that day.` : 'A new draft copy is made each period, ready to check and send.';
    }
  },

  flushProfile() {
    clearTimeout(this.profTimer);
    const dirty = [...(this.profDirty || [])];
    this.profDirty = null;
    for (const input of dirty) this.saveProfileField(input);
  },

  saveProfileField(input) {
    const key = input.dataset.p;
    let v = input.value;
    if (key === 'invoicePrefix' || key === 'quotePrefix') v = v.replace(/[^A-Za-z0-9/_-]/g, '').toUpperCase().slice(0, 12);
    this.store.updateProfile({ [key]: v });
    const flag = this.body.querySelector('.iv-saved');
    if (flag) { flag.textContent = 'Saved'; clearTimeout(this.flagTimer); this.flagTimer = setTimeout(() => { flag.textContent = 'Changes save as you type'; }, 1500); }
    if (key === 'invoicePrefix' || key === 'quotePrefix') {
      const help = input.parentElement.querySelector('.iv-hint b');
      if (help) help.textContent = this.store.peekNumber(key === 'quotePrefix' ? 'quote' : 'invoice').number;
    }
  },

  getArtifact() {
    const doc = this.state?.docId && this.store?.getDoc(this.state.docId);
    if (!doc) return null;
    const client = this.store.getClient(doc.clientId);
    const t = computeTotals(doc);
    return {
      kind: 'json',
      name: `${doc.number}.json`,
      text: JSON.stringify({ ...doc, client: client ? { name: client.name, address: client.address, email: client.email, tin: client.tin } : null, totals: t }, null, 2),
    };
  },

  setArtifact(incoming) {
    const p = this.importArtifact(incoming);
    if (p) this.openPending(p);
  },

  destroy() {
    if (this.state?.view === 'edit') this.leaveEditor();
    this.flushProfile?.();
    closeModal();
    this.closeMenu?.();
    clearTimeout(this.saveTimer); clearTimeout(this.qTimer); clearTimeout(this.profTimer);
    this.offPrefs?.(); this.offStore?.();
    this.ro?.disconnect();
    if (this.container) {
      this.container.removeEventListener('click', this.onClick);
      this.container.removeEventListener('input', this.onInput);
      this.container.removeEventListener('change', this.onChange);
      this.container.removeEventListener('keydown', this.onKey);
    }
    this.container = this.root = this.body = this.editing = null;
  },
};
