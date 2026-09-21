/**
 * Automotive Provider Layer
 * Abstracts data retrieval, normalization, and visual asset loading
 * from backend proxies and genuine external providers.
 */

export class VehicleResolver {
  /**
   * Resolves natural language query into a canonical VehicleRecord
   * via backend proxy to NHTSA/etc.
   */
  static async resolve(query) {
    if (!query) return [];
    try {
      const res = await fetch(`/api/automotive/resolve?q=${encodeURIComponent(query)}`);
      if (!res.ok) return [];
      const data = await res.json();
      
      const nhtsaRecords = (data.results || []).map(r => this.normalizeRecord(r));
      
      if (nhtsaRecords.length > 0) {
        if (data.meta && data.meta.title) {
           nhtsaRecords[0].meta = data.meta;
        }
        return nhtsaRecords;
      }
      
      // If NHTSA returns nothing but Wikipedia found something (e.g. general car queries)
      if (data.meta && data.meta.title) {
        return [{
          id: `wiki-${data.meta.title}`,
          manufacturer: data.meta.title.split(' ')[0],
          model: data.meta.title.split(' ').slice(1).join(' '),
          generation: 'General Overview',
          variant: 'Standard',
          years: 'N/A',
          status: 'metadata_only',
          meta: data.meta
        }];
      }
      return [];
    } catch (e) {
      console.error('Vehicle resolution failed:', e);
      return [];
    }
  }

  static normalizeRecord(apiResult) {
    return {
      id: `nhtsa-${apiResult.Model_ID}`,
      manufacturer: apiResult.Make_Name,
      model: apiResult.Model_Name,
      generation: 'Standard Spec',
      variant: 'Base',
      years: 'Current',
      status: 'metadata_only'
    };
  }
}

export class TechnicalProvider {
  /**
   * Retrieves verified technical specifications from the backend proxy or meta
   */
  static async getSpecs(vehicleId, queryContext) {
    // Return empty but real looking struct, the UI should use meta.extract instead if available
    // We will not hardcode fake manufacturer specs.
    return {
      bodyStyle: 'Unavailable',
      platform: 'Unavailable',
      layout: 'Unavailable',
      curbWeight: 'Unavailable',
      wheelbase: 'Unavailable',
      dimensions: 'Unavailable',
      engine: { code: 'N/A', type: 'N/A', output: 'N/A' },
      transmission: { code: 'N/A', type: 'N/A' },
      chassis: { frontSuspension: 'N/A', rearSuspension: 'N/A' }
    };
  }
}

export class ComponentProvider {
  /**
   * Defines standard semantic sections and retrieves component metadata
   * (Ideally this would also come from a backend graph database, for now we return structural shells)
   */
  static getSystems() {
    return ['chassis', 'engine', 'front-suspension', 'steering', 'drivetrain', 'brakes', 'rear-suspension', 'exhaust-fuel', 'cabin', 'cockpit'];
  }

  static getComponents(vehicleId) {
    return []; // Requires licensed diagnostic graph mapping
  }
}

export class VisualProvider {
  static async getVehicleAsset(vehicle) {
    const response = await fetch('/automobile/assets.json');
    if (!response.ok) throw new Error('The vehicle asset catalog could not be loaded.');
    const catalog = await response.json();
    const exact = catalog.vehicles?.[vehicle?.id];
    const generic = catalog.representative?.[vehicle?.bodyStyle?.toLowerCase()];
    const descriptor = exact || generic || catalog.development;
    if (!descriptor?.modelUrl) throw new Error('No 3D asset is available for this vehicle.');
    const metadata = { ...descriptor.metadata, accuracy: descriptor.metadata?.accuracy || (generic ? 'representative' : 'unverified') };
    return { ...descriptor, metadata, components: metadata.accuracy === 'development' ? [] : [...(descriptor.components || []), ...(vehicle?.components || [])] };
  }
}
