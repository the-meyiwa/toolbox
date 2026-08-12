export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">Language Detector</h2>
        <p class="tool-desc">AI instantly identifies the language of any given text without needing API keys.</p>
        
        <div class="tool-section">
          <textarea class="tool-input" id="lang-input" rows="4" placeholder="Paste some text in any language..." style="font-size:1.1rem; line-height:1.5;"></textarea>
          <div style="margin-top:12px; display:flex; align-items:center; gap:16px;">
            <button class="btn btn-primary" id="lang-btn">Detect Language</button>
            <div id="lang-status" style="color:var(--g500); font-size:0.9rem;"></div>
          </div>
        </div>

        <div id="lang-results" style="display:none; margin-top:24px; padding:24px; border-radius:8px; border:2px solid var(--black); text-align:center;">
          <div style="color:var(--g500); font-size:0.9rem; margin-bottom:8px; text-transform:uppercase; letter-spacing:1px;">Detected Language</div>
          <div id="lang-output" style="font-family:var(--pixel); font-size:3rem; margin-bottom:8px;"></div>
          <div id="lang-code" style="color:var(--g400); font-family:var(--mono);"></div>
        </div>
      </div>
    `;

    const input = container.querySelector('#lang-input');
    const btn = container.querySelector('#lang-btn');
    const statusDiv = container.querySelector('#lang-status');
    const resultsDiv = container.querySelector('#lang-results');
    const output = container.querySelector('#lang-output');
    const codeOutput = container.querySelector('#lang-code');

    const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });

    async function detectLanguage() {
      const text = input.value.trim();
      if (!text) return;
      
      statusDiv.textContent = 'Detecting...';
      resultsDiv.style.display = 'none';
      btn.disabled = true;

      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
        const res = await fetch(url);
        const data = await res.json();
        
        statusDiv.textContent = '';
        btn.disabled = false;
        
        if (data && data[2]) {
          const langCode = data[2];
          try {
            output.textContent = languageNames.of(langCode);
          } catch (e) {
            output.textContent = 'Unknown';
          }
          codeOutput.textContent = `Code: ${langCode.toUpperCase()}`;
          resultsDiv.style.display = 'block';
        } else {
          statusDiv.textContent = 'Could not determine language.';
        }
      } catch (e) {
        statusDiv.textContent = 'Error connecting to detection service.';
        btn.disabled = false;
      }
    }

    btn.addEventListener('click', detectLanguage);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) detectLanguage();
    });
  },
  destroy() {}
};
