/* ============================================================
   UI motion guards: the rules the audit established, kept true.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const walk = (dir, ext) => fs.readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(`${dir}${e.name}/`, ext) : e.name.endsWith(ext) ? [`${dir}${e.name}`] : []);

test('No `transition: all` anywhere: it animates layout and makes motion janky', () => {
  const offenders = [...walk('css/', '.css'), ...walk('js/', '.js')]
    .filter((f) => /transition:\s*all\b/.test(read(f)));
  assert.deepEqual(offenders, []);
});

test('The motion layer is loaded and installed', () => {
  assert.match(read('css/style.css'), /@import url\("\.\/motion\.css"\)/);
  const app = read('js/app.js');
  assert.match(app, /installMotion\(\)/);
  assert.match(app, /installGlobalMenus\(/);
  assert.match(app, /installLongPress\(\)/);
});

test('Motion respects reduced-motion and only moves cheap properties', () => {
  const css = read('css/motion.css');
  assert.match(css, /prefers-reduced-motion: reduce/);
  const transitions = [...css.matchAll(/transition:([^;]+);/g)].map((m) => m[1]);
  for (const t of transitions) assert.doesNotMatch(t, /\b(top|left|right|bottom|margin|padding|max-height)\b/, t);
});

test('Palette and menus animate out as well as in', () => {
  assert.match(read('js/lib/palette.js'), /is-closing/);
  assert.match(read('js/lib/menu-motion.js'), /animate\(/);
  assert.match(read('js/lib/context-menu.js'), /transformOrigin/);
});

test('Every stylesheet parses (an unclosed brace silently drops everything after it)', async () => {
  const { default: postcss } = await import('postcss');
  for (const f of walk('css/', '.css')) assert.doesNotThrow(() => postcss.parse(read(f), { from: f }), f);
});

test('No entrance fades on content in the Assistant or the page shell', () => {
  const ast = read('css/assistant.css');
  for (const sel of ['.ast-turn', '.ast-step', '.ast-sug', '.astc']) {
    const block = ast.match(new RegExp(`\\${sel} \\{[^}]*\\}`))?.[0] || '';
    assert.doesNotMatch(block, /animation:\s*ast-(rise|fade)/, sel);
  }
  assert.doesNotMatch(read('css/shell.css'), /\.page-view:not\(\.hidden\) \{ animation/);
});
