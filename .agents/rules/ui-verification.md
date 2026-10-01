\---

trigger always\_on

\---



\# TOOLBOX — UI VERIFICATION



This file governs verification of user-interface work across Toolbox.



It supplements



\- `UI Core`

\- `UI Design System`

\- `Responsive UI`

\- `Motion \& Interaction`

\- `UI Components`

\- `UI Accessibility`

\- `Structured Renderers`



UI work is not complete because



\- the code compiles

\- the page renders

\- TypeScript passes

\- there are no console errors

\- the implementation matches the plan

\- the first screenshot looks acceptable



The rendered and interactive result must be inspected.



Verification is part of implementation.



\---



\# 1. CORE VERIFICATION PRINCIPLE



For meaningful UI changes, follow this loop



```text id=gp0xqt

inspect existing interface

→ understand intended behavior

→ implement

→ render

→ inspect

→ interact

→ test relevant states

→ compare with surrounding Toolbox UI

→ correct issues

→ verify again

```



Do not stop at



```text id=xdcsov

implement

→ compile

→ report success

```



Compilation verifies syntax and some program correctness.



It does not verify interface quality.



\---



\# 2. VERIFY THE ACTUAL INTERFACE



Inspect the UI in its rendered state whenever the environment allows it.



Do not infer final appearance solely from



\- JSX

\- CSS

\- Tailwind classes

\- component props

\- design tokens

\- source code



Visual relationships only become fully apparent after rendering.



Examples include



\- spacing

\- wrapping

\- clipping

\- alignment

\- density

\- hierarchy

\- visual weight

\- animation timing

\- overflow

\- responsive behavior



Read the code.



Then inspect what the code actually produced.



\---



\# 3. UNDERSTAND BEFORE VERIFYING



Before deciding whether a result is correct, understand



\- what the interface is supposed to do

\- what existed before the change

\- which behavior must remain

\- which visual patterns surround it

\- which states the component supports

\- how it behaves at different sizes



Do not evaluate an interface in isolation when it belongs to an established Toolbox workflow.



\---



\# 4. VERIFY AGAINST TOOLBOX, NOT PERSONAL TASTE



When inspecting UI, compare it with established Toolbox patterns.



Check consistency with



\- typography

\- spacing

\- control geometry

\- buttons

\- icons

\- inputs

\- cards

\- menus

\- modals

\- navigation

\- interaction behavior

\- motion

\- responsive behavior



Do not declare a result better merely because it looks more elaborate.



The goal is coherent Toolbox UI.



\---



\# 5. VERIFY THE CHANGE IN CONTEXT



Do not inspect only the modified component in isolation.



Check



\- its parent layout

\- neighboring components

\- surrounding spacing

\- related controls

\- upstream and downstream interactions



A component can look correct alone and still damage the page around it.



\---



\# 6. VERIFY THE PRIMARY WORKFLOW



Test the primary user task from beginning to end.



Do not test only the component that changed.



Examples



If a file picker changed



```text id=8cpk4m

open picker

→ navigate

→ select file

→ confirm

→ verify resulting workflow

```



If a form changed



```text id=hcqsaz

open form

→ enter data

→ submit

→ verify success

```



If a map changed



```text id=m9q7xl

open map

→ interact

→ select result

→ verify details

→ verify route or action

```



The interface exists to support workflows, not screenshots.



\---



\# 7. VERIFY ALL RELEVANT STATES



Do not verify only the ideal populated state.



Consider relevant states such as



\- default

\- hover

\- focus

\- active

\- selected

\- disabled

\- loading

\- empty

\- error

\- partial data

\- expanded

\- collapsed

\- success



Not every interface requires every state.



Test the states that actually exist.



\---



\# 8. DEFAULT STATE



Verify the initial state before interaction.



Check



\- hierarchy

\- spacing

\- alignment

\- labels

\- actions

\- readability

\- discoverability

\- initial selection

\- initial data



The initial interface should make the next action understandable.



\---



\# 9. HOVER STATE



Where hover exists, verify



\- feedback is visible

\- layout does not shift

\- motion is restrained

\- text remains readable

\- controls do not jump

\- hover does not reveal functionality unavailable elsewhere on touch devices



Hover should enhance interaction.



It must not become structural dependency.



\---



\# 10. FOCUS STATE



Use keyboard navigation.



Do not verify focus merely by reading CSS.



Check that



\- focus is visible

\- tab order is logical

\- focus is not clipped

\- focus is distinguishable from hover

\- hidden elements are not unexpectedly reachable



If focus cannot be found visually, the implementation is not complete.



\---



\# 11. ACTIVE AND PRESSED STATES



Interact with buttons and controls.



Verify



\- action acknowledgement is immediate

\- pressed feedback is not excessive

\- surrounding layout remains stable

\- rapid interaction does not break state



Do not assume the browser default is sufficient if Toolbox provides custom interaction styling.



\---



\# 12. SELECTED STATE



For selectable controls, verify that users can clearly distinguish



```text id=cegtk4

selected

from

unselected

```



Check



\- pills

\- tabs

\- rows

\- cards

\- navigation items

\- filters

\- segmented controls



Do not rely solely on subtle color differences.



\---



\# 13. DISABLED STATE



Verify that disabled controls



\- are clearly unavailable

\- remain readable

\- cannot be triggered

\- do not resemble loading controls

\- do not disappear unless intended



If the reason for an important disabled action needs explanation, verify that explanation exists.



\---



\# 14. LOADING STATE



Trigger real loading behavior where practical.



Check



\- activity is visible

\- layout remains stable

\- duplicate submissions are prevented where appropriate

\- loading feedback matches the scope of the operation

\- the UI does not freeze without explanation



Do not verify loading using only hardcoded development state if real behavior can be tested.



\---



\# 15. EMPTY STATE



Test with genuinely empty data.



Verify that



\- the interface does not break

\- no fake content appears

\- the absence of content is understandable

\- the next action is clear when necessary



Empty is a normal product state.



Treat it accordingly.



\---



\# 16. ERROR STATE



Trigger realistic errors where practical.



Verify



\- the error is understandable

\- internal implementation details are hidden

\- retry or recovery works where available

\- user input is preserved when appropriate

\- local failures remain local



Do not test only the success path and assume error handling is aesthetically satisfactory.



\---



\# 17. PARTIAL DATA



Where external or structured data may be incomplete, verify graceful behavior with missing optional fields.



Check



\- missing image

\- missing metadata

\- missing description

\- unavailable status

\- absent coordinates

\- partial result sets



The interface should not collapse merely because optional data is absent.



\---



\# 18. LONG CONTENT



Test content longer than ideal design examples.



Include



\- long titles

\- long filenames

\- long usernames

\- long descriptions

\- large values

\- many tags

\- long URLs

\- generated Assistant output



Verify



\- wrapping

\- truncation

\- scrolling

\- expansion

\- layout stability



Do not optimize only for tidy mock data.



Human beings have demonstrated an extraordinary ability to name files things like



`final\_final\_REAL\_final\_submission\_v7\_updated.pdf`



Toolbox must survive them.



\---



\# 19. VERY SHORT CONTENT



Also test unusually short content.



Interfaces should not depend on text length for balance.



Examples



\- one-character labels

\- zero values

\- empty descriptions

\- single-item collections



Avoid layouts that only look correct when content happens to fill expected space.



\---



\# 20. LARGE COLLECTIONS



Where lists or grids may grow, test realistic scale.



Verify



\- rendering performance

\- scrolling

\- action responsiveness

\- pagination or virtualization if applicable

\- visual density

\- sticky elements

\- selection



Do not test only five items when production may contain hundreds.



\---



\# 21. RESPONSIVE VERIFICATION



For meaningful layout changes, verify multiple widths.



At minimum consider



\- narrow phone

\- standard phone

\- large phone

\- intermediatetablet

\- compact laptop

\- standard desktop



Large desktop should also be checked when the interface benefits from large workspaces.



Do not verify only common breakpoint values.



Inspect intermediate widths.



\---



\# 22. MOBILE VERIFICATION



Mobile requires independent inspection.



Check



\- page gutters

\- overflow

\- touch targets

\- navigation

\- dialogs

\- sheets

\- toolbars

\- inputs

\- software keyboard interaction

\- long content

\- fixed elements

\- sticky elements

\- scrolling



Do not assume responsive CSS means mobile has been verified.



\---



\# 23. INTERMEDIATE WIDTHS



Tablet and intermediate widths frequently expose layout assumptions hidden at both mobile and desktop extremes.



Verify interfaces around transitions where



\- sidebars collapse

\- grids change

\- toolbars overflow

\- forms switch columns

\- navigation transforms

\- cards resize



Do not inspect only the widths immediately above and below a breakpoint.



\---



\# 24. LARGE SCREENS



Wide screens can reveal their own problems.



Check



\- excessive line length

\- overly stretched forms

\- enormous whitespace

\- isolated content

\- tools artificially constrained to tiny columns

\- panels growing beyond useful dimensions



Responsive design does not end once the viewport becomes wide enough.



\---



\# 25. HORIZONTAL OVERFLOW



Verify that ordinary pages do not unintentionally scroll horizontally.



If horizontal scrolling exists, confirm that it belongs to an appropriate component such as



\- table

\- code block

\- terminal

\- timeline

\- visualization



Do not conceal accidental overflow with global clipping.



Find the cause.



\---



\# 26. VERTICAL OVERFLOW



Check contained interfaces such as



\- dialogs

\- sheets

\- drawers

\- panels

\- sidebars



Verify that long content remains reachable.



Do not create surfaces whose bottom actions disappear beyond the viewport.



Confirm which region should scroll.



\---



\# 27. NESTED SCROLLING



Inspect interfaces containing multiple scroll regions.



Check



\- scroll ownership is understandable

\- touch scrolling behaves naturally

\- wheel behavior is predictable

\- users are not trapped inside an inner region

\- sticky UI remains correct



Avoid nested scrolling unless the workflow genuinely requires it.



\---



\# 28. SOFTWARE KEYBOARD



For mobile inputs and composers, verify behavior with the software keyboard visible where tooling allows.



Check that



\- active field remains visible

\- submit controls remain reachable

\- composer remains usable

\- fixed elements do not overlap

\- viewport does not jump unexpectedly



This is especially important for Assistant, search, messaging, forms, and editors.



\---



\# 29. KEYBOARD VERIFICATION



Navigate the affected interface using the keyboard where relevant.



Test



\- Tab

\- Shift + Tab

\- Enter

\- Space

\- Escape

\- arrow keys where appropriate



Verify



\- focus order

\- activation

\- dismissal

\- menus

\- dialogs

\- tab systems

\- selectors



Do not assume library components automatically behave correctly after customization.



\---



\# 30. TOUCH VERIFICATION



For touch-oriented interfaces, verify



\- tap

\- repeated tap

\- scrolling near controls

\- long-press if supported

\- drag if supported

\- sheet gestures if supported



Check for accidental activation.



Do not rely solely on mouse simulation for interactions designed around touch.



\---



\# 31. POINTER VERIFICATION



Check pointer interactions including



\- hover

\- cursor

\- click

\- drag

\- resize

\- selection



Cursor changes should match interaction.



Resizable and draggable elements should remain discoverable without becoming visually noisy.



\---



\# 32. MOTION VERIFICATION



Observe motion repeatedly.



Check



\- purpose

\- duration

\- easing

\- responsiveness

\- direction

\- interruption

\- repeated use

\- performance



An animation may look impressive once and become irritating after repeated interaction.



Test it repeatedly.



\---



\# 33. MOTION INTERRUPTION



Interrupt animations intentionally.



Examples



```text id=h4ewvz

open → immediately close

expand → collapse

switch tab → switch again

open panel → navigate away

```



Verify state remains correct.



The UI should respond to current input rather than completing outdated animation sequences.



\---



\# 34. REDUCED MOTION



When affected UI contains meaningful animation, verify reduced-motion behavior.



Check that



\- functionality remains intact

\- excessive spatial motion disappears

\- essential state feedback remains

\- layout does not depend on animation



Do not simply disable all CSS transitions without examining the resulting experience.



\---



\# 35. ACCESSIBILITY VERIFICATION



For affected UI, inspect relevant accessibility requirements.



Check



\- semantics

\- labels

\- focus

\- keyboard use

\- touch targets

\- meaningful contrast

\- state communication

\- form relationships

\- dialog focus

\- dynamic updates

\- reduced motion



Use automated tooling when available.



Also inspect manually.



Automated accessibility scores are evidence.



They are not a verdict.



\---



\# 36. COMPONENT VERIFICATION



When modifying a shared component, verify representative consumers.



Do not inspect only the page that motivated the change.



Search where the component is used.



Check several different contexts.



A change to a shared Button, Dialog, Input, Card, File component, or Renderer may affect large portions of Toolbox.



Treat shared-component changes accordingly.



\---



\# 37. RENDERER VERIFICATION



Structured renderers require realistic payloads.



Verify



\- complete data

\- missing optional data

\- empty data

\- loading

\- error

\- large data

\- responsive behavior



Confirm that the correct renderer is used.



Confirm that the Assistant text does not unnecessarily duplicate the same structured information.



\---



\# 38. MAP VERIFICATION



For map interfaces, verify



\- markers

\- selection

\- route geometry

\- viewport

\- zoom

\- pan

\- detail panels

\- responsive behavior

\- touch interaction



Confirm that visible geography corresponds to actual result data.



Do not accept invented or mismatched route geometry because it looks plausible.



\---



\# 39. CHART VERIFICATION



For charts, verify



\- data accuracy

\- axis meaning

\- labels

\- units

\- legend

\- responsive behavior

\- tooltip behavior

\- accessibility

\- empty data

\- unusual values



Confirm that visual scaling does not misrepresent the data.



\---



\# 40. FILE UI VERIFICATION



Verify



\- file icons

\- filenames

\- long filenames

\- file selection

\- context actions

\- folders

\- empty folders

\- file type mapping

\- list and grid layouts where applicable



The same file type should remain visually consistent across contexts.



\---



\# 41. FORM VERIFICATION



Test forms with



\- valid input

\- invalid input

\- missing required fields

\- long input

\- submission

\- loading

\- server error

\- correction after error



Verify input is preserved when appropriate.



Verify errors remain associated with the correct fields.



Do not test forms only by clicking Submit on valid data once.



\---



\# 42. DIALOG VERIFICATION



Test dialogs with



\- mouse

\- keyboard

\- long content

\- narrow viewport

\- dismissal

\- destructive actions where applicable



Verify



\- focus enters correctly

\- Escape behavior is correct

\- background behavior is correct

\- focus returns appropriately

\- content remains scrollable

\- actions remain reachable



\---



\# 43. MENU VERIFICATION



Test menus near



\- top edge

\- bottom edge

\- left edge

\- right edge



Verify collision behavior.



Check



\- keyboard navigation

\- focus

\- disabled items

\- destructive items

\- dismissal

\- nested behavior if supported



Do not verify floating UI only in convenient empty space.



\---



\# 44. VISUAL REGRESSION



Compare affected UI with the previous intended behavior.



Ask



\- Did spacing change unintentionally

\- Did typography change

\- Did control size change

\- Did alignment shift

\- Did an unrelated component change

\- Did mobile behavior regress

\- Did an animation disappear

\- Did accessibility behavior regress



Focused changes should remain focused.



\---



\# 45. FUNCTIONAL REGRESSION



Visual work must not break functionality.



Verify the underlying behavior still works.



Examples



\- button still submits

\- file still opens

\- selector still changes state

\- modal still saves

\- navigation still navigates

\- map still selects

\- calendar still creates

\- Assistant action still executes



A prettier interface that no longer works is merely decorative sabotage.



\---



\# 46. DATA REGRESSION



UI refactors must preserve data behavior.



Check



\- values still display correctly

\- data is not lost

\- selection remains correct

\- state persists where expected

\- old data shapes still render if compatibility matters



Do not silently alter domain behavior during visual cleanup.



\---



\# 47. CONSOLE AND RUNTIME ERRORS



Inspect relevant runtime errors.



Check for



\- exceptions

\- hydration errors

\- rendering warnings

\- repeated requests

\- failed resources

\- accessibility warnings where available



Do not ignore runtime errors merely because the visible UI looks correct.



But do not treat a clean console as proof that UI quality is correct.



Both matter.



\---



\# 48. PERFORMANCE VERIFICATION



Pay attention to obvious performance regressions.



Check for



\- slow interaction

\- laggy animation

\- delayed typing

\- expensive rerenders

\- scrolling stutter

\- large layout shifts

\- unnecessary network requests

\- huge DOM growth



Do not perform elaborate optimization for every minor UI task.



Do investigate visible regressions introduced by the change.



\---



\# 49. NETWORK CONDITIONS



For interfaces dependent on external data, consider slower or failed requests.



Verify that the UI does not assume instant success.



Check



\- loading

\- timeout

\- retry

\- partial response

\- connection loss



Do not create interfaces that appear broken merely because the network behaves like a network.



\---



\# 50. PRESERVE USER INPUT



Where a failed operation occurs, verify that recoverable user input is preserved.



Examples



\- forms

\- messages

\- search queries

\- editor content

\- configuration



Do not erase meaningful user work because an API request failed.



\---



\# 51. VERIFY REAL CONTENT



Prefer representative real or realistic content over perfectly curated placeholders.



Test



\- realistic names

\- realistic descriptions

\- realistic files

\- realistic result counts

\- realistic Assistant output



Placeholder content often hides problems.



Production content is less polite.



\---



\# 52. VERIFY SPECIALIZED TOOLS ACCORDING TO THEIR FUNCTION



Do not apply one generic verification process blindly to every Toolbox tool.



Specialized interfaces require domain-specific checks.



Examples



Chess

→ board state, selection, legal move interaction, analysis UI



Maps

→ spatial correctness and route interaction



Mind

→ pan, zoom, nodes, rooms, relationships, retrieval



Calendar

→ event placement, navigation, time relationships



Code editor

→ editing, focus, scrolling, keyboard interaction



Terminal

→ inputoutput behavior



Anatomy

→ selection, labels, spatial interaction



Verify what the tool actually does.



\---



\# 53. VERIFY MIND CAREFULLY



Mind is a spatial and interaction-heavy interface.



Changes to Mind should consider



\- node positioning

\- room navigation

\- zoom

\- pan

\- creation

\- editing

\- relationships

\- selection

\- retrieval

\- animations

\- context preservation

\- mobile interaction

\- accessibility fallback

\- performance with larger graphs



Do not validate Mind from a static screenshot alone.



Its quality exists largely in interaction.



\---



\# 54. SCREENSHOTS



Screenshots are useful for inspecting



\- spacing

\- alignment

\- hierarchy

\- responsive composition

\- visual regressions



They are not sufficient for verifying



\- hover

\- focus

\- touch

\- motion

\- keyboard behavior

\- scrolling

\- dynamic state

\- complex workflows



Use screenshots as one verification method, not the entire verification process.



\---



\# 55. VISUAL COMPARISON



When redesigning or aligning a component with another Toolbox pattern, compare them directly where practical.



Inspect



\- control heights

\- radii

\- spacing

\- icon dimensions

\- typography

\- alignment

\- density



Do not rely on memory when both implementations can be inspected.



Tiny inconsistencies multiply across a large application.



\---



\# 56. DO NOT OVER-CORRECT



Verification may reveal unrelated imperfections.



Do not automatically redesign everything nearby.



Distinguish



\- issue caused by current change

\- issue blocking the current workflow

\- unrelated existing imperfection



Fix what is necessary for a coherent result.



Avoid turning every UI task into a spontaneous application-wide redesign.



\---



\# 57. CORRECT DISCOVERED PROBLEMS



If verification reveals a clear problem caused by the implementation, correct it before reporting completion.



Do not merely document obvious defects and call the task finished.



Examples



\- overflow

\- broken mobile layout

\- inaccessible control

\- clipped content

\- incorrect loading state

\- broken interaction

\- severe inconsistency



Verification without correction is observation, not quality control.



\---



\# 58. VERIFY AFTER CORRECTION



After correcting a discovered issue, inspect the affected behavior again.



Fixes can create new issues.



The loop is



```text id=on7lp5

inspect

→ detect problem

→ fix

→ inspect again

```



not



```text id=3h1md2

inspect

→ fix

→ assume perfection

```



Humanity has attempted the second method extensively.



Results remain mixed.



\---



\# 59. USE THE AVAILABLE TOOLS



When the development environment provides



\- browser inspection

\- screenshots

\- viewport controls

\- accessibility inspection

\- console access

\- interaction automation

\- tests



use the relevant tools.



Do not avoid visual inspection merely because source inspection is faster.



Select verification methods appropriate to the change.



\---



\# 60. AUTOMATED TESTS



Automated UI tests are useful for stable, important behavior.



Good candidates include



\- critical workflows

\- regressions

\- forms

\- navigation

\- reusable components

\- state transitions



Do not create brittle pixel-level automation for every trivial visual detail.



Automated tests supplement inspection.



They do not eliminate it.



\---



\# 61. UNIT AND COMPONENT TESTING



Reusable interactive components may benefit from tests covering



\- state behavior

\- keyboard interaction

\- callbacks

\- disabled behavior

\- loading behavior

\- accessibility properties



Test behavior rather than implementation details.



Do not write tests that fail every time internal markup is reorganized while user behavior remains unchanged.



\---



\# 62. END-TO-END TESTING



Use end-to-end testing for critical multi-step workflows when appropriate.



Examples



```text id=h6p04y

sign in

→ open tool

→ perform action

→ verify result

```



or



```text id=u33mqs

Assistant

→ invoke structured result

→ interact with renderer

→ verify resulting action

```



Prioritize workflows whose failure materially damages the product experience.



\---



\# 63. VERIFICATION PROPORTIONALITY



Not every UI change requires the same verification depth.



Changing a small label may require limited inspection.



Changing shared navigation may require broad regression checks.



Changing a Button primitive may affect dozens of tools.



Changing Mind's canvas may require extensive interaction testing.



Scale verification according to blast radius and complexity.



Do not skip verification.



Do not perform a theatrical full-product audit for a typo.



\---



\# 64. SHARED COMPONENT BLAST RADIUS



Before modifying a shared component, determine its scope.



The more widely reused the component, the broader verification should be.



High-blast-radius examples include



\- Button

\- Input

\- Dialog

\- Menu

\- navigation primitives

\- file components

\- renderer infrastructure

\- typography tokens

\- spacing tokens



Verify representative usages.



\---



\# 65. DESIGN TOKEN CHANGES



Changes to shared design tokens require special caution.



A single change to



\- radius

\- spacing

\- typography

\- shadow

\- control height

\- motion duration



may affect much of Toolbox.



Do not change global tokens to solve one local problem without inspecting broader consequences.



\---



\# 66. BREAKPOINT CHANGES



Changing shared responsive breakpoints may affect unrelated tools.



Verify representative



\- navigation

\- forms

\- cards

\- workspaces

\- tables

\- dialogs



Do not modify global responsive behavior casually.



\---



\# 67. MOTION TOKEN CHANGES



Changes to global easing or duration can alter the personality of the entire interface.



Verify



\- menus

\- dialogs

\- sheets

\- tabs

\- panels

\- interactive spatial tools



Do not solve one awkward animation by globally changing motion behavior unless the global behavior itself is the problem.



\---



\# 68. NO VISUAL SELF-DECEPTION



Do not accept a result merely because



\- the implementation was difficult

\- significant time was spent on it

\- it matches the original plan

\- the code is elegant

\- the screenshot is attractive



Judge the rendered result independently.



If it does not work well, revise it.



Implementation effort does not improve bad UI.



\---



\# 69. COMPLETION REPORTING



When reporting UI work complete, do not claim verification that did not occur.



Do not state



\- mobile verified

\- accessibility verified

\- browser tested

\- interactions tested

\- visual regression checked



unless those things were actually checked.



Be precise about what was verified.



Do not fabricate successful testing.



\---



\# 70. BLOCKERS



If full verification cannot occur because required runtime behavior, tooling, data, or environment is unavailable, do not pretend otherwise.



Complete the verification that is possible.



Clearly distinguish



```text id=69i2kf

implemented

from

verified

```



Do not confuse confidence with evidence.



\---



\# 71. UI DEFINITION OF DONE



UI work is complete only when relevant requirements have been satisfied across



\### Function



The interface performs its intended task.



\### Structure



The information hierarchy is understandable.



\### Design



The interface follows Toolbox's established visual language.



\### Responsiveness



The affected interface works across relevant sizes.



\### Interaction



Controls and workflows behave predictably.



\### Accessibility



Relevant accessibility requirements are preserved.



\### States



Important loading, empty, error, disabled, and selected states behave correctly.



\### Motion



Animation supports the interaction and remains performant.



\### Regression



Existing functionality and nearby UI were not unintentionally damaged.



\### Verification



The rendered result was actually inspected where tooling allowed it.



Passing only some of these does not necessarily mean the task is finished.



\---



\# 72. FINAL VERIFICATION STANDARD



Toolbox UI should be judged by what users actually experience.



Not by



\- what the source code appears to describe

\- what the implementation plan intended

\- what the type checker accepted

\- what the developer remembers the interface looking like



The final authority is the rendered, interactive product.



When completing UI work



inspect before changing,

preserve what already works,

implement the smallest coherent solution,

render the result,

test realistic interaction,

inspect multiple states,

inspect relevant screen sizes,

check accessibility,

check regressions,

correct discovered problems,

and verify again.



Do not declare success because the machine stopped complaining.



The machine has exceptionally low standards.

