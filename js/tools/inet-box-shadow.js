export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">Box Shadow Generator</h2>
        <p class="tool-desc">Generate CSS box-shadow visually.</p>
        <div class="tool-section" style="display:grid; grid-template-columns: 1fr 1fr; gap:32px;">
          <div style="display:flex; flex-direction:column; gap:12px;">
            <label>X Offset <input type="range" id="bs-x" min="-50" max="50" value="0"></label>
            <label>Y Offset <input type="range" id="bs-y" min="-50" max="50" value="10"></label>
            <label>Blur <input type="range" id="bs-b" min="0" max="100" value="20"></label>
            <label>Spread <input type="range" id="bs-s" min="-50" max="50" value="-5"></label>
            <label>Color <input type="color" id="bs-c" value="#000000"></label>
          </div>
          <div style="display:flex; flex-direction:column; align-items:center; justify-content:center;">
            <div id="bs-preview" style="width:150px; height:150px; background:var(--white); border-radius:12px;"></div>
          </div>
        </div>
        <pre id="bs-out" class="tool-output" style="margin-top:24px; font-size:1.1rem; text-align:center;"></pre>
      </div>
    `;
    const x = container.querySelector('#bs-x');
    const y = container.querySelector('#bs-y');
    const b = container.querySelector('#bs-b');
    const s = container.querySelector('#bs-s');
    const c = container.querySelector('#bs-c');
    const prev = container.querySelector('#bs-preview');
    const out = container.querySelector('#bs-out');
    
    const update = () => {
      // Add opacity to hex color (approx 30%)
      const colorHex = c.value;
      const r = parseInt(colorHex.substr(1,2), 16);
      const g = parseInt(colorHex.substr(3,2), 16);
      const blue = parseInt(colorHex.substr(5,2), 16);
      const rgbaStr = `rgba(${r}, ${g}, ${blue}, 0.2)`;
      
      const v = `${x.value}px ${y.value}px ${b.value}px ${s.value}px ${rgbaStr}`;
      prev.style.boxShadow = v;
      out.textContent = `box-shadow: ${v};`;
    };
    [x,y,b,s,c].forEach(el => el.addEventListener('input', update));
    update();
  },
  destroy() {}
};