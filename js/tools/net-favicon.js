export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">Favicon Finder</h2>
        <p class="tool-desc">Quickly extract the Favicon from any website.</p>
        <div class="tool-section">
          <div style="display:flex; gap:12px;">
            <input type="text" id="f-input" class="tool-input" placeholder="example.com" style="flex:1;">
            <button id="f-btn" class="btn btn-primary">Get Icon</button>
          </div>
          <div style="margin-top:24px; text-align:center;">
            <img id="f-res" style="display:none; width:64px; height:64px; border-radius:12px; box-shadow:var(--shadow-sm);">
          </div>
        </div>
      </div>
    `;
    const btn = container.querySelector('#f-btn');
    const input = container.querySelector('#f-input');
    const res = container.querySelector('#f-res');
    
    btn.addEventListener('click', () => {
      let domain = input.value.trim().replace(/^https?:\/\//, '').split('/')[0];
      if (!domain) return;
      res.src = `https://s2.googleusercontent.com/s2/favicons?domain=${domain}&sz=128`;
      res.style.display = 'inline-block';
    });
  },
  destroy() {}
};