# Handoff Report: Manifest Architecture & 3-Tier Discovery Fallback

**Agent**: Explorer M1-1 (Manifest & Discovery Specialist)  
**Parent Conversation ID**: `77acb32f-85b8-4101-b948-e34dfbaa12ee`  
**Working Directory**: `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_m1_1`  
**Date**: 2026-09-24  
**Handoff Type**: Hard (Task Complete)  

---

## 1. Observation

### 1.1 Direct Observations & Verbatim Errors
1. **Immediate Execution Failure**:
   Running `node scripts/anatomy-select.mjs` terminates with:
   ```
   Error: ENOENT: no such file or directory, open 'C:\Users\meyig\Documents\Projects\toolbox-ola\.anatomy-src\available.json'
       at Object.readFileSync (node:fs:484:20)
       at file:///C:/Users/meyig/Documents/Projects/toolbox-ola/scripts/anatomy-select.mjs:102:29
   ```
   Direct code inspection of `scripts/anatomy-select.mjs`:
   - Line 16: `const SRC = '.anatomy-src';`
   - Line 102: `const parts = JSON.parse(fs.readFileSync(path.join(SRC, 'available.json'), 'utf8'));`

2. **Git Ignore Configuration**:
   Inspection of `c:\Users\meyig\Documents\Projects\toolbox-ola\.gitignore`:
   - Line 4: `.anatomy-src/`
   Because this directory is ignored, `available.json` is permanently absent from clean checkouts and CI runners.

3. **Upstream Repository Inventory**:
   Queried upstream GitHub repository `Kevin-Mattheus-Moerman/BodyParts3D` (referred to on line 18 of `scripts/anatomy-select.mjs`):
   - Git Tree endpoint `https://api.github.com/repos/Kevin-Mattheus-Moerman/BodyParts3D/git/trees/main?recursive=1` returned HTTP 200 with 1,901 tree nodes, containing exactly **934 binary STL files** under `assets/BodyParts3D_data/stl/` totaling **1,315,953,756 bytes** (1.225 GiB).
   - Concept list `https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/main/assets/BodyParts3D_data/parts_list_e.txt` returned HTTP 200 with 1,525 lines (1 header + 1,524 concepts).
   - Verification script `.agents/explorer_m1_1/verify_match.mjs` executed against all 934 STLs:
     ```
     Total tree items: 934 Matched: 934 Missing: 0
     ```
     Zero items lacked matching English terminology.

4. **Taxonomy & Key Properties**:
   - 925 items have FMA identifiers (e.g. `FMA12519` atlas, `FMA24486` right patella).
   - 9 items have BP identifiers (`BP24`, `BP28`, `BP44`, `BP45`, `BP46`, `BP47`, `BP65`, `BP66`, `BP67`).
   - In `public/anatomy/index.json`, existing BP structures are formatted with `fma: null` and FMA structures with `fma: part.id.slice(3)`.

5. **Downstream Script Interface References**:
   - `scripts/anatomy-select.mjs`: Line 106 (`p.size`), Line 118 (`a.size - b.size`), Line 126 (`p.size`), Line 139 (`fs.statSync(dest).size === part.size`), Line 142 (`fetch(`${RAW_BASE}/${part.id}.stl`)`).
   - `PROJECT.md` line 53: specifies manifest schema `[ { "id": "FMA12519", "name": "atlas", "bytes": 123456, "sha": "..." } ]`.
   - Providing both `bytes` and `size: bytes` ensures dual compatibility without ambiguity.

---

## 2. Logic Chain

1. **Failure Diagnosis**:
   - Observation 1 demonstrates that `scripts/anatomy-select.mjs` fails at startup on clean checkouts.
   - Observation 2 demonstrates that `.anatomy-src/` is git-ignored and cannot be committed.
   - Therefore, an authoritative manifest must reside in a committed directory (e.g., `scripts/data/bodyparts3d-available.json`), and `anatomy-select.mjs` must be updated to locate it.

2. **Manifest Scope & Schema Design**:
   - Observation 3 confirms that exactly 934 STLs exist upstream, all with verified names, file sizes, and Git SHAs.
   - Observation 4 confirms that 925 items are FMA concepts and 9 items are BP concepts.
   - Observation 5 establishes that downstream consumers use both `bytes` and `size`, `id`, `name`, `sha`, `concept`, and `fma`.
   - Therefore, the manifest must encode all 934 items with fields `{ id, name, file, bytes, size, sha, concept, conceptId, fma }`, sorted deterministically by `id`.

3. **Discovery Fallback Hierarchy**:
   - In production and CI, network access may be restricted or subject to GitHub API rate limits (60 req/hr).
   - Storing the committed manifest at `scripts/data/bodyparts3d-available.json` (Tier 2) completely avoids network requests.
   - Retaining `.anatomy-src/available.json` (Tier 1) preserves local cache performance for iterative developer runs.
   - Providing a dynamic GitHub fetch fallback (Tier 3) ensures the script remains self-healing if files are accidentally deleted or when bootstrapping from a minimal script.
   - Automated simulation via `.agents/explorer_m1_1/test_fallback_simulation.mjs` proved that all 3 tiers execute reliably and seed local caches appropriately.

---

## 3. Caveats

1. **GitHub API Rate Limits (Tier 3 Only)**:
   Tier 3 dynamic fetch calls `api.github.com/repos/.../git/trees/main?recursive=1`. Unauthenticated requests to GitHub's API are capped at 60 requests per hour per IP. However, because Tier 2 (the committed `scripts/data/bodyparts3d-available.json`) is committed to the repository, Tier 3 will almost never be triggered in normal operation. If triggered, `process.env.GITHUB_TOKEN` is supported and clear error instructions are logged upon HTTP 403.
2. **Binary STL Source Sizes**:
   The manifest captures all 934 STLs (1.316 GB source data). Decimation and Draco compression (Milestone M2) will reduce this to ~16 MB total GLB output. The manifest itself is only 247.6 KB JSON.
3. **Classification & Caps**:
   System assignment (`RULES`) and cap removal (`CAPS`) are managed by Explorer M1-2 (`.agents/explorer_m1_2`). Explorer M1-1's discovery output feeds directly into M1-2's uncapped classification loop.

---

## 4. Conclusion

1. **Manifest File Ready**:
   The complete authoritative manifest containing all 934 BodyParts3D STL models has been pre-generated and verified at:
   `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_m1_1\proposed_bodyparts3d-available.json` (247.6 KB).
2. **Worker Deployment Target**:
   The Worker can directly copy this file to:
   `c:\Users\meyig\Documents\Projects\toolbox-ola\scripts\data\bodyparts3d-available.json`
3. **Patch Ready for `scripts/anatomy-select.mjs`**:
   The complete patch implementing the 3-tier discovery fallback is generated at:
   `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_m1_1\discovery_fallback.patch`

---

## 5. Verification Method

To independently verify all findings and artifacts:

1. **Verify Manifest Record Count and Schema**:
   ```bash
   node -e "const fs = require('fs'); const d = JSON.parse(fs.readFileSync('.agents/explorer_m1_1/proposed_bodyparts3d-available.json', 'utf8')); console.log('Count:', d.length, 'Bytes Total:', d.reduce((s,x)=>s+x.bytes,0));"
   ```
   *Expected Output*: `Count: 934 Bytes Total: 1315953756`

2. **Verify Upstream Terminology & Trees Match**:
   ```bash
   node .agents/explorer_m1_1/verify_match.mjs
   ```
   *Expected Output*: `Total tree items: 934 Matched: 934 Missing: 0`

3. **Verify 3-Tier Discovery Fallback Simulation**:
   ```bash
   node .agents/explorer_m1_1/test_fallback_simulation.mjs
   ```
   *Expected Output*: All 3 tiers pass with exit code 0 (`All tests passed successfully!`).

4. **Inspect Generated Files**:
   - `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_m1_1\analysis.md`
   - `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_m1_1\proposed_bodyparts3d-available.json`
   - `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_m1_1\discovery_fallback.patch`
