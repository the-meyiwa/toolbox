# Toolbox & Voltix Canonical Product & Engineering Documentation

Welcome to the canonical engineering guide, architectural blueprint, and complete product reference for **Toolbox** and the **Voltix** application suite.

---

## Documentation Structure

| Guide | Scope & Content |
| :--- | :--- |
| **[Architecture Guide](ARCHITECTURE.md)** | Core system architecture, SPA shell, ESM code splitting, hash router, state management, 3D WebGL pipeline, P2P WebRTC Spaces engine, privacy and security model. |
| **[Implementation & Tool Reference](IMPLEMENTATION_GUIDE.md)** | Exhaustive technical directory of all 75+ tools, algorithms, input/output kinds, UI paradigms, shared file/PDF engines, and extension guide. |
| **[Voltix Integration Guide](VOLTIX_INTEGRATION_GUIDE.md)** | Ecosystem alignment, shared data contracts (JSON schemas, artifacts), cross-platform workflows, WebRTC signaling protocols, and maintainability standards. |

---

## Core Product Principles

### 1. Local by Default. Shared by Intention.
All computing tasks — whether image inpainting, PDF pagination/redaction, 3D mesh rendering, text sanitization, or financial modeling — execute entirely on the user's device utilizing modern browser standards (`Canvas`, `WebGL`, `WebAssembly`, `Web Workers`, `Web Audio`). Zero personal files or pasted texts leave the client machine unless explicitly shared into collaborative WebRTC Spaces.

### 2. Many Capabilities, Few Concepts, No Manual Required.
Zero mandatory onboarding, zero paywalls, zero account registrations. The product philosophy favors immediate utility: open the tool, complete the task, save or hand off the artifact, and exit.

### 3. Restrained Swiss Design & 60 FPS Performance.
Clean, intentional typography (`Inter`, `JetBrains Mono`, `Pixelify Sans`), high contrast ratios (WCAG AAA compliant), responsive mobile-first layouts, and non-blocking asynchronous processing loops.
