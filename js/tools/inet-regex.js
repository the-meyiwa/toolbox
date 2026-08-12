export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">Regex Tester</h2>
        <p class="tool-desc">Test regular expressions against a text string.</p>
        <div class="tool-section">
          <input type="text" id="rx-pattern" class="tool-input" placeholder="Regex (e.g. [a-z]+)" style="margin-bottom:8px; font-family:var(--mono);">
          <input type="text" id="rx-flags" class="tool-input" placeholder="Flags (e.g. g, i)" style="margin-bottom:16px; font-family:var(--mono);" value="g">
          <textarea id="rx-text" class="tool-input" rows="4" placeholder="Test string here"></textarea>
          <div id="rx-res" style="margin-top:16px; padding:12px; border-radius:6px; background:var(--g50); min-height:40px;"></div>
        </div>
      </div>
    `;
    const pat = container.querySelector('#rx-pattern');
    const flags = container.querySelector('#rx-flags');
    const txt = container.querySelector('#rx-text');
    const res = container.querySelector('#rx-res');
    
    const update = () => {
      try {
        if (!pat.value) { res.innerHTML = ''; return; }
        const r = new RegExp(pat.value, flags.value);
        const match = txt.value.match(r);
        if (match) {
          res.innerHTML = `<span style="color:var(--green); font-weight:bold;">Match found!</span> (${match.length} results)`;
        } else {
          res.innerHTML = `<span style="color:var(--red);">No matches.</span>`;
        }
      } catch(e) {
        res.innerHTML = `<span style="color:var(--red);">Invalid Regex: ${e.message}</span>`;
      }
    };
    [pat, flags, txt].forEach(el => el.addEventListener('input', update));
  },
  destroy() {}
};