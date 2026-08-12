export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">MAC Address Lookup</h2>
        <p class="tool-desc">Identify the manufacturer/vendor of a MAC Address.</p>
        <div class="tool-section">
          <div style="display:flex; gap:12px;">
            <input type="text" id="m-input" class="tool-input" placeholder="e.g. 00:1A:2B:3C:4D:5E" style="flex:1;">
            <button id="m-btn" class="btn btn-primary">Lookup</button>
          </div>
          <div id="m-res" style="margin-top:16px; font-size:1.1rem; font-weight:600;"></div>
        </div>
      </div>
    `;
    const btn = container.querySelector('#m-btn');
    const input = container.querySelector('#m-input');
    const res = container.querySelector('#m-res');
    
    btn.addEventListener('click', async () => {
      let mac = input.value.trim();
      if (!mac) return;
      res.textContent = 'Searching...';
      try {
        const req = await fetch('https://api.macvendors.com/' + encodeURIComponent(mac));
        if (!req.ok) throw new Error('Not Found');
        const text = await req.text();
        res.textContent = 'Vendor: ' + text;
      } catch(e) {
        res.textContent = 'Vendor not found or invalid MAC address.';
      }
    });
  },
  destroy() {}
};