export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">Grammar Checker</h2>
        <p class="tool-desc">AI-powered spell check and grammar correction. Powered by LanguageTool.</p>
        
        <div class="tool-section">
          <textarea class="tool-input" id="gram-input" rows="6" placeholder="Type or paste your text here to check for grammar and spelling errors..." style="font-size:1.1rem; line-height:1.5; margin-bottom:12px;"></textarea>
          
          <div style="display:flex; align-items:center; gap:16px;">
            <button class="btn btn-primary" id="gram-btn">Check Grammar</button>
            <div id="gram-status" style="color:var(--g500); font-size:0.9rem;"></div>
          </div>
        </div>

        <div id="gram-results" style="display:none; margin-top:24px;">
          <h4 style="font-family:var(--pixel); margin-bottom:12px; border-bottom:1px solid var(--g200); padding-bottom:4px;">Suggestions</h4>
          <div id="gram-output" style="display:flex; flex-direction:column; gap:12px;"></div>
        </div>
      </div>
    `;

    const input = container.querySelector('#gram-input');
    const btn = container.querySelector('#gram-btn');
    const statusDiv = container.querySelector('#gram-status');
    const resultsDiv = container.querySelector('#gram-results');
    const output = container.querySelector('#gram-output');

    async function checkGrammar() {
      const text = input.value.trim();
      if (!text) return;
      
      statusDiv.textContent = 'Checking text...';
      resultsDiv.style.display = 'none';
      btn.disabled = true;

      try {
        const body = new URLSearchParams({
          text: text,
          language: 'auto'
        });

        const res = await fetch('https://api.languagetoolplus.com/v2/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString()
        });
        
        const data = await res.json();
        
        statusDiv.textContent = '';
        btn.disabled = false;
        
        output.innerHTML = '';
        
        if (data.matches && data.matches.length > 0) {
          data.matches.forEach(match => {
            const errText = text.substring(match.offset, match.offset + match.length);
            const replacements = match.replacements.slice(0, 3).map(r => r.value);
            
            output.innerHTML += `
              <div style="background:var(--g50); padding:16px; border-radius:8px; border-left:4px solid #F44336;">
                <div style="font-weight:600; margin-bottom:4px;">${match.message}</div>
                <div style="color:var(--g500); font-size:0.9rem; margin-bottom:8px;">
                  Error: <span style="background:#ffcdd2; color:#b71c1c; padding:2px 4px; border-radius:4px;">${errText}</span>
                </div>
                ${replacements.length > 0 ? `
                  <div style="font-size:0.9rem;">
                    <span style="color:var(--g600);">Suggestions:</span> 
                    ${replacements.map(r => `<span style="background:#C8E6C9; color:#1B5E20; padding:2px 6px; border-radius:4px; font-weight:600; margin-left:4px;">${r}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
            `;
          });
        } else {
          output.innerHTML = '<div style="color:#4CAF50; font-weight:600; padding:16px; background:#E8F5E9; border-radius:8px;">No issues found! Your text looks great.</div>';
        }
        
        resultsDiv.style.display = 'block';
        
      } catch (e) {
        statusDiv.textContent = 'Error connecting to grammar service.';
        btn.disabled = false;
      }
    }

    btn.addEventListener('click', checkGrammar);
  },
  destroy() {}
};
