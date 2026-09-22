#!/usr/bin/env node
/**
 * Builds the vendored CodeMirror 5 bundle used by Code Playground.
 *
 *   git clone --depth 1 --branch 5.65.19 https://github.com/codemirror/codemirror5.git /tmp/cm5
 *   node scripts/vendor/build-codemirror.mjs /tmp/cm5
 *
 * Output: public/vendor/codemirror/codemirror.bundle.js (+ .css). The bundle
 * is an IIFE that assigns window.CodeMirror with every mode and addon the
 * playground uses, so it loads with a single <script> and works offline.
 * Requires esbuild on PATH (or ESBUILD env pointing at the binary).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const src = path.resolve(process.argv[2] || '/tmp/cm5');
const out = path.resolve('public/vendor/codemirror');
const esbuild = process.env.ESBUILD || 'esbuild';

const MODES = [
  'javascript', 'jsx', 'xml', 'htmlmixed', 'css', 'sass', 'python', 'clike', 'sql', 'lua',
  'markdown', 'gfm', 'shell', 'go', 'rust', 'php', 'ruby', 'swift', 'yaml', 'toml', 'dockerfile',
  'r', 'perl', 'haskell', 'pascal', 'mllike', 'vue', 'diff', 'properties', 'cmake', 'nginx', 'dart',
  'julia', 'powershell', 'erlang', 'clojure', 'scheme', 'commonlisp', 'fortran', 'octave', 'vb',
];
const ADDONS = [
  'edit/closebrackets', 'edit/matchbrackets', 'edit/closetag', 'edit/matchtags', 'edit/continuelist', 'edit/trailingspace',
  'comment/comment', 'comment/continuecomment',
  'dialog/dialog', 'search/searchcursor', 'search/search', 'search/jump-to-line', 'search/match-highlighter',
  'scroll/annotatescrollbar', 'search/matchesonscrollbar', 'scroll/scrollpastend',
  'selection/active-line', 'selection/mark-selection',
  'fold/foldcode', 'fold/foldgutter', 'fold/brace-fold', 'fold/indent-fold', 'fold/comment-fold', 'fold/xml-fold', 'fold/markdown-fold',
  'hint/show-hint', 'hint/anyword-hint', 'hint/javascript-hint', 'hint/css-hint', 'hint/xml-hint', 'hint/html-hint', 'hint/sql-hint',
  'lint/lint', 'display/placeholder', 'display/rulers', 'display/autorefresh', 'mode/overlay', 'mode/simple', 'mode/multiplex', 'runmode/runmode',
];
const CSS = [
  'lib/codemirror.css', 'addon/dialog/dialog.css', 'addon/fold/foldgutter.css', 'addon/hint/show-hint.css',
  'addon/lint/lint.css', 'addon/search/matchesonscrollbar.css',
];

// The repo ships ES module sources; build lib/codemirror.js (CommonJS) so the
// UMD-style modes and addons can require() it, exactly as the npm package does.
const libFile = path.join(src, 'lib', 'codemirror.js');
if (!fs.existsSync(libFile)) {
  execFileSync(esbuild, [path.join(src, 'src', 'codemirror.js'), '--bundle', '--format=cjs', '--target=es2018',
    '--footer:js=module.exports = module.exports.default;', `--outfile=${libFile}`], { stdio: 'inherit' });
}

const entry = path.join(src, '__toolbox_entry.js');
const lines = [`const CodeMirror = require('./lib/codemirror.js');`];
for (const m of MODES) {
  const file = path.join(src, 'mode', m, `${m}.js`);
  if (!fs.existsSync(file)) throw new Error(`Missing mode ${m}`);
  lines.push(`require('./mode/${m}/${m}.js');`);
}
for (const a of ADDONS) {
  if (!fs.existsSync(path.join(src, 'addon', `${a}.js`))) throw new Error(`Missing addon ${a}`);
  lines.push(`require('./addon/${a}.js');`);
}
lines.push(`self.CodeMirror = CodeMirror;`);
fs.writeFileSync(entry, lines.join('\n'));
fs.mkdirSync(out, { recursive: true });
const version = JSON.parse(fs.readFileSync(path.join(src, 'package.json'), 'utf8')).version;
execFileSync(esbuild, [entry, '--bundle', '--format=iife', '--minify', '--target=es2018',
  `--banner:js=/* CodeMirror ${version} (MIT, https://codemirror.net/5/) - bundled for Toolbox Code Playground */`,
  `--outfile=${path.join(out, 'codemirror.bundle.js')}`], { stdio: 'inherit' });
fs.unlinkSync(entry);
const css = CSS.map((f) => `/* ${f} */\n${fs.readFileSync(path.join(src, f), 'utf8')}`).join('\n');
fs.writeFileSync(path.join(out, 'codemirror.bundle.css'), `/* CodeMirror ${version} (MIT) */\n${css}`);
fs.copyFileSync(path.join(src, 'LICENSE'), path.join(out, 'LICENSE'));
console.log(`CodeMirror ${version} bundled into ${path.relative(process.cwd(), out)}`);
