import { copyText } from '../utils.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-section">
        <label class="tool-label">What is Y% of X?</label>
        <div class="tool-row">
          <input type="number" class="tool-input" id="pc-y1" placeholder="Percentage" style="width:100px;">
          <span style="font-weight:600;">% of</span>
          <input type="number" class="tool-input" id="pc-x1" placeholder="Number" style="width:120px;">
          <span style="font-weight:600;">=</span>
          <div class="tool-output" style="min-height:40px; flex:1; padding:8px 12px; margin:0;" id="pc-r1"></div>
        </div>
      </div>

      <div class="tool-section">
        <label class="tool-label">X is what percent of Y?</label>
        <div class="tool-row">
          <input type="number" class="tool-input" id="pc-x2" placeholder="Number" style="width:100px;">
          <span style="font-weight:600;">is what % of</span>
          <input type="number" class="tool-input" id="pc-y2" placeholder="Number" style="width:120px;">
          <span style="font-weight:600;">=</span>
          <div class="tool-output" style="min-height:40px; flex:1; padding:8px 12px; margin:0;" id="pc-r2"></div>
        </div>
      </div>

      <div class="tool-section">
        <label class="tool-label">Percentage change from X to Y</label>
        <div class="tool-row">
          <input type="number" class="tool-input" id="pc-x3" placeholder="From" style="width:100px;">
          <span style="font-weight:600;">to</span>
          <input type="number" class="tool-input" id="pc-y3" placeholder="To" style="width:120px;">
          <span style="font-weight:600;">=</span>
          <div class="tool-output" style="min-height:40px; flex:1; padding:8px 12px; margin:0;" id="pc-r3"></div>
        </div>
      </div>
    `;

    function calc1() {
      const y = parseFloat(container.querySelector('#pc-y1').value);
      const x = parseFloat(container.querySelector('#pc-x1').value);
      const r = container.querySelector('#pc-r1');
      if (!isNaN(y) && !isNaN(x)) r.textContent = ((y / 100) * x).toLocaleString('en-US', {maximumFractionDigits: 4});
      else r.textContent = '';
    }

    function calc2() {
      const x = parseFloat(container.querySelector('#pc-x2').value);
      const y = parseFloat(container.querySelector('#pc-y2').value);
      const r = container.querySelector('#pc-r2');
      if (!isNaN(x) && !isNaN(y) && y !== 0) r.textContent = ((x / y) * 100).toLocaleString('en-US', {maximumFractionDigits: 4}) + '%';
      else r.textContent = '';
    }

    function calc3() {
      const x = parseFloat(container.querySelector('#pc-x3').value);
      const y = parseFloat(container.querySelector('#pc-y3').value);
      const r = container.querySelector('#pc-r3');
      if (!isNaN(x) && !isNaN(y) && x !== 0) {
        const diff = y - x;
        const perc = (diff / x) * 100;
        let prefix = perc > 0 ? '+' : '';
        r.textContent = prefix + perc.toLocaleString('en-US', {maximumFractionDigits: 4}) + '%';
      }
      else r.textContent = '';
    }

    container.querySelector('#pc-y1').addEventListener('input', calc1);
    container.querySelector('#pc-x1').addEventListener('input', calc1);
    
    container.querySelector('#pc-x2').addEventListener('input', calc2);
    container.querySelector('#pc-y2').addEventListener('input', calc2);

    container.querySelector('#pc-x3').addEventListener('input', calc3);
    container.querySelector('#pc-y3').addEventListener('input', calc3);
  },
  destroy() {}
};
