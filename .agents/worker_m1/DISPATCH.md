## 2026-09-24T22:09:49Z

You are Worker M1 (teamwork_preview_worker) implementing Milestone M1: Dataset Extraction & Manifest.
Working Directory: c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\worker_m1
Project Root: c:\Users\meyig\Documents\Projects\toolbox-ola
Parent Conversation ID: 77acb32f-85b8-4101-b948-e34dfbaa12ee

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Exclusive Write Ownership:
- `scripts/data/bodyparts3d-available.json`
- `scripts/anatomy-select.mjs`
- `public/anatomy/index.json`
- `.anatomy-src/selected.json`

Read Before Starting:
1. `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\ORIGINAL_REQUEST.md`
2. `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\PROJECT.md`
3. `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\rules\architecture.md`
4. `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\rules\user-interface.md`
5. Explorer Handoffs:
   - `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_m1_1\handoff.md` and `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_m1_1\proposed_bodyparts3d-available.json`
   - `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_m1_2\handoff.md`
   - `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_m1_3\handoff.md`

Tasks:
1. Manifest:
   - Create `scripts/data/` if it does not exist.
   - Copy `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_m1_1\proposed_bodyparts3d-available.json` to `scripts/data/bodyparts3d-available.json`.
2. Update `scripts/anatomy-select.mjs`:
   - Implement the 3-tier discovery fallback:
     * Check `.anatomy-src/available.json`
     * Fall back to `scripts/data/bodyparts3d-available.json`
     * Fall back to dynamic fetch from GitHub if neither exists.
   - Update `RULES` with the expanded regex patterns from Explorer M1-2 covering all 154 previously dropped structures (capturing 927 structures across all 8 systems).
   - Support both `FMA\d+` and `BP\d+` structure IDs.
   - Remove `CAPS` (R1) and rank-based pruning so all matched structures are preserved.
   - Update the output schema to Version 2 from Explorer M1-3 with dual color `color: [r, g, b]` AND `colorInt`, label, order, file, bytes, and count, ensuring zero runtime errors in frontend.
   - Ensure deterministic sorting (canonical system order -> English name -> ID tiebreaker).
   - Write output to `.anatomy-src/selected.json` and `public/anatomy/index.json`.
3. Execution & Verification:
   - Run `node scripts/anatomy-select.mjs` and verify it runs cleanly, outputs 927 structures, and creates `public/anatomy/index.json`.
   - Run unit tests: `node --test tests/unit/assistant-anatomy.test.js`
   - Run E2E tests: `node --test tests/e2e/anatomy-explorer/*.test.js`
   - Ensure all tests pass.
4. Output:
   - Write comprehensive report to `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\worker_m1\handoff.md`.
   - Send completion message to parent via send_message (conversation ID: 77acb32f-85b8-4101-b948-e34dfbaa12ee).
