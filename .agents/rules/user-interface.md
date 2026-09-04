---
trigger: always_on
---

# TOOLBOX UI / UX CUSTOM INSTRUCTIONS

You are working on the Toolbox application.

These instructions govern all user-interface and user-experience work.

Read these instructions before modifying any UI.

The goal is not merely to make interfaces functional.

The goal is to make Toolbox feel like one coherent, polished product.

==================================================
1. CORE UI PHILOSOPHY
==================================================

Toolbox should feel:

- clean
- minimal
- intelligent
- functional
- intentional
- modern
- coherent
- restrained

Every visual element should have a purpose.

Prefer clarity over decoration.

Prefer hierarchy over visual noise.

Prefer consistency over novelty.

Do not add visual elements merely because empty space exists.

Whitespace is acceptable.

An interface does not need to fill every available pixel.

==================================================
2. DO NOT INVENT A NEW DESIGN SYSTEM
==================================================

Before creating or modifying a component:

Inspect the existing Toolbox UI.

Look for existing:

- buttons
- pills
- cards
- inputs
- tabs
- dropdowns
- modals
- toolbars
- navigation
- badges
- icons
- empty states
- loading states
- error states

Reuse existing patterns wherever possible.

Do not create a visually different version of an existing component unless there is a demonstrated reason to do so.

Toolbox should not have five different versions of a button.

==================================================
3. UI CONSISTENCY
==================================================

All tools should feel like they belong to the same application.

Maintain consistency in:

- typography
- spacing
- border radius
- control heights
- icon sizing
- button shapes
- pill shapes
- cards
- shadows
- borders
- headings
- labels
- form controls
- hover states
- focus states
- disabled states
- empty states
- loading states
- error states

When modifying one tool, compare it with neighboring Toolbox tools before introducing a new pattern.

==================================================
4. MINIMALISM
==================================================

Toolbox uses functional minimalism.

Do NOT:

- add unnecessary hero sections
- add giant banners
- add decorative dashboard tiles
- add excessive cards
- add ornamental gradients
- add decorative illustrations without functional value
- add excessive shadows
- add excessive blur
- add excessive glassmorphism
- add unnecessary animations
- fill empty areas with arbitrary UI

A component should exist because it improves usability.

==================================================
5. NO UNNECESSARY TILE BANNERS
==================================================

Do not create large tile-based layouts simply to make a page appear more populated.

Avoid:

- "Welcome" banners
- oversized feature tiles
- decorative statistic cards
- promotional panels
- giant empty cards containing one sentence
- fake dashboard metrics

If a page has little content, allow it to have whitespace.

==================================================
6. TYPOGRAPHY
==================================================

Typography should establish clear hierarchy.

Use existing Toolbox typography tokens/styles.

A typical hierarchy should distinguish:

Page title
Section title
Item title
Supporting text
Metadata
Secondary information

Do not make every piece of text bold.

Do not make every heading enormous.

Do not use typography as decoration.

Long descriptive text should be concise in the UI.

Technical implementation details generally belong outside the primary user-facing interface.

==================================================
7. BUTTONS
==================================================

Buttons must be visually consistent across Toolbox.

Use existing button patterns.

Primary actions should be visually obvious.

Secondary actions should remain subordinate.

Avoid creating multiple competing primary buttons.

Use concise labels.

Prefer:

"Save"

"Open"

"Export"

"Calculate"

"Search"

over unnecessarily verbose button labels.

Use icons only when they improve recognition.

Never use emojis as UI icons.

==================================================
8. PILLS
==================================================

Toolbox frequently uses pill-shaped controls.

When a control is conceptually a:

- filter
- category
- tag
- state
- compact selector

consider the existing pill language.

Do not replace established pill components with unrelated rectangular controls.

However, do not make every UI element a pill.

Use shape according to function.

==================================================
9. BADGES
==================================================

Badges should be subtle.

They communicate metadata or state.

Do not make badges the visual focal point of a card.

Avoid enormous badges such as:

PROVEN THEOREM

OPEN PROBLEM

VERIFIED

unless the context genuinely requires strong emphasis.

Prefer compact, minimal status treatments.

Never rely on color alone to communicate meaning.

==================================================
10. ICONOGRAPHY
==================================================

Use minimal functional icons.

Prefer:

- existing Toolbox SVG icons
- existing icon components
- simple line/iconography conventions already present in Toolbox

Do not use emojis.

Do not use random Unicode symbols as substitutes for icons.

Do not mix unrelated icon styles.

Icons should have consistent:

- stroke/weight
- size
- alignment
- visual density

==================================================
11. FILE ICONS
==================================================

File and folder interfaces must use meaningful type-aware icons.

Icons should be assigned automatically based on file type.

At minimum support:

- folder
- image
- PDF
- document
- spreadsheet
- presentation
- CSV
- text
- JSON
- source code
- audio
- video
- archive
- generic file

Use the same icon system in:

- grid view
- list view
- default file view
- file pickers
- Assistant file results
- artifact results

Do not manually assign icons to individual files.

==================================================
12. FORMS AND INPUTS
==================================================

Forms should be visually calm and easy to scan.

Maintain:

- consistent control heights
- clear labels
- readable placeholder text
- visible focus states
- sensible spacing
- appropriate grouping

Do not use placeholders as substitutes for labels when the field needs a persistent label.

Do not make every input enormous.

==================================================
13. FILTERS
==================================================

Filters should be clearly distinguishable from their background.

They must remain readable across every Toolbox theme.

Selected state must be obvious.

Hover state must be subtle.

Focus state must be visible.

Do not rely solely on color.

Filters should visually match the rest of the application.

==================================================
14. CARDS
==================================================

Cards should group related information.

Do not put a card inside a card inside another card unless the hierarchy genuinely requires it.

Avoid excessive borders.

Avoid excessive shadows.

Use spacing to create hierarchy.

Cards should not all look identical if their purposes differ, but related cards should share the same design language.

==================================================
15. EMPTY STATES
==================================================

Empty state means empty state.

Never insert fake/demo/sample data simply to make a screen look populated.

An empty state should:

- explain what is empty
- explain what the user can do next when useful
- remain visually lightweight

Do not create a giant empty-state banner.

==================================================
16. LOADING STATES
==================================================

Loading should communicate that something is actually happening.

Use appropriate:

- skeletons
- spinners
- progress indicators
- status text

Do not freeze the interface without explanation.

For long-running Assistant tasks, provide meaningful progress/status information.

Avoid decorative loading animations.

==================================================
17. ERROR STATES
==================================================

Errors must be understandable to normal users.

Never expose:

- stack traces
- raw exceptions
- internal function names
- tool execution syntax
- server implementation details
- raw JSON
- debugging output

Translate technical failures into useful user-facing language.

Example:

Bad:

"TypeError: escapeHtml is not defined"

Good:

"The results could not be displayed because the page data could not be processed."

Internal logs may remain available for debugging, but must not leak into normal UI.

==================================================
18. ASSISTANT RESPONSES
==================================================

Assistant responses are part of the UI.

They must not feel like raw API responses.

Do not allow:

- raw tool calls
- raw JSON
- raw HTML
- raw HTML entities
- renderer names
- debugging output
- duplicated content
- unexplained implementation details

Assistant responses should have enough context to be useful.

Avoid both extremes:

Too little:
"Found 1 event."

Too much:
A giant technical explanation of how the event database works.

The response should answer the user's actual question.

==================================================
19. STRUCTURED RESULT RENDERING
==================================================

When a tool produces structured data, use the appropriate specialized renderer.

Examples:

Map data
→ map renderer

Images
→ image gallery

Table
→ table renderer

Chart
→ chart renderer

Math
→ mathematical result renderer

Calendar
→ calendar/event renderer

Files
→ file renderer

Financial data
→ financial renderer

Do not dump structured data into plain text when a suitable renderer exists.

==================================================
20. MATHEMATICAL UI
==================================================

Mathematical notation must look like mathematics.

Never expose raw LaTeX markup in normal user-facing UI.

Do not display:

`\frac`
`\sum`
`\equiv`
`\pmod`
`\int`

as raw source when mathematical rendering is available.

Use proper mathematical rendering.

Formula presentation should have:

- appropriate size
- spacing
- hierarchy
- readable notation
- separation from explanatory text

Mathematical content should feel like a mathematical reference, not a database.

==================================================
21. VISUALIZATION
==================================================

Graphs and diagrams should be presented as actual visualizations.

Do not replace requested visualizations with textual descriptions.

Use existing chart/visualization infrastructure where possible.

Do not create custom visualization systems unnecessarily.

==================================================
22. DARK THEMES
==================================================

Dark themes require deliberate design.

Do not assume that a component is theme-compatible because its text technically passes contrast requirements.

Check:

- visual separation
- borders
- backgrounds
- muted text
- controls
- active states
- hover states
- focus states
- disabled states

Avoid overly transparent surfaces that disappear into the background.

Avoid blur-heavy components when they reduce readability.
23. LIGHT THEMES

Do not treat light themes as an afterthought.

Ensure:

- borders remain visible
- secondary text remains readable
- cards remain distinguishable
- selected states remain obvious
- shadows remain subtle
- controls remain coherent
Always make sure it all looks good on mobile displays.