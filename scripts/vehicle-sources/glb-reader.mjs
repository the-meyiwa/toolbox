/** Minimal glTF 2.0 binary reader: bakes every primitive into world-space position/normal/index arrays. */
import { readFileSync } from 'node:fs';
import { Matrix4, Quaternion, Vector3, Matrix3 } from 'three';

const SIZES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const TYPES = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };

export function readGLB(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('Not a GLB file');
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const binStart = 20 + jsonLen + 8;
  const bin = buf.subarray(binStart, binStart + buf.readUInt32LE(20 + jsonLen));
  const accessor = index => {
    const a = json.accessors[index], view = json.bufferViews[a.bufferView];
    const T = TYPES[a.componentType], size = SIZES[a.type];
    const stride = view.byteStride || size * T.BYTES_PER_ELEMENT;
    const base = (view.byteOffset || 0) + (a.byteOffset || 0);
    const out = new (a.componentType === 5126 ? Float32Array : Uint32Array)(a.count * size);
    const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
    const read = { 5126: (o) => dv.getFloat32(o, true), 5125: o => dv.getUint32(o, true), 5123: o => dv.getUint16(o, true), 5121: o => dv.getUint8(o) }[a.componentType];
    for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) out[i * size + k] = read(base + i * stride + k * T.BYTES_PER_ELEMENT);
    return out;
  };
  const primitives = [];
  const visit = (index, parent, parentName = '') => {
    const node = json.nodes[index];
    const local = new Matrix4();
    if (node.matrix) local.fromArray(node.matrix);
    else local.compose(new Vector3(...(node.translation || [0, 0, 0])), new Quaternion(...(node.rotation || [0, 0, 0, 1])), new Vector3(...(node.scale || [1, 1, 1])));
    const world = parent.clone().multiply(local);
    if (node.mesh !== undefined) {
      const normalMatrix = new Matrix3().getNormalMatrix(world);
      for (const prim of json.meshes[node.mesh].primitives) {
        if ((prim.mode ?? 4) !== 4) continue;
        const pos = accessor(prim.attributes.POSITION);
        const nor = prim.attributes.NORMAL !== undefined ? accessor(prim.attributes.NORMAL) : null;
        const idx = prim.indices !== undefined ? accessor(prim.indices) : Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
        const v = new Vector3();
        for (let i = 0; i < pos.length; i += 3) { v.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(world); pos[i] = v.x; pos[i + 1] = v.y; pos[i + 2] = v.z; }
        if (nor) for (let i = 0; i < nor.length; i += 3) { v.set(nor[i], nor[i + 1], nor[i + 2]).applyMatrix3(normalMatrix).normalize(); nor[i] = v.x; nor[i + 1] = v.y; nor[i + 2] = v.z; }
        primitives.push({ node: node.name, parent: parentName, material: json.materials?.[prim.material]?.name || '', positions: pos, normals: nor, indices: idx });
      }
    }
    for (const child of node.children || []) visit(child, world, node.name || '');
  };
  for (const root of json.scenes[json.scene || 0].nodes) visit(root, new Matrix4());
  return { json, primitives };
}

/** Split a primitive into vertex-connected islands (shared index = connected). */
export function islands(prim) {
  const n = prim.positions.length / 3, parent = new Int32Array(n).map((_, i) => i);
  const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const unite = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  // Weld coincident vertices first (UV seams duplicate positions).
  const key = new Map();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(prim.positions[i * 3] * 1e4)},${Math.round(prim.positions[i * 3 + 1] * 1e4)},${Math.round(prim.positions[i * 3 + 2] * 1e4)}`;
    if (key.has(k)) unite(i, key.get(k)); else key.set(k, i);
  }
  const idx = prim.indices;
  for (let t = 0; t < idx.length; t += 3) { unite(idx[t], idx[t + 1]); unite(idx[t + 1], idx[t + 2]); }
  const groups = new Map();
  for (let t = 0; t < idx.length; t += 3) {
    const r = find(idx[t]);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(t / 3);
  }
  return [...groups.values()];
}
