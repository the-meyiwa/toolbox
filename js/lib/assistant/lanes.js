/* ============================================================
   TOOLBOX — Assistant lanes

   One pipeline for every message made simple jobs slow and made
   the model stumble: a thank-you and a twelve-step build both got
   the whole tool list, the full system prompt and a thinking model.

   Each message now takes the lightest lane that can do the job and
   moves up a lane only when that one falls short:

     instant  no model. Sums, percentages, VAT, the date and time are
              computed here, in a millisecond, exactly.
     light    small talk. Tiny prompt, no tools, fastest model.
     quick    plain questions, writing and explanations from knowledge.
              Short prompt, no tools, a quick model. If the answer needs
              live data, the person's own things or an action, the model
              says so and the message moves up.
     focused  one or two clear jobs for the tools. Only those tools and
              their guidance are sent, few steps, a fast model.
     agent    open-ended work. The full tool set and prompt (as before).
     deep     hard, long or multi-part work. Thinks longer and plans.

   Routing is deterministic and costs nothing: it reads the message,
   the recent chat and any attachment. The gateway re-checks anything
   that makes a request cheaper, so a lane can never be used to get
   work done below its price.

   Pure: no DOM, no network, no storage. Shared by the browser, the
   evaluation harness and tests.
   ============================================================ */

import { isLightPrompt } from './light-turn.js';
import { instantAnswer } from './instant.js';
import { selectGroups, TOOL_GROUPS, groupAllowed } from './tool-groups.js';

export const LANES = Object.freeze({
  instant: Object.freeze({ id: 'instant', label: 'Instant', gateway: null, steps: 0, tools: 'none' }),
  light: Object.freeze({ id: 'light', label: 'Light', gateway: 'light', steps: 1, tools: 'none' }),
  quick: Object.freeze({ id: 'quick', label: 'Quick', gateway: 'quick', steps: 1, tools: 'none' }),
  focused: Object.freeze({ id: 'focused', label: 'Focused', gateway: 'fast', steps: 6, tools: 'groups' }),
  agent: Object.freeze({ id: 'agent', label: 'Agent', gateway: 'auto', steps: null, tools: 'all' }),
  deep: Object.freeze({ id: 'deep', label: 'Deep', gateway: 'reasoning', steps: null, tools: 'all' }),
});
export const LANE_IDS = Object.keys(LANES);
const RANK = Object.fromEntries(LANE_IDS.map((id, i) => [id, i]));
export const laneRank = (id) => RANK[id] ?? RANK.agent;

/** Words the model lanes that carry no tools cannot honour. */
export const ESCALATE_SENTINEL = '[[ESCALATE]]';

/** Where a lane sends a message it cannot finish. Agent and deep are the top. */
export function escalateFrom(lane, groups = new Set()) {
  if (lane === 'quick' || lane === 'light') return groups.size ? 'focused' : 'agent';
  if (lane === 'focused') return 'agent';
  return null;
}

/* ---------------- what a message is asking for ---------------- */

// The person's own things, or an action to perform. Needs tools whatever the wording.
const ACTION = /\b(?:my|mine|our)\s+(?:notes?|calendar|events?|files?|folders?|budget|debts?|invoices?|mail|e-?mails?|inbox|messages?|mind|reminders?|schedule|tasks?|documents?|contacts?|photos?|account|settings|playlist|projects?)\b|\b(?:open|launch|go to|navigate|save|download|upload|attach|delete|remove|rename|move|schedule|remind me|set (?:a |an )?(?:reminder|alarm|timer)|add (?:it|this|that|a|an)|send|e-?mail (?:him|her|them|it|this)|play)\b/i;
// Facts that change: only the web knows them.
const LIVE = /\b(?:live|right now|currently|latest|breaking|news|tonight|this (?:week|month|year)|today'?s|20(?:2[5-9]|3\d)|stocks?|share price|exchange rate|scores?|weather|forecast|trending|price of|how much (?:is|does|are) (?:a|an|the)\b.*\bcost)\b/i;
// Questions about Toolbox itself are answered from toolbox_help.
const ABOUT_TOOLBOX = /\btoolbox\b|\bthis (?:app|site|website|tool|assistant)\b|\bwhere (?:is|are|do i find|can i find)\b|\bhow (?:do|can) i (?:use|open|find|change|enable|turn|set up)\b/i;
// Work that is hard however it is worded.
const DEEP_CUES = /\b(?:prove|derive|proof of|step[- ]by[- ]step|think (?:hard|carefully|deeply)|in[- ]depth|comprehensive|thorough(?:ly)?|trade-?offs?|system design|business plan|roadmap|root cause|end[- ]to[- ]end|critique|audit|due diligence|case study)\b/i;
const SEQUENCE = /\b(?:then|after that|afterwards?|finally|next,|once (?:that'?s|you'?ve|it'?s) done|and also|as well as|firstly|first,)\b/gi;
// Tool groups whose jobs take several steps whatever the wording: they get the full agent,
// when the message asks for something to be made.
const AGENT_FLOOR = new Set(['code', 'building', 'modelling']);
const MAKE = /\b(?:design|build|create|make|draw|generate|model|quote|estimate|plan|develop|set ?up|construct|produce|render|code up|implement)\b/i;
// Messages that open like a question or a piece of writing are answered from knowledge, unless a
// group that must compute or look something up is in play.
const PREFACE = String.raw`(?:(?:in (?:one|two|three|under|less than|fewer than|about|around|\d+)\b[^,:.]{0,30}|briefly|quickly|simply|just|please|pls)[,:]?\s+)?`;
const OPENER = new RegExp(String.raw`^${PREFACE}(?:what|who|whom|whose|when|where|why|how|which|is|are|was|were|do|does|did|can|could|should|would|will|am|define|explain|describe|tell me|suggest|recommend|list|name|show (?:me )?(?:a|an)\b|and (?:in|what|how|why)|what's|whats|who's|how's|why's)\b`, 'i');
// Writing and rewriting need no lookup however the subject is worded ("make this SOUND more professional").
const WRITING = new RegExp(String.raw`^${PREFACE}(?:rewrite|rephrase|paraphrase|proofread|correct|translate|summari[sz]e|simplify|shorten|expand|improve|make (?:this|it|that) (?:sound|shorter|longer|clearer|more)|fix (?:the |my )?(?:grammar|spelling|wording)|draft|compose|write|brainstorm|help me (?:write|phrase|word|understand)|give me (?:a|an|some|\d+)\b)`, 'i');
// Groups whose subject a model can discuss without looking anything up or computing.
const SOFT_GROUPS = new Set(['documents', 'finance', 'legal', 'building', 'vehicles', 'music', 'cosmetics', 'code', 'devtools', 'images', 'data', 'design']);
// Nouns that mean a tool must act.
const TOOL_NOUN = /https?:\/\/|\bwww\.|\b(?:pdf|docx?|xlsx|pptx|spreadsheet|csv|chart|graph|plot|files?|folders?|image|photo|calendar|run|execute|compile|zip|download)\b|\b(?:write|draft|create|generate|make|prepare|issue)\s+(?:\w+\s+){0,3}(?:invoice|quotation|receipt)\b|\bnotes?\s+(?:titled|called|named)\b|\b(?:create|make|take|save|add|new)\s+(?:an?\s+|the\s+)?(?:new\s+)?notes?\b/i;
const CHEMISTRY = /\b(?:balance|molar mass|molecular (?:mass|weight)|moles? of)\b.*[A-Z][a-z]?\d*|\b[A-Z][a-z]?\d*\s*\+\s*[A-Z][a-z]?\d*\s*(?:=|->|→)/;

/** How hard a message looks, from 0 (a sentence) upward. */
export function complexity(text, groupCount = 0, hasFile = false) {
  const t = String(text || '');
  let score = 0;
  score += Math.min((t.match(SEQUENCE) || []).length, 4);
  if (DEEP_CUES.test(t)) score += 2;
  if (t.length > 700) score += 2; else if (t.length > 280) score += 1;
  if ((t.match(/^\s*(?:\d+[.)]|[-*•])\s+/gm) || []).length >= 3) score += 2;
  score += Math.min(Math.max(groupCount - 1, 0), 3);
  if (hasFile) score += 1;
  return score;
}

/**
 * Chooses the lane for a message.
 *
 *   text      the latest user message
 *   history   the chat so far (including that message)
 *   hasFile   an attachment travels with this message
 *   fileType  its MIME type
 *   mode      the Assistant mode the person picked ('auto', 'fast', 'reasoning', 'code', …)
 *   scope     'global' for the Assistant itself; other scopes bring their own tools and prompt
 *   custom    the caller supplied its own tool list
 *   now       for the clock answers
 *
 * Returns { lane, why, groups, score, answer? }; `answer` is set for the instant lane.
 */
export function routeTurn({ text = '', history = [], hasFile = false, fileType = '', mode = 'auto', scope = 'global', custom = false, now = new Date() } = {}) {
  const groups = new Set();
  if (scope !== 'global' || custom) return { lane: 'agent', why: 'caller supplies its own tools', groups, score: 0 };
  const t = typeof text === 'string' ? text.trim() : '';

  if (mode === 'reasoning') {
    const g = selectGroups({ history, hasFile, fileType });
    return { lane: 'deep', why: 'deep thinking mode', groups: g, score: 9 };
  }

  if (!hasFile && t) {
    if (isLightPrompt(t)) return { lane: 'light', why: 'small talk', groups, score: 0 };
    const answer = instantAnswer(t, { now });
    if (answer) return { lane: 'instant', why: answer.kind, groups, score: 0, answer };
  }

  const picked = selectGroups({ history, hasFile, fileType });
  if (LIVE.test(t) && groupAllowed('web')) picked.add('web');
  if (CHEMISTRY.test(t) && groupAllowed('science')) picked.add('science');
  const score = complexity(t, picked.size, hasFile);
  // A follow-up to tool work ("now make it red") needs the tools that made it.
  const recent = history.slice(-3, -1);
  const followUp = recent.some(m => (m.role === 'assistant' || m.role === 'model') && m.toolResults?.length);
  const numbers = (t.match(/\d[\d,]*(?:\.\d+)?/g) || []).length;
  const hard = [...picked].filter(g => !SOFT_GROUPS.has(g));
  // Quoted text is material to work on, not an instruction: "rewrite: 'send the invoice'" sends nothing.
  const bare = t.replace(/"[^"]*"|“[^”]*”|«[^»]*»/g, ' ');
  const open = !ACTION.test(bare) && !LIVE.test(bare) && !TOOL_NOUN.test(bare) && !hasFile && !followUp;
  // Asked in words, answered in words. Writing ignores which groups the words happen to touch;
  // a question does too unless a group that must compute or look something up is in play.
  const asking = open && complexity(t, 0, false) < 2 && (
    (WRITING.test(t) && t.length <= 900) ||
    (OPENER.test(t) && !hard.length && numbers < 2 && t.length <= 600));

  let lane;
  let why;
  if ((DEEP_CUES.test(t) && score >= 3) || t.length > 900 || score >= 7) { lane = 'deep'; why = `hard or multi-part (${score})`; }
  else if (asking) { lane = 'quick'; why = 'a question or writing task'; }
  else if (hasFile) { lane = 'agent'; why = 'works on an attachment'; }
  else if (MAKE.test(t) && [...picked].some(g => AGENT_FLOOR.has(g))) { lane = 'agent'; why = 'builds or designs something'; }
  else if (picked.size >= 3 || score >= 3) { lane = 'agent'; why = `several parts (${score})`; }
  else if (picked.size >= 1) { lane = 'focused'; why = `${[...picked].join(' + ')}`; }
  else if (ACTION.test(t)) { lane = 'agent'; why = 'acts on their things'; }
  else if (followUp) { lane = 'focused'; why = 'follows up on tool work'; }
  else if (LIVE.test(t) || ABOUT_TOOLBOX.test(t)) { lane = 'focused'; why = 'needs live data or Toolbox help'; }
  else if (t.length > 400) { lane = 'agent'; why = 'long request'; }
  else { lane = 'quick'; why = 'answerable from knowledge'; }

  // The person's mode can raise a lane's floor or cap its ceiling.
  if ((mode === 'code' || mode === 'files') && laneRank(lane) < RANK.agent && lane !== 'quick') { lane = 'agent'; why += `; ${mode} mode`; }
  if (mode === 'fast' && laneRank(lane) > RANK.focused) { lane = 'focused'; why += '; fast mode'; }
  return { lane, why, groups: picked, score };
}

/** A line for the status chip and the timing log. */
export const laneLabel = (id) => LANES[id]?.label || 'Agent';

/** Names of the groups, for the lean prompt and the debug log. */
export const groupLabels = (groups) => [...groups].filter(g => TOOL_GROUPS[g]).map(g => TOOL_GROUPS[g].label.split(':')[0]);
