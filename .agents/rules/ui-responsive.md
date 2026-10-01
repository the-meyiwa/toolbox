\---

trigger: always\_on

\---



\# TOOLBOX — RESPONSIVE UI



This file governs responsive behavior across Toolbox.



It supplements:



\- `UI Core`

\- `UI Design System`



Toolbox must provide a deliberate experience across phones, tablets, laptops, desktops, and larger displays.



Responsive design is not the process of shrinking desktop UI until it technically fits.



The interface may reorganize, collapse, stack, scroll, transform, or change interaction patterns when available space changes.



Function and hierarchy must survive those transformations.



\---



\# 1. CORE RESPONSIVE PRINCIPLE



Every affected interface must be considered independently at multiple viewport sizes.



Never assume:



\- desktop naturally works on mobile

\- mobile naturally scales to tablet

\- `width: 100%` makes something responsive

\- flex-wrap automatically creates a good responsive layout

\- hiding overflow fixes layout problems

\- shrinking text fixes insufficient space

\- horizontal scrolling is always acceptable

\- every desktop interaction has an obvious touch equivalent



Responsive behavior must be intentional.



\---



\# 2. MOBILE IS FIRST-CLASS



Mobile Toolbox is not a secondary or degraded version of Toolbox.



Preserve the user's ability to perform the core task.



Do not remove important functionality merely because the screen is smaller.



When simplification is required, reduce visual complexity before reducing capability.



On mobile, prioritize:



1\. primary content

2\. primary actions

3\. navigation

4\. essential context

5\. secondary controls

6\. supplementary information

7\. decorative elements



Decorative complexity should disappear before useful functionality.



\---



\# 3. DESIGN FOR AVAILABLE SPACE, NOT DEVICE NAMES



Do not build responsive behavior around assumptions such as:



\- iPhone

\- Android

\- iPad

\- MacBook

\- desktop monitor



Design according to available space and interaction constraints.



Use breakpoints when the layout actually needs to change.



Do not create arbitrary breakpoints merely because common framework defaults exist.



A breakpoint should represent a meaningful transition in layout behavior.



Prefer content-driven breakpoints where practical.



\---



\# 4. RESPONSIVE RANGE



When modifying an interface, consider at minimum:



\- narrow phone widths

\- standard phone widths

\- large phone widths

\- tablet/intermediate widths

\- compact laptop widths

\- standard desktop widths

\- large desktop widths when relevant



Do not optimize exclusively for one screenshot size.



The interface should remain coherent between breakpoints, not merely at them.



\---



\# 5. FLUID LAYOUT



Prefer layouts capable of adapting continuously.



Use appropriate combinations of:



\- flexible widths

\- `min-width`

\- `max-width`

\- CSS Grid

\- Flexbox

\- `clamp()`

\- `min()`

\- `max()`

\- intrinsic sizing

\- responsive gaps

\- wrapping

\- container-aware behavior where appropriate



Avoid excessive fixed dimensions.



Fixed dimensions are acceptable when the element genuinely requires them.



Examples may include:



\- icons

\- avatars

\- compact controls

\- known media ratios

\- specific visualization elements



Do not use fixed page geometry simply because it matches one desktop screenshot.



\---



\# 6. HORIZONTAL OVERFLOW



Unintentional horizontal page overflow is a bug.



When horizontal overflow appears, identify the element causing it.



Do not blindly apply:



```css

overflow-x: hidden;

```



to conceal the problem.



Common causes include:



\- fixed widths

\- `min-width`

\- long unbroken text

\- oversized controls

\- tables

\- code

\- media

\- absolute positioning

\- transforms

\- excessive padding

\- non-wrapping toolbars

\- nested flex children

\- dialogs wider than the viewport



Fix the actual layout problem.



Intentional horizontal scrolling is allowed for content that genuinely benefits from it, such as:



\- wide tables

\- timelines

\- code

\- certain visualizations

\- horizontally structured workspaces



Intentional scrolling must be contained to the appropriate component.



\---



\# 7. RESPONSIVE HIERARCHY



When space decreases, preserve hierarchy.



Do not simply reduce every dimension proportionally.



Instead:



\- stack related groups

\- collapse secondary controls

\- shorten nonessential labels when a clear alternative exists

\- move infrequent actions into overflow

\- allow appropriate content to wrap

\- transform side panels

\- reduce decorative spacing

\- simplify secondary presentation



Primary content and actions should remain easy to find.



\---



\# 8. RESPONSIVE SPACING



Spacing may become tighter on smaller displays.



Do not eliminate spacing indiscriminately.



Preserve clear relationships between:



\- sections

\- controls

\- labels

\- content groups

\- actions



Page gutters should remain sufficient to prevent content from touching viewport edges.



Do not waste large portions of a phone display on desktop-scale margins.



Do not make desktop layouts unnecessarily cramped because the mobile layout uses tighter spacing.



\---



\# 9. RESPONSIVE TYPOGRAPHY



Typography should remain readable across viewport sizes.



Do not solve layout problems by making text excessively small.



Large display typography may scale down when appropriate.



Ordinary body text should remain comfortably readable.



Prevent headings from consuming absurd portions of a phone display.



Allow text to wrap naturally when appropriate.



Handle:



\- long titles

\- long filenames

\- URLs

\- generated content

\- user-entered text

\- long numbers

\- code

\- localization expansion



without destroying layout.



Use truncation only when hiding the remainder does not remove information the user needs.



When truncating important content, provide a way to access the full value where appropriate.



\---



\# 10. TOUCH TARGETS



Touch controls must be comfortably usable.



Do not create tiny tap targets merely because the visible icon is small.



The interactive area may be larger than the visual icon.



Maintain sufficient separation between adjacent destructive or high-impact actions.



Avoid layouts where ordinary scrolling can easily trigger controls accidentally.



Controls positioned near screen edges must remain usable.



\---



\# 11. HOVER AND TOUCH



Hover must never be required for essential functionality.



If desktop interaction depends on hover, provide an appropriate touch equivalent.



Examples:



Desktop:

hover reveals actions



Mobile:

tap, persistent action, contextual menu, or another discoverable interaction



Do not make important information permanently invisible on touch devices.



Hover effects may enhance desktop interaction.



They must not define functionality that disappears without a pointer.



\---



\# 12. LONG-PRESS



Use long-press sparingly.



Long-press must not interfere with ordinary tapping or scrolling.



Do not use long-press as the only way to access essential functionality.



If long-press opens contextual actions, ensure:



\- ordinary tap remains reliable

\- scrolling does not trigger it accidentally

\- activation delay is reasonable

\- the resulting interface is understandable

\- another route exists for important actions when necessary



Avoid surprising long-press behavior.



\---



\# 13. POINTER AND KEYBOARD INPUT



Responsive design includes input modality, not only viewport width.



Toolbox may be used with:



\- touch

\- mouse

\- trackpad

\- keyboard

\- combinations of these



Do not assume a large display always has a mouse.



Do not assume a small display only uses touch.



Interactive components should adapt without becoming dependent on one input mechanism.



\---



\# 14. PAGE STRUCTURE



Desktop pages may use:



\- multiple columns

\- sidebars

\- persistent secondary panels

\- broad workspaces

\- inline toolbars



On smaller displays, those structures may transform.



Possible transformations include:



```text

multi-column

→ stacked content



sidebar

→ drawer / sheet / dedicated view



persistent inspector

→ toggleable panel



wide toolbar

→ compact toolbar + overflow



secondary panel

→ separate mobile screen



desktop split view

→ switchable views

```



Choose the transformation that best preserves the workflow.



Do not stack everything automatically if doing so creates an absurdly long page.



\---



\# 15. NAVIGATION



Navigation must remain usable at every supported width.



Desktop navigation may be persistent.



Mobile navigation may transform into a more compact structure.



Do not squeeze desktop navigation until labels become unreadable.



Do not hide critical destinations without providing another obvious route.



Navigation state should remain understandable after transformation.



Preserve the user's current context when opening and closing responsive navigation surfaces.



\---



\# 16. SIDEBARS



Sidebars should not consume unreasonable portions of small displays.



At narrower widths, consider transforming sidebars into:



\- drawers

\- sheets

\- collapsible panels

\- dedicated views



Do not leave a narrow sidebar permanently visible if it crushes the primary workspace.



When a sidebar disappears, preserve access to its functionality.



Resizable desktop sidebars should use sensible minimum and maximum widths.



Do not allow resizing to destroy the workspace.



\---



\# 17. SPLIT VIEWS



Split views are appropriate when simultaneous context materially improves the task.



On wide displays, multiple panels may remain visible simultaneously.



As space decreases:



\- adjust proportions

\- establish sensible minimum widths

\- collapse secondary panels when necessary

\- provide a clear way to switch between views



Do not preserve split-screen merely for visual consistency when neither side remains usable.



On mobile, a sequence of focused views may be superior to two microscopic panels pretending to be productive.



\---



\# 18. TOOLBARS



Toolbars must adapt to available width.



Prioritize frequently used actions.



When space becomes constrained:



1\. preserve primary actions

2\. preserve mode/state indicators

3\. preserve actions requiring immediate access

4\. move infrequent actions into overflow

5\. remove redundant labels when icon meaning is sufficiently clear



Do not allow toolbars to:



\- overflow the viewport accidentally

\- create microscopic controls

\- wrap into chaotic multi-row arrangements

\- hide essential actions without replacement



A multi-row toolbar is acceptable only when intentional.



\---



\# 19. BUTTONS



Buttons should adapt according to context.



Do not make every mobile button full-width.



Use full-width buttons when:



\- the action is dominant

\- the surrounding layout is naturally stacked

\- increased tap area improves usability



Keep compact actions compact when appropriate.



Button groups may:



\- wrap

\- stack

\- collapse

\- move secondary actions into overflow



Preserve clear action hierarchy after transformation.



\---



\# 20. FORMS



Forms should remain comfortable on narrow screens.



On mobile:



\- stack fields when side-by-side placement becomes cramped

\- keep labels readable

\- preserve adequate touch targets

\- avoid horizontal scrolling

\- keep validation close to the relevant field

\- ensure the active field remains visible when the keyboard opens



Multi-column desktop forms should collapse according to logical field grouping.



Do not split closely related inputs merely because a breakpoint was reached.



Do not retain two-column forms when each field becomes awkwardly narrow.



\---



\# 21. MOBILE KEYBOARD



Account for the on-screen keyboard.



Inputs, chat boxes, search bars, editors, and forms must remain usable when the keyboard is visible.



Avoid layouts where the keyboard:



\- hides the active input

\- hides essential actions

\- traps the user in an inaccessible scroll region

\- breaks fixed positioning

\- causes major layout jumps



Use appropriate viewport behavior.



Do not assume `100vh` always represents the visible mobile area.



\---



\# 22. MODALS



Desktop dialogs should not simply shrink until they barely fit a phone.



At narrow widths, consider transforming appropriate dialogs into:



\- near-full-width dialogs

\- bottom sheets

\- full-screen workflows



Ensure:



\- content remains scrollable

\- headings remain visible where appropriate

\- actions remain reachable

\- close controls remain accessible

\- the surface does not extend beyond the viewport



Avoid multiple nested overlays.



\---



\# 23. SHEETS AND DRAWERS



Sheets and drawers are useful responsive transformations for secondary interfaces.



They should:



\- clearly relate to the triggering action

\- remain dismissible

\- preserve state where appropriate

\- contain their own scrolling when necessary

\- avoid conflicting with page scrolling

\- respect safe screen boundaries



Do not use a sheet merely because the device is mobile.



Use it when it improves the workflow.



\---



\# 24. CARDS



Card grids should adapt deliberately.



Possible transformations:



```text

4 columns

→ 3 columns

→ 2 columns

→ 1 column

```



but do not blindly use this progression.



Determine column count from actual minimum useful card width.



Cards should not become so narrow that:



\- titles wrap excessively

\- controls collide

\- metadata becomes unreadable

\- content hierarchy disappears



For some information, switching from cards to a compact list on mobile may be better.



\---



\# 25. LISTS



Lists usually translate well across viewport sizes.



On smaller displays:



\- preserve primary label

\- preserve essential metadata

\- reposition secondary metadata

\- collapse infrequent actions when necessary

\- maintain comfortable row interaction



Do not allow trailing actions to crush the primary content.



Avoid unnecessary horizontal scrolling for ordinary lists.



\---



\# 26. TABLES



Tables require deliberate responsive treatment.



Do not crush every column until the table technically fits.



Choose among:



\### Horizontal scrolling



Appropriate when column relationships must remain visible.



\### Priority columns



Show essential columns and move secondary information elsewhere.



\### Stacked rows



Appropriate when each record can become a compact detail layout.



\### Alternate mobile view



Appropriate when the desktop table interaction fundamentally does not translate.



Preserve access to important data.



Do not silently hide columns containing essential information.



\---



\# 27. FILE INTERFACES



File browsers must remain usable on mobile.



Grid and list layouts may use different responsive strategies.



Preserve access to:



\- file name

\- file type

\- primary action

\- contextual actions

\- navigation hierarchy



Long filenames must not destroy the layout.



Context menus must work with touch.



Desktop drag-and-drop should not be the only route to an important file operation.



\---



\# 28. EDITORS



Editors should prioritize usable workspace.



On smaller displays:



\- collapse secondary panels

\- reduce nonessential chrome

\- preserve primary editing controls

\- provide deliberate access to hidden panels

\- avoid toolbars consuming excessive vertical space



Do not shrink editor content until it becomes unusable merely to preserve every desktop panel.



The editing surface is usually the priority.



\---



\# 29. TERMINALS AND CODE



Code and terminal content may intentionally scroll horizontally.



Do not force code to wrap if wrapping harms readability or meaning.



Keep controls outside the scrolling content usable.



Ensure font sizing remains readable.



Avoid excessive surrounding padding on small screens.



\---



\# 30. MAPS



Maps should receive useful viewport space.



Avoid placing maps inside tiny fixed-height mobile containers.



Map controls should remain reachable without covering excessive map content.



Information panels may transform between:



\- side panels

\- floating cards

\- bottom sheets

\- dedicated detail views



according to available space.



Do not allow overlays to consume the entire usable map accidentally.



\---



\# 31. CALENDARS



Calendar layouts should adapt according to available space.



Do not compress a desktop month/week layout until entries become unreadable.



Possible responsive transformations include:



\- reduced information density

\- alternate calendar views

\- scrollable time grids

\- agenda/list representation

\- focused day views



Preserve navigation and event access.



Calendar controls must not stretch awkwardly merely to fill mobile width.



\---



\# 32. CHARTS AND VISUALIZATIONS



Visualizations must remain interpretable as their container changes.



Do not merely scale the entire visualization down.



Responsive visualization may require:



\- fewer visible labels

\- repositioned legends

\- scrollable plotting areas

\- alternate annotation placement

\- adjusted control placement

\- simplified secondary detail



Do not remove information required to understand the visualization.



Interactive targets must remain usable with touch.



\---



\# 33. ASSISTANT UI



Assistant interfaces require special attention on mobile.



Preserve:



\- conversation readability

\- composer accessibility

\- attachments

\- tool results

\- structured renderers

\- conversation navigation

\- status information



The composer must remain usable when the software keyboard is open.



Structured results should adapt to their own responsive rules.



Do not squeeze desktop Assistant side panels into the conversation viewport.



Long responses should remain readable without excessive horizontal padding.



\---



\# 34. IMAGES AND MEDIA



Media should respect container dimensions and aspect ratio.



Prevent media from causing page overflow.



Use cropping only when the content allows it.



Do not distort images to fill containers.



Galleries should adapt their grid according to meaningful minimum item sizes.



Media controls must remain touch-friendly.



\---



\# 35. SAFE AREAS AND VIEWPORT EDGES



Account for environments where content may conflict with screen boundaries or browser UI.



Important controls should not sit flush against inaccessible edges.



Fixed or sticky mobile controls should respect appropriate safe-area spacing where applicable.



Do not assume every viewport is a perfect rectangle of usable pixels.



\---



\# 36. STICKY AND FIXED UI



Use sticky and fixed positioning deliberately.



Before making something persistent, consider how much viewport space it consumes.



On mobile, stacked persistent elements can quickly leave almost no content area.



Avoid simultaneously fixing:



\- large headers

\- large toolbars

\- bottom navigation

\- composers

\- status bars



unless the resulting workspace remains genuinely usable.



Persistent UI should justify the space it occupies.



\---



\# 37. SCROLLING



Scrolling should occur in predictable places.



Avoid unnecessary nested scroll containers.



Do not create situations where users cannot tell which surface is scrolling.



Primary page scrolling should remain the default unless the workflow genuinely benefits from contained scrolling.



Contained scroll regions should have clear boundaries.



On mobile, avoid scroll traps.



Preserve scroll position where context would otherwise be lost.



\---



\# 38. CONTENT GROWTH



Responsive layouts must survive real content.



Test mentally and visually against:



\- long titles

\- long filenames

\- large numbers

\- many tags

\- many actions

\- empty content

\- large result sets

\- generated Assistant content

\- user-generated text

\- validation messages

\- unusually long metadata



Do not design only around ideal short placeholder text.



Content should influence layout without casually destroying it.



\---



\# 39. OVERFLOW MENUS



Overflow menus are useful for preserving compact layouts.



Use them for lower-priority actions when available width becomes constrained.



Do not hide the primary action inside overflow merely to create a cleaner screenshot.



Actions moved into overflow should remain logically grouped and discoverable.



Do not create several unrelated overflow menus beside one another.



\---



\# 40. RESPONSIVE VISIBILITY



Hiding content is not the default responsive strategy.



Before hiding something, determine whether it is:



\- decorative

\- redundant

\- secondary

\- recoverable elsewhere



Do not hide essential context or functionality solely because fitting it is inconvenient.



When content is hidden from the current layout, provide another route when users still need it.



\---



\# 41. COMPONENT-LEVEL RESPONSIVENESS



Reusable components should not assume they always occupy the same page width.



Where practical, components should adapt to their own available container rather than relying exclusively on the global viewport.



A component used in:



\- a full page

\- a sidebar

\- a split panel

\- a modal



may have very different available widths on the same device.



Design reusable components accordingly.



Use container-aware behavior when it materially improves robustness.



\---



\# 42. DO NOT OVERFIT BREAKPOINTS



Avoid CSS that accumulates many tiny breakpoint-specific patches.



Patterns such as:



```text

@media 1180px

@media 1140px

@media 1100px

@media 1070px

@media 1030px

```



often indicate that the underlying layout is too rigid.



Prefer fixing layout behavior over continuously adding exceptions.



Use breakpoints for meaningful structural transitions.



\---



\# 43. RESPONSIVE REGRESSION DISCIPLINE



When modifying desktop UI, verify that mobile was not broken.



When modifying mobile UI, verify that desktop was not broken.



When modifying shared components, consider every major context in which they appear.



Do not fix one viewport by introducing hardcoded behavior that damages another.



Responsive fixes should improve the underlying layout whenever possible.



\---



\# 44. RESPONSIVE VERIFICATION



Do not declare responsive UI complete because CSS contains media queries.



Inspect the rendered interface.



For affected interfaces, verify:



1\. narrow phone

2\. standard phone

3\. larger phone

4\. intermediate/tablet width

5\. laptop/desktop width

6\. large width when relevant



Check:



\- horizontal overflow

\- vertical overflow

\- text wrapping

\- truncation

\- navigation

\- primary actions

\- touch targets

\- forms

\- dialogs

\- menus

\- sheets

\- sidebars

\- toolbars

\- scrolling

\- fixed elements

\- sticky elements

\- long content

\- empty content

\- structured results

\- keyboard interaction where relevant

\- touch interaction where relevant



Do not inspect only the initial state.



Interact with the interface.



Open menus.



Open dialogs.



Expand content.



Trigger states.



Scroll.



Enter text.



Inspect realistic content.



If a responsive problem is visible, correct it before reporting completion.



\---



\# 45. FINAL RESPONSIVE STANDARD



A responsive Toolbox interface should feel intentionally designed at the current size.



It should not feel like a larger interface being tolerated by a smaller screen.



When space changes:



preserve function,

preserve hierarchy,

transform structure,

simplify secondary presentation,

protect readability,

and keep the primary task easy to perform.



Never trade usability merely to preserve desktop geometry.

