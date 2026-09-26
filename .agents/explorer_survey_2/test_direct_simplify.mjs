import fs from 'node:fs';
import path from 'node:path';
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

const buf = fs.readFileSync(file);
console.log(`Read STL (${(buf.byteLength/1048576).toFixed(1)} MB)...`);

const { positions, triangles } = readBinarySTL(buf);
console.log(`Source triangles: ${triangles}`);

const { position, index } = buildIndexed(positions);
console.log(`Welded vertices: ${position.length/3}, welded indices: ${index.length}`);

const targetIndexCount = 6000 * 3; // 6000 triangles
const targetError = 0.01;

const t0 = performance.now();
// MeshoptSimplifier.simplify returns [destination Uint32Array, result_error]
const [simplifiedIndices, resultError] = MeshoptSimplifier.simplify(
  index,
  position,
  3, // stride in floats
  targetIndexCount,
  targetError
);
const t1 = performance.now();

console.log(`Direct simplification took ${(t1-t0).toFixed(1)}ms!`);
console.log(`Simplified indices: ${simplifiedIndices.length} (${simplifiedIndices.length/3} triangles), error: ${resultError.toFixed(5)}`);

// Compact vertices so unused vertices from simplification are eliminated
const [compactPositions, compactIndices] = MeshoptSimplifier.compactMesh(
  position,
  simplifiedIndices,
  3
);

console.log(`Compacted vertices: ${compactPositions.length/3} (${(compactPositions.byteLength/1024).toFixed(1)} KB), indices: ${(compactIndices.byteLength/1024).toFixed(1)} KB`);
console.log(`Memory footprint of simplified mesh: ${((compactPositions.byteLength + compactIndices.byteLength)/1024).toFixed(1)} KB (vs raw ${ (buf.byteLength/1024).toFixed(1) } KB)`);
