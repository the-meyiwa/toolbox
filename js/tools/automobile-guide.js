import { autoClient } from '../lib/automotive-data.js';

export default {
  render(container) {
    this.container = container;
    this.state = {
      vehicles: [],
      selectedVehicle: null,
      selectedSection: null,
      selectedComponent: null,
      diagramSvg: null,
      viewMode: 'Chassis',
      zoom: 1,
      panX: 0,
      panY: 0,
      isPanning: false,
      startX: 0,
      startY: 0
    };

    container.innerHTML = `
      <style>
        .auto-guide { display: flex; flex-direction: column; height: 100%; font-family: var(--font-sans); color: var(--text); background: var(--bg); overflow: hidden; }
        .ag-header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid var(--border); background: var(--bg-card); flex-shrink: 0; }
        .ag-title { margin: 0; font-size: 1.1rem; font-weight: 700; }
        .ag-search { flex: 1; max-width: 400px; margin: 0 16px; }
        .ag-body { display: flex; flex: 1; overflow: hidden; position: relative; }
        
        /* Desktop layout */
        @media (min-width: 768px) {
          .ag-sidebar { width: 300px; border-right: 1px solid var(--border); background: var(--bg-card); display: flex; flex-direction: column; overflow-y: auto; flex-shrink: 0; }
          .ag-main { flex: 1; display: flex; flex-direction: column; position: relative; }
          .ag-bottom-sheet { display: none; }
        }
        
        /* Mobile layout */
        @media (max-width: 767px) {
          .ag-body { flex-direction: column; }
          .ag-sidebar { display: none; } /* Sidebar integrated into bottom sheet on mobile */
          .ag-main { flex: 1; display: flex; flex-direction: column; position: relative; }
          .ag-bottom-sheet { position: absolute; bottom: 0; left: 0; right: 0; background: var(--bg-card); border-top: 1px solid var(--border); border-radius: 16px 16px 0 0; padding: 16px; z-index: 100; box-shadow: 0 -4px 16px rgba(0,0,0,0.1); max-height: 50vh; overflow-y: auto; transition: transform 0.3s ease; }
          .ag-bottom-sheet.hidden { transform: translateY(100%); }
        }

        .ag-search-results { position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-height: 300px; overflow-y: auto; z-index: 50; display: none; }
        .ag-search-item { padding: 10px 16px; cursor: pointer; border-bottom: 1px solid var(--border); }
        .ag-search-item:hover, .ag-search-item:focus { background: var(--bg-subtle); outline: none; }
        
        .ag-canvas-container { flex: 1; overflow: hidden; position: relative; background: var(--bg-subtle); cursor: grab; display: flex; align-items: center; justify-content: center; touch-action: none; }
        .ag-canvas-container:active { cursor: grabbing; }
        .ag-svg-wrap { transform-origin: center center; transition: transform 0.1s ease-out; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
        
        .ag-toolbar { position: absolute; top: 16px; right: 16px; display: flex; flex-direction: column; gap: 8px; z-index: 10; }
        .ag-toolbar-btn { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text); box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
        .ag-toolbar-btn:hover { background: var(--bg-subtle); }
        
        .ag-view-modes { position: absolute; top: 16px; left: 16px; display: flex; gap: 4px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 4px; z-index: 10; }
        .ag-mode-btn { background: transparent; border: none; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600; color: var(--text-muted); }
        .ag-mode-btn.active { background: var(--bg-subtle); color: var(--text); }
        
        .ag-section-nav { display: flex; overflow-x: auto; padding: 12px 16px; gap: 8px; background: var(--bg-card); border-bottom: 1px solid var(--border); scrollbar-width: none; }
        .ag-section-pill { background: var(--bg-subtle); border: 1px solid var(--border); padding: 6px 12px; border-radius: 999px; font-size: 0.8rem; white-space: nowrap; cursor: pointer; color: var(--text); }
        .ag-section-pill.active { background: var(--text); color: var(--bg); border-color: var(--text); }
        
        .ag-info-panel { padding: 20px; }
        .ag-info-title { margin: 0 0 10px 0; font-size: 1.2rem; font-weight: 700; }
        .ag-info-meta { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 20px; display: flex; flex-direction: column; gap: 6px; }
        
        .ag-component-card { background: var(--bg-subtle); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-top: 16px; }
        .ag-component-card h4 { margin: 0 0 8px 0; font-size: 1rem; color: var(--accent); }
        .ag-component-card p { margin: 0; font-size: 0.85rem; line-height: 1.4; }
        
        .auto-component circle { transition: all 0.2s ease; }
        .auto-component:hover circle:last-child { stroke-width: 1.5; opacity: 1; }
        .auto-component.selected circle:first-child { fill: #ef4444; }
        .auto-component.selected circle:last-child { stroke: #ef4444; stroke-width: 2; opacity: 1; }
      </style>
      <div class="auto-guide">
        <div class="ag-header">
          <h2 class="ag-title">Automobile Guide</h2>
          <div class="ag-search" style="position: relative;">
            <input type="text" id="ag-search-input" class="tool-input" placeholder="Search vehicles (e.g., Toyota Corolla)..." style="width: 100%;">
            <div id="ag-search-results" class="ag-search-results"></div>
          </div>
        </div>
        <div class="ag-body">
          <div class="ag-sidebar" id="ag-sidebar">
            <div class="ag-info-panel" id="ag-desktop-info">
              <div style="text-align: center; color: var(--text-muted); margin-top: 40px; font-size: 0.9rem;">
                Search and select a vehicle to begin.
              </div>
            </div>
          </div>
          <div class="ag-main">
            <div class="ag-section-nav" id="ag-section-nav" style="display: none;"></div>
            <div class="ag-view-modes" id="ag-view-modes" style="display: none;">
              <button class="ag-mode-btn" data-mode="Exterior">Exterior</button>
              <button class="ag-mode-btn active" data-mode="Chassis">Chassis</button>
              <button class="ag-mode-btn" data-mode="Interior">Interior</button>
            </div>
            <div class="ag-toolbar" id="ag-toolbar" style="display: none;">
              <button class="ag-toolbar-btn" id="ag-zoom-in" aria-label="Zoom in"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
              <button class="ag-toolbar-btn" id="ag-zoom-out" aria-label="Zoom out"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
              <button class="ag-toolbar-btn" id="ag-zoom-reset" aria-label="Reset view"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg></button>
            </div>
            <div class="ag-canvas-container" id="ag-canvas-container">
              <div class="ag-svg-wrap" id="ag-svg-wrap"></div>
            </div>
          </div>
          <div class="ag-bottom-sheet hidden" id="ag-mobile-sheet">
            <div id="ag-mobile-info"></div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
    this.loadInitialData();
  },

  async loadInitialData() {
    this.state.vehicles = await autoClient.searchVehicles('');
    
    // Render popular vehicles if no vehicle is selected
    if (!this.state.selectedVehicle) {
      const infoPanel = this.container.querySelector('#ag-desktop-info');
      if (infoPanel) {
        infoPanel.innerHTML = \`
          <div style="color: var(--text-muted); margin-bottom: 16px; font-weight: 600;">Popular Models</div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            \${this.state.vehicles.slice(0, 10).map(v => \`
              <div class="ag-search-item" data-id="\${v.id}" style="border: 1px solid var(--border); border-radius: 8px; padding: 12px;">
                <div style="font-weight: 600; color: var(--text);">\${v.manufacturer} \${v.model}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">\${v.generation} (\${v.years})</div>
              </div>
            \`).join('')}
          </div>
        \`;
      }
    }
  },

  bindEvents() {
    const searchInput = this.container.querySelector('#ag-search-input');
    const searchResults = this.container.querySelector('#ag-search-results');
    
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const query = e.target.value.trim();
        if (!query) {
          searchResults.style.display = 'none';
          return;
        }
        const results = await autoClient.searchVehicles(query);
        this.state.vehicles = results; // Cache the search results
        
        if (results.length > 0) {
          searchResults.innerHTML = results.map(v => `
            <div class="ag-search-item" data-id="${v.id}">
              <div style="font-weight: 600;">${v.manufacturer} ${v.model}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${v.generation} (${v.years})</div>
            </div>
          `).join('');
          searchResults.style.display = 'block';
        } else {
          searchResults.innerHTML = '<div style="padding: 10px 16px; color: var(--text-muted);">No vehicles found.</div>';
          searchResults.style.display = 'block';
        }
      }, 300);
    });

    this.container.addEventListener('click', (e) => {
      const item = e.target.closest('.ag-search-item');
      if (item) {
        const id = item.getAttribute('data-id');
        this.selectVehicle(id);
        searchResults.style.display = 'none';
        searchInput.value = '';
      }
    });

    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.style.display = 'none';
      }
    });

    // View Modes
    this.container.querySelector('#ag-view-modes').addEventListener('click', (e) => {
      if (e.target.classList.contains('ag-mode-btn')) {
        this.container.querySelectorAll('.ag-mode-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.state.viewMode = e.target.getAttribute('data-mode');
        // In a real app, this would toggle different SVG layers or 3D models
      }
    });

    // Section Nav
    this.container.querySelector('#ag-section-nav').addEventListener('click', (e) => {
      if (e.target.classList.contains('ag-section-pill')) {
        const section = e.target.getAttribute('data-section');
        this.selectSection(section);
      }
    });

    // Zoom Controls
    this.container.querySelector('#ag-zoom-in').addEventListener('click', () => this.updateZoom(0.2));
    this.container.querySelector('#ag-zoom-out').addEventListener('click', () => this.updateZoom(-0.2));
    this.container.querySelector('#ag-zoom-reset').addEventListener('click', () => this.resetView());

    // Pan Canvas
    const canvas = this.container.querySelector('#ag-canvas-container');
    canvas.addEventListener('mousedown', (e) => {
      this.state.isPanning = true;
      this.state.startX = e.clientX - this.state.panX;
      this.state.startY = e.clientY - this.state.panY;
    });
    
    window.addEventListener('mousemove', (e) => {
      if (!this.state.isPanning) return;
      this.state.panX = e.clientX - this.state.startX;
      this.state.panY = e.clientY - this.state.startY;
      this.applyTransform();
    });
    
    window.addEventListener('mouseup', () => {
      this.state.isPanning = false;
    });

    // Touch support for pan
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.state.isPanning = true;
        this.state.startX = e.touches[0].clientX - this.state.panX;
        this.state.startY = e.touches[0].clientY - this.state.panY;
      }
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
      if (!this.state.isPanning || e.touches.length !== 1) return;
      this.state.panX = e.touches[0].clientX - this.state.startX;
      this.state.panY = e.touches[0].clientY - this.state.startY;
      this.applyTransform();
    }, { passive: true });

    canvas.addEventListener('touchend', () => {
      this.state.isPanning = false;
    });

    // Diagram Component Click
    this.container.querySelector('#ag-svg-wrap').addEventListener('click', (e) => {
      const comp = e.target.closest('.auto-component');
      if (comp) {
        const compId = comp.getAttribute('data-comp-id');
        this.selectComponent(compId);
      } else {
        // Clicked background
        this.clearComponentSelection();
      }
    });
    
    // Keyboard accessibility for components
    this.container.querySelector('#ag-svg-wrap').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const comp = e.target.closest('.auto-component');
        if (comp) {
          e.preventDefault();
          this.selectComponent(comp.getAttribute('data-comp-id'));
        }
      }
    });
  },

  async selectVehicle(id) {
    this.container.querySelector('#ag-svg-wrap').innerHTML = '<div style="color:var(--text-muted);">Loading vehicle diagram...</div>';
    
    const vehicle = this.state.vehicles.find(v => v.id === id);
    if (!vehicle) return;
    
    this.state.selectedVehicle = vehicle;
    this.state.selectedSection = null;
    this.state.selectedComponent = null;
    
    const svg = await autoClient.getVehicleDiagram(id, '2D');
    this.state.diagramSvg = svg;
    
    this.renderVehicleUI();
    this.resetView();
  },

  selectSection(section) {
    this.state.selectedSection = section;
    this.container.querySelectorAll('.ag-section-pill').forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-section') === section);
    });
    
    // Auto-select first component in section if none selected
    if (this.state.selectedVehicle) {
      const comp = this.state.selectedVehicle.components.find(c => c.section === section);
      if (comp) this.selectComponent(comp.id);
    }
  },

  selectComponent(compId) {
    this.state.selectedComponent = compId;
    
    const wrap = this.container.querySelector('#ag-svg-wrap');
    wrap.querySelectorAll('.auto-component').forEach(c => {
      c.classList.toggle('selected', c.getAttribute('data-comp-id') === compId);
    });

    this.renderInfoPanel();
    
    // Context to Assistant
    this.updateAssistantContext();
  },
  
  clearComponentSelection() {
    this.state.selectedComponent = null;
    const wrap = this.container.querySelector('#ag-svg-wrap');
    wrap.querySelectorAll('.auto-component').forEach(c => c.classList.remove('selected'));
    this.renderInfoPanel();
    this.updateAssistantContext();
  },

  updateZoom(delta) {
    this.state.zoom = Math.max(0.5, Math.min(3, this.state.zoom + delta));
    this.applyTransform();
  },

  resetView() {
    this.state.zoom = 1;
    this.state.panX = 0;
    this.state.panY = 0;
    this.applyTransform();
  },

  applyTransform() {
    const wrap = this.container.querySelector('#ag-svg-wrap');
    if (wrap) {
      wrap.style.transform = `translate(${this.state.panX}px, ${this.state.panY}px) scale(${this.state.zoom})`;
    }
  },

  renderVehicleUI() {
    const { selectedVehicle, diagramSvg } = this.state;
    if (!selectedVehicle) return;

    this.container.querySelector('#ag-toolbar').style.display = 'flex';
    this.container.querySelector('#ag-view-modes').style.display = 'flex';
    
    const nav = this.container.querySelector('#ag-section-nav');
    nav.style.display = 'flex';
    nav.innerHTML = selectedVehicle.sections.map(s => `
      <button class="ag-section-pill" data-section="${s}">${s}</button>
    `).join('');

    const wrap = this.container.querySelector('#ag-svg-wrap');
    wrap.innerHTML = diagramSvg || '<div style="color:var(--text-muted);">Diagram unavailable.</div>';
    
    this.renderInfoPanel();
  },

  renderInfoPanel() {
    const { selectedVehicle, selectedComponent } = this.state;
    if (!selectedVehicle) return;

    let compHtml = '';
    if (selectedComponent) {
      const comp = selectedVehicle.components.find(c => c.id === selectedComponent);
      if (comp) {
        compHtml = `
          <div class="ag-component-card">
            <h4>${comp.name}</h4>
            <p>${comp.description}</p>
            <div style="margin-top: 8px; font-size: 0.75rem; color: var(--text-muted);">Location: ${comp.section}</div>
          </div>
        `;
      }
    } else {
      compHtml = '<div style="margin-top: 16px; font-size: 0.85rem; color: var(--text-muted); font-style: italic;">Select a component on the diagram to view details.</div>';
    }

    const html = `
      <div class="ag-info-panel">
        <h3 class="ag-info-title">${selectedVehicle.manufacturer} ${selectedVehicle.model}</h3>
        <div class="ag-info-meta">
          <span><strong>Gen:</strong> ${selectedVehicle.generation}</span>
          <span><strong>Years:</strong> ${selectedVehicle.years}</span>
          <span><strong>Body:</strong> ${selectedVehicle.bodyStyle}</span>
          <span><strong>Drivetrain:</strong> ${selectedVehicle.drivetrain}</span>
          <span><strong>Engine:</strong> ${selectedVehicle.engine}</span>
        </div>
        ${compHtml}
      </div>
    `;

    this.container.querySelector('#ag-desktop-info').innerHTML = html;
    this.container.querySelector('#ag-mobile-info').innerHTML = html;
    
    const sheet = this.container.querySelector('#ag-mobile-sheet');
    if (selectedComponent) {
      sheet.classList.remove('hidden');
    } else {
      // Auto-hide sheet if mobile and no component selected, to prioritize diagram
      if (window.innerWidth < 768) sheet.classList.add('hidden');
    }
  },

  updateAssistantContext() {
    if (window.ToolboxAssistant) {
      const { selectedVehicle, selectedComponent } = this.state;
      let contextStr = '';
      if (selectedVehicle) {
        contextStr += `Vehicle: ${selectedVehicle.manufacturer} ${selectedVehicle.model} (${selectedVehicle.generation}, ${selectedVehicle.years}). `;
        if (selectedComponent) {
          const comp = selectedVehicle.components.find(c => c.id === selectedComponent);
          if (comp) {
            contextStr += `Selected Component: ${comp.name} in ${comp.section}. ${comp.description}`;
          }
        }
      }
      // Update global context for Assistant (hypothetical architecture)
      window.__toolbox_active_context = contextStr;
    }
  },

  getContextMenu() {
    return [
      { label: 'Reset View', action: () => this.resetView() },
      { label: 'Clear Selection', action: () => this.clearComponentSelection() }
    ];
  }
};
