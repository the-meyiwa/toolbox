\---

trigger: always\_on

\---



\# TOOLBOX — STRUCTURED RENDERERS



This file governs structured result rendering across Toolbox.



It supplements:



\- `UI Core`

\- `UI Design System`

\- `Responsive UI`

\- `Motion \& Interaction`

\- `UI Components`

\- `UI Accessibility`



Toolbox should render structured information using interfaces appropriate to the structure of that information.



Do not reduce rich structured data to plain text when Toolbox already has, or reasonably should have, a better renderer.



The renderer should help users understand and interact with the result.



It should not merely decorate the same information.



\---



\# 1. CORE RENDERER PRINCIPLE



Render according to the data's meaning.



Examples:



```text id="3rc5ix"

geographic data

→ map



image collection

→ gallery



tabular data

→ table



time-series or comparative numeric data

→ chart



mathematical expressions

→ math renderer



calendar/event data

→ calendar or event renderer



files

→ file renderer



financial data

→ financial renderer



code

→ code renderer



structured entities

→ appropriate structured result

```



Do not choose a renderer merely because it looks impressive.



The renderer must improve comprehension, interaction, or both.



\---



\# 2. DATA TYPE BEFORE SOURCE



Renderer selection should be based primarily on what the result represents.



Do not create separate visual systems because the same kind of data came from different:



\- APIs

\- tools

\- agents

\- models

\- databases

\- providers



For example:



```text id="0hc2lb"

Google Maps result

OpenStreetMap result

internal location result

Assistant tool result

```



may all ultimately represent geographic locations.



Where appropriate, they should use the same Toolbox map rendering system.



The renderer represents the result type, not the backend that produced it.



\---



\# 3. STRUCTURED DATA SHOULD REMAIN STRUCTURED



Do not prematurely flatten structured data into prose.



If the underlying result contains structured fields, preserve them long enough for the UI to render them appropriately.



Avoid workflows like:



```text id="8sjcnq"

tool returns structured JSON

→ AI converts it into prose

→ UI tries to reconstruct structure

```



Prefer:



```text id="yc097m"

tool returns structured result

→ result normalized

→ appropriate renderer selected

→ renderer receives structured data

```



The Assistant may provide explanatory text around the renderer.



Do not destroy useful structure before rendering.



\---



\# 4. NORMALIZATION LAYER



When different tools return similar result types in different formats, normalize them before rendering.



For example, location providers may return different field names for:



\- latitude

\- longitude

\- name

\- address

\- category



Normalize these into a shared internal shape where practical.



Do not make every renderer understand every provider's raw response format.



Prefer:



```text id="tm1s5i"

provider data

→ adapter / normalization

→ Toolbox renderer model

→ renderer

```



This reduces duplication and makes renderer behavior predictable.



\---



\# 5. RENDERER REGISTRY



Where architecture supports it, renderer selection should be centralized.



A renderer registry or equivalent system may map result types to components.



Conceptually:



```text id="ybmb64"

map\_result

→ MapRenderer



table\_result

→ TableRenderer



chart\_result

→ ChartRenderer



file\_result

→ FileRenderer



calendar\_result

→ CalendarRenderer



math\_result

→ MathRenderer

```



Do not spread large renderer-selection conditionals throughout unrelated components.



Renderer registration should remain extensible.



Adding a new result type should not require rewriting the entire Assistant interface.



\---



\# 6. DO NOT GUESS RESULT TYPES CARELESSLY



Use explicit metadata when available.



If the system knows a result is a map result, do not infer that fact again from arbitrary text.



If explicit typing does not exist, inference may be necessary.



Inference should be conservative.



Do not incorrectly render ordinary text as structured UI merely because it contains:



\- numbers

\- coordinates

\- dates

\- filenames



The renderer must match the actual semantic result.



\---



\# 7. TEXT AND RENDERERS SHOULD COMPLEMENT EACH OTHER



Do not duplicate the same content twice.



Bad:



```text id="zwjgin"

Assistant:

"The temperature is 29°C."



Weather renderer:

29°C

```



when the sentence adds no useful context.



Better:



Renderer:

structured weather information



Assistant:

brief interpretation, caveat, recommendation, or answer that adds meaning



Similarly:



Do not place an entire table in prose and then render the same table below.



Do not narrate every visible field in a file card.



Text should explain.



The renderer should present structure.



\---



\# 8. RENDERERS SHOULD NOT REPLACE NECESSARY EXPLANATION



A renderer is not always a complete answer.



A chart may show the data but not explain the important pattern.



A map may show locations but not explain which route or place is relevant.



A financial renderer may show values without explaining what changed.



Use explanatory text when interpretation matters.



Do not force users to reverse-engineer the Assistant's reasoning from visualization alone.



\---



\# 9. MULTIPLE STRUCTURED RESULTS



A response may contain more than one structured result.



Render multiple results when each materially contributes to the answer.



Avoid creating a wall of widgets.



Ask whether each renderer provides distinct value.



For example:



```text id="zwqv3f"

route explanation

\+

map

\+

turn-by-turn instructions

```



may be useful.



But:



```text id="zzs0r8"

map

\+

second map showing same points

\+

text list containing identical information

```



is redundant.



Prefer one strong representation per information role.



\---



\# 10. MIXED CONTENT



Assistant responses may combine:



\- prose

\- structured renderers

\- citations

\- files

\- code

\- calculations

\- actions



Preserve a clear reading order.



Do not insert structured UI randomly between sentences.



A typical sequence may be:



```text id="hhsly8"

brief answer or context



structured renderer



interpretation / supporting detail



optional next action

```



The exact structure should follow the task.



\---



\# 11. RENDERER CONTAINERS



Renderers should feel integrated with Toolbox.



Use consistent:



\- spacing

\- radius

\- typography

\- controls

\- iconography

\- menus

\- loading states

\- error states

\- responsive behavior



Do not wrap every renderer in several decorative cards.



The renderer itself may already define a strong visual boundary.



Avoid:



```text id="re13gl"

card

&#x20; └── card

&#x20;      └── renderer card

```



Use the minimum container structure necessary.



\---



\# 12. RENDERER TITLES



Do not automatically add a giant title above every renderer.



A title is useful when it adds context such as:



\- what the result represents

\- which dataset is shown

\- what period is covered

\- what location is being viewed



Avoid redundant titles.



If the Assistant immediately says:



`Here is your route to Ikeja City Mall`



the map does not necessarily need another large:



`ROUTE TO IKEJA CITY MALL`



inside it.



\---



\# 13. RENDERER ACTIONS



Renderers may expose actions when those actions are useful.



Examples:



\- open

\- copy

\- download

\- expand

\- inspect

\- filter

\- zoom

\- navigate

\- share

\- add to calendar

\- open file

\- view source



Do not attach every imaginable action to every renderer.



Primary renderer actions should be obvious.



Secondary actions may live in contextual or overflow menus.



\---



\# 14. RENDERER STATE



Every reusable renderer should intentionally handle relevant states:



\- loading

\- success

\- partial data

\- empty

\- error

\- stale data

\- unavailable data



Do not assume the ideal successful payload will always exist.



A renderer should fail gracefully.



A broken subrenderer should not necessarily destroy the entire Assistant response.



\---



\# 15. PARTIAL DATA



Render useful partial data when doing so is safe and understandable.



If one field is missing, do not necessarily discard the entire result.



For example:



```text id="m2ahym"

name ✓

address ✓

coordinates ✓

rating unavailable

```



may still be a useful location result.



Do not fabricate missing values.



Indicate unavailable information only when relevant.



\---



\# 16. UNKNOWN FIELDS



Renderers should ignore unsupported optional fields gracefully.



Do not crash because an API added extra data.



Do not automatically expose every provider-specific property to the user.



Only surface fields that improve the experience.



Raw payload completeness is not the same as useful UI.



\---



\# 17. FALLBACK RENDERING



Every structured result type should have a reasonable fallback path.



If the specialized renderer cannot load:



1\. preserve the underlying useful information where possible

2\. show a clear fallback representation

3\. avoid exposing raw internal payloads unless the interface is specifically a developer/debugging context



Example:



```text id="u1zhmn"

Map unavailable



Locations:

\- Location A

\- Location B

\- Location C

```



is preferable to:



```json id="3anfxz"

{

&#x20; "lat": ...,

&#x20; "lng": ...

}

```



for an ordinary user.



\---



\# 18. RAW JSON



Do not display raw JSON to ordinary users unless the task explicitly concerns raw structured data.



JSON is an implementation format.



It is not a default interface.



Developer tools, API inspectors, code tools, and debugging environments may intentionally expose raw JSON.



Ordinary Assistant result rendering should not.



\---



\# 19. MAP RENDERER



Use a map when spatial relationships materially help the user.



Appropriate uses include:



\- locations

\- routes

\- nearby places

\- geographic comparisons

\- travel

\- directions

\- area context



Map rendering should support relevant information such as:



\- markers

\- routes

\- selected location

\- labels

\- detail panels

\- zoom

\- pan



Do not use a map when location is incidental and plain text is clearer.



\---



\# 20. MAP RESULT LISTS



When a map contains several meaningful locations, consider pairing it with a corresponding structured list.



Map and list should represent the same underlying entities.



Selecting a list item may highlight the map location.



Selecting a marker may expose the related item.



Do not maintain separate unsynchronized datasets for the map and list.



\---



\# 21. MAP VIEWPORT



Map viewport should reflect the relevant data.



When multiple relevant points exist, fit them appropriately.



Do not zoom so far out that the result becomes meaningless.



Do not zoom so far in that relevant points disappear.



When the user manually changes the viewport, do not continually override them without a strong reason.



\---



\# 22. ROUTE RENDERING



Routes should communicate:



\- origin

\- destination

\- path

\- relevant intermediate information

\- travel context where available



Use route geometry where available.



Do not fabricate road geometry from textual instructions.



If route geometry is unavailable, use an appropriate fallback.



Turn-by-turn instructions and the visual route should remain consistent.



\---



\# 23. IMAGE RENDERER



Use image rendering for actual image content.



Support appropriate patterns such as:



\- single image

\- gallery

\- comparison

\- preview

\- generated image result



Preserve aspect ratio.



Do not distort images to fit arbitrary container dimensions.



Use cropping only when intentional.



\---



\# 24. IMAGE GALLERIES



Image collections should use an appropriate gallery layout.



Consider:



\- image count

\- aspect ratios

\- screen width

\- selection behavior

\- expansion

\- captions



Do not display a dozen full-size images vertically when a gallery would be more usable.



Do not force visually unrelated image dimensions into identical distorted boxes.



\---



\# 25. FILE RENDERER



Files should render as files, not as plain hyperlinks when richer file information is available.



A file result may include:



\- type icon

\- filename

\- type

\- size

\- date

\- relevant metadata

\- actions



Use the shared Toolbox file-icon system.



The same file type should have the same representation across Toolbox.



\---



\# 26. FILE COLLECTIONS



Multiple files should use a list or grid appropriate to the context.



Do not create one giant card per file unless the content warrants it.



Long filenames should be handled gracefully.



Primary actions should remain accessible.



\---



\# 27. TABLE RENDERER



Use a table when users need to compare structured values across consistent fields.



Tables should support:



\- headers

\- alignment

\- scrolling when necessary

\- appropriate numeric formatting

\- responsive behavior



Do not use tables for loosely structured content that would be clearer as a list.



Do not render tiny two-field objects as elaborate tables without reason.



\---



\# 28. TABLE SIZE



Large datasets should not automatically render every row.



Consider:



\- pagination

\- incremental loading

\- virtualization

\- row limits

\- summary

\- filtering



The appropriate strategy depends on the task.



Do not freeze the interface because the renderer enthusiastically decided to display 80,000 rows at once.



\---



\# 29. SORTING AND FILTERING



Interactive tables may provide sorting and filtering where useful.



Do not add controls that do not materially improve the user's ability to inspect the data.



Sort state should remain visible.



Filtering should not silently discard data without showing that a filter is active.



\---



\# 30. CHART RENDERER



Use charts when visual comparison or trends are easier to understand graphically.



Examples:



\- time series

\- distributions

\- comparisons

\- proportions

\- relationships



Do not use charts merely because numeric data exists.



Three values may be clearer as text.



A chart should answer a visual question.



\---



\# 31. CHART TYPE



Choose chart type according to the data relationship.



Examples:



time series

→ line or area where appropriate



category comparison

→ bar



distribution

→ histogram or appropriate distribution view



part-to-whole

→ use only when the representation remains clear



Do not choose visualization types for visual novelty.



Avoid misleading chart forms.



\---



\# 32. CHART AXES AND LABELS



Charts should remain interpretable.



Use meaningful:



\- axis labels

\- units

\- legends

\- direct labels

\- tooltips



where appropriate.



Do not overload a chart with redundant labels.



Do not omit units when they matter.



Numerical formatting should be readable.



\---



\# 33. CHART ACCESSIBILITY



Important chart information should not exist only visually.



Provide appropriate alternate access such as:



\- values

\- summary

\- accessible table

\- structured data view



where needed.



Do not rely only on color to distinguish important series.



\---



\# 34. MATHEMATICAL RENDERER



Mathematical content should use proper mathematical rendering.



Do not expose raw LaTeX when a math renderer is available.



Render:



\- fractions

\- powers

\- roots

\- matrices

\- integrals

\- derivatives

\- summations

\- limits

\- vectors

\- aligned equations



with appropriate mathematical typography.



Mathematics should remain readable and distinct from ordinary prose.



\---



\# 35. MATH AND EXPLANATION



Separate derivation from final result clearly.



A useful structure may be:



```text id="7331nf"

Explanation



Rendered equations



Interpretation / final result

```



Do not wrap every trivial numeric operation in an enormous math interface.



Use richer mathematical presentation when it improves clarity.



\---



\# 36. CODE RENDERER



Code should render using a proper code presentation.



Support:



\- monospace typography

\- syntax highlighting where available

\- copy action

\- horizontal scrolling

\- language identification when known



Do not force long code to wrap when wrapping reduces readability.



Do not use code blocks for ordinary non-code structured data.



\---



\# 37. TERMINAL OUTPUT



Terminal-like output should preserve terminal structure where relevant.



Use monospace presentation.



Do not apply syntax highlighting intended for source code to arbitrary shell output.



Separate:



\- command

\- stdout

\- stderr

\- status



when doing so improves clarity.



Do not expose internal terminal activity from background tools unless the user is meant to see it.



\---



\# 38. CALENDAR RENDERER



Use event/calendar rendering for temporal data where schedule relationships matter.



Possible forms include:



\- event card

\- agenda

\- day view

\- week view

\- month view

\- timeline



Choose according to the result.



A single event does not require a month calendar.



A dense schedule may benefit from a calendar or agenda.



\---



\# 39. EVENT DETAILS



Calendar events should clearly expose relevant:



\- title

\- date

\- time

\- timezone where important

\- location

\- duration

\- participants where appropriate

\- status



Avoid displaying implementation metadata as though it were user-facing calendar content.



\---



\# 40. FINANCIAL RENDERER



Financial results may require specialized formatting.



Possible information includes:



\- currency

\- amount

\- gain/loss

\- percentage change

\- period

\- comparison

\- holdings

\- transaction data



Use correct currency and number formatting.



Do not present financial values without context when context determines meaning.



For example:



`+4.2%`



requires a clear reference period or comparison when relevant.



\---



\# 41. FINANCIAL VISUALIZATION



Financial charts should be precise.



Avoid visual exaggeration.



Clearly communicate:



\- period

\- units

\- baseline

\- comparison



Do not use decorative financial graphics that obscure actual values.



\---



\# 42. ENTITY RENDERERS



Some results represent identifiable entities rather than raw data.



Examples:



\- person

\- company

\- location

\- product

\- organization

\- document



Entity renderers may present relevant structured metadata.



Do not turn every entity into a huge profile card.



Surface only information useful to the task.



\---



\# 43. SEARCH RESULTS



Search result rendering should preserve result identity and useful context.



Possible elements include:



\- title

\- source

\- snippet

\- metadata

\- type

\- action



Do not make every result visually equal if some information is clearly primary and some secondary.



Large result sets should remain scannable.



\---



\# 44. KNOWLEDGE RESULTS



Knowledge-oriented results may contain:



\- definitions

\- relationships

\- references

\- structured facts

\- linked entities



Choose a renderer according to the structure.



Do not turn all knowledge into cards automatically.



Paragraphs, lists, tables, graphs, and linked structures each serve different purposes.



\---



\# 45. MIND RENDERING



Mind may require specialized renderers for:



\- nodes

\- rooms

\- relationships

\- memory structures

\- knowledge clusters

\- retrieval results



The visual renderer should represent underlying knowledge structure rather than merely decorating notes.



Maintain a shared data model where practical so the same knowledge can appear as:



\- spatial graph

\- list

\- search result

\- Assistant context

\- detail panel



Do not bind stored knowledge permanently to one visual representation.



\---



\# 46. DIAGRAM RENDERERS



Diagrams should represent actual relationships.



Examples:



\- architecture

\- flow

\- hierarchy

\- dependencies

\- state transitions

\- mind maps



Do not create meaningless boxes and arrows merely to satisfy a request for a diagram.



Relationships should be backed by structured data or explicit source content.



\---



\# 47. DIAGRAM INTERACTION



Complex diagrams may support:



\- zoom

\- pan

\- selection

\- focus

\- expansion

\- search

\- filtering



Do not add interaction if the diagram is simple enough to understand statically.



Complex interaction should solve actual navigation or comprehension problems.



\---



\# 48. CHESS RENDERER



Chess results should use the established chess interface where a board materially improves understanding.



Possible uses include:



\- current position

\- move analysis

\- variation

\- checkmate sequence

\- interactive play



Do not describe a complex position only in prose when the board is the natural representation.



Text may explain analysis around the board.



\---



\# 49. ANATOMY AND 3D RENDERERS



Spatial or 3D results may require specialized interfaces.



Maintain clear:



\- orientation

\- labels

\- controls

\- selected structure

\- context



Do not create 3D solely because the subject is physical.



Use 3D when spatial understanding benefits materially.



Fallback 2D or structured representations may be appropriate.



\---



\# 50. LOADING RENDERERS



Renderer loading states should match expected structure where practical.



Examples:



table

→ row/header skeleton



file

→ file-row skeleton



card

→ card skeleton



map

→ restrained map loading state



Do not use one giant universal spinner for every structured result.



Avoid showing skeletons for extremely short operations if they create visual flashing.



\---



\# 51. ERROR RENDERING



Renderer errors should remain local when possible.



If the chart fails but the Assistant explanation is valid, preserve the explanation.



If the map fails, preserve useful location data when available.



Do not replace an entire response with:



`Something went wrong`



because one optional renderer failed.



Explain the affected result appropriately.



\---



\# 52. EMPTY RENDERING



Empty structured results should communicate that the query succeeded but returned nothing.



Distinguish:



```text id="995vgx"

empty result

```



from:



```text id="o8a4cy"

failed request

```



They are not the same state.



Do not show an error when no matching items were found.



\---



\# 53. STALE RESULTS



When freshness matters and the system knows data may be stale, communicate that appropriately.



Do not label everything with timestamps unnecessarily.



Use freshness information when it changes how the user should interpret the result.



Examples may include:



\- weather

\- market data

\- live availability

\- current location information



\---



\# 54. SOURCE ATTRIBUTION



When structured results originate from external sources and attribution is required or useful, present attribution without overwhelming the renderer.



Do not make source metadata visually louder than the information itself.



Source links should remain accessible.



Avoid duplicating the same attribution repeatedly inside every row when a shared source applies to the full renderer.



\---



\# 55. USER ACTIONS FROM RENDERERS



Some renderers may initiate further actions.



Examples:



calendar result

→ add event



file result

→ open file



map result

→ navigate



search result

→ open source



Mind result

→ open node



Actions should use standard Toolbox components.



Do not build custom action controls inside every renderer.



\---



\# 56. RENDERER EXPANSION



Dense or complex renderers may support expanded views.



Examples:



\- chart

\- image

\- map

\- table

\- diagram

\- file preview



Expanded mode should preserve context.



Do not rebuild an entirely unrelated interface after expansion.



The user should understand that they are viewing the same result in greater detail.



\---



\# 57. RENDERER RESPONSIVENESS



Every renderer must have intentional responsive behavior.



Do not assume the renderer's desktop dimensions will fit mobile.



Possible transformations include:



```text id="1it9bn"

side detail panel

→ bottom sheet



wide table

→ horizontal scroll / alternate representation



large chart legend

→ compact legend



map + sidebar

→ map + sheet



gallery grid

→ fewer columns

```



Preserve the core information and actions.



\---



\# 58. RENDERER ACCESSIBILITY



Structured renderers must follow Toolbox accessibility standards.



Consider:



\- keyboard navigation

\- accessible names

\- alternative representation

\- touch targets

\- focus states

\- screen-reader structure

\- color-independent meaning

\- reduced motion



Visual renderers should not make important information inaccessible to users who cannot interpret the visual representation directly.



\---



\# 59. RENDERER MOTION



Motion inside renderers should follow the Motion \& Interaction system.



Animation may communicate:



\- selection

\- filtering

\- expansion

\- transition

\- movement

\- changed values



Do not animate structured results merely to make them appear sophisticated.



Data should become usable quickly.



\---



\# 60. RENDERER PERFORMANCE



Structured renderers may process significant amounts of data.



Be conscious of:



\- DOM size

\- canvas cost

\- WebGL cost

\- rerenders

\- large datasets

\- image loading

\- layout measurement

\- animation

\- event listeners



Use appropriate optimization strategies when scale requires them.



Do not prematurely complicate small renderers.



Do not ignore obvious performance problems in large ones.



\---



\# 61. LAZY LOADING



Heavy renderers may load lazily when appropriate.



Examples may include:



\- 3D scenes

\- complex charts

\- large maps

\- file previews

\- heavy visualization libraries



Do not delay lightweight essential content unnecessarily.



The user should receive useful information as early as practical.



\---



\# 62. DEPENDENCY DISCIPLINE



Do not install a new renderer library simply because implementing one component manually would require thought.



Before adding a dependency:



1\. inspect existing renderer infrastructure

2\. inspect current visualization libraries

3\. determine whether the capability already exists

4\. evaluate bundle and maintenance cost

5\. evaluate accessibility

6\. evaluate mobile behavior



Prefer existing infrastructure when it adequately solves the problem.



\---



\# 63. PROVIDER-SPECIFIC UI



Avoid leaking provider-specific concepts into generic Toolbox UI unless those concepts matter to the user.



For example, a map renderer should not necessarily expose internal provider terminology.



Keep provider integration behind the renderer boundary where practical.



This makes providers replaceable without redesigning the interface.



\---



\# 64. RENDERER CONTRACTS



Renderer inputs should have clear contracts.



Validate required fields before rendering.



Do not assume external data perfectly matches expected shapes.



A renderer should know:



\- required fields

\- optional fields

\- supported interactions

\- fallback behavior



Unexpected data should fail predictably.



\---



\# 65. RENDERER VERSIONING



When renderer data contracts evolve, preserve compatibility where practical.



Avoid silently breaking existing stored results or messages.



If historical Assistant conversations may contain older renderer payloads, consider compatibility adapters.



Do not require every old conversation to magically conform to the newest schema.



\---



\# 66. DO NOT FABRICATE STRUCTURED DATA



Never fabricate values merely to populate a renderer.



If coordinates are unknown, do not invent coordinates.



If chart data is incomplete, do not invent data points.



If an image is unavailable, do not insert a random placeholder image representing something else.



If financial data lacks a period, do not infer one without basis.



Renderers must increase trust, not create prettier hallucinations.



\---



\# 67. DO NOT FAKE VISUALIZATION



A visual representation must correspond to actual underlying information.



Do not generate:



\- decorative charts with arbitrary values

\- fabricated map paths

\- fake progress

\- invented relationship graphs

\- random 3D geometry presented as factual structure



Fallback illustrations must be clearly generic and must not imply factual precision.



\---



\# 68. RESULT CONFIDENCE AND UNCERTAINTY



When structured data is uncertain, approximate, partial, or inferred, preserve that context.



Do not allow polished rendering to make uncertain data look authoritative.



Examples:



\- approximate location

\- estimated financial value

\- inferred category

\- incomplete route

\- partial dataset



Visual polish must not erase uncertainty.



\---



\# 69. RENDERER CONSISTENCY



Similar data should render similarly throughout Toolbox.



A file result in Assistant should feel related to Files.



An event result should feel related to Calendar.



A location result should feel related to Maps.



A Mind result should feel related to Mind.



Do not create separate mini design systems inside Assistant.



The Assistant should reuse the product.



\---



\# 70. EMBEDDED TOOL EXPERIENCES



When a renderer grows complex enough to behave like a full tool, consider whether the user should transition into the dedicated Toolbox tool.



For example:



compact map result

→ useful inside Assistant



complex route editing

→ open Maps workspace



compact chart

→ useful inside Assistant



advanced data manipulation

→ open relevant analysis tool



Do not cram full application workflows into tiny embedded renderers.



Use the renderer as an entry point when appropriate.



\---



\# 71. RENDERER VERIFICATION



Before considering a renderer complete, verify:



1\. the renderer matches the semantic data type

2\. structured data was not unnecessarily flattened

3\. existing Toolbox renderer infrastructure was reused

4\. raw provider data is normalized appropriately

5\. required fields are validated

6\. missing optional fields do not break the UI

7\. loading state works

8\. empty state works

9\. error state works

10\. partial data works

11\. long content works

12\. realistic data works

13\. large data behaves reasonably

14\. responsive behavior works

15\. touch interaction works

16\. keyboard interaction works where relevant

17\. accessibility is preserved

18\. motion is restrained and meaningful

19\. fallback rendering works

20\. text does not unnecessarily duplicate the renderer

21\. the renderer does not expose internal implementation details

22\. uncertain information is not visually overstated



Inspect the actual rendered result.



Do not consider renderer implementation complete merely because the component accepts props.



\---



\# 72. FINAL RENDERER STANDARD



Toolbox should present information in the form that makes the information easiest to understand and use.



Structured data should remain structured.



Visual data should be visual.



Spatial data should preserve spatial meaning.



Mathematics should look like mathematics.



Files should behave like files.



Calendars should behave like calendars.



Maps should behave like maps.



Charts should answer visual questions.



Text should explain what the renderer alone cannot.



When uncertain:



identify the semantic data type,

preserve structure,

reuse the appropriate renderer,

normalize before rendering,

provide a graceful fallback,

avoid duplication,

and never let visual polish imply certainty the data does not actually have.

