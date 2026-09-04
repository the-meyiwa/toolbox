/* ============================================================
   TOOLBOX PLATFORM CORRECTION REGRESSION TEST SUITE
   Authoritative tests for:
   1. Real Filesystem Operations & Persistence
   2. Assistant Real Filesystem Tools Execution
   3. 50+ Deterministic Mathematical Sequences with BigInt Precision
   4. Real Website Research & Browser Scraping without Diversion
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { fs, ToolboxFilesystem } from '../../js/lib/filesystem.js';
import {
  calculateMath,
  generateFibonacci,
  calculateCollatz,
  calculateSequenceTerm,
  generateSequenceRange,
  analyzeCollatz,
  compareSequences,
  listAllSequences,
  getSequence
} from '../../js/lib/math-engine.js';
import { executeAssistantTool, ASSISTANT_TOOL_DECLARATIONS } from '../../js/lib/assistant-tools.js';
import { parseWebPage } from '../../js/lib/web-scraper-engine.js';

// ============================================================
// 1. REAL FILESYSTEM & DIRECTORY NAVIGATION
// ============================================================

test('Filesystem: creates nested directories and persists to synchronous index immediately', async () => {
  const testFs = new ToolboxFilesystem();
  await testFs.init();

  // Create deep nested path: /Projects/MyApp/src
  const dirRes = await testFs.mkdir('/Projects/MyApp/src', { recursive: true });
  assert.ok(dirRes, 'Directory creation should return true');

  // Verify statSync and listSync immediately without delay
  const stat = testFs.statSync('/Projects/MyApp/src');
  assert.ok(stat, 'statSync should find the created directory');
  assert.equal(stat.isDirectory, true);
  assert.equal(stat.path, '/Projects/MyApp/src');

  // Verify intermediate directories were automatically created
  const myAppStat = testFs.statSync('/Projects/MyApp');
  assert.ok(myAppStat, 'Intermediate directory /Projects/MyApp should exist');
  assert.equal(myAppStat.isDirectory, true);

  // Verify listSync inside /Projects shows MyApp
  const projectsList = testFs.listSync('/Projects');
  assert.ok(projectsList.some(item => item.name === 'MyApp' && item.isDirectory));

  // Verify listSync inside /Projects/MyApp shows src
  const myAppList = testFs.listSync('/Projects/MyApp');
  assert.ok(myAppList.some(item => item.name === 'src' && item.isDirectory));

  // Verify empty directory returns empty list, not an error
  const srcList = testFs.listSync('/Projects/MyApp/src');
  assert.equal(srcList.length, 0);
});

test('Filesystem: rejects invalid characters in file/folder names', async () => {
  const testFs = new ToolboxFilesystem();
  await testFs.init();

  const invalidNames = ['my:folder', 'project*', 'file?name', 'doc|draft', 'test<tag>', 'test>tag'];
  for (const name of invalidNames) {
    await assert.rejects(
      async () => testFs.mkdir(`/Projects/${name}`),
      /invalid folder name|reserved or illegal character/i,
      `Should reject folder name with illegal character: ${name}`
    );
  }
});

test('Filesystem: writes file, verifies immediate statSync, and reads content', async () => {
  const testFs = new ToolboxFilesystem();
  await testFs.init();

  const content = 'export const greeting = "Hello, Toolbox!";';
  const filePath = '/Projects/MyApp/src/index.js';

  await testFs.writeFile(filePath, content);

  // Synchronous stat check
  const stat = testFs.statSync(filePath);
  assert.ok(stat, 'statSync must find the written file immediately');
  assert.equal(stat.isDirectory, false);
  assert.equal(stat.name, 'index.js');
  assert.equal(stat.size, content.length);

  // Read content back
  const readContent = await testFs.readFile(filePath);
  assert.equal(readContent, content);

  // List directory contains file
  const list = testFs.listSync('/Projects/MyApp/src');
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'index.js');
});

test('Filesystem: file move, rename, and delete lifecycle', async () => {
  const testFs = new ToolboxFilesystem();
  await testFs.init();

  const originalPath = '/Documents/report.md';
  await testFs.writeFile(originalPath, '# Quarterly Report');

  // Rename
  const renamedPath = '/Documents/q1_report.md';
  await testFs.rename(originalPath, renamedPath);
  assert.equal(testFs.statSync(originalPath), null);
  assert.ok(testFs.statSync(renamedPath));

  // Move
  await testFs.mkdir('/Documents/Archive', { recursive: true });
  const movedPath = '/Documents/Archive/q1_report.md';
  await testFs.move(renamedPath, movedPath);
  assert.equal(testFs.statSync(renamedPath), null);
  assert.ok(testFs.statSync(movedPath));

  // Delete
  await testFs.delete(movedPath);
  assert.equal(testFs.statSync(movedPath), null);
});

// ============================================================
// 2. ASSISTANT REAL FILESYSTEM TOOLS EXECUTION
// ============================================================

test('Assistant Tool: create_folder creates real directory and verifies stat', async () => {
  const res = await executeAssistantTool('create_folder', { path: '/Projects/WebEngine' });
  assert.equal(res.status, 'success');
  assert.equal(res.success, true);
  assert.equal(res.verified, true);

  // Verify against authoritative fs
  const stat = await fs.stat('/Projects/WebEngine');
  assert.ok(stat, 'Directory must exist in authoritative filesystem');
  assert.equal(stat.isDirectory, true);
});

test('Assistant Tool: create_file and save_file verify persistence before declaring success', async () => {
  const fileRes = await executeAssistantTool('create_file', {
    path: '/Projects/WebEngine/config.json',
    content: JSON.stringify({ port: 8080, env: 'production' })
  });

  assert.equal(fileRes.status, 'success');
  assert.equal(fileRes.success, true);
  assert.equal(fileRes.verified, true);

  // Verify file content in fs
  const content = await fs.readFile('/Projects/WebEngine/config.json');
  assert.ok(content.includes('8080'));

  // Test save_file with folder parameter
  const saveRes = await executeAssistantTool('save_file', {
    filename: 'readme.txt',
    folder: '/Projects/WebEngine',
    content: 'WebEngine v1.0 documentation'
  });
  assert.equal(saveRes.status, 'success');
  assert.equal(saveRes.success, true);
  assert.equal(saveRes.verified, true);

  const stat = await fs.stat('/Projects/WebEngine/readme.txt');
  assert.ok(stat, 'Saved file must have verified stat in filesystem');
});

test('Assistant Tool: read_file and delete_file safety guardrail', async () => {
  // Read
  const readRes = await executeAssistantTool('read_file', { path: '/Projects/WebEngine/config.json' });
  assert.equal(readRes.status, 'success');
  assert.ok(readRes.content.includes('production'));

  // Read non-existent file returns truthful failure
  const missingRes = await executeAssistantTool('read_file', { path: '/NonExistent/ghost.txt' });
  assert.equal(missingRes.status, 'error');
  assert.equal(missingRes.success, false);

  // Assistant file safety: strictly prohibits assistant-initiated file deletion
  await assert.rejects(
    async () => executeAssistantTool('delete_file', { path: '/Projects/WebEngine/readme.txt' }),
    /strictly prohibited from deleting files/i,
    'Assistant file safety guardrail must prevent delete operations'
  );

  // Authoritative filesystem delete works directly via fs.delete
  const delRes = await fs.delete('/Projects/WebEngine/readme.txt');
  assert.equal(delRes, true);

  const statAfter = await fs.stat('/Projects/WebEngine/readme.txt');
  assert.equal(statAfter, null);
});

// ============================================================
// 3. 50+ DETERMINISTIC MATHEMATICAL SEQUENCES & ARBITRARY PRECISION
// ============================================================

test('Math Sequences: sequence registry has 50+ registered sequences across domains', () => {
  const seqs = listAllSequences();
  assert.ok(seqs.length >= 50, `Expected at least 50 sequences, got ${seqs.length}`);

  const requiredSequences = [
    'fibonacci', 'lucas', 'pell', 'pell_lucas', 'jacobsthal', 'tribonacci',
    'tetranacci', 'padovan', 'perrin', 'catalan', 'bell', 'motzkin',
    'delannoy', 'narayana', 'derangements', 'partitions', 'triangular',
    'squares', 'cubes', 'tetrahedral', 'pentagonal', 'hexagonal', 'heptagonal',
    'octagonal', 'pronic', 'primes', 'composites', 'perfect_numbers',
    'mersenne', 'fermat', 'factorials', 'powers_of_2', 'powers_of_3',
    'harmonic_numbers', 'collatz_stopping', 'look_and_say', 'recaman',
    'thue_morse', 'golomb', 'rudin_shapiro', 'happy_numbers', 'cullen',
    'woodall', 'sylvester', 'lucas_lehmer', 'carmichael', 'proth'
  ];

  for (const id of requiredSequences) {
    const s = getSequence(id);
    assert.ok(s, `Sequence "${id}" must be registered in the engine`);
    assert.ok(s.name, `Sequence "${id}" must have a readable name`);
    assert.ok(s.definition, `Sequence "${id}" must have a mathematical definition`);
    assert.ok(typeof s.getTerm === 'function', `Sequence "${id}" must implement getTerm`);
    assert.ok(typeof s.generate === 'function', `Sequence "${id}" must implement generate`);
  }
});

test('Math Sequences: Fibonacci(100) calculates exact BigInt without precision loss', () => {
  const res = calculateSequenceTerm('fibonacci', 100);
  assert.equal(res.operation, 'sequence_term');
  assert.equal(res.termIndex, 100);
  // F(100) exact value: 354224848179261915075
  assert.equal(res.termValue, '354224848179261915075');
  assert.equal(res.formatted, '354224848179261915075');

  // Through calculateMath unified dispatcher
  const mathRes = calculateMath({ operation: 'fibonacci', n: 100, subOp: 'term' });
  assert.equal(mathRes.termValue, '354224848179261915075');
});

test('Math Sequences: Lucas, Pell, Catalan, Bell, and Padovan initial terms', () => {
  // Lucas: 2, 1, 3, 4, 7, 11, 18, 29, 47, 76, 123...
  const lucas10 = calculateSequenceTerm('lucas', 10);
  assert.equal(lucas10.termValue, '123');

  // Pell: 0, 1, 2, 5, 12, 29, 70, 169, 408, 985, 2378...
  const pell10 = calculateSequenceTerm('pell', 10);
  assert.equal(pell10.termValue, '2378');

  // Catalan: 1, 1, 2, 5, 14, 42, 132, 429, 1430, 4862, 16796...
  const catalan10 = calculateSequenceTerm('catalan', 10);
  assert.equal(catalan10.termValue, '16796');

  // Bell numbers: B(0)=1, B(1)=1, B(2)=2, B(3)=5, B(4)=15, B(5)=52, B(6)=203, B(7)=877...
  const bell7 = calculateSequenceTerm('bell', 7);
  assert.equal(bell7.termValue, '877');

  // Padovan: 1, 1, 1, 2, 2, 3, 4, 5, 7, 9, 12...
  const padovan10 = calculateSequenceTerm('padovan', 10);
  assert.equal(padovan10.termValue, '12');
});

test('Math Sequences: Figurate numbers (Triangular, Pentagonal, Tetrahedral)', () => {
  // Triangular T(10) = 10*11/2 = 55
  const tri10 = calculateSequenceTerm('triangular', 10);
  assert.equal(tri10.termValue, '55');

  // Pentagonal P(5) = (3*25 - 5)/2 = 35
  const pent5 = calculateSequenceTerm('pentagonal', 5);
  assert.equal(pent5.termValue, '35');

  // Tetrahedral Te(5) = 5*6*7/6 = 35
  const tet5 = calculateSequenceTerm('tetrahedral', 5);
  assert.equal(tet5.termValue, '35');
});

test('Math Sequences: Range generation produces structured chart data and terms', () => {
  const rangeRes = generateSequenceRange('triangular', { from: 1, to: 10 });
  assert.equal(rangeRes.operation, 'sequence_range');
  assert.equal(rangeRes.count, 10);
  assert.equal(rangeRes.terms.length, 10);
  assert.equal(rangeRes.terms[0].value, '1');
  assert.equal(rangeRes.terms[9].value, '55');
  assert.equal(rangeRes.chartData.length, 10);
  assert.equal(rangeRes.chartData[9].y, 55);
});

test('Math Sequences: Sequence comparison (Fibonacci vs Lucas)', () => {
  const comp = compareSequences('fibonacci', 'lucas', 8);
  assert.equal(comp.operation, 'sequence_comparison');
  assert.equal(comp.comparison.length, 8);
  assert.ok(comp.comparison[0]['Fibonacci Sequence'] || comp.comparison[0]['Fibonacci Numbers'] || comp.comparison[0].fibonacci);
  assert.ok(comp.comparison[0]['Lucas Numbers'] || comp.comparison[0]['Lucas Sequence'] || comp.comparison[0].lucas);
});

test('Math Engine: Collatz sequence for 27 produces complete trajectory metrics and unproven status', () => {
  const collatz = calculateCollatz(27);
  assert.equal(collatz.operation, 'collatz');
  assert.equal(collatz.input, 27);
  assert.equal(collatz.steps, 111);
  assert.equal(collatz.stoppingTime, 111);
  assert.equal(collatz.maximum_value, 9232);
  assert.equal(collatz.peakValue, 9232);
  assert.equal(collatz.peakStep, 77);
  assert.equal(collatz.reached_one, true);
  assert.equal(collatz.conjectureStatus, 'CONJECTURE (UNPROVEN)');
  assert.equal(collatz.verified, true);
  assert.ok(collatz.message.includes('UNPROVEN open problem'));
});

// ============================================================
// 4. REAL WEBSITE RESEARCH & WEB SCRAPER ENGINE
// ============================================================

test('Web Scraper Engine: extracts headings, aboutExcerpt, contactInfo, and cleans text', () => {
  const sampleHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>Container Technologies & Conversions Ltd</title>
      <meta name="description" content="Premium shipping container fabrication, rental, and modular buildings.">
    </head>
    <body>
      <header>
        <nav><a href="/home">Home</a><a href="/about">About Us</a><a href="/contact">Contact</a></nav>
      </header>
      <main>
        <h1>Container Fabrication & Rentals</h1>
        <h2>Modular Site Offices</h2>
        <p>Container Technologies provides certified converted containers, site offices, and custom modular enclosures across Africa.</p>
        <h2>Cold Storage & Specialized Units</h2>
        <p>We supply refrigerated containers engineered for pharmaceutical and agro-logistics storage.</p>
        <section id="about">
          <h2>About Our Company</h2>
          <p>Founded in 2012, Container Technologies is Nigeria's premier container modification expert with ISO 9001 certified facilities in Lagos and Port Harcourt.</p>
        </section>
        <footer>
          <p>Email: inquiries@containertech.example.com | Phone: +234 1 234 5678</p>
          <a href="/privacy">Privacy Policy</a>
        </footer>
      </main>
    </body>
    </html>
  `;

  const parsed = parseWebPage(sampleHtml, 'https://containertech.example.com');
  assert.equal(parsed.title, 'Container Technologies & Conversions Ltd');
  assert.ok(parsed.headings.includes('Container Fabrication & Rentals'));
  assert.ok(parsed.headings.includes('Modular Site Offices'));
  assert.ok(parsed.headings.includes('About Our Company'));
  assert.ok(parsed.aboutExcerpt.includes('Container Technologies'));
  assert.equal(parsed.contactInfo.email, 'inquiries@containertech.example.com');
  assert.ok(parsed.contactInfo.phone.includes('234'));
  assert.ok(parsed.text.includes('refrigerated containers'));
  assert.ok(parsed.textSummary.length > 100);
});

test('Assistant Tool: browse_web handles explicit target without diversion', async () => {
  // Test with explicit containerbrick.com query
  const res = await executeAssistantTool('browse_web', {
    url: 'https://containerbrick.com',
    query: 'https://containerbrick.com container fabrication'
  });

  // Must either navigate or return clean error, NEVER divert to Wikipedia
  if (res.source) {
    assert.ok(res.source.includes('containerbrick.com'), `Must not divert URL: ${res.source}`);
  }
  if (res.headings) {
    assert.ok(Array.isArray(res.headings), 'Must provide headings array');
  }
});

test('Assistant Tool: browse_web returns honest error on invalid domain without fake placeholders', async () => {
  const res = await executeAssistantTool('browse_web', {
    url: 'https://this-domain-definitely-does-not-exist-12345.xyz'
  });

  assert.equal(res.status, 'error');
  assert.equal(res.success, false);
  assert.ok(res.message.toLowerCase().includes('could not reach') || res.message.toLowerCase().includes('not found') || res.message.toLowerCase().includes('error'));
  assert.equal(res.placeholder, undefined);
});
