# 3D Lab

`#3d-lab` (`js/tools/3d-lab.js`, styles in `css/lab3d.css`) builds 3D scenes from a library of real-size models, basic-to-advanced shapes, free online models and the person's own files, and exports them. The Assistant can create the same objects in chat (`create_3d_object`) and hand them to the Lab.

## What's in the library

| Module | Contents |
| --- | --- |
| `js/lib/lab3d/models/tech.js` | iPhone 17 Pro, 17 Pro Max, 17, Air and 16 Pro (real dimensions, cameras, buttons, lit lock screen), an Android flagship, tablet, laptop (adjustable lid), monitor (any diagonal), keyboard, mouse, headphones, game controller, smartwatch, gaming PC, drone, camera |
| `models/furniture.js` | Office chair (five-star base, twin-wheel casters, gas lift, woven-mesh back with lumbar curve, T-arms, headrest), gaming chair, dining chair, bar stool, desk, dining and coffee tables, sofa, armchair, bed, bookshelf, desk and floor lamps, potted plant |
| `models/objects.js` | Kitchen and household items, sport and games (football, basketball, die, chess pieces and set, guitar), nature (trees, rock), a house, vehicles (sedan, bicycle, airliner, rocket) |
| `models/weapons.js` | AK-47 (AKM), MP5 and a katana as **visual display replicas**: side-profile blockouts at real size, no internal mechanism |
| `shapes.js` | 46 shapes in three levels. Basic: cube, sphere, cylinder, cone, pyramid, torus, capsule, platonic solids… Intermediate: rounded box, geodesic sphere, gear, spring, star, heart, stairs, vase (lathe), chain link… Advanced: torus and trefoil knots, Möbius strip, Klein bottle, superellipsoid, supershape, seashell, Menger sponge, Sierpiński pyramid, helicoid, Enneper and Dini surfaces, hyperboloid, spherical harmonics, twisted torus |

Every model has typed options (`params`: colour with named swatches, select, toggle, range) that the Lab's inspector draws and the Assistant passes by name. Units are metres, y is up, and each object rests on the floor.

`materials.js` has the object materials: plastics, anodised aluminium, titanium, gunmetal, chrome, glass, screen, lens, woods (with canvas grain), fabric, velvet, leather, woven mesh and more. Each call makes a new material so objects can be recoloured independently.

## Prompts → models

`catalog.js#resolveObject(text)` matches free text to a model or shape and reads its options from the words:

- aliases and names match as whole phrases; the longest wins ("iPhone 17 Pro Max" beats "iPhone 17 Pro");
- names with digits also match compacted ("ak47" → AK-47);
- words can carry a typo ("ofice chair"), numbers never do;
- option words: colour and finish names ("deep blue", "cosmic orange"), select options ("collapsing stock", "bakelite magazine"), "with / without headrest", "32 inch", "4 seater", "level 3", "24 teeth".

The describe box in the Lab splits "A, B and C" into separate objects when each part resolves; otherwise it keeps the phrase whole ("AK-47 with a bakelite magazine").

## Scene format

`scene.js` — one JSON format for the Lab, the Assistant and saved scenes:

```json
{ "title": "Desk setup", "environment": "studio", "items": [
  { "type": "model", "model": "office-chair", "params": { "color": "#3f4a5c" } },
  { "type": "shape", "shape": "torus-knot", "params": { "p": 3, "q": 7 }, "material": "chrome", "at": [1, 0, 0] },
  { "type": "online", "source": "khronos", "id": "SheenChair" },
  { "type": "custom", "vertices": [[0,0,0],[1,0,0],[0,1,0]], "faces": [[0,1,2]] },
  { "prompt": "iphone 17 pro in deep blue" }
] }
```

Items take `at` (metres), `rotate` (degrees), `scale` and `name`. `normalizeItem` validates everything (unknown models, non-https URLs and oversized custom meshes are rejected). Items without `at` are laid out side by side. `serialize` reads the live transforms back.

## Online models and files

`online.js` searches two keyless sources the browser can load directly (both send CORS headers):

- **Khronos glTF Sample Assets** on GitHub — showcase models (sofas, chairs, lamps, a car, a chess set, helmets, a watch…). Licences vary per model; results link the model's folder, which carries its licence.
- **Poly Haven** — CC0 furniture, props and plants (`api.polyhaven.com`).

A source that is unreachable is reported, not fatal. Downloads are cached for the session.

Local files: GLB, glTF (embedded), OBJ, STL, PLY, FBX, 3MF, DAE and USD/USDZ. Files that come in huge (drawn in mm or cm) are scaled to metres. Imported meshes stay in memory for the session and are left out of the saved scene (export GLB to keep them).

## Exports

`export.js`: GLB and glTF (materials and textures, metres), OBJ zipped with an MTL, STL (binary, millimetres by default for slicers; cm or m on request), PLY (vertex colours), USDZ (AR Quick Look on iPhone/iPad), plus PNG snapshots and the scene JSON. Export the whole scene or only the selection.

## The Lab window

- Library (Models · Shapes · Online · Import) with thumbnails rendered off-screen when idle (`thumbs.js`, cached for the session). Cards can be clicked or dragged onto the floor.
- Stage: `Viewer3D` in studio or outdoor light, move/rotate/scale gizmo (W E R, Q to select), snap to 1 cm and 15°, views, grid, wireframe, turntable, PNG.
- Inspector: scene outline (select, hide), name, position/rotation/scale, the object's options, duplicate, drop to floor, focus, delete. Sizes are the object's own (ignoring how it is turned).
- Undo/redo (60 steps), autosave to `toolbox_3dlab_v1`.
- On narrow screens the library and inspector become drawers.

## Assistant

`js/lib/lab3d/assistant-tools.js`:

- `create_3d_object` — `{ request }` in words, or explicit `items` (library models, shapes composed at real proportions, custom meshes, online models). Returns a `lab3d-object` card (`js/lib/assistant/lab3d-card.js`): live preview, quick colour swatches for a single model, GLB/OBJ/STL/USDZ/PNG and **Open in 3D Lab**. Unknown objects return `not_found` with guidance to compose them from shapes or search online.
- `search_3d_models` — searches the online sources and returns ids for `create_3d_object`.

The tool description is built from `library-index.js`, a light copy of the catalogue so the Assistant does not load three.js to start; `tests/unit/lab3d.test.js` checks it matches `catalog.js`.

**Open in 3D Lab** writes `toolbox_3dlab_handoff` and opens the Lab in a new tab (or, if the Lab is already open under the Assistant pop-up, adds the objects directly). The handoff is added on top of the saved scene as an undoable step.

## Tests

`tests/unit/lab3d.test.js`: every shape and model builds finite geometry at plausible real sizes, the resolver cases above, index/catalogue parity, scene validation, layout and round-trip, STL (millimetres) and OBJ export, and `create_3d_object`.
