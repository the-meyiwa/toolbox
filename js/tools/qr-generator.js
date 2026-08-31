import QRCode from 'qrcode';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-section">
        <label class="tool-label">Text or URL</label>
        <textarea class="tool-textarea" id="qr-input" placeholder="Enter text or URL to encode…" rows="3" style="min-height:80px;"></textarea>
      </div>
      <div class="tool-section">
        <div class="qr-output" id="qr-output">
          <canvas id="qr-canvas"></canvas>
          <button class="btn btn-secondary btn-sm" id="qr-download" style="display:none;">Download PNG</button>
        </div>
      </div>
    `;

    const input      = container.querySelector('#qr-input');
    const canvas     = container.querySelector('#qr-canvas');
    const downloadBtn = container.querySelector('#qr-download');

    let debounceTimer;

    function generate() {
      const text = input.value.trim();
      if (!text) {
        const ctx = canvas.getContext('2d');
        canvas.width = 0;
        canvas.height = 0;
        ctx.clearRect(0, 0, 0, 0);
        downloadBtn.style.display = 'none';
        return;
      }

      QRCode.toCanvas(canvas, text, {
        width: 256,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      }, (err) => {
        if (err) {
          console.error(err);
          downloadBtn.style.display = 'none';
        } else {
          downloadBtn.style.display = '';
        }
      });
    }

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(generate, 200);
    });

    downloadBtn.addEventListener('click', () => {
      const link = document.createElement('a');
      link.download = 'qrcode.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    });

    // Generate with default text
    input.value = 'https://toolbox-gold-six.vercel.app';
    generate();
    input.focus();
    input.select();
  },

  destroy() {}
};
