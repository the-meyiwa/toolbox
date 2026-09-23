/* ============================================================
   TOOLBOX — Assistant engine

   One tool-calling loop for every model. The browser sends the
   conversation and the tool list to the Toolbox server
   (/api/assistant/v2/chat), which picks a model provider
   (Gemini, OpenAI, DeepSeek, Groq, OpenRouter — whichever are
   configured, failing over in order) and streams its answer
   back in the OpenAI chat-completions format.

   Tool calls run here in the browser, where the tools live:
   chess engine, device database, notes, files, calculators,
   the code playground, web browsing through the server, and
   every Toolbox tool through run_toolbox_tool. Results go back
   to the model until it answers without asking for a tool.
   ============================================================ */

import { ASSISTANT_TOOL_DECLARATIONS, executeAssistantTool } from './assistant-tools.js';
import { EXTRA_TOOL_DECLARATIONS, EXTRA_TOOL_NAMES, executeExtraTool } from './assistant/extra-tools.js';
import { QuotaManager } from './quota-manager.js';
import { getCurrentUser, refreshUserSession } from './supabase.js';
import { TOOLS } from '../registry/index.js';

export const STORAGE_GEMINI_KEY = 'toolbox_assistant_api_key';
export const STORAGE_AI_MODE = 'toolbox_ai_mode';
export const STORAGE_AI_MODEL = 'toolbox_ai_model';
export const STORAGE_AI_PROVIDER = 'toolbox_ai_provider';

export const AI_MODES = {
  auto: {
    id: 'auto', name: 'Auto', badge: 'Auto', model: 'auto',
    description: 'Balanced thinking. Uses tools whenever they help.',
  },
  fast: {
    id: 'fast', name: 'Fast', badge: 'Fast', model: 'auto',
    description: 'Quick answers with light thinking.',
  },
  reasoning: {
    id: 'reasoning', name: 'Deep thinking', badge: 'Deep thinking', model: 'auto',
    description: 'Thinks longer. For proofs, hard problems and long multi-step tasks.',
  },
  code: {
    id: 'code', name: 'Build', badge: 'Build', model: 'auto',
    description: 'Writes, runs and fixes code; builds apps in the Code Playground.',
  },
  science: {
    id: 'science', name: 'Math & science', badge: 'Math & science', model: 'auto',
    description: 'Works problems through the math, chemistry and physics tools.',
  },
  files: {
    id: 'files', name: 'Files', badge: 'Files', model: 'auto',
    description: 'Reads, converts and edits images, PDFs, spreadsheets and documents.',
  },
};

const MODE_EFFORT = { auto: 'auto', fast: 'fast', reasoning: 'reasoning', code: 'reasoning', science: 'reasoning', files: 'auto' };
const MODE_GUIDANCE = {
  code: 'The person is building. Prefer running code over describing it: write complete programs, execute them with the code tools, read the output, fix errors and run again. For apps, open or populate the Code Playground.',
  science: 'Work every numeric step through calculate_math / calculate_chemistry or the relevant Toolbox tool and show the working. Verify results before answering.',
  files: 'Focus on the attached or saved files. Inspect them with the file tools before answering and save outputs back to Files.',
  reasoning: 'Take the time to think carefully. For multi-step work, start with update_plan, then carry out every step with tools and verify the result.',
  fast: 'Be brief. Use a tool only when it is needed for a correct answer.',
};

/* ---------------- stored preferences (kept for older callers) ---------------- */

export function getGeminiApiKey() {
  try {
    return (localStorage.getItem(STORAGE_GEMINI_KEY) || localStorage.getItem('gemini_api_key') || localStorage.getItem('toolbox_gemini_api_key') || '').trim();
  } catch { return ''; }
}

export function setGeminiApiKey(key) {
  try {
    const trimmed = (key || '').trim();
    if (trimmed) localStorage.setItem(STORAGE_GEMINI_KEY, trimmed);
    else localStorage.removeItem(STORAGE_GEMINI_KEY);
    window.dispatchEvent(new CustomEvent('toolbox:apikeychange', { detail: { key: trimmed } }));
  } catch { /* storage unavailable */ }
}

export function getActiveAiMode() {
  try { const m = localStorage.getItem(STORAGE_AI_MODE); return AI_MODES[m] ? m : 'auto'; } catch { return 'auto'; }
}

export function setActiveAiMode(mode) {
  try {
    localStorage.setItem(STORAGE_AI_MODE, mode);
    window.dispatchEvent(new CustomEvent('toolbox:aimodechange', { detail: { mode } }));
  } catch { /* storage unavailable */ }
}

/** Preferred provider id ('' = let the server choose). */
export function getPreferredProvider() {
  try { return localStorage.getItem(STORAGE_AI_PROVIDER) || ''; } catch { return ''; }
}
export function setPreferredProvider(id) {
  try { if (id) localStorage.setItem(STORAGE_AI_PROVIDER, id); else localStorage.removeItem(STORAGE_AI_PROVIDER); } catch { /* storage unavailable */ }
}

/* ---------------- tool list ---------------- */

/** Gemini-style schemas ('OBJECT', 'STRING') → JSON Schema every provider accepts. */
function normalizeSchema(node) {
  if (Array.isArray(node)) return node.map(normalizeSchema);
  if (!node || typeof node !== 'object') return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    if (v === undefined || v === null) continue;
    if (k === 'type' && typeof v === 'string') out.type = v.toLowerCase();
    else if (k === 'properties' && v && typeof v === 'object') {
      out.properties = {};
      for (const [pk, pv] of Object.entries(v)) out.properties[pk] = normalizeSchema(pv);
    } else if (k === 'nullable' || k === 'format' && typeof v === 'string' && !/^(date-time|date|email|uri|enum)$/.test(v)) {
      continue;
    } else out[k] = normalizeSchema(v);
  }
  if (out.type === 'array' && !out.items) out.items = { type: 'string' };
  if (out.type === 'object' && !out.properties) out.properties = {};
  if (Array.isArray(out.required) && out.properties) {
    out.required = out.required.filter(r => r in out.properties);
    if (!out.required.length) delete out.required;
  }
  if (Array.isArray(out.enum)) out.enum = out.enum.map(String);
  return out;
}

const REGISTRY_TOOL_IDS = new Set(TOOLS.map(t => t.id));

function buildToolList(declarations) {
  const seen = new Set();
  const list = [];
  for (const d of declarations) {
    if (!d?.name || seen.has(d.name)) continue;
    seen.add(d.name);
    list.push({
      type: 'function',
      function: {
        name: d.name,
        description: String(d.description || '').slice(0, 1000),
        parameters: normalizeSchema(d.parameters || { type: 'object', properties: {} }),
      },
    });
  }
  return list;
}

let defaultTools = null;
/** Core tools + the capability pack. Per-tool navigation declarations are replaced by find/run/open_toolbox_tool. */
function defaultToolList() {
  if (defaultTools) return defaultTools;
  const core = ASSISTANT_TOOL_DECLARATIONS.filter(d => !d?.name?.startsWith('open_tool_') && !d?.name?.startsWith('navigate_to_') && !REGISTRY_TOOL_IDS.has(d?.name) && !EXTRA_TOOL_NAMES.has(d?.name));
  // Registry declarations are the ones the discovery layer generates; drop anything it produced.
  const registryNames = new Set(registryDeclarationNames());
  defaultTools = buildToolList([...EXTRA_TOOL_DECLARATIONS, ...core.filter(d => !registryNames.has(d.name))]).slice(0, 128);
  return defaultTools;
}

function registryDeclarationNames() {
  // Registry declarations appear before the first core declaration ('list_saved_artifacts').
  const names = [];
  for (const d of ASSISTANT_TOOL_DECLARATIONS) {
    if (d?.name === 'list_saved_artifacts') break;
    if (d?.name) names.push(d.name);
  }
  return names;
}

/* ---------------- conversation → chat messages ---------------- */

const TEXT_TYPES = /^(text\/|application\/(json|xml|javascript|x-yaml|yaml|csv|sql|x-sh))/;

function decodeBase64Text(b64) {
  try {
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch { return ''; }
}

function fileParts(file) {
  if (!file?.base64) return [];
  const type = file.type || file.mimeType || 'application/octet-stream';
  const name = file.name || 'attachment';
  if (type.startsWith('image/')) {
    return [{ type: 'image_url', image_url: { url: `data:${type};base64,${file.base64}` } }];
  }
  if (TEXT_TYPES.test(type) || /\.(txt|md|csv|json|js|ts|py|html|css|xml|yml|yaml|sql|log)$/i.test(name)) {
    const text = decodeBase64Text(file.base64);
    return [{ type: 'text', text: `Attached file "${name}" (${type}):\n\`\`\`\n${text.slice(0, 60000)}${text.length > 60000 ? '\n… (truncated)' : ''}\n\`\`\`` }];
  }
  return [{ type: 'text', text: `Attached file "${name}" (${type}, ${Math.round(file.base64.length * 0.75 / 1024)} KB). Its bytes are available to the file tools (PDF, image, dataset and conversion tools) as the current file.` }];
}

function toolContextOf(msg) {
  if (!msg.toolResults?.length) return '';
  const lines = [];
  for (const r of msg.toolResults) {
    const data = r?.data || r || {};
    const name = r?.toolName || data.type || 'tool';
    const summary = data.message || data.summary || data.title || '';
    const bits = [];
    if (data.url) bits.push(`URL: ${data.url}`);
    if (data.excerpt || data.aboutExcerpt) bits.push(String(data.excerpt || data.aboutExcerpt).slice(0, 800));
    if (typeof data.content === 'string') bits.push(data.content.slice(0, 1200));
    if (data.fen) bits.push(`FEN: ${data.fen}`);
    lines.push(`- ${name}: ${summary}${bits.length ? `\n  ${bits.join('\n  ')}` : ''}`);
  }
  return `\n\n[Tools used in this reply]\n${lines.join('\n')}`;
}

function buildMessages(history, currentFile, system) {
  const out = [{ role: 'system', content: system }];
  history.forEach((msg, i) => {
    const isLatest = i === history.length - 1;
    if (msg.role === 'user') {
      const parts = [];
      const file = msg.fileData?.base64 ? msg.fileData : (isLatest ? currentFile : null);
      parts.push(...fileParts(file));
      if (msg.content) parts.push({ type: 'text', text: String(msg.content) });
      if (!parts.length) return;
      out.push({ role: 'user', content: parts.length === 1 && parts[0].type === 'text' ? parts[0].text : parts });
    } else if (msg.role === 'assistant' || msg.role === 'model') {
      const text = `${msg.content || ''}${toolContextOf(msg)}`.trim();
      if (text) out.push({ role: 'assistant', content: text });
    }
  });
  // Providers require the conversation to end on a user turn.
  if (out.length === 1 || out[out.length - 1].role !== 'user') out.push({ role: 'user', content: 'Continue.' });
  return out;
}

/* ---------------- tool results → model ---------------- */

function compactForModel(value, depth = 0) {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (/^data:[\w/+.-]+;base64,/.test(value) && value.length > 400) return `[binary data, ${Math.round(value.length * 0.75 / 1024)} KB]`;
    return value.length > 6000 ? `${value.slice(0, 6000)}… (${value.length - 6000} more characters)` : value;
  }
  if (typeof value !== 'object') return value;
  if (depth > 6) return '[…]';
  if (Array.isArray(value)) {
    const items = value.slice(0, 60).map(v => compactForModel(v, depth + 1));
    if (value.length > 60) items.push(`… ${value.length - 60} more`);
    return items;
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'function' || k === 'element' || k === 'node') continue;
    if (k === 'svg' && typeof v === 'string') { out[k] = `[SVG drawing, ${v.length} characters, shown to the person]`; continue; }
    out[k] = compactForModel(v, depth + 1);
  }
  return out;
}

function toolResultText(result) {
  let text;
  try { text = JSON.stringify(compactForModel(result)); } catch { text = String(result); }
  return text.length > 24000 ? `${text.slice(0, 24000)}… (truncated)` : text;
}

/* ---------------- streaming ---------------- */

async function authHeader(forceRefresh = false) {
  let user = getCurrentUser();
  if (forceRefresh && user?.refreshToken) user = await refreshUserSession();
  return user?.token ? { Authorization: `Bearer ${user.token}` } : {};
}

class GatewayError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function openGateway(body, signal) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch('/api/assistant/v2/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader(attempt > 0)) },
      body: JSON.stringify(body),
      signal,
    });
    if (res.ok && res.body) return res;
    const payload = await res.json().catch(() => ({}));
    if (res.status === 401 && attempt === 0 && getCurrentUser()?.refreshToken) continue;
    if (res.status === 404) throw new GatewayError('The Assistant service is not available on this server yet. Redeploy the Toolbox API.', 404);
    throw new GatewayError(payload.error || `The Assistant service answered with ${res.status}.`, res.status);
  }
  throw new GatewayError('Sign in to Toolbox to use the Assistant.', 401);
}

/**
 * Reads one streamed model turn.
 * Returns { text, thinking, toolCalls, finish, provider }.
 */
async function readTurn(res, { onText, onThinking, onProvider, signal }) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event = 'message';
  let text = '', thinking = '', finish = null, provider = null;
  const calls = [];
  let inThought = false, pending = '';   // Gemini wraps thoughts in <thought>…</thought> inside content

  const emitContent = (chunk) => {
    pending += chunk;
    for (;;) {
      if (!inThought) {
        const at = pending.indexOf('<thought>');
        if (at === -1) {
          // Hold back a partial "<thought" at the end of the chunk.
          const keep = partialTagTail(pending, '<thought>');
          const out = pending.slice(0, pending.length - keep);
          pending = pending.slice(pending.length - keep);
          if (out) { text += out; onText(out); }
          return;
        }
        const out = pending.slice(0, at);
        if (out) { text += out; onText(out); }
        pending = pending.slice(at + 9);
        inThought = true;
      } else {
        const at = pending.indexOf('</thought>');
        if (at === -1) {
          const keep = partialTagTail(pending, '</thought>');
          const out = pending.slice(0, pending.length - keep);
          pending = pending.slice(pending.length - keep);
          if (out) { thinking += out; onThinking(out); }
          return;
        }
        const out = pending.slice(0, at);
        if (out) { thinking += out; onThinking(out); }
        pending = pending.slice(at + 10);
        inThought = false;
      }
    }
  };

  const handle = (evt, data) => {
    if (data === '[DONE]') return;
    let json;
    try { json = JSON.parse(data); } catch { return; }
    if (evt === 'provider') { provider = json; onProvider(json); return; }
    if (evt === 'error' || (json.error && !json.choices)) {
      throw new GatewayError(json.error?.message || json.error || 'The model stopped unexpectedly.', 502);
    }
    const choice = json.choices?.[0];
    if (!choice) return;
    const delta = choice.delta || choice.message || {};
    const reasoning = delta.reasoning_content ?? delta.reasoning ?? delta.thinking;
    if (typeof reasoning === 'string' && reasoning) { thinking += reasoning; onThinking(reasoning); }
    if (typeof delta.content === 'string' && delta.content) emitContent(delta.content);
    for (const tc of delta.tool_calls || []) {
      const idx = typeof tc.index === 'number' ? tc.index : calls.length;
      const slot = calls[idx] || (calls[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } });
      if (tc.id) slot.id = tc.id;
      if (tc.function?.name) slot.function.name += tc.function.name;
      if (tc.function?.arguments) slot.function.arguments += tc.function.arguments;
      if (tc.extra_content) slot.extra_content = tc.extra_content;   // Gemini thought signatures
    }
    if (choice.finish_reason) finish = choice.finish_reason;
  };

  try {
    for (;;) {
      if (signal?.aborted) break;
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, '');
        buffer = buffer.slice(nl + 1);
        if (!line) { event = 'message'; continue; }
        if (line.startsWith(':')) continue;
        if (line.startsWith('event:')) { event = line.slice(6).trim(); continue; }
        if (line.startsWith('data:')) handle(event, line.slice(5).trim());
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* already released */ }
  }
  if (pending) {
    if (inThought) { thinking += pending; onThinking(pending); } else { text += pending; onText(pending); }
  }
  const toolCalls = calls.filter(c => c && c.function.name).map((c, i) => ({ ...c, id: c.id || `call_${Date.now().toString(36)}_${i}` }));
  return { text, thinking, toolCalls, finish, provider };
}

function partialTagTail(s, tag) {
  for (let n = Math.min(tag.length - 1, s.length); n > 0; n--) {
    if (s.endsWith(tag.slice(0, n))) return n;
  }
  return 0;
}

function parseArgs(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch {
    // Some models close the JSON early or add trailing text.
    const m = String(raw).match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
    return { input: String(raw) };
  }
}

/* ---------------- system prompt ---------------- */

const CAPABILITIES = `You are Toolbox Assistant, the agent built into Toolbox — a workspace of 100+ tools — created by Meyiwa-Meyigbene Nifemi Edun. You do things, not just describe them. You have real tools and you should use them freely and chain them to finish the whole job.

How you work
- For anything that takes several steps (research, building something, analysing files, planning), call update_plan first with short steps, then do the steps with tools, updating the plan as each finishes. Keep going until the task is complete; do not stop to ask permission for ordinary steps.
- Prefer computing to guessing: arithmetic and algebra go through calculate_math, chemistry through calculate_chemistry, code through the code execution tools. Check results before you report them.
- Any Toolbox tool can be used: call find_toolbox_tools to discover the right one, run_toolbox_tool to run it on input directly, and open_toolbox_tool to open it for the person.
- Chess: chess_analyze evaluates a position or game (best move, evaluation, opening, move quality); chess_play plays a move and lets the engine answer; chess_open_board opens a position on the Chess board. Never invent evaluations — use the engine.
- Devices: device_specs and device_compare cover 1,300+ phones, tablets, laptops, chips, CPUs, GPUs, watches, headphones and consoles from the Toolbox database.
- Vehicles: vehicle_lookup decodes VINs and gives specifications for cars by make, model and year.
- Web: browse_web / browser_navigate / browser_scrape / browser_crawl read live pages; search_images finds pictures. Cite the pages you used.
- Visuals: draw_illustration draws SVG illustrations and diagrams; csv_analyze_and_chart and the chart tools make charts; render_map shows places.
- Notes and files: create_note, update_note, list_notes, get_note; create_file, save_file and the artifact tools keep work in Files.
- Scripture: the Bible and Quran tools read verses and passages; quote them exactly as returned.
- Building apps: write complete working code and put it in the Code Playground (or run it with the code tools), then report what you built.

How you answer
- Lead with the answer. Use Markdown: short headings when the reply is long, lists, tables for comparisons, fenced code with a language, and LaTeX ($…$ inline, $$…$$ display) for math.
- When a tool shows a card (board, map, chart, device comparison, illustration, note), do not repeat its contents; add only what the card does not say.
- Never mention internal tool names, renderers or JSON to the person.
`;

const LEGACY_RULES = `- Default Currency & Regional Context: The default currency is Nigerian Naira (NGN, ₦). Unless the user explicitly asks for USD ($), GBP (£), or EUR (€), always format financial calculations, invoices, pricing, and quotes in Nigerian Naira (₦).
- Strict Tool Calling & Zero Pretending/Hallucination:
  1. ONLY invoke a tool when the user's intent directly and unambiguously matches the tool's intended purpose.
  2. For human clinical illnesses, patient symptoms, pathology, or ICD-11 diagnostic codes, invoke \`search_diseases\`.
  3. NEVER invoke \`search_diseases\` or anatomy tools for chemical compounds, chemical compositions, food, ingredients, natural substances (e.g. "compounds inside honey", "ingredients in tea"), plants, recipes, nutrition, driving schools, or non-medical science.
  4. When asked about the chemical composition of foods, plants, or natural substances (e.g. honey, green tea, coffee, vinegar), answer directly in text with thorough, accurate biochemical breakdowns (e.g., fructose, glucose, sucrose, maltose, gluconic acid, hydrogen peroxide, methylglyoxal, defensin-1, flavonoids, phenolic acids) or use \`calculate_chemistry\` for formula molar masses and chemical database lookups. Do not invoke medical disease tools.
- Live Geolocation & Visual Interactive Map Rendering:
  1. When the user asks for nearest places, stores, businesses, or services (e.g. supermarkets, restaurants, pharmacies, banks, clinics, driving schools), invoke \`search_places_nearby\` directly.
  2. Entity Preservation: When the user specifies a named business, brand, or store (e.g. "Shoprite", "KFC", "Domino's Pizza"), ALWAYS pass that exact business name in the \`query\` argument of \`search_places_nearby\`. NEVER discard the brand name or replace it with an unrelated category or service. Preserve the distinction between:
     - named entity / query (e.g. "Shoprite")
     - category (e.g. "supermarket")
     - location (e.g. "Lagos", "Kosofe")
     - proximity constraint ("nearest")
  3. Direct Natural Answer First:
     - For proximity queries (e.g. "Where is the nearest gas station?"), lead your conversational response by directly naming the nearest verified place and its distance (e.g., "The nearest verified gas station I found is NNPC, about 7.7 km away.").
     - Never lead with robotic generic counts like "Found 5 verified gas station near...".
     - Never say "Rendered interactive visual map" or expose renderer names, tool names, or internal execution details.
     - NEVER use emojis anywhere in your response (no location pins 📍, no phone emojis 📞, no decorative emojis).
  4. For ALL geographic, travel, route, or landmark requests, ALWAYS invoke \`search_places_nearby\` or \`render_map\` to display a rich, visual interactive map card in chat with markers, pins, and coordinates. Do not just reply with plain text—always include the visual map.
  5. Never associate a geographic location with an unrelated business type. A geographic area must NEVER determine an unrelated default business category (e.g., NEVER return driving schools when the user asks for a supermarket, retail store, or dining venue). Only return driving schools when the user explicitly asks for driving schools, driver licensing, or driving tests.
  6. Zero Duplicate Text Regurgitation: When \`search_places_nearby\` is invoked, it already renders the complete visual interactive map and verified place cards. Do NOT invoke \`render_map\` after \`search_places_nearby\`. Do NOT regurgitate duplicate markdown lists, bullet points, or tables of the places in your text response.
- Real Audio Playback & iTunes Search:
  - When the user asks to play sounds, songs, instruments, music previews, or background sounds (e.g. 'play rain sounds', 'play jazz', 'play guitar', 'play Chopin'), ALWAYS invoke \`play_sound\` with the query. This searches iTunes for real audio tracks and renders an interactive audio player card in chat with live play/pause, scrub bar, and volume controls.
- Mathematical Authority, Deterministic Math Engine & Knowledge Library:
  1. For ALL deterministic mathematical computations, arithmetic, equations (linear, quadratic, cubic, polynomials), calculus (derivatives, definite/indefinite integrals), linear algebra (matrix determinants, inverses), number theory (GCD, LCM, primes, prime factorization, Euler totient), sequences (Collatz, Fibonacci), combinatorics (permutations, combinations), four-figure tables, and constants, invoke \`calculate_math\`. Never attempt to manually perform or hallucinate deterministic mathematical calculations in LLM text when the Math Utility is available.
  2. For mathematical reference, theorems, formulas, identities, laws, definitions, or famous open problems, invoke \`query_math_knowledge\`.
  3. Strict Proof Status: NEVER state that unproven conjectures (such as the 3x+1 Collatz conjecture, Goldbach conjecture, Riemann hypothesis) are proven facts. Always clearly distinguish PROVEN THEOREMS from UNPROVEN CONJECTURES or OPEN PROBLEMS. For example, Collatz is an unproven conjecture even if a specific input like 12 or 27 reaches 1.
  4. Chemistry & Domain Separation: For chemical formulas, molar masses, and chemical reactions, use \`calculate_chemistry\`. The chemistry engine remains authoritative for chemical data.
  5. Contextual, Non-Barebones Mathematical Responses: Provide clear, complete mathematical answers. For formula/concept questions, state the exact formula in clean math notation ($$...$$) and explain variable meanings and conditions. For equations and numerical problems, state the equation, roots/values, working steps, and residual verification. For sequences (Collatz), state the sequence, steps to 1, maximum excursion, and explicitly mention unproven conjecture status. Never output raw tool JSON, raw tool execution strings, internal renderer names, or barebones one-line unexplained answers.
  6. Demonstrating Math Capabilities: When prompted with challenges like "Impress me with math skills" or "What is the most complex math thing you can do?", do NOT output a README-style capability brochure or generic list of features, and do NOT default to the same worked example every time (e.g. do not always reach for the Collatz conjecture). Vary the demonstration across the conversation and pick an example that fits the immediate context -- algorithms, simulations, statistics, optimization, data analysis, visualization, numerical methods, or a genuinely hard equation/ODE -- and perform an actual, impressive verified computation using \`calculate_math\`, not a canned one.
- 3D Anatomy Explorer & Structure Isolation:
  - When the user asks to view or isolate specific organs or bones (e.g. C1 vertebra/Atlas, C2/Axis, cervical vertebrae, lungs, trachea, heart), invoke \`explore_anatomy\` with the exact structure name so the 3D model isolates and zooms in directly on that specific organ or vertebra without rendering extraneous body parts.
- When a user asks you to create a note, save a note, write a note, or record information, invoke the \`create_note\` tool directly with the requested title and content.
- When a user asks you to save an artifact (code, document, data), invoke the \`save_toolbox_artifact\` tool or \`save_file\` tool.
- Calendar & Event Management Integration:
  - When the user asks to schedule an event, set a reminder, plan an appointment/meeting, or check their schedule/calendar, invoke the \`calendar_add_event\` or \`calendar_get_events\` tool directly.
  - Do not print calendar outputs in plain barebones text—the interactive visual calendar card renders the schedule with date chips, categories, and direct calendar links.
- Browser & Web Research & Proactive Action Integration:
  - When the user asks to search the web, research a topic, compare items, check reviews, look up documentation, or browse a website, invoke the \`browse_web\`, \`browser_navigate\`, or \`browser_scrape\` tools directly.
  - NEVER Guess or Invent URLs: If the user did not provide an explicit website URL or domain, or if you are not 100% confident about the exact website address, DO NOT invent or guess speculative URLs (e.g. do NOT guess "https://nanoreview.net/en/phone-compare/..."). Instead, provide the keywords or question in the \`query\` parameter (e.g. \`browse_web({ query: "nano review iphone 15 pro vs iphone 16 pro" })\`). The browser engine will search Google and the live web and retrieve authoritative results.
  - Only provide \`url\` when the user has explicitly specified a target website or domain (e.g. "go to theverge.com", "open https://github.com").
  - Deliver Real Answers, Not Just Inspection Notices: When inspecting a website or news source (e.g., "what news is on theverge today?", "what are they talking about on site X?", "summarize article Y"), DO NOT simply state that the page was inspected. Actively read the extracted content, headings, articles, and excerpts returned by the tool, and synthesize a clear, comprehensive, and well-structured conversational answer directly to the user (e.g., list the top headlines, summarize the key stories, compare products or prices).
  - Autonomous Deep Navigation & Site Exploration:
    - NEVER stop on the homepage if the user's goal or inquiry requires subpage details (e.g. photos, gallery, products, pricing, contact, team, documentation).
    - When asked to explore a site or find media/information (e.g. "navigate to the gallery and get the photos", "scrape 15 images from site X", "find their pricing"):
      1. If a specific section or subpage was requested (e.g. "gallery", "photos", "about", "pricing"), navigate directly to that subpage or invoke \`browser_extract_images\` on the subpage (e.g. \`https://www.containerbrick.com/gallery\`).
      2. If you start on the homepage, read the \`links\` array, autonomously follow the relevant link with \`browser_navigate\` or \`browse_web\`, and retrieve the target data.
      3. Never claim assets don't exist merely because they aren't on the homepage—autonomously explore subpages to complete the user's request.
  - Proactive Follow-Up Actions: Proactively act on the user's intent. When a user asks questions about a site, answer the question thoroughly with bullet points and bold highlights. If relevant, offer or execute real follow-up actions (e.g., saving a news summary or research report to Files via \`create_file\`, extracting structured data into a CSV via \`generate_csv\`, or digging deeper into a specific article).
  - Multi-Stage Web Scraping & CSV Generation: When instructed to scrape products, pricing, or data and generate a CSV (e.g., Apple products and Nigerian prices with Category and Product Type):
    1. Use \`browser_scrape\` or \`browser_crawl\` to inspect real pages and structured data.
    2. Extract verified attributes (name, category, type, price in NGN, source URL). Never fabricate prices—represent missing values as null or N/A.
    3. Invoke \`generate_csv\` or \`create_file\` to save the CSV into workspace artifacts.
    4. Provide a natural summary of findings and methodology without leaking raw execution logs.
  - Informational Image Searches & Visual Answers: For visual subject queries (e.g., "What does the femur look like?", "Show me the Great Wall of China", "What does a motherboard look like?"), invoke \`search_images\` to render an interactive visual image gallery alongside your explanation. Never output raw image URLs.
- Clean Symbol Formatting & Output Quality (NO Raw Entities or Barebones Text):
  - ALWAYS format symbols cleanly and properly. NEVER output raw unrendered HTML entities (e.g. &rarr;, &times;, &plusmn;, &deg;, &#39;) or unicode escape sequences (e.g. \\u2192, \\u00b0) in plain text. Use the actual rendered unicode character (e.g. →, °, ±, ×, ÷, ≤, ≥, ≠, ≈, π, Ω) or proper LaTeX.
  - NEVER output raw pseudo-characters (e.g. "->", "+/-") in plain text when stating scientific, mathematical, or financial symbols.
  - NEVER print responses in plain barebones text. Structure all responses using rich, beautifully formatted Markdown with clear section headings, bulleted lists, bold highlights, and tables where applicable.
- You can execute real browser tools across networking (run_speed_test, dns_lookup, weather_forecast), audio & sounds (play_sound, control_audio), web research & browsing (browse_web, browser_navigate, browser_scrape, browser_extract_images, browser_crawl, search_images), image transformations (image_convert_and_resize, image_crop, image_compress), PDF handling (pdf_process), datasets (csv_analyze_and_chart, generate_csv), QR codes (generate_qr_code), calendar (calendar_add_event, calendar_get_events, calendar_delete_event), math, chemistry, unit conversions, financial modeling, notes, and sandboxed code execution in Python, JavaScript, C++, and SQL.
- Maintain a clean, polished, professional, and elegant tone without emojis or slang.
- If a user asks to edit a PDF, convert an image, or analyze a dataset and no file is attached, invite them to drag & drop or upload their file.
- For math formulas, use clean LaTeX formatting ($$...$$).
- For code snippets, provide complete, working code in language-specific code blocks.
- When a tool returns structured UI such as audio players, cards, notes, charts, calendar events, or interactive maps, do not narrate the existence of those controls. Only provide natural-language text when it adds useful information beyond what the UI itself communicates.
- The current date and time are in the Current environment section below.`;

/* ---------------- main entry ---------------- */

export async function streamChatCompletion({
  mode = null,
  history = [],
  systemInstruction = '',
  currentFile = null,
  taskState = {},
  turnId = null,
  idempotencyKey = null,
  onToken = () => {},
  onThinking = () => {},
  onToolCallStart = () => {},
  onToolCallResult = () => {},
  onStatus = () => {},
  onProvider = () => {},
  signal = null,
  scope = 'global',
  toolDeclarations = null,
  toolExecutor = null,
  maxSteps = null,
  provider = null,
}) {
  QuotaManager.recordMessage?.();

  const selectedMode = AI_MODES[mode] ? mode : getActiveAiMode();
  const isRealBrowser = typeof window !== 'undefined' && Boolean(window.location?.hostname);
  if (!isRealBrowser) {
    const lastUser = [...history].reverse().find(m => m.role === 'user')?.content || 'Hello';
    const mockText = `Response to: ${lastUser}`;
    onToken(mockText);
    return { text: mockText, taskState, toolResults: [] };
  }

  const now = new Date();
  const environment = `\nCurrent environment\n- Date and time: ${now.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})\n- App: ${window.location.origin}\n- Active tool: ${taskState?.activeToolId || 'Home'}\n`;
  const guidance = MODE_GUIDANCE[selectedMode] ? `\nMode: ${AI_MODES[selectedMode].name}. ${MODE_GUIDANCE[selectedMode]}\n` : '';
  const system = scope === 'global'
    ? `${CAPABILITIES}\nHouse rules\n${LEGACY_RULES}\n${environment}${guidance}${systemInstruction ? `\n${systemInstruction}` : ''}`
    : `${systemInstruction || ''}\n${environment}`;

  const tools = toolDeclarations ? buildToolList(toolDeclarations) : defaultToolList();
  const messages = buildMessages(history, currentFile, system);
  const limit = maxSteps || (selectedMode === 'fast' ? 6 : selectedMode === 'auto' || selectedMode === 'files' ? 16 : 24);

  let fullText = '';
  let fullThinking = '';
  let providerInfo = null;
  const executed = [];
  const cache = new Map();

  const runTool = async (name, args, id) => {
    const key = `${name}:${JSON.stringify(args || {})}`;
    if (cache.has(key)) return cache.get(key);
    if (name === 'render_map' && executed.some(r => r?.renderer === 'map-view')) {
      const ref = { status: 'success', type: 'map-view-ref', message: 'The map is already shown above.' };
      cache.set(key, ref);
      return ref;
    }
    onToolCallStart(name, args, id);
    let result;
    try {
      if (toolExecutor) result = await toolExecutor(name, args);
      if (result === undefined && EXTRA_TOOL_NAMES.has(name)) result = await executeExtraTool(name, args);
      if (result === undefined) result = await executeAssistantTool(name, args, { currentFile, taskState });
      if (result == null || typeof result !== 'object') result = { status: 'success', message: String(result ?? 'Done.') };
    } catch (err) {
      result = { status: 'error', success: false, error: err?.message || 'The tool failed.', message: `That did not work: ${err?.message || 'unknown error'}` };
    }
    if (!result.toolName) result.toolName = name;
    cache.set(key, result);
    executed.push(result);
    onToolCallResult(name, result, id);
    return result;
  };

  for (let step = 0; step < limit; step++) {
    if (signal?.aborted) break;
    onStatus({ type: step === 0 ? 'thinking' : 'continuing', step });
    const res = await openGateway({
      messages,
      tools: tools.length ? tools : undefined,
      mode: MODE_EFFORT[selectedMode] || 'auto',
      provider: provider || getPreferredProvider() || undefined,
      turnId, idempotencyKey,
    }, signal);

    const turn = await readTurn(res, {
      signal,
      onText: (t) => { fullText += t; onToken(t); },
      onThinking: (t) => { fullThinking += t; onThinking(t); },
      onProvider: (p) => { providerInfo = p; onProvider(p); },
    });

    if (!turn.toolCalls.length) break;

    // Keep the model's own words (and Gemini's signatures) with its tool calls.
    messages.push({
      role: 'assistant',
      content: turn.text || null,
      tool_calls: turn.toolCalls.map(c => ({ id: c.id, type: 'function', function: { name: c.function.name, arguments: c.function.arguments || '{}' }, ...(c.extra_content ? { extra_content: c.extra_content } : {}) })),
    });
    if (turn.text && !/\s$/.test(fullText)) { fullText += '\n\n'; onToken('\n\n'); }

    for (const call of turn.toolCalls) {
      if (signal?.aborted) break;
      const args = parseArgs(call.function.arguments);
      const result = await runTool(call.function.name, args, call.id);
      messages.push({ role: 'tool', tool_call_id: call.id, content: toolResultText(result) });
    }

    if (step === limit - 1 && !signal?.aborted) {
      // Out of steps: ask for a final answer without tools.
      messages.push({ role: 'user', content: 'You have used the available tool steps. Summarise what you did and give your final answer now, without calling more tools.' });
      const last = await openGateway({ messages, mode: MODE_EFFORT[selectedMode] || 'auto', provider: providerInfo?.provider }, signal);
      await readTurn(last, {
        signal,
        onText: (t) => { fullText += t; onToken(t); },
        onThinking: (t) => { fullThinking += t; onThinking(t); },
        onProvider: () => {},
      });
    }
  }

  if (!fullText.trim() && executed.length) {
    const failed = executed.filter(r => r.status === 'error' || r.success === false);
    const ok = executed.filter(r => !failed.includes(r));
    const lines = [...ok.map(r => r.message).filter(Boolean), ...failed.map(r => `Could not finish: ${r.error || r.message}`)];
    fullText = lines.join('\n') || 'Done.';
    onToken(fullText);
  }

  onStatus({ type: 'done' });
  return {
    text: fullText,
    thinking: fullThinking,
    taskState,
    toolResults: executed,
    provider: providerInfo?.label || providerInfo?.provider || null,
    model: providerInfo?.model || null,
  };
}

/** Checks the server gateway and lists the model providers it can use. */
export async function testAiProviderConnection() {
  const start = Date.now();
  try {
    const res = await fetch('/api/assistant/v2/providers', { headers: await authHeader() });
    if (!res.ok) return { success: false, message: res.status === 404 ? 'The Assistant service is not deployed on the server yet.' : `The server answered with ${res.status}.` };
    const { providers = [] } = await res.json();
    if (!providers.length) return { success: false, providers, message: 'No model provider keys are set on the server.' };
    return { success: true, providers, latencyMs: Date.now() - start, message: `Connected. Models available: ${providers.map(p => p.label).join(', ')}.` };
  } catch (err) {
    return { success: false, message: err?.message || 'Could not reach the Toolbox server.' };
  }
}

export async function listAiProviders() {
  const r = await testAiProviderConnection();
  return r.providers || [];
}

export async function generateIntelligentResponse(prompt, options = {}) {
  return streamChatCompletion({ history: [{ role: 'user', content: prompt }], ...options });
}
