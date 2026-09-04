import { copyText } from '../utils.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-section">
        <label class="tool-label">Text</label>
        <textarea class="tool-textarea" id="fr-input" placeholder="Enter your text…" rows="8"></textarea>
      </div>
      <div class="tool-row" style="margin-bottom:16px; gap:8px;">
        <div style="flex:1;">
          <label class="tool-label">Find</label>
          <input type="text" class="tool-input" id="fr-find" placeholder="Search term…" style="height:36px;">
        </div>
        <div style="flex:1;">
          <label class="tool-label">Replace with</label>
          <input type="text" class="tool-input" id="fr-replace" placeholder="Replacement…" style="height:36px;">
        </div>
      </div>
      <div class="tool-controls">
        <button class="btn btn-primary btn-sm" id="fr-all">Replace all</button>
        <label class="tool-checkbox" style="margin-left:12px;"><input type="checkbox" id="fr-case"> Case sensitive</label>
        <label class="tool-checkbox"><input type="checkbox" id="fr-regex"> Use regex</label>
      </div>
      <div class="tool-section">
        <label class="tool-label">Result</label>
        <div class="tool-output" id="fr-output" style="min-height:160px;">
          <button class="copy-btn" id="fr-copy">Copy</button>
          <span id="fr-result"></span>
        </div>
      </div>
      <div id="fr-stats" style="font-size:0.78rem; color:var(--g500); margin-top:8px;"></div>
    `;

    function process() {
      const text = container.querySelector('#fr-input').value;
      const find = container.querySelector('#fr-find').value;
      const replace = container.querySelector('#fr-replace').value;
      const caseSensitive = container.querySelector('#fr-case').checked;
      const useRegex = container.querySelector('#fr-regex').checked;
      if (!find) { container.querySelector('#fr-result').textContent = text; container.querySelector('#fr-stats').textContent = ''; return; }
      try {
        let flags = 'g';
        if (!caseSensitive) flags += 'i';
        // In plain mode every character is literal, so the pattern is escaped
        // before it reaches RegExp — otherwise searching for "." or "(" either
        // matches everything or throws.
        const pattern = useRegex ? find : find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(pattern, flags);
        // A literal $ in the replacement is only literal if it is doubled.
        const replacement = useRegex ? replace : replace.replace(/\$/g, '$$$$');
        const matches = (text.match(regex) || []).length;
        container.querySelector('#fr-result').textContent = text.replace(regex, replacement);
        container.querySelector('#fr-stats').textContent = matches + ' replacement' + (matches !== 1 ? 's' : '') + ' made';
      } catch (e) {
        container.querySelector('#fr-result').textContent = text;
        container.querySelector('#fr-stats').textContent = '✗ ' + e.message;
      }
    }

    container.querySelector('#fr-all').addEventListener('click', process);
    // Keep the result honest: a stale panel next to edited inputs is worse
    // than no panel at all.
    container.addEventListener('input', process);
    container.addEventListener('change', process);
    container.querySelector('#fr-copy').addEventListener('click', (e) => {
      const t = container.querySelector('#fr-result').textContent;
      if (t) copyText(t, e.currentTarget);
    });

    const source = container.querySelector('#fr-input');
    this._read = () => container.querySelector('#fr-result').textContent || source.value;
    this._write = (text) => { source.value = text; process(); };
  },

  getArtifact() { return { kind: 'text', text: this._read?.() ?? '' }; },
  setArtifact(a) { this._write?.(a.text); },

  destroy() { this._read = this._write = null; }
};
