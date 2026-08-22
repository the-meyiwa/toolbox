# Toolbox Architecture Guide

This document describes the architectural foundation, subsystem boundaries, data flow, and runtime principles of **Toolbox**.

---

## 1. Architectural Overview

Toolbox is architected as an offline-first, client-side Single Page Application (SPA) powered by standard ES Modules (ESM) and Vite.

```
┌─────────────────────────────────────────────────────────────┐
│                       Toolbox Shell                         │
│   (HTML5 / CSS / SPA Hash Router / Command Palette / Tips)  │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
       ┌───────▼────────┐             ┌────────▼────────┐
       │ Tool Registry  │             │ Artifact Layer  │
       │ (tools.js /    │             │ (artifacts.js / │
       │  kinds.js)     │             │  artifact-ui)   │
       └───────┬────────┘             └────────┬────────┘
               │                               │
       ┌───────▼───────────────────────────────▼────────┐
       │             Tool Modules (js/tools/*)          │
       │  (Dynamic import on demand via Vite ESM)       │
       └───────┬───────────────────────────────┬────────┘
               │                               │
       ┌───────▼────────┐             ┌────────▼────────┐
       │ Engine Helpers │             │  Spaces Engine  │
       │ (viewer3d,     │             │ (WebRTC / Yjs / │
       │  file-engine,  │             │  Signaling P2P) │
       │  pdf-engine)   │             │                 │
       └────────────────┘             └─────────────────┘
```

---

## 2. Core Subsystems

### A. Single Source of Truth Registry (`js/registry/`)
- **`tools.js`**: Every tool's identity, taxonomy, categorization, search intents, keywords, and metadata reside here. Tools never define their own discovery metadata.
- **`kinds.js`**: Universal artifact kinds (`text`, `json`, `csv`, `yaml`, `markdown`, `code`, `uml`, `flowchart`, `svg`, `html`). Defines what a tool *produces* and *accepts*, enabling zero-coupling inter-tool handoffs.
- **`schema.js`**: Strict validation rules for tool registry metadata.

### B. Shell & Dynamic Loading (`js/app.js`)
- Hash-based routing (`#<tool-id>`, `#home`, `#tools`, `#saved`, `#spaces`, `#support`).
- Dynamic code splitting using Vite's `import.meta.glob('./tools/*.js')`. Each tool is packaged into an isolated chunk and fetched only upon access.
- Container cleanup lifecycle: On tool navigation, `teardownTool()` invokes `destroy()` on active instances, drops event listeners, unmounts WebGL renderers, and disposes worker threads.

### C. Artifact Strip & Local Storage (`js/lib/artifacts.js`, `js/lib/artifact-ui.js`)
- Universal save & hand-off system mounted at the bottom of any tool declaring `produces` and `getArtifact()`.
- Supports saving to `localStorage` (browser-isolated), instant file export, direct handover to compatible tools (`Open in...`), and sharing to collaborative Spaces.

### D. Spaces: Peer-to-Peer Collaborative Desks (`js/lib/space-engine.js`, `js/views/spaces.js`)
- Real-time collaboration over WebRTC mesh via `yjs` and `y-webrtc`.
- Shared persistent rooms featuring live activity stream, shared artifacts, discussion chat, task boards, and synchronized notepads.
- Ephemeral, encrypted signaling; no user content is permanently stored on central servers.

### E. 3D WebGL Visualization Pipeline (`js/lib/viewer3d.js`)
- Standardized Three.js scene coordinator with OrbitControls, directional studio lighting, shadow mapping, clipping planes, and picking raycasters.
- DRACO-compressed glTF loaders for sub-megabyte anatomical and container models.
- High-performance selection and emphasis: instantaneous emissive tinting that runs at 60 FPS without CPU-bound geometry recreation.

---

## 3. Key Design Decisions

1. **Pure ESM with Zero Bundler Magic**: Modern browsers natively parse modules. Build output is lean and standard.
2. **Local Processing**: Heavy file operations (PDF merging/annotation, image compression, content-aware inpainting, and audio synthesis) leverage Canvas, WebGL, and Web Workers without cloud round-trips.
3. **Graceful Degradation & Fallbacks**: Tools designed for complex files (e.g. Architecture Editor, Watermark Remover) provide simple manual controls when heuristic automation encounters edge-case input.
