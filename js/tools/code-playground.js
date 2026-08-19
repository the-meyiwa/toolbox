/* ============================================================
   Code Playground

   Write and run code with nothing installed. Each language runs in a
   terminated-on-demand Web Worker, so an infinite loop costs you a
   click on Stop rather than the whole tab.
   ============================================================ */

import { LANGUAGES, makeWorker, transpileTypeScript } from '../lib/code-runtimes.js';
import { WEB_FRAMEWORKS, buildPreviewDocument } from '../lib/runtimes-extra.js';
import { REMOTE_LANGUAGES, compileRemote } from '../lib/remote-compile.js';

/* Every language the playground offers. Local ones run on the device;
   remote ones are compiled by a server because no browser can host a
   C or Swift toolchain. Which is which is never hidden from the user. */
const ALL = { ...LANGUAGES, ...REMOTE_LANGUAGES };
const isRemote = (id) => Object.hasOwn(REMOTE_LANGUAGES, id);
const isPreview = (id) => !!LANGUAGES[id]?.preview;

const STORAGE_KEY = 'toolbox.playground';
/* Per-language run limits. A missing entry used to fall through as
   `undefined`, which made setTimeout fire immediately and report
   "Stopped after NaN seconds" — so Lua failed the moment it was added
   rather than when it misbehaved. DEFAULT_TIMEOUT_MS backstops every
   language, present or future. */
const RUN_TIMEOUT_MS = {
  javascript: 10000, typescript: 10000, python: 60000, sql: 20000,
  // Lua downloads its runtime on the first run.
  lua: 30000,
};
const DEFAULT_TIMEOUT_MS = 30000;

export default {
  render(container, { analytics } = {}) {
    this._alive = true;
    this._workers = {};

    /* ---------------- restore previous session ---------------- */

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { /* corrupt, ignore */ }

    const state = {
      lang: ALL[saved.lang] ? saved.lang : 'javascript',
      code: { ...Object.fromEntries(Object.entries(ALL).map(([k, v]) => [k, v.sample])), ...(saved.code || {}) },
      framework: WEB_FRAMEWORKS[saved.framework] ? saved.framework : 'bootstrap',
      stdin: saved.stdin || '',
      running: false,
    };

    /* ---------------- markup ---------------- */

    container.innerHTML = `
      <div class="cpg">
        <div class="cpg-bar">
          <select class="tool-select cpg-lang-select" id="cpg-langs" aria-label="Language">
            <optgroup label="Runs on your device">
              ${Object.entries(LANGUAGES).map(([id, l]) =>
                `<option value="${id}"${id === state.lang ? ' selected' : ''}>${l.name}</option>`).join('')}
            </optgroup>
            <optgroup label="Compiled on a server">
              ${Object.entries(REMOTE_LANGUAGES).map(([id, l]) =>
                `<option value="${id}"${id === state.lang ? ' selected' : ''}>${l.name}</option>`).join('')}
            </optgroup>
          </select>
          <select class="tool-select cpg-fw" id="cpg-fw" hidden aria-label="CSS framework">
            ${Object.entries(WEB_FRAMEWORKS).map(([id, f]) =>
              `<option value="${id}"${id === state.framework ? ' selected' : ''}>${f.name}</option>`).join('')}
          </select>
          <div class="cpg-bar-right">
            <button class="btn btn-sm" id="cpg-sample">Load example</button>
            <button class="btn btn-sm" id="cpg-clear">Clear output</button>
            <button class="btn btn-sm" id="cpg-reset" hidden>Reset database</button>
            <button class="btn btn-primary btn-sm" id="cpg-run">Run <kbd>⌃↵</kbd></button>
          </div>
        </div>

        <p class="cpg-note" id="cpg-note"></p>
        <details class="cpg-stdin" id="cpg-stdin-wrap" hidden>
          <summary>Standard input</summary>
          <textarea class="tool-textarea" id="cpg-stdin" rows="3" spellcheck="false"
                    placeholder="Anything typed here is piped to the program as stdin."></textarea>
        </details>

        <div class="cpg-split">
          <div class="cpg-editor-wrap">
            <div class="cpg-gutter" id="cpg-gutter" aria-hidden="true"></div>
            <textarea class="cpg-editor" id="cpg-code" spellcheck="false" autocomplete="off"
                      autocapitalize="off" autocorrect="off" wrap="off"
                      aria-label="Code editor"></textarea>
          </div>

          <div class="cpg-console-wrap">
            <iframe class="cpg-preview" id="cpg-preview" hidden title="Preview"
                    sandbox="allow-scripts allow-modals allow-popups allow-forms"></iframe>
            <div class="cpg-console-head">
              <span>Output</span>
              <span class="cpg-timing" id="cpg-timing"></span>
            </div>
            <div class="cpg-console" id="cpg-console"></div>
          </div>
        </div>
      </div>`;

    const codeEl    = container.querySelector('#cpg-code');
    const gutterEl  = container.querySelector('#cpg-gutter');
    const consoleEl = container.querySelector('#cpg-console');
    const timingEl  = container.querySelector('#cpg-timing');
    const runBtn    = container.querySelector('#cpg-run');
    const noteEl    = container.querySelector('#cpg-note');
    const previewEl = container.querySelector('#cpg-preview');
    const fwEl      = container.querySelector('#cpg-fw');
    const stdinWrap = container.querySelector('#cpg-stdin-wrap');
    const stdinEl   = container.querySelector('#cpg-stdin');

    /* ---------------- editor behaviour ---------------- */

    function renderGutter() {
      const lines = codeEl.value.split('\n').length;
      gutterEl.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
      gutterEl.scrollTop = codeEl.scrollTop;
    }

    codeEl.addEventListener('input', () => {
      state.code[state.lang] = codeEl.value;
      renderGutter();
      persist();
    });

    codeEl.addEventListener('scroll', () => { gutterEl.scrollTop = codeEl.scrollTop; });

    codeEl.addEventListener('keydown', (e) => {
      // Tab inserts two spaces; Shift+Tab removes them. Without this, Tab
      // leaves the editor and the tool is unusable for real code.
      if (e.key === 'Tab') {
        e.preventDefault();
        const { selectionStart: s, selectionEnd: en, value } = codeEl;

        if (s !== en || e.shiftKey) {
          const lineStart = value.lastIndexOf('\n', s - 1) + 1;
          const chunk = value.slice(lineStart, en);
          const updated = e.shiftKey
            ? chunk.replace(/^ {1,2}/gm, '')
            : chunk.replace(/^/gm, '  ');
          codeEl.setRangeText(updated, lineStart, en, 'select');
        } else {
          codeEl.setRangeText('  ', s, en, 'end');
        }
        codeEl.dispatchEvent(new Event('input'));
        return;
      }

      // Enter keeps the current indentation, and adds a level after an
      // opening brace or a colon.
      if (e.key === 'Enter') {
        const { selectionStart: s, value } = codeEl;
        const lineStart = value.lastIndexOf('\n', s - 1) + 1;
        const line = value.slice(lineStart, s);
        const indent = (line.match(/^[ \t]*/) || [''])[0];
        const deeper = /[{([:]\s*$/.test(line) ? '  ' : '';
        if (indent || deeper) {
          e.preventDefault();
          codeEl.setRangeText('\n' + indent + deeper, s, codeEl.selectionEnd, 'end');
          codeEl.dispatchEvent(new Event('input'));
        }
        return;
      }

      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
    });

    // Ctrl/Cmd+Enter anywhere in the tool runs the program.
    this._onKey = (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && container.contains(document.activeElement)) {
        e.preventDefault();
        run();
      }
    };
    document.addEventListener('keydown', this._onKey);

    function persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          lang: state.lang, code: state.code,
          framework: state.framework, stdin: state.stdin,
        }));
      } catch { /* private mode or quota — not worth interrupting the user */ }
    }

    /* ---------------- console output ---------------- */

    function line(level, text) {
      const el = document.createElement('div');
      el.className = `cpg-line cpg-${level}`;
      el.textContent = text;
      consoleEl.appendChild(el);
      consoleEl.scrollTop = consoleEl.scrollHeight;
    }

    function resultTable({ columns, values }) {
      const wrap = document.createElement('div');
      wrap.className = 'cpg-table-wrap';
      wrap.innerHTML = `
        <table class="cpg-table">
          <thead><tr>${columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
          <tbody>${values.map(row =>
            `<tr>${row.map(v => `<td${typeof v === 'number' ? ' class="num"' : ''}>${
              v === null ? '<span class="cpg-null">NULL</span>' : esc(String(v))
            }</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        <p class="cpg-rowcount">${values.length} row${values.length === 1 ? '' : 's'}</p>`;
      consoleEl.appendChild(wrap);
      consoleEl.scrollTop = consoleEl.scrollHeight;
    }

    const esc = (s) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    function clearConsole() {
      consoleEl.innerHTML = '';
      timingEl.textContent = '';
    }

    container.querySelector('#cpg-clear').addEventListener('click', clearConsole);

    /* ---------------- running ---------------- */

    const self_ = this;

    /* Workers are kept alive between runs, one per language. That keeps the
       Python interpreter warm (a cold Pyodide boot is several seconds even
       when the download is cached) and lets the SQLite database survive from
       one query to the next, which is what the tool promises. A worker is
       only torn down when the user stops it, it times out, or the tool
       closes — at which point the next run starts from a clean slate. */
    function getWorker(lang) {
      if (!self_._workers[lang]) self_._workers[lang] = makeWorker(lang);
      return self_._workers[lang];
    }

    function killWorker(lang) {
      const w = self_._workers[lang];
      if (w) { w.terminate(); delete self_._workers[lang]; }
    }

    function idle() {
      clearTimeout(self_._timer);
      state.running = false;
      runBtn.textContent = 'Run ';
      runBtn.appendChild(Object.assign(document.createElement('kbd'), { textContent: '⌃↵' }));
      runBtn.classList.remove('is-stop');
    }

    // Hard stop: the program is still going, so the worker has to die with it.
    function abort(reason) {
      killWorker(state.lang);
      idle();
      if (reason) line('error', reason);
    }

    async function run() {
      if (state.running) {
        // A remote compile is cancelled through its own controller;
        // local runs are killed by terminating the worker.
        if (self_._remote) { self_._remote.abort(); self_._remote = null; }
        else abort('Stopped.');
        return;
      }

      clearConsole();
      state.running = true;
      runBtn.textContent = 'Stop';
      runBtn.classList.add('is-stop');

      const lang = state.lang;
      let source = codeEl.value;

      if (!source.trim()) { line('muted', 'Nothing to run.'); idle(); return; }

      /* Web code is a page, not a program: render it and stop. */
      if (isPreview(lang)) {
        previewEl.srcdoc = buildPreviewDocument(source, state.framework);
        line('muted', 'Preview updated.');
        timingEl.textContent = WEB_FRAMEWORKS[state.framework].name;
        idle();
        analytics?.completed({ outputKind: 'html' });
        return;
      }

      /* Compiled languages go to a server, because no browser hosts a
         C or Swift toolchain. The console says so every time. */
      if (isRemote(lang)) {
        const meta = REMOTE_LANGUAGES[lang];
        line('muted', `Sending to the compiler — ${meta.name} ${meta.version}. This code leaves your device.`);
        self_._remote = new AbortController();
        try {
          const res = await compileRemote(lang, source, {
            stdin: stdinEl.value,
            signal: self_._remote.signal,
          });
          if (!self_._alive) return;
          clearConsole();
          if (res.compileError) {
            for (const l of res.compileError.split('\n')) line(res.ok ? 'muted' : 'error', l);
          }
          if (res.output) for (const l of res.output.split('\n')) line('log', l);
          if (res.runtimeError) for (const l of res.runtimeError.split('\n')) line('error', l);
          if (!res.output && !res.compileError && !res.runtimeError) line('muted', 'No output.');
          if (!res.ok) line('muted', `Exited with status ${res.status}${res.signal ? ' (' + res.signal + ')' : ''}.`);
          timingEl.textContent = `${meta.name} · ${res.ms} ms`;
          if (res.ok) analytics?.completed({ durationMs: res.ms, outputKind: 'text' });
          else analytics?.error('compile_failed');
        } catch (err) {
          if (!self_._alive) return;
          if (err.name === 'AbortError') line('muted', 'Stopped.');
          else { line('error', err.message); analytics?.error('remote_unreachable'); }
        } finally {
          self_._remote = null;
          idle();
        }
        return;
      }

      // TypeScript is compiled on the main thread, then the emitted
      // JavaScript is handed to the JS worker.
      if (lang === 'typescript') {
        line('muted', 'Compiling TypeScript…');
        try {
          const { code, errors } = await transpileTypeScript(source);
          if (!self_._alive) return;
          if (errors.length) { for (const e of errors) line('error', e); idle(); return; }
          source = code;
          clearConsole();
        } catch (err) {
          line('error', err.message);
          idle();
          return;
        }
      }

      const worker = getWorker(lang);

      worker.onmessage = (e) => {
        const { type, level, text, payload } = e.data;
        if (type === 'out')         line(level, text);
        else if (type === 'table')  resultTable(payload);
        else if (type === 'status') line('muted', text);
        else if (type === 'done') {
          timingEl.textContent = `finished in ${Number(text).toLocaleString()} ms`;
          if (!consoleEl.children.length) line('muted', 'Ran with no output.');
          idle();
        }
      };

      worker.onerror = (err) => {
        abort(err.message || 'The runtime failed to start.');
      };

      const limit = RUN_TIMEOUT_MS[lang] ?? DEFAULT_TIMEOUT_MS;
      self_._timer = setTimeout(() => {
        abort(`Stopped after ${limit / 1000} seconds — the program was still running.`);
      }, limit);

      worker.postMessage({ code: source });
    }

    runBtn.addEventListener('click', run);

    /* ---------------- SQL: reset the sample database ---------------- */

    const resetBtn = container.querySelector('#cpg-reset');

    resetBtn.addEventListener('click', () => {
      if (state.running) return;
      clearConsole();
      state.running = true;
      runBtn.textContent = 'Stop';
      runBtn.classList.add('is-stop');
      const worker = getWorker('sql');
      worker.onmessage = (e) => {
        const { type, level, text } = e.data;
        if (type === 'out' || type === 'status') line(level || 'muted', text);
        else if (type === 'done') idle();
      };
      self_._timer = setTimeout(() => abort('Reset timed out.'), 20000);
      worker.postMessage({ reset: true });
    });

    /* ---------------- language switching ---------------- */

    function applyLanguage(id) {
      state.lang = id;
      codeEl.value = state.code[id] ?? ALL[id].sample;
      codeEl.dataset.lang = ALL[id].mono;
      const l = ALL[id];

      const remote = isRemote(id);
      const preview = isPreview(id);

      noteEl.innerHTML = remote
        ? `Compiled with <strong>${l.compiler}</strong> on a public build server, because a browser cannot host this toolchain. <span class="cpg-warn">Your code is sent off your device to run.</span>`
        : `${l.note}${l.weight ? ` <span class="cpg-weight">${l.weight}</span>` : ''}`;
      noteEl.classList.toggle('is-remote', remote);

      previewEl.hidden = !preview;
      consoleEl.parentElement.querySelector('.cpg-console-head').hidden = preview;
      consoleEl.hidden = preview;
      fwEl.hidden = !preview;
      stdinWrap.hidden = !remote;
      resetBtn.hidden = id !== 'sql';

      renderGutter();
      clearConsole();
      idle();
      timingEl.textContent = '';
      if (preview) previewEl.srcdoc = buildPreviewDocument(codeEl.value, state.framework);
      persist();
    }

    container.querySelector('#cpg-langs').addEventListener('change', (e) => {
      applyLanguage(e.target.value);
    });

    fwEl.addEventListener('change', () => {
      state.framework = fwEl.value;
      if (isPreview(state.lang)) previewEl.srcdoc = buildPreviewDocument(codeEl.value, state.framework);
      persist();
    });

    stdinEl.addEventListener('input', () => { state.stdin = stdinEl.value; persist(); });

    container.querySelector('#cpg-sample').addEventListener('click', () => {
      state.code[state.lang] = ALL[state.lang].sample;
      codeEl.value = ALL[state.lang].sample;
      renderGutter();
      persist();
    });

    stdinEl.value = state.stdin;
    applyLanguage(state.lang);
  },

  destroy() {
    this._alive = false;
    this._remote?.abort();
    for (const w of Object.values(this._workers || {})) w.terminate();
    this._workers = {};
    clearTimeout(this._timer);
    document.removeEventListener('keydown', this._onKey);
  },
};
