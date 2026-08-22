# Toolbox System Architecture Guide

This document serves as the canonical technical and architectural reference for **Toolbox**.

---

## 1. High-Level System Architecture

Toolbox is architected as an offline-first Single Page Application (SPA) utilizing ECMAScript Modules (ESM) and Vite:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Toolbox Shell                              │
│         (index.html · CSS Custom Properties · SPA Hash Router)          │
└───────────────────┬─────────────────────────────────┬───────────────────┘
                    │                                 │
         ┌──────────▼──────────┐           ┌──────────▼──────────┐
         │ Registry Subsystem  │           │   Artifact Layer    │
         │ (tools.js, kinds.js,│           │ (artifacts.js &     │
         │  schema.js)         │           │  artifact-ui.js)    │
         └──────────┬──────────┘           └──────────┬──────────┘
                    │                                 │
         ┌──────────▼─────────────────────────────────▼──────────┐
         │              Tool Dynamic Chunks (js/tools/*)          │
         │     (Dynamic ESM import on-demand via Vite Rollup)     │
         └──────────┬─────────────────────────────────┬──────────┘
                    │                                 │
         ┌──────────▼──────────┐           ┌──────────▼──────────┐
         │ Engine & UI Helpers │           │    Spaces Engine    │
         │ - viewer3d (WebGL)  │           │ - WebRTC Mesh       │
         │ - file-engine       │           │ - Yjs CRDT Sync     │
         │ - pdf-editor-engine │           │ - Ephemeral Rooms   │
         │ - architecture-eng  │           │                     │
         └─────────────────────┘           └─────────────────────┘
```

---

## 2. Subsystem Deep-Dives

### A. Registry Subsystem (`js/registry/`)
The registry is the single source of truth for the entire application. Tool modules do not define discovery metadata internally; all taxonomy is declared in the registry:
- **`tools.js`**: Defines the identity, name, one-line description, primary and secondary categories, search keywords, natural-language intents, artifact hand-off signatures (`accepts`, `produces`), discovery weights, and 24×24 SVG icons.
- **`kinds.js`**: Standardizes universal artifact kinds (`text`, `json`, `csv`, `yaml`, `markdown`, `code`, `uml`, `flowchart`, `svg`, `html`). Defines home page task groupings (`files`, `numbers`, `writing`, `lookup`, `everyday`, `law`, `design`, `code`).
- **`schema.js`**: Strict validation rules for every tool definition. Runs structural sanity checks (`validateRegistry`) in development and production to prevent orphaned tools, duplicate IDs, or missing categories.

### B. Shell & Dynamic Loading Lifecycle (`js/app.js`)
- **Routing**: Client-side hash routing (`#<tool-id>`, `#home`, `#tools`, `#saved`, `#spaces`, `#support`).
- **Dynamic Imports**: Uses `import.meta.glob('./tools/*.js')`. Chunks are requested only when a user navigates to the tool.
- **Lifecycle Management**:
  1. `teardownTool()`: Calls `destroy()` on active instances, revokes ObjectURLs, closes WebGL renderers, stops Web Audio oscillators/contexts, and clears timeouts.
  2. `openTool(id)`: Mounts a fresh DOM container, calls `render(container, context)`, and mounts the universal Artifact Strip if the tool exports `getArtifact()` and declares `produces`.

### C. Universal Artifact Hand-off System (`js/lib/artifacts.js`, `js/lib/artifact-ui.js`)
- Enables zero-coupling inter-tool data hand-offs (`Open in...`). For example:
  - CSV generated in `timesheet` -> opened in `csv-to-json`.
  - JSON in `jwt-decoder` -> opened in `json-formatter`.
  - Markdown brief in `case-digest` -> opened in `markdown-preview`.
- Saves artifacts locally in `localStorage` without cloud accounts.
- Exports clean files with matching MIME types.

### D. Spaces: Peer-to-Peer Collaborative Desks (`js/lib/space-engine.js`, `js/views/spaces.js`)
- Built on `Yjs` CRDTs (Conflict-free Replicated Data Types) and `y-webrtc`.
- Ephemeral mesh networking: Peers connect directly via WebRTC DataChannels using encrypted signaling rooms.
- Collaborative workspaces include synchronized task boards, shared artifacts, discussion chat, and live notepads. Zero room data is permanently retained on central servers.

### E. 3D WebGL Pipeline (`js/lib/viewer3d.js`)
- Three.js WebGL renderer configured with hardware shadow mapping, studio three-point lighting, and clipping planes.
- DRACO-compressed glTF loaders for sub-megabyte 3D anatomical and modular container assets.
- Emissive highlight system (`select(mesh)`): 0ms zero-allocation highlight tinting running at a rock-solid 60 FPS without CPU geometry tessellation.

### F. Image & PDF Processing Pipelines
- **Exemplar-Based Inpainting (`watermark-remover.js`)**: Criminisi patch synthesis with isophote gradient continuation to reconstruct underlying image structures, textures, and lines without smudging.
- **High-DPI PDF Rasterization & Manipulation (`pdf-editor-engine.js`, `legal-pdf.js`)**: Dynamic on-demand loading of `pdfjs-dist` and `pdf-lib` for Bates stamping, redaction, and merging.

---

## 3. Security, Privacy & Permissions

- **100% Client-Side Processing**: Offline tools never make network requests.
- **Zero Central Telemetry**: No third-party trackers (Google Analytics, Mixpanel, etc.).
- **Permissions**: Audio context is initialized only upon user gesture (e.g. clicking Play in `tuner` or `metronome`). Camera access in `qr-generator` is strictly opt-in and bound to local canvas video stream.
