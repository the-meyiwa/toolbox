#!/usr/bin/env node
/**
 * Packs the TypeScript standard-library declarations (and @types/node) into
 * JSON bundles the playground's type checker loads on demand. Comments are
 * stripped with TypeScript's own printer, which keeps every declaration but
 * roughly halves the download.
 *
 *   node scripts/vendor/build-typescript-libs.mjs <path to typescript package> [<path to @types/node>]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const tsDir = path.resolve(process.argv[2] || 'node_modules/typescript');
const nodeTypesDir = process.argv[3] ? path.resolve(process.argv[3]) : null;
const require = createRequire(import.meta.url);
const ts = require(path.join(tsDir, 'lib', 'typescript.js'));
const out = path.resolve('public/vendor/typescript');
fs.mkdirSync(out, { recursive: true });

const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
function strip(name, text) {
  const sf = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  // Keep /// <reference lib="..."/> directives; the printer drops them.
  const refs = text.match(/^\/\/\/\s*<reference[^>]*\/>\s*$/gm) || [];
  return `${refs.join('\n')}\n${printer.printFile(sf)}`;
}

const libDir = path.join(tsDir, 'lib');
const libs = {};
for (const f of fs.readdirSync(libDir)) {
  if (!/^lib\..*\.d\.ts$/.test(f)) continue;
  if (/webworker|scripthost/.test(f)) continue;
  libs[f] = strip(f, fs.readFileSync(path.join(libDir, f), 'utf8'));
}
fs.writeFileSync(path.join(out, 'lib.json'), JSON.stringify(libs));
console.log(`lib.json: ${Object.keys(libs).length} files, ${(fs.statSync(path.join(out, 'lib.json')).size / 1024).toFixed(0)} KB`);

if (nodeTypesDir) {
  const types = {};
  const walk = (dir, rel = '') => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { if (!/^(ts\d|compatibility)/.test(e.name) || e.name === 'compatibility') walk(path.join(dir, e.name), r); }
      else if (e.name.endsWith('.d.ts')) types[`/node_modules/@types/node/${r}`] = strip(r, fs.readFileSync(path.join(dir, e.name), 'utf8'));
    }
  };
  walk(nodeTypesDir);
  types['/node_modules/@types/node/package.json'] = JSON.stringify({ name: '@types/node', version: JSON.parse(fs.readFileSync(path.join(nodeTypesDir, 'package.json'), 'utf8')).version, types: 'index.d.ts' });
  fs.writeFileSync(path.join(out, 'node-types.json'), JSON.stringify(types));
  console.log(`node-types.json: ${Object.keys(types).length} files, ${(fs.statSync(path.join(out, 'node-types.json')).size / 1024).toFixed(0)} KB`);
}
