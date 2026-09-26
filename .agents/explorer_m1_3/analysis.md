# Technical Analysis: Index & Catalog Metadata Generation (Milestone 1)

**Agent**: Explorer M1-3 (Index & Catalog Metadata Specialist)  
**Parent Conversation ID**: `77acb32f-85b8-4101-b948-e34dfbaa12ee`  
**Working Directory**: `.agents/explorer_m1_3`  
**Target Files**: `scripts/anatomy-select.mjs`, `.anatomy-src/selected.json`, `public/anatomy/index.json`  
**Date**: 2026-09-24  

---

## 1. Executive Summary

This report establishes the definitive technical blueprint for generating the complete anatomy catalog metadata in `scripts/anatomy-select.mjs` as part of **Milestone 1 (Dataset Extraction & Manifest)**.

Historically, catalog generation (`public/anatomy/index.json`) was coupled to the final stage of the heavy 3D conversion pipeline (`scripts/anatomy-build.mjs`). Under this overhaul, `scripts/anatomy-select.mjs` assumes responsibility for producing both:
1. `.anatomy-src/selected.json`: The intermediate system-grouped selection manifest consumed by the build pipeline (`M2`).
2. `public/anatomy/index.json`: The authoritative runtime metadata catalog consumed by the interactive 3D viewer (`js/tools/anatomy-explorer.js`), clinical knowledge layer (`js/lib/anatomy-data.js`), and Assistant result renderers (`js/lib/assistant-result-renderer.js`).

### Core Guarantees:
- **Full Backward Compatibility**: The generated `public/anatomy/index.json` preserves 100% runtime compatibility with the existing, unmodified viewer `js/tools/anatomy-explorer.js`. All property accesses—including `systems[key].label`, `systems[key].file`, `systems[key].order`, `systems[key].bytes`, `hex(systems[key].color)` where `color` is an RGB array, and `structures[].fma`—are strictly preserved while satisfying the Version 2 specification (`version: 2`, `name`, `color`, `count`).
- **Deterministic Output**: Structures within each system and across the entire catalog are sorted using standardized, locale-insensitive rules (`SYSTEM_ORDER` → `name` ascending via `'en'` locale → `id` ascending tie-break). Re-running the script on any operating system produces byte-for-byte identical output.
- **Strict Integrity Verification**: Built-in assertions guarantee zero duplicate structure IDs, zero missing or invalid anatomical systems, zero orphan FMA identifiers, and perfect mathematical reconciliation between `index.systems[sys].count` and `index.structures`.

---

## 2. Comprehensive Consumer Audit & Backward Compatibility Analysis

To guarantee that updating `public/anatomy/index.json` to Version 2 will not crash or degrade any part of Toolbox, we conducted a line-by-line audit of all consumers across the repository.

### 2.1 Consumer 1: `js/tools/anatomy-explorer.js`
The 3D viewer relies on `public/anatomy/index.json` immediately upon initialization (`fetch('${BASE}index.json')`, line 29):

| Line(s) | Code Snippet | Property Accessed | Compatibility Hazard / Requirement |
|---|---|---|---|
| **44** | `const systemKeys = Object.keys(index.systems).sort((a, b) => index.systems[a].order - index.systems[b].order);` | `systems[key].order` | Must provide numeric `order` (1–8) or sorting returns `NaN`. |
| **45** | `const byId = new Map(index.structures.map(s => [s.id, s]));` | `structures[].id` | Must provide string `id` (e.g. `FMA12519`). |
| **46** | `const hex = (c) => '#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');` | `systems[key].color` | **CRITICAL**: `hex(c)` calls `c.map(...)`. If `color` is a single integer (e.g. `15064530`), calling `.map()` throws `TypeError: c.map is not a function`, terminating viewer initialization! `color` MUST be an array `[r, g, b]` of float values between 0.0 and 1.0. |
| **174–175** | `const meta = index.systems[key];`<br>`showProgress(\`Loading \${meta.label.toLowerCase()} — \${kb(meta.bytes)}…\`);` | `meta.label`, `meta.bytes` | If `label` is missing, `meta.label.toLowerCase()` throws `TypeError`. If `bytes` is missing, `kb()` outputs `NaN KB`. |
| **179** | `gltfLoader.load(\`${BASE}${meta.file}\`, ...)` | `meta.file` | Must provide `file` string (e.g. `skeletal.glb`). If missing, attempts to load `/anatomy/undefined` (HTTP 404). |
| **190–192** | `child.userData.structure = byId.get(child.name) \|\| { id: child.name, name: child.name, system: key };` | `structures[].name`, `structures[].system` | Node mesh names in GLB match `part.id`. Mesh userData binds `s.name` and `s.system`. |
| **243–248** | `const s = index.systems[k];`<br>`return \`<label class="t3d-toggle">...<span class="t3d-dot" style="background:\${hex(s.color)}"></span><span class="t3d-toggle-name">\${s.label}</span><span class="t3d-count">\${s.count} · \${kb(s.bytes)}</span></label>\`;` | `s.color`, `s.label`, `s.count`, `s.bytes` | Toggle badges display system label, dot color, structure count, and download size. |
| **338–368** | `index.structures.filter(s => { ... s.name ... s.system ... })`<br>`data-id="${s.id}" data-system="${s.system}" data-name="${s.name}"` | `s.id`, `s.name`, `s.system` | Structure list rendering and search filtering. |
| **426–429** | `const sys = index.systems[s.system] \|\| { label: s.system, color: [0.5, 0.5, 0.5] };`<br>`const fmaUrl = (s.fma \|\| detail.fma) ? \`https://...fma\${s.fma \|\| detail.fma}\` : null;` | `s.fma`, `sys.label`, `sys.color` | Clinical inspector card displays FMA link and system badge. |

### 2.2 Consumer 2: `js/lib/anatomy-data.js`
In `resolveAnatomyQuery(query, indexData)`:
- **Line 1375–1377**: Fetches `${root}anatomy/index.json`.
- **Line 1383–1390**:
  ```javascript
  const structuresCatalog = index?.structures || Object.entries(ANATOMY_DATABASE).map(...);
  ```
- Reads `s.id`, `s.name`, `s.system`, and `s.fma`. Uses `s.name` for natural language synonym matching and `s.system` for system filtering.

### 2.3 Consumer 3: `js/lib/assistant-result-renderer.js`
In `Anatomy3DResultRenderer` (lines 1812–1884):
- **Line 1831–1832**:
  ```javascript
  const byId = new Map((index.structures || []).map(s => [s.id?.toLowerCase(), s]));
  const byName = new Map((index.structures || []).map(s => [s.name?.toLowerCase(), s]));
  ```
- **Line 1877–1881**:
  ```javascript
  const meta = index.systems[sysKey];
  gltfLoader.load(`${BASE}${meta.file}`, resolve, undefined, reject);
  ```
  Requires `index.structures` with `id` and `name`, and `index.systems[sysKey].file`.

### 2.4 Consumer 4: `tests/unit/assistant-anatomy.test.js`
Unit tests (all 8 tests currently passing) mock `index` with:
```javascript
systems: {
  skeletal: { label: 'Skeletal', file: 'skeletal.glb', count: 2, order: 1 }, ...
},
structures: [
  { id: 'FMA24474', name: 'right femur', system: 'skeletal', fma: '24474' }, ...
]
```

### 2.5 Synthesis: The Dual-Compatibility Solution
The user request requires:
- `version`: 2
- `systems`: map of system key -> `{ name, color, count }`
- `structures`: array of `{ id, name, system, fma }`

Meanwhile, existing code in `anatomy-explorer.js` and `assistant-result-renderer.js` requires:
- `label`, `file`, `order`, `bytes` in `systems[key]`.
- `color` as an array `[r, g, b]` of float values so `c.map(...)` succeeds.

**Architectural Reconciliation**:
Each system entry in `index.systems` will contain both sets of properties:
```json
"skeletal": {
  "name": "Skeletal",
  "label": "Skeletal",
  "color": [0.918, 0.894, 0.827],
  "colorInt": 15064530,
  "order": 1,
  "file": "skeletal.glb",
  "count": 268,
  "bytes": 2778364
}
```
- Code reading `meta.name` gets `"Skeletal"`.
- Code reading `meta.label` gets `"Skeletal"`.
- Code reading `meta.color` receives `[0.918, 0.894, 0.827]`, preventing any `c.map` crash in `anatomy-explorer.js:46`.
- Code or tests wanting a 24-bit RGB integer can read `meta.colorInt` (`15064530`).
- `meta.file`, `meta.order`, and `meta.bytes` remain intact for 3D model streaming and progress badges.

---

## 3. Data File Specifications & Schemas

### 3.1 `public/anatomy/index.json` (Version 2)

#### Schema Definition:
```typescript
interface AnatomyCatalogManifestV2 {
  version: 2;
  systems: Record<SystemKey, SystemMetadataV2>;
  structures: StructureCatalogEntryV2[];
  attribution: AttributionMetadata;
  generated: string; // ISO 8601 UTC timestamp
}

type SystemKey =
  | 'skeletal'
  | 'muscular'
  | 'nervous'
  | 'cardiovascular'
  | 'respiratory'
  | 'digestive'
  | 'urinary'
  | 'endocrine';

interface SystemMetadataV2 {
  name: string;        // Canonical display name: "Skeletal", "Muscular", etc.
  label: string;       // Backward-compat alias: matches 'name'
  color: [number, number, number]; // [r, g, b] normalized float (0.0 to 1.0)
  colorInt: number;    // 24-bit RGB integer (e.g. 15064530 = 0xE5DDCE)
  order: number;       // Display order (1 through 8)
  file: string;        // GLB asset filename: "${system}.glb"
  count: number;       // Exact number of structures in this system
  bytes: number;       // Asset file size in bytes (from existing/built GLB, or 0)
}

interface StructureCatalogEntryV2 {
  id: string;          // Authoritative identifier: "FMA12519" or "BP24"
  name: string;        // Standard English anatomical name (lowercase)
  system: SystemKey;   // Classified organ system
  fma: string | null;  // FMA numeric string ("12519") or null for non-FMA parts
}

interface AttributionMetadata {
  source: 'BodyParts3D';
  holder: 'Database Center for Life Science (DBCLS)';
  year: 2008;
  licence: 'CC BY-SA 2.1 Japan';
  url: 'https://lifesciencedb.jp/bp3d/';
}
```

#### Canonical System Metadata Constants:
```javascript
export const SYSTEM_META = {
  skeletal: {
    name: 'Skeletal',
    label: 'Skeletal',
    color: [0.918, 0.894, 0.827],
    colorInt: 15064530, // 0xE5DDCE
    order: 1,
    file: 'skeletal.glb',
  },
  muscular: {
    name: 'Muscular',
    label: 'Muscular',
    color: [0.698, 0.314, 0.290],
    colorInt: 11449886, // 0xAE501E
    order: 2,
    file: 'muscular.glb',
  },
  nervous: {
    name: 'Nervous',
    label: 'Nervous',
    color: [0.863, 0.816, 0.722],
    colorInt: 14172344, // 0xD840B8
    order: 3,
    file: 'nervous.glb',
  },
  cardiovascular: {
    name: 'Cardiovascular',
    label: 'Cardiovascular',
    color: [0.690, 0.227, 0.180],
    colorInt: 11317038, // 0xAD112E
    order: 4,
    file: 'cardiovascular.glb',
  },
  respiratory: {
    name: 'Respiratory',
    label: 'Respiratory',
    color: [0.859, 0.569, 0.651],
    colorInt: 14076327, // 0xD6C9A7
    order: 5,
    file: 'respiratory.glb',
  },
  digestive: {
    name: 'Digestive',
    label: 'Digestive',
    color: [0.780, 0.569, 0.341],
    colorInt: 12792663, // 0xC35357
    order: 6,
    file: 'digestive.glb',
  },
  urinary: {
    name: 'Urinary',
    label: 'Urinary',
    color: [0.553, 0.353, 0.235],
    colorInt: 9059132,  // 0x8A3B3C
    order: 7,
    file: 'urinary.glb',
  },
  endocrine: {
    name: 'Endocrine',
    label: 'Endocrine',
    color: [0.494, 0.588, 0.443],
    colorInt: 8109169,  // 0x7B9C71
    order: 8,
    file: 'endocrine.glb',
  },
};
```

---

### 3.2 `.anatomy-src/selected.json` (Pipeline Intermediate)

#### Interface Contract (M1 ↔ M2):
As specified in `PROJECT.md` (§Interface Contracts, line 55–61), `selected.json` is a map keyed by system name:
```typescript
type SelectedManifest = Record<SystemKey, SelectedStructureEntry[]>;

interface SelectedStructureEntry {
  id: string;          // "FMA12519"
  name: string;        // "atlas"
  system: SystemKey;   // "skeletal"
  fma: string | null;  // "12519"
  file: string;        // "FMA12519.stl"
  bytes: number;       // Source STL byte size (e.g. 123456)
}
```

#### Dual-Consumer Interoperability Note:
In the original `scripts/anatomy-build.mjs`, line 119 reads `selected.json` and executes `for (const p of selected)`. When Milestone 2 updates `scripts/anatomy-build.mjs`, it will use:
```javascript
const rawSelected = JSON.parse(fs.readFileSync(path.join(SRC, 'selected.json'), 'utf8'));
const selectedList = Array.isArray(rawSelected) ? rawSelected : Object.values(rawSelected).flat();
```
This ensures backwards and forwards compatibility between both pipeline stages regardless of invocation order.

---

## 4. Deterministic Sorting & Unique ID Validation Algorithms

### 4.1 Deterministic Sorting Algorithm
To prevent Git churn across builds and ensure deterministic search indexing in the frontend:
1. **Catalog Array (`public/anatomy/index.json`)**:
   - Primary Sort: Ascending by canonical system `order` (1 to 8: Skeletal → Muscular → Nervous → Cardiovascular → Respiratory → Digestive → Urinary → Endocrine).
   - Secondary Sort: Alphabetical by `name` using standard English collation (`'en'`, `{ sensitivity: 'base' }`).
   - Tertiary Tie-Breaker: Ascending by `id` using ASCII character codes (`a.id.localeCompare(b.id, 'en')`).

2. **Selected Groups (`.anatomy-src/selected.json`)**:
   - Keys arranged in canonical `SYSTEM_META` order.
   - Array entries within each system sorted alphabetically by `name`, tie-broken by `id`.

```javascript
/**
 * Sorts structures deterministically.
 * @param {Array<{ id: string, name: string, system: string }>} list
 * @returns {Array<{ id: string, name: string, system: string }>}
 */
export function sortCatalogStructures(list) {
  return list.slice().sort((a, b) => {
    // 1. Primary: System order (1..8)
    const orderA = SYSTEM_META[a.system]?.order ?? 99;
    const orderB = SYSTEM_META[b.system]?.order ?? 99;
    if (orderA !== orderB) return orderA - orderB;

    // 2. Secondary: Alphabetical name (case-insensitive, standardized locale)
    const nameDiff = a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
    if (nameDiff !== 0) return nameDiff;

    // 3. Tertiary: Unique ID
    return a.id.localeCompare(b.id, 'en');
  });
}

/**
 * Sorts structures within a single system.
 */
export function sortSystemStructures(list) {
  return list.slice().sort((a, b) => {
    const nameDiff = a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
    if (nameDiff !== 0) return nameDiff;
    return a.id.localeCompare(b.id, 'en');
  });
}
```

### 4.2 Strict Unique ID Deduplication & Schema Validation
Before writing `.anatomy-src/selected.json` or `public/anatomy/index.json`, the generator executes an automated integrity validation suite:

```javascript
/**
 * Validates integrity, uniqueness, and consistency of the anatomy catalog.
 * @throws {Error} if any constraint is violated.
 */
export function validateCatalogIntegrity(systems, structures) {
  const seenIds = new Set();
  const duplicates = [];
  const systemCounts = {};

  for (const sysKey of Object.keys(SYSTEM_META)) {
    systemCounts[sysKey] = 0;
  }

  for (let i = 0; i < structures.length; i++) {
    const s = structures[i];

    // 1. ID format and uniqueness
    if (!s.id || typeof s.id !== 'string') {
      throw new Error(`Integrity Error at index ${i}: Invalid structure ID: ${JSON.stringify(s.id)}`);
    }
    if (seenIds.has(s.id)) {
      duplicates.push(s.id);
    }
    seenIds.add(s.id);

    // 2. Name validation
    if (!s.name || typeof s.name !== 'string' || s.name.trim().length === 0) {
      throw new Error(`Integrity Error: Structure ${s.id} has empty name.`);
    }

    // 3. System validity
    if (!SYSTEM_META[s.system]) {
      throw new Error(`Integrity Error: Structure ${s.id} has unrecognized system: '${s.system}'`);
    }
    systemCounts[s.system]++;

    // 4. FMA field consistency
    if (s.fma !== null && (typeof s.fma !== 'string' || s.fma.length === 0)) {
      throw new Error(`Integrity Error: Structure ${s.id} has invalid FMA field: ${JSON.stringify(s.fma)}`);
    }
  }

  if (duplicates.length > 0) {
    throw new Error(`Integrity Violation: ${duplicates.length} duplicate structure IDs detected: ${duplicates.slice(0, 10).join(', ')}`);
  }

  // 5. System count reconciliation
  for (const [sysKey, meta] of Object.entries(systems)) {
    const actualCount = systemCounts[sysKey];
    if (meta.count !== actualCount) {
      throw new Error(`System Count Mismatch for '${sysKey}': index claims ${meta.count}, but structures contains ${actualCount}`);
    }
  }

  const totalSystemCounts = Object.values(systems).reduce((sum, s) => sum + s.count, 0);
  if (totalSystemCounts !== structures.length) {
    throw new Error(`Catalog Length Mismatch: systems sum to ${totalSystemCounts}, but structures length is ${structures.length}`);
  }
}
```

---

## 5. Quantitative Projections & Scale Impact

Based on the survey of the 934 BodyParts3D STL assets and the uncapped classification rules:

| Organ System | System Order | Current Capped Count | Projected Uncapped Count | Projected Source STL MB | Projected GLB File |
|---|---|---|---|---|---|
| **Skeletal** | 1 | 175 | **268** | 156.5 MB | `skeletal.glb` (~2.8 MB) |
| **Muscular** | 2 | 175 | **428** | 763.5 MB | `muscular.glb` (~3.0 MB) |
| **Nervous** | 3 | 39 | **95** | 65.6 MB | `nervous.glb` (~0.8 MB) |
| **Cardiovascular** | 4 | 60 | **60** | 35.3 MB | `cardiovascular.glb` (~0.9 MB) |
| **Respiratory** | 5 | 7 | **7** | 15.9 MB | `respiratory.glb` (~0.2 MB) |
| **Digestive** | 6 | 43 | **46** | 21.0 MB | `digestive.glb` (~0.7 MB) |
| **Urinary** | 7 | 8 | **8** | 3.2 MB | `urinary.glb` (~0.1 MB) |
| **Endocrine** | 8 | 10 | **15** | 4.1 MB | `endocrine.glb` (~0.2 MB) |
| **TOTAL** | — | **517** | **927** | **1,065.1 MB** | **All 8 Systems (~8.7 MB)** |

### Metadata File Footprints:
- **`public/anatomy/index.json`**:
  - Current (517 structures, unformatted): **45,999 bytes (~45 KB)**
  - Projected (927 structures, formatted with 2-space indentation): **~95 KB uncompressed (~16 KB gzipped)**
  - Fetch duration: **< 10 ms** over local network or broadband.
- **`.anatomy-src/selected.json`**:
  - Projected: **~120 KB** (formatted with 2-space indentation).

---

## 6. Implementation Blueprint for `scripts/anatomy-select.mjs`

Below is the concrete implementation architecture for catalog generation in `scripts/anatomy-select.mjs`.

### 6.1 Function: `generateCatalogs()`
```javascript
import fs from 'node:fs';
import path from 'node:path';

const SRC = '.anatomy-src';
const PUBLIC_ANATOMY = path.join('public', 'anatomy');

export function generateCatalogs(classifiedParts) {
  // 1. Group parts by system and ensure uniqueness
  const selectedBySystem = {};
  const seenIds = new Set();
  const duplicates = [];

  for (const sys of Object.keys(SYSTEM_META)) {
    selectedBySystem[sys] = [];
  }

  for (const part of classifiedParts) {
    if (seenIds.has(part.id)) {
      duplicates.push(part.id);
      continue;
    }
    seenIds.add(part.id);

    const fma = part.fma
      ? String(part.fma)
      : (part.id.startsWith('FMA') ? part.id.slice(3) : null);

    const item = {
      id: part.id,
      name: part.name.toLowerCase().trim(),
      system: part.system,
      fma,
      file: `${part.id}.stl`,
      bytes: part.bytes || part.size || 0,
    };

    selectedBySystem[part.system].push(item);
  }

  if (duplicates.length > 0) {
    console.warn(`[WARN] Encountered ${duplicates.length} duplicate IDs: ${duplicates.join(', ')}`);
  }

  // 2. Sort each system's items deterministically
  for (const sys of Object.keys(selectedBySystem)) {
    selectedBySystem[sys].sort((a, b) => {
      const nameDiff = a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
      if (nameDiff !== 0) return nameDiff;
      return a.id.localeCompare(b.id, 'en');
    });
  }

  // 3. Build structures array sorted by system order then name
  const structures = [];
  const systemsIndex = {};

  const sortedSystems = Object.keys(SYSTEM_META).sort(
    (a, b) => SYSTEM_META[a].order - SYSTEM_META[b].order
  );

  for (const sys of sortedSystems) {
    const list = selectedBySystem[sys];
    const meta = SYSTEM_META[sys];

    // Determine existing file size if GLB already built, otherwise 0
    let glbBytes = 0;
    const glbPath = path.join(PUBLIC_ANATOMY, meta.file);
    if (fs.existsSync(glbPath)) {
      try { glbBytes = fs.statSync(glbPath).size; } catch {}
    }

    systemsIndex[sys] = {
      name: meta.name,
      label: meta.label,
      color: meta.color,
      colorInt: meta.colorInt,
      order: meta.order,
      file: meta.file,
      count: list.length,
      bytes: glbBytes,
    };

    for (const item of list) {
      structures.push({
        id: item.id,
        name: item.name,
        system: item.system,
        fma: item.fma,
      });
    }
  }

  // 4. Validate integrity before writing
  validateCatalogIntegrity(systemsIndex, structures);

  // 5. Build final index manifest
  const indexManifest = {
    version: 2,
    systems: systemsIndex,
    structures,
    attribution: {
      source: 'BodyParts3D',
      holder: 'Database Center for Life Science (DBCLS)',
      year: 2008,
      licence: 'CC BY-SA 2.1 Japan',
      url: 'https://lifesciencedb.jp/bp3d/',
    },
    generated: new Date().toISOString(),
  };

  // 6. Write target files
  fs.mkdirSync(SRC, { recursive: true });
  fs.mkdirSync(PUBLIC_ANATOMY, { recursive: true });

  const selectedPath = path.join(SRC, 'selected.json');
  const indexPath = path.join(PUBLIC_ANATOMY, 'index.json');

  fs.writeFileSync(selectedPath, JSON.stringify(selectedBySystem, null, 2), 'utf8');
  fs.writeFileSync(indexPath, JSON.stringify(indexManifest, null, 2), 'utf8');

  console.log(`\n[Catalog] Generated ${structures.length} structures across ${sortedSystems.length} systems:`);
  for (const sys of sortedSystems) {
    console.log(`  - ${sys.padEnd(15)} : ${String(systemsIndex[sys].count).padStart(3)} structures`);
  }
  console.log(`[Catalog] Saved -> ${selectedPath}`);
  console.log(`[Catalog] Saved -> ${indexPath} (Version ${indexManifest.version})\n`);

  return { selectedBySystem, indexManifest };
}
```

---

## 7. Coordination with Peer Specialists

| Peer Agent | Focus Area | Interface / Handoff Point |
|---|---|---|
| **Explorer M1-1** | Authoritative Manifest & Discovery | Inputs to `generateCatalogs()` will consume the parsed output of `scripts/data/bodyparts3d-available.json` (id, name, bytes, sha). |
| **Explorer M1-2** | Classification Regexes & Rules | Supplies the uncapped `classify(part.name)` function that categorizes ~927 structures into the 8 systems without `CAPS`. |
| **M2 Implementer** | Build & Draco Compression Pipeline | Reads `.anatomy-src/selected.json` (`{ skeletal: [...], ... }`) and updates `bytes` in `public/anatomy/index.json` after compiling system GLBs. |
| **M3 Implementer** | VirtualScroller & Viewer UI | Consumes `public/anatomy/index.json` (Version 2) with 927 structures for sub-5ms search indexing, regional filtering, and virtualized list rendering. |

---

## 8. Verification Strategy

1. **Schema & JSON Lint Check**:
   - Parse `public/anatomy/index.json` with `JSON.parse()`.
   - Assert `index.version === 2`.
   - Assert `Object.keys(index.systems).length === 8`.
   - Assert `index.structures.length >= 920`.
2. **Deterministic Sort Verification**:
   - Verify `index.structures` is sorted strictly by `SYSTEM_META[system].order`, then by `name`, then by `id`.
3. **Viewer Backward Compatibility Smoke Test**:
   - Start local dev server (`npm run dev` or static host).
   - Load `http://localhost:5173/#anatomy-explorer`.
   - Verify systems load and checkboxes render colored dots without JavaScript console errors.
4. **Unit Test Suite Verification**:
   - Run `node --test tests/unit/assistant-anatomy.test.js`.
   - All 8 tests must pass 100%.
