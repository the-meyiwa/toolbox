/* ============================================================
   Smart paste: work out what a pasted blob is and which tools can
   take it. The idea is DevToys' Smart Detection. Paste a JWT, some
   JSON or a certificate into the palette (or anywhere on the home
   page) and the first rows open the right tool with it already
   loaded.

   Detectors are ordered specific-first, so a JWT is never offered
   as Base64. Every target tool implements setArtifact; a tool that
   cannot take handed-over text is never suggested.
   ============================================================ */

import { detectFormat, sniffDelimiter } from './transforms/data-formats.js';
import { looksLikeMorse, findHiddenChars } from './transforms/text-ops.js';

const b64ok = (s) => /^[A-Za-z0-9+/_-]+={0,2}$/.test(s) && s.length % 4 !== 1;

/** @type {{id: string, label: string, kind: string, tools: string[], test: (t: string) => boolean}[]} */
export const DETECTORS = [
  { id: 'jwt', label: 'JSON Web Token', kind: 'text', tools: ['jwt-decoder'],
    test: (t) => /^eyJ[\w-]+\.eyJ[\w-]+\.[\w-]*$/.test(t) },
  { id: 'pem', label: 'Certificate', kind: 'text', tools: ['cert-decoder'],
    test: (t) => /-----BEGIN (CERTIFICATE|CERTIFICATE REQUEST|NEW CERTIFICATE REQUEST)-----/.test(t) },
  { id: 'bcrypt', label: 'Bcrypt hash', kind: 'text', tools: ['bcrypt-tool'],
    test: (t) => /^\$2[abxy]?\$\d{2}\$[./A-Za-z0-9]{53}$/.test(t) },
  { id: 'gzip', label: 'Gzip data (Base64)', kind: 'text', tools: ['gzip-codec'],
    test: (t) => /^H4sI[A-Za-z0-9+/=\s]{16,}$/.test(t) },
  { id: 'json', label: 'JSON', kind: 'json', tools: ['json-formatter', 'json-tools', 'data-converter', 'jsonpath-tester'],
    test: (t) => /^[[{]/.test(t) && detectFormat(t) === 'json' },
  { id: 'xml', label: 'XML', kind: 'text', tools: ['xml-tools', 'data-converter'],
    test: (t) => /^<(\?xml|[A-Za-z][\w:.-]*[\s>])/.test(t) && /<\/[\w:.-]+>\s*$|\/>\s*$/.test(t) && !/^<!doctype html|^<html/i.test(t) },
  { id: 'sql', label: 'SQL', kind: 'sql', tools: ['sql-formatter'],
    test: (t) => /^(select|insert\s+into|update\s+\w+\s+set|delete\s+from|create\s+(table|view|index|or)|alter\s+table|with\s+\w+\s+as\s*\()\b/i.test(t) },
  { id: 'cron', label: 'Cron schedule', kind: 'text', tools: ['cron-parser'],
    test: (t) => /^(@(yearly|annually|monthly|weekly|daily|hourly|reboot)|([\d*/,?LW#-]+|[A-Z]{3}(-[A-Z]{3})?)(\s+([\d*/,?LW#-]+|[A-Z]{3}(-[A-Z]{3})?)){4,5})$/i.test(t) && /[*\d]/.test(t) },
  { id: 'csv', label: 'CSV table', kind: 'csv', tools: ['csv-tools', 'data-converter', 'csv-to-json'],
    test: (t) => { const f = detectFormat(t); if (f !== 'csv' && f !== 'tsv') return false; const d = sniffDelimiter(t); const lines = t.split(/\r?\n/).filter(Boolean); return lines.length >= 2 && lines.slice(0, 5).every((l) => l.split(d).length === lines[0].split(d).length); } },
  { id: 'yaml', label: 'YAML', kind: 'yaml', tools: ['data-converter'],
    test: (t) => t.includes('\n') && detectFormat(t) === 'yaml' && /^[\w"'-][^\n]*:\s*\S?/m.test(t) },
  { id: 'morse', label: 'Morse code', kind: 'text', tools: ['morse-code'],
    test: (t) => looksLikeMorse(t) && t.replace(/\s/g, '').length >= 3 && /[.-]{2}/.test(t) },
  { id: 'urlenc', label: 'URL-encoded text', kind: 'text', tools: ['url-codec'],
    test: (t) => /%[0-9A-Fa-f]{2}/.test(t) && !/\s/.test(t) && (t.match(/%[0-9A-Fa-f]{2}/g) || []).length >= 2 },
  { id: 'entities', label: 'HTML entities', kind: 'text', tools: ['html-entity-codec'],
    test: (t) => (t.match(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi) || []).length >= 2 && !/<[a-z]/i.test(t) },
  { id: 'base64', label: 'Base64', kind: 'text', tools: ['base64-codec'],
    test: (t) => t.length >= 16 && !/\s/.test(t) && b64ok(t) && /[A-Z]/.test(t) && /[a-z]/.test(t) && /\d|[+/=]/.test(t) },
  { id: 'hidden', label: 'Text with hidden characters', kind: 'text', tools: ['hidden-characters'],
    test: (t) => findHiddenChars(t).some((h) => h.kind !== 'lookalike' || /[a-z]/i.test(t)) },
  { id: 'markdown', label: 'Markdown', kind: 'markdown', tools: ['markdown-preview'],
    test: (t) => t.includes('\n') && (/^#{1,6}\s\S/m.test(t) || /^\s*[-*]\s\S[\s\S]*^\s*[-*]\s\S/m.test(t)) && /(\*\*|__|\[.+\]\(.+\)|^#{1,6}\s|^```)/m.test(t) },
  { id: 'contacts', label: 'Text with emails or links', kind: 'text', tools: ['text-extractor'],
    test: (t) => t.length > 60 && (/[\w.+-]+@[\w-]+\.[\w.]{2,}/.test(t) || (t.match(/https?:\/\//g) || []).length >= 2) },
];

/**
 * @param {string} raw
 * @returns {{id: string, label: string, kind: string, tools: string[]}[]} best first
 */
export function detect(raw) {
  const t = String(raw ?? '').trim();
  if (t.length < 3 || t.length > 2_000_000) return [];
  const hits = [];
  for (const d of DETECTORS) {
    let ok = false;
    try { ok = d.test(t); } catch { ok = false; }
    if (ok) hits.push({ id: d.id, label: d.label, kind: d.kind, tools: d.tools });
  }
  return hits;
}

/** Worth offering at all: structured, or long enough not to be a search. */
export const looksLikeData = (t) => { const s = String(t ?? '').trim(); return s.includes('\n') || s.length > 40 || detect(s).length > 0; };
