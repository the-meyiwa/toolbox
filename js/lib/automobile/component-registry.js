/** Semantic identity belongs to nodes/assemblies, never to material colors. */
export class ComponentRegistry {
  constructor(root, componentMap = {}, components = []) {
    this.entries = new Map();
    this.byMesh = new Map();
    const supplied = new Map(components.map(part => [part.id, part]));
    const byName = new Map(components.filter(part => part.meshName).map(part => [part.meshName, part]));
    root.traverse(mesh => {
      if (!mesh.isMesh) return;
      let node = mesh, metadata;
      while (node && node !== root.parent) {
        metadata = componentMap[node.name] || node.userData?.component || byName.get(node.name);
        if (metadata) break;
        node = node.parent;
      }
      metadata = metadata || {};
      const id = String(metadata.id || `unmapped-${this.entries.size + 1}`);
      let entry = this.entries.get(id);
      if (!entry) {
        entry = { id, name: metadata.name || mesh.name || 'Unnamed geometry', category: 'Unmapped geometry',
          ...supplied.get(id), ...metadata, id, meshName: mesh.name, meshes: [], numericId: this.entries.size + 1 };
        this.entries.set(id, entry);
      }
      entry.meshes.push(mesh);
      this.byMesh.set(mesh, entry);
    });
  }
  get(id) { return this.entries.get(id); }
  list() { return [...this.entries.values()]; }
  metadata(id) {
    const entry = this.get(id);
    if (!entry) return null;
    const { meshes, numericId, ...metadata } = entry;
    return metadata;
  }
}
