import fs from 'node:fs';
import path from 'node:path';
import crypto from 'crypto';
import { RULES, EXCLUDE_NON_ORGAN, classify, SYSTEM_META, generateCatalogs, validateCatalogIntegrity } from '../../scripts/anatomy-select.mjs';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');
const MANIFEST_PATH = path.join(PROJECT_ROOT, 'scripts', 'data', 'bodyparts3d-available.json');
const INDEX_PATH = path.join(PROJECT_ROOT, 'public', 'anatomy', 'index.json');
const SELECTED_PATH = path.join(PROJECT_ROOT, '.anatomy-src', 'selected.json');

console.log('====================================================');
console.log('CHALLENGER M1-2: ADVERSARIAL STRESS TEST SUITE (M1)');
console.log('====================================================\n');

// 1. Load Manifest
if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`FAIL: Manifest file missing at ${MANIFEST_PATH}`);
  process.exit(1);
}

const rawParts = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
console.log(`[Test 1] Available Parts Manifest Loaded: ${rawParts.length} parts found.`);
if (rawParts.length !== 934) {
  console.error(`FAIL: Expected 934 parts in manifest, got ${rawParts.length}`);
} else {
  console.log(`PASS: Total manifest parts count is exactly 934.`);
}

// 2. Identify Excluded vs Included Parts
const MAX_BYTES = 40 * 1024 * 1024;
const excludedByBytes = [];
const excludedByPattern = [];
const classifiedParts = [];
const unclassifiedNonExcluded = [];

for (const p of rawParts) {
  const size = p.bytes || p.size || 0;
  let isExcluded = false;
  
  if (size > MAX_BYTES) {
    excludedByBytes.push(p);
    isExcluded = true;
  }
  if (EXCLUDE_NON_ORGAN.test(p.name)) {
    excludedByPattern.push(p);
    isExcluded = true;
  }

  if (isExcluded) continue;

  const system = classify(p.name);
  if (!system) {
    unclassifiedNonExcluded.push(p);
  } else {
    classifiedParts.push({ ...p, system });
  }
}

console.log(`\n[Test 2] Exclusion and Classification Analysis:`);
console.log(`- Excluded by size (>40MB): ${excludedByBytes.length} parts`);
for (const p of excludedByBytes) {
  console.log(`    ${p.id} (${p.name}) - ${(p.bytes / (1024 * 1024)).toFixed(2)} MB`);
}
console.log(`- Excluded by EXCLUDE_NON_ORGAN: ${excludedByPattern.length} parts`);
for (const p of excludedByPattern) {
  console.log(`    ${p.id} (${p.name}) - bytes: ${p.bytes}`);
}

const allExcludedIds = new Set([...excludedByBytes.map(p => p.id), ...excludedByPattern.map(p => p.id)]);
console.log(`- Total unique excluded parts: ${allExcludedIds.size}`);
if (allExcludedIds.size !== 7) {
  console.error(`FAIL: Expected exactly 7 excluded items, got ${allExcludedIds.size}`);
} else {
  console.log(`PASS: Exactly 7 parts are excluded.`);
}

console.log(`- Unclassified non-excluded parts: ${unclassifiedNonExcluded.length}`);
if (unclassifiedNonExcluded.length > 0) {
  console.error(`FAIL: Unclassified parts remain:`, unclassifiedNonExcluded);
} else {
  console.log(`PASS: 0 unclassified non-excluded parts.`);
}

console.log(`- Total classified parts: ${classifiedParts.length}`);
if (classifiedParts.length !== 927) {
  console.error(`FAIL: Expected 927 classified parts, got ${classifiedParts.length}`);
} else {
  console.log(`PASS: Exactly 927 parts classified.`);
}

// 3. Multi-system regex overlap check
console.log(`\n[Test 3] System Classification Exclusivity & Overlap:`);
const multiMatchAll = [];
const multiMatchClassified = [];

for (const p of classifiedParts) {
  const matches = [];
  for (const [sys, re] of RULES) {
    if (re.test(p.name)) {
      matches.push(sys);
    }
  }
  if (matches.length > 1) {
    multiMatchClassified.push({ id: p.id, name: p.name, assigned: p.system, matched: matches });
  }
}

console.log(`- Structures matching multiple system regexes: ${multiMatchClassified.length}`);
if (multiMatchClassified.length > 0) {
  console.warn(`WARNING/FINDING: Multi-regex matches found:`);
  for (const m of multiMatchClassified) {
    console.log(`    ${m.id} "${m.name}": assigned=${m.assigned}, matched=[${m.matched.join(', ')}]`);
  }
} else {
  console.log(`PASS: Every classified structure matches exactly one system regex.`);
}

// Check catalog and selected.json exclusivity
console.log(`\n[Test 4] Catalog & Selected.json Exclusivity:`);
const catalog = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
const selected = JSON.parse(fs.readFileSync(SELECTED_PATH, 'utf8'));

// Check duplicate IDs in catalog
const catalogIdCounts = new Map();
for (const s of catalog.structures) {
  catalogIdCounts.set(s.id, (catalogIdCounts.get(s.id) || 0) + 1);
}
const duplicateCatalogIds = [...catalogIdCounts.entries()].filter(([_, c]) => c > 1);
if (duplicateCatalogIds.length > 0) {
  console.error(`FAIL: Duplicate IDs in catalog:`, duplicateCatalogIds);
} else {
  console.log(`PASS: Catalog structures contains zero duplicate IDs (${catalog.structures.length} unique items).`);
}

// Check if any ID appears in multiple systems in selected.json
const selectedSystemMap = new Map();
const multiSystemIds = [];
for (const [sys, list] of Object.entries(selected)) {
  for (const item of list) {
    if (selectedSystemMap.has(item.id)) {
      multiSystemIds.push({ id: item.id, systems: [selectedSystemMap.get(item.id), sys] });
    } else {
      selectedSystemMap.set(item.id, sys);
    }
  }
}
if (multiSystemIds.length > 0) {
  console.error(`FAIL: Structures present in multiple systems in selected.json:`, multiSystemIds);
} else {
  console.log(`PASS: No structure appears in multiple systems in selected.json (${selectedSystemMap.size} items across 8 systems).`);
}

// Assert that NONE of the 7 excluded items appear in catalog or selected
console.log(`\n[Test 5] Assert 7 Excluded Items Not In Catalog/Selected:`);
let excludedLeaked = 0;
for (const id of allExcludedIds) {
  if (catalogIdCounts.has(id)) {
    console.error(`FAIL: Excluded part ${id} found in catalog.structures!`);
    excludedLeaked++;
  }
  if (selectedSystemMap.has(id)) {
    console.error(`FAIL: Excluded part ${id} found in selected.json!`);
    excludedLeaked++;
  }
}
if (excludedLeaked === 0) {
  console.log(`PASS: None of the 7 excluded items leaked into catalog or selected.`);
} else {
  console.error(`FAIL: ${excludedLeaked} excluded items leaked into output!`);
}

// 4. Test Deterministic Sorting & Hash Stability Across Runs
console.log(`\n[Test 6] Deterministic Sorting & Hashing Across Runs:`);
function computeCatalogHash(cat) {
  // Normalize date or variable fields if any, but let's inspect fields
  // In index.json, 'generated' has ISO date. We test deterministic ordering of structures and systems.
  const structStr = JSON.stringify(cat.structures);
  const sysStr = JSON.stringify(cat.systems);
  return {
    structHash: crypto.createHash('sha256').update(structStr).digest('hex'),
    sysHash: crypto.createHash('sha256').update(sysStr).digest('hex'),
  };
}

const baselineHash = computeCatalogHash(catalog);
console.log(`Baseline catalog structures sha256: ${baselineHash.structHash}`);
console.log(`Baseline catalog systems sha256:    ${baselineHash.sysHash}`);

// Run generateCatalogs multiple times with different input permutations
let allHashesMatch = true;
for (let run = 1; run <= 10; run++) {
  // Shuffle classifiedParts
  const shuffled = [...classifiedParts].sort(() => Math.random() - 0.5);
  
  // Intercept generateCatalogs (or mock fs.writeFileSync to check returned indexManifest)
  // Let's call generateCatalogs(shuffled)
  const { indexManifest } = generateCatalogs(shuffled);
  const runHash = computeCatalogHash(indexManifest);
  if (runHash.structHash !== baselineHash.structHash || runHash.sysHash !== baselineHash.sysHash) {
    console.error(`FAIL: Hash mismatch on permutation run ${run}!`);
    allHashesMatch = false;
  }
}

if (allHashesMatch) {
  console.log(`PASS: Deterministic sorting passed 10 shuffled runs with 100% identical hashes.`);
} else {
  console.error(`FAIL: Non-deterministic sorting detected!`);
}

// 5. Structure Sorting Verification
console.log(`\n[Test 7] Verifying Exact Sorting Order Rules:`);
// Check system order matches SYSTEM_META.order
let lastSysOrder = -1;
let systemOrderValid = true;
for (const s of catalog.structures) {
  const ord = SYSTEM_META[s.system].order;
  if (ord < lastSysOrder) {
    systemOrderValid = false;
    console.error(`FAIL: System order violated: ${s.system} (order ${ord}) after order ${lastSysOrder}`);
    break;
  }
  lastSysOrder = ord;
}
if (systemOrderValid) {
  console.log(`PASS: System ordering strictly follows SYSTEM_META.order.`);
}

// Check within each system, names are sorted localeCompare('en', { sensitivity: 'base' })
let intraSystemSortValid = true;
for (const [sys, list] of Object.entries(selected)) {
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1];
    const curr = list[i];
    const nameDiff = prev.name.localeCompare(curr.name, 'en', { sensitivity: 'base' });
    if (nameDiff > 0) {
      intraSystemSortValid = false;
      console.error(`FAIL: Sort order violated in ${sys}: "${prev.name}" should come after "${curr.name}"`);
    } else if (nameDiff === 0) {
      const idDiff = prev.id.localeCompare(curr.id, 'en');
      if (idDiff > 0) {
        intraSystemSortValid = false;
        console.error(`FAIL: Tie-breaker violated in ${sys}: "${prev.id}" should come after "${curr.id}"`);
      }
    }
  }
}
if (intraSystemSortValid) {
  console.log(`PASS: Intra-system sort strictly follows name + ID tie-breaker.`);
}

console.log('\n====================================================');
console.log('ADVERSARIAL STRESS TEST SUITE COMPLETE');
console.log('====================================================');
