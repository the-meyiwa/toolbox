export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">Random Advice</h2>
        <p class="tool-desc">Get a random piece of advice (via Advice Slip API).</p>
        <div class="tool-section" style="text-align:center; padding:40px 20px;">
          <div id="ad-text" style="font-size:1.5rem; font-weight:600; font-family:var(--pixel); color:var(--black); margin-bottom:24px; line-height:1.4;">"Click below for advice."</div>
          <button id="ad-btn" class="btn btn-primary">Get Advice</button>
        </div>
      </div>
    `;
    const btn = container.querySelector('#ad-btn');
    const txt = container.querySelector('#ad-text');
    
    btn.addEventListener('click', async () => {
      txt.textContent = 'Thinking...';
      try {
        const req = await fetch('https://api.adviceslip.com/advice?t=' + Date.now());
        const data = await req.json();
        txt.textContent = `"${data.slip.advice}"`;
      } catch(e) {
        txt.textContent = 'Error fetching advice. Try again.';
      }
    });
  },
  destroy() {}
};