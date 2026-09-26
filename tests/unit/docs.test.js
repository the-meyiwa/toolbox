/* ============================================================
   Document layer: every format reads back what it wrote, previews
   build for every format the File Explorer hands over, formulas
   evaluate, and the explorer offers the right editor.
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser } from '@xmldom/xmldom';

globalThis.DOMParser = DOMParser;

const formats = await import('../../js/lib/docs/formats.js');
const { rtfToModel, modelToRtf } = await import('../../js/lib/docs/rtf.js');
const { modelToOdt, odtToModel, deckToOdp, odpToDeck } = await import('../../js/lib/docs/odf.js');
const { modelToDocx, docxToModel } = await import('../../js/lib/docs/docx.js');
const { deckToPptx, pptxToDeck } = await import('../../js/lib/docs/pptx.js');
const { readWorkbook, writeWorkbook, parseDelimited, coerce } = await import('../../js/lib/docs/sheets.js');
const { evaluate } = await import('../../js/lib/docs/formula.js');
const { shiftFormula } = await import('../../js/lib/docs/formula-shift.js');
const { modelToMarkdown, modelToText, modelToHtml } = await import('../../js/lib/docs/model.js');
const { docToText, pptToDeck } = await import('../../js/lib/docs/legacy.js');
const { readEpub } = await import('../../js/lib/docs/epub.js');
const { renderPreview } = await import('../../js/lib/docs/preview.js');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const SAMPLE = [
  { type: 'paragraph', style: 'h1', runs: [{ text: 'Quarterly report' }] },
  { type: 'paragraph', style: 'p', align: 'center', runs: [{ text: 'Plain, ' }, { text: 'bold', bold: true }, { text: ' and ' }, { text: 'a link', href: 'https://example.com' }, { text: ' “quoted” é' }] },
  { type: 'paragraph', style: 'p', list: { ordered: false, level: 0 }, runs: [{ text: 'First' }] },
  { type: 'paragraph', style: 'p', list: { ordered: true, level: 1 }, runs: [{ text: 'Nested', color: 'c0392b' }] },
  { type: 'table', rows: [{ header: true, cells: [[{ text: 'Region' }], [{ text: 'Total' }]] }, { cells: [[{ text: 'North' }], [{ text: '42' }]] }] },
  { type: 'image', src: PNG, width: 10, height: 10 },
  { type: 'paragraph', style: 'quote', runs: [{ text: 'A quotation' }] },
];

const text = (blocks) => blocks.filter(b => b.type === 'paragraph').map(b => b.runs.map(r => r.text).join(''));
const bytesOf = async (blob) => new Uint8Array(await blob.arrayBuffer());

function assertSampleShape(blocks, { links = true, quote = true } = {}) {
  const paras = text(blocks);
  assert.ok(paras.includes('Quarterly report'), 'heading text survives');
  assert.equal(blocks.find(b => b.runs?.[0]?.text === 'Quarterly report').style, 'h1', 'heading level survives');
  const body = blocks.find(b => b.type === 'paragraph' && text([b])[0].startsWith('Plain'));
  assert.equal(body.align, 'center', 'alignment survives');
  assert.ok(body.runs.some(r => r.bold && r.text === 'bold'), 'bold survives');
  if (links) assert.ok(body.runs.some(r => r.href === 'https://example.com'), 'link survives');
  assert.ok(text([body])[0].includes('“quoted” é'), 'non-ASCII survives');
  const items = blocks.filter(b => b.list);
  assert.equal(items.length, 2, 'both list items survive');
  assert.equal(items[0].list.ordered, false);
  assert.deepEqual(items[1].list, { ordered: true, level: 1 }, 'nested numbered item keeps level and numbering');
  assert.equal(items[1].runs[0].color, 'c0392b', 'colour survives');
  const table = blocks.find(b => b.type === 'table');
  assert.equal(table.rows.length, 2);
  assert.equal(table.rows[1].cells[1][0].text, '42');
  if (quote) assert.equal(blocks.find(b => text([b])[0] === 'A quotation')?.style, 'quote', 'quote style survives');
}

test('formats: families, editors and save targets', () => {
  assert.equal(formats.editorFor('Report.DOCX'), 'scribe');
  assert.equal(formats.editorFor('notes.odt'), 'scribe');
  assert.equal(formats.editorFor('q3.xlsx'), 'ledger');
  assert.equal(formats.editorFor('data.csv'), 'ledger');
  assert.equal(formats.editorFor('talk.pptx'), 'podium');
  assert.equal(formats.editorFor('talk.odp'), 'podium');
  assert.equal(formats.editorFor('scan.pdf'), 'pdf-editor');
  assert.equal(formats.editorFor('photo.png'), null);
  // Every editor writes back the format it opened…
  for (const [name, tool] of [['a.docx', 'scribe'], ['a.odt', 'scribe'], ['a.rtf', 'scribe'], ['a.md', 'scribe'], ['a.txt', 'scribe'], ['a.xlsx', 'ledger'], ['a.xls', 'ledger'], ['a.ods', 'ledger'], ['a.csv', 'ledger'], ['a.tsv', 'ledger'], ['a.pptx', 'podium'], ['a.odp', 'podium']]) {
    assert.equal(formats.saveNameFor(name, tool), name, `${name} saves as itself`);
  }
  // …except the legacy binaries, which become their modern sibling.
  assert.equal(formats.saveNameFor('old.doc', 'scribe'), 'old.docx');
  assert.equal(formats.saveNameFor('old.ppt', 'podium'), 'old.pptx');
  for (const ext of ['docx', 'doc', 'odt', 'rtf', 'xlsx', 'xls', 'ods', 'pptx', 'ppt', 'odp', 'epub']) assert.ok(formats.hasRichPreview(`f.${ext}`), `${ext} has a preview`);
});

test('rtf: write then read keeps structure', () => {
  const blocks = rtfToModel(modelToRtf(SAMPLE));
  assertSampleShape(blocks, { quote: false });
  assert.ok(blocks.some(b => b.type === 'image' && b.src.startsWith('data:image/png;base64,')), 'picture survives');
});

test('rtf: reads unicode escapes, code-page bytes and skips unknown destinations', () => {
  // Built from parts so no tool along the way turns the escape into the character.
  const blocks = rtfToModel(['{', 'rtf1', 'ansi', 'ansicpg1252{', 'fonttbl{', 'f0 Arial;}}{', '*', 'generator Foo;}', 'uc1 Caf', "'e9 ", 'u' + '8364? {', 'b bold}', 'par Second', 'line line', 'par}'].join('\\'));
  assert.deepEqual(text(blocks), ['Café € bold', 'Second\nline']);
  assert.ok(blocks[0].runs.some(r => r.bold && r.text === 'bold'));
});

test('odt: write then read keeps structure', async () => {
  const blocks = await odtToModel(await bytesOf(await modelToOdt(SAMPLE, { title: 'Report' })));
  assertSampleShape(blocks);
  assert.ok(blocks.some(b => b.type === 'image' && b.src.startsWith('data:image/png')), 'picture survives');
});

test('docx: write then read keeps structure', async () => {
  const blocks = await docxToModel(await bytesOf(await modelToDocx(SAMPLE, { title: 'Report' })));
  assertSampleShape(blocks);
  assert.ok(blocks.some(b => b.type === 'image' && b.src.startsWith('data:image/png') && b.width === 10), 'picture and its size survive');
});

test('model: markdown, text and html writers', () => {
  const md = modelToMarkdown(SAMPLE);
  assert.match(md, /^# Quarterly report/m);
  assert.match(md, /\*\*bold\*\*/);
  assert.match(md, /\[a link\]\(https:\/\/example\.com\)/);
  assert.match(md, /^- First$/m);
  assert.match(md, /^ {3}1\. Nested$/m);
  assert.match(md, /\| Region \| Total \|/);
  assert.match(md, /^> A quotation$/m);
  const txt = modelToText(SAMPLE);
  assert.match(txt, /• First/);
  assert.match(txt, /North\t42/);
  const html = modelToHtml([{ type: 'paragraph', style: 'p', runs: [{ text: '<script>alert(1)</script>' }] }]);
  assert.ok(!html.includes('<script>'), 'text is escaped in html');
});

const DECK = {
  width: 960, height: 540, slides: [
    {
      background: 'ffeecc', notes: 'Say hello', elements: [
        { type: 'box', x: 50, y: 40, w: 860, h: 100, valign: 'middle', paragraphs: [{ align: 'center', runs: [{ text: 'Hello deck', size: 40, bold: true, color: '112233' }] }] },
        { type: 'box', x: 50, y: 160, w: 400, h: 300, paragraphs: [{ bullet: true, level: 0, runs: [{ text: 'Point one', size: 24 }] }, { bullet: true, level: 1, runs: [{ text: 'Sub point', size: 20, italic: true }] }] },
        { type: 'box', shape: 'ellipse', fill: '3366ff', x: 500, y: 160, w: 200, h: 200, valign: 'middle', paragraphs: [{ align: 'center', runs: [{ text: 'Oval', size: 18, color: 'ffffff' }] }] },
        { type: 'image', x: 720, y: 300, w: 100, h: 100, src: PNG },
      ],
    },
    { notes: '', elements: [{ type: 'box', x: 10, y: 10, w: 300, h: 50, paragraphs: [{ runs: [{ text: 'Second slide', size: 28 }] }] }] },
  ],
};

function assertDeckShape(deck) {
  assert.equal(deck.slides.length, 2);
  assert.ok(Math.abs(deck.width - 960) < 1 && Math.abs(deck.height - 540) < 1, 'slide size survives');
  const [s1, s2] = deck.slides;
  assert.equal(s1.background, 'ffeecc');
  assert.equal(s1.notes, 'Say hello');
  const title = s1.elements.find(e => e.paragraphs?.[0]?.runs?.[0]?.text === 'Hello deck');
  assert.ok(title, 'title text survives');
  assert.equal(title.paragraphs[0].align, 'center');
  assert.equal(title.valign, 'middle');
  assert.deepEqual([title.paragraphs[0].runs[0].size, title.paragraphs[0].runs[0].bold, title.paragraphs[0].runs[0].color], [40, true, '112233']);
  assert.ok(Math.abs(title.x - 50) < 1 && Math.abs(title.w - 860) < 1, 'geometry survives');
  const list = s1.elements.find(e => e.paragraphs?.length === 2);
  assert.deepEqual(list.paragraphs.map(p => [p.bullet, p.level]), [[true, 0], [true, 1]], 'bullets and levels survive');
  const oval = s1.elements.find(e => e.shape === 'ellipse');
  assert.equal(oval?.fill, '3366ff', 'shape and fill survive');
  assert.ok(s1.elements.some(e => e.type === 'image' && e.src.startsWith('data:image/png')), 'picture survives');
  assert.equal(s2.elements[0].paragraphs[0].runs[0].text, 'Second slide');
}

test('pptx: write then read keeps slides, text, shapes, pictures and notes', async () => {
  assertDeckShape(await pptxToDeck(await bytesOf(await deckToPptx(DECK))));
});

test('odp: write then read keeps slides, text, shapes, pictures and notes', async () => {
  assertDeckShape(await odpToDeck(await bytesOf(await deckToOdp(DECK))));
});

test('sheets: csv parsing and typing', () => {
  assert.deepEqual(parseDelimited('a,"b,c"\r\n"say ""hi""",2\n'), [['a', 'b,c'], ['say "hi"', '2']]);
  assert.equal(coerce('42'), 42);
  assert.equal(coerce('007'), '007', 'leading zeros stay text');
  assert.equal(coerce('1234567890123456789'), '1234567890123456789', 'digits beyond double precision stay text');
  assert.equal(coerce('TRUE'), true);
});

test('sheets: every format writes and reads back values and formulas', async () => {
  const book = await readWorkbook('Item,Qty\nPens,3\nPads,4\nTotal,=SUM(B2:B3)\n', 'stock.csv');
  book.sheets[0].cells.get('3:1').v = 7; // what Ledger computes before saving
  for (const f of ['xlsx', 'xls', 'ods', 'csv', 'tsv']) {
    const back = await readWorkbook(await bytesOf(await writeWorkbook(book, f)), `stock.${f}`);
    const cells = back.sheets[0].cells;
    assert.equal(cells.get('0:0').v, 'Item', `${f}: text`);
    assert.equal(cells.get('2:1').v, 4, `${f}: numbers`);
    assert.equal(cells.get('3:1').v, 7, `${f}: formula result`);
    if (f === 'xlsx' || f === 'ods') assert.equal(cells.get('3:1').f, 'SUM(B2:B3)', `${f}: formula`);
  }
});

test('formula: arithmetic, ranges, functions, errors and sheets', () => {
  const grid = { A1: 1, A2: 2, A3: 3, B1: 'x', B2: 'y', B3: 'x' };
  const ctx = { cell: (sheet, r, c) => (sheet === 'Other' ? 99 : grid[String.fromCharCode(65 + c) + (r + 1)]) };
  const ev = (f) => { const v = evaluate(f, ctx); return v?.code ?? v; };
  assert.equal(ev('=1+2*3'), 7);
  assert.equal(ev('=2^3^2'), 64, 'exponent is left-associative, as in spreadsheets');
  assert.equal(ev('=-2^2'), 4);
  assert.equal(ev('=SUM(A1:A3)'), 6);
  assert.equal(ev('=AVERAGE(A1:A3)'), 2);
  assert.equal(ev('=IF(A1>0,"pos","neg")'), 'pos');
  assert.equal(ev('=A1/0'), '#DIV/0!');
  assert.equal(ev('=IFERROR(A1/0,"none")'), 'none');
  assert.equal(ev('=COUNTIF(B1:B3,"x")'), 2);
  assert.equal(ev('=SUMIF(B1:B3,"x",A1:A3)'), 4);
  assert.equal(ev('="n="&A3'), 'n=3');
  assert.equal(ev("=Other!A1+1"), 100);
  assert.equal(ev('=VLOOKUP("y",B1:B3,1,FALSE)'), 'y');
  assert.equal(ev('=ROUND(2.345,2)'), 2.35);
  assert.equal(ev('=NOPE(1)'), '#NAME?');
  assert.equal(ev('=1+'), '#VALUE!');
});

test('formula: references follow inserted and deleted rows and columns', () => {
  const opts = { sheetName: 'Sheet1', own: true };
  assert.equal(shiftFormula('SUM(A1:A10)+B5', { ...opts, axis: 'row', at: 4, delta: 1 }), 'SUM(A1:A11)+B6');
  assert.equal(shiftFormula('SUM(A1:A10)+B5', { ...opts, axis: 'row', at: 4, delta: -1 }), 'SUM(A1:A9)+#REF!');
  assert.equal(shiftFormula('C3&"B5"', { ...opts, axis: 'col', at: 1, delta: 1 }), 'D3&"B5"', 'text in quotes is left alone');
  assert.equal(shiftFormula('Other!B5+B5', { ...opts, own: false, axis: 'row', at: 0, delta: 1 }), 'Other!B5+B5', 'other sheets are left alone');
});

/* ---------- legacy binaries, built by hand ---------- */

async function cfbFile(streams) {
  const XLSX = await import('@e965/xlsx');
  const CFB = XLSX.CFB ?? XLSX.default.CFB;
  const cfb = CFB.utils.cfb_new();
  for (const [name, bytes] of Object.entries(streams)) CFB.utils.cfb_add(cfb, name, bytes);
  return new Uint8Array(CFB.write(cfb, { type: 'array' }));
}

test('legacy .doc: text comes out of the piece table', async () => {
  const body = 'Dear reader,\rThis is a Word 97 file.\r';
  const TEXT_AT = 0x800;
  const word = new Uint8Array(TEXT_AT + body.length);
  const dv = new DataView(word.buffer);
  dv.setUint16(0, 0xA5EC, true);
  dv.setUint32(0x4C, body.length, true); // ccpText
  dv.setUint32(0x1A2, 0, true); // fcClx
  const table = new Uint8Array(1 + 4 + 8 + 8);
  const tv = new DataView(table.buffer);
  table[0] = 0x02;
  tv.setUint32(1, 16, true); // lcb of PlcPcd: 2 CPs + 1 PCD
  tv.setUint32(5, 0, true);
  tv.setUint32(9, body.length, true);
  tv.setUint32(13 + 2, (TEXT_AT * 2) | 0x40000000, true); // compressed (8-bit) text at TEXT_AT
  dv.setUint32(0x1A6, table.length, true); // lcbClx
  for (let i = 0; i < body.length; i++) word[TEXT_AT + i] = body.charCodeAt(i);
  const text = await docToText(await cfbFile({ WordDocument: word, '0Table': table }));
  assert.equal(text, 'Dear reader,\nThis is a Word 97 file.');
});

test('legacy .ppt: slides come out of the text atoms', async () => {
  const rec = (verInst, type, body) => {
    const out = new Uint8Array(8 + body.length);
    const v = new DataView(out.buffer);
    v.setUint16(0, verInst, true); v.setUint16(2, type, true); v.setUint32(4, body.length, true);
    out.set(body, 8);
    return out;
  };
  const cat = (...parts) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };
  const u32 = (n) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; };
  const bytes = (s) => new TextEncoder().encode(s);
  const utf16 = (s) => { const b = new Uint8Array(s.length * 2); for (let i = 0; i < s.length; i++) new DataView(b.buffer).setUint16(i * 2, s.charCodeAt(i), true); return b; };
  const slides = cat(
    rec(0, 0x03F3, new Uint8Array(20)), rec(0, 0x0F9F, u32(0)), rec(0, 0x0FA8, bytes('Opening')), rec(0, 0x0F9F, u32(1)), rec(0, 0x0FA0, utf16('Why now\rWhat next')),
    rec(0, 0x03F3, new Uint8Array(20)), rec(0, 0x0F9F, u32(0)), rec(0, 0x0FA8, bytes('Close')),
  );
  const stream = rec(0x000F, 0x0FF0, slides);
  const deck = await pptToDeck(await cfbFile({ 'PowerPoint Document': stream }));
  assert.equal(deck.slides.length, 2);
  assert.equal(deck.slides[0].elements[0].paragraphs[0].runs[0].text, 'Opening');
  assert.deepEqual(deck.slides[0].elements[1].paragraphs.map(p => p.runs[0].text), ['Why now', 'What next']);
  assert.equal(deck.slides[1].elements[0].paragraphs[0].runs[0].text, 'Close');
});

async function sampleEpub() {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip');
  zip.file('META-INF/container.xml', '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  zip.file('OEBPS/book.opf', '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Tiny Book</dc:title><dc:creator>A. Writer</dc:creator></metadata><manifest><item id="c1" href="text/one.xhtml" media-type="application/xhtml+xml"/><item id="img" href="images/dot.png" media-type="image/png"/></manifest><spine><itemref idref="c1"/></spine></package>');
  zip.file('OEBPS/text/one.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml"><head><script>alert(1)</script></head><body><h1 onclick="x()">Chapter one</h1><p>It begins.</p><img src="../images/dot.png"/><script>steal()</script></body></html>');
  zip.file('OEBPS/images/dot.png', Uint8Array.from(atob(PNG.split(',')[1]), c => c.charCodeAt(0)));
  return new Uint8Array(await zip.generateAsync({ type: 'uint8array' }));
}

test('epub: title, chapters in spine order, pictures inlined, scripts removed', async () => {
  const book = await readEpub(await sampleEpub());
  assert.equal(book.title, 'Tiny Book');
  assert.equal(book.creator, 'A. Writer');
  assert.equal(book.chapters.length, 1);
  const html = book.chapters[0].html;
  assert.match(html, /Chapter one/);
  assert.match(html, /src="data:image\/png;base64,/);
  assert.ok(!/script|onclick/i.test(html), 'scripts and handlers are stripped');
});

test('previews: every rich format renders a locked-down page', async () => {
  const files = {
    'report.docx': await bytesOf(await modelToDocx(SAMPLE)),
    'report.odt': await bytesOf(await modelToOdt(SAMPLE)),
    'report.rtf': new TextEncoder().encode(modelToRtf(SAMPLE)),
    'deck.pptx': await bytesOf(await deckToPptx(DECK)),
    'deck.odp': await bytesOf(await deckToOdp(DECK)),
    'book.epub': await sampleEpub(),
  };
  const book = await readWorkbook('Item,Qty\nPens,3\n', 'stock.csv');
  for (const f of ['xlsx', 'xls', 'ods']) files[`stock.${f}`] = await bytesOf(await writeWorkbook(book, f));

  for (const [name, data] of Object.entries(files)) {
    const html = await renderPreview(data, name);
    assert.match(html, /Content-Security-Policy" content="default-src 'none'/, `${name}: network is blocked`);
    assert.ok(!/<script/i.test(html), `${name}: no scripts`);
    const expect = name.startsWith('report') ? 'Quarterly report' : name.startsWith('deck') ? 'Hello deck' : name.startsWith('stock') ? 'Pens' : 'Chapter one';
    assert.ok(html.includes(expect), `${name}: shows its content`);
  }
});
