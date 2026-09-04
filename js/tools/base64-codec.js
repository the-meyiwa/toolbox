import { copyText } from '../utils.js';

/* btoa and atob only speak Latin-1, so text has to be carried through bytes
   to survive anything outside it — accents, Arabic, emoji. The old
   escape/unescape pair did the same job but has been deprecated for years. */
const toBase64 = (text) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)));

const fromBase64 = (b64) => {
  // Accept the URL-safe alphabet and missing padding as well as the strict form.
  let normalised = b64.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  while (normalised.length % 4) normalised += '=';
  const binary = atob(normalised);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
};

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          <label class="tool-label">Text or Base64</label>
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
        const encoded = toBase64(input.value);
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
        const decoded = fromBase64(input.value);
        result.textContent = decoded;
        status.textContent = `✓ Decoded — ${decoded.length} characters`;
        status.style.color = 'var(--black)';
      } catch {
        result.textContent = '';
        status.textContent = '✗ That is not valid Base64 text';
        status.style.color = 'var(--g600)';
      }
    });

    container.querySelector('#b64-copy').addEventListener('click', (e) => {
      if (result.textContent) copyText(result.textContent, e.currentTarget);
    });

    input.focus();

    this._read = () => result.textContent || input.value;
    this._write = (text) => { input.value = text; result.textContent = ''; };
  },

  getArtifact() { return { kind: 'text', text: this._read?.() ?? '' }; },
  setArtifact(a) { this._write?.(a.text); },

  destroy() { this._read = this._write = null; }
};
