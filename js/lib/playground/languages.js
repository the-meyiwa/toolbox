/* ============================================================
   Language metadata for Code Playground.

   One table answers every "what is this file?" question: the label in
   the status bar, the CodeMirror mode, the icon, how the file runs and
   which engine runs it. Runners:
     js / ts      in-browser Node-style worker
     python       Pyodide (CPython on WebAssembly)
     cpp / c      JSCPP interpreter in a worker, or g++/gcc via Wandbox
     sql          SQLite (sql.js)
     lua          wasmoon
     web          preview frame (HTML/CSS/JS/JSX)
     remote       compiled on Wandbox (Java, Go, Rust, C#, PHP, Ruby, ...)
   ============================================================ */

import { basename, extname } from './paths.js';

/** @typedef {{ id:string, name:string, mode:any, runner:string|null, remote?:string, comment?:string, color:string, abbr:string }} Lang */

/** @type {Record<string, Lang>} */
export const LANGS = {
  javascript: { id: 'javascript', name: 'JavaScript', mode: 'javascript', runner: 'js', comment: '//', color: '#e8c33a', abbr: 'JS' },
  jsx: { id: 'jsx', name: 'JavaScript JSX', mode: 'jsx', runner: 'js', comment: '//', color: '#58c4dc', abbr: 'JSX' },
  typescript: { id: 'typescript', name: 'TypeScript', mode: { name: 'javascript', typescript: true }, runner: 'ts', comment: '//', color: '#3178c6', abbr: 'TS' },
  tsx: { id: 'tsx', name: 'TypeScript JSX', mode: { name: 'jsx', base: { name: 'javascript', typescript: true } }, runner: 'ts', comment: '//', color: '#3178c6', abbr: 'TSX' },
  json: { id: 'json', name: 'JSON', mode: { name: 'javascript', json: true }, runner: null, color: '#cbcb41', abbr: '{}' },
  python: { id: 'python', name: 'Python', mode: { name: 'python', version: 3 }, runner: 'python', comment: '#', color: '#3572a5', abbr: 'PY' },
  cpp: { id: 'cpp', name: 'C++', mode: 'text/x-c++src', runner: 'cpp', comment: '//', color: '#f34b7d', abbr: 'C++' },
  c: { id: 'c', name: 'C', mode: 'text/x-csrc', runner: 'c', comment: '//', color: '#8e9bb0', abbr: 'C' },
  header: { id: 'header', name: 'C/C++ Header', mode: 'text/x-c++hdr', runner: null, comment: '//', color: '#a074c4', abbr: 'H' },
  sql: { id: 'sql', name: 'SQL (SQLite)', mode: 'text/x-sqlite', runner: 'sql', comment: '--', color: '#e38c00', abbr: 'SQL' },
  lua: { id: 'lua', name: 'Lua', mode: 'lua', runner: 'lua', comment: '--', color: '#000080', abbr: 'LUA' },
  html: { id: 'html', name: 'HTML', mode: 'htmlmixed', runner: 'web', comment: '<!--', color: '#e34c26', abbr: '<>' },
  css: { id: 'css', name: 'CSS', mode: 'css', runner: 'web', comment: '/*', color: '#563d7c', abbr: '#' },
  scss: { id: 'scss', name: 'SCSS', mode: 'text/x-scss', runner: null, comment: '//', color: '#c6538c', abbr: 'S' },
  markdown: { id: 'markdown', name: 'Markdown', mode: 'gfm', runner: 'markdown', color: '#6a8fb5', abbr: 'MD' },
  vue: { id: 'vue', name: 'Vue', mode: 'vue', runner: 'web', comment: '<!--', color: '#41b883', abbr: 'V' },
  svg: { id: 'svg', name: 'SVG', mode: 'xml', runner: 'web', comment: '<!--', color: '#ffb13b', abbr: 'SVG' },
  xml: { id: 'xml', name: 'XML', mode: 'xml', runner: null, comment: '<!--', color: '#0060ac', abbr: 'XML' },
  yaml: { id: 'yaml', name: 'YAML', mode: 'yaml', runner: null, comment: '#', color: '#cb171e', abbr: 'YML' },
  toml: { id: 'toml', name: 'TOML', mode: 'toml', runner: null, comment: '#', color: '#9c4221', abbr: 'TML' },
  shell: { id: 'shell', name: 'Shell Script', mode: 'shell', runner: 'shell', comment: '#', color: '#89e051', abbr: 'SH' },
  java: { id: 'java', name: 'Java', mode: 'text/x-java', runner: 'remote', remote: 'java', comment: '//', color: '#b07219', abbr: 'JV' },
  kotlin: { id: 'kotlin', name: 'Kotlin', mode: 'text/x-kotlin', runner: null, comment: '//', color: '#a97bff', abbr: 'KT' },
  csharp: { id: 'csharp', name: 'C#', mode: 'text/x-csharp', runner: 'remote', remote: 'csharp', comment: '//', color: '#178600', abbr: 'C#' },
  go: { id: 'go', name: 'Go', mode: 'go', runner: 'remote', remote: 'go', comment: '//', color: '#00add8', abbr: 'GO' },
  rust: { id: 'rust', name: 'Rust', mode: 'rust', runner: 'remote', remote: 'rust', comment: '//', color: '#dea584', abbr: 'RS' },
  php: { id: 'php', name: 'PHP', mode: 'application/x-httpd-php', runner: 'remote', remote: 'php', comment: '//', color: '#4f5d95', abbr: 'PHP' },
  ruby: { id: 'ruby', name: 'Ruby', mode: 'ruby', runner: 'remote', remote: 'ruby', comment: '#', color: '#701516', abbr: 'RB' },
  swift: { id: 'swift', name: 'Swift', mode: 'swift', runner: 'remote', remote: 'swift', comment: '//', color: '#f05138', abbr: 'SW' },
  scala: { id: 'scala', name: 'Scala', mode: 'text/x-scala', runner: 'remote', remote: 'scala', comment: '//', color: '#c22d40', abbr: 'SC' },
  haskell: { id: 'haskell', name: 'Haskell', mode: 'haskell', runner: 'remote', remote: 'haskell', comment: '--', color: '#5e5086', abbr: 'HS' },
  perl: { id: 'perl', name: 'Perl', mode: 'perl', runner: 'remote', remote: 'perl', comment: '#', color: '#0298c3', abbr: 'PL' },
  bash: { id: 'bash', name: 'Bash (server)', mode: 'shell', runner: 'remote', remote: 'bash', comment: '#', color: '#89e051', abbr: 'SH' },
  pascal: { id: 'pascal', name: 'Pascal', mode: 'pascal', runner: 'remote', remote: 'pascal', comment: '//', color: '#e3f171', abbr: 'PAS' },
  r: { id: 'r', name: 'R', mode: 'r', runner: 'remote', remote: 'r', comment: '#', color: '#198ce7', abbr: 'R' },
  ocaml: { id: 'ocaml', name: 'OCaml', mode: 'text/x-ocaml', runner: 'remote', remote: 'ocaml', comment: '(*', color: '#3be133', abbr: 'ML' },
  elixir: { id: 'elixir', name: 'Elixir', mode: null, runner: 'remote', remote: 'elixir', comment: '#', color: '#6e4a7e', abbr: 'EX' },
  zig: { id: 'zig', name: 'Zig', mode: 'text/x-c++src', runner: 'remote', remote: 'zig', comment: '//', color: '#ec915c', abbr: 'ZIG' },
  dockerfile: { id: 'dockerfile', name: 'Dockerfile', mode: 'dockerfile', runner: null, comment: '#', color: '#384d54', abbr: 'DK' },
  diff: { id: 'diff', name: 'Diff', mode: 'diff', runner: null, color: '#88a', abbr: '±' },
  text: { id: 'text', name: 'Plain Text', mode: null, runner: null, color: '#8a94a6', abbr: 'TXT' },
  image: { id: 'image', name: 'Image', mode: null, runner: null, color: '#a074c4', abbr: 'IMG', binary: true },
  binary: { id: 'binary', name: 'Binary', mode: null, runner: null, color: '#8a94a6', abbr: 'BIN', binary: true },
};

const BY_EXT = {
  '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript', '.jsx': 'jsx',
  '.ts': 'typescript', '.mts': 'typescript', '.cts': 'typescript', '.tsx': 'tsx',
  '.json': 'json', '.jsonc': 'json', '.map': 'json',
  '.py': 'python', '.pyw': 'python',
  '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.c++': 'cpp', '.hpp': 'header', '.hh': 'header', '.hxx': 'header', '.h': 'header',
  '.c': 'c',
  '.sql': 'sql', '.sqlite': 'binary', '.db': 'binary',
  '.lua': 'lua',
  '.html': 'html', '.htm': 'html', '.css': 'css', '.scss': 'scss', '.sass': 'scss', '.vue': 'vue', '.svg': 'svg', '.xml': 'xml',
  '.md': 'markdown', '.markdown': 'markdown', '.mdx': 'markdown',
  '.yml': 'yaml', '.yaml': 'yaml', '.toml': 'toml',
  '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
  '.java': 'java', '.kt': 'kotlin', '.cs': 'csharp', '.go': 'go', '.rs': 'rust', '.php': 'php', '.rb': 'ruby', '.swift': 'swift',
  '.scala': 'scala', '.hs': 'haskell', '.pl': 'perl', '.pas': 'pascal', '.r': 'r', '.ml': 'ocaml', '.ex': 'elixir', '.exs': 'elixir', '.zig': 'zig',
  '.diff': 'diff', '.patch': 'diff',
  '.txt': 'text', '.log': 'text', '.csv': 'text', '.tsv': 'text', '.env': 'text', '.ini': 'text', '.cfg': 'text',
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.gif': 'image', '.webp': 'image', '.ico': 'image', '.bmp': 'image', '.avif': 'image',
  '.woff': 'binary', '.woff2': 'binary', '.ttf': 'binary', '.otf': 'binary', '.mp3': 'binary', '.wav': 'binary', '.ogg': 'binary', '.mp4': 'binary', '.webm': 'binary',
  '.pdf': 'binary', '.zip': 'binary', '.wasm': 'binary', '.gz': 'binary', '.out': 'binary', '.exe': 'binary',
};

const BY_NAME = {
  dockerfile: 'dockerfile', makefile: 'text', '.gitignore': 'text', '.env': 'text', license: 'text', readme: 'markdown',
  '.prettierrc': 'json', '.babelrc': 'json', '.eslintrc': 'json',
};

export const BINARY_EXTS = new Set(Object.entries(BY_EXT).filter(([, id]) => LANGS[id]?.binary).map(([e]) => e));

export const MIME = {
  '.html': 'text/html', '.htm': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.cjs': 'text/javascript', '.jsx': 'text/javascript', '.ts': 'text/javascript', '.tsx': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.bmp': 'image/bmp', '.avif': 'image/avif',
  '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv', '.xml': 'application/xml', '.pdf': 'application/pdf',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.wasm': 'application/wasm',
};

export function mimeFor(path) {
  return MIME[extname(path).toLowerCase()] || 'application/octet-stream';
}

/** Language id for a file path. */
export function languageOf(path = '') {
  const base = basename(path).toLowerCase();
  if (BY_NAME[base]) return BY_NAME[base];
  const ext = extname(base);
  if (BY_EXT[ext]) return BY_EXT[ext];
  if (base.startsWith('readme')) return 'markdown';
  if (base.startsWith('dockerfile')) return 'dockerfile';
  return 'text';
}

export function langInfo(idOrPath = '') {
  return LANGS[idOrPath] || LANGS[languageOf(idOrPath)] || LANGS.text;
}

export function isBinaryPath(path = '') {
  return Boolean(langInfo(languageOf(path)).binary);
}

/** Can the Run button do something with this file on its own? */
export function isRunnable(path = '') {
  const l = langInfo(languageOf(path));
  return Boolean(l.runner && l.runner !== 'markdown');
}

/** Languages offered in the status-bar picker (id → label), grouped. */
export function pickerGroups() {
  const local = ['javascript', 'typescript', 'jsx', 'python', 'cpp', 'c', 'sql', 'lua', 'html', 'css', 'markdown', 'json', 'text'];
  const remote = ['java', 'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'haskell', 'perl', 'pascal', 'r', 'bash'];
  return [
    { label: 'Runs in your browser', ids: local },
    { label: 'Compiled on a server (Wandbox)', ids: remote.filter((id) => LANGS[id]) },
  ];
}

/** Default file extension for a language id (used when renaming via the picker). */
export const DEFAULT_EXT = {
  javascript: '.js', jsx: '.jsx', typescript: '.ts', tsx: '.tsx', json: '.json', python: '.py', cpp: '.cpp', c: '.c', header: '.h',
  sql: '.sql', lua: '.lua', html: '.html', css: '.css', scss: '.scss', markdown: '.md', vue: '.vue', svg: '.svg', xml: '.xml',
  yaml: '.yml', toml: '.toml', shell: '.sh', java: '.java', kotlin: '.kt', csharp: '.cs', go: '.go', rust: '.rs', php: '.php',
  ruby: '.rb', swift: '.swift', scala: '.scala', haskell: '.hs', perl: '.pl', bash: '.sh', pascal: '.pas', r: '.r', ocaml: '.ml',
  elixir: '.exs', zig: '.zig', text: '.txt',
};
