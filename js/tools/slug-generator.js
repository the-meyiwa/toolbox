import { copyText } from '../utils.js';

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-section">
        <label class="tool-label">Text to slugify</label>
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
        .normalize('NFD')          // split accented letters into letter + accent
        .replace(/\p{M}/gu, '')    // drop the accent, so "café" becomes "cafe"
        .toLowerCase()
        .trim()
        .replace(/[\s_]+/g, '-')   // spaces and underscores become hyphens
        .replace(/[^a-z0-9-]+/g, '') // anything else is not URL-safe
        .replace(/-{2,}/g, '-')    // collapse runs of hyphens
        .replace(/^-+|-+$/g, '');  // and trim them off both ends
      
      result.textContent = slug;
      result.style.color = slug ? 'var(--black)' : 'var(--g500)';
    }

    input.addEventListener('input', generateSlug);

    container.querySelector('#slug-copy').addEventListener('click', (e) => {
      if (result.textContent) copyText(result.textContent, e.currentTarget);
    });
    
    input.focus();

    this._read = () => result.textContent;
    this._write = (text) => { input.value = text.split('\n')[0].slice(0, 200); generateSlug(); };
  },

  getArtifact() { return { kind: 'text', text: this._read?.() ?? '' }; },
  /* A slug is one line, so a multi-line artifact contributes its first. */
  setArtifact(a) { this._write?.(a.text); },

  destroy() { this._read = this._write = null; }
};
