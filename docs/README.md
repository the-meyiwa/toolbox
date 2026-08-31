# Toolbox Canonical Product & Engineering Documentation

Welcome to the canonical engineering guide, architectural blueprint, and complete product reference for **Toolbox**.

---

## Documentation Structure

| Guide | Scope & Content |
| :--- | :--- |
| **[Architecture Guide](ARCHITECTURE.md)** | Core system architecture, SPA shell, ESM code splitting, hash router, AI Assistant integration, Supabase Cloud Sync, and P2P WebRTC Spaces engine. |
| **[Implementation & Tool Reference](IMPLEMENTATION_GUIDE.md)** | Exhaustive technical directory of all 100+ tools, AI capability matrices, shared file/PDF engines, and extension guide. |
| **[Platform Integration Guide](INTEGRATION_GUIDE.md)** | Ecosystem alignment, shared data contracts (JSON schemas, artifacts), AI provider APIs (Gemini), WebRTC signaling protocols, and maintainability standards. |

---

## Core Product Principles

### 1. Local by Default. Shared by Intention.
All computing tasks — whether image inpainting, PDF pagination/redaction, code execution, text sanitization, or financial modeling — execute entirely on the user's device utilizing modern browser standards. Zero personal files or pasted texts leave the client machine unless explicitly shared into collaborative WebRTC Spaces, backed up to Supabase Cloud Sync (if the user opts-in), or sent securely to an API for specific online tools (e.g. Gemini AI, Weather, iTunes).

### 2. Autonomous AI Integration
Toolbox features a deeply integrated AI Assistant powered by Google Gemini. The Assistant can autonomously execute any of the 100+ tools, write and test code, save files to your workspace, create notes, and chain complex tasks together.

### 3. Many Capabilities, Few Concepts, No Manual Required.
Zero mandatory onboarding and zero paywalls. While optional accounts exist for cloud syncing, the product philosophy favors immediate utility: open the tool, complete the task, save or hand off the artifact, and exit.

### 3. Restrained Swiss Design & 60 FPS Performance.
Clean, intentional typography (`Inter`, `JetBrains Mono`, `Pixelify Sans`), high contrast ratios (WCAG AAA compliant), responsive mobile-first layouts, and non-blocking asynchronous processing loops.
