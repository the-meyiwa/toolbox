export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-section">
        <label class="tool-label" for="wc-input">Your text</label>
        <textarea class="tool-textarea" id="wc-input" placeholder="Start typing or paste your text here…" rows="10"></textarea>
      </div>
      <div class="tool-stats-grid">
        <div class="tool-stat"><span class="tool-stat-value" id="wc-words">0</span><span class="tool-stat-label">Words</span></div>
        <div class="tool-stat"><span class="tool-stat-value" id="wc-chars">0</span><span class="tool-stat-label">Characters</span></div>
        <div class="tool-stat"><span class="tool-stat-value" id="wc-nospace">0</span><span class="tool-stat-label">No spaces</span></div>
        <div class="tool-stat"><span class="tool-stat-value" id="wc-sentences">0</span><span class="tool-stat-label">Sentences</span></div>
        <div class="tool-stat"><span class="tool-stat-value" id="wc-paragraphs">0</span><span class="tool-stat-label">Paragraphs</span></div>
        <div class="tool-stat"><span class="tool-stat-value" id="wc-reading">0m</span><span class="tool-stat-label">Read time</span></div>
      </div>
    `;

    const input = container.querySelector('#wc-input');

    function update() {
      const text = input.value;
      const trimmed = text.trim();

      const words      = trimmed ? trimmed.split(/\s+/).length : 0;
      const chars      = text.length;
      const noSpaces   = text.replace(/\s/g, '').length;
      const sentences  = trimmed ? (text.match(/[.!?]+(?:\s|$)/g) || []).length : 0;
      const paragraphs = trimmed ? text.split(/\n\s*\n/).filter(p => p.trim()).length : 0;
      const readMins   = Math.max(1, Math.ceil(words / 200));

      container.querySelector('#wc-words').textContent      = words.toLocaleString();
      container.querySelector('#wc-chars').textContent      = chars.toLocaleString();
      container.querySelector('#wc-nospace').textContent    = noSpaces.toLocaleString();
      container.querySelector('#wc-sentences').textContent  = sentences.toLocaleString();
      container.querySelector('#wc-paragraphs').textContent = paragraphs > 0 ? paragraphs.toLocaleString() : (trimmed ? '1' : '0');
      container.querySelector('#wc-reading').textContent    = words > 0 ? `${readMins}m` : '0m';
    }

    input.addEventListener('input', update);
    input.focus();

    this._write = (text) => { input.value = text; update(); };
  },

  /* Counting is a dead end by design: it reads work, it does not make any. */
  setArtifact(a) { this._write?.(a.text); },

  destroy() { this._write = null; }
};
