# Toolbox Implementation & Tool Reference Guide

This document is the exhaustive engineering reference for implementing, extending, and maintaining all tools in **Toolbox**.

---

## 1. Tool Lifecycle & Contract

Every tool in `js/tools/<id>.js` exports a standard ESM object:

```javascript
export default {
  /**
   * Initializes and renders the tool.
   * @param {HTMLElement} container - Fresh container inside #viewport-content
   * @param {Object} context
   * @param {Object} [context.analytics] - Instrumentation handle (.started(), .completed(), .copied(), .downloaded())
   * @param {Object} [context.tool] - Registry entry
   * @param {Object} [context.artifact] - Incoming artifact if opened via 'Open in...'
   */
  async render(container, { analytics, tool, artifact } = {}) {
    // 1. Render DOM structure
    // 2. Attach event listeners
    // 3. Populate initial state or artifact data
  },

  /**
   * Returns current exportable artifact for Save / Download / Share to Space.
   * Required only if the tool declares `produces` in the registry.
   */
  getArtifact() {
    return {
      kind: 'text', // 'text'|'json'|'csv'|'yaml'|'markdown'|'code'|'uml'|'flowchart'|'svg'|'html'
      text: '...',
      name: 'export.txt',
    };
  },

  /**
   * Populates the tool when an artifact is handed off from another tool.
   */
  setArtifact(artifact) {
    // Fill input fields from artifact.text
  },

  /**
   * Invoked on navigation to release all resources.
   */
  destroy() {
    // Revoke ObjectURLs, disconnect Web Audio / WebRTC, clear intervals / workers
  }
};
```

---

## 2. Exhaustive Tool Directory (All Categories & Tools)

### A. Images & Files (`category: 'images-files'`)
1. **`image-compressor`**: Client-side JPEG/WebP compression with target file size, quality slider, and before/after comparison.
2. **`image-converter`**: Format converter between PNG, JPEG, WebP, AVIF, BMP, and ICO with batch download.
3. **`image-cropper`**: Touch-friendly crop box with aspect ratio presets (1:1, 16:9, 4:3, 3:2, Freeform).
4. **`image-resizer`**: High-quality Lanczos/bilinear image scaling with dimension and percentage locks.
5. **`image-metadata`**: EXIF & metadata inspector/stripper removing GPS, camera, and timestamp data.
6. **`watermark-remover`**: AI Text Watermark Remover using Criminisi exemplar texture synthesis and isophote gradient inpainting to cleanly reconstruct underlying textures, lines, and gradients without blur.
7. **`image-to-pdf`**: Converts batches of images into a single PDF document with custom margins and page formats.
8. **`pdf-merge`**: Concatenates multiple PDF files into one with drag-and-drop page reordering.
9. **`pdf-split`**: Splits PDFs into individual pages or custom ranges.
10. **`pdf-editor`**: In-browser PDF annotator, text injector, and signer.
11. **`document-analyzer`**: Reads text and metadata from PDF, DOCX, XLSX, and PPTX files.

### B. Text & Writing (`category: 'text'`)
12. **`text-cleaner` (Clean Text)**: Sanitizes invisible Unicode artifacts (ZWSP `\u200B`, ZWJ, BOM `\uFEFF`, soft hyphens, control characters, unusual whitespaces like NBSP) with live count pills and visual diffs.
13. **`word-counter`**: Real-time word, character, sentence, paragraph, reading time, and speaking time analyzer.
14. **`text-diff`**: Side-by-side and inline visual difference comparison for text, code, and documents.
15. **`case-converter`**: Transforms text between lowercase, UPPERCASE, Title Case, camelCase, snake_case, kebab-case, and CONSTANT_CASE.
16. **`find-replace`**: Batch regex search and replace with match highlighting and multi-line modes.
17. **`remove-duplicates`**: De-duplicates line-separated lists with case-sensitivity and sorting options.
18. **`lorem-ipsum`**: Dummy text generator for paragraphs, sentences, words, and list items.
19. **`markdown-preview`**: Live dual-pane GitHub Flavored Markdown editor and HTML exporter.

### C. Developer & Code (`category: 'developer'`)
20. **`code-playground`**: In-browser sandboxed code runner for JavaScript, Python (Pyodide), SQLite, Lua, and HTML.
21. **`json-formatter`**: JSON validator, formatter, beautifier, and minifier with syntax tree view.
22. **`base64-codec`**: Encodes/decodes text and binary files to/from Base64 with padding options.
23. **`jwt-decoder`**: Decodes JSON Web Tokens (Header, Payload, Signature) with expiration validity checks.
24. **`regex-tester`**: Interactive regular expression debugger with group match inspector and cheat sheet.
25. **`html-entity-codec`**: Encodes/decodes HTML entities and special characters.
26. **`cron-parser`**: Explains, validates, and calculates upcoming execution runs for 5-part cron expressions.
27. **`uml-diagram`**: Text-to-UML sequence, class, and state diagram generator powered by Mermaid.js.
28. **`flowchart`**: Visual flowchart and workflow builder with SVG and PNG export.
29. **`algorithm-lab`**: Step-by-step visualizer for sorting (Quicksort, Mergesort) and search algorithms.
30. **`logic-lab`**: Interactive logic gate circuit designer (AND, OR, NOT, XOR, NAND).

### D. Numbers & Calculators (`category: 'numbers'`)
31. **`percentage-calculator`**: Calculates percentage increase/decrease, ratios, and proportion changes.
32. **`unit-converter`**: Converts lengths, masses, temperatures, volumes, pressures, and energy units.
33. **`number-base-converter`**: Live conversion between Binary, Octal, Decimal, Hexadecimal, and custom bases.
34. **`business-days`**: Calculates working days, weekends, and holidays between dates.
35. **`timestamp-converter`**: Converts Unix epoch timestamps (seconds, milliseconds) to human-readable dates.
36. **`concrete-estimator`**: Computes concrete volume, slab/footing yardage, and cement bag counts.
37. **`beam-calculator`**: Calculates structural beam bending moments, shear forces, and deflections.
38. **`voltage-drop`**: Calculates electrical cable voltage drops and wire gauge requirements.
39. **`ohms-law`**: Solves electrical power, voltage, current, and resistance equations.
40. **`resistor-code`**: Decodes 4, 5, and 6-band color resistor values and tolerances.

### E. Business & Finance (`category: 'business'`)
41. **`invoice-generator`**: Generates and downloads printable client invoices with itemized totals and tax calculations.
42. **`margin-markup`**: Calculates cost, selling price, gross margin, markup percentage, and profit.
43. **`compound-interest`**: Computes investment growth, interest compounding, and periodic contribution projections.
44. **`amortization-schedule`**: Loan and mortgage repayment schedule breakdown (Principal vs Interest).
45. **`depreciation-calculator`**: Asset depreciation schedules (Straight-line, Declining balance, Sum-of-years).
46. **`break-even`**: Computes break-even volume, fixed vs variable costs, and revenue targets.
47. **`unit-economics`**: Analyzes Customer Acquisition Cost (CAC), Lifetime Value (LTV), and payback periods.
48. **`runway-calculator`**: Calculates startup cash runway, monthly burn rate, and zero-cash dates.
49. **`cap-table`**: Equity dilution and shareholder capitalization table modeler.
50. **`npv-irr`**: Calculates Net Present Value and Internal Rate of Return for cash flow projections.
51. **`salary-converter`**: Converts between hourly, daily, weekly, monthly, and annual salaries.
52. **`vat-calculator`**: Gross, net, and value-added tax breakdown for global tax rates.
53. **`pto-accrual`**: Paid time off accrual rate and balance tracker.
54. **`payroll-cost`**: Computes total employer payroll costs including taxes, benefits, and levies.
55. **`meeting-cost`**: Live real-time meeting cost ticker based on attendee salaries and duration.
56. **`subscription-analyzer`**: Annualized recurring software and subscription expense tracker.
57. **`timesheet`**: Employee time and attendance logger with CSV export.

### F. Law & Legal Practice (`category: 'law'`)
58. **`case-digest`**: Structured case brief generator extracting Case, Court, Facts, Issues, Arguments, Holding, Ratio Decidendi, Authorities, and Timeline, featuring an "Explain Simply" layperson mode.
59. **`case-comparator`**: Side-by-side comparative precedent matrix evaluating Facts, Holdings, Ratio Decidendi, and Precedential Relationships (Followed, Distinguished, Overruled).
60. **`legal-document-analyzer`**: Extracts contracting parties, effective dates, key covenants, defined terms, liabilities, and termination clauses from agreements and statutes.
61. **`legal-research`**: Structures legal research problems into primary/secondary issues, doctrinal tests, verified Boolean queries (LawPavilion, BAILII, CanLII), and authority matrices.
62. **`legal-pdf`**: Court document bundling, sequential Bates stamping (e.g. `PAGE-001`), confidential text redaction, and court e-filing size optimization.

### G. Design & Modeling (`category: 'design'`, `'modeling'`)
63. **`color-converter`**: Live HEX, RGB, HSL, HSV, and CMYK color space converter.
64. **`color-palette-generator`**: Random harmonic palette generator with lockable color swatches.
65. **`aspect-ratio`**: Calculates dimensions, scaling, and standard display aspect ratios (16:9, 4:3, 21:9).
66. **`contrast-checker`**: WCAG 2.1 AAA/AA color contrast compliance analyzer.
67. **`container-planner`**: Interactive 3D shipping container and portacabin conversion planner with live BOQ pricing.
68. **`anatomy-explorer`**: High-performance 3D anatomical atlas with DRACO models, cross-section clipping, and clinical notes.
69. **`architecture-editor`**: Mobile-first architectural floor plan editor with automated wall/opening detection, touch handles, and PDF export.

### H. Security, Networking, Music & Everyday (`category: 'security'`, `'networking'`, `'music'`, `'everyday'`, `'reference'`)
70. **`password-generator`**: High-entropy cryptographic password generator (runs strictly offline; no artifact export).
71. **`file-hash`**: SHA-256, SHA-1, SHA-512, MD5 client-side file checksum verifier.
72. **`hash-generator`**: Text hashing utility for cryptographic digests and HMACs.
73. **`uuid-generator`**: Generates RFC4122 v4 UUIDs, v1 UUIDs, and ULIDs.
74. **`qr-generator`**: QR code generator and camera barcode scanner.
75. **`email-signature`**: HTML email signature builder with live preview.
76. **`ip-lookup`**: IP address geolocation, ASN, and network lookup.
77. **`interactive-map`**: Offline-ready interactive world map with distance and coordinate calculators.
78. **`speed-test`**: Client-side network bandwidth and latency measurement.
79. **`weather-forecast`**: Real-time global weather and temperature forecasts.
80. **`currency-exchange`**: Live exchange rates and currency converter.
81. **`tuner`**: Chromatic instrument tuner using microphone Web Audio API pitch detection.
82. **`metronome`**: Precise Web Audio metronome with BPM tempo presets and tap tempo.
83. **`chord-finder`**: Musical chord dictionary with guitar and piano voicing diagrams.
84. **`tempo-delay`**: Audio delay time and reverb pre-delay calculator synchronized to BPM.
85. **`timer`**: Stopwatch and countdown timer with laps and audio chime.
86. **`dictionary`**: Word definition, etymology, and synonym lookup.
87. **`wiki`**: Fast distraction-free encyclopedia search and article viewer.
88. **`bible`**: Scriptural reference and multi-translation verse search.
89. **`quran`**: Arabic text, English translations, and surah navigation.

---

## 3. How to Add a New Tool: Step-by-Step

1. **Add entry in `js/registry/tools.js`**: Specify `id`, `name`, `description`, `category`, `keywords`, `intents`, `weight`, and `icon`.
2. **Create implementation file in `js/tools/<id>.js`**: Implement `render(container, context)`, `getArtifact()`, and `destroy()`.
3. **Run validation and build**:
   ```bash
   npm run build
   ```
4. **Ensure clean teardown**: Verify that all listeners, audio contexts, and workers disconnect cleanly in `destroy()`.
