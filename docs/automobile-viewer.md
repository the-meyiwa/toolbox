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

- 2014–2016 Toyota Corolla (E170, North America) — Toolbox-original procedural package with body, cabin and mechanical layers and 55 articulations. Default vehicle.
- 2013 Toyota Corolla (E140, North America) — the same generator driven by the E140 profile.
- 2005 Ford Mustang GT by Ricy, CC BY 4.0.
- 2018 Tesla Model 3 by Ameer Studio, CC BY 4.0.
- BMW M4 Competition M Package by SRT Performance, CC BY 4.0. Its exact model year is unavailable in the source, so Toolbox labels it representative rather than exact.

Attribution and source links are embedded in every manifest and displayed in the viewer.

## Procedural packages (Toyota Corolla)

`scripts/build-procedural-vehicle.mjs` generates Toolbox-original packages from code; no third-party geometry is used, so their license is `LicenseRef-Toolbox-Original` and their accuracy is `representative`.

```text
npm run vehicle:procedural             # regenerate GLB, manifest, specs.json and catalog entries
node scripts/build-procedural-vehicle.mjs --check   # CI: fail if committed output is stale
```

- `scripts/procedural-vehicle/corolla-profiles.mjs` holds the published dimensions per generation (length, width, height, wheelbase, track, tyre size) with the source of each figure in comments. Styling knots are marked as approximations.
- `sedan-body.mjs` builds the outer skin as a wrap surface plus bonnet, glasshouse and boot-lid patches that share boundary curves, so panels meet on real shut lines.
- `corolla-model.mjs` and `corolla-systems.mjs` add doors, closures, structure, running gear, the 2ZR-FE powertrain, engine-bay systems, cabin, SRS and boot. Every moving part hangs under a `tbx_pivot_*` node placed at its hinge or slide origin.
- `corolla-data.mjs` supplies per-component reference metadata (description, location, specifications, maintenance, failure modes, accuracy note and linked sources) and the grouped specification sheet. A unit test proves the generated geometry matches the published length, width, height, wheelbase and track.

Output is deterministic: the generator writes byte-identical files on every run.

## Articulations

A manifest may declare `articulations` (see the schema). Each has an `id`, `label`, `group`, `actions.on/off` labels, the `components` whose selection offers it, and `transforms` that rotate (`axis`, `degrees`) or translate a pivot node. Optional `requires` entries express service order — e.g. the caliper can only be removed once the wheel is off, and the wheel cannot be refitted until the caliper is back. `exclusive` groups (steering left/right) are mutually exclusive.

`js/lib/automobile/articulation-controller.js` recomposes each pivot from its rest transform every frame, so combined moves (steer + remove wheel) stay exact and reversible. Closing a part returns everything that depends on it (closing the bonnet refits caps, the dipstick and coils). Reduced-motion users get instant state changes.

Interaction model:

- Desktop: right-click a part in the viewport (or in the component list) for its actions, isolate/hide options and vehicle-wide quick actions. Right-drag still pans. With the canvas focused, Shift+F10 or the context-menu key opens the menu for the selection.
- Mobile / touch: tap a part; the selection chip and the Component panel show a **Toggle** button that expands the available actions. Running an action lowers the sheet so the movement is visible.
- Model layers (body, glass, lighting, trim, structure, interior, airbags, engine, engine-bay systems, chassis, wheels, fuel & exhaust) can be hidden to see inside; quick actions open all doors, lower windows, remove all wheels or reset everything.

## Verification

Run `npm test`, `npm run build`, `node scripts/build-procedural-vehicle.mjs --check`, and validate all package directories with the command above. The interactive harness at `/tests/browser/automobile-viewer.html` renders the real Guide component; `tests/browser/automobile-viewer.mjs` drives desktop right-click and mobile Toggle flows against it.
