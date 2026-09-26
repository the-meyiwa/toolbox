# Handoff Report: Anatomy Data & Extraction Survey

**Agent**: Explorer 1 (Anatomy Data & Extraction Specialist)  
**Parent Conversation ID**: `77acb32f-85b8-4101-b948-e34dfbaa12ee`  
**Working Directory**: `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_survey_1`  
**Date**: 2026-09-24  
**Handoff Type**: Hard (Task Complete)

---

## 1. Observation

### 1.1 Existing Workspace Data and Build Artifacts
- **GLB Models**: `public/anatomy/` contains 8 pre-built Draco-compressed GLB files totaling 8.40 MB:
  - `cardiovascular.glb` (942,424 bytes)
  - `digestive.glb` (686,676 bytes)
  - `endocrine.glb` (151,372 bytes)
  - `muscular.glb` (2,945,040 bytes)
  - `nervous.glb` (638,944 bytes)
  - `respiratory.glb` (124,408 bytes)
  - `skeletal.glb` (2,778,364 bytes)
  - `urinary.glb` (122,948 bytes)
  - Verified via `list_dir(DirectoryPath="c:/Users/meyig/Documents/Projects/toolbox-ola/public/anatomy")`.
- **Runtime Catalog**: `public/anatomy/index.json` (45,999 bytes) indexes 517 structures across the 8 systems:
  - `skeletal`: 175, `muscular`: 175, `cardiovascular`: 60, `nervous`: 39, `digestive`: 43, `endocrine`: 10, `urinary`: 8, `respiratory`: 7.
- **Git Ignore**: `.gitignore` line 4 contains `.anatomy-src/`. As a result, no raw STL files or local source files exist in the cloned workspace.

### 1.2 The Missing `available.json` Failure
- Executing `node scripts/anatomy-select.mjs` immediately terminates with:
  ```
  Error: ENOENT: no such file or directory, open 'C:\Users\meyig\Documents\Projects\toolbox-ola\.anatomy-src\available.json'
      at Object.readFileSync (node:fs:484:20)
      at file:///C:/Users/meyig/Documents/Projects/toolbox-ola/scripts/anatomy-select.mjs:102:29
  ```
  Verified at `scripts/anatomy-select.mjs:102`:
  `const parts = JSON.parse(fs.readFileSync(path.join(SRC, 'available.json'), 'utf8'));`

### 1.3 Upstream BodyParts3D Repository Contents
- Remote repository: `https://github.com/Kevin-Mattheus-Moerman/BodyParts3D` (referred to on line 18 of `scripts/anatomy-select.mjs`).
- Queried GitHub Trees API for commit tree `87872e81ee4defb42aeef92b311a06c5e484834d` (`assets/BodyParts3D_data/stl`):
  - Exactly **934 binary STL files** exist in the repository.
  - Total uncompressed size of all 934 files is **1,254.99 MB** (1.25 GB).
  - Fetched and decoded `assets/BodyParts3D_data/parts_list_e.txt` (1,524 lines): all 934 STLs cross-reference to preferred English anatomical concepts and FMA IDs with zero missing mappings.

### 1.4 Hardcoded `CAPS` in `scripts/anatomy-select.mjs`
- Lines 54–57 of `scripts/anatomy-select.mjs`:
  ```javascript
  const CAPS = {
    skeletal: 175, muscular: 175, cardiovascular: 85, nervous: 60,
    digestive: 45, respiratory: 25, urinary: 15, endocrine: 20,
  };
  ```
  Total of all caps = 600.
- When applied to the 934 available parts:
  - 517 structures are selected.
  - Only `skeletal` (175 of 248) and `muscular` (175 of 365) hit their caps.
- When `CAPS` are removed under existing regexes:
  - 780 structures are selected (Skeletal: 248, Muscular: 365, Cardiovascular: 60, Nervous: 39, Digestive: 43, Endocrine: 10, Urinary: 8, Respiratory: 7).
  - Total source STL size increases from 661.6 MB to 1,065.2 MB (+61%).

### 1.5 Deficiencies in System Classification Regexes (`RULES`)
- In `scripts/anatomy-select.mjs` lines 29–45: 154 of the 934 parts fail to match any system regex and are dropped.
- Direct inspection of the 154 dropped items identified:
  - Skeletal: `atlas` (FMA12519), `axis` (FMA12520), all 8 wrist carpal bones for both hands (`scaphoid`, `lunate`, `triquetral`, `pisiform`, `trapezium`, `trapezoid`, `capitate`, `hamate`), `inferior nasal concha`.
  - Muscular: `scalenus` muscles, `teres major/minor`, `subclavius`, `tensor fasciae latae`, `palmaris longus`, `rotator` (singular), 16 facial expression muscles (`frontalis`, `orbicularis oculi/oris`, `buccinator`, `risorius`, `nasalis`, `procerus`, etc.).
  - Nervous: 24 cerebral gyri (`superior/middle frontal`, `precentral`, `postcentral`, `supramarginal`, `angular`, `temporal`, `fusiform`, `cingulate`, `straight gyrus`), `internal capsule`, `insula`, `optic tract`, `colliculi`, `geniculate bodies`.
  - Oversized exclusion: `FMA7163 skin` (77.47 MB) is excluded by `MAX_BYTES = 40 * 1024 * 1024` on line 22.
- Testing refined regex rules classified **927 of the 934 parts** (leaving only 1 oversized skin mesh and 6 sensory/adnexa items).

### 1.6 UI & Knowledge Architecture
- `js/lib/anatomy-data.js`:
  - `anatomyService.prototype.getDetail(name, system)` (lines 1180–1226) includes an automatic fallback and regex-based region classifier, preventing crashes for any newly added structures.
  - Unit tests in `tests/unit/assistant-anatomy.test.js` pass with 100% success (8/8 passing).
- `js/tools/anatomy-explorer.js`:
  - Structure list rendering is clamped at `.slice(0, 300)` (line 353) and performs naive `listEl.innerHTML = ...` replacement (line 362), confirming the need for list virtualization when handling 900+ structures.

---

## 2. Logic Chain

1. **Premise**: R1 of `ORIGINAL_REQUEST.md` requires modifying `scripts/anatomy-select.mjs` to remove `CAPS` so that all available structures in the dataset are processed.
2. **Analysis of Dataset Size**:
   - The upstream source is `Kevin-Mattheus-Moerman/BodyParts3D` (containing 934 binary STL files).
   - In `scripts/anatomy-select.mjs`, `available.json` originally contained these 934 parts.
   - When the `CAPS` (summing to 600) were enforced, 517 structures were selected (175 skeletal, 175 muscular, and 167 across the other 6 systems).
3. **Evaluating Uncapped Extraction**:
   - Removing the `.slice(0, CAPS[system])` restriction without changing regexes yields 780 structures (+263 structures over the current build).
   - However, leaving the classification regexes as-is silently drops 154 parts, including textbook bones like the atlas, axis, and carpal bones, and critical muscles and cerebral cortex gyri.
   - Refining the regexes allows **927 structures** (~1.18 GB source STLs) to be fully extracted and organized into the 8 systems.
4. **Build & Runtime Feasibility**:
   - Compressing 927 structures with the existing Draco settings will yield an estimated **15.5 to 17.5 MB** across the 8 systems (e.g. Muscular ~6.8 MB, Skeletal ~4.2 MB). Because each system is loaded on-demand only when checked, initial page load is unaffected.
   - In `anatomy-build.mjs`, sequential system processing keeps peak memory within manageable limits, provided Node heap memory is monitored for the 428-mesh muscular system.
   - In `anatomy-explorer.js`, the 300-item `.slice` and unvirtualized list must be replaced with virtualized scrolling to support 927 structures without browser lag.
5. **Operational Prerequisite**:
   - Because `.anatomy-src` is git-ignored, running `anatomy-select.mjs` fails unless an authoritative `available.json` manifest is provided or committed to the repository (e.g., at `scripts/data/bodyparts3d-available.json`).

---

## 3. Caveats

- **Scope of Current STL Repo vs DBCLS 4.3**: The upstream repository `Kevin-Mattheus-Moerman/BodyParts3D` provides 934 binary STL files derived from BodyParts3D Release 3.0. The official DBCLS BodyParts3D Release 4.3 contains 3,210 OBJ meshes. The current Toolbox pipeline was explicitly designed and written for the 934 STL files. Migrating to 3,210 OBJ files would require rewriting the STL binary parser into an OBJ parser and downloading multiple gigabytes of external OBJ archives. The 934-part dataset represents the full available STL dataset for the existing pipeline.
- **Network Environment**: Downloading 927 binary STLs requires an active internet connection capable of pulling ~1.18 GB from GitHub.
- **Sensory & Integumentary Organs**: The 6 unclassified items (`eyeball`, `ear`, `hairs`, `eyebrows`) and 77 MB `skin` mesh are not assigned to the standard 8 systems. They can remain excluded or mapped to a future sensory/integumentary system.

---

## 4. Conclusion

1. **Dataset Boundary**: The available dataset for the current pipeline consists of **934 binary STL structures** (1.25 GB) from `Kevin-Mattheus-Moerman/BodyParts3D`, matching concepts in `parts_list_e.txt`.
2. **Cap Removal & Extraction Plan**:
   - Removing `CAPS` in `scripts/anatomy-select.mjs` unlocks 780 structures under existing rules.
   - Expanding the regex patterns in `RULES` classifies **927 structures** across the 8 organ systems (Skeletal: 268, Muscular: 428, Nervous: 95, Cardiovascular: 60, Digestive: 46, Endocrine: 15, Urinary: 8, Respiratory: 7).
3. **Actionable Implementations Required**:
   - **Data Manifest**: Commit `scripts/data/bodyparts3d-available.json` (listing all 934 parts) and update `scripts/anatomy-select.mjs` to read from it when `.anatomy-src/available.json` is missing.
   - **Selector Rules**: Remove `CAPS` and update regex patterns in `scripts/anatomy-select.mjs` to classify the 154 omitted structures.
   - **Handoff to Explorer 2**: Coordinate GLB decimation ratios and Draco quantization parameters for the 428-mesh muscular system and 268-mesh skeletal system.
   - **Handoff to Explorer 3**: Implement DOM virtualization for the 927-item structure list in `js/tools/anatomy-explorer.js`.

---

## 5. Verification Method

To independently verify these findings:

1. **Verify Existing Tests**:
   ```bash
   node --test tests/unit/assistant-anatomy.test.js
   ```
   *Expected outcome*: 8 passing tests (0 failures).

2. **Verify Missing `available.json`**:
   ```bash
   node scripts/anatomy-select.mjs
   ```
   *Expected outcome*: Immediate `ENOENT` failure demonstrating that `.anatomy-src/available.json` is absent.

3. **Verify Upstream STL Count & Sizes**:
   Execute the verification snippet against the GitHub Trees API output:
   ```bash
   node -e "const fs = require('fs'); const lines = fs.readFileSync('C:\\Users\\meyig\\.gemini\\antigravity\\brain\\f0e068f8-0dac-44ce-a46a-ba15a198b54a\\.system_generated\\steps\\50\\content.md', 'utf8').split('\n'); const data = JSON.parse(lines.slice(8).join('\n')); console.log('STL entries:', data.tree.length);"
   ```
   *Expected outcome*: Exactly `934` entries.

4. **Verify Existing GLB & Index Structure**:
   ```bash
   node -e "const idx = JSON.parse(fs.readFileSync('public/anatomy/index.json', 'utf8')); console.log('Structures:', idx.structures.length, 'Systems:', Object.keys(idx.systems));"
   ```
   *Expected outcome*: `517` structures across 8 systems.

5. **Inspect Detailed Analysis**:
   Review `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_survey_1\analysis.md`.
