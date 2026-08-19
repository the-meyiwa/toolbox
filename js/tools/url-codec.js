import { copyText } from '../utils.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          <label class="tool-label">Text / URL</label>
          <textarea class="tool-textarea" id="url-input" placeholder="Enter text or URL-encoded string…" rows="8"></textarea>
        </div>
        <div class="tool-section">
          <label class="tool-label">Result</label>
          <div class="tool-output" id="url-output" style="min-height:160px;">
            <button class="copy-btn" id="url-copy">Copy</button>
            <span id="url-result"></span>
          </div>
        </div>
      </div>
      <div class="tool-controls" style="margin-top:16px;">
        <button class="btn btn-primary btn-sm" id="url-encode">Encode →</button>
        <button class="btn btn-secondary btn-sm" id="url-decode">← Decode</button>
        <button class="btn btn-secondary btn-sm" id="url-encode-comp">Encode Component</button>
      </div>
    `;

    const input  = container.querySelector('#url-input');
    const result = container.querySelector('#url-result');

    container.querySelector('#url-encode').addEventListener('click', () => {
      result.textContent = encodeURI(input.value);
    });

    container.querySelector('#url-decode').addEventListener('click', () => {
      try {
        result.textContent = decodeURIComponent(input.value);
      } catch {
        result.textContent = decodeURI(input.value);
      }
    });

    container.querySelector('#url-encode-comp').addEventListener('click', () => {
      result.textContent = encodeURIComponent(input.value);
    });

    container.querySelector('#url-copy').addEventListener('click', (e) => {
      if (result.textContent) copyText(result.textContent, e.currentTarget);
    });

    input.focus();
  },

  destroy() {}
};
