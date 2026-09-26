# Project: 3D Anatomy Pipeline and Viewer Overhaul

## Architecture
The 3D Anatomy subsystem consists of an offline data processing pipeline (`scripts/`) and a client-side WebGL interactive viewer (`js/tools/`, `js/lib/`):
1. **Data Selection (`scripts/anatomy-select.mjs`)**:
   - Discovers all upstream BodyParts3D parts from `scripts/data/bodyparts3d-available.json` (authoritative manifest of 934 STLs).
   - Classifies parts into 8 anatomical systems (`skeletal`, `muscular`, `cardiovascular`, `nervous`, `digestive`, `respiratory`, `urinary`, `endocrine`) using comprehensive regex ontology rules without artificial `CAPS`.
   - Generates the catalog manifest (`public/anatomy/index.json`) mapping structure IDs, English names, systems, and FMA IDs.
2. **Build & Compression Pipeline (`scripts/anatomy-build.mjs`)**:
   - Loads binary STLs with an isolated per-mesh pre-simplification architecture using `MeshoptSimplifier`.
   - Applies adaptive triangle budgets per structure type (major: 4k-6k, medium: 1.5k-2.5k, small: 400-800).
   - Quantizes and compresses combined meshes using Draco (`KHR_draco_mesh_compression`), keeping system GLB files under strict size limits (<15 MB total across all 8 systems) and build RSS < 250 MB.
3. **Interactive 3D Viewer (`js/tools/anatomy-explorer.js`, `js/lib/viewer3d.js`)**:
   - Employs a zero-dependency vanilla JS `VirtualScroller` with a fixed pool of ~20 DOM items and a phantom height spacer, replacing the `.slice(0, 300)` truncate.
   - Pre-indexes search tokens (`_searchText`, `_region`) for sub-5ms query response over thousands of items.
   - 3D scene optimizations: suppresses raycasting during camera rotation, checks candidate meshes via cached AABB bounding boxes before triangle testing, uses 8 shared system materials to batch draw calls, and disables unused shadow maps.
   - Initial load defaults to the Skeletal system, progressively streaming other systems on-demand.
   - UI styling matches Toolbox standards: horizontal `.an-pill` selectors, semantic CSS tokens, full light/dark theme contrast, zero emojis.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Complete Dataset Selection | Remove `CAPS` and classify ~927 BodyParts3D structures into 8 systems via expanded regex | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Authoritative Parts Manifest | Commit `scripts/data/bodyparts3d-available.json` so build never fails with ENOENT | M1 | Survey Explorer 1 |
| 3 | Catalog Metadata Generation | Generate complete `public/anatomy/index.json` with FMA IDs, names, and systems | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Isolated Pre-Simplification | Decimate meshes individually before combining, keeping build RSS < 250 MB | M2 | ORIGINAL_REQUEST §R2 |
| 5 | Adaptive Triangle Budgeting | Allocate triangle targets proportionally (major: 4k-6k, medium: 1.5k-2.5k, small: 400-800) | M2 | Survey Explorer 2 |
| 6 | Draco Packaging & Size Cap | Encode all 8 system GLBs with Draco compression keeping total download < 15 MB | M2 | ORIGINAL_REQUEST §R2 |
| 7 | Pure Vanilla VirtualScroller | Replace `.slice(0, 300)` with ~20 DOM button pool and phantom height spacer | M3 | ORIGINAL_REQUEST §R3 |
| 8 | Sub-5ms Search & Region Filter | Pre-index normalized search tokens and anatomical regions on catalog load | M3 | ORIGINAL_REQUEST §R3 |
| 9 | Orbit Drag Raycast Suppression | Skip raycast calculations during OrbitControls camera rotation to guarantee >= 30 FPS | M3 | ORIGINAL_REQUEST §AC |
| 10 | Two-Phase AABB Broadphase | Filter raycast candidates against cached Box3 bounds before triangle intersection | M3 | Survey Explorer 3 |
| 11 | Shared System Materials | Use 8 canonical materials instead of cloning per mesh, minimizing WebGL draw calls | M3 | Survey Explorer 3 |
| 12 | Progressive On-Demand Loading | Default startup to Skeletal system, loading additional systems only when selected | M3 | ORIGINAL_REQUEST §AC |
| 13 | UI Pill Filter & Theme Tokens | Replace `<select>` with `.an-pill` buttons and semantic CSS variables | M4 | .agents/rules/user-interface.md |
| 14 | Responsive Layout & Zero Emojis | Strict adherence to clean minimal UI on mobile/desktop without emojis | M4 | .agents/rules/user-interface.md |
| 15 | E2E Test Suite Validation | 100% pass of 4-tier E2E tests (Tiers 1-4) | M5 | Project Pattern §Final Milestone |
| 16 | Adversarial Hardening | Tier 5 white-box stress testing and edge-case validation | M5 | Project Pattern §Final Milestone |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Dataset Extraction & Manifest | `scripts/anatomy-select.mjs`, `scripts/data/bodyparts3d-available.json`, uncapped classification of 920+ structures | none | PLANNED |
| M2 | Build Pipeline & Memory Optimization | `scripts/anatomy-build.mjs`, isolated pre-simplification, adaptive triangle budgets, Draco compression, RSS < 250 MB | M1 | PLANNED |
| M3 | Viewer UI Performance & Virtualization | `js/tools/anatomy-explorer.js`, `js/lib/viewer3d.js`, VirtualScroller, token indexing, raycast suppression, shared materials | M1, M2 | PLANNED |
| M4 | UI Standards & Coherence Polish | `js/tools/anatomy-explorer.js`, `css/legacy.css`, pill filters, semantic theme tokens, mobile responsiveness | M3 | PLANNED |
| M5 | Final Milestone: E2E Verification & Hardening | Opaque-box E2E test suite execution (Tiers 1-4) + Tier 5 adversarial hardening | M1, M2, M3, M4, TEST_READY | PLANNED |

## Interface Contracts
### Data Extraction ↔ Build Pipeline (`M1` ↔ `M2`)
- Input manifest: `scripts/data/bodyparts3d-available.json` format:
  ```json
  [ { "id": "FMA12519", "name": "atlas", "bytes": 123456, "sha": "..." } ]
  ```
- Output of `anatomy-select.mjs`: `.anatomy-src/selected.json` mapping:
  ```json
  {
    "skeletal": [ { "id": "FMA12519", "name": "atlas", "system": "skeletal", "fma": "12519", "file": "FMA12519.stl" } ],
    ...
  }
  ```
- Output catalog: `public/anatomy/index.json`:
  ```json
  {
    "version": 2,
    "systems": { "skeletal": { "name": "Skeletal", "color": 15064530, "count": 268 }, ... },
    "structures": [ { "id": "FMA12519", "name": "atlas", "system": "skeletal", "fma": "12519" } ]
  }
  ```

### Build Pipeline ↔ Viewer Runtime (`M2` ↔ `M3`)
- Output 3D assets: `public/anatomy/{system}.glb`
  - glTF 2.0 Binary container with `KHR_draco_mesh_compression`.
  - Node names correspond exactly to structure `id` (e.g. `FMA12519`).
  - Unit scale: meters (Y-up).
- Client loading contract:
  - Viewer calls `fetch('public/anatomy/index.json')` on initialization.
  - Viewer loads `public/anatomy/skeletal.glb` on startup.
  - Subsequent systems fetched on checkbox toggle or structure selection.

### Viewer Component ↔ UI Environment (`M3`, `M4` ↔ Toolbox)
- Pill filter event contract:
  - Clicking `.an-pill[data-region]` filters the virtualized list to the selected anatomical region.
- VirtualScroller contract:
  - Container element with `overflow-y: auto`.
  - Phantom spacer element with `height: N * itemHeight px`.
  - Content container with `transform: translateY(startIndex * itemHeight px)`.
  - Pool of `visibleCount = Math.ceil(containerHeight / itemHeight) + 2` item elements.

## Code Layout
- `scripts/data/bodyparts3d-available.json` — Authoritative upstream parts manifest
- `scripts/anatomy-select.mjs` — Dataset discovery, classification rules, and catalog indexing
- `scripts/anatomy-build.mjs` — 3D asset conversion, isolated pre-simplification, and Draco packaging
- `js/tools/anatomy-explorer.js` — Viewer UI component, virtualized structure list, search, and interactions
- `js/lib/viewer3d.js` — Three.js WebGL viewport, raycasting, camera controls, materials, and lighting
- `js/lib/anatomy-data.js` — Anatomical clinical details and region classification ontology
- `tests/e2e/anatomy-explorer/` — Requirement-driven E2E test suite (Tiers 1-4)
