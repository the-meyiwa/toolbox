import { currencySelect, money, num, parseNum, escapeHtml } from '../lib/biz.js';

/* Builds an invoice you can print or save as PDF straight from the
   browser's print dialogue. Nothing is uploaded — the whole document
   lives in this page. */

let uid = 0;
const BLANK_LINE = () => ({ id: ++uid, description: '', qty: 1, price: 0 });

function todayISO(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined,
    { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export default {
  render(container) {
    const state = {
      from: 'Your Company Ltd\n12 Example Street\nLondon EC1A 1AA\nvat: GB123456789',
      to: 'Northwind Ltd\n40 Client Road\nManchester M1 2AB',
      number: `INV-${new Date().getFullYear()}-001`,
      issued: todayISO(),
      due: todayISO(30),
      notes: 'Payment within 30 days.\nBank: Example Bank · Sort 00-00-00 · Account 12345678',
      taxRate: 20,
      taxLabel: 'VAT',
      discount: 0,
      lines: [
        { id: ++uid, description: 'Discovery workshop', qty: 1, price: 2400 },
        { id: ++uid, description: 'Design & build (days)', qty: 12, price: 650 },
        { id: ++uid, description: 'Hosting setup', qty: 1, price: 400 },
      ],
    };

    container.innerHTML = `
      <div class="inv">
        <aside class="inv-form">
          <div class="biz-field">
            <label class="tool-label" for="inv-cur">Currency</label>
            ${currencySelect('inv-cur', 'GBP')}
          </div>

          <div class="inv-grid-2">
            <div class="biz-field">
              <label class="tool-label" for="inv-number">Invoice number</label>
              <input type="text" class="tool-input" id="inv-number" value="${escapeHtml(state.number)}">
            </div>
            <div class="biz-field">
              <label class="tool-label" for="inv-issued">Issued</label>
              <input type="date" class="tool-input" id="inv-issued" value="${state.issued}">
            </div>
            <div class="biz-field">
              <label class="tool-label" for="inv-due">Due</label>
              <input type="date" class="tool-input" id="inv-due" value="${state.due}">
            </div>
          </div>

          <div class="biz-field">
            <label class="tool-label" for="inv-from">From (you)</label>
            <textarea class="tool-textarea" id="inv-from" rows="4">${escapeHtml(state.from)}</textarea>
          </div>

          <div class="biz-field">
            <label class="tool-label" for="inv-to">Bill to</label>
            <textarea class="tool-textarea" id="inv-to" rows="4">${escapeHtml(state.to)}</textarea>
          </div>

          <label class="tool-label" style="margin-top:6px;">Line items</label>
          <div class="inv-lines-head"><span>Description</span><span class="ta-right">Qty</span><span class="ta-right">Price</span><span></span></div>
          <div id="inv-lines"></div>
          <button class="btn btn-secondary btn-sm" id="inv-add" style="margin-top:8px;">Add a line</button>

          <div class="inv-grid-2" style="margin-top:20px;">
            <div class="biz-field">
              <label class="tool-label" for="inv-tax-label">Tax name</label>
              <input type="text" class="tool-input" id="inv-tax-label" value="${escapeHtml(state.taxLabel)}">
            </div>
            <div class="biz-field">
              <label class="tool-label" for="inv-tax">Tax rate (%)</label>
              <input type="number" class="tool-input" id="inv-tax" value="${state.taxRate}" min="0" max="100" step="0.5">
            </div>
            <div class="biz-field">
              <label class="tool-label" for="inv-discount">Discount (%)</label>
              <input type="number" class="tool-input" id="inv-discount" value="${state.discount}" min="0" max="100" step="0.5">
            </div>
          </div>

          <div class="biz-field">
            <label class="tool-label" for="inv-notes">Notes &amp; payment details</label>
            <textarea class="tool-textarea" id="inv-notes" rows="3">${escapeHtml(state.notes)}</textarea>
          </div>

          <button class="btn btn-primary" id="inv-print" style="margin-top:14px; width:100%;">Print or save as PDF</button>
          <p class="biz-hint">Choose “Save as PDF” as the destination in the print dialogue.</p>
        </aside>

        <div class="inv-preview-wrap">
          <div class="inv-preview" id="inv-doc"></div>
        </div>
      </div>`;

    const linesEl = container.querySelector('#inv-lines');
    const docEl   = container.querySelector('#inv-doc');

    function renderLines() {
      linesEl.innerHTML = state.lines.map(l => `
        <div class="inv-line" data-id="${l.id}">
          <input type="text"   class="tool-input" data-k="description" value="${escapeHtml(l.description)}" placeholder="What you are charging for">
          <input type="number" class="tool-input ta-right" data-k="qty"   value="${l.qty}"   min="0" step="0.25">
          <input type="number" class="tool-input ta-right" data-k="price" value="${l.price}" min="0" step="10">
          <button class="ct-del" data-del="${l.id}" aria-label="Remove line">×</button>
        </div>`).join('');
    }

    function readForm() {
      state.number   = container.querySelector('#inv-number').value;
      state.issued   = container.querySelector('#inv-issued').value;
      state.due      = container.querySelector('#inv-due').value;
      state.from     = container.querySelector('#inv-from').value;
      state.to       = container.querySelector('#inv-to').value;
      state.notes    = container.querySelector('#inv-notes').value;
      state.taxRate  = parseNum(container.querySelector('#inv-tax'));
      state.taxLabel = container.querySelector('#inv-tax-label').value;
      state.discount = parseNum(container.querySelector('#inv-discount'));
    }

    function renderDoc() {
      const cur = container.querySelector('#inv-cur').value;

      const subtotal = state.lines.reduce((s, l) => s + Math.max(l.qty, 0) * Math.max(l.price, 0), 0);
      const discount = subtotal * Math.min(Math.max(state.discount, 0), 100) / 100;
      const taxable  = subtotal - discount;
      const tax      = taxable * Math.max(state.taxRate, 0) / 100;
      const total    = taxable + tax;

      const addr = (s) => escapeHtml(s).split('\n').filter(Boolean).map(l => `<div>${l}</div>`).join('');

      docEl.innerHTML = `
        <header class="inv-head">
          <div>
            <h1>Invoice</h1>
            <p class="inv-number">${escapeHtml(state.number)}</p>
          </div>
          <div class="inv-total-badge">
            <span>Amount due</span>
            <strong>${money(total, cur, { dp: 2 })}</strong>
          </div>
        </header>

        <section class="inv-parties">
          <div><h3>From</h3>${addr(state.from)}</div>
          <div><h3>Bill to</h3>${addr(state.to)}</div>
          <div>
            <h3>Dates</h3>
            <div>Issued: ${fmtDate(state.issued)}</div>
            <div>Due: ${fmtDate(state.due)}</div>
          </div>
        </section>

        <table class="inv-table">
          <thead><tr>
            <th>Description</th>
            <th class="ta-right">Qty</th>
            <th class="ta-right">Unit price</th>
            <th class="ta-right">Amount</th>
          </tr></thead>
          <tbody>
            ${state.lines.filter(l => l.description.trim() || l.qty || l.price).map(l => `
              <tr>
                <td>${escapeHtml(l.description) || '<span class="inv-faint">—</span>'}</td>
                <td class="ta-right">${num(l.qty, l.qty % 1 ? 2 : 0)}</td>
                <td class="ta-right">${money(l.price, cur, { dp: 2 })}</td>
                <td class="ta-right">${money(Math.max(l.qty, 0) * Math.max(l.price, 0), cur, { dp: 2 })}</td>
              </tr>`).join('')}
          </tbody>
        </table>

        <div class="inv-totals">
          <div><span>Subtotal</span><span>${money(subtotal, cur, { dp: 2 })}</span></div>
          ${discount > 0 ? `<div><span>Discount (${num(state.discount, 1)}%)</span><span>−${money(discount, cur, { dp: 2 })}</span></div>` : ''}
          ${state.taxRate > 0 ? `<div><span>${escapeHtml(state.taxLabel)} (${num(state.taxRate, 1)}%)</span><span>${money(tax, cur, { dp: 2 })}</span></div>` : ''}
          <div class="inv-grand"><span>Total due</span><span>${money(total, cur, { dp: 2 })}</span></div>
        </div>

        ${state.notes.trim() ? `<section class="inv-notes"><h3>Notes</h3>${addr(state.notes)}</section>` : ''}`;
    }

    function refresh({ lines = false } = {}) {
      if (lines) renderLines();
      readForm();
      renderDoc();
    }

    container.addEventListener('input', (e) => {
      const k = e.target.dataset.k;
      if (k) {
        const row = e.target.closest('[data-id]');
        const line = state.lines.find(l => l.id === Number(row.dataset.id));
        if (line) line[k] = (k === 'description') ? e.target.value : parseNum(e.target);
      }
      refresh();
    });

    container.addEventListener('change', () => refresh());

    container.addEventListener('click', (e) => {
      if (e.target.id === 'inv-add') {
        state.lines.push(BLANK_LINE());
        refresh({ lines: true });
      } else if (e.target.dataset.del) {
        state.lines = state.lines.filter(l => l.id !== Number(e.target.dataset.del));
        if (!state.lines.length) state.lines = [BLANK_LINE()];
        refresh({ lines: true });
      } else if (e.target.id === 'inv-print') {
        window.print();
      }
    });

    refresh({ lines: true });
  },
  destroy() {},
};
