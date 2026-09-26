/* ============================================================
   Legal engine — obligations and deadlines (DOM-free)

   Finds who must do what by when: sentences where a party
   "shall", "must", "agrees to", "undertakes to" or "covenants
   to" act, the deadline attached ("on or before 15 December
   2025", "within 14 days of the Commencement Date", "three
   months' notice before expiry") and any recurrence. Relative
   deadlines are resolved against dates the document itself
   defines (commencement, execution, expiry, defined dates).
   Anything the text does not fix stays unresolved.
   ============================================================ */

import { sentences, findDates, parseDate, addToDate, oneLine, clip, parseNumberWord, NUMBER_WORD_RE, formatDate, escapeRe } from './text.js';

const MODAL = String.raw`(?:shall(?:\s+not)?|must(?:\s+not)?|(?:hereby\s+)?agrees?\s+(?:not\s+)?to|(?:hereby\s+)?undertakes?\s+(?:not\s+)?to|(?:hereby\s+)?covenants?\s+(?:with\s+the\s+\w+\s+)?(?:not\s+)?to|is\s+(?:required|obliged|obligated)\s+to|will(?:\s+not)?)`;
const GENERIC_SUBJECT = /^(?:each|either|both|the)\s+part(?:y|ies)$|^part(?:y|ies)$/i;
const NUM = NUMBER_WORD_RE;
const UNIT = '(business\\s+days?|working\\s+days?|calendar\\s+days?|days?|weeks?|months?|years?)';

/** Dates the document itself fixes, keyed for relative deadlines. */
export function findAnchors(text, definedTerms = [], overrides = {}) {
  const src = String(text || '');
  const anchors = {};
  const set = (key, iso, label, source) => { if (iso && !anchors[key]) anchors[key] = { key, date: iso, label, source }; };
  const LABELS = { execution: 'Date of this agreement', commencement: 'Commencement date', expiry: 'Expiry of the term' };
  for (const [k, v] of Object.entries(overrides)) if (v && k !== 'expiry') set(k, v, LABELS[k] || k, 'set by you');
  for (const t of definedTerms) {
    const d = findDates(t.definition || '')[0];
    if (d && /date|day/i.test(t.term)) set(t.term.toLowerCase(), d.date, t.term, `defined term "${t.term}"`);
  }
  const made = src.match(new RegExp(`\\b(?:made|dated|entered\\s+into)\\s+(?:on\\s+|this\\s+)?(?:the\\s+)?([^\\n]{0,8}?(?:\\d{1,2}(?:st|nd|rd|th)?\\s+(?:day\\s+of\\s+)?[A-Za-z]+,?\\s+\\d{4}|[A-Za-z]+\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\/\\d{1,2}\\/\\d{4}))`, 'i'));
  if (made) { const d = findDates(made[1])[0]; if (d) set('execution', d.date, 'Date of this agreement', 'the opening words'); }
  const comm = src.match(/\bcommenc(?:e|es|ing|ement)\b[^.\n]{0,40}?\b(?:on|from)\s+(?:the\s+)?([^.;\n]{4,40}?\d{4})/i);
  if (comm) { const d = findDates(comm[1])[0]; if (d) set('commencement', d.date, 'Commencement date', 'the term clause'); }
  if (!anchors.commencement) {
    const k = Object.keys(anchors).find(x => /commencement|effective|start/.test(x));
    if (k) set('commencement', anchors[k].date, anchors[k].label, anchors[k].source);
  }
  if (!anchors.commencement && anchors.execution) set('commencement', anchors.execution.date, 'Date of this agreement', 'no separate commencement date, so the agreement date is used');
  // Term → expiry.
  const term = src.match(new RegExp(`\\b(?:for\\s+(?:a|an\\s+initial)\\s+(?:term|period)\\s+of|shall\\s+(?:continue|remain\\s+in\\s+force)\\s+for(?:\\s+a\\s+period\\s+of)?)\\s+(${NUM}(?:\\s*\\(\\d+\\))?)\\s*${UNIT}`, 'i'));
  if (term && anchors.commencement) {
    const n = parseNumberWord(term[1]);
    if (n) {
      const end = addToDate(addToDate(anchors.commencement.date, n, term[2]), -1, 'days');
      set('expiry', end, 'Expiry of the term', `${oneLine(term[0])} from ${formatDate(anchors.commencement.date)}`);
    }
  }
  if (overrides.expiry) anchors.expiry = { key: 'expiry', date: overrides.expiry, label: LABELS.expiry, source: 'set by you' };
  return anchors;
}

const trimAnchor = (a) => oneLine(String(a || '').split(/\s+(?:and|if|or|to|unless|provided|which|whichever|failing)\b/i)[0]);

function resolveAnchor(anchorText, anchors) {
  const a = String(anchorText || '').toLowerCase();
  for (const key of Object.keys(anchors)) if (key.length > 3 && a.includes(key)) return anchors[key];
  if (/commencement|start\s+date|effective\s+date/.test(a)) return anchors.commencement || null;
  if (/(?:date\s+of\s+(?:this|the)\s+(?:agreement|deed|lease)|date\s+hereof|execution|signing|signature)/.test(a)) return anchors.execution || null;
  if (/expir|end\s+of\s+the\s+(?:term|tenancy|lease)|determination\s+of\s+the\s+term/.test(a)) return anchors.expiry || null;
  if (/\btoday\b|date\s+of\s+(?:this\s+)?(?:judgment|order)/.test(a)) return anchors.today || null;
  // "within 7 days of delivery" when the document defines a "Delivery Date": use it, but say it is an assumption.
  const word = (a.match(/^(?:the\s+)?([a-z]+)/) || [])[1];
  if (word && word.length > 3) {
    const k = Object.keys(anchors).find(x => x.startsWith(`${word} `) && /date$/.test(x));
    if (k) return { ...anchors[k], assumed: true, label: `${anchors[k].label} (assumed)` };
  }
  return null;
}

/** Deadline found in a sentence, resolved to a date when the document allows it. */
export function parseDeadline(sentence, anchors = {}) {
  const s = String(sentence || '');
  const lower = s.toLowerCase();
  let recurrence = null;
  if (/\b(?:per\s+annum|annually|yearly|each\s+year|every\s+year|annual)\b/i.test(s) && /\bpay|rent|renew|fee|charge|submit|deliver\b/i.test(s)) recurrence = 'yearly';
  else if (/\b(?:monthly|each\s+month|every\s+month|per\s+calendar\s+month)\b/i.test(s) && !/interest/i.test(s)) recurrence = 'monthly';
  else if (/\b(?:quarterly|each\s+quarter|every\s+quarter)\b/i.test(s)) recurrence = 'quarterly';
  else if (/\b(?:weekly|each\s+week|every\s+week)\b/i.test(s)) recurrence = 'weekly';

  // Absolute date with a deadline word before it.
  for (const d of findDates(s)) {
    const before = lower.slice(Math.max(0, d.index - 30), d.index);
    if (/(?:on\s+or\s+before|not\s+later\s+than|no\s+later\s+than|by|before|on|until|latest)\s*(?:the\s+)?$/.test(before)) {
      return { type: 'date', text: oneLine(s.slice(Math.max(0, d.index - before.length + before.search(/(?:on\s+or\s+before|not\s+later|no\s+later|by|before|on|until|latest)/)), d.end)), due: d.date, resolved: true, recurrence };
    }
  }
  // "on or before the Delivery Date"
  const onDefined = s.match(/\b(?:on\s+or\s+before|not\s+later\s+than|no\s+later\s+than|by|on)\s+the\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}\s+Date)\b/);
  if (onDefined) {
    const a = resolveAnchor(onDefined[1], anchors);
    return { type: 'date', text: onDefined[0], due: a?.date || null, anchor: onDefined[1], resolved: Boolean(a), recurrence };
  }
  // "at least three (3) months' written notice before the expiry of the term"
  const before = s.match(new RegExp(`\\b(?:at\\s+least|not\\s+less\\s+than|no\\s+less\\s+than)?\\s*(${NUM}(?:\\s*\\(\\d+\\))?)\\s*${UNIT}'?s?'?\\s+(?:prior\\s+)?(?:written\\s+)?(?:notice\\s+)?(?:before|prior\\s+to)\\s+(?:the\\s+)?([^,.;]{3,60})`, 'i'));
  if (before) {
    const n = parseNumberWord(before[1]);
    const a = resolveAnchor(before[3], anchors);
    return { type: 'relative', text: oneLine(before[0]).replace(before[3], trimAnchor(before[3])), n, unit: before[2].toLowerCase(), anchor: trimAnchor(before[3]), direction: 'before', due: a && n ? addToDate(a.date, -n, before[2]) : null, resolved: Boolean(a && n), anchorLabel: a?.label, recurrence };
  }
  // "within 14 days of the Commencement Date" / "within 30 days after delivery"
  const within = s.match(new RegExp(`\\bwithin\\s+(${NUM}(?:\\s*\\(\\d+\\))?)\\s*${UNIT}\\s+(?:of|from|after|following|of\\s+the\\s+date\\s+of)\\s+(?:the\\s+)?([^,.;]{3,70})`, 'i'))
    || s.match(new RegExp(`\\b(${NUM}(?:\\s*\\(\\d+\\))?)\\s*${UNIT}\\s+(?:after|from|following)\\s+(?:the\\s+)?([^,.;]{3,70})`, 'i'));
  if (within) {
    const n = parseNumberWord(within[1]);
    const a = resolveAnchor(within[3], anchors);
    return { type: 'relative', text: oneLine(within[0]).replace(within[3], trimAnchor(within[3])), n, unit: within[2].toLowerCase(), anchor: trimAnchor(within[3]), direction: 'after', due: a && n ? addToDate(a.date, n, within[2]) : null, resolved: Boolean(a && n), assumed: Boolean(a?.assumed), anchorLabel: a?.label, recurrence };
  }
  // A bare period: "within 7 days" with no stated trigger.
  const bare = s.match(new RegExp(`\\bwithin\\s+(${NUM}(?:\\s*\\(\\d+\\))?)\\s*${UNIT}`, 'i'));
  if (bare) return { type: 'relative', text: oneLine(bare[0]), n: parseNumberWord(bare[1]), unit: bare[2].toLowerCase(), anchor: null, direction: 'after', due: null, resolved: false, recurrence };
  // Notice periods: "by giving one (1) month's notice"
  const notice = s.match(new RegExp(`\\b(${NUM}(?:\\s*\\(\\d+\\))?)\\s*${UNIT}'?s?'?\\s+(?:prior\\s+)?(?:written\\s+)?notice`, 'i'));
  if (notice) return { type: 'notice', text: oneLine(notice[0]), n: parseNumberWord(notice[1]), unit: notice[2].toLowerCase(), due: null, resolved: false, recurrence };
  // "on the execution of this Agreement"
  const onEvent = s.match(/\b(?:on|upon|at)\s+(?:the\s+)?(execution|signing|commencement|expiry|expiration|delivery|completion)\s+of\s+(?:this|the)\s+([A-Za-z]+)/i);
  if (onEvent) {
    const a = resolveAnchor(onEvent[1], anchors);
    return { type: 'event', text: oneLine(onEvent[0]), anchor: onEvent[1], due: a?.date || null, resolved: Boolean(a), recurrence };
  }
  if (recurrence) return { type: 'recurring', text: recurrence, due: null, resolved: false, recurrence };
  return null;
}

/**
 * Extracts obligations from clauses.
 * clauses: [{ number, heading, text, start }] (offsets into the full text for page lookup).
 * parties: aliases the document uses ("Landlord", "Supplier" …).
 */
export function extractObligations(clauses, { parties = [], anchors = {}, pageOf = () => null } = {}) {
  const aliases = [...new Set(parties.filter(Boolean))].sort((a, b) => b.length - a.length);
  const aliasAlt = aliases.map(escapeRe).join('|');
  const subjRe = new RegExp(String.raw`(?:^\s*(?:(?:\d{1,2}(?:\.\d{1,2})*\.?|\([0-9a-z]{1,4}\))\s+)?|[,;:(\n]\s*|\b(?:and|that|then|where|if|unless|provided\s+that)\s+)((?:the\s+|each\s+|either\s+|both\s+)?(?:${aliasAlt ? `${aliasAlt}|` : ''}[Pp]art(?:y|ies)))\s+(?:hereby\s+|shall\s+at\s+all\s+times\s+|at\s+all\s+times\s+|further\s+|also\s+)?(${MODAL})\b`, 'gi');
  const out = [];
  let n = 0;
  for (const cl of clauses) {
    for (const s of sentences(cl.text)) {
      const t = s.text;
      if (t.length < 12 || t.length > 900) continue;
      subjRe.lastIndex = 0;
      const m = subjRe.exec(t);
      if (!m) continue;
      const subject = m[1].replace(/^the\s+/i, '');
      const isAlias = aliases.some(a => a.toLowerCase() === subject.toLowerCase());
      if (!isAlias && !GENERIC_SUBJECT.test(m[1].trim())) continue;
      const modal = m[2].toLowerCase();
      const negative = /\bnot\b/.test(modal);
      let action = t.slice(m.index + m[0].length).trim().replace(/^(?:be\s+entitled\s+to\s+)?/, '');
      if (/^(?:be\s+(?:governed|construed|deemed|for\s+a\s+term|renewed|liable|responsible|entitled|bound|at\s+liberty)|have\s+(?:the\s+)?(?:right|option)|continue|commence|remain|apply|mean|not\s+be\s+(?:liable|responsible))/i.test(action)) continue;
      const party = isAlias ? aliases.find(a => a.toLowerCase() === subject.toLowerCase()) : subject.replace(/^./, c => c.toUpperCase());
      const mayOnly = /^may\b/i.test(action);
      if (mayOnly) continue;
      // "pay 40% within 10 days … and the balance within 30 days after delivery" → two rows.
      const parts = t.split(/\s+and\s+(?=the\s+(?:balance|remainder|rest)\b)/i);
      if (parts.length > 1) {
        const verb = (action.match(/^(\w+)/) || [])[1] || '';
        parts.forEach((part, pi) => {
          const act = pi === 0 ? action.split(/\s+and\s+(?=the\s+(?:balance|remainder|rest)\b)/i)[0] : `${verb} ${part}`;
          out.push({ id: `ob${++n}`, party, kind: negative ? 'prohibition' : 'obligation', action: clip(act.replace(/\.$/, ''), 200), sentence: oneLine(t),
            clause: cl.number ? { number: cl.number, heading: cl.heading || null } : null, page: pageOf((cl.start || 0) + s.start), deadline: parseDeadline(part, anchors) });
        });
        continue;
      }
      const deadline = parseDeadline(t, anchors);
      out.push({
        id: `ob${++n}`,
        party,
        kind: negative ? 'prohibition' : 'obligation',
        action: clip(`${negative ? 'must not ' : ''}${action}`.replace(/\.$/, ''), 200),
        sentence: oneLine(t),
        clause: cl.number ? { number: cl.number, heading: cl.heading || null } : null,
        page: pageOf((cl.start || 0) + s.start),
        deadline,
      });
    }
  }
  return out;
}

/** Calendar event payload (Calendar tool storage shape) for an obligation. */
export function obligationToEvent(ob, { date, source = 'Legal document', leadDays = 0 } = {}) {
  const due = date || ob.deadline?.due;
  if (!due) return null;
  const rec = ob.deadline?.recurrence;
  const title = clip(`${ob.party}: ${ob.action}`.replace(/\s+/g, ' '), 90);
  const ref = ob.clause ? `Clause ${ob.clause.number}${ob.clause.heading ? ` (${ob.clause.heading})` : ''}` : 'Obligation';
  const events = [{
    title, date: due, isAllDay: true, category: 'deadline', recurrence: ['monthly', 'yearly', 'weekly'].includes(rec) ? rec : 'none',
    description: `${ref}: ${ob.sentence}\n\nSource: ${source}. Extracted automatically; check the date against the document.`,
  }];
  if (leadDays > 0) {
    events.push({ ...events[0], title: clip(`Reminder (${leadDays}d): ${title}`, 90), date: addToDate(due, -leadDays, 'days'), category: 'work', recurrence: 'none' });
  }
  return events;
}

export { parseDate };
