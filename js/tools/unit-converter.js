import { copyText } from '../utils.js';

const UNITS = {
  length: {
    name: 'Length',
    base: 'm',
    rates: { m: 1, km: 0.001, cm: 100, mm: 1000, mi: 0.000621371, yd: 1.09361, ft: 3.28084, in: 39.3701 }
  },
  weight: {
    name: 'Weight / Mass',
    base: 'kg',
    rates: { kg: 1, g: 1000, mg: 1000000, lb: 2.20462, oz: 35.274 }
  },
  digital: {
    name: 'Digital Storage',
    base: 'B',
    rates: { B: 1, KB: 1/1024, MB: 1/1048576, GB: 1/1073741824, TB: 1/1099511627776 }
  }
};

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-controls">
        <label class="tool-label" style="margin:0 8px 0 0;">Category</label>
        <select class="tool-select" id="unit-cat">
          <option value="length">Length</option>
          <option value="weight">Weight / Mass</option>
          <option value="digital">Digital Storage</option>
        </select>
      </div>
      <div class="tool-split" style="margin-top:16px;">
        <div class="tool-section">
          <label class="tool-label">From</label>
          <div class="tool-row">
            <input type="number" class="tool-input" id="unit-from-val" value="1" style="flex:1;">
            <select class="tool-select" id="unit-from-unit" style="width:100px;"></select>
          </div>
        </div>
        <div class="tool-section">
          <label class="tool-label">To</label>
          <div class="tool-row">
            <input type="number" class="tool-input" id="unit-to-val" readonly style="flex:1; background:var(--g50);">
            <select class="tool-select" id="unit-to-unit" style="width:100px;"></select>
          </div>
        </div>
      </div>
      <div class="tool-section">
        <label class="tool-label">Result</label>
        <div class="tool-output" id="unit-output" style="min-height:auto; padding:14px;">
          <button class="copy-btn" id="unit-copy">Copy</button>
          <span id="unit-result"></span>
        </div>
      </div>
    `;

    const catSel = container.querySelector('#unit-cat');
    const fromVal = container.querySelector('#unit-from-val');
    const fromUnit = container.querySelector('#unit-from-unit');
    const toVal = container.querySelector('#unit-to-val');
    const toUnit = container.querySelector('#unit-to-unit');
    const result = container.querySelector('#unit-result');

    function populateUnits() {
      const cat = UNITS[catSel.value];
      const keys = Object.keys(cat.rates);
      fromUnit.innerHTML = keys.map(k => `<option value="${k}">${k}</option>`).join('');
      toUnit.innerHTML = keys.map((k, i) => `<option value="${k}" ${i===1?'selected':''}>${k}</option>`).join('');
      convert();
    }

    function convert() {
      const cat = UNITS[catSel.value];
      const val = parseFloat(fromVal.value) || 0;
      const u1 = fromUnit.value;
      const u2 = toUnit.value;

      if (!u1 || !u2) return;
      const baseVal = val / cat.rates[u1];
      const finalVal = baseVal * cat.rates[u2];

      const formatted = Number.isInteger(finalVal) ? finalVal.toString() : finalVal.toFixed(6).replace(/\.?0+$/, '');
      toVal.value = formatted;
      result.textContent = `${val} ${u1} = ${formatted} ${u2}`;
    }

    catSel.addEventListener('change', populateUnits);
    fromVal.addEventListener('input', convert);
    fromUnit.addEventListener('change', convert);
    toUnit.addEventListener('change', convert);

    container.querySelector('#unit-copy').addEventListener('click', (e) => {
      if (result.textContent) copyText(result.textContent, e.currentTarget);
    });

    populateUnits();
  },
  destroy() {}
};
