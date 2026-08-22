# Voltix & Toolbox Integration Architecture Guide

This guide defines the architectural bridge, shared protocols, data contracts, and maintainability standards between **Toolbox** and the **Voltix** application ecosystem.

---

## 1. Ecosystem Relationship & Principles

Toolbox functions as the core offline utility and algorithmic engine for the Voltix ecosystem:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Voltix Application Suite                     │
│    (Workspaces · Business Workflows · Analytics · ERP Hub)      │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        │        Shared Data Contracts & Artifacts      │
        │   (Standard JSON, Mermaid, Markdown, GeoJSON) │
        └───────────────────────┬───────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                        Toolbox Engine                           │
│  (80+ Offline Processing Tools · WebRTC Spaces · 3D Viewer)     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Standardized Artifact Data Contracts

When integrating tools with Voltix workflows, data interchange follows standard JSON schemas:

### A. Case Digests & Legal Briefs (`kind: 'markdown'` / `kind: 'json'`)
```json
{
  "version": "1.0",
  "type": "case-digest",
  "caseTitle": "Appellants v. Respondents",
  "court": "Supreme Court of Nigeria",
  "suitNo": "SC.123/2024",
  "year": "2024",
  "facts": "...",
  "issues": ["Whether the trial court had jurisdiction..."],
  "holding": "Appeal dismissed.",
  "ratioDecidendi": "...",
  "authorities": ["..."]
}
```

### B. Architectural Floor Plans (`kind: 'json'`)
```json
{
  "version": "1.0",
  "units": "meters",
  "elements": [
    { "id": "wall-1", "type": "wall", "x": 100, "y": 100, "x2": 400, "y2": 100, "thickness": 8 },
    { "id": "door-1", "type": "door", "x": 250, "y": 100, "width": 40, "rotation": 0 },
    { "id": "room-1", "type": "room", "x": 100, "y": 100, "width": 300, "height": 200, "label": "Office" }
  ]
}
```

### C. Container Quotations & Bills of Quantities (`kind: 'json'`)
```json
{
  "version": "1.0",
  "type": "container-quote",
  "unitType": "20ft High Cube",
  "items": [
    { "description": "Wall Partitioning (Neoterm 50mm)", "quantity": 24, "unit": "sqm", "unitPrice": 45.0, "total": 1080.0 }
  ],
  "subtotal": 1080.0,
  "tax": 81.0,
  "total": 1161.0
}
```

---

## 3. WebRTC Spaces Integration

Voltix users can join collaborative Toolbox sessions via URL room codes:
- **URL Format**: `https://toolbox.domain/#spaces/<ROOM_CODE>`
- **Direct Artifact Deep Link**: `https://toolbox.domain/#spaces/<ROOM_CODE>/artifacts`
- **Signaling Compatibility**: Standard `y-webrtc` multi-room signaling matrix.

---

## 4. Long-Term Maintainability & Engineering Standards

1. **No External Server Dependencies for Core Tools**: Never introduce cloud API dependencies to tools designated offline.
2. **Backward Compatibility**: Any future changes to `localStorage` keys or artifact schemas must maintain migration fallbacks.
3. **Zero Direct Cross-Tool Coupling**: Tool modules must never import other tool modules directly; all inter-tool communication must flow through the Universal Artifact Strip (`kinds.js` / `artifacts.js`).
