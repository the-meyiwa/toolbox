import { copyText } from '../utils.js';

const ALGORITHMS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

async function computeHash(algorithm, text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-section">
        <label class="tool-label">Input</label>
        <textarea class="tool-textarea" id="hash-input" placeholder="Enter text to hash..." rows="5"></textarea>
      </div>
      <div class="tool-section">
        <label class="tool-label">Hashes</label>
        <div id="hash-results">
          ${ALGORITHMS.map(alg => `
            <div style="margin-bottom:12px;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                <span class="tool-label" style="margin:0;">${alg}</span>
                <button class="copy-btn" data-alg="${alg}">Copy</button>
              </div>
              <div class="tool-output" id="hash-${alg}" style="min-height:auto; padding:10px 14px; font-size:0.8rem; word-break:break-all;">
                <span style="color:var(--g300);">—</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const input = container.querySelector('#hash-input');

    async function update() {
      const text = input.value;
      if (!text) {
        ALGORITHMS.forEach(alg => {
          container.querySelector(`#hash-${alg}`).innerHTML = '<span style="color:var(--g300);">—</span>';
        });
        return;
      }
      for (const alg of ALGORITHMS) {
        try {
          const hash = await computeHash(alg, text);
          container.querySelector(`#hash-${alg}`).textContent = hash;
        } catch {
          container.querySelector(`#hash-${alg}`).textContent = 'Error';
        }
      }
    }

    let debounceTimer;
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(update, 100);
    });

    // Copy buttons
    container.querySelector('#hash-results').addEventListener('click', (e) => {
      const btn = e.target.closest('.copy-btn[data-alg]');
      if (!btn) return;
      const alg = btn.dataset.alg;
      const text = container.querySelector(`#hash-${alg}`).textContent;
      if (text && text !== '—') copyText(text, btn);
    });

    input.focus();
  },

  destroy() {}
};
