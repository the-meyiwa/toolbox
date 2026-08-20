/* ============================================================
   Tool registry schema.

   The project is plain JavaScript, so "typed" here means JSDoc
   typedefs — editors and `tsc --checkJs` enforce the shape without
   adding a TypeScript build step. `validateRegistry` catches the
   mistakes types cannot: duplicate ids, dangling `related` links,
   categories that do not exist.

   Every field that search reads lives here. Nothing about discovery
   should ever be written inside a tool component again.
   ============================================================ */

/**
 * @typedef {'text'|'developer'|'images-files'|'numbers'|'business'|'design'
 *          |'security'|'networking'|'modeling'|'reference'|'music'|'everyday'} CategoryId
 *
 * @typedef {import('./kinds.js').ArtifactKind} ArtifactKind
 *
 * @typedef {object} Tool
 * @property {string}       id            Stable slug. Also the module filename and the URL hash.
 * @property {string}       name          Display name.
 * @property {string}       description   One line, sentence case, no trailing full stop.
 * @property {CategoryId}   category      Primary category. Exactly one — this is where it lives in the grid.
 * @property {CategoryId[]} [secondary]   Cross-listings. Shown in those categories' search results, not the grid.
 * @property {string[]}     keywords      Literal words a user might type. Includes abbreviations and misspellings.
 * @property {string[]}     [synonyms]    Other names for the same tool ("plasterboard" for gypsum).
 * @property {string[]}     [intents]     Natural-language tasks: "compress photo", "png to webp".
 * @property {ArtifactKind[]} [accepts]   Artifact kinds this tool can be handed. Drives "Open in…".
 * @property {ArtifactKind[]} [produces]  Artifact kinds this tool can hand on. Drives "Send to…".
 * @property {string}       [task]        Overrides the category→task mapping for the home page.
 * @property {string[]}     [related]     Ids of tools worth showing alongside. Must resolve.
 * @property {number}       [weight]      Search/popularity bias, 0–100. Default 50.
 * @property {boolean}      [offline]     True when it never touches the network. Default true.
 * @property {string}       icon          Inline SVG markup.
 *
 * @typedef {object} Category
 * @property {CategoryId} id
 * @property {string}     label
 * @property {string}     blurb     Shown under the category heading.
 * @property {number}     order
 */

import { KIND_IDS, TASK_IDS, unmappedCategories } from './kinds.js';

/** Display order is deliberate: everyday utility first, specialist last. */
export const CATEGORIES = /** @type {Category[]} */ ([
  { id: 'images-files', label: 'Images & Files', order: 1, blurb: 'Compress, convert, resize and combine — entirely on your device.' },
  { id: 'text',         label: 'Text',           order: 2, blurb: 'Clean, compare, count and reshape text.' },
  { id: 'developer',    label: 'Developer',      order: 3, blurb: 'Formatters, encoders, decoders and a code runner.' },
  { id: 'numbers',      label: 'Numbers & Calculators', order: 4, blurb: 'Everyday maths, units and dates.' },
  { id: 'business',     label: 'Business & Finance',    order: 5, blurb: 'Pricing, payroll, projections and paperwork.' },
  { id: 'design',       label: 'Design',         order: 6, blurb: 'Colour, ratios and codes.' },
  { id: 'security',     label: 'Security & Privacy',    order: 7, blurb: 'Generate secrets and strip what you did not mean to share.' },
  { id: 'networking',   label: 'Networking',     order: 8, blurb: 'Look up what is behind a domain or an address.' },
  { id: 'modeling',     label: '3D & Modeling',  order: 9, blurb: 'Interactive models you can measure and quote from.' },
  { id: 'reference',    label: 'Reference',      order: 10, blurb: 'Look something up — words, scripture, and the sum of human knowledge.' },
  { id: 'music',        label: 'Music',          order: 11, blurb: 'Keep time, find the note, and work out what fits.' },
  { id: 'everyday',     label: 'Everyday',       order: 12, blurb: 'Small things worth a bookmark.' },
]);

export const CATEGORY_IDS = new Set(CATEGORIES.map(c => c.id));

/**
 * Structural checks that JSDoc cannot make. Runs in dev and in tests;
 * cheap enough to leave on in production, where it logs rather than throws
 * so a bad entry can never white-screen the whole app.
 * @param {Tool[]} tools
 * @returns {string[]} problems, empty when the registry is sound
 */
export function validateRegistry(tools) {
  const problems = [];
  const seen = new Set();
  const ids = new Set(tools.map(t => t.id));

  /* Every category must belong to a home-page group. Seven tools once fell
     through this gap — a metronome, a timer, the weather — and were
     reachable only by search. Nothing silently drops off the front page. */
  for (const c of unmappedCategories(CATEGORY_IDS)) {
    problems.push(`category "${c}" is in no home-page group, so its tools would not appear on the home page`);
  }

  for (const t of tools) {
    const where = `tool "${t.id || '(missing id)'}"`;

    if (!t.id) problems.push('a tool has no id');
    else if (seen.has(t.id)) problems.push(`duplicate id: ${t.id}`);
    else seen.add(t.id);

    if (!t.name) problems.push(`${where}: missing name`);
    if (!t.description) problems.push(`${where}: missing description`);
    if (t.description && /\.$/.test(t.description)) problems.push(`${where}: description should not end in a full stop`);
    if (!t.icon) problems.push(`${where}: missing icon`);

    if (!CATEGORY_IDS.has(t.category)) problems.push(`${where}: unknown category "${t.category}"`);
    for (const c of t.secondary ?? []) {
      if (!CATEGORY_IDS.has(c)) problems.push(`${where}: unknown secondary category "${c}"`);
      if (c === t.category) problems.push(`${where}: secondary category repeats the primary`);
    }

    if (!t.keywords?.length) problems.push(`${where}: no keywords`);

    /* Capability metadata is what lets one tool pick up another's output
       without either knowing the other exists, so a typo in it silently
       breaks interop rather than anything visible. Check it here. */
    for (const field of ['accepts', 'produces']) {
      for (const k of t[field] ?? []) {
        if (!KIND_IDS.has(k)) problems.push(`${where}: unknown artifact kind "${k}" in ${field}`);
      }
    }
    if (t.task && !TASK_IDS.has(t.task)) problems.push(`${where}: unknown task "${t.task}"`);

    for (const r of t.related ?? []) {
      if (!ids.has(r)) problems.push(`${where}: related tool "${r}" does not exist`);
      if (r === t.id) problems.push(`${where}: lists itself as related`);
    }

    if (t.weight != null && (t.weight < 0 || t.weight > 100)) problems.push(`${where}: weight out of range`);
  }

  return problems;
}

/**
 * Tools that used to exist, mapped to what replaced them, so a bookmark
 * or a shared link never dead-ends.
 * @type {Record<string, string>}
 */
export const ALIASES = {
  // Removed: could not work in a browser, or leaked data for a trivial result.
  'net-http-headers': 'net-url-analyzer',
  'net-favicon':      'net-url-analyzer',
  'net-google-search': 'net-url-analyzer',
  // Merged into a tool that does strictly more.
  'net-ipv4-ipv6':   'net-subnet',
  'loan-calculator': 'amortization-schedule',
  // Renames kept from earlier revisions.
  'inet-qr-generator': 'qr-generator',
  'inet-password':     'password-generator',
  'inet-uuid':         'uuid-generator',
  'inet-jwt':          'jwt-decoder',
  'inet-base64':       'base64-codec',
  'inet-regex':        'regex-tester',
  'inet-json-format':  'json-formatter',
  'inet-hash':         'hash-generator',
  'inet-lorem':        'lorem-ipsum',
  'inet-html-encode':  'html-entity-codec',
  'inet-ip-lookup':    'ip-lookup',
  'inet-weather':      'weather-forecast',
  'inet-color-extractor': 'color-converter',
};
