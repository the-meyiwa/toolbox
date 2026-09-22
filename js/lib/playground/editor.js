/* ============================================================
   Code editor for Code Playground (CodeMirror 5, vendored).

   One CodeMirror instance, one CodeMirror.Doc per open file — so every
   file keeps its own undo history, cursor and scroll position while
   switching tabs. Adds IDE behaviour on top: autocompletion (the
   TypeScript language service for JS/TS, keywords + words elsewhere),
   diagnostics as squiggles and gutter markers, hover info, bracket
   matching and auto-closing, code folding, find/replace, go to line,
   comment toggling, line moving/duplication, and a formatter.

   If the editor bundle can't load, a plain textarea keeps the
   playground usable.
   ============================================================ */

import { langInfo, languageOf } from './languages.js';
import { cdn } from './runtimes.js';

let cmPromise = null;

export function loadCodeMirror() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.CodeMirror) return Promise.resolve(window.CodeMirror);
  if (cmPromise) return cmPromise;
  const base = (window.__PG_CDN__ && window.__PG_CDN__.codemirror) || '/vendor/codemirror/';
  cmPromise = new Promise((resolve) => {
    if (!document.querySelector('link[data-pg-cm]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${base}codemirror.bundle.css`;
      link.dataset.pgCm = '1';
      document.head.appendChild(link);
    }
    const s = document.createElement('script');
    s.src = `${base}codemirror.bundle.js`;
    // Give up after a while so a blocked script never leaves the editor blank.
    const timer = setTimeout(() => resolve(window.CodeMirror || null), 20000);
    timer?.unref?.();
    s.onload = () => { clearTimeout(timer); resolve(window.CodeMirror || null); };
    s.onerror = () => { clearTimeout(timer); cmPromise = null; resolve(null); };
    document.head.appendChild(s);
  });
  return cmPromise;
}

const KEYWORDS = {
  python: 'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield print input len range int float str list dict set tuple enumerate zip sorted open isinstance super self'.split(' '),
  cpp: 'auto bool break case catch char class const constexpr continue default delete do double else enum explicit false float for friend if inline int long namespace new nullptr operator private protected public return short signed sizeof static struct switch template this throw true try typedef typename union unsigned using virtual void volatile while include iostream vector string map set cout cin endl std main return'.split(' '),
  c: 'auto break case char const continue default do double else enum extern float for goto if int long register return short signed sizeof static struct switch typedef union unsigned void volatile while include stdio printf scanf malloc free main'.split(' '),
  java: 'abstract boolean break byte case catch char class continue default do double else enum extends final finally float for if implements import instanceof int interface long new null package private protected public return short static super switch this throw throws try void while String System out println Scanner ArrayList List Map HashMap'.split(' '),
  sql: 'SELECT FROM WHERE GROUP BY ORDER HAVING LIMIT OFFSET JOIN LEFT RIGHT INNER OUTER ON AS INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE PRIMARY KEY FOREIGN REFERENCES INTEGER TEXT REAL NOT NULL UNIQUE DEFAULT DROP ALTER INDEX DISTINCT COUNT SUM AVG MIN MAX AND OR IN BETWEEN LIKE IS CASE WHEN THEN ELSE END UNION ALL'.split(' '),
  lua: 'and break do else elseif end false for function goto if in local nil not or repeat return then true until while print pairs ipairs table string math tostring tonumber'.split(' '),
  go: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var fmt Println Printf main'.split(' '),
  rust: 'as break const continue crate else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while println Vec String Option Some None Result Ok Err'.split(' '),
};

function keywordsFor(lang) {
  if (lang === 'header') return KEYWORDS.cpp;
  return KEYWORDS[lang] || [];
}

export class CodeEditor {
  /**
   * @param {HTMLElement} host
   * @param {object} o
   * @param {(path:string, value:string)=>void} o.onChange
   * @param {(pos:{line:number, ch:number}, sel:number)=>void} [o.onCursor]
   * @param {(cm:any, path:string, offset:number)=>Promise<any>} [o.complete]   language-service completions
   * @param {(path:string, offset:number)=>Promise<any>} [o.hover]
   * @param {()=>void} [o.onSave]
   * @param {object} [o.keys] extra keymap
   */
  constructor(host, o = {}) {
    this.host = host;
    this.o = o;
    this.docs = new Map();
    this.path = null;
    this.cm = null;
    this.textarea = null;
    this.theme = o.theme || 'dark';
    this.fontSize = o.fontSize || 14;
    this.wrap = Boolean(o.wrap);
    this.diagnostics = new Map();
    this.readyPromise = this.init();
  }

  async init() {
    const CM = await loadCodeMirror();
    this.CM = CM;
    this.host.classList.add('pge');
    if (!CM) {
      this.textarea = document.createElement('textarea');
      this.textarea.className = 'pge-fallback';
      this.textarea.spellcheck = false;
      this.textarea.addEventListener('input', () => this.path && this.o.onChange?.(this.path, this.textarea.value));
      this.host.appendChild(this.textarea);
      this.flushPending();
      return;
    }
    const isMobile = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 700);
    this.cm = CM(this.host, {
      value: '',
      lineNumbers: true,
      tabSize: 2,
      indentUnit: 2,
      indentWithTabs: false,
      smartIndent: true,
      electricChars: true,
      lineWrapping: this.wrap,
      autoCloseBrackets: true,
      autoCloseTags: true,
      matchBrackets: true,
      matchTags: { bothTags: true },
      styleActiveLine: { nonEmpty: false },
      showTrailingSpace: false,
      foldGutter: true,
      gutters: ['CodeMirror-lint-markers', 'CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
      lint: { getAnnotations: (text, opts, cm) => this.lintAnnotations(cm), lintOnChange: false, tooltips: true },
      highlightSelectionMatches: { showToken: /\w/, annotateScrollbar: true, minChars: 2 },
      scrollPastEnd: false,
      inputStyle: isMobile ? 'contenteditable' : 'textarea',
      spellcheck: false,
      autocorrect: false,
      autocapitalize: false,
      theme: 'toolbox',
      viewportMargin: 30,
      extraKeys: this.keymap(CM),
      configureMouse: () => ({ addNew: false }),
    });
    this.cm.getWrapperElement().style.fontSize = `${this.fontSize}px`;
    this.cm.on('changes', () => {
      if (!this.path || this.silent) return;
      this.o.onChange?.(this.path, this.cm.getValue());
    });
    this.cm.on('cursorActivity', () => {
      const c = this.cm.getCursor();
      const sel = this.cm.getSelection().length;
      this.o.onCursor?.({ line: c.line + 1, ch: c.ch + 1 }, sel);
    });
    this.cm.on('inputRead', (cm, change) => this.maybeAutoComplete(cm, change));
    this.cm.on('keyHandled', (cm, name) => { if (name === 'Esc') this.hideHover(); });
    this.cm.getWrapperElement().addEventListener('mousemove', (e) => this.onHover(e));
    this.cm.getWrapperElement().addEventListener('mouseleave', () => this.hideHover());
    this.cm.on('scroll', () => this.hideHover());
    this.flushPending();
  }

  flushPending() {
    this.initialized = true;
    const p = this.pendingOpen;
    this.pendingOpen = null;
    if (p) this.open(p[0], p[1]);
  }

  ready() { return this.readyPromise; }

  keymap(CM) {
    const mod = /Mac/.test(navigator.platform) ? 'Cmd' : 'Ctrl';
    const map = {
      Tab: (cm) => {
        if (cm.state.completionActive) return CM.Pass;
        if (cm.somethingSelected()) cm.indentSelection('add');
        else cm.replaceSelection(cm.getOption('indentWithTabs') ? '\t' : ' '.repeat(cm.getOption('indentUnit')), 'end', '+input');
      },
      'Shift-Tab': (cm) => cm.indentSelection('subtract'),
      [`${mod}-/`]: (cm) => cm.toggleComment({ indent: true }),
      [`${mod}-Space`]: (cm) => this.showCompletions(cm, true),
      'Ctrl-Space': (cm) => this.showCompletions(cm, true),
      [`${mod}-F`]: 'findPersistent',
      [`${mod}-H`]: 'replace',
      [`Shift-${mod}-H`]: 'replaceAll',
      [`${mod}-G`]: 'jumpToLine',
      'Alt-G': 'jumpToLine',
      F3: 'findNext',
      'Shift-F3': 'findPrev',
      'Alt-Up': (cm) => moveLines(cm, -1),
      'Alt-Down': (cm) => moveLines(cm, 1),
      'Shift-Alt-Down': (cm) => duplicateLines(cm),
      'Shift-Alt-Up': (cm) => duplicateLines(cm),
      [`${mod}-D`]: (cm) => selectNextOccurrence(cm),
      [`Shift-${mod}-K`]: (cm) => deleteLines(cm),
      [`${mod}-Enter`]: () => { this.o.onRun?.(); },
      [`${mod}-S`]: () => { this.o.onSave?.(); },
      [`Shift-${mod}-F`]: () => { this.o.onFormat?.(); },
      'Shift-Alt-F': () => { this.o.onFormat?.(); },
      [`${mod}-[`]: (cm) => cm.indentSelection('subtract'),
      [`${mod}-]`]: (cm) => cm.indentSelection('add'),
      'Ctrl-Q': (cm) => cm.foldCode(cm.getCursor()),
      F12: () => this.o.onGotoDefinition?.(),
      Esc: (cm) => { if (cm.getSelections().length > 1) cm.setCursor(cm.getCursor()); this.hideHover(); return CM.Pass; },
    };
    Object.assign(map, this.o.keys || {});
    return map;
  }

  /* ---------------- documents ---------------- */

  modeFor(path) {
    const info = langInfo(languageOf(path));
    return info.mode || 'text/plain';
  }

  /** Open (or switch to) a file. */
  open(path, value) {
    if (!this.initialized) { this.pendingOpen = [path, value]; this.path = path; return; }
    if (!this.cm) {
      if (this.textarea) {
        this.path = path;
        this.textarea.value = value;
      }
      return;
    }
    let doc = this.docs.get(path);
    if (!doc) {
      doc = this.CM.Doc(value, this.modeFor(path));
      this.docs.set(path, doc);
    } else if (doc.getValue() !== value) {
      this.silent = true;
      doc.setValue(value);
      this.silent = false;
    }
    this.path = path;
    this.silent = true;
    this.cm.swapDoc(doc);
    const mode = this.modeFor(path);
    if (JSON.stringify(this.cm.getOption('mode')) !== JSON.stringify(mode)) this.cm.setOption('mode', mode);
    this.silent = false;
    this.applyLanguageOptions(path);
    this.cm.performLint?.();
    this.cm.refresh();
  }

  applyLanguageOptions(path) {
    const lang = languageOf(path);
    const pythonLike = lang === 'python';
    const four = ['python', 'java', 'csharp', 'cpp', 'c', 'header', 'go', 'rust', 'php', 'kotlin', 'swift'].includes(lang);
    this.cm.setOption('indentUnit', four ? 4 : 2);
    this.cm.setOption('tabSize', four ? 4 : 2);
    this.cm.setOption('indentWithTabs', lang === 'go' || /makefile/i.test(path));
    this.cm.setOption('electricChars', !pythonLike);
    this.cm.setOption('autoCloseTags', ['html', 'vue', 'xml', 'svg', 'jsx', 'tsx', 'markdown'].includes(lang));
    this.cm.setOption('readOnly', langInfo(lang).binary ? 'nocursor' : false);
  }

  /** Update a document that isn't necessarily shown (e.g. changed by the terminal). */
  updateContent(path, value) {
    if (!this.initialized) { if (this.pendingOpen && this.pendingOpen[0] === path) this.pendingOpen[1] = value; return; }
    if (!this.cm) { if (this.path === path && this.textarea && this.textarea.value !== value) this.textarea.value = value; return; }
    const doc = this.docs.get(path);
    if (!doc || doc.getValue() === value) return;
    const cur = doc.getCursor();
    const scroll = path === this.path ? this.cm.getScrollInfo() : null;
    this.silent = true;
    // Replace only the changed middle section so undo history stays useful.
    const old = doc.getValue();
    let start = 0;
    while (start < old.length && start < value.length && old[start] === value[start]) start++;
    let endOld = old.length;
    let endNew = value.length;
    while (endOld > start && endNew > start && old[endOld - 1] === value[endNew - 1]) { endOld--; endNew--; }
    doc.replaceRange(value.slice(start, endNew), doc.posFromIndex(start), doc.posFromIndex(endOld), 'external');
    this.silent = false;
    try { doc.setCursor(cur); } catch { /* out of range */ }
    if (scroll) this.cm.scrollTo(scroll.left, scroll.top);
  }

  rename(from, to) {
    const doc = this.docs.get(from);
    if (!doc) return;
    this.docs.delete(from);
    this.docs.set(to, doc);
    if (this.path === from) { this.path = to; this.cm?.setOption('mode', this.modeFor(to)); this.applyLanguageOptions(to); }
  }

  close(path) {
    this.docs.delete(path);
    if (this.path === path) this.path = null;
  }

  value() { if (!this.initialized) return this.pendingOpen ? this.pendingOpen[1] : ''; return this.cm ? this.cm.getValue() : this.textarea?.value ?? ''; }

  focus() { if (this.cm) this.cm.focus(); else this.textarea?.focus(); }

  refresh() { this.cm?.refresh(); }

  setTheme(theme) {
    this.theme = theme;
    this.host.classList.toggle('pge-light', theme === 'light');
  }

  setFontSize(px) {
    this.fontSize = px;
    if (this.cm) { this.cm.getWrapperElement().style.fontSize = `${px}px`; this.cm.refresh(); }
    else if (this.textarea) this.textarea.style.fontSize = `${px}px`;
  }

  setWrap(on) { this.wrap = on; this.cm?.setOption('lineWrapping', on); }

  goto(line, col = 1, { select = false } = {}) {
    if (!this.cm) return;
    const pos = { line: Math.max(0, line - 1), ch: Math.max(0, col - 1) };
    this.cm.focus();
    if (select) {
      const lineText = this.cm.getLine(pos.line) || '';
      this.cm.setSelection({ line: pos.line, ch: lineText.search(/\S|$/) }, { line: pos.line, ch: lineText.length });
    } else this.cm.setCursor(pos);
    this.cm.scrollIntoView(pos, 120);
    const h = this.cm.addLineClass(pos.line, 'background', 'pge-flash');
    setTimeout(() => this.cm.removeLineClass(h, 'background', 'pge-flash'), 1200);
  }

  cursorOffset() {
    if (!this.cm) return 0;
    return this.cm.indexFromPos(this.cm.getCursor());
  }

  selection() { return this.cm ? this.cm.getSelection() : ''; }

  replaceSelection(text) { this.cm?.replaceSelection(text); }

  exec(cmd) {
    if (!this.cm) return;
    if (cmd === 'undo') this.cm.undo();
    else if (cmd === 'redo') this.cm.redo();
    else if (cmd === 'find') this.cm.execCommand('findPersistent');
    else if (cmd === 'replace') this.cm.execCommand('replace');
    else if (cmd === 'gotoLine') this.cm.execCommand('jumpToLine');
    else if (cmd === 'comment') this.cm.toggleComment({ indent: true });
    else if (cmd === 'selectAll') this.cm.execCommand('selectAll');
    else if (cmd === 'foldAll') this.cm.execCommand('foldAll');
    else if (cmd === 'unfoldAll') this.cm.execCommand('unfoldAll');
    else if (cmd === 'indentAll') this.cm.operation(() => { for (let i = 0; i < this.cm.lineCount(); i++) this.cm.indentLine(i, 'smart'); });
    else if (cmd === 'duplicate') duplicateLines(this.cm);
    else if (cmd === 'complete') this.showCompletions(this.cm, true);
    this.cm.focus();
  }

  /** Insert text at the cursor (mobile symbol bar). */
  insert(text) {
    if (!this.cm) { if (this.textarea) { const t = this.textarea; const s = t.selectionStart; t.value = t.value.slice(0, s) + text + t.value.slice(t.selectionEnd); t.selectionStart = t.selectionEnd = s + text.length; t.dispatchEvent(new Event('input')); } return; }
    if (text === '\t') { this.cm.execCommand('indentMore'); return; }
    const pairs = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
    if (pairs[text] && !this.cm.somethingSelected()) {
      this.cm.replaceSelection(text + pairs[text]);
      const c = this.cm.getCursor();
      this.cm.setCursor({ line: c.line, ch: c.ch - 1 });
    } else this.cm.replaceSelection(text);
    this.cm.focus();
  }

  /* ---------------- diagnostics ---------------- */

  setDiagnostics(path, list) {
    this.diagnostics.set(path, list || []);
    if (path === this.path) this.cm?.performLint?.();
  }

  lintAnnotations(cm) {
    const list = this.diagnostics.get(this.path) || [];
    const CM = this.CM;
    return list.map((d) => {
      const from = CM.Pos(Math.max(0, (d.line || 1) - 1), Math.max(0, (d.column || 1) - 1));
      let to;
      if (d.endLine) to = CM.Pos(d.endLine - 1, Math.max(0, (d.endColumn || d.column || 1) - 1));
      else {
        const text = cm.getLine(from.line) || '';
        const word = /^[\w$]+/.exec(text.slice(from.ch));
        to = CM.Pos(from.line, from.ch + (word ? word[0].length : Math.max(1, text.length - from.ch)));
      }
      if (to.line === from.line && to.ch <= from.ch) to = CM.Pos(from.line, from.ch + 1);
      return { from, to, message: d.message, severity: d.severity === 'warning' ? 'warning' : d.severity === 'info' ? 'warning' : 'error' };
    });
  }

  /* ---------------- completions ---------------- */

  maybeAutoComplete(cm, change) {
    if (cm.state.completionActive || this.o.autoComplete === false) return;
    const ch = change.text?.[0] || '';
    if (change.origin !== '+input' || change.text.length > 1) return;
    const lang = languageOf(this.path || '');
    const tsLike = ['javascript', 'jsx', 'typescript', 'tsx'].includes(lang);
    if (ch === '.' && tsLike) { this.showCompletions(cm, false); return; }
    if (/[\w$]/.test(ch)) {
      const cur = cm.getCursor();
      const token = cm.getTokenAt(cur);
      if (token.type && /comment|string/.test(token.type)) return;
      const word = /[\w$]+$/.exec(cm.getLine(cur.line).slice(0, cur.ch));
      if (word && word[0].length >= 2 && !/^\d/.test(word[0])) this.showCompletions(cm, false);
    }
  }

  showCompletions(cm, explicit) {
    if (!this.CM) return;
    const path = this.path;
    const lang = languageOf(path || '');
    const tsLike = ['javascript', 'jsx', 'typescript', 'tsx'].includes(lang);
    const CM = this.CM;
    const hint = (editor, callback) => {
      const cur = editor.getCursor();
      const line = editor.getLine(cur.line);
      let start = cur.ch;
      while (start > 0 && /[\w$]/.test(line[start - 1])) start--;
      const prefix = line.slice(start, cur.ch);
      const from = CM.Pos(cur.line, start);
      const to = cur;
      const finish = (list) => {
        if (!list.length) { callback(null); return; }
        const res = { list, from, to };
        CM.on(res, 'close', () => {});
        callback(res);
      };
      if (tsLike && this.o.complete) {
        this.o.complete(path, editor.indexFromPos(cur)).then((r) => {
          const entries = (r?.entries || []).filter((e) => !prefix || e.name.toLowerCase().startsWith(prefix.toLowerCase()) || fuzzy(prefix, e.name));
          entries.sort((a, b) => rank(a, prefix) - rank(b, prefix) || (a.sortText || '').localeCompare(b.sortText || '') || a.name.localeCompare(b.name));
          finish(entries.slice(0, 80).map((e) => ({
            text: e.insertText || e.name,
            displayText: e.name,
            className: `pge-hint-${e.kind || 'text'}`,
            render: (el, self, data) => { el.innerHTML = `<span class="pge-hint-kind pge-kind-${escapeHtml(e.kind || 'text')}">${kindIcon(e.kind)}</span><span>${escapeHtml(data.displayText)}</span>`; },
          })));
        }).catch(() => finish([]));
        return;
      }
      // Words from the document + language keywords (+ CodeMirror's HTML/CSS/SQL hinters).
      const words = new Set(keywordsFor(lang));
      const text = editor.getValue();
      const re = /[A-Za-z_$][\w$]{2,}/g;
      let m;
      let n = 0;
      while ((m = re.exec(text)) && n++ < 20000) words.add(m[0]);
      words.delete(prefix);
      let list = [...words].filter((w) => !prefix || w.toLowerCase().startsWith(prefix.toLowerCase()));
      list.sort((a, b) => a.length - b.length || a.localeCompare(b));
      const modeHint = lang === 'html' || lang === 'vue' ? CM.hint.html : lang === 'css' || lang === 'scss' ? CM.hint.css : lang === 'sql' ? CM.hint.sql : null;
      if (modeHint) {
        try {
          const r = modeHint(editor, { completeSingle: false });
          if (r && r.list.length) { callback(r); return; }
        } catch { /* fall back to words */ }
      }
      if (!explicit && !prefix) { callback(null); return; }
      finish(list.slice(0, 60));
    };
    hint.async = true;
    cm.showHint({ hint, completeSingle: false, closeCharacters: /[\s()[\]{};:>,=]/, alignWithWord: true, container: document.body });
  }

  /* ---------------- hover ---------------- */

  onHover(e) {
    if (!this.cm || !this.o.hover) return;
    clearTimeout(this.hoverTimer);
    const x = e.clientX;
    const y = e.clientY;
    this.hoverTimer = setTimeout(async () => {
      const pos = this.cm.coordsChar({ left: x, top: y }, 'window');
      const line = this.cm.getLine(pos.line) || '';
      if (!/[\w$]/.test(line[pos.ch] || '') && !/[\w$]/.test(line[pos.ch - 1] || '')) { this.hideHover(); return; }
      // Diagnostics under the cursor take priority.
      const diag = (this.diagnostics.get(this.path) || []).find((d) => d.line - 1 === pos.line && pos.ch >= (d.column || 1) - 1 && pos.ch <= (d.endColumn || d.column + 20));
      const lang = languageOf(this.path || '');
      if (!['javascript', 'jsx', 'typescript', 'tsx'].includes(lang) && !diag) return;
      const info = diag ? null : await this.o.hover(this.path, this.cm.indexFromPos(pos)).catch(() => null);
      if (!info && !diag) { this.hideHover(); return; }
      this.showHover(x, y, diag ? `<div class="pge-hover-diag">${escapeHtml(diag.message)}</div>` : `<pre class="pge-hover-sig">${escapeHtml(info.text)}</pre>${info.doc ? `<div class="pge-hover-doc">${escapeHtml(info.doc)}</div>` : ''}`);
    }, 450);
  }

  showHover(x, y, html) {
    if (!this.hoverEl) {
      this.hoverEl = document.createElement('div');
      this.hoverEl.className = 'pge-hover';
      document.body.appendChild(this.hoverEl);
    }
    this.hoverEl.className = `pge-hover ${this.theme === 'light' ? 'is-light' : ''}`;
    this.hoverEl.innerHTML = html;
    this.hoverEl.style.display = 'block';
    const r = this.hoverEl.getBoundingClientRect();
    let left = Math.min(x + 12, window.innerWidth - r.width - 8);
    let top = y + 18;
    if (top + r.height > window.innerHeight - 8) top = y - r.height - 10;
    this.hoverEl.style.left = `${Math.max(8, left)}px`;
    this.hoverEl.style.top = `${Math.max(8, top)}px`;
  }

  hideHover() {
    clearTimeout(this.hoverTimer);
    if (this.hoverEl) this.hoverEl.style.display = 'none';
  }

  dispose() {
    this.hideHover();
    this.hoverEl?.remove();
    this.host.innerHTML = '';
    this.docs.clear();
  }
}

/* ---------------- editing commands ---------------- */

function moveLines(cm, dir) {
  cm.operation(() => {
    const ranges = cm.listSelections();
    const r = ranges[0];
    const from = Math.min(r.anchor.line, r.head.line);
    const to = Math.max(r.anchor.line, r.head.line);
    if (dir < 0 && from === 0) return;
    if (dir > 0 && to === cm.lastLine()) return;
    const lines = [];
    for (let i = from; i <= to; i++) lines.push(cm.getLine(i));
    if (dir < 0) {
      const above = cm.getLine(from - 1);
      cm.replaceRange([...lines, above].join('\n'), { line: from - 1, ch: 0 }, { line: to, ch: cm.getLine(to).length }, '+move');
    } else {
      const below = cm.getLine(to + 1);
      cm.replaceRange([below, ...lines].join('\n'), { line: from, ch: 0 }, { line: to + 1, ch: below.length }, '+move');
    }
    cm.setSelection({ line: r.anchor.line + dir, ch: r.anchor.ch }, { line: r.head.line + dir, ch: r.head.ch });
  });
}

function duplicateLines(cm) {
  cm.operation(() => {
    const r = cm.listSelections()[0];
    const from = Math.min(r.anchor.line, r.head.line);
    const to = Math.max(r.anchor.line, r.head.line);
    const text = [];
    for (let i = from; i <= to; i++) text.push(cm.getLine(i));
    cm.replaceRange(`\n${text.join('\n')}`, { line: to, ch: cm.getLine(to).length });
  });
}

function deleteLines(cm) {
  cm.operation(() => {
    const r = cm.listSelections()[0];
    const from = Math.min(r.anchor.line, r.head.line);
    const to = Math.max(r.anchor.line, r.head.line);
    if (to < cm.lastLine()) cm.replaceRange('', { line: from, ch: 0 }, { line: to + 1, ch: 0 });
    else cm.replaceRange('', { line: Math.max(0, from - 1), ch: from > 0 ? cm.getLine(from - 1).length : 0 }, { line: to, ch: cm.getLine(to).length });
  });
}

function selectNextOccurrence(cm) {
  const sels = cm.listSelections();
  const last = sels[sels.length - 1];
  if (last.anchor.line === last.head.line && last.anchor.ch === last.head.ch) {
    const w = cm.findWordAt(last.head);
    cm.setSelection(w.anchor, w.head);
    return;
  }
  const text = cm.getRange(last.from ? last.from() : last.anchor, last.to ? last.to() : last.head);
  const cursor = cm.getSearchCursor(text, last.to ? last.to() : last.head);
  if (!cursor.findNext()) {
    const wrap = cm.getSearchCursor(text, { line: 0, ch: 0 });
    if (!wrap.findNext()) return;
    cm.addSelection(wrap.from(), wrap.to());
  } else cm.addSelection(cursor.from(), cursor.to());
}

function fuzzy(prefix, name) {
  let i = 0;
  const p = prefix.toLowerCase();
  const n = name.toLowerCase();
  for (const c of n) if (c === p[i]) i++;
  return i === p.length && p.length >= 2;
}

function rank(e, prefix) {
  if (!prefix) return 0;
  if (e.name === prefix) return -2;
  if (e.name.startsWith(prefix)) return -1;
  if (e.name.toLowerCase().startsWith(prefix.toLowerCase())) return 0;
  return 1;
}

function kindIcon(kind) {
  return { method: 'ƒ', function: 'ƒ', property: '◆', variable: 'x', constant: 'c', class: 'C', interface: 'I', type: 'T', enum: 'E', module: '{}', keyword: 'k', text: 'a' }[kind] || '·';
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
