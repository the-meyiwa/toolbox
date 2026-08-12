let worker = null;

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">Object Detection</h2>
        <p class="tool-desc">AI draws bounding boxes around objects in images. 100% offline (~25MB model).</p>
        
        <div class="tool-section">
          <div id="od-dropzone" style="border:2px dashed var(--g300); border-radius:8px; padding:40px 20px; text-align:center; cursor:pointer; background:var(--g50); margin-bottom:16px;">
            <div style="font-weight:600; margin-bottom:4px;">Click or Drag an Image</div>
            <div style="font-size:0.85rem; color:var(--g500);">JPEG, PNG, WebP</div>
            <input type="file" id="od-file" accept="image/*" style="display:none;">
          </div>

          <div style="text-align:center; margin-bottom:16px; position:relative; display:inline-block; max-width:100%;">
            <img id="od-preview" style="max-width:100%; display:none; border-radius:8px; border:1px solid var(--g200);">
            <div id="od-canvas-container" style="position:absolute; top:0; left:0; right:0; bottom:0; pointer-events:none;"></div>
          </div>
          
          <div style="display:flex; align-items:center; gap:16px;">
            <button class="btn btn-primary" id="od-btn" disabled>Detect Objects</button>
            <div id="od-status" style="color:var(--g500); font-size:0.9rem;"></div>
          </div>
          
          <div id="od-dl-container" style="display:none; margin-top:16px; width:100%; height:8px; background:var(--g100); border-radius:4px; overflow:hidden;">
            <div id="od-dl-bar" style="height:100%; width:0%; background:var(--black); transition:width 0.2s;"></div>
          </div>
        </div>

        <div id="od-results" style="display:none; margin-top:24px;">
          <h4 style="font-family:var(--pixel); margin-bottom:12px; border-bottom:1px solid var(--g200); padding-bottom:4px;">Detected Objects</h4>
          <div id="od-predictions" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
        </div>
      </div>
    `;

    const dropzone = container.querySelector('#od-dropzone');
    const fileInput = container.querySelector('#od-file');
    const preview = container.querySelector('#od-preview');
    const canvasCont = container.querySelector('#od-canvas-container');
    const btn = container.querySelector('#od-btn');
    const statusDiv = container.querySelector('#od-status');
    const dlContainer = container.querySelector('#od-dl-container');
    const dlBar = container.querySelector('#od-dl-bar');
    const resultsDiv = container.querySelector('#od-results');
    const predictionsDiv = container.querySelector('#od-predictions');

    let imageURL = null;
    let imgWidth = 0;
    let imgHeight = 0;

    if (!worker) {
      worker = new Worker(new URL('../ai-worker.js', import.meta.url), { type: 'module' });
    }

    const currentId = 'object-detect-' + Date.now();

    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => {
      if (e.target.files.length) loadImage(e.target.files[0]);
    });

    function loadImage(file) {
      if (imageURL) URL.revokeObjectURL(imageURL);
      imageURL = URL.createObjectURL(file);
      preview.src = imageURL;
      preview.onload = () => {
        imgWidth = preview.naturalWidth;
        imgHeight = preview.naturalHeight;
      };
      preview.style.display = 'block';
      canvasCont.innerHTML = '';
      btn.disabled = false;
      resultsDiv.style.display = 'none';
      dropzone.style.display = 'none';
    }

    worker.onmessage = (e) => {
      const { id, status, data, result, error } = e.data;
      if (id !== currentId) return;

      if (status === 'loading') {
        statusDiv.textContent = 'Loading Object Detection AI...';
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
        statusDiv.textContent = 'Scanning image...';
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
      canvasCont.innerHTML = '';
      predictionsDiv.innerHTML = '';
      
      if (!preds || !preds.length) {
        predictionsDiv.innerHTML = '<span style="color:var(--g400);">No objects detected.</span>';
        resultsDiv.style.display = 'block';
        return;
      }

      // Draw bounding boxes based on relative percentages
      preds.forEach((p, i) => {
        const color = `hsl(${(i * 137.508) % 360}, 70%, 50%)`;
        
        // p.box = {xmin, ymin, xmax, ymax}
        const box = document.createElement('div');
        box.style.position = 'absolute';
        box.style.border = `2px solid ${color}`;
        
        const wRatio = preview.clientWidth / imgWidth;
        const hRatio = preview.clientHeight / imgHeight;
        
        box.style.left = `${p.box.xmin * wRatio}px`;
        box.style.top = `${p.box.ymin * hRatio}px`;
        box.style.width = `${(p.box.xmax - p.box.xmin) * wRatio}px`;
        box.style.height = `${(p.box.ymax - p.box.ymin) * hRatio}px`;
        
        const label = document.createElement('div');
        label.style.position = 'absolute';
        label.style.top = '-20px';
        label.style.left = '-2px';
        label.style.background = color;
        label.style.color = '#fff';
        label.style.fontSize = '12px';
        label.style.padding = '2px 4px';
        label.style.whiteSpace = 'nowrap';
        label.style.fontWeight = 'bold';
        label.textContent = p.label;
        
        box.appendChild(label);
        canvasCont.appendChild(box);

        predictionsDiv.innerHTML += `
          <span style="background:${color}20; color:${color}; padding:4px 8px; border-radius:4px; font-weight:600; font-size:0.9rem;">
            ${p.label} (${(p.score * 100).toFixed(1)}%)
          </span>
        `;
      });
      
      resultsDiv.style.display = 'block';
    }

    btn.addEventListener('click', () => {
      if (!imageURL) return;
      resultsDiv.style.display = 'none';
      canvasCont.innerHTML = '';
      
      worker.postMessage({
        id: currentId,
        task: 'object-detection',
        model: 'Xenova/yolos-tiny',
        args: [imageURL]
      });
    });
  },
  destroy() {}
};
