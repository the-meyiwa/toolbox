import fs from 'node:fs';
import path from 'node:path';
import { RULES, EXCLUDE_NON_ORGAN, classify } from '../../scripts/anatomy-select.mjs';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');
const MANIFEST_PATH = path.join(PROJECT_ROOT, 'scripts', 'data', 'bodyparts3d-available.json');
const rawParts = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

console.log('--- 7 EXCLUDED ITEMS DETAILS ---');
const MAX_BYTES = 40 * 1024 * 1024;
const excluded = [];

for (const p of rawParts) {
  const size = p.bytes || p.size || 0;
  const sizeExcluded = size > MAX_BYTES;
  const patternExcluded = EXCLUDE_NON_ORGAN.test(p.name);
  if (sizeExcluded || patternExcluded) {
    excluded.push({
      id: p.id,
      name: p.name,
      sizeBytes: size,
      sizeMB: (size / (1024 * 1024)).toFixed(2),
      sizeExcluded,
      patternExcluded,
      patternMatch: p.name.match(EXCLUDE_NON_ORGAN)?.[0] || null,
      wouldClassifyIfIncluded: classify(p.name)
    });
  }
}

console.log(`Total excluded: ${excluded.length}`);
console.table(excluded);

console.log('\n--- MULTI-REGEX MATCH DETAILS ---');
const multiMatch = [];
for (const p of rawParts) {
  const size = p.bytes || p.size || 0;
  if (size > MAX_BYTES || EXCLUDE_NON_ORGAN.test(p.name)) continue;
  
  const matches = [];
  for (const [sys, re] of RULES) {
    if (re.test(p.name)) matches.push(sys);
  }
  if (matches.length > 1) {
    multiMatch.push({
      id: p.id,
      name: p.name,
      assigned: classify(p.name),
      matched: matches.join(', ')
    });
  }
}
console.log(`Total structures matching multiple regexes: ${multiMatch.length}`);
console.table(multiMatch);
