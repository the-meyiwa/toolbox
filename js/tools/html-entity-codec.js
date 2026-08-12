import { copyText } from '../utils.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          <label class="tool-label">Raw Text / HTML Entities</label>
          <textarea class="tool-textarea" id="html-input" placeholder="Enter text or HTML entities (e.g. &lt;div&gt; &amp; &quot;test&quot;)..." rows="10"></textarea>
        </div>
        <div class="tool-section">
          <label class="tool-label">Result</label>
          <div class="tool-output" id="html-output" style="min-height:200px;">
            <button class="copy-btn" id="html-copy">Copy</button>
            <span id="html-result"></span>
          </div>
        </div>
      </div>
      <div class="tool-controls" style="margin-top:16px;">
        <button class="btn btn-primary btn-sm" id="html-encode">Encode Entities →</button>
        <button class="btn btn-secondary btn-sm" id="html-decode">← Decode Entities</button>
      </div>
    `;

    const input = container.querySelector('#html-input');
    const result = container.querySelector('#html-result');

    container.querySelector('#html-encode').addEventListener('click', () => {
      const text = input.value;
      result.textContent = text.replace(/[\u00A0-\u9999<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
    });

    container.querySelector('#html-decode').addEventListener('click', () => {
      const text = input.value;
      const doc = new DOMParser().parseFromString(text, 'text/html');
      result.textContent = doc.documentElement.textContent;
    });

    container.querySelector('#html-copy').addEventListener('click', (e) => {
      if (result.textContent) copyText(result.textContent, e.currentTarget);
    });

    input.focus();
  },
  destroy() {}
};
