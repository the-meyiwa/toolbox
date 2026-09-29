import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const { icon, ICON_NAMES, statusHtml, iconLabel } = await import('../../js/lib/icons.js');
const { TOOLS } = await import('../../js/registry/index.js');

test('Icons: every interface icon is a 24px line icon, hidden from screen readers unless labelled', () => {
  for (const name of ICON_NAMES) {
    const svg = icon(name);
    assert.match(svg, /^<svg class="tb-i" viewBox="0 0 24 24"/, name);
    assert.match(svg, /aria-hidden="true"/, name);
  }
  assert.match(icon('star', { label: 'Starred' }), /role="img" aria-label="Starred"/);
  assert.equal(icon('no-such-icon'), '');
});

test('Icons: status lines and labels escape their text', () => {
  const html = statusHtml('error', '<img src=x onerror=alert(1)>');
  assert.ok(!html.includes('<img'), html);
  assert.ok(html.includes('&lt;img'));
  assert.ok(!iconLabel('paperclip', '"><script>').includes('<script>'));
});

test('Icons: every tool has its own icon', () => {
  const seen = new Map();
  for (const t of TOOLS) {
    assert.ok(t.icon?.startsWith('<svg'), `${t.id} has no icon`);
    assert.ok(!seen.has(t.icon), `${t.id} uses the same icon as ${seen.get(t.icon)}`);
    seen.set(t.icon, t.id);
  }
});

test('Icons: buttons and status lines use drawn icons, not text glyphs', () => {
  const files = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p);
  });
  walk('js');
  // Code written into the user's own projects and terminal output keep their text glyphs.
  const exempt = /playground[\\/](templates|commands-[a-z]+|agent)\.js$|assistant-tools\.js$/;
  const glyphButton = />\s*[✕✖🗑⏸⏮⏭⧉⤓⌫⊞⊟⟳⤢⇄↺＋]\s*<\/button>/;
  const glyphStatus = /textContent = [`'](?:✓|✗|▶|⏸)/;
  const found = [];
  for (const f of files) {
    if (exempt.test(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    if (glyphButton.test(src)) found.push(`${f}: glyph button`);
    if (glyphStatus.test(src)) found.push(`${f}: glyph status`);
  }
  assert.deepEqual(found, []);
});

test('Icons: clicks on an icon reach its button', () => {
  const css = fs.readFileSync('css/base.css', 'utf8');
  assert.match(css, /\.tb-i \{[^}]*pointer-events: none/, 'handlers that read e.target must see the button, not the SVG');
});
