# Toolbox Vehicle Guide

The Vehicle Guide (formerly the Automobile Guide) covers cars, an SUV and two aircraft. Its tool id is still `automobile-guide`, so old links keep working, and `#vehicle-guide` opens it too.

The Guide is fully client-side. Three.js loads Toolbox Vehicle Packages from static assets, and all rendering, picking, highlighting, X-Ray, isolation, labels and component search run in the browser. No API key or live vehicle/rendering service is used.

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

- 2014–2016 Toyota Corolla — real body, glass, lamps, wheels, brakes and full cabin from "2014 Toyota Corolla E180 EU (with interior)" by Armored Wave (CC BY 4.0, https://skfb.ly/oLAVz), split into components and articulated, with Toolbox's procedural engine bay, chassis and fuel system fitted inside. Default vehicle. The body is the European E180; North American cars differ in bumpers, grilles and lamps.
- 2013 Toyota Corolla (E140, North America) — Toolbox-original procedural package.
- 2005 Ford Mustang GT by Ricy, CC BY 4.0.
- 2018 Tesla Model 3 by Ameer Studio, CC BY 4.0.
- BMW M4 Competition M Package by SRT Performance, CC BY 4.0. Its exact model year is unavailable in the source, so Toolbox labels it representative rather than exact.
- 2008 Lexus GX 470 (J120) — Toolbox-original procedural package: body-on-frame SUV with the 2UZ-FE V8, full-time 4WD, side-hinged rear door and separately opening glass.
- Boeing 737-800 (Next Generation) — Toolbox-original procedural package: airframe, flight deck, cabin, CFM56-7B engines, landing gear and every flight control surface.
- Cessna 172S Skyhawk SP — Toolbox-original procedural package: airframe, cockpit with the conventional six-instrument panel, IO-360 engine and propeller.

Attribution and source links are embedded in every manifest and displayed in the viewer.

## Source-geometry package (2014–2016 Corolla)

`scripts/build-source-vehicle.mjs` builds the package from the downloaded source GLB (git-ignored; place it at `vehicle-packages/sources/2014_toyota_corolla_e180_eu_with_interior.glb`):

```text
npm run vehicle:source
```

`scripts/vehicle-sources/corolla-e180.mjs` splits every source mesh into vertex-connected islands and classifies them by node, material and bounds (doors, glass, mirrors, bonnet, seats, visors, glovebox …); the single welded body shell is cut per triangle into bumpers, wings, quarters, rockers and boot lid. Geometry is scaled to the published 4,620 mm length (wheelbase lands at 2,708 mm). Hinge pivots are derived from each part's bounds, and the procedural systems below are fitted to the measured axles, track and cowl.

### Photo-checked engine bay

`scripts/vehicle-sources/corolla-e170-corrections.mjs` moves procedural engine-bay parts to where photos of North American E170 cars show them. Each entry records what the photos show.

- The air cleaner box sits behind the battery, clear of the brake master cylinder.
- The oil filler cap is at the rear right of the engine cover, with the dipstick in the front hole.
- The radiator cap is on the right-hand tank.
- The coolant reservoir is just right of centre.

The same file also moves pieces that the source mesh welded to the wrong part (`REASSIGN`, version 2):

- **Side air vents:** moved from the front door trims to the dashboard, so they no longer swing out with the doors.
- **Front door armrests:** moved from the seatbacks onto the doors, so they stay put when a seat reclines and open with the door.
- **Inner tail lamps, and the garnish across the boot lid's face:** moved from the body onto the boot lid, so they rise with it instead of floating.

Each moved piece gets its own node, with a `meshMappings` entry for its component.

The build script applies both versions. Running the script on its own patches the committed GLB once and updates its sha256 and mappings. The matching locations are in `corolla-data.mjs`, for the E170 only.

`tests/unit/vehicle-controls.test.js` holds the audit as tests:
- the door trims carry no vent pieces;
- the seatbacks carry nothing inside the doors;
- nothing fixed to the body sits on the boot lid.

The glTF packaging itself is also checked.

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

## Procedural packages: Lexus GX 470, Boeing 737-800, Cessna 172S

The same generator builds these three (`npm run vehicle:procedural`; `--check` in CI). Each has a model file, a data file with the reference text for every component and the grouped spec sheet, and a package file that ties them together:

| Package | Model | Data | Package |
| --- | --- | --- | --- |
| 2008 Lexus GX 470 | `gx470-model.mjs` | `gx470-data.mjs` | `gx470-package.mjs` |
| Boeing 737-800 | `b737-model.mjs` | `b737-data.mjs` | `b737-package.mjs` |
| Cessna 172S | `c172-model.mjs` | `c172-data.mjs` | `c172-package.mjs` |

Shared building blocks live in `scripts/procedural-vehicle/`:

- `shapes.mjs`:
  - `Loft` sweeps a skin through cross-sections along the length. It builds the fuselages, the nacelles and the GX 470's body.
  - `Wing` builds any lifting surface from leading-edge stations, chord and thickness: wings, tailplanes, fins, winglets and propeller blades.
  - Both cut their skin into components on a parameter grid whose lines fall on every door, window and control-surface edge, so panels meet exactly.
- `aircraft-parts.mjs` cuts trailing-edge control surfaces out of a wing on hinge-line pivots. It also lays spoilers, slats and Krueger flaps over the skin, and builds aircraft wheels.
- `package-data.mjs` turns families of component descriptions into manifest entries with their sources.

The published figures that the tests hold the geometry to (`tests/unit/vehicle-guide-packages.test.js`):

- **GX 470:**
  - length 4,780 mm, width 1,880 mm and height 1,895 mm with the roof rails
  - wheelbase 2,790 mm, track 1,585 mm
  - ground clearance 211 mm under the rear differential
- **737-800:**
  - length 39.47 m, span 35.79 m with blended winglets, tail height 12.55 m
  - fuselage 3.76 × 4.01 m
  - wheelbase 15.60 m, main-gear track 5.72 m
  - H44.5 main tyres
- **172S:** length 8.28 m, span 11.00 m, height 2.72 m, 76-inch propeller.

Section shapes, planforms between the published points and the placement of systems are approximations. Each manifest says so, and every package is labelled `representative`.

Manifests can now carry three optional fields (see the schema):

- `vehicle.category`: `car` or `aircraft`. Aircraft use the aircraft safety notes, and the Guide calls their interior the flight deck or cockpit.
- `quickActions`: vehicle-wide toggles for an articulation group (open all doors), a list of articulations (deploy both reversers), layers (hide the skin to see inside), or every wheel.
- `cabin`: the eye point for Interior mode. It gives the head component, how far forward and down the eye sits in metres, and what to look at. The viewer scales every model to the same size, so the Guide converts these offsets with `viewer.unitScale`.

What moves:

- **737:**
  - doors and exits, cargo doors, radome
  - main and nose gear with the nose-gear doors
  - flaps 5 and 30, with slats and Krueger flaps
  - roll, pitch and yaw (control surfaces, control wheels and pedals), stabiliser trim
  - speed brakes and ground spoilers
  - fan cowls and thrust reversers, which guard each other
  - flight deck door and APU inlet
- **172S:**
  - doors and baggage door
  - flaps 10/20/30
  - roll, pitch and yaw (with nose-wheel steering), trim tab
  - oil door and dipstick, upper cowling, fuel caps, seats
- **GX 470:**
  - doors and windows, mirrors, bonnet
  - the side-hinged rear door (hinged on the right) and its glass hatch
  - fuel door, glovebox, console lid
  - steering, wheels, calipers and tyres
  - front seats, the fold-away third row
  - service items that need the bonnet open
  - the spare-tyre winch

Controls libraries (`js/lib/automobile/gx470-controls.js`, `b737-controls.js`, `c172-controls.js`) follow the Corolla's format and share `controls-search.js`. The Guide picks the library for the loaded vehicle through `vehicle-controls.js`.

- **737:** the mode control panel, EFIS, warning lights, displays, gear and autobrake, five overhead panels, the control stand, radios and fire panel, control wheel, and pedals and tiller. The exterior walk-around covers the nose probes, doors, engines, gear, lights, refuelling, APU and cargo doors.
- **Cessna:** instruments, switches, power, flaps and trim, fuel, radios, yoke and cabin, and a pre-flight walk-around.
- **GX 470:** switches, stalks and warning lights, including its 4WD controls.

Aircraft content is written for learning, not for operating an aircraft, and the panels say so.

## Articulations

A manifest may declare `articulations` (see the schema). Each has an `id`, `label`, `group`, `actions.on/off` labels, the `components` whose selection offers it, and `transforms` that rotate (`axis`, `degrees`) or translate a pivot node. Optional `requires` entries express service order — e.g. the caliper can only be removed once the wheel is off, and the wheel cannot be refitted until the caliper is back. `exclusive` groups (steering left/right) are mutually exclusive.

`js/lib/automobile/articulation-controller.js` recomposes each pivot from its rest transform every frame, so combined moves (steer + remove wheel) stay exact and reversible. Closing a part returns everything that depends on it (closing the bonnet refits caps, the dipstick and coils). Reduced-motion users get instant state changes.

Interaction model:

- Desktop: right-click a part in the viewport (or in the component list) for its actions, isolate/hide options and vehicle-wide quick actions. Right-drag still pans. With the canvas focused, Shift+F10 or the context-menu key opens the menu for the selection.
- Mobile / touch: tap a part to open a small info panel over the viewer; its toggles (switches) sit right there, and the vehicle is lifted into the space above the panel. **Details** opens the full component sheet.
- Model layers (body, glass, lighting, trim, structure, interior, airbags, engine, engine-bay systems, chassis, wheels, fuel & exhaust) can be hidden to see inside; quick actions open all doors, lower windows, remove all wheels or reset everything.

## Exterior, Interior and Parts

A switcher at the top of the viewport picks how to explore the car:

- **Exterior** orbits the car. Markers sit on the lamps, key, fuel door, door pillar and engine bay.
- **Interior** puts the camera at the driver's eye point, taken from the driver's head restraint. Dragging turns your head around the cabin. Markers sit on the door switches, steering-wheel switches, stalks, instrument cluster, centre stack, climate panel, console, overhead console and floor releases.
- **Parts** is the component explorer described above, with no markers.

Tapping a marker opens that group of controls, drawn as a panel with every switch and symbol. Tapping a control explains what it does, how to use it, and which grades have it. On desktop the panel is a side sheet; on a phone it is a bottom sheet.

The data behind it:

- `js/lib/automobile/corolla-controls.js` holds 19 researched groups for the 2014–2016 Corolla (E170). Each group names the component it is anchored to and where on that component.
  - Sources: Toyota's 2014 Corolla Quick Reference Guide and Owner's Manual, and Toyota parts listings (for example the mirror switch, 84870-02150).
  - Features that depend on grade, market or dealer settings are marked as such, not stated as fact.
- `vehicle-symbols.js` draws about 100 ISO 2575-style symbols.
- `control-panel.js` lays out and draws a group (`clusterSvg`, `mountControlPanel`). The Guide and the Assistant share it.
- `findControls(query)` turns a plain description into a group and, when one clearly stands out, a control. It understands descriptions such as "button on the door", "orange light that looks like an engine", "lever on the right" and "knob with L and R".

## Assistant: "One of these?"

When someone asks what a button, light, symbol, lever or exterior part is for, the Assistant calls `vehicle_controls`. The card shows only that part of the car, with every switch and symbol, and highlights the most likely match. It suggests nearby groups in case the first guess is wrong. **Open in Vehicle Guide** hands the group and control to the Guide through `localStorage['toolbox.automobile.focus']`, and the Guide opens on it.

For other cars, the card says the drawing is the Corolla's; the symbols are standard.

## Assistant: parts

`vehicle_part` answers "where is the …" and "show me the …" from the Guide's own package data (`js/lib/automobile/part-search.js`).

- It understands mechanics' and British/American names: sump, fan belt, cat, CV axle, bonnet, boot, rotor, shock, O2 sensor, fuse box.
- It understands sides and ends, such as "front left" or "passenger side".
- The card shows the part's location, job, specs, maintenance, failures and matching spec-sheet rows, with its accuracy note and sources.
- **Show in 3D** opens the Guide in Parts mode with the part selected. Parts under the skin open in X-Ray.

The Assistant's instructions describe the Guide's three modes. They also tell it to show the part a diagnosis points to, and never to invent figures the data lacks.

Harnesses (with `npm run dev`):

- `/tests/browser/vehicle-controls.html?c=driver-door,cluster` draws the groups.
- `/tests/browser/vehicle-controls-card.html?q=...` runs the Assistant card.

Tests are in `tests/unit/vehicle-controls.test.js`.

## Injuries, treatment and prevention

Parts that can hurt someone carry a safety section: the hazard, the common injuries, and how to prevent them. This covers the seat belts, airbags, steering wheel, dashboard and knee bolster, glass, doors, battery, cooling system, exhaust, fans and belts, jack, tyres and wheels. The data lives in `js/lib/automobile/injury-data.js` and the rendering in `js/lib/automobile/injury-render.js`.

- Each injury gives what it is, the signs, first aid and likely hospital treatment. It is graded minor, serious or critical.
- Where the injury can break bones, its fracture types are listed, each with a small diagram (transverse, oblique, spiral, comminuted, open and others).
- **Drugs** are green links. Each opens that compound in the Compound Database through `localStorage['toolbox.compounds.focus']`. Every drug named is in the curated compound set.
- **Injury sites** are links, for example "fracture of the mid-shaft of the femur". Each opens the Anatomy Explorer in focus mode through `localStorage['toolbox.anatomy.focus']`, which shows only that structure and its surroundings, faded. Where a site has a marker, a red band shows the exact segment. **Surrounding anatomy** and **Whole body** widen the view.
- In the Guide, open the Inspector on a part to see its safety section. Part cards show a "Safety" chip.
- The Assistant's `car_injury` tool answers injury questions, such as "what injuries can seat belts cause". Its card carries the same links. `vehicle_part` appends the safety section to a part card.

Nothing here is a substitute for emergency care. The card says so, and doses are never given.

Tests: `tests/unit/vehicle-injuries.test.js` checks that every drug exists, every site resolves to atlas structures, and every hazardous part has a rule.

## Verification

Run `npm test`, `npm run build`, `node scripts/build-procedural-vehicle.mjs --check`, and validate all package directories with the command above. `tests/unit/vehicle-guide-packages.test.js` covers the GX 470, 737-800 and 172S. The interactive harness at `/tests/browser/automobile-viewer.html` renders the real Guide component; `tests/browser/automobile-viewer.mjs` drives desktop right-click and mobile Toggle flows against it.
