export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <div class="tool-section">
          <div style="display:flex; gap:12px;">
            <input type="text" id="dns-input" class="tool-input" placeholder="example.com" style="flex:1;">
            <button id="dns-btn" class="btn btn-primary">Lookup</button>
          </div>
          <pre id="dns-res" class="tool-output" style="margin-top:16px; display:none; max-height:400px; overflow:auto;"></pre>
        </div>
      </div>
    `;
    const btn = container.querySelector('#dns-btn');
    const input = container.querySelector('#dns-input');
    const res = container.querySelector('#dns-res');
    
    btn.addEventListener('click', async () => {
      let domain = input.value.trim().replace(/^https?:\/\//, '').split('/')[0];
      if (!domain) return;
      res.style.display = 'block';
      res.textContent = 'Querying DNS...';
      try {
        const req = await fetch('https://networkcalc.com/api/dns/lookup/' + encodeURIComponent(domain));
        const data = await req.json();
        res.textContent = JSON.stringify(data.records, null, 2);
      } catch(e) {
        res.textContent = 'Error: ' + e.message;
      }
    });
  },
  destroy() {}
};