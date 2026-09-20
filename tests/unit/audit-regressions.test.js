import test from 'node:test';
import assert from 'node:assert/strict';
import { removeMenu } from '../../js/lib/menu-motion.js';
import { writeID3v2 } from '../../js/tools/audio-tag-editor.js';

test('Menu dismissal releases its ID immediately and removes once after animation', async () => {
  let finish;
  let removals = 0;
  let animations = 0;
  const attrs = { id: 'toolbox-context-menu' };
  const menu = {
    style: {},
    setAttribute: (k, v) => { attrs[k] = v; },
    removeAttribute: k => { delete attrs[k]; },
    remove: () => { removals++; },
    animate: () => { animations++; return { finished: new Promise(resolve => { finish = resolve; }) }; },
  };
  removeMenu(menu);
  removeMenu(menu);
  assert.equal(attrs.id, undefined);
  assert.equal(menu.inert, true);
  assert.equal(menu.style.pointerEvents, 'none');
  assert.equal(animations, 1);
  assert.equal(removals, 0);
  finish();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(removals, 1);
});

test('Menu dismissal works without Web Animations support', () => {
  let removed = false;
  removeMenu({ remove: () => { removed = true; } });
  assert.equal(removed, true);
});

test('MP3 export preserves a large audio payload and replaces existing tags', () => {
  const audio = new Uint8Array(8 * 1024 * 1024);
  for (let i = 0; i < audio.length; i++) audio[i] = i % 251;
  const first = writeID3v2(audio, { title: 'First title' });
  const result = writeID3v2(first, { title: 'Updated title', artist: 'Test artist' });
  const tagSize = ((result[6] & 127) << 21) | ((result[7] & 127) << 14) | ((result[8] & 127) << 7) | (result[9] & 127);
  assert.deepEqual(result.subarray(10 + tagSize), audio);
  assert.equal(result.length, 10 + tagSize + audio.length);
});
