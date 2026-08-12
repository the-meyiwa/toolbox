export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">Google Search Generator</h2>
        <p class="tool-desc">Generate advanced Google search queries (dorks) instantly.</p>
        <div class="tool-section" style="display:flex; flex-direction:column; gap:12px;">
          <input type="text" id="g-query" class="tool-input" placeholder="Main keyword or phrase">
          <input type="text" id="g-site" class="tool-input" placeholder="Site (e.g. reddit.com)">
          <input type="text" id="g-filetype" class="tool-input" placeholder="Filetype (e.g. pdf)">
          <input type="text" id="g-exclude" class="tool-input" placeholder="Exclude words (e.g. apple)">
          <button id="g-btn" class="btn btn-primary" style="margin-top:12px;">Search Google</button>
        </div>
      </div>
    `;
    container.querySelector('#g-btn').addEventListener('click', () => {
      const q = container.querySelector('#g-query').value.trim();
      const s = container.querySelector('#g-site').value.trim();
      const f = container.querySelector('#g-filetype').value.trim();
      const e = container.querySelector('#g-exclude').value.trim();
      
      let final = q;
      if (s) final += ' site:' + s;
      if (f) final += ' filetype:' + f;
      if (e) final += ' ' + e.split(' ').map(w => '-' + w).join(' ');
      
      if (!final) return;
      window.open('https://www.google.com/search?q=' + encodeURIComponent(final), '_blank');
    });
  },
  destroy() {}
};