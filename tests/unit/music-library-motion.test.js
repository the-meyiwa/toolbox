import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js = fs.readFileSync('js/lib/music/library-motion.js', 'utf8');
const css = fs.readFileSync('css/music-library.css', 'utf8');
const tool = fs.readFileSync('js/tools/music-theory-library.js', 'utf8');

test('Music library motion: every kind of content has an entrance', () => {
  const kinds = [...new Set([...js.matchAll(/\['[^']+',\s*'([a-z]+)'\]/g)].map((m) => m[1]))];
  assert.ok(kinds.length >= 12, `kinds: ${kinds}`);
  for (const kind of kinds) assert.ok(css.includes(`[data-rv="${kind}"]`), `no styles for "${kind}"`);
  for (const sel of ['.mtl-card', '.mtl-row', '.mtl-gloss > div', '.mtl-table tbody tr', '.mtl-road > li', '.mtl-demo', 'svg.mk-piano', 'svg.ms-staff', 'svg.mk-fret', '.mtl-circle', 'li', 'p']) {
    assert.ok(js.includes(sel), `${sel} is not animated`);
  }
});

test('Music library motion: instruments reveal their parts and light up with the sound', () => {
  for (const part of ['.mk-piano.is-in .mk-key', '.ms-staff.is-in .ms-col', '.ms-staff.is-in .ms-line', '.mk-fret.is-in .fb-note', '.mtl-circle.is-in .cf-seg']) assert.ok(css.includes(part), part);
  for (const lit of ['.mk-key.is-sounding', '.ms-col.is-sounding', '.fb-note.is-sounding', 'tr.is-sounding']) assert.ok(css.includes(lit), lit);
  assert.match(tool, /onNote:/, 'scales and melodies light their notes as they play');
  assert.match(tool, /onHit:/, 'rhythms light their cells as they play');
});

test('Music library motion: nothing loops, and reduced motion shows everything at once', () => {
  const block = css.slice(css.indexOf('Music Theory Library — motion'));
  assert.ok(!/\binfinite\b/.test(block), 'no looping animations');
  assert.ok(!/filter\s*:\s*blur/.test(block), 'no blur filters');
  assert.match(block, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.mtl-rv[\s\S]*opacity: 1 !important/);
  assert.match(js, /prefers-reduced-motion: reduce/);
});
