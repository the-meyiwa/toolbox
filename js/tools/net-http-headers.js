export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">HTTP Status & Headers</h2>
        <p class="tool-desc">Check the HTTP response headers and status of any URL.</p>
        <div class="tool-section">
          <div style="display:flex; gap:12px;">
            <input type="url" id="h-input" class="tool-input" placeholder="https://example.com" style="flex:1;">
            <button id="h-btn" class="btn btn-primary">Check</button>
          </div>
          <pre id="h-res" class="tool-output" style="margin-top:16px; display:none; max-height:400px; overflow:auto;"></pre>
        </div>
      </div>
    `;
    const btn = container.querySelector('#h-btn');
    const input = container.querySelector('#h-input');
    const res = container.querySelector('#h-res');
    
    btn.addEventListener('click', async () => {
      let url = input.value.trim();
      if (!url) return;
      if (!url.startsWith('http')) url = 'https://' + url;
      res.style.display = 'block';
      res.textContent = 'Fetching headers...';
      try {
        const req = await fetch(url, { method: 'HEAD', mode: 'cors' });
        let out = `Status: ${req.status} ${req.statusText}\n\nHeaders:\n`;
        req.headers.forEach((val, key) => {
          out += `${key}: ${val}\n`;
        });
        res.textContent = out;
      } catch(e) {
        res.textContent = 'Error: CORS policy prevents reading headers directly from this domain, or the domain is unreachable.';
      }
    });
  },
  destroy() {}
};