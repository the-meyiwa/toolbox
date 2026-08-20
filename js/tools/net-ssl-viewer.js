export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <div class="tool-section">
          <div style="display:flex; gap:12px;">
            <input type="text" id="s-input" class="tool-input" placeholder="example.com" style="flex:1;">
            <button id="s-btn" class="btn btn-primary">View SSL</button>
          </div>
          <pre id="s-res" class="tool-output" style="margin-top:16px; display:none; max-height:400px; overflow:auto;"></pre>
        </div>
      </div>
    `;
    const btn = container.querySelector('#s-btn');
    const input = container.querySelector('#s-input');
    const res = container.querySelector('#s-res');
    
    btn.addEventListener('click', async () => {
      let domain = input.value.trim().replace(/^https?:\/\//, '').split('/')[0];
      if (!domain) return;
      res.style.display = 'block';
      res.textContent = 'Fetching the certificate…';
      try {
        const req = await fetch('https://networkcalc.com/api/security/certificate/' + encodeURIComponent(domain));
        const data = await req.json();
        res.textContent = JSON.stringify(data.certificate, null, 2);
      } catch(e) {
        res.textContent = 'Error: ' + e.message;
      }
    });
  },
  destroy() {}
};