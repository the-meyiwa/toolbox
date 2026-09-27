/* ============================================================
   The tools brought over from DevToys, OmniTools, BentoPDF and
   Korempress: the pure logic behind every one of them.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { DOMParser } from '@xmldom/xmldom';
import { PDFDocument, degrees } from 'pdf-lib';

import * as D from '../../js/lib/transforms/data-formats.js';
import * as T from '../../js/lib/transforms/table-ops.js';
import * as X from '../../js/lib/transforms/text-ops.js';
import * as V from '../../js/lib/transforms/dev-ops.js';
import * as TM from '../../js/lib/transforms/time-ops.js';
import * as N from '../../js/lib/transforms/number-words.js';
import * as C from '../../js/lib/transforms/color-vision.js';
import { decodePem, nameString } from '../../js/lib/transforms/x509.js';
import { detect } from '../../js/lib/smart-detect.js';
import * as M from '../../js/lib/media/ops.js';
import { parseTime } from '../../js/lib/media/ffmpeg.js';
import * as O from '../../js/lib/pdf/ops.js';
import { loadKl, klEncode, klDecode } from '../../js/lib/korempress/kl.js';
import { packPdf, unpackPdf, packFile, unpackFile, filterRows, unfilterRows, subGreen } from '../../js/lib/korempress/container.js';
import { TOOLS, BY_ID } from '../../js/registry/index.js';
import { CATEGORIES, validateRegistry } from '../../js/registry/schema.js';
import { TASKS } from '../../js/registry/kinds.js';

const root = new URL('../../', import.meta.url);

/* ---------------- data formats ---------------- */

test('Data formats: CSV with quotes and newlines round-trips through JSON, YAML and XML', () => {
  const csv = 'name,age,city\n"Smith, J",42,Lagos\nAda,36,"New\nYork"\n';
  const recs = D.csvToRecords(csv);
  assert.deepEqual(recs, [{ name: 'Smith, J', age: 42, city: 'Lagos' }, { name: 'Ada', age: 36, city: 'New\nYork' }]);
  assert.deepEqual(D.readAs('yaml', D.writeAs('yaml', recs)), recs);
  assert.deepEqual(D.csvToRecords(D.recordsToCsv(recs)), recs);
  const xml = D.writeAs('xml', recs);
  assert.match(xml, /<name>Smith, J<\/name>/);
  assert.equal(D.readAs('xml', xml, { DOMParser }).root.item[1].age, 36);
});

test('Data formats: detection, nested flattening and XML formatting', () => {
  assert.equal(D.detectFormat('{"a":1}'), 'json');
  assert.equal(D.detectFormat('a: 1\nb: 2'), 'yaml');
  assert.equal(D.detectFormat('x\ty\n1\t2'), 'tsv');
  assert.equal(D.detectFormat('a;b\n1;2'), 'csv');
  assert.equal(D.sniffDelimiter('a;b;c\n1;2;3'), ';');
  const nested = [{ id: 1, address: { city: 'Abuja', zip: '900' } }];
  const csv = D.recordsToCsv(nested);
  assert.equal(csv.split('\n')[0], 'id,address.city,address.zip');
  assert.deepEqual(D.csvToRecords(csv, { unflatten: true, types: false }), [{ id: '1', address: { city: 'Abuja', zip: '900' } }]);
  assert.equal(D.formatXml('<a><b x="1">hi</b><c><d/></c></a>', {}, DOMParser), '<a>\n  <b x="1">hi</b>\n  <c>\n    <d/>\n  </c>\n</a>');
  assert.throws(() => D.parseXml('<a><b></a>', DOMParser), /Invalid XML/);
});

/* ---------------- tables and lists ---------------- */

test('CSV tools: sort, transpose, dedupe, columns and row checks', () => {
  const { rows } = T.readTable('id,name,pay\n2,Bo,10\n1,Al,9\n2,Bo,10\n3,Cy,');
  assert.deepEqual(T.sortByColumn(rows, 0).map((r) => r[0]), ['id', '1', '2', '2', '3']);
  assert.deepEqual(T.sortByColumn(rows, T.columnIndex(rows, 'pay'), { desc: true }).slice(1).map((r) => r[2]), ['10', '10', '9', '']);
  assert.equal(T.dedupeRows(rows).length, 4);
  assert.deepEqual(T.transpose([['a', 'b'], ['1', '2']]), [['a', '1'], ['b', '2']]);
  assert.deepEqual(T.swapColumns([['a', 'b']], 0, 1), [['b', 'a']]);
  assert.deepEqual(T.incompleteRows(rows).map((p) => p.line), [5]);
  assert.throws(() => T.columnIndex(rows, 'missing'), /No column/);
  const stats = T.columnStats(rows);
  assert.equal(stats[2].empty, 1);
});

test('List tools: frequencies, unique, groups, rotate, wrap and fair shuffle', () => {
  const list = ['a', 'B', 'b', 'c', 'a', 'a'];
  assert.deepEqual(T.frequencies(list).map((e) => [e.item, e.count]), [['a', 3], ['B', 2], ['c', 1]]);
  assert.deepEqual(T.uniqueItems(list), ['a', 'B', 'c']);
  assert.deepEqual(T.uniqueItems(list, { onlyOnce: true }), ['c']);
  assert.deepEqual(T.groupItems([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(T.rotateItems([1, 2, 3], -1), [3, 1, 2]);
  assert.deepEqual(T.unwrapItems(T.wrapItems(['x'], '"', '",'), '"', '",'), ['x']);
  const s = T.shuffle([1, 2, 3, 4, 5]);
  assert.deepEqual([...s].sort(), [1, 2, 3, 4, 5]);
});

/* ---------------- text ---------------- */

test('Text: ciphers, Morse both ways, extraction and escapes', () => {
  assert.equal(X.rot('Hello', 13), 'Uryyb');
  assert.equal(X.rot(X.rot('Zebra!', 3), -3), 'Zebra!');
  assert.equal(X.rot47(X.rot47('p@ss w0rd')), 'p@ss w0rd');
  assert.equal(X.atbash('abc'), 'zyx');
  assert.equal(X.reverseText('héllo 👋'), '👋 olléh');
  assert.ok(X.isPalindrome('A man, a plan, a canal: Panama'));
  assert.equal(X.toMorse('SOS help'), '... --- ... / .... . .-.. .--.');
  assert.equal(X.fromMorse('... --- ... / .... . .-.. .--.'), 'SOS HELP');
  assert.equal(X.censor('darn it, DARN', 'darn'), '**** it, ****');
  assert.deepEqual(X.extract('a@b.co, x@y.org and a@b.co', 'emails'), ['a@b.co', 'x@y.org']);
  assert.deepEqual(X.extract('see https://x.com/a?b=1. ok', 'urls'), ['https://x.com/a?b=1']);
  for (const [k, e] of Object.entries(X.ESCAPES)) {
    const sample = 'It\'s "5 < 6" & 50% off\nnew — ✓';
    assert.equal(e.decode(e.encode(sample)), sample, `${k} escape round-trips`);
  }
});

test('Hidden characters: zero-width, bidi and look-alike letters are found and cleaned', () => {
  const t = 'pаy​pal‮';
  const hits = X.findHiddenChars(t);
  assert.deepEqual(hits.map((h) => h.hex), ['U+0430', 'U+200B', 'U+202E']);
  assert.equal(hits[0].kind, 'lookalike');
  assert.equal(X.cleanHiddenChars(t), 'paypal');
  assert.equal(X.inspectChars('é')[0].utf8, 'C3 A9');
});

/* ---------------- developer ---------------- */

test('Developer: JSON diff, sorted keys, TypeScript types and splitting two documents', () => {
  const diff = V.jsonDiff({ a: 1, b: [1, 2], c: { d: 1 } }, { a: 2, b: [1], c: { d: 1, e: 3 } });
  assert.deepEqual(diff.map((d) => [d.type, d.path]), [['changed', '$.a'], ['removed', '$.b[1]'], ['added', '$.c.e']]);
  assert.equal(V.jsonDiff([1, 2], [2, 1], { ignoreOrder: true }).length, 0);
  assert.deepEqual(Object.keys(V.sortKeys({ b: 1, a: { d: 1, c: 2 } }).a), ['c', 'd']);
  const ts = V.jsonToTypeScript({ users: [{ id: 1, name: 'a' }, { id: 2 }] });
  assert.match(ts, /export interface User \{\n {2}id: number;\n {2}name\?: string;\n\}/);
  assert.match(ts, /users: User\[\];/);
  assert.equal(V.splitPair('{"a":1}\n=====\n{"a":2}').length, 2);
  assert.deepEqual(V.splitPair('{"a":1}{"b":2}').map((s) => JSON.parse(s)), [{ a: 1 }, { b: 2 }]);
});

test('Developer: SQL, JSONPath, gzip and bcrypt', async () => {
  assert.match(await V.formatSql('select a,b from t where x=1'), /^SELECT\n {2}a,\n {2}b\nFROM\n {2}t\nWHERE\n {2}x = 1$/);
  assert.equal(V.minifySql("select  a -- note\n , 'x  y' from t /* c */"), "select a,'x  y' from t");
  assert.deepEqual((await V.jsonPathQuery('{"a":[{"b":1},{"b":2}]}', '$.a[*].b')).map((h) => h.value), [1, 2]);
  const gz = await V.compressBytes(new TextEncoder().encode('hello hello hello'));
  assert.equal(V.sniffCompression(gz), 'gzip');
  assert.equal(new TextDecoder().decode(await V.decompressBytes(V.base64ToBytes(V.bytesToBase64(gz)))), 'hello hello hello');
  const h = await V.bcryptHash('secret', 4);
  assert.equal(V.bcryptInfo(h).cost, 4);
  assert.equal(await V.bcryptVerify('secret', h), true);
  assert.equal(await V.bcryptVerify('wrong', h), false);
});

test('Certificate decoder reads subject, SANs, key size and the SHA-256 fingerprint', async () => {
  const pem = fs.readFileSync(new URL('tests/fixtures/test-cert.pem', root), 'utf8');
  const der = Buffer.from(pem.replace(/-----[^-]+-----|\s/g, ''), 'base64');
  const [c] = await decodePem(pem, { now: new Date('2026-12-01T00:00:00Z') });
  assert.equal(c.type, 'certificate');
  assert.equal(nameString(c.subject), 'C=NG, O=Toolbox Test, CN=example.test');
  assert.ok(c.selfSigned);
  assert.deepEqual(c.san, ['DNS:example.test', 'DNS:www.example.test', 'IP:10.0.0.1']);
  assert.equal(c.key.algorithm, 'RSA');
  assert.equal(c.key.bits, 2048);
  assert.equal(c.key.exponent, 65537);
  assert.equal(c.version, 3);
  assert.equal(c.sha256, crypto.createHash('sha256').update(der).digest('hex').toUpperCase().match(/../g).join(':'));
  assert.equal(c.status, 'valid');
  const [late] = await decodePem(pem, { now: new Date('2030-01-01T00:00:00Z') });
  assert.equal(late.status, 'expired');
});

/* ---------------- numbers and dates ---------------- */

test('Numbers to words: cheques, decimals, ordinals and Roman numerals', () => {
  assert.equal(N.numberToWords('1,234,567.89', { currency: 'NGN', only: true }), 'One million two hundred and thirty-four thousand five hundred and sixty-seven naira and eighty-nine kobo only');
  assert.equal(N.numberToWords('1005'), 'One thousand and five');
  assert.equal(N.numberToWords('1005', { and: false }), 'One thousand five');
  assert.equal(N.numberToWords('3.14'), 'Three point one four');
  assert.equal(N.numberToWords('1', { currency: 'USD' }), 'One dollar');
  assert.equal(N.numberToWords('0.999', { currency: 'USD' }), 'One dollar');
  assert.equal(N.numberToWords('123456789012345678901234567'), 'One hundred and twenty-three septillion four hundred and fifty-six sextillion seven hundred and eighty-nine quintillion twelve quadrillion three hundred and forty-five trillion six hundred and seventy-eight billion nine hundred and one million two hundred and thirty-four thousand five hundred and sixty-seven');
  assert.equal(N.ordinal(21), 'twenty-first');
  assert.equal(N.ordinal(12), 'twelfth');
  assert.equal(N.toRoman(1994), 'MCMXCIV');
  assert.throws(() => N.numberToWords('12abc'), /Enter a number/);
});

test('Dates: calendar differences, month clamping, ISO weeks, durations and Discord tags', () => {
  const d = TM.parseDay;
  assert.deepEqual((({ years, months, days, totalDays }) => ({ years, months, days, totalDays }))(TM.between(d('2024-01-31'), d('2025-03-01'))), { years: 1, months: 1, days: 1, totalDays: 395 });
  assert.equal(TM.between(d('2026-09-28'), d('2026-10-05')).weekdays, 5);
  assert.equal(TM.fmtDay(TM.addToDate(d('2024-01-31'), { months: 1 })), '2024-02-29');
  assert.equal(TM.fmtDay(TM.addToDate(d('2024-03-10'), { days: -10 })), '2024-02-29');
  assert.equal(TM.describeDay(d('2026-09-27')).isoWeek, '2026-W39');
  assert.equal(TM.describeDay(d('2021-01-03')).isoWeek, '2020-W53');
  assert.equal(TM.parseDuration('7h 30m'), 7.5);
  assert.equal(TM.parseDuration('1:45'), 1.75);
  assert.equal(TM.formatDuration(7.5).clock, '7:30:00');
  assert.deepEqual(TM.leapYearsBetween(1896, 1912), [1896, 1904, 1908, 1912]);
  assert.equal(TM.discordTimestamps(new Date('2026-01-01T12:00:00Z'))[0].tag, '<t:1767268800:t>');
});

test('Colour vision: simulation matrices and confusable palette pairs', () => {
  assert.deepEqual(C.simulateRgb([255, 255, 255], 'deuteranopia'), [255, 255, 255]);
  const [r, g] = C.simulateRgb([255, 0, 0], 'protanopia');
  assert.ok(g > 0 && r < 255, 'red loses its redness for protanopes');
  const pairs = C.confusablePairs(['#ff0000', '#00aa00', '#0000ff'], 'deuteranopia');
  assert.deepEqual(pairs.map((p) => [p.a, p.b]), [['#ff0000', '#00aa00']]);
});

/* ---------------- smart paste ---------------- */

test('Smart paste recognises data and ignores ordinary searches', () => {
  const first = (t) => detect(t)[0]?.id ?? null;
  assert.equal(first('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123'), 'jwt');
  assert.equal(first('{"a": [1, 2]}'), 'json');
  assert.equal(first('<note><to>A</to></note>'), 'xml');
  assert.equal(first('SELECT id FROM users'), 'sql');
  assert.equal(first('*/5 * * * *'), 'cron');
  assert.equal(first('a,b\n1,2\n3,4'), 'csv');
  assert.equal(first('... --- ...'), 'morse');
  assert.equal(first('H4sIAAAAAAAAA8tIzcnJBwCGphA2BQAAAA=='), 'gzip');
  assert.equal(first('-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----'), 'pem');
  assert.equal(first('compress photo'), null);
  assert.equal(first('format json'), null);
  for (const d of detect('{"a":1}')) for (const id of d.tools) assert.ok(BY_ID.has(id), `${id} is a real tool`);
});

/* ---------------- media ---------------- */

test('Media: ffmpeg commands for every job are well formed', () => {
  assert.equal(parseTime('1:02.5'), 62.5);
  assert.equal(M.atempoChain(4), 'atempo=2,atempo=2');
  assert.equal(M.atempoChain(0.25), 'atempo=0.5,atempo=0.5');
  const trim = M.trimVideo(['in0.mp4'], { start: '0:05', end: '0:20' });
  assert.deepEqual(trim.args.slice(0, 4), ['-ss', '5', '-t', '15']);
  assert.ok(M.compressVideo(['in0.mp4'], { quality: 'small' }).args.includes('32'));
  assert.equal(M.videoToGif(['in0.mp4'], {}).output, 'out.gif');
  assert.throws(() => M.transformVideo(['in0.mp4'], {}), /at least one change/);
  const merge = M.mergeVideos(['a.mp4', 'b.mov'], { width: 1280, height: 720 });
  assert.match(merge.args[merge.args.indexOf('-filter_complex') + 1], /concat=n=2:v=1:a=1\[v\]\[a\]$/);
  assert.match(M.mergeAudio(['a', 'b', 'c'], { crossfade: 2 }).args.join(' '), /\[0:a\]\[1:a\]acrossfade=d=2\[x1\];\[x1\]\[2:a\]acrossfade=d=2\[a\]/);
  assert.ok(M.convertAudio(['in0.mp4'], { format: 'flac' }).args.includes('flac'));
  assert.ok(!M.convertAudio(['in0.mp4'], { format: 'wav' }).args.includes('-b:a'));
});

/* ---------------- PDF ---------------- */

async function samplePdf(n = 7) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i++) {
    const p = doc.addPage([595, 842]);
    if (i !== 1) p.drawText(`Page ${i + 1}`, { x: 50, y: 700, size: 30 });   // page 2 has no content stream
    if (i === 2) p.setRotation(degrees(90));
  }
  return doc.save();
}
const pageCount = async (b) => (await PDFDocument.load(b, { ignoreEncryption: true })).getPageCount();

test('PDF: N-up, booklet order and imposition, including rotated and empty pages', async () => {
  const b = await samplePdf(7);
  assert.equal(await pageCount(await O.nUp(b, { perSheet: 4 })), 2);
  assert.equal(await pageCount(await O.nUp(b, { perSheet: 2 })), 4);
  assert.deepEqual(O.bookletOrder(7), [null, 0, 1, 6, 5, 2, 3, 4]);
  const bk = await PDFDocument.load(await O.booklet(b));
  assert.equal(bk.getPageCount(), 4);
  assert.ok(bk.getPage(0).getWidth() > bk.getPage(0).getHeight(), 'booklet sheets are landscape');
});

test('PDF: reverse, interleave scans, insert blanks and crop by margins', async () => {
  const b = await samplePdf(6);
  assert.equal(await pageCount(await O.reversePages(b)), 6);
  assert.equal(await pageCount(await O.interleave([b, b])), 12);
  assert.equal(await pageCount(await O.insertBlanks(b, { every: 2 })), 9);
  const cropped = await PDFDocument.load(await O.cropPages(b, { mode: 'margins', top: 10, right: 10, bottom: 10, left: 10 }));
  assert.equal(Math.round(cropped.getPage(0).getWidth()), Math.round(595 - 20 * 72 / 25.4));
  assert.deepEqual(O.linesToTables([{ text: 'Item    Qty    Price' }, { text: 'Apple    2    1.00' }, { text: 'Pear    10    3.50' }, { text: 'Total' }]), [[['Item', 'Qty', 'Price'], ['Apple', '2', '1.00'], ['Pear', '10', '3.50']]]);
  assert.deepEqual(O.diffLines(['a', 'b', 'c'], ['a', 'c', 'd']), [['=', 'a'], ['-', 'b'], ['=', 'c'], ['+', 'd']]);
});

test('PDF: AES-256 password protection, removal and repair with qpdf', async () => {
  const b = await samplePdf(2);
  const locked = await O.encryptPdf(b, { user: 'open-sesame' });
  assert.ok((await PDFDocument.load(locked, { ignoreEncryption: true })).isEncrypted);
  await assert.rejects(O.decryptPdf(locked, { password: 'wrong' }), /password is not correct/);
  const open = await O.decryptPdf(locked, { password: 'open-sesame' });
  assert.equal((await PDFDocument.load(open)).isEncrypted, false);
  assert.equal(await pageCount((await O.repairPdf(b, { mode: 'linearize' })).bytes), 2);
});

/* ---------------- Korempress ---------------- */

test('Korempress: the wasm codec round-trips and refuses foreign data', async () => {
  await loadKl(() => fs.readFileSync(new URL('public/wasm/kl.wasm', root)));
  const text = new TextEncoder().encode('The quick brown fox jumps over the lazy dog. '.repeat(400));
  for (const level of [1, 3, 6]) {
    const packed = await klEncode(text, level);
    assert.ok(packed.length < text.length / 10, `level ${level} compresses repetitive text`);
    assert.deepEqual(await klDecode(packed), text);
  }
  await assert.rejects(klDecode(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])), /corrupt|not made/);
});

test('Korempress: PDF container rebuilds the file byte for byte', async () => {
  await loadKl(() => fs.readFileSync(new URL('public/wasm/kl.wasm', root)));
  const doc = await PDFDocument.create();
  for (let i = 0; i < 4; i++) doc.addPage([595, 842]).drawText(`Contract clause ${i} `.repeat(40), { x: 20, y: 400, size: 8 });
  const pdf = await doc.save({ useObjectStreams: true });
  const packed = await packPdf(pdf, { level: 3 });
  assert.ok(packed.recovered > 0, 'Flate streams were recovered');
  assert.deepEqual(await unpackPdf(packed.bytes), pdf);
  const tampered = packed.bytes.slice(); tampered[10] ^= 0xff;             // inside the fingerprint
  await assert.rejects(unpackPdf(tampered), /fingerprint/);
  const f = await packFile(new TextEncoder().encode('hello '.repeat(100)), 'notes.txt');
  assert.equal((await unpackFile(f)).name, 'notes.txt');
});

test('Korempress: image row filters and subtract-green are exact inverses', () => {
  const w = 7; const h = 5; const data = Uint8Array.from({ length: w * h * 3 }, (_, i) => (i * 37 + (i >> 3) * 11) & 255);
  assert.deepEqual(unfilterRows(filterRows(data, w, h, 3), w, h, 3), data);
  assert.deepEqual(subGreen(subGreen(data, w, h), w, h, 1), data);
});

/* ---------------- registry ---------------- */

test('Registry: the new categories are on the home page and every new tool is sound', () => {
  assert.deepEqual(validateRegistry(TOOLS), []);
  for (const id of ['pdf', 'media']) {
    assert.ok(CATEGORIES.some((c) => c.id === id));
    assert.ok(TASKS.some((t) => t.categories.includes(id)), `${id} belongs to a home-page group`);
    assert.ok(TOOLS.some((t) => t.category === id), `${id} has tools`);
  }
  for (const id of ['data-converter', 'pdf-ocr', 'video-compressor', 'lossless-archiver', 'color-blindness-simulator', 'cert-decoder']) assert.ok(BY_ID.has(id));
  assert.ok(new Set(CATEGORIES.map((c) => c.order)).size === CATEGORIES.length, 'category orders are distinct');
});
