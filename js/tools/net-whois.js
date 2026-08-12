export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">WHOIS Lookup</h2>
        <p class="tool-desc">Find domain registration details (registrar, dates, contacts).</p>
        <div class="tool-section">
          <div style="display:flex; gap:12px;">
            <input type="text" id="w-input" class="tool-input" placeholder="example.com" style="flex:1;">
            <button id="w-btn" class="btn btn-primary">Lookup</button>
          </div>
          <pre id="w-res" class="tool-output" style="margin-top:16px; display:none; max-height:400px; overflow:auto;"></pre>
        </div>
      </div>
    `;
    const btn = container.querySelector('#w-btn');
    const input = container.querySelector('#w-input');
    const res = container.querySelector('#w-res');
    
    btn.addEventListener('click', async () => {
      let domain = input.value.trim().replace(/^https?:\/\//, '').split('/')[0];
      if (!domain) return;
      res.style.display = 'block';
      res.textContent = 'Querying WHOIS...';
      try {
        const req = await fetch('https://networkcalc.com/api/dns/whois/' + encodeURIComponent(domain));
        const data = await req.json();
        res.textContent = JSON.stringify(data.whois, null, 2);
      } catch(e) {
        res.textContent = 'Error: ' + e.message;
      }
    });
  },
  destroy() {}
};