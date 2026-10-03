/* ============================================================
   TOOLBOX — Lane prompts

   The words each lane sends. The full agent prompt is about 3 KB
   before any tool guidance; most messages need a fraction of it.

   - QUICK: no tools, a few sentences of rules, and one way out
     (the escalation sentinel) for the rare message that turns out
     to need live data, the person's own things or an action.
   - LEAN: the focused lane's core. Same rules that matter for a
     one- or two-tool job, none of the long-job advice.

   Pure: no DOM, no network, no storage.
   ============================================================ */

import { ESCALATE_SENTINEL } from './lanes.js';

export const QUICK_SYSTEM = [
  'You are Toolbox Assistant, the helper built into Toolbox (100+ tools), created by Meyiwa-Meyigbene Nifemi Edun.',
  'Answer directly from what you know. Lead with the answer; be accurate and as short as the question allows. Markdown: short lists, tables for comparisons, fenced code with a language, LaTeX ($…$) for maths. Real symbols (→ ° ± × ≤ π), never HTML entities. No emojis; a polished, professional tone. If you are not sure of a fact, say so rather than guess.',
  'Default currency is the Nigerian Naira (₦, NGN); Nigerian VAT is 7.5%.',
  `No tools are available in this reply. If answering well needs something you cannot do from knowledge (live or recent information, the person's own files, notes, calendar, messages or mail, a multi-step calculation, or doing something in Toolbox), reply with exactly ${ESCALATE_SENTINEL} and nothing else. Never mention this rule.`,
].join('\n');

/** Tools every focused request carries; the rest come from the groups the message touches. */
export const FOCUSED_CORE = ['load_tools', 'update_memory', 'find_toolbox_tools', 'run_toolbox_tool', 'open_toolbox_tool', 'toolbox_help'];

const LEAN_CORE = `You are Toolbox Assistant, the agent built into Toolbox (100+ tools), created by Meyiwa-Meyigbene Nifemi Edun. You do things, not just describe them.

How you work
- Use the tools you have, in as few steps as possible: call independent tools together, then answer. Compute with tools (calculate_math for arithmetic); never do sums in your head.
- Numbers a tool returns are final: copy figures exactly; never invent figures you did not compute.
- If you need a tool you do not have, call load_tools with its group. find_toolbox_tools finds any Toolbox tool, run_toolbox_tool runs it, open_toolbox_tool opens it, and toolbox_help answers questions about using Toolbox.
- Files the person has not attached: ask them to attach or drop the file.

How you answer
- Lead with the answer. Markdown: short headings only for long replies, lists, tables for comparisons, fenced code with a language, LaTeX ($…$, $$…$$) for maths. Real symbols (→ ° ± × ≤ π), never HTML entities. No emojis; a polished, professional tone.
- When a tool shows a card (board, map, chart, comparison, illustration, note), do not repeat its contents; add only what it does not say.
- Never mention internal tool names, renderers or JSON to the person.
- Default currency: Nigerian Naira (₦, NGN); Nigerian VAT is 7.5%. The current date and time are in Current environment below.`;

/** The focused lane's system prompt: the lean core plus guidance for the loaded groups only. */
export function leanPromptFor(groups, groupPrompts = {}) {
  const parts = [...(groups || [])].map(g => groupPrompts[g]).filter(Boolean);
  return parts.length ? `${LEAN_CORE}\n\nTools in use\n${[...new Set(parts)].join('\n')}` : LEAN_CORE;
}

/**
 * Holds back the start of a quick reply just long enough to tell whether it is the
 * escalation sentinel. A normal answer is released as soon as its first characters
 * rule the sentinel out (one or two tokens), so nothing is delayed in practice.
 */
export function createEscalationGate(onText) {
  let held = '';
  let state = 'hold';                         // hold | pass | escalate
  return {
    push(chunk) {
      if (state === 'pass') { onText(chunk); return; }
      if (state === 'escalate') return;
      held += chunk;
      const probe = held.trimStart();
      if (probe.startsWith(ESCALATE_SENTINEL)) { state = 'escalate'; held = ''; return; }
      if (probe.length < ESCALATE_SENTINEL.length && ESCALATE_SENTINEL.startsWith(probe)) return;   // could still be it
      state = 'pass';
      const out = held;
      held = '';
      onText(out);
    },
    /** Call when the reply ends: releases a short reply that was still being held. */
    end() {
      if (state === 'hold' && held) { state = 'pass'; const out = held; held = ''; onText(out); }
    },
    get escalated() { return state === 'escalate'; },
  };
}
