/* ============================================================
   Stylesheet loader for tests
   css/style.css is only an entry file that @imports the real
   stylesheets. This returns the entry with every local @import
   inlined, so tests can assert on the CSS the browser receives.
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const IMPORT_RE = /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*;/g;

function inline(file, seen) {
  if (seen.has(file)) return '';
  seen.add(file);
  const css = fs.readFileSync(file, 'utf8');
  return css.replace(IMPORT_RE, (match, href) => {
    if (/^[a-z]+:|^\/\//i.test(href)) return match;
    return inline(path.resolve(path.dirname(file), href), seen);
  });
}

export function readStylesheet(entry = 'css/style.css') {
  return inline(path.resolve(projectRoot, entry), new Set());
}
