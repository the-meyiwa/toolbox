export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">JWT Decoder</h2>
        <p class="tool-desc">Decode a JSON Web Token to see its payload (locally).</p>
        <div class="tool-section">
          <textarea id="jwt-input" class="tool-input" rows="3" placeholder="Paste JWT here (eyJ...)"></textarea>
          <pre id="jwt-result" class="tool-output" style="margin-top:16px; min-height:100px;">Decoded payload will appear here.</pre>
        </div>
      </div>
    `;
    const input = container.querySelector('#jwt-input');
    const res = container.querySelector('#jwt-result');
    
    input.addEventListener('input', () => {
      const token = input.value.trim();
      if (!token) { res.textContent = ''; return; }
      try {
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('Invalid JWT format');
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        res.textContent = JSON.stringify(payload, null, 2);
      } catch(e) {
        res.textContent = 'Invalid JWT.';
      }
    });
  },
  destroy() {}
};