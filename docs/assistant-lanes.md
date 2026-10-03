# Assistant lanes

Every message takes the **lightest lane that can do the job** and moves up only when that lane falls
short. Before lanes, a thank-you and a twelve-step build both got the whole tool list, the full system
prompt and a thinking model: simple things were slow and the model stumbled on them.

| lane | what runs | tools | model order (gateway mode) | steps |
|---|---|---|---|---|
| **instant** | the browser, no model | – | – | 0 |
| **light** | small talk | none | smallest, fastest (`light`) | 1 |
| **quick** | plain questions, writing, explanations from knowledge | none | quick models (`quick`) | 1 |
| **focused** | one or two clear jobs for the tools | only the groups the message touches | fast models (`fast`) | 6, then the agent takes over |
| **agent** | open-ended work | core + groups (as before) | `auto` | mode's limit |
| **deep** | hard, long or multi-part work, or *Deep thinking* mode | core + groups | reasoning models (`reasoning`) | mode's limit |

## Where things live

| file | job |
|---|---|
| `js/lib/assistant/lanes.js` | the router (`routeTurn`), lane table, escalation order |
| `js/lib/assistant/instant.js`, `instant-units.js` | exact local answers: sums, percentages, VAT, unit conversion, date and time |
| `js/lib/assistant/lane-prompts.js` | the quick and lean (focused) prompts, the escalation gate |
| `js/lib/assistant/lane-log.js` | timing log of the last 80 turns on this device |
| `js/lib/ai-provider.js` | `streamChatCompletion` runs the turn through its lane and escalates |
| `server-assistant.js` | the `quick` gateway mode: model order, token cap, tools stripped |

## Routing

Routing is deterministic and free: it reads the message, the recent chat and any attachment. It never
calls a model. In order:

1. Deep thinking mode → **deep**.
2. Small talk → **light**. Something with one exact answer (`4,250 × 18`, `15% of ₦850,000`, `add VAT to 80,000`,
   `convert 5 miles to km`, `what time is it`) → **instant**. The instant lane only answers what it is certain of;
   a number that could lose precision, an unknown unit, or anything it does not recognise in full goes on.
3. Asked in words, answered in words (a question or writing task, no files, no "my notes", no live data, no
   group that must compute or look something up) → **quick**.
4. Attachments, builds and designs, several parts → **agent**; very hard or long → **deep**.
5. One or two tool groups → **focused**; a follow-up to tool work keeps the tools that made it.
6. The person's mode can raise the floor (*Build*, *Files* → agent) or cap the ceiling (*Fast* → focused).

Callers that bring their own tools or prompt (`scope` other than `global`, or `toolDeclarations`) always run as
**agent**, exactly as before.

## Escalation (lanes only move up)

* **quick → focused/agent**: the quick prompt has one way out. If answering well needs live data, the person's
  own things, a long calculation or an action, the model replies with exactly `[[ESCALATE]]`. The engine holds
  back the first few characters of a quick reply just long enough to see whether it is that word, so it never
  reaches the screen, and the message continues in the focused lane (if a tool group matched) or the agent.
  A compound or element in a plain question moves it to focused with the science tools instead.
* **focused → agent**: after six steps, two failed tool calls, or a call to `update_plan`.
* The same `turnId` and message are used throughout, so moving up lane is **one message** on the person's quota.

## Gateway (`quick` mode)

`quick` is honoured only for a short plain chat (≤ 18 messages, ≤ 40 KB, no images, no tool turns). The server
removes any tools, caps the reply (`max_tokens` 1,600), asks for minimal reasoning and uses `quickModels`
(Groq `gpt-oss-20b`, Gemini Flash-Lite, OpenAI `gpt-4.1-mini`; override with `ASSISTANT_<PROVIDER>_QUICK_MODEL`),
falling back to each provider's normal models. Anything else is demoted to `auto`, so the lane can never be a
cheap way to run real work. It counts as a normal message; no database change is needed.

## Measuring it

* In the browser console: `toolboxLanes()` gives time to first word and to finish per starting lane, and how
  often a message had to move up. `toolboxLanes('raw')` lists the turns.
* The assistant evaluation harness (`js/lib/assistant/eval`) records the lane of each case, supports
  `expect.lane` (a lane or a list of lanes), and reports `byLane` in the summary. The `lanes` category checks
  the routing and escalation against the live gateway.
* A message footer shows **Instant · computed on your device** for the instant lane; hover any other footer for
  the lane that answered.
