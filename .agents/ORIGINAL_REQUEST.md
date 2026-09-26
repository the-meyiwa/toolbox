# Original User Request

## 2026-09-24T21:48:48Z

A comprehensive overhaul of the 3D anatomy pipeline and viewer to include the complete BodyParts3D dataset (thousands of structures) while maintaining feasible load times and a coherent, performant user interface.

Working directory: c:\Users\meyig\Documents\Projects\toolbox-ola
Integrity mode: development

## Requirements

### R1. Complete Dataset Extraction
Modify `scripts/anatomy-select.mjs` to remove the hardcoded caps (`CAPS`) so that all available anatomical structures are processed, rather than a limited subset of ~600.

### R2. Feasible Load Times & Build Optimization
Update `scripts/anatomy-build.mjs` and the loading strategy to handle the full dataset without creating prohibitively large downloads. This may involve more aggressive decimation/compression, chunking systems into smaller GLB files, or progressive loading.

### R3. Performant UI Integration
Update the viewer (`js/tools/anatomy-explorer.js`) to smoothly handle thousands of structures. Ensure the structure list uses virtualization or efficient rendering to prevent UI freezing, while keeping the interface design visually coherent with the current Toolbox UI.

## Acceptance Criteria

### Execution & Integration
- [ ] The build script processes the full dataset without memory crashes.
- [ ] The viewer UI loads successfully with the complete dataset without breaking the existing layout or styling.

### Performance
- [ ] The 3D viewer remains responsive (>= 30 FPS) when manipulating the fully loaded model.
- [ ] The structure list in the UI does not freeze the browser when searching or scrolling through thousands of items.
- [ ] Initial load times for a system remain reasonable (e.g., each chunk/system is under a strict size limit, or dynamically loaded).
