export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        
        <div class="tool-section">
          <div style="display:flex; align-items:center; gap:16px; margin-bottom:16px; flex-wrap:wrap;">
            <div style="flex:1; min-width:150px;">
              <label class="tool-label">Amount</label>
              <input type="number" class="tool-input" id="ex-amount" value="1" min="0" step="any" style="font-size:1.5rem; font-weight:600;">
            </div>
            <div style="flex:1; min-width:120px;">
              <label class="tool-label">From</label>
              <select class="tool-select" id="ex-from">
                <option value="USD" selected>USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="NGN">NGN (₦)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="CAD">CAD ($)</option>
                <option value="AUD">AUD ($)</option>
                <option value="INR">INR (₹)</option>
                <!-- populated dynamically -->
              </select>
            </div>
            <div style="display:flex; align-items:flex-end; padding-bottom:8px;">
              <button class="btn btn-secondary" id="ex-swap" style="padding:10px;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="14" x2="21" y2="3"/><polyline points="8 21 3 21 3 16"/><line x1="20" y1="10" x2="3" y2="21"/></svg>
              </button>
            </div>
            <div style="flex:1; min-width:120px;">
              <label class="tool-label">To</label>
              <select class="tool-select" id="ex-to">
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="NGN" selected>NGN (₦)</option>
                <option value="JPY">JPY (¥)</option>
                <option value="CAD">CAD ($)</option>
                <option value="AUD">AUD ($)</option>
                <option value="INR">INR (₹)</option>
                <!-- populated dynamically -->
              </select>
            </div>
          </div>
          
          <div class="tool-stat" style="background:var(--black); color:var(--white); padding:24px; text-align:center;">
            <div class="tool-stat-label" style="color:var(--g400); margin-bottom:8px;">Converted amount</div>
            <div class="tool-stat-value" id="ex-result" style="font-family:var(--pixel); font-size:3rem; word-break:break-all;">Loading…</div>
            <div style="margin-top:12px; font-size:0.85rem; color:var(--g500);" id="ex-rate-info"></div>
          </div>
        </div>
      </div>
    `;

    const amtInput = container.querySelector('#ex-amount');
    const fromSel = container.querySelector('#ex-from');
    const toSel = container.querySelector('#ex-to');
    const swapBtn = container.querySelector('#ex-swap');
    const resultDiv = container.querySelector('#ex-result');
    const rateInfoDiv = container.querySelector('#ex-rate-info');

    let rates = null;
    let base = 'USD';

    async function fetchRates() {
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        if (data && data.rates) {
          rates = data.rates;
          populateSelects();
          calculate();
        }
      } catch (e) {
        resultDiv.textContent = 'Rates unavailable';
      }
    }

    function populateSelects() {
      const topCurrencies = ['USD', 'EUR', 'GBP', 'NGN', 'JPY', 'CAD', 'AUD', 'INR'];
      let html = '';
      
      // Top currencies first
      topCurrencies.forEach(c => {
        if (rates[c]) html += `<option value="${c}">${c}</option>`;
      });
      
      html += '<option disabled>──────────</option>';
      
      Object.keys(rates).sort().forEach(c => {
        if (!topCurrencies.includes(c)) html += `<option value="${c}">${c}</option>`;
      });

      const currentFrom = fromSel.value;
      const currentTo = toSel.value;

      fromSel.innerHTML = html;
      toSel.innerHTML = html;

      fromSel.value = rates[currentFrom] ? currentFrom : 'USD';
      toSel.value = rates[currentTo] ? currentTo : 'EUR';
    }

    function calculate() {
      if (!rates) return;
      const amt = parseFloat(amtInput.value) || 0;
      const from = fromSel.value;
      const to = toSel.value;

      // Rates are relative to USD
      const fromRate = rates[from];
      const toRate = rates[to];

      if (!fromRate || !toRate) {
        resultDiv.textContent = 'Rate unavailable';
        return;
      }

      // Conversion math
      const usdAmount = amt / fromRate;
      const finalAmount = usdAmount * toRate;

      const format = (num, curr) => new Intl.NumberFormat(undefined, { style: 'currency', currency: curr, maximumFractionDigits: 4 }).format(num);

      resultDiv.textContent = format(finalAmount, to);
      
      const singleRate = (1 / fromRate) * toRate;
      rateInfoDiv.textContent = `1 ${from} = ${singleRate.toFixed(4)} ${to}`;
    }

    [amtInput, fromSel, toSel].forEach(el => el.addEventListener('input', calculate));
    
    swapBtn.addEventListener('click', () => {
      const temp = fromSel.value;
      fromSel.value = toSel.value;
      toSel.value = temp;
      calculate();
    });

    fetchRates();
  },
  destroy() {}
};
