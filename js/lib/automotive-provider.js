/** Toolbox-owned static vehicle-package catalog. No runtime provider calls. */
import { loadVehiclePackage } from './automobile/vehicle-package.js';

let catalogPromise;
async function loadCatalog() {
  if (!catalogPromise) catalogPromise = fetch('/automobile/catalog.json').then(response => {
    if (!response.ok) throw new Error('The local vehicle catalog could not be loaded.');
    return response.json();
  });
  return catalogPromise;
}

export class VehicleResolver {
  static async resolve(query = '') {
    const catalog = await loadCatalog();
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return catalog.vehicles.filter(vehicle => {
      const haystack = [vehicle.id, vehicle.make, vehicle.model, vehicle.year, ...(vehicle.aliases || [])].join(' ').toLowerCase();
      return terms.every(term => haystack.includes(term));
    }).map(vehicle => ({
      id: vehicle.id, manufacturer: vehicle.make, model: vehicle.model,
      generation: vehicle.generation || 'Unavailable', variant: vehicle.variant || 'Unavailable',
      years: vehicle.year ? String(vehicle.year) : 'Unavailable', bodyStyle: vehicle.bodyStyle || 'Unavailable',
      status: 'toolbox-package', manifestUrl: vehicle.manifest
    }));
  }
}

export class TechnicalProvider {
  static async getSpecs(vehicleId) {
    const catalog = await loadCatalog();
    return catalog.vehicles.find(item => item.id === vehicleId)?.specifications || {};
  }
}

export class ComponentProvider {
  static getSystems() { return []; }
  static getComponents() { return []; }
}

export class VisualProvider {
  static async getVehicleAsset(vehicle) {
    const catalog = await loadCatalog();
    const entry = vehicle
      ? catalog.vehicles.find(item => item.id === vehicle.id)
      : catalog.vehicles.find(item => item.id === catalog.defaultVehicleId);
    if (!entry) throw new Error('No local vehicle package is available.');
    return loadVehiclePackage(entry.manifest);
  }
}
