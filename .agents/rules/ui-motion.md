\---

trigger: always\_on

\---



\# TOOLBOX — MOTION \& INTERACTION



This file governs motion, animation, transitions, gestures, and interactive feedback across Toolbox.



It supplements:



\- `UI Core`

\- `UI Design System`

\- `Responsive UI`



Motion in Toolbox must communicate something.



Animation is not decoration added after an interface is complete.



It is part of how the interface explains:



\- state

\- structure

\- causality

\- hierarchy

\- navigation

\- continuity

\- spatial relationships

\- direct manipulation



Toolbox motion should feel precise, calm, intelligent, and deliberate.



\---



\# 1. CORE MOTION CHARACTER



Toolbox motion should feel:



\- smooth

\- controlled

\- responsive

\- deliberate

\- elegant

\- physically coherent

\- restrained during ordinary work

\- expressive only when context justifies it



Avoid motion that feels:



\- bouncy

\- playful without reason

\- exaggerated

\- sluggish

\- theatrical

\- random

\- disconnected from user input

\- excessively springy

\- ornamental



Toolbox is not a toy interface.



Movement should reinforce the product's intelligence rather than compete for attention.



\---



\# 2. MOTION MUST HAVE A PURPOSE



Before adding animation, identify what the motion communicates.



Valid purposes include:



\- showing where an element came from

\- showing where an element went

\- indicating state change

\- connecting related views

\- revealing hierarchy

\- acknowledging interaction

\- communicating progress

\- maintaining spatial context

\- explaining expansion or collapse

\- directing attention to meaningful change

\- improving continuity between interface states



If an animation communicates nothing useful, it probably should not exist.



Do not animate an element merely because it can be animated.



\---



\# 3. INTERACTION COMES BEFORE ANIMATION



User interaction must never wait unnecessarily for animation.



Controls should respond immediately.



Do not block:



\- clicking

\- tapping

\- typing

\- navigation

\- scrolling

\- closing

\- selecting



while decorative motion finishes.



Animations should normally accompany state changes rather than delay them.



The user should feel that they caused the interface to move.



They should not feel that they submitted a request to the animation department.



\---



\# 4. MOTION HIERARCHY



Not every interaction deserves the same amount of motion.



Use three broad levels:



\## Micro Motion



For:



\- hover

\- press

\- selection

\- toggles

\- small indicators

\- focus changes

\- icon transitions

\- compact state changes



Micro motion should be fast and subtle.



\## Component Motion



For:



\- dropdowns

\- menus

\- expanding sections

\- tabs

\- cards revealing detail

\- tool panels

\- sheets

\- contextual interfaces



Component motion may be more visible but should remain efficient.



\## Spatial Motion



For:



\- page transitions

\- workspace transformations

\- major panels

\- interactive canvases

\- Mind

\- diagrams

\- immersive visual tools

\- scroll-driven storytelling



Spatial motion may be richer because it communicates larger structural relationships.



Do not use Spatial Motion for trivial actions.



\---



\# 5. MOTION TOKENS



Use a small shared motion system.



Prefer semantic motion tokens such as:



```text

\--motion-instant

\--motion-fast

\--motion-normal

\--motion-deliberate



\--ease-standard

\--ease-enter

\--ease-exit

\--ease-emphasized

```



Do not scatter arbitrary durations throughout components.



Avoid situations where similar components use:



```text

173ms

210ms

240ms

280ms

```



without meaningful reason.



Motion values should form a coherent system.



Reuse existing Toolbox motion values where established.



\---



\# 6. DURATION



Duration should correspond to distance, scale, and complexity.



Small state changes should complete quickly.



Large spatial changes may take slightly longer.



Ordinary UI interactions should never feel delayed.



As a principle:



small movement

→ fast



ordinary component transition

→ moderate



large spatial transformation

→ deliberate



Do not make animations long merely to make them noticeable.



Users should notice the relationship being communicated, not admire the duration.



\---



\# 7. EASING



Motion should accelerate and decelerate naturally.



Avoid constant linear movement for ordinary interface transitions unless the motion represents continuous mechanical progress.



Use easing appropriate to direction.



Elements entering may settle naturally.



Elements leaving may exit efficiently.



State transitions should avoid abrupt starts and stops.



Avoid exaggerated elastic easing.



Avoid large overshoots.



Avoid repeated bouncing.



Spring physics may be used only when they produce controlled, restrained movement.



Do not use springs simply because an animation library makes them convenient.



\---



\# 8. ENTERING ELEMENTS



When an element enters:



\- preserve spatial context

\- avoid unnecessary travel distance

\- avoid dramatic scaling

\- avoid making every child animate independently

\- keep the entrance related to its origin where possible



A dropdown should appear to originate from its trigger.



A contextual panel should relate spatially to the control that opened it.



A sheet should emerge from the direction implied by its structure.



Do not make unrelated elements fly in from arbitrary directions.



\---



\# 9. EXITING ELEMENTS



Exit motion should generally be faster and less prominent than entrance motion.



The user's intention is usually to remove or leave something.



Do not make them wait while it performs a farewell ceremony.



Exit direction should preserve spatial logic where applicable.



Avoid elaborate disappearance animations.



When immediate removal is clearer, immediate removal is acceptable.



\---



\# 10. EXPANSION AND COLLAPSE



Expansion should communicate that hidden content belongs to the triggering element.



Prefer motion that preserves continuity.



Avoid:



\- sudden large layout jumps

\- excessive bounce

\- animating massive `height` changes inefficiently

\- content appearing disconnected from its trigger



Collapsing should reverse the perceived relationship.



Do not animate every nested child separately unless that sequencing improves comprehension.



\---



\# 11. OPACITY



Opacity is useful for subtle state transitions.



Use fades for:



\- supporting content

\- overlays

\- contextual appearance

\- soft state transitions



Do not use opacity as the only motion mechanism for spatial transformations where movement would better explain the relationship.



Avoid fading entire interfaces repeatedly during ordinary navigation.



Excessive fading can make Toolbox feel sluggish.



\---



\# 12. SCALE



Use scale conservatively.



Small scale changes may reinforce:



\- press

\- selection

\- appearance

\- focus



Avoid dramatic zoom effects for ordinary controls.



Buttons should not visibly inflate when hovered.



Cards should not leap toward the user.



Large scale transitions should be reserved for interfaces where zooming has spatial meaning.



\---



\# 13. TRANSFORMS



Prefer transform-based motion where appropriate.



Transforms are useful for:



\- translation

\- subtle scale

\- panel movement

\- spatial transitions

\- direct manipulation



Avoid animating expensive layout properties unnecessarily.



Performance is part of motion quality.



A beautiful animation that stutters is not beautiful.



\---



\# 14. HOVER



Hover should provide subtle feedback.



Appropriate hover responses may include:



\- small background change

\- border change

\- subtle elevation

\- icon response

\- restrained transform

\- cursor change



Do not combine all of them automatically.



Avoid dramatic hover movement.



Hover must not cause surrounding layout to shift.



Hover must not reveal essential functionality without a touch-accessible alternative.



\---



\# 15. PRESS AND TAP



Press feedback should feel immediate.



A control may respond with:



\- subtle scale

\- surface change

\- opacity change

\- elevation change



Keep the effect restrained.



Press feedback should confirm interaction without making the control feel rubbery.



Touch feedback must not delay the resulting action.



\---



\# 16. TOGGLES AND STATE CHANGES



State transitions should make the relationship between old and new state understandable.



Examples include:



\- switches

\- segmented controls

\- selected pills

\- tabs

\- mode selectors

\- expandable controls



When an indicator moves between states, preserve spatial continuity.



Avoid destroying and recreating an indicator when movement can communicate the state change more clearly.



\---



\# 17. TABS



Tab transitions should be fast.



Switching tabs is a navigation action, not a cinematic event.



If an active indicator moves between tabs, the movement may visually connect the states.



Content transitions should remain subtle.



Do not slide entire pages large distances for every tab switch unless spatial direction genuinely matters.



\---



\# 18. MENUS AND DROPDOWNS



Menus should appear quickly.



Motion should reinforce their relationship to the trigger.



Use restrained combinations of:



\- opacity

\- slight translation

\- subtle scale



Avoid:



\- large zoom

\- bounce

\- long fade

\- rotating menus

\- staggered menu items without reason



Menu interaction should become available immediately.



\---



\# 19. MODALS



Modal motion should communicate layering.



The modal should feel as though it has entered above the current interface.



Use restrained entrance motion.



The background transition should not become visually dominant.



Do not dramatically zoom the underlying page.



Do not make the modal bounce into place.



Closing should be efficient.



\---



\# 20. SHEETS AND DRAWERS



Sheets and drawers should move according to their physical direction.



Bottom sheet

→ enters from bottom



Side drawer

→ enters from corresponding side



The relationship should remain obvious.



Do not animate a bottom sheet from the center of the screen.



Direct gesture manipulation may track the user's movement where appropriate.



Release behavior should settle smoothly without exaggerated springing.



\---



\# 21. PAGE AND VIEW TRANSITIONS



Most Toolbox navigation does not require elaborate page transitions.



Use richer transitions only when they preserve context or explain spatial relationships.



Ordinary page changes should remain fast.



Do not apply a global dramatic entrance animation to every page.



Do not repeatedly animate page headings, cards, buttons, and content every time navigation occurs.



The application should feel responsive before it feels animated.



\---



\# 22. SHARED ELEMENT CONTINUITY



When the same conceptual object persists across views, consider maintaining visual continuity.



Examples:



\- file opening into preview

\- card opening into detail

\- Mind node opening into a room

\- result expanding into deeper information

\- image opening into a larger viewer



The transition may preserve:



\- position

\- scale

\- shape

\- identity

\- direction



Do not force shared-element animation where implementation complexity outweighs the usability benefit.



\---



\# 23. SCROLL MOTION



Scrolling should remain under user control.



Do not fight the user's scroll.



Avoid excessive scroll hijacking.



Avoid forcing content through predetermined animated sequences during ordinary workflows.



Scroll-linked animation is appropriate when:



\- it explains relationships

\- reveals a narrative

\- supports spatial understanding

\- creates an intentionally immersive presentation



It should not make normal navigation difficult.



\---



\# 24. SCROLL-TRIGGERED REVEALS



Scroll-triggered animation may be used in presentation-oriented or expressive interfaces.



Examples include:



\- About

\- Mind

\- product storytelling

\- explanatory visual sequences



Reveal motion should remain coherent.



Avoid making every paragraph, button, icon, and divider independently animate into existence.



Group related content.



Use sequencing to reinforce hierarchy.



Content should remain understandable if animation is reduced or unavailable.



\---



\# 25. STAGGER



Stagger can communicate grouping and sequence.



Use it sparingly.



Appropriate uses may include:



\- a small group of related nodes

\- a short result set

\- a deliberate visualization sequence

\- structured onboarding



Do not stagger long lists.



Do not make users wait for twenty items to finish entering.



For large collections, render efficiently.



\---



\# 26. PARALLAX



Parallax should be rare.



Use it only where spatial depth materially contributes to an expressive interface.



Do not apply parallax to ordinary:



\- settings

\- forms

\- lists

\- dashboards

\- file views

\- utility tools



Parallax must not interfere with reading or scrolling.



Keep movement restrained.



Respect reduced-motion preferences.



\---



\# 27. DIRECT MANIPULATION



When users directly drag, resize, pan, rotate, or rearrange something, the interface should track their input closely.



Direct manipulation should feel immediate.



Avoid visible latency between pointer movement and object movement.



Examples include:



\- Mind nodes

\- diagrams

\- split panels

\- resizable panes

\- draggable items

\- maps

\- canvases



The object should feel attached to the user's input.



\---



\# 28. DRAG AND DROP



Drag interactions should clearly communicate:



\- what is draggable

\- when dragging has started

\- valid destinations

\- invalid destinations

\- where the item will land

\- whether the action succeeded



Use restrained elevation or scale to distinguish the dragged object.



Do not excessively enlarge it.



Drop targets should become clear when relevant.



Do not display every possible drop target before the user begins dragging unless necessary.



Provide non-drag alternatives for important actions when appropriate.



\---



\# 29. REORDERING



Reordering should preserve spatial continuity.



Nearby elements should move naturally to indicate the new position.



Avoid instant disappearance and reappearance when motion can clarify what changed.



Do not over-animate large lists.



The final position should become obvious before the drop completes when possible.



\---



\# 30. RESIZING



Resizable panels should update smoothly.



Do not animate against active user resizing.



While the user is dragging a resize handle, follow their movement directly.



After release, snapping may occur when useful.



Snapping should feel predictable.



Do not use aggressive spring effects after resizing.



\---



\# 31. PAN AND ZOOM



Canvas-style interfaces may support pan and zoom.



Examples include:



\- Mind

\- diagrams

\- maps

\- visual editors

\- architecture tools



Pan should feel directly connected to input.



Zoom should preserve the user's spatial reference where possible.



When zooming toward a pointer or gesture location, maintain that point as the conceptual focus.



Avoid sudden recentering.



Provide sensible limits.



Do not allow users to become effectively lost in infinite space without navigation aids where needed.



\---



\# 32. MIND AND SPATIAL INTERFACES



Mind may use richer motion than ordinary Toolbox utilities.



Its motion should communicate the structure of knowledge.



Nodes, rooms, relationships, and navigation should feel spatially connected.



Potential motion may communicate:



\- relationship strength

\- expansion

\- traversal

\- focus

\- hierarchy

\- retrieval

\- creation

\- reorganization



Do not turn Mind into an animated screensaver.



Motion should help users understand where information lives and how concepts relate.



When entering a room or expanding a node, preserve enough spatial context that the user understands where they came from.



When returning, restore that context where practical.



Complex animation should remain controllable and comprehensible.



\---



\# 33. DATA VISUALIZATION MOTION



Charts and visualizations may animate when motion helps explain change.



Useful examples include:



\- values changing

\- data entering

\- filtering

\- selection

\- timeline progression

\- transitions between related representations



Do not animate charts merely because they appeared on screen.



Avoid long "count up" sequences that delay reading the actual value.



Data should become usable quickly.



Motion must never distort the user's interpretation of the data.



\---



\# 34. MAP MOTION



Map motion should preserve geographic context.



When moving between locations:



\- pan appropriately

\- zoom appropriately

\- avoid unnecessary dramatic flights

\- keep duration proportional to distance



Do not repeatedly recenter the map against the user's actions.



Selection transitions should make the selected location obvious.



Panels appearing over maps should not create disorienting map jumps unless repositioning is necessary to keep relevant content visible.



\---



\# 35. CALENDAR MOTION



Calendar transitions may communicate temporal direction.



Moving forward in time and backward in time may use subtle directional continuity.



Keep transitions fast.



Do not animate individual calendar cells unnecessarily.



Event creation, movement, and resizing should clearly communicate resulting time placement.



\---



\# 36. FILE INTERACTION MOTION



File interfaces should prioritize efficiency.



Appropriate motion includes:



\- selection feedback

\- opening preview

\- drag state

\- folder navigation

\- contextual menus

\- upload progress



Do not heavily animate ordinary file browsing.



Users interacting with files are usually trying to accomplish something, not attend a film festival.



\---



\# 37. ASSISTANT MOTION



Assistant motion should communicate activity without creating noise.



Appropriate motion may include:



\- response appearance

\- tool activity

\- loading state

\- streaming

\- structured result appearance

\- status transitions



Do not animate every token individually in a distracting way.



Do not repeatedly pulse large interface areas.



Do not use decorative "AI" effects merely because the feature involves artificial intelligence.



The Assistant should feel capable, not mystical.



\---



\# 38. LOADING MOTION



Loading animation should indicate genuine activity.



Use:



\- restrained spinners

\- skeletons

\- progress indicators

\- subtle status transitions



Avoid:



\- elaborate looping illustrations

\- dramatic glowing effects

\- excessive pulsing

\- fake progress

\- animation unrelated to actual state



For long operations, changing meaningful status text may be more useful than increasingly elaborate motion.



\---



\# 39. SKELETONS



Skeletons should approximate the structure of expected content.



Do not create skeleton layouts unrelated to the result that eventually appears.



Skeleton motion should be subtle.



Avoid aggressive shimmer.



Do not display skeletons for operations so fast that the skeleton merely flashes.



For very short loading states, maintaining the existing interface may produce a calmer experience.



\---



\# 40. PROGRESS



When progress can be measured, communicate real progress.



When progress cannot be measured, do not fabricate percentages.



Indeterminate progress should look indeterminate.



Progress completion may use a subtle transition into the resulting state.



Do not delay the result merely to let a progress animation reach 100%.



\---



\# 41. SUCCESS FEEDBACK



Success feedback should be proportional to the action.



Small actions may require only:



\- changed state

\- subtle confirmation

\- compact message



Major completed workflows may justify stronger confirmation.



Do not trigger confetti for ordinary actions.



Do not interrupt workflow with unnecessary success dialogs.



The successful result itself is often sufficient feedback.



\---



\# 42. ERROR MOTION



Do not use aggressive shaking or flashing for errors.



Errors should attract enough attention to be noticed without feeling hostile.



Appropriate feedback may include:



\- focus movement

\- subtle emphasis

\- inline appearance

\- restrained highlight



Do not repeatedly animate an unresolved error.



Accessibility and comprehension take priority over dramatic feedback.



\---



\# 43. DESTRUCTIVE ACTIONS



Do not make destructive actions theatrically animated.



Risk should be communicated through:



\- wording

\- hierarchy

\- confirmation where necessary

\- appropriate visual treatment



Animation should not trivialize destructive actions.



When deletion visibly removes an item, a short exit transition may clarify what disappeared.



Do not delay the action unnecessarily.



\---



\# 44. NOTIFICATIONS



Notification motion should attract attention without hijacking it.



Entry should be subtle.



Notifications should not fly dramatically across the screen.



Multiple notifications should not create competing animations.



If notifications stack, movement should preserve order and spatial understanding.



Dismissal should be efficient.



\---



\# 45. FOCUS TRANSITIONS



When the interface shifts focus to another region, motion may help explain the transition.



Examples:



\- opening detail

\- jumping to search result

\- navigating to selected node

\- highlighting validation failure



Avoid instant large spatial jumps when they disorient the user.



Use scrolling or movement only when necessary.



Do not animate focus so slowly that it delays work.



\---



\# 46. LAYOUT ANIMATION



Layout changes may animate when doing so helps users understand what changed.



Examples:



\- panel opening

\- item insertion

\- item removal

\- reordering

\- expanding detail



Do not animate every layout reflow.



Large collections should prioritize performance.



Avoid animations that cause surrounding text to jitter.



\---



\# 47. INTERRUPTION



Animations should handle interruption gracefully.



If the user reverses an action before an animation finishes, the interface should adapt.



Examples:



\- open then immediately close

\- expand then collapse

\- switch tabs rapidly

\- reverse navigation

\- change selection during transition



Do not force the previous animation to finish before acknowledging new input unless correctness requires it.



Motion systems should respond to the current state, not replay a queue of outdated intentions.



\---



\# 48. CONCURRENT MOTION



Avoid multiple unrelated animations competing for attention.



When several elements change together, establish hierarchy.



The most important change may receive the clearest motion.



Secondary changes should remain quieter.



Related motion may be synchronized.



Unrelated components should not independently perform elaborate transitions at the same time.



\---



\# 49. PERFORMANCE



Motion must remain smooth under realistic conditions.



Prefer performant properties and techniques.



Avoid unnecessary:



\- layout thrashing

\- huge blur animations

\- expensive filters

\- continuous shadows

\- excessive simultaneous transforms

\- large numbers of independently animated DOM nodes



Test complex animation with realistic content.



Do not optimize only for an empty development screen.



If an animation cannot remain smooth, simplify it.



Performance is part of the design.



\---



\# 50. REDUCED MOTION



Respect the user's reduced-motion preference.



Reduced motion does not necessarily mean removing every transition.



Preserve necessary state feedback.



Remove or reduce:



\- large spatial movement

\- parallax

\- dramatic zoom

\- unnecessary scrolling animation

\- decorative motion

\- complex stagger

\- continuous ambient movement



Interfaces must remain fully understandable and usable without rich animation.



No feature may depend on animation to function.



\---



\# 51. CONTINUOUS AND AMBIENT MOTION



Continuous animation should be rare.



Examples requiring scrutiny include:



\- floating objects

\- pulsing surfaces

\- glowing borders

\- moving backgrounds

\- endlessly rotating decorative elements



Do not create perpetual motion merely to make an interface feel alive.



Continuous movement consumes attention even when users stop consciously noticing it.



Reserve it for genuine ongoing state where motion communicates something useful.



\---



\# 52. ANIMATION AND SOUND



Do not assume animation requires sound.



Ordinary Toolbox motion should remain silent.



If a feature ever uses audio feedback, it must serve a clear functional purpose and must not become a requirement for understanding state.



Visual and structural feedback must remain sufficient.



\---



\# 53. MOTION CONSISTENCY



Similar interactions should move similarly.



Dropdowns should not each have unrelated animation styles.



Dialogs should not each enter differently.



Panels serving the same purpose should share motion behavior.



Consistency helps users build spatial expectations.



Do not create bespoke motion for ordinary components simply because the current task allows it.



\---



\# 54. EXPRESSIVE MOTION



Toolbox may use expressive motion in experiences where motion materially contributes to understanding or identity.



Examples may include:



\- Mind

\- About

\- onboarding

\- spatial knowledge interfaces

\- rich visual explanations

\- carefully designed feature introductions



Expressive motion may be more ambitious.



It must still remain:



\- coherent

\- controlled

\- performant

\- navigable

\- interruptible

\- accessible



Expressive does not mean chaotic.



\---



\# 55. MOTION VERIFICATION



Do not consider motion complete because the animation runs.



Inspect it in the actual interface.



Verify:



1\. the motion has a purpose

2\. the interaction responds immediately

3\. duration feels appropriate

4\. easing feels controlled

5\. spatial direction makes sense

6\. repeated interaction does not become irritating

7\. rapid interaction does not break state

8\. interruption behaves correctly

9\. surrounding layout remains stable

10\. touch interaction works where applicable

11\. scrolling remains natural

12\. animation remains smooth

13\. realistic content does not degrade performance

14\. reduced-motion behavior works

15\. functionality remains understandable without animation



Test interactions repeatedly.



An animation that feels pleasant once may become unbearable on the fiftieth use.



Toolbox is a working environment.



Repeated interactions matter.



\---



\# 56. FINAL MOTION STANDARD



Toolbox motion should make the interface easier to understand.



Users should intuitively perceive:



\- what changed

\- why it changed

\- where something came from

\- where something went

\- what their action caused

\- how interface regions relate



Motion should disappear into the quality of the experience.



The user should remember that Toolbox felt exceptionally smooth, not that every object spent the afternoon moving around.



When uncertain:



respond immediately,

move with purpose,

preserve spatial context,

keep ordinary interactions restrained,

allow richer motion only where it improves understanding,

and never animate merely to prove that you can.

