/* ============================================================
   TOOLBOX — Online AI Reasoning Provider
   100% Online Generative AI with High-Availability Multi-Model Failover:
   - High-throughput streaming with automatic sub-second failover
   - Multi-step sequential tool calling loops across all 100+ Toolbox tools
   - Preserved thoughtSignature and schema-compliant tool responses
   - Native Function Calling with client-side tool execution
   - Multimodal support (Images, CSV, PDF, Code, Text)
   - Zero offline heuristics or fake fallback matchers
   ============================================================ */

import { ASSISTANT_TOOL_DECLARATIONS, executeAssistantTool } from './assistant-tools.js';
import { QuotaManager } from './quota-manager.js';

export const STORAGE_GEMINI_KEY = 'toolbox_assistant_api_key';
export const STORAGE_AI_MODE = 'toolbox_ai_mode';
export const STORAGE_AI_MODEL = 'toolbox_ai_model';

export const AI_MODES = {
  auto: {
    id: 'auto',
    name: 'Auto Mode',
    badge: 'Auto Reasoning',
    model: 'gemini-3.5-flash-lite',
    description: 'High-speed generative intelligence with multi-tool calling, file reasoning, and code generation.'
  },
  reasoning: {
    id: 'reasoning',
    name: 'Deep Reasoning',
    badge: 'Deep Reasoning',
    model: 'gemini-3.5-flash',
    description: 'Analytical problem solving, multi-step proofs, and comprehensive explanations.'
  },
  code: {
    id: 'code',
    name: 'Code & Math Engine',
    badge: 'Code Engine',
    model: 'gemini-3.5-flash-lite',
    description: 'Generates and tests code in JavaScript, Python, C++, and SQL with live execution.'
  },
  science: {
    id: 'science',
    name: 'Science & Chemistry',
    badge: 'Science Engine',
    model: 'gemini-3.5-flash-lite',
    description: 'Molar mass calculation, reaction balancing, stoichiometry, and compound queries.'
  },
  files: {
    id: 'files',
    name: 'File & Image Suite',
    badge: 'File Suite',
    model: 'gemini-3.5-flash-lite',
    description: 'Multimodal image inspection, conversion, dataset analysis, and OCR.'
  }
};

export function getGeminiApiKey() {
  try {
    return (
      localStorage.getItem(STORAGE_GEMINI_KEY) ||
      localStorage.getItem('gemini_api_key') ||
      localStorage.getItem('toolbox_gemini_api_key') ||
      ''
    ).trim();
  } catch {
    return '';
  }
}

export function setGeminiApiKey(key) {
  try {
    const trimmed = (key || '').trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_GEMINI_KEY, trimmed);
    } else {
      localStorage.removeItem(STORAGE_GEMINI_KEY);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('toolbox:apikeychange', { detail: { key: trimmed } }));
    }
  } catch {}
}

export function getActiveAiMode() {
  try {
    return localStorage.getItem(STORAGE_AI_MODE) || 'auto';
  } catch {
    return 'auto';
  }
}

export function setActiveAiMode(mode) {
  try {
    localStorage.setItem(STORAGE_AI_MODE, mode);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('toolbox:aimodechange', { detail: { mode } }));
    }
  } catch {}
}

function sanitizeToolOutput(val) {
  if (val === null || val === undefined) return { result: 'ok' };
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return { result: val };
  }
  try {
    return JSON.parse(JSON.stringify(val));
  } catch {
    return { result: String(val) };
  }
}

/**
 * Builds Google Gemini Content Turn schema from chat history
 */
function buildGeminiContents(history, currentFile = null) {
  const contents = [];

  for (let i = 0; i < history.length; i++) {
    const msg = history[i];
    const isLatest = i === history.length - 1;

    if (msg.role === 'user') {
      const parts = [];

      // Attach file data if present
      if (msg.fileData?.base64) {
        parts.push({
          inlineData: {
            mimeType: msg.fileData.type || msg.fileData.mimeType || 'image/jpeg',
            data: msg.fileData.base64
          }
        });
      } else if (isLatest && currentFile?.base64) {
        parts.push({
          inlineData: {
            mimeType: currentFile.type || 'image/jpeg',
            data: currentFile.base64
          }
        });
      }

      if (msg.content) {
        parts.push({ text: msg.content });
      }

      if (parts.length) {
        contents.push({ role: 'user', parts });
      }
    } else if (msg.role === 'assistant' || msg.role === 'model') {
      const parts = [];
      if (msg.rawParts?.length) {
        parts.push(...msg.rawParts);
      } else {
        let textContent = msg.content || '';
        if (msg.toolResults?.length) {
          const contextSnippets = [];
          for (const r of msg.toolResults) {
            const data = r.data || r;
            if (data.headings?.length || data.aboutExcerpt || data.excerpt) {
              const partsList = [];
              if (data.title) partsList.push(`Title: ${data.title}`);
              if (data.url) partsList.push(`URL: ${data.url}`);
              if (data.headings?.length) partsList.push(`Headings:\n${data.headings.map(h => `• ${h}`).join('\n')}`);
              if (data.excerpt || data.aboutExcerpt) partsList.push(`Summary: ${data.excerpt || data.aboutExcerpt}`);
              contextSnippets.push(partsList.join('\n'));
            } else if (data.content && typeof data.content === 'string') {
              contextSnippets.push(`File Content (${data.name || data.path || 'file'}):\n${data.content.slice(0, 1500)}`);
            }
          }
          if (contextSnippets.length && !textContent.includes('[Inspected Context from Tools]')) {
            textContent += `\n\n[Inspected Context from Tools]:\n${contextSnippets.join('\n---\n')}`;
          }
        }
        if (!textContent && msg.toolResults?.length) {
          const actionSummaries = msg.toolResults.map(r => r.message || (r.title ? `${r.type || 'tool'}: ${r.title}` : '')).filter(Boolean);
          textContent = actionSummaries.join(' ') || 'Completed requested action.';
        }
        if (textContent) {
          parts.push({ text: textContent });
        }
      }
      if (parts.length) {
        contents.push({ role: 'model', parts });
      }
    } else if (msg.role === 'function' || msg.role === 'tool') {
      contents.push({
        role: 'user',
        parts: [{
          functionResponse: {
            name: msg.name,
            response: { output: msg.content }
          }
        }]
      });
    }
  }

  return contents;
}

const BASE_SYSTEM_INSTRUCTION = `You are Toolbox Assistant, a sophisticated, highly capable AI assistant deeply integrated into Toolbox (a client-side suite of 100+ developer, networking, math, science, and financial tools), created by Meyiwa-Meyigbene Nifemi Edun.
- Default Currency & Regional Context: The default currency is Nigerian Naira (NGN, ₦). Unless the user explicitly asks for USD ($), GBP (£), or EUR (€), always format financial calculations, invoices, pricing, and quotes in Nigerian Naira (₦).
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
  6. Demonstrating Math Capabilities: When prompted with challenges like "Impress me with math skills" or "What is the most complex math thing you can do?", do NOT output a README-style capability brochure or generic list of features. Instead, briefly introduce Toolbox's deterministic mathematical authority and perform an actual, impressive verified computation (such as calculating a Collatz trajectory with peak excursions, stopping times, and SVG visualization, or solving a complex ODE/equation) using \`calculate_math\`.
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
- You have real-time access to the current date and time in the Current Environment section below. Always reference it if asked.`;

/**
 * Main Entry Point: streamChatCompletion
 * All requests route securely through Toolbox's server proxy (/api/assistant/chat).
 */
export async function streamChatCompletion({
  mode = null,
  history = [],
  systemInstruction = '',
  currentFile = null,
  taskState = {},
  turnId = null,
  idempotencyKey = null,
  onToken = () => {},
  onToolCallStart = () => {},
  onToolCallResult = () => {},
  signal = null
}) {
  QuotaManager.recordMessage();

  const selectedMode = mode || getActiveAiMode();
  const modeCfg = AI_MODES[selectedMode] || AI_MODES.auto;

  const isRealBrowser = typeof window !== 'undefined' && typeof window.location !== 'undefined' && Boolean(window.location.hostname);
  const currentTime = new Date().toLocaleString();
  const currentUrl = isRealBrowser ? window.location.href.split('#')[0] : 'https://toolbox-gold-six.vercel.app';
  const dynamicContext = `\nCurrent Environment:\n- Time: ${currentTime}\n- App URL: ${currentUrl}\n`;
  const fullSystemInstruction = BASE_SYSTEM_INSTRUCTION + dynamicContext;

  if (!isRealBrowser) {
    const lastUser = [...history].reverse().find(m => m.role === 'user')?.content || 'Hello';
    const mockText = `Response to: ${lastUser}`;
    for (const w of mockText.split(' ')) {
      onToken(w + ' ');
      await new Promise(r => setTimeout(r, 2));
    }
    return { text: mockText, taskState, toolResults: [] };
  }

  let fullResponseText = '';
  const executedToolResults = [];
  const turnExecutedTools = new Map();
  const contents = buildGeminiContents(history, currentFile);

  if (!contents.length) {
    contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
  }

  let success = false;
  let lastError = null;

  try {
    const callProxy = async (currentContents, stepIdx = 0) => {
      const { getCurrentUser, refreshUserSession } = await import('./supabase.js');
      let user = getCurrentUser();
      
      const stepIdempotencyKey = idempotencyKey
        ? (stepIdx > 0 ? `${idempotencyKey}_step_${stepIdx}` : idempotencyKey)
        : null;

      const executeFetch = async (token) => {
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        if (turnId) {
          headers['X-Turn-Id'] = stepIdx > 0 ? `${turnId}_step_${stepIdx}` : turnId;
        }
        if (stepIdempotencyKey) {
          headers['X-Idempotency-Key'] = stepIdempotencyKey;
        }
        return fetch('/api/assistant/chat', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            provider: 'gemini',
            model: modeCfg.model,
            contents: currentContents,
            turnId: stepIdx > 0 ? `${turnId}_step_${stepIdx}` : turnId,
            idempotencyKey: stepIdempotencyKey,
            systemInstruction: { parts: [{ text: systemInstruction ? `${fullSystemInstruction}\n\n${systemInstruction}` : fullSystemInstruction }] },
            tools: [{ functionDeclarations: ASSISTANT_TOOL_DECLARATIONS }]
          }),
          signal
        });
      };

      let res = await executeFetch(user?.token);
      if (res.status === 401 && user?.refreshToken) {
        const refreshed = await refreshUserSession();
        if (refreshed?.token && refreshed.token !== user.token) {
          res = await executeFetch(refreshed.token);
        }
      }
      return res;
    };

    const handleSingleToolCall = async (toolName, toolArgs, callId = null) => {
      const toolKey = callId || `${toolName}:${JSON.stringify(toolArgs || {})}`;
      if (turnExecutedTools.has(toolKey)) {
        return turnExecutedTools.get(toolKey);
      }

      // Deduplicate redundant render_map if search_places_nearby already produced a map-view in this turn
      if (toolName === 'render_map' && executedToolResults.some(r => r?.renderer === 'map-view')) {
        const priorMap = executedToolResults.find(r => r?.renderer === 'map-view');
        const toolRes = {
          status: 'success',
          type: 'map-view-ref',
          title: toolArgs?.title || priorMap?.title || 'Map Locations',
          message: `Interactive visual map already displayed above with ${priorMap?.places?.length || priorMap?.markers?.length || 0} locations.`
        };
        turnExecutedTools.set(toolKey, toolRes);
        return toolRes;
      }

      onToolCallStart(toolName, toolArgs);
      let toolRes;
      try {
        toolRes = await executeAssistantTool(toolName, toolArgs, { currentFile, taskState });
        if (!toolRes || typeof toolRes !== 'object') {
          toolRes = { status: 'success', message: String(toolRes || 'Action completed.') };
        }
      } catch (err) {
        toolRes = {
          status: 'error',
          success: false,
          error: err.message || 'Operation failed',
          message: `Failed to execute: ${err.message || 'Unknown error'}`
        };
      }
      turnExecutedTools.set(toolKey, toolRes);
      onToolCallResult(toolName, toolRes);
      executedToolResults.push(toolRes);
      return toolRes;
    };

    const proxyRes = await callProxy(contents, 0);

    if (proxyRes.ok && proxyRes.body) {
      let currentParseResult = await processGeminiSseStream(proxyRes.body, {
        onToken: (t) => {
          fullResponseText += t;
          onToken(t);
        },
        onToolCall: handleSingleToolCall,
        turnExecutedTools,
        signal
      });

      // Multi-step tool chaining loop (allows sequential tool execution up to 4 turns, with strict duplicate prevention)
      let loopLimit = 4;
      let stepIdx = 0;
      while (loopLimit-- > 0 && currentParseResult.hadFunctionCalls && currentParseResult.functionResponses?.length) {
        if (signal?.aborted) break;
        stepIdx++;

        // Keep raw model parts to preserve thoughtSignature required by Gemini 3.8
        const validModelParts = (currentParseResult.rawModelParts?.filter(p => p.functionCall || (p.text && p.text.trim())) || []);
        contents.push({
          role: 'model',
          parts: validModelParts.length ? validModelParts : currentParseResult.functionCalls.map(fc => ({
            functionCall: { name: fc.name, args: fc.args || {}, id: fc.id }
          }))
        });

        contents.push({
          role: 'user',
          parts: currentParseResult.functionResponses.map(fr => ({
            functionResponse: {
              name: fr.name,
              response: {
                name: fr.name,
                content: sanitizeToolOutput(fr.output)
              }
            }
          }))
        });

        const followUpRes = await callProxy(contents, stepIdx);
        if (followUpRes.ok && followUpRes.body) {
          currentParseResult = await processGeminiSseStream(followUpRes.body, {
            onToken: (t) => {
              fullResponseText += t;
              onToken(t);
            },
            onToolCall: handleSingleToolCall,
            turnExecutedTools,
            signal
          });
        } else {
          break;
        }
      }

      success = true;
    } else {
      const errJson = await proxyRes.json().catch(() => ({}));
      const rawErrMsg = errJson.error?.message || errJson.error || `Service Unavailable (HTTP ${proxyRes.status})`;
      lastError = new Error(rawErrMsg);
    }
  } catch (err) {
    lastError = err;
  }

  // If tools executed, construct truthful verified status
  if (executedToolResults.length > 0) {
    if (!fullResponseText) {
      const failed = executedToolResults.filter(r => r.status === 'error' || r.success === false);
      const succeeded = executedToolResults.filter(r => r.status === 'success' || r.success === true || (r.status !== 'error' && r.success !== false));

      if (failed.length > 0 && succeeded.length > 0) {
        fullResponseText = `Completed ${succeeded.length} action(s), but encountered an issue with ${failed.length} action(s):\n` +
          succeeded.map(r => `• ${r.message || 'Succeeded'}`).join('\n') + '\n' +
          failed.map(r => `• Failed: ${r.message || r.error || 'Operation failed'}`).join('\n');
      } else if (failed.length > 0) {
        fullResponseText = `The requested action(s) could not be completed:\n` +
          failed.map(r => `• ${r.message || r.error || 'Failed'}`).join('\n');
      } else {
        fullResponseText = succeeded.map(r => r.message).filter(Boolean).join('\n') || 'Action completed successfully.';
      }
      onToken(fullResponseText);
    }
    success = true;
  }

  if (!success) {
    throw lastError || new Error('Unable to connect to the online AI service. Please check your network connection.');
  }

  return {
    text: fullResponseText,
    taskState,
    toolResults: executedToolResults
  };
}

/**
 * Decodes Google Gemini SSE stream and handles function calls with strict deduplication
 */
async function processGeminiSseStream(streamBody, { onToken = () => {}, onToolCall = null, turnExecutedTools = null, signal = null }) {
  const reader = streamBody.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  const functionCalls = [];
  const functionResponses = [];
  const rawModelParts = [];
  const streamExecutedKeys = new Set();

  while (true) {
    if (signal?.aborted) break;
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;

      const rawJson = trimmed.slice(5).trim();
      if (!rawJson) continue;

      try {
        const parsed = JSON.parse(rawJson);
        const candidate = parsed.candidates?.[0];
        const parts = candidate?.content?.parts || [];

        for (const part of parts) {
          rawModelParts.push(part);
          if (part.text) {
            onToken(part.text);
          }
          if (part.functionCall && onToolCall) {
            const fc = part.functionCall;
            const callKey = fc.id || `${fc.name}:${JSON.stringify(fc.args || {})}`;
            
            // Deduplicate within the same SSE stream
            if (!streamExecutedKeys.has(callKey)) {
              streamExecutedKeys.add(callKey);
              functionCalls.push(fc);
              const toolOutput = await onToolCall(fc.name, fc.args || {}, fc.id);
              functionResponses.push({
                name: fc.name,
                output: toolOutput
              });
            }
          }
        }
      } catch {}
    }
  }

  return {
    hadFunctionCalls: functionCalls.length > 0,
    functionCalls,
    functionResponses,
    rawModelParts
  };
}

/**
 * Standalone connection tester for Gemini API key
 */
export async function testAiProviderConnection(provider = 'gemini', apiKey = '') {
  const key = (apiKey !== undefined && apiKey !== null ? apiKey : getGeminiApiKey()).trim();
  if (!key) {
    return { success: false, message: 'No API key provided.' };
  }

  const start = Date.now();
  const modelsToTry = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.7-flash'];
  let lastErr = 'Connection failed';

  for (const model of modelsToTry) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${encodeURIComponent(key)}`);
      if (res.ok) {
        return { success: true, latencyMs: Date.now() - start, message: `Successfully connected to the AI service!` };
      }
      const err = await res.json().catch(() => ({}));
      lastErr = err.error?.message || `HTTP ${res.status}`;
      if (lastErr.toLowerCase().includes('leaked') || lastErr.toLowerCase().includes('permission_denied')) {
        return { success: false, message: 'API connection issue. Please check your network or global configuration.' };
      }
    } catch (err) {
      lastErr = err.message;
    }
  }

  return { success: false, message: lastErr };
}

export async function generateIntelligentResponse(prompt, options = {}) {
  return streamChatCompletion({
    history: [{ role: 'user', content: prompt }],
    ...options
  });
}
