# Dispatch: Explorer M1-2 (Classification & Ontology Specialist)

Milestone: M1 - Dataset Extraction & Manifest
Working Directory: c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_m1_2
Original Request: c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\ORIGINAL_REQUEST.md
Project Document: c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\PROJECT.md
Parent: orchestrator_1 (conversation ID: 77acb32f-85b8-4101-b948-e34dfbaa12ee)

Focus:
- Determine exact expanded regex rules for `RULES` in `scripts/anatomy-select.mjs` to classify all ~927 structures into the 8 systems without false positives.
- Specifically address all previously dropped structures:
  - Skeletal: atlas, axis, all 8 wrist carpal bones, nasal concha, etc.
  - Muscular: scalenus, teres, tensor fasciae latae, palmaris longus, facial expression muscles (frontalis, orbicularis, buccinator, etc.).
  - Nervous: 24 cerebral gyri, internal capsule, insula, optic tract, colliculi, etc.
- Verify exclusion of oversized non-organ meshes (e.g. skin >40MB) and non-standard adnexa.
- Formulate concrete recommendations for the Worker.
- Write analysis.md and handoff.md, then send_message to parent.

## 2026-09-24T21:59:56Z
You are Explorer M1-2 (Classification & Regex Rules Specialist) in a multi-agent team.
Your Working Directory: c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_m1_2
Project Root: c:\Users\meyig\Documents\Projects\toolbox-ola
Parent Conversation ID: 77acb32f-85b8-4101-b948-e34dfbaa12ee

Mandatory:
1. Read c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\ORIGINAL_REQUEST.md.
2. Read c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\PROJECT.md.
3. Read c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_survey_1\analysis.md.
4. Formulate the exact implementation specification for `RULES` and removal of `CAPS` in `scripts/anatomy-select.mjs`:
   - Specify the exact regex additions for each of the 8 systems:
     * Skeletal: atlas, axis, all 8 wrist carpal bones (scaphoid, lunate, triquetral, pisiform, trapezium, trapezoid, capitate, hamate), concha, etc.
     * Muscular: scalenus, teres, tensor fasciae latae, palmaris longus, 16+ facial expression muscles (frontalis, orbicularis, buccinator, risorius, etc.), rotators.
     * Nervous: 24 cerebral gyri, internal capsule, insula, optic tract, colliculi, geniculate bodies, etc.
     * Cardiovascular, Digestive, Endocrine, Urinary, Respiratory refinements.
   - Remove `CAPS` mapping so all matched structures are retained.
   - Ensure excluded items (skin >40MB, non-organ items) are cleanly handled.
5. Write your analysis to `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_m1_2\analysis.md` and handoff report to `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_m1_2\handoff.md`.
6. Send a completion message via send_message to parent (conversation ID: 77acb32f-85b8-4101-b948-e34dfbaa12ee).
