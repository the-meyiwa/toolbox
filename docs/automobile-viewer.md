# Toolbox Automobile Guide

The Automobile Guide is fully client-side. Three.js loads Toolbox Vehicle Packages from static assets, and all rendering, picking, highlighting, X-Ray, isolation, labels and component search run in the browser. No API key or live vehicle/rendering service is used.

## Toolbox Vehicle Package v1

Each package is a directory containing `vehicle.glb` and `manifest.json`. The normative shape is documented in `vehicle-packages/toolbox-vehicle-package.schema.json`. A manifest records:

- vehicle identity and the accuracy of the geometry;
- creator, source and redistributable license attribution;
- available and explicitly unavailable model layers;
- stable component IDs, labels, categories and supplied metadata;
- standardized GLB node-to-component mappings;
- triangle counts and SHA-256 hashes.

Unavailable geometry is never inferred. If a source lacks mechanical or interior geometry, its layer is marked `available: false`. Unrecognized source meshes remain renderable under the honest `unmapped_geometry` component, while `unmappedMeshes` preserves their original names for later curation.

`public/automobile/catalog.json` is the on-demand package index. A package can move to a same-origin CDN by changing only its manifest URL.

## Ingestion and validation

Source definitions live in `vehicle-packages/definitions`. They contain attribution, optimization limits and conservative mapping rules based on names already present in the source model.

```text
npm run vehicle:package -- inspect path/to/source.glb
npm run vehicle:package -- ingest path/to/source.glb vehicle-packages/definitions/example.json public/automobile/packages/example
npm run vehicle:package -- validate public/automobile/packages/example
```

The pipeline accepts CC0 1.0 and CC BY 4.0 inputs, strips presentation-only materials and textures, keeps positions and normals, deduplicates and welds geometry, optionally simplifies it, applies Meshopt compression, standardizes node names and writes a checksum-backed manifest. Legal review is still required before adding any new source definition.

## Included packages

- 2005 Ford Mustang GT by Ricy, CC BY 4.0.
- 2018 Tesla Model 3 by Ameer Studio, CC BY 4.0.
- BMW M4 Competition M Package by SRT Performance, CC BY 4.0. Its exact model year is unavailable in the source, so Toolbox labels it representative rather than exact.

Attribution and source links are embedded in every manifest and displayed in the viewer.

## Verification

Run `npm test`, `npm run build`, and validate all package directories with the command above. The interactive harness at `/tests/browser/automobile-viewer.html` renders the real Guide component.
