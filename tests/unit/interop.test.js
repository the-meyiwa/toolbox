/* ============================================================
   Interop: kinds, routing between tools, the Recent store, and the
   headless entry points the Assistant uses to run any kit tool.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDOMEnvironment } from '../helpers/dom-env.js';
import { PDFDocument } from 'pdf-lib';

setupDOMEnvironment();
const { kindOf, targetsFor, toItem } = await import('../../js/lib/interop.js');
const { remember, recent, latest, clearRecent } = await import('../../js/lib/recent.js');
const { kindFromFilename } = await import('../../js/registry/kinds.js');
const { TOOLS } = await import('../../js/registry/index.js');

test('Kinds: media and archives are recognised by name and type', () => {
  assert.equal(kindFromFilename('clip.MOV'), 'video');
  assert.equal(kindFromFilename('song.flac'), 'audio');
  assert.equal(kindFromFilename('backup.zip'), 'archive');
  assert.equal(kindFromFilename('report.pdf.own'), 'archive');
  assert.equal(kindOf('x', 'application/pdf'), 'pdf');
  assert.equal(kindOf('noext', 'video/webm'), 'video');
  assert.equal(kindOf('data.tsv'), 'csv');
});

test('Routing: every file kind reaches specialist tools before generic ones', () => {
  for (const kind of ['pdf', 'image', 'video', 'audio', 'archive']) {
    const t = targetsFor(kind);
    assert.ok(t.length >= 2, `${kind} has somewhere to go`);
    const firstGeneric = t.findIndex((x) => (x.accepts || []).length >= 5);
    const lastSpecial = t.map((x) => (x.accepts || []).length < 5).lastIndexOf(true);
    assert.ok(firstGeneric === -1 || firstGeneric > lastSpecial, `${kind}: specialists first`);
  }
  assert.ok(targetsFor('video').some((t) => t.id === 'video-compressor'));
  assert.ok(targetsFor('pdf').some((t) => t.id === 'pdf-ocr'));
  assert.ok(!targetsFor('pdf', { exclude: 'pdf-ocr' }).some((t) => t.id === 'pdf-ocr'));
});

test('Registry: every file tool declares what it takes', () => {
  const fileTools = ['pdf-ocr', 'pdf-nup', 'video-compressor', 'audio-editor', 'lossless-archiver', 'file-hash', 'file-decompressor', 'video-player'];
  for (const id of fileTools) assert.ok(TOOLS.find((t) => t.id === id).accepts?.length, `${id} accepts something`);
});

test('Recent: newest first, filtered by kind, de-duplicated and bounded', async () => {
  clearRecent();
  const a = remember(await toItem({ name: 'a.pdf', data: new Uint8Array([1, 2, 3]), from: 'pdf-nup' }));
  remember({ name: 'notes.txt', kind: 'text', text: 'hi' });
  remember({ name: 'a.pdf', kind: 'pdf', blob: new Blob([new Uint8Array([1, 2, 3])]), from: 'pdf-nup' });
  assert.equal(a.kind, 'pdf');
  assert.equal(recent().length, 2, 'the same file from the same tool is kept once');
  assert.equal(latest('pdf').name, 'a.pdf');
  assert.equal(latest(['text']).name, 'notes.txt');
  for (let i = 0; i < 40; i++) remember({ name: `n${i}.txt`, kind: 'text', text: String(i) });
  assert.ok(recent().length <= 24);
  clearRecent();
});

test('Headless: text tools run any mode with options, and describe themselves', async () => {
  const conv = (await import('../../js/tools/data-converter.js')).default;
  assert.equal((await conv.runHeadless('a,b\n1,2', { to: 'yaml' })).text, '- a: 1\n  b: 2\n');
  const json = (await import('../../js/tools/json-tools.js')).default;
  assert.deepEqual(json.describe().modes.map((m) => m.id), ['compare', 'sort', 'types', 'flatten', 'string']);
  assert.equal((await json.runHeadless('{"b":1,"a":2}', { mode: 'sort' })).text, '{\n  "a": 2,\n  "b": 1\n}');
  await assert.rejects(json.runHeadless('{bad', { mode: 'sort' }), /not valid/);
});

test('Headless: file tools run on bytes, fill defaults, and check file counts', async () => {
  const doc = await PDFDocument.create();
  for (let i = 0; i < 4; i++) doc.addPage([595, 842]).drawText(`P${i}`, { x: 40, y: 700 });
  const bytes = await doc.save();
  const nup = (await import('../../js/tools/pdf-nup.js')).default;
  assert.equal(nup.describe().options.find((o) => o.key === 'per').default, '2');
  const r = await nup.runHeadless([{ name: 'deck.pdf', data: bytes }], { per: '4' });
  assert.equal(r.files[0].name, 'deck-4-up.pdf');
  assert.equal((await PDFDocument.load(r.files[0].data)).getPageCount(), 1);
  const cmp = (await import('../../js/tools/pdf-compare.js')).default;
  await assert.rejects(cmp.runHeadless([{ name: 'one.pdf', data: bytes }], {}), /needs 2 files/);
  const wf = (await import('../../js/tools/pdf-workflow.js')).default;
  const out = await wf.runHeadless([{ name: 'deck.pdf', data: bytes }], { steps: 'reverse, numbers, nup' });
  assert.equal(out.files[0].name, 'deck-processed.pdf');
  await assert.rejects(wf.runHeadless([{ name: 'deck.pdf', data: bytes }], { steps: 'teleport' }), /Unknown step: teleport/);
});
