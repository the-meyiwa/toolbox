/* ============================================================
   Tag each anatomy structure with its body region.

   Reads the system GLBs in public/anatomy/ and classifies every
   structure by where its bounding box sits on the body, then writes
   `region` onto each entry of index.json and refreshes each system's
   byte size. Name matching alone left most of the 927 structures in
   a catch-all region; position works for all of them.

   Run after anatomy-build.mjs (which calls it), or on its own:
     node scripts/anatomy-regions.mjs
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join('public', 'anatomy');

/* Heights are metres above the soles, the model's frame (Y up,
   left side at +X). Hands hang lateral to the thighs, so lateral
   distance separates arm from leg before height is considered. */
function regionFor(name, [x, y]) {
  const lateral = Math.abs(x);
  if (/scapula|clavicle/.test(name)) return 'upper-limb';  // shoulder girdle
  if (y > 1.40) return 'head-neck';
  if (lateral > 0.17) return 'upper-limb';
  if (y < 0.75) return 'lower-limb';
  if (y > 1.17) return 'thorax';
  if (y > 0.95) return 'abdomen';
  return 'pelvis';
}

function readGlbJson(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${file} is not a GLB`);
  const len = buf.readUInt32LE(12);
  return { json: JSON.parse(buf.toString('utf8', 20, 20 + len)), bytes: buf.length };
}

/* Accessor min/max survive Draco compression, so the bounds can be
   read without decoding any geometry. */
function nodeCentres(gltf) {
  const centres = new Map();
  for (const node of gltf.nodes || []) {
    if (node.mesh === undefined) continue;
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (const prim of gltf.meshes[node.mesh].primitives) {
      const acc = gltf.accessors[prim.attributes.POSITION];
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i], acc.min[i]);
        hi[i] = Math.max(hi[i], acc.max[i]);
      }
    }
    const t = node.translation || [0, 0, 0];
    const s = node.scale || [1, 1, 1];
    centres.set(node.name, lo.map((v, i) => ((v + hi[i]) / 2) * s[i] + t[i]));
  }
  return centres;
}

const indexPath = path.join(DIR, 'index.json');
const raw = fs.readFileSync(indexPath, 'utf8');
const index = JSON.parse(raw);

const centres = new Map();
for (const [key, sys] of Object.entries(index.systems)) {
  const { json, bytes } = readGlbJson(path.join(DIR, sys.file));
  sys.bytes = bytes;
  for (const [id, c] of nodeCentres(json)) centres.set(id, c);
}

const counts = {};
let missing = 0;
for (const s of index.structures) {
  const c = centres.get(s.id);
  if (!c) { missing++; delete s.region; continue; }
  s.region = regionFor(s.name, c);
  counts[s.region] = (counts[s.region] || 0) + 1;
}

// Keep the file's existing formatting (select writes it indented, build compact).
fs.writeFileSync(indexPath, raw.includes('\n  ') ? JSON.stringify(index, null, 2) : JSON.stringify(index));
console.log('regions', counts, missing ? `(${missing} structures have no geometry)` : '');
