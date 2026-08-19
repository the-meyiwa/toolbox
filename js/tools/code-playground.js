/* ============================================================
   Code Playground

   Write and run code with nothing installed. Each language runs in a
   terminated-on-demand Web Worker, so an infinite loop costs you a
   click on Stop rather than the whole tab.
   ============================================================ */

import { LANGUAGES, makeWorker, transpileTypeScript } from '../lib/code-runtimes.js';

const STORAGE_KEY = 'toolbox.playground';
const RUN_TIMEOUT_MS = { javascript: 10000, typescript: 10000, python: 60000, sql: 20000 };

export default {
  render(container) {
    this._alive = true;
    this._workers = {};

    /* ---------------- restore previous session ---------------- */

    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { /* corrupt, ignore */ }

    const state = {
      lang: LANGUAGES[saved.lang] ? saved.lang : 'javascript',
      code: { ...Object.fromEntries(Object.entries(LANGUAGES).map(([k, v]) => [k, v.sample])), ...(saved.code || {}) },
      running: false,
    };

    /* ---------------- markup ---------------- */

    container.innerHTML = `
      <div class="cpg">
        <div class="cpg-bar">
          <div class="btn-group t3d-seg cpg-langs" id="cpg-langs">
            ${Object.entries(LANGUAGES).map(([id, l]) =>
              `<button class="btn btn-sm${id === state.lang ? ' is-active' : ''}" data-lang="${id}">${l.name}</button>`).join('')}
          </div>
          <div class="cpg-bar-right">
            <button class="btn btn-sm" id="cpg-sample">Load example</button>
            <button class="btn btn-sm" id="cpg-clear">Clear output</button>
            <button class="btn btn-sm" id="cpg-reset" hidden>Reset database</button>
            <button class="btn btn-primary btn-sm" id="cpg-run">Run <kbd>⌃↵</kbd></button>
          </div>
        </div>

        <p class="cpg-note" id="cpg-note"></p>

        <div class="cpg-split">
          <div class="cpg-editor-wrap">
            <div class="cpg-gutter" id="cpg-gutter" aria-hidden="true"></div>
            <textarea class="cpg-editor" id="cpg-code" spellcheck="false" autocomplete="off"
                      autocapitalize="off" autocorrect="off" wrap="off"
                      aria-label="Code editor"></textarea>
          </div>

          <div class="cpg-console-wrap">
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ lang: state.lang, code: state.code }));
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
      if (state.running) { abort('Stopped.'); return; }

      clearConsole();
      state.running = true;
      runBtn.textContent = 'Stop';
      runBtn.classList.add('is-stop');

      const lang = state.lang;
      let source = codeEl.value;

      if (!source.trim()) { line('muted', 'Nothing to run.'); idle(); return; }

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

      const limit = RUN_TIMEOUT_MS[lang];
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
      codeEl.value = state.code[id] ?? LANGUAGES[id].sample;
      codeEl.dataset.lang = LANGUAGES[id].mono;
      const l = LANGUAGES[id];
      noteEl.innerHTML = `${l.note}${l.weight ? ` <span class="cpg-weight">${l.weight}</span>` : ''}`;
      renderGutter();
      clearConsole();
      idle();
      resetBtn.hidden = id !== 'sql';
      persist();
    }

    container.querySelector('#cpg-langs').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-lang]');
      if (!btn || btn.dataset.lang === state.lang) return;
      for (const b of container.querySelectorAll('#cpg-langs .btn')) b.classList.toggle('is-active', b === btn);
      applyLanguage(btn.dataset.lang);
    });

    container.querySelector('#cpg-sample').addEventListener('click', () => {
      state.code[state.lang] = LANGUAGES[state.lang].sample;
      codeEl.value = LANGUAGES[state.lang].sample;
      renderGutter();
      persist();
    });

    applyLanguage(state.lang);
  },

  destroy() {
    this._alive = false;
    for (const w of Object.values(this._workers || {})) w.terminate();
    this._workers = {};
    clearTimeout(this._timer);
    document.removeEventListener('keydown', this._onKey);
  },
};
