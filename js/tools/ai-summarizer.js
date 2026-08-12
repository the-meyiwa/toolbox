export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">Text Summarizer</h2>
        <p class="tool-desc">Extractive AI algorithm summarizes long articles into key points offline.</p>
        
        <div class="tool-section">
          <textarea class="tool-input" id="sum-input" rows="8" placeholder="Paste a long article or document here (at least 5 sentences)..." style="font-size:1.05rem; line-height:1.6; margin-bottom:12px;"></textarea>
          
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <label class="tool-label" style="margin:0;">Sentences to extract:</label>
              <input type="number" id="sum-count" class="tool-input" value="3" min="1" max="20" style="width:70px; padding:4px 8px;">
            </div>
            
            <div style="display:flex; align-items:center; gap:16px;">
              <button class="btn btn-primary" id="sum-btn">Summarize</button>
              <div id="sum-status" style="color:var(--g500); font-size:0.9rem;"></div>
            </div>
          </div>
        </div>

        <div id="sum-results" style="display:none; margin-top:24px;">
          <h4 style="font-family:var(--pixel); margin-bottom:12px; border-bottom:1px solid var(--g200); padding-bottom:4px;">Summary</h4>
          <div id="sum-output" style="background:var(--g50); padding:24px; border-radius:8px; border-left:4px solid var(--black); font-size:1.15rem; line-height:1.7; color:var(--g800);"></div>
        </div>
      </div>
    `;

    const input = container.querySelector('#sum-input');
    const countInput = container.querySelector('#sum-count');
    const btn = container.querySelector('#sum-btn');
    const statusDiv = container.querySelector('#sum-status');
    const resultsDiv = container.querySelector('#sum-results');
    const output = container.querySelector('#sum-output');

    function summarize() {
      const text = input.value.trim();
      const numSentences = parseInt(countInput.value) || 3;
      
      if (!text) return;
      
      statusDiv.textContent = 'Analyzing text...';
      resultsDiv.style.display = 'none';

      setTimeout(() => {
        try {
          // 1. Split into sentences (basic regex)
          const sentences = text.match(/[^.!?]+[.!?]+/g);
          if (!sentences || sentences.length <= numSentences) {
            output.textContent = "Text is too short to summarize (or lacks punctuation). Please provide a longer text.";
            resultsDiv.style.display = 'block';
            statusDiv.textContent = '';
            return;
          }

          // 2. Tokenize and calculate word frequencies (excluding stop words)
          const stopWords = new Set(['the','is','in','at','of','on','and','a','to','it','for','with','as','was','by','this','that','are','from','but','not','they','you','or','an','we']);
          const wordFreq = {};
          
          const words = text.toLowerCase().match(/[a-z]+/g) || [];
          let maxFreq = 0;
          
          words.forEach(w => {
            if (!stopWords.has(w) && w.length > 2) {
              wordFreq[w] = (wordFreq[w] || 0) + 1;
              if (wordFreq[w] > maxFreq) maxFreq = wordFreq[w];
            }
          });

          // Normalize frequencies
          for (const w in wordFreq) {
            wordFreq[w] = wordFreq[w] / maxFreq;
          }

          // 3. Score sentences based on word frequencies
          const scoredSentences = sentences.map((sentence, index) => {
            const sWords = sentence.toLowerCase().match(/[a-z]+/g) || [];
            let score = 0;
            sWords.forEach(w => {
              if (wordFreq[w]) score += wordFreq[w];
            });
            // Normalize score by sentence length to prevent long-sentence bias
            score = sWords.length > 0 ? score / sWords.length : 0;
            
            // Boost first sentences slightly (positional heuristic)
            if (index < 3) score *= 1.2;
            
            return { text: sentence.trim(), score, index };
          });

          // 4. Sort by score, pick top N, then sort back by original order
          const topSentences = scoredSentences
            .sort((a, b) => b.score - a.score)
            .slice(0, numSentences)
            .sort((a, b) => a.index - b.index)
            .map(s => s.text);

          output.innerHTML = topSentences.map(s => `<p style="margin-bottom:8px;">${s}</p>`).join('');
          resultsDiv.style.display = 'block';
          statusDiv.textContent = '';
          
        } catch (e) {
          statusDiv.textContent = 'Error summarizing text.';
        }
      }, 100);
    }

    btn.addEventListener('click', summarize);
  },
  destroy() {}
};
