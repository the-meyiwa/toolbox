# Dispatch: E2E Test Writer

Target: Design and implement the complete, requirement-driven, opaque-box E2E test suite for the 3D Anatomy subsystem according to Project Pattern specifications.
Working Directory: c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\test_writer_e2e
Original Request: c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\ORIGINAL_REQUEST.md
Project Document: c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\PROJECT.md
Parent: orchestrator_1 (conversation ID: 77acb32f-85b8-4101-b948-e34dfbaa12ee)

Requirements:
- Create TEST_INFRA.md following the template in Project Pattern.
- Implement test suite in `tests/e2e/anatomy-explorer/` using Node's built-in test runner (`node --test`).
- Systematic 4-tier coverage (at least 82 test cases total):
  - Tier 1: Feature Coverage (>= 5 per feature across all 7 features = >= 35 test cases)
  - Tier 2: Boundary & Corner Cases (>= 5 per feature across all 7 features = >= 35 test cases)
  - Tier 3: Cross-Feature Interactions (>= 7 pairwise test cases)
  - Tier 4: Real-World Application Scenarios (>= 5 application scenarios)
- Opaque-box: Test user requirements and interfaces (CLI, index format, data schema, viewer API/events), NOT internal module internals.
- Publish `TEST_READY.md` when the test suite is ready.

## 2026-09-24T22:00:00Z
You are the E2E Test Writer (test_writer_e2e) in a multi-agent team.
Your Working Directory: c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\test_writer_e2e
Project Root: c:\Users\meyig\Documents\Projects\toolbox-ola
Parent Conversation ID: 77acb32f-85b8-4101-b948-e34dfbaa12ee

Mandatory:
1. Read c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\ORIGINAL_REQUEST.md.
2. Read c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\PROJECT.md.
3. Design and implement a comprehensive, requirement-driven, opaque-box E2E test suite in `tests/e2e/anatomy-explorer/` using Node.js built-in test runner (`node --test`).
4. Requirements:
   - Create `TEST_INFRA.md` at `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\TEST_INFRA.md` following the template in Project Pattern.
   - Systematic 4-tier coverage (at least 82 test cases across 7 features):
     * Tier 1: Feature Coverage (>= 5 per feature = >= 35 test cases) covering:
       - F1: Uncapped complete dataset extraction & classification (>900 structures)
       - F2: Manifest fallback & zero ENOENT crashes
       - F3: Index catalog metadata integrity (FMA IDs, systems, colors)
       - F4: Build pipeline memory safety (<250 MB RSS) & isolated decimation
       - F5: Total GLB file size & Draco compression (<15 MB total)
       - F6: VirtualScroller DOM element pooling & zero-DOM-bloat scroll
       - F7: Search & region query performance (<5ms) & UI theme/pill compliance
     * Tier 2: Boundary & Corner Cases (>= 5 per feature = >= 35 test cases):
       - Empty search query, unmatched search query, special characters, rapid filter switching, zero-scroll position, max-scroll position, extreme zoom, missing GLB graceful error handling, boundary FMA numbers.
     * Tier 3: Cross-Feature Interactions (>= 7 pairwise test cases):
       - Search filtering + VirtualScroller interaction
       - System checkbox toggle + GLB streaming + structure count update
       - Structure selection from virtual list + 3D model highlight + detail panel update
       - Theme toggle + pill filter styling + canvas contrast
       - Region filter + search query combined filter
       - Uncapped catalog size + index parsing memory footprint
       - Model rotation during structure list scrolling
     * Tier 4: Real-World Application Scenarios (>= 5 scenarios):
       - Medical student exploring skeletal system (atlas/axis/carpal bones identification)
       - Surgeon researching facial muscles with rapid search
       - Neurologist inspecting cerebral cortex gyri and brainstem
       - Full body system overview toggling multiple systems
       - Mobile/narrow-viewport responsiveness and touch scrolling
5. Run the test suite and verify execution:
   `node --test tests/e2e/anatomy-explorer/*.test.js`
6. Publish `TEST_READY.md` at `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\TEST_READY.md` (and `c:\Users\meyig\Documents\Projects\toolbox-ola\TEST_READY.md`).
7. Write `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\test_writer_e2e\handoff.md` and send_message to parent (conversation ID: 77acb32f-85b8-4101-b948-e34dfbaa12ee) when complete.
