# Assistant evaluation harness

Runs a suite of real prompts (`cases.js`, 134 cases) through the Assistant engine
(`streamChatCompletion` in `js/lib/ai-provider.js`), with no chat UI, and scores each reply:
which tools it called, with which arguments, whether the numbers are right, and timings.
It uses the live model gateway (`/api/assistant/v2/chat`), so run it on the production site
while you are signed in.

## Run it (browser console on the live site)

```js
const m = await toolboxEvalLoad();                       // lazy-loads this folder
const r = await m.run({ categories: ['math'] });          // or ids: ['math-vat', 'fin-loan']
console.table(m.table(r));                                // one row per case: PASS/FAIL, ms, tools, why
r.summary                                                 // totals, byCategory, avgMs, p90Ms, providers
copy(JSON.stringify(r, null, 1))                          // full JSON report to the clipboard
```

The last report is also kept in `window.__toolboxEvalLast`.
Opening the site with `?assistant-eval` in the URL also sets `window.toolboxEval = { run, cases }`.

Everything: `await m.run()` (134 cases, about 10–20 minutes at the default pace).
List what exists: `m.categories`, `m.cases.filter(c => c.category === 'chess')`.

### Options

| option | default | meaning |
|---|---|---|
| `ids` | all | case ids to run |
| `categories` | all | categories to run |
| `exclude` | none | ids or categories to skip (e.g. `['calendar', 'notes']` to avoid writes) |
| `concurrency` | 2 | cases in flight at once (keep low: provider rate limits) |
| `mode` | `'auto'` | Assistant mode (`auto`, `fast`, `reasoning`, `science`, `code`, `files`) |
| `timeoutMs` | 60000 | per case; the request is aborted and the case fails |
| `delayMs` | 1500 | pause between cases on each worker |
| `retries` | 1 | retries on network / 5xx / 429 errors (8 s back-off on 429) |
| `signal` | none | an `AbortSignal` to stop the run |
| `onProgress` | none | `({ done, total, result }) => {}` |
| `log` | true | one console line per case |

## What each result holds

`id, category, prompt, passed, reasons[], checks[], provider, model, ttftMs` (start → first token
or tool call), `totalMs, tools[] ({name, args, status, error}), toolErrors[], declined[], fixes[]`
(figures the engine corrected), `requests` (model round trips), `requestKB, toolsSent, attempts, text`.

## Case format (`cases.js`)

```js
{ id, category, prompt, history?, mode?, expect: {
  tools, anyTool, noTools, notTools, args: { tool: 'regex' }, minTools,
  textIncludes, textExcludes,          // regex strings, case-insensitive
  numbers: [187500, { value: 98.08, tol: 0.05 }],   // must appear in the text
  declined: ['send_space_message'],    // attempted and auto-declined
  maxMs } }
```

Numbers are read from the text tolerating `1,234.5`, `1 234`, LaTeX `1{,}234` and `8.8 million`.
`noTools` ignores `load_tools`. `update_memory` and `load_tools` are detected from the requests
the engine sends, since the engine handles them without the tool callbacks.

## Side effects while a run is active

- Confirmation dialogs (send message, delete, cancel event, move, rename, git push) are answered
  "Don't allow" automatically; the `safety` cases check the reply does not claim it happened.
- `open_toolbox_tool` and `chess_open_board` are stubbed (no navigation); the page hash is restored.
- The Assistant memory is restored to its state before the run.
- Notes and calendar events **are really created**; their titles contain `[eval]` so they are easy
  to find and delete. Skip them with `exclude: ['notes', 'calendar', 'multi-step']`.
- Web, device, chess, container and code tools really run (read-only).
