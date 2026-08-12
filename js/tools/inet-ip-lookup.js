export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">IP & Geolocation</h2>
        <p class="tool-desc">Find details about an IP address (via ip-api.com).</p>
        <div class="tool-section">
          <input type="text" id="ip-input" class="tool-input" placeholder="Enter IP address (or leave blank for your IP)">
          <button id="ip-btn" class="btn btn-primary" style="margin-top:12px;">Lookup</button>
          <pre id="ip-result" class="tool-output" style="margin-top:16px; display:none;"></pre>
        </div>
      </div>
    `;
    const btn = container.querySelector('#ip-btn');
    const input = container.querySelector('#ip-input');
    const res = container.querySelector('#ip-result');
    
    btn.addEventListener('click', async () => {
      const ip = input.value.trim();
      res.style.display = 'block';
      res.textContent = 'Looking up...';
      try {
        const url = ip ? `http://ip-api.com/json/${ip}` : `http://ip-api.com/json/`;
        const req = await fetch(url);
        const data = await req.json();
        res.textContent = JSON.stringify(data, null, 2);
      } catch (e) {
        res.textContent = 'Error: ' + e.message;
      }
    });
  },
  destroy() {}
};