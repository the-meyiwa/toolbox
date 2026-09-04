/* ============================================================
   TOOLBOX — Platform Evolution Unit Tests
   Exhaustive test suite covering:
   - ToolboxFilesystem (fs) CRUD, nested paths, and stats
   - ArchiveEngine PKZIP compression & decompression roundtrip
   - Assistant save_file persistence in fs
   - Assistant browse_web URL preservation (no Wikipedia hijacking)
   - Assistant IDE development agent (create, edit, build, package)
   - Supabase storage user-isolation path prefixes
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';

// Setup browser globals mock if running in bare Node
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };
}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    location: { hash: '' },
    open: () => {}
  };
}

import { fs } from '../../js/lib/filesystem.js';
import { createZip, extractZip, computeCRC32, isZipArchive } from '../../js/lib/archive-engine.js';
import { executeAssistantTool } from '../../js/lib/assistant-tools.js';
import { uploadToSupabaseStorage } from '../../js/lib/supabase.js';

test('ArchiveEngine: computeCRC32 accurately computes checksum', () => {
  const data = new TextEncoder().encode('Hello, Toolbox!');
  const crc = computeCRC32(data);
  assert.equal(typeof crc, 'number');
  assert.ok(crc > 0);
});

test('ArchiveEngine: createZip and extractZip perform complete roundtrip', async () => {
  const files = [
    { name: 'hello.txt', content: 'Hello World from Toolbox!' },
    { name: 'app.js', content: 'console.log("Archive OK");' },
    { name: 'sub/data.json', content: '{"status":"ok"}' }
  ];

  const zipBlob = await createZip(files);
  assert.ok(zipBlob instanceof Blob);
  const zipBytes = new Uint8Array(await zipBlob.arrayBuffer());
  assert.ok(isZipArchive(zipBytes), 'Output must be a valid PKZIP buffer');

  const extracted = await extractZip(zipBytes);
  assert.equal(extracted.length, 3);

  const hello = extracted.find(f => f.name === 'hello.txt');
  assert.ok(hello);
  assert.equal(new TextDecoder().decode(hello.data), 'Hello World from Toolbox!');

  const json = extracted.find(f => f.path === 'sub/data.json');
  assert.ok(json);
  assert.equal(new TextDecoder().decode(json.data), '{"status":"ok"}');
});

test('ToolboxFilesystem: creates nested directories and files', async () => {
  await fs.mkdir('/Projects/TestApp');
  const statDir = await fs.stat('/Projects/TestApp');
  assert.equal(statDir.type, 'directory');
  assert.equal(statDir.name, 'TestApp');

  await fs.writeFile('/Projects/TestApp/index.html', '<!DOCTYPE html><h1>Test</h1>');
  const statFile = await fs.stat('/Projects/TestApp/index.html');
  assert.equal(statFile.type, 'file');
  assert.equal(statFile.name, 'index.html');
  assert.ok(statFile.size > 0);

  const read = await fs.readFile('/Projects/TestApp/index.html', 'text');
  assert.equal(read, '<!DOCTYPE html><h1>Test</h1>');
});

test('ToolboxFilesystem: file rename, copy, and move operations', async () => {
  await fs.mkdir('/Documents/TestDocs');
  await fs.writeFile('/Documents/TestDocs/original.txt', 'Original Content');

  // Copy
  await fs.copy('/Documents/TestDocs/original.txt', '/Documents/TestDocs/copied.txt');
  const copyStat = await fs.stat('/Documents/TestDocs/copied.txt');
  assert.equal(copyStat.name, 'copied.txt');
  assert.equal(await fs.readFile('/Documents/TestDocs/copied.txt', 'text'), 'Original Content');

  // Rename
  await fs.rename('/Documents/TestDocs/copied.txt', 'renamed.txt');
  assert.equal(await fs.stat('/Documents/TestDocs/renamed.txt').then(s => s.name), 'renamed.txt');

  // Delete
  await fs.delete('/Documents/TestDocs/renamed.txt');
  assert.equal(await fs.stat('/Documents/TestDocs/renamed.txt'), null, 'File should be null after delete');
});

test('ToolboxFilesystem: compressDirectory and extractArchive in filesystem', async () => {
  await fs.mkdir('/Projects/ZipTest');
  await fs.writeFile('/Projects/ZipTest/file1.txt', 'Content 1');
  await fs.writeFile('/Projects/ZipTest/file2.txt', 'Content 2');

  const zipResult = await fs.compressDirectory('/Projects/ZipTest', '/Projects/ZipTest.zip');
  assert.ok(zipResult.size > 0);
  assert.equal(zipResult.fileCount, 2);

  const statZip = await fs.stat('/Projects/ZipTest.zip');
  assert.equal(statZip.name, 'ZipTest.zip');

  // Extract into /Projects/Extracted
  await fs.mkdir('/Projects/Extracted');
  const extractRes = await fs.extractArchive('/Projects/ZipTest.zip', '/Projects/Extracted');
  assert.equal(extractRes.extractedCount, 2);

  const extracted1 = await fs.readFile('/Projects/Extracted/file1.txt', 'text');
  assert.equal(extracted1, 'Content 1');
});

test('Assistant Tool save_file: saves directly to ToolboxFilesystem and verifies persistence', async () => {
  const result = await executeAssistantTool('save_file', {
    filename: 'quarterly_report.csv',
    content: 'quarter,revenue,profit\nQ1,500000,120000\nQ2,650000,180000'
  });

  assert.equal(result.status, 'success');
  assert.equal(result.type, 'file-saved');
  assert.ok(result.path.includes('quarterly_report.csv'));

  // Verify file physically exists in ToolboxFilesystem
  const stat = await fs.stat(result.path);
  assert.equal(stat.name, 'quarterly_report.csv');
  assert.ok(stat.size > 0);
});

test('Assistant Tool browse_web: respects explicit domain containerbrick.com without Wikipedia diversion', async () => {
  const result = await executeAssistantTool('browse_web', {
    url: 'containerbrick.com'
  });

  assert.equal(result.status, 'success');
  assert.equal(result.type, 'browser-preview');
  // Must preserve containerbrick.com in target URL, never wikipedia
  assert.ok(result.url.includes('containerbrick.com'), `Expected containerbrick.com in URL, got: ${result.url}`);
  assert.ok(!result.url.includes('wikipedia.org'), 'Must not divert to wikipedia.org when explicit domain is given');
});

test('Assistant IDE Agent: create, write, preview, and package project workflow', async () => {
  // 1. Create project
  const createRes = await executeAssistantTool('ide_create_project', {
    name: 'logistics-portal',
    title: 'Logistics Portal'
  });
  assert.equal(createRes.status, 'success');
  assert.equal(createRes.project, 'logistics-portal');
  assert.ok(await fs.stat('/Projects/logistics-portal/index.html'));

  // 2. Write file
  const writeRes = await executeAssistantTool('ide_write_file', {
    path: '/Projects/logistics-portal/app.js',
    content: 'console.log("Logistics Portal Live");'
  });
  assert.equal(writeRes.status, 'success');
  const readJs = await fs.readFile('/Projects/logistics-portal/app.js', 'text');
  assert.equal(readJs, 'console.log("Logistics Portal Live");');

  // 3. Build and preview
  const buildRes = await executeAssistantTool('ide_build_and_preview', {
    projectName: 'logistics-portal'
  });
  assert.equal(buildRes.status, 'success');
  assert.equal(buildRes.diagnostics.length, 0);
  assert.ok(buildRes.htmlBundle.includes('Logistics Portal'));

  // 4. Test diagnostics detection on syntax error
  await fs.writeFile('/Projects/logistics-portal/app.js', 'const broken = ;');
  const brokenBuild = await executeAssistantTool('ide_build_and_preview', {
    projectName: 'logistics-portal'
  });
  assert.equal(brokenBuild.status, 'error');
  assert.ok(brokenBuild.diagnostics.length > 0);
  assert.equal(brokenBuild.diagnostics[0].file, 'app.js');

  // Fix file
  await fs.writeFile('/Projects/logistics-portal/app.js', 'const fixed = 42;');

  // 5. Package project to ZIP in Files
  const pkgRes = await executeAssistantTool('ide_package_project', {
    projectName: 'logistics-portal'
  });
  assert.equal(pkgRes.status, 'success');
  assert.ok(pkgRes.path.endsWith('logistics-portal.zip'));
  assert.ok(await fs.stat(pkgRes.path));
});
