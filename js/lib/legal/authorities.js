/* ============================================================
   Legal engine — table of authorities (DOM-free)

   Groups everything a document cites into a table of
   authorities: cases (Nigerian by court, then foreign),
   the Constitution, statutes with their sections, and rules of
   court with Order/Rule references. Each entry lists the
   pinpoints used and the pages where it is cited (from the
   page markers of an uploaded PDF).
   ============================================================ */

import { parseCitations, treatmentAt, jurisdictionLabel } from './citations.js';
import { COURTS, weightFor } from './courts.js';
import { pageMap, escapeRe } from './text.js';

const COURT_ORDER = { SC: 1, FSC: 2, PC: 3, WACA: 4, CA: 5, FHC: 6, NIC: 6, HC: 6, FCTHC: 6, SCA: 7, CCA: 7, TRIB: 8, MC: 9, LOW: 9 };

const caseKeyOf = (p) => (p ? p.title.toLowerCase().replace(/\(nig(?:eria)?\.?\)|\b(?:ltd|limited|plc|nig|&|and|the|co|of)\b|[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim() : null);
const firstParty = (p) => (p ? caseKeyOf({ title: p.a }).split(' ').filter(w => w.length > 2).slice(0, 2).join(' ') : '');

/**
 * Builds the table of authorities.
 * opts.forum — court id the table is prepared for (weight column); defaults to the court that decided the document.
 * opts.selfCourt — court of the document itself (a judgment's own court), used as forum when none is given.
 */
export function buildAuthorities(text, opts = {}) {
  const src = String(text || '');
  const pages = pageMap(src);
  const pg = (i) => (pages ? pages.at(i) : null);
  const parsed = opts.parsed || parseCitations(src);
  const forum = opts.forum || opts.selfCourt?.id || null;

  /* ---- cases ---- */
  const cases = [];
  const byKey = new Map();
  for (const c of parsed.cases) {
    const pk = caseKeyOf(c.parties);
    let entry = (pk && byKey.get(`p:${pk}`)) || byKey.get(`c:${c.normalised}`);
    // A parallel citation belongs with the one it follows.
    if (!entry && c.parallelOf != null) entry = byKey.get(`c:${parsed.cases[c.parallelOf].normalised}`);
    if (!entry) {
      entry = { kind: 'case', title: c.parties?.title || null, parties: c.parties || null, citations: [], court: null, jurisdiction: c.jurisdiction, foreign: c.foreign, year: c.year, pinpoints: [], pages: new Set(), mentions: 0, treatments: new Set(), per: new Set(), warnings: new Set() };
      cases.push(entry);
    }
    if (!entry.citations.includes(c.normalised)) entry.citations.push(c.normalised);
    if (!entry.title && c.parties) { entry.title = c.parties.title; entry.parties = c.parties; }
    if (c.court && (!entry.court || (entry.court.inferred && !c.court.inferred) || (entry.court.source === 'series' && c.court.source === 'citation'))) entry.court = c.court;
    if (c.pinpoint) entry.pinpoints.push(c.pinpoint.text);
    if (c.per) entry.per.add(c.per);
    for (const w of c.warnings || []) entry.warnings.add(w);
    const p = pg(c.index); if (p) entry.pages.add(p);
    entry.mentions++;
    const t = treatmentAt(src, c.index); if (t) entry.treatments.add(t);
    if (pk) byKey.set(`p:${pk}`, entry);
    byKey.set(`c:${c.normalised}`, entry);
  }
  // "(supra)" and later bare mentions of a case already cited in full.
  for (const e of cases) {
    if (!e.parties?.b) continue;
    const a = firstParty(e.parties);
    if (!a) continue;
    const re = new RegExp(`\\b${escapeRe(e.parties.a.split(/\s+/)[0])}[^;\\n]{0,80}?\\s+v\\.?\\s+${escapeRe(e.parties.b.split(/\s+/)[0])}[^;\\n]{0,60}?\\(?\\s*supra\\s*\\)?`, 'gi');
    for (let m; (m = re.exec(src));) {
      e.mentions++;
      const p = pg(m.index); if (p) e.pages.add(p);
      const t = treatmentAt(src, m.index); if (t) e.treatments.add(t);
      e.supra = true;
    }
  }
  for (const e of cases) {
    e.pages = [...e.pages].sort((x, y) => x - y);
    e.treatments = [...e.treatments];
    e.per = [...e.per];
    e.warnings = [...e.warnings];
    e.pinpoints = [...new Set(e.pinpoints)];
    e.display = `${e.title || 'Unnamed case'} ${e.citations.join('; ')}`;
    e.courtName = e.court ? COURTS[e.court.id]?.short || e.court.name : null;
    e.weight = forum ? weightFor(e.court ? COURTS[e.court.id] : null, forum) : null;
    e.group = e.foreign ? 'foreign' : 'nigerian';
    e.jurisdictionLabel = jurisdictionLabel(e.jurisdiction);
  }
  const sortCase = (x, y) => (x.title || '~').localeCompare(y.title || '~');
  const nigerian = cases.filter(c => !c.foreign).sort((x, y) => (COURT_ORDER[x.court?.id] || 20) - (COURT_ORDER[y.court?.id] || 20) || sortCase(x, y));
  const foreign = cases.filter(c => c.foreign).sort(sortCase);

  /* ---- statutes & provisions ---- */
  const statutes = parsed.statutes.map(s => {
    const provs = parsed.provisions.filter(p => p.statute === s.key);
    const byRef = new Map();
    for (const p of provs) {
      const cur = byRef.get(p.ref) || { ref: p.ref, pages: new Set(), count: 0, inferred: p.inferred };
      cur.count++; const pp = pg(p.index); if (pp) cur.pages.add(pp);
      byRef.set(p.ref, cur);
    }
    const pagesSet = new Set(s.mentions.map(m => pg(m.index)).filter(Boolean));
    for (const p of provs) { const pp = pg(p.index); if (pp) pagesSet.add(pp); }
    return {
      kind: s.kind, name: s.display, key: s.key, year: s.year, cap: s.cap, mentions: s.mentions.length, inferred: s.mentions.every(m => m.inferred),
      provisions: [...byRef.values()].map(r => ({ ...r, pages: [...r.pages].sort((a, b) => a - b) })).sort((a, b) => provNum(a.ref) - provNum(b.ref)),
      pages: [...pagesSet].sort((a, b) => a - b),
    };
  });
  const constitution = statutes.filter(s => s.kind === 'constitution');
  const acts = statutes.filter(s => s.kind !== 'constitution').sort((a, b) => a.name.localeCompare(b.name));
  const loose = parsed.provisions.filter(p => !p.statute).map(p => ({ ref: p.ref, page: pg(p.index) }));

  /* ---- rules of court ---- */
  const rules = parsed.rules.map(r => {
    const refs = parsed.refs.filter(x => x.rules === r.display);
    return { name: r.display, refs: [...new Set(refs.map(x => x.ref))], pages: [...new Set([...r.mentions, ...refs].map(m => pg(m.index)).filter(Boolean))].sort((a, b) => a - b) };
  }).sort((a, b) => a.name.localeCompare(b.name));
  const looseRules = parsed.refs.filter(x => !x.rules).map(x => ({ ref: x.ref, page: pg(x.index) }));

  return {
    forum, hasPages: Boolean(pages),
    cases: { nigerian, foreign, all: [...nigerian, ...foreign] },
    constitution, statutes: acts, rules, loose, looseRules,
    counts: { cases: cases.length, statutes: acts.length + constitution.length, rules: rules.length, provisions: parsed.provisions.length },
  };
}

function provNum(ref) { const m = String(ref).match(/(\d+)/); return m ? Number(m[1]) : 9999; }

const pagesTxt = (p) => (p && p.length ? `${p.length > 1 ? 'pp.' : 'p.'} ${p.join(', ')}` : '');

/** Plain-text / Markdown table of authorities. */
export function authoritiesMarkdown(toa, { heading = '## Table of authorities' } = {}) {
  const out = [heading, ''];
  const caseLine = (c) => `- ${c.title ? `*${c.title}*` : '*Unnamed case*'} ${c.citations.join('; ')}${c.courtName ? ` — ${c.courtName}${c.court?.inferred ? ' (inferred)' : ''}` : ''}${c.pinpoints.length ? `; pinpoint ${c.pinpoints.join(', ')}` : ''}${c.pages.length ? `; cited at ${pagesTxt(c.pages)}` : ''}`;
  if (toa.cases.nigerian.length) out.push('### Nigerian cases', '', ...toa.cases.nigerian.map(caseLine), '');
  if (toa.cases.foreign.length) out.push('### Foreign cases (persuasive)', '', ...toa.cases.foreign.map(caseLine), '');
  if (toa.constitution.length) {
    out.push('### Constitution', '');
    for (const s of toa.constitution) out.push(`- ${s.name}${s.provisions.length ? `: ${s.provisions.map(p => p.ref).join('; ')}` : ''}${s.pages.length ? ` — ${pagesTxt(s.pages)}` : ''}`);
    out.push('');
  }
  if (toa.statutes.length) {
    out.push('### Statutes', '');
    for (const s of toa.statutes) out.push(`- ${s.name}${s.provisions.length ? `: ${s.provisions.map(p => p.ref + (p.inferred ? ' (inferred)' : '')).join('; ')}` : ''}${s.pages.length ? ` — ${pagesTxt(s.pages)}` : ''}`);
    out.push('');
  }
  if (toa.rules.length) {
    out.push('### Rules of court', '');
    for (const r of toa.rules) out.push(`- ${r.name}${r.refs.length ? `: ${r.refs.join('; ')}` : ''}${r.pages.length ? ` — ${pagesTxt(r.pages)}` : ''}`);
    out.push('');
  }
  if (!toa.counts.cases && !toa.counts.statutes && !toa.counts.rules) out.push('No authorities were recognised in the text.', '');
  return out.join('\n');
}

export { pagesTxt };
