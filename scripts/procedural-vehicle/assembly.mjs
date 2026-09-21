/** Scene-graph builder that records component mappings and hinge pivots. */
import { triangleCount } from './geometry.mjs';

export class Assembly {
  constructor(rootName = 'tbx_vehicle') {
    this.root = { name: rootName, world: [0, 0, 0], translation: [0, 0, 0], children: [] };
    this.mappings = {};
    this.counts = new Map();
    this.pivots = new Map();
    this.triangles = new Map();
  }

  /** Create a transform node whose origin is a hinge / slide origin in vehicle space. */
  pivot(name, world, parent = this.root) {
    if (!/^tbx_pivot_[a-z0-9_]+$/.test(name)) throw new Error(`Invalid pivot name ${name}`);
    if (this.pivots.has(name)) throw new Error(`Duplicate pivot ${name}`);
    const node = { name, world: [...world], translation: world.map((v, i) => v - parent.world[i]), children: [] };
    parent.children.push(node);
    this.pivots.set(name, node);
    return node;
  }

  /** Add geometry authored in vehicle space as a mesh of `componentId` under `parent`. */
  add(componentId, geometry, parent = this.root) {
    if (!geometry) return null;
    if (!/^[a-z0-9][a-z0-9_]*$/.test(componentId)) throw new Error(`Invalid component id ${componentId}`);
    const n = (this.counts.get(componentId) || 0) + 1;
    this.counts.set(componentId, n);
    const name = `tbx_${componentId}_${n}`;
    geometry.translate(-parent.world[0], -parent.world[1], -parent.world[2]);
    parent.children.push({ name, geometry, children: [] });
    this.mappings[name] = componentId;
    this.triangles.set(componentId, (this.triangles.get(componentId) || 0) + triangleCount(geometry));
    return name;
  }

  componentIds() { return [...this.counts.keys()]; }
}
