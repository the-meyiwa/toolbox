import { copyText } from '../utils.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-row" style="gap:16px;">
        <div style="flex:1;">
          <label class="tool-label">Min</label>
          <input type="number" class="tool-input" id="rand-min" value="1">
        </div>
        <div style="flex:1;">
          <label class="tool-label">Max</label>
          <input type="number" class="tool-input" id="rand-max" value="100">
        </div>
        <div style="flex:1;">
          <label class="tool-label">Count</label>
          <input type="number" class="tool-input" id="rand-count" value="1" min="1" max="1000">
        </div>
      </div>
      <div class="tool-controls" style="margin-top:16px;">
        <button class="btn btn-primary" id="rand-generate">Generate</button>
        <label class="tool-checkbox" style="margin-left:12px;">
          <input type="checkbox" id="rand-unique"> Unique only
        </label>
      </div>
      <div class="tool-section">
        <label class="tool-label">Result</label>
        <div class="tool-output" id="rand-output" style="min-height:120px; font-size:1.5rem; text-align:center; padding-top:40px; word-break:break-word;">
          <button class="copy-btn" id="rand-copy">Copy</button>
          <span id="rand-result"></span>
        </div>
      </div>
    `;

    const minInput = container.querySelector('#rand-min');
    const maxInput = container.querySelector('#rand-max');
    const countInput = container.querySelector('#rand-count');
    const uniqueCheck = container.querySelector('#rand-unique');
    const result = container.querySelector('#rand-result');

    function generate() {
      const min = parseInt(minInput.value) || 0;
      const max = parseInt(maxInput.value) || 0;
      let count = parseInt(countInput.value) || 1;
      const unique = uniqueCheck.checked;

      if (min > max) {
        result.textContent = 'The minimum must not be greater than the maximum.';
        return;
      }

      count = Math.max(1, Math.min(1000, count));   // the same ceiling the field allows


      if (unique && count > (max - min + 1)) {
        result.textContent = 'There are not that many distinct numbers in this range.';
        return;
      }

      let numbers = [];
      if (unique) {
        const set = new Set();
        while (set.size < count) {
          set.add(Math.floor(Math.random() * (max - min + 1)) + min);
        }
        numbers = Array.from(set);
      } else {
        for (let i = 0; i < count; i++) {
          numbers.push(Math.floor(Math.random() * (max - min + 1)) + min);
        }
      }

      result.textContent = numbers.join(', ');
    }

    container.querySelector('#rand-generate').addEventListener('click', generate);

    container.querySelector('#rand-copy').addEventListener('click', (e) => {
      if (result.textContent) copyText(result.textContent, e.currentTarget);
    });

    generate();
  },
  destroy() {}
};
