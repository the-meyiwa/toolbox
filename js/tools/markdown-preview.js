import { marked } from 'marked';

// Configure marked
marked.setOptions({ breaks: true, gfm: true });

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-split">
        <div class="tool-section">
          <label class="tool-label">Markdown</label>
          <textarea class="tool-textarea" id="md-input" placeholder="# Hello World\n\nStart writing markdown..." style="min-height:400px; font-size:0.82rem;"></textarea>
        </div>
        <div class="tool-section">
          <label class="tool-label">Preview</label>
          <div class="markdown-body" id="md-preview" style="min-height:400px;"></div>
        </div>
      </div>
    `;

    const input   = container.querySelector('#md-input');
    const preview = container.querySelector('#md-preview');

    function update() {
      try {
        preview.innerHTML = marked.parse(input.value || '');
      } catch {
        preview.innerHTML = '<p style="color:var(--g400);">Error parsing markdown</p>';
      }
    }

    input.addEventListener('input', update);

    // Start with example content
    input.value = `# Markdown Preview

Write **markdown** on the left, see it rendered on the right.

## Features

- GitHub Flavored Markdown
- Tables, code blocks, blockquotes
- Live preview as you type

## Code Example

\`\`\`javascript
function hello() {
  console.log("Hello, world!");
}
\`\`\`

> "Simplicity is the ultimate sophistication." — Leonardo da Vinci

| Feature | Status |
|---------|--------|
| Bold    | ✓      |
| Italic  | ✓      |
| Links   | ✓      |`;

    update();
    input.focus();
    input.setSelectionRange(0, 0);
  },

  destroy() {}
};
