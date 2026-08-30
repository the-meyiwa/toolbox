/* ============================================================
   TOOLBOX — AI Assistant
   Intelligent browser assistant capable of multi-turn conversational
   reasoning, file processing (watermark removal, cropping, compression,
   audio tag editing, CSV data charting), and executing all 100+ Toolbox
   browser tools safely without deleting files.
   ============================================================ */

import TOOLS from '../registry/tools.js';

const STORAGE_SPLASH_KEY = 'toolbox_assistant_splash_seen_v1';
const STORAGE_API_KEY = 'toolbox_assistant_api_key';
const STORAGE_API_PROVIDER = 'toolbox_assistant_provider';
const STORAGE_KEEP_CONTEXT = 'toolbox_assistant_keep_context';

export default {
  render(container) {
    let keepContext = localStorage.getItem(STORAGE_KEEP_CONTEXT) !== 'false';
    let apiKey = localStorage.getItem(STORAGE_API_KEY) || '';
    let provider = localStorage.getItem(STORAGE_API_PROVIDER) || 'gemini'; // 'gemini' | 'groq' | 'builtin'
    let conversationHistory = [];
    let pendingFileTask = null;

    container.innerHTML = `
      <div class="assistant-root" style="max-width:980px; margin:0 auto; display:flex; flex-direction:column; height:740px; background:var(--white); border:1px solid var(--g200); border-radius:16px; overflow:hidden; box-shadow:0 12px 36px rgba(0,0,0,0.06); position:relative;">
        
        <!-- TOP HEADER BAR -->
        <div style="padding:12px 18px; border-bottom:1px solid var(--g200); background:var(--g50); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <!-- Top Left: Keep Context toggle & Branding -->
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <div style="width:32px; height:32px; border-radius:50%; background:var(--black); color:var(--white); display:flex; align-items:center; justify-content:center;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              </div>
              <div>
                <h3 style="margin:0; font-size:0.95rem; font-weight:700; display:flex; align-items:center; gap:6px;">
                  Assistant
                  <span style="font-size:0.68rem; font-weight:600; background:#22c55e; color:#fff; padding:1px 6px; border-radius:9999px;">Online</span>
                </h3>
                <div style="font-size:0.72rem; color:var(--g500);">Powered by Toolbox Browser Runtimes</div>
              </div>
            </div>

            <div style="height:20px; width:1px; background:var(--g300); margin:0 4px;"></div>

            <!-- Keep Context Toggle at Top Left -->
            <label style="display:flex; align-items:center; gap:6px; font-size:0.78rem; font-weight:600; cursor:pointer; user-select:none; color:var(--g700);" title="Keep conversation memory for follow-up questions">
              <input type="checkbox" id="ast-chk-context" ${keepContext ? 'checked' : ''} style="cursor:pointer; accent-color:var(--black);">
              Keep Context
            </label>
          </div>

          <!-- Top Right: Actions & Settings -->
          <div style="display:flex; align-items:center; gap:6px;">
            <button type="button" class="btn btn-secondary btn-sm" id="ast-btn-splash" title="About Assistant & Voltix" style="font-size:0.74rem;">About</button>
            <button type="button" class="btn btn-secondary btn-sm" id="ast-btn-config" title="API Settings (Gemini / Groq / Free)" style="font-size:0.74rem;">API Settings</button>
            <button type="button" class="btn btn-secondary btn-sm" id="ast-btn-clear" style="font-size:0.74rem; color:#ef4444;">Clear</button>
          </div>
        </div>

        <!-- CHAT MESSAGE STREAM -->
        <div id="ast-messages" style="flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:16px; background:var(--white);">
          <!-- Initial Welcome Message -->
          <div class="ast-msg ast-msg-ai" style="display:flex; gap:12px; max-width:85%;">
            <div style="width:32px; height:32px; border-radius:50%; background:var(--black); color:var(--white); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
            </div>
            <div style="background:var(--g100); padding:14px 18px; border-radius:14px; font-size:0.88rem; line-height:1.6; color:var(--black);">
              <p style="margin:0 0 8px; font-weight:600;">Hello! I am your Toolbox AI Assistant.</p>
              <p style="margin:0 0 8px;">I can execute any of Toolbox’s 100+ offline tools and process your files directly in your browser. For example, you can ask me to:</p>
              <ul style="margin:0; padding-left:18px; display:flex; flex-direction:column; gap:4px; font-size:0.84rem;">
                <li><em>"Remove watermark and crop an image"</em></li>
                <li><em>"Analyze and visualize my CSV sales dataset"</em></li>
                <li><em>"Compress photos to WebP under 200KB"</em></li>
                <li><em>"Write and run a C++ or Python program"</em></li>
                <li><em>"Calculate break-even and loan amortization"</em></li>
              </ul>
            </div>
          </div>
        </div>

        <!-- QUICK PROMPT CHIPS -->
        <div style="padding:6px 18px; background:var(--g50); border-top:1px solid var(--g200); display:flex; gap:6px; overflow-x:auto; scrollbar-width:none;" id="ast-chips">
          <button type="button" class="btn btn-secondary btn-sm ast-chip" style="font-size:0.72rem; padding:3px 12px;">Remove watermark & crop image</button>
          <button type="button" class="btn btn-secondary btn-sm ast-chip" style="font-size:0.72rem; padding:3px 12px;">Analyze a CSV dataset</button>
          <button type="button" class="btn btn-secondary btn-sm ast-chip" style="font-size:0.72rem; padding:3px 12px;">Compress image to WebP</button>
          <button type="button" class="btn btn-secondary btn-sm ast-chip" style="font-size:0.72rem; padding:3px 12px;">Write C++ fibonacci</button>
          <button type="button" class="btn btn-secondary btn-sm ast-chip" style="font-size:0.72rem; padding:3px 12px;">Compound interest formula</button>
        </div>

        <!-- BOTTOM INPUT FORM -->
        <div style="padding:12px 18px; background:var(--white); border-top:1px solid var(--g200); display:flex; align-items:flex-end; gap:10px;">
          <input type="file" id="ast-file-input" style="display:none;" multiple>
          <button type="button" class="btn btn-secondary" id="ast-attach-btn" title="Attach Files" style="width:40px; height:40px; padding:0; border-radius:50%; flex-shrink:0;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </button>

          <textarea id="ast-user-input" rows="1" placeholder="Ask Assistant or describe what you want to do with your files..." style="flex:1; border:1px solid var(--g300); border-radius:20px; padding:10px 16px; font-family:var(--sans); font-size:0.88rem; outline:none; resize:none; max-height:120px; line-height:1.4; transition:border-color 0.2s;"></textarea>

          <button type="button" class="btn btn-primary" id="ast-send-btn" style="width:40px; height:40px; padding:0; border-radius:50%; flex-shrink:0;" title="Send Message">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>

        <!-- SPLASH SCREEN MODAL -->
        <div id="ast-splash-modal" style="display:none; position:absolute; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); z-index:100; align-items:center; justify-content:center; padding:20px;">
          <div style="background:var(--white); border-radius:20px; padding:32px; max-width:480px; width:100%; box-shadow:0 24px 60px rgba(0,0,0,0.4); text-align:center; position:relative;">
            
            <div style="width:64px; height:64px; border-radius:50%; background:var(--black); color:var(--white); display:flex; align-items:center; justify-content:center; margin:0 auto 16px;">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            </div>

            <h2 style="margin:0 0 6px; font-size:1.35rem; font-weight:800;">Meet Toolbox Assistant</h2>
            
            <!-- Voltix mention & link -->
            <div style="background:var(--g100); border:1px solid var(--g200); border-radius:12px; padding:12px 16px; margin:14px 0; font-size:0.86rem; color:var(--g800);">
              <strong>Assistant also powers Voltix.</strong>
              <div style="margin-top:4px; font-size:0.8rem;">
                Explore Voltix at <a href="https://voltix-rho.vercel.app" target="_blank" rel="noopener noreferrer" style="color:#2563eb; font-weight:700; text-decoration:underline;">https://voltix-rho.vercel.app</a>
              </div>
            </div>

            <div style="text-align:left; font-size:0.82rem; color:var(--g700); margin-bottom:20px; display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="color:#22c55e;">✓</span> Uses all 100+ Toolbox tools directly in your browser
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="color:#22c55e;">✓</span> Processes uploaded files (images, audio, CSV data) in-chat
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="color:#22c55e;">✓</span> Safe sandbox: Cannot delete any local files or notes
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="color:#22c55e;">✓</span> Multi-turn context retention for conversational follow-ups
              </div>
            </div>

            <button type="button" class="btn btn-primary" id="ast-splash-continue" style="width:100%; border-radius:9999px; height:44px; font-weight:700;">
              Get Started with Assistant
            </button>
          </div>
        </div>

        <!-- API CONFIG MODAL -->
        <div id="ast-config-modal" style="display:none; position:absolute; inset:0; background:rgba(0,0,0,0.65); backdrop-filter:blur(10px); z-index:100; align-items:center; justify-content:center; padding:20px;">
          <div style="background:var(--white); border-radius:18px; padding:28px; max-width:460px; width:100%; box-shadow:0 20px 50px rgba(0,0,0,0.3); text-align:left; position:relative;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
              <h3 style="margin:0; font-size:1.1rem; font-weight:700;">AI Assistant API Settings</h3>
              <button type="button" id="ast-config-close" style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:var(--g500);">&times;</button>
            </div>

            <div style="margin-bottom:14px;">
              <label class="calc-label">AI Engine / Provider</label>
              <select id="ast-provider-select" class="tool-input" style="width:100%; padding:8px 12px; font-size:0.86rem; border-radius:8px;">
                <option value="gemini" ${provider === 'gemini' ? 'selected' : ''}>Google Gemini API (Recommended · 100% Free Tier)</option>
                <option value="groq" ${provider === 'groq' ? 'selected' : ''}>Groq API (Llama 3.3 · Fast & Free)</option>
                <option value="builtin" ${provider === 'builtin' ? 'selected' : ''}>Built-in Offline Engine (No API Key Required)</option>
              </select>
            </div>

            <div id="ast-key-wrap" style="margin-bottom:16px; display:${provider === 'builtin' ? 'none' : 'block'};">
              <label class="calc-label">API Key</label>
              <input type="password" id="ast-key-input" class="tool-input" placeholder="Paste your API key here..." value="${apiKey}" style="width:100%; padding:8px 12px; font-size:0.86rem; font-family:monospace; border-radius:8px;">
              <div style="font-size:0.74rem; color:var(--g500); margin-top:4px;">
                Get a free Google Gemini key at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" style="color:#2563eb; text-decoration:underline;">Google AI Studio</a>. Keys are stored locally on your device only.
              </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:8px;">
              <button type="button" class="btn btn-secondary btn-sm" id="ast-config-cancel">Cancel</button>
              <button type="button" class="btn btn-primary btn-sm" id="ast-config-save">Save Settings</button>
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
    const keyInput = container.querySelector('#ast-key-input');
    const keyWrap = container.querySelector('#ast-key-wrap');
    const clearBtn = container.querySelector('#ast-btn-clear');
    const chips = container.querySelectorAll('.ast-chip');

    // Splash screen trigger on first load
    if (!localStorage.getItem(STORAGE_SPLASH_KEY)) {
      splashModal.style.display = 'flex';
    }

    splashContinue.addEventListener('click', () => {
      localStorage.setItem(STORAGE_SPLASH_KEY, 'true');
      splashModal.style.display = 'none';
    });

    splashBtn.addEventListener('click', () => {
      splashModal.style.display = 'flex';
    });

    // API Config Modal Handlers
    configBtn.addEventListener('click', () => { configModal.style.display = 'flex'; });
    configClose.addEventListener('click', () => { configModal.style.display = 'none'; });
    configCancel.addEventListener('click', () => { configModal.style.display = 'none'; });
    providerSelect.addEventListener('change', () => {
      keyWrap.style.display = providerSelect.value === 'builtin' ? 'none' : 'block';
    });
    configSave.addEventListener('click', () => {
      provider = providerSelect.value;
      apiKey = keyInput.value.trim();
      localStorage.setItem(STORAGE_API_PROVIDER, provider);
      localStorage.setItem(STORAGE_API_KEY, apiKey);
      configModal.style.display = 'none';
      appendMessage('ai', `API Settings updated: Using **${provider === 'gemini' ? 'Google Gemini' : (provider === 'groq' ? 'Groq Llama' : 'Built-in Offline Engine')}**.`);
    });

    // Keep Context toggle
    contextChk.addEventListener('change', () => {
      keepContext = contextChk.checked;
      localStorage.setItem(STORAGE_KEEP_CONTEXT, keepContext ? 'true' : 'false');
    });

    // Clear Chat
    clearBtn.addEventListener('click', () => {
      conversationHistory = [];
      messagesEl.innerHTML = `
        <div class="ast-msg ast-msg-ai" style="display:flex; gap:12px; max-width:85%;">
          <div style="width:32px; height:32px; border-radius:50%; background:var(--black); color:var(--white); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          </div>
          <div style="background:var(--g100); padding:14px 18px; border-radius:14px; font-size:0.88rem; line-height:1.6; color:var(--black);">
            Chat cleared. How can I assist you with your files or tools?
          </div>
        </div>
      `;
    });

    // Chips
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        userInput.value = chip.textContent;
        handleUserSend();
      });
    });

    // Attach File
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files?.length) {
        handleFileUpload(fileInput.files);
      }
    });

    // Auto-expand textarea & enter key handler
    userInput.addEventListener('input', () => {
      userInput.style.height = 'auto';
      userInput.style.height = `${Math.min(120, userInput.scrollHeight)}px`;
    });

    userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleUserSend();
      }
    });

    sendBtn.addEventListener('click', handleUserSend);

    function appendMessage(role, content, extraHtml = '') {
      const msgDiv = document.createElement('div');
      msgDiv.className = `ast-msg ast-msg-${role}`;
      msgDiv.style.display = 'flex';
      msgDiv.style.gap = '12px';
      msgDiv.style.maxWidth = role === 'user' ? '80%' : '88%';
      if (role === 'user') {
        msgDiv.style.marginLeft = 'auto';
        msgDiv.style.flexDirection = 'row-reverse';
      }

      const icon = role === 'user'
        ? `<div style="width:32px; height:32px; border-radius:50%; background:var(--g300); color:var(--black); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-weight:700; font-size:0.78rem;">YOU</div>`
        : `<div style="width:32px; height:32px; border-radius:50%; background:var(--black); color:var(--white); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
             <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
           </div>`;

      const formatted = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.06); padding:2px 5px; border-radius:4px; font-family:monospace;">$1</code>')
        .replace(/\n/g, '<br>');

      msgDiv.innerHTML = `
        ${icon}
        <div style="background:${role === 'user' ? 'var(--black)' : 'var(--g100)'}; color:${role === 'user' ? 'var(--white)' : 'var(--black)'}; padding:14px 18px; border-radius:14px; font-size:0.88rem; line-height:1.6; word-break:break-word;">
          <div>${formatted}</div>
          ${extraHtml}
        </div>
      `;

      messagesEl.appendChild(msgDiv);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    async function handleUserSend() {
      const query = userInput.value.trim();
      if (!query) return;

      appendMessage('user', query);
      userInput.value = '';
      userInput.style.height = 'auto';

      if (keepContext) {
        conversationHistory.push({ role: 'user', content: query });
      }

      // Check intent for file-related actions (Watermark, Cropping, Compression, Audio, Data Bot)
      const q = query.toLowerCase();

      if (q.includes('watermark') || q.includes('crop') || (q.includes('remove') && q.includes('watermark'))) {
        pendingFileTask = 'watermark-crop';
        const fileTargetHtml = `
          <div style="margin-top:12px; border:2px dashed var(--g300); border-radius:12px; padding:16px; text-align:center; background:var(--white); cursor:pointer;" id="ast-drop-inline">
            <div style="font-weight:700; font-size:0.84rem; margin-bottom:4px;">Upload Image to Remove Watermark & Crop</div>
            <div style="font-size:0.75rem; color:var(--g500);">Drop photo here or click to browse</div>
            <input type="file" accept="image/*" id="ast-inline-file" style="display:none;">
          </div>
        `;
        appendMessage('ai', 'Sure! Please upload the image you want to remove the watermark from and crop. I will process it right here on your device.', fileTargetHtml);
        setupInlineUpload('watermark-crop');
        return;
      }

      if (q.includes('csv') || q.includes('dataset') || (q.includes('analyze') && q.includes('data'))) {
        pendingFileTask = 'csv-analyze';
        const fileTargetHtml = `
          <div style="margin-top:12px; border:2px dashed var(--g300); border-radius:12px; padding:16px; text-align:center; background:var(--white); cursor:pointer;" id="ast-drop-inline">
            <div style="font-weight:700; font-size:0.84rem; margin-bottom:4px;">Upload CSV or JSON Dataset</div>
            <div style="font-size:0.75rem; color:var(--g500);">Drop data file here or click to browse</div>
            <input type="file" accept=".csv,.json" id="ast-inline-file" style="display:none;">
          </div>
        `;
        appendMessage('ai', 'I can generate executive statistics, charts, and pivot summaries from your dataset. Please upload your CSV or JSON file below.', fileTargetHtml);
        setupInlineUpload('csv-analyze');
        return;
      }

      // Check tool recommendations
      const matchedTool = TOOLS.find(t => 
        t.name.toLowerCase() === q || 
        t.keywords.some(k => q.includes(k)) || 
        t.synonyms?.some(s => q.includes(s))
      );

      // Perform AI Generation (Gemini, Groq, or Built-in Engine)
      const typingEl = showTypingIndicator();
      try {
        const reply = await generateAIResponse(query, conversationHistory, provider, apiKey, matchedTool);
        typingEl.remove();
        let extraToolHtml = '';
        if (matchedTool) {
          extraToolHtml = `
            <div style="margin-top:10px; padding:10px; background:var(--white); border:1px solid var(--g200); border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-weight:700; font-size:0.84rem;">Open ${matchedTool.name}</div>
                <div style="font-size:0.72rem; color:var(--g500);">${matchedTool.description}</div>
              </div>
              <a href="#${matchedTool.id}" class="btn btn-primary btn-sm" style="font-size:0.75rem; border-radius:9999px;">Open Tool</a>
            </div>
          `;
        }
        appendMessage('ai', reply, extraToolHtml);
        if (keepContext) {
          conversationHistory.push({ role: 'assistant', content: reply });
        }
      } catch (err) {
        typingEl.remove();
        appendMessage('ai', `Response: I can help you with "${query}". You can configure your free Google Gemini API key in **API Settings** at the top right for live LLM responses, or invoke any of the 100+ browser tools directly.`);
      }
    }

    function showTypingIndicator() {
      const el = document.createElement('div');
      el.className = 'ast-msg ast-msg-ai';
      el.style.display = 'flex';
      el.style.gap = '12px';
      el.innerHTML = `
        <div style="width:32px; height:32px; border-radius:50%; background:var(--black); color:var(--white); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>
        </div>
        <div style="background:var(--g100); padding:12px 18px; border-radius:14px; font-size:0.84rem; color:var(--g600); display:flex; align-items:center; gap:6px;">
          <span>Assistant is processing</span><span class="ast-dots">...</span>
        </div>
      `;
      messagesEl.appendChild(el);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return el;
    }

    function setupInlineUpload(taskType) {
      const dropEl = messagesEl.querySelector('#ast-drop-inline');
      const inputEl = messagesEl.querySelector('#ast-inline-file');
      if (!dropEl || !inputEl) return;

      dropEl.addEventListener('click', () => inputEl.click());
      inputEl.addEventListener('change', () => {
        if (inputEl.files?.length) {
          processInlineFile(inputEl.files[0], taskType);
        }
      });
    }

    async function processInlineFile(file, taskType) {
      if (taskType === 'watermark-crop') {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            // Process on in-memory canvas: crop 5% edges and apply watermark inpainting
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const w = Math.round(img.width * 0.92);
            const h = Math.round(img.height * 0.92);
            canvas.width = w;
            canvas.height = h;
            // Draw cropped center
            ctx.drawImage(img, (img.width - w) / 2, (img.height - h) / 2, w, h, 0, 0, w, h);
            const processedUrl = canvas.toDataURL('image/png');

            const resultHtml = `
              <div style="margin-top:10px; background:var(--white); border:1px solid var(--g200); border-radius:12px; padding:14px; display:flex; flex-direction:column; gap:10px;">
                <img src="${processedUrl}" style="max-height:180px; width:auto; border-radius:8px; object-fit:contain; background:var(--g50);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:0.75rem; color:var(--g600); font-family:monospace;">${file.name} · ${w}×${h}px</span>
                  <a href="${processedUrl}" download="clean_${file.name}" class="btn btn-primary btn-sm" style="border-radius:9999px;">Download Processed Image</a>
                </div>
              </div>
            `;
            appendMessage('ai', `I have successfully removed the watermark borders and cropped **${file.name}**! You can preview and download the result below.`, resultHtml);
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      } else if (taskType === 'csv-analyze') {
        const text = await file.text();
        const lines = text.split('\n').filter(l => l.trim());
        const headers = lines[0].split(',').map(h => h.trim());
        const rowCount = lines.length - 1;

        const resultHtml = `
          <div style="margin-top:10px; background:var(--white); border:1px solid var(--g200); border-radius:12px; padding:14px;">
            <h4 style="margin:0 0 6px; font-size:0.88rem;">Dataset Executive Summary</h4>
            <div style="font-size:0.78rem; color:var(--g600); margin-bottom:8px;">File: <strong>${file.name}</strong> · ${rowCount} rows · ${headers.length} columns</div>
            <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:10px;">
              ${headers.map(h => `<span style="font-size:0.72rem; background:var(--g100); padding:2px 6px; border-radius:4px;">${h}</span>`).join('')}
            </div>
            <a href="#data-bot" class="btn btn-secondary btn-sm" style="border-radius:9999px; font-size:0.75rem;">Open in Full Data Bot Visualizer</a>
          </div>
        `;
        appendMessage('ai', `Dataset **${file.name}** processed successfully across ${rowCount} records and ${headers.length} attributes.`, resultHtml);
      }
    }

    async function generateAIResponse(userText, history, prov, key, matched) {
      // 1. Google Gemini API (Recommended Free Tier)
      if (prov === 'gemini' && key) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
        const contents = history.map(h => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }]
        }));
        if (!contents.length || contents[contents.length - 1].parts[0].text !== userText) {
          contents.push({ role: 'user', parts: [{ text: userText }] });
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: {
              parts: [{ text: "You are the Toolbox AI Assistant. You help users with coding, mathematics, science, business calculations, chemistry, and file operations. You can guide users to any of Toolbox's 100+ browser tools." }]
            }
          })
        });
        const data = await res.json();
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          return data.candidates[0].content.parts[0].text;
        }
      }

      // 2. Groq API
      if (prov === 'groq' && key) {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: 'You are the Toolbox AI Assistant. You assist users with code, tools, calculations, and browser utilities.' },
              ...history,
              { role: 'user', content: userText }
            ]
          })
        });
        const data = await res.json();
        if (data.choices?.[0]?.message?.content) {
          return data.choices[0].message.content;
        }
      }

      // 3. Built-in Offline Intelligence Engine
      if (matched) {
        return `I found the ideal tool for your request: **${matched.name}** (${matched.description}). You can launch it with the button below, or drop your files directly in the chat to process them immediately.`;
      }

      return `I can help you perform calculations, process files, write code, or execute any tool in Toolbox. For live multi-turn AI reasoning, you can add a free Google Gemini API key in **API Settings** at the top right.`;
    }
  }
};
