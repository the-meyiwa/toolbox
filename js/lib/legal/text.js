/* ============================================================
   Legal engine — text utilities (DOM-free)

   Page markers, sentence splitting that respects legal
   abbreviations, date parsing (Nigerian day-month order) and
   small string helpers shared by every legal module.
   ============================================================ */

/* ---------- pages ---------- */

// "[Page 3]" (our extractor and the Assistant), "--- Page 3 ---" (older tools) and form feeds.
const PAGE_MARK = /^[ \t]*(?:\[Page (\d+)\]|-{2,}\s*Page (\d+)\s*-{2,})[ \t]*$/gm;

/** Builds an offset → page lookup. Returns null when the text carries no page markers. */
export function pageMap(text) {
  const marks = [];
  const src = String(text || '');
  PAGE_MARK.lastIndex = 0;
  let m;
  while ((m = PAGE_MARK.exec(src))) marks.push({ at: m.index, page: Number(m[1] || m[2]) });
  if (!marks.length && src.includes('\f')) {
    let page = 1;
    marks.push({ at: 0, page });
    for (let i = 0; i < src.length; i++) if (src[i] === '\f') marks.push({ at: i, page: ++page });
  }
  if (!marks.length) return null;
  return {
    marks,
    pages: marks[marks.length - 1].page,
    at(offset) {
      let lo = 0, hi = marks.length - 1, best = marks[0].page;
      if (offset < marks[0].at) return Math.max(1, marks[0].page - 1);
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (marks[mid].at <= offset) { best = marks[mid].page; lo = mid + 1; } else hi = mid - 1;
      }
      return best;
    },
  };
}

export const pageAt = (map, offset) => (map ? map.at(offset) : null);

/** Removes page markers (keeping offsets intact is not needed for display). */
export const stripPageMarks = (s) => String(s || '').replace(PAGE_MARK, '').replace(/\f/g, '\n');

/* ---------- whitespace ---------- */

export const clean = (s) => String(s ?? '').replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
export const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export const clip = (s, n = 220) => { const t = oneLine(s); return t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : t; };

/** Normalises curly quotes, dashes and non-breaking spaces so patterns match reliably. */
export function normaliseText(s) {
  return String(s ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐‑‒−]/g, '-')
    .replace(/ /g, ' ');
}

/* ---------- sentences ---------- */

const ABBREV = new Set([
  'v', 'vs', 'ltd', 'no', 'nos', 'pt', 's', 'ss', 'sec', 'cap', 'co', 'nig', 'esq', 'mr', 'mrs', 'ms', 'dr', 'hon', 'prof',
  'para', 'paras', 'p', 'pp', 'cf', 'ors', 'anor', 'eg', 'ie', 'al', 'jsc', 'jca', 'cjn', 'pca', 'san', 'rtd', 'art', 'arts',
  'r', 'rr', 'o', 'ord', 'vol', 'ch', 'st', 'inc', 'corp', 'plc', 'dept', 'govt', 'fed', 'rep', 'etc', 'chief', 'gen', 'col',
  'capt', 'lt', 'sgt', 'supp', 'ed', 'eds', 'ibid', 'id', 'op', 'cit', 'viz', 'approx', 'rc', 'bn', 'm', 'k', 'j', 'jj', 'cj',
]);

/** A heading, page marker or signature-style line that should never run into the next sentence. */
export function isBreakLine(line) {
  const t = String(line || '').trim();
  if (!t) return false;
  if (/^\[Page \d+\]$|^-{2,}\s*Page \d+\s*-{2,}$/.test(t)) return true;
  const letters = t.replace(/\sv\.\s/g, ' ').replace(/[^A-Za-z]/g, '');
  return letters.length >= 3 && t.length <= 90 && letters === letters.toUpperCase() && !/[,;]$/.test(t);
}

/** Splits into sentences with their offsets. Knows "v.", "Ltd.", "(Pt.", "s.", initials and numbered items. */
export function sentences(text) {
  const src = String(text || '');
  const out = [];
  let start = 0;
  const push = (end) => {
    const raw = src.slice(start, end);
    const lead = raw.length - raw.trimStart().length;
    const t = raw.trim();
    if (t) out.push({ text: t, start: start + lead, end: start + lead + t.length });
    start = end;
  };
  const lineAt = (from) => { const e = src.indexOf('\n', from); return src.slice(from, e < 0 ? src.length : e).trim(); };
  let prevLine = lineAt(0);
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\n' && src[i + 1] === '\n') { push(i); continue; }
    if (c === '\n') {
      const next = lineAt(i + 1);
      const cur = prevLine;
      prevLine = next;
      if (isBreakLine(next) || isBreakLine(cur) || /^\(?(?:\d{1,2}|[a-z]|[ivx]{1,4})[.)]\s/.test(next)) { push(i); continue; }
      continue;
    }
    if (c !== '.' && c !== '?' && c !== '!' && c !== ';') continue;
    if (c === ';') continue; // semicolons do not end legal sentences
    const next = src.slice(i + 1, i + 4);
    if (!/^["')\]]?\s+["'(]?[A-Z0-9(]/.test(next) && !/^["')\]]?\s*\n/.test(next) && i + 1 < src.length) continue;
    if (c === '.') {
      const word = (src.slice(Math.max(0, i - 12), i).match(/([A-Za-z]+)$/) || [])[1] || '';
      if (ABBREV.has(word.toLowerCase())) continue;
      if (/^[A-Z]$/.test(word)) continue; // initials: "A. B. Okoro"
      if (/\d$/.test(src[i - 1] || '') && /^\d/.test(src[i + 1] || '')) continue; // 1.5
      if (/(?:^|\n)\s*\(?\d{1,2}$/.test(src.slice(Math.max(0, i - 6), i))) continue; // "1." list numbering
    }
    let end = i + 1;
    while (/["')\]]/.test(src[end] || '')) end++;
    push(end);
  }
  push(src.length);
  return out;
}

/* ---------- numbers ---------- */

const NUM_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, eighteen: 18, twenty: 20, 'twenty-one': 21, 'twenty-eight': 28,
  thirty: 30, forty: 40, 'forty-five': 45, fifty: 50, sixty: 60, ninety: 90, hundred: 100, 'one hundred and twenty': 120,
  a: 1, an: 1,
};
export const NUMBER_WORD_RE = '(?:\\d{1,4}|one hundred and twenty|twenty-one|twenty-eight|forty-five|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|eighteen|twenty|thirty|forty|fifty|sixty|ninety|a|an)';

/** "thirty (30)" → 30, "7" → 7, "six" → 6. */
export function parseNumberWord(s) {
  const t = String(s || '').toLowerCase().trim();
  const paren = t.match(/\((\d+)\)/);
  if (paren) return Number(paren[1]);
  if (/^\d+$/.test(t)) return Number(t);
  return NUM_WORDS[t.replace(/\s*\(.*$/, '')] ?? null;
}

/* ---------- dates ---------- */

export const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_RE = '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const monthIdx = (m) => MONTHS.findIndex(x => x.startsWith(String(m).toLowerCase().slice(0, 3)));
const iso = (y, m, d) => {
  const dt = new Date(Date.UTC(y, m, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

// Order matters: the long "12th day of July, 2019" form first.
export const DATE_SOURCE = [
  `(\\d{1,2})(?:st|nd|rd|th)?\\s+day\\s+of\\s+${MONTH_RE},?\\s+(\\d{4})`,
  `(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\.?,?\\s+(\\d{4})`,
  `${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`,
  `(\\d{4})-(\\d{2})-(\\d{2})`,
  `(\\d{1,2})[/.](\\d{1,2})[/.](\\d{4})`,
];
export const DATE_RE = new RegExp(DATE_SOURCE.map(s => `(?:${s})`).join('|'), 'gi');

/** Parses one date string. Slash dates are read day-first, as in Nigeria. Returns ISO yyyy-mm-dd or null. */
export function parseDate(s) {
  const t = String(s || '').trim();
  let m;
  if ((m = t.match(new RegExp(`^${DATE_SOURCE[0]}`, 'i')))) return iso(+m[3], monthIdx(m[2]), +m[1]);
  if ((m = t.match(new RegExp(`^${DATE_SOURCE[1]}`, 'i')))) return iso(+m[3], monthIdx(m[2]), +m[1]);
  if ((m = t.match(new RegExp(`^${DATE_SOURCE[2]}`, 'i')))) return iso(+m[3], monthIdx(m[1]), +m[2]);
  if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})/))) return iso(+m[1], +m[2] - 1, +m[3]);
  if ((m = t.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/))) return iso(+m[3], +m[2] - 1, +m[1]);
  return null;
}

/** Every date in a text with its offset. */
export function findDates(text) {
  const out = [];
  const src = String(text || '');
  DATE_RE.lastIndex = 0;
  let m;
  while ((m = DATE_RE.exec(src))) {
    const date = parseDate(m[0]);
    if (date) out.push({ raw: m[0], date, index: m.index, end: m.index + m[0].length });
  }
  return out;
}

export function addToDate(isoDate, n, unit) {
  const [y, mo, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  const u = String(unit).toLowerCase();
  if (/^day/.test(u)) dt.setUTCDate(dt.getUTCDate() + n);
  else if (/^(business|working)/.test(u)) {
    let left = Math.abs(n); const step = n < 0 ? -1 : 1;
    while (left > 0) { dt.setUTCDate(dt.getUTCDate() + step); const w = dt.getUTCDay(); if (w !== 0 && w !== 6) left--; }
  } else if (/^week/.test(u)) dt.setUTCDate(dt.getUTCDate() + n * 7);
  else if (/^month/.test(u)) {
    const day = dt.getUTCDate();
    dt.setUTCDate(1); dt.setUTCMonth(dt.getUTCMonth() + n);
    const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
    dt.setUTCDate(Math.min(day, last));
  } else if (/^year/.test(u)) {
    const day = dt.getUTCDate(), month = dt.getUTCMonth();
    dt.setUTCDate(1); dt.setUTCFullYear(dt.getUTCFullYear() + n);
    const last = new Date(Date.UTC(dt.getUTCFullYear(), month + 1, 0)).getUTCDate();
    dt.setUTCMonth(month); dt.setUTCDate(Math.min(day, last));
  }
  return dt.toISOString().slice(0, 10);
}

export function formatDate(isoDate, style = 'long') {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  const name = MONTHS[m - 1];
  const cap = name[0].toUpperCase() + name.slice(1);
  if (style === 'short') return `${d} ${cap.slice(0, 3)} ${y}`;
  return `${d} ${cap} ${y}`;
}

/* ---------- names ---------- */

const KEEP_CAPS = new Set(['AG', 'FRN', 'INEC', 'NNPC', 'CBN', 'UBA', 'FCT', 'NDIC', 'EFCC', 'ICPC', 'NBA', 'PDP', 'APC', 'LASG', 'NPA', 'NAFDAC',
  'FIRS', 'NPF', 'IGP', 'COP', 'SAN', 'UK', 'USA', 'JSC', 'JCA', 'CAC', 'AMCON', 'NEPA', 'PHCN', 'NITEL', 'NLNG', 'SPDC', 'MTN', 'GTB',
  'NUJ', 'ASUU', 'NLC', 'TUC', 'NIPOST', 'NCC', 'SEC', 'FHA', 'LSDPC', 'NSITF', 'PENCOM', 'NHIS', 'NTA', 'FAAN', 'NCAA', 'NIMASA',
  'LAWMA', 'LASBCA', 'LIRS', 'FCDA', 'AMAC', 'II', 'III', 'IV', 'VI', 'ICC', 'LCIA', 'LCA', 'RC', 'LLC', 'LLP', 'PLC', 'NIG', 'CFRN']);
const LOWER_WORDS = new Set(['of', 'and', 'the', 'for', 'in', 'on', 'to', 'at', 'by', 'de', 'la']);

/** "ADEGOKE V. ADIBI" → "Adegoke v. Adibi"; mixed-case names are left alone. */
export function tidyName(s) {
  let t = oneLine(s).replace(/\s+(?:vs?\.?|versus)\s+/gi, ' v. ');
  const letters = t.replace(/\sv\.\s/g, ' ').replace(/[^A-Za-z]/g, '');
  if (letters && letters === letters.toUpperCase() && letters.length > 3) {
    t = t.split(' ').map((w, i) => {
      const bare = w.replace(/[^A-Za-z]/g, '');
      if (!bare) return w;
      if (KEEP_CAPS.has(bare.toUpperCase().replace(/\./g, ''))) return bare.toUpperCase() === 'PLC' ? w.replace(/PLC/i, 'Plc') : bare.toUpperCase() === 'NIG' ? w.replace(/NIG/i, 'Nig') : w;
      if (/^V\.?$/i.test(w)) return 'v.';
      if (i > 0 && LOWER_WORDS.has(bare.toLowerCase())) return w.toLowerCase();
      if (/^(LTD|LIMITED|CO|ORS|ANOR)\.?$/i.test(w)) return w[0] + w.slice(1).toLowerCase();
      return w.toLowerCase().replace(/(^|[-'(])([a-z])/g, (m0, p, c) => p + c.toUpperCase()).replace(/^Mc([a-z])/, (m0, c) => `Mc${c.toUpperCase()}`);
    }).join(' ');
  }
  return t.replace(/\s+,/g, ',').replace(/\bv\s+/g, 'v. ').replace(/\bv\.\.+/g, 'v.');
}

export const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Word-overlap similarity (0..1) used to align issues and match party names. */
const STOP = new Set('the a an of to in on for and or is was were be been by with at as that this whether which who whom from it its his her their there not no any all into upon under than then so such same said learned court trial lower appellant appellants respondent respondents plaintiff defendant claimant counsel issue issues lordship lordships case'.split(' '));
export function tokens(s) {
  return oneLine(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w))
    .map(w => w.replace(/(ing|ed|es|s)$/, ''));
}
export function similarity(a, b) {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.sqrt(A.size * B.size);
}

export const uniqBy = (arr, key) => { const seen = new Set(); return arr.filter(x => { const k = key(x); if (seen.has(k)) return false; seen.add(k); return true; }); };
