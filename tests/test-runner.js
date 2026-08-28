/* ============================================================
   Toolbox Master Test Runner
   Discovers and executes all unit, component, and integration tests
   with high-visibility tabular reporting and failure diagnostics.
   ============================================================ */

import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getTestFiles(dir) {
  let files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getTestFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

const testFiles = getTestFiles(__dirname);

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║                      TOOLBOX TEST SUITE                         ║');
console.log('║        Exhaustive Testing of UI, Functions, and Lifecycles       ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');
console.log(`Discovered ${testFiles.length} test suite files:\n`);
for (const file of testFiles) {
  console.log(` • ${path.relative(__dirname, file).replace(/\\/g, '/')}`);
}
console.log('\nRunning tests...\n');

let failed = false;

const testStream = run({
  files: testFiles,
  concurrency: false,
});

testStream.on('test:fail', () => {
  failed = true;
});

testStream
  .compose(new spec())
  .pipe(process.stdout);

testStream.on('error', (err) => {
  console.error('Test runner encountered an error:', err);
  process.exit(1);
});

testStream.on('end', () => {
  setTimeout(() => {
    process.exit(failed ? 1 : 0);
  }, 100);
});
