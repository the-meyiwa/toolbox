export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">IP Lookup</h2>
        <p class="tool-desc">Instantly find details about your public IP address or search any IP.</p>
        
        <div class="tool-section">
          <label class="tool-label">Lookup Custom IP (Leave blank for yours)</label>
          <div style="display:flex; gap:8px;">
            <input type="text" class="tool-input" id="ip-input" placeholder="e.g. 8.8.8.8" style="flex:1;">
            <button class="btn btn-primary" id="ip-btn">Lookup</button>
          </div>
          
          <div id="ip-loading" style="display:none; margin-top:16px; color:var(--g500);">Fetching details...</div>
          <div id="ip-error" style="display:none; margin-top:16px; color:#D32F2F;"></div>

          <div id="ip-results" style="display:none; margin-top:24px;">
            <div class="tool-stat" style="background:var(--black); color:var(--white); padding:24px; text-align:center; margin-bottom:24px;">
              <div class="tool-stat-label" style="color:var(--g400); margin-bottom:8px;">IP Address</div>
              <div class="tool-stat-value" id="res-ip" style="font-family:var(--pixel); font-size:3rem; word-break:break-all;"></div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
              <div class="tool-stat" style="padding:16px;">
                <div class="tool-stat-label" style="margin-bottom:4px;">Location</div>
                <div class="tool-stat-value" id="res-loc" style="font-size:1.15rem;"></div>
              </div>
              <div class="tool-stat" style="padding:16px;">
                <div class="tool-stat-label" style="margin-bottom:4px;">ISP / Organization</div>
                <div class="tool-stat-value" id="res-isp" style="font-size:1.15rem;"></div>
              </div>
              <div class="tool-stat" style="padding:16px;">
                <div class="tool-stat-label" style="margin-bottom:4px;">ASN</div>
                <div class="tool-stat-value" id="res-asn" style="font-size:1.15rem;"></div>
              </div>
              <div class="tool-stat" style="padding:16px;">
                <div class="tool-stat-label" style="margin-bottom:4px;">Timezone</div>
                <div class="tool-stat-value" id="res-tz" style="font-size:1.15rem;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const input = container.querySelector('#ip-input');
    const btn = container.querySelector('#ip-btn');
    const loading = container.querySelector('#ip-loading');
    const err = container.querySelector('#ip-error');
    const results = container.querySelector('#ip-results');

    async function lookup() {
      const ip = input.value.trim();
      const url = ip ? `https://ipapi.co/${ip}/json/` : 'https://ipapi.co/json/';
      
      loading.style.display = 'block';
      err.style.display = 'none';
      results.style.display = 'none';

      try {
        const res = await fetch(url);
        const data = await res.json();
        
        loading.style.display = 'none';
        
        if (data.error) {
          err.textContent = data.reason || 'Invalid IP or rate limit reached.';
          err.style.display = 'block';
          return;
        }

        container.querySelector('#res-ip').textContent = data.ip;
        container.querySelector('#res-loc').textContent = `${data.city || 'Unknown'}, ${data.region || ''} ${data.country_name || ''}`.trim();
        container.querySelector('#res-isp').textContent = data.org || 'Unknown';
        container.querySelector('#res-asn').textContent = data.asn || 'Unknown';
        container.querySelector('#res-tz').textContent = data.timezone || 'Unknown';

        results.style.display = 'block';

      } catch (e) {
        loading.style.display = 'none';
        err.textContent = 'Error connecting to IP service.';
        err.style.display = 'block';
      }
    }

    btn.addEventListener('click', lookup);
    input.addEventListener('keypress', e => e.key === 'Enter' && lookup());
    
    // Auto-load user's IP on open
    lookup();
  },
  destroy() {}
};
