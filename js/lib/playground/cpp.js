/* ============================================================
   C and C++ support.

   Two engines:
     interpreter  JSCPP in a web worker — offline, instant, interactive
                  cin; covers procedural C/C++ with the common STL
                  containers (vector, string, map, set, algorithm, ...)
     g++ / gcc    the real compiler on Wandbox — full language (classes,
                  templates, lambdas, exceptions, smart pointers, ...)
   "Auto" reads the program and picks the interpreter when it can handle
   it, the real compiler otherwise, and falls back to the other engine
   when the first one can't cope.

   Multi-file projects: `g++ main.cpp utils.cpp -o app` works with both
   engines. For the interpreter, local #include "x.h" files are inlined
   and extra .cpp files appended, with a line map so every error still
   points at the right file and line.
   ============================================================ */

import { resolve as resolvePath, dirname, basename } from './paths.js';

const INTERPRETER_UNSUPPORTED = [
  [/\bclass\s+\w+/, 'classes'],
  [/\btemplate\s*</, 'templates'],
  [/\bstd::function\b|#include\s*<functional>/, 'std::function'],
  [/\boperator\s*(?:[-+*/%^&|~!=<>]=?|\(\s*\)|\[\s*\]|<<|>>|==|!=|\+\+|--|->)/, 'operator overloading'],
  [/\[[&=]?[^\]\n]*\]\s*\([^)]*\)\s*(?:mutable\s*)?(?:->\s*[\w:<>]+\s*)?\{/, 'lambdas'],
  [/\b(?:try|catch|throw)\b/, 'exceptions'],
  [/\b(?:unique_ptr|shared_ptr|make_unique|make_shared)\b/, 'smart pointers'],
  [/\bnamespace\s+\w+\s*\{/, 'custom namespaces'],
  [/\benum\s+class\b/, 'enum class'],
  [/\bvirtual\b|\boverride\b/, 'virtual functions'],
  [/\bstruct\s+\w+\s*(?::[^{]*)?\{[^}]*\b\w+\s*\([^;{]*\)\s*(?:const\s*)?\{/s, 'member functions'],
  [/\bwhile\s*\(\s*(?:std::)?cin\s*>>/, 'while (cin >> x) loops'],
  [/\bwhile\s*\(\s*(?:std::)?getline\s*\(/, 'while (getline(...)) loops'],
  [/#include\s*<(?:thread|mutex|chrono|random|regex|optional|variant|tuple|queue|stack|deque|list|array|bitset|memory|fstream|ifstream|ofstream|limits|numeric)>/, 'headers the interpreter lacks'],
  [/\bstatic_cast\s*<|\bdynamic_cast\s*<|\breinterpret_cast\s*</, 'C++ casts'],
  [/\bconstexpr\b|\bnullptr\b\s*;?\s*$|\bnoexcept\b/m, 'modern C++ keywords'],
  [/\bstd::(?:pair|tuple|optional|array|queue|stack|deque|list|priority_queue|unordered_map|unordered_set)\b|\b(?:pair|queue|stack|deque|priority_queue)\s*</, 'containers the interpreter lacks'],
];

/** Why the interpreter can't run this code (empty array = it probably can). */
export function interpreterBlockers(code) {
  const src = stripCommentsAndStrings(code);
  const hits = [];
  for (const [re, label] of INTERPRETER_UNSUPPORTED) if (re.test(src) && !hits.includes(label)) hits.push(label);
  return hits;
}

export function stripCommentsAndStrings(code) {
  return String(code)
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '')
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\.|[^'\\\n])'/g, "' '");
}

export function readsInput(code) {
  return /\b(?:cin\s*>>|getline\s*\(|scanf\s*\(|getchar\s*\(|fgets\s*\(|gets\s*\()/.test(stripCommentsAndStrings(code));
}

/**
 * Build one translation unit for the interpreter.
 * @returns {{ code:string, map:Array<{file:string,line:number}>, missing:string[] }}
 */
export function buildTranslationUnit(vfs, sources) {
  const out = [];
  const map = [];
  const missing = [];
  const onceSeen = new Set();
  const systemIncludes = new Set();
  const emit = (text, file, line) => { out.push(text); map.push({ file, line }); };

  const include = (file, depth) => {
    if (depth > 24) return;
    if (onceSeen.has(file)) return;
    let text;
    try { text = vfs.readFile(file); } catch { missing.push(file); return; }
    const lines = text.split('\n');
    if (/^\s*#\s*pragma\s+once/m.test(text)) onceSeen.add(file);
    // Classic include guard: #ifndef X / #define X ... #endif
    const guard = /^\s*#\s*ifndef\s+(\w+)\s*\n\s*#\s*define\s+\1\b/m.exec(text);
    if (guard) {
      if (onceSeen.has(`guard:${guard[1]}`)) return;
      onceSeen.add(`guard:${guard[1]}`);
    }
    lines.forEach((l, i) => {
      const local = /^\s*#\s*include\s*"([^"]+)"/.exec(l);
      if (local) {
        const target = resolvePath(dirname(file), local[1]);
        if (vfs.isFile(target)) { emit('', file, i + 1); include(target, depth + 1); return; }
        const alt = resolvePath('', local[1]);
        if (vfs.isFile(alt)) { emit('', file, i + 1); include(alt, depth + 1); return; }
        missing.push(local[1]);
        emit(l, file, i + 1);
        return;
      }
      const sys = /^\s*#\s*include\s*<([^>]+)>/.exec(l);
      if (sys) {
        if (systemIncludes.has(sys[1])) { emit('', file, i + 1); return; }
        systemIncludes.add(sys[1]);
      }
      if (/^\s*#\s*pragma\s+once/.test(l)) { emit('', file, i + 1); return; }
      emit(l, file, i + 1);
    });
  };

  // Main first, then the other sources (their functions may be called from main
  // after forward declarations in a header, which the interpreter accepts).
  const ordered = [...sources];
  ordered.forEach((f) => include(f, 0));
  return { code: out.join('\n'), map, missing };
}

/** Map an interpreter line number back to the original file/line. */
export function mapLine(unit, line) {
  const hit = unit?.map?.[Number(line) - 1];
  return hit ? { file: hit.file, line: hit.line } : null;
}

/**
 * Parse a compile command line.
 *   g++ main.cpp util.cpp -o app -std=c++20 -Wall
 * @returns {{ sources:string[], output:string, std:string, flags:string[], lang:'cpp'|'c', compileOnly:boolean }}
 */
export function parseCompileArgs(args, { defaultLang = 'cpp' } = {}) {
  const sources = [];
  const flags = [];
  let output = '';
  let std = '';
  let compileOnly = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-o') { output = args[++i] || ''; continue; }
    if (a.startsWith('-o') && a.length > 2) { output = a.slice(2); continue; }
    if (a.startsWith('-std=')) { std = a.slice(5); continue; }
    if (a === '-c') { compileOnly = true; continue; }
    if (a.startsWith('-')) { flags.push(a); continue; }
    sources.push(a);
  }
  const lang = sources.some((s) => /\.(cpp|cc|cxx|c\+\+|C)$/.test(s)) ? 'cpp' : sources.every((s) => /\.c$/.test(s)) && sources.length ? 'c' : defaultLang;
  return { sources, output: output || 'a.out', std, flags, lang, compileOnly };
}

/**
 * The file `g++` writes. It is a small JSON "executable" that records the
 * sources and settings; `./app` rebuilds from the current sources when
 * they have changed, just like running make before the binary.
 */
export const EXE_MAGIC = '\u007fTBX-EXE';

export function makeExecutable({ lang, sources, std, flags, engine, builtAt = Date.now() }) {
  return `${EXE_MAGIC}\n${JSON.stringify({ lang, sources, std, flags, engine, builtAt })}\n`;
}

export function readExecutable(text) {
  if (!String(text).startsWith(EXE_MAGIC)) return null;
  try { return JSON.parse(String(text).split('\n')[1]); } catch { return null; }
}

export function defaultOutputName(sources) {
  return sources.length ? basename(sources[0]).replace(/\.[^.]+$/, '') : 'a.out';
}
