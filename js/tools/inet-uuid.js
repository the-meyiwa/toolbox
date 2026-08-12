export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">UUID Generator</h2>
        <p class="tool-desc">Generate secure Version 4 UUIDs.</p>
        <div class="tool-section" style="text-align:center;">
          <div id="uuid-res" style="font-family:var(--mono); font-size:1.2rem; padding:24px; background:var(--g50); border:1px solid var(--g200); border-radius:8px; margin-bottom:16px; user-select:all;"></div>
          <button id="uuid-btn" class="btn btn-primary">Generate New UUID</button>
        </div>
      </div>
    `;
    const res = container.querySelector('#uuid-res');
    const btn = container.querySelector('#uuid-btn');
    const generate = () => {
      res.textContent = crypto.randomUUID();
    };
    btn.addEventListener('click', generate);
    generate();
  },
  destroy() {}
};