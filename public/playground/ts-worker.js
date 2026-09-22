/* ============================================================
   Toolbox Code Playground — TypeScript language service (Web Worker)

   Real type checking and IntelliSense for .ts/.tsx/.js/.jsx files:
   diagnostics for the Problems panel and editor squiggles,
   autocompletion, hover information, and emit for `tsc`.
   The standard library declarations (and @types/node for Node
   projects) are loaded once from /vendor/typescript/*.json.

   page → worker
     { type:'init', tsUrl, libUrl, nodeTypesUrl }
     { type:'sync', files:{path:content}, removed:[path] }     (workspace-relative paths)
     { type:'diagnostics', id, files:[path] }
     { type:'completions', id, file, offset }
     { type:'details', id, file, offset, name, source }
     { type:'quickinfo', id, file, offset }
     { type:'emit', id, files:[path], outDir }
   worker → page  { id, result } | { id, error }
   ============================================================ */
'use strict';

var ts = null;
var libs = null;
var nodeTypes = null;
var ready = null;
var files = new Map();     // absolute path "/workspace/…" → { text, version }
var service = null;
var settings = { tsUrl: '/vendor/typescript/typescript.min.js', libUrl: '/vendor/typescript/lib.json', nodeTypesUrl: '/vendor/typescript/node-types.json' };

var SHIMS = [
  "declare module '*.css' { const css: string; export default css; }",
  "declare module '*.scss' { const css: string; export default css; }",
  "declare module '*.svg' { const src: string; export default src; }",
  "declare module '*.png' { const src: string; export default src; }",
  "declare module '*.jpg' { const src: string; export default src; }",
  "declare module '*.jpeg' { const src: string; export default src; }",
  "declare module '*.gif' { const src: string; export default src; }",
  "declare module '*.webp' { const src: string; export default src; }",
  "declare module '*.json' { const data: any; export default data; }",
  // npm packages without bundled types in the browser: typed as any rather than errors
  "declare module '*';",
  "declare namespace JSX { interface IntrinsicElements { [elem: string]: any } interface Element { [key: string]: any } interface ElementChildrenAttribute { children: {} } }",
  "declare module 'vitest' { export const describe: any, it: any, test: any, expect: any, vi: any, beforeEach: any, afterEach: any, beforeAll: any, afterAll: any; }",
  "declare var describe: any; declare var it: any; declare var test: any; declare var expect: any; declare var vi: any; declare var jest: any; declare var beforeEach: any; declare var afterEach: any; declare var beforeAll: any; declare var afterAll: any;",
].join('\n');

// Noise we suppress: missing @types for npm packages, JSX typing without @types/react.
var IGNORE_CODES = { 2307: 1, 7016: 1, 7026: 1, 2875: 1, 2503: 1, 6133: 0, 1208: 1, 2686: 1, 17004: 1, 2792: 1 };

function send(m) { self.postMessage(m); }

async function init() {
  if (ready) return ready;
  ready = (async function () {
    importScripts(settings.tsUrl);
    ts = self.ts;
    var res = await fetch(settings.libUrl);
    libs = await res.json();
    try { nodeTypes = await (await fetch(settings.nodeTypesUrl)).json(); } catch (e) { nodeTypes = {}; }
    service = ts.createLanguageService(host(), ts.createDocumentRegistry());
    return true;
  })();
  return ready;
}

function abs(p) { return '/workspace/' + String(p).replace(/^\/+/, '').replace(/^workspace\//, ''); }
function rel(p) { return String(p).replace(/^\/workspace\//, ''); }

function projectUsesNode() {
  for (var entry of files) {
    var p = entry[0]; var t = entry[1].text;
    if (/\/package\.json$/.test(p)) return true;
    if (/\brequire\s*\(|\bprocess\.|from ['"](node:|fs|path|readline|http|express)/.test(t)) return true;
  }
  return false;
}

function tsconfig() {
  var cfg = files.get('/workspace/tsconfig.json');
  if (!cfg) return {};
  try {
    var parsed = ts.parseConfigFileTextToJson('/workspace/tsconfig.json', cfg.text);
    var opts = ts.convertCompilerOptionsFromJson((parsed.config || {}).compilerOptions || {}, '/workspace').options;
    return opts || {};
  } catch (e) { return {}; }
}

function compilerOptions() {
  var base = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    allowJs: true,
    checkJs: false,
    strict: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true,
    resolveJsonModule: true,
    allowImportingTsExtensions: true,
    noEmit: false,
    isolatedModules: true,
    lib: ['lib.es2023.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    types: projectUsesNode() ? ['node'] : [],
    typeRoots: ['/node_modules/@types'],
  };
  var user = tsconfig();
  var merged = Object.assign(base, user);
  if (user.lib) merged.lib = user.lib.map(function (l) { return /^lib\./.test(l) ? l : 'lib.' + l.toLowerCase() + '.d.ts'; });
  // Keep emit settings sane for the playground.
  merged.noEmit = false;
  merged.declaration = false;
  merged.allowImportingTsExtensions = true;
  if (merged.moduleResolution === ts.ModuleResolutionKind.NodeNext || merged.moduleResolution === ts.ModuleResolutionKind.Node16) merged.moduleResolution = ts.ModuleResolutionKind.Bundler, merged.module = ts.ModuleKind.ESNext;
  return merged;
}

function readAny(path) {
  if (files.has(path)) return files.get(path).text;
  var name = path.replace(/^.*\//, '');
  if (/^\/(?:node_modules\/typescript\/lib\/|)lib\.[^/]*\.d\.ts$/.test(path) || (path.indexOf('/') === -1 && libs && libs[name])) return libs[name];
  if (libs && /lib\.[^/]*\.d\.ts$/.test(path) && libs[name]) return libs[name];
  if (nodeTypes && nodeTypes[path] !== undefined) return nodeTypes[path];
  if (path === '/workspace/__pg_shims.d.ts') return SHIMS;
  return undefined;
}

function host() {
  return {
    getCompilationSettings: compilerOptions,
    getScriptFileNames: function () {
      var names = ['/workspace/__pg_shims.d.ts'];
      files.forEach(function (_, p) { if (/\.(tsx?|jsx?|mts|cts|d\.ts)$/.test(p)) names.push(p); });
      return names;
    },
    getScriptVersion: function (p) { var f = files.get(p); return f ? String(f.version) : '1'; },
    getScriptSnapshot: function (p) { var t = readAny(p); return t === undefined ? undefined : ts.ScriptSnapshot.fromString(t); },
    getCurrentDirectory: function () { return '/workspace'; },
    getDefaultLibFileName: function (o) { return '/' + ts.getDefaultLibFileName(o); },
    fileExists: function (p) { return readAny(p) !== undefined; },
    readFile: function (p) { return readAny(p); },
    readDirectory: function () { return []; },
    directoryExists: function (d) {
      if (d === '/node_modules/@types' || d === '/node_modules/@types/node' || d === '/node_modules') return Boolean(nodeTypes && Object.keys(nodeTypes).length);
      var prefix = d.replace(/\/$/, '') + '/';
      for (var k of files.keys()) if (k.indexOf(prefix) === 0) return true;
      return d === '/workspace';
    },
    getDirectories: function (d) { return d === '/node_modules/@types' && nodeTypes && Object.keys(nodeTypes).length ? ['node'] : []; },
    useCaseSensitiveFileNames: function () { return true; },
    getNewLine: function () { return '\n'; },
    realpath: function (p) { return p; },
  };
}

function toDiag(d) {
  if (IGNORE_CODES[d.code]) return null;
  var file = d.file ? d.file.fileName : null;
  if (!file || file.indexOf('/workspace/') !== 0 || /__pg_shims/.test(file)) return null;
  var start = d.file.getLineAndCharacterOfPosition(d.start || 0);
  var end = d.file.getLineAndCharacterOfPosition((d.start || 0) + (d.length || 0));
  return {
    file: rel(file), line: start.line + 1, column: start.character + 1, endLine: end.line + 1, endColumn: end.character + 1,
    message: ts.flattenDiagnosticMessageText(d.messageText, '\n'), code: d.code,
    severity: d.category === ts.DiagnosticCategory.Error ? 'error' : d.category === ts.DiagnosticCategory.Warning ? 'warning' : 'info',
    source: 'ts',
  };
}

function diagnosticsFor(list) {
  var out = [];
  list.forEach(function (p) {
    var a = abs(p);
    if (!files.has(a)) return;
    var isJs = /\.(jsx?|mjs|cjs)$/.test(a);
    var syn = service.getSyntacticDiagnostics(a);
    var sem = [];
    if (!isJs || /^\s*\/\/\s*@ts-check/m.test(files.get(a).text)) {
      try { sem = service.getSemanticDiagnostics(a); } catch (e) { sem = []; }
    }
    syn.concat(sem).forEach(function (d) { var x = toDiag(d); if (x) out.push(x); });
  });
  return out;
}

var KIND_MAP = { method: 'method', function: 'function', 'local function': 'function', property: 'property', getter: 'property', setter: 'property', var: 'variable', let: 'variable', const: 'constant', 'local var': 'variable', parameter: 'variable', class: 'class', interface: 'interface', type: 'type', enum: 'enum', 'enum member': 'constant', module: 'module', keyword: 'keyword', alias: 'module', string: 'text', 'JSX attribute': 'property' };

function completions(file, offset) {
  var a = abs(file);
  var res = service.getCompletionsAtPosition(a, offset, { includeCompletionsForModuleExports: false, includeCompletionsWithInsertText: true, includeAutomaticOptionalChainCompletions: true });
  if (!res) return { entries: [] };
  var entries = res.entries.slice(0, 400).map(function (e) {
    return { name: e.name, kind: KIND_MAP[e.kind] || e.kind, sortText: e.sortText, insertText: e.insertText, replacement: e.replacementSpan ? { start: e.replacementSpan.start, length: e.replacementSpan.length } : null, source: e.source };
  });
  return { entries: entries, isMember: res.isMemberCompletion };
}

function details(file, offset, name, source) {
  var d = service.getCompletionEntryDetails(abs(file), offset, name, {}, source, {}, undefined);
  if (!d) return null;
  return { signature: ts.displayPartsToString(d.displayParts), doc: ts.displayPartsToString(d.documentation || []) };
}

function quickinfo(file, offset) {
  var q = service.getQuickInfoAtPosition(abs(file), offset);
  if (!q) return null;
  return { text: ts.displayPartsToString(q.displayParts), doc: ts.displayPartsToString(q.documentation || []), start: q.textSpan.start, length: q.textSpan.length };
}

function emit(list, outDir) {
  var out = {};
  var diags = [];
  var program = service.getProgram();
  list.forEach(function (p) {
    var a = abs(p);
    var sf = program.getSourceFile(a);
    if (!sf || /\.d\.ts$/.test(a)) return;
    var r = service.getEmitOutput(a);
    r.outputFiles.forEach(function (o) {
      var name = rel(o.name);
      if (outDir) {
        var od = String(outDir).replace(/^\.?\/*/, '').replace(/\/$/, '');
        name = od + '/' + name.replace(/^src\//, '');
      }
      if (/\.map$|\.d\.ts$/.test(name)) return;
      out[name] = o.text;
    });
  });
  diags = diagnosticsFor(list.filter(function (p) { return /\.tsx?$/.test(p); }));
  return { files: out, diagnostics: diags };
}

self.onmessage = async function (e) {
  var m = e.data || {};
  try {
    if (m.type === 'init') {
      Object.keys(settings).forEach(function (k) { if (m[k]) settings[k] = m[k]; });
      await init();
      send({ id: m.id, result: true });
      return;
    }
    await init();
    if (m.type === 'sync') {
      Object.keys(m.files || {}).forEach(function (p) {
        var a = abs(p);
        var prev = files.get(a);
        if (!prev || prev.text !== m.files[p]) files.set(a, { text: m.files[p], version: prev ? prev.version + 1 : 1 });
      });
      (m.removed || []).forEach(function (p) { files.delete(abs(p)); });
      if (m.replace) {
        var keep = {};
        Object.keys(m.files || {}).forEach(function (p) { keep[abs(p)] = 1; });
        Array.from(files.keys()).forEach(function (k) { if (!keep[k]) files.delete(k); });
      }
      if (m.id) send({ id: m.id, result: true });
      return;
    }
    var result = null;
    if (m.type === 'diagnostics') result = diagnosticsFor(m.files || []);
    else if (m.type === 'completions') result = completions(m.file, m.offset);
    else if (m.type === 'details') result = details(m.file, m.offset, m.name, m.source);
    else if (m.type === 'quickinfo') result = quickinfo(m.file, m.offset);
    else if (m.type === 'emit') result = emit(m.files || [], m.outDir);
    send({ id: m.id, result: result });
  } catch (err) {
    send({ id: m.id, error: String(err && err.message || err) });
  }
};
