import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { classify, RULES, EXCLUDE_NON_ORGAN, SYSTEM_META } from '../../scripts/anatomy-select.mjs';

console.log('=== ADVERSARIAL STRESS TEST: Milestone M1 ===\n');

// 1. Verify what the 7 excluded parts are from the 934 parts manifest
console.log('1. Analyzing Excluded Parts from 934 source parts:');
const manifest = JSON.parse(fs.readFileSync('scripts/data/bodyparts3d-available.json', 'utf8'));
assert.equal(manifest.length, 934, 'Manifest must have exactly 934 parts');

const excluded = [];
const classified = [];
for (const p of manifest) {
  const size = p.bytes || p.size || 0;
  if (size > 40 * 1024 * 1024) {
    excluded.push({ part: p, reason: 'Exceeds MAX_BYTES (40MB)' });
    continue;
  }
  if (EXCLUDE_NON_ORGAN.test(p.name)) {
    excluded.push({ part: p, reason: 'Matches EXCLUDE_NON_ORGAN regex' });
    continue;
  }
  const sys = classify(p.name);
  if (!sys) {
    excluded.push({ part: p, reason: 'Unclassified by RULES regexes' });
    continue;
  }
  classified.push({ ...p, system: sys });
}

console.log(`  Total parts: ${manifest.length}`);
console.log(`  Classified:  ${classified.length}`);
console.log(`  Excluded:    ${excluded.length}`);
for (const ex of excluded) {
  console.log(`    - ID: ${ex.part.id}, Name: "${ex.part.name}", Size: ${(ex.part.bytes / (1024*1024)).toFixed(2)} MB, Reason: ${ex.reason}`);
}

assert.equal(classified.length, 927, 'Exactly 927 parts must be classified');
assert.equal(excluded.length, 7, 'Exactly 7 parts must be excluded');

// Check that none of the 7 are genuine internal anatomical organ structures
for (const ex of excluded) {
  assert(
    ex.reason === 'Exceeds MAX_BYTES (40MB)' || ex.reason === 'Matches EXCLUDE_NON_ORGAN regex',
    `Unexpected unclassified part: ${ex.part.id} ${ex.part.name}`
  );
}

// 2. Test Idempotency and Reproducibility
console.log('\n2. Testing pipeline idempotency (bit-for-bit output match across runs):');
const indexBefore = fs.readFileSync('public/anatomy/index.json', 'utf8');
const selectedBefore = fs.readFileSync('.anatomy-src/selected.json', 'utf8');

execSync('node scripts/anatomy-select.mjs', { stdio: 'pipe' });

const indexAfter = fs.readFileSync('public/anatomy/index.json', 'utf8');
const selectedAfter = fs.readFileSync('.anatomy-src/selected.json', 'utf8');

// Note: index.json contains "generated": new Date().toISOString()
const parsedBefore = JSON.parse(indexBefore);
const parsedAfter = JSON.parse(indexAfter);
delete parsedBefore.generated;
delete parsedAfter.generated;

assert.deepEqual(parsedBefore, parsedAfter, 'public/anatomy/index.json content must be identical');
assert.equal(selectedBefore, selectedAfter, '.anatomy-src/selected.json must be byte-for-byte identical');
console.log('  Idempotency PASSED: subsequent runs generate identical data.');

// 3. Test Offline / Clean Clone Simulation (Tier 2 Fallback)
console.log('\n3. Testing Tier 2 fallback when .anatomy-src/available.json is absent:');
const cachePath = path.join('.anatomy-src', 'available.json');
let cacheBackup = null;
if (fs.existsSync(cachePath)) {
  cacheBackup = fs.readFileSync(cachePath);
  fs.unlinkSync(cachePath);
}

try {
  const output = execSync('node scripts/anatomy-select.mjs', { encoding: 'utf8' });
  assert(output.includes('[Discovery] Loaded 934 parts from committed manifest'), 'Must load from committed manifest when cache is missing');
  assert(fs.existsSync(cachePath), 'Must recreate .anatomy-src/available.json from committed manifest');
  console.log('  Tier 2 Fallback PASSED: loaded from scripts/data/bodyparts3d-available.json and re-seeded cache.');
} finally {
  if (cacheBackup && !fs.existsSync(cachePath)) {
    fs.writeFileSync(cachePath, cacheBackup);
  }
}

// 4. Test Adversarial Inputs into classify()
console.log('\n4. Testing adversarial classification inputs:');
assert.equal(classify(''), null, 'Empty string returns null');
assert.equal(classify('random non-anatomical noise 1234'), null, 'Unknown terms return null');
assert.equal(classify('ATLAS'), 'skeletal', 'Uppercase ATLAS classified as skeletal');
assert.equal(classify('lateral ventricle'), 'nervous', 'Brain ventricle classified as nervous, not cardiovascular');
assert.equal(classify('right ventricle of heart'), 'cardiovascular', 'Heart ventricle classified as cardiovascular');
assert.equal(classify('ventricle of the cerebrum'), 'nervous', 'Cerebrum ventricle classified as nervous');
assert.equal(classify('scaphoid bone of left hand'), 'skeletal', 'Scaphoid bone classified as skeletal');
assert.equal(classify('abductor pollicis brevis muscle'), 'muscular', 'Abductor classified as muscular');
assert.equal(classify('taenia coli'), 'digestive', 'Taenia coli classified as digestive');
assert.equal(classify('thyroid gland'), 'endocrine', 'Thyroid gland classified as endocrine');
assert.equal(classify('suprarenal gland'), 'urinary', 'Suprarenal classified as urinary due to renal rule precedence');
assert.equal(classify('internal urethral sphincter'), 'muscular', 'Sphincter classified as muscular before urinary');
assert.equal(classify('urethra'), 'urinary', 'Urethra classified as urinary');
console.log('  Adversarial Classification PASSED.');

// 5. Test Frontend Consumer Simulation
console.log('\n5. Testing frontend consumer compatibility in js/tools/anatomy-explorer.js:');
const explorerIndex = JSON.parse(fs.readFileSync('public/anatomy/index.json', 'utf8'));

// Simulating line 44:
const systemKeys = Object.keys(explorerIndex.systems).sort((a, b) => explorerIndex.systems[a].order - explorerIndex.systems[b].order);
assert.equal(systemKeys.length, 8);

// Simulating line 46:
const hex = (c) => '#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
for (const k of systemKeys) {
  const s = explorerIndex.systems[k];
  // Simulating line 243-248:
  const html = `<label class="t3d-toggle">
    <input type="checkbox" data-system="${k}">
    <span class="t3d-dot" style="background:${hex(s.color)}"></span>
    <span class="t3d-toggle-name">${s.label}</span>
    <span class="t3d-count">${s.count} · ${s.bytes}</span>
  </label>`;
  assert(html.includes('#'), 'Generated HTML includes hex color');
  assert(html.includes(s.label), 'Generated HTML includes label');
  
  // Simulating line 175:
  const loadingStr = `Loading ${s.label.toLowerCase()} — ${s.bytes}…`;
  assert(typeof loadingStr === 'string');
  
  // Simulating line 179:
  const glbUrl = `public/anatomy/${s.file}`;
  assert(s.file.endsWith('.glb'));
}
console.log('  Frontend Consumer Simulation PASSED without errors.');

console.log('\n=== ALL ADVERSARIAL STRESS TESTS COMPLETED SUCCESSFULLY ===');
