\---

trigger: always\_on

\---



\# TOOLBOX — UI DESIGN SYSTEM



This file defines the visual language and component standards of Toolbox.



It supplements `UI Core`.



`UI Core` defines the principles and behavioral expectations of Toolbox interfaces.



This file defines how those principles should be expressed visually and structurally.



Do not treat this file as permission to redesign established interfaces unnecessarily.



The objective is consistency, not uniformity.



\---



\# 1. DESIGN SYSTEM AUTHORITY



Before introducing a new visual value, component variant, spacing convention, radius, shadow, font size, or interaction pattern:



1\. Search for an existing Toolbox token.

2\. Search for an existing shared component.

3\. Inspect comparable Toolbox interfaces.

4\. Reuse the established pattern when appropriate.

5\. Introduce a new value only when the existing system does not solve the requirement.



Do not create arbitrary one-off values when an established token or convention exists.



When repeated values exist without formal tokens, prefer consolidating them into reusable semantic tokens rather than continuing the duplication.



Do not perform broad token migrations as part of an unrelated UI task.



\---



\# 2. DESIGN LANGUAGE



The Toolbox visual language is:



\- minimal

\- rounded

\- precise

\- restrained

\- spacious where appropriate

\- compact where function requires density

\- typography-led

\- interface-first

\- subtly dimensional

\- highly coherent



The interface should feel sophisticated because of proportion, alignment, responsiveness, interaction quality, and attention to detail.



It should not depend on decoration to feel finished.



Rounded geometry is an important part of Toolbox, but not every object should become a pill.



Whitespace is part of the design system.



Empty space does not require decoration.



\---



\# 3. DESIGN TOKENS



Prefer semantic tokens over raw visual values.



Tokens should describe purpose rather than a single component.



Prefer concepts such as:



```text

\--space-xs

\--space-sm

\--space-md

\--space-lg

\--space-xl



\--radius-sm

\--radius-md

\--radius-lg

\--radius-pill



\--control-height-sm

\--control-height-md

\--control-height-lg



\--icon-sm

\--icon-md

\--icon-lg



\--shadow-subtle

\--shadow-raised

\--shadow-overlay



\--motion-fast

\--motion-normal

\--motion-slow

```



over repeated arbitrary values throughout individual components.



Do not create a token for every possible number.



A useful token system should reduce variation.



If two values are visually indistinguishable and serve the same purpose, they probably should not be separate tokens.



\---



\# 4. SPACING SYSTEM



Spacing should follow a small, repeatable scale.



Use spacing to communicate relationships.



Smaller spacing implies stronger relationship.



Larger spacing implies separation between groups or sections.



Prefer established spacing tokens over arbitrary margins and gaps.



Spacing should generally progress through:



\- very compact spacing for icon/text relationships

\- compact spacing for controls and related items

\- standard spacing for component internals

\- comfortable spacing between groups

\- large spacing between major sections



Do not use large spacing merely to make an interface feel "premium."



Do not compress interfaces merely to fit more content.



Dense interfaces such as editors, tables, terminals, file lists, and toolbars may intentionally use tighter spacing.



Content-oriented interfaces may use more generous spacing.



Maintain rhythm.



Repeated components should align to the same spacing logic.



\---



\# 5. TYPOGRAPHY



Use the established Toolbox font stack.



Prefer native/system typography where already established.



A suitable system stack should prioritize platform-native fonts such as:



```text

\-apple-system

BlinkMacSystemFont

"SF Pro Display"

"SF Pro Text"

"Segoe UI"

sans-serif

```



Do not introduce additional typefaces without a demonstrated product requirement.



Typography should establish hierarchy rather than decoration.



Maintain a limited hierarchy:



\### Display / Exceptional

Reserved for rare high-emphasis presentation.



Do not use as the default page heading.



\### Page Title

Primary identifier of the current page or tool.



\### Section Title

Separates major content groups.



\### Item Title

Names cards, files, results, list entries, or entities.



\### Body

Default readable interface content.



\### Supporting Text

Descriptions and secondary explanations.



\### Metadata

Dates, counts, technical metadata, secondary state.



\### UI Label

Buttons, tabs, filters, controls, and compact actions.



Do not invent a new font size for each component.



Prefer an existing typographic role.



Use weight deliberately.



Do not make every important element bold.



Hierarchy should come from a combination of:



\- size

\- weight

\- spacing

\- position

\- contrast



Do not rely on size alone.



\---



\# 6. CORNERS AND GEOMETRY



Toolbox uses rounded geometry.



Corner radius should communicate component type and scale.



Use:



\- smaller radii for compact or dense elements

\- standard radii for ordinary controls

\- larger radii for substantial surfaces

\- pill geometry for controls whose function suits it



Pill geometry is appropriate for:



\- filters

\- tags

\- categories

\- compact selectors

\- segmented states

\- compact actions where already established



Do not use pill geometry automatically for:



\- large panels

\- ordinary content cards

\- dialogs

\- tables

\- every button

\- every input



Nested surfaces should have visually compatible radii.



Avoid situations where a child surface has a dramatically larger radius than its containing surface without reason.



Do not create tiny differences between nearly identical radii.



\---



\# 7. CONTROL HEIGHTS



Controls serving similar purposes should share heights.



Standardize recurring control categories such as:



\- compact

\- standard

\- prominent



Buttons, inputs, selectors, and adjacent controls within the same interaction group should normally align vertically.



Do not create arbitrary height differences between controls sitting beside one another.



Compact controls belong in dense environments such as:



\- toolbars

\- table actions

\- editor controls

\- file actions

\- secondary utility controls



Standard controls should handle most ordinary interaction.



Prominent controls should be uncommon and reserved for situations that genuinely require increased emphasis or touch area.



Large does not automatically mean important.



\---



\# 8. BUTTON SYSTEM



Reuse the established Toolbox button system.



Button hierarchy should generally consist of:



\### Primary



Represents the principal action in the current context.



Use sparingly.



A view should rarely contain several visually competing primary actions.



\### Secondary



Represents meaningful alternatives without competing with the primary action.



\### Tertiary / Ghost



Used for lower-emphasis actions, toolbar actions, navigation-adjacent actions, or compact utility controls.



\### Destructive



Used for actions with destructive consequences.



Destructive appearance should communicate risk without becoming visually theatrical.



\### Icon Button



Used when the icon is sufficiently recognizable or space is constrained.



Icon-only buttons require accessible labels.



Button anatomy should remain consistent:



```text

\[ optional icon ] \[ concise label ]

```



Maintain consistent:



\- height

\- horizontal padding

\- radius

\- icon size

\- icon/text gap

\- typography

\- state behavior



Avoid verbose labels.



Avoid excessive width unless layout requires it.



Do not make every button full-width.



On mobile, full-width actions may be appropriate when they improve usability.



\---



\# 9. PILLS AND SEGMENTED CONTROLS



Pills are part of the Toolbox design language.



Use them deliberately.



Appropriate uses include:



\- filters

\- categories

\- tags

\- states

\- modes

\- compact selectors



Pills should usually be compact.



Selected state must be immediately distinguishable from unselected state.



Do not create excessive visual emphasis around every selected pill.



A row of pills should remain scannable and should not become a collection of miniature primary buttons.



When pill collections overflow on small screens, use an intentional responsive strategy rather than silently clipping them.



\---



\# 10. INPUTS



Inputs should share a coherent visual structure.



Maintain consistency in:



\- height

\- padding

\- radius

\- typography

\- label placement

\- placeholder treatment

\- focus behavior

\- validation behavior



Inputs should not dominate the interface unnecessarily.



Labels should remain readable and persistent when users need them to understand the field after entering a value.



Placeholder text should provide examples or lightweight guidance.



It should not carry information the user needs permanently.



Related controls should align.



Prefix and suffix icons should use the standard icon scale.



Validation should not cause disruptive layout shifts where avoidable.



\---



\# 11. ICON SYSTEM



Use the established Toolbox icon system.



Prefer existing SVGs and shared icon components.



Maintain a small icon size hierarchy:



\- compact

\- standard

\- prominent



Most interface icons should use compact or standard sizes.



Prominent icons should be uncommon.



Maintain consistent:



\- stroke weight

\- optical size

\- alignment

\- density

\- padding



Do not mix filled, outlined, hand-drawn, emoji, and unrelated icon styles arbitrarily.



Do not use Unicode characters as fake icons.



Icons should normally inherit appropriate interface styling rather than contain arbitrary hardcoded presentation.



\---



\# 12. FILE ICON SYSTEM



File icons must communicate type consistently.



The same file should not receive unrelated representations depending on where it appears.



At minimum provide recognizable representations for:



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



File type should determine the icon automatically.



Use the same system in:



\- Files

\- file pickers

\- Assistant results

\- artifact results

\- grid layouts

\- list layouts

\- search results



Do not manually map individual filenames to icons.



\---



\# 13. CARDS



Cards exist to group related information.



They are not the default solution to layout.



Before introducing a card, ask whether:



\- spacing

\- alignment

\- a divider

\- a section

\- a list



would communicate the same relationship more simply.



Cards should normally contain a clear internal hierarchy:



```text

optional metadata

title

supporting content

optional actions

```



Not every card requires every layer.



Avoid excessive card chrome.



Avoid cards nested repeatedly inside other cards.



Do not place every page section inside a card.



Related card families should share:



\- radius logic

\- padding logic

\- typography

\- action placement

\- elevation logic



\---



\# 14. BORDERS AND DIVIDERS



Borders should clarify boundaries.



Do not outline every component simply because CSS makes it easy.



Use borders for:



\- control boundaries

\- meaningful separation

\- table structure when needed

\- selected/focused states

\- overlay definition

\- containers requiring visual distinction



Prefer spacing when a border does not improve comprehension.



Dividers should be subtle.



Avoid multiple borders competing in nested components.



\---



\# 15. ELEVATION



Toolbox uses restrained elevation.



Most ordinary content should not appear to float.



Use elevation to communicate actual layering or importance.



Possible levels include:



\### Flat

Normal page content and ordinary surfaces.



\### Subtle

Cards or controls requiring slight separation.



\### Raised

Floating controls, dropdowns, or temporary surfaces.



\### Overlay

Dialogs, menus, sheets, and surfaces that genuinely exist above the primary interface.



When shadow is appropriate, prefer diffuse multi-layered depth over harsh single-layer drop shadows.



Do not create dramatic shadows around ordinary cards.



Elevation should correspond to interface hierarchy.



More shadow does not mean more important.



\---



\# 16. TOOLBARS



Toolbars should prioritize frequently used actions.



Use compact controls.



Keep related actions together.



Separate distinct action groups with spacing before adding visible separators.



Avoid filling toolbars with every action available in the application.



Move infrequent actions into an appropriate overflow menu when necessary.



Toolbar icons should use consistent dimensions.



Toolbar height should remain predictable across related tools.



\---



\# 17. TABS AND SEGMENTED NAVIGATION



Use tabs when users switch between peer views within the same context.



Tabs should:



\- have clear labels

\- show the active state clearly

\- preserve predictable ordering

\- avoid unnecessary decoration



Do not use tabs for unrelated navigation.



Do not create tabs when two or three simple filters would express the interaction better.



Do not create horizontally unusable tab bars on mobile.



Use responsive behavior when the available width becomes constrained.



\---



\# 18. MENUS AND DROPDOWNS



Menus should be concise and scannable.



Group related actions.



Avoid unnecessarily deep nested menus.



Destructive actions should remain distinguishable from ordinary actions.



Menu items should use consistent:



\- height

\- icon size

\- label alignment

\- spacing



Dropdown width should follow content within reasonable bounds.



Do not create enormous dropdown surfaces for a handful of short options.



\---



\# 19. MODALS AND SHEETS



Dialogs should focus on a specific task, decision, or contained workflow.



Maintain consistent:



\- radius

\- padding

\- heading structure

\- action placement

\- close behavior

\- maximum width



Do not make every secondary interaction a modal.



Avoid stacking dialogs.



Use sheets or full-screen presentations on constrained displays when a floating desktop-style modal would become cramped.



Primary and secondary actions should remain easy to locate.



\---



\# 20. LISTS



Lists should optimize scanning.



Repeated items should align consistently.



Maintain predictable positions for:



\- icons

\- titles

\- metadata

\- status

\- trailing actions



Avoid turning every list item into an oversized card.



Dense information often works better as a clean list than a grid of decorative tiles.



List rows should provide adequate interaction area without becoming unnecessarily tall.



\---



\# 21. TABLES



Use tables when users need to compare structured values across rows and columns.



Do not use a table simply because the data happens to be structured.



Tables should maintain:



\- readable headers

\- consistent alignment

\- sensible column widths

\- compact but usable row heights

\- predictable actions

\- responsive behavior



Numeric values should generally align consistently.



Long content should not destroy the entire table layout.



On small screens, deliberately choose an appropriate strategy:



\- horizontal scrolling

\- reduced columns

\- stacked detail

\- alternate mobile representation



Do not simply crush every column until nothing is readable.



\---



\# 22. EMPTY, LOADING, AND ERROR COMPONENTS



System states are part of the design system.



They should not appear as unrelated mini-products.



\### Empty



Lightweight.



Explain what is absent and what action is available when necessary.



\### Loading



Communicate activity without excessive motion.



Match the expected content structure when using skeletons.



\### Error



Explain the failure in user-facing language.



Provide recovery action when appropriate.



Maintain consistent spacing, typography, iconography, and action treatment across these states.



\---



\# 23. STRUCTURED RENDERERS



Specialized Toolbox renderers should feel integrated with the surrounding interface.



This includes:



\- maps

\- image galleries

\- tables

\- charts

\- mathematics

\- calendars

\- files

\- financial data

\- other structured tool output



Renderers may have specialized internal layouts.



Their surrounding controls, typography, spacing, actions, and interaction states should still follow the Toolbox design system.



Do not make each renderer visually resemble an unrelated third-party application.



\---



\# 24. PAGE STRUCTURE



A typical Toolbox page may contain:



```text

Page header

&#x20;   Title

&#x20;   Optional supporting context

&#x20;   Optional actions



Primary workspace/content



Optional secondary controls or information

```



This is not a mandatory template.



Tool-specific workflows may require different compositions.



Avoid automatically adding:



\- hero banners

\- introductory cards

\- statistics

\- promotional sections

\- redundant descriptions



The tool itself should usually remain the focus.



\---



\# 25. PAGE WIDTH AND CONTENT WIDTH



Do not use one universal maximum width for every tool.



Content width should follow function.



Examples:



Reading-oriented content

→ constrained for readability



Forms and settings

→ moderate width



Editors, maps, diagrams, terminals, tables, file explorers

→ may use substantially more available space



Interactive workspaces

→ may use the full viewport when useful



Do not artificially constrain tools that benefit from space.



Do not stretch long-form text across enormous displays.



\---



\# 26. RESPONSIVE SYSTEM



Responsive design should preserve hierarchy, not merely shrink dimensions.



Prefer fluid layout behavior.



When space becomes constrained:



1\. preserve essential content

2\. preserve primary actions

3\. simplify secondary layout

4\. stack appropriate groups

5\. collapse secondary controls when necessary

6\. remove decorative complexity before functional content



Do not hide essential functionality solely because the viewport is small.



Do not create mobile layouts by applying `width: 100%` to everything.



Touch interfaces require deliberate spacing and interaction behavior.



\---



\# 27. MOTION TOKENS



Motion should use a limited set of durations and easing behaviors.



Prefer semantic categories such as:



\### Fast

Immediate feedback:



\- hover

\- press

\- small state changes



\### Normal

Common interface transitions:



\- menus

\- expanding controls

\- switching states

\- small panels



\### Slow

Larger spatial transitions or deliberate storytelling interactions.



Slow motion should be uncommon in ordinary productivity workflows.



Do not assign arbitrary animation durations component by component.



Prefer shared motion tokens.



Avoid bouncy or exaggerated spring behavior unless a highly specific interaction requires it.



Motion should feel controlled and precise.



\---



\# 28. INTERACTION FEEDBACK



Every interactive control should provide appropriate feedback.



Feedback may include:



\- hover

\- focus

\- pressed state

\- selected state

\- progress

\- success

\- failure



Feedback should be immediate enough that the user understands their action was registered.



Do not animate controls so heavily that feedback feels delayed.



Do not use motion as the only indication of state.



\---



\# 29. RESPONSIVE COMPONENT TRANSFORMATION



Components may change presentation across viewport sizes while preserving their purpose.



Examples:



Desktop modal

→ mobile sheet or full-screen surface



Multi-column workspace

→ stacked or navigable mobile workspace



Toolbar

→ compact toolbar with overflow



Wide table

→ horizontally scrollable or alternate mobile representation



Side panel

→ drawer or dedicated mobile view



Transformation should preserve functionality and context.



Do not force the exact desktop geometry onto mobile.



\---



\# 30. VISUAL DENSITY



Toolbox does not have one universal density level.



Density follows the task.



Use higher density for:



\- code

\- terminals

\- tables

\- file lists

\- technical editors

\- data-heavy tools



Use more breathing room for:



\- reading

\- onboarding

\- explanatory interfaces

\- focused forms

\- content presentation



Do not make technical interfaces unnecessarily spacious.



Do not make content interfaces unnecessarily cramped.



Both should still use the same underlying spacing and typography system.



\---



\# 31. CONSISTENCY BEFORE NOVELTY



Before creating a visually novel component, ask:



\- Does Toolbox already solve this?

\- Can an existing component be extended?

\- Is the new visual distinction communicating something meaningful?

\- Will this introduce another competing pattern?

\- Will users understand it immediately?



Novelty is justified when function genuinely requires a new pattern.



Novelty is not justified because the existing pattern feels boring.



Boring and predictable is often excellent interface design.



\---



\# 32. DESIGN SYSTEM EVOLUTION



The design system may evolve.



Evolution should be deliberate.



When a genuinely better pattern is introduced:



1\. determine whether it should become reusable

2\. identify related existing patterns

3\. avoid creating unnecessary parallel conventions

4\. document or tokenize the new pattern when appropriate

5\. migrate related components only when doing so is justified



Do not create permanent inconsistency because changing one existing component was inconvenient.



Do not rewrite the entire application because one new component uses a better pattern.



Evolution should be incremental and coherent.



\---



\# 33. IMPLEMENTATION FALLBACKS



When an exact design value is not defined:



First:

inspect existing Toolbox implementations.



Second:

identify the dominant existing convention.



Third:

reuse that convention.



Only when no meaningful convention exists should a new value be introduced.



When introducing a new value:



\- choose a simple value

\- align it with nearby design values

\- make it reusable if repetition is likely

\- avoid unnecessary precision

\- avoid creating another nearly identical token



Do not invent arbitrary design values simply because this document does not specify a number.



The existing product is part of the design specification.



\---



\# 34. DESIGN SYSTEM CHECK



When creating or modifying a reusable component, verify:



\- typography matches an established role

\- spacing follows the spacing system

\- radius matches component purpose

\- icons follow the icon system

\- control height aligns with related controls

\- hierarchy is clear

\- interactive states exist

\- mobile behavior is deliberate

\- keyboard/focus behavior remains usable

\- motion follows established motion behavior

\- unnecessary decoration has not been introduced

\- an existing shared component was not duplicated



If the component requires several exceptions to fit the design system, reconsider the component structure before adding more exceptions.



\---



\# 35. FINAL PRINCIPLE



The Toolbox design system exists to make hundreds of different capabilities feel like parts of one product.



Consistency should not erase the identity or functional needs of individual tools.



Specialized interfaces are allowed.



Arbitrary interfaces are not.



When uncertain:



reuse before creating,

simplify before decorating,

align before adding,

space before bordering,

clarify before animating,

and preserve function above everything else.

