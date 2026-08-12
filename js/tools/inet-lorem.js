export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">Lorem Ipsum Generator</h2>
        <p class="tool-desc">Generate placeholder text instantly.</p>
        <div class="tool-section">
          <div style="display:flex; gap:16px; align-items:center; margin-bottom:16px;">
            <label>Paragraphs: <input type="number" id="lorem-num" min="1" max="10" value="3" class="tool-input" style="width:80px; padding:4px 8px;"></label>
            <button id="lorem-btn" class="btn btn-primary">Generate</button>
          </div>
          <textarea id="lorem-res" class="tool-output" rows="10" readonly></textarea>
        </div>
      </div>
    `;
    const btn = container.querySelector('#lorem-btn');
    const num = container.querySelector('#lorem-num');
    const res = container.querySelector('#lorem-res');
    
    const text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";
    
    btn.addEventListener('click', () => {
      const c = parseInt(num.value) || 3;
      let out = [];
      for(let i=0; i<c; i++) out.push(text);
      res.value = out.join('\n\n');
    });
  },
  destroy() {}
};