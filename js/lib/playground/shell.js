/* ============================================================
   Code Playground shell.

   A small POSIX-flavoured shell over the workspace file system:
     quoting ('single', "double $VAR", back\slash), $VAR / ${VAR} / $?,
     $(command substitution), ~, globs (*.js, src/**\/*.ts),
     pipelines (a | b), redirection (> >> < 2> 2>&1 &>),
     lists (a && b || c; d) and comments (# ...).
   Commands are async functions registered by name; each receives a
   context with args, stdin/stdout/stderr, the file system and an
   AbortSignal wired to Ctrl+C.
   ============================================================ */

import { resolve as resolvePath, normalize, toDisplay, dirname, basename, globToRegExp } from './paths.js';

export const ANSI = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m', italic: '\x1b[3m', underline: '\x1b[4m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', gray: '\x1b[90m',
  bred: '\x1b[91m', bgreen: '\x1b[92m', byellow: '\x1b[93m', bblue: '\x1b[94m', bcyan: '\x1b[96m',
};
export const color = (c, s) => `${ANSI[c] || ''}${s}${ANSI.reset}`;

export class ShellError extends Error {
  constructor(message, code = 1) { super(message); this.name = 'ShellError'; this.exitCode = code; }
}

export class ExitSignal extends Error {
  constructor(code = 0) { super(`exit ${code}`); this.name = 'ExitSignal'; this.exitCode = code; }
}

/* ============================================================
   Tokenizer & parser
   ============================================================ */

const OPS = ['&&', '||', '>>', '2>>', '2>&1', '&>', '2>', '>', '<', '|', ';', '&'];

/**
 * Split a command line into tokens. Words keep quote information so
 * expansion knows what may be globbed. Returns [{type:'word', parts:[{text, quoted:'"'|"'"|null}]}, {type:'op', value}]
 */
export function tokenize(line) {
  const tokens = [];
  let i = 0;
  const n = line.length;
  let word = null;
  const pushPart = (text, quoted) => {
    if (!word) word = { type: 'word', parts: [] };
    const last = word.parts[word.parts.length - 1];
    if (last && last.quoted === quoted && !quoted) last.text += text;
    else word.parts.push({ text, quoted });
  };
  const endWord = () => { if (word) { tokens.push(word); word = null; } };

  while (i < n) {
    const c = line[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { endWord(); i++; continue; }
    if (c === '#' && !word) break; // comment
    // operators (longest first) — "2>" only counts at word start
    const op = OPS.slice().sort((a, b) => b.length - a.length).find((o) => line.startsWith(o, i) && (!/^\d/.test(o) || !word));
    if (op) { endWord(); tokens.push({ type: 'op', value: op }); i += op.length; continue; }
    if (c === "'") {
      const end = line.indexOf("'", i + 1);
      if (end === -1) throw new ShellError('syntax error: unterminated quote', 2);
      pushPart(line.slice(i + 1, end), "'");
      i = end + 1;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let buf = '';
      while (j < n && line[j] !== '"') {
        if (line[j] === '\\' && j + 1 < n && '"\\$`\n'.includes(line[j + 1])) { buf += line[j + 1]; j += 2; continue; }
        if (line[j] === '$' && line[j + 1] === '(') {
          const end = matchParen(line, j + 1);
          buf += line.slice(j, end + 1);
          j = end + 1;
          continue;
        }
        buf += line[j++];
      }
      if (j >= n) throw new ShellError('syntax error: unterminated quote', 2);
      pushPart(buf, '"');
      i = j + 1;
      continue;
    }
    if (c === '\\') {
      if (i + 1 < n) pushPart(line[i + 1], "'");
      i += 2;
      continue;
    }
    if (c === '$' && line[i + 1] === '(') {
      const end = matchParen(line, i + 1);
      pushPart(line.slice(i, end + 1), null);
      i = end + 1;
      continue;
    }
    pushPart(c, null);
    i++;
  }
  endWord();
  return tokens;
}

function matchParen(s, open) {
  let depth = 0;
  for (let k = open; k < s.length; k++) {
    if (s[k] === '(') depth++;
    else if (s[k] === ')') { depth--; if (depth === 0) return k; }
    else if (s[k] === "'") { const e = s.indexOf("'", k + 1); if (e === -1) break; k = e; }
  }
  throw new ShellError('syntax error: unmatched (', 2);
}

/**
 * Parse tokens into a list: [{ pipeline:[{words, redirects}], op:'&&'|'||'|';'|'&'|null }]
 */
export function parse(tokens) {
  const list = [];
  let pipeline = [];
  let cmd = { words: [], redirects: [] };
  const endCmd = () => {
    if (cmd.words.length || cmd.redirects.length) pipeline.push(cmd);
    else if (pipeline.length) throw new ShellError('syntax error near unexpected token', 2);
    cmd = { words: [], redirects: [] };
  };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'word') { cmd.words.push(t); continue; }
    const v = t.value;
    if (['>', '>>', '<', '2>', '2>>', '&>'].includes(v)) {
      const target = tokens[i + 1];
      if (!target || target.type !== 'word') throw new ShellError(`syntax error near unexpected token \`${v}'`, 2);
      cmd.redirects.push({ op: v, target });
      i++;
      continue;
    }
    if (v === '2>&1') { cmd.redirects.push({ op: '2>&1' }); continue; }
    if (v === '|') {
      if (!cmd.words.length) throw new ShellError("syntax error near unexpected token `|'", 2);
      endCmd();
      continue;
    }
    // list operators
    endCmd();
    if (!pipeline.length) {
      if (v === ';' && !list.length) continue;
      throw new ShellError(`syntax error near unexpected token \`${v}'`, 2);
    }
    list.push({ pipeline, op: v });
    pipeline = [];
  }
  endCmd();
  if (pipeline.length) list.push({ pipeline, op: null });
  return list;
}

/* ============================================================
   Streams
   ============================================================ */

/** Collects output into a string. */
export class BufferStream {
  constructor() { this.data = ''; }
  write(s) { this.data += String(s ?? ''); }
  toString() { return this.data; }
}

/** Reads from a fixed string (used for pipes, here-strings and files). */
export class StringInput {
  constructor(text = '') { this.text = String(text ?? ''); this.pos = 0; this.isTTY = false; }
  async readLine() {
    if (this.pos >= this.text.length) return null;
    const nl = this.text.indexOf('\n', this.pos);
    const end = nl === -1 ? this.text.length : nl;
    const line = this.text.slice(this.pos, end);
    this.pos = nl === -1 ? this.text.length : nl + 1;
    return line;
  }
  async readAll() { const s = this.text.slice(this.pos); this.pos = this.text.length; return s; }
  async read() { return this.readAll(); }
}

/** No input at all (EOF immediately). */
export const EMPTY_INPUT = { isTTY: false, async readLine() { return null; }, async readAll() { return ''; }, async read() { return ''; } };

/* ============================================================
   Flag parsing
   ============================================================ */

/**
 * parseArgs(['-rf', '--name=x', '-n', '5', 'a'], { boolean: ['r','f'], string: ['n','name'], alias: {recursive:'r'} })
 * → { flags: {r:true,f:true,name:'x',n:'5'}, positional:['a'] }
 */
export function parseArgs(args, { boolean = [], string = [], alias = {} } = {}) {
  const flags = {};
  const positional = [];
  const str = new Set(string);
  const canon = (k) => alias[k] || k;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') { positional.push(...args.slice(i + 1)); break; }
    if (a.startsWith('--') && a.length > 2) {
      const eq = a.indexOf('=');
      const key = canon(eq === -1 ? a.slice(2) : a.slice(2, eq));
      if (eq !== -1) flags[key] = a.slice(eq + 1);
      else if (str.has(key) && i + 1 < args.length) flags[key] = args[++i];
      else flags[key] = true;
      continue;
    }
    if (a.startsWith('-') && a.length > 1 && !/^-\d/.test(a)) {
      const chars = a.slice(1);
      for (let k = 0; k < chars.length; k++) {
        const key = canon(chars[k]);
        if (str.has(key)) {
          const rest = chars.slice(k + 1);
          flags[key] = rest || args[++i];
          break;
        }
        flags[key] = true;
      }
      continue;
    }
    if (/^-\d+$/.test(a) && str.has('n')) { flags.n = a.slice(1); continue; }
    positional.push(a);
  }
  return { flags, positional };
}

/* ============================================================
   Shell
   ============================================================ */

export class Shell {
  /**
   * @param {object} opts
   * @param {import('./vfs.js').WorkspaceFS} opts.vfs
   * @param {object} [opts.host] integration hooks (openFile, preview, workspaceName, ...)
   */
  constructor({ vfs, host = {}, env = {} } = {}) {
    this.vfs = vfs;
    this.host = host;
    this.cwd = '';
    this.prevCwd = '';
    this.lastStatus = 0;
    this.commands = new Map();
    this.aliases = new Map([['ll', 'ls -la'], ['la', 'ls -a'], ['cls', 'clear'], ['python3', 'python'], ['pip3', 'pip'], ['c++', 'g++'], ['cc', 'gcc'], ['clang++', 'g++'], ['clang', 'gcc']]);
    this.history = [];
    this.env = {
      HOME: '/workspace', USER: 'student', SHELL: '/bin/tsh', TERM: 'xterm-256color', LANG: 'en_US.UTF-8',
      PATH: '/usr/local/bin:/usr/bin:/bin:/workspace/node_modules/.bin', NODE_ENV: 'development', ...env,
    };
  }

  register(name, fn, meta = {}) {
    this.commands.set(name, { fn, ...meta, name });
    return this;
  }

  has(name) { return this.commands.has(name) || this.aliases.has(name); }

  get displayCwd() { return toDisplay(this.cwd); }

  resolve(p) { return resolvePath(this.cwd, p); }

  prompt() {
    const branch = this.host.gitBranch?.();
    const dir = this.cwd ? `~/${this.cwd}` : '~';
    return `${ANSI.bgreen}student${ANSI.reset}:${ANSI.bblue}${dir}${ANSI.reset}${branch ? ` ${ANSI.magenta}(${branch})${ANSI.reset}` : ''}$ `;
  }

  /* ---------------- expansion ---------------- */

  async expandWord(word, io) {
    // Returns an array of resulting words (globs may produce many).
    let text = '';
    let globbable = false;
    for (const part of word.parts) {
      if (part.quoted === "'") { text += escapeGlob(part.text); continue; }
      let expanded = await this.expandVars(part.text, io);
      if (part.quoted === '"') { text += escapeGlob(expanded); continue; }
      if (/^~(?=\/|$)/.test(expanded) && part === word.parts[0]) expanded = '/workspace' + expanded.slice(1);
      if (/[*?[]/.test(expanded)) globbable = true;
      text += expanded;
    }
    if (globbable) {
      const matches = this.glob(text);
      if (matches.length) return matches;
    }
    return [unescapeGlob(text)];
  }

  async expandVars(s, io) {
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c !== '$') { out += c; continue; }
      const next = s[i + 1];
      if (next === '(') {
        const end = matchParen(s, i + 1);
        const inner = s.slice(i + 2, end);
        const buf = new BufferStream();
        await this.execute(inner, { stdout: buf, stderr: io?.stderr || new BufferStream(), stdin: EMPTY_INPUT, signal: io?.signal });
        out += buf.toString().replace(/\n+$/, '');
        i = end;
        continue;
      }
      if (next === '?') { out += String(this.lastStatus); i++; continue; }
      if (next === '{') {
        const end = s.indexOf('}', i);
        if (end === -1) { out += c; continue; }
        out += this.env[s.slice(i + 2, end)] ?? '';
        i = end;
        continue;
      }
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i + 1));
      if (m) { out += this.getVar(m[0]); i += m[0].length; continue; }
      out += c;
    }
    return out;
  }

  getVar(name) {
    if (name === 'PWD') return this.displayCwd;
    if (name === 'OLDPWD') return toDisplay(this.prevCwd);
    if (name === 'RANDOM') return String(Math.floor(Math.random() * 32768));
    return this.env[name] ?? '';
  }

  glob(pattern) {
    const abs = pattern.startsWith('/');
    const full = this.resolve(pattern.replace(/\\([*?[\]])/g, '$1'));
    const re = globToRegExp(full);
    const candidates = [...this.vfs.listFiles(), ...this.vfs.listDirs()];
    const wantHidden = basename(pattern).startsWith('.');
    const hits = candidates.filter((p) => re.test(p) && (wantHidden || !p.split('/').some((seg) => seg.startsWith('.'))));
    const uniq = [...new Set(hits)].sort();
    return uniq.map((p) => (abs ? toDisplay(p) : relativeFromCwd(this.cwd, p)));
  }

  /* ---------------- execution ---------------- */

  /**
   * Run a full command line.
   * @param {string} line
   * @param {{stdout, stderr, stdin, signal}} io
   * @returns {Promise<number>} exit status
   */
  async execute(line, io) {
    const text = String(line ?? '');
    if (!text.trim()) return this.lastStatus;
    let list;
    try {
      list = parse(tokenize(text));
    } catch (err) {
      io.stderr.write(`tsh: ${err.message}\n`);
      this.lastStatus = err.exitCode ?? 2;
      return this.lastStatus;
    }
    let status = 0;
    let skip = false;
    for (let i = 0; i < list.length; i++) {
      const { pipeline, op } = list[i];
      if (!skip) {
        if (op === '&') {
          // Background: start and don't wait (dev servers, watchers).
          this.runPipeline(pipeline, { ...io, background: true }).then((s) => { this.lastStatus = s; }).catch(() => {});
          status = 0;
        } else {
          status = await this.runPipeline(pipeline, io);
        }
        this.lastStatus = status;
      }
      if (io.signal?.aborted) return 130;
      if (op === '&&') skip = status !== 0;
      else if (op === '||') skip = status === 0;
      else skip = false;
    }
    return status;
  }

  async runPipeline(pipeline, io) {
    let input = io.stdin || EMPTY_INPUT;
    let status = 0;
    for (let i = 0; i < pipeline.length; i++) {
      const last = i === pipeline.length - 1;
      const out = last ? io.stdout : new BufferStream();
      status = await this.runCommand(pipeline[i], { ...io, stdin: input, stdout: out, piped: !last || pipeline.length > 1 });
      if (io.signal?.aborted) return 130;
      if (!last) input = new StringInput(out.toString());
    }
    return status;
  }

  async runCommand(cmd, io) {
    // Expand words
    let words = [];
    for (const w of cmd.words) words.push(...(await this.expandWord(w, io)));

    // Variable assignments like FOO=bar (alone or prefixing a command)
    const assigns = {};
    while (words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])) {
      const eq = words[0].indexOf('=');
      assigns[words[0].slice(0, eq)] = words[0].slice(eq + 1);
      words.shift();
    }
    if (!words.length) {
      Object.assign(this.env, assigns);
      return 0;
    }

    // Aliases (first word only, single level + one nested)
    for (let depth = 0; depth < 3 && this.aliases.has(words[0]); depth++) {
      const expansion = this.aliases.get(words[0]);
      const extra = [];
      for (const t of tokenize(expansion)) if (t.type === 'word') extra.push(...(await this.expandWord(t, io)));
      words = [...extra, ...words.slice(1)];
    }

    // Redirections
    let stdout = io.stdout;
    let stderr = io.stderr;
    let stdin = io.stdin;
    const fileOutputs = [];
    try {
      for (const r of cmd.redirects) {
        if (r.op === '2>&1') { stderr = stdout; continue; }
        const [target] = await this.expandWord(r.target, io);
        const path = this.resolve(target);
        if (r.op === '<') {
          if (target === '/dev/null') { stdin = EMPTY_INPUT; continue; }
          stdin = new StringInput(this.vfs.readFile(path));
        } else if (target === '/dev/null') {
          const sink = { write() {} };
          if (r.op === '2>' || r.op === '2>>') stderr = sink;
          else if (r.op === '&>') { stdout = sink; stderr = sink; } else stdout = sink;
        } else {
          if (this.vfs.isDir(path)) throw new ShellError(`${target}: Is a directory`);
          if (!this.vfs.isDir(dirname(path))) throw new ShellError(`${target}: No such file or directory`);
          const buf = new BufferStream();
          const append = r.op === '>>' || r.op === '2>>';
          fileOutputs.push({ path, buf, append });
          if (r.op === '2>' || r.op === '2>>') stderr = buf;
          else if (r.op === '&>') { stdout = buf; stderr = buf; } else stdout = buf;
        }
      }
    } catch (err) {
      io.stderr.write(`tsh: ${err.message.replace(/^E[A-Z]+: /, '')}\n`);
      return 1;
    }

    const [name, ...args] = words;
    const saved = {};
    for (const [k, v] of Object.entries(assigns)) { saved[k] = this.env[k]; this.env[k] = v; }
    let status;
    try {
      status = await this.invoke(name, args, { ...io, stdout, stderr, stdin });
    } finally {
      for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete this.env[k]; else this.env[k] = v; }
      for (const f of fileOutputs) {
        try {
          const prev = f.append && this.vfs.isFile(f.path) ? this.vfs.readFile(f.path) : '';
          this.vfs.writeFile(f.path, prev + f.buf.toString());
        } catch (err) {
          io.stderr.write(`tsh: ${f.path}: ${err.message}\n`);
        }
      }
    }
    return status;
  }

  /** Invoke a command by name with already-expanded args. */
  async invoke(name, args, io) {
    const entry = this.commands.get(name);
    const ctx = {
      name, args, shell: this, vfs: this.vfs, host: this.host, env: this.env,
      stdout: io.stdout, stderr: io.stderr, stdin: io.stdin || EMPTY_INPUT, signal: io.signal,
      piped: Boolean(io.piped), background: Boolean(io.background), terminal: io.terminal || null,
      get cwd() { return this.shell.cwd; },
      resolve: (p) => this.resolve(p),
      out: (s = '') => io.stdout.write(s),
      outln: (s = '') => io.stdout.write(`${s}\n`),
      err: (s = '') => io.stderr.write(`${name}: ${s}\n`),
    };
    if (!entry) {
      // Executables in the workspace: ./a.out, ./script.sh, ./app
      if (name.includes('/')) {
        const p = this.resolve(name);
        if (this.host.runExecutable && this.vfs.isFile(p)) return this.host.runExecutable(p, args, ctx);
        io.stderr.write(`tsh: ${name}: No such file or directory\n`);
        return 127;
      }
      const suggestion = this.suggest(name);
      io.stderr.write(`tsh: command not found: ${name}${suggestion ? ` (did you mean ${color('bold', suggestion)}?)` : ''}\n`);
      if (!suggestion) io.stderr.write(`Type ${color('bold', 'help')} to see available commands.\n`);
      return 127;
    }
    try {
      const status = await entry.fn(ctx);
      return typeof status === 'number' ? status : 0;
    } catch (err) {
      if (err instanceof ExitSignal) return err.exitCode;
      if (err?.name === 'AbortError' || io.signal?.aborted) return 130;
      const msg = err instanceof ShellError ? err.message : (err?.code && err.path ? err.message : (err?.message || String(err)));
      io.stderr.write(`${name}: ${msg}\n`);
      return err?.exitCode ?? 1;
    }
  }

  suggest(name) {
    const all = [...this.commands.keys(), ...this.aliases.keys()];
    let best = null;
    let bestD = 3;
    for (const c of all) {
      const d = levenshtein(name, c);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  /* ---------------- completion ---------------- */

  /**
   * Tab completion. Returns { replaceFrom, candidates, common }.
   */
  complete(line, cursor = line.length) {
    const before = line.slice(0, cursor);
    const m = /(?:^|[\s|;&<>])([^\s|;&<>]*)$/.exec(before);
    const word = m ? m[1] : '';
    const replaceFrom = cursor - word.length;
    const isFirst = !before.slice(0, replaceFrom).trim() || /[|;&]\s*$/.test(before.slice(0, replaceFrom));
    let candidates = [];
    if (isFirst && !word.includes('/')) {
      candidates = [...new Set([...this.commands.keys(), ...this.aliases.keys()])].filter((c) => c.startsWith(word)).sort();
      // also executables in cwd
    } else {
      const slash = word.lastIndexOf('/');
      const dirPart = slash === -1 ? '' : word.slice(0, slash + 1);
      const namePart = slash === -1 ? word : word.slice(slash + 1);
      const dir = this.resolve(dirPart || '.');
      try {
        candidates = this.vfs.readdir(dir)
          .filter((e) => e.name.startsWith(namePart) && (namePart.startsWith('.') || !e.name.startsWith('.')))
          .map((e) => dirPart + e.name + (e.type === 'dir' ? '/' : ''));
      } catch { candidates = []; }
    }
    const common = candidates.length ? commonPrefix(candidates) : word;
    return { replaceFrom, word, candidates, common };
  }
}

function escapeGlob(s) { return s.replace(/[*?[\]\\]/g, '\\$&'); }
function unescapeGlob(s) { return s.replace(/\\([*?[\]\\])/g, '$1'); }

function relativeFromCwd(cwd, p) {
  if (!cwd) return p;
  if (p.startsWith(`${cwd}/`)) return p.slice(cwd.length + 1);
  const up = cwd.split('/').map(() => '..');
  return `${up.join('/')}/${p}`;
}

function commonPrefix(list) {
  let p = list[0] || '';
  for (const s of list) while (!s.startsWith(p)) p = p.slice(0, -1);
  return p;
}

export function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

export { normalize, dirname, basename };
