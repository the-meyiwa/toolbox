import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { fileAttrs, registerFile, fileById, blobOf, formatSize } = await import('../../js/lib/file-surface.js');

test('Files anywhere: a marked element is draggable, focusable and names its file', () => {
  const html = fileAttrs({ key: 'msg:1', name: 'notes "q".md', text: '# hi' });
  assert.match(html, /data-tb-file="k:msg:1"/);
  assert.match(html, /draggable="true"/);
  assert.match(html, /tabindex="0"/);
  assert.equal(fileById('k:msg:1').name, 'notes "q".md');
});

test('Files anywhere: a file keeps one entry and its loaded body across re-renders', async () => {
  let loads = 0;
  const id = registerFile({ key: 'mail:a:1', name: 'a.txt', load: async () => { loads++; return new Blob(['abc'], { type: 'text/plain' }); } });
  const first = await blobOf(fileById(id));
  registerFile({ key: 'mail:a:1', name: 'a.txt', load: async () => { loads++; return new Blob(['zzz']); } });
  const again = await blobOf(fileById(id));
  assert.equal(await again.text(), 'abc');
  assert.equal(loads, 1, 'loaded once');
  assert.equal(first.size, 3);
});

test('Files anywhere: text bodies and sizes', async () => {
  const id = registerFile({ name: 'x.csv', type: 'text/csv', text: 'a,b\n1,2' });
  const blob = await blobOf(fileById(id));
  assert.equal(blob.type, 'text/csv');
  assert.equal(formatSize(512), '512 B');
  assert.equal(formatSize(2048), '2.0 KB');
  await assert.rejects(() => blobOf(null), /no longer available/);
});

test('Files anywhere: every place a file appears uses the shared behaviour', () => {
  const uses = {
    'js/tools/messaging.js': /fileAttrs\(\{ key: `msg:/,
    'js/tools/mail.js': /attachmentFile\(m, a\)/,
    'js/tools/assistant.js': /attachmentFile\(a\)/,
    'js/lib/kit/file-tool.js': /fileAttrs\(/,
    'js/tools/file-drop.js': /markFile\(incomingCard/,
    'js/lib/space-activities.js': /fileAttrs\(/,
    'js/lib/assistant-result-renderer.js': /markFile\(card/,
    'js/app.js': /installFileSurface\(\)/,
  };
  for (const [file, re] of Object.entries(uses)) assert.match(fs.readFileSync(file, 'utf8'), re, file);
  const menu = fs.readFileSync('js/lib/file-surface.js', 'utf8');
  for (const label of ['Quick Look', 'Ask Assistant', 'Save to Files', 'Download', 'Get info']) assert.ok(menu.includes(`'${label}'`), label);
});
