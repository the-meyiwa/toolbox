import test from 'node:test';
import assert from 'node:assert/strict';

import fs from 'node:fs';
import { loadKl } from '../../js/lib/korempress/kl.js';

// The browser fetches the codec; Node reads it from disk.
await loadKl(() => fs.readFileSync(new URL('../../public/wasm/kl.wasm', import.meta.url)));
const { isCompressible, packForTransfer, unpackTransfer } = await import('../../js/lib/transfer-pack.js');

const csv = () => {
  const rows = ['id,name,city,amount'];
  for (let i = 0; i < 4000; i++) rows.push(`${i},Customer ${i % 97},${['Lagos', 'Abuja', 'Accra', 'Nairobi'][i % 4]},${(i * 37) % 1000}.00`);
  return new TextEncoder().encode(rows.join('\n'));
};

test('Transfer packing: only files that shrink are attempted', () => {
  assert.equal(isCompressible({ name: 'report.csv', type: 'text/csv', size: 200_000 }), true);
  assert.equal(isCompressible({ name: 'notes.pdf', type: 'application/pdf', size: 500_000 }), true);
  assert.equal(isCompressible({ name: 'data.json', type: '', size: 40_000 }), true, 'known extension without a MIME type');
  assert.equal(isCompressible({ name: 'photo.jpg', type: 'image/jpeg', size: 2_000_000 }), false, 'photos are already compressed');
  assert.equal(isCompressible({ name: 'clip.mp4', type: 'video/mp4', size: 5_000_000 }), false);
  assert.equal(isCompressible({ name: 'bundle.zip', type: 'application/zip', size: 900_000 }), false);
  assert.equal(isCompressible({ name: 'slides.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', size: 900_000 }), false);
  assert.equal(isCompressible({ name: 'tiny.txt', type: 'text/plain', size: 900 }), false, 'small files are not worth a round trip');
});

test('Transfer packing: text round-trips byte for byte and gets smaller', async () => {
  const bytes = csv();
  const pack = await packForTransfer(new Blob([bytes], { type: 'text/csv' }), { name: 'sales.csv', type: 'text/csv' });
  assert.equal(pack.packed, true);
  assert.ok(pack.packedSize < bytes.length * 0.5, `expected at least 2x smaller, got ${pack.packedSize} of ${bytes.length}`);
  const back = await unpackTransfer(new Uint8Array(await pack.blob.arrayBuffer()));
  assert.deepEqual(Buffer.from(back), Buffer.from(bytes));
});

test('Transfer packing: incompressible files are sent untouched', async () => {
  const noise = new Uint8Array(64 * 1024);
  for (let i = 0; i < noise.length; i += 65536) crypto.getRandomValues(noise.subarray(i, i + 65536));
  const blob = new Blob([noise], { type: 'text/plain' });
  const pack = await packForTransfer(blob, { name: 'noise.txt', type: 'text/plain' });
  assert.equal(pack.packed, false);
  assert.equal(pack.blob, blob, 'the original is sent when packing saves too little');
});

test('Transfer packing: unpacking leaves ordinary downloads alone', async () => {
  const plain = new TextEncoder().encode('just a normal file, never packed');
  assert.deepEqual(await unpackTransfer(plain), plain);
});

test('Files cloud sync: uploads the packed file and keeps the bytes out of the database record', async () => {
  const store = new Map();
  const prevLs = globalThis.localStorage;
  const prevFetch = globalThis.fetch;
  globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
  store.set('toolbox_supabase_session', JSON.stringify({ id: 'u1', email: 'a@b.c', token: 't' }));
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const { fs: files } = await import('../../js/lib/filesystem.js');
    const bytes = csv();
    await files._syncOnline({ id: 'f1', name: 'sales.csv', path: '/sales.csv', mimeType: 'text/csv', size: bytes.length, kind: 'file', content: '', binaryData: bytes });
    const upload = calls.find(c => c.url.includes('/storage/v1/object/toolbox-files/'));
    const row = calls.find(c => c.url.includes('/rest/v1/saved_artifacts'));
    assert.ok(upload.url.endsWith('/u1/sales.csv.kpk'), upload.url);
    assert.ok(upload.init.body.size < bytes.length / 2, 'the upload is the packed copy');
    const payload = JSON.parse(row.init.body).payload;
    assert.equal(payload.binaryData, undefined, 'bytes are not duplicated into the JSON row');
    assert.equal(payload.content, undefined);
    assert.equal(payload.packed, true);
    assert.equal(payload.bytes, bytes.length);
    assert.ok(row.init.body.length < 2000, `row is metadata only (${row.init.body.length} chars)`);
  } finally {
    globalThis.localStorage = prevLs;
    globalThis.fetch = prevFetch;
  }
});
