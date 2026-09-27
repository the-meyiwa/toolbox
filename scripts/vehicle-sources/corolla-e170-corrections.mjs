#!/usr/bin/env node
/**
 * Photo-checked corrections to the 2014–2016 Corolla package's procedural
 * engine bay. The bay is Toolbox's approximation fitted inside the source
 * body; these moves put parts where photos of North American E170 cars
 * (2ZR-FE) show them. Each entry says what the photos show.
 *
 * Offsets are in the GLB's own units (the viewer scales the model to size).
 * Applied by build-source-vehicle.mjs, or run on its own to patch the
 * committed package:
 *
 *   node scripts/vehicle-sources/corolla-e170-corrections.mjs
 *
 * The GLB records the applied version in asset.extras, so running it twice
 * changes nothing.
 */
import { readFile, writeFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CORRECTIONS_VERSION = 2;

/* v1 — engine-bay parts moved to where photos show them. */
export const CORRECTIONS = [
  {
    nodes: ['tbx_air_cleaner_box_1', 'tbx_pivot_air_cleaner_lid', 'tbx_pivot_air_filter'],
    translate: [0.2, 0, 0.018],
    why: 'The air cleaner box sits directly behind the battery, with the brake fluid reservoir behind it at the firewall. It was modelled on top of the brake master cylinder.',
  },
  {
    nodes: ['tbx_pivot_oil_filler_cap'],
    translate: [-0.018, 0, 0.249],
    why: 'The oil filler cap shows through the rear hole of the engine cover, on its right (timing-chain) half; the dipstick loop is in the front hole.',
  },
  {
    nodes: ['tbx_pivot_radiator_cap'],
    translate: [0, 0, 0.07],
    why: 'The radiator cap is on the radiator’s right-hand tank, further outboard than modelled.',
  },
  {
    nodes: ['tbx_coolant_reservoir_1', 'tbx_pivot_coolant_reservoir_cap'],
    translate: [0.02, 0, -0.41],
    why: 'The coolant reservoir cap is just right of centre behind the radiator support, inboard of the radiator cap; it was modelled in the right front corner beside the washer filler.',
  },
  {
    nodes: ['tbx_coolant_reservoir_2'],
    scale: [1, 1, 0.615], translate: [0.02, 0, -0.0087],
    why: 'The reservoir hose now runs from the reservoir out to the radiator neck.',
  },
];

/*
 * v2 — pieces of the source mesh that were welded to the wrong part, so
 * they moved (or stayed) wrongly when something opened. Each entry takes
 * the connected pieces of `from` whose bounds lie wholly inside `box`
 * ([xlo, xhi, ylo, yhi, zlo, zhi], GLB units) and gives them to `to`
 * (a pivot, or null for the fixed body) as a new node mapped to `component`.
 */
export const REASSIGN = [
  ...['left', 'right'].map(side => ({
    from: `tbx_door_front_${side}_trim_panel_1`, to: null,
    box: [0.72, 0.80, 0.74, 0.945, ...(side === 'left' ? [-0.80, -0.55] : [0.55, 0.80])],
    node: `tbx_instrument_panel_upper_vent_${side}_1`, component: 'instrument_panel_upper',
    why: `The ${side} side air vent is part of the dashboard end, not the door; it swung out with the door.`,
  })),
  ...['left', 'right'].map(side => ({
    from: `tbx_seat_back_front_${side}_1`, to: `tbx_pivot_door_front_${side}`,
    box: [-0.10, 0.28, 0.62, 0.73, ...(side === 'left' ? [-0.81, -0.68] : [0.68, 0.81])],
    node: `tbx_door_front_${side}_armrest_1`, component: `door_front_${side}_trim_panel`,
    why: `The front ${side} door armrest was attached to the seatback, so it tilted when the seat reclined and stayed behind when the door opened.`,
  })),
  ...['left', 'right'].map(side => ({
    from: `tbx_tail_lamp_${side}_1`, to: 'tbx_pivot_trunk_lid',
    box: [-2.25, -2.08, 0.80, 0.98, ...(side === 'left' ? [-0.66, -0.30] : [0.30, 0.66])],
    node: `tbx_tail_lamp_${side}_inner_1`, component: `tail_lamp_${side}`,
    why: `The inner ${side} tail lamp is mounted on the boot lid; it stayed floating when the boot opened.`,
  })),
  {
    from: 'tbx_body_shell_1', to: 'tbx_pivot_trunk_lid',
    box: [-2.25, -2.08, 0.80, 0.95, -0.66, 0.66],
    node: 'tbx_trunk_lid_garnish_1', component: 'trunk_lid',
    why: 'The garnish strip and lamp surrounds across the boot lid face belong to the lid.',
  },
];

const SIZES = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const TYPED = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };

/** Minimal read/write access to a GLB's JSON and binary chunk. */
function openGLB(bytes) {
  const jsonLen = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLen).toString('utf8'));
  const binLen = bytes.readUInt32LE(20 + jsonLen);
  const bin = [Buffer.from(bytes.subarray(28 + jsonLen, 28 + jsonLen + binLen))];
  let binLength = binLen;
  const read = (index) => {
    const a = json.accessors[index], view = json.bufferViews[a.bufferView];
    const T = TYPED[a.componentType], size = SIZES[a.type];
    const stride = view.byteStride || size * T.BYTES_PER_ELEMENT;
    const base = (view.byteOffset || 0) + (a.byteOffset || 0);
    const out = new T(a.count * size);
    const buf = bin[0], dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const get = { 5121: o => dv.getUint8(o), 5123: o => dv.getUint16(o, true), 5125: o => dv.getUint32(o, true), 5126: o => dv.getFloat32(o, true) }[a.componentType];
    for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) out[i * size + k] = get(base + i * stride + k * T.BYTES_PER_ELEMENT);
    return { data: out, type: a.type, componentType: a.componentType, size };
  };
  const append = (typed, { type, componentType, target, minmax }) => {
    const pad = (4 - (binLength % 4)) % 4;
    if (pad) { bin.push(Buffer.alloc(pad)); binLength += pad; }
    const chunk = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
    json.bufferViews.push({ buffer: 0, byteOffset: binLength, byteLength: chunk.length, ...(target ? { target } : {}) });
    bin.push(Buffer.from(chunk)); binLength += chunk.length;
    const size = SIZES[type];
    const acc = { bufferView: json.bufferViews.length - 1, componentType, count: typed.length / size, type };
    if (minmax) {
      acc.min = Array(size).fill(Infinity); acc.max = Array(size).fill(-Infinity);
      for (let i = 0; i < typed.length; i++) { const k = i % size; acc.min[k] = Math.min(acc.min[k], typed[i]); acc.max[k] = Math.max(acc.max[k], typed[i]); }
    }
    json.accessors.push(acc);
    return json.accessors.length - 1;
  };
  const write = () => {
    const pad = (4 - (binLength % 4)) % 4;
    if (pad) { bin.push(Buffer.alloc(pad)); binLength += pad; }
    json.buffers[0].byteLength = binLength;
    let text = Buffer.from(JSON.stringify(json), 'utf8');
    text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
    const header = Buffer.alloc(20);
    header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
    header.writeUInt32LE(20 + text.length + 8 + binLength, 8);
    header.writeUInt32LE(text.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
    const binHeader = Buffer.alloc(8);
    binHeader.writeUInt32LE(binLength, 0); binHeader.writeUInt32LE(0x004e4942, 4);
    return Buffer.concat([header, text, binHeader, ...bin]);
  };
  return { json, read, append, write };
}

/** World translation of a node (pivots and meshes here carry translation only at rest). */
function worldOffset(json, name) {
  const parent = new Map();
  json.nodes.forEach((n, i) => (n.children || []).forEach(c => parent.set(c, i)));
  let i = json.nodes.findIndex(n => n.name === name);
  if (i < 0) throw new Error(`Node ${name} is not in the model`);
  const t = [0, 0, 0];
  while (i !== undefined) {
    const n = json.nodes[i];
    if (n.rotation || n.matrix || (n.scale && n.scale.some(v => v !== 1))) throw new Error(`${n.name} is rotated or scaled; reassignment expects translations only`);
    (n.translation || [0, 0, 0]).forEach((v, k) => { t[k] += v; });
    i = parent.get(i);
  }
  return t;
}

/** Vertex-connected pieces of a triangle list (coincident positions count as connected). */
function pieces(pos, idx) {
  const n = pos.length / 3, parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = a => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const unite = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  const seen = new Map();
  for (let i = 0; i < n; i++) { const k = `${Math.round(pos[i * 3] * 1e4)},${Math.round(pos[i * 3 + 1] * 1e4)},${Math.round(pos[i * 3 + 2] * 1e4)}`; if (seen.has(k)) unite(i, seen.get(k)); else seen.set(k, i); }
  for (let t = 0; t < idx.length; t += 3) { unite(idx[t], idx[t + 1]); unite(idx[t + 1], idx[t + 2]); }
  const groups = new Map();
  for (let t = 0; t < idx.length / 3; t++) { const r = find(idx[t * 3]); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(t); }
  return [...groups.values()];
}

function reassign(glb, fix) {
  const { json, read, append } = glb;
  const src = json.nodes.find(n => n.name === fix.from);
  if (!src || src.mesh === undefined) throw new Error(`Reassignment source ${fix.from} is not a mesh node`);
  const srcOffset = worldOffset(json, fix.from);
  const dstOffset = fix.to ? worldOffset(json, fix.to) : [0, 0, 0];
  const newPrims = [];
  let movedTris = 0;
  for (const prim of json.meshes[src.mesh].primitives) {
    const pos = read(prim.attributes.POSITION).data;
    const idx = read(prim.indices).data;
    const take = new Set();
    for (const tris of pieces(pos, idx)) {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (const t of tris) for (let k = 0; k < 3; k++) { const v = idx[t * 3 + k]; for (let a = 0; a < 3; a++) { const w = pos[v * 3 + a] + srcOffset[a]; lo[a] = Math.min(lo[a], w); hi[a] = Math.max(hi[a], w); } }
      const [x0, x1, y0, y1, z0, z1] = fix.box;
      if (lo[0] >= x0 && hi[0] <= x1 && lo[1] >= y0 && hi[1] <= y1 && lo[2] >= z0 && hi[2] <= z1) tris.forEach(t => take.add(t));
    }
    if (!take.size) continue;
    movedTris += take.size;
    // What stays: a new index list for the source primitive.
    const keep = [], moved = [];
    for (let t = 0; t < idx.length / 3; t++) (take.has(t) ? moved : keep).push(idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]);
    prim.indices = append(new Uint32Array(keep), { type: 'SCALAR', componentType: 5125, target: 34963 });
    // What moves: compact vertices into the destination's frame.
    const remap = new Map(), order = [];
    const outIdx = new Uint32Array(moved.length);
    moved.forEach((v, i) => { if (!remap.has(v)) { remap.set(v, order.length); order.push(v); } outIdx[i] = remap.get(v); });
    const attributes = {};
    for (const [name, accIndex] of Object.entries(prim.attributes)) {
      const a = read(accIndex);
      const out = new (a.data.constructor)(order.length * a.size);
      order.forEach((v, i) => { for (let k = 0; k < a.size; k++) out[i * a.size + k] = a.data[v * a.size + k] + (name === 'POSITION' ? srcOffset[k] - dstOffset[k] : 0); });
      attributes[name] = append(out, { type: a.type, componentType: a.componentType, target: 34962, minmax: name === 'POSITION' });
    }
    newPrims.push({ attributes, indices: append(outIdx, { type: 'SCALAR', componentType: 5125, target: 34963 }), ...(prim.material !== undefined ? { material: prim.material } : {}), ...(prim.mode !== undefined ? { mode: prim.mode } : {}) });
  }
  if (!newPrims.length) throw new Error(`No pieces of ${fix.from} fall inside the box for ${fix.node}`);
  json.meshes.push({ name: fix.node, primitives: newPrims });
  json.nodes.push({ name: fix.node, mesh: json.meshes.length - 1 });
  const parentIndex = fix.to ? json.nodes.findIndex(n => n.name === fix.to) : json.nodes.findIndex(n => n.name === 'tbx_vehicle');
  (json.nodes[parentIndex].children ||= []).push(json.nodes.length - 1);
  return movedTris;
}

/**
 * Applies whatever corrections a GLB does not have yet.
 * Returns { bytes, moved: [names], mappings: { newNode: component } }.
 */
export function patchGLB(bytes) {
  const glb = openGLB(bytes);
  const { json } = glb;
  json.asset.extras ||= {};
  const applied = json.asset.extras.tbxE170Corrections || 0;
  const moved = [], mappings = {};
  if (applied < 1) {
    const byName = new Map(json.nodes.map(n => [n.name, n]));
    for (const fix of CORRECTIONS) for (const name of fix.nodes) {
      const node = byName.get(name);
      if (!node) throw new Error(`Correction target ${name} is not in the model`);
      if (node.matrix || node.rotation || node.scale) throw new Error(`${name} already has a matrix, rotation or scale`);
      const s = fix.scale || [1, 1, 1], t = node.translation || [0, 0, 0];
      node.translation = t.map((v, i) => +(v * s[i] + fix.translate[i]).toFixed(6));
      if (fix.scale) node.scale = [...fix.scale];
      moved.push(name);
    }
  }
  if (applied < 2) for (const fix of REASSIGN) { reassign(glb, fix); moved.push(fix.node); mappings[fix.node] = fix.component; }
  if (!moved.length) return { bytes, moved, mappings };
  json.asset.extras.tbxE170Corrections = CORRECTIONS_VERSION;
  return { bytes: glb.write(), moved, mappings };
}

/** Every mapping the corrections add, for manifests built from a corrected model. */
export const REASSIGNED_MAPPINGS = Object.fromEntries(REASSIGN.map(f => [f.node, f.component]));

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const dir = path.join(ROOT, 'public/automobile/packages/toyota-corolla-2014-2016');
  const { bytes, moved, mappings } = patchGLB(await readFile(path.join(dir, 'vehicle.glb')));
  if (!moved.length) { console.log('Corrections already applied.'); process.exit(0); }
  await writeFile(path.join(dir, 'vehicle.glb'), bytes);
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.meshMappings = { ...manifest.meshMappings, ...mappings };
  manifest.layers[0].sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Applied ${moved.length} corrections: ${moved.join(', ')}`);
}
