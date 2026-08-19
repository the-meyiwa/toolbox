import { copyText } from '../utils.js';

const BASES = [
  { label: 'Binary',  radix: 2,  prefix: '0b' },
  { label: 'Octal',   radix: 8,  prefix: '0o' },
  { label: 'Decimal', radix: 10, prefix: '' },
  { label: 'Hex',     radix: 16, prefix: '0x' },
];

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-section">
        <label class="tool-label">Input</label>
        <input type="text" class="tool-input" id="nb-input" placeholder="Enter a number…" style="font-size:1rem;">
      </div>
      <div class="tool-controls">
        <label class="tool-label" style="margin:0 8px 0 0;">Input Base</label>
        <div class="btn-group" id="nb-base-btns">
          ${BASES.map((b, i) => `<button class="btn btn-sm${i === 2 ? ' active' : ''}" data-radix="${b.radix}">${b.label}</button>`).join('')}
        </div>
      </div>
      <div class="tool-section" style="margin-top:20px;">
        <label class="tool-label">Conversions</label>
        ${BASES.map(b => `
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
            <div style="flex:1; min-width:0;">
              <span class="tool-label" style="margin-bottom:2px;">${b.label} (base ${b.radix})</span>
              <div class="tool-output" id="nb-out-${b.radix}" style="min-height:auto; padding:10px 14px; font-size:0.88rem;">${b.prefix}0</div>
            </div>
            <button class="copy-btn" data-radix="${b.radix}" style="margin-left:8px;">Copy</button>
          </div>
        `).join('')}
      </div>
      <div id="nb-status" style="font-size:0.78rem; color:var(--g500);"></div>
    `;

    const input  = container.querySelector('#nb-input');
    const status = container.querySelector('#nb-status');
    let inputRadix = 10;

    function convert() {
      const raw = input.value.trim().replace(/^0[bBxXoO]/, ''); // strip any prefix
      if (!raw) {
        BASES.forEach(b => {
          container.querySelector(`#nb-out-${b.radix}`).textContent = b.prefix + '0';
        });
        status.textContent = '';
        return;
      }

      const value = parseInt(raw, inputRadix);
      if (isNaN(value)) {
        status.textContent = '✗ Invalid number for base ' + inputRadix;
        return;
      }

      if (value < 0) {
        status.textContent = '✗ Negative numbers not supported';
        return;
      }

      BASES.forEach(b => {
        const converted = value.toString(b.radix).toUpperCase();
        container.querySelector(`#nb-out-${b.radix}`).textContent = b.prefix + converted;
      });
      status.textContent = '';
    }

    // Base selector
    container.querySelector('#nb-base-btns').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-radix]');
      if (!btn) return;
      inputRadix = parseInt(btn.dataset.radix);
      container.querySelectorAll('#nb-base-btns .btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      convert();
    });

    input.addEventListener('input', convert);

    // Copy buttons
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.copy-btn[data-radix]');
      if (!btn) return;
      const text = container.querySelector(`#nb-out-${btn.dataset.radix}`).textContent;
      if (text) copyText(text, btn);
    });

    input.focus();
  },

  destroy() {}
};
