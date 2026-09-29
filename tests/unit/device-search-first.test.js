/* ============================================================
   Tech Device Comparisons opens on a search bar alone, searches
   every category at once, never shows empty "choose a device"
   slots, and every block has an entrance (lib/reveal-motion.js).
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const qs = await import('../../js/lib/devices/quick-search.js');
const tool = fs.readFileSync('js/tools/tech-device-comparisons.js', 'utf8');
const css = fs.readFileSync('css/devices.css', 'utf8');
const motionCss = fs.readFileSync('css/motion.css', 'utf8');
const motionJs = fs.readFileSync('js/lib/reveal-motion.js', 'utf8');

test('searchAllDevices: many matches across categories, best first', async () => {
  const iphones = await qs.searchAllDevices('iphone', { limit: 6 });
  assert.equal(iphones.length, 6);
  assert.ok(iphones.every(h => h.category === 'phones' && /iPhone/.test(h.device.name)));

  const m4 = await qs.searchAllDevices('m4 max', { limit: 6 });
  const cats = new Set(m4.map(h => h.category));
  assert.ok(cats.has('cpus') && cats.has('laptops'), `the chip and the laptops that use it: ${[...cats]}`);
  assert.equal(m4[0].device.name, 'Apple M4 Max');

  assert.deepEqual(await qs.searchAllDevices('   '), []);
});

test('searchAllDevices: falls back to specs when nothing is named that', async () => {
  const hits = await qs.searchAllDevices('snapdragon 8 elite', { limit: 8 });
  assert.ok(hits.length > 0);
});

test('matchCategories: plain words name a category', () => {
  assert.equal(qs.matchCategories('phones')[0].category, 'phones');
  assert.equal(qs.matchCategories('tv')[0].category, 'tvs');
  assert.equal(qs.matchCategories('graphics cards')[0].category, 'gpus');
  assert.equal(qs.matchCategories('gpu')[0].category, 'gpus');
  assert.deepEqual(qs.matchCategories('x'), []);
});

test('the tool opens on the home-page search bar and nothing else', () => {
  assert.match(tool, /mode: handoff \? 'work' : 'home'/);
  assert.match(tool, /class="home-search-wrap dv-qs/);
  assert.match(tool, /class="home-search-input" data-qs-input/);
  assert.match(tool, /home-search-submit/);
  assert.match(tool, /home-hero-dropdown dv-qs-dd/);
  assert.match(css, /\.dv\.is-home \.dv-bar, \.dv\.is-home \.dv-body \{ display: none; \}/);
});

test('no placeholders: no empty device slots, no "Choose a …" pickers, no loading skeleton', () => {
  for (const gone of ['renderStart', 'dv-slot-empty', 'dv-slot-cta', 'is-empty', 'Choose a ${', 'dv-loading']) {
    assert.ok(!tool.includes(gone), `${gone} is still in the tool`);
  }
  for (const gone of ['.dv-slot-', '.dv-start', '.dv-picker-btn.is-empty']) assert.ok(!css.includes(gone), `${gone} is still styled`);
  // one device gets a full profile with real rivals; no device gets a real overview
  assert.match(tool, /renderProfile\(A\)/);
  assert.match(tool, /renderOverview\(\)/);
  assert.match(tool, /suggestions\(this\.data, A\.id, 6\)/);
});

test('motion: every kind the tool uses is styled, and reduced motion shows everything', () => {
  const block = tool.slice(tool.indexOf('const MOTION'), tool.indexOf('/* Category glyphs'));
  const kinds = [...new Set([...block.matchAll(/\['[^']+',\s*'([a-z]+)'\]/g)].map(m => m[1]))];
  assert.ok(kinds.length >= 10, `kinds: ${kinds}`);
  for (const kind of kinds) assert.ok(motionCss.includes(`[data-rv="${kind}"]`), `no styles for "${kind}"`);
  for (const sel of ['.dv-hero-card', '.dv-verdict', '.dv-bf', '.dv-sbar', '.dv-table tr', '.dv-why-card li', '.dv-rival', '.dv-rank-row', '.dv-stand-row', '.dv-ov-item', '.dv-card', 'p']) {
    assert.ok(block.includes(sel), `${sel} is not animated`);
  }
  assert.match(block, /fill: '[^']*\.dv-ring/, 'score rings fill as they arrive');
  assert.match(tool, /data-count=/, 'scores count up');
  assert.match(tool, /flip\(root, \{ scale: false/, 'the search bar glides to the top');
  assert.match(motionCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.rv-u[\s\S]*opacity: 1 !important/);
  assert.match(motionJs, /prefers-reduced-motion: reduce/);
  const devicesMotion = css.slice(css.indexOf('Search first'));
  assert.ok(!/\binfinite\b/.test(devicesMotion), 'nothing loops');
});
