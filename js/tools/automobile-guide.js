/**
 * Automobile Guide — Technical Vehicle Reference & Exploration System
 * Features:
 * - 3-Column balanced desktop workspace with dominant vector visualization
 * - Multi-generational vehicle database with technical specifications
 * - Interactive 2D vector blueprints: Chassis Top-Down, Profile Cutaway, Interior Cockpit
 * - Component diagnostics inspector with failure modes & related component graph
 * - Touch-optimized mobile layout with floating bottom sheet
 * - Assistant context bridge
 */

import { autoClient } from '../lib/automotive-data.js';

export default {
  render(container) {
    this.destroy();
    this.container = container;
    this.state = {
      vehicles: [],
      selectedVehicle: null,
      selectedSection: null,
      selectedComponent: null,
      viewMode: 'chassis', // 'chassis' | 'profile' | 'interior'
      zoom: 1,
      panX: 0,
      panY: 0,
      isPanning: false,
      startX: 0,
      startY: 0,
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
        .ag-svg-container {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.08s ease-out;
        }
        .ag-technical-svg {
          width: 100%;
          height: 100%;
          max-height: 100%;
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

        /* SVG Interactive Component Styles */
        .diag-comp {
          cursor: pointer;
          transition: all 0.2s ease;
          outline: none;
        }
        .diag-comp:hover path,
        .diag-comp:hover rect,
        .diag-comp:hover circle {
          filter: drop-shadow(0 0 6px var(--accent, #3b82f6));
          stroke-width: 3 !important;
        }
        .diag-comp.is-section-focused path,
        .diag-comp.is-section-focused rect {
          filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.6));
        }
        .diag-comp.is-active path,
        .diag-comp.is-active rect,
        .diag-comp.is-active circle {
          stroke: #ef4444 !important;
          stroke-width: 3.5 !important;
          filter: drop-shadow(0 0 10px rgba(239, 68, 68, 0.8)) !important;
        }

        /* Pin Markers */
        .ag-pin {
          cursor: pointer;
          transition: transform 0.15s ease;
        }
        .ag-pin-core {
          fill: var(--accent, #3b82f6);
          transition: fill 0.15s ease;
        }
        .ag-pin-ring {
          fill: none;
          stroke: var(--accent, #3b82f6);
          stroke-width: 1.5;
          opacity: 0.6;
          animation: ag-pulse 2s infinite;
        }
        .ag-pin.is-selected .ag-pin-core {
          fill: #ef4444;
        }
        .ag-pin.is-selected .ag-pin-ring {
          stroke: #ef4444;
          opacity: 0.9;
        }
        .ag-pin-label {
          fill: #ffffff;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-shadow: 0 1px 3px rgba(0,0,0,0.8);
          pointer-events: none;
        }
        @keyframes ag-pulse {
          0% { r: 8px; opacity: 0.8; }
          50% { r: 16px; opacity: 0.2; }
          100% { r: 8px; opacity: 0.8; }
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
              <button type="button" class="ag-view-btn active" data-view="chassis">Chassis X-Ray</button>
              <button type="button" class="ag-view-btn" data-view="profile">Cutaway Profile</button>
              <button type="button" class="ag-view-btn" data-view="interior">Cockpit Plan</button>
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
                <span>Vehicle Subsystems</span>
              </div>
              <div class="ag-nav-list" id="ag-nav-list">
                <!-- Section items dynamically populated -->
              </div>
            </div>
          </aside>

          <!-- Center Column: Dominant Vector Blueprint Visualization -->
          <main class="ag-col-center" id="ag-canvas-col">
            <div class="ag-floating-tools">
              <button type="button" class="ag-tool-btn" id="ag-zoom-in" title="Zoom In">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
              <button type="button" class="ag-tool-btn" id="ag-zoom-out" title="Zoom Out">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
              <button type="button" class="ag-tool-btn" id="ag-zoom-reset" title="Reset View">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
              </button>
            </div>

            <div class="ag-canvas-viewport">
              <div class="ag-svg-container" id="ag-svg-container">
                <div style="color:var(--text-muted); font-size:0.9rem;">Initializing technical blueprint engine…</div>
              </div>
            </div>

            <div class="ag-view-status" id="ag-view-status">
              <span class="ag-status-indicator"></span>
              <span id="ag-status-text">Ready • High-Precision 2D Blueprint</span>
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
                <p style="margin:4px 0 0; font-size:0.78rem; opacity:0.8;">Click any mechanical component in the blueprint to inspect engineering specs, diagnostics, and failure modes.</p>
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
          <button type="button" class="ag-mob-btn active" data-mob-tab="diag">Blueprint</button>
          <button type="button" class="ag-mob-btn" data-mob-tab="specs">Vehicle Specs</button>
          <button type="button" class="ag-mob-btn" data-mob-tab="inspector">Component</button>
        </nav>
      </div>
    `;

    this.bindEvents();
    this.loadInitialVehicle();
  },

  async loadInitialVehicle() {
    const version = this._version;
    const vehicles = await autoClient.searchVehicles('lexus gx');
    if (version !== this._version) return;
    this.state.vehicles = vehicles;
    // Default to the first result
    const initial = this.state.vehicles[0];
    if (initial) {
      this.selectVehicle(initial);
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
        this.updateBlueprint();
      }
    });

    // Zoom and pan canvas controls
    const canvasCol = this.container.querySelector('#ag-canvas-col');
    this.container.querySelector('#ag-zoom-in').addEventListener('click', () => this.zoom(0.2));
    this.container.querySelector('#ag-zoom-out').addEventListener('click', () => this.zoom(-0.2));
    this.container.querySelector('#ag-zoom-reset').addEventListener('click', () => this.resetTransform());

    // Mouse drag pan
    canvasCol.addEventListener('mousedown', (e) => {
      if (e.target.closest('.ag-tool-btn') || e.target.closest('.ag-floating-tools')) return;
      this.state.isPanning = true;
      this.state.startX = e.clientX - this.state.panX;
      this.state.startY = e.clientY - this.state.panY;
    });

    this._onPanMove = (e) => {
      if (!this.state.isPanning) return;
      this.state.panX = e.clientX - this.state.startX;
      this.state.panY = e.clientY - this.state.startY;
      this.applyTransform();
    };
    window.addEventListener('mousemove', this._onPanMove);

    this._onPanEnd = () => {
      this.state.isPanning = false;
    };
    window.addEventListener('mouseup', this._onPanEnd);

    // Mouse wheel zoom
    canvasCol.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.12 : 0.12;
      this.zoom(delta);
    }, { passive: false });

    // Touch support (pan & pinch)
    canvasCol.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.state.isPanning = true;
        this.state.startX = e.touches[0].clientX - this.state.panX;
        this.state.startY = e.touches[0].clientY - this.state.panY;
      }
    }, { passive: true });

    canvasCol.addEventListener('touchmove', (e) => {
      if (!this.state.isPanning || e.touches.length !== 1) return;
      this.state.panX = e.touches[0].clientX - this.state.startX;
      this.state.panY = e.touches[0].clientY - this.state.startY;
      this.applyTransform();
    }, { passive: true });

    canvasCol.addEventListener('touchend', () => {
      this.state.isPanning = false;
    });

    // Delegated Component Click inside SVG
    const svgContainer = this.container.querySelector('#ag-svg-container');
    svgContainer.addEventListener('click', (e) => {
      const compEl = e.target.closest('.diag-comp') || e.target.closest('.ag-pin');
      if (compEl) {
        const compId = compEl.getAttribute('data-comp-id');
        this.selectComponent(compId);
      }
    });

    // Section Nav Click
    const navList = this.container.querySelector('#ag-nav-list');
    navList.addEventListener('click', (e) => {
      const item = e.target.closest('.ag-nav-item');
      if (item) {
        const sec = item.getAttribute('data-section');
        this.selectSection(sec);
      }
    });

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
      <div class="ag-search-item" data-vehicle-id="${v.id}">
        <div>
          <div class="ag-search-item-title">${v.manufacturer} ${v.model} <span style="font-weight:400; opacity:0.8;">${v.generation}</span></div>
          <div class="ag-search-item-meta">${v.variant || v.bodyStyle} • ${v.years}</div>
        </div>
        <span class="ag-search-badge">${v.status === 'metadata_only' ? 'NHTSA' : 'BLUEPRINT'}</span>
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
          this.container.querySelector('#ag-search-input').value = `${v.manufacturer} ${v.model}`;
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

    // Update Blueprint
    this.updateBlueprint();

    // Clear Inspector
    this.clearInspector();

    // Reset View
    this.resetTransform();
  },

  renderVehicleInfo(vehicle) {
    const hero = this.container.querySelector('#ag-car-hero');
    hero.innerHTML = `
      <h3 class="ag-car-name">${vehicle.manufacturer} ${vehicle.model}</h3>
      <span class="ag-car-variant">${vehicle.generation} • ${vehicle.variant || ''}</span>
      <span class="ag-car-platform">${vehicle.platform || ''}</span>
    `;

    const specGrid = this.container.querySelector('#ag-spec-grid');
    if (vehicle.meta && vehicle.meta.extract) {
      specGrid.innerHTML = `
        <div style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4; padding: 4px 0 12px; font-style: italic;">
          ${vehicle.meta.extract.substring(0, 250)}...
        </div>
        <div class="ag-spec-row"><span class="ag-spec-label">Years</span><span class="ag-spec-val">${vehicle.years || 'N/A'}</span></div>
        <div class="ag-spec-row"><span class="ag-spec-label">Body Style</span><span class="ag-spec-val">${vehicle.bodyStyle || 'N/A'}</span></div>
      `;
    } else {
      specGrid.innerHTML = `
        <div class="ag-spec-row"><span class="ag-spec-label">Years</span><span class="ag-spec-val">${vehicle.years || 'N/A'}</span></div>
        <div class="ag-spec-row"><span class="ag-spec-label">Body Style</span><span class="ag-spec-val">${vehicle.bodyStyle || 'N/A'}</span></div>
        <div class="ag-spec-row"><span class="ag-spec-label">Drivetrain</span><span class="ag-spec-val">${vehicle.layout || 'N/A'}</span></div>
        <div class="ag-spec-row"><span class="ag-spec-label">Engine</span><span class="ag-spec-val">${vehicle.engine?.code || 'N/A'} (${vehicle.engine?.output || ''})</span></div>
        <div class="ag-spec-row"><span class="ag-spec-label">Transmission</span><span class="ag-spec-val">${vehicle.transmission?.code || 'N/A'}</span></div>
        <div class="ag-spec-row"><span class="ag-spec-label">Front Susp.</span><span class="ag-spec-val">${vehicle.chassis?.frontSuspension?.split('with')[0] || 'Independent'}</span></div>
        <div class="ag-spec-row"><span class="ag-spec-label">Rear Susp.</span><span class="ag-spec-val">${vehicle.chassis?.rearSuspension?.split('with')[0] || 'Independent'}</span></div>
        <div class="ag-spec-row"><span class="ag-spec-label">Curb Weight</span><span class="ag-spec-val">${vehicle.curbWeight || 'N/A'}</span></div>
        <div class="ag-spec-row"><span class="ag-spec-label">Wheelbase</span><span class="ag-spec-val">${vehicle.wheelbase || 'N/A'}</span></div>
      `;
    }
  },

  renderSectionNav(vehicle) {
    const navList = this.container.querySelector('#ag-nav-list');
    const sections = [
      { id: 'chassis', label: 'Chassis & Structural Frame' },
      { id: 'engine', label: 'Engine & Forced Induction' },
      { id: 'front-suspension', label: 'Front Suspension & Arms' },
      { id: 'steering', label: 'Steering Gear & Tie Rods' },
      { id: 'drivetrain', label: 'Transmission & Drivetrain' },
      { id: 'brakes', label: 'Braking System (Rotors & Calipers)' },
      { id: 'rear-suspension', label: 'Rear Axle & Suspension' },
      { id: 'exhaust-fuel', label: 'Exhaust System & Fuel Tank' },
      { id: 'cabin', label: 'Cabin & Ergonomic Seating' },
      { id: 'cockpit', label: 'Cockpit, Instruments & Displays' }
    ];

    navList.innerHTML = sections.map(s => `
      <div class="ag-nav-item" data-section="${s.id}">
        <span class="ag-nav-dot"></span>
        <span>${s.label}</span>
      </div>
    `).join('');
  },

  async updateBlueprint() {
    const version = this._version;
    const request = this._diagramRequest = (this._diagramRequest || 0) + 1;
    const { selectedVehicle, viewMode, selectedSection, selectedComponent } = this.state;
    if (!selectedVehicle) return;

    const container = this.container.querySelector('#ag-svg-container');
    const svgMarkup = await autoClient.getVehicleDiagram(
      selectedVehicle,
      viewMode,
      selectedSection,
      selectedComponent
    );
    if (version !== this._version || request !== this._diagramRequest) return;
    container.innerHTML = svgMarkup;

    // Update status bar
    const statusText = this.container.querySelector('#ag-status-text');
    if (statusText) {
      statusText.textContent = `${selectedVehicle.manufacturer} ${selectedVehicle.model} (${selectedVehicle.generation}) • ${viewMode.toUpperCase()} VIEW`;
    }
  },

  selectSection(sectionId) {
    this.state.selectedSection = sectionId;

    // Highlight nav item
    this.container.querySelectorAll('.ag-nav-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-section') === sectionId);
    });

    // Focus on first component in this section if available
    const comp = (this.state.selectedVehicle.components || []).find(c => c.section === sectionId);
    if (comp) {
      this.selectComponent(comp.id);
    } else {
      this.updateBlueprint();
    }
  },

  selectComponent(compId) {
    this.state.selectedComponent = compId;
    const { selectedVehicle } = this.state;
    if (!selectedVehicle) return;

    const comp = (selectedVehicle.components || []).find(c => c.id === compId);
    if (!comp) return;

    // Highlight section in nav
    if (comp.section) {
      this.state.selectedSection = comp.section;
      this.container.querySelectorAll('.ag-nav-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-section') === comp.section);
      });
    }

    // Re-render blueprint highlights
    this.updateBlueprint();

    // Render Inspector Panel
    this.renderInspector(comp);

    // Bridge context to Toolbox Assistant
    this.dispatchAssistantContext(comp);
  },

  renderInspector(comp) {
    const emptyState = this.container.querySelector('#ag-inspector-empty');
    const content = this.container.querySelector('#ag-inspector-content');
    emptyState.style.display = 'none';
    content.style.display = 'block';

    const relatedChips = (comp.related || []).map(relId => {
      const relComp = (this.state.selectedVehicle.components || []).find(c => c.id === relId);
      const label = relComp ? relComp.name.split(' ')[0] : relId;
      return `<button type="button" class="ag-chip" data-jump-comp="${relId}">${label}</button>`;
    }).join('');

    content.innerHTML = `
      <span class="ag-comp-badge">${comp.subsystem || 'Component'}</span>
      <h4 class="ag-comp-name">${comp.name}</h4>
      <div class="ag-comp-location">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        ${comp.location || 'Vehicle Assembly'}
      </div>

      <div class="ag-card-block">
        <h5>Engineering Function</h5>
        <p>${comp.purpose}</p>
      </div>

      <div class="ag-card-block">
        <h5>Technical Specifications</h5>
        <p>${comp.specs}</p>
      </div>

      <div class="ag-card-block ag-failure-box">
        <h5>Common Failure Modes &amp; Symptoms</h5>
        <p>${comp.failures || 'No common premature failure modes catalogued.'}</p>
      </div>

      ${relatedChips ? `
        <div style="margin-top:12px;">
          <h5 style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted); margin:0 0 6px 0;">Related Subassemblies</h5>
          <div class="ag-related-chips">${relatedChips}</div>
        </div>
      ` : ''}

      <button type="button" class="ag-btn-assistant" id="ag-btn-ask-assistant">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        Ask Assistant About This Part
      </button>
    `;

    // Click handler for related chips
    content.querySelectorAll('.ag-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const targetId = chip.getAttribute('data-jump-comp');
        this.selectComponent(targetId);
      });
    });

    // Ask Assistant click handler
    const askBtn = content.querySelector('#ag-btn-ask-assistant');
    if (askBtn) {
      askBtn.addEventListener('click', () => {
        const query = `Tell me more about the ${comp.name} on the ${this.state.selectedVehicle.manufacturer} ${this.state.selectedVehicle.model} (${this.state.selectedVehicle.generation}). What are the key maintenance tips?`;
        window.dispatchEvent(new CustomEvent('toolbox:assistant:query', {
          detail: { query, context: this.getAssistantContext(comp) }
        }));
      });
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
        manufacturer: selectedVehicle.manufacturer,
        model: selectedVehicle.model,
        generation: selectedVehicle.generation,
        platform: selectedVehicle.platform,
        engine: selectedVehicle.engine?.code
      },
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
  },

  zoom(delta) {
    this.state.zoom = Math.max(0.4, Math.min(3.5, this.state.zoom + delta));
    this.applyTransform();
  },

  resetTransform() {
    this.state.zoom = 1;
    this.state.panX = 0;
    this.state.panY = 0;
    this.applyTransform();
  },

  destroy() {
    this._version = (this._version || 0) + 1;
    clearTimeout(this._searchTimer);
    document.removeEventListener('click', this._onOutsideClick);
    window.removeEventListener('mousemove', this._onPanMove);
    window.removeEventListener('mouseup', this._onPanEnd);
  },

  applyTransform() {
    const svgContainer = this.container.querySelector('#ag-svg-container');
    if (svgContainer) {
      svgContainer.style.transform = `translate(${this.state.panX}px, ${this.state.panY}px) scale(${this.state.zoom})`;
    }
  }
};
