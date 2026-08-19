import { copyText } from '../utils.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          <label class="tool-label">Text / Base64</label>
          <textarea class="tool-textarea" id="b64-input" placeholder="Enter text or Base64 string…" rows="10"></textarea>
        </div>
        <div class="tool-section">
          <label class="tool-label">Result</label>
          <div class="tool-output" id="b64-output" style="min-height:200px;">
            <button class="copy-btn" id="b64-copy">Copy</button>
            <span id="b64-result"></span>
          </div>
        </div>
      </div>
      <div class="tool-controls" style="margin-top:16px;">
        <button class="btn btn-primary btn-sm" id="b64-encode">Encode →</button>
        <button class="btn btn-secondary btn-sm" id="b64-decode">← Decode</button>
      </div>
      <div id="b64-status" style="margin-top:8px; font-size:0.78rem; color:var(--g500);"></div>
    `;

    const input  = container.querySelector('#b64-input');
    const result = container.querySelector('#b64-result');
    const status = container.querySelector('#b64-status');

    container.querySelector('#b64-encode').addEventListener('click', () => {
      try {
        const encoded = btoa(unescape(encodeURIComponent(input.value)));
        result.textContent = encoded;
        status.textContent = `✓ Encoded — ${encoded.length} characters`;
        status.style.color = 'var(--black)';
      } catch (e) {
        result.textContent = '';
        status.textContent = '✗ ' + e.message;
        status.style.color = 'var(--g600)';
      }
    });

    container.querySelector('#b64-decode').addEventListener('click', () => {
      try {
        const decoded = decodeURIComponent(escape(atob(input.value.trim())));
        result.textContent = decoded;
        status.textContent = `✓ Decoded — ${decoded.length} characters`;
        status.style.color = 'var(--black)';
      } catch (e) {
        result.textContent = '';
        status.textContent = '✗ Invalid Base64 string';
        status.style.color = 'var(--g600)';
      }
    });

    container.querySelector('#b64-copy').addEventListener('click', (e) => {
      if (result.textContent) copyText(result.textContent, e.currentTarget);
    });

    input.focus();
  },

  destroy() {}
};
