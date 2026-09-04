export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          <label class="tool-label">Currency</label>
          <select class="tool-select" id="ci-currency" style="width:100%; margin-bottom:16px;">
            <option value="USD" selected>USD — US Dollar ($)</option>
            <option value="NGN">NGN — Nigerian Naira (₦)</option>
            <option value="EUR">EUR — Euro (€)</option>
            <option value="GBP">GBP — British Pound (£)</option>
            <option value="JPY">JPY — Japanese Yen (¥)</option>
            <option value="CAD">CAD — Canadian Dollar ($)</option>
            <option value="AUD">AUD — Australian Dollar ($)</option>
            <option value="INR">INR — Indian Rupee (₹)</option>
          </select>
          
          <label class="tool-label">Initial investment</label>
          <input type="number" class="tool-input" id="ci-principal" value="10000" min="0" step="100">
          
          <label class="tool-label" style="margin-top:16px;">Monthly contribution</label>
          <input type="number" class="tool-input" id="ci-monthly" value="500" min="0" step="50">
          
          <label class="tool-label" style="margin-top:16px;">Estimated annual interest rate (%)</label>
          <input type="number" class="tool-input" id="ci-rate" value="7" min="0" max="100" step="0.1">
          
          <label class="tool-label" style="margin-top:16px;">Years to grow</label>
          <input type="number" class="tool-input" id="ci-years" value="10" min="1" max="100" step="1">
          
          <label class="tool-label" style="margin-top:16px;">Compounding frequency</label>
          <select class="tool-select" id="ci-freq" style="width:100%;">
            <option value="12" selected>Monthly (12/yr)</option>
            <option value="1">Annually (1/yr)</option>
            <option value="4">Quarterly (4/yr)</option>
            <option value="365">Daily (365/yr)</option>
          </select>
        </div>
        
        <div class="tool-section">
          <label class="tool-label">Projected value</label>
          <div class="tool-stats-grid" style="grid-template-columns: 1fr; gap: 16px;">
            <div class="tool-stat" style="background:var(--black); color:var(--white);">
              <div class="tool-stat-value" id="ci-total" style="font-size:2.4rem;">0</div>
              <div class="tool-stat-label" style="color:var(--g400);">Final balance</div>
            </div>
            
            <div style="display:flex; gap:16px;">
              <div class="tool-stat" style="flex:1;">
                <div class="tool-stat-value" id="ci-principal-total" style="font-size:1.3rem;">0</div>
                <div class="tool-stat-label">Total principal</div>
              </div>
              <div class="tool-stat" style="flex:1;">
                <div class="tool-stat-value" id="ci-interest-total" style="font-size:1.3rem; color:#2E7D32;">0</div>
                <div class="tool-stat-label">Total interest</div>
              </div>
            </div>
          </div>
          
          <div class="tool-output" style="margin-top:24px; min-height:0; padding:16px;">
            <p style="margin:0; font-family:var(--sans); font-size:0.85rem; color:var(--g600); line-height:1.5;" id="ci-summary"></p>
          </div>
        </div>
      </div>
    `;

    const inputs = ['principal', 'monthly', 'rate', 'years', 'freq'].map(id => container.querySelector(`#ci-${id}`));
    const [pInput, mInput, rInput, yInput, fInput] = inputs;
    const currSel = container.querySelector('#ci-currency');

    const totalEl = container.querySelector('#ci-total');
    const pTotalEl = container.querySelector('#ci-principal-total');
    const iTotalEl = container.querySelector('#ci-interest-total');
    const summaryEl = container.querySelector('#ci-summary');

    function calculate() {
      const p = parseFloat(pInput.value) || 0;
      const m = parseFloat(mInput.value) || 0;
      const r = parseFloat(rInput.value) || 0;
      const t = parseFloat(yInput.value) || 0;
      const n = parseInt(fInput.value) || 12;

      // Rate per period
      const rate = r / 100 / n;
      
      // Total periods
      const periods = n * t;
      
      // Future Value of Principal
      const fvPrincipal = p * Math.pow(1 + rate, periods);
      
      // Future Value of Series (Contributions)
      let fvContributions = 0;
      if (rate > 0) {
          // If compounding is monthly and contributions are monthly, they align perfectly.
          // For simplicity, we calculate contributions matching the compounding frequency.
          // Real-world cases may vary, but standard formula assumes they match.
          const contribPerPeriod = m * (12 / n);
          fvContributions = contribPerPeriod * ((Math.pow(1 + rate, periods) - 1) / rate);
      } else {
          fvContributions = m * 12 * t;
      }

      const totalBalance = fvPrincipal + fvContributions;
      const totalPrincipal = p + (m * 12 * t);
      const totalInterest = totalBalance - totalPrincipal;
      
      const currCode = currSel.value;
      const format = (num) => new Intl.NumberFormat(undefined, { style: 'currency', currency: currCode, maximumFractionDigits: 0 }).format(num);

      totalEl.textContent = format(totalBalance);
      pTotalEl.textContent = format(totalPrincipal);
      iTotalEl.textContent = format(totalInterest);
      
      summaryEl.innerHTML = `In <strong>${t} year${t === 1 ? '' : 's'}</strong>, your investment will grow to <strong>${format(totalBalance)}</strong>. You will have contributed <strong>${format(totalPrincipal)}</strong>, and earned <strong>${format(totalInterest)}</strong> in compound interest.`;
    }

    inputs.forEach(el => el.addEventListener('input', calculate));
    currSel.addEventListener('change', calculate);
    calculate();
  },
  destroy() {}
};
