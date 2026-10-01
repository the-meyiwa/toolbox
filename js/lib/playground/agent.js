/* ============================================================
   Code Playground agent.

   An autonomous coding agent scoped to the workspace, in the spirit of
   agent-first IDEs: it plans the work as a visible task list, reads and
   edits files, runs commands and tests in its own terminal, opens the
   app in the preview and interacts with it like a user, reads the
   errors it causes and fixes them, then reports what changed. Every
   request starts from a checkpoint, so all of its edits can be reviewed
   file by file and undone in one click.

   Model access: the student's own Gemini key when one is saved in
   Toolbox Preferences; otherwise, or as soon as that key runs out of
   quota or stops responding, the Toolbox server's multi-provider
   gateway (Gemini, OpenRouter, Groq, OpenAI, DeepSeek), which fails
   over between whichever providers the deployment has keys for.
   ============================================================ */

import { unifiedDiff } from './commands-core.js';
import { normalize, basename } from './paths.js';
import { isBinaryPath } from './languages.js';

const KEY_NAMES = ['toolbox_assistant_api_key', 'gemini_api_key', 'toolbox_gemini_api_key'];
const MODELS = ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];
const MAX_STEPS = 40;
const MAX_TOOL_OUTPUT = 12000;

export function userApiKey() {
  try {
    for (const k of KEY_NAMES) { const v = localStorage.getItem(k); if (v && v.trim()) return v.trim(); }
  } catch { /* ignore */ }
  return '';
}

/* ---------------- tool schema ---------------- */

const S = (type, description, extra = {}) => ({ type, description, ...extra });

export const TOOL_DECLARATIONS = [
  {
    name: 'update_plan',
    description: 'Create or update the visible task list for this request. Call it at the start of multi-step work and whenever a step starts or finishes.',
    parameters: { type: 'object', properties: { steps: S('array', 'All steps, in order.', { items: { type: 'object', properties: { title: S('string', 'Short imperative description'), status: S('string', 'pending | in_progress | done', { enum: ['pending', 'in_progress', 'done'] }) }, required: ['title', 'status'] } }), note: S('string', 'Optional one-line context') }, required: ['steps'] },
  },
  {
    name: 'list_files',
    description: 'List files and folders in the workspace (recursively), with sizes. node_modules and .git are skipped.',
    parameters: { type: 'object', properties: { path: S('string', 'Folder to list, relative to the workspace root. Defaults to the root.') } },
  },
  {
    name: 'read_file',
    description: 'Read a text file. Lines are prefixed with line numbers ("12| code") for reference only; never include those prefixes when editing.',
    parameters: { type: 'object', properties: { path: S('string', 'File path relative to the workspace root'), start_line: S('integer', '1-based first line (optional)'), end_line: S('integer', '1-based last line (optional)') }, required: ['path'] },
  },
  {
    name: 'write_file',
    description: 'Create a file or replace its entire contents. Parent folders are created automatically. Prefer edit_file for small changes to existing files.',
    parameters: { type: 'object', properties: { path: S('string', 'File path relative to the workspace root'), content: S('string', 'Complete new file contents') }, required: ['path', 'content'] },
  },
  {
    name: 'edit_file',
    description: 'Make targeted edits by exact text replacement. Each "find" must match the current file exactly (including indentation) and be unique unless replace_all is true. Include enough surrounding lines to be unique.',
    parameters: { type: 'object', properties: { path: S('string', 'File path'), edits: S('array', 'Edits applied in order', { items: { type: 'object', properties: { find: S('string', 'Exact existing text'), replace: S('string', 'Replacement text'), replace_all: S('boolean', 'Replace every occurrence') }, required: ['find', 'replace'] } }) }, required: ['path', 'edits'] },
  },
  {
    name: 'delete_path',
    description: 'Delete a file or folder (recursively).',
    parameters: { type: 'object', properties: { path: S('string', 'Path to delete') }, required: ['path'] },
  },
  {
    name: 'move_path',
    description: 'Rename or move a file or folder.',
    parameters: { type: 'object', properties: { from: S('string', 'Existing path'), to: S('string', 'New path') }, required: ['from', 'to'] },
  },
  {
    name: 'search_code',
    description: 'Search file contents in the workspace with a regular expression (case-insensitive by default). Returns matching lines as path:line: text.',
    parameters: { type: 'object', properties: { query: S('string', 'Regular expression or plain text'), path: S('string', 'Folder or file to search (optional)'), case_sensitive: S('boolean', 'Match case') }, required: ['query'] },
  },
  {
    name: 'run_command',
    description: 'Run a shell command in the workspace terminal (visible to the user) and return its output and exit code. Supports node, npm (install/run/test), npx, python, pip, pytest, g++/gcc and ./program, java, go, sqlite3, lua, git, curl, ls, cat, grep and more. Programs that read input receive the given stdin, then end-of-input. Long-running servers keep running in the background after `timeout_seconds`.',
    parameters: { type: 'object', properties: { command: S('string', 'The command line, e.g. "npm test" or "python main.py"'), stdin: S('string', 'Text fed to the program as standard input (lines separated by \\n)'), timeout_seconds: S('integer', 'Stop waiting after this many seconds (default 60, max 300)') }, required: ['command'] },
  },
  {
    name: 'get_problems',
    description: 'Get current errors and warnings: TypeScript/JavaScript type & syntax errors, errors from the last runs, and browser errors from the preview.',
    parameters: { type: 'object', properties: { path: S('string', 'Only this file (optional)') } },
  },
  {
    name: 'open_preview',
    description: 'Open a web page in the preview (an .html file, or a running server via port) and return what a user would see: page title, visible text, console messages and errors. Use this to verify web apps.',
    parameters: { type: 'object', properties: { path: S('string', 'HTML file or site path, e.g. "index.html" or "/about.html"'), port: S('integer', 'Port of a running Node/Express server, e.g. 3000'), wait_ms: S('integer', 'How long to let scripts run before capturing (default 1200)') } },
  },
  {
    name: 'interact_with_preview',
    description: 'Interact with the page currently shown in the preview like a user, then return the updated page text and console output. Actions run in order.',
    parameters: { type: 'object', properties: { actions: S('array', 'Actions', { items: { type: 'object', properties: { action: S('string', 'click | type | press | wait', { enum: ['click', 'type', 'press', 'wait'] }), selector: S('string', 'CSS selector, or text:Visible Text to find by label/text'), text: S('string', 'Text to type (for type) or key name (for press, e.g. Enter)'), ms: S('integer', 'Milliseconds (for wait)') }, required: ['action'] } }) }, required: ['actions'] },
  },
];

const READ_ONLY_TOOLS = new Set(['update_plan', 'list_files', 'read_file', 'search_code', 'get_problems', 'open_preview']);

/* ---------------- model access ---------------- */

// How long one model gets to answer a step before it counts as stopped.
const STEP_TIMEOUT_MS = 120_000;
// After the student's own Gemini key runs out, go straight to the gateway for a while.
const KEY_COOLDOWN_MS = 10 * 60_000;
let keyCooldownUntil = 0;

/** A failure that another model could get past (quota, rate limit, outage, silence). */
function isSwitchable(status, message) {
  return status === 408 || status === 429 || status >= 500 || status === 0 ||
    /quota|rate.?limit|resource.?exhausted|too many requests|overloaded|unavailable|timed? ?out|deadline|billing|exceeded|stopped responding/i.test(message || '');
}

/** The caller's signal plus a per-step timeout; `timedOut()` tells the two apart. */
function stepSignal(signal) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, STEP_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (signal) { if (signal.aborted) controller.abort(); else signal.addEventListener('abort', onAbort, { once: true }); }
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    done: () => { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); },
  };
}

const aborted = () => Object.assign(new Error('Stopped'), { name: 'AbortError' });

/** Gemini directly, with the student's own key. Tries each Gemini model before giving up. */
async function generateWithGemini({ key, system, contents, tools, signal }) {
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    tools: tools.length ? [{ functionDeclarations: tools }] : undefined,
    toolConfig: tools.length ? { functionCallingConfig: { mode: 'AUTO' } } : undefined,
    generationConfig: { temperature: 0.2, maxOutputTokens: 16384 },
  };
  let lastErr = null;
  for (const model of MODELS) {
    const step = stepSignal(signal);
    let res, data;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: step.signal,
      });
      data = await res.json().catch(() => ({}));
    } catch (err) {
      if (signal?.aborted) throw aborted();
      lastErr = Object.assign(new Error(step.timedOut() ? `${model} stopped responding` : 'Could not reach Gemini'), { status: 0 });
      continue;
    } finally {
      step.done();
    }
    if (res.ok && data.candidates) return { data, model };
    const message = data.error?.message || data.error || `HTTP ${res.status}`;
    lastErr = new Error(typeof message === 'string' ? message : JSON.stringify(message));
    lastErr.status = res.status;
    // Another Gemini model may still have quota or exist; anything else (a bad request) will fail everywhere.
    if (!(res.status === 404 || /not found|not supported|unknown model|is not available/i.test(lastErr.message) || isSwitchable(res.status, lastErr.message))) break;
  }
  throw lastErr || new Error('Gemini returned no answer.');
}

/* Gemini-format history ⇄ OpenAI chat format, for the multi-provider gateway. */

export function toChatMessages(system, contents) {
  const messages = [{ role: 'system', content: system }];
  let ids = [];
  contents.forEach((c, i) => {
    const parts = c.parts || [];
    if (c.role === 'model') {
      const text = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join('');
      const calls = parts.filter((p) => p.functionCall);
      ids = calls.map((_, k) => `call_${i}_${k}`);
      const msg = { role: 'assistant', content: text || null };
      if (calls.length) {
        msg.tool_calls = calls.map((p, k) => {
          const extra = p.extraContent || (p.thoughtSignature ? { google: { thought_signature: p.thoughtSignature } } : null);
          return { id: ids[k], type: 'function', function: { name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args || {}) }, ...(extra ? { extra_content: extra } : {}) };
        });
      }
      if (msg.content || msg.tool_calls) messages.push(msg);
      return;
    }
    parts.filter((p) => p.functionResponse).forEach((p, k) => {
      messages.push({ role: 'tool', tool_call_id: ids[k] || `call_${i}_${k}`, content: JSON.stringify(p.functionResponse.response ?? {}) });
    });
    const text = parts.filter((p) => p.text).map((p) => p.text).join('\n');
    if (text) messages.push({ role: 'user', content: text });
  });
  return messages;
}

export function fromChatTurn(turn) {
  const parts = [];
  if (turn.text) parts.push({ text: turn.text });
  for (const call of turn.toolCalls || []) {
    let args = {};
    try { args = JSON.parse(call.function.arguments || '{}'); } catch {
      const m = String(call.function.arguments || '').match(/\{[\s\S]*\}/);
      try { args = m ? JSON.parse(m[0]) : {}; } catch { args = {}; }
    }
    parts.push({ functionCall: { name: call.function.name, args }, ...(call.extra_content ? { extraContent: call.extra_content } : {}) });
  }
  return { candidates: [{ content: { role: 'model', parts }, finishReason: turn.finish || undefined }] };
}

/**
 * The Toolbox server's gateway: whichever configured provider (Gemini, OpenRouter,
 * Groq, OpenAI, DeepSeek) answers, failing over when one is out of quota or silent.
 * A step that breaks mid-answer is retried; the server skips the model that failed.
 */
async function generateWithGateway({ system, contents, tools, signal, turnId }) {
  const { gatewayTurn } = await import('../model-gateway.js');
  const messages = toChatMessages(system, contents);
  const chatTools = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const step = stepSignal(signal);
    try {
      const turn = await gatewayTurn({ messages, tools: chatTools.length ? chatTools : undefined, mode: 'code', turnId, signal: step.signal });
      if (step.timedOut()) throw Object.assign(new Error('The model stopped responding'), { status: 0 });
      const who = turn.provider || {};
      return { data: fromChatTurn(turn), model: who.label ? `${who.label}${who.model ? ` · ${who.model}` : ''}` : 'Toolbox models' };
    } catch (err) {
      if (signal?.aborted) throw aborted();
      lastErr = step.timedOut() ? Object.assign(new Error('The model stopped responding'), { status: 0 }) : err;
      // The server already tried every provider it has; asking again at once will not help.
      if (!isSwitchable(lastErr.status ?? 0, lastErr.message) || /no model provider could answer/i.test(lastErr.message)) break;
    } finally {
      step.done();
    }
  }
  if (lastErr?.status === 401) lastErr.message = 'Sign in to Toolbox to use the agent, or add a Gemini API key in Toolbox → Preferences → Assistant.';
  if (lastErr?.status === 503 && /no .*provider is configured/i.test(lastErr.message)) {
    lastErr.message = 'No AI provider is connected. Add a Gemini API key in Toolbox → Preferences → Assistant to use the agent.';
  }
  throw lastErr || new Error('The AI service returned no answer.');
}

/**
 * One agent step. Uses the student's own Gemini key when there is one; when it runs out
 * or stops responding, switches to the server's gateway and stays there for the run.
 * `run` carries per-run state: { useGateway, onSwitch(from, reason) }.
 */
export async function generate({ system, contents, tools, signal, run }) {
  const key = userApiKey();
  if (key && !run.useGateway && Date.now() >= keyCooldownUntil) {
    try {
      return await generateWithGemini({ key, system, contents, tools, signal });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      if (!isSwitchable(err.status ?? 0, err.message)) throw err;
      if (err.status === 429 || /quota|exhausted|exceeded|billing/i.test(err.message)) keyCooldownUntil = Date.now() + KEY_COOLDOWN_MS;
      run.useGateway = true;
      run.onSwitch?.('Gemini', err.message);
    }
  }
  run.assistantQuotaTurnId ||= `turn_code_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return generateWithGateway({ system, contents, tools, signal, turnId: run.assistantQuotaTurnId });
}

/* ---------------- the agent ---------------- */

export class PlaygroundAgent {
  /**
   * @param {object} o
   * @param {import('./vfs.js').WorkspaceFS} o.vfs
   * @param {object} o.ide  integration: runCommand, problems, preview, previewInteract, context, token, openFile
   * @param {(e:object)=>void} o.onEvent
   */
  constructor({ vfs, ide, onEvent }) {
    this.vfs = vfs;
    this.ide = ide;
    this.onEvent = onEvent;
    this.contents = [];
    this.controller = null;
    this.checkpoints = [];
    this.running = false;
  }

  reset() {
    this.contents = [];
    this.checkpoints = [];
  }

  stop() { this.controller?.abort(); }

  systemPrompt(mode) {
    return `You are the coding agent inside Toolbox Code Playground, a browser-based IDE used by students to build and run apps. You work directly in the student's workspace through tools. You are scoped to this workspace and to programming help; politely decline unrelated requests.

ENVIRONMENT
- Everything runs in the browser. The workspace root is /workspace. Paths you pass to tools are relative to it (e.g. "src/App.jsx").
- Terminal commands: node, npm init/install/run/test/start, npx vitest|tsc|create-vite, vite (dev server → Preview), python, pip, pytest, g++/gcc + ./program, make, java, go run, rustc, php, ruby, sqlite3, lua, bash scripts, git, curl, ls, cat, grep, find, mkdir, rm, mv, cp, sed.
- Node.js programs have fs, path, readline, events, http, crypto, and a built-in Express-compatible "express" (plus cors, dotenv, morgan, body-parser). app.listen(PORT) starts a virtual server; use open_preview with that port or "curl localhost:PORT/path" to test it. Other npm packages load from esm.sh after "npm install <pkg>" (pure-JS packages work; native modules don't).
- Web apps (index.html + CSS/JS, or React/Vue with ES modules and JSX/TSX) run in the Preview; bare imports like 'react' resolve automatically. No build step is required.
- Python is CPython 3 (Pyodide): pure-Python packages via pip; numpy/pandas/matplotlib are available. input() works.
- C/C++: an in-browser interpreter for simple programs, real g++ 13 (remote) for full C++; run with "g++ main.cpp -o main && ./main".
- Tests: "npm test"/"npx vitest run" (describe/it/test/expect, vi.fn), "pytest", "node --test".

HOW TO WORK
1. For anything beyond a one-line change, call update_plan first with concrete steps, and keep it updated.
2. Inspect before editing: list_files, read_file, search_code. Follow the project's existing structure and style.
3. Edit with edit_file (exact find/replace) or write_file for new files. Never leave placeholders like "// ... rest of code".
4. Verify your work: run the program or the tests with run_command, and for web apps use open_preview / interact_with_preview. Read errors, fix them, and re-run until it works. Use get_problems to see type errors.
5. Finish with a short summary for the student: what you changed (files), how to run it, and anything they should know. Keep explanations beginner-friendly but precise.
${mode === 'ask' ? '\nMODE: ASK — you may only read and inspect (list/read/search/problems/preview). Do not modify files or run commands; explain and suggest code in your answer instead.' : '\nMODE: AGENT — you may edit files and run commands. Be decisive; do the work rather than describing it.'}

RULES
- Keep changes focused on the request. Don't delete or rewrite unrelated code.
- Don't run commands that wait for keyboard input without providing stdin.
- If a tool fails, read the error and adapt; don't repeat the same failing call.
- Never claim something works unless you ran or previewed it.`;
  }

  contextBlock() {
    const c = this.ide.context?.() || {};
    const tree = listTree(this.vfs, '', 200);
    let text = `Workspace "${c.workspaceName || 'workspace'}" files:\n${tree}`;
    if (c.activeFile) text += `\n\nActive file: ${c.activeFile}${c.cursorLine ? ` (cursor at line ${c.cursorLine})` : ''}`;
    if (c.selection) text += `\nSelected text:\n\`\`\`\n${c.selection.slice(0, 4000)}\n\`\`\``;
    if (c.openFiles?.length) text += `\nOpen tabs: ${c.openFiles.join(', ')}`;
    if (c.problems?.length) text += `\nCurrent problems:\n${c.problems.slice(0, 20).map((p) => `- ${p.file}:${p.line}: ${p.message}`).join('\n')}`;
    if (c.terminal) text += `\nRecent terminal output:\n\`\`\`\n${c.terminal.slice(-2500)}\n\`\`\``;
    return text;
  }

  /**
   * Run one user request to completion.
   * @param {string} prompt
   * @param {{mode?:'agent'|'ask', attachments?:string}} opts
   */
  async send(prompt, { mode = 'agent' } = {}) {
    if (this.running) throw new Error('The agent is already working. Stop it first.');
    this.running = true;
    this.controller = new AbortController();
    const signal = this.controller.signal;
    const checkpoint = { id: `cp-${Date.now()}`, prompt, snapshot: null, touched: new Set(), started: Date.now() };
    this.checkpoints.push(checkpoint);
    this.currentCheckpoint = checkpoint;
    const tools = mode === 'ask' ? TOOL_DECLARATIONS.filter((t) => READ_ONLY_TOOLS.has(t.name)) : TOOL_DECLARATIONS;
    this.contents.push({ role: 'user', parts: [{ text: `${this.contextBlock()}\n\n---\nRequest: ${prompt}` }] });
    this.onEvent({ type: 'start', checkpoint: checkpoint.id });
    let steps = 0;
    const run = {
      useGateway: false,
      model: null,
      onSwitch: (from, reason) => this.onEvent({ type: 'model-switch', from, reason: String(reason || '').slice(0, 160) }),
    };
    try {
      while (steps++ < MAX_STEPS) {
        if (signal.aborted) throw Object.assign(new Error('Stopped'), { name: 'AbortError' });
        this.onEvent({ type: 'thinking', step: steps });
        const { data, model } = await generate({ system: this.systemPrompt(mode), contents: this.trimmedContents(), tools, signal, run });
        if (model && model !== run.model) { run.model = model; this.onEvent({ type: 'model', model }); }
        const cand = data.candidates?.[0];
        const content = cand?.content || { role: 'model', parts: [] };
        if (!content.parts?.length) {
          const reason = cand?.finishReason || data.promptFeedback?.blockReason || 'empty response';
          this.onEvent({ type: 'text', text: `_(The model returned no content: ${reason}.)_` });
          break;
        }
        content.role = 'model';
        this.contents.push(content);
        const calls = [];
        for (const part of content.parts) {
          if (part.text && !part.thought) this.onEvent({ type: 'text', text: part.text });
          if (part.functionCall) calls.push(part.functionCall);
        }
        if (!calls.length) break;
        const responses = [];
        for (const call of calls) {
          if (signal.aborted) break;
          const id = `t-${Math.random().toString(36).slice(2)}`;
          this.onEvent({ type: 'tool-start', id, name: call.name, args: call.args || {} });
          let result;
          try {
            if (mode === 'ask' && !READ_ONLY_TOOLS.has(call.name)) throw new Error('This tool is not available in Ask mode.');
            result = await this.execute(call.name, call.args || {}, checkpoint, signal);
          } catch (err) {
            if (err.name === 'AbortError') throw err;
            result = { error: err.message || String(err) };
          }
          this.onEvent({ type: 'tool-result', id, name: call.name, args: call.args || {}, result });
          responses.push({ functionResponse: { name: call.name, response: truncateResult(result) } });
        }
        this.contents.push({ role: 'user', parts: responses });
      }
      if (steps > MAX_STEPS) this.onEvent({ type: 'text', text: '_Stopped after reaching the step limit. Ask me to continue if there is more to do._' });
      this.onEvent({ type: 'done', checkpoint: checkpoint.id, changed: [...checkpoint.touched] });
    } catch (err) {
      if (err.name === 'AbortError') this.onEvent({ type: 'stopped', checkpoint: checkpoint.id, changed: [...checkpoint.touched] });
      else this.onEvent({ type: 'error', message: err.message || String(err), checkpoint: checkpoint.id, changed: [...checkpoint.touched] });
      // Keep the conversation valid: a dangling function call without a response breaks the next request.
      const last = this.contents[this.contents.length - 1];
      if (last?.role === 'model' && last.parts?.some((p) => p.functionCall)) this.contents.pop();
    } finally {
      this.running = false;
      this.controller = null;
    }
  }

  trimmedContents() {
    // Keep requests bounded: compress old tool outputs once the history grows.
    const MAX_CHARS = 350000;
    let size = JSON.stringify(this.contents).length;
    if (size <= MAX_CHARS) return this.contents;
    const copy = this.contents.map((c) => ({ ...c, parts: c.parts.map((p) => ({ ...p })) }));
    for (let i = 0; i < copy.length - 6 && size > MAX_CHARS; i++) {
      for (const p of copy[i].parts) {
        if (p.functionResponse) {
          const before = JSON.stringify(p.functionResponse.response).length;
          p.functionResponse = { name: p.functionResponse.name, response: { note: 'output omitted to save space' } };
          size -= before;
        }
      }
    }
    return copy;
  }

  ensureSnapshot(cp) {
    if (!cp.snapshot) cp.snapshot = this.vfs.snapshot();
  }

  async execute(name, args, cp, signal) {
    const vfs = this.vfs;
    const P = (p) => normalize(String(p || '').replace(/^\/?workspace\//, ''));
    switch (name) {
      case 'update_plan': {
        this.onEvent({ type: 'plan', steps: args.steps || [], note: args.note || '' });
        return { ok: true };
      }
      case 'list_files': {
        const root = P(args.path);
        if (root && !vfs.isDir(root)) return { error: `${root} is not a folder` };
        return { files: listTree(vfs, root, 600) };
      }
      case 'read_file': {
        const p = P(args.path);
        if (!vfs.isFile(p)) return { error: vfs.isDir(p) ? `${p} is a folder` : `File not found: ${p}` };
        if (isBinaryPath(p)) return { error: `${p} is a binary file (${vfs.stat(p).size} bytes)` };
        const lines = vfs.readFile(p).split('\n');
        const start = Math.max(1, Number(args.start_line) || 1);
        const end = Math.min(lines.length, Number(args.end_line) || Math.min(lines.length, start + 599));
        const body = lines.slice(start - 1, end).map((l, i) => `${start + i}| ${l}`).join('\n');
        return { path: p, total_lines: lines.length, start_line: start, end_line: end, content: body, ...(end < lines.length ? { note: `Showing lines ${start}-${end} of ${lines.length}. Use start_line/end_line to read more.` } : {}) };
      }
      case 'write_file': {
        const p = P(args.path);
        if (!p) return { error: 'path is required' };
        if (vfs.isDir(p)) return { error: `${p} is a folder` };
        this.ensureSnapshot(cp);
        const before = vfs.isFile(p) ? vfs.readFile(p) : null;
        const content = String(args.content ?? '');
        vfs.writeFile(p, content);
        cp.touched.add(p);
        this.ide.fileTouched?.(p);
        return { ok: true, path: p, created: before === null, ...lineStats(before || '', content) };
      }
      case 'edit_file': {
        const p = P(args.path);
        if (!vfs.isFile(p)) return { error: `File not found: ${p}. Use write_file to create it.` };
        let text = vfs.readFile(p);
        const original = text;
        const edits = Array.isArray(args.edits) ? args.edits : [];
        if (!edits.length) return { error: 'edits must be a non-empty array' };
        for (const [i, e] of edits.entries()) {
          const find = String(e.find ?? '');
          const replace = String(e.replace ?? '');
          if (!find) return { error: `edit ${i + 1}: "find" is empty` };
          let count = text.split(find).length - 1;
          let useFind = find;
          if (count === 0) {
            // Tolerate whitespace differences at line ends / CRLF.
            const loose = findLoosely(text, find);
            if (loose) { useFind = loose; count = text.split(loose).length - 1; }
          }
          if (count === 0) return { error: `edit ${i + 1}: the text to find was not found in ${p}. Re-read the file and copy the exact text.`, hint: nearestLines(text, find) };
          if (count > 1 && !e.replace_all) return { error: `edit ${i + 1}: the text to find occurs ${count} times in ${p}; include more surrounding lines or set replace_all.` };
          text = e.replace_all ? text.split(useFind).join(replace) : text.replace(useFind, () => replace);
        }
        this.ensureSnapshot(cp);
        vfs.writeFile(p, text);
        cp.touched.add(p);
        this.ide.fileTouched?.(p);
        return { ok: true, path: p, ...lineStats(original, text) };
      }
      case 'delete_path': {
        const p = P(args.path);
        if (!p) return { error: 'Refusing to delete the workspace root.' };
        if (!vfs.exists(p)) return { error: `Not found: ${p}` };
        this.ensureSnapshot(cp);
        const files = vfs.isFile(p) ? [p] : vfs.listFiles(p);
        vfs.rm(p, { recursive: true });
        files.forEach((f) => cp.touched.add(f));
        return { ok: true, deleted: files.length };
      }
      case 'move_path': {
        const from = P(args.from);
        const to = P(args.to);
        if (!vfs.exists(from)) return { error: `Not found: ${from}` };
        this.ensureSnapshot(cp);
        const files = vfs.isFile(from) ? [from] : vfs.listFiles(from);
        vfs.rename(from, to, { overwrite: true });
        files.forEach((f) => { cp.touched.add(f); cp.touched.add(to + f.slice(from.length)); });
        return { ok: true, from, to };
      }
      case 'search_code': {
        const root = P(args.path);
        let re;
        try { re = new RegExp(String(args.query || ''), args.case_sensitive ? '' : 'i'); } catch { re = new RegExp(String(args.query || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), args.case_sensitive ? '' : 'i'); }
        const hits = [];
        const files = vfs.isFile(root) ? [root] : vfs.listFiles(root);
        for (const f of files) {
          if (/(^|\/)(node_modules|\.git|dist)\//.test(f) || isBinaryPath(f)) continue;
          const lines = vfs.readFile(f).split('\n');
          lines.forEach((l, i) => { if (hits.length < 150 && re.test(l)) hits.push(`${f}:${i + 1}: ${l.trim().slice(0, 200)}`); });
        }
        return { matches: hits.length, results: hits.join('\n') || '(no matches)' };
      }
      case 'run_command': {
        const cmd = String(args.command || '').trim();
        if (!cmd) return { error: 'command is required' };
        this.ensureSnapshot(cp);
        const before = vfs.version;
        const res = await this.ide.runCommand(cmd, { stdin: args.stdin, timeout: Math.min(300, Math.max(5, Number(args.timeout_seconds) || 60)) * 1000, signal });
        if (vfs.version !== before) for (const f of res.changedFiles || []) cp.touched.add(f);
        return res;
      }
      case 'get_problems': {
        const list = (await this.ide.problems?.(args.path ? P(args.path) : null)) || [];
        return { count: list.length, problems: list.slice(0, 80).map((d) => `${d.file}:${d.line}:${d.column || 1} ${d.severity || 'error'}: ${d.message}`).join('\n') || 'No problems detected.' };
      }
      case 'open_preview': {
        return this.ide.preview({ path: args.path ? P(args.path) : null, port: args.port ? Number(args.port) : null, wait: Math.min(8000, Number(args.wait_ms) || 1200) });
      }
      case 'interact_with_preview': {
        return this.ide.previewInteract(Array.isArray(args.actions) ? args.actions : []);
      }
      default:
        return { error: `Unknown tool ${name}` };
    }
  }

  /** Files changed by a request with before/after content. */
  changesFor(checkpointId) {
    const cp = this.checkpoints.find((c) => c.id === checkpointId);
    if (!cp || !cp.snapshot) return [];
    const out = [];
    for (const p of [...cp.touched].sort()) {
      const before = cp.snapshot.files[p];
      const after = this.vfs.isFile(p) ? this.vfs.readRaw(p) : undefined;
      if (before === after) continue;
      const b = typeof before === 'string' ? before : before === undefined ? '' : '(binary)';
      const a = typeof after === 'string' ? after : after === undefined ? '' : '(binary)';
      out.push({ path: p, status: before === undefined ? 'added' : after === undefined ? 'deleted' : 'modified', diff: unifiedDiff(b, a, before === undefined ? '/dev/null' : `a/${p}`, after === undefined ? '/dev/null' : `b/${p}`), ...lineStats(b, a) });
    }
    return out;
  }

  /** Put one file (or every file) back the way it was before a request. */
  revert(checkpointId, path = null) {
    const cp = this.checkpoints.find((c) => c.id === checkpointId);
    if (!cp || !cp.snapshot) return 0;
    const targets = path ? [path] : [...cp.touched];
    let n = 0;
    for (const p of targets) {
      const before = cp.snapshot.files[p];
      if (before === undefined) { if (this.vfs.exists(p)) { this.vfs.rm(p, { recursive: true, force: true }); n++; } }
      else { this.vfs.writeFile(p, before); n++; }
      if (!path) cp.touched.delete(p);
    }
    if (path) cp.touched.delete(path);
    return n;
  }
}

/* ---------------- helpers ---------------- */

function listTree(vfs, root, limit) {
  const files = vfs.listFiles(root).filter((f) => !/(^|\/)(node_modules|\.git)\//.test(f));
  const lines = files.slice(0, limit).map((f) => {
    const st = vfs.stat(f);
    return `${f}${st.binary ? ` (binary, ${st.size} B)` : ` (${countLines(vfs, f)} lines)`}`;
  });
  const emptyDirs = vfs.listDirs().filter((d) => (!root || d.startsWith(`${root}/`)) && !files.some((f) => f.startsWith(`${d}/`)));
  for (const d of emptyDirs) lines.push(`${d}/ (empty folder)`);
  if (files.length > limit) lines.push(`… ${files.length - limit} more files`);
  return lines.join('\n') || '(empty workspace)';
}

function countLines(vfs, f) {
  try { return vfs.readFile(f).split('\n').length; } catch { return 0; }
}

export function lineStats(before, after) {
  const a = String(before).split('\n');
  const b = String(after).split('\n');
  const setA = new Map();
  for (const l of a) setA.set(l, (setA.get(l) || 0) + 1);
  let common = 0;
  for (const l of b) { const n = setA.get(l); if (n) { common++; setA.set(l, n - 1); } }
  return { added: b.length - common - (before === '' ? 0 : 0), removed: before === '' ? 0 : a.length - common };
}

function findLoosely(text, find) {
  const norm = (s) => s.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '');
  const t = norm(text);
  const f = norm(find);
  if (t.includes(f) && text === t) return f;
  return null;
}

function nearestLines(text, find) {
  const first = String(find).split('\n').find((l) => l.trim()) || '';
  const key = first.trim().slice(0, 40);
  if (!key) return undefined;
  const lines = text.split('\n');
  const idx = lines.findIndex((l) => l.includes(key));
  if (idx === -1) return undefined;
  return lines.slice(Math.max(0, idx - 2), idx + 5).map((l, i) => `${Math.max(0, idx - 2) + i + 1}| ${l}`).join('\n');
}

function truncateResult(result) {
  const s = JSON.stringify(result ?? {});
  if (s.length <= MAX_TOOL_OUTPUT) return result;
  const out = { ...result };
  for (const k of ['output', 'content', 'results', 'files', 'text', 'console']) {
    if (typeof out[k] === 'string' && out[k].length > MAX_TOOL_OUTPUT / 2) {
      const v = out[k];
      out[k] = `${v.slice(0, MAX_TOOL_OUTPUT / 4)}\n… (${v.length - MAX_TOOL_OUTPUT / 2} characters omitted) …\n${v.slice(-MAX_TOOL_OUTPUT / 4)}`;
    }
  }
  return out;
}

export { basename };
