import { copyText } from '../utils.js';

const CASES = [
  { label: 'UPPER',    fn: s => s.toUpperCase() },
  { label: 'lower',    fn: s => s.toLowerCase() },
  { label: 'Title',    fn: s => s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) },
  { label: 'Sentence', fn: s => {
    return s.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, m => m.toUpperCase());
  }},
  { label: 'camelCase', fn: s => {
    return s.replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
            .replace(/^[A-Z]/, c => c.toLowerCase())
            .replace(/[^a-zA-Z0-9]/g, '');
  }},
  { label: 'snake_case', fn: s => {
    return s.replace(/([a-z])([A-Z])/g, '$1_$2')
            .replace(/[\s\-]+/g, '_')
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
  }},
  { label: 'kebab-case', fn: s => {
    return s.replace(/([a-z])([A-Z])/g, '$1-$2')
            .replace(/[\s_]+/g, '-')
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
  }},
];

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-section">
        <label class="tool-label">Input</label>
        <textarea class="tool-textarea" id="cc-input" placeholder="Enter text to convert…" rows="6"></textarea>
      </div>
      <div class="tool-controls" id="cc-buttons">
        ${CASES.map((c, i) => `<button class="btn btn-secondary btn-sm" data-idx="${i}">${c.label}</button>`).join('')}
      </div>
      <div class="tool-section">
        <label class="tool-label">Output</label>
        <div class="tool-output" id="cc-output" style="min-height:100px;">
          <button class="copy-btn" id="cc-copy">Copy</button>
          <span id="cc-result"></span>
        </div>
      </div>
    `;

    const input  = container.querySelector('#cc-input');
    const result = container.querySelector('#cc-result');
    const output = container.querySelector('#cc-output');
    let activeIdx = null;

    function convert(idx) {
      activeIdx = idx;
      const text = input.value;
      result.textContent = text ? CASES[idx].fn(text) : '';

      // Update active button
      container.querySelectorAll('#cc-buttons .btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === idx);
      });
    }

    container.querySelector('#cc-buttons').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-idx]');
      if (btn) convert(Number(btn.dataset.idx));
    });

    input.addEventListener('input', () => {
      if (activeIdx !== null) convert(activeIdx);
    });

    container.querySelector('#cc-copy').addEventListener('click', (e) => {
      if (result.textContent) copyText(result.textContent, e.currentTarget);
    });

    input.focus();
  },

  destroy() {}
};
