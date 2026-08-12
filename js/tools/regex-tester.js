export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-section">
        <label class="tool-label">Pattern</label>
        <div class="tool-row" style="gap:8px;">
          <span style="font-family:var(--mono); font-size:0.9rem; color:var(--g400);">/</span>
          <input type="text" class="tool-input" id="rx-pattern" placeholder="[a-z]+" style="flex:1;">
          <span style="font-family:var(--mono); font-size:0.9rem; color:var(--g400);">/</span>
          <input type="text" class="tool-input" id="rx-flags" value="g" placeholder="flags" style="width:60px; text-align:center;">
        </div>
      </div>
      <div class="tool-section">
        <label class="tool-label">Test String</label>
        <textarea class="tool-textarea" id="rx-test" placeholder="Enter text to test against..." rows="5"></textarea>
      </div>
      <div class="tool-section">
        <label class="tool-label">Matches</label>
        <div class="tool-output" id="rx-matches" style="min-height:80px; word-break:break-word; white-space:pre-wrap;">
          <span id="rx-result"></span>
        </div>
      </div>
      <div id="rx-info" style="font-size:0.78rem; color:var(--g500); margin-top:8px;"></div>
    `;

    const patternInput = container.querySelector('#rx-pattern');
    const flagsInput   = container.querySelector('#rx-flags');
    const testInput    = container.querySelector('#rx-test');
    const result       = container.querySelector('#rx-result');
    const info         = container.querySelector('#rx-info');

    function update() {
      const patternStr = patternInput.value;
      const flags      = flagsInput.value;
      const testStr    = testInput.value;

      if (!patternStr || !testStr) {
        result.innerHTML = testStr || '<span style="color:var(--g300);">No matches to display</span>';
        info.textContent = '';
        return;
      }

      try {
        const regex = new RegExp(patternStr, flags);
        let matchCount = 0;
        let html = '';

        if (flags.includes('g')) {
          let lastIndex = 0;
          let match;
          // Reset lastIndex
          regex.lastIndex = 0;
          while ((match = regex.exec(testStr)) !== null) {
            // Prevent infinite loops on zero-length matches
            if (match.index === regex.lastIndex) regex.lastIndex++;

            html += escapeHtml(testStr.slice(lastIndex, match.index));
            html += `<mark class="regex-match">${escapeHtml(match[0])}</mark>`;
            lastIndex = match.index + match[0].length;
            matchCount++;

            if (matchCount > 1000) break; // Safety limit
          }
          html += escapeHtml(testStr.slice(lastIndex));
        } else {
          const match = regex.exec(testStr);
          if (match) {
            matchCount = 1;
            html = escapeHtml(testStr.slice(0, match.index));
            html += `<mark class="regex-match">${escapeHtml(match[0])}</mark>`;
            html += escapeHtml(testStr.slice(match.index + match[0].length));
          } else {
            html = escapeHtml(testStr);
          }
        }

        result.innerHTML = html;
        info.textContent = `${matchCount} match${matchCount !== 1 ? 'es' : ''} found`;
        info.style.color = matchCount > 0 ? 'var(--black)' : 'var(--g500)';
      } catch (e) {
        result.innerHTML = escapeHtml(testStr);
        info.textContent = '✗ ' + e.message;
        info.style.color = 'var(--g600)';
      }
    }

    function escapeHtml(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    patternInput.addEventListener('input', update);
    flagsInput.addEventListener('input', update);
    testInput.addEventListener('input', update);

    patternInput.focus();
  },

  destroy() {}
};
