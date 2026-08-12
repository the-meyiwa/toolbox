export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-content">
        <h2 class="tool-title" style="font-family:var(--pixel);">Meta Tag Generator</h2>
        <p class="tool-desc">Generate HTML meta tags for SEO and Social Media.</p>
        <div class="tool-section">
          <input type="text" id="mt-title" class="tool-input" placeholder="Page Title" style="margin-bottom:8px;">
          <input type="text" id="mt-desc" class="tool-input" placeholder="Page Description" style="margin-bottom:8px;">
          <input type="url" id="mt-img" class="tool-input" placeholder="Image URL (for Twitter/Facebook)">
          <pre id="mt-res" class="tool-output" style="margin-top:16px; font-size:0.85rem; min-height:150px;"></pre>
        </div>
      </div>
    `;
    const t = container.querySelector('#mt-title');
    const d = container.querySelector('#mt-desc');
    const i = container.querySelector('#mt-img');
    const res = container.querySelector('#mt-res');
    
    const update = () => {
      const tv = t.value || 'Title';
      const dv = d.value || 'Description';
      const iv = i.value || 'https://example.com/img.jpg';
      res.textContent = `<!-- Primary Meta Tags -->
<title>${tv}</title>
<meta name="title" content="${tv}" />
<meta name="description" content="${dv}" />

<!-- Open Graph / Facebook -->
<meta property="og:type" content="website" />
<meta property="og:title" content="${tv}" />
<meta property="og:description" content="${dv}" />
<meta property="og:image" content="${iv}" />

<!-- Twitter -->
<meta property="twitter:card" content="summary_large_image" />
<meta property="twitter:title" content="${tv}" />
<meta property="twitter:description" content="${dv}" />
<meta property="twitter:image" content="${iv}" />`;
    };
    [t, d, i].forEach(el => el.addEventListener('input', update));
    update();
  },
  destroy() {}
};