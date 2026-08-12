let worker = null;

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">Sentiment Analyzer</h2>
        <p class="tool-desc">In-browser AI classifies text as Positive or Negative. Runs 100% offline after the initial model download (~60MB).</p>
        
        <div class="tool-section">
          <textarea class="tool-input" id="sentiment-input" rows="4" placeholder="Type or paste some text here..." style="font-size:1.1rem; line-height:1.5;"></textarea>
          <div style="margin-top:12px; display:flex; align-items:center; gap:16px;">
            <button class="btn btn-primary" id="sentiment-btn">Analyze Sentiment</button>
            <div id="sentiment-status" style="color:var(--g500); font-size:0.9rem;"></div>
          </div>
          
          <!-- Progress Bar -->
          <div id="dl-progress-container" style="display:none; margin-top:16px; width:100%; height:8px; background:var(--g100); border-radius:4px; overflow:hidden;">
            <div id="dl-progress-bar" style="height:100%; width:0%; background:var(--black); transition:width 0.2s;"></div>
          </div>
        </div>

        <div id="sentiment-results" style="display:none; margin-top:24px; text-align:center; background:var(--black); color:var(--white); padding:32px; border-radius:8px;">
          <div id="sentiment-label" style="font-family:var(--pixel); font-size:3rem; margin-bottom:8px; text-transform:uppercase;"></div>
          <div style="color:var(--g400); font-size:1.1rem;">Confidence: <span id="sentiment-score" style="color:var(--white); font-weight:600;"></span>%</div>
        </div>
      </div>
    `;

    const input = container.querySelector('#sentiment-input');
    const btn = container.querySelector('#sentiment-btn');
    const statusDiv = container.querySelector('#sentiment-status');
    const resultsDiv = container.querySelector('#sentiment-results');
    const dlContainer = container.querySelector('#dl-progress-container');
    const dlBar = container.querySelector('#dl-progress-bar');
    
    const labelEl = container.querySelector('#sentiment-label');
    const scoreEl = container.querySelector('#sentiment-score');

    if (!worker) {
      worker = new Worker(new URL('../ai-worker.js', import.meta.url), { type: 'module' });
    }

    const currentId = 'sentiment-' + Date.now();

    worker.onmessage = (e) => {
      const { id, status, data, result, error } = e.data;
      if (id !== currentId) return;

      if (status === 'loading') {
        statusDiv.textContent = 'Loading AI Model...';
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
        statusDiv.textContent = 'Analyzing...';
      } else if (status === 'complete') {
        statusDiv.textContent = '';
        btn.disabled = false;
        
        if (result && result.length > 0) {
          const pred = result[0];
          labelEl.textContent = pred.label;
          labelEl.style.color = pred.label === 'POSITIVE' ? '#4CAF50' : (pred.label === 'NEGATIVE' ? '#F44336' : 'var(--white)');
          scoreEl.textContent = (pred.score * 100).toFixed(1);
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
        model: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
        args: [text]
      });
    });
  },
  destroy() {}
};
