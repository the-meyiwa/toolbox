import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';

setupDOMEnvironment();
const { fs } = await import('../../js/lib/filesystem.js');

test('moving to Offline Files copies first, then removes the source', async () => {
  await fs.init();
  await fs.writeFile('/Online/report.txt', 'quarterly numbers', { storage: 'offline' });
  await fs.writeFile('/Home/report.txt', 'already here');
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 204 });
  try {
    const { moved, failed } = await fs.transfer(['/Online/report.txt'], 'offline');
    assert.equal(moved, 1);
    assert.deepEqual(failed, []);
    assert.equal(await fs.readFile('/Home/report (2).txt'), 'quarterly numbers', 'a clashing name gets a number, never overwrites');
    assert.equal(await fs.readFile('/Home/report.txt'), 'already here');
    assert.equal(await fs.stat('/Online/report.txt'), null);
  } finally { globalThis.fetch = original; }
});

test('moving to Online Files needs an account', async () => {
  await fs.writeFile('/Home/private.txt', 'x');
  await assert.rejects(fs.transfer(['/Home/private.txt'], 'online'), /Sign in/);
  assert.equal(await fs.readFile('/Home/private.txt'), 'x', 'nothing is lost when the move cannot happen');
});
