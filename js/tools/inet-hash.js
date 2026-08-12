export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">SHA-256 Hash Generator</h2>
        <p class="tool-desc">Generate secure SHA-256 hashes locally in your browser.</p>
        <div class="tool-section">
          <textarea id="hash-input" class="tool-input" rows="4" placeholder="Enter text to hash"></textarea>
          <pre id="hash-res" class="tool-output" style="margin-top:16px; min-height:60px; font-size:1rem;"></pre>
        </div>
      </div>
    `;
    const inp = container.querySelector('#hash-input');
    const res = container.querySelector('#hash-res');
    
    inp.addEventListener('input', async () => {
      const msg = inp.value;
      if(!msg) { res.textContent = ''; return; }
      const msgUint8 = new TextEncoder().encode(msg);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      res.textContent = hashHex;
    });
  },
  destroy() {}
};