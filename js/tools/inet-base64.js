export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">Base64 Encoder/Decoder</h2>
        <p class="tool-desc">Encode or decode strings to Base64 locally.</p>
        <div class="tool-section">
          <textarea id="b64-input" class="tool-input" rows="4" placeholder="Enter text to encode/decode"></textarea>
          <div style="margin-top:12px; display:flex; gap:8px;">
            <button id="b64-enc" class="btn btn-primary">Encode</button>
            <button id="b64-dec" class="btn btn-secondary">Decode</button>
          </div>
          <textarea id="b64-result" class="tool-output" rows="4" style="margin-top:16px;" readonly></textarea>
        </div>
      </div>
    `;
    const input = container.querySelector('#b64-input');
    const res = container.querySelector('#b64-result');
    container.querySelector('#b64-enc').addEventListener('click', () => {
      try { res.value = btoa(input.value); } catch(e) { res.value = 'Error: Invalid characters for encoding.'; }
    });
    container.querySelector('#b64-dec').addEventListener('click', () => {
      try { res.value = atob(input.value); } catch(e) { res.value = 'Error: Invalid Base64 string.'; }
    });
  },
  destroy() {}
};