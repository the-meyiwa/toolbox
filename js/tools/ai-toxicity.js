let worker = null;

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">Toxicity Filter</h2>
        <p class="tool-desc">AI analyzes text for toxic, hateful, or insulting content. Runs 100% offline (~45MB model).</p>
        
        <div class="tool-section">
          <textarea class="tool-input" id="tox-input" rows="4" placeholder="Type or paste a comment/text here..." style="font-size:1.1rem; line-height:1.5;"></textarea>
          <div style="margin-top:12px; display:flex; align-items:center; gap:16px;">
            <button class="btn btn-primary" id="tox-btn">Analyze Toxicity</button>
            <div id="tox-status" style="color:var(--g500); font-size:0.9rem;"></div>
          </div>
          
          <div id="tox-dl-container" style="display:none; margin-top:16px; width:100%; height:8px; background:var(--g100); border-radius:4px; overflow:hidden;">
            <div id="tox-dl-bar" style="height:100%; width:0%; background:var(--black); transition:width 0.2s;"></div>
          </div>
        </div>

        <div id="tox-results" style="display:none; margin-top:24px; padding:24px; border-radius:8px; border:2px solid var(--black);">
          <div id="tox-summary" style="font-family:var(--pixel); font-size:2rem; margin-bottom:16px; text-transform:uppercase;"></div>
          <div id="tox-bars" style="display:flex; flex-direction:column; gap:12px;"></div>
        </div>
      </div>
    `;

    const input = container.querySelector('#tox-input');
    const btn = container.querySelector('#tox-btn');
    const statusDiv = container.querySelector('#tox-status');
    const resultsDiv = container.querySelector('#tox-results');
    const dlContainer = container.querySelector('#tox-dl-container');
    const dlBar = container.querySelector('#tox-dl-bar');
    
    const summaryEl = container.querySelector('#tox-summary');
    const barsEl = container.querySelector('#tox-bars');

    if (!worker) {
      worker = new Worker(new URL('../ai-worker.js', import.meta.url), { type: 'module' });
    }

    const currentId = 'toxicity-' + Date.now();

    worker.onmessage = (e) => {
      const { id, status, data, result, error } = e.data;
      if (id !== currentId) return;

      if (status === 'loading') {
        statusDiv.textContent = 'Loading Toxicity Model...';
        dlContainer.style.display = 'block';
        btn.disabled = true;
      } else if (status === 'progress') {
        if (data && data.progress) {
          dlBar.style.width = `${data.progress}%`;
          statusDiv.textContent = `Downloading AI (${Math.round(data.progress)}%)`;
        }
      } else if (status === 'inferring') {
        dlContainer.style.display = 'none';
        statusDiv.textContent = 'Analyzing...';
      } else if (status === 'complete') {
        statusDiv.textContent = '';
        btn.disabled = false;
        
        if (result && result.length > 0) {
          // The toxic-bert model returns probabilities for 6 labels
          // toxic, severe_toxic, obscene, threat, insult, identity_hate
          // However, pipeline top_k=6 is needed, but by default it might return just top 1.
          // Wait, Xenova/toxic-bert text-classification without top_k returns the highest.
          // Let's just pass top_k=6 to get all scores.
          
          const isToxic = result.some(r => r.score > 0.5 && r.label !== 'non-toxic');
          
          summaryEl.textContent = isToxic ? 'Warning: Toxic Content Detected' : 'Content looks Safe';
          summaryEl.style.color = isToxic ? '#F44336' : '#4CAF50';
          resultsDiv.style.borderColor = isToxic ? '#F44336' : '#4CAF50';
          
          barsEl.innerHTML = '';
          result.forEach(pred => {
            const conf = (pred.score * 100).toFixed(1);
            const barWidth = Math.max(0, pred.score * 100);
            const color = pred.score > 0.5 && pred.label !== 'non-toxic' ? '#F44336' : 'var(--g300)';
            
            barsEl.innerHTML += `
              <div>
                <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.9rem;">
                  <span style="font-weight:600; text-transform:capitalize;">${pred.label.replace('_', ' ')}</span>
                  <span>${conf}%</span>
                </div>
                <div style="height:8px; width:100%; background:var(--g100); border-radius:4px; overflow:hidden;">
                  <div style="height:100%; width:${barWidth}%; background:${color};"></div>
                </div>
              </div>
            `;
          });
          
          resultsDiv.style.display = 'block';
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
      
      resultsDiv.style.display = 'none';
      worker.postMessage({
        id: currentId,
        task: 'text-classification',
        model: 'Xenova/toxic-bert',
        args: [text, { topk: null }] // get all labels
      });
    });
  },
  destroy() {}
};
