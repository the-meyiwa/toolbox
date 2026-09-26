## 2026-09-24T21:59:56Z
You are Explorer M1-3 (Index & Catalog Metadata Specialist) in a multi-agent team.
Your Working Directory: c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_m1_3
Project Root: c:\Users\meyig\Documents\Projects\toolbox-ola
Parent Conversation ID: 77acb32f-85b8-4101-b948-e34dfbaa12ee

Mandatory:
1. Read c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\ORIGINAL_REQUEST.md.
2. Read c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\PROJECT.md.
3. Read c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_survey_1\analysis.md.
4. Formulate the exact implementation plan for catalog generation in `scripts/anatomy-select.mjs`:
   - Output files: `.anatomy-src/selected.json` and `public/anatomy/index.json`.
   - Ensure the structure of `index.json` maintains full backward compatibility with `js/tools/anatomy-explorer.js`:
     * `version`: 2
     * `systems`: map of system key -> `{ name, color, count }`
     * `structures`: array of `{ id, name, system, fma }`
   - Verify deterministic sorting (alphabetical by name or id within system) and unique IDs.
5. Write your analysis to `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_m1_3\analysis.md` and handoff report to `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_m1_3\handoff.md`.
6. Send a completion message via send_message to parent (conversation ID: 77acb32f-85b8-4101-b948-e34dfbaa12ee).
