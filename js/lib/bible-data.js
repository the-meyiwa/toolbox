/* ============================================================
   Bible structure.

   Book names, chapter counts and testament, so navigation and reference
   parsing work without a network call. Only the text itself is fetched.

   Chapter counts follow the 66-book Protestant canon, which is what the
   public-domain translations available here contain.
   ============================================================ */

/** [name, chapters, testament, common abbreviations] */
const RAW = [
  ['Genesis', 50, 'ot', 'gen ge gn'],
  ['Exodus', 40, 'ot', 'exo ex exod'],
  ['Leviticus', 27, 'ot', 'lev le lv'],
  ['Numbers', 36, 'ot', 'num nu nm nb'],
  ['Deuteronomy', 34, 'ot', 'deut dt deu'],
  ['Joshua', 24, 'ot', 'josh jos jsh'],
  ['Judges', 21, 'ot', 'judg jdg jg'],
  ['Ruth', 4, 'ot', 'rth ru'],
  ['1 Samuel', 31, 'ot', '1sam 1sa 1s firstsamuel'],
  ['2 Samuel', 24, 'ot', '2sam 2sa 2s secondsamuel'],
  ['1 Kings', 22, 'ot', '1kgs 1ki 1k'],
  ['2 Kings', 25, 'ot', '2kgs 2ki 2k'],
  ['1 Chronicles', 29, 'ot', '1chr 1ch'],
  ['2 Chronicles', 36, 'ot', '2chr 2ch'],
  ['Ezra', 10, 'ot', 'ezr'],
  ['Nehemiah', 13, 'ot', 'neh ne'],
  ['Esther', 10, 'ot', 'esth es'],
  ['Job', 42, 'ot', 'jb'],
  ['Psalms', 150, 'ot', 'ps psalm psa psm'],
  ['Proverbs', 31, 'ot', 'prov pro prv'],
  ['Ecclesiastes', 12, 'ot', 'eccl ecc ec qoh'],
  ['Song of Solomon', 8, 'ot', 'song sos canticles'],
  ['Isaiah', 66, 'ot', 'isa is'],
  ['Jeremiah', 52, 'ot', 'jer je'],
  ['Lamentations', 5, 'ot', 'lam la'],
  ['Ezekiel', 48, 'ot', 'ezek eze ezk'],
  ['Daniel', 12, 'ot', 'dan da dn'],
  ['Hosea', 14, 'ot', 'hos ho'],
  ['Joel', 3, 'ot', 'jl'],
  ['Amos', 9, 'ot', 'am'],
  ['Obadiah', 1, 'ot', 'obad ob'],
  ['Jonah', 4, 'ot', 'jon jnh'],
  ['Micah', 7, 'ot', 'mic mc'],
  ['Nahum', 3, 'ot', 'nah na'],
  ['Habakkuk', 3, 'ot', 'hab hb'],
  ['Zephaniah', 3, 'ot', 'zeph zep zp'],
  ['Haggai', 2, 'ot', 'hag hg'],
  ['Zechariah', 14, 'ot', 'zech zec zc'],
  ['Malachi', 4, 'ot', 'mal ml'],
  ['Matthew', 28, 'nt', 'matt mt'],
  ['Mark', 16, 'nt', 'mrk mk mr'],
  ['Luke', 24, 'nt', 'luk lk'],
  ['John', 21, 'nt', 'jhn jn joh'],
  ['Acts', 28, 'nt', 'act ac'],
  ['Romans', 16, 'nt', 'rom ro rm'],
  ['1 Corinthians', 16, 'nt', '1cor 1co'],
  ['2 Corinthians', 13, 'nt', '2cor 2co'],
  ['Galatians', 6, 'nt', 'gal ga'],
  ['Ephesians', 6, 'nt', 'eph ephes'],
  ['Philippians', 4, 'nt', 'phil php'],
  ['Colossians', 4, 'nt', 'col'],
  ['1 Thessalonians', 5, 'nt', '1thess 1th'],
  ['2 Thessalonians', 3, 'nt', '2thess 2th'],
  ['1 Timothy', 6, 'nt', '1tim 1ti'],
  ['2 Timothy', 4, 'nt', '2tim 2ti'],
  ['Titus', 3, 'nt', 'tit ti'],
  ['Philemon', 1, 'nt', 'philem phm'],
  ['Hebrews', 13, 'nt', 'heb'],
  ['James', 5, 'nt', 'jas jm'],
  ['1 Peter', 5, 'nt', '1pet 1pe 1pt'],
  ['2 Peter', 3, 'nt', '2pet 2pe 2pt'],
  ['1 John', 5, 'nt', '1jn 1jo 1joh'],
  ['2 John', 1, 'nt', '2jn 2jo 2joh'],
  ['3 John', 1, 'nt', '3jn 3jo 3joh'],
  ['Jude', 1, 'nt', 'jud jde'],
  ['Revelation', 22, 'nt', 'rev re apocalypse'],
];

export const BOOKS = RAW.map(([name, chapters, testament, abbr], i) => ({
  index: i,
  name,
  chapters,
  testament,
  abbreviations: abbr.split(' '),
  slug: name.toLowerCase().replace(/\s+/g, '+'),
}));

/** Public-domain translations bible-api.com serves without a key. */
export const TRANSLATIONS = [
  { id: 'web',  name: 'World English Bible', note: 'Modern English, public domain' },
  { id: 'kjv',  name: 'King James Version', note: '1611, public domain' },
  { id: 'asv',  name: 'American Standard Version', note: '1901, public domain' },
  { id: 'bbe',  name: 'Bible in Basic English', note: 'Simplified vocabulary' },
  { id: 'ylt',  name: "Young's Literal Translation", note: 'Very literal rendering' },
  { id: 'oeb-cw', name: 'Open English Bible', note: 'Contemporary, in progress' },
  { id: 'clementine', name: 'Clementine Latin Vulgate', note: 'Latin' },
  { id: 'almeida', name: 'João Ferreira de Almeida', note: 'Portuguese' },
  { id: 'rccv', name: 'Romanian Corrected Cornilescu', note: 'Romanian' },
];

const normalise = (s) => s.toLowerCase().replace(/[.\s]/g, '');

/** Find a book from anything a person might type: "1 cor", "Jn", "psalm". */
export function findBook(text) {
  const q = normalise(text);
  if (!q) return null;

  for (const b of BOOKS) if (normalise(b.name) === q) return b;
  for (const b of BOOKS) if (b.abbreviations.includes(q)) return b;
  // Longest prefix wins, so "john" does not match "1 John" first.
  const prefix = BOOKS.filter(b => normalise(b.name).startsWith(q));
  if (prefix.length === 1) return prefix[0];
  if (prefix.length > 1) return prefix.sort((a, b) => a.name.length - b.name.length)[0];
  return BOOKS.find(b => b.abbreviations.some(a => a.startsWith(q))) ?? null;
}

/**
 * Parse a reference like "John 3:16", "1 cor 13", "Ps 23:1-6".
 * @returns {{book, chapter, verseStart, verseEnd}|null}
 */
export function parseReference(text) {
  const raw = String(text).trim();
  if (!raw) return null;

  // Book names can contain a leading number ("1 John"), so the split has
  // to find the last number group that is followed by a colon or nothing.
  const m = raw.match(/^\s*((?:[1-3]\s*)?[A-Za-z][A-Za-z\s.]*?)\s*(\d+)?\s*(?::\s*(\d+)(?:\s*[-–]\s*(\d+))?)?\s*$/);
  if (!m) return null;

  const book = findBook(m[1]);
  if (!book) return null;

  const chapter = m[2] ? Math.min(Math.max(1, Number(m[2])), book.chapters) : 1;
  const verseStart = m[3] ? Number(m[3]) : null;
  const verseEnd = m[4] ? Number(m[4]) : verseStart;

  return { book, chapter, verseStart, verseEnd };
}

export function formatReference({ book, chapter, verseStart, verseEnd }) {
  let ref = `${book.name} ${chapter}`;
  if (verseStart) ref += `:${verseStart}${verseEnd && verseEnd !== verseStart ? `-${verseEnd}` : ''}`;
  return ref;
}

/* A short list of passages people actually look for, so the empty state
   is a starting point rather than a blank page. */
export const SUGGESTED = [
  { ref: 'John 3:16', label: 'For God so loved the world' },
  { ref: 'Psalm 23', label: 'The Lord is my shepherd' },
  { ref: 'Romans 8:28', label: 'All things work together' },
  { ref: '1 Corinthians 13', label: 'Love is patient' },
  { ref: 'Philippians 4:6-7', label: 'Do not be anxious' },
  { ref: 'Proverbs 3:5-6', label: 'Trust in the Lord' },
  { ref: 'Isaiah 40:31', label: 'They shall mount up with wings' },
  { ref: 'Genesis 1', label: 'In the beginning' },
  { ref: 'Matthew 5', label: 'The Sermon on the Mount' },
  { ref: 'Jeremiah 29:11', label: 'Plans to prosper you' },
];
