// Benchmark memory and performance of anatomy pipeline stages
import fs from 'node:fs';
import path from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplify, weld, dedup, prune, draco } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';

const RAW_BASE = 'https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/main/assets/BodyParts3D_data/stl';
const SAMPLES = [
  { id: 'FMA24486', name: 'right patella' },
  { id: 'FMA24474', name: 'right femur' },
  { id: 'FMA13336', name: 'right external oblique' },
];

const BENCH_DIR = path.join('.agents', 'explorer_survey_2', 'bench_stl');
fs.mkdirSync(BENCH_DIR, { recursive: true });

function mem(tag) {
  const m = process.memoryUsage();
  console.log(`[MEM ${tag}] RSS: ${(m.rss/1048576).toFixed(1)}MB, HeapUsed: ${(m.heapUsed/1048576).toFixed(1)}MB, HeapTotal: ${(m.heapTotal/1048576).toFixed(1)}MB`);
}

function readBinarySTL(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const triangles = dv.getUint32(80, true);
  const expected = 84 + triangles * 50;
  if (expected > buf.byteLength) throw new Error('not a binary STL');

  const positions = new Float32Array(triangles * 9);
  let o = 84, p = 0;
  for (let i = 0; i < triangles; i++) {
    o += 12;
    for (let v = 0; v < 3; v++) {
      positions[p++] = dv.getFloat32(o, true);
      positions[p++] = dv.getFloat32(o + 4, true);
      positions[p++] = dv.getFloat32(o + 8, true);
      o += 12;
    }
    o += 2;
  }
  return { positions, triangles };
}

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

async function run() {
  mem('Init');
  await MeshoptSimplifier.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.encoder': await draco3d.createEncoderModule(),
      'draco3d.decoder': await draco3d.createDecoderModule(),
    });

  mem('After IO ready');

  for (const item of SAMPLES) {
    const dest = path.join(BENCH_DIR, `${item.id}.stl`);
    if (!fs.existsSync(dest)) {
      console.log(`Downloading ${item.id} (${item.name})...`);
      const res = await fetch(`${RAW_BASE}/${item.id}.stl`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
    }
  }

  mem('Downloaded samples');

  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();
  const mat = doc.createMaterial('test-mat');

  let totalTris = 0;
  for (const item of SAMPLES) {
    const dest = path.join(BENCH_DIR, `${item.id}.stl`);
    const buf = fs.readFileSync(dest);
    console.log(`\nProcessing ${item.id} (${(buf.byteLength/1024).toFixed(1)} KB)...`);

    const t0 = performance.now();
    const { positions, triangles } = readBinarySTL(buf);
    const t1 = performance.now();
    console.log(`  readSTL: ${(t1-t0).toFixed(1)}ms, triangles: ${triangles}`);

    const { position, index } = buildIndexed(positions);
    const t2 = performance.now();
    console.log(`  buildIndexed: ${(t2-t1).toFixed(1)}ms, vertices: ${position.length/3}, welded indices: ${index.length}`);

    const normal = computeNormals(position, index);
    const t3 = performance.now();
    console.log(`  computeNormals: ${(t3-t2).toFixed(1)}ms`);

    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(position).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(normal).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(index).setBuffer(buffer))
      .setMaterial(mat);

    const mesh = doc.createMesh(item.id).addPrimitive(prim);
    scene.addChild(doc.createNode(item.id).setMesh(mesh));
    totalTris += index.length / 3;
    mem(`After adding ${item.id}`);
  }

  console.log(`\nTransforming doc (${totalTris} tris)...`);
  const tTr0 = performance.now();
  await doc.transform(
    weld(),
    dedup(),
    simplify({ simplifier: MeshoptSimplifier, ratio: 0.25, error: 0.004, lockBorder: false }),
    prune(),
    draco({ method: 'edgebreaker', quantizePosition: 13, quantizeNormal: 8 }),
  );
  const tTr1 = performance.now();
  console.log(`  doc.transform completed in ${(tTr1-tTr0).toFixed(1)}ms`);
  mem('After transform');

  const glb = await io.writeBinary(doc);
  console.log(`GLB size: ${(glb.byteLength/1024).toFixed(1)} KB`);
  mem('After writeBinary');
}

run().catch(console.error);
