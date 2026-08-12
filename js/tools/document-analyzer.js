export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">Document Analyzer</h2>
        <p class="tool-desc">Analyze text files securely in your browser. No data leaves your device.</p>
        
        <div class="tool-section">
          <div id="doc-dropzone" style="border: 2px dashed var(--g300); border-radius: 8px; padding: 40px 20px; text-align: center; cursor: pointer; transition: all 0.2s; background: var(--g50);">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--g400)" stroke-width="2" style="margin-bottom:12px;">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            <div style="font-weight: 600; color: var(--black); margin-bottom: 4px;">Click or Drag & Drop a .txt or .md file here</div>
            <div style="font-size: 0.85rem; color: var(--g500);">Files are processed entirely on your device</div>
            <input type="file" id="doc-file-input" accept=".txt,.md,.csv,.json" style="display:none;">
          </div>
        </div>

        <div id="doc-results" style="display:none; margin-top:24px;">
          <h3 id="doc-filename" style="font-family:var(--pixel); font-size:1.25rem; margin-bottom:16px; word-break:break-all;"></h3>
          
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">
            <div class="tool-stat" style="background:var(--black); color:var(--white);">
              <div class="tool-stat-value" id="doc-words" style="font-family:var(--pixel); font-size:2.5rem;">0</div>
              <div class="tool-stat-label" style="color:var(--g400);">Total Words</div>
            </div>
            <div class="tool-stat">
              <div class="tool-stat-value" id="doc-time" style="font-family:var(--pixel); font-size:1.5rem;">0m</div>
              <div class="tool-stat-label">Reading Time (225 wpm)</div>
            </div>
          </div>
          
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">
            <div class="tool-stat" style="padding:16px;">
              <div class="tool-stat-label" style="margin-bottom:4px;">Characters</div>
              <div class="tool-stat-value" id="doc-chars" style="font-size:1.25rem;">0</div>
            </div>
            <div class="tool-stat" style="padding:16px;">
              <div class="tool-stat-label" style="margin-bottom:4px;">Paragraphs</div>
              <div class="tool-stat-value" id="doc-paragraphs" style="font-size:1.25rem;">0</div>
            </div>
          </div>

          <h4 style="font-family:var(--pixel); margin-bottom:12px; border-bottom:1px solid var(--g200); padding-bottom:4px;">Top Keywords (3+ letters)</h4>
          <div id="doc-keywords" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
        </div>
      </div>
    `;

    const dropzone = container.querySelector('#doc-dropzone');
    const fileInput = container.querySelector('#doc-file-input');
    const resultsDiv = container.querySelector('#doc-results');

    // Drag events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => {
      dropzone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); });
    });

    dropzone.addEventListener('dragover', () => dropzone.style.borderColor = 'var(--black)');
    dropzone.addEventListener('dragleave', () => dropzone.style.borderColor = 'var(--g300)');
    dropzone.addEventListener('drop', (e) => {
      dropzone.style.borderColor = 'var(--g300)';
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processFile(e.dataTransfer.files[0]);
      }
    });

    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) processFile(e.target.files[0]);
    });

    function processFile(file) {
      container.querySelector('#doc-filename').textContent = file.name;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        analyzeText(e.target.result);
      };
      reader.onerror = () => alert('Error reading file');
      reader.readAsText(file);
    }

    function analyzeText(text) {
      const wordsArray = text.toLowerCase().match(/[a-z0-9]+/g) || [];
      const wordCount = wordsArray.length;
      const charCount = text.length;
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
      
      container.querySelector('#doc-words').textContent = wordCount.toLocaleString();
      container.querySelector('#doc-chars').textContent = charCount.toLocaleString();
      container.querySelector('#doc-paragraphs').textContent = paragraphs.toLocaleString();
      
      const readingMinutes = Math.ceil(wordCount / 225);
      container.querySelector('#doc-time').textContent = readingMinutes < 1 ? '<1m' : `${readingMinutes}m`;

      // Keyword extraction (skip common stop words)
      const stopWords = new Set(['the','and','to','of','a','in','that','is','for','it','with','as','was','on','be','by','this','are','you','or','an','at','from','not','but','they','we','which','all','have']);
      const freqs = {};
      
      wordsArray.forEach(w => {
        if (w.length > 3 && !stopWords.has(w)) {
          freqs[w] = (freqs[w] || 0) + 1;
        }
      });

      const sortedKeywords = Object.entries(freqs).sort((a, b) => b[1] - a[1]).slice(0, 15);
      
      const kwDiv = container.querySelector('#doc-keywords');
      kwDiv.innerHTML = '';
      if (sortedKeywords.length === 0) {
        kwDiv.innerHTML = '<span style="color:var(--g400);">No significant keywords found.</span>';
      } else {
        sortedKeywords.forEach(([word, count]) => {
          const pill = document.createElement('div');
          pill.style.background = 'var(--g100)';
          pill.style.padding = '4px 10px';
          pill.style.borderRadius = '16px';
          pill.style.fontSize = '0.85rem';
          pill.style.fontWeight = '500';
          pill.innerHTML = `${word} <span style="color:var(--g500); margin-left:4px;">${count}</span>`;
          kwDiv.appendChild(pill);
        });
      }

      resultsDiv.style.display = 'block';
    }
  },
  destroy() {}
};
