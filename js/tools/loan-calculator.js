import { copyText } from '../utils.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          <label class="tool-label">Currency</label>
          <select class="tool-select" id="loan-currency" style="width:100%; margin-bottom:16px;">
            <option value="USD" selected>USD - US Dollar ($)</option>
            <option value="NGN">NGN - Nigerian Naira (₦)</option>
            <option value="EUR">EUR - Euro (€)</option>
            <option value="GBP">GBP - British Pound (£)</option>
            <option value="JPY">JPY - Japanese Yen (¥)</option>
            <option value="CAD">CAD - Canadian Dollar ($)</option>
            <option value="AUD">AUD - Australian Dollar ($)</option>
            <option value="INR">INR - Indian Rupee (₹)</option>
          </select>

          <label class="tool-label">Loan Amount</label>
          <input type="number" class="tool-input" id="loan-amount" value="350000" min="0" step="1000">
          
          <label class="tool-label" style="margin-top:16px;">Annual Interest Rate (%)</label>
          <input type="number" class="tool-input" id="loan-rate" value="6.5" min="0" max="100" step="0.1">
          
          <label class="tool-label" style="margin-top:16px;">Loan Term (Years)</label>
          <input type="number" class="tool-input" id="loan-years" value="30" min="1" max="100" step="1">
          
          <div class="tool-controls" style="margin-top:24px;">
            <button class="btn btn-secondary btn-sm" id="btn-auto">Auto 60mo (5y)</button>
            <button class="btn btn-secondary btn-sm" id="btn-mortgage">Mortgage 30y</button>
          </div>
        </div>
        
        <div class="tool-section">
          <label class="tool-label">Monthly EMI Payment</label>
          <div class="tool-stat" style="background:var(--black); color:var(--white); margin-bottom:16px;">
            <div class="tool-stat-value" id="loan-emi" style="font-size:3rem;">0</div>
            <div class="tool-stat-label" style="color:var(--g400);">Every Month</div>
          </div>
          
          <div class="tool-stats-grid" style="grid-template-columns: 1fr 1fr;">
            <div class="tool-stat">
              <div class="tool-stat-value" id="loan-total-interest" style="font-size:1.2rem; color:#D32F2F;">0</div>
              <div class="tool-stat-label">Total Interest</div>
            </div>
            <div class="tool-stat">
              <div class="tool-stat-value" id="loan-total-paid" style="font-size:1.2rem;">0</div>
              <div class="tool-stat-label">Total Amount Paid</div>
            </div>
          </div>
          
          <div class="tool-output" style="margin-top:16px; padding:16px; text-align:center;">
            Interest makes up <strong id="loan-ratio">0%</strong> of your total payments.
          </div>
        </div>
      </div>
    `;

    const aInput = container.querySelector('#loan-amount');
    const rInput = container.querySelector('#loan-rate');
    const yInput = container.querySelector('#loan-years');
    const currSel = container.querySelector('#loan-currency');

    const emiEl = container.querySelector('#loan-emi');
    const intEl = container.querySelector('#loan-total-interest');
    const totalEl = container.querySelector('#loan-total-paid');
    const ratioEl = container.querySelector('#loan-ratio');

    function calculate() {
      const p = parseFloat(aInput.value) || 0;
      const r = parseFloat(rInput.value) || 0;
      const y = parseFloat(yInput.value) || 0;

      const n = y * 12; // Total number of months
      const i = r / 100 / 12; // Monthly interest rate

      let emi = 0;
      if (i > 0) {
        emi = p * i * Math.pow(1 + i, n) / (Math.pow(1 + i, n) - 1);
      } else {
        emi = p / n;
      }

      if (isNaN(emi) || emi === Infinity) emi = 0;

      const totalPaid = emi * n;
      const totalInterest = Math.max(0, totalPaid - p);

      const currCode = currSel.value;
      const format = (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currCode, maximumFractionDigits: 2 }).format(num);

      emiEl.textContent = format(emi);
      intEl.textContent = format(totalInterest);
      totalEl.textContent = format(totalPaid);
      
      const ratio = totalPaid > 0 ? (totalInterest / totalPaid * 100) : 0;
      ratioEl.textContent = ratio.toFixed(1) + '%';
    }

    [aInput, rInput, yInput, currSel].forEach(el => el.addEventListener('input', calculate));
    
    container.querySelector('#btn-auto').addEventListener('click', () => {
      aInput.value = 35000;
      rInput.value = 7.5;
      yInput.value = 5;
      calculate();
    });
    
    container.querySelector('#btn-mortgage').addEventListener('click', () => {
      aInput.value = 350000;
      rInput.value = 6.5;
      yInput.value = 30;
      calculate();
    });

    calculate();
  },
  destroy() {}
};
