/* ============================================================
   Streaming render: finished blocks are frozen once; only the
   live tail is re-rendered. And the About page stays idle-cheap.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stableBoundary } from '../../js/lib/assistant/markdown.js';

test('Streaming: the stable boundary is the last blank line outside code and math', () => {
  const t = 'Intro paragraph.\n\nSecond paragraph.\n\nStill typ';
  assert.equal(stableBoundary(t), t.indexOf('Still'));
  const code = 'Before.\n\n```js\nconst a = 1;\n\nconst b = 2;\n';
  assert.equal(stableBoundary(code), code.indexOf('```'), 'a blank line inside an open fence is not a boundary');
  const closed = `${code}\`\`\`\n\nAfter`;
  assert.equal(stableBoundary(closed), closed.indexOf('After'));
  const math = 'Text.\n\n$$\na = b\n\nc = d\n';
  assert.equal(stableBoundary(math), math.indexOf('$$'), 'nor inside display math');
  assert.equal(stableBoundary('no breaks yet'), 0);
  const from = t.indexOf('Second');
  assert.equal(stableBoundary(t, from), t.indexOf('Still'), 'scanning can resume from a known boundary');
});

test('About page: no looping motion under blur filters, no backdrop blur over moving light', () => {
  const css = fs.readFileSync('css/about.css', 'utf8');
  const loops = [...css.matchAll(/([^{}]+)\{[^}]*animation[^;}]*\binfinite\b[^}]*\}/g)].map(m => m[1].trim());
  assert.deepEqual(loops.filter(sel => !/marquee-row/.test(sel)), [], 'only the (visibility-gated) marquee may loop');
  for (const sel of ['.about-aurora', '.korelearn-glow', '.bento-card']) {
    const rule = css.match(new RegExp(`${sel.replace('.', '\\.')}\\s*\\{[^}]*\\}`))?.[0] || '';
    assert.ok(!/filter\s*:\s*blur/.test(rule), `${sel} must not use a blur filter`);
    assert.ok(!/backdrop-filter/.test(rule), `${sel} must not use backdrop-filter`);
  }
});
