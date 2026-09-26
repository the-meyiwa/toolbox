/* ============================================================
   Milestone M1 Adversarial Challenge & Stress Test Suite
   Agent: Challenger M1-1 (teamwork_preview_challenger)
   Target: scripts/anatomy-select.mjs, manifests, and catalogs
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync, execSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const PROJECT_ROOT = path.resolve('.');
const SRC_DIR = path.join(PROJECT_ROOT, '.anatomy-src');
const TIER1_FILE = path.join(SRC_DIR, 'available.json');
const TIER2_FILE = path.join(PROJECT_ROOT, 'scripts', 'data', 'bodyparts3d-available.json');
const SELECTED_FILE = path.join(SRC_DIR, 'selected.json');
const INDEX_FILE = path.join(PROJECT_ROOT, 'public', 'anatomy', 'index.json');
const SELECT_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'anatomy-select.mjs');
const SELECT_SCRIPT_URL = pathToFileURL(SELECT_SCRIPT).href;

// Backups storage
const BACKUPS = {};

function backupFile(filePath, key) {
  if (fs.existsSync(filePath)) {
    BACKUPS[key] = fs.readFileSync(filePath);
  } else {
    BACKUPS[key] = null;
  }
}

function restoreFile(filePath, key) {
  if (BACKUPS[key] !== undefined) {
    if (BACKUPS[key] === null) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } else {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, BACKUPS[key]);
    }
  }
}

function backupAll() {
  backupFile(TIER1_FILE, 'tier1');
  backupFile(TIER2_FILE, 'tier2');
  backupFile(SELECTED_FILE, 'selected');
  backupFile(INDEX_FILE, 'index');
}

function restoreAll() {
  restoreFile(TIER1_FILE, 'tier1');
  restoreFile(TIER2_FILE, 'tier2');
  restoreFile(SELECTED_FILE, 'selected');
  restoreFile(INDEX_FILE, 'index');
}

const results = [];
let passCount = 0;
let failCount = 0;

function runTest(name, fn) {
  process.stdout.write(`  [CHALLENGE] ${name} ... `);
  const start = performance.now();
  try {
    fn();
    const duration = (performance.now() - start).toFixed(2);
    console.log(`PASSED (${duration}ms)`);
    results.push({ name, status: 'PASS', duration: `${duration}ms` });
    passCount++;
  } catch (err) {
    const duration = (performance.now() - start).toFixed(2);
    console.log(`FAILED (${duration}ms)`);
    console.error(`    Error: ${err.message}`);
    if (err.stack) {
      const lines = err.stack.split('\n').slice(1, 4).join('\n');
      console.error(`    ${lines}`);
    }
    results.push({ name, status: 'FAIL', duration: `${duration}ms`, error: err.message });
    failCount++;
  }
}

console.log('============================================================');
console.log('M1 ADVERSARIAL STRESS TEST SUITE — CHALLENGER M1-1');
console.log('============================================================\n');

backupAll();

try {
  /* ------------------------------------------------------------
     SUITE 1: Tier 1 Missing Fallback (.anatomy-src/available.json)
     ------------------------------------------------------------ */
  console.log('--- SUITE 1: Tier 1 Missing Fallback (.anatomy-src/available.json) ---');

  runTest('T1.1: Missing available.json falls back to Tier 2 committed manifest', () => {
    if (fs.existsSync(TIER1_FILE)) fs.unlinkSync(TIER1_FILE);
    assert.equal(fs.existsSync(TIER1_FILE), false, 'Tier 1 file must not exist');

    const proc = spawnSync(process.execPath, [SELECT_SCRIPT], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8'
    });

    assert.equal(proc.status, 0, `Expected exit 0, got ${proc.status}. stderr: ${proc.stderr}`);
    assert.match(proc.stdout, /\[Discovery\] Loaded 934 parts from committed manifest/, 'Must log fallback to committed manifest');
    assert.match(proc.stdout, /Classified 927 of 934 available parts/, 'Must classify 927 structures');
  });

  runTest('T1.2: Fallback to Tier 2 seeds local cache at .anatomy-src/available.json', () => {
    assert.ok(fs.existsSync(TIER1_FILE), 'available.json must be seeded');
    const seeded = JSON.parse(fs.readFileSync(TIER1_FILE, 'utf8'));
    assert.ok(Array.isArray(seeded), 'Seeded file must be array');
    assert.equal(seeded.length, 934, 'Seeded file must contain 934 parts');
  });

  runTest('T1.3: Subsequent execution hits newly seeded Tier 1 local cache', () => {
    const proc = spawnSync(process.execPath, [SELECT_SCRIPT], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8'
    });

    assert.equal(proc.status, 0, `Expected exit 0, got ${proc.status}`);
    assert.match(proc.stdout, /\[Discovery\] Loaded 934 parts from local cache/, 'Must hit local cache on second run');
  });

  /* ------------------------------------------------------------
     SUITE 2: Tier 1 Malformed Data & Edge Cases
     ------------------------------------------------------------ */
  console.log('\n--- SUITE 2: Tier 1 Malformed / Corrupted Data ---');

  runTest('T2.1: SyntaxError in available.json triggers warning and falls back to Tier 2', () => {
    fs.mkdirSync(SRC_DIR, { recursive: true });
    fs.writeFileSync(TIER1_FILE, '{"invalid_json": [true, false, ', 'utf8');

    const proc = spawnSync(process.execPath, [SELECT_SCRIPT], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8'
    });

    assert.equal(proc.status, 0, `Expected exit 0, got ${proc.status}`);
    assert.match(proc.stderr + proc.stdout, /Warning: Failed to parse .*available\.json/, 'Must warn about parse failure');
    assert.match(proc.stdout, /Loaded 934 parts from committed manifest/, 'Must fall back to committed manifest');
    
    // Verify it overwrote the corrupted file with valid JSON
    const restored = JSON.parse(fs.readFileSync(TIER1_FILE, 'utf8'));
    assert.equal(restored.length, 934, 'Must have repaired available.json with valid 934 parts');
  });

  runTest('T2.2: Zero-byte available.json falls back to Tier 2 committed manifest', () => {
    fs.writeFileSync(TIER1_FILE, '', 'utf8');

    const proc = spawnSync(process.execPath, [SELECT_SCRIPT], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8'
    });

    assert.equal(proc.status, 0, `Expected exit 0, got ${proc.status}`);
    assert.match(proc.stdout, /Loaded 934 parts from committed manifest/, 'Must fall back to committed manifest');
  });

  runTest('T2.3: Empty array `[]` in available.json falls back to Tier 2 committed manifest', () => {
    fs.writeFileSync(TIER1_FILE, '[]', 'utf8');

    const proc = spawnSync(process.execPath, [SELECT_SCRIPT], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8'
    });

    assert.equal(proc.status, 0, `Expected exit 0, got ${proc.status}`);
    assert.match(proc.stdout, /Loaded 934 parts from committed manifest/, 'Must fall back to committed manifest');
  });

  runTest('T2.4: Non-array object `{}` in available.json falls back to Tier 2 committed manifest', () => {
    fs.writeFileSync(TIER1_FILE, '{"structures": []}', 'utf8');

    const proc = spawnSync(process.execPath, [SELECT_SCRIPT], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8'
    });

    assert.equal(proc.status, 0, `Expected exit 0, got ${proc.status}`);
    assert.match(proc.stdout, /Loaded 934 parts from committed manifest/, 'Must fall back to committed manifest');
  });

  runTest('T2.5: Primitive JSON (string, number, null) in available.json falls back to Tier 2', () => {
    for (const primitive of ['"just a string"', '12345', 'null', 'true']) {
      fs.writeFileSync(TIER1_FILE, primitive, 'utf8');
      const proc = spawnSync(process.execPath, [SELECT_SCRIPT], {
        cwd: PROJECT_ROOT,
        encoding: 'utf8'
      });
      assert.equal(proc.status, 0, `Primitive ${primitive} failed with status ${proc.status}`);
      assert.match(proc.stdout, /Loaded 934 parts from committed manifest/);
    }
  });

  /* ------------------------------------------------------------
     SUITE 3: Offline / Air-Gapped Execution
     ------------------------------------------------------------ */
  console.log('\n--- SUITE 3: Offline & Air-Gapped Execution ---');

  runTest('T3.1: Complete offline execution when Tier 1 is absent (zero network calls)', () => {
    if (fs.existsSync(TIER1_FILE)) fs.unlinkSync(TIER1_FILE);

    // Run node script with network interception code prepended via -e wrapper or mock
    const wrapper = `
      // Intercept fetch to guarantee zero network calls are made
      globalThis.fetch = () => {
        throw new Error('AIR_GAPPED_VIOLATION: Attempted network request during offline run!');
      };
      await import(${JSON.stringify(SELECT_SCRIPT_URL)});
    `;

    const proc = spawnSync(process.execPath, ['--input-type=module', '-e', wrapper], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8'
    });

    assert.equal(proc.status, 0, `Air-gapped execution failed: ${proc.stderr}`);
    assert.doesNotMatch(proc.stderr, /AIR_GAPPED_VIOLATION/, 'Should not make any network calls');
    assert.match(proc.stdout, /Loaded 934 parts from committed manifest/);
  });

  runTest('T3.2: Air-gapped failure behavior when BOTH Tier 1 and Tier 2 are missing', () => {
    // Both missing -> must try Tier 3 and fail gracefully with network error
    if (fs.existsSync(TIER1_FILE)) fs.unlinkSync(TIER1_FILE);
    const tempBackupTier2 = TIER2_FILE + '.bak';
    fs.renameSync(TIER2_FILE, tempBackupTier2);

    try {
      const wrapper = `
        globalThis.fetch = async (url) => {
          throw new Error('getaddrinfo ENOTFOUND api.github.com (Air-Gapped)');
        };
        await import(${JSON.stringify(SELECT_SCRIPT_URL)});
      `;

      const proc = spawnSync(process.execPath, ['--input-type=module', '-e', wrapper], {
        cwd: PROJECT_ROOT,
        encoding: 'utf8'
      });

      assert.notEqual(proc.status, 0, 'Must exit with non-zero when offline and no manifests exist');
      assert.match(proc.stderr, /ENOTFOUND|Failed to fetch/, 'Must throw network exception descriptive of offline failure');
    } finally {
      if (fs.existsSync(tempBackupTier2)) {
        fs.renameSync(tempBackupTier2, TIER2_FILE);
      }
    }
  });

  /* ------------------------------------------------------------
     SUITE 4: Tier 2 (Committed Manifest) Resilience
     ------------------------------------------------------------ */
  console.log('\n--- SUITE 4: Tier 2 Committed Manifest Resilience ---');

  runTest('T4.1: Tier 1 missing and Tier 2 malformed syntax falls through to Tier 3', () => {
    if (fs.existsSync(TIER1_FILE)) fs.unlinkSync(TIER1_FILE);
    const tempBackupTier2 = TIER2_FILE + '.bak';
    fs.renameSync(TIER2_FILE, tempBackupTier2);

    try {
      fs.writeFileSync(TIER2_FILE, '{ corrupted json', 'utf8');

      const wrapper = `
        let fetchAttempted = false;
        globalThis.fetch = async (url) => {
          fetchAttempted = true;
          throw new Error('TIER_3_ATTEMPTED');
        };
        try {
          await import(${JSON.stringify(SELECT_SCRIPT_URL)});
        } catch (e) {
          if (e.message.includes('TIER_3_ATTEMPTED')) {
            console.log('SUCCESS_FELL_THROUGH_TO_TIER_3');
            process.exit(0);
          }
          console.error(e);
          process.exit(1);
        }
      `;

      const proc = spawnSync(process.execPath, ['--input-type=module', '-e', wrapper], {
        cwd: PROJECT_ROOT,
        encoding: 'utf8'
      });

      assert.match(proc.stdout, /SUCCESS_FELL_THROUGH_TO_TIER_3/, 'Must fall through to Tier 3 when Tier 2 is malformed');
    } finally {
      if (fs.existsSync(tempBackupTier2)) {
        if (fs.existsSync(TIER2_FILE)) fs.unlinkSync(TIER2_FILE);
        fs.renameSync(tempBackupTier2, TIER2_FILE);
      }
    }
  });

  runTest('T4.2: Tier 1 missing and Tier 2 empty array `[]` falls through to Tier 3', () => {
    if (fs.existsSync(TIER1_FILE)) fs.unlinkSync(TIER1_FILE);
    const tempBackupTier2 = TIER2_FILE + '.bak';
    fs.renameSync(TIER2_FILE, tempBackupTier2);

    try {
      fs.writeFileSync(TIER2_FILE, '[]', 'utf8');

      const wrapper = `
        let fetchAttempted = false;
        globalThis.fetch = async (url) => {
          fetchAttempted = true;
          throw new Error('TIER_3_ATTEMPTED');
        };
        try {
          await import(${JSON.stringify(SELECT_SCRIPT_URL)});
        } catch (e) {
          if (e.message.includes('TIER_3_ATTEMPTED')) {
            console.log('SUCCESS_FELL_THROUGH_TO_TIER_3');
            process.exit(0);
          }
          console.error(e);
          process.exit(1);
        }
      `;

      const proc = spawnSync(process.execPath, ['--input-type=module', '-e', wrapper], {
        cwd: PROJECT_ROOT,
        encoding: 'utf8'
      });

      assert.match(proc.stdout, /SUCCESS_FELL_THROUGH_TO_TIER_3/, 'Must fall through to Tier 3 when Tier 2 is empty array');
    } finally {
      if (fs.existsSync(tempBackupTier2)) {
        if (fs.existsSync(TIER2_FILE)) fs.unlinkSync(TIER2_FILE);
        fs.renameSync(tempBackupTier2, TIER2_FILE);
      }
    }
  });

  /* ------------------------------------------------------------
     SUITE 5: Performance & Memory Stress Testing
     ------------------------------------------------------------ */
  console.log('\n--- SUITE 5: Performance & Memory Stress Testing ---');

  runTest('T5.1: Pipeline cold run execution completes within 1000ms', () => {
    // Delete Tier 1 so it reads from committed manifest
    if (fs.existsSync(TIER1_FILE)) fs.unlinkSync(TIER1_FILE);

    const start = performance.now();
    const proc = spawnSync(process.execPath, [SELECT_SCRIPT], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8'
    });
    const elapsed = performance.now() - start;

    assert.equal(proc.status, 0, `Failed with ${proc.status}: ${proc.stderr}`);
    assert.ok(elapsed < 1000, `Execution took ${elapsed.toFixed(1)}ms, expected < 1000ms`);
  });

  runTest('T5.2: Memory footprint during selection pipeline remains < 100 MB RSS', () => {
    const memoryProbeScript = `
      import { loadAvailableParts, classify, generateCatalogs, EXCLUDE_NON_ORGAN, RULES } from './scripts/anatomy-select.mjs';
      
      const beforeMem = process.memoryUsage();
      const parts = await loadAvailableParts();
      
      const classified = [];
      for (const p of parts) {
        const size = p.bytes || p.size || 0;
        if (size > 40 * 1024 * 1024) continue;
        if (EXCLUDE_NON_ORGAN.test(p.name)) continue;
        const system = classify(p.name);
        if (!system) continue;
        classified.push({ ...p, system });
      }
      
      const { selectedBySystem, indexManifest } = generateCatalogs(classified);
      const afterMem = process.memoryUsage();
      
      const rssMb = (afterMem.rss / 1024 / 1024).toFixed(2);
      const heapUsedMb = (afterMem.heapUsed / 1024 / 1024).toFixed(2);
      console.log(JSON.stringify({ rssMb, heapUsedMb }));
    `;

    const proc = spawnSync(process.execPath, ['--input-type=module', '-e', memoryProbeScript], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8'
    });

    assert.equal(proc.status, 0, `Memory probe failed: ${proc.stderr}`);
    const mem = JSON.parse(proc.stdout.trim().split('\n').pop());
    const rss = parseFloat(mem.rssMb);
    const heap = parseFloat(mem.heapUsedMb);

    assert.ok(rss < 100, `RSS memory ${rss} MB exceeded 100 MB threshold`);
    assert.ok(heap < 50, `Heap memory ${heap} MB exceeded 50 MB threshold`);
  });

  runTest('T5.3: Scalability stress test with 10,000 synthetic anatomical parts', () => {
    const scaleStressScript = `
      import { classify, generateCatalogs, SYSTEM_META } from './scripts/anatomy-select.mjs';
      import { performance } from 'node:perf_hooks';

      const systems = Object.keys(SYSTEM_META);
      const organs = [
        'biceps muscle', 'femur bone', 'temporal artery', 'precentral gyrus',
        'transverse colon', 'bronchial tree', 'renal cortex', 'thyroid gland'
      ];

      const parts = [];
      for (let i = 0; i < 10000; i++) {
        const org = organs[i % organs.length];
        parts.push({
          id: 'FMA' + (20000 + i),
          name: 'structure ' + org + ' variant ' + i,
          system: systems[i % systems.length],
          bytes: 10000 + (i % 500)
        });
      }

      const start = performance.now();
      const { selectedBySystem, indexManifest } = generateCatalogs(parts);
      const duration = performance.now() - start;

      assert.equal(indexManifest.structures.length, 10000);
      assert.ok(duration < 500, 'Processing 10,000 structures must take < 500ms, took ' + duration + 'ms');
      console.log('SCALE_TEST_OK: ' + duration.toFixed(1) + 'ms');
    `;

    const proc = spawnSync(process.execPath, ['--input-type=module', '-e', scaleStressScript], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8'
    });

    assert.equal(proc.status, 0, `Scale test failed: ${proc.stderr}`);
    assert.match(proc.stdout, /SCALE_TEST_OK/);
  });

  runTest('T5.4: Leak / GC stability test: 50 repeated selection & catalog cycles', () => {
    const loopStressScript = `
      import { classify, generateCatalogs, SYSTEM_META, loadAvailableParts } from './scripts/anatomy-select.mjs';
      import fs from 'node:fs';
      
      const parts = await loadAvailableParts();
      const classified = parts.map(p => ({
        ...p,
        system: classify(p.name) || 'skeletal'
      }));

      // Stub fs.writeFileSync to avoid Windows NTFS file-lock contention during rapid tight loop
      fs.writeFileSync = () => {};

      const initialHeap = process.memoryUsage().heapUsed;
      for (let i = 0; i < 50; i++) {
        generateCatalogs(classified);
      }
      if (global.gc) global.gc();
      const finalHeap = process.memoryUsage().heapUsed;
      const heapGrowthMb = (finalHeap - initialHeap) / 1024 / 1024;
      
      // Heap growth over 50 iterations should be bounded (< 30 MB)
      assert.ok(heapGrowthMb < 30, 'Heap grew excessively: ' + heapGrowthMb + ' MB');
      console.log('LOOP_TEST_OK: growth ' + heapGrowthMb.toFixed(2) + ' MB');
    `;

    const proc = spawnSync(process.execPath, ['--expose-gc', '--input-type=module', '-e', loopStressScript], {
      cwd: PROJECT_ROOT,
      encoding: 'utf8'
    });

    assert.equal(proc.status, 0, `Loop stress failed: ${proc.stderr}`);
    assert.match(proc.stdout, /LOOP_TEST_OK/);
  });

  /* ------------------------------------------------------------
     SUITE 6: Schema V2 and Contract Verification
     ------------------------------------------------------------ */
  console.log('\n--- SUITE 6: Schema V2 & Interface Contracts ---');

  runTest('T6.1: public/anatomy/index.json conforms strictly to Schema Version 2', () => {
    // Run select to produce fresh catalog
    spawnSync(process.execPath, [SELECT_SCRIPT], { cwd: PROJECT_ROOT });

    const indexData = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    assert.equal(indexData.version, 2, 'Version must be 2');
    assert.ok(indexData.systems && typeof indexData.systems === 'object');
    assert.ok(Array.isArray(indexData.structures));
    assert.equal(indexData.structures.length, 927, 'Must have exactly 927 structures');

    const expectedSystems = ['skeletal', 'muscular', 'nervous', 'cardiovascular', 'respiratory', 'digestive', 'urinary', 'endocrine'];
    assert.deepEqual(Object.keys(indexData.systems).sort(), expectedSystems.sort());
  });

  runTest('T6.2: Dual-compatibility: index.json has both legacy and V2 property signatures', () => {
    const indexData = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));

    for (const [sysKey, meta] of Object.entries(indexData.systems)) {
      // V2 properties
      assert.equal(typeof meta.name, 'string', `${sysKey} missing name`);
      assert.equal(typeof meta.colorInt, 'number', `${sysKey} missing colorInt`);
      assert.equal(typeof meta.count, 'number', `${sysKey} missing count`);
      assert.ok(meta.count > 0, `${sysKey} count must be > 0`);

      // Legacy compatibility properties
      assert.equal(typeof meta.label, 'string', `${sysKey} missing label`);
      assert.ok(Array.isArray(meta.color) && meta.color.length === 3, `${sysKey} color must be [r,g,b] array`);
      assert.equal(typeof meta.file, 'string', `${sysKey} missing file`);
      assert.equal(typeof meta.bytes, 'number', `${sysKey} missing bytes`);
      assert.equal(typeof meta.order, 'number', `${sysKey} missing order`);
    }

    // Structures dual-compatibility
    for (const s of indexData.structures.slice(0, 50)) {
      assert.equal(typeof s.id, 'string');
      assert.equal(typeof s.name, 'string');
      assert.equal(typeof s.system, 'string');
      assert.ok(s.fma === null || typeof s.fma === 'string');
    }
  });

  runTest('T6.3: .anatomy-src/selected.json conforms to M1 ↔ M2 contract', () => {
    const sel = JSON.parse(fs.readFileSync(SELECTED_FILE, 'utf8'));
    const expectedSystems = ['skeletal', 'muscular', 'nervous', 'cardiovascular', 'respiratory', 'digestive', 'urinary', 'endocrine'];
    assert.deepEqual(Object.keys(sel).sort(), expectedSystems.sort());

    let totalParts = 0;
    for (const sys of expectedSystems) {
      assert.ok(Array.isArray(sel[sys]), `${sys} must be array`);
      totalParts += sel[sys].length;
      for (const item of sel[sys]) {
        assert.ok(item.id, 'Missing item.id');
        assert.ok(item.name, 'Missing item.name');
        assert.equal(item.system, sys);
        assert.ok(item.file.endsWith('.stl'), 'File must end with .stl');
        assert.equal(typeof item.bytes, 'number');
      }
    }
    assert.equal(totalParts, 927, 'Total selected parts must equal 927');
  });

  runTest('T6.4: Deterministic ordering across runs', () => {
    // Run select first time
    spawnSync(process.execPath, [SELECT_SCRIPT], { cwd: PROJECT_ROOT });
    const content1 = fs.readFileSync(INDEX_FILE, 'utf8');

    // Run select second time
    spawnSync(process.execPath, [SELECT_SCRIPT], { cwd: PROJECT_ROOT });
    const content2 = fs.readFileSync(INDEX_FILE, 'utf8');

    // Strip generated timestamp for deterministic comparison
    const parsed1 = JSON.parse(content1);
    const parsed2 = JSON.parse(content2);
    delete parsed1.generated;
    delete parsed2.generated;

    assert.deepEqual(parsed1, parsed2, 'Catalog generation must be strictly deterministic');
  });

} finally {
  restoreAll();
}

console.log('\n============================================================');
console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
console.log('============================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
