/* ============================================================
   Legal engine — judgment structure (DOM-free)

   Reads a judgment and pulls out its parts: court, parties,
   appeal/suit number, date, coram and the lead judgment, facts,
   issues for determination (with how each was resolved),
   arguments of counsel, holdings, candidate ratio decidendi,
   obiter dicta, orders and counsel. Every item keeps the page it
   came from when the text has page markers.

   It works from headings where the judgment has them and from
   the usual cue phrases of Nigerian judgments where it does not.
   Ratio and obiter are candidates for a lawyer to confirm.
   ============================================================ */

import { detectCourt, courtFromSuitNo, COURTS } from './courts.js';
import { findCaseCitations, findSuitNumbers, findJudges } from './citations.js';
import { buildAuthorities, authoritiesMarkdown } from './authorities.js';
import { normaliseText, pageMap, sentences, oneLine, clip, findDates, formatDate, tidyName, parseNumberWord, stripPageMarks } from './text.js';

const HEADINGS = [
  ['facts', /^(?:(?:the\s+)?(?:brief|summary\s+of(?:\s+the)?|statement\s+of(?:\s+the)?)\s+)?(?:facts?|background(?:\s+facts)?)(?:\s+of\s+the\s+case)?(?:\s+leading\s+to\s+(?:this|the)\s+appeal)?$/i],
  ['issues', /^(?:the\s+)?issues?\s+(?:for\s+determination|arising|formulated|for\s+resolution)|^(?:the\s+)?issues?$|^issues?\s+in\s+(?:the|this)\s+appeal$/i],
  ['arguments', /^(?:the\s+)?(?:arguments?|submissions?)(?:\s+of\s+(?:learned\s+)?counsel|\s+of\s+the\s+parties)?$|^(?:appellant'?s?|respondent'?s?)\s+(?:arguments?|submissions?|case)$/i],
  ['resolution', /^(?:resolution|determination|consideration)(?:\s+of\s+(?:the\s+)?issues?.*)?$|^(?:resolution|determination)\s+of\s+issue.*$|^issue\s+(?:no\.?\s*)?(?:\d+|one|two|three|four|five)\b.*$|^(?:court'?s\s+)?(?:decision|findings)\s+on\s+.*$/i],
  ['conclusion', /^(?:conclusion|decision|orders?|disposition|final\s+orders?)$/i],
  ['counsel', /^(?:counsel|appearances?|representation)\s*:?$/i],
];

const OUTCOME = [
  ['partly allowed', /\b(?:appeal|application|claim|petition)\s+(?:is\s+|succeeds\s+)?(?:hereby\s+)?(?:allowed|succeeds)\s+in\s+part\b|\bpartially\s+(?:allowed|succeeds)\b/i],
  ['struck out', /\b(?:appeal|application|suit|petition|action)\s+(?:is|are|be|was)?\s*(?:hereby\s+)?struck\s+out\b/i],
  ['allowed', /\b(?:appeal|application|claim|petition|cross-appeal)\s+(?:is|be|was)?\s*(?:hereby\s+)?(?:allowed|upheld)\b|\b(?:appeal|application)\s+(?:has\s+merit|succeeds)\b/i],
  ['dismissed', /\b(?:appeal|application|claim|suit|petition|action)\s+(?:is|be|was|are)?\s*(?:hereby\s+)?dismissed\b|\b(?:appeal|application)\s+(?:lacks\s+merit|fails|is\s+devoid\s+of\s+merit|is\s+unmeritorious)\b/i],
];

const RATIO_CUE = /\b(?:it\s+is\s+(?:(?:now\s+)?(?:well\s+)?settled|trite|elementary|firmly\s+established|the\s+law)|the\s+law\s+is\s+(?:(?:now\s+)?(?:well\s+)?settled|trite|that)|(?:it\s+is\s+)?settled\s+(?:law|principle|position)|the\s+(?:settled\s+)?position\s+of\s+(?:the\s+)?law|as\s+a\s+general\s+rule|the\s+law\s+does\s+not|the\s+principle\s+(?:of\s+law\s+)?is|a\s+court\s+(?:cannot|must|has\s+no)|where\s+a\s+(?:party|mortgage|contract|statute|court)[^.]{5,160}?(?:cannot|must|is\s+(?:void|inoperative)|shall))\b/i;
const HOLD_CUE = /\b(?:I|we)\s+(?:therefore\s+|accordingly\s+|hereby\s+)?(?:hold|find|agree\s+with\s+the\s+(?:appellant|respondent))\b|\bit\s+is\s+(?:my|our)\s+(?:view|finding|holding)\b/i;
const OBITER_CUE = /\b(?:in\s+passing|obiter|by\s+the\s+way|for\s+the\s+avoidance\s+of\s+doubt|even\s+if\s+(?:I|we)\s+(?:had|were)|had\s+(?:I|it\s+been\s+necessary)|I\s+(?:must|should|would)\s+(?:observe|remark|add|note)|I\s+observe|before\s+I\s+(?:conclude|end|leave|draw\s+the\s+curtain)|it\s+is\s+(?:pertinent|necessary|important)\s+to\s+(?:observe|note|remark)|I\s+wish\s+to\s+(?:observe|add)|(?:not|was\s+not)\s+(?:the\s+)?issue\s+before)\b/i;
const ORDER_CUE = /\b(?:it\s+is\s+(?:hereby\s+)?(?:declared|ordered)|(?:is|are)\s+hereby\s+(?:set\s+aside|declared|restrained|ordered|awarded|remitted|affirmed)|costs?\s+of\s+(?:N|₦|NGN)\s?[\d,]+|(?:is|be)\s+set\s+aside|remitted\s+(?:back\s+)?to|retrial|(?:shall|to)\s+(?:render|pay|deliver|vacate)\b|an\s+order\s+(?:of|restraining|directing|setting)|perpetual\s+injunction)\b/i;
const ARG_CUE = /\b(?:learned\s+(?:senior\s+)?counsel|counsel)\s+for\s+the\s+(\d(?:st|nd|rd|th)\s+)?(appellants?|respondents?|claimants?|plaintiffs?|defendants?|applicants?|petitioners?)\b[^.]{0,120}?\b(?:argued|submitted|contended|urged|maintained|posited|canvassed|relied|referred|cited|stated)\b|\b(?:it\s+was|he|she|they)\s+(?:further\s+)?(?:argued|submitted|contended|urged)\b/i;
const ROLE_RE = /(appellants?|respondents?|cross[-\s]appellants?|claimants?|plaintiffs?|defendants?|applicants?|petitioners?|accused|complainants?|prosecution|appellant\/respondent|respondent\/appellant)/i;

const sideOf = (role) => {
  const r = String(role || '').toLowerCase();
  if (/appellant\/respondent/.test(r)) return 'a';
  if (/respondent\/appellant/.test(r)) return 'b';
  if (/cross/.test(r)) return 'a';
  if (/appellant|claimant|plaintiff|applicant|petitioner|prosecution|complainant/.test(r)) return 'a';
  if (/respondent|defendant|accused/.test(r)) return 'b';
  return null;
};

/* ---------------- parties ---------------- */

function findParties(text) {
  const head = text.slice(0, 5000);
  const b = head.search(/\bBETWEEN\s*:?/i);
  const lines = (b >= 0 ? head.slice(b).replace(/^BETWEEN\s*:?/i, '') : head).split('\n').map(l => l.trim()).filter(Boolean);
  const out = { a: [], b: [], roleA: null, roleB: null };
  let pending = [];
  for (const line of lines.slice(0, 30)) {
    if (/^(?:JUDGMENT|RULING|LEAD\s+JUDGMENT|\(DELIVERED)/i.test(line)) break;
    if (/^AND\s*:?$/i.test(line) || /^(?:-+|v(?:s)?\.?)$/i.test(line)) continue;
    const m = line.match(new RegExp(`^(.*?)[\\s.…_:-]*\\b(${ROLE_RE.source.slice(1, -1)})\\s*(?:\\/\\s*(?:${ROLE_RE.source.slice(1, -1)}))?\\s*$`, 'i'));
    if (m) {
      const names = [...pending, m[1]].map(n => n.replace(/^\d+[.)]\s*/, '').replace(/[.…_\s-]+$/, '').trim()).filter(n => n && !/^AND$/i.test(n));
      const side = sideOf(line.match(/(appellant\/respondent|respondent\/appellant)/i)?.[1] || m[2]);
      if (side === 'a') { out.a.push(...names); out.roleA = out.roleA || m[2].toUpperCase(); }
      else if (side === 'b') { out.b.push(...names); out.roleB = out.roleB || m[2].toUpperCase(); }
      pending = [];
    } else if (/^\d+[.)]\s*\S|^[A-Z][A-Z .,'&()-]{3,}$|(?:LTD|PLC|LIMITED|NIG)/.test(line) && line.length < 120) {
      pending.push(line);
    } else if (out.a.length && out.b.length) break;
  }
  if (out.a.length && out.b.length) {
    const nm = (list) => `${tidyName(list[0])}${list.length === 2 ? ' & Anor.' : list.length > 2 ? ' & Ors.' : ''}`;
    return { a: out.a.map(tidyName), b: out.b.map(tidyName), roleA: out.roleA, roleB: out.roleB, title: `${nm(out.a)} v. ${nm(out.b)}`, source: 'heading' };
  }
  // Fallback: a "X v. Y" title line at the top.
  const t = head.split('\n').slice(0, 12).map(l => l.trim()).find(l => /\s(?:v|vs)\.?\s/i.test(l) && l.length < 160);
  if (t) {
    const [x, y] = t.split(/\s+(?:v|vs|V|VS)\.?\s+/);
    return { a: [tidyName(x)], b: [tidyName(y)], roleA: null, roleB: null, title: tidyName(`${x} v. ${y}`), source: 'title line' };
  }
  return null;
}

/* ---------------- sections ---------------- */

function splitSections(text) {
  const out = [];
  const re = /^[ \t]*([A-Z][^\n]{2,80})[ \t]*$/gm;
  for (let m; (m = re.exec(text));) {
    const line = m[1].trim().replace(/[:.]+$/, '');
    const letters = line.replace(/[^A-Za-z]/g, '');
    const upper = letters && letters === letters.toUpperCase();
    if (!upper && !/:$/.test(m[1].trim()) && line.split(/\s+/).length > 7) continue;
    for (const [kind, rx] of HEADINGS) {
      if (rx.test(line)) { out.push({ kind, heading: line, index: m.index, bodyStart: m.index + m[0].length }); break; }
    }
  }
  for (let i = 0; i < out.length; i++) out[i].end = i + 1 < out.length ? out[i + 1].index : text.length;
  return out;
}

/* ---------------- main ---------------- */

export function extractJudgment(input, opts = {}) {
  const text = normaliseText(input);
  const pages = pageMap(text);
  const pg = (i) => (pages ? pages.at(i) : null);
  const item = (t, index, source = 'cue', extra = {}) => ({ text: oneLine(stripPageMarks(t)), page: pg(index), index, source, ...extra });
  const sents = sentences(text);

  /* header */
  const bodyStart = Math.max(0, text.search(/^\s*(?:(?:LEAD\s+)?JUDGMENT|RULING)\b/im));
  const headEnd = bodyStart > 0 ? bodyStart : Math.min(text.length, 1800);
  const head = text.slice(0, Math.max(headEnd, 400));
  const court = detectCourt(text);
  const suits = findSuitNumbers(text);
  const ownSuit = suits.find(s => s.index < headEnd + 200) || null;
  if (court && ownSuit && !court.source) court.source = 'heading';
  const deciding = court || (ownSuit ? { ...courtFromSuitNo(ownSuit.normalised), source: 'suit number' } : null);
  const lower = suits.filter(s => s !== ownSuit).map(s => ({ ...s, page: pg(s.index) }));

  let date = null;
  const dm = head.match(/\b(?:ON|DELIVERED\s+ON|DATE(?:D)?|DATE\s+OF\s+JUDGMENT)\b[^\n]{0,40}?((?:\d{1,2}(?:ST|ND|RD|TH)?\s+DAY\s+OF\s+[A-Z]+,?\s+\d{4})|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i)
    || text.match(/\b(?:judgment|ruling)\s+(?:was\s+)?delivered\s+on\s+(?:[A-Za-z]+,?\s+)?(?:the\s+)?([^\n.]{6,40}?\d{4})/i);
  if (dm) { const d = findDates(dm[1])[0]; if (d) date = { iso: d.date, text: formatDate(d.date), raw: dm[1] }; }

  const judgesAll = findJudges(text);
  const coramRegion = head;
  const coram = judgesAll.filter(j => j.index < coramRegion.length + 50 && j.title !== 'J' || (j.index < coramRegion.length && /\bBEFORE|CORAM/i.test(coramRegion)));
  let lead = null;
  const lm = text.match(/\(\s*Delivered\s+by\s+([^)]+?)\)|\bDelivered\s+by\s*:?\s*([A-Z][^\n]{3,80})|([A-Z][A-Za-z .'-]{3,60}),?\s*(?:JSC|JCA|J)\s*\(?\s*(?:delivering|who\s+delivered)\s+the\s+lead(?:ing)?\s+judgment/i);
  if (lm) lead = tidyName(oneLine(lm[1] || lm[2] || lm[3]).replace(/\s*,\s*(JSC|JCA|J|CJN|PCA)\.?$/i, ', $1'));
  const parties = findParties(text);

  const ownCites = findCaseCitations(head).filter(c => !c.parties);
  const selfCitation = ownCites.map(c => c.normalised);

  /* sections */
  const secs = splitSections(text);
  const secText = (kind) => secs.filter(s => s.kind === kind).map(s => ({ text: text.slice(s.bodyStart, s.end), start: s.bodyStart, end: s.end }));
  const inKind = (kind, i) => secs.some(s => s.kind === kind && i >= s.bodyStart && i < s.end);

  /* facts */
  let facts = [];
  const fsec = secText('facts');
  if (fsec.length) {
    for (const f of fsec) {
      for (const para of splitParas(f.text, f.start)) facts.push(item(para.text, para.start, 'heading'));
    }
  } else {
    const cue = sents.find(s => /\b(?:the\s+(?:brief\s+)?facts?\s+(?:of\s+(?:this|the)\s+case|leading\s+to\s+(?:this|the)\s+appeal|giving\s+rise|are|is)|briefly\s+stated|the\s+background\s+(?:to|of))\b/i.test(s.text));
    if (cue) {
      const paras = splitParas(text.slice(cue.start, cue.start + 2600), cue.start).slice(0, 2);
      facts = paras.map(p => item(p.text, p.start));
    }
  }
  facts = facts.filter(f => f.text.length > 20).slice(0, 6);

  /* issues */
  let issues = [];
  const isec = secText('issues');
  const pushIssue = (t, at, src) => {
    const clean = oneLine(t).replace(/^(?:issue\s+(?:no\.?\s*)?\d+\s*[:.-]\s*|\(?\d+[.)]\s*|\(?[ivx]+[.)]\s*)/i, '');
    if (clean.length < 15 || issues.some(x => x.text === clean)) return;
    issues.push(item(clean, at, src));
  };
  for (const s of isec) {
    const list = [...s.text.matchAll(/(?:^|\n)\s*(?:\(?(?:\d{1,2}|[ivx]{1,4})[.)]|Issue\s+(?:No\.?\s*)?\d+\s*[:.-])\s*([^\n]+(?:\n(?!\s*(?:\(?(?:\d{1,2}|[ivx]{1,4})[.)]|Issue\s+|\n))[^\n]+)*)/gi)];
    for (const m of list) pushIssue(m[1], s.start + m.index, 'heading');
    if (!list.length) for (const w of sentences(s.text).filter(x => /^whether\b/i.test(x.text))) pushIssue(w.text, s.start + w.start, 'heading');
  }
  if (!issues.length) {
    for (const s of sents) if (/^(?:\(?\d{1,2}[.)]\s*|\(?[ivx]{1,4}[.)]\s*)?Whether\b/.test(s.text) && s.text.length < 600) pushIssue(s.text, s.start, 'cue');
  }
  issues = issues.slice(0, 10);
  // How each issue was resolved.
  for (const m of text.matchAll(/\bissue\s+(?:no\.?\s*)?(\d+|one|two|three|four|five|six)\s+(?:is|was|are)\s+(?:hereby\s+|accordingly\s+|therefore\s+)?resolved\s+(?:in\s+favou?r\s+of|against)\s+the\s+([a-z0-9 ]{0,12}?(?:appellants?|respondents?|claimants?|plaintiffs?|defendants?|applicants?|petitioners?))/gi)) {
    const n = parseNumberWord(m[1]);
    const against = /against/i.test(m[0]);
    const iss = issues[n - 1];
    if (iss) { iss.resolution = `${against ? 'Resolved against' : 'Resolved in favour of'} the ${m[2].trim()}`; iss.resolutionPage = pg(m.index); iss.favours = against ? (sideOf(m[2]) === 'a' ? 'b' : 'a') : sideOf(m[2]); }
  }

  /* arguments */
  const args = { a: [], b: [], other: [] };
  const asec = secText('arguments');
  const argSource = asec.length ? asec.flatMap(s => splitParas(s.text, s.start)) : sents.filter(s => ARG_CUE.test(s.text)).map(s => ({ text: s.text, start: s.start }));
  let lastSide = null;
  for (const p of argSource) {
    const m = p.text.match(/counsel\s+for\s+the\s+(?:\d(?:st|nd|rd|th)\s+)?(appellants?|respondents?|claimants?|plaintiffs?|defendants?|applicants?|petitioners?)/i) || p.text.match(/^(?:the\s+)?(appellant|respondent|claimant|plaintiff|defendant)'?s?\s+(?:counsel|submission|argument)/i);
    const side = m ? sideOf(m[1]) : lastSide;
    lastSide = side;
    const target = side === 'a' ? args.a : side === 'b' ? args.b : args.other;
    if (target.length < 6 && p.text.length > 25) target.push(item(p.text.length > 700 ? clip(p.text, 700) : p.text, p.start, asec.length ? 'heading' : 'cue'));
  }

  /* holdings, ratio, obiter, orders */
  const concl = secText('conclusion');
  const holdings = [];
  const ratio = [];
  const obiter = [];
  const orders = [];
  let outcome = null;
  // Numbered orders after "the following orders" are taken as a list.
  const fo = text.match(/following\s+(?:consequential\s+)?orders?\s*:?\s*\n([\s\S]{0,2500}?)(?=\n\s*\n(?!\s*\(?\d)|$)/i);
  const foRange = fo ? [fo.index, fo.index + fo[0].length] : null;
  if (fo) {
    const base = fo.index + fo[0].indexOf(fo[1]);
    for (const m of fo[1].matchAll(/(?:^|\n)\s*(?:\(?(?:\d{1,2}|[a-z]|[ivx]{1,4})[.)])\s*([^\n]+)/g)) orders.push(item(m[1], base + m.index, 'heading'));
  }
  for (const s of sents) {
    const t = s.text;
    if (t.length > 900) continue;
    const inArgs = inKind('arguments', s.start) || ARG_CUE.test(t);
    if (!outcome) for (const [label, re] of OUTCOME) if (re.test(t) && !inArgs && !/\bcourt\s+of\s+appeal\s+(?:was\s+)?(?:right|wrong)\b/i.test(t)) { outcome = { label, text: oneLine(stripPageMarks(t)), page: pg(s.start) }; break; }
    if (inArgs) continue;
    if (OBITER_CUE.test(t)) { obiter.push(item(t, s.start)); continue; }
    if (HOLD_CUE.test(t)) holdings.push(item(t, s.start));
    if (RATIO_CUE.test(t) && !/^\s*(?:see|per)\b/i.test(t)) ratio.push(item(t, s.start, 'cue', { inResolution: inKind('resolution', s.start) || !secs.length }));
    if (foRange && s.start >= foRange[0] - 5 && s.start < foRange[1]) continue;
    if (ORDER_CUE.test(t) || (concl.length && inKind('conclusion', s.start) && /\b(?:order|declar|award|set\s+aside|costs?)\b/i.test(t))) orders.push(item(t, s.start));
  }
  // Keep order text that only restates the outcome once.
  const ratioRanked = ratio.sort((x, y) => Number(y.inResolution) - Number(x.inResolution)).slice(0, 6);

  /* dissent / concurring */
  const concurring = [];
  for (const m of text.matchAll(/(?:^|\n)\s*([A-Z][A-Z .'-]{3,60}),\s*(JSC|JCA|J)\s*:\s*([^\n]{0,300})/g)) {
    const view = /\b(?:dissent|disagree|would\s+dismiss|would\s+allow)\b/i.test(m[3]) ? 'dissenting' : /\bagree\b/i.test(m[3]) ? 'concurring' : 'separate opinion';
    concurring.push({ judge: `${tidyName(m[1])}, ${m[2]}`, view, page: pg(m.index) });
  }

  /* counsel */
  const counsel = [];
  const csec = secText('counsel');
  const counselSrc = csec.length ? csec.map(s => s.text).join('\n') : text.slice(-2500);
  for (const m of counselSrc.matchAll(/^[ \t]*([^\n]{3,160}?)\s+for\s+the\s+((?:\d(?:st|nd|rd|th)\s+)?(?:appellants?|respondents?|claimants?|plaintiffs?|defendants?|applicants?|petitioners?|prosecution)(?:\/[a-z]+)?)\.?\s*$/gim)) {
    counsel.push({ name: oneLine(m[1]), for: m[2].replace(/^./, c => c.toUpperCase()) });
  }

  /* timeline */
  const seen = new Set();
  const timeline = [];
  for (const d of findDates(text)) {
    if (seen.has(d.date)) continue;
    seen.add(d.date);
    const s = sents.find(x => x.start <= d.index && x.end >= d.end);
    timeline.push({ date: d.date, dateText: formatDate(d.date), context: s ? clip(s.text, 200) : '', page: pg(d.index) });
  }
  timeline.sort((a, b) => a.date.localeCompare(b.date));

  /* authorities */
  const toa = buildAuthorities(text, { selfCourt: deciding, forum: opts.forum });

  const digest = {
    title: parties?.title || (ownSuit ? `Suit/Appeal ${ownSuit.normalised}` : 'Untitled judgment'),
    parties,
    court: deciding ? { id: deciding.id, name: deciding.name, short: deciding.short, level: deciding.level, division: deciding.division || null, seat: deciding.seat || null, state: deciding.state || null, source: deciding.source || 'heading' } : null,
    suitNo: ownSuit?.normalised || null,
    lowerCourtNumbers: lower.map(s => ({ normalised: s.normalised, court: s.court, page: s.page })),
    date, lead, coram: coram.map(j => j.display), selfCitation,
    facts, issues, arguments: args, holdings: dedupe(holdings).slice(0, 8), ratio: dedupe(ratioRanked), obiter: dedupe(obiter).slice(0, 6), orders: dedupe(orders.sort((x, y) => x.index - y.index)).slice(0, 10),
    outcome, concurring, counsel, timeline: timeline.slice(0, 14), authorities: toa,
    hasPages: Boolean(pages), pages: pages?.pages || null,
    structured: secs.length > 0,
  };
  digest.citation = citationFor(digest);
  return digest;
}

function dedupe(list) {
  const seen = new Set();
  return list.filter(x => { const k = x.text.slice(0, 80); if (seen.has(k)) return false; seen.add(k); return true; });
}

function splitParas(text, base) {
  const out = [];
  const re = /(?:^|\n\s*\n|\n(?=\s*\[Page \d+\]))/g;
  let last = 0;
  const parts = [];
  for (let m; (m = re.exec(text));) { if (m.index > last) parts.push([last, m.index]); last = m.index + m[0].length; if (m[0] === '') re.lastIndex++; }
  if (last < text.length) parts.push([last, text.length]);
  for (const [s, e] of parts) {
    const raw = text.slice(s, e);
    const t = stripPageMarks(raw).trim();
    if (t) out.push({ text: t.replace(/\s*\n\s*/g, ' '), start: base + s + (raw.length - raw.trimStart().length) });
  }
  return out;
}

/** Copyable citation built only from what the judgment itself shows. */
export function citationFor(d) {
  const title = d.parties?.title || d.title;
  if (d.selfCitation?.length) return `${title} ${d.selfCitation.join('; ')}`;
  const bits = [title];
  if (d.suitNo) bits.push(`(${/^SC|^CA/.test(d.suitNo) ? 'Appeal' : 'Suit'} No. ${d.suitNo})`);
  const tail = [d.court?.short || d.court?.name, d.date?.text].filter(Boolean).join(', ');
  return `${bits.join(' ')}${tail ? `, ${tail}` : ''}`;
}

/* ---------------- export ---------------- */

const pgs = (p) => (p ? ` (p. ${p})` : '');

export function digestMarkdown(d, { authorities = true } = {}) {
  const L = [];
  L.push(`# ${d.title}`, '');
  const meta = [
    d.court && `**Court:** ${d.court.name}${d.court.division ? `, ${d.court.division} Division` : ''}`,
    d.suitNo && `**Appeal/Suit No.:** ${d.suitNo}`,
    d.date && `**Delivered:** ${d.date.text}`,
    d.lead && `**Lead judgment:** ${d.lead}`,
    d.coram.length && `**Coram:** ${d.coram.join('; ')}`,
    d.outcome && `**Outcome:** ${d.outcome.label.replace(/^./, c => c.toUpperCase())}`,
  ].filter(Boolean);
  L.push(...meta.map(m => `${m}  `), '', `**Citation:** ${d.citation}`, '');
  const sec = (h, list, numbered = false) => {
    if (!list?.length) return;
    L.push(`## ${h}`, '');
    list.forEach((x, i) => L.push(`${numbered ? `${i + 1}.` : '-'} ${x.text}${pgs(x.page)}${x.resolution ? ` — *${x.resolution}*` : ''}`));
    L.push('');
  };
  sec('Facts', d.facts);
  sec('Issues for determination', d.issues, true);
  if (d.arguments.a.length || d.arguments.b.length) {
    L.push('## Arguments', '');
    if (d.arguments.a.length) { L.push(`**${d.parties?.roleA ? cap(d.parties.roleA) : 'Appellant / claimant'}**`, ''); d.arguments.a.forEach(x => L.push(`- ${x.text}${pgs(x.page)}`)); L.push(''); }
    if (d.arguments.b.length) { L.push(`**${d.parties?.roleB ? cap(d.parties.roleB) : 'Respondent / defendant'}**`, ''); d.arguments.b.forEach(x => L.push(`- ${x.text}${pgs(x.page)}`)); L.push(''); }
  }
  sec('Holding', d.holdings);
  sec('Ratio decidendi (candidates, confirm against the judgment)', d.ratio);
  sec('Obiter dicta (candidates)', d.obiter);
  sec('Orders', d.orders);
  if (authorities) L.push(authoritiesMarkdown(d.authorities, { heading: '## Table of authorities' }));
  L.push('', '---', '*Prepared on-device by pattern matching. Check every extract, page reference and citation against the certified copy of the judgment before relying on it.*');
  return L.join('\n');
}

const cap = (s) => String(s).toLowerCase().replace(/^./, c => c.toUpperCase());

export { COURTS };
