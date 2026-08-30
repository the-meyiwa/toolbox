/* ============================================================
   TOOLBOX — Real Generative AI Provider Client & Tool Loop
   Connects to Backend Proxy (/api/assistant/chat) & Google Gemini API
   with real SSE streaming, multi-turn context persistence,
   automated tool/function execution, and quota enforcement.
   ============================================================ */

import { ASSISTANT_TOOL_DECLARATIONS, executeAssistantTool } from './assistant-tools.js';
import { QuotaManager } from './quota-manager.js';

const DEFAULT_GEMINI_MODEL = 'gemini-1.5-flash';
const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

/**
 * Format message history into Gemini API Content Turn schema
 */
function buildGeminiContents(history, systemContext) {
  const contents = [];

  for (const msg of history) {
    if (msg.role === 'user') {
      const parts = [];
      if (msg.fileData) {
        parts.push({
          inlineData: {
            mimeType: msg.fileData.mimeType,
            data: msg.fileData.base64
          }
        });
      }
      parts.push({ text: msg.content || '' });
      contents.push({ role: 'user', parts });
    } else if (msg.role === 'assistant' || msg.role === 'model') {
      const parts = [];
      if (msg.toolCalls?.length) {
        for (const tc of msg.toolCalls) {
          parts.push({
            functionCall: {
              name: tc.name,
              args: tc.args
            }
          });
        }
      }
      if (msg.content) {
        parts.push({ text: msg.content });
      }
      contents.push({ role: 'model', parts });
    } else if (msg.role === 'function' || msg.role === 'tool') {
      contents.push({
        role: 'function',
        parts: [{
          functionResponse: {
            name: msg.name,
            response: { content: msg.content }
          }
        }]
      });
    }
  }

  return contents;
}

/**
 * Executes a streaming chat completion with automatic tool calling loop
 */
export async function streamChatCompletion({
  provider = 'gemini', // 'gemini' | 'groq' | 'openrouter' | 'proxy'
  apiKey = '',
  model = '',
  history = [],
  systemInstruction = '',
  currentFile = null,
  taskState = {},
  onToken = () => {},
  onToolCallStart = () => {},
  onToolCallResult = () => {},
  signal = null
}) {
  // Enforce quota limit before sending
  const quotaCheck = QuotaManager.canSendMessage();
  if (!quotaCheck.allowed) {
    throw new Error(quotaCheck.reason);
  }
  QuotaManager.recordMessage();

  const selectedModel = model || (provider === 'groq' ? DEFAULT_GROQ_MODEL : DEFAULT_GEMINI_MODEL);

  // Default system instruction with Toolbox context awareness
  const sysText = (systemInstruction || '') + `
You are Voltix Assistant, the intelligent AI operating layer of Toolbox.
Toolbox contains 100+ browser-based tools running client-side.
You have direct access to tools for converting images, resizing, cropping, compressing, removing watermarks, analyzing CSV datasets, executing code (JavaScript, Python, C++, SQL), financial calculations, and chemical compound queries.
When a user asks you to process a file, use the appropriate tool function call. You can chain multiple tools in sequence to complete multi-step tasks (e.g. crop -> resize -> compress).
You must never delete files. Provide thoughtful, step-by-step reasoning and clear answers.`;

  // Maximum tool calling depth to prevent runaway loops
  const MAX_TOOL_STEPS = 5;
  let currentStep = 0;
  let accumulatedFinalText = '';

  while (currentStep < MAX_TOOL_STEPS) {
    currentStep++;

    // 1. Google Gemini API Stream (via backend proxy with fallback to direct endpoint)
    if (provider === 'gemini') {
      const contents = buildGeminiContents(history, sysText);

      // Convert tool declarations to Gemini schema
      const toolsPayload = [{
        functionDeclarations: ASSISTANT_TOOL_DECLARATIONS.map(d => ({
          name: d.name,
          description: d.description,
          parameters: d.parameters
        }))
      }];

      let res;
      try {
        // Try backend proxy endpoint first (where secret key is securely stored)
        res = await fetch('/api/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: sysText }] },
            tools: toolsPayload,
            model: selectedModel
          }),
          signal
        });
        if (!res.ok) throw new Error('Proxy status ' + res.status);
      } catch (proxyErr) {
        // Fallback to direct Gemini API call
        const activeKey = apiKey || 'AIzaSyB1MDvomi9iWJ3CuZ7_Wvm7TST6RE7SBVI';
        const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:streamGenerateContent?alt=sse&key=${activeKey}`;
        res = await fetch(directUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: { parts: [{ text: sysText }] },
            tools: toolsPayload,
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 2000
            }
          }),
          signal
        });
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || errJson.error || `Gemini API returned HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let textChunk = '';
      let pendingFunctionCalls = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep last partial line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') continue;

          try {
            const data = JSON.parse(jsonStr);
            const candidate = data.candidates?.[0];
            if (!candidate) continue;

            const parts = candidate.content?.parts || [];
            for (const part of parts) {
              if (part.text) {
                textChunk += part.text;
                accumulatedFinalText += part.text;
                onToken(part.text);
              }
              if (part.functionCall) {
                pendingFunctionCalls.push(part.functionCall);
              }
            }
          } catch (e) {}
        }
      }

      // If the model did not invoke any functions, we are done
      if (!pendingFunctionCalls.length) {
        return { text: accumulatedFinalText, taskState };
      }

      // Handle function calls
      for (const fc of pendingFunctionCalls) {
        // Enforce heavy task / large file quotas if applicable
        if (fc.name === 'csv_analyze_and_chart' || fc.name === 'image_remove_watermark') {
          const heavyCheck = QuotaManager.canRunHeavyTask();
          if (!heavyCheck.allowed) {
            throw new Error(heavyCheck.reason);
          }
          QuotaManager.recordHeavyTask();
        }

        onToolCallStart(fc.name, fc.args);
        
        // Add assistant model call to history
        history.push({
          role: 'model',
          content: textChunk || '',
          toolCalls: [{ name: fc.name, args: fc.args }]
        });

        let toolResult;
        try {
          toolResult = await executeAssistantTool(fc.name, fc.args, { currentFile, taskState });
        } catch (err) {
          toolResult = { status: 'error', error: err.message };
        }

        onToolCallResult(fc.name, toolResult);

        // Add function response to history
        history.push({
          role: 'function',
          name: fc.name,
          content: JSON.stringify(toolResult)
        });
      }

      // Loop back to Gemini to synthesize response with the new tool output
      continue;
    }

    // 2. Groq / OpenAI-compatible API
    if (provider === 'groq' || provider === 'openrouter') {
      const endpoint = provider === 'groq'
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';

      const messages = [
        { role: 'system', content: sysText },
        ...history.map(h => ({
          role: h.role === 'model' ? 'assistant' : (h.role === 'function' ? 'tool' : h.role),
          content: typeof h.content === 'string' ? h.content : JSON.stringify(h.content),
          name: h.name
        }))
      ];

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: selectedModel,
          messages,
          temperature: 0.4,
          max_tokens: 2000,
          stream: true
        }),
        signal
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `API returned HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') continue;

          try {
            const data = JSON.parse(jsonStr);
            const delta = data.choices?.[0]?.delta?.content || '';
            if (delta) {
              accumulatedFinalText += delta;
              onToken(delta);
            }
          } catch (e) {}
        }
      }

      return { text: accumulatedFinalText, taskState };
    }

    break;
  }

  return { text: accumulatedFinalText, taskState };
}
