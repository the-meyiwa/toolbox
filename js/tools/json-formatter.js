import { copyText } from '../utils.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-controls">
        <button class="btn btn-primary btn-sm" id="jf-format">Format</button>
        <button class="btn btn-secondary btn-sm" id="jf-minify">Minify</button>
        <button class="btn btn-secondary btn-sm" id="jf-validate">Validate</button>
      </div>
      <div class="tool-split">
        <div class="tool-section">
          <label class="tool-label">Input</label>
          <textarea class="tool-textarea" id="jf-input" placeholder='Paste JSON here…\n\n{"key": "value"}' style="min-height:340px;"></textarea>
        </div>
        <div class="tool-section">
          <label class="tool-label">Output</label>
          <div class="tool-output" id="jf-output" style="min-height:340px; overflow:auto;">
            <button class="copy-btn" id="jf-copy">Copy</button>
            <span id="jf-result"></span>
          </div>
        </div>
      </div>
      <div id="jf-status" style="margin-top:8px; font-size:0.78rem; color:var(--g500);"></div>
    `;

    const input  = container.querySelector('#jf-input');
    const result = container.querySelector('#jf-result');
    const status = container.querySelector('#jf-status');

    function format() {
      try {
        const parsed = JSON.parse(input.value);
        const formatted = JSON.stringify(parsed, null, 2);
        result.textContent = formatted;
        status.textContent = '✓ Valid JSON';
        status.style.color = 'var(--black)';
      } catch (e) {
        result.textContent = '';
        status.textContent = '✗ ' + e.message;
        status.style.color = 'var(--g600)';
      }
    }

    function minify() {
      try {
        const parsed = JSON.parse(input.value);
        const minified = JSON.stringify(parsed);
        result.textContent = minified;
        status.textContent = `✓ Minified — ${minified.length} characters`;
        status.style.color = 'var(--black)';
      } catch (e) {
        result.textContent = '';
        status.textContent = '✗ ' + e.message;
        status.style.color = 'var(--g600)';
      }
    }

    function validate() {
      try {
        const parsed = JSON.parse(input.value);
        const keys = countKeys(parsed);
        result.textContent = JSON.stringify(parsed, null, 2);
        status.textContent = `✓ Valid JSON — ${keys} key${keys !== 1 ? 's' : ''}, ${JSON.stringify(parsed).length} characters`;
        status.style.color = 'var(--black)';
      } catch (e) {
        result.textContent = '';
        status.textContent = '✗ ' + e.message;
        status.style.color = 'var(--g600)';
      }
    }

    function countKeys(obj) {
      if (typeof obj !== 'object' || obj === null) return 0;
      if (Array.isArray(obj)) return obj.reduce((sum, item) => sum + countKeys(item), 0);
      return Object.keys(obj).reduce((sum, key) => sum + 1 + countKeys(obj[key]), 0);
    }

    container.querySelector('#jf-format').addEventListener('click', format);
    container.querySelector('#jf-minify').addEventListener('click', minify);
    container.querySelector('#jf-validate').addEventListener('click', validate);

    container.querySelector('#jf-copy').addEventListener('click', (e) => {
      if (result.textContent) copyText(result.textContent, e.currentTarget);
    });

    input.focus();

    // Handed to the artifact strip, which is the only thing that reads these.
    this._read = () => result.textContent || input.value;
    this._write = (text) => { input.value = text; format(); };
  },

  /* The formatted output when there is one, otherwise whatever was typed —
     so Save after a glance at invalid JSON still keeps the person's work. */
  getArtifact() { return { kind: 'json', text: this._read?.() ?? '' }; },
  setArtifact(a) { this._write?.(a.text); },

  destroy() { this._read = this._write = null; }
};
