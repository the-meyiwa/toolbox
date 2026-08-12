let worker = null;

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">Semantic Similarity</h2>
        <p class="tool-desc">In-browser NLP measures how conceptually similar two texts are, regardless of exact wording. Offline model (~22MB).</p>
        
        <div class="tool-section">
          <div style="display:flex; flex-direction:column; gap:16px;">
            <div>
              <label class="tool-label">Text 1</label>
              <textarea class="tool-input" id="sem-text1" rows="3" placeholder="e.g. The quick brown fox jumps over the lazy dog" style="font-size:1.05rem;"></textarea>
            </div>
            <div>
              <label class="tool-label">Text 2</label>
              <textarea class="tool-input" id="sem-text2" rows="3" placeholder="e.g. A fast dark-colored vulpine leaps across a resting canine" style="font-size:1.05rem;"></textarea>
            </div>
          </div>
          
          <div style="margin-top:20px; display:flex; align-items:center; gap:16px;">
            <button class="btn btn-primary" id="sem-btn">Compare Meaning</button>
            <div id="sem-status" style="color:var(--g500); font-size:0.9rem;"></div>
          </div>
          
          <div id="sem-dl-container" style="display:none; margin-top:16px; width:100%; height:8px; background:var(--g100); border-radius:4px; overflow:hidden;">
            <div id="sem-dl-bar" style="height:100%; width:0%; background:var(--black); transition:width 0.2s;"></div>
          </div>
        </div>

        <div id="sem-results" style="display:none; margin-top:24px; padding:32px; border-radius:8px; border:2px solid var(--black); text-align:center;">
          <div style="color:var(--g500); font-size:1rem; margin-bottom:12px; text-transform:uppercase; letter-spacing:1px; font-weight:600;">Similarity Score</div>
          <div id="sem-score" style="font-family:var(--pixel); font-size:4rem; margin-bottom:8px; color:var(--black);"></div>
          <div id="sem-meaning" style="color:var(--g600); font-size:1.15rem; font-style:italic;"></div>
        </div>
      </div>
    `;

    const input1 = container.querySelector('#sem-text1');
    const input2 = container.querySelector('#sem-text2');
    const btn = container.querySelector('#sem-btn');
    const statusDiv = container.querySelector('#sem-status');
    const dlContainer = container.querySelector('#sem-dl-container');
    const dlBar = container.querySelector('#sem-dl-bar');
    const resultsDiv = container.querySelector('#sem-results');
    const scoreEl = container.querySelector('#sem-score');
    const meaningEl = container.querySelector('#sem-meaning');

    if (!worker) {
      worker = new Worker(new URL('../ai-worker.js', import.meta.url), { type: 'module' });
    }

    const currentId = 'semantic-' + Date.now();
    let vec1 = null;
    let vec2 = null;

    // Helper: Cosine similarity
    function cosineSimilarity(v1, v2) {
      let dot = 0, n1 = 0, n2 = 0;
      for (let i = 0; i < v1.length; i++) {
        dot += v1[i] * v2[i];
        n1 += v1[i] * v1[i];
        n2 += v2[i] * v2[i];
      }
      return dot / (Math.sqrt(n1) * Math.sqrt(n2));
    }

    worker.onmessage = (e) => {
      const { id, status, data, result, error } = e.data;
      
      if (status === 'loading') {
        statusDiv.textContent = 'Loading NLP Model...';
        dlContainer.style.display = 'block';
        btn.disabled = true;
      } else if (status === 'progress') {
        if (data && data.progress) {
          dlBar.style.width = `${data.progress}%`;
          statusDiv.textContent = `Downloading AI (${Math.round(data.progress)}%)`;
        }
      } else if (status === 'inferring') {
        dlContainer.style.display = 'none';
        statusDiv.textContent = 'Extracting features...';
      } else if (status === 'complete') {
        // Result is an embedding tensor
        if (id === currentId + '-1') vec1 = Array.from(result.data);
        if (id === currentId + '-2') vec2 = Array.from(result.data);
        
        if (vec1 && vec2) {
          statusDiv.textContent = '';
          btn.disabled = false;
          
          const sim = Math.max(0, cosineSimilarity(vec1, vec2));
          const pct = Math.round(sim * 100);
          
          scoreEl.textContent = `${pct}%`;
          
          if (pct > 85) meaningEl.textContent = "Basically identical meaning!";
          else if (pct > 65) meaningEl.textContent = "Very similar context.";
          else if (pct > 40) meaningEl.textContent = "Somewhat related topics.";
          else meaningEl.textContent = "Completely unrelated.";
          
          resultsDiv.style.display = 'block';
        }
      } else if (status === 'error') {
        statusDiv.textContent = 'Error: ' + error;
        dlContainer.style.display = 'none';
        btn.disabled = false;
      }
    };

    btn.addEventListener('click', () => {
      const t1 = input1.value.trim();
      const t2 = input2.value.trim();
      if (!t1 || !t2) return;
      
      resultsDiv.style.display = 'none';
      vec1 = null;
      vec2 = null;
      
      worker.postMessage({
        id: currentId + '-1',
        task: 'feature-extraction',
        model: 'Xenova/all-MiniLM-L6-v2',
        args: [t1, { pooling: 'mean', normalize: true }]
      });
      
      worker.postMessage({
        id: currentId + '-2',
        task: 'feature-extraction',
        model: 'Xenova/all-MiniLM-L6-v2',
        args: [t2, { pooling: 'mean', normalize: true }]
      });
    });
  },
  destroy() {}
};
