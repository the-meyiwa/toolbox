# Technical Analysis: Anatomy Data & Extraction Survey

**Author**: Explorer 1 (Anatomy Data & Extraction Specialist)  
**Date**: 2026-09-24  
**Scope**: Anatomy dataset extraction logic, workspace data availability, structure classification, CAPS constraints, and metadata generation for Toolbox Anatomy Explorer.

---

## 1. Executive Summary

This investigation surveys the complete data pipeline and runtime architecture for Toolbox's 3D Anatomy Explorer. Currently, the workspace ships a **517-structure curated subset** across 8 Draco-compressed GLB files (totaling 8.40 MB) derived from the **BodyParts3D** dataset.

The extraction pipeline (`scripts/anatomy-select.mjs`) limits the dataset via a hardcoded set of per-system caps (`CAPS`, summing to 600 items). Removing these caps immediately increases the processed structures to **780 parts** under current regex rules, and to **927 parts** (spanning ~1.18 GB of source STLs) when fixing significant omissions in the classification regexes.

### Core Discoveries:
1. **Workspace Data State**: No raw STL, OBJ, or ontology source files currently reside in the workspace. `.anatomy-src/` is listed in `.gitignore` and does not exist locally. Crucially, running `node scripts/anatomy-select.mjs` fails immediately because `.anatomy-src/available.json` is missing.
2. **Upstream Source Details**: The extraction script downloads from `Kevin-Mattheus-Moerman/BodyParts3D` (assets/BodyParts3D_data/stl). This repository contains exactly **934 binary STL files** (1,254.99 MB total uncompressed) derived from DBCLS BodyParts3D Release 3.0, all matching FMA concept identifiers in `parts_list_e.txt`.
3. **Impact of Removing CAPS**: The existing caps limit Skeletal to 175 (of 248) and Muscular to 175 (of 365). Removing the caps processes all classified parts without arbitrary truncations.
4. **Classification Defects (154 Dropped Parts)**: The classification regexes in `scripts/anatomy-select.mjs` fail to match 154 available structures. Dropped items include foundational anatomy: `atlas` (C1) and `axis` (C2) vertebrae, all 8 wrist carpal bones (`scaphoid`, `lunate`, `triquetral`, `pisiform`, `trapezium`, `trapezoid`, `capitate`, `hamate`), `scalenus` muscles, `teres major/minor`, all facial muscles (`frontalis`, `orbicularis oculi/oris`, `buccinator`), and all cerebral gyri (`superior/middle frontal`, `precentral`, `postcentral`, etc.).
5. **Metadata & Fallback Resilience**: `js/lib/anatomy-data.js` contains a dedicated `anatomyService` with an automatic fallback generator and keyword-based anatomical region classifier, ensuring that expanding to 900+ structures will not break clinical card rendering or regional filtering in the UI.

---

## 2. Workspace Data & Artifact Inventory

The workspace currently contains the following anatomy-related assets:

| Path | Type | Size / Count | Purpose / Description |
|---|---|---|---|
| `public/anatomy/` | Built GLB models | 8 files (8.40 MB total) | `skeletal.glb` (2.78 MB), `muscular.glb` (2.95 MB), `nervous.glb` (639 KB), `cardiovascular.glb` (942 KB), `respiratory.glb` (124 KB), `digestive.glb` (687 KB), `urinary.glb` (123 KB), `endocrine.glb` (151 KB) |
| `public/anatomy/index.json` | JSON Catalog | 46 KB (517 structures) | Master runtime index mapping structure IDs, names, system assignments, and FMA IDs |
| `public/anatomy/ATTRIBUTION.md` | Legal / Docs | 2.17 KB | Attribution notice for DBCLS BodyParts3D (CC BY-SA 2.1 Japan) and regeneration instructions |
| `public/draco/` | Binary / JS | 3 files (~310 KB) | WebAssembly Draco decoders (`draco_decoder.wasm`, `draco_decoder.js`, `draco_wasm_wrapper.js`) |
| `scripts/anatomy-select.mjs` | Node Script | 167 lines | Step 1: Filters `available.json`, classifies systems, enforces `CAPS`, downloads binary STLs |
| `scripts/anatomy-build.mjs` | Node Script | 287 lines | Step 2: Reads binary STLs, welds coincident vertices, smooths normals, transforms axes (Z-up to Y-up), simplifies via MeshoptSimplifier, compresses via Draco, writes GLBs |
| `js/lib/anatomy-data.js` | JS Library | 1,549 lines (84 KB) | Authoritative clinical database (`ANATOMY_DATABASE`), region definitions (`ANATOMICAL_REGIONS`), synonym mappings (`ANATOMICAL_SYNONYMS`), and query resolution engine |
| `js/lib/anatomy-notes.js` | JS Library | 148 lines | Curated clinical pearls for high-yield structures |
| `js/tools/anatomy-explorer.js` | UI Tool | 582 lines (27 KB) | Three.js interactive 3D atlas viewer with spatial raycasting and search/filtering |
| `tests/unit/assistant-anatomy.test.js` | Unit Tests | 210 lines | 8 test cases verifying Assistant query resolution and 3D result rendering (all passing) |
| `.anatomy-src/` | Local Directory | **MISSING** | Git-ignored directory (`.gitignore` line 4). Does not exist in the working repository. |

---

## 3. Dataset Origin & Upstream Architecture

### 3.1 Upstream Source
`scripts/anatomy-select.mjs` hardcodes:
```javascript
const RAW_BASE = 'https://raw.githubusercontent.com/Kevin-Mattheus-Moerman/BodyParts3D/main/assets/BodyParts3D_data/stl';
```
This repository is an open-source conversion of the DBCLS BodyParts3D Release 3.0 dataset from OBJ to binary STL format.

### 3.2 Upstream File Inventory (Queried via GitHub Trees API)
- **STL Directory (`assets/BodyParts3D_data/stl/`)**: Exactly **934 binary STL files**.
  - Total uncompressed size: **1,254.99 MB** (~1.25 GB).
  - Largest files: `FMA7163.stl` (Skin, 77.47 MB), `FMA13336.stl` (Right external oblique, 27.46 MB), `FMA13337.stl` (Left external oblique, 27.32 MB), `FMA46768.stl` (Aponeurosis of epicranius, 19.81 MB), `FMA22344.stl` / `FMA22345.stl` (Psoas major tendons, ~15.6 MB each).
  - Smallest files: Small vessel branches and ossicles (~6 KB to ~20 KB).
- **Lookup Catalog (`parts_list_e.txt`)**: 1,524 lines (1 header + 1,523 concepts) mapping IDs (`FMAxxxxx` or `BPxx`) to preferred English anatomical terms.
  - Cross-referencing verified that **all 934 STL files match 100%** with valid entries in `parts_list_e.txt`.
- **Ontology & Relational Files**:
  - `conventional_part_of.txt` (140 KB): Tab-delimited hierarchy defining "part-of" relationships between organs (e.g. `FMA24474 right femur` is part of `FMA24470 lower extremity skeleton`).
  - `composite_parts.txt` (738 KB): Defines composite organs composed of multiple atomic meshes.
  - `FMA.csv` (5.88 MB): Complete Foundational Model of Anatomy taxonomy table.

*(Note: The DBCLS official BodyParts3D Release 4.3 dataset at `lifesciencedb.jp/bp3d/` contains 3,210 verified OBJ meshes. However, the existing Toolbox pipeline is explicitly tailored to the 934 binary STL files from `Kevin-Mattheus-Moerman/BodyParts3D`)*.

---

## 4. Pipeline Logic & The `CAPS` Constraint

### 4.1 How `CAPS` Works
In `scripts/anatomy-select.mjs`:
```javascript
const CAPS = {
  skeletal: 175, muscular: 175, cardiovascular: 85, nervous: 60,
  digestive: 45, respiratory: 25, urinary: 15, endocrine: 20,
};
```
The sum of all caps is **600 structures**.

Selection logic (lines 114–120):
```javascript
const selected = [];
for (const system of Object.keys(CAPS)) {
  const pool = classified
    .filter(p => p.system === system)
    .sort((a, b) => rank(b) - rank(a) || a.size - b.size);
  selected.push(...pool.slice(0, CAPS[system]));
}
```
Within each system, structures are ranked:
- `MUST_HAVE` regex match: Score `200` (e.g. femur, diaphragm, aorta, liver, stomach, brain lobes)
- `CORE[system]` regex match: Score `100` (textbook exam structures)
- Default: Score `0`
- `LOW_YIELD` regex match: Score `-10` (individual teeth, individual phalanges, intrinsic foot/hand digits)
- Tie-break: File size ascending (`a.size - b.size`)

Because `pool.slice(0, CAPS[system])` truncates the array at `CAPS[system]`, any structure in the pool beyond the cap limit is permanently omitted from `selected.json` and therefore never downloaded or compiled.

---

## 5. Quantitative Analysis: Capped vs Uncapped

A test script was executed against the exact 934 upstream BodyParts3D STL models. Below are the quantitative findings:

| Organ System | Cap Limit | Selected (With Caps) | STL Size (With Caps) | Available (Uncapped, Existing Rules) | STL Size (Uncapped) | Available (Uncapped, Improved Rules) |
|---|---|---|---|---|---|---|
| **Skeletal** | 175 | 175 | 80.6 MB | 248 | 156.5 MB | **268** |
| **Muscular** | 175 | 175 | 435.8 MB | 365 | 763.5 MB | **428** |
| **Cardiovascular** | 85 | 60 | 35.3 MB | 60 | 35.3 MB | **60** |
| **Nervous** | 60 | 39 | 65.6 MB | 39 | 65.6 MB | **95** |
| **Digestive** | 45 | 43 | 21.0 MB | 43 | 21.0 MB | **46** |
| **Respiratory** | 25 | 7 | 15.9 MB | 7 | 15.9 MB | **7** |
| **Urinary** | 15 | 8 | 3.2 MB | 8 | 3.2 MB | **8** |
| **Endocrine** | 20 | 10 | 4.1 MB | 10 | 4.1 MB | **15** |
| **TOTAL** | **600** | **517** | **661.6 MB** | **780** | **1,065.2 MB** | **927** |

### Observations:
1. Under the current `CAPS`, only **Skeletal** (175 of 248) and **Muscular** (175 of 365) hit their ceilings. The other 6 systems have fewer matching items in the dataset than their assigned cap.
2. Removing `CAPS` using the existing classification rules unlocks **263 additional structures** (from 517 to 780), increasing raw source STL volume from 661.6 MB to 1,065.2 MB (+61%).
3. With improved classification rules that recover the 154 dropped items, **927 structures** are captured across all 8 systems.

---

## 6. Classification Rules & Critical Gaps

Structures are classified in `scripts/anatomy-select.mjs` using the ordered `RULES` array. The first matching pattern assigns the system:

```javascript
const RULES = [
  ['nervous', ...],
  ['muscular', ...],
  ['skeletal', ...],
  ['cardiovascular', ...],
  ['respiratory', ...],
  ['digestive', ...],
  ['urinary', ...],
  ['endocrine', ...],
];
```

### The 154 Dropped Structures:
Currently, 154 parts fail to match any regex and are completely excluded. Analysis revealed critical anatomical omissions:

#### A. Skeletal System Omissions (20 parts dropped)
- **Atlas & Axis**: `FMA12519 atlas` (C1) and `FMA12520 axis` (C2). The skeletal regex contains `vertebra`, but these atypical vertebrae are named simply `atlas` and `axis` in BodyParts3D!
- **Wrist Carpal Bones**: All 8 carpal bones for both hands are dropped (`scaphoid`, `lunate`, `triquetral`, `pisiform`, `trapezium`, `trapezoid`, `capitate`, `hamate`, IDs `FMA24435` through `FMA24449`). The regex matched `carpal` but not individual carpal bone names.
- **Nasal Concha**: `FMA54737 right inferior nasal concha` and `FMA54738 left inferior nasal concha`.

#### B. Muscular System Omissions (63 parts dropped)
- **Scalene Muscles**: `FMA13388` through `FMA13393` (`scalenus anterior/medius/posterior`). Regex had `scalene` (English), while the dataset uses Latin `scalenus`.
- **Rotator Muscles**: `FMA23083 thoracic rotator`, `FMA23089 lumbar rotator`, `FMA81752 cervical rotator`. Regex had `rotatores` (plural), missing singular `rotator`.
- **Shoulder / Trunk**: `right/left subclavius` (`FMA13411/12`), `right/left teres major/minor` (`FMA32551/54`), `right/left tensor fasciae latae` (`FMA22425/26`), `right/left palmaris longus` (`FMA38463/64`), `right/left puborectalis` (`FMA45856/57`), `right/left pyramidalis` (`FMA22346/47`).
- **Facial Expression Muscles**: All 16 facial muscles are omitted (`frontalis`, `orbicularis oculi`, `orbicularis oris`, `corrugator supercilii`, `levator labii superioris`, `depressor labii inferioris`, `levator anguli oris`, `depressor anguli oris`, `mentalis`, `buccinator`, `risorius`, `nasalis`, `depressor septi nasi`, `procerus`).

#### C. Nervous System Omissions (56 parts dropped)
- **Cerebral Cortex Gyri**: 24 gyri are completely omitted because the regex lacked `gyrus|gyri` (`superior frontal gyrus`, `middle frontal gyrus`, `precentral gyrus` [motor cortex], `postcentral gyrus` [sensory cortex], `supramarginal gyrus`, `angular gyrus`, `middle temporal gyrus`, `inferior temporal gyrus`, `fusiform gyrus`, `cingulate gyrus`, `straight gyrus`).
- **Deep Brain Nuclei & Pathways**: `internal capsule` (`FMA72908/09`), `insula` (`FMA72977/78`), `optic tract` (`FMA62382/67936`), `superior/inferior colliculi` (`FMA73422/35`), `lateral/medial geniculate bodies` (`FMA73303/10`), `habenula` (`FMA62032`), `septum pellucidum` (`FMA61844`), `anterior/posterior commissures` (`FMA61961/62072`).

#### D. Endocrine & Visceral Omissions (8 parts dropped)
- `deferent duct` (`FMA19235/36`), `corpus cavernosum` (`FMA19618`), `corpus spongiosum` (`FMA19617nsn`), `glans penis` (`FMA18247`).
- Large intestine taeniae: `mesocolic taenia`, `omental taenia`, `free taenia` (`FMA76891/93`).

#### E. Integumentary / Sensory (7 parts dropped)
- `FMA7163 skin` (77.47 MB, exceeds `MAX_BYTES = 40 MB` — intentionally skipped).
- Sensory/adnexa: `eyeball` (`FMA12513`), `ear` (`FMA52780`), `head hairs` (`FMA70751`), `eyebrows` (`FMA71098`).

---

## 7. Metadata Architecture & Knowledge Layer

### 7.1 Generated Index (`public/anatomy/index.json`)
The build script outputs `public/anatomy/index.json` with this schema:
```json
{
  "systems": {
    "skeletal": { "label": "Skeletal", "color": [0.918, 0.894, 0.827], "order": 1, "file": "skeletal.glb", "count": 175, "bytes": 2778364 },
    "muscular": { "label": "Muscular", "color": [0.698, 0.314, 0.29], "order": 2, "file": "muscular.glb", "count": 175, "bytes": 2945040 }
  },
  "structures": [
    { "id": "FMA24486", "name": "right patella", "system": "skeletal", "fma": "24486" }
  ],
  "attribution": { ... },
  "generated": "2026-08-19T02:15:08.552Z"
}
```
- The node names inside the `.glb` files match `part.id` (e.g. `FMA24486` or `BP24`).
- Raycaster picking in `anatomy-explorer.js` uses `mesh.name` to look up the entry in `index.structures` by ID.

### 7.2 Anatomical Knowledge Layer (`js/lib/anatomy-data.js`)
`ANATOMY_DATABASE` contains curated dictionary entries for ~100 primary structures. When a structure is queried:
1. Direct dictionary match returns detailed Latin name, common name, region, function description, clinical pearls, blood supply, innervation, and relations.
2. If absent from `ANATOMY_DATABASE`, `AnatomyService.prototype.getDetail(name, system)` activates an **automatic fallback generator**:
   - Incurs zero errors or undefined crashes.
   - Inferentially tags regional taxonomy (`head-neck`, `thorax`, `abdomen`, `pelvis`, `upper-limb`, `lower-limb`) based on anatomical keywords in the name.
   - Generates standardized clinical and physiological descriptive copy.
3. Natural language query resolution (`resolveAnatomyQuery`) leverages `stemWord` and `ANATOMICAL_SYNONYMS` (e.g. mapping "collarbone" -> "clavicle", "thigh bone" -> "femur", "quads" -> 4 individual vastus/rectus femoris muscles).

---

## 8. Build Performance & Scalability Concerns

### 8.1 GLB File Size Projections
Currently, 517 structures compress to **8.40 MB** across 8 GLBs:
- `skeletal.glb`: 175 parts -> 2.78 MB (averaging 15.8 KB/part).
- `muscular.glb`: 175 parts -> 2.95 MB (averaging 16.8 KB/part).

If uncapped to 927 structures with the same simplification settings (`TARGET_TRIS = 6000`, `MIN_RATIO = 0.06`, Draco `quantizePosition: 13, quantizeNormal: 8`):
- `skeletal.glb` (268 parts): Projected **~4.2 MB**.
- `muscular.glb` (428 parts): Projected **~6.8 MB**.
- `nervous.glb` (95 parts): Projected **~1.5 MB**.
- All 8 systems combined: Projected **~15.5 to 17.5 MB**.
*(Because systems are lazy-loaded only when toggled on, the initial page load does not transfer these GLBs until the user activates a system)*.

### 8.2 Memory & Build Pipeline Stability
- In `scripts/anatomy-build.mjs`:
  - Iterates over each body system sequentially, instantiating one glTF `Document()` per system.
  - Muscular system will process 428 binary STL files (~763 MB uncompressed).
  - Each STL is parsed into raw `Float32Array` positions, indexed, vertex-welded, and converted to glTF accessors in memory.
  - Meshopt simplification (`simplify`) and Draco compression (`draco`) for 428 meshes simultaneously in one document may challenge the default Node.js heap limit (2 GB).
  - *Recommendation for Build Track*: Monitor memory or chunk large systems (e.g. `muscular-torso.glb`, `muscular-limbs.glb` or progressive batching), or pass `--max-old-space-size=4096` during build.

### 8.3 Browser UI Rendering Bottlenecks
In `js/tools/anatomy-explorer.js`:
- Line 353: `.slice(0, 300)` is hardcoded to prevent DOM overload.
- Lines 362–368: Generates DOM elements via string interpolation and replaces `listEl.innerHTML` on every keystroke.
- With 927 structures (or thousands if hierarchical concepts are added), searching and rendering without virtualization will freeze the browser main thread.
- *Recommendation for UI Track*: Implement a virtualized list container (or document fragment recycling) and debounce text input to 150ms.

---

## 9. Data Integrity & Missing Workspace Files

### 9.1 The Missing `available.json` Bug
Running `node scripts/anatomy-select.mjs` immediately crashes:
```
Error: ENOENT: no such file or directory, open '.anatomy-src/available.json'
```
**Cause**: `.anatomy-src/` is in `.gitignore`, so `available.json` was never checked into version control.
**Solution**:
1. Commit a reference manifest (e.g. `scripts/data/bodyparts3d-available.json` or `scripts/anatomy-manifest.json`) containing the 934 parts with their IDs, names, and sizes.
2. Update `scripts/anatomy-select.mjs` to read from this committed manifest, or auto-fetch the list from the GitHub API if `.anatomy-src/available.json` does not exist.

### 9.2 Network Download Considerations
- Downloading 927 STL files from GitHub raw URL involves fetching **~1.18 GB**.
- `anatomy-select.mjs` has a concurrency pool of 6 with 3 retries and skips existing files if size matches. This caching mechanism is robust for incremental runs.
- However, for fresh checkouts, a script running in environments with network restrictions or GitHub raw timeouts needs clear error handling and progress reporting.

---

## 10. Summary of Architectural Recommendations

1. **Fix Extraction Pipeline Manifest**:
   - Provide `scripts/data/bodyparts3d-available.json` containing the authoritative list of 934 parts.
   - Update `scripts/anatomy-select.mjs` to automatically fall back to this manifest when running in a clean workspace.

2. **Expand Classification Regexes**:
   - Remove `CAPS` (or set them to infinity) in `scripts/anatomy-select.mjs`.
   - Update `RULES` in `scripts/anatomy-select.mjs` with the missing anatomical patterns (add `atlas`, `axis`, carpal bones, `scalenus`, facial muscles, `gyrus`/`gyri`, etc.) to classify 927 of the 934 parts.

3. **Coordinate with Pipeline Optimizer (Explorer 2)**:
   - Provide Explorer 2 with the exact breakdown of the 927 meshes (muscular: 428, skeletal: 268, nervous: 95) so they can test Draco compression ratios, triangle simplification budgets, and heap allocation strategies.

4. **Coordinate with UI Specialist (Explorer 3)**:
   - Provide Explorer 3 with the revised structure count (927 items) to guide the implementation of structure list virtualization and search optimizations in `js/tools/anatomy-explorer.js`.
