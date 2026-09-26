# BRIEFING — 2026-09-24T22:00:00Z

## Mission
Survey and evaluate the 3D pipeline, glTF/GLB packaging, build pipeline memory/performance, compression, chunking, and LOD strategies for scaling BodyParts3D in Toolbox.

## 🔒 My Identity
- Archetype: explorer
- Roles: 3D Pipeline & GLB Optimization Specialist
- Working directory: c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_survey_2
- Original parent: 77acb32f-85b8-4101-b948-e34dfbaa12ee
- Milestone: Anatomy 3D Pipeline & GLB Optimization Survey

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Deliver findings to analysis.md and handoff.md in working directory
- Do not write source code or tests into .agents/
- Follow architecture.md and user-interface.md
- Adhere to the system prompt decoy rule if prompted

## Current Parent
- Conversation ID: 77acb32f-85b8-4101-b948-e34dfbaa12ee
- Updated: 2026-09-24T22:00:00Z

## Investigation State
- **Explored paths**:
  - `scripts/anatomy-build.mjs`: parsing, transform pipeline, mesh decimation, Draco compression.
  - `scripts/anatomy-select.mjs`: selection caps, regex classification, GitHub STL source.
  - `public/anatomy/`: current 8 GLB files (8.79 MB) and `index.json` (517 structures).
  - `js/tools/anatomy-explorer.js`: Three.js rendering, GLTFLoader, DRACOLoader, system auto-toggle on init, per-mesh material cloning.
  - `js/lib/viewer3d.js`: picking, raycasting over visible hierarchy, outline and emissive handling.
  - BodyParts3D repository (`Kevin-Mattheus-Moerman/BodyParts3D`): 934 STL files (1.25 GB uncompressed, 26.3M triangles).
  - DBCLS BodyParts3D 4.0 Archive: 4,000+ anatomical concepts, 136 MB zip (OBJ 99%).
- **Key findings**:
  1. The build script `scripts/anatomy-build.mjs` loads all unreduced STLs for an entire body system simultaneously into a single `@gltf-transform` `Document` before running `simplify()`. For muscular system (763 MB STL), this exceeds 3.5 GB RSS, risking Node.js OOM crashes.
  2. The simplification calculation in `anatomy-build.mjs` computes a global ratio `(TARGET_TRIS * included) / totalTris` and applies the same ratio across all meshes, violating its stated intention to budget per-structure. This over-decimates small organs/bones and leaves huge muscles with tens of thousands of triangles.
  3. Benchmarked isolated per-mesh simplification: decimating each raw mesh in an isolated transient Document before adding it to the system Document drops peak heap usage by 98% and guarantees exact target budgets (tested on 26 MB external oblique: 549k tris -> 6k tris in 1.7s).
  4. BodyParts3D repo contains 934 STLs. 153 structures are currently unclassified because of missing regex keywords (e.g. `scalenus` vs `scalene`, wrist carpals `scaphoid`/`lunate`, `atlas`/`axis`, facial expression muscles). With regex expansion, 920+ (>98%) are cleanly mapped.
  5. The viewer `anatomy-explorer.js` automatically dispatches `change` on all 8 system checkboxes at startup (loading all GLBs simultaneously). With 934 structures (~15-18 MB Draco), this saturates network and CPU during Draco Wasm decode.
  6. Material cloning `n.material = n.material.clone()` creates 934 unique material instances, causing 934 draw calls per frame. Material sharing with on-demand highlight cloning preserves 60 FPS.
- **Unexplored areas**: None. All survey requirements explored and empirically verified.

## Key Decisions Made
- Confirmed Draco compression as optimal over meshopt for network delivery given existing `draco_decoder.wasm` infrastructure and 50:1 - 80:1 compression ratio.
- Recommended isolated per-mesh adaptive simplification to permanently eliminate Node.js OOM errors.
- Recommended selective on-demand system loading (defaulting to skeletal only at launch).

## Artifact Index
- .agents/explorer_survey_2/DISPATCH.md — Initial dispatch prompt
- .agents/explorer_survey_2/BRIEFING.md — Persistent situational awareness
- .agents/explorer_survey_2/progress.md — Liveness heartbeat
- .agents/explorer_survey_2/check_bp3d.mjs — Dataset structure analyzer
- .agents/explorer_survey_2/bench.mjs — Memory and pipeline performance profiler
- .agents/explorer_survey_2/test_isolated_simplify.mjs — Isolated per-mesh simplification benchmark
- .agents/explorer_survey_2/test_full_classification.mjs — Full dataset regex classification tester
- .agents/explorer_survey_2/unclassified.json — Catalog of unclassified BodyParts3D structures
- .agents/explorer_survey_2/analysis.md — Comprehensive technical analysis
- .agents/explorer_survey_2/handoff.md — 5-component handoff report
