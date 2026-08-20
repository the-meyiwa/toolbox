import { copyText } from '../utils.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-section">
        <label class="tool-label">Input</label>
        <textarea class="tool-textarea" id="rd-input" placeholder="Paste text with duplicate lines…" rows="8"></textarea>
      </div>
      <div class="tool-controls">
        <button class="btn btn-primary btn-sm" id="rd-process">Remove duplicates</button>
        <label class="tool-checkbox" style="margin-left:12px;"><input type="checkbox" id="rd-case"> Case insensitive</label>
        <label class="tool-checkbox"><input type="checkbox" id="rd-trim" checked> Trim whitespace</label>
      </div>
      <div class="tool-section">
        <label class="tool-label">Output</label>
        <div class="tool-output" id="rd-output" style="min-height:160px;">
          <button class="copy-btn" id="rd-copy">Copy</button>
          <span id="rd-result"></span>
        </div>
      </div>
      <div id="rd-stats" style="font-size:0.78rem; color:var(--g500); margin-top:8px;"></div>
    `;

    function process() {
      const lines = container.querySelector('#rd-input').value.split('\n');
      const ci = container.querySelector('#rd-case').checked;
      const trim = container.querySelector('#rd-trim').checked;
      const seen = new Set();
      const unique = [];
      for (const line of lines) {
        let key = line;
        if (trim) key = key.trim();
        if (ci) key = key.toLowerCase();
        if (!seen.has(key)) { seen.add(key); unique.push(line); }
      }
      container.querySelector('#rd-result').textContent = unique.join('\n');
      const removed = lines.length - unique.length;
      container.querySelector('#rd-stats').textContent = removed + ' duplicate' + (removed !== 1 ? 's' : '') + ' removed · ' + unique.length + ' unique lines';
    }

    container.querySelector('#rd-process').addEventListener('click', process);
    container.querySelector('#rd-copy').addEventListener('click', (e) => {
      const t = container.querySelector('#rd-result').textContent;
      if (t) copyText(t, e.currentTarget);
    });

    const input = container.querySelector('#rd-input');
    this._read = () => container.querySelector('#rd-result').textContent || input.value;
    this._write = (text) => { input.value = text; process(); };
  },

  getArtifact() { return { kind: 'text', text: this._read?.() ?? '' }; },
  setArtifact(a) { this._write?.(a.text); },

  destroy() { this._read = this._write = null; }
};
