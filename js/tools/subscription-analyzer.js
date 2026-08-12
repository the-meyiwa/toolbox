import { copyText } from '../utils.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-section" style="text-align:center; max-width:600px; margin:0 auto 32px;">
        <h2 style="font-size:2rem; font-weight:600; margin-bottom:8px; letter-spacing:-0.03em;">The "Just a Coffee" Analyzer</h2>
        <p style="color:var(--g500); font-size:0.9rem;">Find out how much those recurring small expenses actually drain from you over time.</p>
      </div>

      <div class="tool-split" style="align-items:center;">
        <div class="tool-section" style="margin:0;">
          <label class="tool-label">Currency</label>
          <select class="tool-select" id="sub-currency" style="width:100%; margin-bottom:16px;">
            <option value="USD" selected>USD - US Dollar ($)</option>
            <option value="NGN">NGN - Nigerian Naira (₦)</option>
            <option value="EUR">EUR - Euro (€)</option>
            <option value="GBP">GBP - British Pound (£)</option>
            <option value="JPY">JPY - Japanese Yen (¥)</option>
            <option value="CAD">CAD - Canadian Dollar ($)</option>
            <option value="AUD">AUD - Australian Dollar ($)</option>
            <option value="INR">INR - Indian Rupee (₹)</option>
          </select>

          <label class="tool-label">Cost Amount</label>
          <div style="display:flex; gap:12px; margin-bottom:24px;">
            <input type="number" class="tool-input" id="sub-cost" value="15.99" min="0" step="1" style="flex:2; font-size:1.4rem; font-weight:600;">
            <select class="tool-select" id="sub-freq" style="flex:1; font-weight:500;">
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month" selected>Monthly</option>
              <option value="year">Annually</option>
            </select>
          </div>
          
          <label class="tool-label">Presets</label>
          <div class="tool-controls" style="gap:8px; flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm" id="btn-meshai">Just one Meshai (₦1.5k/day)</button>
            <button class="btn btn-secondary btn-sm" id="btn-spotify">Spotify (₦1300/mo)</button>
            <button class="btn btn-secondary btn-sm" id="btn-netflix">Netflix (€15.49/mo)</button>
            <button class="btn btn-secondary btn-sm" id="btn-gym">Gym (£50/mo)</button>
            <button class="btn btn-secondary btn-sm" id="btn-prime">Prime ($139/yr)</button>
          </div>
        </div>
        
        <div class="tool-section" style="margin:0;">
          <div class="tool-stats-grid" style="grid-template-columns: 1fr 1fr; gap:12px;">
            <div class="tool-stat">
              <div class="tool-stat-value" id="sub-month" style="font-size:1.4rem;">0</div>
              <div class="tool-stat-label">Per Month</div>
            </div>
            <div class="tool-stat">
              <div class="tool-stat-value" id="sub-year" style="font-size:1.4rem; color:#D32F2F;">0</div>
              <div class="tool-stat-label">Per Year</div>
            </div>
            <div class="tool-stat" style="grid-column: 1 / -1; background:var(--black); color:var(--white);">
              <div class="tool-stat-value" id="sub-decade" style="font-size:3rem;">0</div>
              <div class="tool-stat-label" style="color:var(--g400);">Over 10 Years</div>
            </div>
          </div>
        </div>
      </div>
    `;

    const costInput = container.querySelector('#sub-cost');
    const freqSel = container.querySelector('#sub-freq');
    const currSel = container.querySelector('#sub-currency');

    const moEl = container.querySelector('#sub-month');
    const yrEl = container.querySelector('#sub-year');
    const decEl = container.querySelector('#sub-decade');

    function calculate() {
      const cost = parseFloat(costInput.value) || 0;
      const freq = freqSel.value;
      
      let daily = 0;
      if (freq === 'day') daily = cost;
      if (freq === 'week') daily = cost / 7;
      if (freq === 'month') daily = cost / 30.416; // avg days in month
      if (freq === 'year') daily = cost / 365;

      const monthly = daily * 30.416;
      const yearly = daily * 365;
      const decade = yearly * 10;

      const currCode = currSel.value;
      const format = (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currCode, maximumFractionDigits: 2 }).format(num);

      moEl.textContent = format(monthly);
      yrEl.textContent = format(yearly);
      decEl.textContent = format(decade);
    }

    [costInput, freqSel, currSel].forEach(el => el.addEventListener('input', calculate));
    
    container.querySelector('#btn-meshai').addEventListener('click', () => { costInput.value = 1500; freqSel.value = 'day'; currSel.value = 'NGN'; calculate(); });
    container.querySelector('#btn-spotify').addEventListener('click', () => { costInput.value = 1300; freqSel.value = 'month'; currSel.value = 'NGN'; calculate(); });
    container.querySelector('#btn-netflix').addEventListener('click', () => { costInput.value = 15.49; freqSel.value = 'month'; currSel.value = 'EUR'; calculate(); });
    container.querySelector('#btn-gym').addEventListener('click', () => { costInput.value = 50; freqSel.value = 'month'; currSel.value = 'GBP'; calculate(); });
    container.querySelector('#btn-prime').addEventListener('click', () => { costInput.value = 139; freqSel.value = 'year'; currSel.value = 'USD'; calculate(); });

    calculate();
  },
  destroy() {}
};
