import { copyText } from '../utils.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-section">
        <label class="tool-label">Input</label>
        <textarea class="tool-textarea" id="sl-input" placeholder="Enter text with multiple lines…" rows="8"></textarea>
      </div>
      <div class="tool-controls">
        <button class="btn btn-primary btn-sm" data-action="az">A → Z</button>
        <button class="btn btn-secondary btn-sm" data-action="za">Z → A</button>
        <button class="btn btn-secondary btn-sm" data-action="length">By length</button>
        <button class="btn btn-secondary btn-sm" data-action="reverse">Reverse</button>
        <button class="btn btn-secondary btn-sm" data-action="shuffle">Shuffle</button>
        <button class="btn btn-secondary btn-sm" data-action="empty">Remove empty lines</button>
      </div>
      <div class="tool-section">
        <label class="tool-label">Output</label>
        <div class="tool-output" id="sl-output" style="min-height:160px;">
          <button class="copy-btn" id="sl-copy">Copy</button>
          <span id="sl-result"></span>
        </div>
      </div>
      <div id="sl-stats" style="font-size:0.78rem; color:var(--g500); margin-top:8px;"></div>
    `;

    const input = container.querySelector('#sl-input');
    const result = container.querySelector('#sl-result');
    const stats = container.querySelector('#sl-stats');

    function process(action) {
      let lines = input.value.split('\n');
      const before = lines.length;
      switch (action) {
        case 'az':      lines.sort((a, b) => a.localeCompare(b)); break;
        case 'za':      lines.sort((a, b) => b.localeCompare(a)); break;
        case 'length':  lines.sort((a, b) => a.length - b.length); break;
        case 'reverse': lines.reverse(); break;
        case 'shuffle': for (let i = lines.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [lines[i], lines[j]] = [lines[j], lines[i]]; } break;
        case 'empty':   lines = lines.filter(l => l.trim()); break;
      }
      result.textContent = lines.join('\n');
      stats.textContent = action === 'empty' ? `${before - lines.length} empty lines removed` : `${lines.length} lines sorted`;
    }

    container.querySelector('.tool-controls').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) process(btn.dataset.action);
    });

    container.querySelector('#sl-copy').addEventListener('click', (e) => {
      if (result.textContent) copyText(result.textContent, e.currentTarget);
    });

    input.focus();

    this._read = () => result.textContent || input.value;
    this._write = (text) => { input.value = text; result.textContent = ''; stats.textContent = ''; };
  },

  getArtifact() { return { kind: 'text', text: this._read?.() ?? '' }; },
  setArtifact(a) { this._write?.(a.text); },

  destroy() { this._read = this._write = null; }
};
