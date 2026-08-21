import { copyText } from '../utils.js';

const CHARSETS = {
  upper:   'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower:   'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

function generatePassword(length, options) {
  let charset = '';
  if (options.upper)   charset += CHARSETS.upper;
  if (options.lower)   charset += CHARSETS.lower;
  if (options.numbers) charset += CHARSETS.numbers;
  if (options.symbols) charset += CHARSETS.symbols;
  if (!charset) charset = CHARSETS.lower; // fallback

  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, v => charset[v % charset.length]).join('');
}

function calcStrength(password) {
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/[0-9]/.test(password)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(password)) pool += CHARSETS.symbols.length;
  const entropy = password.length * Math.log2(pool || 1);

  if (entropy < 30)  return { label: 'Weak',        pct: 20 };
  if (entropy < 50)  return { label: 'Fair',         pct: 40 };
  if (entropy < 70)  return { label: 'Strong',       pct: 70 };
  return                     { label: 'Very strong', pct: 100 };
}

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-section">
        <div class="tool-row" style="justify-content:space-between; margin-bottom:12px;">
          <label class="tool-label" style="margin:0;">Length</label>
          <span class="tool-label" style="margin:0; font-family:var(--mono);" id="pw-len-val">20</span>
        </div>
        <input type="range" class="tool-range" id="pw-length" min="4" max="128" value="20">
      </div>
      <div class="tool-controls" style="gap:16px;">
        <label class="tool-checkbox"><input type="checkbox" id="pw-upper" checked> Uppercase</label>
        <label class="tool-checkbox"><input type="checkbox" id="pw-lower" checked> Lowercase</label>
        <label class="tool-checkbox"><input type="checkbox" id="pw-numbers" checked> Numbers</label>
        <label class="tool-checkbox"><input type="checkbox" id="pw-symbols" checked> Symbols</label>
      </div>
      <div class="tool-section" style="margin-top:20px;">
        <div class="tool-output" id="pw-output" style="min-height:auto; padding:16px; font-size:1.05rem; letter-spacing:0.04em; text-align:center; word-break:break-all;">
          <button class="copy-btn" id="pw-copy" style="position:absolute; top:8px; right:8px;">Copy</button>
          <span id="pw-result"></span>
        </div>
        <div class="strength-bar"><div class="strength-bar-fill" id="pw-strength-fill"></div></div>
        <div class="strength-label" id="pw-strength-label"></div>
      </div>
      <div class="tool-controls" style="margin-top:16px;">
        <button class="btn btn-primary btn-sm" id="pw-generate">Generate a new one</button>
      </div>
    `;

    const lengthSlider = container.querySelector('#pw-length');
    const lenVal       = container.querySelector('#pw-len-val');
    const result       = container.querySelector('#pw-result');
    const strengthFill = container.querySelector('#pw-strength-fill');
    const strengthLbl  = container.querySelector('#pw-strength-label');

    function getOptions() {
      return {
        upper:   container.querySelector('#pw-upper').checked,
        lower:   container.querySelector('#pw-lower').checked,
        numbers: container.querySelector('#pw-numbers').checked,
        symbols: container.querySelector('#pw-symbols').checked,
      };
    }

    function generate() {
      const len = parseInt(lengthSlider.value);
      lenVal.textContent = len;
      const options = getOptions();
      const password = generatePassword(len, options);
      result.textContent = password;

      const strength = calcStrength(password);
      strengthFill.style.width = strength.pct + '%';
      // Turning every set off silently fell back to lowercase, which looks
      // like a working password but is a far weaker one. Say so.
      strengthLbl.textContent = Object.values(options).some(Boolean)
        ? strength.label
        : `${strength.label}, but lowercase only — tick a box to widen the alphabet`;
    }

    lengthSlider.addEventListener('input', generate);
    container.querySelector('#pw-upper').addEventListener('change', generate);
    container.querySelector('#pw-lower').addEventListener('change', generate);
    container.querySelector('#pw-numbers').addEventListener('change', generate);
    container.querySelector('#pw-symbols').addEventListener('change', generate);
    container.querySelector('#pw-generate').addEventListener('click', generate);

    container.querySelector('#pw-copy').addEventListener('click', (e) => {
      if (result.textContent) copyText(result.textContent, e.currentTarget);
    });

    this._read = () => result.textContent || '';
    generate();
  },

  getArtifact() {
    return { kind: 'text', text: this._read?.() ?? '', name: 'password.txt' };
  },

  destroy() {
    this._read = null;
  }
};
