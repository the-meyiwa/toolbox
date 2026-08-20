export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <div class="tool-section">
          <div style="display:flex; gap:12px;">
            <input type="text" id="da-input" class="tool-input" placeholder="example.com" style="flex:1;">
            <button id="da-btn" class="btn btn-primary">Check</button>
          </div>
          <div id="da-res" style="margin-top:16px; font-size:1.2rem; font-weight:600; text-align:center;"></div>
        </div>
      </div>
    `;
    const btn = container.querySelector('#da-btn');
    const input = container.querySelector('#da-input');
    const res = container.querySelector('#da-res');
    
    btn.addEventListener('click', async () => {
      let domain = input.value.trim().replace(/^https?:\/\//, '').split('/')[0];
      if (!domain) return;
      res.textContent = 'Checking…';
      res.className = '';
      try {
        const req = await fetch('https://networkcalc.com/api/dns/whois/' + encodeURIComponent(domain));
        const data = await req.json();
        const registered = data.status === 'OK' && data.whois && Object.keys(data.whois).length > 0 && data.whois.registrar;
        if (registered) {
          res.textContent = `${domain} is registered to ${data.whois.registrar}.`;
          res.className = 'biz-neg';
        } else {
          res.textContent = `No registration found for ${domain}. It may be free to take — confirm with a registrar before you rely on it.`;
          res.className = 'biz-pos';
        }
      } catch {
        res.textContent = 'That check could not be completed. Check your connection and try again.';
      }
    });
  },
  destroy() {}
};