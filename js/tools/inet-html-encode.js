export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">HTML Encoder/Decoder</h2>
        <p class="tool-desc">Encode or decode HTML entities.</p>
        <div class="tool-section">
          <textarea id="html-input" class="tool-input" rows="4" placeholder="Enter text containing HTML or entities"></textarea>
          <div style="margin-top:12px; display:flex; gap:8px;">
            <button id="html-enc" class="btn btn-primary">Encode Entities</button>
            <button id="html-dec" class="btn btn-secondary">Decode Entities</button>
          </div>
          <textarea id="html-res" class="tool-output" rows="4" style="margin-top:16px;" readonly></textarea>
        </div>
      </div>
    `;
    const input = container.querySelector('#html-input');
    const res = container.querySelector('#html-res');
    container.querySelector('#html-enc').addEventListener('click', () => {
      const div = document.createElement('div');
      div.innerText = input.value;
      res.value = div.innerHTML;
    });
    container.querySelector('#html-dec').addEventListener('click', () => {
      const txt = document.createElement('textarea');
      txt.innerHTML = input.value;
      res.value = txt.value;
    });
  },
  destroy() {}
};