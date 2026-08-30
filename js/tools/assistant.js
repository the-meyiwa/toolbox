/* ============================================================
   TOOLBOX — Voltix AI Assistant
   Real generative-AI assistant powered by live backend proxy & LLM
   with token streaming, multi-turn persistent context, real function/tool
   calling across 100+ browser tools, and safe file transformations.
   ============================================================ */

import { streamChatCompletion } from '../lib/ai-provider.js';
import { BY_ID } from '../registry/index.js';
import { QuotaManager } from '../lib/quota-manager.js';
import { openAccountModal } from '../views/account-modal.js';

const STORAGE_SPLASH_SEEN = 'voltix_assistant_splash_seen_v2';
const STORAGE_KEEP_CONTEXT = 'toolbox_assistant_keep_context';
const STORAGE_HISTORY = 'toolbox_assistant_history_v2';

export default {
  render(container, { tool, currentToolId } = {}) {
    this._alive = true;
    this._abortCtrl = null;

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

    const quota = QuotaManager.getQuotaSummary();

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

          <!-- Right: Quota Badge, About, Account, Clear -->
          <div style="display:flex; align-items:center; gap:8px;">
            <button type="button" class="btn btn-secondary btn-sm" id="ast-btn-quota" style="font-size:0.74rem; font-family:monospace; display:flex; align-items:center; gap:4px;" title="View daily quota & storage">
              <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#22c55e;"></span>
              <span id="ast-quota-label">${quota.messagesRemaining} / ${quota.messagesLimit} msgs</span>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="ast-btn-splash" style="font-size:0.74rem;">About</button>
            <button type="button" class="btn btn-secondary btn-sm" id="ast-btn-account" style="font-size:0.74rem;">Account</button>
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

        <!-- FIRST-TIME / ABOUT SPLASH SCREEN OVERLAY -->
        <div id="ast-splash-modal" style="display:none; position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.65); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); z-index:100; align-items:center; justify-content:center; padding:20px;">
          <div style="background:var(--white); border-radius:20px; padding:36px 32px; max-width:480px; width:100%; box-shadow:0 24px 64px rgba(0,0,0,0.25); text-align:center; position:relative; border:1px solid var(--g200);">
            <div style="width:56px; height:56px; border-radius:50%; background:var(--black); color:var(--white); margin:0 auto 16px; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 16px rgba(0,0,0,0.2);">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            </div>
            <h3 style="margin:0 0 8px; font-size:1.4rem; font-weight:800; color:var(--black); letter-spacing:-0.02em;">Meet Voltix Assistant</h3>
            <p style="margin:0 0 16px; font-size:0.95rem; font-weight:600; color:var(--g800);">
              Assistant also powers Voltix.
            </p>
            <p style="margin:0 0 20px; font-size:0.86rem; color:var(--g600); line-height:1.5;">
              The AI layer of Toolbox capable of understanding user requests, processing files, running code, and executing client-side browser tools.
            </p>
            <div style="margin-bottom:24px; padding:12px; background:var(--g100); border-radius:12px; font-size:0.82rem; color:var(--g700); display:flex; align-items:center; justify-content:center; gap:8px;">
              <span>Explore the flagship ecosystem:</span>
              <a href="https://voltix-rho.vercel.app" target="_blank" rel="noopener noreferrer" style="font-weight:700; color:var(--black); text-decoration:underline;">voltix-rho.vercel.app &nearr;</a>
            </div>
            <button type="button" class="btn btn-primary" id="ast-splash-continue-btn" style="width:100%; padding:10px 0; font-size:0.92rem; font-weight:700;">
              Get Started
            </button>
          </div>
        </div>

      </div>
    `;

    // DOM Elements
    const messagesEl = container.querySelector('#ast-messages');
    const userInput = container.querySelector('#ast-user-input');
    const sendBtn = container.querySelector('#ast-send-btn');
    const fileInput = container.querySelector('#ast-file-input');
    const attachBtn = container.querySelector('#ast-attach-btn');
    const attachedBar = container.querySelector('#ast-attached-bar');
    const attachedName = container.querySelector('#ast-attached-name');
    const attachedSize = container.querySelector('#ast-attached-size');
    const attachedRemove = container.querySelector('#ast-attached-remove');
    const splashModal = container.querySelector('#ast-splash-modal');
    const splashContinueBtn = container.querySelector('#ast-splash-continue-btn');
    const btnSplash = container.querySelector('#ast-btn-splash');
    const btnAccount = container.querySelector('#ast-btn-account');
    const btnQuota = container.querySelector('#ast-btn-quota');
    const quotaLabel = container.querySelector('#ast-quota-label');
    const btnClear = container.querySelector('#ast-btn-clear');
    const chkContext = container.querySelector('#ast-chk-context');
    const chipsWrap = container.querySelector('#ast-chips');

    let currentAttachedFile = null;

    function updateQuotaDisplay() {
      const q = QuotaManager.getQuotaSummary();
      if (quotaLabel) quotaLabel.textContent = `${q.messagesRemaining} / ${q.messagesLimit} msgs`;
    }

    // Show splash screen on first launch
    const splashSeen = localStorage.getItem(STORAGE_SPLASH_SEEN);
    if (!splashSeen) {
      splashModal.style.display = 'flex';
    }

    splashContinueBtn.addEventListener('click', () => {
      localStorage.setItem(STORAGE_SPLASH_SEEN, 'true');
      splashModal.style.display = 'none';
    });

    btnSplash.addEventListener('click', () => {
      splashModal.style.display = 'flex';
    });

    btnAccount.addEventListener('click', openAccountModal);
    btnQuota.addEventListener('click', openAccountModal);

    // Clear Conversation
    btnClear.addEventListener('click', () => {
      if (confirm('Clear current conversation history?')) {
        history = [];
        localStorage.removeItem(STORAGE_HISTORY);
        renderMessageList();
      }
    });

    // Toggle Keep Context
    chkContext.addEventListener('change', (e) => {
      keepContext = e.target.checked;
      localStorage.setItem(STORAGE_KEEP_CONTEXT, keepContext ? 'true' : 'false');
      if (!keepContext) {
        localStorage.removeItem(STORAGE_HISTORY);
      }
    });

    // File Attachment handlers
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      handleFileSelected(file);
    });

    attachedRemove.addEventListener('click', () => {
      currentAttachedFile = null;
      attachedBar.style.display = 'none';
      fileInput.value = '';
    });

    function handleFileSelected(file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const raw = evt.target.result;
        const base64 = typeof raw === 'string' && raw.includes(',') ? raw.split(',')[1] : null;
        currentAttachedFile = {
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: raw,
          base64: base64,
          text: typeof raw === 'string' && !raw.startsWith('data:') ? raw : null
        };
        attachedName.textContent = file.name;
        attachedSize.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
        attachedBar.style.display = 'flex';
      };

      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    }

    // Quick prompt chips
    chipsWrap.addEventListener('click', (e) => {
      const chip = e.target.closest('.ast-chip');
      if (chip) {
        userInput.value = chip.textContent.trim();
        userInput.focus();
        handleAutoResize();
      }
    });

    // Input auto-resize
    function handleAutoResize() {
      userInput.style.height = 'auto';
      userInput.style.height = Math.min(userInput.scrollHeight, 140) + 'px';
    }
    userInput.addEventListener('input', handleAutoResize);

    userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    sendBtn.addEventListener('click', handleSend);

    function renderMessageList() {
      messagesEl.innerHTML = '';
      if (!history.length) {
        messagesEl.innerHTML = `
          <div style="text-align:center; padding:48px 20px; color:var(--g500);">
            <div style="width:48px; height:48px; border-radius:50%; background:var(--g100); color:var(--black); margin:0 auto 14px; display:flex; align-items:center; justify-content:center;">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            </div>
            <h4 style="margin:0 0 6px; font-size:1.05rem; font-weight:700; color:var(--black);">How can Voltix Assistant help you?</h4>
            <p style="margin:0; font-size:0.84rem; max-width:440px; margin:0 auto; line-height:1.5;">
              I can convert and compress images, analyze data tables, run Python/C++ code, calculate finances, and solve chemistry equations client-side.
            </p>
          </div>
        `;
        return;
      }

      for (const msg of history) {
        if (msg.role === 'user') {
          appendRenderedMessage('user', msg.content, [], msg.filePreview);
        } else if (msg.role === 'assistant') {
          appendRenderedMessage('assistant', msg.content, msg.toolResults || []);
        }
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function appendRenderedMessage(role, text, toolResults = [], filePreview = null) {
      const msgDiv = document.createElement('div');
      msgDiv.className = `ast-msg ast-msg-${role}`;
      msgDiv.style.display = 'flex';
      msgDiv.style.gap = '12px';
      msgDiv.style.maxWidth = '90%';

      if (role === 'user') {
        msgDiv.style.alignSelf = 'flex-end';
        msgDiv.style.flexDirection = 'row-reverse';
        msgDiv.innerHTML = `
          <div style="width:34px; height:34px; border-radius:50%; background:var(--g300); color:var(--black); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-weight:700; font-size:0.8rem;">
            You
          </div>
          <div style="background:var(--black); color:var(--white); padding:12px 16px; border-radius:16px; font-size:0.9rem; line-height:1.5; word-break:break-word;">
            ${filePreview ? `
              <div style="margin-bottom:8px; padding:6px 10px; background:rgba(255,255,255,0.15); border-radius:8px; font-size:0.78rem; display:flex; align-items:center; gap:6px;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                <span>${filePreview.name}</span>
                <span style="opacity:0.7;">(${(filePreview.size / 1024).toFixed(1)} KB)</span>
              </div>
            ` : ''}
            <div>${escapeHtml(text)}</div>
          </div>
        `;
      } else {
        msgDiv.style.alignSelf = 'flex-start';
        msgDiv.innerHTML = `
          <div style="width:34px; height:34px; border-radius:50%; background:var(--black); color:var(--white); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          </div>
          <div style="background:var(--g100); color:var(--black); padding:14px 18px; border-radius:16px; font-size:0.9rem; line-height:1.6; word-break:break-word;">
            <div class="ast-text-body">${formatMarkdown(text)}</div>
            ${toolResults?.length ? `
              <div style="margin-top:12px; display:flex; flex-direction:column; gap:8px;">
                ${toolResults.map(r => renderToolResultCard(r)).join('')}
              </div>
            ` : ''}
          </div>
        `;
      }

      messagesEl.appendChild(msgDiv);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function renderToolResultCard(result) {
      if (result.dataUrl) {
        return `
          <div style="padding:12px; background:var(--white); border:1px solid var(--g300); border-radius:12px;">
            <div style="font-size:0.78rem; font-weight:700; color:var(--black); margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
              <span>Generated Artifact</span>
              <a href="${result.dataUrl}" download="${result.filename || 'processed-file'}" class="btn btn-primary btn-sm" style="font-size:0.72rem; padding:4px 10px;">
                Download ${result.filename || 'File'}
              </a>
            </div>
            <img src="${result.dataUrl}" style="max-width:100%; max-height:220px; border-radius:8px; display:block; object-fit:contain; background:#111;">
          </div>
        `;
      }
      return '';
    }

    function escapeHtml(s) {
      return String(s || '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
    }

    function formatMarkdown(text) {
      if (!text) return '';
      let html = escapeHtml(text);
      // Bold
      html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      // Inline code
      html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.06); padding:2px 6px; border-radius:4px; font-family:monospace; font-size:0.85em;">$1</code>');
      // Code blocks
      html = html.replace(/```([a-z]*)\n([\s\S]*?)```/g, '<pre style="background:var(--black); color:var(--white); padding:12px; border-radius:8px; overflow-x:auto; font-size:0.82rem; margin:10px 0;"><code>$2</code></pre>');
      // Line breaks
      html = html.replace(/\n/g, '<br>');
      return html;
    }

    async function handleSend() {
      const text = userInput.value.trim();
      if (!text && !currentAttachedFile) return;

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

        updateQuotaDisplay();

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
