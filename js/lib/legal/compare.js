/* ============================================================
   Legal engine — comparing two judgments (DOM-free)

   Aligns the issues of two judgments by wording, finds the
   authorities both rely on (and where they treat the same case
   differently), works out which court is superior and whether
   one decision binds the court of the other, puts them in date
   order, and checks whether the later judgment cites the
   earlier one and how.
   ============================================================ */

import { extractJudgment } from './judgment.js';
import { bindingEffect, COURTS } from './courts.js';
import { similarity, escapeRe, formatDate } from './text.js';
import { treatmentAt } from './citations.js';

const caseKey = (c) => (c.title || c.citations[0] || '').toLowerCase().replace(/\(nig(?:eria)?\.?\)|\b(?:ltd|limited|plc|nig|&|and|the|co|of|anor|ors)\b|[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const sameCase = (x, y) => x.citations.some(c => y.citations.includes(c)) || (x.title && y.title && caseKey(x) === caseKey(y));

/** Greedy best-match alignment of two issue lists. */
export function alignIssues(a, b, threshold = 0.18) {
  const pairs = [];
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) pairs.push({ i, j, s: similarity(a[i].text, b[j].text) });
  pairs.sort((x, y) => y.s - x.s);
  const usedA = new Set(), usedB = new Set(), rows = [];
  for (const p of pairs) {
    if (p.s < threshold || usedA.has(p.i) || usedB.has(p.j)) continue;
    usedA.add(p.i); usedB.add(p.j);
    rows.push({ a: a[p.i], b: b[p.j], ai: p.i, bi: p.j, score: Math.round(p.s * 100) });
  }
  a.forEach((x, i) => { if (!usedA.has(i)) rows.push({ a: x, b: null, ai: i, bi: null, score: 0 }); });
  b.forEach((x, j) => { if (!usedB.has(j)) rows.push({ a: null, b: x, ai: null, bi: j, score: 0 }); });
  return rows.sort((x, y) => (x.ai ?? 99) - (y.ai ?? 99) || (x.bi ?? 99) - (y.bi ?? 99));
}

// The treatment is often stated in the sentence after the citation ("That decision is distinguishable …").
function nearTreatment(text, at) {
  const win = text.slice(at, at + 420);
  if (/\boverrul/i.test(win)) return 'overruled';
  if (/\bdistinguish/i.test(win)) return 'distinguished';
  if (/\bnot\s+follow|declin\w*\s+to\s+follow|depart\w*\s+from/i.test(win)) return 'not followed';
  return treatmentAt(text, at);
}

function citesOther(text, other) {
  const bySuit = other.suitNo && text.includes(other.suitNo);
  if (!other.parties) return bySuit ? { how: 'by appeal/suit number', at: text.indexOf(other.suitNo) } : null;
  const words = (n) => String(n || '').split(/[\s-]+/).filter(w => w.length > 3 && !/^(chief|mrs?|miss|alhaji|alhaja|prince|engr|barr|limited|nigeria|bank|trust|plc)\.?$/i.test(w));
  const as = words(other.parties.a?.[0]), bs = String(other.parties.b?.[0] || '').split(/\s+/).filter(w => w.length > 2).slice(0, 1);
  for (const a of as) for (const b of bs) {
    const m = text.match(new RegExp(`${escapeRe(a)}[^;\\n]{0,80}?\\s+v\\.?\\s+[^;\\n]{0,40}?${escapeRe(b)}`, 'i'));
    if (m) return { how: 'by name', at: m.index, treatment: nearTreatment(text, m.index) };
  }
  return bySuit ? { how: 'by appeal/suit number', at: text.indexOf(other.suitNo), treatment: treatmentAt(text, text.indexOf(other.suitNo)) } : null;
}

export function compareJudgments(textA, textB) {
  const A = extractJudgment(textA), B = extractJudgment(textB);
  const cA = A.court ? COURTS[A.court.id] : null, cB = B.court ? COURTS[B.court.id] : null;

  let superior = null;
  if (cA && cB) superior = cA.level < cB.level ? 'a' : cB.level < cA.level ? 'b' : 'equal';
  const aOnB = cA && cB ? bindingEffect(cA, cB) : null;
  const bOnA = cA && cB ? bindingEffect(cB, cA) : null;

  let order = null;
  if (A.date && B.date) {
    const days = Math.round((Date.parse(B.date.iso) - Date.parse(A.date.iso)) / 86400000);
    const later = days > 0 ? 'b' : days < 0 ? 'a' : 'same';
    const years = Math.abs(days) / 365.25;
    order = { later, days: Math.abs(days), text: later === 'same' ? 'Delivered on the same day' : `${later === 'a' ? 'A' : 'B'} was delivered ${years >= 1 ? `${years.toFixed(1)} years` : `${Math.abs(days)} days`} later (${formatDate((later === 'a' ? A : B).date.iso)})` };
  }

  // Does the later judgment cite the earlier one?
  const cites = { aCitesB: citesOther(textA, B), bCitesA: citesOther(textB, A) };

  // Authorities.
  const listA = A.authorities.cases.all, listB = B.authorities.cases.all;
  const shared = [], onlyA = [], onlyB = [];
  for (const x of listA) {
    const y = listB.find(z => sameCase(x, z));
    if (y) {
      const tA = x.treatments.filter(t => t !== 'referred to'), tB = y.treatments.filter(t => t !== 'referred to');
      const pos = (t) => t.includes('followed');
      const neg = (t) => t.some(v => ['distinguished', 'not followed', 'overruled', 'doubted'].includes(v));
      const conflict = (pos(tA) && neg(tB)) || (neg(tA) && pos(tB));
      shared.push({ title: x.title || y.title, citations: [...new Set([...x.citations, ...y.citations])], court: x.courtName || y.courtName, treatmentA: x.treatments, treatmentB: y.treatments, conflict });
    } else onlyA.push(x);
  }
  for (const y of listB) if (!listA.some(x => sameCase(x, y))) onlyB.push(y);
  // Mark the entry that is the other judgment itself.
  const firstWord = (d) => String(d.parties?.a?.[0] || '').split(/[\s]+/).filter(w => w.length > 3 && !/^(chief|mrs?\.?|miss|alhaji|prince)$/i.test(w)).pop();
  const wa = firstWord(A), wb = firstWord(B);
  for (const y of onlyB) if (wa && y.title && y.title.toLowerCase().includes(wa.toLowerCase())) y.isOther = 'A';
  for (const x of onlyA) if (wb && x.title && x.title.toLowerCase().includes(wb.toLowerCase())) x.isOther = 'B';
  const statA = A.authorities.statutes.concat(A.authorities.constitution), statB = B.authorities.statutes.concat(B.authorities.constitution);
  const base = (x) => String(x.key || x.name).split(':')[0];
  const sharedStatutes = statA.filter(s => statB.some(t => base(t) === base(s))).map(s => {
    const t = statB.find(x => base(x) === base(s));
    const provs = s.provisions.map(p => p.ref).filter(r => t.provisions.some(q => q.ref === r));
    return { name: s.name, provisions: provs };
  });

  const issues = alignIssues(A.issues, B.issues);
  const outcomeSame = A.outcome && B.outcome ? A.outcome.label === B.outcome.label : null;

  return { a: A, b: B, superior, aOnB, bOnA, order, cites, issues, shared, onlyA, onlyB, sharedStatutes, conflicts: shared.filter(s => s.conflict).length, outcomeSame };
}

export function comparisonMarkdown(r) {
  const L = ['# Case comparison', ''];
  const head = (k, d) => `**${k}.** ${d.title}${d.suitNo ? ` (${d.suitNo})` : ''} — ${d.court?.name || 'court not identified'}${d.date ? `, ${d.date.text}` : ''}${d.outcome ? `; ${d.outcome.label}` : ''}`;
  L.push(head('A', r.a), '', head('B', r.b), '');
  L.push('## Precedent', '');
  if (r.superior) L.push(`- Superior court: ${r.superior === 'equal' ? 'coordinate courts' : r.superior.toUpperCase()}`);
  if (r.aOnB) L.push(`- A before B's court: ${r.aOnB.label}. ${r.aOnB.reason}`);
  if (r.bOnA) L.push(`- B before A's court: ${r.bOnA.label}. ${r.bOnA.reason}`);
  if (r.order) L.push(`- ${r.order.text}`);
  if (r.cites.bCitesA) L.push(`- B cites A${r.cites.bCitesA.treatment ? ` (${r.cites.bCitesA.treatment})` : ''}.`);
  if (r.cites.aCitesB) L.push(`- A cites B${r.cites.aCitesB.treatment ? ` (${r.cites.aCitesB.treatment})` : ''}.`);
  L.push('', '## Issues', '', '| A | Match | B |', '|---|---|---|');
  for (const row of r.issues) L.push(`| ${row.a ? row.a.text.replace(/\|/g, '/') : '—'} | ${row.a && row.b ? `${row.score}%` : ''} | ${row.b ? row.b.text.replace(/\|/g, '/') : '—'} |`);
  L.push('', '## Authorities relied on by both', '');
  if (!r.shared.length) L.push('None in common.');
  for (const s of r.shared) L.push(`- *${s.title || s.citations[0]}* ${s.citations.join('; ')} — A: ${s.treatmentA.join(', ') || 'cited'}; B: ${s.treatmentB.join(', ') || 'cited'}${s.conflict ? ' **(treated differently)**' : ''}`);
  if (r.sharedStatutes.length) { L.push('', '## Statutes in common', ''); for (const s of r.sharedStatutes) L.push(`- ${s.name}${s.provisions.length ? `: ${s.provisions.join(', ')}` : ''}`); }
  L.push('', '---', '*On-device comparison by pattern matching. Read both judgments before relying on the alignment.*');
  return L.join('\n');
}

export { COURTS };
