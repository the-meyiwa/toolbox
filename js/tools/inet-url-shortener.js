export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">URL Shortener</h2>
        <p class="tool-desc">Shorten a long URL using the free is.gd API.</p>
        <div class="tool-section">
          <input type="url" id="url-input" class="tool-input" placeholder="https://example.com/very/long/url">
          <button id="url-btn" class="btn btn-primary" style="margin-top:12px;">Shorten URL</button>
          <div style="margin-top:16px;">
            <input type="text" id="url-result" class="tool-input" readonly placeholder="Shortened URL will appear here" onclick="this.select()">
          </div>
        </div>
      </div>
    `;
    const btn = container.querySelector('#url-btn');
    const input = container.querySelector('#url-input');
    const res = container.querySelector('#url-result');
    
    btn.addEventListener('click', async () => {
      const url = input.value.trim();
      if (!url) return;
      res.value = 'Shortening...';
      try {
        const req = await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`);
        const data = await req.json();
        if (data.shorturl) {
          res.value = data.shorturl;
        } else {
          res.value = data.errormessage || 'Error shortening URL';
        }
      } catch (e) {
        res.value = 'Error reaching API';
      }
    });
  },
  destroy() {}
};