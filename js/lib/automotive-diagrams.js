/**
 * Automotive Asset Viewer Engine
 * Replaces the old parametric SVG generator. This engine is responsible
 * for loading genuine external SVG/GLB assets fetched securely via the backend,
 * injecting them, and binding interactive diagnostic nodes.
 */

export class AssetViewer {
  /**
   * Render the honest "Asset Unavailable / Pending Licensing" state.
   */
  static renderUnavailableState(vehicle, errorMsg) {
    if (vehicle.meta && vehicle.meta.image) {
      return `
        <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: url('data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'40\\' height=\\'40\\'><path d=\\'M40 0L0 0 0 40\\' fill=\\'none\\' stroke=\\'%234a5568\\' stroke-width=\\'0.5\\' opacity=\\'0.3\\'/></svg>');">
          <img src="${vehicle.meta.image}" alt="${vehicle.manufacturer} ${vehicle.model}" style="max-width: 80%; max-height: 80%; object-fit: contain; border-radius: 8px; box-shadow: var(--shadow-lg);" />
        </div>
      `;
    }

    return `
      <svg viewBox="0 0 1000 500" class="ag-technical-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="diag-grid-unavail" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border, #2d3748)" stroke-width="0.75" opacity="0.3" />
          </pattern>
        </defs>
        <rect width="1000" height="500" fill="url(#diag-grid-unavail)" />
        
        <rect x="250" y="140" width="500" height="220" rx="12" fill="var(--bg-card, #1a202c)" stroke="var(--border, #4a5568)" stroke-width="1.5" />
        
        <circle cx="500" cy="200" r="30" fill="none" stroke="#ef4444" stroke-width="2" stroke-dasharray="4,3" />
        <path d="M 490 190 L 510 210 M 510 190 L 490 210" stroke="#ef4444" stroke-width="3" stroke-linecap="round" />
        
        <text x="500" y="260" fill="var(--text, #e2e8f0)" font-size="16" font-weight="700" text-anchor="middle">
          Visual Asset Unavailable
        </text>
        <text x="500" y="290" fill="var(--text-muted, #a0aec0)" font-size="13" text-anchor="middle">
          ${errorMsg || 'This diagram is pending provider licensing.'}
        </text>
        <text x="500" y="320" fill="var(--accent, #3182ce)" font-size="12" font-weight="600" text-anchor="middle">
          ${vehicle.manufacturer} ${vehicle.model} • Strict Architectural Compliance Mode
        </text>
      </svg>
    `;
  }

  /**
   * Fetches the real SVG asset from the backend URL and injects it.
   * If it's a GLB, this would initialize Three.js, but we're starting with SVGs.
   */
  static async loadAndRenderAsset(assetUrl, vehicle, viewMode, activeSection, activeComponentId) {
    try {
      const res = await fetch(assetUrl);
      if (!res.ok) throw new Error('Asset load failed');
      let svgMarkup = await res.text();
      
      // Inject interaction classes if we had a mapped semantic ID in the SVG
      // (e.g., dynamically adding .is-active to <g id="engine">)
      if (activeSection || activeComponentId) {
         // This is a naive injection for demonstration. Real implementation would parse the DOM securely.
         // Given we don't have real SVGs currently, this will mostly hit the fallback.
      }

      return svgMarkup;
    } catch (err) {
      console.warn('Asset viewer failed to mount SVG:', err);
      return this.renderUnavailableState(vehicle, 'Failed to download asset from secure provider layer.');
    }
  }
}
