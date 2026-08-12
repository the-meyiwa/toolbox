import { copyText } from '../utils.js';

function generateUUID() {
  // crypto.randomUUID is available in secure contexts
  if (crypto.randomUUID) return crypto.randomUUID();
  // Fallback v4 UUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 0x0f);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default {
  render(container) {
    container.innerHTML = `
      <div class="tool-controls">
        <button class="btn btn-primary btn-sm" id="uuid-gen">Generate</button>
        <div class="tool-row" style="margin-left:8px;">
          <label class="tool-label" style="margin:0;">Count</label>
          <input type="number" class="tool-input" id="uuid-count" value="5" min="1" max="100" style="width:70px; height:28px; text-align:center; font-size:0.78rem;">
        </div>
        <button class="btn btn-secondary btn-sm" id="uuid-copy-all" style="margin-left:auto;">Copy All</button>
      </div>
      <div class="tool-section">
        <ul class="output-list" id="uuid-list"></ul>
      </div>
    `;

    const list = container.querySelector('#uuid-list');

    function generate() {
      const count = Math.max(1, Math.min(100, parseInt(container.querySelector('#uuid-count').value) || 5));
      const uuids = Array.from({ length: count }, generateUUID);

      list.innerHTML = uuids.map(uuid => `
        <li class="output-list-item">
          <span>${uuid}</span>
          <button class="copy-btn" data-uuid="${uuid}">Copy</button>
        </li>
      `).join('');
    }

    container.querySelector('#uuid-gen').addEventListener('click', generate);

    // Individual copy
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('.copy-btn[data-uuid]');
      if (btn) copyText(btn.dataset.uuid, btn);
    });

    // Copy all
    container.querySelector('#uuid-copy-all').addEventListener('click', (e) => {
      const uuids = Array.from(list.querySelectorAll('[data-uuid]'))
        .map(btn => btn.dataset.uuid);
      if (uuids.length) copyText(uuids.join('\n'), e.currentTarget);
    });

    // Generate initial batch
    generate();
  },

  destroy() {}
};
