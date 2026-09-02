/* ============================================================
   Artifact kinds, and the task lens over the tool grid.

   A *kind* is what a piece of work IS — json, csv, markdown, code.
   Tools declare which kinds they accept and produce, and the shell
   works out from that alone which tool can pick up what another one
   put down. No tool ever names another tool.

   A *task* is what the user came to DO. It sits over the subject
   categories rather than replacing them: a tool still lives in exactly
   one category in the grid, but the home page asks the question the
   user is actually asking.
   ============================================================ */

/**
 * @typedef {'text'|'json'|'csv'|'yaml'|'sql'|'markdown'|'code'|'uml'
 *          |'flowchart'|'html'|'svg'|'colour'|'regex'|'pdf'|'docx'|'image'|'binary'} ArtifactKind
 */

/** Everything the artifact layer knows how to hold, name and hand on. */
export const KINDS = {
  text:      { label: 'Text',        ext: 'txt',  mime: 'text/plain' },
  json:      { label: 'JSON',        ext: 'json', mime: 'application/json' },
  csv:       { label: 'CSV',         ext: 'csv',  mime: 'text/csv' },
  yaml:      { label: 'YAML',        ext: 'yaml', mime: 'text/yaml' },
  sql:       { label: 'SQL',         ext: 'sql',  mime: 'application/sql' },
  markdown:  { label: 'Markdown',    ext: 'md',   mime: 'text/markdown' },
  code:      { label: 'Source code', ext: 'txt',  mime: 'text/plain' },
  uml:       { label: 'UML source',  ext: 'mmd',  mime: 'text/plain' },
  flowchart: { label: 'Flowchart',   ext: 'json', mime: 'application/json' },
  html:      { label: 'HTML',        ext: 'html', mime: 'text/html' },
  svg:       { label: 'SVG',         ext: 'svg',  mime: 'image/svg+xml' },
  regex:     { label: 'Regex',       ext: 'txt',  mime: 'text/plain' },
  pdf:       { label: 'PDF Document',ext: 'pdf',  mime: 'application/pdf' },
  docx:      { label: 'Word Document', ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  image:     { label: 'Image',       ext: 'png',  mime: 'image/png' },
  binary:    { label: 'Binary file', ext: 'bin',  mime: 'application/octet-stream' },
};

export const KIND_IDS = new Set(Object.keys(KINDS));

export const kindLabel = (kind) => KINDS[kind]?.label ?? kind;
export const kindExt = (kind) => KINDS[kind]?.ext ?? 'txt';
export const kindMime = (kind) => KINDS[kind]?.mime ?? 'text/plain';

/** Guess a kind from a filename, for imported and dropped files. */
export function kindFromFilename(name = '') {
  const ext = String(name).toLowerCase().split('.').pop();
  if (['py', 'js', 'ts', 'jsx', 'tsx', 'c', 'cpp', 'h', 'cs', 'java', 'go', 'rs', 'php', 'rb'].includes(ext)) return 'code';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'].includes(ext)) return 'image';
  if (ext === 'docx' || ext === 'doc') return 'docx';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'yml') return 'yaml';
  if (ext === 'mermaid') return 'uml';
  const hit = Object.entries(KINDS).find(([, k]) => k.ext === ext);
  if (hit) return hit[0];
  return 'text';
}

/* ---------------- the home page groups ---------------- */

/**
 * How the home page is grouped. These are plain nouns, not verbs from a
 * strategy deck: most people arriving have a photo to shrink or a number
 * to work out, and they scan for the *thing*, not for a category of
 * intent. "Understand" and "Build" tested badly against that — nobody
 * looking for a metronome guesses which one it is under.
 *
 * Every category maps to exactly one group, which `validateRegistry`
 * enforces, so no tool can ever fall off the home page unnoticed. Order
 * runs from what most people want to what fewest do.
 */
export const TASKS = [
  {
    id: 'files',
    label: 'Images & files',
    blurb: 'Shrink a photo, change a format, join PDFs together.',
    categories: ['images-files'],
  },
  {
    id: 'numbers',
    label: 'Numbers & money',
    blurb: 'Work it out properly, once, and see how you got there.',
    categories: ['numbers', 'business'],
  },
  {
    id: 'writing',
    label: 'Text & writing',
    blurb: 'Count it, clean it, compare it, reshape it.',
    categories: ['text'],
  },
  {
    id: 'lookup',
    label: 'Look something up',
    blurb: 'Words, facts, and what is behind an address.',
    categories: ['reference', 'networking'],
  },
  {
    id: 'everyday',
    label: 'Everyday',
    blurb: 'The weather, a timer, a password, a tune.',
    categories: ['everyday', 'music', 'security'],
  },
  {
    id: 'design',
    label: 'Design & colour',
    blurb: 'Colour, contrast, ratios and things you have to look at.',
    categories: ['design', 'modeling'],
  },
  {
    id: 'law',
    label: 'Law & legal practice',
    blurb: 'Digest judgments, compare precedents, analyze contracts, and bundle legal PDFs.',
    categories: ['law'],
  },
  {
    id: 'science',
    label: 'Science & chemistry',
    blurb: 'Explore the periodic table, balance chemical equations, and calculate reaction stoichiometry.',
    categories: ['science'],
  },
  {
    id: 'code',
    label: 'Code & data',
    blurb: 'Formatters, encoders, diagrams and a place to run code.',
    categories: ['developer'],
  },
];

export const TASK_IDS = new Set(TASKS.map(t => t.id));

/** Category → task, derived once so the mapping lives in one place. */
const TASK_FOR_CATEGORY = Object.fromEntries(
  TASKS.flatMap(t => t.categories.map(c => [c, t.id])),
);

/** Categories with no group, if anyone ever adds one and forgets. */
export const unmappedCategories = (categoryIds) =>
  [...categoryIds].filter(id => !TASK_FOR_CATEGORY[id]);

/**
 * The home-page group a tool belongs to. An explicit `task` wins for the
 * handful of tools their category places badly; everything else follows
 * the category map, which covers all of them.
 * @param {{task?: string, category: string}} tool
 */
export function taskOf(tool) {
  if (tool.task && TASK_IDS.has(tool.task)) return tool.task;
  return TASK_FOR_CATEGORY[tool.category] ?? null;
}

/** Tools grouped for the home page, in display order. */
export function byTask(tools) {
  const groups = new Map(TASKS.map(t => [t.id, []]));
  for (const tool of tools) {
    const task = taskOf(tool);
    if (task) groups.get(task).push(tool);
  }
  return TASKS
    .map(t => ({ ...t, tools: groups.get(t.id).sort((a, b) => (b.weight ?? 50) - (a.weight ?? 50)) }))
    .filter(t => t.tools.length);
}
