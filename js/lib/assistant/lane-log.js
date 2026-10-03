/* ============================================================
   TOOLBOX — Lane log

   How long each lane really takes, so the router can be judged on
   numbers and not on feel: time to the first word, time to finish,
   how often a message had to move up a lane. The last 80 turns are
   kept on this device only (no text is stored, just the lane, the
   timings and the model). Read it in the console:

       toolboxLanes()          per-lane summary
       toolboxLanes('raw')     the individual turns

   Pure apart from localStorage, which is optional.
   ============================================================ */

const KEY = 'toolbox_assistant_lanes_v1';
const MAX = 80;
let memory = null;

function load() {
  if (memory) return memory;
  try { const raw = typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem(KEY) || '[]') : []; memory = Array.isArray(raw) ? raw.slice(-MAX) : []; } catch { memory = []; }
  return memory;
}

/** Records a finished turn: { lane, trail, firstMs, totalMs, steps, tools, provider, model }. */
export function recordLane(entry) {
  const list = load();
  list.push({
    at: Date.now(),
    lane: String(entry.lane || 'agent'),
    trail: Array.isArray(entry.trail) ? entry.trail.slice(0, 6) : [],
    firstMs: Number.isFinite(entry.firstMs) ? Math.round(entry.firstMs) : null,
    totalMs: Number.isFinite(entry.totalMs) ? Math.round(entry.totalMs) : null,
    steps: entry.steps | 0,
    tools: entry.tools | 0,
    provider: entry.provider || null,
    model: entry.model || null,
  });
  if (list.length > MAX) list.splice(0, list.length - MAX);
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage full or blocked */ }
}

const pct = (values, p) => {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  return v.length ? v[Math.min(v.length - 1, Math.floor(p * v.length))] : null;
};

/** Per-lane summary of the log: turns, median and 90th-percentile first-word and total time, escalations. */
export function laneStats(list = load()) {
  const out = {};
  for (const e of list) {
    const lane = e.trail?.[0] || e.lane;                    // grouped by where the turn started
    const s = (out[lane] ||= { turns: 0, escalated: 0, first: [], total: [] });
    s.turns++;
    if ((e.trail?.length || 0) > 1) s.escalated++;
    s.first.push(e.firstMs);
    s.total.push(e.totalMs);
  }
  return Object.fromEntries(Object.entries(out).map(([lane, s]) => [lane, {
    turns: s.turns,
    escalated: s.escalated,
    firstP50: pct(s.first, 0.5), firstP90: pct(s.first, 0.9),
    totalP50: pct(s.total, 0.5), totalP90: pct(s.total, 0.9),
  }]));
}

export const laneLog = () => load().slice();
export function clearLaneLog() { memory = []; try { if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY); } catch { /* ignore */ } }

if (typeof window !== 'undefined') {
  window.toolboxLanes = (what) => (what === 'raw' ? laneLog() : laneStats());
}
