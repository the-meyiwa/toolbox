import { copyText } from '../utils.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          <label class="tool-label">Currency</label>
          <select class="tool-select" id="sal-currency" style="width:100%; margin-bottom:16px;">
            <option value="USD" selected>USD - US Dollar ($)</option>
            <option value="NGN">NGN - Nigerian Naira (₦)</option>
            <option value="EUR">EUR - Euro (€)</option>
            <option value="GBP">GBP - British Pound (£)</option>
            <option value="JPY">JPY - Japanese Yen (¥)</option>
            <option value="CAD">CAD - Canadian Dollar ($)</option>
            <option value="AUD">AUD - Australian Dollar ($)</option>
            <option value="INR">INR - Indian Rupee (₹)</option>
          </select>

          <label class="tool-label">Input Value</label>
          <div style="display:flex; gap:12px; margin-bottom:24px;">
            <input type="number" class="tool-input" id="sal-amount" value="85000" min="0" step="1000" style="flex:2; font-size:1.2rem; font-weight:600;">
            <select class="tool-select" id="sal-period" style="flex:1; font-weight:500;">
              <option value="year" selected>Per Year</option>
              <option value="month">Per Month</option>
              <option value="week">Per Week</option>
              <option value="day">Per Day</option>
              <option value="hour">Per Hour</option>
            </select>
          </div>
          
          <label class="tool-label">Work Assumptions</label>
          <div style="display:flex; gap:12px; margin-bottom:12px;">
            <div style="flex:1;">
              <label class="tool-label" style="text-transform:none; letter-spacing:0; font-size:0.75rem;">Hours per week</label>
              <input type="number" class="tool-input" id="sal-hours" value="40" min="1" max="168">
            </div>
            <div style="flex:1;">
              <label class="tool-label" style="text-transform:none; letter-spacing:0; font-size:0.75rem;">Weeks per year</label>
              <input type="number" class="tool-input" id="sal-weeks" value="52" min="1" max="52">
            </div>
            <div style="flex:1;">
              <label class="tool-label" style="text-transform:none; letter-spacing:0; font-size:0.75rem;">Days per week</label>
              <input type="number" class="tool-input" id="sal-days" value="5" min="1" max="7">
            </div>
          </div>
        </div>
        
        <div class="tool-section">
          <label class="tool-label">Equivalent Income Breakdown</label>
          <div class="tool-stats-grid" style="grid-template-columns: 1fr 1fr; gap:12px;">
            <div class="tool-stat" style="background:var(--black); color:var(--white); grid-column: 1 / -1;">
              <div class="tool-stat-value" id="res-year" style="font-size:2.2rem;">0</div>
              <div class="tool-stat-label" style="color:var(--g400);">Annual Salary</div>
            </div>
            <div class="tool-stat">
              <div class="tool-stat-value" id="res-month" style="font-size:1.2rem;">0</div>
              <div class="tool-stat-label">Monthly</div>
            </div>
            <div class="tool-stat">
              <div class="tool-stat-value" id="res-week" style="font-size:1.2rem;">0</div>
              <div class="tool-stat-label">Weekly</div>
            </div>
            <div class="tool-stat">
              <div class="tool-stat-value" id="res-day" style="font-size:1.2rem;">0</div>
              <div class="tool-stat-label">Daily</div>
            </div>
            <div class="tool-stat">
              <div class="tool-stat-value" id="res-hour" style="font-size:1.2rem;">0</div>
              <div class="tool-stat-label">Hourly</div>
            </div>
          </div>
        </div>
      </div>
    `;

    const amtInput = container.querySelector('#sal-amount');
    const periodSel = container.querySelector('#sal-period');
    const hrsInput = container.querySelector('#sal-hours');
    const wksInput = container.querySelector('#sal-weeks');
    const daysInput = container.querySelector('#sal-days');
    const currSel = container.querySelector('#sal-currency');

    const els = {
      year: container.querySelector('#res-year'),
      month: container.querySelector('#res-month'),
      week: container.querySelector('#res-week'),
      day: container.querySelector('#res-day'),
      hour: container.querySelector('#res-hour')
    };

    function calculate() {
      let amt = parseFloat(amtInput.value) || 0;
      const period = periodSel.value;
      const hrsPerWeek = parseFloat(hrsInput.value) || 40;
      const wksPerYear = parseFloat(wksInput.value) || 52;
      const daysPerWeek = parseFloat(daysInput.value) || 5;

      const hrsPerYear = hrsPerWeek * wksPerYear;
      const daysPerYear = daysPerWeek * wksPerYear;
      const monthsPerYear = 12;

      let annual = 0;

      // Convert input to Annual
      switch(period) {
        case 'year': annual = amt; break;
        case 'month': annual = amt * monthsPerYear; break;
        case 'week': annual = amt * wksPerYear; break;
        case 'day': annual = amt * daysPerYear; break;
        case 'hour': annual = amt * hrsPerYear; break;
      }

      // Break down from Annual
      const breakdown = {
        year: annual,
        month: annual / monthsPerYear,
        week: annual / wksPerYear,
        day: annual / daysPerYear,
        hour: annual / hrsPerYear
      };

      const currCode = currSel.value;
      const format = (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currCode, maximumFractionDigits: 2 }).format(num);

      els.year.textContent = format(breakdown.year);
      els.month.textContent = format(breakdown.month);
      els.week.textContent = format(breakdown.week);
      els.day.textContent = format(breakdown.day);
      els.hour.textContent = format(breakdown.hour);
    }

    [amtInput, periodSel, hrsInput, wksInput, daysInput, currSel].forEach(el => el.addEventListener('input', calculate));
    calculate();
  },
  destroy() {}
};
