let worker = null;

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">Image Classifier</h2>
        <p class="tool-desc">Local Vision AI identifies objects in your images. 100% offline (~97MB model).</p>
        
        <div class="tool-section">
          <div id="ic-dropzone" style="border:2px dashed var(--g300); border-radius:8px; padding:40px 20px; text-align:center; cursor:pointer; background:var(--g50); margin-bottom:16px;">
            <div style="font-weight:600; margin-bottom:4px;">Click or Drag an Image</div>
            <div style="font-size:0.85rem; color:var(--g500);">JPEG, PNG, WebP</div>
            <input type="file" id="ic-file" accept="image/*" style="display:none;">
          </div>

          <div style="text-align:center; margin-bottom:16px;">
            <img id="ic-preview" style="max-width:100%; max-height:300px; display:none; border-radius:8px; border:1px solid var(--g200);">
          </div>
          
          <div style="display:flex; align-items:center; gap:16px;">
            <button class="btn btn-primary" id="ic-btn" disabled>Classify Image</button>
            <div id="ic-status" style="color:var(--g500); font-size:0.9rem;"></div>
          </div>
          
          <div id="ic-dl-container" style="display:none; margin-top:16px; width:100%; height:8px; background:var(--g100); border-radius:4px; overflow:hidden;">
            <div id="ic-dl-bar" style="height:100%; width:0%; background:var(--black); transition:width 0.2s;"></div>
          </div>
        </div>

        <div id="ic-results" style="display:none; margin-top:24px;">
          <h4 style="font-family:var(--pixel); margin-bottom:12px; border-bottom:1px solid var(--g200); padding-bottom:4px;">AI Predictions</h4>
          <div id="ic-predictions" style="display:flex; flex-direction:column; gap:8px;"></div>
        </div>
      </div>
    `;

    const dropzone = container.querySelector('#ic-dropzone');
    const fileInput = container.querySelector('#ic-file');
    const preview = container.querySelector('#ic-preview');
    const btn = container.querySelector('#ic-btn');
    const statusDiv = container.querySelector('#ic-status');
    const dlContainer = container.querySelector('#ic-dl-container');
    const dlBar = container.querySelector('#ic-dl-bar');
    const resultsDiv = container.querySelector('#ic-results');
    const predictionsDiv = container.querySelector('#ic-predictions');

    let imageURL = null;

    if (!worker) {
      worker = new Worker(new URL('../ai-worker.js', import.meta.url), { type: 'module' });
    }

    const currentId = 'image-classifier-' + Date.now();

    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => {
      if (e.target.files.length) loadImage(e.target.files[0]);
    });

    function loadImage(file) {
      if (imageURL) URL.revokeObjectURL(imageURL);
      imageURL = URL.createObjectURL(file);
      preview.src = imageURL;
      preview.style.display = 'inline-block';
      btn.disabled = false;
      resultsDiv.style.display = 'none';
      dropzone.style.display = 'none';
    }

    worker.onmessage = (e) => {
      const { id, status, data, result, error } = e.data;
      if (id !== currentId) return;

      if (status === 'loading') {
        statusDiv.textContent = 'Loading Vision AI...';
        dlContainer.style.display = 'block';
        btn.disabled = true;
      } else if (status === 'progress') {
        if (data && data.progress) {
          dlBar.style.width = `${data.progress}%`;
          statusDiv.textContent = `Downloading Model (${Math.round(data.progress)}%)`;
        }
      } else if (status === 'inferring') {
        dlContainer.style.display = 'none';
        statusDiv.textContent = 'Analyzing image...';
      } else if (status === 'complete') {
        statusDiv.textContent = '';
        btn.disabled = false;
        renderResults(result);
      } else if (status === 'error') {
        statusDiv.textContent = 'Error: ' + error;
        dlContainer.style.display = 'none';
        btn.disabled = false;
      }
    };

    function renderResults(preds) {
      predictionsDiv.innerHTML = '';
      if (!preds || !preds.length) {
        predictionsDiv.innerHTML = 'No predictions found.';
      } else {
        preds.forEach(p => {
          const conf = (p.score * 100).toFixed(1);
          const barWidth = Math.max(0, p.score * 100);
          predictionsDiv.innerHTML += `
            <div style="background:var(--g50); padding:12px; border-radius:4px; position:relative; overflow:hidden;">
              <div style="position:absolute; left:0; top:0; bottom:0; width:${barWidth}%; background:var(--g150); z-index:0;"></div>
              <div style="position:relative; z-index:1; display:flex; justify-content:space-between;">
                <span style="font-weight:600; text-transform:capitalize;">${p.label}</span>
                <span style="color:var(--g600);">${conf}%</span>
              </div>
            </div>
          `;
        });
      }
      resultsDiv.style.display = 'block';
    }

    btn.addEventListener('click', () => {
      if (!imageURL) return;
      resultsDiv.style.display = 'none';
      worker.postMessage({
        id: currentId,
        task: 'image-classification',
        model: 'Xenova/resnet-50',
        args: [imageURL]
      });
    });
  },
  destroy() {}
};
