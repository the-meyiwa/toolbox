export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">JSON Formatter</h2>
        <p class="tool-desc">Format, prettify, and validate JSON data.</p>
        <div class="tool-section">
          <textarea id="json-input" class="tool-input" rows="6" placeholder="Paste unformatted JSON here..." style="font-family:var(--mono);"></textarea>
          <button id="json-btn" class="btn btn-primary" style="margin-top:12px;">Format JSON</button>
          <pre id="json-res" class="tool-output" style="margin-top:16px; display:none; max-height:400px; overflow:auto;"></pre>
        </div>
      </div>
    `;
    const input = container.querySelector('#json-input');
    const btn = container.querySelector('#json-btn');
    const res = container.querySelector('#json-res');
    
    btn.addEventListener('click', () => {
      res.style.display = 'block';
      try {
        const obj = JSON.parse(input.value);
        res.textContent = JSON.stringify(obj, null, 2);
        res.style.borderLeft = '4px solid var(--green)';
      } catch(e) {
        res.textContent = 'Invalid JSON: ' + e.message;
        res.style.borderLeft = '4px solid var(--red)';
      }
    });
  },
  destroy() {}
};