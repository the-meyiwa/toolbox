import { copyText } from '../utils.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-section">
        <label class="tool-label">Text to Slugify</label>
        <input type="text" class="tool-input" id="slug-input" placeholder="e.g. My Awesome Blog Post!">
      </div>
      <div class="tool-section">
        <label class="tool-label">Slug</label>
        <div class="tool-output" id="slug-output" style="min-height:50px; display:flex; align-items:center;">
          <button class="copy-btn" id="slug-copy">Copy</button>
          <span id="slug-result" style="font-size:1.1rem; color:var(--g500);"></span>
        </div>
      </div>
    `;

    const input = container.querySelector('#slug-input');
    const result = container.querySelector('#slug-result');

    function generateSlug() {
      const text = input.value;
      const slug = text
        .toLowerCase()
        .trim()
        .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
        .replace(/[^\w\-]+/g, '') // Remove all non-word characters
        .replace(/\-\-+/g, '-')   // Replace multiple hyphens with a single one
        .replace(/^-+/, '')       // Trim hyphens from start
        .replace(/-+$/, '');      // Trim hyphens from end
      
      result.textContent = slug;
      result.style.color = slug ? 'var(--black)' : 'var(--g500)';
    }

    input.addEventListener('input', generateSlug);

    container.querySelector('#slug-copy').addEventListener('click', (e) => {
      if (result.textContent) copyText(result.textContent, e.currentTarget);
    });
    
    input.focus();
  },
  destroy() {}
};
