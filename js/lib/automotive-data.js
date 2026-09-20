/**
 * Automotive Data Service Layer
 * Coordinates authoritative vehicle specifications, vector blueprints,
 * and external automotive API lookups using provider abstractions.
 */

import { VehicleResolver, TechnicalProvider, ComponentProvider, VisualProvider } from './automotive-provider.js';
import { AssetViewer } from './automotive-diagrams.js';

export class AutomotiveDataClient {
  constructor() {
    this.resolver = VehicleResolver;
    this.tech = TechnicalProvider;
    this.components = ComponentProvider;
    this.visuals = VisualProvider;
  }

  /**
   * Search vehicle database (via NHTSA backend proxy)
   * @param {string} query
   * @returns {Promise<Array>}
   */
  async searchVehicles(query) {
    if (!query) {
      return [];
    }
    const results = await this.resolver.resolve(query);
    // Augment with sections for UI compatibility
    return results.map(r => ({
      ...r,
      supportedViews: ['chassis', 'profile', 'interior'],
      sections: this.components.getSystems(),
      components: this.components.getComponents(r.id)
    }));
  }

  /**
   * Retrieve full vehicle details by ID
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async getVehicleDetails(id, manufacturer, model) {
    const specs = await this.tech.getSpecs(id, `${manufacturer} ${model}`);
    return specs;
  }

  /**
   * Render vector technical diagram using AssetViewer
   * @param {Object} vehicle - Full vehicle object
   * @param {'chassis'|'profile'|'interior'} viewMode
   * @param {string|null} activeSection
   * @param {string|null} activeComponentId
   * @returns {Promise<string>} SVG markup or Error State
   */
  async getVehicleDiagram(vehicle, viewMode = 'chassis', activeSection = null, activeComponentId = null) {
    if (!vehicle) return '<div class="ag-empty-diagram">No vehicle loaded.</div>';

    // Query visual provider for asset URL securely
    const assetCheck = await this.visuals.getAssetUrl(vehicle.id, viewMode);

    if (!assetCheck.available) {
      // Return honest error state without fabricating diagram
      return AssetViewer.renderUnavailableState(vehicle, assetCheck.error);
    }

    // Load actual asset
    return await AssetViewer.loadAndRenderAsset(assetCheck.url, vehicle, viewMode, activeSection, activeComponentId);
  }
}

export const autoClient = new AutomotiveDataClient();
