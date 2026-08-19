export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <div class="tool-section">
          <div style="display:flex; gap:12px;">
            <input type="text" id="rd-input" class="tool-input" placeholder="e.g. 8.8.8.8" style="flex:1;">
            <button id="rd-btn" class="btn btn-primary">Lookup</button>
          </div>
          <pre id="rd-res" class="tool-output" style="margin-top:16px; display:none;"></pre>
        </div>
      </div>
    `;
    const btn = container.querySelector('#rd-btn');
    const input = container.querySelector('#rd-input');
    const res = container.querySelector('#rd-res');
    
    btn.addEventListener('click', async () => {
      let ip = input.value.trim();
      if (!ip) return;
      res.style.display = 'block';
      res.textContent = 'Resolving...';
      try {
        const req = await fetch('https://networkcalc.com/api/dns/lookup/' + encodeURIComponent(ip));
        const data = await req.json();
        res.textContent = JSON.stringify(data.records || 'No reverse record found.', null, 2);
      } catch(e) {
        res.textContent = 'Error: ' + e.message;
      }
    });
  },
  destroy() {}
};