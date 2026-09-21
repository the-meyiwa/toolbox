/** Automobile Guide: reference data, semantic inspector and interactive technical 3D viewport. */

import { autoClient } from '../lib/automotive-data.js';
import { AutomobileViewer } from '../lib/automobile/automobile-viewer.js';
import { openContextMenu, closeContextMenu } from '../lib/context-menu.js';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COMPACT_QUERY = '(max-width: 900px), (pointer: coarse)';

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
      activeMobileTab: 'diag', // 'diag' | 'specs' | 'inspector'
      hiddenLayers: new Set(),
      hiddenParts: new Set(),
      actionsOpen: false
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.9 2 11.2 2 11.5V16c0 .6.4 1 1 1h2"></path>
                <circle cx="7" cy="17" r="2"></circle>
                <circle cx="17" cy="17" r="2"></circle>
              </svg>
              Automobile Guide
            </h2>
          </div>

          <div class="ag-header-center">
            <div class="ag-search-box">
              <svg class="ag-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input type="text" id="ag-search-input" class="ag-search-input" placeholder="Search vehicle (e.g. Corolla 2015, Mustang, Model 3)…" autocomplete="off" aria-label="Search vehicles" />
              <div id="ag-search-dropdown" class="ag-search-dropdown" role="listbox"></div>
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

        <div class="ag-workspace">
          <!-- Left Column: Specs, layers, actions & component navigation -->
          <aside class="ag-col-left" id="ag-col-left">
            <div class="ag-panel-section">
              <div class="ag-car-hero" id="ag-car-hero">
                <h3 class="ag-car-name">Select Vehicle</h3>
                <span class="ag-car-variant">Technical Reference System</span>
              </div>
            </div>

            <div class="ag-panel-section">
              <div class="ag-panel-title"><span>Technical Specifications</span></div>
              <div class="ag-spec-grid" id="ag-spec-grid">
                <div style="color:var(--text-muted); font-size:0.8rem;">Loading vehicle database…</div>
              </div>
            </div>

            <div class="ag-panel-section" id="ag-layers-section" hidden>
              <div class="ag-panel-title"><span>Model layers</span><button type="button" class="ag-link-btn" data-layers-all>Show all</button></div>
              <div class="ag-layer-list" id="ag-layer-list"></div>
            </div>

            <div class="ag-panel-section" id="ag-quick-section" hidden>
              <div class="ag-panel-title"><span>Quick actions</span></div>
              <div class="ag-quick-list" id="ag-quick-list"></div>
            </div>

            <div class="ag-panel-section" style="border-bottom:none;">
              <div class="ag-panel-title"><span>Model Components</span></div>
              <input class="ag-component-search" id="ag-component-search" type="search" placeholder="Find a component" aria-label="Search components" disabled>
              <div class="ag-nav-list" id="ag-nav-list"></div>
            </div>
          </aside>

          <!-- Center Column: Interactive Technical Visualization -->
          <main class="ag-col-center" id="ag-canvas-col">
            <div class="ag-floating-tools">
              <button type="button" class="ag-tool-btn" id="ag-zoom-in" title="Zoom In" aria-label="Zoom in">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
              <button type="button" class="ag-tool-btn" id="ag-zoom-out" title="Zoom Out" aria-label="Zoom out">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
              <button type="button" class="ag-tool-btn" id="ag-zoom-reset" title="Reset View" aria-label="Reset camera">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
              </button>
            </div>

            <div class="ag-asset-disclosure">
              <strong id="ag-asset-label">Loading model</strong>
              <p id="ag-asset-description"></p>
              <p id="ag-asset-attribution" class="ag-asset-attribution"></p>
            </div>
            <div class="ag-canvas-viewport">
              <div class="ag-viewer-host" id="ag-viewer-host">
                <div style="color:var(--text-muted); font-size:0.9rem;">Loading technical 3D viewer…</div>
              </div>
              <div class="ag-selection-chip" id="ag-selection-chip" hidden>
                <span class="ag-chip-name" id="ag-chip-name"></span>
                <button type="button" class="ag-chip-btn ag-chip-toggle" data-open-toggle hidden>Toggle</button>
                <button type="button" class="ag-chip-btn" data-open-inspector>Info</button>
              </div>
            </div>

            <div class="ag-view-status" id="ag-view-status">
              <span class="ag-status-indicator"></span>
              <span id="ag-status-text" role="status">Technical 3D • Geometry accuracy is shown with each asset</span>
            </div>
          </main>

          <!-- Right Column: Component Inspector -->
          <aside class="ag-col-right" id="ag-col-right">
            <div class="ag-inspector-empty" id="ag-inspector-empty">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <div>
                <strong>No Component Selected</strong>
                <p style="margin:4px 0 0; font-size:0.78rem; opacity:0.8;" id="ag-empty-hint">Select geometry or choose a component from the list. Only supplied metadata is shown.</p>
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
        <nav class="ag-mobile-tabs" aria-label="Automobile Guide panels">
          <button type="button" class="ag-mob-btn active" data-mob-tab="diag">3D Viewer</button>
          <button type="button" class="ag-mob-btn" data-mob-tab="specs">Vehicle Specs</button>
          <button type="button" class="ag-mob-btn" data-mob-tab="inspector">Component</button>
        </nav>
      </div>
    `;

    this.bindEvents();
    this.initializeViewer();
  },

  isCompact() {
    return Boolean(window.matchMedia?.(COMPACT_QUERY).matches);
  },

  async initializeViewer() {
    const host=this.container.querySelector('#ag-viewer-host');
    try {
      this.viewer=new AutomobileViewer(host,{
        onSelect:comp=>this.onComponentSelection(comp),
        onStatus:text=>{this.setStatus(text);},
        onContextMenu:event=>this.openPartMenu(event),
        onArticulation:change=>this.onArticulation(change)
      });
      const initial=(await autoClient.searchVehicles(''))[0];
      if(!initial)throw new Error('No Toolbox Vehicle Packages are installed.');
      this.container.querySelector('#ag-search-input').value=`${initial.manufacturer} ${initial.model} ${initial.years}`;
      await this.selectVehicle(initial);
    } catch(error) {
      if(!this.container?.isConnected)return;
      host.innerHTML='<div class="ag-viewer-error" role="status"><strong>3D viewer unavailable</strong><p></p></div>';
      host.querySelector('p').textContent=error.message;
      this.setStatus('Vehicle search and reference information remain available.');
    }
  },

  setStatus(text) {
    const status=this.container?.querySelector('#ag-status-text');
    if(status)status.textContent=text;
  },

  bindEvents() {
    const searchInput = this.container.querySelector('#ag-search-input');
    const searchDropdown = this.container.querySelector('#ag-search-dropdown');
    const componentSearch = this.container.querySelector('#ag-component-search');
    componentSearch.addEventListener('input',()=>this.renderSectionNav());

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
      const results = await autoClient.searchVehicles('');
      if (version !== this._version || query !== searchInput.value.trim()) return;
      this.renderSearchResults(results);
    });

    this._onOutsideClick = (e) => {
      if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
        searchDropdown.style.display = 'none';
      }
    };
    document.addEventListener('click', this._onOutsideClick);

    const viewPills = this.container.querySelector('#ag-view-pills');
    viewPills.addEventListener('click', (e) => {
      const btn = e.target.closest('.ag-view-btn');
      if (btn) this.setViewMode(btn.getAttribute('data-view'));
    });

    // Phones: the asset disclosure collapses to two lines; tap to read it all.
    const disclosure=this.container.querySelector('.ag-asset-disclosure');
    disclosure.addEventListener('click',event=>{ if(!event.target.closest('a'))disclosure.classList.toggle('is-expanded'); });

    this.container.querySelector('#ag-zoom-in').addEventListener('click', () => this.zoom(0.2));
    this.container.querySelector('#ag-zoom-out').addEventListener('click', () => this.zoom(-0.2));
    this.container.querySelector('#ag-zoom-reset').addEventListener('click', () => this.resetTransform());

    this._onContainerClick=event=>{
      const target=event.target;
      const action=target.closest('[data-articulation]');
      if(action){ this.runArticulation(action.dataset.articulation); return; }
      if(target.closest('[data-toggle-actions]')){ this.state.actionsOpen=!this.state.actionsOpen; this.refreshInspector(); return; }
      if(target.closest('[data-open-toggle]')){ this.state.actionsOpen=true; this.refreshInspector(); this.showMobileTab('inspector'); return; }
      if(target.closest('[data-open-inspector]')){ this.showMobileTab('inspector'); return; }
      const layer=target.closest('[data-layer-toggle]');
      if(layer){ this.toggleLayer(layer.dataset.layerToggle); return; }
      if(target.closest('[data-layers-all]')){ this.showAllLayers(); return; }
      const quick=target.closest('[data-quick]');
      if(quick){ this.runQuickAction(quick.dataset.quick); return; }
      const partAction=target.closest('[data-part-action]');
      if(partAction){ this.runPartAction(partAction.dataset.partAction); return; }
      const component=target.closest('[data-component-id]');
      if(component)this.viewer?.select(component.dataset.componentId);
      if(target.closest('[data-clear-selection]'))this.viewer?.select(null);
      if(target.closest('[data-ask-component]'))this.askAssistant();
    };
    this.container.addEventListener('click',this._onContainerClick);

    // Desktop: right-click a component in the list for the same actions as the viewport.
    this._onContainerContextMenu=event=>{
      const item=event.target.closest('#ag-nav-list [data-component-id]');
      if(!item||!this.viewer?.asset)return;
      event.preventDefault();
      this.viewer.select(item.dataset.componentId);
      this.openPartMenu({ component:this.viewer.asset.registry.metadata(item.dataset.componentId), clientX:event.clientX, clientY:event.clientY });
    };
    this.container.addEventListener('contextmenu',this._onContainerContextMenu);

    const mobTabs = this.container.querySelector('.ag-mobile-tabs');
    mobTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.ag-mob-btn');
      if (btn) this.showMobileTab(btn.getAttribute('data-mob-tab'));
    });
  },

  setViewMode(mode) {
    const viewPills=this.container.querySelector('#ag-view-pills');
    this.state.viewMode=mode;
    viewPills.querySelectorAll('.ag-view-btn').forEach(b=>{const on=b.dataset.view===mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
    this.viewer?.setMode(mode);
  },

  showMobileTab(tab) {
    const tabs=this.container.querySelector('.ag-mobile-tabs');
    tabs.querySelectorAll('.ag-mob-btn').forEach(b=>b.classList.toggle('active',b.dataset.mobTab===tab));
    this.handleMobileTab(tab);
  },

  renderSearchResults(results) {
    const dropdown = this.container.querySelector('#ag-search-dropdown');
    if (!results || results.length === 0) {
      dropdown.innerHTML = '<div style="padding:12px; color:var(--text-muted); font-size:0.85rem; text-align:center;">No vehicles found.</div>';
      dropdown.style.display = 'block';
      return;
    }

    dropdown.innerHTML = results.map(v => `
      <div class="ag-search-item" data-vehicle-id="${escape(v.id)}" role="option" tabindex="0">
        <div>
          <div class="ag-search-item-title">${escape(v.manufacturer)} ${escape(v.model)} <span style="font-weight:400; opacity:0.8;">${escape(v.years)}</span></div>
          <div class="ag-search-item-meta">${escape(v.generation)} • ${escape(v.variant || v.bodyStyle)}</div>
        </div>
        <span class="ag-search-badge">${v.interactive ? 'INTERACTIVE' : 'TOOLBOX PACKAGE'}</span>
      </div>
    `).join('');

    dropdown.style.display = 'block';

    dropdown.querySelectorAll('.ag-search-item').forEach(item => {
      const choose = () => {
        const v = results.find(r => r.id === item.getAttribute('data-vehicle-id'));
        if (!v) return;
        this.selectVehicle(v);
        dropdown.style.display = 'none';
        this.container.querySelector('#ag-search-input').value = `${v.manufacturer} ${v.model} ${v.years}`;
      };
      item.addEventListener('click', choose);
      item.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); } });
    });
  },

  async selectVehicle(vehicle) {
    const version = this._version;
    this.state.selectedVehicle = vehicle;
    this.state.selectedSection = null;
    this.state.selectedComponent = null;
    this.state.hiddenLayers = new Set();
    this.state.hiddenParts = new Set();
    this.state.actionsOpen = false;
    this.container.querySelector('#ag-component-search').value = '';

    const specs = await autoClient.getVehicleDetails(vehicle.id, vehicle.manufacturer, vehicle.model);
    if (version !== this._version || this.state.selectedVehicle !== vehicle) return;
    if (specs) this.state.selectedVehicle = { ...vehicle, ...specs };

    this.renderVehicleInfo(this.state.selectedVehicle);
    this.renderSectionNav();
    await this.loadVisualization(this.state.selectedVehicle);
    this.clearInspector();
    this.resetTransform();
  },

  renderVehicleInfo(vehicle) {
    const hero = this.container.querySelector('#ag-car-hero');
    hero.innerHTML = `
      <h3 class="ag-car-name">${escape(vehicle.manufacturer)} ${escape(vehicle.model)} <span class="ag-car-years">${escape(vehicle.years)}</span></h3>
      <span class="ag-car-variant">${escape(vehicle.generation)}</span>
      <span class="ag-car-platform">${escape(vehicle.variant || '')}</span>
    `;

    const specGrid = this.container.querySelector('#ag-spec-grid');
    const sheet = vehicle.specSheet;
    if (sheet?.groups?.length) {
      specGrid.innerHTML = sheet.groups.map((group, index) => `
        <details class="ag-spec-group"${index < 2 ? ' open' : ''}>
          <summary>${escape(group.title)}</summary>
          ${group.rows.map(([label, value]) => `<div class="ag-spec-row"><span class="ag-spec-label">${escape(label)}</span><span class="ag-spec-val">${escape(value)}</span></div>`).join('')}
        </details>`).join('') +
        `<p class="ag-spec-disclaimer">${escape(sheet.disclaimer || '')}</p>` +
        (sheet.sources?.length ? `<details class="ag-spec-group ag-spec-sources"><summary>Sources (${sheet.sources.length})</summary><ul>${sheet.sources.map(source => `<li><a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.label)}</a></li>`).join('')}</ul></details>` : '');
      return;
    }
    const fields=[['Year',vehicle.years],['Body style',vehicle.bodyStyle],['Drivetrain',vehicle.layout],['Engine',vehicle.engine?.code],['Transmission',vehicle.transmission?.code],['Curb weight',vehicle.curbWeight],['Wheelbase',vehicle.wheelbase]];
    specGrid.innerHTML=fields.map(([label,value])=>`<div class="ag-spec-row"><span class="ag-spec-label">${escape(label)}</span><span class="ag-spec-val">${escape(value || 'Unavailable in package')}</span></div>`).join('');
  },

  /** Layer toggles and quick actions for articulated packages. */
  renderModelControls() {
    const layersSection=this.container.querySelector('#ag-layers-section');
    const quickSection=this.container.querySelector('#ag-quick-section');
    const groups=this.layerGroups || [];
    layersSection.hidden=!groups.length;
    this.container.querySelector('#ag-layer-list').innerHTML=groups.map(layer=>{
      const on=!this.state.hiddenLayers.has(layer.id);
      return `<button type="button" class="ag-layer-chip${on?' is-on':''}" data-layer-toggle="${escape(layer.id)}" aria-pressed="${on}"><span class="ag-layer-dot" aria-hidden="true"></span>${escape(layer.label)}</button>`;
    }).join('');
    const controller=this.viewer?.articulation;
    const quick=controller?.size ? this.quickActions().filter(item=>item.available) : [];
    quickSection.hidden=!quick.length;
    this.container.querySelector('#ag-quick-list').innerHTML=quick.map(item=>`<button type="button" class="ag-quick-btn" data-quick="${item.id}">${escape(item.label)}</button>`).join('');
  },

  quickActions() {
    const c=this.viewer?.articulation;
    if(!c)return [];
    const groupActive=group=>c.list().some(def=>def.group===group&&c.isActive(def.id));
    const has=id=>Boolean(c.get(id));
    return [
      { id:'doors', label: groupActive('Doors') ? 'Close all doors' : 'Open all doors', available: c.list().some(d=>d.group==='Doors') },
      { id:'hood', label: c.isActive('hood') ? 'Close bonnet' : 'Open bonnet', available: has('hood') },
      { id:'trunk', label: c.isActive('trunk_lid') ? 'Close boot' : 'Open boot', available: has('trunk_lid') },
      { id:'windows', label: groupActive('Windows') ? 'Raise all windows' : 'Lower all windows', available: c.list().some(d=>d.group==='Windows') },
      { id:'wheels', label: c.list().some(d=>/^wheel_/.test(d.id)&&c.isActive(d.id)) ? 'Refit all wheels' : 'Remove all wheels', available: c.list().some(d=>/^wheel_/.test(d.id)) },
      { id:'exterior', label: this.state.hiddenLayers.has('body') ? 'Show body shell' : 'Hide body shell (see inside)', available: (this.layerGroups||[]).some(l=>l.id==='body') },
      { id:'reset', label:'Reset all moving parts', available:true }
    ];
  },

  runQuickAction(id) {
    const c=this.viewer?.articulation;
    if(!c)return;
    const groupActive=group=>c.list().some(def=>def.group===group&&c.isActive(def.id));
    if(id==='doors'){ const open=!groupActive('Doors'); c.setGroup('Doors',open); this.setStatus(open?'All doors opened.':'All doors closed.'); }
    else if(id==='windows'){ const open=!groupActive('Windows'); c.setGroup('Windows',open); this.setStatus(open?'All windows lowered.':'All windows raised.'); }
    else if(id==='hood')this.runArticulation('hood');
    else if(id==='trunk')this.runArticulation('trunk_lid');
    else if(id==='wheels'){
      const wheels=c.list().filter(d=>/^wheel_/.test(d.id));
      const remove=!wheels.some(d=>c.isActive(d.id));
      if(!remove)for(const d of c.list())if(/^(caliper_|brake_drum_|tyre_)/.test(d.id))c.set(d.id,false,{force:true});
      wheels.forEach(d=>c.set(d.id,remove));
      this.setStatus(remove?'All four wheels removed. Right-click or tap a brake to go further.':'All wheels refitted.');
    }
    else if(id==='exterior'){ this.toggleLayer('body'); return; }
    else if(id==='reset'){ c.resetAll(); this.setStatus('All moving parts returned to their resting positions.'); }
    this.renderModelControls();
    this.refreshInspector();
  },

  toggleLayer(layerId) {
    if(this.state.hiddenLayers.has(layerId))this.state.hiddenLayers.delete(layerId);else this.state.hiddenLayers.add(layerId);
    this.applyVisibility();
    const label=(this.layerGroups||[]).find(l=>l.id===layerId)?.label||layerId;
    this.setStatus(`${label} ${this.state.hiddenLayers.has(layerId)?'hidden':'shown'}.`);
  },

  showAllLayers() {
    this.state.hiddenLayers.clear();
    this.state.hiddenParts.clear();
    this.applyVisibility();
    this.setStatus('All layers and parts shown.');
  },

  applyVisibility() {
    const parts=this.viewer?.asset?.registry.list()||[];
    const hidden=parts.filter(part=>this.state.hiddenParts.has(part.id)||(part.layer&&this.state.hiddenLayers.has(part.layer))).map(part=>part.id);
    this.viewer?.setHidden(hidden);
    this.renderModelControls();
    this.renderSectionNav();
    this.syncMobileSheet();
  },

  renderSectionNav() {
    const list=this.container.querySelector('#ag-nav-list');
    const search=this.container.querySelector('#ag-component-search');
    const query=search?.value.trim().toLowerCase() || '';
    const allParts=this.viewer?.asset?.registry.list() || [];
    const parts=allParts.filter(part=>`${part.name} ${part.category} ${part.layer||''}`.toLowerCase().includes(query));
    if(search){search.disabled=!allParts.length;search.placeholder=allParts.length?`Find among ${allParts.length} components`:'No components loaded';}
    if(!parts.length){ list.innerHTML=`<p class="ag-asset-note">${allParts.length?'No components match this search.':'No mapped components loaded.'}</p>`; return; }
    const groups=this.layerGroups?.length ? this.layerGroups : [{ id:null, label:null }];
    const byLayer=new Map(groups.map(group=>[group.id,[]]));
    for(const part of parts){ const key=byLayer.has(part.layer)?part.layer:groups[0].id; byLayer.get(key).push(part); }
    const controller=this.viewer?.articulation;
    const item=part=>{
      const moving=controller?.forComponent(part.id).length||0;
      const hidden=this.viewer?.hidden.has(part.id);
      const selected=part.id===this.state.selectedComponent;
      return '<button type="button" class="ag-nav-item'+(selected?' active':'')+(hidden?' is-hidden':'')+'" data-component-id="'+escape(part.id)+'" aria-pressed="'+selected+'"><span class="ag-nav-dot"></span><span>'+escape(part.name)+'<small>'+escape(part.category || 'Unmapped geometry')+(hidden?' · hidden':'')+'</small></span>'+(moving?'<span class="ag-nav-badge" title="Has toggle actions">'+moving+'</span>':'')+'</button>';
    };
    list.innerHTML='<button type="button" class="ag-nav-item" data-clear-selection>Show complete model</button>'+
      [...byLayer].filter(([,items])=>items.length).map(([id,items])=>{
        const label=groups.find(g=>g.id===id)?.label;
        return (label?`<div class="ag-nav-heading">${escape(label)} <span>${items.length}</span></div>`:'')+items.map(item).join('');
      }).join('');
  },

  async loadVisualization(vehicle) {
    if(!this.viewer)return;
    const version=this._version,request=this._assetRequest=(this._assetRequest||0)+1;
    this.viewer.clear();this.assetMetadata=null;this.layerGroups=[];this.state.selectedComponent=null;this.clearInspector();this.renderSectionNav();this.renderModelControls();
    this.container.querySelector('#ag-asset-label').textContent='Loading model';
    this.container.querySelector('#ag-asset-description').textContent='';
    this.container.querySelector('#ag-asset-attribution').replaceChildren();
    this.dispatchAssistantContext(null);
    if(this.state.activeMobileTab!=='diag')this.handleMobileTab(this.state.activeMobileTab);
    try {
      const descriptor=await autoClient.getVehicleAsset(vehicle);
      if(version!==this._version||request!==this._assetRequest)return;
      const asset=await this.viewer.loadVehicle(descriptor);
      if(!asset||version!==this._version||request!==this._assetRequest)return;
      this.assetMetadata=asset.metadata;
      this.layerGroups=descriptor.layerGroups||[];
      const accuracy=asset.metadata.accuracy;
      const label=accuracy==='development'?'DEVELOPMENT MODEL · Not vehicle geometry':accuracy==='representative'?'REPRESENTATIVE · Not the exact vehicle':accuracy==='generation'?'GENERATION MODEL':accuracy==='exact'?'VEHICLE-SPECIFIC MODEL':'UNVERIFIED GEOMETRY';
      this.container.querySelector('#ag-asset-label').textContent=label;
      this.container.querySelector('#ag-asset-description').textContent=asset.metadata.description || asset.metadata.label || 'No asset description supplied.';
      const attribution=this.container.querySelector('#ag-asset-attribution');
      attribution.append(document.createTextNode(`${asset.metadata.attribution} · `));
      const source=document.createElement('a');source.href=asset.metadata.source;source.target='_blank';source.rel='noopener noreferrer';source.textContent='Source and license';attribution.append(source);
      if(asset.metadata.unavailableLayers?.length)attribution.append(document.createTextNode(` · Unavailable: ${asset.metadata.unavailableLayers.join(', ')}`));
      const articulated=this.viewer.articulation?.size;
      this.setStatus(articulated
        ? (this.isCompact() ? 'Drag to orbit · Pinch to zoom · Tap a part, then Toggle to open, remove or adjust it' : 'Drag to orbit · Scroll to zoom · Right-click a part to open, remove or adjust it')
        : 'Drag to orbit · Scroll / pinch to zoom · Two fingers to pan');
      this.container.querySelector('#ag-empty-hint').textContent=articulated
        ? `Select a part in the viewer or the list. ${this.isCompact()?'Use the Toggle button':'Right-click a part'} for its ${articulated} available moving and removable parts.`
        : 'Select geometry or choose a component from the list. Only supplied metadata is shown.';
      const { settings,mobile }=this.viewer.pipeline;
      const limit=mobile?settings.mobileHiddenComponents:settings.maxHiddenComponents;
      if(asset.registry.list().length>limit)this.container.querySelector('#ag-asset-description').textContent+=' X-Ray previews up to '+limit+' components, prioritizing the selection and its layer.';
      this.viewer.setMode(this.state.viewMode);this.renderSectionNav();this.renderModelControls();
      if(this.state.activeMobileTab!=='diag')this.handleMobileTab(this.state.activeMobileTab);
    } catch(error) {
      if(version!==this._version||request!==this._assetRequest)return;
      this.container.querySelector('#ag-asset-label').textContent='MODEL UNAVAILABLE';
      this.container.querySelector('#ag-asset-description').textContent=error.message;
    }
  },

  onComponentSelection(comp) {
    if(comp?.id!==this.state.selectedComponent)this.state.actionsOpen=false;
    this.state.selectedComponent=comp?.id || null;
    this.container.querySelectorAll('[data-component-id]').forEach(button=>{
      const selected=button.dataset.componentId===comp?.id;
      button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));
    });
    if(comp)this.renderInspector(comp);else this.clearInspector();
    this.renderSelectionChip(comp);
    this.dispatchAssistantContext(comp);
    if(this.state.activeMobileTab!=='diag')this.handleMobileTab(this.state.activeMobileTab);
  },

  renderSelectionChip(comp) {
    const chip=this.container.querySelector('#ag-selection-chip');
    if(!chip)return;
    chip.hidden=!comp;
    if(!comp)return;
    chip.querySelector('#ag-chip-name').textContent=comp.name;
    const count=this.viewer?.articulation?.forComponent(comp.id).length||0;
    const toggle=chip.querySelector('[data-open-toggle]');
    toggle.hidden=!count;
    toggle.textContent=count>1?`Toggle (${count})`:'Toggle';
  },

  refreshInspector() {
    const comp=this.viewer?.asset?.registry.metadata(this.state.selectedComponent);
    if(comp)this.renderInspector(comp);
    this.renderSelectionChip(comp||null);
    this.syncMobileSheet();
  },

  syncMobileSheet() {
    if(this.state.activeMobileTab!=='diag')this.handleMobileTab(this.state.activeMobileTab);
  },

  /** Action list shown behind the mobile "Toggle" button. */
  actionListHtml(comp) {
    const controller=this.viewer?.articulation;
    const defs=controller?.forComponent(comp.id)||[];
    const rows=defs.map(def=>{
      const available=controller.availability(def.id), active=controller.isActive(def.id);
      return `<button type="button" class="ag-action-row${active?' is-active':''}" data-articulation="${escape(def.id)}"${available.enabled?'':' aria-disabled="true"'}>
        <span class="ag-action-main"><span class="ag-action-label">${escape(controller.actionLabel(def.id))}</span><small>${escape(def.label)}${available.enabled?'':` — ${escape(available.reason)}`}</small></span>
        <span class="ag-action-state" aria-hidden="true">${active?'On':'Off'}</span>
      </button>`;
    }).join('');
    const hidden=this.state.hiddenParts.has(comp.id);
    return rows+`<button type="button" class="ag-action-row ag-action-secondary" data-part-action="isolate"><span class="ag-action-main"><span class="ag-action-label">${this.state.viewMode==='isolate'?'Show whole vehicle':'Isolate this part'}</span></span></button>`+
      `<button type="button" class="ag-action-row ag-action-secondary" data-part-action="${hidden?'show':'hide'}"><span class="ag-action-main"><span class="ag-action-label">${hidden?'Show this part':'Hide this part'}</span></span></button>`;
  },

  renderInspector(comp) {
    this.container.querySelector('#ag-inspector-empty').style.display='none';
    const content=this.container.querySelector('#ag-inspector-content');content.style.display='block';
    const controller=this.viewer?.articulation;
    const actions=controller?.forComponent(comp.id)||[];
    const compact=this.isCompact();
    let actionsHtml='';
    if(actions.length&&compact){
      actionsHtml=`<div class="ag-toggle-block">
        <button type="button" class="ag-toggle-btn" data-toggle-actions aria-expanded="${this.state.actionsOpen}">
          <span>Toggle</span><small>${actions.length} action${actions.length>1?'s':''}</small>
        </button>
        ${this.state.actionsOpen?`<div class="ag-action-list" role="group" aria-label="Actions for ${escape(comp.name)}">${this.actionListHtml(comp)}</div>`:''}
      </div>`;
    } else if(actions.length){
      actionsHtml=`<p class="ag-action-hint"><strong>Right-click</strong> this part for ${actions.length} action${actions.length>1?'s':''}: ${actions.slice(0,3).map(def=>escape(controller.actionLabel(def.id).toLowerCase())).join(', ')}${actions.length>3?'…':''}</p>`;
    }
    const specs=comp.specs&&typeof comp.specs==='object'
      ? `<div class="ag-card-block"><h5>Specifications</h5><dl class="ag-spec-dl">${Object.entries(comp.specs).map(([k,v])=>`<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join('')}</dl></div>`
      : comp.specs?`<div class="ag-card-block"><h5>Specifications</h5><p>${escape(comp.specs)}</p></div>`:'';
    const block=(title,value,cls='')=>value?`<div class="ag-card-block ${cls}"><h5>${title}</h5><p>${escape(value)}</p></div>`:'';
    const sources=Array.isArray(comp.sources)&&comp.sources.length
      ? `<div class="ag-card-block"><h5>Sources</h5><ul class="ag-source-list">${comp.sources.map(source=>`<li><a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.label)}</a></li>`).join('')}</ul></div>`
      : block('Source',typeof comp.source==='string'?comp.source:'');
    content.innerHTML='<span class="ag-comp-badge">'+escape(comp.category || comp.subsystem || 'Unmapped geometry')+'</span><h4 class="ag-comp-name">'+escape(comp.name)+'</h4>'+
      (comp.location?`<div class="ag-comp-location">${escape(comp.location)}</div>`:'')+
      actionsHtml+
      block('Description',comp.description || comp.purpose)+
      block('Parent assembly',comp.parentAssembly)+
      specs+
      block('Maintenance',comp.maintenance)+
      block('Common failure modes',comp.failures,'ag-failure-box')+
      (comp.accuracyNote?`<p class="ag-asset-note ag-accuracy-note">${escape(comp.accuracyNote)}</p>`:'')+
      sources+
      (!comp.description&&!comp.purpose?'<p class="ag-asset-note">No component description was supplied with this asset.</p>':'')+
      '<button type="button" class="ag-btn-assistant" data-ask-component>Copy context for Assistant</button>';
    content.setAttribute('aria-live','polite');
  },

  /** Desktop context menu for a part (or the whole vehicle when none is hit). */
  openPartMenu({ component, clientX, clientY }) {
    const controller=this.viewer?.articulation;
    if(!this.viewer?.asset)return;
    const items=[];
    if(component){
      const defs=controller?.forComponent(component.id)||[];
      for(const def of defs){
        const available=controller.availability(def.id);
        items.push({ label: controller.actionLabel(def.id)+(available.enabled?'':' — '+available.reason.replace(/\.$/,'').toLowerCase()), disabled:!available.enabled, hint: available.reason||def.label, action:()=>this.runArticulation(def.id) });
      }
      if(!defs.length)items.push({ label:'No moving parts on this component', disabled:true });
      items.push({ separator:true });
      items.push({ label: this.state.viewMode==='isolate'?'Show whole vehicle':'Isolate this part', action:()=>this.runPartAction('isolate') });
      items.push({ label:'Hide this part', action:()=>this.runPartAction('hide') });
    }
    if(this.state.hiddenParts.size||this.state.hiddenLayers.size)items.push({ label:`Show all hidden (${this.viewer.hidden.size})`, action:()=>this.showAllLayers() });
    const quick=this.quickActions().filter(item=>item.available&&item.id!=='exterior');
    if(quick.length){
      items.push({ separator:true },{ heading:'Vehicle' });
      for(const q of quick)items.push({ label:q.label, action:()=>this.runQuickAction(q.id) });
    }
    items.push({ label:'Reset camera', action:()=>this.resetTransform() });
    openContextMenu({ x:clientX, y:clientY, title: component?.name || this.state.selectedVehicle?.model || 'Vehicle', items, className:'ag-context-menu', focusFirst:true, label:`Actions for ${component?.name||'vehicle'}` });
  },

  runPartAction(action) {
    const id=this.state.selectedComponent;
    if(action==='isolate'){ this.setViewMode(this.state.viewMode==='isolate'?'technical':'isolate'); this.refreshInspector(); return; }
    if(!id)return;
    const name=this.viewer?.asset?.registry.metadata(id)?.name||'Part';
    if(action==='hide'){ this.state.hiddenParts.add(id); this.applyVisibility(); this.setStatus(`${name} hidden. Use “Show all” in Model layers to restore it.`); }
    if(action==='show'){ this.state.hiddenParts.delete(id); this.applyVisibility(); this.refreshInspector(); this.setStatus(`${name} shown.`); }
  },

  runArticulation(id) {
    const controller=this.viewer?.articulation;
    if(!controller?.get(id))return;
    const available=controller.availability(id);
    if(!available.enabled){ this.setStatus(available.reason); return; }
    this.viewer.articulate(id);
    // On phones, drop the sheet so the movement is visible; the chip keeps the part at hand.
    if(this.isCompact()&&this.state.activeMobileTab!=='diag')this.showMobileTab('diag');
  },

  onArticulation({ definition, active }) {
    this.setStatus(`${definition.label} · ${active ? definition.actions?.on || 'Moved' : definition.actions?.off || 'Restored'}`);
    this.renderModelControls();
    this.refreshInspector();
    this.renderSectionNav();
    this.dispatchAssistantContext(this.viewer?.asset?.registry.metadata(this.state.selectedComponent)||null);
  },

  async askAssistant() {
    const comp=this.viewer?.asset?.registry.metadata(this.state.selectedComponent);
    if(!comp)return;
    const context=this.getAssistantContext(comp), version=this._version;
    window.dispatchEvent(new CustomEvent('toolbox:automobile:context',{detail:context}));
    try {
      await navigator.clipboard.writeText('Explain this component using only the supplied context. Do not assume the geometry is exact.\n'+JSON.stringify(context,null,2));
      if(version!==this._version)return;
      this.setStatus('Context copied. Paste it into Assistant to discuss this selection.');
    } catch {
      if(version!==this._version)return;
      this.setStatus('Clipboard unavailable. Allow clipboard access and try again.');
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
    const controller=this.viewer?.articulation;
    return {
      tool: 'automobile-guide',
      vehicle: {
        make: selectedVehicle?.manufacturer,
        manufacturer: selectedVehicle?.manufacturer,
        model: selectedVehicle?.model,
        generation: selectedVehicle?.generation,
        platform: selectedVehicle?.platform,
        year: selectedVehicle?.years || selectedVehicle?.year || null,
        engine: selectedVehicle?.engine?.code
      },
      visualization: this.assetMetadata || null,
      selectedComponent: comp || null,
      viewMode,
      section: selectedSection,
      movedParts: controller ? controller.list().filter(def=>controller.isActive(def.id)).map(def=>`${def.label}: ${def.actions?.on||'moved'}`) : [],
      component: comp ? {
        id: comp.id,
        name: comp.name,
        subsystem: comp.subsystem || comp.category,
        failures: comp.failures,
        maintenance: comp.maintenance,
        specs: comp.specs
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
      sheetBody.innerHTML = this.container.querySelector('#ag-col-left').innerHTML;
    } else if (tab === 'inspector') {
      sheetBody.innerHTML = this.container.querySelector('#ag-col-right').innerHTML;
    }
    sheetBody.querySelectorAll('[id]').forEach(element=>element.removeAttribute('id'));
    // Copied markup loses live input wiring; search belongs to the desktop list.
    sheetBody.querySelectorAll('input[type="search"]').forEach(input=>input.remove());
  },

  zoom(delta) { this.viewer?.zoom(delta); },
  resetTransform() { this.viewer?.reset(); },
  destroy() {
    this._version=(this._version||0)+1;
    clearTimeout(this._searchTimer);
    closeContextMenu();
    document.removeEventListener('click',this._onOutsideClick);
    this.container?.removeEventListener('click',this._onContainerClick);
    this.container?.removeEventListener('contextmenu',this._onContainerContextMenu);
    this.viewer?.dispose();this.viewer=null;
  }
};
