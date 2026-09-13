import re
import os

app_js_path = r'c:\Users\meyig\Documents\Projects\toolbox-ola\js\app.js'
style_css_path = r'c:\Users\meyig\Documents\Projects\toolbox-ola\css\style.css'
index_html_path = r'c:\Users\meyig\Documents\Projects\toolbox-ola\index.html'

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

# 1. Update index.html for Split Viewport and Scroll Story
html = read_file(index_html_path)

viewport_html = """      <!-- TOOL VIEWPORT -->
      <div id="tool-viewport" class="page-view hidden">
        <div id="workspace-container">
          <!-- Pane 1 -->
          <div class="workspace-pane active-pane" id="pane-0">
            <div class="pane-header">
              <div class="pane-header-left">
                <button class="pane-action-btn back-btn" aria-label="Back to all tools">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                </button>
                <div class="pane-heading">
                  <h2 class="pane-title"></h2>
                  <p class="pane-desc"></p>
                </div>
              </div>
              <div class="pane-header-actions">
                <button class="pane-action-btn split-btn" title="Split Workspace">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="3" x2="12" y2="21"></line></svg>
                </button>
                <button class="pane-action-btn maximize-btn" title="Focus/Maximize">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
                </button>
              </div>
            </div>
            <div class="pane-content"></div>
            <aside class="pane-related" hidden></aside>
          </div>

          <div class="workspace-divider" id="workspace-divider" hidden></div>

          <!-- Pane 2 -->
          <div class="workspace-pane" id="pane-1" hidden>
            <div class="pane-header">
              <div class="pane-header-left">
                <button class="pane-action-btn back-btn" aria-label="Replace Tool">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </button>
                <div class="pane-heading">
                  <h2 class="pane-title">Choose Tool</h2>
                  <p class="pane-desc">Search or select to open</p>
                </div>
              </div>
              <div class="pane-header-actions">
                <button class="pane-action-btn maximize-btn" title="Focus/Maximize">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
                </button>
                <button class="pane-action-btn close-pane-btn" title="Close Pane">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            </div>
            <div class="pane-content">
              <!-- Picker rendered here -->
              <div class="pane-picker" id="pane-picker" style="display:none; padding:20px;">
                <input type="text" class="pane-picker-search tool-input" placeholder="Search tools..." style="margin-bottom:16px;">
                <div class="pane-picker-grid" style="display:grid; gap:10px;"></div>
              </div>
            </div>
            <aside class="pane-related" hidden></aside>
          </div>
        </div>
      </div>"""

if 'id="workspace-container"' not in html:
    html = re.sub(r'<!-- TOOL VIEWPORT -->\s*<div id="tool-viewport" class="page-view hidden">.*?</div>\s*<aside class="tool-related" id="tool-related" hidden></aside>\s*</div>', viewport_html, html, flags=re.DOTALL)
    write_file(index_html_path, html)

# 2. Add Scroll Story CSS & Split Workspace CSS
css = read_file(style_css_path)

if 'workspace-container' not in css:
    css_additions = """
/* ============================================================
   SPLIT WORKSPACE
   ============================================================ */
#workspace-container {
  display: flex;
  flex-direction: row;
  width: 100%;
  height: calc(100vh - var(--header-h));
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.workspace-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 300px;
  background: var(--white);
  position: relative;
  transition: flex 0.3s ease;
  overflow-y: auto;
}

.workspace-pane[hidden] {
  display: none !important;
}

.workspace-pane.active-pane {
  /* optional: indicator for active pane */
}

.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-card);
  position: sticky;
  top: 0;
  z-index: 10;
}

.pane-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.pane-heading .pane-title {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0;
}
.pane-heading .pane-desc {
  font-size: 0.75rem;
  color: var(--g500);
  margin: 0;
}

.pane-action-btn {
  background: none;
  border: 1px solid transparent;
  color: var(--g600);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, color 0.2s;
}
.pane-action-btn:hover {
  background: var(--bg-hover);
  color: var(--black);
}
.pane-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.workspace-divider {
  width: 6px;
  background: var(--border-subtle);
  cursor: col-resize;
  z-index: 20;
  transition: background 0.2s;
}
.workspace-divider:hover, .workspace-divider.dragging {
  background: var(--accent);
}

@media (max-width: 768px) {
  #workspace-container {
    flex-direction: column;
  }
  .workspace-divider {
    width: 100%;
    height: 6px;
    cursor: row-resize;
  }
}

/* ============================================================
   ABOUT NARRATIVE
   ============================================================ */
.about-story-container {
  position: relative;
}
.about-scene {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: sticky;
  top: 0;
  overflow: hidden;
  opacity: 0;
  transform: translateY(50px) scale(0.95);
  transition: opacity 0.8s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.about-scene.is-visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}
.about-scene.is-passed {
  opacity: 0;
  transform: translateY(-50px) scale(1.05);
}
.about-content {
  max-width: 600px;
  padding: 40px;
  text-align: center;
}
"""
    css += css_additions
    write_file(style_css_path, css)

# 3. We will modify app.js for split view and scroll story.
# To keep it simple, we will replace the `openTool` logic and add the scroll observer.
app_js = read_file(app_js_path)

if 'initScrollNarrative' not in app_js:
    app_js += """

// =========================================================
// SCROLL NARRATIVE
// =========================================================
function initScrollNarrative() {
  const scenes = document.querySelectorAll('.about-scene');
  if (!scenes.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        entry.target.classList.remove('is-passed');
      } else {
        if (entry.boundingClientRect.top < 0) {
          entry.target.classList.add('is-passed');
        }
        entry.target.classList.remove('is-visible');
      }
    });
  }, { threshold: 0.3 });

  scenes.forEach(scene => observer.observe(scene));
}
window.addEventListener('hashchange', () => {
  if (window.location.hash === '#about' || window.location.hash === '#support') {
    setTimeout(initScrollNarrative, 100);
  }
});
"""

# Implement basic split screen in app.js
# We need to hook into openTool.
# This requires replacing `teardownTool` and `openTool`.

split_logic = """
// =========================================================
// SPLIT WORKSPACE LOGIC
// =========================================================
let workspace = {
  split: false,
  activePane: 0,
  panes: [
    { id: 0, toolId: null, instance: null, obj: null, session: null },
    { id: 1, toolId: null, instance: null, obj: null, session: null }
  ]
};

function initWorkspaceUI() {
  const splitBtn = document.querySelector('#pane-0 .split-btn');
  const divider = document.getElementById('workspace-divider');
  const pane1 = document.getElementById('pane-1');
  const pane0 = document.getElementById('pane-0');
  
  if (splitBtn) {
    splitBtn.addEventListener('click', () => {
      workspace.split = !workspace.split;
      pane1.hidden = !workspace.split;
      divider.hidden = !workspace.split;
      if (workspace.split) {
        workspace.activePane = 1;
        renderPicker(1);
      } else {
        workspace.activePane = 0;
        if (workspace.panes[1].instance) {
          try { workspace.panes[1].instance.destroy?.(); } catch(e){}
        }
      }
    });
  }
  
  // Draggable divider
  if (divider) {
    let isDragging = false;
    divider.addEventListener('mousedown', () => isDragging = true);
    window.addEventListener('mouseup', () => {
      isDragging = false;
      divider.classList.remove('dragging');
    });
    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      divider.classList.add('dragging');
      const container = document.getElementById('workspace-container');
      if (window.innerWidth > 768) {
        const percent = (e.clientX / container.offsetWidth) * 100;
        pane0.style.flex = `0 0 ${percent}%`;
        pane1.style.flex = '1';
      } else {
        const percent = (e.clientY / container.offsetHeight) * 100;
        pane0.style.flex = `0 0 ${percent}%`;
        pane1.style.flex = '1';
      }
    });
  }

  // Pane activation
  document.querySelectorAll('.workspace-pane').forEach((el, idx) => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.workspace-pane').forEach(p => p.classList.remove('active-pane'));
      el.classList.add('active-pane');
      workspace.activePane = idx;
    });
  });
  
  // Close pane
  const closeBtn = document.querySelector('#pane-1 .close-pane-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      workspace.split = false;
      pane1.hidden = true;
      divider.hidden = true;
      workspace.activePane = 0;
    });
  }
}

function renderPicker(paneIdx) {
  const paneEl = document.getElementById(`pane-${paneIdx}`);
  const content = paneEl.querySelector('.pane-content');
  content.innerHTML = `
    <div style="padding:20px;">
      <h3 style="margin-bottom: 16px;">Select Tool</h3>
      <div class="category-tools">
        ${getVisibleTools().slice(0, 10).map(t => `<div class="tool-card pane-tool" data-id="${t.id}">${t.icon} <span style="margin-left:8px;">${t.name}</span></div>`).join('')}
      </div>
    </div>
  `;
  content.querySelectorAll('.pane-tool').forEach(btn => {
    btn.addEventListener('click', () => {
      openToolInPane(btn.dataset.id, paneIdx);
    });
  });
}

async function openToolInPane(id, paneIdx) {
  const tool = BY_ID.get(id);
  if (!tool) return;
  
  const paneEl = document.getElementById(`pane-${paneIdx}`);
  paneEl.querySelector('.pane-title').textContent = tool.name;
  paneEl.querySelector('.pane-desc').textContent = tool.description;
  
  const content = paneEl.querySelector('.pane-content');
  content.innerHTML = '';
  
  try {
    const loader = toolModules[`./tools/${id}.js`];
    const module = await loader();
    const instance = module.default;
    await instance.render(content, { tool });
    workspace.panes[paneIdx].toolId = id;
    workspace.panes[paneIdx].instance = instance;
    workspace.panes[paneIdx].obj = tool;
  } catch (e) {
    content.innerHTML = `Error: ${e.message}`;
  }
}

// Override original openTool completely if not already modified
"""

if 'initWorkspaceUI' not in app_js:
    # We will inject initWorkspaceUI() near the bottom
    app_js = app_js.replace("window.addEventListener('hashchange', handleHash);", "window.addEventListener('hashchange', handleHash);\ninitWorkspaceUI();\n")
    app_js += split_logic
    
    # We also need to hack `openTool` so it uses the active pane.
    app_js = re.sub(
        r'async function openTool\(id\)\s*{',
        r'async function openTool(id) { if (typeof openToolInPane === "function" && document.getElementById("workspace-container")) { showPage("tool"); return openToolInPane(id, workspace.activePane); }',
        app_js
    )
    
    write_file(app_js_path, app_js)

print("Patched all files successfully.")
