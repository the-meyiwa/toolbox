# TEST_INFRA — 3D Anatomy Subsystem E2E Test Infrastructure

## 1. Overview & Architecture
This document specifies the end-to-end (E2E) testing infrastructure for the **3D Anatomy Pipeline and Interactive Viewer** subsystem of Toolbox.

The testing architecture is designed around opaque-box, requirement-driven verification covering:
1. **Offline Data Pipeline**: Uncapped BodyParts3D selection, system ontology classification, and catalog indexing.
2. **Build & Compression Pipeline**: Isolated STL pre-simplification, memory boundaries (<250 MB RSS), and Draco GLB packaging (<15 MB total).
3. **Interactive 3D Viewer & UI**: Pure vanilla `VirtualScroller` DOM element pooling, sub-5ms indexed search and regional queries, Three.js WebGL scene controls, raycasting performance, and theme/UI compliance.

---

## 2. Test Framework & Runner
- **Runner**: Node.js built-in test runner (`node --test`), native in Node.js v24+.
- **Assertions**: `node:assert/strict` (strict equality, deep assertions, exception handling).
- **DOM & WebGL Mocking**: `tests/helpers/dom-env.js` providing full mock DOM tree (`MockElement`, `MockDocument`), event dispatching (`Event`, `CustomEvent`, `MouseEvent`), `ResizeObserver`, `requestAnimationFrame`, and WebGL rendering context (`createMockWebGLContext`).
- **3D Engine**: Headless Three.js integration (`three`, `js/lib/viewer3d.js`).
- **Isolated Pipeline Stubs**: In-memory binary STL generators, geometry welders, and schema validators verifying contracts without side-effects.

---

## 3. Directory Layout
```
tests/e2e/anatomy-explorer/
├── helpers.js                 # Shared E2E fixtures, binary STL mocks, DOM setup, and assertions
├── tier1-features.test.js     # Tier 1: Feature Coverage (F1 to F7) — 35 test cases
├── tier2-boundaries.test.js   # Tier 2: Boundary & Corner Cases — 35 test cases
├── tier3-interactions.test.js # Tier 3: Cross-Feature Interactions — 7 test cases
└── tier4-scenarios.test.js    # Tier 4: Real-World Clinical/Educational Scenarios — 5 test cases
```

Total systematic test suite: **82 test cases** across all 4 tiers.

---

## 4. Four-Tier Test Coverage Matrix

### Tier 1: Feature Coverage (35 Test Cases — 5 per feature across 7 features)
- **F1: Uncapped Complete Dataset Extraction & Classification (>900 structures)**
  - Coverage across all 8 canonical systems (`skeletal`, `muscular`, `cardiovascular`, `nervous`, `digestive`, `respiratory`, `urinary`, `endocrine`).
  - Uncapped extraction contract preserving all valid structures without artificial `CAPS`.
  - Landmark structure preservation (atlas, axis, wrist carpal bones, facial expression muscles, cerebral gyri).
  - Whole-body oversized mesh filtering (`MAX_BYTES = 40 MB`).
  - Extracted schema contract (`id`, `name`, `system`, `fma`).
- **F2: Manifest Fallback & Zero ENOENT Crashes**
  - Fallback resolution when `.anatomy-src/available.json` is missing.
  - Manifest discovery yielding non-empty structure inventory with sizes and IDs.
  - Directory initialization creates output targets recursively without throwing ENOENT.
  - STL cache checking avoids redundant re-downloads for existing valid assets.
  - Resilient handling of malformed or empty manifest inputs.
- **F3: Index Catalog Metadata Integrity**
  - Root catalog schema validation (`version`, `systems`, `structures`).
  - System registry integrity (8 canonical systems, valid colors, order, structure counts).
  - FMA ID format verification (`/^FMA?\d+/`).
  - Structure ID uniqueness constraint (zero duplicate IDs).
  - System color visual contrast and range validation.
- **F4: Build Pipeline Memory Safety (<250 MB RSS) & Isolated Decimation**
  - Isolated per-mesh decimation keeps heap footprint well below 250 MB.
  - Binary STL parser validates 80-byte header, uint32 triangle count, and Float32 vertex buffers.
  - Parser rejects truncated/ASCII inputs with descriptive error.
  - Vertex welding merges coincident vertices within 0.05mm spatial key hash.
  - Vertex normal generator produces unit-normalized vectors.
- **F5: Total GLB File Size & Draco Compression (<15 MB total)**
  - Verification of 8 system GLBs in `public/anatomy/` with Draco mesh compression.
  - Combined GLB size strictly below 15 MB (<15,728,640 bytes).
  - Per-system GLB size bounds (major < 6MB, minor < 2MB).
  - Valid glTF 2.0 binary container header (`0x46546C67`, version 2).
  - Draco decoder assets (`draco_decoder.wasm` and `draco_decoder.js`) deployed and accessible.
- **F6: VirtualScroller DOM Element Pooling & Zero-DOM-Bloat Scroll**
  - Fixed pool allocation (~20 DOM elements) regardless of list item count.
  - Phantom spacer element height matches `totalCount * itemHeight` px.
  - Viewport `translateY` offset aligns with scroll position.
  - Continuous rapid scroll creates 0 net new DOM nodes (zero bloat).
  - Item data rebinding updates `data-id`, label, and system indicator correctly.
- **F7: Search & Region Query Performance (<5ms) & UI Theme/Pill Compliance**
  - Pre-indexed search query execution completes in < 5ms.
  - Pre-indexed anatomical region query completes in < 5ms.
  - Search supports direct substring, word stem, and clinical common name lookups.
  - Semantic CSS custom properties used for all UI components (`var(--bg)`, `var(--text)`, etc.).
  - Horizontal `.an-pill` selectors adhere to Toolbox UI guidelines without emojis.

### Tier 2: Boundary & Corner Cases (35 Test Cases — 5 per feature across 7 features)
- **F1 Boundary**: Empty parts inventory, exact `MAX_BYTES` boundary, `MAX_BYTES + 1` boundary, exotic punctuation/hyphenation, case-insensitive classification.
- **F2 Boundary**: Empty manifest array `[]`, fallback cascade, missing optional fields (`bytes`, `sha`), network retry failure exhaustion, zero-byte file detection and re-download.
- **F3 Boundary**: Boundary FMA IDs (`FMA1` vs `FMA999999`), non-numeric suffixes (`FMA14543nsn`), empty system metadata, 200+ character structure names, special Unicode characters in anatomical nomenclature.
- **F4 Boundary**: 1-triangle minimal binary STL, 0-triangle empty STL, degenerate triangles (zero area), sub-0.05mm vertex welding, super-0.05mm vertex preservation.
- **F5 Boundary**: Zero-byte GLB detection, corrupt magic number rejection, glTF v1 rejection, minimal 1-node GLB container, multi-hundred node GLB parsing.
- **F6 Boundary**: Scroll offset 0, scroll offset max, negative scroll offset (rubber-banding clamp), 0-item empty list, 1-item single list.
- **F7 Boundary**: Empty search query `""`, unmatched search query (`"xyznonexistent123"`), regex special characters in search, rapid region filter switching (10 rapid toggles), camera orbit minDistance (0.12) and maxDistance (8) clamps.

### Tier 3: Cross-Feature Interactions (7 Pairwise Test Cases)
1. **Search Filtering + VirtualScroller**: Typing query filters list, updates VirtualScroller item count, recalculates phantom height spacer, and resets scroll offset.
2. **System Checkbox Toggle + GLB Streaming + Count**: Toggling checkbox triggers GLB loading, updates system visibility, and syncs structure count in header.
3. **Structure Selection + 3D Model Highlight + Detail Panel**: Selecting structure from list highlights corresponding 3D mesh, displays HUD badge, and populates clinical details panel.
4. **Theme Toggle + Pill Filter Styling + Canvas Contrast**: Switching app theme updates semantic CSS variables and maintains contrast for `.an-pill` buttons and 3D canvas.
5. **Region Filter + Search Query Conjunction**: Applying both region filter and search query performs strict logical AND filtering.
6. **Uncapped Catalog Scale + Index Parsing Memory**: Parsing full catalog with hundreds of structures retains low heap overhead (<50 MB delta).
7. **Camera Orbit Drag + Raycast Suppression**: Camera rotation during structure list interaction suppresses expensive raycasting checks to guarantee frame rate.

### Tier 4: Real-World Application Scenarios (5 Scenarios)
1. **Medical Student Exploring Skeletal System**: Loads skeletal system, searches for "atlas" and "axis", identifies C1/C2 cervical vertebrae, verifies carpal bones ("scaphoid", "lunate") with clinical details and articulations.
2. **Surgeon Researching Facial Muscles with Rapid Search**: Searches for "orbicularis", "frontalis", "buccinator", verifies rapid search response (<5ms), checks innervation details (Facial nerve CN VII) and clinical notes.
3. **Neurologist Inspecting Cerebral Cortex Gyri and Brainstem**: Filters to nervous system / head region, inspects precentral gyrus, postcentral gyrus, pons, medulla oblongata, verifies FMA IDs and blood supply info.
4. **Full Body System Overview Toggling Multiple Systems**: Enables skeletal, muscular, and cardiovascular systems simultaneously, adjusts opacity to 50%, verifies multi-system visibility and display plane cross-section clipping.
5. **Mobile / Narrow-Viewport Responsiveness & Touch Scrolling**: Simulates 375x667 mobile viewport, verifies `.an-pill` horizontal scrolling, virtual list touch scrolling, and zero horizontal viewport blowout.

---

## 5. Execution Guide
To run the full E2E test suite:
```bash
node --test tests/e2e/anatomy-explorer/*.test.js
```

To run individual tiers:
```bash
node --test tests/e2e/anatomy-explorer/tier1-features.test.js
node --test tests/e2e/anatomy-explorer/tier2-boundaries.test.js
node --test tests/e2e/anatomy-explorer/tier3-interactions.test.js
node --test tests/e2e/anatomy-explorer/tier4-scenarios.test.js
```

---

## 6. Pass/Fail Gates
- **100% Pass Rate**: All 82 test cases across all 4 tiers must pass without unhandled rejections or assertions failing.
- **Timing Gate**: Pre-indexed search and region query tests must complete within 5ms.
- **Memory Gate**: Decimation and parsing tests must remain below 250 MB RSS.
- **Asset Size Gate**: Total size of all 8 system GLBs must remain strictly below 15 MB.
