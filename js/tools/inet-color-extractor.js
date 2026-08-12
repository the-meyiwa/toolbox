export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">Color Picker</h2>
        <p class="tool-desc">Select a color to get HEX and RGB values.</p>
        <div class="tool-section" style="display:flex; flex-direction:column; align-items:center;">
          <input type="color" id="cp-input" value="#000000" style="width:100px; height:100px; border:none; cursor:pointer; background:none; padding:0; margin-bottom:16px;">
          <div style="display:flex; gap:16px; width:100%;">
            <input type="text" id="cp-hex" class="tool-input" readonly>
            <input type="text" id="cp-rgb" class="tool-input" readonly>
          </div>
        </div>
      </div>
    `;
    const ip = container.querySelector('#cp-input');
    const hex = container.querySelector('#cp-hex');
    const rgb = container.querySelector('#cp-rgb');
    
    const update = () => {
      const h = ip.value;
      hex.value = h.toUpperCase();
      const r = parseInt(h.substr(1,2), 16);
      const g = parseInt(h.substr(3,2), 16);
      const b = parseInt(h.substr(5,2), 16);
      rgb.value = `rgb(${r}, ${g}, ${b})`;
    };
    ip.addEventListener('input', update);
    update();
  },
  destroy() {}
};