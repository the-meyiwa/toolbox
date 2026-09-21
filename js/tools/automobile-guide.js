/** Automobile Guide: reference data, semantic inspector and technical 3D viewport. */

import { autoClient } from '../lib/automotive-data.js';
import { AutomobileViewer } from '../lib/automobile/automobile-viewer.js';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export default {
  render(container) {
    this.destroy();
    this.container = container;
    this.state = {
      vehicles: [],
      selectedVehicle: null,
      selectedSection: null,
      selectedComponent: null,
      viewMode: 'technical',
      activeMobileTab: 'diag' // 'diag' | 'specs' | 'inspector'
    };

    container.innerHTML = `
      <style>
        .ag-root {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
          color: var(--text, #e2e8f0);
          background: var(--bg, #0f172a);
          overflow: hidden;
          box-sizing: border-box;
        }

        /* Top Command Bar */
        .ag-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 18px;
          border-bottom: 1px solid var(--border, #1e293b);
          background: var(--bg-card, #1e293b);
          gap: 16px;
          flex-shrink: 0;
          z-index: 20;
        }
        .ag-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .ag-header-title {
          font-size: 1.05rem;
          font-weight: 700;
          margin: 0;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--text, #f8fafc);
        }
        .ag-header-center {
          flex: 1;
          max-width: 480px;
          position: relative;
        }
        .ag-search-box {
          position: relative;
          width: 100%;
        }
        .ag-search-input {
          width: 100%;
          padding: 7px 12px 7px 34px;
          background: var(--bg, #0f172a);
          border: 1px solid var(--border, #334155);
          border-radius: 8px;
          color: var(--text, #f8fafc);
          font-size: 0.85rem;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s ease;
        }
        .ag-search-input:focus {
          border-color: var(--accent, #3b82f6);
        }
        .ag-search-icon {
          position: absolute;
          left: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted, #94a3b8);
          pointer-events: none;
        }
        .ag-search-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          right: 0;
          background: var(--bg-card, #1e293b);
          border: 1px solid var(--border, #334155);
          border-radius: 10px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
          max-height: 380px;
          overflow-y: auto;
          z-index: 100;
          display: none;
        }
        .ag-search-item {
          padding: 10px 14px;
          cursor: pointer;
          border-bottom: 1px solid var(--border, #334155);
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: background 0.15s ease;
        }
        .ag-search-item:last-child {
          border-bottom: none;
        }
        .ag-search-item:hover, .ag-search-item.is-selected {
          background: var(--bg-subtle, #334155);
        }
        .ag-search-item-title {
          font-weight: 600;
          font-size: 0.88rem;
          color: var(--text, #f8fafc);
        }
        .ag-search-item-meta {
          font-size: 0.75rem;
          color: var(--text-muted, #94a3b8);
        }
        .ag-search-badge {
          font-size: 0.7rem;
          padding: 2px 7px;
          border-radius: 999px;
          background: rgba(59, 130, 246, 0.15);
          color: var(--accent, #60a5fa);
          font-weight: 600;
        }

        .ag-header-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .ag-view-pills {
          display: flex;
          background: var(--bg, #0f172a);
          border: 1px solid var(--border, #334155);
          border-radius: 8px;
          padding: 3px;
          gap: 2px;
        }
        .ag-view-btn {
          background: transparent;
          border: none;
          padding: 5px 12px;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text-muted, #94a3b8);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .ag-view-btn.active {
          background: var(--accent, #3b82f6);
          color: #ffffff;
        }

        /* 3-Column Desktop Workspace */
        .ag-workspace {
          display: flex;
          flex: 1;
          min-height: 0;
          overflow: hidden;
          position: relative;
        }

        /* Left Panel: Specs & Section Navigation */
        .ag-col-left {
          width: 310px;
          background: var(--bg-card, #1e293b);
          border-right: 1px solid var(--border, #334155);
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          flex-shrink: 0;
          z-index: 10;
        }
        .ag-panel-section {
          padding: 16px;
          border-bottom: 1px solid var(--border, #334155);
        }
        .ag-panel-title {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted, #94a3b8);
          margin: 0 0 10px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .ag-car-hero {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .ag-car-name {
          font-size: 1.15rem;
          font-weight: 800;
          color: var(--text, #f8fafc);
          margin: 0;
        }
        .ag-car-variant {
          font-size: 0.8rem;
          color: var(--accent, #60a5fa);
          font-weight: 600;
        }
        .ag-car-platform {
          font-size: 0.75rem;
          color: var(--text-muted, #94a3b8);
        }

        /* Technical Specification Matrix */
        .ag-spec-grid {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 0.8rem;
        }
        .ag-spec-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          border-bottom: 1px dashed rgba(255, 255, 255, 0.07);
        }
        .ag-spec-label {
          color: var(--text-muted, #94a3b8);
        }
        .ag-spec-val {
          color: var(--text, #f8fafc);
          font-weight: 600;
          text-align: right;
          max-width: 170px;
        }

        /* Section Navigation List */
        .ag-nav-list {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .ag-nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 7px;
          cursor: pointer;
          font-size: 0.82rem;
          color: var(--text-muted, #94a3b8);
          transition: all 0.15s ease;
          border: 1px solid transparent;
        }
        .ag-nav-item:hover {
          background: var(--bg-subtle, #334155);
          color: var(--text, #f8fafc);
        }
        .ag-nav-item.active {
          background: rgba(59, 130, 246, 0.15);
          border-color: var(--accent, #3b82f6);
          color: var(--accent, #60a5fa);
          font-weight: 600;
        }
        .ag-nav-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--border, #475569);
          flex-shrink: 0;
        }
        .ag-nav-item.active .ag-nav-dot {
          background: var(--accent, #3b82f6);
          box-shadow: 0 0 6px var(--accent, #3b82f6);
        }

        /* Center Canvas: Dominant Visualization */
        .ag-col-center {
          flex: 1;
          display: flex;
          flex-direction: column;
          position: relative;
          background: #090d16;
          overflow: hidden;
          cursor: grab;
          user-select: none;
        }
        .ag-col-center:active {
          cursor: grabbing;
        }
        .ag-canvas-viewport {
          flex: 1;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          transform-origin: center center;
        }
        .ag-viewer-host {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.08s ease-out;
        }
        /* Floating Diagram Toolbar */
        .ag-floating-tools {
          position: absolute;
          top: 14px;
          right: 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          z-index: 30;
        }
        .ag-tool-btn {
          width: 34px;
          height: 34px;
          border-radius: 7px;
          background: var(--bg-card, #1e293b);
          border: 1px solid var(--border, #334155);
          color: var(--text, #f8fafc);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
          transition: all 0.15s ease;
        }
        .ag-tool-btn:hover {
          background: var(--bg-subtle, #334155);
          border-color: var(--accent, #3b82f6);
        }

        /* Active Blueprint Status Overlay */
        .ag-view-status {
          position: absolute;
          bottom: 14px;
          left: 14px;
          padding: 6px 12px;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(8px);
          border: 1px solid var(--border, #334155);
          border-radius: 8px;
          font-size: 0.75rem;
          color: var(--text-muted, #94a3b8);
          display: flex;
          align-items: center;
          gap: 8px;
          pointer-events: none;
        }
        .ag-status-indicator {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 6px #10b981;
        }

        /* Right Panel: Component Diagnostics Inspector */
        .ag-col-right {
          width: 330px;
          background: var(--bg-card, #1e293b);
          border-left: 1px solid var(--border, #334155);
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          flex-shrink: 0;
          z-index: 10;
        }
        .ag-inspector-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 24px;
          text-align: center;
          color: var(--text-muted, #94a3b8);
          font-size: 0.85rem;
          gap: 12px;
        }
        .ag-comp-badge {
          display: inline-block;
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 3px 8px;
          border-radius: 6px;
          background: rgba(59, 130, 246, 0.15);
          color: var(--accent, #60a5fa);
          margin-bottom: 8px;
        }
        .ag-comp-name {
          font-size: 1.1rem;
          font-weight: 800;
          margin: 0 0 6px 0;
          color: var(--text, #f8fafc);
        }
        .ag-comp-location {
          font-size: 0.76rem;
          color: var(--text-muted, #94a3b8);
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .ag-card-block {
          background: var(--bg, #0f172a);
          border: 1px solid var(--border, #334155);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 12px;
        }
        .ag-card-block h5 {
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted, #94a3b8);
          margin: 0 0 6px 0;
        }
        .ag-card-block p {
          font-size: 0.82rem;
          line-height: 1.45;
          margin: 0;
          color: var(--text, #e2e8f0);
        }
        .ag-failure-box {
          border-left: 3px solid #ef4444;
          background: rgba(239, 68, 68, 0.08);
        }
        .ag-failure-box h5 {
          color: #f87171;
        }
        .ag-related-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 6px;
        }
        .ag-chip {
          font-size: 0.74rem;
          background: var(--bg, #0f172a);
          border: 1px solid var(--border, #334155);
          padding: 4px 9px;
          border-radius: 999px;
          color: var(--text, #f8fafc);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .ag-chip:hover {
          border-color: var(--accent, #3b82f6);
          color: var(--accent, #60a5fa);
        }
        .ag-btn-assistant {
          margin-top: 14px;
          width: 100%;
          padding: 9px;
          background: var(--accent, #3b82f6);
          border: none;
          border-radius: 8px;
          color: #ffffff;
          font-size: 0.82rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          transition: opacity 0.15s ease;
        }
        .ag-btn-assistant:hover {
          opacity: 0.9;
        }

        /* Mobile Bottom Sheet & Responsive Rules */
        .ag-mobile-tabs {
          display: none;
        }
        @media (max-width: 900px) {
          .ag-col-left, .ag-col-right {
            display: none;
          }
          .ag-mobile-tabs {
            display: flex;
            background: var(--bg-card, #1e293b);
            border-top: 1px solid var(--border, #334155);
            padding: 8px;
            gap: 8px;
            justify-content: space-around;
            z-index: 50;
          }
          .ag-mob-btn {
            flex: 1;
            padding: 8px;
            background: var(--bg, #0f172a);
            border: 1px solid var(--border, #334155);
            border-radius: 7px;
            color: var(--text-muted, #94a3b8);
            font-size: 0.78rem;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          }
          .ag-mob-btn.active {
            background: var(--accent, #3b82f6);
            color: #ffffff;
            border-color: var(--accent, #3b82f6);
          }
          .ag-bottom-sheet {
            position: absolute;
            bottom: 50px;
            left: 0;
            right: 0;
            background: var(--bg-card, #1e293b);
            border-top: 1px solid var(--border, #334155);
            border-radius: 16px 16px 0 0;
            box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.5);
            max-height: 60vh;
            overflow-y: auto;
            z-index: 45;
            padding: 16px;
            transform: translateY(100%);
            transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .ag-bottom-sheet.open {
            transform: translateY(0);
          }
        }
      </style>

      <div class="ag-root">
        <!-- Top Command Bar -->
        <header class="ag-header">
          <div class="ag-header-left">
            <h2 class="ag-header-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.9 2 11.2 2 11.5V16c0 .6.4 1 1 1h2"></path>
                <circle cx="7" cy="17" r="2"></circle>
                <circle cx="17" cy="17" r="2"></circle>
              </svg>
              Automobile Guide
            </h2>
          </div>

          <div class="ag-header-center">
            <div class="ag-search-box">
              <svg class="ag-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="text" id="ag-search-input" class="ag-search-input" placeholder="Search vehicle (e.g. Lexus GX, BMW 3 Series, Corolla, Porsche 911)..." autocomplete="off" />
              <div id="ag-search-dropdown" class="ag-search-dropdown"></div>
            </div>
          </div>

          <div class="ag-header-right">
            <div class="ag-view-pills" id="ag-view-pills">
              <button type="button" class="ag-view-btn active" data-view="technical" aria-pressed="true">Technical</button>
              <button type="button" class="ag-view-btn" data-view="xray" aria-pressed="false">X-Ray</button>
              <button type="button" class="ag-view-btn" data-view="isolate" aria-pressed="false">Isolate</button>
            </div>
          </div>
        </header>

        <!-- 3-Column Balanced Workspace -->
        <div class="ag-workspace">
          <!-- Left Column: Specs & Section Navigation -->
          <aside class="ag-col-left" id="ag-col-left">
            <div class="ag-panel-section">
              <div class="ag-car-hero" id="ag-car-hero">
                <h3 class="ag-car-name">Select Vehicle</h3>
                <span class="ag-car-variant">Technical Reference System</span>
              </div>
            </div>

            <div class="ag-panel-section">
              <div class="ag-panel-title">
                <span>Technical Specifications</span>
              </div>
              <div class="ag-spec-grid" id="ag-spec-grid">
                <div style="color:var(--text-muted); font-size:0.8rem;">Loading vehicle database…</div>
              </div>
            </div>

            <div class="ag-panel-section" style="border-bottom:none;">
              <div class="ag-panel-title">
                <span>Model Components</span>
              </div>
              <div class="ag-nav-list" id="ag-nav-list">
                <!-- Section items dynamically populated -->
              </div>
            </div>
          </aside>

          <!-- Center Column: Interactive Technical Visualization -->
          <main class="ag-col-center" id="ag-canvas-col">
            <div class="ag-floating-tools">
              <button type="button" class="ag-tool-btn" id="ag-zoom-in" title="Zoom In" aria-label="Zoom in">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
              <button type="button" class="ag-tool-btn" id="ag-zoom-out" title="Zoom Out" aria-label="Zoom out">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
              <button type="button" class="ag-tool-btn" id="ag-zoom-reset" title="Reset View" aria-label="Reset camera">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
              </button>
            </div>

            <div class="ag-asset-disclosure"><strong id="ag-asset-label">Loading model</strong><p id="ag-asset-description"></p></div>
            <div class="ag-canvas-viewport">
              <div class="ag-viewer-host" id="ag-viewer-host">
                <div style="color:var(--text-muted); font-size:0.9rem;">Loading technical 3D viewer…</div>
              </div>
            </div>

            <div class="ag-view-status" id="ag-view-status">
              <span class="ag-status-indicator"></span>
              <span id="ag-status-text" role="status">Technical 3D • Geometry accuracy is shown with each asset</span>
            </div>
          </main>

          <!-- Right Column: Component Diagnostics Inspector -->
          <aside class="ag-col-right" id="ag-col-right">
            <div class="ag-inspector-empty" id="ag-inspector-empty">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <div>
                <strong>No Component Selected</strong>
                <p style="margin:4px 0 0; font-size:0.78rem; opacity:0.8;">Select geometry or choose a component from the list. Only supplied metadata is shown.</p>
              </div>
            </div>
            <div id="ag-inspector-content" style="display:none; padding:16px;"></div>
          </aside>
        </div>

        <!-- Mobile Floating Bottom Sheet -->
        <div class="ag-bottom-sheet" id="ag-bottom-sheet">
          <div id="ag-sheet-body"></div>
        </div>

        <!-- Mobile Navigation Switcher -->
        <nav class="ag-mobile-tabs">
          <button type="button" class="ag-mob-btn active" data-mob-tab="diag">3D Viewer</button>
          <button type="button" class="ag-mob-btn" data-mob-tab="specs">Vehicle Specs</button>
          <button type="button" class="ag-mob-btn" data-mob-tab="inspector">Component</button>
        </nav>
      </div>
    `;

    this.bindEvents();
    this.initializeViewer();
  },

  async initializeViewer() {
    const host=this.container.querySelector('#ag-viewer-host');
    try {
      this.viewer=new AutomobileViewer(host,{
        onSelect:comp=>this.onComponentSelection(comp),
        onStatus:text=>{this.container.querySelector('#ag-status-text').textContent=text;}
      });
      this.container.querySelector('#ag-spec-grid').textContent='Search for a vehicle to load its available reference data.';
      await this.loadVisualization(null);
    } catch(error) {
      if(!this.container.isConnected)return;
      host.innerHTML='<div class="ag-viewer-error" role="status"><strong>3D viewer unavailable</strong><p></p></div>';
      host.querySelector('p').textContent=error.message;
      this.container.querySelector('#ag-status-text').textContent='Vehicle search and reference information remain available.';
    }
  },

  bindEvents() {
    const searchInput = this.container.querySelector('#ag-search-input');
    const searchDropdown = this.container.querySelector('#ag-search-dropdown');

    // Live search input with debouncing
    const version = this._version;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(async () => {
        const query = e.target.value.trim();
        const results = await autoClient.searchVehicles(query);
        if (version !== this._version || query !== searchInput.value.trim()) return;
        this.renderSearchResults(results);
      }, 200);
    });

    searchInput.addEventListener('focus', async () => {
      const query = searchInput.value.trim();
      const results = await autoClient.searchVehicles(query);
      if (version !== this._version || query !== searchInput.value.trim()) return;
      this.renderSearchResults(results);
    });

    this._onOutsideClick = (e) => {
      if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
        searchDropdown.style.display = 'none';
      }
    };
    document.addEventListener('click', this._onOutsideClick);

    // View mode pills
    const viewPills = this.container.querySelector('#ag-view-pills');
    viewPills.addEventListener('click', (e) => {
      const btn = e.target.closest('.ag-view-btn');
      if (btn) {
        viewPills.querySelectorAll('.ag-view-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.state.viewMode = btn.getAttribute('data-view');
        viewPills.querySelectorAll('.ag-view-btn').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
        this.viewer?.setMode(this.state.viewMode);
      }
    });

    // Zoom and pan canvas controls
    this.container.querySelector('#ag-zoom-in').addEventListener('click', () => this.zoom(0.2));
    this.container.querySelector('#ag-zoom-out').addEventListener('click', () => this.zoom(-0.2));
    this.container.querySelector('#ag-zoom-reset').addEventListener('click', () => this.resetTransform());

    this._onContainerClick=event=>{
      const component=event.target.closest('[data-component-id]');
      if(component)this.viewer?.select(component.dataset.componentId);
      if(event.target.closest('[data-clear-selection]'))this.viewer?.select(null);
      if(event.target.closest('[data-ask-component]'))this.askAssistant();
    };
    this.container.addEventListener('click',this._onContainerClick);

    // Mobile tabs
    const mobTabs = this.container.querySelector('.ag-mobile-tabs');
    mobTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.ag-mob-btn');
      if (!btn) return;
      mobTabs.querySelectorAll('.ag-mob-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-mob-tab');
      this.handleMobileTab(tab);
    });
  },

  renderSearchResults(results) {
    const dropdown = this.container.querySelector('#ag-search-dropdown');
    if (!results || results.length === 0) {
      dropdown.innerHTML = '<div style="padding:12px; color:var(--text-muted); font-size:0.85rem; text-align:center;">No vehicles found.</div>';
      dropdown.style.display = 'block';
      return;
    }

    dropdown.innerHTML = results.map(v => `
      <div class="ag-search-item" data-vehicle-id="${escape(v.id)}">
        <div>
          <div class="ag-search-item-title">${escape(v.manufacturer)} ${escape(v.model)} <span style="font-weight:400; opacity:0.8;">${escape(v.generation)}</span></div>
          <div class="ag-search-item-meta">${escape(v.variant || v.bodyStyle)} • ${escape(v.years)}</div>
        </div>
        <span class="ag-search-badge">${escape(v.status === 'metadata_only' ? 'NHTSA' : 'REFERENCE')}</span>
      </div>
    `).join('');

    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.ag-search-item').forEach(item => {
      item.addEventListener('click', () => {
        const vid = item.getAttribute('data-vehicle-id');
        const v = results.find(r => r.id === vid);
        if (v) {
          this.selectVehicle(v);
          dropdown.style.display = 'none';
          this.container.querySelector('#ag-search-input').value = `${escape(v.manufacturer)} ${escape(v.model)}`;
        }
      });
    });
  },

  async selectVehicle(vehicle) {
    const version = this._version;
    this.state.selectedVehicle = vehicle;
    this.state.selectedSection = null;
    this.state.selectedComponent = null;

    // Fetch full specs
    const specs = await autoClient.getVehicleDetails(vehicle.id, vehicle.manufacturer, vehicle.model);
    if (version !== this._version || this.state.selectedVehicle !== vehicle) return;
    if (specs) {
       this.state.selectedVehicle = { ...vehicle, ...specs };
    }

    // Render Left Panel Info
    this.renderVehicleInfo(this.state.selectedVehicle);

    // Render Section Navigation
    this.renderSectionNav(this.state.selectedVehicle);

    // Load semantic model
    this.loadVisualization(this.state.selectedVehicle);

    // Clear Inspector
    this.clearInspector();

    // Reset View
    this.resetTransform();
  },

  renderVehicleInfo(vehicle) {
    const hero = this.container.querySelector('#ag-car-hero');
    hero.innerHTML = `
      <h3 class="ag-car-name">${escape(vehicle.manufacturer)} ${escape(vehicle.model)}</h3>
      <span class="ag-car-variant">${escape(vehicle.generation)} • ${escape(vehicle.variant || '')}</span>
      <span class="ag-car-platform">${escape(vehicle.platform || '')}</span>
    `;

    const specGrid = this.container.querySelector('#ag-spec-grid');
    if (vehicle.meta && vehicle.meta.extract) {
      specGrid.innerHTML = `
        <div style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4; padding: 4px 0 12px; font-style: italic;">
          ${escape(vehicle.meta.extract.substring(0, 250))}...
        </div>
        <div class="ag-spec-row"><span class="ag-spec-label">Years</span><span class="ag-spec-val">${escape(vehicle.years || 'N/A')}</span></div>
        <div class="ag-spec-row"><span class="ag-spec-label">Body Style</span><span class="ag-spec-val">${escape(vehicle.bodyStyle || 'N/A')}</span></div>
      `;
    } else {
      specGrid.innerHTML = `
        <div class="ag-spec-row"><span class="ag-spec-label">Years</span><span class="ag-spec-val">${escape(vehicle.years || 'N/A')}</span></div>
        <div class="ag-spec-row"><span class="ag-spec-label">Body Style</span><span class="ag-spec-val">${escape(vehicle.bodyStyle || 'N/A')}</span></div>
        <div class="ag-spec-row"><span class="ag-spec-label">Drivetrain</span><span class="ag-spec-val">${escape(vehicle.layout || 'N/A')}</span></div>
        <div class="ag-spec-row"><span class="ag-spec-label">Engine</span><span class="ag-spec-val">${escape(vehicle.engine?.code || 'N/A')} (${escape(vehicle.engine?.output || '')})</span></div>
        <div class="ag-spec-row"><span class="ag-spec-label">Transmission</span><span class="ag-spec-val">${escape(vehicle.transmission?.code || 'N/A')}</span></div>
        <div class="ag-spec-row"><span class="ag-spec-label">Front Susp.</span><span class="ag-spec-val">${escape(vehicle.chassis?.frontSuspension?.split('with')[0] || 'Unavailable')}</span></div>
        <div class="ag-spec-row"><span class="ag-spec-label">Rear Susp.</span><span class="ag-spec-val">${escape(vehicle.chassis?.rearSuspension?.split('with')[0] || 'Unavailable')}</span></div>
        <div class="ag-spec-row"><span class="ag-spec-label">Curb Weight</span><span class="ag-spec-val">${escape(vehicle.curbWeight || 'N/A')}</span></div>
        <div class="ag-spec-row"><span class="ag-spec-label">Wheelbase</span><span class="ag-spec-val">${escape(vehicle.wheelbase || 'N/A')}</span></div>
      `;
    }
  },

  renderSectionNav() {
    const list=this.container.querySelector('#ag-nav-list');
    const parts=this.viewer?.asset?.registry.list() || [];
    list.innerHTML=parts.length ? '<button type="button" class="ag-nav-item" data-clear-selection>Show complete model</button>'+parts.map(part=>
      '<button type="button" class="ag-nav-item" data-component-id="'+escape(part.id)+'" aria-pressed="false"><span class="ag-nav-dot"></span><span>'+escape(part.name)+'<small>'+escape(part.category || 'Unmapped geometry')+'</small></span></button>'
    ).join('') : '<p class="ag-asset-note">No mapped components loaded.</p>';
  },

  async loadVisualization(vehicle) {
    if(!this.viewer)return;
    const version=this._version,request=this._assetRequest=(this._assetRequest||0)+1;
    this.viewer.clear();this.assetMetadata=null;this.state.selectedComponent=null;this.clearInspector();this.renderSectionNav();
    this.container.querySelector('#ag-asset-label').textContent='Loading model';
    this.container.querySelector('#ag-asset-description').textContent='';
    this.dispatchAssistantContext(null);
    if(this.state.activeMobileTab!=='diag')this.handleMobileTab(this.state.activeMobileTab);
    try {
      const descriptor=await autoClient.getVehicleAsset(vehicle);
      if(version!==this._version||request!==this._assetRequest)return;
      const asset=await this.viewer.loadVehicle(descriptor);
      if(!asset||version!==this._version||request!==this._assetRequest)return;
      this.assetMetadata=asset.metadata;
      const accuracy=asset.metadata.accuracy;
      const label=accuracy==='development'?'DEVELOPMENT MODEL · Not vehicle geometry':accuracy==='representative'?'REPRESENTATIVE · Not the exact vehicle':accuracy==='generation'?'GENERATION MODEL':accuracy==='exact'?'VEHICLE-SPECIFIC MODEL':'UNVERIFIED GEOMETRY';
      this.container.querySelector('#ag-asset-label').textContent=label;
      this.container.querySelector('#ag-asset-description').textContent=asset.metadata.description || asset.metadata.label || 'No asset description supplied.';
      this.container.querySelector('#ag-status-text').textContent='Drag to orbit · Scroll / pinch to zoom · Two fingers to pan';
      const { settings,mobile }=this.viewer.pipeline;
      const limit=mobile?settings.mobileHiddenComponents:settings.maxHiddenComponents;
      if(asset.registry.list().length>limit)this.container.querySelector('#ag-asset-description').textContent+=' X-Ray previews up to '+limit+' components, prioritizing the selection.';
      this.viewer.setMode(this.state.viewMode);this.renderSectionNav();
      if(this.state.activeMobileTab!=='diag')this.handleMobileTab(this.state.activeMobileTab);
    } catch(error) {
      if(version!==this._version||request!==this._assetRequest)return;
      this.container.querySelector('#ag-asset-label').textContent='MODEL UNAVAILABLE';
      this.container.querySelector('#ag-asset-description').textContent=error.message;
    }
  },

  onComponentSelection(comp) {
    this.state.selectedComponent=comp?.id || null;
    this.container.querySelectorAll('[data-component-id]').forEach(button=>{
      const selected=button.dataset.componentId===comp?.id;
      button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
    });
    if(comp)this.renderInspector(comp);else this.clearInspector();
    this.dispatchAssistantContext(comp);
    if(this.state.activeMobileTab!=='diag')this.handleMobileTab(this.state.activeMobileTab);
  },

  renderInspector(comp) {
    this.container.querySelector('#ag-inspector-empty').style.display='none';
    const content=this.container.querySelector('#ag-inspector-content');content.style.display='block';
    const fields=[['Description',comp.description || comp.purpose],['Parent assembly',comp.parentAssembly],['Location',comp.location],['Specifications',comp.specs],['Failure modes',comp.failures],['Source',comp.source]];
    content.innerHTML='<span class="ag-comp-badge">'+escape(comp.category || comp.subsystem || 'Unmapped geometry')+'</span><h4 class="ag-comp-name">'+escape(comp.name)+'</h4>'+fields.filter(([,value])=>value).map(([title,value])=>'<div class="ag-card-block"><h5>'+title+'</h5><p>'+escape(value)+'</p></div>').join('')+
      (!comp.description&&!comp.purpose?'<p class="ag-asset-note">No component description was supplied with this asset.</p>':'')+
      '<button type="button" class="ag-btn-assistant" data-ask-component>Copy context for Assistant</button>';
    content.setAttribute('aria-live','polite');
  },

  async askAssistant() {
    const comp=this.viewer?.asset?.registry.metadata(this.state.selectedComponent);
    if(!comp)return;
    const context=this.getAssistantContext(comp), version=this._version;
    window.dispatchEvent(new CustomEvent('toolbox:automobile:context',{detail:context}));
    try {
      await navigator.clipboard.writeText('Explain this component using only the supplied context. Do not assume the geometry is exact.\n'+JSON.stringify(context,null,2));
      if(version!==this._version)return;
      this.container.querySelector('#ag-status-text').textContent='Context copied. Paste it into Assistant to discuss this selection.';
    } catch {
      if(version!==this._version)return;
      this.container.querySelector('#ag-status-text').textContent='Clipboard unavailable. Allow clipboard access and try again.';
    }
  },

  clearInspector() {
    const emptyState = this.container.querySelector('#ag-inspector-empty');
    const content = this.container.querySelector('#ag-inspector-content');
    emptyState.style.display = 'flex';
    content.style.display = 'none';
  },

  getAssistantContext(comp) {
    const { selectedVehicle, viewMode, selectedSection } = this.state;
    return {
      tool: 'automobile-guide',
      vehicle: {
        make: selectedVehicle?.manufacturer,
        manufacturer: selectedVehicle?.manufacturer,
        model: selectedVehicle?.model,
        generation: selectedVehicle?.generation,
        platform: selectedVehicle?.platform,
        year: selectedVehicle?.year || null,
        engine: selectedVehicle?.engine?.code
      },
      visualization: this.assetMetadata || null,
      selectedComponent: comp || null,
      viewMode,
      section: selectedSection,
      component: comp ? {
        id: comp.id,
        name: comp.name,
        subsystem: comp.subsystem,
        failures: comp.failures
      } : null
    };
  },

  dispatchAssistantContext(comp) {
    window.dispatchEvent(new CustomEvent('toolbox:automobile:context', {
      detail: this.getAssistantContext(comp)
    }));
  },

  handleMobileTab(tab) {
    this.state.activeMobileTab = tab;
    const sheet = this.container.querySelector('#ag-bottom-sheet');
    const sheetBody = this.container.querySelector('#ag-sheet-body');

    if (tab === 'diag') {
      sheet.classList.remove('open');
      return;
    }

    sheet.classList.add('open');
    if (tab === 'specs') {
      const leftCol = this.container.querySelector('#ag-col-left');
      sheetBody.innerHTML = leftCol.innerHTML;
    } else if (tab === 'inspector') {
      const rightCol = this.container.querySelector('#ag-col-right');
      sheetBody.innerHTML = rightCol.innerHTML;
    }
    sheetBody.querySelectorAll('[id]').forEach(element=>element.removeAttribute('id'));
  },

  zoom(delta) { this.viewer?.zoom(delta); },
  resetTransform() { this.viewer?.reset(); },
  destroy() {
    this._version=(this._version||0)+1;
    clearTimeout(this._searchTimer);
    document.removeEventListener('click',this._onOutsideClick);
    this.container?.removeEventListener('click',this._onContainerClick);
    this.viewer?.dispose();this.viewer=null;
  }
};
