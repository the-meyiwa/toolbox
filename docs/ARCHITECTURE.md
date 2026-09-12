# Toolbox System Architecture Guide

This document serves as the canonical technical and architectural reference for **Toolbox**.

---

## 1. High-Level System Architecture

Toolbox is architected as an offline-first, sovereign client-side Single Page Application (SPA) utilizing native ECMAScript Modules (ESM) and Vite for zero-bundler development and optimal production tree-shaking and code splitting:

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                      Toolbox Shell                                      │
│         (index.html · CSS Design System · Hash Router · Mobile Floating Island)         │
└──────────────┬────────────────────────────┬────────────────────────────┬────────────────┘
               │                            │                            │
     ┌─────────▼──────────┐       ┌─────────▼──────────┐       ┌─────────▼──────────┐
     │ Registry Subsystem │       │ Virtual Filesystem │       │    AI Assistant    │
     │ - tools.js         │       │ (ToolboxFilesystem)│       │    Orchestrator    │
     │ - kinds.js         │       │ - IndexedDB / OPFS │       │ - Multi-Model AI   │
     │ - Visibility Filter│       │ - PKZIP Archival   │       │ - Tool Dispatch    │
     │   (getVisibleTools)│       │ - StatSync Cache   │       │ - Structured Rndr  │
     └─────────┬──────────┘       └─────────┬──────────┘       └─────────┬──────────┘
               │                            │                            │
┌──────────────▼────────────────────────────▼────────────────────────────▼────────────────┐
│                           Universal Presentation & Interaction Layer                    │
│      (Saved Explorer · Code Playground IDE · Spaces P2P · About Showcase · Modals)      │
└──────────────┬────────────────────────────┬────────────────────────────┬────────────────┘
               │                            │                            │
     ┌─────────▼──────────┐       ┌─────────▼──────────┐       ┌─────────▼──────────┐
     │ Tier 1 & 2 Local   │       │ Tier 3 Sandboxed   │       │ Tier 4 Hybrid      │
     │ Execution Runtimes │       │ Workspaces (IDE)   │       │ Cloud Intelligence │
     │ - JS/TS/Canvas/V8  │       │ - React 18 / Babel │       │ - Gemini 2.5 API   │
     │ - Pyodide WASM     │       │ - Vitest Runner    │       │ - DoH DNS Engine   │
     │ - SQLite3 / Lua    │       │ - Isolated iframe  │       │ - Cloud Sync Vault │
     └────────────────────┘       └────────────────────┘       └────────────────────┘
```

---

## 2. Core Architectural Principles

All development in Toolbox strictly adheres to the following core tenets:

1. **One Source of Truth**:
   Every domain has a single authoritative owner. The declarative registry (`js/registry/tools.js`) owns tool definitions and discovery taxonomy; `getVisibleTools` in `js/app.js` is the single source of truth for tool visibility across all viewports; `ToolboxFilesystem` (`js/lib/filesystem.js`) owns stored files; `artifacts.js` owns cross-tool handoff items; and user session state is governed exclusively by `supabase.js`. Competing registries, duplicate stores, and parallel state mechanisms are strictly prohibited.

2. **Extend Existing Systems**:
   When a capability exists (e.g., file archiving, mathematical computation, code execution, dialogs, audio processing), features and the AI Assistant build on and reuse the existing abstraction rather than creating shadow implementations.

3. **Separation of Responsibilities**:
   - **UI Layer** (`js/views/*`): Presentation, user interactions, DOM event listeners, and responsive layout.
   - **Tool Modules** (`js/tools/*`): Self-contained user-facing functional tools providing `render()` and optional `destroy()`/`setArtifact()`/`getArtifact()` lifecycle hooks.
   - **Core Engines & Libraries** (`js/lib/*`): Pure algorithmic, runtime, computational, network, and storage capabilities isolated from direct DOM assumptions.
   - **Assistant Orchestrator** (`js/tools/assistant.js`, `js/lib/ai-provider.js`): Coordinates capabilities and understands intent; it operates Toolbox capabilities and never duplicates domain computation internally.

4. **Abstractions Over Implementation Details**:
   User-facing components and copy communicate capabilities and outcomes rather than leaking internal technologies (e.g., "Save to Files", "Cloud Vault Sync", "Create a folder", "Sign in" instead of naming backend tables, storage buckets, or database primitives).

5. **Structured Results Before Rendering**:
   Tools and engines return structured, machine-readable data objects. Presentation layers and the Assistant result renderer (`assistant-result-renderer.js`) consume these structures to produce specialized visualizations (charts, tables, maps, audio cards, mathematical formulas).

6. **Device-Aware Access & Physical Ergonomics**:
   Interfaces adapt intentionally to device physical constraints. Mobile surfaces feature touch-and-hold interaction with jitter filtering, haptic feedback, and decoupled tap targets, while preserving complete feature parity on desktop displays.

7. **Restrained Minimalism & Accessibility**:
   Toolbox uses functional, intentional minimalism. Strictly zero emojis are used in the UI. All interactive elements have consistent disabled states (`opacity: 0.5; cursor: not-allowed;`), visible `:focus-visible` rings for WCAG 2.1 AAA compliance, and standard keyboard navigation (Escape dismissals, Spacebar previews, and focus restoration).

---

## 3. Subsystem Deep-Dives

### A. Declarative Tool Registry Subsystem (`js/registry/`)
The registry is the authoritative catalog for all tools and discovery mechanics:
- **`tools.js`**: Central catalog declaring tool IDs, display names, concise descriptions, taxonomy categories, search tokens, natural language intent vectors, handoff signatures (`accepts`, `produces`), weights, and custom 24×24 SVG line icons.
- **`kinds.js`**: Defines standard artifact formats (`text`, `json`, `csv`, `yaml`, `markdown`, `code`, `uml`, `flowchart`, `svg`, `html`, `archive`, `image`, `pdf`) and home page functional task clusters (`files`, `numbers`, `writing`, `lookup`, `everyday`, `law`, `design`, `code`).
- **`schema.js`**: Enforces strict structural contracts on every tool definition (`validateRegistry`). Guarantees zero orphan tools, valid categories, valid aliases, and unique IDs at build and runtime.

### B. Shell, Routing & Mobile Access Control (`js/app.js`)
- **SPA Router**: Hash-based client routing (`#<tool-id>`, `#home`, `#tools`, `#saved`, `#files`, `#spaces`, `#about`, `#support`). Parses incoming query strings, password reset recovery tokens, and authentication redirects.
- **Centralized Tool Visibility (`getVisibleTools`)**:
  - Single authoritative function that evaluates user authentication status and viewport dimensions (`isMobile = window.innerWidth <= 768`).
  - Completely gates heavy multi-window desktop environments (such as `code-playground`) on mobile viewports for signed-out users across the tool grid, search results, recommendations, quick links, and command palette.
  - Direct route guard in `openTool`: Redirects unauthorized mobile accesses to `#tools` with user-facing guidance.
  - Desktop viewports ($> 768\text{px}$) retain full immediate unauthenticated access to all developer tools.
- **Mobile Navigation Island**:
  - Floating pill navigation bar with fluid physics indicator (`updateMobileNavIndicator`).
  - Interactive sticky category chip bar with smooth anchor scrolling and micro-haptics.
- **Dynamic ESM Loading & Teardown**:
  - Leverages Vite's `import.meta.glob('./tools/*.js')` for code splitting.
  - `teardownTool()`: Calls `destroy()` on active instances, cancels background intervals and workers, revokes ObjectURLs, cleans WebGL contexts, and releases audio nodes before mounting the next tool.

### C. Virtual Filesystem (VFS) & Browser File Explorer (`js/lib/filesystem.js`, `js/views/saved.js`, `js/lib/archive-engine.js`)
Toolbox provides a complete hierarchical filesystem operating in the browser:
- **Dual-Tier Storage Architecture**:
  - **Offline / Local**: IndexedDB backed with an in-memory synchronous index (`statSync`, `listSync`, `getTags`) ensuring zero-latency reads and instantaneous UI responsiveness.
  - **Online**: Seamless synchronization with Supabase Storage for authenticated users.
- **Mac Finder / Nautilus OS Paradigm (`js/views/saved.js`)**:
  - Dual layout modes: Split list/detail, Grid view, and Detailed list view.
  - Multi-Selection: `Ctrl`/`Cmd`+click and `Shift`+click support selecting multiple files simultaneously.
  - Multi-File Context Menus: Right-clicking or long-pressing on multiple selected files provides batch operations (Cut, Copy, Multi-Item Properties aggregation, Batch Tagging, Batch ZIP Download, and Batch Delete).
  - Pure JS PKZIP Engine (`js/lib/archive-engine.js`): RFC 1951 Deflate/Inflate implementation in browser JS with CRC-32 checksum calculation for non-blocking ZIP compression and extraction.
- **Mobile Touch-and-Hold Interaction Model**:
  - Jitter-Guarded Long-Press ($450\text{ms}$): Microscopic finger movements ($< 8\text{px}$ displacement) are filtered out, preventing accidental cancellation during touch hold.
  - Physical Feedback (`.sv-touch-active`): Visual compression (`scale(0.985)`) on touch-down provides immediate tactile response.
  - Micro-Haptics: Fires tactile vibration (`navigator.vibrate?.(25)`) upon menu trigger.
  - Click-Through Suppression: `isLongPressTriggered` suppresses trailing click events on finger release, preventing unintentional navigation or selection toggles.

### D. Code Playground IDE & Multi-Language Execution (`js/tools/code-playground.js`, `js/lib/code-runtimes.js`, `js/lib/remote-compile.js`, `js/lib/npm-client.js`)
A comprehensive browser-based developer environment:
- **UI Architecture**:
  - Desktop menu bar (File, Edit, View, Run, Test).
  - Multi-tab editor with line numbering gutter and mini-map.
  - Sidebar file tree supporting context menus (New File, New Folder, Rename, Delete) for files, tabs, and canvas space.
  - Command palette (`Ctrl+K` / `Cmd+K`) and dedicated Dark/Light IDE modes independent of parent app themes.
- **Multi-Tier Execution Engine**:
  - In-browser Web Worker sandboxes with timeout protection:
    - JavaScript & TypeScript (in-browser transpilation via TypeScript compiler).
    - Python 3 (Pyodide WebAssembly runtime).
    - SQLite / SQL (SQL.js WebAssembly).
    - Lua (Wasmoon WebAssembly).
    - C++ (in-browser JSCPP runtime).
    - Web Application / HTML Sandbox (live sandboxed `iframe` with `srcdoc`, React 18, Babel JSX, and Vitest test runner).
  - Remote Compilation Engine (`remote-compile.js`): Compiles Rust, Go, Java, C#, C, Swift, Kotlin, PHP, Ruby, Bash, Haskell, and Zig via secure sandboxed backend runners.
  - Dynamic NPM Package Imports (`npm-client.js`): Resolves dependencies from the official NPM registry and builds standard ESM import maps for browser execution.

### E. AI Assistant & Autonomous Tool Orchestration Subsystem (`js/tools/assistant.js`, `js/lib/ai-provider.js`, `js/lib/assistant-tools.js`, `js/lib/assistant-result-renderer.js`)
Toolbox integrates an autonomous AI Assistant operating as a pure orchestrator:
- **Multi-Model Intelligence**: Native integration with Google Gemini (`gemini-2.5-flash` / `gemini-2.5-pro`).
- **Autonomous Multi-Step Tool Dispatch**: Plans and calls registered tools in sequence (e.g. searching the web, calculating formulas, generating charts, manipulating files, and saving results to the VFS).
- **Destructive Action Guardrails**: Actions affecting persistent data (`delete_file`, disk writes) require user confirmation before committing.
- **Decoupled Composer Ergonomics**:
  - Textarea and Send button are decoupled with a deliberate `8px` gap, independent `20px` border-radii, and optical alignment.
- **Structured Result Renderers (`assistant-result-renderer.js`)**:
  - Mathematical equations (rendered formulas with KaTeX).
  - Audio and voice cards (synthesizers and streams via `assistant-audio.js`).
  - Interactive vector maps (Leaflet-based with waypoints).
  - Network and DNS lookups (formatted lookup tables).
  - Financial models, speed tests, and artifact links.

### F. Spaces: Ephemeral Peer-to-Peer Desks (`js/lib/space-engine.js`, `js/views/spaces.js`)
- **WebRTC Mesh Networking**: Connects peers directly using WebRTC DataChannels over encrypted signaling rooms without intermediate servers.
- **Yjs CRDT Synchronization**: Shared states (collaborative notepads, synchronized task boards, shared artifacts, real-time discussion) converge deterministically without merge conflicts.
- **Zero-Knowledge Ephemeral Rooms**: Room state exists purely in participant memory and dissolves completely once all participants leave.

### G. 3D WebGL Pipeline & Media Manipulation (`js/lib/viewer3d.js`, `watermark-remover.js`, `pdf-editor-engine.js`)
- **Three.js WebGL Engine**: Hardware-accelerated 3D viewport configured with studio three-point lighting, shadow maps, and cross-section clipping planes.
- **DRACO Compressed glTF Loading**: High-density 3D anatomical models and modular container geometry packed into sub-megabyte payloads.
- **Exemplar Patch Inpainting (`watermark-remover.js`)**: Criminisi algorithm implementation running client-side on HTML5 Canvas to reconstruct image structures and textures cleanly.
- **PDF Manipulation Pipeline (`pdf-editor-engine.js`, `legal-pdf.js`)**: High-DPI page rasterization via PDF.js with Bates stamping, redaction overlays, and document merging via `pdf-lib`.

### H. Authentication, Passkeys & Avatar Identity Subsystem (`js/lib/supabase.js`, `js/views/account-modal.js`, `js/lib/profile-pictures.js`)
- **Authentication Providers**: Supabase Auth backing Email/Password, Magic Link, OAuth (Google, GitHub), and FIDO2/WebAuthn Passkeys.
- **Accessible Modal Lifecycle**: Full trap management, previous active element focus restoration (`previousFocus`), and keyboard Escape dismissal.
- **Character Avatar Identity System**: 31 character personas with deterministic IDs, SVG/image markup, and zero-emoji profile pictures.
- **Client Privacy Boundary**: Zero analytics beacons, zero user tracking scripts, and offline-first execution defaults.

### I. Theming, Design Tokens & Linux Desktop Aesthetic (`css/style.css`, `js/lib/theme.js`)
- **9 Canonical Palettes**:
  1. `default`: Swiss monochrome with flat matte cards.
  2. `white-on-black`: High-contrast dark mode with 1px hairline borders (`#222222`).
  3. `burgundy`: Royal wine subtle vertical gradient (`linear-gradient(180deg, #220817 0%, #12030c 100%)`).
  4. `cozy-pink`: Soft blush pastel with clean white cards.
  5. `solar-blue`: Deep sapphire midnight subtle gradient (`linear-gradient(180deg, #09152e 0%, #040916 100%)`).
  6. `nocturne-blue`: Twilight slate subtle gradient (`linear-gradient(180deg, #131d35 0%, #0c1322 100%)`).
  7. `alpine-green`: Evergreen pine forest subtle gradient (`linear-gradient(180deg, #0d271d 0%, #06140e 100%)`).
  8. `canary-yellow`: High-contrast industrial obsidian with vivid canary neon.
  9. `espresso`: Dark roasted coffee subtle gradient (`linear-gradient(180deg, #231914 0%, #140d0a 100%)`).
- **Linux Desktop (Mint / Ubuntu) Aesthetic**:
  - Flat matte surfaces with subtle tactile gradients.
  - Standardized button dimensions: 40px base height, 32px `.btn-sm`, 36px/38px icon buttons.
  - Global `:disabled` states (`opacity: 0.5 !important; cursor: not-allowed !important;`).
  - High-visibility keyboard focus rings (`:focus-visible`).
  - Segmented sliders with smooth sliding pill animations.
  - Zero decorative emojis; all iconography uses scalable SVG line vectors.

### J. Engineered Product Showcase & Capabilities Pipeline (`index.html`, `js/app.js`, `css/style.css`)
- **4-Stage Architecture Pipeline**:
  - `01 Ingest`: Universal drag-and-drop & clipboard pipes via memory-mapped streams and zero-copy ArrayBuffers.
  - `02 Compute`: Sandboxed execution via Pyodide WASM, SQLite3 WASM, Lua 5.4, and Web Workers.
  - `03 Virtual FS`: Fast in-memory synchronous stat cache backed by IndexedDB and OPFS with CRC-32 PKZIP archival.
  - `04 Handoff`: Seamless cross-tool artifact handoff protocol and encrypted cloud vault sync.
- **Capabilities Matrix**:
  - **Tier 1 (Pure Local)**: 0 bytes sent, $\le 1\text{ms}$ latency, 100% offline.
  - **Tier 2 (WASM Sandboxes)**: In-browser micro-runtimes cached in CacheStorage and executed in isolated workers.
  - **Tier 3 (Project IDE)**: Isolated multi-file workspaces with React 18, Babel standalone, and Vitest test runner.
  - **Tier 4 (Cloud Hybrid)**: Opt-in network requests with transparent query isolation (Gemini AI, DoH DNS, currency rates).
- **Flutterwave Contribution Engine (`js/lib/flutterwave-contribution.js`)**:
  - Standard inline checkout integration supporting multi-currency contributions (NGN, USD, CAD, GBP).

---

## 4. Data Ownership & Storage Hierarchy

| Subsystem | Authoritative Owner | Storage Medium | Lifecycle |
| :--- | :--- | :--- | :--- |
| **Files & Folders** | `ToolboxFilesystem` (`filesystem.js`) | IndexedDB / Cloud Sync | Persistent across sessions |
| **Tool Taxonomy** | `Registry` (`tools.js`, `kinds.js`) | Static ESM Definition | Immutable at runtime |
| **Tool Visibility** | `getVisibleTools` (`js/app.js`) | In-Memory Reactive State | Reactive to Auth & Viewport resize |
| **Artifact Handoffs**| `store` (`artifacts.js`) | `localStorage` (`tb_artifacts_v1`) | User-managed |
| **Playground Workspaces** | Code Playground (`code-playground.js`) | `localStorage` (`toolbox_cpg_workspaces_v2`) | User-managed |
| **Collaborative Spaces** | `SpaceEngine` (`space-engine.js`) | Memory (Yjs CRDT via WebRTC) | Ephemeral (destroyed on room exit) |
| **User Identity** | Supabase Auth (`supabase.js`) | Secure Local Session Tokens | Session / Permanent until sign-out |
| **Theme & Settings** | `ThemeEngine` & `Settings` | `localStorage` | Persistent across sessions |

---

## 5. Verification & Testing

Every architectural change and tool addition is validated across the test suite:

```powershell
# Build validation (Rollup tree-shaking & chunking)
npm run build

# Comprehensive test suite (Node test runner, 474+ tests)
npm run test
```

Toolbox enforces zero regression tolerance across:
- Schema conformity and taxonomy integrity.
- Sanitization and XSS security filters.
- Runtime execution containment.
- Virtual filesystem operations (stat, list, write, rename, delete).
- UI component accessibility and emoji prohibition.
