/* ============================================================
   Toolbox Code Playground — Python runtime worker (Pyodide)

   Real CPython 3 compiled to WebAssembly. The worker stays alive
   between runs so only the first run pays the download; each run gets
   a fresh copy of the workspace in /home/pyodide/workspace, a clean
   __main__ namespace, and afterwards every file the program created or
   changed is written back to the workspace.

   input() is truly interactive: the worker blocks on a synchronous
   request that the playground service worker answers once the student
   types a line in the terminal. Without the service worker, input()
   falls back to text supplied up front.

   page → worker  { type:'run', mode:'run'|'repl-init'|'repl'|'pip'|'check', files, entry, argv, cwd,
                    indexURL, syncBase, syncAvailable, stdinText, line, packages }
   worker → page  { type:'stdout'|'stderr', data } { type:'status', text }
                  { type:'sync-request', id, kind, payload }
                  { type:'fs', op, path, content } { type:'image', mime, data, name }
                  { type:'error', message, file, line } { type:'repl-result', more }
                  { type:'exit', code }
   ============================================================ */
'use strict';

var ROOT = '/home/pyodide/workspace';
var pyodide = null;
var booting = null;
var syncBase = '/__pg_sync/';
var syncAvailable = null;
var batchInput = [];
var decoder = new TextDecoder();
var outBuffer = '';
var errBuffer = '';

function send(m) { self.postMessage(m); }
function flushOut() { if (outBuffer) { send({ type: 'stdout', data: outBuffer }); outBuffer = ''; } if (errBuffer) { send({ type: 'stderr', data: errBuffer }); errBuffer = ''; } }

function probeSync() {
  if (syncAvailable !== null) return syncAvailable;
  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', syncBase + 'ping', false);
    xhr.send(null);
    syncAvailable = xhr.status === 200 && xhr.responseText === 'pong';
  } catch (e) { syncAvailable = false; }
  return syncAvailable;
}

function syncRead(kind, payload) {
  var id = kind + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  flushOut();
  send({ type: 'sync-request', id: id, kind: kind, payload: payload });
  for (var attempt = 0; attempt < 50; attempt++) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', syncBase + 'read?id=' + encodeURIComponent(id), false);
      xhr.send(null);
      if (xhr.status === 200) return JSON.parse(xhr.responseText);
    } catch (e) { /* the service worker may have restarted: ask again */ }
  }
  return null;
}

function readStdinLine() {
  if (batchInput.length) return batchInput.shift();
  if (probeSync()) {
    var r = syncRead('stdin', {});
    if (!r || r.eof || r.value == null) return null;
    return String(r.value) + '\n';
  }
  return null;
}

async function boot(indexURL) {
  if (pyodide) return pyodide;
  if (booting) return booting;
  booting = (async function () {
    send({ type: 'status', text: 'Starting Python (downloads about 10 MB the first time, then it is cached)…' });
    importScripts(indexURL + 'pyodide.js');
    var py = await self.loadPyodide({ indexURL: indexURL, env: { HOME: '/home/pyodide', MPLBACKEND: 'Agg', PYTHONUNBUFFERED: '1' } });
    py.setStdout({ write: function (buf) { outBuffer += decoder.decode(buf, { stream: true }); if (outBuffer.length > 2048 || outBuffer.indexOf('\n') !== -1) flushOut(); return buf.length; } });
    py.setStderr({ write: function (buf) { errBuffer += decoder.decode(buf, { stream: true }); if (errBuffer.indexOf('\n') !== -1) flushOut(); return buf.length; } });
    py.setStdin({ stdin: function () { flushOut(); return readStdinLine(); }, isatty: true });
    py.FS.mkdirTree(ROOT);
    py.runPython([
      'import sys, os, builtins, io',
      'sys.setrecursionlimit(3000)',
      '_pg_orig_input = builtins.input',
      'def _pg_input(prompt=""):',
      '    if prompt:',
      '        sys.stdout.write(str(prompt))',
      '        sys.stdout.flush()',
      '    line = sys.stdin.readline()',
      '    if line == "":',
      '        raise EOFError("EOF when reading a line")',
      '    return line[:-1] if line.endswith("\\n") else line',
      'builtins.input = _pg_input',
    ].join('\n'));
    pyodide = py;
    send({ type: 'status', text: 'Python ' + py.runPython('import sys; sys.version.split()[0]') + ' ready.' });
    return py;
  })();
  return booting;
}

/* ---------------- workspace mirroring ---------------- */

function rmTree(FS, dir) {
  var entries;
  try { entries = FS.readdir(dir); } catch (e) { return; }
  entries.forEach(function (n) {
    if (n === '.' || n === '..') return;
    var p = dir + '/' + n;
    var st = FS.stat(p);
    if (FS.isDir(st.mode)) { rmTree(FS, p); FS.rmdir(p); } else FS.unlink(p);
  });
}

function writeWorkspace(py, files, dirs) {
  var FS = py.FS;
  rmTree(FS, ROOT);
  var snapshot = {};
  (dirs || []).forEach(function (d) { FS.mkdirTree(ROOT + '/' + d); });
  Object.keys(files).forEach(function (rel) {
    var p = ROOT + '/' + rel;
    FS.mkdirTree(p.slice(0, p.lastIndexOf('/')));
    var v = files[rel];
    FS.writeFile(p, v);
    snapshot[rel] = typeof v === 'string' ? v : bytesKey(v);
  });
  return snapshot;
}

function bytesKey(u8) {
  // Cheap fingerprint to detect changes in binary files.
  var h = 2166136261;
  for (var i = 0; i < u8.length; i += Math.max(1, (u8.length >> 12))) { h ^= u8[i]; h = Math.imul(h, 16777619); }
  return 'bin:' + u8.length + ':' + (h >>> 0);
}

function walk(FS, dir, rel, out) {
  var entries;
  try { entries = FS.readdir(dir); } catch (e) { return; }
  entries.forEach(function (n) {
    if (n === '.' || n === '..' || n === '__pycache__') return;
    var p = dir + '/' + n;
    var r = rel ? rel + '/' + n : n;
    var st = FS.stat(p);
    if (FS.isDir(st.mode)) { out.dirs.push(r); walk(FS, p, r, out); } else out.files.push(r);
  });
}

function syncBack(py, before) {
  var FS = py.FS;
  var now = { files: [], dirs: [] };
  walk(FS, ROOT, '', now);
  var seen = {};
  now.files.forEach(function (rel) {
    seen[rel] = true;
    var data = FS.readFile(ROOT + '/' + rel);
    var text = null;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(data); } catch (e) { text = null; }
    var key = text !== null && !/\.(png|jpe?g|gif|webp|ico|db|sqlite|pdf|zip)$/i.test(rel) ? text : bytesKey(data);
    if (before[rel] !== key) {
      send({ type: 'fs', op: 'write', path: rel, content: text !== null && typeof key === 'string' && key.indexOf('bin:') !== 0 ? text : data });
    }
  });
  Object.keys(before).forEach(function (rel) { if (!seen[rel]) send({ type: 'fs', op: 'rm', path: rel }); });
  now.dirs.forEach(function (d) { send({ type: 'fs', op: 'mkdir', path: d }); });
}

/* ---------------- tracebacks ---------------- */

function cleanTraceback(text) {
  var lines = String(text).split('\n');
  var out = [];
  var skip = false;
  for (var i = 0; i < lines.length; i++) {
    var l = lines[i];
    if (/^\s*File "\/lib\/python[\d.]+\/|^\s*File "<exec>"|^\s*File "\/lib\/python\d+\.zip|_pyodide\/|pyodide\/_base\.py|pyodide\/webloop/.test(l)) { skip = true; continue; }
    if (skip && /^\s{4}\S/.test(l) && !/^\s*File /.test(l)) { continue; }
    skip = false;
    out.push(l.split(ROOT + '/').join(''));
  }
  return out.join('\n').replace(/\n+$/, '');
}

function lastLocation(tb) {
  var re = /File "([^"]+)", line (\d+)/g;
  var m; var last = null;
  while ((m = re.exec(tb))) { if (m[1].indexOf('/lib/python') === -1 && m[1] !== '<exec>') last = { file: m[1], line: Number(m[2]) }; }
  var se = /File "([^"]+)", line (\d+)[\s\S]*?(SyntaxError|IndentationError|TabError)/.exec(tb);
  if (se) last = { file: se[1], line: Number(se[2]) };
  return last;
}

/* ---------------- packages ---------------- */

var micropipLoaded = false;
async function ensureMicropip(py) {
  if (micropipLoaded) return;
  await py.loadPackage('micropip', { messageCallback: function () {} });
  micropipLoaded = true;
}

async function loadImports(py, files) {
  var code = Object.keys(files).filter(function (f) { return /\.py$/.test(f); }).map(function (f) { return files[f]; }).join('\n');
  if (!code) return;
  try {
    await py.loadPackagesFromImports(code, {
      messageCallback: function (m) { if (/Loading|Loaded/.test(m)) send({ type: 'status', text: m }); },
      errorCallback: function (m) { send({ type: 'status', text: m }); },
    });
  } catch (e) { /* surfaces as ImportError when the program runs */ }
}

/* matplotlib: render figures as PNG images for the output panel. */
var MPL_HOOK = [
  'def _pg_setup_mpl():',
  '    import sys',
  '    if "matplotlib" not in sys.modules:',
  '        return',
  '    import matplotlib',
  '    matplotlib.use("Agg")',
  '    import matplotlib.pyplot as plt',
  '    if getattr(plt, "_pg_patched", False):',
  '        return',
  '    import io, js',
  '    def show(*args, **kwargs):',
  '        for num in plt.get_fignums():',
  '            fig = plt.figure(num)',
  '            buf = io.BytesIO()',
  '            fig.savefig(buf, format="png", dpi=110, bbox_inches="tight")',
  '            js._pg_image(buf.getvalue(), "figure-%d.png" % num)',
  '        plt.close("all")',
  '    plt.show = show',
  '    plt._pg_patched = True',
].join('\n');

self._pg_image = function (bytes, name) {
  var data = bytes.toJs ? bytes.toJs() : bytes;
  send({ type: 'image', mime: 'image/png', data: data, name: name });
  if (bytes.destroy) bytes.destroy();
};

/* ---------------- run ---------------- */

async function run(msg) {
  var py = await boot(msg.indexURL);
  batchInput = String(msg.stdinText || '').split(/(?<=\n)/).filter(function (x) { return x.length; });
  var before = writeWorkspace(py, msg.files || {}, msg.dirs || []);
  await loadImports(py, msg.files || {});
  var cwd = ROOT + (msg.cwd ? '/' + msg.cwd : '');
  var entryAbs = msg.entry ? ROOT + '/' + msg.entry : null;
  py.globals.set('_pg_argv', py.toPy([msg.entry || '-c'].concat(msg.argv || [])));
  py.globals.set('_pg_cwd', cwd);
  py.globals.set('_pg_root', ROOT);
  py.globals.set('_pg_entry', entryAbs);
  py.globals.set('_pg_code', msg.code || '');
  var code = 0;
  try {
    await py.runPythonAsync([
      'import sys, os, runpy, importlib',
      // forget workspace modules imported by the previous run so edits are picked up
      'for _n, _m in list(sys.modules.items()):',
      '    _f = getattr(_m, "__file__", None) or ""',
      '    if _f.startswith(_pg_root):',
      '        del sys.modules[_n]',
      'importlib.invalidate_caches()',
      'os.chdir(_pg_cwd)',
      'sys.argv = list(_pg_argv)',
      'sys.path[:] = [p for p in sys.path if not p.startswith(_pg_root)]',
      'sys.path.insert(0, os.path.dirname(_pg_entry) if _pg_entry else _pg_cwd)',
      MPL_HOOK,
      '_pg_exit_code = None',
      'try:',
      '    if _pg_entry:',
      '        runpy.run_path(_pg_entry, run_name="__main__")',
      '    else:',
      '        import ast as _pg_ast',
      '        _pg_res = eval(compile(_pg_code, "<string>", "exec", flags=_pg_ast.PyCF_ALLOW_TOP_LEVEL_AWAIT), {"__name__": "__main__"})',
      '        if _pg_res is not None and hasattr(_pg_res, "__await__"):',
      '            await _pg_res',
      'except SystemExit as _pg_se:',
      '    _pg_exit_code = _pg_se.code if _pg_se.code is not None else 0',
      '    if not isinstance(_pg_exit_code, int):',
      '        print(_pg_exit_code, file=sys.stderr)',
      '        _pg_exit_code = 1',
      'finally:',
      '    sys.stdout.flush()',
      '    sys.stderr.flush()',
    ].join('\n'));
    var exitCode = py.globals.get('_pg_exit_code');
    if (typeof exitCode === 'number') code = exitCode;
  } catch (err) {
    flushOut();
    var text = String(err && err.message || err);
    var exitMatch = /SystemExit: (\S*)/.exec(text);
    if (exitMatch && /Traceback[\s\S]*SystemExit/.test(text)) {
      var v = exitMatch[1];
      code = v === '' || v === 'None' ? 0 : /^-?\d+$/.test(v) ? Number(v) : 1;
      if (code === 1 && !/^-?\d+$/.test(v)) send({ type: 'stderr', data: v + '\n' });
    } else if (/KeyboardInterrupt/.test(text)) {
      code = 130;
    } else {
      var tb = cleanTraceback(text);
      send({ type: 'stderr', data: '\x1b[31m' + tb + '\x1b[0m\n' });
      var loc = lastLocation(text);
      var lastLine = tb.split('\n').filter(Boolean).pop() || tb;
      if (/EOFError: EOF when reading a line/.test(text) && !syncAvailable) {
        send({ type: 'stderr', data: '\x1b[33mHint: this program asks for input(). Interactive input needs the playground service worker (reload the page once), or type the input in the "Program input" box before running.\x1b[0m\n' });
      }
      send({ type: 'error', message: lastLine, file: loc ? loc.file.split(ROOT + '/').join('') : null, line: loc ? loc.line : null });
      code = 1;
    }
  }
  flushOut();
  try { py.runPython('_pg_setup_mpl()\nimport sys\nif "matplotlib.pyplot" in sys.modules:\n    import matplotlib.pyplot as _p\n    if _p.get_fignums(): _p.show()'); } catch (e) { /* ignore */ }
  try { syncBack(py, before); } catch (e) { send({ type: 'status', text: 'Could not copy files back: ' + e.message }); }
  send({ type: 'exit', code: code });
}

async function pip(msg) {
  var py = await boot(msg.indexURL);
  await ensureMicropip(py);
  var micropip = py.pyimport('micropip');
  var code = 0;
  for (var i = 0; i < (msg.packages || []).length; i++) {
    var pkg = msg.packages[i];
    send({ type: 'stdout', data: 'Collecting ' + pkg + '\n' });
    try {
      await micropip.install(pkg);
      send({ type: 'stdout', data: '\x1b[32mSuccessfully installed ' + pkg + '\x1b[0m\n' });
    } catch (e) {
      code = 1;
      var m = String(e && e.message || e).split('\n').filter(Boolean).pop();
      send({ type: 'stderr', data: '\x1b[31mERROR: Could not install ' + pkg + ': ' + m + '\x1b[0m\n' });
      if (/pure Python 3 wheel/.test(String(e))) send({ type: 'stderr', data: '\x1b[33mOnly pure-Python packages and packages built for Pyodide can be installed in the browser.\x1b[0m\n' });
    }
  }
  if (msg.list) {
    try { send({ type: 'stdout', data: py.runPython('import micropip\n"\\n".join(sorted(f"{k}=={v.version}" for k, v in micropip.list().items()))') + '\n' }); } catch (e) { /* ignore */ }
  }
  send({ type: 'exit', code: code });
}

/* Interactive REPL (python with no arguments) */
async function replInit(msg) {
  var py = await boot(msg.indexURL);
  writeWorkspace(py, msg.files || {}, msg.dirs || []);
  py.globals.set('_pg_cwd', ROOT + (msg.cwd ? '/' + msg.cwd : ''));
  py.runPython([
    'import code, os, sys',
    'os.chdir(_pg_cwd)',
    'sys.path.insert(0, _pg_cwd)',
    '_pg_console = code.InteractiveConsole({"__name__": "__main__"}, filename="<stdin>")',
  ].join('\n'));
  send({ type: 'stdout', data: 'Python ' + py.runPython('import sys; sys.version.split(" (")[0]') + ' (Pyodide) on WebAssembly\nType "help", "copyright", "credits" or "license" for more information. exit() or Ctrl+D to leave.\n' });
  send({ type: 'repl-result', more: false });
}
async function replLine(msg) {
  var py = pyodide;
  var more = false;
  py.globals.set('_pg_line', msg.line);
  try {
    more = await py.runPythonAsync('_pg_console.push(_pg_line)');
  } catch (e) {
    flushOut();
    var t = String(e && e.message || e);
    if (/SystemExit/.test(t)) { send({ type: 'exit', code: 0 }); return; }
    send({ type: 'stderr', data: cleanTraceback(t) + '\n' });
  }
  flushOut();
  send({ type: 'repl-result', more: Boolean(more && more.valueOf ? more.valueOf() : more) });
}

/* Syntax check for the Problems panel. */
async function check(msg) {
  var py = await boot(msg.indexURL);
  py.globals.set('_pg_src', msg.code || '');
  py.globals.set('_pg_name', msg.entry || 'main.py');
  var res = py.runPython([
    'import ast, json',
    'try:',
    '    ast.parse(_pg_src, filename=_pg_name)',
    '    _r = None',
    'except SyntaxError as e:',
    '    _r = json.dumps({"message": f"{type(e).__name__}: {e.msg}", "line": e.lineno or 1, "column": e.offset or 1})',
    '_r',
  ].join('\n'));
  send({ type: 'check-result', diagnostics: res ? [JSON.parse(res)] : [] });
}

self.onmessage = function (e) {
  var msg = e.data || {};
  if (msg.syncBase) syncBase = msg.syncBase;
  if (msg.syncAvailable === false) syncAvailable = false;
  var task;
  if (msg.type === 'run') task = run(msg);
  else if (msg.type === 'pip') task = pip(msg);
  else if (msg.type === 'repl-init') task = replInit(msg);
  else if (msg.type === 'repl') task = replLine(msg);
  else if (msg.type === 'check') task = check(msg);
  else return;
  task.catch(function (err) {
    flushOut();
    send({ type: 'stderr', data: '\x1b[31m' + String(err && err.message || err) + '\x1b[0m\n' });
    send({ type: 'exit', code: 1 });
  });
};
send({ type: 'ready' });
