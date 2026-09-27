# Architecture, structures and 3D

How Toolbox renders buildings and structures, checks container conversions, and how the Assistant designs, models and learns about architecture.

## Realistic rendering (`js/lib/viewer3d.js`)

`new Viewer3D(mount, { realism: true, environment: 'outdoor' | 'studio', dark, grid, ambientOcclusion })` turns on the realistic scene. Without `realism`, a viewer looks as it always has.

- ACES filmic tone mapping and an image-based environment (PMREM `RoomEnvironment`), so metal, glass and paint reflect something.
- Sky dome shader, hemisphere light, a sun with soft PCF shadows and a rim light.
- A noise-shaded ground plane and a contact shadow under the model.
- Fog and a sky that scale with the model, so a 300 m bridge and a 6 m container both sit in a believable horizon.
- Ground-truth ambient occlusion (GTAO) through an `EffectComposer`. It is skipped on modest devices.
- `frame(target)` fits the camera exactly by projecting the bounding box onto the view axes, then fits the sun's shadow camera to the model.

Every environment step is wrapped so that a device without float textures or WebGL2 still gets a lit model.

`js/lib/render-materials.js` holds the shared PBR material library, cached by kind and colour: `material(kind, color, opts)`.

- Kinds: paint, steel, galvanised, aluminium, chrome, glass, concrete, render, timber, floor-timber, brick, block, asphalt, grass, soil, water, rubber, plastic, fabric, marble, gold, copper, emissive.
- `withSurfaceShading` injects world-space noise for subtle mottling, grime near the ground, rain streaks and roughness variation.
- Brick, planks and concrete get procedural canvas textures.

## ISO containers

### Geometry (`js/lib/container-mesh.js`)

`buildUnit(spec)` builds a container to ISO 668 external sizes (a 20 ft unit is 6.058 × 2.438 × 2.591 m). It includes:

- Corner posts and ISO 1161 corner castings with their apertures.
- Top and bottom rails, fork pockets and end sills and headers.
- A plywood floor on instanced cross-members.
- Trapezoidal corrugated side, end and roof sheets, each with its real pitch and depth. Openings are cut cleanly through the corrugation.
- A cargo-door end with four locking bars, cam keepers, hinges and a CSC plate. The door leaves sit recessed in the rear frame, as on a real container, so the hardware stays inside the envelope.

When the unit is lined, an insulated lining sits 40 mm inside the steel. A thin backer in the shell colour sits behind the corrugation so the pale lining never glints through at grazing angles.

Portacabins (`size: 'custom'`) get sandwich-panel walls, an eaves fascia and a galvanised roof.

### Structural check (`js/lib/container-structure.js`)

`checkStructure(design, basis)` gives a preliminary check of every module in a design:

- Wall removed per side, with a warning when more than half of a long wall is cut away.
- Lintels (S275 RHS, sized for bending and deflection) over side openings wider than 1.2 m.
- Transverse and longitudinal racking against the ISO 1496-1 ratings (150 kN and 75 kN), reduced for the openings.
- Corner-post stacking load against the 192,000 kg rating, flagging units that are not stacked corner to corner.
- Roof-deck joists and overturning under wind (`q = 0.613 V²`), with the anchor tension.
- Pad footings for the site's soil bearing.

`designContainer` attaches the result as `design.structure`. It feeds the Container Planner's **Structure** panel and the Assistant's container design card, which now shows a real 3D preview with an SVG fallback. Site values come from `site: { wind_speed_ms, soil_bearing_kpa }`.

The check is for early design only. Every result carries a disclaimer to have the design verified by a structural engineer.

## Modelling structures from a prompt (`model_3d`)

The Assistant's `model_3d` tool takes a JSON scene description. `js/lib/structure-model.js` expands it, `js/lib/structure-mesh.js` builds it, and `js/lib/assistant/structure-card.js` shows it in the realistic viewer. The card has orbit controls, quarter turns, labels, a horizontal section cut, size and steel tonnage, a member takeoff, and PNG, GLB and JSON downloads.

- **Parametric generators:** truss (Pratt, Howe, Warren, Fink, king and queen post, scissor), space_frame, tower, stair (straight, spiral, L, U), arch and vault, dome (geodesic, ribbed, Schwedler, shell), bridge (suspension, cable-stayed, arch, truss, beam), frame, column_grid, hypar, wall, roof (gable, hip, shed, pyramid, flat), tree and person.
- **Primitives:** box, cylinder, cone, sphere, torus, plane, extrude, lathe, tube, mesh and label.
- **Members:** member, beam, column, brace and cable, plus polyline. Sections are written the way engineers write them (`UB 305x165x40`, `SHS 100x5`, `CHS 114.3x5`, `rod 20`, `300x600`), and the takeoff masses come from those sections.
- **Composition:** group, array (linear or polar) and mirror, with `at`, `rotate` and `scale` on any node.

Models are capped at 20,000 members, 6,000 solids and arrays of 600. Unknown types become warnings instead of errors.

## Architecture advisor and calculators

`architecture_advisor` (`js/lib/assistant/architecture-kb.js`) has 23 topics, from loads, concrete, steel, timber and blockwork (NIS 87) to slabs, long spans, services, thermal performance, drawings and styles. It also runs `calc` modes backed by `js/lib/structural-calcs.js`: beam, column, loads, wind, rc_beam, span_depth / beam_depth, u_value, gutter, escape, ramp, septic, stairs, footing, ventilation and container_structure / container_stack.

The calculators follow BS EN 1993 (steel buckling curves), BS 8110 (reinforced concrete), ISO 6946 (U-values) and BS 6297 (septic tanks). Every result lists its working steps.

## Learning from the web (`knowledge_library`)

The Assistant can study a topic:

1. It searches the web through `/api/assistant/browser/search`, preferring reference, standards and university sources.
2. It reads pages through `/api/assistant/browser/fetch`, or the Wikipedia API.
3. It pulls out candidate concepts: definitions, rules of thumb and figures with units.
4. It saves the accurate ones with their sources.

Saved concepts live on the device (up to 500). Later answers and architecture topics draw on them. People can review and delete them under **Memory → What the Assistant has learned**. Learned text is always treated as reference data, never as instructions.

## Math Utility: Structures

The **Structures** mode runs the same calculators as commands:

```
beam L=6 w=10 section UB 305x165x40   bending, shear and deflection, with a V/M plot
section CHS 114.3x5                area, I, W, r and mass
column UC 203x203x46 L=3.5         EN 1993 flexural buckling resistance
wind V=40 h=3 w=12 d=6             dynamic pressure, wall force, roof uplift
rcbeam M=100 b=230 d=400           BS 8110 tension steel and bar choice
uvalue render 15, hollow sandcrete 225, render 15
loads office                       1.35gk + 1.5qk design load
```

## Checking the 3D by eye

With `npm run dev` running, open:

- `/tests/browser/container-card.html?case=office|stacked|cafe|cabin`
- `/tests/browser/structure-card.html?case=dome|tower|bridge|truss|pavilion|lattice`

The unit tests cover the structural numbers, the model sizes and the parsers: `tests/unit/container-structure.test.js`, `structure-model.test.js`, `structural-calcs.test.js` and `knowledge-library.test.js`.
