import fs from 'node:fs';
import assert from 'node:assert/strict';

console.log('Loading public/anatomy/index.json...');
const raw = fs.readFileSync('public/anatomy/index.json', 'utf8');
const index = JSON.parse(raw);

console.log('--- 1. Top-level Schema ---');
assert.equal(index.version, 2, 'Version must be 2');
assert(Array.isArray(index.structures), 'structures must be an array');
assert.equal(index.structures.length, 927, 'Must have exactly 927 structures');
assert.equal(typeof index.systems, 'object', 'systems must be an object');

const canonicalSystems = ['skeletal', 'muscular', 'nervous', 'cardiovascular', 'respiratory', 'digestive', 'urinary', 'endocrine'];
assert.deepEqual(Object.keys(index.systems), canonicalSystems, 'Must contain exactly the 8 canonical systems');

console.log('--- 2. System Metadata & Color Compatibility ---');
const hex = (c) => '#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

let totalCount = 0;
for (const [key, sys] of Object.entries(index.systems)) {
  assert.equal(typeof sys.name, 'string', `${key} name must be string`);
  assert.equal(typeof sys.label, 'string', `${key} label must be string`);
  assert(Array.isArray(sys.color) && sys.color.length === 3, `${key} color must be array of 3 numbers`);
  for (const c of sys.color) {
    assert(typeof c === 'number' && c >= 0 && c <= 1, `${key} color channel must be float 0..1`);
  }
  // Test hex function to ensure no TypeError: c.map is not a function in js/tools/anatomy-explorer.js:46
  const computedHex = hex(sys.color);
  assert(/^#[0-9a-f]{6}$/i.test(computedHex), `${key} hex must be valid 6-char hex: ${computedHex}`);
  console.log(`  System ${key.padEnd(15)}: color=[${sys.color.join(', ')}] -> hex=${computedHex}, colorInt=${sys.colorInt}, count=${sys.count}`);

  assert.equal(typeof sys.colorInt, 'number', `${key} colorInt must be number`);
  assert(Number.isInteger(sys.colorInt) && sys.colorInt >= 0 && sys.colorInt <= 0xFFFFFF, `${key} colorInt must be valid 24-bit int`);
  assert.equal(typeof sys.order, 'number', `${key} order must be number`);
  assert.equal(typeof sys.file, 'string', `${key} file must be string`);
  assert.equal(typeof sys.count, 'number', `${key} count must be number`);
  assert.equal(typeof sys.bytes, 'number', `${key} bytes must be number`);
  
  totalCount += sys.count;
}
assert.equal(totalCount, 927, 'Sum of system counts must equal 927');

console.log('--- 3. Structure Index Integrity ---');
const idSet = new Set();
const systemCounts = Object.fromEntries(canonicalSystems.map(s => [s, 0]));

for (let i = 0; i < index.structures.length; i++) {
  const s = index.structures[i];
  assert(s.id && typeof s.id === 'string', `Structure ${i} ID must be string`);
  assert(!idSet.has(s.id), `Duplicate ID found: ${s.id}`);
  idSet.add(s.id);

  assert(s.name && typeof s.name === 'string', `Structure ${s.id} name must be non-empty string`);
  assert(canonicalSystems.includes(s.system), `Structure ${s.id} system '${s.system}' not in canonical list`);
  systemCounts[s.system]++;

  if (s.fma !== null) {
    assert.equal(typeof s.fma, 'string', `Structure ${s.id} fma must be string or null`);
    assert(/^\d+/.test(s.fma), `Structure ${s.id} fma should have leading digits: ${s.fma}`);
  }
}

for (const sys of canonicalSystems) {
  assert.equal(systemCounts[sys], index.systems[sys].count, `System count mismatch for ${sys}: actual ${systemCounts[sys]} vs declared ${index.systems[sys].count}`);
}

console.log('--- 4. Deterministic Sort Verification ---');
let lastSystemOrder = -1;
let currentSystem = null;
let lastItem = null;

for (let i = 0; i < index.structures.length; i++) {
  const s = index.structures[i];
  const sysMeta = index.systems[s.system];
  
  if (s.system !== currentSystem) {
    assert(sysMeta.order > lastSystemOrder, `System ordering violation at index ${i}: ${s.system} (order ${sysMeta.order}) followed order ${lastSystemOrder}`);
    lastSystemOrder = sysMeta.order;
    currentSystem = s.system;
    lastItem = null;
  }
  
  if (lastItem) {
    const cmp = lastItem.name.localeCompare(s.name, 'en', { sensitivity: 'base' });
    if (cmp === 0) {
      const idCmp = lastItem.id.localeCompare(s.id, 'en');
      assert(idCmp <= 0, `ID tie-break sorting violation between ${lastItem.id} and ${s.id} with same name '${s.name}'`);
    } else {
      assert(cmp < 0, `Alphabetical sort violation in system '${currentSystem}': '${lastItem.name}' (${lastItem.id}) must come before '${s.name}' (${s.id})`);
    }
  }
  lastItem = s;
}

console.log('--- 5. Selected.json Verification ---');
const selectedRaw = fs.readFileSync('.anatomy-src/selected.json', 'utf8');
const selected = JSON.parse(selectedRaw);
assert.deepEqual(Object.keys(selected), canonicalSystems, '.anatomy-src/selected.json keys must match canonical systems');
let selectedTotal = 0;
for (const sys of canonicalSystems) {
  const parts = selected[sys];
  assert(Array.isArray(parts), `selected[${sys}] must be array`);
  selectedTotal += parts.length;
  assert.equal(parts.length, index.systems[sys].count, `Count mismatch in selected.json for ${sys}`);
  for (const p of parts) {
    assert(p.id && p.name && p.system === sys && p.file && typeof p.bytes === 'number', `Invalid part record in selected.json: ${JSON.stringify(p)}`);
  }
}
assert.equal(selectedTotal, 927, 'Total parts in selected.json must be 927');

console.log('\n>>> All Schema V2, Color compatibility, Integer representation, System key, and Deterministic Sort tests PASSED! <<<');
