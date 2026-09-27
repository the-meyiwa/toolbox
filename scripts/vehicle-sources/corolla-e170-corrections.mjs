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

export const CORRECTIONS_VERSION = 1;

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

/** Applies the corrections to a parsed glTF JSON. Returns the names it moved. */
export function applyCorrections(json) {
  json.asset.extras ||= {};
  if ((json.asset.extras.tbxE170Corrections || 0) >= CORRECTIONS_VERSION) return [];
  const byName = new Map(json.nodes.map(n => [n.name, n]));
  const moved = [];
  for (const fix of CORRECTIONS) {
    for (const name of fix.nodes) {
      const node = byName.get(name);
      if (!node) throw new Error(`Correction target ${name} is not in the model`);
      if (node.matrix) throw new Error(`${name} uses a matrix transform; corrections expect TRS`);
      const s = fix.scale || [1, 1, 1];
      const t = node.translation || [0, 0, 0];
      // New transform = translate(fix) · scale(fix) · existing. Existing nodes carry no rotation or scale.
      if (node.rotation || node.scale) throw new Error(`${name} already has rotation or scale`);
      node.translation = t.map((v, i) => +(v * s[i] + fix.translate[i]).toFixed(6));
      if (fix.scale) node.scale = [...fix.scale];
      moved.push(name);
    }
  }
  json.asset.extras.tbxE170Corrections = CORRECTIONS_VERSION;
  return moved;
}

/** Rewrites a GLB buffer's JSON chunk, keeping the binary chunk. */
export function patchGLB(bytes) {
  const jsonLen = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLen).toString('utf8'));
  const moved = applyCorrections(json);
  if (!moved.length) return { bytes, moved };
  let text = Buffer.from(JSON.stringify(json), 'utf8');
  const pad = (4 - (text.length % 4)) % 4;
  text = Buffer.concat([text, Buffer.alloc(pad, 0x20)]);
  const rest = bytes.subarray(20 + jsonLen); // BIN chunk header + data
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + text.length + rest.length, 8);
  header.writeUInt32LE(text.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  return { bytes: Buffer.concat([header, text, rest]), moved };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const dir = path.join(ROOT, 'public/automobile/packages/toyota-corolla-2014-2016');
  const { bytes, moved } = patchGLB(await readFile(path.join(dir, 'vehicle.glb')));
  if (!moved.length) { console.log('Corrections already applied.'); process.exit(0); }
  await writeFile(path.join(dir, 'vehicle.glb'), bytes);
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.layers[0].sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Moved ${moved.length} nodes: ${moved.join(', ')}`);
}
