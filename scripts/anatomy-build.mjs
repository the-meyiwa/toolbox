/* ============================================================
   Anatomy asset pipeline — step 2: build.

   Turns the cached BodyParts3D STL files into a small number of
   Draco-compressed GLB files, one per body system, plus an index the
   viewer uses for names, systems and notes.

   STL is a triangle soup with no shared vertices and a normal per
   face, so the win comes from welding coincident vertices, then
   simplifying, then compressing. A 500 KB STL typically lands around
   15–30 KB of GLB.

   Run:  node scripts/anatomy-build.mjs
   Data: BodyParts3D © 2008 Database Center for Life Science,
         CC BY-SA 2.1 Japan.
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplify, weld, dedup, prune, draco } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';

const SRC     = '.anatomy-src';
const STL_DIR = path.join(SRC, 'stl');
const OUT_DIR = path.join('public', 'anatomy');

/* Structures are simplified toward a triangle budget rather than a
   fixed ratio: a 200k-triangle liver and a 2k-triangle gallbladder
   need very different treatment. */
const TARGET_TRIS = 6000;
const MIN_RATIO   = 0.06;
const SIMPLIFY_ERROR = 0.004;

/* ---------------- binary STL ---------------- */

function readBinarySTL(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const triangles = dv.getUint32(80, true);

  // Guard against an ASCII STL sneaking in.
  const expected = 84 + triangles * 50;
  if (expected > buf.byteLength) throw new Error('not a binary STL');

  const positions = new Float32Array(triangles * 9);
  let o = 84, p = 0;
  for (let i = 0; i < triangles; i++) {
    o += 12;                                     // skip the face normal
    for (let v = 0; v < 3; v++) {
      positions[p++] = dv.getFloat32(o, true);
      positions[p++] = dv.getFloat32(o + 4, true);
      positions[p++] = dv.getFloat32(o + 8, true);
      o += 12;
    }
    o += 2;                                      // attribute byte count
  }
  return positions;
}

/* Weld coincident vertices into an indexed mesh. Quantising the hash
   key merges the seams STL leaves behind without visibly moving
   anything (0.05 mm at this scale). */
function buildIndexed(positions) {
  const map = new Map();
  const out = [];
  const index = new Uint32Array(positions.length / 3);

  for (let i = 0, n = positions.length / 3; i < n; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    const key = `${Math.round(x * 20000)},${Math.round(y * 20000)},${Math.round(z * 20000)}`;
    let id = map.get(key);
    if (id === undefined) {
      id = out.length / 3;
      map.set(key, id);
      out.push(x, y, z);
    }
    index[i] = id;
  }
  return { position: new Float32Array(out), index };
}

/* Smooth vertex normals by area-weighted face accumulation. */
function computeNormals(position, index) {
  const normals = new Float32Array(position.length);
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i] * 3, b = index[i + 1] * 3, c = index[i + 2] * 3;
    const ax = position[a], ay = position[a + 1], az = position[a + 2];
    const e1x = position[b] - ax, e1y = position[b + 1] - ay, e1z = position[b + 2] - az;
    const e2x = position[c] - ax, e2y = position[c + 1] - ay, e2z = position[c + 2] - az;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    for (const o of [a, b, c]) { normals[o] += nx; normals[o + 1] += ny; normals[o + 2] += nz; }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= l; normals[i + 1] /= l; normals[i + 2] /= l;
  }
  return normals;
}

/* ---------------- system presentation ---------------- */

const SYSTEM_META = {
  skeletal:       { label: 'Skeletal',       color: [0.918, 0.894, 0.827], order: 1 },
  muscular:       { label: 'Muscular',       color: [0.698, 0.314, 0.290], order: 2 },
  nervous:        { label: 'Nervous',        color: [0.863, 0.816, 0.722], order: 3 },
  cardiovascular: { label: 'Cardiovascular', color: [0.690, 0.227, 0.180], order: 4 },
  respiratory:    { label: 'Respiratory',    color: [0.859, 0.569, 0.651], order: 5 },
  digestive:      { label: 'Digestive',      color: [0.780, 0.569, 0.341], order: 6 },
  urinary:        { label: 'Urinary',        color: [0.553, 0.353, 0.235], order: 7 },
  endocrine:      { label: 'Endocrine',      color: [0.494, 0.588, 0.443], order: 8 },
};

/* ---------------- build ---------------- */

const selected = JSON.parse(fs.readFileSync(path.join(SRC, 'selected.json'), 'utf8'));
fs.mkdirSync(OUT_DIR, { recursive: true });

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'draco3d.decoder': await draco3d.createDecoderModule(),
  });

await MeshoptSimplifier.ready;

const bySystem = new Map();
for (const p of selected) {
  if (!bySystem.has(p.system)) bySystem.set(p.system, []);
  bySystem.get(p.system).push(p);
}

const index = { systems: {}, structures: [] };
let grandBytes = 0, grandTris = 0, grandSkipped = 0;

/* BodyParts3D is in millimetres and is Z-UP: the body stands along +Z
   and Y is the antero-posterior axis. glTF is Y-up by specification, so
   the axis change is baked into the geometry rather than left as a
   rotation for every consumer to remember:

     gltfX =  (x - cx)      lateral, centred
     gltfY =  (z - minZ)    superior, feet on the ground plane
     gltfZ = -(y - cy)      anterior, centred

   The offsets come from a bounds pass over every selected structure, so
   all eight system files share one origin and line up when loaded
   independently. */
const SCALE = 0.001;

console.log('measuring…');
const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
for (const part of selected) {
  const file = path.join(STL_DIR, `${part.id}.stl`);
  if (!fs.existsSync(file)) continue;
  let pos;
  try { pos = readBinarySTL(fs.readFileSync(file)); } catch { continue; }
  for (let i = 0; i < pos.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      const v = pos[i + a];
      if (v < bounds.min[a]) bounds.min[a] = v;
      if (v > bounds.max[a]) bounds.max[a] = v;
    }
  }
}
const cx = (bounds.min[0] + bounds.max[0]) / 2;
const cy = (bounds.min[1] + bounds.max[1]) / 2;
const minZ = bounds.min[2];
console.log(`  body spans ${((bounds.max[2] - minZ) * SCALE).toFixed(3)} m tall, ` +
            `${((bounds.max[0] - bounds.min[0]) * SCALE).toFixed(3)} m wide\n`);

function toGltfAxes(p) {
  for (let i = 0; i < p.length; i += 3) {
    const x = p[i], y = p[i + 1], z = p[i + 2];
    p[i]     = (x - cx)  * SCALE;
    p[i + 1] = (z - minZ) * SCALE;
    p[i + 2] = -(y - cy) * SCALE;
  }
  return p;
}

for (const [system, parts] of [...bySystem.entries()].sort((a, b) => SYSTEM_META[a[0]].order - SYSTEM_META[b[0]].order)) {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();

  const meta = SYSTEM_META[system];
  const material = doc.createMaterial(`${system}-material`)
    .setBaseColorFactor([...meta.color, 1])
    .setRoughnessFactor(0.72)
    .setMetallicFactor(0.02)
    .setDoubleSided(true);

  let systemTris = 0, included = 0;

  for (const part of parts) {
    const file = path.join(STL_DIR, `${part.id}.stl`);
    if (!fs.existsSync(file)) { grandSkipped++; continue; }

    let positions;
    try {
      positions = readBinarySTL(fs.readFileSync(file));
    } catch (err) {
      console.warn(`  skipped ${part.id} (${part.name}): ${err.message}`);
      grandSkipped++;
      continue;
    }
    if (positions.length < 9) { grandSkipped++; continue; }

    toGltfAxes(positions);

    const { position, index: idx } = buildIndexed(positions);
    const normal = computeNormals(position, idx);

    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(position).setBuffer(buffer))
      .setAttribute('NORMAL',   doc.createAccessor().setType('VEC3').setArray(normal).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(idx).setBuffer(buffer))
      .setMaterial(material);

    const mesh = doc.createMesh(part.id).addPrimitive(prim);
    // The node name is the lookup key the viewer uses.
    scene.addChild(doc.createNode(part.id).setMesh(mesh));

    systemTris += idx.length / 3;
    included++;

    index.structures.push({
      id: part.id,
      name: part.name,
      system,
      fma: part.id.startsWith('FMA') ? part.id.slice(3) : null,
    });
  }

  if (!included) continue;

  const before = systemTris;
  const ratio = Math.max(MIN_RATIO, Math.min(1, (TARGET_TRIS * included) / Math.max(before, 1)));

  await doc.transform(
    weld(),
    dedup(),
    ...(ratio < 0.999 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: SIMPLIFY_ERROR, lockBorder: false })] : []),
    prune(),
    draco({ method: 'edgebreaker', quantizePosition: 13, quantizeNormal: 8 }),
  );

  const glb = await io.writeBinary(doc);
  const out = path.join(OUT_DIR, `${system}.glb`);
  fs.writeFileSync(out, glb);

  const kb = glb.byteLength / 1024;
  grandBytes += glb.byteLength;
  grandTris += before;

  index.systems[system] = {
    label: meta.label,
    color: meta.color,
    order: meta.order,
    file: `${system}.glb`,
    count: included,
    bytes: glb.byteLength,
  };

  console.log(`${meta.label.padEnd(15)} ${String(included).padStart(3)} parts  ` +
              `${String(Math.round(before / 1000)).padStart(5)}k tris → ratio ${ratio.toFixed(2)}  ` +
              `${kb > 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb.toFixed(0) + ' KB'}`);
}

index.attribution = {
  source: 'BodyParts3D',
  holder: 'Database Center for Life Science (DBCLS)',
  year: 2008,
  licence: 'CC BY-SA 2.1 Japan',
  url: 'https://lifesciencedb.jp/bp3d/',
};
index.generated = new Date().toISOString();

fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(index));

console.log(`\ntotal ${(grandBytes / 1048576).toFixed(1)} MB across ${Object.keys(index.systems).length} systems, ` +
            `${index.structures.length} structures (${Math.round(grandTris / 1000)}k source triangles), ${grandSkipped} skipped`);
