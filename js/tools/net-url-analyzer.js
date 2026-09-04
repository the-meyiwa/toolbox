export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <div class="tool-section">
          <input type="url" id="u-input" class="tool-input" placeholder="https://example.com:8080/path?query=1#hash">
          <pre id="u-res" class="tool-output" style="margin-top:16px; min-height:150px; font-size:0.9rem;"></pre>
        </div>
      </div>
    `;
    const input = container.querySelector('#u-input');
    const res = container.querySelector('#u-res');
    
    input.addEventListener('input', () => {
      const val = input.value.trim();
      if (!val) { res.textContent = ''; return; }
      try {
        const u = new URL(val.startsWith('http') ? val : 'http://' + val);
        const searchParams = Object.fromEntries(u.searchParams.entries());
        res.textContent = JSON.stringify({
          Protocol: u.protocol,
          Host: u.host,
          Hostname: u.hostname,
          Port: u.port || 'default',
          Path: u.pathname,
          Search: u.search,
          Hash: u.hash,
          Origin: u.origin,
          QueryParams: searchParams
        }, null, 2);
      } catch(e) {
        res.textContent = 'That is not a URL this can read.';
      }
    });
  },
  destroy() {}
};