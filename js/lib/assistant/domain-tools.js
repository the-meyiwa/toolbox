/* ============================================================
   TOOLBOX — Assistant tools for the Music Theory Library,
   Business & Finance and Networking tools

   music_library   search the library (topics, instruments, terms)
   music_theory    spell scales/chords, name chords, progressions,
                   keys, intervals, transposition
   business_calc   every Business & Finance calculator
   network_tool    every Networking tool
   cosmetics_database  products, ingredients and brands in the
                   Cosmetics Database (js/lib/cosmetics/assistant.js)

   Cards: js/lib/assistant/domain-cards.js
   ============================================================ */

import { BUSINESS_CALCULATORS, businessCalc } from '../business-calc.js';
import { NETWORK_ACTIONS } from '../network-calc.js';
import { COSMETICS_TOOL_DECLARATION } from '../cosmetics/declaration.js';

const SCALE_IDS = ['major', 'natural-minor', 'harmonic-minor', 'melodic-minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian', 'major-pentatonic', 'minor-pentatonic', 'blues', 'major-blues', 'whole-tone', 'diminished-hw', 'diminished-wh', 'chromatic', 'lydian-dominant', 'altered', 'phrygian-dominant', 'hungarian-minor', 'double-harmonic', 'bebop-dominant', 'hirajoshi', 'in', 'egyptian'];

export const DOMAIN_TOOL_DECLARATIONS = [
  COSMETICS_TOOL_DECLARATION,
  {
    name: 'music_library',
    description: 'Search the Music Theory Library (108 topics from first notes to expert analysis, world traditions and jazz; 25 instrument guides — how to hold and play, first lessons, practice, care and a beginner-to-advanced roadmap; 181 glossary terms). Returns the best entry\'s text for you to teach from, related entries, and a card that opens the library on that page. Use it for any music-theory or "how do I play/learn <instrument>" question, then explain at the person\'s level (beginner: plain words; expert: precise terms).',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Topic, instrument or term, e.g. "Dorian mode", "secondary dominants", "how to play violin", "hemiola".' },
        level: { type: 'string', enum: ['beginner', 'expert'], description: 'Who you are explaining to (default beginner).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'music_theory',
    description: 'Exact music-theory answers, correctly spelled (F♯ not G♭ where theory requires it), shown on a staff and keyboard the person can play. Actions: scale (tonic + scale), chord (symbol like "Bbmaj7", "F#m7b5", "G7b9", "C/E"), identify (notes → chord names), progression (key + Roman numerals, e.g. "ii V I", "i bVI bIII bVII"), key (key signature, relative key and diatonic chords), interval (two notes → interval name), transpose (notes by an interval, up or down). Scales: ' + SCALE_IDS.join(', ') + '.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['scale', 'chord', 'identify', 'progression', 'key', 'interval', 'transpose'] },
        tonic: { type: 'string', description: 'Tonic or key note, e.g. "C", "F#", "Bb".' },
        scale: { type: 'string', description: 'Scale id (for scale), default major.' },
        mode: { type: 'string', enum: ['major', 'minor'], description: 'For key and progression (default major).' },
        chord: { type: 'string', description: 'Chord symbol (for chord).' },
        notes: { type: 'array', items: { type: 'string' }, description: 'Notes, e.g. ["E", "G", "C"] or ["C4","E4"] (identify, interval, transpose).' },
        numerals: { type: 'string', description: 'Roman numerals (for progression).' },
        interval: { type: 'string', description: 'Interval for transpose: P1–P8, m2, M2, m3, M3, P4, A4, d5, P5, m6, M6, m7, M7.' },
        direction: { type: 'string', enum: ['up', 'down'] },
        sevenths: { type: 'boolean', description: 'Use seventh chords (key, progression).' },
      },
      required: ['action'],
    },
  },
  {
    name: 'business_calc',
    description: `Run a Toolbox Business & Finance calculator and show the result card (with a button to open the full tool). Calculators and their inputs:
vat {amount, rate, mode: add|remove} · margin_markup {cost, price, margin_pct | markup_pct — any two} · break_even {fixed_costs, price, variable_cost, expected_units} · loan {principal, rate_pct, years, extra_monthly} (repayment and amortisation) · compound_interest {principal, monthly_contribution, rate_pct, years, compounds_per_year} · npv_irr {rate_pct, initial_investment, cash_flows[]} · depreciation {method: sl|ddb|syd|units, cost, salvage, life_years, factor, total_units, units_per_year} · cap_table {founders[{name, shares}], pool_pct, rounds[{name, raise, pre_money}]} · runway {cash, monthly_costs, monthly_revenue, revenue_growth_pct, cost_growth_pct} · unit_economics {marketing_spend, new_customers, arpu, gross_margin_pct, churn_pct} · payroll_cost {salary, employer_tax_pct, pension_pct, benefits, equipment, overhead, recruitment, working_days} · salary_convert {amount, period: year|month|week|day|hour, hours_per_week, weeks_per_year, days_per_week} · meeting_cost {minutes, people, average_salary, hours_per_year, times_per_year} · pto_accrual {annual_days, periods_per_year, carried_over, taken, booked, months_elapsed, carry_cap} · subscription {cost, frequency: day|week|month|year}.
Put the inputs in "inputs". currency is an ISO code (default NGN). Invoices use create_invoice; currency conversion, timesheets, financial statements, email signatures, slides and mail are opened with open_toolbox_tool (currency-exchange, timesheet, financial-analyzer, email-signature, podium, mail).`,
    parameters: {
      type: 'object',
      properties: {
        calculator: { type: 'string', enum: BUSINESS_CALCULATORS },
        inputs: { type: 'object', description: 'The calculator\'s inputs (see the list).' },
        currency: { type: 'string', description: 'ISO currency code, e.g. NGN, USD, GBP.' },
      },
      required: ['calculator'],
    },
  },
  {
    name: 'network_tool',
    description: 'Run a Toolbox Networking tool: subnet (IPv4 CIDR maths: mask, network, broadcast, host range, usable hosts, private/public — target "192.168.1.10/24" or target plus prefix), url (parse a URL), ip (geolocation, ISP and ASN of an IP, or the person\'s own public IP if target is empty), dns (records; record_type A, AAAA, MX, TXT, NS, CNAME, SOA, CAA, SRV), reverse_dns (PTR of an IP), whois (registrar, dates, nameservers, status via RDAP), domain_available (is a domain registered), ssl (certificate issuer and expiry), robots (robots.txt and sitemaps of a site), mac (vendor of a MAC address), speed_test (runs the internet speed test). Shows a result card with a button to open the tool.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: Object.keys(NETWORK_ACTIONS) },
        target: { type: 'string', description: 'Domain, URL, IP, CIDR or MAC address.' },
        prefix: { type: 'string', description: 'Subnet prefix length or dotted mask (subnet only).' },
        record_type: { type: 'string', description: 'DNS record type (dns only, default A).' },
      },
      required: ['action'],
    },
  },
];

export const DOMAIN_TOOL_NAMES = DOMAIN_TOOL_DECLARATIONS.map(d => d.name);

/* ---------------- music ---------------- */

const strip = (s) => String(s || '').replace(/\[\[[a-z0-9-]+\|([^\]]+)\]\]/g, '$1').replace(/\*\*?([^*]+)\*\*?/g, '$1');

async function musicLibraryTool({ query = '', level = 'beginner' } = {}) {
  const L = await import('../music/library/index.js');
  const q = String(query).trim();
  const direct = L.resolveId(q.toLowerCase().replace(/\s+/g, '-'));
  const hits = L.searchLibrary(q, { limit: 8 });
  const best = direct ? { kind: direct.kind, id: direct.item.id } : hits.find(h => h.kind !== 'term') || hits[0];
  if (!best) return { status: 'error', message: `Nothing in the Music Theory Library matches "${q}". Try a topic (modes, cadences, voice leading), an instrument (guitar, kora) or a term (hemiola).` };
  const terms = hits.filter(h => h.kind === 'term').slice(0, 3).map(h => ({ term: h.title, def: h.def, topic: h.topic }));
  const expert = level === 'expert';
  if (best.kind === 'term') {
    const t = L.GLOSSARY.find(g => g.term === best.title);
    return { status: 'success', renderer: 'music-library', type: 'music-library', kind: 'term', term: t.term, def: t.def, topic: t.topic, open: t.topic ? { topic: L.getTopic(t.topic) ? t.topic : undefined, instrument: L.getInstrument(t.topic) ? t.topic : undefined } : { query: q }, message: `${t.term}: ${t.def}` };
  }
  const others = hits.filter(h => h.kind !== 'term' && h.id !== best.id).slice(0, 5).map(h => ({ id: h.id, title: h.title, kind: h.kind }));
  if (best.kind === 'instrument') {
    const i = L.getInstrument(best.id);
    return {
      status: 'success', renderer: 'music-library', type: 'music-library', kind: 'instrument', id: i.id, title: i.name, family: i.family,
      summary: strip(i.overview), tuning: strip(i.tuning), range: strip(i.range),
      howToPlay: (i.howToPlay || []).map(h => ({ h: h.h, text: strip(h.text) })), firstLessons: (i.firstLessons || []).map(strip),
      roadmap: (i.roadmap || []).map(r => ({ stage: r.stage, goals: r.goals.map(strip) })), related: others, terms,
      open: { instrument: i.id },
      message: `${i.name} (${i.family}). ${L.instrumentText(i).slice(0, expert ? 5000 : 3200)} Practice: ${(i.practice || []).map(strip).join(' ')} Common mistakes: ${(i.mistakes || []).map(strip).join(' ')} Care: ${(i.care || []).map(strip).join(' ')}\nShown as a card that opens the full guide.`,
    };
  }
  const t = L.getTopic(best.id);
  const simple = strip(L.blocksText(t.simple)), deep = strip(L.blocksText(t.deep));
  return {
    status: 'success', renderer: 'music-library', type: 'music-library', kind: 'topic', id: t.id, title: t.title,
    section: L.SECTIONS.find(s => s.id === t.section)?.title || t.section, level: L.LEVELS[t.level] || '',
    summary: strip(t.summary), simple: strip((t.simple || []).filter(b => typeof b === 'string').slice(0, 2).join(' ')).slice(0, 900),
    related: [...(t.related || []).map(id => L.resolveId(id)).filter(Boolean).map(r => ({ id: r.item.id, title: r.item.title || r.item.name, kind: r.kind })), ...others].filter((x, i, a) => a.findIndex(y => y.id === x.id) === i).slice(0, 6),
    terms, open: { topic: t.id },
    message: `${t.title} (${L.LEVELS[t.level] || ''}): ${strip(t.summary)}\n${simple.slice(0, 3500)}${deep ? `\nIn depth: ${deep.slice(0, expert ? 4500 : 1500)}` : ''}\nShown as a card with a button to open the full page (with its interactive demo).`,
  };
}

async function musicTheoryTool(args = {}) {
  const T = await import('../music/theory.js');
  const nn = (n, o = false) => T.noteName(n, { octave: o });
  const note = (s, oct = 4) => { const x = String(s || '').trim().replace(/♯/g, '#').replace(/♭/g, 'b'); return T.parseNote(/\d$/.test(x) ? x : `${x}${oct}`); };
  const pack = (title, notes, extra = {}) => ({
    status: 'success', renderer: 'music-theory', type: 'music-theory', title,
    notes: notes.map(n => nn(n, true)), names: notes.map(n => nn(n)), ...extra,
  });
  const tonic = args.tonic || 'C';
  try {
    switch (args.action) {
      case 'scale': {
        const id = SCALE_IDS.includes(args.scale) ? args.scale : (Object.keys(T.SCALES).find(k => T.SCALES[k].name.toLowerCase().includes(String(args.scale || 'major').toLowerCase())) || 'major');
        const notes = [...T.scaleNotes(note(tonic), id)];
        notes.push({ ...notes[0], oct: notes[0].oct + 1 });
        const s = T.SCALES[id];
        const r = pack(`${nn(note(tonic))} ${s.name}`, notes, { mode: 'melody', formula: s.steps.join(' '), open: { lab: 'scale' } });
        r.message = `${r.title}: ${r.names.join(' ')}. Formula ${s.steps.join('–')}.${s.mood ? ` Character: ${s.mood.replace(/\.$/, '')}.` : ''} Shown on a staff and keyboard with a play button.`;
        return r;
      }
      case 'chord': {
        const c = T.parseChord(args.chord || tonic);
        if (!c) return { status: 'error', message: `"${args.chord}" is not a chord symbol this understands. Examples: C, Am, F#m7b5, Bbmaj7, G7b9, Dsus4, C/E.` };
        let notes = T.chordNotes(c.root, c.quality);
        if (c.bass) notes = [c.bass, ...notes];
        const def = T.CHORDS[c.quality];
        const r = pack(`${c.symbol}`, notes, { mode: 'chord', formula: def.steps.join(' '), open: { lab: 'chord' } });
        r.message = `${c.symbol} (${def.name}): ${r.names.join(' ')}. Formula ${def.steps.join('–')}. Shown on a staff and keyboard with a play button.`;
        return r;
      }
      case 'identify': {
        // Stack the notes upwards in the order given, so the first one is the bass.
        const notes = [];
        for (const s of args.notes || []) {
          let n = note(s, notes.length ? notes[notes.length - 1].oct : 3);
          if (!/\d$/.test(String(s).trim())) while (notes.length && T.midi(n) <= T.midi(notes[notes.length - 1])) n = { ...n, oct: n.oct + 1 };
          notes.push(n);
        }
        if (notes.length < 2) return { status: 'error', message: 'Give at least two notes.' };
        const names = T.identifyChord(notes);
        const r = pack(names[0]?.symbol || 'No standard chord', notes, { mode: 'chord', candidates: names.slice(0, 5).map(c => ({ symbol: c.symbol, name: c.name })), open: { lab: 'chordname' } });
        r.message = names.length ? `Those notes spell ${names.slice(0, 4).map(c => `${c.symbol} (${c.name})`).join('; or ')}.` : 'Those notes do not form a standard chord; describe them as a cluster or by their intervals.';
        return r;
      }
      case 'progression': {
        const minor = args.mode === 'minor';
        const chords = T.progression(note(tonic, 4), args.numerals || (minor ? 'i iv V i' : 'I IV V I'), { sevenths: !!args.sevenths });
        const bad = chords.filter(c => c.error).map(c => c.numeral);
        if (bad.length) return { status: 'error', message: `Could not read ${bad.join(', ')}. Use Roman numerals such as I ii iii IV V vi vii°, bVII, V7, ii7, iiø7.` };
        return {
          status: 'success', renderer: 'music-theory', type: 'music-theory', mode: 'progression',
          title: `${args.numerals || ''} in ${nn(note(tonic))} ${minor ? 'minor' : 'major'}`.trim(),
          chords: chords.map(c => ({ numeral: c.numeral, symbol: c.symbol, notes: c.notes.map(n => nn(n, true)), names: c.notes.map(n => nn(n)) })),
          open: { lab: 'progression' },
          message: `${chords.map(c => `${c.numeral} = ${c.symbol} (${c.notes.map(n => nn(n)).join(' ')})`).join(', ')}. Shown with a play button.`,
        };
      }
      case 'key': {
        const minor = args.mode === 'minor';
        const t = note(tonic);
        const sig = T.keySignature(t, minor ? 'minor' : 'major');
        const chords = T.diatonicChords(t, minor ? 'natural-minor' : 'major', { sevenths: !!args.sevenths });
        const rel = minor ? T.transpose(t, 'm3') : T.transpose(t, 'M6');
        const notes = T.scaleNotes(t, minor ? 'natural-minor' : 'major');
        return {
          status: 'success', renderer: 'music-theory', type: 'music-theory', mode: 'key',
          title: `${nn(t)} ${minor ? 'minor' : 'major'}`, keySig: sig?.fifths ?? 0, signature: sig?.text || 'Not a standard key signature',
          notes: notes.map(n => nn(n, true)), names: notes.map(n => nn(n)),
          relative: `${nn(rel)} ${minor ? 'major' : 'minor'}`,
          chords: chords.map(c => ({ numeral: c.numeral, symbol: c.symbol, notes: c.notes.map(n => nn(n, true)), names: c.notes.map(n => nn(n)), fn: c.function })),
          open: { lab: 'keysig' },
          message: `${nn(t)} ${minor ? 'minor' : 'major'}: ${sig?.text || 'not a standard key (it would need double sharps or flats)'}; relative ${nn(rel)} ${minor ? 'major' : 'minor'}. Scale ${notes.map(n => nn(n)).join(' ')}. Chords: ${chords.map(c => `${c.numeral} ${c.symbol}`).join(', ')}.`,
        };
      }
      case 'interval': {
        const [a, b] = (args.notes || []).map((s, i) => note(s, 4));
        if (!a || !b) return { status: 'error', message: 'Give two notes, lower first, e.g. ["C4", "G4"].' };
        const lo = T.midi(a) <= T.midi(b) ? a : b, hi = lo === a ? b : a;
        const iv = T.intervalBetween(lo, hi);
        const r = pack(`${nn(lo)} to ${nn(hi)}`, [lo, hi], { mode: 'melody', interval: iv, intervalName: T.intervalLongName(iv), semitones: T.midi(hi) - T.midi(lo), open: { lab: 'intervals' } });
        r.message = `${nn(lo, true)} up to ${nn(hi, true)} is ${/^[aeiou]/i.test(T.intervalLongName(iv)) ? 'an' : 'a'} ${T.intervalLongName(iv)} (${iv}), ${r.semitones} semitones.`;
        return r;
      }
      case 'transpose': {
        const src = (args.notes || []).map(s => note(s, 4));
        if (!src.length) return { status: 'error', message: 'Give the notes to transpose.' };
        const iv = args.interval || 'M2';
        if (!T.parseInterval(iv)) return { status: 'error', message: `"${iv}" is not an interval. Use m2, M2, m3, M3, P4, A4, d5, P5, m6, M6, m7, M7, P8.` };
        const out = src.map(n => T.transpose(n, iv, args.direction === 'down' ? -1 : 1));
        const r = pack(`Transposed ${args.direction === 'down' ? 'down' : 'up'} ${/^[aeiou]/i.test(T.intervalLongName(iv)) ? 'an' : 'a'} ${T.intervalLongName(iv)}`, out, { mode: 'melody', from: src.map(n => nn(n)), open: { lab: 'transpose' } });
        r.message = `${src.map(n => nn(n)).join(' ')} → ${out.map(n => nn(n)).join(' ')}.`;
        return r;
      }
      default: return { status: 'error', message: 'Unknown action.' };
    }
  } catch (e) {
    // An unrecognised note surfaces as a null deep in the theory code; say what that means.
    const why = /Cannot read|is not a function|undefined|null/.test(String(e?.message)) ? 'a note or key name was not recognised' : e.message;
    return { status: 'error', message: `Could not work that out: ${why}. Check the note names (letters A–G with # or b, e.g. C, F#, Bb4).` };
  }
}

/* ---------------- business ---------------- */

function businessCalcTool({ calculator, inputs = {}, currency, ...rest } = {}) {
  const args = { ...rest, ...(inputs && typeof inputs === 'object' ? inputs : {}) };
  if (currency) args.currency = currency;
  const r = businessCalc(calculator, args);
  if (r.error) return { status: 'error', message: r.error };
  return {
    status: 'success', renderer: 'business-calc', type: 'business-calc',
    calculator, toolId: r.toolId, title: r.title, rows: r.rows, note: r.note || '',
    message: `${r.title}: ${r.rows.map(([k, v]) => `${k} ${v}`).join('; ')}.${r.note ? ` ${r.note}` : ''} Shown as a card; the person can open the full tool.`,
  };
}

/* ---------------- networking ---------------- */

const flat = (o, pre = '') => Object.entries(o || {}).flatMap(([k, v]) => {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v.length ? [[pre + k, v.map(x => (typeof x === 'object' ? JSON.stringify(x) : x)).join(', ')]] : [];
  if (typeof v === 'object') return flat(v, `${pre}${k} `);
  return [[pre + k, String(v)]];
});
const ACRONYM = { cidr: 'CIDR', ipv4Mapped: 'IPv4-mapped IPv6', ip: 'IP', isp: 'ISP', asn: 'ASN', dnssec: 'DNSSEC', mac: 'MAC', url: 'URL' };
const LABEL = (k) => ACRONYM[k] || k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

async function networkTool({ action, target = '', prefix, record_type: recordType } = {}) {
  const N = await import('../network-calc.js');
  const toolId = N.NETWORK_ACTIONS[action];
  if (!toolId) return { status: 'error', message: `Unknown action "${action}".` };
  if (action === 'speed_test') {
    window.location.hash = '#speed-test';
    return { status: 'success', openedToolId: 'speed-test', message: 'Opened the Speed Test; it measures download, upload and latency from the person\'s device. (run_speed_test runs it inside chat.)' };
  }
  if (!target && !['ip'].includes(action)) return { status: 'error', message: 'Give a target (domain, URL, IP or MAC address).' };
  let out;
  try {
    switch (action) {
      case 'subnet': out = N.subnet(target, prefix); break;
      case 'url': out = N.parseUrl(target); break;
      case 'ip': out = await N.ipLookup(target); break;
      case 'dns': out = await N.dns(target, recordType); break;
      case 'reverse_dns': out = await N.reverseDns(target); break;
      case 'whois': out = await N.whois(target); break;
      case 'domain_available': out = await N.domainAvailable(target); break;
      case 'ssl': out = await N.sslCertificate(target); break;
      case 'robots': out = await N.robots(target); break;
      case 'mac': out = await N.macVendor(target); break;
    }
  } catch (e) {
    return { status: 'error', message: `The ${action} lookup failed (${e.message}). The service may be unreachable from this network; the person can try in the tool.`, openToolId: toolId };
  }
  if (out?.error || out?.status === 'error') return { status: 'error', message: out.error || out.message };
  let rows;
  if (action === 'dns' || action === 'reverse_dns') {
    const recs = out.records || out.answers || out.Answer || [];
    rows = recs.length ? recs.map(r => [r.type || r.typeName || recordType || 'A', `${r.data ?? r.value ?? JSON.stringify(r)}${r.TTL ?? r.ttl ? ` (TTL ${r.TTL ?? r.ttl})` : ''}`]) : [['Records', 'none found']];
  } else rows = flat(out).map(([k, v]) => [LABEL(k), v]).slice(0, 30);
  const titles = { subnet: `Subnet ${out.cidr || target}`, url: 'URL breakdown', ip: `IP ${out.ip || target}`, dns: `DNS ${String(recordType || 'A').toUpperCase()} records for ${target}`, reverse_dns: `Reverse DNS for ${target}`, whois: `WHOIS ${out.domain || target}`, domain_available: `${out.domain}: ${out.available ? 'available' : 'registered'}`, ssl: `Certificate for ${out.domain}`, robots: `robots.txt for ${out.origin}`, mac: `MAC ${target}` };
  return {
    status: 'success', renderer: 'network-result', type: 'network-result', action, toolId, target,
    title: titles[action], rows: action === 'robots' ? rows.filter(([k]) => k !== 'Robots') : rows, pre: action === 'robots' ? out.robots : '',
    message: `${titles[action]}: ${JSON.stringify(out).slice(0, 2500)}`,
  };
}

export async function executeDomainTool(name, args = {}) {
  switch (name) {
    case 'music_library': return musicLibraryTool(args);
    case 'music_theory': return musicTheoryTool(args);
    case 'business_calc': return businessCalcTool(args);
    case 'network_tool': return networkTool(args);
    case 'cosmetics_database': return (await import('../cosmetics/assistant.js')).cosmeticsTool(args);
    default: return undefined;
  }
}
