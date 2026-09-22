/* ============================================================
   Wandbox client — real compilers on a server.

   Used for g++ / gcc when a program needs full C++ (classes, templates,
   the whole STL) and for languages that cannot run in a browser (Java,
   Go, Rust, C#, PHP, Ruby, Swift, ...). Wandbox is free, needs no key
   and accepts several files per request, so multi-file projects compile
   exactly as they would locally. The UI always says when code leaves the
   device.

   Compiler versions are discovered from Wandbox's own list (cached for
   a day) so a retired compiler never breaks the playground; the
   hard-coded names below are only a fallback.
   ============================================================ */

const ENDPOINT = 'https://wandbox.org/api/compile.json';
const LIST = 'https://wandbox.org/api/list.json';
const CACHE_KEY = 'toolbox_pg_wandbox_list_v1';

export const REMOTE = {
  cpp: { language: 'C++', prefer: [/^gcc-1[3-9]\.\d+\.\d+$/, /^gcc-\d+\.\d+\.\d+$/, /^clang-\d+/], fallback: 'gcc-13.2.0', ext: '.cpp', main: 'main.cpp', options: 'warning,c++17', raw: '-O2' },
  c: { language: 'C', prefer: [/^gcc-1[3-9]\.\d+\.\d+-c$/, /^gcc-\d+\.\d+\.\d+-c$/, /^clang-\d+.*-c$/], fallback: 'gcc-13.2.0-c', ext: '.c', main: 'main.c', options: 'warning,c11', raw: '-O2 -lm' },
  java: { language: 'Java', prefer: [/^openjdk-jdk-2\d/], fallback: 'openjdk-jdk-22+36', ext: '.java', main: 'Main.java' },
  csharp: { language: 'C#', prefer: [/^dotnetcore-8/, /^dotnetcore-/, /^mono-/], fallback: 'dotnetcore-8.0.402', ext: '.cs', main: 'Program.cs' },
  go: { language: 'Go', prefer: [/^go-1\.2\d/], fallback: 'go-1.23.2', ext: '.go', main: 'main.go' },
  rust: { language: 'Rust', prefer: [/^rust-1\.\d+/], fallback: 'rust-1.82.0', ext: '.rs', main: 'main.rs' },
  php: { language: 'PHP', prefer: [/^php-8\./], fallback: 'php-8.3.12', ext: '.php', main: 'main.php' },
  ruby: { language: 'Ruby', prefer: [/^ruby-3\.\d/, /^ruby-\d/], fallback: 'ruby-3.4.9', ext: '.rb', main: 'main.rb' },
  swift: { language: 'Swift', prefer: [/^swift-\d/], fallback: 'swift-6.0.1', ext: '.swift', main: 'main.swift' },
  scala: { language: 'Scala', prefer: [/^scala-3/], fallback: 'scala-3.5.1', ext: '.scala', main: 'Main.scala' },
  haskell: { language: 'Haskell', prefer: [/^ghc-9/], fallback: 'ghc-9.10.1', ext: '.hs', main: 'Main.hs' },
  perl: { language: 'Perl', prefer: [/^perl-5/], fallback: 'perl-5.42.0', ext: '.pl', main: 'main.pl' },
  bash: { language: 'Bash script', prefer: [/^bash$/], fallback: 'bash', ext: '.sh', main: 'main.sh' },
  pascal: { language: 'Pascal', prefer: [/^fpc-/], fallback: 'fpc-3.2.2', ext: '.pas', main: 'main.pas' },
  r: { language: 'R', prefer: [/^r-4/], fallback: 'r-4.4.1', ext: '.r', main: 'main.r' },
  ocaml: { language: 'OCaml', prefer: [/^ocaml-5/], fallback: 'ocaml-5.2.0', ext: '.ml', main: 'main.ml' },
  elixir: { language: 'Elixir', prefer: [/^elixir-1/], fallback: 'elixir-1.17.3', ext: '.exs', main: 'main.exs' },
  zig: { language: 'Zig', prefer: [/^zig-0/], fallback: 'zig-0.9.1', ext: '.zig', main: 'main.zig' },
  python: { language: 'Python', prefer: [/^cpython-3\.1[2-9]\.\d+$/], fallback: 'cpython-3.12.7', ext: '.py', main: 'main.py' },
};

let listPromise = null;

async function compilerList() {
  if (listPromise) return listPromise;
  listPromise = (async () => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.at < 86400000 && Array.isArray(cached.list)) return cached.list;
    } catch { /* ignore */ }
    try {
      const res = await fetch(LIST, { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
      if (!res.ok) throw new Error(String(res.status));
      const list = (await res.json()).map((c) => ({ name: c.name, language: c.language, version: c.version, switches: (c.switches || []).map((s) => s.name || (s.options || []).map((o) => o.name)).flat() }));
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), list })); } catch { /* ignore */ }
      return list;
    } catch {
      listPromise = null;
      return [];
    }
  })();
  return listPromise;
}

/** Pick the best available compiler for a language id. */
export async function pickCompiler(lang) {
  const spec = REMOTE[lang];
  if (!spec) throw new Error(`No remote compiler for ${lang}`);
  const list = (await compilerList()).filter((c) => c.language === spec.language && !/head/.test(c.name));
  for (const re of spec.prefer) {
    const hit = list.filter((c) => re.test(c.name)).sort((a, b) => versionCmp(b.version, a.version))[0];
    if (hit) return { name: hit.name, version: hit.version, switches: hit.switches };
  }
  return { name: spec.fallback, version: spec.fallback.replace(/^[a-z-]+-/, ''), switches: [] };
}

function versionCmp(a, b) {
  const pa = String(a).split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b).split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

/**
 * Compile and run.
 * @param {string} lang
 * @param {{ main:string, files:Record<string,string>, stdin?:string, std?:string, extraFlags?:string, signal?:AbortSignal }} o
 * main: file name that holds the entry point; files: every source file by name (paths allowed)
 */
export async function compileAndRun(lang, { main, files, stdin = '', std = '', extraFlags = '', signal } = {}) {
  const spec = REMOTE[lang];
  const compiler = await pickCompiler(lang);
  const names = Object.keys(files);
  const others = names.filter((n) => n !== main);
  const body = {
    compiler: compiler.name,
    code: files[main] ?? '',
    codes: others.map((file) => ({ file, code: files[file] })),
    stdin,
    'save': false,
  };
  if (lang === 'cpp' || lang === 'c') {
    const stdSwitch = lang === 'cpp' ? `std-c++${(std || '17').replace(/^c\+\+/, '')}` : `std-c${(std || '11').replace(/^c/, '')}`;
    const switches = ['warning'];
    if (!compiler.switches.length || compiler.switches.includes(stdSwitch)) switches.push(stdSwitch);
    body.options = switches.join(',');
    const sources = others.filter((n) => /\.(c|cc|cpp|cxx)$/.test(n));
    body['compiler-option-raw'] = [...sources, ...String(spec.raw || '').split(/\s+/), ...String(extraFlags || '').split(/\s+/)].filter(Boolean).join('\n');
  } else if (lang === 'java') {
    // Wandbox runs "prog.java"; keep the student's class name working.
    body.code = files[main];
  }
  const started = performance.now();
  let res;
  try {
    res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw Object.assign(new Error('Could not reach the Wandbox compiler service. Check your internet connection.'), { code: 'EOFFLINE' });
  }
  if (!res.ok) throw new Error(`Wandbox responded ${res.status}${res.status === 429 ? ' (too many requests — wait a moment and try again)' : ''}`);
  const data = await res.json();
  return {
    compiler: compiler.name,
    status: data.status === undefined || data.status === '' ? (data.signal ? 128 : 0) : Number(data.status),
    signal: data.signal || '',
    compilerOutput: data.compiler_output || '',
    compilerError: data.compiler_error || '',
    programOutput: data.program_output || '',
    programError: data.program_error || '',
    ms: Math.round(performance.now() - started),
    mainName: main,
  };
}

/**
 * Parse gcc/clang style diagnostics ("file:line:col: error: message").
 * Wandbox names the main file "prog.cc" / "prog.c"; map it back.
 */
export function parseCompilerDiagnostics(text, mainName) {
  const out = [];
  const re = /^([^\s:][^:\n]*):(\d+):(?:(\d+):)?\s*(fatal error|error|warning|note):\s*(.+)$/gm;
  let m;
  while ((m = re.exec(text))) {
    let file = m[1];
    if (/^prog\.(cc|c|cpp)$/.test(file)) file = mainName;
    out.push({ file, line: Number(m[2]), column: Number(m[3] || 1), severity: m[4].includes('error') ? 'error' : m[4], message: m[5] });
  }
  return out;
}

export function rewriteProgName(text, mainName) {
  return String(text || '').replace(/\bprog\.(cc|c|cpp|java|rs|go|cs|swift|rb|php|py)\b/g, mainName);
}
