/* ============================================================
   Event bus.

   Instrumentation is wired through the app now so that turning
   analytics on later is a configuration change rather than a
   refactor. The default sink discards everything: no network, no
   storage, nothing leaves the device. Toolbox's "no tracking" claim
   stays true until someone deliberately swaps the sink.

   Three rules this file exists to enforce:

     1. Analytics must never break a tool. Every dispatch is wrapped and
        scheduled off the critical path; a throwing sink is disabled
        rather than allowed to surface.
     2. No payload may carry user content. `sanitise` strips anything
        that is not a declared, primitive, allow-listed field — so a tool
        cannot leak file contents or input text even by accident.
     3. Success is defined per tool, not globally. A tool declares what
        "completed" means for it; nothing is inferred.
   ============================================================ */

/** @typedef {'tool_viewed'|'tool_started'|'tool_completed'|'tool_abandoned'|'tool_error'
 *           |'tool_result_generated'|'tool_downloaded'|'tool_copied'|'tool_shared'
 *           |'search_performed'|'search_no_result'|'search_selected'
 *           |'feedback_submitted'} EventName */

/** Fields a payload may contain. Anything else is dropped before dispatch. */
const ALLOWED_FIELDS = new Set([
  'toolId', 'category', 'durationMs', 'errorKind', 'resultCount',
  'inputKind', 'outputKind', 'fileCount', 'bytesIn', 'bytesOut',
  'query', 'queryLength', 'resultTop', 'position', 'sentiment', 'surface',
]);

/** Free-text fields that could carry user content, and their caps. */
const TEXT_LIMITS = { query: 64, errorKind: 48, toolId: 64, category: 32, resultTop: 64, sentiment: 16, surface: 32 };

/** Anything resembling a secret is never recorded, even in a search query. */
const SECRETISH = /(?:[A-Za-z0-9+/]{24,}={0,2})|(?:\b[A-Fa-f0-9]{32,}\b)|(?:eyJ[A-Za-z0-9_-]{8,})|(?:\b(?:sk|pk|api|key|token|bearer|password|passwd|secret)\b\s*[:=]?\s*\S+)/i;

/**
 * Reduce an arbitrary object to a safe, flat, allow-listed payload.
 * @param {Record<string, unknown>} payload
 */
export function sanitise(payload = {}) {
  /** @type {Record<string, string|number|boolean>} */
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    if (value == null) continue;

    if (typeof value === 'number') {
      if (Number.isFinite(value)) out[key] = Math.round(value);
      continue;
    }
    if (typeof value === 'boolean') { out[key] = value; continue; }
    if (typeof value !== 'string') continue;

    let v = value.trim();
    if (!v) continue;
    // A search box is the one place a user might paste a token.
    if (SECRETISH.test(v)) { out[key] = '[redacted]'; continue; }
    const cap = TEXT_LIMITS[key] ?? 32;
    if (v.length > cap) v = v.slice(0, cap);
    out[key] = v;
  }
  return out;
}

/* ---------------- sinks ---------------- */

/** Discards everything. The default, and the reason the privacy claim holds. */
export const noopSink = { name: 'noop', send() {} };

/**
 * Keeps the last N events in memory for local inspection. Never persisted,
 * never transmitted — used by the dev console and tests.
 * @param {number} limit
 */
export function memorySink(limit = 500) {
  const events = [];
  return {
    name: 'memory',
    send(event) {
      events.push(event);
      if (events.length > limit) events.shift();
    },
    all: () => [...events],
    clear: () => { events.length = 0; },
  };
}

/* ---------------- bus ---------------- */

let sink = noopSink;
let enabled = true;
let sessionSeq = 0;

/** Swap the sink. Called by config, never by a tool. */
export function setSink(next) { sink = next ?? noopSink; }
export function getSink() { return sink; }
export function setEnabled(v) { enabled = !!v; }

/** Schedule work so instrumentation never sits on the critical path. */
const defer = typeof queueMicrotask === 'function'
  ? (fn) => queueMicrotask(fn)
  : (fn) => Promise.resolve().then(fn);

/**
 * Record an event. Fire-and-forget by contract: this never throws, never
 * returns a promise a caller could await, and never blocks rendering.
 * @param {EventName} name
 * @param {Record<string, unknown>} [payload]
 */
export function track(name, payload = {}) {
  if (!enabled || !name) return;
  defer(() => {
    try {
      sink.send({ name, at: Date.now(), seq: ++sessionSeq, ...sanitise(payload) });
    } catch {
      // A broken sink is an analytics problem, not a user-facing one.
      // Disable it and carry on; the tool the user is using is unaffected.
      sink = noopSink;
    }
  });
}

/* ---------------- per-tool helper ---------------- */

/**
 * Instrumentation scoped to one tool, with success defined by that tool.
 *
 * Tools that produce a result call `completed()` when they actually
 * produce one. Tools where "success" is meaningless simply never call it,
 * and no completion event is invented for them.
 *
 * @param {string} toolId
 * @param {string} [category]
 */
export function toolSession(toolId, category) {
  const startedAt = Date.now();
  let started = false;
  let completed = false;

  const base = () => ({ toolId, category });

  return {
    viewed() { track('tool_viewed', base()); },

    /** First real interaction — not page load. */
    started() {
      if (started) return;
      started = true;
      track('tool_started', base());
    },

    /** The tool did its job. Meaning is the tool's to decide. */
    completed(detail = {}) {
      completed = true;
      track('tool_completed', { ...base(), durationMs: Date.now() - startedAt, ...detail });
    },

    resultGenerated(detail = {}) { track('tool_result_generated', { ...base(), ...detail }); },
    downloaded(detail = {})      { track('tool_downloaded', { ...base(), ...detail }); },
    copied(detail = {})          { track('tool_copied', { ...base(), ...detail }); },
    shared(detail = {})          { track('tool_shared', { ...base(), ...detail }); },

    /** `kind` must be a category of failure, never the error text. */
    error(kind) { track('tool_error', { ...base(), errorKind: String(kind).slice(0, 48) }); },

    /** Left after engaging but before producing anything. */
    dispose() {
      if (started && !completed) {
        track('tool_abandoned', { ...base(), durationMs: Date.now() - startedAt });
      }
    },
  };
}
