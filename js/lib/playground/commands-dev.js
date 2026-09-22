/* ============================================================
   Developer tool commands for the playground terminal:
     node, npm, npx, vite, vitest/jest, tsc, ts-node/tsx
     python, pip, pytest
     g++ / gcc / clang, ./program, javac/java, go, rustc, php, ruby, ...
     sqlite3, lua, bash/sh scripts, curl, run, preview, ps/kill, zip/unzip
   Everything executes in the browser except remote compilers, which
   say so when they are used.
   ============================================================ */

import { parseArgs, color, ANSI, ShellError, StringInput, BufferStream } from './shell.js';
import { normalize, basename, dirname, extname, resolve as resolvePath, toDisplay } from './paths.js';
import { languageOf, langInfo, isBinaryPath } from './languages.js';
import {
  attachWorker, workerUrl, cdn, collectFiles, scanImports, esmUrl, readDependencies, fetchPackageInfo, packageName,
  findTestFiles, pythonTestFiles, detectProject, syncBridgeReady, ensureSyncBridge, VIRTUAL_PACKAGES,
} from './runtimes.js';
import {
  interpreterBlockers, readsInput, buildTranslationUnit, mapLine, parseCompileArgs, makeExecutable, readExecutable, defaultOutputName, EXE_MAGIC,
} from './cpp.js';
import { compileAndRun, parseCompilerDiagnostics, rewriteProgName, REMOTE } from './wandbox.js';
import { createZip, extractZip } from '../archive-engine.js';
import { TEMPLATES, instantiateTemplate } from './templates.js';

const NODE_VERSION = 'v22.0.0';

/** io adapter for workers from a command context. */
function workerIo(ctx, host, { diagnosticsFor } = {}) {
  return {
    write: (s) => ctx.stdout.write(s),
    writeErr: (s) => ctx.stderr.write(s),
    readLine: () => (ctx.stdin?.readLine ? ctx.stdin.readLine() : Promise.resolve(null)),
    prompt: async (message) => { ctx.stdout.write(message ? `${message} ` : ''); return ctx.stdin?.readLine ? ctx.stdin.readLine() : null; },
    status: (t) => host.status?.(t),
    image: (m) => host.showImage?.(m),
    clear: () => host.clearTerminal?.(),
    signal: ctx.signal,
  };
}

function reportErrors(host, errors, { source } = {}) {
  host.setDiagnostics?.(source || 'run', errors.filter((e) => e.file || e.line).map((e) => ({
    file: e.file, line: e.line || 1, column: e.column || 1, message: e.message || '', severity: 'error', source: source || 'run',
  })));
}

/* pytest when it can be installed (micropip), otherwise a small built-in
   runner with the parts of pytest students use (plain asserts, raises,
   approx, parametrize, simple fixtures) so tests still run offline. */
const PYTEST_BOOT = String.raw`import sys, os, types, importlib.util, traceback, inspect, time
async def _pg_pytest(args, files):
    try:
        import pytest
    except ImportError:
        pytest = None
        try:
            import micropip
            await micropip.install('pytest')
            import pytest
        except Exception:
            pytest = None
    if pytest is not None and getattr(pytest, '__pg_shim__', False) is False and hasattr(pytest, 'main'):
        return pytest.main(args)
    return _pg_mini(files, '-v' in args)

class _PgRaises:
    def __init__(self, exc, match=None):
        self.exc, self.match, self.value = exc, match, None
    def __enter__(self):
        return self
    def __exit__(self, t, v, tb):
        if t is None:
            raise AssertionError(f"DID NOT RAISE {self.exc}")
        if not issubclass(t, self.exc):
            return False
        if self.match:
            import re
            if not re.search(self.match, str(v)):
                raise AssertionError(f"Regex {self.match!r} does not match {str(v)!r}")
        self.value = v
        return True

class _PgApprox:
    def __init__(self, expected, rel=1e-6, abs=1e-12):
        self.e, self.rel, self.abs = expected, rel, abs
    def _close(self, a, b):
        return abs(a - b) <= max(self.rel * abs(b), self.abs)
    def __eq__(self, other):
        if isinstance(self.e, (list, tuple)):
            return len(other) == len(self.e) and all(self._close(a, b) for a, b in zip(other, self.e))
        return self._close(other, self.e)
    def __repr__(self):
        return f"approx({self.e!r})"

def _pg_shim():
    m = types.ModuleType('pytest')
    m.__pg_shim__ = True
    m.raises = lambda exc, match=None: _PgRaises(exc, match)
    m.approx = lambda e, rel=1e-6, abs=1e-12: _PgApprox(e, rel, abs)
    def fixture(fn=None, **kw):
        def mark(f):
            f._pg_fixture = True
            return f
        return mark(fn) if fn else mark
    m.fixture = fixture
    class _Mark:
        def parametrize(self, names, values, **kw):
            def deco(f):
                f._pg_params = ([n.strip() for n in names.split(',')] if isinstance(names, str) else list(names), list(values))
                return f
            return deco
        def __getattr__(self, name):
            return lambda *a, **k: (a[0] if a and callable(a[0]) else (lambda f: f))
    m.mark = _Mark()
    m.fail = lambda msg='': (_ for _ in ()).throw(AssertionError(msg))
    m.skip = lambda msg='': (_ for _ in ()).throw(RuntimeError('skip: ' + msg))
    sys.modules['pytest'] = m
    return m

def _pg_mini(files, verbose):
    _pg_shim()
    G, R, Y, B, D = '\x1b[32m', '\x1b[31m', '\x1b[33m', '\x1b[1m', '\x1b[0m'
    print(f"{B}==================== test session starts ===================={D}")
    print("(pytest couldn't be installed, so the built-in runner is used)")
    passed = failed = 0
    failures = []
    t0 = time.time()
    for path in files:
        rel = os.path.relpath(path)
        sys.path.insert(0, os.path.dirname(path))
        name = os.path.splitext(os.path.basename(path))[0]
        sys.modules.pop(name, None)
        try:
            spec = importlib.util.spec_from_file_location(name, path)
            mod = importlib.util.module_from_spec(spec)
            sys.modules[name] = mod
            spec.loader.exec_module(mod)
        except Exception:
            failed += 1
            failures.append((rel + ' (import)', traceback.format_exc()))
            print(f"{rel} {R}E{D}")
            continue
        fixtures = {k: v for k, v in vars(mod).items() if callable(v) and getattr(v, '_pg_fixture', False)}
        cases = []
        for k, v in vars(mod).items():
            if k.startswith('test') and callable(v) and not inspect.isclass(v):
                cases.append((k, v))
            elif k.startswith('Test') and inspect.isclass(v):
                for mk in dir(v):
                    if mk.startswith('test'):
                        cases.append((f"{k}::{mk}", getattr(v(), mk)))
        marks = ''
        for cname, fn in cases:
            runs = [((), {})]
            if hasattr(fn, '_pg_params'):
                names, values = fn._pg_params
                runs = [((), dict(zip(names, val if isinstance(val, (list, tuple)) and len(names) > 1 else [val]))) for val in values]
            for i, (a, kw) in enumerate(runs):
                label = cname + (f"[{i}]" if len(runs) > 1 else '')
                try:
                    params = inspect.signature(fn).parameters
                    for p in params:
                        if p not in kw and p in fixtures:
                            kw[p] = fixtures[p]()
                    fn(*a, **kw)
                    passed += 1
                    marks += f"{G}.{D}"
                    if verbose: print(f"{rel}::{label} {G}PASSED{D}")
                except Exception as e:
                    failed += 1
                    marks += f"{R}F{D}"
                    failures.append((f"{rel}::{label}", traceback.format_exc()))
                    if verbose: print(f"{rel}::{label} {R}FAILED{D}")
        if not verbose: print(f"{rel} {marks}")
    for name, tb in failures:
        print(f"\n{R}{B}_____ {name} _____{D}")
        print(tb.rstrip())
    dt = time.time() - t0
    summary = ', '.join(x for x in [f"{R}{failed} failed{D}" if failed else '', f"{G}{passed} passed{D}" if passed else ''] if x) or 'no tests ran'
    print(f"{B}============ {summary}{B} in {dt:.2f}s ============{D}")
    return 1 if failed else (0 if passed else 5)
`;

export function registerDevCommands(shell, host) {
  const vfs = shell.vfs;
  const reg = (name, fn, usage, desc, group = 'Developer tools') => shell.register(name, fn, { usage, desc, group });

  /* ================= Node.js ================= */

  async function runNode(ctx, { entry = null, argv = [], mode = 'run', evalCode = '', print = false, testFiles = [], cwd = shell.cwd } = {}) {
    if (typeof Worker === 'undefined') return runNodeInline(ctx, { mode, evalCode, print });
    // npm packages imported anywhere in the project are fetched up front.
    const root = projectRoot(cwd);
    const files = collectFiles(vfs, { under: '' });
    const deps = readDependencies(vfs, root);
    const sources = Object.entries(files).filter(([p]) => /\.[cm]?[jt]sx?$/.test(p)).map(([, c]) => c);
    if (evalCode) sources.push(evalCode);
    const specs = scanImports(sources);
    if (Object.keys(files).some((p) => /\.[jt]sx$/.test(p))) specs.push(deps.preact ? 'preact/jsx-runtime' : 'react/jsx-runtime');
    const packages = {};
    for (const s of specs) packages[s] = esmUrl(s, deps);
    const bridge = syncBridgeReady() || await ensureSyncBridge({ timeout: 1500 });
    const worker = new Worker(workerUrl('node-runtime.js'));
    const errors = [];
    const proc = attachWorker({
      worker,
      io: workerIo(ctx, host),
      vfs,
      onMessage: (m) => {
        if (m.type === 'listen') { host.registerServer?.(m.port, proc, ctx); return true; }
        if (m.type === 'close-server') { host.unregisterServer?.(m.port); return true; }
        if (m.type === 'http-response') { host.resolveServerResponse?.(m); return true; }
        if (m.type === 'test-report') { host.testReport?.(m.results); return true; }
        if (m.type === 'error') errors.push(m);
        return false;
      },
    });
    proc.post({
      type: 'run', mode, files, dirs: vfs.listDirs(), entry, argv, cwd, env: { ...shell.env, PWD: toDisplay(cwd) },
      packages, tsUrl: cdn('typescript'), syncBase: cdn('sync'), syncAvailable: bridge ? undefined : false,
      evalCode, print, testFiles,
    });
    const res = await proc.done;
    host.unregisterServersOf?.(proc);
    reportErrors(host, errors, { source: 'node' });
    return res.code;
  }

  /** Environments without Web Workers (server-side tests): evaluate simple code in-process. */
  async function runNodeInline(ctx, { mode, evalCode, print }) {
    if (mode !== 'eval') { ctx.err('node: running files needs a browser with Web Worker support'); return 1; }
    const fmt = (v) => (typeof v === 'string' ? v : (() => { try { return JSON.stringify(v); } catch { return String(v); } })());
    const out = (...a) => ctx.stdout.write(`${a.map(fmt).join(' ')}\n`);
    const errOut = (...a) => ctx.stderr.write(`${a.map(fmt).join(' ')}\n`);
    const fakeConsole = { log: out, info: out, debug: out, warn: errOut, error: errOut };
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('console', print ? `return (${evalCode});` : evalCode);
      const v = await fn(fakeConsole);
      if (print) out(v);
      return 0;
    } catch (e) {
      ctx.stderr.write(`${e?.name || 'Error'}: ${e?.message || e}\n`);
      return 1;
    }
  }

  function projectRoot(cwd) {
    let d = normalize(cwd);
    for (;;) {
      if (vfs.isFile(normalize(d ? `${d}/package.json` : 'package.json'))) return d;
      if (!d) return '';
      d = dirname(d);
    }
  }

  function resolveScript(ctx, file, exts = ['']) {
    for (const e of exts) {
      const p = ctx.resolve(file + e);
      if (vfs.isFile(p)) return p;
    }
    return null;
  }

  reg('node', async (ctx) => {
    const a = ctx.args;
    if (a[0] === '-v' || a[0] === '--version') { ctx.outln(NODE_VERSION); return 0; }
    if (a[0] === '-e' || a[0] === '--eval') return runNode(ctx, { mode: 'eval', evalCode: a[1] || '', argv: a.slice(2) });
    if (a[0] === '-p' || a[0] === '--print') return runNode(ctx, { mode: 'eval', evalCode: a[1] || '', print: true, argv: a.slice(2) });
    if (a[0] === '--test') {
      const files = a.length > 1 ? a.slice(1).map((f) => ctx.resolve(f)) : findTestFiles(vfs);
      return runNode(ctx, { mode: 'test', testFiles: files });
    }
    const fileArg = a.find((x) => !x.startsWith('-'));
    if (!fileArg) return nodeRepl(ctx);
    const entry = resolveScript(ctx, fileArg, ['', '.js', '.mjs', '.cjs', '.ts', '/index.js']);
    if (!entry) {
      ctx.stderr.write(`node:internal/modules/cjs/loader\n  throw err;\n  ^\n\nError: Cannot find module '${toDisplay(ctx.resolve(fileArg))}'\n    code: 'MODULE_NOT_FOUND'\n\nNode.js ${NODE_VERSION}\n`);
      return 1;
    }
    return runNode(ctx, { entry, argv: a.slice(a.indexOf(fileArg) + 1) });
  }, 'node [file.js] [args] | -e code | -p expr', 'Run JavaScript/TypeScript with Node.js APIs (fs, readline, http, express…)');
  shell.aliases.set('nodejs', 'node');

  reg('ts-node', async (ctx) => {
    const file = ctx.args[0];
    if (!file) { ctx.err('usage: ts-node file.ts'); return 1; }
    const entry = resolveScript(ctx, file, ['', '.ts', '.tsx']);
    if (!entry) { ctx.err(`Cannot find file '${file}'`); return 1; }
    return runNode(ctx, { entry, argv: ctx.args.slice(1) });
  }, 'ts-node file.ts', 'Run a TypeScript file');
  shell.aliases.set('tsx', 'ts-node');
  shell.aliases.set('bun', 'node');
  shell.aliases.set('deno', 'node');

  async function nodeRepl(ctx) {
    ctx.outln(`Welcome to Node.js ${NODE_VERSION}.\nType ".help" for more information. ".exit" or Ctrl+D to leave.`);
    const files = collectFiles(vfs);
    const deps = readDependencies(vfs, projectRoot(shell.cwd));
    const packages = {};
    for (const s of scanImports(Object.values(files))) packages[s] = esmUrl(s, deps);
    await ensureSyncBridge({ timeout: 1500 });
    const worker = new Worker(workerUrl('node-runtime.js'));
    let wake = null;
    const proc = attachWorker({
      worker, io: workerIo(ctx, host), vfs,
      onMessage: (m) => { if (m.type === 'repl-ready' || m.type === 'repl-done') { wake?.(); return true; } return false; },
    });
    const next = () => new Promise((r) => { wake = r; });
    proc.post({ type: 'repl-init', files, dirs: vfs.listDirs(), cwd: shell.cwd, env: { ...shell.env }, packages, tsUrl: cdn('typescript'), syncBase: cdn('sync') });
    let ended = false;
    proc.done.then(() => { ended = true; wake?.(); });
    await next();
    let buffer = '';
    while (!ended) {
      ctx.stdout.write(buffer ? '... ' : '> ');
      const line = await ctx.stdin.readLine();
      if (line === null || ctx.signal?.aborted) break;
      const t = line.trim();
      if (!buffer && t === '.exit') break;
      if (!buffer && t === '.help') { ctx.outln('.break    Abort a multi-line expression\n.clear    (same as .break)\n.exit     Exit the REPL\n.help     Print this help message'); continue; }
      if (t === '.break' || t === '.clear') { buffer = ''; continue; }
      buffer += `${line}\n`;
      if (!balanced(buffer)) continue;
      const code = buffer;
      buffer = '';
      if (!code.trim()) continue;
      proc.post({ type: 'repl-eval', code });
      await next();
    }
    proc.kill();
    return 0;
  }
  function balanced(code) {
    let depth = 0;
    let q = null;
    for (let i = 0; i < code.length; i++) {
      const c = code[i];
      if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
      if (c === '"' || c === "'" || c === '`') q = c;
      else if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)) depth--;
    }
    return depth <= 0 && !q;
  }

  /* ================= npm / npx ================= */

  function readPkg(root) {
    const p = normalize(root ? `${root}/package.json` : 'package.json');
    if (!vfs.isFile(p)) return null;
    try { return { path: p, data: JSON.parse(vfs.readFile(p)) }; } catch (err) { throw new ShellError(`npm error code EJSONPARSE\nnpm error JSON.parse Invalid package.json: ${err.message}`); }
  }
  function writePkg(p, data) { vfs.writeFile(p, `${JSON.stringify(data, null, 2)}\n`); }

  async function npmInstall(ctx, names, { dev = false, root }) {
    const pkg = readPkg(root);
    if (!pkg) { ctx.stderr.write(`npm error code ENOENT\nnpm error enoent Could not read package.json: run "npm init -y" first.\n`); return 1; }
    const deps = pkg.data[dev ? 'devDependencies' : 'dependencies'] || {};
    if (!names.length) {
      const all = { ...(pkg.data.dependencies || {}), ...(pkg.data.devDependencies || {}) };
      const list = Object.keys(all);
      if (!list.length) { ctx.outln('\nup to date, audited 1 package in 0s\n\nfound 0 vulnerabilities'); return 0; }
      const started = Date.now();
      let ok = 0;
      for (const n of list) {
        if (VIRTUAL_PACKAGES.has(n)) { ok++; continue; }
        try { await fetchPackageInfo(`${n}@${String(all[n]).replace(/^[\^~]/, '')}`, { signal: ctx.signal }); ok++; } catch (err) { ctx.stderr.write(`npm warn ${n}: ${err.message}\n`); }
      }
      ctx.outln(`\nadded ${ok} package${ok === 1 ? '' : 's'}, and audited ${ok + 1} packages in ${((Date.now() - started) / 1000).toFixed(1)}s\n\nfound ${color('green', '0')} vulnerabilities`);
      ctx.outln(color('gray', 'Packages are loaded from esm.sh when your code imports them; nothing is stored in node_modules.'));
      return 0;
    }
    const started = Date.now();
    let added = 0;
    for (const raw of names) {
      const at = raw.lastIndexOf('@');
      const name = at > 0 ? raw.slice(0, at) : raw;
      if (VIRTUAL_PACKAGES.has(name)) {
        deps[name] = deps[name] || ({ express: '^4.21.2', cors: '^2.8.5', dotenv: '^16.4.7', 'body-parser': '^1.20.3', morgan: '^1.10.0', nodemon: '^3.1.9' }[name] || '*');
        added++;
        ctx.outln(color('gray', `${name}: provided by the playground runtime (runs in your browser)`));
        continue;
      }
      try {
        const info = await fetchPackageInfo(raw, { signal: ctx.signal });
        deps[info.name] = at > 0 && /^\d/.test(raw.slice(at + 1)) ? raw.slice(at + 1) : `^${info.version}`;
        if (info.deprecated) ctx.stderr.write(`npm warn deprecated ${info.name}@${info.version}: ${info.deprecated}\n`);
        added++;
      } catch (err) {
        if (err.name === 'AbortError') return 130;
        ctx.stderr.write(`npm error code ${err.code || 'E404'}\nnpm error ${err.message}\n`);
        return 1;
      }
    }
    pkg.data[dev ? 'devDependencies' : 'dependencies'] = sortObject(deps);
    writePkg(pkg.path, pkg.data);
    ctx.outln(`\nadded ${added} package${added === 1 ? '' : 's'} in ${((Date.now() - started) / 1000).toFixed(1)}s\n\nfound ${color('green', '0')} vulnerabilities`);
    return 0;
  }

  function sortObject(o) { return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b))); }

  async function runNpmScript(ctx, name, extra, root) {
    const pkg = readPkg(root);
    if (!pkg) { ctx.stderr.write('npm error Missing script: no package.json in this folder. Run "npm init -y".\n'); return 1; }
    const scripts = pkg.data.scripts || {};
    let script = scripts[name];
    if (!script) {
      if (name === 'start' && vfs.isFile(normalize(root ? `${root}/server.js` : 'server.js'))) script = 'node server.js';
      else if (name === 'test' && findTestFiles(vfs, root).length) script = 'vitest run';
      else {
        ctx.stderr.write(`npm error Missing script: "${name}"\nnpm error\nnpm error To see a list of scripts, run:\nnpm error   npm run\n`);
        return 1;
      }
    }
    ctx.outln(`\n> ${pkg.data.name || 'app'}@${pkg.data.version || '1.0.0'} ${name}\n> ${script}${extra.length ? ` ${extra.join(' ')}` : ''}\n`);
    const saveCwd = shell.cwd;
    shell.cwd = root;
    try {
      for (const pre of [`pre${name}`]) if (scripts[pre]) { const s = await shell.execute(scripts[pre], ctxIo(ctx)); if (s) return s; }
      const status = await shell.execute(`${script}${extra.length ? ` ${extra.map(quote).join(' ')}` : ''}`, ctxIo(ctx));
      if (!status && scripts[`post${name}`]) return shell.execute(scripts[`post${name}`], ctxIo(ctx));
      return status;
    } finally {
      if (shell.cwd === root) shell.cwd = saveCwd;
    }
  }
  const ctxIo = (ctx) => ({ stdout: ctx.stdout, stderr: ctx.stderr, stdin: ctx.stdin, signal: ctx.signal, terminal: ctx.terminal });
  const quote = (a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : `'${a.replace(/'/g, "'\\''")}'`);

  reg('npm', async (ctx) => {
    const [cmd, ...rest] = ctx.args;
    const root = projectRoot(shell.cwd);
    const { flags, positional } = parseArgs(rest, { alias: { 'save-dev': 'D', yes: 'y', global: 'g' } });
    switch (cmd) {
      case undefined: case 'help': case '-h':
        ctx.outln('npm <command>\n\nUsage:\n  npm init [-y]            create package.json\n  npm install [pkg...]     add dependencies (-D for dev)\n  npm uninstall <pkg>      remove a dependency\n  npm run <script>         run a package.json script\n  npm start | test         shortcuts for run start / run test\n  npm ls                   list dependencies\n  npm view <pkg>           show package info\n  npm search <words>       search the registry');
        return 0;
      case '-v': case '--version': ctx.outln('10.9.2'); return 0;
      case 'init': {
        const p = normalize(shell.cwd ? `${shell.cwd}/package.json` : 'package.json');
        if (vfs.isFile(p) && !flags.y && !flags.f) { ctx.outln('package.json already exists.'); return 0; }
        const name = (basename(shell.cwd) || host.workspaceName?.() || 'app').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[._]/, '') || 'app';
        const data = { name, version: '1.0.0', description: '', main: 'index.js', type: 'commonjs', scripts: { start: 'node index.js', test: 'vitest run' }, keywords: [], author: '', license: 'ISC' };
        writePkg(p, data);
        ctx.outln(`Wrote to ${toDisplay(p)}:\n\n${JSON.stringify(data, null, 2)}\n`);
        return 0;
      }
      case 'install': case 'i': case 'add': case 'ci':
        if (flags.g) { ctx.outln(color('gray', 'Global packages are not needed in the playground; tools like tsc, vite and vitest are built in.')); return 0; }
        return npmInstall(ctx, positional, { dev: Boolean(flags.D || flags['save-dev']), root });
      case 'uninstall': case 'remove': case 'rm': case 'un': {
        const pkg = readPkg(root);
        if (!pkg) { ctx.stderr.write('npm error no package.json\n'); return 1; }
        for (const n of positional) { delete pkg.data.dependencies?.[n]; delete pkg.data.devDependencies?.[n]; }
        writePkg(pkg.path, pkg.data);
        ctx.outln(`\nremoved ${positional.length} package${positional.length === 1 ? '' : 's'}`);
        return 0;
      }
      case 'ls': case 'list': {
        const pkg = readPkg(root);
        if (!pkg) { ctx.outln('(empty)'); return 0; }
        ctx.outln(`${pkg.data.name}@${pkg.data.version} ${toDisplay(root)}`);
        const all = [...Object.entries(pkg.data.dependencies || {}), ...Object.entries(pkg.data.devDependencies || {})];
        all.forEach(([n, v], i) => ctx.outln(`${i === all.length - 1 ? '└──' : '├──'} ${n}@${String(v).replace(/^[\^~]/, '')}`));
        if (!all.length) ctx.outln('└── (empty)');
        return 0;
      }
      case 'view': case 'info': case 'show': {
        if (!positional[0]) { ctx.err('npm view <package>'); return 1; }
        try {
          const info = await fetchPackageInfo(positional[0], { signal: ctx.signal });
          ctx.outln(`\n${color('bold', `${info.name}@${info.version}`)} | ${info.license || 'no license'} | deps: ${Object.keys(info.dependencies).length}`);
          if (info.description) ctx.outln(info.description);
          if (info.homepage) ctx.outln(color('cyan', info.homepage));
          const d = Object.entries(info.dependencies);
          if (d.length) ctx.outln(`\ndependencies:\n${d.slice(0, 20).map(([k, v]) => `${k}: ${v}`).join('\n')}`);
          return 0;
        } catch (err) { ctx.stderr.write(`npm error ${err.message}\n`); return 1; }
      }
      case 'search': case 's': case 'find': {
        const q = positional.join(' ');
        if (!q) { ctx.err('npm search <words>'); return 1; }
        try {
          const res = await fetch(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(q)}&size=10`, { signal: ctx.signal });
          const data = await res.json();
          ctx.outln(`${'NAME'.padEnd(26)}${'VERSION'.padEnd(12)}DESCRIPTION`);
          for (const o of data.objects || []) ctx.outln(`${o.package.name.slice(0, 25).padEnd(26)}${o.package.version.padEnd(12)}${(o.package.description || '').slice(0, 60)}`);
          return 0;
        } catch (err) { ctx.stderr.write(`npm error ${err.message}\n`); return 1; }
      }
      case 'run': case 'run-script': {
        if (!positional.length) {
          const pkg = readPkg(root);
          const scripts = pkg?.data.scripts || {};
          ctx.outln(`Scripts available in ${pkg?.data.name || 'this project'} via \`npm run\`:`);
          for (const [k, v] of Object.entries(scripts)) ctx.outln(`  ${k}\n    ${v}`);
          return 0;
        }
        const dd = rest.indexOf('--');
        return runNpmScript(ctx, positional[0], dd === -1 ? positional.slice(1) : rest.slice(dd + 1), root);
      }
      case 'start': case 'test': case 't': case 'restart': case 'stop':
        return runNpmScript(ctx, cmd === 't' ? 'test' : cmd, rest, root);
      case 'create': case 'exec': case 'x':
        return shell.invoke('npx', cmd === 'create' ? [`create-${rest[0]?.replace(/@.*$/, '')}`, ...rest.slice(1)] : rest, ctxIo(ctx));
      case 'audit': ctx.outln('found 0 vulnerabilities'); return 0;
      case 'outdated': case 'update': case 'prune': case 'dedupe': ctx.outln('up to date'); return 0;
      default:
        ctx.stderr.write(`Unknown command: "${cmd}"\n\nTo see a list of supported npm commands, run:\n  npm help\n`);
        return 1;
    }
  }, 'npm <init|install|run|test|start|ls|view|search>', 'Manage package.json, dependencies and scripts');
  shell.aliases.set('yarn', 'npm');
  shell.aliases.set('pnpm', 'npm');

  reg('npx', async (ctx) => {
    let [tool, ...rest] = ctx.args;
    if (!tool) { ctx.err('usage: npx <command>'); return 1; }
    tool = tool.replace(/@latest$/, '').replace(/@[\d.]+$/, '');
    if (/^create-react-app$|^create-vite$|^create-next-app$|^create-vue$|^create-react$/.test(tool)) return scaffold(ctx, tool, rest);
    if (['tsc', 'vite', 'vitest', 'jest', 'mocha', 'prettier', 'serve', 'http-server', 'live-server', 'nodemon', 'ts-node', 'tsx'].includes(tool)) return shell.invoke(tool, rest, ctxIo(ctx));
    ctx.stderr.write(`npx: '${tool}' can't run in the browser playground.\nBuilt-in tools: tsc, vite, vitest, jest, prettier, serve, create-vite, create-react-app\n`);
    return 1;
  }, 'npx <tool> [args]', 'Run a tool (create-vite, tsc, vitest, prettier, …)');

  async function scaffold(ctx, tool, args) {
    const { flags, positional } = parseArgs(args, { string: ['template', 't'] });
    let name = positional[0];
    let template = flags.template || flags.t || (tool === 'create-react-app' || tool === 'create-next-app' ? 'react' : tool === 'create-vue' ? 'vue' : null);
    if (!name) {
      ctx.stdout.write('? Project name: ');
      name = (await ctx.stdin.readLine()) || 'my-app';
    }
    if (!template) {
      ctx.outln('? Select a framework:  vanilla | react | react-ts | vue');
      ctx.stdout.write('> ');
      template = ((await ctx.stdin.readLine()) || 'react').trim() || 'react';
    }
    const key = { react: 'vite-react', 'react-ts': 'vite-react-ts', 'react-swc': 'vite-react', 'react-swc-ts': 'vite-react-ts', vanilla: 'vite-vanilla', 'vanilla-ts': 'vite-vanilla', vue: 'vite-vue', 'vue-ts': 'vite-vue' }[template] || 'vite-react';
    const dir = name === '.' ? shell.cwd : shell.resolve(name);
    if (vfs.exists(dir) && dir !== shell.cwd && vfs.readdir(dir).length) { ctx.err(`Target directory "${name}" is not empty.`); return 1; }
    const snap = instantiateTemplate(key, { name: name === '.' ? (basename(dir) || 'app') : basename(name) });
    for (const [p, c] of Object.entries(snap.files)) vfs.writeFile(normalize(dir ? `${dir}/${p}` : p), c);
    ctx.outln(`\nScaffolding project in ${toDisplay(dir)}...\n\nDone. Now run:\n\n  ${name === '.' ? '' : `cd ${name}\n  `}npm install\n  npm run dev\n`);
    host.refreshTree?.();
    return 0;
  }

  /* dev server & build tools */
  reg('vite', async (ctx) => {
    const sub = ctx.args[0];
    const root = projectRoot(shell.cwd);
    if (sub === 'build') {
      ctx.outln(`${color('cyan', 'vite v6.0.0')} ${color('green', 'building for production...')}`);
      const out = normalize(root ? `${root}/dist` : 'dist');
      const res = await host.buildStatic?.(root, out);
      if (!res) { ctx.err('build failed'); return 1; }
      ctx.outln(`${color('green', '✓')} built into ${toDisplay(out)} (${res.files} files)\n${color('gray', 'The build is a single self-contained index.html you can download or deploy anywhere.')}`);
      return 0;
    }
    if (sub === 'preview' || !sub || sub === 'dev' || sub === 'serve' || sub.startsWith('-')) {
      const html = vfs.isFile(normalize(root ? `${root}/index.html` : 'index.html'));
      if (!html) { ctx.err('No index.html found in the project root.'); return 1; }
      host.openPreview?.({ root, path: '/index.html' });
      ctx.outln(`\n  ${color('green', 'VITE v6.0.0')}  ready in ${Math.floor(80 + Math.random() * 120)} ms\n\n  ${color('green', '➜')}  ${color('bold', 'Local')}:   ${color('cyan', 'http://localhost:5173/')}  (open in the Preview panel)\n  ${color('green', '➜')}  press ${color('bold', 'Ctrl+C')} to stop\n`);
      host.setDevServer?.(root, true);
      // Keep "running" like a real dev server; edits reload the preview automatically.
      await waitForAbort(ctx.signal);
      host.setDevServer?.(root, false);
      return 130;
    }
    ctx.err(`unknown command "${sub}"`);
    return 1;
  }, 'vite [dev|build|preview]', 'Start the dev server (live Preview) or build a web app');
  for (const alias of ['serve', 'live-server', 'http-server', 'parcel', 'next']) {
    reg(alias, (ctx) => shell.invoke('vite', alias === 'next' && ctx.args[0] === 'build' ? ['build'] : ['dev'], ctxIo(ctx)), `${alias}`, 'Serve the web app in the Preview (alias of vite)');
  }

  reg('preview', async (ctx) => {
    const target = ctx.args[0];
    if (target && /^https?:\/\/localhost:\d+/.test(target)) {
      const m = /:(\d+)(\/.*)?$/.exec(target);
      host.openPreview?.({ port: Number(m[1]), path: m[2] || '/' });
      return 0;
    }
    const p = target ? ctx.resolve(target) : null;
    if (p && !vfs.exists(p)) { ctx.err(`${target}: No such file`); return 1; }
    host.openPreview?.(p ? (vfs.isDir(p) ? { root: p, path: '/index.html' } : { file: p }) : {});
    ctx.outln(color('gray', 'Opened the Preview panel.'));
    return 0;
  }, 'preview [file.html|folder|http://localhost:PORT]', 'Show a web page or running server in the Preview panel');

  /* tests */
  async function runJsTests(ctx, args) {
    const { positional } = parseArgs(args.filter((a) => !['run', '--run', '--watch=false', '--no-watch', '--ci', '--passWithNoTests'].includes(a)));
    const root = projectRoot(shell.cwd);
    let files = findTestFiles(vfs, root);
    if (positional.length) files = files.filter((f) => positional.some((p) => f.includes(p.replace(/^\.\//, ''))));
    if (!files.length) {
      ctx.outln(color('yellow', 'No test files found.'));
      ctx.outln(color('gray', 'Create files ending in .test.js / .spec.js (or put them in __tests__/). Example:\n\n  import { sum } from "./sum.js";\n  test("adds", () => { expect(sum(1, 2)).toBe(3); });'));
      return args.includes('--passWithNoTests') ? 0 : 1;
    }
    ctx.outln(`\n ${color('bold', 'RUN')}  ${color('gray', toDisplay(root))}\n`);
    return runNode(ctx, { mode: 'test', testFiles: files });
  }
  reg('vitest', (ctx) => runJsTests(ctx, ctx.args), 'vitest [run] [filter]', 'Run JavaScript/TypeScript tests (describe/it/expect)');
  shell.aliases.set('jest', 'vitest');
  shell.aliases.set('mocha', 'vitest');

  /* TypeScript compiler */
  reg('tsc', async (ctx) => {
    const { flags, positional } = parseArgs(ctx.args, { string: ['outDir', 'target', 'p', 'project'] });
    if (flags.v || flags.version) { ctx.outln('Version 6.0.2'); return 0; }
    if (flags.init) {
      const p = ctx.resolve('tsconfig.json');
      vfs.writeFile(p, `${JSON.stringify({ compilerOptions: { target: 'es2022', module: 'esnext', moduleResolution: 'bundler', strict: true, esModuleInterop: true, skipLibCheck: true, outDir: 'dist' }, include: ['src', '*.ts'] }, null, 2)}\n`);
      ctx.outln('Created a new tsconfig.json');
      return 0;
    }
    const root = projectRoot(shell.cwd);
    let files = positional.map((f) => ctx.resolve(f));
    if (!files.length) files = vfs.listFiles(root).filter((f) => /\.tsx?$/.test(f) && !/\.d\.ts$/.test(f) && !/(^|\/)(node_modules|dist)\//.test(f));
    if (!files.length) { ctx.err('error TS18003: No inputs were found in config file.'); return 1; }
    const result = await host.typeCheck?.(files, { emit: !flags.noEmit, outDir: flags.outDir, root });
    if (!result) { ctx.err('The TypeScript compiler is not available.'); return 1; }
    for (const d of result.diagnostics) ctx.stdout.write(`${color('cyan', d.file)}:${color('yellow', d.line)}:${color('yellow', d.column)} - ${color('red', 'error')} ${color('gray', `TS${d.code}:`)} ${d.message}\n`);
    if (result.diagnostics.length) ctx.outln(`\nFound ${result.diagnostics.length} error${result.diagnostics.length === 1 ? '' : 's'} in ${new Set(result.diagnostics.map((d) => d.file)).size} file${new Set(result.diagnostics.map((d) => d.file)).size === 1 ? '' : 's'}.`);
    if (result.emitted?.length) ctx.outln(color('gray', `Emitted ${result.emitted.length} file${result.emitted.length === 1 ? '' : 's'}: ${result.emitted.slice(0, 6).join(', ')}${result.emitted.length > 6 ? ', …' : ''}`));
    return result.diagnostics.length ? 2 : 0;
  }, 'tsc [--noEmit] [--outDir dir] [files]', 'Type-check and compile TypeScript');

  reg('prettier', async (ctx) => {
    const { flags, positional } = parseArgs(ctx.args);
    const files = positional.length ? positional.flatMap((p) => { const r = ctx.resolve(p); return vfs.isDir(r) ? vfs.listFiles(r) : [r]; }) : [];
    if (!files.length) { ctx.err('usage: prettier --write <files>'); return 1; }
    let changed = 0;
    for (const f of files) {
      if (!/\.(m?[jt]sx?|json|css|html|md)$/.test(f)) continue;
      const src = vfs.readFile(f);
      const out = await host.formatCode?.(f, src);
      if (out == null) continue;
      if (flags.write || flags.w) { if (out !== src) { vfs.writeFile(f, out); changed++; ctx.outln(f); } }
      else if (flags.check || flags.c) { if (out !== src) { ctx.outln(`[warn] ${f}`); changed++; } }
      else ctx.out(out);
    }
    if (flags.check && changed) { ctx.outln(`[warn] Code style issues found in ${changed} file(s). Run Prettier with --write to fix.`); return 1; }
    return 0;
  }, 'prettier --write <files>', 'Format code');

  /* ================= Python ================= */

  let pyWorker = null;
  function pythonWorker() {
    if (!pyWorker) pyWorker = new Worker(workerUrl('python-runtime.js'));
    return pyWorker;
  }
  host.resetPython = () => { try { pyWorker?.terminate(); } catch { /* ignore */ } pyWorker = null; };

  async function runPython(ctx, msg) {
    const bridge = syncBridgeReady() || await ensureSyncBridge({ timeout: 1500 });
    const worker = pythonWorker();
    const files = collectFiles(vfs, { binary: true });
    const errors = [];
    const proc = attachWorker({
      worker,
      io: workerIo(ctx, host),
      vfs,
      keepAlive: true,
      onMessage: (m) => { if (m.type === 'error') errors.push(m); return false; },
    });
    proc.post({ ...msg, files, dirs: vfs.listDirs(), cwd: shell.cwd, indexURL: cdn('pyodide'), syncBase: cdn('sync'), syncAvailable: bridge ? undefined : false, stdinText: ctx.stdin?.isTTY === false ? await ctx.stdin.readAll() : '' });
    const res = await proc.done;
    if (res.code === 130) host.resetPython(); // interrupted: the interpreter state is unknown
    reportErrors(host, errors, { source: 'python' });
    return res.code;
  }

  reg('python', async (ctx) => {
    const a = ctx.args;
    if (a[0] === '--version' || a[0] === '-V') { ctx.outln('Python 3.13.2'); return 0; }
    if (a[0] === '-c') return runPython(ctx, { type: 'run', code: a[1] || '', argv: a.slice(2) });
    if (a[0] === '-m') {
      const mod = a[1];
      if (mod === 'pip') return shell.invoke('pip', a.slice(2), ctxIo(ctx));
      if (mod === 'pytest') return shell.invoke('pytest', a.slice(2), ctxIo(ctx));
      if (mod === 'unittest') return runPython(ctx, { type: 'run', code: `import unittest, sys\nsys.argv = ['python -m unittest'] + ${JSON.stringify(a.slice(2))}\nunittest.main(module=None, argv=sys.argv, exit=True)`, argv: a.slice(2) });
      if (mod === 'venv' || mod === 'virtualenv') { ctx.outln(color('gray', 'Virtual environments are not needed in the playground; each workspace already has its own Python.')); return 0; }
      if (mod === 'http.server') return shell.invoke('preview', [], ctxIo(ctx));
      return runPython(ctx, { type: 'run', code: `import runpy, sys\nsys.argv = [${JSON.stringify(mod)}] + ${JSON.stringify(a.slice(2))}\nrunpy.run_module(${JSON.stringify(mod)}, run_name='__main__', alter_sys=True)` });
    }
    const fileArg = a.find((x) => !x.startsWith('-'));
    if (!fileArg) return pythonRepl(ctx);
    const entry = resolveScript(ctx, fileArg, ['', '.py']);
    if (!entry) { ctx.stderr.write(`python: can't open file '${toDisplay(ctx.resolve(fileArg))}': [Errno 2] No such file or directory\n`); return 2; }
    return runPython(ctx, { type: 'run', entry, argv: a.slice(a.indexOf(fileArg) + 1) });
  }, 'python [file.py] [args] | -c code | -m module', 'Run Python 3 (Pyodide): input(), files, numpy, pandas, matplotlib');

  async function pythonRepl(ctx) {
    const worker = pythonWorker();
    const files = collectFiles(vfs, { binary: true });
    let resolveResult = null;
    const proc = attachWorker({
      worker, io: workerIo(ctx, host), vfs, keepAlive: true,
      onMessage: (m) => { if (m.type === 'repl-result') { resolveResult?.(m.more); return true; } return false; },
    });
    const wait = () => new Promise((r) => { resolveResult = r; });
    proc.post({ type: 'repl-init', files, dirs: vfs.listDirs(), cwd: shell.cwd, indexURL: cdn('pyodide'), syncBase: cdn('sync') });
    let more = await Promise.race([wait(), proc.done.then(() => null)]);
    if (more === null) return 1;
    for (;;) {
      ctx.stdout.write(more ? '... ' : '>>> ');
      const line = await ctx.stdin.readLine();
      if (line === null || ctx.signal?.aborted) { ctx.outln(''); break; }
      if (/^\s*(exit|quit)\(\)\s*$/.test(line)) break;
      proc.post({ type: 'repl', line, syncBase: cdn('sync') });
      more = await Promise.race([wait(), proc.done.then(() => null)]);
      if (more === null) return 0;
    }
    return 0;
  }

  reg('pip', async (ctx) => {
    const [cmd, ...rest] = ctx.args;
    if (cmd === '--version' || cmd === '-V') { ctx.outln('pip 24.0 (micropip, Pyodide)'); return 0; }
    if (cmd === 'install') {
      const pkgs = [];
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === '-r') {
          const f = ctx.resolve(rest[++i] || 'requirements.txt');
          if (!vfs.isFile(f)) { ctx.stderr.write(`ERROR: Could not open requirements file: ${rest[i]}\n`); return 1; }
          pkgs.push(...vfs.readFile(f).split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean));
        } else if (!rest[i].startsWith('-')) pkgs.push(rest[i]);
      }
      if (!pkgs.length) { ctx.stderr.write('ERROR: You must give at least one requirement to install\n'); return 1; }
      return runPython(ctx, { type: 'pip', packages: pkgs });
    }
    if (cmd === 'list' || cmd === 'freeze') return runPython(ctx, { type: 'pip', packages: [], list: true });
    if (cmd === 'uninstall') { ctx.outln(color('gray', 'Packages live only for this session; restart Python (reload) to drop them.')); return 0; }
    ctx.outln('Usage:\n  pip install <package> [...]\n  pip install -r requirements.txt\n  pip list');
    return cmd ? 1 : 0;
  }, 'pip install <pkg> | -r requirements.txt', 'Install Python packages (pure Python or Pyodide builds)');
  shell.aliases.set('pip3', 'pip');

  reg('pytest', async (ctx) => {
    const files = ctx.args.filter((a) => !a.startsWith('-')).map((f) => ctx.resolve(f));
    const targets = files.length ? files : pythonTestFiles(vfs, projectRoot(shell.cwd));
    if (!targets.length) { ctx.outln(color('yellow', 'no tests ran (no test_*.py or *_test.py files found)')); return 5; }
    const flags = ctx.args.filter((a) => a.startsWith('-'));
    const code = `${PYTEST_BOOT}\nsys.exit(await _pg_pytest(${JSON.stringify([...flags, '-p', 'no:cacheprovider', '--color=yes', ...targets])}, ${JSON.stringify(targets)}))`;
    return runPython(ctx, { type: 'run', code });
  }, 'pytest [files]', 'Run Python tests with pytest');

  /* ================= C / C++ ================= */

  const cppWorkerRun = async (ctx, unit, { interactive, stdinText }) => {
    const worker = new Worker(workerUrl('cpp-runtime.js'));
    const errors = [];
    let consumed = [];
    const io = workerIo(ctx, host);
    const origRead = io.readLine;
    io.readLine = async () => { const l = await origRead(); if (l !== null) consumed.push(l); return l; };
    const proc = attachWorker({ worker, io, onMessage: (m) => { if (m.type === 'error') { errors.push(m); return true; } return false; } });
    proc.post({ type: 'run', code: unit.code, jscppUrl: cdn('jscpp'), interactive, stdinText, maxTimeout: 0 });
    const res = await proc.done;
    return { code: res.code, errors, consumed };
  };

  function unitErrors(unit, errors) {
    return errors.map((e) => {
      const loc = e.line ? mapLine(unit, e.line) : null;
      return { ...e, file: loc?.file || null, line: loc?.line || e.line };
    });
  }

  function printCppErrors(ctx, list, engine) {
    for (const e of list) {
      const where = e.file ? `${e.file}:${e.line || 1}:${e.column || 1}: ` : '';
      ctx.stderr.write(`${where}${color('bred', e.kind === 'compile' ? 'error:' : 'runtime error:')} ${e.message}\n`);
    }
    if (engine) ctx.stderr.write(color('gray', `(${engine})\n`));
  }

  function engineSetting() { return host.getSetting?.('cppEngine') || 'auto'; }

  /** Compile/run C or C++. Returns exit code. */
  async function runCppProgram(ctx, { sources, lang, std, flags, programArgs = [], forceEngine = null }) {
    const main = sources[0];
    const allCode = sources.map((s) => (vfs.isFile(s) ? vfs.readFile(s) : '')).join('\n');
    let engine = forceEngine || engineSetting();
    const online = typeof navigator === 'undefined' || navigator.onLine !== false;
    const blockers = interpreterBlockers(allCode);
    if (engine === 'auto') {
      if (!online) engine = 'interpreter';
      else if (blockers.length) engine = 'compiler';
      else engine = readsInput(allCode) ? 'interpreter' : 'compiler';
    }
    if (engine === 'interpreter') {
      if (blockers.length) ctx.stderr.write(color('yellow', `note: the in-browser interpreter may not support ${blockers.slice(0, 3).join(', ')} used in this program.\n`));
      const unit = buildTranslationUnit(vfs, sources);
      if (unit.missing.length) { ctx.stderr.write(`${main}: ${color('bred', 'fatal error:')} ${unit.missing[0]}: No such file or directory\n`); return 1; }
      const piped = ctx.stdin && ctx.stdin.isTTY === false;
      const stdinText = piped ? await ctx.stdin.readAll() : '';
      const r = await cppWorkerRun(ctx, unit, { interactive: !piped, stdinText });
      if (r.code === 130) return 130;
      const errs = unitErrors(unit, r.errors);
      const limitation = errs.find((e) => e.kind === 'compile' || /No matching function|not yet implemented|Not implemented|Cannot read properties|is not defined|internal erro|does not exist|Type lookup/i.test(e.message));
      if (limitation && online && engineSetting() === 'auto') {
        ctx.stderr.write(color('gray', `The in-browser interpreter couldn't handle this program (${limitation.message.split('\n')[0]}).\nCompiling it with the real g++ compiler on Wandbox instead…\n`));
        return runRemoteCpp(ctx, { sources, lang, std, flags, stdin: piped ? stdinText : r.consumed.map((l) => `${l}\n`).join(''), collectInput: !piped && readsInput(allCode) && !r.consumed.length });
      }
      if (errs.length) {
        printCppErrors(ctx, errs);
        host.setDiagnostics?.('cpp', errs.filter((e) => e.file).map((e) => ({ file: e.file, line: e.line, column: e.column || 1, message: e.message, severity: 'error' })));
      } else host.setDiagnostics?.('cpp', []);
      return r.code;
    }
    // Real compiler
    if (!online) { ctx.stderr.write('g++: the real compiler needs an internet connection; switch the C++ engine to "In-browser" to run offline.\n'); return 1; }
    const piped = ctx.stdin && ctx.stdin.isTTY === false;
    return runRemoteCpp(ctx, { sources, lang, std, flags, stdin: piped ? await ctx.stdin.readAll() : '', collectInput: !piped && readsInput(allCode), programArgs });
  }

  async function collectStdin(ctx) {
    ctx.stderr.write(color('gray', 'This program reads input. The compiler runs remotely, so type all of the input now; finish with an empty line (or Ctrl+D):\n'));
    const lines = [];
    for (;;) {
      const l = await ctx.stdin.readLine();
      if (l === null || l === '') break;
      lines.push(l);
    }
    return lines.map((l) => `${l}\n`).join('');
  }

  /** The files Wandbox needs for a build, flattened relative to the main file's folder. */
  function remoteBuildFiles(sources) {
    const files = {};
    const main = sources[0];
    // Send every C/C++ source and header in the workspace so includes resolve.
    for (const f of vfs.listFiles()) if (/\.(h|hh|hpp|hxx|c|cc|cpp|cxx|inl|tpp)$/.test(f) && !/(^|\/)(node_modules|\.git)\//.test(f)) files[f] = vfs.readFile(f);
    const mainRel = main;
    const sendFiles = { [mainRel]: vfs.readFile(main) };
    for (const s of sources.slice(1)) sendFiles[s] = vfs.readFile(s);
    for (const [k, v] of Object.entries(files)) if (!(k in sendFiles) && /\.(h|hh|hpp|hxx|inl|tpp)$/.test(k)) sendFiles[k] = v;
    // Wandbox compiles in one folder; flatten include paths relative to main's folder.
    const mainDir = dirname(main);
    const flat = {};
    for (const [k, v] of Object.entries(sendFiles)) flat[mainDir && k.startsWith(`${mainDir}/`) ? k.slice(mainDir.length + 1) : k] = v;
    const mainName = mainDir ? main.slice(mainDir.length + 1) : main;
    return { flat, mainName, mainDir };
  }

  async function runRemoteCpp(ctx, { sources, lang, std, flags, stdin = '', collectInput = false }) {
    if (collectInput) stdin += await collectStdin(ctx);
    const { flat, mainName, mainDir } = remoteBuildFiles(sources);
    ctx.stderr.write(color('gray', `Compiling on Wandbox (${lang === 'c' ? 'gcc' : 'g++'}), your code is sent to wandbox.org…\n`));
    let r;
    try {
      r = await compileAndRun(lang, { main: mainName, files: flat, stdin, std, extraFlags: flags.filter((f) => /^-(O\d|W|l|D|I)/.test(f)).join(' '), signal: ctx.signal });
    } catch (err) {
      if (err.name === 'AbortError') return 130;
      ctx.stderr.write(`${err.message}\n`);
      if (err.code === 'EOFFLINE') ctx.stderr.write(color('gray', 'Tip: set the C++ engine to "In-browser" (status bar) to run simple programs offline.\n'));
      return 1;
    }
    const compileText = rewriteProgName(`${r.compilerOutput}${r.compilerError}`, mainName);
    const diags = parseCompilerDiagnostics(compileText, mainName).map((d) => ({ ...d, file: mainDir && !d.file.includes('/') ? `${mainDir}/${d.file}` : d.file }));
    host.setDiagnostics?.('cpp', diags.filter((d) => d.severity === 'error' || d.severity === 'warning'));
    if (compileText.trim()) ctx.stderr.write(colorizeGcc(compileText));
    if (r.programOutput) ctx.stdout.write(r.programOutput);
    if (r.programError) ctx.stderr.write(rewriteProgName(r.programError, mainName));
    if (r.signal) ctx.stderr.write(color('bred', `\nProgram terminated by signal ${r.signal}${/Segmentation/.test(r.signal) ? ' (segmentation fault: invalid memory access)' : ''}\n`));
    if (diags.some((d) => d.severity === 'error')) return 1;
    return r.status;
  }

  function colorizeGcc(text) {
    return text.split('\n').map((l) => l
      .replace(/\b(fatal error|error):/, (m) => color('bred', m))
      .replace(/\bwarning:/, (m) => color('byellow', m))
      .replace(/\bnote:/, (m) => color('bcyan', m))).join('\n');
  }

  async function compileCommand(ctx, defaultLang) {
    if (ctx.args[0] === '--version' || ctx.args[0] === '-v') { ctx.outln(defaultLang === 'c' ? 'gcc (Toolbox) 13.2.0' : 'g++ (Toolbox) 13.2.0\nIn-browser interpreter: JSCPP 2.2 · Real compiler: GCC 13 on Wandbox'); return 0; }
    const parsed = parseCompileArgs(ctx.args, { defaultLang });
    if (!parsed.sources.length) { ctx.stderr.write(`${defaultLang === 'c' ? 'gcc' : 'g++'}: fatal error: no input files\ncompilation terminated.\n`); return 1; }
    const sources = [];
    for (const s of parsed.sources) {
      const p = ctx.resolve(s);
      if (!vfs.isFile(p)) { ctx.stderr.write(`${defaultLang === 'c' ? 'gcc' : 'g++'}: error: ${s}: No such file or directory\n`); return 1; }
      sources.push(p);
    }
    // Check the program now, like a real compiler: errors show up at the
    // g++ step and no executable is written. The run happens with ./output.
    const engine = engineSetting();
    const online = typeof navigator === 'undefined' || navigator.onLine !== false;
    if (engine !== 'interpreter' && online && typeof fetch === 'function') {
      const { flat, mainName, mainDir } = remoteBuildFiles(sources);
      try {
        const r = await compileAndRun(parsed.lang, { main: mainName, files: flat, std: parsed.std, extraFlags: ['-fsyntax-only', ...parsed.flags.filter((f) => /^-(W|D|I)/.test(f))].join(' '), signal: ctx.signal });
        const text = rewriteProgName(`${r.compilerOutput}${r.compilerError}`, mainName);
        const diags = parseCompilerDiagnostics(text, mainName).map((d) => ({ ...d, file: mainDir && !d.file.includes('/') ? `${mainDir}/${d.file}` : d.file }));
        host.setDiagnostics?.('cpp', diags.filter((d) => d.severity === 'error' || d.severity === 'warning'));
        if (text.trim()) ctx.stderr.write(colorizeGcc(text));
        if (diags.some((d) => d.severity === 'error') || /error:/.test(text)) return 1;
      } catch (err) {
        if (err.name === 'AbortError') return 130;
        // Offline or the service is busy: the program is checked when it runs.
      }
    }
    const output = ctx.args.includes('-o') ? parsed.output : defaultOutputName(parsed.sources) === basename(parsed.sources[0]).replace(/\.[^.]+$/, '') ? 'a.out' : parsed.output;
    const outPath = ctx.resolve(output);
    vfs.writeFile(outPath, makeExecutable({ lang: parsed.lang, sources, std: parsed.std, flags: parsed.flags, engine: engineSetting() }));
    ctx.stderr.write(color('gray', `Built ${output}. Run it with: ./${output}\n`));
    return 0;
  }
  reg('g++', (ctx) => compileCommand(ctx, 'cpp'), 'g++ main.cpp [more.cpp] -o app', 'Compile C++ (then run ./app)');
  reg('gcc', (ctx) => compileCommand(ctx, 'c'), 'gcc main.c -o app', 'Compile C (then run ./app)');

  /** ./program — built executables, shell scripts, shebang scripts */
  host.runExecutable = async (path, args, ctx) => {
    const text = vfs.readFile(path);
    const exe = readExecutable(text);
    if (exe) {
      const missing = exe.sources.filter((s) => !vfs.isFile(s));
      if (missing.length) { ctx.stderr.write(`${basename(path)}: source ${missing[0]} no longer exists; rebuild with g++\n`); return 127; }
      return runCppProgram(ctx, { sources: exe.sources, lang: exe.lang, std: exe.std, flags: exe.flags || [], programArgs: args });
    }
    const first = text.split('\n')[0];
    if (/^#!.*\b(node|nodejs)\b/.test(first)) return runNode(ctx, { entry: path, argv: args });
    if (/^#!.*\bpython/.test(first)) return runPython(ctx, { type: 'run', entry: path, argv: args });
    if (/\.(sh|bash)$/.test(path) || /^#!.*\b(ba)?sh\b/.test(first)) return runShellScript(ctx, path, args);
    const lang = languageOf(path);
    if (lang === 'javascript' || lang === 'typescript') return runNode(ctx, { entry: path, argv: args });
    if (lang === 'python') return runPython(ctx, { type: 'run', entry: path, argv: args });
    ctx.stderr.write(`tsh: permission denied: ${ctx.name}\n`);
    return 126;
  };

  /* ================= shell scripts ================= */

  async function runShellScript(ctx, path, args) {
    const lines = vfs.readFile(path).split('\n');
    const saved = { ...shell.env };
    args.forEach((a, i) => { shell.env[String(i + 1)] = a; });
    shell.env['0'] = path;
    shell.env['#'] = String(args.length);
    shell.env['@'] = args.join(' ');
    let status = 0;
    try {
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (!l.trim() || l.trim().startsWith('#')) continue;
        if (/^\s*set -e\s*$/.test(l)) { shell.env.__errexit = '1'; continue; }
        status = await shell.execute(l, ctxIo(ctx));
        if (ctx.signal?.aborted) return 130;
        if (status && shell.env.__errexit) break;
      }
    } finally {
      for (const k of Object.keys(shell.env)) if (!(k in saved)) delete shell.env[k];
      Object.assign(shell.env, saved);
    }
    return status;
  }
  reg('bash', async (ctx) => {
    if (ctx.args[0] === '-c') return shell.execute(ctx.args[1] || '', ctxIo(ctx));
    if (!ctx.args[0]) { ctx.outln(color('gray', 'You are already in a shell. Run a script with: bash script.sh')); return 0; }
    const p = ctx.resolve(ctx.args[0]);
    if (!vfs.isFile(p)) { ctx.stderr.write(`bash: ${ctx.args[0]}: No such file or directory\n`); return 127; }
    return runShellScript(ctx, p, ctx.args.slice(1));
  }, 'bash script.sh [args] | -c "commands"', 'Run a shell script');
  shell.aliases.set('sh', 'bash');
  shell.aliases.set('zsh', 'bash');
  shell.aliases.set('source', 'bash');
  shell.aliases.set('.', 'bash');
  reg('chmod', () => 0, 'chmod +x file', 'Make a file executable (always allowed here)', 'Files & navigation');

  reg('make', async (ctx) => {
    const { flags, positional } = parseArgs(ctx.args, { string: ['f', 'C'] });
    const dir = flags.C ? ctx.resolve(flags.C) : shell.cwd;
    const file = normalize(`${dir}/${flags.f || 'Makefile'}`);
    const alt = normalize(`${dir}/makefile`);
    const path = vfs.isFile(file) ? file : vfs.isFile(alt) ? alt : null;
    if (!path) { ctx.stderr.write('make: *** No targets specified and no makefile found.  Stop.\n'); return 2; }
    const rules = new Map();
    const vars = {};
    let first = null;
    let current = null;
    for (const raw of vfs.readFile(path).split('\n')) {
      if (/^\t/.test(raw)) { if (current) current.recipe.push(raw.slice(1)); continue; }
      const line = raw.replace(/#.*$/, '');
      const v = /^\s*([A-Za-z_][\w]*)\s*[:?+]?=\s*(.*)$/.exec(line);
      if (v && !/^[^=]*:[^=]/.test(line.replace(/:=/, '='))) { vars[v[1]] = v[2].trim(); continue; }
      const r = /^([^:=]+):(.*)$/.exec(line);
      if (r) {
        const targets = r[1].trim().split(/\s+/);
        current = { deps: r[2].trim().split(/\s+/).filter(Boolean), recipe: [] };
        for (const t of targets) { if (t === '.PHONY') continue; rules.set(t, current); if (!first) first = t; }
        continue;
      }
      if (line.trim()) current = null;
    }
    const expand = (s) => s.replace(/\$\(([A-Za-z_]\w*)\)|\$\{([A-Za-z_]\w*)\}/g, (m, a, b) => vars[a || b] ?? shell.env[a || b] ?? '');
    const done = new Set();
    const build = async (t) => {
      if (done.has(t)) return 0;
      done.add(t);
      const rule = rules.get(t);
      if (!rule) { if (vfs.exists(normalize(`${dir}/${t}`))) return 0; ctx.stderr.write(`make: *** No rule to make target '${t}'.  Stop.\n`); return 2; }
      for (const d of rule.deps) { const s = await build(expand(d)); if (s) return s; }
      for (const cmdLine of rule.recipe) {
        let cmd = expand(cmdLine.replace(/\$@/g, t).replace(/\$</g, expand(rule.deps[0] || '')).replace(/\$\^/g, rule.deps.map(expand).join(' ')));
        const silent = cmd.startsWith('@');
        if (silent) cmd = cmd.slice(1);
        if (!silent) ctx.outln(cmd);
        const saved = shell.cwd;
        shell.cwd = dir;
        const s = await shell.execute(cmd, ctxIo(ctx)).finally(() => { shell.cwd = saved; });
        if (s) { ctx.stderr.write(`make: *** [${basename(path)}: ${t}] Error ${s}\n`); return 2; }
      }
      return 0;
    };
    const targets = positional.length ? positional : [first];
    for (const t of targets) { const s = await build(t); if (s) return s; }
    return 0;
  }, 'make [target]', 'Run the build steps in a Makefile');

  /* ================= remote languages (Wandbox) ================= */

  async function runRemoteLanguage(ctx, lang, path, args = []) {
    const spec = REMOTE[lang];
    if (!spec) { ctx.err(`no remote compiler for ${lang}`); return 1; }
    const dir = dirname(path);
    const files = {};
    const ext = extname(path);
    for (const f of vfs.listFiles(dir)) if (extname(f) === ext && dirname(f) === dir) files[basename(f)] = vfs.readFile(f);
    const main = basename(path);
    const code = vfs.readFile(path);
    const piped = ctx.stdin && ctx.stdin.isTTY === false;
    let stdin = piped ? await ctx.stdin.readAll() : '';
    const needsInput = /Scanner\s*\(|System\.in|readLine|bufio\.NewReader|fmt\.Scan|stdin|gets|STDIN|Console\.Read|read_line|io::stdin|readln|scanf|input\(/.test(code);
    if (!piped && needsInput) stdin = await collectStdin(ctx);
    ctx.stderr.write(color('gray', `Running ${langInfo(lang).name} on Wandbox (your code is sent to wandbox.org)…\n`));
    let r;
    try { r = await compileAndRun(lang, { main, files, stdin, signal: ctx.signal }); } catch (err) {
      if (err.name === 'AbortError') return 130;
      ctx.stderr.write(`${err.message}\n`);
      return 1;
    }
    const compileText = rewriteProgName(`${r.compilerOutput}${r.compilerError}`, main);
    if (compileText.trim()) ctx.stderr.write(colorizeGcc(compileText));
    const diags = parseCompilerDiagnostics(compileText, main).map((d) => ({ ...d, file: dir ? `${dir}/${d.file}` : d.file }));
    host.setDiagnostics?.(lang, diags);
    if (r.programOutput) ctx.stdout.write(r.programOutput);
    if (r.programError) ctx.stderr.write(rewriteProgName(r.programError, main));
    return r.status;
  }
  const remoteRunner = (lang, name, usage) => reg(name, async (ctx) => {
    const file = ctx.args.find((a) => !a.startsWith('-') && a !== 'run');
    if (!file) { ctx.err(`usage: ${usage}`); return 1; }
    const p = resolveScript(ctx, file, ['', REMOTE[lang].ext]);
    if (!p) { ctx.err(`${file}: No such file`); return 1; }
    return runRemoteLanguage(ctx, lang, p, ctx.args.slice(ctx.args.indexOf(file) + 1));
  }, usage, `Run ${langInfo(lang).name} (compiled on Wandbox)`, 'Other languages (server)');
  remoteRunner('java', 'java', 'java Main.java');
  shell.aliases.set('javac', 'java');
  remoteRunner('go', 'go', 'go run main.go');
  remoteRunner('rust', 'rustc', 'rustc main.rs');
  shell.aliases.set('cargo', 'rustc');
  remoteRunner('php', 'php', 'php index.php');
  remoteRunner('ruby', 'ruby', 'ruby main.rb');
  remoteRunner('swift', 'swift', 'swift main.swift');
  remoteRunner('csharp', 'dotnet', 'dotnet run Program.cs');
  shell.aliases.set('csc', 'dotnet');
  shell.aliases.set('mono', 'dotnet');
  remoteRunner('scala', 'scala', 'scala Main.scala');
  remoteRunner('haskell', 'runghc', 'runghc Main.hs');
  shell.aliases.set('ghc', 'runghc');
  remoteRunner('perl', 'perl', 'perl main.pl');
  remoteRunner('r', 'Rscript', 'Rscript main.r');
  remoteRunner('pascal', 'fpc', 'fpc main.pas');
  remoteRunner('ocaml', 'ocaml', 'ocaml main.ml');
  remoteRunner('elixir', 'elixir', 'elixir main.exs');
  remoteRunner('zig', 'zig', 'zig run main.zig');

  /* ================= SQLite ================= */

  reg('sqlite3', async (ctx) => {
    // sqlite3 options use one dash: -csv, -json, -header …
    const flags = {};
    const positional = [];
    for (const a of ctx.args) {
      const m = /^--?(csv|json|line|list|box|table|column|markdown|html|header|noheader|readonly|bail|echo)$/.exec(a);
      if (m) flags[m[1]] = true; else positional.push(a);
    }
    const dbArg = positional[0] && !/^\s*(select|insert|create|update|delete|drop|with|pragma|alter)\b/i.test(positional[0]) ? positional.shift() : ':memory:';
    const sqlArg = positional.join(' ');
    const dbPath = dbArg === ':memory:' ? null : ctx.resolve(dbArg);
    const worker = new Worker(workerUrl('sql-runtime.js'));
    let seq = 0;
    const waiters = new Map();
    worker.onmessage = (e) => { const m = e.data; if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m); waiters.delete(m.id); } };
    const call = (msg) => new Promise((res) => { const id = ++seq; waiters.set(id, res); worker.postMessage({ ...msg, id }); });
    const abort = () => worker.terminate();
    ctx.signal?.addEventListener?.('abort', abort, { once: true });
    const mode = { value: ['csv', 'json', 'line', 'list', 'table', 'markdown', 'html'].find((k) => flags[k]) || (flags.column ? 'table' : 'box'), headers: !flags.noheader };
    if (mode.value === 'table' || mode.value === 'html') mode.value = 'box';
    try {
      await call({ type: 'open', sqljsBase: cdn('sqljs'), bytes: dbPath && vfs.isFile(dbPath) ? vfs.readBinary(dbPath) : null });
      let dirty = false;
      const stripComments = (t) => t.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
      const runBatch = async (batch) => {
        if (!stripComments(batch)) return 0;
        const r = await call({ type: 'exec', sql: batch });
        for (const set of r.sets) printSet(ctx, set, mode);
        if (/\b(insert|update|delete|create|drop|alter|replace)\b/i.test(batch)) dirty = true;
        if (r.error) { ctx.stderr.write(`${color('bred', 'Parse error:')} ${r.error}${r.errorStatement ? `\n  ${r.errorStatement.trim().split('\n')[0]}` : ''}\n`); return 1; }
        return 0;
      };
      const execSql = async (sql) => {
        let batch = '';
        let status = 0;
        for (const line of sql.split('\n')) {
          const dot = /^\s*\.(\w+)\s*(.*)$/.exec(line);
          const pending = stripComments(batch);
          // Dot commands are recognised between statements, like the sqlite3 shell.
          if (dot && (!pending || pending.endsWith(';'))) {
            if (await runBatch(batch)) status = 1;
            batch = '';
            const r = await dotCommand(dot[1], dot[2].trim());
            if (r === 'quit') return 'quit';
            if (r === 1) status = 1;
            continue;
          }
          batch += `${line}\n`;
        }
        if (await runBatch(batch)) status = 1;
        return status;
      };
      const dotCommand = async (cmd, arg) => {
        switch (cmd) {
          case 'quit': case 'exit': case 'q': return 'quit';
          case 'tables': { const r = await call({ type: 'exec', sql: "SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name" }); ctx.outln(r.sets[0]?.values.map((v) => v[0]).join('  ') || ''); return 0; }
          case 'schema': { const r = await call({ type: 'exec', sql: `SELECT sql FROM sqlite_master WHERE sql IS NOT NULL${arg ? ` AND name = '${arg.replace(/'/g, "''")}'` : ''} ORDER BY name` }); for (const v of r.sets[0]?.values || []) ctx.outln(`${v[0]};`); return 0; }
          case 'mode': mode.value = arg || 'box'; return 0;
          case 'headers': mode.headers = arg !== 'off'; return 0;
          case 'read': { const p = ctx.resolve(arg.replace(/^['"]|['"]$/g, '')); if (!vfs.isFile(p)) { ctx.stderr.write(`Error: cannot open "${arg}"\n`); return 1; } return execSql(vfs.readFile(p)); }
          case 'help': ctx.outln('.tables  .schema [table]  .mode box|table|list|csv|json|line|markdown  .headers on|off  .read file.sql  .dump  .quit'); return 0;
          case 'dump': { const r = await call({ type: 'exec', sql: "SELECT sql FROM sqlite_master WHERE sql IS NOT NULL" }); ctx.outln('BEGIN TRANSACTION;'); for (const v of r.sets[0]?.values || []) ctx.outln(`${v[0]};`); ctx.outln('COMMIT;'); return 0; }
          case 'open': return 0;
          default: ctx.stderr.write(`Error: unknown command or invalid arguments:  "${cmd}". Enter ".help" for help\n`); return 1;
        }
      };
      let status = 0;
      if (sqlArg) status = await execSql(sqlArg);
      else if (ctx.stdin && ctx.stdin.isTTY === false) status = await execSql(await ctx.stdin.readAll());
      else {
        ctx.outln(`SQLite version 3.46 (sql.js) ${new Date().toISOString().slice(0, 10)}\nEnter ".help" for usage hints.${dbPath ? '' : '\nConnected to a transient in-memory database.\nUse "sqlite3 app.db" to keep your data in a file.'}`);
        let buffer = '';
        for (;;) {
          ctx.stdout.write(buffer ? '   ...> ' : 'sqlite> ');
          const line = await ctx.stdin.readLine();
          if (line === null) break;
          if (!buffer && /^\s*\./.test(line)) { const r = await execSql(line); if (r === 'quit') break; continue; }
          buffer += `${line}\n`;
          if (/;\s*$/.test(line)) { await execSql(buffer); buffer = ''; }
        }
      }
      if (dbPath && dirty) {
        const r = await call({ type: 'export' });
        vfs.writeFile(dbPath, r.bytes);
      }
      return status === 'quit' ? 0 : status;
    } finally {
      ctx.signal?.removeEventListener?.('abort', abort);
      worker.terminate();
    }
  }, 'sqlite3 [app.db] ["SQL"] | < file.sql', 'SQLite shell (.tables, .schema, .read, .mode)');

  /* ================= Lua ================= */

  reg('lua', async (ctx) => {
    if (ctx.args[0] === '-v') { ctx.outln('Lua 5.4 (wasmoon)'); return 0; }
    let code;
    let entry = 'stdin';
    if (ctx.args[0] === '-e') code = ctx.args[1] || '';
    else if (ctx.args[0]) {
      const p = resolveScript(ctx, ctx.args[0], ['', '.lua']);
      if (!p) { ctx.stderr.write(`lua: cannot open ${ctx.args[0]}\n`); return 1; }
      code = vfs.readFile(p);
      entry = p;
    } else { ctx.err('usage: lua file.lua'); return 1; }
    await ensureSyncBridge({ timeout: 1500 });
    const worker = new Worker(workerUrl('lua-runtime.js'), { type: 'module' });
    const errors = [];
    const proc = attachWorker({ worker, io: workerIo(ctx, host), onMessage: (m) => { if (m.type === 'error') { errors.push(m); return true; } return false; } });
    proc.post({ type: 'run', code, entry, files: collectFiles(vfs), wasmoonUrl: cdn('wasmoon'), syncBase: cdn('sync') });
    const res = await proc.done;
    reportErrors(host, errors.map((e) => ({ ...e, file: entry })), { source: 'lua' });
    return res.code;
  }, 'lua file.lua', 'Run Lua 5.4');

  /* ================= curl ================= */

  const STATUS_TEXT = { 200: 'OK', 201: 'Created', 202: 'Accepted', 204: 'No Content', 301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict', 422: 'Unprocessable Entity', 429: 'Too Many Requests', 500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable' };
  reg('curl', async (ctx) => {
    // Expand combined short flags: -sSL → -s -S -L, -fsSL, -si …
    const args = [];
    for (const a of ctx.args) {
      if (/^-[a-zA-Z]{2,}$/.test(a) && !/^-(X|H|d|o|w|u)/.test(a)) for (const c of a.slice(1)) args.push(`-${c}`);
      else args.push(a);
    }
    let method = null; const headers = {}; let data = null; let url = null; let include = false; let out = null; let silent = false;
    let fail = false; let head = false; let verbose = false; let writeOut = null; let remoteName = false;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-X' || a === '--request') method = args[++i];
      else if (a === '-H' || a === '--header') { const h = args[++i] || ''; const c = h.indexOf(':'); if (c > 0) headers[h.slice(0, c).trim().toLowerCase()] = h.slice(c + 1).trim(); }
      else if (['-d', '--data', '--data-raw', '--data-binary', '--json', '--data-urlencode'].includes(a)) {
        let v = args[++i] ?? '';
        if (v.startsWith('@') && a !== '--data-raw') { const f = ctx.resolve(v.slice(1)); if (!vfs.isFile(f)) { ctx.stderr.write(`curl: Failed to open ${v.slice(1)}\n`); return 26; } v = vfs.readFile(f); }
        if (a === '--data-urlencode') { const eq = v.indexOf('='); v = eq >= 0 ? `${v.slice(0, eq)}=${encodeURIComponent(v.slice(eq + 1))}` : encodeURIComponent(v); }
        data = data === null ? v : `${data}&${v}`;
        if (a === '--json') { headers['content-type'] = 'application/json'; headers.accept = headers.accept || 'application/json'; }
      }
      else if (a === '-i' || a === '--include') include = true;
      else if (a === '-I' || a === '--head') { head = true; include = true; }
      else if (a === '-o' || a === '--output') out = args[++i];
      else if (a === '-O' || a === '--remote-name') remoteName = true;
      else if (a === '-f' || a === '--fail') fail = true;
      else if (a === '-v' || a === '--verbose') verbose = true;
      else if (a === '-w' || a === '--write-out') writeOut = args[++i];
      else if (a === '-u' || a === '--user') headers.authorization = `Basic ${btoa(args[++i] || '')}`;
      else if (a === '-s' || a === '--silent' || a === '-S' || a === '--show-error' || a === '-L' || a === '--location' || a === '-k' || a === '--insecure' || a === '--compressed') silent = silent || a === '-s' || a === '--silent';
      else if (!a.startsWith('-')) url = a;
    }
    if (!url) { ctx.stderr.write('curl: try \'curl --help\' or \'help curl\' for more information\nusage: curl [-X METHOD] [-H "K: V"] [-d data|@file] [-i] [-o file] URL\n'); return 2; }
    method = (method || (head ? 'HEAD' : data !== null ? 'POST' : 'GET')).toUpperCase();
    if (data !== null && !headers['content-type']) headers['content-type'] = /^\s*[{[]/.test(data) ? 'application/json' : 'application/x-www-form-urlencoded';
    const local = /^(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::(\d+))?(\/.*)?$/.exec(url);
    if (remoteName && !out) out = basename(url.split(/[?#]/)[0]) || 'index.html';
    const path = local ? (local[2] || '/') : url;
    if (verbose) ctx.stderr.write(`> ${method} ${path} HTTP/1.1\n> Host: ${local ? `localhost:${local[1] || 80}` : url.replace(/^https?:\/\//, '').split('/')[0]}\n${Object.entries(headers).map(([k, v]) => `> ${k}: ${v}\n`).join('')}>\n`);
    let status; let resHeaders; let body; let bytes = null;
    try {
      if (local) {
        const port = Number(local[1] || 80);
        if (!host.hasServer?.(port)) { ctx.stderr.write(`curl: (7) Failed to connect to localhost port ${port}: Connection refused\n${color('gray', 'Start your server first (e.g. npm start in another terminal tab).')}\n`); return 7; }
        const r = await host.requestServer(port, { method, url: path, headers, body: data });
        status = r.status; resHeaders = r.headers || {};
        if (r.bodyBase64) { const bin = atob(r.bodyBase64); bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0)); body = bin; } else body = r.body ?? '';
      } else {
        const res = await fetch(url.startsWith('http') ? url : `https://${url}`, { method, headers, body: data, signal: ctx.signal });
        status = res.status; resHeaders = Object.fromEntries(res.headers.entries());
        bytes = new Uint8Array(await res.arrayBuffer());
        body = new TextDecoder().decode(bytes);
      }
    } catch (err) {
      if (err.name === 'AbortError') return 130;
      ctx.stderr.write(`curl: (6) Could not resolve or reach ${url}: ${err.message}${local ? '' : '\n(browsers only allow requests to sites that permit cross-origin access)'}\n`);
      return 6;
    }
    if (head) body = '';
    const statusLine = `HTTP/1.1 ${status} ${STATUS_TEXT[status] || ''}`.trim();
    if (verbose) ctx.stderr.write(`< ${statusLine}\n${Object.entries(resHeaders).map(([k, v]) => `< ${k}: ${v}\n`).join('')}<\n`);
    if (fail && status >= 400) { ctx.stderr.write(`curl: (22) The requested URL returned error: ${status}\n`); return 22; }
    if (out) {
      vfs.writeFile(ctx.resolve(out), bytes && isBinaryPath(out) ? bytes : body);
      if (!silent) ctx.stderr.write(`  % Total    Received\n  ${String(body.length).padStart(7)}  ${String(body.length).padStart(8)}  → ${out}\n`);
    } else {
      let text = body;
      if (/json/.test(resHeaders['content-type'] || '') && !ctx.piped && !include) { try { text = JSON.stringify(JSON.parse(body), null, 2); } catch { /* raw */ } }
      if (include) text = `${statusLine}\n${Object.entries(resHeaders).map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${text}`;
      if (text) ctx.out(text.endsWith('\n') || ctx.piped ? text : `${text}\n`);
    }
    if (writeOut) ctx.out(writeOut.replace(/%\{http_code\}|%\{response_code\}/g, String(status)).replace(/%\{content_type\}/g, resHeaders['content-type'] || '').replace(/%\{size_download\}/g, String(body.length)).replace(/\\n/g, '\n'));
    return 0;
  }, 'curl [-X POST] [-H "K: V"] [-d data|@file] [-i|-I|-v|-f|-o file|-w fmt] URL', 'Make HTTP requests (localhost:PORT reaches your Node server)');
  reg('wget', (ctx) => {
    const url = ctx.args.find((a) => !a.startsWith('-'));
    return shell.invoke('curl', ['-o', basename((url || '').split('?')[0]) || 'index.html', url || ''], ctxIo(ctx));
  }, 'wget URL', 'Download a file into the workspace');

  /* ================= run (generic) ================= */

  reg('run', async (ctx) => {
    const target = ctx.args[0];
    let path = target ? ctx.resolve(target) : host.activeFile?.();
    if (!path) { ctx.err('usage: run <file>'); return 1; }
    if (vfs.isDir(path)) {
      const p = detectProject(vfs, path);
      path = p.node || p.python || p.cpp || p.html || null;
      if (!path) { ctx.err('Nothing to run in this folder.'); return 1; }
    }
    if (!vfs.isFile(path)) { ctx.err(`${target}: No such file`); return 1; }
    const cmd = runCommandFor(vfs, path, shell.cwd);
    if (!cmd) { ctx.err(`Don't know how to run ${basename(path)}`); return 1; }
    ctx.outln(color('gray', `$ ${cmd}`));
    return shell.execute(cmd, ctxIo(ctx));
  }, 'run [file]', 'Run a file with the right tool (same as the Run button)');

  /* ================= processes ================= */

  reg('ps', (ctx) => {
    const list = host.processes?.() || [];
    ctx.outln('  PID TTY      TIME CMD');
    ctx.outln(`    1 pts/0    0:00 tsh`);
    for (const p of list) ctx.outln(`${String(p.pid).padStart(5)} pts/${p.tty || 0}    0:00 ${p.cmd}`);
    return 0;
  }, 'ps', 'List running programs and servers', 'Shell');
  reg('kill', (ctx) => {
    const target = ctx.args.find((a) => !a.startsWith('-'));
    if (!target) { ctx.err('usage: kill <pid|%job|:port>'); return 1; }
    const ok = host.killProcess?.(target);
    if (!ok) { ctx.err(`(${target}) - No such process`); return 1; }
    return 0;
  }, 'kill <pid|:port>', 'Stop a running program or server', 'Shell');

  /* ================= archives ================= */

  reg('zip', async (ctx) => {
    const { positional } = parseArgs(ctx.args);
    const [zipName, ...items] = positional;
    if (!zipName || !items.length) { ctx.err('usage: zip -r out.zip folder [files]'); return 1; }
    const entries = [];
    for (const it of items) {
      const p = ctx.resolve(it);
      const files = vfs.isDir(p) ? vfs.listFiles(p) : vfs.isFile(p) ? [p] : [];
      for (const f of files) { entries.push({ path: shell.cwd && f.startsWith(`${shell.cwd}/`) ? f.slice(shell.cwd.length + 1) : f, data: vfs.readRaw(f) }); ctx.outln(`  adding: ${f}`); }
    }
    const blob = await createZip(entries);
    vfs.writeFile(ctx.resolve(zipName.endsWith('.zip') ? zipName : `${zipName}.zip`), new Uint8Array(await blob.arrayBuffer()));
    return 0;
  }, 'zip -r out.zip folder', 'Create a zip archive', 'Files & navigation');
  reg('unzip', async (ctx) => {
    const { flags, positional } = parseArgs(ctx.args, { string: ['d'] });
    const p = positional[0] ? ctx.resolve(positional[0]) : null;
    if (!p || !vfs.isFile(p)) { ctx.err('usage: unzip file.zip [-d folder]'); return 1; }
    const entries = await extractZip(vfs.readBinary(p));
    const dest = flags.d ? ctx.resolve(flags.d) : shell.cwd;
    for (const e of entries) {
      if (e.isDirectory) { vfs.mkdir(normalize(`${dest}/${e.path}`)); continue; }
      const target = normalize(`${dest}/${e.path}`);
      let content = e.data;
      if (!isBinaryPath(target)) { try { content = new TextDecoder('utf-8', { fatal: true }).decode(e.data); } catch { /* keep bytes */ } }
      vfs.writeFile(target, content);
      ctx.outln(`  inflating: ${target}`);
    }
    return 0;
  }, 'unzip file.zip [-d folder]', 'Extract a zip archive', 'Files & navigation');

  return { runNode, runPython, runCppProgram, runRemoteLanguage, projectRoot };
}

function waitForAbort(signal) {
  return new Promise((resolve) => {
    if (!signal) return;
    if (signal.aborted) { resolve(); return; }
    signal.addEventListener('abort', () => resolve(), { once: true });
  });
}

function printSet(ctx, set, mode) {
  const { columns, values } = set;
  const fmt = (v) => (v === null ? 'NULL' : v instanceof Uint8Array ? `<blob ${v.length} bytes>` : String(v));
  const m = mode.value;
  if (m === 'csv') {
    if (mode.headers) ctx.outln(columns.join(','));
    for (const r of values) ctx.outln(r.map((v) => { const s = fmt(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(','));
    return;
  }
  if (m === 'json') {
    ctx.outln(JSON.stringify(values.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i]]))), null, 1).replace(/\n\s*/g, ''));
    return;
  }
  if (m === 'list') {
    if (mode.headers) ctx.outln(columns.join('|'));
    for (const r of values) ctx.outln(r.map(fmt).join('|'));
    return;
  }
  if (m === 'markdown') {
    ctx.outln(`| ${columns.join(' | ')} |`);
    ctx.outln(`|${columns.map(() => '---').join('|')}|`);
    for (const r of values) ctx.outln(`| ${r.map((v) => fmt(v).replace(/\|/g, '\\|')).join(' | ')} |`);
    return;
  }
  if (m === 'line') {
    const w = Math.max(...columns.map((c) => c.length));
    for (const r of values) { for (let i = 0; i < columns.length; i++) ctx.outln(`${columns[i].padStart(w)} = ${fmt(r[i])}`); ctx.outln(''); }
    return;
  }
  // box / table
  const widths = columns.map((c, i) => Math.min(60, Math.max(c.length, ...values.map((r) => fmt(r[i]).length))));
  const cut = (s, w) => (s.length > w ? `${s.slice(0, w - 1)}…` : s);
  const isNum = (i) => values.length && values.every((r) => r[i] === null || typeof r[i] === 'number');
  const cell = (s, i) => (isNum(i) ? cut(s, widths[i]).padStart(widths[i]) : cut(s, widths[i]).padEnd(widths[i]));
  const line = (l, mid, r) => `${l}${widths.map((w) => '─'.repeat(w + 2)).join(mid)}${r}`;
  ctx.outln(line('┌', '┬', '┐'));
  ctx.outln(`│${columns.map((c, i) => ` ${color('bold', cut(c, widths[i]).padEnd(widths[i]))} `).join('│')}│`);
  ctx.outln(line('├', '┼', '┤'));
  for (const r of values) ctx.outln(`│${r.map((v, i) => ` ${v === null ? color('gray', cell('NULL', i)) : cell(fmt(v), i)} `).join('│')}│`);
  ctx.outln(line('└', '┴', '┘'));
  ctx.outln(color('gray', `${values.length} row${values.length === 1 ? '' : 's'}`));
}

/** The command the Run button uses for a file (shown in the terminal). */
export function runCommandFor(vfs, path, cwd = '') {
  const rel = relFrom(cwd, path);
  const q = (s) => (/^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, "'\\''")}'`);
  const lang = languageOf(path);
  const info = langInfo(lang);
  switch (info.runner) {
    case 'js': case 'ts':
      if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(path)) return `npx vitest run ${q(rel)}`;
      if (lang === 'jsx' || lang === 'tsx') return `preview`;
      return `node ${q(rel)}`;
    case 'python':
      if (/(^|\/)test_[^/]*\.py$|_test\.py$/.test(path)) return `pytest ${q(rel)}`;
      return `python ${q(rel)}`;
    case 'cpp': case 'c': {
      const out = basename(path).replace(/\.[^.]+$/, '');
      const others = siblingSources(vfs, path);
      const cc = info.runner === 'c' ? 'gcc' : 'g++';
      return `${cc} ${[rel, ...others.map((o) => relFrom(cwd, o))].map(q).join(' ')} -o ${q(out)} && ./${q(out)}`;
    }
    case 'sql': return `sqlite3 < ${q(rel)}`;
    case 'lua': return `lua ${q(rel)}`;
    case 'shell': return `bash ${q(rel)}`;
    case 'web': return `preview ${q(rel)}`;
    case 'markdown': return `preview ${q(rel)}`;
    case 'remote': {
      const cmd = { java: 'java', go: 'go run', rust: 'rustc', php: 'php', ruby: 'ruby', swift: 'swift', csharp: 'dotnet run', scala: 'scala', haskell: 'runghc', perl: 'perl', r: 'Rscript', pascal: 'fpc', ocaml: 'ocaml', elixir: 'elixir', zig: 'zig run', bash: 'bash' }[info.remote];
      return cmd ? `${cmd} ${q(rel)}` : null;
    }
    default: return null;
  }
}

/** Other .cpp/.c files in the same folder that don't define main(). */
function siblingSources(vfs, path) {
  const dir = dirname(path);
  const ext = /\.c$/.test(path) ? /\.c$/ : /\.(cpp|cc|cxx)$/;
  return vfs.listFiles(dir).filter((f) => f !== path && dirname(f) === dir && ext.test(f) && !/\bint\s+main\s*\(/.test(vfs.readFile(f)));
}

function relFrom(cwd, path) {
  if (!cwd) return path;
  if (path.startsWith(`${cwd}/`)) return path.slice(cwd.length + 1);
  return `/workspace/${path}`;
}

export { EXE_MAGIC, TEMPLATES };
