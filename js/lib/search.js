/* ============================================================
   Intent-aware tool search.

   People do not search for tool names. They describe the job — "compress
   photo", "png to webp", "format this json", "remove metadata from
   image" — so matching has to work from the task backwards.

   Ranking tiers, highest first:
     1. exact tool name
     2. keyword
     3. synonym
     4. intent
     5. description / category
     6. related-tool bounce

   Pure functions over a registry array: no DOM, no globals, so the
   ranking can be tested on its own.
   ============================================================ */

/** Words that carry no signal in a task description. */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'this', 'that', 'these', 'my', 'me', 'i', 'it',
  'to', 'from', 'into', 'for', 'of', 'in', 'on', 'with', 'and', 'or',
  'please', 'how', 'do', 'can', 'want', 'need', 'make', 'get', 'some',
  'tool', 'online', 'free', 'quick', 'fast', 'best',
]);

/** File formats we recognise, so "X to Y" can be understood generically. */
const FORMATS = new Set([
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif', 'bmp', 'tiff', 'tif', 'ico', 'heic',
  'pdf', 'json', 'csv', 'tsv', 'yaml', 'yml', 'xml', 'md', 'markdown', 'html', 'txt', 'base64',
]);

/** Common shorthand, expanded before matching. */
const EXPANSIONS = new Map(Object.entries({
  pic: 'image', pics: 'image', photo: 'image', photos: 'image', picture: 'image', pictures: 'image',
  img: 'image', imgs: 'image', jpeg: 'jpg',
  doc: 'document', docs: 'document',
  pw: 'password', pwd: 'password', pass: 'password',
  regexp: 'regex', re: 'regex',
  ts: 'timestamp', epoch: 'timestamp',
  hex: 'hexadecimal', bin: 'binary', dec: 'decimal', oct: 'octal',
  calc: 'calculate', calculator: 'calculate',
  convert: 'convert', converter: 'convert', conversion: 'convert',
  compress: 'compress', compressor: 'compress', compression: 'compress', shrink: 'compress', reduce: 'compress',
  resize: 'resize', resizer: 'resize', scale: 'resize',
  gen: 'generate', generator: 'generate', generation: 'generate',
  fmt: 'format', formatter: 'format', beautify: 'format', prettify: 'format', pretty: 'format',
  minify: 'minify', uglify: 'minify',
  metadata: 'metadata', exif: 'metadata',
  qr: 'qr', qrcode: 'qr',
  ip: 'ip', ipaddress: 'ip',
  vat: 'vat', tax: 'tax',
  cash: 'money', currency: 'money',
}));

export function normalise(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9+#.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenise(text, { keepStopwords = false } = {}) {
  return normalise(text)
    .split(' ')
    .filter(Boolean)
    .map(w => EXPANSIONS.get(w) ?? w)
    .filter(w => keepStopwords || !STOPWORDS.has(w));
}

/* ---------------- fuzzy ---------------- */

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

/** Similarity 0–1, only for words long enough for a typo to be plausible. */
function similarity(a, b) {
  if (a.length < 4 || b.length < 4) return a === b ? 1 : 0;
  if (Math.abs(a.length - b.length) > 3) return 0;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

/* ---------------- query understanding ---------------- */

/**
 * Pull structure out of the raw query.
 * "png to webp" becomes a conversion with a known source and target,
 * which lets one rule serve every format pair without enumerating them.
 */
export function parseQuery(raw) {
  const text = normalise(raw);
  const tokens = tokenise(raw);
  const allTokens = tokenise(raw, { keepStopwords: true });

  let conversion = null;
  const m = text.match(/\b([a-z0-9]+)\s*(?:to|->|→|2|into)\s*([a-z0-9]+)\b/);
  if (m && (FORMATS.has(m[1]) || FORMATS.has(m[2]))) {
    conversion = { from: m[1], to: m[2] };
  }

  const formats = allTokens.filter(t => FORMATS.has(t));

  return { raw, text, tokens, allTokens, conversion, formats };
}

/* ---------------- scoring ---------------- */

const TIER = {
  nameExact: 1000,
  namePrefix: 620,
  nameContains: 430,
  keywordExact: 300,
  keywordPartial: 175,
  synonymExact: 265,
  synonymPartial: 150,
  intentExact: 240,
  intentAllTokens: 205,
  intentPartial: 120,
  description: 95,
  category: 70,
  fuzzyMax: 130,
  conversion: 340,
  formatMention: 90,
  relatedBounce: 45,
};

/**
 * Score one tool against a parsed query.
 * @returns {{score:number, why:string[]}}
 */
export function scoreTool(tool, q, categoryLabel = '') {
  if (!q.text) return { score: 1, why: [] };

  const why = [];
  let score = 0;
  const add = (n, reason) => { score += n; if (n > 0) why.push(reason); };

  const name = normalise(tool.name);
  const keywords = (tool.keywords ?? []).map(normalise);
  const synonyms = (tool.synonyms ?? []).map(normalise);
  const intents  = (tool.intents ?? []).map(normalise);
  const desc     = normalise(tool.description);
  const cat      = normalise(categoryLabel);

  /* 1 — name */
  if (name === q.text) add(TIER.nameExact, 'name');
  else if (name.startsWith(q.text)) add(TIER.namePrefix, 'name');
  else if (name.includes(q.text)) add(TIER.nameContains, 'name');

  /* 2 — keywords, credited in proportion to how much of the query they
     explain. A flat score here let one generic keyword ("text") beat a
     tool that matched the actual intent, because explaining half a query
     scored the same as explaining all of it. */
  let kw = 0;
  for (const k of keywords) {
    if (k === q.text) { kw = Math.max(kw, TIER.keywordExact); continue; }
    if (k.includes(q.text)) { kw = Math.max(kw, TIER.keywordExact - 40); continue; }
    const kTokens = tokenise(k);
    if (!kTokens.length || !q.tokens.length) continue;
    const covered = q.tokens.filter(t => kTokens.includes(t)).length;
    if (covered === q.tokens.length) kw = Math.max(kw, TIER.keywordExact - 60);
    else if (covered > 0) kw = Math.max(kw, Math.round(TIER.keywordPartial * (covered / q.tokens.length)));
  }
  add(kw, 'keyword');

  /* 3 — synonyms, matched at token level.

     Whole-string comparison alone was too strict: the synonym
     "compare text" scored nothing against the query token "text",
     so a misspelt "comparse text" lost to tools that merely mention
     text in passing. */
  let syn = 0;
  for (const s of synonyms) {
    if (s === q.text) { syn = Math.max(syn, TIER.synonymExact); continue; }
    if (s.includes(q.text)) { syn = Math.max(syn, TIER.synonymExact - 30); continue; }
    const sTokens = tokenise(s);
    if (!sTokens.length || !q.tokens.length) continue;
    const covered = q.tokens.filter(t => sTokens.includes(t)).length;
    if (covered === q.tokens.length) syn = Math.max(syn, TIER.synonymExact - 45);
    else if (covered > 0) syn = Math.max(syn, Math.round(TIER.synonymPartial * (covered / q.tokens.length)));
  }
  add(syn, 'synonym');

  /* 4 — intents: the natural-language layer */
  let intent = 0;
  for (const i of intents) {
    if (i === q.text) { intent = Math.max(intent, TIER.intentExact); continue; }
    const iTokens = tokenise(i);
    if (!iTokens.length || !q.tokens.length) continue;
    const covered = q.tokens.filter(t => iTokens.includes(t)).length;
    if (covered === q.tokens.length) intent = Math.max(intent, TIER.intentAllTokens);
    else if (covered > 0) intent = Math.max(intent, Math.round(TIER.intentPartial * (covered / q.tokens.length)));
    if (i.includes(q.text)) intent = Math.max(intent, TIER.intentAllTokens);
  }
  add(intent, 'intent');

  /* 5 — description and category */
  if (desc.includes(q.text)) add(TIER.description, 'description');
  else if (q.tokens.length > 1 && q.tokens.every(t => desc.includes(t))) add(TIER.description - 25, 'description');
  if (cat && (cat.includes(q.text) || q.tokens.some(t => cat.includes(t)))) add(TIER.category, 'category');

  /* Conversion queries: "png to webp", "json to csv", "image to pdf" */
  if (q.conversion) {
    const haystack = [...keywords, ...synonyms, ...intents, name, desc].join(' ');
    const from = q.conversion.from, to = q.conversion.to;
    const hasFrom = haystack.includes(from), hasTo = haystack.includes(to);
    if (hasFrom && hasTo) add(TIER.conversion, 'conversion');
    else if (hasTo || hasFrom) add(Math.round(TIER.conversion * 0.45), 'conversion');
  } else if (q.formats.length) {
    const haystack = [...keywords, ...synonyms, ...intents, name].join(' ');
    const hits = q.formats.filter(f => haystack.includes(f)).length;
    if (hits) add(TIER.formatMention * hits, 'format');
  }

  /* Typos.

     Checked per token rather than per tool: a token that found no literal
     match anywhere gets a fuzzy chance even when the tool already scored
     well on a different word. Gating this on the tool's total score
     instead meant "comparse text" ranked on "text" alone and never tried
     to recover the misspelt word. */
  const haystackWords = new Set(
    [name, ...keywords, ...synonyms].flatMap(t => t.split(' ')).filter(Boolean),
  );
  for (const qt of q.tokens) {
    if (haystackWords.has(qt)) continue;              // matched literally
    let best = 0;
    for (const word of haystackWords) {
      const s = similarity(qt, word);
      if (s > 0.72) best = Math.max(best, s);
    }
    if (best > 0) add(Math.round(TIER.fuzzyMax * best), 'fuzzy');
  }

  /* Popularity nudges ties, never overturns a better match. */
  if (score > 0) score += ((tool.weight ?? 50) - 50) * 0.55;

  return { score: Math.round(score), why: [...new Set(why)] };
}

/* ---------------- public API ---------------- */

/**
 * @param {string} query
 * @param {import('../registry/schema.js').Tool[]} tools
 * @param {{labels?: Record<string,string>, limit?: number, minScore?: number}} [opts]
 * @returns {{results: Array<{tool: any, score: number, why: string[]}>, noResult: boolean, parsed: any}}
 */
export function search(query, tools, opts = {}) {
  const { labels = {}, limit = 60, minScore = 40 } = opts;
  const q = parseQuery(query);

  if (!q.text) {
    return { results: tools.map(t => ({ tool: t, score: 1, why: [] })), noResult: false, parsed: q };
  }

  let scored = tools
    .map(t => ({ tool: t, ...scoreTool(t, q, labels[t.category] ?? '') }))
    .filter(r => r.score >= minScore);

  /* 6 — related-tool bounce: a strong hit lends a little weight to the
     tools it points at, so "compress photo" also surfaces the converter. */
  if (scored.length) {
    const byId = new Map(scored.map(r => [r.tool.id, r]));
    const top = [...scored].sort((a, b) => b.score - a.score).slice(0, 3);
    const bonus = new Map();
    for (const r of top) {
      for (const relId of r.tool.related ?? []) {
        if (byId.has(relId)) continue;
        bonus.set(relId, Math.max(bonus.get(relId) ?? 0, TIER.relatedBounce));
      }
    }
    for (const [id, b] of bonus) {
      const tool = tools.find(t => t.id === id);
      if (tool) scored.push({ tool, score: b, why: ['related'] });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name));

  return {
    results: scored.slice(0, limit),
    // A query nobody can serve is a product signal, not just an empty screen.
    noResult: scored.length === 0 || scored[0].score < TIER.keywordPartial,
    parsed: q,
  };
}

/** Tools worth showing beside the one being used. */
export function relatedTools(tool, tools, limit = 4) {
  const out = [];
  const seen = new Set([tool.id]);

  for (const id of tool.related ?? []) {
    const t = tools.find(x => x.id === id);
    if (t && !seen.has(id)) { out.push(t); seen.add(id); }
  }
  if (out.length < limit) {
    for (const t of tools) {
      if (out.length >= limit) break;
      if (seen.has(t.id)) continue;
      if (t.category === tool.category) { out.push(t); seen.add(t.id); }
    }
  }
  return out.slice(0, limit);
}
