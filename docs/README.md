# Toolbox Documentation & Implementation Guides

Welcome to the technical documentation and developer guides for **Toolbox** and the **Voltix** ecosystem.

## Documentation Index

- **[Architecture Guide](ARCHITECTURE.md)**: High-level system architecture, design philosophy (*"Local by default. Shared by intention."*), core subsystems (Shell, Registry, Artifacts, Spaces, 3D Viewer), and state management.
- **[Tool Implementation Guide](IMPLEMENTATION_GUIDE.md)**: Step-by-step developer guide for adding and extending tools, UI patterns, canvas & image engines, WebRTC workflows, and performance rules.
- **[Voltix Integration Guide](VOLTIX_INTEGRATION_GUIDE.md)**: Architectural alignment, shared data contracts, cross-platform integrations, design language consistency, and long-term maintainability standards.

---

## Core Philosophy

1. **Local by default. Shared by intention.**
   Every tool runs directly on the user's device in standard Web APIs (Canvas, WebGL, Web Audio, WebAssembly, WebRTC). Zero personal data is sent to external servers unless the user explicitly collaborates via Spaces.

2. **Many capabilities, few concepts, no manual required.**
   No signup, no tracking, no multi-step wizard setups. Open the tool, perform the task, download or share the result, close the tab.

3. **Restrained, Swiss-inspired design language.**
   High contrast, intentional typography (`Inter`, `JetBrains Mono`, `Pixelify Sans`), clear visual hierarchies, and fast 60 FPS interactions.
