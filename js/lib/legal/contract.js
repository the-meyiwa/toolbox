/* ============================================================
   Legal engine — contract analysis (DOM-free)

   Splits an agreement into its parts (title, parties, recitals,
   numbered clauses, execution block, schedules), classifies each
   clause, lists defined terms, parties and obligations, checks
   execution, and raises risk flags a Nigerian practitioner would
   look for: missing clauses, one-sided indemnities, uncapped
   liability, automatic renewal, unilateral termination or
   variation, foreign governing law, incomplete arbitration
   clauses, blanks, and stamp duty / registration reminders.

   Flags are prompts for review, not legal conclusions.
   ============================================================ */

import { normaliseText, pageMap, sentences, oneLine, clip, findDates, formatDate, isBreakLine, parseNumberWord } from './text.js';
import { findAnchors, extractObligations } from './obligations.js';
import { findStatutes } from './citations.js';

/* ---------------- clause types ---------------- */

export const CLAUSE_TYPES = {
  parties:       { label: 'Parties', h: /\bparties\b/i },
  recitals:      { label: 'Recitals', h: /\brecitals?\b|\bwhereas\b|\bbackground\b/i },
  definitions:   { label: 'Definitions', h: /\bdefinitions?\b|\binterpretation\b/i, b: /"[^"]{2,40}"\s+(?:means|shall\s+mean|includes)/i },
  term:          { label: 'Term & commencement', h: /\bterm\b|\bduration\b|\bcommencement\b|\bperiod\s+of\s+(?:the\s+)?(?:agreement|tenancy|lease)\b/i, b: /\bfor\s+a\s+(?:term|period)\s+of\b|\bshall\s+commence\b|\bshall\s+continue\s+for\b/i },
  renewal:       { label: 'Renewal', h: /\brenewal\b|\boption\s+to\s+renew\b/i, b: /\brenew(?:ed|al)?\b/i },
  payment:       { label: 'Price & payment', h: /\bpayment\b|\bprice\b|\bfees?\b|\bconsideration\b|\bcharges\b|\binvoic|\bremuneration\b|\bsalary\b|\bcompensation\b/i, b: /(?:₦|\bN|\bNGN|US\$|\bUSD|\$)\s?\d[\d,]*(?:\.\d+)?|\bshall\s+pay\b|\binvoice\b/i },
  rent:          { label: 'Rent', h: /\brent\b|\brental\b/i, b: /\brent\b/i },
  deposit:       { label: 'Deposit', h: /\bdeposit\b|\bcaution\b/i, b: /\bcaution\s+(?:fee|deposit)\b|\bsecurity\s+deposit\b/i },
  serviceCharge: { label: 'Service charge & outgoings', h: /\bservice\s+charge\b|\butilities\b|\boutgoings\b/i, b: /\bservice\s+charge\b/i },
  use:           { label: 'Use of premises', h: /\buse\s+of\s+(?:the\s+)?premises\b|\bpermitted\s+use\b|\buser\b/i, b: /\buse\s+the\s+premises\b|\bresidential\s+purposes?\b|\bcommercial\s+purposes?\b/i },
  repairs:       { label: 'Repairs & maintenance', h: /\brepairs?\b|\bmaintenance\b|\bdilapidation/i, b: /\bgood\s+and\s+tenantable\s+repair\b|\bkeep\b[^.]{0,40}\brepair\b|\bmaintain\b/i },
  quiet:         { label: 'Quiet enjoyment', h: /\bquiet\s+enjoyment\b|\blandlord'?s\s+covenants?\b/i, b: /\bquietly\s+(?:hold|enjoy)|\bpeaceably\s+hold\s+and\s+enjoy\b/i },
  delivery:      { label: 'Delivery', h: /\bdeliver(?:y|ies)\b|\bsupply\s+of\s+goods\b/i, b: /\bshall\s+deliver\b|\bdelivery\s+date\b|\bincoterms\b|\b(?:EXW|FOB|CIF|DAP|DDP)\b/ },
  acceptance:    { label: 'Inspection & acceptance', h: /\bacceptance\b|\binspection\b|\brejection\b/i, b: /\binspect\b[^.]{0,60}\bgoods\b|\breject(?:ed|ion)?\b[^.]{0,40}\bgoods\b/i },
  title:         { label: 'Title & risk', h: /\btitle\b|\brisk\b/i, b: /\btitle\s+(?:to|in)\s+the\s+goods\b|\brisk\s+(?:in|of\s+loss)\b/i },
  warranties:    { label: 'Warranties', h: /\bwarrant(?:y|ies)\b|\brepresentations?\b/i, b: /\brepresents\s+and\s+warrants\b|\bwarrants\s+that\b/i },
  indemnity:     { label: 'Indemnity', h: /\bindemn/i, b: /\bindemnif(?:y|ies)\b|\bhold\s+harmless\b|\bkeep\b[^.]{0,20}\bindemnified\b/i },
  liability:     { label: 'Limitation of liability', h: /\blimitation\s+of\s+liability\b|\bliability\b|\bexclusion/i, b: /\bshall\s+not\s+be\s+liable\b|\bliability\b[^.]{0,60}\b(?:limited|shall\s+not\s+exceed|capped)\b|\bconsequential\s+loss\b/i },
  insurance:     { label: 'Insurance', h: /\binsurance\b/i, b: /\binsure\b|\binsurance\s+policy\b/i },
  confidentiality: { label: 'Confidentiality', h: /\bconfidential|\bnon-?disclosure\b/i, b: /\bconfidential\s+information\b/i },
  ip:            { label: 'Intellectual property', h: /\bintellectual\s+property\b|\bI\.?P\.?\s+rights\b|\blicen[cs]e\b|\bownership\s+of\s+(?:work|materials|deliverables)\b/i, b: /\bcopyright\b|\btrade\s?marks?\b|\bpatents?\b|\bintellectual\s+property\b/i },
  data:          { label: 'Data protection', h: /\bdata\s+protection\b|\bprivacy\b|\bpersonal\s+data\b/i, b: /\bpersonal\s+data\b|\bNigeria\s+Data\s+Protection\b|\bNDPA\b/i },
  nonCompete:    { label: 'Restrictive covenants', h: /\bnon-?compet|\brestraint\b|\bnon-?solicit|\bexclusivity\b/i, b: /\bshall\s+not\b[^.]{0,50}\b(?:compete|solicit)\b|\brestraint\s+of\s+trade\b/i },
  covenants:     { label: 'Covenants', h: /\bcovenants?\b|\bobligations\s+of\b|\bundertakings\b|\bresponsibilities\b/i },
  termination:   { label: 'Termination', h: /\bterminat|\bdetermination\b|\bnotice\s+to\s+quit\b|\bforfeiture\b|\bre-?entry\b|\bevents?\s+of\s+default\b/i, b: /\bterminate\s+this\b|\bmay\s+terminate\b|\bnotice\s+to\s+quit\b|\bre-?enter\b/i },
  forceMajeure:  { label: 'Force majeure', h: /\bforce\s+majeure\b|\bact\s+of\s+god\b/i, b: /\bforce\s+majeure\b|\bact(?:s)?\s+of\s+god\b|\bbeyond\s+(?:the\s+|its\s+)?(?:reasonable\s+)?control\b/i },
  assignment:    { label: 'Assignment & subletting', h: /\bassignment\b|\bsub-?(?:let|lease|contract)|\btransfer\b/i, b: /\bassign\b|\bsublet\b|\bunderlet\b|\bpart\s+with\s+(?:the\s+)?possession\b/i },
  notices:       { label: 'Notices', h: /^(?:notices?|service\s+of\s+notices?)$|\bnotices\b/i, b: /\bnotice\b[^.]{0,80}\b(?:in\s+writing|delivered\s+by\s+hand|registered\s+post|courier|e-?mail)\b/i },
  governing:     { label: 'Governing law', h: /\bgoverning\s+law\b|\bapplicable\s+law\b|\blaw\s+of\s+the\s+(?:contract|agreement)\b|\bjurisdiction\b/i, b: /\bgoverned\s+by\b|\bconstrued\s+in\s+accordance\s+with\s+the\s+laws?\b/i },
  dispute:       { label: 'Dispute resolution', h: /\bdisputes?\b|\barbitration\b|\bmediation\b|\bsettlement\s+of\s+disputes\b/i, b: /\barbitrat|\bmediat|\bamicabl[ey]\b|\bdisputes?\s+(?:shall|arising)\b/i },
  tax:           { label: 'Tax & stamp duty', h: /\btax(?:es|ation)?\b|\bVAT\b|\bwithholding\b|\bstamp\s+dut/i, b: /\bwithholding\s+tax\b|\bvalue\s+added\s+tax\b|\bVAT\b|\bstamp\s+dut(?:y|ies)\b/ },
  antiBribery:   { label: 'Anti-bribery & compliance', h: /\banti-?bribery\b|\bcorruption\b|\bcompliance\b/i, b: /\bbribe|\bcorrupt/i },
  boilerplate:   { label: 'General provisions', h: /\bentire\s+agreement\b|\bseverab|\bwaiver\b|\bvariation\b|\bamendment\b|\bcounterparts?\b|\bfurther\s+assurance\b|\bmiscellaneous\b|\bgeneral\b|\brelationship\s+of\s+the\s+parties\b|\bthird\s+part(?:y|ies)\b|\bcosts\b/i, b: /\bentire\s+agreement\b|\bseverab|\bno\s+waiver\b|\bcounterparts\b/i },
  execution:     { label: 'Execution', h: /\bin\s+witness\s+whereof\b|\bexecution\b|\bsigned\b/i },
  schedule:      { label: 'Schedule', h: /\bschedule\b|\bannex(?:ure)?\b|\bappendix\b/i },
  general:       { label: 'Other', h: /$^/ },
};

/* ---------------- document type ---------------- */

export const DOC_TYPES = {
  tenancy:    { label: 'Tenancy / lease', re: /\btenancy\s+agreement\b|\blease\s+agreement\b|\bdeed\s+of\s+lease\b|\bsub-?lease\b/i, roles: [/\blandlord\b/i, /\btenant\b/i], roles2: [/\blessor\b/i, /\blessee\b/i],
    required: ['rent', 'term', 'use', 'repairs', 'quiet', 'termination', 'assignment', 'notices', 'governing'], recommended: ['deposit', 'serviceCharge', 'dispute', 'insurance'] },
  supply:     { label: 'Supply / sale of goods', re: /\bsupply\s+agreement\b|\bsale\s+of\s+goods\b|\bpurchase\s+agreement\b|\bdistribution\s+agreement\b/i, roles: [/\bsupplier\b|\bseller\b|\bvendor\b/i, /\bbuyer\b|\bpurchaser\b|\bcustomer\b/i],
    required: ['payment', 'delivery', 'acceptance', 'title', 'warranties', 'liability', 'termination', 'forceMajeure', 'governing', 'dispute', 'notices'], recommended: ['indemnity', 'confidentiality', 'assignment', 'insurance', 'antiBribery'] },
  services:   { label: 'Services / consultancy', re: /\bservices?\s+agreement\b|\bconsultancy\s+agreement\b|\bservice\s+level\s+agreement\b|\bretainer\b/i, roles: [/\bservice\s+provider\b|\bconsultant\b|\bcontractor\b/i, /\bclient\b|\bcustomer\b|\bcompany\b/i],
    required: ['payment', 'term', 'termination', 'liability', 'confidentiality', 'ip', 'governing', 'dispute', 'notices'], recommended: ['indemnity', 'forceMajeure', 'data', 'assignment', 'insurance'] },
  employment: { label: 'Employment', re: /\bemployment\s+(?:agreement|contract)\b|\bcontract\s+of\s+(?:employment|service)\b|\bletter\s+of\s+(?:employment|appointment)\b/i, roles: [/\bemployer\b|\bcompany\b/i, /\bemployee\b/i],
    required: ['payment', 'term', 'termination', 'confidentiality', 'governing'], recommended: ['ip', 'nonCompete', 'data', 'dispute', 'notices'] },
  nda:        { label: 'Non-disclosure', re: /\bnon-?disclosure\s+agreement\b|\bconfidentiality\s+agreement\b|\bNDA\b/, roles: [/\bdisclosing\s+party\b/i, /\breceiving\s+party\b/i],
    required: ['confidentiality', 'term', 'governing'], recommended: ['dispute', 'notices', 'boilerplate'] },
  loan:       { label: 'Loan / facility', re: /\bloan\s+agreement\b|\bfacility\s+agreement\b|\boffer\s+letter\b[^.]{0,40}\bfacility\b/i, roles: [/\blender\b|\bbank\b/i, /\bborrower\b|\bcustomer\b/i],
    required: ['payment', 'term', 'termination', 'governing', 'dispute', 'notices'], recommended: ['warranties', 'indemnity', 'tax'] },
  assignment: { label: 'Deed of assignment (land)', re: /\bdeed\s+of\s+assignment\b/i, roles: [/\bassignor\b/i, /\bassignee\b/i],
    required: ['recitals', 'payment'], recommended: ['warranties', 'governing'] },
  poa:        { label: 'Power of attorney', re: /\bpower\s+of\s+attorney\b/i, roles: [/\bdonor\b/i, /\b(?:donee|attorney)\b/i], required: [], recommended: ['governing'] },
  mou:        { label: 'Memorandum of understanding', re: /\bmemorandum\s+of\s+understanding\b|\bMOU\b/, roles: [], required: ['term', 'governing'], recommended: ['confidentiality', 'dispute'] },
  generic:    { label: 'Agreement', re: /$^/, roles: [], required: ['payment', 'termination', 'governing', 'dispute', 'notices'], recommended: ['liability', 'forceMajeure', 'confidentiality', 'boilerplate'] },
};
const ALWAYS = ['parties', 'execution'];

function detectDocType(text) {
  const head = text.slice(0, 1500);
  for (const [id, t] of Object.entries(DOC_TYPES)) if (t.re.test(head)) return id;
  for (const [id, t] of Object.entries(DOC_TYPES)) {
    if (!t.roles.length) continue;
    const hit = (rs) => rs.length && rs.every(r => (text.match(new RegExp(r.source, 'gi')) || []).length >= 2);
    if (hit(t.roles) || (t.roles2 && hit(t.roles2))) return id;
  }
  return 'generic';
}

/* ---------------- structure ---------------- */

const TOP_RE = /^[ \t]*(?:(?:CLAUSE|Clause|ARTICLE|Article)\s+)?(\d{1,2})(?:\.(?!\d))?[.)]?[ \t]+(\S[^\n]*)$/;
const SUB_RE = /^[ \t]*(\d{1,2})\.(\d{1,2})(?:\.\d{1,2})*\.?[ \t]+(\S[^\n]*)$/;

function headingOf(rest) {
  const r = rest.trim();
  const letters = r.replace(/[^A-Za-z]/g, '');
  if (letters && letters === letters.toUpperCase() && r.length <= 80 && !/[.;]\s+\S/.test(r)) return { heading: tc(r.replace(/[.:]$/, '')), body: '' };
  const words = r.split(/\s+/);
  if (words.length <= 8 && !/[.;:]\s*\S/.test(r.replace(/[.:]$/, '')) && /^[A-Z]/.test(r) && !/\b(?:shall|will|must|may|is|are)\b/.test(r)) return { heading: r.replace(/[.:]$/, ''), body: '' };
  const inline = r.match(/^([A-Z][A-Za-z&,' -]{2,60}?)[.:]\s+(\S.*)$/);
  if (inline && inline[1].split(/\s+/).length <= 6 && !/\b(?:shall|will|must|may|is|are)\b/.test(inline[1])) return { heading: inline[1], body: inline[2] };
  return { heading: null, body: r };
}
const tc = (s) => s.toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (m, p, c) => p + c.toUpperCase()).replace(/\b(And|Of|The|For|To|In|On|By|Or)\b/g, (w, x, i) => (i ? w.toLowerCase() : w));

export function splitStructure(text) {
  const lines = [];
  let at = 0;
  for (const raw of text.split('\n')) { lines.push({ raw, start: at }); at += raw.length + 1; }
  const clauses = [];
  let preambleEnd = null, recitals = null, execution = null;
  const schedules = [];
  let cur = null;
  const close = (end) => { if (cur) { cur.end = end; cur.text = text.slice(cur.bodyStart, end).trim(); clauses.push(cur); cur = null; } };
  let hasNumbered = lines.some(l => TOP_RE.test(l.raw) && !SUB_RE.test(l.raw));
  for (let i = 0; i < lines.length; i++) {
    const { raw, start } = lines[i];
    const t = raw.trim();
    if (!t) continue;
    if (/^\[Page \d+\]$/.test(t)) continue;
    if (/^WHEREAS\b|^RECITALS?\b|^BACKGROUND\s*:?$/i.test(t) && !recitals && !clauses.length && !cur) {
      if (preambleEnd == null) preambleEnd = start;
      recitals = { start, bodyStart: start, end: null };
      continue;
    }
    if (/^(?:NOW\s+(?:THEREFORE|THIS|IT\s+IS)|IT\s+IS\s+(?:HEREBY\s+)?AGREED)/i.test(t)) {
      if (recitals && recitals.end == null) recitals.end = start;
      if (preambleEnd == null) preambleEnd = start;
      continue;
    }
    if (/^(?:IN\s+WITNESS\s+(?:WHEREOF|OF\s+WHICH)|EXECUTED\s+(?:AS\s+A\s+DEED|BY)|SIGNED,?\s+SEALED\s+AND\s+DELIVERED)/i.test(t) && !execution) {
      close(start);
      execution = { start, end: text.length };
      continue;
    }
    if (/^(?:THE\s+)?(?:(?:FIRST|SECOND|THIRD)\s+)?SCHEDULE\b|^SCHEDULE\s+\d+|^ANNEX(?:URE)?\s+[A-Z0-9]+/i.test(t) && t.length < 60) {
      close(start);
      if (execution && execution.end === text.length) execution.end = start;
      schedules.push({ heading: tc(t), start });
      continue;
    }
    if (execution && !schedules.length) continue;
    const sub = raw.match(SUB_RE);
    const top = !sub && raw.match(TOP_RE);
    const capsHeading = !hasNumbered && isBreakLine(t) && t.length < 60 && !/^(?:BETWEEN|AND|OF)$/i.test(t) && (clauses.length || cur || preambleEnd != null);
    if (top || capsHeading) {
      if (recitals && recitals.end == null) recitals.end = start;
      if (preambleEnd == null) preambleEnd = start;
      close(start);
      const h = top ? headingOf(top[2]) : { heading: tc(t.replace(/[.:]$/, '')), body: '' };
      cur = { number: top ? top[1] : String(clauses.length + 1), heading: h.heading, start, bodyStart: h.body ? start + raw.indexOf(h.body) : start + raw.length + 1, subs: [] };
      continue;
    }
    if (sub && cur && sub[1] === cur.number) cur.subs.push({ number: `${sub[1]}.${sub[2]}`, start, text: sub[3] });
    else if (sub && !cur) {
      if (preambleEnd == null) preambleEnd = start;
      cur = { number: sub[1], heading: null, start, bodyStart: start, subs: [{ number: `${sub[1]}.${sub[2]}`, start, text: sub[3] }] };
    } else if (sub && cur && sub[1] !== cur.number) {
      close(start);
      cur = { number: sub[1], heading: null, start, bodyStart: start, subs: [{ number: `${sub[1]}.${sub[2]}`, start, text: sub[3] }] };
    }
  }
  close(execution ? execution.start : schedules.length ? schedules[0].start : text.length);
  if (recitals && recitals.end == null) recitals.end = clauses[0]?.start ?? text.length;
  const titleLine = text.split('\n').map(l => l.trim()).find(Boolean) || '';
  const title = /\b(?:AGREEMENT|DEED|LEASE|CONTRACT|MEMORANDUM|POWER\s+OF\s+ATTORNEY|UNDERSTANDING|LETTER|TENANCY)\b/i.test(titleLine) ? tc(titleLine.replace(/^THIS\s+/i, '').replace(/\s+(?:is\s+)?made\b.*$/i, '').replace(/\s*\(the\s+"[^"]+"\)\s*$/, '')) : null;
  return {
    title,
    preamble: { start: 0, end: preambleEnd ?? (clauses[0]?.start ?? Math.min(text.length, 1500)) },
    recitals, clauses, execution, schedules,
  };
}

/* ---------------- classification ---------------- */

function classify(clause) {
  const scores = {};
  const head = clause.heading || '';
  const body = clause.text || '';
  for (const [id, t] of Object.entries(CLAUSE_TYPES)) {
    let s = 0;
    if (head && t.h.test(head)) s += 4;
    if (t.b) { const hits = (body.match(new RegExp(t.b.source, `${t.b.flags.replace('g', '')}g`)) || []).length; s += Math.min(hits, 3); }
    if (s) scores[id] = s;
  }
  // Specific beats general where both fire on the heading.
  if (scores.rent && scores.payment) scores.rent += 1;
  if (scores.indemnity && scores.liability && /indemn/i.test(head)) scores.liability -= 3;
  if (scores.termination && /notice/i.test(head) && !/terminat/i.test(head)) scores.termination -= 2;
  if (scores.governing && scores.dispute && /dispute|arbitrat/i.test(head) && !/governing/i.test(head)) scores.governing -= 1;
  const ranked = Object.entries(scores).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
  const primary = ranked[0] && ranked[0][1] >= 2 ? ranked[0][0] : 'general';
  const tags = ranked.filter(([id, s]) => id !== primary && s >= 1 && !['general', 'execution', 'schedule', 'parties'].includes(id)).map(([id]) => id);
  return { type: primary, tags, confidence: ranked[0] ? (ranked[0][1] >= 4 ? 'heading' : 'wording') : 'none' };
}

/* ---------------- defined terms ---------------- */

export function findDefinedTerms(text) {
  const out = new Map();
  const add = (term, definition, index, how) => {
    const t = term.trim().replace(/^the\s+/i, '');
    if (t.length < 2 || t.length > 45) return;
    if (!out.has(t)) out.set(t, { term: t, definition: clip(definition, 260), index, how, count: 0 });
  };
  for (const m of text.matchAll(/"([A-Z][A-Za-z0-9'&/ -]{1,44})"\s+(?:means|shall\s+mean|includes|shall\s+include|has\s+the\s+meaning|refers\s+to|shall\s+refer\s+to)\s+([^\n]{3,400}?)(?:[.;](?:\s|$)|\n)/g)) add(m[1], m[2], m.index, 'means');
  for (const m of text.matchAll(/\((?:hereinafter\s+(?:referred\s+to\s+as|called|known\s+as)\s+|(?:together\s+|jointly\s+|collectively\s+)?(?:the\s+)?|each\s+a\s+|individually\s+a\s+)?"(?:the\s+)?([A-Z][A-Za-z0-9'&/ -]{1,44})"/g)) {
    const before = text.slice(Math.max(0, m.index - 160), m.index).split(/\n|\bBETWEEN\b|\bAND\b|;/).pop().trim();
    add(m[1], before ? `Refers to ${before.replace(/^(?:and|between|of)\s+/i, '')}` : 'Defined in context', m.index, 'alias');
  }
  for (const d of out.values()) {
    const re = new RegExp(`\\b${d.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'g');
    d.count = Math.max(0, (text.match(re) || []).length - 1);
  }
  return [...out.values()].sort((a, b) => a.index - b.index);
}

/* ---------------- parties ---------------- */

const ROLE_WORDS = /^(?:Landlord|Tenant|Lessor|Lessee|Supplier|Buyer|Seller|Purchaser|Vendor|Customer|Client|Company|Employer|Employee|Contractor|Consultant|Service\s+Provider|Lender|Borrower|Bank|Assignor|Assignee|Donor|Donee|Attorney|Licensor|Licensee|Disclosing\s+Party|Receiving\s+Party|Guarantor|Mortgagor|Mortgagee|Chargor|Chargee|Partner|Agent|Principal|Distributor|Manufacturer|Developer|Owner|Investor|Promoter|Subscriber|Shareholder|Contractor|Sub-?contractor|Franchisor|Franchisee)s?$/i;

export function findParties(text, preamble, defined) {
  const pre = text.slice(0, Math.max(preamble.end, 200));
  const parties = [];
  for (const d of defined) {
    if (d.how !== 'alias' || d.index > pre.length + 50) continue;
    if (!ROLE_WORDS.test(d.term) && !/^[A-Z][a-z]+$/.test(d.term)) continue;
    if (/^(?:Agreement|Premises|Property|Goods|Services|Deed|Lease|Contract)$/i.test(d.term)) continue;
    const chunkStart = Math.max(...['BETWEEN', '\nAND', ' AND ', ' and ', 'between'].map(k => pre.lastIndexOf(k, d.index)), 0);
    const chunk = pre.slice(chunkStart, d.index).replace(/^(?:\s*(?:BETWEEN|AND|between|and)\b)/, '').trim();
    const nameM = chunk.match(/^((?:(?:MR|MRS|MISS|MS|DR|CHIEF|ALHAJI|ALHAJA|PROF|ENGR|BARR)\.?\s+)?[A-Z][A-Za-z0-9.,'&() -]{2,110}?)(?=\s*\((?:RC|hereinafter|the\s+")|,?\s+(?:of|whose|a\s+company|a\s+limited|a\s+private|a\s+public|incorporated|with\s+(?:its|registered))\b|\s*\(|,\s|$)/);
    const name = nameM ? nameM[1].trim().replace(/[,\s]+$/, '') : null;
    if (!name || name.length < 3) continue;
    const rc = chunk.match(/\bRC\s*(?:No\.?)?\s*:?\s*(\d{4,8})/i);
    const company = /\b(?:LIMITED|LTD|PLC|L\.?T\.?D|INCORPORATED|COMPANY|ENTERPRISES|NIGERIA)\b/i.test(name) || Boolean(rc);
    const addr = chunk.match(/\b(?:of|at|office\s+(?:is\s+)?at|address\s+at)\s+((?:No\.?\s*)?\d+[A-Za-z]?[^()"]{4,120}?)(?=\s*\(|$|,\s+(?:hereinafter|which))/i);
    parties.push({ name: fixName(name), role: d.term, type: company ? 'company' : 'individual', rc: rc ? rc[1] : null, address: addr ? oneLine(addr[1]).replace(/[,.]$/, '') : null });
  }
  return parties;
}
const fixName = (n) => {
  const letters = n.replace(/[^A-Za-z]/g, '');
  if (letters === letters.toUpperCase()) return n.split(/\s+/).map(w => /^(?:PLC|LTD|RC)$/i.test(w) ? (w.toUpperCase() === 'PLC' ? 'Plc' : w[0] + w.slice(1).toLowerCase()) : w.length <= 2 && /\./.test(w) ? w : w.toLowerCase().replace(/(^|[-(])([a-z])/g, (m, p, c) => p + c.toUpperCase())).join(' ');
  return n;
};

/* ---------------- execution ---------------- */

function executionCheck(text, structure, parties, docType) {
  const exec = structure.execution ? text.slice(structure.execution.start, structure.execution.end) : '';
  const tail = exec || text.slice(-1500);
  const items = [];
  const isDeed = /\bdeed\b/i.test(text.slice(0, 600)) || /\bsealed\b/i.test(tail);
  items.push(exec ? { status: 'ok', label: 'Execution clause', detail: oneLine(exec.split('\n')[0]).slice(0, 120) } : { status: 'missing', label: 'Execution clause', detail: 'No "IN WITNESS WHEREOF" or signing block was found.' });
  for (const p of parties) {
    const nameBits = p.name.split(/\s+/).filter(w => w.length > 3).slice(0, 2);
    const hit = new RegExp(`\\b${p.role}\\b`, 'i').test(tail) || nameBits.some(w => new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(tail));
    items.push(hit ? { status: 'ok', label: `Signature block: ${p.role}`, detail: p.name } : { status: 'missing', label: `Signature block: ${p.role}`, detail: `No signing block for ${p.name} was found.` });
    if (p.type === 'company' && hit) {
      const ok = /\bdirector\b/i.test(tail) && (/\b(?:secretary|director)\b[^\n]*\b(?:secretary|director)\b|\bdirector\s*\/\s*secretary\b|\bwitness\b/i.test(tail));
      items.push(ok ? { status: 'ok', label: `Company execution: ${p.role}`, detail: 'Director / secretary (or witness) lines present.' }
        : { status: 'warn', label: `Company execution: ${p.role}`, detail: 'CAMA 2020 made the common seal optional. A company usually signs by two directors, a director and the secretary, or a director whose signature is witnessed. Check the block provides for this.' });
    }
  }
  const witness = /\bin\s+the\s+presence\s+of\b|\bwitness\b/i.test(tail);
  const witnessDetails = /\bname\b[\s\S]{0,80}\baddress\b[\s\S]{0,80}\boccupation\b/i.test(tail);
  items.push(witness ? { status: witnessDetails ? 'ok' : 'warn', label: 'Witnesses', detail: witnessDetails ? 'Witness name, address and occupation lines present.' : 'A witness is mentioned but name, address and occupation lines are incomplete.' }
    : { status: isDeed || docType === 'tenancy' || docType === 'assignment' ? 'warn' : 'info', label: 'Witnesses', detail: 'No attestation by a witness. Deeds and instruments affecting land are ordinarily witnessed.' });
  // Only count individuals' blocks that have no witness line when others do.
  const witnessCount = (tail.match(/\bin\s+the\s+presence\s+of\b/gi) || []).length;
  const indiv = parties.filter(p => p.type === 'individual');
  if (witness && indiv.length > witnessCount && witnessCount > 0) items.push({ status: 'warn', label: 'Witness for each signatory', detail: `${indiv.length} individuals sign but only ${witnessCount} witness block${witnessCount === 1 ? '' : 's'} found.` });
  if (isDeed) items.push(/\bsigned,?\s+sealed\s+and\s+delivered\b|\bexecuted\s+as\s+a\s+deed\b/i.test(tail) ? { status: 'ok', label: 'Executed as a deed', detail: 'Signed, sealed and delivered wording present.' } : { status: 'warn', label: 'Executed as a deed', detail: 'The document calls itself a deed but the execution wording does not say "signed, sealed and delivered" or "executed as a deed".' });
  const blankDate = text.slice(0, 800).match(/\b(?:made|dated)\s+(?:on\s+)?this\s+_{2,}|\bday\s+of\s+_{2,}|\b_{3,}\s+day\s+of\b/i);
  items.push(blankDate ? { status: 'warn', label: 'Date of execution', detail: 'The date is left blank. Complete it on signing: stamp duty time runs from execution.' } : { status: 'ok', label: 'Date of execution', detail: 'A date appears in the opening words.' });
  return items;
}

/* ---------------- risks ---------------- */

const SEV = { high: 3, medium: 2, low: 1, info: 0 };

function subjectsOf(text, verbRe) {
  const out = new Set();
  const re = new RegExp(String.raw`(?:^\s*(?:\d{1,2}(?:\.\d{1,2})*\.?\s+)?|[.;:,\n]\s*(?:\d{1,2}(?:\.\d{1,2})*\.?\s+)?|\b(?:and|that)\s+)((?:the\s+|each\s+|either\s+|both\s+)?[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)\s+(?:hereby\s+|shall\s+at\s+all\s+times\s+|will\s+)?(?:shall|will|agrees?\s+to|undertakes?\s+to|covenants?\s+to|must)\s+(?:fully\s+|keep\s+)?${verbRe}`, 'gi');
  for (const m of text.matchAll(re)) out.add(m[1].replace(/^the\s+/i, '').trim());
  return [...out];
}

function clauseRef(c) { return c ? `Clause ${c.number}${c.heading ? ` (${c.heading})` : ''}` : 'Document'; }

function findClauseAt(clauses, index) { return clauses.find(c => index >= c.start && index < c.end) || null; }

function risks(text, ctx) {
  const { clauses, present, docType, parties, structure, defined, opts } = ctx;
  const out = [];
  const add = (r) => out.push({ id: r.id, severity: r.severity, title: r.title, why: r.why, evidence: r.evidence ? clip(r.evidence, 320) : null, where: r.where || null, page: r.page ?? null, suggestion: r.suggestion || null, category: r.category || 'risk' });
  const pg = ctx.pg;
  const firstMatch = (re) => { const m = re.exec(text); re.lastIndex = 0; return m; };
  const sentenceAt = (i) => sentences(text.slice(Math.max(0, i - 400), i + 500)).find(s => s.start <= Math.min(400, i) && s.end >= Math.min(400, i))?.text || text.slice(i, i + 200);

  /* missing clauses */
  const t = DOC_TYPES[docType];
  for (const id of [...ALWAYS, ...t.required]) {
    if (present.has(id)) continue;
    const high = ['governing', 'payment', 'rent', 'execution', 'termination', 'confidentiality'].includes(id);
    add({ id: `missing-${id}`, severity: high ? 'medium' : 'low', category: 'missing', title: `No ${CLAUSE_TYPES[id].label.toLowerCase()} clause`,
      why: missingWhy(id, docType), suggestion: `Add a ${CLAUSE_TYPES[id].label.toLowerCase()} clause.` });
  }
  for (const id of t.recommended) {
    if (present.has(id)) continue;
    add({ id: `recommend-${id}`, severity: 'info', category: 'missing', title: `Consider adding: ${CLAUSE_TYPES[id].label}`, why: missingWhy(id, docType) });
  }

  /* indemnity */
  const indemnitors = subjectsOf(text, String.raw`(?:indemnif(?:y|ies)|hold\s+harmless|keep\s+\w+\s+indemnified)`);
  const mutual = indemnitors.some(s => /^(?:each|either|both)\b|part(?:y|ies)$/i.test(s));
  if (indemnitors.length === 1 && !mutual) {
    const m = firstMatch(/\b(?:indemnif(?:y|ies)|hold\s+harmless)\b/gi);
    const c = m ? findClauseAt(clauses, m.index) : null;
    add({ id: 'one-sided-indemnity', severity: 'high', title: `One-sided indemnity: only the ${indemnitors[0]} indemnifies`,
      why: `Only the ${indemnitors[0]} gives an indemnity. An indemnity creates a debt-like liability that does not depend on proving breach, and it is not reduced by the rules on remoteness or mitigation unless the clause says so.`,
      evidence: m ? sentenceAt(m.index) : null, where: clauseRef(c), page: m ? pg(m.index) : null,
      suggestion: `Make the indemnity mutual, limit it to losses caused by the indemnifier's breach, negligence or wilful default, exclude indirect and consequential loss, and bring it within the liability cap.` });
  }
  /* uncapped / unlimited liability */
  const unlimited = firstMatch(/\b(?:unlimited\s+liability|without\s+(?:any\s+)?limit(?:ation)?|shall\s+not\s+be\s+limited|any\s+and\s+all\s+(?:losses|claims|liabilit(?:y|ies))|howsoever\s+arising|(?:losses|liabilities|claims|damages)\s+(?:of\s+)?whatsoever|indirect\s+or\s+consequential\s+loss)\b/gi);
  const cap = /\b(?:shall\s+not\s+exceed|aggregate\s+liability|limited\s+to\s+(?:the\s+)?(?:sum|amount|fees|price)|liability\s+cap|maximum\s+liability)\b/i.test(text);
  if (unlimited && !cap) {
    const c = findClauseAt(clauses, unlimited.index);
    add({ id: 'unlimited-liability', severity: 'high', title: 'Liability is not capped', why: 'The wording exposes a party to losses without a ceiling (including, as drafted, indirect or consequential losses) and the agreement has no liability cap.',
      evidence: sentenceAt(unlimited.index), where: clauseRef(c), page: pg(unlimited.index),
      suggestion: 'Add an aggregate cap (for example, the fees paid in the preceding 12 months), exclude indirect and consequential loss, and carve out only fraud and death or personal injury.' });
  } else if (!cap && (present.has('indemnity') || docType === 'supply' || docType === 'services') && !present.has('liability')) {
    add({ id: 'no-cap', severity: 'medium', title: 'No limitation of liability', why: 'Nothing limits either party\'s liability, so exposure is whatever a court awards.', suggestion: 'Add a mutual limitation of liability clause with a monetary cap.' });
  }
  /* one-sided exclusion */
  const excl = [...text.matchAll(/\b(?:the\s+)?([A-Z][A-Za-z]+)\s+shall\s+not\s+(?:in\s+any\s+event\s+|under\s+any\s+circumstances\s+)?be\s+(?:liable|responsible)\s+(?:to\s+\w+(?:\s+\w+)?\s+)?for\s+(?:any|all)\b[^.]{0,160}/g)];
  const excluders = [...new Set(excl.map(m => m[1]))].filter(s => !/^(?:Neither|No|Either|Each|Party)$/i.test(s));
  if (excluders.length === 1 && !/\bneither\s+party\s+shall\s+be\s+liable\b/i.test(text)) {
    const m = excl[0];
    add({ id: 'one-sided-exclusion', severity: 'medium', title: `Broad exclusion protects only the ${excluders[0]}`, why: `The ${excluders[0]} excludes liability for "any" loss. A clause excluding liability for the party's own breach is construed strictly against the party relying on it, but it may still leave the other side without a remedy for late delivery or defects.`,
      evidence: sentenceAt(m.index), where: clauseRef(findClauseAt(clauses, m.index)), page: pg(m.index), suggestion: 'Make exclusions mutual and limit them to indirect or consequential loss; keep liability for defects and delay (for example, through liquidated damages).' });
  }
  /* automatic renewal */
  const renew = firstMatch(/\b(?:automatic(?:ally)?\s+renew(?:ed|al)?|renew(?:ed)?\s+automatically|shall\s+be\s+deemed\s+(?:to\s+have\s+been\s+)?renewed|tacit(?:ly)?\s+renew|evergreen|shall\s+continue\s+(?:thereafter\s+)?(?:from\s+year\s+to\s+year|on\s+a\s+(?:month|year)-to-(?:month|year)))/gi);
  if (renew) {
    add({ id: 'auto-renewal', severity: 'medium', title: 'Automatic renewal', why: 'The agreement renews itself unless someone gives notice in time. Missing the notice window binds the parties for another term.',
      evidence: sentenceAt(renew.index), where: clauseRef(findClauseAt(clauses, renew.index)), page: pg(renew.index), suggestion: 'Diarise the last day for a non-renewal notice, or require an express written renewal (with any rent or price review agreed first).' });
  }
  /* unilateral termination */
  for (const m of text.matchAll(/\b(?:the\s+)?([A-Z][A-Za-z]+)\s+(?:may|shall\s+be\s+entitled\s+to|reserves\s+the\s+right\s+to)\s+(?:at\s+any\s+time\s+)?terminate\b([^.]{0,200})/g)) {
    const party = m[1];
    if (/^(?:Either|Each|Any|Party|Parties)$/i.test(party)) continue;
    const loose = /\bat\s+any\s+time\b|\bwithout\s+(?:cause|notice|assigning\s+any\s+reason|reason|giving\s+any\s+reason)\b|\bfor\s+convenience\b|\b(?:sole|absolute)\s+discretion\b/i.test(m[0]);
    if (!loose) continue;
    const others = parties.map(p => p.role).filter(r => r.toLowerCase() !== party.toLowerCase());
    const reciprocal = others.some(o => new RegExp(`\\b${o}\\s+(?:may|shall\\s+be\\s+entitled\\s+to)\\s+(?:at\\s+any\\s+time\\s+)?terminate\\b[^.]{0,200}(?:at\\s+any\\s+time|without|for\\s+convenience)`, 'i').test(text));
    if (reciprocal) continue;
    const noticeM = m[0].match(/(\w+(?:\s*\(\d+\))?)\s+(days?|weeks?|months?)'?s?'?\s+notice/i);
    add({ id: `unilateral-termination-${party.toLowerCase()}`, severity: 'high', title: `The ${party} can terminate at will`, why: `Only the ${party} may end the agreement without cause${noticeM ? ` on ${noticeM[0]}` : ''}. The other side has no matching right and little security of term.`,
      evidence: sentenceAt(m.index), where: clauseRef(findClauseAt(clauses, m.index)), page: pg(m.index), suggestion: 'Limit termination to material breach not remedied within a cure period, or make the right mutual with a reasonable notice period.' });
  }
  /* unilateral variation / review */
  const vary = firstMatch(/\b(?:the\s+)?([A-Z][A-Za-z]+)\s+(?:may|reserves\s+the\s+right\s+to)\s+(?:unilaterally\s+)?(?:vary|amend|change|modify|review|increase)\b[^.]{0,120}?\b(?:at\s+any\s+time|sole\s+(?:and\s+absolute\s+)?discretion|without\s+(?:notice|consent|the\s+consent))/gi);
  if (vary && !/^(?:Either|Each|Parties)$/i.test(vary[1])) {
    add({ id: 'unilateral-variation', severity: 'medium', title: `The ${vary[1]} can change terms alone`, why: 'A power to vary price, rent or terms at one party\'s discretion undermines certainty. Courts read such powers narrowly, but they invite disputes.',
      evidence: sentenceAt(vary.index), where: clauseRef(findClauseAt(clauses, vary.index)), page: pg(vary.index), suggestion: 'Tie any review to fixed intervals and an objective formula or index, with notice and a right to terminate if the change is not accepted.' });
  }
  /* governing law & forum */
  const gov = firstMatch(/\b(?:governed\s+by|construed\s+in\s+accordance\s+with|subject\s+to)\s+(?:and\s+construed\s+in\s+accordance\s+with\s+)?(?:the\s+)?laws?\s+of\s+(?:the\s+)?([A-Z][A-Za-z]+(?:\s+(?:and|of|&)?\s*[A-Z][A-Za-z]+){0,4})/g);
  if (gov) {
    const place = gov[1].trim();
    if (!/\bNigeria|Federal\s+Republic|Lagos|Abuja|Federal\s+Capital|\bState\b/i.test(place)) {
      add({ id: 'foreign-law', severity: 'high', title: `Foreign governing law: ${place}`, why: `The contract is governed by the law of ${place}. Performance in Nigeria under foreign law means proving that law as a fact through expert evidence, higher costs, and a foreign judgment must be registered or recognised before it can be enforced here (Foreign Judgments (Reciprocal Enforcement) Act, Cap. F35 LFN 2004, and the common law).`,
        evidence: sentenceAt(gov.index), where: clauseRef(findClauseAt(clauses, gov.index)), page: pg(gov.index), suggestion: 'Choose Nigerian law (and a Nigerian seat or court) where the goods, services or property are in Nigeria, or confirm the client accepts the cost of a foreign forum.' });
    }
  }
  const seat = firstMatch(/\barbitration\b[^.]{0,120}?\b(?:in|seat(?:ed)?\s+(?:of\s+arbitration\s+)?(?:shall\s+be\s+)?(?:in|at)?|venue\s+(?:shall\s+be)?)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)/g);
  if (seat && !/\b(?:Lagos|Abuja|Nigeria|Kano|Port\s+Harcourt|Ibadan|Enugu|Kaduna|Benin|Owerri|Calabar|Jos|Ilorin|Uyo|Asaba|Warri|Akure|Abeokuta)\b/i.test(seat[1])) {
    add({ id: 'foreign-seat', severity: 'medium', title: `Arbitration seated abroad: ${seat[1]}`, why: `A foreign seat makes the courts of ${seat[1]} the supervisory court. The award can be enforced in Nigeria under the New York Convention through the Arbitration and Mediation Act 2023, but costs and travel rise.`,
      evidence: sentenceAt(seat.index), where: clauseRef(findClauseAt(clauses, seat.index)), page: pg(seat.index), suggestion: 'Consider a Nigerian seat (for example Lagos) under the Arbitration and Mediation Act 2023, or an institution with a Nigerian presence.' });
  }
  if (/\barbitrat/i.test(text)) {
    const miss = [];
    if (!/\b(?:seat|venue|place)\s+of\s+(?:the\s+)?arbitration\b|\barbitration\s+(?:in|at)\s+[A-Z]/i.test(text)) miss.push('seat');
    if (!/\b(?:rules|Arbitration\s+and\s+Mediation\s+Act|Arbitration\s+and\s+Conciliation\s+Act|ICC|LCIA|UNCITRAL|Lagos\s+Court\s+of\s+Arbitration|LCA|Chartered\s+Institute\s+of\s+Arbitrators|CIArb)\b/.test(text)) miss.push('rules');
    if (!/\b(?:sole|one|single|three|3)\s+arbitrators?\b|\bpanel\s+of\b|\barbitrator\s+(?:shall\s+be\s+)?appointed\b/i.test(text)) miss.push('number of arbitrators');
    if (miss.length) {
      const m = firstMatch(/\barbitrat/gi);
      add({ id: 'arbitration-incomplete', severity: 'low', title: 'Arbitration clause is incomplete', why: `The clause does not state the ${miss.join(', ')}. Gaps are filled by the Arbitration and Mediation Act 2023 or the court, which adds delay.`,
        evidence: m ? sentenceAt(m.index) : null, where: clauseRef(m ? findClauseAt(clauses, m.index) : null), page: m ? pg(m.index) : null, suggestion: 'State the seat, the rules, the number of arbitrators and how they are appointed, and the language.' });
    }
  }
  /* blanks */
  const blanks = [...text.matchAll(/_{4,}|\[\s*(?:●|•|\*|insert[^\]]*|TBD|TBC|x+)\s*\]|\bTBD\b|\bTBC\b/gi)].filter(m => {
    const tail = text.slice(Math.max(0, m.index - 60), m.index).toLowerCase();
    return !/(?:signature|signed|name|address|occupation|director|secretary|witness|designation)\s*:?\s*_*\s*$/.test(tail) && !(structure.execution && m.index >= structure.execution.start);
  });
  if (blanks.length) {
    add({ id: 'blanks', severity: 'medium', title: `${blanks.length} blank${blanks.length === 1 ? '' : 's'} to complete`, why: 'Blanks or placeholders remain outside the signing block (dates, amounts or names). An incomplete material term can make a provision uncertain.',
      evidence: sentenceAt(blanks[0].index), page: pg(blanks[0].index), suggestion: 'Complete or delete every blank before execution.' });
  }
  /* default interest */
  const intr = firstMatch(/\binterest\s+(?:at\s+(?:the\s+rate\s+of\s+)?)?(\d{1,2}(?:\.\d+)?)\s*%\s*(?:per\s+|a\s+)?(month|annum|year)/gi);
  if (intr) {
    const rate = Number(intr[1]) * (/month/i.test(intr[2]) ? 12 : 1);
    if (rate >= 24) add({ id: 'default-interest', severity: 'low', title: `High default interest (${intr[1]}% per ${intr[2].toLowerCase()})`, why: `That is about ${rate}% a year. A rate that is not a genuine pre-estimate of loss risks being treated as a penalty and not enforced as written.`,
      evidence: sentenceAt(intr.index), where: clauseRef(findClauseAt(clauses, intr.index)), page: pg(intr.index), suggestion: 'Use a rate linked to a benchmark (for example, the CBN Monetary Policy Rate plus a margin).' });
  }

  /* tenancy (Lagos) */
  if (docType === 'tenancy') {
    const lagos = opts.state === 'lagos' || (opts.state !== 'fct' && opts.state !== 'other' && /\bLagos\b/.test(text));
    const adv = firstMatch(/\b(?:rent|sum)\b[^.]{0,80}?\b(two|three|four|five|2|3|4|5)\s*(?:\(\d\)\s*)?years?'?\s*(?:rent\s+)?in\s+advance\b|\b(two|three|2|3)\s*(?:\(\d\)\s*)?years?'?\s+(?:rent\s+)?in\s+advance/gi);
    if (adv && lagos) {
      add({ id: 'advance-rent', severity: 'medium', title: 'Rent demanded more than one year in advance', why: 'In Lagos State the Tenancy Law 2011 (s. 4) makes it unlawful for a landlord to demand or receive more than one year\'s rent in advance from a new tenant (six months from a sitting monthly tenant). The Law does not apply in some areas (for example Apapa, Ikeja GRA, Ikoyi, Lagos Island and Victoria Island) — check where the premises are.',
        evidence: sentenceAt(adv.index), where: clauseRef(findClauseAt(clauses, adv.index)), page: pg(adv.index), category: 'statutory', suggestion: 'Limit the advance to one year (or confirm the premises fall in an exempted area).' });
    }
    const ntq = firstMatch(/\b(\w+)\s*(?:\((\d+)\)\s*)?(week|month)'?s?'?\s+notice\b/gi);
    const yearly = /\bper\s+annum\b|\byearly\b|\bannual(?:ly)?\b|\bterm\s+of\s+(?:\w+\s*(?:\(\d+\)\s*)?)years?\b/i.test(text);
    if (ntq && yearly && lagos) {
      const n = parseNumberWord(ntq[2] || ntq[1]) || 0;
      const months = /week/i.test(ntq[3]) ? n / 4 : n;
      if (months && months < 6) add({ id: 'short-notice', severity: 'low', title: `Notice period (${oneLine(ntq[0])}) is shorter than the Lagos default`, why: 'For a yearly tenancy the Tenancy Law of Lagos State 2011 (s. 13) requires six months\' notice where the parties have not agreed otherwise, followed by a seven-day notice of the owner\'s intention to recover possession. An express shorter period will be read strictly.',
        evidence: sentenceAt(ntq.index), where: clauseRef(findClauseAt(clauses, ntq.index)), page: pg(ntq.index), category: 'statutory', suggestion: 'Confirm the client intends the shorter period and that recovery of possession will still follow the statutory seven-day notice.' });
    }
    if (present.has('deposit') && !/\brefund(?:ed|able)?\b/i.test(text)) {
      add({ id: 'deposit-refund', severity: 'low', title: 'Caution deposit without refund terms', why: 'The deposit is paid but the agreement does not say when and on what deductions it is refunded.', suggestion: 'State that the deposit is refundable within a fixed period after vacation, less documented costs of repairing damage beyond fair wear and tear.' });
    }
  }

  /* reminders: stamp duty & registration */
  const reminders = [];
  reminders.push({ id: 'stamp-duty', severity: 'info', category: 'reminder', title: 'Stamp duty', why: `Stamp the ${docType === 'generic' ? 'agreement' : 'document'} within 30 days of execution (Stamp Duties Act, Cap. S8 LFN 2004, as amended by the Finance Acts). An unstamped instrument is not admissible in evidence until it is stamped and any penalty paid. Duty is assessed by the FIRS where a company is a party and by the State Internal Revenue Service where the parties are individuals. ${docType === 'tenancy' ? 'Leases and tenancy agreements attract ad valorem duty based on the rent and term.' : docType === 'loan' ? 'Loan and security documents attract ad valorem duty on the amount secured.' : ''} Check current rates before quoting.`.replace(/\s+/g, ' ').trim() });
  if (docType === 'tenancy') {
    const years = (text.match(/\bterm\s+of\s+(\w+)\s*(?:\((\d+)\)\s*)?years?\b/i) || []);
    const n = parseNumberWord(years[2] || years[1]) || 0;
    if (n > 3) reminders.push({ id: 'lease-registration', severity: 'info', category: 'reminder', title: 'Registration of the lease', why: `A lease for more than three years is a registrable instrument: register it at the Lands Registry of the State, and obtain the Governor's consent where the landlord holds a statutory right of occupancy (Land Use Act 1978, s. 22). An unregistered registrable instrument may be inadmissible to prove title.` });
    else reminders.push({ id: 'lease-registration', severity: 'info', category: 'reminder', title: 'Registration', why: 'A tenancy of three years or less is generally not registrable, but keep the stamped original and receipts for rent paid.' });
  }
  if (docType === 'assignment') reminders.push({ id: 'governors-consent', severity: 'info', category: 'reminder', title: "Governor's consent and registration", why: "An assignment of a statutory right of occupancy is inoperative without the Governor's consent (Land Use Act 1978, s. 22). After consent, register the deed at the State Lands Registry." });
  if (docType === 'loan' || /\b(?:mortgage|debenture|legal\s+charge|fixed\s+charge|floating\s+charge|deed\s+of\s+charge)\b/i.test(text)) reminders.push({ id: 'charge-registration', severity: 'info', category: 'reminder', title: 'Registration of security', why: 'A charge created by a company must be registered with the Corporate Affairs Commission within 90 days of creation (CAMA 2020), or it is void against a liquidator and creditors. A legal mortgage over land also needs the Governor\'s consent and registration.' });
  if (docType === 'poa' && /\bland|property|plot\b/i.test(text)) reminders.push({ id: 'poa-registration', severity: 'info', category: 'reminder', title: 'Registration of the power of attorney', why: 'A power of attorney dealing with land should be registered at the State Lands Registry before it is relied on.' });
  if (present.has('data') || /\bpersonal\s+data\b/i.test(text)) reminders.push({ id: 'ndpa', severity: 'info', category: 'reminder', title: 'Data protection', why: 'Processing personal data engages the Nigeria Data Protection Act 2023: set out the lawful basis, security measures and cross-border transfer terms.' });

  out.sort((a, b) => SEV[b.severity] - SEV[a.severity]);
  return { flags: out, reminders };
}

function missingWhy(id, docType) {
  const M = {
    parties: 'The parties are not clearly identified with full names and addresses (and RC numbers for companies).',
    execution: 'There is no execution block, so it is unclear how and by whom the document is to be signed.',
    governing: 'Without a governing law clause, the court decides the proper law from the circumstances. For a Nigerian transaction, say "the laws of the Federal Republic of Nigeria" (and the State where relevant).',
    dispute: 'Without a dispute resolution clause, disputes go to court by default; there is no negotiation, mediation or arbitration step.',
    termination: 'The agreement does not say how it can be ended early, for breach or otherwise.',
    notices: 'The agreement does not say how notices are served, which matters for notices to quit, default notices and renewal notices.',
    payment: 'The price or consideration and when it is paid are not set out in a clause of their own.',
    rent: 'The rent, when it is payable and how it may be reviewed are not set out.',
    term: 'The start date and length of the agreement are not stated.',
    use: 'The permitted use of the premises is not restricted.',
    repairs: 'Responsibility for repairs and maintenance is not allocated.',
    quiet: 'The landlord\'s covenant for quiet enjoyment is missing (it may be implied, but it is better stated).',
    assignment: 'Nothing restricts assignment or subletting.',
    delivery: 'Delivery place, date and terms are not stated.',
    acceptance: 'There is no inspection or acceptance procedure, so it is unclear when goods are accepted.',
    title: 'The agreement does not say when title and risk in the goods pass.',
    warranties: 'No warranties as to quality or fitness are given.',
    liability: 'Liability is not limited.',
    forceMajeure: 'There is no force majeure clause; relief would depend on the narrow doctrine of frustration.',
    confidentiality: 'Confidential information is not protected.',
    ip: 'Ownership of intellectual property in the work is not dealt with.',
    indemnity: 'There is no indemnity for third-party claims.',
    deposit: 'Any caution or security deposit and its refund are not addressed.',
    serviceCharge: 'Service charge and utility responsibilities are not set out.',
    insurance: 'Insurance obligations are not set out.',
    data: 'Personal data handling is not addressed.',
    nonCompete: 'There are no restrictive covenants.',
    recitals: 'There are no recitals explaining the background and the root of title.',
    boilerplate: 'General provisions (entire agreement, severability, waiver, variation) are missing.',
    antiBribery: 'There is no anti-bribery undertaking.',
    tax: 'Tax treatment (VAT, withholding tax, stamp duty) is not stated.',
  };
  return M[id] || 'Usually expected in this kind of document.';
}

/* ---------------- main ---------------- */

/**
 * Analyses an agreement.
 * opts.state: 'lagos' | 'fct' | 'other' | 'auto' for tenancy rules.
 */
export function analyzeContract(input, opts = {}) {
  const text = normaliseText(input);
  const pages = pageMap(text);
  const pg = (i) => (pages ? pages.at(i) : null);
  const structure = splitStructure(text);
  const docType = opts.docType && DOC_TYPES[opts.docType] ? opts.docType : detectDocType(text);
  const defined = findDefinedTerms(text);
  const parties = findParties(text, structure.preamble, defined);

  const clauses = structure.clauses.map((c, i) => {
    const cls = classify(c);
    return { id: `c${i + 1}`, number: c.number, heading: c.heading, text: c.text, start: c.start, end: c.end, page: pg(c.start), subs: c.subs.map(s => ({ number: s.number, text: clip(s.text, 200), page: pg(s.start) })), ...cls, typeLabel: CLAUSE_TYPES[cls.type].label, summary: clip(c.text.replace(/^\d+\.\d+\s*/gm, ''), 200) };
  });
  const present = new Set();
  for (const c of clauses) { present.add(c.type); for (const t of c.tags) present.add(t); }
  if (parties.length || /\bBETWEEN\b/.test(text.slice(0, structure.preamble.end + 10))) present.add('parties');
  if (structure.recitals) present.add('recitals');
  if (structure.execution) present.add('execution');
  if (present.has('rent')) present.add('payment');
  if (docType === 'tenancy' && present.has('payment')) present.add('rent');
  if (/\bgoverned\s+by\b|\bconstrued\s+in\s+accordance\s+with\s+the\s+laws?\b/i.test(text)) present.add('governing');
  if (/\barbitrat|\bmediat/i.test(text)) present.add('dispute');
  if (/\bquietly\s+(?:hold|enjoy)|\bpeaceably\s+hold\b/i.test(text)) present.add('quiet');
  if (/\bnot\s+(?:to\s+)?assign\b|\bshall\s+not\s+assign\b|\bsublet\b/i.test(text)) present.add('assignment');

  const anchors = findAnchors(text, defined, opts.anchors || {});
  const aliases = [...new Set([...parties.map(p => p.role), ...defined.filter(d => ROLE_WORDS.test(d.term)).map(d => d.term)])];
  const obligationSource = clauses.length ? clauses : [{ number: null, heading: null, text, start: 0 }];
  const obligations = extractObligations(obligationSource, { parties: aliases, anchors, pageOf: pg });
  const execution = executionCheck(text, structure, parties, docType);
  const { flags, reminders } = risks(text, { clauses, present, docType, parties, structure, defined, pg, opts });
  const statutes = findStatutes(text).map(s => s.display);

  const byType = {};
  for (const c of clauses) (byType[c.type] ||= []).push(c.number);
  const expected = [...ALWAYS, ...DOC_TYPES[docType].required, ...DOC_TYPES[docType].recommended];
  const coverage = expected.map(id => ({ type: id, label: CLAUSE_TYPES[id].label, present: present.has(id), required: !DOC_TYPES[docType].recommended.includes(id) }));

  const dates = findDates(text).map(d => ({ date: d.date, text: formatDate(d.date), page: pg(d.index) }));
  const amounts = [...text.matchAll(/(?:₦|\bN|\bNGN\s?|US\$|\bUSD\s?|\$|£|€)\s?(\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d{4,}(?:\.\d{2})?)(?:\s*\(([^)]{5,120})\))?/g)].map(m => ({ text: m[0].trim(), words: m[2] || null, page: pg(m.index) }));

  return {
    title: structure.title || DOC_TYPES[docType].label,
    docType, docTypeLabel: DOC_TYPES[docType].label,
    parties, defined, clauses, coverage, byType, obligations, anchors, execution, flags, reminders, statutes, dates, amounts,
    recitals: structure.recitals ? clip(text.slice(structure.recitals.start, structure.recitals.end), 900) : null,
    hasPages: Boolean(pages), pages: pages?.pages || null,
    counts: {
      clauses: clauses.length, high: flags.filter(f => f.severity === 'high').length, medium: flags.filter(f => f.severity === 'medium').length,
      low: flags.filter(f => f.severity === 'low').length, obligations: obligations.length, defined: defined.length,
      unused: defined.filter(d => d.count === 0).length,
    },
  };
}

/* ---------------- exports ---------------- */

export function redlineSummary(a) {
  const L = [];
  L.push(`${a.title}${a.parties.length ? ` — ${a.parties.map(p => `${p.name} (${p.role})`).join(' / ')}` : ''}`, '');
  const issues = a.flags.filter(f => f.severity !== 'info');
  if (issues.length) {
    L.push('Points for negotiation:', '');
    issues.forEach((f, i) => {
      L.push(`${i + 1}. ${f.where ? `${f.where} — ` : ''}${f.title} [${f.severity}]`);
      L.push(`   Issue: ${f.why}`);
      if (f.suggestion) L.push(`   Proposed: ${f.suggestion}`);
      L.push('');
    });
  } else L.push('No risk flags were raised by the automated review.', '');
  const exec = a.execution.filter(x => x.status !== 'ok');
  if (exec.length) { L.push('Execution points:', ''); exec.forEach(x => L.push(`- ${x.label}: ${x.detail}`)); L.push(''); }
  if (a.reminders.length) { L.push('Reminders:', ''); a.reminders.forEach(r => L.push(`- ${r.title}: ${r.why}`)); L.push(''); }
  L.push('This summary was generated on-device by pattern matching. Review each point against the document before sending.');
  return L.join('\n');
}

export function contractMarkdown(a) {
  const L = [`# ${a.title}`, '', `**Type:** ${a.docTypeLabel}  `];
  if (a.parties.length) L.push(`**Parties:** ${a.parties.map(p => `${p.name} ("${p.role}")${p.rc ? `, RC ${p.rc}` : ''}`).join('; ')}  `);
  L.push('', '## Risk flags', '');
  if (!a.flags.length) L.push('None raised.');
  for (const f of a.flags) {
    L.push(`- **[${f.severity.toUpperCase()}] ${f.title}**${f.where ? ` — ${f.where}` : ''}${f.page ? ` (p. ${f.page})` : ''}`);
    L.push(`  ${f.why}`);
    if (f.evidence) L.push(`  > ${f.evidence}`);
    if (f.suggestion) L.push(`  *Suggested:* ${f.suggestion}`);
  }
  L.push('', '## Clause map', '', '| Clause | Heading | Type |', '|---|---|---|');
  for (const c of a.clauses) L.push(`| ${c.number} | ${c.heading || '—'} | ${c.typeLabel} |`);
  const missing = a.coverage.filter(c => !c.present);
  if (missing.length) L.push('', `**Not found:** ${missing.map(m => m.label).join(', ')}`);
  L.push('', '## Obligations and deadlines', '');
  for (const o of a.obligations) L.push(`- **${o.party}** ${o.action}${o.deadline ? ` — *${o.deadline.text}${o.deadline.due ? ` (${formatDate(o.deadline.due)})` : ''}*` : ''}${o.clause ? ` [cl. ${o.clause.number}]` : ''}`);
  L.push('', '## Defined terms', '');
  for (const d of a.defined) L.push(`- **${d.term}**: ${d.definition}${d.count === 0 ? ' *(not used again)*' : ''}`);
  L.push('', '## Execution', '');
  for (const x of a.execution) L.push(`- ${x.status === 'ok' ? '[ok]' : x.status === 'missing' ? '[missing]' : '[check]'} ${x.label}: ${x.detail}`);
  L.push('', '## Reminders', '');
  for (const r of a.reminders) L.push(`- **${r.title}.** ${r.why}`);
  L.push('', '---', '*Automated, on-device review. Flags are prompts for a lawyer\'s review, not advice. Check every point against the document and current law.*');
  return L.join('\n');
}
