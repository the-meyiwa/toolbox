/**
 * Automotive Data Service Layer
 * Coordinates Toolbox-owned vehicle packages and local reference data.
 */

import { VehicleResolver, TechnicalProvider, ComponentProvider, VisualProvider } from './automotive-provider.js';


export class AutomotiveDataClient {
  constructor() {
    this.resolver = VehicleResolver;
    this.tech = TechnicalProvider;
    this.components = ComponentProvider;
    this.visuals = VisualProvider;
  }

  /**
   * Search the installed Toolbox Vehicle Package catalog.
   * @param {string} query
   * @returns {Promise<Array>}
   */
  async searchVehicles(query) {
    const results = await this.resolver.resolve(query);
    // Augment with sections for UI compatibility
    return results.map(r => ({
      ...r,
      supportedViews: ['technical', 'xray', 'isolate'],
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

  async getVehicleAsset(vehicle) {
    return this.visuals.getVehicleAsset(vehicle);
  }
}
export const autoClient = new AutomotiveDataClient();
