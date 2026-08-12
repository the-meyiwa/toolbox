export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">Password Generator</h2>
        <p class="tool-desc">Generate secure passwords entirely in your browser.</p>
        <div class="tool-section">
          <div style="display:flex; align-items:center; justify-content:space-between; padding:16px; background:var(--g100); border-radius:8px; margin-bottom:16px;">
            <span id="pw-result" style="font-family:var(--mono); font-size:1.4rem; font-weight:700; letter-spacing:2px; word-break:break-all;">Click Generate</span>
            <button id="pw-copy" class="btn btn-secondary" style="padding:8px; border:none; background:transparent;">Copy</button>
          </div>
          <div style="display:flex; gap:16px; align-items:center; margin-bottom:16px;">
            <label>Length: <span id="pw-len-val">16</span></label>
            <input type="range" id="pw-len" min="8" max="64" value="16" style="flex:1;">
          </div>
          <button id="pw-btn" class="btn btn-primary" style="width:100%;">Generate Password</button>
        </div>
      </div>
    `;
    
    const btn = container.querySelector('#pw-btn');
    const copy = container.querySelector('#pw-copy');
    const res = container.querySelector('#pw-result');
    const lenInput = container.querySelector('#pw-len');
    const lenVal = container.querySelector('#pw-len-val');
    
    lenInput.addEventListener('input', () => lenVal.textContent = lenInput.value);
    
    const generate = () => {
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~|}{[]:;?><,./-=";
      let pw = "";
      for (let i = 0, n = chars.length; i < lenInput.value; ++i) {
        pw += chars.charAt(Math.floor(Math.random() * n));
      }
      res.textContent = pw;
    };
    
    btn.addEventListener('click', generate);
    copy.addEventListener('click', () => {
      navigator.clipboard.writeText(res.textContent);
      copy.textContent = 'Copied!';
      setTimeout(() => copy.textContent = 'Copy', 2000);
    });
    generate();
  },
  destroy() {}
};