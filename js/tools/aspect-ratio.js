import { copyText } from '../utils.js';

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-section">
        <label class="tool-label">Known dimensions</label>
        <div class="tool-row" style="gap:12px;">
          <div style="flex:1;">
            <label class="tool-label">Width (W1)</label>
            <input type="number" class="tool-input" id="ar-w1" value="1920">
          </div>
          <div style="flex:1;">
            <label class="tool-label">Height (H1)</label>
            <input type="number" class="tool-input" id="ar-h1" value="1080">
          </div>
        </div>
      </div>
      <div class="tool-section">
        <label class="tool-label">Calculated ratio</label>
        <div class="tool-output" id="ar-ratio-out" style="min-height:auto; padding:14px; font-size:1.2rem; font-weight:600; text-align:center;">
          <button class="copy-btn" id="ar-copy">Copy ratio</button>
          <span id="ar-ratio">16:9</span>
        </div>
      </div>
      <div class="tool-section">
        <label class="tool-label">Calculate a new dimension</label>
        <div class="tool-row" style="gap:12px;">
          <div style="flex:1;">
            <label class="tool-label">New width (W2)</label>
            <input type="number" class="tool-input" id="ar-w2" placeholder="e.g. 1280">
          </div>
          <div style="flex:1;">
            <label class="tool-label">New height (H2)</label>
            <input type="number" class="tool-input" id="ar-h2" placeholder="e.g. 720">
          </div>
        </div>
      </div>
    `;

    const w1 = container.querySelector('#ar-w1');
    const h1 = container.querySelector('#ar-h1');
    const w2 = container.querySelector('#ar-w2');
    const h2 = container.querySelector('#ar-h2');
    const ratioSpan = container.querySelector('#ar-ratio');

    function calculateRatio() {
      const v1 = parseInt(w1.value) || 0;
      const v2 = parseInt(h1.value) || 0;
      if (!v1 || !v2) { ratioSpan.textContent = '—'; return; }
      const divisor = gcd(v1, v2);
      ratioSpan.textContent = `${v1 / divisor}:${v2 / divisor}`;
    }

    w1.addEventListener('input', () => { calculateRatio(); if (w2.value) syncH2(); });
    h1.addEventListener('input', () => { calculateRatio(); if (w2.value) syncH2(); });

    function syncH2() {
      const v1 = parseFloat(w1.value);
      const v2 = parseFloat(h1.value);
      const nw = parseFloat(w2.value);
      if (v1 && v2 && nw) {
        h2.value = Math.round((nw * v2) / v1);
      }
    }

    function syncW2() {
      const v1 = parseFloat(w1.value);
      const v2 = parseFloat(h1.value);
      const nh = parseFloat(h2.value);
      if (v1 && v2 && nh) {
        w2.value = Math.round((nh * v1) / v2);
      }
    }

    w2.addEventListener('input', syncH2);
    h2.addEventListener('input', syncW2);

    container.querySelector('#ar-copy').addEventListener('click', (e) => {
      if (ratioSpan.textContent) copyText(ratioSpan.textContent, e.currentTarget);
    });

    calculateRatio();
  },
  destroy() {}
};
