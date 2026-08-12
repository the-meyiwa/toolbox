export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">QR Code Generator</h2>
        <p class="tool-desc">Generate a QR code instantly using a free API.</p>
        <div class="tool-section">
          <input type="text" id="qr-input" class="tool-input" placeholder="Enter URL or text">
          <button id="qr-btn" class="btn btn-primary" style="margin-top:12px;">Generate</button>
          <div style="margin-top:24px; text-align:center;">
            <img id="qr-result" style="display:none; max-width:100%; border-radius:8px; box-shadow:var(--shadow-sm);">
          </div>
        </div>
      </div>
    `;
    const btn = container.querySelector('#qr-btn');
    const input = container.querySelector('#qr-input');
    const img = container.querySelector('#qr-result');
    
    btn.addEventListener('click', () => {
      const text = input.value.trim();
      if (!text) return;
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(text)}`;
      img.style.display = 'inline-block';
    });
  },
  destroy() {}
};