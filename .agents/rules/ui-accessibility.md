\---

trigger: always\_on

\---



\# TOOLBOX — UI ACCESSIBILITY



This file governs accessibility across all Toolbox user interfaces.



It supplements:



\- `UI Core`

\- `UI Design System`

\- `Responsive UI`

\- `Motion \& Interaction`

\- `UI Components`



Accessibility is part of correct UI implementation.



It is not optional polish.



It is not a final checklist applied after the interface is finished.



Accessible behavior should be built into components, workflows, interactions, and structured renderers from the beginning.



The objective is to make Toolbox understandable and operable across different:



\- input methods

\- visual abilities

\- motor abilities

\- motion sensitivities

\- screen sizes

\- assistive technologies



Do not reduce functionality unnecessarily for users who interact with Toolbox differently.



\---



\# 1. CORE ACCESSIBILITY PRINCIPLE



Every important interface should remain understandable and operable without depending exclusively on:



\- color

\- hover

\- precise pointer movement

\- animation

\- sound

\- drag-and-drop

\- visual position

\- tiny controls

\- perfect vision

\- a specific input device



Whenever an interaction depends on one of these, determine whether an appropriate alternative is required.



Accessibility should preserve capability, not merely appearance.



\---



\# 2. SEMANTIC HTML FIRST



Use native semantic HTML when it correctly represents the interaction.



Prefer actual:



\- `<button>`

\- `<a>`

\- `<input>`

\- `<textarea>`

\- `<select>`

\- `<label>`

\- `<form>`

\- `<nav>`

\- `<main>`

\- `<header>`

\- `<section>`

\- `<article>`

\- `<table>`

\- headings

\- lists



over generic containers imitating those elements.



Do not use:



```text id="k8k2vj"

<div onClick={...}>

```



as a substitute for a button when the element is functionally a button.



Native elements provide useful behavior automatically.



Do not rebuild browser semantics unnecessarily.



\---



\# 3. ARIA IS NOT A SUBSTITUTE FOR SEMANTICS



Use ARIA when native semantics cannot adequately describe the interface.



Do not add ARIA merely to make markup appear more accessible.



Prefer:



native semantic element

→ correct native behavior

→ ARIA only when necessary



Incorrect ARIA can make an interface less understandable.



ARIA should describe actual state and behavior.



Do not claim accessibility states that the component does not implement.



\---



\# 4. KEYBOARD ACCESS



Important interactive functionality should be keyboard accessible where the platform and interaction make keyboard use relevant.



Users should be able to:



\- navigate controls

\- activate actions

\- operate menus

\- use dialogs

\- change selections

\- submit forms

\- dismiss temporary surfaces



without requiring a mouse.



Do not create clickable elements that cannot receive keyboard focus.



Do not make hover the only route to an action.



\---



\# 5. TAB ORDER



Keyboard focus should follow a logical sequence.



In ordinary interfaces, tab order should generally follow visual and document order.



Do not use arbitrary positive `tabindex` values to manually construct complicated focus sequences.



Prefer correcting the DOM structure.



Hidden elements must not remain unexpectedly focusable.



Disabled or unavailable interactions should not create confusing keyboard stops.



\---



\# 6. FOCUS VISIBILITY



Keyboard focus must be visible.



Do not remove focus outlines without providing an appropriate replacement.



Focus treatment should clearly identify the active element.



It should remain distinguishable from:



\- hover

\- selection

\- active/pressed state

\- ordinary borders



Focus indicators should not be clipped by surrounding containers.



Do not make focus so subtle that users must search for it.



\---



\# 7. FOCUS MANAGEMENT



When the interface changes substantially, manage focus deliberately.



Examples include:



\- opening dialogs

\- closing dialogs

\- opening menus

\- submitting forms

\- displaying validation failures

\- switching major views

\- creating or deleting important items



When a temporary interface closes, return focus to a sensible location where practical.



Do not throw focus unpredictably to the top of the page.



Do not move focus merely because something visually changed.



\---



\# 8. MODALS AND DIALOGS



Dialogs require deliberate focus behavior.



When a modal opens:



\- focus should enter the dialog appropriately

\- background interaction should not remain accidentally available

\- keyboard users should remain within the active modal where appropriate

\- Escape should dismiss when dismissal is allowed



When the dialog closes:



\- restore focus to the triggering control or another sensible location



Dialog title and purpose should be understandable to assistive technology.



Do not create inaccessible custom modal behavior when shared dialog infrastructure already handles these requirements.



\---



\# 9. MENUS



Menus must support predictable keyboard interaction when implemented as true application menus.



Ensure:



\- menu items are focusable appropriately

\- current focus is visible

\- disabled items are understandable

\- Escape dismisses where appropriate

\- focus returns sensibly after dismissal



Do not assign complex menu semantics to a simple list of ordinary links unless those semantics actually match the interaction.



\---



\# 10. LINKS VS BUTTONS



Use links for navigation.



Use buttons for actions.



Do not use a button merely because styling a link is inconvenient.



Do not use a link with a meaningless destination to simulate a button.



The semantic distinction matters for:



\- keyboard behavior

\- assistive technology

\- browser behavior

\- user expectations



Visual appearance does not determine semantics.



Purpose does.



\---



\# 11. ICON-ONLY CONTROLS



Icon-only controls require accessible names.



A screen reader should not encounter controls announced merely as:



\- button

\- graphic

\- unlabeled



Provide an accessible label describing the action.



Examples:



```text id="r20a6n"

Close

Delete file

Open settings

Copy

More actions

```



The label should describe the action, not the icon's appearance.



For example:



Prefer:



`Delete file`



over:



`Trash can icon`



\---



\# 12. TOOLTIP ACCESSIBILITY



Tooltips may clarify unfamiliar controls.



They must not be the only source of essential information.



Tooltips should work appropriately for keyboard focus where relevant.



Do not assume hover exists.



Do not place complex interactive content inside ordinary tooltips.



A tooltip should supplement an accessible control, not repair an inaccessible one.



\---



\# 13. TOUCH TARGETS



Interactive targets should be comfortably usable with touch.



The visible icon may be small.



The interactive area should not be unnecessarily tiny.



Pay particular attention to:



\- close buttons

\- overflow menus

\- file actions

\- toolbar controls

\- calendar controls

\- map controls

\- tiny icons

\- adjacent destructive actions



Provide sufficient separation to reduce accidental activation.



Do not pack high-impact actions tightly together merely to save a few pixels.



\---



\# 14. COLOR MUST NOT CARRY MEANING ALONE



Never communicate important state exclusively through color.



This applies to:



\- errors

\- success

\- warnings

\- selected states

\- active states

\- chart categories

\- status

\- validation

\- availability

\- comparison



Combine color with another signal when meaning matters.



Possible signals include:



\- text

\- icon

\- shape

\- position

\- border

\- pattern

\- label



A red border alone should not be the only indication that a field contains an error.



\---



\# 15. CONTRAST AND LEGIBILITY



Text and important controls must remain visually distinguishable from their surroundings.



Do not intentionally weaken important information merely to create a "subtle" aesthetic.



Pay particular attention to:



\- secondary text

\- placeholders

\- disabled controls

\- metadata

\- borders

\- icons

\- focus indicators

\- chart labels

\- text over media

\- translucent surfaces



Subordinate information may be visually quieter.



Quiet does not mean unreadable.



\---



\# 16. TEXT SIZE



Text should remain readable without requiring users to zoom simply to understand ordinary interface content.



Do not reduce font size excessively to force information into limited space.



When content does not fit:



\- reflow

\- wrap

\- reorganize

\- simplify layout



before shrinking important text to uncomfortable sizes.



\---



\# 17. TEXT SCALING



Interfaces should tolerate increased text size where practical.



Do not build layouts that depend on text remaining at exactly one size.



Avoid:



\- fixed-height text containers

\- labels that overlap when enlarged

\- buttons whose text becomes clipped

\- controls that break when text wraps



Allow content to expand.



The interface should degrade gracefully when text requires more space.



\---



\# 18. TYPOGRAPHIC READABILITY



Use typography to improve comprehension.



Maintain:



\- reasonable line length

\- adequate line spacing

\- clear hierarchy

\- sufficient separation between sections



Avoid large blocks of dense centered text.



Avoid excessive uppercase for long labels or content.



Do not use unusual letter spacing that reduces readability.



\---



\# 19. HEADINGS



Use heading structure logically.



Headings should represent document hierarchy, not merely visual size.



Do not choose heading levels solely because their default browser styling looks convenient.



A page should have an understandable structural outline.



Do not skip hierarchy arbitrarily when semantic headings are appropriate.



\---



\# 20. LANDMARKS AND PAGE STRUCTURE



Use meaningful structural regions where appropriate.



Examples include:



\- navigation

\- main content

\- complementary panels

\- headers

\- footers



Do not wrap every container in unnecessary landmarks.



Use structure to make complex interfaces easier to navigate.



Toolbox contains large workspaces.



Semantic structure becomes more valuable as interface complexity increases.



\---



\# 21. FORMS



Forms require explicit accessible relationships.



Fields should have understandable labels.



Do not rely exclusively on placeholders.



Associate:



\- labels

\- descriptions

\- validation messages

\- required state



with the relevant controls where appropriate.



Users should understand:



\- what information is requested

\- whether it is required

\- what format is expected

\- what went wrong



without depending solely on visual placement.



\---



\# 22. PLACEHOLDERS



Placeholder text should provide examples or lightweight guidance.



Do not use placeholder text as the only label for a field that requires persistent context.



Placeholder text disappears after entry.



Users should not need to erase their input to remember what a field represents.



\---



\# 23. REQUIRED FIELDS



Required fields should be communicated clearly.



Do not rely only on:



\- an asterisk with no explanation

\- color

\- placeholder wording



Use a consistent approach.



Avoid marking every field as required when nearly all fields are required if the interface can communicate the exceptions more clearly.



\---



\# 24. VALIDATION



Validation messages should be:



\- understandable

\- specific

\- located near the relevant field

\- programmatically associated where appropriate



Bad:



`Invalid input`



Better:



`Enter a valid email address.`



Do not expose internal validation rules or implementation errors unnecessarily.



When submission fails because several fields contain errors, make it possible to locate those errors efficiently.



\---



\# 25. ERROR IDENTIFICATION



Errors must not rely solely on color.



Use clear text and appropriate visual treatment.



When an error appears dynamically, ensure users can discover it.



Do not automatically move focus for every minor validation event.



For failed form submission, moving focus or attention toward the first meaningful error may be appropriate.



\---



\# 26. SUCCESS STATES



Success should be understandable without requiring users to perceive a brief animation or color change.



If success matters to the workflow, provide persistent or sufficiently perceivable feedback.



Do not flash a green indicator for 200 milliseconds and consider the matter settled.



\---



\# 27. DISABLED CONTROLS



Disabled controls should remain understandable.



Do not make disabled content so faint that it effectively disappears.



If an important control is unavailable and the reason is not obvious, consider explaining why.



Do not use disabled controls when hiding the action entirely would produce a clearer workflow, and vice versa.



Choose according to context.



\---



\# 28. LOADING STATES



Loading should be perceivable without relying solely on animation.



For longer operations, provide meaningful status when possible.



Assistive technologies may need notification when important asynchronous state changes occur.



Do not repeatedly announce minor progress updates in a way that becomes disruptive.



Communicate meaningful changes.



\---



\# 29. LIVE REGIONS



Use live regions carefully for dynamic information that users need to know without moving focus.



Potential examples include:



\- operation completed

\- upload failed

\- search results updated

\- Assistant status changed

\- important validation state changed



Do not mark large continuously changing areas as aggressively live.



Too many announcements can make an interface unusable.



Use the least intrusive announcement behavior that still communicates the information.



\---



\# 30. ASSISTANT STREAMING



Assistant responses may update continuously.



Do not cause assistive technology to announce every token or fragment as it streams.



Streaming output should remain readable during generation.



When appropriate, communicate:



\- response generation started

\- relevant tool status

\- response completed

\- important error



without flooding users with constant announcements.



The final response should remain semantically structured.



\---



\# 31. ASSISTANT STRUCTURE



Assistant responses should preserve semantic structure when they contain:



\- headings

\- lists

\- tables

\- links

\- code

\- mathematical content

\- structured results



Do not flatten everything into visually styled generic containers.



Structured content should remain navigable and understandable.



\---



\# 32. IMAGES



Meaningful images require appropriate alternative descriptions.



Alternative text should communicate the image's purpose in context.



Do not describe irrelevant visual details merely to produce longer alt text.



Decorative images should not create unnecessary assistive-technology noise.



Do not use filenames as automatic alt text unless the filename genuinely communicates the content.



\---



\# 33. ICONS



Decorative icons should not be announced unnecessarily.



Functional icons require an accessible name through their control or surrounding context.



Avoid redundant announcements such as:



`Delete, trash icon, button`



when:



`Delete file, button`



communicates the action correctly.



\---



\# 34. FILES



File interfaces should expose meaningful information programmatically.



Users should be able to determine:



\- file name

\- type

\- relevant metadata

\- selection state

\- available actions



Do not make file actions accessible only through hover.



Do not make drag-and-drop the only way to move or upload important content.



\---



\# 35. TABLES



Use semantic tables for genuinely tabular data.



Provide meaningful headers.



Maintain correct relationships between headers and data cells.



Do not construct complex data tables from arbitrary visual grids when semantic table structure is appropriate.



Interactive table controls should remain keyboard accessible.



Sorting state should be understandable.



Selection state should not depend solely on row color.



\---



\# 36. LISTS



When content is conceptually a list, use appropriate list semantics where useful.



Repeated visual rows should remain understandable as separate items.



Do not add list semantics where the content is not actually a list merely to satisfy a checklist.



Semantics should reflect meaning.



\---



\# 37. CHARTS



Charts must not rely exclusively on visual interpretation when the underlying information is important.



Provide appropriate supporting information.



Depending on context, this may include:



\- summary

\- values

\- labels

\- accessible table

\- textual explanation

\- data inspection controls



Do not assume that adding alt text reading "chart" makes a visualization accessible.



The user needs access to the information represented by the chart.



\---



\# 38. CHART COLOR



Chart series should not be distinguishable solely by color when comparison matters.



Consider additional signals such as:



\- labels

\- line style

\- markers

\- direct annotation

\- patterns where appropriate



Legends should remain understandable.



Interactive highlighting should not remove access to unhighlighted information.



\---



\# 39. MATHEMATICAL CONTENT



Mathematical content should be rendered structurally when appropriate.



Do not expose raw LaTeX merely because visual rendering is difficult.



Where the mathematical renderer supports accessible representation, preserve it.



Equations should remain distinguishable from surrounding prose.



Do not convert important mathematics into inaccessible decorative images when a structured representation is available.



\---



\# 40. MAPS



Maps are inherently visual and often require alternative access to important information.



When map markers represent results or destinations, provide another route to those results where practical.



Examples:



\- associated result list

\- location details

\- searchable destinations

\- structured route instructions



Do not make marker precision the only way to select an important location.



Map controls should be keyboard and touch usable where supported.



\---



\# 41. CALENDARS



Calendars should preserve understandable:



\- dates

\- event names

\- selection

\- current date

\- navigation

\- time relationships



Do not rely solely on spatial position or color to communicate event state.



Calendar controls should remain keyboard accessible where appropriate.



When drag-and-drop event manipulation exists, provide another route for important changes.



\---



\# 42. DRAG AND DROP



Important operations must not depend exclusively on drag-and-drop when a reasonable alternative can be provided.



Potential alternatives include:



\- Move action

\- Reorder buttons

\- destination selector

\- contextual menu

\- keyboard command



Drag state should remain visually understandable.



Drop targets should not rely solely on color.



\---



\# 43. REORDERING



If items can be reordered, users who cannot perform precise drag gestures should still have a workable method when reordering is important.



Potential methods include:



\- Move up

\- Move down

\- Move to...

\- keyboard reordering



Communicate the resulting position when necessary.



\---



\# 44. SPATIAL INTERFACES



Spatial interfaces such as Mind, diagrams, architecture editors, and visual canvases require additional accessibility consideration.



Do not assume every user can understand or manipulate information solely through spatial positioning.



Where practical, provide alternate representations or navigation mechanisms for important information.



Potential alternatives include:



\- hierarchical list

\- searchable structure

\- relationship list

\- node details

\- keyboard navigation

\- structured outline



The spatial interface may remain the primary experience.



Important information should not become inaccessible merely because it is represented spatially.



\---



\# 45. MIND



Mind may use rich visual and spatial interaction.



Its accessibility model should preserve access to:



\- rooms

\- nodes

\- relationships

\- node titles

\- node content

\- navigation

\- creation

\- editing

\- retrieval



Do not make freeform canvas manipulation the only method of navigating stored knowledge.



Where practical, provide a structured representation of the same underlying information.



A user should be able to understand what exists in Mind without needing to visually inspect an enormous canvas.



\---



\# 46. PAN AND ZOOM INTERFACES



Pan and zoom should not be the only way to reach important content where alternatives are practical.



Provide navigation aids such as:



\- search

\- focus selected item

\- reset view

\- fit content

\- structured navigation



Do not allow users to become trapped at extreme zoom levels.



Controls for restoring orientation should be discoverable.



\---



\# 47. CODE EDITORS



Code editors are specialized interfaces.



Preserve:



\- keyboard access

\- readable text

\- focus visibility

\- meaningful status

\- error discoverability



Do not intercept standard keyboard behavior unnecessarily.



Custom shortcuts should avoid conflicting with critical browser or assistive-technology behavior where practical.



\---



\# 48. TERMINALS



Terminal interfaces should maintain readable text and predictable keyboard behavior.



Do not use extremely low-contrast terminal styling merely for aesthetics.



Status and errors should remain distinguishable.



Terminal controls surrounding the terminal should remain accessible independently of terminal content.



\---



\# 49. AUDIO AND VIDEO



Media interfaces should expose usable controls.



Important audio information should not be the sole route to essential content when an alternative is required.



Do not autoplay disruptive audio.



Do not depend on audio cues alone to communicate application state.



Video controls should remain keyboard and touch usable where appropriate.



\---



\# 50. MOTION ACCESSIBILITY



Respect reduced-motion preferences.



When reduced motion is requested, reduce or remove:



\- large spatial movement

\- parallax

\- dramatic zoom

\- decorative animation

\- complex stagger

\- continuous ambient movement

\- unnecessary animated scrolling



Preserve necessary state feedback.



Do not remove functionality.



Reduced motion means reducing potentially disruptive movement, not turning the interface into a dead screenshot.



\---



\# 51. FLASHING AND RAPID EFFECTS



Avoid rapid flashing or strobing effects.



Toolbox has no ordinary functional reason to produce aggressive flashing.



Do not use rapid visual effects merely to attract attention.



Errors, notifications, AI activity, success, and loading states can all be communicated without this nonsense.



\---



\# 52. AUTOPLAY AND CONTINUOUS MOTION



Do not introduce continuous movement that users cannot reasonably stop when it interferes with comprehension or concentration.



Ambient motion should be rare.



Auto-advancing content should not make information difficult to access.



Users should remain in control of important content transitions.



\---



\# 53. SCROLLING



Do not unexpectedly move the user's scroll position without a clear reason.



Automatic scrolling may be appropriate for:



\- focusing a requested result

\- moving to a validation failure

\- following Assistant output when the user is already at the bottom

\- navigation initiated by the user



Do not continually force scroll position against user intent.



If the user scrolls away from streaming Assistant output, do not repeatedly drag them back to the bottom.



\---



\# 54. ZOOM



Do not prevent ordinary browser zoom without a compelling technical reason.



Responsive interfaces should survive increased zoom reasonably.



Do not use viewport restrictions merely to preserve a preferred visual composition.



The interface should adapt.



\---



\# 55. ORIENTATION



Do not assume a single screen orientation where the platform may support multiple orientations.



Layouts should remain functional when available dimensions change.



Specialized interfaces may optimize for one orientation while still providing a usable fallback where practical.



\---



\# 56. MOBILE ACCESSIBILITY



Mobile accessibility requires more than responsive width.



Check:



\- touch target size

\- target separation

\- software keyboard behavior

\- focus visibility

\- screen reader navigation

\- sheets and drawers

\- gesture alternatives

\- orientation changes

\- scroll behavior

\- fixed controls



Do not make desktop-accessible functionality inaccessible merely because it transformed for mobile.



\---



\# 57. GESTURES



Complex gestures should not be the sole method of performing essential actions.



Examples include:



\- swipe

\- pinch

\- long-press

\- multi-touch gestures

\- drag



When the action matters, provide an alternative when practical.



Gestures should enhance interaction rather than hide functionality.



\---



\# 58. LONG-PRESS



Long-press should not be required to discover or perform essential actions.



If long-press exposes contextual actions, those actions should have another reasonable route when important.



Long-press must not interfere with ordinary tapping or scrolling.



\---



\# 59. TIME-DEPENDENT INTERACTIONS



Avoid requiring users to complete ordinary interface interactions within unnecessarily short time limits.



If a temporary interface disappears automatically, ensure the user does not lose essential information or functionality.



Important errors and decisions should not vanish before users can reasonably understand them.



\---



\# 60. NOTIFICATIONS



Notifications should be perceivable without becoming disruptive.



Do not rely solely on:



\- sound

\- color

\- brief motion



for important notification state.



Important notifications should remain accessible through the notification system where appropriate.



Do not repeatedly interrupt users for low-value events.



\---



\# 61. DESTRUCTIVE ACTIONS



Destructive actions require clear labeling.



Do not rely solely on a red icon.



Communicate what will actually happen.



For consequential irreversible actions, use appropriate confirmation or recovery.



Keyboard and assistive-technology users should receive the same understanding of consequence as visual pointer users.



\---



\# 62. ACCESSIBLE NAMES



Controls should have concise, meaningful accessible names.



Avoid names that expose implementation details.



Bad:



`button\_37`



Bad:



`three-dot SVG`



Better:



`More actions`



Better:



`Open file actions`



Names should make sense when encountered without surrounding visual context.



\---



\# 63. DUPLICATE LABELS



When several identical controls appear in repeated content, accessible names may need additional context.



For example, several rows containing:



`Delete`



may be clearer as:



`Delete report.pdf`



where appropriate.



Do not add excessive verbosity when surrounding semantics already provide sufficient context.



Use judgment.



\---



\# 64. DYNAMIC CONTENT



When content changes without navigation, determine whether users need to be informed.



Examples:



\- search results changed

\- item saved

\- upload completed

\- file deleted

\- Assistant finished

\- validation failed

\- connection lost



Not every DOM update needs announcement.



Announce meaningful state changes.



Avoid noise.



\---



\# 65. ROUTE AND PAGE CHANGES



Single-page application navigation should still communicate meaningful context changes.



After major navigation, ensure users can understand where they arrived.



This may involve:



\- meaningful page title

\- heading structure

\- appropriate focus behavior



Do not leave keyboard or assistive-technology users stranded on a control belonging to the previous view.



\---



\# 66. ACCESSIBLE EMPTY STATES



Empty states should clearly explain the absence of content.



Do not depend on an illustration to communicate meaning.



Text should remain sufficient.



If an action is available, it should be keyboard and touch accessible.



\---



\# 67. ACCESSIBLE ERROR STATES



Errors should communicate:



\- what failed

\- where it failed

\- what the user can do



when that information is useful.



Do not expose raw implementation errors.



Do not rely solely on an error icon.



Local errors should remain associated with the relevant component.



\---



\# 68. ACCESSIBLE LOADING STATES



Loading should not leave users uncertain whether the application responded.



For meaningful delays, expose appropriate loading state.



Do not repeatedly announce decorative loading changes.



When loading completes, ensure the resulting content is discoverable.



\---



\# 69. ACCESSIBILITY IN SHARED COMPONENTS



Accessibility should be implemented in shared components wherever possible.



Examples:



Button

→ keyboard behavior and accessible disabled state



Dialog

→ focus management



Menu

→ keyboard navigation



Input

→ label and error relationships



Tabs

→ semantic state and navigation



Tooltip

→ focus support



Fixing accessibility at the shared-component level prevents the same defect from appearing across dozens of Toolbox tools.



Do not require every feature developer or agent to rediscover the same accessibility behavior.



\---



\# 70. SPECIALIZED TOOLS



Specialized tools may require specialized accessibility strategies.



Do not blindly apply ordinary form accessibility patterns to:



\- chess

\- maps

\- Mind

\- diagrams

\- anatomy

\- automobile visualizations

\- architecture editors

\- terminals

\- code editors



Instead determine:



1\. what information the interface communicates

2\. what actions users need to perform

3\. which parts depend on visual/spatial interaction

4\. which alternate representations are practical

5\. how keyboard and assistive technology can access the essential workflow



Accessibility should respect the tool's function rather than flattening every tool into the same interface.



\---



\# 71. DO NOT FAKE ACCESSIBILITY



Do not declare a component accessible merely because:



\- it has ARIA attributes

\- Lighthouse produced a good score

\- it can technically receive focus

\- text contrast passed an automated check

\- a library claims accessibility support



Automated checks are useful.



They are not proof of a good accessible experience.



Inspect actual interaction behavior.



\---



\# 72. ACCESSIBILITY VERIFICATION



For affected interfaces, verify relevant accessibility behavior.



Check:



1\. semantic elements

2\. heading structure

3\. accessible names

4\. labels

5\. keyboard navigation

6\. tab order

7\. focus visibility

8\. focus restoration

9\. dialogs

10\. menus

11\. forms

12\. validation

13\. errors

14\. disabled states

15\. loading states

16\. dynamic updates

17\. touch targets

18\. color-independent meaning

19\. text scaling

20\. reduced motion

21\. mobile behavior

22\. gesture alternatives

23\. drag alternatives when required

24\. structured result semantics

25\. specialized-tool accessibility when applicable



Use automated accessibility tooling when available.



Also inspect the actual interaction.



Do not rely exclusively on automated results.



\---



\# 73. ACCESSIBILITY REGRESSION



When modifying a shared component, preserve existing accessible behavior.



Do not accidentally remove:



\- labels

\- semantics

\- keyboard handling

\- focus management

\- ARIA relationships

\- screen-reader-only text

\- reduced-motion handling



because the new implementation looks cleaner.



Visual refactoring must not silently degrade accessibility.



\---



\# 74. PROPORTIONAL IMPLEMENTATION



Accessibility work should be proportional to the interface while still protecting essential functionality.



A simple static card does not require an elaborate accessibility architecture.



A complex spatial knowledge interface may.



Do not add meaningless accessibility complexity.



Do not omit necessary accessibility because the interface is complex.



Solve the actual accessibility problem.



\---



\# 75. FINAL ACCESSIBILITY STANDARD



A Toolbox interface should not assume that every user:



\- sees every visual distinction

\- uses a mouse

\- can perform precise gestures

\- tolerates extensive motion

\- interprets spatial layouts visually

\- uses the interface at its default text size



Accessibility should preserve the intent and capability of the interface.



When uncertain:



use semantics before simulation,

make focus visible,

label actions clearly,

preserve keyboard access,

provide alternatives to purely visual or gesture-based interaction,

communicate state through more than color,

respect reduced motion,

and solve accessibility in shared components whenever possible.



Accessibility is successful when it becomes part of how Toolbox works rather than a separate layer attempting to repair it afterward.

