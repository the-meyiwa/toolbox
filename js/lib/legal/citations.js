/* ============================================================
   Legal engine — citations (DOM-free)

   Finds and normalises what a legal text cites:
   · Nigerian law reports: NWLR (Pt.), LPELR, All FWLR, SC, SCNJ,
     NSCC, SCNLR, All NLR, WRN, NLR, WACA, FSC …
   · Foreign reports: AC, QB, KB, Ch, WLR, All ER, Lloyd's Rep,
     neutral citations (UKSC, UKHL, EWCA Civ, EWHC …), U.S.
   · Suit and appeal numbers (SC/…, CA/L/…, FHC/…, NICN/…)
   · Statutes: Acts and Laws, "Cap. C20 LFN 2004", the
     Constitution 1999 (as amended), sections of each
   · Rules of court with Order/Rule references
   · Party names in front of each citation, and "(supra)" re-uses
   Everything is extracted from the text; nothing is looked up
   or invented. Heuristic results carry `inferred: true`.
   ============================================================ */

import { COURTS, courtFromTitle, courtFromSuitNo } from './courts.js';
import { tidyName, oneLine, sentences, escapeRe } from './text.js';

/* ---------------- report series ---------------- */

// [display, jurisdiction, court the series implies (or null), takes a (Pt.) part]
const SERIES = [
  ['NWLR', 'NG', null, true], ['All FWLR', 'NG', null, true], ['FWLR', 'NG', null, true],
  ['SCNJ', 'NG', 'SC'], ['SCNLR', 'NG', 'SC'], ['NSCC', 'NG', 'SC'], ['NSCQR', 'NG', 'SC'], ['MJSC', 'NG', 'SC'], ['SCM', 'NG', 'SC'],
  ['SC', 'NG', 'SC', true], ['All NLR', 'NG', null], ['ANLR', 'NG', null], ['NLR', 'NG', null], ['WRN', 'NG', null], ['WACA', 'NG', 'WACA'],
  ['FSC', 'NG', 'FSC'], ['NMLR', 'NG', null], ['NCLR', 'NG', null], ['NLLR', 'NG', 'NIC', true], ['EPR', 'NG', null], ['CHR', 'NG', null],
  ['LRN', 'NG', null], ['QLRN', 'NG', null], ['NILR', 'NG', null], ['WNLR', 'NG', null], ['NNLR', 'NG', null], ['ENLR', 'NG', null],
  ['FNLR', 'NG', null], ['CCHCJ', 'NG', null], ['NRNLR', 'NG', null], ['NBLR', 'NG', null], ['ELR', 'NG', null],
  ['AC', 'UK', null], ['App Cas', 'UK', null], ['QB', 'UK', null], ['QBD', 'UK', null], ['KB', 'UK', null], ['Ch', 'UK', null], ['Ch D', 'UK', null],
  ['Fam', 'UK', null], ['WLR', 'UK', null], ['All ER (Comm)', 'UK', null], ['All ER', 'UK', null], ["Lloyd's Rep", 'UK', null], ['BCLC', 'UK', null],
  ['Cr App R', 'UK', null], ['ER', 'UK', null],
  ['SCR', 'CA-ca', null], ['CLR', 'AU', null], ['GLR', 'GH', null], ['EA', 'EA', null], ['SLR', 'SG', null],
];

const JURISDICTION_LABEL = { NG: 'Nigeria', UK: 'England & Wales / UK', 'CA-ca': 'Canada', AU: 'Australia', GH: 'Ghana', EA: 'East Africa', SG: 'Singapore', US: 'United States' };
export const jurisdictionLabel = (j) => JURISDICTION_LABEL[j] || j;

const letterPat = (display) => display.split('').map(ch => {
  if (ch === ' ') return '\\s*';
  if (ch === "'") return "['’]?";
  if (/[()]/.test(ch)) return `\\${ch}`;
  if (/[A-Za-z]/.test(ch)) return `${ch}\\.?`;
  return escapeRe(ch);
}).join('');

const SERIES_SORTED = [...SERIES].sort((a, b) => b[0].replace(/\s/g, '').length - a[0].replace(/\s/g, '').length);
const SERIES_ALT = SERIES_SORTED.map(s => letterPat(s[0])).join('|');
const SERIES_KEY = new Map(SERIES.map(s => [s[0].replace(/[^A-Za-z()]/g, '').toUpperCase(), s]));
const seriesOf = (raw) => SERIES_KEY.get(String(raw).replace(/[^A-Za-z()]/g, '').toUpperCase()) || null;

const PART = String.raw`(?:\(\s*(?:Pt|Part|pt)\.?\s*([0-9]{1,4}|[IVX]{1,4})\s*\)|(?:Pt|Part)\.?\s*([0-9]{1,4}|[IVX]{1,4}))`;
const PIN = String.raw`(?:\s*(?:,\s*)?(?:at|@)\s*(?:pp?\.?|pages?|pg\.?)?\s*(\d{1,5}(?:\s*[-–]\s*\d{1,5})?)(?:\s*,?\s*(?:paras?\.?|paragraphs?)\s*([A-H](?:\s*[-–]\s*[A-H])?))?)?`;
const COURT_TAIL = String.raw`(?:\s*\(\s*(SC|CA|FHC|NICN|NIC)\s*\))?`;

// (2019) 10 NWLR (Pt. 1680) 1 at 25, paras C-E   ·   [1932] AC 562   ·   (1990) 1 SC 1
const REPORT_RE = new RegExp(String.raw`([\[(])\s*(\d{4})\s*[\])]\s*,?\s*(?:(\d{1,3})\s+)?(${SERIES_ALT})(?![A-Za-z])\s*,?\s*(?:${PART}\s*,?\s*)?(?:p(?:age|g)?\.?\s*)?(\d{1,5})(?![\d/])${PIN}${COURT_TAIL}`, 'g');
// (2018) LPELR-44990(SC) (Pp. 12-13, Paras. E-A)
const LPELR_RE = /(?:[[(]\s*(\d{4})\s*[\])]\s*)?L\.?P\.?E\.?L\.?R\.?\s*[-–]?\s*(\d{3,6})\s*\(\s*(SC|CA|FHC|NICN|NIC|HC)\s*\)(?:\s*\(?\s*(?:at\s+)?Pp?\.?\s*(\d{1,4}(?:\s*[-–]\s*\d{1,4})?)\s*(?:,?\s*Paras?\.?\s*([A-H](?:\s*[-–]\s*[A-H])?))?\s*\)?)?/g;
// [2019] UKSC 5 · [2020] EWCA Civ 123 · [2018] EWHC 123 (Ch)
const NEUTRAL_RE = /\[(\d{4})\]\s*(UKSC|UKHL|UKPC|EWCA\s+Civ|EWCA\s+Crim|EWHC|UKUT|EWCOP|CSIH|CSOH|SGCA|SGHC|ZASCA|ZACC|HCA|SCC|NZSC|KESC|GHASC)\s+(\d{1,5})(?:\s*\((Ch|QB|KB|Comm|TCC|Admin|Fam|Pat|IPEC)\))?(?:\s*(?:,\s*)?at\s*\[(\d{1,4})\])?/g;
// 347 U.S. 483 (1954)
const US_RE = /\b(\d{1,4})\s+(U\.\s?S\.|S\.\s?Ct\.|F\.\s?(?:2d|3d|4th)|F\.\s?Supp\.(?:\s?[23]d)?|L\.\s?Ed\.(?:\s?2d)?)\s+(\d{1,5})(?:,\s*(\d{1,5}))?\s*\(([^()]{0,30}?)(\d{4})\)/g;

const NEUTRAL_COURT = { UKSC: 'UKSC', UKHL: 'UKSC', UKPC: 'PC', 'EWCA Civ': 'EWCA', 'EWCA Crim': 'EWCA', EWHC: 'EWHC' };

const dash = (s) => String(s || '').replace(/\s*[-–]\s*/g, '–');

function pinpointOf(pages, paras) {
  if (!pages && !paras) return null;
  return { pages: pages ? dash(pages) : null, paras: paras ? dash(paras).toUpperCase() : null, text: [pages ? `${/[-–]/.test(pages) ? 'pp.' : 'p.'} ${dash(pages)}` : '', paras ? `paras ${dash(paras).toUpperCase()}` : ''].filter(Boolean).join(', ') };
}

/* ---------------- party names in front of a citation ---------------- */

const NAME_CONNECTOR = /^(?:of|and|the|for|in|&|de|la|du|ex|parte|re|on|behalf)$/i;
const LEAD_NOISE = /^(?:see|also|in|cf\.?|per|and|as|held|following|applying|distinguishing|following|thus|so|but|however|where|e\.g\.|i\.e\.|case|cases|decision|decisions|authority|authorities|judgment|including|namely|like|this|the|of|on|was|is|that|court|appeal|by|to|with)$/i;

/** Walks back from a citation to find "A v. B". Returns { title, a, b } or null. */
export function partiesBefore(text, index, floor = 0) {
  const win = text.slice(Math.max(floor, index - 260), index);
  const vm = [...win.matchAll(/\s(?:v|vs|V|VS|Vs)\.?\s+(?=[A-Z0-9(])/g)].pop();
  if (!vm) return reOrExParte(win);
  let right = win.slice(vm.index + vm[0].length).replace(/[\s,;:(]+$/, '').replace(/\s*\(\s*$/, '');
  if (!right || right.length > 140 || /[.;:]\s+[A-Z][a-z]+\s/.test(right) && !/(?:Ltd|Plc|Co|Nig|Inc|Anor|Ors|Bros|Corp)\.\s/.test(right)) {
    // right side must be a name, not a sentence
    if (!right || right.length > 140) return null;
  }
  right = right.replace(/^[^A-Za-z0-9(]+/, '');
  if (/\b(?:is|was|were|held|that|where|which|said|stated|observed|per)\b/.test(right)) return null;
  const leftRaw = win.slice(0, vm.index);
  const words = leftRaw.split(/\s+/);
  const picked = [];
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    if (!w) continue;
    const bare = w.replace(/^[("'[]+|[)"',\]]+$/g, '');
    if (/\d\)?$/.test(bare) && !/^[A-Z]/.test(bare)) break;
    if (/^[A-H][-–][A-H]$/.test(bare) || /^paras?\.?$/i.test(bare)) break;
    const isName = /^[A-Z0-9]/.test(bare) || /^\(?(?:Nig|Nigeria|Rtd|Retd|Ltd)\.?\)?,?$/.test(w) || NAME_CONNECTOR.test(bare) || /^[A-Z][A-Za-z.'-]*,$/.test(w);
    if (!isName) break;
    if (/[.;:]$/.test(w) && !/^(?:Ltd|Plc|Co|Nig|Inc|Bros|Corp|Mr|Mrs|Dr|Hon|Ltd|St|Anor|Ors|[A-Z])\.$/.test(bare + (w.endsWith('.') ? '.' : '')) && picked.length) break;
    picked.unshift(w);
    if (picked.length > 12) break;
  }
  while (picked.length && (LEAD_NOISE.test(picked[0].replace(/[^A-Za-z.]/g, '')) || NAME_CONNECTOR.test(picked[0]))) picked.shift();
  let left = picked.join(' ').replace(/^[("'[]+/, '').replace(/[,;:]+$/, '');
  if (!left || !right) return null;
  if (left.split(' ').length > 12) return null;
  const a = tidyName(left), b = tidyName(right.replace(/\s+/g, ' '));
  return { a, b, title: `${a} v. ${b}` };
}

function reOrExParte(win) {
  const m = win.match(/((?:In\s+)?Re|Ex\s+parte)\s+([A-Z][A-Za-z0-9.'&,\s()-]{1,80}?)[\s,]*$/);
  if (!m) return null;
  const title = tidyName(`${/^in/i.test(m[1]) ? 'In re' : m[1]} ${m[2]}`);
  return { a: title, b: '', title };
}

/* ---------------- case citations ---------------- */

/** Finds every report, LPELR, neutral and U.S. citation, each with its normalised form. */
export function findCaseCitations(text) {
  const src = String(text || '');
  const out = [];
  const push = (c) => { if (!out.some(o => c.index < o.end && o.index < c.end)) out.push(c); };

  LPELR_RE.lastIndex = 0;
  for (let m; (m = LPELR_RE.exec(src));) {
    const court = m[3] === 'NICN' ? 'NIC' : m[3] === 'HC' ? 'HC' : m[3];
    push({
      kind: 'case', series: 'LPELR', jurisdiction: 'NG', year: m[1] ? Number(m[1]) : null, number: m[2],
      normalised: `${m[1] ? `(${m[1]}) ` : ''}LPELR-${m[2]}(${m[3]})`, court: COURTS[court] ? { id: court, name: COURTS[court].name, source: 'citation' } : null,
      pinpoint: pinpointOf(m[4], m[5]), raw: m[0], index: m.index, end: m.index + m[0].length,
    });
  }
  REPORT_RE.lastIndex = 0;
  for (let m; (m = REPORT_RE.exec(src));) {
    const s = seriesOf(m[4]);
    if (!s) continue;
    const [display, jur, implied, hasPart] = s;
    const year = Number(m[2]);
    if (year < 1800 || year > 2100) continue;
    const vol = m[3] ? Number(m[3]) : null;
    const part = m[5] || m[6] || null;
    if (display === 'NWLR' && !part) { /* still a citation, flag the missing part */ }
    const bracket = m[1] === '[' ? ['[', ']'] : ['(', ')'];
    // Nigerian reports use round brackets; English volume-by-year reports use square ones.
    if (jur === 'NG') { bracket[0] = '('; bracket[1] = ')'; }
    const partTxt = part ? ` (Pt. ${part.toUpperCase()})` : '';
    const normalised = `${bracket[0]}${year}${bracket[1]} ${vol ? `${vol} ` : ''}${display}${partTxt} ${Number(m[7])}`;
    const tailCourt = m[10] ? (m[10] === 'NICN' ? 'NIC' : m[10]) : null;
    const courtId = tailCourt || implied;
    push({
      kind: 'case', series: display, jurisdiction: jur, year, volume: vol, part: part ? part.toUpperCase() : null, page: Number(m[7]),
      normalised, court: courtId && COURTS[courtId] ? { id: courtId, name: COURTS[courtId].name, source: tailCourt ? 'citation' : 'series' } : null,
      pinpoint: pinpointOf(m[8], m[9]), raw: m[0], index: m.index, end: m.index + m[0].length,
      warnings: hasPart && !part && display !== 'SC' ? ['Part number (Pt.) missing'] : [],
    });
  }
  NEUTRAL_RE.lastIndex = 0;
  for (let m; (m = NEUTRAL_RE.exec(src));) {
    const courtCode = m[2].replace(/\s+/g, ' ');
    const cid = NEUTRAL_COURT[courtCode] || 'FOREIGN';
    push({
      kind: 'case', series: courtCode, jurisdiction: /^(?:UK|EW|CS)/.test(courtCode) ? 'UK' : 'FOREIGN', year: Number(m[1]), number: m[3],
      normalised: `[${m[1]}] ${courtCode} ${m[3]}${m[4] ? ` (${m[4]})` : ''}`, court: { id: cid, name: COURTS[cid].name, source: 'citation' },
      pinpoint: m[5] ? { pages: null, paras: m[5], text: `para [${m[5]}]` } : null, raw: m[0], index: m.index, end: m.index + m[0].length,
    });
  }
  US_RE.lastIndex = 0;
  for (let m; (m = US_RE.exec(src));) {
    const rep = m[2].replace(/\s+/g, '').replace(/^U\.S\.$/, 'U.S.').replace('S.Ct.', 'S. Ct.').replace(/^F\.(\w+)/, 'F.$1').replace('F.Supp.', 'F. Supp.').replace('L.Ed.', 'L. Ed.');
    push({
      kind: 'case', series: rep, jurisdiction: 'US', year: Number(m[6]), volume: Number(m[1]), page: Number(m[3]),
      normalised: `${m[1]} ${rep} ${m[3]} (${m[5].trim() ? `${m[5].trim()} ` : ''}${m[6]})`, court: { id: 'FOREIGN', name: 'United States court', source: 'citation' },
      pinpoint: m[4] ? { pages: m[4], paras: null, text: `p. ${m[4]}` } : null, raw: m[0], index: m.index, end: m.index + m[0].length,
    });
  }
  out.sort((a, b) => a.index - b.index);

  // Parties, parallel citations and the judge named right after ("per Okoro, JSC").
  for (let i = 0; i < out.length; i++) {
    const c = out[i];
    c.foreign = c.jurisdiction !== 'NG';
    const prev = out[i - 1];
    const gap = prev ? src.slice(prev.end, c.index) : null;
    if (prev && /^\s*[;,]?\s*(?:and\s+|also\s+(?:reported\s+(?:as|in)\s+)?)?$/i.test(gap)) {
      c.parties = prev.parties; c.parallelOf = prev.parallelOf ?? i - 1;
    } else {
      c.parties = partiesBefore(src, c.index, prev ? prev.end : 0);
    }
    const after = src.slice(c.end, c.end + 90);
    const per = after.match(/^\s*[,;]?\s*(?:\(?\s*)?per\s+([A-Z][A-Za-z'.-]+(?:[\s-][A-Z][A-Za-z'.-]+){0,4}),?\s*(JSC|JCA|CJN|PCA|FJ|J|LJ|Lord\s+\w+)\b/);
    if (per) {
      c.per = `${tidyName(per[1])}, ${per[2]}`;
      if (!c.court) {
        const ct = courtFromTitle(per[2]);
        if (ct) c.court = { id: ct.id, name: ct.name, source: 'judge', inferred: true };
      }
    }
    // A suit number right beside the citation, e.g. "(2019) LPELR-1(SC); SC.123/2008".
    if (!c.court) {
      const near = src.slice(Math.max(0, c.index - 60), c.end + 60).match(SUIT_RE_ONE);
      const ct = near ? courtFromSuitNo(near[0]) : null;
      if (ct) c.court = { id: ct.id, name: ct.name, source: 'suit number', inferred: true };
    }
  }
  return out;
}

/* ---------------- suit / appeal numbers ---------------- */

const SUIT_SRC = String.raw`\b(?:SC(?:\s*\.\s*|\s*\/\s*)(?:(?:CV|CR)\s*\/\s*)?\d{1,5}[A-Z]?\s*\/\s*\d{4}|CA\/[A-Z]{1,3}\/(?:[A-Z]{1,4}\/)?\d{1,5}[A-Z]{0,2}(?:\/[A-Z]{1,2})?\/\d{4}|FHC\/[A-Z]{1,4}\/[A-Z]{1,4}\/\d{1,5}\/\d{4}|NICN?\/[A-Z]{2,5}\/\d{1,5}[A-Z]?\/\d{4}|FCT\/HC\/[A-Z]{2,3}\/\d{1,5}\/\d{4}|(?:LD|ID|IKD|EPE|BD|HCT|HOH|HAB|HEN|HPH|HC)\/\d{1,5}[A-Z]{0,4}\/\d{4})`;
const SUIT_RE = new RegExp(SUIT_SRC, 'g');
const SUIT_RE_ONE = new RegExp(SUIT_SRC);

export function normaliseSuitNo(s) {
  return String(s).toUpperCase().replace(/\s+/g, '').replace(/^SC\.(?=\d)/, 'SC.').replace(/^SC\/(?=\d)/, 'SC/');
}

export function findSuitNumbers(text) {
  const src = String(text || '');
  const out = [];
  SUIT_RE.lastIndex = 0;
  for (let m; (m = SUIT_RE.exec(src));) {
    const no = normaliseSuitNo(m[0]);
    const court = courtFromSuitNo(no);
    out.push({ kind: 'suit', raw: m[0], normalised: no, court: court ? { id: court.id, name: court.name } : null, index: m.index, end: m.index + m[0].length });
  }
  // Labelled numbers the pattern above does not know: "Suit No: HOS/12/2019".
  const LABEL = /\b(?:Suit|Appeal|Motion|Petition|Charge)\s+No\.?\s*:?\s*([A-Z][A-Z0-9.]*(?:\s*\/\s*[A-Z0-9.]+){1,5})/g;
  for (let m; (m = LABEL.exec(src));) {
    const at = m.index + m[0].indexOf(m[1]);
    if (out.some(o => at >= o.index && at < o.end)) continue;
    const no = m[1].replace(/\s+/g, '');
    if (!/\d{4}$/.test(no)) continue;
    const court = courtFromSuitNo(no);
    out.push({ kind: 'suit', raw: m[1], normalised: no, court: court ? { id: court.id, name: court.name } : null, index: at, end: at + m[1].length, labelled: true });
  }
  return out.sort((a, b) => a.index - b.index);
}

/* ---------------- statutes ---------------- */

export const CFRN = 'Constitution of the Federal Republic of Nigeria 1999 (as amended)';

const ACRONYMS = {
  CAMA: ['Companies and Allied Matters Act', null],
  ACJA: ['Administration of Criminal Justice Act', 2015],
  LUA: ['Land Use Act', 1978],
  AMA: ['Arbitration and Mediation Act', 2023],
  NDPA: ['Nigeria Data Protection Act', 2023],
  FCCPA: ['Federal Competition and Consumer Protection Act', 2018],
  CFRN: [CFRN, 1999],
  ISA: ['Investments and Securities Act', null],
  BOFIA: ['Banks and Other Financial Institutions Act', 2020],
};

const STATUTE_TYPES = 'Act|Law|Decree|Edict|Regulations|Ordinance|Code';
const STAT_STOP = /^(?:in|by|under|see|pursuant|to|of|the|and|section|sections|s|ss|also|per|where|whereas|this|that|said|whereby|both|all|any|such|provisions?|relevant|subject|same|principal|an|a|our|its|their|every|each|federal|state|with|from|as|on|is|was|court|learned|counsel|if|for|or|it|he|she|they|these|those|then|when|while|at|no|not|however|further|thus|accordingly|under|contrary|notwithstanding|enforcement|interpretation)$/i;
const NAMED_RE = new RegExp(String.raw`((?:[A-Z][A-Za-z'’-]*|\((?:[A-Z][A-Za-z,.'\s-]*)\))(?:\s+(?:[A-Z][A-Za-z'’-]*|of|and|the|for|on|in|to|&|\((?:[A-Za-z][A-Za-z,.'\s-]*)\)))*?)\s+(${STATUTE_TYPES})\b(?:\s*\((?:No\.?\s*\d+|Amendment)\))?(?:,?\s*(\d{4})\b)?`, 'g');
const CAP_RE = /\bCap(?:ter)?\.?\s*([A-Z]\s?\d{1,3}|\d{1,4}[A-Z]?)\s*,?\s*(?:(?:Vol(?:ume)?\.?\s*\d+\s*,?\s*)?(?:of\s+)?(?:the\s+)?Laws\s+of\s+the\s+Federation\s+of\s+Nigeria|L\.?\s?F\.?\s?N\.?)\s*,?\s*(\d{4})/g;
const CAP_STATE_RE = /\bCap(?:ter)?\.?\s*([A-Z]\s?\d{1,3}|\d{1,4}[A-Z]?)\s*,?\s*(?:Vol(?:ume)?\.?\s*\d+\s*,?\s*)?(?:of\s+)?(?:the\s+)?Laws\s+of\s+((?:[A-Z][a-z]+\s){1,2})State(?:\s+of\s+Nigeria)?\s*,?\s*(\d{4})/g;
const CONST_RE = /\b(?:(?:the\s+)?Constitution\s+of\s+the\s+Federal\s+Republic\s+of\s+Nigeria,?\s*(\d{4})?|(?:the\s+)?(1999|1979|1963)\s+Constitution|CFRN,?\s*(\d{4})?)(?:\s*\((?:as\s+amended|as\s+altered)\))?/g;
const THE_CONST_RE = /\bthe\s+Constitution\b(?!\s+of\s+(?!the\s+Federal))/g;

const statKey = (name) => name.toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

/** Every statute named in the text, merged by name. `mentions` keeps offsets for page lookup. */
export function findStatutes(text) {
  const src = String(text || '');
  const found = [];
  const add = (s) => found.push(s);

  CONST_RE.lastIndex = 0;
  for (let m; (m = CONST_RE.exec(src));) {
    const year = Number(m[1] || m[2] || m[3] || 1999);
    add({ kind: 'constitution', name: year === 1999 ? CFRN : `Constitution of the Federal Republic of Nigeria ${year}`, year, index: m.index, end: m.index + m[0].length });
  }
  THE_CONST_RE.lastIndex = 0;
  for (let m; (m = THE_CONST_RE.exec(src));) {
    if (found.some(f => m.index >= f.index && m.index < f.end)) continue;
    add({ kind: 'constitution', name: CFRN, year: 1999, index: m.index, end: m.index + m[0].length, inferred: true });
  }
  NAMED_RE.lastIndex = 0;
  for (let m; (m = NAMED_RE.exec(src));) {
    if (found.some(f => m.index < f.end && f.index < m.index + m[0].length)) continue;
    const words = m[1].split(/\s+/);
    let skip = 0;
    while (skip < words.length && STAT_STOP.test(words[skip].replace(/[^A-Za-z]/g, ''))) skip++;
    const kept = words.slice(skip);
    if (!kept.length || !/^[A-Z(]/.test(kept[0])) continue;
    if (kept.length === 1 && /^(?:This|The|Such|Said|Principal|Enabling|Parent|Amendment|Criminal|Penal|Civil)$/i.test(kept[0])) continue;
    if (/^(?:Rules?|Order)$/.test(kept[kept.length - 1])) continue;
    const name = `${kept.join(' ')} ${m[2]}`.replace(/\s+/g, ' ');
    if (/^(?:High Court|Court of Appeal|Supreme Court)\b/.test(name)) continue;
    if (/\bCode$/.test(name) && !/(?:Criminal|Penal|Labour|Tax|Civil)/.test(name)) continue;
    const start = m.index + m[0].indexOf(kept[0]);
    add({ kind: 'statute', name, year: m[3] ? Number(m[3]) : null, index: start, end: m.index + m[0].length });
  }
  // Acronyms: CAMA 2020, ACJA, LUA …
  const ACR_RE = new RegExp(`\\b(${Object.keys(ACRONYMS).join('|')})\\b(?:,?\\s*(\\d{4}))?`, 'g');
  for (let m; (m = ACR_RE.exec(src));) {
    if (found.some(f => m.index >= f.index && m.index < f.end)) continue;
    const [name, defYear] = ACRONYMS[m[1]];
    if (m[1] === 'CFRN') { add({ kind: 'constitution', name: CFRN, year: 1999, index: m.index, end: m.index + m[0].length }); continue; }
    add({ kind: 'statute', name, year: m[2] ? Number(m[2]) : defYear, index: m.index, end: m.index + m[0].length, acronym: m[1] });
  }
  // Cap references attach to the statute immediately before them.
  const caps = [];
  CAP_RE.lastIndex = 0;
  for (let m; (m = CAP_RE.exec(src));) caps.push({ cap: `Cap. ${m[1].replace(/\s/g, '')} LFN ${m[2]}`, index: m.index, end: m.index + m[0].length });
  CAP_STATE_RE.lastIndex = 0;
  for (let m; (m = CAP_STATE_RE.exec(src));) caps.push({ cap: `Cap. ${m[1].replace(/\s/g, '')} Laws of ${m[2].trim()} State ${m[3]}`, index: m.index, end: m.index + m[0].length });
  for (const c of caps) {
    const before = found.filter(f => f.end <= c.index && c.index - f.end < 12).pop();
    if (before) { before.cap = c.cap; before.end = c.end; } else add({ kind: 'statute', name: c.cap, cap: c.cap, year: null, index: c.index, end: c.end, capOnly: true });
  }

  // Merge by name; a mention with a year fills in the others.
  // Same name but a different year or a Cap. reference (e.g. CAMA 1990 in LFN 2004 vs CAMA 2020) are different laws.
  const years = new Map();
  const capped = new Set();
  for (const f of found) if (f.kind === 'statute') { const k = statKey(f.name); if (!years.has(k)) years.set(k, new Set()); if (f.year) years.get(k).add(f.year); if (f.cap && !f.year) capped.add(k); }
  const map = new Map();
  for (const f of found.sort((a, b) => a.index - b.index)) {
    let key = f.kind === 'constitution' ? `const:${f.year}` : statKey(f.name);
    if (f.kind === 'statute') {
      const ys = years.get(key);
      if (f.cap && !f.year) key += ':lfn';
      else if (f.year) key += `:${f.year}`;
      else if (ys && ys.size === 1) key += `:${[...ys][0]}`;
      else if (ys && ys.size === 0 && capped.has(key)) key += ':lfn';
    }
    const cur = map.get(key);
    if (!cur) map.set(key, { kind: f.kind, name: f.name, year: f.year, cap: f.cap || null, key, mentions: [{ index: f.index, end: f.end, inferred: !!f.inferred }], acronym: f.acronym || null });
    else {
      cur.mentions.push({ index: f.index, end: f.end, inferred: !!f.inferred });
      if (!cur.year && f.year) cur.year = f.year;
      if (!cur.cap && f.cap) cur.cap = f.cap;
    }
  }
  const list = [...map.values()];
  for (const s of list) {
    if (s.kind === 'statute') {
      s.display = `${s.name}${s.year && !new RegExp(`${s.year}$`).test(s.name) ? ` ${s.year}` : ''}${s.cap ? `, ${s.cap}` : ''}`;
    } else s.display = s.name;
  }
  return list;
}

/* ---------------- sections & articles ---------------- */

const PROV = String.raw`\d{1,3}[A-Z]{0,2}(?:\s*\(\s*[0-9a-z]{1,4}\s*\))*`;
const SECTION_RE = new RegExp(String.raw`\b(?:[Ss]ections?|SECTIONS?|[Ss]s?\.|S\.)\s*(${PROV}(?:\s*(?:,|and|&|to|or|[-–])\s*(?:${PROV}))*)`, 'g');
const ARTICLE_RE = new RegExp(String.raw`\b(?:Articles?|Arts?\.)\s*(${PROV}(?:\s*(?:,|and|&|to)\s*${PROV})*)`, 'g');

const tidyProv = (s) => s.replace(/\s+/g, '').replace(/,/g, ', ').replace(/and/g, ' and ').replace(/to/g, ' to ').replace(/&/g, ' & ').replace(/[-–]/g, '–');

/** Section references, each tied to the statute it belongs to where the text says so. */
export function findProvisions(text, statutes = findStatutes(text)) {
  const src = String(text || '');
  const mentions = statutes.flatMap(s => s.mentions.map(m => ({ ...m, statute: s })));
  const out = [];
  const scan = (re, label) => {
    re.lastIndex = 0;
    for (let m; (m = re.exec(src));) {
      const end = m.index + m[0].length;
      const tail = src.slice(end, end + 140);
      let statute = null, inferred = false;
      const of = tail.match(/^\s*,?\s*(?:of|in|under)\s+(?:the\s+)?/i);
      if (of) {
        const at = end + of[0].length;
        const hit = mentions.find(x => x.index >= at - 4 && x.index <= at + 4);
        if (hit) statute = hit.statute;
        else if (/^(?:said\s+|same\s+|principal\s+)?(?:Act|Law|Decree|Edict)\b/i.test(src.slice(at, at + 20))) {
          const prev = mentions.filter(x => x.index < m.index && x.statute.kind === 'statute').pop();
          if (prev) { statute = prev.statute; inferred = true; }
        }
      }
      out.push({ kind: label, ref: `${label === 'article' ? 'art.' : 's.'} ${tidyProv(m[1])}`, raw: m[0], statute: statute ? statute.key : null, statuteName: statute ? statute.display : null, inferred, index: m.index, end });
    }
  };
  scan(SECTION_RE, 'section');
  scan(ARTICLE_RE, 'article');
  return out.sort((a, b) => a.index - b.index);
}

/* ---------------- rules of court ---------------- */

const RULES_NAME_RE = /\b((?:High\s+Court\s+of\s+(?:the\s+)?(?:[A-Z][A-Za-z]+\s){1,3}(?:State\s|Territory\s)?(?:,?\s*Abuja\s)?|Federal\s+High\s+Court\s|National\s+Industrial\s+Court(?:\s+of\s+Nigeria)?\s|Court\s+of\s+Appeal\s|Supreme\s+Court\s|Fundamental\s+Rights\s|Magistrates'?\s+Courts?\s(?:\([A-Za-z\s]+\)\s)?)(?:\((?:Civil|Criminal|Enforcement)\s+Procedure\)\s)?Rules|Rules\s+of\s+Professional\s+Conduct(?:\s+for\s+Legal\s+Practitioners)?|Sheriffs\s+and\s+Civil\s+Process\s+Rules|Judgment\s+Enforcement\s+Rules|Practice\s+Directions?(?:\s+on\s+[A-Z][A-Za-z\s]{2,40}?)?)(?:,?\s*(\d{4}))?/g;
const ORDER_RE = /\bOrder\s+(\d{1,3}[A-Z]?)\s*,?\s*(?:[Rr]ules?|[Rr]r?\.)\s*(\d{1,3}[A-Z]?(?:\s*\(\s*[0-9a-z]{1,3}\s*\))*(?:\s*(?:,|and|&|to)\s*\d{1,3}[A-Z]?(?:\s*\(\s*[0-9a-z]{1,3}\s*\))*)*)/g;

export function findRules(text) {
  const src = String(text || '');
  const names = [];
  RULES_NAME_RE.lastIndex = 0;
  for (let m; (m = RULES_NAME_RE.exec(src));) {
    const name = oneLine(m[1]).replace(/\s+,/g, ',');
    names.push({ name, year: m[2] ? Number(m[2]) : null, index: m.index, end: m.index + m[0].length });
  }
  const refs = [];
  ORDER_RE.lastIndex = 0;
  for (let m; (m = ORDER_RE.exec(src));) {
    const end = m.index + m[0].length;
    const tail = src.slice(end, end + 30).match(/^\s*,?\s*(?:of|in|under)\s+(?:the\s+)?/i);
    let rules = null;
    if (tail) rules = names.find(n => Math.abs(n.index - (end + tail[0].length)) <= 4) || null;
    refs.push({ kind: 'rule', ref: `Order ${m[1]} r. ${tidyProv(m[2])}`, rules: rules ? `${rules.name}${rules.year ? ` ${rules.year}` : ''}` : null, index: m.index, end });
  }
  const map = new Map();
  for (const n of names) {
    const key = n.name.toLowerCase().replace(/[^a-z]/g, '');
    const cur = map.get(key);
    if (!cur) map.set(key, { kind: 'rules', name: n.name, year: n.year, key, mentions: [{ index: n.index, end: n.end }] });
    else { cur.mentions.push({ index: n.index, end: n.end }); if (!cur.year && n.year) cur.year = n.year; }
  }
  const rules = [...map.values()].map(r => ({ ...r, display: `${r.name}${r.year ? ` ${r.year}` : ''}` }));
  return { rules, refs };
}

/* ---------------- judges ---------------- */

const JUDGE_RE = /\b((?:Hon\.?\s+(?:Justice\s+)?)?(?:[A-Z][A-Za-z'’.-]+|[A-Z]\.)(?:[\s-]+(?:[A-Z][A-Za-z'’.-]+|[A-Z]\.)){0,5}),?\s+(JSC|JCA|CJN|PCA|CJ|FJ|J)\b(?:\s*\((?:Rtd|Retd)\.?\))?/g;
const NOT_JUDGE = /^(?:Per|The|His|Her|Their|Learned|Lordship|Lordships|My|Hon|Justice|Court|Division|Section|Held|See|And|Before|Coram|Delivered|Judgment|Lead|Leading|Appeal|Plaintiff|Defendant|Appellant|Respondent|In|On|By|With|Of|From|Also)$/i;

export function findJudges(text) {
  const src = String(text || '');
  const out = new Map();
  JUDGE_RE.lastIndex = 0;
  for (let m; (m = JUDGE_RE.exec(src));) {
    let name = m[1].replace(/^Hon\.?\s+(?:Justice\s+)?/, '');
    const words = name.split(/\s+/);
    while (words.length && NOT_JUDGE.test(words[0].replace(/[^A-Za-z]/g, ''))) words.shift();
    if (!words.length) continue;
    if (m[2] === 'J' && !/,\s*J$/.test(m[0].replace(/\s*\(.*\)$/, ''))) continue; // "…, J" only with the comma
    name = tidyName(words.join(' '));
    if (name.length < 3) continue;
    const key = `${name.toLowerCase()}|${m[2]}`;
    if (!out.has(key)) out.set(key, { name, title: m[2], display: `${name}, ${m[2]}`, index: m.index, count: 0 });
    out.get(key).count++;
  }
  const list = [...out.values()];
  // "Okoro, JSC" is the same judge as "John Inyang Okoro, JSC".
  for (const j of list) {
    const full = list.find(o => o !== j && o.title === j.title && o.name.length > j.name.length && new RegExp(`(?:^|\\s)${escapeRe(j.name)}$`, 'i').test(o.name));
    if (full) { full.count += j.count; j.merged = true; }
  }
  return list.filter(j => !j.merged);
}

/* ---------------- treatment of a cited case ---------------- */

const TREATMENT = [
  ['overruled', /\b(?:overrul(?:ed|ing)|over-ruled)\b/i],
  ['not followed', /\b(?:not\s+follow(?:ed)?|declin(?:ed|e)\s+to\s+follow|depart(?:ed)?\s+from)\b/i],
  ['distinguished', /\bdistinguish(?:ed|able|ing)?\b/i],
  ['doubted', /\b(?:doubted|questioned)\b/i],
  ['followed', /\b(?:followed|follow|applied|apply|adopted|relied\s+(?:up)?on|approved|affirmed|reaffirmed)\b/i],
  ['referred to', /\b(?:referred\s+to|cited|considered|see)\b/i],
];

export function treatmentAt(text, index) {
  const s = sentences(text.slice(Math.max(0, index - 400), index + 300)).find(x => x.start <= Math.min(400, index) && x.end >= Math.min(400, index));
  const t = s ? s.text : text.slice(Math.max(0, index - 160), index + 80);
  for (const [label, re] of TREATMENT) if (re.test(t)) return label;
  return null;
}

/* ---------------- everything at once ---------------- */

export function parseCitations(text) {
  const src = String(text || '');
  const statutes = findStatutes(src);
  return {
    cases: findCaseCitations(src),
    suits: findSuitNumbers(src),
    statutes,
    provisions: findProvisions(src, statutes),
    ...findRules(src),
    judges: findJudges(src),
  };
}

/** Normalises a single citation string, e.g. what a person types into a research matrix. */
export function normaliseCitation(input) {
  const s = String(input || '');
  const cites = findCaseCitations(s);
  if (cites.length) {
    const c = cites[0];
    return { ok: true, ...c, full: `${c.parties ? `${c.parties.title} ` : ''}${cites.map(x => x.normalised).join('; ')}${c.pinpoint ? ` at ${c.pinpoint.text}` : ''}`, parallel: cites.slice(1).map(x => x.normalised) };
  }
  const suit = findSuitNumbers(s)[0];
  if (suit) return { ok: true, kind: 'suit', normalised: suit.normalised, court: suit.court, full: suit.normalised };
  const st = findStatutes(s)[0];
  if (st) return { ok: true, kind: st.kind, normalised: st.display, full: st.display };
  return { ok: false, normalised: oneLine(s), full: oneLine(s) };
}
