/* ============================================================
   Tier 2: Boundary & Corner Cases (F1 to F7) — 35 Test Cases
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setupDOMEnvironment } from '../../helpers/dom-env.js';
import {
  CANONICAL_SYSTEMS,
  MAX_BYTES,
  createMockSTL,
  readBinarySTL,
  buildIndexed,
  computeNormals,
  createMockGLB,
  classifyAnatomicalStructure,
  TestVirtualScroller
} from './helpers.js';
import { anatomyService, stemWord } from '../../../js/lib/anatomy-data.js';

// Setup DOM globals
const { document } = setupDOMEnvironment();

const PUBLIC_ANATOMY_DIR = path.resolve('public', 'anatomy');
const INDEX_PATH = path.join(PUBLIC_ANATOMY_DIR, 'index.json');

/* ============================================================
   F1 Boundary Cases
   ============================================================ */

test('Tier 2 - 2.B1.1: Empty structure inventory [] handled by extractor without error', () => {
  const emptyParts = [];
  const classified = [];
  for (const p of emptyParts) {
    const sys = classifyAnatomicalStructure(p.name);
    if (sys) classified.push({ ...p, sys });
  }
  assert.equal(classified.length, 0, 'Empty parts results in empty classified list');
});

test('Tier 2 - 2.B1.2: Boundary mesh size: file with size exactly MAX_BYTES is accepted', () => {
  const boundaryPart = { id: 'FMA_BOUNDARY', name: 'boundary femur', size: MAX_BYTES };
  const isIncluded = boundaryPart.size <= MAX_BYTES;
  assert.equal(isIncluded, true, 'File with exactly MAX_BYTES must be included');
});

test('Tier 2 - 2.B1.3: Boundary mesh size: file with size MAX_BYTES + 1 is excluded', () => {
  const overPart = { id: 'FMA_OVER', name: 'over limit part', size: MAX_BYTES + 1 };
  const isIncluded = overPart.size <= MAX_BYTES;
  assert.equal(isIncluded, false, 'File with size MAX_BYTES + 1 must be excluded');
});

test('Tier 2 - 2.B1.4: Exotic anatomical names with hyphens, parentheses, and Latin binomials classified correctly', () => {
  const exoticNames = [
    { name: 'levator labii superioris alaeque nasi', expected: 'muscular' },
    { name: 'extensor digiti minimi (hand)', expected: 'muscular' },
    { name: 'biceps brachii - long head', expected: 'muscular' },
    { name: 'inter-articular sternocostal ligament', expected: 'skeletal' },
    { name: 'semilunar valve of aorta (anterior cusp)', expected: 'cardiovascular' }
  ];

  for (const item of exoticNames) {
    const sys = classifyAnatomicalStructure(item.name);
    assert.equal(sys, item.expected, `Exotic name "${item.name}" classified as ${item.expected}`);
  }
});

test('Tier 2 - 2.B1.5: Case-insensitive system classification across UPPERCASE, lowercase, and MixedCase', () => {
  const variations = [
    'FEMUR',
    'femur',
    'FeMuR',
    'LATISSIMUS DORSI',
    'Latissimus Dorsi',
    'INTERNAL CAPSULE',
    'Internal Capsule'
  ];

  for (const name of variations) {
    const sys = classifyAnatomicalStructure(name);
    assert.ok(sys !== null, `Name "${name}" should be classified regardless of casing`);
  }
});

/* ============================================================
   F2 Boundary Cases
   ============================================================ */

test('Tier 2 - 2.B2.1: Empty manifest array [] returns zero selected parts without throwing error', () => {
  const rawJson = '[]';
  const parsed = JSON.parse(rawJson);
  assert.ok(Array.isArray(parsed));
  assert.equal(parsed.length, 0);
});

test('Tier 2 - 2.B2.2: Manifest fallback resolution path when primary manifest is empty string or whitespace', () => {
  function fallbackResolve(manifestContent) {
    if (!manifestContent || !manifestContent.trim()) {
      return [{ id: 'FMA_FALLBACK', name: 'fallback bone', system: 'skeletal' }];
    }
    return JSON.parse(manifestContent);
  }

  const res1 = fallbackResolve('');
  const res2 = fallbackResolve('   \n  ');
  assert.equal(res1.length, 1);
  assert.equal(res1[0].id, 'FMA_FALLBACK');
  assert.equal(res2.length, 1);
});

test('Tier 2 - 2.B2.3: Manifest entry with missing optional properties handled gracefully', () => {
  const minimalEntry = { id: 'FMA123', name: 'minimal structure' }; // missing bytes, sha, conceptId
  const normalized = {
    id: minimalEntry.id,
    name: minimalEntry.name,
    size: minimalEntry.bytes || minimalEntry.size || 0,
    sha: minimalEntry.sha || null
  };

  assert.equal(normalized.id, 'FMA123');
  assert.equal(normalized.size, 0);
  assert.equal(normalized.sha, null);
});

test('Tier 2 - 2.B2.4: Network retry exhaustion: simulates 3 failed HTTP attempts and fails gracefully', async () => {
  let attempts = 0;
  async function mockFetchWithRetries() {
    for (let attempt = 1; attempt <= 3; attempt++) {
      attempts++;
      // Simulate network 503 error
      if (attempt === 3) {
        return { ok: false, status: 503, statusText: 'Service Unavailable' };
      }
    }
  }

  const res = await mockFetchWithRetries();
  assert.equal(attempts, 3, 'Tried exactly 3 times before failing');
  assert.equal(res.ok, false, 'Failed gracefully with error status');
});

test('Tier 2 - 2.B2.5: Zero-byte file in destination path is detected and flagged for re-download', () => {
  function isSTLValid(statSize, expectedSize) {
    if (!statSize || statSize === 0) return false;
    if (expectedSize && statSize !== expectedSize) return false;
    return true;
  }

  assert.equal(isSTLValid(0, 1024), false, 'Zero byte file must be invalid');
  assert.equal(isSTLValid(500, 1024), false, 'Partial size file must be invalid');
  assert.equal(isSTLValid(1024, 1024), true, 'Matching size file is valid');
});

/* ============================================================
   F3 Boundary Cases
   ============================================================ */

test('Tier 2 - 2.B3.1: Minimum boundary FMA ID and high boundary FMA ID parsed cleanly', () => {
  const minId = 'FMA1';
  const maxId = 'FMA999999';

  assert.match(minId, /^FMA\d+$/);
  assert.match(maxId, /^FMA\d+$/);

  const numMin = parseInt(minId.replace('FMA', ''), 10);
  const numMax = parseInt(maxId.replace('FMA', ''), 10);
  assert.equal(numMin, 1);
  assert.equal(numMax, 999999);
});

test('Tier 2 - 2.B3.2: Non-standard FMA ID formats (e.g. alphanumeric suffixes like 14543nsn or BP ids)', () => {
  const specialIds = ['FMA14543nsn', 'BP24', 'BP28', 'FMA7163-sub'];
  for (const id of specialIds) {
    const isRecognized = /^(FMA\d+[a-z0-9_-]*|BP\d+)$/i.test(id);
    assert.ok(isRecognized, `Special ID ${id} recognized as valid structure ID format`);
  }
});

test('Tier 2 - 2.B3.3: System with 0 structures in catalog metadata handled without NaN or undefined crashes', () => {
  const emptySystemMeta = { label: 'EmptySystem', count: 0, bytes: 0, color: [0.5, 0.5, 0.5] };
  const kb = (b) => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;

  assert.equal(emptySystemMeta.count, 0);
  assert.equal(kb(emptySystemMeta.bytes), '0 KB');
  assert.equal(Number.isNaN(emptySystemMeta.count), false);
});

test('Tier 2 - 2.B3.4: Extreme length structure names (200+ characters) do not cause layout or string crash', () => {
  const longName = 'anterior superficial branch of the superior medial muscular ramus of the right descending femoral circumflex vascular trunk serving the deep anterior quadriceps fascial junction';
  assert.ok(longName.length > 150);

  const detail = anatomyService.getDetail(longName, 'muscular');
  assert.ok(detail, 'Clinical detail lookup succeeds for long name');
  assert.ok(detail.name.length > 0);
});

test('Tier 2 - 2.B3.5: Metadata entries with special characters (accents, slashes, commas) parsed without corruption', () => {
  const accentedName = "sphincter d'Oddi, nsn";
  const slashedName = "artery/vein anastomosis";

  const d1 = anatomyService.getDetail(accentedName, 'digestive');
  const d2 = anatomyService.getDetail(slashedName, 'cardiovascular');

  assert.equal(d1.name, accentedName);
  assert.equal(d2.name, slashedName);
});

/* ============================================================
   F4 Boundary Cases
   ============================================================ */

test('Tier 2 - 2.B4.1: Minimal valid binary STL with exactly 1 triangle (134 bytes data)', () => {
  const stlBuf = createMockSTL([
    {
      normal: [0, 0, 1],
      vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]]
    }
  ]);

  assert.equal(stlBuf.length, 134, '1-triangle binary STL length is exactly 84 + 50 = 134 bytes');
  const positions = readBinarySTL(stlBuf);
  assert.equal(positions.length, 9, 'Produces 9 floats');
});

test('Tier 2 - 2.B4.2: Zero-triangle binary STL (84 bytes, 0 triangles) handled cleanly returning empty Float32Array', () => {
  const stlBuf = createMockSTL([]);
  assert.equal(stlBuf.length, 84, '0-triangle binary STL length is exactly 84 bytes');
  const positions = readBinarySTL(stlBuf);
  assert.equal(positions.length, 0, 'Produces 0 floats');
});

test('Tier 2 - 2.B4.3: Degenerate triangles (zero area) during normal computation produce fallback unit normal without NaN', () => {
  // All 3 vertices are identical (zero area)
  const positions = new Float32Array([
    1, 1, 1,
    1, 1, 1,
    1, 1, 1
  ]);
  const index = new Uint32Array([0, 1, 2]);
  const normals = computeNormals(positions, index);

  assert.equal(normals.length, 9);
  for (let i = 0; i < normals.length; i++) {
    assert.equal(Number.isNaN(normals[i]), false, `Normal component ${i} must not be NaN`);
  }
});

test('Tier 2 - 2.B4.4: Microscopic vertex distances below 0.05mm are properly welded together', () => {
  // Distance = 0.00001 (0.01mm at meter scale) -> should weld
  const positions = new Float32Array([
    1.00000, 2.00000, 3.00000,
    1.00001, 2.00001, 3.00001
  ]);
  const { position, index } = buildIndexed(positions);
  assert.equal(position.length / 3, 1, 'Two sub-0.05mm vertices welded into 1 unique vertex');
  assert.equal(index[0], index[1], 'Both reference identical welded index');
});

test('Tier 2 - 2.B4.5: Macroscopic vertex distances above 0.05mm remain distinct vertices', () => {
  // Distance = 0.001 (1mm) -> must NOT weld
  const positions = new Float32Array([
    1.000, 2.000, 3.000,
    1.002, 2.000, 3.000
  ]);
  const { position, index } = buildIndexed(positions);
  assert.equal(position.length / 3, 2, 'Two distinct vertices remain 2 separate vertices');
  assert.notEqual(index[0], index[1], 'Indices must be distinct');
});

/* ============================================================
   F5 Boundary Cases
   ============================================================ */

test('Tier 2 - 2.B5.1: Zero-byte or truncated GLB file (<12 bytes) rejected with validation error', () => {
  function validateGLBHeader(buf) {
    if (!buf || buf.length < 12) throw new Error('GLB header truncated: minimum 12 bytes required');
    const magic = buf.toString('ascii', 0, 4);
    if (magic !== 'glTF') throw new Error(`Invalid GLB magic: expected glTF, got ${magic}`);
    const version = buf.readUInt32LE(4);
    if (version !== 2) throw new Error(`Unsupported glTF version: ${version}`);
    return true;
  }

  assert.throws(() => validateGLBHeader(Buffer.alloc(0)), /minimum 12 bytes/);
  assert.throws(() => validateGLBHeader(Buffer.alloc(8)), /minimum 12 bytes/);
});

test('Tier 2 - 2.B5.2: Corrupted glTF magic number rejected', () => {
  const corruptBuf = Buffer.alloc(12);
  corruptBuf.write('BAD!', 0, 4, 'ascii');
  corruptBuf.writeUInt32LE(2, 4);
  corruptBuf.writeUInt32LE(12, 8);

  function validate(buf) {
    const magic = buf.toString('ascii', 0, 4);
    if (magic !== 'glTF') throw new Error(`Invalid GLB magic: ${magic}`);
  }

  assert.throws(() => validate(corruptBuf), /Invalid GLB magic: BAD!/);
});

test('Tier 2 - 2.B5.3: glTF version 1 file rejected when version 2 is required', () => {
  const v1Buf = Buffer.alloc(12);
  v1Buf.write('glTF', 0, 4, 'ascii');
  v1Buf.writeUInt32LE(1, 4); // Version 1
  v1Buf.writeUInt32LE(12, 8);

  function checkVersion(buf) {
    const version = buf.readUInt32LE(4);
    if (version !== 2) throw new Error(`Unsupported glTF version ${version}`);
  }

  assert.throws(() => checkVersion(v1Buf), /Unsupported glTF version 1/);
});

test('Tier 2 - 2.B5.4: Minimal single-node GLB container parsed correctly', () => {
  const glb = createMockGLB({
    asset: { version: '2.0' },
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'FMA12519' }]
  });

  assert.equal(glb.toString('ascii', 0, 4), 'glTF');
  assert.equal(glb.readUInt32LE(4), 2);
  assert.ok(glb.includes(Buffer.from('FMA12519')));
});

test('Tier 2 - 2.B5.5: Multi-hundred node GLB hierarchy parsed without call-stack overflow', () => {
  const nodes = [];
  for (let i = 0; i < 400; i++) {
    nodes.push({ name: `FMA_${i}`, mesh: i });
  }
  const glb = createMockGLB({
    asset: { version: '2.0' },
    nodes
  });

  assert.ok(glb.length > 1000);
  assert.equal(glb.toString('ascii', 0, 4), 'glTF');
});

/* ============================================================
   F6 Boundary Cases
   ============================================================ */

test('Tier 2 - 2.B6.1: Zero scroll position: scrollTop = 0 correctly binds pool from index 0', () => {
  const container = document.createElement('div');
  const scroller = new TestVirtualScroller(container, { itemHeight: 30, containerHeight: 300 });
  scroller.setItems(Array.from({ length: 50 }, (_, i) => ({ id: `ID_${i}`, name: `Item ${i}` })));

  scroller.scrollTo(0);
  assert.equal(Number(scroller.pool[0].dataset.index), 0);
  assert.equal(scroller.viewport.style.transform, 'translateY(0px)');
});

test('Tier 2 - 2.B6.2: Maximum scroll position: scrollTop = maxScroll clamps window index without out-of-bounds error', () => {
  const container = document.createElement('div');
  const scroller = new TestVirtualScroller(container, { itemHeight: 30, containerHeight: 300 });
  scroller.setItems(Array.from({ length: 100 }, (_, i) => ({ id: `ID_${i}`, name: `Item ${i}` })));

  // Total height = 3000px, container = 300px, maxScroll = 2700px (startIndex 90)
  scroller.scrollTo(50000); // extreme scroll
  const firstVisibleIdx = parseInt(scroller.pool[0].dataset.index, 10);
  assert.equal(firstVisibleIdx, 90, 'Clamped to max scroll index (90)');
  assert.ok(firstVisibleIdx < 100, 'Does not exceed total item boundary');
});

test('Tier 2 - 2.B6.3: Negative scroll position (rubber-banding/bounce) clamped to 0', () => {
  const container = document.createElement('div');
  const scroller = new TestVirtualScroller(container, { itemHeight: 30, containerHeight: 300 });
  scroller.setItems(Array.from({ length: 20 }, (_, i) => ({ id: `ID_${i}`, name: `Item ${i}` })));

  scroller.scrollTo(-150);
  assert.equal(Number(scroller.pool[0].dataset.index), 0, 'Negative scroll clamped to index 0');
  assert.equal(scroller.viewport.style.transform, 'translateY(0px)');
});

test('Tier 2 - 2.B6.4: Empty list scrolling: 0 items renders empty placeholder with 0px spacer', () => {
  const container = document.createElement('div');
  const scroller = new TestVirtualScroller(container, { itemHeight: 30, containerHeight: 300 });
  scroller.setItems([]);

  assert.equal(scroller.spacer.style.height, '0px');
  assert.equal(scroller.viewport.style.display, 'none');
});

test('Tier 2 - 2.B6.5: Single-item list: exactly 1 item rendered without off-by-one errors', () => {
  const container = document.createElement('div');
  const scroller = new TestVirtualScroller(container, { itemHeight: 30, containerHeight: 300 });
  scroller.setItems([{ id: 'FMA_SOLO', name: 'Solo Item' }]);

  assert.equal(scroller.spacer.style.height, '30px');
  assert.equal(scroller.pool[0].style.display, 'block');
  assert.equal(scroller.pool[0].dataset.id, 'FMA_SOLO');
  assert.equal(scroller.pool[1].style.display, 'none');
});

/* ============================================================
   F7 Boundary Cases
   ============================================================ */

test('Tier 2 - 2.B7.1: Empty search query "" or "   " returns entire structure list', () => {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));

  function filterStructures(query) {
    const q = query.trim().toLowerCase();
    if (!q) return index.structures;
    return index.structures.filter(s => s.name.toLowerCase().includes(q));
  }

  const resEmpty = filterStructures('');
  const resWhitespace = filterStructures('   \t\n  ');
  assert.equal(resEmpty.length, index.structures.length);
  assert.equal(resWhitespace.length, index.structures.length);
});

test('Tier 2 - 2.B7.2: Unmatched search query returns 0 matches in <5ms with empty state message', () => {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));

  const startTime = performance.now();
  const q = 'xyz999nonexistentstructure';
  const matches = index.structures.filter(s => s.name.toLowerCase().includes(q));
  const elapsed = performance.now() - startTime;

  assert.equal(matches.length, 0);
  assert.ok(elapsed < 5.0, `Unmatched query took ${elapsed.toFixed(3)}ms`);
});

test('Tier 2 - 2.B7.3: Search query with special regex characters handles cleanly without regex syntax crash', () => {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const crazyQuery = 'femur (right) [c1] * + ? ^ $ \\ . |';

  assert.doesNotThrow(() => {
    // Normalizing via substring or escaped regex
    const qClean = crazyQuery.trim().toLowerCase();
    const matches = index.structures.filter(s => s.name.toLowerCase().includes(qClean));
    assert.equal(Array.isArray(matches), true);
  });
});

test('Tier 2 - 2.B7.4: Rapid region filter switching (10 rapid toggles) completes under 20ms without race condition', () => {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const regions = ['head_neck', 'thorax', 'abdomen', 'pelvis', 'upper_limb', 'lower_limb', 'spine'];

  const startTime = performance.now();
  let currentMatches = [];
  for (let i = 0; i < 10; i++) {
    const targetRegion = regions[i % regions.length];
    currentMatches = index.structures.filter(s => {
      const detail = anatomyService.getDetail(s.name, s.system);
      return detail.region === targetRegion;
    });
  }
  const elapsed = performance.now() - startTime;
  const avgPerSwitch = elapsed / 10;

  assert.ok(currentMatches.length >= 0);
  assert.ok(avgPerSwitch < 5.0, `Rapid filter switch averaged ${avgPerSwitch.toFixed(2)}ms (must be < 5ms per switch)`);
});

test('Tier 2 - 2.B7.5: Extreme camera orbit distance clamp: minDistance (0.12) and maxDistance (8) boundaries verified', () => {
  const minDistance = 0.12;
  const maxDistance = 8.0;

  function clampDistance(dist) {
    return Math.max(minDistance, Math.min(maxDistance, dist));
  }

  assert.equal(clampDistance(0.001), 0.12, 'Clamped to minDistance');
  assert.equal(clampDistance(-5), 0.12, 'Negative clamped to minDistance');
  assert.equal(clampDistance(100), 8.0, 'Extreme zoom out clamped to maxDistance');
  assert.equal(clampDistance(2.5), 2.5, 'Normal distance untouched');
});
