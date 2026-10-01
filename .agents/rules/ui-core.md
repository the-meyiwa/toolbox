\---

trigger: always\_on

\---



\# TOOLBOX — UI CORE



You are working on the Toolbox application.



These instructions govern all user-interface and user-experience work across Toolbox.



Read and apply them before creating, modifying, modernizing, refactoring, or reviewing any user-facing interface.



The objective is not merely to make interfaces functional.



The objective is to make Toolbox feel like one coherent, deliberate, polished product regardless of which tool, feature, renderer, or device the user is interacting with.



\---



\# 1. RULE PRIORITY



When UI rules appear to conflict, follow this priority order:



1\. Usability and correctness

2\. Accessibility

3\. Existing Toolbox design language

4\. Responsive behavior

5\. Visual hierarchy and clarity

6\. Motion and polish

7\. Decorative aesthetics



Aesthetic improvements must never reduce usability, accessibility, responsiveness, or consistency.



"Premium" does not mean visually elaborate.



Do not add effects merely to make an interface appear more sophisticated.



The simplest interface that communicates the required information clearly is usually preferable.



\---



\# 2. CORE UI PHILOSOPHY



Toolbox should feel:



\- clean

\- minimal

\- intelligent

\- functional

\- intentional

\- modern

\- coherent

\- restrained

\- responsive

\- polished



Every visible element should have a purpose.



Prefer:



\- clarity over decoration

\- hierarchy over visual noise

\- consistency over novelty

\- usability over spectacle

\- structure over ornament

\- deliberate whitespace over artificial density

\- familiar interaction patterns over clever ones



Do not add visual elements merely because empty space exists.



Whitespace is valid.



A page does not need to fill every available pixel.



Do not confuse visual complexity with sophistication.



\---



\# 3. TOOLBOX IS ONE PRODUCT



Toolbox contains many tools, but those tools must not feel like unrelated websites bundled together.



Every tool should clearly belong to the same application.



Maintain consistency in:



\- typography

\- spacing

\- border radius

\- control heights

\- icon sizing

\- button shapes

\- pill shapes

\- card treatment

\- borders

\- elevation

\- navigation

\- headings

\- labels

\- forms

\- hover states

\- focus states

\- active states

\- disabled states

\- loading states

\- empty states

\- error states

\- motion

\- responsive behavior



Individual tools may have specialized interfaces when their function requires them.



Specialization must extend the Toolbox design language rather than replace it.



A chess board does not need to resemble a calculator.



They should still feel as though they belong to the same product.



\---



\# 4. DO NOT INVENT A NEW DESIGN SYSTEM



Before creating or visually redesigning any component, inspect the existing Toolbox interface and codebase.



Search for existing:



\- buttons

\- pills

\- cards

\- inputs

\- selectors

\- tabs

\- dropdowns

\- menus

\- modals

\- sheets

\- toolbars

\- navigation

\- badges

\- icons

\- file components

\- renderers

\- loading states

\- empty states

\- error states

\- responsive patterns

\- motion patterns



Reuse established patterns wherever practical.



Do not create a visually different version of an existing component without a functional reason.



Do not create local styling conventions when a shared component or established pattern already solves the problem.



Before introducing a new pattern, compare the affected interface with neighboring Toolbox tools.



If an existing Toolbox pattern solves the same problem well, use it.



\---



\# 5. FUNCTIONAL MINIMALISM



Toolbox uses functional minimalism.



A component should exist because it improves:



\- comprehension

\- navigation

\- interaction

\- organization

\- feedback

\- discoverability



Do not add:



\- unnecessary hero sections

\- giant banners

\- decorative dashboard tiles

\- excessive cards

\- ornamental gradients

\- decorative illustrations without functional value

\- excessive shadows

\- excessive blur

\- excessive glassmorphism

\- unnecessary animations

\- arbitrary dividers

\- filler content

\- fake metrics

\- UI created merely to occupy empty space



Do not create large tile-based layouts simply to make a page appear populated.



Avoid:



\- generic "Welcome" banners

\- oversized feature tiles

\- decorative statistic cards

\- promotional panels

\- giant cards containing one sentence

\- fake dashboard metrics

\- redundant explanatory panels



If a page has little content, allow it to have whitespace.



\---



\# 6. VISUAL HIERARCHY



Establish hierarchy primarily through:



\- spacing

\- alignment

\- grouping

\- typography

\- proportion

\- position



Use borders, backgrounds, cards, and elevation only when they clarify structure.



Do not solve every hierarchy problem by adding another:



\- container

\- card

\- border

\- background

\- divider

\- shadow



The relationship between elements should be understandable without excessive visual framing.



Important content should be easy to locate.



Secondary information should remain visibly subordinate.



Related controls should remain spatially and visually related.



\---



\# 7. LAYOUT



Prefer the simplest layout capable of expressing the relationship between elements.



Layouts should remain stable as content changes.



Avoid:



\- arbitrary fixed heights

\- fragile absolute positioning

\- unnecessary nested scrolling

\- excessive containers

\- unnecessary columns

\- layouts dependent on exact text lengths

\- layouts that collapse when real data replaces placeholder content



Pages should adapt gracefully as content grows.



Dense tools may use more compact layouts than content-oriented tools.



Density should follow function.



Do not force every Toolbox tool into the same page structure when its workflow requires something different.



\---



\# 8. TYPOGRAPHY



Typography should establish clear hierarchy.



Use existing Toolbox typography styles and conventions.



Typical hierarchy should distinguish:



\- page title

\- section title

\- item title

\- body content

\- supporting text

\- metadata

\- secondary information



Do not make every piece of text bold.



Do not make every heading enormous.



Do not use typography merely as decoration.



Avoid excessive uppercase text.



Avoid unnecessarily long labels.



User-facing descriptions should be concise.



Technical implementation details generally belong outside the primary user-facing interface.



Use readable line lengths for long-form content.



Do not reduce text size merely to force content into a layout that does not fit.



\---



\# 9. BUTTONS AND ACTIONS



Buttons must be visually consistent across Toolbox.



Reuse established button components and patterns.



Primary actions should be obvious.



Secondary actions should remain subordinate.



Destructive actions must be distinguishable from ordinary actions.



Avoid multiple competing primary actions in the same context.



Use concise labels.



Prefer labels such as:



\- Save

\- Open

\- Export

\- Calculate

\- Search

\- Continue

\- Delete

\- Cancel



over unnecessarily verbose alternatives.



Use icons when they improve recognition or reduce clutter without introducing ambiguity.



Do not use an icon-only button when its purpose would be unclear.



Provide accessible labels for icon-only controls.



Never use emojis as UI icons.



\---



\# 10. PILLS, TAGS, AND COMPACT SELECTORS



Toolbox frequently uses pill-shaped controls.



Consider the established pill language when a control represents:



\- a filter

\- a category

\- a tag

\- a state

\- a compact selector

\- a small mode switch



Do not replace established pill components with unrelated rectangular controls without reason.



Do not make every UI element a pill.



Shape should follow function.



Selected and unselected states must remain clearly distinguishable.



\---



\# 11. BADGES AND STATUS



Badges communicate metadata or state.



They should usually remain visually subordinate to the primary content.



Avoid enormous status badges unless the state genuinely requires strong emphasis.



Prefer compact status treatments.



Do not rely on color alone to communicate state.



Where necessary, combine visual treatment with:



\- text

\- iconography

\- shape

\- position



Status language should be concise and understandable.



\---



\# 12. ICONOGRAPHY



Use minimal, functional iconography.



Prefer:



\- existing Toolbox SVG icons

\- existing icon components

\- established Toolbox icon conventions



Do not:



\- use emojis as interface icons

\- use random Unicode characters as substitutes for icons

\- mix unrelated icon styles

\- introduce a new icon library for a trivial requirement



Icons should maintain consistent:



\- stroke or weight

\- size

\- alignment

\- optical balance

\- visual density



Decorative icons should be rare.



Icons should clarify an interface rather than decorate it.



\---



\# 13. FILE AND FOLDER ICONS



File and folder interfaces must use meaningful type-aware icons.



Icons should be assigned automatically based on file type.



At minimum distinguish:



\- folder

\- image

\- PDF

\- document

\- spreadsheet

\- presentation

\- CSV

\- text

\- JSON

\- source code

\- audio

\- video

\- archive

\- generic file



Use the same file icon system across:



\- grid view

\- list view

\- default file view

\- file pickers

\- Assistant file results

\- artifact results



Do not manually assign icons to individual files.



File representation should remain consistent wherever the same file appears.



\---



\# 14. FORMS AND INPUTS



Forms should feel calm, predictable, and easy to scan.



Maintain:



\- consistent control heights

\- clear labels

\- readable placeholder text

\- visible focus states

\- sensible spacing

\- logical grouping

\- clear validation

\- predictable keyboard behavior



Do not use placeholder text as a substitute for a persistent label when the field requires one.



Do not make every input enormous.



Do not make controls excessively small to save space.



Group related fields.



Separate unrelated groups.



Validation should appear close to the affected field whenever practical.



Do not erase user input unnecessarily after validation failures.



\---



\# 15. FILTERS



Filters must be visually distinguishable from their surroundings.



Selected state must be obvious.



Hover state should remain subtle.



Focus state must remain visible.



Do not rely solely on color.



Filters should use the established Toolbox control language.



Avoid displaying excessive filter controls simultaneously when progressive disclosure would produce a clearer interface.



\---



\# 16. CARDS AND CONTAINERS



Cards should group information that genuinely belongs together.



Do not put a card inside a card inside another card unless the hierarchy genuinely requires it.



Avoid excessive borders.



Avoid excessive elevation.



Use spacing before introducing additional framing.



Related cards should share a design language.



Different types of cards may differ when their function requires it.



Do not force unrelated information into cards merely because cards are convenient.



\---



\# 17. NAVIGATION



Navigation should make location and available destinations understandable.



Do not hide important navigation behind obscure interactions.



Active location should be clear.



Navigation behavior should remain consistent across related parts of Toolbox.



Avoid duplicating navigation controls without reason.



Do not introduce new navigation paradigms locally when an established Toolbox pattern already exists.



Back navigation should behave predictably.



Navigation should preserve user context where practical.



\---



\# 18. EMPTY STATES



An empty state means the underlying content is actually empty.



Never insert fake, demo, or sample data merely to make an interface appear populated.



An empty state should:



\- explain what is empty

\- explain what the user can do next when useful

\- remain visually lightweight



Do not create giant empty-state banners.



Do not make an empty state visually more prominent than the populated interface.



If no explanation is necessary, keep the state simple.



\---



\# 19. LOADING AND PROGRESS



Loading states must communicate that something is actually happening.



Use the appropriate mechanism:



\- skeleton

\- spinner

\- progress indicator

\- status text

\- incremental results



Do not freeze an interface without explanation.



Avoid decorative loading animations.



Use skeletons when the approximate structure of incoming content is known.



Use progress indicators when meaningful progress can actually be measured.



Do not display fake percentage progress.



For long-running Assistant or tool operations, provide meaningful status information when available.



If partial results can be safely displayed, prefer progressive feedback over an apparently frozen screen.



\---



\# 20. ERROR STATES



Errors must be understandable to ordinary users.



Never expose normal users to:



\- stack traces

\- raw exceptions

\- internal function names

\- tool execution syntax

\- server implementation details

\- raw JSON

\- debugging output

\- database errors

\- internal renderer names



Translate technical failures into useful language.



Bad:



"TypeError: escapeHtml is not defined"



Better:



"The results could not be displayed because the page data could not be processed."



When appropriate, explain:



\- what failed

\- whether user data was preserved

\- whether retrying may help

\- what action the user can take next



Internal logs may retain technical information for debugging.



Technical details must not leak into ordinary UI.



\---



\# 21. ASSISTANT RESPONSES



Assistant responses are part of the Toolbox interface.



They must not feel like raw API output.



Do not expose:



\- raw tool calls

\- raw JSON

\- raw HTML

\- raw HTML entities

\- renderer names

\- debugging output

\- duplicated content

\- unexplained implementation details



Responses should contain enough context to answer the user's actual request.



Avoid responses that are so short that they lose useful context.



Avoid unnecessarily large technical explanations when the user asked for a simple result.



Structured information should be rendered using the appropriate interface when available.



The textual response and structured renderer should complement each other rather than redundantly repeat the same content.



\---



\# 22. STRUCTURED RESULT RENDERING



When a tool produces structured data, use the appropriate specialized renderer when one exists.



Examples:



Map data

→ map renderer



Images

→ image gallery



Tables

→ table renderer



Charts

→ chart renderer



Mathematics

→ mathematical result renderer



Calendar data

→ calendar/event renderer



Files

→ file renderer



Financial data

→ financial renderer



Do not dump structured data into plain text when a suitable renderer exists.



Do not build a new renderer if an existing Toolbox renderer already handles the information correctly.



Structured renderers must still obey the same spacing, interaction, responsive, and accessibility rules as the rest of Toolbox.



\---



\# 23. MATHEMATICAL UI



Mathematical notation should look like mathematics.



Never expose raw LaTeX markup in normal user-facing UI when mathematical rendering is available.



Do not show source commands such as:



`\\frac`

`\\sum`

`\\equiv`

`\\pmod`

`\\int`



as ordinary output when they can be rendered properly.



Formula presentation should have:



\- appropriate size

\- readable notation

\- adequate spacing

\- clear hierarchy

\- separation from explanatory text



Mathematical interfaces should resemble polished mathematical tools rather than database viewers.



\---



\# 24. VISUALIZATIONS



Graphs and diagrams should be actual visualizations when visual representation is appropriate.



Do not replace a requested visualization with a textual description merely because text is easier to implement.



Reuse existing chart and visualization infrastructure where possible.



Do not create a custom visualization system unnecessarily.



Visualizations must remain:



\- readable

\- responsive

\- interactive when useful

\- accessible

\- understandable without unnecessary decoration



Labels, legends, axes, controls, and annotations should remain legible.



Do not overload visualizations with information that does not improve comprehension.



\---



\# 25. RESPONSIVE DESIGN



Every UI change must be evaluated independently across different viewport sizes.



Do not assume a desktop layout will naturally collapse correctly.



For modified interfaces, consider:



\- narrow phones

\- standard phones

\- larger phones

\- tablets and intermediate widths

\- laptops

\- desktop displays



Responsive behavior should emerge from layout logic rather than piles of device-specific patches.



Prefer flexible sizing and layout primitives over arbitrary breakpoint hacks.



Do not preserve a desktop composition on smaller screens when doing so harms usability.



\---



\# 26. MOBILE DESIGN



Mobile is a first-class Toolbox experience.



It is not a compressed desktop layout.



On mobile:



\- prevent horizontal overflow

\- avoid compressed multi-column layouts

\- stack content when appropriate

\- preserve readable spacing

\- keep important actions reachable

\- maintain usable touch targets

\- prevent controls from becoming excessively wide or tall

\- prevent dialogs and panels from extending beyond the viewport

\- ensure scrolling occurs in the intended container

\- avoid desktop-only fixed dimensions

\- keep text readable without zooming

\- preserve clear hierarchy

\- avoid accidental taps



When desktop interactions depend on hover, provide an appropriate touch interaction.



Long-press behavior must not interfere with ordinary taps.



Menus, sheets, modals, editors, calendars, and other complex interfaces require deliberate mobile behavior.



Do not declare UI work complete until the affected interface has been checked at mobile dimensions.



\---



\# 27. MOTION AND INTERACTION



Animation must communicate:



\- structure

\- state

\- causality

\- hierarchy

\- spatial relationships

\- continuity



Toolbox motion should feel:



\- smooth

\- controlled

\- deliberate

\- responsive

\- physically coherent



Avoid:



\- bouncy motion

\- exaggerated spring effects

\- animation for decoration alone

\- excessive entrance animations

\- long transitions that delay interaction

\- unrelated animations competing simultaneously

\- motion that distracts from the task



Prefer restrained use of:



\- fades

\- transforms

\- scale changes

\- expansion and collapse

\- spatial transitions

\- contextual movement



Scrolling experiences may use richer motion when it improves comprehension or storytelling.



Richer motion must not make navigation harder.



Interactive elements should respond immediately to user input.



Do not make users wait for decorative transitions before they can continue interacting.



Respect reduced-motion preferences.



Never sacrifice usability for animation.



\---



\# 28. INTERACTION STATES



Interactive components should define appropriate states for:



\- default

\- hover

\- focus

\- active

\- selected

\- disabled

\- loading

\- error



Do not implement only the default appearance.



Hover must not be required to discover essential functionality.



Focus states must remain visible.



Disabled controls should look disabled without becoming unreadable.



Loading controls should prevent accidental duplicate actions when appropriate.



Interactive state changes should remain visually understandable.



\---



\# 29. MODALS, SHEETS, POPOVERS, AND MENUS



Use overlays only when they improve the workflow.



Do not turn ordinary page content into a modal without reason.



Modals should focus on a specific task or decision.



Avoid stacking multiple modals.



Menus should remain concise.



Popover placement must account for viewport boundaries.



Overlays must:



\- remain within the viewport

\- provide predictable dismissal

\- manage focus correctly

\- preserve important user input

\- behave correctly on touch devices

\- avoid trapping users accidentally



On small displays, consider whether a sheet or full-screen presentation is more usable than a desktop-style floating modal.



\---



\# 30. ACCESSIBILITY



Accessibility is part of correct UI implementation.



Do not treat it as optional polish.



Ensure:



\- interactive elements are keyboard accessible where appropriate

\- focus states are visible

\- controls have accessible names

\- icon-only controls have labels

\- form controls are associated with labels

\- semantic HTML is used where practical

\- state is not communicated by color alone

\- touch targets are usable

\- text remains readable

\- reduced-motion preferences are respected



Do not replace semantic elements with generic containers merely to simplify styling.



Use native platform behavior when it already solves the interaction correctly.



\---



\# 31. CONTENT AND MICROCOPY



Interface text should be concise, specific, and useful.



Prefer ordinary language over implementation terminology.



Avoid:



\- unnecessary technical jargon

\- verbose button labels

\- vague errors

\- redundant descriptions

\- excessive instructional text

\- filler copy



Do not explain obvious controls.



Do explain unfamiliar workflows when explanation materially improves usability.



Use consistent terminology for the same concepts throughout Toolbox.



If the product calls something an "Artifact," do not arbitrarily rename it "Result" or "Document" in another interface unless the concepts are actually different.



\---



\# 32. PREMIUM POLISH



Toolbox should feel carefully made.



Premium polish comes from:



\- proportion

\- alignment

\- spacing

\- typography

\- responsive behavior

\- interaction quality

\- consistency

\- subtle depth

\- careful motion

\- attention to detail



Premium does not mean:



\- more blur

\- more glass

\- more gradients

\- more shadows

\- more cards

\- more animation

\- more decoration



When elevation is functionally appropriate, prefer subtle diffuse depth over harsh drop shadows.



When transparency or blur is already appropriate to an established component, implement it carefully.



Do not introduce glassmorphism merely to make an interface look "premium."



The Core UI Philosophy always takes precedence over decorative polish.



\---



\# 33. DO NOT DESTROY WORKING UI WITHOUT REASON



When modifying an existing interface, understand what already works before replacing it.



Do not perform broad visual rewrites when the task requires a focused change.



Preserve:



\- working interactions

\- responsive behavior

\- accessibility

\- useful information hierarchy

\- established components

\- intentional animation

\- existing functionality



Refactoring should reduce inconsistency or complexity rather than merely exchange one implementation for another.



If a component looks unusual, determine why before "fixing" it.



\---



\# 34. IMPLEMENTATION DISCIPLINE



Before implementing UI changes:



1\. Inspect the affected interface.

2\. Inspect related components.

3\. Search for existing reusable patterns.

4\. Understand the current responsive behavior.

5\. Identify the smallest coherent change.

6\. Implement without unnecessary redesign.



Do not introduce a dependency solely to solve a trivial visual problem.



Do not duplicate a component because modifying or reusing the existing component requires slightly more effort.



Do not scatter arbitrary one-off values throughout the code when established tokens or shared styles exist.



Do not silently change unrelated UI.



\---



\# 35. UI VERIFICATION



Do not consider UI work complete merely because the code compiles.



After modifying UI:



1\. Inspect the rendered result.

2\. Compare it with surrounding Toolbox interfaces.

3\. Verify desktop behavior.

4\. Verify mobile behavior.

5\. Check intermediate responsive widths when relevant.

6\. Check overflow and scrolling.

7\. Check hover behavior where applicable.

8\. Check keyboard focus where applicable.

9\. Check active and selected states.

10\. Check disabled states.

11\. Check loading states when applicable.

12\. Check empty states when applicable.

13\. Check error states when applicable.

14\. Check touch interactions where applicable.

15\. Check motion and transitions.

16\. Confirm that existing functionality still works.

17\. Confirm that no obvious visual regression was introduced.

18\. Correct problems discovered during verification.



Do not merely inspect source code and infer that the rendered interface looks correct.



If browser or visual inspection capabilities are available, use them.



If the rendered result materially differs from the intended design, continue working rather than reporting completion.



\---



\# 36. COMPLETION STANDARD



A UI task is complete only when the affected interface is:



\- functional

\- coherent

\- responsive

\- accessible

\- visually consistent

\- understandable

\- appropriately polished

\- verified



A successful build is not proof of successful UI.



A component rendering without errors is not proof that it is usable.



A visually attractive interface is not successful if it behaves poorly.



A functional interface is not finished if it visibly breaks the Toolbox design language.



When uncertain, prefer the solution that is simpler, clearer, more consistent, and easier for the user to understand.

