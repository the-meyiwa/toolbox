/* ============================================================
   Toolbox Code Playground — Node-style JavaScript runtime (Web Worker)

   Runs a workspace as a Node.js program inside a dedicated worker:
   CommonJS require() and ES module import/export across workspace
   files, TypeScript / JSX (via the TypeScript compiler, loaded only when
   needed), npm packages fetched as ES modules from esm.sh, and browser
   implementations of the Node core modules students actually use:
   fs, path, events, util, assert, readline, process, os, crypto (hash,
   random), url, querystring, buffer, timers, http + a small
   Express-compatible framework served through the playground preview.

   Protocol (page → worker)
     { type:'run', mode:'run'|'test'|'eval', files, entry, argv, env, cwd,
       packages:{name:url}, tsUrl, syncBase, testFiles, evalCode }
     { type:'stdin', data:string|null }        (null = EOF / Ctrl+D)
     { type:'http-request', id, port, method, url, headers, body }
   Protocol (worker → page)
     { type:'stdout'|'stderr', data }
     { type:'fs', op:'write'|'mkdir'|'rm'|'rename', path, content, to }
     { type:'stdin-request' }                  (async read wanted)
     { type:'listen', port } / { type:'close-server', port }
     { type:'http-response', id, status, headers, body, bodyBase64 }
     { type:'error', message, stack, file, line, column }
     { type:'test-report', results }
     { type:'exit', code }
   ============================================================ */
'use strict';

var WORKSPACE = '/workspace';
var BUILTINS = ['fs', 'fs/promises', 'path', 'events', 'util', 'assert', 'assert/strict', 'readline', 'readline/promises', 'process',
  'os', 'crypto', 'url', 'querystring', 'buffer', 'timers', 'timers/promises', 'string_decoder', 'child_process', 'http', 'https',
  'net', 'stream', 'worker_threads', 'perf_hooks', 'node:test', 'test', 'zlib', 'tty', 'module', 'v8', 'vm', 'dns', 'cluster',
  // Provided by the playground itself (npm install records them but they are never downloaded):
  'express', 'body-parser', 'cors', 'dotenv', 'morgan', 'nodemon',
  // The built-in test runner answers imports of the usual test libraries:
  'vitest', '@jest/globals', 'jest'];

var STATE = {
  files: new Map(),       // abs path (/workspace/...) → string
  dirs: new Set(),
  cwd: WORKSPACE,
  argv: [],
  env: {},
  packages: {},           // specifier → loaded namespace
  packageUrls: {},
  modules: new Map(),     // abs path → module
  tsUrl: '/vendor/typescript/typescript.min.js',
  syncBase: '/__pg_sync/',
  syncAvailable: null,
  handles: 0,
  exitCode: 0,
  exiting: false,
  finished: false,
  sourceMaps: new Map(),  // abs path → decoded mappings (per generated line)
  servers: new Map(),     // port → server
  stdinQueue: [],
  stdinWaiters: [],
  stdinEOF: false,
  stdinListeners: 0,
  mainDone: false,
};

/* ---------------- messaging ---------------- */

function send(msg) { self.postMessage(msg); }
function writeOut(s) { send({ type: 'stdout', data: String(s) }); }
function writeErr(s) { send({ type: 'stderr', data: String(s) }); }

/* ---------------- path helpers (POSIX) ---------------- */

function normalizeAbs(p) {
  var parts = [];
  String(p).split('/').forEach(function (seg) {
    if (!seg || seg === '.') return;
    if (seg === '..') parts.pop(); else parts.push(seg);
  });
  return '/' + parts.join('/');
}
function resolveAbs() {
  var out = STATE.cwd;
  for (var i = 0; i < arguments.length; i++) {
    var a = String(arguments[i] == null ? '' : arguments[i]);
    if (!a) continue;
    if (a.charAt(0) === '/') out = a; else out = out + '/' + a;
  }
  return normalizeAbs(out);
}
function dirOf(p) { var i = p.lastIndexOf('/'); return i <= 0 ? '/' : p.slice(0, i); }
function baseOf(p, ext) { var b = p.slice(p.lastIndexOf('/') + 1); return ext && b.slice(-ext.length) === ext ? b.slice(0, -ext.length) : b; }
function extOf(p) { var b = baseOf(p); var i = b.lastIndexOf('.'); return i <= 0 ? '' : b.slice(i); }
function toRel(abs) { return abs === WORKSPACE ? '' : abs.indexOf(WORKSPACE + '/') === 0 ? abs.slice(WORKSPACE.length + 1) : abs.replace(/^\//, ''); }

var pathModule = {
  sep: '/', delimiter: ':',
  resolve: resolveAbs,
  normalize: function (p) {
    if (!p) return '.';
    var abs = p.charAt(0) === '/';
    var parts = [];
    p.split('/').forEach(function (s) { if (!s || s === '.') return; if (s === '..') { if (parts.length && parts[parts.length - 1] !== '..') parts.pop(); else if (!abs) parts.push('..'); } else parts.push(s); });
    var out = (abs ? '/' : '') + parts.join('/');
    return out || (abs ? '/' : '.');
  },
  join: function () { var a = Array.prototype.slice.call(arguments).filter(function (x) { return x !== ''; }); return pathModule.normalize(a.join('/')); },
  dirname: function (p) { if (!p) return '.'; var i = p.replace(/\/+$/, '').lastIndexOf('/'); return i === -1 ? '.' : i === 0 ? '/' : p.slice(0, i); },
  basename: function (p, ext) { return baseOf(String(p).replace(/\/+$/, ''), ext); },
  extname: function (p) { return extOf(String(p)); },
  isAbsolute: function (p) { return String(p).charAt(0) === '/'; },
  relative: function (from, to) {
    var a = resolveAbs(from).split('/').filter(Boolean);
    var b = resolveAbs(to).split('/').filter(Boolean);
    var i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return a.slice(i).map(function () { return '..'; }).concat(b.slice(i)).join('/');
  },
  parse: function (p) {
    var root = p.charAt(0) === '/' ? '/' : '';
    var base = baseOf(p); var ext = extOf(p);
    return { root: root, dir: pathModule.dirname(p), base: base, ext: ext, name: ext ? base.slice(0, -ext.length) : base };
  },
  format: function (o) { var dir = o.dir || o.root || ''; var base = o.base || ((o.name || '') + (o.ext || '')); return dir ? (dir === o.root ? dir + base : dir + '/' + base) : base; },
  toNamespacedPath: function (p) { return p; },
};
pathModule.posix = pathModule;

/* ---------------- value formatting (util.inspect) ---------------- */

function inspect(v, opts, depth, seen) {
  depth = depth || 0;
  seen = seen || [];
  var maxDepth = opts && opts.depth != null ? opts.depth : 4;
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  var t = typeof v;
  if (t === 'string') return depth ? "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'" : v;
  if (t === 'number') return Object.is(v, -0) ? '-0' : String(v);
  if (t === 'bigint') return v + 'n';
  if (t === 'boolean') return String(v);
  if (t === 'symbol') return v.toString();
  if (t === 'function') {
    var isClass = /^class\s/.test(Function.prototype.toString.call(v));
    var keysF = Object.keys(v);
    var head = '[' + (isClass ? 'class' : 'Function') + (v.name ? (isClass ? ' ' : ': ') + v.name : isClass ? ' (anonymous)' : ' (anonymous)') + ']';
    return keysF.length && depth <= maxDepth ? head + ' ' + inspectProps(v, keysF, opts, depth, seen) : head;
  }
  if (seen.indexOf(v) !== -1) return '[Circular *1]';
  if (v instanceof Error) {
    var s = v.stack ? mapStack(String(v.stack)) : v.name + ': ' + v.message;
    if (depth) return '[' + (v.name || 'Error') + ': ' + v.message + ']';
    return s;
  }
  if (v instanceof Date) return isNaN(v) ? 'Invalid Date' : v.toISOString();
  if (v instanceof RegExp) return String(v);
  if (typeof Promise !== 'undefined' && v instanceof Promise) return 'Promise { <pending> }';
  if (depth > maxDepth) return Array.isArray(v) ? '[Array]' : '[Object]';
  seen = seen.concat([v]);
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    var items = [];
    var holes = 0;
    for (var i = 0; i < v.length && i < 100; i++) {
      if (!(i in v)) { holes++; continue; }
      if (holes) { items.push('<' + holes + ' empty item' + (holes > 1 ? 's' : '') + '>'); holes = 0; }
      items.push(inspect(v[i], opts, depth + 1, seen));
    }
    if (holes) items.push('<' + holes + ' empty item' + (holes > 1 ? 's' : '') + '>');
    if (v.length > 100) items.push('... ' + (v.length - 100) + ' more items');
    return wrapList('[', ']', items, depth);
  }
  if (typeof Map !== 'undefined' && v instanceof Map) {
    var mi = [];
    v.forEach(function (val, key) { mi.push(inspect(key, opts, depth + 1, seen) + ' => ' + inspect(val, opts, depth + 1, seen)); });
    return 'Map(' + v.size + ') ' + (mi.length ? wrapList('{', '}', mi, depth) : '{}');
  }
  if (typeof Set !== 'undefined' && v instanceof Set) {
    var si = [];
    v.forEach(function (val) { si.push(inspect(val, opts, depth + 1, seen)); });
    return 'Set(' + v.size + ') ' + (si.length ? wrapList('{', '}', si, depth) : '{}');
  }
  if (ArrayBuffer.isView(v) && !(v instanceof DataView)) {
    var name = v.constructor && v.constructor.name || 'TypedArray';
    if (name === 'Buffer' || v._isBuffer) {
      var hex = [];
      for (var b = 0; b < Math.min(v.length, 50); b++) hex.push(('0' + v[b].toString(16)).slice(-2));
      return '<Buffer ' + hex.join(' ') + (v.length > 50 ? ' ... ' + (v.length - 50) + ' more bytes' : '') + '>';
    }
    return name + '(' + v.length + ') [ ' + Array.prototype.slice.call(v, 0, 50).join(', ') + (v.length > 50 ? ', ...' : '') + ' ]';
  }
  var keys = Object.keys(v);
  var ctorName = v.constructor && v.constructor !== Object && v.constructor.name ? v.constructor.name + ' ' : (Object.getPrototypeOf(v) === null ? '[Object: null prototype] ' : '');
  if (!keys.length) return ctorName + '{}';
  return ctorName + inspectProps(v, keys, opts, depth, seen);
}
function inspectProps(v, keys, opts, depth, seen) {
  var parts = keys.slice(0, 200).map(function (k) {
    var key = /^[A-Za-z_$][\w$]*$/.test(k) ? k : "'" + k + "'";
    var desc = Object.getOwnPropertyDescriptor(v, k);
    if (desc && desc.get && !desc.set) return key + ': [Getter]';
    return key + ': ' + inspect(v[k], opts, depth + 1, seen);
  });
  if (keys.length > 200) parts.push('... ' + (keys.length - 200) + ' more items');
  return wrapList('{', '}', parts, depth);
}
function wrapList(open, close, items, depth) {
  var one = open + ' ' + items.join(', ') + ' ' + close;
  if (one.length <= 72 && one.indexOf('\n') === -1) return one;
  var ind = new Array(depth + 2).join('  ');
  var indClose = new Array(depth + 1).join('  ');
  return open + '\n' + items.map(function (x) { return ind + x; }).join(',\n') + '\n' + indClose + close;
}

function format() {
  var args = Array.prototype.slice.call(arguments);
  if (typeof args[0] !== 'string') return args.map(function (a) { return inspect(a); }).join(' ');
  var fmt = args.shift();
  var out = fmt.replace(/%[sdifjoOc%]/g, function (m) {
    if (m === '%%') return '%';
    if (!args.length) return m;
    var a = args.shift();
    switch (m) {
      case '%s': return typeof a === 'string' ? a : inspect(a, { depth: 1 }, 1);
      case '%d': case '%i': return typeof a === 'object' ? 'NaN' : String(m === '%i' ? parseInt(a, 10) : Number(a));
      case '%f': return String(parseFloat(a));
      case '%j': try { return JSON.stringify(a); } catch (e) { return '[Circular]'; }
      case '%o': case '%O': return inspect(a, {}, 1);
      case '%c': return '';
    }
    return m;
  });
  return [out].concat(args.map(function (a) { return inspect(a); })).join(' ');
}

/* ---------------- console ---------------- */

var counters = {};
var timersLabel = {};
var groupIndent = '';
function indentText(s) { return groupIndent ? s.split('\n').map(function (l) { return groupIndent + l; }).join('\n') : s; }
var consoleShim = {
  log: function () { writeOut(indentText(format.apply(null, arguments)) + '\n'); },
  info: function () { writeOut(indentText(format.apply(null, arguments)) + '\n'); },
  debug: function () { writeOut(indentText(format.apply(null, arguments)) + '\n'); },
  warn: function () { writeErr(indentText(format.apply(null, arguments)) + '\n'); },
  error: function () { writeErr(indentText(format.apply(null, arguments)) + '\n'); },
  trace: function () { var e = new Error(format.apply(null, arguments)); writeErr('Trace: ' + mapStack(e.stack || '').replace(/^Error: /, '') + '\n'); },
  dir: function (o, opts) { writeOut(inspect(o, opts || {}, 1) + '\n'); },
  table: function (data, columns) { writeOut(renderTable(data, columns) + '\n'); },
  assert: function (cond) { if (!cond) writeErr('Assertion failed' + (arguments.length > 1 ? ': ' + format.apply(null, Array.prototype.slice.call(arguments, 1)) : '') + '\n'); },
  count: function (label) { label = label || 'default'; counters[label] = (counters[label] || 0) + 1; writeOut(label + ': ' + counters[label] + '\n'); },
  countReset: function (label) { counters[label || 'default'] = 0; },
  time: function (label) { timersLabel[label || 'default'] = performance.now(); },
  timeLog: function (label) { label = label || 'default'; writeOut(label + ': ' + (performance.now() - (timersLabel[label] || 0)).toFixed(3) + 'ms\n'); },
  timeEnd: function (label) { label = label || 'default'; writeOut(label + ': ' + (performance.now() - (timersLabel[label] || 0)).toFixed(3) + 'ms\n'); delete timersLabel[label]; },
  group: function () { if (arguments.length) consoleShim.log.apply(null, arguments); groupIndent += '  '; },
  groupCollapsed: function () { consoleShim.group.apply(null, arguments); },
  groupEnd: function () { groupIndent = groupIndent.slice(2); },
  clear: function () { send({ type: 'clear' }); },
};

function renderTable(data, columns) {
  if (data === null || typeof data !== 'object') return inspect(data);
  var rows = [];
  var cols = [];
  var hasValues = false;
  var entries = data instanceof Map ? Array.from(data.entries()) : Object.keys(data).map(function (k) { return [k, data[k]]; });
  entries.forEach(function (e) {
    var row = { '(index)': String(e[0]) };
    var v = e[1];
    if (v !== null && typeof v === 'object') {
      Object.keys(v).forEach(function (c) { if (cols.indexOf(c) === -1) cols.push(c); row[c] = inspect(v[c], { depth: 0 }, 1); });
    } else { row.Values = inspect(v, {}, 1); hasValues = true; }
    rows.push(row);
  });
  if (columns) cols = columns;
  var header = ['(index)'].concat(cols).concat(hasValues ? ['Values'] : []);
  var widths = header.map(function (h) { return Math.max(h.length, ...rows.map(function (r) { return String(r[h] == null ? '' : r[h]).length; })) + 2; });
  var line = function (l, m, r) { return l + widths.map(function (w) { return new Array(w + 1).join('─'); }).join(m) + r; };
  var cell = function (s, w) { s = String(s == null ? '' : s); var left = Math.floor((w - s.length) / 2); return new Array(left + 1).join(' ') + s + new Array(w - s.length - left + 1).join(' '); };
  var out = [line('┌', '┬', '┐'), '│' + header.map(function (h, i) { return cell(h, widths[i]); }).join('│') + '│', line('├', '┼', '┤')];
  rows.forEach(function (r) { out.push('│' + header.map(function (h, i) { return cell(r[h], widths[i]); }).join('│') + '│'); });
  out.push(line('└', '┴', '┘'));
  return out.join('\n');
}

/* ---------------- source maps (for correct error lines) ---------------- */

var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function decodeMappings(mappings) {
  var lines = [];
  var srcLine = 0; var srcCol = 0; var src = 0; var name = 0;
  mappings.split(';').forEach(function (lineStr) {
    var genCol = 0;
    var segs = [];
    if (lineStr) lineStr.split(',').forEach(function (seg) {
      var vals = []; var shift = 0; var value = 0;
      for (var i = 0; i < seg.length; i++) {
        var d = B64.indexOf(seg.charAt(i));
        value += (d & 31) << shift;
        if (d & 32) shift += 5;
        else { var neg = value & 1; value >>= 1; vals.push(neg ? -value : value); value = 0; shift = 0; }
      }
      genCol += vals[0];
      if (vals.length >= 4) { src += vals[1]; srcLine += vals[2]; srcCol += vals[3]; if (vals.length >= 5) name += vals[4]; segs.push([genCol, srcLine, srcCol]); }
    });
    lines.push(segs);
  });
  return lines;
}
function mapPosition(file, line, col) {
  var map = STATE.sourceMaps.get(file);
  if (!map) return null;
  var segs = map[line - 1];
  if (!segs || !segs.length) {
    for (var l = line - 2; l >= 0; l--) if (map[l] && map[l].length) { var s0 = map[l][map[l].length - 1]; return { line: s0[1] + 1, column: s0[2] + 1 }; }
    return null;
  }
  var best = segs[0];
  for (var i = 0; i < segs.length; i++) if (segs[i][0] <= col - 1) best = segs[i];
  return { line: best[1] + 1, column: best[2] + 1 };
}
function mapStack(stack) {
  return String(stack).split('\n').filter(function (l) {
    return !/node-runtime\.js|typescript\.min\.js|<anonymous>|\beval at |__pgRunner|esm\.sh/.test(l) || /\/workspace\//.test(l);
  }).map(function (l) {
    return l.replace(/(\/workspace\/[^\s:()]+):(\d+):(\d+)/g, function (m, file, ln, col) {
      var p = mapPosition(file, Number(ln), Number(col));
      return p ? file + ':' + p.line + ':' + p.column : m;
    }).replace(/\(eval at [^)]*\), /, '(');
  }).join('\n');
}
function firstWorkspaceFrame(stack) {
  var m = /(\/workspace\/[^\s:()]+):(\d+):(\d+)/.exec(mapStack(stack || ''));
  return m ? { file: toRel(m[1]), line: Number(m[2]), column: Number(m[3]) } : null;
}

/* ---------------- sync channel (prompt / input) ---------------- */

function syncRead(kind, payload) {
  if (STATE.syncAvailable === false) return null;
  var id = kind + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
  send({ type: 'sync-request', id: id, kind: kind, payload: payload });
  for (var attempt = 0; attempt < 50; attempt++) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', STATE.syncBase + 'read?id=' + encodeURIComponent(id), false);
      xhr.send(null);
      if (xhr.status === 200) { STATE.syncAvailable = true; return JSON.parse(xhr.responseText); }
    } catch (e) { /* service worker restarted: retry */ }
  }
  return null;
}
function probeSync() {
  if (STATE.syncAvailable !== null) return STATE.syncAvailable;
  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', STATE.syncBase + 'ping', false);
    xhr.send(null);
    STATE.syncAvailable = xhr.status === 200 && xhr.responseText === 'pong';
  } catch (e) { STATE.syncAvailable = false; }
  return STATE.syncAvailable;
}

self.prompt = function (message, def) {
  if (!probeSync()) { writeErr('prompt() needs the playground service worker; use readline instead.\n'); return def == null ? null : String(def); }
  var r = syncRead('prompt', { message: message == null ? '' : String(message), default: def });
  return r && r.value != null ? String(r.value) : null;
};
self.alert = function (message) { writeOut(String(message == null ? '' : message) + '\n'); };
self.confirm = function (message) {
  if (!probeSync()) return false;
  var r = syncRead('confirm', { message: String(message == null ? '' : message) });
  return Boolean(r && r.value);
};

/* ---------------- stdin (async) ---------------- */

function requestStdin() {
  if (STATE.stdinEOF) return;
  send({ type: 'stdin-request' });
}
function readStdinChunk() {
  if (STATE.stdinQueue.length) return Promise.resolve(STATE.stdinQueue.shift());
  if (STATE.stdinEOF) return Promise.resolve(null);
  return new Promise(function (resolve) { STATE.stdinWaiters.push(resolve); requestStdin(); });
}
function onStdinData(data) {
  if (data === null) {
    STATE.stdinEOF = true;
    var ws = STATE.stdinWaiters.splice(0);
    ws.forEach(function (w) { w(null); });
    processStdin.emit('end');
    processStdin.emit('close');
    return;
  }
  if (STATE.stdinWaiters.length) STATE.stdinWaiters.shift()(data);
  else if (processStdin.listenerCount('data') && !processStdin.paused) processStdin.emit('data', processStdin.encoding ? data : Buffer.from(data));
  else STATE.stdinQueue.push(data);
}

/* ---------------- EventEmitter ---------------- */

function EventEmitter() { this._events = {}; this._max = 10; }
EventEmitter.prototype.on = EventEmitter.prototype.addListener = function (ev, fn) { (this._events[ev] = this._events[ev] || []).push(fn); if (this._onAdd) this._onAdd(ev); return this; };
EventEmitter.prototype.prependListener = function (ev, fn) { (this._events[ev] = this._events[ev] || []).unshift(fn); return this; };
EventEmitter.prototype.once = function (ev, fn) { var self_ = this; function w() { self_.off(ev, w); return fn.apply(this, arguments); } w.listener = fn; return this.on(ev, w); };
EventEmitter.prototype.off = EventEmitter.prototype.removeListener = function (ev, fn) {
  var l = this._events[ev]; if (!l) return this;
  var i = l.findIndex(function (x) { return x === fn || x.listener === fn; });
  if (i !== -1) l.splice(i, 1);
  if (this._onRemove) this._onRemove(ev);
  return this;
};
EventEmitter.prototype.removeAllListeners = function (ev) { if (ev) delete this._events[ev]; else this._events = {}; if (this._onRemove) this._onRemove(ev); return this; };
EventEmitter.prototype.emit = function (ev) {
  var l = this._events[ev];
  var args = Array.prototype.slice.call(arguments, 1);
  if (!l || !l.length) { if (ev === 'error') throw args[0] instanceof Error ? args[0] : new Error('Unhandled error. (' + inspect(args[0]) + ')'); return false; }
  l.slice().forEach(function (fn) { fn.apply(this, args); }, this);
  return true;
};
EventEmitter.prototype.listenerCount = function (ev) { return (this._events[ev] || []).length; };
EventEmitter.prototype.listeners = function (ev) { return (this._events[ev] || []).map(function (f) { return f.listener || f; }); };
EventEmitter.prototype.eventNames = function () { return Object.keys(this._events).filter(function (k) { return this._events[k].length; }, this); };
EventEmitter.prototype.setMaxListeners = function (n) { this._max = n; return this; };
EventEmitter.prototype.getMaxListeners = function () { return this._max; };
EventEmitter.EventEmitter = EventEmitter;
EventEmitter.once = function (em, ev) { return new Promise(function (res) { em.once(ev, function () { res(Array.prototype.slice.call(arguments)); }); }); };
EventEmitter.defaultMaxListeners = 10;

/* ---------------- Buffer (subset) ---------------- */

var te = new TextEncoder();
var td = new TextDecoder();
function Buffer(arg) { return Buffer.from(arg); }
function makeBuf(u8) { Object.setPrototypeOf(u8, Buffer.prototype); u8._isBuffer = true; return u8; }
Buffer.prototype = Object.create(Uint8Array.prototype);
Buffer.prototype.constructor = Buffer;
Object.defineProperty(Buffer, 'name', { value: 'Buffer' });
Buffer.from = function (v, enc) {
  if (typeof v === 'string') {
    if (enc === 'base64' || enc === 'base64url') { var s = atob(v.replace(/-/g, '+').replace(/_/g, '/')); var u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return makeBuf(u); }
    if (enc === 'hex') { var h = new Uint8Array(v.length >> 1); for (var j = 0; j < h.length; j++) h[j] = parseInt(v.substr(j * 2, 2), 16); return makeBuf(h); }
    if (enc === 'latin1' || enc === 'binary' || enc === 'ascii') { var l = new Uint8Array(v.length); for (var k = 0; k < v.length; k++) l[k] = v.charCodeAt(k) & 255; return makeBuf(l); }
    return makeBuf(te.encode(v));
  }
  if (v instanceof ArrayBuffer) return makeBuf(new Uint8Array(v));
  if (ArrayBuffer.isView(v)) return makeBuf(new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)));
  if (Array.isArray(v)) return makeBuf(Uint8Array.from(v));
  if (v && v.type === 'Buffer' && Array.isArray(v.data)) return makeBuf(Uint8Array.from(v.data));
  throw new TypeError('The first argument must be of type string, Buffer, ArrayBuffer, Array, or Array-like Object.');
};
Buffer.alloc = function (n, fill) { var u = new Uint8Array(n); if (fill !== undefined) u.fill(typeof fill === 'string' ? fill.charCodeAt(0) : fill); return makeBuf(u); };
Buffer.allocUnsafe = Buffer.alloc;
Buffer.isBuffer = function (b) { return Boolean(b && b._isBuffer); };
Buffer.byteLength = function (s) { return typeof s === 'string' ? te.encode(s).length : s.byteLength; };
Buffer.concat = function (list, total) {
  total = total == null ? list.reduce(function (s, b) { return s + b.length; }, 0) : total;
  var u = new Uint8Array(total); var off = 0;
  list.forEach(function (b) { u.set(b.subarray(0, Math.min(b.length, total - off)), off); off += b.length; });
  return makeBuf(u);
};
Buffer.isEncoding = function (e) { return ['utf8', 'utf-8', 'hex', 'base64', 'base64url', 'latin1', 'binary', 'ascii'].indexOf(String(e).toLowerCase()) !== -1; };
Buffer.prototype.toString = function (enc, start, end) {
  var u = this.subarray(start || 0, end == null ? this.length : end);
  if (enc === 'hex') return Array.prototype.map.call(u, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  if (enc === 'base64' || enc === 'base64url') { var s = ''; for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); var b64 = btoa(s); return enc === 'base64url' ? b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b64; }
  if (enc === 'latin1' || enc === 'binary' || enc === 'ascii') { var r = ''; for (var j = 0; j < u.length; j++) r += String.fromCharCode(u[j]); return r; }
  return td.decode(u);
};
Buffer.prototype.toJSON = function () { return { type: 'Buffer', data: Array.prototype.slice.call(this) }; };
Buffer.prototype.equals = function (o) { if (this.length !== o.length) return false; for (var i = 0; i < this.length; i++) if (this[i] !== o[i]) return false; return true; };
Buffer.prototype.write = function (s, off) { var b = te.encode(s); this.set(b.subarray(0, this.length - (off || 0)), off || 0); return b.length; };
Buffer.prototype.slice = function (s, e) { return makeBuf(Uint8Array.prototype.slice.call(this, s, e)); };
Buffer.prototype.subarray = function (s, e) { return makeBuf(Uint8Array.prototype.subarray.call(this, s, e)); };
Buffer.prototype.readUInt8 = function (o) { return this[o || 0]; };
Buffer.prototype.readUInt32BE = function (o) { o = o || 0; return ((this[o] << 24) >>> 0) + (this[o + 1] << 16) + (this[o + 2] << 8) + this[o + 3]; };

/* ---------------- crypto (hashes & randomness) ---------------- */

function sha256Bytes(bytes) {
  var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  var l = bytes.length; var withPad = new Uint8Array(((l + 9 + 63) >> 6) << 6);
  withPad.set(bytes); withPad[l] = 0x80;
  var bits = l * 8; var dv = new DataView(withPad.buffer);
  dv.setUint32(withPad.length - 4, bits >>> 0); dv.setUint32(withPad.length - 8, Math.floor(bits / 4294967296));
  var W = new Uint32Array(64);
  for (var off = 0; off < withPad.length; off += 64) {
    for (var t = 0; t < 16; t++) W[t] = dv.getUint32(off + t * 4);
    for (t = 16; t < 64; t++) { var s0 = ror(W[t - 15], 7) ^ ror(W[t - 15], 18) ^ (W[t - 15] >>> 3); var s1 = ror(W[t - 2], 17) ^ ror(W[t - 2], 19) ^ (W[t - 2] >>> 10); W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0; }
    var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (t = 0; t < 64; t++) {
      var S1 = ror(e, 6) ^ ror(e, 11) ^ ror(e, 25); var ch = (e & f) ^ (~e & g); var t1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      var S0 = ror(a, 2) ^ ror(a, 13) ^ ror(a, 22); var mj = (a & b) ^ (a & c) ^ (b & c); var t2 = (S0 + mj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0; H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  var out = new Uint8Array(32); var odv = new DataView(out.buffer);
  H.forEach(function (x, i) { odv.setUint32(i * 4, x); });
  return out;
}
function ror(x, n) { return (x >>> n) | (x << (32 - n)); }
function sha1Bytes(bytes) {
  var l = bytes.length; var padded = new Uint8Array(((l + 9 + 63) >> 6) << 6); padded.set(bytes); padded[l] = 0x80;
  var dv = new DataView(padded.buffer); dv.setUint32(padded.length - 4, (l * 8) >>> 0); dv.setUint32(padded.length - 8, Math.floor(l * 8 / 4294967296));
  var h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0; var w = new Uint32Array(80);
  for (var off = 0; off < padded.length; off += 64) {
    for (var i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (i = 16; i < 80; i++) { var x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]; w[i] = (x << 1) | (x >>> 31); }
    var a = h0, b = h1, c = h2, d = h3, e = h4;
    for (i = 0; i < 80; i++) {
      var f, k;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; } else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; } else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; } else { f = b ^ c ^ d; k = 0xca62c1d6; }
      var temp = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0; e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = temp;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  var out = new Uint8Array(20); var o = new DataView(out.buffer); [h0, h1, h2, h3, h4].forEach(function (v, j) { o.setUint32(j * 4, v); });
  return out;
}
function md5Bytes(bytes) {
  var s = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  var K = []; for (var i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
  var l = bytes.length; var padded = new Uint8Array(((l + 9 + 63) >> 6) << 6); padded.set(bytes); padded[l] = 0x80;
  var dv = new DataView(padded.buffer); dv.setUint32(padded.length - 8, (l * 8) >>> 0, true); dv.setUint32(padded.length - 4, Math.floor(l * 8 / 4294967296), true);
  var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (var off = 0; off < padded.length; off += 64) {
    var M = []; for (var j = 0; j < 16; j++) M[j] = dv.getUint32(off + j * 4, true);
    var A = a0, B = b0, C = c0, D = d0;
    for (i = 0; i < 64; i++) {
      var F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; } else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; } else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; } else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + M[g]) >>> 0; A = D; D = C; C = B; B = (B + ((F << s[i]) | (F >>> (32 - s[i])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  var out = new Uint8Array(16); var o = new DataView(out.buffer); [a0, b0, c0, d0].forEach(function (v, k) { o.setUint32(k * 4, v, true); });
  return out;
}
function hmac(hashFn, blockSize, key, data) {
  if (key.length > blockSize) key = hashFn(key);
  var k = new Uint8Array(blockSize); k.set(key);
  var ipad = new Uint8Array(blockSize + data.length); var opadKey = new Uint8Array(blockSize);
  for (var i = 0; i < blockSize; i++) { ipad[i] = k[i] ^ 0x36; opadKey[i] = k[i] ^ 0x5c; }
  ipad.set(data, blockSize);
  var inner = hashFn(ipad);
  var outer = new Uint8Array(blockSize + inner.length); outer.set(opadKey); outer.set(inner, blockSize);
  return hashFn(outer);
}
var HASHES = { sha256: sha256Bytes, sha1: sha1Bytes, md5: md5Bytes };
function makeHash(alg, key) {
  var fn = HASHES[String(alg).toLowerCase().replace('-', '')];
  if (!fn) throw new Error('Digest method not supported: ' + alg + ' (available: sha256, sha1, md5)');
  var chunks = [];
  return {
    update: function (d, enc) { chunks.push(typeof d === 'string' ? Buffer.from(d, enc) : Buffer.from(d)); return this; },
    digest: function (enc) {
      var data = Buffer.concat(chunks);
      var out = makeBuf(key ? hmac(fn, 64, typeof key === 'string' ? te.encode(key) : key, data) : fn(data));
      return enc ? out.toString(enc) : out;
    },
  };
}
var cryptoModule = {
  randomUUID: function () { return self.crypto.randomUUID(); },
  randomBytes: function (n, cb) { var b = makeBuf(self.crypto.getRandomValues(new Uint8Array(n))); if (cb) { setTimeout(function () { cb(null, b); }); return undefined; } return b; },
  randomInt: function (min, max) { if (max === undefined) { max = min; min = 0; } return min + Math.floor(Math.random() * (max - min)); },
  createHash: function (alg) { return makeHash(alg); },
  createHmac: function (alg, key) { return makeHash(alg, key); },
  getRandomValues: function (a) { return self.crypto.getRandomValues(a); },
  webcrypto: self.crypto,
  subtle: self.crypto.subtle,
  timingSafeEqual: function (a, b) { if (a.length !== b.length) throw new RangeError('Input buffers must have the same byte length'); var r = 0; for (var i = 0; i < a.length; i++) r |= a[i] ^ b[i]; return r === 0; },
};

/* ---------------- process ---------------- */

var processStdin = new EventEmitter();
processStdin.isTTY = true;
processStdin.fd = 0;
processStdin.encoding = null;
processStdin.paused = false;
processStdin.setEncoding = function (e) { this.encoding = e || 'utf8'; return this; };
processStdin.resume = function () { this.paused = false; pumpStdin(); return this; };
processStdin.pause = function () { this.paused = true; return this; };
processStdin.setRawMode = function () { return this; };
processStdin.read = function () { return STATE.stdinQueue.length ? STATE.stdinQueue.shift() : null; };
processStdin.unref = function () { return this; };
processStdin.ref = function () { return this; };
processStdin[Symbol.asyncIterator] = function () {
  return { next: function () { return readStdinChunk().then(function (d) { return d === null ? { done: true, value: undefined } : { done: false, value: d }; }); }, return: function () { return Promise.resolve({ done: true }); } };
};
processStdin._onAdd = function (ev) { if (ev === 'data' || ev === 'readable') { STATE.stdinListeners++; pumpStdin(); } };
processStdin._onRemove = function () { STATE.stdinListeners = processStdin.listenerCount('data') + processStdin.listenerCount('readable'); };
function pumpStdin() {
  if (processStdin.paused || !processStdin.listenerCount('data') || STATE.stdinEOF) return;
  while (STATE.stdinQueue.length) processStdin.emit('data', processStdin.encoding ? STATE.stdinQueue.shift() : Buffer.from(STATE.stdinQueue.shift()));
  if (!STATE.stdinWaiters.length) requestStdin();
}

function makeWritable(write, fd) {
  var w = new EventEmitter();
  w.write = function (chunk, enc, cb) { write(typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk)); if (typeof enc === 'function') enc(); else if (typeof cb === 'function') cb(); return true; };
  w.end = function (chunk) { if (chunk) w.write(chunk); w.emit('finish'); };
  w.isTTY = true; w.fd = fd; w.columns = 100; w.rows = 30;
  w.clearLine = function () { return true; }; w.cursorTo = function () { return true; }; w.moveCursor = function () { return true; };
  w.getColorDepth = function () { return 8; }; w.hasColors = function () { return true; };
  return w;
}

var processObj = new EventEmitter();
Object.assign(processObj, {
  title: 'node', pid: 4242, ppid: 1, platform: 'linux', arch: 'wasm32', version: 'v22.0.0', release: { name: 'node' },
  versions: { node: '22.0.0', v8: 'browser', toolbox: '1.0' },
  argv0: 'node', execPath: '/usr/local/bin/node', execArgv: [],
  stdin: processStdin,
  stdout: makeWritable(writeOut, 1),
  stderr: makeWritable(writeErr, 2),
  cwd: function () { return STATE.cwd; },
  chdir: function (d) { var p = resolveAbs(d); if (!isDirAbs(p)) throw fsError('ENOENT', 'chdir', d); STATE.cwd = p; },
  exit: function (code) { throw new ExitSignal(code == null ? processObj.exitCode || 0 : code); },
  abort: function () { throw new ExitSignal(134); },
  nextTick: function (fn) { var args = Array.prototype.slice.call(arguments, 1); queueMicrotask(function () { fn.apply(null, args); }); },
  hrtime: Object.assign(function (prev) {
    var t = performance.now(); var s = Math.floor(t / 1000); var ns = Math.floor((t % 1000) * 1e6);
    if (prev) { s -= prev[0]; ns -= prev[1]; if (ns < 0) { s--; ns += 1e9; } }
    return [s, ns];
  }, { bigint: function () { return BigInt(Math.floor(performance.now() * 1e6)); } }),
  uptime: function () { return performance.now() / 1000; },
  memoryUsage: function () { return { rss: 50e6, heapTotal: 30e6, heapUsed: 20e6, external: 1e6, arrayBuffers: 1e5 }; },
  cpuUsage: function () { return { user: Math.floor(performance.now() * 1000), system: 0 }; },
  emitWarning: function (w) { writeErr('(node) Warning: ' + (w && w.message ? w.message : w) + '\n'); },
  umask: function () { return 18; },
  getuid: function () { return 1000; }, getgid: function () { return 1000; },
  kill: function () { return true; },
  binding: function () { throw new Error('process.binding is not supported'); },
  features: {},
  config: { variables: {} },
});
Object.defineProperty(processObj, 'exitCode', { get: function () { return STATE.exitCode; }, set: function (v) { STATE.exitCode = v; }, enumerable: true });
function ExitSignal(code) { this.code = code; this.message = 'process.exit(' + code + ')'; }

/* ---------------- fs ---------------- */

function fsError(code, syscall, p, extra) {
  var msgs = { ENOENT: 'no such file or directory', EEXIST: 'file already exists', EISDIR: 'illegal operation on a directory', ENOTDIR: 'not a directory', ENOTEMPTY: 'directory not empty' };
  var e = new Error(code + ': ' + (extra || msgs[code] || code) + ', ' + syscall + " '" + p + "'");
  e.code = code; e.syscall = syscall; e.path = p; e.errno = { ENOENT: -2, EEXIST: -17, EISDIR: -21, ENOTDIR: -20, ENOTEMPTY: -39 }[code];
  return e;
}
function isDirAbs(p) {
  if (p === '/' || p === WORKSPACE) return true;
  if (STATE.dirs.has(p)) return true;
  var prefix = p + '/';
  for (var k of STATE.files.keys()) if (k.indexOf(prefix) === 0) return true;
  return false;
}
function ensureParents(p) { var d = dirOf(p); while (d && d !== '/' && !STATE.dirs.has(d)) { STATE.dirs.add(d); d = dirOf(d); } }
function toContent(data, enc) {
  if (typeof data === 'string') return enc === 'base64' || enc === 'hex' ? Buffer.from(data, enc).toString('latin1') : data;
  if (data && (ArrayBuffer.isView(data) || data instanceof ArrayBuffer)) return Buffer.from(data).toString();
  return String(data);
}
function statObj(p) {
  var isF = STATE.files.has(p);
  if (!isF && !isDirAbs(p)) throw fsError('ENOENT', 'stat', toRelDisplay(p));
  var size = isF ? te.encode(STATE.files.get(p)).length : 4096;
  var now = new Date();
  return {
    size: size, mode: isF ? 33188 : 16877, uid: 1000, gid: 1000, nlink: 1, blksize: 4096, blocks: Math.ceil(size / 512),
    atime: now, mtime: now, ctime: now, birthtime: now, atimeMs: +now, mtimeMs: +now, ctimeMs: +now, birthtimeMs: +now,
    isFile: function () { return isF; }, isDirectory: function () { return !isF; }, isSymbolicLink: function () { return false; },
    isFIFO: function () { return false; }, isSocket: function () { return false; }, isBlockDevice: function () { return false; }, isCharacterDevice: function () { return false; },
  };
}
function toRelDisplay(p) { return p.indexOf(WORKSPACE) === 0 ? p : p; }
function fsPath(p) {
  if (p && typeof p === 'object' && p.href) p = decodeURIComponent(p.pathname);
  if (Buffer.isBuffer(p)) p = p.toString();
  return resolveAbs(String(p));
}
function readdirAbs(p, withTypes) {
  if (STATE.files.has(p)) throw fsError('ENOTDIR', 'scandir', p);
  if (!isDirAbs(p)) throw fsError('ENOENT', 'scandir', p);
  var prefix = p === '/' ? '/' : p + '/';
  var names = new Map();
  STATE.files.forEach(function (_, k) { if (k.indexOf(prefix) === 0) { var rest = k.slice(prefix.length); var i = rest.indexOf('/'); names.set(i === -1 ? rest : rest.slice(0, i), i === -1 ? 'file' : 'dir'); } });
  STATE.dirs.forEach(function (d) { if (d.indexOf(prefix) === 0) { var rest = d.slice(prefix.length); var i = rest.indexOf('/'); var n = i === -1 ? rest : rest.slice(0, i); if (n && !names.has(n)) names.set(n, 'dir'); } });
  var list = Array.from(names.keys()).sort();
  if (!withTypes) return list;
  return list.map(function (n) { var isDir = names.get(n) === 'dir'; return { name: n, path: p, parentPath: p, isFile: function () { return !isDir; }, isDirectory: function () { return isDir; }, isSymbolicLink: function () { return false; } }; });
}
var fsSync = {
  existsSync: function (p) { try { var a = fsPath(p); return STATE.files.has(a) || isDirAbs(a); } catch (e) { return false; } },
  readFileSync: function (p, opts) {
    var enc = typeof opts === 'string' ? opts : opts && opts.encoding;
    if (typeof p === 'number' && p === 0) { throw new Error('Reading stdin synchronously (fs.readFileSync(0)) is not supported; use readline or process.stdin.'); }
    var a = fsPath(p);
    if (!STATE.files.has(a)) { if (isDirAbs(a)) throw fsError('EISDIR', 'read', String(p)); throw fsError('ENOENT', 'open', String(p)); }
    var content = STATE.files.get(a);
    return enc ? (enc === 'utf8' || enc === 'utf-8' ? content : Buffer.from(content).toString(enc)) : Buffer.from(content);
  },
  writeFileSync: function (p, data, opts) {
    var a = fsPath(p);
    if (isDirAbs(a) && !STATE.files.has(a)) throw fsError('EISDIR', 'open', String(p));
    if (!isDirAbs(dirOf(a))) throw fsError('ENOENT', 'open', String(p));
    var flag = opts && opts.flag;
    var content = toContent(data, typeof opts === 'string' ? opts : opts && opts.encoding);
    if (flag === 'a' && STATE.files.has(a)) content = STATE.files.get(a) + content;
    if (flag === 'wx' && STATE.files.has(a)) throw fsError('EEXIST', 'open', String(p));
    STATE.files.set(a, content);
    send({ type: 'fs', op: 'write', path: toRel(a), content: content });
  },
  appendFileSync: function (p, data) { var a = fsPath(p); fsSync.writeFileSync(p, (STATE.files.has(a) ? STATE.files.get(a) : '') + toContent(data)); },
  mkdirSync: function (p, opts) {
    var a = fsPath(p); var recursive = opts && (opts.recursive || opts === true);
    if (STATE.files.has(a)) throw fsError('EEXIST', 'mkdir', String(p));
    if (isDirAbs(a)) { if (recursive) return undefined; throw fsError('EEXIST', 'mkdir', String(p)); }
    if (!recursive && !isDirAbs(dirOf(a))) throw fsError('ENOENT', 'mkdir', String(p));
    STATE.dirs.add(a); ensureParents(a);
    send({ type: 'fs', op: 'mkdir', path: toRel(a) });
    return recursive ? a : undefined;
  },
  readdirSync: function (p, opts) { return readdirAbs(fsPath(p), opts && opts.withFileTypes); },
  statSync: function (p, opts) { try { return statObj(fsPath(p)); } catch (e) { if (opts && opts.throwIfNoEntry === false) return undefined; throw e; } },
  lstatSync: function (p, opts) { return fsSync.statSync(p, opts); },
  unlinkSync: function (p) { var a = fsPath(p); if (!STATE.files.has(a)) { if (isDirAbs(a)) throw fsError('EISDIR', 'unlink', String(p)); throw fsError('ENOENT', 'unlink', String(p)); } STATE.files.delete(a); send({ type: 'fs', op: 'rm', path: toRel(a) }); },
  rmSync: function (p, opts) {
    var a = fsPath(p); var rec = opts && opts.recursive; var force = opts && opts.force;
    if (STATE.files.has(a)) { STATE.files.delete(a); send({ type: 'fs', op: 'rm', path: toRel(a) }); return; }
    if (!isDirAbs(a)) { if (force) return; throw fsError('ENOENT', 'rm', String(p)); }
    if (!rec) throw fsError('EISDIR', 'rm', String(p), 'Path is a directory');
    Array.from(STATE.files.keys()).forEach(function (k) { if (k.indexOf(a + '/') === 0) STATE.files.delete(k); });
    Array.from(STATE.dirs).forEach(function (d) { if (d === a || d.indexOf(a + '/') === 0) STATE.dirs.delete(d); });
    send({ type: 'fs', op: 'rm', path: toRel(a) });
  },
  rmdirSync: function (p, opts) { var a = fsPath(p); if (!(opts && opts.recursive) && readdirAbs(a).length) throw fsError('ENOTEMPTY', 'rmdir', String(p)); fsSync.rmSync(p, { recursive: true }); },
  renameSync: function (from, to) {
    var a = fsPath(from); var b = fsPath(to);
    if (STATE.files.has(a)) { STATE.files.set(b, STATE.files.get(a)); STATE.files.delete(a); ensureParents(b); }
    else if (isDirAbs(a)) {
      Array.from(STATE.files.keys()).forEach(function (k) { if (k.indexOf(a + '/') === 0) { STATE.files.set(b + k.slice(a.length), STATE.files.get(k)); STATE.files.delete(k); } });
      Array.from(STATE.dirs).forEach(function (d) { if (d === a || d.indexOf(a + '/') === 0) { STATE.dirs.delete(d); STATE.dirs.add(b + d.slice(a.length)); } });
    } else throw fsError('ENOENT', 'rename', String(from));
    send({ type: 'fs', op: 'rename', path: toRel(a), to: toRel(b) });
  },
  copyFileSync: function (from, to) { fsSync.writeFileSync(to, fsSync.readFileSync(from, 'utf8')); },
  cpSync: function (from, to) { var a = fsPath(from); if (STATE.files.has(a)) return fsSync.copyFileSync(from, to); var b = fsPath(to); Array.from(STATE.files.keys()).forEach(function (k) { if (k.indexOf(a + '/') === 0) { ensureParents(b + k.slice(a.length)); fsSync.writeFileSync(b + k.slice(a.length), STATE.files.get(k)); } }); },
  accessSync: function (p) { if (!fsSync.existsSync(p)) throw fsError('ENOENT', 'access', String(p)); },
  realpathSync: function (p) { return fsPath(p); },
  openSync: function (p, flags) { var a = fsPath(p); if (/[wa]/.test(flags || 'r')) { if (flags && flags.indexOf('w') !== -1) fsSync.writeFileSync(a, ''); } else if (!STATE.files.has(a)) throw fsError('ENOENT', 'open', String(p)); return { fd: a }; },
  closeSync: function () {},
  writeSync: function (fd, data) { if (fd === 1) writeOut(data); else if (fd === 2) writeErr(data); else if (fd && fd.fd) fsSync.appendFileSync(fd.fd, data); },
  watch: function () { var w = new EventEmitter(); w.close = function () {}; return w; },
  createWriteStream: function (p, opts) {
    var a = fsPath(p); if (!(opts && opts.flags === 'a')) fsSync.writeFileSync(a, '');
    var w = makeWritable(function (s) { fsSync.appendFileSync(a, s); }, 3); w.path = p; w.close = function (cb) { if (cb) cb(); };
    return w;
  },
  createReadStream: function (p, opts) {
    var r = new EventEmitter(); var enc = opts && opts.encoding || (typeof opts === 'string' ? opts : null);
    r.setEncoding = function (e) { enc = e; return r; };
    r.pipe = function (dest) { r.on('data', function (d) { dest.write(d); }); r.on('end', function () { if (dest.end && dest !== processObj.stdout) dest.end(); }); return dest; };
    r.close = r.destroy = function () {};
    STATE.handles++;
    setTimeout(function () {
      STATE.handles--;
      try { var data = fsSync.readFileSync(p); r.emit('open'); r.emit('data', enc ? data.toString(enc) : data); r.emit('end'); r.emit('close'); } catch (e) { r.emit('error', e); }
    });
    r[Symbol.asyncIterator] = function () { var done = false; return { next: function () { if (done) return Promise.resolve({ done: true }); done = true; return Promise.resolve({ done: false, value: fsSync.readFileSync(p, enc || undefined) }); } }; };
    return r;
  },
  constants: { F_OK: 0, R_OK: 4, W_OK: 2, X_OK: 1, O_RDONLY: 0, O_WRONLY: 1, O_RDWR: 2, O_CREAT: 64, O_APPEND: 1024 },
};
fsSync.promises = {};
['readFile', 'writeFile', 'appendFile', 'mkdir', 'readdir', 'stat', 'lstat', 'unlink', 'rm', 'rmdir', 'rename', 'copyFile', 'access', 'realpath', 'cp'].forEach(function (n) {
  fsSync.promises[n] = function () { var args = arguments; return new Promise(function (res, rej) { try { res(fsSync[n + 'Sync'].apply(null, args)); } catch (e) { rej(e); } }); };
  fsSync[n] = function () {
    var args = Array.prototype.slice.call(arguments);
    var cb = typeof args[args.length - 1] === 'function' ? args.pop() : null;
    STATE.handles++;
    setTimeout(function () {
      STATE.handles--;
      var res; var err = null;
      try { res = fsSync[n + 'Sync'].apply(null, args); } catch (e) { err = e; }
      if (cb) { if (n === 'access' || n === 'writeFile' || n === 'appendFile' || n === 'unlink' || n === 'rename' || n === 'rm' || n === 'rmdir' || n === 'copyFile') cb(err); else cb(err, res); }
    });
  };
});
fsSync.exists = function (p, cb) { setTimeout(function () { cb(fsSync.existsSync(p)); }); };
fsSync.promises.constants = fsSync.constants;

/* ---------------- util ---------------- */

var utilModule = {
  format: format,
  inspect: Object.assign(function (v, opts) { return inspect(v, opts || {}, 1); }, { custom: Symbol.for('nodejs.util.inspect.custom'), defaultOptions: {} }),
  promisify: function (fn) {
    if (fn && fn[utilModule.promisify.custom]) return fn[utilModule.promisify.custom];
    return function () { var args = Array.prototype.slice.call(arguments); var ctx = this; return new Promise(function (res, rej) { fn.apply(ctx, args.concat([function (err, val) { if (err) rej(err); else res(val); }])); }); };
  },
  callbackify: function (fn) { return function () { var args = Array.prototype.slice.call(arguments); var cb = args.pop(); fn.apply(this, args).then(function (v) { cb(null, v); }, function (e) { cb(e); }); }; },
  inherits: function (ctor, superCtor) { Object.setPrototypeOf(ctor.prototype, superCtor.prototype); Object.setPrototypeOf(ctor, superCtor); ctor.super_ = superCtor; },
  deprecate: function (fn) { return fn; },
  isDeepStrictEqual: function (a, b) { return deepEqual(a, b, true); },
  types: {
    isPromise: function (v) { return v instanceof Promise; }, isDate: function (v) { return v instanceof Date; }, isRegExp: function (v) { return v instanceof RegExp; },
    isMap: function (v) { return v instanceof Map; }, isSet: function (v) { return v instanceof Set; }, isNativeError: function (v) { return v instanceof Error; },
    isTypedArray: function (v) { return ArrayBuffer.isView(v) && !(v instanceof DataView); }, isAsyncFunction: function (v) { return typeof v === 'function' && v.constructor && v.constructor.name === 'AsyncFunction'; },
  },
  isArray: Array.isArray,
  TextEncoder: TextEncoder, TextDecoder: TextDecoder,
  styleText: function (fmt, text) { return text; },
  parseArgs: function (cfg) { return { values: {}, positionals: (cfg && cfg.args) || STATE.argv.slice(2) }; },
};
utilModule.promisify.custom = Symbol.for('nodejs.util.promisify.custom');

/* ---------------- assert ---------------- */

function deepEqual(a, b, strict, seen) {
  if (strict ? Object.is(a, b) : a == b) return true; // eslint-disable-line eqeqeq
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return a !== a && b !== b; // NaN
  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  seen = seen || [];
  if (seen.indexOf(a) !== -1) return true;
  seen = seen.concat([a]);
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp) return String(a) === String(b);
  if (a instanceof Map && b instanceof Map) { if (a.size !== b.size) return false; for (var e of a) if (!b.has(e[0]) || !deepEqual(e[1], b.get(e[0]), strict, seen)) return false; return true; }
  if (a instanceof Set && b instanceof Set) { if (a.size !== b.size) return false; for (var v of a) if (!b.has(v)) return false; return true; }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  var ka = Object.keys(a); var kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (var i = 0; i < ka.length; i++) if (!Object.prototype.hasOwnProperty.call(b, ka[i]) || !deepEqual(a[ka[i]], b[ka[i]], strict, seen)) return false;
  return true;
}
function AssertionError(opts) {
  var e = new Error(opts.message || (inspect(opts.actual, {}, 1) + ' ' + opts.operator + ' ' + inspect(opts.expected, {}, 1)));
  e.name = 'AssertionError'; e.code = 'ERR_ASSERTION'; e.actual = opts.actual; e.expected = opts.expected; e.operator = opts.operator; e.generatedMessage = !opts.message;
  return e;
}
function makeAssert(strictMode) {
  function fail(actual, expected, message, operator, defaultMsg) {
    if (message instanceof Error) throw message;
    throw AssertionError({ actual: actual, expected: expected, operator: operator, message: message || defaultMsg });
  }
  var assert = function (v, m) { if (!v) fail(v, true, m, '==', 'The expression evaluated to a falsy value:\n\n  assert(' + inspect(v, {}, 1) + ')\n'); };
  assert.ok = assert;
  assert.equal = strictMode ? function (a, b, m) { if (!Object.is(a, b)) fail(a, b, m, 'strictEqual', 'Expected values to be strictly equal:\n\n' + inspect(a, {}, 1) + ' !== ' + inspect(b, {}, 1) + '\n'); } : function (a, b, m) { if (a != b) fail(a, b, m, '=='); }; // eslint-disable-line eqeqeq
  assert.notEqual = strictMode ? function (a, b, m) { if (Object.is(a, b)) fail(a, b, m, 'notStrictEqual'); } : function (a, b, m) { if (a == b) fail(a, b, m, '!='); }; // eslint-disable-line eqeqeq
  assert.strictEqual = function (a, b, m) { if (!Object.is(a, b)) fail(a, b, m, 'strictEqual', 'Expected values to be strictly equal:\n\n' + inspect(a, {}, 1) + ' !== ' + inspect(b, {}, 1) + '\n'); };
  assert.notStrictEqual = function (a, b, m) { if (Object.is(a, b)) fail(a, b, m, 'notStrictEqual', 'Expected "actual" to be strictly unequal to: ' + inspect(b, {}, 1)); };
  assert.deepEqual = function (a, b, m) { if (!deepEqual(a, b, strictMode)) fail(a, b, m, 'deepEqual', 'Expected values to be ' + (strictMode ? 'strictly ' : 'loosely ') + 'deep-equal:\n\n' + inspect(a, {}, 1) + '\n\nshould equal\n\n' + inspect(b, {}, 1)); };
  assert.deepStrictEqual = function (a, b, m) { if (!deepEqual(a, b, true)) fail(a, b, m, 'deepStrictEqual', 'Expected values to be strictly deep-equal:\n\n' + inspect(a, {}, 1) + '\n\nshould equal\n\n' + inspect(b, {}, 1)); };
  assert.notDeepStrictEqual = function (a, b, m) { if (deepEqual(a, b, true)) fail(a, b, m, 'notDeepStrictEqual'); };
  assert.notDeepEqual = function (a, b, m) { if (deepEqual(a, b, strictMode)) fail(a, b, m, 'notDeepEqual'); };
  assert.throws = function (fn, expected, m) {
    try { fn(); } catch (e) { checkThrown(e, expected, m); return; }
    fail(undefined, expected, typeof expected === 'string' ? expected : m, 'throws', 'Missing expected exception.');
  };
  assert.doesNotThrow = function (fn, m) { try { fn(); } catch (e) { fail(e, undefined, m, 'doesNotThrow', 'Got unwanted exception.\nActual message: "' + e.message + '"'); } };
  assert.rejects = function (p, expected, m) { return Promise.resolve(typeof p === 'function' ? p() : p).then(function () { fail(undefined, expected, m, 'rejects', 'Missing expected rejection.'); }, function (e) { checkThrown(e, expected, m); }); };
  assert.doesNotReject = function (p, m) { return Promise.resolve(typeof p === 'function' ? p() : p).then(function () {}, function (e) { fail(e, undefined, m, 'doesNotReject', 'Got unwanted rejection.\nActual message: "' + e.message + '"'); }); };
  assert.match = function (s, re, m) { if (!re.test(s)) fail(s, re, m, 'match', 'The input did not match the regular expression ' + re + '. Input:\n\n' + inspect(s, {}, 1) + '\n'); };
  assert.doesNotMatch = function (s, re, m) { if (re.test(s)) fail(s, re, m, 'doesNotMatch'); };
  assert.fail = function (m) { fail(undefined, undefined, m || 'Failed', 'fail'); };
  assert.ifError = function (v) { if (v !== null && v !== undefined) throw v; };
  assert.AssertionError = function (o) { return AssertionError(o || {}); };
  function checkThrown(e, expected, m) {
    if (!expected || typeof expected === 'string') return;
    if (expected instanceof RegExp) { if (!expected.test(String(e && e.message !== undefined ? e.message : e)) && !expected.test(String(e))) fail(e, expected, m, 'throws', 'The error message "' + (e && e.message) + '" does not match ' + expected); return; }
    if (typeof expected === 'function') {
      if (expected.prototype !== undefined && e instanceof expected) return;
      if (Error.isPrototypeOf(expected) || expected === Error) fail(e, expected, m, 'throws', 'The error is expected to be an instance of "' + expected.name + '". Received "' + (e && e.constructor && e.constructor.name) + '"');
      if (expected.call({}, e) === true) return;
      fail(e, expected, m, 'throws', 'The validation function is expected to return "true". Received false');
    }
    if (typeof expected === 'object') {
      Object.keys(expected).forEach(function (k) {
        var ev = expected[k]; var av = e[k];
        if (ev instanceof RegExp ? !ev.test(av) : !deepEqual(av, ev, true)) fail(e, expected, m, 'throws', 'Expected values to be strictly deep-equal (property "' + k + '"): ' + inspect(av, {}, 1) + ' !== ' + inspect(ev, {}, 1));
      });
    }
  }
  assert.strict = strictMode ? assert : null;
  return assert;
}
var assertModule = makeAssert(false);
var assertStrict = makeAssert(true);
assertModule.strict = assertStrict;
assertStrict.strict = assertStrict;

/* ---------------- readline ---------------- */

function createInterface(opts) {
  var input = (opts && opts.input) || processStdin;
  var output = opts && opts.output;
  var rl = new EventEmitter();
  var closed = false;
  var promptText = '> ';
  var questionCb = null;
  var lineWaiters = [];
  var pendingLines = [];
  var paused = false;
  STATE.handles++;
  function deliver(line) {
    if (questionCb) { var cb = questionCb; questionCb = null; cb(line); return; }
    if (lineWaiters.length) { lineWaiters.shift()({ done: false, value: line }); return; }
    if (rl.listenerCount('line') && !paused) { rl.emit('line', line); return; }
    pendingLines.push(line);
  }
  function wantInput() { return !closed && (questionCb || lineWaiters.length || (rl.listenerCount('line') && !paused)); }
  var pumping = false;
  function pump() {
    if (pumping || closed) return;
    if (pendingLines.length && wantInput()) { deliver(pendingLines.shift()); setTimeout(pump); return; }
    if (!wantInput()) return;
    pumping = true;
    readStdinChunk().then(function (chunk) {
      pumping = false;
      if (chunk === null) { rl.close(); return; }
      var lines = String(chunk).replace(/\r/g, '').split('\n');
      if (lines[lines.length - 1] === '') lines.pop();
      lines.forEach(function (l) { pendingLines.push(l); });
      while (pendingLines.length && wantInput()) deliver(pendingLines.shift());
      setTimeout(pump);
    });
  }
  rl._onAdd = function (ev) { if (ev === 'line') setTimeout(pump); };
  rl.question = function (q, optsOrCb, cb) {
    if (typeof optsOrCb === 'function') cb = optsOrCb;
    if (closed) { var err = new Error('readline was closed'); err.code = 'ERR_USE_AFTER_CLOSE'; throw err; }
    writeOut(q);
    questionCb = cb;
    pump();
  };
  rl.setPrompt = function (p) { promptText = p; };
  rl.getPrompt = function () { return promptText; };
  rl.prompt = function () { writeOut(promptText); pump(); };
  rl.write = function (d) { if (d) writeOut(d); };
  rl.pause = function () { paused = true; rl.emit('pause'); return rl; };
  rl.resume = function () { paused = false; rl.emit('resume'); pump(); return rl; };
  rl.close = function () {
    if (closed) return;
    closed = true;
    STATE.handles--;
    lineWaiters.splice(0).forEach(function (w) { w({ done: true, value: undefined }); });
    rl.emit('close');
    checkExit();
  };
  rl[Symbol.asyncIterator] = function () {
    return {
      next: function () {
        if (pendingLines.length) return Promise.resolve({ done: false, value: pendingLines.shift() });
        if (closed) return Promise.resolve({ done: true, value: undefined });
        return new Promise(function (res) { lineWaiters.push(res); pump(); });
      },
      return: function () { rl.close(); return Promise.resolve({ done: true }); },
    };
  };
  rl.terminal = true;
  rl.line = '';
  rl.input = input; rl.output = output;
  return rl;
}
var readlineModule = {
  createInterface: createInterface,
  clearLine: function () { return true; }, cursorTo: function () { return true; }, moveCursor: function () { return true; }, clearScreenDown: function () { return true; },
  emitKeypressEvents: function () {},
  Interface: function () {},
};
var readlinePromises = {
  createInterface: function (opts) {
    var rl = createInterface(opts);
    var q = rl.question;
    rl.question = function (text) { return new Promise(function (res) { q.call(rl, text, res); }); };
    return rl;
  },
};
readlineModule.promises = readlinePromises;

/* ---------------- timers (tracked so the process knows when it is idle) ---------------- */

var nativeSetTimeout = self.setTimeout.bind(self);
var nativeClearTimeout = self.clearTimeout.bind(self);
var nativeSetInterval = self.setInterval.bind(self);
var nativeClearInterval = self.clearInterval.bind(self);
var liveTimers = new Map();
function Timeout(id, repeat) { this._id = id; this._repeat = repeat; this._ref = true; }
Timeout.prototype.unref = function () { if (this._ref && liveTimers.has(this._id)) { this._ref = false; STATE.handles--; } return this; };
Timeout.prototype.ref = function () { if (!this._ref && liveTimers.has(this._id)) { this._ref = true; STATE.handles++; } return this; };
Timeout.prototype.hasRef = function () { return this._ref; };
Timeout.prototype.refresh = function () { return this; };
Timeout.prototype[Symbol.toPrimitive] = function () { return this._id; };
function trackTimer(t) { liveTimers.set(t._id, t); STATE.handles++; }
function untrack(id) { var t = liveTimers.get(id); if (!t) return; liveTimers.delete(id); if (t._ref) STATE.handles--; checkExit(); }
function idOf(t) { return t && typeof t === 'object' ? t._id : t; }
var timersModule = {
  setTimeout: function (fn, ms) {
    var args = Array.prototype.slice.call(arguments, 2); var t;
    var id = nativeSetTimeout(function () { untrackSilently(id); guard(function () { fn.apply(null, args); }); checkExit(); }, ms);
    t = new Timeout(id, false); trackTimer(t); return t;
  },
  clearTimeout: function (t) { var id = idOf(t); nativeClearTimeout(id); untrack(id); },
  setInterval: function (fn, ms) {
    var args = Array.prototype.slice.call(arguments, 2);
    var id = nativeSetInterval(function () { guard(function () { fn.apply(null, args); }); }, ms);
    var t = new Timeout(id, true); trackTimer(t); return t;
  },
  clearInterval: function (t) { var id = idOf(t); nativeClearInterval(id); untrack(id); },
  setImmediate: function (fn) { var args = Array.prototype.slice.call(arguments, 1); return timersModule.setTimeout.apply(null, [function () { fn.apply(null, args); }, 0]); },
  clearImmediate: function (t) { timersModule.clearTimeout(t); },
};
function untrackSilently(id) { var t = liveTimers.get(id); if (!t) return; liveTimers.delete(id); if (t._ref) STATE.handles--; }
var timersPromises = {
  setTimeout: function (ms, value) { return new Promise(function (res) { timersModule.setTimeout(function () { res(value); }, ms); }); },
  setImmediate: function (value) { return new Promise(function (res) { timersModule.setImmediate(function () { res(value); }); }); },
  setInterval: function (ms, value) {
    var q = []; var waiting = null;
    var t = timersModule.setInterval(function () { if (waiting) { var w = waiting; waiting = null; w({ done: false, value: value }); } else q.push(value); }, ms);
    return { [Symbol.asyncIterator]: function () { return this; }, next: function () { return q.length ? Promise.resolve({ done: false, value: q.shift() }) : new Promise(function (r) { waiting = r; }); }, return: function () { timersModule.clearInterval(t); return Promise.resolve({ done: true }); } };
  },
  scheduler: { wait: function (ms) { return timersPromises.setTimeout(ms); } },
};

/* ---------------- http + express (virtual servers served via the preview) ---------------- */

var nextReq = 0;
function IncomingMessage(init) {
  EventEmitter.call(this);
  this.method = init.method || 'GET';
  this.url = init.url || '/';
  this.headers = {};
  var self_ = this;
  Object.keys(init.headers || {}).forEach(function (k) { self_.headers[k.toLowerCase()] = init.headers[k]; });
  this.httpVersion = '1.1';
  this.socket = { remoteAddress: '127.0.0.1', encrypted: false };
  this.connection = this.socket;
  this._body = init.body || '';
}
IncomingMessage.prototype = Object.create(EventEmitter.prototype);
IncomingMessage.prototype.setEncoding = function () { return this; };
IncomingMessage.prototype[Symbol.asyncIterator] = function () { var done = false; var body = this._body; return { next: function () { if (done) return Promise.resolve({ done: true }); done = true; return Promise.resolve(body ? { done: false, value: Buffer.from(body) } : { done: true }); } }; };

function ServerResponse(reqId, onDone) {
  EventEmitter.call(this);
  this.statusCode = 200;
  this.statusMessage = '';
  this._headers = {};
  this._chunks = [];
  this.headersSent = false;
  this.finished = false;
  this.writableEnded = false;
  this._reqId = reqId;
  this._onDone = onDone;
}
ServerResponse.prototype = Object.create(EventEmitter.prototype);
ServerResponse.prototype.setHeader = function (k, v) { this._headers[String(k).toLowerCase()] = v; return this; };
ServerResponse.prototype.getHeader = function (k) { return this._headers[String(k).toLowerCase()]; };
ServerResponse.prototype.getHeaders = function () { return Object.assign({}, this._headers); };
ServerResponse.prototype.hasHeader = function (k) { return String(k).toLowerCase() in this._headers; };
ServerResponse.prototype.removeHeader = function (k) { delete this._headers[String(k).toLowerCase()]; };
ServerResponse.prototype.writeHead = function (code, msg, headers) {
  if (typeof msg === 'object') { headers = msg; msg = ''; }
  this.statusCode = code; this.statusMessage = msg || '';
  var self_ = this; Object.keys(headers || {}).forEach(function (k) { self_.setHeader(k, headers[k]); });
  this.headersSent = true;
  return this;
};
ServerResponse.prototype.write = function (chunk) { if (chunk != null) this._chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk)); this.headersSent = true; return true; };
ServerResponse.prototype.end = function (chunk, enc, cb) {
  if (typeof chunk === 'function') { cb = chunk; chunk = null; }
  if (this.finished) return this;
  if (chunk != null) this.write(chunk);
  this.finished = true; this.writableEnded = true; this.headersSent = true;
  var body = Buffer.concat(this._chunks);
  var ct = String(this._headers['content-type'] || '');
  var isText = !ct || /text|json|javascript|xml|svg|html|css|urlencoded/.test(ct);
  this._onDone({ status: this.statusCode, statusText: this.statusMessage, headers: this._headers, body: isText ? body.toString() : null, bodyBase64: isText ? null : body.toString('base64') });
  this.emit('finish');
  if (typeof cb === 'function') cb();
  return this;
};
ServerResponse.prototype.flushHeaders = function () { this.headersSent = true; };

function Server(handler) {
  EventEmitter.call(this);
  if (handler) this.on('request', handler);
  this.listening = false;
  this.port = null;
}
Server.prototype = Object.create(EventEmitter.prototype);
Server.prototype.listen = function () {
  var args = Array.prototype.slice.call(arguments);
  var cb = typeof args[args.length - 1] === 'function' ? args.pop() : null;
  var port = args[0] && typeof args[0] === 'object' ? args[0].port : args[0];
  port = Number(port) || 3000;
  if (STATE.servers.has(port)) { var e = new Error('listen EADDRINUSE: address already in use :::' + port); e.code = 'EADDRINUSE'; nativeSetTimeout(function () { guard(function () { throw e; }); }); return this; }
  this.port = port; this.listening = true;
  STATE.servers.set(port, this);
  STATE.handles++;
  send({ type: 'listen', port: port });
  var self_ = this;
  nativeSetTimeout(function () { guard(function () { self_.emit('listening'); if (cb) cb(); }); });
  return this;
};
Server.prototype.close = function (cb) {
  if (this.listening) { this.listening = false; STATE.servers.delete(this.port); STATE.handles--; send({ type: 'close-server', port: this.port }); }
  this.emit('close'); if (cb) nativeSetTimeout(cb); checkExit();
  return this;
};
Server.prototype.address = function () { return { port: this.port, family: 'IPv4', address: '127.0.0.1' }; };
Server.prototype.setTimeout = function () { return this; };
Server.prototype._handle = function (reqInit, done) {
  var req = new IncomingMessage(reqInit);
  var res = new ServerResponse(reqInit.id, done);
  res.req = req; req.res = res;
  this.emit('request', req, res);
  nativeSetTimeout(function () { if (req._body) req.emit('data', Buffer.from(req._body)); req.emit('end'); });
};

var httpModule = {
  createServer: function (opts, handler) { if (typeof opts === 'function') handler = opts; return new Server(handler); },
  Server: Server, IncomingMessage: IncomingMessage, ServerResponse: ServerResponse,
  STATUS_CODES: { 200: 'OK', 201: 'Created', 204: 'No Content', 301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict', 422: 'Unprocessable Entity', 500: 'Internal Server Error' },
  METHODS: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
  request: function () { throw new Error('http.request is not available in the playground; use fetch() instead.'); },
  get: function () { throw new Error('http.get is not available in the playground; use fetch() instead.'); },
};

function handleHttpRequest(msg) {
  var server = STATE.servers.get(Number(msg.port));
  var reply = function (r) { send(Object.assign({ type: 'http-response', id: msg.id }, r)); };
  if (!server) { reply({ status: 502, headers: { 'content-type': 'text/plain' }, body: 'No server is listening on port ' + msg.port + '. Start one with app.listen(' + msg.port + ').' }); return; }
  guard(function () { server._handle(msg, reply); }, function (err) { reply({ status: 500, headers: { 'content-type': 'text/plain' }, body: 'Internal Server Error\n\n' + mapStack(err && err.stack || String(err)) }); });
}

/* A compact Express 4 compatible framework: routing with params, middleware,
   express.json / urlencoded / static, req.query/params/body, res.send/json/
   status/redirect/sendFile/render(html). Enough for typical course projects. */
function createExpress() {
  function compile(path, end) {
    if (path instanceof RegExp) return { re: path, keys: [] };
    var keys = [];
    var src = String(path).replace(/\/$/, '').replace(/[.+^$|[\]\\]/g, '\\$&').replace(/\*/g, '(.*)')
      .replace(/:(\w+)(\?)?/g, function (_, k, opt) { keys.push(k); return opt ? '?([^/]*)?' : '([^/]+)'; })
      .replace(/\\\(\.\*\)/g, '(.*)');
    return { re: new RegExp('^' + (src || '') + (end ? '/?$' : '(?:/|$)'), 'i'), keys: keys };
  }
  function Router() {
    var stack = [];
    function router(req, res, out) { router.handle(req, res, out); }
    router.stack = stack;
    router.use = function () {
      var args = Array.prototype.slice.call(arguments);
      var path = typeof args[0] === 'string' || args[0] instanceof RegExp ? args.shift() : '/';
      args.flat(Infinity).forEach(function (fn) { stack.push({ path: path, m: compile(path === '/' ? '' : path, false), method: null, fn: fn, use: true }); });
      return router;
    };
    ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all'].forEach(function (method) {
      router[method] = function (path) {
        if (method === 'get' && arguments.length === 1 && typeof path === 'string' && router.set) return router.settings[path];
        var fns = Array.prototype.slice.call(arguments, 1).flat(Infinity);
        var m = compile(path, true);
        fns.forEach(function (fn) { stack.push({ path: path, m: m, method: method === 'all' ? null : method.toUpperCase(), fn: fn }); });
        return router;
      };
    });
    router.route = function (path) {
      var r = {};
      ['get', 'post', 'put', 'patch', 'delete', 'all'].forEach(function (m) { r[m] = function () { router[m].apply(null, [path].concat(Array.prototype.slice.call(arguments))); return r; }; });
      return r;
    };
    router.handle = function (req, res, out) {
      var idx = 0;
      var baseUrl = req.baseUrl || '';
      var fullPath = req.path;
      function next(err) {
        if (err === 'route') err = null;
        var layer;
        while ((layer = stack[idx++])) {
          var rel = fullPath.slice(baseUrl.length) || '/';
          var mm = layer.m.re.exec(rel);
          if (!mm) continue;
          if (layer.method && layer.method !== req.method && !(layer.method === 'GET' && req.method === 'HEAD')) continue;
          var params = {};
          layer.m.keys.forEach(function (k, i) { if (mm[i + 1] !== undefined) params[k] = decodeURIComponent(mm[i + 1]); });
          req.params = Object.assign({}, req.params || {}, params);
          var fn = layer.fn;
          var isErrHandler = fn.length === 4;
          if (err ? !isErrHandler : isErrHandler) continue;
          if (layer.use && fn.stack) {
            var prevBase = req.baseUrl;
            req.baseUrl = baseUrl + (layer.path === '/' ? '' : mm[0].replace(/\/$/, ''));
            try { fn.handle(req, res, function (e) { req.baseUrl = prevBase; next(e); }); } catch (e2) { req.baseUrl = prevBase; next(e2); }
            return;
          }
          try {
            var ret = err ? fn(err, req, res, next) : fn(req, res, next);
            if (ret && typeof ret.catch === 'function') ret.catch(next);
          } catch (e) { next(e); }
          return;
        }
        if (out) return out(err);
        if (err) {
          writeErr(mapStack(err.stack || String(err)) + '\n');
          if (!res.headersSent) res.status(err.status || err.statusCode || 500).type('html').send('<pre>' + escapeHtml(mapStack(err.stack || String(err))) + '</pre>');
        } else if (!res.headersSent) res.status(404).type('html').send('<!DOCTYPE html><html><head><title>Error</title></head><body><pre>Cannot ' + req.method + ' ' + escapeHtml(req.path) + '</pre></body></html>');
      }
      next();
    };
    return router;
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function enhance(app, req, res) {
    var u = new URL(req.url, 'http://localhost');
    req.path = u.pathname;
    req.originalUrl = req.url;
    req.query = {};
    u.searchParams.forEach(function (v, k) { if (k in req.query) req.query[k] = [].concat(req.query[k], v); else req.query[k] = v; });
    req.hostname = 'localhost'; req.protocol = 'http'; req.secure = false; req.ip = '127.0.0.1';
    req.get = req.header = function (h) { return req.headers[String(h).toLowerCase()]; };
    req.is = function (t) { return String(req.headers['content-type'] || '').indexOf(t.replace('json', 'application/json')) !== -1; };
    req.app = app; res.app = app; res.locals = {};
    res.status = function (c) { res.statusCode = c; return res; };
    res.sendStatus = function (c) { res.statusCode = c; return res.type('text').end(httpModule.STATUS_CODES[c] || String(c)); };
    res.set = res.header = function (k, v) { if (typeof k === 'object') Object.keys(k).forEach(function (x) { res.setHeader(x, k[x]); }); else res.setHeader(k, v); return res; };
    res.get = function (k) { return res.getHeader(k); };
    res.type = function (t) { var map = { html: 'text/html; charset=utf-8', json: 'application/json; charset=utf-8', text: 'text/plain; charset=utf-8', css: 'text/css', js: 'text/javascript' }; res.setHeader('content-type', map[t] || t); return res; };
    res.json = function (obj) { if (!res.getHeader('content-type')) res.type('json'); return res.end(JSON.stringify(obj, null, app.settings['json spaces'] || 0)); };
    res.send = function (body) {
      if (body === undefined || body === null) return res.end('');
      if (typeof body === 'number') { res.statusCode = body; return res.end(httpModule.STATUS_CODES[body] || ''); }
      if (typeof body === 'object' && !Buffer.isBuffer(body)) return res.json(body);
      if (!res.getHeader('content-type')) res.type(typeof body === 'string' ? 'html' : 'application/octet-stream');
      return res.end(body);
    };
    res.redirect = function (a, b) { var code = typeof a === 'number' ? a : 302; var to = typeof a === 'number' ? b : a; res.statusCode = code; res.setHeader('location', to); return res.end(''); };
    res.sendFile = function (p, opts, cb) {
      var root = opts && opts.root ? resolveAbs(opts.root) : '';
      var abs = root ? resolveAbs(root, p) : resolveAbs(p);
      if (!STATE.files.has(abs)) { var e = fsError('ENOENT', 'stat', abs); e.status = 404; if (typeof cb === 'function') return cb(e); res.status(404).send('Not Found'); return res; }
      res.type(mimeOf(abs)); return res.end(STATE.files.get(abs));
    };
    res.download = function (p) { res.setHeader('content-disposition', 'attachment; filename="' + baseOf(p) + '"'); return res.sendFile(p); };
    res.render = function (view, locals) {
      var dir = app.settings.views ? resolveAbs(app.settings.views) : resolveAbs('views');
      var file = [view, view + '.html', view + '.ejs'].map(function (v) { return dir + '/' + v; }).find(function (f) { return STATE.files.has(f); });
      if (!file) { res.status(500).send('Failed to lookup view "' + view + '" in views directory "' + dir + '"'); return; }
      var ctx = Object.assign({}, app.locals, res.locals, locals || {});
      var html = STATE.files.get(file).replace(/<%=\s*([\s\S]+?)\s*%>/g, function (_, expr) { try { return escapeHtml(Function.apply(null, Object.keys(ctx).concat(['return (' + expr + ');'])).apply(null, Object.keys(ctx).map(function (k) { return ctx[k]; }))); } catch (e) { return ''; } });
      res.type('html').send(html);
    };
    res.cookie = function (name, val) { res.setHeader('set-cookie', name + '=' + encodeURIComponent(val)); return res; };
    res.clearCookie = function () { return res; };
    res.append = function (k, v) { res.setHeader(k, v); return res; };
    res.links = function () { return res; };
    res.vary = function () { return res; };
    res.format = function (obj) { var fn = obj.json || obj.html || obj.text || obj.default; if (fn) fn(); return res; };
  }
  function express() {
    var app = Router();
    app.settings = { 'x-powered-by': true, env: 'development' };
    app.locals = {};
    app.set = function (k, v) { app.settings[k] = v; return app; };
    app.enable = function (k) { app.settings[k] = true; return app; };
    app.disable = function (k) { app.settings[k] = false; return app; };
    app.enabled = function (k) { return Boolean(app.settings[k]); };
    app.engine = function () { return app; };
    var handler = function (req, res) {
      enhance(app, req, res);
      app.handle(req, res);
    };
    app.listen = function () {
      var server = httpModule.createServer(handler);
      return server.listen.apply(server, arguments);
    };
    app.handler = handler;
    return app;
  }
  function bodyParser(kind) {
    return function (opts) {
      return function parse(req, res, next) {
        var ct = String(req.headers['content-type'] || '');
        if (req.body !== undefined && req._parsed) return next();
        var raw = req._body || '';
        req.body = req.body || {};
        try {
          if (kind === 'json' && ct.indexOf('json') !== -1) { req.body = raw ? JSON.parse(raw) : {}; req._parsed = true; }
          else if (kind === 'urlencoded' && ct.indexOf('urlencoded') !== -1) { var o = {}; new URLSearchParams(raw).forEach(function (v, k) { o[k] = v; }); req.body = o; req._parsed = true; }
          else if (kind === 'text' && ct.indexOf('text') !== -1) { req.body = raw; req._parsed = true; }
        } catch (e) { e.status = 400; return next(e); }
        next();
      };
    };
  }
  express.json = bodyParser('json');
  express.urlencoded = bodyParser('urlencoded');
  express.text = bodyParser('text');
  express.raw = bodyParser('raw');
  express.Router = Router;
  express.static = function (root, opts) {
    var base = resolveAbs(root);
    return function serveStatic(req, res, next) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      var rel = decodeURIComponent((req.path || '/').slice((req.baseUrl || '').length) || '/');
      var file = normalizeAbs(base + '/' + rel);
      if (file.indexOf(base) !== 0) return next();
      if (!STATE.files.has(file) && isDirAbs(file)) file = normalizeAbs(file + '/' + ((opts && opts.index) || 'index.html'));
      if (!STATE.files.has(file)) return next();
      res.type(mimeOf(file)); res.end(STATE.files.get(file));
    };
  };
  return express;
}
function mimeOf(p) {
  var map = { '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv', '.xml': 'application/xml' };
  return map[extOf(p).toLowerCase()] || 'text/plain';
}

/* ---------------- node:test (subset) ---------------- */

var nodeTestModule = null;

/* ---------------- module system ---------------- */

var TS = null;
function loadTypeScript() {
  if (TS) return TS;
  send({ type: 'status', text: 'Loading the TypeScript compiler (first time only)…' });
  // The compiler checks for Node.js globals to pick its host; hide the
  // emulated ones while it loads so it sets itself up for the browser.
  var hidden = {};
  ['process', 'require', 'module', 'exports', 'global', 'Buffer', '__filename', '__dirname'].forEach(function (k) {
    if (Object.prototype.hasOwnProperty.call(self, k)) { hidden[k] = Object.getOwnPropertyDescriptor(self, k); try { delete self[k]; } catch (e) { /* ignore */ } }
  });
  try {
    importScripts(STATE.tsUrl);
  } finally {
    Object.keys(hidden).forEach(function (k) { try { Object.defineProperty(self, k, hidden[k]); } catch (e) { /* ignore */ } });
  }
  TS = self.ts;
  if (!TS) throw new Error('Could not load the TypeScript compiler.');
  return TS;
}

function needsTransform(path, code) {
  var ext = extOf(path);
  if (ext === '.ts' || ext === '.tsx' || ext === '.jsx' || ext === '.mts' || ext === '.cts') return true;
  if (ext === '.json') return false;
  return /(^|\n|;)\s*(import\s*[\w{*'"]|export\s+(default|const|let|var|function|class|async|\{|\*))/.test(code) || /\bimport\.meta\b/.test(code);
}

function transform(path, code) {
  if (!needsTransform(path, code)) return { code: code, map: null };
  var ts = loadTypeScript();
  var ext = extOf(path);
  var options = {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
    allowJs: true,
    sourceMap: true,
    inlineSourceMap: false,
    experimentalDecorators: true,
    verbatimModuleSyntax: false,
  };
  if (ext === '.jsx' || ext === '.tsx') {
    // Automatic runtime (React 17+): no "import React" needed.
    options.jsx = ts.JsxEmit.ReactJSX;
    options.jsxImportSource = hasPackage('preact') ? 'preact' : 'react';
  }
  var out = ts.transpileModule(code, { fileName: path, reportDiagnostics: true, compilerOptions: options });
  var errs = (out.diagnostics || []).filter(function (d) { return d.category === ts.DiagnosticCategory.Error; });
  if (errs.length) {
    var d = errs[0];
    var pos = d.file && d.start != null ? d.file.getLineAndCharacterOfPosition(d.start) : null;
    var e = new SyntaxError(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    e.file = toRel(path); e.line = pos ? pos.line + 1 : 1; e.column = pos ? pos.character + 1 : 1;
    e.stack = 'SyntaxError: ' + e.message + '\n    at ' + path + ':' + e.line + ':' + e.column;
    throw e;
  }
  var map = null;
  try { map = out.sourceMapText ? decodeMappings(JSON.parse(out.sourceMapText).mappings) : null; } catch (e) { map = null; }
  var js = out.outputText.replace(/\/\/# sourceMappingURL=.*$/m, '');
  // import.meta has no meaning in CommonJS output; give it the useful bits.
  js = js.replace(/\bimport\.meta\.url\b/g, "('file://' + __filename)").replace(/\bimport\.meta\.dirname\b/g, '__dirname').replace(/\bimport\.meta\.filename\b/g, '__filename').replace(/\bimport\.meta\b/g, "({ url: 'file://' + __filename, dirname: __dirname, filename: __filename })");
  return { code: js, map: map };
}

var EXTENSIONS = ['', '.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs', '.json', '.mts', '.cts'];
function resolveFile(spec, fromDir) {
  var base = spec.charAt(0) === '/' ? (spec.indexOf(WORKSPACE) === 0 ? spec : WORKSPACE + spec) : normalizeAbs(fromDir + '/' + spec);
  // TypeScript style: import './x.js' when the file is x.ts
  var candidates = [];
  EXTENSIONS.forEach(function (e) { candidates.push(base + e); });
  if (/\.js$/.test(base)) { var stem = base.slice(0, -3); ['.ts', '.tsx', '.jsx'].forEach(function (e) { candidates.push(stem + e); }); }
  for (var i = 0; i < candidates.length; i++) if (STATE.files.has(candidates[i])) return candidates[i];
  if (isDirAbs(base)) {
    var pkg = base + '/package.json';
    if (STATE.files.has(pkg)) { try { var main = JSON.parse(STATE.files.get(pkg)).main; if (main) { var r = resolveFile('./' + main, base); if (r) return r; } } catch (e) { /* ignore */ } }
    for (var j = 1; j < EXTENSIONS.length; j++) if (STATE.files.has(base + '/index' + EXTENSIONS[j])) return base + '/index' + EXTENSIONS[j];
  }
  return null;
}

function Module(id) { this.id = id; this.filename = id; this.path = dirOf(id); this.exports = {}; this.loaded = false; this.children = []; this.paths = []; }

function builtin(name) {
  name = name.replace(/^node:/, '');
  switch (name) {
    case 'fs': return fsSync;
    case 'fs/promises': return fsSync.promises;
    case 'path': case 'path/posix': return pathModule;
    case 'events': return EventEmitter;
    case 'util': return utilModule;
    case 'assert': return assertModule;
    case 'assert/strict': return assertStrict;
    case 'readline': return readlineModule;
    case 'readline/promises': return readlinePromises;
    case 'process': return processObj;
    case 'os': return osModule;
    case 'crypto': return cryptoModule;
    case 'url': return urlModule;
    case 'querystring': return qsModule;
    case 'buffer': return { Buffer: Buffer, constants: { MAX_LENGTH: 2147483647 } };
    case 'timers': return timersModule;
    case 'timers/promises': return timersPromises;
    case 'string_decoder': return { StringDecoder: function () { return { write: function (b) { return Buffer.isBuffer(b) ? b.toString() : String(b); }, end: function () { return ''; } }; } };
    case 'http': case 'https': return httpModule;
    case 'express': return EXPRESS || (EXPRESS = createExpress());
    case 'body-parser': var ex = builtin('express'); return { json: ex.json, urlencoded: ex.urlencoded, text: ex.text, raw: ex.raw };
    case 'cors': return function cors(opts) {
      opts = opts || {};
      return function (req, res, next) {
        res.setHeader('access-control-allow-origin', opts.origin && opts.origin !== true ? [].concat(opts.origin).join(',') : '*');
        res.setHeader('access-control-allow-methods', opts.methods || 'GET,HEAD,PUT,PATCH,POST,DELETE');
        res.setHeader('access-control-allow-headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(''); }
        next();
      };
    };
    case 'dotenv': return {
      config: function (opts) {
        var p = resolveAbs((opts && opts.path) || '.env');
        if (!STATE.files.has(p)) return { error: fsError('ENOENT', 'open', p) };
        var parsed = dotenvParse(STATE.files.get(p));
        Object.keys(parsed).forEach(function (k) { if (!(k in STATE.env) || (opts && opts.override)) STATE.env[k] = parsed[k]; });
        return { parsed: parsed };
      },
      parse: function (src) { return dotenvParse(String(src)); },
    };
    case 'morgan': return function morgan(fmt) {
      return function (req, res, next) {
        var start = performance.now();
        res.on('finish', function () { writeOut('\x1b[90m' + req.method + ' ' + req.originalUrl + ' \x1b[0m' + (res.statusCode >= 400 ? '\x1b[33m' : '\x1b[32m') + res.statusCode + '\x1b[0m ' + (performance.now() - start).toFixed(3) + ' ms\n'); });
        next();
      };
    };
    case 'nodemon': return {};
    case 'vitest': case '@jest/globals': case 'jest': {
      if (!STATE.testGlobals) throw new Error("'" + name + "' can only be imported from test files. Run them with: npm test (or npx vitest)");
      var g = STATE.testGlobals;
      return Object.assign({}, g, { default: g, __esModule: true });
    }
    case 'perf_hooks': return { performance: performance };
    case 'stream': return streamModule();
    case 'test': return nodeTestModule || (nodeTestModule = makeNodeTest());
    case 'module': return { createRequire: function (from) { return makeRequire(fsPath(String(from).replace(/^file:\/\//, ''))); }, builtinModules: BUILTINS.slice() };
    case 'tty': return { isatty: function () { return true; } };
    case 'v8': return { getHeapStatistics: function () { return { total_heap_size: 3e7, used_heap_size: 2e7 }; } };
    case 'child_process': case 'worker_threads': case 'cluster': case 'net': case 'dns': case 'zlib': case 'vm':
      throw new Error("The '" + name + "' module isn't available in the browser playground.");
  }
  return undefined;
}
var EXPRESS = null;
function dotenvParse(src) {
  var out = {};
  String(src).split(/\r?\n/).forEach(function (line) {
    var m = /^\s*(?:export\s+)?([\w.-]+)\s*=\s*(.*)?\s*$/.exec(line);
    if (!m) return;
    var v = (m[2] || '').trim();
    if (/^(['"`])([\s\S]*)\1$/.test(v)) v = v.slice(1, -1).replace(/\\n/g, '\n');
    else v = v.replace(/\s+#.*$/, '');
    out[m[1]] = v;
  });
  return out;
}

var osModule = {
  EOL: '\n', platform: function () { return 'linux'; }, type: function () { return 'Linux'; }, arch: function () { return 'wasm32'; }, release: function () { return '6.0.0-toolbox'; },
  hostname: function () { return 'playground'; }, homedir: function () { return WORKSPACE; }, tmpdir: function () { return '/tmp'; }, endianness: function () { return 'LE'; },
  cpus: function () { var n = self.navigator && navigator.hardwareConcurrency || 4; return Array.from({ length: n }, function () { return { model: 'Browser CPU', speed: 2400, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } }; }); },
  totalmem: function () { return (self.navigator && navigator.deviceMemory || 8) * 1073741824; }, freemem: function () { return 2147483648; },
  uptime: function () { return Math.floor(performance.now() / 1000); }, loadavg: function () { return [0, 0, 0]; }, networkInterfaces: function () { return {}; },
  userInfo: function () { return { username: 'student', uid: 1000, gid: 1000, shell: '/bin/tsh', homedir: WORKSPACE }; }, availableParallelism: function () { return self.navigator && navigator.hardwareConcurrency || 4; },
  constants: { signals: {}, errno: {} },
};
var urlModule = {
  URL: URL, URLSearchParams: URLSearchParams,
  fileURLToPath: function (u) { return decodeURIComponent(new URL(String(u)).pathname); },
  pathToFileURL: function (p) { return new URL('file://' + resolveAbs(p)); },
  parse: function (s, parseQuery) { var u = new URL(s, 'http://localhost'); var q = {}; u.searchParams.forEach(function (v, k) { q[k] = v; }); return { href: u.href, protocol: u.protocol, host: u.host, hostname: u.hostname, port: u.port, pathname: u.pathname, search: u.search, query: parseQuery ? q : u.search.slice(1), hash: u.hash, path: u.pathname + u.search }; },
  format: function (o) { return typeof o === 'string' ? o : o.href || ((o.protocol || 'http:') + '//' + (o.host || o.hostname || '') + (o.pathname || '') + (o.search || '')); },
};
var qsModule = {
  parse: function (s) { var o = {}; new URLSearchParams(s).forEach(function (v, k) { if (k in o) o[k] = [].concat(o[k], v); else o[k] = v; }); return o; },
  stringify: function (o) { return Object.keys(o).map(function (k) { return [].concat(o[k]).map(function (v) { return encodeURIComponent(k) + '=' + encodeURIComponent(v); }).join('&'); }).join('&'); },
  escape: encodeURIComponent, unescape: decodeURIComponent,
};
function streamModule() {
  function Readable() { EventEmitter.call(this); this._buf = []; }
  Readable.prototype = Object.create(EventEmitter.prototype);
  Readable.prototype.push = function (c) { if (c === null) this.emit('end'); else this.emit('data', c); return true; };
  Readable.prototype.pipe = function (d) { this.on('data', function (c) { d.write(c); }); return d; };
  Readable.from = function (it) { var r = new Readable(); nativeSetTimeout(function () { Array.from(it).forEach(function (x) { r.emit('data', x); }); r.emit('end'); }); return r; };
  function Writable(opts) { EventEmitter.call(this); this._write = opts && opts.write; }
  Writable.prototype = Object.create(EventEmitter.prototype);
  Writable.prototype.write = function (c, e, cb) { if (this._write) this._write(c, e, cb || function () {}); return true; };
  Writable.prototype.end = function () { this.emit('finish'); };
  return { Readable: Readable, Writable: Writable, Transform: Writable, PassThrough: Writable, Stream: EventEmitter, pipeline: function () { var cb = arguments[arguments.length - 1]; if (typeof cb === 'function') nativeSetTimeout(cb); } };
}

function makeRequire(fromFile) {
  var fromDir = dirOf(fromFile);
  var req = function (spec) {
    if (typeof spec !== 'string') throw new TypeError('The "id" argument must be of type string.');
    var bare = spec.replace(/^node:/, '');
    if (spec.indexOf('node:') === 0 || BUILTINS.indexOf(bare) !== -1) {
      var b = builtin(bare);
      if (b !== undefined) return b;
    }
    if (spec.charAt(0) === '.' || spec.charAt(0) === '/') {
      var file = resolveFile(spec, fromDir);
      if (!file) {
        var err = new Error("Cannot find module '" + spec + "'\nRequire stack:\n- " + fromFile);
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }
      return loadModule(file).exports;
    }
    if (hasPackage(spec)) return packageExports(spec);
    var pkgName = spec.charAt(0) === '@' ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
    var e = new Error("Cannot find module '" + spec + "'. Install it with: npm install " + pkgName);
    e.code = 'MODULE_NOT_FOUND';
    throw e;
  };
  req.resolve = function (spec) { var f = resolveFile(spec, fromDir); if (!f) { var e = new Error("Cannot find module '" + spec + "'"); e.code = 'MODULE_NOT_FOUND'; throw e; } return f; };
  req.cache = {};
  req.main = STATE.mainModule;
  return req;
}

function hasPackage(spec) { return Object.prototype.hasOwnProperty.call(STATE.packages, spec); }
function packageExports(spec) {
  var ns = STATE.packages[spec];
  var def = ns && ns.default;
  var result;
  if (def && (typeof def === 'function' || typeof def === 'object')) {
    result = def;
    try { Object.keys(ns).forEach(function (k) { if (k !== 'default' && !(k in result)) { try { result[k] = ns[k]; } catch (e) { /* frozen */ } } }); } catch (e) { /* ignore */ }
    try { if (!('default' in result)) Object.defineProperty(result, 'default', { value: def, enumerable: false, configurable: true }); } catch (e) { /* ignore */ }
    try { if (!('__esModule' in result)) Object.defineProperty(result, '__esModule', { value: true, enumerable: false, configurable: true }); } catch (e) { /* ignore */ }
    return result;
  }
  result = Object.assign({}, ns);
  Object.defineProperty(result, '__esModule', { value: true });
  return result;
}

var indirectEval = eval;
function loadModule(file) {
  if (STATE.modules.has(file)) return STATE.modules.get(file);
  var mod = new Module(file);
  STATE.modules.set(file, mod);
  var src = STATE.files.get(file);
  if (extOf(file) === '.json') {
    try { mod.exports = JSON.parse(src); } catch (e) { throw new SyntaxError(file + ': ' + e.message); }
    mod.loaded = true;
    return mod;
  }
  var t = transform(file, src.replace(/^#!.*/, ''));
  if (t.map) STATE.sourceMaps.set(file, t.map);
  var wrapper = indirectEval('(function __pgRunner(exports, require, module, __filename, __dirname) {' + t.code + '\n})\n//# sourceURL=' + file);
  var require = makeRequire(file);
  try {
    wrapper.call(mod.exports, mod.exports, require, mod, file, dirOf(file));
  } catch (e) {
    STATE.modules.delete(file);
    throw e;
  }
  mod.loaded = true;
  return mod;
}

/* The entry module runs inside an async wrapper so top-level await works. */
async function runEntry(file) {
  var mod = new Module(file);
  STATE.mainModule = mod;
  STATE.modules.set(file, mod);
  var src = STATE.files.get(file);
  var t = transform(file, src.replace(/^#!.*/, ''));
  if (t.map) STATE.sourceMaps.set(file, t.map);
  var fn;
  try {
    fn = indirectEval('(async function __pgRunner(exports, require, module, __filename, __dirname) {' + t.code + '\n})\n//# sourceURL=' + file);
  } catch (e) {
    // Syntax errors: report with the real location when we can find it.
    var loc = syntaxLocation(file, t.code, e);
    e.file = toRel(file); e.line = loc.line; e.column = loc.column;
    throw e;
  }
  await fn.call(mod.exports, mod.exports, makeRequire(file), mod, file, dirOf(file));
  mod.loaded = true;
}
function syntaxLocation(file, code, err) {
  // Engines don't report positions for eval'd syntax errors, so ask the
  // TypeScript parser (it is exact) and fall back to bisecting by line.
  try {
    var ts = loadTypeScript();
    var out = ts.transpileModule(code, { fileName: file.replace(/\.[mc]?[jt]sx?$/, '') + '.js', reportDiagnostics: true, compilerOptions: { allowJs: true, target: ts.ScriptTarget.ES2022 } });
    var d = (out.diagnostics || []).filter(function (x) { return x.category === ts.DiagnosticCategory.Error && x.start != null; })[0];
    if (d) {
      var pos = d.file.getLineAndCharacterOfPosition(d.start);
      err.message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
      return mapPosition(file, pos.line + 1, pos.character + 1) || { line: pos.line + 1, column: pos.character + 1 };
    }
  } catch (e) { /* compiler unavailable offline: bisect */ }
  var lines = code.split('\n');
  for (var i = 1; i <= lines.length; i++) {
    try { indirectEval('(async function(){' + lines.slice(0, i).join('\n') + '\n})'); } catch (e) {
      if (!/Unexpected end of input|missing \) after|Unterminated/.test(e.message) || i === lines.length) {
        return mapPosition(file, i, 1) || { line: i, column: 1 };
      }
    }
  }
  return { line: 1, column: 1 };
}

/* ---------------- package prefetch (esm.sh) ---------------- */

async function loadPackages(urls) {
  var names = Object.keys(urls || {});
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    if (hasPackage(name)) continue;
    try {
      STATE.packages[name] = await import(urls[name]);
    } catch (e) {
      send({ type: 'status', text: 'Could not load package ' + name + ' (' + (e && e.message || e) + ')' });
    }
  }
}

/* ---------------- lifecycle ---------------- */

var exitTimer = null;
function checkExit() {
  if (!STATE.mainDone || STATE.finished) return;
  nativeClearTimeout(exitTimer);
  exitTimer = nativeSetTimeout(function () {
    if (STATE.finished) return;
    var stdinBusy = STATE.stdinWaiters.length || (processStdin.listenerCount('data') && !processStdin.paused && !STATE.stdinEOF);
    if (STATE.handles <= 0 && !stdinBusy) finish(STATE.exitCode || 0);
  }, 30);
}
function finish(code) {
  if (STATE.finished) return;
  STATE.finished = true;
  try { processObj.emit('beforeExit', code); } catch (e) { /* ignore */ }
  try { processObj.emit('exit', code); } catch (e) { /* ignore */ }
  send({ type: 'exit', code: code });
}
function reportError(err) {
  if (err instanceof ExitSignal) { finish(err.code); return; }
  var stack = err && err.stack ? mapStack(err.stack) : String(err);
  if (err && typeof err === 'object' && !(err instanceof Error)) stack = 'Uncaught ' + inspect(err);
  var loc = err && err.file ? { file: err.file, line: err.line, column: err.column } : firstWorkspaceFrame(err && err.stack);
  if (loc && err && err.name === 'SyntaxError' && err.file) stack = loc.file + ':' + loc.line + '\n' + (err.name + ': ' + err.message);
  writeErr('\x1b[31m' + stack + '\x1b[0m\n');
  if (err && /\b(document|window|localStorage|alert) is not defined/.test(err.message || '')) {
    writeErr('\x1b[33mHint: this file runs as a Node.js program, which has no browser page. Put browser code in an .html page (or a script it loads) and open the Preview.\x1b[0m\n');
  }
  send({ type: 'error', message: err && err.message || String(err), name: err && err.name, stack: stack, file: loc && loc.file, line: loc && loc.line, column: loc && loc.column });
}
function guard(fn, onError) {
  try { return fn(); } catch (e) {
    if (onError) return onError(e);
    if (e instanceof ExitSignal) { finish(e.code); return; }
    reportError(e);
    finish(1);
  }
}
self.addEventListener('unhandledrejection', function (e) {
  e.preventDefault();
  var r = e.reason;
  if (r instanceof ExitSignal) { finish(r.code); return; }
  reportError(r);
  finish(1);
});
self.addEventListener('error', function (e) {
  if (e.error instanceof ExitSignal) { e.preventDefault(); finish(e.error.code); }
});

/* ---------------- test runner (describe/it/expect) ---------------- */

function makeExpect(results) {
  function fmtV(v) { return inspect(v, { depth: 3 }, 1); }
  function Assertion(actual, negate, promise) { this.actual = actual; this.negate = negate; this.promise = promise; }
  function check(a, pass, msg) { if (pass === a.negate) throw Object.assign(new Error(msg(a.negate)), { name: 'AssertionError', matcherResult: true }); }
  var matchers = {
    toBe: function (e) { var a = this; check(a, Object.is(a.actual, e), function (n) { return 'expected ' + fmtV(a.actual) + (n ? ' not' : '') + ' to be ' + fmtV(e) + (typeof e === 'object' && e && deepEqual(a.actual, e, true) ? ' // Object.is equality: use toEqual for objects' : ''); }); },
    toEqual: function (e) { var a = this; check(a, deepEqual(stripUndefined(a.actual), stripUndefined(e), false), function (n) { return 'expected ' + fmtV(a.actual) + (n ? ' not' : '') + ' to deeply equal ' + fmtV(e); }); },
    toStrictEqual: function (e) { var a = this; check(a, deepEqual(a.actual, e, true), function (n) { return 'expected ' + fmtV(a.actual) + (n ? ' not' : '') + ' to strictly equal ' + fmtV(e); }); },
    toBeTruthy: function () { var a = this; check(a, Boolean(a.actual), function (n) { return 'expected ' + fmtV(a.actual) + ' to be ' + (n ? 'falsy' : 'truthy'); }); },
    toBeFalsy: function () { var a = this; check(a, !a.actual, function (n) { return 'expected ' + fmtV(a.actual) + ' to be ' + (n ? 'truthy' : 'falsy'); }); },
    toBeNull: function () { var a = this; check(a, a.actual === null, function (n) { return 'expected ' + fmtV(a.actual) + (n ? ' not' : '') + ' to be null'; }); },
    toBeUndefined: function () { var a = this; check(a, a.actual === undefined, function (n) { return 'expected ' + fmtV(a.actual) + (n ? ' not' : '') + ' to be undefined'; }); },
    toBeDefined: function () { var a = this; check(a, a.actual !== undefined, function (n) { return 'expected value' + (n ? ' not' : '') + ' to be defined'; }); },
    toBeNaN: function () { var a = this; check(a, Number.isNaN(a.actual), function (n) { return 'expected ' + fmtV(a.actual) + (n ? ' not' : '') + ' to be NaN'; }); },
    toBeGreaterThan: function (e) { var a = this; check(a, a.actual > e, function (n) { return 'expected ' + fmtV(a.actual) + (n ? ' not' : '') + ' to be greater than ' + fmtV(e); }); },
    toBeGreaterThanOrEqual: function (e) { var a = this; check(a, a.actual >= e, function (n) { return 'expected ' + fmtV(a.actual) + (n ? ' not' : '') + ' to be >= ' + fmtV(e); }); },
    toBeLessThan: function (e) { var a = this; check(a, a.actual < e, function (n) { return 'expected ' + fmtV(a.actual) + (n ? ' not' : '') + ' to be less than ' + fmtV(e); }); },
    toBeLessThanOrEqual: function (e) { var a = this; check(a, a.actual <= e, function (n) { return 'expected ' + fmtV(a.actual) + (n ? ' not' : '') + ' to be <= ' + fmtV(e); }); },
    toBeCloseTo: function (e, digits) { var a = this; var d = digits == null ? 2 : digits; check(a, Math.abs(a.actual - e) < Math.pow(10, -d) / 2, function (n) { return 'expected ' + fmtV(a.actual) + (n ? ' not' : '') + ' to be close to ' + fmtV(e); }); },
    toContain: function (e) { var a = this; check(a, a.actual != null && (typeof a.actual === 'string' ? a.actual.indexOf(e) !== -1 : Array.from(a.actual).indexOf(e) !== -1), function (n) { return 'expected ' + fmtV(a.actual) + (n ? ' not' : '') + ' to contain ' + fmtV(e); }); },
    toContainEqual: function (e) { var a = this; check(a, Array.from(a.actual || []).some(function (x) { return deepEqual(x, e, false); }), function (n) { return 'expected ' + fmtV(a.actual) + (n ? ' not' : '') + ' to contain an item equal to ' + fmtV(e); }); },
    toHaveLength: function (e) { var a = this; check(a, a.actual != null && a.actual.length === e, function (n) { return 'expected length ' + (a.actual && a.actual.length) + (n ? ' not' : '') + ' to be ' + e; }); },
    toHaveProperty: function (k, v) { var a = this; var path = Array.isArray(k) ? k : String(k).split('.'); var cur = a.actual; var ok = true; for (var i = 0; i < path.length; i++) { if (cur == null || !(path[i] in Object(cur))) { ok = false; break; } cur = cur[path[i]]; } if (ok && arguments.length > 1) ok = deepEqual(cur, v, false); check(a, ok, function (n) { return 'expected ' + fmtV(a.actual) + (n ? ' not' : '') + ' to have property ' + path.join('.') + (arguments.length > 1 ? ' = ' + fmtV(v) : ''); }); },
    toMatch: function (e) { var a = this; check(a, typeof e === 'string' ? String(a.actual).indexOf(e) !== -1 : e.test(String(a.actual)), function (n) { return 'expected ' + fmtV(a.actual) + (n ? ' not' : '') + ' to match ' + fmtV(e); }); },
    toMatchObject: function (e) { var a = this; check(a, matchObject(a.actual, e), function (n) { return 'expected ' + fmtV(a.actual) + (n ? ' not' : '') + ' to match object ' + fmtV(e); }); },
    toBeInstanceOf: function (e) { var a = this; check(a, a.actual instanceof e, function (n) { return 'expected value' + (n ? ' not' : '') + ' to be an instance of ' + (e && e.name); }); },
    toBeTypeOf: function (e) { var a = this; check(a, typeof a.actual === e, function (n) { return 'expected ' + fmtV(a.actual) + (n ? ' not' : '') + ' to be type ' + e; }); },
    toThrow: function (e) {
      var a = this; var threw = false; var err;
      if (a.thrown !== undefined) { threw = true; err = a.thrown; } else { try { a.actual(); } catch (x) { threw = true; err = x; } }
      var ok = threw && (e === undefined || (typeof e === 'string' ? String(err && err.message).indexOf(e) !== -1 : e instanceof RegExp ? e.test(String(err && err.message)) : typeof e === 'function' ? err instanceof e : deepEqual(err && err.message, e && e.message, false)));
      check(a, ok, function (n) { return n ? 'expected function not to throw, but it threw ' + fmtV(err) : threw ? 'expected function to throw ' + fmtV(e) + ' but it threw ' + fmtV(err) : 'expected function to throw' + (e !== undefined ? ' ' + fmtV(e) : ''); });
    },
    toHaveBeenCalled: function () { var a = this; check(a, mockCalls(a.actual).length > 0, function (n) { return 'expected mock' + (n ? ' not' : '') + ' to have been called'; }); },
    toHaveBeenCalledTimes: function (t) { var a = this; check(a, mockCalls(a.actual).length === t, function (n) { return 'expected mock to have been called ' + t + ' times, but it was called ' + mockCalls(a.actual).length + ' times'; }); },
    toHaveBeenCalledWith: function () { var a = this; var args = Array.prototype.slice.call(arguments); check(a, mockCalls(a.actual).some(function (c) { return deepEqual(c, args, false); }), function (n) { return 'expected mock' + (n ? ' not' : '') + ' to have been called with ' + fmtV(args) + '\nCalls: ' + fmtV(mockCalls(a.actual)); }); },
    toHaveBeenLastCalledWith: function () { var a = this; var args = Array.prototype.slice.call(arguments); var calls = mockCalls(a.actual); check(a, calls.length && deepEqual(calls[calls.length - 1], args, false), function (n) { return 'expected last call to be ' + fmtV(args); }); },
    toHaveReturnedWith: function (v) { var a = this; check(a, (a.actual.mock.results || []).some(function (r) { return deepEqual(r.value, v, false); }), function (n) { return 'expected mock' + (n ? ' not' : '') + ' to have returned ' + fmtV(v); }); },
  };
  matchers.toBeCalled = matchers.toHaveBeenCalled; matchers.toBeCalledWith = matchers.toHaveBeenCalledWith; matchers.toThrowError = matchers.toThrow;
  function mockCalls(fn) { if (!fn || !fn.mock) throw new Error('value is not a mock function (use vi.fn() or jest.fn())'); return fn.mock.calls; }
  function matchObject(a, e) { if (typeof e !== 'object' || e === null) return deepEqual(a, e, false); if (a == null) return false; return Object.keys(e).every(function (k) { return matchObject(a[k], e[k]); }); }
  function stripUndefined(v) { if (!v || typeof v !== 'object' || Array.isArray(v) || v instanceof Date || v instanceof Map || v instanceof Set) return v; var o = {}; Object.keys(v).forEach(function (k) { if (v[k] !== undefined) o[k] = stripUndefined(v[k]); }); return o; }
  Object.keys(matchers).forEach(function (name) {
    Assertion.prototype[name] = function () {
      var self_ = this; var args = arguments;
      if (self_.promise) {
        return Promise.resolve(self_.actual).then(function (v) {
          if (self_.promise === 'rejects') throw Object.assign(new Error('expected promise to reject but it resolved with ' + fmtV(v)), { name: 'AssertionError' });
          var a = new Assertion(v, self_.negate); return matchers[name].apply(a, args);
        }, function (err) {
          if (self_.promise === 'resolves') throw Object.assign(new Error('expected promise to resolve but it rejected with ' + fmtV(err)), { name: 'AssertionError' });
          var a = new Assertion(err, self_.negate); if (name === 'toThrow' || name === 'toThrowError') a.thrown = err; return matchers[name].apply(a, args);
        });
      }
      return matchers[name].apply(self_, args);
    };
  });
  function expect(actual) {
    var a = new Assertion(actual, false);
    a.not = new Assertion(actual, true);
    a.resolves = new Assertion(actual, false, 'resolves'); a.resolves.not = new Assertion(actual, true, 'resolves');
    a.rejects = new Assertion(actual, false, 'rejects'); a.rejects.not = new Assertion(actual, true, 'rejects');
    return a;
  }
  expect.any = function (T) { return { asymmetricMatch: function (v) { return v != null && (v.constructor === T || v instanceof T); } }; };
  expect.anything = function () { return { asymmetricMatch: function (v) { return v != null; } }; };
  expect.extend = function (obj) { Object.keys(obj).forEach(function (k) { Assertion.prototype[k] = function () { var r = obj[k].apply({ isNot: this.negate }, [this.actual].concat(Array.prototype.slice.call(arguments))); if (r.pass === this.negate) throw Object.assign(new Error(typeof r.message === 'function' ? r.message() : r.message), { name: 'AssertionError' }); }; }); };
  expect.assertions = function () {};
  expect.hasAssertions = function () {};
  return expect;
}
function makeMockFn(impl) {
  var calls = []; var results = []; var instances = [];
  var queue = [];
  var mock = function () {
    var args = Array.prototype.slice.call(arguments);
    calls.push(args); instances.push(this);
    var f = queue.length ? queue.shift() : mock._impl;
    try { var v = f ? f.apply(this, args) : undefined; results.push({ type: 'return', value: v }); return v; } catch (e) { results.push({ type: 'throw', value: e }); throw e; }
  };
  mock._impl = impl;
  mock.mock = { calls: calls, results: results, instances: instances, get lastCall() { return calls[calls.length - 1]; } };
  mock.mockImplementation = function (f) { mock._impl = f; return mock; };
  mock.mockImplementationOnce = function (f) { queue.push(f); return mock; };
  mock.mockReturnValue = function (v) { mock._impl = function () { return v; }; return mock; };
  mock.mockReturnValueOnce = function (v) { queue.push(function () { return v; }); return mock; };
  mock.mockResolvedValue = function (v) { mock._impl = function () { return Promise.resolve(v); }; return mock; };
  mock.mockRejectedValue = function (v) { mock._impl = function () { return Promise.reject(v); }; return mock; };
  mock.mockClear = function () { calls.length = 0; results.length = 0; instances.length = 0; return mock; };
  mock.mockReset = function () { mock.mockClear(); mock._impl = undefined; queue.length = 0; return mock; };
  mock.getMockName = function () { return 'vi.fn()'; };
  mock._isMockFunction = true;
  return mock;
}
function makeViGlobal() {
  var spies = [];
  var api = {
    fn: makeMockFn,
    spyOn: function (obj, key) { var orig = obj[key]; var m = makeMockFn(function () { return orig.apply(this, arguments); }); m.mockRestore = function () { obj[key] = orig; }; obj[key] = m; spies.push(m); return m; },
    restoreAllMocks: function () { spies.splice(0).forEach(function (s) { s.mockRestore(); }); },
    clearAllMocks: function () { spies.forEach(function (s) { s.mockClear(); }); },
    resetAllMocks: function () { spies.forEach(function (s) { s.mockReset(); }); },
    useFakeTimers: function () { return api; }, useRealTimers: function () { return api; },
    advanceTimersByTime: function () {}, runAllTimers: function () {},
    isMockFunction: function (f) { return Boolean(f && f._isMockFunction); },
  };
  return api;
}

async function runTests(testFiles) {
  var results = [];
  var expect = makeExpect(results);
  var vi = makeViGlobal();
  var started = performance.now();
  var fileSummaries = [];
  var onlyMode = false;
  for (var fi = 0; fi < testFiles.length; fi++) {
    var file = testFiles[fi];
    var root = { name: '', tests: [], suites: [], hooks: { beforeAll: [], afterAll: [], beforeEach: [], afterEach: [] }, parent: null, skip: false, only: false };
    var current = root;
    var mk = function (skip, only) {
      return function (name, fn, timeout) {
        if (only) onlyMode = true;
        current.tests.push({ name: String(name), fn: fn, skip: skip || !fn, only: only, timeout: typeof timeout === 'number' ? timeout : 5000 });
      };
    };
    var describeMk = function (skip, only) {
      return function (name, fn) {
        if (only) onlyMode = true;
        var s = { name: String(name), tests: [], suites: [], hooks: { beforeAll: [], afterAll: [], beforeEach: [], afterEach: [] }, parent: current, skip: skip, only: only };
        current.suites.push(s);
        var prev = current; current = s;
        try { var r = fn && fn(); if (r && r.then) writeErr('describe() callbacks should not be async\n'); } finally { current = prev; }
      };
    };
    var test = mk(false, false); test.skip = mk(true, false); test.only = mk(false, true); test.todo = function (n) { current.tests.push({ name: n, skip: true, todo: true }); };
    test.each = function (table) { return function (name, fn) { table.forEach(function (row, i) { var args = Array.isArray(row) ? row : [row]; test(formatEachName(name, args, i), function () { return fn.apply(null, args); }); }); }; };
    var describe = describeMk(false, false); describe.skip = describeMk(true, false); describe.only = describeMk(false, true);
    describe.each = function (table) { return function (name, fn) { table.forEach(function (row, i) { var args = Array.isArray(row) ? row : [row]; describe(formatEachName(name, args, i), function () { return fn.apply(null, args); }); }); }; };
    var hooks = {};
    ['beforeAll', 'afterAll', 'beforeEach', 'afterEach'].forEach(function (h) { hooks[h] = function (fn) { current.hooks[h].push(fn); }; });
    var globals = { describe: describe, it: test, test: test, expect: expect, vi: vi, jest: vi, beforeAll: hooks.beforeAll, afterAll: hooks.afterAll, beforeEach: hooks.beforeEach, afterEach: hooks.afterEach, before: hooks.beforeAll, after: hooks.afterAll, suite: describe };
    Object.keys(globals).forEach(function (k) { self[k] = globals[k]; });
    STATE.testGlobals = globals;
    var loadError = null;
    try {
      STATE.modules.clear();
      await runEntry(file);
    } catch (e) { loadError = e; }
    var fileResult = { file: toRel(file), tests: [], error: loadError ? (mapStack(loadError.stack || String(loadError))) : null };
    if (!loadError) await runSuite(root, [], fileResult, onlyMode);
    fileSummaries.push(fileResult);
  }
  var summary = { files: fileSummaries, duration: performance.now() - started };
  printTestSummary(summary);
  send({ type: 'test-report', results: summary });
  var failed = fileSummaries.some(function (f) { return f.error || f.tests.some(function (t) { return t.status === 'fail'; }); });
  return failed ? 1 : 0;
}
function formatEachName(name, args, i) {
  var k = 0;
  return String(name).replace(/%[sdifjo#%]/g, function (m) { if (m === '%%') return '%'; if (m === '%#') return String(i); return inspect(args[k++], {}, 1); }).replace(/\$(\w+)/g, function (_, key) { return args[0] && typeof args[0] === 'object' ? inspect(args[0][key], {}, 1) : _; });
}
function suiteHasOnly(s) { return s.only || s.tests.some(function (t) { return t.only; }) || s.suites.some(suiteHasOnly); }
async function runWithTimeout(fn, ms) {
  if (!fn) return;
  return new Promise(function (resolve, reject) {
    var done = false;
    var t = nativeSetTimeout(function () { if (!done) { done = true; reject(new Error('Test timed out in ' + ms + 'ms.')); } }, ms);
    try {
      if (fn.length >= 1) {
        fn(function (err) { if (done) return; done = true; nativeClearTimeout(t); if (err) reject(err); else resolve(); });
      } else {
        Promise.resolve(fn()).then(function () { if (!done) { done = true; nativeClearTimeout(t); resolve(); } }, function (e) { if (!done) { done = true; nativeClearTimeout(t); reject(e); } });
      }
    } catch (e) { done = true; nativeClearTimeout(t); reject(e); }
  });
}
async function runSuite(suite, path, fileResult, onlyMode) {
  var names = suite.name ? path.concat([suite.name]) : path;
  var chainEach = function (s, kind) { var list = []; for (var p = s; p; p = p.parent) list = kind === 'beforeEach' ? p.hooks.beforeEach.concat(list) : list.concat(p.hooks.afterEach); return list; };
  var skipSuite = suite.skip || (onlyMode && !suiteHasOnly(suite) && !isUnderOnly(suite));
  try { if (!skipSuite) for (var i = 0; i < suite.hooks.beforeAll.length; i++) await runWithTimeout(suite.hooks.beforeAll[i], 10000); } catch (e) {
    fileResult.tests.push({ name: names.concat(['beforeAll']).join(' > '), status: 'fail', error: formatTestError(e) });
    return;
  }
  for (var k = 0; k < suite.tests.length; k++) {
    var t = suite.tests[k];
    var fullName = names.concat([t.name]).join(' > ');
    var skip = skipSuite || t.skip || (onlyMode && !t.only && !isUnderOnly(suite));
    if (skip) { fileResult.tests.push({ name: fullName, status: t.todo ? 'todo' : 'skip' }); continue; }
    var start = performance.now();
    try {
      var bes = chainEach(suite, 'beforeEach');
      for (var b = 0; b < bes.length; b++) await runWithTimeout(bes[b], 10000);
      await runWithTimeout(t.fn, t.timeout);
      var aes = chainEach(suite, 'afterEach');
      for (var a = 0; a < aes.length; a++) await runWithTimeout(aes[a], 10000);
      fileResult.tests.push({ name: fullName, status: 'pass', duration: performance.now() - start });
    } catch (e) {
      fileResult.tests.push({ name: fullName, status: 'fail', duration: performance.now() - start, error: formatTestError(e) });
    }
  }
  for (var s = 0; s < suite.suites.length; s++) await runSuite(suite.suites[s], names, fileResult, onlyMode);
  try { if (!skipSuite) for (var j = 0; j < suite.hooks.afterAll.length; j++) await runWithTimeout(suite.hooks.afterAll[j], 10000); } catch (e) {
    fileResult.tests.push({ name: names.concat(['afterAll']).join(' > '), status: 'fail', error: formatTestError(e) });
  }
}
function isUnderOnly(s) { for (var p = s; p; p = p.parent) if (p.only) return true; return false; }
function formatTestError(e) {
  var loc = firstWorkspaceFrame(e && e.stack);
  return { message: (e && e.message) || String(e), stack: mapStack(e && e.stack || ''), file: loc && loc.file, line: loc && loc.line, column: loc && loc.column };
}
function printTestSummary(summary) {
  var passed = 0; var failed = 0; var skipped = 0;
  summary.files.forEach(function (f) {
    var ff = f.error || f.tests.some(function (t) { return t.status === 'fail'; });
    writeOut((ff ? '\x1b[41m\x1b[97m FAIL \x1b[0m ' : '\x1b[42m\x1b[30m PASS \x1b[0m ') + f.file + '\n');
    if (f.error) { writeOut('\x1b[31m  ● Test suite failed to run\n\n' + f.error.split('\n').map(function (l) { return '    ' + l; }).join('\n') + '\x1b[0m\n'); failed++; return; }
    f.tests.forEach(function (t) {
      if (t.status === 'pass') { passed++; writeOut('  \x1b[32m✓\x1b[0m ' + t.name + ' \x1b[90m(' + Math.max(1, Math.round(t.duration)) + ' ms)\x1b[0m\n'); }
      else if (t.status === 'fail') { failed++; writeOut('  \x1b[31m✕ ' + t.name + '\x1b[0m\n'); }
      else { skipped++; writeOut('  \x1b[33m○\x1b[0m ' + t.name + (t.status === 'todo' ? ' \x1b[90m(todo)\x1b[0m' : ' \x1b[90m(skipped)\x1b[0m') + '\n'); }
    });
    f.tests.filter(function (t) { return t.status === 'fail'; }).forEach(function (t) {
      writeOut('\n\x1b[31m  ● ' + t.name + '\x1b[0m\n\n    ' + String(t.error.message).split('\n').join('\n    ') + '\n' + (t.error.file ? '\n    \x1b[90mat ' + t.error.file + ':' + t.error.line + ':' + t.error.column + '\x1b[0m\n' : '') + '\n');
    });
  });
  var filesFailed = summary.files.filter(function (f) { return f.error || f.tests.some(function (t) { return t.status === 'fail'; }); }).length;
  writeOut('\n\x1b[1mTest Files\x1b[0m  ' + (filesFailed ? '\x1b[31m' + filesFailed + ' failed\x1b[0m | ' : '') + '\x1b[32m' + (summary.files.length - filesFailed) + ' passed\x1b[0m (' + summary.files.length + ')\n');
  writeOut('\x1b[1m     Tests\x1b[0m  ' + (failed ? '\x1b[31m' + failed + ' failed\x1b[0m | ' : '') + '\x1b[32m' + passed + ' passed\x1b[0m' + (skipped ? ' | \x1b[33m' + skipped + ' skipped\x1b[0m' : '') + ' (' + (passed + failed + skipped) + ')\n');
  writeOut('\x1b[1m  Duration\x1b[0m  ' + Math.round(summary.duration) + ' ms\n');
}
function makeNodeTest() {
  // node:test style: test(name, fn), describe/it, with t.test subtests, run in order.
  var queue = [];
  var assert = assertStrict;
  var testFn = function (name, opts, fn) {
    if (typeof opts === 'function') { fn = opts; opts = {}; }
    queue.push({ name: name, fn: fn, skip: opts && opts.skip });
    if (queue.length === 1) nativeSetTimeout(runNodeTests);
  };
  async function runNodeTests() {
    var pass = 0; var fail = 0; STATE.handles++;
    while (queue.length) {
      var t = queue.shift();
      if (t.skip) { writeOut('\x1b[33m﹣ ' + t.name + ' (skipped)\x1b[0m\n'); continue; }
      try { await t.fn({ name: t.name, test: function (n, f) { return Promise.resolve(f({})); }, diagnostic: function (m) { writeOut('# ' + m + '\n'); }, assert: assert }); pass++; writeOut('\x1b[32m✔ ' + t.name + '\x1b[0m\n'); }
      catch (e) { fail++; writeOut('\x1b[31m✖ ' + t.name + '\n  ' + String(e.message).split('\n').join('\n  ') + '\x1b[0m\n'); }
    }
    writeOut('ℹ tests ' + (pass + fail) + '\nℹ pass ' + pass + '\nℹ fail ' + fail + '\n');
    if (fail) STATE.exitCode = 1;
    STATE.handles--; checkExit();
  }
  testFn.test = testFn; testFn.it = testFn; testFn.describe = function (n, fn) { fn(); }; testFn.skip = function (n, fn) { testFn(n, { skip: true }, fn); };
  testFn.before = testFn.after = testFn.beforeEach = testFn.afterEach = function () {};
  testFn.mock = { fn: makeMockFn };
  return testFn;
}

/* ---------------- REPL ---------------- */

async function replEval(code) {
  var src = String(code || '');
  // Top-level const/let should survive to the next line, like the Node REPL.
  var hoisted = src.replace(/^(\s*)(const|let)\s+/, '$1var ');
  var value;
  try {
    var asExpr;
    try { asExpr = indirectEval('(function(){ return (' + hoisted + '\n); })'); } catch (e) { asExpr = null; }
    if (asExpr && !/^\s*(var|function|class|if|for|while|do|switch|try|throw|return|import)\b/.test(hoisted)) {
      value = indirectEval('(' + hoisted + '\n)');
    } else if (/\bawait\b/.test(hoisted)) {
      value = await indirectEval('(async () => {' + hoisted + '\n})()');
    } else {
      value = indirectEval(hoisted);
    }
    if (value && typeof value.then === 'function') value = await value;
    if (value !== undefined) writeOut(inspect(value, {}, 1) + '\n');
    self._ = value;
  } catch (err) {
    if (err instanceof ExitSignal) { finish(err.code); return; }
    writeErr('Uncaught ' + (err && err.stack ? mapStack(err.stack).split('\n').slice(0, 1).join('\n') : inspect(err)) + '\n');
  }
  send({ type: 'repl-done' });
}

/* ---------------- entry point ---------------- */

function installGlobals() {
  var g = self;
  g.global = g;
  g.process = processObj;
  g.Buffer = Buffer;
  g.console = consoleShim;
  g.setTimeout = timersModule.setTimeout; g.clearTimeout = timersModule.clearTimeout;
  g.setInterval = timersModule.setInterval; g.clearInterval = timersModule.clearInterval;
  g.setImmediate = timersModule.setImmediate; g.clearImmediate = timersModule.clearImmediate;
  g.require = makeRequire(WORKSPACE + '/__repl__.js');
}

self.onmessage = async function (e) {
  var msg = e.data || {};
  if (msg.type === 'stdin') { onStdinData(msg.data); return; }
  if (msg.type === 'http-request') { handleHttpRequest(msg); return; }
  if (msg.type === 'repl-eval') { replEval(msg.code); return; }
  if (msg.type !== 'run' && msg.type !== 'repl-init') return;

  STATE.tsUrl = msg.tsUrl || STATE.tsUrl;
  STATE.syncBase = msg.syncBase || STATE.syncBase;
  STATE.syncAvailable = msg.syncAvailable === false ? false : null;
  STATE.cwd = msg.cwd ? normalizeAbs(WORKSPACE + '/' + msg.cwd) : WORKSPACE;
  STATE.env = Object.assign({ HOME: WORKSPACE, USER: 'student', PATH: '/usr/local/bin:/usr/bin:/bin', NODE_ENV: 'development' }, msg.env || {});
  Object.keys(msg.files || {}).forEach(function (k) { STATE.files.set(normalizeAbs(WORKSPACE + '/' + k), String(msg.files[k])); });
  (msg.dirs || []).forEach(function (d) { STATE.dirs.add(normalizeAbs(WORKSPACE + '/' + d)); });
  processObj.env = STATE.env;
  var entryAbs = msg.entry ? normalizeAbs(WORKSPACE + '/' + msg.entry) : WORKSPACE + '/__eval__.js';
  processObj.argv = ['/usr/local/bin/node', entryAbs].concat(msg.argv || []);
  STATE.argv = processObj.argv;
  installGlobals();

  if (msg.type === 'repl-init') {
    await loadPackages(msg.packages);
    STATE.replMode = true;
    send({ type: 'repl-ready' });
    return;
  }
  try {
    await loadPackages(msg.packages);
    if (msg.mode === 'test') {
      var code = await runTests((msg.testFiles || []).map(function (f) { return normalizeAbs(WORKSPACE + '/' + f); }));
      finish(code);
      return;
    }
    if (msg.mode === 'eval') {
      STATE.files.set(entryAbs, msg.evalCode || '');
      var ev = msg.evalCode || '';
      if (msg.print) {
        var val = indirectEval(ev);
        if (val && typeof val.then === 'function') val = await val;
        writeOut(inspect(val) + '\n');
      } else {
        await runEntry(entryAbs);
      }
    } else {
      if (!STATE.files.has(entryAbs)) { writeErr("Error: Cannot find module '" + entryAbs + "'\n"); finish(1); return; }
      await runEntry(entryAbs);
    }
    STATE.mainDone = true;
    checkExit();
  } catch (err) {
    STATE.mainDone = true;
    if (err instanceof ExitSignal) { finish(err.code); return; }
    reportError(err);
    finish(1);
  }
};
send({ type: 'ready' });
