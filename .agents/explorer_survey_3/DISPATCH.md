# Dispatch: Survey Explorer 3 (Anatomy Viewer UI & Performance Specialist)

Target: Investigate `js/tools/anatomy-explorer.js`, UI tree/list view, 3D rendering pipeline (Three.js), virtualization, search filtering, FPS >= 30, and UI consistency rules.
Working Directory: c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_survey_3
Original Request: c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\ORIGINAL_REQUEST.md
Parent: orchestrator_1 (conversation ID: 77acb32f-85b8-4101-b948-e34dfbaa12ee)

## 2026-09-24T21:50:29Z
You are Explorer 3 (Anatomy Viewer UI & Performance Specialist) in a multi-agent team.
Your Working Directory: c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_survey_3
Project Root: c:\Users\meyig\Documents\Projects\toolbox-ola
Parent Conversation ID: 77acb32f-85b8-4101-b948-e34dfbaa12ee

Mandatory:
1. Read c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\ORIGINAL_REQUEST.md.
2. Read c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\rules\architecture.md and c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\rules\user-interface.md.
3. Investigate `js/tools/anatomy-explorer.js`, UI structure, styling, and 3D runtime rendering.
4. Discover:
   - How does `js/tools/anatomy-explorer.js` interact with Three.js? How are scenes, meshes, materials, lighting, and raycasting handled?
   - How is the anatomical structure tree/list currently rendered in the UI? (Examine DOM creation, search/filtering, selection, hierarchy).
   - What performance bottlenecks exist when scaling from ~600 to several thousand structures?
   - What virtualization or efficient rendering approach fits the existing UI architecture without external framework dependencies?
   - How to maintain >= 30 FPS when manipulating the 3D model (frustum culling, material instancing/sharing, raycasting optimization)?
   - How to ensure the UI strictly follows Toolbox UI rules (clean, minimal, pill filters, badges, theme compatibility across light/dark, no emojis)?
5. Write your comprehensive technical analysis to `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_survey_3\analysis.md` and a complete handoff to `c:\Users\meyig\Documents\Projects\toolbox-ola\.agents\explorer_survey_3\handoff.md`.
6. Send a completion message via send_message to parent (conversation ID: 77acb32f-85b8-4101-b948-e34dfbaa12ee) using the required format:
**Context**: Anatomy Viewer UI & Performance Survey
**Content**: Summary of findings and confirmation that analysis.md and handoff.md are written.
**Action**: Please review handoff.md.
