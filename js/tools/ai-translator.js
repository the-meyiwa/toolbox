export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">Language Translator</h2>
        <p class="tool-desc">Translate text between 50+ languages instantly for free via MyMemory API.</p>
        
        <div class="tool-section">
          <div style="display:flex; gap:12px; margin-bottom:12px;">
            <select class="tool-select" id="trans-from" style="flex:1;">
              <option value="en" selected>English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="pt">Portuguese</option>
              <option value="ru">Russian</option>
              <option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
              <option value="ar">Arabic</option>
              <option value="hi">Hindi</option>
            </select>
            
            <button class="btn btn-secondary" id="trans-swap" style="padding:0 16px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="14" x2="21" y2="3"/><polyline points="8 21 3 21 3 16"/><line x1="20" y1="10" x2="3" y2="21"/></svg>
            </button>
            
            <select class="tool-select" id="trans-to" style="flex:1;">
              <option value="en">English</option>
              <option value="es" selected>Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="pt">Portuguese</option>
              <option value="ru">Russian</option>
              <option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
              <option value="ar">Arabic</option>
              <option value="hi">Hindi</option>
            </select>
          </div>
          
          <textarea class="tool-input" id="trans-input" rows="4" placeholder="Type text to translate..." style="font-size:1.1rem; line-height:1.5; margin-bottom:12px;"></textarea>
          
          <div style="display:flex; align-items:center; gap:16px;">
            <button class="btn btn-primary" id="trans-btn">Translate</button>
            <div id="trans-status" style="color:var(--g500); font-size:0.9rem;"></div>
          </div>
        </div>

        <div id="trans-results" style="display:none; margin-top:24px;">
          <h4 style="font-family:var(--pixel); margin-bottom:12px; border-bottom:1px solid var(--g200); padding-bottom:4px;">Translation</h4>
          <div id="trans-output" style="background:var(--black); color:var(--white); padding:24px; border-radius:8px; font-size:1.25rem; line-height:1.6; white-space:pre-wrap;"></div>
        </div>
      </div>
    `;

    const input = container.querySelector('#trans-input');
    const fromSel = container.querySelector('#trans-from');
    const toSel = container.querySelector('#trans-to');
    const swapBtn = container.querySelector('#trans-swap');
    const btn = container.querySelector('#trans-btn');
    const statusDiv = container.querySelector('#trans-status');
    const resultsDiv = container.querySelector('#trans-results');
    const output = container.querySelector('#trans-output');

    swapBtn.addEventListener('click', () => {
      const temp = fromSel.value;
      fromSel.value = toSel.value;
      toSel.value = temp;
    });

    async function translate() {
      const text = input.value.trim();
      if (!text) return;
      
      const from = fromSel.value;
      const to = toSel.value;
      
      if (from === to) {
        output.textContent = text;
        resultsDiv.style.display = 'block';
        return;
      }
      
      statusDiv.textContent = 'Translating...';
      resultsDiv.style.display = 'none';
      btn.disabled = true;

      try {
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`);
        const data = await res.json();
        
        statusDiv.textContent = '';
        btn.disabled = false;
        
        if (data.responseData && data.responseData.translatedText) {
          output.textContent = data.responseData.translatedText;
          resultsDiv.style.display = 'block';
        } else {
          statusDiv.textContent = 'Error: Could not translate.';
        }
      } catch (e) {
        statusDiv.textContent = 'Error connecting to translation service.';
        btn.disabled = false;
      }
    }

    btn.addEventListener('click', translate);
  },
  destroy() {}
};
