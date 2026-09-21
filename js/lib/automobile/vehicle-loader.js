import { Box3, Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ComponentRegistry } from './component-registry.js';

export function disposeObject(root) {
  const resources = new Set();
  root?.traverse(node => {
    if (node.geometry) resources.add(node.geometry);
    for (const material of [].concat(node.material || [])) {
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
      resources.add(material);
    }
    if (node.skeleton) resources.add(node.skeleton);
  });
  for (const resource of resources) { resource.source?.data?.close?.(); resource.dispose(); }
}

export class VehicleLoader {
  constructor({ maxTriangles = 500000 } = {}) { this.loader = new GLTFLoader(); this.maxTriangles = maxTriangles; }
  async load({ modelUrl, componentMap = {}, componentMapUrl, components = [], metadata = {} }) {
    if (!modelUrl) throw new Error('No 3D asset is configured for this vehicle.');
    if (componentMapUrl) {
      const response = await fetch(componentMapUrl);
      if (!response.ok) throw new Error('The component mapping file could not be loaded.');
      componentMap = { ...await response.json(), ...componentMap };
    }
    let gltf;
    try { gltf = await this.loader.loadAsync(modelUrl); }
    catch (cause) { throw new Error('The 3D model could not be loaded. Check its URL, file format and required decoders.', { cause }); }
    const model = gltf.scene;
    const root = new Group();
    root.add(model);
    let triangles = 0;
    model.traverse(node => {
      if (node.isMesh) triangles += (node.geometry.index?.count || node.geometry.attributes.position?.count || 0) / 3;
    });
    if (triangles > this.maxTriangles) {
      disposeObject(root);
      throw new Error('This model exceeds the viewer geometry budget. Supply a simplified GLB with at most '+this.maxTriangles.toLocaleString()+' triangles.');
    }
    const bounds = new Box3().setFromObject(model);
    const size = bounds.getSize(new Vector3());
    if (bounds.isEmpty() || !Number.isFinite(size.length()) || size.length() === 0) {
      disposeObject(root);
      throw new Error('This asset contains no usable geometry.');
    }
    // Wrapper transforms preserve authored node transforms for future exploded views.
    model.position.sub(bounds.getCenter(new Vector3()));
    root.scale.setScalar(5 / Math.max(size.x, size.y, size.z));
    const registry = new ComponentRegistry(root, componentMap, components);
    if (!registry.list().length) { disposeObject(root); throw new Error('This asset has no mesh components.'); }
    return { root, registry, metadata, statistics: { triangles } };
  }
}
