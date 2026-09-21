# Automobile technical viewer

The Automobile Guide now renders GLB/glTF geometry as an interactive technical line drawing. Vehicle search and the reference-data providers remain in place. The old SVG/photo visualization adapter is retired.

**Current asset status:** the repository has no suitable licensed automobile GLB. The shipped CC0 assembly consists of boxes and cylinders, explicitly labeled **Development model — not vehicle geometry**. It tests rendering, occlusion and interaction; it is not an automotive reference model. Neither the reference screenshots nor their commercial stock assets are bundled. No rendering service or new production dependency was added. Three.js and glTF Transform were already installed.

## Code and data flow

| File | Responsibility |
| --- | --- |
| `js/tools/automobile-guide.js` | Existing search, modes, component list, inspector, mobile sheet and context UI |
| `js/lib/automotive-data.js`, `automotive-provider.js` | Existing vehicle data; catalog lookup and fallback selection |
| `js/lib/automobile/vehicle-loader.js` | GLTFLoader, optional external mapping, geometry budget, normalization and disposal |
| `js/lib/automobile/component-registry.js` | Semantic component identity, mesh grouping and supplied metadata |
| `js/lib/automobile/technical-renderer.js` | Render targets, per-part passes, mode visibility and GPU lifecycle |
| `js/lib/automobile/technical-edge-pass.js` | Depth/normal/ID edge extraction and line composite; centralized quality settings |
| `js/lib/automobile/automobile-viewer.js` | OrbitControls, picking, keyboard/touch input, camera fitting, resizing and demand rendering |
| `css/automobile-viewer.css`, `js/app.js` | Theme-aware chrome and responsive viewer styling |
| `public/automobile/assets.json` | Asset catalog; swap the fixture without editing renderer code |
| `scripts/create-automobile-fixture.mjs` | Reproducible GLB fixture generation |

## Rendering

1. Render geometry offscreen into view-normal/depth and 24-bit semantic ID/depth targets. Original materials and textures never reach the visible composite.
2. Compare neighboring samples for silhouette discontinuities, meaningful normal changes and semantic boundaries. A second depth difference suppresses ordinary planar depth slopes. No triangle wireframe or EdgesGeometry is used.
3. Technical mode uses the nearest visible geometry. In X-Ray, render each candidate component into a separate normal/depth target, compare its depth against the full assembly, then accumulate only obscured edges. Max blending prevents overlapping components from repeatedly increasing line intensity.
4. Composite light contours over a neutral dark background. The defaults are .9 visible opacity and .16 hidden opacity, blended in linear color space. Selection strengthens selected outlines and fades the rest; hover adds a subtle emphasis. Isolate omits unrelated meshes.

`TECHNICAL_SETTINGS` centralizes line thickness, depth/normal thresholds, component boundaries, opacity and quality budgets. No lighting, texture, transparency or physical-material appearance is used. Properly authored smooth normals are essential: a faceted input can legitimately produce faceted crease lines.

## Asset contract

Use a mesh-based GLB (preferred) or glTF 2.0 asset with Y-up coordinates, valid normals, finite bounds and stable unique node names. A wrapper centers the asset and scales its longest dimension to five viewer units without modifying individual component transforms. Viewer units are not physical measurements.

Put redistributable models under `public/automobile/models/` or use an HTTPS URL with correct CORS headers. Models should omit unnecessary textures; although ignored for drawing, GLTFLoader still loads original asset resources. Draco, Meshopt and KTX2 decoders are not configured in this viewer: supply an uncompressed GLB initially. Animation playback, morph-state controls and CAD formats are not supported.

The catalog resolves `vehicles[vehicle.id]`, then `representative[bodyStyle.toLowerCase()]`, then `development`. Each value has this shape:

```json
{
  "modelUrl": "/automobile/models/sedan.glb",
  "componentMapUrl": "/automobile/models/sedan-components.json",
  "metadata": {
    "accuracy": "representative",
    "label": "Generic sedan assembly",
    "description": "Representative architecture; not the selected vehicle's exact layout.",
    "source": "Asset creator and source URL",
    "license": "Redistribution license and attribution"
  },
  "componentMap": {
    "Strut_FL": {
      "id": "front_left_strut",
      "name": "Front Left Strut",
      "category": "Suspension",
      "parentAssembly": "Front Suspension",
      "description": "Verified description from the supplied source.",
      "source": "Metadata source"
    }
  },
  "components": []
}
```

`componentMapUrl`, inline `componentMap` and `components` are optional. The external mapping JSON has the same node-name-to-metadata shape as `componentMap`; inline entries take precedence. Alternatively, put the same metadata under each glTF node's `extras.component` (Three.js exposes it as `userData.component`). Metadata on a parent assembly groups descendant meshes, unless a child supplies its own identity. Toolbox `components` records can map a node using `meshName`, or enrich a known component `id` with supplied facts.

Mapping precedence is explicit map, node extras, then vehicle/catalog `meshName` mapping. Closest mapped ancestor wins. Meshes without metadata remain selectable under their authored names or “Unnamed geometry,” with “Unmapped geometry” and no invented description. Numeric render IDs are independent of materials and never exposed as semantic IDs.

Supported accuracy labels are `development`, `representative`, `generation`, `exact`, and fallback `unverified`. The catalog is a curated trust boundary: only mark an asset exact when its make, model, year, variant and mechanical layout actually match the selected vehicle. Current NHTSA search returns model-level identities, not verified year/variant-specific mechanical models. Do not mark these entries exact merely because the make/model names match. Generic metadata is never merged into the development fixture.

## Interaction and Assistant

Drag to orbit; wheel/pinch to zoom; right-drag or two fingers to pan. Arrow keys orbit, +/- zoom and Home resets when the canvas has focus. Part-list buttons provide a keyboard-accessible alternative to picking and expose `aria-pressed`. Mobile uses the existing Specifications/Component bottom sheet; selecting a listed component updates the inspector. The canvas owns touch gestures only inside its bounds. Camera fitting accounts for portrait and landscape aspect ratios.

Selection emits the existing `toolbox:automobile:context` event with vehicle identity, asset accuracy, selected-component metadata and mode. The previous Assistant query event had no consumer. The inspector now offers **Copy context for Assistant**, which copies structured context plus a prompt that prohibits assuming exact geometry. It does not silently send a message or alter the Assistant's session. A direct Assistant context consumer can be added later.

## Performance and limits

- Render only after loading, interaction, selection, mode changes or resize; no permanent animation loop. The final drawing buffer is preserved so idle frames survive browser/theme repaints; the same pixel caps bound that memory.
- Desktop render targets: at most 1.5 DPR / 1.6 million pixels. Mobile: at most 1 DPR / 650,000 pixels. Mobile tier is selected when the viewer mounts.
- Geometry admission budget: 500,000 triangles desktop; 250,000 mobile. Simplify larger assets offline; loading/decode still occurs before the budget can be checked. For comfortable interaction, aim substantially below these limits and test representative devices.
- X-Ray previews at most 32 components desktop / 12 mobile, with the selected component first. The UI discloses when this cap applies. Technical mode and the component list still include the complete assembly.
- X-Ray uses the nearest surface of each semantic component. It does not recover every self-occluded layer within one monolithic mesh. Author meaningful separate components for internal detail. Full depth peeling, exploded transforms and larger-assembly acceleration are future work.
- Screen-space lines may alias at low resolution; there is no temporal antialiasing. Thin features below a pixel can disappear. Real phone GPU performance has not been benchmarked.
- Picking selects the first physical surface, including invisible-in-the-composite occluding surfaces; choose obscured parts from the component list, then Isolate.
- Switching/disposal releases mesh resources, shared textures/materials, ID materials, render targets, listeners and controls. Late loads are discarded and disposed. Context loss shows recovery guidance; restoration schedules a fresh render.

## Validation

Run `npm test`, `node --test tests/unit/automobile-viewer.test.js`, and `npm run build`.

For interactive inspection, run Vite and open `/tests/browser/automobile-viewer.html`. The harness renders the real Guide component. The optional automation runner, `node tests/browser/automobile-viewer.mjs`, uses a locally installed Puppeteer/Chrome (not a production dependency); set `TOOLBOX_TEST_URL` if Vite is not on port 3000. It saves screenshots under the ignored `.workspaces/automobile-audit/` directory.

Browser coverage includes real WebGL pixels for Technical/X-Ray/Isolate, raycast click selection, list selection, orbit, zoom/reset, keyboard input, resize, mobile sheets, touch orbit/pinch, missing assets, stale-load disposal, idle rendering and repeated model replacement. Five replacement cycles retained eight geometries and seven textures with the fixture, and disposed all 35 previous mesh geometries. This is a regression check on Chrome's software GPU, not a device-performance claim. The full Toolbox route was also inspected at desktop and phone widths.

## Next work

1. Obtain a redistributable semantic automobile GLB and verified component metadata, including attribution. This is the required content step before the Guide can show a real technical automobile illustration.
2. Add explicit year/generation/variant resolution before publishing exact-vehicle models.
3. Tune thresholds and LOD on real mechanical assets and physical mid-range phones. Add decoder support if the licensed asset pipeline needs compression.
4. Extend X-Ray to deeper layers where needed, add reviewed exploded offsets, and connect structured context directly to Assistant when that consumer exists.
