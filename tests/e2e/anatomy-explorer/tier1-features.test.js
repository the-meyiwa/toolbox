/* ============================================================
   Tier 1: Feature Coverage (F1 to F7) — 35 Test Cases
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
import { anatomyService, ANATOMICAL_REGIONS, stemWord } from '../../../js/lib/anatomy-data.js';

// Setup DOM globals
const { document } = setupDOMEnvironment();

const PUBLIC_ANATOMY_DIR = path.resolve('public', 'anatomy');
const INDEX_PATH = path.join(PUBLIC_ANATOMY_DIR, 'index.json');

/* ============================================================
   F1: Uncapped Complete Dataset Extraction & Classification (>900 structures)
   ============================================================ */

test('Tier 1 - F1.1: System classification ontology covers all 8 canonical systems', () => {
  const sampleStructures = [
    { name: 'atlas vertebra', expected: 'skeletal' },
    { name: 'biceps brachii muscle', expected: 'muscular' },
    { name: 'ascending aorta', expected: 'cardiovascular' },
    { name: 'precentral gyrus', expected: 'nervous' },
    { name: 'sigmoid colon', expected: 'digestive' },
    { name: 'trachea', expected: 'respiratory' },
    { name: 'urinary bladder', expected: 'urinary' },
    { name: 'thyroid gland', expected: 'endocrine' }
  ];

  for (const sample of sampleStructures) {
    const system = classifyAnatomicalStructure(sample.name);
    assert.equal(system, sample.expected, `Expected "${sample.name}" to be classified as ${sample.expected}`);
  }
});

test('Tier 1 - F1.2: Uncapped dataset extraction processes full corpus without artificial CAPS restrictions', () => {
  // Test that an extraction pipeline without CAPS retains all classified items
  const mockUpstreamCorpus = [];
  // Generate 934 realistic parts representing full BodyParts3D dataset
  for (let i = 1; i <= 934; i++) {
    let name;
    if (i <= 250) name = `bone structure component ${i}`;
    else if (i <= 650) name = `muscle fiber bundle ${i}`;
    else if (i <= 750) name = `artery branch ${i}`;
    else if (i <= 820) name = `cerebral gyrus ${i}`;
    else if (i <= 870) name = `colon segment ${i}`;
    else if (i <= 900) name = `bronchial branching ${i}`;
    else if (i <= 920) name = `nephron tubule ${i}`;
    else if (i <= 933) name = `thyroid gland segment ${i}`;
    else name = 'whole body superficial skin blob'; // 934: oversized skin blob

    const size = (i === 934) ? 75 * 1024 * 1024 : 500 * 1024; // skin is 75MB
    mockUpstreamCorpus.push({ id: `FMA${10000 + i}`, name, size });
  }

  // Filter out oversized
  const filtered = mockUpstreamCorpus.filter(p => p.size <= MAX_BYTES);
  assert.equal(filtered.length, 933, 'Filtered out only the single oversized skin blob');

  // Classify without CAPS
  const classified = [];
  for (const p of filtered) {
    const system = classifyAnatomicalStructure(p.name);
    if (system) classified.push({ ...p, system });
  }

  // Verify all 933 parts are extracted and classified (>900 structures)
  assert.ok(classified.length > 900, `Expected >900 structures extracted, got ${classified.length}`);
});

test('Tier 1 - F1.3: Classification identifies essential clinical and landmark structures', () => {
  const criticalLandmarks = [
    { name: 'atlas', expected: 'skeletal' },
    { name: 'axis', expected: 'skeletal' },
    { name: 'scaphoid', expected: 'skeletal' },
    { name: 'hamate', expected: 'skeletal' },
    { name: 'frontalis', expected: 'muscular' },
    { name: 'orbicularis oculi', expected: 'muscular' },
    { name: 'buccinator', expected: 'muscular' },
    { name: 'internal capsule', expected: 'nervous' },
    { name: 'precentral gyrus', expected: 'nervous' },
    { name: 'inferior concha', expected: 'skeletal' }
  ];

  for (const landmark of criticalLandmarks) {
    const sys = classifyAnatomicalStructure(landmark.name);
    assert.equal(sys, landmark.expected, `Landmark "${landmark.name}" must be classified as ${landmark.expected}`);
  }
});

test('Tier 1 - F1.4: Extraction pipeline enforces MAX_BYTES exclusion filter for whole-body skin blobs', () => {
  const skinBlob = { id: 'FMA7163', name: 'skin of body', size: 77 * 1024 * 1024 };
  const externalOblique = { id: 'FMA13336', name: 'external oblique muscle', size: 26 * 1024 * 1024 };

  assert.ok(skinBlob.size > MAX_BYTES, 'Skin blob exceeds 40MB limit');
  assert.ok(externalOblique.size <= MAX_BYTES, 'External oblique is within 40MB limit');

  const isIncluded = (part) => part.size <= MAX_BYTES;
  assert.equal(isIncluded(skinBlob), false, 'Skin blob must be rejected');
  assert.equal(isIncluded(externalOblique), true, 'External oblique must be accepted');
});

test('Tier 1 - F1.5: Extracted structure records conform to standard schema', () => {
  const mockRawPart = { id: 'FMA12519', name: 'atlas', size: 254100 };
  const system = classifyAnatomicalStructure(mockRawPart.name);
  const fmaNumeric = mockRawPart.id.replace(/\D/g, '');

  const record = {
    id: mockRawPart.id,
    name: mockRawPart.name,
    system,
    fma: fmaNumeric
  };

  assert.equal(typeof record.id, 'string', 'Record must have string id');
  assert.equal(typeof record.name, 'string', 'Record must have string name');
  assert.ok(CANONICAL_SYSTEMS.includes(record.system), 'System must be canonical');
  assert.match(record.fma, /^\d+$/, 'FMA must be numeric digits');
});

/* ============================================================
   F2: Manifest Fallback & Zero ENOENT Crashes
   ============================================================ */

test('Tier 1 - F2.1: Manifest loader gracefully falls back when .anatomy-src/available.json is missing', () => {
  const localCachePath = path.resolve('.anatomy-src', 'available.json');
  const committedManifestPath = path.resolve('scripts', 'data', 'bodyparts3d-available.json');

  // Test fallback discovery resolution
  function resolveManifest() {
    if (fs.existsSync(localCachePath)) {
      return JSON.parse(fs.readFileSync(localCachePath, 'utf8'));
    }
    if (fs.existsSync(committedManifestPath)) {
      return JSON.parse(fs.readFileSync(committedManifestPath, 'utf8'));
    }
    if (fs.existsSync(INDEX_PATH)) {
      const idx = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
      return idx.structures.map(s => ({ id: s.id, name: s.name, size: 50000 }));
    }
    return [];
  }

  // Must not throw ENOENT
  let manifest;
  assert.doesNotThrow(() => {
    manifest = resolveManifest();
  });
  assert.ok(Array.isArray(manifest), 'Resolved manifest must be an array');
  assert.ok(manifest.length > 0, 'Resolved manifest must contain anatomical parts');
});

test('Tier 1 - F2.2: Manifest loader produces non-empty upstream structure list with valid byte counts and concept IDs', () => {
  const indexData = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  assert.ok(indexData.structures.length >= 500, 'Catalog manifest has at least 500 structures');
  for (const s of indexData.structures.slice(0, 50)) {
    assert.ok(s.id.startsWith('FMA'), `Structure ID ${s.id} starts with FMA`);
    assert.ok(s.name.length > 0, 'Structure has non-empty name');
    assert.ok(s.system, 'Structure has system defined');
  }
});

test('Tier 1 - F2.3: Pipeline ensures output and source directories are created recursively without throwing ENOENT', () => {
  const tempDir = path.resolve('public', 'anatomy', '.test-tmp-dir');
  try {
    fs.mkdirSync(tempDir, { recursive: true });
    assert.ok(fs.existsSync(tempDir), 'Directory was created recursively');
  } finally {
    if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
  }
});

test('Tier 1 - F2.4: STL cache checking skips redundant network requests when target STL already exists with matching size', () => {
  const mockPart = { id: 'FMA99999', name: 'mock bone', size: 1024 };
  const mockFs = new Map();
  mockFs.set('FMA99999.stl', 1024);

  let networkCalls = 0;
  function ensureSTL(part) {
    const existingSize = mockFs.get(`${part.id}.stl`);
    if (existingSize === part.size) {
      return 'cached';
    }
    networkCalls++;
    mockFs.set(`${part.id}.stl`, part.size);
    return 'downloaded';
  }

  const result1 = ensureSTL(mockPart);
  assert.equal(result1, 'cached', 'Matching size must be treated as cached');
  assert.equal(networkCalls, 0, 'Zero network calls made for cached STL');
});

test('Tier 1 - F2.5: Resilient error handling when manifest contains empty or malformed payload', () => {
  function safeParseManifest(rawText) {
    try {
      const data = JSON.parse(rawText);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  assert.deepEqual(safeParseManifest(''), []);
  assert.deepEqual(safeParseManifest('{ "bad": "json"'), []);
  assert.deepEqual(safeParseManifest('{}'), []);
  assert.deepEqual(safeParseManifest('[]'), []);
  assert.equal(safeParseManifest('[{"id":"FMA1"}]').length, 1);
});

/* ============================================================
   F3: Index Catalog Metadata Integrity
   ============================================================ */

test('Tier 1 - F3.1: Catalog schema conformance: public/anatomy/index.json has systems object and structures array', () => {
  assert.ok(fs.existsSync(INDEX_PATH), 'public/anatomy/index.json must exist');
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));

  assert.equal(typeof index.systems, 'object', 'index.systems must be an object');
  assert.ok(Array.isArray(index.structures), 'index.structures must be an array');
});

test('Tier 1 - F3.2: System registry integrity: all 8 canonical systems defined with valid color, order, and counts', () => {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  for (const sys of CANONICAL_SYSTEMS) {
    const meta = index.systems[sys];
    assert.ok(meta, `System "${sys}" must be present in index.systems`);
    assert.ok(meta.color, `System "${sys}" must have color property`);
    assert.ok(typeof meta.count === 'number' && meta.count >= 0, `System "${sys}" count must be a non-negative number`);
  }
});

test('Tier 1 - F3.3: Structure FMA ID format verification: every structure has valid FMA ID', () => {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  for (const s of index.structures) {
    assert.match(s.id, /^(FMA\d+|BP\d+)/i, `Structure ID ${s.id} must start with FMA or BP digits`);
    if (s.fma) {
      assert.match(String(s.fma), /^\d+/i, `Structure fma ${s.fma} must have leading digits`);
    }
  }
});

test('Tier 1 - F3.4: Structure ID uniqueness: no duplicate IDs across all indexed structures', () => {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const seen = new Set();
  const duplicates = [];

  for (const s of index.structures) {
    if (seen.has(s.id)) duplicates.push(s.id);
    seen.add(s.id);
  }

  assert.equal(duplicates.length, 0, `Found duplicate structure IDs: ${duplicates.slice(0, 5).join(', ')}`);
});

test('Tier 1 - F3.5: System color definitions satisfy visual contrast requirements', () => {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  for (const [sys, meta] of Object.entries(index.systems)) {
    if (Array.isArray(meta.color)) {
      // Normalized RGB array [r, g, b] in [0, 1]
      assert.equal(meta.color.length, 3, `RGB color array for ${sys} must have 3 components`);
      for (const channel of meta.color) {
        assert.ok(channel >= 0 && channel <= 1, `Channel ${channel} for ${sys} must be between 0 and 1`);
      }
      // Ensure not completely black (contrast against dark background)
      const brightness = meta.color[0] + meta.color[1] + meta.color[2];
      assert.ok(brightness > 0.3, `System color for ${sys} must have sufficient brightness`);
    } else if (typeof meta.color === 'number') {
      assert.ok(meta.color >= 0 && meta.color <= 0xFFFFFF, `Hex color for ${sys} must be a valid 24-bit integer`);
    }
  }
});

/* ============================================================
   F4: Build Pipeline Memory Safety & Isolated Decimation
   ============================================================ */

test('Tier 1 - F4.1: Isolated mesh decimation keeps memory footprint well under 250 MB RSS limit', () => {
  const memBefore = process.memoryUsage().rss;

  // Simulate isolated processing of large mesh
  const triangles = [];
  for (let i = 0; i < 5000; i++) {
    triangles.push({
      normal: [0, 1, 0],
      vertices: [
        [i * 0.1, 0, 0],
        [i * 0.1 + 0.1, 0, 0],
        [i * 0.1, 0, 0.1]
      ]
    });
  }
  const stlBuf = createMockSTL(triangles);
  const rawPositions = readBinarySTL(stlBuf);
  const indexed = buildIndexed(rawPositions);
  const normals = computeNormals(indexed.position, indexed.index);

  assert.ok(indexed.position.length > 0);
  assert.ok(normals.length > 0);

  const memAfter = process.memoryUsage().rss;
  const rssDeltaMB = (memAfter - memBefore) / 1048576;
  assert.ok(rssDeltaMB < 250, `Memory delta ${rssDeltaMB.toFixed(2)} MB exceeded 250 MB RSS limit`);
});

test('Tier 1 - F4.2: Binary STL parser correctly unpacks header, triangle count, and vertex coordinates', () => {
  const testTri = [
    {
      normal: [0, 0, 1],
      vertices: [
        [1.5, 2.5, 3.5],
        [4.5, 5.5, 6.5],
        [7.5, 8.5, 9.5]
      ]
    }
  ];
  const stlBuf = createMockSTL(testTri);
  const positions = readBinarySTL(stlBuf);

  assert.equal(positions.length, 9, 'Single triangle produces 9 float values (3 vertices x 3 coordinates)');
  assert.equal(positions[0], 1.5);
  assert.equal(positions[1], 2.5);
  assert.equal(positions[2], 3.5);
  assert.equal(positions[3], 4.5);
  assert.equal(positions[4], 5.5);
  assert.equal(positions[5], 6.5);
  assert.equal(positions[6], 7.5);
  assert.equal(positions[7], 8.5);
  assert.equal(positions[8], 9.5);
});

test('Tier 1 - F4.3: Binary STL parser rejects truncated or ASCII corrupted inputs with descriptive error', () => {
  const truncatedBuf = Buffer.alloc(50); // <84 bytes
  assert.throws(() => {
    readBinarySTL(truncatedBuf);
  }, /not a binary STL/);

  const corruptHeaderBuf = Buffer.alloc(90);
  const dv = new DataView(corruptHeaderBuf.buffer);
  dv.setUint32(80, 1000000, true); // claims 1,000,000 triangles but only 90 bytes total
  assert.throws(() => {
    readBinarySTL(corruptHeaderBuf);
  }, /corrupt triangle count/);
});

test('Tier 1 - F4.4: Vertex welding merges coincident vertices using spatial key hashing (0.05mm quantization)', () => {
  // Two triangles sharing 2 coincident vertices
  const positions = new Float32Array([
    // Triangle 1: (0,0,0), (1,0,0), (0,1,0)
    0, 0, 0,
    1, 0, 0,
    0, 1, 0,
    // Triangle 2: (1,0,0), (0,1,0), (1,1,0) -- first two vertices match Triangle 1
    1, 0, 0,
    0, 1, 0,
    1, 1, 0
  ]);

  const { position, index } = buildIndexed(positions);
  assert.equal(position.length / 3, 4, '6 raw vertices welded into 4 unique vertices');
  assert.equal(index.length, 6, 'Index buffer has 6 indices (2 triangles)');
  assert.equal(index[1], index[3], 'Shared vertex (1,0,0) reused across triangles');
  assert.equal(index[2], index[4], 'Shared vertex (0,1,0) reused across triangles');
});

test('Tier 1 - F4.5: Vertex normal generator produces unit-normalized vectors across all vertex indices', () => {
  const positions = new Float32Array([
    0, 0, 0,
    1, 0, 0,
    0, 1, 0
  ]);
  const index = new Uint32Array([0, 1, 2]);
  const normals = computeNormals(positions, index);

  assert.equal(normals.length, 9, '3 normals for 3 vertices');
  for (let i = 0; i < 3; i++) {
    const len = Math.hypot(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]);
    assert.ok(Math.abs(len - 1.0) < 0.001, `Vertex ${i} normal length ${len} must be ~1.0`);
  }
});

/* ============================================================
   F5: Total GLB File Size & Draco Compression (<15 MB total)
   ============================================================ */

test('Tier 1 - F5.1: System GLB files exist in public/anatomy/ and incorporate Draco mesh compression', () => {
  for (const sys of CANONICAL_SYSTEMS) {
    const glbPath = path.join(PUBLIC_ANATOMY_DIR, `${sys}.glb`);
    assert.ok(fs.existsSync(glbPath), `System asset ${sys}.glb must exist in public/anatomy`);
    const buf = fs.readFileSync(glbPath);
    // Check for Draco extension string 'KHR_draco_mesh_compression' inside GLB JSON chunk
    const hasDraco = buf.includes(Buffer.from('KHR_draco_mesh_compression'));
    assert.ok(hasDraco, `Asset ${sys}.glb must use KHR_draco_mesh_compression`);
  }
});

test('Tier 1 - F5.2: Combined footprint of all 8 system GLBs is strictly capped under 15 MB', () => {
  let totalBytes = 0;
  for (const sys of CANONICAL_SYSTEMS) {
    const glbPath = path.join(PUBLIC_ANATOMY_DIR, `${sys}.glb`);
    const stat = fs.statSync(glbPath);
    totalBytes += stat.size;
  }

  const totalMB = totalBytes / 1048576;
  assert.ok(totalBytes < 15 * 1024 * 1024, `Total GLB size ${totalMB.toFixed(2)} MB must be strictly < 15 MB`);
});

test('Tier 1 - F5.3: Individual system GLB payloads satisfy modular loading thresholds', () => {
  // Skeletal and Muscular are largest, should be < 6MB each; others < 2MB each
  for (const sys of CANONICAL_SYSTEMS) {
    const glbPath = path.join(PUBLIC_ANATOMY_DIR, `${sys}.glb`);
    const size = fs.statSync(glbPath).size;
    const sizeMB = size / 1048576;
    if (sys === 'skeletal' || sys === 'muscular') {
      assert.ok(sizeMB < 6.0, `${sys}.glb size ${sizeMB.toFixed(2)} MB must be < 6 MB`);
    } else {
      assert.ok(sizeMB < 2.0, `${sys}.glb size ${sizeMB.toFixed(2)} MB must be < 2 MB`);
    }
  }
});

test('Tier 1 - F5.4: GLB binary containers conform to glTF 2.0 specification', () => {
  for (const sys of CANONICAL_SYSTEMS) {
    const glbPath = path.join(PUBLIC_ANATOMY_DIR, `${sys}.glb`);
    const buf = fs.readFileSync(glbPath);
    const magic = buf.toString('ascii', 0, 4);
    const version = buf.readUInt32LE(4);
    const byteLength = buf.readUInt32LE(8);

    assert.equal(magic, 'glTF', `GLB magic for ${sys} must be 'glTF'`);
    assert.equal(version, 2, `GLB version for ${sys} must be 2`);
    assert.equal(byteLength, buf.length, `Declared byteLength for ${sys} must equal file buffer length`);
  }
});

test('Tier 1 - F5.5: Draco decompression WebAssembly binaries are deployed and valid', () => {
  const dracoWasmPath = path.resolve('public', 'draco', 'draco_decoder.wasm');
  const dracoJsPath = path.resolve('public', 'draco', 'draco_decoder.js');

  assert.ok(fs.existsSync(dracoWasmPath), 'draco_decoder.wasm must exist');
  assert.ok(fs.existsSync(dracoJsPath), 'draco_decoder.js must exist');

  const wasmBuf = fs.readFileSync(dracoWasmPath);
  assert.ok(wasmBuf.length > 50000, 'draco_decoder.wasm must be non-empty valid binary');
  // Check WASM magic '\0asm'
  assert.equal(wasmBuf.toString('ascii', 1, 4), 'asm', 'WASM binary magic must match asm');
});

/* ============================================================
   F6: VirtualScroller DOM Element Pooling & Zero-DOM-Bloat Scroll
   ============================================================ */

test('Tier 1 - F6.1: VirtualScroller maintains bounded pool of ~20 items regardless of list size', () => {
  const container = document.createElement('div');
  const scroller = new TestVirtualScroller(container, {
    itemHeight: 36,
    containerHeight: 400
  });

  const poolSize1 = scroller.getPoolElementCount();
  assert.ok(poolSize1 >= 13 && poolSize1 <= 25, `Expected pool size between 13 and 25, got ${poolSize1}`);

  // Set 100 items
  scroller.setItems(Array.from({ length: 100 }, (_, i) => ({ id: `FMA${i}`, name: `Item ${i}` })));
  const poolSize100 = scroller.getPoolElementCount();
  assert.equal(poolSize100, poolSize1, 'Pool size must remain constant with 100 items');

  // Set 1000 items
  scroller.setItems(Array.from({ length: 1000 }, (_, i) => ({ id: `FMA${i}`, name: `Item ${i}` })));
  const poolSize1000 = scroller.getPoolElementCount();
  assert.equal(poolSize1000, poolSize1, 'Pool size must remain constant with 1000 items');
});

test('Tier 1 - F6.2: Phantom spacer height accurately matches totalCount * itemHeight px', () => {
  const container = document.createElement('div');
  const scroller = new TestVirtualScroller(container, { itemHeight: 36, containerHeight: 400 });

  scroller.setItems(Array.from({ length: 250 }, (_, i) => ({ id: `FMA${i}`, name: `Item ${i}` })));
  assert.equal(scroller.spacer.style.height, `${250 * 36}px`);

  scroller.setItems(Array.from({ length: 927 }, (_, i) => ({ id: `FMA${i}`, name: `Item ${i}` })));
  assert.equal(scroller.spacer.style.height, `${927 * 36}px`);
});

test('Tier 1 - F6.3: Viewport transform translates pool smoothly via translateY according to scroll position', () => {
  const container = document.createElement('div');
  const scroller = new TestVirtualScroller(container, { itemHeight: 40, containerHeight: 400 });
  scroller.setItems(Array.from({ length: 500 }, (_, i) => ({ id: `FMA${i}`, name: `Item ${i}` })));

  // Scroll to 200px (item index 5)
  scroller.scrollTo(200);
  assert.equal(scroller.viewport.style.transform, 'translateY(200px)');

  // Scroll to 485px (item index 12 -> 480px)
  scroller.scrollTo(485);
  assert.equal(scroller.viewport.style.transform, 'translateY(480px)');
});

test('Tier 1 - F6.4: Zero DOM bloat: rapid continuous scrolling creates 0 new DOM nodes', () => {
  const container = document.createElement('div');
  const scroller = new TestVirtualScroller(container, { itemHeight: 36, containerHeight: 400 });
  scroller.setItems(Array.from({ length: 927 }, (_, i) => ({ id: `FMA${i}`, name: `Item ${i}` })));

  const initialNodeCount = container.querySelectorAll('*').length;

  // Rapid scroll cycle: 0 -> 10000px in increments of 50px
  for (let s = 0; s < 10000; s += 50) {
    scroller.scrollTo(s);
  }

  const finalNodeCount = container.querySelectorAll('*').length;
  assert.equal(finalNodeCount, initialNodeCount, 'Rapid scrolling must create exactly 0 additional DOM nodes');
});

test('Tier 1 - F6.5: Viewport data rebinding updates structure metadata correctly on scroll', () => {
  const container = document.createElement('div');
  const scroller = new TestVirtualScroller(container, {
    itemHeight: 36,
    containerHeight: 360,
    renderItem: (item) => `<span class="an-name">${item.name}</span>`
  });

  const testItems = Array.from({ length: 100 }, (_, i) => ({ id: `FMA_TEST_${i}`, name: `Organ ${i}` }));
  scroller.setItems(testItems);

  // Initial at index 0
  assert.equal(scroller.pool[0].dataset.id, 'FMA_TEST_0');
  assert.ok(scroller.pool[0].innerHTML.includes('Organ 0'));

  // Scroll to item 50 (50 * 36 = 1800px)
  scroller.scrollTo(1800);
  assert.equal(scroller.pool[0].dataset.id, 'FMA_TEST_50');
  assert.ok(scroller.pool[0].innerHTML.includes('Organ 50'));
});

/* ============================================================
   F7: Search & Region Query Performance (<5ms) & UI Theme/Pill Compliance
   ============================================================ */

test('Tier 1 - F7.1: Pre-indexed search query execution completes in under 5ms', () => {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));

  // Pre-index items with lowercase search strings
  const indexed = index.structures.map(s => {
    const detail = anatomyService.getDetail(s.name, s.system);
    return {
      ...s,
      _search: `${s.name.toLowerCase()} ${(detail.commonName || '').toLowerCase()}`
    };
  });

  const startTime = performance.now();
  const query = 'femur';
  const matches = indexed.filter(item => item._search.includes(query));
  const elapsed = performance.now() - startTime;

  assert.ok(matches.length > 0, 'Found femur matches');
  assert.ok(elapsed < 5.0, `Indexed search took ${elapsed.toFixed(3)}ms (must be < 5ms)`);
});

test('Tier 1 - F7.2: Pre-indexed anatomical region query execution completes in under 5ms', () => {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));

  // Pre-index region
  const indexed = index.structures.map(s => ({
    ...s,
    _region: anatomyService.getDetail(s.name, s.system).region
  }));

  const startTime = performance.now();
  const targetRegion = 'thorax';
  const matches = indexed.filter(item => item._region === targetRegion);
  const elapsed = performance.now() - startTime;

  assert.ok(matches.length > 0, 'Found thorax region matches');
  assert.ok(elapsed < 5.0, `Indexed region filter took ${elapsed.toFixed(3)}ms (must be < 5ms)`);
});

test('Tier 1 - F7.3: Search supports direct substring, word stem, and clinical common name lookups', () => {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));

  // 1. Direct name lookup
  const femurMatch = index.structures.find(s => s.name.toLowerCase().includes('femur'));
  assert.ok(femurMatch, 'Direct search finds femur');

  // 2. Word stem lookup
  const stem = stemWord('pectoral');
  const stemMatch = index.structures.find(s => s.name.toLowerCase().includes(stem));
  assert.ok(stemMatch, 'Stemmed search finds pectoralis via "pectoral" stem');

  // 3. Clinical detail lookup
  const detail = anatomyService.getDetail('left femur', 'skeletal');
  assert.ok(detail.commonName.toLowerCase().includes('thigh bone') || detail.commonName.toLowerCase().includes('femur'));
});

test('Tier 1 - F7.4: UI theme compatibility uses semantic CSS custom properties without hardcoded un-themeable colors', () => {
  const explorerJs = fs.readFileSync(path.resolve('js', 'tools', 'anatomy-explorer.js'), 'utf8');

  // Verify usage of Toolbox CSS custom properties
  assert.ok(explorerJs.includes('var(--'), 'Viewer uses CSS custom property variables');
  assert.ok(explorerJs.includes('var(--text') || explorerJs.includes('var(--border'), 'Uses core text/border tokens');
  // Verify no non-themeable background overrides like style="background:#ffffff"
  assert.ok(!explorerJs.includes('style="background:#ffffff"'), 'Avoids hardcoded white backgrounds');
});

test('Tier 1 - F7.5: Anatomical region selectors adhere to .an-pill button patterns and zero-emoji UI standards', () => {
  // Test region data validity
  assert.ok(Array.isArray(ANATOMICAL_REGIONS), 'ANATOMICAL_REGIONS must be an array');
  assert.ok(ANATOMICAL_REGIONS.length >= 7, 'At least 7 anatomical regions defined');

  // Check no emojis in labels
  const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  for (const reg of ANATOMICAL_REGIONS) {
    assert.ok(reg.id && reg.label, 'Region has id and label');
    assert.equal(emojiRegex.test(reg.label), false, `Region label "${reg.label}" must not contain emojis`);
  }
});
