export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">IPv4 to IPv6 Converter</h2>
        <p class="tool-desc">Map a standard IPv4 address to an IPv6 address.</p>
        <div class="tool-section">
          <input type="text" id="ip-in" class="tool-input" placeholder="e.g. 192.168.1.1" style="margin-bottom:12px;">
          <pre id="ip-res" class="tool-output" style="min-height:60px; font-size:1.1rem;"></pre>
        </div>
      </div>
    `;
    const input = container.querySelector('#ip-in');
    const res = container.querySelector('#ip-res');
    
    input.addEventListener('input', () => {
      const v = input.value.trim();
      if (!v) { res.textContent = ''; return; }
      const parts = v.split('.');
      if (parts.length === 4 && parts.every(p => p >= 0 && p <= 255 && p !== '')) {
        const hex = parts.map(p => parseInt(p).toString(16).padStart(2, '0'));
        res.textContent = `IPv4-Mapped IPv6: ::ffff:${hex[0]}${hex[1]}:${hex[2]}${hex[3]}`;
      } else {
        res.textContent = 'Invalid IPv4 address.';
      }
    });
  },
  destroy() {}
};