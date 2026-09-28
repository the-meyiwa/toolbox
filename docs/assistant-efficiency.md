# Assistant efficiency

Free model tiers are limited two ways: **requests per day** and **tokens per minute**. Gemini's free tier in particular allows few requests, and every tool step in a reply is a request that resends the whole conversation. The Assistant is built to spend as little of both as a job needs.

## What each request carries

| Part | How it is kept small |
|---|---|
| System prompt | A ~2.5 KB core, plus the guidance for the tool groups loaded for this conversation (`GROUP_PROMPTS` in `js/lib/ai-provider.js`). It used to send ~13 KB of rules for every tool on every step. |
| Tools | A core set (plan, load_tools, memory, browse, find/run/open Toolbox tools) plus the groups picked from **the person's own recent words** and the tools already used. The Assistant's own replies no longer pick groups (they mention everything). Descriptions are trimmed to ~480 characters, parameter descriptions to ~260. |
| History | 24 messages at most; the last 4 in full, older ones shortened. Attachments are re-read only for the last two user messages. |
| Earlier steps of one reply | Once a step is two steps old, long tool-call arguments (file contents it wrote) and long tool results are replaced by short notes (`compactEarlierSteps`). |
| Tool results | Capped at 12,000 characters; strings inside at 4,000. Built site HTML (`htmlBundle`), SVG drawings and 3D designs are shown to the person and never sent back to the model. |

## Fewer round trips

- **Websites and apps in one step.** `ide_create_project` takes every file (`files: [{path, content}]`), writes them, builds and returns the live preview in a single call. A small site is 2 requests (~40 KB) instead of 8 (~544 KB).
- **update_plan** only for long jobs (five or more steps), sent alongside the first real tool call, never again just to tick steps off.
- Independent tool calls in one step run in parallel.

## Server gateway

`server-assistant.js` hedges slow first tokens by starting a second model. A hedge bills the whole prompt again, so requests over 24 KB are not hedged (`HEDGE_MAX_BYTES`).

## Documents

- PDF pages are read in parallel batches of 8 (both for attachments and `read_document`).
- Extracted text is cached by content, so a document is read once per session, not once per message.
- `read_document` can page through long files (`offset`) and return only the passages that mention some words (`find`), with page numbers.

## Guard rails

`tests/unit/assistant-efficiency.test.js` fails if a greeting grows past 10 KB, a website build takes more than two requests or 60 KB, the core prompt grows past 3,200 characters, or tool schemas grow back.

## Robust tool calls

Models sometimes send the wrong types (`"name": 2024`, `"amount": "₦1,500"`, a single value for a list, `null`). `js/lib/assistant/args.js` coerces every call's arguments to the tool's declared schema before it runs, and answers a call missing a required argument with a clear message. `tests/unit/assistant-tool-fuzz.test.js` runs every Assistant tool with empty, wrongly typed, hostile and very long arguments and fails on raw JavaScript errors, `undefined`/`NaN`/`[object Object]` in messages, or hangs.
