import { currencySelect, field, statGrid, money, parseNum, liveCompute } from '../lib/biz.js';

const PRESETS = [
  { label: 'UK VAT — 20%', rate: 20 },
  { label: 'UK reduced — 5%', rate: 5 },
  { label: 'Ireland — 23%', rate: 23 },
  { label: 'Nigeria VAT — 7.5%', rate: 7.5 },
  { label: 'South Africa — 15%', rate: 15 },
  { label: 'Germany — 19%', rate: 19 },
  { label: 'Canada GST — 5%', rate: 5 },
  { label: 'Australia GST — 10%', rate: 10 },
];

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          <div class="biz-field">
            <label class="tool-label" for="vat-cur">Currency</label>
            ${currencySelect('vat-cur')}
          </div>

          <div class="biz-seg-field">
            <label class="tool-label">What do you have?</label>
            <div class="btn-group t3d-seg" id="vat-mode">
              <button class="btn btn-sm is-active" data-mode="add">A price without tax</button>
              <button class="btn btn-sm" data-mode="remove">A price with tax included</button>
            </div>
          </div>

          ${field('Amount', 'vat-amount', 1000, { min: 0 })}
          ${field('Tax rate', 'vat-rate', 20, { min: 0, max: 100, step: 0.1, suffix: '%' })}

          <label class="tool-label" style="margin-top:18px;">Common rates</label>
          <div class="biz-chips" id="vat-presets">
            ${PRESETS.map(p => `<button class="biz-chip" data-rate="${p.rate}">${p.label}</button>`).join('')}
          </div>
        </div>

        <div class="tool-section">
          <div id="vat-out"></div>
          <div class="tool-output biz-explain" id="vat-explain"></div>
        </div>
      </div>`;

    const out     = container.querySelector('#vat-out');
    const explain = container.querySelector('#vat-explain');
    const rateEl  = container.querySelector('#vat-rate');
    let mode = 'add';

    function compute() {
      const cur    = container.querySelector('#vat-cur').value;
      const amount = parseNum(container.querySelector('#vat-amount'));
      const rate   = parseNum(rateEl);

      let net, tax, gross;
      if (mode === 'add') {
        net   = amount;
        tax   = amount * rate / 100;
        gross = net + tax;
      } else {
        // Working backwards out of a tax-inclusive price.
        gross = amount;
        net   = amount / (1 + rate / 100);
        tax   = gross - net;
      }

      out.innerHTML = statGrid([
        { value: money(net, cur, { dp: 2 }),   label: 'Before tax (net)' },
        { value: money(tax, cur, { dp: 2 }),   label: `Tax at ${rate}%`, tone: 'bad' },
        { value: money(gross, cur, { dp: 2 }), label: 'Total to pay (gross)', tone: 'hero' },
      ]);

      explain.innerHTML = mode === 'add'
        ? `Adding ${rate}% to <strong>${money(net, cur, { dp: 2 })}</strong> gives
           <strong>${money(gross, cur, { dp: 2 })}</strong>.<br>
           <span class="biz-formula">net × (1 + ${rate}/100) = gross</span>`
        : `Stripping ${rate}% out of <strong>${money(gross, cur, { dp: 2 })}</strong> leaves
           <strong>${money(net, cur, { dp: 2 })}</strong>.<br>
           <span class="biz-formula">gross ÷ (1 + ${rate}/100) = net</span>
           <br><br>Note this is a division, not a subtraction — taking 20% <em>off</em> a
           tax-inclusive price is not the same as the tax that was added.`;
    }

    container.querySelector('#vat-mode').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mode]');
      if (!btn) return;
      for (const b of container.querySelectorAll('#vat-mode .btn')) b.classList.toggle('is-active', b === btn);
      mode = btn.dataset.mode;
      compute();
    });

    container.querySelector('#vat-presets').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-rate]');
      if (!btn) return;
      rateEl.value = btn.dataset.rate;
      compute();
    });

    liveCompute(container, compute);
  },
  destroy() {},
};
