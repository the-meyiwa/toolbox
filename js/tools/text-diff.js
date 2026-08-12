import { copyText } from '../utils.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          <label class="tool-label">Original</label>
          <textarea class="tool-textarea" id="diff-a" placeholder="Paste original text..." rows="14"></textarea>
        </div>
        <div class="tool-section">
          <label class="tool-label">Modified</label>
          <textarea class="tool-textarea" id="diff-b" placeholder="Paste modified text..." rows="14"></textarea>
        </div>
      </div>
      <div class="tool-controls" style="margin-top:16px;">
        <button class="btn btn-primary btn-sm" id="diff-compare">Compare</button>
      </div>
      <div class="tool-section" style="margin-top:16px;">
        <label class="tool-label">Differences</label>
        <div class="tool-output" id="diff-output" style="min-height:180px; white-space:pre-wrap; word-break:normal; font-size:0.82rem; line-height:1.8;">
          <span id="diff-result" style="color:var(--g300);">Click Compare to see differences</span>
        </div>
      </div>
      <div id="diff-stats" style="font-size:0.78rem; color:var(--g500); margin-top:8px;"></div>
    `;

    function escapeHtml(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function compare() {
      const a = container.querySelector('#diff-a').value.split('\n');
      const b = container.querySelector('#diff-b').value.split('\n');
      const result = container.querySelector('#diff-result');
      const stats = container.querySelector('#diff-stats');
      let html = '', added = 0, removed = 0, unchanged = 0;
      const maxLen = Math.max(a.length, b.length);

      for (let i = 0; i < maxLen; i++) {
        const lineA = i < a.length ? a[i] : undefined;
        const lineB = i < b.length ? b[i] : undefined;
        if (lineA === lineB) {
          html += `  ${escapeHtml(lineA)}\n`;
          unchanged++;
        } else {
          if (lineA !== undefined) { html += `<span style="background:var(--g100);color:var(--g600);">- ${escapeHtml(lineA)}</span>\n`; removed++; }
          if (lineB !== undefined) { html += `<span style="background:var(--black);color:var(--white);">+ ${escapeHtml(lineB)}</span>\n`; added++; }
        }
      }
      result.innerHTML = html || '<span style="color:var(--g300);">No differences found</span>';
      stats.textContent = `${added} added · ${removed} removed · ${unchanged} unchanged`;
    }

    container.querySelector('#diff-compare').addEventListener('click', compare);
  },
  destroy() {}
};
