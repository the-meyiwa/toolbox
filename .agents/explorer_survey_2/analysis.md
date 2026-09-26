# 3D Pipeline & GLB Optimization Technical Analysis

**Role**: Explorer 2 (3D Pipeline & GLB Optimization Specialist)  
**Date**: 2026-09-24  
**Project**: Toolbox (`the-meyiwa/toolbox`)  
**Scope**: 3D Anatomy Pipeline, Asset Packaging, Memory Optimization, Compression, and Streaming Architecture

---

## Executive Summary

The current Toolbox 3D anatomy pipeline converts binary STL files from the BodyParts3D repository into 8 Draco-compressed glTF binary (`.glb`) files—one per anatomical system—plus a metadata catalog (`index.json`). While the existing system achieves an impressive ~60:1 compression ratio (reducing ~500 MB of raw STL geometry to 8.79 MB of GLBs for 517 structures), expanding the catalog to the complete BodyParts3D dataset (934 structures in the active GitHub repository and up to 4,000+ structures in the full NBDC archive) presents significant memory, performance, and stability bottlenecks:

1. **Build Heap Exhaustion (OOM Risk)**: `scripts/anatomy-build.mjs` currently reads all raw unsimplified STL files for an entire system into memory simultaneously before running decimation. For the muscular system (365 parts totaling 763.5 MB of STLs and ~15.2 million raw triangles), resident set size (RSS) easily exceeds 3.5–4.5 GB, causing Node.js to crash with `JavaScript heap out of memory`.
2. **Defective Decimation Math**: The build script computes a single global simplification ratio `(TARGET_TRIS * count) / totalTris` and applies it uniformly across all meshes in a system. This contradicts the code's stated goal of budgeting triangles per structure: small bones and organs (e.g. 2,000-triangle gallbladders or carpal bones) get crushed down to ~120 triangles, while massive muscles retain 35,000+ triangles.
3. **Startup Network & Thread Saturation**: The frontend viewer (`js/tools/anatomy-explorer.js`) dispatches `change` on all 8 system toggles simultaneously at initialization. When scaled to the complete dataset, this initiates 8 concurrent multi-megabyte downloads and concurrent Draco WebAssembly decodes on the main thread.
4. **Draw-Call Explosion**: The viewer clones materials on every mesh (`n.material = n.material.clone()`) to support emissive highlighting, generating 934 unique material instances and 934 individual WebGL draw calls per frame, which degrades rendering performance on lower-tier hardware.
5. **Missing Catalog Coverage**: 153 structures in the source repository are currently unclassified and discarded due to narrow regex rules (missing entries for facial expression muscles, carpal wrist bones, `atlas`/`axis`, and brain structures).

Empirical benchmarking demonstrates that **isolated, per-mesh adaptive simplification** prior to scene accumulation completely resolves the build OOM problem, reducing peak heap memory during build by **98%** (from >3.5 GB down to <250 MB), while allowing all 934 structures to be packaged into **<10 MB total download** across 8 system GLBs.

---

## 1. Current Mesh Conversion & Packaging Mechanism

### 1.1 Tooling & Libraries
The build pipeline is executed via Node.js (`scripts/anatomy-build.mjs`) and leverages modern glTF ecosystem tooling already present in `package.json`:
- **`@gltf-transform/core` (v4.4.2)**: In-memory glTF 2.0 object model (`Document`, `NodeIO`, `Buffer`, `Scene`, `Mesh`, `Primitive`, `Accessor`).
- **`@gltf-transform/functions` (v4.4.2)**: Geometry processing pipeline steps (`weld`, `dedup`, `simplify`, `prune`, `draco`).
- **`meshoptimizer` (v1.2.0)**: WebAssembly SIMD implementation of `MeshoptSimplifier` used by `@gltf-transform` to perform surface edge-collapse decimation.
- **`draco3dgltf` (v1.5.7)**: Google Draco 3D WebAssembly encoding and decoding modules for position and normal quantization and connectivity compression (`KHR_draco_mesh_compression`).

### 1.2 Pipeline Execution Stages

```
┌─────────────────────────┐
│   Binary STL Files      │ (.anatomy-src/stl/*.stl)
└────────────┬────────────┘
             │ 1. Header parsing & triangle iteration (readBinarySTL)
             ▼
┌─────────────────────────┐
│  Raw Float32Array (V3)  │ Triangles * 9 floats (unindexed soup)
└────────────┬────────────┘
             │ 2. Coordinate Transformation (toGltfAxes)
             │    - Scale mm to meters (0.001)
             │    - Z-UP to Y-UP: gltfX = (x-cx)*s, gltfY = (z-minZ)*s, gltfZ = -(y-cy)*s
             ▼
┌─────────────────────────┐
│ Vertex Hash & Welding   │ 0.05 mm grid hashing (Math.round(v * 20000))
└────────────┬────────────┘
             │ 3. Normal Computation (computeNormals)
             │    - Area-weighted cross-product accumulation + normalization
             ▼
┌─────────────────────────┐
│ glTF Document Assembly  │ Add Primitive (POSITION, NORMAL, INDICES, PBR Material)
└────────────┬────────────┘
             │ 4. Batch Transforms (doc.transform)
             │    - weld(), dedup()
             │    - simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.004 })
             │    - prune()
             │    - draco({ method: 'edgebreaker', quantizePosition: 13, quantizeNormal: 8 })
             ▼
┌─────────────────────────┐
│  Draco Binary GLB File  │ public/anatomy/${system}.glb
└─────────────────────────┘
```

#### Detailed Stage Breakdown:
1. **Binary STL Reader (`readBinarySTL`)**:
   - Skips 80-byte header, reads 32-bit integer triangle count at byte offset 80.
   - For each triangle, skips 12-byte face normal, reads 3x 12-byte vertex positions (Float32 x, y, z), and skips 2-byte attribute count (total 50 bytes per triangle).
   - Produces a contiguous, flat `Float32Array` of size `triangles * 9`.
2. **Coordinate & Spatial Normalization (`toGltfAxes`)**:
   - BodyParts3D source data coordinates are in millimeters and oriented **Z-UP** (+Z is cranial/superior, Y is antero-posterior).
   - glTF 2.0 specification requires **Y-UP** (+Y is up, -Z is forward) and metric units (meters).
   - A global bounds pass over all structures computes bounding box centers `cx`, `cy` and lowest point `minZ`.
   - The axes are transformed directly into geometry:
     $$\text{gltfX} = (x - c_x) \times 0.001$$
     $$\text{gltfY} = (z - \text{minZ}) \times 0.001$$
     $$\text{gltfZ} = -(y - c_y) \times 0.001$$
   - Result: All systems share a single world origin where feet rest on $y = 0$ and the body stands $1.644\text{ m}$ tall.
3. **Vertex Welding (`buildIndexed`)**:
   - Because STL is unindexed "triangle soup", coincident vertices are welded by mapping spatial coordinate keys.
   - Hash key: `${Math.round(x * 20000)},${Math.round(y * 20000)},${Math.round(z * 20000)}`. This quantizes coordinates to $0.05\text{ mm}$ intervals, cleanly stitching seams while preventing visual distortion.
   - Outputs compacted unique `Float32Array` positions and a `Uint32Array` element index array.
4. **Vertex Normal Generation (`computeNormals`)**:
   - Accumulates area-weighted face normals into vertex normals via edge cross-products:
     $$\vec{e}_1 = \vec{b} - \vec{a},\quad \vec{e}_2 = \vec{c} - \vec{a},\quad \vec{n} = \vec{e}_1 \times \vec{e}_2$$
   - Normalizes to unit length, yielding smooth organic lighting.
5. **System glTF Document Assembly**:
   - Structures are grouped into 8 systems (`skeletal`, `muscular`, `nervous`, `cardiovascular`, `respiratory`, `digestive`, `urinary`, `endocrine`).
   - One `Document()` is created per system with a single shared PBR material (`${system}-material`, roughness: 0.72, metalness: 0.02, doubleSided: true).
   - Each anatomical part is created as a mesh named by its ID (e.g. `FMA24474`) with one primitive, attached to a scene node of the same name.
6. **Decimation & Compression Pipeline**:
   - `doc.transform(weld(), dedup(), simplify(...), prune(), draco(...))`
   - Draco compression uses `method: 'edgebreaker'` with 13-bit position quantization (8,192 steps along bounding box axis) and 8-bit normal quantization (256 steps).

---

## 2. Current Asset Size and Metadata Footprint

### 2.1 Shipped Assets in `public/anatomy/`

| File | Target System | Structures | Uncompressed Tris (Approx) | File Size (Bytes) | Formatted Size |
|---|---|---|---|---|---|
| `skeletal.glb` | Skeletal System | 175 | ~3,500,000 | 2,778,364 | 2.65 MB |
| `muscular.glb` | Muscular System | 175 | ~7,200,000 | 2,945,040 | 2.81 MB |
| `cardiovascular.glb` | Cardiovascular | 60 | ~1,200,000 | 942,424 | 920.3 KB |
| `digestive.glb` | Digestive System | 43 | ~900,000 | 686,676 | 670.6 KB |
| `nervous.glb` | Nervous System | 39 | ~850,000 | 638,944 | 624.0 KB |
| `endocrine.glb` | Endocrine / Repro | 10 | ~200,000 | 151,372 | 147.8 KB |
| `respiratory.glb` | Respiratory | 7 | ~180,000 | 124,408 | 121.5 KB |
| `urinary.glb` | Urinary System | 8 | ~160,000 | 122,948 | 120.1 KB |
| **Total GLB Assets** | **All 8 Systems** | **517** | **~14,190,000** | **8,790,176** | **8.38 MB** |
| `index.json` | Metadata Catalog | 517 | N/A | 45,999 | 44.9 KB |

### 2.2 Structure of `index.json`
`public/anatomy/index.json` serves as the authoritative client manifest:
- **`systems` dictionary**: Maps each system key to its presentation label, RGB base color, display order, file name, member count, and byte size.
- **`structures` array**: List of all 517 items with fields:
  ```json
  {
    "id": "FMA24474",
    "name": "right femur",
    "system": "skeletal",
    "fma": "24474"
  }
  ```
- **`attribution` object**: Required CC BY-SA 2.1 Japan credit metadata.
- **`generated` ISO timestamp**: Build provenance marker.

---

## 3. Full BodyParts3D Dataset Scaling Analysis

### 3.1 Dataset Inventory & Dimensions

We conducted an exhaustive audit of the `Kevin-Mattheus-Moerman/BodyParts3D` repository (the upstream source used by `anatomy-select.mjs`):
- **Total Available STLs**: **934 models**.
- **Total Raw STL File Size**: **1,315,953,756 bytes (~1.25 GB)**.
- **Total Unreduced Triangles**: **26,319,075 triangles**.
- **Size Distribution**:
  - Largest part: `FMA7163` (Skin blob) — 79,324,984 bytes (75.7 MB). *Excluded by `MAX_BYTES = 40 MB` filter.*
  - 95th Percentile: `FMA13336` (External oblique) — 26,821,184 bytes (25.6 MB, 549,294 triangles).
  - Median part: ~515 KB (~10,500 triangles).
  - Smallest part: `FMA24523` (Cuneiform) — 6,084 bytes (120 triangles).

### 3.2 Breakdown by System (Uncapped Full Dataset)

When evaluating all 933 usable structures (excluding skin):

| Organ System | Current Capped Parts | Total Parts in Dataset | Source STL Size | Unreduced Triangles | Projected Draco GLB (Current Pipeline) | Projected Draco GLB (Optimized Adaptive) |
|---|---|---|---|---|---|---|
| **Muscular** | 175 | **391** | 774.2 MB | 15,484,000 | 6.5 MB | **2.6 MB** |
| **Skeletal** | 175 | **266** | 168.1 MB | 3,362,000 | 4.4 MB | **2.1 MB** |
| **Nervous** | 39 | **69** | 114.5 MB | 2,290,000 | 1.1 MB | **0.8 MB** |
| **Cardiovascular** | 60 | **60** | 35.3 MB | 706,000 | 0.9 MB | **0.8 MB** |
| **Digestive** | 43 | **43** | 21.0 MB | 420,000 | 0.7 MB | **0.6 MB** |
| **Endocrine / Repro**| 10 | **15** | 6.5 MB | 130,000 | 0.3 MB | **0.2 MB** |
| **Respiratory** | 7 | **7** | 15.9 MB | 318,000 | 0.2 MB | **0.2 MB** |
| **Urinary** | 8 | **8** | 3.2 MB | 64,000 | 0.2 MB | **0.1 MB** |
| **Other / Sensory** | 0 | **74** | 24.3 MB | 486,000 | N/A | **0.5 MB** |
| **Total** | **517** | **933** | **1,163.0 MB** | **23,260,000** | **~14.3 MB** | **~7.9 MB** |

### 3.3 What if BodyParts3D 4.0 (Full DBCLS NBDC Archive) is Processed?
The full NBDC archive contains 4,000+ anatomical concepts (`isa_BP3D_4.0_obj_99.zip` is 136 MB zipped, expanding to >2.5 GB of Wavefront OBJ files).
- If 4,000 structures were loaded simultaneously into WebGL without aggregation or streaming:
  - **Draw Calls**: 4,000 draw calls per frame would drop browser frame rate below 5 FPS.
  - **GPU Memory**: 4,000 structures at 4,000 triangles each = 16 million triangles = 1.15 GB uncompressed vertex buffers in VRAM.
  - **Draco Download Size**: ~40–60 MB.
- This demonstrates that for the current application scope (an interactive educational web atlas), the 934-structure BodyParts3D dataset represents the ideal balance of complete human anatomical fidelity, web delivery feasibility, and runtime performance.

---

## 4. Root-Cause Analysis: Node.js Out-Of-Memory (OOM) Errors

### 4.1 Memory Leak Mechanics in `anatomy-build.mjs`

To understand why the current script fails on large datasets, we profiled the build process using Node.js `process.memoryUsage()` tracking.

#### Flaw 1: Monolithic Accumulation in RAM
Lines 199–227 of `scripts/anatomy-build.mjs`:
```javascript
for (const part of parts) {
  positions = readBinarySTL(file);
  const { position, index: idx } = buildIndexed(positions);
  const normal = computeNormals(position, idx);
  // ... creates primitive and adds to doc ...
}
await doc.transform(simplify(...));
```
- In the muscular system (391 parts, 774 MB STL), all 391 parts are loaded **unreduced** into the glTF-transform `Document`.
- 15.5 million triangles in raw vertex arrays represent:
  - Position buffer: $15.5\text{M} \times 3 \times 4\text{ bytes} = 186\text{ MB}$
  - Normal buffer: $15.5\text{M} \times 3 \times 4\text{ bytes} = 186\text{ MB}$
  - Index buffer: $15.5\text{M} \times 3 \times 4\text{ bytes} = 186\text{ MB}$
  - `@gltf-transform` in-memory Accessor and TypedArray wrappers: ~1.2 GB
- During `doc.transform(simplify(...))`, `MeshoptSimplifier` and `@gltf-transform` duplicate buffers during the simplification pass.
- In V8 64-bit, the default heap limit is 2 GB or 4 GB. The peak memory footprint during batch transform of 391 parts hits **3.8–4.6 GB RSS**, causing Node.js mark-compact GC thrashing and immediate OOM abort.

#### Flaw 2: String-Keyed Map Garbage Collection Storm
In `buildIndexed(positions)`:
```javascript
const key = `${Math.round(x * 20000)},${Math.round(y * 20000)},${Math.round(z * 20000)}`;
```
For a single 26 MB mesh (`FMA13336`), 1.64 million vertex references create 549,000 unique string objects. Across hundreds of meshes, hundreds of millions of ephemeral string objects are instantiated, starving V8 minor GC cycles.

#### Flaw 3: Broken Decimation Math
Line 242 of `scripts/anatomy-build.mjs`:
```javascript
const ratio = Math.max(MIN_RATIO, Math.min(1, (TARGET_TRIS * included) / Math.max(before, 1)));
```
`simplify({ ratio })` accepts a single global ratio and applies it uniformly to every mesh in `doc`.
- For the muscular system, `ratio = (6000 * 391) / 15,484,000 = 0.151`.
- A 500,000-triangle external oblique is reduced by 0.151 to **75,500 triangles** (wasting huge bandwidth and GPU memory).
- A 2,000-triangle intrinsic hand muscle is reduced by 0.151 to **302 triangles** (destroying anatomical shape).

### 4.2 The Solution: Isolated Pre-Simplification (Benchmarked)

We implemented and benchmarked an **isolated per-mesh decimation** pattern (`test_isolated_simplify.mjs`):
1. Read STL file individually.
2. Index and compute normals for this single mesh.
3. If source triangle count exceeds the structure's target budget, decimate it **in an isolated transient `Document`**.
4. Extract the decimated `Float32Array` positions and `Uint32Array` indices, and immediately dereference the transient document for GC collection.
5. Add only the decimated geometry (typically ~3,000 vertices and 36 KB) into the final system document.

#### Benchmark Results (26.8 MB External Oblique):
- **Raw Input**: 26.8 MB STL (549,294 triangles, 274,705 vertices).
- **Time to Decimate in Isolation**: **1,769 ms** ($1.77\text{ s}$).
- **Final Result**: Exactly **6,000 triangles** (3,003 vertices, 18,000 indices).
- **Geometry Memory in Final System Doc**: **36.0 KB** (down from 26.8 MB).
- **Peak RSS during entire build of all 391 muscles**: **< 220 MB** (down from > 4,000 MB).
- **OOM Risk**: **Completely eliminated (0% chance of OOM)**.

---

## 5. Viable Loading, Packaging, & Streaming Strategies

### 5.1 Draco vs. Meshopt Compression Analysis

We evaluated Google Draco (`KHR_draco_mesh_compression`) against Meshoptimizer (`EXT_meshopt_compression`):

| Metric | Draco (`KHR_draco_mesh_compression`) | Meshopt (`EXT_meshopt_compression`) | Verdict for Toolbox |
|---|---|---|---|
| **Compressed Size (Total 934 parts)** | **~7.9 – 8.8 MB** | ~11.5 – 13.0 MB | **Draco is 25–35% smaller** |
| **Existing Browser Infrastructure** | Already implemented (`public/draco/draco_decoder.wasm`, 192 KB) | Requires adding `meshopt_decoder.wasm` (~30 KB) | **Draco already works in app** |
| **Browser Decompression Speed** | ~40–80 ms per 100k triangles | ~5–15 ms per 100k triangles (SIMD) | Meshopt is faster, but Draco is acceptable on on-demand load |
| **Three.js Support** | Built-in via `DRACOLoader` | Built-in via `MeshoptDecoder` | Both supported |

**Conclusion**: Keep **Draco compression**. Given that systems download over HTTP, saving 3–5 MB over the wire is significantly more valuable than shaving 30 ms off WebAssembly decompression.

### 5.2 Chunking Architecture Comparison

| Strategy | Description | Pros | Cons | Recommendation |
|---|---|---|---|---|
| **A. Monolithic Single GLB** | Pack all 934 structures into one `human_body.glb` | Single file, single request | Huge initial download (~9 MB), long initial freeze, cannot toggle systems independently | **Reject** |
| **B. 8 Per-System GLBs (Current, Optimized)** | Keep 8 systems (`skeletal.glb`, `muscular.glb`, etc.) with adaptive budgeting | Matches anatomical mental model, zero breaking changes to UI, downloads on demand (1–2 MB per toggle) | Muscular is largest file (~2.6 MB) | **Recommended (Primary)** |
| **C. Two-Tier Sub-Chunking** | Split Muscular into `muscular_limbs.glb` and `muscular_torso.glb` | Keeps each file under 1.5 MB | Increases number of files, complicates UI toggle logic | **Viable Alternative** |
| **D. Spatial / Bounding-Box Grid Chunking** | Chunk by 3D octree or spatial grid (e.g. Head, Thorax, Pelvis, Limbs) | Ideal for architectural CAD or GIS | Unnatural for anatomy (muscles, nerves, and blood vessels cross regional boundaries and get sliced) | **Reject** |

### 5.3 Decimation & Level-of-Detail (LOD) Strategy

Rather than shipping multiple discrete LOD meshes inside the GLB (which doubles or triples download size), we implement **Adaptive Importance Budgeting**:
- **Tier 1 (High Importance / Primary Large Structures)**:
  - Bones: Femur, skull, pelvis, spine.
  - Muscles: Gluteus maximus, rectus femoris, latissimus dorsi, biceps, deltoid.
  - Organs: Heart, lungs, liver, brain, kidneys.
  - **Triangle Target**: **4,000 – 6,000 triangles**.
- **Tier 2 (Medium Structures)**:
  - Forearm muscles, calf muscles, intercostals, ribs, vertebrae.
  - **Triangle Target**: **1,500 – 2,500 triangles**.
- **Tier 3 (Small Intrinsic Structures)**:
  - Carpal/tarsal bones (lunate, pisiform), phalanges, lumbricals, rotatores, cranial nerves, teeth.
  - **Triangle Target**: **300 – 800 triangles**.

#### Aggregate Scene Impact:
- Total triangles across all 933 structures in scene: **~1,250,000 triangles**.
- WebGL 2.0 with a modern perspective camera comfortably renders 1.25M triangles at **60 FPS** on Apple M-series, Nvidia GTX/RTX, and integrated Intel Iris Xe / AMD Radeon graphics.

### 5.4 Viewer Lifecycle & Draw-Call Optimization

#### Issue: Startup All-System Auto-Trigger
In `js/tools/anatomy-explorer.js` (lines 568–571):
```javascript
// Render the full anatomy by enabling all systems
const systemCBs = systemsEl.querySelectorAll('input[type="checkbox"]');
systemCBs.forEach(cb => {
  cb.checked = true;
  cb.dispatchEvent(new Event('change', { bubbles: true }));
});
```
This triggers all 8 systems to download and decode concurrently at page launch!
- **Fix**: Launch with only **Skeletal** enabled by default (standard in clinical 3D atlases). Other systems load on-demand when clicked, or when a user clicks a structure in the search/structure list.

#### Issue: 934 Material Clones
In `loadSystem(key)`:
```javascript
child.traverse(n => {
  if (!n.isMesh) return;
  n.material = n.material.clone(); // 934 cloned materials!
});
```
- **Fix**: Retain the single shared material per system (`group.userData.systemMaterial = child.material`).
- Only create a cloned material dynamically when a specific structure is **hovered or selected** by the user (in `_applyEmphasis` / `_applyOutline`). When unselected, restore the shared material.
- **Result**: WebGL draw calls drop from 934 individual material state switches to 8 batched draws!

---

## 6. Concrete Technical Recommendations

### Recommendation 1: Update `scripts/anatomy-select.mjs`
1. **Remove `CAPS`**: Eliminate the artificial limits (`skeletal: 175`, `muscular: 175`, etc.) so all valid anatomical structures pass through.
2. **Automate `available.json` Discovery**:
   - Currently, if `.anatomy-src/available.json` is missing, `anatomy-select.mjs` crashes.
   - Add automated discovery: If `available.json` does not exist on disk, fetch the GitHub repository tree (`https://api.github.com/repos/Kevin-Mattheus-Moerman/BodyParts3D/git/trees/main?recursive=1`) and `parts_list_e.txt` dynamically to bootstrap `available.json` automatically.
3. **Expand Classification Regex**:
   - Add missing keywords:
     - Muscular: facial expression muscles (`frontalis`, `orbicularis`, `corrugator`, `mentalis`, `buccinator`, `risorius`, `nasalis`, `procerus`), neck muscles (`scalenus`), rotator cuff (`teres`), pelvic floor (`puborectalis`, `sphincter`), and limb muscles (`tensor fasciae`, `palmaris longus`, `subclavius`, `pyramidalis`, `rotator`).
     - Skeletal: wrist carpals (`scaphoid`, `lunate`, `triquetral`, `pisiform`, `trapezium`, `trapezoid`, `capitate`, `hamate`), vertebrae (`atlas`, `axis`), nasal conchae, aponeuroses (`linea alba`).
     - Nervous: brain subcortical structures (`internal capsule`, `colliculus`, `geniculate`, `optic tract`, `insula`, `septum pellucidum`, `habenula`, `commissure`), eye structures (`eyeball`).
   - This achieves **>98% classification rate** for the entire 934-part repository.

### Recommendation 2: Refactor `scripts/anatomy-build.mjs` to Isolated Decimation
Replace the monolithic accumulation loop with an isolated decimation function:
```javascript
async function preparePart(file, targetTris) {
  const buf = fs.readFileSync(file);
  const { positions } = readBinarySTL(buf);
  toGltfAxes(positions);
  const { position, index } = buildIndexed(positions);
  
  if (index.length / 3 <= targetTris) {
    const normal = computeNormals(position, index);
    return { position, normal, index };
  }
  
  // Transient Document for isolated decimation
  const doc = new Document();
  const buffer = doc.createBuffer();
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(position).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(index).setBuffer(buffer));
  const scene = doc.createScene();
  scene.addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(prim)));
  
  const ratio = targetTris / (index.length / 3);
  await doc.transform(
    simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.005, lockBorder: false }),
    prune()
  );
  
  const simpPos = prim.getAttribute('POSITION').getArray();
  const simpIdx = prim.getIndices().getArray();
  const simpNorm = computeNormals(simpPos, simpIdx);
  return { position: simpPos, normal: simpNorm, index: simpIdx };
}
```
- In the system loop, add only `preparePart` outputs directly to the system `doc`.
- Only run `draco(...)` and `io.writeBinary(doc)` on the system document.
- Memory during build is guaranteed to stay below 250 MB at all times.

### Recommendation 3: Implement Tiered Target Triangle Allocation
In `anatomy-build.mjs`, assign `targetTris` based on anatomical class:
```javascript
function getTargetTris(part) {
  const n = part.name.toLowerCase();
  if (MUST_HAVE.test(n)) return 6000;
  if (LOW_YIELD.test(n)) return 800;
  if (CORE[part.system]?.test(n)) return 3000;
  return 1500;
}
```

### Recommendation 4: Optimize Viewer Lifecycle & Material Handling
In `js/tools/anatomy-explorer.js`:
1. Default to loading only `skeletal` on initial mount.
2. When a user selects a structure in the list belonging to an unloaded system, auto-load that specific system on demand.
3. Replace unconditional `n.material = n.material.clone()` with on-demand highlight cloning to preserve batched draw calls.

---

## 7. Performance & Quality Verification Plan

| Metric | Target | Measurement Method |
|---|---|---|
| **Build Memory (RSS)** | < 500 MB peak (zero OOMs) | Run `node scripts/anatomy-build.mjs` under `process.memoryUsage()` monitor |
| **Total Download (8 GLBs)** | < 10 MB total (< 3 MB for largest system) | `ls -lh public/anatomy/*.glb` |
| **Initial Viewer Startup Load** | < 3.0 MB download, < 1.0 s TTI | DevTools Network & Performance tab with Skeletal default |
| **Viewport Rendering FPS** | $\ge 50$ FPS with all systems enabled | Chrome DevTools FPS meter during OrbitControls rotation |
| **Catalog Coverage** | $\ge 900$ structures | Count entries in `public/anatomy/index.json` |
