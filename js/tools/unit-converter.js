import { copyText } from '../utils.js';

/* Every unit is expressed as "how many of me are in one base unit", so a
   conversion is one division and one multiplication. Temperature is the
   exception — it has an offset as well as a scale — so it carries a pair of
   functions instead of a ratio. */
const UNITS = {
  length: {
    name: 'Length',
    rates: { m: 1, km: 0.001, cm: 100, mm: 1000, mi: 0.000621371, yd: 1.09361, ft: 3.28084, in: 39.3701 }
  },
  weight: {
    name: 'Weight and mass',
    rates: { kg: 1, g: 1000, mg: 1000000, t: 0.001, st: 0.157473, lb: 2.20462, oz: 35.274 }
  },
  temperature: {
    name: 'Temperature',
    // Base is degrees Celsius.
    scales: {
      '°C': { toBase: (v) => v, fromBase: (v) => v },
      '°F': { toBase: (v) => (v - 32) * 5 / 9, fromBase: (v) => v * 9 / 5 + 32 },
      K:    { toBase: (v) => v - 273.15, fromBase: (v) => v + 273.15 },
    },
  },
  digital: {
    name: 'Digital storage',
    rates: { B: 1, KB: 1/1024, MB: 1/1048576, GB: 1/1073741824, TB: 1/1099511627776 }
  }
};

/** Unit keys for a category, whichever form it stores them in. */
const unitsOf = (cat) => Object.keys(cat.scales ?? cat.rates);

export function convertValue(cat, value, from, to) {
  if (cat.scales) return cat.scales[to].fromBase(cat.scales[from].toBase(value));
  return (value / cat.rates[from]) * cat.rates[to];
}

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-controls">
        <label class="tool-label" style="margin:0 8px 0 0;">Category</label>
        <select class="tool-select" id="unit-cat">
          ${Object.entries(UNITS).map(([id, c]) => `<option value="${id}">${c.name}</option>`).join('')}
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
      const keys = unitsOf(UNITS[catSel.value]);
      fromUnit.innerHTML = keys.map(k => `<option value="${k}">${k}</option>`).join('');
      toUnit.innerHTML = keys.map((k, i) => `<option value="${k}"${i === 1 ? ' selected' : ''}>${k}</option>`).join('');
      convert();
    }

    /* Six decimal places, with the trailing zeros trimmed off, keeps
       millimetres readable without turning 1/3 into 0.333333333333. */
    function tidy(n) {
      if (!Number.isFinite(n)) return '—';
      if (Number.isInteger(n)) return String(n);
      const fixed = n.toFixed(6);
      return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
    }

    function convert() {
      const cat = UNITS[catSel.value];
      const val = parseFloat(fromVal.value) || 0;
      const u1 = fromUnit.value;
      const u2 = toUnit.value;

      if (!u1 || !u2) return;
      const formatted = tidy(convertValue(cat, val, u1, u2));
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
