/* ============================================================
   Terminal view for Code Playground.

   A DOM terminal: ANSI colours (SGR 30–37, 90–97, bold, dim, italic,
   underline, 256-colour and truecolour), carriage returns, a line
   editor with history (↑/↓), Tab completion, Ctrl+C / Ctrl+D / Ctrl+L,
   paste, and clickable "file:line:col" links. Programs read input
   through readLine(), so prompts like `Enter your name: ` sit on the
   same line as the student's answer, exactly like a real terminal.
   ============================================================ */

const FG = ['#1d1f21', '#e5534b', '#57ab5a', '#c69026', '#539bf5', '#b083f0', '#39c5cf', '#d1d5da'];
const FG_BRIGHT = ['#636e7b', '#ff938a', '#6bc46d', '#daaa3f', '#6cb6ff', '#dcbdfb', '#56d4dd', '#f0f3f6'];
const FG_LIGHT = ['#24292f', '#cf222e', '#116329', '#9a6700', '#0969da', '#8250df', '#1b7c83', '#57606a'];
const FG_BRIGHT_LIGHT = ['#57606a', '#a40e26', '#1a7f37', '#8a4600', '#218bff', '#a475f9', '#3192aa', '#8c959f'];

const MAX_LINES = 6000;
const LINK_RE = /((?:\/workspace\/)?(?:[\w.@-]+\/)*[\w.@-]+\.[A-Za-z0-9]{1,6}):(\d+)(?::(\d+))?/g;

function xterm256(n) {
  if (n < 16) return null;
  if (n >= 232) { const v = 8 + (n - 232) * 10; return `rgb(${v},${v},${v})`; }
  const i = n - 16;
  const c = (x) => (x ? x * 40 + 55 : 0);
  return `rgb(${c(Math.floor(i / 36))},${c(Math.floor(i / 6) % 6)},${c(i % 6)})`;
}

export class TerminalView {
  /**
   * @param {HTMLElement} host
   * @param {object} o
   * @param {(line:string)=>Promise<void>} o.onCommand
   * @param {(line:string, cursor:number)=>{replaceFrom:number, candidates:string[], common:string}} [o.complete]
   * @param {()=>void} [o.onInterrupt]
   * @param {(file:string, line:number, col:number)=>void} [o.onLink]
   * @param {()=>boolean} [o.isLight]
   */
  constructor(host, { onCommand, complete, onInterrupt, onLink, isLight } = {}) {
    this.host = host;
    this.onCommand = onCommand;
    this.completeFn = complete;
    this.onInterrupt = onInterrupt;
    this.onLink = onLink;
    this.isLight = isLight || (() => false);
    this.history = [];
    this.histIdx = -1;
    this.draft = '';
    this.promptText = '$ ';
    this.busy = false;
    this.inputWaiters = [];
    this.inputQueue = [];
    this.style = {};
    this.lineCount = 0;
    this.pending = '';
    this.flushScheduled = false;
    this.disposed = false;

    host.classList.add('pgt');
    host.innerHTML = '';
    this.screen = document.createElement('div');
    this.screen.className = 'pgt-screen';
    this.screen.setAttribute('role', 'log');
    this.screen.setAttribute('aria-live', 'polite');
    this.inputRow = document.createElement('span');
    this.inputRow.className = 'pgt-input-row';
    this.promptEl = document.createElement('span');
    this.promptEl.className = 'pgt-prompt';
    this.input = document.createElement('input');
    this.input.className = 'pgt-input';
    this.input.type = 'text';
    this.input.spellcheck = false;
    this.input.autocomplete = 'off';
    this.input.setAttribute('autocapitalize', 'off');
    this.input.setAttribute('autocorrect', 'off');
    this.input.setAttribute('aria-label', 'Terminal input');
    this.input.setAttribute('enterkeyhint', 'send');
    this.inputRow.append(this.promptEl, this.input);
    this.currentLine = this.newLine();
    this.currentLine.appendChild(this.inputRow);
    host.appendChild(this.screen);

    this.hint = document.createElement('div');
    this.hint.className = 'pgt-hint';
    this.hint.hidden = true;
    host.appendChild(this.hint);

    this.input.addEventListener('keydown', (e) => this.onKey(e));
    this.input.addEventListener('paste', (e) => {
      const text = e.clipboardData?.getData('text') || '';
      if (text.includes('\n')) {
        e.preventDefault();
        const lines = text.replace(/\r/g, '').split('\n');
        const first = this.input.value.slice(0, this.input.selectionStart) + lines[0] + this.input.value.slice(this.input.selectionEnd);
        this.input.value = first;
        const rest = lines.slice(1);
        this.submit();
        for (const l of rest) { if (l === '' && l === rest[rest.length - 1]) break; this.queueTyped(l); }
      }
    });
    host.addEventListener('mouseup', () => {
      const sel = window.getSelection?.();
      if (!sel || sel.isCollapsed) this.focus();
    });
    this.screen.addEventListener('click', (e) => {
      const link = e.target.closest?.('.pgt-link');
      if (link && this.onLink) {
        e.preventDefault();
        this.onLink(link.dataset.file, Number(link.dataset.line), Number(link.dataset.col || 1));
      }
    });
    this.setPrompt('$ ');
  }

  newLine() {
    const el = document.createElement('div');
    el.className = 'pgt-line';
    this.screen.appendChild(el);
    this.lineCount++;
    if (this.lineCount > MAX_LINES) {
      const first = this.screen.firstChild;
      if (first && first !== this.currentLine) { first.remove(); this.lineCount--; }
    }
    return el;
  }

  /* ---------------- output ---------------- */

  write(text) {
    if (this.disposed || text == null || text === '') return;
    this.pending += String(text);
    if (!this.flushScheduled) {
      this.flushScheduled = true;
      (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (f) => setTimeout(f, 16))(() => this.flush());
    }
  }

  writeln(text = '') { this.write(`${text}\n`); }

  /** Write immediately (used before blocking for input). */
  flush() {
    this.flushScheduled = false;
    if (!this.pending) return;
    const text = this.pending;
    this.pending = '';
    const nearBottom = this.host.scrollHeight - this.host.scrollTop - this.host.clientHeight < 60;
    this.render(text);
    if (nearBottom || this.busy) this.scrollToBottom();
  }

  scrollToBottom() { this.host.scrollTop = this.host.scrollHeight; }

  render(text) {
    // Parse ANSI escapes and newlines; insert before the input row.
    let i = 0;
    let buf = '';
    const emit = () => {
      if (!buf) return;
      this.appendText(buf);
      buf = '';
    };
    while (i < text.length) {
      const c = text[i];
      if (c === '\x1b' && text[i + 1] === '[') {
        const m = /^\x1b\[([0-9;?]*)([A-Za-z])/.exec(text.slice(i, i + 32));
        if (m) {
          emit();
          if (m[2] === 'm') this.applySgr(m[1]);
          else if (m[2] === 'J' && (m[1] === '2' || m[1] === '3')) this.clear();
          else if (m[2] === 'K') { /* clear line: ignore */ }
          i += m[0].length;
          continue;
        }
      }
      if (c === '\n') {
        emit();
        this.breakLine();
        i++;
        continue;
      }
      if (c === '\r') {
        emit();
        if (text[i + 1] !== '\n') this.clearCurrentLineText();
        i++;
        continue;
      }
      if (c === '\x07') { i++; continue; }
      buf += c;
      i++;
    }
    emit();
  }

  clearCurrentLineText() {
    for (const n of [...this.currentLine.childNodes]) if (n !== this.inputRow) n.remove();
  }

  breakLine() {
    // Everything before the input row stays on this line; start a new line holding the input row.
    const next = this.newLine();
    next.appendChild(this.inputRow);
    this.currentLine = next;
  }

  appendText(text) {
    const s = this.style;
    const hasStyle = s.fg || s.bg || s.bold || s.dim || s.italic || s.underline || s.inverse;
    const frag = document.createDocumentFragment();
    LINK_RE.lastIndex = 0;
    let last = 0;
    let m;
    const push = (t, link) => {
      if (!t) return;
      const span = document.createElement(link ? 'a' : 'span');
      span.textContent = t;
      if (hasStyle) {
        let fg = s.fg; let bg = s.bg;
        if (s.inverse) { const tmp = fg || 'var(--pgt-fg)'; fg = bg || 'var(--pgt-bg)'; bg = tmp; }
        if (fg) span.style.color = fg;
        if (bg) span.style.background = bg;
        if (s.bold) span.style.fontWeight = '700';
        if (s.dim) span.style.opacity = '0.7';
        if (s.italic) span.style.fontStyle = 'italic';
        if (s.underline) span.style.textDecoration = 'underline';
      }
      if (link) {
        span.className = 'pgt-link';
        span.href = '#';
        span.dataset.file = link.file;
        span.dataset.line = link.line;
        span.dataset.col = link.col || 1;
        span.title = 'Open in editor';
      }
      frag.appendChild(span);
    };
    if (this.onLink && text.length < 2000) {
      while ((m = LINK_RE.exec(text))) {
        push(text.slice(last, m.index));
        push(m[0], { file: m[1].replace(/^\/workspace\//, ''), line: m[2], col: m[3] });
        last = m.index + m[0].length;
      }
    }
    push(text.slice(last));
    this.currentLine.insertBefore(frag, this.inputRow);
  }

  applySgr(params) {
    const codes = (params || '0').split(';').map((x) => parseInt(x || '0', 10));
    const light = this.isLight();
    const pal = light ? FG_LIGHT : FG;
    const palB = light ? FG_BRIGHT_LIGHT : FG_BRIGHT;
    for (let k = 0; k < codes.length; k++) {
      const c = codes[k];
      if (c === 0) this.style = {};
      else if (c === 1) this.style.bold = true;
      else if (c === 2) this.style.dim = true;
      else if (c === 3) this.style.italic = true;
      else if (c === 4) this.style.underline = true;
      else if (c === 7) this.style.inverse = true;
      else if (c === 22) { this.style.bold = false; this.style.dim = false; }
      else if (c === 23) this.style.italic = false;
      else if (c === 24) this.style.underline = false;
      else if (c === 27) this.style.inverse = false;
      else if (c >= 30 && c <= 37) this.style.fg = pal[c - 30];
      else if (c === 39) this.style.fg = null;
      else if (c >= 40 && c <= 47) this.style.bg = pal[c - 40];
      else if (c === 49) this.style.bg = null;
      else if (c >= 90 && c <= 97) this.style.fg = palB[c - 90];
      else if (c >= 100 && c <= 107) this.style.bg = palB[c - 100];
      else if ((c === 38 || c === 48) && codes[k + 1] === 5) {
        const n = codes[k + 2];
        const col = n < 8 ? pal[n] : n < 16 ? palB[n - 8] : xterm256(n);
        if (c === 38) this.style.fg = col; else this.style.bg = col;
        k += 2;
      } else if ((c === 38 || c === 48) && codes[k + 1] === 2) {
        const col = `rgb(${codes[k + 2]},${codes[k + 3]},${codes[k + 4]})`;
        if (c === 38) this.style.fg = col; else this.style.bg = col;
        k += 4;
      }
    }
  }

  clear() {
    this.pending = '';
    this.screen.innerHTML = '';
    this.lineCount = 0;
    this.currentLine = this.newLine();
    this.currentLine.appendChild(this.inputRow);
    this.style = {};
  }

  /** Show an image (e.g. a matplotlib figure) inline. */
  image(src, alt = 'figure') {
    this.flush();
    const img = document.createElement('img');
    img.className = 'pgt-image';
    img.src = src;
    img.alt = alt;
    this.currentLine.insertBefore(img, this.inputRow);
    this.breakLine();
    img.addEventListener('load', () => this.scrollToBottom(), { once: true });
  }

  /* ---------------- prompt & input ---------------- */

  setPrompt(ansi) {
    this.promptText = ansi;
    this.promptEl.innerHTML = '';
    const save = this.style;
    this.style = {};
    // Render prompt with colours into promptEl
    const holder = this.currentLine;
    const tmpLine = document.createElement('div');
    this.currentLine = tmpLine;
    tmpLine.appendChild(this.inputRow);
    this.render(ansi);
    for (const n of [...tmpLine.childNodes]) if (n !== this.inputRow) this.promptEl.appendChild(n);
    this.currentLine = holder;
    holder.appendChild(this.inputRow);
    this.style = save;
  }

  showPrompt(show) {
    this.promptEl.hidden = !show;
  }

  focus() {
    if (this.disposed) return;
    try { this.input.focus({ preventScroll: true }); } catch { this.input.focus(); }
  }

  /** Read one line typed by the user while a program runs. Resolves null on Ctrl+D. */
  readLine() {
    this.flush();
    if (this.inputQueue.length) return Promise.resolve(this.inputQueue.shift());
    this.showPrompt(false);
    this.input.classList.add('is-program');
    this.scrollToBottom();
    this.focus();
    return new Promise((resolve) => this.inputWaiters.push(resolve));
  }

  queueTyped(line) {
    if (this.inputWaiters.length) {
      this.echo(line);
      this.inputWaiters.shift()(line);
    } else this.inputQueue.push(line);
  }

  echo(line) {
    const span = document.createElement('span');
    span.className = 'pgt-typed';
    span.textContent = line;
    this.currentLine.insertBefore(span, this.inputRow);
    this.breakLine();
  }

  setBusy(busy) {
    this.busy = busy;
    this.host.classList.toggle('is-busy', busy);
    if (!busy) {
      // Drop unread keystrokes and fail any waiting reads.
      this.inputQueue = [];
      const w = this.inputWaiters.splice(0);
      w.forEach((r) => r(null));
      this.input.classList.remove('is-program');
      this.showPrompt(true);
      this.setPrompt(this.promptText);
    }
  }

  submit() {
    const value = this.input.value;
    this.input.value = '';
    this.hideHint();
    if (this.busy) {
      this.flush();
      if (this.inputWaiters.length) { this.echo(value); this.inputWaiters.shift()(value); } else { this.echo(value); this.inputQueue.push(value); }
      return;
    }
    // Echo prompt + command as a finished line
    this.flush();
    const clone = this.promptEl.cloneNode(true);
    clone.className = 'pgt-prompt-echo';
    this.currentLine.insertBefore(clone, this.inputRow);
    this.echo(value);
    if (value.trim()) {
      if (this.history[this.history.length - 1] !== value) this.history.push(value);
      if (this.history.length > 500) this.history.shift();
    }
    this.histIdx = -1;
    this.draft = '';
    this.run(value);
  }

  async run(line) {
    if (!this.onCommand) return;
    this.setBusy(true);
    this.showPrompt(false);
    try { await this.onCommand(line); } catch (err) { this.writeln(`\x1b[31m${err?.message || err}\x1b[0m`); }
    this.flush();
    this.setBusy(false);
    this.scrollToBottom();
  }

  /** Programmatically run a command as if typed (used by the Run button). */
  async type(line, { echo = true } = {}) {
    if (this.busy) return false;
    if (echo) {
      this.flush();
      const clone = this.promptEl.cloneNode(true);
      clone.className = 'pgt-prompt-echo';
      this.currentLine.insertBefore(clone, this.inputRow);
      this.echo(line);
    }
    if (line.trim() && this.history[this.history.length - 1] !== line) this.history.push(line);
    await this.run(line);
    return true;
  }

  onKey(e) {
    const k = e.key;
    if (k === 'Enter') { e.preventDefault(); this.submit(); return; }
    if ((e.ctrlKey || e.metaKey) && (k === 'c' || k === 'C') && !(e.metaKey && window.getSelection?.()?.toString())) {
      if (this.input.selectionStart !== this.input.selectionEnd && !this.busy) return; // allow copy
      e.preventDefault();
      if (this.busy) { this.flush(); this.write('^C\n'); this.onInterrupt?.(); }
      else { this.flush(); this.write(`${this.input.value}^C\n`); this.input.value = ''; this.hideHint(); }
      return;
    }
    if (e.ctrlKey && (k === 'd' || k === 'D')) {
      e.preventDefault();
      if (this.busy && this.inputWaiters.length && !this.input.value) { this.write('^D\n'); this.inputWaiters.shift()(null); }
      return;
    }
    if (e.ctrlKey && (k === 'l' || k === 'L')) { e.preventDefault(); this.clear(); return; }
    if (e.ctrlKey && (k === 'u' || k === 'U')) { e.preventDefault(); this.input.value = this.input.value.slice(this.input.selectionStart); this.input.setSelectionRange(0, 0); return; }
    if (e.ctrlKey && (k === 'a' || k === 'A') && !this.busy) { e.preventDefault(); this.input.setSelectionRange(0, 0); return; }
    if (e.ctrlKey && (k === 'e' || k === 'E')) { e.preventDefault(); const n = this.input.value.length; this.input.setSelectionRange(n, n); return; }
    if (e.ctrlKey && (k === 'w' || k === 'W')) {
      e.preventDefault();
      const pos = this.input.selectionStart;
      const before = this.input.value.slice(0, pos).replace(/\S+\s*$/, '');
      this.input.value = before + this.input.value.slice(pos);
      this.input.setSelectionRange(before.length, before.length);
      return;
    }
    if (this.busy) return;
    if (k === 'ArrowUp') {
      e.preventDefault();
      if (!this.history.length) return;
      if (this.histIdx === -1) { this.draft = this.input.value; this.histIdx = this.history.length - 1; } else if (this.histIdx > 0) this.histIdx--;
      this.input.value = this.history[this.histIdx];
      const n = this.input.value.length;
      requestAnimationFrame?.(() => this.input.setSelectionRange(n, n));
      return;
    }
    if (k === 'ArrowDown') {
      e.preventDefault();
      if (this.histIdx === -1) return;
      if (this.histIdx < this.history.length - 1) { this.histIdx++; this.input.value = this.history[this.histIdx]; } else { this.histIdx = -1; this.input.value = this.draft; }
      return;
    }
    if (k === 'Tab') {
      e.preventDefault();
      this.tabComplete();
      return;
    }
    if (k === 'Escape') { this.hideHint(); }
  }

  tabComplete() {
    if (!this.completeFn) return;
    const line = this.input.value;
    const cursor = this.input.selectionStart ?? line.length;
    const res = this.completeFn(line, cursor);
    if (!res || !res.candidates.length) { this.hideHint(); return; }
    const before = line.slice(0, res.replaceFrom);
    const after = line.slice(cursor);
    if (res.candidates.length === 1) {
      const c = res.candidates[0];
      const next = before + c + (c.endsWith('/') ? '' : ' ') + after;
      this.input.value = next;
      const pos = (before + c).length + (c.endsWith('/') ? 0 : 1);
      this.input.setSelectionRange(pos, pos);
      this.hideHint();
      return;
    }
    if (res.common.length > (line.slice(res.replaceFrom, cursor)).length) {
      this.input.value = before + res.common + after;
      const pos = (before + res.common).length;
      this.input.setSelectionRange(pos, pos);
    }
    this.showHint(res.candidates);
  }

  showHint(list) {
    this.hint.textContent = list.slice(0, 60).join('   ') + (list.length > 60 ? `   … ${list.length - 60} more` : '');
    this.hint.hidden = false;
  }

  hideHint() { this.hint.hidden = true; }

  dispose() {
    this.disposed = true;
    this.setBusy(false);
    this.host.innerHTML = '';
  }

  /** Plain text of the whole screen (for the assistant / copy). */
  text() {
    this.flush();
    return this.screen.innerText;
  }
}

/** Strip ANSI codes. */
export function stripAnsi(s) { return String(s).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, ''); }
