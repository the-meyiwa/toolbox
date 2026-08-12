let worker = null;

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">AI Auto-Complete</h2>
        <p class="tool-desc">Type a sentence with [MASK] and the AI will predict the missing word! Runs offline (~45MB).</p>
        
        <div class="tool-section">
          <textarea class="tool-input" id="mask-input" rows="3" placeholder="e.g. The quick brown [MASK] jumps over the lazy dog." style="font-size:1.1rem; line-height:1.5;"></textarea>
          
          <div style="margin-top:12px; display:flex; align-items:center; gap:16px;">
            <button class="btn btn-primary" id="mask-btn">Predict [MASK]</button>
            <div id="mask-status" style="color:var(--g500); font-size:0.9rem;"></div>
          </div>
          
          <!-- Progress Bar -->
          <div id="mask-dl-container" style="display:none; margin-top:16px; width:100%; height:8px; background:var(--g100); border-radius:4px; overflow:hidden;">
            <div id="mask-dl-bar" style="height:100%; width:0%; background:var(--black); transition:width 0.2s;"></div>
          </div>
        </div>

        <div id="mask-results" style="display:none; margin-top:24px;">
          <h4 style="font-family:var(--pixel); margin-bottom:12px; border-bottom:1px solid var(--g200); padding-bottom:4px;">Top Predictions</h4>
          <div id="mask-predictions" style="display:flex; flex-direction:column; gap:8px;"></div>
        </div>
      </div>
    `;

    const input = container.querySelector('#mask-input');
    const btn = container.querySelector('#mask-btn');
    const statusDiv = container.querySelector('#mask-status');
    const resultsDiv = container.querySelector('#mask-results');
    const predictionsDiv = container.querySelector('#mask-predictions');
    const dlContainer = container.querySelector('#mask-dl-container');
    const dlBar = container.querySelector('#mask-dl-bar');

    if (!worker) {
      worker = new Worker(new URL('../ai-worker.js', import.meta.url), { type: 'module' });
    }

    const currentId = 'mask-' + Date.now();

    worker.onmessage = (e) => {
      const { id, status, data, result, error } = e.data;
      if (id !== currentId) return;

      if (status === 'loading') {
        statusDiv.textContent = 'Loading Language Model...';
        dlContainer.style.display = 'block';
        btn.disabled = true;
      } else if (status === 'progress') {
        if (data && typeof data.progress === 'number') {
          dlBar.style.width = `${data.progress}%`;
          statusDiv.textContent = `Downloading ${data.file || 'Model'} (${Math.round(data.progress)}%)`;
        } else if (data && data.status === 'initiate') {
          statusDiv.textContent = `Initiating download: ${data.file || 'Model'}`;
        }
      } else if (status === 'inferring') {
        dlContainer.style.display = 'none';
        statusDiv.textContent = 'Thinking...';
      } else if (status === 'complete') {
        statusDiv.textContent = '';
        btn.disabled = false;
        
        if (result && result.length > 0) {
          predictionsDiv.innerHTML = '';
          // result is an array of objects like { score: 0.9, token_str: "fox", sequence: "..." }
          // Xenova/albert-base-v2 returns top 5
          const preds = Array.isArray(result) ? result : [result];
          
          preds.forEach(pred => {
            const conf = (pred.score * 100).toFixed(1);
            const barWidth = Math.max(0, pred.score * 100);
            
            predictionsDiv.innerHTML += `
              <div style="background:var(--g50); padding:12px; border-radius:4px; position:relative; overflow:hidden; border-left:4px solid var(--black);">
                <div style="position:absolute; left:0; top:0; bottom:0; width:${barWidth}%; background:var(--g150); z-index:0;"></div>
                <div style="position:relative; z-index:1; display:flex; flex-direction:column; gap:4px;">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:700; font-size:1.2rem; color:var(--black);">${pred.token_str}</span>
                    <span style="color:var(--g600); font-size:0.9rem;">${conf}% confidence</span>
                  </div>
                  <div style="color:var(--g500); font-size:0.9rem; font-style:italic;">"${pred.sequence}"</div>
                </div>
              </div>
            `;
          });
          
          resultsDiv.style.display = 'block';
        } else {
          statusDiv.textContent = 'No predictions found.';
        }
      } else if (status === 'error') {
        statusDiv.textContent = 'Error: ' + error;
        dlContainer.style.display = 'none';
        btn.disabled = false;
      }
    };

    btn.addEventListener('click', () => {
      const text = input.value.trim();
      if (!text) return;
      
      if (!text.includes('[MASK]')) {
        statusDiv.textContent = 'Please include [MASK] in your sentence!';
        return;
      }
      
      resultsDiv.style.display = 'none';
      worker.postMessage({
        id: currentId,
        task: 'fill-mask',
        model: 'Xenova/albert-base-v2',
        args: [text]
      });
    });
  },
  destroy() {}
};
