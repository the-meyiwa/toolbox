# BRIEFING — 2026-09-24T22:03:30Z

## Mission
Formulate exact implementation plan for catalog generation in `scripts/anatomy-select.mjs`, producing `.anatomy-src/selected.json` and `public/anatomy/index.json` with full backward compatibility with `js/tools/anatomy-explorer.js`.

## 🔒 My Identity
- Archetype: explorer
- Roles: Index & Catalog Metadata Specialist
- Working directory: c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_m1_3
- Original parent: 77acb32f-85b8-4101-b948-e34dfbaa12ee
- Milestone: M1 (Data Pipeline & Catalog Selection)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Ensure structure of `index.json` maintains full backward compatibility with `js/tools/anatomy-explorer.js`:
  * version: 2
  * systems: map of system key -> { name, color, count }
  * structures: array of { id, name, system, fma }
- Verify deterministic sorting (alphabetical by name or id within system) and unique IDs
- Output files: `.anatomy-src/selected.json` and `public/anatomy/index.json`

## Current Parent
- Conversation ID: 77acb32f-85b8-4101-b948-e34dfbaa12ee
- Updated: 2026-09-24T22:00:00Z

## Investigation State
- **Explored paths**:
  - `ORIGINAL_REQUEST.md` and `PROJECT.md`
  - `explorer_survey_1/analysis.md`, `explorer_survey_2/analysis.md`, `explorer_survey_3/analysis.md`
  - `scripts/anatomy-select.mjs` and `scripts/anatomy-build.mjs`
  - `public/anatomy/index.json` (existing release)
  - `js/tools/anatomy-explorer.js`, `js/lib/anatomy-data.js`, `js/lib/assistant-result-renderer.js`
  - `tests/unit/assistant-anatomy.test.js`
- **Key findings**:
  - `js/tools/anatomy-explorer.js:46` executes `hex(c) => c.map(...)` on `s.color`. If `color` is a number rather than an array `[r, g, b]`, it throws `TypeError: c.map is not a function`, crashing viewer initialization.
  - Viewer explicitly accesses `meta.label`, `meta.file`, `meta.order`, and `meta.bytes`.
  - Reconciled Version 2 schema with existing viewer by providing dual properties (`name` + `label`, `color` as `[r, g, b]` + `colorInt`).
  - Standardized deterministic sorting using canonical system order (`1..8`), English locale-neutral `name` collation, and `id` tie-breaker.
  - Formulated automated integrity check for unique IDs and system counts.
- **Unexplored areas**: None for M1-3 scope.

## Key Decisions Made
- Catalog generation is placed directly in `scripts/anatomy-select.mjs` via `generateCatalogs()` function.
- `.anatomy-src/selected.json` output as `{ [systemKey]: SelectedStructureEntry[] }` per `PROJECT.md` interface contract.
- `public/anatomy/index.json` output conforming to Version 2 with dual-compatibility fields.

## Artifact Index
- DISPATCH.md — Dispatch instructions log
- BRIEFING.md — Situational awareness & memory
- progress.md — Liveness heartbeat (COMPLETED)
- analysis.md — Full technical analysis and implementation specification
- handoff.md — 5-component handoff report
