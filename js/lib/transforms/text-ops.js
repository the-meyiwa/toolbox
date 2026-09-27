/* ============================================================
   Text operations: ciphers, Morse, extraction, invisible-character
   detection, escaping. Pure functions; the Morse player lives in the
   tool because it needs audio.
   ============================================================ */

/* ---------------- ciphers and reshaping ---------------- */

export function rot(text, n = 13) {
  const k = ((n % 26) + 26) % 26;
  return text.replace(/[a-z]/gi, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + k) % 26) + base);
  });
}

export function rot47(text) {
  return text.replace(/[!-~]/g, (c) => String.fromCharCode(33 + ((c.charCodeAt(0) - 33 + 47) % 94)));
}

export function atbash(text) {
  return text.replace(/[a-z]/gi, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(base + 25 - (c.charCodeAt(0) - base));
  });
}

/** Reverse by grapheme, so emoji and accented letters survive. */
export function reverseText(text, unit = 'chars') {
  if (unit === 'words') return text.split(/(\s+)/).reverse().join('');
  if (unit === 'lines') return text.split(/\r?\n/).reverse().join('\n');
  const seg = globalThis.Intl?.Segmenter ? [...new Intl.Segmenter().segment(text)].map((s) => s.segment) : Array.from(text);
  return seg.reverse().join('');
}

export function randomCase(text, random = Math.random) { return text.replace(/\p{L}/gu, (c) => (random() < 0.5 ? c.toLowerCase() : c.toUpperCase())); }
export function alternateCase(text) { let i = 0; return text.replace(/\p{L}/gu, (c) => (i++ % 2 ? c.toUpperCase() : c.toLowerCase())); }

export function isPalindrome(text) {
  const t = text.toLowerCase().normalize('NFD').replace(/[^\p{L}\p{N}]/gu, '');
  return t.length > 0 && t === [...t].reverse().join('');
}

export function repeatText(text, times = 2, sep = '') { return Array.from({ length: Math.max(0, Math.min(10000, times)) }, () => text).join(sep.replace(/\\n/g, '\n')); }

export function truncateText(text, max = 100, { by = 'chars', ellipsis = '…' } = {}) {
  if (by === 'words') { const w = text.split(/\s+/); return w.length > max ? w.slice(0, max).join(' ') + ellipsis : text; }
  const g = Array.from(text);
  return g.length > max ? g.slice(0, max).join('') + ellipsis : text;
}

/** Mask listed words (whole words, any case). Keeps first letter when asked. */
export function censor(text, words, { mask = '*', keepFirst = false } = {}) {
  const list = words.split(/[\n,]+/).map((w) => w.trim()).filter(Boolean);
  if (!list.length) return text;
  const re = new RegExp(`\\b(${list.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'giu');
  return text.replace(re, (m) => (keepFirst ? m[0] + mask.repeat(m.length - 1) : mask.repeat(m.length)));
}

/* ---------------- Morse ---------------- */

export const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...',
  ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', _: '..--.-', '"': '.-..-.', $: '...-..-', '@': '.--.-.',
};
const FROM_MORSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

export function toMorse(text) {
  return text.toUpperCase().normalize('NFD').replace(/\p{M}/gu, '').split(/\s+/).filter(Boolean)
    .map((w) => [...w].map((c) => MORSE[c] ?? '').filter(Boolean).join(' ')).filter(Boolean).join(' / ');
}

export function fromMorse(code) {
  return code.trim().replace(/[—–]/g, '-').replace(/[·•]/g, '.').split(/\s*(?:\/|\|| {3,}|\n)\s*/)
    .map((w) => w.split(/\s+/).map((s) => (s ? FROM_MORSE[s] ?? '?' : '')).join('')).join(' ');
}

export const looksLikeMorse = (t) => /^[\s.\-/|·•—–]+$/.test(t.trim()) && /[.-]/.test(t);

/** On/off timings in dot units, for a player. 1 dot, 3 dash, 1 gap, 3 letter, 7 word. */
export function morseTimings(code) {
  const out = [];
  const words = code.trim().split(/\s*\/\s*/);
  words.forEach((w, wi) => {
    w.split(/\s+/).forEach((letter, li) => {
      [...letter].forEach((s, si) => { out.push([true, s === '-' ? 3 : 1]); if (si < letter.length - 1) out.push([false, 1]); });
      if (li < w.split(/\s+/).length - 1) out.push([false, 3]);
    });
    if (wi < words.length - 1) out.push([false, 7]);
  });
  return out;
}

/* ---------------- extraction ---------------- */

export const EXTRACTORS = {
  emails: /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu,
  urls: /\bhttps?:\/\/[^\s<>"'`)\]]+[^\s<>"'`)\].,;:!?]/gi,
  domains: /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi,
  phones: /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{1,4}\)[\s.-]?)?\d{2,4}(?:[\s.-]?\d{2,4}){2,3}\b/g,
  ipv4: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
  ipv6: /\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b/gi,
  numbers: /-?\b\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?\b|-?\b\d+(?:\.\d+)?\b/g,
  hashtags: /(?<![\w#])#[\p{L}\p{N}_]+/gu,
  mentions: /(?<![\w@])@[\w.]{2,}/g,
  dates: /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\b/g,
  hexColors: /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi,
  money: /(?:[$€£¥₦₹]\s?\d[\d,]*(?:\.\d+)?|\b\d[\d,]*(?:\.\d+)?\s?(?:USD|EUR|GBP|NGN|JPY|INR)\b)/g,
};

export function extract(text, kind, { unique = true, sort = false } = {}) {
  const re = EXTRACTORS[kind];
  if (!re) throw new Error(`Unknown extractor ${kind}`);
  let found = [...text.matchAll(new RegExp(re.source, re.flags))].map((m) => m[0].trim());
  if (kind === 'phones') found = found.filter((p) => p.replace(/\D/g, '').length >= 7);
  if (unique) found = [...new Set(found)];
  if (sort) found.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return found;
}

/* ---------------- invisible and look-alike characters ---------------- */

const INVISIBLE = {
  0x00a0: 'No-break space', 0x00ad: 'Soft hyphen', 0x034f: 'Combining grapheme joiner', 0x061c: 'Arabic letter mark',
  0x115f: 'Hangul choseong filler', 0x1160: 'Hangul jungseong filler', 0x17b4: 'Khmer vowel inherent AQ', 0x17b5: 'Khmer vowel inherent AA',
  0x180e: 'Mongolian vowel separator', 0x2000: 'En quad', 0x2001: 'Em quad', 0x2002: 'En space', 0x2003: 'Em space', 0x2004: 'Three-per-em space',
  0x2005: 'Four-per-em space', 0x2006: 'Six-per-em space', 0x2007: 'Figure space', 0x2008: 'Punctuation space', 0x2009: 'Thin space',
  0x200a: 'Hair space', 0x200b: 'Zero-width space', 0x200c: 'Zero-width non-joiner', 0x200d: 'Zero-width joiner', 0x200e: 'Left-to-right mark',
  0x200f: 'Right-to-left mark', 0x2028: 'Line separator', 0x2029: 'Paragraph separator', 0x202a: 'Left-to-right embedding',
  0x202b: 'Right-to-left embedding', 0x202c: 'Pop directional formatting', 0x202d: 'Left-to-right override', 0x202e: 'Right-to-left override',
  0x202f: 'Narrow no-break space', 0x205f: 'Medium mathematical space', 0x2060: 'Word joiner', 0x2061: 'Function application',
  0x2062: 'Invisible times', 0x2063: 'Invisible separator', 0x2064: 'Invisible plus', 0x2066: 'Left-to-right isolate',
  0x2067: 'Right-to-left isolate', 0x2068: 'First strong isolate', 0x2069: 'Pop directional isolate', 0x3000: 'Ideographic space',
  0x3164: 'Hangul filler', 0xfeff: 'Byte order mark / zero-width no-break space', 0xffa0: 'Halfwidth Hangul filler',
};
/* Letters that pass for Latin ones: the classic spoofing set. */
const CONFUSABLE = {
  0x0430: 'a', 0x0435: 'e', 0x043e: 'o', 0x0440: 'p', 0x0441: 'c', 0x0443: 'y', 0x0445: 'x', 0x0456: 'i', 0x0458: 'j', 0x04bb: 'h',
  0x0410: 'A', 0x0412: 'B', 0x0415: 'E', 0x041a: 'K', 0x041c: 'M', 0x041d: 'H', 0x041e: 'O', 0x0420: 'P', 0x0421: 'C', 0x0422: 'T', 0x0425: 'X',
  0x03bf: 'o', 0x03b1: 'a', 0x0391: 'A', 0x0392: 'B', 0x0395: 'E', 0x0396: 'Z', 0x0397: 'H', 0x0399: 'I', 0x039a: 'K', 0x039c: 'M', 0x039d: 'N',
  0x039f: 'O', 0x03a1: 'P', 0x03a4: 'T', 0x03a5: 'Y', 0x03a7: 'X', 0x0501: 'd', 0x051b: 'q', 0x051d: 'w', 0xff41: 'a',
};

/* Real spaces become a plain space; zero-width ones disappear. */
const isVisibleSpace = (name) => /space|quad/i.test(name) && !/zero-width/i.test(name);

export const codePointHex = (cp) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;

/** Every suspicious character with its position, name and a suggested fix. */
export function findHiddenChars(text) {
  const out = []; let line = 1; let col = 1; let index = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    let kind = null; let name = null; let replace = '';
    if (INVISIBLE[cp]) { kind = 'invisible'; name = INVISIBLE[cp]; replace = isVisibleSpace(name) ? ' ' : ''; }
    else if ((cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef)) { kind = 'invisible'; name = 'Variation selector'; }
    else if (cp >= 0xe0000 && cp <= 0xe007f) { kind = 'invisible'; name = 'Tag character (can hide text)'; }
    else if ((cp < 32 && cp !== 9 && cp !== 10 && cp !== 13) || (cp >= 0x7f && cp < 0xa0)) { kind = 'control'; name = 'Control character'; }
    else if (CONFUSABLE[cp]) { kind = 'lookalike'; name = `Looks like “${CONFUSABLE[cp]}”`; replace = CONFUSABLE[cp]; }
    else if (cp >= 0xe000 && cp <= 0xf8ff) { kind = 'private'; name = 'Private-use character'; }
    if (kind) out.push({ index, line, col, cp, hex: codePointHex(cp), kind, name, replace, char: ch });
    index += ch.length;
    if (ch === '\n') { line++; col = 1; } else col++;
  }
  return out;
}

export function cleanHiddenChars(text, { lookalikes = true, controls = true } = {}) {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (INVISIBLE[cp]) { out += isVisibleSpace(INVISIBLE[cp]) ? ' ' : ''; continue; }
    if ((cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0000 && cp <= 0xe01ef)) continue;
    if (controls && ((cp < 32 && cp !== 9 && cp !== 10 && cp !== 13) || (cp >= 0x7f && cp < 0xa0))) continue;
    if (lookalikes && CONFUSABLE[cp]) { out += CONFUSABLE[cp]; continue; }
    out += ch;
  }
  return out;
}

/** Per-character breakdown for the Unicode inspector. */
export function inspectChars(text, limit = 2000) {
  const enc = new TextEncoder();
  return Array.from(text).slice(0, limit).map((ch) => {
    const cp = ch.codePointAt(0);
    return {
      char: ch, cp, hex: codePointHex(cp),
      utf8: [...enc.encode(ch)].map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' '),
      utf16: Array.from({ length: ch.length }, (_, i) => ch.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')).join(' '),
      category: unicodeCategory(ch),
      html: `&#x${cp.toString(16).toUpperCase()};`,
      escape: cp > 0xffff ? `\\u{${cp.toString(16).toUpperCase()}}` : `\\u${cp.toString(16).toUpperCase().padStart(4, '0')}`,
      flag: INVISIBLE[cp] || (CONFUSABLE[cp] ? `Looks like “${CONFUSABLE[cp]}”` : ''),
    };
  });
}

function unicodeCategory(ch) {
  const tests = [['Uppercase letter', /\p{Lu}/u], ['Lowercase letter', /\p{Ll}/u], ['Letter', /\p{L}/u], ['Mark', /\p{M}/u], ['Digit', /\p{Nd}/u],
    ['Number', /\p{N}/u], ['Space', /\p{Zs}/u], ['Punctuation', /\p{P}/u], ['Currency', /\p{Sc}/u], ['Math symbol', /\p{Sm}/u],
    ['Emoji', /\p{Extended_Pictographic}/u], ['Symbol', /\p{S}/u], ['Control', /\p{Cc}/u], ['Format', /\p{Cf}/u]];
  return tests.find(([, re]) => re.test(ch))?.[0] ?? 'Other';
}

/* ---------------- escaping ---------------- */

export const ESCAPES = {
  json: {
    label: 'JSON string',
    encode: (s) => JSON.stringify(s).slice(1, -1),
    decode: (s) => JSON.parse(`"${s.replace(/(^|[^\\])"/g, '$1\\"')}"`),
  },
  js: {
    label: 'JavaScript string',
    encode: (s) => s.replace(/[\\'"`\n\r\t\b\f\v\0\u2028\u2029]/g, (c) => ({ '\\': '\\\\', "'": "\\'", '"': '\\"', '`': '\\`', '\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f', '\v': '\\v', '\0': '\\0', '\u2028': '\\u2028', '\u2029': '\\u2029' }[c])),
    decode: (s) => s.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[0-7]{1,3}|.)/gs, (_, e) => {
      if (e[0] === 'u') return String.fromCodePoint(parseInt(e.replace(/[u{}]/g, ''), 16));
      if (e[0] === 'x') return String.fromCharCode(parseInt(e.slice(1), 16));
      if (/^[0-7]+$/.test(e)) return String.fromCharCode(parseInt(e, 8));
      return { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v' }[e] ?? e;
    }),
  },
  html: {
    label: 'HTML',
    encode: (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    decode: (s) => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|#39);/gi, (_, e) => {
      const l = e.toLowerCase();
      if (l.startsWith('#x')) return String.fromCodePoint(parseInt(l.slice(2), 16));
      if (l.startsWith('#')) return String.fromCodePoint(Number(l.slice(1)));
      return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' }[l];
    }),
  },
  xml: {
    label: 'XML',
    encode: (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c])),
    decode: (s) => ESCAPES.html.decode(s),
  },
  url: { label: 'URL component', encode: (s) => encodeURIComponent(s), decode: (s) => decodeURIComponent(s.replace(/\+/g, ' ')) },
  sql: { label: 'SQL string', encode: (s) => s.replace(/'/g, "''"), decode: (s) => s.replace(/''/g, "'") },
  csv: {
    label: 'CSV field',
    encode: (s) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s),
    decode: (s) => (/^".*"$/s.test(s.trim()) ? s.trim().slice(1, -1).replace(/""/g, '"') : s),
  },
  regex: { label: 'Regular expression', encode: (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'), decode: (s) => s.replace(/\\([.*+?^${}()|[\]\\/])/g, '$1') },
  unicode: {
    label: 'Unicode escapes (\\uXXXX)',
    encode: (s) => Array.from(s).map((c) => { const cp = c.codePointAt(0); return cp < 128 ? c : cp > 0xffff ? `\\u{${cp.toString(16)}}` : `\\u${cp.toString(16).padStart(4, '0')}`; }).join(''),
    decode: (s) => s.replace(/\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})/gi, (_, a, b) => String.fromCodePoint(parseInt(a || b, 16))),
  },
  shell: {
    label: 'Shell argument (POSIX)',
    encode: (s) => `'${s.replace(/'/g, `'\\''`)}'`,
    decode: (s) => { const t = s.trim(); return t.startsWith("'") && t.endsWith("'") ? t.slice(1, -1).replace(/'\\''/g, "'") : t.replace(/\\(.)/g, '$1'); },
  },
};
