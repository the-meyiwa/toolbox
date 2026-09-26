import fs from 'node:fs';
import path from 'node:path';
import { Document } from '@gltf-transform/core';
import { simplify, weld, dedup, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

await MeshoptSimplifier.ready;

const BENCH_DIR = path.join('.agents', 'explorer_survey_2', 'bench_stl');
const file = path.join(BENCH_DIR, 'FMA13336.stl');

function readBinarySTL(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const triangles = dv.getUint32(80, true);
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

async function processPartIsolated(stlPath, targetTris = 6000) {
  const buf = fs.readFileSync(stlPath);
  const { positions } = readBinarySTL(buf);
  const { position, index } = buildIndexed(positions);
  const sourceTris = index.length / 3;

  if (sourceTris <= targetTris) {
    const normal = computeNormals(position, index);
    return { position, normal, index, tris: sourceTris };
  }

  // Use a transient Document for this single mesh to isolate memory
  const doc = new Document();
  const buffer = doc.createBuffer();
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(position).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(index).setBuffer(buffer));
  const scene = doc.createScene();
  const mesh = doc.createMesh().addPrimitive(prim);
  scene.addChild(doc.createNode().setMesh(mesh));

  const ratio = targetTris / sourceTris;
  await doc.transform(
    simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.005, lockBorder: false }),
    prune()
  );

  const simpPos = prim.getAttribute('POSITION').getArray();
  const simpIdx = prim.getIndices().getArray();
  const simpNorm = computeNormals(simpPos, simpIdx);

  return {
    position: simpPos,
    normal: simpNorm,
    index: simpIdx,
    tris: simpIdx.length / 3
  };
}

const t0 = performance.now();
const res = await processPartIsolated(file, 6000);
const t1 = performance.now();
console.log(`Isolated simplification of 26MB external oblique took ${(t1-t0).toFixed(1)}ms!`);
console.log(`Final tris: ${res.tris} (target 6000)`);
console.log(`Final vertex count: ${res.position.length/3}`);
console.log(`Final index count: ${res.index.length}`);
