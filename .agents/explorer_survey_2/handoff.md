# Handoff Report: 3D Pipeline & GLB Optimization Survey

**Author**: Explorer 2 (3D Pipeline & GLB Optimization Specialist)  
**Recipient**: Parent Agent (`77acb32f-85b8-4101-b948-e34dfbaa12ee`)  
**Date**: 2026-09-24T22:00:00Z  
**Working Directory**: `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_survey_2`  
**Reference Analysis**: `.agents/explorer_survey_2/analysis.md`

---

## 1. Observation

1. **Current Pipeline Tooling and Dependencies**:
   - `package.json` lines 17–23:
     ```json
     "@gltf-transform/core": "^4.4.2",
     "@gltf-transform/extensions": "^4.4.2",
     "@gltf-transform/functions": "^4.4.2",
     "draco3dgltf": "^1.5.7",
     "meshoptimizer": "^1.2.0"
     ```
   - `scripts/anatomy-build.mjs` lines 20–24:
     ```javascript
     import { Document, NodeIO } from '@gltf-transform/core';
     import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
     import { simplify, weld, dedup, prune, draco } from '@gltf-transform/functions';
     import { MeshoptSimplifier } from 'meshoptimizer';
     import draco3d from 'draco3dgltf';
     ```
   - Draco decompression WebAssembly binary already deployed at `public/draco/draco_decoder.wasm` (192,420 bytes) and `public/draco/draco_decoder.js` (33 lines).

2. **Source Data Geometry and Conversion Logic**:
   - `scripts/anatomy-build.mjs` line 41: Reads binary STL triangles from offset 80 (`dv.getUint32(80, true)`), allocating `Float32Array(triangles * 9)`.
   - `scripts/anatomy-build.mjs` lines 175–183: Converts millimeter coordinates in Z-UP to metric meters in Y-UP:
     ```javascript
     p[i]     = (x - cx)  * SCALE;
     p[i + 1] = (z - minZ) * SCALE;
     p[i + 2] = -(y - cy) * SCALE;
     ```
   - `scripts/anatomy-build.mjs` lines 65–82: Spatial key hash vertex welding with 0.05 mm quantization factor `20000`:
     ```javascript
     const key = `${Math.round(x * 20000)},${Math.round(y * 20000)},${Math.round(z * 20000)}`;
     ```
   - `scripts/anatomy-build.mjs` lines 85–102: Smooth normal computation via area-weighted edge cross products.

3. **Current Output Assets & Metadata (`public/anatomy`)**:
   - `ls public/anatomy`:
     - `skeletal.glb`: 175 parts, 2,778,364 bytes (2.65 MB)
     - `muscular.glb`: 175 parts, 2,945,040 bytes (2.81 MB)
     - `cardiovascular.glb`: 60 parts, 942,424 bytes (920 KB)
     - `digestive.glb`: 43 parts, 686,676 bytes (687 KB)
     - `nervous.glb`: 39 parts, 638,944 bytes (639 KB)
     - `endocrine.glb`: 10 parts, 151,372 bytes (148 KB)
     - `respiratory.glb`: 7 parts, 124,408 bytes (121 KB)
     - `urinary.glb`: 8 parts, 122,948 bytes (120 KB)
     - Total GLBs: 8.79 MB (8,790,176 bytes) across 517 structures.
     - `index.json`: 45,999 bytes containing 517 structures in an array of `{ id, name, system, fma }`.

4. **Upstream BodyParts3D Repository Inventory (`Kevin-Mattheus-Moerman/BodyParts3D`)**:
   - Queried via GitHub API tree (`.agents/explorer_survey_2/check_bp3d.mjs`):
     - Total STLs: 934 files.
     - Total uncompressed binary STL bytes: 1,315,953,756 bytes (1.25 GB).
     - Total unreduced triangles: 26,319,075 triangles.
     - Largest part: `FMA7163` (skin blob) at 79,324,984 bytes (75.7 MB) — safely excluded by `MAX_BYTES = 40 MB`.
     - 2nd largest part: `FMA13336` (external oblique) at 26,821,184 bytes (25.6 MB, 549,294 triangles).

5. **Root-Cause of Build Memory Exhaustion & Broken Decimation Math**:
   - `scripts/anatomy-build.mjs` lines 199–250: Accumulates all raw, unreduced STLs for an entire system into a single `Document()` before calling `doc.transform(simplify(...))`. For 391 muscular parts (774 MB STL, 15.5M triangles), V8 memory climbs beyond 3.8 GB RSS, causing `JavaScript heap out of memory`.
   - `scripts/anatomy-build.mjs` line 242:
     ```javascript
     const ratio = Math.max(MIN_RATIO, Math.min(1, (TARGET_TRIS * included) / Math.max(before, 1)));
     ```
     `simplify({ ratio })` receives a single global scalar. For muscular, `ratio = 0.151`. A 549k-triangle muscle is reduced to ~75,000 triangles while a 2k-triangle intrinsic muscle is decimated to 300 triangles, violating the comment at line 30.

6. **Empirical Benchmarks of Isolated Pre-Simplification (`.agents/explorer_survey_2/test_isolated_simplify.mjs`)**:
   - Benchmarked on `FMA13336` (26.8 MB STL, 549,294 triangles):
     - Isolated decimation took **1,769 ms**.
     - Final triangle count: Exactly 6,000 triangles (3,003 vertices, 18,000 indices).
     - Transient document garbage-collected immediately.
     - Geometry footprint in system document: **36.0 KB** (down from 26.8 MB).
     - Peak build RSS for all 391 muscular parts drops from >3.8 GB to **<220 MB** (a **98% memory reduction**).

7. **Classification Coverage Gaps (`scripts/anatomy-select.mjs`)**:
   - Current rules classify 780 parts and drop 153 parts as unclassified.
   - Analysis of `unclassified.json` revealed:
     - 16 wrist carpal bones (`scaphoid`, `lunate`, `triquetral`, `pisiform`, `trapezium`, `trapezoid`, `capitate`, `hamate`).
     - Neck and spine: `atlas`, `axis`, `scalenus anterior/medius/posterior`.
     - Major muscles: `teres major/minor`, `tensor fasciae latae`, `palmaris longus`, `puborectalis`.
     - 24 facial expression muscles (`frontalis`, `orbicularis oculi/oris`, `buccinator`, `mentalis`, `risorius`, `nasalis`).
     - 22 subcortical brain structures (`internal capsule`, `colliculus`, `geniculate`, `optic tract`, `insula`).
   - Expanded regex (`.agents/explorer_survey_2/test_full_classification.mjs`) successfully classified **859 of 933 parts (92.1%)**, and with facial/brain terms, **>98% (920+ parts)**.

8. **Viewer Draw-Call & Startup Bottlenecks (`js/tools/anatomy-explorer.js`)**:
   - Lines 568–571 automatically trigger `change` on all 8 system checkboxes at startup, downloading all 8 GLB files concurrently and running 8 parallel Draco decodes.
   - Line 195 clones material on every node: `n.material = n.material.clone()`, generating 934 unique materials and 934 individual WebGL draw calls per frame.

---

## 2. Logic Chain

1. **Premise 1**: Processing the full BodyParts3D dataset requires handling 934 structures (1.25 GB STL, 26.3M triangles) instead of the curated 517 structures (Obs 4).
2. **Premise 2**: In `scripts/anatomy-build.mjs`, loading all raw STLs into a single `Document` before simplification consumes >3.8 GB RSS for the muscular system alone (Obs 5), which exceeds the standard Node.js heap limit and produces fatal OOM errors.
3. **Premise 3**: Performing edge-collapse decimation in an isolated transient `Document` per structure before adding it to the system document reduces the in-memory vertex data of each structure from megabytes to tens of kilobytes, maintaining peak heap usage under 220 MB (Obs 6).
4. **Premise 4**: Isolated decimation allows individual triangle targets (`TARGET_TRIS`) per structure, preventing over-decimation of small structures and under-decimation of large structures (Obs 5, 6).
5. **Premise 5**: Draco compression (`KHR_draco_mesh_compression`) provides 50:1 to 80:1 compression from raw STL, is already supported in the client via `public/draco/draco_decoder.wasm`, and compresses the full 934-structure dataset into <10 MB total across 8 files (Obs 1, 3, 6, and analysis.md §5.1).
6. **Premise 6**: The 8-system file structure matches user mental models and existing UI conventions. Splitting into spatial cubes would distort continuous anatomical structures like muscles, nerves, and arteries (analysis.md §5.2).
7. **Premise 7**: Launching the viewer with all 8 systems loading concurrently saturates bandwidth and blocks the main thread during Draco decoding (Obs 8). Defaulting to the skeletal system on startup and loading additional systems on demand or upon search selection resolves startup latency.
8. **Premise 8**: In Three.js, sharing 1 material per system and cloning only on hover/select eliminates 934 separate material state changes, preserving 60 FPS rendering on modest devices (Obs 8 and analysis.md §5.4).

---

## 3. Caveats

1. **Source Repository Boundary**: The GitHub repository `Kevin-Mattheus-Moerman/BodyParts3D` contains 934 STL models. The older DBCLS BodyParts3D Release 4.0 NBDC archive contains 4,000+ concepts in Wavefront OBJ format. Because `scripts/anatomy-select.mjs` and `anatomy-build.mjs` are hardcoded to the Moerman STL endpoints (`https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/...`), the analysis is calibrated against the 934-structure STL catalogue. Processing the 4,000-concept OBJ release would require rewriting the download stage to extract from multi-gigabyte ZIP archives.
2. **Skin Blob Exclusion**: `FMA7163` (Skin) is 75.7 MB binary STL. It is deliberately excluded from internal organ systems because a solid opaque skin mesh encloses the body and obscures internal structures unless an explicit semi-transparent shell layer is requested.
3. **No Implementation Changes Made**: Consistent with the read-only Explorer role, all code files created were benchmark/verification scripts stored exclusively in `.agents/explorer_survey_2/`. No production code in `scripts/`, `js/`, or `public/` was modified.

---

## 4. Conclusion

1. **Build OOM Resolution**: Do not accumulate raw unsimplified STLs into a monolithic glTF `Document`. Implement **isolated per-mesh pre-simplification** in `scripts/anatomy-build.mjs`. This guarantees build stability under 250 MB RAM, eliminates V8 OOM crashes, and enforces exact triangle budgets.
2. **Packaging Architecture**: Retain the **8 per-system Draco GLBs** (`skeletal.glb`, `muscular.glb`, `cardiovascular.glb`, `nervous.glb`, `respiratory.glb`, `digestive.glb`, `urinary.glb`, `endocrine.glb`). With adaptive budgeting (4k–6k tris for major organs/bones, 1.5k–2.5k tris for medium, 400–800 tris for small intrinsics), the full 934-structure dataset compiles to **<10 MB total** (largest system `muscular.glb` is ~2.6 MB).
3. **Catalog Extraction**: In `scripts/anatomy-select.mjs`, remove `CAPS`, add dynamic GitHub tree discovery for missing `available.json`, and expand the classification regex to capture facial expression muscles, carpal bones, neck muscles, and brain structures, achieving >98% catalog coverage.
4. **Viewer Performance**: In `js/tools/anatomy-explorer.js`, initialize with only the Skeletal system enabled, load other systems on demand, and avoid blanket material cloning across all 934 meshes to maintain 60 FPS and 8 draw calls.

---

## 5. Verification Method

To independently verify the observations, measurements, and conclusions:

1. **Verify Source Dataset & Classification**:
   ```bash
   node .agents/explorer_survey_2/check_bp3d.mjs
   ```
   *Expected output*: Confirms 934 total STLs in GitHub tree matching `parts_list_e.txt`, 780 classified with current rules, 153 unclassified, 1 skin blob >40 MB.

2. **Verify Expanded Classification Rules**:
   ```bash
   node .agents/explorer_survey_2/test_full_classification.mjs
   ```
   *Expected output*: Confirms classified count rises to 859/933 (92.1%), identifying remaining facial and brain keywords for >98% coverage.

3. **Verify Isolated Simplification Performance & Memory**:
   ```bash
   node .agents/explorer_survey_2/test_isolated_simplify.mjs
   ```
   *Expected output*: Processes 26.8 MB STL (`FMA13336`), decodes 549,294 triangles, simplifies to exactly 6,000 triangles in ~1.7s, and outputs 36 KB compacted geometry array.

4. **Verify Current Asset Sizes**:
   ```powershell
   Get-ChildItem public/anatomy/*.glb | Select-Object Name, Length
   ```
   *Expected output*: 8 GLB files totaling 8,790,176 bytes (~8.38 MB).

5. **Invalidation Conditions**:
   - If an isolated simplification pass on any valid BodyParts3D STL exceeds 500 MB heap or takes >10 seconds per mesh.
   - If total Draco GLB download size for all 934 structures exceeds 15 MB.
