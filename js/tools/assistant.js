/* ============================================================
   TOOLBOX — Voltix AI Assistant
   Real generative-AI assistant powered by live LLM API (Google Gemini,
   Groq, OpenRouter) with token streaming, multi-turn persistent context,
   real function/tool calling across 100+ browser tools, and safe file transformations.
   ============================================================ */

import { streamChatCompletion } from '../lib/ai-provider.js';
import { BY_ID } from '../registry/index.js';

const STORAGE_SPLASH_SEEN = 'voltix_assistant_splash_seen_v2';
const STORAGE_API_KEY = 'toolbox_assistant_api_key';
const STORAGE_PROVIDER = 'toolbox_assistant_provider';
const STORAGE_MODEL = 'toolbox_assistant_model';
const STORAGE_KEEP_CONTEXT = 'toolbox_assistant_keep_context';
const STORAGE_HISTORY = 'toolbox_assistant_history_v2';

export default {
  render(container, { tool, currentToolId } = {}) {
    this._alive = true;
    this._abortCtrl = null;

    let provider = localStorage.getItem(STORAGE_PROVIDER) || 'gemini';
    let apiKey = localStorage.getItem(STORAGE_API_KEY) || 'AIzaSyB1MDvomi9iWJ3CuZ7_Wvm7TST6RE7SBVI';
    let model = localStorage.getItem(STORAGE_MODEL) || 'gemini-1.5-flash';
    let keepContext = localStorage.getItem(STORAGE_KEEP_CONTEXT) !== 'false';

    let history = [];
    try {
      if (keepContext) {
        history = JSON.parse(localStorage.getItem(STORAGE_HISTORY) || '[]');
      }
    } catch {}

    const taskState = {
      activeToolId: currentToolId || null,
      lastProcessedImage: null,
      lastCsvText: null,
      attachedFiles: []
    };

    container.innerHTML = `
      <div class="voltix-assistant-root" style="max-width:1040px; margin:0 auto; display:flex; flex-direction:column; height:760px; background:var(--white); border:1px solid var(--g200); border-radius:18px; overflow:hidden; box-shadow:0 16px 48px rgba(0,0,0,0.08); position:relative; font-family:var(--sans);">
        
        <!-- HEADER BAR -->
        <div style="padding:12px 20px; border-bottom:1px solid var(--g200); background:var(--g50); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <!-- Left: Branding, Keep Context, Active Tool Badge -->
          <div style="display:flex; align-items:center; gap:14px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:36px; height:36px; border-radius:50%; background:var(--black); color:var(--white); display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.15);">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              </div>
              <div>
                <div style="display:flex; align-items:center; gap:6px;">
                  <span style="font-size:0.96rem; font-weight:800; color:var(--black); letter-spacing:-0.01em;">Voltix Assistant</span>
                  <span style="font-size:0.68rem; font-weight:700; background:#22c55e; color:#fff; padding:1px 7px; border-radius:9999px;">AI Layer</span>
                </div>
                <div style="font-size:0.72rem; color:var(--g500); display:flex; align-items:center; gap:4px;" id="ast-context-indicator">
                  ${taskState.activeToolId ? `Active Tool: <strong>${BY_ID.get(taskState.activeToolId)?.name || taskState.activeToolId}</strong>` : 'Connected to 100+ Toolbox Browser Tools'}
                </div>
              </div>
            </div>

            <div style="height:22px; width:1px; background:var(--g300);"></div>

            <!-- Keep Context Toggle at Top Left -->
            <label style="display:flex; align-items:center; gap:6px; font-size:0.78rem; font-weight:600; cursor:pointer; user-select:none; color:var(--g700);" title="Preserve multi-turn memory across follow-ups">
              <input type="checkbox" id="ast-chk-context" ${keepContext ? 'checked' : ''} style="cursor:pointer; accent-color:var(--black);">
              Keep Context
            </label>
          </div>

          <!-- Right: About/Splash, API Settings, Clear -->
          <div style="display:flex; align-items:center; gap:8px;">
            <button type="button" class="btn btn-secondary btn-sm" id="ast-btn-splash" style="font-size:0.74rem;">About</button>
            <button type="button" class="btn btn-secondary btn-sm" id="ast-btn-config" style="font-size:0.74rem; display:flex; align-items:center; gap:5px;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              <span>API Settings</span>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="ast-btn-clear" style="font-size:0.74rem; color:#ef4444;" title="Clear Conversation">Clear</button>
          </div>
        </div>

        <!-- CHAT MESSAGE STREAM -->
        <div id="ast-messages" style="flex:1; overflow-y:auto; padding:24px; display:flex; flex-direction:column; gap:20px; background:var(--white);">
          <!-- Render existing history or welcome card -->
        </div>

        <!-- ATTACHED FILE PREVIEW CHIP (IF FILE ATTACHED) -->
        <div id="ast-attached-bar" style="display:none; padding:8px 20px; background:var(--g100); border-top:1px solid var(--g200); align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:8px; font-size:0.78rem; font-weight:600; color:var(--g800);">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            <span id="ast-attached-name">image.png</span>
            <span id="ast-attached-size" style="color:var(--g500); font-weight:400;">(240 KB)</span>
          </div>
          <button type="button" id="ast-attached-remove" style="background:none; border:none; color:var(--g500); cursor:pointer; font-size:1.1rem; line-height:1;">&times;</button>
        </div>

        <!-- QUICK PROMPT CHIPS -->
        <div style="padding:6px 20px; background:var(--g50); border-top:1px solid var(--g200); display:flex; gap:8px; overflow-x:auto; scrollbar-width:none;" id="ast-chips">
          <button type="button" class="btn btn-secondary btn-sm ast-chip" style="font-size:0.74rem;">Convert this image to WebP and resize to 1200px</button>
          <button type="button" class="btn btn-secondary btn-sm ast-chip" style="font-size:0.74rem;">Analyze and chart this CSV dataset</button>
          <button type="button" class="btn btn-secondary btn-sm ast-chip" style="font-size:0.74rem;">Remove watermark and crop 5% edges</button>
          <button type="button" class="btn btn-secondary btn-sm ast-chip" style="font-size:0.74rem;">Run C++ program to find prime numbers</button>
        </div>

        <!-- BOTTOM INPUT FORM -->
        <div style="padding:14px 20px; background:var(--white); border-top:1px solid var(--g200); display:flex; align-items:flex-end; gap:12px;">
          <input type="file" id="ast-file-input" style="display:none;" accept="image/*,.csv,.json,.txt,.cpp,.js,.py">
          <button type="button" class="btn btn-secondary" id="ast-attach-btn" title="Attach file (Image, CSV, Code)" style="width:42px; height:42px; padding:0; border-radius:50%; flex-shrink:0;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </button>

          <textarea id="ast-user-input" rows="1" placeholder="Ask Voltix Assistant to analyze files, run code, or execute tools..." style="flex:1; border:1px solid var(--g300); border-radius:22px; padding:11px 18px; font-family:var(--sans); font-size:0.9rem; outline:none; resize:none; max-height:140px; line-height:1.45; transition:border-color 0.2s;"></textarea>

          <button type="button" class="btn btn-primary" id="ast-send-btn" style="width:42px; height:42px; padding:0; border-radius:50%; flex-shrink:0;" title="Send Message">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>

        <!-- SPLASH SCREEN MODAL (FIRST TIME) -->
        <div id="ast-splash-modal" style="display:none; position:absolute; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); z-index:100; align-items:center; justify-content:center; padding:20px;">
          <div style="background:var(--white); border-radius:24px; padding:36px; max-width:500px; width:100%; box-shadow:0 24px 60px rgba(0,0,0,0.4); text-align:center; position:relative;">
            
            <div style="width:68px; height:68px; border-radius:50%; background:var(--black); color:var(--white); display:flex; align-items:center; justify-content:center; margin:0 auto 16px; box-shadow:0 8px 24px rgba(0,0,0,0.2);">
              <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            </div>

            <h2 style="margin:0 0 8px; font-size:1.45rem; font-weight:800; color:var(--black);">Meet Voltix Assistant</h2>
            
            <!-- Voltix Callout -->
            <div style="background:var(--g100); border:1px solid var(--g200); border-radius:14px; padding:14px 18px; margin:16px 0; font-size:0.9rem; color:var(--g800); text-align:left;">
              <div style="font-weight:700; color:var(--black); font-size:0.95rem; margin-bottom:4px;">Assistant also powers Voltix.</div>
              <div style="font-size:0.84rem; color:var(--g600);">
                Experience the Voltix intelligent interface at <a href="https://voltix-rho.vercel.app" target="_blank" rel="noopener noreferrer" style="color:#2563eb; font-weight:700; text-decoration:underline;">https://voltix-rho.vercel.app</a>
              </div>
            </div>

            <div style="text-align:left; font-size:0.84rem; color:var(--g700); margin-bottom:24px; display:flex; flex-direction:column; gap:10px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="color:#22c55e; font-weight:800;">✓</span> <strong>Real LLM Intelligence</strong>: Powered by Google Gemini & Groq
              </div>
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="color:#22c55e; font-weight:800;">✓</span> <strong>Tool & Function Calling</strong>: Automatically executes Toolbox tools
              </div>
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="color:#22c55e; font-weight:800;">✓</span> <strong>Safe File Transforms</strong>: Never deletes your files or notes
              </div>
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="color:#22c55e; font-weight:800;">✓</span> <strong>Persistent Context</strong>: Retains multi-turn conversation memory
              </div>
            </div>

            <button type="button" class="btn btn-primary" id="ast-splash-continue" style="width:100%; border-radius:9999px; height:46px; font-weight:700; font-size:0.95rem;">
              Continue to Assistant
            </button>
          </div>
        </div>

        <!-- API CONFIG MODAL -->
        <div id="ast-config-modal" style="display:none; position:absolute; inset:0; background:rgba(0,0,0,0.65); backdrop-filter:blur(10px); z-index:100; align-items:center; justify-content:center; padding:20px;">
          <div style="background:var(--white); border-radius:20px; padding:30px; max-width:480px; width:100%; box-shadow:0 20px 50px rgba(0,0,0,0.3); text-align:left; position:relative;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
              <h3 style="margin:0; font-size:1.15rem; font-weight:800;">AI Engine & API Settings</h3>
              <button type="button" id="ast-config-close" style="background:none; border:none; font-size:1.3rem; cursor:pointer; color:var(--g500);">&times;</button>
            </div>

            <div style="margin-bottom:16px;">
              <label class="calc-label" style="font-weight:700; font-size:0.8rem;">LLM Provider</label>
              <select id="ast-provider-select" class="tool-input" style="width:100%; padding:9px 12px; font-size:0.86rem; border-radius:8px;">
                <option value="gemini" ${provider === 'gemini' ? 'selected' : ''}>Google Gemini (Recommended · Free Tier on Google AI Studio)</option>
                <option value="groq" ${provider === 'groq' ? 'selected' : ''}>Groq (Llama 3.3 70B · Fast Free Tier)</option>
                <option value="openrouter" ${provider === 'openrouter' ? 'selected' : ''}>OpenRouter (Free Models)</option>
              </select>
            </div>

            <div style="margin-bottom:16px;">
              <label class="calc-label" style="font-weight:700; font-size:0.8rem;">Model</label>
              <input type="text" id="ast-model-input" class="tool-input" value="${model}" style="width:100%; padding:9px 12px; font-size:0.86rem; font-family:monospace; border-radius:8px;">
              <div style="font-size:0.72rem; color:var(--g500); margin-top:4px;">
                Default: <code>gemini-1.5-flash</code> (Gemini) or <code>llama-3.3-70b-versatile</code> (Groq).
              </div>
            </div>

            <div id="ast-key-wrap" style="margin-bottom:20px;">
              <label class="calc-label" style="font-weight:700; font-size:0.8rem;">API Key</label>
              <input type="password" id="ast-key-input" class="tool-input" placeholder="Paste your API key..." value="${apiKey}" style="width:100%; padding:9px 12px; font-size:0.86rem; font-family:monospace; border-radius:8px;">
              <div style="font-size:0.74rem; color:var(--g600); margin-top:6px; line-height:1.4;">
                Get a free key at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" style="color:#2563eb; font-weight:700; text-decoration:underline;">Google AI Studio</a>. Keys are stored safely in local browser storage only.
              </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:10px;">
              <button type="button" class="btn btn-secondary btn-sm" id="ast-config-cancel">Cancel</button>
              <button type="button" class="btn btn-primary btn-sm" id="ast-config-save">Save & Connect</button>
            </div>
          </div>
        </div>

      </div>
    `;

    const messagesEl = container.querySelector('#ast-messages');
    const userInput = container.querySelector('#ast-user-input');
    const sendBtn = container.querySelector('#ast-send-btn');
    const attachBtn = container.querySelector('#ast-attach-btn');
    const fileInput = container.querySelector('#ast-file-input');
    const attachedBar = container.querySelector('#ast-attached-bar');
    const attachedName = container.querySelector('#ast-attached-name');
    const attachedSize = container.querySelector('#ast-attached-size');
    const attachedRemove = container.querySelector('#ast-attached-remove');
    const contextChk = container.querySelector('#ast-chk-context');
    const splashModal = container.querySelector('#ast-splash-modal');
    const splashBtn = container.querySelector('#ast-btn-splash');
    const splashContinue = container.querySelector('#ast-splash-continue');
    const configBtn = container.querySelector('#ast-btn-config');
    const configModal = container.querySelector('#ast-config-modal');
    const configClose = container.querySelector('#ast-config-close');
    const configCancel = container.querySelector('#ast-config-cancel');
    const configSave = container.querySelector('#ast-config-save');
    const providerSelect = container.querySelector('#ast-provider-select');
    const modelInput = container.querySelector('#ast-model-input');
    const keyInput = container.querySelector('#ast-key-input');
    const clearBtn = container.querySelector('#ast-btn-clear');
    const chips = container.querySelectorAll('.ast-chip');

    let currentAttachedFile = null;

    // Check splash screen
    if (!localStorage.getItem(STORAGE_SPLASH_SEEN)) {
      splashModal.style.display = 'flex';
    }

    splashContinue.addEventListener('click', () => {
      localStorage.setItem(STORAGE_SPLASH_SEEN, 'true');
      splashModal.style.display = 'none';
    });

    splashBtn.addEventListener('click', () => {
      splashModal.style.display = 'flex';
    });

    // API Config handlers
    configBtn.addEventListener('click', () => { configModal.style.display = 'flex'; });
    configClose.addEventListener('click', () => { configModal.style.display = 'none'; });
    configCancel.addEventListener('click', () => { configModal.style.display = 'none'; });
    providerSelect.addEventListener('change', () => {
      if (providerSelect.value === 'groq') modelInput.value = 'llama-3.3-70b-versatile';
      else if (providerSelect.value === 'gemini') modelInput.value = 'gemini-1.5-flash';
      else if (providerSelect.value === 'openrouter') modelInput.value = 'google/gemini-2.0-flash-exp:free';
    });

    configSave.addEventListener('click', () => {
      provider = providerSelect.value;
      model = modelInput.value.trim() || (provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gemini-1.5-flash');
      apiKey = keyInput.value.trim();
      localStorage.setItem(STORAGE_PROVIDER, provider);
      localStorage.setItem(STORAGE_MODEL, model);
      localStorage.setItem(STORAGE_API_KEY, apiKey);
      configModal.style.display = 'none';
      renderMessageList();
    });

    // Context toggle
    contextChk.addEventListener('change', () => {
      keepContext = contextChk.checked;
      localStorage.setItem(STORAGE_KEEP_CONTEXT, keepContext ? 'true' : 'false');
      if (!keepContext) {
        history = [];
        localStorage.removeItem(STORAGE_HISTORY);
      }
    });

    // Clear history
    clearBtn.addEventListener('click', () => {
      history = [];
      localStorage.removeItem(STORAGE_HISTORY);
      taskState.lastProcessedImage = null;
      taskState.lastCsvText = null;
      renderMessageList();
    });

    // Attached file remove
    attachedRemove.addEventListener('click', () => {
      currentAttachedFile = null;
      attachedBar.style.display = 'none';
      fileInput.value = '';
    });

    // File input change
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      if (!fileInput.files?.length) return;
      const file = fileInput.files[0];
      await handleFileAttachment(file);
    });

    async function handleFileAttachment(file) {
      const isImg = file.type.startsWith('image/');
      const isText = file.type.includes('text') || file.name.endsWith('.csv') || file.name.endsWith('.json') || file.name.endsWith('.cpp') || file.name.endsWith('.js') || file.name.endsWith('.py');

      let dataUrl = null;
      let textContent = null;
      let base64 = null;

      if (isImg) {
        dataUrl = await readFileAsDataUrl(file);
        base64 = dataUrl.split(',')[1];
      } else if (isText) {
        textContent = await file.text();
      }

      currentAttachedFile = {
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl,
        base64,
        text: textContent
      };

      attachedName.textContent = file.name;
      attachedSize.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
      attachedBar.style.display = 'flex';
    }

    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    // Chips
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        userInput.value = chip.textContent;
        handleSend();
      });
    });

    // Textarea resize & enter
    userInput.addEventListener('input', () => {
      userInput.style.height = 'auto';
      userInput.style.height = `${Math.min(140, userInput.scrollHeight)}px`;
    });

    userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    sendBtn.addEventListener('click', handleSend);

    function formatMarkdown(text) {
      if (!text) return '';
      return text
        .replace(/```([a-zA-Z]*)\n([\s\S]*?)```/g, '<pre style="background:#1e1e1e; color:#fff; padding:12px; border-radius:8px; overflow-x:auto; font-family:monospace; font-size:0.82rem;"><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.06); padding:2px 6px; border-radius:4px; font-family:monospace; font-size:0.84rem;">$1</code>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
    }

    function renderMessageList() {
      messagesEl.innerHTML = '';

      if (!apiKey && provider === 'gemini') {
        const keyNotice = document.createElement('div');
        keyNotice.className = 'ast-msg ast-msg-ai';
        keyNotice.style.display = 'flex';
        keyNotice.style.gap = '14px';
        keyNotice.style.maxWidth = '90%';
        keyNotice.innerHTML = `
          <div style="width:34px; height:34px; border-radius:50%; background:var(--black); color:var(--white); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          </div>
          <div style="background:var(--g100); padding:16px 20px; border-radius:16px; font-size:0.9rem; line-height:1.6; color:var(--black); border-left:4px solid #3b82f6;">
            <div style="font-weight:700; margin-bottom:6px;">Connect your free Google Gemini API Key</div>
            <div>Voltix Assistant connects directly to Google Gemini or Groq to perform real LLM reasoning and client-side tool execution.</div>
            <div style="margin-top:12px; display:flex; gap:10px; align-items:center;">
              <button type="button" class="btn btn-primary btn-sm" id="ast-open-config-btn" style="border-radius:9999px;">Enter Free API Key</button>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" style="font-size:0.8rem; color:#2563eb; text-decoration:underline;">Get Free Key at Google AI Studio &rarr;</a>
            </div>
          </div>
        `;
        keyNotice.querySelector('#ast-open-config-btn').addEventListener('click', () => configModal.style.display = 'flex');
        messagesEl.appendChild(keyNotice);
        return;
      }

      if (!history.length) {
        const welcome = document.createElement('div');
        welcome.className = 'ast-msg ast-msg-ai';
        welcome.style.display = 'flex';
        welcome.style.gap = '14px';
        welcome.style.maxWidth = '90%';
        welcome.innerHTML = `
          <div style="width:34px; height:34px; border-radius:50%; background:var(--black); color:var(--white); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          </div>
          <div style="background:var(--g100); padding:16px 20px; border-radius:16px; font-size:0.9rem; line-height:1.6; color:var(--black);">
            <div style="font-weight:700; margin-bottom:6px;">Hello! I am Voltix Assistant.</div>
            <div>I am connected to the live <strong>${provider === 'gemini' ? 'Google Gemini' : 'Groq Llama'}</strong> model with full access to Toolbox’s 100+ browser tools.</div>
            <div style="margin-top:8px; font-size:0.84rem; color:var(--g600);">
              You can chat naturally, attach images or datasets, and ask me to chain tools together (e.g. <em>"Convert this image to WebP, resize it to 1200px wide, and compress it"</em>).
            </div>
          </div>
        `;
        messagesEl.appendChild(welcome);
        return;
      }

      for (const msg of history) {
        if (msg.role === 'function') continue; // Tool responses are rendered inside assistant bubble
        appendRenderedMessage(msg.role, msg.content, msg.toolResults, msg.filePreview);
      }
    }

    function appendRenderedMessage(role, content, toolResults = [], filePreview = null) {
      const msgDiv = document.createElement('div');
      msgDiv.className = `ast-msg ast-msg-${role}`;
      msgDiv.style.display = 'flex';
      msgDiv.style.gap = '12px';
      msgDiv.style.maxWidth = role === 'user' ? '82%' : '90%';
      if (role === 'user') {
        msgDiv.style.marginLeft = 'auto';
        msgDiv.style.flexDirection = 'row-reverse';
      }

      const icon = role === 'user'
        ? `<div style="width:34px; height:34px; border-radius:50%; background:var(--g300); color:var(--black); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-weight:700; font-size:0.78rem;">YOU</div>`
        : `<div style="width:34px; height:34px; border-radius:50%; background:var(--black); color:var(--white); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
             <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
           </div>`;

      let toolsHtml = '';
      if (toolResults?.length) {
        toolsHtml = toolResults.map(tr => renderToolResultCard(tr)).join('');
      }

      let fileHtml = '';
      if (filePreview) {
        fileHtml = `
          <div style="margin-bottom:8px; padding:6px 10px; background:rgba(255,255,255,0.2); border-radius:8px; font-size:0.78rem; display:inline-flex; align-items:center; gap:6px;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            <span>${filePreview.name}</span>
          </div>
        `;
      }

      msgDiv.innerHTML = `
        ${icon}
        <div style="background:${role === 'user' ? 'var(--black)' : 'var(--g100)'}; color:${role === 'user' ? 'var(--white)' : 'var(--black)'}; padding:14px 18px; border-radius:16px; font-size:0.9rem; line-height:1.6; word-break:break-word; min-width:60px;">
          ${fileHtml}
          <div class="ast-text-body">${formatMarkdown(content)}</div>
          ${toolsHtml}
        </div>
      `;

      messagesEl.appendChild(msgDiv);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return msgDiv;
    }

    function renderToolResultCard(res) {
      if (!res) return '';
      if (res.dataUrl) {
        return `
          <div style="margin-top:12px; padding:12px; background:var(--white); border:1px solid var(--g200); border-radius:12px;">
            <div style="font-size:0.76rem; font-weight:700; color:var(--g600); margin-bottom:6px;">Output Artifact (${res.format?.toUpperCase()} · ${res.width}×${res.height}px)</div>
            <img src="${res.dataUrl}" style="max-height:220px; width:auto; border-radius:8px; object-fit:contain; background:var(--g50); display:block; margin-bottom:10px;">
            <a href="${res.dataUrl}" download="${res.filename}" class="btn btn-primary btn-sm" style="border-radius:9999px; font-size:0.76rem;">Download Processed File</a>
          </div>
        `;
      }
      if (res.numericStats) {
        return `
          <div style="margin-top:12px; padding:12px; background:var(--white); border:1px solid var(--g200); border-radius:12px;">
            <div style="font-size:0.8rem; font-weight:700; margin-bottom:4px;">Dataset Analysis Summary</div>
            <div style="font-size:0.75rem; color:var(--g600);">${res.totalRows} rows, ${res.totalColumns} attributes.</div>
          </div>
        `;
      }
      return '';
    }

    async function handleSend() {
      const text = userInput.value.trim();
      if (!text && !currentAttachedFile) return;

      if (!apiKey && provider === 'gemini') {
        configModal.style.display = 'flex';
        return;
      }

      userInput.value = '';
      userInput.style.height = 'auto';

      const fileToProcess = currentAttachedFile;
      currentAttachedFile = null;
      attachedBar.style.display = 'none';
      fileInput.value = '';

      // Append user message
      const userMsg = {
        role: 'user',
        content: text,
        filePreview: fileToProcess ? { name: fileToProcess.name, size: fileToProcess.size } : null,
        fileData: fileToProcess?.base64 ? { mimeType: fileToProcess.type || 'image/jpeg', base64: fileToProcess.base64 } : null
      };

      history.push(userMsg);
      appendRenderedMessage('user', text, [], userMsg.filePreview);

      // Create streaming Assistant response container
      const assistantMsgDiv = document.createElement('div');
      assistantMsgDiv.className = 'ast-msg ast-msg-assistant';
      assistantMsgDiv.style.display = 'flex';
      assistantMsgDiv.style.gap = '12px';
      assistantMsgDiv.style.maxWidth = '90%';

      assistantMsgDiv.innerHTML = `
        <div style="width:34px; height:34px; border-radius:50%; background:var(--black); color:var(--white); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
        </div>
        <div style="background:var(--g100); color:var(--black); padding:14px 18px; border-radius:16px; font-size:0.9rem; line-height:1.6; word-break:break-word; min-width:80px;">
          <div class="ast-tool-status-area" style="display:flex; flex-direction:column; gap:6px; margin-bottom:8px;"></div>
          <div class="ast-text-body"><span style="color:var(--g500);">Thinking...</span></div>
          <div class="ast-tool-results-area"></div>
        </div>
      `;

      messagesEl.appendChild(assistantMsgDiv);
      messagesEl.scrollTop = messagesEl.scrollHeight;

      const textBody = assistantMsgDiv.querySelector('.ast-text-body');
      const toolStatusArea = assistantMsgDiv.querySelector('.ast-tool-status-area');
      const toolResultsArea = assistantMsgDiv.querySelector('.ast-tool-results-area');

      let accumulatedStreamText = '';
      let executedToolResults = [];

      this._abortCtrl = new AbortController();

      try {
        await streamChatCompletion({
          provider,
          apiKey,
          model,
          history,
          systemInstruction: `User is in Toolbox workspace. Current active tool is: ${taskState.activeToolId || 'Home'}.`,
          currentFile: fileToProcess,
          taskState,
          onToken: (chunk) => {
            accumulatedStreamText += chunk;
            textBody.innerHTML = formatMarkdown(accumulatedStreamText);
            messagesEl.scrollTop = messagesEl.scrollHeight;
          },
          onToolCallStart: (toolName, toolArgs) => {
            const statusCard = document.createElement('div');
            statusCard.style.padding = '6px 10px';
            statusCard.style.background = 'var(--white)';
            statusCard.style.border = '1px solid var(--g300)';
            statusCard.style.borderRadius = '8px';
            statusCard.style.fontSize = '0.78rem';
            statusCard.style.fontWeight = '600';
            statusCard.style.display = 'flex';
            statusCard.style.alignItems = 'center';
            statusCard.style.gap = '6px';
            statusCard.innerHTML = `<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#3b82f6; animation:pulse 1s infinite;"></span> Executing tool: <code>${toolName}</code>...`;
            toolStatusArea.appendChild(statusCard);
          },
          onToolCallResult: (toolName, result) => {
            executedToolResults.push(result);
            toolStatusArea.innerHTML = `
              <div style="padding:6px 10px; background:var(--white); border:1px solid var(--g300); border-radius:8px; font-size:0.78rem; font-weight:600; color:#16a34a; display:flex; align-items:center; gap:6px;">
                <span>✓</span> Completed tool: <code>${toolName}</code>
              </div>
            `;
            if (result.dataUrl) {
              toolResultsArea.innerHTML = renderToolResultCard(result);
            }
          },
          signal: this._abortCtrl.signal
        });

        // Add assistant response to history
        history.push({
          role: 'assistant',
          content: accumulatedStreamText,
          toolResults: executedToolResults
        });

        if (keepContext) {
          try {
            localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history.slice(-20)));
          } catch {}
        }

      } catch (err) {
        textBody.innerHTML = `<span style="color:#ef4444; font-weight:600;">Error: ${err.message}</span>`;
      } finally {
        this._abortCtrl = null;
      }
    }

    renderMessageList();
  },

  destroy() {
    this._alive = false;
    this._abortCtrl?.abort();
  }
};
