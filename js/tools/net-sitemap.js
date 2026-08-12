export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">Sitemap & Robots.txt</h2>
        <p class="tool-desc">Quickly view a site's robots.txt directives.</p>
        <div class="tool-section">
          <div style="display:flex; gap:12px;">
            <input type="url" id="sm-input" class="tool-input" placeholder="https://example.com" style="flex:1;">
            <button id="sm-btn" class="btn btn-primary">Fetch</button>
          </div>
          <pre id="sm-res" class="tool-output" style="margin-top:16px; display:none; max-height:400px; overflow:auto;"></pre>
        </div>
      </div>
    `;
    const btn = container.querySelector('#sm-btn');
    const input = container.querySelector('#sm-input');
    const res = container.querySelector('#sm-res');
    
    btn.addEventListener('click', async () => {
      let url = input.value.trim();
      if (!url) return;
      if (!url.startsWith('http')) url = 'https://' + url;
      try {
        const parsed = new URL(url);
        res.style.display = 'block';
        res.textContent = 'Fetching robots.txt...';
        
        const req = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(parsed.origin + '/robots.txt')}`);
        const data = await req.json();
        if (data.contents) {
          res.textContent = data.contents;
        } else {
          res.textContent = 'Could not find or fetch robots.txt.';
        }
      } catch(e) {
        res.textContent = 'Invalid URL or fetch failed.';
      }
    });
  },
  destroy() {}
};