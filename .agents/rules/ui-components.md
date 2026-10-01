\---

trigger: always\_on

\---



\# TOOLBOX — UI COMPONENTS



This file governs the creation, reuse, extension, composition, and behavior of reusable UI components across Toolbox.



It supplements:



\- `UI Core`

\- `UI Design System`

\- `Responsive UI`

\- `Motion \& Interaction`



Toolbox contains many tools and workflows.



That scale makes component discipline essential.



The objective is not to force every interface into identical components.



The objective is to prevent unnecessary duplication while maintaining a coherent product language.



\---



\# 1. CORE COMPONENT PRINCIPLE



Before creating a component:



1\. Search for an existing component.

2\. Search for a related component.

3\. Inspect how neighboring Toolbox interfaces solve the problem.

4\. Determine whether an existing component can be reused.

5\. Determine whether an existing component can be extended cleanly.

6\. Create a new component only when the requirement is genuinely different.



Prefer:



reuse

→ composition

→ extension

→ new component



in that order when practical.



Do not create a new component merely because modifying an existing one requires understanding it first.



\---



\# 2. COMPONENT DISCOVERY



Before implementing common UI, search the codebase for existing examples.



This applies especially to:



\- buttons

\- icon buttons

\- inputs

\- textareas

\- selectors

\- pills

\- tags

\- badges

\- tabs

\- menus

\- dropdowns

\- tooltips

\- cards

\- list rows

\- tables

\- modals

\- dialogs

\- sheets

\- drawers

\- toolbars

\- navigation

\- search controls

\- file components

\- loading states

\- empty states

\- error states

\- notifications

\- Assistant renderers



Do not assume a component does not exist because it is not located where expected.



Toolbox is large.



Search before inventing.



\---



\# 3. REUSE VS EXTEND VS CREATE



Use an existing component when:



\- its purpose matches

\- its structure matches

\- required differences are already supported

\- the result remains semantically correct



Extend an existing component when:



\- the underlying interaction is the same

\- the visual language is the same

\- the difference can be expressed as a meaningful variant

\- the extension is likely to be useful elsewhere



Create a new component when:



\- the interaction is genuinely different

\- the semantic purpose is different

\- extending the existing component would create confusing conditional logic

\- the component represents a reusable new pattern



Do not create a new component merely because it needs slightly different spacing.



Do not extend one component until it becomes responsible for unrelated interface concepts.



\---



\# 4. COMPONENT PURPOSE



Every reusable component should have a clear purpose.



A component should answer:



\- What problem does this solve?

\- Where should it be used?

\- What should it not be used for?

\- What states does it support?

\- What content does it accept?

\- How does it behave responsively?



If its purpose cannot be explained clearly, its abstraction may be wrong.



\---



\# 5. COMPONENT BOUNDARIES



Create component boundaries around meaningful interface concepts.



Good boundaries often represent:



\- repeated visual structures

\- repeated interactions

\- independently testable behavior

\- reusable interface primitives

\- coherent functional regions



Do not split components merely to reduce line count.



Do not combine unrelated interface responsibilities merely to reduce file count.



Component boundaries should reflect behavior and meaning.



\---



\# 6. COMPOSITION OVER MONOLITHS



Prefer composition when an interface contains reusable substructures.



For example:



```text

Dialog

├── DialogHeader

├── DialogContent

└── DialogActions

```



may be clearer than one enormous component with dozens of configuration flags.



Similarly:



```text

Card

├── CardHeader

├── CardContent

├── CardMetadata

└── CardActions

```



may be appropriate when those regions genuinely recur.



Do not create subcomponents solely to imitate a component library.



Composition should simplify implementation and understanding.



\---



\# 7. AVOID PROP EXPLOSION



Be suspicious of components requiring large collections of boolean props such as:



```text

compact

small

rounded

flat

minimal

borderless

transparent

centered

mobile

dark

largeIcon

noPadding

special

```



This often indicates that unrelated visual concepts have been forced into one component.



Prefer:



\- meaningful variants

\- composition

\- slots

\- separate specialized components



when they express the structure more clearly.



Do not create configuration systems more complicated than the UI they represent.



\---



\# 8. VARIANTS



Variants should represent meaningful recurring differences.



Examples:



```text

Button:

primary

secondary

ghost

destructive

```



Variants should not represent arbitrary local styling.



Avoid variants such as:



```text

slightlySmaller

homepageVersion

specialToolButton

newStyle

v2

```



unless they describe a genuine reusable concept.



Variant names should communicate purpose.



Do not encode page names into generic component variants.



\---



\# 9. SIZE VARIANTS



Size variants should follow the Toolbox Design System.



Prefer a small set such as:



\- compact

\- standard

\- prominent



when the component genuinely needs multiple sizes.



Do not create tiny differences between variants.



If two sizes are visually and functionally almost identical, consolidate them.



Size should correspond to interaction context, not arbitrary visual preference.



\---



\# 10. DEFAULTS



Reusable components should have sensible defaults.



The most common use should require the least configuration.



Defaults should follow the established Toolbox design language.



Do not require every caller to specify:



\- ordinary radius

\- ordinary padding

\- ordinary icon size

\- ordinary typography

\- ordinary motion



when those values are already part of the component's standard behavior.



Good defaults reduce inconsistency.



\---



\# 11. ESCAPE HATCHES



Avoid unrestricted styling escape hatches unless necessary.



A generic component should not require every caller to override its internals.



If repeated overrides appear, determine whether:



\- a legitimate variant is missing

\- the component abstraction is wrong

\- the design system needs another pattern



Occasional contextual layout styling is acceptable.



Repeated visual overrides are evidence that the component system needs attention.



\---



\# 12. COMPONENT OWNERSHIP OF STYLING



A reusable component should normally own its internal visual structure.



Its parent should control external layout concerns such as:



\- placement

\- available width

\- surrounding spacing

\- grid position



The component should control internal concerns such as:



\- internal padding

\- internal alignment

\- control height

\- icon spacing

\- state appearance



Avoid callers reaching deeply into component internals to restyle them.



\---



\# 13. COMPONENT OWNERSHIP OF STATE



Keep state as close as practical to the behavior it controls.



A component may own local presentation state such as:



\- open/closed

\- expanded/collapsed

\- temporary selection

\- hover-derived behavior

\- local interaction state



Application or domain state should not be hidden unnecessarily inside visual primitives.



Do not make basic UI components responsible for business logic.



Separate:



presentation

from

domain behavior



where doing so improves clarity.



\---



\# 14. CONTROLLED AND UNCONTROLLED BEHAVIOR



When reusable interactive components need external state control, support it deliberately.



Do not accidentally create components whose state is half-controlled internally and half-controlled externally.



State ownership should be understandable.



Avoid synchronization effects created solely to keep duplicate sources of truth aligned.



\---



\# 15. BUTTON COMPONENTS



Use shared button components.



Do not create page-specific button implementations unless the interaction genuinely requires something different.



Buttons should support appropriate combinations of:



\- primary

\- secondary

\- ghost

\- destructive

\- icon-only

\- compact

\- standard



Buttons should consistently handle:



\- hover

\- focus

\- active

\- disabled

\- loading



Loading buttons should prevent accidental duplicate actions where appropriate.



Do not replace the button label with a spinner in a way that causes disruptive width changes when avoidable.



\---



\# 16. ICON BUTTONS



Icon buttons are appropriate when:



\- the icon is familiar

\- space is constrained

\- surrounding context makes the action clear



Icon buttons must have accessible names.



Use tooltips when they materially improve discoverability.



Do not create mystery controls.



Icon buttons should use consistent:



\- dimensions

\- icon scale

\- alignment

\- interaction states



The clickable area should not be limited to the visible SVG path.



\---



\# 17. INPUT COMPONENTS



Shared inputs should provide consistent:



\- height

\- padding

\- typography

\- radius

\- focus state

\- disabled state

\- error state

\- label relationship



Support common structural needs without turning the input into a giant configuration object.



Possible composable elements include:



\- label

\- helper text

\- prefix

\- suffix

\- validation message



Do not duplicate complete input implementations for trivial icon or label differences.



\---



\# 18. TEXTAREAS AND EDITORS



Do not treat textareas as ordinary single-line inputs with more height.



Support:



\- multiline content

\- appropriate resizing

\- scrolling

\- keyboard behavior

\- long content

\- validation



Rich editors and code editors are specialized components.



Do not force them through ordinary input abstractions when doing so harms their behavior.



\---



\# 19. SELECTORS



Selectors should use a shared interaction pattern when their purpose is equivalent.



This includes:



\- dropdown selects

\- compact selectors

\- segmented controls

\- searchable selectors

\- multi-select controls



Choose the component according to the selection problem.



Do not use a giant dropdown for three obvious modes when a compact segmented control would be clearer.



Do not use pills for complex selections merely because Toolbox uses pills elsewhere.



\---



\# 20. PILLS



Use the shared pill language.



Pills may represent:



\- filters

\- tags

\- categories

\- states

\- compact modes



Keep pill behavior consistent.



If selectable, selection must be clear.



If removable, removal interaction must be obvious and accessible.



Do not create custom pill geometry for each feature.



\---



\# 21. BADGES



Badges should be reusable state or metadata components.



Keep them compact.



Do not make a badge responsible for the layout of the surrounding card or row.



Status badges should use semantic state rather than arbitrary local styling.



Do not create separate badge components solely because the text differs.



\---



\# 22. CARD COMPONENTS



Use cards when content forms a meaningful grouped unit.



A card abstraction should not force every card to have identical anatomy.



Support composition where appropriate.



Possible regions include:



\- header

\- title

\- metadata

\- body

\- actions



Do not require empty regions merely to satisfy a template.



Avoid card components containing large amounts of page-specific business logic.



\---



\# 23. LIST ITEM COMPONENTS



Repeated list items should share predictable anatomy.



Typical regions may include:



```text

leading

primary content

secondary content

status

trailing actions

```



Not every list needs every region.



Rows should remain scannable.



Do not turn list rows into miniature dashboards.



Trailing actions should not overpower the primary information.



\---



\# 24. MENU COMPONENTS



Menus should share:



\- item height

\- spacing

\- icon placement

\- selected state

\- destructive treatment

\- keyboard behavior

\- focus behavior



Use menu groups when useful.



Use separators only when they clarify grouping.



Do not create custom menu systems inside individual tools unless the interaction genuinely differs.



\---



\# 25. DROPDOWNS AND POPOVERS



Dropdown and popover components should handle:



\- positioning

\- viewport collision

\- focus

\- dismissal

\- escape behavior

\- outside interaction

\- responsive constraints



Do not reimplement floating positioning independently in every feature.



The component should understand when it cannot fit in its preferred direction.



\---



\# 26. TOOLTIP COMPONENTS



Tooltips provide supplementary clarification.



They must not contain essential information that has no other route.



Use them for:



\- unfamiliar icon actions

\- abbreviated controls

\- concise explanations



Keep tooltip content short.



Do not put complex interactive workflows inside tooltips.



Do not display tooltips aggressively on touch devices.



\---



\# 27. MODAL COMPONENTS



Use shared modal/dialog infrastructure.



Dialogs should handle:



\- focus management

\- dismissal

\- escape

\- backdrop interaction

\- scrolling

\- viewport constraints

\- accessibility

\- responsive transformation



Do not create a new modal implementation for each tool.



Specialized dialog content may vary.



Dialog behavior should remain predictable.



\---



\# 28. SHEETS AND DRAWERS



Use shared sheet/drawer primitives for interfaces that enter from viewport boundaries.



They should handle:



\- direction

\- focus

\- dismissal

\- contained scrolling

\- responsive sizing

\- gesture interaction when supported



Do not duplicate drawer logic across navigation, filters, files, and inspectors.



Extend the shared primitive where appropriate.



\---



\# 29. TABS



Tabs should share:



\- active-state treatment

\- keyboard navigation

\- focus behavior

\- typography

\- spacing

\- indicator behavior



Do not implement clickable text styled vaguely like tabs when a proper tab component exists.



Tabs should represent peer views within a shared context.



Use semantic tab behavior where appropriate.



\---



\# 30. TOOLBARS



Toolbar components should support composition of:



\- action groups

\- selectors

\- mode controls

\- status

\- overflow



Do not hardcode every toolbar into one universal structure.



Toolbars vary by tool.



Their controls and grouping logic should still share the Toolbox language.



\---



\# 31. SEARCH COMPONENTS



Search interfaces should share recognizable behavior.



Common functionality may include:



\- query input

\- clear action

\- loading

\- results

\- no results

\- keyboard submission

\- suggestions

\- filters



Do not create visually unrelated search fields across Toolbox.



Search behavior may vary according to domain.



Visual language should remain coherent.



\---



\# 32. TABLE COMPONENTS



Shared table primitives may provide:



\- headers

\- rows

\- cells

\- sorting

\- selection

\- loading

\- empty state

\- row actions



Do not force every dataset into one giant universal table component.



Complex data tools may require specialized table behavior.



Reuse common primitives without sacrificing domain-specific usability.



\---



\# 33. FILE COMPONENTS



File UI should use shared representations.



Reusable file components may include:



\- file icon

\- file row

\- file card

\- folder row

\- folder card

\- file metadata

\- file actions

\- file preview trigger



File identity and type representation should remain consistent.



Do not recreate file-type logic in every interface.



Centralize type-to-icon behavior.



\---



\# 34. ASSISTANT RESULT COMPONENTS



Assistant structured results should use reusable renderers.



Examples:



\- map result

\- file result

\- calendar result

\- table result

\- chart result

\- image result

\- mathematical result

\- financial result



Do not create a new presentation for the same structured result depending on which Assistant tool produced it.



The renderer should represent the data type, not the internal API source.



\---



\# 35. LOADING COMPONENTS



Use shared loading primitives.



Possible primitives include:



\- spinner

\- skeleton

\- progress

\- inline activity indicator

\- status indicator



Choose according to context.



Do not create bespoke loading animations for ordinary components.



Loading components should not leak implementation details.



\---



\# 36. EMPTY STATE COMPONENTS



Empty states may share reusable structural primitives.



They should support:



\- concise title

\- optional explanation

\- optional action

\- optional restrained icon



Do not force every empty state into an oversized centered card.



The empty-state component should adapt to its context.



\---



\# 37. ERROR COMPONENTS



Reusable error components should support different levels of failure.



Examples:



\### Inline



A field or local component failed.



\### Section



A portion of the page failed.



\### Page



The primary interface cannot load.



\### Recoverable



Retry or another action is available.



The component should communicate failure without exposing internal implementation.



Do not use the same enormous error treatment for every failure.



\---



\# 38. NOTIFICATIONS AND TOASTS



Use shared notification infrastructure.



Notifications should support appropriate states such as:



\- information

\- success

\- warning

\- error



Do not use toast notifications for information that must remain visible.



Do not use notifications as a substitute for proper inline validation.



Avoid flooding users with notifications for routine successful interactions.



\---



\# 39. CONFIRMATION COMPONENTS



Not every action needs confirmation.



Use confirmation when the action is:



\- destructive

\- difficult to reverse

\- unusually consequential

\- likely to be triggered accidentally



Do not create confirmation fatigue.



Where undo is practical, undo may be preferable to a confirmation dialog.



Confirmation UI should state the actual consequence clearly.



Avoid generic:



"Are you sure?"



when more specific wording is possible.



\---



\# 40. NAVIGATION COMPONENTS



Shared navigation should provide consistent:



\- active state

\- item anatomy

\- icon alignment

\- spacing

\- focus behavior

\- responsive transformation



Navigation components should not contain unrelated page business logic.



Desktop and mobile navigation may use different presentations while representing the same navigation model.



\---



\# 41. COMPONENT STATES



Every interactive reusable component must consider relevant states.



Potential states include:



\- default

\- hover

\- focus

\- active

\- selected

\- disabled

\- loading

\- empty

\- error

\- expanded

\- collapsed



Not every component requires every state.



Do not implement only the ideal/default state.



State behavior is part of the component.



\---



\# 42. DISABLED STATE



Disabled components should clearly communicate that interaction is unavailable.



Do not make disabled controls disappear unless hiding them is intentionally better for the workflow.



Disabled text should remain readable.



Do not rely solely on reduced opacity if doing so destroys legibility.



Where useful, explain why an important action is unavailable.



\---



\# 43. LOADING STATE



When a component initiates an asynchronous action, determine whether it needs local loading feedback.



Avoid blocking the entire page for a local operation.



Local actions should generally receive local feedback.



Prevent duplicate actions where appropriate.



Preserve layout stability during loading.



\---



\# 44. ERROR STATE



A component should fail gracefully.



Do not allow one failed subcomponent to destroy an entire page when the rest can remain functional.



Errors should remain proportional to their scope.



Local failures should usually produce local error UI.



\---



\# 45. EMPTY STATE



Components rendering collections must handle zero items intentionally.



Do not assume data will always exist.



Zero is a valid state.



Do not inject sample data to avoid designing the empty state.



\---



\# 46. CONTENT FLEXIBILITY



Reusable components must survive realistic content.



Consider:



\- long titles

\- long names

\- long filenames

\- long numbers

\- missing metadata

\- multiple badges

\- user-generated text

\- generated Assistant content

\- unusual aspect ratios

\- zero items

\- many items



Do not design reusable components exclusively around ideal demo content.



\---



\# 47. TEXT OVERFLOW



Choose overflow behavior deliberately.



Options include:



\- wrap

\- truncate

\- scroll

\- expand



Do not apply ellipsis automatically.



Truncation is appropriate only when the hidden content is nonessential or accessible elsewhere.



Never truncate information required to distinguish important items when avoidable.



\---



\# 48. RESPONSIVE COMPONENTS



Reusable components must not assume a single container width.



A component may appear inside:



\- full pages

\- sidebars

\- dialogs

\- split views

\- drawers

\- Assistant results

\- mobile screens



Use container-aware behavior when appropriate.



Do not encode page-specific breakpoints inside generic components without reason.



\---



\# 49. COMPONENT MOTION



Reusable components should use established Toolbox motion behavior.



Do not give ordinary components bespoke animation personalities.



Similar components should transition similarly.



Motion belongs to the component when it describes the component's state.



Motion belongs to the parent/workflow when it describes a larger spatial transition.



\---



\# 50. ACCESSIBILITY



Reusable components must implement accessibility at the component level wherever practical.



This includes:



\- semantic elements

\- accessible names

\- labels

\- keyboard interaction

\- focus behavior

\- appropriate ARIA when necessary

\- reduced-motion compatibility

\- usable touch targets



Do not require every caller to manually repair the accessibility of a shared primitive.



Accessibility defects in shared components multiply across Toolbox.



Fix them at the source.



\---



\# 51. SEMANTIC HTML



Use native semantic elements where they correctly represent the interaction.



Prefer actual:



\- buttons

\- links

\- inputs

\- labels

\- lists

\- headings

\- tables



over generic `div` elements pretending to be those things.



Do not rebuild native interaction behavior without a reason.



Native semantics improve:



\- accessibility

\- keyboard behavior

\- browser behavior

\- maintainability



\---



\# 52. COMPONENT API CLARITY



A reusable component's API should be understandable from its name and props.



Prefer:



```text

variant="primary"

size="compact"

disabled

loading

```



over obscure implementation-oriented options.



Avoid exposing internal styling concepts unnecessarily.



Callers should express intent.



The component should decide how that intent is rendered according to the design system.



\---



\# 53. COMPONENT NAMES



Names should describe purpose.



Prefer:



```text

FileCard

SearchInput

ResultTable

AssistantComposer

CalendarEvent

IconButton

```



Avoid:



```text

CoolCard

ModernButton

NewInput

BetterModal

CardV2

FinalButton

ButtonNew

```



Version numbers and adjectives usually indicate unresolved component duplication.



Name the concept, not the history of attempts to implement it.



\---



\# 54. DUPLICATION



When similar components are discovered:



Do not immediately merge them.



First determine:



\- whether they serve the same purpose

\- whether their differences are meaningful

\- whether merging would simplify or complicate the API



Merge genuine duplicates.



Keep genuinely different concepts separate.



The goal is coherent reuse, not the smallest possible number of files.



\---



\# 55. REFACTORING SHARED COMPONENTS



Changes to shared components have broad consequences.



Before modifying one:



1\. identify its consumers

2\. understand existing variants

3\. understand current behavior

4\. preserve expected functionality

5\. avoid silently changing unrelated screens

6\. verify representative usages afterward



Do not casually change shared primitives to fix one local page.



A local exception may sometimes be safer than a global behavioral change.



\---



\# 56. DEPRECATION



When replacing an established component:



Do not create a permanent parallel system without a migration reason.



If a new component supersedes an old one:



\- establish why

\- use the new component for appropriate new work

\- migrate old usage deliberately

\- remove obsolete implementations when safe



Avoid endless coexistence of:



```text

Button

Button2

NewButton

ModernButton

PremiumButton

```



Toolbox has suffered enough merely by existing at scale.



\---



\# 57. THIRD-PARTY COMPONENTS



Do not introduce a third-party component library for a trivial need.



Before adding one:



\- inspect existing Toolbox infrastructure

\- evaluate bundle cost

\- evaluate styling compatibility

\- evaluate accessibility

\- evaluate maintenance impact

\- determine whether the functionality already exists



If a third-party primitive is used, adapt it to Toolbox.



Do not allow it to introduce an unrelated visual language.



\---



\# 58. SPECIALIZED COMPONENTS



Specialized tools may require components not used elsewhere.



That is acceptable.



Examples include:



\- chess board

\- terminal

\- code editor

\- map

\- anatomy viewer

\- automobile visualization

\- Mind canvas

\- architecture editor

\- mathematical renderer



Do not force specialized interactions into generic components when doing so reduces usability.



Specialized components should still reuse Toolbox primitives around their specialized core.



For example:



specialized canvas

\+

standard toolbar

\+

standard buttons

\+

standard menus

\+

standard dialog behavior



creates specialization without fragmentation.



\---



\# 59. COMPONENT PERFORMANCE



Reusable components should avoid unnecessary work.



Be careful with:



\- unnecessary rerenders

\- huge DOM structures

\- expensive animations

\- repeated computations

\- unnecessary listeners

\- large unvirtualized collections



Performance concerns are especially important for components repeated many times.



One inefficient card may be invisible.



Five hundred inefficient cards are an architecture lecture delivered by the browser fan.



\---



\# 60. LARGE COLLECTIONS



Components rendering large collections should consider:



\- pagination

\- incremental loading

\- virtualization

\- efficient rendering

\- stable keys

\- lightweight row components



Do not introduce virtualization automatically for tiny collections.



Use complexity when scale requires it.



\---



\# 61. COMPONENT VERIFICATION



Before considering a new or modified reusable component complete, verify:



1\. an equivalent component did not already exist

2\. its purpose is clear

3\. its API expresses intent

4\. defaults follow Toolbox conventions

5\. variants are meaningful

6\. unnecessary props were avoided

7\. default state works

8\. hover state works where relevant

9\. focus state works

10\. active state works where relevant

11\. selected state works where relevant

12\. disabled state works where relevant

13\. loading state works where relevant

14\. error state works where relevant

15\. empty state works where relevant

16\. long content works

17\. narrow containers work

18\. mobile interaction works

19\. keyboard interaction works where applicable

20\. touch interaction works where applicable

21\. motion follows Toolbox conventions

22\. accessibility remains intact

23\. existing consumers were not unintentionally broken



Inspect the rendered component.



Do not verify reusable UI exclusively by reading source code.



\---



\# 62. FINAL COMPONENT STANDARD



Toolbox components should reduce inconsistency without reducing flexibility.



The component system exists to make building new Toolbox interfaces easier and safer over time.



It should prevent repeated reinvention while still allowing specialized tools to behave according to their function.



When uncertain:



search before creating,

reuse before duplicating,

compose before bloating,

extend before forking,

specialize only when function requires it,

and keep component APIs simpler than the interfaces they create.

