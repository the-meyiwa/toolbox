/* ============================================================
   Wikimedia service layer.

   Every call to Wikipedia and Wikidata goes through here, so the rest of
   the tool never knows what an API response looks like. That separation
   is what makes adding a language edition, or swapping an endpoint when
   Wikimedia deprecates one, a change in a single file.

   Nothing is scraped: these are the official REST endpoints. Responses
   are cached in memory for the session, because the same article gets
   opened repeatedly while exploring and Wikimedia asks that clients not
   re-request what they already hold.
   ============================================================ */

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt', name: 'Português' },
  { code: 'it', name: 'Italiano' },
  { code: 'ar', name: 'العربية' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
  { code: 'ru', name: 'Русский' },
  { code: 'hi', name: 'हिन्दी' },
];

const base = (lang) => `https://${lang}.wikipedia.org`;

/* A single session cache keyed by URL. Bounded so a long browse cannot
   grow without limit. */
const cache = new Map();
const CACHE_MAX = 120;

class WikiError extends Error {
  constructor(message, { status, kind } = {}) {
    super(message);
    this.name = 'WikiError';
    this.status = status;
    this.kind = kind ?? 'unknown';
  }
}

/**
 * One place where every network failure is turned into something the UI
 * can show a person. Distinguishing offline from 404 from rate-limited
 * matters, because the user's next action differs in each case.
 */
async function request(url, { signal, cacheable = true } = {}) {
  if (cacheable && cache.has(url)) return cache.get(url);

  let res;
  try {
    res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' },
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new WikiError(
      navigator.onLine
        ? 'Could not reach Wikipedia. A firewall or content blocker may be in the way.'
        : 'You appear to be offline.',
      { kind: navigator.onLine ? 'network' : 'offline' },
    );
  }

  if (res.status === 404) throw new WikiError('That article does not exist.', { status: 404, kind: 'notfound' });
  if (res.status === 429) throw new WikiError('Wikipedia is rate limiting. Wait a moment and try again.', { status: 429, kind: 'ratelimit' });
  if (!res.ok) throw new WikiError(`Wikipedia returned ${res.status}.`, { status: res.status, kind: 'http' });

  const data = await res.json();
  if (cacheable) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(url, data);
  }
  return data;
}

/* ---------------- search ---------------- */

/**
 * @param {string} query
 * @param {{lang?: string, limit?: number, signal?: AbortSignal}} [opts]
 */
export async function searchWikipedia(query, { lang = 'en', limit = 20, signal } = {}) {
  const q = query.trim();
  if (!q) return [];
  const url = `${base(lang)}/w/rest.php/v1/search/page?q=${encodeURIComponent(q)}&limit=${limit}`;
  const data = await request(url, { signal });

  return (data.pages ?? []).map(p => ({
    id: p.id,
    key: p.key,
    title: p.title,
    description: p.description ?? '',
    // The excerpt arrives with <span class="searchmatch"> around hits,
    // which is genuinely useful — it is sanitised at render time.
    excerptHtml: p.excerpt ?? '',
    thumbnail: p.thumbnail ? withScheme(p.thumbnail.url) : null,
    lang,
  }));
}

/** Title completions for the search box. */
export async function suggestTitles(query, { lang = 'en', limit = 8, signal } = {}) {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${base(lang)}/w/rest.php/v1/search/title?q=${encodeURIComponent(q)}&limit=${limit}`;
  const data = await request(url, { signal });
  return (data.pages ?? []).map(p => ({ title: p.title, key: p.key, description: p.description ?? '' }));
}

/* ---------------- articles ---------------- */

const withScheme = (u) => (u && u.startsWith('//') ? `https:${u}` : u);

/** Lead section, description, image and the Wikidata id, in one call. */
export async function getSummary(title, { lang = 'en', signal } = {}) {
  const url = `${base(lang)}/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const d = await request(url, { signal });
  return {
    title: d.title,
    displayTitle: d.displaytitle ?? d.title,
    description: d.description ?? '',
    extract: d.extract ?? '',
    extractHtml: d.extract_html ?? '',
    thumbnail: d.thumbnail ? withScheme(d.thumbnail.source) : null,
    image: d.originalimage ? withScheme(d.originalimage.source) : null,
    wikidataId: d.wikibase_item ?? null,
    pageUrl: d.content_urls?.desktop?.page ?? `${base(lang)}/wiki/${encodeURIComponent(title)}`,
    lang: d.lang ?? lang,
    type: d.type,
    coordinates: d.coordinates ?? null,
    key: d.titles?.canonical ?? title,
  };
}

/**
 * Full article body as structured sections.
 * Uses the parse API with only the properties needed, rather than
 * fetching the whole page bundle.
 */
export async function getArticle(title, { lang = 'en', signal } = {}) {
  const url = `${base(lang)}/w/api.php?action=parse&page=${encodeURIComponent(title)}` +
              `&prop=text%7Csections%7Crevid&formatversion=2&format=json&origin=*&redirects=1`;
  const data = await request(url, { signal });

  if (data.error) {
    throw new WikiError(
      data.error.code === 'missingtitle' ? 'That article does not exist.' : data.error.info,
      { kind: data.error.code === 'missingtitle' ? 'notfound' : 'api' },
    );
  }

  return {
    title: data.parse.title,
    html: data.parse.text,
    revid: data.parse.revid,
    sections: (data.parse.sections ?? [])
      .filter(s => Number(s.toclevel) <= 3)
      .map(s => ({ index: s.index, level: Number(s.toclevel), line: stripTags(s.line), anchor: s.anchor })),
  };
}

/** When the article was last edited — useful context on a live wiki. */
export async function getLastModified(title, { lang = 'en', signal } = {}) {
  const url = `${base(lang)}/w/api.php?action=query&prop=revisions&titles=${encodeURIComponent(title)}` +
              `&rvprop=timestamp%7Cuser&rvlimit=1&formatversion=2&format=json&origin=*`;
  try {
    const d = await request(url, { signal });
    const rev = d.query?.pages?.[0]?.revisions?.[0];
    return rev ? { timestamp: rev.timestamp, user: rev.user } : null;
  } catch {
    return null;   // nice to have, never worth failing the page for
  }
}

export async function getRandomArticle({ lang = 'en', signal } = {}) {
  // Never cached: the whole point is a different article each time.
  const url = `${base(lang)}/api/rest_v1/page/random/summary`;
  const d = await request(url, { signal, cacheable: false });
  return {
    title: d.title,
    description: d.description ?? '',
    extract: d.extract ?? '',
    thumbnail: d.thumbnail ? withScheme(d.thumbnail.source) : null,
  };
}

/** Articles Wikipedia itself considers related. */
export async function getRelatedArticles(title, { lang = 'en', signal, limit = 6 } = {}) {
  try {
    const url = `${base(lang)}/api/rest_v1/page/related/${encodeURIComponent(title)}`;
    const d = await request(url, { signal });
    return (d.pages ?? []).slice(0, limit).map(p => ({
      title: p.title,
      description: p.description ?? '',
      extract: p.extract ?? '',
      thumbnail: p.thumbnail ? withScheme(p.thumbnail.source) : null,
    }));
  } catch {
    // The related endpoint is not available on every language edition.
    return [];
  }
}

/* ---------------- Wikidata ---------------- */

/* Only properties a reader would actually want. Dumping every statement
   an entity carries would bury the useful three under forty database
   fields nobody asked for. */
const FACT_PROPERTIES = [
  ['P569', 'Born'],
  ['P570', 'Died'],
  ['P19',  'Place of birth'],
  ['P20',  'Place of death'],
  ['P27',  'Citizenship'],
  ['P106', 'Occupation'],
  ['P101', 'Field of work'],
  ['P69',  'Educated at'],
  ['P166', 'Awards'],
  ['P800', 'Notable work'],
  ['P571', 'Founded'],
  ['P159', 'Headquarters'],
  ['P17',  'Country'],
  ['P36',  'Capital'],
  ['P1082', 'Population'],
  ['P2046', 'Area'],
  ['P625', 'Coordinates'],
  ['P50',  'Author'],
  ['P57',  'Director'],
  ['P86',  'Composer'],
];

export async function getWikidataEntity(id, { signal, lang = 'en' } = {}) {
  if (!id) return null;
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(id)}.json`;
  const data = await request(url, { signal });
  const entity = data.entities?.[id];
  if (!entity) return null;

  const claims = entity.claims ?? {};
  const labelCache = new Map();

  /* Item-valued statements come back as Q-numbers, so a second lookup is
     needed to turn them into words. Batched into one call, and only for
     the properties actually being shown. */
  const idsToResolve = new Set();
  for (const [pid] of FACT_PROPERTIES) {
    for (const claim of (claims[pid] ?? []).slice(0, 4)) {
      const v = claim.mainsnak?.datavalue;
      if (v?.type === 'wikibase-entityid' && v.value?.id) idsToResolve.add(v.value.id);
    }
  }

  if (idsToResolve.size) {
    const ids = [...idsToResolve].slice(0, 50).join('|');
    try {
      const lookup = await request(
        `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids}` +
        `&props=labels&languages=${lang}&format=json&origin=*`,
        { signal },
      );
      for (const [qid, ent] of Object.entries(lookup.entities ?? {})) {
        const label = ent.labels?.[lang]?.value;
        if (label) labelCache.set(qid, label);
      }
    } catch { /* fall back to raw ids rather than failing the panel */ }
  }

  const facts = [];
  for (const [pid, label] of FACT_PROPERTIES) {
    const values = (claims[pid] ?? [])
      .slice(0, 4)
      .map(c => formatSnak(c.mainsnak, labelCache))
      .filter(Boolean);
    if (values.length) facts.push({ property: pid, label, values });
  }

  return {
    id,
    label: entity.labels?.[lang]?.value ?? entity.labels?.en?.value ?? id,
    description: entity.descriptions?.[lang]?.value ?? entity.descriptions?.en?.value ?? '',
    facts,
    url: `https://www.wikidata.org/wiki/${id}`,
  };
}

function formatSnak(snak, labelCache) {
  const v = snak?.datavalue;
  if (!v) return null;

  switch (v.type) {
    case 'wikibase-entityid':
      return labelCache.get(v.value.id) ?? v.value.id;

    case 'time': {
      // Wikidata times look like "+1912-06-23T00:00:00Z" with a precision
      // code; anything vaguer than a day should not pretend to be exact.
      const m = String(v.value.time).match(/^([+-])(\d{4})-(\d{2})-(\d{2})/);
      if (!m) return null;
      const [, sign, y, mo, d] = m;
      const year = Number(y) * (sign === '-' ? -1 : 1);
      const precision = v.value.precision ?? 11;
      if (precision <= 9) return `${Math.abs(year)}${year < 0 ? ' BCE' : ''}`;
      if (precision === 10) return new Date(Date.UTC(year, Number(mo) - 1, 1))
        .toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' });
      return new Date(Date.UTC(year, Number(mo) - 1, Number(d)))
        .toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    }

    case 'quantity': {
      const n = Number(v.value.amount);
      return Number.isFinite(n) ? n.toLocaleString() : null;
    }

    case 'globecoordinate': {
      const { latitude: la, longitude: lo } = v.value;
      return `${la.toFixed(4)}, ${lo.toFixed(4)}`;
    }

    case 'string':
    case 'external-id':
      return v.value;

    case 'monolingualtext':
      return v.value.text;

    default:
      return null;
  }
}

/* ---------------- helpers ---------------- */

export function stripTags(html) {
  const el = document.createElement('div');
  el.innerHTML = html ?? '';
  return el.textContent ?? '';
}

export function clearCache() { cache.clear(); }
export { WikiError };
