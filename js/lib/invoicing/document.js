/* ============================================================
   TOOLBOX — Invoice / quote document (A4)

   Renders a document as print-ready HTML in one of three
   templates: classic, modern, compact. The page is always
   paper-white with black ink, whatever the app theme, because
   it is what the client will receive.
   ============================================================ */

import { computeTotals, amountInWords, formatMoney, formatDate, STATUS_LABEL, effectiveStatus, formatNumber, BASE_CURRENCY } from './store.js';
import { esc } from './ui.js';

const lines = (s) => esc(s).split('\n').map(l => l.trim()).filter(Boolean).map(l => `<span>${l}</span>`).join('');
const qtyText = (q) => {
  const n = Number(q) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
};

export function renderDocument(doc, { profile = {}, client = null, prefs = {} } = {}) {
  const tpl = ['classic', 'modern', 'compact'].includes(doc.template) ? doc.template : 'classic';
  const fmt = prefs.numberFormat || 'standard';
  const m = (v) => formatMoney(v, doc.currency, { format: fmt });
  const n = (v) => formatNumber(v, { format: fmt });
  const t = computeTotals(doc);
  const st = effectiveStatus(doc);
  const isQuote = doc.type === 'quote';
  const title = isQuote ? 'Quotation' : (t.vat > 0 ? 'Tax Invoice' : 'Invoice');
  const showVatCol = doc.vat?.mode === 'line';
  const hasDisc = doc.items.some(i => Number(i.discount) > 0);
  const hasUnit = doc.items.some(i => i.unit);

  const bizIds = [
    profile.rcNumber && (/^(rc|bn|it)\b/i.test(profile.rcNumber.trim()) ? esc(profile.rcNumber.trim()) : `RC ${esc(profile.rcNumber)}`),
    profile.tin && `TIN ${esc(profile.tin)}`,
    profile.vatNumber && `VAT ${esc(profile.vatNumber)}`,
  ].filter(Boolean).join(' &middot; ');
  const contact = [profile.phone, profile.email, profile.website].filter(Boolean).map(esc).join(' &middot; ');

  const meta = [
    [isQuote ? 'Quote no.' : 'Invoice no.', esc(doc.number)],
    ['Issue date', formatDate(doc.issueDate)],
    [isQuote ? 'Valid until' : 'Due date', formatDate(doc.dueDate)],
    doc.reference ? ['Reference', esc(doc.reference)] : null,
    doc.currency !== BASE_CURRENCY && doc.fxRate > 0 ? ['Exchange rate', `1 ${doc.currency} = ₦${n(Math.round(doc.fxRate * 100))}`] : null,
  ].filter(Boolean);

  const head = tpl === 'modern' ? `
    <header class="ivp-band">
      <div class="ivp-brand">
        ${profile.logo ? `<img class="ivp-logo" src="${esc(profile.logo)}" alt="">` : ''}
        <div><strong class="ivp-bizname">${esc(profile.name || 'Your business name')}</strong>${bizIds ? `<small>${bizIds}</small>` : ''}</div>
      </div>
      <div class="ivp-title"><h1>${title}</h1><span>${esc(doc.number)}</span></div>
    </header>` : `
    <header class="ivp-head">
      <div class="ivp-brand">
        ${profile.logo ? `<img class="ivp-logo" src="${esc(profile.logo)}" alt="">` : ''}
        <div class="ivp-from">
          <strong class="ivp-bizname">${esc(profile.name || 'Your business name')}</strong>
          ${lines(profile.address)}
          ${contact ? `<span>${contact}</span>` : ''}
          ${bizIds ? `<span class="ivp-ids">${bizIds}</span>` : ''}
        </div>
      </div>
      <div class="ivp-title"><h1>${title}</h1>${tpl === 'compact' ? '' : `<span>${esc(doc.number)}</span>`}</div>
    </header>`;

  const billTo = `
    <div class="ivp-party">
      <h4>${isQuote ? 'Prepared for' : 'Bill to'}</h4>
      ${client ? `<strong>${esc(client.name)}</strong>${lines(client.address)}${client.email ? `<span>${esc(client.email)}</span>` : ''}${client.phone ? `<span>${esc(client.phone)}</span>` : ''}${client.tin ? `<span>TIN ${esc(client.tin)}</span>` : ''}`
        : '<span class="ivp-faint">No client selected</span>'}
    </div>`;

  const fromBlock = tpl === 'modern' ? `
    <div class="ivp-party">
      <h4>From</h4>
      ${lines(profile.address)}
      ${contact ? `<span>${contact}</span>` : ''}
    </div>` : '';

  const metaBlock = `<dl class="ivp-meta">${meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;

  const rows = doc.items.map((it, i) => {
    const lt = t.lines[i];
    return `<tr>
      <td class="ivp-num">${i + 1}</td>
      <td class="ivp-desc">${esc(it.description) || '<span class="ivp-faint">No description</span>'}</td>
      <td class="r">${qtyText(it.qty)}${hasUnit && it.unit ? ` <small>${esc(it.unit)}</small>` : ''}</td>
      <td class="r">${n(it.rate)}</td>
      ${hasDisc ? `<td class="r">${Number(it.discount) ? `${Number(it.discount)}%` : ''}</td>` : ''}
      ${showVatCol ? `<td class="c">${lt.vatable ? `${doc.vat.rate}%` : '–'}</td>` : ''}
      <td class="r">${n(lt.net)}</td>
    </tr>`;
  }).join('');

  const totals = `
    <table class="ivp-totals">
      <tr><th>Subtotal</th><td>${m(t.subtotal)}</td></tr>
      ${t.discount ? `<tr class="ivp-sub"><th>Includes discounts of</th><td>${m(t.discount)}</td></tr>` : ''}
      ${doc.vat?.mode !== 'none' ? `<tr><th>VAT (${doc.vat.rate}%)</th><td>${m(t.vat)}</td></tr>` : ''}
      <tr class="ivp-grand"><th>Total</th><td>${m(t.total)}</td></tr>
      ${!isQuote && t.wht ? `<tr><th>Less WHT (${t.whtRate}%)</th><td>(${m(t.wht)})</td></tr>
        <tr class="ivp-strong"><th>Amount payable</th><td>${m(t.payable)}</td></tr>` : ''}
      ${!isQuote && t.paid ? `<tr><th>Paid</th><td>(${m(t.paid)})</td></tr>
        <tr class="ivp-strong"><th>Balance due</th><td>${m(t.balance)}</td></tr>` : ''}
    </table>`;

  const wordsAmount = isQuote ? t.total : (t.paid ? t.balance : t.payable);
  const words = prefs.amountInWords !== false && wordsAmount > 0 ? `
    <p class="ivp-words"><span>Amount in words</span>${esc(amountInWords(wordsAmount, doc.currency))}</p>` : '';

  const bank = !isQuote && (profile.bankName || profile.accountNumber) ? `
    <div class="ivp-bank">
      <h4>Payment details</h4>
      <dl>
        ${profile.bankName ? `<div><dt>Bank</dt><dd>${esc(profile.bankName)}</dd></div>` : ''}
        ${profile.accountName ? `<div><dt>Account name</dt><dd>${esc(profile.accountName)}</dd></div>` : ''}
        ${profile.accountNumber ? `<div><dt>Account no.</dt><dd class="ivp-mono">${esc(profile.accountNumber)}</dd></div>` : ''}
        <div><dt>Reference</dt><dd>${esc(doc.number)}</dd></div>
      </dl>
    </div>` : '<div></div>';

  const sign = profile.signature || profile.signatoryName ? `
    <div class="ivp-sign">
      ${profile.signature ? `<img src="${esc(profile.signature)}" alt="">` : '<i></i>'}
      <strong>${esc(profile.signatoryName || '')}</strong>
      ${profile.signatoryTitle ? `<span>${esc(profile.signatoryTitle)}</span>` : ''}
      <span>For ${esc(profile.name || '')}</span>
    </div>` : '';

  const whtNote = !isQuote && t.wht ? `<p class="ivp-small">Withholding tax of ${m(t.wht)} (${t.whtRate}% of ${m(t.subtotal)}) may be deducted at source. Please send the WHT credit note to us.</p>` : '';

  const stamp = ['paid', 'void'].includes(st) ? `<div class="ivp-stamp" data-s="${st}">${STATUS_LABEL[st]}</div>` : '';

  return `
    <article class="iv-paper ivp-${tpl}" data-template="${tpl}">
      ${stamp}
      ${head}
      <section class="ivp-parties">${billTo}${fromBlock}${metaBlock}</section>
      <table class="ivp-items">
        <thead><tr>
          <th class="ivp-num">#</th><th>Description</th><th class="r">Qty</th><th class="r">Rate</th>
          ${hasDisc ? '<th class="r">Disc.</th>' : ''}${showVatCol ? '<th class="c">VAT</th>' : ''}<th class="r">Amount (${esc(doc.currency)})</th>
        </tr></thead>
        <tbody>${rows || `<tr><td></td><td colspan="${4 + (hasDisc ? 1 : 0) + (showVatCol ? 1 : 0)}" class="ivp-faint">No items yet</td></tr>`}</tbody>
      </table>
      <section class="ivp-summary">
        <div class="ivp-summary-left">${words}${whtNote}</div>
        ${totals}
      </section>
      <section class="ivp-foot">${bank}${sign}</section>
      ${doc.notes?.trim() ? `<section class="ivp-notes"><h4>Notes</h4><p>${esc(doc.notes).replace(/\n/g, '<br>')}</p></section>` : ''}
      ${doc.terms?.trim() ? `<section class="ivp-notes"><h4>Terms</h4><p>${esc(doc.terms).replace(/\n/g, '<br>')}</p></section>` : ''}
      <footer class="ivp-pagefoot">${esc(profile.name || '')}${bizIds ? ` &middot; ${bizIds}` : ''}</footer>
    </article>`;
}
