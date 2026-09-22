# Code Playground

An in-browser IDE for students building apps. Everything runs client-side; workspaces are
stored in IndexedDB (`toolbox-code-playground`) and autosaved as you type.

## Layout

| Path | What it is |
| --- | --- |
| `js/tools/code-playground.js` | Tool entry: landing page (templates, workspaces, import ZIP/folder/GitHub/Toolbox Files) and IDE mounting |
| `js/lib/playground/ide.js` | The IDE: explorer, tabs, editor, terminals, preview, problems, palette, menus |
| `js/lib/playground/shell.js`, `commands-*.js`, `git.js` | The terminal shell and its commands |
| `js/lib/playground/agent.js`, `ide-assistant.js` | The coding agent (Gemini function calling) and its panel |
| `public/playground/*-runtime.js` | Language workers (Node, Python/Pyodide, C/C++/JSCPP, SQLite/sql.js, Lua/wasmoon) |
| `public/pg-sw.js` | Service worker that gives workers synchronous `input()` / `cin` |
| `public/vendor/{codemirror,jscpp,typescript,prettier}` | Vendored editor, C++ interpreter, compiler and formatter |
| `css/code-playground.css` | All playground styles (own Dark/Light modes, `.cm-s-toolbox` editor theme) |

## Languages

- **JavaScript / TypeScript / JSX**: Node.js emulation in a worker: CommonJS + ESM, `fs`, `readline`, `http`,
  built-in `express`/`cors`/`dotenv`/`morgan`, npm packages from esm.sh, and a vitest/jest-compatible test runner.
- **Web**: live preview in a sandboxed iframe. Multi-file HTML/CSS/JS, React/Vue via esm.sh, a Vite-style compile-error overlay,
  and `fetch('/api/…')` routed to a Node/Express server running in the terminal.
- **Python**: Pyodide with interactive `input()`, `pip install` (micropip), and matplotlib figures shown in the terminal.
  `pytest` falls back to a built-in runner when it can't be installed.
- **C / C++**: `g++`/`gcc` check the program with real GCC on Wandbox when online, and `./a.out` runs it:
  - Programs that read input run in the JSCPP-NG interpreter, so `cin` works interactively.
  - Programs that use features JSCPP lacks (classes, templates, many STL algorithms) run on real GCC.
  - The engine can be forced from the status bar.
  - `public/vendor/jscpp/VERSION` records a local patch: `getline` no longer echoes its input.
- **SQL**: `sqlite3` with `.read`, `.tables`, `.schema`, `.mode`, `-csv`/`-json`/…; database files persist in the workspace.
- **Lua**: 5.4 via wasmoon.
- **Other languages** (Java, Go, Rust, PHP, Ruby, C#, …): compiled remotely on Wandbox.

## Terminal

The terminal is a POSIX-like shell with pipes, redirection, `&&`/`||`, globbing, env vars, aliases, history and tab completion.
Type `help` for the full list. It includes:

- File and text tools: `ls`, `cd`, `cp`, `mv`, `rm`, `find`, `grep` (BRE/ERE), `sed`, `sort`, `uniq`, `wc`, `diff`, `zip`/`unzip`, and more.
- Language and build tools: `node`, `npm`, `npx`, `vite`, `vitest`, `tsc`, `prettier`, `python`, `pip`, `pytest`, `g++`, `make`, `sqlite3`, `lua`.
- Networking: `curl` (localhost reaches your server) and `wget`.
- Git: `git`, with GitHub push, clone and pull.

## Coding agent

Signed-in users get an agent (Agent / Ask modes) that can:

- plan its work;
- list, read, write, edit, move and delete files;
- search code;
- run terminal commands;
- read Problems;
- open the preview and click or type in it.

Every change is checkpointed, so you can review diffs, revert a single file, or undo all of a request's changes.
Requests go to `/api/assistant/agent` (server key, Supabase-authenticated), or straight to Gemini with the user's own key.

## Testing

- Unit tests: `node --test tests/unit/playground-*.test.js tests/unit/code-playground-ide.test.js`.
- Browser harness: run `node tests/browser/playground-server.mjs 4173`, then open
  `http://127.0.0.1:4173/tests/browser/playground.html`.
  - Optional environment variables `PG_PYODIDE_DIR` and `PG_SQLJS_DIR` serve local runtime copies,
    which the page uses when you add `?cdn=pyodide=/cdn/pyodide/&cdn=sqljs=/cdn/sqljs/`.
  - `POST /__mock/agent` queues scripted Gemini responses for testing the agent offline.
