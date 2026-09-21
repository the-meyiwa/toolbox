const PACKAGE_VERSION = 1;
const ACCURACY = new Set(['exact', 'generation', 'representative', 'development']);

function requireString(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Vehicle package is missing ${field}.`);
  return value.trim();
}

function resolveAssetUrl(manifestUrl, value) {
  return new URL(value, new URL(manifestUrl, window.location.href)).href;
}

export function validateVehiclePackage(manifest) {
  if (!manifest || typeof manifest !== 'object') throw new Error('Vehicle package manifest is invalid.');
  if (manifest.schemaVersion !== PACKAGE_VERSION) throw new Error(`Unsupported vehicle package schema ${manifest.schemaVersion}.`);
  const vehicle = manifest.vehicle || {};
  for (const field of ['id', 'make', 'model', 'displayName']) requireString(vehicle[field], `vehicle.${field}`);
  if (!ACCURACY.has(vehicle.accuracy)) throw new Error('Vehicle package has an invalid accuracy value.');
  const license = manifest.license || {};
  for (const field of ['spdx', 'creator', 'sourceUrl', 'licenseUrl']) requireString(license[field], `license.${field}`);
  if (!Array.isArray(manifest.layers) || !manifest.layers.length) throw new Error('Vehicle package contains no model layers.');
  const layerIds = new Set();
  for (const layer of manifest.layers) {
    requireString(layer.id, 'layers[].id');
    if (layer.available !== false) requireString(layer.glb, 'layers[].glb');
    if (layerIds.has(layer.id)) throw new Error(`Vehicle package repeats layer ${layer.id}.`);
    layerIds.add(layer.id);
  }
  if (!Array.isArray(manifest.components)) throw new Error('Vehicle package components must be an array.');
  const componentIds = new Set();
  for (const component of manifest.components) {
    requireString(component.id, 'components[].id'); requireString(component.label, 'components[].label');
    if (componentIds.has(component.id)) throw new Error(`Vehicle package repeats component ${component.id}.`);
    componentIds.add(component.id);
  }
  if (!manifest.meshMappings || typeof manifest.meshMappings !== 'object') throw new Error('Vehicle package meshMappings are missing.');
  for (const [meshName, componentId] of Object.entries(manifest.meshMappings)) {
    requireString(meshName, 'meshMappings key');
    if (!componentIds.has(componentId)) throw new Error(`Mesh ${meshName} references unknown component ${componentId}.`);
  }
  return manifest;
}

export async function loadVehiclePackage(manifestUrl, preferredLayer = 'exterior') {
  const response = await fetch(manifestUrl);
  if (!response.ok) throw new Error('The vehicle package manifest could not be loaded.');
  const manifest = validateVehiclePackage(await response.json());
  const layer = manifest.layers.find(item => item.id === preferredLayer && item.available !== false)
    || manifest.layers.find(item => item.available !== false);
  if (!layer) throw new Error('This package has no available model layer.');
  const componentsById = new Map(manifest.components.map(item => [item.id, item]));
  const componentMap = Object.fromEntries(Object.entries(manifest.meshMappings).map(([meshName, id]) => {
    const component = componentsById.get(id);
    return [meshName, {
      id: component.id, name: component.label, category: component.category || 'Uncategorized',
      description: component.description, source: component.source,
      availability: component.availability || 'available'
    }];
  }));
  return {
    modelUrl: resolveAssetUrl(manifestUrl, layer.glb), componentMap,
    components: manifest.components.map(component => ({ ...component, name: component.label })),
    metadata: {
      accuracy: manifest.vehicle.accuracy, label: manifest.vehicle.displayName,
      description: manifest.notes || 'No package notes supplied.', source: manifest.license.sourceUrl,
      license: manifest.license.spdx, creator: manifest.license.creator,
      packageVersion: manifest.packageVersion, layer: layer.id,
      availableLayers: manifest.layers.filter(item => item.available !== false).map(item => item.id),
      unavailableLayers: manifest.layers.filter(item => item.available === false).map(item => item.id),
      attribution: manifest.license.attribution
    },
    manifest
  };
}
