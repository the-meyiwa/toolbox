/* ============================================================
   TOOLBOX \u2014 Assistant knowledge and document tools

   - lookup_compound / lookup_element: exact, synonym and typo-
     tolerant lookups over the compound and element tables, with
     PubChem as a last resort for compounds.
   - anatomy_lookup: text answers from the anatomy tables (nerve
     supply, blood supply, relations, system overviews).
   - diagnose_vehicle: automotive fault trees (mechanics-kb.js).
   - architecture_advisor: building and software architecture
     notes, design review and sizing rules (architecture-kb.js).
   - generate_document: Word, spreadsheet, slide, Markdown, HTML
     and text files from Markdown or structured input, with every
     string cleaned of invisible and look-alike characters.

   entityHints() reads the person's message before the model
   does and names any compound or element it mentions, so a
   question like "tell me about Albendazole" reaches the compound
   table instead of the model guessing a tool.
   ============================================================ */

import { cleanText } from '../../utils.js';

/* ---------------- text cleaning ---------------- */

// Bidi controls and Unicode tag characters (U+E0000 block, used for hidden watermarks)
// are not covered by cleanText, so they are stripped here first.
const HIDDEN = /[\u061C\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00AD\u180E\uFE00-\uFE0E]|\uDB40[\uDC00-\uDC7F]/g;

/** Plain, portable text: no invisible characters, straight quotes, plain dashes and spaces. */
export function cleanDocText(value) {
  if (value == null) return '';
  const s = String(value).normalize('NFC').replace(HIDDEN, '');
  return cleanText(s).replace(/[\u2010\u2011\u2012]/g, '-').replace(/[\u2032]/g, "'").replace(/[\u2033]/g, '"').replace(/(\S) {2,}/g, '$1 ');
}

/* ---------------- fuzzy matching ---------------- */

function editDistance(a, b, max = 3) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const allowance = (word) => (word.length >= 9 ? 2 : word.length >= 5 ? 1 : 0);
const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036F]/g, '').replace(/[^a-z0-9,()+\-\s]/g, ' ').replace(/\s+/g, ' ').trim();

/* ---------------- elements ---------------- */

let elementsCache;
async function elements() {
  elementsCache ??= (await import('../chemistry-data.js')).ELEMENTS;
  return elementsCache;
}

/** Finds an element by name, symbol, atomic number or a close misspelling ("Mendelium"). */
export async function findElement(query) {
  const list = await elements();
  const raw = String(query || '').trim();
  const q = norm(raw);
  if (!q) return null;
  const exact = list.find(e => e.name.toLowerCase() === q || e.symbol === raw || e.symbol.toLowerCase() === q && raw.length <= 2 || String(e.number) === q);
  if (exact) return { element: exact, matchedBy: 'exact' };
  let best = null;
  for (const e of list) {
    const d = editDistance(q, e.name.toLowerCase(), 3);
    if (d <= Math.max(allowance(q), 2) && (!best || d < best.d)) best = { e, d };
  }
  return best ? { element: best.e, matchedBy: 'spelling', distance: best.d } : null;
}

async function lookupElement(args) {
  const names = Array.isArray(args.elements) ? args.elements : [args.element || args.query || args.name].filter(Boolean);
  if (!names.length) return { status: 'error', message: 'Give an element name, symbol or atomic number.' };
  const found = [];
  const missing = [];
  for (const n of names.slice(0, 12)) {
    const hit = await findElement(n);
    if (hit) found.push({ asked: n, ...(hit.matchedBy === 'spelling' ? { correctedTo: hit.element.name } : {}), ...hit.element });
    else missing.push(n);
  }
  return {
    status: found.length ? 'success' : 'not_found',
    type: found.length > 1 ? 'elements-comparison' : undefined,
    renderer: found.length > 1 ? 'elements-comparison' : undefined,
    elements: found,
    notFound: missing,
    message: found.length
      ? `Found ${found.map(f => f.correctedTo ? `${f.name} (the person wrote "${f.asked}")` : f.name).join(', ')}. Answer from these values.${missing.length ? ` Not an element: ${missing.join(', ')}.` : ''}`
      : `"${missing.join(', ')}" is not an element name, symbol or number. Say so; do not answer about a different substance.`,
  };
}

/* ---------------- compounds ---------------- */

let compoundTables;
async function compounds() {
  if (!compoundTables) {
    const { COMPOUNDS_DATA } = await import('../compounds-dataset.js');
    const byName = new Map();
    for (const c of COMPOUNDS_DATA) {
      byName.set(norm(c.name), c);
      for (const s of c.synonyms || []) if (!byName.has(norm(s))) byName.set(norm(s), c);
    }
    compoundTables = { list: COMPOUNDS_DATA, byName, names: [...byName.keys()] };
  }
  return compoundTables;
}

const PUBLIC_FIELDS = ['name', 'category', 'use', 'formula', 'molarMass', 'cas', 'cid', 'iupac', 'melt', 'boil', 'density', 'solubility', 'hazards', 'synonyms', 'description'];
const pick = (c) => Object.fromEntries(PUBLIC_FIELDS.filter(k => c[k] != null && c[k] !== '' && !(Array.isArray(c[k]) && !c[k].length)).map(k => [k, Array.isArray(c[k]) ? c[k].slice(0, 8) : c[k]]));

/** Exact name/synonym/CAS/formula match, then a typo-tolerant name match, over the curated table. */
export async function findCompound(query) {
  const { list, byName, names } = await compounds();
  const q = norm(query);
  if (!q) return null;
  const direct = byName.get(q) || list.find(c => c.cas === String(query).trim() || (c.formula || '').toLowerCase() === q);
  if (direct) return { compound: direct, matchedBy: 'exact' };
  const tol = allowance(q);
  if (tol) {
    let best = null;
    for (const n of names) {
      const d = editDistance(q, n, tol);
      if (d <= tol && (!best || d < best.d)) best = { n, d };
    }
    if (best) return { compound: byName.get(best.n), matchedBy: 'spelling', distance: best.d };
  }
  return null;
}

async function lookupCompound(args, { fetchImpl = globalThis.fetch } = {}) {
  const query = String(args.query || args.name || args.formulaOrQuery || '').trim();
  if (!query) return { status: 'error', message: 'Give a compound, drug or chemical name, CAS number or formula.' };
  const hit = await findCompound(query);
  if (hit) {
    return {
      status: 'success', source: 'Toolbox compound database', query,
      ...(hit.matchedBy === 'spelling' ? { correctedTo: hit.compound.name } : {}),
      compound: pick(hit.compound),
      message: `Found ${hit.compound.name}${hit.matchedBy === 'spelling' ? ` (the person wrote "${query}")` : ''}. Answer about this compound only, using these values; add well-established background (uses, mechanism, safety) clearly as general knowledge.`,
    };
  }
  // Broader search: every word must appear in the record (curated then extended table).
  const { curatedCompoundIndex, searchIndex, loadExtendedIndex } = await import('../compound-search.js');
  let matches = searchIndex(curatedCompoundIndex(), query, { limit: 5 });
  if (!matches.length && fetchImpl) {
    try { matches = searchIndex((await loadExtendedIndex({ fetchImpl })).index, query, { limit: 5 }); } catch { /* offline */ }
  }
  if (!matches.length && fetchImpl) {
    try {
      const { searchPubChem } = await import('../pubchem.js');
      const live = await searchPubChem(query, { fetchImpl, limit: 3 });
      if (live.length) return { status: 'success', source: 'PubChem', query, compound: live[0], alternatives: live.slice(1), message: `Found ${live[0].name} on PubChem.` };
    } catch { /* offline */ }
  }
  if (matches.length) {
    return { status: 'success', source: 'Toolbox compound database', query, compound: pick(matches[0]), alternatives: matches.slice(1).map(m => m.name), message: `Closest match: ${matches[0].name}. Confirm it is what the person meant if the names differ.` };
  }
  return { status: 'not_found', query, message: `"${query}" is not in the compound database or PubChem. Say so plainly; answer only from general knowledge, marked as such, and never switch to a different substance.` };
}

/* ---------------- entity hints ---------------- */

const COMMON_WORDS = new Set(['water', 'salt', 'sugar', 'alcohol', 'lead', 'tin', 'iron', 'gold', 'silver', 'copper', 'oxygen', 'carbon', 'air', 'gas', 'oil', 'acid', 'base', 'soap', 'bleach', 'glass', 'steel', 'paper', 'starch', 'protein', 'fat', 'wax', 'chalk', 'lime', 'caffeine', 'nicotine', 'vinegar', 'petrol', 'diesel', 'coal', 'sand']);
const CHEM_CONTEXT = /\b(element|compound|chemical|chemistry|formula|molecule|drug|medicine|medication|tablet|dose|periodic|atomic|molar|toxic)\b/i;
const SKIP = new Set(['about', 'tell', 'what', 'which', 'explain', 'describe', 'please', 'element', 'compound', 'drug', 'medicine', 'there', 'their', 'would', 'could', 'should', 'where', 'these', 'those', 'things', 'something']);

/**
 * Names the compounds and elements a message mentions (typo-tolerant), so the model can be
 * told which lookup to use. Returns { compounds, elements, hint } where hint is a short
 * system note, or '' when nothing was found.
 */
export async function entityHints(text) {
  const src = String(text || '').slice(0, 600);
  const words = src.match(/[A-Za-z][A-Za-z0-9-]*/g) || [];
  const context = CHEM_CONTEXT.test(src);
  const out = { compounds: [], elements: [], hint: '' };
  if (!words.length) return out;
  const { byName } = await compounds();
  const seen = new Set();
  // Phrases of up to three words first ("acetic acid", "sodium chloride"), then single words.
  for (let size = 3; size >= 1; size--) {
    for (let i = 0; i + size <= words.length; i++) {
      const phrase = words.slice(i, i + size).join(' ');
      const key = norm(phrase);
      if (seen.has(key) || key.length < 4 || SKIP.has(key)) continue;
      const lone = size === 1;
      if (lone && COMMON_WORDS.has(key) && !context) continue;
      const c = byName.get(key);
      if (c && !out.compounds.some(x => x.name === c.name)) { out.compounds.push({ asked: phrase, name: c.name }); words.slice(i, i + size).forEach(w => seen.add(norm(w))); continue; }
      if (!lone) continue;
      if (key.length >= 6) {
        const el = await findElement(key);
        if (el && (el.matchedBy === 'exact' ? (context || !COMMON_WORDS.has(key)) : context)) {
          if (!out.elements.some(x => x.name === el.element.name)) out.elements.push({ asked: phrase, name: el.element.name });
          seen.add(key);
          continue;
        }
        // Drug-like words the table spells slightly differently ("Albendazol", "Paracetemol").
        if (key.length >= 7 && (context || key.length >= 8 || /^[A-Z]/.test(phrase))) {
          const f = await findCompound(key);
          if (f && f.matchedBy === 'spelling' && !out.compounds.some(x => x.name === f.compound.name)) out.compounds.push({ asked: phrase, name: f.compound.name });
        }
      }
    }
    if (out.compounds.length + out.elements.length >= 6) break;
  }
  const parts = [];
  if (out.compounds.length) parts.push(`compound(s) in the Toolbox database: ${out.compounds.map(c => c.asked.toLowerCase() === c.name.toLowerCase() ? c.name : `${c.name} (written "${c.asked}")`).join(', ')}. Look them up with lookup_compound`);
  if (out.elements.length) parts.push(`element(s): ${out.elements.map(e => e.asked.toLowerCase() === e.name.toLowerCase() ? e.name : `${e.name} (written "${e.asked}")`).join(', ')}. Look them up with lookup_element`);
  if (parts.length) out.hint = `Lookup hint for this message: it names ${parts.join('; and ')}. Drugs and chemicals are never looked up in the disease database, and answer about exactly the substance named.`;
  return out;
}

/* ---------------- anatomy ---------------- */

const SYSTEM_OVERVIEWS = {
  nervous: 'Central nervous system (brain and spinal cord) integrates information; the peripheral nervous system (12 cranial nerves, 31 pairs of spinal nerves and their plexuses) carries sensory and motor signals. The autonomic division (sympathetic, parasympathetic) runs the organs; the somatic division runs skeletal muscle.',
  skeletal: '206 bones in adults, divided into the axial skeleton (skull, vertebral column, ribs, sternum) and appendicular skeleton (limbs and girdles). Bones support and protect, anchor muscles, store calcium and make blood cells in red marrow.',
  muscular: 'Over 600 skeletal muscles move the skeleton through tendons; smooth muscle lines hollow organs and vessels; cardiac muscle forms the heart wall.',
  cardiovascular: 'The heart pumps blood through the pulmonary circuit (to the lungs) and systemic circuit (to the body) via arteries, capillaries and veins, delivering oxygen and nutrients and removing waste.',
  respiratory: 'Air passes the nose, pharynx, larynx, trachea and bronchi to the alveoli, where oxygen and carbon dioxide are exchanged. The diaphragm is the main muscle of breathing.',
  digestive: 'The alimentary canal (mouth, oesophagus, stomach, small and large intestine) with the liver, gallbladder and pancreas breaks food down, absorbs nutrients and eliminates waste.',
  urinary: 'Kidneys filter blood to make urine, which passes through the ureters to the bladder and out through the urethra. They also regulate fluid, electrolytes, acid-base balance and blood pressure.',
  endocrine: 'Glands (pituitary, thyroid, parathyroids, adrenals, pancreatic islets, gonads, pineal) release hormones into the blood to regulate metabolism, growth, reproduction and stress responses.',
  lymphatic: 'Lymph vessels, nodes, spleen, thymus and tonsils return tissue fluid to the blood and host immune responses.',
  integumentary: 'Skin, hair, nails and glands protect the body, regulate temperature and sense touch, pain and temperature.',
  reproductive: 'Gonads make gametes and sex hormones; the ducts and accessory organs deliver gametes and, in females, support pregnancy.',
};

async function anatomyLookup(args) {
  const query = String(args.query || args.structure || '').trim();
  if (!query) return { status: 'error', message: 'Name a structure or body system.' };
  const { resolveAnatomyQuery, ANATOMY_DATABASE } = await import('../anatomy-data.js');
  const { noteFor } = await import('../anatomy-notes.js');
  const system = Object.keys(SYSTEM_OVERVIEWS).find(s => new RegExp(`\\b${s}\\b`, 'i').test(query));
  let index = null;
  try {
    if (typeof process !== 'undefined' && process.versions?.node && typeof window === 'undefined') {
      const { readFile } = await import('node:fs/promises');
      index = JSON.parse(await readFile(new URL('../../../public/anatomy/index.json', import.meta.url), 'utf8'));
    }
  } catch { /* the browser fetches it instead */ }
  const resolved = await resolveAnatomyQuery(query, index);
  const details = (resolved.details || []).slice(0, 8).map(d => {
    const extra = noteFor(d.name) || noteFor(d.commonName);
    return Object.fromEntries(Object.entries({ ...d, note: extra }).filter(([, v]) => v != null && v !== ''));
  });
  const count = resolved.structures?.length || 0;
  if (!details.length && !system) {
    const keys = Object.keys(ANATOMY_DATABASE).filter(k => editDistance(norm(query), k, 2) <= 2).slice(0, 3);
    return { status: 'not_found', query, suggestions: keys, message: keys.length ? `No exact match. Did the person mean ${keys.join(', ')}?` : `No structure called "${query}" in the anatomy tables.` };
  }
  return {
    status: 'success', query,
    ...(system ? { system, overview: SYSTEM_OVERVIEWS[system] } : {}),
    systems: resolved.systems,
    structureCount: count,
    details,
    ...(count > details.length ? { moreStructures: resolved.structures.slice(details.length, details.length + 25).map(s => s.name) } : {}),
    message: `${system ? `${system} system overview plus ` : ''}${details.length} structure detail(s). Offer the 3D view (explore_anatomy) if seeing it would help.`,
  };
}

/* ---------------- documents ---------------- */

function inlineRuns(text) {
  const runs = [];
  const re = /(\*\*|__)(.+?)\1|(\*|_)(?!\s)(.+?)\3|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    if (m[2] != null) runs.push({ text: m[2], bold: true });
    else if (m[4] != null) runs.push({ text: m[4], italic: true });
    else if (m[5] != null) runs.push({ text: m[5], code: true });
    else runs.push({ text: m[6], href: m[7] });
    last = re.lastIndex;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs.filter(r => r.text);
}

const splitRow = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

/** Markdown \u2192 the Scribe document model (headings, lists, tables, quotes, code, rules). */
export function markdownToBlocks(md) {
  const lines = cleanDocText(md).split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      const code = [];
      while (++i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i]);
      blocks.push({ type: 'paragraph', style: 'pre', runs: [{ text: code.join('\n'), code: true }] });
      continue;
    }
    if (!line.trim()) continue;
    if (/^\s*([-*_])\s*\1\s*\1[\s\1]*$/.test(line)) { blocks.push({ type: 'rule' }); continue; }
    const h = /^(#{1,6})\s+(.*?)\s*#*$/.exec(line);
    if (h) { blocks.push({ type: 'paragraph', style: `h${h[1].length}`, runs: inlineRuns(h[2]) }); continue; }
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const rows = [{ header: true, cells: splitRow(line).map(inlineRuns) }];
      i++;
      while (i + 1 < lines.length && /^\s*\|/.test(lines[i + 1])) rows.push({ cells: splitRow(lines[++i]).map(inlineRuns) });
      blocks.push({ type: 'table', rows });
      continue;
    }
    const q = /^\s*>\s?(.*)$/.exec(line);
    if (q) { blocks.push({ type: 'paragraph', style: 'quote', runs: inlineRuns(q[1]) }); continue; }
    const li = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) {
      blocks.push({ type: 'paragraph', style: 'p', list: { ordered: /\d/.test(li[2]), level: Math.min(Math.floor(li[1].replace(/\t/g, '    ').length / 2), 8) }, runs: inlineRuns(li[3]) });
      continue;
    }
    // Consecutive plain lines form one paragraph.
    const para = [line.trim()];
    while (i + 1 < lines.length && lines[i + 1].trim() && !/^\s*(#{1,6}\s|>|[-*+]\s|\d+[.)]\s|\||```)/.test(lines[i + 1])) para.push(lines[++i].trim());
    blocks.push({ type: 'paragraph', style: 'p', runs: inlineRuns(para.join(' ')) });
  }
  return blocks;
}

function rowsFromMarkdownTable(md) {
  return cleanDocText(md).split('\n').filter(l => /^\s*\|/.test(l) && !/^\s*\|?\s*:?-{2,}/.test(l)).map(splitRow);
}

/** Slides \u2192 Podium deck model (16:9, title plus bullet body, speaker notes). */
export function slidesToDeck(slides, title = '') {
  const W = 960, H = 540;
  const text = (t, extra = {}) => ({ text: cleanDocText(t), ...extra });
  const deckSlides = slides.map((s, i) => {
    const bullets = (Array.isArray(s.bullets) ? s.bullets : String(s.body || s.content || '').split('\n')).map(b => String(b).replace(/^\s*[-*\u2022]\s*/, '')).filter(b => b.trim());
    const isCover = i === 0 && !bullets.length;
    const elements = [{
      type: 'box', x: 48, y: isCover ? 190 : 36, w: W - 96, h: isCover ? 110 : 80, valign: isCover ? 'middle' : 'bottom',
      paragraphs: [{ align: isCover ? 'center' : 'left', runs: [text(s.title || (isCover ? title : `Slide ${i + 1}`), { bold: true, size: isCover ? 40 : 30, color: '111111' })] }],
    }];
    if (isCover && s.subtitle) elements.push({ type: 'box', x: 48, y: 300, w: W - 96, h: 50, paragraphs: [{ align: 'center', runs: [text(s.subtitle, { size: 18, color: '555555' })] }] });
    if (bullets.length) {
      elements.push({ type: 'box', x: 48, y: 130, w: W - 96, h: H - 170, paragraphs: bullets.map(b => ({ bullet: true, level: /^\s{2,}/.test(b) ? 1 : 0, runs: [text(b.trim(), { size: 20, color: '222222' })] })) });
    }
    return { background: 'FFFFFF', notes: cleanDocText(s.notes || ''), elements };
  });
  return { width: W, height: H, slides: deckSlides.length ? deckSlides : [{ elements: [], notes: '' }] };
}

const MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  csv: 'text/csv',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odp: 'application/vnd.oasis.opendocument.presentation',
  md: 'text/markdown', txt: 'text/plain', html: 'text/html',
};

async function toDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}

/** Builds the file. Returns { blob, filename, format }. */
export async function buildDocument(args) {
  const format = String(args.format || '').toLowerCase().replace(/^\./, '') || 'docx';
  if (!MIME[format]) throw new Error(`Unsupported format "${format}". Use docx, odt, rtf, md, txt, html, xlsx, ods, csv, pptx or odp.`);
  const title = cleanDocText(args.title || '');
  const stem = cleanDocText(args.filename || title || 'Document').replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'Document';
  const filename = `${stem}.${format}`;
  const content = String(args.content || '');
  let blob;

  if (['xlsx', 'ods', 'csv'].includes(format)) {
    const { sheetFromRows, writeWorkbook } = await import('../docs/sheets.js');
    let sheets = Array.isArray(args.sheets) && args.sheets.length ? args.sheets : [{ name: 'Sheet1', rows: rowsFromMarkdownTable(content) }];
    if (!sheets[0].rows?.length && content.trim()) {
      const { parseDelimited } = await import('../docs/sheets.js');
      sheets = [{ name: 'Sheet1', rows: parseDelimited(cleanDocText(content), content.includes('\t') ? '\t' : ',') }];
    }
    const book = { sheets: sheets.map((s, i) => sheetFromRows((s.rows || []).map(r => (r || []).map(v => (typeof v === 'string' ? cleanDocText(v) : v))), cleanDocText(s.name || `Sheet${i + 1}`))) };
    blob = await writeWorkbook(book, format);
  } else if (['pptx', 'odp'].includes(format)) {
    let slides = Array.isArray(args.slides) ? args.slides : [];
    if (!slides.length && content.trim()) {
      // "## Slide title" sections with bullet lines.
      slides = content.split(/\n(?=#{1,2}\s)/).map(sec => {
        const [head, ...rest] = sec.trim().split('\n');
        return { title: head.replace(/^#+\s*/, ''), bullets: rest.filter(l => l.trim()) };
      });
    }
    const deck = slidesToDeck(slides, title);
    if (format === 'pptx') blob = await (await import('../docs/pptx.js')).deckToPptx(deck, { title });
    else blob = await (await import('../docs/odf.js')).deckToOdp(deck);
  } else {
    const blocks = markdownToBlocks(title && !/^#\s/.test(content.trim()) ? `# ${title}\n\n${content}` : content);
    const model = await import('../docs/model.js');
    if (format === 'docx') blob = await (await import('../docs/docx.js')).modelToDocx(blocks, { title });
    else if (format === 'odt') blob = await (await import('../docs/odf.js')).modelToOdt(blocks, { title });
    else if (format === 'rtf') blob = new Blob([(await import('../docs/rtf.js')).modelToRtf(blocks)], { type: MIME.rtf });
    else if (format === 'html') blob = new Blob([model.modelToHtmlFile(blocks, title || stem)], { type: MIME.html });
    else if (format === 'md') blob = new Blob([`${model.modelToMarkdown(blocks).trim()}\n`], { type: MIME.md });
    else blob = new Blob([`${model.modelToText(blocks).trim()}\n`], { type: MIME.txt });
  }
  if (!blob.type || /zip|octet/.test(blob.type)) blob = new Blob([blob], { type: MIME[format] });
  return { blob, filename, format };
}

async function generateDocument(args) {
  const { blob, filename, format } = await buildDocument(args);
  const folder = `/${String(args.folder || 'Documents').replace(/^\/+|\/+$/g, '') || 'Documents'}`;
  const path = `${folder}/${filename}`;
  let saved = false;
  try {
    const { fs } = await import('../filesystem.js');
    await fs.writeFile(path, blob, { mimeType: MIME[format] });
    saved = Boolean(await fs.stat(path));
  } catch { /* still offered as a download */ }
  return {
    status: 'success', type: 'file', renderer: 'file',
    format, filename, fileSize: blob.size, path: saved ? path : undefined,
    dataUrl: await toDataUrl(blob),
    message: saved ? `Created ${filename} (${Math.max(1, Math.round(blob.size / 1024))} KB) and saved it to Files at ${path}.` : `Created ${filename}; it is ready to download.`,
  };
}

/* ---------------- declarations ---------------- */

export const KNOWLEDGE_TOOL_DECLARATIONS = [
  {
    name: 'lookup_compound',
    description: 'Looks up a drug, medicine, chemical or compound (e.g. "Albendazole", "Paracetamol", "sodium chloride", CAS "50-78-2", formula "C9H8O4") in the Toolbox compound database (typo-tolerant, with PubChem fallback): formula, molar mass, IUPAC name, uses, physical properties and hazards. Use for any "tell me about <drug or chemical>" question. Never use the disease database for substances.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'Name, synonym, CAS number or formula, exactly as the person wrote it.' } }, required: ['query'] },
  },
  {
    name: 'lookup_element',
    description: 'Looks up one or more chemical elements by name, symbol or atomic number, tolerating misspellings (e.g. "Mendelium" finds Mendelevium): atomic mass, configuration, category, properties, discovery and a summary. Two or more elements are shown as a comparison card.',
    parameters: { type: 'object', properties: { elements: { type: 'array', items: { type: 'string' }, description: 'Element names, symbols or numbers as the person wrote them.' } }, required: ['elements'] },
  },
  {
    name: 'anatomy_lookup',
    description: 'Answers anatomy questions from the Toolbox anatomy tables without opening the 3D view: function, nerve supply, blood supply, relations and clinical notes for structures, and overviews of body systems (nervous, skeletal, muscular, cardiovascular, respiratory, digestive, urinary, endocrine, lymphatic, integumentary, reproductive).',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'Structure or system, e.g. "sciatic nerve", "rotator cuff", "nervous system".' } }, required: ['query'] },
  },
  {
    name: 'diagnose_vehicle',
    description: 'Automotive fault-finding: turns a symptom ("wipers do not work", "car will not start", "overheating", "brakes squeal", "AC blows warm", "check engine light P0420") into ranked likely causes, the check that confirms each, the fix and how hard it is to do yourself, plus safety notes. Use for any car problem before answering.',
    parameters: {
      type: 'object',
      properties: {
        symptom: { type: 'string', description: 'What the person describes, in their words.' },
        vehicle: { type: 'string', description: 'Make, model and year if known.' },
        codes: { type: 'array', items: { type: 'string' }, description: 'OBD-II fault codes, if any.' },
      },
      required: ['symptom'],
    },
  },
  {
    name: 'architecture_advisor',
    description: 'Architecture reference and review for buildings (structure, foundations, spans, climate design, room sizes, stairs, fire escape, shipping-container buildings) and software systems (monolith vs microservices, Docker and Kubernetes, scaling, caching, reliability, security, patterns). mode "topic" returns reference notes; "check" reviews a design description for gaps; "calc" sizes stairs, beam depth, ventilation, pad footings or container stacking loads.',
    parameters: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['topic', 'check', 'calc'] },
        question: { type: 'string', description: 'The question (topic mode).' },
        domain: { type: 'string', enum: ['building', 'software'] },
        design: { type: 'string', description: 'The design to review (check mode).' },
        calc: { type: 'string', enum: ['stairs', 'beam_depth', 'ventilation', 'footing', 'container_stack'] },
        params: { type: 'object', description: 'Calc inputs: floorToFloorMm; spanM, material (concrete|steel|timber), continuous; floorAreaM2 or lengthM and widthM; loadKn, bearingKpa; levels, loadedMassKg.', properties: {} },
      },
    },
  },
  {
    name: 'generate_document',
    description: 'Creates a real document file and saves it to Files: Word (docx), OpenDocument (odt), RTF, Markdown, HTML or plain text from Markdown content; spreadsheets (xlsx, ods, csv) from sheets or a Markdown table; slide decks (pptx, odp) from slides. All text is cleaned of invisible characters, smart quotes and other formatting junk. Write the full content yourself, then call this once.',
    parameters: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: ['docx', 'odt', 'rtf', 'md', 'txt', 'html', 'xlsx', 'ods', 'csv', 'pptx', 'odp'] },
        filename: { type: 'string', description: 'File name without folder; the extension is added.' },
        title: { type: 'string' },
        content: { type: 'string', description: 'Markdown body for documents (headings, lists, tables, bold, links). For decks, "## Title" sections with bullet lines also work.' },
        sheets: { type: 'array', description: 'Spreadsheets: [{ name, rows: [[cell, ...], ...] }]. Cells starting with "=" are formulas.', items: { type: 'object', properties: { name: { type: 'string' }, rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } } } } },
        slides: { type: 'array', description: 'Decks: [{ title, subtitle?, bullets: [..], notes? }]. A first slide with no bullets is the cover.', items: { type: 'object', properties: { title: { type: 'string' }, subtitle: { type: 'string' }, bullets: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } } } },
        folder: { type: 'string', description: 'Folder in Files (default Documents).' },
      },
      required: ['format'],
    },
  },
];

export const KNOWLEDGE_TOOL_NAMES = new Set(KNOWLEDGE_TOOL_DECLARATIONS.map(d => d.name));

export async function executeKnowledgeTool(name, args = {}, opts = {}) {
  switch (name) {
    case 'lookup_compound': return lookupCompound(args, opts);
    case 'lookup_element': return lookupElement(args);
    case 'anatomy_lookup': return anatomyLookup(args);
    case 'diagnose_vehicle': return (await import('./mechanics-kb.js')).diagnoseVehicle(args);
    case 'architecture_advisor': return (await import('./architecture-kb.js')).architectureAdvisor(args);
    case 'generate_document': return generateDocument(args);
    default: return undefined;
  }
}
