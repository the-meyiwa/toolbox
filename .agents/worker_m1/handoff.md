# Handoff Report: Milestone M1 (Dataset Extraction & Manifest)

**Agent**: Worker M1 (`teamwork_preview_worker`)  
**Roles**: implementer, qa, specialist  
**Parent Conversation ID**: `77acb32f-85b8-4101-b948-e34dfbaa12ee`  
**Working Directory**: `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\worker_m1`  
**Date**: 2026-09-24  
**Handoff Type**: Hard (Milestone M1 Complete)

---

## 1. Observation

### 1.1 Direct Baseline Observations & Initial Error
1. **Manifest Absence & Startup Crash**:
   Running `node scripts/anatomy-select.mjs` prior to changes terminated with an unhandled exception:
   ```
   Error: ENOENT: no such file or directory, open 'C:\Users\meyig\Documents\Projects\toolbox-ola\.anatomy-src\available.json'
       at Object.readFileSync (node:fs:484:20)
       at file:///C:/Users/meyig/Documents/Projects/toolbox-ola/scripts/anatomy-select.mjs:102:29
   ```
   Direct inspection revealed that `.anatomy-src/` is explicitly git-ignored (`.gitignore`, line 4), meaning clean repository clones permanently lacked this file.

2. **Upstream Asset Inventory**:
   `scripts/data/bodyparts3d-available.json` (copied from `.agents/explorer_m1_1/proposed_bodyparts3d-available.json`) was verified to contain:
   - Exactly **934 BodyParts3D STL models** totaling **1,315,953,756 bytes** (1.225 GiB source STLs).
   - 925 parts with `FMA\d+` identifiers and 9 parts with `BP\d+` identifiers (`BP24`, `BP28`, `BP44`–`BP47`, `BP65`–`BP67`).
   - Fields present on all entries: `id`, `name`, `file`, `bytes`, `size`, `sha`, `concept`, `conceptId`, `fma`.

3. **Classification Rule Deficiencies & Artificial Caps**:
   In `scripts/anatomy-select.mjs`:
   - Lines 54–57 defined `const CAPS` capping total structures at 600 (skeletal: 175, muscular: 175, cardiovascular: 85, nervous: 60, digestive: 45, respiratory: 25, urinary: 15, endocrine: 20).
   - Lines 114–120 truncated each system pool using `pool.slice(0, CAPS[system])`, which discarded 73 skeletal bones and 190 muscles.
   - The regex rules dropped 154 anatomical structures (including atlas, axis, all 16 wrist carpal bones, cerebral gyri, deep brain nuclei, facial expression muscles, and taeniae).

4. **Frontend Consumer Contracts**:
   - `js/tools/anatomy-explorer.js`: Line 46 executes `const hex = (c) => '#' + c.map(...)`. Passing `color` as an integer throws `TypeError: c.map is not a function`.
   - `js/tools/anatomy-explorer.js`: Lines 174–175 access `meta.label.toLowerCase()` and `meta.bytes`.
   - `js/tools/anatomy-explorer.js`: Line 179 and `js/lib/assistant-result-renderer.js` line 1881 load 3D assets via `meta.file`.
   - `PROJECT.md` line 65 specifies Version 2 schema: `version: 2`, `name`, `color`, `count`.

### 1.2 Implemented Changes
1. **Committed Manifest**:
   - Created directory `scripts/data/`.
   - Copied authoritative manifest from `.agents/explorer_m1_1/proposed_bodyparts3d-available.json` to `scripts/data/bodyparts3d-available.json` (253,580 bytes, 934 parts).

2. **Updated `scripts/anatomy-select.mjs`**:
   - **3-Tier Discovery Fallback**:
     1. Local cache `.anatomy-src/available.json`.
     2. Committed manifest `scripts/data/bodyparts3d-available.json` (seeds local cache on hit).
     3. Dynamic network fetch from GitHub API (`parts_list_e.txt` and git tree) with rate-limit detection (HTTP 403) and token support (`GITHUB_TOKEN`).
   - **Expanded RULES**:
     Integrated complete regex patterns for all 8 organ systems covering all 154 previously dropped structures.
     Added `EXCLUDE_NON_ORGAN` (`skin`, `hair`, `eyeball`, `ear`, `eyebrow`, `labial part of mouth`) and `MAX_BYTES` filter (40 MB).
   - **Structure ID Compatibility**:
     Supported both `FMA\d+` and `BP\d+` formats, mapping FMA numeric suffix to `s.fma` and `BP\d+` to `fma: null`.
   - **Uncapped Processing**:
     Removed `CAPS`, `CORE`, `LOW_YIELD`, `MUST_HAVE`, and `rank()`. All 927 classified structures are preserved.
   - **Catalog Generation & Schema V2**:
     Implemented `generateCatalogs()` producing dual-compatible `public/anatomy/index.json` (Version 2) with `name`, `label`, `color: [r, g, b]`, `colorInt`, `order`, `file`, `bytes`, `count`, and deterministic sorting (`SYSTEM_META.order` -> `name.localeCompare('en')` -> `id.localeCompare('en')`).
     Implemented `validateCatalogIntegrity()` asserting ID uniqueness, recognized systems, and exact mathematical count reconciliation.
     Wrote `.anatomy-src/selected.json` as a system-keyed mapping per `PROJECT.md` line 55–61.
   - **Execution Performance**:
     Selection and catalog generation execute instantaneously by default; optional STL downloading is available via `--download` or `DOWNLOAD_STL=1`.

### 1.3 Execution Results
1. Executed `node scripts/anatomy-select.mjs`:
   ```
   [Discovery] Loaded 934 parts from committed manifest (scripts\data\bodyparts3d-available.json)
   [Selection] Classified 927 of 934 available parts.

   [Catalog] Generated 927 structures across 8 systems:
     skeletal        268 parts  157.9 MB
     muscular        428 parts  833.6 MB
     nervous          95 parts  93.8 MB
     cardiovascular   60 parts  35.3 MB
     respiratory       7 parts  15.9 MB
     digestive        46 parts  26.7 MB
     urinary           8 parts  3.2 MB
     endocrine        15 parts  4.8 MB
   total source STL: 1171.3 MB
   [Catalog] Saved -> .anatomy-src\selected.json
   [Catalog] Saved -> public\anatomy\index.json (Version 2)
   ```
   Exit code: 0, execution time: < 400 ms.

2. Executed unit tests (`node --test tests/unit/assistant-anatomy.test.js`):
   ```
   ℹ tests 8
   ℹ pass 8
   ℹ fail 0
   ```

3. Executed full E2E test suite (`node --test tests/e2e/anatomy-explorer/*.test.js`):
   ```
   ℹ tests 82
   ℹ pass 82
   ℹ fail 0
   ```

---

## 2. Logic Chain

1. **Root Cause Resolution**:
   - Observation 1.1 demonstrated that `scripts/anatomy-select.mjs` failed with ENOENT on clean checkouts due to relying solely on git-ignored `.anatomy-src/available.json`.
   - Creating `scripts/data/bodyparts3d-available.json` (Observation 1.2.1) and implementing the 3-tier fallback resolution (Observation 1.2.2) guarantees that any clean clone, CI runner, or offline workstation can run the selection pipeline without network dependency or file-not-found errors.

2. **Complete Uncapped Dataset Extraction (R1 & Feature 1)**:
   - Upstream BodyParts3D comprises 934 binary STLs (Observation 1.2).
   - Filtering 1 oversized whole-body skin blob (77.5 MB > 40 MB) and 6 non-organ adnexa meshes (skin, hair, eyeballs, ear) leaves exactly 927 true anatomical organ structures.
   - Expanding regex rules (Observation 1.2.2) classified all 927 structures into the 8 canonical systems with 0 unclassified parts.
   - Deleting `CAPS` and `rank()` ensured all 927 parts are retained in the selection manifest and catalog.

3. **Schema Version 2 & Zero-Runtime-Crash Dual Compatibility**:
   - `PROJECT.md` specifies Schema Version 2 (`version: 2`, `name`, `color: int`, `count`).
   - However, existing viewer code in `js/tools/anatomy-explorer.js` calls `hex(meta.color)` which executes `c.map(...)`, and accesses `meta.label` and `meta.file` (Observation 1.1.4).
   - By structuring each system entry with both `name` and `label`, both `color: [r, g, b]` (normalized floats) and `colorInt` (24-bit integer), plus `order`, `file`, `bytes`, and `count`, `public/anatomy/index.json` fulfills the Version 2 interface contract while preserving 100% runtime compatibility with existing frontend components.

4. **Deterministic Collation & Integrity**:
   - Applying `SYSTEM_META[system].order` as primary sort, `name.localeCompare(..., 'en', { sensitivity: 'base' })` as secondary sort, and `id.localeCompare(..., 'en')` as tertiary tie-breaker guarantees cross-platform consistency.
   - `validateCatalogIntegrity()` programmatically proves:
     * Zero duplicate IDs.
     * All 927 structures belong to one of the 8 canonical systems.
     * `sum(systems[sys].count) === structures.length === 927`.

---

## 3. Caveats

1. **GLB File Sizes (`meta.bytes`)**:
   In Milestone M1, `public/anatomy/*.glb` retain their pre-existing binaries (from the capped build). `scripts/anatomy-select.mjs` reads the current file sizes on disk. When Milestone M2 (Build Pipeline & Compression) re-builds the 8 GLBs with Draco compression for all 927 parts, `scripts/anatomy-build.mjs` will update the `bytes` values in `public/anatomy/index.json`.
2. **STL Mesh Downloads**:
   By default, `scripts/anatomy-select.mjs` generates the selection manifest and catalog immediately without downloading the 1.17 GB raw STL source files, enabling fast execution in CI. To download the actual source meshes for a local build, passing `--download` or setting `DOWNLOAD_STL=1` activates the concurrent worker pool.

---

## 4. Conclusion

Milestone M1 (Dataset Extraction & Manifest) is complete:
1. `scripts/data/bodyparts3d-available.json` committed with all 934 BodyParts3D parts.
2. `scripts/anatomy-select.mjs` updated with 3-tier fallback, expanded regex rules, Schema V2 dual-compatible generation, and deterministic sorting.
3. `public/anatomy/index.json` (Version 2) generated with exactly 927 uncapped structures across all 8 canonical systems.
4. `.anatomy-src/selected.json` generated as a system-keyed mapping matching the M1 ↔ M2 interface contract.
5. All 8 assistant-anatomy unit tests and all 82 anatomy-explorer E2E tests pass with 0 failures.

---

## 5. Verification Method

To independently verify the implementation:

1. **Run Anatomy Select**:
   ```bash
   node scripts/anatomy-select.mjs
   ```
   *Expected output*: `[Selection] Classified 927 of 934 available parts.` and `[Catalog] Generated 927 structures across 8 systems:` with exit code 0.

2. **Verify 3-Tier Fallback Resolution (Offline simulation)**:
   ```bash
   node -e "const fs = require('fs'); fs.unlinkSync('.anatomy-src/available.json');"; node scripts/anatomy-select.mjs
   ```
   *Expected output*: `[Discovery] Loaded 934 parts from committed manifest (scripts\data\bodyparts3d-available.json)` with exit code 0.

3. **Verify Catalog Structure & Version 2 Schema**:
   ```bash
   node -e "
   const fs = require('fs');
   const idx = JSON.parse(fs.readFileSync('public/anatomy/index.json', 'utf8'));
   assert.equal(idx.version, 2);
   assert.equal(idx.structures.length, 927);
   assert.equal(Object.keys(idx.systems).length, 8);
   const sel = JSON.parse(fs.readFileSync('.anatomy-src/selected.json', 'utf8'));
   assert.equal(Object.values(sel).reduce((s, a) => s + a.length, 0), 927);
   console.log('Verification PASSED: 927 structures, Version 2 schema verified.');
   "
   ```
   *Expected output*: `Verification PASSED: 927 structures, Version 2 schema verified.`

4. **Run Unit Tests**:
   ```bash
   node --test tests/unit/assistant-anatomy.test.js
   ```
   *Expected output*: 8 tests passing, 0 failures.

5. **Run E2E Tests**:
   ```bash
   node --test tests/e2e/anatomy-explorer/*.test.js
   ```
   *Expected output*: 82 tests passing, 0 failures.
