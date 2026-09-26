/* ============================================================
   Legal engine — Nigerian court hierarchy (DOM-free)

   A small model of the courts and of vertical stare decisis:
   which decision binds which court, and why. It states the
   general rules only; the weight of a particular decision
   (per incuriam, conflicting decisions, obiter) still has to be
   checked against the judgment itself.
   ============================================================ */

// level: 1 is the apex. `system`: 'ng' for Nigerian courts, 'hist' for pre-1963 appellate courts, 'foreign'.
export const COURTS = {
  SC:   { id: 'SC', name: 'Supreme Court of Nigeria', short: 'Supreme Court', level: 1, system: 'ng', judges: 'JSC' },
  CA:   { id: 'CA', name: 'Court of Appeal', short: 'Court of Appeal', level: 2, system: 'ng', judges: 'JCA' },
  FHC:  { id: 'FHC', name: 'Federal High Court', short: 'Federal High Court', level: 3, system: 'ng', judges: 'J' },
  HC:   { id: 'HC', name: 'High Court of a State', short: 'State High Court', level: 3, system: 'ng', judges: 'J' },
  FCTHC:{ id: 'FCTHC', name: 'High Court of the Federal Capital Territory', short: 'FCT High Court', level: 3, system: 'ng', judges: 'J' },
  NIC:  { id: 'NIC', name: 'National Industrial Court of Nigeria', short: 'National Industrial Court', level: 3, system: 'ng', judges: 'J' },
  SCA:  { id: 'SCA', name: 'Sharia Court of Appeal', short: 'Sharia Court of Appeal', level: 3, system: 'ng', judges: 'Kadi' },
  CCA:  { id: 'CCA', name: 'Customary Court of Appeal', short: 'Customary Court of Appeal', level: 3, system: 'ng', judges: 'J' },
  TRIB: { id: 'TRIB', name: 'Tribunal', short: 'Tribunal', level: 3.5, system: 'ng', judges: '' },
  MC:   { id: 'MC', name: "Magistrates' / District Court", short: "Magistrates' Court", level: 4, system: 'ng', judges: '' },
  LOW:  { id: 'LOW', name: 'Customary, Area or Sharia Court (lower)', short: 'Customary / Area Court', level: 4, system: 'ng', judges: '' },
  FSC:  { id: 'FSC', name: 'Federal Supreme Court (pre-1963)', short: 'Federal Supreme Court', level: 1, system: 'hist', judges: 'FJ' },
  WACA: { id: 'WACA', name: 'West African Court of Appeal', short: 'WACA', level: 2, system: 'hist', judges: '' },
  PC:   { id: 'PC', name: 'Judicial Committee of the Privy Council', short: 'Privy Council', level: 1, system: 'hist', judges: '' },
  UKSC: { id: 'UKSC', name: 'UK Supreme Court / House of Lords', short: 'UK Supreme Court', level: 1, system: 'foreign', judges: '' },
  EWCA: { id: 'EWCA', name: 'Court of Appeal of England and Wales', short: 'English Court of Appeal', level: 2, system: 'foreign', judges: 'LJ' },
  EWHC: { id: 'EWHC', name: 'High Court of England and Wales', short: 'English High Court', level: 3, system: 'foreign', judges: 'J' },
  FOREIGN: { id: 'FOREIGN', name: 'Foreign court', short: 'Foreign court', level: 3, system: 'foreign', judges: '' },
};

export const courtById = (id) => COURTS[id] || null;

export const LEVEL_LABEL = { 1: 'Apex court', 2: 'Intermediate appellate court', 3: 'Superior court of first instance', 3.5: 'Tribunal', 4: 'Inferior court' };

/* Detection from a judgment's heading. Order matters: most specific first. */
const DETECT = [
  ['SC', /\bIN\s+THE\s+SUPREME\s+COURT\s+OF\s+NIGERIA\b|\bSUPREME\s+COURT\s+OF\s+NIGERIA\b/i],
  ['CA', /\bIN\s+THE\s+COURT\s+OF\s+APPEAL\b|\bCOURT\s+OF\s+APPEAL\b[^\n]{0,60}\bDIVISION\b/i],
  ['NIC', /\bNATIONAL\s+INDUSTRIAL\s+COURT\b/i],
  ['FHC', /\bFEDERAL\s+HIGH\s+COURT\b/i],
  ['FCTHC', /\bHIGH\s+COURT\s+OF\s+(?:THE\s+)?FEDERAL\s+CAPITAL\s+TERRITORY\b|\bFCT\s+HIGH\s+COURT\b/i],
  ['SCA', /\bSHARIA\s+COURT\s+OF\s+APPEAL\b/i],
  ['CCA', /\bCUSTOMARY\s+COURT\s+OF\s+APPEAL\b/i],
  ['HC', /\bHIGH\s+COURT\s+OF\s+(?:JUSTICE\s+)?(?:[A-Z][A-Za-z-]+\s+){1,3}STATE\b|\b(?:[A-Z][A-Za-z-]+\s+){1,2}STATE\s+HIGH\s+COURT\b|\bIN\s+THE\s+HIGH\s+COURT\b/i],
  ['TRIB', /\b(?:ELECTION\s+PETITION|CODE\s+OF\s+CONDUCT|INVESTMENTS?\s+AND\s+SECURITIES)\s+TRIBUNAL\b|\bIN\s+THE\s+[A-Z\s]{0,40}TRIBUNAL\b/i],
  ['MC', /\bMAGISTRATES?'?\s+COURT\b|\bDISTRICT\s+COURT\b/i],
  ['LOW', /\bIN\s+THE\s+(?:CUSTOMARY|AREA|UPPER\s+AREA|SHARIA)\s+COURT\b/i],
  ['UKSC', /\bUK\s+SUPREME\s+COURT\b|\bSUPREME\s+COURT\s+OF\s+THE\s+UNITED\s+KINGDOM\b|\bHOUSE\s+OF\s+LORDS\b/i],
  ['PC', /\bPRIVY\s+COUNCIL\b/i],
];

/** Finds the deciding court from the heading (first ~2,500 characters), then from the judges' titles. */
export function detectCourt(text) {
  const head = String(text || '').slice(0, 2500);
  for (const [id, re] of DETECT) {
    const m = head.match(re);
    if (m) {
      const c = { ...COURTS[id], source: 'heading', match: m[0].replace(/\s+/g, ' ').trim() };
      if (id === 'HC') {
        const st = head.match(/HIGH\s+COURT\s+OF\s+(?:JUSTICE\s+)?((?:[A-Z][A-Za-z-]+\s+){1,3})STATE/i) || head.match(/((?:[A-Z][A-Za-z-]+\s+){1,2})STATE\s+HIGH\s+COURT/i);
        if (st) c.state = titleCase(st[1].trim());
        if (c.state) c.name = `High Court of ${c.state} State`;
      }
      const top = head.slice(0, 700);
      const seat = top.match(/\bHOLDEN[ \t]+AT[ \t]+([A-Z][A-Za-z]+(?:[ \t]+[A-Z][A-Za-z]+)?)/i);
      if (seat) c.seat = titleCase(seat[1]);
      const div = top.match(/\b(?:IN[ \t]+THE[ \t]+)?([A-Z][A-Za-z]+(?:[ \t]+[A-Z][A-Za-z]+)?)[ \t]+(?:JUDICIAL[ \t]+)?DIVISION\b/);
      if (div && !/^(the|judicial|in)$/i.test(div[1])) c.division = titleCase(div[1].replace(/^IN\s+THE\s+/i, '').replace(/\s+JUDICIAL$/i, ''));
      return c;
    }
  }
  const body = String(text || '').slice(0, 20000);
  // Judges' titles: several JSCs sitting → Supreme Court; JCAs → Court of Appeal. Weak evidence, so say so.
  const jsc = (body.match(/,?\s+JSC\b/g) || []).length, jca = (body.match(/,?\s+JCA\b/g) || []).length;
  if (jsc >= 2 && jsc >= jca) return { ...COURTS.SC, source: 'judges', match: 'Justices styled JSC' };
  if (jca >= 2) return { ...COURTS.CA, source: 'judges', match: 'Justices styled JCA' };
  return null;
}

/** Court from a suit/appeal number: SC/..., CA/L/..., FHC/..., NICN/..., FCT/HC/..., LD/... */
export function courtFromSuitNo(no) {
  const s = String(no || '').toUpperCase().replace(/\s+/g, '');
  if (/^SC[./]/.test(s)) return COURTS.SC;
  if (/^CA\//.test(s)) return COURTS.CA;
  if (/^FHC\//.test(s)) return COURTS.FHC;
  if (/^NIC(?:N)?\//.test(s)) return COURTS.NIC;
  if (/^FCT\/HC\//.test(s)) return COURTS.FCTHC;
  if (/^(?:LD|ID|IKD|EPE|BD|HCT|HOH|HAB|HEN|HPH|HC)\//.test(s)) return COURTS.HC;
  return null;
}

/** Court from a judge's title: JSC → SC, JCA → CA. */
export function courtFromTitle(title) {
  const t = String(title || '').toUpperCase();
  if (t === 'JSC' || t === 'CJN') return COURTS.SC;
  if (t === 'JCA' || t === 'PCA') return COURTS.CA;
  return null;
}

/**
 * Whether a decision of `from` binds `to`. Both are court ids or court objects.
 * Returns { status: 'binding' | 'persuasive' | 'self' | 'coordinate' | 'not-binding', label, reason }.
 */
export function bindingEffect(fromC, toC) {
  const a = typeof fromC === 'string' ? COURTS[fromC] : fromC;
  const b = typeof toC === 'string' ? COURTS[toC] : toC;
  if (!a || !b) return { status: 'unknown', label: 'Unknown', reason: 'The court could not be identified from the text.' };
  if (a.system === 'foreign') {
    return { status: 'persuasive', label: 'Persuasive only', reason: `${a.short} decisions are foreign authority: persuasive, never binding on a Nigerian court.` };
  }
  if (a.system === 'hist') {
    if (a.id === 'PC') return { status: 'persuasive', label: 'Highly persuasive', reason: 'Privy Council decisions on appeal from Nigeria before 1963 are treated with great respect, but the Supreme Court may depart from them; Privy Council decisions from other jurisdictions are only persuasive.' };
    return { status: b.level >= 2 ? 'binding' : 'persuasive', label: b.level >= 2 ? 'Binding unless departed from' : 'Persuasive for the Supreme Court', reason: `${a.short} was a former apex/appellate court for Nigeria. Its decisions are followed by courts below the Supreme Court unless the Supreme Court has departed from them.` };
  }
  if (b.system !== 'ng') return { status: 'persuasive', label: 'Persuasive only', reason: 'A Nigerian decision is at most persuasive outside Nigeria.' };
  if (a.id === b.id) {
    if (a.id === 'SC') return { status: 'self', label: 'Not strictly bound', reason: 'The Supreme Court ordinarily follows its previous decisions but may depart from them (for example, where a decision was given per incuriam or is shown to be wrong). Where two of its decisions conflict, lower courts follow the later one.' };
    if (a.id === 'CA') return { status: 'self', label: 'Generally bound', reason: 'The Court of Appeal generally follows its own previous decisions, subject to recognised exceptions (conflicting decisions of its own, a decision inconsistent with a Supreme Court decision, or one given per incuriam).' };
    return { status: 'coordinate', label: 'Persuasive (coordinate court)', reason: `A ${a.short} is not bound by another judge of coordinate jurisdiction; the decision is persuasive and is usually followed for consistency.` };
  }
  if (a.level < b.level) {
    const scoped = a.level >= 3 ? ' within its appellate or supervisory jurisdiction' : '';
    return { status: 'binding', label: 'Binding', reason: `Under vertical stare decisis the ${a.short} binds the ${b.short}${scoped}. Only the ratio decidendi binds; obiter dicta are persuasive.` };
  }
  if (a.level === b.level) return { status: 'coordinate', label: 'Persuasive (coordinate court)', reason: `The ${a.short} and the ${b.short} are courts of coordinate jurisdiction; neither binds the other.` };
  return { status: 'not-binding', label: 'Not binding (lower court)', reason: `A decision of the ${a.short} does not bind the ${b.short}, a higher court; it may be considered for its reasoning.` };
}

/** Weight of an authority when cited before a given forum (default: a State High Court). */
export function weightFor(court, forum = 'HC') {
  if (!court) return { status: 'unknown', label: 'Court not stated', reason: 'The citation does not show which court decided the case. Check the report.' };
  return bindingEffect(court, forum);
}

function titleCase(s) {
  return String(s).toLowerCase().replace(/(^|[\s-])([a-z])/g, (m, p, c) => p + c.toUpperCase());
}

export const FORUMS = [
  { id: 'SC', label: 'Supreme Court' },
  { id: 'CA', label: 'Court of Appeal' },
  { id: 'FHC', label: 'Federal High Court' },
  { id: 'HC', label: 'State High Court' },
  { id: 'FCTHC', label: 'FCT High Court' },
  { id: 'NIC', label: 'National Industrial Court' },
  { id: 'MC', label: "Magistrates' Court" },
];
