import { BY_ID } from '../registry/index.js';

let isSplit = false;
let rightInstance = null;

export function initWorkspace(openToolCallback) {
  const splitBtn = document.getElementById('split-btn');
  const closeSplitBtn = document.getElementById('close-split-btn');
  const container = document.getElementById('workspace-container');
  const divider = document.getElementById('workspace-divider');
  
  if (!splitBtn || !closeSplitBtn || !container) return;

  splitBtn.addEventListener('click', () => {
    isSplit = true;
    container.classList.remove('workspace-single');
    container.classList.add('workspace-split');
    document.getElementById('workspace-divider').classList.remove('hidden');
    document.getElementById('pane-right').classList.remove('hidden');
    renderRightPicker();
  });

  closeSplitBtn.addEventListener('click', () => {
    isSplit = false;
    container.classList.remove('workspace-split');
    container.classList.add('workspace-single');
    document.getElementById('workspace-divider').classList.add('hidden');
    document.getElementById('pane-right').classList.add('hidden');
    
    // Reset sizes
    document.getElementById('pane-left').style.width = '';
    document.getElementById('pane-right').style.width = '';
    
    if (rightInstance && typeof rightInstance.destroy === 'function') {
      rightInstance.destroy();
    }
    rightInstance = null;
    document.getElementById('pane-right-content').innerHTML = `
       <div id="pane-right-picker" style="padding:20px; text-align:center;">
          <h3 style="margin-bottom:10px;">Open in right pane</h3>
          <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom: 20px;">Pick a tool or file to open here.</p>
          <div id="pane-right-grid" class="dynamic-tile-grid"></div>
       </div>
    `;
    document.getElementById('pane-right-title').textContent = 'Select a tool';
  });

  // Draggable divider
  let isDragging = false;
  divider.addEventListener('mousedown', (e) => {
    isDragging = true;
    document.body.style.cursor = 'col-resize';
  });
  divider.addEventListener('touchstart', (e) => {
    isDragging = true;
  }, {passive: true});
  
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    updateDivider(e.clientX, e.clientY);
  });
  window.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    updateDivider(e.touches[0].clientX, e.touches[0].clientY);
  }, {passive: true});
  
  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = '';
    }
  });
  window.addEventListener('touchend', () => {
    isDragging = false;
  });

  function updateDivider(x, y) {
    const rect = container.getBoundingClientRect();
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
      const topHeight = y - rect.top;
      const percentage = (topHeight / rect.height) * 100;
      if (percentage > 20 && percentage < 80) {
        document.getElementById('pane-left').style.height = percentage + '%';
        document.getElementById('pane-right').style.height = (100 - percentage) + '%';
        document.getElementById('pane-left').style.width = '100%';
        document.getElementById('pane-right').style.width = '100%';
      }
    } else {
      const leftWidth = x - rect.left;
      const percentage = (leftWidth / rect.width) * 100;
      if (percentage > 20 && percentage < 80) {
        document.getElementById('pane-left').style.width = percentage + '%';
        document.getElementById('pane-right').style.width = (100 - percentage) + '%';
        document.getElementById('pane-left').style.height = '100%';
        document.getElementById('pane-right').style.height = '100%';
      }
    }
  }
}

function renderRightPicker() {
  const grid = document.getElementById('pane-right-grid');
  if (!grid) return;
  // Render tools
  const tools = Array.from(BY_ID.values()).filter(t => !t.unlisted && t.id !== 'assistant').slice(0, 16);
  grid.innerHTML = tools.map(t => `
    <div class="tool-card pane-picker-card" data-id="${t.id}" style="padding: 12px; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; text-align: left; background: var(--bg-card);">
       <div style="font-size:1.5rem; margin-bottom: 8px;">${t.icon}</div>
       <div style="font-weight:700; font-size: 0.9rem;">${t.name}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.pane-picker-card').forEach(card => {
    card.addEventListener('click', async () => {
      const id = card.dataset.id;
      const tool = BY_ID.get(id);
      document.getElementById('pane-right-title').textContent = tool.name;
      
      const content = document.getElementById('pane-right-content');
      
      // Swap container to clear listeners
      const freshContent = document.createElement('div');
      freshContent.id = 'pane-right-content';
      freshContent.className = 'pane-content';
      content.replaceWith(freshContent);
      
      try {
        const mod = await import(`../tools/${id}.js`);
        rightInstance = mod.default;
        await rightInstance.render(freshContent, { analytics: null, tool, artifact: null });
      } catch (e) {
        freshContent.innerHTML = '<p style="padding:20px; text-align:center;">Error loading tool</p>';
      }
    });
  });
}
